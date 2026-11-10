# Comprehensive iOS Handover Plan — Світло в Житомирі (`iOS-ZTPreBlackoutNotification`)

**Target Repository:** `https://github.com/IgorZaharov/iOS-ZTPreBlackoutNotification`  
**Source Android Repository:** `https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning`  
**Release Version:** `v1.3.3`  
**Target Platform:** Native iOS 17.0+ (`Swift 5.10`, `SwiftUI`, `WidgetKit`, `AppIntents`, `AVFoundation`, `UserNotifications`, `BackgroundTasks`) + Interactive 16:10 iPhone Emulator in Google AI Studio (React 19 + TypeScript + Vite)

---

## 1. Executive Summary & Repository Isolation Rules

This handover plan contains the complete functional, visual, architectural, localization, audio, mini-game, and CI/CD specifications required to build the native iOS port of **Світло в Житомирі** in a **separate Google AI Studio project** synced to **`https://github.com/IgorZaharov/iOS-ZTPreBlackoutNotification`**.

### 1.1 Critical `.gitignore` Rule (Push ONLY iOS Files to GitHub)
When the new Google AI Studio project is synced to `https://github.com/IgorZaharov/iOS-ZTPreBlackoutNotification`, `.gitignore` **must** exclude all AI Studio web/Node.js emulator scaffolding so that **only iOS-related files** are pushed to the GitHub repository, while the 16:10 Emulator continues running locally inside Google AI Studio on port 3000:

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

---

## 2. Architecture & Target Structure (`/ios`)

```
+-----------------------------------------------------------------------------------+
|                   https://www.ztoe.com.ua/unhooking-search.php                    |
|            (Windows-1251 HTML tables with 48 half-hour cells per queue)           |
+-----------------------------------------+-----------------------------------------+
                                          |
                 HTTP GET (Accept-Encoding: gzip, If-None-Match / ETag)
                                          v
+-----------------------------------------------------------------------------------+
|                         ZtoeParser.swift / ztoeParser.ts                          |
|  1. Validates URL strictly against valid-urls.json                                |
|  2. Decodes Windows-1251 stream (or returns cached data on HTTP 304 Not Modified) |
|  3. Matches Today & Tomorrow leaf tables via exact (day, month, year) regex       |
|  4. Extracts all 12 queues in a single pass (48 slots/day, 30-min resolution)     |
|  5. Clears cache & sets isUnclear = true if unreachable or no queues found        |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|              Shared App Group UserDefaults (group.com.ZTBlackoutPreWarning)       |
|  - Persists today & tomorrow slots + per-queue ISO dates (Europe/Kyiv)            |
|  - Merges contiguous 30-min POWER_OFF slots into DetailedIntervals                |
|  - Computes real-time countdown (Today -> Tomorrow 1st blackout -> "--:--:--")    |
|  - Persists UserSettings & Zhytomyr Roulette progress                             |
+-------------------+---------------------+---------------------+-------------------+
                    |                     |                     |
                    v                     v                     v
      +-----------------------+ +-------------------+ +-----------------------+
      |      SwiftUI App      | | NotificationSched | |  WidgetKit Extension  |
      | - MainScreen.swift    | | & BGTaskScheduler | | - Small (systemSmall) |
      | - SettingsScreen.swift| | - Pre-schedules   | | - Big (systemMedium)  |
      | - AboutScreen.swift   | |   calendar alerts | | - САЗУ-ИТ 24h chart   |
      | - ZhytomyrRoulette    | |   for active queue| | - RefreshWidgetIntent |
      +-----------------------+ +-------------------+ +-----------------------+
```

