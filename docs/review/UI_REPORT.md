# Interface review (better-interface): "Світло в Житомирі"

Branch `feat/1.4.0-outage-rework`. Format: `review-format.md` of the `better-interface` skill (scope and coverage, one findings table of at most 15 rows, verification, verdict).

Evidence is **static** (source reading plus computed contrast and calculated wrap thresholds). **Nothing has been rendered or run on a device or emulator**; every rendered check is listed as Not verified in the Verification section and is scheduled for the emulator walkthrough (plan phase 6).

Related documents: [README](README.md) | [CODE_REVIEW](CODE_REVIEW.md) | [UI_PROPOSALS](UI_PROPOSALS.md) | [TYPOGRAPHY](TYPOGRAPHY.md)

## Scope and coverage

**Scope.** The native Android app, Compose layer: Main screen, Settings screen with the "?" address lookup modal, About screen, the navigation dock and in-app banner, the `TimelineBar` drum, theme and `AppStrings`. Excluded by boundary: `ZhytomyrRouletteScreen.kt` (4 798 lines, the roulette game), the Glance widget UI (`BlackoutGlanceWidget.kt`, covered only where its logic matters in [CODE_REVIEW](CODE_REVIEW.md)) and the React simulator UI under `src/` (mentioned only where the UI pass noted a mirror gap). Paths below are under `android/app/src/main/java/ua/blackout/prewarning/ui/` unless stated.

**Stack and styling conventions.** Kotlin 2.0.21, Jetpack Compose with Material 3 (Compose BOM 2024.12.01, Material3 1.3.1), `minSdk` 26, `targetSdk` 36. Styling is hard-coded in composables: `Theme.kt` defines only light and dark `ColorScheme`s (no `Typography`, no `Shapes`); no file uses `MaterialTheme.typography` or `colorScheme`. Cards are built from one repeated modifier chain (`floatingShadow` plus `Modifier.shadow` plus clip plus background plus border). Fonts: system default plus `FontFamily.Monospace`. Two languages through `AppStrings.kt` (uk and en).

**Project convention documents found.** `CLAUDE.md` (parity with the React simulator; invariants: queue-help 4-step text and "Зрозуміло" character for character, Facebook link on Main, widget labels, changelog enforcement for any edited file under `ui/`, `components/`, `widget/`) and `HANDOVER.md` (claims a typography setup at `HANDOVER.md:160` that `Theme.kt` does not contain). No design-system document, no Storybook, no interface ADRs.

**Assumptions in the numbers.** Widths assume a 360 dp phone. Wrapping thresholds are calculated, not measured on a device. Day-time contrast figures are a worst case that assumes a pure-white background under the translucent cards.

| Domain | Evidence inspected | Result |
| --- | --- | --- |
| Accessibility | Semantics, `contentDescription`s, roles, 48 dp targets and reduced-motion handling in `MainScreen.kt`, `BlackoutAppNavigation.kt`, `SettingsScreen.kt`, `TimelineBar.kt` | 2 findings |
| Layout | Fixed sizes, weights, calculated behaviour at font scale 1.3 to 2.0, the address pickers and the modal IME handling | 3 findings |
| Writing | `AppStrings.kt`, strings outside it, error and status copy, notification text, hint texts | 3 findings |
| Typography | `Theme.kt`, 78 `fontSize` literals, `maxLines` and overflow rules, line heights (full audit in [TYPOGRAPHY](TYPOGRAPHY.md)) | 1 finding (plus the typography check) |
| Colors | WCAG contrast computed for 9 pairs, card and accent tokens | 1 finding |
| UI polish | Card chrome (about 22 copies), borders, radii, pulse motion, pager composition, drum needle, dead tokens | 5 findings |

## Findings

Ordered by severity, then by reach. `Before` and `After` show the current implementation and the replacement. Wrap thresholds are calculated at 360 dp and have not been confirmed on a device.

