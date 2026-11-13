# UI polish proposals (better-ui): changes that keep the original look

Branch `feat/1.4.0-outage-rework`. Format: the `better-ui` skill (table `Severity | Location | Before | After | Why`, grouped by the principle each row serves, ending with `Block` or `Approve`).

Evidence is **static**: source reading plus values taken from the UI exploration pass and the approved plan. **Nothing has been rendered or run on a device or emulator.** Every visual value below is a specification to be checked on the emulator in plan phase 6; none has been confirmed visually.

Related documents: [README](README.md) | [CODE_REVIEW](CODE_REVIEW.md) | [UI_REPORT](UI_REPORT.md) | [TYPOGRAPHY](TYPOGRAPHY.md)

## 1. Scope, method and Compose translation

**Scope.** Surfaces, icons and motion on Main, Settings, the "?" modal and the drum (`TimelineBar`). The proposals extend the existing dark glass look; they do not restyle it. Section 4 lists the tokens that stay exactly as they are, and section 4.9 lists the few deliberate exceptions that need an owner decision.

**Compose translation.** The `better-ui` skill is written in CSS terms. Values carry over as `px` to `dp`, durations unchanged, press scale as `graphicsLayer { scaleX = scaleY = ... }`, reduced motion as the system animator scale (`Settings.Global.ANIMATOR_DURATION_SCALE == 0`, per the plan). Project conventions (radii 24/16/14/12/10, translucent glass cards, hairline borders) are treated as deliberate and are not findings.

**Easing note (inconsistency).** The plan specifies `FastOutSlowInEasing` for the press scale; the skill specifies `ease-out` ("0.96 over 150 ms with ease-out"). In Compose the closest decelerating curve to `ease-out` is `LinearOutSlowInEasing`. The plan value is kept in section 3.7 and the difference is flagged for a decision during implementation.

## 2. Proposals grouped by principle

Severity here follows the skill: `HIGH` breaks an interaction, motion that ignores reduced motion, or a state change carried by motion alone; `MEDIUM` is a visible inconsistency in surfaces, icons or motion; `LOW` is isolated polish. No proposal is `HIGH`. `LOW*` means the current state is not recorded in the sources and the row is a specification rather than a defect.

### 2.1 One way per detail (project tokens and components)

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| MEDIUM | `MainScreen.kt:558,688,691,734,805`; `SettingsScreen.kt:182-356,243`; `AboutScreen.kt` (all cards) | The chain `floatingShadow` + `Modifier.shadow` + clip + background + border is copied about 22 times; 1 dp `0x26FFFFFF` border on 9 cards, none on Main schedule, "Last updated" and link cards, Settings S1 to S3 and all About cards; radius 20 on the "Last updated" card (`MainScreen.kt:691`); light-scheme leak in `OutlinedTextField` trailing icons (`SettingsScreen.kt:243`) | One `GlassCard` (radius 24, bg `0xBF141A29`, border 1 dp `0x26FFFFFF`, existing `floatingShadow` plus `Modifier.shadow`) for every card; "Last updated" card radius 20 to 24; `trailingIconColor` and cursor colour set for the glass fields | The same detail done two ways within the project; border, radius and shadow can drift. The bordered variant is chosen because the 1 dp `0x26FFFFFF` border is part of the kept token set; it adds a hairline to the currently borderless cards, which is a visible change to confirm on the emulator |

### 2.2 Press scales to 0.96

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| LOW* | Buttons and chips: CTA `MainScreen.kt:907-955`, refresh circle `:715`, link cards `:734-872`, Settings action buttons `SettingsScreen.kt:747,789`, "Обрати чергу" `SettingsScreen.kt:1435-1467`, "Зрозуміло" `:1577-1593`, new status chips if tappable | Current press feedback is not recorded in the UI pass (Not verified) | Scale to **0.96** over **150 ms** (`FastOutSlowInEasing` per the plan, see the easing note), no scale when disabled; an opt-out parameter on the shared button composable for places where the motion would distract | Press scales to 0.96: tactile feedback with an exact, shared value |

