# Clipisode Web UI

Browser-based interface for the Clipisode macOS app.

## Requirements

- macOS app running (provides WebSocket server on port 63481 and HTTP server on 63482)
- Modern web browser

## How to Serve

Must be served via HTTP server (not file://):

```bash
python3 -m http.server 8000
```

## Settings

- WebSocket connects to `ws://localhost:63481`
- HTTP resources served from `http://localhost:63482`
- Job state persisted in browser localStorage

## Usage

1. Add video segments with URLs, start/end times (optional)
2. Click "Build Video"
3. macOS app downloads, trims, transcodes, and concatenates
4. Video plays in browser when complete
