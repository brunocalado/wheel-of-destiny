# CHANGELOG

## 0.4.6

- The Choose Tokens picker can now weight the draw. Every row ends in a chance column — **+**, the odds, **−** — where each token starts with a single chance and an even share of the draw, `+` gives it another and `−` takes one back, down to a floor of one. The percentages of everyone in the draw are recalculated on every change, so three chances against one other token reads as the 75% it is. A row that is out of the draw shows what it is worth (`×3`) instead of a percentage, so nothing set is lost by unticking it or filtering it out. The buttons only ever change that number — they never add a token to the draw or drop it from one. Chances last as long as the window does; **Reset** clears them along with the filters.
- The Choose Tokens list now follows the scene while it is open. A token added to the scene appears in the list (joining the draw if it passes the active filters), a deleted one leaves it, and an edit to a token's name, art, disposition, visibility or actor is reflected on its row. Previously the list was built once when the window opened, so a deleted token stayed on offer for the draw and a newly placed one never showed up. The pool is preserved across the rebuild — hand-unticked rows stay unticked and every chance is kept — and only the fields the list actually shows trigger it, so dragging a token around the map costs nothing. A batch of tokens created or deleted at once rebuilds the list once, not once per token.
- `WoD.randomToken()` and `WoD.selectRandomToken()` now take those chances as an optional weights map keyed by token id (a `Map` or a plain object; anything left out gets a single chance) — `WoD.randomToken(list, { weights })` and `WoD.selectRandomToken(list, weights)`. Called without one, both stay exactly as uniform as they were.
- Added `WoD.promptForPool()`: the same picker as `WoD.promptForTokens()`, but it hands back `{ tokens, weights }` so the chances survive the trip to `WoD.randomToken()`. `WoD.promptForTokens()` still returns a plain token list.
- Widened the picker's default window width (420px → 480px) to fit the chance column. A window that has already been resized keeps whatever width it was left at.
- Removed core's orange focus/active ring from the buttons inside the module's own windows, where it lingered after every click and stuck permanently to anything carrying the `active` class. Scoped to the module — core's UI, the system and every other module keep theirs.
- Gave the secondary buttons a hover state (Reset/All/None in the picker, Preview Sound in the audio settings): the accent on the border and the label over a lighter surface, matching the picker's icon buttons. They had none of their own and were relying on core's, which the module opts out of. A disabled Draw button no longer brightens under the pointer either.
- Squared off the picker's filter chips: a 4px soft corner instead of a full pill, matching the token rows in the list below. Their labels are now centred by flexbox over a `line-height: 1` box rather than by leading, which had been placing the text 1.7px above the middle of every chip and segment button.
- https://github.com/brunocalado/wheel-of-destiny/issues/14

## 0.4.5

- css fix
- assets updated 

## 0.4.4

- The Choose Tokens picker now remembers its filters, window position, and window size per client between openings. If the remembered filters would leave nothing to select in the current scene, they reset to their defaults instead of opening onto an empty pool.
- Canvas and picker selection now mirror each other while the picker is open: controlling or releasing a token on the canvas (click, shift+click, rubber-band select) adds or drops it from the pool, widening only whichever filter(s) were hiding it rather than re-deriving the whole selection — the same way ticking a row controls or releases the matching token on the canvas. Whatever was controlled on the canvas before the picker opened is restored once it closes, so this never leaks into `WoD.randomToken()`'s own use of the canvas selection.
- Added a locate button to each row in the picker: pings and pans every connected view to that token.
- Added a help icon to the picker's toolbar, explaining that shift+click — not a plain click — adds or removes one token from the canvas selection without losing the rest.
- Disposition badges in the picker now show an emoji (🙂 Friendly, 😐 Neutral, 😠 Hostile, 🎭 Secret) instead of text; the player-link badge is now icon-only. Both still show the full name on hover.
- Selected rows in the picker now get a subtle background and border highlight, in addition to the checkbox.
- Narrowed the picker's default window width (540px → 420px).
- Fixed `ChatMessage.create()` omitting `rolls`, which crashed draw results under systems (e.g. Daggerheart) whose `ChatMessage` document-class override reads `source.rolls.length` during document creation without guarding for it being absent.

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
