import Foundation

public final class SettingsRepository {
    public static let shared = SettingsRepository()
    public static let PREFS_NAME = "zt_user_settings_v1"

    private var defaults: UserDefaults {
        UserDefaults(suiteName: ScheduleRepository.APP_GROUP_ID) ?? .standard
    }

    public func readSafeInt(key: String, defaultValue: Int) -> Int {
        guard let obj = defaults.object(forKey: key) else { return defaultValue }
        if let intVal = obj as? Int { return intVal }
        if let numVal = obj as? NSNumber { return numVal.intValue }
        if let strVal = obj as? String, let parsed = Int(strVal) { return parsed }
        return defaultValue
    }

    public func readSafeLong(key: String, defaultValue: Int64) -> Int64 {
        guard let obj = defaults.object(forKey: key) else { return defaultValue }
        if let int64Val = obj as? Int64 { return int64Val }
        if let intVal = obj as? Int { return Int64(intVal) }
        if let numVal = obj as? NSNumber { return numVal.int64Value }
        if let strVal = obj as? String, let parsed = Int64(strVal) { return parsed }
        return defaultValue
    }

    public func readSafeBoolean(key: String, defaultValue: Bool) -> Bool {
        guard let obj = defaults.object(forKey: key) else { return defaultValue }
        if let boolVal = obj as? Bool { return boolVal }
        if let numVal = obj as? NSNumber { return numVal.boolValue }
        if let strVal = obj as? String {
            return strVal.lowercased() == "true" || strVal == "1"
        }
        return defaultValue
    }

    public func readSafeString(key: String, defaultValue: String) -> String {
        guard let obj = defaults.object(forKey: key) else { return defaultValue }
        if let strVal = obj as? String { return strVal }
        return "\(obj)"
    }

    public func loadSettings() -> UserSettings {
        let queue = readSafeString(key: "queue", defaultValue: "")
        let customStatus = readSafeString(key: "custom_queue_status_text", defaultValue: "")
        let selectedAddress = readSafeString(key: "selected_address", defaultValue: "")
        let selectedRem = readSafeString(key: "selected_rem", defaultValue: "")
        let selectedSettlement = readSafeString(key: "selected_settlement", defaultValue: "")
        let selectedStreet = readSafeString(key: "selected_street", defaultValue: "")
        let selectedHouse = readSafeString(key: "selected_house", defaultValue: "")
        let rawEmergencyStart = readSafeString(key: "active_emergency_outage_start", defaultValue: "")
        let rawEmergencyRestore = readSafeString(key: "active_emergency_outage_restore", defaultValue: "")
        let hasValidEmergency = ZtoeParser.isValidOutageTimestamp(rawEmergencyStart) && ZtoeParser.isValidOutageTimestamp(rawEmergencyRestore)
        let activeEmergencyStart = hasValidEmergency ? rawEmergencyStart : ""
        let activeEmergencyRestore = hasValidEmergency ? rawEmergencyRestore : ""
        let url = readSafeString(key: "city_url", defaultValue: AppStrings.DEFAULT_ZTOE_URL)
        let advance = min(240, max(1, readSafeInt(key: "advance_notice_minutes", defaultValue: 15)))
        let refresh = min(240, max(1, readSafeInt(key: "refresh_interval_minutes", defaultValue: 30)))
        let notificationsEnabled = readSafeBoolean(key: "notifications_enabled", defaultValue: true)
        let emergencyNotificationsEnabled = readSafeBoolean(key: "emergency_notifications_enabled", defaultValue: true)
        let soundEnabled = readSafeBoolean(key: "sound_enabled", defaultValue: true)
        let vibrationEnabled = readSafeBoolean(key: "vibration_enabled", defaultValue: true)
        let language = readSafeString(key: "language", defaultValue: "system")
        let theme = readSafeString(key: "theme", defaultValue: "system")

        return UserSettings(
            queue: UserSettings.ALL_QUEUES.contains(queue) ? queue : "",
            customQueueStatusText: customStatus.isEmpty ? nil : customStatus,
            selectedAddress: selectedAddress.isEmpty ? nil : selectedAddress,
            selectedRem: selectedRem.isEmpty ? nil : selectedRem,
            selectedSettlement: selectedSettlement.isEmpty ? nil : selectedSettlement,
            selectedStreet: selectedStreet.isEmpty ? nil : selectedStreet,
            selectedHouse: selectedHouse.isEmpty ? nil : selectedHouse,
            activeEmergencyOutageStart: activeEmergencyStart.isEmpty ? nil : activeEmergencyStart,
            activeEmergencyOutageRestore: activeEmergencyRestore.isEmpty ? nil : activeEmergencyRestore,
            url: url,
            advanceNoticeMinutes: advance,
            refreshIntervalMinutes: refresh,
            notificationsEnabled: notificationsEnabled,
            emergencyNotificationsEnabled: emergencyNotificationsEnabled,
            soundEnabled: soundEnabled,
            vibrationEnabled: vibrationEnabled,
            language: language,
            theme: theme
        )
    }

