# Clipisode

A WordPress plugin and macOS transcoding app for collecting, curating, and publishing user-generated video content.

## What This Project Does

Clipisode lets brands/creators create video prompts ("topics"), share invitation links with their audience, collect video replies, and render finished videos ("clipisodes") that combine an intro with selected replies. The WordPress plugin handles content management and the public-facing invitation flow; the macOS app handles video composition and rendering.

## Repository Structure

```
clipisode/
├── plugin/clipisode/       # WordPress plugin (PHP + React)
├── transcoding/macos/      # macOS transcoder app (Swift/SwiftUI)
├── docs/                   # Protocol specs and design docs
└── tools/                  # Dev utilities (WebSocket test server)
```

## Tech Stack

### WordPress Plugin (`plugin/clipisode/`)

| Layer | Tech |
|-------|------|
| Backend | PHP 8.1+, WordPress 6.5+ |
| Frontend | React 18, TypeScript, SCSS |
| Build | webpack via `@wordpress/scripts` |
| Blocks | Gutenberg block editor |
| Data | Custom tables + CPTs via REST API |

### macOS App (`transcoding/macos/Clipisode/`)

| Layer | Tech |
|-------|------|
| Language | Swift 5, SwiftUI |
| Video | AVFoundation, Core Image, Vision |
| Networking | Network.framework (WebSocket + HTTP servers) |
| Binary | Bundled static FFmpeg |
| Target | macOS 15.7+, menu bar app |

## Commands

### Plugin Development

```bash
cd plugin/clipisode

npm install          # Install dependencies
npm run build        # Production build
npm run dev          # Watch mode
npm run plugin       # Build + create zip for distribution
```

### Local WordPress Database

The local WP site runs via Local. To access MySQL directly:

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

### Plugin Overview

The plugin uses custom database tables for core entities (topics, replies, outputs, media) and WordPress CPTs for content that benefits from the block editor (invitation themes, legal terms).

**Key PHP classes:**

| Class | Purpose |
|-------|---------|
| `Clipisode_Admin` | Admin menus, React app entry point |
| `Clipisode_REST_API` | All admin REST endpoints |
| `Clipisode_Invitation` | Public invitation pages, video upload endpoints |
| `Clipisode_Database` | Table creation and schema |
| `Clipisode_Media` | Video storage abstraction |
| `Clipisode_Post_Types` | CPT registration |

**Database tables:** `clipisode_topics`, `clipisode_replies`, `clipisode_outputs`, `clipisode_contents`, `clipisode_media`, `clipisode_hosts`, `clipisode_invitation_links`

**Block editor:** Invitation pages are built with nested Gutenberg blocks (`clipisode/invitation-flow` contains stage blocks, each containing `clipisode/element` blocks). Themes are saved as CPT posts with block markup.

### macOS App Overview

The app runs two local servers:
- **WebSocket (port 63481)** — receives render jobs from the browser, sends progress updates
- **HTTP (port 63482)** — serves rendered videos with Range support for browser playback

**Render pipeline:**
1. Browser sends `start_job` with video URLs and callback URL
2. App downloads source videos
3. Composites using AVFoundation with optional theme elements, CIFilter effects, face tracking overlays
4. Uploads result to WordPress via callback URL
5. Sends `job_done` with the final video URL

See `docs/transcode.md` for the full WebSocket protocol spec.

### How They Connect

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

## Coding Standards

**CRITICAL — Read These First:**

- **No fallback code. No legacy code. No workarounds. Ever.** If something doesn't work due to the environment, tell the user the root cause and let them fix it. Do not code around it.
- **Production code only.** No MVPs, no "good enough for now."
- **Do not add unrequested features.** No extra validation, behavior, or "improvements" that weren't asked for.
- **Fix bugs at the source.** When you find a bug, fix it. Do not change inputs/parameters to avoid triggering it.
- **Ask when uncertain.** If you don't know how to do something, ask. Do not guess or assume.
- **Wait for confirmation.** If the user asks "right?" or any confirming question, answer and wait before proceeding.
- **No dead code.** Do not keep commented-out code or unused imports.
- **No narrating comments.** Comments should explain *why*, not *what*.

### PHP Style

- Use WordPress coding standards
- Prefix functions/classes with `Clipisode_` or `clipisode_`
- Use `sanitize_*()` on input, `esc_*()` on output
- All REST endpoints require capability checks or nonce verification

### TypeScript/React Style

- Functional components with hooks
- Use `@wordpress/api-fetch` for REST calls
- Use `@wordpress/components` for UI consistency with WP admin

### Swift Style

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

- **It's a menu bar app** — no dock icon. Look for the film icon in the menu bar.
- **Debug mode disables sandbox** — Release builds are sandboxed with network entitlements.
- **Files are auto-cleaned** — sources and jobs older than 30 days are deleted automatically.
- **Ports are hardcoded** — WebSocket on 63481, HTTP on 63482. Don't change these without updating the plugin.

**Both:**

- **The WebSocket protocol is documented** — see `docs/transcode.md` before changing message formats.
- **Video keys determine composition order** — `intro` → `main` or `main_1` → `main_2` etc. (alphabetical sort).

## Testing

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
| Admin pages | `plugin/clipisode/src/pages/` |
| REST endpoints | `plugin/clipisode/includes/class-rest-api.php` |
| Block definitions | `plugin/clipisode/src/blocks/`, `src/element/`, `src/flow/` |
| Types | `plugin/clipisode/src/types.ts` |
| Database schema | `plugin/clipisode/includes/class-database.php` |

### macOS App

| What | Where |
|------|-------|
| App state/job orchestration | `Clipisode/AppState.swift` |
| WebSocket messages | `Clipisode/Models/Messages.swift` |
| Video composition | `Clipisode/Transcoding/CompositionExporter.swift` |
| Theme rendering | `Clipisode/Transcoding/ThemeCompositor.swift` |
| Face effects | `Clipisode/Transcoding/OverlayRenderer.swift`, `FaceDetector.swift` |

## Documentation

- `docs/transcode.md` — WebSocket protocol between plugin and macOS app
- `docs/media.md` — Media storage schema
- `docs/output.md` — Output/contents data model
- `docs/prd.md` — Product requirements
- `docs/mux.md` — Mux integration notes

## Directory-Specific Notes

Additional context lives in:
- `plugin/AGENTS.md` — Plugin-specific rules and local MySQL access
