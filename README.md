# Світло в Житомирі

<!-- LATEST_RELEASE_START -->
## Завантажити застосунок на телефон (Android)

**[Завантажити останню версію APK (v1.1.0)](https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning/releases/latest/download/app-release.apk)**

Як встановити:
1. Натисніть на посилання вище на своєму Android-телефоні — файл `app-release.apk` завантажиться автоматично.
2. Відкрийте завантажений файл (у сповіщеннях браузера або в папці «Завантаження» / «Downloads»).
3. Якщо телефон запитає дозвіл на встановлення з невідомих джерел або Google Play Захист покаже попередження, натисніть **«Все одно встановити»** (**«Install anyway»**).
<!-- LATEST_RELEASE_END -->

---

Android-застосунок, який стежить за графіком погодинних відключень електроенергії від **АТ «Житомиробленерго»** і попереджає про відключення заздалегідь. Показує, скільки лишилося до відключення (або до повернення світла), малює 24-годинну шкалу дня й має віджет для робочого столу.

Дані береться зі сторінки [ztoe.com.ua/unhooking-search.php](https://www.ztoe.com.ua/unhooking-search.php). Це неофіційний застосунок і він не пов'язаний із «Житомиробленерго».

Продовження десктопного проєкту [UABlackoutPreWarning](https://github.com/IgorZaharov/UABlackoutPreWarning).

<!--
Скріншоти: додайте файли в docs/screenshots/ і розкоментуйте таблицю.

| Головний екран | Налаштування | Віджет |
|:---:|:---:|:---:|
| <img src="docs/screenshots/main.png" width="240"> | <img src="docs/screenshots/settings.png" width="240"> | <img src="docs/screenshots/widget.png" width="240"> |
-->

## Можливості

- **Графік для вашої черги.** Застосунок завантажує таблицю відключень, знаходить рядок вибраної черги (1.1–6.2) і виділяє періоди без світла на сьогодні та, коли він опублікований, на завтра.
- **Зворотний відлік.** Великий таймер до найближчого відключення або до відновлення живлення, плюс шкала доби з маркером поточного часу.
- **Попередження заздалегідь.** Сповіщення за 5–240 хвилин до відключення, з точним спрацюванням через `AlarmManager`. На кожен слот приходить не більше одного сповіщення, навіть після оновлення даних чи перезапуску. Звук і вібрацію можна вимкнути окремо.
- **Віджет Glance.** Показує чергу, статус і таймер, має кнопку вмикання/вимкнення сповіщень, а дотик відкриває застосунок. Розмір від 2×1 і більше.
- **Фонове оновлення.** `WorkManager` періодично перевіряє сайт (мінімум раз на 15 хвилин, інтервал у застосунку налаштовується), а після перезавантаження телефона розклад і сигнали відновлюються.
- **Вигляд.** Material 3, світла/темна/системна тема, українська й англійська мови (за замовчуванням мова системи).

## Вимоги

- Android 8.0+ (API 26)
- Доступ до інтернету. Дозвіл на сповіщення (Android 13+) і точні будильники потрібні для попереджень.

## Збірка

Потрібні JDK 17 та Android SDK (compileSdk 35). Найпростіше відкрити папку `android/` в Android Studio.

З командного рядка:

```bash
git clone https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning.git
cd Android-ZTBlackoutPreWarning/android

gradle assembleDebug     # app/build/outputs/apk/debug/app-debug-*.apk
gradle bundleRelease     # app/build/outputs/bundle/release/app-release.aab
```

У репозиторії немає `gradle-wrapper.jar`, тому `./gradlew` не запрацює без нього. Використовуйте встановлений Gradle 8.11.1 (як у CI) або згенеруйте wrapper командою `gradle wrapper`.

Release-збірка поки підписується debug-ключем (`app/build.gradle.kts`). Для публікації в Google Play підставте власний keystore.

GitHub Actions ([`.github/workflows/build-apk.yml`](.github/workflows/build-apk.yml)) збирає debug APK та release AAB при кожному push і pull request у `main` і зберігає їх як артефакти запуску.

## Як це працює

1. `ScheduleSyncWorker` через `ZtoeParser` (Jsoup) завантажує сторінку й отримує слоти `POWER_ON` / `POWER_OFF` для черги. Дозволені лише адреси `ztoe.com.ua`.
2. Для кожного майбутнього відключення плануються точні сигнали (`AlarmReceiver`), а `AlertRegistry` запам'ятовує, про які слоти вже сповіщено.
3. Головний екран і віджет рахують таймер і шкалу з тих самих даних, тому показують однакові значення.
4. Налаштування зберігаються локально в `SharedPreferences`. Застосунок не збирає й нікуди не відправляє особисті дані.

## Структура репозиторію

```
android/                     Android-проєкт (Kotlin, Jetpack Compose)
  app/src/main/java/ua/blackout/prewarning/
    data/                    модель, парсер ztoe.com.ua, репозиторії
    notification/            AlarmReceiver, канали сповіщень
    worker/                  фонова синхронізація, відновлення після перезавантаження
    widget/                  віджет Glance і кнопка перемикання
    ui/                      екрани, компоненти, теми, локалізація
src/, index.html, vite.config.ts
                             веб-симулятор інтерфейсу (React + Vite), згенерований у AI Studio
scripts/                     допоміжні скрипти
```

Веб-симулятор потрібен лише для перегляду дизайну, у збірці застосунку він не бере участі. Запуск: `bun install && bun run dev`.

## Стек

Kotlin 2.0, Jetpack Compose + Material 3, Glance 1.1, WorkManager 2.10, Jsoup 1.18, Navigation Compose, Kotlin Coroutines. Збірка на AGP 8.7.

## Автор

Ігор Захаров ([@IgorZaharov](https://github.com/IgorZaharov)). Помилки й пропозиції надсилайте в [Issues](https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning/issues).