    public func saveSettings(_ settings: UserSettings) {
        let hasValidEmergency = ZtoeParser.isValidOutageTimestamp(settings.activeEmergencyOutageStart) && ZtoeParser.isValidOutageTimestamp(settings.activeEmergencyOutageRestore)
        defaults.set(settings.queue, forKey: "queue")
        defaults.set(settings.customQueueStatusText ?? "", forKey: "custom_queue_status_text")
        defaults.set(settings.selectedAddress ?? "", forKey: "selected_address")
        defaults.set(settings.selectedRem ?? "", forKey: "selected_rem")
        defaults.set(settings.selectedSettlement ?? "", forKey: "selected_settlement")
        defaults.set(settings.selectedStreet ?? "", forKey: "selected_street")
        defaults.set(settings.selectedHouse ?? "", forKey: "selected_house")
        defaults.set(hasValidEmergency ? (settings.activeEmergencyOutageStart ?? "") : "", forKey: "active_emergency_outage_start")
        defaults.set(hasValidEmergency ? (settings.activeEmergencyOutageRestore ?? "") : "", forKey: "active_emergency_outage_restore")
        defaults.set(settings.url, forKey: "city_url")
        defaults.set(min(240, max(1, settings.advanceNoticeMinutes)), forKey: "advance_notice_minutes")
        defaults.set(min(240, max(1, settings.refreshIntervalMinutes)), forKey: "refresh_interval_minutes")
        defaults.set(settings.notificationsEnabled, forKey: "notifications_enabled")
        defaults.set(settings.emergencyNotificationsEnabled, forKey: "emergency_notifications_enabled")
        defaults.set(settings.soundEnabled, forKey: "sound_enabled")
        defaults.set(settings.vibrationEnabled, forKey: "vibration_enabled")
        defaults.set(settings.language, forKey: "language")
        defaults.set(settings.theme, forKey: "theme")
    }

    public func updateNotificationsEnabled(_ enabled: Bool) -> UserSettings {
        var current = loadSettings()
        if !enabled {
            defaults.set(current.soundEnabled, forKey: "prev_sound_enabled")
            defaults.set(current.vibrationEnabled, forKey: "prev_vibration_enabled")
            current.notificationsEnabled = false
            current.soundEnabled = false
            current.vibrationEnabled = false
        } else {
            let prevSound = readSafeBoolean(key: "prev_sound_enabled", defaultValue: true)
            let prevVibration = readSafeBoolean(key: "prev_vibration_enabled", defaultValue: true)
            current.notificationsEnabled = true
            current.soundEnabled = prevSound
            current.vibrationEnabled = prevVibration
        }
        saveSettings(current)
        return current
    }

    public func updateEmergencyNotificationsEnabled(_ enabled: Bool) -> UserSettings {
        var current = loadSettings()
        current.emergencyNotificationsEnabled = enabled
        saveSettings(current)
        return current
    }

    public func resetDefaults() -> UserSettings {
        let def = UserSettings()
        defaults.set(true, forKey: "prev_sound_enabled")
        defaults.set(true, forKey: "prev_vibration_enabled")
        saveSettings(def)
        return def
    }
}
