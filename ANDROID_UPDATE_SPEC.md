# Android Port Update Specification (`ANDROID_UPDATE_SPEC.md`)

**Target Repository:** `https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning`  
**Baseline Version:** `v1.3.3`  
**Reference Implementation:** iOS 17.0+ Port (`ios/`) & Web Simulator (`src/`)

This document specifies **all features, UI/UX changes, parsing & overlap algorithms, bug fixes, and battery/performance optimizations** added after the initial `v1.3.3` project baseline. It is structured so an engineer or automated coding agent can reproduce 100% of the functionality in the native Android (Kotlin / Jetpack Compose / Glance AppWidget / WorkManager) application.

---

## 1. Executive Summary & Delta Overview (Since `v1.3.3`)

1. **First-Application-Launch Zero-State & Navigation Lock**:
   - Default queue on fresh install or full app reset is unset (`""`), and default language is `"system"` (`Auto`).
   - All Main screen background elements and the bottom navigation bar are dimmed (`alpha = 0.15f`) and disabled (`enabled = false`) until a queue or address is selected.
   - Full-screen centered overlay displays:
     1. Enlarged primary button (`minWidth = 260.dp`, `#FF5E3A`): **UK:** `"Виберіть чергу"` / **EN:** `"Select queue"` (subtitle: `"Житомиробленерго (ZTOE)"`).
     2. Directly **below** the button: a 3-segment language selector (`Auto` / `English` / `Українська`, default `Auto` = `"system"`) that immediately updates the UI language.
   - Pressing `"Виберіть чергу"` / `"Select queue"` navigates to Settings and automatically opens the full-screen `"?"` Queue Lookup & Help modal.
   - Selecting and applying a queue (or no-queue address) for the **first time** automatically switches the view back to the **Main window** (`schedule` tab).

2. **Full-Screen `"?"` Address Lookup & Manual Search Modal in Settings**:
   - Enlarged `"?"` button in the Queue Selection card header.
   - Opens a **full-screen** modal (`#141A29`) with enlarged dropdowns, larger fonts, and an expanded internal block border (`2.dp`, `Color.White.copy(alpha = 0.25f)`).
   - **Section Order**:
     1. **Search by Address (`"Пошук черги за адресою"` / `"Find Queue by Address"`)** at the top.
     2. **Manual Search Heading (`"Пошук вручну"` / `"Manual search"`)**.
     3. **Numbered Instructions `1–4`** (Step 1 URL has no trailing period).
   - **Default Dropdown State on First Launch**:
     - РЕМ (`remId`): `"zhytomyr"` (`"Житомирський РЕМ"`)
     - Населений пункт (`settlementId`): `"zt_city"` (`"м. Житомир"`)
     - Вулиця (`streetId`): **Unselected (`""`)** showing placeholder `"Оберіть вулицю"` / `"Select street"`
     - Будинок (`house`): **Unselected (`""`)** showing placeholder `"Оберіть будинок"` / `"Select house"`
   - **Persistent Address Selection**: Once the user selects and confirms an address, re-entering Settings or reopening the `"?"` modal restores the user's saved `remId`, `settlementId`, `streetId`, and `house`.

3. **ZTOE Address Lookup & Queue Preservation Safeguard (`5.2 -> 3.2` Fix)**:
   - Supports searching by РЕМ, Settlement, Street, and House Number.
   - Periodic background refresh (`refreshIntervalMinutes`) and manual refresh re-check `selectedAddressQuery` against the ZTOE website.
   - **Critical Safeguard**:
     - If a house selected from the address directory already has a known queue (e.g., `м. Житомир, вул. Київська, буд. 77` -> Queue `5.2`), live HTML table refreshes (`checkAddressOnZtoeWebsite` and `loadSchedules`) **MUST NEVER** overwrite `5.2` with a conflicting row (such as `3.2`) from the live table.
     - Live HTML queue assignment only updates `settings.queue` when the user's house previously had **no queue** (`queue == ""`) and the ZTOE table no longer lists a no-outage status message row for that house.
     - For houses that have both a commercial queue row and a no-outage message row on live ZTOE (e.g., `вул. Київська, буд. 104`), the no-outage message row takes precedence (`queue = ""`, `statusText = "В цей час не вимикається, за винятком випадків аварійних відключень"`).

4. **Main Window Display for Selected Address & No-Queue Houses**:
   - **Address Formatting (`formatAddressAfterCity`)**: Inserts a line break (`\n`) right after the settlement/city so the street and building number appear on the second line:
     ```
     Житомирський РЕМ, м. Житомир,
     вул. Київська, буд. 77
     ```
   - **No-Queue House State** (`queue == ""` and `customQueueStatusText != null` and no active emergency outage):
     - Top header queue title is hidden (empty placeholder).
     - Full unshortened ZTOE message (`"В цей час не вимикається, за винятком випадків аварійних відключень"`) is rendered in a standard glass card above the main status card, with the formatted address above the message.
     - Main countdown displays `"--:--:--"` (with the `"--:-- - --:--"` slot range line hidden).
     - 24-hour Drum Chart renders all 24 hour columns (`00..23`) with **light internal squares** (same visual style as `POWER_ON` / no outage), never blank or unclear.

