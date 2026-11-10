# Feature Parity Update Plan — Світло в Житомирі (`ANDROID_UPDATE_SPEC.md` Port)

This plan ports all features, UI/UX flows, emergency outage algorithms, address lookup capabilities, and battery/caching optimizations documented in `ANDROID_UPDATE_SPEC.md` from `https://github.com/IgorZaharov/iOS-ZTPreBlackoutNotification` into both the **Native Android Application (`/android`)** and the **Interactive Web Emulator (`/src`)**, ensuring 100% parity across iOS, Android, and the Emulator.

## User Review & Critical Decisions

> [!IMPORTANT]
> All specifications below come directly from `ANDROID_UPDATE_SPEC.md` and the reference code in `IgorZaharov/iOS-ZTPreBlackoutNotification`. Both the Web Emulator and Native Android (Kotlin + Jetpack Compose + Glance) will be updated in lockstep, keeping Android `compileSdk = 36` / `targetSdk = 36` and existing signing configurations intact.

- **Confirmed Decision 1 — First Launch Unselected Queue UX (`queue = ""` Default)**:
  - Fresh installs start with `queue = ""` and `language = "system"` (`Auto`).
  - When `isQueueUnselected == true`, the Main screen content and bottom navigation bar are dimmed (`alpha = 0.15`) and disabled, while a centered full-screen overlay displays the primary `"Виберіть чергу"` / `"Select queue"` button (`#FF5E3A`, subtitle `"Житомиробленерго (ZTOE)"`) directly **above** the 3-segment language selector (`Auto` / `English` / `Українська`).
  - Tapping `"Виберіть чергу"` / `"Select queue"` navigates to Settings and automatically opens the full-screen `"?"` Address Lookup & Help modal; confirming a queue or address for the first time automatically switches back to the Main window.
- **Confirmed Decision 2 — Full-Screen `"?"` Address Lookup Modal & Queue `5.2` Preservation Fix**:
  - Upgrades the `"?"` dialog in Settings into a full-screen modal (`#141A29`) with an interactive **Search by Address** block (`2.dp` `white/25` border) at the top (РЕМ defaulting to `"Житомирський РЕМ"`, Settlement defaulting to `"м. Житомир"`, and Street/House unselected by default on first launch, then persisted across sessions), followed by `"Пошук вручну"` / `"Manual search"` and numbered steps `1–4`.
  - Enforces the `5.2 -> 3.2` preservation safeguard: if a house selected from the directory already has a known queue (e.g., `вул. Київська, буд. 77` -> `5.2`), live HTML table refreshes (`checkAddressOnZtoeWebsite` and `loadSchedules`) never overwrite `5.2` with a conflicting row (`3.2`); live HTML only assigns a queue if the house previously had no queue (`queue == ""`).
- **Confirmed Decision 3 — No-Queue Houses (`буд. 104`) & Emergency Outages (`"Аварійне відключення"`) Priority Overlap**:
  - Houses without a scheduled queue (e.g., `вул. Київська, буд. 104`) set `queue = ""`, display the full unshortened message `"В цей час не вимикається, за винятком випадків аварійних відключень"` with a line break (`\n`) after the city in the formatted address, hide the top queue header, display `"--:--:--"` on the main counter, and render all 24 hour columns of the Drum Chart with light internal squares (`POWER_ON`).
  - Active emergency outages parsed from ZTOE `pw_accidents` JSON and HTML tables override and merge with regular scheduled slots (`applyEmergencyOutageToSchedule`) across Today and Tomorrow (including midnight-spanning and coinciding outages), driving the Main countdown, 24h Drum Chart, Today/Tomorrow interval lists (`20x20` leading slot with `"!"` icon vs centered dot), Home Screen Widgets, and one-time state-transition notifications (detect & restore).

---

## 1. Overview & Core Concept

