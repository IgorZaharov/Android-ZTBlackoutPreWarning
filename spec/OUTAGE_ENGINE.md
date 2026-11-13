# OUTAGE_ENGINE

The single definition of "what is off when". Reference implementation: `android/app/src/main/java/ua/blackout/prewarning/core/OutageModels.kt` and `OutageEngine.kt`. Everything here is a pure function of its arguments (no clock, no I/O, no platform types), so a TypeScript or Swift port can be verified byte-for-byte against `spec/vectors/outage_engine.json`.

Constants: see `spec/config.json` (`grid`, `outage`).

## 1. Conventions

| Topic | Rule |
|---|---|
| Instant | A `LocalDateTime`: Kyiv wall-clock date and time with no zone attached. All inputs and outputs are such values. |
| Text form | ISO local date-time. Seconds are printed only when non-zero, so every outage instant (minute precision) prints as `yyyy-MM-ddTHH:mm`, for example `2026-11-13T23:00`. Keys and vector comparisons use this form. |
| Interval | Half-open: `[start, end)`. Two outages that only touch (`a.end == b.start`) are adjacent and merge into one span. |
| Cell | One of 48 half-hour cells of a day: cell `i` covers `[i*30 min, i*30 min + 30 min)` of the wall clock. The grid is by wall-clock label, also on DST days. |
| Wall-clock arithmetic | `plusMinutes`, `plusDays`, comparisons, `start of day` are plain calendar arithmetic on the wall clock. |
| Elapsed time | Durations and countdowns map both ends to real instants in `Europe/Kyiv` (legacy id `Europe/Kiev` on old devices) and subtract. Result is truncated toward zero to whole minutes (durations) or whole seconds (countdowns). See section 7. |
| `now` | A `LocalDateTime` that may carry seconds. `today` is the calendar date of `now` in Kyiv. |
| Kinds | `PLANNED` (ztoe hourly schedule), `REPAIR` (PowerOn planned works), `EMERGENCY` (PowerOn). `PLANNED` and `REPAIR` are "planned-like". Kind order for sorting: `PLANNED` < `REPAIR` < `EMERGENCY`. |

## 2. Model

| Type | Fields | Notes |
|---|---|---|
| `Outage` | `id: string`, `kind`, `start`, `end`, `mayContinue = false`, `endIsEstimate = false`, `overdue = false`, `stale = false`, `label?: string` | `end` is the effective end. Ids: `planned_<start>`, `repair_<start>`, `pw_<start>` (text form of start). |
| `IntervalStatus` | `FINISHED`, `ACTIVE`, `UPCOMING`, `OVERDUE` | Derived by `statusAt(now)`, see below. |
| `EmergencyRecord` | `id`, `start`, `estimatedEnd?`, `closedAt?`, `label?` | One emergency as seen on PowerOn or restored from the ledger. `closedAt` is set only by the ledger. |
| `Span` | `start`, `end`, `mayContinue`, `kinds: set<kind>` | Maximal union of touching or overlapping outages. |
| `SlotState` | `planned`, `emergency`; derived `off = planned or emergency` | One drum cell. `planned` is true for `PLANNED` and `REPAIR` outages. |
| `DayRow` | `outage`, `from`, `to`, `status`, `continuesFromPrevDay`, `continuesToNextDay`, `durationMinutes`, `inDayMinutes` | One outage clipped to one day. |
| `DayView` | `date`, `slots: SlotState[48]`, `rows: DayRow[]`, `totalOffMinutes` | |
| `StatusInfo` | `isOffNow`, `countdownSeconds?`, `countdownText`, `nextSlotTime`, `currentSpan?`, `nextSpan?` | |
| `AlertSpec` | `key`, `fireAt`, `spanStart`, `spanEnd`, `mayContinue`, `durationMinutes` | One pre-warning. |
| `Transition` | `at`, `isOff` | An instant where the power state flips. |

`Outage.statusAt(now)`, first match wins:

