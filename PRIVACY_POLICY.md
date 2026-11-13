# Privacy Policy / Політика конфіденційності

**Effective Date:** November 9, 2026  
**Last Updated:** November 9, 2026  
**Application Name:** Світло в Житомирі (ZTBlackoutPreWarning)  
**Package Name / Application ID:** `com.ZTBlackoutPreWarning`  
**Developer / Publisher:** Igor Zaharov  
**Open-Source Repository:** [https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning](https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning)  
**Contact / Issue Tracker:** [https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning/issues](https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning/issues)  

---

## 1. Introduction and Scope

This Privacy Policy governs the mobile application **"Світло в Житомирі"** (package name `com.ZTBlackoutPreWarning`, hereinafter referred to as the "Application", "App", "we", "us", or "our"), created and maintained by Igor Zaharov as a free, open-source community utility.

The Application is designed to provide residents and organizations in the Zhytomyr region of Ukraine with timely, accurate information regarding scheduled electrical power outages (Графіки погодинних відключень електроенергії) published by **JSC "Zhytomyroblenergo" (АТ «Житомиробленерго»)**.

We are strictly committed to user privacy and digital sovereignty. This document outlines our data handling practices in accordance with the **Google Play Developer Program Policies**, the **General Data Protection Regulation (GDPR) (EU) 2016/679**, the **Law of Ukraine "On Protection of Personal Data" (Закон України «Про захист персональних даних» № 2297-VI)**, and applicable privacy standards.

---

## 2. Principle of Zero Data Collection (Data Minimization)

In strict adherence to the principle of data minimization (Article 5(1)(c) of the GDPR):

- **No Personal Data Collected:** The Application does **not** collect, solicit, aggregate, record, store, sell, lease, or monetize any Personally Identifiable Information (PII).
- **No User Accounts:** There is no registration, login, profile creation, or authentication required to use the Application.
- **No Advertising or Behavioral Profiling:** The Application contains no advertising frameworks, ad-tracking SDKs, or commercial behavioral profiling mechanisms. It does not access the Android Advertising ID (AAID).
- **No Analytics or Telemetry:** The Application does not integrate third-party analytics services (e.g., Google Analytics for Firebase, Firebase Crashlytics, AppsFlyer, Mixpanel, or Facebook SDK). We do not collect telemetry, diagnostic crash reports containing device IDs, or usage statistics.
- **No Location Tracking:** The Application does not request or access GPS, coarse location, Wi-Fi SSID information, or cellular tower triangulation data.

---

## 3. Information Processed Locally on the User's Device

All configuration settings and operational data created during application use are retained **strictly on the user's physical device** within the sandboxed Android application private storage (`SharedPreferences` under `Context.MODE_PRIVATE`). This information is never transmitted to any external server or third party.

Locally stored parameters include:

1. **Selected Power Outage Queue:** The user's chosen consumer sub-queue (e.g., queues `1.1` through `6.2`).
2. **Notification & Pre-Warning Settings:** The user's chosen pre-warning lead time (e.g., 15 or 30 minutes in advance), sound toggles, and vibration toggles.
3. **Audio Preferences:** Sound effects and music volume sliders.
4. **Offline Cache:** Cached electricity outage schedule tables to enable offline viewing when network access is unavailable.
5. **Mini-Game State ("Житомирська Рулетка"):** Local game scores, achievements, daily streak counters, and mini-game power points.

---

## 4. Network Connections and Data Sources

The Application requires internet access exclusively to fetch publicly accessible data necessary for its primary utility function:

