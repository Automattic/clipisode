# Clipisode

WordPress plugin + macOS transcoder for collecting, curating, and publishing user-generated video content. Brands create video prompts ("topics"), share invitation links, collect video replies, and render finished "clipisodes" combining intro + replies.

## Repository Structure

```
clipisode/
├── plugin/clipisode/       # WordPress plugin (PHP + React)
├── transcoding/macos/      # macOS transcoder app (Swift/SwiftUI)
├── docs/                   # Protocol specs and design docs
└── tools/                  # Dev utilities (WebSocket test server)
```

## Tech Stack

**Plugin:** PHP 8.1+, WordPress 6.5+, React 18, TypeScript, SCSS, webpack via `@wordpress/scripts`, Gutenberg blocks, custom tables + CPTs via REST API.

**macOS App:** Swift 5, SwiftUI, AVFoundation, Core Image, Vision, Network.framework (WebSocket + HTTP servers), bundled FFmpeg, macOS 15.7+, menu bar app.

## Commands

### Plugin
```bash
cd plugin/clipisode
npm install          # Install dependencies
npm run build        # Production build
npm run dev          # Watch mode
npm run plugin       # Build + create zip
```

### Local WordPress Database
```bash
mysql -h localhost -P 3306 -u root -proot
```

### Local WordPress Logs

- `~/dev/wp-local/mcp/app/public/wp-content/debug.log`

### macOS App

Open `transcoding/macos/Clipisode/Clipisode.xcodeproj` in Xcode. Build and run (Cmd+R). The app runs as a menu bar utility — look for the film icon, not the dock.

### WebSocket Test Server

For testing the plugin without the macOS app:

```bash
python3 tools/websocket/echo.py
```

## Architecture

### Plugin

Custom database tables for core entities, WordPress CPTs for block-editor content.

**PHP classes:**
- `Clipisode_Admin` — Admin menus, React app entry point
- `Clipisode_REST_API` — All admin REST endpoints
- `Clipisode_Invitation` — Public invitation pages, video upload endpoints
- `Clipisode_Database` — Table creation and schema
- `Clipisode_Media` — Video storage abstraction
- `Clipisode_Post_Types` — CPT registration

**Tables:** `clipisode_topics`, `clipisode_replies`, `clipisode_outputs`, `clipisode_contents`, `clipisode_media`, `clipisode_hosts`, `clipisode_invitation_links`

**Blocks:** Invitation pages use nested Gutenberg blocks (`clipisode/invitation-flow` → stage blocks → `clipisode/element` blocks). Themes saved as CPT posts with block markup.

### macOS App

Two local servers:
- **WebSocket (port 63481)** — receives render jobs, sends progress
- **HTTP (port 63482)** — serves rendered videos with Range support

**Render pipeline:**
1. Browser sends `start_job` with video URLs and callback URL
2. App downloads source videos
3. Composites with AVFoundation (theme elements, CIFilter effects, face tracking)
4. Uploads result to WordPress callback URL
5. Sends `job_done` with final video URL

See `docs/transcode.md` for full WebSocket protocol.

### Connection Flow
```
┌─────────────────┐      WebSocket      ┌─────────────────┐
│  WP Admin UI    │◄──────────────────► │  macOS App      │
│  (React)        │    ws://127.0.0.1   │  (Swift)        │
└────────┬────────┘       :63481        └────────┬────────┘
         │                                       │
         │ REST API                              │ HTTP POST
         ▼                                       ▼
┌─────────────────┐                    ┌─────────────────┐
│  WordPress      │◄───────────────────│  Callback URL   │
│  (PHP)          │   upload video     │  /outputs/{id}  │
└─────────────────┘                    └─────────────────┘
```

## Coding Standards — CRITICAL

- **No fallback code. No legacy code. No workarounds. Ever.** Tell user the root cause; don't code around it.
- **Production code only.** No MVPs, no "good enough for now."
- **Do not add unrequested features.** No extra validation or "improvements."
- **Fix bugs at the source.** Don't change inputs to avoid triggering them.
- **Ask when uncertain.** Do not guess or assume.
- **Wait for confirmation.** If user asks "right?", answer and wait before proceeding.
- **No dead code.** No commented-out code or unused imports.
- **No narrating comments.** Comments explain *why*, not *what*.

### PHP
- WordPress coding standards
- Prefix functions/classes with `Clipisode_` or `clipisode_`
- `sanitize_*()` on input, `esc_*()` on output
- REST endpoints require capability checks or nonce verification

### TypeScript/React
- Functional components with hooks
- `@wordpress/api-fetch` for REST calls
- `@wordpress/components` for UI consistency

### Swift
- Swift Concurrency (`async/await`, `@MainActor`)
- `@Observable` for state management
- No third-party dependencies — Apple frameworks only

## Common Pitfalls

**Plugin:**
- **NEVER edit WordPress core files.** Use hooks and filters.
- **When deleting data via MySQL**, always update foreign key references (e.g., `invitation_id` on topics) in the same operation.
- **When creating a new Gutenberg block**, register it in PHP (`class-invitation.php`), not just the JS/build side.
- **Media is abstracted** — don't access `wp_posts` attachments directly. Use `Clipisode_Media` methods.

**macOS App:**
- **Menu bar app** — no dock icon. Look for film icon in menu bar.
- **Debug disables sandbox** — Release builds are sandboxed with network entitlements.
- **Auto-cleanup** — sources/jobs older than 30 days deleted automatically.
- **Hardcoded ports** — WebSocket 63481, HTTP 63482. Don't change without updating plugin.

**Both:**
- **WebSocket protocol documented** — see `docs/transcode.md` before changing messages.
- **Video keys = composition order** — `intro` → `main` or `main_1` → `main_2` (alphabetical).

## Test Files

### Plugin

**PHP (PHPUnit):**

```bash
cd plugin/clipisode
composer install
composer test
```

Tests live in `tests/phpunit/`. No database required — uses stubs.

**JavaScript (Jest):**

```bash
cd plugin/clipisode
npm run test:js           # Run once
npm run test:js:watch     # Watch mode
```

Tests live in `tests/js/` with `.test.ts` suffix.

### macOS App

Xcode test targets exist (`ClipisodeTests`, `ClipisodeUITests`) but coverage is minimal. The WebSocket test server (`tools/websocket/echo.py`) is the primary testing tool for the render pipeline.

## Files You'll Touch Most

### Plugin

| What | Where |
|------|-------|
| Admin pages | `src/pages/` |
| REST endpoints | `includes/class-rest-api.php` |
| Blocks | `src/blocks/`, `src/element/`, `src/flow/` |
| Types | `src/types.ts` |
| Schema | `includes/class-database.php` |

### macOS App
| What | Where |
|------|-------|
| App state/jobs | `AppState.swift` |
| WebSocket messages | `Models/Messages.swift` |
| Video composition | `Transcoding/CompositionExporter.swift` |
| Theme rendering | `Transcoding/ThemeCompositor.swift` |
| Face effects | `Transcoding/OverlayRenderer.swift`, `FaceDetector.swift` |

## Documentation

- `docs/transcode.md` — WebSocket protocol between plugin and macOS app
- `docs/media.md` — Media storage schema
- `docs/output.md` — Output/contents data model
- `docs/prd.md` — Product requirements
- `docs/mux.md` — Mux integration notes

See also: `plugin/AGENTS.md` for plugin-specific notes.
