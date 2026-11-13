# NOTIFICATIONS

Two kinds of notifications, both driven by the core and delivered by thin platform adapters:

1. **Planned pre-warnings** ("the power goes off in N minutes"): computed by `OutageEngine.planAlerts`, fully local, scheduled ahead of time.
2. **Emergency events** (`START`, `ETA_CHANGED`, `END`): produced by `EmergencyLedger.reconcile` from polled PowerOn data, delivered when a fetch notices the change.

Reference implementation: `android/app/src/main/java/ua/blackout/prewarning/core/OutageEngine.kt` (planned) and `EmergencyLedger.kt` (emergency). Constants: `spec/config.json` (`outage`, `alerts`, `defaults`).

The adapters in the tree before 1.4.0 (`AlarmScheduler`, `AlarmReceiver`, `NotificationHelper`) still use the old per-day logic; this document is the target they are reworked to. Wording marked "proposal" is not yet in code and carries no vector.

## 1. Planned pre-warnings

### 1.1 Plan

`planAlerts(window, now, advanceMinutes) -> AlertSpec[]` (`OUTAGE_ENGINE.md` section 6.2): one alert per merged planned or repair span of the window yesterday..tomorrow, at `fireAt = span.start - advanceMinutes`, never retroactive, never for a started or finished span, never for a continuation after midnight. The plan is **recomputed from scratch** whenever its inputs change and diffed by key:

- keys no longer in the plan: cancel;
- new keys: schedule;
- same key but different `fireAt` (the advance minutes changed): reschedule;
- same key and same `fireAt`: keep.

Recompute triggers: new schedule data, settings change (advance minutes, notification switch), midnight rollover (Kyiv 00:00 re-sync), device boot, system time or time-zone change, return from an exact-alarm permission change.

Gating: the master switch `alertsMaster` and each address's `plannedAlerts` (`SUBSCRIPTIONS.md` section 8; before multi-address step 3 it was `notificationsEnabled`). With several addresses the plan is computed per address and grouped per queue and span (`SUBSCRIPTIONS.md` 8.1). Sound and vibration switches are global.

`fireAt` is a **Kyiv wall-clock** value. Convert it to an absolute instant with the Kyiv zone, never the device zone, so a traveller still gets the alert at the right moment.

### 1.2 `AlertSpec` to platform trigger

| `AlertSpec` field | Android | iOS |
|---|---|---|
| `key` | `PendingIntent` extra and fired-registry key; request code from a registry that maps key to a unique int (not `String.hashCode()`) | `UNNotificationRequest.identifier` |
| `fireAt` | `fireAt.atZone(Europe/Kyiv).toInstant().toEpochMilli()` for `AlarmManager.setExactAndAllowWhileIdle(RTC_WAKEUP, ...)` | `UNCalendarNotificationTrigger(dateMatching: components, repeats: false)` with `components` = year, month, day, hour, minute of `fireAt` and `components.timeZone = TimeZone(identifier: "Europe/Kyiv")` |
| `spanStart`, `spanEnd`, `mayContinue`, `durationMinutes` | text parameters (section 1.3) | text parameters |
| window | alarms for every alert in the plan (today and tomorrow), re-planned at midnight | **rolling window**: schedule at most **40** pending requests (the earliest `fireAt` first); iOS keeps only 64 pending local notifications per app, the remaining 24 are reserved for emergency and future multi-address use; re-plan on launch, on foreground refresh and in every background refresh |

Android receiver order (review finding C13): re-validate against the engine, **post the notification first**, redraw widgets afterwards, compute any remaining-minutes text at delivery time rather than baking it into the alarm, and record the key as fired.

### 1.3 Text

The strings below are what `AppStrings.kt` and `src/services/i18n.ts` ship in 1.4.0 (normative; iOS copies them).

| | uk | en |
|---|---|---|
| Title | Попередження: відключення світла | Heads-up: power outage |

Body (`plannedAlertBody`): `{start}` = `HH:mm` of the span start (a midnight start reads `00:00`, never `24:00`); `{end}` = `formatSpanTime(spanEnd)`, so a midnight end reads `24:00`; `{left}` = whole minutes until the start, computed at delivery time; `{q}` = `Черга 5.1: ` / `Queue 5.1: ` (empty without a queue); with more than one address it is `{labels} (черга 5.1): ` / `{labels} (queue 5.1): ` with `{labels}` from `alertLabels` (`SUBSCRIPTIONS.md` 8.3), or just `{labels}: ` when `{labels}` is exactly `Черга 5.1` (a queue-only address) or there is no queue, e.g. `Київська 77 · Соборна 3 (черга 5.2): відключення о 23:00 (через 15 хв), орієнтовно до 01:00 (2 год).`

| Case | uk | en |
|---|---|---|
| before the start | `{q}відключення о {start} (через {left} хв), орієнтовно до {end} ({dur}).` | `{q}outage at {start} (in {left} min), expected until {end} ({dur}).` |
| at or after the start | `{q}відключення розпочинається зараз, о {start}, орієнтовно до {end} ({dur}).` | `{q}outage is starting now, at {start}, expected until {end} ({dur}).` |
| `mayContinue` | tail `, орієнтовно до {end} ({dur}), можливе продовження.` | tail `, expected until {end} ({dur}), may continue.` |

