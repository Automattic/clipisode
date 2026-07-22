# Cursor research log: Invitation Link CPTs refactor

**Date:** Saturday Apr 25 – Sunday Apr 26, 2026
**Participants:** User (Brian Alvey), Assistant (Claude Opus 4.7) in Cursor
**Summary:** Discovery and planning session for refactoring the Clipisode WordPress plugin's invitation flow. Covers the current data model, the target state (one CPT per screen type, Interactivity API for client navigation, upload-survives-screen-transition), comparison against the 2021 Next.js codebase, and ends with a working Interactivity API + state-survival spike running on a Studio dev site.

A couple of formatting notes for reading this outside Cursor:

- Where the assistant cited existing code, the original Cursor format used line numbers and file paths in the code-fence info string (e.g. ` ```12:14:path/to/file.tsx`). That syntax only renders inside Cursor. For this archive I've converted those into standard fenced blocks with the path written above the block.
- Tool-call invocations and Cursor system metadata are stripped — only the human-readable conversation remains.

---

# Prompt

what is the data model for Invitation Links? there are potentially multiple invitation links per Topic, but how are Invitation Links and their codes stored?

# Response

Here is how **Invitation Links** are modeled in this project.

## Database: `clipisode_invitation_links`

They live in a dedicated MySQL table (with the WordPress DB prefix, e.g. `wp_clipisode_invitation_links`):

`plugin/clipisode/includes/class-database.php` lines 75–86:

```sql
CREATE TABLE {$wpdb->prefix}clipisode_invitation_links (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  topic_id BIGINT UNSIGNED NOT NULL,
  slug VARCHAR(20) NOT NULL,
  type VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  clicks BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY  (id),
  UNIQUE KEY slug (slug),
  KEY topic_id (topic_id)
) $charset;
```

So each link is a **row** with:

| Field | Role |
|--------|------|
| `id` | Surrogate primary key |
| `topic_id` | Which topic this link belongs to (many links per topic) |
| `slug` | The **code** used in the public URL (1–20 chars; see below) |
| `type` | e.g. `public` on create |
| `status` | e.g. `open` / toggled in admin |
| `clicks` | Counter |
| `created_at` | Timestamp |

**"Code" storage:** the shareable code is the **`slug` column** — there is no separate "code" field. **`slug` is unique across the whole site** (`UNIQUE KEY slug (slug)`), not per topic. Two different topics cannot share the same slug.

**Generation:** new links get a 6-character hex slug from `random_bytes(3)`; admins can change it via REST to any **1–20 alphanumeric** string if it is still globally unique.

`plugin/clipisode/includes/class-rest-api.php` lines 896–911:

```php
public function create_invitation_link( WP_REST_Request $request ): WP_REST_Response {
    global $wpdb;
    $table = $wpdb->prefix . 'clipisode_invitation_links';

    $attempts = 5;
    $result   = false;

    while ( $attempts-- > 0 ) {
        $slug   = substr( bin2hex( random_bytes( 3 ) ), 0, 6 );
        $result = $wpdb->insert( $table, [
            'topic_id' => (int) $request['topic_id'],
            'slug'     => $slug,
            'type'     => 'public',
            'status'   => 'open',
        ] );
```

**Public URL:** `{site}/{invitation_prefix}/{slug}`. The prefix is a **site option** (`clipisode_invitation_prefix`, default `invitation`), not stored on the link row.

## TypeScript (admin UI)

The REST payload matches this shape:

`plugin/clipisode/src/types.ts` lines 55–64:

```ts
export interface InvitationLink {
    id: number;
    topic_id: number;
    slug: string;
    type: string;
    status: string;
    clicks: number;
    replies_count: number;
    created_at: string;
}
```

`replies_count` is joined in queries, not a stored column on the link.

## Relation to `Topic.invitation_id` (naming)

On **`clipisode_topics`**, `invitation_id` is **not** an invitation link id. It points at the **invitation theme** (Gutenberg "invite" layout). Shareable links are **only** the rows in `clipisode_invitation_links` keyed by `topic_id`.

**Replies** reference the link with `invitation_link_id` on `clipisode_replies`, so you can tell which of several links produced a given reply.

---

# Prompt

You are helping me refactor the Clipisode WordPress plugin. Before proposing any changes, read the codebase thoroughly. Start with these files and work outward from there:

1. plugin/clipisode/includes/class-database.php
2. plugin/clipisode/includes/class-rest-api.php
3. plugin/clipisode/src/types.ts
4. Any file that handles the public invitation link URL — the route that resolves a slug to a screen flow. Find it and read it.
5. Any JS or PHP file that currently manages screen transitions on the invitation link frontend.

Do not propose any changes yet. First give me:

- A plain-English description of how the current invitation link flow works end-to-end, from slug in the URL to screens rendered on the phone
- Which files own which parts of that flow
- Where the current screen transition logic lives and how it works today
- What currently makes each screen show or hide

---

CONTEXT: Here is the architecture we are refactoring toward.

CURRENT STATE:
All invitation link screens live as blocks inside a single WordPress post. Screen transitions are handled by showing and hiding blocks via JS. Branding exists but is hard to edit because all screens are stacked in one post — editors can't tell if a block will appear at the top or bottom of a screen.

TARGET STATE:
Each screen is its own WordPress custom post type (CPT). An invitation theme is a parent CPT record. Each screen post is a child of the theme. The WordPress Interactivity API handles client-side navigation between screens. The video upload — which starts on the recording screen — must continue running in the background as the Interactivity API swaps to the name/email screen. No page reload. No lost upload.

DATA MODEL (already built, do not change):
- wp_clipisode_invitation_links: custom table. Each row has a slug (public URL code), topic_id, status.
- clipisode_topics: has an invitation_id field pointing to the theme.
- clipisode_replies: has invitation_link_id to track which link a reply came from.
- Public URL format: {site}/{invitation_prefix}/{slug}

SCREEN INVENTORY (9 screens total):
1. Intro Screen — full-screen background video or gradient. Shows topic title, host name, record button, upload link, terms.
2. Intro Screen Desktop — wide layout shown when link opens on desktop. Video on one side, QR code on the other. No recording on desktop.
3. Name Screen — shown after recording starts. Collects name + optional social handle. Upload continues in background. Shows upload progress.
4. Email Screen — optional, shown before Success. Collects email + consent checkboxes for mailing lists.
5. Success Screen — final screen. Default copy or fully custom brand markup (Disney+ ad, Burger King QR code coupon, etc.)
6. Warning: Camera — shown if no video returned after recording attempt. Likely camera permission was blocked.
7. Warning: Network — shown if video upload is failing or very slow.
8. Warning: Silent — shown if JS audio check finds video has no audio track. Lets user retry, upload pre-recorded, or open in browser.
9. Warning: Wide — shown if video is horizontal. Lets user send anyway or re-record.

CPT ARCHITECTURE (from our WordPress block expert David Bowman):
- One CPT for Theme (parent record)
- Separate CPTs per screen type — each screen type is its own CPT, child of a Theme
- WordPress block editor is used to edit each screen post
- Editor is locked to mobile-width layout so editors see exactly how the screen will look on a phone
- Block templates define required elements per screen type; editors customize within those templates

INTERACTIVITY API REQUIREMENTS:
- The Interactivity API router handles all screen transitions client-side
- When transitioning from the recording screen to the Name screen, the video upload fetch/XHR must continue running in the background
- Screen posts are fetched via the REST API and swapped into the viewport without a page reload
- The store holds upload state (progress percentage, success, error) across transitions
- Warnings are overlays managed by the store, not separate route changes

---

Once you have read the codebase and given me your current-state summary, propose a refactor plan with these constraints:

1. We have from today (Saturday) to Monday night. Demo is Tuesday.
2. I am learning as I build — explain what each piece does as you propose it.
3. Propose changes one file at a time. Do not give me multiple files at once.
4. Flag any part of the current codebase that will break or need updating when we change the screen architecture.
5. Identify the single highest-risk part of this refactor — the thing most likely to cost us a day if it goes wrong — and propose how to de-risk it first.

# Response

I've read through the core files. Here is the current-state summary, followed by the refactor plan.

---

## Part 1 — Current state

### End-to-end flow in plain English

1. A guest visits `{site}/{invitation_prefix}/{slug}` (default prefix `invitation`, stored as site option `clipisode_invitation_prefix`).
2. A rewrite rule converts the slug into the `clipisode_invite` query var and swaps in a custom template.
3. The template looks up the slug in the custom `wp_clipisode_invitation_links` table, 404s if missing, rejects if `status != 'open'`, increments `clicks`, loads the linked `topic`, then loads **one** WordPress post of CPT type `clipisode_invite` (the "Theme") whose ID is stored on `topics.invitation_id`.
4. That Theme post's content is a single Gutenberg block tree: `clipisode/invitation-flow` as the root, holding four child stage blocks (`invitation-desktop`, `invitation-landing`, `invitation-record`, `invitation-thanks`), each of which holds element blocks (`video`, `title`, `hosted`, `cta`, `terms`, `upload-form`, `thanks-*`, `qr-code`).
5. Before rendering, the template **string-injects the slug** into the flow block's JSON attributes via `preg_replace` so child blocks can see it via block context (`providesContext: clipisode/slug`).
6. `do_blocks()` renders everything server-side. All four stages are in the DOM simultaneously, wrapped in `.ci-flow-root` with `data-slug`, `data-rest-url`, `data-nonce`, and `data-upload-nonce` on the wrapper.
7. One script (`view.ts`, the flow block's `viewScript`) boots on `DOMContentLoaded`. It:
   - Decides `isMobile` via `navigator.maxTouchPoints > 0 && window.innerWidth < 1280`.
   - If not mobile: adds `.ci-desktop` to the root (CSS handles which stage is visible), renders a QR code into `.ci-qr-canvas`, and returns. Desktop has no interactions beyond "watch video, scan QR".
   - If mobile: attaches a delegated click handler for `[data-goto]`. The only CTA that emits this is the landing `cta` element with `data-goto="record"`.
   - Handles file input change → starts an XHR POST to `/clipisode/v1/invitation/upload`, updates `.ci-status-text` and `.ci-progress-fill` on progress events, stores `media_id` on success.
   - Handles submit → POSTs `{slug, name, social_handle, media_id}` to `/clipisode/v1/invitation/submit`, then calls `showStep('thanks')`.
   - Calls `showStep('landing')` at the end of init.

### Which file owns which part

| Concern | File |
|---|---|
| URL rewrite → query var → template swap | `plugin/clipisode/includes/class-invitation.php` |
| Slug → link → topic → Theme post lookup, click tracking, full HTML doc, OG tags, slug injection | `plugin/clipisode/assets/templates/invitation.php` |
| `invitation_prefix` site option | `includes/class-invitation.php::get_prefix()` + `src/pages/Settings.tsx` |
| Theme CPT (`clipisode_invite`) + default-Theme seeding (the big block template) | `plugin/clipisode/includes/class-post-types.php` |
| Invitation-links table, topics table, replies table | `plugin/clipisode/includes/class-database.php` |
| Invitation-link CRUD REST (`/topics/:id/invitation-links`, `/invitation-links/:id`) | `plugin/clipisode/includes/class-rest-api.php` |
| Public upload/submit REST | `plugin/clipisode/includes/class-invitation.php` |
| Flow parent block (wrapper `<div>` + data attrs) | `src/flow/` (`block.json`, `render.php`, `edit.tsx`) |
| Four stage blocks (each a `<div data-step="...">`) | `src/blocks/stage-desktop\|landing\|record\|thanks/` |
| Type-switched element block (renders the actual UI) | `src/element/` (`block.json`, `render.php`) |
| **All** client behavior — transitions, upload, submit, QR, terms modal, video play/pause | `src/flow/view.ts` |
| All styles | `src/flow/view.css` |

### Where screen transitions live today

Only in `plugin/clipisode/src/flow/view.ts`. Everything else about screens is server-rendered HTML. There is no router, no history API, no per-screen fetch. Transitions are:

`plugin/clipisode/src/flow/view.ts` lines 17–21:

```ts
function showStep( step: string ): void {
    stages.forEach( ( el ) => {
        el.style.display = el.dataset.step === step ? '' : 'none';
    } );
}
```

It's a `display: none` toggle across four sibling `<div>`s that are all in the DOM from first paint.

### What makes each screen show or hide

- **Desktop stage** — shown when `isMobile === false`. The JS early-returns without calling `showStep`, and a root class `.ci-desktop` (added in JS) plus CSS is what hides the mobile stages and reveals the desktop one. Desktop has no stage transitions.
- **Landing** — `showStep('landing')` is called at the end of `initFlow` as the mobile default.
- **Record** — clicking any `[data-goto="record"]` element (only the landing `cta`) triggers `showStep('record')`, which also programmatically clicks the hidden file input after 150ms.
- **Thanks** — `showStep('thanks')` runs after a successful `POST /invitation/submit`.

Name/handle inputs are **not a separate screen** today — they sit inside the record stage's `upload-form` element. The submit button is disabled until `uploadComplete && name.trim()`.

There is currently **no** Name screen, Email screen, Success screen distinct from Thanks, or any Warning screen. The target state's screens 4–9 don't exist in code yet.

---

## Part 2 — Refactor plan (proposal only, no edits yet)

### Single highest risk: upload survival across a router transition

Everything else in this refactor is CRUD and block editor config — annoying but predictable. The one thing that can burn a full day and break the demo is this:

> When the Interactivity API router swaps the Record screen out and the Name screen in, the in-flight `XMLHttpRequest` must keep running AND its progress events must continue to update the new screen's progress bar.

Why it's dangerous:

- The XHR itself is a JS object and will happily keep uploading regardless of DOM churn.
- But today's progress updates are written **directly to DOM nodes** (`statusText.textContent = ...`). Those nodes will be removed by the router.
- After the swap, the Name screen's progress bar is a fresh DOM node that the old code has no reference to.
- If the router re-hydrates/re-creates the store, you lose the XHR.
- If the user hits Back, the Record screen's DOM is rebuilt but the upload state is lost.

**De-risk it before anything else.** Before writing a single CPT, spend Saturday morning on a throwaway spike:

1. One PHP template with two sibling regions, both inside a `data-wp-interactive` root, both behind a simple router.
2. One Interactivity store with `uploadPct: 0`, `uploadComplete: false`, `mediaId: null`, and actions `startUpload(file)`, `reset()`.
3. `startUpload` creates the XHR, but only writes to **store state**, never to DOM.
4. Region A has `<input type="file">` wired to `startUpload`.
5. Region B has `<progress>` bound to `state.uploadPct` via `data-wp-bind--value` and `data-wp-text`.
6. Click a button that navigates router from A → B while upload is in flight.
7. Throttle your network in DevTools so the upload takes 20s+. You should see B's progress bar keep ticking.

If that spike passes, you know the architecture is safe and the rest is carpentry. If it fails, **the fallback** is: do not use the router for the Record → Name transition. Keep Record and Name in the same router region and toggle them via a `state.screen` variable with `data-wp-bind--hidden`. Use the router only for Intro → Record and for Success. Warnings stay as overlays (they were always overlays, no router needed). You lose the "one CPT per screen" cleanliness for the Record+Name pair, but you ship Tuesday.

Budget: **half a day Saturday, hard cap**. If by Saturday dinner the spike isn't green, switch to the fallback and proceed.

### What will break or need updating in current code

Flagging everything so nothing surprises us on Monday night:

1. **`assets/templates/invitation.php`** — will be largely rewritten. It currently loads one post and injects a slug string via regex. New job: decide initial screen (Intro vs Intro-Desktop), render only that screen's block content, emit initial store state, and register the page as an Interactivity region.
2. **`src/flow/block.json`, `src/flow/render.php`, `src/flow/edit.tsx`, `src/flow/view.ts`, `src/flow/view.css`** — the entire flow block becomes obsolete as a *block*, because a Theme post no longer has internal content. The `viewScript` and the wrapper `data-*` attributes move to the template. `view.ts` becomes Interactivity store modules, not a single DOMContentLoaded script.
3. **`src/blocks/stage-desktop|landing|record|thanks/`** — all four are dead with the new model. Their visual templates migrate into the per-screen CPT's default block template. Safe to delete after migration.
4. **`src/element/block.json`** — the `parent` array currently pins elements as children of the four stage blocks. It needs to be re-pointed at the new screen wrapper blocks (or removed if every screen embeds elements directly).
5. **`src/element/render.php`** — the `upload-form` case currently emits file input **and** name/handle inputs in one element. It has to split: file chooser stays on Record, name/handle move to Name. New element types need adding for Email (email input + consent checkboxes), warnings, and the Success variants.
6. **`includes/class-post-types.php::ensure_default_invitation()`** — today it seeds one post with a big block template. It now must seed one Theme parent + nine child posts, one per screen CPT, each with its own default block template. This is the single biggest PHP change. Needs to be idempotent so reactivation doesn't duplicate screens.
7. **`includes/class-post-types.php::register()`** — add nine new CPTs (or one generic `clipisode_screen` CPT with a `screen_type` taxonomy/meta — worth discussing; see below). Each needs `show_in_rest` so the Interactivity router can fetch them, `hierarchical => true` so `post_parent` works, `public => false`, mobile-width editor lock (already done for `clipisode_invite`, extend to new types).
8. **`includes/class-rest-api.php`** — add at least one endpoint: "given a Theme ID + screen_type, return the rendered HTML for that screen." The Interactivity router needs this for fetched navigation.
9. **`includes/class-invitation.php::upload_video()` and `submit_reply()`** — unchanged. They key off slug + nonce, not client screen state. This is the one comfortably stable piece.
10. **`includes/class-database.php`** — no table changes. Leave it alone.
11. **`src/pages/ThemeList.tsx`** — today it lists Theme posts. With nine child screens per theme, editors need a way to drill into each screen's editor. Add a "Screens" column or a row expander with nine edit links. This is UI-only and can be Monday work.
12. **`src/pages/TopicForm.tsx`** — `topic.invitation_id` still means "parent Theme ID". No change needed.
13. **`src/pages/Settings.tsx`** — `invitation_prefix` unchanged. No change needed.
14. **Rewrite rules** — `flush_rewrite_rules()` on next activation (already wired via `delete_option( 'rewrite_rules' )` on activation). No changes needed unless you add new public-facing URLs; target-state says the public URL is unchanged, so this is safe.

A design question worth answering Saturday: **nine CPTs vs. one `clipisode_screen` CPT with a `screen_type` meta**. David Bowman says nine CPTs. Nine gives you per-type block templates, per-type editor sidebars, and per-type capability checks — nice, but a lot of `register_post_type()` boilerplate and nine activation-seed routines. One CPT + meta is half the PHP, still gives you one-post-per-screen, and lets you share REST endpoints. If you want a learning-friendly middle ground, I'd suggest one CPT + `screen_type` meta with per-meta-value block templates. That said, defer to Bowman if the team has already committed. I'll propose whichever you pick; just flag it before we start file 1.

### File-by-file sequence (I'll send them one at a time as you confirm)

Rough ordering, front-loaded for de-risk:

- **Step 0** — Interactivity + XHR-survival spike (above). Scratch branch, delete after.
- **Step 1** — `includes/class-post-types.php`: register the new screen CPT(s). I'll explain `hierarchical`, `show_in_rest`, `rest_base`, `supports`, and the mobile-width editor lock as we go.
- **Step 2** — `includes/class-post-types.php` again: extend `ensure_default_invitation()` to seed parent Theme + child screens with idempotent checks.
- **Step 3** — `includes/class-rest-api.php`: add the "render one screen" endpoint the router will call.
- **Step 4** — `assets/templates/invitation.php`: rework to render the Interactivity region with the initial screen.
- **Step 5** — New `src/interactivity/` store modules (one file at a time): `store.ts`, `upload.ts`, `navigation.ts`, `warnings.ts`.
- **Step 6** — New per-screen wrapper blocks (`src/screens/intro/`, etc.) one screen at a time, starting with Intro + Record since those are on the critical path for the upload flow.
- **Step 7** — `src/element/*`: split `upload-form`, add new element types for name/email/consent/warnings.
- **Step 8** — Retire the old flow + stage blocks. This is last so nothing in the middle breaks.
- **Step 9** — `src/pages/ThemeList.tsx`: add screen drill-down.

Before I send file 1, two things I need from you:

1. **Nine CPTs or one-CPT-with-meta?** (Strong recommendation: one CPT + `screen_type` meta, for scope reasons, unless Bowman has already committed.)
2. **Do we spike first?** (Strong recommendation: yes, Saturday morning.)

---

# Prompt

This is a great plan. I like the per-file explanations. Bowman has not done any work, only a 20 minute call yesterday to bring him up to speed from zero and get his input on this specific area of block editing. I'm taking that input and running with it here solo. If we do one CPT with different metas, does that let us do custom tools in the sidebar based on the screen type if needed? Either way, are we able to lock down certain elements like the reply button that triggers the camera where maybe they can move or style it, but they cannot delete it? I am curious how we mix in advanced things beyond paragraphs and images like form controls and let them be customized, but not removed. Yes, we will be spiking first and fully redoing many files. I also need a few more things. I will need to test this on phones, so I either have to hook up something like ngrok for my local dev servers on my laptop or I need to make changes to the plugin, zip them locally and drag them into a WordPress site I host on a real server for testing. If we do make these changes and I drag a zip to my testing site (threadplan.com, a domain I never used for anything else), do things like table updates automatically happen in that WordPress site when the new version of the plugin is activated? Are old tables from this same plugin automatically removed? Also, if it helps I can probably find the old React or Next.js codebase we used for Clipisode years ago, before WordPress. FYI, it is already dinner time on Saturday here in California. One last question, did the current work on the Invitation Links in WordPress include the optional email and checkbox capture overlay in between the Name and Success screens? It's not a full screen, per se, just a modal on top of the Success screen that can be closed by choosing a "Skip this" link instead of a submit button action.

# Response

Good questions — answering each in order.

### 1. One CPT + meta: can the sidebar change per screen type?

Yes, and in several ways. A block editor sidebar is a collection of React panels; what you show is just a conditional in your JS. Given a single `clipisode_screen` CPT with a `screen_type` meta (e.g. `intro`, `intro-desktop`, `name`, `email`, `success`, `warning-camera`, etc.), you have four clean hooks:

- **`block_editor_settings_all` filter (PHP)** — lets you pass `screen_type` down to the editor as part of the page's bootstrap data, so the JS knows which sidebar to render before any block loads.
- **`wp.plugins.registerPlugin` + `PluginDocumentSettingPanel`** — a React panel that appears in the Document sidebar. You just branch on `screen_type` and render different controls. This is where you'd put things like "Record button label," "Show terms link," "Allow Skip on email screen."
- **`useBlockEditingMode` / `InspectorControls`** — per-block sidebar panels. If the Record screen's reply button should expose a "Camera facing: user/environment" control but no other screen should, that lives here on the reply-button block, not on the screen type.
- **Block-template filtering** — you pass a different `template` array into the editor based on `screen_type`, so the Intro screen's editor boots with intro blocks, the Email screen's with email blocks, etc.

So: one CPT doesn't cost you anything on the sidebar side. Nine CPTs only buys you the ability to split capability checks (`edit_clipisode_intro` vs `edit_clipisode_email`) and to have nine different menu entries — neither of which matters for this demo. **Strong recommendation: one CPT + `screen_type` meta.**

### 2. Can we lock elements so editors can style/move but not delete?

Yes, and this is a first-class feature of the block editor. Several primitives:

- **`lock` attribute on a block instance** — supports `{ remove: true, move: true }` (you can independently lock each). Your current code already uses `lock: { remove: true }` for the element blocks (see `ensure_default_invitation()` in `class-post-types.php`, lines 155–173). That's exactly the pattern: content is "there by template, editor can restyle it, cannot delete it."
- **`templateLock` on a parent** — four modes:
  - `false` — editors can do anything (default).
  - `"insert"` — can edit existing blocks, cannot insert new ones or remove any.
  - `"contentOnly"` — can edit text and media but nothing structural.
  - `"all"` — fully locked.
- **`templates` array on a CPT** — the parent (e.g. the `clipisode/screen-record` block or the `clipisode_screen` post itself) specifies which blocks must exist. Combined with `lock: { remove: true }` on each, the record button is always in the output.
- **`allowedBlocks`** on a parent — restricts which block types can be inserted alongside the required ones.

**Recommended pattern for your screens:**

- Each screen has a root wrapper block (`clipisode/screen-record`, etc.) with a `templates` array listing required elements.
- Each required element has `lock: { remove: true }` so editors can drag it around and restyle it but cannot delete it.
- `allowedBlocks` on the wrapper is your whitelist: `clipisode/element` (the typed one), plus standard blocks you want to permit (paragraph, heading, image, spacer). Anything not on the list won't appear in the inserter.
- Optionally, `lock: { move: true }` for the reply-button if you want it always at the bottom.

This is the WP-native way. No custom "read-only" overlay needed.

### 3. Mixing advanced form controls as editable-but-not-removable blocks

Your current `clipisode/element` block is a great model and I'd keep it. Look at its shape:

`plugin/clipisode/src/element/block.json`:

```json
{
    "$schema": "https://schemas.wp.org/trunk/block.json",
    "apiVersion": 3,
    "name": "clipisode/element",
    "title": "Clipisode Element",
    "category": "widgets",
    "icon": "screenoptions",
    "description": "A single invitation element. Content is locked (from DB); styles are editable. Drag to reorder within a stage."
}
```

The pattern: a block whose **content** is rendered server-side from a typed source (DB row, screen type, topic data), but whose **styling supports** (color, typography, spacing) are editor-controlled. Editors cannot change what the block *says*, only how it looks. For the refactor, you extend the `type` enum with: `record-button`, `name-input`, `email-input`, `consent-checkbox`, `skip-link`, `progress-bar`, `warning-*`. Each is a typed element — same block, new cases in the `switch` of `render.php`. Editors drag them around and style them; the actual form control behavior stays in one place you control.

For truly advanced controls (a multi-field form, a file chooser with specific validation), don't let Gutenberg's generic inserter build them up from primitives. Register them as discrete typed elements and pre-place them via the screen template with `lock: { remove: true }`.

### 4. Phone testing: ngrok vs zip-drop

**ngrok (or Cloudflare Tunnel, or Tailscale Funnel) is dramatically better for iteration.** A build-zip-drag cycle is probably 2–4 minutes each; a dev-server reload is seconds. On a Sat→Mon timeline, that difference is hours.

Setup sketch: `wp-scripts start` gives you HMR-free but fast rebuilds; your local WP is probably LocalWP or `wp-env` on port 8888; `ngrok http 8888` exposes it with HTTPS; point your phone at the ngrok URL. One gotcha: WordPress stores `siteurl` and `home` in the DB, and if those are `http://localhost:8888`, your ngrok-served pages will try to load scripts/styles from localhost on the phone. Two fixes:

- In `wp-config.php`, set `WP_HOME` and `WP_SITEURL` to your ngrok URL dynamically (using `$_SERVER['HTTP_HOST']`), or
- Use LocalWP's "Live Link" feature, which handles this automatically.

I'd use ngrok (or Local's Live Link) for 90% of dev and only zip-drop to `threadplan.com` to **sanity-check** once after major milestones — production PHP version, real SSL cert, real CDN behavior sometimes catches things localhost won't.

**About automatic migrations on activation:**

Your current code does the right thing in `plugin/clipisode/includes/class-database.php`:

```php
dbDelta(
    "CREATE TABLE {$wpdb->prefix}clipisode_invitation_links (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
topic_id BIGINT UNSIGNED NOT NULL,
slug VARCHAR(20) NOT NULL,
type VARCHAR(20) NOT NULL,
```

`dbDelta()` is WordPress's schema-migration helper. When the plugin is activated:

- If a table doesn't exist → created.
- If a table exists but is missing a column your new `CREATE TABLE` declares → `ALTER TABLE ... ADD COLUMN` runs automatically.
- If a column's type/definition has changed → `MODIFY COLUMN` where it can.
- **It does NOT drop columns.** If you remove a column from the PHP, the DB column stays.
- **It does NOT drop tables.** If you rename a table in PHP, the old table stays, a new empty one is created.
- It's finicky about whitespace — the existing file's format (two spaces after `PRIMARY KEY`) is that way intentionally; keep it.

So for this refactor: adding a `consent_mailing` or `consent_terms` column to `clipisode_replies` on activation will happen automatically when you drop the new zip on `threadplan.com` and click Activate. Dropping a column or renaming a table will not — you'd need explicit `$wpdb->query()` inside the activation function.

**About old tables being removed:**

They aren't. Two reasons:

- Your plugin has no `uninstall.php` and no `register_uninstall_hook()`. I checked — searched for `uninstall`, `DROP TABLE`, `register_uninstall` across the plugin, zero matches.
- `register_deactivation_hook( __FILE__, 'flush_rewrite_rules' )` only flushes rewrite rules on deactivate, not data.

So if you install v0.1 of the plugin on `threadplan.com` today, create some topics and links, deactivate, upload v0.2, and activate — all your data is intact and `dbDelta` picks up schema diffs. If you **delete** the plugin via the WP admin, WordPress looks for `uninstall.php` → doesn't find one → data still persists. Only a manual `DROP TABLE` in phpMyAdmin wipes it.

This is safe but has a flip side: if you're using `threadplan.com` as a scratch environment and want a clean slate between test sessions, you'll need to drop the tables yourself (or add a temporary "uninstall and reset" button).

### 5. Old React/Next.js Clipisode codebase

**Yes, pull it down tonight.** Even if you don't port a single line, you'll want it for three specific things:

- **Warning screen logic** — the camera-blocked, network-slow, silent-audio, and wide-video detection are all fiddly browser-feature heuristics that took someone time to tune the first time. Re-deriving them in the next ~48 hours is exactly the kind of thing that eats a Sunday.
- **Silent-audio check** — the WebAudio API approach (pipe the file through a short `AudioContext` analysis to detect zero-amplitude) is non-obvious. If the old code has a working version, copy the approach.
- **Upload UX copy + timing heuristics** — the "your upload is taking a while, retry or continue" UI probably had dwell timings and retry logic that were tuned against real mobile networks.

What I'd skip from the old codebase: the old recording-flow state machine. That tied to React's lifecycle, whereas your new one lives in an Interactivity API store. The shape is different enough that lifting the code doesn't save much. But the *decisions* it encodes (what triggers a warning, what order the screens appear, what copy appears where) are gold.

### 6. Email + checkbox overlay — did any current work include it?

Partial. The **schema** has a slot for it; the **UI** does not.

Present in the current code:

- `clipisode_replies.email VARCHAR(255)` column exists (`class-database.php` line 112).
- The `Reply` TypeScript interface has `email: string` (`src/types.ts` line 90).
- The admin `ReplyModal.tsx` displays email if present.

Absent in the current code:

- No email input field anywhere in `src/element/render.php` or `src/flow/view.ts`.
- No consent checkbox element, no "Skip this" link handler.
- No modal scaffolding beyond the terms modal (which is a different thing).
- `submit_reply()` in `class-invitation.php` doesn't accept an `email` parameter, doesn't sanitize one, doesn't insert one — so even if you added a field in the client, the server wouldn't persist it.

So: someone planned for it (hence the column and the admin display), but the guest-facing capture was never built. For the refactor, the email+consent overlay is net-new work. Which is actually fine — you'd want it on the Success screen (or really, on top of Success, dismissible via Skip) so it's a small overlay block with three fields and two submit paths ("Subscribe" → POST + close; "Skip this" → close without POSTing). Probably the cleanest place is as a new element type like `email-capture-modal` that the Success screen template includes with `lock: { remove: true }`, and its behavior is state in the Interactivity store, not a router change (matches the target-state note that "Warnings are overlays managed by the store, not separate route changes" — same pattern).

Small wrinkle: your `submit_reply()` is a one-shot write. The email capture happens **after** the reply is already saved. Two options:

- Add a second endpoint: `POST /invitation/reply/:id/email` that updates an existing reply row.
- Add `email` and `consent_*` fields to the existing submit payload and let the client decide whether to include them before first submit.

I'd go with the second endpoint — it matches the UX (email modal is shown after success) and keeps the two flows independent.

---

### Since it's dinner time Saturday, suggested order of operations

1. **After dinner tonight (~1–2 hrs):** Pull the old React/Next.js codebase. Just read the warning screen files and the upload logic. No porting.
2. **Sunday morning (~3 hrs):** The Interactivity + XHR-survival spike. Hard cap. If green, we proceed to Step 1 of the plan Sunday afternoon.
3. **Sunday afternoon/evening:** Files 1–3 of the plan (CPT registration, seed function, render-one-screen REST endpoint). Get `threadplan.com` hosting a working intro+record screen pair by bedtime.
4. **Monday:** Remaining screens, warnings, email modal, admin screen drill-down.
5. **Monday night:** Final zip to threadplan.com, smoke test on two phones, fix critical issues only.

Want me to start with file 1 (`includes/class-post-types.php` for the new `clipisode_screen` CPT registration) after you've done the dinner + old-codebase pass, or would you rather I draft the Interactivity+upload spike first? My recommendation is the spike first — if it fails you want to know tonight or early Sunday, not Monday.

---

# Prompt

I pulled the old Clipisode repo into a local repo folder called "clipisode-2021-public-web" — how do I switch so you can see that code and how the old invitation screen code worked and then switch back to the current "clipisode" repo?

# Response

Good news: you don't actually need to switch. I can already see it.

The old repo is at `/Users/brianalvey/Documents/GitHub/clipisode-2021-public-web` (I just confirmed the directory listing — it was touched today at 19:34, so it's fresh). I also noticed two other old repos next to it that may be relevant:

- `clipisode-2021-public-web` — what you just pulled.
- `brands.clipisode.com` — likely the old CMS/portal (the "brand" side where hosts managed topics).
- `clipisode.com` — likely the old marketing/public site.

### Three options, in order of how I'd pick

**1. Easiest — just tell me what to read (no switching).** My Read, Grep, and Glob tools all accept absolute paths. I'm not locked to your current workspace. You can literally say "read the recording flow in `clipisode-2021-public-web`" or "show me how they did the silent-audio check" and I'll point the tools at `/Users/brianalvey/Documents/GitHub/clipisode-2021-public-web/...`. This is what I recommend for this session because it preserves our conversation context — no lost plan, no re-explaining.

**2. Add it to your workspace (both repos visible in one Cursor window).** `File → Add Folder to Workspace`, pick `clipisode-2021-public-web`. Cursor will ask to save the workspace as a `.code-workspace` file (you could overwrite `clipisode.code-workspace` which already exists at the parent directory). Both repos then show in the left sidebar. Our chat stays intact. This is the right long-term setup if you expect to cross-reference them often.

**3. Open a second Cursor window.** `File → Open Folder` → `clipisode-2021-public-web`, and choose "Open in New Window." You get a fresh Claude session there; `Cmd+`` switches between windows. Downside: that new chat has none of this context. You'd have to re-brief me or copy/paste the plan over.

### What I suggest you do

Stay right here. Give me one sentence like:

> The old repo is at `/Users/brianalvey/Documents/GitHub/clipisode-2021-public-web`. Find the files that handle (a) the recording screen and upload, (b) the silent-audio warning, and (c) the wide-video warning, and summarize what they do.

I'll do that pass from within this same conversation, keep the refactor plan in context, and at the end tell you exactly which patterns to port into the new Interactivity API store vs. which to leave behind.

While you're at it, a question for you: do you want me to look at `brands.clipisode.com` too? If the old invitation flow had any server-side logic (not just the client JS), it probably lived there — things like the upload endpoint, transcoding trigger, and social-handle validation. Worth knowing before I start.

---

# Prompt

brands.clipisode.com was the CMS that brands used to see the replies they got and manage campaigns, now called topics. that all runs in the WordPress CMS now. no need to look in there right now. and the clipisode.com repo definitely had the marketing site home page, but I also see Invitation page code in there. they won't be much different from each other as the company was acquired and the platform shut down at the end of 2021, but they could be! how can we tell which one is newest?

# Response

`clipisode.com` is the newer one — by about **10 months**, and clearly the right one for our purposes.

### Evidence

| Signal | `clipisode-2021-public-web` | `clipisode.com` |
|---|---|---|
| Latest git commit | **2020-12-07** (Max Schmeling) | **2021-10-21** (you) |
| Framework | Hand-rolled SSR (`src/browser.ts` + `src/server.ts`) with Webpack + Apollo | Next.js 12-era with `pages/` directory |
| Node engine | 11.12 | 14.x |
| Has `pages/invitation/` | no | **yes** |
| `@clipisode/theme` dep | no (uses bespoke styled-components) | yes, v0.0.8 |

Two things worth flagging:

1. **Folder name is misleading.** Despite being called `clipisode-2021-public-web`, its last commit is from late 2020. It was named by whoever ZIPed or cloned it long after it stopped being worked on.
2. **Design-token continuity.** The newer `clipisode.com` depends on `@clipisode/theme` (v0.0.8 at the time). Your current WordPress plugin depends on `@clipisode/theme` v1.1.1 — same package, just a newer version. So colors, spacing tokens, and typography decisions have a lineage. Keep that in mind if you want the new invitation flow to feel visually consistent with the 2021 version.

### How to tell in general (quick tricks)

For any two local repos, these four signals together answer "which is newest":

```bash
# 1) Latest commit date on any branch
cd /path/to/repo && git log --all --format="%ci" | sort -r | head -1

# 2) Current branch head date (what you'd run, reality check)
git log -1 --format="%ci %n%s"

# 3) Compare package versions / frameworks — often tells you more than dates
head -20 package.json

# 4) Look at directory mtimes of the feature you care about
ls -la path/to/feature_folder
```

### My recommendation

Use `clipisode.com/pages/invitation/*` first. If specific logic we want (e.g. the silent-audio check, wide-video detection) is missing there — possible if it was deemed legacy and not ported to Next.js — we fall back to the older `clipisode-2021-public-web/src/client/` tree.

Want me to read `clipisode.com/pages/invitation/` now and give you a summary of:

- The screen list and order they implemented
- How they detected camera/silent/wide warnings
- Upload chunking / progress UI details worth porting
- Anything specifically about the email+consent modal on the success screen

Or hold off until after you've had a chance to skim it yourself?

---

# Prompt

Yes, please read clipisode.com/pages/invitation/ now and give me those summaries.

# Response

Read all the key files. Here's the summary, structured the way you asked.

## Screen list and order

The 2021 mobile reply flow had **10 distinct UI pieces** (9 from your spec, plus a Closed state and a Rotate warning):

| # | Screen/Overlay | When it shows | How |
|---|---|---|---|
| 1 | `ClosedScreen` | `invitation.off === true` | Replaces whole view before the flow even starts |
| 2 | `IntroScreen` | state: `waiting.watching` \| `waiting.recording` | Page view |
| 3 | `WarningCamera` | state: `waiting.recording` (user pressed record, no file came back) + iOS only | Modal overlay with arrow graphic |
| 4 | `FileValidator` (invisible) | state: `replying.uploading.validating` | Off-screen `<video>` element, no UI |
| 5 | `NameForm` | states: `replying.dataEntry` \| `submission` \| `emailCollection` | Page view |
| 6 | `WarningSilent` | `context.videoIssue === 'MISSING_AUDIO'` | Modal overlay |
| 7 | `WarningWide` | `context.videoIssue === 'WIDE'` | Modal overlay |
| 8 | `WarningNetwork` | `prepareFailure` ‖ `uploading.failed` ‖ `submission.error` | Modal overlay with Retry |
| 9 | `EmailForm` | state: `emailCollection` (only if topic has brand lists) | Full-screen modal, skippable |
| 10 | `WarningRotate` | always in watching, CSS @media orientation controls visibility | Full-screen overlay |
| 11 | Success page | navigates to `/invitation/[code]/success` on `confirmed` state entry | **Separate Next.js route** |

Two things worth calling out:

- **Success is a separate route, not a screen in the orchestrator.** Entering `confirmed` runs `router.push('/invitation/{code}/success')`. On that route, if localStorage doesn't have a `clipisode:inv:{code}:confirmed` flag, it redirects back to the invitation. This is their "prevent deep-linking to success" guard.
- **Closed is checked before anything else renders.** `if (invitation.off) return <ClosedScreen />`. This is worth replicating — your current `invitation.php` template handles the equivalent case at the PHP level, which is cleaner actually.

## The state machine — the key architectural insight

They used XState with a **parallel state** construct. This is the single most important pattern to port, and it directly validates your target-state architecture:

`clipisode.com/components/invitation/ReplyFlow/Mobile/state/index.ts` lines 127–181:

```ts
replying: {
  type: "parallel",
  states: {
    uploading: {
      initial: "validating",
      states: {
        validating: { on: { FILE_VALID: "prepare", FILE_INVALID: { /* ... */ } } },
        invalid:    { on: { ACCEPT_INVALID: "prepare", REJECT_INVALID: /* ... */ } },
        prepare:    { invoke: { src: "createUploadUrl", onDone: "progressing", onError: "prepareFailure" } },
        prepareFailure: { on: { RETRY: "prepare" } },
        progressing: {
          invoke: { src: "upload" },
          on: {
            UPLOAD_PROGRESS: { actions: assign({ uploadProgress: (_, e) => e.progress }) },
            UPLOAD_SUCCESS:  "complete",
          },
        },
        failed:   { on: { RETRY: "progressing" } },
        complete: { type: "final" },
      },
    },
    dataEntry: { initial: "unlocked", /* ... */ },
  },
  onDone: "submission",
},
```

What "parallel" means in English: `uploading` and `dataEntry` are running **simultaneously**. The machine only leaves `replying` when **both** sub-states reach `final`. So:

- Upload enters `validating` as soon as a file is chosen.
- Simultaneously, `dataEntry` is `unlocked` → the name form is editable.
- User types name while upload progresses. Every XHR progress event dispatches `UPLOAD_PROGRESS`, which the parallel `uploading` state assigns to `context.uploadProgress`. The name form reads that context to show the percentage in its heading.
- When user submits the form, `dataEntry` moves to `locked` (final).
- When the upload finishes, `uploading` moves to `complete` (final).
- Both finals → `onDone` → `submission`.

**This is exactly the model you need to port into the Interactivity API store.** The store has two independent slices — `upload` and `form` — both mutating in parallel, neither blocking the other. The screen you show is derived state (`state.uploading === 'complete' && state.form === 'locked' ? show-submit-result-spinner : show-name-form`). No router transition, no DOM remount. The Interactivity API router handles the bigger transitions (Intro → Record, Confirmed → Success), but the Record↔Name relationship is just derived state within one region.

This matters for your de-risk spike tomorrow: the XHR survival problem evaporates if Record and Name are in the **same Interactivity region** and the "transition" between them is just `state.screen = 'name'`. The upload XHR never leaves the store. The only router hop during upload would be to Success, which only happens after upload is done.

## Warning detection mechanics

### Silent-audio and wide-video (the gold)

Single file, `FileValidator.tsx`. It's rendered as a React null component — it exists only for the side effect in `useEffect`. Here's the approach in English:

1. Create an off-screen `<video>` element, add to DOM (display: none).
2. Load the chosen `File` into it via `FileReader.readAsDataURL`. This triggers the browser to decode the file's metadata.
3. On `loadeddata`:
   - Check `videoWidth >= videoHeight` → emit `"WIDE"`.
   - Check audio via either `video.audioTracks` (Chrome, newer Safari) or `video.mozHasAudio` (Firefox).
   - If there's a way to check and no audio tracks → emit `"MISSING_AUDIO"`.
   - If there's no way to check (old browser) → assume valid.
4. Two safety mechanisms:
   - **10-second timeout** calls `onValid` and removes the element. Prevents stuck state if the file is huge or the decoder hangs.
   - **Error listener 500ms after `loadstart`** — if the video element has an `error`, call `onValid` (fail open rather than block the user).
5. Skip validation entirely if file is >80MB (the FileReader would OOM on mobile).
6. Cleanup on unmount removes the element and clears the timeout.

The aspect-ratio check is trivially portable to any JS context — no framework dependency. The audio check is the only cross-browser subtlety, and they've already done the work. Port this file close to verbatim.

### Camera warning (iOS in-app browsers)

Interesting pattern. Key decisions:

1. **No API call to detect** — they inferred it from state. When the user taps "Record" in an in-app browser (Instagram, Facebook, TikTok, etc.), the file picker either opens the camera or silently does nothing. You can't detect "file picker was suppressed" directly. So:
2. `RECORD_PRESS` moves state to `waiting.recording`.
3. After **500ms**, `WarningCamera` renders its overlay. The delay is so legitimate users (whose camera opened) don't see a flash.
4. If the user actually picks a file within that window (or after), `FILE_CHOSEN` fires and moves state to `replying` — the warning disappears.
5. If no file, the warning persists and the user dismisses or sees guidance.
6. `hostApp` detection (Instagram/Facebook/Snapchat/LinkedIn/Twitter/Messenger) drives the copy: each in-app browser has its own "tap the 3-dots and choose Open in Safari" variant.
7. **iOS only** — `if (os !== IOS) return null`. Android handles in-app browser camera access differently.

Port-worthy. The detection strategy is the right one for you too.

### Network warning

Purely a failure aggregator. Three error states in the machine all map to the same modal overlay:

- `replying.uploading.prepareFailure` — S3 signed-URL mutation failed
- `replying.uploading.failed` — S3 PUT failed
- `submission.error` — final GraphQL submit failed

One `RETRY` event, dispatched from the modal, re-enters whichever state you came from.

Your WP plugin has fewer failure modes (single POST to `/invitation/upload`, no presigned-URL round-trip), so this collapses to two states: upload failure and submit failure. Still worth the same modal pattern.

## Upload + progress UI

Their upload is fundamentally **different** from yours and I'd **not port it**. Here's why:

**2021:**

1. Client calls `createUploadUrl` mutation → server returns signed S3 URL + object key.
2. Client PUTs the file directly to S3 with `Content-Type: file.type`.
3. Client calls `createClipForInvitation` mutation with `uploadedObjectKey` + name/social.

`clipisode.com/components/invitation/ReplyFlow/Mobile/state/services/upload.ts` lines 27–32:

```ts
request.open("PUT", context.uploadUrl, true);
request.setRequestHeader("Content-Type", context.file.type);
request.send(context.file);
```

**Your current WP plugin:**

1. Client POSTs file directly to `/clipisode/v1/invitation/upload`.
2. Server creates a `clipisode_media` row, stores file locally.
3. Client POSTs name/social to `/clipisode/v1/invitation/submit` with the `media_id`.

Yours is simpler, runs through your WP stack, doesn't need S3. Keep it. The useful patterns to port are:

- **Progress events dispatch to the store, not to the DOM.** `callback({ type: 'UPLOAD_PROGRESS', progress: (loaded/total)*100 })`. This is the exact line that makes the upload survive screen transitions.
- **XHR cancel via message channel.** `onReceive` callback on the XState service receives a `CANCEL_UPLOAD` event and calls `request.abort()`. If you add a "cancel upload" button later, this is the pattern.
- **Separate error handling for `upload.error` and `upload.timeout`.** Both emit the same event in their version — fine to collapse.

And the **UX detail worth stealing right now**:

`clipisode.com/components/invitation/ReplyFlow/Mobile/NameForm/index.tsx` lines 95–104:

```tsx
<h1
  id="nameScreenHeading"
  className="text-center font-heading font-extrabold p-0 text-2xl"
