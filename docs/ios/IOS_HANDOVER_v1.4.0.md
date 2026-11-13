# iOS port package for release 1.4.0 — "Світло в Житомирі"

| | |
|---|---|
| Target repository (read only from here) | `https://github.com/IgorZaharov/iOS-ZTPreBlackoutNotification` (Swift 5.10, SwiftUI, WidgetKit, XcodeGen, iOS 17.0+) |
| Source repository (this one) | `Android-ZTBlackoutPreWarning`, branch `feat/1.4.0-outage-rework` |
| Written | 2026-11-13, milestone M0 of the iOS roadmap |
| Replaces | `IOS_HANDOVER.md` (root) and the iOS parts of `ANDROID_UPDATE_SPEC.md`, which are wrong in the places listed in section 5 |
| Contract | `spec/` (prose) and `spec/vectors/` (machine-checked golden cases). Where this file and `spec/` disagree, `spec/` wins; where `spec/` and the Kotlin code disagree, see section 9. |

Conventions in this file: a path in backticks was checked to exist on 2026-11-13 unless it carries the word "(planned)". "Not verified" marks anything that could not be confirmed from files or from the iOS repository. Ukrainian and English UI strings are copied from `android/app/src/main/java/ua/blackout/prewarning/ui/AppStrings.kt` as it stood on 2026-11-13; that file was still being edited by other agents, so re-read it at the release tag (section 7).

---

## 0. What exists in the iOS repository today (read-only survey, 2026-11-13)

| Fact | Value | Source |
|---|---|---|
| Latest GitHub release | `v1.3.3` (2026-11-09), unsigned IPA only | `gh release list` |
| `main` marketing version | `MARKETING_VERSION "1.3.5"`, `CURRENT_PROJECT_VERSION "105"` in `ios/project.yml` | `ios/project.yml` |
| Info.plist version | hard-coded `CFBundleShortVersionString 1.3.4`, `CFBundleVersion 105` (does not follow `project.yml`) | `ios/ZTPreBlackout/Info.plist` |
| Bundle ids | app `ua.blackout.prewarning`, widget `ua.blackout.prewarning.widget`, `bundleIdPrefix ua.blackout` | `ios/project.yml` |
| App Group | `group.ua.blackout.prewarning` (not `group.com.ZTBlackoutPreWarning`, which `IOS_HANDOVER.md` claims) | `ios/ZTPreBlackout/ZTPreBlackout.entitlements`, `ScheduleRepository.APP_GROUP_ID` |
| Signing | `DEVELOPMENT_TEAM: ""`, `CODE_SIGN_STYLE: Automatic`; no Apple Developer account wired in | `ios/project.yml` |
| Background task id | `ua.blackout.prewarning.sync`, `BGAppRefreshTask`; `UIBackgroundModes` = `fetch`, `processing` | `Worker/BackgroundSyncManager.swift`, `Info.plist` |
| Real source layout | `ios/Shared/*.swift` (compiled into app **and** widget), `ios/ZTPreBlackout/{UI,Notifications,Worker}/`, `ios/BlackoutWidgetExtension/`, `ios/ZTPreBlackoutTests/`, `ios/Resources/` | git tree |
| Files in `ios/Shared` | `AppStrings`, `DonationsRepository`, `KyivZone`, `Models`, `ScheduleRepository`, `SettingsRepository`, `TimeOfDayPalette`, `ZtoeParser` | git tree |
| Files in `ios/ZTPreBlackout` | `ZTPreBlackoutApp`, `Notifications/{AlertRegistry,NotificationScheduler}`, `UI/{AboutScreen,BlackoutAppNavigation,MainScreen,SettingsScreen,TimelineBar,ZhytomyrRouletteScreen}`, `Worker/BackgroundSyncManager`, `Info.plist`, `PrivacyInfo.xcprivacy`, entitlements | git tree |
| Tests | `ZtoeParserTests.swift`, 4 test functions, 95 lines | `ios/ZTPreBlackoutTests/` |
| Third-party packages | none; HTML is parsed with `NSRegularExpression` (`leafTableRegex`, `trRegex`, `tdRegex`); CP1251 decoded through `CFStringEncodings.windowsCyrillic` with a UTF-8 fallback | `Shared/ZtoeParser.swift` |
| Address lookup, `all=1`, PowerOn | **absent**: no `ZtoeAddressLookup.swift`, no `all=1`, no `poweron`/`inneti` string anywhere, zero uses of "emergency" in `ZtoeParser.swift`. The "?" dialog is only the 4-step help text (`queueHelpSteps`). `MainScreen` accepts `emergencyOutageStartTime`/`RestoreTime` and `ScheduleRepository.applyEmergencyOutageToSlots` overlays them, but nothing ever supplies them. | grep over `Shared/`, `UI/` |
| Emergency switch | `emergencyNotificationsEnabled` exists (default true) and `NotificationScheduler` returns early when it is off; notification key is an opaque `outageKey` | `SettingsRepository.swift`, `NotificationScheduler.swift` |
| Planned alert id | `block_<yyyy-MM-dd>_<start>_<end>_Q<queue>` (one per block of one day) | `NotificationScheduler.swift` |
| Stored keys that differ from Android | `advance_notice_minutes`, `refresh_interval_minutes`, `theme` (Android: `advance_minutes`, `refresh_minutes`, `theme_mode`) | `SettingsRepository.swift` vs `SettingsRepository.kt` |
| Other tracked content | the repo also tracks the web workbench (`src/`, `tests/`, `package.json`, `public/`), a stale copy of `android/`, `scripts/generate_ios_project.cjs`, and `src/data/iosProjectFiles.ts`; the `.gitignore` rules promised by `IOS_HANDOVER.md` section 4.1 are not in effect for these paths | git tree |
| CI | `.github/workflows/build-ipa.yml`: `macos-14`, Xcode 15.4, runs `npm test`, `xcodegen generate`, unsigned `xcodebuild`, zips an IPA; the "Optional Apple Developer Certificate Signing" step only imports a certificate and profile, there is no `archive`/`exportArchive`/upload | workflow file |

Not verified: whether the `v1.3.3` tag has the same Swift sources as `main`; whether `ios/Resources/PRIVACY_POLICY.md` equals the root copy.

---

## 1. What changed in 1.4.0

Sources read: `docs/review/CODE_REVIEW.md`, `spec/*.md`, `spec/vectors/*.json`, `docs/design/MULTI_ADDRESS.md`, the Kotlin files named in section 4. There was no `1.4.0` entry in `CHANGELOG.md` on 2026-11-13 (top entry is `1.3.5`); the changelog gate in `tests/unit.test.ts` applies to this repo only.

### 1.1 New outage engine (pure core, no I/O, no clock)

- One definition of "what is off when": `OutageEngine` (`spec/OUTAGE_ENGINE.md`). Instants are `LocalDateTime` values in `Europe/Kyiv`; durations and countdowns are elapsed real time (DST nights are 4 h and 2 h for a `02:00-05:00` block).
- Window **yesterday, today, tomorrow**. A planned block that crosses midnight is **one** outage (`planned_2026-11-13T23:00`, end `2026-11-14T01:00`); its two day rows both show the real full duration; per-day totals count only minutes inside the day. A block that ends exactly at the end of the last known day gets `mayContinue = true`.
- Three outage kinds: `PLANNED` (ztoe hourly table), `REPAIR` (PowerOn planned works), `EMERGENCY` (PowerOn). Statuses `FINISHED`, `ACTIVE`, `UPCOMING`, `OVERDUE`; an emergency listed past its estimate is `OVERDUE` (end unknown, countdown `--:--:--`) for 60 minutes, then `stale` (finished, never off, never alerts). Exactly 60 minutes is still overdue, 61 is stale.
- Functions to port, all pure: `normalizeSlots`, `buildPlanned`, `resolveEmergency`, `inWindow`, `spans`, `formatSpanTime` (`24:00` for a midnight end), `formatSpan`, `formatCountdown`, `dayView`, `status`, `planAlerts`, `transitions`.
- Planned alerts: one per **merged span** (never for a `00:00` continuation, never retroactive, key `planned_<spanStartISO>`), recomputed from scratch and diffed by key.

### 1.2 PowerOn emergency source (per-address queries and a local ledger)

- Source: `https://api-ztoe-poweron.inneti.net/api`, unofficial and public, GET only (`spec/POWERON_API.md`). 1.4.0 queries **per address** by `street.id[]` (about 1 KB per street) instead of per whole REM (340 to 915 KB), with `pagination=false`, `Accept: application/ld+json`, connect and read timeouts 8 000 ms, 60 s accident cache.
- Emergency = `switchSubReason != 2` (`2` is a mirror of the hourly schedule). Timestamps are Kyiv wall-clock labelled `+00:00`: drop the offset, never convert.
- Result is tri-state: `Confirmed(records)` (an empty list is a valid answer) or `Unavailable(reason)`; `Unavailable` never means "no emergency".
- PowerOn has no history, so finished emergencies come from a **local ledger** (`EmergencyLedger`, 48 h retention). The ledger turns each confirmed fetch into events `START`, `ETA_CHANGED` (estimate moved by at least 10 minutes), `END` (a confirmed fetch no longer lists an announced emergency; `earlyEnd` when it vanished before its estimate).
- Address resolution (REM to PowerOn city ids to street ids, all ids that share a `StreetKey` kept) is an adapter step; unresolved means `Unavailable("unresolved")`.

### 1.3 Site-state indicator and staleness

