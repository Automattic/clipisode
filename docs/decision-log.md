# Clipisode Decision Log

Human-readable record of what we decided, why, and what changed. Newest first.
Written for weekly progress updates — each entry should make sense to someone who
hasn't read the code.

Status legend: **Decided** (agreed, not built) · **In progress** · **Done** ·
**Revisit** (parked with an open question)

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

## Background: how the screen system got here

- **February 2026** — 4-day sprint with two devs (Max and Christoph) built all the
  mobile flow screens as one stacked post of blocks.
- **~June 2026** — solo work converted those into individual `clipisode_screen` CPT
  posts, so each screen is editable on its own in the block editor. The goal is that
  brands can rebrand the entire reply flow themselves.
- **Now** — that conversion is unfinished, and finishing it is priority one.