### 2.3 High-frequency interactions respond instantly

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| LOW* | Picker rows (new `SearchablePickerField`), day tabs `MainScreen.kt:489-555`, dock `BlackoutAppNavigation.kt:1050-1131`, Settings language segments `SettingsScreen.kt:660-719` | Tab and segment feedback not recorded (Not verified); the new picker has no precedent | Picker rows: instant background feedback of 150 ms or less, no entrance animation, no scale; tabs and segments: instant selected-state change or a 150 ms or shorter transition on background colour and opacity only; no press scale | Keystrokes, tab switches and list rows are high-frequency; expressive motion is reserved for infrequent moments |

### 2.4 Gate motion behind the reduced-motion setting

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| MEDIUM | `MainScreen.kt:145-159,385` | `pulseScale` is read in composition: the whole `MainScreen` recomposes every frame while `isBlackoutNow`; the pulse ignores the system animator scale | Read the animation in `graphicsLayer { }` or in its own composable; skip the pulse when `ANIMATOR_DURATION_SCALE == 0`; the static cue (colour, icon, label) always stays. The same gate applies to any new transition and to the press scale | Reduced-motion requirement and "transition only what changes". Static evidence only: this becomes `HIGH` if the emulator shows the pulse still running with animations removed |

### 2.5 Every state keeps a static cue (never colour or motion alone)

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| MEDIUM | `TimelineBar.kt:159-166`; `ScheduleRepository.kt:237-294`; big widget bitmap (`BlackoutGlanceWidget.kt`) | The drum checks only `status == POWER_OFF`, so planned and emergency outages look identical; `computeDetailedIntervals` ORs `isEmergency` across a block; the distinction exists only in the list | Emergency blocks: amber gradient with 45 degree stripes; where emergency overlaps planned: crimson base with amber stripes (spec 3.1); per-kind flags kept in the engine so the drum can overlap them; same recipe in the widget bitmap | A pattern (stripes) is a second cue in addition to colour; amber is more than 15 degrees away in hue from both crimson and the accent |
| MEDIUM | `MainScreen.kt:616-638` | Emergency row swaps the 10 dp accent dot for a 20 dp `FF5E3A` circle with "!"; no text label and no `contentDescription`; finished rows look like upcoming rows (`MainScreen.kt:592-664`) | Keep the 20 dp accent circle with "!", add the text tag "Аварійне" and a `contentDescription`; repair works get a wrench icon and "Планові роботи"; finished rows 55 % alpha with the tag "завершено" and never alerted (spec 3.2) | Glyph plus text rather than colour alone; finished state needs a visible cue |
| MEDIUM | `MainScreen.kt:312-342`, `688-731`; `BlackoutAppNavigation.kt:562-603`; `TimelineBar.kt:139` | No persistent site state; only a transient 3 s banner after a manual refresh and "Графіки не діють" | Site-status chips and a banner for degraded states, each state icon plus text, tokens reused from the About chips (spec 3.3) | A state change must leave an icon and a label behind |

### 2.6 Icons

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| LOW* | Repair-works wrench, site-status icons, emergency "!" | The project's icon set is not recorded in the sources | Use the project's existing icon source; outline for the default state, filled for the active state; icon tint from the same colour tokens as the text, never separate assets per state | One icon source per surface; icon colour follows state tokens |

### 2.7 Checked, no finding

- **Outer radius equals inner radius plus padding.** Card radius 24 with inner rows 14 and chips 10 is a consistent project convention (padding 14 to 18), left alone as a deliberate convention.
- **Shadows for elevation, borders for structure.** The glass cards use a shadow plus a 1 dp translucent border on a translucent surface; the border is kept (section 2.1 only unifies it). Android has no forced-colours mode.
- **Image outlines.** No content images: link tiles are icons on coloured tiles.
- **Transitions, not keyframes.** The only looping animation is the outage pulse (2.4); no toggle is driven by keyframes in the reviewed code.
- **Hover effects, `will-change`, overscroll containment.** Web-only recipes; not applicable to the Compose app.
- **Modal borders.** The "?" modal uses 2 dp borders (address card, result card, step cards) where cards elsewhere use 1 dp. This is not a plan item and is left as is; it is recorded so it is not mistaken for drift.

## 3. Specifications

### 3.1 Emergency overlay on the drum

