# iOS port plan — "Світло в Житомирі" 1.4.0 for iPhone

| | |
|---|---|
| Written | 2026-11-14 |
| Status | Plan, waiting for owner approval. Nothing is ported yet. |
| Source of truth | `spec/` + `spec/vectors/` (behaviour), `android/.../ui/AppStrings.kt` (strings), Android 1.4.0 (`7fe08f0`) for everything the spec does not cover |
| Builds on | [`IOS_HANDOVER_v1.4.0.md`](IOS_HANDOVER_v1.4.0.md). The handover keeps the file mapping (§4), the corrected ids (§5), the iOS constraints (§6) and the strings (§7). This plan replaces its milestones (§8) and adds what came after it: multi-address (`spec/SUBSCRIPTIONS.md`), the site notice card, the strip widget, Liquid Glass and App Review work. |

## 1. Owner decisions (2026-11-14)

| # | Question | Decision |
|---|---|---|
| D1 | How is Swift built without a Mac? | **GitHub Actions macOS runner with Xcode 26.** Code is written on Windows; CI compiles, runs XCTest against `spec/vectors`, takes simulator screenshots, and uploads to TestFlight with an App Store Connect API key. |
| D2 | Where does the iOS code live? | **Monorepo.** `ios/` moves into this repository next to `android/` and `src/`. The old repo `IgorZaharov/iOS-ZTPreBlackoutNotification` is archived after the first TestFlight build. |
| D3 | «Житомирська Рулетка» (simulated gambling) | **Left out of iOS v1.** No entry point on iOS. Can come back in a later update with its own age-rating change. |
| D4 | Minimum iOS | **iOS 17.0.** Liquid Glass on iOS 26+, material fallback on iOS 17–25. Built with the iOS 26 SDK (App Store Connect has required it for uploads since April 2026). |

Still open (needed before M7, not before coding starts): see section 9.

## 2. Scope: what "1:1" means

Everything the Android 1.4.0 user can do, an iOS user can do, with the same data, the same rules (vectors) and the same Ukrainian/English text. Where iOS has no equivalent, the table below is the full list of differences; anything not on it must match Android.

| Android feature | iOS | Why |
|---|---|---|
| Exact alarms, `ExactAlarmGate`, permission receiver, fallback banner, `exactAlarm*` strings | Not ported | iOS local notifications fire at their trigger date; there is no exact-alarm permission |
| `refreshFloorHint` ("Android checks at most once every 15 min") | iOS text instead: background refresh is decided by iOS, emergency alerts are best effort | `BGAppRefreshTask` is opportunistic. New strings go into `AppStrings.kt` first (one source of strings) |
| Emergency alerts every 15 min in the background | Best effort in the background + refresh on every foreground | Same reason. Stated in the app and in the store description |
| Notification channels (planned / emergency) | `categoryIdentifier` `planned` / `emergency`, `threadIdentifier` = address id | iOS has no channels |
| Vibration switch | Hidden on iOS | iOS gives apps no vibration control for notifications. A switch that does nothing is a review risk. Sound switch stays |
| Boot receiver | Nothing | Pending notifications survive a reboot |
| 4×1 widget «Графік» | `systemMedium` widget showing the drum (+ info line) | iOS has no 4×1 home-screen size |
| Widget redraw by alarm | WidgetKit timeline with an entry at every outage transition | Widgets cannot tick on iOS. Countdown has no seconds on both platforms already (`HHг. MMхв.`) |
| Roulette mini-game | Not in iOS v1 (D3) | Age rating and review risk |

## 3. Repository layout after the move

