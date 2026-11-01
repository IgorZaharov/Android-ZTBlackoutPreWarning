package ua.blackout.prewarning.worker

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import ua.blackout.prewarning.data.parser.FetchStatus
import ua.blackout.prewarning.data.parser.ZtoeParser
import ua.blackout.prewarning.data.repository.AlertRegistry
import ua.blackout.prewarning.data.repository.ScheduleRepository
import ua.blackout.prewarning.data.repository.SettingsRepository
import ua.blackout.prewarning.notification.AlarmReceiver
import ua.blackout.prewarning.widget.BlackoutGlanceWidget
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.util.concurrent.TimeUnit

class ScheduleSyncWorker(
    private val context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    override suspend fun doWork(): Result {
        return try {
            val appContext = context.applicationContext
            val settingsRepo = SettingsRepository(appContext)
            val settings = settingsRepo.getSettings()

            val today = LocalDate.now(ZoneId.of("Europe/Kyiv"))
            val scheduleRepo = ScheduleRepository(appContext)
            val fetchRes = ZtoeParser.fetchFullSchedule(settings.cityUrl, settings.queue, appContext)

            // Only overwrite cached schedule if live fetch succeeded or no valid cache exists for today
            if (fetchRes.status == FetchStatus.SUCCESS || !scheduleRepo.hasValidTodayCache(settings.queue)) {
                scheduleRepo.saveSchedule(settings.queue, fetchRes.todaySlots, fetchRes.tomorrowSlots)
            }
            val slots = scheduleRepo.getTodaySlots(settings.queue)

            val hasWidgets = try {
                BlackoutGlanceWidget.hasActiveWidgets(appContext)
            } catch (_: Exception) {
                false
            }

            if (hasWidgets) {
                try {
                    BlackoutGlanceWidget.syncAllWidgets(appContext)
                } catch (_: Exception) {}
            }

            val now = LocalDateTime.now(ZoneId.of("Europe/Kyiv"))
            val alarmManager = appContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager

            // Battery & UX Optimization: Group consecutive blackout slots into continuous blocks
            val intervals = scheduleRepo.getDetailedIntervals(slots)

            // Schedule widget transition redraw alarms only when active widgets are placed on home screen
            // Use non-wakeup RTC so screen-off deep sleep is not interrupted solely for visual widget redraws
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
                                val epochMs = transitionTime.atZone(ZoneId.of("Europe/Kyiv")).toInstant().toEpochMilli() + 1500L
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
                                } catch (_: Exception) {}
                            }
                        }
                }
            }

            if (!settings.notificationsEnabled) {
                return Result.success()
            }

            val alertRegistry = AlertRegistry(appContext)

            // Schedule single exact alarm for each upcoming blackout block
            for (block in intervals) {
                val startParts = block.startStr.split(":")
                val startH = startParts[0].toInt()
                val startM = startParts[1].toInt()
                val blockId = "block_${today}_${block.startStr}_${block.endStr}_Q${settings.queue}"

                if (alertRegistry.hasNotified(blockId)) {
                    continue // Block already alerted
                }

                val blockStartTime = LocalDateTime.of(today, LocalTime.of(startH, startM))
                val alertTime = blockStartTime.minusMinutes(settings.advanceNoticeMinutes.toLong())

                if (alertTime.isAfter(now)) {
                    val epochMillis = alertTime.atZone(ZoneId.of("Europe/Kyiv")).toInstant().toEpochMilli()
                    val timeSpan = "${block.startStr}–${block.endStr}"
                    val intent = Intent(appContext, AlarmReceiver::class.java).apply {
                        action = "ua.blackout.prewarning.ACTION_TRIGGER_BLACKOUT_ALERT"
                        putExtra("EXTRA_SLOT_ID", blockId)
                        putExtra("EXTRA_QUEUE", settings.queue)
                        putExtra("EXTRA_TIME", timeSpan)
                        putExtra("EXTRA_MINUTES", settings.advanceNoticeMinutes)
                    }

                    val pendingIntent = PendingIntent.getBroadcast(
                        appContext,
                        blockId.hashCode(),
                        intent,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    )

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, epochMillis, pendingIntent)
                    } else {
                        alarmManager.setExact(AlarmManager.RTC_WAKEUP, epochMillis, pendingIntent)
                    }
                }
            }

            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }

    companion object {
        const val WORK_NAME = "ScheduleSyncWorker"

        fun schedulePeriodicWork(
            context: Context,
            policy: ExistingPeriodicWorkPolicy = ExistingPeriodicWorkPolicy.KEEP
        ) {
            val appContext = context.applicationContext
            val settings = SettingsRepository(appContext).getSettings()
            val intervalMinutes = settings.refreshIntervalMinutes.coerceAtLeast(15L)

            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val syncRequest = PeriodicWorkRequestBuilder<ScheduleSyncWorker>(intervalMinutes, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .build()

            WorkManager.getInstance(appContext).enqueueUniquePeriodicWork(
                WORK_NAME,
                policy,
                syncRequest
            )
        }
    }
}