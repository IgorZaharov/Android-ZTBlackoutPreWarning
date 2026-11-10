# Comprehensive iOS Handover Specification — Світло в Житомирі (`iOS-ZTPreBlackoutNotification`)

**Target iOS Repository:** `https://github.com/IgorZaharov/iOS-ZTPreBlackoutNotification`  
**Source Android/Workbench Repository:** `https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning`  
**Current Release Version:** `v1.3.4` (`MARKETING_VERSION = "1.3.4"`)  
**Target Platform:** Native iOS 17.0+ (`Swift 5.10`, `SwiftUI`, `WidgetKit`, `AppIntents`, `AVFoundation`, `UserNotifications`, `BackgroundTasks`) + Interactive 16:10 iPhone Emulator in Google AI Studio (React 19 + TypeScript + Vite)

---

## 1. Overview of Today's Changes (`v1.3.4` Update Summary)

This document specifies all features, UI/UX refinements, button placements, exact Ukrainian/English strings, background prefetch & settlement-wide bulk indexing logic, HTML entity decoding, and file-by-file mappings implemented today so they can be ported with **100% behavioral and visual parity** to the parallel iOS project (`https://github.com/IgorZaharov/iOS-ZTPreBlackoutNotification`).

### Summary of Today's Key Changes:
1. **Independent Emergency Outage Notifications Switch (`emergencyNotificationsEnabled`)**:
   - Renamed to **UK:** `"Сповіщення про аварійні відключення"`, **EN:** `"Emergency outage notifications"` with multi-line word wrapping so the caption never truncates or collides with the switch.
   - Placed in its own dedicated frosted-glass card (**Card 4b**) directly below the main Notifications card (**Card 4**) in Settings.
   - Always visible (even when no emergency outages are active), defaults to **ON (`true`)**, respects the Sound (`soundEnabled`) and Vibration (`vibrationEnabled`) switches when firing notifications, and **remains ON** when the user turns off the regular scheduled-outage Notification switch in Settings, Main Screen, or Home Screen Widgets.
2. **Zero-Delay `"?"` Address Lookup via Background Prefetch on Launch, Bulk Settlement-Wide House Indexing (`all=1`), Fast Regex Parsing & Disk Cache**:
   - Added persistent disk caching (`zt_address_index_cache_v1` in `localStorage` / `SharedPreferences` / `UserDefaults`) hydrated synchronously into memory on startup (`hydrateCacheFromDisk`) and persisted asynchronously off the main thread (`persistCacheToDisk`).
   - Added automatic background prefetching on app launch (`prefetchAddressIndexInBackground`) for all 19 REMs, their settlements/cities, the active/default city's streets, and all houses in the active/default settlement.
   - Eliminated the 5-second delay when loading all houses in the House dropdown by introducing **settlement-wide bulk house indexing** (`all=1` + `parseZtoeSettlementHousesTableHtml` / `fetchZtoeHousesByCity` / `ensureCityHousesIndexed`): a single `POST` request with `rem_id=<remId>&naspunkt_id=<cityId>&vulica_id=0&all=1` downloads the entire settlement's 7-column house table and indexes every street's houses in memory (`cityHousesBulkFetchedIds`) and on disk as soon as the settlement's streets load.
   - Separated the street-loading `useEffect` and house-loading `useEffect` in `SettingsView.tsx` / `SettingsScreen.kt` so selecting a street reads pre-indexed houses in `0ms` without resetting or re-fetching the street list, and replaced full-DOM Jsoup parsing on multi-thousand-row house tables in `ZtoeAddressLookup.kt` with a fast pre-compiled regex cell scanner.
3. **HTML Entity & Apostrophe Decoding (`&#039;` / `&amp;#039;` -> `'`) in City, Street & House Selectors**:
   - Added `decodeZtoeHtmlEntities(raw)` to decode `&#039;`, `&#39;`, `&#x27;`, `&apos;`, and double-escaped `&amp;#039;` into a standard apostrophe (`'`) across all REM, City, Street, and House parsers, during disk cache hydration (`hydrateCacheFromDisk`), and in dropdown option labels.
4. **Main Screen Emergency Outage Bar (`Card 1c`): Right-Aligned Start & Finish Timestamps Symmetrical to Descriptions**:
   - Positioned as a standalone frosted-glass card above the Hero Outage Status Card.
   - Start (`"Початок:"` / `"Start:"`) and estimated finish (`"Орієнтовне відновлення:"` / `"Estimated restore:"`) rows use space-between horizontal alignment with left-aligned grey descriptions and right-aligned (`text-right` / `TextAlign.End`), `tabular-nums` (`monospacedDigit()`) timestamps.
5. **`"?"` Button Placement, Subtitle, Live Refresh on Entry & `"Обрати чергу"` / `"Apply Queue"` Navigation**:
   - Matched the `"?"` button in Settings Card 1 (`40x40dp`, `16dp` corner radius, solid `#FF5E3A` background, white bold `"?"`, right-aligned across from title/description).
   - Added subtitle under `"Пошук черги за адресою"` / `"Find queue by address"`: **UK:** `"(Або закрийте це вікно та виберіть тільки чергу)"`, **EN:** `"(Or close this window and select directly)"`.
   - Entering the `"?"` modal immediately shows cached lists (`0ms`) while triggering a silent background refresh (`forceRefresh = true`) of REMs, Cities, Streets, and Houses.
   - Clicking `"Обрати чергу"` / `"Apply Queue"` in the `"?"` modal applies the selected address/queue, closes the modal, and **always navigates to the Main Screen**.
