import Foundation

/// User settings (mirror of android data/repository/SettingsRepository.kt). Field names and defaults
/// are those of spec/PERSISTENCE.md section 1; they live under their bare names in the App Group suite.
public final class SettingsRepository {
    public static let shared = SettingsRepository()

    public static let KEY_EMERGENCY_ETA_ALERTS = "emergency_eta_alerts"
    public static let KEY_EMERGENCY_END_ALERTS = "emergency_end_alerts"
    public static let DEFAULT_URL = "https://www.ztoe.com.ua/unhooking-search.php"

    let prefs: Prefs
    private let lock = NSLock()

    public init(prefs: Prefs = Prefs("zt_user_settings_v1", bareKeys: true)) {
        self.prefs = prefs
        migrateLegacySettingsIfNeeded()
    }

    /// The iOS app up to 1.3.5 wrote three fields under other names and the language in lower case
    /// (spec/PERSISTENCE.md, handover section 5.3): read the old name once, write the spec name. The
    /// retired emergency keys of 1.3.x are removed (the emergency state lives in the outage store).
    private func migrateLegacySettingsIfNeeded() {
        let renames = [
            ("advance_notice_minutes", "advance_minutes"),
            ("refresh_interval_minutes", "refresh_minutes"),
            ("theme", "theme_mode")
        ]
        for (old, new) in renames where prefs.contains(old) {
            if !prefs.contains(new) { prefs.set(new, prefs.object(old)) }
            prefs.remove(old)
        }
        for key in ["language", "theme_mode"] {
            if let v = prefs.string(key), v != v.uppercased() { prefs.set(key, v.uppercased()) }
        }
        for key in ["active_emergency_outage_id", "active_emergency_outage_type",
                    "active_emergency_outage_start", "active_emergency_outage_restore"] {
            prefs.remove(key)
        }
    }

    // CRITICAL CONSTANTS — DO NOT MODIFY DEFAULT VALUES (advance_minutes = 15, refresh_minutes = 30) UNLESS EXPLICITLY REQUESTED
    public func getSettings() -> UserSettings {
        let notificationsEnabled = prefs.bool("notifications_enabled", true)
        let emergencyNotificationsEnabled = prefs.bool("emergency_notifications_enabled", true)
        let rawSound = prefs.bool("sound_enabled", true)
        let rawVibration = prefs.bool("vibration_enabled", true)

        let remId = prefs.string("selected_rem", "")
        let settlementId = prefs.string("selected_settlement", "")
        let streetId = prefs.string("selected_street", "")
        let house = prefs.string("selected_house", "")

        let anyAlertsEnabled = soundGate(notificationsEnabled, emergencyNotificationsEnabled)

        var s = UserSettings()
        let url = prefs.string("city_url", SettingsRepository.DEFAULT_URL)
        s.cityUrl = url.ktIsBlank ? SettingsRepository.DEFAULT_URL : url
        s.queue = prefs.string("queue", "")
        s.customQueueStatusText = prefs.string("custom_queue_status_text", "").nonBlank
        s.selectedAddress = prefs.string("selected_address", "").nonBlank
        if !remId.ktIsBlank && !settlementId.ktIsBlank && !streetId.ktIsBlank && !house.ktIsBlank {
            s.selectedAddressQuery = SelectedAddressQuery(remId: remId, settlementId: settlementId, streetId: streetId, house: house)
        }
        s.refreshIntervalMinutes = min(max(prefs.int("refresh_minutes", 30), 1), 240)
        s.advanceNoticeMinutes = min(max(prefs.int("advance_minutes", 15), 1), 240)
        s.notificationsEnabled = notificationsEnabled
        s.emergencyNotificationsEnabled = emergencyNotificationsEnabled
        s.soundEnabled = anyAlertsEnabled ? rawSound : false
        s.vibrationEnabled = anyAlertsEnabled ? rawVibration : false
        s.prevSoundEnabled = prefs.bool("prev_sound_enabled", true)
        s.prevVibrationEnabled = prefs.bool("prev_vibration_enabled", true)
        s.emergencyEtaAlerts = prefs.bool(SettingsRepository.KEY_EMERGENCY_ETA_ALERTS, true)
        s.emergencyEndAlerts = prefs.bool(SettingsRepository.KEY_EMERGENCY_END_ALERTS, true)
        let theme = prefs.string("theme_mode", "SYSTEM")
        s.themeMode = theme.ktIsBlank ? "SYSTEM" : theme
        let lang = prefs.string("language", "SYSTEM")
        s.language = lang.ktIsBlank ? "SYSTEM" : lang
        return s
    }

