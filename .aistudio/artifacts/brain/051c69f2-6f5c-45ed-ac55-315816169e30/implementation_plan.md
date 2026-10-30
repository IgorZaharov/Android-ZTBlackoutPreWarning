# UABlackoutPreWarning Mobile (Android) — Implementation Plan

A native Android mobile application with Jetpack Compose, Material 3, and WorkManager background monitoring for Ukrainian blackout schedules (Zhytomyroblenergo `ztoe.com.ua`), accompanied by a live interactive web mockup simulator, home-screen widget, GitHub CI/CD build automation, and Google Play publication guide.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural and UX choices have been updated based on your feedback:

- **Notification Frequency Rule (Confirmed)**: **Notifications are sent strictly once per blackout slot**. A persistent alert history/cache records notified slot IDs (e.g., date + start hour + queue) to prevent repeated or duplicate alerts for the same outage window.
- **Widget Interaction & 2x1 Capabilities (Confirmed)**:
  - **Tap to Open App**: Tapping the main body of any widget directly launches the Android application into the Main Screen.
  - **2x1 Minimalist Widget Controls**: Even in the compact 2x1 size, the widget includes a dedicated quick-action toggle button to stop or resume notifications directly without opening the full app.
- **Confirmed Framework**: **Native Android with Jetpack Compose** & **Material 3**, utilizing Kotlin Coroutines and StateFlow for modern, reactive, fluid performance.
- **Confirmed Alert Engine**: **WorkManager Periodic Worker** (15-min background fetch) combined with Android **AlarmManager exact alarms** for precise advance notifications (e.g. 15, 30, or 60 minutes before scheduled power cut) and **NotificationManager** channels.
- **Confirmed Parser Architecture**: **Zhytomyroblenergo (`ztoe.com.ua`) primary parser** built on an extensible provider interface (`OblenergoProvider`) so additional regional oblenergos (DTEK, Lvivoblenergo, etc.) can be seamlessly added later.
- **Dual Delivery Strategy**:
  1. Complete native Android project structure with Kotlin/Compose source files, Glance Widget, AndroidManifest, Gradle setup, and GitHub Actions CI workflow to build unsigned and release APK/AAB artifacts directly in your repository (`https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning`). **[STATUS: Successfully pushed to branch `main` on GitHub; GitHub Actions APK build running]**
  2. A fully interactive, high-fidelity web prototype and visual simulator running right here in AI Studio, allowing you to preview the Android mobile UI (with Android status bar, gesture navigation, simulated widget, light/dark modes, Ukrainian/English localization, and live table parser inspection).

---

## 1. Overview & Core Concept

- **What It Does**: Parses the official blackout schedule tables from `https://www.ztoe.com.ua/unhooking-search.php`, extracts time slots for the user's selected queue (e.g., Queue 1.1–6.2), pinpoints the current time position, computes the exact countdown to the next scheduled outage, and triggers timely pre-warning notifications (strictly once per blackout slot) to give users ample time to charge devices and prepare.
- **Target Audience**: Residents of Zhytomyr and Zhytomyr Oblast affected by emergency and hourly outage schedules (ГПВ), who need reliable, battery-efficient advance warnings on their phones.
- **Key Value**: Eliminates the frustration of manually checking slow or unstable energy provider websites during emergencies. One glance at the app or home-screen widget provides immediate status, countdown, and quick-toggle controls.

---

## 2. User Experience & Visual Design

```
+-------------------------------------------------------------+
| [UA / EN]   ⚡ ZT Blackout Pre-Warning    [🌙 Dark] [⚙️]    |
+-------------------------------------------------------------+
|  QUEUE 2.1 · ZHYTOMYROBLENERGO              [🔔 Alerts ON]  |
|                                                             |
|  ┌────────────────────────────────────────────────────────┐ |
|  │ NEXT POWER OUTAGE IN:                                  │ |
|  │              01 h : 35 m                               │ |
|  │ Scheduled Outage: 14:00 – 18:00 (Today)                │ |
|  │ Status: 🟢 Currently Power ON                          │ |
|  │ Alert: 🔔 Scheduled 30m prior (1x per slot)            │ |
|  └────────────────────────────────────────────────────────┘ |
|                                                             |
|  TODAY'S SCHEDULE (24-Hour Interactive Timeline)           |
|  [00..04] [04..08] [08..12] [12..16] [16..20] [20..24]      |
|  [  ON  ] [ OFF  ] [  ON  ] [ OFF  ] [  ON  ] [ OFF  ]      |
|                               ▲                             |
|                        CURRENT TIME (12:25)                 |
|                                                             |
|  [🔄 Force Refresh]     [🧪 Send Test Alert]   [🔗 ztoe]    |
+-------------------------------------------------------------+
|  [📱 Android Glance Widget Preview (Tap Body -> Open App)]  |
|  ┌──────────────────────────────────────────────────────┐   |
|  │ [2x1 Minimal]  Q 2.1 · In 1h 35m    [🔕 Stop Alerts] │   |
|  └──────────────────────────────────────────────────────┘   |
+-------------------------------------------------------------+
|  (🏠 Main)           (⚙️ Settings)           (ℹ️ About)       |
+-------------------------------------------------------------+
```

