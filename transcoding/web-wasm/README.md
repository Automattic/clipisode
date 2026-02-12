# Clipisode WASM

Browser-only video editor using FFmpeg.wasm. No macOS app required.

## Requirements

- Modern web browser with WASM support
- Must be served via HTTP server (not file://)

## How to Serve

Use the included Python server with required CORS headers:

```bash
python3 server.py
```

Then open `http://localhost:9001` in your browser.

## Settings

- Resolution: 1280x720 (720p)
- Codec: H.264 (libx264, ultrafast preset, CRF 28)
- Frame rate: 30fps
- Audio: AAC 96kbps, 44.1kHz stereo
- FFmpeg.wasm version: 0.11.6
- Core version: 0.11.0

## Usage

1. Add video segments with URLs, start/end times (optional)
2. Click "Build Video"
3. Videos processed entirely in browser (no server required)
4. Download output when complete

## Performance

Encoding is 10-50x slower than native FFmpeg. Expect 30-60 seconds per minute of source video.
