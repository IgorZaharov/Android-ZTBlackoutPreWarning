package ua.blackout.prewarning.notification

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import ua.blackout.prewarning.data.repository.AlertRegistry
import ua.blackout.prewarning.data.repository.ScheduleRepository
import ua.blackout.prewarning.data.repository.SettingsRepository
import ua.blackout.prewarning.widget.BlackoutGlanceWidget
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId

class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val appContext = context.applicationContext
        val pendingResult = goAsync()

        CoroutineScope(Dispatchers.IO).launch {
            try {
                try {
                    BlackoutGlanceWidget.syncAllWidgets(appContext)
                } catch (_: Exception) {}

                if (intent.action == "ua.blackout.prewarning.ACTION_WIDGET_TRANSITION_UPDATE") {
                    return@launch
                }

                val currentSettings = SettingsRepository(appContext).getSettings()
                if (!currentSettings.notificationsEnabled) {
                    return@launch
                }

                val slotId = intent.getStringExtra("EXTRA_SLOT_ID") ?: return@launch
                val intentQueue = intent.getStringExtra("EXTRA_QUEUE") ?: return@launch

                // Reject stale alarms from any queue other than the user's currently selected queue (e.g. default 1.1)
                if (intentQueue != currentSettings.queue || !slotId.endsWith("_Q${currentSettings.queue}")) {
                    return@launch
                }

                val kyivZone = ZoneId.of("Europe/Kyiv")
                val today = LocalDate.now(kyivZone)
                if (!slotId.startsWith("block_${today}_")) {
                    return@launch
                }

                val timeStr = intent.getStringExtra("EXTRA_TIME") ?: return@launch
                val minutes = intent.getIntExtra("EXTRA_MINUTES", currentSettings.advanceNoticeMinutes)

                // Verify that the alarm corresponds to an active blackout interval in today's schedule for the selected queue
                val scheduleRepo = ScheduleRepository(appContext)
                val todayIntervals = scheduleRepo.getDetailedIntervals(scheduleRepo.getTodaySlots(currentSettings.queue))
                val matchingInterval = todayIntervals.firstOrNull { "${it.startStr}–${it.endStr}" == timeStr }
                    ?: return@launch

                // Verify current time is within the valid pre-warning window [alertTime - 2min, blockStartTime + 2min]
                // Prevents past-due alarms from firing when the user changes system time on mobile
                val startParts = matchingInterval.startStr.split(":")
                val startH = startParts.getOrNull(0)?.toIntOrNull() ?: return@launch
                val startM = startParts.getOrNull(1)?.toIntOrNull() ?: return@launch
                val blockStartTime = LocalDateTime.of(today, LocalTime.of(startH, startM))
                val alertTime = blockStartTime.minusMinutes(minutes.toLong())
                val now = LocalDateTime.now(kyivZone)

                if (now.isBefore(alertTime.minusMinutes(2))) {
                    // System clock was moved backward before the alert window; reschedule alarms
                    AlarmScheduler.syncAlarms(appContext, onTimeChanged = true)
                    return@launch
                }
                if (now.isAfter(blockStartTime.plusMinutes(2))) {
                    // System clock was moved forward past the outage start time; do not fire stale pre-warning
                    return@launch
                }

                val alertRegistry = AlertRegistry(appContext)

                // STRICT REQUIREMENT: Send notification only once per blackout slot
                if (alertRegistry.hasNotified(slotId)) {
                    return@launch
                }

                // Mark as notified immediately
                alertRegistry.markNotified(slotId)

                val queue = currentSettings.queue
                val title = "Попередження: відключення світла"
                val body = "Черга $queue: відключення розпочнеться о $timeStr (через $minutes хв)."

                val notificationId = slotId.hashCode()
                NotificationHelper.showPreWarningNotification(appContext, notificationId, title, body)
            } finally {
                try {
                    pendingResult.finish()
                } catch (_: Exception) {}
            }
        }
    }
}