Drum structure (unchanged): 24 hour cells, each with two 30-minute `Box`es, height 32 dp, vertical-gradient brush; faceplate and recessed slot unchanged (section 4.8).

| Case | Base fill | Overlay | Notes |
| --- | --- | --- | --- |
| Power on | `D8D6CC`, `FCFBF7`, `CCC9BE` (unchanged) | none | |
| Unclear | `7E8287`, `94989E`, `6E7277` (unchanged) | none | Also the "tomorrow not published" style (3.4) |
| Planned outage and repair works | `9E1E18`, `D62E26`, `8C1914` (unchanged crimson gradient) | none | Repair works are folded into Planned: same chart colour family, same toggle, same alerts (owner decision) |
| Emergency only | Amber gradient `#FFB020` to `#F28A1B` to `#C96A0B` | 45 degree stripes, 3 dp stripe and 3 dp gap, colour `#1A1208` at 55 % | |
| Emergency overlapping planned | Keep crimson base `#D62E26` | 45 degree stripes, 3 dp and 3 dp, colour `#FFB020` at 85 % | Planned and emergency stay separate flags per slot so both can show |

- **Hue separation** (computed from the hex values): amber `#FFB020` is about 39 degrees (plan: about 40), crimson `#D62E26` about 3 degrees, accent `#FF5E3A` about 11 degrees; the amber is more than 15 degrees from both.
- **Same recipe in the big widget bitmap**, so the main timeline and the big widget keep producing identical 48 half-hour states (a `CLAUDE.md` invariant covers the states, not the colours).
- **Implementation note (derived, to verify).** The UI pass reports that a 2 dp needle error is about 12 minutes, which implies roughly 6 minutes per dp, about 240 dp of track and about 5 dp per half-hour slot. A 3 dp / 3 dp stripe pattern therefore has to be drawn in one coordinate space across a whole contiguous block, not restarted in every slot, or the stripes will not read as a pattern. Confirm on the emulator.
- **Midnight.** An emergency crossing midnight (for example 22:04 to 00:04) is drawn on each day's own drum with its own half-hours.
- **Needle** only on Today (as now). While in the file, align the needle inset (6 dp) with the track inset (8 dp), see [UI_REPORT](UI_REPORT.md).
- **Accessibility.** One summary `contentDescription` for the drum replaces the 24 no-op cell clicks.

### 3.2 Rows in "outages for today"

| Row kind | Marker | Text tag | Notes |
| --- | --- | --- | --- |
| Planned | 10 dp accent dot (unchanged) | none | |
| Emergency | 20 dp circle `#FF5E3A` with "!" (unchanged look) | "Аварійне" | `contentDescription` added. Open decision: the typography pass found that the 20 dp circle clips its scaling "!" at 2x font scale; keep the 20 dp circle with a non-scaling glyph (look preserved) or enlarge it to 24 dp (see [TYPOGRAPHY](TYPOGRAPHY.md)). The text tag carries the scaled label either way |
| Repair works (`pw_accident_planeds`) | Wrench icon | "Планові роботи" | Treated as Planned |
| Finished | Same marker at 55 % alpha | "завершено" | Never alerted |
| Overdue emergency (estimated restore passed, still listed, within the 60 min grace) | Not specified in the plan | Not specified | The engine treats it as active; its visual treatment is an open design point |

### 3.3 Site status (indicator and banner)

**Placement.** A chip row in the "Last updated" card (always present), plus a glass banner card between the header and the hero card for degraded states only. Both persistent; the transient 3 s banner is not used for site state.

**Chip tokens** (reused from the About chips, `AboutScreen.kt:465-468`; the grey is new):

| Token | Background | Text and icon | Base hue token |
| --- | --- | --- | --- |
| Green | `0x3310B981` | `#34D399` | `#10B981` |
| Amber | `0x33F59E0B` | `#FBBF24` | `#F59E0B` |
| Red | `0x33EF4444` | `#F87171` | `#EF4444` |
| Grey (new) | `#339CA3AF` | `#9CA3AF` | `#9CA3AF` |

