# Guided first Clipisode

## Goal and scope

Help a new administrator make a **real, downloadable Clipisode**, using their own prompt and a real video reply. Make the same improvements useful for returning creators. Ship a WordPress Dashboard Home entry, a Clipisode Home, a resumable four-stage guide, and focused simplifications of the existing creation flow. Do not build a parallel editor, fake sample project, mandatory setup questionnaire, tooltip tour, or new rendering/publishing system.

The user explicitly authorized planning, implementation, merge, and deployment to MaxSchmeling.com. The implementation follows this plan; no additional product-approval round is needed.

## What the repository already does

- `src/App.tsx` routes Clipisode's root directly to `TopicList`; there is no Home or onboarding route.
- `includes/class-admin.php` registers menus and enqueues the whole React application only on Clipisode screens. There is no WordPress Dashboard widget.
- `TopicForm` asks for title, host, intro video, social image, invitation theme and extra terms together. A configured default host and default invitation theme are already selected.
- `create_topic()` already creates an open public invitation link and includes the site's brand terms. **Do not create another link in onboarding.** Intro video and custom terms are optional.
- `TopicDetail` emphasizes statistics, editing, and invitation-link management. The real next step is easy to miss. Replies are reviewed in `ReplyModal`.
- `TopicDetail` preselects approved replies on its initial load, but `onReplyUpdated()` does not update selection. Approving the first reply can leave the Create Clipisode button absent until reloading. Its table shows ten replies while selection can include all replies. Both are concrete workflow defects to fix while simplifying this screen.
- `CreateClipisode` already creates the title, theme, canvas defaults and clip sequence from the chosen topic/media. It has a capable preview-first studio, dirty-state protection, a stable saved-output URL, and an export inspector. Keep these.
- `CompositionExport` already exports MP4 in the browser, uploads it, supports retry/download when upload fails, and exposes an explicitly selected service renderer if configured. A saved composition is not an exported MP4.
- `Clipisode_Preview::get_url()` requires rendered `media_id` and slug. A saved editable draft therefore has **no public watch page** until it is rendered. There is no separate publish-to-WordPress-post operation in this workflow. Use honest language: **save**, **export**, **download** and **share video** once the actual public watch URL exists. Do not invent a Publish button or claim a saved draft can be publicly watched.

## Experience

### 1. Two entry points, one journey

**WordPress Dashboard → Home widget:** title “Make your first Clipisode”; short description “Ask a question, collect video replies, and turn them into a video.” Four compact stage labels and a primary “Get started” link to Clipisode Home. When active, show “Continue your Clipisode” and the actual next action. Hide the promotional guide when the current user dismisses it; WordPress Screen Options remains available. No activation redirect or global nag notices. Restrict the widget to the plugin's existing `manage_options` capability.

Use server-rendered widget markup and a small scoped style, not the full studio/Remotion bundle on `index.php`. Register it on `wp_dashboard_setup`, independent of menu rendering. Its progress and destination must use the same server state as React.

**Clipisode → Home:** make the plugin's root a calm home screen. Top hero with “Your next video starts with a question”, a concise description, and one primary “Make my first Clipisode” / “Continue creating” action. Show the four-stage guide below, and existing topics/recent work underneath or a clear “View topics” link. Keep an obvious “Start another topic” route for experienced users. Expose Topics as a submenu/explicit route and preserve existing numeric topic, edit, and compose deep links.

Fresh installs see the guide expanded. Existing installations see existing work prominently and an optional “Try the guided flow”; do not pretend an experienced site is empty or automatically enlist an arbitrary existing topic. Users can deliberately continue an existing topic or start a new one. The guide should say “Make a Clipisode” rather than “first” when the site already has content.

### 2. Four stages, tied to actual data

