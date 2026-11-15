#!/usr/bin/env bash
# App Store screenshots (docs/ios/IOS_PORT_PLAN.md, milestone M7) on one booted simulator, Ukrainian and English.
# Usage: appstore_screenshots.sh <simulator-udid> <output-dir>
# The simulator decides the size: an iPhone 17 Pro Max (or 16 Pro Max) gives the 6.9" set (1320x2868),
# an iPhone 14 Plus (or 13 Pro Max) the 6.5" set (1284x2778). The status bar is set to 9:41 by the caller.
# Uses the same CI-only launch arguments as gallery_screenshots.sh (ios/App/AppModel.swift); the data is live.
set -uo pipefail

UDID="$1"
OUT="$2"
BUNDLE=ua.blackout.prewarning
mkdir -p "$OUT"
FAILED=0

shot() {
  local name="$1"; shift
  xcrun simctl terminate "$UDID" "$BUNDLE" >/dev/null 2>&1 || true
  if ! xcrun simctl launch "$UDID" "$BUNDLE" "$@" >/dev/null; then
    echo "launch failed: $name"; FAILED=$((FAILED + 1)); return 1
  fi
  sleep "${WAIT:-6}"
  if xcrun simctl io "$UDID" screenshot "$OUT/$name.png" >/dev/null; then echo "  $name.png"; else echo "screenshot failed: $name"; FAILED=$((FAILED + 1)); fi
}

# The first shot seeds two queue-only addresses into an empty store; later shots keep them.
for lang in uk en; do
  WAIT=15 shot "$lang-01-main" -ZTLang "$lang" -ZTSeedQueues 5.2,3.1 -ZTPage 0
  WAIT=10 shot "$lang-02-day" -ZTLang "$lang" -ZTPage 0 -ZTScroll main-status
  WAIT=10 shot "$lang-03-addresses" -ZTLang "$lang" -ZTPage 1
  WAIT=8 shot "$lang-04-alerts" -ZTLang "$lang" -ZTPage 1 -ZTScroll settings-alerts
  WAIT=12 shot "$lang-05-lookup" -ZTLang "$lang" -ZTLookup 1
  WAIT=18 shot "$lang-06-streets" -ZTLang "$lang" -ZTLookup 1 -ZTPicker street
done

xcrun simctl terminate "$UDID" "$BUNDLE" >/dev/null 2>&1 || true

# App Store Connect accepts only exact sizes; print what this simulator produced.
for f in "$OUT"/*.png; do
  [ -e "$f" ] || continue
  w=$(sips -g pixelWidth "$f" | awk '/pixelWidth/ {print $2}')
  h=$(sips -g pixelHeight "$f" | awk '/pixelHeight/ {print $2}')
  echo "$(basename "$f") ${w}x${h}"
done
echo "$(ls "$OUT" | wc -l | tr -d ' ') App Store screenshots in $OUT"
if [ "$FAILED" -gt 0 ]; then echo "::error::$FAILED App Store screenshots failed"; exit 1; fi
