# Privacy Policy for iPhone / Політика конфіденційності для iPhone

**Application:** Світло в Житомирі (iPhone and its home-screen widgets)  
**Bundle Identifier:** `ua.blackout.prewarning` (widget extension `ua.blackout.prewarning.widget`)  
**Platform:** iOS 17.0 or newer, distributed through the Apple App Store  
**Developer:** Igor Zaharov  
**Effective Date:** November 15, 2026  
**Last Updated:** November 15, 2026  
**Contact:** [GitHub Issues](https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning/issues)  
**Source code:** [github.com/IgorZaharov/Android-ZTBlackoutPreWarning](https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning)

This policy covers only the iPhone app. The Android app has its own policy in
[PRIVACY_POLICY.md](PRIVACY_POLICY.md).

Українська версія нижче.

---

## 1. Summary

- The app does **not collect** personal data. There is no account, no sign-in, no advertising, no analytics, no crash-reporting service and no tracking.
- Your saved addresses and settings stay **on your iPhone**.
- To show the schedule and emergency outages, the app downloads **public data** from the regional power company's public pages and services. For emergency outages it sends the public codes of the settlement and street you chose; the **house number never leaves your iPhone**.
- The App Store label of this app is **"Data Not Collected"**.

The app is a free, open-source community project. It is not made by, endorsed by or affiliated with JSC "Zhytomyroblenergo" (АТ «Житомиробленерго»).

## 2. Data the app does not collect

The app does not collect, store on a server, sell or share:

- names, e-mail addresses, phone numbers or any contact details;
- location (the app never asks for GPS or any location permission);
- contacts, photos, camera, microphone, Bluetooth, health or fitness data;
- the advertising identifier (IDFA) or any other device identifier;
- usage statistics, diagnostics or crash reports.

The app does not track you across apps or websites, so it never shows the App Tracking Transparency prompt. It contains no third-party SDKs.

## 3. Data kept only on your iPhone

The app keeps these on the device, inside its own sandbox and the App Group container `group.ua.blackout.prewarning`, which only the app and its own widgets can read:

1. **Saved addresses or queues** (up to five): district, settlement, street, house number, the queue found for it (1.1 to 6.2), an optional custom name, and the notification switches for each.
2. **Settings:** warning lead time, notification sound, refresh interval, language.
3. **Cache:** the last downloaded schedule and the emergency outages last seen for each saved address, so the app and widgets work without a connection.

The cache files are excluded from iCloud and device backups. The developer has no server and never receives any of this data.

## 4. Network connections

The app connects over HTTPS only to:

| Host | Why | What is sent |
|---|---|---|
| `www.ztoe.com.ua` (page `unhooking-search.php`) | Download the public outage schedule; find the queue for an address | When you look up an address: the public ids of the district, settlement and street from the site's own address form. Nothing else. |
| `api-ztoe-poweron.inneti.net` (the public service behind `ztoe-poweron.inneti.net`) | Emergency outages and planned repair works on your street | The public ids of the chosen settlement and street. The house number is matched on the iPhone and is never sent. |
| `raw.githubusercontent.com` | Download the list of donation links shown on the About page (`donations.json`) | A plain file request. |
| `icons.duckduckgo.com` and the donation websites (`/favicon.ico`) | Show the small website icon next to each donation link | Only the donation website's domain name. |

No account data, cookies, device identifiers or personal details are sent with these requests. As with any internet request, the operators of these servers can see your IP address; the developer does not receive, store or combine it with anything.

## 5. iPhone permissions and system features

| Feature | Why it is used |
|---|---|
| **Notifications** | Local warnings before a planned outage and about emergency outages. The app asks only after you choose a queue or an address, and works fully without permission. All notifications are created on the iPhone; there is no push server. |
| **Background App Refresh** (`fetch`) | Updates the schedule from time to time while the app is closed, so warnings and widgets stay current. iOS decides how often; you can turn it off in iOS Settings. |
| **Widgets and App Group** | Share the saved addresses and the cached schedule between the app and its widgets. The widget buttons (bell, refresh) run on the iPhone. |

The app's privacy manifest (`PrivacyInfo.xcprivacy`, app and widget) declares no tracking, no collected data types, and one required-reason API: `UserDefaults` (reasons `CA92.1` and `1C8F.1`, for the app's own settings and its App Group).

## 6. Links to other services

The app has links to the power company's site and Facebook page, to donation pages (a Monobank charity jar and the "Come Back Alive" foundation) and to this project on GitHub. They open in Safari, outside the app. The app takes no payments and receives nothing about what you do on those sites. Their own privacy policies apply there.

## 7. Children

The app is a general-audience utility with no account, no chat, no user content and no advertising. It collects no data from anyone, including children.

## 8. Deleting your data

All data is on your iPhone, so you are in control:

- **Settings → reset button** in the app removes the saved addresses and settings;
- **deleting the app** removes it together with its widgets and all App Group data.

There is nothing to delete on the developer's side, because nothing is stored there.

## 9. Your rights

The app processes no personal data on any server of the developer. The rights of access, correction and erasure under the GDPR (EU) 2016/679 and the Law of Ukraine "On Protection of Personal Data" are exercised directly on the device, as described in section 8.

## 10. Changes

Changes to this policy are published in this file with a new "Last Updated" date. The full history is in the public repository.

## 11. Contact

Questions about this policy: [github.com/IgorZaharov/Android-ZTBlackoutPreWarning/issues](https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning/issues)

---

# Політика конфіденційності для iPhone