Four states (`spec/SITE_STATE.md`): `AVAILABLE_WITH_TABLE`, `AVAILABLE_NO_TABLE`, `SITE_UNREACHABLE`, `NO_INTERNET`, resolved from `FetchFailure` + `hasTodayTable` + `networkValidated`. A failed or table-less fetch never clears the schedule cache or cancels alarms; stale data is labelled with the time of the last good fetch. A chip is always shown; every state except `AVAILABLE_WITH_TABLE` also gets a banner card, except that `AVAILABLE_NO_TABLE` with a ztoe notice shows only the notice card (no banner). The banner is compact: title (14 pt bold) and each message line (13 pt) on one line each, shrinking up to 15 % (never under 12 pt) before wrapping (`.lineLimit(1).minimumScaleFactor(0.85)` on iOS).

### 1.4 Tomorrow tab, midnight rows, emergency overlay on the drum

- The Tomorrow tab is always present. When ztoe has not published tomorrow, the drum is grey and a notice says so, while PowerOn emergency and repair outages for tomorrow are still drawn (`spec/UI_DRUM.md` section 1, `spec/SITE_STATE.md` section 7).
- Drum cell states: on (ivory), planned/repair off (crimson), emergency (amber gradient with dark 45-degree stripes), planned + emergency (crimson with amber stripes), unclear (grey). Stripes are the second cue, so colour is never the only signal.
- Row list under the drum: one row per outage, `HH:mm – HH:mm` with an en dash, a midnight end prints `24:00`, a block that leaves the day shows the far side date (`23:00 – 01:00 (14.11)`), the next day's row shows `з 13.11 23:00`; duration chip is the full outage length; `REPAIR` has a wrench and `Планові роботи`; `EMERGENCY` has a `!` circle and `Аварійне`; `FINISHED` rows are 55 % opacity.

### 1.5 Address picker and duplicate streets

- Searchable full-screen picker for REM, settlement, street and house (`SearchablePickerField.kt`, matching in `PickerSearch.kt`): case-, apostrophe-, diacritic- and prefix-insensitive; Latin and Cyrillic look-alikes match; the leading type word (`вул.`, `м.`) is optional; ranking is prefix, then word prefix, then substring.
- Duplicate-street merge (`spec/ADDRESS_KEY.md`): `StreetKey.of`, `HouseKey` fold apostrophes, case, spacing, type abbreviations and Latin/Cyrillic look-alikes, so the 8 real duplicate pairs found in the live data (`docs/review/CODE_REVIEW.md` section 6.3) become one street that carries **all** its ids (an accident row may hang on either id).

### 1.6 Notifications: exact alarms, separate emergency toggle and channel

- Android: `SCHEDULE_EXACT_ALARM` kept, `USE_EXACT_ALARM` removed; a gate (`ExactAlarmGate`), a permission-change receiver, a request-code registry (`AlarmCodes`) instead of `String.hashCode()`; fallback to inexact alarms plus a Settings card and a Main banner. **None of this exists on iOS** (section 6).
- Separate planned and emergency notification channels and toggles; `emergencyNotificationsEnabled` (default true) gates emergency events **only**, `notificationsEnabled` gates planned alerts only; a dropped emergency event is never replayed.
- Receiver order fix (post the notification first, then redraw widgets), text computed at delivery time.

### 1.7 Smaller items

`OutageRowFormat` (shared row text rules), `GlassCard` and `ZtTokens` (`spec/design-tokens.json`), type scale with a 12 sp floor and Dynamic Type roles, `NetworkProbe` (OS verdict, no third-party ping), `ZtoeStaticDirectory` (offline fallback of REMs and a few settlements, no house numbers, no demo emergency), `OutageStateStore`.

### 1.8 What the iOS app lacks relative to Android 1.3.4/1.3.5 (independent of 1.4.0)

All of this has to be built in the port because the iOS source has none of it (section 0): REM/settlement/street/house address lookup with the "?" dialog, `all=1` settlement bulk indexing and launch prefetch, disk cache of the address index, HTML entity decoding, PowerOn emergency fetch, Card 1b (custom status) and Card 1c (emergency banner) with live data, the `"Обрати чергу"` flow that ends on the Main screen, and first-launch queue selection with the language switch (Not verified whether the last two exist in iOS `BlackoutAppNavigation.swift`; they were not read in full).

---

## 2. Reading order for the porting session

1. `spec/README.md`, `spec/config.json`, `spec/rems.json`.
2. `spec/OUTAGE_ENGINE.md` then `spec/vectors/outage_engine.json`.
3. `spec/ADDRESS_KEY.md`, `spec/POWERON_API.md`, `spec/NOTIFICATIONS.md`, `spec/SITE_STATE.md`, `spec/UI_DRUM.md`, `spec/PERSISTENCE.md`, `spec/design-tokens.json`.
4. Kotlin reference (pure code first): `core/*.kt`, then `data/poweron/PowerOnClient.kt`, `data/repository/Outage*.kt`.
5. This file, sections 4 to 8.

---

## 3. Vectors the XCTest target must run

All files are UTF-8 JSON in `spec/vectors/`. Read them with `Data(contentsOf:)` and `JSONSerialization`/`Codable`; do not hand-copy expected values.

| File | Content | Maps to |
|---|---|---|
| `outage_engine.json` | 22 cases (`planned`, `emergencies`, `now`, `advanceMinutes`, `expect` with `status`, `spans`, `alerts`, `days`); only keys present under `expect` are compared | `OutageEngine` |
| `emergency_ledger.json` | 9 cases, each a sequence of steps (`now`, `fetch` = `{confirmed:[...]}` or `{unavailable:true}`, `events`) from an empty ledger, `addressKey` `addr` | `EmergencyLedger` |
| `poweron_api.json` | `timestamps` (9), `emergencyMapping` (5), `repairMapping` (2) | `PowerOnMapper` |
| `address_keys.json` | `streetEqual` (8), `streetDistinct` (5), `houseEqual` (6), `houseDistinct` (5), `listContains` (9) | `StreetKey`, `HouseKey` |
| `site_state.json` | 12 cases (`FetchFailure` x `hasTodayTable` x `networkValidated`) | `SiteStateResolver` |

Reference runners: `android/app/src/test/java/ua/blackout/prewarning/core/SpecVectorsTest.kt` and `tests/spec-vectors.test.ts`. Also checked directly by the Kotlin runner and not in JSON: `&amp;#039;`, `&#39;`, `&#x27;` all decode to `'`, and `a&amp;b` decodes to `a&b` (`spec/ADDRESS_KEY.md` section 1). `PickerSearchTest.kt` (`android/app/src/test/java/ua/blackout/prewarning/ui/PickerSearchTest.kt`) is Android-only and has no vector; port its cases by hand.

---

## 4. Three-way file mapping

Columns: web simulator (`src/...`), Kotlin (`android/app/src/main/java/ua/blackout/prewarning/...`), Swift (proposed or existing path under `ios/`). Existence was checked with Glob on 2026-11-13. "(planned)" = the file did not exist yet (other agents were still writing it) or does not exist for that platform; for web, the "where the logic lives now" is given in words.

Swift conventions: pure, tested code goes to `ios/Shared/Core/` (a new sub-folder; `project.yml` already compiles `path: Shared` recursively into both the app and the widget). Data-layer files stay flat in `ios/Shared/` like the existing ones; SwiftUI views go flat into `ios/ZTPreBlackout/UI/`; notification code into `ios/ZTPreBlackout/Notifications/`. Tests go to `ios/ZTPreBlackoutTests/`.

### 4.1 `core/` (pure)

| Subsystem | Web | Kotlin | Swift |
|---|---|---|---|
| Outage models, `OutageConfig`, `LocalDateTime` helpers | `src/core/outageModels.ts` | `core/OutageModels.kt` | `ios/Shared/Core/OutageModels.swift` (new; define a `LocalDateTime` struct, not `Date`) |
| Outage engine | `src/core/outageEngine.ts` | `core/OutageEngine.kt` | `ios/Shared/Core/OutageEngine.swift` (new) |
| Kyiv wall-clock to instant mapping, elapsed time | `src/core/localTime.ts` | `data/KyivZone.kt` and `java.time` use inside `core/OutageEngine.kt` | extend existing `ios/Shared/KyivZone.swift`; put the gap/overlap rules in `ios/Shared/Core/KyivTime.swift` (new) |
| Emergency ledger | `src/core/emergencyLedger.ts` | `core/EmergencyLedger.kt` | `ios/Shared/Core/EmergencyLedger.swift` (new) |
| PowerOn row mapping and `parseTime` | `src/core/poweronMapper.ts` | `core/PowerOnMapper.kt` | `ios/Shared/Core/PowerOnMapper.swift` (new) |
| `StreetKey`, `HouseKey`, `TextNorm` | `src/core/addressKeys.ts` | `core/AddressKeys.kt` | `ios/Shared/Core/AddressKeys.swift` (new) |
| Site state resolver, `FetchFailure` | `src/core/siteState.ts` | `core/SiteState.kt` | `ios/Shared/Core/SiteState.swift` (new) |
| Vector runner | `tests/spec-vectors.test.ts` | `android/app/src/test/java/ua/blackout/prewarning/core/SpecVectorsTest.kt` | `ios/ZTPreBlackoutTests/SpecVectorsTests.swift` (new) |

### 4.2 `data/poweron/`, `data/net/`, `data/repository/Outage*.kt`, parsers