| Severity | Domain | Location | Before | After | Why |
| --- | --- | --- | --- | --- | --- |
| HIGH | Typography | `Theme.kt` (no `Typography`); `MainScreen.kt:205,260,273-304,335,401,419,436,465,476,510,526,549,587,626,642,656,703-708,781,787,850,856,907-955`; `SettingsScreen.kt:205,211,292,312,348,375,435,514,547,586,640,683,711,755,777,797,1040,1057-1250,1421,1548,1566`; `TimelineBar.kt:139,221`; `BlackoutAppNavigation.kt:1043`; `AboutScreen.kt:139,186,254-255` (full list in TYPOGRAPHY.md) | 78 hard-coded `fontSize` literals (10 sp x6, 11 sp x14, 12 sp x30, 13 sp x6, 14 sp x11, 15 sp x1, 16 sp x3, 20 sp x2, 22 sp x1, 24 sp x2, 44 sp x2); 50 of 78 (64 %) are 12 sp or smaller; labels and card titles at 11 to 12 sp (`SettingsScreen.kt:205` 12 sp Bold, `:211` 11 sp) sit above 16 sp field values that come from M3 defaults; smallest text is 10 sp (URL captions `MainScreen.kt:787,856`, error text `SettingsScreen.kt:348`) | Define `Typography` in `Theme.kt` with 8 roles: display 44/48, title 24/30, heading 20/26, subhead 16/22, body 16/24, label 14/20, caption 13/18, overline 12/16 with +0.05 em; floor 12 sp; field labels 14 sp, secondary text 13 sp or more, body 16 sp; replace every literal with a role; keep system font plus `FontFamily.Monospace` | Type scale with semantic names and size floors. The hierarchy is inverted (a label is smaller than the value it labels) and 64 % of text is small, on every screen |
| HIGH | Layout | `MainScreen.kt:273-304,373-425,443,458-482,626,925`; `SettingsScreen.kt:290-316,373-384,514-565,698-717,738-779`; `TimelineBar.kt:139,221`; `AboutScreen.kt:262-294` | Rows without `weight(1f)` on the text side; fixed `width(260.dp)` language switch (`MainScreen.kt:925`, about 64 dp text slot per segment, "Українська" borderline at 1x and clipped from 1.15x); fixed 32 dp box for "Графіки не діють" (`TimelineBar.kt:139`, clips if it wraps at 2x); fixed 20 dp "!" circle (`MainScreen.kt:626`, text scales but the circle does not, clips at 2x); 44 sp countdown "01:35:12" is about 211 dp of 292 dp with no `maxLines` and char-wraps from 1.4x ("01:35:1/2"); "ЗАРАЗ НЕМАЄ СВІТЛА" shares a row with the clock and wraps from 1.3x (about 294 versus 292 dp); "Тест сповіщення" wraps from 1.3x in a half-width button of about 142 dp; "ПОПЕРЕДЖАТИ ЗАЗДАЛЕГІДЬ" and "1–240 хв" collide from 1.3x; tick labels take 13 x 12 dp = 156 dp at 1x and 312 dp at 2x, wider than the 288 dp track, so they overlap; About README row: the left `Row` has no weight and a 71-character mono URL without `maxLines` pushes the trailing icon out | `weight(1f)` on every text side; `softWrap = false` and `maxLines = 1` on numerics, and cap the font scale on the 44 sp countdown node only; `heightIn(min = ...)` in place of fixed heights; language switch `fillMaxWidth(0.9f)`; "!" circle 24 dp or a non-scaling glyph; stack the action buttons at large scale; thin the tick labels to every 4 h when font scale is above 1.3; About URL row `weight(1f)`, `maxLines = 1`, ellipsis | Content clipped, overlapped or broken at 130 to 200 percent font scale is an escalation trigger. The countdown, the status line and the settings rows are the primary content of the app |
| HIGH | Accessibility | `MainScreen.kt:215-238` (pill, `contentDescription = null` at `:233`), `505-549`, `616-638`, `725`, `842`; `BlackoutAppNavigation.kt:1074-1124`; `SettingsScreen.kt:516,551,590,645,1018,1552`; `TimelineBar.kt:159-166,172` | The notification pill (58 x 34 dp `CircleShape`, thumb 26 dp) has no name, role or state; day tabs and dock tabs lack `Role.Tab` and `selected`; the four `Switch` rows are unlabelled; the emergency "!" circle (20 dp) has no text alternative; all `clickable` boxes lack a `role`; 24 no-op clickable drum cells add TalkBack noise (`TimelineBar.kt:172`); the drum draws planned and emergency outages identically (`:159-166`); hard-coded Ukrainian `contentDescription`s (`MainScreen.kt:725,842`, `BlackoutAppNavigation.kt:1084-1124`) and English "Close" (`SettingsScreen.kt:1018`); in the modal help text the whole step `Text` is clickable (`SettingsScreen.kt:1552`), not just the URL | `Modifier.toggleable(role = Role.Switch)` plus a `stateDescription` on the pill and on each `Switch` row (the row carries the label); `Modifier.selectable(role = Role.Tab)` on day tabs and dock tabs; one summary `contentDescription` for the drum and remove the cell clicks; a text tag "Аварійне" and a `contentDescription` on emergency rows (see UI_PROPOSALS.md); all descriptions from `AppStrings` in uk and en; `LinkAnnotation` for the URL | An interactive control with no accessible name is an escalation trigger; the emergency state is carried by a glyph and colour with no text alternative |
| HIGH | Colors | `MainScreen.kt:907` (CTA); `SettingsScreen.kt:1435-1467`; every white label on `#FF5E3A`; small secondary text on translucent cards | White on `#FF5E3A` is 3.04:1 and `#E6FFFFFF` on it is 2.72:1; tertiary text `#99BAE6FD` on the card is 5.6:1 at night but 3.2:1 in the DAY worst case; accent text `#FF5E3A` on the card is 5.9:1 at night but 2.5:1 in the DAY worst case; disabled text `#66FFFFFF` is 3.8:1 at night and 2.65:1 in the DAY worst case | Dark label on the accent button (black on `#FF5E3A` is 6.91:1), or a darker accent for filled text buttons only (`#D93F1E`, reported 4.49:1, which is 0.01 below 4.5:1: the value needs re-measuring and a slightly darker pick); raise the card alpha from `0xBF` to `0xE6` behind small text (secondary text 3.75:1 to 5.72:1 on white, per the report) or raise the small-text alpha to `0xCC` or `0xE6`; re-measure in all four palettes on the emulator | Body and control text whose contrast pair fails 4.5:1 for 12 to 14 sp text is an escalation trigger, and it affects every primary button |
| HIGH | Layout | `SettingsScreen.kt:1061-1117` (REM), `1128-1182` (settlement), `1192-1244` (street), `1254-1311` (house), `1101-1102`, `838-895`, `861-867`, `1224`; React `SettingsView.tsx:771-865` | Four `ExposedDropdownMenuBox` with `OutlinedTextField(readOnly = true, onValueChange = {}, Modifier.menuAnchor())` (the deprecated no-argument overload, not editable); items are an eager `forEach { DropdownMenuItem }`, 48 dp each in a 320 dp popup (about 6.7 visible): 966 streets are about 46 400 dp, roughly 145 viewport scrolls, 103 settlements about 15, a street with 100+ houses another 15+; no search; no loading state (`isCheckingAddressOnSite` is written and never read, `:108,911,921`); an empty list is an empty popup; fetch failures are silent (`if (fetched.isNotEmpty())`, `:842,852,869,892`); `forceRefresh = true` on every modal open; selecting a REM auto-selects its first settlement; the React mirror uses native `<select>` | One reusable `SearchablePickerField`: read-only field opening a full-screen dialog with a sticky 56 dp search field, `LazyColumn(key = id)`, 52 dp rows, loading, empty and error rows with a retry, a check mark on the current value, `imePadding()`; used for REM, City, Street and House; wire the dead spinner; fetch the bulk page once per city per TTL; no silent REM-to-city auto-selection (design in UI_PROPOSALS.md) | A target value reachable only through about 145 scroll pages, with no feedback for loading or failure, blocks the primary setup task |
| HIGH | Writing | `BlackoutAppNavigation.kt:478-484,562-603,1007-1048`; `MainScreen.kt:131-132,395-399`; `TimelineBar.kt:139` | A site failure shows only "Невідомо" and "Графіки не діють" with no cause; `FetchStatus {SUCCESS, NO_INTERNET, NO_QUEUES_FOUND}` is the only state and never reaches Main; offline and site-down are both `NO_INTERNET` and a parse exception is `NO_QUEUES_FOUND`; on failure `baseSlots = emptyList()` and the cache is cleared; `lastUpdated` is stamped even on failure (`:486-488,582-584`); the only message is a transient banner after a manual refresh (12 sp, 3 s timeout) | Persistent `SiteStatusIndicator`: a chip row in the "Last updated" card (always) plus a glass banner above the hero for degraded states; four states (`AVAILABLE_WITH_TABLE`, `AVAILABLE_NO_TABLE`, `SITE_UNREACHABLE`, `NO_INTERNET`), each with icon plus text, tokens from the About chips (UI_PROPOSALS.md); keep the last good data marked stale with "дані за HH:mm"; stamp `lastUpdated` on success only | An error that names no cause and no way to recover is an escalation trigger. The user cannot tell whether the site, the phone or the app is at fault. Needs a hoisted `SiteState` and split failure branches: a state change, not only UI |
| MEDIUM | Accessibility | `MainScreen.kt:217,505,715`; `BlackoutAppNavigation.kt:1074`; `SettingsScreen.kt:218,706,747,789,1009` | Targets below 48 dp: notification pill 34 dp tall, refresh button 42 dp, day tabs about 36 dp, dock buttons 44 dp, "?" button 40 dp, close button 40 dp, language segments about 30 dp, action buttons 36 to 40 dp; Compose `clickable` on a `Box` does not enforce a minimum | `minimumInteractiveComponentSize()` or `heightIn(min = 48.dp)` with transparent padding so the visual size is unchanged | Touch targets under 48 dp are hard to hit; the visual design stays as is |
| MEDIUM | UI | `MainScreen.kt:558,688,691,734,805`; `SettingsScreen.kt:182-356,243`; `AboutScreen.kt` (all cards) | The chain `floatingShadow` + `shadow` + `clip` + `background` + `border` is copied about 22 times; cards are inconsistent: 1 dp `0x26FFFFFF` border on 9 cards, none on `MainScreen.kt:558,688,734,805`, Settings S1 to S3 and every About card; radius 20 on the "Last updated" card (`MainScreen.kt:691`) while cards use 24; `OutlinedTextField` trailing icons and cursor use the light colour scheme in system-light mode (dark arrow on dark glass, `SettingsScreen.kt:243`) | One `GlassCard` (radius 24, bg `0xBF141A29`, border 1 dp `0x26FFFFFF`, existing shadow) used by all cards; radius 20 to 24 on the "Last updated" card; set `trailingIconColor` and cursor colours or force `darkColorScheme` for the glass fields | The same detail done two ways within the project; border, radius and shadow drift. The hairline is a visible change for the currently borderless cards (decision in UI_PROPOSALS.md) |
| MEDIUM | Writing | `MainScreen.kt:205,454,914,934-936`; `SettingsScreen.kt:147,149,698,745,1039-1475,1609`; `BlackoutAppNavigation.kt:320,941-945`; `AboutScreen.kt:161`; `AppStrings.kt:45`; `AlarmReceiver.kt:91-92`; `res/values/strings.xml` | Strings outside `AppStrings` ("Житомиробленерго (ZTOE)", "Auto", "English", "Українська", all field labels in the modal, "Jetpack Compose M3"); the notification text is Ukrainian only; `siteSchedulesLabel` ignores `lang` (`AppStrings.kt:45`); the magic string "Відключень немає" is compared in code (`MainScreen.kt:454`, `BlackoutAppNavigation.kt:320`); `res/values/strings.xml` is Ukrainian only | Move every visible string to `AppStrings` (uk and en); replace the string comparison with a typed flag | Copy that ignores the chosen language, and logic that depends on display text, break the English mode and any copy edit |
| MEDIUM | UI | `MainScreen.kt:145-159,385` | `pulseScale` is read in composition, so the whole `MainScreen` recomposes every frame while `isBlackoutNow`; the pulse ignores the system animator scale | Read the animation inside `graphicsLayer { }` or move the dot into its own composable; skip the pulse when `ANIMATOR_DURATION_SCALE == 0`; keep the static cue (colour, icon, label) | Motion that ignores the system reduced-motion setting is an escalation trigger once confirmed. Static evidence only: raise to HIGH if the emulator shows the pulse still running with animations removed |
| MEDIUM | UI | `BlackoutAppNavigation.kt:702-707`; `SettingsScreen.kt:129-141`; `AboutScreen.kt:72-87` | `HorizontalPager(beyondViewportPageCount = 2)` with 3 pages composes every page at launch: Settings runs a full `fetchFullSchedule`, About runs `getDonationsWithDailyRefresh(forceRefresh = true)`, which defeats the daily cache (compare `BlackoutAppNavigation.kt:379-391`) | Gate the fetches on page visibility or set `beyondViewportPageCount = 0`; drop the forced fetch in About | Duplicate network calls at launch slow the first screen and waste data |
| MEDIUM | Layout | `SettingsScreen.kt:965-970` | The address modal has no `imePadding()` and the manifest sets no `windowSoftInputMode` | `imePadding()` on the modal content before the search field lands | The keyboard would cover the sticky search field and the lower fields |
| MEDIUM | Writing | `SettingsScreen.kt:380,440`; `ScheduleSyncWorker.kt:116` | The hint "1–240 хв" contradicts the 11 presets (5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240); 5 and 10 minutes are offered but the WorkManager periodic floor is 15 | Align the hint to the real presets; drop 5 and 10 or label the real cadence | The UI promises refreshes the system cannot deliver |
| MEDIUM | UI | `TimelineBar.kt:95` versus `:126-127` | The needle inset is 6 dp but the track inset is 8 dp: up to 2 dp (about 12 min) of error at the ends of the drum (`MEDIUM*`: the source lists the error without a severity) | One shared inset constant for needle and track | The needle on the main visual shows a time that is off by up to 12 minutes near midnight |
| LOW | UI | `AppStrings.kt:29,55,95`; `SettingsScreen.kt:49`; `Models.kt:86`, `SettingsRepository.kt:206,232`, `BlackoutAppNavigation.kt:106`, `MainActivity.kt:63`; `PowerOnGreen`, `DarkBackground`, `colors.xml` `primary_dark` | Unused `AppStrings` keys (`blackoutHoursHeader`, `siteInvalid`, `queueHelpDesc`); `activeEmergencyOutage` unused in `SettingsScreen`; `themeMode` is persisted with no UI and `onThemeChanged` is never invoked; unused colours | Delete, or wire `themeMode` if a theme control is wanted | Dead settings and tokens mislead the next editor |

