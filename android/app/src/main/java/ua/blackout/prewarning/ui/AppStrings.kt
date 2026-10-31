package ua.blackout.prewarning.ui

import java.util.Locale

object AppStrings {
    fun resolveLang(prefLang: String): String {
        return when (prefLang.lowercase()) {
            "uk" -> "uk"
            "en" -> "en"
            else -> {
                val sys = Locale.getDefault().language.lowercase()
                if (sys == "uk") "uk" else "en"
            }
        }
    }

    // Main Screen Texts
    fun queue(lang: String) = if (lang == "uk") "Черга" else "Queue"
    fun powerOn(lang: String) = if (lang == "uk") "ЗАРАЗ СВІТЛО Є" else "POWER IS ON"
    fun powerOff(lang: String) = if (lang == "uk") "ЗАРАЗ НЕМАЄ СВІТЛА" else "POWER IS OFF"
    fun powerOnIn(lang: String) = if (lang == "uk") "Світло увімкнуть через:" else "Power on in:"
    fun powerOffIn(lang: String) = if (lang == "uk") "До відключення залишилось:" else "Time until outage:"
    fun outagePeriod(lang: String) = if (lang == "uk") "Період відключення:" else "Outage period:"
    fun nextPeriod(lang: String) = if (lang == "uk") "Найближчий період:" else "Next period:"
    fun today(lang: String) = if (lang == "uk") "Сьогодні" else "Today"
    fun tomorrow(lang: String) = if (lang == "uk") "Завтра" else "Tomorrow"
    fun blackoutHoursHeader(lang: String) = if (lang == "uk") "ГОДИНИ БЕЗ СВІТЛА НА ЦЕЙ ДЕНЬ:" else "BLACKOUT HOURS FOR THIS DAY:"
    fun noBlackoutsScheduled(lang: String) = if (lang == "uk") "Відключень не заплановано" else "No blackouts scheduled"
    fun hourShort(lang: String) = if (lang == "uk") "год" else "h"
    fun lastUpdated(lang: String) = if (lang == "uk") "Останнє оновлення:" else "Last updated:"
    fun nextUpdated(lang: String) = if (lang == "uk") "Наступне оновлення:" else "Next update:"
    fun refreshSuccessToast(lang: String) = if (lang == "uk") "Сайт доступний, графік оновлено" else "Site reachable, schedule updated"
    fun errorNoInternet(lang: String) = if (lang == "uk") "Немає доступу до Інтернету" else "No Internet access"
    fun errorNoQueuesFound(lang: String) = if (lang == "uk") "На сайті не знайдено черг" else "No queues found on site"
    fun emergencyOutagesLabel(lang: String) = if (lang == "uk") "Інформація про аварійні відключення:" else "Emergency outages info:"
    const val EMERGENCY_OUTAGES_URL = "https://www.facebook.com/ztoe.com.ua"

    // Settings Screen Texts
    fun settingsTitle(lang: String) = if (lang == "uk") "Налаштування" else "Settings"
    fun queueTitle(lang: String) = if (lang == "uk") "ЧЕРГА ВІДКЛЮЧЕННЯ" else "OUTAGE QUEUE"
    fun queueDesc(lang: String) = if (lang == "uk") "Оберіть підчергу за вашою адресою" else "Select sub-queue for your address"
    fun siteAddressTitle(lang: String) = if (lang == "uk") "АДРЕСА САЙТУ" else "SITE ADDRESS"
    fun siteAddressDesc(lang: String) = if (lang == "uk") "Адреса графіка відключень, зазвичай не потрібно змінювати" else "Schedule URL, usually no change needed"
    fun siteReachable(lang: String) = if (lang == "uk") "✓ Доступний" else "✓ Reachable"
    fun siteInvalid(lang: String) = if (lang == "uk") "⚠ Некоректна адреса" else "⚠ Invalid URL"
    fun advanceNoticeTitle(lang: String) = if (lang == "uk") "ПОПЕРЕДЖАТИ ЗАЗДАЛЕГІДЬ" else "ADVANCE WARNING NOTICE"
    fun refreshIntervalTitle(lang: String) = if (lang == "uk") "ІНТЕРВАЛ ПЕРЕВІРКИ САЙТУ" else "SITE REFRESH INTERVAL"
    fun minShort(lang: String) = if (lang == "uk") "хв" else "min"
    fun notifications(lang: String) = if (lang == "uk") "Увімкнути сповіщення" else "Enable notifications"
    fun sound(lang: String) = if (lang == "uk") "Звуковий сигнал" else "Sound"
    fun vibration(lang: String) = if (lang == "uk") "Вібрація" else "Vibration"
    fun languageTitle(lang: String) = if (lang == "uk") "МОВА ІНТЕРФЕЙСУ" else "INTERFACE LANGUAGE"
    fun testAlertBtn(lang: String) = if (lang == "uk") "Тест сповіщення" else "Test notification"
    fun refreshBtn(lang: String) = if (lang == "uk") "Оновити дані" else "Refresh data"
    fun resetDefaultsBtn(lang: String) = if (lang == "uk") "Скинути налаштування" else "Reset to defaults"
    fun resetConfirmTitle(lang: String) = if (lang == "uk") "Скинути налаштування?" else "Reset all settings?"
    // CRITICAL CONSTANTS — Default timers are 15 min (advance) and 30 min (refresh). Never modify on your own.
    fun resetConfirmDesc(lang: String) = if (lang == "uk") "Усі параметри повернуться до початкових значень (черга 1.1, таймери 15/30 хв)." else "All parameters will revert to defaults (queue 1.1, timers 15/30 min)."
    fun resetYes(lang: String) = if (lang == "uk") "Скинути" else "Reset"
    fun cancel(lang: String) = if (lang == "uk") "Скасувати" else "Cancel"

