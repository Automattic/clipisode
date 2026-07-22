---
status: planned
version: 0.1
last_updated: 2026-04-16
related: []
---

# Migrate to Gutenberg-Native Admin Shell

Replace VIP Workflow's custom fullscreen admin shell (custom sidebar, custom CSS overrides, custom routing) with the native WordPress admin shell pattern used by the Site Editor (Appearance > Design).

## Why

The current shell is ~460 lines of custom CSS (`layout.css`) plus custom React components (`AppShell.js`, `Sidebar.js`) that duplicate what WordPress core already provides. This creates:

- **Maintenance burden.** Every WP core update can break our `!important` overrides that hide `#adminmenumain`, `#wpadminbar`, `#wpfooter`, etc.
- **Plugin page hacks.** Third-party plugin pages require fixed positioning, output buffering, and body class juggling (`is-workflow-plugin-page`).
- **Accessibility gaps.** The native shell uses `NavigableRegion` for landmark-based keyboard navigation. Our custom sidebar uses basic `<nav>` with manual button handling.
- **Inconsistent UX.** Users who know the Site Editor's navigation pattern get a different interaction model in VIP Workflow.

## Target Architecture

Use the same shell pattern as `wp-admin/site-editor.php`:

1. **`@wordpress/router`** for client-side navigation (replaces our `?page=vip-workflow-*` full page loads)
2. **`@wordpress/components` layout primitives** (`NavigableRegion`, `NavigatorProvider`, `NavigatorScreen`) for sidebar + content layout
3. **`is-fullscreen-mode` body class** (keep, this part is standard)
4. **WordPress core CSS** handles hiding admin chrome when `is-fullscreen-mode` is set (delete our custom overrides)

### What the Site Editor Does

```
PHP:
  - Registers one admin page (site-editor.php)
  - Adds is-fullscreen-mode body class
  - Renders minimal HTML container
  - Enqueues @wordpress/edit-site scripts

React:
  - @wordpress/router handles all navigation via history API
  - NavigableRegion wraps sidebar and content for a11y
  - Sidebar uses NavigatorProvider/NavigatorScreen for drill-down nav
  - Content area renders based on route
  - No custom CSS to hide WP chrome (core handles it)
```

## What Changes

### PHP (`class-admin.php`)

**Before:** Registers 15+ separate `add_submenu_page()` calls, each with its own render callback that outputs `<div id="vip-workflow-root">`.

**After:** Register a single top-level admin page. All "pages" become client-side routes.

- Keep `is-fullscreen-mode` body class filter (this is the standard mechanism)
- Remove all individual `render_*_page()` methods
- Remove `render_plugin_page_shell()` and output buffering for plugin pages
- Single render method outputs `<div id="vip-workflow-root"></div>`
- Localize route config (menu items, permissions) to JS

### React Components

**Delete:**
- `src/admin/components/AppShell.js` (custom shell with manual routing)
- `src/admin/components/Sidebar.js` (custom sidebar)
- `src/admin/components/ErrorBoundary.js` (replace with standard pattern)

**Create:**
- `src/admin/components/Layout.js` using `NavigableRegion` for sidebar/content regions
- `src/admin/components/SidebarNavigation.js` using `NavigatorProvider` + `NavigatorScreen`
- `src/admin/components/Router.js` using `@wordpress/router`

**Update:**
- `src/admin/index.js` to mount the new shell with `RouterProvider`
- All page components to work as route targets instead of switch-case renders

### CSS (`layout.css`)

**Delete entirely.** The ~460 lines of `!important` overrides for `#adminmenumain`, `#wpadminbar`, `#wpcontent`, `#wpfooter`, `#wpwrap`, plus all custom sidebar styling, content area styling, and plugin page fixed positioning.

**Replace with:** Minimal CSS that styles VIP Workflow's content within the native shell frame. The dark sidebar, rounded content area, and branding can remain as design choices, but built on top of the native components, not by overriding core elements.