## Verification

No command was run for this report: no build, no test, no emulator. Checks performed are static only.

| Check | Method | Result |
| --- | --- | --- |
| Source read of Main, Settings, About, navigation, `TimelineBar`, theme and `AppStrings` | Reading, with line references | Passed (findings above) |
| `fontSize` histogram | Counted in the UI pass; sums recomputed while writing this document: 6+14+30+6+11+1+3+2+1+2+2 = 78; 6+14+30 = 50 are 12 sp or smaller, 64.1 % | Passed |
| Contrast of 9 colour pairs | WCAG formula (UI pass), values in Appendix B | Passed as computation; DAY figures assume a pure-white backdrop |
| Hue separation for the proposed emergency amber (see UI_PROPOSALS.md) | Hue computed from the hex values while writing: `#FFB020` about 39 degrees, crimson `#D62E26` about 3 degrees, accent `#FF5E3A` about 11 degrees | Passed |
| Touch targets of the address fields and menu items | Code constants: fields 56 dp, items 48 dp | Passed |
| Drum tick label contrast | `1C1B18` on the faceplate, 11.2:1 | Passed |
| Wrap and clip thresholds at font scale 1.15 to 2.0 | Calculated at 360 dp | Calculated, **Not verified** on a device |

**Not verified** (to be done on the emulator, plan phase 6):

