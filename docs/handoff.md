# Clipisode → WordPress: Project Handoff Overview

**Audience:** a new developer and their coding agent (any LLM/tooling), starting cold on this repository.
**Last updated:** 2026-07-21.
**Repository:** `clipisode` (this repo). Everything referenced below is a path inside it.

---

## 1. What Clipisode is

Clipisode was a standalone social-video platform. Brands and hosts created video prompts ("topics"), shared **invitation links**, and collected vertical video replies from fans through a tightly-controlled mobile web flow — no app install required. Replies landed in a moderation portal, and approved replies could be composited together with the host's intro video into a single published show: an episode of clips, a "clipisode."

**This project rebuilds that platform as a WordPress plugin.** The goals:

- Topics, invitation links, replies, and rendered outputs managed inside WP Admin (React admin app).
- The guest-facing invitation flow served by WordPress at a configurable URL prefix (default `/invitation/<slug>`), rendered from **Gutenberg block templates** so every screen is brand-customizable in the WordPress block editor — no JSON config files like the old platform.
- Video compositing done by a companion **macOS menu-bar app** (Swift/AVFoundation) that talks to the plugin over local WebSocket + HTTP.

The old platform's screen inventory, behavior, and customization surface are documented in `docs/specs/research/invitation-link-cpts/old-clipisode-theme-documentation.md` (old JSON config reference) and `docs/specs/research/invitation-link-cpts/reset-invitation-link-customization.md` (the product brief for how customization should work in WordPress). Read both — they are the closest thing to a product spec for the invitation flow.

## 2. Repository map

```
clipisode/
├── plugin/clipisode/          # The WordPress plugin (PHP + React + block templates)
│   ├── clipisode.php          # Main plugin file: hooks, activation, rewrite flush
│   ├── includes/              # PHP classes (all prefixed Clipisode_)
│   │   ├── class-database.php     # Custom table schema (dbDelta)
│   │   ├── class-post-types.php   # CPTs, screen seeding, editor canvas CSS, block filters (~3,600 lines — the heart of the editor experience)
│   │   ├── class-invitation.php   # Public invitation route, rewrite, upload/submit REST
│   │   ├── class-rest-api.php     # All admin REST endpoints
│   │   ├── class-admin.php        # Admin menus, React app bootstrap
│   │   ├── class-media.php        # Video/media storage abstraction
│   │   └── class-preview.php      # Clipisode preview pages (output review)
│   ├── assets/
│   │   ├── templates/clipisode-flow.php   # THE public invitation flow template (~2,900 lines: routing, CSS, IAPI wiring, runtime injection)
│   │   ├── flow/store.js                  # IAPI (Interactivity API) store for the public flow
│   │   ├── themes/default/                # Block templates for every screen + README.md (conventions doc — READ THIS)
│   │   └── editor/                        # Block editor extensions (preview simulator, button label controls, sample images)
│   ├── src/                   # React admin app (pages/, components/) + qr/ block script
│   ├── build/                 # webpack output (wp-scripts)
│   └── tests/                 # PHPUnit (stubs, no DB needed) + Jest
├── transcoding/macos/         # macOS transcoder app (Swift) — largely untouched in this phase
├── docs/                      # prd.md, transcode.md, media.md, output.md, mux.md + specs/
│   └── specs/{active,planned,shipped,research,deprecated}/
└── tools/websocket/echo.py    # WebSocket test server for render-pipeline testing
```

**Key docs to read first, in order:**

1. `AGENTS.md` (repo root) — commands, coding standards, common pitfalls. The standards are strict: no fallback code, no legacy shims, no unrequested features, fix root causes, no narrating comments.
2. `plugin/clipisode/assets/themes/default/README.md` — the conventions document for the invitation-flow screen system (lock model, tokens, slot injection, preview simulator, typography, reseeding). Most of the recent work is documented here.
3. `docs/prd.md` — product requirements.
4. This file's §5 (planning docs) and §6 (unfinished work).

## 3. Architecture snapshot (as of handoff)

### Data model

Custom tables (created in `class-database.php`): `clipisode_topics`, `clipisode_invitation_links`, `clipisode_replies`, `clipisode_outputs`, `clipisode_contents`, `clipisode_media`, `clipisode_hosts`.

