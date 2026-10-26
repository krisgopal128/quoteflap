#!/usr/bin/env python3
"""Static server for quoteflap + /random endpoint (batches of random quotes).

Memory: loads ONE ~25MB chunk of the dataset at a time (data/chunks/) and a
background thread rotates to the next chunk every 1/2/4/12/24h (user-selectable
via the H button or POST /rotate-interval, persisted in data/rotate-hours.txt).
Cache: versioned URLs (?v=N) get long-lived immutable caching; everything else
revalidates.

Run: python tools/server.py [port]
"""
import glob
import json
import os
import random
import sys
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHUNK_DIR = os.path.join(ROOT, "data", "chunks")
INTERVAL_FILE = os.path.join(ROOT, "data", "rotate-hours.txt")
MAX_LINE, MAX_LINES, MAX_WORD = 22, 5, 22  # board grid: 22 cols x 5 rows
ALLOWED_HOURS = (1, 2, 4, 12, 24)


def _fits(text):
    return (0 < len(text) <= MAX_LINE * (MAX_LINES - 1)
            and max((len(w) for w in text.split()), default=0) <= MAX_WORD)


def load_interval():
    try:
        with open(INTERVAL_FILE, encoding="utf-8") as f:
            hours = float(f.read().strip())
            if hours in ALLOWED_HOURS:
                return hours
    except (OSError, ValueError):
        pass
    return 1.0


def load_chunk(path):
    with open(path, encoding="utf-8") as f:
        rows = json.load(f)
    return [{"text": t, "author": a} for t, a in rows if _fits(t.strip())]


class Rotator:
    """Holds the active quote chunk; rotates to the next one every interval.

    Interval is user-selectable (1/2/4/12/24h, persisted in data/) and can
    change while running — the loop re-reads the deadline as needed.
    """

    def __init__(self, paths, interval_hours):
        self.paths = paths
        self.idx = 0
        self.fitting = load_chunk(paths[0]) if paths else []
        self.interval_hours = interval_hours
        self._deadline = time.time() + interval_hours * 3600

    def set_interval(self, hours):
        self.interval_hours = hours
        self._deadline = time.time() + hours * 3600
        with open(INTERVAL_FILE, "w", encoding="utf-8") as f:
            f.write(str(hours))

    def start(self):
        if len(self.paths) < 2:
            return
        threading.Thread(target=self._loop, daemon=True).start()

    def _loop(self):
        while True:
            time.sleep(min(30, max(1, self._deadline - time.time())))
            if time.time() < self._deadline:
                continue
            nxt = (self.idx + 1) % len(self.paths)
            try:
                data = load_chunk(self.paths[nxt])  # load before swapping
                self.idx, self.fitting = nxt, data
                print("rotated to chunk %s (%d quotes)"
                      % (os.path.basename(self.paths[nxt]), len(data)),
                      flush=True)
            except OSError as e:
                print("rotation failed, keeping current chunk:", e,
                      flush=True)
            self._deadline = time.time() + self.interval_hours * 3600


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        if self.path.startswith("/random"):
            self.send_header("Cache-Control", "no-store")
        elif "?v=" in self.path:
            # Versioned assets are content-addressed by the version bump
            self.send_header("Cache-Control",
                             "public, max-age=31536000, immutable")
        else:
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Length", "2")
            self.end_headers()
            self.wfile.write(b"ok")
            return
        if self.path == "/rotate-interval":
            body = json.dumps({"hours": ROTATOR.interval_hours}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path.startswith("/random"):
            fitting = ROTATOR.fitting
            if not fitting:
                self.send_error(503, "no quotes loaded")
                return
            n = 10
            if "n=" in self.path:
                try:
                    n = max(1, min(50, int(self.path.split("n=")[1].split("&")[0])))
                except ValueError:
                    pass
            body = json.dumps(random.sample(fitting, min(n, len(fitting))),
                              ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def do_POST(self):
        if self.path == "/rotate-interval":
            length = min(int(self.headers.get("Content-Length") or 0), 100)
            try:
                payload = json.loads(self.rfile.read(length).decode("utf-8", "replace"))
                hours = float(payload["hours"])
            except (ValueError, TypeError, KeyError):
                return self.send_error(400, "expected json like {\"hours\": 2}")
            if hours not in ALLOWED_HOURS:
                return self.send_error(400, "hours must be one of 1, 2, 4, 12, 24")
            ROTATOR.set_interval(hours)
            print("rotation interval set to %gh" % hours, flush=True)
            body = json.dumps({"hours": hours}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_error(404)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    chunk_paths = sorted(glob.glob(os.path.join(CHUNK_DIR, "quotes-*.json")))
    if not chunk_paths:
        sys.exit("no chunks in %s - run tools/merge_quotes.py first" % CHUNK_DIR)
    interval = load_interval()
    ROTATOR = Rotator(chunk_paths, interval)
    ROTATOR.start()
    print("serving quoteflap on http://localhost:%d "
          "(chunk %d/%d, %d displayable quotes, rotating every %gh)"
          % (port, ROTATOR.idx + 1, len(chunk_paths),
             len(ROTATOR.fitting), interval), flush=True)
    ThreadingHTTPServer(("", port), Handler).serve_forever()
