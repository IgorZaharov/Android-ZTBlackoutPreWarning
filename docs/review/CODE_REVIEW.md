# Code and logic review: "Світло в Житомирі"

Branch `feat/1.4.0-outage-rework`. Review date 2026-11-12/13. Status: **static review plus live probing of both data sources. Nothing was run on a device or emulator**; every runtime claim below is marked as derived from source reading unless stated otherwise.

Related documents: [README](README.md) | [UI_REPORT](UI_REPORT.md) | [UI_PROPOSALS](UI_PROPOSALS.md) | [TYPOGRAPHY](TYPOGRAPHY.md)

## Contents

1. Scope and method
2. Verified facts about ztoe.com.ua and PowerOn
3. Architecture map of the data flow
4. Emergency model
5. Website-state handling
6. Duplicate streets: root cause and proposed canonical key
7. Findings C1 to C22 (expanded)
8. Additional findings omitted from the plan table (Medium and Low, plus one High)
9. Alarms and notification flow
10. Midnight and Tomorrow (C21)
11. Single-address assumptions
12. Kotlin versus TypeScript parity gaps
13. Test gaps
14. Release, CI and signing facts (described only)
15. iOS documents versus code: conflicts
16. Source inconsistencies noticed while writing this review
17. Prioritised fix list mapped to the plan phases

## 1. Scope and method

**Product.** Android app "Світло в Житомирі" (package/namespace `ua.blackout.prewarning`) that scrapes the ZTOE schedule page `https://www.ztoe.com.ua/unhooking-search.php` (Windows-1251 HTML, 48 half-hour slots per queue, 12 queues `1.1` to `6.2`) and, for emergency outages, the PowerOn JSON API. A React 19 + TypeScript simulator under `src/` must stay in logic, UI and text parity with the Android app (`CLAUDE.md`).

**Method.**

| Pass | What was done | Evidence type |
| --- | --- | --- |
| Data and logic layer | Read all Kotlin of the address lookup, parser, repositories, models; skimmed the TypeScript mirrors | Source reading only |
| Alarms, worker, widget | Read `AlarmScheduler`, `AlarmReceiver`, `NotificationHelper`, `AlertRegistry`, `ScheduleSyncWorker`, `BlackoutGlanceWidget`, manifest, Gradle files, backup rules | Source reading only |
| UI | Read Main, Settings, About, navigation, `TimelineBar`, theme, `AppStrings` (see [UI_REPORT](UI_REPORT.md)) | Source reading plus computed contrast |
| Live probing | Direct HTTP requests to `ztoe.com.ua` and to the PowerOn API on 2026-11-12 (section 2) | Live responses |
| Direct manifest check | `AndroidManifest.xml` lines 6 to 13 were read while writing this document | Source reading |

**Severity scale** (shared with the interface review): `HIGH` blocks a task, misleads the user, causes data-loss risk or creates a repeated systemic failure; `MEDIUM` meaningfully harms comprehension, efficiency, adaptability or consistency; `LOW` is isolated polish or hygiene. An asterisk (`MEDIUM*`, `LOW*`) means the source report listed the item without a severity and the class was assigned in this document for grouping.

**Finding IDs.** `C1` to `C22` are the IDs of the approved plan (section 3.1 of the plan). Items from the three exploration reports that the plan table omitted are numbered `A-H1`, `A-M1`..., `A-L1`... in section 8. The original report IDs (`H1`..`H7`, `M1`..`M11` of the alarms report) are kept in the mapping below.

| Plan ID | Alarms report | Data report | Topic |
| --- | --- | --- | --- |
| C1 | H4 | High 1 | Failure treated as "no outage", false "restored" push |
| C2 | H1 | High 4 | Failure wipes schedule cache, alarms cancelled |
| C3 | M6 | High 2 | Emergency outages never expire |
| C4 | H3 | n/a | Scheduler and receiver validate different slot sets |
| C5 | H2 | n/a | Only today's blocks scheduled |
| C6 | H5 | High 3 | Demo emergency and fake house lists in production |
| C7 | n/a | High 5 | Substring name matching |
| C8 | n/a | section 4 | Duplicate streets |
| C9 | n/a | Medium (StackOverflow) and section 1 | PowerOn fetch per whole REM, regex JSON |
| C10 | H6 | n/a | `USE_EXACT_ALARM` and no exact-alarm gate |
| C11 | M1 | High 6 | Worker lost update |
| C12 | H7 | n/a | Release falls back to the debug key (reported only) |
| C13 | M2, M3 | n/a | Receiver order, static "через N хв" |
| C14 | M7 | n/a | Widget prefers persisted values |
| C15 | M8, M9 | n/a | Exported receivers, backup rules |
| C16 | n/a | Medium | Performance and thread-safety group |
| C17 | n/a | Medium and section 3 | Refresh presets, conflated failure states |
| C18 | M4 | section 2 | Notification permission, vibration, channels |
| C19 | n/a | section 6 | Kotlin/TS parity gaps |
| C20 | Low | Low | Dead code, swallowed exceptions, static data errors |
| C21 | H2 (partly) | section 7 | Midnight and Tomorrow |
| C22 | M9 (partly) | n/a | Privacy policy omits the PowerOn host |

**Abbreviations used for file references.** All paths are under `android/app/src/main/java/ua/blackout/prewarning/` unless stated. `ZAL` = `data/parser/ZtoeAddressLookup.kt`, `ZP` = `data/parser/ZtoeParser.kt`, `SR` = `data/repository/ScheduleRepository.kt`, `SetR` = `data/repository/SettingsRepository.kt`, `SS` = `ui/screens/SettingsScreen.kt`, `NAV` = `ui/screens/BlackoutAppNavigation.kt`. `file:line` references are reproduced exactly as given by the exploration passes; they were not re-validated line by line against the working tree.

**Not verified (no runtime evidence).** Behaviour on a device or emulator; Doze and exact-alarm delivery; `DATE_CHANGED`/`TIME_SET` delivery to the manifest receiver on API 26+ (the alarms report says "verify"); whether PowerOn ever returns closed outages (the query has no date filter and the history endpoints are empty); notification channel behaviour; the widget.

## 2. Verified facts about ztoe.com.ua and PowerOn

Source: live probes of both sites on 2026-11-12 (plan section 2). The samples gathered during the probes (a ZTOE page of about 480 KB and a `pw_accidents` sample of about 21.5 KB) were kept only in a temporary session folder; trimmed versions are planned as fixtures in `spec/fixtures/` and `src/test/resources/` (plan phases 0b and 1).

### 2.1 ztoe.com.ua/unhooking-search.php

| Fact | Detail |
| --- | --- |
| Encoding and size | Windows-1251. The form page is about 11 KB gzip; with the schedule tables present the page is about 480 KB HTML |
| Tables | Two `<table x:str>` blocks: today (`12.11.2026` at probe time) and tomorrow (`13.11.2026`) |
| Rows | 12 queue rows per table with `rowspan` quirks: row `1.2` has 50 cells, row `1.1` has 51 |
| Outage cell | Red cell is `background: #ff3333` |
| Address form | POST with `rem_id`, `naspunkt_id`, `vulica_id`, `all=1` |
| Size of the city list | Zhytomyr city = 967 streets in the live probe (the code comment at `ZAL:1145` and the UI report say 966; see section 16) |
| Banner | A paragraph "УВАГА! ВАЖЛИВА ІНФОРМАЦІЯ… по команді НЕК" sits above the tables and must not be mistaken for a table |
| Tomorrow's table | Published by ztoe in the evening (owner's note, plan section 10); before that, only today's table exists |

### 2.2 PowerOn

`ztoe-poweron.inneti.net` is only a React SPA. The real data is a public JSON API (API Platform) at `https://api-ztoe-poweron.inneti.net/api/...`.

| Fact | Evidence | Consequence |
| --- | --- | --- |
| `pw_accidents` has 12 385 rows region-wide, 30 per page by default | `hydra:totalItems` | Never read page 1 only. `pagination=false` works (verified) |
| Only `city.id`, `street.id`, `otg.id`, `typeOff`, `switchSubReason` filter (arrays: `street.id[]=a&street.id[]=b`). `city=`, `street=`, `otg=`, `code_otg=` are silently ignored and return everything | Probe | Always use the dotted names |
| `switchSubReason=2` rows are mirrors of the hourly schedule (`koment` `3,1`); `0` = real emergency (`koment` `МО`); 1 and 3 currently empty | 3 789 non-GPV rows | Emergency = `switchSubReason != 2` (as today) |
| Timestamps are Kyiv wall-clock labelled `+00:00` | See 2.3 | Strip the offset, interpret as `Europe/Kyiv` (existing code already does; keep and test) |
| Some non-GPV rows have `dateEvent` days in the future (up to 17 Nov) | Min/max scan | Treat as UPCOMING only when the start date is today or tomorrow, otherwise ignore |
| `pw_accident_histories` and `pw_accident_planed_histories` are empty | Probe | No server-side history. "Finished emergencies today" must come from a local ledger |
| `pw_accident_planeds` (`typeOff=3`, repair works 08:00 to 17:00) filters by `city.id`, `street.id`, `otg.id`, `datePlanIn[after]` | `hydra:search` | A per-street query is about 1 KB |
| PowerOn REM ids differ from ztoe `rem_id` (Житомирський = 6 versus 7) | `pw_otgs` | Keep the static mapping `ztoeOtgId` |
| `pw_cities?name=<exact>` and `pw_cities?otg.id=` exist; `pw_streets?city.id=` (Zhytomyr: 997 streets, 140 KB) | Probe | Resolve the city by exact name plus REM, streets by canonical key, cache the ids |
| Both sites contain real duplicate streets | Probe | See section 6: merge and keep all ids, because accident rows may hang on either id |

**What the app does with PowerOn today.** It requests `pw_accidents?switchSubReason[]=0&switchSubReason[]=1&switchSubReason[]=3&otg.id=N&pagination=false` (a whole REM, 340 to 915 KB, 5 s timeout) and parses the body with regular expressions and a hand-written JSON scanner (`ZAL:1895-1911`, `ZAL:60`, `ZAL:1970-2059`).

### 2.3 The "timestamps are Kyiv wall-clock labelled +00:00" finding