- Rendering of every screen at font scale 1.0, 1.3 and 2.0, including all wrap and clip thresholds above.
- TalkBack pass: names, roles, states, focus order, drum summary.
- Measured contrast in all four time-of-day palettes with the real backdrop (the DAY figures are a worst-case assumption).
- Pulse behaviour with animations removed, and the recomposition claim (`MainScreen.kt:145-159`).
- Address picker behaviour with the live 967-street list, search, IME and the empty and error states.
- Press feedback and the light-theme leak in `OutlinedTextField`.
- Width of 320 dp, landscape and system light versus dark mode.
- Site-state banner and chip rendering for the four states.

## Verdict

**Block.** 6 HIGH findings are open (typography scale, layout at large font scale, accessible names and roles, contrast, address pickers, site-status copy). Not reviewed: `ZhytomyrRouletteScreen.kt` (4 798 lines), the Glance widget UI (`BlackoutGlanceWidget.kt`) and the React simulator UI under `src/`; rendered behaviour of all six domains is Not verified.

## Appendix A. Screen inventory

All page columns use `statusBarsPadding`, padding h16/v12, `spacedBy(16)` and a trailing `Spacer(96.dp)` to clear the dock.

### Main (`MainScreen.kt`)

| # | Block | Lines | Content and constraints |
| --- | --- | --- | --- |
| M1 | Header row | 189-239 | "Черга X.Y" 24 sp plus a two-line address (the `\n` comes from `formatAddressAfterCity`, `:50-62`). On the right is the notification pill, fixed 58 x 34 dp, `CircleShape`, thumb 26 dp, `contentDescription = null` |
| M2 | Emergency banner (conditional) | 242-309 | Title plus Start/Restore rows. Style: radius 24, bg `0xBF141A29`, border 1 dp `0x26FFFFFF`, padding 16 |
| M3 | ZTOE status bar (conditional) | 312-342 | Same style as M2. Address 12 sp, status 14 sp |
| M4 | Hero card | 345-486 | Padding 18, same glass style. Status line (dot 10 dp, text, clock) at 373-425. Countdown at 430-448. Divider, then the period row with a chip (radius 10, bg `0x26FFFFFF`, padding 10 x 4) at 456-482. A no-queue variant shows "--:--:--" at 356-369 |
| M5 | Day selector | 489-555 | Container radius 16, bg `0x80141A29`, padding 4. Tabs radius 12, selected bg `0x33FFFFFF`, padding v10 (about 36 dp tall). Fallback is a static "Сьогодні" pill |
| M6 | Schedule card | 558-685 | Radius 24, padding 18, **no border**. Contains `TimelineBar`, a divider, an 11 sp header and `intervals.forEach` rows (radius 14, bg `0x14FFFFFF`, padding 14 x 10). An empty-state box sits at 666-680 |
| M7 | Last/next updated plus refresh | 688-731 | Radius 20 (the only card that is not 24), padding 14, no border, no `.shadow()`. The refresh button is a 42 dp white circle |
| M8, M9 | Facebook and site link cards | 734-872 | Radius 24, padding 14. Inner row radius 14 with a 36 dp icon tile (radius 10; Facebook `0xFF1877F2`, site `0xFFFF5E3A`) |
| M10 | Unselected-queue overlay | 879-961 | Dim `0xD9070A12`. CTA minWidth 260, radius 24, `0xFFFF5E3A`, border `0x40FFFFFF`, padding 32 x 20. Language switch **fixed `width(260.dp)`** (`:925`), radius 16 |

