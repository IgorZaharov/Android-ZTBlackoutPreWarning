package ua.blackout.prewarning.notification

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import ua.blackout.prewarning.core.OutageEngine
import ua.blackout.prewarning.data.KYIV_ZONE
import ua.blackout.prewarning.data.repository.AlertRegistry
import ua.blackout.prewarning.data.repository.OutageRepository
import ua.blackout.prewarning.data.repository.SettingsRepository
import ua.blackout.prewarning.widget.BlackoutGlanceWidget
import java.time.LocalDateTime

/**
 * Turns the outage engine's alert plan into alarms. The plan (one alert per merged planned span,
 * today and tomorrow, never for anything already started or finished) comes from
 * [OutageEngine.planAlerts]; this object only talks to [AlarmManager].
 */
object AlarmScheduler {
    private const val PREFS_NAME = "zt_scheduled_alarms_v1"
    private const val KEY_ALERT_IDS = "scheduled_alert_ids"
    private const val KEY_WIDGET_IDS = "scheduled_widget_ids"
    private const val MIDNIGHT_KEY = "midnight_sync"

    const val ACTION_ALERT = "ua.blackout.prewarning.ACTION_TRIGGER_BLACKOUT_ALERT"
    const val ACTION_WIDGET = "ua.blackout.prewarning.ACTION_WIDGET_TRANSITION_UPDATE"
    const val ACTION_MIDNIGHT = "ua.blackout.prewarning.ACTION_MIDNIGHT_SYNC"

    const val EXTRA_KEY = "EXTRA_SLOT_ID"
    const val EXTRA_QUEUE = "EXTRA_QUEUE"
    const val EXTRA_MINUTES = "EXTRA_MINUTES"
    const val EXTRA_SPAN_START_MS = "EXTRA_SPAN_START_EPOCH_MS"

    suspend fun syncAlarms(context: Context, onTimeChanged: Boolean = false) {
        val appContext = context.applicationContext
        val hasWidgets = try {
            BlackoutGlanceWidget.hasActiveWidgets(appContext)
        } catch (_: Exception) {
            false
        }
        syncAlarmsInternal(appContext, hasWidgets, onTimeChanged)
    }

    private fun epochMs(dt: LocalDateTime): Long = dt.atZone(KYIV_ZONE).toInstant().toEpochMilli()