5. **Emergency Outages (`"Аварійне відключення"`) Detection, Priority Overlap & Notifications**:
   - Checks ZTOE's live `pw_accidents` JSON data (embedded in `/unhooking-search.php`) and HTML emergency tables for the user's `selectedAddressQuery`.
   - Displays an active Emergency Outage banner on the Main screen with start time (`Початок`) and estimated restoration time (`Орієнтовне відновлення`).
   - **Schedule Priority & Merging (`applyEmergencyOutageToSchedule`)**:
     - Emergency outage half-hour slots (`POWER_OFF`, `isEmergency = true`) override and merge with regular scheduled ZTOE slots across Today and Tomorrow (including outages spanning midnight).
     - Drives the Main screen countdown timer, the 24-hour Drum Chart, the Today/Tomorrow blackout interval list, the Home Screen Widgets, and scheduled notifications.
   - **State-Transition Notifications (`checkAndTriggerEmergencyOutageAlert`)**:
     - Fires **once** when a new emergency outage is detected for the user's address.
     - Does **not** repeat on subsequent refreshes while the same outage (`id` + `startTime` + `estimatedRestoreTime`) remains active.
     - Fires **once** when the emergency outage clears (`prevOutage != null && nextOutage == null`).
     - Respects the master `notificationsEnabled` switch (`soundEnabled` and `vibrationEnabled`).

6. **Today / Tomorrow Blackout Hours List Alignment & `"!"` Emergency Icon**:
   - Localized headers:
     - Today tab: **UK:** `"Години відключень на сьогодні:"` / **EN:** `"Blackout hours for today:"`
     - Tomorrow tab: **UK:** `"Години відключень на завтра:"` / **EN:** `"Blackout hours for tomorrow:"`
   - Every interval row uses a fixed `20x20.dp` leading indicator container so the timeslot text (`HH:MM – HH:MM`) is **100% horizontally aligned** across all rows whether or not emergency outages are present:
     - If `interval.isEmergency == true`: renders `"!"` inside a `20x20.dp` circle (`#FF5E3A` border & text).
     - If `interval.isEmergency == false`: renders a centered `10x10.dp` `#FF5E3A` dot inside the same `20x20.dp` container.

7. **Widget Synchronization**:
   - Both Small (`2x1`) and Medium/Large (`4x2`) widgets apply `applyEmergencyOutageToSchedule` to Today and Tomorrow schedules before calling `calculateOutageCountdown`, ensuring the widget countdown and 24-hour bar graph match the Main window 100%.

8. **Battery, Memory & Background Execution Optimizations**:
   - **1-Second Ticker Gating**: Foreground 1s countdown timer runs **only** when the app is in the foreground (`Lifecycle.State.RESUMED`), on the Main screen (`selectedPage == 0`), and the `Житомирська Рулетка` mini-game is closed.
   - **Static `Europe/Kyiv` TimeZone/Calendar & Pre-Compiled Regexes**: Prevents repeated allocation during 1s ticks and HTML parsing.
   - **HTTP `ETag` / `If-None-Match` Caching**: Avoids re-parsing unchanged ZTOE HTML payloads (`304 Not Modified`).
   - **Bounded Caches**: Caps interval calculation cache (`64` entries) and notification deduplication registry (`100` entries).
   - **Midnight Rollover (`00:00` Kyiv Time)**: Automatically promotes cached `tomorrow` slots into `today` slots when midnight passes offline.
   - **Dynamic Background Rescheduling**: Reschedules periodic background sync (`WorkManager`) only when `refreshIntervalMinutes` actually changes.
   - **24-Hour Donations Cache**: Fetches remote `donations.json` at most once per 24 hours (`86,400,000 ms`).

---

## 2. Data Models & Persistence (`SharedPreferences` Schema)

### 2.1 `UserSettings` Data Class

```kotlin
data class EmergencyOutageInfo(
    val id: String,
    val remName: String? = null,
    val settlementName: String? = null,
    val streetName: String? = null,
    val house: String? = null,
    val outageType: String,           // e.g. "Аварійне відключення"
    val startTime: String,            // "DD.MM.YYYY HH:MM"
    val estimatedRestoreTime: String  // "DD.MM.YYYY HH:MM"
)

data class SelectedAddressQuery(
    val remId: String,
    val settlementId: String,
    val streetId: String,
    val house: String
)

data class UserSettings(
    val city: String = "Житомир (ZTOE)",
    val url: String = "https://www.ztoe.com.ua/unhooking-search.php",
    val queue: String = "",                        // Default MUST be "" on fresh install
    val customQueueStatusText: String? = null,     // Full unshortened ZTOE message for no-queue houses
    val selectedAddress: String? = null,           // Formatted display address with '\n' after city
    val selectedAddressQuery: SelectedAddressQuery? = null,
    val activeEmergencyOutage: EmergencyOutageInfo? = null,
    val refreshIntervalMinutes: Int = 30,          // Default: 30 (1..240)
    val advanceNoticeMinutes: Int = 15,            // Default: 15 (1..240)
    val notificationsEnabled: Boolean = true,
    val soundEnabled: Boolean = true,
    val vibrationEnabled: Boolean = true,
    val prevSoundEnabled: Boolean = true,
    val prevVibrationEnabled: Boolean = true,
    val theme: String = "system",
    val language: String = "system"                // Default: "system" (Auto)
)
```

### 2.2 `SharedPreferences` Keys (`zt_user_settings_v1`)