1. `stale` -> `FINISHED`
2. `now < start` -> `UPCOMING`
3. `overdue` -> `OVERDUE`
4. `now < end` -> `ACTIVE`
5. otherwise -> `FINISHED`

## 3. Building outages

### 3.1 `normalizeSlots(raw)`

`raw` is a list of booleans, `true` = power off. 48 entries: used as is. 24 hourly entries: each entry is repeated twice. `null` or any other length: `null` (the day is unknown).

### 3.2 `buildPlanned(today, todayOff, tomorrowOff, yesterdayOff = null) -> Outage[]`

Turns the ztoe day tables of one queue into `PLANNED` outages.

1. Normalise the three inputs. Build the list of known days in chronological order: yesterday, today, tomorrow, keeping only days whose normalised slots are not `null`. If none is known, return `[]`.
2. `knownDates` = the dates in that list. Keep one `runStart` (initially none).
3. For each known day in order, for each cell `i = 0..47` with `slotStart = dayStart + i*30 min`:
   - cell off and no run open: `runStart = slotStart`;
   - cell on: close the open run (if any) at `slotStart` with `mayContinue = false`.
4. After the 48 cells of a day: if a run is still open and `day + 1` is **not** in `knownDates`, close it at `(day + 1) 00:00` with `mayContinue = true`. If `day + 1` is known the run stays open and continues into that day's cell 0 (this is how a block crosses midnight).
5. Closing creates `Outage(id = "planned_" + runStart, kind = PLANNED, start = runStart, end = <close instant>, mayContinue)`.

Consequences:

- A block that ends exactly at the end of the last known day is `mayContinue = true`. Because the day after tomorrow is never known, a block that reaches `24:00` of tomorrow is always `mayContinue = true`; a block that reaches `24:00` of today is `mayContinue = true` only while tomorrow's table is missing, and becomes a normal block that merges across midnight once tomorrow is known.
- Days that are not adjacent never merge (a known yesterday and a known tomorrow with an unknown today are two separate days).
- With yesterday's table kept, a block that started yesterday at 23:00 keeps its real start (`planned_<yesterday>T23:00`). Without it, an after-midnight view starts the block at `00:00` (documented limitation, pinned by a vector).

### 3.3 `resolveEmergency(rec, now, graceMinutes = 60) -> Outage`

Produces one `EMERGENCY` outage (`id = rec.id`, `label = rec.label`). `overdueMinutes` is the elapsed whole minutes from `estimatedEnd` to `now`, truncated.

| # | Condition (first match wins) | `end` | `endIsEstimate` | `overdue` | `stale` |
|---|---|---|---|---|---|
| 1 | `closedAt` present | `closedAt` if `closedAt > start`, else `start` | false | false | false |
| 2 | no `estimatedEnd` | `now` if `now > start`, else `start` | true | `now >= start` | false |
| 3 | `now < estimatedEnd` | `estimatedEnd` | true | false | false |
| 4 | `now >= estimatedEnd` and `overdueMinutes <= grace` | `now` | true | true | false |
| 5 | `now >= estimatedEnd` and `overdueMinutes > grace` | `estimatedEnd` | true | false | true |

Finally, if `end < start`, `end = start`. `mayContinue` is always false for emergencies.

Meaning: a closed emergency ends where the ledger saw it disappear. A listed emergency without an estimate that has started is "open" (overdue). A listed emergency within 60 whole minutes after its estimate is still active but its end is unknown (overdue). Beyond that it is stale: shown as finished, never off, never alerts. Boundary: exactly 60 minutes after the estimate is still overdue, 61 is stale. An emergency without an estimate that starts in the future gets `end == start` (zero length); `spans` and `dayView` ignore zero-length outages, so it is invisible in them (the ledger still announces it, see `NOTIFICATIONS.md`).

### 3.4 `inWindow(outages, today)`

Keep an outage when `start < (today + 2 days) 00:00` and `end > (today - 1 day) 00:00`. This is the window yesterday, today, tomorrow. Rows dated further ahead (PowerOn lists some days in advance) are ignored.

All other functions receive the already-windowed list.

