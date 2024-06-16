export default class WoD {

  constructor() {
    this.socket = socketlib.registerModule('wheel-of-destiny');       	
    this.socket.register("showDialogForEveryone", this.showDialogForEveryone);    // Dialog
  }
  
  async randomToken(customTokenList=[], customAutoSelect=null) {
    let data = {};
    let tokens = canvas.tokens.controlled; // tokens
    const allTokens = canvas.tokens.placeables;

    let autoSelectBehavior = game.settings.get("wheel-of-destiny", "autoSelectBehavior")    
    const flagDialog = game.settings.get("wheel-of-destiny", "hasDialog");
    const flagSound = game.settings.get("wheel-of-destiny", "playSound");
    const sequencerAnimation = game.settings.get("wheel-of-destiny", "sequencerAnimation");
    const flagShareMedia = game.settings.get("wheel-of-destiny", "flagShareMedia");
    const targetToken = game.settings.get("wheel-of-destiny", "targetToken");
    const panToToken = game.settings.get("wheel-of-destiny", "panToToken");
    const privacy = game.settings.get("wheel-of-destiny", "chatMessagePrivacy");
    
    // --------------------------------------------------
    // Error handling
    
    if (customTokenList.length>0) {     
      tokens = customTokenList;
    } else {      
      if (tokens.length<1) { // Auto Select All
        tokens = allTokens;
        if (tokens.length<1) {
         ui.notifications.notify( '☯ ' + 'There is no tokens available on this scene.', 'info', {permanent: false});
         return;       
        } else { // Auto Select
          if (customAutoSelect!=null) {autoSelectBehavior=customAutoSelect;}
          switch(autoSelectBehavior) {
            case 'pcs':
              tokens = tokens.filter(e => e.document.hasPlayerOwner===true);  
              break;
            case 'friendly':
              tokens = tokens.filter(e => e.document.disposition===1);  
              break;
            case 'hostile':
              tokens = tokens.filter(e => e.document.disposition===-1);  
              break;                 
          }
   
          if (tokens.length<1) {
           ui.notifications.notify( '☯ ' + 'There is no PC tokens available on this scene.', 'info', {permanent: false});
           return;       
          }                    
        } // END Auto Select
      }
    } // end customTokenList

    // --------------------------------------------------
    // Select a Random Token
    const selectedToken = this.selectRandomToken(tokens);
    const tokenName = selectedToken.document.name;
    
    // Target Token
    if (sequencerAnimation=='none' && targetToken) { game.user.updateTokenTargets([selectedToken.id]); } 

    // Pan to Token
    if (sequencerAnimation=='none' && panToToken) { this.panAndPingToken(selectedToken); }
	
    let imagePath;
    if (game.settings.get("wheel-of-destiny", "imageSource")=='tokenart' ) {
      imagePath = selectedToken.document.texture.src;
    } else {
      imagePath = selectedToken.document.actor.img;
    }
    
    // Chat
    if ( sequencerAnimation=='none' && privacy!='none' ) {
      this.createChatMessage(selectedToken, tokens, imagePath);
    }

    if (flagDialog) {
      const dimensions = await this.getDimensions(imagePath);    
      this.socket.executeForEveryone(this.showDialogForEveryone, imagePath, tokenName, dimensions);       
    }
    
    if (flagSound) {      
      const soundFolderPath = game.settings.get("wheel-of-destiny", "soundPath");
      const soundVolume =game.settings.get("wheel-of-destiny", "soundVolume");

      let {files} = await FilePicker.browse("data", soundFolderPath);
      const soundPath = files[Math.floor(Math.random() * files.length)];
       
      foundry.audio.AudioHelper.play({
        src: soundPath,
        volume: soundVolume,
        autoplay: true,
        loop: false
      }, true);       
    }
    
    if (sequencerAnimation!='none') {
      if (!game.modules.get("sequencer")?.active) { 
        ui.notifications.error("Please, activate Sequencer module!");
        return;
      }
      await this.sequencerAnimationRoulette(tokens, selectedToken);
      if ( privacy!='none' ) { this.createChatMessage(selectedToken, tokens, imagePath); }
    }

    if (flagShareMedia) {
      if (!game.modules.get("share-media")?.active) { 
        ui.notifications.error("Please, activate Share Media module!");
        return;
      }            
      game.modules.get('share-media').API.shareFullscreenMediaToAll(game.settings.get("wheel-of-destiny", "flagShareMediaFile"), '', false, false)
    }
    return selectedToken;
  } // END  

  //-----------------------------------------------
  // Show dialog everyone
  async showDialogForEveryone(imagePath, tokenName, dimensions) {
    const myDialogOptions = {};
    myDialogOptions['id'] = 'wheel-of-destiny-dialog';
    myDialogOptions['resizable'] = false;
    
    if(dimensions.width>500 || dimensions.height>500) {
      if(dimensions.width>500) {
        myDialogOptions['width'] = 500;        
        myDialogOptions['height'] = '100%';
      } else {
        myDialogOptions['height'] = 500;              
        myDialogOptions['width'] = '100%';
      }
    } else {
      myDialogOptions['width'] = '100%';
      myDialogOptions['height'] = '100%';
    }
    
    const topMessage = game.settings.get("wheel-of-destiny", "topMessage");
    const templateData = { imagePath: imagePath, tokenName: tokenName, topMessage: topMessage };
    const myContent = await renderTemplate("modules/wheel-of-destiny/templates/dialog.html", templateData);
    
    new Dialog({
        title: tokenName,
        content: myContent,
        buttons: {}
      }, myDialogOptions
    ).render(true);    
  }

  //-----------------------------------------------
  // 
  async getDimensions(path) {
    const fileExtension = path.split('.').pop();     
    let img = new Image();
    return await new Promise(resolve => { 
      img.onload = function() {
        resolve({width: this.width, height: this.height});
      };
      img.src = path;
    });
  }  

  //-----------------------------------------------
  // 
  async sequencerAnimationRoulette(selectedTokens, selectedToken) {
    const animation = game.settings.get("wheel-of-destiny", "sequencerRouleteAnimation");
    let effectScale = 0.5;
    let tokenSize;
    const sequencerRouleteDelay = game.settings.get("wheel-of-destiny", "sequencerRouleteDelay");
    let delay = 0;
    const delayValue = 400 + sequencerRouleteDelay;    
    
    const index = selectedTokens.indexOf(selectedToken);
    selectedTokens.splice(index, 1); // 2nd parameter means remove one item only
    selectedTokens.push(selectedToken);
    
    const targetToken = game.settings.get("wheel-of-destiny", "targetToken");
    const panToToken = game.settings.get("wheel-of-destiny", "panToToken");
    
    for (let i=0; i<2; i++) {
      for(let iteratedToken of selectedTokens) {
        delay = delayValue;
        tokenSize = (iteratedToken.document.width + iteratedToken.document.height) / 2;
        const out = await new Sequence()
          .effect()
            .file(animation)
            .scale(effectScale * tokenSize)
            .atLocation(iteratedToken)
            //.belowTokens()
            .repeats(1)		
            .delay(delay)
            .fadeIn(200)
            .fadeOut(200)
            .duration(delayValue)            
        .play();
      } // end for 2
    } // end for 1
    
    if (panToToken) { this.panAndPingToken(selectedToken); }
    if (targetToken) { game.user.updateTokenTargets([selectedToken.id]); }
  }

  //-----------------------------------------------
  // Pan and Ping Token
  panAndPingToken(selectedToken) {
    const origin = selectedToken.center;
    const options = {
      scene: canvas.scene.id,
      pull: true,
      style: CONFIG.Canvas.pings.types.PULL
    };
    canvas.ping(origin, options);    
  }

  // --------------------------------------------------
  // Select a Random Token
  selectRandomToken(tokens) {
    const rand = Math.floor(Math.random() * tokens.length);
    return tokens[rand];    
  }

  // --------------------------------------------------
  // Chat Message
  async createChatMessage(selectedToken, tokens, imagePath) {
    const tokenName = selectedToken.document.name;
    const topMessage = game.settings.get("wheel-of-destiny", "topMessage");
    const displaySelected = game.settings.get("wheel-of-destiny", "displaySelected");
    
    let tokensNameList = tokens.map(function(item){
       return `<li>${item.name}</li>`;
    });
    tokensNameList = tokensNameList.join("");
    
    const templateData = { imagePath: imagePath, tokenName: tokenName, topMessage: topMessage, tokensNameList: tokensNameList, displaySelected: displaySelected };
    const myContent = await renderTemplate("modules/wheel-of-destiny/templates/chat.html", templateData);    
    const privacy = game.settings.get("wheel-of-destiny", "chatMessagePrivacy");
    
    if (privacy=='gmonly') {
      ChatMessage.create({
       content: myContent, whisper: [game.user.id]
      });
    } else {
      ChatMessage.create({ content: myContent });        
    }    
  }

  // --------------------------------------------------
  // 
  async customAutoSelectDialog() {  
    const templateData = {};
    const myContent = await renderTemplate("modules/wheel-of-destiny/templates/dialog_autoselect.html", templateData);
    
    new Dialog({
      title: `Wheel of Destiny`,
      content: myContent,
      buttons: {
        ok: {
          label: "Choose",
          callback: async (html) => {
            const customAutoSelect = html.find('#custom_autoselect')[0].value;
            this.randomToken([], customAutoSelect);      
          },
        },
        cancel: {
          label: "Cancel",
        }
      }
    }).render(true);  

  }
  
} // END CLASS

