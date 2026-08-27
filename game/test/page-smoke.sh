#!/usr/bin/env bash
# Serves game/ , opens it in headless Chromium, and hands it to page-smoke.mjs.
#
# Set CHROME to point at a browser if the ones below are not present.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GAME="$(dirname "$HERE")"
PORT="${PAGE_PORT:-8899}"
CDP_PORT="${CDP_PORT:-9222}"

find_chrome() {
  if [ -n "${CHROME:-}" ]; then echo "$CHROME"; return; fi
  for c in google-chrome-stable google-chrome chromium chromium-browser; do
    if command -v "$c" >/dev/null 2>&1; then command -v "$c"; return; fi
  done
  # Playwright's download, where an environment provides one
  for c in "${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}"/chromium*/chrome-linux/chrome; do
    if [ -x "$c" ]; then echo "$c"; return; fi
  done
  echo "no chromium found; set CHROME=/path/to/chrome" >&2
  exit 1
}

CHROME_BIN="$(find_chrome)"
echo "browser: $CHROME_BIN"

PROFILE="$(mktemp -d)"
python3 -m http.server "$PORT" --directory "$GAME" >/dev/null 2>&1 &
SERVER=$!
"$CHROME_BIN" --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage \
  --user-data-dir="$PROFILE" --remote-debugging-port="$CDP_PORT" \
  "http://127.0.0.1:$PORT/index.html" >"$PROFILE/chrome.log" 2>&1 &
BROWSER=$!

cleanup() {
  kill "$BROWSER" "$SERVER" 2>/dev/null || true
  # Wait for the browser to let go of its profile before removing it.
  wait "$BROWSER" 2>/dev/null || true
  rm -rf "$PROFILE"
}
trap cleanup EXIT

# Wait for devtools rather than sleeping a fixed amount.
for _ in $(seq 1 60); do
  if curl -sf --noproxy '*' "http://127.0.0.1:$CDP_PORT/json/version" >/dev/null 2>&1; then break; fi
  sleep 0.5
done
curl -sf --noproxy '*' "http://127.0.0.1:$CDP_PORT/json/version" >/dev/null \
  || { echo "devtools never came up:"; cat "$PROFILE/chrome.log"; exit 1; }

NO_PROXY='*' no_proxy='*' CDP_PORT="$CDP_PORT" node "$HERE/page-smoke.mjs"