1. **Create a topic.** “What would you like people to talk about?” Enter a real title/prompt, optionally an intro video, and create it. Example prompts are clickable text suggestions only; never create fake topics/media. Explain that a topic is the question people will answer. On success, bind the guide to the returned real topic ID and go to its detail screen.
2. **Collect a reply.** Show the existing open invitation URL in a prominent share card, with “Copy invitation link” and “Open invitation”. Explain “Want to try it yourself? Open your invitation and submit a short video.” This makes start-to-finish possible without waiting for another person and exercises the real public upload/consent flow. Keep the admin tab available when opening the invitation. Refresh replies on return to the tab and provide an explicit “Check for replies” action. Once a reply exists, the primary next action becomes “Review replies”; after explicit approval, move to stage 3. Never auto-approve public submissions.
3. **Make your video.** Preselect eligible approved replies, include the optional intro first, and enter the existing studio. The guide gives one sentence: “Preview your video. Reorder or trim clips if you like; your theme and title are ready.” Primary editor action “Save and continue” saves through the existing output API and opens Export. Keep a secondary save-only action if needed for experienced editing. Bind the guide to the returned output ID. Do not mark export complete on save.
4. **Export and share.** Present the existing browser export as “Create MP4” / “Export MP4”, with a short “Keep this tab open” explanation. Keep service rendering an explicit alternate choice, only when configured; no silent renderer switching. After rendered media and the actual public watch URL exist, show “Your Clipisode is ready”, Download MP4, “Copy video link”, “Watch video” and “Make another Clipisode”. Refresh the saved output after export to obtain the backend's real `preview_url`; do not construct or promise one for a draft. If the browser has created a blob but upload failed, preserve its Download and Retry upload actions, and accurately say the file is not yet saved to the site.

The complete journey must work with one short self-submitted reply and no intro video, no custom image, and no theme customization. Users may leave the guide at any point and continue through ordinary screens.

### 3. Simplify the existing screens

**Topic form:** primary card contains only title/prompt and optional intro-video disclosure. Show host and chosen theme as a compact defaults summary with “Customize” disclosure for host, theme, social image and additional terms. Existing default host/theme are authoritative; never overwrite configured defaults or create a new default host. Brand terms stay included and are mentioned in brief help text. Editing an existing topic preserves all populated values regardless of disclosure state. Keep all advanced tools reachable but do not direct first-time users to the block editor or custom-terms creation before they have made a topic. Wrap creation in a semantic form with Enter submit and useful field errors.

**Topic detail:** place a compact current-step card above statistics and make the next action primary rather than Edit Topic. Show one usable open invitation prominently; move slug/social-image/multiple-link management behind “Manage invitation links”. Do not silently reopen a deliberately closed invitation: if all are closed, explain and offer a deliberate reopen/create action. Keep statistics secondary. The reply area must provide keyboard-operable Review buttons, named selection checkboxes, and a visible selection count. Either show all selected replies with scrolling/pagination or restrict selection to visible choices; do not silently include hidden rows. When a reply is approved, add it to the eligible selection; when held/rejected, remove it. Derive launch media IDs from *current* approved status and non-null media IDs, not a stale selection set.

**Studio/export:** retain the established preview/sequence/inspector layout. Add a narrow guide strip rather than a second editing mode. Surface Export as a clear next action after successful save. Saving failure must leave the user and their changes in place. Do not trigger render immediately from save, and do not start a render from an effect. Dirty changes, concurrent edits, render locks, missing media, required theme fields, and upload-retry behavior must continue to work.

## State and architecture

### Persist intent; derive progress

Use a small `Clipisode_Onboarding` PHP helper and authenticated `/clipisode/v1/onboarding` GET/POST endpoints, or equivalently a clearly separated section of the existing REST class. Both the widget and REST API consume the same state computation. No new database table or schema migration is necessary.

Store only per-user, per-site preferences/associations: active/dismissed state, selected `topic_id`, and selected `output_id` (optionally a guide version). Use site-scoped WordPress user options rather than a global unscoped user-meta value. Do not store a client-asserted “step complete” or arbitrary “next URL”. Permission-check every request with the existing admin capability; sanitize actions and IDs; verify that topic/output exist and an output belongs to the selected topic. A user cannot claim completion by POSTing a boolean.

Compute milestones from real persisted data for the selected topic/output: topic exists; at least one approved reply with media exists; associated output has a saved composition; associated output has its current persisted MP4 and real public watch URL. Counts/status are read-only facts. A changed composition may invalidate its previous export: use existing output/render semantics rather than retaining a stale completed step. Keep selection associations immediately after their successful underlying save, and make state-write errors retryable without recreating the topic/output.

