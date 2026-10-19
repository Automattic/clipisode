# Clipisode Decision Log

Human-readable record of what we decided, why, and what changed. Newest first.
Written for weekly progress updates — each entry should make sense to someone who
hasn't read the code.

Status legend: **Decided** (agreed, not built) · **In progress** · **Done** ·
**Revisit** (parked with an open question)

---

## 2026-10-19 — Brian's VIP-readiness work and Max's Remotion work merged

### Two lines of work, one codebase again

**Done.** After the July handoff the project split. Brian's Aug 7 readiness work
(everything in the two entries below) was committed locally but never pushed.
Max, starting from the July handoff, shipped twelve releases between Oct 6 and
Oct 12 (v0.1.0 → v0.4.2). Neither line contained the other. They are now
merged, with nothing from either side lost. Every line of Brian's work either
survived as written or was combined deliberately with Max's version of the same
code.

What Max's October releases added:

- **In-browser video rendering.** The Remotion composer replaces the macOS app
  as the plugin's render path. An editor arranges approved replies with title
  and ending cards, previews them in wp-admin, and renders an MP4 in the browser
  tab, which uploads back to WordPress. An optional local Node render service
  does the same job off the browser.
- **Video themes as plugins.** The look of a rendered clipisode comes from a
  JSON theme schema plus React renderers. Built-ins are Clipisode, Editorial,
  Baseball (with MLB team logos) and No theme. Separate theme plugins can add
  more (Community, Studio, and a showcase NASA theme).
- **Social preview images.** Wide, square and portrait variants for invitation
  links and preview pages, chosen per platform.
- **Invitation pages inherit the site's styles.** Fonts, headings, buttons and
  links come from the site's `theme.json` / Global Styles, with six
  Clipisode-specific tokens a brand can override.
- **Release plumbing.** A one-click WordPress Playground demo, an installable
  zip, and GitHub Actions that cut versioned releases.

### Invitation themes are built in the Block Editor

**Unchanged by the merge, worth stating plainly for anyone new.** Each invitation
theme is a set of ten screens (mobile intro, desktop intro, name, email,
success, closed, and four warning screens). Each screen is its own post, edited
in the standard WordPress Block Editor. Brands restyle the guest experience with
the same tools they already use for pages: typography, colors, images, buttons,
Cover backgrounds. They don't need a config file or a developer. The editor shows
a phone-shaped canvas with realistic sample copy in place of the placeholders.
The screens are seeded from starter markup and locked where a block must not be
deleted. All ten screens load as one page, and the visible one swaps in place, so
a guest's video keeps uploading while they type their name. The flow does not
navigate between URLs.

### How the overlaps were settled

- **Schema upgrades: Brian's mechanism, Max's column.** Both sides had
  independently added a "schema version" check. Brian's was kept because it
  has the upgrade lock and the multisite hook. Max's new `composition` column
  becomes schema version 3. Verified by upgrading a site running v0.4.2 in
  place: it moved to version 3 and gained the new indexes on first request.
- **Max's root-cause fix replaces a workaround.** Brian's July code carried a
  workaround for a WordPress hydration race. Max removed the unused piece of
  WordPress that caused the race, so the workaround is gone. This is the
  outcome the coding standards ask for.
- **Max's new database queries adopted Brian's safer placeholders**, and his
  social-preview tags kept Brian's escape-at-output pattern.
- **Pageviews still aren't counted in the database.** Max's line still had the
  per-view counter. The merge keeps it removed (verified: page views no longer
  change the count).

### Multisite: works, three housekeeping gaps

