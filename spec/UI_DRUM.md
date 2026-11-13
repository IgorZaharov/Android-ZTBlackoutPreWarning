# UI_DRUM

The 48-cell "drum" (an analog electricity-meter dial) that shows one day, the list of outages under it, and how both are fed by `DayView`. Reference rendering: `android/app/src/main/java/ua/blackout/prewarning/ui/components/TimelineBar.kt` (Compose) and `widget/BlackoutGlanceWidget.kt` (`renderAnalogCounterBitmap`, same colours). Values flow from `spec/design-tokens.json` (`drum`). Layout is in dp (Android) or pt (iOS); colours are `#RRGGBB` or `#AARRGGBB`.

Status of this document: the planned/on/unclear cells, the needle and the ticks describe the code as it is. The emergency stripes and the new list-row rules come from the approved 1.4.0 design (plan section 3.3); `TimelineBar.kt` does not draw them yet.

## 1. Cell states

Input per cell: `SlotState(planned, emergency)` from `dayView` (`planned` is true for `PLANNED` and `REPAIR`). Mapping:

| `planned` | `emergency` | State | Look |
|---|---|---|---|
| false | false | on | ivory vertical gradient `#D8D6CC` -> `#FCFBF7` -> `#CCC9BE` (top, middle, bottom) |
| true | false | off, planned | crimson vertical gradient `#9E1E18` -> `#D62E26` -> `#8C1914` |
| false | true | emergency | top half: on (or the unclear grey); bottom half: amber vertical gradient `#FFB020` -> `#F28A1B` -> `#C96A0B` with dark stripes |
| true | true | both | top half: the planned crimson; bottom half: amber with dark stripes, as above |

An emergency takes only the **bottom half** of its cells, so the planned state behind it (a scheduled outage or power on) stays readable in the top half (owner request after 1.4.0; before, the emergency filled the whole cell and hid the schedule).
| (day has no valid planned data) | | unclear | grey vertical gradient `#7E8287` -> `#94989E` -> `#6E7277` |

**Emergency stripes** (second cue so the state is not carried by colour alone):

| Property | Value |
|---|---|
| Direction | 45 degrees |
| Stripe / gap | 3 dp / 3 dp |
| Stripes | `#1A1208` at 55 % alpha over the amber half, with or without a planned outage behind it |
| Hue separation | amber (hue about 40 degrees) is more than 15 degrees away from crimson (about 3) and from the accent (about 11) |
| Widget | the big widget bitmap uses the same recipe |

Implementation note (not in the plan): anchor the stripe phase to the drum, not to each cell, so adjacent emergency cells form continuous stripes.

**Unclear day** (Tomorrow before ztoe publishes, or Today with no valid cache): all 48 cells use the grey style; PowerOn outages already known for that day (emergency, repair) are still drawn on top with their normal states (`REPAIR` as planned crimson, emergency as amber stripes). The explanation lives in a glass notice card under the tabs (`SITE_STATE.md` section 7), not inside the bar. Legacy behaviour of `TimelineBar.kt`: when the slot list is empty the whole bar becomes one grey block 32 dp high with the centred label `outagesUnclear` (`Графіки не діють` / `Outages unclear`, 12 sp, ExtraBold, white).

## 2. Geometry and chrome (as in `TimelineBar.kt`)

| Part | Value |
|---|---|
| Faceplate | rounded 16, vertical gradient `#DFDDD0` -> `#D4D1C1` -> `#C6C2B0`, 2 border `#7A7768`, padding 12 left/right/top, 10 bottom |
| Needle wrapper | vertical padding 4 (the needle sticks out 4 above and below the slot) |
| Slot (recessed well) | rounded 8, fill `#4E514E`, 2 border `#6E716B`, padding 6 |
| Cell strip | rounded 2 clip, background `#C8C6BC`; 24 hour boxes with 1.5 spacing, so the background shows as 1.5 hour separators |
| Hour box | two half-hour cells side by side with **no** separator between them (cell `2h` is `hh:00-hh:30`, cell `2h+1` is `hh:30-hh+1:00`) |
| Cell height | 32 |
| Data length | 48 cells (a 24-cell list is read as hourly and each cell used twice) |

48 cells, one per `DayView.slots[i]`; cell `i` starts at `i*30` minutes. The grid is wall-clock; on DST days the drum is still 48 cells.

## 3. Ticks and needle

Ticks: 13 markers for the hours `00, 02, 04, ... 22, 24` laid out with space-between and 2 horizontal padding. Each marker is a 1.5 x 5 bar `#1C1B18` above a label of two digits (`String.format("%02d")`), monospace, bold, `#1C1B18`, 1 top padding. Code size is 10 sp; the 1.4.0 type scale (`design-tokens.json`) raises the floor to 12 sp (role `overline`) and the plan thins the labels to every 4 hours when the font scale is above 1.3.