```
ios/
  project.yml                     XcodeGen; deployment 17.0, Swift 6 toolchain (language mode 5 first)
  Shared/                         compiled into app AND widget
    Core/                         pure, mirrors android core/ and src/core/ (no UIKit/SwiftUI)
      OutageModels.swift  OutageEngine.swift  KyivTime.swift  EmergencyLedger.swift
      PowerOnMapper.swift  AddressKeys.swift  SiteState.swift  SiteNotice.swift  Subscriptions.swift
    Data/                         ZtoeParser, ZtoeAddressLookup, ZtoeStaticDirectory, PowerOnClient,
                                  NetworkProbe, OutageRepository, OutageStateStore, ScheduleRepository,
                                  SettingsRepository, SubscriptionRepository, SubscriptionSync,
                                  AlertRegistry, DonationsRepository, AppGroupFiles
    Design/                       ZtTokens, Glass (Liquid Glass + fallback), TimeOfDayPalette, OutageRowFormat
    Notifications/                NotificationPlanner, AlertRegistry (shared: the widget bell/refresh intents re-sync alerts,
                                  like Android's WidgetToggleReceiver)
    AppStrings.swift
  App/                            SwiftUI app: UI/, Background/
  Widget/                         WidgetKit extension: 3 widgets, AppIntents, AddressEntity
  Tests/                          SpecVectorsTests (reads ../spec/vectors directly), parser fixtures, PickerSearch
  UITests/                        screenshot flow for CI and App Store screenshots
  Resources/                      Assets.xcassets (AppIcon), valid-urls.json, donations.json, PrivacyInfo.xcprivacy
.github/workflows/build-ios.yml   new workflow, never touches build-apk.yml
```

- `valid-urls.json` and `donations.json` become a **fourth synced copy** (`ios/Resources/`). `tests/unit.test.ts` gets a check that all four are identical.
- `spec/vectors` is **not copied**: the test target adds `../spec/vectors` as a folder resource, so Kotlin, TypeScript and Swift read the same bytes.
- The stale copies of `android/`, `src/` and `tests/` inside the old iOS repo are not brought over. Only `ios/` is copied; the commit message names the source commit (`effe5a6`) so history can be found in the archived repo.
- `CLAUDE.md` and `HANDOVER.md` get an iOS section (commands, layout, parity rules).

## 4. Liquid Glass design system (with fallback)

One modifier family in `ios/Shared/Design/Glass.swift`, so no screen calls `glassEffect` directly. Every card, chip, button and widget surface goes through it.

| Element | iOS 26+ | iOS 17–25 fallback | Reduce Transparency on (any version) |
|---|---|---|---|
| Card (`ZtGlassCard`, radius 24) | `.glassEffect(.regular.tint(card tint), in: .rect(cornerRadius: 24))` | `.background(.ultraThinMaterial, in: shape)` + `cardBorder` stroke `#26FFFFFF` + top highlight gradient + soft shadow | `cardSolid` `#141A29` + border |
| Groups of chips / switcher pills | `GlassEffectContainer(spacing:)` so neighbours merge and morph; `.glassEffectID` for the address switcher | Material capsules, no morph | Solid capsules |
| Status chips (green/amber/red/grey) | `.glassEffect(.regular.tint(chipColor))` | Chip colours from `design-tokens.json` on material | Solid chip colours |
| Buttons | `.buttonStyle(.glass)`, primary actions `.glassProminent` tinted accent `#FF5E3A` | `.bordered` / `.borderedProminent` with the same tint and radius 16 | same as fallback |
| Pressed state | `.interactive()` glass | scale 0.96, 150 ms | no scale when Reduce Motion is on |
| Navigation, tab bar, sheets, search field | System glass (automatic when built with the iOS 26 SDK) | System default | System default |
| Background | Time-of-day gradient (`TimeOfDayPalette`) + slow warp (`AmbientMotion`), `.backgroundExtensionEffect()` under the drum | Same gradient and warp | Warp off when Reduce Motion is on |

Rules:
- `if #available(iOS 26, *)` lives only inside `Glass.swift`. Screens never branch on OS version.
- Text on glass keeps the token colours and a contrast of at least 4.5:1, checked on the darkest and the brightest time-of-day palette in the CI screenshots.
- `UIDesignRequiresCompatibility` is **not** set: the app takes the new look on iOS 26.
- App icon: 1024 px icon in the asset catalog; iOS 26 renders it with the system glass treatment (clear/tinted modes). A layered Icon Composer icon is optional polish and needs a Mac, so not in v1.

### Widgets

