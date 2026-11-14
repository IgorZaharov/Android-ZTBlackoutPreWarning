#!/usr/bin/env bash
# Screenshots of the M3 design gallery (ios/App/UI/DesignGallery.swift) and of the M4 screens on one
# booted simulator. Usage: gallery_screenshots.sh <simulator-udid> <output-dir>
# Every page x glass recipe x palette (02:00 = darkest night, 14:30 = brightest day). The "solid" recipe
# is what Reduce Transparency shows; the simulator ignores `defaults write com.apple.Accessibility
# ReduceTransparencyEnabled` without a respring (tried in CI run 43617814350), so it is forced instead.
set -uo pipefail

UDID="$1"
OUT="$2"
BUNDLE=ua.blackout.prewarning
mkdir -p "$OUT"
FAILED=0

# shot <name> <launch args...>: waits WAIT seconds (default 4) before the screenshot
shot() {
  local name="$1"; shift
  xcrun simctl terminate "$UDID" "$BUNDLE" >/dev/null 2>&1 || true
  if ! xcrun simctl launch "$UDID" "$BUNDLE" "$@" >/dev/null; then
    echo "launch failed: $name"; FAILED=$((FAILED + 1)); return 1
  fi
  sleep "${WAIT:-4}"
  if xcrun simctl io "$UDID" screenshot "$OUT/$name.png" >/dev/null; then echo "  $name.png"; else echo "screenshot failed: $name"; FAILED=$((FAILED + 1)); fi
}

for page in components drum rows; do
  for time in 02:00 14:30; do
    for mode in automatic fallback solid; do
      shot "${page}-${mode}-${time/:/}" -ZTGallery "$page" -ZTGlassMode "$mode" -ZTGalleryTime "$time"
    done
  done
done

# M4 screens with live data (docs/ios/IOS_PORT_PLAN.md: compared side by side with Android 1.4.0).
# The order matters: the seed below writes two queue-only addresses that the later shots keep.
# -ZTLang writes the language setting, -ZTSeedQueues adds addresses to an empty store,
# -ZTPage opens a page, -ZTLookup opens the "?" address lookup (ios/App/AppModel.swift).
WAIT=6 shot screen-first-launch -ZTLang uk
WAIT=12 shot screen-lookup -ZTLang uk -ZTLookup 1
WAIT=15 shot screen-main -ZTLang uk -ZTSeedQueues 5.2,3.1 -ZTPage 0
WAIT=10 shot screen-settings -ZTLang uk -ZTPage 1
WAIT=8 shot screen-about -ZTLang uk -ZTPage 2
# lower parts of the pages, the dialogs and the searchable street list:
# -ZTScroll <card id> scrolls the page in front, -ZTDialog opens a Settings dialog,
# -ZTPicker street opens the street list of the "?" lookup.
WAIT=10 shot screen-main-status -ZTLang uk -ZTPage 0 -ZTScroll main-status
WAIT=8 shot screen-settings-alerts -ZTLang uk -ZTPage 1 -ZTScroll settings-alerts
WAIT=8 shot screen-settings-actions -ZTLang uk -ZTPage 1 -ZTScroll settings-actions
WAIT=7 shot screen-dialog-remove -ZTLang uk -ZTPage 1 -ZTDialog remove
WAIT=7 shot screen-dialog-rename -ZTLang uk -ZTPage 1 -ZTDialog rename
WAIT=7 shot screen-dialog-reset -ZTLang uk -ZTPage 1 -ZTDialog reset
WAIT=18 shot screen-picker-streets -ZTLang uk -ZTLookup 1 -ZTPicker street
WAIT=10 shot screen-main-en -ZTLang en -ZTPage 0

xcrun simctl terminate "$UDID" "$BUNDLE" >/dev/null 2>&1 || true
echo "$(ls "$OUT" | wc -l | tr -d ' ') gallery screenshots in $OUT"
if [ "$FAILED" -gt 0 ]; then echo "::error::$FAILED gallery screenshots failed"; exit 1; fi
