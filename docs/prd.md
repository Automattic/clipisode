# Clipisode — WordPress Plugin PRD

**Status:** Draft
**Authors:** Max Schmeling, Brian Alvey, Christoph Khouri
**Last Updated:** 2026-02-18

---

## Overview

Clipisode is a WordPress plugin that enables creators and brands to collect, curate, and publish user-generated video content. Visitors record or upload short video replies to topics — no app install required — and site owners moderate, organize, and publish the results directly from wp-admin.

## Problem

Collecting user-generated video is still painful:
- Email/DM collection is chaotic and doesn't secure rights
- Hashtag campaigns get hijacked
- Existing solutions require users to install apps
- Video compositing requires expensive software and expertise

## Target Users

1. **Creators** — YouTubers, podcasters, influencers running AMAs, challenges, fan engagement
2. **Brands/Agencies** — Marketing teams running UGC campaigns, testimonials, event content
3. **Publishers** — News organizations and WordPress sites collecting viewer/reader submissions

---

## Core Concepts

| Concept | Description |
|---|---|
| **Topic** | A call for video replies. Has a title, optional intro video, hosted-by name, brand terms, optional custom terms, and one or more invitation links. |
| **Invitation Link** | A shareable URL tied to a topic. Visitors land on a themed, mobile-optimized page where they can watch the prompt and record/upload a reply. No login or app install needed. Has a `type` field (`reply` for guest submissions; `intro` reserved for future host-recorded intro videos). |
| **Reply** | A submitted video with metadata: name, transcript, social handle, social network, email, tag, timestamp. Replies go through moderation (Approved / Unapproved / On Hold / Rejected) and can be tagged and filtered. Each reply snapshots the exact brand and custom terms in effect at submission time (post ID + revision ID). |
| **Output (Clipisode)** | A muxed video combining a topic's intro video and approved replies. Created by sending source video URLs to a local Mac app via WebSocket for compositing. Multiple outputs per topic are supported (e.g. "All Replies", "Highlight Reel"). `topic_id` is nullable to support future cross-topic outputs. Each output has a globally unique slug used as the download filename. |
| **Terms** | Legal terms presented to guests before submission. Managed as a WordPress CPT (`clipisode_terms`). Two types: a single **Brand Terms** set (seeded on activation with `{{BRAND}}` replaced by the site name, always applied) and optional **Custom Terms** (can be assigned per-topic). Both support revisions. |

---

## Admin UI (wp-admin)

The admin UI is a React single-page application rendered inside a standard wp-admin page, using hash-based routing for internal navigation.

### Menu Structure

Top-level menu: **Clipisode**

| Submenu | Description |
|---|---|
| **Topics** | List and manage topics. |
| **Replies** | Browse and moderate all replies across topics. |
| **Themes** | Manage invitation layout themes (clone, edit in block editor, delete). |
| **Settings** | Terms management, hosts, storage and transcription configuration. |

### Topics List Page

- Table of all topics showing title, clicks, replies count, status, created date.
- **New Topic** button.

### New / Edit Topic

- Title
- Hosted by (brand/organization name)
- Intro video — upload file (drag-and-drop or file chooser) or import from URL. Client-side validation enforces: common video types (MP4, MOV, WebM, M4V), portrait orientation (height > width), audio track present, max 80 MB. Uploaded videos are stored in the WordPress media library and hidden from the standard Media Library UI.
- Additional Custom Terms — optional dropdown of published custom terms. Brand terms are always included by default.

### Topic Detail Page

Three sections on one screen:

**1. Topic Summary**
- Title, intro video player, created date, hosted by.
- Aggregate stats: clicks, replies.
- Links to brand terms and custom terms (if assigned).
- Edit button.

**2. Invitation Links**
- Table: link slug, type, status (open/closed), clicks, replies, created date.
- **New** button to create an invitation link for this topic.

**3. Clipisode (Outputs)**
- "Generate Clipisode" button (disabled if no approved replies). Each click creates a new output — not a replacement.
- Connects to a local Mac app via WebSocket (`ws://127.0.0.1:63481`), sends source video URLs and a callback URL.
- Shows real-time progress (phase, message, progress bar) with cancel support.
- On completion, the Mac app POSTs the muxed video to a WP REST endpoint; the admin UI shows a video player with download and delete buttons.
- Existing outputs are listed with video player, download (`{slug}.mp4`), and delete (with confirmation, also removes media library attachment).
- See [docs/mux.md](mux.md) for full protocol and implementation details.

