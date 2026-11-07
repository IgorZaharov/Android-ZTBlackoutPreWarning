# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Світло в Житомирі" — Android app that scrapes ZTOE (Zhytomyroblenergo) power-outage schedules (`https://www.ztoe.com.ua/unhooking-search.php`, Windows-1251 HTML, 48 half-hour slots per queue, 12 queues `1.1`–`6.2`) and shows countdowns, a 24h timeline, Glance widgets, and exact pre-warning alarms. `HANDOVER.md` is the detailed architecture reference; read the relevant section before non-trivial changes.

The repo holds **two implementations that must stay in logic/UI/text parity**:
- `android/` — native Kotlin app (Compose M3, Glance widgets, WorkManager, AlarmManager, Jsoup). Package `ua.blackout.prewarning`.
- `src/` — React 19 + TS + Vite web simulator/workbench mirroring the Android logic (`src/services/ztoeParser.ts` mirrors `ZtoeParser.kt` + `ScheduleRepository.kt`; `MainView.tsx`/`WidgetSimulator.tsx` mirror `MainScreen.kt`/`TimelineBar.kt`/`BlackoutGlanceWidget.kt`; `i18n.ts` mirrors `AppStrings.kt`). When changing behavior on one side, change the other.

## Commands

Web / Node (root):
```bash
npm install
npm test          # tsx tests/unit.test.ts — invariants + changelog enforcement
npm run lint      # tsc --noEmit
npm run dev       # Vite on :3000 (/proxy-ztoe proxies to ztoe.com.ua)
npm run build
```

Android (JDK 17, SDK 35, Gradle 8.11.1; run from `android/`):
```bash
gradle testDebugUnitTest
gradle testDebugUnitTest --tests "ua.blackout.prewarning.ZtoeParserTest"
gradle assembleDebug
```
CI (`.github/workflows/build-apk.yml`) runs `npm test`, then Gradle tests, debug/release APK and AAB; pushing a `v*` tag publishes a GitHub Release and rewrites the version badge in `README.md`.

## Architecture (Android)

Data flow: `ZtoeParser` (validates URL against `valid-urls.json`, fetches with ETag/gzip, parses slots) → `ScheduleRepository` (persists today/tomorrow slots in SharedPreferences, merges contiguous POWER_OFF slots into `DetailedInterval`s, computes countdown incl. cross-midnight and tomorrow's first outage) → consumers: Compose UI (`ui/screens`, 1s lifecycle ticker), `AlarmScheduler`/`AlarmReceiver` (RTC_WAKEUP, one alert per contiguous block, deduped by `AlertRegistry`), and `BlackoutGlanceWidget`. `ScheduleSyncWorker` (WorkManager) refreshes periodically; `BootCompletedReceiver` reschedules after reboot. UI and widgets observe SharedPreferences listeners so widget toggles update the open app.

## Invariants enforced by tests (do not change unless the owner asks)

Asserted in `tests/unit.test.ts` and `android/app/src/test/.../ZtoeParserTest.kt`:
- App name `"Світло в Житомирі"` (strings.xml, AppStrings.kt, metadata.json, index.html, i18n.ts).
- Defaults: `advanceNoticeMinutes = 15`, `refreshIntervalMinutes = 30`.
- Queue help dialog 4-step text and `"Зрозуміло"` button, character-for-character.
- Widget labels `"СВІТЛО Є"` / `"СВІТЛА НЕМАЄ"` (never `"ЗНЕСТРУМЛЕНО"`); widget countdowns without seconds (`HHг. MMхв.`).
- Facebook emergency link `https://www.facebook.com/ztoe.com.ua` on the main screen; donations block reads `/donations.json`.
- Main timeline and big widget must produce identical 48 half-hour states.
- **Changelog enforcement:** any modified file under `ui/`, `components/`, or `widget/` must be mentioned by filename in `CHANGELOG.md`, or `npm test` fails.

## Synced / generated files

- `valid-urls.json` and `donations.json` at root are canonical; copies live in `public/` and `android/app/src/main/assets/`. Keep all three in sync.
- `src/data/androidProjectFiles.ts` embeds Android sources for the web code explorer. `scripts/generate_android_project.cjs` **overwrites `android/` from it** — don't run it unless that file is up to date.
- After changing `android/`, rebuild the downloadable archive: `python3 -m zipfile -c public/Android-ZTBlackoutPreWarning.zip android`.
- `android/app/keystore/debug.keystore` is intentionally committed (stable signature for in-place upgrades); `versionCode = (GITHUB_RUN_NUMBER ?: 5) + 100`.

## Releasing vX.Y.Z

Bump the version in all of: `android/app/build.gradle.kts` (`versionName`), `package.json`, `vite.config.ts`, `AboutScreen.kt`, `src/components/AboutView.tsx`, `CHANGELOG.md` (`## [X.Y.Z] - YYYY-MM-DD`), and the expected version in `tests/unit.test.ts`. Rebuild the zip, run `npm test`, then tag and push.