`{dur}` = `durationText(durationMinutes)`: `2 год`, `1 год 30 хв`, `45 хв` (en `2 h`, `1 h 30 min`, `45 min`), with a non-breaking space between number and unit. `durationMinutes` is elapsed time, so a DST night is already right. Example for the 23:00-01:00 case: `Черга 5.1: відключення о 23:00 (через 15 хв), орієнтовно до 01:00 (2 год).`

## 2. Emergency events

### 2.1 Model

`EmergencyEvent(kind, entryId, start, eta?, upcoming = false, earlyEnd = false)`.

| `kind` | When | Extra fields |
|---|---|---|
| `START` | An emergency is seen for the first time (or reappears after it was closed) and is not already stale | `upcoming` = `now < start` (it begins in the future); `eta` = its estimated end |
| `ETA_CHANGED` | The estimated end of an announced, still-open emergency moved by at least 10 minutes from the last announced estimate | `eta` = the new estimate |
| `END` | A **confirmed** fetch no longer lists an announced emergency | `eta` = the last known estimate; `earlyEnd` = the estimate existed and `now < estimate` (it vanished before its estimated restore: restored early or cancelled) |

### 2.2 `EmergencyLedger`

State per address: a list of `LedgerEntry(id, start, estimatedEnd?, label?, firstSeen, lastSeen, closedAt?, startEmitted, endEmitted, lastEmittedEta?)`. `reconcile(entries, fetch, now) -> (entries, events)`:

1. **Prune** first: drop entries whose `closedAt` (or `lastSeen` when open) is not later than `now - 48 h`.
2. **`Unavailable` fetch**: return the pruned entries and **no events**. A failed request never ends an outage and never repeats a start.
3. **`Confirmed(records)`**: walk the records in order (a repeated id is ignored after its first occurrence). For each record compute `resolveEmergency(record without closedAt, now)`:
   - **Unknown id**: if the outage is already stale (more than 60 minutes past its estimate), store it as already announced and finished, no event. Otherwise store it and emit `START`.
   - **Known id, closed earlier** (it reappeared): if stale, only refresh `lastSeen`, no event. Otherwise reset it as a new entry (keeping `firstSeen`) and emit `START` again.
   - **Known id, open**: refresh `lastSeen`, `estimatedEnd`, `label`. If the outage is not stale, `startEmitted` and not `endEmitted`: when the new estimate exists and no estimate was announced yet, adopt it silently; when both exist and `|new - lastEmittedEta| >= 10 min`, emit `ETA_CHANGED` and set `lastEmittedEta = new`. The comparison is against the last **announced** estimate, so small drifts accumulate (a move of 5 minutes, then 5 more, announces at the second).
4. **Records that disappeared** (open entries not in this fetch), in stored order: set `closedAt = now` and `endEmitted = true`. Emit `END` unless **silent**: silent when `endEmitted` was already true, or the entry was already stale (its estimate is more than 60 minutes in the past), or `startEmitted` was false. An entry with no estimate is never stale, so its disappearance is announced (`earlyEnd = false`).
5. Entries already closed stay as they are until pruned.

Event order inside one call: `START` and `ETA_CHANGED` in record order, then `END` events.

`EmergencyLedger.outages(entries, now)` turns all entries (open, overdue, stale, closed) into engine outages, so finished emergencies of today stay listable although PowerOn keeps no history.

Silent cases, summarised: failed fetch; an outage already over when first seen (also when it later disappears); a reappearing outage that is already stale; estimate moves under 10 minutes; first estimate adopted after none; disappearance more than 60 minutes after the estimate; estimate removed.

Before calling `reconcile` the adapter drops records dated beyond tomorrow (`POWERON_API.md` section 5.3).

### 2.3 Dedupe keys

`EmergencyEvent.key(addressKey)`, with `start` and `eta` in the engine text form (`yyyy-MM-ddTHH:mm`):

| Kind | Key |
|---|---|
| `START` | `emerg_start_<addressKey>_<startISO>` |
| `ETA_CHANGED` | `emerg_change_<addressKey>_<startISO>_<etaISO>` |
| `END` | `emerg_end_<addressKey>_<startISO>` |

Example (`emergency_ledger.json`): `emerg_change_addr_2026-11-13T17:30_2026-11-13T19:30`.

`addressKey` is an opaque, stable, whitespace-free identifier of the address, supplied by the adapter; the core never interprets it (the vectors use `addr`). Recommended (not enforced): `<remSlug>|<settlementId>|<StreetKey>|<HouseKey>`. The ledger emits each transition once; the key is the adapter's second line of defence: **post only if the key is not in the fired registry, and mark it fired when posting** (Android `AlertRegistry`: entries older than 7 days and beyond 300 are pruned; 100 before multi-address step 3). The planned key from the core, `planned_<spanStartISO>`, is address independent; since multi-address step 3 the registry records `planned_<itemId>_<spanStartISO>` per address and still honours the old key (`SUBSCRIPTIONS.md` 8.2).

