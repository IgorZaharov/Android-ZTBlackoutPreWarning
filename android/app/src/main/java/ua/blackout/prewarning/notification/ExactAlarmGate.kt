package ua.blackout.prewarning.notification

import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings

/**
 * Exact alarms need the "Alarms & reminders" special access on Android 12+ (`SCHEDULE_EXACT_ALARM`).
 * Without it alerts fall back to inexact delivery and the UI shows a card that explains what to do
 * and opens the right system screen.
 */
object ExactAlarmGate {
    fun canScheduleExact(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
        return try {
            (context.applicationContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager).canScheduleExactAlarms()
        } catch (_: Exception) {
            false
        }
    }

    /** Intent for the system "Alarms & reminders" screen of this app, or null below Android 12. */
    fun settingsIntent(context: Context): Intent? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return null
        return Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:${context.packageName}"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
}

/**
 * Stable integer request codes for PendingIntents and notifications. Replaces `String.hashCode()`,
 * where two keys could collide and silently lose an alarm.
 */
object AlarmCodes {
    private const val PREFS = "zt_alarm_codes_v1"
    private const val NEXT = "__next"
    private const val FIRST = 1000

    @Synchronized
    fun codeFor(context: Context, key: String): Int {
        val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val existing = prefs.getInt(key, -1)
        if (existing >= 0) return existing
        val next = prefs.getInt(NEXT, FIRST)
        prefs.edit().putInt(key, next).putInt(NEXT, next + 1).apply()
        return next
    }

    @Synchronized
    fun lookup(context: Context, key: String): Int? {
        val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return prefs.getInt(key, -1).takeIf { it >= 0 }
    }

    /** Forgets every code whose key is not in [keep] (call after the matching alarms were cancelled). */
    @Synchronized
    fun retainOnly(context: Context, keep: Set<String>) {
        val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val editor = prefs.edit()
        for (k in prefs.all.keys) if (k != NEXT && k !in keep) editor.remove(k)
        editor.apply()
    }
}