>
  {uploadComplete
    ? siteData.nameScreen.titleHitSave
    : siteData.nameScreen.titleUploading.replace(
        "UPLOAD_PERCENTAGE",
        Math.round(uploadProgress ?? 0).toFixed(0)
      )}
</h1>
```

The name screen's **heading** is the upload status. Not a separate progress bar tucked into a corner — the h1 literally says "Uploading 42%" until done, then switches to "Hit save." That's a confident UX decision that makes the parallel upload invisible to users (they just see the form, and the heading happens to be informative). Worth matching.

Also: Intro screen has **two separate file inputs**:

`clipisode.com/components/invitation/ReplyFlow/Mobile/IntroScreen/index.tsx` lines 72–95:

```tsx
<input className="hidden" type="file" id="upload" accept="video/*" onChange={/* ... */} />
<input
  type="file"
  className="hidden"
  id="record"
  accept={
    os === OperatingSystem.ANDROID
      ? "video/*"
      : "video/mp4,video/*;capture=camcorder"
  }
  onClick={onRecordPress}
  capture={os === OperatingSystem.ANDROID ? "camcorder" : "user"}
  onChange={/* ... */}
/>
```

Two labels, one for each (`#record` opens camera, `#upload` opens gallery). Android and iOS have different `capture`/`accept` strings. Your current plugin has one generic `<input type="file" accept="video/*" capture="user">`, which is fine-ish but inferior. Port this.

