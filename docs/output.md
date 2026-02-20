# Create Clipisode

## Overview

The "Create Clipisode" flow lets users select approved replies from a topic, optionally include the intro, trim any clip, reorder them, and render a final composite video via the local Mac transcoding app.

## UI Flow

### 1. Topic Detail Page

- Checkboxes appear next to each approved reply.
- A "Create Clipisode" button is enabled when at least one reply is checked.
- Clicking it navigates to the create page, passing `topic_id` and the selected `reply_ids`.

### 2. Create Clipisode Page

Route: `clipisode-create?topic_id=6&reply_ids=13,14`

No menu item — only reachable from the topic page.

#### Clip List

A sortable list of clips. Each row shows:

| Field | Description |
|---|---|
| Drag handle | For reordering via drag-and-drop |
| Checkbox | Checked by default. Uncheck to exclude (e.g. intro). |
| Thumbnail / name | Clip identifier |
| Duration | Original duration (fetched via `loadedmetadata`) |
| Trim info | Shows `[in] – [out]` if trimmed, otherwise "Full" |
| Trim button | Opens the trim modal |

**Initial order:**
1. Topic intro video (if the topic has one) — checked by default, can be unchecked
2. Selected replies in the order they were checked

Clips can be dragged to reorder at any time.

#### Trim Modal

Full-width modal with:

- `<video>` player showing the clip
- Custom canvas-based timeline bar below the player
- Two draggable trim handles styled as `]` (in) and `[` (out)
- Selected region highlighted between the handles
- Playhead indicator (thin vertical line) showing current position
- "Preview" button plays only the in-to-out segment
- "Reset" clears trim back to full duration
- "Done" closes the modal and updates the row with in/out/trimmed duration

**Implementation:** Custom `<canvas>` element. The timeline is drawn as a horizontal bar. Two handles respond to pointer events (mousedown/move/up + touch). The selected region is a highlighted rectangle between the handles. The playhead syncs with `video.currentTime` via `requestAnimationFrame`.

#### Duration Detection

Each clip's total duration is fetched on page load without a visible player:

```typescript
function getDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => resolve(video.duration);
    video.onerror = reject;
    video.src = url;
  });
}
```

#### Create Button

When clicked:

1. Writes a row to `clipisode_outputs` (via existing REST endpoint).
2. Writes rows to `clipisode_contents` (new REST endpoint) — one per checked clip, with position, trim_start, trim_end, and duration.
3. Builds the WebSocket payload and opens a connection to the Mac app.
4. Shows progress UI (same flow as current Topic Detail: connecting → downloading → rendering → uploading → done).
5. On `job_done`, displays a video player with the finished clipisode.

#### Page Leave Warning

While a render is in progress, a `beforeunload` listener warns the user before navigating away.

## Database

### New Table: `clipisode_contents`

```sql
CREATE TABLE wp_clipisode_contents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  output_id BIGINT UNSIGNED NOT NULL,
  media_id BIGINT UNSIGNED NOT NULL,
  position INT UNSIGNED NOT NULL,
  role VARCHAR(20) NOT NULL,
  trim_start DECIMAL(10,3) NOT NULL,
  trim_end DECIMAL(10,3) NOT NULL,
  duration DECIMAL(10,3) NOT NULL,
  PRIMARY KEY (id),
  KEY output_id (output_id),
  KEY media_id (media_id)
);
```

| Column | Description |
|---|---|
| `output_id` | FK → `clipisode_outputs.id` |
| `media_id` | FK → `clipisode_media.id` |
| `position` | Sort order for composition (0-based) |
| `role` | `intro` or `reply` |
| `trim_start` | In point in seconds (`0` if untrimmed) |
| `trim_end` | Out point in seconds (same as `duration` if untrimmed) |
| `duration` | Original full duration of the source clip |

This allows querying "which clipisodes include media X?" via `SELECT output_id FROM clipisode_contents WHERE media_id = ?`.

## WebSocket Payload

The `start_job` payload includes trim data per video:

```json
{
  "type": "start_job",
  "job_id": "20260219T180000Z",
  "callback_url": "https://mcp.local/wp-json/clipisode/v1/outputs/42/upload?token=abc123",
  "videos": {
    "clip_0": {
      "url": "https://mcp.local/wp-content/uploads/intro.mp4",
      "filename": "intro.mp4",
      "name": "Topic Intro",
      "trim_start": 1.5,
      "trim_end": 10.2,
      "duration": 12.4
    },
    "clip_1": {
      "url": "https://mcp.local/wp-content/uploads/reply1.mp4",
      "filename": "reply1.mp4",
      "name": "Brian Alvey",
      "trim_start": 0,
      "trim_end": 22.0,
      "duration": 22.0
    },
    "clip_2": {
      "url": "https://mcp.local/wp-content/uploads/reply2.mp4",
      "filename": "reply2.mp4",
      "name": "Max Schmeling",
      "trim_start": 3.0,
      "trim_end": 8.5,
      "duration": 9.8
    }
  }
}
```

Keys are `clip_0`, `clip_1`, etc. — sorted by position. Each entry includes `trim_start`, `trim_end`, and `duration` so the transcoder knows exactly what segment to use.

## REST API

### New Endpoints

**POST `/clipisode/v1/outputs/{id}/contents`**

Bulk-create content rows for an output.

```json
{
  "contents": [
    { "media_id": 5, "position": 0, "role": "intro", "trim_start": 0, "trim_end": 12.4, "duration": 12.4 },
    { "media_id": 8, "position": 1, "role": "reply", "trim_start": 2.1, "trim_end": 18.5, "duration": 22.0 }
  ]
}
```

**GET `/clipisode/v1/outputs/{id}/contents`**

Returns the content rows for an output (for future re-editing).

## Files to Create/Modify

| File | Change |
|---|---|
| `includes/class-database.php` | Add `clipisode_contents` table |
| `includes/class-rest-api.php` | Add contents endpoints |
| `src/pages/CreateClipisode.tsx` | New page — clip list, reorder, trim, render |
| `src/components/TrimModal.tsx` | Trim modal with video player + canvas timeline |
| `src/components/TrimTimeline.tsx` | Custom canvas component — handles, playhead, region |
| `src/App.tsx` | Add route for `clipisode-create` |
| `src/types.ts` | Add `ClipContent` interface |

## Open Questions

1. **Thumbnail generation**: Should we show video thumbnails in the clip list rows? If so, we'd need to extract a frame (canvas + video element).
2. **Audio waveform**: Should the trim timeline show an audio waveform? Looks great but requires decoding audio data via Web Audio API.
