import AppIntents
import WidgetKit

@available(iOS 17.0, *)
public struct RefreshScheduleIntent: AppIntent {
    public static var title: LocalizedStringResource = "Refresh ZTOE Schedule"
    public static var description = IntentDescription("Fetches the latest Zhytomyroblenergo schedule and updates widgets.")

    public init() {}

    public func perform() async throws -> some IntentResult {
        let settings = SettingsRepository.shared.loadSettings()
        _ = await ZtoeParser.fetchFullSchedule(urlStr: settings.url)
        NotificationScheduler.shared.syncAlarms(onTimeChanged: false)
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}

@available(iOS 17.0, *)
public struct ToggleAlertsIntent: AppIntent {
    public static var title: LocalizedStringResource = "Toggle Outage Notifications"
    public static var description = IntentDescription("Toggles blackout pre-warning alerts on or off while preserving sound and haptics.")

    public init() {}

    public func perform() async throws -> some IntentResult {
        let current = SettingsRepository.shared.loadSettings()
        _ = SettingsRepository.shared.updateNotificationsEnabled(!current.notificationsEnabled)
        NotificationScheduler.shared.syncAlarms(onTimeChanged: false)
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}