| Key | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `queue` | `String` | `""` | Selected queue (`"1.1"`..`"6.2"`) or `""` when unset / no-queue house |
| `custom_queue_status_text` | `String` | `""` | Full ZTOE status message for houses without a queue |
| `selected_address` | `String` | `""` | Formatted address string (`"РЕМ, Місто,\nвул. ..., буд. ..."`) |
| `selected_rem` | `String` | `""` | Saved `remId` (e.g. `"zhytomyr"`) |
| `selected_settlement` | `String` | `""` | Saved `settlementId` (e.g. `"zt_city"`) |
| `selected_street` | `String` | `""` | Saved `streetId` (e.g. `"zt_kyivska"`) |
| `selected_house` | `String` | `""` | Saved house number (e.g. `"77"`, `"104"`) |
| `active_emergency_outage_id` | `String` | `""` | Active emergency outage ID (e.g. `"pw_accident_391476673"`) |
| `active_emergency_outage_type` | `String` | `""` | Outage type label (`"Аварійне відключення"`) |
| `active_emergency_outage_start` | `String` | `""` | Start time (`"DD.MM.YYYY HH:MM"`) |
| `active_emergency_outage_restore` | `String` | `""` | Estimated restore time (`"DD.MM.YYYY HH:MM"`) |
| `city_url` | `String` | `"https://www.ztoe.com.ua/unhooking-search.php"` | Schedule provider URL |
| `advance_notice_minutes` | `Int` | `15` | Clamped to `1..240` |
| `refresh_interval_minutes` | `Int` | `30` | Clamped to `1..240` |
| `notifications_enabled` | `Boolean` | `true` | Master notifications switch |
| `sound_enabled` | `Boolean` | `true` | Forced `false` when `notifications_enabled == false` |
| `vibration_enabled` | `Boolean` | `true` | Forced `false` when `notifications_enabled == false` |
| `prev_sound_enabled` | `Boolean` | `true` | Saved sound state before master toggle was turned OFF |
| `prev_vibration_enabled` | `Boolean` | `true` | Saved vibration state before master toggle was turned OFF |
| `language` | `String` | `"system"` | `"system"` (`Auto`), `"uk"` (`Українська`), or `"en"` (`English`) |
| `theme` | `String` | `"system"` | `"system"`, `"dark"`, or `"light"` |

### 2.3 `BlackoutSlot` & `BlackoutInterval` Models

```kotlin
enum class OutageStatus {
    POWER_ON,
    POWER_OFF,
    MAYBE_OFF
}

data class BlackoutSlot(
    val id: String,              // "${dateStr}_${queue}_${hour}_${minute}"
    val hour: Int,               // 0..23
    val minute: Int,             // 0 or 30
    val startTime: String,       // "HH:MM"
    val endTime: String,         // "HH:MM" (24:00 for 23:30 slot end)
    val status: OutageStatus,
    val isEmergency: Boolean = false
)

data class BlackoutInterval(
    val start: String,           // "HH:MM"
    val end: String,             // "HH:MM"
    val durationHours: Double,   // e.g. 4.0, 2.5
    val isMaybe: Boolean = false,
    val isEmergency: Boolean = false
)
```

---

## 3. First Application Launch UX & Navigation Flow

### 3.1 Detection of Unselected Queue State (`isQueueUnselected`)

```kotlin
val hasActiveEmergencyOutage = !settings.activeEmergencyOutage?.startTime.isNullOrBlank()
val hasNoQueueMessage = !settings.customQueueStatusText.isNullOrBlank() &&
    settings.queue.isBlank() &&
    !hasActiveEmergencyOutage
val isQueueUnselected = settings.queue.isBlank() &&
    !hasNoQueueMessage &&
    !hasActiveEmergencyOutage
```

### 3.2 UI Locking & Overlay Layout when `isQueueUnselected == true`

1. **Background Dimming & Interaction Lock**:
   - The Main screen content and top notification toggle are rendered with `alpha = 0.15f` and `enabled = false` (ignoring all touch events).
   - Scrolling on the Main screen is disabled while `isQueueUnselected == true`.
   - The bottom navigation bar (`Schedule`, `Settings`, `About`) is rendered with `alpha = 0.15f` and `enabled = false`.
2. **Centered Full-Screen Overlay**:
   - Vertically and horizontally centered (`Arrangement.Center`, `Alignment.CenterHorizontally`, `spacedBy(20.dp)`):
     1. **Primary `"Select queue"` Button (Top)**:
        - Minimum width: `260.dp`, vertical padding `20.dp`, horizontal padding `32.dp`, corner radius `24.dp`, background `#FF5E3A`.
        - Title (`22.sp`, ExtraBold, White):
          - When `lang == "uk"`: `"Виберіть чергу"`
          - When `lang == "en"`: `"Select queue"`
        - Subtitle (`12.sp`, SemiBold, `White.copy(alpha = 0.9f)`): `"Житомиробленерго (ZTOE)"`
        - Action: Sets `autoOpenQueueHelp = true` and navigates to the **Settings** tab (`selectedPage = 1`).
     2. **Language Switch (Directly Below the Button)**:
        - 3-segment selector (`minWidth = 260.dp`, `#141A29` at 90% opacity, corner radius `16.dp`, border `White.copy(alpha = 0.2f)`):
          - `"system"` -> Label: `"Auto"` (Selected by default on first launch)
          - `"en"` -> Label: `"English"`
          - `"uk"` -> Label: `"Українська"`
        - Tapping a segment immediately updates `settings.language` and persists it to `SharedPreferences`, switching the UI language in real time.