### Visual Identity & Theme
- **Material 3 Design Guidelines**:
  - Dynamic surface colors, tonal palettes, and expressive typography.
  - High-contrast accessibility compliance for outdoor sunlight readability.
  - Dark Theme: OLED-friendly dark surface (`#121316` / `#1E1F24`) to conserve phone battery during blackouts.
  - Light Theme: Clean paper-white and neutral gray backdrop (`#F8F9FB`) with soft elevation.
- **Semantic Status Palette**:
  - **Power ON (Active)**: Emerald green (`#10B981` / `#059669`) with soothing pulse.
  - **Power OFF (Blackout)**: High-visibility electric crimson (`#EF4444` / `#DC2626`).
  - **Possible Outage (Reserve)**: Amber / Gold (`#F59E0B` / `#D97706`).
- **Typography**: Clean Android system typeface (`Roboto` / `Inter`), bold numerical monospace digits for countdown clocks (`tabular-nums`), and crisp bilingual typography in Ukrainian and English.

### Key Screens & Navigation
1. **Main Screen (Schedule & Status)**:
   - **Hero Countdown Card**: Prominent display of time remaining until the next outage (or time until restoration if currently disconnected).
   - **24-Hour Segmented Timeline**: Visual hour-by-hour bar (00:00 to 24:00) color-coded by status, with a live moving indicator needle at the exact current time.
   - **Queue Selector & Status Bar**: Quick switch between queue sub-branches (e.g. 1.1, 1.2, 2.1, 2.2 ... 6.2).
   - **Notification Quick-Toggle**: 1-tap button to temporarily snooze or re-enable alarms.
2. **Settings Screen**:
   - **Provider / City URL**: Default to `https://www.ztoe.com.ua/unhooking-search.php`, with capability to edit or choose regional providers.
   - **Queue Configuration**: Select target queue and subqueue.
   - **Update Interval**: Background polling frequency (15 min, 30 min, 1 hour, 2 hours).
   - **Advance Pre-Warning Alert**: Configurable warning threshold (10, 15, 30, 45, or 60 minutes before blackout begins).
   - **Alert Frequency Guard**: Confirms "Sent only once per slot" rule with reset history option.
   - **Test & Diagnostics**: "Send Test Notification", "Force Scrape Now", and "Restore Defaults".
   - **Theme & Language**: Light / Dark / Follow System; Ukrainian / English / Follow System.
3. **About Screen**:
   - Application version (e.g., v1.0.0), author attribution (Igor Zaharov), project description.
   - Direct button links to main GitHub profile (`https://github.com/IgorZaharov`) and GitHub Issues (`https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning/issues`).
   - Disclaimer regarding public open utility data.
4. **Android Home Screen AppWidget (Jetpack Glance)**:
   - **Tap anywhere on widget body** $\rightarrow$ Instantly navigates to the App's Main Screen via explicit `PendingIntent`.
   - **Minimalist (2x1)**: Displays Queue badge (e.g. `Q 2.1`), current status indicator, next blackout countdown, and a dedicated **Stop/Start Notifications button** with immediate widget state update.
   - **Standard & Resizable (3x2 / 4x2)**: Expanded view with detailed time slot (e.g. `14:00 - 18:00`), mini 24h timeline strip, countdown clock, and notification toggle action button.

---

## 3. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────┐
│                   Android Architecture                 │
└────────────────────────────────────────────────────────┘
                           │
       ┌───────────────────┴───────────────────┐
       ▼                                       ▼
