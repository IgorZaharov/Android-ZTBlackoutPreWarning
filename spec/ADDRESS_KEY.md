# ADDRESS_KEY

Canonical keys for matching street and house names across ztoe.com.ua, the PowerOn API and the device cache. Reference implementation: `android/app/src/main/java/ua/blackout/prewarning/core/AddressKeys.kt` (`TextNorm`, `StreetKey`, `HouseKey`). A key is only for comparison and storage lookups; it is never shown to the user (it is a mix of Latin and Cyrillic letters by design).

All three functions are deterministic string functions with no locale dependence. `lowercase` means locale-independent Unicode lower-casing (Kotlin `lowercase()`, JavaScript `toLowerCase()`, Swift `lowercased()`).

## 1. `TextNorm.decodeEntities(raw)`

Decodes HTML entities so that text scraped from ztoe and PowerOn compares equal to plain text.

Repeat at most **3 passes**; stop early when the string has no `&` or a pass changed nothing. One pass:

1. Numeric entities `&#N;` and `&#xH;` (regex `&#([xX][0-9a-fA-F]+|[0-9]+);`): replace by the code point if it is in `1..0x10FFFF`, otherwise leave the text unchanged.
2. Named entities (regex `&([a-zA-Z]+);`, name matched case-insensitively): replace by the value below; an unknown name is left unchanged.

| Name | Value | Name | Value |
|---|---|---|---|
| `amp` | `&` | `laquo` | `«` |
| `lt` | `<` | `raquo` | `»` |
| `gt` | `>` | `rsquo` | `’` (U+2019) |
| `quot` | `"` | `lsquo` | `‘` (U+2018) |
| `apos` | `'` | `ndash` | `–` (U+2013) |
| `nbsp` | a plain space U+0020 | `mdash` | `—` (U+2014) |
| `hellip` | `…` | | |

The repeat handles double escaping: `&amp;#039;` becomes `&#039;` in pass 1 and `'` in pass 2. Input escaped more than three times stays partially decoded.

Checked directly by the runner (not in the JSON): `&amp;#039;`, `&#39;`, `&#x27;` all decode to `'`; `a&amp;b` decodes to `a&b`.

## 2. Skeleton (Latin/Cyrillic look-alikes)

`skeleton(lower)` maps letters that look identical in Latin and Cyrillic to one letter so that `16A` (Latin A) equals `16А` (Cyrillic А). Input **must already be lower-case**. Only these 13 Cyrillic lower-case letters are mapped; every other character is unchanged (including Latin letters, digits, `ї`, `є`, `ґ`, `и`, `п`, `г`, `д`, ...).

| Cyrillic | Code point | Skeleton letter |
|---|---|---|
| а | U+0430 | a |
| в | U+0432 | b |
| с | U+0441 | c |
| е | U+0435 | e |
| н | U+043D | h |
| і | U+0456 | i |
| к | U+043A | k |
| м | U+043C | m |
| о | U+043E | o |
| р | U+0440 | p |
| т | U+0442 | t |
| х | U+0445 | x |
| у | U+0443 | y |

## 3. `StreetKey.of(raw)`

Steps, in this order:

1. `s = decodeEntities(raw)`, then `lowercase`.
2. Remove every apostrophe-like character: U+0027 `'`, U+2019 `’`, U+02BC `ʼ`, U+2018 `‘`, U+00B4 `´`, U+0060 `` ` ``, U+02BB `ʻ`, U+2032 `′`. (They are removed, not unified, so `Мар'янівський`, `Мар’янівський` and `Марянівський` agree.)
3. Replace each run of whitespace (`\s`, U+00A0, U+200B) by one space, then trim.
4. Remove the space after an initial's dot: regex `(?<![\p{L}\p{N}])(\p{L})\.\s+(?=\p{L})` replaced by the letter and a dot (`с.п. корольова` -> `с.п.корольова`). The letter must not be preceded by a letter or digit, so the `л.` of `вул. ` is untouched.
5. Split on single spaces (dropping empty parts). For each token: strip all trailing `.` and look the result up in the type table below; if found, replace the **whole token** (also when it was written with a dot) by the canonical type token; otherwise keep the token unchanged (dots included). The lookup applies to every token, not only the first.
6. Join with single spaces and apply `skeleton`.

The type is kept in the key (`вул. Київська` differs from `пров. Київська` and from `Київська`), and numerals are kept (`1 пров. X` differs from `2 пров. X`).