## 4. Spans

### 4.1 `spans(outages, kinds = all) -> Span[]`

1. Keep outages whose kind is in `kinds` (all kinds when `kinds` is null) and with `end > start`.
2. Sort by `start` (stable).
3. Sweep, keeping a current span `(curStart, curEnd, curMay, curKinds)`:
   - first outage: start a span from it;
   - next outage `o` with `o.start <= curEnd` (touches or overlaps):
     - if `o.end > curEnd`: `curEnd = o.end` and `curMay = o.mayContinue`;
     - else if `o.end == curEnd`: `curMay = curMay or o.mayContinue`;
     - else (`o.end < curEnd`): `curMay` unchanged;
     - add `o.kind` to `curKinds`;
   - otherwise emit the current span and start a new one from `o`.
4. Emit the last span.

Union rule for `mayContinue`: the span's flag comes from the outage that determines its end; on a tie the flags are OR-ed. Example: a planned block `22:00-00:00 mayContinue` merged with an emergency `22:04-00:04` yields the span `22:00-00:04` with `mayContinue = false`, because the emergency's end is known.

`kinds` of a span is the set of kinds of its members.

### 4.2 Formatting helpers

| Helper | Rule |
|---|---|
| `formatSpanTime(t)` | `"24:00"` when `t` is exactly 00:00, otherwise `HH:mm` with ASCII digits. Only ever applied to an **end**. |
| `formatSpan(span)` | `HH:mm – <formatSpanTime(end)>` where the dash is the en dash U+2013 with a space on each side. The start is always plain `HH:mm`. |
| `formatCountdown(s)` | `s` clamped to `>= 0`; `HH:MM:SS` with each field zero-padded to at least two digits (hours are not wrapped at 24). |

## 5. Day view

### 5.1 `dayView(outages, date, now) -> DayView`

`dayStart = date 00:00`, `dayEnd = (date + 1) 00:00`.

1. `relevant` = outages with `end > start` and `start < dayEnd` and `end > dayStart`. **Stale outages are kept**: finished history stays visible; they only never alert and never count as "off now".
2. `slots[i]` for `i = 0..47` with `[s, e) = [dayStart + 30i min, s + 30 min)`:
   - `planned` = some relevant planned-like outage with `start < e and end > s`;
   - `emergency` = some relevant `EMERGENCY` outage with `start < e and end > s`.
3. One `DayRow` per relevant outage:
   - `from = max(start, dayStart)`, `to = min(end, dayEnd)`;
   - `status = outage.statusAt(now)`;
   - `continuesFromPrevDay = start < dayStart`; `continuesToNextDay = end > dayEnd` (strict: an outage ending exactly at `24:00` does not continue);
   - `durationMinutes` = elapsed minutes from `start` to `end` (the full outage, not clipped); `inDayMinutes` = elapsed minutes from `from` to `to`.
4. Sort rows by `from`, then by kind order (stable for further ties).
5. `totalOffMinutes` = clip every relevant outage to `[dayStart, dayEnd]`, take `spans` of all kinds, sum the elapsed minutes of the spans. It is a union, so overlapping kinds are not counted twice, and the totals of two consecutive days add up to the real elapsed time.

An overdue emergency has `end = now` (set by `resolveEmergency`), so its cells and row stop at the cell/minute containing `now`.

### 5.2 Cell ranges used by the vectors

The vectors write cells as `HH:MM-HH:MM` ranges (maximal runs of true cells; the end of the last cell of the day is written `24:00`). Cell `k` covers `k*30` to `k*30+30` minutes.

## 6. Status, alerts, transitions

### 6.1 `status(outages, now) -> StatusInfo`