┌─────────────────────────┐         ┌─────────────────────────┐
│     UI Layer            │         │   Background Services   │
│  - Jetpack Compose M3   │         │  - WorkManager Worker   │
│  - Navigation Compose   │         │  - AlarmManager Alarms  │
│  - Glance AppWidget     │         │  - NotificationManager  │
│    * Tap -> Open App    │         │  - Alert Deduplication  │
│    * 2x1 Toggle Button  │         │    (1x per slot record) │
└──────────┬──────────────┘         └──────────┬──────────────┘
           │                                   │
           └─────────────────┬─────────────────┘
                             ▼
              ┌─────────────────────────────┐
              │     Repository & State      │
              │  - PreferencesDataStore     │
              │  - NotifiedSlotsRegistry    │
              │  - Kotlin StateFlow         │
              └──────────────┬──────────────┘
                             ▼
              ┌─────────────────────────────┐
              │    Parser / Data Source     │
              │  - Jsoup HTML Parser        │
              │  - ZTOE Provider Engine     │
              │  - Fallback / Mock Cache    │
              └─────────────────────────────┘
```

### Android Project Structure
- `app/src/main/java/ua/blackout/prewarning/`
  - `data/parser/`: `ZtoeParser.kt` (using Jsoup to parse tables, classes, cells, and regex timeslots), `OblenergoProvider.kt`
  - `data/model/`: `BlackoutSlot.kt` (with unique `slotKey = "${date}_${startTime}_${queue}"`), `QueueSchedule.kt`, `UserSettings.kt`
  - `data/repository/`: `ScheduleRepository.kt`, `SettingsDataStore.kt`, `AlertHistoryStore.kt` (tracks notified slot keys to ensure single notification per slot)
  - `worker/`: `ScheduleSyncWorker.kt` (WorkManager periodic job), `AlarmReceiver.kt` (AlarmManager exact pre-warning trigger with slot deduplication check)
  - `notification/`: `NotificationHelper.kt` (heads-up notification channel with direct tap Intent to app)
  - `widget/`:
    - `BlackoutGlanceWidget.kt`: Glance AppWidget defining 2x1 minimal and 3x2/4x2 layouts, clickable root action (`actionStartActivity<MainActivity>()`), and isolated notification toggle button (`actionRunCallback<ToggleNotificationAction>()`).
    - `BlackoutWidgetReceiver.kt`: GlanceAppWidgetReceiver updating widgets on state or schedule changes.
  - `ui/`:
    - `screens/`: `MainScreen.kt`, `SettingsScreen.kt`, `AboutScreen.kt`, `TimelineView.kt`
    - `theme/`: `Theme.kt`, `Color.kt`, `Type.kt`
    - `navigation/`: `NavGraph.kt`, `Screen.kt`

### GitHub CI/CD & Play Store Roadmap
1. **GitHub Actions Workflow (`.github/workflows/android-build.yml`)**:
   - Set up JDK 17, Android SDK.
   - Cache Gradle dependencies.
   - Run `gradlew test` and `gradlew assembleDebug` / `gradlew bundleRelease`.
   - Upload debug APK and signed/unsigned AAB to GitHub Workflow Artifacts & Releases.
2. **README.md**:
   - Comprehensive documentation in Ukrainian and English.
   - Badges, feature list, build instructions, APK download instructions, and changelog.
3. **Google Play Store Publishing Guide**:
   - Step-by-step documentation for Google Play Developer Console, keystore generation, app signing, privacy policy, and release tracks.

---

## 4. Implementation Steps

1. **Interactive Web App & Visual Mockup Simulator**:
   - Build a complete, responsive mobile-first simulator of the Android app using React, Tailwind CSS, Lucide icons, and Motion.
   - Implement real parser logic against `ztoe.com.ua` (with built-in CORS proxy and fallback schedules).
   - Implement "once per slot" notification simulation with history inspection.
   - Implement interactive 2x1 and 3x2 Android Glance Widget simulators with working Stop/Start notification toggle and tap-to-open-app simulation.
   - Include 24-hour interactive visual timeline with current-time needle, live countdown clock, settings editor, test notification system, and language switcher (UA/EN).
2. **Android Project Codebase & Assets Generation**:
   - Generate all production-ready Kotlin Jetpack Compose files, Gradle build files (`build.gradle.kts`, `settings.gradle.kts`, `libs.versions.toml`), `AndroidManifest.xml`, resources, Glance 2x1 & 3x2 Widget implementation, and deduplication logic.
   - Generate modern app icons and vector drawables.
3. **Repository Files & Automation**:
   - Create `.github/workflows/android-build.yml` for automated CI/CD builds on push.
   - Create structured `README.md` (Ukrainian + English) with changelog, architecture guide, and Google Play publication roadmap.
4. **Verification & Packaging**:
   - Run full build and compilation checks.
   - Verify all interactive controls, language switching, widget toggle, and schedule calculation algorithms.