| Subsystem | Web | Kotlin | Swift |
|---|---|---|---|
| PowerOn HTTP client, id resolution, 60 s cache, tri-state result | (planned `src/services/poweronClient.ts`; today the web fetches PowerOn inside `src/services/ztoeAddressLookup.ts`) | `data/poweron/PowerOnClient.kt` (+ test `android/app/src/test/java/ua/blackout/prewarning/data/poweron/PowerOnClientTest.kt`) | `ios/Shared/PowerOnClient.swift` (new; `URLSession`, `HttpGet` protocol for tests) |
| OS network verdict (`networkValidated`) | uses `navigator.onLine` in `src/services/ztoeParser.ts` (no own file) | `data/net/NetworkProbe.kt` | `ios/Shared/NetworkProbe.swift` (new; `NWPathMonitor`) |
| Orchestration: fetch ztoe + PowerOn, build snapshot, run ledger, refresh outcome | (planned; logic is spread over `src/App.tsx`, `src/services/ztoeParser.ts`, `src/services/alertManager.ts`) | `data/repository/OutageRepository.kt` (`OutageSnapshot`, `RefreshOutcome`) | `ios/Shared/OutageRepository.swift` (new) |
| Persistent outage state: ledger, repair list, resolved ids, site state, PowerOn status | (planned; web has no equivalent store) | `data/repository/OutageStateStore.kt` | `ios/Shared/OutageStateStore.swift` (new; JSON files in the App Group container, section 6) |
| ztoe schedule HTML parser | `src/services/ztoeParser.ts` | `data/parser/ZtoeParser.kt` | `ios/Shared/ZtoeParser.swift` (exists) |
| Address lookup (REM/settlement/street/house, `all=1`, prefetch, disk cache) | `src/services/ztoeAddressLookup.ts` | `data/parser/ZtoeAddressLookup.kt` | `ios/Shared/ZtoeAddressLookup.swift` (new; absent in iOS today) |
| Offline fallback directory (19 REMs, settlements, few streets, no houses) | table inside `src/services/ztoeAddressLookup.ts` | `data/parser/ZtoeStaticDirectory.kt` | `ios/Shared/ZtoeStaticDirectory.swift` (new; generate the REM part from `spec/rems.json`) |
| Schedule cache, day promotion at midnight | `src/services/ztoeParser.ts` | `data/repository/ScheduleRepository.kt` | `ios/Shared/ScheduleRepository.swift` (exists; rework) |
| User settings | `src/App.tsx` (`localStorage`), `src/types.ts` | `data/repository/SettingsRepository.kt`, `data/model/Models.kt` | `ios/Shared/SettingsRepository.swift`, `ios/Shared/Models.swift` (exist; rework, section 5.3) |
| Alert registry (dedupe of fired keys) | `src/services/alertManager.ts` | `data/repository/AlertRegistry.kt` | `ios/ZTPreBlackout/Notifications/AlertRegistry.swift` (exists) |
| Donations | `src/services/donationsService.ts` | `data/repository/DonationsRepository.kt` | `ios/Shared/DonationsRepository.swift` (exists) |

### 4.3 Notifications

| Subsystem | Web | Kotlin | Swift |
|---|---|---|---|
| Planner: alert plan diff, scheduling, emergency posting | `src/services/alertManager.ts` | `notification/AlarmScheduler.kt`, `notification/AlarmReceiver.kt`, `notification/NotificationHelper.kt` | `ios/ZTPreBlackout/Notifications/NotificationScheduler.swift` (exists; rework) + `ios/ZTPreBlackout/Notifications/NotificationPlanner.swift` (new; rolling window of at most 40) |
| Exact-alarm gate and permission state | none | `notification/ExactAlarmGate.kt` (also holds `AlarmCodes`) | **none, not ported** (iOS has no exact-alarm concept) |
| Exact-alarm permission-change receiver | none | `notification/ExactAlarmPermissionReceiver.kt` | **none, not ported** |
| Background refresh | none | `worker/ScheduleSyncWorker.kt`, `worker/BootCompletedReceiver.kt` | `ios/ZTPreBlackout/Worker/BackgroundSyncManager.swift` (exists; reboot needs no code on iOS) |

### 4.4 UI components new in 1.4.0

| Subsystem | Web | Kotlin | Swift |
|---|---|---|---|
| Searchable address picker (REM, settlement, street, house) | (planned `src/components/SearchablePickerField.tsx`) | `ui/components/SearchablePickerField.kt` | `ios/ZTPreBlackout/UI/SearchablePickerField.swift` (new; SwiftUI `.searchable` inside a sheet, filtering by `PickerSearch`, not by the native substring match) |
| Picker matching and ranking | (planned, same file as above or `src/core/pickerSearch.ts`) | `ui/components/PickerSearch.kt` | `ios/Shared/PickerSearch.swift` (new; unit-tested) |
| Site status chip row, banner, `SiteStatusModel` | (planned `src/components/SiteStatusIndicator.tsx`) | `ui/components/SiteStatusIndicator.kt` | `ios/ZTPreBlackout/UI/SiteStatusIndicator.swift` (new) |
| Row text rules (time label, tags, duration, continuation) | (planned `src/core/outageRowFormat.ts`) | `ui/components/OutageRowFormat.kt` | `ios/Shared/OutageRowFormat.swift` (new; widget uses it too) |
| 24h drum with emergency stripes, needle, ticks | drum is inline in `src/components/MainView.tsx` (stripes planned) and `src/components/WidgetSimulator.tsx` | `ui/components/TimelineBar.kt` (+ widget bitmap in `widget/BlackoutGlanceWidget.kt`) | `ios/ZTPreBlackout/UI/TimelineBar.swift` (exists; rework) |
| Frosted glass card | CSS classes in `src/index.css` and the card markup in `src/components/MainView.tsx` | `ui/components/GlassCard.kt` | `ios/ZTPreBlackout/UI/GlassCard.swift` (new) |
| Design tokens (colour, radius, type roles) | (planned; web reads `spec/design-tokens.json` or mirrors it in CSS) | `ui/theme/ZtTokens.kt` | `ios/Shared/ZtTokens.swift` (new; `spec/design-tokens.json` calls the iOS file `Theme.swift`, either name is fine, keep one) |
| Main screen | `src/components/MainView.tsx` | `ui/screens/MainScreen.kt` | `ios/ZTPreBlackout/UI/MainScreen.swift` (exists; rework) |
| Settings screen and the "?" address dialog | `src/components/SettingsView.tsx` | `ui/screens/SettingsScreen.kt` | `ios/ZTPreBlackout/UI/SettingsScreen.swift` (exists; rework) |
| Navigation | `src/components/PhoneSimulator.tsx`, `src/App.tsx` | `ui/screens/BlackoutAppNavigation.kt` | `ios/ZTPreBlackout/UI/BlackoutAppNavigation.swift` (exists) |
| Strings | `src/services/i18n.ts` | `ui/AppStrings.kt` | `ios/Shared/AppStrings.swift` (exists; add the 1.4.0 block, section 7) |
| Widgets | `src/components/WidgetSimulator.tsx` | `widget/BlackoutGlanceWidget.kt`, `widget/BlackoutWidgetReceiver.kt`, `widget/WidgetToggleReceiver.kt` | `ios/BlackoutWidgetExtension/BlackoutWidget.swift`, `ios/BlackoutWidgetExtension/WidgetIntents.swift` (exist; rework) |

Android files in `core/` that were still untracked in `git status` on 2026-11-13 (all of `core/`, `data/net/`, `data/poweron/`, `OutageRepository.kt`, `OutageStateStore.kt`, `ExactAlarm*.kt`, `GlassCard.kt`, `OutageRowFormat.kt`, `PickerSearch.kt`, `SiteStatusIndicator.kt`, `SearchablePickerField.kt`, `ZtTokens.kt`) are new in 1.4.0; their content can still change before the release tag, so port against `spec/` and the vectors, and re-diff the Kotlin at the tag.

---

## 5. Corrected facts (what the old iOS documents got wrong)

### 5.1 REM ids, city ids: two different id spaces

`IOS_HANDOVER.md` (section 3.2) says Житомирський = `4`, Бердичівський = `1`, Коростенський = `7`, Звягельський = `8`, city `20055`. **All wrong.** Id `4` is Брусилівський, `1` is Андрушівський and `7` is Житомирський. Authoritative table: `spec/rems.json` (verified 2026-11-13 against the live ztoe form, the live PowerOn `pw_otgs`, and both lookup tables). Never reuse an id from one space in the other.

| displayOrder | slug | ztoe `rem_id` | PowerOn `otg.id` | nameUk | nameEn |
|---|---|---|---|---|---|
| 1 | zhytomyr | 7 | 6 | Житомирський РЕМ | Zhytomyr REM |
| 2 | berdychiv | 3 | 3 | Бердичівський РЕМ | Berdychiv REM |
| 3 | korosten | 9 | 7 | Коростенський РЕМ | Korosten REM |
| 4 | zviahel | 16 | 11 | Звягельський РЕМ | Zviahel REM |
| 5 | malyn | 14 | 10 | Малинський РЕМ | Malyn REM |
| 6 | radomyshl | 20 | 15 | Радомишльський РЕМ | Radomyshl REM |
| 7 | andrushivka | 1 | 1 | Андрушівський РЕМ | Andrushivka REM |
| 8 | baranivka | 2 | 2 | Баранівський РЕМ | Baranivka REM |
| 9 | brusyliv | 4 | 4 | Брусилівський РЕМ | Brusyliv REM |
| 10 | korostyshiv | 11 | 8 | Коростишівський РЕМ | Korostyshiv REM |
| 11 | liubar | 13 | 9 | Любарський РЕМ | Liubar REM |
| 12 | ovruch | 17 | 12 | Овруцький РЕМ | Ovruch REM |
| 13 | olevsk | 18 | 13 | Олевський РЕМ | Olevsk REM |
| 14 | popilnia | 19 | 14 | Попільнянський РЕМ | Popilnia REM |
| 15 | pulyny | 23 | 17 | Пулинський РЕМ | Pulyny REM |
| 16 | romaniv | 21 | 16 | Романівський РЕМ | Romaniv REM |
| 17 | khoroshiv | 5 | 5 | Хорошівський РЕМ | Khoroshiv REM |
| 18 | cherniakhiv | 24 | 18 | Черняхівський РЕМ | Cherniakhiv REM |
| 19 | chudniv | 25 | 19 | Чуднівський РЕМ | Chudniv REM |

