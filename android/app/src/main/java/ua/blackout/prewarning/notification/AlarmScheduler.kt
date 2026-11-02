package ua.blackout.prewarning.notification

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import ua.blackout.prewarning.data.parser.ZtoeParser
import ua.blackout.prewarning.data.repository.AlertRegistry
import ua.blackout.prewarning.data.repository.ScheduleRepository
import ua.blackout.prewarning.data.repository.SettingsRepository
import ua.blackout.prewarning.widget.BlackoutGlanceWidget
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

object AlarmScheduler {
    private const val PREFS_NAME = "zt_scheduled_alarms_v1"
    private const val KEY_ALERT_IDS = "scheduled_alert_ids"
    private const val KEY_WIDGET_IDS = "scheduled_widget_ids"

    private val ALL_QUEUES = listOf(
        "1.1", "1.2", "2.1", "2.2", "3.1", "3.2",
        "4.1", "4.2", "5.1", "5.2", "6.1", "6.2"
    )

    suspend fun syncAlarms(context: Context, onTimeChanged: Boolean = false) {
        val appContext = context.applicationContext
        val hasWidgets = try {
            BlackoutGlanceWidget.hasActiveWidgets(appContext)
        } catch (_: Exception) {
            false
        }
        syncAlarmsInternal(appContext, hasWidgets, onTimeChanged)
    }

