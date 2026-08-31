/*!
 * Wheel Of Destiny
 * Copyright (c) 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */
import { MODULE_ID } from "./constants.js";
import { pingToken } from "./helpers.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Stand-in actor type for tokens whose actor was deleted. @type {string} */
const NO_ACTOR_TYPE = "__none__";

/**
 * Bounds for how many chances one row can hold. One is the floor rather than zero because
 * a token with no chances is a token that is not in the draw, and unticking the row
 * already says exactly that — a 0% row sitting in the pool would be a second, quietly
 * contradictory way to say it. The ceiling is arbitrary; it keeps the column's width
 * honest and a leaned-on `+` harmless.
 */
const MIN_CHANCES = 1;
const MAX_CHANCES = 99;

/**
 * The TokenDocument fields a row is built from. An update touching none of them changes
 * nothing the picker shows — token movement, most of all, which updates `x`/`y` on every
 * frame of a drag — so it is not worth rebuilding the list for.
 * @type {string[]}
 */
const DISPLAYED_TOKEN_FIELDS = ["name", "texture", "disposition", "hidden", "actorId"];

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
 * Filter state is remembered per client (see `#saveFilterState`/`#restoreFilterState`),
 * so reopening the picker starts from wherever it was last left — unless that state
 * would open onto an empty pool, in which case `_onRender` falls back to the defaults.
 *
 * Canvas selection and the row list mirror each other for as long as the picker stays
 * open: every pool change controls or releases the matching tokens (`#syncCanvasSelection`),
 * so the GM can see and shift-click the pool on the map, not just in the list; and
 * controlling or releasing a token directly on the canvas mirrors back into its row
 * (`#onControlToken`), widening only the filters that were hiding it rather than running a
 * full filter re-derivation — otherwise every other row the widened filter matches would
 * get swept into the pool too. Whatever was controlled before the picker opened is
 * restored on close, so this takeover never leaks into `WoD.randomToken()`'s own use of
 * `canvas.tokens.controlled`.
 *
 * The list is rebuilt in place whenever the scene's tokens change underneath it — one
 * added, one deleted, or one edited in a way a row shows. Without that the window would
 * keep offering a token that no longer exists and stay blind to one just dropped on the
 * map. A rebuild keeps the pool as the GM left it (see `#reapplySelection`) rather than
 * re-deriving it from the filters, which would throw away every manual exception.
 *
 * Membership is not the whole story: each row also carries a number of chances — one by
 * default, stepped with the `+`/`-` buttons in its chance column — and the column shows
 * the odds those chances buy against everything else currently in the pool, recomputed on
 * every change. They are session state rather than a remembered setting on purpose:
 * weighting answers "who is this creature most likely to swing at *right now*", which is
 * not a thing to carry into the next draw.
 *
 * `BASE_APPLICATION` is deliberately left alone: this is a leaf class, so ApplicationV2
 * must stay the floor of the DEFAULT_OPTIONS merge chain.
 */
export default class TokenPickerForm extends HandlebarsApplicationMixin(ApplicationV2) {

  /**
   * Settles the promise handed out by `open()`.
   * @type {?function({tokens: Token[], weights: Map<string, number>}|null): void}
   */
  #resolve;

  /** Guards against settling twice — drawing closes the window, which settles again. */
  #settled = false;

  /**
   * The `controlToken` hook callback, bound to this instance and kept so it can be
   * removed again on close — an unremoved hook would keep firing into a dead app.
   * @type {?function(Token, boolean): void}
   */
  #controlTokenHook = null;

  /**
   * The scene-token hooks that keep the list current, kept so they can be removed again
   * on close — an unremoved hook would keep firing into a dead app.
   * @type {Array<{event: string, callback: Function}>}
   */
  #sceneHooks = [];

  /**
   * The pool captured just before a refresh re-render, so the rebuilt list can be put back
   * the way the GM left it. Null except across that one render.
   * @type {?{ticked: Set<string>, known: Set<string>}}
   */
  #pendingSelection = null;

