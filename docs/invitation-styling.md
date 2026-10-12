# Invitation styling

Invitation screens inherit the active WordPress site's typography, headings, links, and Button block styles. WordPress combines `theme.json`, the selected style variation, and Site Editor changes through its Global Styles API. Classic themes retain their normal front-end styles and inherited typography. Clipisode supplies the full-screen layout and touch-friendly form structure rather than a separate brand font or button palette.

## Site-wide controls

Use normal `theme.json` styles for site typography, colors, `styles.elements.button`, and `styles.blocks["core/button"]`. These styles also apply to invitation blocks. Configure runtime fields and upload progress through `settings.custom.clipisode.invitation`:

```json
{
  "version": 3,
  "settings": {
    "custom": {
      "clipisode": {
        "invitation": {
          "background": "#182738",
          "text": "#f4f1e8",
          "link": "#ffca50",
          "accent": "#ffca50",
          "border": "#83919e",
          "radius": "6px"
        }
      }
    }
  }
}
```

All six keys are optional CSS values. CSS preset references such as `var(--wp--preset--color--accent)` work here. Background and text come from site global styles; link comes from the site's link element. Accent and radius come from the Button block or button element styles. An unspecified border uses the inherited text color. Without a declared site style, surfaces and text inherit from their parent and controls use a neutral radius.

The resulting properties are named `--clipisode-invitation-background`, `--clipisode-invitation-text`, `--clipisode-invitation-link`, `--clipisode-invitation-accent`, `--clipisode-invitation-border`, and `--clipisode-invitation-radius`. A classic theme can set these properties on `body.clipisode-flow` in its stylesheet too.

## Clipisode invitation themes

Edit a theme's Screens in the block editor to customize its headings, buttons, backgrounds, images, and other blocks. Explicit block styles and preset classes take precedence over Clipisode's low-specificity defaults. The default upload progress blocks use invitation tokens; assigning their own colors in the editor overrides them. Existing authored screen styles are preserved.

For theme-wide runtime control customization, use the `clipisode_invitation_style_tokens` filter in a site theme or plugin. Its second argument is the parent `clipisode_invite` post ID, so overrides can be scoped to one invitation theme. The filter runs for both the public flow and the screen editor:

```php
add_filter( 'clipisode_invitation_style_tokens', function ( array $tokens, int $theme_id ): array {
    if ( 123 === $theme_id ) {
        $tokens['accent'] = '#c53570';
        $tokens['radius'] = '0';
    }
    return $tokens;
}, 10, 2 );
```

Public invitation bodies also have a `clipisode-invitation-theme-123` class for theme-specific CSS. Invitation themes are separate from video composition themes: video theme settings do not change the website.

## Verification

Run `wp eval-file plugin/clipisode/tests/wordpress/invitation-styles.php` on a test WordPress site with Clipisode active. This checks resolved site styles, Site Editor precedence, Button block precedence, custom invitation settings, and isolated Clipisode theme overrides using WordPress's real APIs. It leaves posts, options, and theme files unchanged.