**4. Replies (for this topic)**
- Table: status badge, name, tag, transcript preview, created date.
- Each row opens a **Reply Detail Modal** for quick moderation:
  - Video player
  - Name, social handle, transcript, timestamp, download link
  - Actions: **Approve**, **Reject**, **On Hold**
  - Tag editing
- Sort by newest / oldest; filter by tag.
- **See All** link navigates to the Replies page scoped to this topic.

### Replies Page

A single, shared page used in two contexts:

| Context | Behavior |
|---|---|
| From **Clipisode → Replies** submenu | Shows all replies across all topics. Topic column visible; topic filter dropdown available. |
| From a Topic Detail **See All** link | Pre-filtered to that topic. Topic column hidden. |

**Filters & sorting:**
- Status: Approved, Unapproved, On Hold (tab or dropdown).
- Topic (dropdown, visible in global context).
- Tag.
- Sort: Newest / Oldest.

**Row actions:** same Reply Detail Modal as on Topic Detail.

**Bulk actions:** Approve, Reject, On Hold selected replies.

### Settings Page

**Terms section:**
- **Brand Terms** — card with Edit and Preview links. A single, non-deletable set of terms seeded on plugin activation. Content is editable via the standard WordPress post editor. Always applied to every topic.
- **Custom Terms** — table listing all custom terms with title, last modified date, preview link, and edit link. "Add New" button creates a new custom terms post in the WordPress editor. Custom terms can optionally be assigned to individual topics.

**General section:**
- Storage configuration (planned).
- Transcription configuration (planned).

---

## Plugin Architecture

### Tech Stack
- **PHP**: Plugin bootstrap, REST API endpoints, CPT registration, media handling, database management.
- **TypeScript / React**: Admin UI built with `@wordpress/element`, `@wordpress/components`, `@wordpress/api-fetch`. Bundled with `@wordpress/scripts`.
- **SCSS**: Styles compiled via `@wordpress/scripts`.

### Data Model

**Custom database tables** (created on plugin activation):

| Table | Key Columns |
|---|---|
| `wp_clipisode_topics` | `id`, `title`, `intro_video_id`, `hosted_by`, `brand_terms_id`, `custom_terms_id`, `status`, `created_at`, `updated_at` |
| `wp_clipisode_invitation_links` | `id`, `topic_id`, `slug` (unique), `type`, `status`, `clicks`, `created_at` |
| `wp_clipisode_replies` | `id`, `topic_id`, `invitation_link_id`, `name`, `video_url`, `transcript`, `social_handle`, `social_network`, `tag`, `status`, `email`, `brand_terms_id`, `brand_terms_revision_id`, `custom_terms_id`, `custom_terms_revision_id`, `created_at`, `updated_at` |
| `wp_clipisode_outputs` | `id`, `topic_id` (nullable), `name`, `slug` (unique, auto-incremented on conflict), `attachment_id` (nullable), `created_at` |

**Custom Post Types:**

| CPT | Purpose |
|---|---|
| `clipisode_terms` | Stores brand and custom terms. Distinguished by `_clipisode_terms_type` meta (`brand` or `custom`). Supports title, editor, and revisions. Hidden from frontend listings (`exclude_from_search`, no archive, no nav menus). Slugs auto-prefixed with `clipisode-`. Publicly queryable for admin preview only. |
| `clipisode_invite` | Invitation themes (layouts). Block-based templates using custom Gutenberg blocks (`clipisode/invitation-flow`, stage blocks, element blocks). A default theme is seeded on activation; additional themes can be cloned and customized. |

### REST API

