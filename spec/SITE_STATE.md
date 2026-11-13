# SITE_STATE

What the user is told about the ztoe.com.ua schedule site, and what the app does with its cache when the site is not usable. Reference implementation: `android/app/src/main/java/ua/blackout/prewarning/core/SiteState.kt` (`SiteState`, `FetchFailure`, `SiteStateResolver`).

## 1. The four states

| State | Meaning | Typical cause |
|---|---|---|
| `AVAILABLE_WITH_TABLE` | The site answered and today's schedule table is present. | Normal. |
| `AVAILABLE_NO_TABLE` | The site answered (HTTP success) but there is no usable schedule table. | Not published yet, page layout changed, a page that cannot be parsed, a valid but unrelated URL such as the `https://example.com` entry of `valid-urls.json`. |
| `SITE_UNREACHABLE` | The device has working internet but the site did not answer. | DNS, connect, timeout, TLS, HTTP error status. |
| `NO_INTERNET` | The device itself has no validated internet connection. | Airplane mode, no signal, captive portal. |

`hasTodayTable` (input of the resolver) is true when the fetched page contains a schedule table dated today (Kyiv date) that yields queue rows. The explanatory banner paragraph above the real tables is not a table. A page that was fetched but could not be parsed is **not** a fetch failure: it is `failure = NONE` with `hasTodayTable = false`. HTTP 304 (conditional request via ETag) is not a failure either: reuse the last parsed 200 response for the same URL and day.

## 2. `FetchFailure`

Platform-independent reason a request failed. The adapter maps its own errors to one of these:

| Value | Meaning | Android | iOS (`URLError`) |
|---|---|---|---|
| `NONE` | The request succeeded (including 304). | no exception, 2xx or 304 | no error |
| `DNS` | Name not resolved | `UnknownHostException` | `.cannotFindHost`, `.dnsLookupFailed` |
| `CONNECT` | Connection refused or lost | `ConnectException`, `NoRouteToHostException` | `.cannotConnectToHost`, `.networkConnectionLost` |
| `TIMEOUT` | Connect or read timeout (8 000 ms each) | `SocketTimeoutException` | `.timedOut` |
| `TLS` | Certificate or handshake error | `SSLException` | `.secureConnectionFailed`, `.serverCertificate*` |
| `HTTP_ERROR` | Non-2xx, non-304 status | status check in the adapter | status check in the adapter |
| `OTHER` | Any other I/O failure | other `IOException` | other `URLError` |

## 3. Resolver

```text
resolve(failure, hasTodayTable, networkValidated):
  if failure != NONE: return networkValidated ? SITE_UNREACHABLE : NO_INTERNET
  if hasTodayTable:   return AVAILABLE_WITH_TABLE
  return AVAILABLE_NO_TABLE
```

Truth table (all 12 vector cases):

| `failure` | `hasTodayTable` | `networkValidated` | Result |
|---|---|---|---|
| `NONE` | true | true | `AVAILABLE_WITH_TABLE` |
| `NONE` | false | true | `AVAILABLE_NO_TABLE` |
| `NONE` | true | false | `AVAILABLE_WITH_TABLE` (a response arrived, the flag is ignored) |
| `DNS`, `CONNECT`, `TIMEOUT`, `TLS`, `HTTP_ERROR`, `OTHER` | false | true | `SITE_UNREACHABLE` |
| `DNS`, `CONNECT`, `TIMEOUT` | false | false | `NO_INTERNET` |

When `failure != NONE`, `hasTodayTable` carries no information and is passed as false.

## 4. `networkValidated`

It is the operating system's own verdict that the device has working internet. **No third-party host is contacted** to decide it (no "ping google"), so the privacy policy and store data-safety answers stay unchanged.

| Platform | Source |
|---|---|
| Android | `ConnectivityManager.getNetworkCapabilities(activeNetwork)` has `NET_CAPABILITY_VALIDATED` (`ACCESS_NETWORK_STATE` is already declared). |
| iOS | `NWPathMonitor` current path `status == .satisfied`. |
| Web simulator | `navigator.onLine` (the closest available signal). |

Read it **after** a request failed (at the moment of classification), not before sending, so a link that dropped during the request is classified as `NO_INTERNET`.

## 5. User-facing messages

Exact strings (uk is normative; en is normative as written):

| State | uk | en |
|---|---|---|
| `AVAILABLE_WITH_TABLE` | Сайт ZTOE доступний, графік опубліковано | ZTOE site online, schedule published |
| `AVAILABLE_NO_TABLE` | Сайт ZTOE доступний, але графіка немає | ZTOE site online, but no schedule table |
| `SITE_UNREACHABLE` | Сайт ZTOE недоступний, інтернет є | ZTOE site unreachable, your internet works |
| `NO_INTERNET` | Немає інтернету | No internet connection |

