# AssetSnap v0.3.0-CL

AssetSnap is a Tampermonkey userscript for quickly saving webpage images on macOS and Windows.

## Highlights

- Adds an editable filename prefix in the compact settings panel.
- The default prefix remains `AssetSnap`.
- Fixed naming structure remains `<prefix>#yyyy-MM-dd_HH-mm-ss[_NN].ext`.
- The `#` separator, timestamp, same-second suffix and final extension remain automatic.
- The edit button switches from `✎` to `✓` while editing.
- `Enter` saves a prefix edit; `Esc` cancels it.
- Invalid filename characters, `#`, unsafe leading/trailing characters and overly long prefixes are rejected.
- Existing v0.2.0 user preferences migrate without losing shortcut, output-format or UI-position settings.
- Existing image acquisition, high-resolution preference, format conversion and download feedback behavior is retained.

## Release files

- `AssetSnap_v0.3.0-CL.user.js` — Tampermonkey userscript.
- `AssetSnap_v0.3.0-CL.zip` — CL2 release bundle.
- `AssetSnap_使用手册_v0.3.0-CL.md` — current user manual.

## Compatibility

- macOS / Windows
- Chrome / Edge
- Tampermonkey

## Notes

AssetSnap uses the browser's default download directory. Image conversion is best-effort; if conversion cannot be completed, AssetSnap attempts to preserve download success by saving the original format instead.

This release does not add a full filename-template system, custom timestamp formats, site-specific adapters or custom absolute operating-system save paths.