**States.** The plan fixes the token set and requires icon plus text for each state; it does not assign states to colours. The assignment below is a proposal. Copy for the state labels is not specified in the sources and is to be written in `AppStrings` (uk and en) in the writing pass; only the strings quoted from the plan are fixed.

| State | Proposed colour | Notes |
| --- | --- | --- |
| `AVAILABLE_WITH_TABLE` | Green | Normal state |
| `AVAILABLE_NO_TABLE` | Amber | Site answers but publishes no table for today |
| `SITE_UNREACHABLE` | Red | Validated network, site not reachable (DNS, timeout, 5xx) |
| `NO_INTERNET` | Grey | Same grey as the existing "unclear" status colour |
| Cached data shown while degraded | Amber chip, text "дані за HH:mm" (from the plan) | Cache stays, marked stale |
| Tomorrow's table | Chip text "графік на завтра: опубліковано / ще немає" (from the plan) | Next to the site state |
| PowerOn degraded | Status line "Аварійні: недоступні" (from the plan) | Own small status line |

**Geometry.** Chip: reuse the period chip shape (radius 10, padding 10 x 4), text role `label` 14/20 SemiBold, in a `FlowRow` so chips wrap instead of clipping at large font scale. Banner: `GlassCard` (radius 24, border 1 dp `0x26FFFFFF`, padding 16), title role `subhead` 16/22 Bold, message role `body` 16/24 Medium. Contrast of the new grey chip and of the amber and green chips on the card has not been measured (Not verified).

### 3.4 Tomorrow tab

- Always present in the existing segmented control (container radius 16, bg `0x80141A29`, padding 4; tabs radius 12; selected pill `#33FFFFFF`), minimum height 48 dp (about 36 dp today), `selectable(role = Role.Tab)`. The static "Сьогодні" pill fallback (`MainScreen.kt:489-555`) is removed. Labels already exist in `AppStrings.kt:27-28` ("Сьогодні", "Завтра").
- Tomorrow table published: drum and rows from the ztoe tomorrow table, plus PowerOn emergency outages and repair works that touch tomorrow.
- Tomorrow table not yet published: the same drum in the grey "unclear" style (`7E8287`, `94989E`, `6E7277`) plus a glass notice "Графік на завтра ще не опубліковано на сайті"; any emergency or repair outage that PowerOn already lists for tomorrow is still drawn and listed under it.
- Needle only on Today.

### 3.5 Midnight-crossing rows

One row per outage with its full span and the date on the far side. Example from the plan: outage 13.11 23:00 to 14.11 01:00.

| View | Row text | Duration chip | Tag |
| --- | --- | --- | --- |
| Today | `23:00 – 01:00 (14.11)` | **2 год** | none |
| Tomorrow | `00:00 – 01:00` | **2 год** | "з 13.11 23:00" |

- Day totals ("без світла за день") count only the hours inside that day (1 год plus 1 год), so the two days still sum correctly. The drum draws each day's own half-hours.
- Duration chip: existing chip (radius 10, `0x26FFFFFF`), mono bold, text role `caption`; non-breaking space between number and unit ("2 год").
- Tomorrow table missing and today's last slot off: the span ends at 24:00 and is marked "may continue" (engine rule); the copy for that mark is not specified and is to be written in `AppStrings`.
- Open point: the plan keeps the per-kind rows separate (for example planned 23:00 to 24:00 and emergency 00:00 to 02:00 form one 3 h span for the countdown and alerts); whether each row's chip shows its own duration or the span duration is not specified.

### 3.6 Address picker (`SearchablePickerField`)