1. `effective` = outages that are not `stale`; an `overdue` outage is replaced by a copy with `end = now + 1 second` ("open end").
2. `all = spans(effective)` (all kinds). `current` = the span with `start <= now < end`.
3. If `current` exists:
   - **Restore unknown**: if `current.end == now + 1 second` and some effective outage is overdue, return `isOffNow = true`, `countdownSeconds = null`, `countdownText = "--:--:--"`, `nextSlotTime = "<HH:mm of current.start> – --:--"`, `currentSpan = current with end = now`, `nextSpan = null`. (If a planned block extends beyond the overdue emergency, the span end is the planned end and the normal branch applies.)
   - Otherwise: `secs = elapsed seconds now -> current.end`; `isOffNow = true`; `countdownText = formatCountdown(secs)`; `nextSlotTime = formatSpan(current)`; `currentSpan = current`; `nextSpan = null`.
4. Else `next` = the first span with `start > now`. If present: `isOffNow = false`; `secs = elapsed seconds now -> next.start`; `countdownText = formatCountdown(secs)`; `nextSlotTime = formatSpan(next)`; `nextSpan = next`.
5. Else: `isOffNow = false`, `countdownSeconds = null`, `countdownText = "--:--:--"`, `nextSlotTime = "Відключень немає"` (the exact Ukrainian string; the UI maps it to the localised "no outages" text but compares against this value), no spans.

Stale emergencies never count. Repair works and emergencies count as off like planned outages.

### 6.2 `planAlerts(outages, now, advanceMinutes) -> AlertSpec[]`

1. `planned = spans(outages that are not stale, kinds = {PLANNED, REPAIR})`. Emergencies take no part: a planned block directly followed by an emergency keeps its own end in the alert.
2. For each span in order: skip it if `start <= now`. `fireAt = start - advanceMinutes` (wall-clock minutes); skip it if `fireAt <= now` (no retroactive alerts; `fireAt == now` is also skipped).
3. Emit `AlertSpec(key = "planned_" + start, fireAt, spanStart = start, spanEnd = end, mayContinue, durationMinutes = elapsed minutes start -> end)`.

One alert per merged span, keyed by the span's absolute start. A `00:00` continuation is part of the earlier span and never gets its own alert. A span that spans midnight is one alert with the full duration. Alerts exist for any span in the window, so blocks of tomorrow are planned today.

### 6.3 `transitions(outages, from, to) -> Transition[]`

`spans` of all kinds over outages that are neither `stale` nor `overdue`; each span gives `(start, isOff = true)` and `(end, isOff = false)`; keep those with `from <= at <= to`; sort by `at`. Widget timelines (Android widget alarms, iOS WidgetKit entries) are generated from this list. An overdue emergency has no known end and is excluded. A `mayContinue` end at `24:00` is a possibly wrong "power on" transition until the next table arrives.

## 7. Time zone and DST

- Durations and countdowns are elapsed real time, so the result differs from the wall-clock difference on the two DST nights.
- `2026-10-25` (clocks go back at 04:00 to 03:00): a block `02:00-05:00` is 4 elapsed hours (240 min).
- `2027-03-28` (clocks go forward at 03:00 to 04:00): a block `02:00-05:00` is 2 elapsed hours (120 min).
- Mapping a wall-clock value to an instant uses `java.time` rules: a repeated wall time maps to the earlier instant; a skipped wall time is shifted forward by the length of the gap.
- The 48-cell grid and all comparisons stay on wall-clock labels; only elapsed-time results are zone aware. Kotlin: `ChronoUnit.between` on `ZonedDateTime`. TypeScript: `src/core/localTime.ts` (own mapping through `Intl.DateTimeFormat`). Swift: use a `Calendar` with `TimeZone(identifier: "Europe/Kyiv")` and apply the two gap/overlap rules above, then take `timeIntervalSince`.
- The wall-clock text of an instant never changes with DST, so keys such as `planned_2026-11-13T23:00` are stable.

## 8. Worked examples (all taken from `outage_engine.json`)

**A. Planned 23:00-01:00 across midnight.** `today = 2026-11-13`, today off `23:00-24:00`, tomorrow off `00:00-01:00`, `advance = 15`.

