# AssetSnap v0.2.0-CL

AssetSnap is a Tampermonkey userscript for quickly saving webpage images on macOS and Windows.

## Highlights

- Compact draggable capsule UI.
- `D + Click` and continuous download modes.
- High-resolution/original-source preference.
- Hover resolution / source-quality feedback.
- Small download result preview card.
- Original / JPG / PNG output modes.
- Persistent user settings.
- Best-effort conversion with original-format fallback.
- Unified timestamp filenames such as `AssetSnap#2026-09-15_12-30-08.jpg`.

## Release files

- `AssetSnap_v0.2.0-CL.user.js` — Tampermonkey userscript.
- `AssetSnap_v0.2.0-CL.zip` — CL2 release bundle.
- `AssetSnap_使用手册_v0.2.0-CL.md` — current user manual.

## Compatibility

- macOS / Windows
- Chrome / Edge
- Tampermonkey

## Notes

AssetSnap uses the browser's default download directory. Image conversion is best-effort; if conversion cannot be completed, AssetSnap attempts to preserve download success by saving the original format instead.
