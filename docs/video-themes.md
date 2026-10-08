# Video themes supplied by plugins

Clipisode video themes can be registered by a separate WordPress plugin. Definitions control the editor's fields, clip tags, media slots, card timing, canvas, and default values. A theme can use a built-in renderer or supply its own card and overlay components.

## Start a theme

Install `plugin/clipisode` in `wp-content/plugins/` and activate it. Install `plugin/clipisode-community-theme` beside it, then activate that plugin. Open a Clipisode composition and select **Community** under **Video theme**. Edit `theme.json` in your plugin repo and reload the editor to see changes. This plugin uses the built-in `branded` renderer and needs no JavaScript build.

For a fully custom design, install `plugin/clipisode-studio-theme`. It registers its own renderer script and draws custom cards and overlays in `renderer.js`. Both theme plugins declare `Requires Plugins: clipisode`, so WordPress requires the main plugin to be active before activation.

The example registers its definition with `clipisode_composition_themes`:

```php
add_filter( 'clipisode_composition_themes', function ( array $themes ): array {
	$themes[] = json_decode( file_get_contents( __DIR__ . '/theme.json' ), true, 512, JSON_THROW_ON_ERROR );
	return $themes;
} );
```

Use a unique, stable lowercase ID and a version for every plugin theme. The catalog rejects duplicate IDs and custom renderers without a script URL. Saved compositions keep the theme ID and version. If the plugin is disabled or its version changes, Clipisode reports that requirement instead of rendering the composition with a different design. For a new design, register a new ID and retain the old definition and script for existing compositions.

## Definition contract

`theme.json` describes one theme object:

| Key | Purpose |
| --- | --- |
| `id`, `version`, `label`, `description` | Stable identity, version, and text shown in the editor. |
| `renderer` | Built-in renderer name or custom renderer ID. |
| `rendererUrl` | Public HTTP(S) script URL required for a custom renderer; add it in PHP with `plugins_url()`. |
| `canvas` | Solid background or the field supplying its color. |
| `timeline` | Opening and ending cards, sequence and background media slots. |
| `tags` | Clip classification and placement rules. |
| `groups` | Composition and per-clip controls, their types, defaults, and conditional visibility. |

See `plugin/clipisode/src/remotion/types.ts` for the TypeScript shapes and `plugin/clipisode/assets/composition-themes.json` for complete working definitions. A renderer expects the fields used by its visuals. For example, `branded` uses `title`, `endingText`, `accentColor`, `backgroundColor`, `textColor`, `fontFamily`, `logoUrl`, and `showNames`; the Community example declares all of them.

The same registered catalog reaches PHP composition validation and the admin editor. When a local render starts, Clipisode sends the selected definition with the job so its timeline and artwork use the same schema. Browser preview and export read the catalog embedded in the admin page.

## Custom rendering code

A custom script registers `Card` and `Overlay` components with `window.ClipisodeThemeAPI.registerRenderer(rendererId, { Card, Overlay })`. The API exposes the same `React` and `Remotion` instances Clipisode uses; build your script as a browser script that uses those instances instead of bundling duplicate copies. `Card` receives `{ settings, kind, hasBackground }`; `Overlay` receives `{ settings, name, clip }`. See the Studio example for a complete script that runs without a build step. A TypeScript/TSX project can compile to the same script shape.

The script URL must be reachable from the browser and the local renderer. Loading failures are shown as render errors. Keep older theme IDs and scripts available while saved compositions use them. The UI code editor is planned later; a plugin repo is the current authoring and deployment path.
