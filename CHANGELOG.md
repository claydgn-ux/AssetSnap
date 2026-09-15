# Changelog

All notable AssetSnap release changes are recorded here.

## v0.3.1-CL — 2026-09-15

### Added

- Shortcut capture now accepts modifier-only trigger keys: `Shift`, `Alt / Option`, `Control / Ctrl`, and `Meta / Command`.
- Platform-aware shortcut labels: macOS displays `Option` / `Command` and compact capsule symbols where appropriate.
- Settings migration from `settings_v3` / `settings_v2` / `settings_v1` to `settings_v4`.

### Changed

- Modifier-only shortcuts can arm AssetSnap even when a normal webpage input, textarea, select, or contenteditable element has focus.
- Letter and number shortcuts still respect input protection, so normal typing in ChatGPT, search boxes, editors, and forms is not intercepted.
- Shortcut setting guidance now explicitly lists supported letter, number, and modifier keys.
- Input-protection description now distinguishes text keys from modifier-only shortcuts.

### Retained

- Default shortcut remains `D + Click`.
- Existing continuous-download mode.
- v0.3.0 editable filename-prefix behavior and naming validation.
- Automatic timestamp, same-second suffix and final extension handling.
- Existing high-resolution source selection, conversion, download and feedback behavior.

### Not included

- Multi-key shortcut combinations such as `Option + D + Click`.
- Full filename templates.
- Custom separators or timestamp formats.
- Site-specific adapters.
- Custom absolute operating-system save paths.

## v0.3.0-CL — 2026-09-15

### Added

- Editable filename prefix in the settings panel.
- Current-prefix display with `✎` edit action and `✓` confirm action.
- `Enter` to save and `Esc` to cancel prefix editing.
- Live naming example while editing.
- Persistent `namingPrefix` preference with migration from `settings_v2` / `settings_v1` to `settings_v3`.
- Filename-prefix validation for invalid characters, `#`, unsafe edge characters and excessive length.

### Changed

- Download naming now uses `<user prefix>#yyyy-MM-dd_HH-mm-ss.ext` instead of always forcing `AssetSnap` as the prefix.
- “恢复默认设置” restores the filename prefix to `AssetSnap` together with the other defaults.

### Retained

- Automatic `#` separator.
- Automatic timestamp.
- Same-second suffixes `_01`, `_02`, etc.
- Final extension based on the actual saved format.
- Existing image-source selection, conversion and download behavior.

### Not included

- Full filename templates.
- Custom separators or timestamp formats.
- Site-specific adapters.
- Custom absolute operating-system save paths.

## v0.2.0-CL — 2026-09-15

### Added

- Compact draggable AssetSnap capsule UI.
- Continuous download mode integrated into the capsule.
- Compact settings popover.
- Hover feedback for intended source quality and dimensions when available.
- Download result card with thumbnail, dimensions, byte size, final format and conversion state when available.
- Output format options: original / JPG / PNG.
- Persistent output-format preference.
- Best-effort image format conversion with original-format fallback.
- Unified timestamp naming: `AssetSnap#yyyy-MM-dd_HH-mm-ss.ext`.
- Same-second suffixes `_01`, `_02`, etc.
- Full release identity shown in Tampermonkey.

### Changed

- Replaced the v0.1.0 large floating controls with a smaller Apple-style interaction surface.
- Download acquisition now remains higher priority than format conversion.

### Not included

- Site-specific adapters.
- Editable filename templates.
- Custom absolute operating-system save paths.
