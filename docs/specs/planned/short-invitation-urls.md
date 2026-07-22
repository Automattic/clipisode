---
status: planned
version: 0.1
last_updated: 2026-05-05
related:
  - docs/specs/planned/kill-v1-invitation-flow.md
  - plugin/clipisode/assets/themes/default/README.md
---

# Short Invitation URLs

Customers want to share invitation links from a short, brand-aligned domain instead of the full WordPress URL. Example:

- Long URL (canonical): `https://rollingstone.com/invitation/abc123/`
- Short URL (shareable): `https://rs.video/i/abc123/`

The short URL should redirect (301) to the long URL. The customer points both domains at the same WordPress install; the plugin handles the short host as a redirect-only entry point.

## Architecture: pointing two domains at one WordPress site

There are four ways to do this; we're recommending option **C** for MVP.

### A) Multisite + domain mapping

Run WordPress as a Multisite network. Use the built-in domain mapping (since 4.5) to assign both domains to the same site. WordPress detects the host and serves accordingly.

- **Pros:** Native, well-documented.
- **Cons:** Multisite is heavyweight. Most customers aren't running it for other reasons.

### B) Web server / reverse proxy redirects

Both domains DNS-point at the same web server. The web server's vhost config matches `Host: rs.video` and serves a redirect rule before WordPress boots:

```nginx
server {
    server_name rs.video;
    location ~ ^/i/([a-zA-Z0-9]+)/?$ {
        return 301 https://rollingstone.com/invitation/$1/;
    }
    location / {
        return 301 https://rollingstone.com/;
    }
}
```

- **Pros:** Fast (no PHP boot). Survives WordPress outages.
- **Cons:** Requires server-config access. Doesn't work on shared hosting. Customer-by-customer setup; not a plugin-shippable feature.

### C) Single-site + plugin-handled host detection (RECOMMENDED)

Both domains DNS-point at the same WordPress site. WordPress's canonical home is the long domain (`siteurl` / `home` options point at `rollingstone.com`). When a request comes in with `Host: rs.video`, the plugin intercepts on `parse_request` (early enough to beat WordPress's canonical-URL redirect) and either redirects to the long URL or 404s.

```php
add_action( 'parse_request', function ( $wp ) {
    $host = isset( $_SERVER['HTTP_HOST'] ) ? strtolower( $_SERVER['HTTP_HOST'] ) : '';
    $short_host = strtolower( wp_parse_url( Clipisode_Invitation::get_short_url_base(), PHP_URL_HOST ) ?? '' );
    if ( ! $short_host || $host !== $short_host ) {
        return;
    }
    $request_path = isset( $_SERVER['REQUEST_URI'] ) ? wp_parse_url( $_SERVER['REQUEST_URI'], PHP_URL_PATH ) : '';
    if ( preg_match( '#^/i/([a-zA-Z0-9]+)/?$#', $request_path, $m ) ) {
        $slug = $m[1];
        $long = home_url( '/' . Clipisode_Invitation::get_prefix() . '/' . $slug . '/' );
        wp_redirect( $long, 301 );
        exit;
    }
    // Short host hit a non-invitation path. Bounce to canonical home.
    wp_redirect( home_url( '/' ), 301 );
    exit;
}, 1 );
```

The action priority `1` runs before WordPress's canonical-redirect logic (priority 10).

- **Pros:** Single plugin file. Works on any WordPress hosting. No customer server-config required.
- **Cons:** WordPress fully boots before the redirect. Adds ~50-100ms vs. options A/B.

### D) CDN-level redirects

If the customer fronts both domains with a CDN (Cloudflare, CloudFront, Fastly), a redirect rule at the edge handles `rs.video/i/*` → long URL without ever touching WordPress.

- **Pros:** Fastest possible.
- **Cons:** CDN-specific; not portable across hosting setups.

We document option D as an optional optimization customers can layer on top of option C.

## Plugin changes for option C