**Застосунок:** Світло в Житомирі (iPhone і віджети головного екрана)  
**Ідентифікатор (Bundle ID):** `ua.blackout.prewarning` (віджет `ua.blackout.prewarning.widget`)  
**Платформа:** iOS 17.0 або новіша, App Store  
**Розробник:** Ігор Захаров (Igor Zaharov)  
**Набирає чинності:** 15 листопада 2026 року  
**Останнє оновлення:** 15 листопада 2026 року  
**Контакт:** [GitHub Issues](https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning/issues)

Ця політика стосується лише застосунку для iPhone. Для Android діє [PRIVACY_POLICY.md](PRIVACY_POLICY.md).

### 1. Коротко

- Застосунок **не збирає** персональних даних. Немає облікового запису, входу, реклами, аналітики, служби звітів про збої та відстеження.
- Збережені адреси й налаштування залишаються **на вашому iPhone**.
- Щоб показати графік і аварійні відключення, застосунок завантажує **публічні дані** з відкритих сторінок і сервісів обленерго. Для аварійних відключень надсилаються публічні коди вибраного населеного пункту та вулиці; **номер будинку ніколи не залишає iPhone**.
- Позначка застосунку в App Store: **«Дані не збираються»**.

Це безкоштовний неофіційний застосунок з відкритим кодом. Він не створений, не схвалений і не пов'язаний з АТ «Житомиробленерго».

### 2. Що застосунок не збирає

Імена, e-mail, номери телефонів, геопозицію (дозвіл на геопозицію не запитується), контакти, фото, камеру, мікрофон, Bluetooth, дані здоров'я, рекламний ідентифікатор (IDFA) чи інші ідентифікатори пристрою, статистику використання, діагностику та звіти про збої. Застосунок не відстежує вас в інших застосунках і на сайтах і не містить сторонніх SDK.

### 3. Що зберігається лише на iPhone

У пісочниці застосунку та в контейнері App Group `group.ua.blackout.prewarning`, доступному лише застосунку та його віджетам:

1. **Збережені адреси або черги** (до п'яти): район, населений пункт, вулиця, номер будинку, знайдена черга (від 1.1 до 6.2), власна назва та перемикачі сповіщень.
2. **Налаштування:** час завчасного попередження, звук сповіщень, інтервал оновлення, мова.
3. **Кеш:** останній завантажений графік і аварійні відключення для кожної адреси, щоб застосунок і віджети працювали без зв'язку.

Файли кешу не потрапляють до резервних копій iCloud і пристрою. Розробник не має сервера й не отримує цих даних.

### 4. Мережеві запити

Лише через HTTPS до:

- `www.ztoe.com.ua` (сторінка `unhooking-search.php`): публічний графік відключень; під час пошуку адреси надсилаються лише публічні коди району, населеного пункту й вулиці з форми самого сайту.
- `api-ztoe-poweron.inneti.net` (публічний сервіс сайту `ztoe-poweron.inneti.net`): аварійні відключення й планові ремонти на вашій вулиці; надсилаються лише публічні коди населеного пункту й вулиці, номер будинку порівнюється на iPhone і нікуди не надсилається.
- `raw.githubusercontent.com`: список посилань на пожертви для сторінки «Про застосунок» (`donations.json`).
- `icons.duckduckgo.com` і сайти зі списку пожертв (`/favicon.ico`): маленька іконка біля посилання; запит містить лише домен сайту пожертв.

Жодних облікових даних, cookies, ідентифікаторів пристрою чи особистих даних не надсилається. Як і під час будь-якого запиту в інтернеті, власники цих серверів бачать IP-адресу; розробник її не отримує й не зберігає.

### 5. Дозволи та можливості iPhone

- **Сповіщення:** локальні попередження перед плановим відключенням і про аварійні відключення. Дозвіл запитується лише після вибору черги або адреси; без нього застосунок повністю працює. Push-сервера немає.
- **Фонове оновлення** (`fetch`): час від часу оновлює графік, коли застосунок закрито. Частоту визначає iOS; його можна вимкнути в налаштуваннях iOS.
- **Віджети та App Group:** спільні адреси й графік для застосунку та віджетів. Кнопки віджета (дзвіночок, оновлення) працюють на iPhone.

Маніфест конфіденційності (`PrivacyInfo.xcprivacy`) застосунку та віджета: без відстеження, без зібраних типів даних; єдиний API з обов'язковою причиною — `UserDefaults` (причини `CA92.1` і `1C8F.1`).

### 6. Посилання на інші сервіси

Посилання на сайт і сторінку Facebook обленерго, на сторінки пожертв (банка Monobank і фонд «Повернись живим») та на проєкт на GitHub відкриваються в Safari, поза застосунком. Застосунок не приймає платежів і нічого не дізнається про ваші дії на цих сайтах.

### 7. Діти

Застосунок для загальної аудиторії: без облікового запису, чату, вмісту користувачів і реклами. Він не збирає даних ні в кого, зокрема в дітей.

### 8. Видалення даних

- **Кнопка скидання в налаштуваннях** застосунку видаляє збережені адреси й налаштування;
- **видалення застосунку** видаляє його разом з віджетами та всіма даними App Group.

У розробника видаляти нічого, бо там нічого не зберігається.

### 9. Ваші права

Застосунок не обробляє персональних даних на серверах розробника. Права на доступ, виправлення та видалення за GDPR (ЄС) 2016/679 і Законом України «Про захист персональних даних» ви здійснюєте безпосередньо на пристрої (розділ 8).

### 10. Зміни

Зміни публікуються в цьому файлі з новою датою оновлення; уся історія є в публічному репозиторії.

### 11. Контакт

[github.com/IgorZaharov/Android-ZTBlackoutPreWarning/issues](https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning/issues)
