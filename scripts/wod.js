/*!
 * Wheel Of Destiny
 * Copyright (c) 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */
import { MODULE_ID } from "./constants.js";
import TokenPickerForm from "./token-picker.js";
import { pingToken } from "./helpers.js";

export default class WoD {

  constructor() {
    // Register native Foundry socket listener for cross-client dialog display.
    // The event name must match "module.<id>" because socket: true is declared in module.json.
    game.socket.on(`module.${MODULE_ID}`, (payload) => {
      if (payload.action === "showDialogForEveryone") {
        this.showDialogForEveryone(payload.imagePath, payload.tokenName, payload.dimensions);
      }
      if (payload.action === "playSoundForEveryone") {
        // Picking the sound needs FILES_BROWSE, which defaults to the TRUSTED role, so a
        // player's draw delegates it instead of browsing locally. activeGM designates a
        // single GM — without it every connected GM would pick a different sound and
        // broadcast it, stacking them.
        if (game.users.activeGM?.isSelf) WoD.playRandomSound();
      }
    });
  }

  /**
   * Draws one random token and runs the configured animation, chat and dialog for it.
   *
   * A GM with fewer than two tokens controlled has not staged a pool, so the token
   * picker is opened to build one — there is no automatic pool any more.
   *
   * @param {Token[]} [customTokenList] An explicit pool, for macros. Bypasses the picker.
   * @param {object} [options]
   * @param {Map<string, number>|Object<string, number>|null} [options.weights] How many
   *   chances each token of `customTokenList` gets, keyed by token id. Omit it and every
   *   token is equally likely. Ignored wherever `customTokenList` is: when the pool comes
   *   from the picker, which brings its own chance column along with the tokens, and when
   *   the drawing user is a player, who always draws from their own targets.
   * @returns {Promise<Token|void>} The drawn token, or nothing if there was nothing to draw.
   */
  async randomToken(customTokenList=[], { weights=null }={}) {
    let tokens = canvas.tokens.controlled; // tokens

    const flagDialog = game.settings.get(MODULE_ID, "hasDialog");
    const flagSound = game.settings.get(MODULE_ID, "playSound");
    const animationMode = game.settings.get(MODULE_ID, "animationMode");
    const targetToken = game.settings.get(MODULE_ID, "targetToken");
    const panToToken = game.settings.get(MODULE_ID, "panToToken");
    const privacy = game.settings.get(MODULE_ID, "chatMessagePrivacy");

    // --------------------------------------------------
    // Error handling

    if (!game.user.isGM) {
      // Non-GM draws are restricted to the user's own targets. The picker reaches every
      // token in the scene, which is not a player's to draw from, so it is skipped here —
      // as is customTokenList, which would otherwise let a macro widen the pool. `weights`
      // goes with it: it describes a pool this branch just threw away, so honoring it would
      // mean a macro still had a say in a draw that is meant to be the player's targets and
      // nothing else.
      tokens = [...game.user.targets]; // Set → Array
      weights = null;
      if (tokens.length < 1) {
        ui.notifications.notify( '☯ ' + 'You must target at least one token first.', 'error', {permanent: false});
        return;
      }
    } else if (customTokenList.length > 0) {
      tokens = customTokenList;
    } else if (tokens.length < 2) {
      // Nothing meaningful to draw between, so the GM builds the pool in the picker.
      const pool = await this.promptForPool();
      if (!pool) return;
      tokens = pool.tokens;
      weights = pool.weights;
    } // end customTokenList

    // --------------------------------------------------
    // Select a Random Token
    const selectedToken = this.selectRandomToken(tokens, weights);
    const tokenName = selectedToken.document.name;

    // Target Token — use public API instead of private _onUpdateTokenTargets
    if (animationMode=='none' && targetToken) { selectedToken.setTarget(true, { releaseOthers: true }); }

    // Pan to Token
    if (animationMode=='none' && panToToken) { this.panAndPingToken(selectedToken); }

    let imagePath;
    if (game.settings.get(MODULE_ID, "imageSource")=='tokenart' ) {
      imagePath = selectedToken.document.texture.src;
    } else {
      // A token whose actor was deleted still draws, and the picker lists it as such —
      // fall back to the token art rather than throwing on the missing actor.
      imagePath = selectedToken.document.actor?.img ?? selectedToken.document.texture.src;
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
      if (game.user.isGM) await WoD.playRandomSound();
      else game.socket.emit(`module.${MODULE_ID}`, { action: "playSoundForEveryone" });
    }

    return selectedToken;
  } // END