  /**
   * Whatever was controlled on canvas before the picker took over selection, so `_onClose`
   * can hand it back exactly as found. Without this, whatever the picker was showing as
   * the pool at the moment it closed would linger as the canvas selection and quietly
   * become the pool for the next quick draw — `WoD.randomToken()` reads
   * `canvas.tokens.controlled` directly when it is not given an explicit list.
   * @type {Set<string>}
   */
  #initialControlledIds = new Set();

  /**
   * True while `#syncCanvasSelection` is itself (de)controlling tokens, so the
   * `controlToken` hooks that provokes are not mistaken for the GM's own canvas click.
   */
  #syncingCanvas = false;

  /**
   * Draw chances per token id, for the rows stepped away from the default only. Holding
   * just the exceptions is what lets `#chancesOf` answer for a token the picker has never
   * been told anything about — including every row of a freshly opened window — without
   * the map having to be seeded from, or kept in step with, the token list.
   * @type {Map<string, number>}
   */
  #chances = new Map();

  /**
   * Debounce handle for `#savePosition` — dragging and resizing call `setPosition`
   * continuously, and only where it comes to rest is worth writing to the client.
   * @type {?number}
   */
  #savePositionTimeout = null;

  /**
   * The window currently on screen, if any. DEFAULT_OPTIONS pins a fixed `id`, so a
   * second instance would fight the first over the same element.
   * @type {?TokenPickerForm}
   */
  static #current = null;

