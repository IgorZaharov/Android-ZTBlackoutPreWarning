# Світло в Житомирі (Android & Web Emulator) — Implementation Plan

## 1. Overview & Objectives

This plan addresses all 16 core requirements and the 4 additional enhancements, plus automated unit testing and CI/CD enforcement in GitHub Actions, while strictly preserving the established UI design, layout, colors, icons, and element positions.

---

## 2. Detailed Implementation Plan

### 1. Fix Vibration When Sound Toggle Is Disabled
- **Root Cause**: On Android 8.0+ (especially MIUI/HyperOS and Android 13+), notification channels with `sound = null` can suppress vibration unless `NotificationCompat.DEFAULT_VIBRATE` is set, channel IDs are versioned so stale OS channel caches are invalidated, and direct `Vibrator` invocation specifies `VibrationAttributes.USAGE_ALARM` / `AudioAttributes.USAGE_ALARM`.
- **Fix**:
  - Update `NotificationHelper.kt` with versioned channel IDs (`v2`) so cached OS channel states are refreshed.
  - When `vibrationEnabled == true` (including when `soundEnabled == false`), configure `CHANNEL_VIBE_ONLY` with `enableVibration(true)` and pattern `longArrayOf(0, 400, 200, 400)`, set `VibrationAttributes` (`USAGE_ALARM` on API 33+) / `AudioAttributes` (`USAGE_ALARM` on API 26+) on the hardware `Vibrator` waveform call, and do not clear vibration defaults with `setDefaults(0)`.
  - In `src/services/alertManager.ts`, invoke `navigator.vibrate([400, 200, 400])` whenever `settings.vibrationEnabled` is `true`, independent of `settings.soundEnabled`.

### 2. Notification Toggle Controls Sound & Vibration States
- **Fix**:
  - Add `prevSoundEnabled` and `prevVibrationEnabled` persistence in `SettingsRepository.kt`, `UserSettings` (`Models.kt` and `src/types.ts`), and `src/services/alertManager.ts`.
  - When the master notification switch is turned **OFF** (from Main Screen, Settings, or Widget): save current `soundEnabled` and `vibrationEnabled` into `prevSoundEnabled` and `prevVibrationEnabled`, set `soundEnabled = false` and `vibrationEnabled = false`, and disable both Sound and Vibration switches in Settings.
  - When the master notification switch is turned **ON**: restore `soundEnabled` and `vibrationEnabled` to `prevSoundEnabled` and `prevVibrationEnabled`, and re-enable both switches.

### 3. Fix Notification Toggle & Add Round "Refresh" Button on Both Widgets (Small 2x1 & Big 3x2/4x2)
- **Root Cause (Notification Toggle)**:
  1. Jetpack Glance skips recomposition on `update()` / `updateAll()` unless `PreferencesGlanceStateDefinition` state keys are mutated via `updateAppWidgetState`.
  2. When notifications are enabled, the white bell vector (`ic_notification.xml`, `#FFFFFFFF`) was rendered on a white circle background (`Color.White`) without a dark tint filter, making the icon invisible on active state.
- **Fix (Notification Toggle)**:
  - Use `PreferencesGlanceStateDefinition` in `BlackoutGlanceWidget.kt` and update Glance widget state (`updateAppWidgetState`) inside `ToggleAlertsActionCallback`, `WidgetToggleReceiver`, and whenever settings change in the app.
  - Apply proper `ColorFilter.tint` on the bell icon in both 2x1 and 3x2/4x2 widget layouts so the active/inactive states are clearly visible.
  - Register a `SharedPreferences.OnSharedPreferenceChangeListener` inside `BlackoutAppNavigation.kt` (cleaned up via `DisposableEffect`) so widget toggle actions immediately synchronize with the Main Screen and Settings switches.
- **Addition (Round "Refresh" Button on Both Widgets)**:
  - Add a round "Refresh" button (`ic_refresh.xml` vector icon inside a circular button matching the size, corner radius, and visual style of the existing round "Notification" toggle button) next to the Notification toggle on both the Small (2x1) and Big (3x2/4x2) widgets (in `BlackoutGlanceWidget.kt` and the web widget preview in `src/components/MainView.tsx`).
  - Implement `RefreshWidgetActionCallback : ActionCallback` (and corresponding handler in `WidgetToggleReceiver` / web emulator) that works identically to the Refresh button in Settings: reads the currently selected queue from `SettingsRepository`, fetches live schedule data from the configured website (`ZtoeParser.fetchFullSchedule(settings.cityUrl, settings.queue)`), saves the updated schedule to `ScheduleRepository`, updates `PreferencesGlanceStateDefinition` timestamp/state, and refreshes all widget contents (`updateAll(context)`).