### Plugin Page Integration

**Before:** Extension plugins register `add_submenu_page()` under `vip-workflow`, get body class `is-workflow-plugin-page`, content rendered via output buffering into a fixed-position container.

**After:** Extension plugins register via `vip_workflow_register_routes` filter, providing a route path and React component. Plugin pages render as native routes within the shell, same as core pages.

For PHP-only plugins that can't provide a React component, provide an `<iframe>` adapter route that loads their `admin.php` page within the content area (same pattern Site Editor uses for legacy screens).

## Migration Path

### Phase 1: Adopt `@wordpress/router`

Replace the `?page=` based routing with `@wordpress/router`. Keep the existing visual shell for now, but switch the navigation mechanism.

- Install/verify `@wordpress/router` dependency
- Replace `onNavigate` callbacks with router navigation
- Update `AppShell.js` to read route from router instead of `URLSearchParams`
- PHP: Reduce to single admin page registration, use `add_rewrite_rule` or hash routing for deep links

### Phase 2: Replace Custom Shell with Native Layout

Swap the custom `AppShell` + `Sidebar` components for native Gutenberg layout primitives.

- Build `Layout.js` with `NavigableRegion` for sidebar and content
- Build `SidebarNavigation.js` with `NavigatorProvider`/`NavigatorScreen`
- Delete `AppShell.js`, `Sidebar.js`
- Delete `layout.css` overrides, write minimal replacement CSS

### Phase 3: Migrate Plugin Page Integration

Update the extension plugin integration to use the new route-based system.

- Add `vip_workflow_register_routes` filter
- Migrate `workflow-tool-*` plugins to register routes
- Build iframe adapter for PHP-only plugin pages
- Remove output buffering and `is-workflow-plugin-page` body class handling
- Update `PLUGIN-INTEGRATION.md`

## Key Decisions Needed

1. **Hash vs history routing.** The Site Editor uses history API with `site-editor.php` as the base. We could do the same with `admin.php?page=vip-workflow` as base. Hash routing (`#/dashboard`) is simpler but less native.

2. **Sidebar visual style.** Keep the dark sidebar (#1e1e1e) as brand differentiation, or adopt the native Site Editor light sidebar for maximum consistency?

3. **NavigatorProvider drill-down.** The Site Editor sidebar supports drill-down navigation (click "Templates" to see template list). Do we need this, or is our flat section-based nav sufficient?

4. **Plugin page backward compatibility.** How long to support the old `add_submenu_page()` integration? Immediate break, deprecation period, or permanent iframe adapter?

## Files Affected

| Action | File |
|--------|------|
| Heavy edit | `includes/admin/class-admin.php` |
| Delete | `src/admin/components/AppShell.js` |
| Delete | `src/admin/components/Sidebar.js` |
| Delete/rewrite | `src/admin/layout.css` |
| Edit | `src/admin/index.js` |
| Create | `src/admin/components/Layout.js` |
| Create | `src/admin/components/SidebarNavigation.js` |
| Create | `src/admin/components/Router.js` |
| Edit | All `src/admin/pages/*.js` (remove `onNavigate` prop, use router) |
| Edit | `docs/APPSHELL-MIGRATION.md` (update or delete) |
| Edit | `docs/PLUGIN-INTEGRATION.md` |

## References

- [`wp-admin/site-editor.php`](https://github.com/WordPress/wordpress-develop/blob/trunk/src/wp-admin/site-editor.php)
- [`@wordpress/edit-site` layout](https://github.com/WordPress/gutenberg/tree/trunk/packages/edit-site/src/components/layout)
- [`@wordpress/router`](https://github.com/WordPress/gutenberg/tree/trunk/packages/router)
- [`@wordpress/components` NavigableRegion](https://github.com/WordPress/gutenberg/tree/trunk/packages/components/src/navigable-container)
