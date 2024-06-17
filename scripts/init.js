const moduleName = 'wheel-of-destiny';
import WoD from "./WoD.mjs";

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

  game.keybindings.register(moduleName, "wheel-of-destiny_keybinding_custom", {
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

  // call this with: game.settings.get("wheel-of-destiny", "chatMessagePrivacy")
  game.settings.register(moduleName, 'chatMessagePrivacy', {
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

  // call this with: game.settings.get("wheel-of-destiny", "displaySelected")
  game.settings.register(moduleName, "displaySelected", {
    name: 'Display Selected', // 
    hint: 'Check this to show the selected tokens.', // 
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });

  // call this with: game.settings.get("wheel-of-destiny", "targetToken")
  game.settings.register(moduleName, "targetToken", {
    name: 'Target the Selected Token', // 
    hint: 'This will target the selected token.', // 
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });

  // call this with: game.settings.get("wheel-of-destiny", "panToToken")
  game.settings.register(moduleName, "panToToken", {
    name: 'Ping and Pan the Selected Token', // 
    hint: 'This will ping and pan the selected token.', // 
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });

  // call this with: game.settings.get("wheel-of-destiny", "imageSource")
  game.settings.register(moduleName, 'imageSource', {
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

  // call this with: game.settings.get("wheel-of-destiny", "autoSelectBehavior")
  game.settings.register(moduleName, 'autoSelectBehavior', {
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
    default: 'You have been chosen!',
    type: String
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

  // call this with: game.settings.get("wheel-of-destiny", "sequencerAnimation")
  game.settings.register(moduleName, "sequencerAnimation", {
    name: 'Sequencer - Play Animation', // 
    hint: 'Choose a sequencer animation to play over the token. YOU MUST HAVE SEQUENCER ENABLED TO USE THIS.', // 
    scope: 'world',
    config: true,
    type: String,
    choices: {
      'none': 'Disabled',
      'roulete': 'Roulete'     
    },    
    default: 'none'
  });
  
  // call this with: game.settings.get("wheel-of-destiny", "sequencerRouleteAnimation")
  game.settings.register(moduleName, 'sequencerRouleteAnimation', {
    name: 'Sequencer - Roulete Animation', 
    hint: 'You can pick one animation for the Roulete Animation.',
    scope: "world",
    type: String,
    choices: {      
      'modules/wheel-of-destiny/assets/animation/target-green.webm': 'Round - Green',     
      'modules/wheel-of-destiny/assets/animation/target-pink.webm': 'Round - Pink',
      'modules/wheel-of-destiny/assets/animation/target-red.webm': 'Round - Red',
      'modules/wheel-of-destiny/assets/animation/target-triangle-green.webm': 'Triangle - Green',
      'modules/wheel-of-destiny/assets/animation/target-triangle-pink.webm': 'Triangle - Pink',
      'modules/wheel-of-destiny/assets/animation/target-triangle-red.webm': 'Triangle - Red'
    },
    default: "modules/wheel-of-destiny/assets/animation/target-red.webm",
    config: true
  });
  
  // call this with: game.settings.get("wheel-of-destiny", "sequencerRouleteDelay")
  game.settings.register(moduleName, 'sequencerRouleteDelay', {
    name: 'Sequencer - Roulete Delay',
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

  // call this with: game.settings.get("wheel-of-destiny", "flagShareMedia")
  game.settings.register(moduleName, "flagShareMedia", {
    name: 'Share Media - Hide Interface', // 
    hint: 'Check this to cover FVTT interface with an image/video. YOU MUST HAVE SHARE MEDIA ENABLED TO USE THIS. YOU MUST SET IMMERSIVE MODE IN SHARE MEDIA SETTINGS.', // 
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });

  // call this with: game.settings.get("wheel-of-destiny", "flagShareMediaFile")
  game.settings.register(moduleName, "flagShareMediaFile", {
    name: 'Share Media - File', // 
    hint: 'Check this to cover FVTT interface with an image/video. YOU MUST HAVE SHARE MEDIA ENABLED TO USE THIS. YOU MUST SET IMMERSIVE MODE IN SHARE MEDIA SETTINGS.', // 
    scope: 'world',
    config: true,
    type: String,
    default: 'modules/wheel-of-destiny/assets/counter.webm',
    filePicker: 'imagevideo'
  });

}); // END HOOKS

Hooks.on("getSceneControlButtons", function(controls) {
  let tileControls = controls.find(x => x.name === "token");
  
  if (game.user.isGM) {
    tileControls.tools.push({
      icon: "fas fa-yin-yang",
      name: "wheel-of-destiny_token_button",
      title: "☯ Wheel of Destiny",
      button: true,
      onClick: () => window.game.wod.randomToken()
    });
  }
  
});
