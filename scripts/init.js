/*!
 * Wheel Of Destiny
 * Copyright (c) 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */
import { MODULE_ID } from "./constants.js";
import WoD from "./wod.mjs";

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
    config: true
  });

  // call this with: game.settings.get(MODULE_ID, "displaySelected")
  game.settings.register(MODULE_ID, "displaySelected", {
    name: 'Display Selected',
    hint: 'Check this to show the selected tokens.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });

  // call this with: game.settings.get(MODULE_ID, "targetToken")
  game.settings.register(MODULE_ID, "targetToken", {
    name: 'Target the Selected Token',
    hint: 'This will target the selected token.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });

  // call this with: game.settings.get(MODULE_ID, "panToToken")
  game.settings.register(MODULE_ID, "panToToken", {
    name: 'Ping and Pan the Selected Token',
    hint: 'This will ping and pan the selected token.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
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
    config: true
  });

  // call this with: game.settings.get(MODULE_ID, "autoSelectBehavior")
  game.settings.register(MODULE_ID, 'autoSelectBehavior', {
    name: 'Auto Select Behavior',
    hint: "This define the behavior of the auto selection, which trigger if you don't select any tokens.",
    scope: "world",
    type: String,
    choices: {
      'all': 'Select All Tokens in the Scene',
      'pcs': 'Select Only PCs',
      'friendly': 'Only Friendly Tokens',
      'hostile': 'Only Hostile Tokens'
    },
    default: "all",
    config: true
  });

  // call this with: game.settings.get(MODULE_ID, "hasDialog")
  game.settings.register(MODULE_ID, "hasDialog", {
    name: 'Show Dialog?',
    hint: 'Check this to show a dialog message with the selected.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });

  // call this with: game.settings.get(MODULE_ID, "topMessage")
  game.settings.register(MODULE_ID, 'topMessage', {
    name: 'Dialog Top Message',
    hint: 'The text you enter in here will show on the top of the dialog message.',
    scope: 'world',
    config: true,
    default: 'You have been chosen!',
    type: String
  });

  // call this with: game.settings.get(MODULE_ID, "playSound")
  game.settings.register(MODULE_ID, "playSound", {
    name: 'Play Sound',
    hint: 'Check this if you want a sound to be played.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });

  // call this with: game.settings.get(MODULE_ID, "soundPath")
  game.settings.register(MODULE_ID, 'soundPath', {
    name: 'Sound Folder Path',
    hint: 'You can set a sound folder. The module will pick one playable sound from it. DO NOT ADD OTHER FILES. Just add the sounds you want to be played.',
    scope: 'world',
    config: true,
    default: `modules/${MODULE_ID}/assets/sounds`,
    type: String,
    filePicker: 'folder'
  });

  // call this with: game.settings.get(MODULE_ID, "soundVolume")
  game.settings.register(MODULE_ID, 'soundVolume', {
    name: 'Sound Volume',
    hint: "You can set the volume for the warning sound. Use 0.1 for 10% of the volume. 0.6 for 60% of the volume.",
    scope: 'client',
    config: true,
    default: 0.6,
    range: {
      min: 0.2,
      max: 1,
      step: 0.1
    },
    type: Number
  });

  // call this with: game.settings.get(MODULE_ID, "animationMode")
  game.settings.register(MODULE_ID, "animationMode", {
    name: 'Roulette - Animation Mode',
    hint: 'Choose an animation for the roulette.',
    scope: 'world',
    config: true,
    type: String,
    choices: {
      'none':    'Disabled',
      'native':  'Native Glow'
    },
    default: 'none'
  });



  // call this with: game.settings.get(MODULE_ID, "rouletteDelay")
  game.settings.register(MODULE_ID, 'rouletteDelay', {
    name: 'Roulette - Animation Delay',
    hint: "You can modify the delay of the Roulete animation.",
    scope: 'world',
    config: true,
    default: 200,
    range: {
      min: 0,
      max: 2000,
      step: 50
    },
    type: Number
  });


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