### 4. Immediate Queue & Schedule Fetch When Widgets Are Added
- **Root Cause**: `BlackoutGlanceWidget.provideGlance` called `scheduleRepo.getTodaySlots(settings.queue)`, which returned fallback synthetic data if the app had not yet cached today's schedule.
- **Fix**:
  - In `BlackoutGlanceWidget.provideGlance` and `BlackoutWidgetReceiver.onUpdate` / `onEnabled`, check if valid live schedule data for `settings.queue` and today's date is cached; if not, immediately fetch live data from `ZtoeParser.fetchFullSchedule(settings.cityUrl, settings.queue)` on `Dispatchers.IO`, persist it to `ScheduleRepository`, and render the widget immediately without requiring manual refresh.

### 5. Fix Live Data Fetching from `ztoe.com.ua` (Today & Tomorrow Tables) & Mark as Critical
- **Root Cause**: On `https://www.ztoe.com.ua/unhooking-search.php`, the outermost `<table width="100%" height="100%" border="0">` wraps the entire page and all inner tables. In `ZtoeParser.kt`, `doc.select("table")` matched this outer layout table first because its `.html()` contained today's date string, and `row.select("td")` on its outer `<tr>` selected all `<td>` cells across the entire document.
- **Fix**:
  - Filter out outer wrapper tables (`table.select("table").isEmpty()` — only leaf tables with `rows.size >= 12` that contain queue rows `1.1`..`6.2`).
  - Match the exact date in the table header row (`DD.MM.YYYY`, e.g., `31.10.2026` for Today in `Europe/Kyiv` timezone, and `tomorrow` date `DD.MM.YYYY` for Tomorrow).
  - If a table with tomorrow's date in the header exists on the site, show the Today/Tomorrow selector on the Main Screen and display the respective timeslots and graph when selected. Otherwise, hide the Tomorrow button and center the Today button.
  - Ensure the widget always displays the graph and countdown for Today.
  - Add explicit `CRITICAL SECTION — DO NOT MODIFY UNLESS EXPLICITLY REQUESTED` comments around the parser and table selection logic in both `ZtoeParser.kt` and `src/services/ztoeParser.ts`.

### 6. Change Application Name to "Світло в Житомирі"
- **Fix**:
  - Set `app_name` and `widget_name` in `android/app/src/main/res/values/strings.xml`, `src/data/androidProjectFiles.ts`, `metadata.json`, `index.html`, and app headers/titles in `src/` and `AppStrings.kt` to `"Світло в Житомирі"`.

### 7. Revert "?" Help Popup in Settings to Numbered Instructions (Critical Text)
- **Fix**:
  - Restore the exact 4-step numbered instruction in `SettingsScreen.kt` and `AppStrings.kt` (matching `SettingsView.tsx`), with confirm button `"Зрозуміло"` / `"Got it"`:
    1. Відкрийте сторінку пошуку черги на сайті ztoe.com.ua.
    2. Оберіть свій РЕМ, населений пункт і вулицю.
    3. У таблиці знайдіть свій будинок і подивіться стовпці «Черга» і «Підчерга». Наприклад, черга 5 і підчерга 2 - це 5.2.
    4. Виберіть це значення у полі «Черга» у вікні налаштувань (кнопка ⚙).
  - Mark this help popup text as critical in code comments so it is never modified unless explicitly requested.

### 8. Default Values: Advance Warning = 15 min, Site Refresh Interval = 30 min
- **Fix**:
  - Set default `advanceNoticeMinutes = 15` and `refreshIntervalMinutes = 30` across `Models.kt`, `SettingsRepository.kt`, `BlackoutAppNavigation.kt`, `SettingsScreen.kt`, `AppStrings.kt`, `src/services/alertManager.ts`, and `src/components/SettingsView.tsx`.
  - Mark these default constants as critical so they are never modified on their own in the future.