Notes: the ztoe form lists `rem_id` 1, 2, 3, 4, 5, 7, 9, 11, 13, 14, 16, 17, 18, 19, 20, 21, 23, 24, 25 (ids 6, 8, 10, 12, 15, 22 do not exist, the ids are not contiguous). PowerOn `pw_otgs` has a 20th row, id 20, the company itself; never use it as an `otg.id` for an address. Compare ids numerically (Kotlin `Int`, web strings). Generate the iOS table from `spec/rems.json` (bundle the JSON, or generate Swift from it) instead of typing it.

City (settlement) ids are likewise two spaces: Zhytomyr city is ztoe `naspunkt_id` **16657** and PowerOn city id **333** (`ZtoeStaticDirectory.kt`, `src/services/ztoeAddressLookup.ts`; the old `20055` appears nowhere in the code). PowerOn city names are **not unique** inside one REM or across REMs, and carry no type prefix (ztoe `м. Житомир` is PowerOn `Житомир`): always query `pw_cities?name=<exact>&otg.id=<otgId>` and keep every returned id as a candidate (`spec/POWERON_API.md` section 2 rule 9, section 6). Zhytomyr city has 967 streets on ztoe in the 2026-11-12 probe (a code comment says 966; `docs/review/CODE_REVIEW.md` section 16 row 1) and 997 on PowerOn.

### 5.2 Other values the old iOS documents got wrong

| Topic | Old iOS doc | Fact |
|---|---|---|
| App Group id | `group.com.ZTBlackoutPreWarning` | `group.ua.blackout.prewarning` (entitlements and code) |
| Source layout | `ios/ZTPreBlackoutNotification/...` | `ios/Shared`, `ios/ZTPreBlackout/...` (section 0) |
| Address cache | `zt_address_index_cache_v1` in `UserDefaults` | too large for `UserDefaults`; JSON file in the App Group container with a `schemaVersion` (`spec/PERSISTENCE.md` section 6) |
| Entity decoding | one-pass replacement with an order trick (`&amp;` first) | `TextNorm.decodeEntities`: up to 3 passes, numeric and 13 named entities (`spec/ADDRESS_KEY.md` section 1) |
| `nbsp` | `' '` | decodes to a plain space U+0020 |
| `all=1` request | `vulica_id=0&all=1` | see 5.5 |
| Emergency model | `emergencyStartedTitle` / `UpdatedTitle` / `ResolvedTitle`, keys with `${cityId}_${streetId}_${house}_${startTime}` | see 5.4 |
| Facebook link, name, defaults | (correct) | `"Світло в Житомирі"`, `advanceNoticeMinutes = 15`, `refreshIntervalMinutes = 30`, `https://www.facebook.com/ztoe.com.ua` stay unchanged (`CLAUDE.md` invariants) |

### 5.3 Settings keys (`spec/PERSISTENCE.md`)

The logical names are what Android really writes. The iOS repository today writes different names for three of them; on iOS read the old name once when the new one is absent, then write the new one.

| Field (spec / Android) | iOS today | Type, default |
|---|---|---|
| `city_url` | `city_url` | string, `https://www.ztoe.com.ua/unhooking-search.php` (must be listed in `valid-urls.json`) |
| `queue` | `queue` | string, `""` |
| `custom_queue_status_text` | same | string, `""` |
| `selected_address` | same | string, `""` |
| `selected_rem` | same | string, `""` (REM slug, see `rems.json`) |
| `selected_settlement` | same | string, `""` (ztoe settlement option id) |
| `selected_street` | same | string, `""` (canonical street option id; any merged id resolves) |
| `selected_house` | same | string, `""` (compared through `HouseKey`) |
| `refresh_minutes` | **`refresh_interval_minutes`** | long, 30, clamped 1 to 240 (background floor 15) |
| `advance_minutes` | **`advance_notice_minutes`** | int, 15, clamped 1 to 240 |
| `notifications_enabled` | same | bool, true (planned alerts; master switch for sound/vibration) |
| `emergency_notifications_enabled` | same | bool, true (independent of `notifications_enabled`) |
| `sound_enabled`, `vibration_enabled` | same | bool, true (forced false while both alert switches are off) |
| `prev_sound_enabled`, `prev_vibration_enabled` | same | bool, true |
| `theme_mode` | **`theme`** | string `SYSTEM` (persisted, no UI in 1.4.0) |
| `language` | same | `SYSTEM`, `UK`, `EN` |

Retired in 1.4.0: `active_emergency_outage_start`, `active_emergency_outage_restore` (iOS still writes these; read and ignore, never write data into them; the emergency state lives in the outage state store). Stores named by `spec/PERSISTENCE.md`: schedule cache `zt_schedule_cache_v2` (iOS today `zt_schedule_cache_v1`), outage state `zt_outage_state_v1`, alert registry `zt_notified_blackouts_v1` (iOS today `zt_alert_registry_v1`). The Android prefs file is `zt_user_settings_v1`. The storage names on iOS may differ; the **field names and defaults may not**. Plain `UserDefaults(suiteName: "group.ua.blackout.prewarning")` stays right for the small settings; the ledger, address index, repair list and resolved ids are JSON files.

### 5.4 Emergency events and keys (`spec/NOTIFICATIONS.md`)

Three events, one model on all platforms: `START`, `ETA_CHANGED`, `END`. `END` covers both "restored" and "cancelled"; the wording is chosen from `earlyEnd` (the record vanished before its previous estimate). Keys, with `start` and `eta` as `yyyy-MM-ddTHH:mm`:

| Event | Key |
|---|---|
| `START` | `emerg_start_<addressKey>_<startISO>` |
| `ETA_CHANGED` | `emerg_change_<addressKey>_<startISO>_<etaISO>` |
| `END` | `emerg_end_<addressKey>_<startISO>` |
| planned alert | `planned_<spanStartISO>` (address independent; with several addresses the adapter qualifies it with the address id) |

`addressKey` is opaque and whitespace-free; recommended `<remSlug>|<settlementId>|<StreetKey>|<HouseKey>`. The ledger emits each transition once; the key in the alert registry is the second line of defence (post only when the key is not in the registry, then mark it). The old iOS keys (`emerg_start_${cityId}_${streetId}_${house}_${startTime}` in the handover, `block_<date>_<start>_<end>_Q<queue>` in the code) go away: on first launch of 1.4.0 remove every pending request whose identifier starts with `block_` and clear the old registry. The emergency switch gates emergency events only; the ledger runs regardless (the UI needs it) and the adapter drops the event when the switch is off; a dropped event is not replayed later.

### 5.5 `all=1` request and response formats (two different tables)

Endpoint: `POST https://www.ztoe.com.ua/unhooking-search.php`, `Content-Type: application/x-www-form-urlencoded`, response body Windows-1251. The page also contains the REM, settlement and street `<select>` lists and, after the marker text `Графіки погодинних відключень`, the schedule tables; the address section is everything **before** that marker, rows containing `<select` or `<input` are skipped (`ZtoeAddressLookup.kt`, `parseZtoeAddressLookupTableHtml`, `parseZtoeSettlementHousesTableHtml`).

