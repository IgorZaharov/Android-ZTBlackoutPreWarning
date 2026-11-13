# Subscriptions (multi-address) — store and migration

Status: **steps 1 to 5 of the multi-address feature** (`docs/design/MULTI_ADDRESS.md`, owner decisions in
its section 14). This file fixes the stored model, its repair rules, the store operations, the migration
from single-address settings, (step 2) the mirror of the primary item into the single-address keys and
(step 3) the alerts for every item, (step 4) the address switcher of the main screen and (step 5) the address
of each widget. Since step 2 the Settings screen edits the store and the store is the source of truth; since
step 3 planned and emergency alerts cover every item, since step 4 the main screen can show any item and
since step 5 every widget shows its own item (the primary by default). Golden cases: [`vectors/subscriptions.json`](vectors/subscriptions.json).

Pure code: Kotlin `core/Subscriptions.kt`, TypeScript `src/core/subscriptions.ts`. Both expose the model
as plain maps (`toMap` / `fromMap`), so the core never depends on a JSON library; each platform turns
the map into a string (Android `org.json`, web `JSON`, iOS `JSONSerialization`).

## 1. Model

| Field | Type | Rule |
|---|---|---|
| `schemaVersion` | int | `1`. Any other value: `fromMap` returns *absent* (the store is treated as missing and migration runs again from the legacy keys, which stay written for one release) |
| `primaryId` | string or null | id of the primary item; null only when `items` is empty |
| `items` | array, 0..5 | in insertion order |

Item:

