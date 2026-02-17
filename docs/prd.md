# Clipisode — WordPress Plugin PRD

**Status:** Draft
**Authors:** Max Schmeling, Brian Alvey, Christoph Khouri
**Last Updated:** 2026-02-17

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
| **Topic** | A call for video clips. Has a title, optional intro video, hosted-by name, brand terms, optional custom terms, and one or more invitation links. |
| **Invitation Link** | A shareable URL tied to a topic. Visitors land on a themed, mobile-optimized page where they can watch the prompt and record/upload a clip. No login or app install needed. Has a `type` field (`clip` for guest submissions; `intro` reserved for future host-recorded intro videos). |
| **Clip** | A submitted video with metadata: name, transcript, social handle, social network, email, tag, timestamp. Clips go through moderation (Approved / Unapproved / On Hold / Rejected) and can be tagged and filtered. Each clip snapshots the exact brand and custom terms in effect at submission time (post ID + revision ID). |
| **Terms** | Legal terms presented to guests before submission. Managed as a WordPress CPT (`clipisode_terms`). Two types: a single **Brand Terms** set (seeded on activation with `{{BRAND}}` replaced by the site name, always applied) and optional **Custom Terms** (can be assigned per-topic). Both support revisions. |

---

## Admin UI (wp-admin)

The admin UI is a React single-page application rendered inside a standard wp-admin page, using hash-based routing for internal navigation.

### Menu Structure

Top-level menu: **Clipisode**

| Submenu | Description |
|---|---|
| **Topics** | List and manage topics. |
| **Clips** | Browse and moderate all clips across topics. |
| **Settings** | Terms management, storage and transcription configuration. |

### Topics List Page

- Table of all topics showing title, clicks, clips count, status, created date.
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
- Aggregate stats: clicks, clips.
- Links to brand terms and custom terms (if assigned).
- Edit button.

**2. Invitation Links**
- Table: link slug, type, status (open/closed), clicks, clips, created date.
- **New** button to create an invitation link for this topic.

**3. Clips (for this topic)**
- Table: status badge, name, tag, transcript preview, created date.
- Each row opens a **Clip Detail Modal** for quick moderation:
  - Video player
  - Name, social handle, transcript, timestamp, download link
  - Actions: **Approve**, **Reject**, **On Hold**
  - Tag editing
- Sort by newest / oldest; filter by tag.
- **See All** link navigates to the Clips page scoped to this topic.

### Clips Page

A single, shared page used in two contexts:

| Context | Behavior |
|---|---|
| From **Clipisode → Clips** submenu | Shows all clips across all topics. Topic column visible; topic filter dropdown available. |
| From a Topic Detail **See All** link | Pre-filtered to that topic. Topic column hidden. |

**Filters & sorting:**
- Status: Approved, Unapproved, On Hold (tab or dropdown).
- Topic (dropdown, visible in global context).
- Tag.
- Sort: Newest / Oldest.

**Row actions:** same Clip Detail Modal as on Topic Detail.

**Bulk actions:** Approve, Reject, On Hold selected clips.

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
| `wp_clipisode_clips` | `id`, `topic_id`, `invitation_link_id`, `name`, `video_url`, `transcript`, `social_handle`, `social_network`, `tag`, `status`, `email`, `brand_terms_id`, `brand_terms_revision_id`, `custom_terms_id`, `custom_terms_revision_id`, `created_at`, `updated_at` |

**Custom Post Type:**

| CPT | Purpose |
|---|---|
| `clipisode_terms` | Stores brand and custom terms. Distinguished by `_clipisode_terms_type` meta (`brand` or `custom`). Supports title, editor, and revisions. Hidden from frontend listings (`exclude_from_search`, no archive, no nav menus). Slugs auto-prefixed with `clipisode-`. Publicly queryable for admin preview only. |

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
| DELETE | `/topics/:id` | Delete a topic and its links/clips |
| GET | `/topics/:topic_id/invitation-links` | List invitation links for a topic |
| POST | `/topics/:topic_id/invitation-links` | Create an invitation link |
| PUT | `/invitation-links/:id` | Update an invitation link |
| DELETE | `/invitation-links/:id` | Delete an invitation link |
| GET | `/clips` | List clips (filterable by topic_id, status, tag) |
| GET | `/clips/:id` | Get a single clip |
| PUT | `/clips/:id` | Update a clip (moderation, tags) |
| POST | `/videos/upload` | Upload a video file to media library |
| POST | `/videos/sideload` | Import a video from URL to media library |
| DELETE | `/videos/:id` | Delete a Clipisode-managed video attachment |

### Media Handling

- Intro videos are uploaded via REST endpoints and stored as WordPress attachments.
- Clipisode-managed attachments are tagged with `_clipisode_managed` post meta and hidden from the standard WordPress Media Library UI via `ajax_query_attachments_args` and `pre_get_posts` filters.
- Deleting or replacing a topic's intro video automatically cleans up the old attachment.

### Invitation Link Frontend

Each invitation link is a public-facing, themed page with these screens:

| Screen | Purpose |
|---|---|
| **Intro** | Shows intro video, title, play/reply/upload buttons, and links to terms. |
| **Desktop Intro** | Explains the flow and shows a QR code to open on mobile. |
| **Name** | Collects the guest's name and optional social handles (Instagram, TikTok, X) while the video uploads. |
| **Email** | Optionally collects email and adds to a list (e.g. for sweepstakes). |
| **Success** | Confirmation message after successful submission. |
| **Closed** | Shown when the invitation link has expired. |
| **Warning** | Contextual error states: no camera permission, network failure, silent audio, landscape video. |

Themes and screen content are managed via WordPress blocks and patterns rather than hard-coded templates.

### Video Submission (Web)
- **MediaRecorder API** for in-browser recording on mobile and desktop.
- **File upload** as an alternative path.
- **Progressive upload** for large files.

### Rights & Consent
- Brand terms always applied; custom terms optionally assigned per-topic.
- Clips store `brand_terms_id`, `brand_terms_revision_id`, `custom_terms_id`, and `custom_terms_revision_id` to snapshot the exact terms content accepted at submission time.

### Transcription
- Automatic transcription of submissions (Whisper or equivalent).
- Used for review and future captioning.

### Storage
- WordPress media library integration for approved content.
- External object storage (S3/R2) for raw submissions.
- CDN delivery for published videos.

### Publishing
- Gutenberg blocks for embedding topics and individual clips on posts/pages.

---

## Out of Scope (for now)

- Native macOS/iOS app and on-device video rendering.
- Cloud-based video compositing and compilation.
- Answer/star flows (sending curated clips to a host for on-camera answers).
- Analytics dashboard.
- White-label / multi-tenant.
- Pricing and billing.
- CSV export of clips.

---

## Success Metrics

- Time from plugin install to first topic live: **< 5 minutes**
- Submission completion rate (start recording → clip received)
- Clips collected per topic
- Creator/brand retention (monthly active topics)

---

## Open Questions

1. Self-hosted media processing vs. a hosted service for transcription and heavy lifting?
2. Gutenberg-only or also support Classic Editor?
3. How to handle storage limits on budget hosting?
4. Authentication for the Brand Manager area — WordPress roles, or a separate capability system?
5. Integration with Jetpack, WooCommerce, or other Automattic properties?
