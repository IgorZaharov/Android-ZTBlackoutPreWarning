# Publishing «Світло в Житомирі» on the App Store

Milestone M8 of `IOS_PORT_PLAN.md`. Follow the steps in order in App Store Connect
(https://appstoreconnect.apple.com). Every field has the value to enter. Ukrainian is the primary
language of the listing, English is the second localization.

Status on 2026-11-15: TestFlight builds upload from CI (`ios-v*` tags), the app record exists (CI could
not upload without it), the latest TestFlight build is confirmed on the owner's iPhone.

---

## 0. Before you start: blockers

Fix these first. Each one is a likely rejection or a step you cannot finish.

| # | Problem | What to do |
|---|---|---|
| B1 | **The privacy policy URL shows the Android-only text.** The app and this guide link to `.../blob/main/PRIVACY_POLICY.md`. The iOS sections (5A, both hosts, street ids) exist only on `feat/ios-port`. App Review opens the link and finds no word about iPhone (guideline 5.1.1). **Done 2026-11-15:** the iOS port is merged into `main` (PR #4), and the App Store listing uses its own iPhone-only policy `PRIVACY_POLICY_IOS.md` (owner request). Build 52's About page still links to the combined `PRIVACY_POLICY.md`, which also covers iPhone. |
| B2 | **The TestFlight diagnostics card is visible to App Review.** `WidgetDiag.isTestFlight` checks for a sandbox receipt. App Review installs builds with a sandbox receipt too, so the reviewer sees "Widget diagnostics (TestFlight)" in Settings. Test or debug content can be rejected under 2.2 / 2.3. **Done 2026-11-15:** the card and the logging are removed, tag `ios-v1.4.0-11`. Check that build on the iPhone (Settings has no diagnostics card, the widget buttons still work) and submit **that** build or a later one, never an older one. |
| B3 | **Support URL.** Apple requires a page where users can contact you. | Use the GitHub Issues page (below). Optional: add a contact e-mail to the README so users without a GitHub account can write. |
| B4 | **Open question 4 of the plan: countries.** | Answer in step 3 (recommendation: all countries except mainland China). |
| B5 | **EU trader status (Digital Services Act).** Without an answer the app is not offered in the EU. | Answer in step 2.6. |

---

## 1. App record (already created)

**Apps → «Світло в Житомирі» → App Information.** Check these read-only values:

| Field | Value |
|---|---|
| Bundle ID | `ua.blackout.prewarning` |
| SKU | the one you entered at creation (any unique text, for example `svitlo-zhytomyr-ios`) |
| Primary Language | **Ukrainian**. If it shows English, change it here (it decides which localization the store shows by default outside the listed languages). |

If the record had to be created again: **Apps → + → New App**, Platform iOS, Name `Світло в Житомирі`,
Primary Language Ukrainian, Bundle ID `ua.blackout.prewarning`, SKU as above, User Access Full Access.

---

## 2. App Information (General → App Information)

### 2.1 Localizable information

Switch the language in the top-right menu. Add **English (U.S.)** with **+ Add Language** if it is missing.

| Field (limit) | Ukrainian | English (U.S.) |
|---|---|---|
| Name (30) | `Світло в Житомирі` | `Світло в Житомирі` |
| Subtitle (30) | `Графік відключень світла` | `Zhytomyr power outage times` |

- The name is a test invariant; keep it in Cyrillic in both languages.
- Do **not** put "ZTOE" or "Житомиробленерго" in the name, subtitle or keywords. The company's name in
  metadata reads as an official app (guidelines 2.3.7, 5.2.1). It appears only in the description as a
  disclaimer.

### 2.2 General information

| Field | Value |
|---|---|
| Category, Primary | **Utilities** |
| Category, Secondary | **Lifestyle** (optional; leave empty if unsure) |
| Content Rights | **Yes**, the app contains, shows or accesses third-party content, and **Yes**, you have the necessary rights. Reason: the schedule is public factual information from the company's open pages; the app copies no text, logo or images. |

### 2.3 Age Rating (Edit)

Answer every question with **None** or **No**:

| Section | Answer |
|---|---|
| In-app controls: parental controls, age assurance | No |
| Capabilities: unrestricted web access | **No** (links open in Safari, there is no in-app browser) |
| Capabilities: user-generated content, messaging or chat, advertising | No |
| Mature themes (profanity, horror, alcohol/drugs, mature themes) | None |
| Medical or wellness topics | None |
| Sexuality or nudity | None |
| Violence | None |
| Chance-based activities (simulated gambling, contests, loot boxes) | None / No (the roulette is not in the iOS app) |
| Made for Kids | No |

Expected result: **4+**.

### 2.4 License Agreement

Leave the **Apple Standard License Agreement (EULA)**.

### 2.5 App Encryption Documentation

Nothing to do. `ITSAppUsesNonExemptEncryption = NO` is in `Info.plist`, so builds arrive without the
export-compliance question.

### 2.6 Digital Services Act (Business → Agreements / App Information → "Trader Status")

The question: are you a trader? A free app with no income, no ads and no purchases, made by a private
person, is usually **"I am not a trader"**. Then nothing is published about you, and the app is still
available in the EU. If you answer "trader", Apple shows your address, phone and e-mail on the EU
product page. This is a legal declaration; it is your call.

---

## 3. Pricing and Availability

| Field | Value |
|---|---|
| Price | **Free** (USD 0.00, tier 0) |
| Availability | **All countries or regions**, then **untick China mainland** (it needs an ICP filing number). Recommended because many people outside Ukraine watch their family's address. Optional: untick Russia and Belarus. |
| Pre-Orders | Off |
| App Distribution Methods | **Public** |
| iPhone and iPad Apps on Apple Silicon Macs | **Untick** "Make this app available". Widgets, background refresh and notifications were tested only on iPhone. |
| Apple Vision Pro | **Untick**. |
| Tax Category | Leave the default ("App Store software"). |

No Paid Apps agreement, no bank or tax forms are needed for a free app.

---

## 4. App Privacy (General → App Privacy)

| Field | Value |
|---|---|
| Privacy Policy URL | `https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning/blob/main/PRIVACY_POLICY_IOS.md` (iPhone only; the Android policy stays in `PRIVACY_POLICY.md`) |
| User Privacy Choices URL | empty |
| Data collection | **Get Started → "No, we do not collect data from this app"** → Save → **Publish**. |

Why "No": Apple counts data as collected when it leaves the device and you or a partner keep it longer
than needed to answer the request. The app has no server of its own, no SDKs and no analytics. The
public numeric ids of settlement and street that go to the PowerOn service are needed only to answer
that request, and the house number never leaves the device. This matches `PrivacyInfo.xcprivacy`
(`NSPrivacyCollectedDataTypes` is empty, `NSPrivacyTracking` is false). The product page will show
**"Data Not Collected"**.

---

## 5. Version page (iOS App → 1.4.0 Prepare for Submission)

If the left column shows "1.0", open it and change **Version** to `1.4.0` (it must equal
`MARKETING_VERSION` in `ios/project.yml`).

### 5.1 Screenshots

Source: GitHub Actions → latest green **iOS build, tests and TestFlight** run on `feat/ios-port` →
artifacts `ios-appstore-6.9` (1320 × 2868) and `ios-appstore-6.5` (1284 × 2778), each with `uk/` and `en/`.

| Language | 6.9" Display | 6.5" Display |
|---|---|---|
| Ukrainian | files from `ios-appstore-6.9/uk` | optional: `ios-appstore-6.5/uk` |
| English (U.S.) | files from `ios-appstore-6.9/en` | optional: `ios-appstore-6.5/en` |

- Only the 6.9" set is required; Apple scales it for smaller iPhones. Up to 10 images, drag to order;
  put the Main page first, then the widgets.
- No iPad screenshots: the app is iPhone only (`TARGETED_DEVICE_FAMILY = 1`).
- App Preview video: optional, skip.
- Check that the screenshots show the current widget buttons (after `7618733`). If the set is older,
  re-run the `appstore-screenshots` job (**Run workflow** on `feat/ios-port`).

### 5.2 Promotional Text (170, can change any time without review)

Ukrainian:
```
Графік відключень світла на Житомирщині: таймер, шкала доби, віджети й попередження до початку відключення. Безкоштовно, без реклами.
```

English:
```
Power outage schedule for the Zhytomyr region: countdown, 24-hour timeline, widgets and a warning before the power goes off. Free, no ads.
```

### 5.3 Description (4000)

Ukrainian:
```
«Світло в Житомирі» показує графік погодинних відключень електроенергії на Житомирщині і попереджає заздалегідь, щоб ви встигли зарядити телефон, зварити обід чи дістатися додому до того, як зникне світло.

ЩО ВМІЄ ЗАСТОСУНОК
• Черга або адреса. Виберіть свою чергу (від 1.1 до 6.2) або знайдіть її за адресою: район, населений пункт, вулиця, будинок.
• До п'яти адрес. Дім, робота, батьки: у кожної адреси своя черга і свої сповіщення.
• Таймер до наступного вимкнення або увімкнення.
• Шкала доби на сьогодні й завтра: 48 півгодинних проміжків, одразу видно, коли світла не буде.
• Аварійні відключення на вашій вулиці з орієнтовним часом відновлення.
• Попередження за 15 хвилин (або за вибраний вами час) до початку відключення, навіть коли застосунок закритий.
• Віджети на головний екран: малий, середній, великий і «Графік». Кожен віджет може показувати свою адресу, а кнопки дзвіночка й оновлення працюють прямо у віджеті.
• Стан сайту обленерго. Якщо сайт недоступний, застосунок показує останній збережений графік.
• Українська та англійська мови.

ПРИВАТНІСТЬ
Без реєстрації, без реклами, без аналітики і без відстеження. Адреси зберігаються лише на вашому iPhone.

ВАЖЛИВО
Це неофіційний безкоштовний застосунок з відкритим кодом. Він не пов'язаний з АТ «Житомиробленерго». Дані беруться з публічної сторінки графіків ztoe.com.ua та з публічного сервісу аварійних відключень. Остаточну інформацію перевіряйте на офіційному сайті обленерго.
```

English:
```
"Світло в Житомирі" ("Power in Zhytomyr") shows the rolling power-outage schedule of the Zhytomyr region of Ukraine and warns you in advance, so you can charge your phone, cook or get home before the power goes off.

FEATURES
• Queue or address. Pick your queue (1.1 to 6.2) or find it by address: district, settlement, street, house.
• Up to five addresses. Home, work, parents: each address has its own queue and its own warnings.
• Countdown to the next outage or to the power coming back.
• 24-hour timeline for today and tomorrow: 48 half-hour slots show at a glance when there is no power.
• Emergency outages on your street with the estimated restore time.
• A warning 15 minutes (or the time you choose) before an outage starts, even when the app is closed.
• Home-screen widgets: small, medium, large and "Графік" (timeline). Each widget can show its own address; the bell and refresh buttons work right in the widget.
• Status of the power company's site. When the site is down, the app shows the last saved schedule.
• Ukrainian and English.

PRIVACY
No account, no ads, no analytics, no tracking. Your addresses stay on your iPhone.

PLEASE NOTE
This is an unofficial, free, open-source app. It is not affiliated with JSC "Zhytomyroblenergo". The data comes from the public schedule page ztoe.com.ua and the public emergency-outage service. Always check the official site for the final information.
```

### 5.4 Keywords (100, comma-separated, no spaces after commas)

Words from the name and subtitle are indexed already; do not repeat them.

Ukrainian:
```
розклад,відключення,електроенергія,черга,блекаут,житомир,бердичів,коростень,звягель,таймер,віджет
```

English:
```
power,outage,blackout,schedule,electricity,ukraine,zhytomyr,queue,alert,widget,countdown,svitlo
```

### 5.5 URLs (per language, same values)

| Field | Value |
|---|---|
| Support URL | `https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning/issues` |
| Marketing URL (optional) | `https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning` |

### 5.6 General

| Field | Value |
|---|---|
| Version | `1.4.0` |
| Copyright | `2026 Igor Zaharov` |
| Routing App Coverage File | none (not a navigation app) |

### 5.7 Build

**Build → + (Add Build)** → pick the build made after blocker B2 (the number is the CI run number shown
in TestFlight). It must be "Ready to Submit" in TestFlight; no export-compliance question appears.

### 5.8 Game Center

Off.

### 5.9 App Review Information

| Field | Value |
|---|---|
| Sign-in required | **Unticked** (no account in the app) |
| Contact: first name, last name | your name |
| Contact: phone | your phone in international form, `+380…` (Apple calls it only if something blocks the review) |
| Contact: e-mail | an address you read daily; review messages also come to the Apple ID |
| Notes | paste the English block from `docs/ios/APP_REVIEW_NOTES.md` without changes (about 3600 of 4000 characters). Check the three ⟳ facts first. |
| Attachment | **Recommended:** a 30 to 60 s screen recording made in Ukraine on a day with outages: choose a queue, Main page with a countdown and red slots, add a widget, tap the widget refresh button. It answers a 2.1 "app looks empty" question before it is asked. |

### 5.10 Version Release

Pick **Manually release this version**. After approval you press **Release This Version** when you are
ready (for example together with the Android 1.4.x release). Phased release is offered only for updates.

---

## 6. Submit

1. **Save** on the version page. Fix every red field the page lists.
2. **Add for Review** (top right) → the submission sheet lists the version → **Submit to App Review**.
3. Status: Waiting for Review → In Review → Pending Developer Release (manual release) or Ready for
   Distribution. Review usually takes 1 to 2 days; the first review of a new app can take longer.
4. Answer questions in **App Review → Messages** (the Resolution Center). Use the table at the end of
   `APP_REVIEW_NOTES.md` for the likely ones.

---

## 7. After approval

1. **Release This Version** (manual release), then check the product page in the App Store app on the
   iPhone (it can take a few hours to appear in search).
2. Mark M7 and M8 done in `IOS_PORT_PLAN.md`; record the date and build number.
3. Later updates: bump `MARKETING_VERSION` with the rest of the release checklist in `CLAUDE.md`, tag
   `ios-vX.Y.Z-N` (CI uploads to TestFlight), create the new version in App Store Connect with
   **+ Version or Platform**, fill only **What's New in This Version** (170 to 4000 characters, from
   `CHANGELOG.md`), pick the build, submit. Turn on **Phased Release** for updates.

## 8. If App Review rejects

See the table "If Review asks questions or rejects" in `APP_REVIEW_NOTES.md`. Reply in the Resolution
Center first; change code only when the reply does not settle it. A rejected build is not lost: fix,
upload a new build, choose it on the same version page and submit again.