6. **100% UI Parity Between Android Build, Workbench & iOS Port + Version Bump to `v1.3.4`**:
   - Verified and aligned every card border (`1dp` `rgba(255,255,255,0.15)`), corner radius (`24dp` cards, `16dp` buttons/inputs, `12dp`/`9dp` language segmented control), icon placement, empty-queue header placeholder (`minHeight = 44dp`), standalone custom status bar (`Card 1b`), standalone emergency outage bar (`Card 1c`), and centered `--:--:--` empty counter when a building has no queue.
   - Raised version to `1.3.4` (`v1.3.4`) across all manifests, build scripts, About screens, `README.md`, `CHANGELOG.md`, and unit tests.

---

## 2. File-by-File Mapping (Web Workbench <-> Android <-> iOS Port)

Use this mapping table to locate the exact reference implementation in this repository and port it to the corresponding Swift file in `https://github.com/IgorZaharov/iOS-ZTPreBlackoutNotification`:

| Subsystem / Feature | Web Workbench Reference (`/src`) | Android Kotlin Reference (`/android/.../ua/blackout/prewarning`) | Target iOS Swift File (`/ios/ZTPreBlackoutNotification`) |
|---|---|---|---|
| **ZTOE Address Lookup, Bulk House Indexing (`all=1`), Background Prefetch, Disk Cache & `&#039;` Decoding** | `src/services/ztoeAddressLookup.ts` | `data/parser/ZtoeAddressLookup.kt` | `Data/Parser/ZtoeAddressLookup.swift` |
| **ZTOE Schedule HTML Parser & Emergency Overlay** | `src/services/ztoeParser.ts` | `data/parser/ZtoeParser.kt`, `data/repository/ScheduleRepository.kt` | `Data/Parser/ZtoeParser.swift`, `Data/Repository/ScheduleRepository.swift` |
| **Data Models & Default Settings (`emergencyNotificationsEnabled = true`, `queue = ""`, `language = "SYSTEM"`)** | `src/types.ts` | `data/model/Models.kt` | `Data/Model/Models.swift` |
| **Settings Persistence & Master Toggle Isolation** | `src/App.tsx` (`localStorage` `zt_settings_v4`) | `data/repository/SettingsRepository.kt` (`SharedPreferences` `zt_user_settings_v1`) | `Data/Repository/SettingsRepository.swift` (`UserDefaults(suiteName: "group.com.ZTBlackoutPreWarning")`) |
| **Scheduled & Independent Emergency Outage Notifications** | `src/services/alertManager.ts` | `notification/AlarmScheduler.kt`, `notification/NotificationHelper.kt`, `worker/ScheduleSyncWorker.kt`, `data/repository/AlertRegistry.kt` | `Notification/NotificationScheduler.swift`, `Data/Repository/AlertRegistry.swift` |
| **Bilingual Strings (`uk` / `en`)** | `src/constants/translations.ts` | `ui/AppStrings.kt` | `UI/AppStrings.swift` |
| **Main Screen (Header, Card 1b Custom Status, Card 1c Symmetrical Emergency Banner, Card 2 Hero Countdown, 24h Drum Chart)** | `src/components/MainView.tsx` | `ui/screens/MainScreen.kt`, `ui/components/TimelineBar.kt` | `UI/Screens/MainScreen.swift`, `UI/Components/TimelineBar.swift` |
| **Settings Screen (`"?"` Button, `"?"` Address Lookup Modal, Card 4 Notifications, Card 4b Emergency Switch, Card 5 Language, Card 6 Actions)** | `src/components/SettingsView.tsx` | `ui/screens/SettingsScreen.kt` | `UI/Screens/SettingsScreen.swift` |
| **Top-Level Navigation, First-Launch Unselected Queue Overlay & Launch Prefetch Trigger** | `src/components/PhoneSimulator.tsx`, `src/App.tsx` | `ui/screens/BlackoutAppNavigation.kt` | `UI/Screens/BlackoutAppNavigation.swift` |
| **About Screen (`v1.3.4` Badge, Links, Charity, Roulette Trigger)** | `src/components/AboutView.tsx` | `ui/screens/AboutScreen.kt` | `UI/Screens/AboutScreen.swift` |
| **Home Screen Widgets (Small `2x1` & Medium `4x2` with Emergency `!` Indicator)** | `src/components/WidgetSimulator.tsx` | `widget/BlackoutGlanceWidget.kt`, `widget/BlackoutWidgetReceiver.kt` | `BlackoutWidgetExtension/BlackoutWidget.swift` (`WidgetKit`) |
| **Житомирська Рулетка Mini-Game** | `src/components/ZhytomyrRouletteModal.tsx`, `src/services/rouletteGame.ts`, `src/services/rouletteAudio.ts` | `ui/screens/ZhytomyrRouletteScreen.kt` | `UI/Screens/ZhytomyrRouletteScreen.swift`, `Services/RouletteAudioEngine.swift` |

---

## 3. Detailed Specification of Today's Changes

### 3.1 Independent Emergency Outage Notifications Switch (`emergencyNotificationsEnabled`)

#### What It Does (Business Logic)
1. **Data Model (`Models.swift` / `types.ts` / `Models.kt`)**:
   - `UserSettings` includes `emergencyNotificationsEnabled: Bool = true` (default `true`).
   - Persisted under key `"emergency_notifications_enabled"` in `SettingsRepository`.
