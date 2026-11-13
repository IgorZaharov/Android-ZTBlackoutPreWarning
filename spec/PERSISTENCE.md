# Persistence contract

Logical field names, types and defaults that every platform stores. The storage mechanism differs
(Android `SharedPreferences`, web `localStorage`, iOS App Group `UserDefaults` plus JSON files), the
field names do not. Names below are what the Android code really writes (`SettingsRepository.kt`);
older iOS documents list different names (`refreshMinutes`, `advanceMinutes`) and are wrong.

## 1. User settings (`zt_user_settings`)

| Field | Type | Default | Notes |
|---|---|---|---|
| `city_url` | string | `https://www.ztoe.com.ua/unhooking-search.php` | must be listed in `valid-urls.json` |
| `queue` | string | `""` | `1.1` … `6.2`, empty = not chosen yet |
| `custom_queue_status_text` | string | `""` | shown instead of the queue title when the queue came from an address |
| `selected_address` | string | `""` | human readable label |
| `selected_rem` | string | `""` | REM slug, see `rems.json` |
| `selected_settlement` | string | `""` | ztoe settlement option id |
| `selected_street` | string | `""` | canonical street option id (any merged id resolves, see `ADDRESS_KEY.md`) |
| `selected_house` | string | `""` | as chosen; compared through `HouseKey` |
| `refresh_minutes` | long | `30` | clamped 1–240; background floor is 15 (`config.json`) |
| `advance_minutes` | int | `15` | clamped 1–240 |
| `notifications_enabled` | bool | `true` | planned alerts (and master switch for sound/vibration) |
| `emergency_notifications_enabled` | bool | `true` | emergency alerts; independent of `notifications_enabled` |
| `sound_enabled` | bool | `true` | forced `false` while both alert switches are off |
| `vibration_enabled` | bool | `true` | same |
| `prev_sound_enabled`, `prev_vibration_enabled` | bool | `true` | remembered values restored when alerts are switched on again |
| `theme_mode` | string | `SYSTEM` | persisted, no UI in 1.4.0 |
| `language` | string | `SYSTEM` | `SYSTEM`, `UK`, `EN` |

Retired in 1.4.0 (read but ignored, never written back with data): `active_emergency_outage_*`.
The emergency state now lives in the outage state store below.

## 2. Schedule cache (`zt_schedule_cache_v2`)

Today and tomorrow off-cells per queue with the date stamp they were fetched for, the ETag of the
page, and the time of the last successful fetch. A failed fetch never clears it. A cache is valid for
today only if its date stamp equals today (Kyiv). A yesterday stamp is archived so the previous day's
tail past midnight stays available (`ScheduleRepository.archiveYesterday`).

## 3. Outage state (`zt_outage_state_v1`)

Per address key `settlementId|StreetKey|HouseKey` (`ADDRESS_KEY.md`):

| Key | Content |
|---|---|
| `ledger_<addr>` | JSON array of ledger entries (`id`, `start`, `estimatedEnd`, `label`, `firstSeen`, `lastSeen`, `closedAt`, `startEmitted`, `endEmitted`, `lastEmittedEta`), ISO local date-times, 48 h retention |
| `repair_<addr>` | JSON array of planned repair works (`id`, `start`, `end`, `label`) |
| `ids_<addr>` | resolved PowerOn ids `{cityIds, streetIds, resolvedAtMs}`, TTL 7 days |

Global keys: `site_state`, `site_checked_ms`, `site_last_success_ms`, `poweron_ok`,
`poweron_checked_ms`, `poweron_last_ok_ms`.

## 4. Alert registry (`zt_notified_blackouts_v1`)

Keys that were already notified, so an alert is never posted twice: `planned_<ISO start>`,
`emerg_start_<addr>_<startISO>`, `emerg_change_<addr>_<startISO>_<etaISO>`,
`emerg_end_<addr>_<startISO>` (`NOTIFICATIONS.md`). Alarm request codes come from a registry
(`AlarmCodes`), never from `String.hashCode()`.

## 5. Backup

The Android backup rules exclude caches, alarm codes, notified flags and the outage state. Only the
user settings travel with a device backup.

## 6. Large data on iOS

The address index (REM → city → street with merged ids → houses) and the ledger are versioned JSON
files in the App Group container, not `UserDefaults` (tens of thousands of house records).
`schemaVersion` is an integer at the top of each file; a different version means "discard and rebuild".
