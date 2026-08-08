# Render harness

Renders the invitation flow from the command line so you can diff its HTML before
and after a change. **Studio does not need to be running.**

## Why

The flow template is ~2,900 lines of routing, CSS, injection, and IAPI wiring.
`composer test` stubs WordPress, so it cannot tell you whether a change altered the
actual output. This can, exactly, byte for byte.

It works because the Studio site at `~/Studio/alvey-clipisode` symlinks this plugin
and runs on **SQLite**. PHP reads `wp-content/database/.ht.sqlite` directly, so
nothing has to be listening on a port and the Studio app can stay closed — which
also avoids its battery drain.

## Use

```bash
tools/render-harness/render-all.sh /tmp/before
# ... make your change ...
tools/render-harness/render-all.sh /tmp/after
diff -rq /tmp/before /tmp/after
```

No output from `diff` means the change is output-neutral. Ten paths are rendered:
both intro variants (mobile and desktop), name, email, success, closed, and the four
warning screens.

Override the defaults with env vars:

| Var | Default | Notes |
|---|---|---|
| `WPROOT` | `~/Studio/alvey-clipisode` | Any SQLite-backed WP install with the plugin active |
| `SLUG` | first `open` invitation link in the DB | Set it to pin a specific topic |

For a single screen, call `render.php` directly — see the docblock at the top of it.

## What it is good for

- **Refactors that must not change output.** This is how the closure wrap around the
  template bodies was verified (2026-08-07): ten paths, byte-identical.
- **The intro-selection change** in
  `docs/specs/planned/cacheable-intro-screen-selection.md`. Its acceptance criterion
  is "byte-identical HTML for a desktop and a mobile user agent" — compare
  `mobile-intro.html` against `desktop-intro.html` in a single run.
- **Screen seed edits.** Reseed, re-render, and see precisely what moved.

## What it is not good for

Anything that needs a real browser or a real device: camera capture, the upload path,
IAPI hydration, CSS layout, or Interactivity API support on old Android. Use Studio
plus a hosted site for those.

## Two traps

- **`wp_is_mobile()` looks for the `Mobile/` token**, not `iPhone`. An abbreviated
  iPhone UA string silently exercises the desktop branch, which will make both intro
  renders look identical for the wrong reason. `render-all.sh` uses full UA strings.
- **WordPress requires `DB_NAME` / `DB_USER` / `DB_PASSWORD` / `DB_HOST` to be
  defined** even though the SQLite drop-in ignores them. Without the stubs in
  `render.php` you get "Error establishing a database connection" and no hint why.