Needle (**Today only**, never on Tomorrow):

| Property | Value |
|---|---|
| Position | `fraction = (hour*60 + minute) / 1440` (hour clamped 0..23, minute 0..59; seconds ignored); `x = 6 + (width - 12) * fraction` (6 = slot padding on each side) |
| Body | 3 wide, rounded, `#0B0B0A`, full wrapper height (protrudes 4 above and below the slot) |
| Halo | 4.5 wide, rounded, `#D9FFFFFF`, drawn first, behind the body |
| Refresh | when the minute changes |

## 4. From `DayView` to the screen

| Screen | Data |
|---|---|
| Today | `dayView(window, today, now)`; cells from `slots`; needle at `now` |
| Tomorrow | `dayView(window, today + 1, now)`; no needle. The tab is always present. If tomorrow's ztoe table is not published the base is grey (section 1) and only PowerOn outages are drawn. |
| Day total ("без світла за день") | `totalOffMinutes` (union clipped to the day, so two consecutive days add up to the elapsed time) |
| Hero countdown | not the day view: `status(window, now)` (`OUTAGE_ENGINE.md` section 6.1) |

## 5. Row list under the drum

Header text: uk `Години відключень на сьогодні:` / `Години відключень на завтра:`, en `Blackout hours for today:` / `Blackout hours for tomorrow:`. Empty list: uk `Відключень не заплановано`, en `No blackouts scheduled`.

Rows come from `DayView.rows` in the given order (by `from`, then planned, repair, emergency). One row per outage; an outage is never split into two rows on one day. Style (current code): rounded 14, fill `#14FFFFFF`, padding 14 / 10; time text 15 sp monospace bold white; duration chip rounded 8, fill `#26FF5E3A`, text `#FF5E3A` 11 sp monospace bold.

| Rule | Behaviour |
|---|---|
| Time label | `HH:mm – HH:mm` with an en dash. The end is `formatSpanTime`-style: exactly 00:00 prints `24:00`. |
| Duration chip | the **full** outage length `durationMinutes` (not `inDayMinutes`): `2 год` for 120 min; whole hours `N год`, otherwise one decimal (`1.5 год`); en `h`; non-breaking space between number and unit |
| Leaves the day (`continuesToNextDay`) | Today shows the real end and the date of the far side: `23:00 – 01:00 (14.11)`, chip `2 год`. Date format `dd.MM`. |
| Comes from the previous day (`continuesFromPrevDay`) | Tomorrow shows `00:00 – 01:00` plus the tag `з 13.11 23:00` (the real start, uk) / `from 13.11 23:00` (en proposal); chip `2 год` again |
| Day totals | count only the minutes inside the day, so the two days still sum to the real length (60 + 60 for the 23:00-01:00 example) |
| `PLANNED` | 10 dp accent dot (`#FF5E3A`) |
| `REPAIR` | wrench icon and the tag `Планові роботи` (en proposal `Planned works`) |
| `EMERGENCY` | 20 dp accent circle with `!` (white, Black weight) plus the text tag `Аварійне` (en proposal `Emergency`) and an accessibility label |
| `FINISHED` | row at 55 % opacity plus the tag `завершено` (en proposal `finished`); finished rows never alert; a stale emergency is `FINISHED` |
| `ACTIVE` | normal |
| `UPCOMING` | normal |
| `OVERDUE` | an emergency still listed past its estimate: end shown as `--:--` (as the hero's `HH:mm – --:--`), duration chip hidden because the end is unknown (proposal consistent with `status`) |

Leading slot: a fixed 20 x 20 box so the text of all rows starts at the same x.

## 6. Colour usage summary

- Off (planned or repair): crimson. Emergency: amber with stripes. Both: crimson with amber stripes. On: ivory. Unknown: grey.
- The status dot of the hero is separate: on `#34D399`, off `#FF5E3A`, unclear `#9CA3AF`.

## Vectors

The drum itself has no pixel vectors. Its input contract is fully covered by `spec/vectors/outage_engine.json` through `days` (`plannedCells`, `emergencyCells` as cell ranges, `rows` with `from`, `to`, `status`, `continuesFromPrevDay`, `continuesToNextDay`, `durationMinutes`, `inDayMinutes`, `totalOffMinutes`), in particular "planned outage 13.11 23:00 to 14.11 01:00 ...", "emergency 22:04 to 00:04 overlaps ...", "emergency 10:00-12:00 still listed at 18:00 is stale ..." and "repair works tomorrow ...".
