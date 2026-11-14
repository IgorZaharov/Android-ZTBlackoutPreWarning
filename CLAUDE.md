# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Світло в Житомирі" — Android app that scrapes ZTOE (Zhytomyroblenergo) power-outage schedules (`https://www.ztoe.com.ua/unhooking-search.php`, Windows-1251 HTML, 48 half-hour slots per queue, 12 queues `1.1`–`6.2`) and shows countdowns, a 24h timeline, Glance widgets, and exact pre-warning alarms. `HANDOVER.md` is the detailed architecture reference; read the relevant section before non-trivial changes.

The repo holds **three implementations that must stay in logic/UI/text parity**:
- `android/` — native Kotlin app (Compose M3, Glance widgets, WorkManager, AlarmManager, Jsoup). Package `ua.blackout.prewarning`.
- `src/` — React 19 + TS + Vite web simulator/workbench mirroring the Android logic (`src/services/ztoeParser.ts` mirrors `ZtoeParser.kt` + `ScheduleRepository.kt`; `MainView.tsx`/`WidgetSimulator.tsx` mirror `MainScreen.kt`/`TimelineBar.kt`/`BlackoutGlanceWidget.kt`; `i18n.ts` mirrors `AppStrings.kt`). When changing behavior on one side, change the other.
- `ios/` — native SwiftUI app + WidgetKit extension (iOS 17+, built with Xcode 26, XcodeGen `ios/project.yml`), being ported to 1.4.0 milestone by milestone: `docs/ios/IOS_PORT_PLAN.md` is the plan (owner decisions, Liquid Glass with fallback, App Review items, milestones). No roulette on iOS. Pure Swift core in `ios/Shared/Core/` mirrors `core/*.kt`.

## Commands

Web / Node (root):
```bash
npm install
npm test          # tsx tests/unit.test.ts (invariants + changelog enforcement) and tests/spec-vectors.test.ts (golden vectors + src/core purity gate)
npm run lint      # tsc --noEmit
npm run dev       # Vite on :3000 (/proxy-ztoe proxies to ztoe.com.ua)
npm run build
```

Android (JDK 17, compile/target SDK 36, Gradle 8.11.1; run from `android/`):
```bash
gradle testDebugUnitTest
gradle testDebugUnitTest --tests "ua.blackout.prewarning.ZtoeParserTest"
gradle assembleDebug
```
iOS (no Mac needed; CI is the compiler): `.github/workflows/build-ios.yml` runs on `feat/ios-**` / `ios/**` branches, PRs touching `ios/` or `spec/`, and `ios-v*` tags (TestFlight upload). Locally on a Mac: `cd ios && xcodegen generate && xcodebuild test -project SvitloZhytomyr.xcodeproj -scheme ZTPreBlackout -destination 'platform=iOS Simulator,name=iPhone 17'`.

CI (`.github/workflows/build-apk.yml`) runs `npm test`, then Gradle tests, debug/release APK and AAB. The "Publish GitHub Release" step runs on a `v*` tag, **and on every push to `main`/`master`** (and `workflow_dispatch`): never push to `main` casually, work on a branch and open a PR (PR runs build and test but skip the publish step). Release signing falls back to the debug key when the upload-keystore secrets are missing.

## Architecture (Android)

Since 1.4.0 there is one source of truth for "what is off and when": the pure package `core/` (`java.time` only, no Android imports; mirrored in `src/core/*.ts`):