Presentation (plan, section 3.3): a status chip is always shown in the "Last updated" card; every state except `AVAILABLE_WITH_TABLE` also gets a glass banner card above the hero. Each state has an icon and the text (colour is never the only cue). Colours are in `design-tokens.json` (`status`): green, amber, red, grey. Suggested icons: ok-circle, warning, cloud-off, wifi-off (SF Symbols: `checkmark.circle.fill`, `exclamationmark.triangle.fill`, `icloud.slash`, `wifi.slash`).

PowerOn has its own small status line, independent of the ztoe state: uk `Аварійні: недоступні`, en `Emergency data: unavailable` (shown when the emergency fetch is `Unavailable`, see `POWERON_API.md` section 8).

## 6. Staleness: a failure never destroys data

Rules (plan decisions, review findings C1 and C2):

1. A failed or table-less fetch **never clears** the schedule cache and never makes the alert planner cancel alarms. The alert sync runs on every cycle with whatever valid cache exists.
2. The cache of a queue is valid for today only if its date stamp is today's Kyiv date. At midnight a stored tomorrow table whose date is now today is promoted to today (no network call).
3. When the state is not `AVAILABLE_WITH_TABLE` and a valid cache for today exists: keep showing it, mark it stale, and label it `дані за HH:mm` (en `data from HH:mm`), where `HH:mm` is the time of the last successful fetch.
4. Only when there is no valid cache for today does the UI fall back to the grey "unclear" state (drum in the grey style, `Невідомо` / `Unclear`, `--:--:--` countdown).
5. Emergency data follows its own rule: `Unavailable` leaves the ledger unchanged (`NOTIFICATIONS.md`).

## 7. Tomorrow-published flag

`tomorrowPublished` is true when the last successful parse found tomorrow's table (dated today + 1) containing the user's queue. ztoe usually publishes it in the evening. The flag is persisted per queue (Android: `cache_has_tomorrow_<queue>`) and is **not** reset to false by a failed fetch; it is recomputed on the next success and after the midnight promotion.

- The Tomorrow tab is always present.
- While false: the Tomorrow drum is drawn in the grey unclear style, a notice reads uk `Графік на завтра ще не опубліковано на сайті` / en `Tomorrow's schedule is not published on the site yet`, and any emergency or repair outage PowerOn already lists for tomorrow is still drawn and listed.
- The status area shows next to the ztoe state: uk `графік на завтра: опубліковано` / `графік на завтра: ще немає`, en `tomorrow's schedule: published` / `tomorrow's schedule: not yet`.
- For the engine, a false flag means `tomorrowOff = null` in `buildPlanned`, so a block reaching 24:00 today is `mayContinue = true`.

The English texts of this section (notice, status wording, PowerOn line) are proposals; they carry no vector.

## Vectors

`spec/vectors/site_state.json` (12 cases: every `FetchFailure` against `networkValidated`, and `NONE` against `hasTodayTable`). The staleness and tomorrow rules of sections 6 and 7 are behavioural adapter rules without a JSON vector; their engine-level effect (`mayContinue`, the extension after a later fetch) is covered by `spec/vectors/outage_engine.json` ("tomorrow table missing and today ends off", "after midnight with/without yesterday's tail").

## Site notice (1.4.0)

When ztoe answers but has no schedule table (`AVAILABLE_NO_TABLE`) the page usually carries a notice
instead, for example (live page, 13.11.2026):

> УВАГА! ВАЖЛИВА ІНФОРМАЦІЯ! / У зв’язку з складною ситуацією в об’єднаній енергосистемі України, … /
> Графіки погодинних відключень електроенергії наразі не діють.

`SiteNotice.extract(html)` (Kotlin `core/SiteNotice.kt`, TS `src/core/siteNotice.ts`) returns its text,
and the main screen shows it in an information card titled «Повідомлення з сайту ztoe.com.ua»
(en «Notice from ztoe.com.ua»), quoted as is, line by line. Regex based on purpose, so every platform
gives the same text; vectors in `vectors/site_notice.json` (the first case is the real page).
While the card is shown, the amber "site works, no table" banner above the hero is **not** shown (the
notice already explains it); the status chip in the "Last updated" card still names the state.

1. Find the marker `УВАГА! ВАЖЛИВА ІНФОРМАЦІЯ` case-insensitively; between the words any of
   ` \t\n\x0B\f\r ` or `&nbsp;`; the final `!` is optional. No marker → no card.
2. The block runs from the marker to the first closing `h1`–`h6`, `p`, `div`, `td`, `center` tag or
   opening `table`/`hr`, at most 4000 characters after the marker (the live page leaves the `h3` open).
3. All whitespace runs become one space, then `<br>` becomes a line break, other tags are dropped and
   entities decoded (`TextNorm.decodeEntities`); lines are trimmed and collapsed, empty lines removed.
4. Fewer than two lines (marker only) → no card. The text keeps the marker as its first line and is cut
   on a line boundary at 1000 characters, followed by a line `…`.

Persistence: `site_notice` in `zt_outage_state_v1`, written only with `AVAILABLE_NO_TABLE`; an answer
with a table (or a no-table page without the notice) removes it; an unreachable/offline check keeps it
but it is not shown until the site answers again without a table.