| Aspect | Spec |
| --- | --- |
| Field | Read-only field in the existing input style (bg `#14FFFFFF`, focused `#1AFFFFFF`, radius 16, border 1 dp `#33FFFFFF`, accent border when focused), 56 dp high; opens the picker |
| Container | Full-screen dialog (the modal is already `usePlatformDefaultWidth = false`) on the solid `0xFF141A29` page; `statusBarsPadding`, `navigationBarsPadding`, `imePadding()` |
| Search | Sticky 56 dp field at the top, same input style; diacritic-, apostrophe- and prefix-insensitive using `StreetKey`; matches with and without the prefixes `вул.`, `м.`, `с.` (`ZAL:62-64`) |
| List | `LazyColumn(key = id)`, rows 52 dp (above the 48 dp minimum), row text 16 sp as today, check mark on the current value |
| States | Loading row with spinner (wires the dead `isCheckingAddressOnSite`), empty row, error row with retry; no silent failures |
| Used for | REM (19), City (103 settlements in the Zhytomyr REM), Street (967 streets in Zhytomyr city), House (100+ for a long street) |
| Cascade | REM, City, Street, House as today; a REM no longer auto-selects a city the user has not chosen; House stays disabled until a street is chosen |
| Duplicates | One row per street after the `StreetKey` merge (8 real duplicate pairs merge, see [CODE_REVIEW](CODE_REVIEW.md)) |
| Motion | No entrance animation (high-frequency); row press feedback instant (150 ms or less) on background colour only |
| Data | Bulk `all=1` page fetched once per city per TTL, not on every open |

### 3.7 Press feedback and motion

- Buttons and chips: scale **0.96** over **150 ms** (`FastOutSlowInEasing`, plan value; see the easing note), no scale when disabled, an opt-out parameter on the shared component.
- Tabs, segments, dock, picker rows: no scale; instant feedback (2.3).
- The pulse and every new transition honour the system animator scale; a static cue (colour, icon, label) is always present.
- Transitions name the properties they change; no "all".

### 3.8 Consistency

`GlassCard` as in 2.1. Inner row radii (14), chip radius (10) and the 36 dp icon tiles (radius 10) are a consistent project convention and stay.

## 4. What stays unchanged (original look)

These tokens are kept exactly. No new typeface; no change to the dark glass language, the time-of-day background or the drum bezel. Values are from the UI pass (section 6 of the UI report) and the plan.

### 4.1 Accent and status colours

| Token | Value | Use |
| --- | --- | --- |
| Accent | `0xFFFF5E3A` (35 uses) | Primary buttons, toggle-on, emergency text, "!" badge, focused field border; tint chips `0x26FF5E3A` and `0x33FF5E3A` |
| Green | `34D399` | Power on |
| Red | `EF4444`, `F87171` | Error |
| Grey | `9CA3AF` | Unclear |
| Amber | `FBBF24` | Warning |

### 4.2 Surfaces

| Token | Value |
| --- | --- |
| Card background | `0xBF141A29` (`DarkSurface` `#141A29` at 75 %; translucency, not blur) |
| Solid surfaces | Menu and modal `0xFF141A29`; dock `0xCC141A29`; overlay switch `0xE6141A29` |
| Inner rows | `0x14FFFFFF` |
| Hairline divider | 1 dp `0x1AFFFFFF` |
| Input | `0x14FFFFFF`, focused `0x1AFFFFFF`, unfocused border `0x33FFFFFF` |
| Day selector container | `0x80141A29`, selected tab `0x33FFFFFF` |
| In-app banner | `0xF2141A29` |
| Overlay dim | `0xD9070A12` |

### 4.3 Corner radii

24 for cards (47 uses); 16 for inputs, tiles, buttons and the day-selector container (33 uses); 14 for inner rows; 12, 10 and 8 for chips and tabs; 20, 18, 9, 4 and 2 are rare (the radius 20 of the "Last updated" card moves to 24, section 4.9).

### 4.4 Borders

1 dp `0x26FFFFFF` on 9 cards; 1 dp `0x40FFFFFF` on CTAs and the "?" tile; 2 dp white at 25 %, `0x26FFFFFF` and `0x33FFFFFF` in the modal.

### 4.5 Shadows

`floatingShadow(0xB3000000, radius 24, blur 22 to 24, offsetY 8 to 10, 18 steps)` plus `Modifier.shadow(10 dp, ambient 0x66000000, spot 0x80000000)`; smaller values on the day selector and the 16 dp-radius surfaces.

### 4.6 Text colours and segmented controls

| Token | Value |
| --- | --- |
| Text | White |
| Secondary | `0xB3BAE6FD` |
| Tertiary | `0x99BAE6FD` |
| Field labels | `0xE6BAE6FD` |
| Settings segmented control | Container `0x59000000`, radius 12, border 1 dp `0x1AFFFFFF`, selected white on black, radius 9 |
| Main overlay segmented control | Container `0xE6141A29`, radius 16, border 1 dp `0x33FFFFFF`, selected white on black, radius 12 |