- `buildPlanned`: the run opens at `13T23:00`, the day ends with a run open and `14` is known, so it continues; tomorrow's cell 2 is on, so it closes at `14T01:00`, `mayContinue = false`. One outage `planned_2026-11-13T23:00`.
- At `now = 22:00`: `status` -> not off, `countdownText = 01:00:00`, `nextSlotTime = 23:00 – 01:00`. `planAlerts` -> one alert, `key = planned_2026-11-13T23:00`, `fireAt = 2026-11-13T22:45`, `spanEnd = 2026-11-14T01:00`, `durationMinutes = 120`.
- `dayView(13th)`: row `from 23:00`, `to 14T00:00`, `UPCOMING`, `continuesToNextDay = true`, `durationMinutes = 120`, `inDayMinutes = 60`, `totalOffMinutes = 60`. `dayView(14th)`: row `from 14T00:00`, `to 01:00`, `continuesFromPrevDay = true`, `durationMinutes = 120`, `inDayMinutes = 60`, `totalOffMinutes = 60`.
- At `now = 23:30`: off, countdown `01:30:00`, no alert (the span already started).
- At `now = 2026-11-14T00:30` with yesterday's tail kept (`yesterday 23:00-24:00`, `today 00:00-01:00`): the row still shows `durationMinutes = 120`, countdown `00:30:00`, `nextSlotTime = 23:00 – 01:00`.

**B. Emergency 22:04-00:04 over a planned 22:00-24:00.** `today = 2026-11-12`, tomorrow's table missing, emergency `pw_2026-11-12T22:04`, estimate `2026-11-13T00:04`, `now = 23:57`.

- Planned outage `22:00 -> 13T00:00`, `mayContinue = true`; emergency `22:04 -> 13T00:04`. `spans` merges them: end from the emergency, so `mayContinue = false`; one span `22:00 -> 00:04`.
- `status`: off, countdown `00:07:00`, `nextSlotTime = 22:00 – 00:04`.
- `dayView(12th)`: planned cells and emergency cells both `22:00-24:00`; rows: `PLANNED 22:00->00:00` (`durationMinutes 120`, `inDayMinutes 120`, no continuation) then `EMERGENCY 22:04->00:00` (`continuesToNextDay`, `durationMinutes 120`, `inDayMinutes 116`); `totalOffMinutes = 120`.
- `dayView(13th)`: planned cells none, emergency cells `00:00-00:30`; one row `EMERGENCY 00:00->00:04` (`continuesFromPrevDay`, `durationMinutes 120`, `inDayMinutes 4`); `totalOffMinutes = 4`.

**C. Overdue and stale.** Emergency `17:30`, estimate `19:00`. At `19:20`: row `OVERDUE`, `to = 19:20`, `durationMinutes = 110`, emergency cells `17:30-19:30`, `status` -> off, `--:--:--`, `17:30 – --:--`. At `20:00` (60 min past): still `OVERDUE`. At `20:01` (61 min past): `FINISHED`, row `to = 19:00`, not off, `Відключень немає`. Closed by the ledger at `18:10` (now `18:30`): row `17:30->18:10` `FINISHED`, `totalOffMinutes = 40`.

**D. Repair works.** `repair_2026-11-14T08:00` `08:00-17:00` tomorrow, now `2026-11-13T18:00`: countdown `14:00:00`, `nextSlotTime = 08:00 – 17:00`, one alert `planned_2026-11-14T08:00` at `07:45` with `durationMinutes = 540`; tomorrow's `plannedCells = 08:00-17:00`, row kind `REPAIR`.

## 9. Not pinned by a vector (reference behaviour, change only together with a new vector)

- `totalOffMinutes` includes stale emergencies (they are part of `relevant`).
- `Span.kinds` content and order.
- Equal-start tie ordering of rows beyond kind order.
- Behaviour for countdowns of 100 hours or more (not reachable inside the three-day window).

## Vectors

`spec/vectors/outage_engine.json` (22 cases incl. midnight with and without yesterday's tail, year boundary, both DST nights, overdue grace boundary 60/61, ledger-closed emergency, repair works, far-future emergency, empty input). Runner semantics: `spec/README.md`.