2. **Complete Independence from Regular Notifications Switch**:
   - Toggling `notificationsEnabled` OFF (via Settings Card 4, the Main Screen top-right bell button, or the Home Screen Widget bell button) **only** disables scheduled pre-warning outage notifications and saves/mutes `soundEnabled` and `vibrationEnabled` for the master switch memory. It **never** sets `emergencyNotificationsEnabled = false`.
   - Even when `notificationsEnabled == false`, if `emergencyNotificationsEnabled == true`, the app continues to monitor and send notifications for emergency outage state transitions:
     - **Emergency Outage Started**: When `activeEmergencyOutage` transitions from `nil` to non-nil (key `emerg_start_${cityId}_${streetId}_${house}_${startTime}`).
     - **Emergency Restoration Time Changed**: When `activeEmergencyOutage.endTime` changes while the same outage is active (key `emerg_change_${cityId}_${streetId}_${house}_${startTime}_${newEndTime}`).
     - **Emergency Outage Cancelled / Resolved**: When `activeEmergencyOutage` transitions from non-nil to `nil` (key `emerg_end_${cityId}_${streetId}_${house}_${prevStartTime}`).
3. **Sound & Vibration Coupling**:
   - When an emergency outage notification fires, it checks `settings.soundEnabled` (`UNNotificationSound.default` vs `nil`) and `settings.vibrationEnabled` so the user's sound/vibration preferences are respected.
4. **Reset to Defaults**:
   - Resetting settings in Card 6 restores `emergencyNotificationsEnabled = true`.

#### Exact Text Labels (`AppStrings.swift` / `translations.ts` / `AppStrings.kt`)
- **Key**: `emergencyOutageAlerts`
  - **Ukrainian (`uk`)**: `"Сповіщення про аварійні відключення"`
  - **English (`en`)**: `"Emergency outage notifications"`
- **Notification Titles & Bodies**:
  - `emergencyStartedTitle`: **UK:** `"Аварійне відключення!"` | **EN:** `"Emergency outage!"`
  - `emergencyUpdatedTitle`: **UK:** `"Зміна часу аварійного відключення"` | **EN:** `"Emergency outage time updated"`
  - `emergencyResolvedTitle`: **UK:** `"Аварійне відключення скасовано"` | **EN:** `"Emergency outage resolved"`

#### How It Looks & Exact Placement (`SettingsView.tsx` / `SettingsScreen.kt` / `SettingsScreen.swift`)
- **Placement**: Rendered as **Card 4b**, a standalone card placed immediately below **Card 4 (Notifications)** (`16dp` vertical spacing between cards) and above **Card 5 (Language)**. Always visible regardless of whether an emergency outage is currently active.
- **Card Container**:
  - Background: `#141A29` at `75%` opacity (`Color(red: 0.078, green: 0.102, blue: 0.161).opacity(0.75)`)
  - Corner radius: `24pt` (`RoundedCornerShape(24.dp)` / `rounded-3xl`)
  - Border: `1pt` solid `Color.white.opacity(0.15)` (`Color(0x26FFFFFF)` / `border-white/15`)
  - Padding: `20pt` (`padding(20.dp)` / `p-5`)
- **Internal Row Layout**:
  - Horizontal row (`HStack` / `Row` / `flex items-center justify-between gap-3`) with `12pt` gap between the left label group and the right switch.
  - **Left side** (`weight(1f)` / `flex-1 min-w-0` so text wraps instead of pushing the switch off-screen):
    - Leading Bell icon (`Notifications` / SF Symbol `bell`, `18pt`, color `#9CA3AF` / `Color(0xFF9CA3AF)`).
    - `12pt` horizontal spacer.
    - Multi-line wrapped label (`"Сповіщення про аварійні відключення"` / `"Emergency outage notifications"`), `14sp` (`text-sm`), medium weight (`FontWeight.Medium`), color `#E5E7EB` (`Color(0xFFE5E7EB)`), `lineHeight = 18sp` (`leading-snug`), unlimited lines with word wrapping (`fixedSize(horizontal: false, vertical: true)`).
  - **Right side**:
    - Custom pill toggle switch (`48x24pt` / `w-12 h-6`, corner radius `12pt`):
      - Track color when ON: `#FF5E3A` (`Color(0xFFFF5E3A)`)
      - Track color when OFF: `Color.white.opacity(0.10)` (`Color(0x1AFFFFFF)`)
      - Thumb: `16x16pt` (`w-4 h-4`) white circle, offset `4pt` from left when OFF and `28pt` from left (`+24pt` translation) when ON.

---

### 3.2 Background Prefetch on Launch, Bulk Settlement-Wide House Indexing (`all=1`), Fast Regex Parser & Disk Cache

#### Problem Solved
Previously, when a user opened the `"?"` Address Lookup modal and selected a street in a large settlement like Zhytomyr (`м. Житомир`, `cityId = "20055"`), fetching and parsing the HTML table for houses took ~5 seconds because:
1. ZTOE's server returns a large multi-thousand-row HTML table.
2. Parsing a multi-thousand-row `<table>` into a full DOM tree on the main thread blocked the UI.
3. In `SettingsView.tsx`, `lookupStreetId` was inside the dependency array of the street-loading `useEffect`, causing streets to re-evaluate whenever a street was selected.

#### Complete 4-Part Solution (`ztoeAddressLookup.ts` & `ZtoeAddressLookup.kt` -> `ZtoeAddressLookup.swift`)

