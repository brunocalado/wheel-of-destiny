const moduleName = 'wheel-of-destiny';
import WoD from "./WoD.mjs";

Hooks.once('init', () => {
  // --------------------------------------------------
  // Load API
  let wod = new WoD();
  window.game.wod = wod; // Request: //window.game.wod.randomToken();    
  
  // --------------------------------------------------
  // Functions
  const debouncedReload = debounce(() => location.reload(), 1000); // RELOAD AFTER CHANGE

  // --------------------------------------------------
  // KEYBINDINGS
  game.keybindings.register(moduleName, "wheel-of-destiny_keybinding", {
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

  // --------------------------------------------------
  // SETTINGS

  // call this with: game.settings.get("wheel-of-destiny", "chatMessagePrivacy")
  game.settings.register(moduleName, 'chatMessagePrivacy', {
    name: 'Chat Message Privacy', 
    hint: 'Choose who can see the chat message.',
    scope: "world",
    type: String,
    choices: {
      'gmonly': 'Whisper to GM',
      'everyone': 'Show to Everyone'     
    },
    default: "everyone",
    config: true
  });

  // call this with: game.settings.get("wheel-of-destiny", "displaySelected")
  game.settings.register(moduleName, "displaySelected", {
    name: 'Display Selected', // 
    hint: 'Check this to show the selected tokens.', // 
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });

  // call this with: game.settings.get("wheel-of-destiny", "autoSelectBehavior")
  game.settings.register(moduleName, 'autoSelectBehavior', {
    name: 'Auto Select Behavior', 
    hint: "This define the behavior of the auto selection, which trigger if you don't select any tokens.",
    scope: "world",
    type: String,
    choices: {
      'all': 'Select All Tokens in the Scene',
      'pcs': 'Select Only PCs'     
    },
    default: "all",
    config: true
  });
  
  // call this with: game.settings.get("wheel-of-destiny", "hasDialog")
  game.settings.register(moduleName, "hasDialog", {
    name: 'Show Dialog?', // 
    hint: 'Check this to show a dialog message with the selected.', // 
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });
  
  // call this with: game.settings.get("wheel-of-destiny", "topMessage")
  game.settings.register(moduleName, 'topMessage', {
    name: 'Dialog Top Message', //
    hint: 'The text you enter in here will show on the top of the dialog message.', //
    scope: 'world',
    config: true,
    default: 'You has been choosen!',
    type: String
  });

  // call this with: game.settings.get("wheel-of-destiny", "playAnimation")
  game.settings.register(moduleName, "playAnimation", {
    name: 'Play Animation', // 
    hint: 'Check this to play a simple a animation over the token. YOU MUST HAVE SEQUENCER ENABLED TO USE THIS.', // 
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });
  
  // call this with: game.settings.get("wheel-of-destiny", "playSound")
  game.settings.register(moduleName, "playSound", {
    name: 'Play Sound', // 
    hint: 'Check this if you want a sound to be played.', 
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });
  
  // call this with: game.settings.get("wheel-of-destiny", "soundPath")
  game.settings.register(moduleName, 'soundPath', {
    name: 'Sound Folder Path',
    hint: 'You can set a sound folder. The module will pick one playable sound from it. DO NOT ADD OTHER FILES. Just add the sounds you want to be played.',
    scope: 'world',
    config: true,
    default: 'modules/wheel-of-destiny/assets/sounds',
    type: String,
    filePicker: 'folder'
  });  
  
  // call this with: game.settings.get("wheel-of-destiny", "soundVolume")
  game.settings.register(moduleName, 'soundVolume', {
    name: 'Sound Volume',
    hint: "You can set the volume for the warning sound. Use 0.1 for 10% of the volume. 0.6 for 60% of the volume.",
    scope: 'world',
    config: true,
    default: 0.6,
    range: {
      min: 0.2,
      max: 1,
      step: 0.1
    },     
    type: Number
  });

}); // END HOOKS

Hooks.on("getSceneControlButtons", function(controls) {
  let tileControls = controls.find(x => x.name === "token");
  
  tileControls.tools.push({
    icon: "fas fa-yin-yang",
    name: "wheel-of-destiny_token_button",
    title: "☯ Wheel of Destiny",
    button: true,
    onClick: () => window.game.wod.randomToken()
  });

});