### 4.7 Time-of-day palette (`TimeOfDayPalette.kt`)

| Phase | Primary | Secondary | Accent | Supporting |
| --- | --- | --- | --- | --- |
| MORNING | `F4F9F9` | `4A7C59` | `FFB085` | `2C3E35` |
| DAY | `FFFFFF` | `0A2540` | `FFD166` | `4682B4` |
| EVENING | `1A0B2E` | `8B3A62` | `FF6B6B` | `FFE66D` |
| NIGHT | `0B0C10` | `1F2833` | `66FCF1` | `C5C6C7` |

Anchors: 02:00 night, 08:30 morning, 14:30 day, 20:00 evening, 26:00 night, with smoothstep interpolation. The background is five radial gradients plus a `0B0C10` scrim (65 % to 25 % to 0) over the top 148 dp (`BlackoutAppNavigation.kt:621-699`). Window colour `0F1420`.

### 4.8 Drum bezel (`TimelineBar.kt`)

| Part | Value |
| --- | --- |
| Outer faceplate | Radius 16, gradient `DFDDD0`, `D4D1C1`, `C6C2B0`, border 2 dp `7A7768`, padding 12/12/12/10 |
| Recessed slot | `4E514E`, radius 8, border 2 dp `6E716B`, padding 6 |
| Grid background | `C8C6BC` with 1.5 dp hour gaps |
| Off block | `9E1E18`, `D62E26`, `8C1914` |
| On block | `D8D6CC`, `FCFBF7`, `CCC9BE` |
| Unclear block | `7E8287`, `94989E`, `6E7277` |
| Needle | 3 dp `0B0B0A` with a 4.5 dp `0xD9FFFFFF` halo, protruding 4 dp; Today only |
| Ticks | Every 2 h, 1.5 x 5 dp `1C1B18`, labels mono bold |

### 4.9 Fonts and invariants, and the deliberate exceptions

- **Fonts preserved** (UI pass): hero countdown 44 Black Mono; queue title 24 Bold; modal title 20 ExtraBold; Settings title 22 Bold. The plan's role scale would move the Settings title to 20 ExtraBold, which conflicts with this list; see the open decision in [TYPOGRAPHY](TYPOGRAPHY.md).
- **Invariants** (`CLAUDE.md`): queue-help 4-step text and "Зрозуміло" character for character; Facebook link on Main; widget labels "СВІТЛО Є" and "СВІТЛА НЕМАЄ"; any edited file under `ui/`, `components/`, `widget/` named in `CHANGELOG.md`.

**Deliberate exceptions to "unchanged"** (each needs an owner decision or an emulator check):

| # | Exception | Reason | Alternative that keeps the token |
| --- | --- | --- | --- |
| 1 | Label colour on filled accent buttons: black (6.91:1) or a darker accent for text buttons only | White on `#FF5E3A` is 3.04:1 | None for the label; the candidate `#D93F1E` is reported at 4.49:1, below 4.5:1, and must be re-measured |
| 2 | Card alpha `0xBF` to `0xE6` behind small text | Tertiary text is 3.2:1 in the DAY worst case | Raise the small-text alpha to `0xCC` or `0xE6` and leave the card token (the sources are ambiguous about which of the two is meant) |
| 3 | A 1 dp hairline on the currently borderless cards | One `GlassCard` | None; the owner may instead choose the borderless variant |
| 4 | Radius 20 to 24 on the "Last updated" card | One radius per card | None |
| 5 | Text sizes (type scale) | 64 % of text is 12 sp or smaller | Hero, title and heading sizes are preserved, except the open Settings title decision |
| 6 | New tokens: amber and stripes for emergency, grey chip, banner | New states | None |

## 5. Wireframes (structure only)

Main screen with the new status indicator and the Tomorrow tab (Today view, power on, next outage crossing midnight). Strings quoted from the code or the plan; angle brackets mark copy that is not yet specified.

