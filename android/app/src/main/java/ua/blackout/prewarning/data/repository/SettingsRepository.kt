package ua.blackout.prewarning.data.repository

import android.content.Context
import android.content.SharedPreferences
import ua.blackout.prewarning.data.model.UserSettings

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
            return (raw as? String)?.takeIf { it.isNotBlank() } ?: raw.toString()
        }
    }

    /**
     * Ensures settings from any earlier APK version (including 1.2.X) or preference file are preserved seamlessly
     * when updating the application, without ever overwriting already-saved user settings or throwing ClassCastException.
     */
    private fun migrateLegacySettingsIfNeeded() {
        val currentAll = try { prefs.all } catch (_: Exception) { emptyMap<String, Any?>() }
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
            "${appContext.packageName}_preferences"
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
                        editor.putString("queue", readSafeString(legacyAll, "queue", "1.1"))
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
        val prevSound = readSafeBoolean(allMap, "prev_sound_enabled", true)
        val prevVibration = readSafeBoolean(allMap, "prev_vibration_enabled", true)
        val rawSound = readSafeBoolean(allMap, "sound_enabled", true)
        val rawVibration = readSafeBoolean(allMap, "vibration_enabled", true)
        return UserSettings(
            cityUrl = readSafeString(allMap, "city_url", "https://www.ztoe.com.ua/unhooking-search.php"),
            queue = readSafeString(allMap, "queue", "1.1"),
            refreshIntervalMinutes = readSafeLong(allMap, "refresh_minutes", 30L),
            advanceNoticeMinutes = readSafeInt(allMap, "advance_minutes", 15),
            notificationsEnabled = notificationsEnabled,
            soundEnabled = if (notificationsEnabled) rawSound else false,
            vibrationEnabled = if (notificationsEnabled) rawVibration else false,
            prevSoundEnabled = prevSound,
            prevVibrationEnabled = prevVibration,
            themeMode = readSafeString(allMap, "theme_mode", "SYSTEM"),
            language = readSafeString(allMap, "language", "SYSTEM")
        )
    }

    fun saveSettings(settings: UserSettings) {
        val editor = prefs.edit()
            .putString("city_url", settings.cityUrl)
            .putString("queue", settings.queue)
            .putLong("refresh_minutes", settings.refreshIntervalMinutes)
            .putInt("advance_minutes", settings.advanceNoticeMinutes)
            .putBoolean("notifications_enabled", settings.notificationsEnabled)
            .putBoolean("sound_enabled", if (settings.notificationsEnabled) settings.soundEnabled else false)
            .putBoolean("vibration_enabled", if (settings.notificationsEnabled) settings.vibrationEnabled else false)
            .putString("theme_mode", settings.themeMode)
            .putString("language", settings.language)

        if (settings.notificationsEnabled) {
            editor.putBoolean("prev_sound_enabled", settings.soundEnabled)
            editor.putBoolean("prev_vibration_enabled", settings.vibrationEnabled)
        } else {
            editor.putBoolean("prev_sound_enabled", settings.prevSoundEnabled)
            editor.putBoolean("prev_vibration_enabled", settings.prevVibrationEnabled)
        }
        editor.apply()
    }

    fun updateNotificationsEnabled(enabled: Boolean): UserSettings {
        val current = getSettings()
        if (!enabled) {
            // Save current active states before turning off
            val soundToSave = if (current.notificationsEnabled) current.soundEnabled else current.prevSoundEnabled
            val vibeToSave = if (current.notificationsEnabled) current.vibrationEnabled else current.prevVibrationEnabled
            prefs.edit()
                .putBoolean("prev_sound_enabled", soundToSave)
                .putBoolean("prev_vibration_enabled", vibeToSave)
                .putBoolean("notifications_enabled", false)
                .putBoolean("sound_enabled", false)
                .putBoolean("vibration_enabled", false)
                .apply()
        } else {
            // Restore previous states when turned back on
            val restoredSound = prefs.getBoolean("prev_sound_enabled", true)
            val restoredVibe = prefs.getBoolean("prev_vibration_enabled", true)
            prefs.edit()
                .putBoolean("notifications_enabled", true)
                .putBoolean("sound_enabled", restoredSound)
                .putBoolean("vibration_enabled", restoredVibe)
                .apply()
        }
        return getSettings()
    }

    fun getSharedPreferences(): SharedPreferences = prefs
}
