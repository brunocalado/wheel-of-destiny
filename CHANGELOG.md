# CHANGELOG

## 0.4.3

- **Breaking:** removed the automatic selection mode. A draw with no tokens staged no longer picks a pool on its own — it now asks. The `autoSelectBehavior` setting is gone, along with the "Custom Auto Select" dialog that let you pick a behavior per draw.
- Added the Choose Tokens picker: a window listing every token in the scene, opened whenever a GM starts a draw with fewer than two tokens selected on the canvas. With two or more selected, the draw still runs directly on that selection, as before.
- Added four filters to the picker, each detected from the current scene:
  - **Actor Type** — built from the actor types actually present, so system and module subtypes appear on their own, each with a count.
  - **Disposition** — Friendly, Neutral, Hostile, Secret.
  - **Player Link** — whether the token's actor is assigned to a Foundry user.
  - **Visibility** — Visible or Hidden.
- The filters are the selection tool, not just a view: the picker opens with the whole scene in the pool, and narrowing a filter drops whatever no longer matches. Filtering to Hostile, for example, deselects everything that is not hostile. Individual tokens can still be unticked by hand to carve out exceptions, until the next filter change re-derives the selection.
- Every token row shows its art, name, actor type, disposition, the linked user's name, and an icon for hidden tokens.
- Shift+F now always opens the picker, even when tokens are already selected — that is what distinguishes it from the toolbar button and the plain F keybinding.
- **Breaking:** `randomToken()` no longer takes a second argument. It was the auto-select override (`randomToken([], 'pcs')`), which no longer has anything to override — macros passing it will have it ignored. The token list argument (`randomToken(tokens)`) is unchanged and still bypasses the picker.
- **Breaking:** removed `WoD.customAutoSelectDialog()` from the macro API — the dialog it opened no longer exists. Use `WoD.openTokenPicker()` instead, which opens the token picker and draws from whatever you commit to it.
- Players are unaffected: a non-GM draw is still restricted to the user's own targets and never reaches the scene-wide pool.
- Fixed a draw on a token whose actor has been deleted throwing an error when Image Source is set to Actor Sheet Art. It now falls back to the token art.

## 0.4.2

- Redesigned the three settings menus (Audio & Sound, Animation & Visual, Dialogs & Chat) for a professional, high-contrast look.
- Replaced every checkbox with an Apple-style toggle switch.
- Removed the windows' transparency and backdrop blur: the settings menus now render on an opaque surface with their own text colors, so nothing on the canvas shows through.
- Raised text contrast well past WCAG AA — setting names and hints are now legible instead of dimmed, with the hierarchy between them carried by size and weight rather than faded color.
- Grouped the settings into labelled sections (Sound Playback, Result Dialog / Chat Message), each setting in its own bordered card, so it is clear which control and hint belong together.
- Split Animation & Visual into two tabs (Roulette, Selected Token), roughly halving the window's height. The other two menus hold three settings each and stay single-column. Save still writes every setting from either tab.
- Fixed setting names wrapping mid-phrase in the menu headers: the templates no longer use core's `standard-form` / `form-group` markup, which seated each label in a narrow column beside its control. Labels now own a full row.
- Renamed three settings that repeated the name of the section they now sit under: `Roulette - Animation Mode` → `Animation Mode`, `Roulette - Animation Delay` → `Delay Per Step`, `Roulette - Max Total Duration` → `Max Total Duration`. Setting keys and stored values are unchanged.

## 0.4.1

- Added `rouletteTotalDuration` setting (default: 2000ms, range: 500–10000ms) to cap the total time of the Native Glow roulette animation. If the number of tokens would cause the animation to exceed this limit, the per-step delay is automatically recalculated so the full animation stays within the configured duration.

## 0.4.0

- Removed socketlib dependency; real-time communication now uses Foundry VTT's native socket API (`game.socket.emit` / `game.socket.on`)
- Created `scripts/constants.js` as single source of truth for `MODULE_ID`
- Replaced all `'wheel-of-destiny'` string literals across `init.js` and `WoD.mjs` with imported `MODULE_ID` (settings, keybindings, socket events, asset paths)
- Added GPL-3 license header to all `.js` and `.css` files per project convention
- Replaced private API call `game.user._onUpdateTokenTargets()` with public `selectedToken.setTarget(true, { releaseOthers: true })`
- Scoped all CSS rules inside `.wheel-of-destiny { }` to prevent stylesheet leaks; added `<div class="wheel-of-destiny">` wrapper to all templates
- Fixed invalid `<body>` wrapper in `dialog.html` (template fragments must not use document-level tags)
- Renamed `WoD.mjs` → `wod.js` and `dialog_autoselect.html` → `dialog-autoselect.hbs` to comply with kebab-case file naming convention
- **Breaking:** the macro API moved from `window.game.wod` to the global `WoD` (e.g. `WoD.randomToken()`, `WoD.customAutoSelectDialog()`, `WoD.selectRandomToken(tokens)`). The old `game.wod` entry point was removed with no fallback — update existing macros.
- Converted all templates from `.html` to `.hbs`
- Removed support for external module Share Media
- Added a native, dependency-free "Native Glow" animation for the roulette using CSS and DOM overlay.
- Removed all dependencies, settings, code and assets related to the Sequencer module and JB2A.
- Reorganized module settings using `ApplicationV2` and `HandlebarsApplicationMixin`, grouping most settings into 3 dedicated menus (Audio & Sound, Animation & Visual, Dialogs & Chat).
- Added a new `soundChannel` setting to allow GMs to choose the audio channel (Interface, Music, Ambient, Effects).
- Added a "Preview Sound" button to the Audio & Sound menu for testing sounds before saving.
- Removed the `soundVolume` setting from the UI (now relies on Foundry's native volume mixer per client).
- Reduced chat message visual size: decreased `.wod-chat-container` font-size from `1.5em` to `1em`, margin from `0.5em` to `0.25em`, and `.wod-chat-image` max-width from `6em` to `3.5em`.
- Added support for non-GM players: players can now use the Wheel of Destiny button to randomly select from their targeted tokens.
- Replaced the `DialogV2` result prompt with a custom auto-closing overlay (3 seconds). The phrase and actor name are now cleanly overlaid directly onto the image, with no window title bar, buttons, or dark backdrop blocking the screen.

## 0.3.1

- Fix some CSS class names that conflicted with system classes

## 0.3.0

- v13

## 0.2.0

- v12
- small fix

## 0.1.8

- v11

## 0.1.7

- roulete animation improvement
- more options for auto select
- fix selectRandomToken
- dialog for custom auto select

## 0.1.6

- fix pan error, PepijnMC
- chat wait for roulete
- you can disable chat

## 0.1.5

- selectRandomToken api
- randomToken([]) api
- docs - readme
- roulete and panToToken fixes
- roulete animation options

## 0.1.4

- roulete improvement
- target token
- pan to token
- ping to token
- sound volume is client now

## 0.1.3

- small fixes
- token art or actor sheet art settings
- sequencer roulete

## 0.1.2

- token layer button gm only now
- immersive mode

## 0.1.0

-manifest fix