```text
+--------------------------------------------------+
| Черга X.Y                        [ pill 58x34 ]  |  header: title 24/30, hit area 48 dp
| <address line 1>                                 |
| <address line 2>                                 |
|                                                  |
| +----------------------------------------------+ |  NEW: site-state banner (degraded states only)
| | (icon) <state title>                         | |  GlassCard r24, border 1 dp, subhead + body
| |        <state text, "дані за HH:mm" if stale>| |  persistent, not a 3 s toast
| +----------------------------------------------+ |
|                                                  |
| +----------------------------------------------+ |  hero card
| | (dot) <status text>                 <clock>  | |
| | До відключення залишилось:                   | |
| |                01:35:12                      | |  display 44/48 Mono, maxLines 1
| | -------------------------------------------- | |
| | <period label>   [ 23:00 – 01:00 (14.11) ]   | |
| |                  [ 2 год ]                   | |
| +----------------------------------------------+ |
|                                                  |
| +----------------------+-----------------------+ |  day selector, 48 dp min height
| |  [ Сьогодні ]        |       Завтра          | |  Tomorrow tab always present
| +----------------------+-----------------------+ |
|                                                  |
| +----------------------------------------------+ |  schedule card
| | 0   2   4   6  ...  20  22  24   (ticks)     | |  thin to every 4 h above 1.3x font scale
| | [##....////////....##########.......######]  | |  ## planned crimson, //// emergency amber stripes
| |            ^ needle (Today only)             | |
| | -------------------------------------------- | |
| | (o)  23:00 – 01:00 (14.11)         [ 2 год ] | |  planned row, 10 dp dot
| | (!)  Аварійне  10:00 – 12:00  завершено      | |  emergency row, finished = 55 % alpha
| | (wrench) Планові роботи  08:00 – 17:00       | |  repair works, folded into Planned
| +----------------------------------------------+ |
|                                                  |
| +----------------------------------------------+ |  "Last updated" card (radius 24)
| | Останнє оновлення: <time>             [ (R) ]| |
| | [site chip] [графік на завтра: <...>]        | |  chips in a FlowRow (wrap, never clip)
| | [Аварійні: <...>]                            | |
| +----------------------------------------------+ |
|  (link cards, Facebook and site)                 |
|  (dock)                                          |
+--------------------------------------------------+
```

Tomorrow tab, before ztoe has published tomorrow's table:

```text
|  Сьогодні        [ Завтра ]                       |
| +----------------------------------------------+ |
| | Графік на завтра ще не опубліковано на сайті | |  glass notice
| +----------------------------------------------+ |
| | grey "unclear" drum, no needle               | |
| | amber stripes where PowerOn already lists    | |
| | an emergency or repair outage for tomorrow   | |
| | rows: only those emergency / repair outages  | |
| +----------------------------------------------+ |
```

Tomorrow tab, outage continuing from today:

```text
| 00:00 – 01:00    з 13.11 23:00           [ 2 год ] |
```

## 6. Verification

No command was run. Static checks only.

| Check | Method | Result |
| --- | --- | --- |
| Token values against the UI pass and the plan | Compared while writing | Passed (values transcribed; no value invented) |
| Hue separation of amber, crimson and accent | Computed from the hex values | Passed (about 39, 3 and 11 degrees) |
| `better-ui` principles against the reviewed components | Reading the UI pass notes | Passed (rows in section 2) |

**Not verified** (emulator, plan phase 6):

- Rendering of every specification above: stripes on the drum and the widget bitmap, amber versus crimson legibility, stripe continuity across 5 dp slots.
- Contrast of the new grey chip and of the amber, green and red chips on the card, and of the amber text on the amber tint.
- Press scale feel at 0.96 over 150 ms, easing choice, and the opt-out.
- Chip and banner wrapping at font scale 1.3 and 2.0, and at 320 dp width.
- Pulse behaviour with animations removed.
- Whether adding a hairline to the borderless cards changes the look acceptably.

## 7. Verdict

**Approve** for the `better-ui` scope only: no `HIGH` polish finding is open; the reduced-motion row (2.4) escalates to `HIGH` if the emulator confirms the pulse ignores the animator scale. This covers static inspection of surfaces, icons and motion; rendering is Not verified. The overall interface verdict remains **Block** (see [UI_REPORT](UI_REPORT.md)).