| Use | Request body | Response rows |
|---|---|---|
| Streets (and settlement list) of one settlement, plus bulk houses for the whole settlement | `rem_id=<ztoeRemId>&naspunkt_id=<ztoeNaspunktId>&all=1` (as the Kotlin code sends it; the old handover's `vulica_id=0&all=1` is not what the Android app sends) | **7 columns**: `[0]` РЕМ, `[1]` settlement, `[2]` street name (as in the street `<select>`), `[3]` **list** of houses separated by `,` or `;`, `[4]` queue number or a status text, `[5]` sub-queue, `[6]` note. A row is valid when `"<digits of [4]>.<digits of [5]>"` is one of the 12 queues; otherwise a `[4]` longer than 3 characters is a status text (`"В цей час не вимикається, за винятком випадків аварійних відключень"`, queue `""`); otherwise skip. Header rows: first cell `рем` (case-insensitive) or `[2]` contains `назва вулиці`. Map the street name to street ids with a normalised key (lower-case, `normalizeUkText`; use `StreetKey` on iOS), and index the houses under **every** matched street id. |
| Houses of one street | `rem_id=<ztoeRemId>&naspunkt_id=<ztoeNaspunktId>&vulica_id=<ztoeVulicaId>` **without** `all=1`. With `all=1` ztoe ignores `vulica_id` and returns every street of the settlement (comment in `ZtoeAddressLookup.kt`) | **3 columns**, `[Queue, Subqueue, Houses]` (`ANDROID_UPDATE_SPEC.md` section 5.1), with `Houses` a comma list such as `10, 12, 24А, 77`; the Kotlin parser also accepts `[Houses, Queue, Subqueue]` and 5+ column rows, and a colspan status row (house list plus the status text, queue `""`) for buildings without a queue. |

Rules shared by both: the queue is `"<q>.<s>"`, valid only if it is in the grid list of `spec/config.json` (`1.1` to `6.2`); entities are decoded with `TextNorm.decodeEntities`; houses are compared through `HouseKey`; houses that ztoe lists as `"будинки"` (header word) are dropped; duplicate houses keep the row that has a queue. Decoding: Windows-1251 first (ANDROID_UPDATE_SPEC says: if the decoded text contains neither `Черга` nor `Будинки`, retry as UTF-8; Not verified in the current Kotlin code). Do not parse the multi-thousand-row settlement table with a DOM parser on the main thread; use a pre-compiled `NSRegularExpression` scanner over `<tr>`/`<td>` blocks like Android, on a background task.

### 5.6 PowerOn timestamps: the `+00:00` trap

Values such as `2026-11-12T22:04:40+00:00` are **Kyiv wall-clock time with a wrong offset label** (queue 3.1 is off 22:00-24:00 on ztoe and its mirror row reads `22:04` to `00:04` `+00:00`). Rule: drop the offset, never convert.

- Parse with a regex on the string head `^\s*(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?` and build a `LocalDateTime` from year, month, day, hour, minute. Impossible dates (month 13, 31 June, 29 Feb in a non-leap year, hour 24) give `nil`. Everything after the match (`:SS`, fraction, `+00:00`, `Z`, `+02:00`) is ignored; the result has minute precision, seconds truncated.
- **Do not use** `ISO8601DateFormatter`, `Date.ISO8601FormatStyle`, `DateFormatter` with `XXX`, or `Date(timeIntervalSince1970:)` on this string: they apply the offset and are two to three hours wrong (`ISO8601DateFormatter` is the default trap). The vector `poweron_api.json` `timestamps` covers `+02:00`, `Z`, a space instead of `T`, impossible dates, garbage and empty input.
- Convert to a `Date` only at the platform edge (a trigger, a widget entry), through a `Calendar` whose `timeZone` is `Europe/Kyiv`.
- The same Kyiv wall-clock convention holds for the whole engine (`spec/README.md` "Time").

### 5.7 Windows-1251

ztoe answers in Windows-1251. The existing iOS code decodes with `CFStringEncodings.windowsCyrillic` and falls back to UTF-8; keep that, and decode **the raw bytes once** (never decode and re-encode). PowerOn returns UTF-8 JSON. After SwiftSoup or regex extraction still run `TextNorm.decodeEntities`, because ztoe double-escapes (`&amp;#039;`).

---

## 6. iOS constraints and design mapping

| Topic | Android | iOS decision |
|---|---|---|
| Exact alarms | permission, gate, receiver, fallback banner | **No exact-alarm concept.** A local notification fires at its trigger date. Do not port `ExactAlarmGate`, `ExactAlarmPermissionReceiver`, the Settings card or the Main banner, nor the strings `exactAlarm*`. Show the string `refreshFloorHint` (`Android checks at most once every 15 min`) only on Android; iOS needs its own hint (a proposal, no string exists yet). |
| Pending notification limit | 500 alarms (Android 12+) | iOS keeps **64** pending local notifications per app (`spec/config.json` `alerts.iosMaxPendingLocalNotifications`). **Rolling window of at most 40** planned alerts taken from `planAlerts(...)`, earliest `fireAt` first (`iosRollingWindowMaxPending`); the other 24 are headroom for emergency posts and later multi-address. Rebuild the window on launch, on every foreground refresh, in every `BGAppRefreshTask`, and on settings changes. Diff by key: cancel keys that left the plan, add new keys, replace a key whose `fireAt` changed, keep the rest. |
| Trigger | `setExactAndAllowWhileIdle(RTC_WAKEUP, ...)` | `UNCalendarNotificationTrigger(dateMatching: components, repeats: false)` with year, month, day, hour, minute of `fireAt` and `components.timeZone = TimeZone(identifier: "Europe/Kyiv")` (`spec/NOTIFICATIONS.md` section 1.2). `fireAt` is Kyiv wall-clock, never the device zone. Identifier = the alert key. Not verified: that a device in another zone fires at the right moment; test by changing the simulator time zone. |
| Notification text | computed at delivery | A local notification runs no code when it fires, so the text is fixed at scheduling time. `AppStrings.plannedAlertBody` takes `minutesLeft`; on iOS pass `advanceMinutes` (the alert fires exactly that long before the start). |
| Fan-out | at fire time | none; fan out at schedule time (`docs/design/MULTI_ADDRESS.md` section 12). |
| Emergency alerts | WorkManager periodic, 15 min floor, plus Doze | `BGAppRefreshTask` is opportunistic (minutes to hours, or never): emergency alerts are **best effort**. Refresh on every foreground, state the limit in the app and in the store text (`spec/NOTIFICATIONS.md` section 3). Emergency posts use the immediate trigger (`UNTimeIntervalNotificationTrigger`, the current code uses 0.2 s). The in-app limit text does not exist in `AppStrings.kt`; add it on Android first (one source of strings) or mark it as an iOS-only proposal. Not verified: the real wake-up frequency on devices. |
| Gating | two switches | `notificationsEnabled` gates planned alerts; `emergencyNotificationsEnabled` gates emergency events; sound and vibration remain global (iOS: `UNNotificationSound.default` or `nil`; no vibration API, the system decides). Android channels have no iOS equivalent: use `categoryIdentifier` values `planned` and `emergency` and the two in-app switches; `threadIdentifier` per address when multi-address arrives. |
| Widgets | alarms redraw the Glance widget | Widgets cannot tick. Build WidgetKit `TimelineEntry` values from the engine's `transitions(window, from, to)` (an entry at every transition, countdown text computed per entry, no seconds as the invariant `HHг. MMхв.` requires), set `reloadPolicy` to the next transition, and call `WidgetCenter.shared.reloadAllTimelines()` after each refresh. An overdue emergency has no known end and is excluded from `transitions`; a `mayContinue` end at `24:00` is a possibly wrong "power on" until the next table arrives (`spec/OUTAGE_ENGINE.md` section 6.3). Apple limits how often a widget may reload; the exact budget is Not verified, design for few reloads. |
| Network verdict | `NET_CAPABILITY_VALIDATED` | `NWPathMonitor`, `path.status == .satisfied` (`spec/SITE_STATE.md` section 4). No third-party probe (no "ping google"), so the privacy answers stay unchanged. Read it **after** a request failed. Keep one monitor started at launch and cache its last path; in a background task the first path update may not have arrived when the request fails (Not verified, test it). |
| Large data | `SharedPreferences` JSON | **JSON files in the App Group container**, not `UserDefaults`: the address index (REM, settlement, street with merged ids, houses; tens of thousands of house records) and the ledger. Versioned: integer `schemaVersion` at the top; a different version means discard and rebuild. Atomic writes (`.atomic`), written off the main thread. Use a file protection class that lets background tasks read after the first unlock (`completeUntilFirstUserAuthentication`); Not verified on device. The widget extension reads the same container. Bound the persisted houses (Android keeps at most 50 streets in the 1.3.4 cache). |
| HTML | Jsoup (schedule page), regex scanner (big house tables) | **SwiftSoup** for the schedule page and the small tables (adds an SPM dependency via the XcodeGen `packages:` section; today the repo has none and uses regex, so a regex-only start is also acceptable); regex scanner for the settlement table. Not verified: SwiftSoup timing on a 480 KB page on an older iPhone. |
| Time | `java.time` | A `LocalDateTime` value type (y, M, d, h, m, s) for all engine inputs and outputs; `Calendar(identifier: .gregorian)` with `TimeZone(identifier: "Europe/Kyiv")` (fallback `Europe/Kiev`, already in `KyivZone.swift`) only for elapsed time and triggers. Two DST rules from `spec/OUTAGE_ENGINE.md` section 7: a repeated wall time maps to the earlier instant, a skipped wall time shifts forward by the gap. Vectors include `2026-10-25` and `2027-03-28`. |
| Reboot | `BootCompletedReceiver` | nothing: pending local notifications survive a reboot. |
| Background backup | rules exclude caches, alarm codes, outage state | files in the App Group container are included in device backups unless marked `isExcludedFromBackup`; mark the index, ledger and caches as excluded (Not verified: the behaviour of App Group containers; check). |
| Time Sensitive | n/a | optional later for emergency alerts: needs the `com.apple.developer.usernotifications.time-sensitive` capability and an App Review justification (`docs/design/MULTI_ADDRESS.md` section 12). Not in scope for 1.4.0. |

### 6.1 Dynamic Type mapping (`spec/design-tokens.json`, `type`)

Android sizes are in sp; on iOS use the Dynamic Type text style with the weight from the token and `.monospacedDigit()` where `mono` is true. Minimum rendered size 12 pt (`typeRules.minSize`), wrapping line height at least 1.4, a no-break space between a number and its unit, tabular digits for numerics.

| Role | Size / line (sp) | Weight | Mono | iOS text style |
|---|---|---|---|---|
| `display` | 44 / 48 | 900 | yes | `largeTitle` |
| `title` | 24 / 30 | 700 | no | `title` |
| `heading` | 20 / 28 | 800 | no | `title2` |
| `subhead` | 16 / 23 | 700 | no | `headline` |
| `body` | 16 / 24 | 500 | no | `body` |
| `label` | 14 / 20 | 600 | no | `subheadline` |
| `caption` | 13 / 19 | 500 | no | `footnote` |
| `overline` | 12 / 17 | 700, tracking 0.05, uppercase | no | `caption` |
| `timeMono` | 16 / 22 | 700 | yes | `body` |
| `captionMono` | 13 / 19 | 700 | yes | `footnote` |

Colours (`color` in the same file): accent `#FF5E3A`, card `#BF141A29`, cardSolid `#141A29`, cardBorder `#26FFFFFF`, innerRow `#14FFFFFF`, inputBorder `#33FFFFFF`, divider `#1AFFFFFF`, textPrimary `#FFFFFF`, textSecondary `#B3BAE6FD`, textTertiary `#99BAE6FD`; chips green `#3310B981`/`#34D399`, amber `#33F59E0B`/`#FBBF24`, red `#33EF4444`/`#F87171`, grey `#339CA3AF`/`#9CA3AF`; drum off `#D62E26`, emergency gradient `#FFB020`, `#F28A1B`, `#C96A0B`, stripes `#8C1A1208` and `#D9FFB020`, stripe width 3, angle 45 degrees. Radii: card 24, control 16, row 14, chip 12, badge 10. Minimum touch target 48 (HIG says 44, the token is stricter, keep 48). Motion: press scale 0.96, 150 ms, respect Reduce Motion (`accessibilityReduceMotion`). Colours in `#AARRGGBB` form: alpha is the **first** byte (Android order), not CSS order; convert carefully.

---

## 7. Exact UI strings

Copied from `ui/AppStrings.kt` (Kotlin function name, then uk, then en). iOS keeps the same function names in `AppStrings.swift` (`lang` = `"uk"` or `"en"`). NBSP in the Kotlin file is U+00A0, copy it as such. Strings already in iOS and unchanged since 1.3.x (queue help steps, About texts, Roulette, Main/Settings labels not listed below) must be re-diffed against `AppStrings.kt` at the tag; only strings from the v1.4.0 blocks and the ones the spec and this port rely on are quoted here.

### 7.1 Site status (v1.4.0 block)

| Function | uk | en |
|---|---|---|
| `siteStateWithTable` | Сайт ZTOE доступний, графік опубліковано | ZTOE site online, schedule published |
| `siteStateNoTable` | Сайт ZTOE доступний, але графіка немає | ZTOE site online, but no schedule table |
| `siteStateUnreachable` | Сайт ZTOE недоступний, інтернет є | ZTOE site unreachable, your internet works |
| `siteStateNoInternet` | Немає інтернету | No internet connection |
| `siteStateChecking` | Перевірка сайту ZTOE… | Checking the ZTOE site… |
| `siteStateHintNoTable` | Графік ще не опубліковано або сторінка змінилась. | The schedule is not published yet or the page has changed. |
| `siteStateHintUnreachable` | Застосунок повторить спробу сам. | The app will retry on its own. |
| `siteStateHintNoInternet` | Перевірте з'єднання з Інтернетом. | Check your internet connection. |
| `staleDataSince(hhmm)` | Показано збережений графік (дані за HH:mm) | Showing the saved schedule (data from HH:mm) |
| `tomorrowPublished` | Графік на завтра: опубліковано | Tomorrow's schedule: published |
| `tomorrowNotPublishedShort` | Графік на завтра: ще немає | Tomorrow's schedule: not yet |
| `tomorrowNotPublished` | Графік на завтра ще не опубліковано на сайті | Tomorrow's schedule is not published on the site yet |
| `poweronUnavailable` | Аварійні відключення: дані недоступні | Emergency outages: data unavailable |

### 7.2 Outage rows

| Function | uk | en |
|---|---|---|
| `kindPlanned` | Планове | Planned |
| `kindRepair` | Планові роботи | Planned works |
| `kindEmergency` | Аварійне | Emergency |
| `rowFinished` | завершено | finished |
| `rowOverdue` | очікується відновлення | restoration pending |
| `rowFromEarlier(when)` | з {when} | from {when} |
| `rowUntilLater(when)` | до {when} | until {when} |
| `rowMayContinue` | можливе продовження | may continue |
| `tomorrowWord` / `yesterdayWord` | завтра / вчора | tomorrow / yesterday |
| `durationText` | `2 год`, `1 год 30 хв`, `45 хв` (NBSP between number and unit) | `2 h`, `1 h 30 min`, `45 min` |
| `blackoutHoursForDayHeader` | Години відключень на сьогодні: | Blackout hours for today: |
| `blackoutHoursForTomorrowHeader` | Години відключень на завтра: | Blackout hours for tomorrow: |
| `noBlackoutsScheduled` | Відключень не заплановано | No blackouts scheduled |
| `today` / `tomorrow` | Сьогодні / Завтра | Today / Tomorrow |
| `powerOn` / `powerOff` / `powerUnclear` | ЗАРАЗ СВІТЛО Є / ЗАРАЗ НЕМАЄ СВІТЛА / Невідомо | POWER IS ON / POWER IS OFF / Unclear |
| `outagesUnclear` | Графіки не діють | Outages unclear |

Note: `durationText` in the code prints minutes (`1 год 30 хв`); `spec/UI_DRUM.md` section 5 says one decimal (`1.5 год`) and `spec/NOTIFICATIONS.md` says the same. See section 9 item 3.

### 7.3 Planned alert

| Function | uk | en |
|---|---|---|
| `plannedAlertTitle` | Попередження: відключення світла | Heads-up: power outage |
| `plannedAlertBody`, minutes left > 0 | `{Черга Q: }відключення о {start} (через {N} хв)` + tail | `{Queue Q: }outage at {start} (in {N} min)` + tail |
| `plannedAlertBody`, minutes left = 0 | `{Черга Q: }відключення розпочинається зараз, о {start}` + tail | `{Queue Q: }outage is starting now, at {start}` + tail |
| tail | `, орієнтовно до {end} ({dur}).` or, when `mayContinue`, `, орієнтовно до {end} ({dur}), можливе продовження.` | `, expected until {end} ({dur}).` or `, expected until {end} ({dur}), may continue.` |

### 7.4 Emergency events

| Function | uk | en |
|---|---|---|
| `emergencyStartTitle` | Аварійне відключення | Emergency outage |
| `emergencyUpcomingTitle` | Заплановано аварійне відключення | Emergency outage scheduled |
| `emergencyStartBody`, eta known | Початок: {start}. Орієнтовне відновлення: {eta}. | Start: {start}. Estimated restoration: {eta}. |
| `emergencyStartBody`, eta unknown | Початок: {start}. Час відновлення невідомий. | Start: {start}. Restoration time unknown. |
| `emergencyChangedTitle` | Змінився час відновлення | Restoration time changed |
| `emergencyChangedBody` | Нове орієнтовне відновлення: {eta}. | New estimated restoration: {eta}. |
| `emergencyEndTitle` | Аварійне відключення завершено | Emergency outage ended |
| `emergencyEndBody` | Електропостачання за вашою адресою відновлено (початок був: {start}). | Power supply at your address has been restored (started: {start}). |
| `emergencyOutageTitle` (Main banner) | Аварійне відключення! | Emergency outage! |
| `emergencyStartLabel` | Початок: | Start: |
| `emergencyRestoreLabel` | Орієнтовне відновлення: | Estimated restoration: |
| `emergencyNotifications` (Settings switch) | Сповіщення про аварійні відключення | Emergency outage notifications |
| `emergencyHint` | Аварійні сповіщення працюють окремо від планових | Emergency alerts work separately from planned ones |

### 7.5 Main screen, widget, drum (v1.4.0 blocks)

| Function | uk | en |
|---|---|---|
| `mainUtilityName` | Житомиробленерго (ZTOE) | (same) |
| `mainLangAuto` | Авто | Auto |
| `switchOn` / `switchOff` | Увімкнено / Вимкнено | On / Off |
| `refreshing` | Оновлення… | Refreshing… |
| `staleChip(hhmm)` | дані за HH:mm | data from HH:mm |
| `drumTitle` | Шкала доби | Day timeline |
| `drumNoOutages` | відключень немає | no outages |
| `drumPowerOffAt(spans)` | без світла: {spans} | no power: {spans} |
| `drumEmergencyMark` | аварійне | emergency |
| `widgetNoOutages` | Відключень немає | No outages |
| `widgetNoMoreOutages` | Сьогодні більше немає | None more today |
| `widgetTomorrowPrefix` | Завтра | Tomorrow |

### 7.6 Settings and the address dialog (v1.4.0 block)

| Function | uk | en |
|---|---|---|
| `pickerSearchHint` | Пошук | Search |
| `pickerNothingFound` | Нічого не знайдено | Nothing found |
| `pickerLoading` | Завантаження… | Loading… |
| `pickerLoadError` | Не вдалося завантажити список | Could not load the list |
| `pickerRetry` | Повторити | Retry |
| `pickerClearSearch` | Очистити пошук | Clear search |
| `pickerClose` | Закрити | Close |
| `pickerSelected` | Обрано | Selected |
| `pickerChooseFirst` | Спочатку оберіть попереднє поле | Choose the previous field first |
| `addrFindTitle` | Пошук черги за адресою | Find Queue by Address |
| `addrRemLabel` | РЕМ | District (РЕМ) |
| `addrCityLabel` | Населений пункт | City / Settlement |
| `addrStreetLabel` | Вулиця | Street |
| `addrHouseLabel` | Будинок | House Number |
| `addrRemPlaceholder` | Оберіть РЕМ | Select district |
| `addrCityPlaceholder` | Оберіть населений пункт | Select settlement |
| `addrStreetPlaceholder` | Оберіть вулицю | Select street |
| `addrHousePlaceholder` | Оберіть будинок | Select house |
| `addrHousePrefix` | буд. | bldg. |
| `addrChecking` | Перевіряємо адресу на сайті… | Checking the address on the site… |
| `addrCheckFailed` | Не вдалося перевірити адресу на сайті. Показано збережені дані. | Could not check the address on the site. Showing saved data. |
| `addrConfirm` | Підтвердити вибір | Confirm selection |
| `addrSaved` | Адресу збережено | Address saved |
| `noQueueNotDisconnected` | Черга відсутня (не вимикається) | No queue (not disconnected) |
| `testAlertSent` | Тестове сповіщення надіслано | Test alert dispatched |
| `settingsReset` | Налаштування скинуто | Settings reset |
| `langSystem` | Системна | System |
| `notificationsHint` | Попередження за графіком: за вибраний час до початку відключення | Schedule alerts: shortly before a planned outage starts |
| `soundVibrationHint` | Звук і вібрація діють для всіх сповіщень | Sound and vibration apply to all alerts |
| `advanceNoticeHint` | Для планових сповіщень | For planned alerts |
| `rangeMinutes(from,to)` | `{from}–{to}` NBSP `хв` | `{from}–{to}` NBSP `min` |
| `refreshFloorHint` (Android only) | Android перевіряє не частіше ніж раз на 15 хв | Android checks at most once every 15 min |

Exact-alarm strings (`exactAlarmTitle`, `exactAlarmBody`, `exactAlarmButton`) are Android-only and are not ported.

### 7.7 Invariants that stay (asserted by `tests/unit.test.ts` and `ZtoeParserTest.kt`)

App name `Світло в Житомирі`; defaults 15 and 30; the 4-step queue help text and its button (`Зрозуміло` uk, `Got it` en in `queueHelpGotIt`); widget labels `СВІТЛО Є` / `СВІТЛА НЕМАЄ` (never `ЗНЕСТРУМЛЕНО`); widget countdown without seconds (`HHг. MMхв.`); Facebook link `https://www.facebook.com/ztoe.com.ua` on the Main screen; donations from `donations.json`; the main drum and the big widget produce the same 48 half-hour states. `queueHelpAddressSubtitle` uk `(Або закрийте це вікно та виберіть тільки чергу)`, en `(Or close this window and select directly)`.

---

## 8. Milestones

| | Deliverable | Acceptance |
|---|---|---|
| **M0** | This package: `docs/ios/IOS_HANDOVER_v1.4.0.md`, `docs/ios/README.md`, the bootstrap prompt (section 10). | Owner reads it; open questions in section 9 answered or accepted. |
| **M1 Core** | Swift `ios/Shared/Core/` (section 4.1), `PowerOnClient`, `PickerSearch`, `ZtoeStaticDirectory`; `SpecVectorsTests` running **all** of `spec/vectors/*.json` plus the direct entity checks; `ZtoeAddressLookup` (both `all=1` formats) and its parser tests with saved HTML fixtures. | `xcodebuild test` green on a macOS runner with every vector case executed (assert the case counts 22, 9, 9+5+2, 8+5+6+5+9, 12 so a skipped file fails). No UI change yet. |
| **M2 UI** | Today and Tomorrow tabs, midnight rows with the far-side date and `з dd.MM HH:mm` tag, drum with emergency stripes and the grey unclear style, site status chip and banners, searchable picker (`.searchable`, `PickerSearch` ranking), emergency toggle card, Card 1b/1c with live data, Dynamic Type roles. | Screens match `spec/UI_DRUM.md` and the Android 1.4.0 screenshots (to be produced); accessibility check at the largest Dynamic Type size; Reduce Motion respected. |
| **M3 Notifications** | `NotificationPlanner` (rolling window of at most 40 from `planAlerts`, key diff), emergency events from `EmergencyLedger` posted immediately, `BackgroundSyncManager` doing the full refresh (ztoe + PowerOn + ledger), migration of old `block_*` requests and registry, old-key settings migration. | A test that feeds the vectors' alert plans and asserts the pending set; manual test on a device with 41+ alerts; emergency alert after a background refresh and after a foreground refresh. |
| **M4 Widgets** | `WidgetKit` timelines from `transitions(window)`, `OutageRowFormat` in the widget, 48-state parity with the drum, bell and refresh intents kept. | Widget shows the same state as the app at each transition (simulator time travel); no countdown seconds. |
| **M5 Release** | Apple Developer Program account; confirm bundle ids `ua.blackout.prewarning` and `ua.blackout.prewarning.widget` and register App Group `group.ua.blackout.prewarning` in the portal for both targets; Team ID in `project.yml` (`DEVELOPMENT_TEAM`); signing in CI (certificate, provisioning profiles as secrets); `xcodebuild archive` then `-exportArchive` with an export options plist (App Store method), upload to App Store Connect (API key; tool to be chosen when doing it, Not verified which is current), TestFlight internal then external; fix the hard-coded Info.plist version (use `$(MARKETING_VERSION)` and `$(CURRENT_PROJECT_VERSION)`); check the minimum Xcode/SDK that App Store Connect accepts in November 2026 (the workflow pins Xcode 15.4 on `macos-14`, which may be too old; Not verified). **App Review items:** (1) **age rating**: the "Житомирська Рулетка" scratch-ticket mini-game is simulated gambling (virtual points, no money); answer the age-rating questionnaire for simulated gambling accordingly and expect the rating to rise; confirm there is no real-money or purchase path; (2) **privacy labels**: the app contacts `www.ztoe.com.ua` and `api-ztoe-poweron.inneti.net`, has no account, no analytics, no tracking; PowerOn queries carry street ids (not the house number, which is filtered on the device) and the device IP is visible to the server operator, a third party; declare per Apple's definitions and name the host in the privacy policy (`docs/review/CODE_REVIEW.md` finding C22: the policy names only ztoe.com.ua, fix it first); keep `PrivacyInfo.xcprivacy` (app and widget) in line with the required-reason APIs actually used (`UserDefaults`, file timestamps, boot time if used); (3) **unofficial-app wording**: the disclaimer exists in `disclaimerText` (data is loaded from ztoe.com.ua, the app is not an official service of Zhytomyroblenergo); repeat it in the store description and avoid the company logo; (4) **Ukrainian listing**: name `Світло в Житомирі`, subtitle, description, keywords and screenshots in Ukrainian first, English second; support URL and privacy policy URL; if emergency alerts are marketed, state the best-effort limit. | A build processed by App Store Connect and installable from TestFlight by the owner. |
| **M6 Emergency push and shared index** | **Decision** (owner, before any server work): (A) polling only with the limit stated (this release); (B) relay holding push token, street ids and house (privacy and policy change); (C) topic push, one APNs topic per PowerOn street id, a scheduled job polls PowerOn and publishes, clients subscribe by street id and filter the house locally so the server never learns the house; recommended in `spec/NOTIFICATIONS.md`, changes the privacy policy and needs an APNs key and a server. The ledger and alert keys are transport independent. Then the **shared deduplicated address index** (one canonical JSON of REM, settlement, street with merged ids, houses, built once by a script and consumed by Android, web and iOS instead of every device pulling the 15 000-row tables from ztoe) and **multi-address** from `docs/design/MULTI_ADDRESS.md` (up to 5 addresses, separate planned/emergency toggles, `subscriptions_v1.json` in the App Group container, alert id `planned_{firstAddressId}_{startInstant}` with one merged notification for addresses that share a span (owner decision 3), `threadIdentifier = addressId`, WidgetKit `AppIntentConfiguration` with an `AppEntity`). | Owner decision recorded; design draft is "not implemented" on all platforms today. |

### 8.1 Decision gate: how the iOS code gets `spec/`

The vectors only help if iOS runs the **same files**. Options (owner decides before M1):

| Option | How | Pros | Cons |
|---|---|---|---|
| Monorepo | move `ios/` into this repository; CI runs `npm test`, Gradle and `xcodebuild test` against one `spec/`; XcodeGen test target adds `../spec/vectors` as a folder resource | one source of truth, one PR changes spec, Kotlin, TS and Swift together | the iOS repo (and its release history, v1.3.3) must be merged or archived; macOS runner time in the same pipeline |
| Submodule | keep the iOS repo; add this repo's `spec/` as a git submodule (or a sparse subtree) pinned to a tag such as `spec-v1`; test target resource points at it | keeps two repos and separate release cadence | submodule pinning discipline; a spec change needs a pointer bump in iOS; contributors must run `git submodule update` |
| Copy plus drift check | copy `spec/` into the iOS repo and have CI fail when its hash differs from the source repo's tagged copy | simplest tooling | drift is detected late and merged by hand |

Facts for the decision: the iOS repo already tracks a stale copy of `android/`, the web workbench and `tests/unit.test.ts`, and its CI runs `npm test` first, so the iOS repo has the same drift problem today (section 0).

---

## 9. Open questions and discrepancies found while writing (flag to the owner)

1. **Strings: spec versus Kotlin.** `spec/NOTIFICATIONS.md` calls four emergency titles normative (`Аварійне відключення`, `Змінився час відновлення`, `Світло повернулося`, `Аварійне відключення скасовано`; en `Emergency outage`, `Restore time changed`, `Power is back`, `Emergency outage cancelled`) and has two `END` titles chosen from `earlyEnd`. `AppStrings.kt` has one `END` title (`Аварійне відключення завершено` / `Emergency outage ended`) and en `Restoration time changed`. `plannedAlertTitle` en is `Heads-up: power outage` (spec proposal: `Warning: power outage`); `plannedAlertBody` has a queue prefix and `(через N хв)` (spec: no queue prefix). `poweronUnavailable` is `Аварійні відключення: дані недоступні` (spec: `Аварійні: недоступні`). `tomorrowPublished` starts with a capital letter in code, lower case in the spec. Until the owner reconciles them, **iOS follows `AppStrings.kt` at the release tag**.
2. `emergencyRestoreLabel` en is `Estimated restoration:` in the code; the changelog and old handover say `Estimated restore:`.
3. Duration format: code prints `1 год 30 хв`; `spec/UI_DRUM.md` and `spec/NOTIFICATIONS.md` say one decimal (`1.5 год`) and note it has no vector. Follow the code (`durationText`) unless the owner changes it.
4. `spec/` mentions `strings.json` export tests (`docs/review/CODE_REVIEW.md` section 15); no `spec/strings.json` exists on 2026-11-13. Strings are not machine-checked yet.
5. `docs/review/CODE_REVIEW.md` section 16 lists further inconsistencies (Android SDK 35 vs 36, versionCode offset); none affect iOS.
6. iOS `Info.plist` says 1.3.4, `project.yml` says 1.3.5, the release is v1.3.3 (section 0).
7. Not verified: whether the first-launch language switcher and the `"Обрати чергу"` navigation exist in iOS `BlackoutAppNavigation.swift`; whether App Group containers are included in backups; WidgetKit reload budget; background-task wake-up frequency; the minimum Xcode/SDK accepted by App Store Connect in November 2026; availability of the bundle ids in App Store Connect.

---

## 10. Bootstrap prompt (copy into the AI Studio / Claude session that does the port)

```text
You are porting release 1.4.0 of "Світло в Житомирі" (app name never changes) to the native iOS app in
https://github.com/IgorZaharov/iOS-ZTPreBlackoutNotification (Swift 5.10, SwiftUI, WidgetKit, XcodeGen, iOS 17+).
The contract is the spec/ folder of https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning (branch/tag 1.4.0).
Read, in this order: docs/ios/IOS_HANDOVER_v1.4.0.md (this handover: it corrects the old IOS_HANDOVER.md and
ANDROID_UPDATE_SPEC.md), spec/README.md, spec/config.json, spec/rems.json, spec/OUTAGE_ENGINE.md, spec/ADDRESS_KEY.md,
spec/POWERON_API.md, spec/NOTIFICATIONS.md, spec/SITE_STATE.md, spec/UI_DRUM.md, spec/PERSISTENCE.md,
spec/design-tokens.json. Where a document and the Kotlin code disagree, spec/ wins; for UI strings the Kotlin file
android/.../ui/AppStrings.kt at the release tag wins (handover section 9).

RULES
1. Work against spec/vectors FIRST. Milestone M1 is the Swift core in ios/Shared/Core/ (OutageModels, OutageEngine,
   KyivTime, EmergencyLedger, PowerOnMapper, AddressKeys, SiteState) plus an XCTest target (ZTPreBlackoutTests/
   SpecVectorsTests.swift) that loads the JSON files in spec/vectors/ (outage_engine 22 cases, emergency_ledger 9,
   poweron_api 9+5+2, address_keys 8+5+6+5+9, site_state 12) and the direct entity checks, and asserts the case
   counts so a skipped vector fails. Never copy expected values into Swift by hand. No UI work until every vector
   passes. Do not edit anything under spec/; if a vector looks wrong, report it instead of changing it.
2. Keep names aligned with the mapping table (handover section 4): same type and function names as the Kotlin core
   (OutageEngine.buildPlanned/resolveEmergency/inWindow/spans/dayView/status/planAlerts/transitions,
   EmergencyLedger.reconcile, PowerOnMapper.parseTime/emergencyRecordsFor/repairOutagesFor, StreetKey.of,
   HouseKey, SiteStateResolver.resolve) so diffs against Kotlin stay readable. New pure files go to
   ios/Shared/Core/, data-layer files stay flat in ios/Shared/, views in ios/ZTPreBlackout/UI/,
   notification code in ios/ZTPreBlackout/Notifications/. Existing files are extended, not renamed.
3. Time: engine instants are a LocalDateTime value type in Europe/Kyiv, never Date. PowerOn timestamps: drop the
   offset, never convert; NEVER use ISO8601DateFormatter, ISO8601FormatStyle or Date parsing on them (it is 2-3 hours
   wrong); use the regex in handover section 5.6. Convert to Date only at the edge (notification trigger, widget
   entry) with a Calendar in Europe/Kyiv (fallback Europe/Kiev).
4. IDs: ztoe rem_id and PowerOn otg.id are different id spaces; generate the REM table from spec/rems.json.
   Zhytomyr city is ztoe naspunkt_id 16657 and PowerOn city 333. The old ids 4/1/7/8 and 20055 are wrong.
   App Group is group.ua.blackout.prewarning.
5. ztoe: POST application/x-www-form-urlencoded, Windows-1251. Settlement bulk request is
   rem_id=&naspunkt_id=&all=1 (7-column rows, house cell is a comma list); per-street request is
   rem_id=&naspunkt_id=&vulica_id= WITHOUT all=1 (3-column rows). Use TextNorm.decodeEntities after extraction.
   Parse the large settlement table with a pre-compiled regex scanner off the main thread; SwiftSoup is for the
   schedule page and small tables.
6. PowerOn: GET with dotted filters only (street.id[]=, switchSubReason[]=0,1,3, datePlanIn[after]=YYYY-MM-DD),
   pagination=false, Accept: application/ld+json, 8 s timeouts, 60 s cache. Result is Confirmed or Unavailable;
   Unavailable never means "no emergency" and never changes the ledger.
7. Persistence: field names and defaults from spec/PERSISTENCE.md (iOS today writes advance_notice_minutes,
   refresh_interval_minutes, theme: read them once, write advance_minutes, refresh_minutes, theme_mode). The address
   index and the ledger are versioned JSON files (schemaVersion) in the App Group container, not UserDefaults.
8. Notifications: no exact-alarm code on iOS. Planned alerts come from planAlerts(); keep a rolling window of at most
   40 pending requests (earliest first, diff by key, identifier = key, UNCalendarNotificationTrigger with
   components.timeZone = Europe/Kyiv). Emergency events come from EmergencyLedger and are gated by
   emergencyNotificationsEnabled only; they are best effort (BGAppRefreshTask is opportunistic), refresh also on
   every foreground. Remove old block_* pending requests on first launch of 1.4.0.
9. Widgets cannot tick: build WidgetKit timelines from transitions(window, from, to); countdown text without
   seconds (HHг. MMхв.). Network verdict for NO_INTERNET is NWPathMonitor (status == .satisfied), no third-party
   probe.
10. UI: Today and Tomorrow tabs (Tomorrow always present, grey drum plus notice when not published), midnight rows,
    drum with emergency stripes, site status chip and banner, .searchable address picker filtered with
    PickerSearch (not the native substring match), separate emergency toggle card. Use spec/design-tokens.json for
    colours, radii and Dynamic Type roles (handover section 6.1). Quote UI strings exactly from AppStrings.kt
    (handover section 7); do not invent or translate strings; add a string on Android first if one is missing.
11. Do not push to the Android repository, do not change valid-urls.json or donations.json semantics, keep the
    invariants listed in handover section 7.7, and mark anything you could not verify as "Not verified" in your
    report.

DELIVER per milestone: M1 core + vectors green, M2 UI, M3 notifications, M4 widgets (handover section 8). Report after
each milestone: files added or changed, test output (case counts), and open questions.
```

## Addendum (late 1.4.0 additions)

| Feature | Android | Web | iOS (proposed) |
|---|---|---|---|
| **ztoe site notice card.** When the page has no table, the «УВАГА! ВАЖЛИВА ІНФОРМАЦІЯ!» text is quoted in an information card on the main screen (`spec/SITE_STATE.md`, section "Site notice"; vectors `spec/vectors/site_notice.json`) | `core/SiteNotice.kt`, `SiteNoticeCard` in `ui/components/SiteStatusIndicator.kt` | `src/core/siteNotice.ts`, `MainView.tsx` | `Core/SiteNotice.swift` (regex, not SwiftSoup, so the vectors match), card in the main view |
| **Third widget, 4×1 «Графік».** The 24 h drum with the needle, no buttons, tap opens the app; when the cell is at least 84 pt tall one line with queue, status and countdown sits above the drum; same 48 cells as the other widgets and the same drum height as the big widget (52 pt), centred vertically, not stretched | `BlackoutStripGlanceWidget` / `BlackoutStripWidgetReceiver` in `widget/`, `res/xml/blackout_widget_strip_info.xml`, `res/drawable/widget_preview_strip.xml` | `WidgetSimulator.tsx` | WidgetKit `.systemMedium` is 2 rows high; use an accessory or a `.systemMedium` timeline view with only the drum (decision at M4) |
| **Emergency END wording.** `earlyEnd = true` → «Аварійне відключення скасовано» / «Відключення зникло зі списку до {eta}: світло, імовірно, вже є.»; the strings in `spec/NOTIFICATIONS.md` 1.3 and 2.5 are now the shipped ones (the discrepancies in section 9 are resolved in favour of the code, plus this earlyEnd case) | `AppStrings.emergencyEarlyEnd*`, `NotificationHelper.postEmergencyEvents` | `i18n.ts`, `alertManager.ts` | same strings |