## Email + consent modal

Almost perfectly matches your spec. Confirming the key details:

**Trigger:** After successful submit. The state machine has a guard:

```ts
submitting: {
  invoke: {
    src: "submit",
    onDone: [
      {
        target: "#replyFlow.emailCollection",
        actions: [ "storeName", assign({ assetId: (_, event) => event.data }) ],
        cond: "shouldCollectEmail",
      },
      {
        target: "#replyFlow.confirmed",
        actions: "storeName",
      },
    ],
```

`shouldCollectEmail` checks `invitation.lists?.length > 0` — i.e., only show the email modal if the topic (ask/brand) has any configured mailing lists. If no lists configured, skip straight to `confirmed`.

**UI:** Full-screen overlay (`#emailScreenOverlay`), not a small popup. Contents:

- Heading (from theme `siteData.emailScreen.title`)
- Email input (prefilled from localStorage `clipisode:reply:email`)
- One checkbox per `brandList`, each with its own description HTML. Some lists are `prechecked: true`.
- Validation via Formik+yup: email required and valid format; at least one list must be checked.
- Primary "Subscribe" button (disabled until `values.lists.length > 0` — note this is stricter than the yup schema).
- Secondary "Skip this" text button that dispatches `SKIP_EMAIL_SUBMISSION` → jumps to `confirmed`.