| Field | Type | Rule |
|---|---|---|
| `id` | string | `^[a-z0-9]{4,32}$`, never reused; the platform generates 8 random characters |
| `label` | string | 0..40 UTF-16 units, cleaned by `cleanLabel` (section 3); empty = automatic, shown as `displayLabel` |
| `address` | object or null | null = queue-only subscription |
| `queue` | string or null | `^[1-6]\.[12]$`; null when ZTOE gives no queue for the address |
| `queueSource` | `LOOKUP` or `MANUAL` | how the queue was set; unknown value reads as `MANUAL` |
| `queueStatusText` | string or null | ZTOE text shown when the address has no queue (today's `custom_queue_status_text`) |
| `plannedAlerts` | bool | default `true` |
| `emergencyAlerts` | bool | default `true` |
| `createdAtMs` | long | epoch milliseconds |

Address (fields are what 1.4.0 already stores in `zt_user_settings`, see `PERSISTENCE.md` section 1):

| Field | Source in 1.4.0 | Rule |
|---|---|---|
| `remSlug` | `selected_rem` | REM slug from `rems.json` |
| `settlementId` | `selected_settlement` | ztoe settlement option id |
| `streetId` | `selected_street` | canonical street option id; any merged id resolves (`ADDRESS_KEY.md`) |
| `streetName` | *resolved by the platform* from `streetId` | display name, e.g. `вул. Київська`; may be empty |
| `house` | `selected_house` | as chosen |
| `text` | `selected_address` | full human readable line; may be empty |

An address is valid only if `remSlug`, `settlementId`, `streetId` and `house` are all non-blank.

**Address key** (derived, never stored): `settlementId|StreetKey(streetName or, if blank, streetId)|HouseKey(house)`.
It is exactly the key 1.4.0 uses for `ledger_*`, `repair_*`, `ids_*` and the emergency alert keys
(`PERSISTENCE.md` section 3, `NOTIFICATIONS.md`). Per-address state therefore stays keyed by the
address key, not by the subscription id, and migration needs no re-keying. (The design draft proposed a
fixed id `addr_default`; 1.4.0 never used one.)

**Identity** (for duplicate checks): `a:<address key>` when `address` is set, else `q:<queue>`.

PowerOn ids are **not** part of the item: they live in the outage state store (`ids_<address key>`,
7-day TTL) as in 1.4.0.

## 2. Repair (`repair`, run on every read)

Applied in this order; every dropped item is reported as `{id, reason}`. Nothing ever throws.

1. Item `id` missing or not matching the id rule -> drop, `invalid_id`.
2. Normalise: invalid `queue` -> null; invalid `address` -> null; `label` -> `cleanLabel(label)` (missing or
   not a string -> empty). Missing or non-boolean switches -> `true`; missing or non-numeric `createdAtMs` -> `0`;
   a field of the wrong type reads as missing. Non-object entries of `items` are skipped without a report;
   `items` that is not an array reads as empty.
3. Item with neither `address` nor `queue` -> drop, `empty`.
4. Same `id` as an earlier item -> drop, `duplicate_id`.
5. Same identity as an earlier item -> drop, `duplicate_address`.
6. More than 5 items -> drop the later ones, `over_limit`.
7. `primaryId` not among the remaining ids -> the first item's id, or null if none remain.

## 3. Labels

`displayLabel(item)` = `label` if not empty, else `defaultLabel(item)`. `defaultLabel(item)`:

* Address with a non-blank `streetName`: decode entities, collapse whitespace, trim; split on spaces; drop
  the first token if it is a street-type word (`StreetKey.isTypeWord`: the `ADDRESS_KEY.md` type table,
  compared lower-case without trailing dots) and other tokens remain; join; then a space and the trimmed
  `house`. `вул. Київська` + `77` -> `Київська 77`.
* Address with a blank `streetName`: `буд. <house>`.
* Queue-only: `Черга <queue>`.

`cleanLabel(raw)`: replace every run of whitespace with one space, trim spaces, cut to 40 UTF-16 units (a
cut that would split a surrogate pair drops the high surrogate too). An empty result means automatic.
Whitespace here and in `defaultLabel` is exactly: space, tab, LF, VT, FF, CR, U+00A0, U+200B.

## 4. Operations

Each returns either the new store or an error code; the input store is never changed.

| Operation | Errors | Effect |
|---|---|---|
| `add(item)` | checked in this order: `invalid` (fails repair steps 1–3), `duplicate_id`, `duplicate` (same identity; the error carries the existing id), `limit_reached` (already 5) | normalises the item (repair step 2) and appends it; the first item becomes primary |
| `remove(id)` | `not_found` | removes; if it was the primary, the remaining item with the smallest `createdAtMs` (list order on ties) becomes primary |
| `setPrimary(id)` | `not_found` | |
| `setPlanned(id, on)`, `setEmergency(id, on)` | `not_found` | |
| `rename(id, raw)` | `not_found` | stores `cleanLabel(raw)`; empty -> automatic |
| `move(id, toIndex)` | `not_found` | moves the item to position `toIndex` (clamped to `0 .. items.size - 1`) and shifts the others; the primary and every field stay unchanged. The list order is the order of the Settings card, the main-screen chips (section 9) and the widget configure list (section 10) |
| `setQueueInfo(id, queue, statusText, addressText)` | `not_found`, `invalid` (item has no address) | result of a ZTOE lookup for an address item: `queue` (invalid -> null), `queueStatusText` (blank -> null); `address.text` = `addressText` when that is not blank, else unchanged. `queueSource` is unchanged |

## 5. Effective switches (derived)

```
plannedActive(master, item)                  = master AND item.plannedAlerts AND item.queue != null
emergencyActive(master, item, poweronIdsKnown) = master AND item.emergencyAlerts AND item.address != null AND poweronIdsKnown
anyAlertsEnabled(master, store)              = master AND any item has plannedAlerts OR emergencyAlerts
```
`master` is `alerts_master_enabled` (owner decision 1: one kill switch for planned and emergency).
Toggles never hide data.

**Settings display.** While the master is off, every item's `Планові` and `Аварійні` switches show **off** and
are disabled, and the card shows the caption `Усі сповіщення вимкнені загальним перемикачем. Налаштування адрес
збережені.` / `All alerts are off by the main switch. Each address keeps its settings.` The stored
`plannedAlerts` / `emergencyAlerts` values are not changed, so turning the master on shows and uses them again.

## 6. Migration from single-address settings

Runs once, when the store key is absent (or `fromMap` returned absent). Input = the 1.4.0 legacy
settings plus the street name the platform resolved for `selected_street`, a new id and the time.

1. `queue` = legacy `queue` if valid, else null.
2. Legacy address valid (section 1) -> one item: `address` from the legacy fields, `queue`,
   `queueSource = LOOKUP`, `queueStatusText` = `custom_queue_status_text` (blank -> null), empty label
   (automatic), `address.streetName` = the resolved name or empty, `address.text` = `selected_address`.
3. Else, `queue` not null -> one queue-only item, `queueSource = MANUAL`, empty label (shows `Черга <queue>`).
4. Else -> empty store, `primaryId = null`.
5. `createdAtMs` = the given time. `plannedAlerts = notifications_enabled`, `emergencyAlerts = emergency_notifications_enabled`,
   `alertsMaster = notifications_enabled OR emergency_notifications_enabled`. With both legacy switches
   off this gives master off and both item switches off (owner decision 8), and with either on it keeps
   today's behaviour exactly.
6. Sound, vibration, advance minutes, refresh interval: untouched.

Storage: the store is the string key `zt_subscriptions_v1` and the master is the boolean
`alerts_master_enabled`, both in the user settings file (backed up with it, `PERSISTENCE.md` section 5).

## 7. Mirror of the primary item (step 2, until steps 4–5 read the store)

Main screen and widgets still read the single-address keys of `PERSISTENCE.md` section 1. After every
change of the store or of the master switch, the platform writes `primaryMirror(store, master)` into those
keys; the store is never derived back from them.

| Key | Value (`p` = primary item, null when the store is empty) |
|---|---|
| `queue` | `p.queue`, or `""` |
| `custom_queue_status_text` | `p.queueStatusText`, or null |
| `selected_address` | `p.address.text` if not empty, else `displayLabel(p)` when `p` has an address, else null |
| `selected_rem`, `selected_settlement`, `selected_street`, `selected_house` | the fields of `p.address`, or `""` |
| `notifications_enabled` | `master AND (p == null OR p.plannedAlerts)` |
| `emergency_notifications_enabled` | `master AND (p == null OR p.emergencyAlerts)` |

The two booleans are kept for rollback safety (design section 10 step 7); since step 3 no alert reads them
(section 8 reads the store).

**Sound and vibration follow the master** (since step 3). When `setMaster` turns the master off, the
current sound and vibration values are remembered (`prev_sound_enabled`, `prev_vibration_enabled`) and both
are switched off; the remembered values are the stored ones before the change, never the values masked by the
new master (Android stores the master first, so it reads the raw `sound_enabled` / `vibration_enabled` keys); when it turns the master on again they are restored. Setting the master to the value it
already has changes nothing. Item switches never touch sound or vibration, so turning off both switches of
the primary no longer mutes the alerts of the other items. (Step 2 applied the 1.4.0 rule to the two mirrored
booleans instead.) For the same reason, reading and saving the settings masks sound and vibration with
the master when `alerts_master_enabled` is stored: master off reads and saves both as off. Only without a
stored master (before the migration ran) the 1.4.0 rule applies: both are off when
`notifications_enabled` and `emergency_notifications_enabled` are both off. The Settings rows for sound and
vibration are enabled exactly when the master is on.

## 8. Alerts for every item (step 3)

### 8.1 Planned: one alert per queue and span

For every item the platform computes `alerts(item)` = `OutageEngine.planAlerts` (`NOTIFICATIONS.md` 1.1)
over that item's outages: the ztoe table of `item.queue` plus the repair works stored under its address key,
with the same `now` and the global advance minutes. One ztoe fetch caches all 12 queues, so no extra request
is needed per item; when the primary item has no queue, the fetch uses the first queue in `alertOrder`.

`alertOrder(store)`: the primary first, then the other items by `createdAtMs`, list order on ties.

`groupAlerts(store, master, alertsById)` walks the items in `alertOrder`, skips every item that is not
`plannedActive(master, item)` (section 5) or has no entry in `alertsById`, and puts each of its alerts into
the group of **(item.queue, spanStart, spanEnd)**:

| Group field | Value |
|---|---|
| `key` | `planned_q<queue>_<spanStart>_<spanEnd>` (engine text form `yyyy-MM-ddTHH:mm`) |
| `queue`, `spanStart`, `spanEnd`, `fireAt`, `durationMinutes` | from the first alert of the group |
| `mayContinue` | true when any alert of the group has it |
| `memberIds` | item ids in walk order, each once |

Groups are returned sorted by `fireAt`, then `spanStart`, then `key`. Two items on one queue share one group
(owner decision 3: one merged notification); a repair work that extends one item's span gives that item a
different `spanEnd` and so its own group. The platform schedules one alarm per pending group (8.2). With at
most 5 queues and 48 spans per queue in the window the plan stays far below Android's 500 alarm limit.

### 8.2 Dedupe and firing

* `memberKey(id, spanStart)` = `planned_<id>_<spanStart>` is the fired-registry key of one item.
* `legacyAlertKey(spanStart)` = `planned_<spanStart>` is the key 1.4.0 recorded. A member is **notified** when
  the registry holds either key; the legacy key counts for every item (it can only exist for an alert that
  fired just before the update, so no alert repeats).
* `pendingMembers(group, notified)` = the members that are not notified, in member order. A group is
  **pending** when that list is not empty. Only pending groups are scheduled.
* At fire time the platform recomputes the groups from the current state and posts **every pending group whose
  `spanStart` equals the alarm's span start** (so a changed end, queue or membership never loses the warning,
  and a second alarm for the same start finds nothing left to post). Posting a group marks `memberKey` for
  **every** member, so removing one item later never re-alerts the others. The receiver checks are
  otherwise those of `NOTIFICATIONS.md` 1.2.

