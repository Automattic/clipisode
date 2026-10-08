# Clipisode Community Video Theme

Copy this directory to `wp-content/plugins/clipisode-community-theme` and activate it after Clipisode. The **Community** video theme then appears in the video theme picker. Its full theme definition lives in `theme.json`; no Clipisode source edit or JavaScript build is needed.

The definition controls the video theme's fields, defaults, tags, clip slots, and timeline. It uses Clipisode's `branded` renderer. Change the color defaults or add supported fields to start customizing it. The built-in `default` definition in `plugin/clipisode/assets/composition-themes.json` is the reference for this renderer.

The `clipisode_composition_themes` filter receives the complete catalog. Append a definition with a unique ID. Saved compositions depend on that ID; leave the plugin active while those compositions are in use. If the plugin is deactivated, Clipisode reports the missing video theme rather than substituting another one.

For custom Remotion components, see `plugin/clipisode-studio-theme`.
