# POWERON_API

How to read emergency outages and repair works from the PowerOn JSON API used by Zhytomyroblenergo, and how rows become outages. Reference implementation of the mapping: `android/app/src/main/java/ua/blackout/prewarning/core/PowerOnMapper.kt`. Constants: `spec/config.json` (`poweron`). REM id table: `spec/rems.json`.

Facts below were probed live on 2026-11-12 and re-checked on 2026-11-13. The API is unofficial and public (`ztoe-poweron.inneti.net` is only a React front end); treat every number that changes with time (row counts) as an observation, not a contract.

## 1. Base and endpoints

Base URL: `https://api-ztoe-poweron.inneti.net/api`. Only `GET` is used. No authentication, no cookies.

| Endpoint | Used for | Filters that work (from the server's own `hydra:search` template) |
|---|---|---|
| `pw_accidents` | Emergency outages (and mirrors of the hourly schedule) | `city.id`, `city.id[]`, `street.id`, `street.id[]`, `otg.id`, `otg.id[]`, `typeOff`, `typeOff[]`, `switchSubReason`, `switchSubReason[]`, `customFilter` (not used, meaning unknown) |
| `pw_accident_planeds` | Planned repair works (`REPAIR`) | `city.id[]`, `street.id[]`, `otg.id[]` (and the scalar forms), `datePlanIn[before]`, `datePlanIn[strictly_before]`, `datePlanIn[after]`, `datePlanIn[strictly_after]`. No `typeOff`, no `switchSubReason`. |
| `pw_otgs` | REM list (20 rows, ids 1-19 are the REMs, id 20 is the company itself) | none needed; use `pagination=false` |
| `pw_cities` | Resolve a settlement to a PowerOn city id | `name` (exact), `otg.id`, `otg.id[]`, `codeOtg`, `codeOtg[]` |
| `pw_streets` | Resolve street ids of a city | `name` (exact), `city.id`, `city.id[]` |

`pw_accident_histories` and `pw_accident_planed_histories` exist but are empty: there is **no server-side history**. Finished emergencies can only be remembered locally (see `NOTIFICATIONS.md`, ledger).

## 2. Rules and traps

| # | Rule | Evidence |
|---|---|---|
| 1 | Always use the **dotted** filter names: `city.id`, `street.id`, `otg.id`. The plain names `city=`, `street=`, `otg=` and `code_otg=` are **silently ignored** and the server returns every row. | `pw_accidents` returned 12 385 rows on 2026-11-12 and 7 936 on 2026-11-13 with no usable filter. |
| 2 | Array filters repeat the key with `[]`: `street.id[]=33382&street.id[]=33565`. Both raw and percent-encoded brackets (`%5B%5D`) are accepted; encode them on platforms whose URL builder requires it. | Verified with both forms. |
| 3 | The default page size is **30**. A response without `pagination=false` carries `hydra:view` with `hydra:next`; reading page 1 only silently drops rows. Send `pagination=false` (verified to work on all endpoints used) and still filter by ids. | `pw_accidents` without parameters: 30 members, `hydra:last` = page 265. |
| 3a | A whole-REM request is large (`pw_accident_planeds?otg.id=6&pagination=false` is about 730 KB, 1 055 rows; `pw_cities?otg.id=6&pagination=false` about 780 KB). Query by `street.id[]` instead (about 1 KB per street). | Probe 2026-11-13. |
| 4 | `Accept: application/ld+json` returns `{"hydra:member": [...], "hydra:totalItems": N, ...}`. `Accept: application/json` returns a **bare array** `[...]`. Send `application/ld+json` and accept both shapes defensively when parsing (an array under `hydra:member`, or a top-level array). | `application/json` returned `[]` for an empty result. |
| 5 | `switchSubReason`: `2` = a mirror of the hourly schedule (its `koment` is the queue, for example `3,1`); `0` = a real emergency (`koment` usually `МО`); `1` and `3` were empty at probe time but are real emergency reasons. **Emergency = `switchSubReason != 2`** (an absent value counts as emergency). Ask the server for `switchSubReason[]=0&switchSubReason[]=1&switchSubReason[]=3` and still drop `2` client side. | 3 789 non-mirror rows on 2026-11-12. |
| 6 | `pw_accident_planeds` rows have **no** `switchSubReason`; they are all planned works (`typeOff = 3` observed). | Probe. |
| 7 | **Timestamps are Kyiv wall-clock labelled `+00:00`.** See section 4. | Evidence below. |
| 8 | Some rows have `dateEvent` days in the future (up to 17 Nov on 2026-11-12). Only outages touching yesterday..tomorrow are used (`inWindow`, repair `limit`); see section 5. | Min/max scan. |
| 9 | City names are **not unique** inside one REM (`otg.id=3` lists `Гальчин` twice; `otg.id=6` repeats names such as `Волиця`, `Зарічани`, `Станишівка`) and not unique across REMs (`Баранівка` exists under otg 2 and under the Малинський РЕМ). Always filter by `otg.id` and treat the answer as a list. | Probe 2026-11-13. |
| 10 | Street names come in duplicate variants (apostrophe, case, spacing); see `ADDRESS_KEY.md`. Accident rows may hang on either id, so query **all** merged ids. | Real pairs in `ADDRESS_KEY.md` section 5.1. |

## 3. Row shape

Nested JSON as the API returns it (`pw_accidents`; `pw_accident_planeds` is the same without `switchSubReason`):

```json
{
  "@id": "/api/pw_accidents/412515257", "@type": "PwAccident", "id": 412515257, "code_otg": "3",
  "city":   { "@id": "/api/pw_cities/110", "@type": "PwCity", "id": 110, "name": "Бердичів", "codeOtg": "" },
  "street": { "@id": "/api/pw_streets/1550", "@type": "PwStreet", "id": 1550, "city": { "...": "..." }, "name": "вул. Коцюбинського" },
  "dateEvent": "2026-11-12T20:40:24+00:00", "datePlanIn": "2026-11-12T23:55:00+00:00",
  "koment": "МО", "switchSubReason": 0,
  "otg": { "@id": "/api/pw_otgs/3", "@type": "PwOtg", "id": 3, "code": "3", "name": "Бердичівський РЕМ" },
  "buildingNames": "67, 69, 72, 74", "typeOff": 1
}
```

The mapper works on a flat `PowerOnRow`; build it from the JSON like this:

| `PowerOnRow` field | JSON source | Notes |
|---|---|---|
| `id` | `id` | |
| `cityId`, `cityName` | `city.id`, `city.name` | nullable id |
| `streetId`, `streetName` | `street.id`, `street.name` | nullable id |
| `dateEvent` | `dateEvent` | outage start (string, see section 4) |
| `datePlanIn` | `datePlanIn` | estimated restore (emergency) or planned end (repair) |
| `koment` | `koment` | free text; `МО` is the usual emergency label; trimmed, empty means no label |
| `switchSubReason` | `switchSubReason` | null on planned works |
| `typeOff` | `typeOff` | not used by the mapper; observed 0 or 1 on accidents, 3 on planned works |
| `buildingNames` | `buildingNames` | comma list of houses on that street, see `ADDRESS_KEY.md` |

`pw_streets` items are flat: `{"id": 4757, "city": "/api/pw_cities/333", "name": "вул. Київська"}` (the `city` value is an IRI string there, not an object). `pw_cities` items: `{"id": 333, "name": "Житомир", "codeOtg": "", "otg": {"id": ..., "name": "Житомирський РЕМ"}}`.

## 4. The timestamp quirk

Values look like `2026-11-12T22:04:40+00:00` but are **Kyiv wall-clock time with a wrong offset label**.

- Evidence 1: queue 3.1 is off `22:00-24:00` on ztoe. Its mirror row (`switchSubReason = 2`, `koment = "3,1"`) reads `22:04` to `00:04` `+00:00`. Honouring the offset would put it at 00:04-02:04 or 01:04-03:04 Kyiv time, which contradicts ztoe; read as local time it matches.
- Evidence 2 (an inference, not a separate probe): repair works read `08:00` to `17:00`, a plausible working shift only when read as local time.

Rule: **drop the offset, never convert.** `parseTime(raw)`:

1. Match `^\s*(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?` at the start of the string. No match: `null`.
2. Build a `LocalDateTime` from year, month, day, hour, minute. An impossible date or time (month 13, day 31 in a 30-day month, 29 Feb in a non-leap year, hour 24) gives `null`.
3. Everything after the matched part (seconds, fraction, `+00:00`, `Z`, `+02:00`) is ignored. The result has **minute precision**; seconds are truncated, not rounded.

Do not use a default ISO 8601 date parser: Swift `ISO8601DateFormatter`, JavaScript `new Date(...)`, Kotlin `Instant.parse` or `OffsetDateTime.parse` all apply the offset and are 2 to 3 hours wrong. Tests: `timestamps` in `poweron_api.json` (including `+02:00` and `Z`, which must also be ignored).

## 5. Rows to outages

### 5.1 Emergencies: `emergencyRecordsFor(rows, house) -> EmergencyRecord[]`

For each row, in order:

1. Skip rows with `switchSubReason == 2`.
2. Skip rows whose `buildingNames` does not contain `house` (`HouseKey.listContains`).
3. `start = parseTime(dateEvent)`; skip the row when `null`.
4. `estimatedEnd = parseTime(datePlanIn)` only if it is strictly after `start`, else none.
5. `id = "pw_" + start` (text form, `pw_2026-11-12T21:08`). `label = trim(koment)` or none when empty.
6. Rows with the same `id` are merged: `estimatedEnd` = the later of the two (a missing estimate loses against a present one), `label` = the first non-empty.

Return the records sorted by `start`. `closedAt` is not set here (only the ledger sets it). The id depends only on the start, so duplicate street ids of one street merge into one record.

### 5.2 Repair works: `repairOutagesFor(rows, house, today) -> Outage[]`

1. Skip rows whose `buildingNames` does not contain `house`.
2. `start = parseTime(dateEvent)`, `end = parseTime(datePlanIn)`; skip on `null`.
3. Skip the row unless `end > start` and `start < (today + 2 days) 00:00` (works dated beyond tomorrow are dropped).
4. `id = "repair_" + start`; kind `REPAIR`; same label rule. Rows with the same `id` merge: `end` = the later end, label = the first non-empty.

Return sorted by `start`. Finished works of today stay in the list (they are history); the engine marks them `FINISHED`.

### 5.3 Rows far in the future (adapter rule, not in the mapper)

`emergencyRecordsFor` does **not** drop rows dated days ahead. The engine ignores them through `inWindow`, but the ledger would announce them. The adapter must therefore drop emergency records whose `start >= (today + 2 days) 00:00` **before** `EmergencyLedger.reconcile`. No vector covers this filter yet.

## 6. Resolving ids for an address

The vectors cover the mapping above, not the resolution. This is the specified strategy (adapter level); results are cached with the address.

1. **REM**: the user's REM slug or ztoe `rem_id` -> `poweronOtgId` through `spec/rems.json`. The two id spaces differ (Zhytomyr is ztoe 7, PowerOn 6).
2. **City**: take the ztoe settlement label, strip its leading type word (`м.`, `с.`, `смт`, `селище`: PowerOn city names carry no such prefix, for example ztoe `м. Житомир` is PowerOn `Житомир`, id 333), then call `GET pw_cities?name=<exact name>&otg.id=<otgId>`. The answer may hold several cities of the same name (rule 9): keep **all** returned ids as candidates. Compare names with the folding of `ADDRESS_KEY.md` (apostrophes and case differ between the sites).
3. **Streets**: `GET pw_streets?city.id[]=<id>&city.id[]=<id>...&pagination=false` (Zhytomyr city: 997 streets, about 140 KB). Keep every street whose `StreetKey.of(name)` equals `StreetKey.of(<ztoe street name>)`; **all** matching ids are kept (merge rule). A single street can also be found by exact `name=`, for example `pw_streets?city.id=333&name=вул. Київська` -> id 4757, but only the full list finds the duplicate spelling variants.
4. If no street matches, the address is **unresolved**: the emergency source is `Unavailable("unresolved")` (never "no emergency"), and the UI says emergency data is not available for this address.
5. **Query by address** with all merged street ids (below). Filter rows by house locally.

## 7. Per-address query URLs

Example address: Zhytomyr (REM Житомирський, otg 6), city 333, street `вул. Київська` (id 4757). Add further ids with more `street.id[]` pairs. Percent-encoding shown for the brackets; spaces and Cyrillic in query values must be UTF-8 percent-encoded as usual.

```text
Emergencies (real ones only):
GET https://api-ztoe-poweron.inneti.net/api/pw_accidents?street.id%5B%5D=4757&switchSubReason%5B%5D=0&switchSubReason%5B%5D=1&switchSubReason%5B%5D=3&pagination=false
Accept: application/ld+json

Planned repair works from today on (date part only is enough):
GET https://api-ztoe-poweron.inneti.net/api/pw_accident_planeds?street.id%5B%5D=4757&datePlanIn%5Bafter%5D=2026-11-13&pagination=false
Accept: application/ld+json

REM list:      GET .../api/pw_otgs?pagination=false
City by name:  GET .../api/pw_cities?name=%D0%96%D0%B8%D1%82%D0%BE%D0%BC%D0%B8%D1%80&otg.id=6        (-> id 333)
Street list:   GET .../api/pw_streets?city.id%5B%5D=333&pagination=false
```

`datePlanIn[after]=2026-11-14` on the Zhytomyr REM reduced 1 055 rows to 883 and removed all rows ending on 2026-11-13, so the filter takes a plain date. A row is returned when its `datePlanIn` is later than that day's 00:00, so works that already ended earlier the same day are still returned for `after=<today>` (finished works of today stay visible).

Constants: connect timeout 8 000 ms, read timeout 8 000 ms, accident cache time-to-live 60 s (do not re-ask the same ids within 60 s), `User-Agent` free text. The pre-1.4.0 Android code still uses 5 000 ms and a whole-REM request; the values in `config.json` are the target.

## 8. Failure semantics

Each fetch returns exactly one of:

- `Confirmed(records)`: HTTP 2xx and a body that parses as a row array (either shape from rule 4). An **empty list is a valid answer** and means "PowerOn has no emergency for these streets".
- `Unavailable(reason)`: anything else (DNS, connect, timeout, TLS, non-2xx, a body that is not an array, truncated JSON, unresolved ids).

`Unavailable` must never be turned into "no emergency". The ledger leaves its state unchanged on `Unavailable`, so a network error cannot cause a false "power is back" notification or hide a real one. The same tri-state applies to repair works: on `Unavailable` keep the last confirmed repair list for the same dates instead of clearing it.

## Vectors

`spec/vectors/poweron_api.json`: `timestamps` (9 inputs incl. offsets, `Z`, a space instead of `T`, impossible dates, garbage, empty), `emergencyMapping` (5 cases: real emergency matched across Latin/Cyrillic, mirror rows ignored, house not in the list, two merged street ids with the same start keep the later estimate, estimate not after start dropped), `repairMapping` (2 cases: repair becomes a `REPAIR` outage; far-future, other-house and inverted rows dropped). Related: `outage_engine.json` (repair and emergency cases), `address_keys.json`.
