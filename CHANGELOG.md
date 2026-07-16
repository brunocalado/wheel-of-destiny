# CHANGELOG

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