  //-----------------------------------------------
  // Random Sound Playback
  /**
   * Plays one random sound from a folder on a Foundry audio channel.
   *
   * Shared by the draw and by the Preview button in the audio settings window, which
   * passes the values still sitting unsaved in its form — hence the overrides.
   *
   * @param {object} [options]
   * @param {string} [options.folderPath] Folder to pick from. Defaults to the `soundPath` setting.
   * @param {string} [options.channel] A CONST.AUDIO_CHANNELS key. Defaults to the `soundChannel` setting.
   * @param {boolean} [options.broadcast=true] Whether every connected client hears it.
   * @returns {Promise<void>}
   */
  static async playRandomSound({ folderPath, channel, broadcast = true } = {}) {
    folderPath ??= game.settings.get(MODULE_ID, "soundPath");
    channel ??= game.settings.get(MODULE_ID, "soundChannel");

    const FilePickerClass = foundry.applications.apps.FilePicker.implementation ?? foundry.applications.apps.FilePicker;

    let files;
    try {
      ({ files } = await FilePickerClass.browse("data", folderPath));
    } catch {
      ui.notifications.warn('☯ ' + `Could not read the sound folder "${folderPath}".`);
      return;
    }

    if (!files.length) {
      ui.notifications.warn('☯ ' + `There are no files in the sound folder "${folderPath}".`);
      return;
    }

    const src = files[Math.floor(Math.random() * files.length)];

    // Full gain on purpose: the channel level is what each user controls in Foundry's
    // mixer, so the module plays at 1.0 and lets the channel scale it from there.
    foundry.audio.AudioHelper.play({
      src: src,
      channel: channel,
      volume: 1.0,
      autoplay: true,
      loop: false
    }, broadcast);
  }