### 3.3 Auto-Return to Main Window on First Queue Selection

When `SettingsScreen` updates `settings` (either by confirming an address in the `"?"` modal or selecting a queue in Settings):

```kotlin
val wasUnselected = currentSettings.queue.isBlank() &&
    currentSettings.customQueueStatusText.isNullOrBlank() &&
    currentSettings.selectedAddress.isNullOrBlank()

val isNowSelected = newSettings.queue.isNotBlank() ||
    !newSettings.customQueueStatusText.isNullOrBlank() ||
    !newSettings.selectedAddress.isNullOrBlank()

saveSettings(newSettings)
if (wasUnselected && isNowSelected) {
    selectedPage = 0 // Switch back to Main window immediately
}
```

---

## 4. Full-Screen `"?"` Popup in Settings & Persistent Address State

### 4.1 Layout & Visual Specification

- Triggered by the `"?"` button (`40x40.dp`, `#FF5E3A`, rounded `16.dp`) in the Queue Selection card header, or automatically when `autoOpenQueueHelp == true`.
- Presented as a **full-screen** modal/dialog (`fillMaxSize()`, background `#141A29`, vertical scroll enabled).
- **Internal Order (Strictly Enforced)**:
  1. **Modal Header**: `"?"` badge + Title (`"Як дізнатися свою чергу"` / `"How to find your queue"`) + Close (`X`) button.
  2. **Block 1 — Interactive Search by Address (`"Пошук черги за адресою"` / `"Find Queue by Address"`)**:
     - Container styling: `padding(18.dp)`, `roundedCornerShape(24.dp)`, background `White.copy(alpha = 0.05f)`, **expanded border `2.dp` `White.copy(alpha = 0.25f)`**.
     - 4 stacked full-width dropdowns (`fontSize = 16.sp`, `fontWeight = Bold`, `padding(horizontal = 16.dp, vertical = 14.dp)`, `border(2.dp, White.copy(alpha = 0.20f), RoundedCornerShape(16.dp))`):
       1. **РЕМ** (`"РЕМ"` / `"District (РЕМ)"`) — defaults to `"zhytomyr"` (`"Житомирський РЕМ"`).
       2. **Населений пункт** (`"Населений пункт"` / `"City / Settlement"`) — defaults to `"zt_city"` (`"м. Житомир"`).
       3. **Вулиця** (`"Вулиця"` / `"Street"`) — **unselected by default on first launch (`""`)** with placeholder option `"Оберіть вулицю"` / `"Select street"`.
       4. **Будинок** (`"Будинок"` / `"House Number"`) — **unselected by default (`""`)** with placeholder option `"Оберіть будинок"` / `"Select house"`.
     - When a valid `house` is selected (`matchedHouseRecord != null`), renders the result card inside the block:
       - Formatted address preview (`"Житомирський РЕМ, м. Житомир,\nвул. Київська, буд. 77"`).
       - If `matchedHouseRecord.queue.isNotEmpty()`: shows `"Знайдена черга: Черга X.Y"` / `"Found Queue: Queue X.Y"`.
       - If `matchedHouseRecord.statusText != null`: shows the full status message in a bordered card.
       - If `matchedHouseRecord.emergencyOutage != null`: shows the emergency outage alert box with start & restore times.
       - Confirm Button (`#FF5E3A`, full width):
         - When queue exists: `"Обрати чергу ${queue}"` / `"Apply Queue ${queue}"`.
         - When house has no queue: `"Підтвердити вибір"` / `"Confirm selection"`.
  3. **Block 2 — Manual Search Section Header**:
     - Text: `"Пошук вручну"` (UK) / `"Manual search"` (EN).
  4. **Block 3 — Numbered Instructions `1–4`**:
     - Step 1: `"1. Відкрийте сторінку пошуку черги на сайті https://www.ztoe.com.ua/unhooking-search.php"` (clickable link, **no trailing period**).
     - Step 2: `"2. Оберіть свій РЕМ, населений пункт і вулицю."`
     - Step 3: `"3. У таблиці знайдіть свій будинок і подивіться стовпці «Черга» і «Підчерга». Наприклад, черга 5 і підчерга 2 - це 5.2."`
     - Step 4: `"4. Виберіть це значення у полі «Черга» у вікні налаштувань (кнопка ⚙)."`

### 4.2 Persisting & Restoring Selected Address Fields

- Whenever the user confirms an address in the `"?"` modal, save `selectedAddressQuery` (`remId`, `settlementId`, `streetId`, `house`) alongside `selectedAddress`, `queue`, and `customQueueStatusText`.
- Whenever Settings is opened or `showQueueHelp` transitions to `true`:
  - If `settings.selectedAddressQuery != null`, initialize the 4 dropdown states from `settings.selectedAddressQuery`.
  - Only if no address and no queue have been selected (`settings.selectedAddress == null && settings.queue.isEmpty()`) should the dropdowns reset to `remId = "zhytomyr"`, `settlementId = "zt_city"`, `streetId = ""`, `house = ""`.
- If the user manually picks a queue from the main Queue dropdown in Settings (outside the `"?"` modal), clear `customQueueStatusText = null`, `selectedAddress = null`, `selectedAddressQuery = null`, and `activeEmergencyOutage = null`.

