# Media Refactor

Centralize all media references into a single `wp_clipisode_media` table, replacing scattered attachment IDs and URL strings across the schema.

## Problem

Media is currently tracked three different ways:

| Table | Column | Storage |
|---|---|---|
| `clipisode_topics` | `intro_video_id` | WP attachment ID |
| `clipisode_outputs` | `attachment_id` | WP attachment ID |
| `clipisode_replies` | `video_url` | Raw URL string |

Additional issues:
- `_clipisode_managed` post meta on WP attachments acts as an ownership marker — every delete path must remember to check it.
- `class-media.php` hooks into the WP media grid/list to hide managed files, using meta queries that slow down the media library.
- Replies store a URL, not an ID — no way to delete the underlying file when a reply is removed.
- Column names leak WordPress internals (`attachment_id`, `intro_video_id`) instead of describing the domain.

## New Table: `wp_clipisode_media`

```sql
CREATE TABLE wp_clipisode_media (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  type VARCHAR(20) NOT NULL,           -- 'video', 'photo', 'audio'
  label VARCHAR(40) NOT NULL,          -- role/variant: 'original', 'trim', 'thumbnail', 'intro', 'mux'
  storage VARCHAR(20) NOT NULL DEFAULT 'local',  -- 'local' (WP media library), 's3' (future)
  path TEXT NOT NULL,                  -- storage-relative reference (see below)
  parent_id BIGINT UNSIGNED DEFAULT NULL,          -- self-FK: trimmed/derived media points to its original
  attachment_id BIGINT UNSIGNED DEFAULT NULL,     -- WP attachment ID, only when storage = 'local'
  mime_type VARCHAR(100) DEFAULT NULL,
  file_size BIGINT UNSIGNED DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY type (type),
  KEY parent_id (parent_id)
);
```

### `path` field

A generic, storage-relative reference. Never a full URL — the URL is resolved at runtime by `Clipisode_Media::get_url( id )` based on `storage` + `path`.

| `storage` | `path` example | URL resolved as |
|---|---|---|
| `local` | `2026/02/intro-video.mp4` | `wp_get_attachment_url( attachment_id )` |
| `s3` | `videos/abc123.mp4` | `https://{bucket}.s3.{region}.amazonaws.com/{path}` or signed URL |
| `cdn` (future) | `videos/abc123.mp4` | `https://cdn.clipisode.com/{path}` |

This keeps the table storage-agnostic. If you swap CDNs or move buckets, you update the resolver — not every row.

### `parent_id` field

Self-referencing FK for derived media. The original reply video is the parent; trimmed versions point back to it.

```
reply video    id=10, label='original', parent_id=NULL
  └─ trim A    id=15, label='trim',     parent_id=10
  └─ trim B    id=22, label='trim',     parent_id=10
  └─ thumb     id=23, label='thumbnail', parent_id=10, type='photo'
```

This means:
- The original reply video is never destroyed by trimming — it stays available for future clipisodes with different (or no) trims.
- Outputs reference the trimmed `media_id`, replies reference the original `media_id`.
- Deleting a parent cascades: `Clipisode_Media::delete()` removes all children first.
- `Clipisode_Media::create_derived( parent_id, type, file )` creates a child row linked to the original.

## Schema Changes

### `clipisode_topics`

| Before | After |
|---|---|
| `intro_video_id BIGINT UNSIGNED` | `intro_media_id BIGINT UNSIGNED` → FK to `clipisode_media.id` |

### `clipisode_outputs`

| Before | After |
|---|---|
| `attachment_id BIGINT UNSIGNED` | `media_id BIGINT UNSIGNED` → FK to `clipisode_media.id` |

### `clipisode_replies`

| Before | After |
|---|---|
| `video_url TEXT` | `media_id BIGINT UNSIGNED` → FK to `clipisode_media.id` |

## Code Changes

### `class-media.php`

