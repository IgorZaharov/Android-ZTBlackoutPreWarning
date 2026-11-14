#!/usr/bin/env bash
# Screenshots of the M3 design gallery (ios/App/UI/DesignGallery.swift) on one booted simulator.
# Usage: gallery_screenshots.sh <simulator-udid> <output-dir>
# Every page x glass recipe x palette (02:00 = darkest night, 14:30 = brightest day), then the
# components page once more with the system Reduce Transparency switch on (best effort: the simulator
# may need a respring to pick it up; the forced "solid" recipe above shows the same look either way).
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
  sleep 4
  if xcrun simctl io "$UDID" screenshot "$OUT/$name.png" >/dev/null; then echo "  $name.png"; else echo "screenshot failed: $name"; FAILED=$((FAILED + 1)); fi
}

for page in components drum rows; do
  for time in 02:00 14:30; do
    for mode in automatic fallback solid; do
      shot "${page}-${mode}-${time/:/}" -ZTGallery "$page" -ZTGlassMode "$mode" -ZTGalleryTime "$time"
    done
  done
done

xcrun simctl spawn "$UDID" defaults write com.apple.Accessibility ReduceTransparencyEnabled -bool YES || true
shot "components-system-reduce-transparency-1430" -ZTGallery components -ZTGlassMode automatic -ZTGalleryTime 14:30
xcrun simctl spawn "$UDID" defaults write com.apple.Accessibility ReduceTransparencyEnabled -bool NO || true

xcrun simctl terminate "$UDID" "$BUNDLE" >/dev/null 2>&1 || true
echo "$(ls "$OUT" | wc -l | tr -d ' ') gallery screenshots in $OUT"
if [ "$FAILED" -gt 0 ]; then echo "::error::$FAILED gallery screenshots failed"; exit 1; fi