Type-token table (key = written form after dot stripping, value = canonical token):

| Canonical | Accepted forms |
|---|---|
| `вул` | `вулиця`, `вул` |
| `пров` | `провулок`, `пров`, `пр-к` |
| `просп` | `проспект`, `просп`, `пр-т` |
| `б-р` | `бульвар`, `бульв`, `бул`, `б-р` |
| `пл` | `площа`, `пл` |
| `пр-д` | `проїзд`, `пр-д` |
| `узв` | `узвіз`, `узв` |
| `туп` | `тупик`, `туп` |
| `наб` | `набережна`, `наб` |
| `шосе` | `шосе` |
| `майдан` | `майдан`, `м-н` |

Examples (final key, skeleton applied; Latin letters in the result are skeleton letters):

| Input | Key |
|---|---|
| `вул. В'ячеслава Липинського` (also `В’`, `В&#039;`, `вулиця`, extra spaces) | `byл bячecлaba липиhcьkoгo` |
| `майдан С.П. Корольова` and `майдан С.П.Корольова` | `maйдah c.п.kopoльoba` |
| `вул. Київська`, `вулиця Київська`, `ВУЛ. КИЇВСЬКА` | `byл kиїbcьka` |
| `1 пров. Мар'янівський`, `1 провулок Мар’янівський` | `1 пpob mapяhibcьkий` |

## 4. `HouseKey.of(raw)`