### 2.1 Declarative Xcode Project via `XcodeGen` (`ios/project.yml`)
Define `ios/project.yml` with three targets:
1. **`ZTPreBlackoutNotification`** (`application`, iOS 17.0, Bundle ID `com.ZTBlackoutPreWarning`):
   - Entitlements: `com.apple.security.application-groups: ["group.com.ZTBlackoutPreWarning"]`
   - `Info.plist`: `UIBackgroundModes: ["fetch", "processing"]`, `BGTaskSchedulerPermittedIdentifiers: ["com.ZTBlackoutPreWarning.sync"]`, `CFBundleDisplayName: "Світло в Житомирі"`, `MARKETING_VERSION: "1.3.3"`.
   - Bundled resources: `valid-urls.json`, `donations.json`, 3 background music MP3s (`audio_start_shop_gameover.mp3`, `audio_start_shop_2.mp3`, `audio_main_game.mp3`), 7 SFX MP3s (`sfx_lightbulb.mp3`, `sfx_scratch.mp3`, `sfx_cash_register.mp3`, `sfx_flicker.mp3`, `sfx_coin.mp3`, `sfx_2x_coin.mp3`, `sfx_shuffle.mp3`), and 9 ticket foil images (`ticket_foil_pristine.png`, `ticket_foil_wrinkled.png`, `ticket_foil_deep_wrinkled.png`, `ticket_foil_crumpled_scratched.png`, `ticket_foil_cup_stain.png`, `ticket_foil_stain_corner.png`, `ticket_foil_water_stains.png`, `ticket_foil_heavy_wear.png`, `ticket_foil_faded.png`).
2. **`BlackoutWidgetExtension`** (`app-extension`, iOS 17.0, Bundle ID `com.ZTBlackoutPreWarning.Widget`):
   - Entitlements: `com.apple.security.application-groups: ["group.com.ZTBlackoutPreWarning"]`
   - Provides `SmallBlackoutWidget` (`systemSmall`) and `MediumBlackoutWidget` (`systemMedium`) with `RefreshWidgetIntent` and `ToggleAlertsIntent`.
3. **`ZTPreBlackoutNotificationTests`** (`bundle.unit-test`, iOS 17.0):
   - Runs `ZtoeParserTests.swift` verifying ZTOE HTML parsing, 48-slot graph parity, default settings, tomorrow 1st-blackout countdown, and Zhytomyr Roulette mechanics.

---

## 3. Core Subsystems & Exact Business Logic Specifications

### 3.1 Timezone & Date Handling (`KyivZone.swift`)
- Always resolve Kyiv timezone using `TimeZone(identifier: "Europe/Kyiv") ?? TimeZone(identifier: "Europe/Kiev") ?? .current`.
- Format dates as `dd.MM.yyyy` for table matching and `yyyy-MM-dd` for cache keys.

### 3.2 ZTOE HTML Parser (`ZtoeParser.swift`)
1. **Allowed URLs (`valid-urls.json`)**:
   - `["https://www.ztoe.com.ua/unhooking-search.php", "https://example.com"]`
   - Reject any URL not in `valid-urls.json` (ignoring trailing slashes), clear schedule cache, and return `FetchStatus.NO_QUEUES_FOUND` with empty slots (`isUnclear = true`).
2. **Encoding & Conditional Caching**:
   - Decode bytes using Windows-1251 (`CFStringConvertEncodingToNSStringEncoding(CFStringEncoding(CFStringEncodings.windowsCyrillic.rawValue))`), falling back to `.utf8` if `"Черга"` / `"черга"` is found in UTF-8.
   - Support `Accept-Encoding: gzip`, `If-None-Match` (`ETag`), `If-Modified-Since`, and a 20-second in-memory document cache.
3. **Leaf Table & Date Matching**:
   - Filter leaf `<table>` elements (tables containing no nested `<table>` and at least 12 `<tr>` rows whose text includes both `"1.1"` and `"6.2"`).
   - Inspect the first 2 `<tr>` header rows using bounded regex `(?<!\d)(\d{1,2})\.(\d{1,2})\.(\d{4})(?!\d)` (or `(?<!\d)(\d{1,2})\.(\d{1,2})(?!\.\d|\d)` fallback) and compare integer `(day, month, year)` against `today` and `tomorrow`.