### 2.4 Gating

Emergency events are gated by the master switch `alertsMaster` **and** the address's `emergencyAlerts` (owner decision 1, `SUBSCRIPTIONS.md` 8.4; in 1.4.0 they were gated by `emergencyNotificationsEnabled` only). The ledger runs whether or not the switch is on (the UI needs its history); the adapter drops the event when the switch is off. A dropped event is not replayed later when the switch is turned on.

### 2.5 Text

Normative strings as shipped in 1.4.0 (`AppStrings.kt` / `i18n.ts`). `{start}`, `{eta}` are `HH:mm`, with ` (dd.MM)` appended when the date is not today (`formatWhen`).

| Event | Title uk | Title en |
|---|---|---|
| `START`, already started | Аварійне відключення | Emergency outage |
| `START`, `upcoming` | Заплановано аварійне відключення | Emergency outage scheduled |
| `ETA_CHANGED` | Змінився час відновлення | Restoration time changed |
| `END`, `earlyEnd = false` (or no estimate) | Аварійне відключення завершено | Emergency outage ended |
| `END`, `earlyEnd = true` | Аварійне відключення скасовано | Emergency outage cancelled |

| Event and case | Body uk | Body en |
|---|---|---|
| `START`, estimate known | Початок: {start}. Орієнтовне відновлення: {eta}. | Start: {start}. Estimated restoration: {eta}. |
| `START`, no estimate | Початок: {start}. Час відновлення невідомий. | Start: {start}. Restoration time unknown. |
| `ETA_CHANGED` | Нове орієнтовне відновлення: {eta}. | New estimated restoration: {eta}. |
| `END`, normal | Електропостачання за вашою адресою відновлено (початок був: {start}). | Power supply at your address has been restored (started: {start}). |
| `END`, `earlyEnd = true` | Відключення зникло зі списку до {eta}: світло, імовірно, вже є. | The outage left the list before {eta}: power is probably back. |

The wording of `END` is chosen from `earlyEnd`: when the estimate had already passed it is a normal restore; before it, PowerOn can not tell "restored early" from "cancelled", so the text says so. The address is appended as a second line when known (`SUBSCRIPTIONS.md` 8.4).

## 3. Reliability limits (state them in the app and in store text)

- Emergency events depend on **polling**; they are best effort. Android: `WorkManager` periodic work has a 15 minute floor (`refreshFloorMinutes`), the user may pick shorter values in settings (stored 1..240) but the effective period is `max(setting, 15)`; Doze can delay further. iOS: `BGAppRefreshTask` runs opportunistically (minutes to hours, or never), so refresh also on every foreground. A server push relay is a separate, not yet taken decision (option C, a per-street topic so the server never learns the house, is the recommended target and changes the privacy policy).
- Planned pre-warnings are local and exact on both platforms: no network is needed after the schedule is cached.
- Android 13+ needs the `POST_NOTIFICATIONS` runtime permission; when denied, do not vibrate or play sound for a notification that cannot be shown (review finding C18).
- Emergency and planned notifications use separate channel sets (Android) so users can mute one kind without the other; channel ids are an adapter detail.

## 4. Android exact alarms

- Manifest: keep `android.permission.SCHEDULE_EXACT_ALARM`, remove `USE_EXACT_ALARM` (Play restricts it). The Play Console exact-alarm declaration has to be re-checked after this change (owner action).
- Before scheduling check `AlarmManager.canScheduleExactAlarms()`. If granted: `setExactAndAllowWhileIdle(RTC_WAKEUP, ...)`.
- If not granted (or a `SecurityException`): fall back to `setAndAllowWhileIdle`, show a persistent Settings card and a Main banner: uk `Дозвольте «Будильники й нагадування», щоб попередження приходили вчасно` (the wording of the plan), with a button that opens `Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM` for the package.
- Register a receiver for `AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED` and re-sync when the permission changes. Existing installs must grant it once after the update; the prompt stays until granted.
- iOS has no exact-alarm concept: a local notification fires at its trigger date.

## Vectors

- Planned alerts: `spec/vectors/outage_engine.json` (`alerts` of the cases "upcoming planned outages get one alert each", "an alert whose time already passed is not scheduled retroactively", "planned outage 13.11 23:00 to 14.11 01:00 is one block", "during the midnight-crossing outage ... no alert fires", "planned block followed directly by an emergency ...", "repair works tomorrow ...", "year boundary ...", "emergency ... stale ... never alerts").
- Emergency events and keys: `spec/vectors/emergency_ledger.json` (9 cases: start then early end; failed fetch; already over when first seen; estimate moves; 9 minutes ignored and exactly 10 notifies; end within grace; silent end beyond grace; upcoming start; reappearance after close).
- Texts, durations, platform triggers, registry behaviour: no vector (adapter level).
