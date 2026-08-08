# Cacheable intro screen selection

**Status:** 📋 Planned — one open decision, see §4.
**Blocks:** edge-caching the invitation flow. This is the last correctness
blocker; the pageview write and the uncached `do_blocks()` passes are already done.
**Why it's a spec and not a commit:** §4 is a cost tradeoff that belongs to the
owner, and the change lands in `clipisode-flow.php` — the same file as the
in-flight screen markup sweep.

---

## 1. The problem

[`clipisode-flow.php`](../../../plugin/clipisode/assets/templates/clipisode-flow.php)
picks the entry screen server-side from the user agent:

```php
if ( $screen_type === '' ) {
	$screen_type = ( ! wp_is_mobile() ) ? 'intro_desktop' : 'intro';
}
```

Under a shared full-page cache this is a **correctness bug, not a performance
one**: the first visitor's device type is baked into the cached HTML and served
to everyone after them. A desktop visitor warms the cache and every phone gets
the QR-code screen; a phone warms it and every desktop gets a layout designed
for a 390px viewport.

VIP's own PHPCS ruleset flags this independently, as an **error**:

> `wp_is_mobile()` found. When targeting mobile visitors, `jetpack_is_mobile()`
> should be used instead of `wp_is_mobile`. It is more robust and works better
> with full page caching.
> — `WordPressVIPMinimum.Functions.RestrictedFunctions.wp_is_mobile_wp_is_mobile`

VIP's suggested fix (`jetpack_is_mobile()`) works by **splitting the cache** into
mobile and desktop variants. That's strictly worse than not varying at all: it
doubles cache entries for a page whose markup is otherwise one-size-fits-all,
and it still relies on UA sniffing. Prefer the approach below.

## 2. What makes this smaller than it looks

**Every screen is already rendered into the DOM.** The template loops all screens
and emits each as a `<section class="clipisode-flow-screen …">`, hidden by CSS:

```css
.clipisode-flow-screen          { opacity: 0; visibility: hidden; pointer-events: none; }
.clipisode-flow-screen.is-active { opacity: 1; visibility: visible; pointer-events: auto; }
```

So `$screen_type` does not control *what is in the HTML*. It controls only four
things:

1. `is-active` on one section, for a no-flash first paint (`$active_class`).
2. The `clipisode-flow-screen-<type>` class on `<body>` — **used by no CSS
   selector in the file** (verified: zero matches for `body.clipisode-flow-screen`).
   Cosmetic; can stay or go.
3. The IAPI store's initial `state.screen`, which after hydration drives
   `data-wp-class--is-active="state.isActiveScreen"` (compares
   `context.matches === state.screen`).
4. Whether the QR script is enqueued — **this is the open decision, §4.**

The `?screen=<type>` override must keep winning, as the phone-testing affordance.

## 3. Proposed implementation

CSS decides the entry screen at first paint; the store takes ownership at
hydration. No UA sniffing, one cache entry, no flash, and it degrades correctly
if JS never runs.

**a. Remove the UA branch.** Leave `$screen_type` empty when no `?screen=` is
given, and pass a flag into the template indicating "entry undecided."

**b. Mark the document as undecided** when — and only when — there's no explicit
`?screen=`: add a class such as `clipisode-flow-entry-undecided` to `<body>`, and
emit `is-active` on *neither* intro.

**c. Let CSS choose,** scoped to that class so it applies at first paint only.
Use the breakpoint already established in the file, `880px` (see the existing
`@media (max-width: 880px)` block) rather than inventing a second one:

```css
body.clipisode-flow-entry-undecided .clipisode-flow-screen-intro {
	opacity: 1; visibility: visible; pointer-events: auto;
}
@media (min-width: 881px) {
	body.clipisode-flow-entry-undecided .clipisode-flow-screen-intro {
		opacity: 0; visibility: hidden; pointer-events: none;
	}
	body.clipisode-flow-entry-undecided .clipisode-flow-screen-intro_desktop {
		opacity: 1; visibility: visible; pointer-events: auto;
	}
}
```

**d. Hand over at hydration.** In the store's `init` callback: set
`state.screen` from `window.matchMedia( '(min-width: 881px)' ).matches`, then
remove `clipisode-flow-entry-undecided` from `<body>` so the override stops
applying and `data-wp-class--is-active` is the only thing driving visibility.
Order matters — set state first, then drop the class, or there's a one-frame gap
where nothing is active.

**e. Keep the server default honest.** `state.screen` still needs a value in the
server-rendered store JSON. Use `'intro'`. If JS is disabled the CSS is in
charge and correct; if JS runs, `init` corrects the state before it's read.

**f. The 404 guard** currently tests `empty( $screens[ $screen_type ] )`. With no
server-side choice it should test that *at least one* intro exists, rather than
the specific one the server would have picked.

## 4. Open decision: the QR bundle