Key columns on `clipisode_topics`: `intro_media_id` (the topic's intro **video**; there is no image option yet — see §6), `social_image_media_id` (OG share image), `invitation_id` (FK to the topic's Theme post), `brand_terms_id` / `custom_terms_id` (legal terms CPT posts).

CPTs (registered in `class-post-types.php`):

- **`clipisode_invite`** ("Themes") — a Theme is a named container that owns a set of screen posts. Topics point at a Theme via `topics.invitation_id`. Title-only; `editor` support was removed when v1 died. Its `post_content` is seeded empty.
- **`clipisode_screen`** — one post per screen per theme (intro, intro_desktop, name, email, success, closed, warning_camera, warning_network, warning_silent, warning_wide). `post_content` is Gutenberg block markup, seeded from `assets/themes/default/*.html` and then freely editable by authors in the block editor.
- **`clipisode_terms`**, **`clipisode_preview`** — legal terms and output-preview layouts.

### The public invitation flow (v2 — the only flow)

1. Guest hits `{site}/{prefix}/{slug}` (prefix from option `clipisode_invitation_prefix`, default `invitation`, configurable in Settings for localization — `/invitasjon/`, `/邀請/`).
2. Rewrite rule (registered in `Clipisode_Invitation::register_rewrite()`) sets query var `clipisode_invite`; `template_include` swaps in `assets/templates/clipisode-flow.php`.
3. The template looks up the invitation link → topic → theme (`invitation_id`) → the theme's `clipisode_screen` posts, picks the initial screen (mobile intro vs desktop intro), renders it via `do_blocks()`, and wires the WordPress **Interactivity API** (`assets/flow/store.js`) for screen transitions, video playback, upload progress, and form submission — the reply video keeps uploading while screens swap.
4. Runtime injection: the template post-processes rendered block HTML to inject dynamic pieces the editor never sees — the intro `<video>` (from `topic.intro_media_id`), the live invitation URL, the QR canvas (via `build/qr/view.js` → `window.clipisodeQr`), form inputs, and progress bars. It also substitutes `{host_name}` / `{topic_title}` / etc. tokens and rewrites "magic hrefs" (`#record`, `#upload`, `#terms`) into functional controls (see `Clipisode_Post_Types::FLOW_MAGIC_HREFS`); buttons carrying a `clipisode-goto-<screen>` class become in-flow screen transitions.
5. Guest uploads via REST `POST /clipisode/v1/invitation/upload` and submits via `/invitation/submit` (both in `class-invitation.php`, shared with the admin side; nonce-gated).

### The block-editor authoring experience

This is where most of the engineering effort went. Everything is documented in `assets/themes/default/README.md`; the short version:

- **Seeding.** Each screen's starter markup lives in `assets/themes/default/<screen>.html`. `Clipisode_Post_Types::ensure_screen()` seeds a `clipisode_screen` post from disk, substituting tokens (`{logo_id}`, `{logo_url}`, `{qr_id}`, `{qr_url}`) that must resolve to real Media Library attachments (self-healing import of `icon.png` and `sample-qr.png`). Seeding never overwrites existing posts; trashing a screen post permanently deletes it so the seeder recreates it fresh (dev iteration loop). Debug mode (Settings) adds admin buttons: Reseed missing screens, Re-import default logo, Re-import QR placeholder.
- **Lock model** (four categories, documented in the README): content-locked author blocks (`lock:{move:true,remove:true}`), permissive author blocks (`remove:false`, currently only on the success screen), structural wrappers, and PHP-injected slots (`templateLock:"all"`). Empty slot Groups carry a 0-height locked `core/spacer` (`clipisode-*-slot-filler`) to suppress Gutenberg's layout picker; the renderer strips any `*slot-filler` spacer before injection.
- **Placeholder preview simulator** (`assets/editor/preview-values.js` + `assets/themes/default/preview-values.json`): in the editor, `{topic_title}` etc. display as realistic sample values ("Cooking with Mom: Sunday Sauce Stories") so authors design against real-length copy. Pure text-node replacement (no `<span>` wrappers — those corrupted Gutenberg RichText), with an active-element guard so it never mutates the block being typed in. Toggle in the document sidebar, persisted in `localStorage`. URL-shaped values (`{invitation_url}`, `{invitation_short_url}`) are computed from site URL + configured prefix via a template/fallback system in the JSON.
- **Editor canvas CSS** (`Clipisode_Post_Types::enqueue_screen_editor_canvas_styles()`): per-screen CSS injected into the editor iframe so screens look like the public flow while editing (phone-shaped canvas, gradients, a darkened "SAMPLE" video poster behind the intro gradient). Critical convention: `font-size`/`font-weight` in per-class rules must NOT use `!important`, and heading classes must not set them at all — this is what makes the editor's font-size picker (S/M/L/XL/XXL, registered via `merge_clipisode_screen_editor_font_sizes()`) and heading-level dropdown work.
- **Editor feature forcing:** `filter_screen_editor_font_settings()` force-enables `__experimentalFeatures` (color, spacing, border, dimensions) for `clipisode_screen` posts because restrictive themes (Twenty Twenty-Five) otherwise hide the Color panel etc. Scoped to Clipisode post types only, so the host site's other content is untouched.

