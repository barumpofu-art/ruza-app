#!/usr/bin/env bash
# Installs the APK on a running emulator, opens it, and hands the WebView to
# test/apk-smoke.mjs over devtools. Run from the repository root by CI.
set -euo pipefail

APK=${1:?usage: apk-smoke.sh <path-to-apk>}

adb wait-for-device
adb logcat -c || true
adb install -r "$APK"
# Start from nothing. Clearing from inside the page cannot work: the app writes
# its save back when the page is hidden, which a reload triggers.
adb shell pm clear app.kalahari.manager
adb shell am start -W -n app.kalahari.manager/.MainActivity

# The devtools socket only appears once the WebView is up.
socket=""
for _ in $(seq 1 40); do
  socket=$(adb shell cat /proc/net/unix | tr -d '\r' | grep -o 'webview_devtools_remote_[0-9]*' | head -1 || true)
  [ -n "$socket" ] && break
  sleep 2
done

if [ -z "$socket" ]; then
  echo "No WebView devtools socket appeared — the app never got that far."
  adb logcat -d | tail -120
  exit 1
fi

echo "devtools socket: $socket"
adb forward tcp:9222 "localabstract:$socket"
curl -sf --retry 15 --retry-delay 1 http://127.0.0.1:9222/json/version

set +e
node football-manager/test/apk-smoke.mjs 2>&1 | tee apk-smoke-output.txt
status=${PIPESTATUS[0]}
set -e

adb logcat -d > apk-logcat.txt || true

if [ "$status" -ne 0 ]; then
  adb exec-out screencap -p > apk-failure.png || true
  echo "--- logcat, app and WebView only ---"
  grep -aE 'kalahari|chromium|AndroidRuntime|WebView' apk-logcat.txt | tail -40 || true
  echo "--- what the smoke test said ---"
  tail -40 apk-smoke-output.txt
  exit "$status"
fi

# A clean run must also be a crash-free one.
adb logcat -d > apk-logcat.txt
if grep -q "FATAL EXCEPTION" apk-logcat.txt; then
  echo "The app crashed:"
  grep -A 25 "FATAL EXCEPTION" apk-logcat.txt
  exit 1
fi
echo "no fatal exceptions in logcat"