- **Dock** (`BlackoutAppNavigation.kt:1050-1131`): capsule bg `0xCC141A29`, padding 6, three 44 dp circles spaced 12.
- **In-app banner** (`BlackoutAppNavigation.kt:1007-1048`): radius 20, bg `0xF2141A29`, 12 sp text, 3 s timeout.
- **`TimelineBar`** (`components/TimelineBar.kt:31-234`): composable-based, not a Canvas. 24 hour cells (`weight(1f)`), each with two 30-minute `Box`es (height 32 dp, vertical-gradient brush); a 24-slot legacy fallback exists (`:156-167`). Needle via `drawWithContent` (`:92-118`), drawn only on Today (`MainScreen.kt:575`). Ticks every 2 h: 1.5 x 5 dp `1C1B18`, labels 10 sp mono. Tokens in UI_PROPOSALS.md.

### Settings (`SettingsScreen.kt`)

Header at 162-179, then:

| # | Block | Lines |
| --- | --- | --- |
| S1 | Queue card: "?" tile 40 dp radius 16, border 1 dp `0x40FFFFFF`, plus an `ExposedDropdownMenuBox` of 12 queues | 182-272 |
| S2 | Site URL: title, badge pill, description, `OutlinedTextField`, 10 sp error | 275-353 |
| S3 | Timers: two dropdowns with 11 presets (5 to 240) | 356-484 |
| S4 | Notifications: master, sound and vibration `Switch` rows | 488-606 |
| S4b | Emergency `Switch` card | 609-657 |
| S5 | Language segmented control (SYSTEM, uk, en) | 660-719 |
| S6 | Test and Refresh buttons (50/50 row), Reset button | 722-801 |