### macOS transcoder

Untouched in this phase but part of the product: menu-bar app, WebSocket server on 63481 (render jobs), HTTP on 63482 (serves rendered video). Protocol in `docs/transcode.md`. The plugin's admin app connects from the Clipisode/Create screens.

## 4. Chronological record of requests and what shipped

This section is the "what did the owner ask for" history, so the intent behind the code is preserved.

### Phase 1 — Invitation flow v2 and the screen system (before this transcript window)

Built the `clipisode_screen` CPT system, `clipisode-flow.php` template, IAPI store, seeding pipeline, and the block-editor canvas styling. (The v1 flow — custom stage/element blocks rendered by `invitation.php` — ran in parallel during this period.)

### Phase 2 — Desktop intro screen hardening (requests, in order)

1. **Store and display `icon.png`** on the desktop intro via a real `core/image` block; survive reseeding; allow author replacement; preserve aspect ratio. → `{logo_id}`/`{logo_url}` tokens + self-healing Media Library import.
2. **Fix broken desktop layout in the editor** (stretched icon, narrow left-aligned canvas, layout-chooser noise, corrupt blocks). → byte-exact core/image markup, `layout:default` on groups, locked 0-height spacer fillers in empty slots, canvas max-width rules.
3. **Remove hardcoded `studio.local` URLs** from editor CSS. → URL preview computed from `home_url()` + configured prefix.
4. **No HTML comments in seed files** (they become Classic blocks and break validation). → all commentary moved to sibling `.md` files; `strip_doc_comments()` safety net; `migrate_legacy_intro_post()` healer.
5. **Placeholder preview simulator** with sidebar toggle, per-block reveal-on-click, styling inheritance, and dynamic URL values. Two hard bugs fixed along the way: `<span>` wrappers broke WYSIWYG bolding (fixed with high-specificity inherit rules, then removed entirely), and typing next to a preview corrupted RichText ("Q{topic_title}{topic_title}") — root cause was mutating contenteditable DOM; fix was pure text-node swaps + a `document.activeElement` typing guard.
6. **Typography controls** ("H1→H2 does nothing", "S makes it large, XXL makes it small"). → full 5-step font-size registry, removal of `!important` from all per-class `font-size`/`font-weight` rules across every screen, heading classes stripped of size rules entirely, inline `style.typography.fontSize` on paragraphs that need a pinned default.
7. **Group color/spacing/border controls missing** under Twenty Twenty-Five. → `__experimentalFeatures` forcing, scoped to Clipisode editors.
8. **QR placeholder as a real image block** (`{qr_id}`/`{qr_url}`, locked against removal, styleable/movable); public renderer swaps the figure for a live QR canvas.
9. **Documentation system**: central `README.md` for shared conventions + per-screen `.md` only for real quirks (`intro_desktop.md` exists; the owner explicitly decided intro.md is NOT needed).
10. `.gitignore` addition for `z_screenshots/`.

### Phase 3 — Kill the v1 invitation flow (shipped 2026-05-06)