### 8.3 Labels in the text

`alertLabels(store, memberIds)`: null when the store has at most one item (the text is exactly 1.4.0's) or the list is empty.
Otherwise the `displayLabel`s of the members in member order: one -> `l1`; two -> `l1 · l2`; three or more
-> `l1 · l2 +<n-2>`. The planned body then starts with `<labels> (черга <q>): ` / `<labels> (queue <q>): `
instead of `Черга <q>: `, or with just `<labels>: ` when the labels are exactly `Черга <q>` (`NOTIFICATIONS.md` 1.3).

### 8.4 Emergency: every item with an address

The platform polls PowerOn for the primary item's address (always: the main screen shows it) and for every
other item with `master AND emergencyAlerts AND address != null`. Each item has its own request, its own
failure and its own ledger under its address key, so one failing item never touches another. Events of an
item are posted when `master AND item.emergencyAlerts`; their second line is `item.address.text` when not
blank, else `displayLabel(item)`. The PowerOn status line of the main screen comes from the primary's fetch
only. Emergencies are never merged across items (they are per house).

Since step 4 the item shown on the main screen (section 9) is polled too, whatever its switches; its events
are still posted only when `master AND item.emergencyAlerts`. The fetch result of a non-primary item is
kept per address key (`poweron_ok_<key>`, `poweron_checked_ms_<key>`, `poweron_last_ok_ms_<key>`, same
meaning as the primary's keys of `PERSISTENCE.md`) and is the PowerOn status line while that item is shown.

## 9. Main screen: address switcher (step 4)

```
switcherItems(store)       = store.items in list order when there are 2 or more items, else []
viewItem(store, selectedId) = the item with selectedId if it exists, else the primary item, else null
noAlertsCaption(master, store) = master AND store.items not empty AND NOT anyAlertsEnabled(master, store)
```

* With `switcherItems` empty the main screen looks exactly as in 1.4.0. Otherwise a row of chips shows one
  chip per item (`displayLabel`, the primary marked with a star), under the global banners (exact alarms,
  site state) and above everything that belongs to one address (emergency banner, hero, day tabs, drum, rows).
* `selectedId` is session state: a cold start shows the primary (owner decision 5). An id that no longer
  exists (the item was removed) falls back to the primary. Selecting another item resets the day tab to Today.
* The shown item supplies the queue title, the address caption, the ZTOE status text of a house without a
  queue and the outages (`outagesFor(item.queue, item.address.key)`, local state only). The site state is
  global (one site); the PowerOn line is the shown item's (section 8.4).
* The header bell is the master switch (owner decision 4). When `noAlertsCaption` is true the header shows the
  caption `Для жодної адреси сповіщення не ввімкнені` / `No address has alerts turned on` with a link to
  Settings, so "on" never silently means nothing.
* Tapping an alert opens the main screen with its item shown: a planned group opens its first member
  (`memberIds[0]`, the primary when it is a member), an emergency the item it was polled for. A tap target that
  no longer exists shows the primary.

## 10. Widgets: one address per widget (step 5)

```
widgetItem(store, boundId)     = viewItem(store, boundId)   (boundId null = follow the primary)
widgetLabel(store, boundId)    = null when widgetItem is null; else displayLabel(widgetItem) when store.items has
                                 2 or more items, or when boundId is not null and names no item; else null
widgetItemIds(store, boundIds) = the distinct ids of widgetItem(store, b) for each b, in order of first appearance
```

* Each placed widget has a binding: absent or null means **follow the primary** (owner decision 6), so a new
  primary moves those widgets with it; an item id pins the widget. A binding to a removed item falls back to
  the primary and the label makes that visible (`widgetLabel`). Bindings are device state, not backed up
  (Android app widget ids change on restore).
* The shown item supplies the queue header, the ZTOE status text of a house without a queue and the outages
  (`outagesFor(item.queue, item.address.key)`, local state only), exactly as on the main screen (section 9).
  With `widgetLabel` not null the label is printed next to the queue (all three widget sizes); with one item
  the widgets look as in 1.4.0.
* The widget bell stays the master switch (owner decision 4) and the refresh button refreshes everything.
* Tapping a widget opens the main screen with its item shown (section 9, tap targets).
* Every item in `widgetItemIds` of the placed widgets is polled on PowerOn whatever its switches (as the shown
  item of section 8.4) and gets widget redraw alarms at its own power transitions; equal transition times of
  different items share one alarm.
* Choosing the binding: Android adds a configure screen to the three widget providers
  (`reconfigurable|configuration_optional`): on Android 12+ the widget is placed following the primary and
  "reconfigure" opens the screen; older versions open it on placement and confirm at once when there are
  fewer than two items. It lists `Основна адреса (авто)` / `Primary address (auto)` and every item in list
  order, the primary marked with a star. The web simulator shows the same choice as a picker above the
  widgets, one binding for all simulated widgets. iOS: WidgetKit configuration intent (design section 11).