S1 to S3 have **no border**; S4 to S6 have the 1 dp border. The Reset `AlertDialog` is at 1600-1621. Sound and vibration are disabled unless the master or emergency switch is on (`anyAlertsEnabled`, `:487,554,593`). There is no theme control.

### "?" address lookup modal

A `Dialog(usePlatformDefaultWidth = false)` (`:954-957`) with a solid `0xFF141A29` page, `statusBarsPadding` and `navigationBarsPadding`, padding h14/v16.

- Header: 40 dp "?" tile and a 40 dp close circle (`:973-1025`).
- Address card (`:1028-1486`): radius 24, bg `0x0DFFFFFF`, **border 2 dp white at 25 %**, padding 20. Four labelled fields: REM, Settlement, Street, House. Result card (`:1333-1484`, radius 16, border 2 dp): address, "Знайдена черга", status box, emergency box, and an "Обрати чергу" button (radius 16, padding v14).
- "Manual search" heading (`:1489`).
- Four step cards (`:1499-1574`): radius 16, border 2 dp `0x26FFFFFF`, 24 dp number badge.
- "Зрозуміло" button, white (`:1577-1593`).

### About (`AboutScreen.kt`)

Six blocks: identity (98-165), description (168-206), links (209-331), donations (334-412), roulette button (415-438), disclaimer (448-477). Same 24 dp radius glass cards with no border on any of them; link rows radius 14 with 36 dp tiles.