### 9. Redraw Graph in Main Window & Widget on Refresh Button Press + Main Window Emergency Outages Link
- **Fix (Graph Redraw on Refresh)**:
  - Ensure pressing Refresh in the Main Window, Settings, or Widget fetches fresh schedule data from `ztoe.com.ua`, updates `ScheduleRepository`, updates state in `BlackoutAppNavigation` (forcing recomposition of `TimelineBar` and outage intervals), updates `lastUpdated` and `nextUpdated` timestamps, and updates all Glance widgets via `updateAppWidgetState` + `updateAll(context)`.
- **Addition (Emergency Outages Link at Bottom of Main Window)**:
  - At the bottom of the Main Window (`MainScreen.kt` and `src/components/MainView.tsx`), immediately after the Refresh block, add a block/row with the clickable link:
    `Інформація про аварійні відключення: https://www.facebook.com/ztoe.com.ua`
    Clicking the link opens `https://www.facebook.com/ztoe.com.ua` in the browser (`Intent(Intent.ACTION_VIEW, Uri.parse("https://www.facebook.com/ztoe.com.ua"))` on Android and `<a href="https://www.facebook.com/ztoe.com.ua" target="_blank" rel="noopener noreferrer">` on Web).

### 10. Repository File with Valid Site URLs (`/valid-urls.json`) & Strict URL Verification
- **Fix**:
  - Create `/valid-urls.json` in the repository root (and sync with Android assets/parser and Web) containing:
    ```json
    [
      "https://www.ztoe.com.ua/unhooking-search.php",
      "https://example.com"
    ]
    ```
  - Update URL verification in both `ZtoeParser.kt` and `src/services/ztoeParser.ts` to verify that:
    1. The normalized URL is present in `/valid-urls.json`.
    2. The site is reachable over the network.
    3. The page contains a valid schedule table for the current date with queues present.

### 11. Refresh Button & URL Verification Error Reporting + Fix Standard Android Icon on Settings Refresh
- **Fix (Error Reporting)**:
  - Differentiate verification and refresh outcomes in both Android (`ZtoeParser.kt`, `MainScreen.kt`, `SettingsScreen.kt`, `AppStrings.kt`) and Web (`ztoeParser.ts`, `SettingsView.tsx`, `MainView.tsx`):
    - Report success only if Internet is accessible, site is in `/valid-urls.json` and reached, and a schedule table with the current date and queues exists on the site.
    - If network/internet connection fails or times out: report `"Немає доступу до Інтернету"` / `"No Internet access"`.
    - If site is reached (or URL not in allowlist / missing table) and no schedule table with current date and queues is found: report `"На сайті не знайдено черг"` / `"No queues found on site"`.
- **Fix (Standard Android Icon Appearing When Refresh Button Is Pressed in Settings)**:
  - **Root Cause**: When pressing the Refresh button in Settings, `Toast.makeText(...)` is triggered. On Android 12+ (API 31+) and OEM skins (MIUI/HyperOS, OneUI, Pixel), system Toasts render the app's launcher icon next to the message. Because the project only had `mipmap-anydpi-v26/ic_launcher.xml` without legacy density PNG mipmap fallbacks (`mipmap-mdpi` through `mipmap-xxxhdpi`), without `<monochrome>` in `<adaptive-icon>`, and because `Toast` was invoked rapidly while background coroutines updated state, Android SystemUI intermittently failed to rasterize the adaptive icon in time and fell back to `android.R.drawable.sym_def_app_icon` (the default Android robot icon).
  - **Solution**:
    1. Generate and include complete rasterized PNG launcher icons (`ic_launcher.png` and `ic_launcher_round.png` featuring the white lightning bolt on the `#FF5E3A` rounded background) across all standard density buckets (`mipmap-mdpi`, `mipmap-hdpi`, `mipmap-xhdpi`, `mipmap-xxhdpi`, `mipmap-xxxhdpi`) in addition to `mipmap-anydpi-v26` (with `<monochrome android:drawable="@drawable/ic_launcher_foreground" />` added).
    2. Replace raw `Toast.makeText` calls on Refresh / Test Alert / Reset in `SettingsScreen.kt` and `MainScreen.kt` with a dedicated in-app styled notification toast/snackbar banner (and/or application-context toast with pre-cached icon) that explicitly renders the Application Icon (`ic_launcher_foreground` on `#FF5E3A` rounded square) alongside the status message, guaranteeing the standard Android robot icon never appears.