Owner chose to delete v1 before sweeping markup. Spec: `docs/specs/shipped/kill-v1-invitation-flow.md` (includes audit corrections — notably `clipisode_invitation_links` is shared, NOT v1-only, and the `clipisode_invite` CPT is v2's Theme container, not a v1 leftover). Decisions made by the owner: rename query var `clipisode_flow`→`clipisode_invite`, no feature flag, keep the Theme CPT but gut its seeded v1 content. What shipped: single rewrite at the configurable prefix → `clipisode-flow.php`; `invitation.php` deleted; six v1 block directories deleted (src + build); `register_blocks()` removed; `clipisode_invite` lost `editor` support; version-keyed rewrite flush on upgrade; CSS sweep (all `ci-*` rules died with `src/flow/view.css`); Settings help text updated.

### Phase 4 — Markup sweep (in progress, 3 of 10 screens done)

Goal: bring every screen's seed markup up to the conventions learned on the desktop intro. Per-screen checklist: lock model correctness, `metadata.name` on all blocks, inline `style.typography.fontSize` where per-class CSS pins a size (case-by-case rule chosen by owner: add inline ONLY where class CSS doesn't already pin one... see README "Editor typography"), heading blocks never carry inline size, magic hrefs intact, no comments, no v1 references.

- **`intro.html`** ✅ — added inline sizes to Host Name (16px), Upload Link (12px), Terms Link (12px).
- **`name.html`** ✅ — added inline 16px to Name Instructions and Handle Instructions (their class rules pinned no size). Documented that most of this screen is `clipisode-editor-only` preview blocks (hidden on the public flow via `display:none`; the runtime injects real form widgets).
- **`success.html`** ✅ — see Phase 5; also got permissive locks and a slot filler.
- **Remaining:** `email.html`, `closed.html`, `warning_camera.html`, `warning_network.html`, `warning_silent.html`, `warning_wide.html`, and a final consistency pass on `intro_desktop.html`.

### Phase 5 — Success screen rich background (shipped)

Owner's product goal: *a host should be able to strip the success screen down to a full-screen sponsor ad ("an ad for Starbucks")*. Decisions made: permissive lock model (everything inside the root deletable, including the share button, which is currently a decorative no-op — `#share` is not a registered magic href); convert the root from `core/group` to **`core/cover`** so the standard sidebar offers stretched-to-cover image / gradient / solid color.

Along the way we discovered the intro screen previously used `core/cover` + `core/html` and was deliberately retired because the editor rejected the markup ("recover this block"); `migrate_legacy_intro_post()` still heals legacy posts. Conclusion, agreed with the owner: Cover is safe for success (no video injection, no ghost poster, no baggage) but intro stays Group-rooted. All of this is documented in the README section "Rich backgrounds: when to use core/cover vs core/group".

Shipped: `success.html` Cover-rooted (dimRatio 0, isUserOverlayColor), inner blocks unchanged with permissive locks, Mark Slot got a `clipisode-success-slot-filler` spacer (layout-picker fix), renderer's spacer-strip generalized to any `*slot-filler` class, editor + public CSS refactored for Cover's `__inner-container` wrapper (flex centering moved there; Cover's default 1.5em padding zeroed).

**⚠️ Not yet user-verified:** the owner had not yet reseeded and tested the Cover-based success screen in the editor or public flow when this handoff was written. Test procedure in §7.

### Phase 6 — Intro background: decided direction (not built)

Owner's reasoning, recorded verbatim in spirit: the intro background (video or photo) lines up with the topic's title, so it's a **per-topic** choice, not a per-theme one. Decision: do NOT convert intro to Cover. Instead, extend the **topic editing screen** so a host chooses between three intro backgrounds: **a video** (exists today as `intro_media_id`), **a photo** (new — stretched to cover, injected at runtime exactly like the video), or **a color/gradient** (exists today as the Intro Root Group's sidebar setting, acting as the fallback when no media is set). The owner explicitly asked that this work be started **in Plan mode** (design the schema/API/UI/runtime/canvas-ghost behavior before coding). See §6 item 2.

## 5. Planning docs inventory (docs/specs/)

