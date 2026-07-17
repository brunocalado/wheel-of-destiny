/*!
 * Wheel Of Destiny
 * Copyright (c) 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */
import { MODULE_ID } from "./constants.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Stand-in actor type for tokens whose actor was deleted. @type {string} */
const NO_ACTOR_TYPE = "__none__";

/**
 * Scene token browser used to build the pool for a draw.
 *
 * Opened whenever a GM triggers a draw without a pool already staged on the canvas.
 * Resolution goes through `open()` rather than a form submit: the caller wants Token
 * placeables back, not form data, and dismissing the window has to be distinguishable
 * from drawing an empty pool.
 *
 * The filters are the primary selection tool, not just a view: narrowing them ticks
 * every row that survives and unticks every row that does not, so the pool is what the
 * list shows. Individual rows can then be unticked by hand to carve out exceptions —
 * until the next filter change, which re-derives the whole selection.
 *
 * `BASE_APPLICATION` is deliberately left alone: this is a leaf class, so ApplicationV2
 * must stay the floor of the DEFAULT_OPTIONS merge chain.
 */
export default class TokenPickerForm extends HandlebarsApplicationMixin(ApplicationV2) {

  /**
   * Settles the promise handed out by `open()`.
   * @type {?function(Token[]|null): void}
   */
  #resolve;

  /** Guards against settling twice — drawing closes the window, which settles again. */
  #settled = false;

  /**
   * The window currently on screen, if any. DEFAULT_OPTIONS pins a fixed `id`, so a
   * second instance would fight the first over the same element.
   * @type {?TokenPickerForm}
   */
  static #current = null;

  static DEFAULT_OPTIONS = {
    id: "wod-token-picker",
    classes: [MODULE_ID, "wod-token-picker"],
    position: { width: 540, height: 560 },
    window: {
      title: "Choose Tokens — Wheel of Destiny",
      icon: "fas fa-yin-yang",
      contentClasses: ["wod-picker-content"],
      resizable: true
    },
    actions: {
      draw: this.prototype._onDraw,
      selectAll: this.prototype._onSelectAll,
      selectNone: this.prototype._onSelectNone,
      resetFilters: this.prototype._onResetFilters,
      toggleFilter: this.prototype._onToggleFilter,
      setFilter: this.prototype._onSetFilter
    }
  };

  static PARTS = {
    body: {
      template: `modules/${MODULE_ID}/templates/token-picker.hbs`,
      scrollable: [".wod-picker-list"]
    }
  };

  /**
   * Opens the picker and waits for the GM to commit a pool.
   * @returns {Promise<Token[]|null>} The chosen tokens, or `null` if the window was
   *   dismissed or one was already open.
   */
  static async open() {
    // Triggering the draw again while the picker is up surfaces the window rather than
    // opening a rival copy of it.
    if (TokenPickerForm.#current) {
      TokenPickerForm.#current.bringToFront();
      return null;
    }

    return new Promise(resolve => {
      const app = new this();
      TokenPickerForm.#current = app;
      app.#resolve = resolve;
      app.render({ force: true }).catch(err => {
        console.error(`${MODULE_ID} | Failed to render the token picker.`, err);
        TokenPickerForm.#current = null;
        app.#settle(null);
      });
    });
  }

