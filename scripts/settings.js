/*!
 * Wheel Of Destiny
 * Copyright (c) 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */
import { MODULE_ID } from "./constants.js";
import WoD from "./wod.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/* --------------------------------------------------------------------------
 * Grouped settings windows
 * -------------------------------------------------------------------------- */

/**
 * Shared base for the module's grouped settings windows.
 *
 * A subclass only declares the settings it owns (`SETTING_KEYS`), its window title
 * and its template. Reading the current values, localizing labels and writing the
 * values back on submit all happen here, so the `game.settings.register` call stays
 * the single source of truth for every label, hint and choice list — templates never
 * restate them.
 *
 * `BASE_APPLICATION` is deliberately left alone: ApplicationV2 must remain the floor
 * of the DEFAULT_OPTIONS merge chain so its window defaults survive.
 */
class WodSettingsForm extends HandlebarsApplicationMixin(ApplicationV2) {

  /**
   * Keys of the settings this window manages, in template order.
   * @type {string[]}
   */
  static SETTING_KEYS = [];

  static DEFAULT_OPTIONS = {
    classes: [MODULE_ID, "wod-settings-form"],
    // `tag: "form"` is what makes ApplicationV2 bind the submit handler to the root
    // element — without it the handler below never fires.
    tag: "form",
    form: {
      handler: this.prototype._saveSettings,
      closeOnSubmit: true
    },
    position: { width: 520, height: "auto" },
    // No `standard-form` content class: it seats each label in a narrow column beside
    // its control, which wrapped the longer setting names mid-phrase. The templates
    // lay the fields out themselves — see styles/base.css.
    window: { contentClasses: ["wod-settings-content"] }
  };

  /**
   * Localizes a setting's choice list. Values may be plain strings or i18n keys —
   * `localize` returns non-keys unchanged, so both work.
   * @param {Object<string, string>} [choices]
   * @returns {Object<string, string>|null}
   */
  static #localizeChoices(choices) {
    if (!choices) return null;
    return Object.entries(choices).reduce((acc, [key, label]) => {
      acc[key] = game.i18n.localize(label);
      return acc;
    }, {});
  }

  /**
   * Builds the `settings` context entry every settings template renders from.
   * Called from the ApplicationV2 render lifecycle.
   * @param {object} options
   * @returns {Promise<{settings: Object<string, object>}>}
   */
  async _prepareContext(options) {
    const settings = {};
    for (const key of this.constructor.SETTING_KEYS) {
      const config = game.settings.settings.get(`${MODULE_ID}.${key}`);
      settings[key] = {
        value: game.settings.get(MODULE_ID, key),
        name: game.i18n.localize(config.name ?? ""),
        hint: game.i18n.localize(config.hint ?? ""),
        choices: WodSettingsForm.#localizeChoices(config.choices),
        range: config.range ?? null
      };
    }
    return { settings };
  }

  /**
   * Writes every setting owned by this window back to the world.
   * Wired as `DEFAULT_OPTIONS.form.handler`; ApplicationV2 invokes it with `this`
   * set to the rendered instance, which is how the correct `SETTING_KEYS` are found.
   * @param {SubmitEvent} event
   * @param {HTMLFormElement} form
   * @param {foundry.applications.ux.FormDataExtended} formData
   * @returns {Promise<void>}
   */
  async _saveSettings(event, form, formData) {
    const data = formData.object;
    for (const key of this.constructor.SETTING_KEYS) {
      if (!(key in data)) continue;
      const { type } = game.settings.settings.get(`${MODULE_ID}.${key}`);
      let value = data[key];
      // FormDataExtended already types checkbox and range fields; coerce defensively
      // so a stray string can never reach a Boolean or Number setting.
      if (type === Boolean) value = (value === true) || (value === "true");
      else if (type === Number) value = Number(value);
      await game.settings.set(MODULE_ID, key, value);
    }
  }
}

/**
 * Audio & Sound settings window.
 */
class AudioSettingsForm extends WodSettingsForm {

  static SETTING_KEYS = ["playSound", "soundPath", "soundChannel"];

  static DEFAULT_OPTIONS = {
    id: "wod-settings-audio",
    window: { title: "Audio & Sound — Wheel of Destiny", icon: "fas fa-music" },
    actions: {
      previewSound: this.prototype._onPreviewSound
    }
  };

  static PARTS = {
    form: { template: `modules/${MODULE_ID}/templates/settings-audio.hbs` }
  };

