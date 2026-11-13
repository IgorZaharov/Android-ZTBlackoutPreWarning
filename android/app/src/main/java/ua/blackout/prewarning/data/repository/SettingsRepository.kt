package ua.blackout.prewarning.data.repository

import android.content.Context
import android.content.SharedPreferences
import ua.blackout.prewarning.core.LegacyMirror
import ua.blackout.prewarning.data.model.EmergencyOutageInfo
import ua.blackout.prewarning.data.model.SelectedAddressQuery
import ua.blackout.prewarning.data.model.UserSettings
import ua.blackout.prewarning.data.parser.ZtoeAddressLookup

class SettingsRepository(context: Context) {
    private val appContext: Context = context.applicationContext
    private val prefs: SharedPreferences =
        appContext.getSharedPreferences("zt_user_settings_v1", Context.MODE_PRIVATE)

    init {
        migrateLegacySettingsIfNeeded()
    }

    companion object {
        fun readSafeInt(map: Map<String, *>, key: String, defaultVal: Int): Int {
            val raw = map[key] ?: return defaultVal
            return when (raw) {
                is Int -> raw
                is Number -> raw.toInt()
                is String -> raw.toIntOrNull() ?: defaultVal
                else -> defaultVal
            }
        }

        fun readSafeLong(map: Map<String, *>, key: String, defaultVal: Long): Long {
            val raw = map[key] ?: return defaultVal
            return when (raw) {
                is Long -> raw
                is Number -> raw.toLong()
                is String -> raw.toLongOrNull() ?: defaultVal
                else -> defaultVal
            }
        }

        fun readSafeBoolean(map: Map<String, *>, key: String, defaultVal: Boolean): Boolean {
            val raw = map[key] ?: return defaultVal
            return when (raw) {
                is Boolean -> raw
                is String -> raw.toBooleanStrictOrNull() ?: defaultVal
                is Number -> raw.toInt() != 0
                else -> defaultVal
            }
        }

        fun readSafeString(map: Map<String, *>, key: String, defaultVal: String): String {
            val raw = map[key] ?: return defaultVal
            return (raw as? String) ?: raw.toString()
        }
    }

    /**
     * Ensures settings from any earlier APK version (including 1.2.X and 1.3.3) or preference file are preserved seamlessly
     * when updating the application, without ever overwriting already-saved user settings or throwing ClassCastException.
     */
    private fun migrateLegacySettingsIfNeeded() {
        val currentAll = try { prefs.all } catch (_: Exception) { emptyMap<String, Any?>() }
        if (currentAll.isNotEmpty() &&
            !prefs.contains("queue") &&
            !prefs.contains("selected_address") &&
            !prefs.contains("custom_queue_status_text") &&
            (prefs.contains("refresh_minutes") || prefs.contains("advance_minutes") || prefs.contains("notifications_enabled") || prefs.contains("city_url"))
        ) {
            // In v1.3.3 and earlier, "1.1" was the default queue when "queue" had not been explicitly written to prefs yet
            try {
                prefs.edit().putString("queue", "1.1").apply()
            } catch (_: Exception) {}
        }
        if (prefs.contains("queue") || prefs.contains("city_url")) {
            // Normalize numeric types in-place if an older 1.2.X version stored refresh_minutes as Int or advance_minutes as Long
            try {
                val normRefresh = readSafeLong(currentAll, "refresh_minutes", 30L)
                val normAdvance = readSafeInt(currentAll, "advance_minutes", 15)
                prefs.edit()
                    .putLong("refresh_minutes", normRefresh)
                    .putInt("advance_minutes", normAdvance)
                    .apply()
            } catch (_: Exception) {}
            return
        }
        val legacyNames = listOf(
            "zt_user_settings",
            "blackout_prefs",
            "${appContext.packageName}_preferences",
            "ua.blackout.prewarning_preferences",
            "com.ZTBlackoutPreWarning_preferences"
        )
        for (name in legacyNames) {
            try {
                val legacy = appContext.getSharedPreferences(name, Context.MODE_PRIVATE)
                val legacyAll = legacy.all
                if (legacyAll.isNotEmpty() && (legacy.contains("queue") || legacy.contains("city_url"))) {
                    val editor = prefs.edit()
                    if (legacy.contains("city_url")) {
                        editor.putString("city_url", readSafeString(legacyAll, "city_url", "https://www.ztoe.com.ua/unhooking-search.php"))
                    }
                    if (legacy.contains("queue")) {
                        editor.putString("queue", readSafeString(legacyAll, "queue", ""))
                    }
                    if (legacy.contains("refresh_minutes")) {
                        editor.putLong("refresh_minutes", readSafeLong(legacyAll, "refresh_minutes", 30L))
                    }
                    if (legacy.contains("advance_minutes")) {
                        editor.putInt("advance_minutes", readSafeInt(legacyAll, "advance_minutes", 15))
                    }
                    if (legacy.contains("notifications_enabled")) {
                        editor.putBoolean("notifications_enabled", readSafeBoolean(legacyAll, "notifications_enabled", true))
                    }
                    if (legacy.contains("sound_enabled")) {
                        editor.putBoolean("sound_enabled", readSafeBoolean(legacyAll, "sound_enabled", true))
                    }
                    if (legacy.contains("vibration_enabled")) {
                        editor.putBoolean("vibration_enabled", readSafeBoolean(legacyAll, "vibration_enabled", true))
                    }
                    if (legacy.contains("theme_mode")) {
                        editor.putString("theme_mode", readSafeString(legacyAll, "theme_mode", "SYSTEM"))
                    }
                    if (legacy.contains("language")) {
                        editor.putString("language", readSafeString(legacyAll, "language", "SYSTEM"))
                    }
                    editor.apply()
                    break
                }
            } catch (_: Exception) {}
        }
    }

