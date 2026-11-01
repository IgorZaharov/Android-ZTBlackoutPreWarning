package ua.blackout.prewarning.notification

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import ua.blackout.prewarning.data.repository.AlertRegistry
import ua.blackout.prewarning.widget.BlackoutGlanceWidget

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

                val slotId = intent.getStringExtra("EXTRA_SLOT_ID") ?: return@launch
                val queue = intent.getStringExtra("EXTRA_QUEUE") ?: "1.1"
                val timeStr = intent.getStringExtra("EXTRA_TIME") ?: "14:00"
                val minutes = intent.getIntExtra("EXTRA_MINUTES", 15)

                val alertRegistry = AlertRegistry(appContext)

                // STRICT REQUIREMENT: Send notification only once per blackout slot
                if (alertRegistry.hasNotified(slotId)) {
                    return@launch
                }

                // Mark as notified immediately
                alertRegistry.markNotified(slotId)

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