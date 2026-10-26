#!/bin/sh
# Launch QuoteFlap fullscreen on a TV/display: starts the server if needed,
# then opens the browser in kiosk mode (true fullscreen on open, no UI).
# Linux/macOS: ./start-tv.sh
cd "$(dirname "$0")"

curl -sf http://localhost:8000/health >/dev/null 2>&1 || {
    python3 server.py 8000 &
    sleep 8   # server takes a few seconds to load its quote chunk
}

for browser in chromium chromium-browser google-chrome; do
    if command -v "$browser" >/dev/null 2>&1; then
        exec "$browser" --kiosk http://localhost:8000
    fi
done
xdg-open http://localhost:8000