    /// Whether sound and vibration may be on: the master switch once it is stored, else the 1.4.0 rule
    /// (spec/SUBSCRIPTIONS.md section 7), so a primary with both switches off never mutes the other addresses.
    private func soundGate(_ notificationsEnabled: Bool, _ emergencyNotificationsEnabled: Bool) -> Bool {
        if prefs.contains(SubscriptionRepository.KEY_MASTER) { return prefs.bool(SubscriptionRepository.KEY_MASTER, true) }
        return notificationsEnabled || emergencyNotificationsEnabled
    }

    public func saveSettings(_ settings: UserSettings) {
        lock.lock(); defer { lock.unlock() }
        let anyAlertsEnabled = soundGate(settings.notificationsEnabled, settings.emergencyNotificationsEnabled)
        prefs.set("city_url", settings.cityUrl)
        prefs.set("queue", settings.queue)
        prefs.set("custom_queue_status_text", settings.customQueueStatusText ?? "")
        prefs.set("selected_address", settings.selectedAddress ?? "")
        prefs.set("selected_rem", settings.selectedAddressQuery?.remId ?? "")
        prefs.set("selected_settlement", settings.selectedAddressQuery?.settlementId ?? "")
        prefs.set("selected_street", settings.selectedAddressQuery?.streetId ?? "")
        prefs.set("selected_house", settings.selectedAddressQuery?.house ?? "")
        prefs.set("refresh_minutes", min(max(settings.refreshIntervalMinutes, 1), 240))
        prefs.set("advance_minutes", min(max(settings.advanceNoticeMinutes, 1), 240))
        prefs.set("notifications_enabled", settings.notificationsEnabled)
        prefs.set("emergency_notifications_enabled", settings.emergencyNotificationsEnabled)
        prefs.set("sound_enabled", anyAlertsEnabled ? settings.soundEnabled : false)
        prefs.set("vibration_enabled", anyAlertsEnabled ? settings.vibrationEnabled : false)
        prefs.set(SettingsRepository.KEY_EMERGENCY_ETA_ALERTS, settings.emergencyEtaAlerts)
        prefs.set(SettingsRepository.KEY_EMERGENCY_END_ALERTS, settings.emergencyEndAlerts)
        prefs.set("theme_mode", settings.themeMode)
        prefs.set("language", settings.language)
        if anyAlertsEnabled {
            prefs.set("prev_sound_enabled", settings.soundEnabled)
            prefs.set("prev_vibration_enabled", settings.vibrationEnabled)
        } else {
            prefs.set("prev_sound_enabled", settings.prevSoundEnabled)
            prefs.set("prev_vibration_enabled", settings.prevVibrationEnabled)
        }
    }

    /// "Reset to defaults": every settings key is removed, then the defaults are written.
    @discardableResult
    public func resetAllAppDataToFirstLaunch() -> UserSettings {
        let fresh = UserSettings()
        for key in Self.settingsKeys + [SubscriptionRepository.KEY_STORE, SubscriptionRepository.KEY_MASTER] {
            prefs.remove(key)
        }
        saveSettings(fresh)
        return fresh
    }

    /// Every key of spec/PERSISTENCE.md section 1 (the bare settings store has no prefix to clear by).
    static let settingsKeys = [
        "city_url", "queue", "custom_queue_status_text", "selected_address", "selected_rem", "selected_settlement",
        "selected_street", "selected_house", "refresh_minutes", "advance_minutes", "notifications_enabled",
        "emergency_notifications_enabled", "emergency_eta_alerts", "emergency_end_alerts", "sound_enabled",
        "vibration_enabled", "prev_sound_enabled", "prev_vibration_enabled", "theme_mode", "language"
    ]

