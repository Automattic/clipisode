# Clipisode Studio Video Theme

Copy this directory to `wp-content/plugins/clipisode-studio-theme` and activate it after Clipisode. Select **Studio** in a composition's **Video theme** control.

`theme.json` declares the editor fields and timeline. `clipisode-studio-theme.php` registers that definition and the public URL of `renderer.js`. The script registers custom `Card` and `Overlay` components with `window.ClipisodeThemeAPI`. It draws the opening and ending cards and speaker name plate during preview and export. Edit `renderer.js` and reload the editor to see changes.

The script is plain JavaScript so the example works without a build step. For a larger theme, author components in TypeScript/TSX and build a browser script that uses the `React` and `Remotion` instances supplied by `ClipisodeThemeAPI`. See `docs/video-themes.md` for the contract.