- `OutageEngine` works on a two-day window (yesterday's tail, today, tomorrow) of absolute Kyiv `LocalDateTime`s. Outage kinds PLANNED (ztoe table), REPAIR (PowerOn planned works, folded into Planned) and EMERGENCY (PowerOn). Overlapping or touching outages merge into spans, so a block over midnight is ONE span with its full duration and ONE alert. Finished spans never alert; an emergency still listed after its estimated end stays active for a 60 minute grace, then goes stale.
- `EmergencyLedger` keeps a per-address record of seen emergencies (PowerOn has no history); a failed fetch (`EmergencyFetch.Unavailable`) is never "no outage". Events START / ETA_CHANGED / END feed notifications.
- `StreetKey` / `HouseKey` merge duplicate streets and compare houses (`spec/ADDRESS_KEY.md`).
- `SiteState` (AVAILABLE_WITH_TABLE / AVAILABLE_NO_TABLE / SITE_UNREACHABLE / NO_INTERNET) is shown on the main screen; a failure never clears the cached schedule.

Data flow: `ZtoeParser` (validates URL against `valid-urls.json`, fetches with ETag/gzip, parses slots) and `PowerOnClient` (`data/poweron`, per-address JSON queries) → `OutageRepository` (`refresh()` does the network, `snapshot()` is local only; state in `OutageStateStore` and `ScheduleRepository`) → consumers: Compose UI (`ui/screens`), `AlarmScheduler`/`AlarmReceiver` (one alert per span from `OutageEngine.planAlerts`, today + tomorrow, exact alarms through `ExactAlarmGate`, request codes from `AlarmCodes`), and `BlackoutGlanceWidget`. `ScheduleSyncWorker` (WorkManager) refreshes periodically; `BootCompletedReceiver` reschedules after reboot.

## Spec and parity

`spec/` is the contract between Android, the web simulator and the iOS port. `spec/vectors/*.json` are golden cases run by `SpecVectorsTest.kt` and `tests/spec-vectors.test.ts` and by the iOS XCTest target, which reads `spec/vectors` directly. Change behaviour by editing the spec and a vector first, then both implementations. The iOS app lives in `ios/` (moved from `IgorZaharov/iOS-ZTPreBlackoutNotification`, to be archived); `docs/ios/IOS_HANDOVER_v1.4.0.md` has the file mapping and corrected ids, `docs/ios/IOS_PORT_PLAN.md` the plan. PowerOn quirks (timestamps are Kyiv wall-clock labelled `+00:00`; only dotted filters like `street.id[]` work; `pagination=false`) are in `spec/POWERON_API.md`.

## Invariants enforced by tests (do not change unless the owner asks)

Asserted in `tests/unit.test.ts` and `android/app/src/test/.../ZtoeParserTest.kt`:
- App name `"Світло в Житомирі"` (strings.xml, AppStrings.kt, metadata.json, index.html, i18n.ts).
- Defaults: `advanceNoticeMinutes = 15`, `refreshIntervalMinutes = 30`.
- Queue help dialog 4-step text and `"Зрозуміло"` button, character-for-character.
- Widget labels `"СВІТЛО Є"` / `"СВІТЛА НЕМАЄ"` (never `"ЗНЕСТРУМЛЕНО"`); widget countdowns without seconds (`HHг. MMхв.`).
- Facebook emergency link `https://www.facebook.com/ztoe.com.ua` on the main screen; donations block reads `/donations.json`.
- Main timeline and big widget must produce identical 48 half-hour states.
- **Changelog enforcement:** any modified file under `ui/`, `components/`, or `widget/` (and `.swift` under `ios/App/UI/` or `ios/Widget/`) must be mentioned by filename in `CHANGELOG.md`, or `npm test` fails.

## Synced / generated files

- `valid-urls.json` and `donations.json` at root are canonical; copies live in `public/`, `android/app/src/main/assets/` and `ios/Resources/`. Keep all four in sync (`npm test` checks it).
- `src/data/androidProjectFiles.ts` embeds Android sources for the web code explorer. `scripts/generate_android_project.cjs` refreshes that file from `android/` but **re-creates any file that is missing from `android/` out of its stale TS copy** — delete the entries of removed Android files from the TS data first, and never run it from a state where `android/` is incomplete.
- After changing `android/`, rebuild the downloadable archive: `python3 -m zipfile -c public/Android-ZTBlackoutPreWarning.zip android`.
- `android/app/keystore/debug.keystore` is intentionally committed (stable signature for in-place upgrades); `versionCode = (GITHUB_RUN_NUMBER ?: 300) + 300`. Do not change `.github/`, the keystore or the signing/`versionCode` blocks without the owner.

## Releasing vX.Y.Z

Bump the version in all of: `android/app/build.gradle.kts` (`versionName`), `ios/project.yml` (`MARKETING_VERSION`), `package.json`, `vite.config.ts`, `AboutScreen.kt`, `src/components/AboutView.tsx`, `CHANGELOG.md` (`## [X.Y.Z] - YYYY-MM-DD`), and the expected version in `tests/unit.test.ts`. Rebuild the zip, run `npm test`, then tag and push.
