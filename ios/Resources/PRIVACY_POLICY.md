# Privacy Policy / Політика конфіденційності

**Effective Date:** November 9, 2026  
**Last Updated:** November 9, 2026  
**Application Name:** Світло в Житомирі (iOS-ZTPreBlackoutNotification)  
**Bundle Identifier / Application ID:** `ua.blackout.prewarning` (Widget Extension: `ua.blackout.prewarning.widget`)  
**Developer / Publisher:** Igor Zaharov  
**Open-Source Repository:** [https://github.com/IgorZaharov/iOS-ZTPreBlackoutNotification](https://github.com/IgorZaharov/iOS-ZTPreBlackoutNotification)  
**Contact / Issue Tracker:** [https://github.com/IgorZaharov/iOS-ZTPreBlackoutNotification/issues](https://github.com/IgorZaharov/iOS-ZTPreBlackoutNotification/issues)  

---

## 1. Introduction and Scope

This Privacy Policy governs the native iOS mobile application **"Світло в Житомирі"** (Bundle Identifier `ua.blackout.prewarning`, hereinafter referred to as the "Application", "App", "we", "us", or "our"), created and maintained by Igor Zaharov as a free, open-source community utility for iPhone (`iOS 17.0+`).

The Application is designed to provide residents and organizations in the Zhytomyr region of Ukraine with timely, accurate information regarding scheduled electrical power outages (Графіки погодинних відключень електроенергії) published by **JSC "Zhytomyroblenergo" (АТ «Житомиробленерго»)**.

We are strictly committed to user privacy and digital sovereignty. This document outlines our data handling practices in accordance with the **Apple App Store Review Guidelines (Section 5.1 Privacy)**, **Apple Privacy Manifest Requirements (`PrivacyInfo.xcprivacy`)**, the **General Data Protection Regulation (GDPR) (EU) 2016/679**, the **Law of Ukraine "On Protection of Personal Data" (Закон України «Про захист персональних даних» № 2297-VI)**, and applicable international privacy standards.

---

## 2. Principle of Zero Data Collection & Apple Privacy Nutrition Labels

In strict adherence to the principle of data minimization (Article 5(1)(c) of the GDPR) and Apple App Store Connect Privacy Nutrition Label standards (`Data Not Collected`):

- **No Personal Data Collected (`NSPrivacyCollectedDataTypes = []`):** The Application does **not** collect, solicit, aggregate, record, store, sell, lease, or monetize any Personally Identifiable Information (PII).
- **No User Accounts:** There is no registration, login, profile creation, or authentication required to use the Application.
- **No Tracking or Behavioral Profiling (`NSPrivacyTracking = false`):** The Application contains no advertising frameworks, ad-tracking SDKs, or behavioral profiling mechanisms. It does not access the Apple Identifier for Advertisers (`IDFA`) and does not require `AppTrackingTransparency` prompts because zero cross-app tracking occurs.
- **No Analytics or Telemetry:** The Application does not integrate third-party analytics or crash-reporting SDKs (e.g., AppsFlyer, Mixpanel, or social tracking SDKs). We do not collect telemetry, diagnostic logs containing device identifiers, or usage statistics.
- **No Location Tracking:** The Application does not request or access CoreLocation (GPS), Wi-Fi SSID information, Bluetooth beacons, or cellular tower triangulation data.

---

## 3. Information Processed Locally on the User's Device (`PrivacyInfo.xcprivacy`)

All configuration settings and operational data created during application use are retained **strictly on the user's physical iPhone** within the sandboxed iOS application container and shared App Group (`UserDefaults` suite `group.ua.blackout.prewarning`). In compliance with Apple App Store Review Guideline 5.1.1, both the main app target and the WidgetKit extension bundle an official `PrivacyInfo.xcprivacy` manifest declaring:

- **Required Reason API:** `NSPrivacyAccessedAPICategoryUserDefaults`
- **Declared Reason Code:** `CA92.1` (Accessing user defaults to read and write information that is only accessible to the application itself and its embedded WidgetKit extension within the same App Group).

Locally stored parameters include:

1. **Selected Power Outage Queue:** The user's chosen consumer sub-queue (queues `1.1` through `6.2`).
2. **Notification & Pre-Warning Settings:** The user's chosen pre-warning lead time (1 to 240 minutes in advance, default 15 minutes), background refresh interval (default 30 minutes), sound toggles, and haptic feedback toggles.
3. **Audio Preferences:** Sound effects and music toggles for the built-in mini-game.
4. **WidgetKit Shared State:** Current schedule status and outage intervals shared solely between the main application and `BlackoutWidgetExtension` via `group.ua.blackout.prewarning`.
5. **Mini-Game State ("Житомирська Рулетка"):** Local game scores, all-time best score, daily streak counters, and power points stored locally in `UserDefaults`.

---

## 4. Network Connections and Data Sources

The Application uses Apple `URLSession` over HTTPS exclusively to fetch publicly accessible data necessary for its primary utility function:

1. **JSC "Zhytomyroblenergo" Official Schedule Server:**
   - **Target Endpoint:** `https://www.ztoe.com.ua/unhooking-search.php`
   - **Purpose:** Retrieving publicly published hourly power outage schedule HTML tables for the 12 consumer sub-queues.
   - **Data Transmitted:** Standard HTTPS GET requests. No user credentials, cookies, device identifiers, or personal parameters are sent with these requests.
2. **Static Configuration File (GitHub Raw):**
   - **Target Endpoint:** `https://raw.githubusercontent.com/IgorZaharov/Android-ZTBlackoutPreWarning/main/donations.json`
   - **Purpose:** Periodically retrieving optional community charity URLs once per 24 hours using standard conditional HTTP headers (`ETag` / `If-None-Match`).
   - **Data Transmitted:** Anonymous static file GET request. No telemetry or user information is transmitted.

---

## 5. iOS System Capabilities, Frameworks, and Technical Justification

In full compliance with Apple App Store Review Guidelines regarding user permissions and background execution, the Application requests only the minimal set of iOS capabilities strictly essential for its core utility:

| iOS Capability / Framework | Technical Requirement & Justification |
| :--- | :--- |
| `URLSession` (Outgoing HTTPS Network) | Required to communicate via TLS/HTTPS with the public servers of JSC "Zhytomyroblenergo" (`ztoe.com.ua`) and retrieve blackout schedules. |
| `UNUserNotificationCenter` (`UserNotifications`) | Required to schedule and present local calendar notifications (`UNCalendarNotificationTrigger` in `Europe/Kyiv` time) warning the user in advance of scheduled electrical outages. |
| `BGTaskScheduler` (`BGAppRefreshTask`: `ua.blackout.prewarning.sync`) | Required to periodically synchronize updated blackout schedules in the background and refresh WidgetKit timelines via `WidgetCenter.shared.reloadAllTimelines()`. |
| `App Groups` (`group.ua.blackout.prewarning`) | Required to share the parsed 48-slot schedule and notification state between the main iOS app and the Home Screen `WidgetKit` extension (`BlackoutWidgetExtension`). |

The Application does **not** request access to Contacts, Camera, Microphone, Location (`CoreLocation`), HealthKit, HomeKit, SiriKit, Bluetooth, or Apple Music.

---

## 6. Third-Party Links and External Services (Apple Guideline 3.2.1(vi) & 5.2.2)

The Application contains external hyperlinks that open in the system **Safari** browser for the convenience of the user:

- **JSC "Zhytomyroblenergo" (АТ «Житомиробленерго»):** [https://www.ztoe.com.ua](https://www.ztoe.com.ua) (The Application includes an explicit disclaimer confirming it is an independent utility and not an official service of JSC "Zhytomyroblenergo" or NEC "Ukrenergo").
- **Official Zhytomyroblenergo Facebook Page:** [https://www.facebook.com/ztoe.com.ua](https://www.facebook.com/ztoe.com.ua) for emergency outage announcements.
- **Voluntary Charitable Donations:** Direct links under `"Charity / Благодійність і Пожертви"` that open externally in Safari (`Link(destination:)`). In compliance with Apple App Store Review Guideline 3.2.1(vi), the Application does not process in-app payments, store banking credentials, or intercept financial transactions.
- **Project GitHub Repository:** [https://github.com/IgorZaharov/iOS-ZTPreBlackoutNotification](https://github.com/IgorZaharov/iOS-ZTPreBlackoutNotification)

---

## 7. Children's Privacy (COPPA, GDPR & Apple Age Rating Compliance)

The Application is a public utility intended for general audiences (Apple App Store Age Rating `4+`). It does not target, knowingly interact with, or collect information from children under the age of 13 (or under 16 within the European Economic Area).

Because the Application does not collect, retain, or transmit personal data of any kind, it is fully safe for all age groups and compliant with the **Children's Online Privacy Protection Act (COPPA)** and **Apple App Store Review Guidelines Section 1.3 (Kids Category & Child Safety)**.

---

## 8. Data Storage, Security, and Retention

- **Storage Location:** All user-specific settings are confined exclusively to the local iOS application sandbox and App Group container on the user's iPhone.
- **Security:** Data is protected by iOS hardware-backed Data Protection and application sandboxing architecture. In `Info.plist`, `ITSAppUsesNonExemptEncryption` is set to `false` as the Application uses only standard iOS operating system HTTPS/TLS encryption.
- **Data Deletion:** The user retains complete sovereignty over their data. All stored preferences and local caches can be irrevocably deleted at any time by:
  1. Tapping **"Reset to Defaults" ("Скинути до стандартних значень")** in the Application Settings tab; or
  2. Deleting the Application via **iOS Settings > General > iPhone Storage > Світло в Житомирі > Delete App**.

---

## 9. User Rights Under GDPR and Ukrainian Law

In accordance with Chapter III of the GDPR (Regulation (EU) 2016/679) and Article 8 of the Law of Ukraine "On Protection of Personal Data" (Закон України «Про захист персональних даних» № 2297-VI):

- Users possess rights regarding access, rectification, erasure, and restriction of processing of personal data.
- Because the Application processes **no personal data** on external servers and retains only user-controlled settings on the local iPhone, users directly exercise all rights of access, rectification, and erasure instantly through the application interface or by deleting the application.

---

## 10. Modifications to this Privacy Policy

We reserve the right to update this Privacy Policy to reflect changes in legal requirements, technical enhancements, or Apple App Store Review Guidelines. Any modifications will be posted to the official repository with an updated "Last Updated" date.

---

## 11. Contact Information

If you have questions, feedback, or legal inquiries concerning this Privacy Policy, please contact the developer through our public issue tracker:

- **Lead Developer:** Igor Zaharov
- **GitHub Issues:** [https://github.com/IgorZaharov/iOS-ZTPreBlackoutNotification/issues](https://github.com/IgorZaharov/iOS-ZTPreBlackoutNotification/issues)
- **Project Repository:** [https://github.com/IgorZaharov/iOS-ZTPreBlackoutNotification](https://github.com/IgorZaharov/iOS-ZTPreBlackoutNotification)

---

# Політика конфіденційності (Офіційна українська версія)

**Дата набрання чинності:** 9 листопада 2026 року  
**Останнє оновлення:** 9 листопада 2026 року  
**Назва застосунку:** Світло в Житомирі (`iOS-ZTPreBlackoutNotification`)  
**Ідентифікатор бандла (Bundle ID):** `ua.blackout.prewarning`  
**Розробник:** Ігор Захаров (Igor Zaharov)  
**Репозиторій проєкту:** [https://github.com/IgorZaharov/iOS-ZTPreBlackoutNotification](https://github.com/IgorZaharov/iOS-ZTPreBlackoutNotification)  

### 1. Загальні положення
Ця Політика конфіденційності регулює використання нативного iOS-застосунку **«Світло в Житомирі»** (`ua.blackout.prewarning`), розробленого відповідно до вимог **Apple App Store Review Guidelines** як безкоштовний некомерційний інструмент для жителів міста Житомира та Житомирської області для оперативного відстеження графіків погодинних відключень електроенергії (ГПВ) АТ «Житомиробленерго».

### 2. Повна відсутність збору персональних даних (`Data Not Collected`)
- Застосунок **не збирає**, не реєструє, не передає та не продає персональні дані користувачів (`NSPrivacyCollectedDataTypes = []`).
- Реєстрація або вхід в обліковий запис відсутні.
- У застосунку відсутні рекламні мережі, рекламні трекери (`NSPrivacyTracking = false`), сторонні аналітичні SDK та доступ до рекламного ідентифікатора Apple (`IDFA`).
- Застосунок не відстежує геопозицію користувача (`CoreLocation`).

### 3. Локальні дані на пристрої (`PrivacyInfo.xcprivacy`)
Усі налаштування користувача (номер черги від 1.1 до 6.2, час завчасного попередження, рівень звуку, локальні бали мінігри та кеш розкладу для віджета `WidgetKit`) зберігаються **виключно локально** у захищеному контейнері iOS `UserDefaults` (`group.ua.blackout.prewarning`, задекларована причина Apple Required Reason API: `CA92.1`) і ніколи не передаються стороннім особам чи серверам.

### 4. Мережеві запити
Застосунок звертається через захищене HTTPS-з'єднання (`URLSession`) виключно до:
1. Офіційного сайту АТ «Житомиробленерго» (`https://www.ztoe.com.ua/unhooking-search.php`) для завантаження відкритих графіків відключень.
2. Статичного файлу конфігурації у відкритому репозиторії GitHub (`https://raw.githubusercontent.com/IgorZaharov/Android-ZTBlackoutPreWarning/main/donations.json`) для оновлення посилань раз на добу.
Жодні ідентифікатори пристрою чи користувача під час цих запитів не надсилаються.

### 5. Системні дозволи та можливості iOS
- `UNUserNotificationCenter`: для показу точних локальних календарних сповіщень про наближення відключення світла.
- `BGTaskScheduler` (`ua.blackout.prewarning.sync`): для періодичного фонового оновлення графіків та таймлайну віджетів `WidgetKit`.
- `App Groups` (`group.ua.blackout.prewarning`): для синхронізації даних між головним застосунком і віджетом на екрані «Додому».

### 6. Видалення даних
Користувач може в будь-який момент повністю скинути всі локальні налаштування кнопкою **«Скинути до стандартних значень»** у вкладці «Налаштування» або видаливши застосунок у меню **Налаштування iOS > Основні > Сховище iPhone > Світло в Житомирі > Видалити додаток**.

### 7. Контакти
З будь-яких питань щодо функціонування застосунку або цієї політики можна звернутися через офіційний репозиторій:  
[https://github.com/IgorZaharov/iOS-ZTPreBlackoutNotification/issues](https://github.com/IgorZaharov/iOS-ZTPreBlackoutNotification/issues)