- **Observation 1.** Queue 3.1 is off 22:00 to 24:00 on the ztoe table. Its mirror row in `pw_accidents` (`switchSubReason=2`) reads 22:04 to 00:04 `+00:00`. If the offset were honoured, the row would be 22:04 UTC, that is 00:04 or 01:04 Kyiv time, which contradicts the ztoe table. Read as local time it matches.
- **Observation 2.** Repair works from `pw_accident_planeds` read 08:00 to 17:00. Honouring `+00:00` would put them at 10:00 to 19:00 or 11:00 to 20:00 Kyiv time, a less plausible repair window than 08:00 to 17:00 local (an inference from the plan's evidence, not a separate probe).
- **Conclusion.** The API labels Kyiv local time with `+00:00`. The client must strip the offset and interpret the value as `Europe/Kyiv`. A default `ISO8601DateFormatter` (iOS) or any parser that applies the offset would be 2 to 3 hours wrong.
- **Existing code.** `formatZtoeOutageTimestamp` (`ZAL:1201-1213`) already drops the offset. The existing test asserts that `+00:00` becomes `23:28` (`ZtoeParserTest:1080,1094`); the data report asked for confirmation that this is intended, and the probe above confirms it. A new vector must pin it (plan section 8, test list).
- **Decision recorded** (plan section 5.4, decision 4): time model is absolute instants in `Europe/Kyiv`; the quirk is written into `POWERON_API.md` with vectors.

## 3. Architecture map of the data flow

**Flow.** The "?" dialog in `SS:809-952` drives these calls in order:

1. `ZAL.fetchRemsFromZtoe` (`ZAL:708`).
2. `fetchSettlementsForRem` (`ZAL:955`).
3. `fetchStreetsForSettlement` (`ZAL:982`), a bulk fetch that also indexes every house.
4. `fetchHousesForStreet` (`ZAL:1042`).
5. `checkAddressOnZtoeWebsite` (`ZAL:2168`), which returns queue, `statusText` and `emergencyOutage`.

After that, `NAV:812-868` (`onAddressQueueResolved`) calls `SetR.saveSettings`. It writes `selected_rem/settlement/street/house`, `queue` or `custom_queue_status_text`, and `active_emergency_outage_*`.

Planned slots come from `ZP.fetchFullSchedule(cityUrl, queue)` (`ZP:110`). That call batch-saves all 12 queues into `SR`. The UI and widgets then overlay the emergency outage with `SR.applyEmergencyOutageToSlots` (`NAV:186-203`, widget `BlackoutGlanceWidget.kt:152-160`, `AlarmScheduler.kt:55-62`).

Consumers: Compose UI (`ui/screens`, 1 s lifecycle ticker), `AlarmScheduler`/`AlarmReceiver` (RTC_WAKEUP, one alert per contiguous block, deduplicated by `AlertRegistry`), `BlackoutGlanceWidget`, and `ScheduleSyncWorker` (WorkManager) for periodic refresh; `BootCompletedReceiver` reschedules after reboot.

**HTTP requests.**

| Request | Where | Details |
| --- | --- | --- |
| `POST https://www.ztoe.com.ua/unhooking-search.php` | `ZAL:640-672` | Must pass the `isValidUrl` whitelist. Form body is `""` (REM list), `rem_id=N`, `rem_id&naspunkt_id&all=1` (bulk, `ZAL:1015`), or `rem_id&naspunkt_id&vulica_id` (`ZAL:1079`). Headers: form content type and UA `Mozilla/5.0 (Android; ZTBlackoutPreWarning)`. Timeouts 8000/8000. Decoding tries windows-1251 and sniffs for "Оберіть/Черга/Будинки", else UTF-8 |
| Same POST, duplicated inline | `ZAL:2186-2207` | Timeouts 7000/7000 and a different charset sniff |
| `GET <cityUrl>` | `ZP:408-455` | Chrome UA and `Accept-Encoding: gzip`. `If-None-Match` and `If-Modified-Since` are sent only when today's and tomorrow's cache are both valid. Timeouts 8000/8000. Charset from the content type, else windows-1251. Parsed with Jsoup |
| `GET https://api-ztoe-poweron.inneti.net/api/pw_accidents?...&otg.id=N&pagination=false` | `ZAL:1895-1911` | Scope is `otg.id=N`, else `city.id=N`, else none (region-wide). `Accept: application/ld+json, application/json`. Timeouts 5000/5000. The body is accepted if it contains `hydra:member` or starts with `[` |

**Caches.**

- Memory in `ZAL` (`ZAL:82-103`): `cachedRems`, `cachedSettlementsByRem`, `cachedStreetsBySettlement`, `cachedHousesByStreet`, `houseCacheUpdatedAtByStreet`, `accidentsCacheByScope` (60 s TTL), `settlementFetchLocks`, `recentHouseStreetOrder`.
- Memory in `ZP`: `cachedDoc` (20 s, keyed by URL and date, `ZP:77-89`).
- Memory in `SR` (`SR:66-67`): `decodedSlotsCache` and `detailedIntervalsCache`, each cleared when it exceeds 64 entries.
- SharedPreferences `zt_address_index_cache_v1`, key `address_index_json_v1`: REMs, settlements and streets in full, houses for at most 50 streets. Emergency outages are not persisted there.
- SharedPreferences `zt_schedule_cache_v2`: `cache_today_date[_q]`, `cache_today_queue`, `cache_today_slots_<q>` (a 48-character string of 0/1), `cache_tomorrow_*_<q>`, `cache_has_tomorrow_<q>`, `cache_last_sync_ms`, `ztoe_last_etag`.
- SharedPreferences `zt_user_settings_v1` (settings) and `zt_notified_blackouts_v1` (`AlertRegistry`, capped at 100 entries and 7 days).

**Ids and matching between the two sites.**

- ZTOE ids: `ztoeRemId` is sent as `rem_id`, `ztoeNaspunktId` as `naspunkt_id`, `ztoeVulicaId` as `vulica_id`.
- `ztoeOtgId` is the PowerOn `otg.id`. It exists only as static data per REM (`ZAL:355-375`). An unknown REM gets no `otg.id`.
- `poweronCityId` exists only for `zt_city` (333, `ZAL:383`). `poweronStreetId` exists for about 12 Zhytomyr streets (`ZAL:410-421`) and is only a shortcut when matching.
- Everything else is matched by name with `normalizeUkText` (`ZAL:1423`), which strips prefixes, parentheses and punctuation. Matching is `==` or `contains` in either direction (`ZAL:1761-1765`, `1993-1995`, `2004`, `2040-2043`, `2056-2059`).
- Houses are matched with `normalizeHouseNumber` (`ZAL:1435`).

**Planned target architecture** (plan section 5.1 and 5.4, not yet built): pure `core/` package with an injectable clock (`OutageEngine`, `StreetKey`, PowerOn parser, site-state mapper, `AlertPlanner`); `PowerOnClient` with `org.json` and per-address calls; `EmergencyLedger`; `SiteState` and `ConnectivityProbe`; thin adapters for HTTP, preferences, `AlarmManager` and Glance; mirrored in `src/core/`.

## 4. Emergency model

**Model.**

- Class `EmergencyOutageInfo(id, remName?, settlementName?, streetName?, house?, outageType, startTime, estimatedRestoreTime)` (`Models.kt:8-17`). Times are strings in `dd.MM.yyyy HH:mm`; the short form `dd.MM HH:mm` is also accepted. The TypeScript type has 4 fields instead of 8.
- There is exactly ONE outage in the app: `UserSettings.activeEmergencyOutage` (`Models.kt:77`) and `ZtoeHouseLookupResult.emergencyOutage`.
- With several PowerOn rows for one house, the best row wins by priority score (4 beats 3), then by the latest `datePlanIn` string (`ZAL:1802`, `2087`). A row with `switchSubReason` 2 (a scheduled outage) scores below 3 and is dropped.

**Fetch.**

- `fetchPwAccidentsForScope` (`ZAL:1872`).
- `applyAccidentsToSettlementHouses` (`ZAL:1710`) stamps outages onto cached houses.
- `matchEmergencyOutageFromAccidentsJson` (`ZAL:1928-2099`) picks the outage for one address.
- `checkEmergencyOutageOnZtoe` (`ZAL:2101`) tries three sources in order: an HTML table, the live PowerOn API, then a local cache fallback (`ZAL:2140-2142`).

**Validation.** `isValidEmergencyOutage` (`ZAL:1228`) is format-only: the type must contain аварійн, emergency, гав or сгав, and both timestamps must match `VALID_OUTAGE_TIMESTAMP_REGEX`, a permissive `containsMatchIn` (`ZAL:66`, `1225`). There is no check against the current time anywhere.

**Overlay.** `SR.applyEmergencyOutageToSlots` (`SR:130-225`) marks 30-minute slots as `POWER_OFF` with `isEmergency=true`. It builds an empty 48-slot day if `slots` is empty (`SR:188-212`). Midnight spanning is handled for outages with a known date: the start day gets `start..1440`, the end day gets `0..end`, days in between get the full day (`SR:157-165`).

**Persistence.** `SetR:222-225` stores only `id`, `type`, `start` and `restore`. On read, `SetR:159-187` revalidates the outage and removes the keys if it is invalid. It does not expire by time.

**Re-verification triggers.**

- App start and whenever queue, `siteUrl` or `selectedAddressQuery` changes (`NAV:410-453`).
- Each time the main screen becomes visible after the first fetch (`NAV:222-262`).
- Manual refresh (`NAV:501-543`), which always overwrites the stored outage.
- After the user applies an address (`NAV:846-862`).
- `ScheduleSyncWorker` (`worker/ScheduleSyncWorker.kt:36-70`), which runs at least every 15 minutes (`:116`) and only with a network connection.

**Clearing.**

- `NAV:779-795`: choosing a queue manually sets the outage to null.
- `SetR:173-187`: removed only if invalid.
- Any refresh where the lookup returns a non-null result with `emergencyOutage == null`.
- Nothing drops past or finished outages. They disappear only when the API stops listing them, or on process death (the in-memory house cache is not persisted).

**Planned replacement** (plan section 5.1 and 5.3): PowerOn becomes the only emergency source (the year-less `dd.MM HH:mm` parsing and the ztoe HTML emergency-table path with row-index ids are retired); outages are modelled as absolute instants with status `FINISHED`, `ACTIVE`, `UPCOMING`, `OVERDUE`; an emergency whose estimated restore passed more than 60 minutes ago while still listed becomes `OVERDUE` (treated as active) until the grace expires, then finished and stale (no alerts, dimmed row); `EmergencyLedger` records first seen, last seen and `closedAt` per address and day (pruned after 2 days) because PowerOn history is empty.

## 5. Website-state handling

`FetchStatus` has three values, `SUCCESS`, `NO_INTERNET`, `NO_QUEUES_FOUND` (`ZP:19-23`). The result is `ScheduleFetchResult(todaySlots, tomorrowSlots, hasTomorrowSchedule, status)`.

| Scenario | Today's result | Reference |
| --- | --- | --- |
| Success with a table | `SUCCESS`; a missing tomorrow table only sets `hasTomorrowSchedule=false` | `ZP` |
| Page reachable, no today table, or the queue row is missing | `NO_QUEUES_FOUND` | `ZP:174-182`, `312-346` |
| Invalid or non-whitelisted URL | `NO_QUEUES_FOUND` | `ZP:126-134` |
| Blank queue | `SUCCESS` with empty slots (TypeScript returns `NO_QUEUES_FOUND`) | `ZP:195-202`; `ztoeParser.ts:423-438` |
| HTTP non-2xx | Thrown as `IOException("HTTP n")`, therefore `NO_INTERNET` | `ZP:431-433` |
| `UnknownHost`, `Connect`, `SocketTimeout` and any `IOException` | `NO_INTERNET` | `ZP:209-240` |
| Other exceptions (including parse errors) | `NO_QUEUES_FOUND` | `ZP:241-249` |

Consequences:

- **No "no internet" versus "site down" distinction.** There is no `ConnectivityManager` anywhere in the app. A site returning 500 and a device in airplane mode both give `NO_INTERNET`. (`ACCESS_NETWORK_STATE` is already declared in the manifest, line 7, checked directly.)
- **Every non-success path wipes the whole schedule cache.** `ZP:127,175,206,210-242` call `clearScheduleCache()`, which is `prefs.edit().clear()` (`SR:557`). The worker (`worker/ScheduleSyncWorker.kt:83`), `NAV:482,589` and the widget (`BlackoutGlanceWidget.kt:431,434,837,844`) do the same. See C2.
- **What the UI sees.** Only empty slots, rendered as "unclear". `FetchStatus` reaches the user only as a banner on manual refresh (`NAV:581-602`) and in the settings URL check (`SS:125-143`, `300`, `341`).
- **PowerOn has no state at all.** `fetchPwAccidentsForScope` returns `String?`; null means any failure and is treated as "no outage". The same applies to `postZtoeForm`, which returns null on any error (`ZAL:667-669`). See C1.
- **TypeScript** has a `navigator.onLine` pre-check, no ETag or document cache, and treats parse errors as `NO_INTERNET`; Kotlin treats other exceptions as `NO_QUEUES_FOUND`.

**Planned replacement** (plan section 5.1): `SiteState` = `AVAILABLE_WITH_TABLE`, `AVAILABLE_NO_TABLE`, `SITE_UNREACHABLE`, `NO_INTERNET`.

| State | Detection |
| --- | --- |
| `NO_INTERNET` | `NetworkCapabilities` without `NET_CAPABILITY_VALIDATED` (system-verified, no third-party request, privacy policy unchanged) |
| `SITE_UNREACHABLE` | Validated network, but DNS failure, timeout or 5xx |
| `AVAILABLE_NO_TABLE` | HTTP 200 with no today table, or a page without queue rows |
| `AVAILABLE_WITH_TABLE` | Today's table present |

The state is hoisted to the UI and persisted with `lastSuccess`. A failure never clears the cache; the cache is valid only if its date stamp is today (already stored) and is shown as stale with "дані за HH:mm". PowerOn gets its own small status line ("Аварійні: недоступні"). Decision (plan section 1): with a site outage, keep today's cached schedule and mark it stale; show the grey "unclear" state only when there is no valid cache for today.

## 6. Duplicate streets: root cause and proposed canonical key

### 6.1 Where street lists are built

- Live parse: `parseZtoeStreetOptionsHtml` (`ZAL:773-809`).
- Static data: `ZTOE_STREETS` (`ZAL:409-449`).
- Cache assignment: `cachedStreetsBySettlement[settlementId] = liveList` (`ZAL:1030`, `2219`).
- Disk hydration: `ZAL:265-285`.
- Read path: `getStreetsForSettlement` (`ZAL:481-483`).

The UI renders `streetsList.forEach` raw, with no dedup (`SS:1224`).

### 6.2 How duplicates arise

1. **Dedup is only by option id.** `seenIds` tracks ids, not names (`ZAL:777,786-806`):

   ```kotlin
   val candidateExisting = existingForSettlement.firstOrNull { normalizeUkText(it.nameUk) == normalizeUkText(label) } ?: ...ztoeVulicaId == vulId
   val matchedExisting = if (candidateExisting != null && !seenIds.contains(candidateExisting.id)) candidateExisting else null
   ... else { val id = "st_$vulId"; if (seenIds.add(id)) parsed.add(...)
   ```

   A second `<option>` with the same name but a different `vulica_id` falls through to `st_<id>` and is shown twice. This probably happens upstream (the Zhytomyr bulk response lists 966 streets, comment at `ZAL:1145`).
2. **The static list itself has a duplicate.** `ZAL:417-418` has `zt_bandery` and `st_173952`, both vulId 173952 with the same name. Whenever `getStreetsForSettlement("zt_city")` falls back to static data (no cache, offline), "вул. Степана Бандери" appears twice. The TypeScript static list has one entry (`ztoeAddressLookup.ts:125`).
3. **Normalisation gaps.**
   - `stripHtmlFast` (`ZAL:109-119`) decodes only `&amp;`, `&nbsp;`, `&quot;` and the apostrophe entities. It does not decode `&rsquo;`, `&lsquo;`, `&lt;`, `&gt;`, `&#8216;`.
   - `normalizeUkText` turns `'` into a space and ignores U+2018 and U+00B4.
   - The synthetic `st_` ids are never deduplicated by name, so those variants each survive.
4. **Disk cache does not deduplicate.** The hydration loop (`ZAL:265-285`) adds every stored street to `grouped`. Serialisation writes flat lists (`ZAL:178-196`), so a duplicate persists forever. A fresh fetch replaces the list rather than appending.
5. **Houses follow names, not ids.** `parseZtoeSettlementHousesTableHtml` maps houses by normalised name to every street id with that name (`ZAL:906-923`). It also adds static streets that are not in the live list (`ZAL:855-858`). This pollutes `cachedHousesByStreet`, and the 50-street persist cap then evicts useful lists.
6. **`checkAddressOnZtoeWebsite` can replace the whole cached list.** At `ZAL:2216-2221` it overwrites the settlement's street list from a per-street response when the selected street has a blank name. That can shrink the list.

### 6.3 The real duplicate pairs found in the live data (2026-11-12)

Total: 3 ZTOE pairs and 5 PowerOn pairs, 8 in all (the plan's test list requires all 8 to merge into one option each). The sources do not record which id belongs to which spelling variant, and for several pairs they do not record the exact character difference; the last column states only what the sources say.

| Site | Street (as given in the sources) | Ids | Variant recorded in the sources |
| --- | --- | --- | --- |
| ZTOE | `В'ячеслава` and `В’ячеслава` | 176316 and 174295 | Apostrophe U+0027 versus U+2019 (shown in the plan) |
| ZTOE | `Закам'янська` | 174537 and 174536 | Not recorded (two ids for one street name) |
| ZTOE | `С.П. Корольова` and `С.П.Корольова` | 176383 and 176334 | Space after the dots (shown in the plan) |
| PowerOn | `Житній Базар` and `Житній базар` | 33798 and 34709 | Letter case |
| PowerOn | `Закам’янська` | 33382 and 33565 | Not recorded (two ids for one street name) |
| PowerOn | `В’ячеслава Липинського` | 33970 and 35135 | Not recorded (two ids for one street name) |
| PowerOn | `майдан С.П.Корольова` | 5650 and 6236 | Not recorded (two ids for one street name) |
| PowerOn | `пров. Єлизавети Епштейн` | 33651 and 33652 | One of the two names has a trailing space |

Note on the PowerOn rows: the plan (section 2) says only that the PowerOn list contains "the same plus `Житній Базар` versus `Житній базар` and a trailing space"; the pair list above follows the review brief and is more detailed than the plan text (see section 16).

Both sites contain such pairs, so accident rows may be attached to either id. Hence the merge must keep every id.

### 6.4 Proposed fix (data report section 4 and plan section 5.2)

Canonical key, built in `data/address/StreetKey.kt`:

```text
key = settlementId + "|" + canonStreet(name)
```

`canonStreet` (plan wording, which extends the data report's):

1. Decode all HTML entities.
2. Lower-case.
3. Unify the apostrophes U+0027, U+2019, U+02BC, U+2018, U+00B4 and the backtick (the data report then drops the apostrophe).
4. Trim and collapse whitespace.
5. Remove spaces after dots (`С.П. Корольова` equals `С.П.Корольова`).
6. Normalise street-type tokens while keeping the type: `вулиця`/`вул.` to one token, `провулок`/`пров.`, `проспект`/`просп.`, `бульвар`/`б-р`, `площа`/`пл.`, `шосе`, `проїзд`/`пр-д`.
7. Do not drop parenthesised qualifiers from the key unless the owner decides they are cosmetic (data report).

Merge rules:

- One `ZtoeStreetOption` per key, holding all ids: `vulicaIds[]` (data report: `alternateVulicaIds`, prefer the static id) and `poweronStreetIds[]`; houses are the union; PowerOn queries use every id; per-street ztoe fetches loop over all `vulica_id` values and union the houses (the bulk index is already merged by name).
- Keep the first display name.
- Apply the key in three places: the `parseZtoeStreetOptionsHtml` output, `hydrateCacheFromJson` (so a disk cache with duplicates heals on read), and the `getStreetsForSettlement` fallback.
- Delete the static `st_173952` entry; correct or drop static ids that disagree with their names (`lb_soborna`, `zt_глибочиця`, placeholder ids 41001 to 113001).
- Tests: two options of the same name; a hydrate round trip; the 8 real pairs above.
- Candidate follow-up (not in this release, plan decision 10): a scheduled GitHub Action publishes one deduplicated address index (REM, city, street with all ZTOE and PowerOn ids) as static JSON like `donations.json`, so no client has to scrape 967-street lists.

## 7. Findings C1 to C22 (expanded)

Summary (the plan table):

| ID | Sev | Finding | Plan phase |
| --- | --- | --- | --- |
| C1 | HIGH | Any ztoe/PowerOn failure becomes "no outage": false "power restored" push, real restore suppressed | 1 and 2 |
| C2 | HIGH | Every failure path wipes the schedule cache; next `syncAlarms` cancels all alarms | 1 |
| C3 | HIGH | Emergency outages never expire; finished ones keep notifying and painting | 1 |
| C4 | HIGH | Scheduler validates overlaid slots, receiver validates base slots | 2 |
| C5 | HIGH | Only today's blocks scheduled; no pre-warning shortly after 00:00 | 2 |
| C6 | HIGH | Demo emergency and fake house lists on the production path | 1 |
| C7 | HIGH | `contains` in both directions for city and street names | 1 |
| C8 | HIGH | Duplicate streets | 1 and 3 |
| C9 | HIGH | PowerOn fetch per whole REM with hand-rolled JSON and regex | 1 |
| C10 | HIGH | `USE_EXACT_ALARM` declared, no exact-alarm gate | 2 and 3 |
| C11 | HIGH | Worker lost update of settings | 2 |
| C12 | HIGH (release) | Release can silently fall back to the debug key (reported only) | none (owner) |
| C21 | HIGH | Midnight and Tomorrow | 1 and 3 |
| C13 | MEDIUM | Receiver redraws widgets before notifying; static "через N хв" | 2 |
| C14 | MEDIUM | Widget prefers persisted values over live ones | 3 |
| C15 | MEDIUM | Exported receivers; backup rules include caches | 2 |
| C16 | MEDIUM | Performance and thread-safety group | 1 |
| C17 | MEDIUM | Refresh presets below the 15 min floor; conflated failure states | 1 and 3 |
| C18 | MEDIUM | Notification permission, vibration, shared channels | 2 |
| C19 | MEDIUM | Kotlin/TypeScript parity gaps | 4 |
| C22 | MEDIUM | Privacy policy omits the PowerOn host | 6 |
| C20 | LOW | Dead code, swallowed exceptions, static data errors, hygiene | 1, 2 and 6 |

### C1 (HIGH). A failed fetch is treated as "no outage": false "restored" push, real restore silenced

- **Where.** `ZAL:1921-1925`, `ZAL:2133-2142`; `ScheduleSyncWorker.kt:38-70`; `NAV:247-262`, `NAV:517-541`; `NotificationHelper.kt:156-175`.
- **What happens.** `fetchPwAccidentsForScope` returns `String?` and null means any failure; `checkEmergencyOutageOnZtoe` returns null on failure (`ZAL:2127-2142`); `postZtoeForm` returns null on any error (`ZAL:667-669`). The worker, `NAV:247-262` and `NAV:517-541` then clear the stored outage. `NotificationHelper` sees `prev != null && next == null` and fires "Emergency outage completed/restored" with key `emergency_restore_{id}_{start}` (`:157`). That key is now spent, so the real restore later is silent. The disk cache does not persist `emergencyOutage` (serialised `ZAL:198-219`, hydrated `ZAL:287-309`), so after the process dies the local fallback is empty too. Manual refresh (`NAV:501-543`) always overwrites the stored outage. A cancelled outage is indistinguishable from a restored one.
- **Impact.** A short network or PowerOn glitch produces a wrong "power is back" notification, and the genuine one never arrives.
- **Fix.** Tri-state result `Found`, `NoneConfirmed`, `Unavailable(reason)` (plan section 5.1); keep the previous outage on `Unavailable`; move active to none only after a confirmed successful fetch that no longer lists the outage (the alarms report suggests ideally two), or after grace expiry; `EmergencyLedger` holds the transitions; `end` event covers restored and cancelled.
- **Phase.** 1 (client, ledger), 2 (notifications).

### C2 (HIGH). Every failure path wipes the whole schedule cache; the next sync cancels all alarms

- **Where.** `ZP:174-249` (specifically `127,175,206,210-242`); `SR:557` (also `557-559`); `ScheduleSyncWorker.kt:78-84`; `AlarmScheduler.kt:82-92`; `NAV:478-497`, `NAV:585-589`; `BlackoutGlanceWidget.kt:431-435`, `837-847`.
- **What happens.** Offline, site down, missing today's table, invalid URL and parse exceptions all end in `clearScheduleCache()`, which is `prefs.edit().clear()` and also removes the ETag. `parseAllQueuesSinglePass` returns empty when today's table is missing (`ZP:292`), giving `NO_QUEUES_FOUND`. The next `syncAlarms` finds no slots and cancels tracked alarms outside the window (`AlarmScheduler.kt:82-92`). The worker's `CONNECTED` constraint does not help when the network is up but ztoe is unreachable. The UI sets `baseSlots = emptyList()` and shows "Невідомо" / "Графіки не діють"; `lastUpdated` is stamped even on failure (`NAV:486-488`, `582-584`).
- **Impact.** A short ztoe outage silences every pre-warning and blanks the app although a valid schedule for today was cached.
- **Fix.** Never clear on failure; keep the ETag; `getTodaySlots` already validates the date (`SR:561-574`), so the cache is valid only when its date stamp is today; show it as stale with "дані за HH:mm"; stamp `lastUpdated` on success only; split the failure branches in `ZP`.
- **Phase.** 1.

### C3 (HIGH). Emergency outages never expire

- **Where.** `SR:130-225` (same-day overlay at `SR:147-156`, multi-day branch `SR:162`); `NotificationHelper.kt:178-201`; `SetR:159-187`; `ZAL:1228-1240`, `ZAL:1827-1853`, `ZAL:2140-2142`, `ZAL:1096-1107`; `ScheduleSyncWorker.kt:39`; `MainScreen.kt:93-94`, `242`.
- **What happens.**
  - `isValidEmergencyOutage` checks the type string and the timestamp regex; the restore time is never compared with now.
  - `applyAccidentsToSettlementHouses` only adds or overwrites; the local-cache fallback (`ZAL:2140-2142`) re-serves old outages; `fetchHousesForStreet` carries outages over.
  - `SR:147-156` paints a same-day outage onto Today even if its date is yesterday (a stale same-day record from yesterday paints 22:00 to 23:59 today as "!"); the branch `!isTomorrow && targetDate < endDate` (`SR:162`) paints a future multi-day outage onto today.
  - `checkAndTriggerEmergencyOutageAlert` (`NotificationHelper.kt:178-201`) fires "detected" for any non-null outage, even if `estimatedRestoreTime` has passed. The `MainScreen` banner shows whenever both timestamps match the regex.
  - If the lookup returns null (house not found), the worker never clears the outage (`ScheduleSyncWorker.kt:39`).
  - The scheduler would create alarms for ghost blocks; they are dead today because of C4.
- **Related facts.** PowerOn rows can have `dateEvent` days in the future (up to 17 Nov at probe time) and the history endpoints are empty (section 2.2). Whether PowerOn returns closed outages is unknown; the query has no date filter (`ZAL:1895-1900`) and the client has no filter either.
- **Fix.** `OutageEngine` with statuses `FINISHED`, `ACTIVE`, `UPCOMING`, `OVERDUE` (60 minute grace); require the start date to be today or tomorrow; drop the cache fallback; clear per-house outages on each apply; `EmergencyLedger`; call one shared rule from `AlarmScheduler`, `AlarmReceiver`, `NotificationHelper`, `SetR.getSettings`, the `MainScreen` list and the widgets. An outage past its estimated restore but still listed may be a real overdue outage and is a separate state, not discarded.
- **Phase.** 1.

### C4 (HIGH). Scheduler and receiver validate different slot sets

- **Where.** `AlarmScheduler.kt:55-63` versus `AlarmReceiver.kt:57-59`.
- **What happens.** The scheduler builds blocks from slots overlaid with the emergency outage; the receiver checks that the interval exists in today's base intervals. A planned block merged with an emergency block has a different time span, so the receiver drops the planned pre-warning silently. Emergency-only blocks produce alarms that the receiver always rejects (dead alarms).
- **Fix.** One shared function (`effectiveIntervals(settings)` in the alarms report, `AlertPlanner` using the engine in the plan) used by both; a planned plus emergency overlap keeps the planned alert (test in plan section 8).
- **Phase.** 2.

### C5 (HIGH). Only today's blocks are scheduled

- **Where.** `AlarmScheduler.kt:55`, `164-177`; `AlarmReceiver.kt:29-31`.
- **What happens.** Blocks starting within the notice window after 00:00 are never scheduled because tomorrow's schedule is not read. The 24:00 widget alarm only resyncs widgets (`AlarmReceiver.kt:29-31`), not alarms.
- **Fix.** Schedule today and tomorrow; add a 00:00:05 alarm that calls `syncAlarms` (plan: "midnight re-sync alarm"). Must be done together with the span merge of C21, otherwise a 00:00 continuation block gets a second alert.
- **Phase.** 2.

### C6 (HIGH). Demo emergency and fake house lists on the production path

- **Where.** `ZAL:451-475`, `499`, `576-596`, `818-830`, `2140-2142`; also `ZAL:1828` and `ZAL:2227-2235`.
- **What happens.** `getKyivska37DemoEmergencyOutage` is the default for house 37 on вул. Київська (`ZAL:499`) with today's 22:00 to 23:59 and is forced back by `applyCanonicalStreetOverrides` (`ZAL:818-830`). The fallback at `ZAL:2140-2142` returns it when PowerOn has no match, so a real user at Київська 37 gets a fake emergency push every day. The `else` default house list (`ZAL:576-585`) is returned by `getHousesForStreet` (`ZAL:596`) and written to the cache by the accident apply (`ZAL:1828`).
- **Fix.** Remove the demo and default lists from the production path (owner decision: keep a fixture in tests and the simulator only). See also `A-H1` for the "CRITICAL SAFEGUARD" at `ZAL:2227-2235`.
- **Phase.** 1.

### C7 (HIGH). Substring matching of names in both directions

- **Where.** `ZAL:1761-1765`, `1993-1995`, `2004`, `2040-2043`, `2056-2059`.
- **What happens.** City and street names are normalised by `normalizeUkText` (which strips prefixes, parentheses and punctuation) and then compared with `==` or `contains` in either direction. Example: "шевченка" matches "тараса шевченка". This gives false emergencies and false notifications.
- **Parity.** TypeScript uses strict equality plus a bare-name fallback when one side has no street-type prefix (`ztoeAddressLookup.ts:900-908`, `1136`).
- **Fix.** Require equality of the normalised name, or equality of the bare name after stripping the street type.
- **Phase.** 1.

### C8 (HIGH). Duplicate streets

Full analysis in section 6. Summary: dedup is by option id only; the static list holds `zt_bandery` and `st_173952` twice (`ZAL:417-418`); apostrophe, case and space variants survive; entities are not fully decoded (`ZAL:109-119`); the disk cache re-hydrates duplicates (`ZAL:265-285`); houses fan out by name to every same-named id (`ZAL:906-923`); lists parsed at `ZAL:777-806`. Fix: `StreetKey`, merged options holding all ids. Phase 1 (key) and 3 (picker).

### C9 (HIGH). PowerOn fetch per whole REM, hand-rolled JSON and regex

- **Where.** `ZAL:60`, `ZAL:1872-1926`, `ZAL:1970-2059`, catch at `ZAL:2096`.
- **What happens.** The whole REM is downloaded (340 to 915 KB) with a 5 s timeout, and the body is parsed by `PW_ACCIDENTS_PARSE_REGEX` (`ZAL:60`), which uses `(?:\\'|[^'])*` on a potentially large string; the catch at `ZAL:2096` is `Exception`, which does not cover `StackOverflowError`. Any error returns null (see C1).
- **Fix.** `org.json`; per-address calls with dotted filters, for example `pw_accidents?street.id[]=...&switchSubReason[]=0&switchSubReason[]=1&switchSubReason[]=3` and `pw_accident_planeds?street.id[]=...&datePlanIn[after]=<today 00:00>`; `pagination=false`; house match via `buildingNames` split on `,` and `;` with Latin to Cyrillic folding (`16A` equals `16А`, `14/а`); tri-state result; id resolution by exact city name plus REM and canonical street key, ids cached with the address. If a regex is ever kept: `(?:[^'\\]|\\.)*+` (data report).
- **Phase.** 1.

### C10 (HIGH). `USE_EXACT_ALARM` and no exact-alarm gate

- **Where.** `AndroidManifest.xml:10` (lines 9 and 10 declare `SCHEDULE_EXACT_ALARM` and `USE_EXACT_ALARM`, checked directly); `AlarmScheduler.kt:198-214`.
- **What happens.** Google Play restricts `USE_EXACT_ALARM` to alarm-clock and calendar apps. There is no `canScheduleExactAlarms()` check, no rationale UI and no receiver for `ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED`. The scheduler uses `setExactAndAllowWhileIdle(RTC_WAKEUP)`; on `SecurityException` it falls back to `setAndAllowWhileIdle`; any other exception is swallowed.
- **Decision (plan section 1).** Switch to `SCHEDULE_EXACT_ALARM`, drop `USE_EXACT_ALARM`; in-app instruction card and a button opening the system screen (`Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM`); a receiver for the permission-state change re-syncs; existing installs must grant once after the update, and the prompt stays until granted; until then the fallback `setAndAllowWhileIdle` is used.
- **Owner action.** Re-check the Play Console exact-alarm declaration after the change.
- **Phase.** 2 (gate) and 3 (card, banner).

### C11 (HIGH). Worker lost update

- **Where.** `ScheduleSyncWorker.kt:31` (snapshot) and `:69` (whole-object save); the UI does the same with `saveSettings(current.copy(...))`.
- **What happens.** The worker snapshots settings, waits on the network (up to roughly 12 s per the data report, `ZAL:2193` plus `1907`; up to about 40 s worst case per the alarms report), then saves the whole object. Toggles, queue or language changed by the user in that window are reverted.
- **Fix.** Targeted setters, or re-read right before saving.
- **Phase.** 2.

### C12 (HIGH, release). Release can fall back to the debug key (reported only)

Facts in section 14. **Not changed** (owner guardrail): `build.gradle.kts:79-92`; `.github/workflows/build-apk.yml` runs "Publish GitHub Release" on pushes to `main` (see section 16 for a wording difference with `CLAUDE.md`). Owner action: protect that step.

### C21 (HIGH). Midnight and Tomorrow

Full analysis in section 10.

### C13 (MEDIUM). Receiver redraws widgets before notifying; static "через N хв"

- **Where.** `AlarmReceiver.kt:26` versus `:95`, `:70-92`; `BlackoutGlanceWidget.kt:424-437`.
- **What happens.** The receiver calls `syncAllWidgets` first. `provideGlance` can do an 8 s plus network fetch when the cache is missing, so the alert can be delayed past the guard at `AlarmReceiver.kt:75` (start plus 2 minutes) and then be dropped. The body is static Ukrainian text, `"Черга $queue: … через $minutes хв"` (`:91-92`); an alarm delayed by Doze or by the inexact fallback and delivered up to start plus 2 minutes still says "через 15 хв".
- **Fix.** Post the notification first and redraw widgets afterwards; compute remaining minutes at fire time; drop or reword the alert if the outage has already started; move the text to `AppStrings` uk/en.
- **Phase.** 2.

### C14 (MEDIUM). Widget prefers persisted values over live ones

- **Where.** `BlackoutGlanceWidget.kt:480-484`, `:496`.
- **What happens.** `provideContent` prefers persisted blackout-now, countdown and next-slot values whenever `refreshTick>0`; the live `liveInfo` is computed and then ignored. The countdown is only as fresh as the last sync (15 to 30 minutes). The fallback `prefs[KEY_NEXT_BLACKOUT_TEXT]` can show a finished "10:00 – 12:00". If exact alarms fail, "СВІТЛА НЕМАЄ / 00г. 00хв." can linger.
- **Fix.** Always use live-computed values. Phase 3.

### C15 (MEDIUM). Exported receivers and backup rules

- **Where.** `AndroidManifest.xml:65-72` (`WidgetToggleReceiver`), `:51-62` (`BootCompletedReceiver`), `WidgetToggleReceiver.kt:13-19`, `backup_rules.xml`, `data_extraction_rules.xml`.
- **What happens.** `WidgetToggleReceiver` is exported, unused and ignores the action, so any app can disable alerts. `BootCompletedReceiver` is also `exported=true`. The backup rules include all shared preferences: notified flags, the alarm-id set, the schedule cache and the address caches; a restore can suppress alerts and bring back a stale cache. Google backup also uploads the selected home address and emergency state.
- **Fix.** Plan decision: make `WidgetToggleReceiver` non-exported (the alarms report proposed deleting it); verify on the emulator that the boot receiver still fires before touching its `exported`; exclude `zt_notified_blackouts_v1`, `zt_scheduled_alarms_v1`, `zt_schedule_cache_v2`, `zt_address_index_cache_v1` from backup.
- **Phase.** 2. Privacy follow-up in C22.

### C16 (MEDIUM). Performance and thread-safety group

- **Where.** `ZAL:121-128`, `811-816`, `998-1039`, `1423-1457`, `1858-1870`; `SS:861-867`.
- **What happens.**
  - Regexes are compiled in hot loops: `normalizeHouseNumber` builds a `mapOf` and 3 regexes per call (`ZAL:1435-1457`), `normalizeUkText` builds 4 (`ZAL:1423-1433`), `houseSortKey` builds one per comparison (`ZAL:811-816`), parse loops build `Regex("[,;]")` and `Regex("[^0-9]")` per row (`ZAL:890-906`, `1272-1278`).
  - The accidents JSON is re-parsed for every settlement: `applyAccidentsToRemHouses` (`ZAL:1858-1870`) runs per settlement and on every cache hit (`ZAL:1889-1893`).
  - The bulk `all=1` page is fetched with `forceRefresh=true` every time "?" opens (`SS:861-867`), read as bytes, then a String, then `substring` (`ZAL:657-658`, `861`): OOM risk on low-end devices.
  - `recordRecentHouseStreet` does a non-atomic remove, add and `removeAt(size-1)` (`ZAL:121-128`), can throw `IndexOutOfBoundsException`, and the `LaunchedEffect` path has no catch.
  - Network I/O runs inside `synchronized(lock)` (`ZAL:998-1039`).
  - The disk-cache `version` field is written (`ZAL:141`) but never checked (`ZAL:223`); TypeScript validates `CACHE_SCHEMA_VERSION=4`.
- **Fix.** Hoist regexes to constants; parse accidents once into structs; fetch the bulk page once per city per TTL; make caches thread-safe; version-check the disk cache. Phase 1. More items of this group are in section 8 (`A-M1` to `A-M3`).

### C17 (MEDIUM). Refresh presets below the WorkManager floor; conflated failure states

- **Where.** `ScheduleSyncWorker.kt:116`; `ZP:209-249`, `ZP:431-433`, `ZP:195-202`.
- **What happens.** The UI offers 5 and 10 minute refresh presets (11 presets: 5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240) but the WorkManager periodic floor is 15 minutes. `ZtoeParser` reports offline and site-down identically (`NO_INTERNET`), and `NO_QUEUES_FOUND` also covers parse exceptions. A blank queue returns `SUCCESS` with empty slots in Kotlin but `NO_QUEUES_FOUND` in TypeScript.
- **Fix.** Align presets and hint ("1–240 хв") with reality; split failure branches into the four site states (section 5). Phase 1 (state) and 3 (UI copy).

### C18 (MEDIUM). Notification permission, vibration, shared channels

- **Where.** `MainActivity.kt:22-51`; `NotificationHelper.kt:24-27`, `:262-279`.
- **What happens.** `POST_NOTIFICATIONS` is requested on every `onCreate` (`:49-51`), the result is ignored (`:22-25`) and no denied state is shown. `triggerVibration` fires the hardware vibrator at `USAGE_ALARM` in addition to channel vibration (`:279`): double vibration, and it fires even if the notification itself is blocked. Emergency alerts use the same four channels as planned alerts (`zt_blackout_{sound_vibe, sound_only, vibe_only, silent}_v2`), so there is no separate emergency channel. `CATEGORY_ALARM` is set on every notification (`:262`). Notification ids are `key.hashCode()` / `slotId.hashCode()`.
- **Fix.** Check the permission and show a rationale or banner; vibrate only if the notification is allowed; separate planned and emergency channel sets (plan); delete the v1 channels; address id in alert keys. Phase 2.

### C19 (MEDIUM). Kotlin and TypeScript parity gaps

Full table in section 12. Phase 4 (web parity), plus vectors in `spec/` (phase 0b).

### C22 (MEDIUM). Privacy policy names only ztoe.com.ua

- **Where.** `PRIVACY_POLICY.md:54,86,161`; `public/privacy.html`.
- **What happens.** The app already calls `api-ztoe-poweron.inneti.net` (emergency data), but the policy names only `ztoe.com.ua`. The Play Data Safety form and the iOS privacy labels must name the host as well. Google backup can upload the home address and emergency state (C15), which the policy and the form should also mention (alarms report).
- **Fix.** Update `PRIVACY_POLICY.md` and `public/privacy.html`; no new hosts beyond ztoe and PowerOn (plan decision 11); Play Data Safety and Apple labels stay "no data collected". Phase 6.

### C20 (LOW). Dead code, swallowed exceptions, static data errors, hygiene

- Dead code: `applyEmergencyOutageToSchedule` (`SR:227-235`, an alias), `getEncodedTodaySlots`, `getIntervals`, `ZAL.DIRECTORY`, `fetchAndParse`, the `ScheduleStatusInfo` secondary constructor, unused `AppStrings` keys (`blackoutHoursHeader` `:29`, `siteInvalid` `:55`, `queueHelpDesc` `:95`).
- 22 or more `catch (_: Exception)` in alarm, worker and widget code with no `Log` or crash reporting.
- Magic timeouts: 8000, 7000 and 5000 ms (other magic numbers in `A-L3`).
- Wrong static ids: `lb_soborna` is "вул. Незалежності" (`ZAL:440`); `zt_глибочиця` is a Cyrillic id (`ZAL:386`).
- `https://example.com` in `DEFAULT_VALID_URLS` and `valid-urls.json`.
- `.omc/` state files are tracked despite `.gitignore`, and stray `.omc` directories sit under `app/src/main/java`.
- `HANDOVER.md` is stale: it claims the applicationId equals the namespace (`HANDOVER.md:3`, `:412`), describes an outdated versionCode formula (`:132`) and claims a typography setup (`:160`) that `Theme.kt` does not have.
- Phase 1, 2 and 6.

## 8. Additional findings omitted from the plan table

These come from the three exploration reports and are not in plan table 3.1 (some extend a C item). Each has file:line and a one-line fix; where the reports named a file but gave no line number, only the file is named here (no line was invented).

### 8.1 High

| ID | Finding | Where | One-line fix |
| --- | --- | --- | --- |
| A-H1 | The "CRITICAL SAFEGUARD" blocks live queues from replacing a cached queue, so upstream queue changes never propagate for houses that already have a queue | `ZAL:2227-2235` | Allow live queue updates when the cached value is older than the TTL |

### 8.2 Medium

| ID | Finding | Where | One-line fix |
| --- | --- | --- | --- |
| A-M1 | `persistToDiskCache` rewrites the whole JSON after every fetch; the prefetch alone triggers dozens of writes | `ZAL:1131-1199`, executor `ZAL:98` | Debounce and coalesce writes |
| A-M2 | Non-atomic state: `ZP` updates four volatile fields separately; `cachedRems` is replaced racily | `ZP:154-159`; `ZAL` (`cachedRems`) | Replace by one immutable snapshot, swapped atomically |
| A-M3 | `initDiskCache` re-hydrates whenever `cachedRems == null` and can overwrite fresher memory; `recentHouseStreetOrder` is not restored | `ZAL:319` | Hydrate once; persist and restore the recent order |
| A-M4 | Year-less dates (`dd.MM HH:mm`) crossing a year boundary give an empty overlap; Kotlin fills the year, TypeScript does not | `SR:157-165`, `SR:69`; `ztoeParser.ts:657-678` | Retire year-less parsing (PowerOn gives full ISO dates, plan section 5.3) |
| A-M5 | Fixed column indices in the settlement house-table parse (TypeScript detects columns from the header row) | `ZAL:880-888` | Detect columns from the header row |
| A-M6 | Unstable HTML emergency ids `emergency_${rowIdx}_$h` can re-trigger notifications whenever the row order changes; switching sources would re-fire "detected" | `ZAL:1401` | Retire the HTML emergency path; key alerts by address plus start instant |
| A-M7 | No street filter in the Kotlin per-street parse (TypeScript filters by the target street name) | `ZAL:1247`; `ztoeAddressLookup.ts:587` | Filter by target street |
| A-M8 | `checkAddressOnZtoeWebsite` overwrites the settlement's cached street list from a per-street response when the selected street has a blank name; the list can shrink | `ZAL:2216-2221` | Never replace the list from a per-street response |
| A-M9 | Planned alert key contains the block end time, so a revised schedule re-alerts; the restore-time-change notification keeps an unchanged title | `AlarmScheduler.kt:168`; `NotificationHelper.kt` | One alert per span keyed by absolute start instant; `eta_changed` event with its own title (plan decision 14) |
| A-M10 | `AlertRegistry` emergency dedupe (`hasFired`/`markFired`) is non-atomic (worker and UI race can double-fire) and shares the 100-entry cap with planned alerts (`MEDIUM*`) | `data/repository/AlertRegistry.kt` | Atomic check-and-mark; separate caps |
| A-M11 | An outage A replaced by outage B yields only a "detected" for B (no restore for A); a changed restore time gives a second "detected" with the same title; no notification for a future-start outage (`MEDIUM*`) | `NotificationHelper.kt:145-204` | Three-event model `start`, `eta_changed`, `end` (plan decision 14) |
| A-M12 | A worker exception returns `Result.retry()` without bound and skips `syncAlarms` (`:99`) (`MEDIUM*`) | `ScheduleSyncWorker.kt:27-105` | Each source in its own try/catch; `syncAlarms` always runs; bound retries |
| A-M13 | `syncAlarms` is heavy and called often (app start, resume, key changes, worker, widget); the legacy sweep recomputes a date-independent candidate set 3 times across 12 queues; `BlackoutApp.onCreate` reads settings and enqueues WorkManager on the main thread | `AlarmScheduler.kt:224-258`; `BlackoutApp.kt:72-89` | Drop or cache the sweep; move start-up work off the main thread |
| A-M14 | Time-change handling is duplicated (manifest receiver plus a dynamic receiver in `BlackoutApp`); manifest delivery of `DATE_CHANGED` and `TIME_SET` on API 26+ is not guaranteed (source says "verify") | `AndroidManifest.xml`; `BlackoutApp.kt` | Verify on emulator; keep one mechanism |
| A-M15 | Widget alarm ids `start_/end_{date}_{HH:mm}` carry no queue; `sweepLegacyQueueAlarms` cancels possible ids across 12 queues times 3 dates | `AlarmScheduler.kt:95,116,224-258` | Request-code registry (plan foundations for multi-address) |
| A-M16 | PendingIntent request code is `blockId.hashCode()`; two ids that hash equal become one alarm, and two addresses on the same queue produce the same `blockId` | `AlarmScheduler.kt:168,191` | Stored monotonically assigned request codes |
| A-M17 | Heavy start-up network: `beyondViewportPageCount=2` runs the Settings schedule fetch and the About donations fetch at launch | `NAV:702-707`; `SS:129-141`; `AboutScreen.kt:72-87` | Gate on page visibility (see [UI_REPORT](UI_REPORT.md)) |

### 8.3 Low

| ID | Finding | Where | One-line fix |
| --- | --- | --- | --- |
| A-L1 | The inline POST in `checkAddressOnZtoeWebsite` duplicates `postZtoeForm` (timeouts 7000 versus 8000, different charset sniff) | `ZAL:2186-2207` | Reuse `postZtoeForm` |
| A-L2 | `generateFallbackSchedule` produces a fake schedule; used in the `parseHtmlForDate` and `fetchAndParse` fallbacks and in the alarm sweep | `ZP` / `SR` (fallbacks) | Remove from production paths |
| A-L3 | Magic numbers: TTLs of 20 s, 60 s and 120 s; `size > 5` and `size > 15`; the 50-street persist cap | `ZAL:961`, `ZAL:990` | Named constants in `spec/config.json` |
| A-L4 | Placeholder vulica ids 41001 to 113001 are posted to ZTOE if a street is selected without a live list | `ZAL:1080` | Correct or drop the placeholders |
| A-L5 | `normalizeHouseNumber` maps only 9 Latin letters and misses c, o, p, t, x, h; it also strips a leading б or д | `ZAL:1436-1446`, `ZAL:1448` | Extend the letter folding (plan: Latin to Cyrillic) |
| A-L6 | `getSettings()` writes (removes keys) inside a preference-change listener path | `SetR:173-187` | Make reads pure; migrate once |
| A-L7 | Check-then-act on every cache map (for example two maps read non-atomically) | `ZAL:1051-1057` | Single lock or concurrent maps with atomic compute |
| A-L8 | `Build.VERSION.SDK_INT >= M` branches are dead code at minSdk 26 | `AlarmScheduler.kt:199-210` | Delete |
| A-L9 | Old v1 notification channels are never deleted | `NotificationHelper.kt` | Delete v1 channels |
| A-L10 | The worker swallows `CancellationException` | `ScheduleSyncWorker.kt:102` | Rethrow |
| A-L11 | Two-field bitmap cache in the widget is racy | `BlackoutGlanceWidget.kt:116-119`, `411-412` | One immutable holder |
| A-L12 | More unused code: `getNextUpcomingIntervalText`, `getCurrentStatusAndCountdown`, `createNotificationChannel`, `clearHistory`, and the `WAKE_LOCK` permission (manifest line 12) | various | Delete |
| A-L13 | `buildLightNoOutageSlots` is triplicated; `BlackoutApp.schedulePeriodicSync` duplicates `ScheduleSyncWorker.schedulePeriodicWork` | `NAV:86`, `BlackoutGlanceWidget.kt:98`, `MainScreen.kt:100` | One shared function |
| A-L14 | `MainScreen` builds its own `ScheduleRepository(context)` just for a pure function | `MainScreen.kt:90` | Use the companion `computeDetailedIntervals` |
| A-L15 | `urlFetchStatus` and the address lists live as screen-local state with `LaunchedEffect` network calls inside composables | `SS:129-141`, `838-940` | State holder or ViewModel |
| A-L16 | Finished intervals are listed with no "finished" styling and there is no explicit finished or past computation anywhere (the alarms report calls it cosmetic) | `MainScreen.kt:592-664`; `SR:296-436`, `672-708`; `BlackoutGlanceWidget.kt:178-184`, `490-496` | Interval status from the engine; dim and tag "завершено" |

## 9. Alarms and notification flow

### 9.1 Planned-outage alerts, end to end

`AlarmScheduler.syncAlarms` (`notification/AlarmScheduler.kt:29`) calls `syncAlarmsInternal` (`:40`, `@Synchronized`):

1. Builds today's slots with the emergency overlay (`:55-63`) and turns them into contiguous blocks.
2. Keeps blocks currently inside the pre-warning window (`:67-79`, window = [alert minus 1 min, start plus 2 min]); cancels previously tracked alarms outside that window (`:82-92`).
3. `sweepLegacyQueueAlarms` cancels possible alarm ids across 12 queues times 3 dates (`:95`, `:224-258`).
4. Widget redraw alarms are scheduled only if widgets exist (`:102-137`).
5. Returns early if `!notificationsEnabled || (queue blank && no emergency)` (`:139`).
6. Otherwise schedules one alarm per block (`:164-216`): `blockId = block_{date}_{start}_{end}_Q{queue}` (`:168`); skips blocks the registry already marked notified (`:170`); schedules only if `alertTime.isAfter(now)` (`:177`); `PendingIntent.getBroadcast(requestCode = blockId.hashCode(), UPDATE_CURRENT or IMMUTABLE)` (`:191`); `setExactAndAllowWhileIdle(RTC_WAKEUP)`, on `SecurityException` falls back to `setAndAllowWhileIdle`, any other exception is swallowed (`:198-214`).

`AlarmReceiver.onReceive` (`notification/AlarmReceiver.kt:19`) guards, in this order:

| Step | Guard | Line |
| --- | --- | --- |
| 1 | Always calls `syncAllWidgets` first | `:26` |
| 2 | For widget actions, stops there | `:29` |
| 3 | Drops the alert if `notificationsEnabled` is false | `:34` |
| 4 | Requires the queue extra to equal the current queue, and the slot id to start with today's date | `:42`, `:48` |
| 5 | Requires the interval to exist in today's **base** intervals | `:57-59` |
| 6 | Requires now inside [alert minus 2 min, start plus 2 min]; if now is earlier, calls `syncAlarms(onTimeChanged=true)` | `:70-78` |
| 7 | Dedupes with `AlertRegistry.hasNotified/markNotified` | `:83-88` |
| 8 | Title and body hard-coded Ukrainian: `"Черга $queue: … через $minutes хв"` | `:91-92` |

`NotificationHelper.showPreWarningNotification` (`:206`) re-checks `notificationsEnabled` (`:219`), picks one of 4 channels by sound and vibration (`:236`) and calls `notify(slotId.hashCode())`. `AlertRegistry` only dedupes (keys `notified_{slotId}`, pruned after 7 days or 100 entries, `:31-57`) and cannot cause stale warnings.

### 9.2 Is "warn about a finished slot" present today? (confirmed analysis)

Already prevented for planned alerts, not for emergency alerts.

| Path | Result | Evidence |
| --- | --- | --- |
| Planned, now 18:00, block 10:00 to 12:00 | **Prevented.** The scheduler skips it because alertTime 09:45 is not after now | `AlarmScheduler.kt:177` |
| Planned, a stale alarm fires anyway | **Prevented.** The receiver drops it because `now.isAfter(blockStart + 2 min)` | `AlarmReceiver.kt:75` |
| Planned, alarm for another date | **Prevented.** The receiver requires the slot id to start with today's date | `AlarmReceiver.kt:48` |
| Planned, countdown | Only looks forward | `SR:374-436` |
| Planned, user enables notifications at 09:50 for a 10:00 block with 15 min notice | Nothing fires (by design) | n/a |
| Planned, late delivery (Doze, inexact fallback) up to start plus 2 min | **Residual wrong text.** Still says "через 15 хв" | `AlarmReceiver.kt:70-92` |
| In-app list | Shows finished rows with no "finished" styling (cosmetic) | `MainScreen.kt:592-664` |
| Emergency, outage listed by the source with a restore time in the past | **Not prevented.** Fires "detected" whenever `prev == null` and the source still lists the outage; the restore time is never compared with now; the stored outage is never expired | `ZAL:1228-1240`; `NotificationHelper.kt:178-201` |
| Emergency, stale same-day record from yesterday | Painted on today's chart as "!" (overlay checks only that start and end share a date and `!isTomorrow`) | `SR:148-156` |
| Emergency, future outage | Multi-day branch paints it onto today | `SR:162` |
| Emergency ghost blocks in the scheduler | Alarms are created but are dead because of C4 | `AlarmScheduler.kt:55-63`, `AlarmReceiver.kt:57-59` |
| Widget "next outage" | Excludes finished intervals (`startMin > nowMin`) | `BlackoutGlanceWidget.kt:179-184`, `491-495` |
| Widget fallback string | Can still show a finished "10:00 – 12:00" if the widget recomposes without a resync | `BlackoutGlanceWidget.kt:496` |

Where the rule should live (data report section 7): one pure helper that computes finished versus remaining intervals, called by `AlarmScheduler`, `AlarmReceiver`, `NotificationHelper`, `SetR.getSettings`, the `MainScreen` list and the widgets. In the plan this is `OutageEngine.alertsToSchedule(model, now, advance)`, which "returns only unfinished future alerts for today and tomorrow" and is the single rule behind "never warn about a finished slot".

### 9.3 Emergency notifications today

- **Triggers.** Worker (`ScheduleSyncWorker.kt:43`) and UI (`NAV:255`, `:444`, `:536`, `:828`, `:855`). There is no alarm and no push. The shortest worker period is 15 minutes (default 30), so latency is 15 to 30 minutes or more, longer in Doze.
- **State transitions** (`NotificationHelper.kt:145-204`).
  - `prev != null && next == null`: "Emergency outage completed/restored", key `emergency_restore_{id}_{start}` (`:156-175`).
  - `next != null`: "detected", key `emergency_detect_{id}_{start}_{restore}` (`:178-201`).
  - A changed restore time gives a new key and a second notification with the same "detected" title; outage A replaced by B gives only a "detected" for B; nothing is sent for a future-start outage.
- **Dedup.** Only `AlertRegistry.hasFired/markFired`, non-atomic; shares the 100-entry cap with planned alerts. Emergency keys have no address component, so two addresses hit by the same accident would suppress each other.
- **Channels and ids.** Same four channels as planned alerts, no separate emergency channel; id is `key.hashCode()`; `CATEGORY_ALARM` on every notification (`:262`).
- **Toggles.** Planned alerts use `notificationsEnabled`; emergency alerts use `emergencyNotificationsEnabled` (`:152`, `:217-221`). `soundEnabled` and `vibrationEnabled` are global. `getSettings` forces sound and vibration off when both toggles are off; `prev_*` remembers the old values and restores them when any toggle turns back on (`SetR:189-203`, `:252-323`; the memory logic is duplicated between the two update functions).
- **Persistence.** `active_emergency_outage_{id,type,start,restore}` (`SetR:159-187`, `:222-225`).
- **Already-ended outage.** A notification fires if the source still lists the outage and `prev == null`, whatever the restore time.

### 9.4 `ScheduleSyncWorker`

Order (`ScheduleSyncWorker.kt:27-105`):

1. If a `selectedAddressQuery` exists, calls `ZtoeAddressLookup.checkAddressOnZtoeWebsite` (ZTOE POST 7 s plus 7 s, then the PowerOn GET 5 s plus 5 s, `ZAL:1872-1926`), fires the emergency notification, and saves settings if the queue or outage changed.
2. `ZtoeParser.fetchFullSchedule` (8 s plus 8 s, `ZP:110`) parses all 12 queues in one pass and batch-saves them.
3. On success calls `saveSchedule` again; on any other status calls `clearScheduleCache` (`:78-84`).
4. Syncs the widgets.
5. Runs `syncAlarms` last.
6. Any exception returns `Result.retry()`, unbounded.

PowerOn is polled indirectly through `checkEmergencyOutageOnZtoe` and `fetchPwAccidentsForScope`; matching tries the ZTOE HTML first, then the PowerOn API (60 s in-memory cache), then the local per-street cache (`ZAL:2101-2143`). The widget receiver and callbacks never poll PowerOn.

Failure modes: offline or ztoe down wipes the cache and the next `syncAlarms` cancels alarms (C2); today's table missing gives `NO_QUEUES_FOUND` and a cleared cache, a missing tomorrow table is fine.

Adding a second source breaks several current assumptions: a source failure is indistinguishable from "no outage" (C1); a thrown exception skips `syncAlarms`; the worst-case run is already about 40 s; ids are not canonical (ZTOE table id `emergency_{rowIdx}_{house}` versus PowerOn `pw_accident_{id}`), so switching sources would re-fire "detected"; the worker saves the whole settings object after a long wait (C11).

### 9.5 Reliable emergency alerts: decision prepared, not taken

Polling cannot make emergency alerts reliable: Android's floor is 15 minutes plus Doze, and iOS cannot poll PowerOn reliably (a `BGAppRefreshTask` runs opportunistically, minutes to hours or never). Options (plan section 5.4): (A) polling only, with the limit stated in the app and docs, which is this release; (B) a relay holding push token, street ids and house (privacy and Data Safety change); (C) topic push, where a scheduled job publishes per PowerOn street id, clients subscribe and filter the house locally so the server never learns the house. Recommended target: C, decided at iOS kickoff because it changes the privacy policy. The ledger and alert keys are already transport-independent.

## 10. Midnight and Tomorrow (C21)

### 10.1 Current behaviour (confirmed in code)

- **Where.** `SR:237-294`, `355-364`, `393-395`, `418-419`; `MainScreen.kt:489-555`; `AlarmScheduler.kt:164-216`.
- Intervals are computed per day. An outage on 13.11 from 23:00 to 14.11 01:00 is listed as "23:00–24:00 (1 год)" on Today and "00:00–01:00 (1 год)" on Tomorrow, never as 2 год.
- The "next period" text (case "power on, outage later today") shows `23:00 – 24:00` even when tomorrow continues the outage.
- Only the "currently off" countdown adds tomorrow's first block.
- The Tomorrow tab is replaced by a static "Сьогодні" pill when ztoe has not published tomorrow's table, which also hides any emergency or repair outage that PowerOn already lists for tomorrow.
- Once C5 is fixed (tomorrow's blocks get scheduled), a 00:00 continuation block would receive a second, bogus alert unless spans are merged (`AlarmScheduler.kt:164-216`).
- The emergency overlay does handle a known-date outage across midnight on the drum (`SR:157-165`), but year-less dates across a year boundary give an empty overlap (A-M4).

### 10.2 Engine rules (plan section 5.3, proposed)

1. `OutageEngine` works on a two-day window (today and tomorrow, or any consecutive pair) with absolute `LocalDateTime` instants, never per-day minute counters.
2. `OutageSpan` is the union of all kinds (planned, repair, emergency), merged across midnight and across kinds: planned 23:00 to 24:00 plus emergency 00:00 to 02:00 is one span 23:00 to 02:00 (3 h). Span duration, the "до відновлення" countdown, "наступний період", the widget "next outage" and alert planning all use spans; the per-kind rows stay separate for the list and the drum overlay.
3. Day views clip spans to their day for the drum and day totals; each clipped piece remembers `continuesFromPrevDay` and `continuesToNextDay`, so rows can print the date tag and the full duration (see [UI_PROPOSALS](UI_PROPOSALS.md)).
4. When tomorrow's table is missing and today's last slot is off, the span ends at 24:00 and is marked "may continue"; it extends automatically after the next successful fetch of tomorrow's table. The 00:00 rollover promotes tomorrow's stored data to today without a network call.
5. Alerts: one alert per span, keyed by the span's absolute start instant, scheduled for today and tomorrow; a 00:00 continuation never gets its own alert. Text: "Відключення о 23:00, орієнтовно до 01:00 (2 год)".
6. Duration is real elapsed time between Kyiv-zone instants, so a span over the DST night (25 Oct 2026, 28 Mar 2027) is right; day views keep the 48 half-hour grid the site uses.
7. Tomorrow data = ztoe tomorrow table (if present) joined with PowerOn emergency rows and repair works whose interval touches tomorrow (rows dated further ahead are ignored). `SiteStatusIndicator` shows "графік на завтра: опубліковано / ще немає".

### 10.3 Required tests (plan section 8, "midnight and Tomorrow first")

- Planned 13.11 23:00 to 24:00 plus a tomorrow table 00:00 to 01:00: one span of 2 h; the Today row shows `23:00 – 01:00` 2 год; the Tomorrow row shows 2 год tagged "з 13.11 23:00"; day totals 1 h plus 1 h; exactly one alert (at 22:45 with 15 min notice) and none for the 00:00 continuation; countdown at 23:30 equals 01:30:00.
- The same across 31.12 to 01.01 and across the 25 Oct 2026 DST night.
- Tomorrow table absent: span "may continue", then extended after a later fetch.
- Planned 23:00 to 24:00 plus emergency 00:00 to 02:00: one span of 3 h.
- Emergency 22:04 to 00:04 splits across both days' drums.
- Tomorrow tab content when only PowerOn has rows for tomorrow.
- A 23:30 planned block ending 00:30 and a 00:20 block tomorrow both get alarms.

None of these tests exists today (section 13).

## 11. Single-address assumptions

The multi-address draft is design only (`docs/design/MULTI_ADDRESS.md`, plan section 4); these are the single-address assumptions in today's code, which the foundations in plan phases 1 and 2 remove (address id in every alert key, request-code registry, targeted settings writes, pure engine taking an address).

- **Settings.** Keys `queue`, `custom_queue_status_text`, `selected_{address,rem,settlement,street,house}`, `active_emergency_outage_*` (`SetR:133-243`); `UserSettings` (`Models.kt:71-88`) and Compose state (`NAV:116-133`) are single-valued.
- **Alarms.** `settings.queue` is used throughout the scheduler; `blockId` embeds the queue (`AlarmScheduler.kt:168`); the receiver rejects any alarm whose queue is not the current one (`AlarmReceiver.kt:42`); `sweepLegacyQueueAlarms` is a hack to cancel alarms for every queue; widget alarm ids carry no queue (`:116`).
- **Registry.** Emergency keys have no address component.
- **Worker and widget.** The worker handles one address; widget state keys `glance_queue` and `glance_notifications_enabled` hold global values (`BlackoutGlanceWidget.kt:75-83`, `:133-219`); the bell callback flips the global flag (`:799-817`).
- **Cache.** Per-queue storage already exists (`cache_today_slots_{queue}`) and all 12 queues are saved on every fetch, so multi-queue needs no extra fetches; `cache_today_queue` is single and `clearScheduleCache` is global.
- **500-alarm limit.** Today's worst case is 24 alerts plus 48 widget alarms per address with failures swallowed (`:214`); the draft deduplicates alarms per queue and block (at most 12 queues times 24 equals 288, below the 500 cap).

## 12. Kotlin versus TypeScript parity gaps

| Area | Kotlin | TypeScript | Reference |
| --- | --- | --- | --- |
| Static streets | Duplicate `zt_bandery` and `st_173952`; `zt_velyka_berdychivska` canonical | One Bandery entry; `zt_berdy` canonical; settlement ids differ (`zt_stanyshivka`, `zt_hlybochytsia` versus `zt_stanishivka`, `zt_глибочиця`) | `ZAL:417-418`, `620`; `ts:125`, `1650` |
| Name matching | `contains` in both directions; `normalizeUkText` strips prefixes and removes parentheses for every name | Strict equality plus bare-name fallback; `normalizeStreetName` canonicalises street types and ordinals | `ts:770-789`, `900-908`, `1136` |
| Unknown streets | Returns a fake default house list | Returns `[]` | `ZAL:576-596`; `ts:1688` |
| House keys | `normalizeHouseNumber` merges `16А` and `16A` | `trim().toLowerCase()` only; Latin and Cyrillic variants stay separate | `ZAL:1435`; `ts:2341` |
| House token splitting | `[,;]` | `,` only | `ZAL:890-906` |
| REM matching | Full name compared exactly; a label without the "РЕМ" suffix and a mismatched id gives a duplicate REM | Strips the "РЕМ" suffix before comparing | `ZAL:683-687`; `ts:1707-1713` |
| REM ordering | Not reordered | Zhytomyr first | n/a |
| Emergency validity | `containsMatchIn`; requires an emergency keyword in the type; type label also reads `koment` | Strict `isValidOutageTimestamp`; no keyword required; no `koment` | `ZAL:1483-1494`; `ts:489`, `856-864` |
| `EmergencyOutageInfo` fields | 8 | 4 | `Models.kt:8-17` |
| Persistence | No schema check; no per-house outage persistence; `recentHouseStreetOrder` not restored | Schema version 4; persists valid per-house outages and `recentHouseStreetIds` | `ZAL:141`, `223` |
| Concurrency | Per-settlement lock only | Dedupes in-flight accident and settlement requests | `ts:958`, `1407` |
| Transport | Direct | `/proxy-*` paths in the browser | n/a |
| Date parsing | Accepts `dd.MM HH:mm`, fills the year | Requires a 4-digit year, otherwise time-only branch | `SR:69`; `ztoeParser.ts:657-678` |
| Status handling | Other exceptions give `NO_QUEUES_FOUND`; blank queue gives `SUCCESS` | `navigator.onLine` pre-check; parse errors give `NO_INTERNET`; blank queue gives `NO_QUEUES_FOUND`; no ETag or doc cache | `ZP:195-202`, `241-249`; `ztoeParser.ts:423-438` |
| Timeouts | 8 s schedule, 5 s accidents, 7 s address check | 6 s schedule, 4.5 s accidents, 5 s address check | n/a |
| Settings UI | Four non-editable dropdowns | Native `<select>` (no search either) | `SettingsView.tsx:771-865` |

Plan decision: parity becomes vector-checked (`spec/vectors`, same input and expected output for Kotlin and TypeScript), so none of the above can drift silently.

## 13. Test gaps

**What exists.**

- `ZtoeParserTest` unit E: queue parse of `5.2` and the no-queue status text; the demo outage at `06.04 19:21`; cross-day overlay (19:00 to 24:00 and 00:00 to 20:00); `np_99999` and `st_888888` parsing; hydrate and serialise round trip; bulk house index; no false outage for Київська 74; priority scoring and `16А`/`16A`; empty-slot synthesis; Berdychivska 22 (colspan, live JSON, `34А`/`34-А`).
- Unit A: schedule parse plus the main-versus-widget parity check. Unit B: default constants and strings. Unit C: tomorrow's next period, expecting `14:00 – 17:00` at 21:00. Unit D: roulette.
- `tests/unit.test.ts`: a similar set plus source-text parity greps; `CLAUDE.md` invariants (app name, defaults 15 and 30, queue-help text, widget labels, Facebook link, 48-slot parity, changelog enforcement).

**What nothing covers.** Alarms, the registry, settings, schedule-cache behaviour, offline states and site states, outage expiry, duplicate streets, midnight and Tomorrow, DST, receiver and scheduler agreement, exact-alarm fallback. The `+00:00` handling is only pinned by the existing assertion on `formatZtoeOutageTimestamp` (`ZtoeParserTest:1080,1094`); there is no test on a real PowerOn sample or through an engine.

**Planned additions** (plan sections 5.4 and 8): vectors in `spec/vectors/*.json` read by Kotlin tests (Gradle runs unit tests from `android/app`, so `../../spec`), by `npm test`, and later by XCTest; a test-only dependency `org.json:json` (JVM unit tests only stub `org.json`); fixtures trimmed from the real ztoe and PowerOn samples; the midnight/Tomorrow list in section 10.3; then: now 18:00 with planned 10:00 to 12:00 gives status `FINISHED` and zero alerts; an emergency 10:00 to 12:00 still listed at 18:00 is stale with no notification; an emergency 17:30 to 19:00 gives one "detected"; a listed emergency whose estimated restore passed 20 minutes ago is `OVERDUE` and still active; a failed fetch keeps the previous outage and fires nothing; a confirmed disappearance fires one "restored"; a planned plus emergency overlap keeps the planned alert; PowerOn `+00:00` read as Kyiv local time; the 8 real duplicate pairs merge into one option each with all ids; the `pagination=false` URL and dotted filters are asserted; site-state mapping for the 4 states.

## 14. Release, CI and signing facts (described only)

**Owner decision (plan sections 1 and 7).** CI build and Play signing must keep working and are **not to be changed** by this work. Untouched: `.github/workflows/build-apk.yml`, `android/app/keystore/*`, the signing and `applicationId`/`versionCode` blocks of `android/app/build.gradle.kts`, `gradle.properties`, `minSdk`/`targetSdk`. Allowed `build.gradle.kts` edits: the `versionName` fallback `1.3.5` to `1.4.0` and one test-only dependency (`org.json:json`). Work happens only on the feature branch; the PR runs `npm test`, Gradle tests and all three builds, and its publish step is skipped because the ref is not `main`; merge and tag stay with the owner. The facts below are reported so the owner can decide; none is changed.

| Topic | Fact | Reference |
| --- | --- | --- |
| applicationId | `ANDROID_APPLICATION_ID` environment variable, else `"com.ZTBlackoutPreWarning"`. The namespace is `ua.blackout.prewarning`; `HANDOVER.md:3` and `:412` wrongly claim the applicationId equals it. The env override would silently produce a different app (no update path, no preference migration). The id is permanent once on Play | `build.gradle.kts:15-16` |
| versionCode | `(GITHUB_RUN_NUMBER ?: 300) + 300`; local builds are always 600. A CI run-number reset (new workflow or repo) gives a lower code, which installs and Play uploads reject. `HANDOVER.md:132` and `CLAUDE.md:52` describe stale formulas (`CLAUDE.md` says `(GITHUB_RUN_NUMBER ?: 5) + 100`) | `build.gradle.kts:17` |
| versionName | Falls back to `1.3.5` | `build.gradle.kts` |
| Signing keystore | A keystore is base64-embedded and written to `app/keystore/debug.keystore` at every Gradle configuration; tracked in git (confirmed by `git ls-files` in the alarms pass) with the public password "android". `CLAUDE.md` states it is intentionally committed (stable signature for in-place upgrades) | `build.gradle.kts:34-38` |
| Release signing | Signs with the `upload` config only if environment credentials exist; otherwise silently falls back to the debug key | `build.gradle.kts:79-92` |
| Risks named by the report | Anyone can sign updates for sideloaded installs; Play rejects a debug-signed AAB; a Play-installed build could not be updated from a sideloaded one unless Play app signing is configured with this existing key | alarms report section 6 |
| Publishing | The "Publish GitHub Release" step runs on every push to `main` and can publish debug-signed APK and AAB (`CLAUDE.md` says pushing a `v*` tag publishes a release and rewrites the version badge; see section 16) | `build-apk.yml` |
| Build types | Debug has `isDebuggable=false`, the same signing and no `applicationIdSuffix`, so debug and release cannot coexist; release lint is off (`checkReleaseBuilds=false`, `abortOnError=false`) | `build.gradle.kts` |
| Toolchain | AGP 8.7.3 with compileSdk 36 relies on `android.suppressUnsupportedCompileSdk=36`; the manifest has `tools:targetApi="35"` while the target is 36 (`CLAUDE.md` mentions SDK 35) | `gradle.properties:5` |
| Proguard | `-keep class ua.blackout.prewarning.** { *; }` plus `-ignorewarnings` makes minification mostly a no-op for app code and hides real warnings; it also keeps all of `org.jsoup.**` (not needed, Jsoup uses no reflection); `ua.blackout.prewarning.receiver.**` is a dead rule. There is no app reflection and no `getIdentifier`, so `shrinkResources` and R8 are low-risk. Glance `ActionCallback` classes and the `CoroutineWorker` are instantiated by class name; if the keep-all rule is ever narrowed, keep `widget.**` callbacks and `worker.**` | `proguard-rules.pro` |
| Backup | See C15; backups upload the selected home address and emergency state to Google backup, so the privacy policy and Play Data Safety form should say so | `backup_rules.xml`, `data_extraction_rules.xml` |
| Compliance | No foreground service is used. All `PendingIntent`s are `FLAG_IMMUTABLE`; `AlarmReceiver` is not exported. Exact alarms: see C10 | manifest |
| Repo hygiene | Root `.omc/` state files are tracked despite `.gitignore`; stray `.omc` directories under `app/src/main/java` | repository |

**Owner actions** (plan section 8): re-check the Play Console exact-alarm declaration; the unprotected "Publish GitHub Release" step on `main`; the tracked `.omc/` state. Proof planned for "CI and signing still work" (plan section 7): `git diff main -- .github android/app/keystore` empty; `git diff main -- android/app/build.gradle.kts` limited to the two allowed lines; `gradle bundleRelease` succeeds locally; PR checks green; optionally compare the CI AAB's `keytool -printcert` SHA-1 with the Play-published one. Not run yet.

## 15. iOS documents versus code: conflicts

State of the native iOS app (plan section 9, read-only look at its public repository): latest release v1.3.3 (9 Nov 2026); about 230 KB of Swift (SwiftUI app plus WidgetKit extension, XcodeGen `project.yml`, 4 KB of XCTest, App Group `UserDefaults`, privacy manifests) targeting iOS 17 and Swift 5.10; **no `ZtoeAddressLookup.swift` and no PowerOn code**; only an unsigned IPA is built (`build-ipa.yml`: macos-14, Xcode 15.4, runs `npm test` first) and there is no TestFlight or App Store pipeline yet; the repository also tracks a stale copy of the Android project under `android/`. The docs describe two different iOS layouts (`IOS_HANDOVER.md`: `ios/ZTPreBlackoutNotification/…`; real tree: `ios/Shared`, `ios/ZTPreBlackout/…`), so the 3-way mapping is written from the real tree.

The iOS documents (`IOS_HANDOVER.md`, `ANDROID_UPDATE_SPEC.md`) disagree with the Android code and the live sites on the following points. `spec/` settles each one (plan section 10).

| Topic | iOS documents say | Android code, web and live site say | Resolution in the plan |
| --- | --- | --- | --- |
| REM ids | `IOS_HANDOVER.md`: Житомирський = 4, Бердичівський = 1, city `20055` | Android, web and the live site: 7, 3 and `16657` | `spec/rems.json`: one table of the 19 REMs (slug, ztoe `rem_id`, PowerOn `otg.id`, uk/en names), asserted equal to `ZTOE_REM_OPTIONS` (Kotlin) and the TypeScript table (decision 13). PowerOn ids differ again (Житомирський = 6) |
| Emergency event keys and gating | iOS: three events with its own keys and strings ("Зміна часу…", "…скасовано") | Android: two events with outage-id keys `emergency_detect_{id}_{start}_{restore}` and `emergency_restore_{id}_{start}`; web: `emerg_detected_` and `emerg_restored_`; gating rules differ on the three platforms | One model (decision 14): events `start`, `eta_changed`, `end` (end covers restored and cancelled, wording chosen from whether the previous estimate had passed); key `emerg_{event}_{addressKey}_{startInstant}[_{newEta}]`; gated by `emergencyNotificationsEnabled` only |
| Settings key names | The current docs use stale names | Android actually writes `refresh_minutes`, `advance_minutes`, `theme_mode`, and language `"SYSTEM"` | `spec/PERSISTENCE.md` documents what Android really writes (decision 9). The specific stale names in the iOS docs are not itemised in the sources used for this review |
| Cache caps | Not itemised in the sources used for this review | Android: address index stores houses for at most 50 streets; `AlertRegistry` capped at 100 entries and 7 days; in-memory slot caches cleared above 64 entries | The plan lists "cache caps" as a conflict; the exact iOS values must be taken from `IOS_HANDOVER.md` when `spec/PERSISTENCE.md` is written |
| `all=1` request and response | The docs and the app disagree on the request format | Two response formats exist: per-street 3-column and settlement 7-column | Both formats documented in `spec/` because iOS must parse both |
| Layout of the iOS source tree | `ios/ZTPreBlackoutNotification/…` | Real tree: `ios/Shared`, `ios/ZTPreBlackout/…` | Mapping written from the real tree |
| Address lookup and PowerOn | n/a | Missing in iOS entirely (v1.3.3) | M1 to M3 of the iOS roadmap (plan section 9) |
| Parity mechanism | Long prose specs plus an AI "bootstrap prompt"; nothing machine-checks parity | n/a | `spec/` vectors, `design-tokens.json`, `strings.json` export test |

## 16. Source inconsistencies noticed while writing this review

| # | Statement A | Statement B | Handling here |
| --- | --- | --- | --- |
| 1 | Plan section 2: Zhytomyr city = 967 streets (live probe 2026-11-12) | Code comment `ZAL:1145`, UI report and plan sections 3.2 and 5.2: 966 streets | Both quoted; 967 is the live probe, 966 is the code comment |
| 2 | Plan section 2 says PowerOn contains "the same plus" `Житній Базар`/`Житній базар` and a trailing space | The review brief lists PowerOn pairs that are different streets (`Закам’янська`, `В’ячеслава Липинського`, `майдан С.П.Корольова`, `пров. Єлизавети Епштейн`) | The brief's list is used (8 pairs in total, matching the plan's "5+3" and "8 real pairs") |
| 3 | `CLAUDE.md`: `versionCode = (GITHUB_RUN_NUMBER ?: 5) + 100` | Alarms report: `(GITHUB_RUN_NUMBER ?: 300) + 300` at `build.gradle.kts:17` and says `CLAUDE.md:52` is stale | Reported as stated by the alarms report; not re-checked |
| 4 | `CLAUDE.md`: pushing a `v*` tag publishes a GitHub Release | Plan and alarms report: "Publish GitHub Release" runs on every push to `main` | Both quoted; the workflow file was not re-read |
| 5 | `CLAUDE.md`: Android SDK 35 | Alarms and UI reports: compileSdk and targetSdk 36 | Reported; possibly the installed platform versus the build config |
| 6 | Alarms report (M8): delete `WidgetToggleReceiver` | Plan section 5.1: make it non-exported | The plan decision is used |
| 7 | `SR:147-156` (data report) | `SR:148-156` (alarms report) for the same-day overlay | Both ranges quoted in C3 |
| 8 | Data report (High): worker network wait up to about 12 s | Alarms report: worst-case run about 40 s; plan: "~12 to 40 s" | Both quoted in C11 |
| 9 | Plan table 3.1 does not itemise one High item, the "CRITICAL SAFEGUARD" | Data report lists it in the High group | Added as `A-H1` |
| 10 | Manifest (checked directly) already declares both `SCHEDULE_EXACT_ALARM` and `USE_EXACT_ALARM` | The alarms report's fix reads as if `SCHEDULE_EXACT_ALARM` still had to be added | Plan wording ("keeps `SCHEDULE_EXACT_ALARM`, removes `USE_EXACT_ALARM`") is consistent with the manifest |
| 11 | `CLAUDE.md` says `scripts/generate_android_project.cjs` overwrites `android/` | Plan phase 4: it only re-creates missing files from its stale TypeScript copy and refreshes the rest; the plan corrects `CLAUDE.md` | Plan statement noted; to be corrected in phase 6 |

## 17. Prioritised fix list mapped to the plan phases

| Priority | Fix | Findings | Plan phase | Key files |
| --- | --- | --- | --- | --- |
| P0 | Record baseline: branch, `npm test`, `npm run lint`, `gradle testDebugUnitTest`; publish these four review documents | all | 0 | `docs/review/*` |
| P0 | `spec/` scaffold, `config.json`, `design-tokens.json`, fixtures, vector harness in Kotlin and `tests/unit.test.ts` | C19, section 13 | 0b | `spec/*`, `tests/unit.test.ts` |
| P1 | Stop false alerts and silent loss: tri-state results, ledger, stop clearing caches on failure, expiry, remove demo and fake lists | C1, C2, C3, C6, A-H1 | 1 | `data/outage/*`, `data/poweron/*`, `data/net/*`, `ZtoeAddressLookup.kt`, `ZtoeParser.kt`, `ScheduleRepository.kt`, `SettingsRepository.kt`, `Models.kt` |
| P1 | OutageEngine with two-day spans; one rule for scheduler, receiver, notifications, UI and widgets | C3, C4, C5, C21, A-M4, A-L16 | 1 (engine), 2 (planner) | `data/outage/*`, `AlarmScheduler.kt`, `AlarmReceiver.kt` |
| P1 | Alerts: today plus tomorrow, midnight re-sync, receiver posts first, text computed at fire time | C4, C5, C13, A-M9, A-M11, A-M16 | 2 | `AlarmScheduler.kt`, `AlarmReceiver.kt`, `NotificationHelper.kt`, `AlertRegistry.kt` |
| P2 | Correct matching and addresses: strict name equality, `StreetKey`, merged ids, PowerOn client with dotted filters and `org.json` | C7, C8, C9, A-M5 to A-M8, A-L4, A-L5 | 1 | `data/address/*`, `ZtoeAddressLookup.kt` |
| P2 | Exact alarms: switch to `SCHEDULE_EXACT_ALARM`, gate, card and banner, state-change receiver | C10 | 2 and 3 | `AndroidManifest.xml`, `AlarmScheduler.kt`, UI |
| P2 | Worker isolation and targeted settings writes | C11, A-M12, A-L10 | 2 | `ScheduleSyncWorker.kt`, `SettingsRepository.kt` |
| P3 | Notification permission, separate emergency channels, vibration; manifest and backup cleanup | C15, C18, A-L9 | 2 | `NotificationHelper.kt`, `MainActivity.kt`, `AndroidManifest.xml`, `backup_rules.xml` |
| P3 | Site state and status UI; widget live values; Tomorrow tab and midnight rows | C14, C17, C21 | 3 | `SiteState.kt`, `MainScreen.kt`, `TimelineBar.kt`, `BlackoutGlanceWidget.kt` |
| P3 | Performance and thread-safety group | C16, A-M1 to A-M3, A-M13, A-L7, A-L11 | 1 | `ZtoeAddressLookup.kt`, `ZtoeParser.kt` |
| P4 | Web parity (full): engine, PowerOn client, site state, picker, overlay, toggles, type scale | C19 | 4 | `src/services/*`, `outageEngine.ts`, `poweronClient.ts`, `streetKey.ts`, `MainView.tsx`, `SettingsView.tsx`, `vite.config.ts` |
| P4 | UI and typography findings | [UI_REPORT](UI_REPORT.md), [TYPOGRAPHY](TYPOGRAPHY.md) | 3 | `ui/theme/*`, `ui/components/*`, screens |
| P5 | Dead code, swallowed exceptions, magic numbers, stale docs | C20, A-L1 to A-L3, A-L6, A-L8, A-L12 to A-L15 | 1, 2, 6 | various |
| P5 | Privacy policy and store forms name the PowerOn host (and the backup behaviour) | C22 | 6 | `PRIVACY_POLICY.md`, `public/privacy.html` |
| P5 | Multi-address design draft (not implemented) | section 11 | 5 | `docs/design/*` |
| Owner | Play exact-alarm declaration; protect the Release step on `main`; tracked `.omc/` state; C12 left unchanged | C10, C12, C20 | none | Play Console, `build-apk.yml` |
| After release | iOS port M0 to M6 | section 15 | 6 and beyond | `spec/*`, `docs/ios/IOS_HANDOVER_v1.4.0.md` |

Phase 6 (verification and release prep) checks everything above on the emulator (screenshots, font scale, TalkBack, contrast, site states) and reports any state that cannot be reproduced as **Not verified**.