---

## 5. ZTOE Address Lookup & Live Queue Re-Check Algorithm

### 5.1 Parsing ZTOE Address Lookup HTML Tables (`parseZtoeAddressLookupTableHtml`)

ZTOE's `/unhooking-search.php` endpoint responds to `POST` requests (`Content-Type: application/x-www-form-urlencoded`) with parameters:
```
rem_id=<ztoeRemId>&naspunkt_id=<ztoeNaspunktId>&vulica_id=<ztoeVulicaId>&all=1
```
The response bytes are encoded in `Windows-1251` (or `UTF-8`). Decode as `Windows-1251` first; if the decoded text does not contain `"Черга"` or `"Будинки"`, fall back to `UTF-8`.

Each data row `<tr>` in the returned table has two possible structures:
1. **Standard 3-column Queue Row**:
   - `<td>0`: Queue (`"1"`..`"6"`)
   - `<td>1`: Subqueue (`"1"`..`"2"`)
   - `<td>2`: Comma-separated list of building numbers (e.g., `"10, 12, 24А, 77"`).
   - Normalized queue: `"${queue}.${subqueue}"` (e.g. `"5.2"`).
2. **Colspan Status Message Row (House Without Queue)**:
   - Contains a `<td>` with `colspan="2"` (or status text such as `"В цей час не вимикається, за винятком випадків аварійних відключень"`) and a `<td>` listing the building numbers (e.g., `"104"`).
   - Normalized result: `queue = ""`, `statusText = "<full unshortened cell text>"`.

### 5.2 Preserving Selected Queue on Live Re-Check (`checkAddressOnZtoeWebsite` & `loadSchedules`)

When re-checking `selectedAddressQuery` against `/unhooking-search.php`:

```kotlin
// 1. Inside checkAddressOnZtoeWebsite(query, siteUrl):
val localMatch: ZtoeHouseLookupResult? = getHousesForStreet(query.streetId)
    .firstOrNull { it.house.equals(query.house.trim(), ignoreCase = true) }

var resolvedResult: ZtoeHouseLookupResult? = localMatch?.copy()

// Only allow live HTML table rows to assign/update queue when the house had NO queue locally:
if (matchingRows.isNotEmpty() && (localMatch == null || localMatch.queue.isEmpty())) {
    val noQueueRow = matchingRows.firstOrNull { it.queue.isEmpty() && !it.statusText.isNullOrBlank() }
    resolvedResult = if (noQueueRow != null) {
        noQueueRow.copy()
    } else {
        (matchingRows.firstOrNull { it.queue.isNotEmpty() } ?: matchingRows.first()).copy()
    }
}

// Always check for active emergency outages for this address:
val emergencyOutage = checkEmergencyOutageOnZtoe(query, decodedHtml)
resolvedResult = resolvedResult?.copy(emergencyOutage = emergencyOutage)
```

```kotlin
// 2. Inside loadSchedules(currentSettings):
val hadNoQueue = currentSettings.queue.isBlank()
val queueAssignedForNoQueueHouse = hadNoQueue &&
    (latestAddressLookup.queue != currentSettings.queue ||
     latestAddressLookup.statusText != currentSettings.customQueueStatusText)

if (queueAssignedForNoQueueHouse || emergencyChanged) {
    val nextQueue = if (queueAssignedForNoQueueHouse) latestAddressLookup.queue else currentSettings.queue
    val nextStatusText = if (queueAssignedForNoQueueHouse) latestAddressLookup.statusText else currentSettings.customQueueStatusText
    val updatedSettings = currentSettings.copy(
        queue = nextQueue,
        customQueueStatusText = nextStatusText,
        activeEmergencyOutage = nextEmergency
    )
    saveSettings(updatedSettings)
}
```
This guarantees:
- Selecting `вул. Київська, буд. 77` (`5.2`) **never** gets overwritten to `3.2`.
- Selecting `вул. Київська, буд. 104` (`queue = ""`) preserves its no-queue status as long as ZTOE lists the no-outage message row, and automatically assigns a queue if ZTOE later assigns one.
- Emergency outages (`activeEmergencyOutage`) are always updated on every refresh for all saved addresses.

---

## 6. Emergency Outages (`"Аварійне відключення"`) Algorithm

### 6.1 Parsing `pw_accidents` JSON & HTML Emergency Tables

ZTOE embeds active emergency and planned accidents in `/unhooking-search.php` inside a JavaScript variable:
```js
var pw_accidents = JSON.parse('...'); // or var pw_accidents = [...];
```
Each record in `pw_accidents` has the shape:
```json
{
  "id": 391476673,
  "city": { "name": "Житомир" },
  "street": { "name": "вул. Київська" },
  "buildingNames": "18, 20, 22, 29, 31, 31А, 33, 35, 37",
  "dateEvent": "2026-11-09T22:00:00+00:00",
  "datePlanIn": "2026-11-09T23:59:00+00:00",
  "typeOff": 1,
  "switchSubReason": 2
}
```

