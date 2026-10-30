package ua.blackout.prewarning.data.repository

import android.content.Context
import android.content.SharedPreferences

class AlertRegistry(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("zt_notified_blackouts_v1", Context.MODE_PRIVATE)

    /**
     * Checks if this specific blackout slot has already been notified.
     * Guarantees 100% adherence to "notification sent only once per blackout slot".
     */
    fun hasNotified(slotId: String): Boolean {
        return prefs.getBoolean("notified_$slotId", false)
    }

    /**
     * Marks the slot as notified with timestamp
     */
    fun markNotified(slotId: String) {
        prefs.edit()
            .putBoolean("notified_$slotId", true)
            .putLong("ts_$slotId", System.currentTimeMillis())
            .apply()
    }

    /**
     * Clears old history (e.g. from previous days)
     */
    fun clearHistory() {
        prefs.edit().clear().apply()
    }
}