“Dismiss guide” hides guidance, not data, and is per user. A persistent “Show getting-started guide” action on Home restores it. “Start another” clears guide associations only, then starts normal topic creation on explicit submit; it never deletes, resets, edits or duplicates prior content. Normal navigation never writes content merely by mounting a component. If selected content was deleted, show a clear restart/choose-existing state without a broken link. Do not mark a deleted topic completed or silently select a different one.

### Shared UI pieces

- `src/pages/Home.tsx`: Home content, entry/resume/restart, existing work.
- `src/components/OnboardingGuide.tsx` plus a small typed hook/provider: fetch current journey, show stage states and meaningful next actions; share across Home, topic and composer. Prefer one source of fetched state per mounted app rather than separate requests per badge.
- `src/types.ts`: exact onboarding response/action types, bootstrap configuration if needed.
- `src/App.tsx`, `includes/class-admin.php`, `clipisode.php`: Home/Topics routing, dashboard widget registration and minimal styles/enqueues.
- `TopicForm`, `TopicDetail`, `ReplyModal`, `CreateClipisode`, `CompositionExport`: reuse their current operations and add clear completion callbacks/context. Do not duplicate REST composition/upload logic inside onboarding.
- `src/index.scss`: scoped Home/guide/share-card styling. Use a light neutral canvas, bounded card widths, generous spacing, one restrained accent and clear typography. Avoid giant gradients, novelty illustrations, animation, or a full-screen takeover.

## Accessibility and error behavior

- Ordered-list stage indicator; current stage gets `aria-current="step"`; text names distinguish complete/current/upcoming without relying on color.
- Real links for navigation and buttons for operations, not click-only table cells or anchors without `href`.
- Disclosure controls use native `details`/`summary` or WordPress controls with expansion semantics. All fields retain labels.
- Focus the main heading on genuine route/stage transitions, not routine refreshes. Announce saves/copy/progress with polite status text; errors with an appropriate notice. Do not steal focus when a reply arrives.
- Clipboard success is shown only after the promise resolves; failure leaves a selectable URL and clear message.
- Loading/failure states must not be rendered as “no topics/replies”. Retain user input after failures and provide retry. Disable duplicate mutation submissions while in flight.
- Stack cards and actions on narrow screens; avoid horizontal scrolling for the guide, form and main share actions. Preserve visible focus and contrast.

## Implementation order

1. Add shared server-state model/endpoints and the lightweight WordPress widget; add behavioral tests for permission, persistence, stage derivation, deletion, and site/user scope.
2. Add Home, routes and shared guide; verify all old topic/compose deep links still resolve.
3. Simplify topic form/detail, prominent invitation/self-reply path, reply-selection synchronization and actionable errors.
4. Integrate guide with studio save/export and real completion; retain all existing renderer semantics.
5. Run focused and full relevant checks, browser walkthrough, review diff, merge, build a production ZIP and deploy the exact merged tree to the authorized Pressable site. Verify deployed bytes/version and the live Home/widget. Keep a deploy backup/rollback artifact; do not wipe existing topic/media data for an empty-state demo.

## Required verification scenarios

### Behavioral coverage

- New administrator/empty site: both Home entry points show the same four-stage start state; a non-admin sees neither privileged widget nor endpoint data.
- Upgraded site with topics/replies/outputs: existing data, themes and hosts remain unchanged; guide does not select arbitrary content or block normal work.
- Create a topic with just a title and defaults: one real topic and exactly one open invitation link; no intro/image/custom terms required. Reload resumes the correct topic.
- Topic-save success followed by guide-state failure: display recoverable state error and use the saved topic; retry must not create a duplicate topic.
- Open the invitation, upload a short real video, return/check replies, review and approve. Create action appears immediately without a page reload and includes only approved selected media. Hold/reject removes eligibility immediately. Check a topic with more than ten replies.
- Customize optional topic settings, close disclosure, save/reload: hidden populated values are preserved. Invalid or failed requests do not erase fields.
- All invitation links closed: no misleading “share this open invitation”; explicit reopen/new-link handling works. Clipboard rejection does not claim “Copied”.
- Studio initializes topic title, theme, optional intro and chosen replies; no customization required for the default theme. Existing saved compositions reopen unchanged.
- Save-and-continue creates/updates exactly one output and opens Export; failed saves do not advance; editing during an async save remains dirty and is not exported as if saved.
- Browser export completes, uploads, persists a playable MP4 and reveals Download; reloading Home/widget reflects completion. Service export stays opt-in. Unsupported browser, render failure, cancellation, upload failure/retry and unsaved changes retain existing behavior and accurate state.
- Dismiss survives reload and only affects current user/site; show guide resumes; start another preserves old content; deleting a selected topic/output yields a recoverable truthful state.
- Keyboard-only navigation through form, invitation, reply review, stage links, editor/export; narrow viewport and screen-reader labels/status announcements.