    @Synchronized
    private fun syncAlarmsInternal(
        appContext: Context,
        hasWidgets: Boolean,
        onTimeChanged: Boolean
    ) {
        val settings = SettingsRepository(appContext).getSettings()
        val scheduleRepo = ScheduleRepository(appContext)
        val alertRegistry = AlertRegistry(appContext)
        val alarmManager = appContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val alarmPrefs = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        val kyivZone = ZoneId.of("Europe/Kyiv")
        val today = LocalDate.now(kyivZone)
        val now = LocalDateTime.now(kyivZone)

        val slots = scheduleRepo.getTodaySlots(settings.queue)
        val intervals = scheduleRepo.getDetailedIntervals(slots)

        // Identify any blocks for the active queue that are currently in the active pre-warning window
        // so an in-flight alarm delivery for the user's current queue is not cancelled mid-broadcast
        val activeInWindowBlockIds = mutableSetOf<String>()
        if (settings.notificationsEnabled) {
            for (block in intervals) {
                val startParts = block.startStr.split(":")
                val startH = startParts[0].toInt()
                val startM = startParts[1].toInt()
                val blockStartTime = LocalDateTime.of(today, LocalTime.of(startH, startM))
                val alertTime = blockStartTime.minusMinutes(settings.advanceNoticeMinutes.toLong())
                if (!now.isBefore(alertTime.minusMinutes(1)) && !now.isAfter(blockStartTime.plusMinutes(2))) {
                    activeInWindowBlockIds.add("block_${today}_${block.startStr}_${block.endStr}_Q${settings.queue}")
                }
            }
        }

        // 1. Cancel all previously tracked alert & widget transition alarms
        val prevAlertIds = alarmPrefs.getStringSet(KEY_ALERT_IDS, emptySet()) ?: emptySet()
        for (blockId in prevAlertIds) {
            if (blockId !in activeInWindowBlockIds) {
                cancelAlertPendingIntent(appContext, alarmManager, blockId)
            }
        }

        val prevWidgetIds = alarmPrefs.getStringSet(KEY_WIDGET_IDS, emptySet()) ?: emptySet()
        for (transitionId in prevWidgetIds) {
            cancelWidgetPendingIntent(appContext, alarmManager, transitionId)
        }

        // 2. Sweep and cancel any untracked legacy alarms across all 12 queues (e.g. default 1.1 from initial startup)
        sweepLegacyQueueAlarms(appContext, alarmManager, scheduleRepo, today, activeInWindowBlockIds)

        val newWidgetIds = mutableSetOf<String>()
        val newAlertIds = mutableSetOf<String>()
        newAlertIds.addAll(activeInWindowBlockIds)

        // 3. Schedule widget transition redraw alarms only when active widgets are placed on home screen
        if (hasWidgets) {
            for (block in intervals) {
                val startParts = block.startStr.split(":")
                val startH = startParts[0].toInt()
                val startM = startParts[1].toInt()
                val blockStart = LocalDateTime.of(today, LocalTime.of(startH, startM))

                val blockEnd = if (block.endStr == "24:00") {
                    LocalDateTime.of(today.plusDays(1), LocalTime.MIDNIGHT)
                } else {
                    val endParts = block.endStr.split(":")
                    LocalDateTime.of(today, LocalTime.of(endParts[0].toInt(), endParts[1].toInt()))
                }

                listOf("start_${today}_${block.startStr}" to blockStart, "end_${today}_${block.endStr}" to blockEnd)
                    .forEach { (transitionId, transitionTime) ->
                        if (transitionTime.isAfter(now)) {
                            val epochMs = transitionTime.atZone(kyivZone).toInstant().toEpochMilli() + 1500L
                            val widgetIntent = Intent(appContext, AlarmReceiver::class.java).apply {
                                action = "ua.blackout.prewarning.ACTION_WIDGET_TRANSITION_UPDATE"
                                putExtra("EXTRA_TRANSITION_ID", transitionId)
                            }
                            val widgetPi = PendingIntent.getBroadcast(
                                appContext,
                                transitionId.hashCode(),
                                widgetIntent,
                                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                            )
                            try {
                                alarmManager.setExact(AlarmManager.RTC, epochMs, widgetPi)
                                newWidgetIds.add(transitionId)
                            } catch (_: Exception) {}
                        }
                    }
            }
        }

        if (!settings.notificationsEnabled) {
            alarmPrefs.edit()
                .putStringSet(KEY_ALERT_IDS, emptySet())
                .putStringSet(KEY_WIDGET_IDS, newWidgetIds)
                .apply()
            return
        }

        // If system clock was changed backward, clear notified flags for blocks whose alert time is in the future again
        if (onTimeChanged) {
            val futureBlockIds = mutableSetOf<String>()
            for (block in intervals) {
                val startParts = block.startStr.split(":")
                val startH = startParts[0].toInt()
                val startM = startParts[1].toInt()
                val blockStartTime = LocalDateTime.of(today, LocalTime.of(startH, startM))
                val alertTime = blockStartTime.minusMinutes(settings.advanceNoticeMinutes.toLong())
                if (alertTime.isAfter(now)) {
                    futureBlockIds.add("block_${today}_${block.startStr}_${block.endStr}_Q${settings.queue}")
                }
            }
            alertRegistry.resetFutureSlotsOnTimeChange(System.currentTimeMillis(), futureBlockIds)
        }

        // 4. Schedule single exact alarm for each upcoming blackout block of the currently selected queue ONLY
        for (block in intervals) {
            val startParts = block.startStr.split(":")
            val startH = startParts[0].toInt()
            val startM = startParts[1].toInt()
            val blockId = "block_${today}_${block.startStr}_${block.endStr}_Q${settings.queue}"

            if (alertRegistry.hasNotified(blockId)) {
                continue
            }

            val blockStartTime = LocalDateTime.of(today, LocalTime.of(startH, startM))
            val alertTime = blockStartTime.minusMinutes(settings.advanceNoticeMinutes.toLong())

            if (alertTime.isAfter(now)) {
                val epochMillis = alertTime.atZone(kyivZone).toInstant().toEpochMilli()
                val blockStartEpochMillis = blockStartTime.atZone(kyivZone).toInstant().toEpochMilli()
                val timeSpan = "${block.startStr}–${block.endStr}"
                val intent = Intent(appContext, AlarmReceiver::class.java).apply {
                    action = "ua.blackout.prewarning.ACTION_TRIGGER_BLACKOUT_ALERT"
                    putExtra("EXTRA_SLOT_ID", blockId)
                    putExtra("EXTRA_QUEUE", settings.queue)
                    putExtra("EXTRA_TIME", timeSpan)
                    putExtra("EXTRA_MINUTES", settings.advanceNoticeMinutes)
                    putExtra("EXTRA_ALERT_EPOCH_MS", epochMillis)
                    putExtra("EXTRA_BLOCK_START_EPOCH_MS", blockStartEpochMillis)
                }

                val pendingIntent = PendingIntent.getBroadcast(
                    appContext,
                    blockId.hashCode(),
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )

                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, epochMillis, pendingIntent)
                    } else {
                        alarmManager.setExact(AlarmManager.RTC_WAKEUP, epochMillis, pendingIntent)
                    }
                    newAlertIds.add(blockId)
                } catch (_: SecurityException) {
                    try {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, epochMillis, pendingIntent)
                        } else {
                            alarmManager.set(AlarmManager.RTC_WAKEUP, epochMillis, pendingIntent)
                        }
                        newAlertIds.add(blockId)
                    } catch (_: Exception) {}
                } catch (_: Exception) {}
            }
        }

        alarmPrefs.edit()
            .putStringSet(KEY_ALERT_IDS, newAlertIds)
            .putStringSet(KEY_WIDGET_IDS, newWidgetIds)
            .apply()
    }

    private fun sweepLegacyQueueAlarms(
        appContext: Context,
        alarmManager: AlarmManager,
        scheduleRepo: ScheduleRepository,
        today: LocalDate,
        activeInWindowBlockIds: Set<String>
    ) {
        val dates = listOf(today.minusDays(1), today, today.plusDays(1))
        for (date in dates) {
            val dateStr = date.format(DateTimeFormatter.ISO_LOCAL_DATE)
            for (q in ALL_QUEUES) {
                val candidateIntervals = LinkedHashSet<Pair<String, String>>()
                try {
                    scheduleRepo.getDetailedIntervals(scheduleRepo.getTodaySlots(q)).forEach {
                        candidateIntervals.add(it.startStr to it.endStr)
                    }
                    scheduleRepo.getTomorrowSlots(q)?.let { tomorrowSlots ->
                        scheduleRepo.getDetailedIntervals(tomorrowSlots).forEach {
                            candidateIntervals.add(it.startStr to it.endStr)
                        }
                    }
                    scheduleRepo.getDetailedIntervals(ZtoeParser.generateFallbackSchedule(q, dateStr)).forEach {
                        candidateIntervals.add(it.startStr to it.endStr)
                    }
                } catch (_: Exception) {}

                for ((startStr, endStr) in candidateIntervals) {
                    val blockId = "block_${date}_${startStr}_${endStr}_Q$q"
                    if (blockId !in activeInWindowBlockIds) {
                        cancelAlertPendingIntent(appContext, alarmManager, blockId)
                    }
                }
            }
        }
    }

    private fun cancelAlertPendingIntent(
        appContext: Context,
        alarmManager: AlarmManager,
        blockId: String
    ) {
        try {
            val intent = Intent(appContext, AlarmReceiver::class.java).apply {
                action = "ua.blackout.prewarning.ACTION_TRIGGER_BLACKOUT_ALERT"
            }
            val pi = PendingIntent.getBroadcast(
                appContext,
                blockId.hashCode(),
                intent,
                PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
            )
            if (pi != null) {
                alarmManager.cancel(pi)
                pi.cancel()
            }
        } catch (_: Exception) {}
    }

    private fun cancelWidgetPendingIntent(
        appContext: Context,
        alarmManager: AlarmManager,
        transitionId: String
    ) {
        try {
            val intent = Intent(appContext, AlarmReceiver::class.java).apply {
                action = "ua.blackout.prewarning.ACTION_WIDGET_TRANSITION_UPDATE"
            }
            val pi = PendingIntent.getBroadcast(
                appContext,
                transitionId.hashCode(),
                intent,
                PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
            )
            if (pi != null) {
                alarmManager.cancel(pi)
                pi.cancel()
            }
        } catch (_: Exception) {}
    }
}