4. **48 Half-Hour Slot Extraction**:
   - Locate the `<tr>` whose first 3 cells match `targetQueue` (`"1.1"`, `"Черга 1.1"`, `"Черга 1.1."`, `"1.1 черга"`).
   - Filter out separator `<td` cells with `width:3pt` or `width:1pt`, and take the last 48 (or 24) cells.
   - Mark a slot as `POWER_OFF` if its lowercase `style` / `bgcolor` / `class` / text contains any of:
     `#ff3333`, `#ff3b30`, `#ff0000`, `background:red`, `background: red`, `background-color:red`, `background-color: red`, `rgb(255, 51, 51)`, `rgb(255,51,51)`, `rgb(255, 0, 0)`, `rgb(255,0,0)`, `danger`, or cell text `вимк`, `відкл`, `в`, `-`.
   - **CRITICAL**: Never match generic `#ff` because `#ffffff` is white (`POWER_ON`).
5. **Unreachable / No Queues Behavior**:
   - When the site is unreachable (`NO_INTERNET`) or returns no queue tables (`NO_QUEUES_FOUND`), clear the schedule cache (`clearScheduleCache()`), return `todaySlots = []`, and mark the schedule as `isUnclear = true`. Never use cached schedules when the current URL fails validation or parsing.

### 3.3 Contiguous Interval Aggregation & Countdown Engine (`ScheduleRepository.swift`)
1. **Contiguous Block Merging (`computeDetailedIntervals`)**:
   - Merge adjacent 30-minute `POWER_OFF` slots into contiguous `DetailedInterval` blocks (`startStr`, `endStr`, `startMinuteOfDay`, `endMinuteOfDay`, `durationHours`).
   - Cache intervals using a content-based 48-char signature (`"${slots.count}_" + slots.map { $0.status == .POWER_OFF ? "1" : "0" }.joined()`), never object identity.
