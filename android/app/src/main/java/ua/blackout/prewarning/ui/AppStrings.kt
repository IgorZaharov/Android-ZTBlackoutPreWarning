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
    fun powerUnclear(lang: String) = if (lang == "uk") "Невідомо" else "Unclear"
    fun outagesUnclear(lang: String) = if (lang == "uk") "Графіки не діють" else "Outages unclear"
    fun powerOnIn(lang: String) = if (lang == "uk") "Світло увімкнуть через:" else "Power on in:"
    fun powerOffIn(lang: String) = if (lang == "uk") "До відключення залишилось:" else "Time until outage:"
    fun outagePeriod(lang: String) = if (lang == "uk") "Період відключення:" else "Outage period:"
    fun nextPeriod(lang: String) = if (lang == "uk") "Найближчий період:" else "Next period:"
    fun today(lang: String) = if (lang == "uk") "Сьогодні" else "Today"
    fun tomorrow(lang: String) = if (lang == "uk") "Завтра" else "Tomorrow"
    fun blackoutHoursHeader(lang: String) = if (lang == "uk") "ГОДИНИ БЕЗ СВІТЛА НА ЦЕЙ ДЕНЬ:" else "BLACKOUT HOURS FOR TODAY:"
    fun blackoutHoursForDayHeader(lang: String) = if (lang == "uk") "Години відключень на сьогодні:" else "Blackout hours for today:"
    fun blackoutHoursForTomorrowHeader(lang: String) = if (lang == "uk") "Години відключень на завтра:" else "Blackout hours for tomorrow:"
    fun selectQueueAction(lang: String) = if (lang == "uk") "Виберіть чергу" else "Select queue"
    fun emergencyOutageTitle(lang: String) = if (lang == "uk") "Аварійне відключення!" else "Emergency outage!"
    fun emergencyStartLabel(lang: String) = if (lang == "uk") "Початок:" else "Start:"
    fun emergencyRestoreLabel(lang: String) = if (lang == "uk") "Орієнтовне відновлення:" else "Estimated restoration:"
    fun noBlackoutsScheduled(lang: String) = if (lang == "uk") "Відключень не заплановано" else "No blackouts scheduled"
    fun hourShort(lang: String) = if (lang == "uk") "год" else "h"
    fun lastUpdated(lang: String) = if (lang == "uk") "Останнє оновлення:" else "Last updated:"
    fun nextUpdated(lang: String) = if (lang == "uk") "Наступне оновлення:" else "Next update:"
    fun refreshSuccessToast(lang: String) = if (lang == "uk") "Сайт доступний, графік оновлено" else "Site reachable, schedule updated"
    fun errorNoInternet(lang: String) = if (lang == "uk") "Немає доступу до Інтернету" else "No Internet access"
    fun errorNoQueuesFound(lang: String) = if (lang == "uk") "На сайті не знайдено черг" else "No queues found on site"
    fun emergencyOutagesLabel(lang: String) = if (lang == "uk") "Інформація про аварійні відключення:" else "Emergency outages info:"
    const val EMERGENCY_OUTAGES_URL = "https://www.facebook.com/ztoe.com.ua"
    fun siteSchedulesLabel(lang: String) = "Графіки відключень на сайті"
    const val SITE_SCHEDULES_URL = "https://www.ztoe.com.ua/unhooking-search.php"

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
    fun emergencyNotifications(lang: String) = if (lang == "uk") "Сповіщення про аварійні відключення" else "Emergency outage notifications"
    fun languageTitle(lang: String) = if (lang == "uk") "МОВА ІНТЕРФЕЙСУ" else "INTERFACE LANGUAGE"
    fun testAlertBtn(lang: String) = if (lang == "uk") "Тест сповіщення" else "Test notification"
    fun refreshBtn(lang: String) = if (lang == "uk") "Оновити дані" else "Refresh data"
    fun resetDefaultsBtn(lang: String) = if (lang == "uk") "Скинути налаштування" else "Reset to defaults"
    fun resetConfirmTitle(lang: String) = if (lang == "uk") "Скинути налаштування?" else "Reset all settings?"
    // CRITICAL CONSTANTS — Default timers are 15 min (advance) and 30 min (refresh). Never modify on your own.
    fun resetConfirmDesc(lang: String) = if (lang == "uk") "Усі параметри повернуться до початкових значень (черга не обрана, таймери 15/30 хв)." else "All parameters will revert to defaults (queue unselected, timers 15/30 min)."
    fun resetYes(lang: String) = if (lang == "uk") "Скинути" else "Reset"
    fun cancel(lang: String) = if (lang == "uk") "Скасувати" else "Cancel"

    // =========================================================================================
    // CRITICAL TEXT — DO NOT MODIFY UNLESS EXPLICITLY REQUESTED
    // Numbered instruction for Users on how to find their queue ("?" Help popup in Settings)
    // =========================================================================================
    fun queueHelpTitle(lang: String) = if (lang == "uk") "Як дізнатися свою чергу" else "How to find your queue"
    fun queueHelpAddressSubtitle(lang: String) = if (lang == "uk") "(Або закрийте це вікно та виберіть тільки чергу)" else "(Or close this window and select directly)"
    fun queueHelpManualSearchTitle(lang: String) = if (lang == "uk") "Пошук вручну" else "Manual search"
    fun queueHelpSteps(lang: String): List<String> = if (lang == "uk") {
        listOf(
            "1. Відкрийте сторінку пошуку черги на сайті https://www.ztoe.com.ua/unhooking-search.php",
            "2. Оберіть свій РЕМ, населений пункт і вулицю.",
            "3. У таблиці знайдіть свій будинок і подивіться стовпці «Черга» і «Підчерга». Наприклад, черга 5 і підчерга 2 - це 5.2.",
            "4. Виберіть це значення у полі «Черга» у вікні налаштувань (кнопка ⚙)."
        )
    } else {
        listOf(
            "1. Open the queue lookup page on https://www.ztoe.com.ua/unhooking-search.php",
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
    fun aboutDonationsTitle(lang: String) = "Charity / Благодійність і Пожертви"
    fun devProfile(lang: String) = if (lang == "uk") "Профіль розробника" else "Developer profile"
    fun repoIssues(lang: String) = if (lang == "uk") "Повідомити про проблему (Issues)" else "Report an issue (Issues)"
    fun desktopApp(lang: String) = "Світло в Житомирі на Github"
    const val ABOUT_GITHUB_README_URL = "https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning/blob/main/README.md"
    fun disclaimerText(lang: String) = if (lang == "uk") "Дані про графіки завантажуються безпосередньо з сайту ztoe.com.ua. Застосунок не є офіційним сервісом АТ «Житомиробленерго» та не несе відповідальності за раптові зміни або аварійні відключення з боку НЕК «Укренерго»." else "Data loaded directly from ztoe.com.ua. App is not an official service of JSC Zhytomyroblenergo and is not responsible for sudden emergency cuts."

    // Zhytomyr Roulette Mini-Game Texts (Ukrainian / English depending on Main Application settings)
    fun rouletteLaunchButton(lang: String = "uk") = if (lang == "en") "Zhytomyr Roulette" else "Житомирська Рулетка"
    fun rouletteTitle(lang: String) = if (lang == "uk") "Житомирська Рулетка" else "Zhytomyr Roulette"
    fun rouletteSubtitle(lang: String) = if (lang == "uk") {
        "Стирайте захисний шар із 48 півгодинних білетів графіка відключень. Кожен світлий білет із цілою лампочкою збільшує рахунок (+1, +2, +3...), білет X2 подвоює бали, а червоний білет викликає блекаут!"
    } else {
        "Scratch off the 48 half-hour blackout timeslot tickets. Each beige ticket with an intact lightbulb increases your score (+1, +2, +3...), an X2 ticket doubles your score, while a red ticket triggers a blackout!"
    }
    fun rouletteStartBtn(lang: String) = if (lang == "uk") "Почати гру" else "Start"
    fun rouletteCloseBtn(lang: String) = if (lang == "uk") "Закрити гру" else "Close Game"
    fun roulettePowerPointsLabel(lang: String) = if (lang == "uk") "Бали Потужності" else "Power Points"
    fun roulettePowerShopBtn(lang: String) = if (lang == "uk") "Магазин Потужності" else "Power Shop"
    fun rouletteBackBtn(lang: String) = if (lang == "uk") "Назад" else "Back"
    fun roulettePointsLabel(lang: String) = if (lang == "uk") "Бали" else "Points"
    fun rouletteStreakLabel(lang: String) = if (lang == "uk") "Серія" else "Streak"
    fun rouletteRestartBtn(lang: String) = if (lang == "uk") "Спочатку" else "Restart Game"
    fun rouletteNewTicketsBtn(lang: String) = if (lang == "uk") "Нові білети" else "Get New Tickets"
    fun formatRouletteNewTicketsBtnWithCost(lang: String, refreshCount: Int): String {
        val base = rouletteNewTicketsBtn(lang)
        val cost = refreshCount.coerceAtLeast(0)
        val costStr = if (cost == 0) "0" else "-$cost"
        return "$base ($costStr)"
    }
    fun rouletteGameOverTitle(lang: String) = if (lang == "uk") "БЛЕКАУТ! ГРУ ЗАКІНЧЕНО" else "GAME OVER"
    fun rouletteFinalScoreLabel(lang: String) = if (lang == "uk") "Фінальний рахунок" else "Final Score"
    fun rouletteAllTimeBestScoreLabel(lang: String) = if (lang == "uk") "Найкращий Результат" else "All time best score"
    fun rouletteMainMenuBtn(lang: String = "uk") = if (lang == "uk") "Головне Меню" else "Main Menu"
    fun rouletteShareBtn(lang: String = "uk") = if (lang == "uk") "Поділитися" else "Share"
    fun rouletteDownloadImageBtn(lang: String = "uk") = if (lang == "uk") "Завантажити зображення" else "Download Image"
    fun rouletteImageSavedToast(lang: String = "uk") = if (lang == "uk") "Зображення збережено" else "Image saved"
    fun rouletteSoundLabel(lang: String = "uk") = if (lang == "uk") "Звук" else "Sound"
    fun rouletteMusicLabel(lang: String = "uk") = if (lang == "uk") "Музика" else "Music"
    fun rouletteLoadingText(lang: String) = if (lang == "uk") "Роздача білетів..." else "Dealing tickets..."
}