## Appendix B. Contrast table

Computed with the WCAG formula (UI pass). "Worst case" assumes a pure-white background under the translucent card.

| Pair | Contrast | Requirement for 12 to 14 sp text | Status |
| --- | --- | --- | --- |
| White on `FF5E3A` | 3.04 | 4.5 | Fails |
| `E6FFFFFF` on `FF5E3A` | 2.72 | 4.5 | Fails |
| `99BAE6FD` on card, night | 5.6 | 4.5 | Passes |
| `99BAE6FD` on card, day worst case | 3.2 | 4.5 | Fails |
| `FF5E3A` on card, night | 5.9 | 4.5 | Passes |
| `FF5E3A` on card, day worst case | 2.5 | 4.5 | Fails |
| `66FFFFFF` disabled text, night | 3.8 | n/a (disabled) | Informational |
| `66FFFFFF` disabled text, day worst case | 2.65 | n/a (disabled) | Informational |
| Tick labels `1C1B18` on faceplate | 11.2 | 4.5 | Passes |

Fix values reported by the UI pass: black on `FF5E3A` is 6.91:1; accent about `D93F1E` with white text is 4.49:1 (below 4.5:1, so the candidate needs to be re-measured); raising the card alpha to `0xE6` takes secondary text from 3.75:1 to 5.72:1 on white (the report does not label which text colour this figure refers to; secondary text is `0xB3BAE6FD`).

## Appendix C. Touch targets below 48 dp

| Element | Size | Location |
| --- | --- | --- |
| Notification pill | 34 dp tall | `MainScreen.kt:217` |
| Refresh button | 42 dp | `MainScreen.kt:715` |
| Day tabs | about 36 dp | `MainScreen.kt:505` |
| Dock buttons | 44 dp | `BlackoutAppNavigation.kt:1074` |
| "?" button | 40 dp | `SettingsScreen.kt:218` |
| Close button | 40 dp | `SettingsScreen.kt:1009` |
| Language segments | about 30 dp | `SettingsScreen.kt:706` |
| Action buttons | 36 to 40 dp | `SettingsScreen.kt:747,789` |

## Appendix D. Where the other UI-pass items went

The 15-row cap did not exclude any escalation trigger. Items that are not rows of the table were merged into a row or belong to the code review.

| UI-pass item | Handling |
| --- | --- |
| About README row loses its trailing icon (`AboutScreen.kt:262-294,290`) | Merged into the Layout row for rows without `weight(1f)` |
| Link tap target, whole step `Text` clickable (`SettingsScreen.kt:1552`) | Merged into the Accessibility row |
| No loading UI, `isCheckingAddressOnSite` dead, `isVerifyingUrl` only hides the error (`SettingsScreen.kt:340`); React shows "Checking data…" and an amber state (`SettingsView.tsx:353-381`) | Merged into the picker row and the site-status proposal |
| `lightNoOutageSlots` duplicates `buildLightNoOutageSlots`; `MainScreen` builds its own `ScheduleRepository(context)` (`:90`); screen-local state with network `LaunchedEffect`s (`SettingsScreen.kt:129-141,838-940`) | Code findings `A-L13`, `A-L14`, `A-L15` in [CODE_REVIEW](CODE_REVIEW.md) |
| Plan row "domain" labels | Domain reassigned to the owning skill where the plan used a mixed label: the pager row is UI (plan: Accessibility), the hint mismatch is Writing (plan: Layout), the picker row is Layout (plan: Accessibility/Layout). The plan's own coverage counts (3, 3, 2, 1, 1, 3) do not match its 14-row table, so the counts above were recomputed from this table |
| Drum needle error | Added as the 15th row; it is not in the plan table |