The desktop intro needs `build/qr/view.js` (~24 KB, exposes `window.clipisodeQr`).
It's enqueued today behind exactly the branch this spec removes, with an explicit
rationale in the code:

> Loading it only on the desktop screen avoids dragging ~24 KB of QR code onto
> every mobile guest.

Once the server can't know the device, that optimization has to be rebuilt or
given up. Three options:

| Option | Cost | Notes |
|---|---|---|
| **A. Always enqueue** | ~24 KB on every mobile guest | One line. Loses a deliberate optimization on the connection type that can least afford it — a phone on a venue's congested network is the whole use case. |
| **B. Inject the script from JS** when the desktop entry is chosen | ~10 lines in `store.js`; QR paints slightly later | Preserves both goals. The mount `<div>` already exists, so there's a natural placeholder. Recommended. |
| **C. Separate URL for desktop** (e.g. `/invitation/<slug>/desktop`) | New rewrite, new canonical/OG questions, QR content changes | Two cache entries but each fully static. Cleanest caching story, most product surface. |

**Recommendation: B.** It keeps mobile payload where it is, needs no new routes,
and the deferred QR paint is acceptable on a screen whose entire job is "scan
this with your phone." A is a reasonable shortcut if we want the caching win
landed today and are willing to revisit.

### Why not C — resolved 2026-08-07

C was considered seriously in the form "root URL redirects desktop visitors to
`/desktop`, and `/desktop` redirects phones back." It was rejected. Recording the
reasoning so it isn't re-litigated.

**A UA-based redirect has the identical cache-poisoning bug as UA-based
rendering.** A redirect is just another HTTP response, and responses get cached.
The edge caches "desktop → `/desktop`" and then every visitor is bounced there,
phones included. 301 is cacheable by default; 302 is not per RFC 7231 but is
commonly cached depending on edge configuration, so this would depend on VIP's
config rather than on a guarantee. Making it safe means marking the root
`no-store`, which puts every guest view back into PHP — exactly what this work
removes.

**This does not conflict with the byte-identical criterion in §5, though.** That
criterion is *per URL*. Two URLs each serving byte-identical HTML are both
perfectly cacheable. What breaks caching is any UA-dependent response *at a
cacheable URL* — HTML or redirect. C is therefore viable only with client-side
redirects, which cost desktop a flash plus an extra navigation.

**The editability argument for C does not hold.** `intro` and `intro_desktop` are
already separate `clipisode_screen` posts, independently editable in the block
editor. Splitting the URL buys nothing there.

**C's real advantage, measured.** It does solve §4 statically — desktop is its own
URL, so the QR script is enqueued unconditionally with no UA detection and no lazy
loading, and mobile ships neither the desktop markup nor the bundle. But
`intro_desktop.html` is ~4 KB of block markup, roughly 1.5 KB gzipped once
rendered, and B lazy-loads the QR script anyway. **C's mobile saving over B is
~1–2 KB gzipped** — not worth a new rewrite, canonical/OG handling, the QR URL
special case, and bidirectional redirects.

**The sharing problem is what settles it.** After redirecting, the desktop user's
address bar reads `/desktop`. That is the URL they copy to a friend. So `/desktop`
needs to bounce phones back, which is a second UA decision and a second
cacheability problem.

**Would flip to C if:** the desktop screen becomes a real experience (its own
player, a reply gallery, a sponsor unit) rather than an interstitial, so its
payload stops being rounding error — or if we want genuinely different OG cards
per surface.

**Worth taking from C now:** add `/desktop` as an *addressable* route with **no
redirects at all**. Nothing sends anyone there automatically; it just gives
authors and clients a stable URL for previewing and sharing the desktop screen,
which is friendlier than `?screen=intro_desktop`. Purely additive, fully
cacheable, compatible with B. Land it alongside B.

## 5. Verification

Cannot be verified by unit test — it's viewport behaviour in a real browser.
Check, on a local site with the flow served at the configured prefix:

1. Desktop viewport, no `?screen=`: desktop intro at first paint, **no flash** of
   the mobile intro.
2. Narrow viewport: mobile intro, no flash.
3. Resize across 880px **before** hydration: CSS follows. After hydration state
   owns it and it should *not* thrash mid-flow.
4. `?screen=intro_desktop` on a phone still forces the desktop layout.
5. With JS disabled: correct screen still shows for both viewports.
6. `curl` the same URL with a desktop UA and a mobile UA — **byte-identical HTML**.
   That's the actual acceptance criterion.
7. QR code renders on desktop (and, under option B, that the script is not
   requested at all on mobile).

## 6. Related

- `docs/decision-log.md` — "Invitation page must be edge-cacheable" for the
  surrounding decisions.
- Already landed: the pageview write is gone, and screen rendering is memoised in
  the object cache (`Clipisode_Post_Types::render_flow_screen()`).
- Still outstanding for full cacheability: moving the upload token out of the
  cached HTML into an uncached session endpoint. Separate spec, and it carries the
  rate-limiting and presigned-S3 work with it.