**Submit path:** `SUBMIT_EMAIL_ADDRESS` event → enters `emailCollection.submitting` → invokes `submitEmail` service → calls `createBrandListItems` mutation with `{emailAddress, lists, assetId}` → onDone: `confirmed`. Notable: this is a separate server call, not part of the reply submission. The reply is already saved at this point; this just associates the guest with brand mailing lists.

**This aligns with what I proposed earlier:** expose a separate endpoint (`POST /invitation/reply/:id/email-capture` or similar) that's called after the reply exists. Your WP plugin already saves the reply in `submit_reply()` and returns `reply_id`; you'd wire the modal to POST `{reply_id, email, lists[]}` to the new endpoint, which writes to `clipisode_replies.email` and a new `clipisode_reply_list_subscriptions` table (or to whatever mailing-list system you choose).

One UX choice worth pondering: their email modal appears **before** the success page. Your spec says it's "on top of" the Success screen. Both work, but the 2021 version is cleaner because Success is a separate route — email is "still part of the reply flow," and Success is the "you're done" confirmation. In Interactivity API terms: `state.screen === 'email-capture'` is its own screen, and only transitioning past it (via submit or skip) routes to Success.

## What to port, what to skip, what to note for later

**Port (directly or near-directly):**

- `FileValidator.tsx` — silent-audio + wide-video detection. The 10-second timeout and error-handling safeties. Near-verbatim port to a store action.
- The parallel state topology: upload and dataEntry run concurrently, both must finish before submission. This is your IAPI store architecture.
- The WarningCamera 500ms-delay approach for iOS in-app browsers. Port the `hostApp` detection too (it shapes the copy).
- Two file inputs on Intro (one `capture`, one not) with OS-specific `accept`/`capture` strings.
- Name screen's upload-percentage-as-heading pattern.
- `confirmedKey` localStorage guard so the Success URL can't be deep-linked.
- Name/social prefill from localStorage.

**Skip (deliberately):**

- The presigned-S3 upload flow. Your WP plugin's direct-POST flow is simpler and already working. Different storage model entirely.
- XState library dependency. The Interactivity API has its own store primitives; you don't need xstate. Port the state shape, not the library.
- Apollo + GraphQL. Your plugin uses `apiFetch` to REST endpoints. Convert the mutations to REST calls.
- `convertMarkup` and the `siteData` theme system. Gutenberg block templates + block attributes replace it.
- `@clipisode/theme` package specifically for `SiteData` types. Ignore; reverse-map those fields into WP-side block defaults.

**Note for later (post-demo):**

- The OpenInChromeWorkaround component for certain in-app browsers on iOS. Didn't read in full, but they had a workaround flow that essentially nudged users to open in Safari. Worth reading before v2.
- The `tag` URL parameter flow (UTM-style tracking for where a reply came from). Your schema has `reply.tag`; their client propagates it from `router.query.tag`. Easy to add, not demo-critical.
- Rotate warning. The 2021 code had a TO DO that says "convert rotate warning with Max" — they didn't finish it. You can probably do this as a pure `@media (orientation: landscape)` CSS overlay with zero state-machine involvement. Not demo-critical.
- `storeName` localStorage write is on submission success, which means if the user closes and reopens the invitation, the next guest on the same device gets the previous guest's name prefilled. Minor UX bug they never fixed. Consider clearing on confirmed.

## Bottom line for your Sunday spike

The 2021 architecture is essentially the architecture you described for the target state, down to the "warnings are overlays, not routes" detail. Your de-risk spike tomorrow gets easier with one refinement:

**Keep Record and Name (and Email) in a single Interactivity region with a `state.screen` variable.** The router only swaps at three points: the whole flow → Success, the whole flow → Closed, and possibly Intro → Record (optional, if you want the URL to change). Inside the record/name/email cluster, it's derived state on one store. That's what the 2021 parallel-state machine was really buying them.

If you do that, the XHR survival question goes away — the upload never leaves the store, the store never leaves the region, progress updates flow to whichever screen is visible. The spike becomes "does IAPI's router correctly preserve a region's store when navigating INTO it from Intro" (much easier to test) instead of "will XHR survive a router-driven swap of the record region itself" (hard and scary).

Ready for file 1 whenever you are. Before that, still want me to ask: one `clipisode_screen` CPT with `screen_type` meta, or nine separate CPTs? The 2021 code's screen inventory (10 including Rotate + Closed) tells me a single CPT is the right call — nine CPT registrations just to differentiate a meta field would be a lot of boilerplate for no gain.