| Path | Status | What it actually contains |
|---|---|---|
| `shipped/kill-v1-invitation-flow.md` | ✅ Shipped | Full record of the v1 removal: what changed per phase, audit corrections, migration story for live sites, out-of-scope list. Accurate. |
| `planned/short-invitation-urls.md` | 📋 Ready to implement | Complete implementation plan for brand short domains (`rs.video/i/abc123` → 301 → long URL). Option C chosen (plugin-handled host detection on `parse_request`). Includes settings field, `get_short_url_base()` implementation (currently a stub returning `''` in `class-invitation.php`), runtime token substitution, and edge cases (301 caching, slug stability). The editor preview simulator is already wired for `{invitation_short_url}` with fallback. |
| `planned/invitation-link-social-previews-plan.md` | ⚠️ **MISFILED** | Filename says social previews; the file actually contains a "Migrate to Gutenberg-Native Admin Shell" plan referencing *VIP Workflow* (a different codebase). The real social-previews plan for invitation links (per-topic OG images beyond the existing `social_image_media_id`?) apparently was never written or was overwritten. Needs triage: recover or rewrite. |
| `planned/z-example.md` | n/a | Template/example file for the spec format. |
| `active/invitation-link-cpts-plan.md` | ⚠️ **MISFILED** | Contains the OLD Clipisode platform's theme documentation (JSON config reference), not a plan. The same content exists at `research/invitation-link-cpts/old-clipisode-theme-documentation.md`. The actual CPT refactor planning material is in `research/invitation-link-cpts/` (below). Needs triage: either write a real active plan or move/delete this. |
| `research/invitation-link-cpts/cursor.md` and `invitation-link-cpts-opus-plan.txt` | 🔬 Research | Two LLM-generated analyses (near-duplicates) of the v1 architecture with a refactor plan toward per-screen rendering + IAPI. Historically important: this research produced the v2 architecture that now exists. Mostly superseded — the "current state" they describe is v1, which is deleted. |
| `research/invitation-link-cpts/invitation-link-data-model.txt` | 🔬 Research | Data-model notes from the same effort. |
| `research/invitation-link-cpts/old-clipisode-theme-documentation.md` | 🔬 Reference | The old platform's screens + JSON customization surface. **The best product reference for what each screen must do**, including behaviors not yet rebuilt (see §6: email opt-in lists, social-app handle detection, warning-screen flows). |
| `research/invitation-link-cpts/reset-invitation-link-customization.md` | 🔬 Reference | The owner's product brief for block-editor customization: per-screen requirements, what must be editable vs locked, open questions (some since answered — e.g. success screen full-screen ad is now supported; some still open — e.g. email opt-in list checkboxes, "delete the Email screen to disable email capture" behavior, alternate button-state labels like "Saving…"). |

Also relevant: `plugin/clipisode/assets/themes/default/README.md` (conventions, kept current), `intro_desktop.md` (desktop screen quirks), `AGENTS.md` (standards), `docs/prd.md`, `docs/transcode.md`.

## 6. Unfinished work — the detailed list

Ordered roughly by how "ready to execute" each item is.

### 1. Finish the markup sweep (mechanical, conventions all documented)

Remaining screens: `email.html`, `closed.html`, `warning_camera.html`, `warning_network.html`, `warning_silent.html`, `warning_wide.html`; then a final pass on `intro_desktop.html` against the latest conventions. For each screen:

- Verify lock model (four categories per README) and `metadata.name` on every block.
- Inline `style.typography.fontSize` **only** where the per-class editor-canvas CSS pins a size without `!important` (grep the screen's classes in `class-post-types.php::enqueue_screen_editor_canvas_styles()`), or where no size is pinned anywhere and the public flow renders 16px (match it). Headings never get inline sizes.
- No empty Groups without a `clipisode-<screen>-slot-filler` spacer (the renderer strip matches any `*slot-filler`).
- Known specifics: `email.html` has `clipisode-editor-only` preview blocks (email input, two opt-in checkbox paragraphs) like name.html; check `.clipisode-email-*` class rules around line ~3280 of class-post-types.php. `closed.html` (read already: clean, no empty groups) needs only the inline-size check on `clipisode-closed-message`.

### 2. Per-topic intro background: video / photo / color-gradient (owner-approved direction; **START IN PLAN MODE** — explicit owner instruction)

The topic edit screen (`src/pages/TopicForm.tsx`) currently only offers the intro **video** (`intro_media_id`). Build the three-way choice:

- **Schema:** add image support on `clipisode_topics` — either a new `intro_image_id` column (additive, safer) or refactor `intro_media_id` into media-id + type discriminator (cleaner, more rework). Decide in planning.
- **REST:** expose the new field in topics endpoints (`class-rest-api.php`), including the resolved URL for the form (mirror `intro_video_url`).
- **Admin UI:** TopicForm gets a picker: video OR photo OR neither ("neither" = the screen template's own Group background — color/gradient — acts as the fallback; that already works today).
- **Runtime:** `clipisode-flow.php` currently injects `<video>` into `.clipisode-intro-root` when `intro_media_id` resolves (see `set_flow_intro_video_url()` and the injection around line ~2067, plus the desktop variant ~1935). Add an image branch: inject `<img class="clipisode-intro-bg-image">` (object-fit cover, z-index matching the video layer, under the scrims at z-index 3). Precedence: video wins if both somehow exist.
- **Editor canvas:** the intro canvas paints a darkened "SAMPLE" poster via `.clipisode-intro-root::before`. Decide how/whether to reflect a topic-chosen photo (screens are per-theme, topics are per-topic — the canvas can't know which topic; likely keep the SAMPLE ghost as-is and document).
- **Desktop intro** has its own video mount (`clipisode-introd-video-mount`); mirror the image branch there.
- **Do NOT** convert `intro.html` to `core/cover`. That was tried pre-transcript and retired (editor invalidation); `migrate_legacy_intro_post()` still heals legacy Cover markup. Rationale documented in README "Why intro.html is NOT Cover".

### 3. Verify + QA the success-screen Cover conversion (shipped code, untested by owner)

Trash the Success screen post (WP Admin → Clipisode → Screens), reseed, then verify: (a) no block-validation error opening it in the editor; (b) picking a media-library image in the Cover sidebar stretches to cover in both editor and public flow; (c) gradient/solid overlay controls work; (d) deleting inner blocks (heading/message/button/mark slot) works and the layout stays centered; (e) no layout-picker appears on the Mark Slot; (f) Cover's inner-container padding zeroing holds on narrow phones. If the editor rejects the Cover markup (the risk that killed the intro Cover), fall back to Group and plan a custom background-image mechanism instead.

### 4. Short invitation URLs (complete spec, ~a day of work)

Implement `docs/specs/planned/short-invitation-urls.md` exactly: settings field (`clipisode_short_url_base`), un-stub `Clipisode_Invitation::get_short_url_base()`, add `build_short_invitation_url()`, add the `invitation_short_url` runtime token in `clipisode-flow.php`, `parse_request` priority-1 host redirect, docs. The editor preview already resolves `{invitation_short_url}` with fallback — no theme changes needed. Mind the 301-caching edge case (slugs must never be reused).

### 5. Success-screen share button is a decorative no-op

`success.html`'s button links to `#share`, which is **not** in `FLOW_MAGIC_HREFS` (`#record`, `#upload`, `#terms` are). Decide the behavior (Web Share API? copy link? share the invitation URL or something else?) and either register a magic href / IAPI action or remove the button from the seed.

### 6. Email screen functionality gap (product feature, needs planning)

The old platform's email screen (see both research docs) was a modal over the success screen with **opt-in checkboxes bound to Lists** ("enter the Rolex sweepstakes") controlling which mailing lists a reply joined, plus "Skip this". Current state: `email.html` seed exists with editor-only preview blocks (input + two checkbox paragraphs), but there is no Lists data model, no capture endpoint wiring for opt-ins, and the "delete the Email screen from the theme to disable email capture" behavior proposed in `reset-invitation-link-customization.md` is not implemented or decided.

### 7. Alternate button-state labels ("Saving…", "Upload complete")

`assets/editor/name-submit-labels.js` and `name-progress-controls.js` exist for the Name screen (sidebar controls for progress-bar styling and submit-label states). Verify coverage matches the product brief (all button states localizable from the sidebar) and extend the pattern to other stateful controls if any are missing.

### 8. Narrow-viewport stacking + scroll on the desktop intro

Known caveat from the desktop-intro work: when the desktop layout's columns stack at narrow widths, the public flow doesn't scroll. Small CSS fix in `clipisode-flow.php`, never prioritized.

### 9. Misfiled spec files (15-minute cleanup + one rewrite)

- `docs/specs/active/invitation-link-cpts-plan.md` — duplicate of the old-theme reference doc; the "active" slot is a lie. Move/delete, and decide whether a real "invitation-link CPTs" plan is still needed (much of that refactor shipped as v2).
- `docs/specs/planned/invitation-link-social-previews-plan.md` — contains an unrelated VIP Workflow admin-shell plan. If invitation-link social previews (per-link OG cards) are still wanted, that spec needs to be written from scratch; topics already carry `social_image_media_id` and `clipisode-flow.php` emits OG tags, so scope may be small.

### 10. Housekeeping / lower priority

- **Nothing is committed.** At handoff, the entire v2 + sweep + v1-kill body of work sits as uncommitted changes/untracked files in the working tree (see `git status`). First task for the new developer: review and commit in sensible chunks (the v1-kill spec's phase list is a good commit map).
- Existing sites' default Theme posts still contain dead v1 stage-block markup in `post_content` (harmless: never rendered/edited; decided not worth a migration).
- The `__experimentalFeatures` forcing in `filter_screen_editor_font_settings()` is a workaround; a plugin-shipped `theme.json`-style registration would be cleaner long-term.
- `$clipisode_flow_*` PHP variable names in `clipisode-flow.php` predate the query-var rename; cosmetic only.
- PHP heredoc gotcha (bit us twice): the editor-canvas CSS lives in double-quoted PHP strings — unescaped `"` or `{$...}`-looking sequences in CSS comments cause parse errors. Run `php -l` after every edit to `class-post-types.php`.
- Jest/PHPUnit suites are thin; `composer test` and `npm run test:js` pass but coverage of the new systems (seeder, preview simulator) is minimal.

## 7. Development workflow cheat-sheet

```bash
cd plugin/clipisode
npm install && composer install
npm run dev          # watch mode (wp-scripts)
npm run build        # production build
composer test        # PHPUnit (stubbed, no DB)
npm run test:js      # Jest
```

Local WP database: `mysql -h localhost -P 3306 -u root -proot`. Debug log: `~/dev/wp-local/mcp/app/public/wp-content/debug.log`.

**Screen-template iteration loop** (also in the README): edit the `.html` seed on disk → WP Admin → Clipisode → Screens → trash the screen (auto-converts to permanent delete) → with Debug mode on, click "Reseed missing screens" (or just load any public invitation URL — the flow template lazily reseeds) → reopen in the editor. Editor-canvas CSS changes need a hard reload of the post editor. Changes to `preview-values.json` also need a hard reload (localized at enqueue).

**Rewrite changes:** rewrite rules auto-flush on plugin version change (`clipisode_rewrite_version` option check in `clipisode.php`) and on prefix change via Settings; deactivate/reactivate also flushes.

## 8. Hard-won lessons (do not relearn these)

1. **Never mutate Gutenberg RichText DOM with elements.** The preview simulator's `<span>` wrappers corrupted typing (duplicated placeholders). Only pure text-node swaps, with a `document.activeElement` guard, are safe. History in `preview-values.js` docblocks.
2. **`core/cover` + `core/html` in seed markup broke the editor** ("recover this block") — that's why the intro is plain Groups with all media injected at runtime by PHP. Cover alone (success screen) is believed safe but verify (§6.3).
3. **No `!important` on `font-size`/`font-weight`** in editor-canvas per-class rules, and no size rules at all on heading classes — otherwise the size picker and H1/H2/H3 dropdown silently break.
4. **No HTML comments in seed `.html` files** — WordPress parses them as Classic blocks. Commentary goes in the sibling `.md`.
5. **Empty Group blocks trigger the layout picker** — always include a locked 0-height `*slot-filler` spacer; the renderer strips them.
6. **Seed-token images must resolve to real attachments** before save or `core/image` fails validation — hence the self-healing imports.
7. **Block markup must match WordPress's serializer byte-for-byte** (class order, attribute order) or the editor flags it. When authoring seed HTML for a core block, build it in the editor first and copy the serialized output.
8. **`clipisode_invitation_links` is shared infrastructure** (v2 reads/writes it) — an early spec wrongly marked it v1-only. Don't drop it.
