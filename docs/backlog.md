# Clipisode Backlog

**Status:** running to-do list, started 2026-10-19. Each item should become a
spec in `docs/specs/` (sized for one Cursor/Grok session) before it's built.
Reasons and decisions live in `docs/decision-log.md`.

**Where:** F = core plugin · V = via VideoPress · E = via VIP · All = everywhere

## Now: security and brand safety (enterprise first)

- [ ] **Hide unapproved replies from the public media API** and attachment pages. They're currently listed at `/wp-json/wp/v2/media`. *(All)*
- [ ] **Bind each reply to its own upload.** `invitation/submit` accepts any `media_id`. Issue a token at upload and require it on submit. *(All)*
- [ ] **Upload session endpoint with rate limiting** (`POST /invitation/session`, already decided). It replaces the cached nonce, throttles by IP and link, and is the hook for CAPTCHA. *(All)*
- [ ] **Bring PHPCS back to 0** (33 after the merge). Proposed as its own session. *(All)*
- [ ] **Remotion licence:** buy the company licence for VIP. Ask legal to confirm the plugin can't go to wp.org with Remotion bundled. *(E)*
- [ ] **Move Remotion into a separate add-on** so the core plugin stays fully GPL; rendering available through VideoPress and VIP. *(F/V/E)*

## Next: the hosted-services foundation

- [ ] **Design the extension points:** storage backend, post-upload ingest hook, render backend, theme-editing capability. This is the first technical task. *(F, consumed by V/E)*
- [ ] **AWS media pipeline for VIP:** direct S3 uploads (resumable), private quarantine, transcoding, poster frames, transcription, signed review URLs. Offer it back to VideoPress if VideoPress can't do it. *(E, then V)*
- [ ] **Transcripts:** populate `replies.transcript`, show and search in WP Admin. *(V/E)*
- [ ] **Usage reporting per site**, so plan allowances can be priced. *(E)*
- [ ] **Moderation at scale:** paginate replies, remove the N+1 media queries, poster-frame grid, bulk actions. *(All)*
- [ ] **Edge-cacheable invitation page:** build `docs/specs/planned/cacheable-intro-screen-selection.md`. *(All)*

## Guest flow fixes

- [ ] **Email screen saves the email.** `submitEmail()` validates and moves on but never sends the email to the server. *(All)*
- [ ] **Trigger the four warning screens** (camera, network, silent, wide). They're seeded and styled but nothing ever shows them. *(All)*
- [ ] **Remove the success screen's Share button.** Decided: people who want to share will copy the link. *(All)*
- [ ] **Upload-limit UX:** show the limit as a time before recording, check the file the moment it's picked, then consider chunked uploads. *(All)*
- [ ] **Onboarding upload-limit check:** detect the host's limit, warn that big replies will fail, and suggest VideoPress. *(F)*
- [ ] **Finish the screen markup sweep** (7 of 10 screens left): `docs/specs/active/screen-markup-sweep-checklist.md`. *(All)*
- [ ] **Revisit if hit: Android back button** leaves the flow. Interactivity API router, or `pushState` until then. See the decision log. *(All)*

## Product and design

- [ ] **Invitation modes (Collab, AMA, Roundup, Highlights):** finish the names, map each mode's defaults, explain them in onboarding, and make mode choice part of creating a topic. Per-invitee links for Collab and Roundup. See the 2026-10-19 decision-log entry. *(All)*
- [ ] **New vision document,** built from the old marketing and investor materials (Brian to supply), with a section on what modern AI makes possible with reply videos. *(All)*
- [ ] **One brand kit for invitation pages and video themes.** Design the shared tokens. *(All)*
- [ ] **Short invitation URLs** (`docs/specs/planned/short-invitation-urls.md`). *(E, ❓ others)*
- [ ] **Keep site scripts out of the reply flow.** Invitation pages run the site's full `wp_head()`/`wp_footer()`, so a publisher's ads, paywall, consent banner and trackers load on the reply screens. Add an allow-list. *(All, matters most on E)*
- [ ] **Custom reply subdomains: not needed for VIP.** Replies go straight to private storage, so `brand.com/clipisode/i/slug` is fine. A subdomain stays an optional vanity URL. On the multisite for select partners, each partner's subsite (`reply.brand.com`) already is the reply site. *(E, optional)*
- [ ] **Marketing and docs site, WP Admin cleanup, onboarding, theme overhaul:** the master-plan deliverables, each to be broken into specs.

## Multisite (required)

- [ ] Seed the default host on every site, not just the activating one.
- [ ] Drop a site's Clipisode tables when the site is deleted.
- [ ] Add an uninstall routine (single site and multisite).

## Housekeeping

- [ ] **Archive the macOS app** (decided). Tag the last commit, remove `transcoding/macos` and the WebSocket tooling from `trunk`, and update `AGENTS.md`, which still describes the Mac render pipeline.
- [ ] **Fix the README Playground button.** It installs a stale v0.1.1 zip. *(Low)*
- [ ] Delete merged and abandoned remote branches (`codex/*`, `gl/*`, `release/*`).
- [ ] Triage the misfiled specs noted in `docs/handoff.md` §6.9.
- [ ] Staging environment for development (see the decision log for what's needed).