  /**
   * Plays one random sound from the folder currently typed into the form, on the
   * channel currently selected, without saving anything — the point is to let the GM
   * try a folder out before committing to it.
   * Registered as the `previewSound` action.
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @returns {Promise<void>}
   */
  async _onPreviewSound(event, target) {
    const folderPath = this.element.querySelector("[name='soundPath']")?.value?.trim();
    const channel = this.element.querySelector("[name='soundChannel']")?.value;

    if (!folderPath) {
      ui.notifications.warn("☯ " + "Set a sound folder path first.");
      return;
    }

    // Local only: the GM is testing a folder, not cueing the table.
    await WoD.playRandomSound({ folderPath, channel, broadcast: false });
  }
}

/**
 * Animation & Visual settings window.
 */
class AnimationSettingsForm extends WodSettingsForm {

  static SETTING_KEYS = ["animationMode", "rouletteDelay", "rouletteTotalDuration", "panToToken", "displaySelected", "imageSource"];

  static DEFAULT_OPTIONS = {
    id: "wod-settings-animation",
    window: { title: "Animation & Visual — Wheel of Destiny", icon: "fas fa-wand-magic-sparkles" }
  };

  static PARTS = {
    form: { template: `modules/${MODULE_ID}/templates/settings-animation.hbs` }
  };

  /**
   * The only window split into tabs: six settings in one column ran it past a
   * comfortable height, and they already fall into two self-contained groups. The
   * other two windows hold three settings each and stay single-column.
   *
   * Labels are plain text rather than a `labelPrefix`: the module ships no
   * localization files, so a key prefix would surface the raw key in the nav.
   * `localize` passes non-keys through unchanged, which is what the template relies on.
   */
  static TABS = {
    primary: {
      tabs: [
        { id: "roulette", icon: "fas fa-arrows-spin", label: "Roulette" },
        { id: "token", icon: "fas fa-crosshairs", label: "Selected Token" }
      ],
      initial: "roulette"
    }
  };

  /**
   * Adds the tab state to the shared settings context.
   * Called from the ApplicationV2 render lifecycle.
   * @param {object} options
   * @returns {Promise<object>}
   */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.tabs = this._prepareTabs("primary");
    return context;
  }
}

/**
 * Dialogs & Chat settings window.
 */
class DialogSettingsForm extends WodSettingsForm {

  static SETTING_KEYS = ["hasDialog", "topMessage", "chatMessagePrivacy"];

  static DEFAULT_OPTIONS = {
    id: "wod-settings-dialogs",
    window: { title: "Dialogs & Chat — Wheel of Destiny", icon: "fas fa-comments" }
  };

  static PARTS = {
    form: { template: `modules/${MODULE_ID}/templates/settings-dialogs.hbs` }
  };
}

/* --------------------------------------------------------------------------
 * Registration
 * -------------------------------------------------------------------------- */

/**
 * Registers the module's settings menus and every setting.
 *
 * Only the two settings a GM reaches for mid-session stay `config: true`; the rest are
 * `config: false` and reachable through the three menu buttons above them.
 * Called from the `init` hook.
 * @returns {void}
 */