    // CRITICAL CONSTANTS — DO NOT MODIFY DEFAULT VALUES (advance_minutes = 15, refresh_minutes = 30L) UNLESS EXPLICITLY REQUESTED
    fun getSettings(): UserSettings {
        val allMap = try { prefs.all } catch (_: Exception) { emptyMap<String, Any?>() }
        val notificationsEnabled = readSafeBoolean(allMap, "notifications_enabled", true)
        val emergencyNotificationsEnabled = readSafeBoolean(allMap, "emergency_notifications_enabled", true)
        val prevSound = readSafeBoolean(allMap, "prev_sound_enabled", true)
        val prevVibration = readSafeBoolean(allMap, "prev_vibration_enabled", true)
        val rawSound = readSafeBoolean(allMap, "sound_enabled", true)
        val rawVibration = readSafeBoolean(allMap, "vibration_enabled", true)

        val customQueueStatusText = readSafeString(allMap, "custom_queue_status_text", "").takeIf { it.isNotBlank() }
        val selectedAddress = readSafeString(allMap, "selected_address", "").takeIf { it.isNotBlank() }
        val remId = readSafeString(allMap, "selected_rem", "")
        val settlementId = readSafeString(allMap, "selected_settlement", "")
        val streetId = readSafeString(allMap, "selected_street", "")
        val house = readSafeString(allMap, "selected_house", "")
        val selectedAddressQuery = if (remId.isNotBlank() && settlementId.isNotBlank() && streetId.isNotBlank() && house.isNotBlank()) {
            SelectedAddressQuery(
                remId = remId,
                settlementId = settlementId,
                streetId = streetId,
                house = house
            )
        } else {
            null
        }

        val emergencyId = readSafeString(allMap, "active_emergency_outage_id", "")
        val emergencyType = readSafeString(allMap, "active_emergency_outage_type", "Аварійне відключення")
        val emergencyStart = readSafeString(allMap, "active_emergency_outage_start", "")
        val emergencyRestore = readSafeString(allMap, "active_emergency_outage_restore", "")
        val rawEmergencyCandidate = if (emergencyStart.isNotBlank() && emergencyRestore.isNotBlank()) {
            EmergencyOutageInfo(
                id = emergencyId.ifBlank { "emergency_outage" },
                outageType = emergencyType.ifBlank { "Аварійне відключення" },
                startTime = emergencyStart,
                estimatedRestoreTime = emergencyRestore
            )
        } else {
            null
        }
        val activeEmergencyOutage = if (ZtoeAddressLookup.isValidEmergencyOutage(rawEmergencyCandidate)) {
            rawEmergencyCandidate
        } else {
            if (rawEmergencyCandidate != null) {
                try {
                    prefs.edit()
                        .remove("active_emergency_outage_id")
                        .remove("active_emergency_outage_type")
                        .remove("active_emergency_outage_start")
                        .remove("active_emergency_outage_restore")
                        .apply()
                } catch (_: Exception) {}
            }
            null
        }

        val anyAlertsEnabled = notificationsEnabled || emergencyNotificationsEnabled

        return UserSettings(
            cityUrl = readSafeString(allMap, "city_url", "https://www.ztoe.com.ua/unhooking-search.php").ifBlank { "https://www.ztoe.com.ua/unhooking-search.php" },
            queue = readSafeString(allMap, "queue", ""),
            customQueueStatusText = customQueueStatusText,
            selectedAddress = selectedAddress,
            selectedAddressQuery = selectedAddressQuery,
            activeEmergencyOutage = activeEmergencyOutage,
            refreshIntervalMinutes = readSafeLong(allMap, "refresh_minutes", 30L).coerceIn(1L, 240L),
            advanceNoticeMinutes = readSafeInt(allMap, "advance_minutes", 15).coerceIn(1, 240),
            notificationsEnabled = notificationsEnabled,
            emergencyNotificationsEnabled = emergencyNotificationsEnabled,
            soundEnabled = if (anyAlertsEnabled) rawSound else false,
            vibrationEnabled = if (anyAlertsEnabled) rawVibration else false,
            prevSoundEnabled = prevSound,
            prevVibrationEnabled = prevVibration,
            themeMode = readSafeString(allMap, "theme_mode", "SYSTEM").ifBlank { "SYSTEM" },
            language = readSafeString(allMap, "language", "SYSTEM").ifBlank { "SYSTEM" }
        )
    }

