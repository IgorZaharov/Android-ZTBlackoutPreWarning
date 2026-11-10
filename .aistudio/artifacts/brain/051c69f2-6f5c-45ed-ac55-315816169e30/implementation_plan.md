# Background Address Indexing & Persistent Disk Cache for Instant "?" Dropdowns

Eliminate loading delays when opening the REM, City/Settlement, Street, and House dropdowns in the "?" Address Lookup window by combining a persistent on-device disk cache (`stale-while-revalidate`) with automatic background prefetching on application launch and predictive next-step prefetching during selection.

## User Review & Critical Decisions

> [!IMPORTANT]
> The decisions below reflect your confirmed preferences from our clarification step and preserve 100% of the existing Workbench UI, colors, labels, and layout.

- **Confirmed Decision 1 — Pre-loading & Caching Strategy**: Use **background prefetching on application launch combined with a persistent disk cache** (`localStorage` on Web Workbench; `SharedPreferences` / local JSON storage on Android). Any previously indexed REM, city list, street list, or house list is loaded into memory immediately on startup so dropdowns open in `0 ms`, while background revalidation silently updates the index when online.
- **Confirmed Decision 2 — Startup Prefetch Scope**: Automatically prefetch and index **all 19 REMs, the full city/settlement lists across all REMs (bounded concurrency), the full street list for the active/default city (`м. Житомир` and the user's saved settlement), and the house list for the user's saved street** as soon as the application launches.

---

## 1. Overview & Core Concept

- **What It Does**:
  - Persists all fetched REM, Settlement (City/Village), Street, and House/Queue lists to on-device storage so that once fetched, dropdown lists are available immediately across sessions without waiting for network round-trips.
  - Launches a non-blocking background indexer as soon as the application starts (including on first launch while the `"Виберіть чергу"` / `"Select queue"` prompt is shown) to download and index all 19 REMs, their settlements, and the streets for the default/selected city before the user opens the `"?"` modal.
  - Uses a `stale-while-revalidate` flow when the user enters the `"?"` screen: cached lists render immediately (`0 ms` delay) while a silent background refresh updates the in-memory and on-disk index only if new items are found.
- **Target Audience / Persona**: Users in Zhytomyr Oblast looking up their blackout queue or emergency outage status by address who expect instant, responsive dropdowns on both first launch and repeat visits.
- **Key Value**: Removes network wait times when tapping REM, City, Street, and House dropdowns in the `"?"` screen while keeping the address database fresh from `ztoe.com.ua`.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **First Launch (`"Виберіть чергу"` Screen)**:
     - While the user is on the initial screen, the background indexer immediately fetches all 19 REMs, prefetches the full street list for default `м. Житомир` (`rem_id=4`, `naspunkt_id=16657`), and prefetches settlements for all REMs using bounded parallel requests.
     - By the time the user taps `"Виберіть чергу"` and opens the `"?"` modal, the REM, City (`м. Житомир`), and Street dropdowns are already populated and open with zero delay.
  2. **Switching REM or City in `"?"` Screen**:
     - Selecting any REM immediately displays its pre-indexed cities/settlements from the in-memory/disk cache (`0 ms`), and immediately triggers a background prefetch of the first/selected settlement's streets before the user even taps the Street dropdown.
     - Selecting any Street immediately displays any cached houses (`0 ms`) and fetches/updates the street's house & queue table in the background.
  3. **Re-entering `"?"` Screen**:
     - Cached REMs, Cities, Streets, and Houses appear immediately with no flicker or empty-list delay, while the background refresh silently updates the cache if `ztoe.com.ua` returns changes.
- **Visual Identity & Theme**:
  - Strictly preserves the existing Workbench UI, colors (`#FF5E3A`, `#141A29`), typography, button positions, and captions without any visual modifications.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Stale-While-Revalidate + Persistent Disk Cache**
  - *Chosen Approach*: Hydrate the in-memory address lookup maps from persistent disk storage on startup and serve cached lists immediately to the UI while refreshing in the background.
  - *Why*: Guarantees `0 ms` dropdown opening latency after the initial background prefetch, works seamlessly across app restarts, and still honors the requirement to refresh REMs, Cities, Streets, and Houses when entering the `"?"` screen without blocking the UI thread.
  - *Alternatives Considered*: Blocking the dropdown on a fresh network request every time `"?"` opens, which causes noticeable delays on mobile networks.
- **Decision 2: Priority-Ordered Bounded Parallel Prefetching on Launch**
  - *Chosen Approach*:
    - **Priority 1 (Immediate)**: Fetch all 19 REMs + settlements for the active/default REM (`Житомирський РЕМ` + user's saved REM) + streets for the active/default settlement (`м. Житомир` + user's saved settlement) + houses for the user's saved street.
    - **Priority 2 (Background Batch)**: Prefetch settlement lists for the remaining 18 REMs with bounded concurrency (e.g., 4 concurrent requests) so every REM's city list is ready in memory and persisted on disk within ~1.5 seconds of app launch without overloading the device or `ztoe.com.ua`.
  - *Why*: Ensures the most likely dropdowns (`Житомирський РЕМ` -> `м. Житомир` -> all streets) are ready in under 500 ms, while all 19 REMs' city lists finish indexing right behind them.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌───────────────────────────────────────────────────────────────────────────┐
│                         Application Startup                               │
│         (Main Web Workbench Mount / Android Navigation Launch)            │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │
                                      ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                Address Indexer & Persistent Cache Layer                   │
│                                                                           │
│  1. Hydrate In-Memory Maps from Disk Cache (0 ms synchronous/fast read)   │
│     • REMs Index             • Settlements by REM ID                      │
│     • Streets by City ID     • Houses & Queues by Street ID               │
│                                                                           │
│  2. Priority-1 Background Prefetch (Active / Default Address Path)        │
│     • All 19 REMs + Active REM Cities + Active City Streets + Saved House │
│                                                                           │
│  3. Priority-2 Background Batch Prefetch (All 19 REMs' Cities)            │
│     • Bounded concurrency (4 workers) -> Persist to Disk Cache            │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │
                                      ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                     "?" Address Lookup Modal (Settings)                   │
│                                                                           │
│  • Opens Dropdowns Immediately from Pre-Indexed In-Memory Cache (0 ms)    │
│  • On Modal Open: Silent Background Revalidation (Stale-While-Revalidate) │
│  • On REM/City Change: Instant Cache Read + Predictive Next-Level Fetch   │
└───────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - **In-Memory Maps**:
    - `cachedRems`: List of all 19 REM records.
    - `dynamicSettlementsByRem`: Map of `remId -> List<Settlement>`.
    - `dynamicStreetsBySettlement`: Map of `settlementId -> List<Street>`.
    - `dynamicHousesByStreet`: Map of `streetId -> List<HouseRecord>`.
  - **Persistent Disk Storage**:
    - Serialized JSON snapshot stored in `localStorage` (Web) and dedicated `SharedPreferences` (`"zt_address_index_cache_v1"` on Android), automatically hydrated on initialization and updated whenever new lists are fetched.
    - Bounded house-table cache (retaining the most recently accessed street house tables) to keep disk footprint compact while keeping all REMs, all settlements, and active city street lists cached in full.
- **Interactive Component & State Mapping**:
  - **Startup Hook**: Invokes `prefetchAddressIndexInBackground(siteUrl, savedAddressQuery)` once on app startup in both Web and Android.
  - **Modal Entry (`"?"` Window)**: Reads pre-indexed lists immediately into component state so dropdowns open without delay, then triggers background revalidation (`forceRefresh = true`) that updates state and disk cache seamlessly.
  - **Unit Tests**: Adds unit tests verifying disk cache hydration/persistence, startup prefetching of REMs/cities/active city streets, and zero-delay synchronous lookup after indexing.
