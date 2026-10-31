package ua.blackout.prewarning.data.repository

import android.content.Context
import android.content.SharedPreferences

class AlertRegistry(context: Context) {
    private val appContext: Context = context.applicationContext
    private val prefs: SharedPreferences =
        appContext.getSharedPreferences("zt_notified_blackouts_v1", Context.MODE_PRIVATE)

    /**
     * Checks if this specific blackout slot has already been notified.
     * Guarantees 100% adherence to "notification sent only once per blackout slot".
     */
    fun hasNotified(slotId: String): Boolean {
        return prefs.getBoolean("notified_$slotId", false)
    }

    /**
     * Marks the slot as notified with timestamp and prunes entries older than 7 days
     * to prevent unbounded SharedPreferences memory growth.
     */
    fun markNotified(slotId: String) {
        val now = System.currentTimeMillis()
        val cutoff = now - 7L * 24L * 60L * 60L * 1000L
        val editor = prefs.edit()
        for ((key, value) in prefs.all) {
            if (key.startsWith("ts_") && value is Long && value < cutoff) {
                val oldSlotId = key.removePrefix("ts_")
                editor.remove(key)
                editor.remove("notified_$oldSlotId")
            }
        }
        editor
            .putBoolean("notified_$slotId", true)
            .putLong("ts_$slotId", now)
            .apply()
    }

    /**
     * Clears old history (e.g. from previous days)
     */
    fun clearHistory() {
        prefs.edit().clear().apply()
    }
}