#### Matching Rules (`matchEmergencyOutageFromAccidentsJson`):
1. **City Match**: Normalize both `record.city.name` and the user's settlement name by stripping prefixes (`"м."`, `"с."`, `"смт"`, `"селище"`) and parenthetical suffixes, then compare case-insensitively.
2. **Street Match**: Normalize both `record.street.name` and the user's street name by stripping street type prefixes (`"вул."`, `"вулиця"`, `"пров."`, `"провулок"`, `"просп."`, `"майдан"`, `"бульвар"`, `"шосе"`), then compare case-insensitively.
3. **House Token Match**: Split `record.buildingNames` by `[,;]` into trimmed tokens (stripping `"буд."` prefix) and check for an exact case-insensitive match with `query.house.trim()`.
4. **Timestamp Formatting (`formatIsoAccidentDate`)**: Convert ISO-8601 `"YYYY-MM-DDTHH:mm:ss..."` into `"DD.MM.YYYY HH:mm"`.
5. **Fallback**: If `pw_accidents` is absent, parse any HTML `<table>` containing `"Аварійне"` / `"аварійн"` and `"Відновлення"` / `"Включення"` (`parseZtoeEmergencyOutagesTableHtml`).

### 6.2 Priority & Schedule Merging (`applyEmergencyOutageToSchedule`)

Emergency outages take **priority** over regular ZTOE schedules and merge seamlessly with them:

1. Parse `emergencyOutage.startTime` and `emergencyOutage.estimatedRestoreTime` (`"DD.MM.YYYY HH:mm"`) into epoch minutes `(year, month, day, minuteOfDay)`.
2. Determine the target day's date `(targetYear, targetMonth, targetDay)`:
   - Parse `schedule.dateStr` (`"YYYY-MM-DD"`), or use `Europe/Kyiv` Today (`isTomorrow = false`) / Tomorrow (`isTomorrow = true`).
3. Compute the overlap window `[overlapStartMin, overlapEndMin]` on that day (`0..1440`):
   - If the outage starts on the target day and restores on a later day (spanning midnight):
     - On **Today**: `overlapStartMin = startMinuteOfDay`, `overlapEndMin = 1440` (`24:00`).
     - On **Tomorrow**: `overlapStartMin = 0` (`00:00`), `overlapEndMin = restoreMinuteOfDay`.
   - If the outage starts and ends on the same day:
     - `overlapStartMin = startMinuteOfDay`, `overlapEndMin = restoreMinuteOfDay`.
4. If the base schedule has `slots.isEmpty()` (e.g., a house without a queue or an unclear schedule), first generate 48 `POWER_ON` half-hour slots (`00:00`..`24:00`) and set `isUnclear = false`.
5. For each of the 48 half-hour slots (`slotStart = slot.hour * 60 + slot.minute`, `slotEnd = slotStart + 30`):
   - If `slotEnd > overlapStartMin && slotStart < overlapEndMin`, override the slot to:
     ```kotlin
     slot.copy(status = OutageStatus.POWER_OFF, isEmergency = true)
     ```
   - Note: Even if the slot was already `POWER_OFF` from the regular schedule (coinciding outage), `isEmergency` **must** be set to `true` so the Today/Tomorrow interval list marks that merged interval with `"!"`.

### 6.3 Interval Extraction with `isEmergency` Propagation (`getBlackoutIntervals`)

When merging consecutive `POWER_OFF` / `MAYBE_OFF` half-hour slots into `BlackoutInterval` items:
- Start a new interval when `current == null`, or when `slot.status != current.status`, or when `slot.startTime != current.end`.
- While extending an interval with consecutive `POWER_OFF` slots:
  ```kotlin
  if (slot.isEmergency) {
      current.isEmergency = true
  }
  ```
