import Foundation

public enum AppStrings {
    public static let APP_NAME = "Світло в Житомирі"
    public static let DEFAULT_ZTOE_URL = "https://www.ztoe.com.ua/unhooking-search.php"
    public static let EMERGENCY_OUTAGES_URL = "https://www.facebook.com/ztoe.com.ua"
    public static let ABOUT_GITHUB_README_URL = "https://github.com/IgorZaharov/iOS-ZTPreBlackoutNotification/blob/main/README.md"
    public static let ABOUT_IOS_GITHUB_URL = "https://github.com/IgorZaharov/iOS-ZTPreBlackoutNotification"
    public static let ABOUT_ISSUES_URL = "https://github.com/IgorZaharov/iOS-ZTPreBlackoutNotification/issues"

    public static func resolveLanguage(_ rawLang: String) -> String {
        if rawLang == "uk" || rawLang == "en" {
            return rawLang
        }
        let preferred = Locale.preferredLanguages.first?.lowercased() ?? "uk"
        return preferred.hasPrefix("en") ? "en" : "uk"
    }

    public static func widgetPowerOn(_ lang: String) -> String {
        lang == "en" ? "POWER ON" : "СВІТЛО Є"
    }

    public static func widgetPowerOff(_ lang: String) -> String {
        lang == "en" ? "POWER OFF" : "СВІТЛА НЕМАЄ"
    }

    public static func schedulesUnclear(_ lang: String) -> String {
        lang == "en" ? "Outages unclear" : "Графіки не діють"
    }

    public static func statusUnclear(_ lang: String) -> String {
        lang == "en" ? "Unclear" : "Невідомо"
    }

    public static func blackoutHoursForDayHeader(_ lang: String) -> String {
        lang == "en" ? "BLACKOUT HOURS FOR TODAY:" : "ГОДИНИ ВІДКЛЮЧЕНЬ НА СЬОГОДНІ:"
    }

    public static func blackoutHoursForTomorrowHeader(_ lang: String) -> String {
        lang == "en" ? "BLACKOUT HOURS FOR TOMORROW:" : "ГОДИНИ ВІДКЛЮЧЕНЬ НА ЗАВТРА:"
    }

    public static func emergencyOutagesLabel(_ lang: String) -> String {
        lang == "en" ? "Emergency outages info:" : "Інформація про аварійні відключення:"
    }

    public static func ztoeSiteSchedulesLinkLabel(_ lang: String) -> String {
        lang == "en" ? "Blackout schedules on website" : "Графіки відключень на сайті"
    }

    public static func donationsSectionTitle(_ lang: String) -> String {
        "Charity / Благодійність і Пожертви"
    }

    public static func aboutSubtitle(_ lang: String) -> String {
        lang == "en"
            ? "Advance blackout alerts for Zhytomyr and region"
            : "Завчасне інформування про відключення світла в Житомирі та області"
    }

    public static func aboutDescTitle(_ lang: String) -> String {
        lang == "en" ? "App Description" : "Опис застосунку"
    }

    public static func aboutDescText(_ lang: String) -> String {
        lang == "en"
            ? "Mobile application for timely pre-warnings about scheduled power outages in Zhytomyr and Zhytomyr Oblast based on official schedules from JSC «Zhytomyroblenergo» (ztoe.com.ua)."
            : "Мобільний застосунок для своєчасного інформування про планові відключення електроенергії у м. Житомир та Житомирській області на основі офіційних графіків АТ «Житомиробленерго» (ztoe.com.ua)."
    }

    public static func aboutDesktopNotice(_ lang: String) -> String {
        lang == "en"
            ? "Official mobile version of the desktop UA Blackout Pre-Warning project, optimized for background operation with minimal battery drain."
            : "Застосунок є офіційною мобільною версією проєкту UA Blackout Pre-Warning для ПК, оптимізований для автономної роботи у фоні з мінімальним споживанням батареї."
    }

    public static func aboutLinksTitle(_ lang: String) -> String {
        lang == "en" ? "Links & Development" : "Посилання та розробка"
    }

    public static func devProfile(_ lang: String) -> String {
        lang == "en" ? "Developer profile" : "Профіль розробника"
    }

