/*!
 * Wheel Of Destiny
 * Copyright (c) 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */
import { MODULE_ID } from "./constants.js";
import WoD from "./wod.mjs";
import { registerSettings } from "./settings.js";

Hooks.once('init', () => {
  // --------------------------------------------------
  // Load API
  let wod = new WoD();
  window.game.wod = wod; // Request: //window.game.wod.randomToken();

  // --------------------------------------------------
  // Functions
  //const debouncedReload = debounce(() => location.reload(), 1000); // RELOAD AFTER CHANGE

  // --------------------------------------------------
  // KEYBINDINGS
  game.keybindings.register(MODULE_ID, `${MODULE_ID}_keybinding`, {
    name: '☯ Wheel of Destiny',
    hint: 'This will trigger the Wheel of Destiny.',
    editable: [{ key: "KeyF", modifiers: []}],
    onDown: () => {
      window.game.wod.randomToken();
    },
    onUp: () => {},
    restricted: true,  // Restrict this Keybinding to gamemaster only?
    reservedModifiers: [],
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });

  game.keybindings.register(MODULE_ID, `${MODULE_ID}_keybinding_custom`, {
    name: '☯ Custom Wheel of Destiny',
    hint: 'This will trigger a dialog with options for the Wheel of Destiny.',
    editable: [{ key: "KeyF", modifiers: ["Shift"]}],
    onDown: () => {
      window.game.wod.customAutoSelectDialog();
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
  if (game.user.isGM) {
    controls.tokens.tools[`${MODULE_ID}_token_button`] = {
      icon: "fas fa-yin-yang",
      name: `${MODULE_ID}_token_button`,
      title: "☯ Wheel of Destiny",
      button: true,
      onChange: (event, active) => { if (active) window.game.wod.randomToken() }
    }
  }
});