- As a result, if an emergency outage (`11:30–17:00`) overlaps or bridges scheduled outages (`10:00–14:00` and `16:00–20:00`), they merge into a single continuous interval (`10:00 – 20:00`, `10 год`) with `isEmergency = true`, and the countdown timer at `14:30` counts down continuously to `20:00` (or across midnight into tomorrow's merged schedule).

### 6.4 Emergency Outage State-Transition Notifications (`checkAndTriggerEmergencyOutageAlert`)

```kotlin
fun checkAndTriggerEmergencyOutageAlert(
    prevOutage: EmergencyOutageInfo?,
    nextOutage: EmergencyOutageInfo?,
    settings: UserSettings,
    lang: String
): NotificationRecord? {
    if (!settings.notificationsEnabled) return null

    // 1. Outage Restored (prev active -> next null)
    if (prevOutage != null && nextOutage == null) {
        val restoreKey = "emergency_restore_${prevOutage.id}_${prevOutage.startTime}"
        if (AlertRegistry.hasFired(restoreKey)) return null
        AlertRegistry.markFired(restoreKey)
        val title = if (lang == "uk") "Аварійне відключення завершено" else "Emergency Outage Restored"
        val body = if (lang == "uk")
            "Електропостачання за вашою адресою відновлено (початок був: ${prevOutage.startTime})."
        else
            "Power supply at your address has been restored (started: ${prevOutage.startTime})."
        triggerSystemNotification(title, body, settings)
        return NotificationRecord(title = title, message = body)
    }

    // 2. Outage Detected (next active)
    if (nextOutage != null) {
        val detectKey = "emergency_detect_${nextOutage.id}_${nextOutage.startTime}_${nextOutage.estimatedRestoreTime}"
        if (AlertRegistry.hasFired(detectKey)) return null
        AlertRegistry.markFired(detectKey)
        val title = if (lang == "uk")
            (nextOutage.outageType.ifBlank { "Аварійне відключення" })
        else
            "Emergency Outage"
        val body = if (lang == "uk")
            "Зафіксовано аварійне відключення. Початок: ${nextOutage.startTime}. Орієнтовне відновлення: ${nextOutage.estimatedRestoreTime}."
        else
            "Emergency outage detected. Start: ${nextOutage.startTime}. Estimated restore: ${nextOutage.estimatedRestoreTime}."
        triggerSystemNotification(title, body, settings)
        return NotificationRecord(title = title, message = body)
    }

    return null
}
```

---

## 7. Today / Tomorrow Blackout List & `"!"` Indicator Alignment

### 7.1 Dynamic Tab Headers

- When **Today** tab (`selectedDayTab == 0`) is selected:
  - UK: `"Години відключень на сьогодні:"`
  - EN: `"Blackout hours for today:"`
- When **Tomorrow** tab (`selectedDayTab == 1`) is selected:
  - UK: `"Години відключень на завтра:"`
  - EN: `"Blackout hours for tomorrow:"`

### 7.2 Fixed `20x20.dp` Leading Indicator Slot

To prevent the `"!"` emergency icon from shifting timeslot text to the right compared to regular intervals, **every** interval row reserves a fixed `20x20.dp` box before the `HH:MM – HH:MM` text:

```kotlin
Row(
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.spacedBy(10.dp)
) {
    // Fixed 20x20dp alignment container for both emergency ("!") and regular dot indicators
    Box(
        modifier = Modifier.size(20.dp),
        contentAlignment = Alignment.Center
    ) {
        if (interval.isEmergency) {
            Box(
                modifier = Modifier
                    .size(20.dp)
                    .background(Color(0xFFFF5E3A).copy(alpha = 0.2f), CircleShape)
                    .border(2.dp, Color(0xFFFF5E3A), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "!",
                    color = Color(0xFFFF5E3A),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Black
                )
            }
        } else {
            Box(
                modifier = Modifier
                    .size(10.dp)
                    .background(Color(0xFFFF5E3A), CircleShape)
            )
        }
    }

    Text(
        text = "${interval.start} – ${interval.end}",
        fontFamily = FontFamily.Monospace,
        fontWeight = FontWeight.Black,
        fontSize = 15.sp,
        color = Color.White
    )
}
```

---

## 8. Battery, Performance & Caching Optimizations for Android

1. **Lifecycle-Aware 1-Second Ticker**:
   - In Jetpack Compose, run the `1000L` delay loop inside a `LaunchedEffect(lifecycleState, selectedPage, isRouletteOpen)` that immediately exits unless:
     ```kotlin
     lifecycleState == Lifecycle.State.RESUMED && selectedPage == 0 && !isRouletteOpen
     ```
2. **Cached `TimeZone` & `Calendar` + Pre-Compiled `Regex`**:
   - Store `TimeZone.getTimeZone("Europe/Kyiv")` and all HTML/table `Regex` instances (`leafTableRegex`, `trRegex`, `tdRegex`, `dateHeaderRegex`, `pwAccidentsRegex`) as `private val` constants on `object ZtoeParser` / `object KyivZone`.
3. **HTTP `ETag` / `If-None-Match` Support**:
   - Save the response `ETag` header in `SharedPreferences` (`ztoe_last_etag`) alongside the cached HTML (`ztoe_last_html`).
   - Send `If-None-Match` on subsequent requests; on `HTTP 304 Not Modified`, reuse the cached schedule without re-parsing HTML.
4. **Bounded In-Memory & Persistent Caches**:
   - Limit `ScheduleRepository` interval memoization cache to `MAX_INTERVAL_CACHE_ENTRIES = 64` (evicting oldest entries first).
   - Limit `AlertRegistry` fired-slot keys in `SharedPreferences` to `MAX_STORED_ENTRIES = 100`.
5. **Midnight Rollover (`00:00` `Europe/Kyiv`)**:
   - Store `cached_schedule_date` (`"YYYY-MM-DD"`) when saving `today` and `tomorrow` slots.
   - When `loadCachedTodaySlots()` runs and `cached_schedule_date == yesterdayIsoString(now)` (i.e. midnight just rolled over), automatically promote `tomorrow_slots` to `today_slots`, clear `tomorrow_slots`, and update `cached_schedule_date = todayIsoString(now)`.
6. **Smart `WorkManager` Rescheduling**:
   - When `onUpdateSettings` is called, compare `newSettings.refreshIntervalMinutes != oldSettings.refreshIntervalMinutes`. Only call `WorkManager.enqueueUniquePeriodicWork(..., ExistingPeriodicWorkPolicy.UPDATE, ...)` when the interval actually changed.
7. **24-Hour Donations Cache (`DonationsRepository`)**:
   - Store `donations_last_fetch_ms` and `donations_cached_json` in `SharedPreferences`.
   - Only fetch remote `donations.json` from GitHub when `nowMs - lastFetchMs >= 86_400_000L` (24 hours) or `forceRefresh == true`.
8. **Widget Interactive Toggle Alarm Sync**:
   - When the user taps the notification mute/unmute button on the Home Screen Widget (`Glance` `ActionCallback`), after calling `SettingsRepository.updateNotificationsEnabled(!enabled)`, immediately invoke `NotificationScheduler.syncAlarms(context)` so scheduled `AlarmManager` pre-warnings are canceled or restored in sync with the widget state.

---

## 9. Android Architecture Mapping Table

| Feature / Module | Web Simulator Reference | iOS Reference (`ios/`) | Android Target (`android/`) |
| :--- | :--- | :--- | :--- |
| **Settings & Persistence** | `src/services/alertManager.ts` | `ios/Shared/SettingsRepository.swift` | `SettingsRepository.kt` (`SharedPreferences`) |
| **Address Lookup & Emergency Parser** | `src/services/ztoeAddressLookup.ts` | `ios/Shared/ZtoeParser.swift` | `ZtoeAddressLookup.kt` & `ZtoeParser.kt` |
| **Schedule Overlap & Countdown** | `src/services/ztoeParser.ts` | `ios/Shared/ScheduleRepository.swift` | `ScheduleRepository.kt` |
| **Main Screen & First-Launch Overlay** | `src/components/MainView.tsx` | `ios/ZTPreBlackout/UI/MainScreen.swift` | `MainScreen.kt` (Jetpack Compose) |
| **Full-Screen `"?"` Address Modal** | `src/components/SettingsView.tsx` | `ios/ZTPreBlackout/UI/SettingsScreen.swift` | `SettingsScreen.kt` (Compose `Dialog` / FullScreen) |
| **Navigation & 1s Ticker Gating** | `src/components/PhoneSimulator.tsx` & `src/App.tsx` | `ios/ZTPreBlackout/UI/BlackoutAppNavigation.swift` | `BlackoutAppNavigation.kt` (`HorizontalPager`) |
| **Pre-Warning & Emergency Notifications** | `src/services/alertManager.ts` | `ios/ZTPreBlackout/Notifications/NotificationScheduler.swift` | `NotificationScheduler.kt` (`AlarmManager` + `NotificationCompat`) |
| **Home Screen Widgets (2x1 & 4x2)** | `src/components/WidgetSimulator.tsx` | `ios/BlackoutWidgetExtension/BlackoutWidget.swift` | `BlackoutGlanceWidget.kt` (Jetpack Glance) |
| **Periodic Background Sync** | `src/App.tsx` (`setInterval`) | `ios/ZTPreBlackout/Background/BackgroundSyncManager.swift` | `ScheduleSyncWorker.kt` (`WorkManager`) |

---

## 10. Verification & Unit Test Checklist for Android Port

When porting these changes to Android, verify all of the following unit and UI test cases:

- [ ] **First Launch Zero-State**: Fresh install has `queue == ""` and `language == "system"` (`Auto`). Main screen and bottom nav dock are dimmed (`0.15f`) and disabled.
- [ ] **First Launch Overlay Controls**: Centered `"Виберіть чергу"` (UK) / `"Select queue"` (EN) button appears **above** the `Auto / English / Українська` language switch.
- [ ] **First Launch Navigation Flow**: Tapping `"Виберіть чергу"` / `"Select queue"` opens Settings and automatically opens the full-screen `"?"` modal. Confirming a queue/address for the first time automatically navigates back to the Main window (`selectedPage = 0`).
- [ ] **`"?"` Modal Defaults & Persistence**: On first launch, Street (`""` -> `"Оберіть вулицю"` / `"Select street"`) and House (`""` -> `"Оберіть будинок"` / `"Select house"`) are unselected. After selecting and confirming an address, reopening the `"?"` modal keeps the selected РЕМ, Settlement, Street, and House filled in.
- [ ] **`"?"` Modal Layout**: Full-screen modal, enlarged dropdowns/fonts, expanded `2.dp` internal border on the Search by Address block, and strict order: Search by Address -> `"Пошук вручну"` / `"Manual search"` -> Steps 1–4.
- [ ] **Queue `5.2` Preservation Bug Fix**: Selecting `м. Житомир, вул. Київська, буд. 77` (`5.2`) via address search retains `5.2` after `checkAddressOnZtoeWebsite` / `loadSchedules` runs, even if live HTML contains a `3.2` row.
- [ ] **No-Queue House (`буд. 104`)**: Selecting `м. Житомир, вул. Київська, буд. 104` sets `queue = ""`, displays the full unshortened message `"В цей час не вимикається, за винятком випадків аварійних відключень"`, shows `"--:--:--"` on the main counter, hides the top queue header, wraps the address after the city (`\n`), and renders the 24h Drum Chart with light internal squares (`POWER_ON`).
- [ ] **Emergency Outage Priority & Overlap**: Active emergency outages override and merge with scheduled outages across the Main counter, 24h Drum Chart, Today/Tomorrow interval lists (including midnight-spanning and coinciding intervals), Home Screen Widgets, and state-transition notifications (fire once on detect, no duplicate while active, fire once on restore).
- [ ] **Today/Tomorrow List `"!"` Indicator & Alignment**: Emergency intervals show `"!"` in a circle (`20x20.dp`), regular intervals show a centered dot inside the same `20x20.dp` slot so all timeslot strings align horizontally, and tab headers read `"Години відключень на сьогодні:"` / `"Години відключень на завтра:"`.
- [ ] **Battery & Caching Optimizations**: 1s countdown pauses off the Main screen, `Europe/Kyiv` calendar & regexes are cached, midnight rollover promotes tomorrow's cached schedule, caches are bounded, and `donations.json` refreshes at most once every 24 hours.
