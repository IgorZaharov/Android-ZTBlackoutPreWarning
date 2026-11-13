# Review package: "Світло в Житомирі" (branch `feat/1.4.0-outage-rework`)

Full code and logic review, three-skill UI review (`better-interface`, `better-ui`, `better-typography`) and the evidence behind them. Written 2026-11-13 from three read-only exploration passes (data and logic layer, alarms/worker/widget, UI), direct probing of both live data sources on 2026-11-12, and the approved plan.

**Status: static review. Nothing has been run on a device or emulator and no test or build was executed for these documents.** Every rendered check (font scale, TalkBack, measured contrast, site states, stripes on the drum) is marked Not verified and is scheduled for the emulator walkthrough in plan phase 6.

## Documents

| Document | What it contains | Format | Verdict | Counts |
| --- | --- | --- | --- | --- |
| [CODE_REVIEW.md](CODE_REVIEW.md) | Scope and method; verified facts about ztoe.com.ua and PowerOn (incl. the `+00:00` finding); architecture map; emergency model; website-state handling; duplicate-streets root cause and canonical key; findings C1 to C22 expanded; 34 additional findings from the reports; alarms and notification flow (incl. "already prevented for planned, not for emergency"); midnight and Tomorrow (C21); Kotlin versus TypeScript parity; test gaps; release, CI and signing facts (described only); iOS-docs-versus-code conflicts; prioritised fix list mapped to plan phases | Prose and tables | **Block** | C1 to C22: 13 HIGH, 8 MEDIUM, 1 LOW; additional: 1 HIGH, 17 MEDIUM, 16 LOW |
| [UI_REPORT.md](UI_REPORT.md) | `better-interface` report: scope and coverage, one findings table of 15 rows, verification, verdict; appendices with the full screen inventory and the contrast table | `review-format.md` | **Block** | 6 HIGH, 8 MEDIUM, 1 LOW |
| [UI_PROPOSALS.md](UI_PROPOSALS.md) | `better-ui` proposals grouped by principle; emergency-overlay stripe spec; site-status chip tokens; Tomorrow tab and midnight-crossing row design; picker design; press scale 0.96 over 150 ms; "what stays unchanged" with exact tokens; Main-screen wireframe | `better-ui` table format | **Approve** (better-ui scope only; overall stays Block) | 8 proposals: 5 MEDIUM, 3 LOW, 0 HIGH |
| [TYPOGRAPHY.md](TYPOGRAPHY.md) | `better-typography` check: findings, full audit table (31 styles), role scale with a mapping from every current literal, Ukrainian-text specifics, font-scale test matrix (1.0, 1.3, 2.0), open decisions | `better-typography` table format plus audit | **Block** | 7 findings: 3 HIGH, 2 MEDIUM, 2 LOW |

## Executive summary

1. **Alerts can mislead and can go missing:** any ztoe or PowerOn failure is treated as "no outage" (false "power restored" push, real one then silenced), every failure wipes the schedule cache and the next sync cancels all alarms, emergency outages never expire, scheduler and receiver validate different slot sets, only today's blocks are scheduled, and a hard-coded demo emergency for вул. Київська 37 sits on the production path (C1 to C6).
2. **Both data sources were probed live:** PowerOn is a public JSON API (`pagination=false` works, only dotted filters filter, `switchSubReason != 2` is the emergency), its timestamps are Kyiv wall-clock time labelled `+00:00`, and the app already strips the offset; a finished planned block is already prevented from alerting (`AlarmScheduler.kt:177`, `AlarmReceiver.kt:75`) but a finished emergency is not.
3. **Matching and the day boundary are wrong in specific, reproducible ways:** substring name matching, 8 real duplicate-street pairs on the two sites (3 ZTOE, 5 PowerOn) that survive because dedup is by id, and an outage crossing midnight that is shown as two 1 год rows instead of one 2 год span, with the Tomorrow tab hidden until ztoe publishes (C7, C8, C21).
4. **The UI works against its own content:** 64 % of the text is 12 sp or smaller with no type scale, rows break at font scale 1.3 and above, white on the accent is 3.04:1, the four address pickers are non-searchable lists of up to 967 items, and a site failure shows only "Невідомо" with no cause; the proposals keep the look (accent `#FF5E3A`, card `#BF141A29`, radii, bezel, palette) and add a second cue for emergency outages.
5. **Release safety is described, not changed:** CI, signing, `applicationId` and `versionCode` stay untouched by decision (including the debug-key fallback and the publish step on `main`); owner actions are the Play exact-alarm declaration, that publish step and the tracked `.omc/` state; the iOS port follows the Android release and the iOS documents conflict with the code on REM ids, event keys and settings names.

## Overall verdict

**Block.** HIGH findings are open in the code review (13), the interface review (6) and the typography check (3). The `better-ui` proposals carry no HIGH row, but that does not lift the overall verdict. The block lifts once plan phases 1 to 3 land and the emulator walkthrough (phase 6) confirms the rendered checks that are Not verified here.

## How to read the package

- **Severity.** `HIGH` blocks a task, misleads the user, risks data loss or is a repeated systemic failure; `MEDIUM` harms comprehension, efficiency, adaptability or consistency; `LOW` is isolated polish. An asterisk means the source listed the item without a severity and the class was assigned for grouping.
- **IDs.** `C1` to `C22` are the plan's finding IDs; `A-H`, `A-M`, `A-L` are findings from the exploration reports that the plan table omitted; `D1` to `D7` in the typography check are open decisions.
- **References.** `file:line` references are reproduced as given by the exploration passes and were not re-validated line by line against the working tree. Paths are relative to `android/app/src/main/java/ua/blackout/prewarning/` unless they name another root.
- **Sources of numbers.** Wrap and clip thresholds are calculated at 360 dp; contrast for the DAY palette is a worst case on a pure-white backdrop. Neither has been measured on a device.
- **Source inconsistencies.** Statements in the sources that disagree are listed in [CODE_REVIEW.md](CODE_REVIEW.md) section 16 (data and release facts) and in [TYPOGRAPHY.md](TYPOGRAPHY.md) section 8 and [UI_PROPOSALS.md](UI_PROPOSALS.md) (design decisions).
- **Not done here.** The baseline runs of `npm test`, `npm run lint` and `gradle testDebugUnitTest` (plan phase 0), any emulator check, and any change to code, CI or signing.
