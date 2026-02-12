# Clipisode macOS App

Menu bar application that provides WebSocket and HTTP servers for the browser UI.

## Requirements

- macOS
- Static FFmpeg binary in `Clipisode/Binaries/ffmpeg`
- Xcode for building

## Servers

- WebSocket: port 63481 (job control and status)
- HTTP: port 63482 (serves merged videos)

## File Structure

- Sources: `~/Library/Application Support/Clipisode/sources/` (deduplicated cache)
- Jobs: `~/Library/Application Support/Clipisode/jobs/<job_id>/`
- Cleanup: Automatically deletes sources and jobs older than 30 days on launch

## FFmpeg Binary

Must be truly static with no dynamic library dependencies. The sandboxed app cannot access Homebrew or system libraries.

Verify with:

```bash
otool -L Clipisode/Binaries/ffmpeg
```

Should only show system dylibs like `/usr/lib/libSystem.B.dylib`.