1. **JSC "Zhytomyroblenergo" Official Schedule Server:**
   - **Target Endpoint:** `https://www.ztoe.com.ua/unhooking-search.php`
   - **Purpose:** Retrieving publicly published hourly power outage schedule HTML tables for the 12 consumer sub-queues.
   - **Data Transmitted:** Standard HTTPS requests. When the user looks up an address in Settings, the identifiers of the chosen district, settlement and street (public option ids from the site's own address form) are sent as form fields to find the matching queue. No user credentials, cookies, device identifiers, or personal parameters are sent with these requests.
2. **JSC "Zhytomyroblenergo" Emergency Outage Service (PowerOn):**
   - **Target Endpoint:** `https://api-ztoe-poweron.inneti.net/api/` (the public data service behind `https://ztoe-poweron.inneti.net/`)
   - **Purpose:** Retrieving publicly published emergency outages and planned repair works for the street the user selected, so the Application can show them next to the schedule and notify the user.
   - **Data Transmitted:** Standard HTTPS GET requests carrying the public identifiers of the selected settlement and street as query filters. The house number is matched on the device and is never sent. No user credentials, cookies, device identifiers, or other personal parameters are sent.
3. **Static Configuration File (GitHub Raw):**
   - **Target Endpoint:** `https://raw.githubusercontent.com/IgorZaharov/Android-ZTBlackoutPreWarning/main/donations.json`
   - **Purpose:** Periodically retrieving optional community donation URLs and official information links using standard conditional HTTP headers (`ETag` / `If-Modified-Since`).
   - **Data Transmitted:** Anonymous static file GET request. No telemetry or user information is transmitted.

---

## 5. Android Device Permissions and Technical Justification

In full compliance with Google Play Developer Program Policies regarding sensitive permissions, the Application requests only the minimal set of Android system permissions strictly essential for its core utility:

| Permission | Technical Requirement & Justification |
| :--- | :--- |
| `android.permission.INTERNET` | Required to communicate via HTTPS with the public servers of JSC "Zhytomyroblenergo" (schedule site and emergency outage service) and retrieve blackout schedules and emergency outages. |
| `android.permission.ACCESS_NETWORK_STATE` | Required to verify whether an active Wi-Fi or cellular network connection is available prior to initiating network queries, and to tell the user whether a problem is "no internet" or "the power company's site is not responding". The check uses only the status the operating system already reports; no third-party host is contacted. |
| `android.permission.POST_NOTIFICATIONS` | Required on Android 13 (API level 33) and higher to present local notifications warning the user of imminent electrical outages according to their configured preference. |
| `android.permission.SCHEDULE_EXACT_ALARM` | Required to schedule exact, time-critical local alarms using Android `AlarmManager`. This ensures that pre-warning notifications trigger at the precise minute chosen by the user (e.g., exactly 15 minutes before an outage) even when the device is in low-power Doze mode. On Android 12 and newer the user grants this in the system setting "Alarms & reminders"; the Application explains this in Settings and opens the system screen on request. Without the permission, warnings are still delivered but may be a few minutes late. |
| `android.permission.RECEIVE_BOOT_COMPLETED` | Required to automatically restore and reschedule the user's configured local outage warning alarms following a device reboot or system time/timezone adjustment. |
| `android.permission.VIBRATE` | Required to deliver haptic vibration feedback alongside notifications if enabled in the user's notification channel settings. |
| `android.permission.WAKE_LOCK` | Required momentarily during exact alarm broadcasts to guarantee that the notification dispatch routine completes successfully before the device returns to sleep. |

The Application does **not** request access to contacts, cameras, microphones, location, phone state, external shared storage, SMS, or sensitive hardware sensors.

---

## 6. Third-Party Links and External Services

The Application contains hyperlinks to external third-party platforms for the convenience of the user:

- **JSC "Zhytomyroblenergo" (АТ «Житомиробленерго»):** [https://www.ztoe.com.ua](https://www.ztoe.com.ua) and its emergency outage service [https://ztoe-poweron.inneti.net](https://ztoe-poweron.inneti.net)
- **Official Zhytomyroblenergo Facebook Page:** For official emergency announcements.
- **Voluntary Community Donations (Monobank / Charity Jar):** Direct links that open in the user's external web browser or banking application. The Application does not process payments, store banking credentials, or receive transaction records.
- **Project GitHub Repository:** [https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning](https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning)

We do not control, oversee, or assume responsibility for the privacy practices, content, or policies of external websites. When navigating to third-party services, users are advised to review the respective third-party privacy notices.

---

## 7. Children's Privacy (COPPA & GDPR Compliance)

The Application is a public utility intended for general audiences. It does not target, knowingly interact with, or collect information from children under the age of 13 (or under 16 within the European Economic Area). 

Because the Application does not collect, retain, or transmit personal data of any kind, it is fully safe for all age groups and compliant with the **Children's Online Privacy Protection Act (COPPA)** and the **Google Play Families Policy**.

---

## 8. Data Storage, Security, and Retention

- **Storage Location:** All user-specific settings are confined exclusively to the local file system sandbox of the Android operating system on the user's device.
- **Security:** Data is protected by Android's application sandboxing architecture and file system encryption. We do not operate remote databases, cloud synchronization servers, or user data repositories.
- **Data Deletion:** The user retains complete sovereignty over their data. All stored preferences and local caches can be irrevocably deleted at any time by:
  1. Navigating on the device to **Settings > Apps > Світло в Житомирі > Storage > Clear Data**; or
  2. Uninstalling the Application from the device.

---

## 9. User Rights Under GDPR and Ukrainian Law

In accordance with Chapter III of the GDPR (Regulation (EU) 2016/679) and Article 8 of the Law of Ukraine "On Protection of Personal Data" (Закон України «Про захист персональних даних»):

- Users possess rights regarding access, rectification, erasure, and restriction of processing of personal data.
- Because the Application processes **no personal data** on external servers and retains only user-controlled settings on the local device, users directly exercise all rights of access, rectification, and erasure instantly through the application interface or by wiping local app data.

---

## 10. Modifications to this Privacy Policy

We reserve the right to update this Privacy Policy to reflect changes in legal requirements, technical enhancements, or Google Play Store standards. Any modifications will be posted to the official repository with an updated "Last Updated" date. Continued use of the Application after revisions constitutes acknowledgment of the updated terms.

---

## 11. Contact Information

If you have questions, feedback, or legal inquiries concerning this Privacy Policy, please contact the developer through our public issue tracker:

- **Lead Developer:** Igor Zaharov
- **GitHub Issues:** [https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning/issues](https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning/issues)
- **Project Repository:** [https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning](https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning)

---

# Політика конфіденційності (Офіційна українська версія)

**Дата набрання чинності:** 9 листопада 2026 року  
**Останнє оновлення:** 9 листопада 2026 року  
**Назва додатку:** Світло в Житомирі (ZTBlackoutPreWarning)  
**Ідентифікатор пакета (Package Name):** `com.ZTBlackoutPreWarning`  
**Розробник:** Ігор Захаров (Igor Zaharov)  
**Репозиторій проєкту:** [https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning](https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning)  

### 1. Загальні положення
Ця Політика конфіденційності регулює використання мобільного додатку **«Світло в Житомирі»** (`com.ZTBlackoutPreWarning`), розробленого як безкоштовний некомерційний інструмент для жителів міста Житомира та Житомирської області для оперативного відстеження графіків погодинних відключень електроенергії (ГПВ) АТ «Житомиробленерго».

### 2. Повна відсутність збору персональних даних
- Додаток **не збирає**, не реєструє, не передає та не продає персональні дані користувачів.
- Реєстрація або вхід в обліковий запис відсутні.
- У додатку відсутні рекламні мережі, рекламні трекери, аналітичні системи (наприклад, Google Analytics, Firebase SDK, Facebook SDK) та збір рекламних ідентифікаторів.
- Додаток не відстежує геопозицію користувача (GPS чи дані мережі).

### 3. Локальні дані на пристрої
Усі налаштування користувача (номер черги від 1.1 до 6.2, час завчасного попередження, рівень звуку, локальні бали мінігри) зберігаються **виключно локально** у захищеному сховищі пристрою (`SharedPreferences`) і ніколи не передаються стороннім особам чи серверам.

### 4. Мережеві запити
Додаток звертається через захищене з'єднання виключно до:
1. Офіційного сайту АТ «Житомиробленерго» (`https://www.ztoe.com.ua/unhooking-search.php`) для завантаження відкритих графіків відключень.
2. Публічного сервісу аварійних відключень АТ «Житомиробленерго» (`https://api-ztoe-poweron.inneti.net/api/`, сайт `https://ztoe-poweron.inneti.net/`) для отримання аварійних відключень і планових ремонтних робіт на вибраній вулиці. Надсилаються лише публічні коди вибраного населеного пункту та вулиці; номер будинку порівнюється на пристрої й нікуди не надсилається.
3. Статичного файлу конфігурації у відкритому репозиторії GitHub для оновлення офіційних посилань.
Жодні ідентифікатори пристрою чи користувача під час цих запитів не надсилаються.

### 5. Дозволи Android
- `INTERNET` та `ACCESS_NETWORK_STATE`: для отримання публічного графіка та перевірки наявності з'єднання.
- `POST_NOTIFICATIONS`: для показу локальних сповіщень про початок або завершення відключення.
- `SCHEDULE_EXACT_ALARM`: для спрацьовування таймера попередження у точний час. На Android 12 і новіше дозвіл «Будильники й нагадування» користувач вмикає в системних налаштуваннях; додаток підказує це в налаштуваннях і відкриває потрібний екран. Без дозволу попередження все одно приходять, але можуть запізнюватися на кілька хвилин.
- `RECEIVE_BOOT_COMPLETED`: для автоматичного відновлення запланованих таймерів після перезавантаження телефону.
- `VIBRATE` та `WAKE_LOCK`: для коректного доставлення сигналу сповіщення.

### 6. Видалення даних
Користувач може в будь-який момент повністю видалити всі локальні налаштування, очистивши дані програми в налаштуваннях Android або видаливши додаток.

### 7. Контакти
З будь-яких питань щодо функціонування додатку або цієї політики можна звернутися через офіційний репозиторій:  
[https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning/issues](https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning/issues)
