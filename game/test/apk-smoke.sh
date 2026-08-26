#!/usr/bin/env bash
# Installs the APK on a running emulator, opens it, and hands the WebView to
# test/apk-smoke.mjs over devtools. Run from the repository root by CI.
#
# Every adb call is bounded. adb blocks forever printing "- waiting for device -"
# when the emulator has gone away, and on the failure path that turns a test
# failure into a job that burns its whole timeout with no diagnostics.
set -euo pipefail

APK=${1:?usage: apk-smoke.sh <path-to-apk>}
PKG=app.kgosi.cadre
# The origin the game is served from inside the shell. Overridable so this
# script can be rehearsed end to end against desktop Chromium.
ORIGIN=${PAGE_ORIGIN:-appassets.androidplatform.net}

ADB_BIN=$(command -v adb)
adb() { timeout 120 "$ADB_BIN" "$@"; }

adb wait-for-device
adb logcat -c || true

# Stream logcat to a file for the whole run. Collecting it afterwards is no use:
# when the emulator dies the post-mortem adb call returns nothing, which is
# exactly how three failures in a row arrived with an empty log.
timeout 900 "$ADB_BIN" logcat -v time > apk-logcat.txt 2>&1 &
LOGCAT_PID=$!
trap 'kill "$LOGCAT_PID" 2>/dev/null || true' EXIT

adb install -r "$APK"
# Start from nothing. The game writes its save on every action, so clearing
# storage from inside the page cannot give a clean slate.
#
# pm clear returns Success long before the framework has finished with it —
# Icing and Blockstore were still tearing this package down eighteen seconds
# later on one cold-booted run — and the app can be killed as part of that
# tail. Give the clear a moment rather than launching into the middle of it.
adb shell pm clear "$PKG"
sleep 5
adb shell am start -W -n "$PKG/.MainActivity"

# The devtools socket is named after the owning process, and more than one
# WebView process can be alive: Android starts com.google.android.webview in
# the background for its own broadcasts. Grepping for any socket can forward to
# that one instead, which answers /json/version perfectly well and then offers
# no page on our origin. Resolve it from our own pid.
#
# A socket is still not a page. The WebView publishes its socket as soon as the
# process initialises, but the page can take far longer to arrive on a cold-
# booted emulator busy with Play Services' first-run work — and if the app is
# killed and restarted in the meantime it comes back under a new pid behind a
# new socket, leaving a forward pinned to the old one pointing at nothing.
# So wait for a page on our own origin, re-resolving and re-pointing the
# forward whenever the pid changes.
socket=""
page=""
for _ in $(seq 1 60); do
  pid=$(adb shell pidof "$PKG" | tr -d '\r' | awk '{print $1}')
  if [ -n "$pid" ] && adb shell cat /proc/net/unix | tr -d '\r' | grep -q "webview_devtools_remote_${pid}\b"; then
    if [ "webview_devtools_remote_${pid}" != "$socket" ]; then
      socket="webview_devtools_remote_${pid}"
      adb forward --remove tcp:9222 >/dev/null 2>&1 || true
      adb forward tcp:9222 "localabstract:$socket" >/dev/null
      echo "devtools socket: $socket"
    fi
    page=$(curl -sf --max-time 5 http://127.0.0.1:9222/json/list 2>/dev/null \
      | grep -cF "$ORIGIN" || true)
    if [ "${page:-0}" -gt 0 ]; then break; fi
  fi
  sleep 2
done

if [ -z "$socket" ] || [ "${page:-0}" -eq 0 ]; then
  echo "The app never put a page on its own origin in front of devtools."
  echo "socket: ${socket:-none}"
  echo "sockets currently present:"
  adb shell cat /proc/net/unix | tr -d '\r' | grep -o 'webview_devtools_remote_[0-9]*' || echo "  (none)"
  echo "what devtools is offering:"
  curl -sf --max-time 5 http://127.0.0.1:9222/json/list || echo "  (nothing)"
  exit 1
fi

curl -sf --retry 15 --retry-delay 1 http://127.0.0.1:9222/json/version

# A hung CDP call must not eat the job's whole budget.
set +e
timeout 600 node game/test/apk-smoke.mjs 2>&1 | tee apk-smoke-output.txt
status=${PIPESTATUS[0]}
set -e
if [ "$status" -eq 124 ]; then echo "the smoke test itself timed out after 10 minutes"; fi

# What the device actually looks like. adb screencap works where the WebView's
# Page.captureScreenshot does not — when the device is still alive to answer.
adb exec-out screencap -p > apk-final.png || true

# Stop the stream and keep what it captured before things went wrong.
kill "$LOGCAT_PID" 2>/dev/null || true
sleep 1
echo "logcat captured: $(wc -l < apk-logcat.txt 2>/dev/null || echo 0) lines"

if [ "$status" -ne 0 ]; then
  cp -f apk-final.png apk-failure.png 2>/dev/null || true
  echo "--- how the run ended, from the streamed log ---"
  tail -60 apk-logcat.txt || true
  echo "--- anything that looks like a crash ---"
  grep -aiE 'FATAL|AndroidRuntime|tombstone|native crash|signal |lowmemorykiller|Out of memory|ANR in|died|kgosi|cadre' \
    apk-logcat.txt | tail -40 || true
  echo "--- what the smoke test said ---"
  tail -40 apk-smoke-output.txt
  exit "$status"
fi

# A clean run must also be a crash-free one.
if grep -q "FATAL EXCEPTION" apk-logcat.txt; then
  echo "The app crashed:"
  grep -A 25 "FATAL EXCEPTION" apk-logcat.txt
  exit 1
fi
echo "no fatal exceptions in logcat"