  static DEFAULT_OPTIONS = {
    id: "wod-token-picker",
    classes: [MODULE_ID, "wod-token-picker"],
    // Narrower than a first guess would land on: badges and names already truncate with
    // an ellipsis, so the list stays readable while leaving more of the canvas visible
    // behind it — wide enough for the chance column and no wider. Only a starting point —
    // `open()` overrides it with whatever the client last resized the window to, once one
    // has been remembered.
    position: { width: 480, height: 560 },
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
      setFilter: this.prototype._onSetFilter,
      locateToken: this.prototype._onLocateToken,
      increaseChance: this.prototype._onIncreaseChance,
      decreaseChance: this.prototype._onDecreaseChance
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
   * @returns {Promise<{tokens: Token[], weights: Map<string, number>}|null>} The chosen
   *   tokens and how many chances each of them was given, or `null` if the window was
   *   dismissed or one was already open.
   */
  static async open() {
    // Triggering the draw again while the picker is up surfaces the window rather than
    // opening a rival copy of it.
    if (TokenPickerForm.#current) {
      TokenPickerForm.#current.bringToFront();
      return null;
    }

    // Overrides DEFAULT_OPTIONS.position with wherever this client last left the window,
    // if anywhere — the constructor merges this over the class default the same way any
    // caller's options would.
    const position = game.settings.get(MODULE_ID, "tokenPickerPosition");

    return new Promise(resolve => {
      const app = new this(position ? { position } : {});
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
    // The row badge shows `emoji` instead of `label` — computed here rather than with a
    // Handlebars comparison helper in the template, so the template stays a plain lookup.
    const dispositions = [
      { value: CONST.TOKEN_DISPOSITIONS.FRIENDLY, key: "friendly", label: "Friendly", emoji: "🙂" },
      { value: CONST.TOKEN_DISPOSITIONS.NEUTRAL,  key: "neutral",  label: "Neutral",  emoji: "😐" },
      { value: CONST.TOKEN_DISPOSITIONS.HOSTILE,  key: "hostile",  label: "Hostile",  emoji: "😠" },
      { value: CONST.TOKEN_DISPOSITIONS.SECRET,   key: "secret",   label: "Secret",   emoji: "🎭" }
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
        dispositionEmoji: disposition?.emoji ?? "❓",
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
   * Wires the row checkboxes and the live canvas-selection sync. A tick is not a click
   * on a `[data-action]` element, so it cannot go through `DEFAULT_OPTIONS.actions` — the
   * filter buttons can, and do.
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

    // Captured before anything below can change canvas selection, so `_onClose` has an
    // accurate "before" state to restore.
    this.#initialControlledIds = new Set(canvas.tokens.controlled.map(token => token.id));

    // Left-clicking (or shift-clicking, or rubber-band-selecting) a token on the canvas
    // while the picker is open should register the same way ticking its row would.
    this.#controlTokenHook = (token, controlled) => this.#onControlToken(token, controlled);
    Hooks.on("controlToken", this.#controlTokenHook);

    // The rows are built from canvas.tokens.placeables at render time, so the list goes
    // stale the moment the scene changes under it. These three put it back in step.
    this.#watchSceneTokens("createToken", document => this.#isCurrentScene(document));
    this.#watchSceneTokens("deleteToken", document => this.#isCurrentScene(document));
    this.#watchSceneTokens("updateToken", (document, changed) => this.#isCurrentScene(document)
      && DISPLAYED_TOKEN_FIELDS.some(field => field in changed));
  }

  /**
   * Registers one scene-token hook that rebuilds the list whenever `test` passes, and
   * keeps it for removal on close.
   * @param {string} event A document hook name.
   * @param {function(...*): boolean} test Receives the hook's own arguments.
   * @returns {void}
   */
  #watchSceneTokens(event, test) {
    const callback = (...args) => { if (test(...args)) this.#refreshTokenList(); };
    Hooks.on(event, callback);
    this.#sceneHooks.push({ event, callback });
  }

  /**
   * Whether a TokenDocument belongs to the scene the picker is listing. The document hooks
   * fire for every scene in the world, including ones nobody is looking at.
   * @param {TokenDocument} document
   * @returns {boolean}
   */
  #isCurrentScene(document) {
    return document.parent?.id === canvas.scene?.id;
  }

  /**
   * Rebuilds the row list from the scene as it now stands.
   *
   * Debounced because the hooks behind it fire once per document: deleting a group of
   * tokens, or dropping several at once, would otherwise re-render the window once per
   * token in the batch. The pool is captured here rather than in `_onRender` because by
   * then the old rows are already gone.
   * @returns {void}
   */
  #refreshTokenList = foundry.utils.debounce(() => {
    if (!this.rendered) return;

    const inputs = [...this.element.querySelectorAll("input[name='tokenId']")];
    this.#pendingSelection = {
      ticked: new Set(inputs.filter(input => input.checked).map(input => input.value)),
      known: new Set(inputs.map(input => input.value))
    };

    this.render().catch(err => {
      // Leaving this set would make the next ordinary render take the refresh path.
      this.#pendingSelection = null;
      console.error(`${MODULE_ID} | Failed to refresh the token picker's list.`, err);
    });
  }, 100);

  /**
   * Restores the filter state remembered from the last time the picker was open, then
   * derives the selection from it. If that state matches nothing in this scene — e.g. it
   * was narrowed down for a different scene's tokens — it is useless as a starting point,
   * so the filters fall back to their defaults instead of opening onto an empty pool.
   * Called from the ApplicationV2 render lifecycle.
   * @param {object} context
   * @param {object} options
   * @returns {void}
   */
  _onRender(context, options) {
    super._onRender(context, options);
    this.#restoreFilterState();

    // A rebuild after a scene change, not a fresh open: the pool is restored rather than
    // re-derived, and the empty-pool fallback below is not this render's business — the
    // filters are whatever the GM has since chosen, and an empty scene is a fact about the
    // scene, not a sign of a stale setting worth resetting.
    if (this.#pendingSelection) {
      this.#reapplySelection();
      this.#pendingSelection = null;
      return;
    }

    this.#applyFilters();

    if (this.#selectedInputs().length === 0) {
      ui.notifications.warn("☯ " + "The saved filters matched no tokens in this scene — filters were reset.");
      this._onResetFilters();
    }
  }

  /**
   * Puts the pool back over a freshly rebuilt list.
   *
   * A row that was already on screen keeps exactly what the GM had done to it, so the
   * hand-unticked exceptions that `#applyFilters` would have swept away survive a token
   * being added or deleted elsewhere in the scene. A row that is new to the list has no
   * such history, so it follows the filters — the same rule every row was opened under.
   * @returns {void}
   */
  #reapplySelection() {
    const { ticked, known } = this.#pendingSelection;
    const matches = this.#buildFilterPredicate();