### 1. Admin setting for the short URL base

Add to the Clipisode Settings page:

- **Field:** Short URL base (text input)
- **Storage:** option `clipisode_short_url_base`
- **Format:** Full URL with optional path prefix, e.g. `https://rs.video/i`. Trailing slashes stripped on save.
- **Validation:** Must parse as a URL with a host. Empty allowed (disables the feature).
- **Help text:** "If you've pointed a short domain at this site (e.g. rs.video), enter the full base here including the short path prefix. Invitations will redirect from this URL to the long version."

### 2. `Clipisode_Invitation::get_short_url_base()` returns the option

Today's stub:

```php
public static function get_short_url_base(): string {
    return '';
}
```

Update to:

```php
public static function get_short_url_base(): string {
    $value = get_option( 'clipisode_short_url_base', '' );
    if ( ! is_string( $value ) ) {
        return '';
    }
    return rtrim( trim( $value ), '/' );
}
```

### 3. Runtime token substitution

`assets/templates/clipisode-flow.php` currently calls `set_flow_topic_context()` with six tokens. Add a seventh:

```php
'invitation_short_url' => self::build_short_invitation_url( $slug ),
```

Where `build_short_invitation_url()` is:

```php
public static function build_short_invitation_url( string $slug ): string {
    $base = self::get_short_url_base();
    if ( $base === '' ) {
        return self::build_invitation_url( $slug );
    }
    $slug = trim( $slug, "/ \t\n\r\0\x0B" );
    if ( $slug === '' ) {
        return '';
    }
    return $base . '/' . $slug . '/';
}
```

(Note: `build_invitation_url()` was added in an earlier iteration and removed when the preview generator stopped depending on it. If it's not in the codebase when you implement this, restore it from the patterns in `Clipisode_Invitation` — `home_url( '/' . self::get_prefix() . '/' . $slug . '/' )`.)

### 4. Host-based redirect handler

Hook `parse_request` at priority 1 with the snippet shown in section C above.

### 5. Editor preview simulator

Already wired. `preview-values.json` declares:

```json
"invitation_short_url": {
    "template": "{short_url_base}/{invitation_slug}/",
    "fallback": "{invitation_url}"
}
```

Once `Clipisode_Invitation::get_short_url_base()` returns a non-empty value, the editor preview will show the short URL form. While it's empty (the default), it falls back to the long URL — same behavior the runtime substitution (step 3) implements. So the editor preview always matches what guests will see.

### 6. Documentation

- `plugin/clipisode/assets/themes/default/README.md` — already mentions `{invitation_short_url}`. Confirm wording matches the runtime behavior once shipped.
- `plugin/clipisode/AGENTS.md` — add a note about the host-based redirect pattern so future agents understand the dual-domain architecture.

## Edge cases worth deciding before shipping

1. **HTTPS on the short domain.** Customer's responsibility — they need a TLS cert that covers the short domain. The plugin doesn't do anything special here.

2. **Short URL pointing at an invitation that's been deleted.** Currently the long URL would render the closed-screen template (or 404). The redirect itself doesn't know — it 301s to the long URL and lets the long URL handle the missing-invitation case. That's correct.

3. **Caching.** A 301 from `rs.video/i/abc123/` to `rollingstone.com/invitation/abc123/` is permanent — browsers and CDNs will cache it indefinitely. Make sure `abc123` slugs are stable for the lifetime of the invitation; reusing a slug for a different invitation would route to the wrong place from cached redirects.

4. **Subpath hosts.** Customer might want `rs.video/<customer>/i/abc123/` on a multi-tenant short domain. The current `get_short_url_base()` design supports any path prefix the customer enters, so this works without code changes.

5. **rs.video pointing at a 404 default.** When the short domain hits a path that isn't `/i/<slug>/`, the handler bounces to `home_url( '/' )` (long domain). Some customers might prefer a hard 404 instead. Add a setting if it comes up.