All endpoints under `clipisode/v1`, requiring `manage_options` capability.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/terms/brand` | Get brand terms (id, title, modified, edit_url, preview_url) |
| GET | `/terms/custom` | List custom terms |
| GET | `/topics` | List all topics with aggregate stats |
| POST | `/topics` | Create a topic |
| GET | `/topics/:id` | Get a single topic |
| PUT | `/topics/:id` | Update a topic |
| DELETE | `/topics/:id` | Delete a topic and its links/replies |
| GET | `/topics/:topic_id/invitation-links` | List invitation links for a topic |
| POST | `/topics/:topic_id/invitation-links` | Create an invitation link |
| PUT | `/invitation-links/:id` | Update an invitation link |
| DELETE | `/invitation-links/:id` | Delete an invitation link |
| GET | `/replies` | List replies (filterable by topic_id, status, tag) |
| GET | `/replies/:id` | Get a single reply |
| PUT | `/replies/:id` | Update a reply (moderation, tags) |
| POST | `/videos/upload` | Upload a video file to media library |
| POST | `/videos/sideload` | Import a video from URL to media library |
| DELETE | `/videos/:id` | Delete a Clipisode-managed video attachment |
| POST | `/outputs` | Create an output row (accepts `topic_id`, `name`; returns `id`, `slug`) |
| POST | `/outputs/:id/upload` | Receive muxed video from Mac app (no auth for POC) |
| DELETE | `/outputs/:id` | Delete output and its media library attachment |
| GET | `/themes` | List invitation themes |
| POST | `/themes` | Clone an invitation theme |
| DELETE | `/themes/:id` | Delete a theme (if not default or in use) |

### Media Handling

- Intro videos are uploaded via REST endpoints and stored as WordPress attachments.
- Clipisode-managed attachments are tagged with `_clipisode_managed` post meta and hidden from the standard WordPress Media Library UI via `ajax_query_attachments_args` and `pre_get_posts` filters.
- Deleting or replacing a topic's intro video automatically cleans up the old attachment.

### Invitation Link Frontend

Each invitation link resolves to a public-facing page at `/invitation/{slug}`. The page is device-responsive with client-side detection (`navigator.maxTouchPoints > 0 && window.innerWidth < 1280`).

**Desktop:** Two-column layout — intro video on the left, QR code of the current URL on the right. No recording flow; visitors are prompted to scan with their phone.

**Mobile/Tablet:** Multi-step recording flow:

| Screen | Purpose |
|---|---|
| **Landing** | Full-screen intro video as background, title overlay, play button, record/upload CTA, terms links. Videos pause when leaving the step. |
| **Record** | Camera capture or file upload with progress indicator. |
| **Form** | Collects name and optional social handles (Instagram, TikTok, X) while the video uploads in the background. |
| **Thanks** | Confirmation message after successful submission. |

Terms links open a fullscreen modal with the terms content fetched via AJAX. Each terms element (brand and custom) has its own scoped modal.

**Invitation Themes** are managed as Gutenberg block templates (`clipisode/invitation-flow` → stage blocks → element blocks). Stages: `invitation-desktop`, `invitation-landing`, `invitation-record`, `invitation-thanks`. Elements: `video`, `title`, `hosted`, `cta`, `terms`, `qr-code`. A default theme is seeded on activation; themes can be cloned and customized in the block editor.

### Video Submission (Web)
- **MediaRecorder API** for in-browser recording on mobile and desktop.
- **File upload** as an alternative path.
- **Progressive upload** for large files.

### Rights & Consent
- Brand terms always applied; custom terms optionally assigned per-topic.
- Replies store `brand_terms_id`, `brand_terms_revision_id`, `custom_terms_id`, and `custom_terms_revision_id` to snapshot the exact terms content accepted at submission time.

### Transcription
- Automatic transcription of submissions (Whisper or equivalent).
- Used for review and future captioning.

### Storage
- WordPress media library integration for approved content.
- External object storage (S3/R2) for raw submissions.
- CDN delivery for published videos.

### Publishing
- Gutenberg blocks for embedding topics and individual replies on posts/pages.

---

## Out of Scope (for now)

- Cloud-based video compositing (currently local Mac app via WebSocket).
- Cross-topic outputs / highlight reels (database supports it via nullable `topic_id`, UI not yet built).
- Answer/star flows (sending curated replies to a host for on-camera answers).
- Authentication for the muxing upload endpoint (currently open for POC).
- Analytics dashboard.
- White-label / multi-tenant.
- Pricing and billing.
- CSV export of replies.

---

## Success Metrics

- Time from plugin install to first topic live: **< 5 minutes**
- Submission completion rate (start recording → reply received)
- Replies collected per topic
- Creator/brand retention (monthly active topics)

---

## Open Questions

1. Self-hosted media processing vs. a hosted service for transcription and heavy lifting?
2. Gutenberg-only or also support Classic Editor?
3. How to handle storage limits on budget hosting?
4. Authentication for the Brand Manager area — WordPress roles, or a separate capability system?