2. **Countdown Calculation (`calculateStatusAndCountdown`)**:
   - **Unclear State (`slots.isEmpty`)**: Returns `isUnclear = true`, status `"Невідомо"` / `"Unclear"`, countdown `"--:--:--"`, and next period `"--:-- - --:--"`.
   - **Currently in Blackout (`isBlackoutNow == true`)**: Counts down to the end of the active contiguous block (if the block ends at `24:00` and `tomorrowSlots` starts with a blackout at `00:00`, adds tomorrow's first block duration so cross-midnight outages show the true restoration countdown).
   - **Power ON, Upcoming Blackout Today**: Counts down to `nextToday.startMinuteOfDay` and sets `nextSlotTime = "\(nextToday.startStr) – \(nextToday.endStr)"`.
   - **Power ON, All Today's Blackouts Ended, Tomorrow Schedule Available**: Counts down to `1440 + firstTomorrow.startMinuteOfDay` and sets `nextSlotTime = "\(firstTomorrow.startStr) – \(firstTomorrow.endStr)"` (tomorrow's 1st blackout, never today's 1st blackout).
   - **Power ON, No Remaining Blackouts**: Returns `"--:--:--"` and `"Відключень немає"` / `"No outages"`.

### 3.4 Pre-Warning Notifications (`NotificationScheduler.swift`)
- When `notificationsEnabled == true`, schedule one `UNCalendarNotificationTrigger` per contiguous `DetailedInterval` for the active queue at `blockStartTime - advanceNoticeMinutes`.
- Deduplicate notifications via `AlertRegistry` (`block_${date}_${startStr}_${endStr}_Q${queue}`) so each contiguous blackout block triggers at most 1 pre-warning alert.
- Respect `soundEnabled` (`UNNotificationSound.default` vs `nil`) and `vibrationEnabled`.
- When the master Notifications toggle is switched OFF, save `soundEnabled` and `vibrationEnabled` into `prev_sound_enabled` and `prev_vibration_enabled` and set both to `false`; when switched back ON, restore both values.

---

## 4. UI, Visual Design & Color Specifications (100% Parity)

### 4.1 Color Tokens & Time-of-Day Palettes
- **Card Surface**: `Color(hex: "#141A29").opacity(0.75)` with `24pt` corner radius and `1px` `Color.white.opacity(0.15)` stroke.
- **Primary Accent**: `Color(hex: "#FF5E3A")`.
- **Time-of-Day Ambient Palettes** (`TimeOfDayPalette.swift`):
  - `morning` (`05:00–11:00`, anchor `08:00`): Primary `#F4F9F9`, Secondary `#4A7C59`, Accent `#FFB085`, Supporting `#2C3E35`
  - `day` (`11:00–17:00`, anchor `14:00`): Primary `#FFFFFF`, Secondary `#0A2540`, Accent `#FFD166`, Supporting `#4682B4`
  - `evening` (`17:00–22:00`, anchor `19:30`): Primary `#1A0B2E`, Secondary `#8B3A62`, Accent `#FF6B6B`, Supporting `#FFE66D`
  - `night` (`22:00–05:00`, anchor `01:30`): Primary `#0B0C10`, Secondary `#1F2833`, Accent `#66FCF1`, Supporting `#C5C6C7`

### 4.2 Main Screen (`MainScreen.swift`)
- **Top Header**: Queue indicator (`Черга 1.1`..`6.2`) + Bell toggle button.
- **Hero Countdown Card**:
  - Status text: `"СВІТЛО Є"` / `"POWER ON"`, `"СВІТЛА НЕМАЄ"` / `"POWER OFF"`, or `"Невідомо"` / `"Unclear"`.
  - Countdown timer (`HH:MM:SS` or `"--:--:--"`).
  - Next period row (`Найближчий період:` / `Next period:`): `"HH:MM – HH:MM"`, `"Відключень немає"`, or `"--:-- - --:--"`.
- **Schedule Card**:
  - Today (`Сьогодні`) / Tomorrow (`Завтра`) segmented tabs.
  - **24-Hour САЗУ-ИТ Timeline (`TimelineBar.swift`)**:
    - 24 hour columns x 2 half-hour sub-blocks (`slots[hour * 2]` and `slots[hour * 2 + 1]`).
    - When `isUnclear == true`, renders grey bar with centered `"Графіки не діють"` / `"Outages unclear"` text and hides the blackout hours list below.
  - **Blackout Hours List**: `"ГОДИНИ БЕЗ СВІТЛА НА СЬОГОДНІ:"` / `"BLACKOUT HOURS FOR TODAY:"` (updates immediately when switching between Today and Tomorrow tabs).
- **Bottom Link Cards**:
  1. `"Інформація про аварійні відключення:"` -> `https://www.facebook.com/ztoe.com.ua` (with Facebook icon and external-link icon).
  2. `"Графіки відключень на сайті"` -> `https://www.ztoe.com.ua/unhooking-search.php`.

### 4.3 Settings Screen (`SettingsScreen.swift`)
- **Header**: Tune icon (`#FF5E3A`) + `"Налаштування"` / `"Settings"`.
- **Card 1 — Queue Selection**:
  - Title `"Черга відключення"` + `?` help button (`#FF5E3A`).
  - Clicking `?` opens the Queue Help Dialog with exact 4 numbered steps:
    1. `1. Відкрийте сторінку пошуку черги на сайті https://www.ztoe.com.ua/unhooking-search.php.` (with clickable underlined orange link)
    2. `2. Оберіть свій РЕМ, населений пункт і вулицю.`
    3. `3. У таблиці знайдіть свій будинок і подивіться стовпці «Черга» і «Підчерга». Наприклад, черга 5 і підчерга 2 - це 5.2.`
    4. `4. Виберіть це значення у полі «Черга» у вікні налаштувань (кнопка ⚙).`
- **Card 2 — Site URL**:
  - Title `"Адреса сайту з графіком"` + verification badge (`"✓ Доступний"` / `"Reachable"`, `"Немає доступу до Інтернету"` / `"No Internet access"`, or `"На сайті не знайдено черг"` / `"No queues found on site"`).
  - Text field for `siteUrl` (`https://www.ztoe.com.ua/unhooking-search.php`).
- **Card 3 — Timers**:
  - `"Попереджати заздалегідь (хв)"` (`1–240 хв` picker, **default `15`**).
  - `"Інтервал перевірки сайту (хв)"` (`1–240 хв` picker, **default `30`**).
- **Card 4 — Notification Switches**:
  - `"Увімкнути сповіщення"`, `"Звук сповіщення"`, `"Вібрація"` with `#FF5E3A` active track color.
- **Card 5 — Language Selection**:
  - `"Мова інтерфейсу"` with 3 buttons: `"Системна"` / `"System"`, `"Українська"`, `"English"`.
- **Card 6 — Diagnostics & Actions**:
  - `"Тест сповіщення"` / `"Test notification"` button (`#FF5E3A`).
  - `"Оновити дані"` / `"Refresh data"` button.
  - `"Скинути налаштування"` / `"Reset to defaults"` button with confirmation dialog.

### 4.4 About Screen (`AboutScreen.swift`)
- App icon (`#FF5E3A`), `"Світло в Житомирі"`, `v1.3.3` badge.
- Links Card:
  1. `"Профіль розробника"` -> `https://github.com/IgorZaharov`
  2. `"Світло в Житомирі на Github"` -> `https://github.com/IgorZaharov/iOS-ZTPreBlackoutNotification/blob/main/README.md`
  3. `"Повідомити про помилку / Ідеї"` -> `https://github.com/IgorZaharov/iOS-ZTPreBlackoutNotification/issues`
- Charity Card (`"Charity / Благодійність і Пожертви"`):
  - Fetches `donations.json` once every 24h + on startup; default links:
    1. `"Допомога тваринам"` — `https://send.monobank.ua/jar/7vJA5xrLoV`
    2. `"Фонд Повернись Живим"` — `https://savelife.in.ua/donate/`
- Mini-Game Button (directly below Charity Card):
  - `"Житомирська Рулетка"` (UK) / `"Zhytomyr Roulette"` (EN).

### 4.5 WidgetKit Home Screen Widgets (`BlackoutWidget.swift`)
- **Small Widget (`systemSmall`)**: 20% transparent dark background (`#CC141A29`), status badge (`"СВІТЛО Є"` / `"СВІТЛА НЕМАЄ"` / `"НЕВІДОМО"`), queue badge, countdown without seconds (`HHг. MMхв.` / `HHhr. MMm.`), round Refresh button (`RefreshWidgetIntent`), and round Bell button (`ToggleAlertsIntent`).
- **Medium Widget (`systemMedium`)**: Adds the 24-hour САЗУ-ИТ 48-half-hour timeline bar and next blackout period (`--:-- - --:--` when unclear).

---

## 5. Житомирська Рулетка Mini-Game Specification (`ZhytomyrRouletteScreen.swift`)

1. **Navigation & Layout**:
   - Hides the application's bottom navigation bar while open.
   - Crossfade transitions between `START`, `SHOP`, `PLAYING`, `FADING_TO_BLACK`, and `GAME_OVER` screens, preserving ticket scroll position on Game Over.
2. **Tickets & Scratching Mechanics**:
   - 48 half-hour tickets (`00:00-00:30` .. `23:30-24:00`) grouped into 24 hourly rows of 2 columns.
   - 9 non-uniform ticket foil variants (`pristine`, `wrinkled`, `deep_wrinkled`, `crumpled_scratched`, `cup_stain`, `stain_corner`, `water_stains`, `heavy_wear`, `faded`) with randomized stain placement coordinates (`wrinkleDepth >= 0.65` for `deep_wrinkled`).
   - At least 1 beige ticket has an `X2` multiplier by default when tickets load.
   - Red tickets have NO red border outline; only the center lightbulb is red.
   - Scratching threshold (`TICKET_SCRATCH_REVEAL_THRESHOLD = 0.30`): a ticket is revealed immediately when the scratch stroke exposes the center lightbulb area (`doesScratchExposeRedCenterOutline`) OR when `>= 30%` of the ticket surface is scratched.
   - Distinguishes vertical scroll gestures from horizontal/diagonal scratch gestures so players can scroll the 24 rows without accidentally scratching tickets.
3. **Scoring, Deal Animation, Shuffling & Game Events**:
   - Hardcoded maximum score: `MAX_ROULETTE_SCORE = 9_999_999` (clamped on both current score and all-time best score).
   - 2-second (`TICKET_SHUFFLE_ANIMATION_DURATION_MS = 2000`) top-border deal animation (`24` rows) on game start, `"Отримати нові білети"` refresh, and when score exceeds `999`.
   - When single-game score reaches `> 999` (`SCORE_SHUFFLE_THRESHOLD = 999`), tickets shuffle into random non-chronological positions (`shuffleTicketPlaces`) once per game.
   - 1-second (`GAME_OVER_REALIZATION_DELAY_MS = 1000`) delay after scratching a fatal Red ticket before fading to Game Over, accompanied by a `2.4s+` multi-frame exploding bulb animation (`MultiFrameExplodingBulbCanvas`).
   - Random screen flicker (`FLICKER_BUZZ_VOLUME_SCALE = 0.575`, `FLICKER_SFX_VOLUME_MULTIPLIER = 0.9`) and 10-second Game Blackout (`GAME_BLACKOUT_DURATION_MS = 10000`, `GAME_BLACKOUT_VOLUME_SCALE = 0.575`) with glowing orange border outline.
4. **Power Points, Milestones & Power Shop Upgrades**:
   - Milestone Progress Bar (`150`, `400`, `1000`) with `24x20` reward icons on `START` and `GAME_OVER` screens:
     - Milestone `400` unlocks **`Daily Streak`** (`daily_streak` — doubles final score `X2` on the first game of the day before Game Over).
     - Milestone `1000` unlocks **`Perseverance`** (`perseverance` — grants `+1` extra heart life, cumulative with `Second Chance` for up to `2` extra hearts / `3` lives total; displayed as heart icons in the game header).
   - Power Shop (`Магазин Потужності`) Upgrades:
     - `friend_ztoe` (`Друг в обленерго`): Auto-reveals 1 safe ticket on game start (if it opens a Golden Ticket, reveals all beige tickets and awards cumulative points).
     - `second_chance` (`Другий шанс`): First Red ticket counts as a beige ticket and consumes 1 heart.
     - `golden_ticket` (`Золотий білет`): Increases Golden Ticket spawn probability.
     - `more_x2` (`Більше X2`): Increases X2 beige ticket count.
     - `streak_bonus` (`Бонус серії`): Increases point step per consecutive beige ticket.
     - `black_cat` (`Чорний кіт`): Sends fake blackout notification `<HH:MM>-23:00` for user's queue.
     - `nocturnal_creature` (`Нічна істота`): Active between `22:00` and `03:59`.
     - `deposit_power_points` (`Депозит Потужність+`): Awards `+15%` Power Points every 24h on game launch. Includes **FinMon AntiCheat**: if current timestamp is earlier than the recorded payout date (`nowMs < recordedPayoutDateMs`), locks the upgrade permanently with description `"На розгляді ФінМоніторинга"`, zeroes Power Points, and disables future payouts.
5. **Audio & SFX Constants (`RouletteAudioEngine.swift`)**:
   - Separate `Звук` (`Sound`) and `Музика` (`Music`) switches on the left side aligned at the top with the `Share` button, with `12pt` (`gap-3`) vertical spacing between the two switches.
   - Mutes music and SFX immediately when the application enters background/minimized state and resumes music when returning to foreground.
   - Background Music: `ROULETTE_MUSIC_VOLUME = 0.15` (`15%`), fade-in/out (`>= 500ms`), `2000ms` delay before Game Over music fade-in, and random selection between `audio_start_shop_gameover.mp3` and `audio_start_shop_2.mp3` when entering `START` (persisting when navigating `START -> SHOP`).
   - SFX Volumes & Sequencing:
     - `SCRATCH_VOLUME_SCALE = 0.575`, `SCRATCH_SFX_VOLUME_MULTIPLIER = 0.9`, `SCRATCH_SFX_DURATION_MS = 336`.
     - `COIN_VOLUME_SCALE = 0.75` (`playCoinSound` and `play2XCoinSound` wait `getRemainingScratchSoundDelayMs()` so `sfx_coin.mp3` / `sfx_2x_coin.mp3` plays after `sfx_scratch.mp3` finishes).
     - `GAMEOVER_UPGRADE_VOLUME_SCALE = 0.60`.
6. **Share Card Preview & Export**:
   - Displays score, all-time best score (`Найкращий Результат` / `All time best score`), unmodified App icon, and 9 upgrade glyph states (`#475569` inactive, `#F59E0B` active).
   - 3 bottom buttons: `Поділитися` / `Share` (opens native iOS `UIActivityViewController` with image file), `Завантажити зображення` / `Download Image` (saves PNG to Photos), and `Назад` / `Back`.

---

## 6. Master Bootstrap Prompt (Copy & Paste into New AI Studio Project)

Paste the entire prompt below into your new Google AI Studio project synced to `https://github.com/IgorZaharov/iOS-ZTPreBlackoutNotification`:

```text
Build the complete native iOS port of "Світло в Житомирі" (v1.3.3) for repository https://github.com/IgorZaharov/iOS-ZTPreBlackoutNotification with 100% feature, text, icon, color, and localization parity with the Android version, plus an interactive 16:10 smartphone Emulator tab in the AI Studio preview.

CRITICAL REPOSITORY & GITIGNORE RULES:
1. This AI Studio workspace is synced to https://github.com/IgorZaharov/iOS-ZTPreBlackoutNotification, which must ONLY receive iOS-related files when pushed to GitHub.
2. Configure .gitignore to ignore all AI Studio web preview files (src/, public/, scripts/, tests/, node_modules/, dist/, package.json, package-lock.json, vite.config.ts, tsconfig.json, index.html, metadata.json, .env*, .aistudio/) while tracking ONLY:
   - ios/ (complete Swift 5.10 + SwiftUI + WidgetKit project, project.yml for XcodeGen, XCTest unit tests, bundled MP3 audio, 9 foil textures, valid-urls.json, donations.json)
   - .github/workflows/build-ios.yml (macos-latest XcodeGen + XCTest + unsigned & signed .ipa release pipeline)
   - valid-urls.json, donations.json, CHANGELOG.md, PRIVACY_POLICY.md, README.md

CORE APPLICATION SPECIFICATIONS (100% PARITY REQUIRED):
1. Identity & Timezone:
   - App Name: "Світло в Житомирі"
   - Bundle ID: com.ZTBlackoutPreWarning | App Group: group.com.ZTBlackoutPreWarning | Min iOS: 17.0
   - Timezone: Europe/Kyiv (with fallback to Europe/Kiev and TimeZone.current)
   - Version: 1.3.3

2. ZTOE HTML Parser & Schedule Engine (ZtoeParser.swift & ztoeParser.ts):
   - Validate URL strictly against valid-urls.json (["https://www.ztoe.com.ua/unhooking-search.php", "https://example.com"]).
   - Fetch HTML with Windows-1251 decoding, gzip, and ETag/If-Modified-Since caching.
   - Filter leaf tables (table containing no nested tables and >=12 rows with "1.1" and "6.2").
   - Match Today and Tomorrow tables in the first 2 rows using exact integer (day, month, year) regex (?<!\d)(\d{1,2})\.(\d{1,2})\.(\d{4})(?!\d) and DD.MM fallback.
   - Parse all 12 queues (1.1..6.2) in a single pass into 48 half-hour slots (00:00-00:30 .. 23:30-24:00), filtering out width:3pt/1pt separator cells.
   - Detect POWER_OFF on explicit red attributes (#ff3333, #ff3b30, #ff0000, background:red, rgb(255, 51, 51), rgb(255, 0, 0), danger) without matching #ffffff.
   - If the site is unreachable, invalid, or returns no queues, clear cached schedules and mark schedule as isUnclear = true (never use stale cache on error).
   - When today's blackouts are over and tomorrow's schedule is available, "Next period" must show tomorrow's 1st blackout (never today's 1st blackout).

3. Four Screens & Visual Design (#141A29 Frosted Glass & #FF5E3A Orange Accent):
   - Time-of-Day Ambient Background Palettes:
     * Morning (08:00): #F4F9F9, #4A7C59, #FFB085, #2C3E35
     * Day (14:00): #FFFFFF, #0A2540, #FFD166, #4682B4
     * Evening (19:30): #1A0B2E, #8B3A62, #FF6B6B, #FFE66D
     * Night (01:30): #0B0C10, #1F2833, #66FCF1, #C5C6C7
   - MainScreen: Queue badge, Bell toggle, Hero Countdown card ("СВІТЛО Є" / "СВІТЛА НЕМАЄ" / "Невідомо", HH:MM:SS, Next period), Today/Tomorrow tabs, 24h САЗУ-ИТ 48-slot TimelineBar ("Графіки не діють" / "Outages unclear" when unclear), dynamic blackout intervals list ("ГОДИНИ БЕЗ СВІТЛА НА СЬОГОДНІ:" / "BLACKOUT HOURS FOR TODAY:"), Refresh card, Facebook emergency link ("Інформація про аварійні відключення:" -> https://www.facebook.com/ztoe.com.ua), and ZTOE schedules link ("Графіки відключень на сайті" -> https://www.ztoe.com.ua/unhooking-search.php).
   - SettingsScreen:
     * Card 1: Queue picker (1.1..6.2) + "?" help dialog with exact 4 numbered steps:
       1. Відкрийте сторінку пошуку черги на сайті https://www.ztoe.com.ua/unhooking-search.php.
       2. Оберіть свій РЕМ, населений пункт і вулицю.
       3. У таблиці знайдіть свій будинок і подивіться стовпці «Черга» і «Підчерга». Наприклад, черга 5 і підчерга 2 - це 5.2.
       4. Виберіть це значення у полі «Черга» у вікні налаштувань (кнопка ⚙).
     * Card 2: Site Address input with live reachability badge ("✓ Доступний" / "Reachable", "Немає доступу до Інтернету" / "No Internet access", "На сайті не знайдено черг" / "No queues found on site").
     * Card 3: 1–240 min spinners for Advance Notice (default 15) and Refresh Interval (default 30).
     * Card 4: Master Notifications, Sound, and Vibration switches (#FF5E3A) with state memory when toggling master switch.
     * Card 5: Language selector ("Системна" / "System", "Українська", "English").
     * Card 6: "Тест сповіщення" (#FF5E3A), "Оновити дані", and "Скинути налаштування" with confirmation dialog.
   - AboutScreen: App icon, v1.3.3 badge, Developer profile link (https://github.com/IgorZaharov), README link ("Світло в Житомирі на Github" -> https://github.com/IgorZaharov/iOS-ZTPreBlackoutNotification/blob/main/README.md), Issues link (https://github.com/IgorZaharov/iOS-ZTPreBlackoutNotification/issues), "Charity / Благодійність і Пожертви" block reading /donations.json (24h refresh, "Допомога тваринам" https://send.monobank.ua/jar/7vJA5xrLoV & "Фонд Повернись Живим" https://savelife.in.ua/donate/), and "Житомирська Рулетка" / "Zhytomyr Roulette" launch button.

4. WidgetKit Extension (Small & Medium Widgets):
   - Status labels "СВІТЛО Є" / "СВІТЛА НЕМАЄ" / "НЕВІДОМО", countdown without seconds (HHг. MMхв. / HHhr. MMm.), round Refresh button (AppIntent), round Bell toggle button, and 48-half-hour САЗУ-ИТ timeline on the Medium widget.

5. Житомирська Рулетка Mini-Game (ZhytomyrRouletteScreen.swift):
   - Hides main bottom navigation bar when open.
   - 48 half-hour scratch tickets (24 rows x 2 cols), 9 foil variants, center red lightbulb (no red border outline), reveals when center lightbulb is exposed or >=30% scratched.
   - Max score 9,999,999; shuffles ticket places when score > 999; 2000ms top-to-bottom deal animation; 1000ms Game Over realization delay; 10s random Game Blackout & screen flicker.
   - Milestones (150, 400 -> Daily Streak X2, 1000 -> Perseverance +1 heart) and 9 Power Shop upgrades including Депозит Потужність+ with FinMon AntiCheat ("На розгляді ФінМоніторинга").
   - Separate Sound and Music switches on the left side, 15% music volume with fade-in/out (2000ms Game Over delay), 7 MP3 SFX (scratch 0.575*0.9 for 336ms, coin 0.75 waiting for scratch to finish, 2x_coin, lightbulb, cash_register, flicker, shuffle), and Share Card preview with Share, Download Image, and Back buttons.

6. Automated Unit Tests:
   - Include comprehensive tests in both tests/unit.test.ts (run on every build via npm test) and ios/ZTPreBlackoutNotificationTests/ZtoeParserTests.swift (run in GitHub Actions via xcodebuild test).
```
