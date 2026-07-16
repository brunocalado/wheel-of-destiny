/*!
 * Wheel Of Destiny
 * Copyright (c) 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */
import { MODULE_ID } from "./constants.js";

export default class WoD {

  constructor() {
    // Register native Foundry socket listener for cross-client dialog display.
    // The event name must match "module.<id>" because socket: true is declared in module.json.
    game.socket.on(`module.${MODULE_ID}`, (payload) => {
      if (payload.action === "showDialogForEveryone") {
        this.showDialogForEveryone(payload.imagePath, payload.tokenName, payload.dimensions);
      }
    });
  }

  async randomToken(customTokenList=[], customAutoSelect=null) {
    let tokens = canvas.tokens.controlled; // tokens
    const allTokens = canvas.tokens.placeables;

    let autoSelectBehavior = game.settings.get(MODULE_ID, "autoSelectBehavior");
    const flagDialog = game.settings.get(MODULE_ID, "hasDialog");
    const flagSound = game.settings.get(MODULE_ID, "playSound");
    const animationMode = game.settings.get(MODULE_ID, "animationMode");
    const targetToken = game.settings.get(MODULE_ID, "targetToken");
    const panToToken = game.settings.get(MODULE_ID, "panToToken");
    const privacy = game.settings.get(MODULE_ID, "chatMessagePrivacy");

    // --------------------------------------------------
    // Error handling

    if (customTokenList.length > 0) {
      tokens = customTokenList;
    } else {
      if (tokens.length < 1) { // Auto Select All
        tokens = allTokens;
        if (tokens.length < 1) {
         ui.notifications.notify( '☯ ' + 'There are no tokens available in this scene.', 'info', {permanent: false});
         return;
        } else { // Auto Select
          if (customAutoSelect != null) { autoSelectBehavior = customAutoSelect; }
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

          if (tokens.length < 1) {
           ui.notifications.notify( '☯ ' + 'There are no PC tokens available in this scene.', 'info', {permanent: false});
           return;
          }
        } // END Auto Select
      }
    } // end customTokenList

    // --------------------------------------------------
    // Select a Random Token
    const selectedToken = this.selectRandomToken(tokens);
    const tokenName = selectedToken.document.name;

    // Target Token — use public API instead of private _onUpdateTokenTargets
    if (animationMode=='none' && targetToken) { selectedToken.setTarget(true, { releaseOthers: true }); }

    // Pan to Token
    if (animationMode=='none' && panToToken) { this.panAndPingToken(selectedToken); }

    let imagePath;
    if (game.settings.get(MODULE_ID, "imageSource")=='tokenart' ) {
      imagePath = selectedToken.document.texture.src;
    } else {
      imagePath = selectedToken.document.actor.img;
    }

    // Chat
    if (animationMode == 'none' && privacy != 'none') {
      this.createChatMessage(selectedToken, tokens, imagePath);
    }

    if (animationMode === 'native') {
      await this.playNativeRoulette(tokens, selectedToken);
      if (privacy != 'none') { this.createChatMessage(selectedToken, tokens, imagePath); }
    }

    if (flagDialog) {
      const dimensions = await this.getDimensions(imagePath);
      // Emit to all other connected clients. The GM also calls it locally
      // because game.socket.emit does not trigger the sender's own listener.
      game.socket.emit(`module.${MODULE_ID}`, { action: "showDialogForEveryone", imagePath, tokenName, dimensions });
      this.showDialogForEveryone(imagePath, tokenName, dimensions);
    }

    if (flagSound) {
      const soundFolderPath = game.settings.get(MODULE_ID, "soundPath");
      const soundVolume = game.settings.get(MODULE_ID, "soundVolume");

      let {files} = await foundry.applications.apps.FilePicker.implementation.browse("data", soundFolderPath);
      const soundPath = files[Math.floor(Math.random() * files.length)];

      foundry.audio.AudioHelper.play({
        src: soundPath,
        volume: soundVolume,
        autoplay: true,
        loop: false
      }, true);
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

    const topMessage = game.settings.get(MODULE_ID, "topMessage");
    const templateData = { imagePath: imagePath, tokenName: tokenName, topMessage: topMessage };
    const myContent = await foundry.applications.handlebars.renderTemplate(`modules/${MODULE_ID}/templates/dialog.hbs`, templateData);

    foundry.applications.api.DialogV2.prompt({
        window: { title: tokenName },
        content: myContent,
        ok: {},
      }, myDialogOptions
    );
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
  // Native Roulette Animation
  async playNativeRoulette(tokens, selectedToken) {
    const delay = 400 + game.settings.get(MODULE_ID, "rouletteDelay");

    // Garante que o token sorteado é o último da lista (igual ao Sequencer)
    const list = [...tokens];
    const idx = list.indexOf(selectedToken);
    list.splice(idx, 1);
    list.push(selectedToken);

    const targetToken = game.settings.get(MODULE_ID, "targetToken");
    const panToToken   = game.settings.get(MODULE_ID, "panToToken");

    // Ticker PIXI: reposiciona todos os overlays a cada frame para acompanhar o pan
    const positionTicker = () => {
      document.querySelectorAll('img.wod-glow-token[data-token-id]').forEach(img => {
        const tokenId = img.dataset.tokenId;
        const token = canvas.tokens.get(tokenId);
        if (!token) return;
        const scaleX = Math.abs(token.document.texture?.scaleX ?? 1);
        const scaleY = Math.abs(token.document.texture?.scaleY ?? 1);
        const w = token.document.width  * canvas.grid.size * canvas.stage.scale.x * scaleX;
        const h = token.document.height * canvas.grid.size * canvas.stage.scale.y * scaleY;
        const pos = this._worldToScreen(token.center);
        img.style.width  = `${w}px`;
        img.style.height = `${h}px`;
        img.style.left   = `${pos.x}px`;
        img.style.top    = `${pos.y}px`;
      });
    };
    canvas.app.ticker.add(positionTicker);

    try {
      // 2 voltas nos tokens (mesmo comportamento do Sequencer original)
      for (let pass = 0; pass < 2; pass++) {
        for (const token of list) {
          const isFinalMoment = (pass === 1 && token === selectedToken);
          this._showTokenGlow(token, isFinalMoment);
          await this._sleep(delay);
          // Apaga imediatamente — exceto o sorteado no momento final
          if (!isFinalMoment) {
            this._hideTokenGlow(token.id);
          }
        }
      }

      // Token sorteado ainda brilhando: pan, target e espera antes de apagar
      if (panToToken)  { this.panAndPingToken(selectedToken); }
      if (targetToken) { selectedToken.setTarget(true, { releaseOthers: true }); }

      await this._sleep(2000);

    } finally {
      // Para o ticker e limpa todos os glows
      canvas.app.ticker.remove(positionTicker);
      this._clearAllGlows();
    }
  }

  // --- Helpers: glow DOM overlay ---

  // Converte coordenadas de mundo PIXI para pixels de tela
  _worldToScreen(worldPos) {
    const t = canvas.stage.worldTransform;
    return {
      x: worldPos.x * t.a + t.tx,
      y: worldPos.y * t.d + t.ty
    };
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Cria ou atualiza a img de glow sobre o token
  _showTokenGlow(token, isFinal = false) {
    let img = document.getElementById(`wod-glow-${token.id}`);
    if (!img) {
      img = document.createElement('img');
      img.id = `wod-glow-${token.id}`;
      img.dataset.tokenId = token.id; // necessário para o ticker reposicionar
      img.classList.add('wod-glow-token');
      img.src = token.document.texture.src;
      img.style.pointerEvents = 'none';
      img.style.objectFit = 'contain';
      const parent = canvas.app?.view?.parentElement ?? document.body;
      parent.appendChild(img);
    }

    // Classe final: glow mais intenso para o sorteado
    img.classList.toggle('wod-glow-final', isFinal);

    // Dimensões respeitando tamanho do token e zoom atual
    const scaleX = Math.abs(token.document.texture?.scaleX ?? 1);
    const scaleY = Math.abs(token.document.texture?.scaleY ?? 1);
    const w = token.document.width  * canvas.grid.size * canvas.stage.scale.x * scaleX;
    const h = token.document.height * canvas.grid.size * canvas.stage.scale.y * scaleY;
    const pos = this._worldToScreen(token.center);

    img.style.width   = `${w}px`;
    img.style.height  = `${h}px`;
    img.style.left    = `${pos.x}px`;
    img.style.top     = `${pos.y}px`;
    img.style.display = '';
  }

  // Remove o glow de um token específico
  _hideTokenGlow(tokenId) {
    document.getElementById(`wod-glow-${tokenId}`)?.remove();
  }

  // Remove todos os glows (limpeza de emergência)
  _clearAllGlows() {
    document.querySelectorAll('img.wod-glow-token').forEach(el => el.remove());
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
    const topMessage = game.settings.get(MODULE_ID, "topMessage");
    const displaySelected = game.settings.get(MODULE_ID, "displaySelected");

    let tokensNameList = tokens.map(function(item){
       return `<li>${item.name}</li>`;
    });
    tokensNameList = tokensNameList.join("");

    const templateData = { imagePath: imagePath, tokenName: tokenName, topMessage: topMessage, tokensNameList: tokensNameList, displaySelected: displaySelected };
    const myContent = await foundry.applications.handlebars.renderTemplate(`modules/${MODULE_ID}/templates/chat.hbs`, templateData);
    const privacy = game.settings.get(MODULE_ID, "chatMessagePrivacy");

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
    const myContent = await foundry.applications.handlebars.renderTemplate(`modules/${MODULE_ID}/templates/dialog-autoselect.hbs`, templateData);

    const data = await foundry.applications.api.DialogV2.prompt({
      window: { title: "Wheel of Destiny" },
      content: myContent,
      ok: {
        label: "Choose",
        callback: (event, button) => new foundry.applications.ux.FormDataExtended(button.form).object
      },
      rejectClose: false
    });

    if (!data) return;

    this.randomToken([], data.custom_autoselect);
  }

} // END CLASS
