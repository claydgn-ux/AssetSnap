# Changelog

All notable AssetSnap release changes are recorded here.

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
