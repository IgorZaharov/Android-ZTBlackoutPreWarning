package ua.blackout.prewarning.data.repository

import android.content.Context
import android.content.SharedPreferences
import ua.blackout.prewarning.data.model.UserSettings

class SettingsRepository(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("zt_user_settings_v1", Context.MODE_PRIVATE)

    fun getSettings(): UserSettings {
        return UserSettings(
            cityUrl = prefs.getString("city_url", "https://www.ztoe.com.ua/unhooking-search.php") ?: "https://www.ztoe.com.ua/unhooking-search.php",
            queue = prefs.getString("queue", "1.1") ?: "1.1",
            refreshIntervalMinutes = prefs.getLong("refresh_minutes", 15L),
            advanceNoticeMinutes = prefs.getInt("advance_minutes", 30),
            notificationsEnabled = prefs.getBoolean("notifications_enabled", true),
            soundEnabled = prefs.getBoolean("sound_enabled", true),
            vibrationEnabled = prefs.getBoolean("vibration_enabled", true),
            themeMode = prefs.getString("theme_mode", "SYSTEM") ?: "SYSTEM",
            language = prefs.getString("language", "SYSTEM") ?: "SYSTEM"
        )
    }

    fun saveSettings(settings: UserSettings) {
        prefs.edit()
            .putString("city_url", settings.cityUrl)
            .putString("queue", settings.queue)
            .putLong("refresh_minutes", settings.refreshIntervalMinutes)
            .putInt("advance_minutes", settings.advanceNoticeMinutes)
            .putBoolean("notifications_enabled", settings.notificationsEnabled)
            .putBoolean("sound_enabled", settings.soundEnabled)
            .putBoolean("vibration_enabled", settings.vibrationEnabled)
            .putString("theme_mode", settings.themeMode)
            .putString("language", settings.language)
            .apply()
    }

    fun updateNotificationsEnabled(enabled: Boolean) {
        prefs.edit().putBoolean("notifications_enabled", enabled).commit()
    }
}
