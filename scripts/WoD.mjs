export default class WoD {

  constructor() {
    this.socket = socketlib.registerModule('wheel-of-destiny');       	
    this.socket.register("showDialogForEveryone", this.showDialogForEveryone);    // Dialog
  }
  
  async randomToken() {
    let data = {};
    let tokens = canvas.tokens.controlled; // tokens
    const allTokens = canvas.tokens.placeables;
    const autoSelectBehavior = game.settings.get("wheel-of-destiny", "autoSelectBehavior")
    const flagChat = true;
    const flagDialog = game.settings.get("wheel-of-destiny", "hasDialog");
    const flagSound = game.settings.get("wheel-of-destiny", "playSound");
    const sequencerAnimation = game.settings.get("wheel-of-destiny", "sequencerAnimation");
    const flagShareMedia = game.settings.get("wheel-of-destiny", "flagShareMedia");
    
    // --------------------------------------------------
    // Error handling
    if (tokens.length<1) {      
      tokens = allTokens;
      if (tokens.length<1) {
       ui.notifications.notify( '☯ ' + 'There is no tokens available on this scene.', 'info', {permanent: false});
       return;       
      } else { // Auto Select
        if (autoSelectBehavior=='pcs') {
          tokens = tokens.filter(e => e.document.hasPlayerOwner===true);  
          if (tokens.length<1) {
           ui.notifications.notify( '☯ ' + 'There is no PC tokens available on this scene.', 'info', {permanent: false});
           return;       
          }          
        }        
      }
    }

    const rand = Math.floor(Math.random() * tokens.length);
    const selectedToken = tokens[rand];
    const tokenName = tokens[rand].document.name;
	
	let imagePath;
	if (game.settings.get("wheel-of-destiny", "imageSource")=='tokenart' ) {
		imagePath = tokens[rand].document.texture.src;
	} else {
		imagePath = tokens[rand].document.actor.img;
	}

    let tokensNameList = tokens.map(function(item){
       return `<li>${item.name}</li>`;
    });
    tokensNameList = tokensNameList.join("");
    
    if (flagChat) {
      const topMessage = game.settings.get("wheel-of-destiny", "topMessage");
      const displaySelected = game.settings.get("wheel-of-destiny", "displaySelected");
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

    if (flagDialog) {
      const dimensions = await this.getDimensions(imagePath);    
      this.socket.executeForEveryone(this.showDialogForEveryone, imagePath, tokenName, dimensions);       
    }
    
    if (flagSound) {      
      const soundFolderPath = game.settings.get("wheel-of-destiny", "soundPath");
      const soundVolume =game.settings.get("wheel-of-destiny", "soundVolume");

      let {files} = await FilePicker.browse("data", soundFolderPath);
      const soundPath = files[Math.floor(Math.random() * files.length)];
       
      AudioHelper.play({
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
      if (sequencerAnimation=='arrows') {
        this.sequencerAnimation(selectedToken);
      } else {
        this.sequencerAnimationRoulette(tokens, selectedToken);
      }
    }

    if (flagShareMedia) {
      if (!game.modules.get("share-media")?.active) { 
        ui.notifications.error("Please, activate Share Media module!");
        return;
      }            
      game.modules.get('share-media').API.shareFullscreenMediaToAll(game.settings.get("wheel-of-destiny", "flagShareMediaFile"), '', false, false)
    }
    
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
  async sequencerAnimation(selectedToken, delay=0) {
    let effectScale = 0.25;
    let tokenSize;
    const animation = "modules/jb2a_patreon/Library/Generic/UI/Indicator01_02_Regular_BlueGreen_400x400.webm";
    tokenSize = (selectedToken.document.width + selectedToken.document.height) /2;
    new Sequence()
    .effect()
      .file(animation)
      .atLocation(selectedToken)
      .scale(tokenSize * effectScale)
      .repeats(10)
      .fadeIn(500)
      .fadeOut(500)    
      .duration(10000)
      .delay(delay)      
    .play();
  }

  //-----------------------------------------------
  // 
  async sequencerAnimationRoulette(selectedTokens, selectedToken) {
    const animation = "modules/wheel-of-destiny/assets/animation/portal.webm";
    let effectScale = 0.7;
    let tokenSize;
    let delay = 0;
    
    const index = selectedTokens.indexOf(selectedToken);
    selectedTokens.splice(index, 1); // 2nd parameter means remove one item only
    selectedTokens.push(selectedToken);
    
    for (let i=0; i<2; i++) {
      for(let iteratedToken of selectedTokens) {
        delay = delay + 1000;
        tokenSize = (iteratedToken.document.width + iteratedToken.document.height) / 2;
        new Sequence()
          .effect()
            .file(animation)
            .scale(effectScale * tokenSize)
            .atLocation(iteratedToken)
            .belowTokens()
            .repeats(1)		
            .delay(delay)
            .fadeIn(200)
            .fadeOut(200)
            .duration(1000)            
        .play();
      } // end for 2
    } // end for 1
    
    this.sequencerAnimation(selectedToken,delay+1000);
  }

} // END CLASS
