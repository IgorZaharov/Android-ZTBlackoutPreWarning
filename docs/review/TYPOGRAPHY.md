# Typography check (better-typography): "fonts too small for the boxes"

Branch `feat/1.4.0-outage-rework`. Format: the `better-typography` skill (findings table `Severity | Location | Before | After | Why` grouped by principle, verification, `Block` or `Approve`), plus the full audit, the proposed role scale with a mapping from every current literal, Ukrainian-text specifics and a font-scale test matrix.

Evidence is **static**: source reading, the 78-literal audit and calculated widths at 360 dp. **Nothing has been rendered or run on a device or emulator**; all wrap and clip thresholds are calculated, not observed.

Related documents: [README](README.md) | [CODE_REVIEW](CODE_REVIEW.md) | [UI_REPORT](UI_REPORT.md) | [UI_PROPOSALS](UI_PROPOSALS.md)

## 1. Scope and facts

Scope: Main, Settings, the "?" address modal, About, the drum and the dock/banner in the Compose app (`android/app/src/main/java/ua/blackout/prewarning/ui/`). Out of scope: the roulette screen (`ZhytomyrRouletteScreen.kt`), the Glance widget text and the React simulator (parity follows in plan phase 4).

- **Theme.** `Theme.kt` defines only light and dark `ColorScheme`s: no `Typography`, no `Shapes`, although `HANDOVER.md:160` claims a typography setup. No file uses `MaterialTheme.typography` or `colorScheme`.
- **Literals.** 78 hard-coded `fontSize` values in Main, Settings, Timeline and Navigation: 10 sp x6, 11 sp x14, **12 sp x30**, 13 sp x6, 14 sp x11, 15 sp x1, 16 sp x3, 20 sp x2, 22 sp x1, 24 sp x2, 44 sp x2 (sum 78). That is 11 distinct sizes; 50 of 78 (64 %) are 12 sp or smaller. (The plan's section 3.4 lists the same histogram without the single 15 sp literal, so its figures sum to 77.)
- **Defaults.** The only sizes not hard-coded are the M3 defaults: 16 sp `bodyLarge` inside `OutlinedTextField` and `DropdownMenuItem`, and the `AlertDialog` defaults. Result: a field value (16 sp) is larger than its 11 to 12 sp label and card title, which is the "too small for the boxes" feel.
- **Fonts.** System default plus `FontFamily.Monospace` for the countdown, times, URLs and tick labels. Two families; no custom font. Weights seen in the audit: Medium, SemiBold, Bold, ExtraBold, Black (no weight below 400 recorded).
- **Truncation and wrapping.** No `maxLines` or `overflow` anywhere except two 10 sp URL captions (`maxLines = 1`, ellipsis, `MainScreen.kt:790,859`), the overlay language labels (`maxLines = 1`, `:954`) and `softWrap = true` on the link titles. `lineHeight` is hard-coded in sp, which scales with the font scale. No `letterSpacing` except 0.8 sp on the modal uppercase headings (`SettingsScreen.kt:1043,1494`).
- **Constraint.** No new typeface (`better-typography`: never propose one unless asked).

## 2. Findings

One row per root cause, grouped by the principle it violates. **Severity note.** The standalone typography ladder reserves `HIGH` for unreadable text, truncation with no way back, and clipping at 320 px or 200 % zoom; breaking the type system or the heading hierarchy is `MEDIUM` there. The type-scale rows are `HIGH` here because the plan and [UI_REPORT](UI_REPORT.md) rate them under the interface-wide scale (a repeated systemic failure across every screen). The clipping row is `HIGH` under both ladders, so the verdict does not depend on this choice.

### 2.1 Use a type scale with semantic names; fewer sizes

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| HIGH | `Theme.kt` (no `Typography`); 78 literals in `MainScreen.kt`, `SettingsScreen.kt`, `TimelineBar.kt`, `BlackoutAppNavigation.kt`, `AboutScreen.kt` (full list: section 3) | 11 distinct sizes from 10 to 44 sp, each a literal with its own weight and line height; M3 defaults supply 16 sp in fields and menus | `Typography` in `Theme.kt` with 8 roles (section 4); every literal replaced by a role; no `fontSize =` literal outside the role definitions | Each size, weight and line height is a separate decision; a role is one decision. Without a scale, sizes drift between screens |

### 2.2 Heading sizes descend; size floors

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| HIGH | `SettingsScreen.kt:205,211,292,375,435,514,547,586,640,683,711,1057-1250`; `MainScreen.kt:436,587,656,703-708`; 10 sp text at `MainScreen.kt:787,856`, `SettingsScreen.kt:348`, `TimelineBar.kt:221` | Card titles 12 sp Bold and descriptions 11 sp sit above 16 sp field values; uppercase titles 11 sp; toggle labels 12 sp; the smallest hero text is 11 sp (`MainScreen.kt:436`); six 10 sp literals | Floor 12 sp (no 10 or 11 sp); field labels 14 sp; captions 13 sp; body and field values 16 sp; card titles at `subhead` 16 sp so a title is never smaller than the value under it | A heading is never smaller than body text unless it is a deliberate overline; UI text rarely goes below 12 sp. 64 % of the text is 12 sp or smaller |

### 2.3 Wrap deliberately (clipping at large font scale)

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| HIGH | `MainScreen.kt:273-304,366,373-425,443,458-482,626,907-955`; `SettingsScreen.kt:290-316,373-384,514-565,698-717,738-779,1421`; `TimelineBar.kt:139,221`; `AboutScreen.kt:262-294` | Countdown (44 sp, no `maxLines`) char-wraps from 1.4x ("01:35:1/2"); rows without `weight(1f)` wrap or collide from 1.3x ("ЗАРАЗ НЕМАЄ СВІТЛА" about 294 versus 292 dp, "ПОПЕРЕДЖАТИ ЗАЗДАЛЕГІДЬ" with "1–240 хв", "На сайті не знайдено черг" about 166 dp beside its title, "Тест сповіщення" in about 142 dp); "Орієнтовне відновлення:" plus value splits the timestamp from 1.5x; fixed boxes clip (20 dp "!" circle, 32 dp "Графіки не діють" at 2x, 260 dp language switch from 1.15x); tick labels 156 dp at 1x become 312 dp at 2x, wider than the 288 dp track | `softWrap = false` and `maxLines = 1` on numerics and timestamps; cap the font scale on the 44 sp node only; `weight(1f)` on the text side of every row; `heightIn(min = ...)` instead of fixed heights; `maxLines = 2` where wrapping is acceptable; thin the tick labels to every 4 h above 1.3x; emergency detail as two rows | Text is clipped, overlapped or broken at 130 to 200 percent font scale; non-wrapping values must never split mid-token |

### 2.4 Truncate with a way back

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| MEDIUM | `MainScreen.kt:787-790,856-859` (URL captions, 10 sp mono, `maxLines = 1`, ellipsis); `AboutScreen.kt:262-294,290` (71-character mono URL, no `maxLines`, pushes the trailing icon out) | Ellipsized URL with no way to read the full value; the About row loses its icon | Wrap to two lines or tap to copy; About URL `weight(1f)`, `maxLines = 1`, ellipsis with the trailing icon kept | A truncated value needs a way back to the full text. Rated `MEDIUM` because the link cards presumably open the URL (assumed from "link cards" in the UI pass; Not verified); it becomes `HIGH` if the full URL is not reachable any other way |

### 2.5 Line-height by role

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| MEDIUM | `MainScreen.kt:205` (12 sp, line height 16, ratio 1.33); `:260,:335` (14 sp, line height 19, ratio 1.36) | Wrap-capable text under 1.4 (the address is forced to two lines and reaches three at large scale); line heights are in sp, which scales correctly | Wrap-capable text at 1.4 or more: proposed roles in section 4 give address 13/18 (1.38) and banner 16/22 (1.375), which are still under 1.4; use 13/19 and 16/23 where text can reach three lines (open decision D2), or cap with `maxLines` | Anything that wraps to three or more lines needs at least 1.4, even in a height-constrained row |

### 2.6 Letter-spacing by size

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| LOW | `SettingsScreen.kt:292,375,435` (uppercase titles, 11 sp Bold); `MainScreen.kt:401` ("ЗАРАЗ НЕМАЄ СВІТЛА", 13 sp Bold) | No letter-spacing recorded; the modal uppercase headings already use 0.8 sp at 14 sp (about 0.057 em) | Uppercase labels at 14 sp or smaller take +0.05 em (the `overline` role, 12/16, and `label` with tracking for 14 sp headings) | Uppercase labels at 14 sp or smaller take 0.05 em |

### 2.7 Typographic punctuation

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| LOW* | Duration chips ("N год", `MainScreen.kt:656`), "15 хв" notices, hints such as "1–240 хв" (`SettingsScreen.kt:380,440`), `AppStrings.kt` | Whether the separator between a number and its unit is a plain or a non-breaking space is not recorded (Not verified). The en dash is already used in ranges | Non-breaking space between a number and its unit ("2 год", "15 хв"); keep the en dash; keep «» for quotation marks | A number must not be separated from its unit by a line break. Not confirmed in the strings, hence `LOW*` |

### 2.8 Tabular numbers on changing values

No finding. The countdown, interval times, tick labels and URLs are already `FontFamily.Monospace` (equal digit widths). The plan adds `fontFeatureSettings = "tnum"` for any other changing figure; which non-mono figures change (for example the "last updated" time) is not recorded and is a test-matrix item (section 7), Not verified.

### 2.9 Checked, no finding

- **Fonts.** Two families (system and mono), under the three-font ceiling.
- **Input size.** M3 fields and menus use 16 sp; no input is below 16 sp.
- **Weights.** No weight below 400 is recorded; the lightest is Medium.
- **Letter-spacing of the modal headings.** 0.8 sp at 14 sp is about 0.057 em, close to the 0.05 em guidance.
- **Font smoothing, `text-wrap` and CSS recipes.** Web-only; the Compose equivalents are `LineBreak.Heading` and `LineBreak.Paragraph` (section 4).

## 3. Full audit (UI pass, section 2)

"Suggested" is the size the UI pass proposed before the role scale existed. The role mapping in section 5 is the final value; where they differ, the role scale wins.

| file:line | Text | Current | Issue | Suggested |
| --- | --- | --- | --- | --- |
| `MainScreen.kt:205` | address under queue | 12 Medium lh16 | Small, two lines forced, tertiary colour | 14 lh20 |
| `MainScreen.kt:273-304` | emergency label and value | 12 Medium / 12 Bold Mono | `Row` with no weights. "Орієнтовне відновлення:" plus value splits the timestamp at fontScale 1.5 or more | 14; label `weight(1f)`, value `softWrap = false` |
| `MainScreen.kt:260`, `:335` | banner title and status | 14 Bold lh19 | OK | 16 lh22 |
| `MainScreen.kt:401` | "ЗАРАЗ НЕМАЄ СВІТЛА" | 13 Bold | Shares a Row with the clock; wraps at 1.3x or more (about 294 versus 292 dp) | 15, `weight(1f)`, `maxLines = 2` |
| `MainScreen.kt:419` | clock | 12 Mono Bold | Small | 13 |
| `MainScreen.kt:436` | "До відключення залишилось:" | 11 SemiBold | Smallest text on the hero | 13 |
| `MainScreen.kt:443`, `:366` | countdown | 44 Black Mono, no `maxLines` | "01:35:12" is about 211 dp of 292 dp; at 1.4x or more it char-wraps ("01:35:1/2") | Keep 44, `softWrap = false`, `maxLines = 1`, cap fontScale for this node |
| `MainScreen.kt:465`, `:476` | period label and chip | 13 / 14 Bold Mono | No weights; chip wraps at 1.4x or more | 14 / 15, label `weight(1f)` |
| `MainScreen.kt:510`, `:526`, `:549` | day tabs | 13 Bold | Tabs about 36 dp tall | 14, `heightIn(min = 48.dp)` |
| `MainScreen.kt:587` | list header | 11 Bold | Too small, long UK string | 13 |
| `MainScreen.kt:626` | "!" in 20 dp circle | 12 Black | Text scales, circle fixed 20 dp; clips at 2x | Size 24 dp or non-scaling glyph |
| `MainScreen.kt:642` | interval time | 15 Bold Mono | OK | 16 |
| `MainScreen.kt:656` | duration pill | 11 Bold Mono | Too small | 13 |
| `MainScreen.kt:703-708` | last and next updated | 11 | Small | 13 |
| `MainScreen.kt:781`, `:850` | link title | 12 Bold | Wraps correctly, small | 14 |
| `MainScreen.kt:787`, `:856` | URL caption | 10 Mono | Smallest text, ellipsized | 12 |
| `MainScreen.kt:907-955` | overlay CTA, subtitle, language | 24 / 12 / 12 `maxLines = 1` | Fixed 260 dp switch gives about 64 dp text slot per segment; "Українська" borderline at 1x and clips at 1.15x or more | 13; `fillMaxWidth(0.9f)` |
| `TimelineBar.kt:139` | "Графіки не діють" | 12 ExtraBold in fixed 32 dp | Clips if it wraps (2x or more) | 13, `maxLines = 1` |
| `TimelineBar.kt:221` | tick labels | 10 Mono Bold | 13 x 12 dp = 156 dp now; at 2x 312 dp exceeds 288 dp, so they overlap | 11, thin out labels at large scale |
| `SettingsScreen.kt:205`, `:211` | card title and description | 12 Bold / 11 | Smaller than the 16 sp field below | 14 / 13 |
| `SettingsScreen.kt:292`, `:375`, `:435` | uppercase titles | 11 Bold | The `Row` has no weights. "ПОПЕРЕДЖАТИ ЗАЗДАЛЕГІДЬ" plus "1–240 хв" (10 sp) collides at 1.3x or more | 13, `weight(1f)` |
| `SettingsScreen.kt:312` | site badge pill | 11 Bold | "На сайті не знайдено черг" is about 166 dp in a pill beside the title; wraps at 1.3x or more | 12, `weight(1f)` |
| `SettingsScreen.kt:348` | duplicate error text | 10 `0xFFF87171` | Duplicates the badge | Remove or 12 |
| `SettingsScreen.kt:514`, `:547`, `:586`, `:640` | toggle labels | 12 Bold / 12 | Rows 1 to 3 lack `weight(1f)`; smaller than the 16 sp fields | 15 to 16, `weight(1f)` |
| `SettingsScreen.kt:683`, `:711` | language title and segments | 12 / 11 | Text slot about 76 dp; "Українська" wraps at 1.4x or more; row about 30 dp tall | 13; min height 48 |
| `SettingsScreen.kt:755`, `:777`, `:797` | action buttons | 12 Bold / SemiBold | Half-width box about 142 dp; "Тест сповіщення" wraps at 1.3x or more; rows 36 to 40 dp | 14; stack at large scale |
| `SettingsScreen.kt:1040`, `:1057-1250` | modal title and field labels | 14 ExtraBold letterSpacing 0.8 / 12 Bold | Labels small relative to the 16 sp fields | 14 / 14 |
| `SettingsScreen.kt:1421` | emergency detail | 12 Mono | Only about 228 dp inner width; "Початок: … · Відновлення: …" wraps mid-timestamp | Two rows, 14 |
| `SettingsScreen.kt:1548`, `:1566` | step text | 14 lh20 | OK | 15 to 16 lh24 |
| `BlackoutAppNavigation.kt:1043` | app banner | 12 Bold | Small | 14 |
| `AboutScreen.kt:139`, `:186`, `:254-255` | about texts | 10 to 12 | Same issue | 12 to 14 |

Fonts the redesign should preserve (UI pass): hero countdown 44 Black Mono, queue title 24 Bold, modal title 20 ExtraBold, Settings title 22 Bold. The 20 sp modal-title line and the second 20 sp literal are not itemised in the audit; the audit labels `SettingsScreen.kt:1040` as the modal title at 14 sp ExtraBold with 0.8 sp spacing (the uppercase heading) while the preserve list names a 20 ExtraBold modal title (see section 8).

## 4. Proposed role scale (plan section 3.4)

Replaces the literals; the hero and title sizes are preserved. Defined once in `Theme.kt` and consumed through `MaterialTheme.typography` (and, for iOS later, mapped to Dynamic Type styles through `spec/design-tokens.json`).

| Role | sp / line | Line-height ratio | Weight | Replaces |
| --- | --- | --- | --- | --- |
| display | 44 / 48 | 1.09 | Black, Mono | Hero countdown (unchanged) |
| title | 24 / 30 | 1.25 | Bold | Queue title (unchanged) |
| heading | 20 / 26 | 1.30 | ExtraBold | Screen and modal titles (20 to 22) |
| subhead | 16 / 22 | 1.375 | Bold | Card titles, field values, banner titles (12 to 14) |
| body | 16 / 24 | 1.50 | Medium | Toggle labels, step text, interval times (12 to 16) |
| label | 14 / 20 | 1.43 | SemiBold | Field labels, buttons, tabs, chips (11 to 13) |
| caption | 13 / 18 | 1.38 | Medium | Addresses, last-updated, durations, URL captions (10 to 12) |
| overline | 12 / 16, +0.05 em | 1.33 | Bold, uppercase | Section headings, drum ticks (10 to 11) |

**Rules from the plan.**

- Floor **12 sp**.
- Wrap-capable text gets line height of at least 1.4 (see D2: `subhead` 1.375 and `caption` 1.38 are below the plan's own rule).
- `LineBreak.Heading` on card titles and `LineBreak.Paragraph` on body (balanced, no lone last word; supported by the current Compose BOM).
- Non-breaking space between a number and its unit ("2 год", "15 хв").
- Numerics in Mono are already tabular; any other changing figure gets `fontFeatureSettings = "tnum"`.
- Let boxes grow (`heightIn(min = ...)`, `weight(1f)`) instead of shrinking text.
- Thin the tick labels to every 4 h when the font scale is above 1.3.
- URL captions wrap or tap-to-copy instead of a dead ellipsis.
- Test at font scale 1.0, 1.3 and 2.0 (section 7).
- Proposal (not in the plan): a gate that fails when a `fontSize =` literal appears outside the role definitions, so the scale cannot erode.

**Tick-label arithmetic** (from the UI pass's 12 dp per label at 10 sp). At the `overline` size of 12 sp a label is about 14.4 dp, so 13 labels take about 187 dp at 1x, about 243 dp at 1.3x and about 374 dp at 2x (more than the 288 dp track). At every 4 h (7 labels) the width at 2x is about 202 dp, which fits. These are derived estimates; confirm on the emulator.

## 5. Mapping from every current literal to a role

The plan gives role ranges ("Replaces" column above); the assignment of each concrete usage below was made in this document and is proposed. Weights follow the role unless the current weight is part of the preserved look (display, title, heading).

### 5.1 By literal size

| Literal | Count | Where | Role |
| --- | --- | --- | --- |
| 44 sp | 2 | Countdown (`MainScreen.kt:443`, `:366`) | display |
| 24 sp | 2 | Queue title "Черга X.Y" (header, `MainScreen.kt:189-239`); overlay CTA (`:907-955`) | title (the CTA label keeps title size to preserve the look) |
| 22 sp | 1 | Settings title | heading (size and weight change; see D1) |
| 20 sp | 2 | Modal title (20 ExtraBold); the second location is not itemised in the audit | heading |
| 16 sp | 3 | Locations not itemised in the audit | subhead or body by use (list them with a search for `fontSize = 16.sp` at implementation) |
| 15 sp | 1 | Interval time (`MainScreen.kt:642`) | body |
| 14 sp | 11 | Banner title and status (`MainScreen.kt:260,335`), period chip (`:476`), modal uppercase headings (`SettingsScreen.kt:1040`), step text (`:1548,1566`), others not itemised | subhead, label or body by use (rows below) |
| 13 sp | 6 | "ЗАРАЗ НЕМАЄ СВІТЛА" (`MainScreen.kt:401`), period label (`:465`), day tabs (`:510,526,549`) | label |
| 12 sp | 30 | See rows below | caption, label, overline or subhead by use |
| 11 sp | 14 | See rows below | caption, label or overline by use |
| 10 sp | 6 | URL captions (`MainScreen.kt:787,856`), error text (`SettingsScreen.kt:348`), tick labels (`TimelineBar.kt:221`), others not itemised | caption (URL), overline (ticks), caption or removal (error) |

### 5.2 By usage (every audited style)

| # | Location | Current | Role | New size / line |
| --- | --- | --- | --- | --- |
| 1 | `MainScreen.kt:205` address under queue | 12 Medium lh16 | caption | 13/18 |
| 2 | `MainScreen.kt:273-304` emergency label, value | 12 Medium, 12 Bold Mono | label (value in Mono) | 14/20; label `weight(1f)`, value `softWrap = false` |
| 3 | `MainScreen.kt:260,335` banner title, status | 14 Bold lh19 | subhead | 16/22 |
| 4 | `MainScreen.kt:401` "ЗАРАЗ НЕМАЄ СВІТЛА" | 13 Bold | label | 14/20; `weight(1f)`, `maxLines = 2` |
| 5 | `MainScreen.kt:419` clock | 12 Mono Bold | caption (Mono) | 13/18 |
| 6 | `MainScreen.kt:436` "До відключення залишилось:" | 11 SemiBold | caption | 13/18 |
| 7 | `MainScreen.kt:443,366` countdown | 44 Black Mono | display | 44/48; `softWrap = false`, `maxLines = 1`, capped font scale |
| 8 | `MainScreen.kt:465,476` period label, chip | 13 / 14 Bold Mono | label / label (Mono) | 14/20 each; label `weight(1f)` |
| 9 | `MainScreen.kt:510,526,549` day tabs | 13 Bold | label | 14/20; min height 48 dp |
| 10 | `MainScreen.kt:587` list header | 11 Bold | overline | 12/16 +0.05 em; the string is long, allow two lines (or use label, D4) |
| 11 | `MainScreen.kt:626` "!" in the circle | 12 Black | caption, non-scaling | Per D3 (20 dp circle with non-scaling glyph, or 24 dp circle) |
| 12 | `MainScreen.kt:642` interval time | 15 Bold Mono | body (Mono) | 16/24 |
| 13 | `MainScreen.kt:656` duration pill | 11 Bold Mono | caption (Mono) | 13/18 |
| 14 | `MainScreen.kt:703-708` last and next updated | 11 | caption | 13/18 |
| 15 | `MainScreen.kt:781,850` link title | 12 Bold | label | 14/20 |
| 16 | `MainScreen.kt:787,856` URL caption | 10 Mono | caption (Mono) | 13/18; wrap to two lines or tap-to-copy |
| 17 | `MainScreen.kt:907-955` overlay CTA, subtitle, language | 24 / 12 / 12 | title / label / label | 24/30; 14/20; 14/20 with `maxLines = 1` and `fillMaxWidth(0.9f)` |
| 18 | `TimelineBar.kt:139` "Графіки не діють" | 12 ExtraBold in 32 dp | label | 14/20; `maxLines = 1`; box grows |
| 19 | `TimelineBar.kt:221` tick labels | 10 Mono Bold | overline (Mono) | 12/16; every 4 h above 1.3x |
| 20 | `SettingsScreen.kt:205,211` card title, description | 12 Bold, 11 | subhead / caption | 16/22; 13/18 |
| 21 | `SettingsScreen.kt:292,375,435` uppercase titles | 11 Bold | overline | 12/16 +0.05 em; `weight(1f)` |
| 22 | `SettingsScreen.kt:312` site badge pill | 11 Bold | label | 14/20; `weight(1f)`, wrap allowed |
| 23 | `SettingsScreen.kt:348` duplicate error text | 10 | caption or removal | 13/18, or remove (duplicates the badge) |
| 24 | `SettingsScreen.kt:514,547,586,640` toggle labels | 12 Bold, 12 | body | 16/24; `weight(1f)` |
| 25 | `SettingsScreen.kt:683,711` language title, segments | 12, 11 | label / label | 14/20; min height 48 dp |
| 26 | `SettingsScreen.kt:755,777,797` action buttons | 12 Bold / SemiBold | label | 14/20; stack at large scale |
| 27 | `SettingsScreen.kt:1040` modal uppercase headings | 14 ExtraBold, tracking 0.8 sp | label with +0.05 em tracking | 14/20 (see D4) |
| 28 | `SettingsScreen.kt:1057-1250` modal field labels | 12 Bold | label | 14/20 |
| 29 | `SettingsScreen.kt:1421` emergency detail | 12 Mono | label (Mono) | 14/20, two rows |
| 30 | `SettingsScreen.kt:1548,1566` step text | 14 lh20 | body | 16/24 |
| 31 | `BlackoutAppNavigation.kt:1043` app banner | 12 Bold | label | 14/20 |
| 32 | `AboutScreen.kt:139,186,254-255` about texts | 10 to 12 | caption or label | 13/18 or 14/20, decided per line at implementation |
| 33 | Settings title | 22 Bold | heading | 20/26 ExtraBold (D1) |
| 34 | Queue title | 24 Bold | title | 24/30 |
| 35 | Modal title | 20 ExtraBold | heading | 20/26 |

## 6. Ukrainian-text specifics

**Strings that drive the layout** (calculated by the UI pass at 360 dp):

| String | Where | Constraint |
| --- | --- | --- |
| "ЗАРАЗ НЕМАЄ СВІТЛА" | Hero status line | About 294 dp at 1.3x against 292 dp available beside the clock |
| "Орієнтовне відновлення:" plus value | Emergency banner | Splits the timestamp from 1.5x |
| "ПОПЕРЕДЖАТИ ЗАЗДАЛЕГІДЬ" | Settings title row | Collides with "1–240 хв" from 1.3x |
| "На сайті не знайдено черг" | Settings badge pill | About 166 dp beside the title |
| "Тест сповіщення" | Settings action button | Half-width box about 142 dp |
| "Українська" | Language segments and overlay switch | About 76 dp text slot in Settings (wraps from 1.4x); about 64 dp in the overlay switch (clips from 1.15x) |
| "Початок: … · Відновлення: …" | Modal emergency detail | About 228 dp inner width |
| "Графіки не діють" | Drum placeholder | Fixed 32 dp box |

Long Cyrillic words and uppercase Cyrillic labels are the widest strings in the app; the fixes above (weights, wrap, growth) matter more for uk than for en.

**Rules specific to the language.**

- **Quotation marks.** Ukrainian copy uses « » (the planned exact-alarm text is "Дозвольте «Будильники й нагадування», щоб попередження приходили вчасно"); straight quotes stay in code only.
- **Dashes and ranges.** Ranges use the en dash, spaced in time spans ("23:00 – 24:00"), unspaced in value ranges ("1–240 хв"); never a hyphen.
- **Units.** A non-breaking space between a number and its unit ("2 год", "15 хв"). The widget countdown format `HHг. MMхв.` and the labels "СВІТЛО Є" and "СВІТЛА НЕМАЄ" are `CLAUDE.md` invariants and must not be altered (never "ЗНЕСТРУМЛЕНО").
- **Uppercase.** Uppercase labels at 14 sp or smaller take +0.05 em tracking. The invariant widget labels are fixed text; any other label should be stored in natural case where the code allows.
- **Apostrophes in street names.** The sites mix U+0027, U+2019, U+02BC, U+2018 and U+00B4 in the same name (for example `В'ячеслава` and `В’ячеслава`). Matching folds all of them (`StreetKey`); the display name is the first one seen, not a normalised variant (data report). Search must not require the user to type a particular apostrophe.
- **Initials and abbreviations.** `С.П. Корольова` and `С.П.Корольова` are the same street; the key removes the space after dots. Street-type prefixes (`вул.`, `пров.`, `просп.`, `пл.`, `м.`, `с.`) are optional in search. As an extension of the plan, a non-breaking space after an abbreviation avoids a line break between "вул." and the name; this is not in the plan.
- **Dates and time.** `dd.MM.yyyy` and `dd.MM` for dates, 24-hour clock, "24:00" as end of day in rows.
- **Mono and Cyrillic.** Several Cyrillic labels are set in `FontFamily.Monospace` ("N год" in the duration pill, the emergency detail, the period chip). Whether Cyrillic glyphs in the device's monospace font fall back to another face and look inconsistent is **Not verified** (check on the emulator and on a second device).
- **Decimals.** The duration chip prints "N год" or "%.1f год". Whether `%.1f` uses the device locale (decimal comma in Ukrainian) or a fixed locale is **Not verified**.
- **Language mix.** The app switches between SYSTEM, uk and en; the English strings come from `AppStrings.kt` and a Ukrainian-only `res/values/strings.xml`; the English strings were not audited for width.

## 7. Font-scale test matrix (1.0 / 1.3 / 2.0)

Procedure (to run on the emulator in plan phase 6): set the system font scale to 1.0, 1.3 and 2.0, open each screen and state below, and record the observed result. "Expected" values come from the UI pass's calculation at 360 dp; derived values (marked "derived") are arithmetic from those numbers. **Observed is Not verified for every cell** until the emulator run.

**Pass criteria.** No clipped or overlapping glyphs; no mid-token wrap in numerics and timestamps; no horizontal scroll; every touch target at least 48 dp; wrap-capable text at line height of at least 1.4; every truncation has a way back to the full text; text never smaller than 12 sp.

| Screen / state | Element | Location | Expected at 1.0 | Expected at 1.3 | Expected at 2.0 | Observed |
| --- | --- | --- | --- | --- | --- | --- |
| Main, hero | Countdown "01:35:12", 44 sp | `MainScreen.kt:443,366` | Fits (about 211 of 292 dp) | Fits (derived: about 274 dp) | Char-wraps from 1.4x unless capped | Not verified |
| Main, hero | "ЗАРАЗ НЕМАЄ СВІТЛА" with clock | `:401,419` | Fits | Wraps (about 294 versus 292 dp) | Wraps | Not verified |
| Main, hero | Period label and chip | `:465,476` | Fits | Fits | Chip wraps from 1.4x | Not verified |
| Main, hero | No-queue variant "--:--:--" | `:356-369` | Fits | Check | Check | Not verified |
| Main, emergency banner | Label and value rows | `:273-304` | Fits | Fits | Timestamp splits from 1.5x | Not verified |
| Main, banners | ZTOE status bar, new site banner | `:312-342` | Fits | Check | Check | Not verified |
| Main, day selector | Tabs (target 48 dp) | `:489-555` | About 36 dp tall today | Check | Check | Not verified |
| Main, schedule | List header, interval rows, duration pill | `:587-664` | Fits | Check | Check | Not verified |
| Main, schedule | "!" in 20 dp circle | `:626` | Fits | Check | Clips | Not verified |
| Main, drum | "Графіки не діють" in 32 dp | `TimelineBar.kt:139` | Fits | Check | Clips if it wraps | Not verified |
| Main, drum | Tick labels (every 2 h) | `TimelineBar.kt:221` | 156 dp | Derived: about 203 dp, fits 288 dp | 312 dp, overlaps; thinning to every 4 h required | Not verified |
| Main, "Last updated" | Text, refresh button, new chips | `:688-731` | Fits | Check | Chips must wrap (`FlowRow`) | Not verified |
| Main, links | Titles, URL captions | `:781-856` | Fits | Check | Captions wrap or copy | Not verified |
| Main, overlay | CTA and language switch | `:907-955` | "Українська" borderline | Clips from 1.15x | Clips | Not verified |
| Settings | Uppercase titles with "1–240 хв" | `SettingsScreen.kt:292,375,435` | Fits | Collides | Collides | Not verified |
| Settings | Site badge pill | `:312` | Fits | Wraps | Wraps | Not verified |
| Settings | Toggle rows | `:514-640` | Fits | Check | Check | Not verified |
| Settings | Language segments | `:683,711` | Fits | Check (wraps from 1.4x) | Wraps | Not verified |
| Settings | Test, Refresh, Reset buttons | `:755-797` | Fits | "Тест сповіщення" wraps | Wraps; stack | Not verified |
| Settings | Reset dialog (M3 defaults) | `:1600-1621` | Fits | Check | Check | Not verified |
| Modal | Field labels, picker field and rows (new, rows 52 dp, search 56 dp) | `:1057-1311` | Fits | Check | Rows must grow, not clip | Not verified |
| Modal | Emergency detail | `:1421` | Wraps mid-timestamp (about 228 dp) | Wraps | Wraps | Not verified |
| Modal | Step text, "Зрозуміло" | `:1548-1593` | Fits | Check | Check | Not verified |
| About | Texts, README URL row, donations | `AboutScreen.kt:139,186,254-294` | Icon already displaced by the long URL | Same | Same | Not verified |
| Chrome | Dock and in-app banner | `BlackoutAppNavigation.kt:1043,1050-1131` | Fits | Check | Banner wraps | Not verified |
| Widgets | Small and big widget text | `BlackoutGlanceWidget.kt` | Not audited | Check | Check | Not verified |

Also test at 320 dp width, in uk and en, and with TalkBack (focus order follows reading order).

## 8. Open decisions and inconsistencies

| # | Decision or inconsistency | Options |
| --- | --- | --- |
| D1 | The UI pass lists "Settings title 22 Bold" and "modal title 20 ExtraBold" as fonts to preserve, but the plan maps screen and modal titles (20 to 22) to `heading` 20/26 ExtraBold | Keep the Settings title at 22 Bold as an exception, or accept 20/26 ExtraBold (changes size and weight) |
| D2 | The plan requires line height of at least 1.4 for wrap-capable text, but its own `subhead` 16/22 (1.375) and `caption` 13/18 (1.38) are below it | Use 16/23 (1.44) and 13/19 (1.46) for texts that can reach three lines, or cap those texts with `maxLines` |
| D3 | The plan keeps the 20 dp "!" circle; the typography audit says the circle clips the scaling "!" at 2x and suggests 24 dp or a non-scaling glyph | Keep 20 dp with a non-scaling glyph (look preserved) or enlarge to 24 dp |
| D4 | The `overline` role is 12 sp, while the modal uppercase headings are 14 sp ExtraBold with 0.8 sp tracking, and the list header is a long string | Map them to `label` with +0.05 em tracking (as in section 5.2), or to `overline` and shrink to 12 sp |
| D5 | The audit's "suggested" sizes differ from the role sizes (for example URL caption 12 versus caption 13, ticks 11 versus overline 12, address 14/20 versus caption 13/18) | The role scale wins; the audit values were pre-scale suggestions |
| D6 | The audit labels `SettingsScreen.kt:1040` as the modal title at 14 sp, while the preserve list names a 20 sp ExtraBold modal title; the 20 sp line is not recorded | Locate both literals at implementation |
| D7 | The plan's histogram (section 3.4) omits the single 15 sp literal and sums to 77 | The audit histogram (78) is used here |

## 9. Verification

No command was run. Static checks only.

| Check | Method | Result |
| --- | --- | --- |
| Histogram arithmetic | 6+14+30+6+11+1+3+2+1+2+2 = 78; 6+14+30 = 50 at or below 12 sp (64.1 %) | Passed |
| Role scale ratios | Computed: display 1.09, title 1.25, heading 1.30, subhead 1.375, body 1.50, label 1.43, caption 1.38, overline 1.33 | Passed as arithmetic; two roles are below 1.4 (D2) |
| Declared size, weight and line height per audited style | Reading the audit | Passed (31 audited styles, section 3) |
| Truncation rules against realistic strings | Calculated widths (UI pass) | Calculated, **Not verified** |
| Font families | Reading | Passed (system plus mono, no custom font) |

**Not verified:** every rendered wrap, clip and overlap (section 7); the Cyrillic fallback in the monospace font; the decimal separator of "%.1f год"; which non-mono figures change and need `tnum`; the plain or non-breaking space in unit strings; English string widths; the Glance widget text; behaviour at 320 dp width and with TalkBack; whether `LineBreak.Heading` and `LineBreak.Paragraph` render as intended with the current BOM (2024.12.01).

## 10. Verdict

**Block.** HIGH findings are open: the missing type scale, the size floor and inverted hierarchy, and clipping at large font scale. Not reviewed: the roulette screen, the Glance widget text and the React simulator type; rendered behaviour is Not verified for every row.