### Commands and hands-on checks

- `npm run test:js -- --runInBand` (extend existing composer/export tests for workflow callbacks; add guide/form/selection behavior tests, not DOM-style snapshots).
- `composer test` (extend admin/REST tests and stubs as necessary), PHP syntax checks on changed PHP.
- `npm run build`; run repository lint checks on touched files and report any pre-existing failures separately.
- Browser smoke at a real WordPress install: Dashboard widget → Home → new real topic → public invitation/self-upload → approve → studio → save → export → persisted playable download. Screenshots of Home, concise topic form, share/review stage and final export state at desktop and narrow width.
- On MaxSchmeling.com after deployment: check wp-admin Home/widget, ensure existing topics still list, follow a fresh journey as far as available browser/media access permits, and explicitly report any unverified rendering step. Never equate a passing build or a fake renderer test with a successful live MP4 export.

## Source concerns to watch during implementation

- Root `AGENTS.md` references `plugin/AGENTS.md`, but that file is absent in this checkout.
- `TopicForm` and `TopicDetail` initial requests currently lack useful catch/retry behavior; those failures would otherwise masquerade as onboarding emptiness.
- Topic creation inserts the initial link itself, while explicit link creation has stronger uniqueness/error handling. Do not add a client-side duplicate-link workaround; if the new flow exposes a creation error, fix it at its source.
- Composer uses `history.replaceState` to give the saved output a stable URL without remounting. Preserve that behavior; do not implement a save-and-continue route change that loses in-memory edits or forces duplicate output creation.
- Browser rendering has a composition hash and preserves an exported blob after upload errors. Do not weaken either to make the guide appear successful.
- Global theme/render architecture and public invitation-screen design are outside this change unless a concrete end-to-end blocker is found.

## Implementation verification (2026-11-17)

- Implemented the four-stage guide against existing topic/reply/composition/export operations. Site-prefixed user options store only intent and selected entity IDs. Current MP4 completion is checked against the persisted render's composition hash.
- Real WordPress 7.1.4 + MariaDB 11.4 + Chrome walkthrough passed: Dashboard widget → Home → title-only topic → public invitation upload → explicit approval → studio → Save and continue → real browser MP4 export → persisted download and playable watch page. A generated two-second video fixture produced an 8.064-second H.264/AAC, 1080×1920 MP4 with the theme's opening/ending cards. No renderer was mocked in this walkthrough.
- Verified guide stages 2/3/4/5 from the real API, reopening the saved output directly into Export, hide/show persistence, preserved existing topics, and a 390px viewport without horizontal overflow. Final walkthrough had no browser exceptions.
- `npm run test:js -- --runInBand`: 141 tests passed. `composer test`: 136 tests passed, 429 assertions. Production build and changed-PHP syntax checks passed. New onboarding styles and new/updated workflow components pass their lint checks.
- Existing whole-project checks are not clean: TypeScript reports six missing `@wordpress/blocks`/`@wordpress/block-editor` declarations in unchanged preview-block files. TopicDetail retains six existing lint violations (its baseline has nine); existing PHP files retain their prior VIP lint findings. The new onboarding PHP helper passes PHPCS. These are not presented as passing full-project type/lint checks.
- Real-data testing exposed string-valued topic IDs from the REST enrichment boundary. That boundary now returns numeric IDs, covered by a regression test; guide association is verified against the real API rather than only numeric test fixtures.