    fun saveSettings(settings: UserSettings) {
        val anyAlertsEnabled = settings.notificationsEnabled || settings.emergencyNotificationsEnabled
        val editor = prefs.edit()
            .putString("city_url", settings.cityUrl)
            .putString("queue", settings.queue)
            .putString("custom_queue_status_text", settings.customQueueStatusText ?: "")
            .putString("selected_address", settings.selectedAddress ?: "")
            .putString("selected_rem", settings.selectedAddressQuery?.remId ?: "")
            .putString("selected_settlement", settings.selectedAddressQuery?.settlementId ?: "")
            .putString("selected_street", settings.selectedAddressQuery?.streetId ?: "")
            .putString("selected_house", settings.selectedAddressQuery?.house ?: "")
            .putString("active_emergency_outage_id", settings.activeEmergencyOutage?.id ?: "")
            .putString("active_emergency_outage_type", settings.activeEmergencyOutage?.outageType ?: "")
            .putString("active_emergency_outage_start", settings.activeEmergencyOutage?.startTime ?: "")
            .putString("active_emergency_outage_restore", settings.activeEmergencyOutage?.estimatedRestoreTime ?: "")
            .putLong("refresh_minutes", settings.refreshIntervalMinutes.coerceIn(1L, 240L))
            .putInt("advance_minutes", settings.advanceNoticeMinutes.coerceIn(1, 240))
            .putBoolean("notifications_enabled", settings.notificationsEnabled)
            .putBoolean("emergency_notifications_enabled", settings.emergencyNotificationsEnabled)
            .putBoolean("sound_enabled", if (anyAlertsEnabled) settings.soundEnabled else false)
            .putBoolean("vibration_enabled", if (anyAlertsEnabled) settings.vibrationEnabled else false)
            .putString("theme_mode", settings.themeMode)
            .putString("language", settings.language)

        if (anyAlertsEnabled) {
            editor.putBoolean("prev_sound_enabled", settings.soundEnabled)
            editor.putBoolean("prev_vibration_enabled", settings.vibrationEnabled)
        } else {
            editor.putBoolean("prev_sound_enabled", settings.prevSoundEnabled)
            editor.putBoolean("prev_vibration_enabled", settings.prevVibrationEnabled)
        }
        editor.apply()
    }

    fun resetAllAppDataToFirstLaunch(): UserSettings {
        prefs.edit().clear().apply()
        val fresh = UserSettings()
        saveSettings(fresh)
        return fresh
    }

    fun updateNotificationsEnabled(enabled: Boolean): UserSettings {
        val current = getSettings()
        val anyWasEnabled = current.notificationsEnabled || current.emergencyNotificationsEnabled
        val anyNowEnabled = enabled || current.emergencyNotificationsEnabled

        if (!anyNowEnabled) {
            // Both main and emergency notifications are now off -> save current active sound & vibration states before turning off
            val soundToSave = if (anyWasEnabled) current.soundEnabled else current.prevSoundEnabled
            val vibeToSave = if (anyWasEnabled) current.vibrationEnabled else current.prevVibrationEnabled
            prefs.edit()
                .putBoolean("prev_sound_enabled", soundToSave)
                .putBoolean("prev_vibration_enabled", vibeToSave)
                .putBoolean("notifications_enabled", false)
                .putBoolean("sound_enabled", false)
                .putBoolean("vibration_enabled", false)
                .apply()
        } else if (!anyWasEnabled) {
            // Transitioning from all-off back to enabled -> restore previous sound & vibration states
            val restoredSound = prefs.getBoolean("prev_sound_enabled", true)
            val restoredVibe = prefs.getBoolean("prev_vibration_enabled", true)
            prefs.edit()
                .putBoolean("notifications_enabled", enabled)
                .putBoolean("sound_enabled", restoredSound)
                .putBoolean("vibration_enabled", restoredVibe)
                .apply()
        } else {
            // Emergency notifications are still enabled, so keep sound & vibration active and do not turn off emergency_notifications_enabled
            prefs.edit()
                .putBoolean("notifications_enabled", enabled)
                .putBoolean("sound_enabled", current.soundEnabled)
                .putBoolean("vibration_enabled", current.vibrationEnabled)
                .putBoolean("prev_sound_enabled", current.soundEnabled)
                .putBoolean("prev_vibration_enabled", current.vibrationEnabled)
                .apply()
        }
        return getSettings()
    }

