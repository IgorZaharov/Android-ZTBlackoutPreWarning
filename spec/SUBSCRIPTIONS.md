# Subscriptions (multi-address) — store and migration

Status: **steps 1 and 2 of the multi-address feature** (`docs/design/MULTI_ADDRESS.md`, owner decisions in
its section 14). This file fixes the stored model, its repair rules, the store operations, the migration
from single-address settings and (step 2) the mirror of the primary item into the single-address keys.
Since step 2 the Settings screen edits the store and the store is the source of truth; everything that
still reads the single-address keys (main screen, widgets, alarms, worker) sees the primary item. Golden cases: [`vectors/subscriptions.json`](vectors/subscriptions.json).

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
| `setQueueInfo(id, queue, statusText, addressText)` | `not_found`, `invalid` (item has no address) | result of a ZTOE lookup for an address item: `queue` (invalid -> null), `queueStatusText` (blank -> null); `address.text` = `addressText` when that is not blank, else unchanged. `queueSource` is unchanged |

## 5. Effective switches (derived)

```
plannedActive(master, item)                  = master AND item.plannedAlerts AND item.queue != null
emergencyActive(master, item, poweronIdsKnown) = master AND item.emergencyAlerts AND item.address != null AND poweronIdsKnown
anyAlertsEnabled(master, store)              = master AND any item has plannedAlerts OR emergencyAlerts
```
`master` is `alerts_master_enabled` (owner decision 1: one kill switch for planned and emergency).
Toggles never hide data.

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

## 7. Mirror of the primary item (step 2, until steps 3–5 read the store)

Main screen, widgets, alarms and the worker still read the single-address keys of `PERSISTENCE.md`
section 1. After every change of the store or of the master switch, the platform writes
`primaryMirror(store, master)` into those keys; the store is never derived back from them.

| Key | Value (`p` = primary item, null when the store is empty) |
|---|---|
| `queue` | `p.queue`, or `""` |
| `custom_queue_status_text` | `p.queueStatusText`, or null |
| `selected_address` | `p.address.text` if not empty, else `displayLabel(p)` when `p` has an address, else null |
| `selected_rem`, `selected_settlement`, `selected_street`, `selected_house` | the fields of `p.address`, or `""` |
| `notifications_enabled` | `master AND (p == null OR p.plannedAlerts)` |
| `emergency_notifications_enabled` | `master AND (p == null OR p.emergencyAlerts)` |

So the master switch silences both kinds for the primary (owner decision 1) without changing the code
that reads these keys, and the other items get no alerts yet (step 3, fan-out). Sound and vibration keep
their 1.4.0 rule on the two booleans: when both become false the current values are remembered and
switched off, when one becomes true again they are restored.