| | iOS 26+ | iOS 17–25 |
|---|---|---|
| Background | `.containerBackground(for: .widget)` with the time-of-day gradient; in the **clear** and **tinted** home-screen styles the system replaces it with Liquid Glass | Same gradient, translucent dark layer instead of glass |
| Rendering modes | Read `@Environment(\.widgetRenderingMode)`. `.fullColor`: crimson/amber/ivory drum. `.accented` / `.vibrant`: drum cells drawn as `.widgetAccentable()` shapes, emergency keeps its stripes so state never depends on colour alone | `.fullColor` only |
| Inner chips (status, countdown) | Glass capsule through `Glass.swift` | Material-like translucent capsule |
| Buttons (bell, refresh) | Interactive `Button(intent:)` with glass style | Interactive `Button(intent:)` (iOS 17 API) |

Not verified until the first CI screenshots: how `glassEffect` renders inside a widget in each home-screen style. If it looks wrong, inner chips fall back to the translucent style on all versions; the widget background still gets system glass.

## 5. App Review hardening (changes in code and data, not only store text)

| # | Risk (guideline) | Change |
|---|---|---|
| R1 | Reviewer is outside Ukraine; if `ztoe.com.ua` or the PowerOn API block non-UA addresses the app looks broken (2.1 App Completeness) | M0 CI job requests both hosts from the US runner and records the result. If blocked: first-launch state explains it, cached schedule is kept, and the review notes include a screen recording made in Ukraine. Site-unreachable state already never clears the schedule (`SITE_STATE.md`) <br>**Result 2026-11-14 (CI run 43591868854, GitHub-hosted runner outside Ukraine):** ztoe schedule GET 200 (242 KB, table marker found), ztoe `all=1` POST 200 (1.3 MB), PowerOn `pw_otgs` 200, PowerOn `pw_accidents` 200. Not blocked today; the job runs on every iOS push, so a later block shows up in CI |
| R2 | Unofficial use of the utility's name (5.2.1 / 5.2.2) | No ZTOE logo anywhere. `disclaimerText` ("not an official service, data from ztoe.com.ua") shown in About **and** once on first launch. Review notes explain that both data sources are public pages/APIs |
| R3 | Donations (3.2.2 (iv): funds only outside the app) | Donation and Facebook links open in Safari with `openURL` — never in a web view or `SFSafariViewController`. Each donation link is labelled as an external link. `donations.json` semantics unchanged |
| R4 | Background modes declared but unused (2.5.4) | `UIBackgroundModes` = `fetch` only. `processing` is removed (the app has no `BGProcessingTask`). `BGTaskSchedulerPermittedIdentifiers` = `ua.blackout.prewarning.sync` |
| R5 | Notification permission at launch (5.1.1, 4.5.4) | Ask only after the user chose a queue or address, with a short explanation card first. The app works fully without permission; Settings shows how to turn it on and links to the iOS Settings page |
| R6 | Privacy (5.1.1, 5.1.2) | `PrivacyInfo.xcprivacy` for app and widget listing the required-reason APIs actually used (UserDefaults `CA92.1` + App Group `1C8F.1`, file timestamps `C617.1` if read). Privacy policy names **both** hosts (`www.ztoe.com.ua`, `api-ztoe-poweron.inneti.net`), says street ids are sent and house numbers stay on the device, no account, no analytics, no tracking. Same update on Android/web (fixes `CODE_REVIEW.md` C22) |
| R7 | Age rating | Without the roulette (D3) all questionnaire answers are "None" → lowest rating |
| R8 | Encryption export | `ITSAppUsesNonExemptEncryption = NO` (HTTPS only), already in the old Info.plist, kept |
| R9 | Versions out of sync (2.1 metadata) | `Info.plist` uses `$(MARKETING_VERSION)` / `$(CURRENT_PROJECT_VERSION)`; build number = CI run number; marketing version follows `versionName` and joins the release checklist in `CLAUDE.md` |
| R10 | iPad layout review | `TARGETED_DEVICE_FAMILY = 1` (iPhone only). Runs on iPad in compatibility mode; no iPad screenshots needed |
| R11 | Language | `CFBundleDevelopmentRegion = uk`, `CFBundleLocalizations = [uk, en]`, so the store lists both. The in-app language switch (System / UK / EN) stays |
| R12 | Accessibility (not a rejection reason, but reviewers note it) | Dynamic Type roles from `design-tokens.json`, VoiceOver labels on drum cells ("10:00–10:30, світла немає"), 44 pt minimum hit area (token says 48, kept) |
| R13 | Emergency alerts that pierce Focus | Optional: `timeSensitive` interruption level for emergency events (capability, no Apple approval needed). Decision at M5 |

