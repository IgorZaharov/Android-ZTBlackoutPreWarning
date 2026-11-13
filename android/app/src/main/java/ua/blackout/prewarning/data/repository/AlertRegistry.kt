package ua.blackout.prewarning.data.repository

import android.content.Context
import android.content.SharedPreferences

class AlertRegistry(context: Context) {
    private val appContext: Context = context.applicationContext
    private val prefs: SharedPreferences =
        appContext.getSharedPreferences("zt_notified_blackouts_v1", Context.MODE_PRIVATE)

    companion object {
        const val MAX_STORED_ENTRIES = 300
    }

    /**
     * Checks if this specific blackout slot or emergency transition key has already been notified.
     * Guarantees 100% adherence to "notification sent only once per blackout slot / state transition".
     */
    fun hasNotified(slotId: String): Boolean {
        return prefs.getBoolean("notified_$slotId", false)
    }

    fun hasFired(key: String): Boolean = hasNotified(key)

    fun markFired(key: String) = markNotified(key)

    /**
     * Marks the slot as notified with timestamp, prunes entries older than 7 days,
     * and bounds total stored entries to MAX_STORED_ENTRIES (300: up to 5 addresses share it).
     */
    fun markNotified(slotId: String) {
        val now = System.currentTimeMillis()
        val cutoff = now - 7L * 24L * 60L * 60L * 1000L
        val editor = prefs.edit()
        val timestampEntries = mutableListOf<Pair<String, Long>>()

        for ((key, value) in prefs.all) {
            if (key.startsWith("ts_") && value is Long) {
                val oldSlotId = key.removePrefix("ts_")
                if (value < cutoff) {
                    editor.remove(key)
                    editor.remove("notified_$oldSlotId")
                } else {
                    timestampEntries.add(oldSlotId to value)
                }
            }
        }

        if (timestampEntries.size >= MAX_STORED_ENTRIES) {
            val sortedOldestFirst = timestampEntries.sortedBy { it.second }
            val excessCount = (timestampEntries.size - MAX_STORED_ENTRIES) + 1
            for (i in 0 until excessCount.coerceAtMost(sortedOldestFirst.size)) {
                val evictSlotId = sortedOldestFirst[i].first
                editor.remove("ts_$evictSlotId")
                editor.remove("notified_$evictSlotId")
            }
        }

        editor
            .putBoolean("notified_$slotId", true)
            .putLong("ts_$slotId", now)
            .apply()
    }

    /**
     * When system clock is adjusted backward on mobile, clears notified flags for slots
     * whose alert time is now in the future again or whose recorded notification timestamp
     * is ahead of current wall-clock time.
     */
    fun resetFutureSlotsOnTimeChange(nowMs: Long, futureBlockIds: Set<String>) {
        val editor = prefs.edit()
        var modified = false
        for ((key, value) in prefs.all) {
            if (key.startsWith("ts_") && value is Long && value > nowMs) {
                val slotId = key.removePrefix("ts_")
                editor.remove(key)
                editor.remove("notified_$slotId")
                modified = true
            }
        }
        for (blockId in futureBlockIds) {
            if (prefs.contains("notified_$blockId") || prefs.contains("ts_$blockId")) {
                editor.remove("notified_$blockId")
                editor.remove("ts_$blockId")
                modified = true
            }
        }
        if (modified) {
            editor.apply()
        }
    }

    /**
     * Clears old history (e.g. from previous days)
     */
    fun clearHistory() {
        prefs.edit().clear().apply()
    }
}