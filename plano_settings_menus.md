# Settings Reorganization Plan (Settings Menus)

This document details the plan to group the "Wheel of Destiny" module settings using the Foundry VTT Menu API (`game.settings.registerMenu`), making the main settings tab much cleaner for the GM.

> **Target:** Foundry VTT **v14**. All code must use `ApplicationV2` + `HandlebarsApplicationMixin`. `FormApplication` is banned.

---

## 1. Proposed Groups

There are currently 13 settings. The plan: keep 2 essential rules loose and create 3 menu buttons.

### ⚙️ Free Settings (stay loose in the main tab)
- `autoSelectBehavior` — Selection rule (most-used setting, needs quick access)
- `targetToken` — Target after draw (most-used setting, needs quick access)

### 🎵 Menu 1: Audio & Sound
- `playSound` — Enable/disable sound
- `soundPath` — Sound folder (FilePicker)
- `soundChannel` — **NEW** Audio channel (Interface / Music / Ambient / Effects)
- **Preview Sound button** — **NEW** Action button: plays a random sound from the chosen folder so the GM can test without saving

> **Note on `soundVolume`:** Removed from the UI. Each user controls their own channel volume in Foundry's built-in mixer (playlist tab). The GM sets the general level per channel; players adjust theirs individually. Keeping `soundVolume` as a module setting is redundant and wrong-headed.
> The setting registration stays in the code with `config: false` to preserve any previously saved values and avoid breaking old installs.