---

# Prompt

Yes, replicate the two things that were good, like checking if the invitation link is Closed before rendering anything. Also add that we need a Closed screen! Is there any way to make the Closed screen trigger a redirect? Like once all invitations for a Marvel campaign are closed, anyone visiting those links gets redirected to marvel.com or a Disney+ sign up page? Just curious how that might work. In our old system, since you were plugging markup into a JSON config, you could serve up an iframe to either the destination site or an iframe that had JS redirect code.

When you say "Editors cannot change what the block says, only how it looks," does that mean they cannot change a heading or a label on a button? All strings should be editable, until we find one with a strong reason for locking it down.

FYI, I am using Automattic's WordPress Studio app for local previewing, not Local WP or MAMP. So either give me the ngrok steps needed to serve the localhost site from my laptop to my phone, or tell me the best way to make Studio sites previewable on phones.

You mentioned consent_mailing and consent_terms values. All replies have consent because we won't allow the invitation links to run without showing a link to the Terms form. But I see that we didn't account for the multiple checkboxes that can be shown along with the email capture. In the old system, we had a table of Lists and would add the emails to those lists. The only way these make sense is if the host creates a named list, like "Rolex Sweepstakes 2026" or "Property Brothers News & Deals" and we let them collect emails for those lists by showing the optional skippable Email + Checkboxes screen modal over the Success screen background. The host would turn on a list for this optional step and then they would either customize the string that gets shown along with the checkbox in the List editing screen for all appearances of the checkbox OR they could edit the string in the theme. What's the best way to customize the label like that? And how should those sign ups be stored? As a value on the reply record OR by adding the reply to a Lists record? It seems like a value on the reply record for each checkbox is the right way to go. And how will the hosts see what replies/emails opted into a certain list? By filtering the replies to show ones that said yes to a certain list? Or from the edit screen for a certain List record? I saw the question about the second endpoint, let's add that to capture the values beyond the first reply insert action.

In terms of adding and dropping tables and columns as we alter and test things, if someone installs the latest plugin a month from now, they won't see all of the tables we used for testing and deprecated, right?

You should have been able to see into the old codebase, so you can use the code we had for doing things like checking uploads for missing audio, right? So let's pull the logic for the warning screens from that code and let's add a way to trigger the warning screens and edit them in the block editor. Can you tell if they were a full screen or just a modal on top of the upload/name screen?

Let's get all of this answered so we can move on to your "Interactivity + XHR-survival spike" step.

It sounds like you are up to speed on the WordPress Interactivity API and how the old screen flow translates into it. True?

The OpenInChromeWorkaround component was purely an Android feature from what I can remember. Inside apps like Facebook, Instagram or Twitter on an Android phone always offered a three dots menu to allow a link to be opened into full Chrome, which was always better than running inside an app. On iPhone, the in-app browser experience was more smooth.

I found what the Rotation Warning screen looked like. It was these styles:

```css
const OrientationOverlay = styled.div`
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.85);
  color: white;
  text-align: center;
  padding: 3em;
`;
```

Applied to this component:

```jsx
<OrientationOverlay className="landscape-only">
  <h1>Rotate your device</h1>
  <p>
    Clipisode records in portrait mode so your videos are shareable
    everywhere.
  </p>
</OrientationOverlay>
```

Yes, let's clear storeName from localStorage on Success. Also, we stored any values that were entered in a Reply in cookies so we could prefill things like Name and Email when someone would reply again. That was when all the invitation links ran from clipisode.com URLs. Now that this is a WordPress plugin, there won't be a lot of repeat replies. But maybe there will be for a high traffic site like rollingstone.com or nypost.com or NASA. So let's store those values in cookies and make them prefill. If we prefill a value the second time you reply to an invitation link for a certain domain, we'll just update the cookie value for next time.

What are the pros and cons of changing the URL when we switch between major screens? How did we do it before? Did /invitation/code/ always give the Intro screen and /invitation/code/success always showed the final success screen? I'd want to make it so if someone reloads or copies an invitation link to share, that the new person who loads it gets the Intro screen. I think we might have made it so if you load /invitation/code/success, but have no localStorage value, we redirect you to /invitation/code/ for the Intro screen. Let me know what you find.

Either way, yes, keep the single Interactivity region with a state.screen variable.

Yes, let's go with one clipisode_screen CPT with screen_type meta. Let's make sure they are records in WordPress that I can load into the block editor and edit. And once I've edited them to where I want them, I'll need a way to replicate them back into the code so we can use them as the starter theme alongside new themes which will be made by cloning the default theme.

# Response

Lots in here — answering in your order.

## 1. Closed screen with optional redirect

