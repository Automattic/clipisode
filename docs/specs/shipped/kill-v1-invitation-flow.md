---
status: shipped
version: 1.0
last_updated: 2026-05-06
related:
  - docs/specs/planned/short-invitation-urls.md
  - plugin/clipisode/assets/themes/default/README.md
---

# Kill the v1 Invitation Flow — shipped

The plugin previously ran two parallel invitation flows:

- **v1 (legacy)** — `/invitation/<slug>` (default), template `assets/templates/invitation.php`. Older PHP+CSS rendering path that predated Gutenberg-driven screens. Used a tree of custom Gutenberg blocks (`clipisode/invitation-flow` + four stage blocks + `clipisode/element`) seeded into a `clipisode_invite` (Theme) post.
- **v2 (current)** — `/clipisode-flow/<slug>`, template `assets/templates/clipisode-flow.php`. Gutenberg-driven; consumes `clipisode_screen` posts (per-screen block markup) parented under a `clipisode_invite` Theme post via `topic.invitation_id`.

After the cutover, **the configurable invitation prefix routes directly to v2's template**. The prefix admin setting (`clipisode_invitation_prefix`, default `invitation`) remains the localization escape hatch — non-English sites can serve the flow at `/invitasjon/`, `/邀請/`, etc.

## What changed (commit history)

### Phase 1 — Cutover

- `Clipisode_Invitation::register_rewrite()` now declares one rule, at `get_prefix()`, mapping to `clipisode_invite=$matches[1]`. The hardcoded `^clipisode-flow/...` rewrite was deleted.
- `add_query_vars` registers only `clipisode_invite`. The `clipisode_flow` query var was renamed to `clipisode_invite` everywhere it was read (template, render-block filter, docs).
- `template_include` only handles `clipisode_invite`; route always resolves to `assets/templates/clipisode-flow.php`.
- `clipisode.php` gained an upgrade-time rewrite-rule flush keyed on `CLIPISODE_VERSION` so the cutover takes effect on plugin upgrade without manual intervention. Activation- and deactivation-time flushes still exist as belts-and-braces.

### Phase 2 — v1 template + REST audit

- `plugin/clipisode/assets/templates/invitation.php` (124 lines) deleted.
- `Clipisode_Invitation::register_routes()` (REST endpoints `/clipisode/v1/invitation/upload` and `/submit`) confirmed shared — `src/flow/view.ts` (since deleted) and any v2 client JS hit them. Endpoints stayed in place.

### Phase 3 — v1 blocks + editor experience

- Deleted source dirs: `src/blocks/stage-desktop/`, `src/blocks/stage-landing/`, `src/blocks/stage-record/`, `src/blocks/stage-thanks/`, `src/element/`, `src/flow/`.
- Deleted build outputs: `build/blocks/`, `build/element/`, `build/flow/`.
- `Clipisode_Invitation::register_blocks()` removed — there's nothing left to register. The `init` action wiring was removed from `clipisode.php`.
- `clipisode_invite` CPT lost `editor` support. The Theme post is now title-only — there's no block content for authors to edit since the screens are the editable surface, not the Theme post itself.
- `PostTypesTest::test_invite_supports_editor` updated to assert the new shape (`assertFalse`).

### Phase 4 — Seed cleanup

- `Clipisode_Post_Types::ensure_default_invitation()` no longer seeds the v1 stage-block heredoc. New default-Theme posts get empty `post_content`. Existing default-Theme posts on live sites still have v1 markup in `post_content` — it's harmless dead text; never rendered, parsed, or shown to anyone since `editor` support is gone. Not worth a one-shot upgrade routine.
- Detection-vs-rewrite branch in `ensure_default_invitation()` simplified: an existing default-theme post is always reused in-place. The "post_content doesn't match expected shape — auto-rewrite" branch is gone since author edits are no longer possible.

### Phase 5 — CSS sweep

- All `.ci-*` selectors were in `src/flow/view.css`, deleted with the directory in Phase 3. No standalone v1 stylesheet survived.

### Phase 6 — Docs + UI text

- Settings page → Invitation URL Prefix help text mentions localized prefixes and that saving rebuilds rewrite rules automatically.
- This spec moved from `planned/` to `shipped/`.
- `assets/themes/default/README.md` and `intro_desktop.md` doc references that mentioned `clipisode_flow` query var or `/clipisode-flow/` route were updated.

## Audit corrections vs. the original plan

The planning doc made two assumptions that turned out to be wrong:

1. **`clipisode_invitation_links` is shared, not v1-specific.** v2's `clipisode-flow.php` reads it; REST endpoints write to it. Stayed in place. No DB migration needed.
2. **`clipisode_invite` CPT (the Theme container) is not v1.** It's how v2 organizes screen sets. The CPT itself stays; only the v1 stage-block content seeded into it goes away. (Originally we considered killing the CPT entirely, but that would require rebuilding v2's themes architecture — separate spec.)

## Things that didn't break

- The invitation prefix admin setting still works post-cutover; saving flushes rewrite rules automatically.
- The editor preview simulator's `{invitation_url}` already used `get_prefix()`, so it kept matching the live URL with no theme changes.
- Existing live sites with old default-Theme posts (containing v1 stage-block markup) still work — that markup never reaches a renderer, never reaches an editor, never reaches an author.

## Out of scope (future work)

- Short URL handling. See `docs/specs/planned/short-invitation-urls.md`.
- Killing the `clipisode_invite` CPT. Would require rebuilding the themes architecture; if and when that happens, screen parenting needs a new model (parented-by-topic? globally scoped? `clipisode_theme` rename?).
- Renaming `clipisode_flow_show_debug` and other PHP-internal `$clipisode_flow_*` variable names in `clipisode-flow.php`. Internal naming, no functional bearing.