    @discardableResult
    public func updateNotificationsEnabled(_ enabled: Bool) -> UserSettings {
        updateSwitch(key: "notifications_enabled", enabled: enabled, otherOn: getSettings().emergencyNotificationsEnabled)
    }

    @discardableResult
    public func updateEmergencyNotificationsEnabled(_ enabled: Bool) -> UserSettings {
        updateSwitch(key: "emergency_notifications_enabled", enabled: enabled, otherOn: getSettings().notificationsEnabled)
    }

    /// Shared body of updateNotificationsEnabled / updateEmergencyNotificationsEnabled (identical in Kotlin).
    private func updateSwitch(key: String, enabled: Bool, otherOn: Bool) -> UserSettings {
        let current = getSettings()
        let anyWasEnabled = current.notificationsEnabled || current.emergencyNotificationsEnabled
        let anyNowEnabled = enabled || otherOn
        if !anyNowEnabled {
            // Both switches are now off: remember the active sound and vibration, then mute them
            prefs.set("prev_sound_enabled", anyWasEnabled ? current.soundEnabled : current.prevSoundEnabled)
            prefs.set("prev_vibration_enabled", anyWasEnabled ? current.vibrationEnabled : current.prevVibrationEnabled)
            prefs.set(key, false)
            prefs.set("sound_enabled", false)
            prefs.set("vibration_enabled", false)
        } else if !anyWasEnabled {
            // From all-off back to on: restore the remembered sound and vibration
            prefs.set(key, enabled)
            prefs.set("sound_enabled", prefs.bool("prev_sound_enabled", true))
            prefs.set("vibration_enabled", prefs.bool("prev_vibration_enabled", true))
        } else {
            prefs.set(key, enabled)
            prefs.set("sound_enabled", current.soundEnabled)
            prefs.set("vibration_enabled", current.vibrationEnabled)
            prefs.set("prev_sound_enabled", current.soundEnabled)
            prefs.set("prev_vibration_enabled", current.vibrationEnabled)
        }
        return getSettings()
    }

    /// Sound and vibration follow the alerts master switch (spec/SUBSCRIPTIONS.md section 7): off
    /// remembers and mutes them, on restores them. Called only when the master really changes.
    public func applyMasterSound(_ masterOn: Bool) {
        if masterOn {
            prefs.set("sound_enabled", prefs.bool("prev_sound_enabled", true))
            prefs.set("vibration_enabled", prefs.bool("prev_vibration_enabled", true))
        } else {
            // Raw keys, not getSettings(): the master is already stored as off, so getSettings() would
            // mask both to false and the restore would bring back "off"
            prefs.set("prev_sound_enabled", prefs.bool("sound_enabled", true))
            prefs.set("prev_vibration_enabled", prefs.bool("vibration_enabled", true))
            prefs.set("sound_enabled", false)
            prefs.set("vibration_enabled", false)
        }
    }

    /// Writes the primary subscription into the single-address keys (spec/SUBSCRIPTIONS.md section 7).
    /// Targeted: sound, vibration, timers, site and language are untouched.
    public func applyPrimaryMirror(_ m: LegacyMirror) {
        prefs.set("queue", m.queue)
        prefs.set("custom_queue_status_text", m.customQueueStatusText ?? "")
        prefs.set("selected_address", m.selectedAddress ?? "")
        prefs.set("selected_rem", m.remSlug)
        prefs.set("selected_settlement", m.settlementId)
        prefs.set("selected_street", m.streetId)
        prefs.set("selected_house", m.house)
        prefs.set("notifications_enabled", m.notificationsEnabled)
        prefs.set("emergency_notifications_enabled", m.emergencyNotificationsEnabled)
    }

    /// Writes only the queue assignment of a house that had none. Targeted on purpose: a background
    /// check that took seconds must not overwrite settings the user changed in the meantime.
    public func updateQueueAssignment(queue: String, statusText: String?) {
        prefs.set("queue", queue)
        prefs.set("custom_queue_status_text", statusText ?? "")
    }
}

extension String {
    /// Kotlin `takeIf { it.isNotBlank() }`.
    var nonBlank: String? { ktIsBlank ? nil : self }
}