### 12. Fix Jittering When Swiping Between Application Windows
- **Root Cause**: `HorizontalPager` in `BlackoutAppNavigation.kt` was recomposing heavy child layouts and recreating `ScheduleRepository` / `LocalTime.now()` on every frame during swipe transitions without `beyondViewportPageCount` or stable keys.
- **Fix**:
  - Set `beyondViewportPageCount = 2` on `HorizontalPager` so all 3 screens (Main, Settings, About) remain composed in memory during horizontal swipes.
  - Hoist `ScheduleRepository` and derived intervals out of per-frame composition in `MainScreen.kt` and `SettingsScreen.kt`, and use `graphicsLayer` hardware layer caching to eliminate swipe jitter.

### 13. Prevent Memory Leaks
- **Fix**:
  - Use `applicationContext` inside `SettingsRepository`, `ScheduleRepository`, and `AlertRegistry` so Activity references are never retained.
  - Register and unregister `SharedPreferences.OnSharedPreferenceChangeListener` inside `DisposableEffect` in `BlackoutAppNavigation.kt`.
  - Use `goAsync()` with structured completion in `WidgetToggleReceiver` so broadcast receivers do not leak coroutines.
  - Close `AudioContext` after chime playback in `src/services/alertManager.ts`.

### 14. Both Widgets Show Correct Information When Application Is Closed
- **Fix**:
  - Ensure `BlackoutWidgetReceiver`, `BlackoutGlanceWidget`, and `ScheduleSyncWorker` operate independently of `MainActivity` using `SettingsRepository` and `ScheduleRepository` backed by `SharedPreferences` and `ZtoeParser` network fetches, updating widget countdowns, status (`СВІТЛО Є` / `СВІТЛА НЕМАЄ`), and today's 24-hour chart even when the app process is closed.

### 15. Prevent Battery Drain in Background or When Closed
- **Fix**:
  - Keep the 1-second countdown ticker strictly lifecycle-aware inside `BlackoutAppNavigation.kt` (`repeatOnLifecycle(Lifecycle.State.RESUMED)`) so the 1-second loop stops completely whenever the screen is off or the app is in the background.
  - In `BlackoutApp.kt`, configure `ScheduleSyncWorker` with `Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).setRequiresBatteryNotLow(false).build()` and `settings.refreshIntervalMinutes` (default 30 min) instead of hardcoded 15 min, using a single exact alarm per merged blackout block.

### 16. Write Changes to Changelog
- **Fix**:
  - Create and maintain `/CHANGELOG.md` documenting all changes in this release (without modifying `README.md`).

---

## 3. Automated Unit Tests & GitHub Actions CI Integration

1. **Unit Test Suite (`tests/unit.test.ts` & Android `ZtoeParserTest.kt`)**:
   - **Test A (Live/HTML ZTOE Data & Graph Parity Check)**:
     - Validates `/valid-urls.json` (containing `["https://www.ztoe.com.ua/unhooking-search.php", "https://example.com"]`), fetches/parses schedule data from `https://www.ztoe.com.ua/unhooking-search.php`, selects a random queue (`1.1`–`6.2`), determines blackout timeslots for today, and verifies that the 48 half-hour graph blocks and blackout intervals rendered on the Big Widget and Main Window are 100% identical. Fails the CI build if any discrepancy is found.
   - **Test B (UI Snapshot & Changelog Guard)**:
     - Verifies that UI icons, text, labels, design, colors, critical help popup text, default timer values (15 min / 30 min), widget buttons (Notification toggle and Refresh button), and the emergency outages link on the Main Window match the approved baseline snapshot (`tests/ui-baseline.json`), and fails the CI workflow if any UI/text modification is not documented in `CHANGELOG.md`.
2. **GitHub Actions (`.github/workflows/build-apk.yml`)**:
   - Add a dedicated CI step that runs the unit tests (`npm test` and `./gradlew testDebugUnitTest`) on every push and pull request before building the APK/AAB artifacts, failing the workflow immediately if either Unit Test A or Unit Test B fails.
