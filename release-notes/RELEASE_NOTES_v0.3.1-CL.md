# AssetSnap v0.3.1-CL

AssetSnap is a Tampermonkey userscript for quickly saving webpage images on macOS and Windows.

## Highlights

- Fixes the practical shortcut conflict found on text-heavy pages such as ChatGPT, editors and search interfaces.
- Shortcut capture now supports a single letter / number **or** a modifier-only key: `Shift`, `Alt / Option`, `Control / Ctrl`, `Meta / Command`.
- Modifier-only shortcuts remain usable while a normal webpage text field still has focus.
- Letter / number shortcuts continue to respect input protection, preventing normal typing from triggering AssetSnap.
- macOS shortcut labels display `Option` / `Command`; the compact capsule uses concise symbols where useful.
- Default shortcut remains `D + Click`, so existing behavior is preserved unless the user changes it.
- Existing v0.3.0 editable filename-prefix behavior is unchanged.
- Existing preferences migrate from `settings_v3` / `settings_v2` / `settings_v1` to `settings_v4` without losing prior settings.

## Recommended use on ChatGPT-like pages

Open AssetSnap settings, click the current shortcut button, then press `Option` or `Shift` on macOS (or `Alt` / `Shift` / `Ctrl` on Windows). After saving, hold that modifier and left-click the target image.

Some websites or browsers reserve particular modifier-click combinations. If one key conflicts on a specific site, choose another supported modifier.

## Release files

- `AssetSnap_v0.3.1-CL.user.js` — Tampermonkey userscript.
- `AssetSnap_v0.3.1-CL.zip` — CL2 release bundle.
- `AssetSnap_使用手册_v0.3.1-CL.md` — current user manual.

## Compatibility

- macOS / Windows
- Chrome / Edge
- Tampermonkey

## Notes

This is a focused PATCH release. It does not add multi-key shortcut combinations or alter the v0.3.0 filename-prefix feature, image-source selection, format conversion, download flow, or save-location behavior.