    for (const row of this.element.querySelectorAll(".wod-token-row")) {
      const input = row.querySelector("input[name='tokenId']");
      const show = matches(row.dataset);
      row.classList.toggle("wod-row--filtered", !show);
      input.checked = show && (known.has(input.value) ? ticked.has(input.value) : true);
    }

    this.#pruneChances();
    this.#updateSummary();
  }

  /**
   * Drops the chances held for tokens that are no longer in the scene. Ids are never
   * reused, so a stale entry can only ever be dead weight.
   * @returns {void}
   */
  #pruneChances() {
    const present = new Set([...this.element.querySelectorAll("input[name='tokenId']")]
      .map(input => input.value));
    for (const tokenId of this.#chances.keys()) {
      if (!present.has(tokenId)) this.#chances.delete(tokenId);
    }
  }

  /**
   * Remembers where the window ends up, so the next `open()` can restore it. Every drag,
   * resize and programmatic move already passes through core's `setPosition` — overriding
   * it is the one place that catches all three without guessing at a more specific,
   * possibly-internal hook for "the user let go of the title bar".
   * @param {object} [position]
   * @returns {object}
   */
  setPosition(position) {
    const applied = super.setPosition(position);
    clearTimeout(this.#savePositionTimeout);
    this.#savePositionTimeout = setTimeout(() => this.#savePosition(), 400);
    return applied;
  }

  /**
   * Writes the current position/size to the client setting.
   * @returns {void}
   */
  #savePosition() {
    const { top, left, width, height } = this.position;
    game.settings.set(MODULE_ID, "tokenPickerPosition", { top, left, width, height });
  }

  /**
   * Resolves the pending `open()` promise, once.
   * @param {{tokens: Token[], weights: Map<string, number>}|null} result
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
    // Flushes rather than drops a pending debounce, so closing right after a drag still
    // remembers where the window was left instead of whatever it opened at.
    clearTimeout(this.#savePositionTimeout);
    this.#savePosition();
    if (this.#controlTokenHook) {
      Hooks.off("controlToken", this.#controlTokenHook);
      this.#controlTokenHook = null;
    }
    for (const { event, callback } of this.#sceneHooks) Hooks.off(event, callback);
    this.#sceneHooks = [];
    // The hook is already off, so this cannot loop back through #onControlToken.
    this.#restoreCanvasSelection();
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
   * Builds a "does this row's dataset pass the active filters" test from whatever the
   * filter buttons are currently pressed to. Shared by `#applyFilters` (which also drives
   * the selection) and `#refreshRowVisibility` (which only drives what's shown).
   * @returns {function(DOMStringMap): boolean}
   */
  #buildFilterPredicate() {
    const pressedValues = filter => new Set([...this.element.querySelectorAll(
      `[data-filter="${filter}"][aria-pressed="true"]`
    )].map(button => button.dataset.value));

    const types = pressedValues("actorType");
    const dispositions = pressedValues("disposition");
    // Segments allow exactly one choice, so these collapse to a single value.
    const [linked = "any"] = pressedValues("linked");
    const [visibility = "any"] = pressedValues("visibility");

    return data => types.has(data.actorType)
      && dispositions.has(data.disposition)
      && (linked === "any" || data.linked === linked)
      && (visibility === "any" || data.hidden === String(visibility === "hidden"));
  }

  /**
   * Shows the rows matching every active filter and makes them the selection, then
   * remembers this filter state for the next time the picker opens.
   * @returns {void}
   */
  #applyFilters() {
    const matches = this.#buildFilterPredicate();

    for (const row of this.element.querySelectorAll(".wod-token-row")) {
      const show = matches(row.dataset);
      row.classList.toggle("wod-row--filtered", !show);
      // The filters drive the pool: what survives them is in, what does not is out.
      row.querySelector("input[name='tokenId']").checked = show;
    }

    this.#updateSummary();
    this.#saveFilterState();
  }

  /**
   * Re-hides or reveals rows against the active filters without touching any checkbox.
   * Used when a filter is widened just enough to admit one manually-controlled token —
   * other rows the wider filter now matches should become visible again, but must not be
   * swept into the selection the way a normal filter change would sweep them in.
   * @returns {void}
   */
  #refreshRowVisibility() {
    const matches = this.#buildFilterPredicate();
    for (const row of this.element.querySelectorAll(".wod-token-row")) {
      row.classList.toggle("wod-row--filtered", !matches(row.dataset));
    }
  }

  /**
   * Refreshes the pool count, the Draw button's enabled state and the odds in the chance
   * column, then makes the canvas selection match — every path that can change the pool
   * (filter changes, All/None, a manual tick, a canvas click) already funnels through
   * here, so this is the one place that needs to keep the map, and everyone's odds, in
   * sync with it.
   * @returns {void}
   */
  #updateSummary() {
    const selected = this.#selectedInputs();
    this.element.querySelector("[data-summary]").textContent = `${selected.length} selected`;
    this.element.querySelector("[data-action='draw']").disabled = selected.length < 1;
    this.#updateChances(selected);
    this.#syncCanvasSelection();
  }

  /**
   * How many chances one token gets in the draw.
   * @param {string} tokenId
   * @returns {number}
   */
  #chancesOf(tokenId) {
    return this.#chances.get(tokenId) ?? MIN_CHANCES;
  }

  /**
   * Adds or removes one chance from a row, within the bounds, and re-derives the whole
   * column — one row's count moves what every other row in the pool is worth.
   *
   * Membership is deliberately left alone: stepping an unticked row up sets what that
   * token would be worth once it joins the draw, and nothing more. Ticking rows in and out
   * is already what the checkbox, the filters and the canvas are for, and quietly doing it
   * from here would make a misclicked `+` a change to the pool rather than to one number.
   * @param {string} tokenId
   * @param {number} delta
   * @returns {void}
   */
  #stepChances(tokenId, delta) {
    const next = Math.min(MAX_CHANCES, Math.max(MIN_CHANCES, this.#chancesOf(tokenId) + delta));
    // Storing the default would cost `#chances` its meaning as "the rows that were changed".
    if (next === MIN_CHANCES) this.#chances.delete(tokenId);
    else this.#chances.set(tokenId, next);
    this.#updateChances();
  }

  /**
   * Rewrites the chance column. A row in the draw shows the odds its chances buy it there;
   * a row outside the draw shows the bare count instead, because the 0% that is technically
   * true of it would read as "this one can never come up" rather than "this one is not in
   * the pool" — and would also hide the count the GM had set for it.
   * @param {HTMLInputElement[]} [selected] The pool, when the caller has already resolved it.
   * @returns {void}
   */
  #updateChances(selected = this.#selectedInputs()) {
    const pool = new Set(selected.map(input => input.value));
    const total = selected.reduce((sum, input) => sum + this.#chancesOf(input.value), 0);

    for (const row of this.element.querySelectorAll(".wod-token-row")) {
      const tokenId = row.querySelector("input[name='tokenId']").value;
      const chances = this.#chancesOf(tokenId);
      const inPool = pool.has(tokenId);
      const value = row.querySelector("[data-chance-value]");

      // `total` is only ever 0 when the pool is empty, and then nothing is `inPool`.
      const percent = inPool ? (chances / total) * 100 : 0;
      value.textContent = inPool
        // A long shot in a big pool still has a real chance; "0%" would deny it.
        ? (percent < 0.5 ? "<1%" : `${Math.round(percent)}%`)
        : `×${chances}`;
      value.dataset.tooltip = inPool
        ? `${chances} of ${total} chances in the draw`
        : `${chances} ${chances === 1 ? "chance" : "chances"} — not in the draw`;

      row.querySelector("[data-action='increaseChance']").disabled = chances >= MAX_CHANCES;
      row.querySelector("[data-action='decreaseChance']").disabled = chances <= MIN_CHANCES;
    }
  }

  /**
   * Controls every token whose row is ticked and releases every token whose row is not,
   * so the pool the picker describes is also what lights up on the map — the GM can then
   * shift off a token there just as naturally as unticking its row here.
   * @returns {void}
   */
  #syncCanvasSelection() {
    const selectedIds = new Set(this.#selectedInputs().map(input => input.value));

    this.#syncingCanvas = true;
    try {
      for (const token of canvas.tokens.placeables) {
        const shouldControl = selectedIds.has(token.id);
        if (token.controlled === shouldControl) continue;
        if (shouldControl) token.control({ releaseOthers: false });
        else token.release();
      }
    } finally {
      this.#syncingCanvas = false;
    }
  }

  /**
   * Hands canvas selection back to whatever it was before the picker opened.
   * @returns {void}
   */
  #restoreCanvasSelection() {
    for (const token of canvas.tokens.placeables) {
      const shouldControl = this.#initialControlledIds.has(token.id);
      if (token.controlled === shouldControl) continue;
      if (shouldControl) token.control({ releaseOthers: false });
      else token.release();
    }
  }

  /**
   * Reads the client's remembered filter state. Multi-choice filters store the buttons
   * that are *off* rather than the ones that are on, so an actor type or disposition this
   * scene has never seen before defaults to on, same as a first-ever open of the picker.
   * @returns {{actorTypeOff: string[], dispositionOff: string[], linked: string, visibility: string}}
   */
  #readFilterState() {
    const stored = game.settings.get(MODULE_ID, "tokenPickerFilters");
    return {
      actorTypeOff: stored?.actorTypeOff ?? [],
      dispositionOff: stored?.dispositionOff ?? [],
      linked: stored?.linked ?? "any",
      visibility: stored?.visibility ?? "any"
    };
  }

  /**
   * Applies the remembered filter state to the filter buttons. Called before the first
   * `#applyFilters` of a render, so the picker opens already narrowed the way it was left.
   * @returns {void}
   */
  #restoreFilterState() {
    const state = this.#readFilterState();

    for (const chip of this.element.querySelectorAll('[data-filter="actorType"]')) {
      chip.setAttribute("aria-pressed", String(!state.actorTypeOff.includes(chip.dataset.value)));
    }
    for (const chip of this.element.querySelectorAll('[data-filter="disposition"]')) {
      chip.setAttribute("aria-pressed", String(!state.dispositionOff.includes(chip.dataset.value)));
    }
    for (const button of this.element.querySelectorAll('.wod-segment [data-filter="linked"]')) {
      button.setAttribute("aria-pressed", String(button.dataset.value === state.linked));
    }
    for (const button of this.element.querySelectorAll('.wod-segment [data-filter="visibility"]')) {
      button.setAttribute("aria-pressed", String(button.dataset.value === state.visibility));
    }
  }

  /**
   * Writes the filter buttons' current state to the client setting.
   * @returns {void}
   */
  #saveFilterState() {
    const off = filter => [...this.element.querySelectorAll(
      `[data-filter="${filter}"][aria-pressed="false"]`
    )].map(chip => chip.dataset.value);

    const pressedValue = filter => this.element.querySelector(
      `[data-filter="${filter}"][aria-pressed="true"]`
    )?.dataset.value ?? "any";

    game.settings.set(MODULE_ID, "tokenPickerFilters", {
      actorTypeOff: off("actorType"),
      dispositionOff: off("disposition"),
      linked: pressedValue("linked"),
      visibility: pressedValue("visibility")
    });
  }

  /**
   * Mirrors native canvas token control into the picker: controlling a token joins the
   * pool, releasing control drops it. Registered as a `controlToken` hook while open.
   * @param {Token} token
   * @param {boolean} controlled
   * @returns {void}
   */
  #onControlToken(token, controlled) {
    // Our own #syncCanvasSelection provoked this, not a click — ignore it, or every sync
    // would loop straight back into another one.
    if (this.#syncingCanvas) return;

    const input = this.element.querySelector(`input[name="tokenId"][value="${token.id}"]`);
    if (!input) return;

    if (controlled) {
      const row = input.closest(".wod-token-row");
      if (row.classList.contains("wod-row--filtered")) this.#widenFiltersFor(row);
      input.checked = true;
    } else {
      input.checked = false;
    }

    this.#updateSummary();
  }

  /**
   * Opens exactly the filters hiding one row, so a manually-controlled token can join the
   * pool without pulling every other row that a filter change would otherwise admit —
   * those become visible again (the chip really is "on" now) but stay unticked.
   * @param {HTMLElement} row
   * @returns {void}
   */
  #widenFiltersFor(row) {
    const data = row.dataset;

    this.element.querySelector(
      `[data-filter="actorType"][data-value="${data.actorType}"]`
    )?.setAttribute("aria-pressed", "true");

    this.element.querySelector(
      `[data-filter="disposition"][data-value="${data.disposition}"]`
    )?.setAttribute("aria-pressed", "true");

    this.#releaseSegmentIfBlocking("linked", data.linked);
    this.#releaseSegmentIfBlocking("visibility", data.hidden === "true" ? "hidden" : "visible");

    this.#refreshRowVisibility();
    this.#saveFilterState();
  }

  /**
   * Moves a single-choice segment back to "any" if, and only if, its current choice would
   * hide a row whose own value is `value`.
   * @param {string} filter
   * @param {string} value
   * @returns {void}
   */
  #releaseSegmentIfBlocking(filter, value) {
    const pressed = this.element.querySelector(`[data-filter="${filter}"][aria-pressed="true"]`);
    if (!pressed || pressed.dataset.value === "any" || pressed.dataset.value === value) return;
    for (const button of pressed.closest(".wod-segment").querySelectorAll("button")) {
      button.setAttribute("aria-pressed", String(button.dataset.value === "any"));
    }
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
   * Returns every filter to "match anything", which re-selects the whole scene, and puts
   * every row back to a single chance. Reset is the one control that means "as the window
   * opens", and it opens with the whole scene in the draw and nobody favored.
   * Registered as the `resetFilters` action.
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @returns {void}
   */
  _onResetFilters(event, target) {
    this.#chances.clear();
    for (const chip of this.element.querySelectorAll(".wod-chip")) {
      chip.setAttribute("aria-pressed", "true");
    }
    for (const button of this.element.querySelectorAll(".wod-segment button")) {
      button.setAttribute("aria-pressed", String(button.dataset.value === "any"));
    }
    this.#applyFilters();
  }

  /**
   * Commits the pool, and how many chances each of its tokens holds, then closes.
   * Registered as the `draw` action.
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

    // Written out for every token rather than only the stepped-up ones, so no caller has
    // to know that a missing entry means one chance — see `WoD#selectRandomToken`.
    const weights = new Map(tokens.map(token => [token.id, this.#chancesOf(token.id)]));

    this.#settle({ tokens, weights });
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

  /**
   * Pings and pulls every connected view to one row's token, so the GM can find it on the
   * map without hunting. Registered as the `locateToken` action; lives on a button nested
   * inside the row's `<label>`, so it does not also toggle that row's checkbox.
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @returns {void}
   */
  _onLocateToken(event, target) {
    const token = canvas.tokens.get(target.dataset.tokenId);
    if (!token) return;
    pingToken(token);
  }

  /**
   * Gives one row an extra chance in the draw. Registered as the `increaseChance` action;
   * like the locate button it sits inside the row's `<label>`, so clicking it steps the
   * count without also toggling that row's checkbox.
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @returns {void}
   */
  _onIncreaseChance(event, target) {
    this.#stepChances(target.dataset.tokenId, 1);
  }

  /**
   * Takes one chance back off a row. Registered as the `decreaseChance` action.
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @returns {void}
   */
  _onDecreaseChance(event, target) {
    this.#stepChances(target.dataset.tokenId, -1);
  }
}
