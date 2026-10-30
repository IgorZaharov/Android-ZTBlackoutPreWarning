# ⚡ ZT Blackout Pre-Warning (Android)

[![Android CI/CD](https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning/actions/workflows/build-apk.yml/badge.svg)](https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning/actions)
[![Android](https://img.shields.io/badge/Platform-Android%208.0%2B-green.svg)](https://developer.android.com)
[![Jetpack Compose](https://img.shields.io/badge/UI-Jetpack%20Compose%20M3-blue.svg)](https://developer.android.com/jetpack/compose)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-yellow.svg)](LICENSE)

Мобільний застосунок для Android для своєчасного автоматичного інформування про планові та аварійні графіки погодинних відключень електроенергії (ГПВ) в мережах **АТ «Житомиробленерго»** ([ztoe.com.ua/unhooking-search.php](https://www.ztoe.com.ua/unhooking-search.php)). 

Створений на базі оригінального Windows Desktop додатку [UABlackoutPreWarning](https://github.com/IgorZaharov/UABlackoutPreWarning).

---

## 📱 Google Play Store

> 🚀 **Незабаром у Google Play:**  
> [Завантажити в Google Play Store](https://play.google.com/store/apps/details?id=ua.blackout.prewarning) *(посилання буде активовано після публікації)*.  
> Готові тестові APK та AAB бандли доступні в розділі [Releases](https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning/releases) та в артефактах GitHub Actions.

---

## ✨ Основні можливості (Features)

1. **Автоматичний парсинг офіційних графіків:**
   - Регулярна перевірка та аналіз офіційної таблиці погодинних відключень `ztoe.com.ua`.
   - Пошук рядка вибраної черги (1.1–6.2) та точне виділення періодів відключень (24 години).
2. **Точний зворотний відлік:**
   - Великий інформативний таймер із часом, що залишився до найближчого відключення або до відновлення електропостачання.
   - Чіткий 24-годинний графік із покажчиком поточного часу та бінарним статусом (світло є / відключення) для вибраної черги.
3. **Надійні завчасні сповіщення (Strict Single-Alert Rule):**
   - Налаштування власного часу попередження у хвилинах до настання відключення.
   - **Правило 1 сповіщення на слот:** система дедуплікації гарантує, що сповіщення надсилається **лише один раз** на кожен конкретний слот відключення.
   - Зручний перемикач увімкнення/вимкнення тривог безпосередньо на головному екрані.
4. **Довідка «Як дізнатися свою чергу»:**
   - Вбудована покрокова інструкція в налаштуваннях черги з прямим посиланням на офіційну сторінку пошуку адреси.
5. **Інтерактивний віджет робочого столу Android (Jetpack Glance):**
   - **Компактний розмір 2x1:** відображає чергу, статус, таймер до найближчого відключення та **окрему кнопку зупинки/відновлення сповіщень** безпосередньо з віджета!
   - **Розширений розмір 3x2 / 4x2:** повний зворотний відлік, діапазон годин, міні-шкала 24h та кнопка сповіщень.
   - **Клік по тілу віджета:** миттєво відкриває додаток.
6. **Дизайн Google Material 3 та теми:**
   - Повна підтримка світлої, темної (OLED економія батареї) та системної теми.
   - Двомовний інтерфейс: Українська та English (з автоматичним визначенням мови системи або ручним перемикачем).
7. **Повна автономність та CI/CD:**
   - Усі збірки APK та AAB формуються через GitHub Actions у хмарі.

---

## 🖼️ Скріншоти інтерфейсу (Screenshots)

```
┌───────────────────────────────┐     ┌───────────────────────────────┐
│  ⚡ ZT Blackout Pre-Warning   │     │  📱 Android Glance Widget     │
│  Черга 2.1 · ztoe.com.ua      │     │                               │
│                               │     │  ┌─────────────────────────┐  │
│  ┌─────────────────────────┐  │     │  │ Ч 2.1 · Через 1г 35хв   │  │
│  │ ДО ВІДКЛЮЧЕННЯ:         │  │     │  │ [🔕 Зупинити сповіщення]│  │
│  │       01 : 35 : 12      │  │     │  └─────────────────────────┘  │
│  │ Слот: 14:00 – 18:00     │  │     │                               │
│  └─────────────────────────┘  │     │  Натискання відкриває додаток │
│  [24-ГОДИННА ШКАЛА ЧАСУ]      │     └───────────────────────────────┘
│  [🔄 Оновити]  [🔔 Увімкнено] │
└───────────────────────────────┘
```

---

## 🏗️ Технічний стек (Architecture)

- **Мова:** Kotlin 2.0+
- **UI:** Jetpack Compose (Material 3)
- **AppWidget:** AndroidX Glance AppWidget 1.1.1
- **Фонова робота:** AndroidX WorkManager (CoroutineWorker)
- **Точні сигнали:** Android AlarmManager (`SCHEDULE_EXACT_ALARM`)
- **Парсинг:** Jsoup HTML Parser 1.18+
- **Збереження даних:** Jetpack DataStore Preferences

---

## 🚀 Збірка проекту (Building from Source)

Для збірки проекту через Gradle:

```bash
# Клонувати репозиторій
git clone https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning.git
cd Android-ZTBlackoutPreWarning

# Збірка Debug APK
./gradlew assembleDebug

# Збірка Release App Bundle (AAB) для Google Play
./gradlew bundleRelease
```

Згенерований APK знаходитиметься за шляхом:  
`app/build/outputs/apk/debug/app-debug.apk`

---

## 📋 Журнал змін (Changelog)

### Версія 1.0.0 (Поточний реліз)
- ✅ Початковий реліз нативного Android додатку з Jetpack Compose та Material 3.
- ✅ Модуль парсингу офіційних таблиць `https://www.ztoe.com.ua/unhooking-search.php`.
- ✅ Підтримка черг 1.1–6.2 та налаштування власної URL адреси.
- ✅ Точний 24-годинний графік із покажчиком поточного часу та таймером відліку.
- ✅ Механізм завчасного попередження з гарантією «1 сповіщення на слот».
- ✅ Віджети Glance (2x1 та 3x2) з кнопкою керування сповіщеннями та відкриттям додатку по кліку.
- ✅ Автоматичний CI/CD пайплайн на базі GitHub Actions для збірки APK/AAB.
- ✅ Двомовна локалізація (Українська / English) та підтримка системної темної теми.

---

## 👤 Автор та контакти

- **Розробник:** Ігор Захаров ([@IgorZaharov](https://github.com/IgorZaharov))
- **Повідомити про помилку / Пропозиції:** [GitHub Issues](https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning/issues)
- **Оригінальний Desktop проект:** [UABlackoutPreWarning](https://github.com/IgorZaharov/UABlackoutPreWarning)

---
*Додаток використовує відкриті публічні дані сайту ztoe.com.ua. Не є офіційним продуктом АТ «Житомиробленерго».*