### ✨ Menu 2: Animation & Visual
- `animationMode` — Roulette animation style
- `rouletteDelay` — Animation speed
- `panToToken` — Ping and pan to selected token
- `displaySelected` — Show selected tokens highlighted
- `imageSource` — Token art vs Actor sheet art *(moved from Menu 3 — it's a visual setting, not a dialog/chat setting)*

### 💬 Menu 3: Dialogs & Chat
- `hasDialog` — Show dialog after draw
- `topMessage` — Dialog top message text
- `chatMessagePrivacy` — Who sees the chat message

---

## 2. Implementation Steps

Each menu needs 3 components:
1. **Menu Registration** — code in `init.js` to create the button.
2. **ApplicationV2 class** — JS class that handles the template and saves data.
3. **HBS template** — the input UI rendered inside the window.

### Step 1: Organize Files

Create dedicated files:
- `scripts/settings.js` — all `registerMenu` calls, all `register` calls with `config: false`, and the 3 ApplicationV2 classes
- `templates/settings-audio.hbs`
- `templates/settings-animation.hbs`
- `templates/settings-dialogs.hbs`
- `styles/settings-audio.css` — scoped CSS for the audio window (one CSS file per Application, per CLAUDE.md §12)
- `styles/settings-animation.css`
- `styles/settings-dialogs.css`

Import `settings.js` from `init.js` and register CSS files in `module.json`.

### Step 2: Register the Menus and Hidden Settings

In `settings.js`, register each menu button and change all grouped settings to `config: false` so they disappear from the main tab but remain accessible via `game.settings.get/set`.

### Step 3: Build the ApplicationV2 Classes

One class per menu, using `ApplicationV2` + `HandlebarsApplicationMixin`. Key points:
- `_prepareContext(options)` reads current values from `game.settings.get()`
- `static DEFAULT_OPTIONS` declares `id`, `classes` (include MODULE_ID for CSS scoping), `window.title`, `actions`, and `form`
- `static PARTS` points to the HBS template
- The save action calls `game.settings.set()` for each setting in the group
- The **Preview Sound** action (Menu 1 only) reads the `soundPath` input value from the DOM and calls Foundry's audio API — it does **not** wait for a save

---

## 3. Code Patterns (V14-compliant)

### A) Menu Registration (in `settings.js`)
```javascript
game.settings.registerMenu(MODULE_ID, "audioMenu", {
  name: "Audio & Sound",
  label: "Open Audio Settings",
  hint: "Configure sounds for the Wheel of Destiny.",
  icon: "fas fa-music",
  type: AudioSettingsForm,   // ApplicationV2 class defined below
  restricted: true           // GM only
});

// Settings stay registered but hidden from the main config tab
game.settings.register(MODULE_ID, "playSound", {
  name: "Play Sound",
  scope: "world",
  config: false,             // Hidden from main tab — managed via the menu
  type: Boolean,
  default: false
});

game.settings.register(MODULE_ID, "soundChannel", {
  name: "Sound Channel",
  scope: "world",
  config: false,
  type: String,
  choices: {
    "interface": "Interface",
    "music":     "Music",
    "ambient":   "Ambient",
    "effects":   "Effects"
  },
  default: "interface"
});

// soundVolume: kept registered with config: false to preserve old saved values.
// Not shown in any menu — users control channel volume in Foundry's mixer.
game.settings.register(MODULE_ID, "soundVolume", {
  scope: "client",
  config: false,
  type: Number,
  default: 0.6
});
```

### B) ApplicationV2 Class (in `settings.js`)
```javascript
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class AudioSettingsForm extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "wod-audio-settings",
    classes: [MODULE_ID, "wod-settings-form"],
    window: { title: "Audio & Sound — Wheel of Destiny" },
    position: { width: 480 },
    actions: {
      previewSound: AudioSettingsForm._onPreviewSound
    },
    form: {
      handler: AudioSettingsForm._onSubmit,
      closeOnSubmit: true
    }
  };

  static PARTS = {
    form: { template: `modules/${MODULE_ID}/templates/settings-audio.hbs` }
  };

  /** @override */
  async _prepareContext(options) {
    return {
      playSound:   game.settings.get(MODULE_ID, "playSound"),
      soundPath:   game.settings.get(MODULE_ID, "soundPath"),
      soundChannel: game.settings.get(MODULE_ID, "soundChannel"),
      channelChoices: {
        interface: "Interface",
        music:     "Music",
        ambient:   "Ambient",
        effects:   "Effects"
      }
    };
  }

  /**
   * Save all audio settings on form submit.
   * @param {Event} event
   * @param {HTMLFormElement} form
   * @param {FormDataExtended} formData
   */
  static async _onSubmit(event, form, formData) {
    const data = formData.object;
    await game.settings.set(MODULE_ID, "playSound",    data.playSound ?? false);
    await game.settings.set(MODULE_ID, "soundPath",    data.soundPath);
    await game.settings.set(MODULE_ID, "soundChannel", data.soundChannel);
  }

  /**
   * Preview a random sound from the currently selected folder.
   * Reads the live DOM value so the GM can test before saving.
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async _onPreviewSound(event, target) {
    const form = target.closest("form");
    const path = form.querySelector("[name='soundPath']").value;
    if (!path) {
      ui.notifications.warn("Set a sound folder path first.");
      return;
    }
    // Use Foundry's file browser to pick a random playable file from the folder
    const src = await foundry.audio.AudioHelper.preloadSound(path);
    if (src) foundry.audio.AudioHelper.play({ src, volume: 0.6, autoplay: true });
  }
}
```

### C) HBS Template (`templates/settings-audio.hbs`)
```handlebars
<form class="{{MODULE_ID}} wod-settings-form">

  {{! Play Sound }}
  <div class="form-group">
    <label>Play Sound</label>
    <div class="form-fields">
      <input type="checkbox" name="playSound" {{checked playSound}}>
    </div>
    <p class="hint">Enable a sound effect when the wheel picks a token.</p>
  </div>

  {{! Sound Folder Path }}
  <div class="form-group">
    <label>Sound Folder Path</label>
    <div class="form-fields">
      <input type="text" name="soundPath" value="{{soundPath}}">
      <button type="button" class="file-picker" data-type="folder" data-target="soundPath"
              title="Browse Folder">
        <i class="fas fa-file-import"></i>
      </button>
    </div>
    <p class="hint">Folder path. The module picks one audio file at random.</p>
  </div>

  {{! Sound Channel }}
  <div class="form-group">
    <label>Audio Channel</label>
    <div class="form-fields">
      <select name="soundChannel">
        {{#each channelChoices as |label key|}}
          <option value="{{key}}" {{selected key soundChannel}}>{{label}}</option>
        {{/each}}
      </select>
    </div>
    <p class="hint">Channel used to play the sound. Each user controls channel volume in the Foundry mixer.</p>
  </div>

  <footer class="sheet-footer">
    {{! Preview button — does not save, just plays a sound immediately }}
    <button type="button" data-action="previewSound">
      <i class="fas fa-play"></i> Preview Sound
    </button>
    <button type="submit" name="submit">
      <i class="fas fa-save"></i> Save Changes
    </button>
  </footer>

</form>
```

---

## 4. Execution Order

Attack one menu at a time to keep diffs small and reviewable:

1. **Audio & Sound** (most changes: new setting, preview button, remove soundVolume from UI)
2. **Animation & Visual** (straightforward grouping)
3. **Dialogs & Chat** (straightforward grouping)
4. Clean up `init.js` — remove the grouped setting registrations and move them to `settings.js`
5. Register new CSS files and HBS templates in `module.json`
