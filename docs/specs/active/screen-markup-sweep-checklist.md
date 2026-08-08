# Screen markup sweep — remaining work, per screen

**Status:** 🔨 Active. 3 of 10 screens swept (`intro`, `name`, `success`).
**Audience:** whoever picks the sweep back up. Every item below is verified against
the actual files, not inferred from the handoff.
**Audited:** 2026-08-07, against `plugin/clipisode/assets/themes/default/*.html`,
the canvas CSS in `Clipisode_Post_Types::enqueue_screen_editor_canvas_styles()`,
and the public CSS in `clipisode-flow.php`.

---

## 0. Read this first: the font-size rule in the handoff is wrong

`docs/handoff.md` §6.1 states the rule as:

> inline `style.typography.fontSize` **only** where the per-class editor-canvas CSS
> pins a size without `!important`… or where no size is pinned anywhere

The theme README states the opposite, and **the README is what the finished screens
actually do**:

> Starter HTML for headings and paragraphs that should match the canvas defaults out
> of the box should also carry inline `style.typography.fontSize` matching the design
> size. That way the visual default doesn't change when the picker isn't engaged.

Evidence — every swept paragraph carries an inline size, whether or not its class
pins one:

| Class | Canvas CSS pins | Inline in seed | Swept? |
|---|---|---|---|
| `clipisode-intro-host` | 16px | **16px** | ✅ |
| `clipisode-intro-upload` | 12px | **12px** | ✅ |
| `clipisode-intro-terms` | 12px | **12px** | ✅ |
| `clipisode-success-message` | 16px | **16px** | ✅ |
| `clipisode-name-instructions` | *nothing* | **16px** | ✅ |
| `clipisode-introd-instructions` | 16px | **16px** | (desktop) |
| `clipisode-introd-qr-helper` | 16px | **16px** | (desktop) |

So `intro_desktop` is **not** an outlier needing correction — it is already correct,
and the "consistency pass" the handoff calls for on it is a no-op for typography.

**The operative convention, as practised:**