1. `s = decodeEntities(raw)`, `lowercase`, trim.
2. Remove a leading prefix: regex `^(?:будинок|буд\.?|№)\s*` (the alternatives are ordered, `будинок` first, so `будинок 5` -> `5`).
3. Remove every run of whitespace, `'`, `"`, `«`, `»`, `’`, `ʼ`, `` ` ``, `.` (regex `[\s'"«»’ʼ`.]+`).
4. Remove a hyphen that sits between a digit and a letter: regex `(?<=\p{N})-(?=\p{L})` (`34-а` -> `34а`). Other hyphens and slashes stay (`1-2` keeps its hyphen, `14/а` keeps its slash).
5. Apply `skeleton`.

Examples: `34-А`, `34 А`, `34А`, `34A` (Latin), `34а` all give `34a`; `16A`, `16А`, `16а` give `16a`; `14/а`, `14/А`, `14/a` give `14/a`; `буд. 5`, `№5`, `будинок 5`, `Будинок 5`, `5` give `5`; `1/1` and ` 1/1 ` give `1/1`; `19 а`, `19-А`, `19а` all give `19a` (PowerOn lists such variants side by side in one `buildingNames`).

Limits (not covered by vectors): other dash characters (`–`, U+2011) are not treated like the hyphen; a prefix is recognised only at the start.

### 4.1 PowerOn `buildingNames` matching

- `HouseKey.tokens(buildingNames)`: split on `,` and `;`, trim each part, drop empty parts.
- `HouseKey.listContains(buildingNames, house)`: `target = HouseKey.of(house)`; if `target` is empty the answer is `false`; otherwise true when some token has `HouseKey.of(token) == target`. Matching is on whole keys, never on substrings: house `1` is not in `12, 14`, but is in `1, 10, 11`.
- Lists contain technical entries (`0`, `ТП-575`, `КТП-894`); they simply never equal a real house key.

## 5. Merge rule for duplicate streets

Both ztoe and PowerOn list the same street under several ids that differ only by apostrophe, case, spacing or a trailing space. Rules for the address index of one settlement:

1. Group street entries by `StreetKey.of(name)` within the settlement (`settlementId + "|" + key`).
2. A group becomes **one** option. Its display name is the first name seen (keep the first display name stable). It keeps **all** ids of its members: `ztoeVulicaIds[]` (ztoe `vulica_id`) and `poweronStreetIds[]` (PowerOn `street.id`), without repeats, in discovery order.
3. Its houses are the union of the houses of all ids, de-duplicated by `HouseKey.of` (first display form wins).
4. Any id that was ever stored (selected street, cached index, alerts) must still resolve: look up an option by any of its ids, not only by a "primary" id. A persisted selection that names an old duplicate id therefore keeps working after the merge.
5. A ztoe per-street request loops over all `ztoeVulicaIds` and unions the houses; every PowerOn query passes all `poweronStreetIds` (`street.id[]=a&street.id[]=b`, see `POWERON_API.md`).
6. Apply the grouping at three points: when parsing a ztoe response, when loading a stored index (so an old cache with duplicates heals on read), and when falling back to a static list.
7. Compare names only by key equality, never with `contains` in either direction (`Шевченка` is not `Тараса Шевченка`).

### 5.1 Real duplicate pairs (observed 2026-11-12)

3 pairs on ztoe and 5 on PowerOn. The sources do not say which id belongs to which spelling.

| Site | Street | Ids | Difference |
|---|---|---|---|
| ztoe | `В'ячеслава` / `В’ячеслава` | 176316, 174295 | apostrophe U+0027 versus U+2019 |
| ztoe | `Закам'янська` | 174537, 174536 | two ids, one name |
| ztoe | `С.П. Корольова` / `С.П.Корольова` | 176383, 176334 | space after the dots |
| PowerOn | `Житній Базар` / `Житній базар` | 33798, 34709 | letter case |
| PowerOn | `Закам’янська` | 33382, 33565 | two ids, one name |
| PowerOn | `В’ячеслава Липинського` | 33970, 35135 | two ids, one name |
| PowerOn | `майдан С.П.Корольова` | 5650, 6236 | two ids, one name |
| PowerOn | `пров. Єлизавети Епштейн` | 33651, 33652 | trailing space in one name |

All 8 collapse to one key each (the vector groups `streetEqual` contain these names and further variants of the same kind).

## 6. A house listed more than once (consumer type)

The ztoe house table has a seventh column «Споживач»: `побутові споживачі` (households) or `непобутові (юридичні) споживачі` (non-household, businesses). The same house can be in several rows with **different queues**, across the two consumer types (просп. Миру 23 in Zhytomyr: households 5.2, non-household 5.2 and 1.2) and even within one type (вул. Болгарська 23: households 1.2 and 6.1). On 2026-11-17, 454 of the 18 256 houses of Zhytomyr city had more than one queue. Up to 1.4.0 the first row won, so просп. Миру 23 got queue 1.2 instead of the households' 5.2.

1. `ConsumerType.of(raw)`: entities decoded, trimmed, lower case. A type code (`household`, `business`) maps to itself (stored variants are united again). Contains `непобут` or `юридич` → `business`; otherwise contains `побут` → `household`; otherwise `""` (unknown: no column, a header, a note). The consumer cell is the last cell from index 4 on whose text contains `споживач`.
2. A **variant** is `(queue, statusText, consumers[])`. The rows of one house (one `HouseKey.of`, after the street merge of section 5) are folded into variants: rows with the same non-empty queue are one variant; all rows without a queue (a status such as «В цей час не вимикається…») are one variant that keeps the first status text. `consumers` is the union of the rows' `ConsumerType.of`, in discovery order, without `""` and repeats.
3. **Order**: variants that include `household` first; then variants with a queue before the one without; otherwise discovery order (stable sort).
4. The house's `queue` and `statusText` are those of the first variant. The display form of the house is still the first one seen (section 5, rule 3).
5. **Choice**: when a house has two or more variants, the address lookup shows one button per variant (its queue or status, and its consumer types) and applies the one the user picked. That variant (queue and consumer types) is stored per address, keyed by street id and `HouseKey` (`HouseVariantChoices`; Android preferences `house_variant_choice`, iOS App Group defaults, web `localStorage`), and preselected when the lookup opens the house again. `HouseVariants.pick(variants, preferredQueue, preferredConsumers = [])`: `preferredQueue` `null` → the first variant. Otherwise the variant with that queue (`""` = the one without a queue) while it still lists one of `preferredConsumers` (or none were given); else the first variant that lists one of `preferredConsumers` (the households' queue moved while a business row kept the old one); else the first. Re-checks of a saved address pass only the stored choice, never the saved queue: an address saved before 1.4.1 without a choice therefore moves to the default (households') variant, which repairs queues picked by the old first-row rule, and a status-only address picks up a households' queue that appears later.
6. The address index cache stores the variants of every house, so the cache version is bumped (4) and older caches are rebuilt.

## 7. Stale ids after a ztoe renumbering

In November 2026 ztoe gave new ids to its settlements and streets (місто Житомир `naspunkt_id` 16657 became 18544, вул. Київська `vulica_id` 173934 became 195659). A request with an old `naspunkt_id` answers with an empty, disabled street list. A request with an old `vulica_id` answers with the table of the whole REM (6 065 rows from 1 661 streets) instead of one street. Saved addresses kept the old ids, so the street had no name, the stored text became `"РЕМ, місто,\n, буд. N"`, and an unfiltered page could give the house number of another street. The rules:

1. **Settlement aliases.** When a live settlement list of a REM replaces the previous one, a settlement whose id is gone gets an alias to the one live settlement with the same `cityKey` of its name (none or several: no alias). Every settlement lookup goes through the aliases. The aliases are stored with the address index.
2. **Bulk retry.** The settlement bulk request (`rem_id`, `naspunkt_id`, `all=1`) is sent once more when its answer has no streets and its settlement list gives the settlement another `naspunkt_id`.
3. **No queue without a street name.** `checkAddressOnZtoeWebsite` returns nothing (no queue, no text) when the street has no name after the one index reload. The saved queue stays. Rows of a street page are kept only when their street has the street's `StreetKey`, also on the first-page fallback (before, that fallback kept every row).
4. **Saved street check** `checkSavedStreet(rem, settlementId, settlementNameHint, streetId, streetName)` gives `current`, `moved(settlementId, settlementName, streetId, streetName)`, `lost` or `unknown`:
   - `current` at once, without network, when the settlement is known by its saved id and its cached street list holds `streetId` (or its legacy id).
   - An unknown or nameless settlement is matched by `settlementNameHint` (the second part of the head line of the stored text, `"РЕМ, місто,\n…"`) in the REM's live settlement list; no single match → `unknown`. The match becomes an alias of the saved id.
   - The street list of the settlement is loaded (TTL as usual). Without a street list read from the site (Android and iOS: a bulk time; web: read in this session) → `unknown`.
   - The street id on the list → `current` (or `moved` when only the settlement id changed). Otherwise the name is the saved `streetName`, else the name the index still has for `streetId`, else the name kept from a discarded older cache (rule 6). Exactly one street of the list with that `StreetKey` → `moved`; no name, or no such street → `lost`.
   - A legacy settlement id of an earlier app version (`LEGACY_SETTLEMENT_IDS`) is not a renumbering and stays as saved.
5. **Repair of saved addresses** (`SubscriptionSync.repairAddresses`, before the address re-check of a refresh with `resolveAddress` and before the background refresh): for `moved` the item gets the new settlement and street ids through `Subscriptions.setAddress` (queue, status text, switches, name and position stay) and the text `addressText(REM, settlement, street, house)` = `"РЕМ, місто,\nвулиця, буд. N"`. The saved `streetName` stays, so the address key stays; an empty one is filled in. The house variant choice (section 6, rule 5) moves to the new street id. `lost` marks the item, `current` and `moved` clear the mark, `unknown` keeps it (Android preferences `address_repair`, iOS App Group `address_repair`, web `localStorage` `zt_lost_street_ids`). Changing the address in Settings clears the mark.
6. **Cache versions.** The index cache version goes up (Android and iOS 5, web 8), so lists read through old ids are dropped. The street names of the previous version (4, web 7) are kept by every id of a street (`legacyStreetNames`) and stored with the new index, as repair input only.
7. **Notice.** A marked item shows «Вулицю не знайдено на сайті ZTOE. Змініть адресу й оберіть вулицю знову.» / «The street is no longer on the ZTOE site. Change the address and choose the street again.» (`AppStrings.streetLost`) under its address on the main screen and on its Settings card. In the address lookup a street without a name counts as not chosen, so the user picks it again and no `", буд. N"` text is built.

Tests: `StaleAddressRepairTest.kt`, `ios/Tests/StaleAddressRepairTests.swift`, `tests/services.test.ts` (`repair: …`).

## Vectors

`spec/vectors/house_variants.json`: `consumerType` (raw text → type; a type code maps to itself, because stored variants are united again), `merge` (rows of one house in table order → ordered variants, plus `picks` with a preferred queue). The rows of просп. Миру 23, вул. Андріївська 2а and вул. Болгарська 23 are real (ztoe, 2026-11-17).

`spec/vectors/address_keys.json`: `streetEqual` (8 groups, every member must give one key), `streetDistinct` (5 pairs that must not collide), `houseEqual` (6 groups), `houseDistinct` (5 pairs), `listContains` (9 cases). The entity checks in section 1 are asserted by the runner itself. For the PowerOn row matching built on these keys see `spec/vectors/poweron_api.json` (`emergencyMapping`, `repairMapping`).
