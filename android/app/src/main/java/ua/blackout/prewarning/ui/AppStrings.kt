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

    // =========================================================================================
    // v1.4.0: ZTOE site status, outage rows, notifications, exact alarms.
    // Wording is mirrored in src/services/i18n.ts and listed in spec/NOTIFICATIONS.md and spec/SITE_STATE.md.
    // =========================================================================================
    private const val NBSP = " "

    fun siteStateWithTable(lang: String) = if (lang == "uk") "Сайт ZTOE доступний, графік опубліковано" else "ZTOE site online, schedule published"
    fun siteStateNoTable(lang: String) = if (lang == "uk") "Сайт ZTOE доступний, але графіка немає" else "ZTOE site online, but no schedule table"
    fun siteStateUnreachable(lang: String) = if (lang == "uk") "Сайт ZTOE недоступний, інтернет є" else "ZTOE site unreachable, your internet works"
    fun siteStateNoInternet(lang: String) = if (lang == "uk") "Немає інтернету" else "No internet connection"
    fun siteStateChecking(lang: String) = if (lang == "uk") "Перевірка сайту ZTOE…" else "Checking the ZTOE site…"
    fun siteStateHintNoTable(lang: String) = if (lang == "uk") "Графік ще не опубліковано або сторінка змінилась." else "The schedule is not published yet or the page has changed."
    fun siteStateHintUnreachable(lang: String) = if (lang == "uk") "Застосунок повторить спробу сам." else "The app will retry on its own."
    fun siteStateHintNoInternet(lang: String) = if (lang == "uk") "Перевірте з'єднання з Інтернетом." else "Check your internet connection."
    fun staleDataSince(lang: String, hhmm: String) = if (lang == "uk") "Показано збережений графік (дані за $hhmm)" else "Showing the saved schedule (data from $hhmm)"
    fun tomorrowPublished(lang: String) = if (lang == "uk") "Графік на завтра: опубліковано" else "Tomorrow's schedule: published"
    fun tomorrowNotPublishedShort(lang: String) = if (lang == "uk") "Графік на завтра: ще немає" else "Tomorrow's schedule: not yet"
    fun tomorrowNotPublished(lang: String) = if (lang == "uk") "Графік на завтра ще не опубліковано на сайті" else "Tomorrow's schedule is not published on the site yet"
    /** Title of the card that repeats the notice ztoe shows instead of the schedule table. */
    fun siteNoticeTitle(lang: String) = if (lang == "uk") "Повідомлення з сайту ztoe.com.ua" else "Notice from ztoe.com.ua"
    fun siteNoticeA11y(lang: String) = if (lang == "uk") "Повідомлення Житомиробленерго" else "Zhytomyroblenergo notice"
    fun poweronUnavailable(lang: String) = if (lang == "uk") "Аварійні відключення: дані недоступні" else "Emergency outages: data unavailable"

    fun kindPlanned(lang: String) = if (lang == "uk") "Планове" else "Planned"
    fun kindRepair(lang: String) = if (lang == "uk") "Планові роботи" else "Planned works"
    fun kindEmergency(lang: String) = if (lang == "uk") "Аварійне" else "Emergency"
    fun rowFinished(lang: String) = if (lang == "uk") "завершено" else "finished"
    fun rowOverdue(lang: String) = if (lang == "uk") "очікується відновлення" else "restoration pending"
    fun rowFromEarlier(lang: String, whenText: String) = if (lang == "uk") "з $whenText" else "from $whenText"
    fun rowUntilLater(lang: String, whenText: String) = if (lang == "uk") "до $whenText" else "until $whenText"
    fun rowMayContinue(lang: String) = if (lang == "uk") "можливе продовження" else "may continue"
    fun tomorrowWord(lang: String) = if (lang == "uk") "завтра" else "tomorrow"
    fun yesterdayWord(lang: String) = if (lang == "uk") "вчора" else "yesterday"

    /** "2 год", "1 год 30 хв", "45 хв" with non-breaking spaces so a value never splits across lines. */
    fun durationText(lang: String, totalMinutes: Long): String {
        val m = totalMinutes.coerceAtLeast(0L)
        val h = m / 60
        val mm = m % 60
        val hUnit = if (lang == "uk") "год" else "h"
        val mUnit = if (lang == "uk") "хв" else "min"
        return when {
            h > 0 && mm > 0 -> "$h$NBSP$hUnit $mm$NBSP$mUnit"
            h > 0 -> "$h$NBSP$hUnit"
            else -> "$mm$NBSP$mUnit"
        }
    }

    // --- planned alert (one per merged span) ---
    fun plannedAlertTitle(lang: String) = if (lang == "uk") "Попередження: відключення світла" else "Heads-up: power outage"
    fun plannedAlertBody(
        lang: String,
        queue: String,
        start: String,
        end: String,
        minutesLeft: Long,
        durationMinutes: Long,
        mayContinue: Boolean,
        /** `alertLabels` of the addresses (spec/SUBSCRIPTIONS.md 8.3); null keeps the 1.4.0 text. */
        labels: String? = null
    ): String {
        val dur = durationText(lang, durationMinutes)
        val uk = lang == "uk"
        val q = when {
            // a queue-only address is already labelled "Черга 5.2": no second queue in brackets
            labels != null && (queue.isBlank() || labels == "Черга $queue") -> "$labels: "
            labels != null -> if (uk) "$labels (черга $queue): " else "$labels (queue $queue): "
            queue.isBlank() -> ""
            uk -> "Черга $queue: "
            else -> "Queue $queue: "
        }
        val head = when {
            minutesLeft > 0 && uk -> "${q}відключення о $start (через $minutesLeft${NBSP}хв)"
            minutesLeft > 0 -> "${q}outage at $start (in $minutesLeft${NBSP}min)"
            uk -> "${q}відключення розпочинається зараз, о $start"
            else -> "${q}outage is starting now, at $start"
        }
        val tail = when {
            mayContinue && uk -> ", орієнтовно до $end ($dur), можливе продовження."
            mayContinue -> ", expected until $end ($dur), may continue."
            uk -> ", орієнтовно до $end ($dur)."
            else -> ", expected until $end ($dur)."
        }
        return head + tail
    }

    // --- emergency events ---
    fun emergencyStartTitle(lang: String) = if (lang == "uk") "Аварійне відключення" else "Emergency outage"
    fun emergencyUpcomingTitle(lang: String) = if (lang == "uk") "Заплановано аварійне відключення" else "Emergency outage scheduled"
    fun emergencyStartBody(lang: String, start: String, eta: String?) = when {
        lang == "uk" && eta != null -> "Початок: $start. Орієнтовне відновлення: $eta."
        lang == "uk" -> "Початок: $start. Час відновлення невідомий."
        eta != null -> "Start: $start. Estimated restoration: $eta."
        else -> "Start: $start. Restoration time unknown."
    }
    fun emergencyChangedTitle(lang: String) = if (lang == "uk") "Змінився час відновлення" else "Restoration time changed"
    fun emergencyChangedBody(lang: String, eta: String) = if (lang == "uk") "Нове орієнтовне відновлення: $eta." else "New estimated restoration: $eta."
    fun emergencyEndTitle(lang: String) = if (lang == "uk") "Аварійне відключення завершено" else "Emergency outage ended"
    fun emergencyEndBody(lang: String, start: String) =
        if (lang == "uk") "Електропостачання за вашою адресою відновлено (початок був: $start)." else "Power supply at your address has been restored (started: $start)."
    /** END before the estimated restore: PowerOn can not tell "restored early" from "cancelled" (spec/NOTIFICATIONS.md 2.5). */
    fun emergencyEarlyEndTitle(lang: String) = if (lang == "uk") "Аварійне відключення скасовано" else "Emergency outage cancelled"
    fun emergencyEarlyEndBody(lang: String, eta: String) =
        if (lang == "uk") "Відключення зникло зі списку до $eta: світло, імовірно, вже є." else "The outage left the list before $eta: power is probably back."

    // --- exact alarm permission (Android 12+) ---
    fun exactAlarmTitle(lang: String) = if (lang == "uk") "Дозвольте точні сповіщення" else "Allow exact alerts"
    fun exactAlarmBody(lang: String) = if (lang == "uk") {
        "Щоб попередження приходили вчасно, увімкніть для застосунку дозвіл «Будильники й нагадування» в налаштуваннях телефону. Без нього сповіщення можуть запізнюватись."
    } else {
        "To get warnings on time, turn on the \"Alarms & reminders\" permission for this app in the phone settings. Without it alerts can arrive late."
    }
    fun exactAlarmButton(lang: String) = if (lang == "uk") "Відкрити налаштування" else "Open settings"

    // --- main screen v1.4.0 ---
    fun mainUtilityName() = "Житомиробленерго (ZTOE)"
    fun mainLangAuto(lang: String) = if (lang == "uk") "Авто" else "Auto"
    fun switchOn(lang: String) = if (lang == "uk") "Увімкнено" else "On"
    fun switchOff(lang: String) = if (lang == "uk") "Вимкнено" else "Off"
    fun refreshing(lang: String) = if (lang == "uk") "Оновлення…" else "Refreshing…"
    fun staleChip(lang: String, hhmm: String) = if (lang == "uk") "дані за $hhmm" else "data from $hhmm"
    fun drumTitle(lang: String) = if (lang == "uk") "Шкала доби" else "Day timeline"
    fun drumNoOutages(lang: String) = if (lang == "uk") "відключень немає" else "no outages"
    fun drumPowerOffAt(lang: String, spans: String) = if (lang == "uk") "без світла: $spans" else "no power: $spans"
    fun drumEmergencyMark(lang: String) = if (lang == "uk") "аварійне" else "emergency"
    fun tabSelected(lang: String) = if (lang == "uk") "Обрано" else "Selected"
    // --- end main screen v1.4.0 ---

    // --- widget v1.4.0 ---
    fun widgetNoOutages(lang: String) = if (lang == "uk") "Відключень немає" else "No outages"
    fun widgetNoMoreOutages(lang: String) = if (lang == "uk") "Сьогодні більше немає" else "None more today"
    fun widgetTomorrowPrefix(lang: String) = if (lang == "uk") "Завтра" else "Tomorrow"
    // --- end widget v1.4.0 ---

    // --- settings v1.4.0 ---
    // Address picker (full-screen searchable list)
    fun pickerSearchHint(lang: String) = if (lang == "uk") "Пошук" else "Search"
    fun pickerNothingFound(lang: String) = if (lang == "uk") "Нічого не знайдено" else "Nothing found"
    fun pickerLoading(lang: String) = if (lang == "uk") "Завантаження…" else "Loading…"
    fun pickerLoadError(lang: String) = if (lang == "uk") "Не вдалося завантажити список" else "Could not load the list"
    fun pickerRetry(lang: String) = if (lang == "uk") "Повторити" else "Retry"
    fun pickerClearSearch(lang: String) = if (lang == "uk") "Очистити пошук" else "Clear search"
    fun pickerClose(lang: String) = if (lang == "uk") "Закрити" else "Close"
    fun pickerSelected(lang: String) = if (lang == "uk") "Обрано" else "Selected"
    fun pickerChooseFirst(lang: String) = if (lang == "uk") "Спочатку оберіть попереднє поле" else "Choose the previous field first"

    // Address lookup modal ("?")
    fun addrFindTitle(lang: String) = if (lang == "uk") "Пошук черги за адресою" else "Find Queue by Address"
    fun addrRemLabel(lang: String) = if (lang == "uk") "РЕМ" else "District (РЕМ)"
    fun addrCityLabel(lang: String) = if (lang == "uk") "Населений пункт" else "City / Settlement"
    fun addrStreetLabel(lang: String) = if (lang == "uk") "Вулиця" else "Street"
    fun addrHouseLabel(lang: String) = if (lang == "uk") "Будинок" else "House Number"
    fun addrRemPlaceholder(lang: String) = if (lang == "uk") "Оберіть РЕМ" else "Select district"
    fun addrCityPlaceholder(lang: String) = if (lang == "uk") "Оберіть населений пункт" else "Select settlement"
    fun addrStreetPlaceholder(lang: String) = if (lang == "uk") "Оберіть вулицю" else "Select street"
    fun addrHousePlaceholder(lang: String) = if (lang == "uk") "Оберіть будинок" else "Select house"
    fun addrHousePrefix(lang: String) = if (lang == "uk") "буд." else "bldg."
    fun addrChecking(lang: String) = if (lang == "uk") "Перевіряємо адресу на сайті…" else "Checking the address on the site…"
    fun addrCheckFailed(lang: String) = if (lang == "uk") "Не вдалося перевірити адресу на сайті. Показано збережені дані." else "Could not check the address on the site. Showing saved data."
    fun addrConfirm(lang: String) = if (lang == "uk") "Підтвердити вибір" else "Confirm selection"
    fun addrSaved(lang: String) = if (lang == "uk") "Адресу збережено" else "Address saved"

    // Settings cards
    fun noQueueNotDisconnected(lang: String) = if (lang == "uk") "Черга відсутня (не вимикається)" else "No queue (not disconnected)"
    fun testAlertSent(lang: String) = if (lang == "uk") "Тестове сповіщення надіслано" else "Test alert dispatched"
    fun settingsReset(lang: String) = if (lang == "uk") "Налаштування скинуто" else "Settings reset"
    fun langSystem(lang: String) = if (lang == "uk") "Системна" else "System"
    fun rangeMinutes(lang: String, from: Int, to: Int) = "$from–$to${NBSP}${minShort(lang)}"
    fun notificationsHint(lang: String) =
        if (lang == "uk") "Попередження за графіком: за вибраний час до початку відключення" else "Schedule alerts: shortly before a planned outage starts"
    fun emergencyHint(lang: String) = if (lang == "uk") "Аварійні сповіщення працюють окремо від планових" else "Emergency alerts work separately from planned ones"
    fun soundVibrationHint(lang: String) = if (lang == "uk") "Звук і вібрація діють для всіх сповіщень" else "Sound and vibration apply to all alerts"

    // Multi-address ("Мої адреси"), mirrored in src/services/i18n.ts
    fun myAddressesTitle(lang: String) = if (lang == "uk") "МОЇ АДРЕСИ" else "MY ADDRESSES"
    fun myAddressesDesc(lang: String) = if (lang == "uk") "Окремі сповіщення для кожної адреси" else "Separate alerts for each address"
    fun addressesCount(lang: String, n: Int, max: Int) = if (lang == "uk") "$n з $max" else "$n of $max"
    fun primaryBadge(lang: String) = if (lang == "uk") "Основна" else "Primary"
    fun emergencyAlertsTitle(lang: String) = if (lang == "uk") "АВАРІЙНІ ВІДКЛЮЧЕННЯ" else "EMERGENCY OUTAGES"
    fun emergencyAlertsDesc(lang: String) =
        if (lang == "uk") "Для всіх адрес. Про початок аварійного відключення сповіщення приходить завжди."
        else "For all addresses. The start of an emergency outage is always announced."
    fun emergencyEtaAlertsTitle(lang: String) = if (lang == "uk") "Зміна часу відновлення" else "Restoration time changes"
    fun emergencyEtaAlertsHint(lang: String) =
        if (lang == "uk") "Коли орієнтовний час відновлення переносять" else "When the estimated restoration moves"
    fun emergencyEndAlertsTitle(lang: String) = if (lang == "uk") "Світло відновлено" else "Power restored"
    fun emergencyEndAlertsHint(lang: String) =
        if (lang == "uk") "Коли аварійне відключення закінчилося" else "When the emergency outage has ended"
    fun reorderHandle(lang: String) = if (lang == "uk") "Перетягніть, щоб змінити порядок" else "Drag to reorder"
    fun moveUp(lang: String) = if (lang == "uk") "Перемістити вгору" else "Move up"
    fun moveDown(lang: String) = if (lang == "uk") "Перемістити вниз" else "Move down"
    fun masterOffCaption(lang: String) =
        if (lang == "uk") "Усі сповіщення вимкнені загальним перемикачем. Налаштування адрес збережені."
        else "All alerts are off by the main switch. Each address keeps its settings."
    fun widgetConfigTitle(lang: String) = if (lang == "uk") "Адреса віджета" else "Widget address"
    fun widgetConfigDesc(lang: String) = if (lang == "uk") "Яку адресу показує цей віджет" else "Which address this widget shows"
    fun widgetFollowPrimary(lang: String) = if (lang == "uk") "Основна адреса (авто)" else "Primary address (auto)"
    fun widgetFollowPrimaryHint(lang: String) = if (lang == "uk") "Змінюється разом з основною адресою" else "Changes when the primary address changes"
    fun makePrimary(lang: String) = if (lang == "uk") "Зробити основною" else "Make primary"
    fun plannedShort(lang: String) = if (lang == "uk") "Планові" else "Planned"
    fun plannedDesc(lang: String, min: Int) =
        if (lang == "uk") "За графіком, за $min${NBSP}хв до початку" else "Scheduled, $min${NBSP}min before start"
    fun emergencyShort(lang: String) = if (lang == "uk") "Аварійні" else "Emergency"
    fun emergencyDesc(lang: String) = if (lang == "uk") "Початок, зміна часу, відновлення" else "Start, time change, restoration"
    fun emergencyNeedsAddress(lang: String) =
        if (lang == "uk") "Лише для адреси: за чергою аварійних даних немає" else "Address only: a queue alone has no emergency data"
    fun queueOnlyCaption(lang: String) = if (lang == "uk") "Без адреси, лише черга" else "No address, queue only"
    fun addAddress(lang: String) = if (lang == "uk") "Додати адресу" else "Add address"
    fun addQueueOnly(lang: String) = if (lang == "uk") "Або додати лише чергу" else "Or add a queue only"
    fun addressesLeft(lang: String, n: Int) = if (lang == "uk") "Можна додати ще: $n" else "You can add $n more"
    fun addressLimitReached(lang: String, max: Int) = if (lang == "uk") "Досягнуто ліміт: $max адрес" else "Limit reached: $max addresses"
    fun addressDuplicate(lang: String) = if (lang == "uk") "Ця адреса вже є у списку" else "This address is already in the list"
    fun addressAdded(lang: String) = if (lang == "uk") "Адресу додано" else "Address added"
    fun removeAddress(lang: String) = if (lang == "uk") "Видалити" else "Remove"
    fun removeConfirmTitle(lang: String) = if (lang == "uk") "Видалити адресу?" else "Remove this address?"
    fun removeConfirmBody(lang: String, label: String) =
        if (lang == "uk") "«$label» зникне зі списку разом зі своїми сповіщеннями." else "\"$label\" and its alerts will be removed."
    fun renameAddress(lang: String) = if (lang == "uk") "Перейменувати" else "Rename"
    fun renameHint(lang: String) = if (lang == "uk") "Порожньо — назва з адреси" else "Empty — name from the address"
    fun save(lang: String) = if (lang == "uk") "Зберегти" else "Save"
    fun masterHint(lang: String) = if (lang == "uk") "Головний вимикач для всіх адрес" else "Master switch for all addresses"
    fun noAddressAlerts(lang: String) =
        if (lang == "uk") "Для жодної адреси сповіщення не ввімкнені" else "No address has alerts turned on"
    fun advanceNoticeHint(lang: String) = if (lang == "uk") "Для планових сповіщень" else "For planned alerts"
    fun refreshFloorHint(lang: String) =
        if (lang == "uk") "Android перевіряє не частіше ніж раз на 15 хв" else "Android checks at most once every 15 min"
    // --- end settings v1.4.0 ---

    // =========================================================================================
    // iOS only (docs/ios/IOS_PORT_PLAN.md sections 2 and 7): not shown on Android. Kept here so the
    // strings have one source; scripts/ios-strings.cjs generates ios/Shared/AppStrings.swift from this file.
    // =========================================================================================
    fun refreshFloorHintIos(lang: String) =
        if (lang == "uk") "У фоні iOS сама вирішує, коли перевіряти; аварійні сповіщення — за можливості" else "In the background iOS decides when to check; emergency alerts are best effort"
    fun soundHintIos(lang: String) = if (lang == "uk") "Звук діє для всіх сповіщень" else "Sound applies to all alerts"
    fun aboutDesktopNoticeIos(lang: String) =
        if (lang == "uk") "Застосунок є офіційною iOS-версією проєкту UA Blackout Pre-Warning для ПК." else "Official iOS version of the desktop UA Blackout Pre-Warning project."
    fun privacyPolicyIos(lang: String) = if (lang == "uk") "Політика конфіденційності" else "Privacy policy"
    fun externalLinkIos(lang: String) = if (lang == "uk") "Відкривається в Safari" else "Opens in Safari"
    fun notificationsDeniedIos(lang: String) =
        if (lang == "uk") "Сповіщення вимкнені в налаштуваннях iPhone" else "Notifications are turned off in the iPhone settings"
    fun openIosSettings(lang: String) = if (lang == "uk") "Відкрити налаштування" else "Open settings"
    // Permission card on Main, shown once a queue or address is chosen (App Review item R5)
    fun notificationsAskTitleIos(lang: String) = if (lang == "uk") "Увімкніть попередження" else "Turn on warnings"
    fun notificationsAskBodyIos(lang: String) =
        if (lang == "uk") "Застосунок попередить перед відключенням за графіком і повідомить про аварійні відключення. Без дозволу графік працює, але без сповіщень." else "The app warns you before a scheduled outage and tells you about emergency outages. Without permission the schedule still works, just without notifications."
    fun notificationsAskButtonIos(lang: String) = if (lang == "uk") "Дозволити сповіщення" else "Allow notifications"
    const val PRIVACY_POLICY_URL_IOS = "https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning/blob/main/PRIVACY_POLICY.md"
    // --- end iOS only ---
}