1. **Paragraph-like blocks always carry inline `style.typography.fontSize`** matching
   the design size, regardless of whether the class CSS pins one. This includes
   `clipisode-editor-only` preview paragraphs (see name.html's "Preview: Handle
   Instructions", which carries 16px).
2. **Heading blocks never carry an inline size.** No heading in any seed file does.
   Their size must follow the H1/H2/H3 level so the level dropdown keeps working.
   The README's phrase "headings and paragraphs" is loose here; follow the files.
3. Canvas CSS pins `font-size` / `font-weight` **without** `!important`, so the
   picker can override.

**Design size for every remaining paragraph is 16px** — confirmed in
`clipisode-flow.php`, where `.clipisode-flow-screen p` is `font-size: 16px` and both
`.clipisode-warning-message` and `.clipisode-closed-message` are explicitly 16px.

Fix `docs/handoff.md` §6.1 while you're in here, or the next person re-derives this.

---

## 1. `closed.html` — 1 change

Otherwise clean: `metadata.name` on all 3 blocks, all locks `{move,remove}`, no
empty groups, no comments, no magic hrefs, no v1 references.

- [ ] **Add inline 16px** to `Closed Message` (`clipisode-closed-message`). Canvas
      CSS pins colour and margin only; public CSS is 16px.
- [ ] `Closed Heading` — **no change**. Heading, so no inline size. It has no canvas
      CSS rule at all, which is correct: it inherits from the level.

## 2. `warning_camera.html` — 1 change

- [ ] **Add inline 16px** to `Camera Warning Message` (`clipisode-warning-message`).
- [ ] Heading, buttons, locks, `metadata.name` all correct — no other change.

## 3. `warning_network.html` — 1 change + 1 thing to verify

- [ ] **Add inline 16px** to `Network Warning Message`.
- [ ] **Verify the retry target is right.** This screen's button is
      `clipisode-goto-name`, i.e. it navigates back to the Name screen. The other
      three warning screens use `clipisode-goto-intro` for "Try again". For a
      *network* failure the reply video may already be chosen and partly uploaded,
      so returning to Name (where submit lives) is plausibly intentional — but
      confirm that `goTo` actually **retries the upload** rather than just swapping
      screens. If it only swaps, a guest who hits this screen has no way to resume,
      which is a functional dead end rather than a markup problem.

## 4. `warning_silent.html` — 1 change

- [ ] **Add inline 16px** to `Silent Warning Message`.
- [ ] Two-button vertical layout, both `goto` classes valid — no other change.

## 5. `warning_wide.html` — 1 change

- [ ] **Add inline 16px** to `Wide Warning Message`.
- [ ] Structurally identical to `warning_silent` — no other change.

## 6. `email.html` — 4 changes + 2 real gaps

Markup hygiene is fine (locks, `metadata.name`, no empty groups, no comments), and
the Skip link **does work** — contrary to what you might expect from `#skip` not
being in `FLOW_MAGIC_HREFS`, it has its own rewrite at `clipisode-flow.php:2627`
that injects `data-wp-on--click="actions.skipEmail"`, and `actions.skipEmail` exists
in `store.js:651`. This is *not* another `#share`-style no-op.

- [ ] **Add inline 16px** to `Preview: Email Input`.
- [ ] **Add inline 16px** to `Preview: Opt-in 1`.
- [ ] **Add inline 16px** to `Preview: Opt-in 2`.
- [ ] **Add inline 16px** to `Email Skip Link`.
- [ ] `Email Heading` is an `h3` — **no inline size**.

### Gap A: orphaned canvas CSS

`enqueue_screen_editor_canvas_styles()` styles three email-screen classes that
**exist in no seed file**, so these rules can never match:

- `.clipisode-email-instructions` (line ~3331, `font-size: 16px`) — exists in *no*
  seed file at all.
- `.clipisode-email-root .clipisode-field-label-row-preview` (~3341)
- `.clipisode-email-root .clipisode-field-label-preview` (~3348)
- `.clipisode-email-root .clipisode-field-label-right-preview` (~3355)

The latter three exist only in `name.html`. So either **email.html is missing
blocks** that its canvas CSS was written for (an instructions paragraph, and a
field-label row above the input, mirroring name.html), or the CSS is stale and
should be deleted. Compare the two screens side by side in the editor and decide.
Given name.html has all four, the likelier answer is that email.html was left
incomplete — which would also mean the email screen currently looks *less* like the
real thing in the editor than name does.

### Gap B: the opt-in checkboxes are decorative

The two opt-in previews are static text (`☐ Send me updates from {host_name}`).
There is no Lists data model, no opt-in capture, and nothing binds these to
anything. That is the known product gap in `docs/handoff.md` §6.6 — **out of scope
for the markup sweep**, but do not mistake these blocks for working controls when
you test the screen.

## 7. `intro_desktop.html` — consistency pass is a no-op for typography

Per §0, its two inline 16px sizes are correct as-is. If you want a real pass on this
screen, the open items are the ones already documented in `intro_desktop.md` and
handoff §6.8 (narrow-viewport stacking doesn't scroll), not typography.

---

## Summary

Seven of the nine changes are the same one-line edit — add
`"style":{"typography":{"fontSize":"16px"}}` to a paragraph block's attributes —
across six files. That is genuinely mechanical once §0 is settled.

The two items that need judgement, neither of which is markup:

1. **email.html's missing blocks vs. stale CSS** (Gap A) — a real decision.
2. **the network-warning retry path** (§3) — possibly a functional dead end.

## Verification loop

Per the theme README and handoff §7, for each screen: edit the `.html` seed → WP
Admin → Clipisode → Screens → trash the screen (auto-converts to permanent delete)
→ with Debug mode on click "Reseed missing screens" (or just load any public
invitation URL, which lazily reseeds) → reopen in the editor.

Then check, on each swept screen:

- Opens with **no block-validation error** ("attempt recovery" = the serialised
  markup doesn't match WordPress's serializer byte-for-byte).
- The **font-size picker** shows the expected step and changing it visibly works.
- The **heading level dropdown** (H1→H2→H3) visibly changes size.
- No **layout/variation picker** appears anywhere (means an empty Group is missing
  its `*slot-filler` spacer — none of the remaining screens have empty groups, so
  this should not appear).
- The screen renders correctly in the **public flow**, not just the editor.

Editor-canvas CSS changes need a hard reload of the post editor. Run `php -l` after
every edit to `class-post-types.php` — its CSS lives in double-quoted PHP strings
and an unescaped `"` is a parse error.