1. **On-Device Persistent Disk Cache (`zt_address_index_cache_v1`)**:
   - Schema (`AddressIndexDiskCache`):
     ```ts
     interface AddressIndexDiskCache {
       version: 1;
       updatedAtMs: number;
       rems: ZtoeRemOption[];
       citiesByRem: Record<string, ZtoeCityOption[]>;
       streetsByCity: Record<string, ZtoeStreetOption[]>;
       housesByCityStreet: Record<string, ZtoeHouseLookupResult[]>;
       cityHousesBulkFetched?: string[]; // cityIds whose entire house table is indexed
     }
     ```
   - **Synchronous Hydration on Module Init (`hydrateCacheFromDisk`)**:
     - Executed immediately when `ztoeAddressLookup` is imported/initialized.
     - Populates `remsCache`, `citiesCache`, `streetsCache`, `housesCache`, and `cityHousesBulkFetchedIds` in memory, running `decodeZtoeHtmlEntities` on every cached name so `getCachedZtoeRems()`, `getCachedZtoeCities(remId)`, `getCachedZtoeStreets(cityId)`, and `getCachedZtoeHouses(cityId, streetId)` return in **`0ms`**.
   - **Asynchronous Non-Blocking Persistence (`persistCacheToDisk`)**:
     - Debounced/scheduled off the main thread (`setTimeout(..., 0)` in TypeScript, `CoroutineScope(Dispatchers.IO).launch` in Kotlin, `Task.detached(priority: .utility)` in Swift) so serializing 15,000+ house records never blocks UI rendering.
     - Caps `housesByCityStreet` at `MAX_DISK_CACHED_STREETS = 2500` streets so an entire city (e.g., Zhytomyr's ~1,000 streets) fits comfortably on disk.

2. **Settlement-Wide Bulk House Indexing (`all=1` + `parseZtoeSettlementHousesTableHtml` / `fetchZtoeHousesByCity` / `ensureCityHousesIndexed`)**:
   - **How ZTOE's `all=1` Endpoint Works**:
     - Sending `POST` to `https://www.ztoe.com.ua/unhooking-search.php` with form body:
       `rem_id=<remId>&naspunkt_id=<cityId>&vulica_id=0&all=1`
       returns a single HTML table containing **every building across every street in that settlement**.
     - Each data `<tr>` in the settlement-wide table has **7 `<td>` columns**:
       - `cells[0]`: РЕМ
       - `cells[1]`: Населений пункт (Settlement)
       - `cells[2]`: Вулиця (Street name, e.g., `"вул. Київська"`)
       - `cells[3]`: Будинок (House number, e.g., `"37"`)
       - `cells[4]`: Черга (Queue `1`..`6` or status text)
       - `cells[5]`: Підчерга (Sub-queue `1`..`2`)
       - `cells[6]`: Примітка / Статус (Optional note/status)
   - **Street Name Normalization & Mapping (`normalizeStreetLookupKey`)**:
     - Lowercases text, decodes HTML entities, normalizes apostrophes (`’`, `'`, `` ` ``, `ʼ` -> `'`), and strips trailing punctuation so `cells[2]` matches `ZtoeStreetOption.name` in `streetsCache.get(cityId)`.
     - Groups all parsed `ZtoeHouseLookupResult` rows by `streetId` (`Record<string, ZtoeHouseLookupResult[]>`), sorts each street's houses with natural numeric sorting (`localeCompare(..., 'uk', { numeric: true })`), stores them into `housesCache.set("${cityId}|${streetId}", houses)`, and adds `cityId` to `cityHousesBulkFetchedIds`.
     - For any street in `streets` that had zero rows in the table, stores `housesCache.set("${cityId}|${street.id}", [])` so the app knows it was already indexed and does not re-fetch.
   - **Automatic Trigger When Streets Are Loaded (`ensureCityHousesIndexed`)**:
     - Inside `fetchZtoeStreets(siteUrl, cityId, remId, forceRefresh)`: as soon as the settlement's street list is resolved, if `!cityHousesBulkFetchedIds.has(cityId)` (and `remId` is known), it immediately triggers `void ensureCityHousesIndexed(siteUrl, cityId, remId, streets)` in the background.
     - Deduplicates concurrent bulk requests via `cityHousesInFlight: Map<string, Promise<boolean>>`.
     - Inside `fetchZtoeHouses(siteUrl, cityId, streetId, remId, forceRefresh)`:
       1. If `!forceRefresh` and `housesCache.has("${cityId}|${streetId}")`, returns the cached houses in **`0ms`**.
       2. If `cityHousesInFlight.has(cityId)`, awaits the in-flight settlement-wide bulk fetch and then returns `housesCache.get("${cityId}|${streetId}")` immediately without making a second request.
       3. Otherwise, triggers `ensureCityHousesIndexed` (if `remId` is provided) and falls back to single-street `POST` (`rem_id=<remId>&naspunkt_id=<cityId>&vulica_id=<streetId>`) if needed.

3. **Background Prefetch on Launch (`prefetchAddressIndexInBackground`)**:
   - Invoked `50ms` after app launch (`App.tsx` / `BlackoutAppNavigation.kt` / `BlackoutAppNavigation.swift`).
   - Step 1: Fetches all 19 REMs (`fetchZtoeRems`).
   - Step 2: Prefetches cities for priority REMs first (`"4"` Житомирський РЕМ, `"1"` Бердичівський РЕМ, `"7"` Коростенський РЕМ, `"8"` Звягельський РЕМ, plus user's saved `preferredRemId`), then the remaining REMs in batches of 4.
   - Step 3: Prefetches streets for priority cities (`"20055"` м. Житомир + user's saved `preferredCityId`) and awaits `ensureCityHousesIndexed(siteUrl, cityId, remId, streets)` so all houses in the active/default city are indexed before the user ever opens Settings.

4. **Fast Regex Table Cell Scanner & Separated `useEffect`s**:
   - In `ZtoeAddressLookup.kt` (and iOS `ZtoeAddressLookup.swift`), do **not** run full DOM tree construction on 15,000-row house tables. Instead, scan `<tr>...</tr>` blocks with `Regex("<tr[^>]*>([\\s\\S]*?)</tr>", IGNORE_CASE)` and extract `<td>...</td>` cells with `Regex("<td[^>]*>([\\s\\S]*?)</td>", IGNORE_CASE)`, stripping tags via `TAG_STRIP_REGEX` and decoding entities via `decodeZtoeHtmlEntities`.
   - In `SettingsView.tsx` (and SwiftUI/Compose equivalents):
     - **Effect 1 (Streets)**: Depends only on `[showQueueHelp, lookupRemId, lookupCityId, settings.siteUrl]`. Never depends on `lookupStreetId`.
     - **Effect 2 (Houses)**: Depends on `[showQueueHelp, lookupRemId, lookupCityId, lookupStreetId, settings.siteUrl]`. Synchronously reads `getCachedZtoeHouses(lookupCityId, lookupStreetId)` first (`0ms`, no loading spinner if cached) and only refreshes from network when needed.

---

### 3.3 HTML Entity & Apostrophe Decoding (`decodeZtoeHtmlEntities`)

#### What It Does
ZTOE's Windows-1251 HTML responses contain HTML character references for Ukrainian apostrophes in city and street names — including single-escaped `&#039;`, `&#39;`, `&#x27;`, `&apos;` and double-escaped `&amp;#039;` (for example: `с. Кам&#039;янка`, `вул. В&#039;ячеслава Чорновола`, `вул. Мар&#039;янівська`).

#### Exact Decoding Implementation
```ts
export function decodeZtoeHtmlEntities(raw: string): string {
  if (!raw || !raw.includes('&')) return raw;
  return raw
    .replace(/&amp;/gi, '&')
    .replace(/&#0*39;/g, "'")
    .replace(/&#x0*27;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&rsquo;/gi, "'")
    .replace(/&lsquo;/gi, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*34;/g, '"')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : _;
    });
}
```
- **Critical Order of Operations**: `&amp;` **must** be replaced with `&` **before** matching `&#0*39;` so double-escaped `&amp;#039;` is properly decoded into `'`.
- **Where It Is Called**:
  1. Inside `stripHtmlTags(raw)` (used by all REM, City, Street, House, and Emergency Outage parsers).
  2. Inside `hydrateCacheFromDisk()` when loading cached `rems`, `citiesByRem`, `streetsByCity`, and `housesByCityStreet` from disk.
  3. Inside the City and Street dropdown option renderers (`SettingsView.tsx` / `SettingsScreen.kt` / `SettingsScreen.swift`) as a defensive guarantee.

---

### 3.4 Main Screen Emergency Outage Bar (`Card 1c`) & Custom Status Bar (`Card 1b`)

#### Placement & Visual Hierarchy on Main Screen (`MainView.tsx` / `MainScreen.kt` / `MainScreen.swift`)
The vertical card stack inside the Main Screen scroll view (`16pt` / `16dp` spacing between cards) is ordered as follows:
1. **Top Header (`Card 1`)**:
   - **Left side**:
     - When `queue` is non-empty AND `!hasCustomNoQueueStatus`:
       - `40x40pt` (`w-10 h-10`) rounded-2xl (`16pt`) icon box with `bg-[#FF5E3A]/20`, `1pt` border `border-[#FF5E3A]/30`, and orange Lightning icon (`20pt`, `#FF5E3A`).
       - `12pt` spacer + vertical column with `"Черга \(queue)"` / `"Queue \(queue)"` (`20sp`/`text-xl`, bold, white) and subtitle `"Житомиробленерго (ZTOE)"` (`12sp`/`text-xs`, `#9CA3AF`).
     - When `queue.isEmpty || hasCustomNoQueueStatus`:
       - Empty placeholder view with `minHeight = 44pt` (`min-h-[44px]`) so the right-side Bell button remains in the exact same top-right position.
   - **Right side**:
     - Bell toggle button (`minHeight = 40pt`, `px-3.5 py-2`, corner radius `16pt` / `rounded-2xl`):
       - When `notificationsEnabled == true`: background `rgba(255, 94, 58, 0.20)`, border `1pt` `rgba(255, 94, 58, 0.50)`, text/icon `#FF5E3A`, label `"Увімк."` (UK) / `"On"` (EN).
       - When `notificationsEnabled == false`: background `rgba(255, 255, 255, 0.05)`, border `1pt` `rgba(255, 255, 255, 0.10)`, text/icon `#9CA3AF`, label `"Вимк."` (UK) / `"Off"` (EN).
2. **Custom ZTOE Queue/House Status Message Bar (`Card 1b`, shown when `customQueueStatusMessage` is non-empty)**:
   - Standalone card **above** the Hero Outage Status Card.
   - Surface: `#141A29` at `75%` opacity, `24pt` corner radius, `1pt` border `rgba(255, 255, 255, 0.15)`, `16pt` padding (`p-4`).
   - Horizontal row (`12pt` gap):
     - Leading `32x32pt` (`w-8 h-8`) `12pt`-radius badge:
       - If no-queue message (`hasCustomNoQueueStatus`): background `rgba(34, 197, 94, 0.20)`, border `rgba(34, 197, 94, 0.40)`, bold `"✓"` in `#4ADE80`.
       - Otherwise: background `rgba(245, 158, 11, 0.20)`, border `rgba(245, 158, 11, 0.40)`, bold `"i"` in `#FBBF24`.
     - Right column:
       - Title: `"Статус за адресою"` (UK) / `"Address status"` (EN) (`12sp`/`text-xs`, bold, `#4ADE80` or `#FCD34D`).
       - Body: `customQueueStatusMessage` (`12sp`/`text-xs`, `#F3F4F6`, `leading-snug`).
3. **Active Emergency Outage Banner (`Card 1c`, shown when `activeEmergencyOutage != nil`)**:
   - Standalone card **above** the Hero Outage Status Card.
   - Surface: `#141A29` at `75%` opacity, `24pt` corner radius, `1pt` border `rgba(255, 255, 255, 0.15)`, `16pt` padding (`p-4`).
   - Top section (`HStack(alignment: .top, spacing: 12)`):
     - Leading `32x32pt` (`w-8 h-8`) `12pt`-radius badge: background `rgba(239, 68, 68, 0.20)`, border `1pt` `rgba(239, 68, 68, 0.40)`, centered bold `"!"` in `#F87171` (`14sp`).
     - Right column:
       - Title: `"Аварійне відключення"` (UK) / `"Emergency outage"` (EN) (`14sp`/`text-sm`, bold, `#F87171`).
       - Cause/Work text: `activeEmergencyOutage.cause` (`12sp`/`text-xs`, `#E5E7EB`, `leading-snug`).
   - **Bottom Timestamps Section (Symmetrical Left Descriptions & Right-Aligned Numbers)**:
     - Separated by `6pt` top margin (`mt-1.5`), `6pt` top padding (`pt-1.5`), and a `1pt` top border `rgba(255, 255, 255, 0.10)` (`border-t border-white/10`), with `4pt` (`space-y-1`) vertical spacing between the two rows:
     - **Row 1 (Start)**:
       - Left description: `"Початок:"` (UK) / `"Start:"` (EN) (`11sp`/`text-[11px]`, `#9CA3AF`).
       - Right timestamp: `activeEmergencyOutage.startTime` (`11sp`/`text-[11px]`, `font-semibold`, `tabular-nums` / `.monospacedDigit()`, right-aligned `text-right` / `TextAlign.End`, `#F3F4F6`).
     - **Row 2 (Estimated Restore)**:
       - Left description: `"Орієнтовне відновлення:"` (UK) / `"Estimated restore:"` (EN) (`11sp`/`text-[11px]`, `#9CA3AF`).
       - Right timestamp: `activeEmergencyOutage.endTime` (`11sp`/`text-[11px]`, `font-semibold`, `tabular-nums` / `.monospacedDigit()`, right-aligned `text-right` / `TextAlign.End`, `#F3F4F6`).
4. **Hero Outage Status Card (`Card 2`)**:
   - Surface: `#141A29` at `75%` opacity, `24pt` corner radius, `1pt` border `rgba(255, 255, 255, 0.15)`, `24pt` padding (`p-6`).
   - **Special Empty Counter Case (`hasCustomNoQueueStatus && !hasEmergencyOutage`)**:
     - Renders **only** the centered `--:--:--` text (`36sp`/`text-4xl`, `font-black`, `font-mono`, `#F3F4F6`, vertical padding `12pt`/`py-3`), hiding the status badge, countdown subtitle, and next period footer.

---

### 3.5 First-Launch Unselected Queue Overlay & `"?"` Modal Flow

1. **First-Launch Unselected Queue State (`queue == ""` and `!hasCustomNoQueueStatus`)**:
   - Default `UserSettings.queue` on a fresh install is `""` (empty string) and `language` is `"SYSTEM"` / `'system'`.
   - When `queue == ""` and `!hasCustomNoQueueStatus` and the user has not opened the `"?"` modal yet:
     - The entire Main Screen content and bottom navigation dock are dimmed (`opacity(0.15)` with a dark overlay `Color(0xD9070A12)` / `rgba(7, 10, 18, 0.85)`) and non-interactive (`allowsHitTesting(false)`).
     - Centered on screen is a frosted card (`#141A29` at `95%` opacity, `24pt` corner radius, `1pt` `white/15` border, `24pt` padding) containing:
       1. Large orange button (`#FF5E3A`, `16pt` corner radius, `minHeight = 68pt`):
          - Leading `36x36pt` icon box (`rgba(255,255,255,0.20)`, `12pt` radius) with white Lightning icon.
          - Title: `"Виберіть чергу"` (UK) / `"Select queue"` (EN) (`18sp`, bold, white).
          - Subtitle: `"Житомиробленерго (ZTOE)"` (`12sp`, `rgba(255,255,255,0.85)`).
          - Tapping this button switches to Settings and automatically opens the `"?"` Address Lookup modal (`showQueueHelp = true`).
       2. Below the button (`16pt` spacing): 3-segment language selector (`#141A29` / `rgba(0,0,0,0.40)`, `16pt` corner radius, `1pt` `white/10` border, `6pt` padding) with segments `"Auto"`, `"English"`, `"Українська"` (active segment highlighted in `#FF5E3A`).
2. **`"?"` Modal Entry & Exit Rules**:
   - Opening `"?"` (`showQueueHelp = true`) immediately shows cached REMs/Cities/Streets/Houses (`0ms`) and triggers a silent background refresh (`forceRefresh = true`) of REMs, Cities, Streets, and Houses.
   - Tapping `"Обрати чергу"` / `"Apply Queue"` inside `"?"`:
     - Updates `settings.queue`, `settings.customQueueStatusMessage`, `settings.selectedAddressQuery`, and `settings.activeEmergencyOutage`.
     - Closes the `"?"` modal (`showQueueHelp = false`).
     - **Navigates directly to the Main Screen** (`activeTab = .main`).
   - Returning to the Main Screen immediately refreshes `now = Date()` so the countdown timer and 24-hour drum chart reflect the current second without delay.

---

## 4. Target iOS Architecture & Repository Isolation (`/ios`)

### 4.1 Critical `.gitignore` Rule (Push ONLY iOS Files to GitHub)
When the Google AI Studio project is synced to `https://github.com/IgorZaharov/iOS-ZTPreBlackoutNotification`, `.gitignore` **must** exclude all AI Studio web/Node.js emulator scaffolding so that **only iOS-related files** are pushed to the GitHub repository, while the 16:10 Emulator continues running locally inside Google AI Studio on port 3000:

```gitignore
# AI Studio Web Emulator & Node.js Scaffolding (Local Only — Do NOT Push to iOS GitHub Repo)
node_modules/
build/
dist/
coverage/
src/
public/
scripts/
tests/
index.html
package.json
package-lock.json
tsconfig.json
vite.config.ts
metadata.json
.env*
.aistudio/
.omc/
.DS_Store
*.log

# Tracked & Pushed to https://github.com/IgorZaharov/iOS-ZTPreBlackoutNotification:
# - ios/ (All Swift, SwiftUI, WidgetKit, XCTest, project.yml, MP3 audio, 9 foil textures, assets)
# - .github/workflows/build-ios.yml
# - valid-urls.json
# - donations.json
# - CHANGELOG.md
# - PRIVACY_POLICY.md
# - README.md
```

### 4.2 High-Level iOS Architecture (`ZtoeParser.swift`, `ZtoeAddressLookup.swift`, `WidgetKit`, `ZhytomyrRouletteScreen.swift`)

```
+-----------------------------------------------------------------------------------+
|                   https://www.ztoe.com.ua/unhooking-search.php                    |
|     (Windows-1251 HTML schedule tables, REM/City/Street/House & all=1 tables)     |
+-----------------------------------------+-----------------------------------------+
                                          |
                 HTTP GET / POST (Accept-Encoding: gzip, ETag)
                                          v
+-----------------------------------------------------------------------------------+
|          ZtoeParser.swift & ZtoeAddressLookup.swift / ztoeAddressLookup.ts        |
|  1. Validates URL strictly against valid-urls.json                                |
|  2. Decodes Windows-1251 stream & decodes &#039; / &amp;#039; -> '                |
|  3. Prefetches 19 REMs, cities, streets & bulk settlement houses (all=1)          |
|  4. Extracts all 12 queues (48 slots/day) + overlays Emergency Outage slots       |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|              Shared App Group UserDefaults (group.com.ZTBlackoutPreWarning)       |
|  - Persists zt_address_index_cache_v1 (REMs, cities, streets, bulk houses)        |
|  - Persists today & tomorrow slots, customQueueStatusMessage, emergency outage    |
|  - Persists UserSettings (including independent emergencyNotificationsEnabled)    |
+-------------------+---------------------+---------------------+-------------------+
                    |                     |                     |
                    v                     v                     v
      +-----------------------+ +-------------------+ +-----------------------+
      |      SwiftUI App      | | NotificationSched | |  WidgetKit Extension  |
      | - MainScreen.swift    | | & BGTaskScheduler | | - Small (systemSmall) |
      | - SettingsScreen.swift| | - Scheduled alerts| | - Big (systemMedium)  |
      | - AboutScreen.swift   | | - Independent     | | - САЗУ-ИТ 24h chart   |
      | - ZhytomyrRoulette    | |   Emergency alerts| | - RefreshWidgetIntent |
      +-----------------------+ +-------------------+ +-----------------------+
```

---

## 5. Master Bootstrap Prompt (Copy & Paste into Parallel iOS AI Studio Project)

Paste the prompt below into your parallel iOS Google AI Studio project synced to `https://github.com/IgorZaharov/iOS-ZTPreBlackoutNotification`:

```text
Update and build the complete native iOS port of "Світло в Житомирі" (v1.3.4) for repository https://github.com/IgorZaharov/iOS-ZTPreBlackoutNotification with 100% feature, button placement, text, icon, color, and localization parity with the Android/Workbench v1.3.4 release, plus the interactive 16:10 smartphone Emulator tab in AI Studio.

CRITICAL REPOSITORY & GITIGNORE RULES:
1. This AI Studio workspace is synced to https://github.com/IgorZaharov/iOS-ZTPreBlackoutNotification, which must ONLY receive iOS-related files when pushed to GitHub.
2. Configure .gitignore to ignore all AI Studio web preview files (src/, public/, scripts/, tests/, node_modules/, dist/, package.json, package-lock.json, vite.config.ts, tsconfig.json, index.html, metadata.json, .env*, .aistudio/) while tracking ONLY:
   - ios/ (Swift 5.10 + SwiftUI + WidgetKit project, project.yml for XcodeGen, ZtoeParser.swift, ZtoeAddressLookup.swift, MainScreen.swift, SettingsScreen.swift, AboutScreen.swift, ZhytomyrRouletteScreen.swift, XCTest unit tests, bundled MP3 audio, 9 foil textures, valid-urls.json, donations.json)
   - .github/workflows/build-ios.yml
   - valid-urls.json, donations.json, CHANGELOG.md, PRIVACY_POLICY.md, README.md

MANDATORY v1.3.4 FEATURES & UI/UX PARITY:
1. Version 1.3.4:
   - Raise MARKETING_VERSION and fallback version strings to "1.3.4" (v1.3.4) in ios/project.yml, AboutScreen.swift, AboutView.tsx, package.json, vite.config.ts, README.md, and CHANGELOG.md.

2. Independent Emergency Outage Notifications Switch (emergencyNotificationsEnabled):
   - Add emergencyNotificationsEnabled: Bool = true (default ON) to UserSettings.
   - Label in UK: "Сповіщення про аварійні відключення", EN: "Emergency outage notifications" with multi-line word wrapping so text fits cleanly without truncation.
   - Render in its own separate frosted-glass card (Card 4b) directly below Card 4 (Notifications) and above Card 5 (Language) in SettingsScreen.swift and SettingsView.tsx, with a leading Bell icon (18pt, #9CA3AF) and a #FF5E3A toggle switch.
   - Always visible even when no outages are active.
   - Must remain ON when the main "Увімкнути сповіщення" / "Enable notifications" switch is turned OFF in Settings, Main Screen, or Widget.
   - Must respect soundEnabled and vibrationEnabled when sending notifications on emergency outage start, restoration time update, or cancellation.

3. Zero-Delay "?" Address Lookup: Background Prefetch, Bulk Settlement House Indexing (all=1), Fast Regex Parser & Disk Cache:
   - Persist AddressIndexDiskCache under key "zt_address_index_cache_v1" (rems, citiesByRem, streetsByCity, housesByCityStreet, cityHousesBulkFetched). Hydrate synchronously on startup and persist asynchronously off the main thread.
   - On app launch (50ms after startup), call prefetchAddressIndexInBackground(siteUrl, preferredRemId, preferredCityId) to prefetch all 19 REMs, their settlements, the active/default city's streets, and bulk-index all houses in the active/default settlement.
   - Implement settlement-wide bulk house indexing (POST unhooking-search.php with rem_id=<remId>&naspunkt_id=<cityId>&vulica_id=0&all=1 and parseZtoeSettlementHousesTableHtml) that parses the 7-column settlement table (REM | City | Street | House | Queue | Subqueue | Note) using fast pre-compiled regexes, maps Street names to streetIds via normalizeStreetLookupKey, and populates housesCache for every street in the city at once.
   - Automatically trigger ensureCityHousesIndexed in the background whenever fetchZtoeStreets completes for a city, and reuse any in-flight cityHousesInFlight promise inside fetchZtoeHouses so opening the House dropdown takes 0ms.
   - Separate the street-loading effect and house-loading effect in Settings so selecting a street never resets or re-fetches streets.

4. HTML Entity & Apostrophe Decoding (&#039; -> '):
   - Implement decodeZtoeHtmlEntities(raw) that unescapes &amp; first (handling double-escaped &amp;#039;) and converts &#039;, &#39;, &#x27;, &apos;, &rsquo;, &lsquo; into "'".
   - Apply decodeZtoeHtmlEntities in stripHtmlTags during HTML parsing, inside hydrateCacheFromDisk when hydrating cached cities/streets/houses, and when rendering City and Street dropdown labels.

5. Main Screen Emergency Outage Bar (Card 1c) & Custom Status Bar (Card 1b):
   - Render Card 1b (Custom ZTOE Status Message Bar) and Card 1c (Active Emergency Outage Banner) as standalone frosted-glass cards (#141A29 at 75% opacity, 24pt corner radius, 1pt white/15 border, 16pt padding) ABOVE the Hero Outage Status Card.
   - In Card 1c, align the Start ("Початок:" / "Start:") and Estimated Restore ("Орієнтовне відновлення:" / "Estimated restore:") rows using space-between layout so the timestamp numbers are right-aligned (tabular-nums / monospacedDigit) and symmetrical to the left-aligned descriptions.
   - When hasCustomNoQueueStatus && !hasEmergencyOutage, render an empty minHeight = 44pt header placeholder on the left of Card 1 and display only the centered "--:--:--" counter inside Card 2.
   - Automatically refresh the current time (now) whenever the user enters the Main Screen.

6. "?" Button & Address Lookup Modal Behavior:
   - In Settings Card 1, style the "?" button as 40x40pt, 16pt corner radius, solid #FF5E3A background, white bold "?", right-aligned across from the title/description.
   - Inside the "?" modal's 2px white-bordered Search by Address block, display the subtitle UK: "(Або закрийте це вікно та виберіть тільки чергу)" / EN: "(Or close this window and select directly)" under "Пошук черги за адресою".
   - Trigger a background refresh (forceRefresh = true) of REMs, Cities, Streets, and Houses when entering the "?" modal while immediately displaying cached options.
   - Clicking the full-width #FF5E3A "Обрати чергу" / "Apply Queue" button applies the address/queue, closes the modal, and navigates directly to the Main Screen.

7. Automated Unit Tests:
   - Run unit tests on every build verifying ZTOE parsing, 48-slot graph parity, bulk house indexing (all=1), &#039; decoding, symmetrical emergency outage timestamps, independent emergency notification switch, Zhytomyr Roulette mechanics, and v1.3.4 version strings.
```