- Keep `META_KEY` (`_clipisode_managed`) and the WP media library hiding hooks — these are an internal detail of `storage = 'local'` to prevent clipisode videos from cluttering the WP media grid. Set automatically by `create()`, cleaned up by `delete()`.
- Add static methods: `create( type, label, upload_key )`, `create_from_sideload( type, label, file_array )`, `delete( id )`, `get_url( id )`.
- `create()` calls `media_handle_upload()`, sets `_clipisode_managed` meta, creates the `clipisode_media` row with the relative upload path, returns `{ id, url }`.
- `create_from_sideload()` same flow but via `media_handle_sideload()`.
- `delete()` removes all children (recursive), then removes the `clipisode_media` row and the underlying WP attachment (if `storage = 'local'`).
- `get_url( id )` resolves `storage` + `attachment_id` into a full URL. For `local`, calls `wp_get_attachment_url()`. For `s3`, builds the URL from config + path.

### `class-rest-api.php`

- All upload endpoints (`upload_video`, `sideload_video`, `upload_output`) call `Clipisode_Media::create()` instead of `media_handle_upload()` directly.
- All delete paths call `Clipisode_Media::delete()` instead of `wp_delete_attachment()` with manual meta checks.
- `enrich_topic()` joins `clipisode_media` to resolve `intro_media_id` → URL.
- Output enrichment joins `clipisode_media` to resolve `media_id` → URL.
- Reply queries join `clipisode_media` to resolve `media_id` → URL.

### `class-invitation.php`

- `upload_video()` calls `Clipisode_Media::create()`, returns the `clipisode_media.id`.
- `submit_reply()` stores `media_id` instead of `video_url`.

### Frontend

- `Topic.intro_video_id` → `Topic.intro_media_id` (TS type).
- `Output.attachment_id` removed from type (never exposed to frontend anyway).
- `Reply.video_url` stays as `video_url` in the API response (resolved by the server via join) — no frontend change needed.

### REST API Responses

The API continues to return resolved URLs. The `media_id` is an internal concern. Consumers see:

- `topic.intro_video_url` — resolved from `clipisode_media` via `intro_media_id`
- `output.url` — resolved from `clipisode_media` via `media_id`
- `reply.video_url` — resolved from `clipisode_media` via `media_id`

### Video Endpoints

| Endpoint | Change |
|---|---|
| `POST /videos/upload` | Returns `{ id, url }` where `id` is now `clipisode_media.id` |
| `POST /videos/sideload` | Same |
| `DELETE /videos/{id}` | `id` is now `clipisode_media.id`, calls `Clipisode_Media::delete()` |
| `POST /outputs/{id}/upload` | Internally creates a `clipisode_media` row |
| `POST /invitation/upload` | Internally creates a `clipisode_media` row |

## Migration (SQL)

Run manually during development:

```sql
-- 1. Create the new table (handled by dbDelta on reactivation)

-- 2. Migrate topics intro videos
INSERT INTO wp_clipisode_media (type, storage, path, attachment_id, mime_type, created_at)
SELECT 'video', 'local', REPLACE(guid, CONCAT('{site_url}', '/wp-content/uploads/'), ''), id, post_mime_type, post_date
FROM wp_posts
WHERE id IN (SELECT intro_video_id FROM wp_clipisode_topics WHERE intro_video_id IS NOT NULL);

-- 3. Migrate output videos
INSERT INTO wp_clipisode_media (type, storage, path, attachment_id, mime_type, created_at)
SELECT 'video', 'local', REPLACE(guid, CONCAT('{site_url}', '/wp-content/uploads/'), ''), id, post_mime_type, post_date
FROM wp_posts
WHERE id IN (SELECT attachment_id FROM wp_clipisode_outputs WHERE attachment_id IS NOT NULL);

-- 4. Update FKs (topic intro_media_id, output media_id, reply media_id)
-- Exact queries depend on mapping old attachment IDs to new clipisode_media IDs

-- 5. Drop old columns
ALTER TABLE wp_clipisode_topics DROP COLUMN intro_video_id;
ALTER TABLE wp_clipisode_outputs DROP COLUMN attachment_id;
ALTER TABLE wp_clipisode_replies DROP COLUMN video_url;

-- 6. Clean up _clipisode_managed post meta
DELETE FROM wp_postmeta WHERE meta_key = '_clipisode_managed';
```

## Future

- `storage = 's3'`: `Clipisode_Media::create()` uploads to S3 instead of WP media library, stores the S3 key in `path`, leaves `attachment_id` NULL. `get_url()` builds the full URL from bucket config.
- Photo/audio types: same table, different `type` value. No schema changes needed.
- Thumbnails: create a `clipisode_media` row with `type = 'photo'` and `parent_id` pointing to the video it was extracted from.