  //-----------------------------------------------
  // Show dialog everyone
  async showDialogForEveryone(imagePath, tokenName, dimensions) {
    // Remove any existing overlay to avoid duplicates
    document.getElementById('wod-reveal-overlay')?.remove();

    const topMessage = game.settings.get(MODULE_ID, "topMessage");
    const templateData = { imagePath: imagePath, tokenName: tokenName, topMessage: topMessage };
    const myContent = await foundry.applications.handlebars.renderTemplate(`modules/${MODULE_ID}/templates/dialog.hbs`, templateData);

    // Build the overlay element
    const overlay = document.createElement('div');
    overlay.id = 'wod-reveal-overlay';
    overlay.innerHTML = myContent;

    // Dismiss on click (only on the image area)
    overlay.querySelector('.wod-container')?.addEventListener('click', () => overlay.remove());

    document.body.appendChild(overlay);

    // Auto-close after 5 seconds
    setTimeout(() => overlay.remove(), 3000);
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
    const rawDelay      = 400 + game.settings.get(MODULE_ID, "rouletteDelay");
    const totalDuration = game.settings.get(MODULE_ID, "rouletteTotalDuration");

    // Ensures the drawn token is the last in the list (same as Sequencer)
    const list = [...tokens];
    const idx = list.indexOf(selectedToken);
    list.splice(idx, 1);
    list.push(selectedToken);

    // Cap per-step delay so the full animation never exceeds totalDuration
    const totalSteps = list.length * 2; // 2 passes over the token list
    const maxDelay   = Math.floor(totalDuration / totalSteps);
    const delay      = Math.min(rawDelay, maxDelay);


    const targetToken = game.settings.get(MODULE_ID, "targetToken");
    const panToToken   = game.settings.get(MODULE_ID, "panToToken");

    // PIXI Ticker: repositions all overlays every frame to track the pan
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
      // 2 loops over the tokens (same behavior as the original Sequencer)
      for (let pass = 0; pass < 2; pass++) {
        for (const token of list) {
          const isFinalMoment = (pass === 1 && token === selectedToken);
          this._showTokenGlow(token, isFinalMoment);
          await this._sleep(delay);
          // Clears immediately — except the one drawn at the final moment
          if (!isFinalMoment) {
            this._hideTokenGlow(token.id);
          }
        }
      }

      // Selected token still glowing: pan, target, and wait before clearing
      if (panToToken)  { this.panAndPingToken(selectedToken); }
      if (targetToken) { selectedToken.setTarget(true, { releaseOthers: true }); }

      await this._sleep(2000);

    } finally {
      // Stops the ticker and clears all glows
      canvas.app.ticker.remove(positionTicker);
      this._clearAllGlows();
    }
  }

  // --- Helpers: glow DOM overlay ---

  // Converts PIXI world coordinates to screen pixels
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

  // Creates or updates the glow img over the token
  _showTokenGlow(token, isFinal = false) {
    let img = document.getElementById(`wod-glow-${token.id}`);
    if (!img) {
      img = document.createElement('img');
      img.id = `wod-glow-${token.id}`;
      img.dataset.tokenId = token.id; // needed for the ticker to reposition
      img.classList.add('wod-glow-token');
      img.src = token.document.texture.src;
      img.style.pointerEvents = 'none';
      img.style.objectFit = 'contain';
      const parent = canvas.app?.view?.parentElement ?? document.body;
      parent.appendChild(img);
    }

    // Final class: more intense glow for the selected token
    img.classList.toggle('wod-glow-final', isFinal);

    // Dimensions respecting token size and current zoom
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

  // Removes the glow from a specific token
  _hideTokenGlow(tokenId) {
    document.getElementById(`wod-glow-${tokenId}`)?.remove();
  }

  // Removes all glows (emergency cleanup)
  _clearAllGlows() {
    document.querySelectorAll('img.wod-glow-token').forEach(el => el.remove());
  }

  //-----------------------------------------------
  // Pan and Ping Token
  panAndPingToken(selectedToken) {
    pingToken(selectedToken);
  }

  // --------------------------------------------------
  // Select a Random Token

  /**
   * Picks one token, honoring per-token chances when there are any.
   *
   * `weights` says how many entries a token gets in the draw — the count the picker's
   * chance column steps up and down. Anything missing, unreadable as a number, or below
   * one counts as a single chance, so a partial map is safe to pass and an absent one
   * leaves every token equally likely, which is what a bare `selectRandomToken(list)`
   * has always done.
   *
   * @param {Token[]} tokens
   * @param {Map<string, number>|Object<string, number>|null} [weights] Keyed by token id.
   * @returns {Token}
   */
  selectRandomToken(tokens, weights=null) {
    if (!weights) return tokens[Math.floor(Math.random() * tokens.length)];

    // Plain objects are accepted alongside Maps because a macro writing one out by hand
    // reaches for `{ "abc123": 3 }` long before it reaches for a Map.
    const read = weights instanceof Map ? id => weights.get(id) : id => weights[id];

    const chances = tokens.map(token => {
      const value = Number(read(token.id));
      return Number.isFinite(value) && value > 1 ? Math.floor(value) : 1;
    });
    const total = chances.reduce((sum, count) => sum + count, 0);

    // Walks the cumulative chances until the roll is spent. `roll` is strictly below
    // `total`, so the loop always lands on a token; the trailing return covers only a
    // floating-point edge the arithmetic should never actually reach.
    let roll = Math.random() * total;
    for (let i = 0; i < tokens.length; i++) {
      roll -= chances[i];
      if (roll < 0) return tokens[i];
    }
    return tokens[tokens.length - 1];
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

    // `rolls` defaults to [] regardless, but some systems' ChatMessage document-class
    // overrides (e.g. Daggerheart's DhpChatMessage.migrateData) read source.rolls.length
    // during document creation without guarding for it being absent — passing it
    // explicitly here avoids a crash on this flavor-only message, which never had a roll.
    if (privacy=='gmonly') {
      // Addressed to the GMs rather than to game.user: a player's draw would otherwise
      // whisper the result to the player alone. The author sees their own whisper either
      // way, so the drawing user still gets the message.
      ChatMessage.create({
       content: myContent, rolls: [], whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id)
      });
    } else {
      ChatMessage.create({ content: myContent, rolls: [] });
    }
  }

  // --------------------------------------------------
  // Token Picker

  /**
   * Asks the GM to build a draw pool, with its chances, out of the tokens in the current
   * scene.
   *
   * GM-only by design: the picker lists every token in the scene, which is not a
   * player's to draw from — players stay on the target-based path in `randomToken`.
   *
   * @returns {Promise<{tokens: Token[], weights: Map<string, number>}|null>} The chosen
   *   pool, or `null` if it was dismissed or there was nothing to choose from.
   */
  async promptForPool() {
    if (!game.user.isGM) {
      ui.notifications.notify( '☯ ' + 'Only a GM can choose tokens from the scene.', 'error', {permanent: false});
      return null;
    }

    if (canvas.tokens.placeables.length < 1) {
      ui.notifications.notify( '☯ ' + 'There are no tokens available in this scene.', 'info', {permanent: false});
      return null;
    }

    return TokenPickerForm.open();
  }

  /**
   * The chosen pool as a plain token list, dropping the chances the picker collected.
   *
   * Kept as the documented macro entry point — `WoD.promptForTokens()` has always handed
   * back an array and still does. Anything that goes on to draw from the result wants
   * `promptForPool()` instead, so the GM's chance column survives the trip.
   *
   * @returns {Promise<Token[]|null>} The chosen tokens, or `null` if the picker was
   *   dismissed or there was nothing to choose from.
   */
  async promptForTokens() {
    const pool = await this.promptForPool();
    return pool ? pool.tokens : null;
  }

  /**
   * Opens the token picker and draws from whatever the GM commits to.
   *
   * Bound to the "Custom Wheel of Destiny" keybinding and published on the `WoD` macro
   * API. Unlike the toolbar button, this always asks — even when a pool is already
   * controlled on the canvas.
   *
   * @returns {Promise<Token|void>} The drawn token, or nothing if the picker was dismissed.
   */
  async openTokenPicker() {
    const pool = await this.promptForPool();
    if (!pool) return;
    return this.randomToken(pool.tokens, { weights: pool.weights });
  }

} // END CLASS
