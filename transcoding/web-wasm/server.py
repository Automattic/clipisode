#!/usr/bin/env python3
"""
Simple HTTP server with COOP/COEP headers for SharedArrayBuffer support.
Required for multi-threaded ffmpeg.wasm.

Usage: python server.py
Then open: http://localhost:9001
"""

from http.server import HTTPServer, SimpleHTTPRequestHandler
import os

class COEPHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Required for SharedArrayBuffer (multi-threaded WASM)
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        # Allow resources to be loaded under COEP
        self.send_header('Cross-Origin-Resource-Policy', 'cross-origin')
        # Allow fetch from any origin (for video files)
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    port = 9001
    print(f'🚀 Server running at http://localhost:{port}')
    print('   Press Ctrl+C to stop')
    HTTPServer(('localhost', port), COEPHandler).serve_forever()
