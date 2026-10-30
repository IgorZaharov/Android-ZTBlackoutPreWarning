package ua.blackout.prewarning.worker

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import ua.blackout.prewarning.data.parser.ZtoeParser
import ua.blackout.prewarning.data.repository.AlertRegistry
import ua.blackout.prewarning.data.repository.SettingsRepository
import ua.blackout.prewarning.notification.AlarmReceiver
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId

class ScheduleSyncWorker(
    private val context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    override suspend fun doWork(): Result {
        return try {
            val settingsRepo = SettingsRepository(context)
            val settings = settingsRepo.getSettings()

            if (!settings.notificationsEnabled) {
                return Result.success()
            }

            val today = LocalDate.now()
            val slots = ZtoeParser.fetchAndParse(settings.cityUrl, settings.queue, today)
            val alertRegistry = AlertRegistry(context)

            val now = LocalDateTime.now()
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

            // Battery & UX Optimization: Group consecutive blackout slots into continuous blocks.
            // Only 1 alarm is scheduled per blackout block, preventing multiple wakeups/alerts!
            val intervals = mutableListOf<Pair<Int, Int>>() // list of Pair(startHour, endHour)
            var inBlock = false
            var blockStart = 0
            for (i in 0 until 24) {
                val isOff = slots.getOrNull(i)?.status == ua.blackout.prewarning.data.model.SlotStatus.POWER_OFF
                if (isOff && !inBlock) {
                    inBlock = true
                    blockStart = i
                } else if (!isOff && inBlock) {
                    inBlock = false
                    intervals.add(Pair(blockStart, i))
                }
            }
            if (inBlock) {
                intervals.add(Pair(blockStart, 24))
            }

            // Schedule single exact alarm for each upcoming blackout block
            for (block in intervals) {
                val startHour = block.first
                val endHour = block.second
                val startStr = String.format("%02d:00", startHour)
                val endStr = String.format("%02d:00", endHour)
                val blockId = "block_${today}_${startStr}_${endStr}_Q${settings.queue}"

                if (alertRegistry.hasNotified(blockId)) {
                    continue // Block already alerted
                }

                val blockStartTime = LocalDateTime.of(today, LocalTime.of(startHour, 0))
                val alertTime = blockStartTime.minusMinutes(settings.advanceNoticeMinutes.toLong())

                if (alertTime.isAfter(now)) {
                    val epochMillis = alertTime.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
                    val timeSpan = if (endHour - startHour > 1) "$startStr–$endStr" else startStr
                    val intent = Intent(context, AlarmReceiver::class.java).apply {
                        action = "ua.blackout.prewarning.ACTION_TRIGGER_BLACKOUT_ALERT"
                        putExtra("EXTRA_SLOT_ID", blockId)
                        putExtra("EXTRA_QUEUE", settings.queue)
                        putExtra("EXTRA_TIME", timeSpan)
                        putExtra("EXTRA_MINUTES", settings.advanceNoticeMinutes)
                    }

                    val pendingIntent = PendingIntent.getBroadcast(
                        context,
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
    }
}