## 6. Milestones

Every milestone is a PR into a feature branch, never a push to `main` (a push to `main` publishes an Android release). Each ends with a green `build-ios.yml` run; CI logs and screenshots are the evidence, because nothing can be compiled locally.

| | Deliverable | Done when |
|---|---|---|
| **M0 Move + CI** | Copy `ios/` from the old repo (`effe5a6`); new layout from section 3; `project.yml` for Xcode 26 / iOS 17; `build-ios.yml`: on PR and branch push → `xcodegen`, build, unit tests, simulator screenshots as artifacts; on tag `ios-v*` or manual run → archive, export, upload to TestFlight. Geo-check of both hosts from the runner (R1). `npm test` checks the four synced JSON copies | Empty-but-building app and widget on CI; geo-check result recorded in this file |
| **M1 Core** | `Shared/Core/*` ported from `core/*.kt`; `SpecVectorsTests` runs **all 7** vector files and asserts case counts (a skipped file fails); entity-decoding checks; `PickerSearch` cases ported from `PickerSearchTest.kt` | All vectors green on CI, case counts printed in the log |
| **M2 Data** | ztoe schedule parser (rework), address lookup (both `all=1` formats, regex scanner off the main thread, fixtures from saved HTML), static directory generated from `spec/rems.json`, `PowerOnClient` (tri-state, 60 s cache), `NetworkProbe` (`NWPathMonitor`), `OutageStateStore` + address index as versioned JSON in the App Group container (excluded from backup, `completeUntilFirstUserAuthentication`), `OutageRepository`, `SubscriptionRepository` + migration from single-address keys, settings key migration (handover §5.3) | Parser and repository tests green with fixtures; a CI job that does one live fetch prints the parsed queue table |
| **M3 Design** | `ZtTokens` from `design-tokens.json`, `Glass.swift` (section 4), `TimeOfDayPalette`, `AmbientMotion`, `OutageRowFormat`, drum view (`TimelineBar`) with stripes, needle and ticks, shared by app and widget | Screenshot gallery on CI: every component, iOS 26 and iOS 17 simulator, light/dark wallpaper, Reduce Transparency on |
| **M4 Screens** | Navigation with page swipes (Main / Settings / About), first-launch language + queue/address selection, Main (address switcher, Today/Tomorrow tabs, drum, rows, site status chip + banners, site notice card, emergency banner, Facebook link, donations), Settings (up to 5 addresses with reorder, searchable picker, "?" queue help dialog, planned and emergency switches, sound, advance notice, refresh interval, language, test alert, reset), About (disclaimer, privacy policy, version, links; no roulette) | Screens match Android 1.4.0 screenshots side by side; strings check green (section 7) |
| **M5 Notifications + background** | `NotificationPlanner` (rolling window of ≤40 planned alerts over all addresses, diff by key, `UNCalendarNotificationTrigger` in Europe/Kyiv), emergency events from `EmergencyLedger` (immediate), `BGAppRefreshTask` full refresh, foreground refresh, removal of old `block_*` requests, contextual permission request (R5) | Unit test feeds vector alert plans and asserts the pending set; TestFlight device test: alert arrives on time with the app killed |
| **M6 Widgets** | Small (status + countdown), Medium (status, countdown, drum, rows, bell + refresh buttons), Medium «Графік» (drum + info line); `AppIntentConfiguration` with an `AddressEntity` so each widget shows its own address (primary by default); timelines from `transitions()`; Liquid Glass + rendering modes (section 4) | Widget drum produces the same 48 states as the app drum (shared code + test); screenshots in full-colour, clear and tinted styles |
| **M7 Review + TestFlight** | Section 5 items, app icon, privacy policy page, App Store screenshots from the UI-test flow (6.9" 1320×2868 and 6.5" 1284×2778, uk and en), review notes text | Build processed by App Store Connect, installed from TestFlight on your iPhone |
| **M8 Publishing guide** | `docs/ios/APP_STORE_PUBLISHING.md`: every App Store Connect screen and field in order, with the value to enter (Ukrainian and English), privacy questionnaire answers, age-rating answers, review notes, and what to do on a rejection | You can submit for review by following it without asking anything |