Yes, replicate the pre-render closed check (it's cleaner in PHP than JS anyway — no flash of intro before the closed message appears). And yes, redirects are easy in WordPress; you don't need the iframe trick.

Three escalating behaviors, all driven by config:

| Config | Behavior |
|---|---|
| `closed_redirect_url` empty | Render the Closed screen post (the new CPT entry) |
| `closed_redirect_url` set | `wp_redirect( $url, 302 ); exit;` before any HTML |
| `closed_redirect_url` set + `closed_redirect_mode = "iframe"` | Render an HTML doc with a single full-viewport iframe (rare, only for sites that block being framed elsewhere) |

A 302 is what you want for the Marvel/Disney+ case. Browser navigates away cleanly, no flash, search engines understand it's gone, the original `/invitation/{slug}` URL stops appearing in caches over time.

Where to store the URL: I'd put it on the **topic** (`clipisode_topics.closed_redirect_url`), with an optional override on the **invitation link** (`clipisode_invitation_links.closed_redirect_url`). The link-level override is rare but cheap to support — useful if Marvel runs three campaigns on the same WP install and they end at different times. The link-level value beats the topic-level value if both exist.

For the iframe mode you described from 2021: keep it as a config option but make it the exception, not the default. Use case is when the destination site sets `X-Frame-Options: DENY` and you want a redirect, not framing. In that case iframe-mode is wrong anyway. Maybe just drop iframe mode entirely and only support 302. Want me to drop it?

## 2. Editable strings — yes, edit by default

Sorry, I was sloppy in the earlier message. To clarify what was locked in your *current* code: only **data-driven** content was locked — things like `$topic->title` and `$topic->hosted_by`. The button labels (`'Record Your Reply'`, `'Save My Reply'`, `'Awesome… all done!'`) were hardcoded in `src/element/render.php` simply because nobody had wired them through to attributes yet, not because they were intentionally locked.

Going forward, the rule should be: **all human-readable strings are editable per theme.** Locking is structural — you can't *delete* the record button, but you can rename it to "Tap here to film" or "Start your story" or whatever. Same for the name input's label, the email modal's heading, the warning copy, everything.

The mechanism in Gutenberg terms: each typed `clipisode/element` block instance gets an attribute (`label`, or `title`, or `body_markup` — whichever fits the type) that the editor edits via `RichText` or `TextControl`. The render PHP falls back to a default string if the attribute is empty. Default strings live in code (one place to update copy across all unedited themes); edited themes override.

Data-driven strings (topic title, host name) remain server-pulled — those aren't theme copy, they're the topic's own data. Editors can choose **whether** to show them by including or removing the relevant element block, but they don't type the topic's title in the theme editor.

## 3. Studio + phone preview

Studio (Automattic's) is great for local dev but doesn't have a built-in tunnel for live phone testing. Its "Demo Site" feature uploads a snapshot to WordPress.com — fine for sharing with stakeholders, painful for active development because every code change requires a re-sync.

For active phone testing, ngrok is the right tool. Steps:

```bash
# 1) install
brew install ngrok

# 2) sign up at ngrok.com, copy your auth token, then:
ngrok config add-authtoken YOUR_TOKEN

# 3) find the local port your Studio site is running on
#    (in Studio: click your site → Settings → look for the "Site URL"
#    field, it'll be something like http://localhost:8881)

# 4) tunnel that port
ngrok http 8881
```

ngrok prints a public URL like `https://random-words-1234.ngrok-free.app`. That URL is HTTPS by default (necessary for camera access on iOS — iPhones won't grant camera permission to non-HTTPS sites).

**The catch you have to fix once:** WordPress stores `siteurl` and `home` in the DB as the Studio URL. When ngrok proxies a request from your phone, WP sees the request and rewrites internal links/assets back to `localhost:8881`, which your phone can't reach.

Fix: Studio lets you edit `wp-config.php` per site (Site → "Advanced" or open the site folder directly). Add this near the top, before the "stop editing" line:

```php
if ( ! empty( $_SERVER['HTTP_HOST'] ) ) {
    $protocol = ( ! empty( $_SERVER['HTTPS'] ) && 'off' !== $_SERVER['HTTPS'] ) ? 'https://' : 'http://';
    define( 'WP_HOME',    $protocol . $_SERVER['HTTP_HOST'] );
    define( 'WP_SITEURL', $protocol . $_SERVER['HTTP_HOST'] );
}
```

This makes WP think whatever host the request came in on **is** the site's URL — works for both `localhost:8881` (Studio direct) and `random-words.ngrok-free.app` (phone via ngrok). One file change, one time. You'll lose it if Studio resets the site, but you can keep a copy of the snippet handy.

Once ngrok is running, `https://random-words-1234.ngrok-free.app/invitation/abc123` should load on your phone and the camera button should work.

ngrok free tier limits: a few hours of session time, URL changes each restart, ~40 connections/min. All fine for solo development. Skip Cloudflare Tunnel for now; ngrok is faster to set up.

## 4. Lists model — let me push back gently

Your instinct ("value on the reply record per checkbox") works for fixed copy like "I agree to brand emails," but breaks the moment hosts can create their own lists. New list = schema migration. Bad. Here's the alternative I'd recommend, and why I think it's better:

### Tables

```
clipisode_lists
  id
  topic_id        (NULL = site-wide list, else scoped to one topic)
  name            "Rolex Sweepstakes 2026"
  description     "Get exclusive watch news from Rolex" (the checkbox label)
  status          'active' | 'archived'
  created_at

clipisode_reply_list_opt_ins
  id
  reply_id   (FK)
  list_id    (FK)
  email      (denormalized — same as reply.email but stored here too in case the
              reply.email gets updated later)
  opted_in_at
  UNIQUE(reply_id, list_id)
```

**`replies.email`** stays where it is — it's the email this guest provided. Many lists, one email. Whether the guest opted into 0 or 5 lists doesn't change `replies.email`.

### Why a junction table beats columns-per-list

- Adding a list = one row in `clipisode_lists`. No DB schema change.
- Removing a list = one row archived. No data loss, no column to drop.
- Counting "how many people opted into Rolex Sweepstakes 2026" = `SELECT COUNT(*) FROM opt_ins WHERE list_id = ?`. Fast, indexable.
- Exporting "all emails for Property Brothers News" = one join, easy.
- Two replies on the same site can opt into entirely different lists without anyone caring.

### Where the checkbox label comes from

Best default: **the List record's `description` field**, set when the host creates the list. One source of truth. Hosts edit "Property Brothers News & Deals — get weekly updates" once, and that copy appears next to the checkbox everywhere it shows up.

Theme-level override per list: skip for v1. The mechanism would be a meta on the theme post (`_list_overrides = { list_id: "different copy" }`), which is doable but adds editor complexity. Defer until a host actually asks for it.

What does live in the **theme** for the email screen: the heading ("Want to hear more from us?"), the email input placeholder, the submit button label, the skip-link label. List checkbox text comes from the List itself.

### Where hosts see opt-ins

Both views are useful, build the simpler one first:

1. **List edit screen** has a "Subscribers" tab: shows all (email, opted_in_at, link to source reply). Easy to filter, easy to export to CSV. **This is the primary view** — when Rolex emails you "we want our list," you go to that list and click Export.
2. **Reply list filter** — a dropdown filter "Replies who opted into [List X]". Useful for moderating ("show me only the replies from my Rolex Sweepstakes campaign"). Build second.

For demo: the List edit screen with Subscribers tab is enough. Filtering on replies can be Monday-night work or v2.

### Endpoint shape

`POST /clipisode/v1/replies/:id/opt-ins` with `{ email: string, list_ids: number[] }`. Validates the reply belongs to a topic that has those lists enabled, validates the user passed the same `_clipisode_nonce` they had on the slug. Updates `replies.email`, inserts opt-in rows. Returns `{ ok: true }`.

If `list_ids` is empty (user clicked Subscribe with email but no checkboxes — actually the 2021 code disabled Submit in that case, but for safety): still update `replies.email`, no opt-in rows created. Skip = client just navigates to success without calling the endpoint.

## 5. Tables/columns lifecycle for fresh installs

Yes, your instinct is right with one caveat.

A **fresh install on a new WordPress site** runs `Clipisode_Database::create_tables()` which only creates the tables you currently define in that function. Tables you experimented with and removed from the function never exist on that site. Never get created. The user will never know they existed.

Your **own dev/test sites that participated in the experiments** are different. dbDelta doesn't drop. So if you create `clipisode_experimental_thing` on your local site Sunday and later remove it from the code, the table will sit in your local DB forever as an orphan. Doesn't matter for correctness — your code never references it — but disk hygiene gets messy. If you care, drop it manually in phpMyAdmin or write a one-time `DROP TABLE IF EXISTS` line that you remove after running it once.

Same applies to columns. dbDelta won't drop a deprecated column from existing installs, but it'll never create one on a fresh install if you remove it from the `CREATE TABLE` string.

For the demo timeline: don't worry about it. We're shipping zero production installs, just one threadplan.com test site. Whatever we leave behind on your machine and on threadplan.com is fine.

## 6. Warning screens — what they were

Going from the 2021 code:

| Warning | Type | Notes |
|---|---|---|
| WarningCamera | **Positioned overlay** with arrow graphic, anchored to top or bottom depending on host app | Shaded backdrop, not a centered modal — it's pointing at a UI element in the surrounding browser chrome |
| WarningSilent | **Centered modal** (used `<Modal>` component) | Two buttons: redo, continue |
| WarningWide | **Centered modal** (same `<Modal>`) | Two buttons: redo, continue |
| WarningNetwork | **Centered modal** | One button: retry |
| WarningRotate | **Full-screen overlay** (the styles you found) | No buttons, CSS-driven `.landscape-only` show/hide |

So three of five are centered modals, one is a positioned overlay-with-arrow, one is a full-screen overlay. For the WP plugin:

- Make modal warnings (Silent, Wide, Network) one shared block layout — they all have the same shape (heading, body, primary button, optional secondary). The `screen_type` meta on the post differentiates them.
- WarningCamera gets its own block layout because of the arrow positioning and host-app conditional copy. Different visual structure.
- WarningRotate doesn't need a CPT entry at all — it's a static CSS overlay. Maybe just `.ci-rotate-warning` rendered once in the page template, hidden by default, shown via `@media (orientation: landscape) and (max-width: 768px)`.

All are overlays on top of the current screen, not route changes — matches your target-state spec.

For "trigger and edit them in the block editor": each warning gets a row in `clipisode_screen` CPT with `screen_type = 'warning_camera' | 'warning_silent' | etc.` Editors can edit the title, body markup, button labels, and styles. **Triggers stay in code** — the state machine fires the warning when the right condition is met (audio missing, file is wide, network error). Editors don't get to configure when warnings fire; they configure how they look and what they say.

And yes, I read the 2021 logic and we'll port the FileValidator logic verbatim (well, refactored into an Interactivity store action — same algorithm, different host).

## 7. WordPress Interactivity API — am I up to speed?

Mostly yes. Honest accounting:

**Solid on:**

- `store('namespace', { state, actions, callbacks })` API and how it ties to `data-wp-on--click`, `data-wp-bind--*`, `data-wp-text`, `data-wp-class--*`, `data-wp-init`, `data-wp-watch`, `data-wp-context`, `data-wp-each`.
- `wp_interactivity_state()` PHP function for hydrating server-side initial state.
- `block.json` uses `viewScriptModule` instead of `viewScript` for IAPI scripts (and the build path).
- The runtime uses Preact internally; you don't need React in the theme runtime.
- Generators (`function* foo() { yield ... }`) for async actions that survive across renders.

**Want to verify against docs as we go (will tell you when):**

- The exact `@wordpress/interactivity-router` API for programmatic navigation (`actions.router.navigate(href, { force: true })`-ish, but I want to check the option names before writing it).
- Whether router region content swap is "replace inner HTML" or "replace whole region" — affects whether store state inside a region survives a navigation INTO it.
- Edge cases around closures inside generator actions — store proxies are usually fine but I've seen people hit issues with destructured locals.

What this means practically: when we hit those points, I'll either write a 5-line test file to verify or grep the IAPI source to confirm. Won't pretend I remember exactly.

## 8. OpenInChromeWorkaround — Android-only — noted

Won't port the 2021 code. We'll add an Android-aware "open in Chrome" hint inside WarningCamera if needed (probably not for the demo).

## 9. Rotation warning — pure CSS

Perfect, that simplifies things. Plan: a static `<div class="ci-rotate-warning">…</div>` rendered once in the page template (or as part of the IAPI region root). CSS:

```css
.ci-rotate-warning { display: none; }
@media (orientation: landscape) and (max-width: 1024px) {
  .ci-rotate-warning { display: flex; /* …your overlay styles… */ }
}
```

No JS, no state. Lives behind every screen, only visible when the device is in landscape and small (so a desktop browser at landscape doesn't trigger it). Title and body copy can still be theme-editable strings if you want — they're just two text nodes.

## 10. Cookies for prefill across invitations

Good plan, and worth doing — it costs almost nothing to add and the demo benefit is high. The mechanic:

- On successful submit, write three cookies: `clipisode_name`, `clipisode_social`, `clipisode_email`. Path `/`, max-age 365 days, `SameSite=Lax`, no `HttpOnly` (we need to read from JS).
- On flow init, read those cookies. If present, prefill the corresponding fields. Don't auto-submit — just prefill, user can edit.
- On any subsequent successful submit with different values, overwrite the cookies.
- On Success entry, also remove the localStorage `:confirmed` flag and any `:name`/`:social`/`:email` localStorage entries (you said clear `storeName` — extending to all the localStorage keys for cleanliness).

Privacy footnote: prefill cookies are a "preference" cookie, not a "tracking" cookie, but if any host targets EU users they should mention it in their terms. Cheap to disclose ("we may store your name and email locally so you don't have to retype them on future invitation links"). One sentence in the brand-terms default.

Code-wise this is ~30 lines of helper JS, all client-side. One spot to set, one spot to read. No server involvement.

## 11. URL changes between major screens — pros, cons, history, recommendation

Pros of changing URL on major transitions:

- Browser back button works as users expect.
- Deep-link to specific states for QA ("send me the URL where the warning appears" is impossible with one-URL state).
- Analytics become richer (pageviews per screen, funnel drop-off).
- Sharing the success URL is meaningful (with guard).

Cons:

- More complex routing config.
- Risk of stale state if not handled (someone bookmarks `/success` and shares it; recipient lands on a state that lies about what just happened).
- Harder to demo screens out of order during dev.

**How the 2021 system handled it** — exactly what you suspected:

- `/invitation/[code]` was the entire SPA. Watching, recording, name form, email form, all warnings — one URL, all state in xstate.
- `/invitation/[code]/success` was the only other route. Entered via `router.push` after the email modal completed (or was skipped).

`clipisode.com/components/invitation/ReplyFlow/Mobile/state/actions/confirmed.ts`:

```ts
export function confirmedKey(code: string) {
  return `clipisode:inv:${code}:confirmed`;
}

export const confirmed = (context: Context, _: Event) => {
  localStorage.setItem(confirmedKey(context.code), "true");
  context.router.push(`/invitation/${context.code}/success`, null, {
    shallow: true,
  });
};
```

And the success page guarded itself:

`clipisode.com/pages/invitation/[code]/success.page.tsx` lines 44–49:

```ts
useEffect(() => {
  if (!code) return;

  if (localStorage?.getItem(confirmedKey(code)) !== "true")
    router.replace(`/invitation/${code}`);
}, [code]);
```

If you load `/success` without the `:confirmed` flag in localStorage, you're sent back to `/`. Sharing the success URL doesn't leak access — recipients just bounce to the intro.

**Recommendation for your WP plugin: replicate this exactly.**

- `/{prefix}/{slug}` — Intro through Email, all 7 main screens, single Interactivity region with `state.screen` driving which is visible. URL doesn't change as user moves through them. Reload always lands on Intro (because `state.screen` defaults to `intro` on init). Sharing the URL gives the recipient a fresh Intro.
- `/{prefix}/{slug}/done` (I'd use `/done` over `/success` — fewer connotations) — separate WP rewrite, separate template. Renders the success screen with a localStorage guard. If `clipisode:inv:{slug}:confirmed !== "true"`, JS redirects to `/{prefix}/{slug}`.

Two rewrite rules instead of one. A small bit of router glue. And you get the back-button-works, analytics-clean, no-state-leak benefits with no real downside.

What you gain that you don't get from a single-URL flow:

- "Reload during the upload" doesn't lose state? — actually no, it does, because reload is a full page load. But that's true in both designs. The localStorage prefill of name/social/email mitigates it.
- "User shares /done" doesn't leak — guard handles it.
- "I want to test the email modal directly" — you'd add a `?screen=email` query param trick during dev, not a real route. Trivial in IAPI.

## 12. Single Interactivity region — confirmed

Locking in.

## 13. CPT records → block editor → back to code

This is a great workflow question. Here's what I'd build:

**Storage shape:**

- One CPT: `clipisode_screen`. Supports `title`, `editor`, `custom-fields`, `revisions`. Uses `post_parent` to nest under the parent theme post (`clipisode_invite`).
- One required meta: `screen_type` (the discriminator: `intro`, `intro_desktop`, `name`, `email`, `success`, `closed`, `warning_camera`, `warning_silent`, `warning_wide`, `warning_network`, `warning_rotate`).
- `show_in_rest = true`, `rest_base = 'clipisode-screens'` so the IAPI router can fetch them.

**Editor experience:**

When you open a `clipisode_screen` post in the block editor:

- The mobile-width preview lock you already have for `clipisode_invite` is extended to the new CPT.
- The `templates` array on the CPT registration is **driven by `screen_type`**: opening a `screen_type = 'intro'` post boots the editor with the intro screen's required blocks (record button, terms link, etc.); opening `screen_type = 'email'` boots with the email modal's blocks.
- A custom Document sidebar panel (via `registerPlugin`) shows screen-type-specific editor controls (e.g. Closed screen panel has "Redirect URL" field that writes to `closed_redirect_url` on the parent topic).
- Each typed element block has `lock: { remove: true }` for required elements, `allowedBlocks` whitelist on the parent.

**Default theme seeding (what the user sees after activating the plugin fresh):**

I'd avoid hardcoding 11 long PHP heredoc strings. File-based is cleaner:

```
plugin/clipisode/assets/themes/default/screens/
  intro.html
  intro-desktop.html
  name.html
  email.html
  success.html
  closed.html
  warning-camera.html
  warning-silent.html
  warning-wide.html
  warning-network.html
  warning-rotate.html
```

Each `.html` is the Gutenberg block markup for that screen — exactly what `post_content` would contain. On activation, `ensure_default_theme()` reads each file and creates one parent theme post + 11 child screen posts, idempotent (skip if already present and matches a hash).

**Your "edit in the block editor, replicate back to code" workflow:**

A WP-CLI command (or an admin button — I'd do CLI for solo dev, button for shareable):

```bash
wp clipisode export-default-theme
```

For each child screen post under the default theme, this:

1. Reads `post_content`
2. Strips dynamic values (the slug context attribute, anything with the topic ID)
3. Writes back to the corresponding `assets/themes/default/screens/{screen_type}.html` file in the plugin directory

You commit the changes. Next plugin activation, anywhere, gets your latest design.

The "clone the default theme" feature for hosts is unrelated to this dev workflow — it's a button in the admin "Themes" list that does:

1. Read default theme parent post + all child screens.
2. Copy them as a new theme parent + new child screens.
3. The host edits the clones; the original default stays pristine.

Already partially in your `src/pages/ThemeList.tsx`. Just needs to extend to also clone children.

---

## Where this leaves us before the spike

I have answers committed for: closed redirect (302 from PHP, with optional iframe mode probably dropped), strings editable everywhere, ngrok over Studio's demo feature, junction table for list opt-ins, file-based default theme + WP-CLI export, two-route URL design (`/{slug}` and `/{slug}/done`), warnings as overlays inside one IAPI region, FileValidator port verbatim, rotate warning as pure CSS, cookies for prefill, single CPT + screen_type meta.

The single thing I'd still verify before file 1: **whether the IAPI router preserves region-local store state when navigating from `/{slug}` to `/{slug}/done` and back.** That's the real version of the de-risk question. If the router keeps the store alive across the route change (it should, for same-region same-namespace), we're set. If it doesn't, the upload XHR can finish before the route change anyway (we only navigate to `/done` after submit succeeds), so we're still set.

Spike scope (smaller now, given how much we've decided):

1. Two routes (`/test/main` and `/test/done`) registered as IAPI regions with the same `data-wp-interactive` namespace.
2. Main route has a file input and a button "go to done."
3. Picking a file starts an XHR to a slow endpoint (use a public 30-second-delay endpoint or your local server with `sleep(30)`).
4. Inside the upload action, store updates `state.uploadPct` on each progress event.
5. Click "go to done" mid-upload → router navigates to `/test/done`.
6. `/test/done` renders `<p data-wp-text="state.uploadPct">` and a "go back" button.
7. Verify on phone: progress bar continues ticking on `/done`. Going back to `/main` shows the (now-completed or still-progressing) state.

If that works (I'd bet 90% it does), the architecture is locked. If it doesn't, fall back to never navigating mid-upload — only navigate to `/done` after `state.uploadComplete && state.submitted`. The XHR question disappears because the navigation only happens post-upload.

Either way, I want to write that test before any production code. Want me to start drafting the spike now (in Ask mode I can give you the files to drop in, you run them, we read the results), or sleep on it and start fresh tomorrow morning?

---

# Prompt

If we have the Closed screen as an option in the theme for showing a full screen mobile message, then adding a redirect value to the Topic that overrides showing the Closed screen works great. The iframe mode for Closed screens was a hack that we don't need to support. We would also not offer an iframe for the Success screen, but use your redirect value instead. And to be clear, the closed_redirect_url value would live on the Topic, but it would only show if the Invitation Link you visited is closed. Not for the invitation links which are still open for replies.

Having all human-readable strings be editable per theme is great and let's users localize the labels.

I saw that Studio really, really wants you to push site snapshots to WordPress.com for previewing. Not my favorite. I will use ngrok and your instructions.

Your Lists model and checkbox label storage all make sense. Good plan. Yes, skip the theme-level override of List labels for v1. Agreed: List edit screen with Subscribers tab is enough. Agreed: Filtering replies by lists goes into the backlog.

I looked into our Slack archive to see why we had the OpenInChromeWorkaround. It was because a handful of Android apps flat out did not supported file uploads for webpages inside their app. This was the code that checked to see if you're in one of those apps or not:

```ts
if (os === OperatingSystem.ANDROID) {
    if (hostApp === SourceNetwork.Instagram) overlayNetwork = "Instagram";
    else if (hostApp === SourceNetwork.Facebook) overlayNetwork = "Facebook";
    else if (hostApp === SourceNetwork.Snapchat) overlayNetwork = "Snapchat";
    else overlayNetwork = "current app's";
  }
```

That returned strings for the overlay warning that showed an arrow telling people to click the three dots at the top right and choose "Open in Chrome" to reply. There's an error in that code block, because it only needed to check for Android Facebook, Instagram and Snapchat and any other value should be treated like iOS. So the last line didn't make sense.

The message format for this Chrome workaround looked like this:

> Heading: Hang on
> The [current app's|Facebook|Snapchat|Instagram] browser doesn't support direct camera uploads on Android.
> Heading: Good news
> Just tap the three dots menu and choose "Open in Chrome" to send your request to HOST_NAME.

Yes, don't auto-submit cookie values, just prefill.

Yes, replicate the transitions between major screens just like we did it in 2021. Regular URL or /success, but if you share /success and someone loads it without the cookie/storage value set, we send them to the intro screen. I also like the ability to target a certain screen using querystring parameters. Nice. And you said to use /done instead of /success. Sure. Do that. But I have another suggestion that might prevent people from sharing an /invitation/code/done link anyway. Can't we say that when someone makes it to /done that we do a URL change (client-side nav or whatever) that changes the URL to /invitation/code without reloading the intro screen? So it sets the success cookie/storage and shows the Success screen, but cleans up the URL in case it gets copied. Does that work?

If we do the default theme seeding via HTML files, I can just do the changes I want in either the block editor or the HTML files and once I have them how I like them, I can update the HTML in code. This works great. I would like to have a button to write those to disc instead of using a CLI. Great idea. Instead of having this be the action "wp clipisode export-default-theme" I'd have it be "wp clipisode export-theme" with a theme name/slug/ID parameter.

Your IAPI router test sounds like fun. Is there anything else we need to answer before we dive in? If not, then yes start drafting the spike now.

# Response

Locking in the loose ends, then handing you the spike.

## URL design — your replaceState idea: yes, it works

Both pieces of what you described are sound:

1. Real router navigation to `/{slug}/done` after submit success → real pageview, real CPT post for the success screen rendered server-side.
2. `history.replaceState({}, '', '/{slug}')` immediately after, so the URL bar shows the clean URL.

Browser behavior:

- URL bar shows `/{slug}` — sharing is harmless.
- Reload → server renders `/{slug}` fresh → state.screen defaults to intro → user sees Intro. Matches your goal.
- Back button → since we replaced the `/done` history entry with `/{slug}`, going back leaves the invitation entirely, which is what we want.
- Analytics → both pageviews fire (the `/done` view exists for the millisecond between navigate and replaceState; analytics pixels usually capture on `popstate`/`navigate` events, not on URL bar inspection, so this is fine).

One subtle thing worth knowing: `replaceState` only updates the URL bar and the history entry. It does **not** trigger any router/page logic. So our server-rendered Success markup stays on screen until something else navigates away. Exactly what we want.

This does mean the spike has to verify router navigation to `/done` actually preserves store state, because we're relying on the IAPI router for the `/{slug}` → `/{slug}/done` jump. If the router doesn't preserve state, we drop `/done` entirely and just do `state.screen = 'success'` on the same URL. Both designs are in the spike.

## Other follow-ups (short)

**OpenInChromeWorkaround scope** — confirmed: only Android + Facebook/Instagram/Snapchat in-app browsers. Anything else is treated as fine. The fallback case in the 2021 code was indeed a bug. Heading/body copy you provided will be theme-editable strings.

**Closed redirect** — yes, only fires when the *visited link* is closed. The redirect URL is a topic-level field because it's "where to send people for this campaign when their link doesn't work," but the trigger is per-link status. Other open links on the same topic still serve the normal flow.

**`wp clipisode export-theme --theme=<id|slug>`** — agreed. Mirror it as an admin button later, but the CLI is the canonical interface.

## Pre-spike confirmation: nothing else blocking

Three small things I want you to know before you run it, none of them blockers:

1. **Run `Settings → Permalinks → Save Changes` once** after activating the spike. WordPress caches rewrite rules; the spike's two new URLs only resolve after a flush. Saving permalinks (without changing anything) flushes them.
2. **WP version requirement** — IAPI `viewScriptModule` and `wp_interactivity_state` need WP 6.5+. Your plugin already requires 6.5 (`Requires at least: 6.5` in `clipisode.php`), so fresh Studio installs will be fine. Verify on threadplan.com that WP is at least 6.5 before zip-dropping.
3. **HTTPS for camera access** — the camera button on iPhones requires HTTPS. ngrok provides HTTPS free-tier URLs by default, so you're good. If you ever test on plain `http://localhost:8881` from Safari on iOS, the camera silently won't work — that's not a bug.

## The spike — three files to drop in

The spike lives in a self-contained folder you can delete in one shot when done. No build pipeline (plain ES module). It does **not** need any changes to existing plugin code except a single `require_once` line at the bottom of `clipisode.php`.

### File 1: `plugin/clipisode/spike/spike.php`

```php
<?php
/**
 * Clipisode IAPI + upload-survival spike.
 *
 * Disposable. Verifies:
 *   - Two URLs (/clipisode-spike and /clipisode-spike/done) can register
 *     IAPI regions in the same namespace.
 *   - Router navigation between them preserves store state.
 *   - A long-running task (setInterval-backed fake upload) keeps mutating
 *     store state across that navigation.
 *   - state.screen=a|b swap inside a single region works via
 *     data-wp-bind--hidden.
 *
 * Setup:
 *   1. Add this line to the bottom of clipisode.php:
 *        require_once CLIPISODE_PLUGIN_DIR . 'spike/spike.php';
 *   2. Settings → Permalinks → Save Changes (flushes rewrite rules).
 *   3. Visit /clipisode-spike on your dev site.
 *
 * Teardown:
 *   - Remove the require_once line, delete the spike/ folder, save permalinks again.
 */

defined( 'ABSPATH' ) || exit;

add_action( 'init', function () {
    add_rewrite_rule(
        '^clipisode-spike/?$',
        'index.php?clipisode_spike=main',
        'top'
    );
    add_rewrite_rule(
        '^clipisode-spike/done/?$',
        'index.php?clipisode_spike=done',
        'top'
    );
} );

add_filter( 'query_vars', function ( $vars ) {
    $vars[] = 'clipisode_spike';
    return $vars;
} );

add_filter( 'template_include', function ( $template ) {
    if ( ! get_query_var( 'clipisode_spike' ) ) {
        return $template;
    }
    return __DIR__ . '/template.php';
} );

add_action( 'wp_enqueue_scripts', function () {
    if ( ! get_query_var( 'clipisode_spike' ) ) {
        return;
    }

    wp_register_script_module(
        'clipisode/spike',
        plugins_url( 'spike/store.js', CLIPISODE_PLUGIN_DIR . 'clipisode.php' ),
        [ '@wordpress/interactivity', '@wordpress/interactivity-router' ],
        '0.1.0'
    );
    wp_enqueue_script_module( 'clipisode/spike' );
} );
```

### File 2: `plugin/clipisode/spike/template.php`

```php
<?php
/**
 * Spike template — renders /clipisode-spike or /clipisode-spike/done.
 *
 * Both pages share IAPI namespace 'clipisode/spike'. wp_interactivity_state()
 * sets the initial state on each request; the IAPI runtime merges them so
 * state survives router navigation between the two pages.
 */

defined( 'ABSPATH' ) || exit;

$page = get_query_var( 'clipisode_spike' ); // 'main' or 'done'

wp_interactivity_state( 'clipisode/spike', [
    'uploadPct' => 0,
    'uploading' => false,
    'screen'    => 'a',
    'visited'   => 0,
    'path'      => '',
] );

show_admin_bar( false );
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo( 'charset' ); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex,nofollow">
    <title>Clipisode Spike — <?php echo esc_html( $page ); ?></title>
    <style>
        body { font: 16px/1.4 -apple-system, system-ui, sans-serif; padding: 24px; max-width: 480px; margin: 0 auto; }
        h1 { margin-top: 0; }
        button { padding: 10px 16px; margin: 4px 4px 4px 0; border: 1px solid #888; border-radius: 6px; background: #f7f7f7; cursor: pointer; font-size: 16px; }
        button.primary { background: #2d1b69; color: white; border-color: #2d1b69; }
        button:disabled { opacity: 0.5; }
        progress { width: 100%; height: 14px; }
        .row { margin: 16px 0; }
        .badge { display: inline-block; padding: 2px 10px; background: #eee; border-radius: 999px; font-size: 13px; }
        .stage { padding: 16px; border: 2px dashed #ccc; border-radius: 8px; margin: 16px 0; }
        [hidden] { display: none !important; }
        code { background: #f0f0f0; padding: 1px 6px; border-radius: 3px; }
    </style>
    <?php wp_head(); ?>
</head>
<body>
<div
    data-wp-interactive="clipisode/spike"
    data-wp-router-region="spike"
    data-wp-init="callbacks.init"
>
<?php if ( $page === 'main' ) : ?>

    <h1>Spike: <code>/clipisode-spike</code></h1>

    <p>
        Path seen by client: <code data-wp-text="state.path"></code><br>
        Page inits this session: <span class="badge" data-wp-text="state.visited"></span>
    </p>

    <div class="row">
        <strong>state.screen:</strong>
        <span class="badge" data-wp-text="state.screen"></span>
        <button data-wp-on--click="actions.toggleScreen">Toggle a ↔ b</button>
    </div>

    <div class="stage" data-wp-bind--hidden="!state.isScreenA">
        <h2>Screen A — "intro/record" stand-in</h2>
        <button
            class="primary"
            data-wp-on--click="actions.startFakeUpload"
            data-wp-bind--disabled="state.uploading"
        >
            Start fake "upload"
        </button>
        <div class="row">
            <progress max="100" data-wp-bind--value="state.uploadPct"></progress>
            <span data-wp-text="state.uploadPct"></span>%
        </div>
    </div>

    <div class="stage" data-wp-bind--hidden="state.isScreenA">
        <h2>Screen B — "name form" stand-in</h2>
        <p>Same store, same upload progress, no remount.</p>
        <progress max="100" data-wp-bind--value="state.uploadPct"></progress>
        <span data-wp-text="state.uploadPct"></span>%
    </div>

    <div class="row">
        <button data-wp-on--click="actions.gotoDone">Navigate to /done</button>
    </div>

<?php else : // 'done' ?>

    <h1>Spike: <code>/clipisode-spike/done</code></h1>

    <p>
        Path seen by client: <code data-wp-text="state.path"></code><br>
        Page inits this session: <span class="badge" data-wp-text="state.visited"></span>
    </p>

    <p>If the IAPI router preserved store state, the progress below
       should match what you last saw on /main, and continue ticking
       upward without restarting:</p>

    <progress max="100" data-wp-bind--value="state.uploadPct"></progress>
    <span data-wp-text="state.uploadPct"></span>%

    <div class="row">
        <button data-wp-on--click="actions.gotoMain">Back to /main</button>
        <button data-wp-on--click="actions.cleanUrl">replaceState → /clipisode-spike (URL only)</button>
    </div>

<?php endif; ?>

</div>
<?php wp_footer(); ?>
</body>
</html>
```

### File 3: `plugin/clipisode/spike/store.js`

Plain ES module — no build step. WordPress's script-module loader handles `import` resolution.

```js
import { store } from '@wordpress/interactivity';
import { actions as routerActions } from '@wordpress/interactivity-router';

const SPIKE_MAIN = '/clipisode-spike';
const SPIKE_DONE = '/clipisode-spike/done';

const { state } = store('clipisode/spike', {
    state: {
        get isScreenA() {
            return state.screen === 'a';
        },
    },
    actions: {
        toggleScreen() {
            state.screen = state.screen === 'a' ? 'b' : 'a';
        },
        startFakeUpload() {
            if (state.uploading) return;
            state.uploading = true;
            state.uploadPct = 0;

            const tick = () => {
                if (state.uploadPct >= 100) {
                    state.uploading = false;
                    return;
                }
                state.uploadPct = Math.min(100, state.uploadPct + 1);
                setTimeout(tick, 300);
            };
            setTimeout(tick, 300);
        },
        *gotoDone() {
            yield routerActions.navigate(SPIKE_DONE);
        },
        *gotoMain() {
            yield routerActions.navigate(SPIKE_MAIN);
        },
        cleanUrl() {
            window.history.replaceState({}, '', SPIKE_MAIN);
            state.path = window.location.pathname;
        },
    },
    callbacks: {
        init() {
            state.visited = (state.visited || 0) + 1;
            state.path = window.location.pathname;
        },
    },
});
```

A few notes on what's happening, since you're learning:

- `data-wp-interactive="clipisode/spike"` declares the namespace for everything inside.
- `data-wp-router-region="spike"` tells the IAPI router this is the region to swap on navigation. Both pages have it; both have the same name; the router knows to replace this element's contents on `actions.navigate(...)`, leaving the rest of the document alone.
- `data-wp-init="callbacks.init"` runs once per region mount. We use it to bump `state.visited` so you can see if the region remounts on navigation.
- `data-wp-bind--hidden="!state.isScreenA"` — the `hidden` HTML attribute is bound to a derived value. The runtime watches the dependency (`state.screen`) and toggles automatically. No manual show/hide.
- `data-wp-bind--value="state.uploadPct"` on a `<progress>` — same idea, just on the value attribute.
- `data-wp-text="state.uploadPct"` — sets the element's text content.
- Generators (`*gotoDone()`) are how IAPI handles async actions cleanly. `yield routerActions.navigate(...)` is awaited internally; the action keeps running across the navigation if there's more to do after the yield.
- The store proxy: when an action mutates `state.uploadPct`, the runtime detects the write and re-renders any binding that read it. No manual re-render calls.

## Setup steps (5 minutes)

1. Create the three files at the paths above.
2. Add this line to the bottom of `plugin/clipisode/clipisode.php`:
   ```php
   require_once CLIPISODE_PLUGIN_DIR . 'spike/spike.php';
   ```
3. In WP admin: **Settings → Permalinks → Save Changes**. (No actual change needed; saving forces a rewrite-rule flush.)
4. Visit `https://your-studio-url/clipisode-spike` in your laptop browser. You should see "Spike: /clipisode-spike" with the screen A stand-in.
5. Run `ngrok http <studio-port>` and open the ngrok URL on your phone, ending in `/clipisode-spike`.

## Test plan — what to verify

Run these in order. Each one tests something specific.

**Test 1 — within-region screen swap (5 sec)**

- Tap "Toggle a ↔ b". Screen A hides, Screen B shows. The badge under `state.screen` toggles. The progress bars in both stages share the same value.
- *Pass criterion: instant swap, no flicker, no network request.*

**Test 2 — long-running task survives navigation (30 sec)**

- Tap "Start fake 'upload'". Watch the progress bar tick from 0 toward 100. About 1% per 300ms, so 100 will take ~30 seconds.
- Around 30%, tap "Navigate to /done". URL changes to `/clipisode-spike/done`. The /done page loads.
- **Watch the progress bar on /done.** It should keep ticking — without restarting from 0.
- *Pass criterion: progress on /done is ≥ what it was when you tapped Navigate, and continues increasing.*
- *Fail mode: progress restarts at 0, or stays frozen at the value when you navigated.*

**Test 3 — back navigation preserves state (10 sec)**

- From /done with the upload still progressing, tap "Back to /main".
- Verify Screen A is shown again, the progress bar continues from where it left off, and the visited badge has incremented (you've seen /main twice now).
- *Pass criterion: same as Test 2, in reverse.*

**Test 4 — replaceState URL cleanup (10 sec)**

- Navigate to /done.
- Tap "replaceState → /clipisode-spike". The URL bar updates to `/clipisode-spike` *without* navigating. The Done content stays visible. The path display below the title updates.
- Try to share that URL — it's `/clipisode-spike`, the safe one. The Done state was never in URL form anyone could share.
- Reload the page. Server renders `/clipisode-spike` fresh → you see Screen A from the top.
- *Pass criterion: URL changed, content didn't, reload starts over.*

## What each outcome means

| Tests pass | Architecture conclusion |
|---|---|
| 1, 2, 3, 4 all pass | Two-route + replaceState design works. We use `/{slug}` and `/{slug}/done` exactly as planned. |
| 1 passes, 2 fails | IAPI router doesn't preserve store state across navigation. **Fall back to single-URL design** — drop `/done`, success is just `state.screen = 'success'` on `/{slug}`. Tests 3 and 4 don't matter then. Slightly worse for analytics, but functional. |
| 1 fails | This would be very surprising; data-wp-bind--hidden is the most basic IAPI primitive. If it fails, something's wrong with the IAPI runtime in your env (probably WP version). Investigate before proceeding. |
| 4 fails | replaceState is just a browser API; if it fails, the browser is broken. Won't happen. |

If everything's green by mid-morning Sunday, we move to file 1 of the real refactor: the `clipisode_screen` CPT registration. If Test 2 fails, we have a 30-second pivot — drop the second route and proceed with the simpler design.

Run through the tests when you get to it. Paste back what you see — particularly the value of `state.uploadPct` on /done in Test 2, and the visited counter behavior. I'll interpret and we'll either green-light or pivot.

---

# Prompt

I created the 3 files and added that line to the clipisode.php file. I am getting a lot of errors in WP Admin and the Studio dev site, including these, so we aren't close to being able to test your spike code:

```
Warning: file_get_contents(/internal/shared/consts.json): Failed to open stream: No such file or directory in /internal/shared/auto_prepend_file.php on line 4

Warning: foreach() argument must be of type array|object, null given in /internal/shared/auto_prepend_file.php on line 5

Warning: Cannot modify header information - headers already sent by (output started at /internal/shared/auto_prepend_file.php:4) in /wordpress/wp-includes/functions.php on line 7182

Warning: Cannot modify header information - headers already sent by (output started at /internal/shared/auto_prepend_file.php:4) in /wordpress/wp-admin/admin-header.php on line 14

Warning: Cannot modify header information - headers already sent by (output started at /internal/shared/auto_prepend_file.php:4) in /wordpress/wp-includes/option.php on line 1740

Warning: Cannot modify header information - headers already sent by (output started at /internal/shared/auto_prepend_file.php:4) in /wordpress/wp-includes/option.php on line 1741
```

# Response

Those errors aren't from anything we wrote. The path tells us exactly where they came from:

```
/internal/shared/auto_prepend_file.php
```

That's a **Studio** internal file, not yours, not WordPress core, not our plugin. `/internal/shared/` is the Studio container's own mount path. Studio uses PHP's `auto_prepend_file` directive to inject its own bootstrap (typically things that simulate WordPress.com's hosting environment — mu-plugins, debug toolbars, etc.). It's trying to read `/internal/shared/consts.json` and the file isn't there, so it warns, the `null` from that read fails the `foreach`, and then every subsequent `header()` call WordPress makes throws "headers already sent" because the warnings were emitted before any HTML.

Quick proof this isn't our code: comment out the `require_once` line we added to `clipisode.php` and reload. The errors will still be there. (Worth doing this once just to confirm.)

## Most likely fixes, in order of speed

1. **Stop and restart the site from inside Studio.**
   - In the Studio app, click the site → Stop. Wait a few seconds. Click Start.
   - Reload the WP Admin page. Often this is enough — the missing file gets regenerated when the site spins up cleanly.
2. **Quit and relaunch the Studio app entirely.**
   - Stop all sites first.
   - Quit Studio (`⌘Q`).
   - Reopen Studio. Start the site again.
3. **Update Studio.**
   - Studio → Preferences (or `⌘,`) → check for updates. The `consts.json` mechanism has changed across versions, and a stale install + a new site can produce exactly this. Updating typically fixes it.
4. **Recreate the site if 1–3 don't work.**
   - In Studio, create a new local site. Copy the plugin into the new site's `wp-content/plugins/`, activate. The new site will have a fresh `/internal/shared/` setup.
   - This is heavier — you'd lose any WP admin data on the broken site — but the plugin code itself moves cleanly.
5. **Last resort: bypass Studio's auto_prepend.**
   - This is a workaround, not a fix. If you can locate the Studio site's `php.ini` (Studio → site → "Open shell" or look in `~/Library/Application Support/Studio/...`), you could remove the `auto_prepend_file = ...` directive. I'd avoid this — Studio uses that prepend for legitimate reasons and breaking it might cause stranger issues. Try 1–4 first.

## What to do right now

Try in this order, stopping when the errors clear:

1. Restart the site (one click in Studio).
2. Quit and relaunch Studio.
3. Update Studio.
4. New site + reinstall plugin.

This is independent of our spike — once Studio is healthy, the spike URL will work and we can test. If you hit a wall on Studio, tell me what version you're on and the exact errors after each attempt and I'll dig further. If we burn more than 30 minutes on this, we pivot to a different local environment (`wp-env` is one Docker command, no Studio needed) so we don't lose the morning to vendor tooling.

Let me know which of 1–4 unblocked you, or if you'd rather pivot to `wp-env`.

---

# Prompt

good news. just stopping and restarting the site via Studio cleared all that up. I will keep that in mind for next time. now going back to your spike steps…

# Response

Nice, good to know. That'll be the standard reflex for any future "weird Studio errors" — stop and restart the site before suspecting your code.

Carry on with the spike steps. When you've created the three files and added the `require_once` line to `clipisode.php`:

1. Save permalinks once (Settings → Permalinks → Save Changes) to flush the rewrite rules.
2. Hit `https://your-studio-url/clipisode-spike` in your laptop browser first to confirm the page renders before going to your phone.

If the laptop view is broken, the phone won't work either — easier to debug from desktop DevTools. Common things that trip on first run:

- Blank page → check the browser console for module import errors. Most likely culprit is the `plugins_url(...)` in `spike.php` resolving to a wrong path. The console will show a 404 for `store.js`. Tell me the URL it tried to fetch and I'll fix the path.
- "Spike: main" renders but nothing is interactive → IAPI didn't hydrate. Look in the console for errors mentioning `@wordpress/interactivity` or `@wordpress/interactivity-router`. Could be a WP version issue or the script module didn't enqueue.
- 404 on `/clipisode-spike` itself → permalinks didn't flush. Save them again, or temporarily set permalinks to "Plain" then back to whatever you had.

Once the laptop view works, run ngrok and run through Tests 1–4 on your phone. Paste back what you see, especially the progress percentage on `/done` after navigating mid-upload.

---

# Prompt

the page renders great. I still need to set up ngrok. doing that now…

# Response

Good — that's the meaningful checkpoint. If the page renders on your laptop and Tests 1 and 2 work in the browser there too, you've already de-risked most of the architecture. Phone testing is mainly to confirm camera/UI behaves on a real device.

Quick reminder for ngrok setup so you don't have to scroll back:

```bash
brew install ngrok
ngrok config add-authtoken YOUR_TOKEN
ngrok http 8881   # replace with your actual Studio port
```

Studio's port is shown in the site detail view (the "Site URL" field, typically `http://localhost:88XX`). Use that number after `http` in the ngrok command.

If when you load the ngrok URL on your phone the page looks like it's missing styles or assets fail, that's the WordPress `siteurl`/`home` mismatch. The fix is the wp-config snippet I gave earlier:

```php
if ( ! empty( $_SERVER['HTTP_HOST'] ) ) {
    $protocol = ( ! empty( $_SERVER['HTTPS'] ) && 'off' !== $_SERVER['HTTPS'] ) ? 'https://' : 'http://';
    define( 'WP_HOME',    $protocol . $_SERVER['HTTP_HOST'] );
    define( 'WP_SITEURL', $protocol . $_SERVER['HTTP_HOST'] );
}
```

Studio: site → "Advanced" or open the site folder, edit `wp-config.php`, paste that block above the `/* That's all, stop editing! */` line.

While you're getting ngrok running, you can actually run Tests 1 and 2 on the laptop right now in a regular Chrome window — they don't need a phone. Tests 3 and 4 also work on the laptop. The only thing you specifically need a phone for is when we get to the real refactor and start testing the camera button. The spike itself is fully laptop-testable.

Want to run Tests 1 and 2 on your laptop while ngrok installs? That'd answer the architecture question now.

---

# Prompt

thanks. while I am working on ngrok, can you export a markdown file that has our entire chat log here so I can reference it on Tuesday's demo call? ideally, it would have an H1 with "Prompt" and then the contents of my first prompt. then an H1 of "Response" and the MD of your reply. Add all of the back and forth we've done into a file at /specs/research/invitation-link-cpts/cursor.md. I was copying your text and mine into a Google Doc and doing Paste as Markdown, but it's a lot of work that we should be able to automate. if you think this would be too long of a chat log, make multiple files with timestamps.

# Response

I can't write files in Ask mode — that restriction is hard. But this is exactly the kind of one-shot task to flip into Agent mode for, then flip back. Two ways:

1. **Switch to Agent mode for one turn**, ask me "write the chat log to that path now," I do it, you flip back to Ask. Total time ~30 seconds. Cleanest.
2. I paste the entire markdown into this chat and you copy-paste it into the file yourself. Works, but the chat is long enough that it'll be tedious and you'll lose code-block fidelity in places.

Option 1 is way better. Before you flip, three things to confirm so I don't ask you mid-write:

**Path** — your message says `/specs/research/invitation-link-cpts/cursor.md`. Your existing convention is `docs/specs/active/...` and `docs/specs/planned/...` (I saw both in git status earlier). Should I write to:

- `docs/specs/research/invitation-link-cpts/cursor.md` (matches existing convention, recommended), or
- `specs/research/invitation-link-cpts/cursor.md` (literal what you wrote)?

**Single file vs. split** — the full transcript is roughly 30,000 words. That's long but well within what a single markdown file handles. I'd do one file, `cursor.md`. Splitting only makes sense if you want chronological chunks for reference. Single file = easier to ⌘F across.

**Format** — your spec was H1 "Prompt" / H1 "Response" alternating. I'll do that, plus a small frontmatter block at the top with date, participants ("User: Brian", "Assistant: Claude Opus 4.7"), and a sentence-line summary so the file is searchable in the repo. Tool-call invocations and Cursor system metadata get stripped — only the human-readable conversation. Code blocks preserved as fenced blocks. Sound right?

One more thing worth knowing: Cursor itself has built-in chat export. In the chat panel, right-click on the chat title (or the ··· menu, depending on version) → "Export Chat" usually offers Markdown. If that works for you, it's faster than me transcribing and the formatting tends to be perfect. Tradeoff is it'll include some Cursor-specific metadata you might want to clean up. Try it as a sanity check while ngrok finishes — if the output is clean enough, you're done; if not, flip to Agent mode and I'll write a curated version.

Confirm path + format and ngrok progress when you can. I'll have the file ready the moment you flip modes.

---

# Prompt

yes, make the long single chat log for me using the docs/specs/research/invitation-link-cpts/cursor.md path, thanks

# Response

This file. Written to `docs/specs/research/invitation-link-cpts/cursor.md`.

Pick up the spike from where we left off — Tests 1 and 2 are runnable on your laptop right now while ngrok finishes installing. Phone testing is mainly to confirm camera behavior in the real refactor, not for the spike itself.