  /**
   * Human label for an Actor subtype. Types come from whatever system and modules the
   * world runs, so the label is resolved through CONFIG instead of being hardcoded.
   * @param {string} type An Actor subtype id, or `NO_ACTOR_TYPE`.
   * @returns {string}
   */
  static #actorTypeLabel(type) {
    if (type === NO_ACTOR_TYPE) return "No Actor";
    const key = CONFIG.Actor.typeLabels?.[type];
    const localized = key ? game.i18n.localize(key) : "";
    // localize() hands back the key untouched when the system ships no translation for
    // it, which would put a raw i18n path on screen.
    if (localized && localized !== key) return localized;
    return type.charAt(0).toUpperCase() + type.slice(1);
  }

  /**
   * Builds the token rows and the filter options they are matched against.
   * Called from the ApplicationV2 render lifecycle.
   * @param {object} options
   * @returns {Promise<object>}
   */
  async _prepareContext(options) {
    // Plain English labels: the module ships no localization files, and core's
    // disposition i18n keys are not stable enough across builds to rely on.
    const dispositions = [
      { value: CONST.TOKEN_DISPOSITIONS.FRIENDLY, key: "friendly", label: "Friendly" },
      { value: CONST.TOKEN_DISPOSITIONS.NEUTRAL,  key: "neutral",  label: "Neutral" },
      { value: CONST.TOKEN_DISPOSITIONS.HOSTILE,  key: "hostile",  label: "Hostile" },
      { value: CONST.TOKEN_DISPOSITIONS.SECRET,   key: "secret",   label: "Secret" }
    ];
    const dispositionByValue = new Map(dispositions.map(d => [d.value, d]));

    // user.character is Foundry's one-actor-per-user link. Nothing stops two users from
    // pointing at the same actor, so the names are collected rather than overwritten.
    const userNamesByActor = new Map();
    for (const user of game.users) {
      const actorId = user.character?.id;
      if (!actorId) continue;
      if (!userNamesByActor.has(actorId)) userNamesByActor.set(actorId, []);
      userNamesByActor.get(actorId).push(user.name);
    }

    const typeCounts = new Map();

    const tokens = canvas.tokens.placeables.map(token => {
      const actor = token.actor;
      const type = actor?.type ?? NO_ACTOR_TYPE;
      typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);

      const userNames = actor ? (userNamesByActor.get(actor.id) ?? []) : [];
      const disposition = dispositionByValue.get(token.document.disposition);

      return {
        id: token.id,
        name: token.document.name,
        img: token.document.texture.src,
        actorType: type,
        actorTypeLabel: TokenPickerForm.#actorTypeLabel(type),
        disposition: token.document.disposition,
        dispositionKey: disposition?.key ?? "neutral",
        dispositionLabel: disposition?.label ?? "Unknown",
        linked: userNames.length > 0,
        userNames: userNames.join(", "),
        hidden: token.document.hidden === true
      };
    }).sort((a, b) => a.name.localeCompare(b.name));

    const actorTypes = [...typeCounts]
      .map(([key, count]) => ({ key, count, label: TokenPickerForm.#actorTypeLabel(key) }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return { tokens, actorTypes, dispositions };
  }

  /**
   * Wires the row checkboxes. A tick is not a click on a `[data-action]` element, so it
   * cannot go through `DEFAULT_OPTIONS.actions` — the filter buttons can, and do.
   *
   * Bound here rather than in `_onRender` because ApplicationV2 keeps the root element
   * across re-renders and only swaps the part contents — re-binding per render would
   * stack a duplicate listener each time. Delegation from the root survives those swaps.
   * Called once from the ApplicationV2 render lifecycle.
   * @param {object} context
   * @param {object} options
   * @returns {void}
   */
  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    this.element.addEventListener("change", event => {
      if (event.target.matches("input[name='tokenId']")) this.#updateSummary();
    });
  }

  /**
   * Seeds the selection from the opening filter state — which is "everything", so the
   * picker opens with the whole scene in the pool.
   * Called from the ApplicationV2 render lifecycle.
   * @param {object} context
   * @param {object} options
   * @returns {void}
   */
  _onRender(context, options) {
    super._onRender(context, options);
    this.#applyFilters();
  }

  /**
   * Resolves the pending `open()` promise, once.
   * @param {Token[]|null} result
   * @returns {void}
   */
  #settle(result) {
    if (this.#settled) return;
    this.#settled = true;
    this.#resolve?.(result);
  }

  /**
   * Dismissing the window is a cancelled draw.
   * Called from the ApplicationV2 close lifecycle.
   * @param {object} options
   * @returns {void}
   */
  _onClose(options) {
    super._onClose(options);
    TokenPickerForm.#current = null;
    this.#settle(null);
  }

  /**
   * Row checkboxes that are both ticked and currently passing the filters. Filtering
   * already unticks what it hides; the selector re-states it so a hidden token can never
   * reach the draw even if that ever stops holding.
   * @returns {HTMLInputElement[]}
   */
  #selectedInputs() {
    return [...this.element.querySelectorAll(
      ".wod-token-row:not(.wod-row--filtered) input[name='tokenId']:checked"
    )];
  }

  /**
   * Shows the rows matching every active filter and makes them the selection.
   * @returns {void}
   */
  #applyFilters() {
    const pressedValues = filter => new Set([...this.element.querySelectorAll(
      `[data-filter="${filter}"][aria-pressed="true"]`
    )].map(button => button.dataset.value));

    const types = pressedValues("actorType");
    const dispositions = pressedValues("disposition");
    // Segments allow exactly one choice, so these collapse to a single value.
    const [linked = "any"] = pressedValues("linked");
    const [visibility = "any"] = pressedValues("visibility");

    for (const row of this.element.querySelectorAll(".wod-token-row")) {
      const data = row.dataset;
      const show = types.has(data.actorType)
        && dispositions.has(data.disposition)
        && (linked === "any" || data.linked === linked)
        && (visibility === "any" || data.hidden === String(visibility === "hidden"));

      row.classList.toggle("wod-row--filtered", !show);
      // The filters drive the pool: what survives them is in, what does not is out.
      row.querySelector("input[name='tokenId']").checked = show;
    }

    this.#updateSummary();
  }

  /**
   * Refreshes the pool count and the Draw button's enabled state.
   * @returns {void}
   */
  #updateSummary() {
    const selected = this.#selectedInputs().length;
    this.element.querySelector("[data-summary]").textContent = `${selected} selected`;
    this.element.querySelector("[data-action='draw']").disabled = selected < 1;
  }

  /**
   * Ticks or clears every row the filters currently show.
   * @param {boolean} checked
   * @returns {void}
   */
  #setVisibleSelection(checked) {
    for (const input of this.element.querySelectorAll(
      ".wod-token-row:not(.wod-row--filtered) input[name='tokenId']"
    )) input.checked = checked;
    this.#updateSummary();
  }

  /**
   * Flips one multi-choice filter chip. Registered as the `toggleFilter` action.
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @returns {void}
   */
  _onToggleFilter(event, target) {
    const pressed = target.getAttribute("aria-pressed") === "true";
    target.setAttribute("aria-pressed", String(!pressed));
    this.#applyFilters();
  }

  /**
   * Moves a single-choice filter segment to the clicked option.
   * Registered as the `setFilter` action.
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @returns {void}
   */
  _onSetFilter(event, target) {
    for (const button of target.closest(".wod-segment").querySelectorAll("button")) {
      button.setAttribute("aria-pressed", String(button === target));
    }
    this.#applyFilters();
  }

  /**
   * Returns every filter to "match anything", which re-selects the whole scene.
   * Registered as the `resetFilters` action.
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @returns {void}
   */
  _onResetFilters(event, target) {
    for (const chip of this.element.querySelectorAll(".wod-chip")) {
      chip.setAttribute("aria-pressed", "true");
    }
    for (const button of this.element.querySelectorAll(".wod-segment button")) {
      button.setAttribute("aria-pressed", String(button.dataset.value === "any"));
    }
    this.#applyFilters();
  }

  /**
   * Commits the pool and closes. Registered as the `draw` action.
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @returns {Promise<void>}
   */
  async _onDraw(event, target) {
    // Re-resolve through the canvas: a token can be deleted while the picker is open.
    const tokens = this.#selectedInputs()
      .map(input => canvas.tokens.get(input.value))
      .filter(token => token);

    if (!tokens.length) {
      ui.notifications.warn("☯ " + "Select at least one token to draw from.");
      return;
    }

    this.#settle(tokens);
    await this.close();
  }

  /**
   * Registered as the `selectAll` action.
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @returns {void}
   */
  _onSelectAll(event, target) {
    this.#setVisibleSelection(true);
  }

  /**
   * Registered as the `selectNone` action.
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @returns {void}
   */
  _onSelectNone(event, target) {
    this.#setVisibleSelection(false);
  }
}