Rough size: Android is about 20 000 lines of Kotlin; without the roulette (≈4 800) the port is about 10 000–12 000 lines of Swift. The old iOS code (≈4 000 lines, 1.3.5 level) is reused where it still fits (CP1251 decoding, Kyiv zone, donations, widget intents), the rest is rewritten from the 1.4.0 Kotlin.

## 7. Keeping Android, web and iOS in parity

- **Behaviour:** vectors in `spec/vectors/` run on all three platforms; behaviour changes start in the spec (existing rule).
- **Strings:** new `scripts/check-ios-strings` run by `npm test`: every function in `AppStrings.kt` must exist in `AppStrings.swift` with identical uk/en literals, except an allow-list of Android-only strings (`exactAlarm*`, `refreshFloorHint`, `vibration`, roulette). iOS-only strings are added to `AppStrings.kt` first and marked iOS-only.
- **Invariants:** `tests/unit.test.ts` extends its checks to iOS files: app name in `Info.plist` (`CFBundleDisplayName`), `СВІТЛО Є` / `СВІТЛА НЕМАЄ` in the widget, no `ЗНЕСТРУМЛЕНО`, defaults 15/30, queue help text and `Зрозуміло`, Facebook link.
- **Changelog gate:** extended to `ios/App/UI/` and `ios/Widget/`.
- **Release checklist** in `CLAUDE.md`: add `ios/project.yml` `MARKETING_VERSION`.

## 8. What I need from you, and when

| When | What | Why |
|---|---|---|
| Before M0 merges | OK to add `.github/workflows/build-ios.yml` (CLAUDE.md asks for your approval on `.github/` changes). `build-apk.yml` is not touched | CI is the only compiler (D1) |
| Before M7 | Your **Team ID** (Membership page) | `DEVELOPMENT_TEAM` in `project.yml` |
| Before M7 | Register bundle ids `ua.blackout.prewarning` and `ua.blackout.prewarning.widget` and App Group `group.ua.blackout.prewarning` (the guide in M8 walks you through it; the ids may already be taken by someone else, then we pick new ones) | Signing |
| Before M7 | An **App Store Connect API key** (Team key, role App Manager) saved as GitHub secrets `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8`. CI then creates certificates and profiles itself (cloud signing), so no `.p12` exports | Upload to TestFlight from CI |
| M7 | A **privacy policy URL** and a **support URL** (GitHub Pages of this repo works) | Required App Store fields |
| M7 | An iPhone with TestFlight for the device checks in M5–M6 | Simulators do not show real background behaviour |

## 9. Open questions (answer any time before M7)

1. **Donations block on iOS.** Plan keeps it with Safari links (R3). If Review objects to the "Повернись живим" (military aid) link, fallback is to hide the block on iOS only. OK?
2. **Time Sensitive emergency alerts** (R13): turn on?
3. **App name in the store**: «Світло в Житомирі» is the invariant; store subtitle proposal: «Графік відключень ZTOE» (30 characters max). Final text goes into the M8 guide.
4. **Price and countries**: free; Ukraine only, or worldwide (Ukrainians abroad watching family addresses)?

## 10. Risks

| Risk | Effect | Mitigation |
|---|---|---|
| No local compiler | Slow edit → CI → fix loop | Small PRs, core first (pure Swift, fastest feedback), cached DerivedData in CI |
| GitHub macOS minutes | macOS minutes count 10× on private repos | Repo is public (checked 2026-11-14), so standard runners are free |
| Geo-blocking of data hosts (R1) | Rejection under 2.1 | Checked in M0, before any UI work |
| Background refresh frequency unknown | Emergency alerts late in background | Stated as best effort in app and store text; push relay is a later decision (handover M6) |
| Liquid Glass inside widgets not as expected | Visual only | Fallback style per section 4 |