    fun updateEmergencyNotificationsEnabled(enabled: Boolean): UserSettings {
        val current = getSettings()
        val anyWasEnabled = current.notificationsEnabled || current.emergencyNotificationsEnabled
        val anyNowEnabled = current.notificationsEnabled || enabled

        if (!anyNowEnabled) {
            val soundToSave = if (anyWasEnabled) current.soundEnabled else current.prevSoundEnabled
            val vibeToSave = if (anyWasEnabled) current.vibrationEnabled else current.prevVibrationEnabled
            prefs.edit()
                .putBoolean("prev_sound_enabled", soundToSave)
                .putBoolean("prev_vibration_enabled", vibeToSave)
                .putBoolean("emergency_notifications_enabled", false)
                .putBoolean("sound_enabled", false)
                .putBoolean("vibration_enabled", false)
                .apply()
        } else if (!anyWasEnabled) {
            val restoredSound = prefs.getBoolean("prev_sound_enabled", true)
            val restoredVibe = prefs.getBoolean("prev_vibration_enabled", true)
            prefs.edit()
                .putBoolean("emergency_notifications_enabled", enabled)
                .putBoolean("sound_enabled", restoredSound)
                .putBoolean("vibration_enabled", restoredVibe)
                .apply()
        } else {
            prefs.edit()
                .putBoolean("emergency_notifications_enabled", enabled)
                .putBoolean("sound_enabled", current.soundEnabled)
                .putBoolean("vibration_enabled", current.vibrationEnabled)
                .putBoolean("prev_sound_enabled", current.soundEnabled)
                .putBoolean("prev_vibration_enabled", current.vibrationEnabled)
                .apply()
        }
        return getSettings()
    }

    /**
     * Sound and vibration follow the alerts master switch (`spec/SUBSCRIPTIONS.md` section 7): off
     * remembers and mutes them, on restores them. Called only when the master really changes.
     */
    fun applyMasterSound(masterOn: Boolean) {
        val current = getSettings()
        if (masterOn) {
            prefs.edit()
                .putBoolean("sound_enabled", prefs.getBoolean("prev_sound_enabled", true))
                .putBoolean("vibration_enabled", prefs.getBoolean("prev_vibration_enabled", true))
                .apply()
        } else {
            prefs.edit()
                .putBoolean("prev_sound_enabled", current.soundEnabled)
                .putBoolean("prev_vibration_enabled", current.vibrationEnabled)
                .putBoolean("sound_enabled", false)
                .putBoolean("vibration_enabled", false)
                .apply()
        }
    }

    /**
     * Writes the primary subscription into the single-address keys (`spec/SUBSCRIPTIONS.md`
     * section 7). Targeted: sound, vibration, timers, site and language are untouched (sound and
     * vibration follow the master switch, [applyMasterSound]).
     */
    fun applyPrimaryMirror(m: LegacyMirror) {
        prefs.edit()
            .putString("queue", m.queue)
            .putString("custom_queue_status_text", m.customQueueStatusText ?: "")
            .putString("selected_address", m.selectedAddress ?: "")
            .putString("selected_rem", m.remSlug)
            .putString("selected_settlement", m.settlementId)
            .putString("selected_street", m.streetId)
            .putString("selected_house", m.house)
            .putBoolean("notifications_enabled", m.notificationsEnabled)
            .putBoolean("emergency_notifications_enabled", m.emergencyNotificationsEnabled)
            .apply()
    }

    /**
     * Writes only the queue assignment of a house that had none. Targeted on purpose: a background
     * check that took seconds must not overwrite settings the user changed in the meantime.
     */
    fun updateQueueAssignment(queue: String, statusText: String?) {
        prefs.edit()
            .putString("queue", queue)
            .putString("custom_queue_status_text", statusText ?: "")
            .apply()
    }

    fun getSharedPreferences(): SharedPreferences = prefs
}
