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
    const tokenName = tokens[rand].document.name;
    const imagePath = tokens[rand].document.texture.src;
  
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
      const soundPath = game.settings.get("wheel-of-destiny", "soundPath");
      const soundVolume =game.settings.get("wheel-of-destiny", "soundVolume");
      AudioHelper.play({
        src: soundPath,
        volume: soundVolume,
        autoplay: true,
        loop: false
      }, true);       
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

} // END CLASS