**Required — confirmed working, with gaps tracked.** Clipisode will run on
multisite (a network for brands VIP doesn't host). Tested
on a network-activated install with a second site added afterwards:

- The new site gets its own seven tables at the current schema version the
  moment it is created.
- Its invitation page, upload and reply all stay inside that site. The upload
  lands in its own uploads folder, the reply in its own table, and nothing is
  visible from the main site.
- Its default invitation theme, screens, terms and preview layout are created
  the first time anyone uses Clipisode's admin there.

**Gaps (Decided — fix before multisite customers):**

1. The default host is seeded only on the site Clipisode was activated from.
   Other sites get one when their first topic is saved.
2. Deleting a site leaves its Clipisode tables behind. Nothing hooks site
   deletion.
3. There is no uninstall routine on single site or multisite.

### Still open after the merge

- **PHPCS regressed from 0 to 33** (4 errors, 29 warnings), all in code new in
  October that predates the VIP lint setup (renderer, composition, social meta).
  Nothing from the Aug 7 cleanup was undone. Return to zero.
- **Revisit: the macOS app.** The Aug 7 entry below re-confirmed local Mac
  rendering (iOS emoji fidelity, newsroom workflows). Max's October work
  disconnected the plugin from it in favour of browser rendering. That reverses
  a recorded decision without a recorded reason, so it needs an explicit call.
- **Remotion licensing.** Remotion is not open source in the GPL sense, and
  company use needs a paid license. That affects both the wp.org listing and
  VIP pricing. Needs a legal and business decision.
- **Housekeeping.** Sites that ran Max's v0.4.x keep an unused
  `clipisode_database_version` option, which is harmless. The README Playground
  button installs a stale zip (v0.1.1).

---

## 2026-08-07 — PHPCS cleanup: 569 → 0

Worked the VIP-readiness lint baseline down by 304 violations. Everything that
remains is one deferred item, described at the end.

### Real defects found and fixed

The lint pass earned its keep — these are bugs, not style:

- **Unsanitized admin input.** `Clipisode_Admin::redirect_cpt_list()` read
  `$_GET['post_type']` raw into a comparison. Now `sanitize_key( wp_unslash() )`.
- **`pre_get_posts` hook modified every attachment query.**
  `Clipisode_Media::hide_from_media_list()` had no `is_main_query()` check, so it
  filtered secondary attachment queries on `upload.php` too, not just the list
  table it targets. The AJAX grid is handled separately by
  `hide_from_media_grid()`, so the main-query check matches the original intent.
- **Two wrong escaping functions.** `esc_attr()` was used where `esc_url()`
  belongs — on a `<video src>` in the preview block, and on the
  `data-clipisode-qr-url` attribute in the flow template. `esc_attr()` blocks
  attribute breakout but does not check the scheme, so it does not stop a
  `javascript:` URL. The QR one matters more than it looks: that value derives
  from the request URI.
- **Silenced filesystem call.** `@unlink( $tmp )` is now `wp_delete_file( $tmp )`
  — WordPress's wrapper, permitted on VIP, and no longer swallowing errors.
- **Dead locals.** Four unused `$wpdb->prefix` assignments in `list_replies()`
  and `list_media()`, plus a redundant second `global $wpdb`.
- **Stale docblock.** `clipisode-flow.php` still described itself as a "parallel
  v2 pipeline being built alongside the legacy `/invitation/{slug}` flow" and
  promised a future cutover. v1 was deleted months ago.

### Genuine hardening, not suppression

- **All 43 interpolated table names now use `%i`** identifier placeholders. WP
  6.2 added `%i` and this plugin requires 6.5, so these were fixable rather than
  ignorable. Placeholder and argument counts were verified statically across all
  42 `prepare()` calls in the changed files.
- **`list_replies()` and `list_media()` always prepare now.** Both previously
  called `prepare()` only when `$values` was non-empty, so an unfiltered request
  ran an unprepared statement. Harmless as written — the only interpolated values
  were `$wpdb->prefix` table names — but it meant one code path was sometimes
  prepared and sometimes not.
- **Five unbounded `get_posts()` calls are bounded.** VIPCS rejects values above
  100 as well as `-1`, so each is capped at 100 with a comment giving the expected
  cardinality. For the three admin list endpoints the complete fix is real
  pagination, tracked with the reply-list pagination work above.
- **`suppress_filters => false`** on all nine `get_posts()` calls, which is what
  puts them on the cached query path.
- **`preview.php` moved to escape-at-output.** It held OG and Twitter card values
  pre-escaped in variables and echoed them raw. Safe, but backwards: it hides the
  escaping from review and silently double-escapes if anyone later adds
  `esc_attr()` at the output site.

### Decisions recorded rather than changes made

**Direct database queries stay direct, and uncached.** `$wpdb` is the only API for
a custom table, so `DirectQuery` is structurally unavoidable in the six files that
touch Clipisode's seven tables. `NoCaching` is declined *deliberately*, not
deferred: classifying all 67 query sites showed 60 are writes or single-row lookups
on a primary or unique key. Caching those buys microseconds while adding an
invalidation path to every write endpoint, and a stale read after an admin save is
a worse defect than the warning it silences. The 7 that genuinely scan more than
one row are the `GROUP BY` aggregates over the whole replies table — those need a
better query, not a cache, and are already tracked above.

**VIPCS independently confirmed two things already in this log.** It flags
`wp_is_mobile()` as an error citing full-page caching, and it flags
`$_SERVER['HTTP_USER_AGENT']` under a "server-side caching" rule. Both are the
same UA branch that `docs/specs/planned/cacheable-intro-screen-selection.md`
removes. Annotated pointing at that spec rather than pretending they are fine.

### A PHPCS trap worth knowing

An open-ended file-level `phpcs:disable` combined with a later `phpcs:enable` for
a *different* sniff silently stops subsequent `phpcs:ignore` comments in that file
from taking effect. Three verified-safe echoes in `clipisode-flow.php` kept being
reported despite correct annotations; isolated by bisecting a copy of the file.
Avoid mixing the two forms in one file, and **verify per-file counts rather than
inferring from the total** — the total moving in the right direction hid this.

### The last 265: template bodies wrapped in closures

The final batch was 264 `NonPrefixedVariableFound` plus one
`GlobalVariablesOverride`, all in `assets/templates/clipisode-flow.php` (239) and
`assets/templates/preview.php` (26). Both are template files, so every top-level
`$slug`, `$link`, `$topic` really was a global — VIP's complaint was legitimate,
not a false positive, and `$link` collides with a global WordPress itself uses.
Wrapping each body in a closure makes them locals.

**This was deferred twice as unverifiable without a browser, and that was wrong.**
It is verifiable, cheaply, and the method is worth reusing — see the next section.

Result: **PHPCS is at zero.** From 569 at the start of the day.

### The render harness — reusable, and it does not need Studio running

The Studio site at `~/Studio/alvey-clipisode` symlinks this plugin and runs on
SQLite. That means WordPress boots straight from PHP CLI against the real dev
database once the `DB_*` constants are stubbed — **the Studio app does not have to
be running**, which also sidesteps its battery drain. Nothing listens on a port;
PHP reads `wp-content/database/.ht.sqlite` directly.

The harness sets the flow's query vars, `require`s the template, captures output,
and writes it to a file. Comparing before/after across several paths is then a
`cmp`. Used here on seven: mobile intro, desktop intro (both `wp_is_mobile`
branches), name, email, success, warning_wide, and a second topic to vary the
substituted tokens. All seven byte-identical across the closure change.
`preview.php` too, rendered against a temporary `clipisode_outputs` row deleted in
a `finally` block.

**This is the fastest regression test for the flow, and the right tool for the
intro-selection change** in `docs/specs/planned/cacheable-intro-screen-selection.md`
— whose acceptance criterion is literally "byte-identical HTML for a desktop and a
mobile user agent," which is exactly what this measures.

Two traps if you rebuild it:

- An iPhone UA string without the `Mobile/` token does **not** trip
  `wp_is_mobile()`. An early run silently exercised the desktop branch twice and
  reported both intros identical.
- WordPress needs `DB_NAME` / `DB_USER` / `DB_PASSWORD` / `DB_HOST` defined even
  though the SQLite drop-in ignores them. Without stubs you get "Error establishing
  a database connection" and no hint why.

Before the change, two static checks confirmed a closure was safe — both are the
things that would actually alter behaviour. No WordPress global is read without a
`global` declaration (`$wpdb` is the only one either template touches), and there
is no top-level `return`; the only `return` statements in the flow template are
inside its inline `<script>` block. `exit` behaves identically inside a closure.

---

## 2026-08-07 — Readiness review for high-traffic brand sites

First pass over the codebase specifically asking "what breaks when a major
publisher or brand puts this in front of real traffic?" Findings and
decisions below.

### Scale targets we're designing against

**Decided.** Peak **~100 replies/minute** to a single invitation link. Guests spend
minutes recording and re-taking, so reply *writes* stay modest even for a Taylor
Swift-scale share. Invitation-page *views* can spike far higher, which is why page
caching matters more than write throughput.

Distribution: VIP-hosted brands install via Automattic's hosting-dashboard
Integration Center. Select partners that VIP doesn't host get a subsite on a
WordPress multisite.

### Analytics: stop counting pageviews in the database

**Done.** `clipisode-flow.php` ran `UPDATE ... SET clicks = clicks + 1` on every
guest pageview. Two problems: it's a write-lock on a single row during a traffic
spike, and once the page is edge-cached the counter silently stops counting — the
number becomes "cache misses," not views.

The synchronous write is removed. The `clicks` column stays so historical values
survive, but nothing writes to it. Replacement, by tier:

- **Base plugin:** leave analytics out, or read pageviews back from the site's
  existing Jetpack Stats if that's practical.
- **VIP customers:** integrate with Parse.ly for both event logging and reporting
  read-back. Medium-term project, not now.

### Invitation page must be edge-cacheable

**Decided, in progress.** Four things blocked it:

1. **The pageview write** (above) — being removed.
2. **`wp_is_mobile()` chose the screen server-side.** Under a shared page cache
   that's a correctness bug, not just a slow path: the first visitor's device type
   gets cached and served to everyone. Fix: render both intro screens into one
   cached response and choose client-side. One cache entry, no UA vary.

   **Specced, not built** — `docs/specs/planned/cacheable-intro-screen-selection.md`.
   Turned out smaller than expected (every screen is already in the DOM; the server
   only picks which one gets `is-active`), but it carries one decision that isn't
   mechanical: the QR bundle is currently enqueued behind exactly the branch being
   removed, to keep ~24 KB off mobile guests. Three options costed in the spec, with
   a recommendation. VIP's own PHPCS ruleset independently flags `wp_is_mobile()` as
   an error citing full-page caching — though its suggested fix splits the cache,
   which is worse than not varying at all.
3. **`do_blocks()` ran on every cache miss — for every screen, on every request.**
   Ten block-tree renders per request, when screens change only on an author edit.

   **Done.** `Clipisode_Post_Types::render_flow_screen()` memoises it in the object
   cache. Lives beside `set_flow_topic_context()` because that context is what makes
   the output cacheable-but-varying.

   The cache key was the whole risk here. Rendered output is per-topic and per-link,
   not per-screen, because token substitution (`{topic_title}`, `{invitation_url}`)
   happens inside the `render_block` filter. A key that didn't vary on topic context
   would serve one brand's rendered screen on another brand's invitation — a
   cross-tenant leak, not a perf regression. The key covers the raw markup (hashed),
   the topic context, the intro video URL, and `CLIPISODE_VERSION`. Everything
   request-specific (nonce, form widgets, QR mount, live URL) is applied after the
   cached value returns. `FlowScreenRenderCacheTest` pins this, including the leak
   case; verified by removing topic context from the key and confirming the
   cross-tenant tests fail.
4. **A `wp_verify_nonce` token was baked into the HTML.** See below.

Anything per-visitor moves to the client. Name pre-fill reads `localStorage` in JS
after load — we are not cookie-splitting the edge cache for it. VIP supports cache
segmentation by cookie, but every segment multiplies cache entries; spend that on
something that genuinely needs server-side divergence.

### Security token moves out of the cached HTML

**Decided.** WordPress nonces are stateless HMACs over shared salts, so there is no
server-affinity problem — a guest can bounce across web servers mid-flow freely.
No pinning needed, nothing to over-engineer there.

But VIP's edge serves stale responses for **up to 12 hours**, and an anonymous WP
nonce is valid for only **12–24 hours** depending on where in its 12-hour tick it
was minted. Worst case, a nonce minted at the end of a tick and served stale 12
hours later is expired on arrival. Narrow, but real.

Also worth naming plainly: for logged-out visitors a nonce is **identical for every
visitor** and rotates only every 12 hours. It was never a meaningful security
control here — anyone who loads the page has it.

Replacement: `POST /clipisode/v1/invitation/session`, never cached. It validates the
link is open, rate-limits by IP and by link, and returns a short-TTL signed token
(HMAC of link ID + expiry). Upload and submit require that token. This is also the
one chokepoint where abuse controls and presigned-S3 minting live — neither of
which exists today. Both public endpoints are currently
`permission_callback => '__return_true'` with no throttling of any kind.

### Guest video must leave the WordPress Media Library (VIP tier)

**Decided.** This is the brand-safety requirement, not an optimization. If a brand
collects 500 replies and 6 are offensive, none of those 6 may ever be reachable —
above all not on a path on the brand's own domain.

Current state is a live leak. `Clipisode_Media::create()` calls
`media_handle_upload( $key, 0 )` — parent `0`. WordPress treats an attachment with
status `inherit` and no parent as *published*, making it readable through the
unauthenticated `/wp-json/wp/v2/media` collection. The `_clipisode_managed` meta
flag only hides these from the admin Media grid; it does nothing for REST, feeds,
search, or sitemap plugins. And separately, files in `wp-content/uploads/` are
served directly by the webserver with no WordPress auth in front of them at all —
hiding the post never protects the URL.

**VIP's Access Controlled Files does not solve this.** Its "restrict unpublished"
mode explicitly does not apply to files uploaded to the Media Library without a
parent post — exactly our case. Its "restrict all files" mode would gate guest
video correctly but also put every image on the brand's public articles behind a
login. Not viable on a news site. So the S3 path is required, not preferred.

Target design:

- Presigned **POST** (not PUT — a POST policy can enforce a min *and* max
  `content-length-range`; a presigned PUT is a blank check). Multipart with
  per-part presigns for resumability on flaky mobile connections.
- Presign at **upload start, not page load**, so a guest taking 20 minutes on
  re-takes never sees an expired URL. Session token ~2h, presigned URL ~15min.
- Uploads land in a **private quarantine prefix** — no public read, no bucket
  website endpoint, no CDN. A lifecycle rule deletes anything never claimed by a
  submitted reply within ~24h, capping exposure to junk uploads.
- Admin review streams from a **neutral domain** with short-lived signed URLs,
  never the brand's domain.

Base/open-source plugin keeps the Media Library path and its 80MB cap. That's an
acceptable limitation for that tier.

### Every upload gets transcoded on ingest

**Decided in principle, mechanism unresolved.** Two reasons: file-size and format
consistency, and safety — an old Samsung phone's video export has been known to
carry payloads that can exfiltrate a phone's contact list. Requires a **full
re-encode** with all container metadata stripped; remuxing alone is not enough.
This is also the natural place to generate poster frames, which the moderation
grid needs.

**Revisit — open question.** VIP and Pressable don't support server-side FFmpeg.
Options: the Mac app (but that requires someone to be running it, and two
operators on one account is undefined behavior), or a required Mux / AWS video
transcoding account. Not settled.

### Does presigned S3 solve the bot problem?

**Answered: mostly, and it moves the rest somewhere defensible.** Bytes never touch
PHP — no workers pinned for 80MB, no `post_max_size` ceiling, no origin bandwidth,
no timeouts on slow phones. The presign endpoint becomes the chokepoint, which is a
win: it's a cheap JSON request we can rate-limit hard, which is impossible to do to
an in-flight 80MB POST. Residual exposure is S3 PUT cost plus brief storage for
junk, handled by the quarantine lifecycle rule, link-level reply caps, and a hook
left open for Turnstile/hCaptcha (VIP customers will ask).

### Local Mac rendering stays

**Decided (re-confirmed).** Not a stopgap. Cloud rendering was tried 8+ years ago on
a React Native app and failed on two counts: round-tripping large video files is
slow, and emoji in theme text overlays render as the host platform's glyphs —
customers want iOS emoji, not Android's or Linux's. Limiting final mixing to one Mac
operator is acceptable; many newsrooms just take the raw files to their
own 24x7 video workstations anyway.

Mux was evaluated and does compositing, not overlay rendering, so it doesn't replace
the Mac app. Cloud editing may be revisited after the capture experience is
polished.

### Multisite is broken today

**Done.** Tables were created only via `register_activation_hook`.
There's no multisite loop, no `wp_initialize_site` handler, and no `db_version`
check. Consequences: network-activating creates tables for one site and every other
subsite errors; a subsite created later gets no tables at all; and because
activation hooks don't fire on plugin *upgrades*, **any future schema migration
would never run on an existing site.**

That last point made this the prerequisite for everything else on the scale track,
including the indexes below, so it was fixed first.

Replacement is a single mechanism — `Clipisode_Database::maybe_upgrade()` on `init`,
comparing a per-site `clipisode_db_version` option against a `DB_VERSION` constant.
Every site self-heals on its next request, which covers in-place upgrades, network
activation, new subsites, and restored backups without a separate code path for
each. A `wp_initialize_site` hook additionally creates a new subsite's tables at
creation time rather than on first request.

The upgrade runs under a lock, because a deploy is exactly when many workers pick up
new code in the same second, all see a stale version, and would all run
`ALTER TABLE` against the same tables at once. `add_option()` is a single INSERT
against a UNIQUE `option_name`, so it succeeds for exactly one caller — an atomic
test-and-set. Locks older than 60 seconds are treated as abandoned so a request
killed mid-`dbDelta` can't wedge the schema permanently. All of this is covered by
`tests/phpunit/DatabaseTest.php`.

### Missing database indexes

**Done — four indexes, not the six first proposed.** Each candidate was checked
against the queries that actually run, and two didn't survive:

- `replies (topic_id, status, created_at)` — the moderation queue's hot path.
- `replies (topic_id, created_at)` — the same listing unfiltered by status, where an
  index leading `topic_id, status` can't help the sort.
- `replies (invitation_link_id)` — per-link reply counts in
  `list_invitation_links()`.
- `topics (invitation_id)` — two `COUNT(*)` queries in the REST layer.

**Rejected:** `media (attachment_id)` — nothing looks media up by attachment ID.
`topics (status)` — no query filters topics by status. An index nothing reads costs
write throughput and disk for nothing.

Two caveats worth carrying forward. First, `dbDelta` only ever adds indexes and
never drops one, so the older single-column `replies.topic_id` and `replies.status`
keys are now redundant for reads but still exist on every site; dropping them needs
a deliberate migration. Second, **these choices are reasoned, not measured** — they
should be confirmed with `EXPLAIN` against realistic data once the staging generator
exists.

### Admin topic list aggregates the whole replies table

**Decided, not yet built.** Noticed while indexing: `list_topics()` and
`get_topic()` both join derived tables built as
`SELECT topic_id, COUNT(*) FROM replies GROUP BY topic_id` — with no `WHERE`. Every
load of the admin topic list groups over *every reply on the site*, regardless of how
many topics are shown. Same shape in `list_invitation_links()`. Same family as the
unpaginated reply list; fix them together.

### Moderation UI won't survive 500 replies

**Decided.** `list_replies()` has no `LIMIT` and no pagination — it returns every
reply for a topic, then loops them calling `Clipisode_Media::get_url()` and
`get_filename()`, each running its own query. A brand's 500 replies means one
unbounded query plus roughly a thousand more, and 500 video URLs in a single JSON
response. Needs pagination, a JOIN to replace the N+1, and poster-frame thumbnails
from the ingest transcode so the grid isn't loading 500 videos.

### Disposable spike code was shipping to production

**Done.** `clipisode.php` unconditionally loaded `spike/spike.php`, whose own
docblock reads *"Disposable... Teardown: remove the require_once line, delete the
spike/ folder."* It registered a public `/clipisode-spike` rewrite on every install.

Removed — the `require_once`, the `spike/` directory, and two comments elsewhere that
referenced it. `tests/phpunit/ShippableCodeTest.php` now fails the build if the
bootstrap loads from any known dev-only directory (`spike`, `z_screenshots`,
`scratch`, `tmp`), if such a directory exists in the plugin at all, or if the
bootstrap requires a file that doesn't exist. Verified by reintroducing the require
and confirming the suite goes red.

### Untested risk: localhost WebSocket from an HTTPS origin

**Decided — medium-term, but test early.** `transcoder.ts` hardcodes
`ws://127.0.0.1:63481`. Localhost is exempt from mixed-content blocking, so this
works in principle, but Chrome's Private Network Access rules add preflight
requirements for public→local requests and recent macOS Safari prompts for local
network permission. This has only ever been tested from `studio.local` over HTTP. It
may fail on a customer's `https://` domain while working perfectly on a dev machine, and the
fix would be architectural (signed local cert, helper-served `wss://`, or a
different transport). Test against a real HTTPS domain well before any customer
demo.

### VIP code-review gates

**Done — wired as advisory.** `WordPressVIPMinimum` (the ruleset VIP applies during
platform review) plus `composer lint` / `lint:summary` / `lint:sniffs` / `lint:fix`.
Deliberately **not** part of `composer test`, so it reports without blocking work.

Baseline: **381 errors, 188 warnings across 9 files.** Triage, worst first:

- **280 of ~570 are `NonPrefixedVariableFound`** — almost entirely the two template
  files declaring working variables in global scope. Wrapping each template body in
  a closure would clear nearly half the total in one change. Best value per effort
  by a wide margin, but it touches the template being actively edited, so it should
  wait for the screen sweep to finish.
- **`DirectDatabaseQuery` (69) + `NoCaching` (59)** — the custom-table architecture.
  This is the real work and it overlaps the object-caching pass.
- **`InterpolatedNotPrepared` (40)** — table names interpolated into SQL. Safe as
  written, but WP 6.2+ has the `%i` identifier placeholder and this plugin requires
  6.5, so these can be genuinely fixed rather than suppressed.
- **Not previously noticed:** 31 `OutputNotEscaped`, 8 stray `error_log()` calls,
  and 5 `NoPaging` hits beyond the one found by hand.

`class-database.php` was brought to **zero** violations as the worked example of the
intended pattern: fix what's genuinely fixable (`%i` placeholders), and annotate the
rest inline with a specific reason rather than disabling sniffs globally.

### "Theme" means two different things

**Decided — naming cleanup, not a bug.** `assets/themes/default/` holds invitation
*screen* seed markup (the `clipisode_invite` CPT). `assets/themes/standard/` and
`assets/themes/wpvip/` are *renderer* overlay asset packs, registered through the
`clipisode_themes` filter and consumed by the Mac app via `transcoder.ts`. They are
unrelated systems sharing one word and one parent directory. Merging or deleting the
renderer packs would break video rendering. Rename to something like
`assets/renderer-themes/` when convenient.

### Reply retention

**Revisit.** Placeholder of **90 days**, possibly a plugin setting. Needs a real
walkthrough, and the broader legal questions (deletion requests, moderation SLA,
minors and consent) go to the legal team before any customer uses this publicly.
Legal terms are already shown on invitation links so the brand owns the replies, and
`replies` tracks the terms revision each guest accepted.

### Playback

**Revisit.** We want better than free VideoPress, which only recently added HLS. Not
discussed in depth yet.

### Priority call

**Decided.** Finishing the invitation-screen CPT conversion comes first — the six
remaining screen markups, a final `intro_desktop` pass, verifying the success-screen
Cover conversion, then testing on real iPhones and deliberately-old Android devices.
Scale work runs as a parallel track, led by the multisite migration harness.

One thing to check before the device lab: the Interactivity API ships as ES modules
with an import map, and import maps need **Safari 16.4+ / Chrome 89+**. The old
Android devices are the risk. A 20-minute smoke test on the oldest device first — a
wall there changes the plan.

### Staging data

**Decided.** No staging environment with realistic data exists. Rather than
hand-recording hundreds of replies on test phones, build a WP-CLI generator that
creates topics, links, and N replies with real video files. That's what makes the
moderation-scale problems measurable.

---

## Reconstructed history: February – July 2026

Backfilled on 2026-08-07 for writing up work that predates this log. **Read the
confidence markers** — this is reconstruction, not a record kept at the time.

- **[commit]** — verifiable from git: dates, authors, commit messages, file changes.
- **[artifact]** — inferred from a date written inside a document, or from a file's
  modification time. Reliable for ordering, approximate for exact days.
- **[inferred]** — reasoning from what the code does. Treat as a hypothesis.

The important structural fact: **the solo phase has no granular commit history.**
All of it landed as one squash commit, `c5495d6 "adding all of the stuff I worked
on months ago"` (2026-07-21, 111 files, +16,482 / −4,114). Everything about that
period is therefore `[artifact]` or `[inferred]`. The February–April phase, by
contrast, has 105 individual commits and is well documented by them.

### Phase 0 — Groundwork, Feb 12 (Thu) `[commit]`

`ff23c86` "Initial pass at a PRD" and `4bd0460` "Add Clipisode transcoding MVP:
macOS app, web UI, docs". The macOS transcoder existed *before* the WordPress
plugin — the plugin was built toward a renderer that already worked.

### Phase 1 — The sprint, Feb 17 (Tue) – Feb 20 (Fri) `[commit]`

**This is the "4-day sprint," and the dates confirm it exactly:** four working days,
69 commits, +19,946 / −2,569 lines. A few more landed Sat Feb 21.

Division of labour is unambiguous in the numbers:

- **Max Schmeling** — the macOS transcoder. 65 file-touches in `transcoding/macos`
  against 35 in the plugin. Compositing, overlays, effects, video orientation,
  coordinate systems, single-audio-track export, animations.
- **Christoph Khouri** — the WordPress plugin. 336 file-touches in
  `plugin/clipisode` against 45 in macOS. Tables, REST API, admin React app,
  invitation flow, blocks, media abstraction.
- **Brian** — one commit, `00bfa0d` "updated text about invitation pages" (Feb 22).

What shipped, in commit order: the plugin skeleton → hosts table → invitation links
and terms pages → **the `invitation-block` plugin (`a4c2190`, the v1 flow)** →
invitation flow blocks + REST → Themes CPT → terms modal → desktop stage with QR →
outputs and muxing UI + the WebSocket test server → upload nonce and output upload
tokens → `/invitation/{slug}` routing → the `clipisode_media` table and media
abstraction → the Clipisode list, with "mux" renamed to "render".

Two renames worth knowing when reading old commits: **"Clip" became "Reply"**
(`590fa12`) and **"mux" became "render"** (`68558ad`).

**This is the phase that produced the stacked-blocks flow** — v1, later deleted.

### Phase 2 — Consolidation, Feb 21–27 `[commit]`

Multi-theme support and theme selector, template relocation, block/theme directory
restructure, default-host support, desktop invitation layout work. Then the repo's
own scaffolding: `df58f43` added root `AGENTS.md`/`CLAUDE.md`, `e69417b` added the
PHPUnit and Jest setup, `573707c` condensed AGENTS.md.

`5d77a73` "Remove database seeding on activation" is worth flagging — activation-time
behaviour was deliberately reduced here, which is part of why the schema had no
version-gated migration path until 2026-08-07.

### Phase 3 — Christoph continues, Mar 4 – Apr 24 `[commit]`

18 commits, no sprint pace. Clip duplication, media picker modal, video preview
modals, social metadata and Topic Image, UI density work, then `47438d6`
"Add clipisode preview pages & CPT layout editor" (Mar 6) — the `clipisode_preview`
CPT. Mar 18: WebSocket failure messaging and existing-media picking. Then a gap, and
a final three commits on **Apr 24**: manifest builder, debug-mode setting, and
copy/download for the debug manifest.

**Apr 24 is the last commit by anyone other than Brian.** The macOS transcoder has
not been substantively touched since late February.

### Phase 4 — Brian solo: the screen-CPT conversion, ~Apr 16 – May 6 `[artifact]`

**Correction worth carrying into any writeup: this reads as late April to early May,
not June.** The work was *committed* on Jul 21, which is probably where "June" comes
from, but every dated artifact inside it clusters in that earlier window:

| Evidence | Date | What it indicates |
|---|---|---|
| Dates inside `z-example.md`, `invitation-link-social-previews-plan.md` | Apr 16 | The `docs/specs/` format was established |
| `alvey-clipisode` Studio symlink created | Apr 23 | Local dev site stood up |
| `old-clipisode-theme-documentation.md`, `invitation-link-cpts-plan.md` mtimes | Apr 25 | Old-platform JSON config surface documented as the product reference |
| `cursor.md` mtime | Apr 26 | LLM-generated v1 architecture analysis + refactor plan |
| `spike/spike.php` mtime | Apr 26 | IAPI + upload-survival spike written |
| `spike/store.js` mtime | Apr 30 | Spike iterated — the store pattern being proven |
| `reset-invitation-link-customization.md` mtime | May 2 | The product brief for block-editor customization |
| `short-invitation-urls.md` internal date | May 5 | Short-URL feature specced (never built) |
| `z_screenshots/` mtime | May 5 | Screen design iteration |
| `assets/themes/default/` dir mtime | May 6 | Seed templates last restructured |
| Date inside `kill-v1-invitation-flow.md` | May 6 | **v1 flow deleted** |

The sequence that implies `[inferred]`: research the old platform's customization
surface → prove the Interactivity API can survive an upload across screen
transitions (the spike) → build the `clipisode_screen` CPT and the seeding pipeline
→ write the product brief → delete v1 → iterate on the block-editor authoring
experience.

**The inner loop, confirmed by Brian 2026-08-07** (promoted from `[inferred]`):
start in the HTML seed files in the repo → promote them to CPT content → open in the
block editor and check which elements are actually editable versus locked → go back
to the HTML and clean up → repeat. Many times. That repetition is why the seed files
and the lock model co-evolved, and why the conventions ended up documented in
`assets/themes/default/README.md` rather than designed up front.

**Why Studio was in the picture** `[confirmed]`. Brian used Studio during this phase
specifically so he could push the site to a WordPress.com or Pressable host and then
**test screens from real Android phones without configuring each phone to proxy to
his laptop**. That was the whole point — device testing, not local convenience. It
was not ideal, and Studio drains laptop battery noticeably even while plugged in.
Studio has not been run since roughly June.

Practical consequence for picking this back up: **the CLI render harness described
above does not need the Studio app running**, because it reads the SQLite file
directly. Use it for anything that can be checked from rendered HTML, and save
Studio-plus-a-hosted-site for what genuinely requires a real device — camera
capture, the upload path, and the Interactivity API on old Android.

**Decisions from this phase survive only where they were written down**, which is
mostly `assets/themes/default/README.md` and the shipped kill-v1 spec. Those are
good: the README's "Hard-won lessons" and the kill-v1 spec's audit corrections are
genuine decision records. The rest — why a given lock model, why intro stayed
Group-rooted — is recoverable only from `docs/handoff.md` §4, which Brian wrote from
memory in July and which this log has already found one error in (see the
font-size rule in the sweep checklist).

### Phase 5 — Commit and hand off, Jul 21 `[commit]`

`c5495d6` squashed the entire solo phase into one commit. `7756463` added
`docs/handoff.md`, written to make the codebase legible to a new developer and their
coding agent. The handoff's own §6.10 said "nothing is committed" — accurate when
drafted, stale by the time it was committed.

### Phase 6 — Readiness and lint, Aug 7 `[commit]`

This log's other entries. 14 commits in one day:

- Schema versioning with a per-site `db_version` check and a `wp_initialize_site`
  hook, fixing multisite, which was broken outright.
- Four query-path indexes; the synchronous pageview write removed.
- Screen block rendering memoised in the object cache.
- **PHPCS from 569 violations to 0.** Along the way it surfaced four real defects,
  not style: unsanitized `$_GET` in an admin redirect, a `pre_get_posts` hook with
  no `is_main_query()` check, and two `esc_attr()` calls where `esc_url()` belongs.
- Disposable spike code removed from every build, with a test guarding against a
  repeat.
- Two specs written (cacheable intro selection, screen sweep checklist) and this
  history backfilled.

### Gaps this reconstruction cannot fill

- **Why the stacked-blocks approach was chosen in February.** No spec predates the
  code; the PRD (`ff23c86`) describes the product, not the block architecture.
- **What was tried and abandoned during the solo phase.** A squash commit erases
  that. The one exception is documented: `core/cover` + `core/html` on the intro
  screen broke editor validation, which is why `migrate_legacy_intro_post()` exists.
- **Whether Max and Christoph made architectural calls that were later reversed.**
  Their commit messages describe changes, not the reasoning behind them.

### Where the screen-CPT conversion stands

- **February** — the sprint built all mobile flow screens as one stacked post of
  blocks.
- **Late April / early May** — solo work split those into individual
  `clipisode_screen` CPT posts, so each screen is editable on its own in the block
  editor, and deleted v1. The goal: brands rebrand the whole reply flow themselves.
- **Now** — that conversion is unfinished. See
  `docs/specs/active/screen-markup-sweep-checklist.md` for exactly what is left.