    public static func aboutGithubRepoLabel(_ lang: String) -> String {
        "Світло в Житомирі на Github"
    }

    public static func repoIssues(_ lang: String) -> String {
        lang == "en" ? "Report an issue (Issues)" : "Повідомити про проблему (Issues)"
    }

    public static func disclaimerText(_ lang: String) -> String {
        lang == "en"
            ? "Data loaded directly from ztoe.com.ua. App is not an official service of JSC Zhytomyroblenergo and is not responsible for sudden emergency cuts."
            : "Дані про графіки завантажуються безпосередньо з сайту ztoe.com.ua. Застосунок не є офіційним сервісом АТ «Житомиробленерго» та не несе відповідальності за раптові зміни або аварійні відключення з боку НЕК «Укренерго»."
    }

    public static func privacyPolicyButton(_ lang: String) -> String {
        lang == "en" ? "Privacy Policy" : "Політика конфіденційності"
    }

    public static func queueHelpTitle(_ lang: String) -> String {
        lang == "en" ? "How to find your queue?" : "Як дізнатися свою чергу?"
    }

    public static func queueHelpSubtitle(_ lang: String) -> String {
        lang == "en"
            ? "(Or close this window and select directly)"
            : "(Або закрийте це вікно та виберіть тільки чергу)"
    }

    public static func settingsEmergencyOutages(_ lang: String) -> String {
        lang == "en"
            ? "Emergency outage notifications"
            : "Сповіщення про аварійні відключення"
    }

    public static func queueHelpConfirm(_ lang: String) -> String {
        lang == "en" ? "Got it" : "Зрозуміло"
    }

    public static func queueHelpSteps(_ lang: String) -> [String] {
        if lang == "en" {
            return [
                "1. Open the website https://www.ztoe.com.ua/unhooking-search.php",
                "2. Select your REM (district), settlement, street, and building number.",
                "3. Click the search button to load the outage table for your address.",
                "4. Note the sub-queue number (for example, 1.1, 2.2, or 4.1) and select it in the app."
            ]
        }
        return [
            "1. Перейдіть на сайт https://www.ztoe.com.ua/unhooking-search.php",
            "2. Оберіть ваш РЕМ, населений пункт, вулицю та номер будинку.",
            "3. Натисніть кнопку пошуку, щоб побачити таблицю відключень за вашою адресою.",
            "4. Подивіться номер підчерги (наприклад, 1.1, 2.2 або 4.1) та оберіть його у додатку."
        ]
    }

    public static func siteAddressTitle(_ lang: String) -> String {
        lang == "en" ? "Schedule Website URL" : "Адреса сайту графіків"
    }

    public static func siteReachable(_ lang: String) -> String {
        lang == "en" ? "Website verified & reachable" : "Сайт доступний і перевірений"
    }

    public static func errorNoQueuesFound(_ lang: String) -> String {
        lang == "en" ? "No blackout queues found on page" : "Черги відключень не знайдено"
    }

    public static func languageTitle(_ lang: String) -> String {
        lang == "en" ? "Application Language" : "Мова додатку"
    }

    public static func testAlertBtn(_ lang: String) -> String {
        lang == "en" ? "Send Test Notification" : "Тестове сповіщення"
    }

    public static func refreshBtn(_ lang: String) -> String {
        lang == "en" ? "Refresh Schedule Now" : "Оновити графік зараз"
    }

    public static func resetDefaultsBtn(_ lang: String) -> String {
        lang == "en" ? "Reset to Defaults" : "Скинути налаштування"
    }

    public static func notificationTitle(_ lang: String, isTest: Bool = false) -> String {
        if lang == "en" {
            return isTest ? "Test Alert: Power Outage" : "Warning: Power Outage"
        }
        return isTest ? "Тест: відключення світла" : "Попередження: відключення світла"
    }

    public static func notificationBody(
        _ lang: String,
        queue: String,
        advanceMinutes: Int,
        intervalText: String
    ) -> String {
        if lang == "en" {
            return "Queue \(queue): Power off in \(advanceMinutes) min (\(intervalText))."
        }
        return "Черга \(queue): відключення через \(advanceMinutes) хв (\(intervalText))."
    }
}