- **What It Does**: Synchronizes the Android application and AI Studio Web Emulator with the latest iOS release by adding interactive ZTOE address-to-queue lookup, first-launch onboarding overlay, no-queue house support, real-time emergency outage detection and schedule merging, aligned `"!"` emergency indicators in the Today/Tomorrow interval lists, and battery/caching optimizations.
- **Target Audience / Persona**: Residents of Zhytomyr and Zhytomyr Oblast who look up their blackout queue by street and house number, including residents in buildings with special no-outage status or active emergency accidents (`pw_accidents`).
- **Key Value**: Eliminates manual queue lookup friction, prevents false queue overwrites on live refreshes, surfaces emergency outages with full countdown and widget integration, and keeps the iOS and Android codebases 100% aligned.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **First-Launch Onboarding Flow**:
     - On a fresh launch (`queue == ""`, no custom status text, no active emergency outage), the Main screen and bottom dock are dimmed (`15%` opacity, non-interactive).
     - A centered overlay presents the orange `"Виберіть чергу"` / `"Select queue"` button (`min-w-[260px]`, `#FF5E3A`, subtitle `"Житомиробленерго (ZTOE)"`) above the `Auto | English | Українська` segmented switch.
     - Tapping the button opens the Settings tab and automatically launches the full-screen `"?"` Address Lookup modal.
     - Once the user confirms an address or selects a queue for the first time, the app immediately navigates back to the Main screen (`selectedPage = 0`).
  2. **Full-Screen `"?"` Address Lookup & Manual Search Flow**:
     - Opens a full-screen `#141A29` modal containing:
       1. **Block 1 — Search by Address (`"Пошук черги за адресою"` / `"Find Queue by Address"`)**: Boxed with an expanded `2px` (`2.dp`) `white/25` border and 4 stacked dropdowns (`РЕМ`, `Населений пункт`, `Вулиця`, `Будинок`). Street (`"Оберіть вулицю"` / `"Select street"`) and House (`"Оберіть будинок"` / `"Select house"`) start unselected on first launch and persist in `UserSettings` (`selectedAddressQuery`) once confirmed.
       2. **Block 2 — Manual Search Heading**: `"Пошук вручну"` / `"Manual search"`.
       3. **Block 3 — Steps 1–4**: Numbered instructions (Step 1 URL without a trailing period).
  3. **No-Queue Building Display Flow (`вул. Київська, буд. 104`)**:
     - Sets `queue = ""` and `customQueueStatusText = "В цей час не вимикається, за винятком випадків аварійних відключень"`.
     - Top header queue badge is hidden; formatted address wraps onto a new line right after the city (`"Житомирський РЕМ, м. Житомир,\nвул. Київська, буд. 104"`).
     - Main countdown shows `"--:--:--"` (hiding the `"--:-- - --:--"` slot range line), and the 24-hour Drum Chart renders all 24 hours with light internal squares (`POWER_ON`).
  4. **Emergency Outage Detection & Overlap Flow**:
     - Parses ZTOE `pw_accidents` JSON and emergency HTML tables for the user's `selectedAddressQuery`.
     - Renders an Emergency Outage banner on the Main screen with start time (`Початок`) and estimated restoration time (`Орієнтовне відновлення`).
     - Merges emergency half-hour slots (`POWER_OFF`, `isEmergency = true`) into Today and Tomorrow schedules so the Main countdown, 24h Drum Chart, Today/Tomorrow interval lists, and Small/Big Home Screen Widgets reflect the combined outage window.
     - Today/Tomorrow list headers dynamically read `"Години відключень на сьогодні:"` / `"Blackout hours for today:"` and `"Години відключень на завтра:"` / `"Blackout hours for tomorrow:"`, with a fixed `20x20` leading indicator container (`"!"` inside an orange circle for emergency intervals, or a centered `10x10` orange dot for regular intervals) so all timeslot strings align horizontally.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Queue Preservation Safeguard on Live Refreshes (`5.2 -> 3.2` Fix)**
  - *Chosen Approach*: When `checkAddressOnZtoeWebsite` and `loadSchedules` re-check `selectedAddressQuery` against `/unhooking-search.php`, live HTML table rows are only allowed to assign or change `settings.queue` if the house previously had **no queue** (`localMatch.queue.isEmpty()` / `currentSettings.queue.isBlank()`). If a house has both a queue row and a no-outage status row in the table (such as `буд. 104`), the no-outage status row takes precedence.
  - *Why*: ZTOE's live HTML lookup can return multi-row sub-tables where a commercial sub-meter row (`3.2`) appears alongside a residential building (`5.2`). Preserving the directory-verified queue prevents the user's selected queue (`5.2`) from unexpectedly flipping to `3.2` on refresh.

- **Decision 2: Priority Merging of Emergency Outages (`applyEmergencyOutageToSchedule`)**
  - *Chosen Approach*: Apply `applyEmergencyOutageToSchedule` to both Today and Tomorrow schedules before computing `getBlackoutIntervals`, `calculateOutageCountdown`, or rendering the 24-hour Drum Chart and Glance Widgets. Even when an emergency outage coincides with an existing scheduled `POWER_OFF` slot, `isEmergency = true` is propagated onto the slot and merged interval.
  - *Why*: Ensures that cross-midnight and overlapping emergency outages produce a single continuous countdown to the true power restoration time and display the `"!"` indicator in the Today/Tomorrow interval list.

- **Decision 3: State-Transition Deduplication for Emergency Notifications**
  - *Chosen Approach*: `checkAndTriggerEmergencyOutageAlert` tracks `emergency_detect_${id}_${startTime}_${estimatedRestoreTime}` and `emergency_restore_${id}_${startTime}` in `AlertRegistry`.
  - *Why*: Guarantees the user receives exactly one notification when an emergency outage starts, zero duplicate notifications on periodic refreshes while it remains active, and one notification when power is restored.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Data Flow Diagram**:

```
┌────────────────────────────────────────────────────────────────────────────┐
│                ZTOE Website (/unhooking-search.php)                        │
│   [Schedule Leaf Tables] · [Address Lookup POST] · [pw_accidents JSON]     │
└───────────────┬───────────────────────┬────────────────────────┬───────────┘
                │                       │                        │
                ▼                       ▼                        ▼
┌────────────────────────────────────────────────────────────────────────────┐
│         ZtoeParser & ZtoeAddressLookup (Web TS & Android Kotlin)           │
│  • Single-pass 12-queue 48-slot parser + ETag / HTTP 304 cache             │
│  • Address directory (РЕМ -> Settlement -> Street -> House) + live check   │
│  • Queue 5.2 preservation guard + No-Queue house (буд. 104) handler        │
│  • pw_accidents & HTML emergency matcher -> EmergencyOutageInfo            │
└───────────────┬────────────────────────────────────────────────────────────┘
                │
                ▼
┌────────────────────────────────────────────────────────────────────────────┐
│           applyEmergencyOutageToSchedule (Today & Tomorrow)                │
│  • Overrides overlapping half-hour slots with POWER_OFF & isEmergency=true │
│  • Propagates isEmergency into merged BlackoutIntervals / DetailedInterval │
└───────┬───────────────────────┬────────────────────────┬───────────────────┘
        │                       │                        │
        ▼                       ▼                        ▼
┌───────────────────┐ ┌────────────────────────┐ ┌───────────────────────────┐
│ MainScreen &      │ │ SettingsScreen &       │ │ BlackoutGlanceWidget &    │
│ First-Launch UX   │ │ Full-Screen "?" Modal  │ │ NotificationScheduler     │
│ • Unselected Lock │ │ • 2dp bordered Search  │ │ • Merged Widget Countdown │
│ • No-Queue Card   │ │   by Address block     │ │ • 24h Drum Chart Parity   │
│ • Emergency Card  │ │ • Persistent 4 fields  │ │ • 1x Detect & 1x Restore  │
│ • 20x20 "!" List  │ │ • Auto-return to Main  │ │   Emergency Notifications │
└───────────────────┘ └────────────────────────┘ └───────────────────────────┘
```

- **Data Model Extensions (`UserSettings`, `BlackoutSlot`, `BlackoutInterval`)**:
  - `EmergencyOutageInfo`: `id`, `remName`, `settlementName`, `streetName`, `house`, `outageType`, `startTime` (`"DD.MM.YYYY HH:MM"`), `estimatedRestoreTime` (`"DD.MM.YYYY HH:MM"`).
  - `SelectedAddressQuery`: `remId`, `settlementId`, `streetId`, `house`.
  - `UserSettings`: Adds `customQueueStatusText: String?`, `selectedAddress: String?`, `selectedAddressQuery: SelectedAddressQuery?`, `activeEmergencyOutage: EmergencyOutageInfo?`, with `queue` defaulting to `""` on fresh install and `language` defaulting to `"system"` (`Auto`).
  - `BlackoutSlot` & `BlackoutInterval` / `DetailedInterval`: Adds `isEmergency: Boolean = false`.

- **Battery, Performance & Caching Optimizations**:
  - **Lifecycle & Screen Gated 1-Second Ticker**: Runs only when the app is in the foreground (`Lifecycle.State.RESUMED`), on the Main tab (`selectedPage == 0`), and `isRouletteOpen == false`.
  - **Midnight Rollover Promotion**: When `00:00` (`Europe/Kyiv`) passes and `cached_schedule_date == yesterdayIsoString(now)`, promotes cached `tomorrow` slots into `today` slots automatically.
  - **Bounded Caches & Smart Rescheduling**: Caps interval memoization cache at `64` entries and `AlertRegistry` at `100` entries; only updates `WorkManager` periodic work when `refreshIntervalMinutes` changes; syncs `AlarmScheduler` immediately when toggling notifications from the Home Screen Widget.

- **Verification & Unit Testing**:
  - Port the complete `ztoeAddressLookup.ts` / `ZtoeAddressLookup.kt` module and update `MainScreen`, `SettingsScreen`, `BlackoutAppNavigation`, `BlackoutGlanceWidget`, `ScheduleRepository`, `SettingsRepository`, and `ZtoeParser` across both `/src` and `/android`.
  - Update `CHANGELOG.md` and `scripts/generate_android_project.cjs` to sync `src/data/androidProjectFiles.ts` and `/public/Android-ZTBlackoutPreWarning.zip`.
  - Add unit test suites in `tests/unit.test.ts` and `android/app/src/test/java/ua/blackout/prewarning/ZtoeParserTest.kt` covering all 10 checklist items from `ANDROID_UPDATE_SPEC.md` (First Launch zero-state & overlay, `"?"` modal defaults & persistence, Queue `5.2` preservation on `буд. 77`, No-Queue house `буд. 104`, Emergency outage priority overlap & notifications, `"!"` indicator alignment, and battery/caching optimizations).