    // =========================================================================================
    // CRITICAL TEXT — DO NOT MODIFY UNLESS EXPLICITLY REQUESTED
    // Numbered instruction for Users on how to find their queue ("?" Help popup in Settings)
    // =========================================================================================
    fun queueHelpTitle(lang: String) = if (lang == "uk") "Як дізнатися свою чергу" else "How to find your queue"
    fun queueHelpSteps(lang: String): List<String> = if (lang == "uk") {
        listOf(
            "1. Відкрийте сторінку пошуку черги на сайті ztoe.com.ua.",
            "2. Оберіть свій РЕМ, населений пункт і вулицю.",
            "3. У таблиці знайдіть свій будинок і подивіться стовпці «Черга» і «Підчерга». Наприклад, черга 5 і підчерга 2 - це 5.2.",
            "4. Виберіть це значення у полі «Черга» у вікні налаштувань (кнопка ⚙)."
        )
    } else {
        listOf(
            "1. Open the queue lookup page on ztoe.com.ua.",
            "2. Select your distribution district (РЕМ), settlement, and street.",
            "3. In the table, find your building and check the «Queue» and «Subqueue» columns. For example, queue 5 and subqueue 2 is 5.2.",
            "4. Select this value in the «Queue» field in the Settings window (⚙ button)."
        )
    }
    fun queueHelpDesc(lang: String) = queueHelpSteps(lang).joinToString("\n\n")
    fun queueHelpGotIt(lang: String) = if (lang == "uk") "Зрозуміло" else "Got it"
    // =========================================================================================
    // END OF CRITICAL TEXT
    // =========================================================================================

    // About Screen Texts
    fun aboutTitle(lang: String) = "Світло в Житомирі"
    fun aboutSubtitle(lang: String) = if (lang == "uk") "Завчасне інформування про відключення світла в Житомирі та області" else "Advance blackout alerts for Zhytomyr and region"
    fun aboutDescTitle(lang: String) = if (lang == "uk") "ОПИС ЗАСТОСУНКУ" else "APP DESCRIPTION"
    fun aboutDescText(lang: String) = if (lang == "uk") "Автоматичний моніторинг графіків відключень електроенергії з офіційного сайту АТ «Житомиробленерго» (ztoe.com.ua). Застосунок своєчасно попереджає про початок відключення за вибраний інтервал часу та об'єднує послідовні години без світла в одне сповіщення." else "Automatic monitoring of blackout schedules from ztoe.com.ua. Alerts in advance before outages and merges consecutive slots into single notification."
    fun aboutDesktopNotice(lang: String) = if (lang == "uk") "Застосунок є офіційною Android-версією проєкту UA Blackout Pre-Warning для ПК, оптимізований для автономної роботи у фоні з мінімальним споживанням батареї." else "Official Android version of the desktop UA Blackout Pre-Warning project, optimized for background operation with minimal battery drain."
    fun aboutLinksTitle(lang: String) = if (lang == "uk") "ПОСИЛАННЯ ТА РОЗРОБКА" else "LINKS & DEVELOPMENT"
    fun aboutDonationsTitle(lang: String) = "Donations / Благодійність і Пожертви"
    fun devProfile(lang: String) = if (lang == "uk") "Профіль розробника" else "Developer profile"
    fun repoIssues(lang: String) = if (lang == "uk") "Повідомити про проблему (Issues)" else "Report an issue (Issues)"
    fun desktopApp(lang: String) = if (lang == "uk") "Оригінальний застосунок для Windows" else "Original Windows desktop app"
    fun disclaimerText(lang: String) = if (lang == "uk") "Дані про графіки завантажуються безпосередньо з сайту ztoe.com.ua. Застосунок не є офіційним сервісом АТ «Житомиробленерго» та не несе відповідальності за раптові зміни або аварійні відключення з боку НЕК «Укренерго»." else "Data loaded directly from ztoe.com.ua. App is not an official service of JSC Zhytomyroblenergo and is not responsible for sudden emergency cuts."
}
