# App Review notes: «Світло в Житомирі» for iPhone

Text for the **App Review Information → Notes** field in App Store Connect (milestone M7 of
`IOS_PORT_PLAN.md`). The field takes about 4000 characters, so paste the English block below unchanged.
The Ukrainian block is for the owner and is not pasted.

Before each submission, check the three facts marked ⟳. They can change between versions.

## English (paste into App Store Connect)

```
WHAT THE APP DOES
"Світло в Житомирі" ("Power in Zhytomyr") shows the public power-outage schedule of the Zhytomyr region of Ukraine and warns the user before an outage starts. Ukraine has rolling blackouts; the regional power company publishes which group ("queue", 1.1 to 6.2) is switched off in which half-hour of the day. The app reads that table, shows a countdown, a 24-hour timeline and home-screen widgets, and schedules local notifications.

NOT AN OFFICIAL APP
The app is a free, open-source community project. It is not made by, endorsed by, or affiliated with JSC "Zhytomyroblenergo". It does not use the company's logo. The disclaimer is shown on the first screen and in About. Source code: https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning

DATA SOURCES (both public, no login, no API key)
1. https://www.ztoe.com.ua/unhooking-search.php - the public schedule page of the power company.
2. https://api-ztoe-poweron.inneti.net/api - the public JSON service behind the company's emergency-outage map (https://ztoe-poweron.inneti.net).
⟳ We checked from a server outside Ukraine (GitHub Actions, United States) that both hosts answer; the check runs on every build.

HOW TO TEST (no account needed)
1. On the first screen choose a language, then tap "Виберіть чергу" / "Select queue".
2. The quickest path: pick any queue, for example 5.2. To test an address: tap "?" and choose district "Житомирський РЕМ", settlement Zhytomyr (Житомир), any street and house; the app finds the queue on the power company's site.
3. The Main page shows whether power is on, the countdown to the next change, the timeline for today and tomorrow, and the list of outages. All times are Kyiv time, whatever the device time zone. The dock at the bottom (or a swipe) opens Settings and About.
4. Notifications: after a queue is chosen, a card on the Main page asks for permission. Settings has a "Тест сповіщення" / "Test notification" button that sends one at once.
5. Widgets: add "Світло в Житомирі" from the home-screen widget gallery (small, medium, large, and the "Графік" timeline widget). Long-press a widget and choose "Edit Widget" to pick which saved address it shows. On the widgets the bell turns all warnings on or off and the arrow reloads the schedule, without opening the app.
⟳ If the schedule is empty at review time, the company has not published outages for that day (no blackouts). This is the normal state on quiet days; the app then says there are no outages for the queue.

BACKGROUND
Warnings for the published schedule are scheduled as local calendar notifications, so they arrive with the app closed. Background App Refresh (BGAppRefreshTask) only fetches schedule updates; iOS decides how often. The only background mode is "fetch". There is no push server.

PRIVACY
No account, no analytics, no advertising, no tracking. Saved addresses stay on the device. To look up emergency outages the app sends the public numeric ids of the chosen settlement and street to the PowerOn service; the house number never leaves the device. Privacy policy: https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning/blob/main/PRIVACY_POLICY.md

DONATION LINKS (About page)
⟳ The About page lists links to Ukrainian charities (animal volunteers, the "Come Back Alive" foundation). They are plain links that open in Safari. The app does not collect money and has no in-app purchases; it is free and stays free.

CONTACT
Issues: https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning/issues
```

## Українською (для власника, не вставляти)

- **Що робить:** показує публічний графік погодинних відключень Житомирщини й попереджає до початку відключення: таймер, шкала доби, віджети, локальні сповіщення.
- **Неофіційний:** відкритий безкоштовний проєкт, не пов'язаний з АТ «Житомиробленерго», без логотипа компанії. Застереження є на першому екрані та в «Про застосунок».
- **Джерела даних:** сторінка графіка `ztoe.com.ua` і публічний сервіс аварійних відключень PowerOn. Обидва відповідають на запити з-за кордону (перевірка CI на кожній збірці).
- **Як перевірити:** вибрати чергу (наприклад 5.2) або адресу через «?»; кнопка «Тест сповіщення» в налаштуваннях; віджети з галереї віджетів.
- **Фон:** попередження за графіком заплановані як локальні сповіщення; фонове оновлення лише підтягує зміни, частоту визначає iOS; push-сервера немає.
- **Пожертви:** звичайні посилання, що відкриваються в Safari; покупок у застосунку немає.

## If Review asks questions or rejects

| Reason | Answer or change |
|---|---|
| 5.2.1 / 5.2.2 (the utility's name or content) | Point to the disclaimer and to the public data sources. The app copies no text or logo from the site; it shows the schedule as times and colours. If Review asks for permission from the company, ask the owner first; there is no such letter today. |
| 3.2.2 (donations) | The links open in Safari and the app takes no money. If Review still objects, the fallback is to hide the donations block on iOS only (plan section 9, question 1). |
| 2.1 (app looks empty) | The reviewer chose a queue with no outages that day. Answer with steps 2 and 3 above and a screen recording made in Ukraine on a day with outages. |
| 4.2 (minimum functionality) | Name the native features: widgets with their own address, interactive widget buttons, local notifications at the exact minute, emergency outages per address, background refresh. |