    @Synchronized
    private fun syncAlarmsInternal(appContext: Context, hasWidgets: Boolean, onTimeChanged: Boolean) {
        val settings = SettingsRepository(appContext).getSettings()
        val now = LocalDateTime.now(KYIV_ZONE)
        val snapshot = OutageRepository(appContext).snapshot(settings, now)
        val alertRegistry = AlertRegistry(appContext)
        val alarmManager = appContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val alarmPrefs = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val canExact = ExactAlarmGate.canScheduleExact(appContext)

        // 1. Cancel everything scheduled before (also ids written by older app versions)
        for (id in alarmPrefs.getStringSet(KEY_ALERT_IDS, emptySet()).orEmpty()) {
            cancel(appContext, alarmManager, ACTION_ALERT, id)
        }
        for (id in alarmPrefs.getStringSet(KEY_WIDGET_IDS, emptySet()).orEmpty()) {
            cancel(appContext, alarmManager, ACTION_WIDGET, id)
        }
        cancel(appContext, alarmManager, ACTION_MIDNIGHT, MIDNIGHT_KEY)

        val newAlertIds = LinkedHashSet<String>()
        val newWidgetIds = LinkedHashSet<String>()

        // 2. Pre-warnings: one per merged planned span of today and tomorrow, only for unfinished future spans
        if (settings.notificationsEnabled) {
            val alerts = OutageEngine.planAlerts(snapshot.outages, now, settings.advanceNoticeMinutes)
            if (onTimeChanged) {
                // The clock moved: alerts whose time is in the future again may notify once more
                alertRegistry.resetFutureSlotsOnTimeChange(System.currentTimeMillis(), alerts.map { it.key }.toSet())
            }
            for (alert in alerts) {
                if (alertRegistry.hasNotified(alert.key)) continue
                val intent = Intent(appContext, AlarmReceiver::class.java).apply {
                    action = ACTION_ALERT
                    putExtra(EXTRA_KEY, alert.key)
                    putExtra(EXTRA_QUEUE, settings.queue)
                    putExtra(EXTRA_MINUTES, settings.advanceNoticeMinutes)
                    putExtra(EXTRA_SPAN_START_MS, epochMs(alert.spanStart))
                }
                val pi = PendingIntent.getBroadcast(
                    appContext,
                    AlarmCodes.codeFor(appContext, alert.key),
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                if (setWakeupAlarm(alarmManager, epochMs(alert.fireAt), pi, canExact)) newAlertIds.add(alert.key)
            }
        }

        // 3. Widget redraws exactly when the power state flips (only when widgets are placed)
        if (hasWidgets) {
            for (t in OutageEngine.transitions(snapshot.outages, now.plusSeconds(1), now.plusHours(48))) {
                val id = "wt_${t.at}_${if (t.isOff) "off" else "on"}"
                val intent = Intent(appContext, AlarmReceiver::class.java).apply {
                    action = ACTION_WIDGET
                    putExtra("EXTRA_TRANSITION_ID", id)
                }
                val pi = PendingIntent.getBroadcast(
                    appContext,
                    AlarmCodes.codeFor(appContext, id),
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                try {
                    val at = epochMs(t.at) + 1500L
                    if (canExact) alarmManager.setExact(AlarmManager.RTC, at, pi) else alarmManager.set(AlarmManager.RTC, at, pi)
                    newWidgetIds.add(id)
                } catch (_: Exception) {
                }
            }
        }

        // 4. Re-plan right after midnight: tomorrow's table becomes today's and a new tomorrow may be published
        try {
            val midnight = epochMs(now.toLocalDate().plusDays(1).atStartOfDay().plusSeconds(5))
            val pi = PendingIntent.getBroadcast(
                appContext,
                AlarmCodes.codeFor(appContext, MIDNIGHT_KEY),
                Intent(appContext, AlarmReceiver::class.java).apply { action = ACTION_MIDNIGHT },
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            alarmManager.setAndAllowWhileIdle(AlarmManager.RTC, midnight, pi)
        } catch (_: Exception) {
        }

        AlarmCodes.retainOnly(appContext, newAlertIds + newWidgetIds + MIDNIGHT_KEY)
        alarmPrefs.edit()
            .putStringSet(KEY_ALERT_IDS, newAlertIds)
            .putStringSet(KEY_WIDGET_IDS, newWidgetIds)
            .apply()
    }

    /** Exact when the permission is granted; otherwise (or if the system refuses) inexact but still Doze-tolerant. */
    private fun setWakeupAlarm(am: AlarmManager, atMs: Long, pi: PendingIntent, canExact: Boolean): Boolean {
        return try {
            if (canExact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs, pi)
            else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs, pi)
            true
        } catch (_: SecurityException) {
            try {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs, pi)
                true
            } catch (_: Exception) {
                false
            }
        } catch (_: Exception) {
            false
        }
    }

    private fun cancel(appContext: Context, am: AlarmManager, action: String, id: String) {
        try {
            // Ids from before 1.4.0 have no registered code and used String.hashCode()
            val code = AlarmCodes.lookup(appContext, id) ?: id.hashCode()
            val pi = PendingIntent.getBroadcast(
                appContext,
                code,
                Intent(appContext, AlarmReceiver::class.java).apply { this.action = action },
                PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
            )
            if (pi != null) {
                am.cancel(pi)
                pi.cancel()
            }
        } catch (_: Exception) {
        }
    }
}
