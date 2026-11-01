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

    /**
     * Ensures settings from any earlier APK version or preference file are preserved seamlessly
     * when updating the application, without ever overwriting already-saved user settings.
     */
    private fun migrateLegacySettingsIfNeeded() {
        if (prefs.contains("queue") || prefs.contains("city_url")) {
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
                if (legacy.all.isNotEmpty() && (legacy.contains("queue") || legacy.contains("city_url"))) {
                    val editor = prefs.edit()
                    legacy.getString("city_url", null)?.let { editor.putString("city_url", it) }
                    legacy.getString("queue", null)?.let { editor.putString("queue", it) }
                    if (legacy.contains("refresh_minutes")) {
                        editor.putLong("refresh_minutes", legacy.getLong("refresh_minutes", 30L))
                    }
                    if (legacy.contains("advance_minutes")) {
                        editor.putInt("advance_minutes", legacy.getInt("advance_minutes", 15))
                    }
                    if (legacy.contains("notifications_enabled")) {
                        editor.putBoolean("notifications_enabled", legacy.getBoolean("notifications_enabled", true))
                    }
                    if (legacy.contains("sound_enabled")) {
                        editor.putBoolean("sound_enabled", legacy.getBoolean("sound_enabled", true))
                    }
                    if (legacy.contains("vibration_enabled")) {
                        editor.putBoolean("vibration_enabled", legacy.getBoolean("vibration_enabled", true))
                    }
                    legacy.getString("theme_mode", null)?.let { editor.putString("theme_mode", it) }
                    legacy.getString("language", null)?.let { editor.putString("language", it) }
                    editor.apply()
                    break
                }
            } catch (_: Exception) {}
        }
    }

    // CRITICAL CONSTANTS — DO NOT MODIFY DEFAULT VALUES (advance_minutes = 15, refresh_minutes = 30L) UNLESS EXPLICITLY REQUESTED
    fun getSettings(): UserSettings {
        val notificationsEnabled = prefs.getBoolean("notifications_enabled", true)
        val prevSound = prefs.getBoolean("prev_sound_enabled", true)
        val prevVibration = prefs.getBoolean("prev_vibration_enabled", true)
        val rawSound = prefs.getBoolean("sound_enabled", true)
        val rawVibration = prefs.getBoolean("vibration_enabled", true)
        return UserSettings(
            cityUrl = prefs.getString("city_url", "https://www.ztoe.com.ua/unhooking-search.php") ?: "https://www.ztoe.com.ua/unhooking-search.php",
            queue = prefs.getString("queue", "1.1") ?: "1.1",
            refreshIntervalMinutes = prefs.getLong("refresh_minutes", 30L),
            advanceNoticeMinutes = prefs.getInt("advance_minutes", 15),
            notificationsEnabled = notificationsEnabled,
            soundEnabled = if (notificationsEnabled) rawSound else false,
            vibrationEnabled = if (notificationsEnabled) rawVibration else false,
            prevSoundEnabled = prevSound,
            prevVibrationEnabled = prevVibration,
            themeMode = prefs.getString("theme_mode", "SYSTEM") ?: "SYSTEM",
            language = prefs.getString("language", "SYSTEM") ?: "SYSTEM"
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
