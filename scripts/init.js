/*!
 * Wheel Of Destiny
 * Copyright (c) 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */
import { MODULE_ID } from "./constants.js";
import WheelOfDestiny from "./wod.js";
import { registerSettings } from "./settings.js";

/**
 * The live module API, published on `globalThis` as `WoD` so macros can call
 * `WoD.randomToken()` directly. Built during `init` rather than at module scope
 * because the constructor registers a `game.socket` listener.
 * @type {WheelOfDestiny}
 */
let api;

Hooks.once('init', () => {
  // --------------------------------------------------
  // Load API
  api = new WheelOfDestiny();
  globalThis.WoD = api; // Public macro API: WoD.randomToken(), WoD.openTokenPicker(), ...

  // --------------------------------------------------
  // Functions
  //const debouncedReload = debounce(() => location.reload(), 1000); // RELOAD AFTER CHANGE

  // --------------------------------------------------
  // KEYBINDINGS
  game.keybindings.register(MODULE_ID, `${MODULE_ID}_keybinding`, {
    name: '☯ Wheel of Destiny',
    hint: 'This will trigger the Wheel of Destiny.',
    editable: [],
    onDown: () => {
      api.randomToken();
    },
    onUp: () => {},
    restricted: true,  // Restrict this Keybinding to gamemaster only?
    reservedModifiers: [],
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });

  game.keybindings.register(MODULE_ID, `${MODULE_ID}_keybinding_custom`, {
    name: '☯ Custom Wheel of Destiny',
    hint: 'This always opens the token picker, so you can build the draw pool by hand even when tokens are already selected.',
    editable: [],
    onDown: () => {
      api.openTokenPicker();
    },
    onUp: () => {},
    restricted: true,  // Restrict this Keybinding to gamemaster only?
    reservedModifiers: [],
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });

  // --------------------------------------------------
  // SETTINGS
  registerSettings();

}); // END HOOKS

Hooks.on("getSceneControlButtons", function(controls) {
  // Shown to every role: randomToken() gates the non-GM path down to the user's own
  // targets. The keybindings stay restricted, so the button is the only player entry point.
  controls.tokens.tools[`${MODULE_ID}_token_button`] = {
    icon: "fas fa-yin-yang",
    name: `${MODULE_ID}_token_button`,
    title: "☯ Wheel of Destiny",
    button: true,
    onChange: (event, active) => { if (active) api.randomToken() }
  }
});
