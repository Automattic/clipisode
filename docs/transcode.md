# Transcode Service Integration

## Overview

The transcode service is a local Mac app that composites Clipisode videos. The admin UI connects via WebSocket, sends source video URLs and a callback URL, and receives real-time progress. The Mac app downloads the sources, renders the final video, and POSTs it back to WordPress.

## WebSocket Connection

Server: `ws://127.0.0.1:63481`

The connection is opened on-demand when the user clicks "Generate Clipisode" on the Topic Detail page. It stays open for the duration of the job and closes when the job completes, fails, or is cancelled.

### Flow

```
Client → App:   { type: "hello", client: "clipisode-admin", version: 1 }
App → Client:   { type: "hello_ack", app: "Clipisode", version: 1 }
Client → App:   { type: "start_job", job_id, callback_url, videos }
App → Client:   { type: "job_status", job_id, phase, current, total, message }  (repeated)
App → Client:   { type: "job_done", job_id, output_url }
```

### Messages: Client → App

| type | fields | description |
|---|---|---|
| `hello` | `client`, `version` | Handshake |
| `start_job` | `job_id`, `callback_url`, `videos` | Start rendering |
| `cancel_job` | `job_id` | Cancel in-progress job |

### Messages: App → Client

| type | fields | description |
|---|---|---|
| `hello_ack` | `app`, `version` | Handshake response |
| `job_status` | `job_id`, `phase`, `current`, `total`, `message` | Progress update |
| `job_done` | `job_id`, `output_url` | Render complete |
| `job_error` | `job_id`, `code`, `message` | Render failed |
| `job_cancelled` | `job_id` | Cancellation confirmed |
| `connection_rejected` | `reason` | Connection refused (e.g. already busy) |

### Phases

`downloading` → `rendering` → `uploading` → done

## start_job Payload

```json
{
  "type": "start_job",
  "job_id": "20260218T063000Z",
  "callback_url": "https://mcp.local/wp-json/clipisode/v1/outputs/42/upload?token=abc123",
  "videos": {
    "intro":  { "url": "https://mcp.local/wp-content/uploads/intro.mp4", "filename": "intro.mov", "name": "My Topic" },
    "main_1": { "url": "https://mcp.local/wp-content/uploads/clip1.mp4", "filename": "clip1.mp4", "name": "Brian Alvey" },
    "main_2": { "url": "https://mcp.local/wp-content/uploads/clip2.mp4", "filename": "clip2.mp4", "name": "Max Schmeling" }
  }
}
```

### Fields

| Field | Type | Description |
|---|---|---|
| `job_id` | string | Client-generated ID (timestamp format). Shared by both sides for status, cancel, done, and error messages. |
| `callback_url` | string | WP REST endpoint where the Mac app POSTs the finished video. Includes the output row ID and upload token. |
| `videos` | object | Named map of source videos. Keys determine composition order (sorted alphabetically). |

### `videos` keys

| Key | Required | Description |
|---|---|---|
| `intro` | No | Topic intro video. Omitted if topic has no intro. |
| `main` | Yes (single reply) | Single approved reply. Used when there is exactly one. |
| `main_1`, `main_2`, ... | Yes (multiple replies) | Approved replies, numbered. Used when there are two or more. |

Keys are sorted alphabetically to determine composition order (`intro` → `main` / `main_1` → `main_2` → ...).

Each entry:

| Field | Type | Description |
|---|---|---|
| `url` | string | Direct URL to the media file (WP attachment URL). |
| `filename` | string | Original filename with extension — tells the service the source format. |
| `name` | string | Human-readable label (topic title for intro, reply name for mains). For debugging only — not used by the render service. |

## Callback

The Mac app uploads the rendered video as a multipart POST to the callback URL:

```
POST /clipisode/v1/outputs/{id}/upload?token={upload_token}
Content-Type: multipart/form-data

Form field: video (video/mp4)
```

The endpoint saves via `Clipisode_Media::create()` with label `clipisode` and returns:

```json
{ "id": 5, "url": "https://mcp.local/wp-content/uploads/2026/02/output.mp4" }
```

The Mac app parses this response and sends the `url` back in the `job_done` message as `output_url`.

## Files

| File | What it does |
|---|---|
| `plugin/clipisode/src/pages/TopicDetail.tsx` | Generate Clipisode UI + WebSocket client logic |
| `plugin/clipisode/includes/class-rest-api.php` | Output CRUD, upload endpoint, filename resolution |
| `plugin/clipisode/includes/class-media.php` | `get_url()` and `get_filename()` for media resolution |
| `plugin/clipisode/src/types.ts` | `Topic.intro_video_filename`, `Reply.video_filename` |
| `transcoding/macos/.../Models/Messages.swift` | `StartJobMessage` with `videos` + `callbackUrl`, all outgoing message types |
| `transcoding/macos/.../AppState.swift` | `startRenderJob()` — download, render, upload, send progress/done/error |
| `tools/websocket/echo.py` | Interactive test server — parses `start_job` with `videos`, manual status/done/error commands |

## Test Server

```bash
python3 tools/websocket/echo.py
```

After a `start_job` is received:
- `s <phase> <current> <total> [message]` — send job_status
- `d [file_path]` — upload video to callback + send job_done
- `e [message]` — send job_error
- `c` — send job_cancelled
- `r` — send raw JSON
- `q` — quit

## Open Questions

1. **Outro/interstitial assets**: Should the `videos` map support additional keys like `outro`, `bumper`? If so, the service needs to know the composition order.
2. **Trim data**: When replies are trimmed in the admin, does the payload include trim in/out points, or is the trimmed file a separate media entry sent as-is?