export function registerSettings() {

  // --------------------------------------------------
  // MENUS

  game.settings.registerMenu(MODULE_ID, "audioMenu", {
    name: "Audio & Sound",
    label: "Open Audio Settings",
    hint: "Sound playback, folder and audio channel.",
    icon: "fas fa-music",
    type: AudioSettingsForm,
    restricted: true
  });

  game.settings.registerMenu(MODULE_ID, "animationMenu", {
    name: "Animation & Visual",
    label: "Open Animation Settings",
    hint: "Roulette animation, ping and pan, and which art to show.",
    icon: "fas fa-wand-magic-sparkles",
    type: AnimationSettingsForm,
    restricted: true
  });

  game.settings.registerMenu(MODULE_ID, "dialogMenu", {
    name: "Dialogs & Chat",
    label: "Open Dialog Settings",
    hint: "The dialog shown after a draw and the chat message it posts.",
    icon: "fas fa-comments",
    type: DialogSettingsForm,
    restricted: true
  });

  // --------------------------------------------------
  // FREE SETTINGS — kept in the main tab for quick access

  // call this with: game.settings.get(MODULE_ID, "targetToken")
  game.settings.register(MODULE_ID, "targetToken", {
    name: 'Target the Selected Token',
    hint: 'This will target the selected token.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });

  // --------------------------------------------------
  // AUDIO & SOUND — managed by AudioSettingsForm

  // call this with: game.settings.get(MODULE_ID, "playSound")
  game.settings.register(MODULE_ID, "playSound", {
    name: 'Play Sound',
    hint: 'Check this if you want a sound to be played.',
    scope: 'world',
    config: false,
    type: Boolean,
    default: false
  });

  // call this with: game.settings.get(MODULE_ID, "soundPath")
  game.settings.register(MODULE_ID, 'soundPath', {
    name: 'Sound Folder Path',
    hint: 'You can set a sound folder. The module will pick one playable sound from it. DO NOT ADD OTHER FILES. Just add the sounds you want to be played.',
    scope: 'world',
    config: false,
    default: `modules/${MODULE_ID}/assets/sounds`,
    type: String,
    filePicker: 'folder'
  });

  // call this with: game.settings.get(MODULE_ID, "soundChannel")
  game.settings.register(MODULE_ID, 'soundChannel', {
    name: 'Audio Channel',
    hint: 'Channel used to play the sound. Each user sets their own channel volume in the Foundry mixer.',
    scope: 'world',
    config: false,
    type: String,
    // Spread so the module never hands core's own frozen constant to the settings store.
    choices: { ...CONST.AUDIO_CHANNELS },
    default: 'interface'
  });

  // call this with: game.settings.get(MODULE_ID, "soundVolume")
  // Retired in favour of per-channel volume in Foundry's mixer, but still registered so
  // existing worlds keep their stored value instead of erroring on a missing setting.
  // Nothing reads it — do not surface it in a menu.
  game.settings.register(MODULE_ID, 'soundVolume', {
    scope: 'client',
    config: false,
    default: 0.6,
    type: Number
  });

  // --------------------------------------------------
  // ANIMATION & VISUAL — managed by AnimationSettingsForm

  // call this with: game.settings.get(MODULE_ID, "animationMode")
  game.settings.register(MODULE_ID, "animationMode", {
    name: 'Animation Mode',
    hint: 'Choose an animation for the roulette.',
    scope: 'world',
    config: false,
    type: String,
    choices: {
      'none':    'Disabled',
      'native':  'Native Glow'
    },
    default: 'none'
  });

  // call this with: game.settings.get(MODULE_ID, "rouletteDelay")
  game.settings.register(MODULE_ID, 'rouletteDelay', {
    name: 'Delay Per Step',
    hint: "Delay per token step in the roulette animation. If the total duration would exceed the max total duration, this value is recalculated automatically.",
    scope: 'world',
    config: false,
    default: 200,
    range: {
      min: 0,
      max: 2000,
      step: 50
    },
    type: Number
  });

  // call this with: game.settings.get(MODULE_ID, "rouletteTotalDuration")
  game.settings.register(MODULE_ID, 'rouletteTotalDuration', {
    name: 'Max Total Duration',
    hint: "Maximum total time (ms) for the roulette animation. If the number of tokens would cause the animation to exceed this limit, the per-step delay is reduced automatically.",
    scope: 'world',
    config: false,
    default: 2000,
    range: {
      min: 500,
      max: 10000,
      step: 500
    },
    type: Number
  });

  // call this with: game.settings.get(MODULE_ID, "panToToken")
  game.settings.register(MODULE_ID, "panToToken", {
    name: 'Ping and Pan the Selected Token',
    hint: 'This will ping and pan the selected token.',
    scope: 'world',
    config: false,
    type: Boolean,
    default: true
  });

  // call this with: game.settings.get(MODULE_ID, "displaySelected")
  game.settings.register(MODULE_ID, "displaySelected", {
    name: 'Display Selected',
    hint: 'Check this to show the selected tokens.',
    scope: 'world',
    config: false,
    type: Boolean,
    default: false
  });

  // call this with: game.settings.get(MODULE_ID, "imageSource")
  game.settings.register(MODULE_ID, 'imageSource', {
    name: 'Image Source',
    hint: 'Choose if you want to show the token art or the actor sheet art.',
    scope: "world",
    type: String,
    choices: {
      'tokenart': 'Token Art',
      'sheetart': 'Actor Sheet Art'
    },
    default: "tokenart",
    config: false
  });

  // --------------------------------------------------
  // DIALOGS & CHAT — managed by DialogSettingsForm

  // call this with: game.settings.get(MODULE_ID, "hasDialog")
  game.settings.register(MODULE_ID, "hasDialog", {
    name: 'Show Dialog?',
    hint: 'Check this to show a dialog message with the selected.',
    scope: 'world',
    config: false,
    type: Boolean,
    default: false
  });

  // call this with: game.settings.get(MODULE_ID, "topMessage")
  game.settings.register(MODULE_ID, 'topMessage', {
    name: 'Dialog Top Message',
    hint: 'The text you enter in here will show on the top of the dialog message.',
    scope: 'world',
    config: false,
    default: 'You have been chosen!',
    type: String
  });

  // call this with: game.settings.get(MODULE_ID, "chatMessagePrivacy")
  game.settings.register(MODULE_ID, 'chatMessagePrivacy', {
    name: 'Chat Message Privacy',
    hint: 'Choose who can see the chat message.',
    scope: "world",
    type: String,
    choices: {
      'none': 'Disable Chat Message',
      'gmonly': 'Whisper to GM',
      'everyone': 'Show to Everyone'
    },
    default: "gmonly",
    config: false
  });
}
