package ua.blackout.prewarning.notification

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import ua.blackout.prewarning.data.repository.AlertRegistry

class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val slotId = intent.getStringExtra("EXTRA_SLOT_ID") ?: return
        val queue = intent.getStringExtra("EXTRA_QUEUE") ?: "2.1"
        val timeStr = intent.getStringExtra("EXTRA_TIME") ?: "14:00"
        val minutes = intent.getIntExtra("EXTRA_MINUTES", 30)

        val alertRegistry = AlertRegistry(context)

        // STRICT REQUIREMENT: Send notification only once per blackout slot
        if (alertRegistry.hasNotified(slotId)) {
            return
        }

        // Mark as notified immediately
        alertRegistry.markNotified(slotId)

        val title = "⚡ Попередження: відключення світла"
        val body = "Черга $queue: відключення розпочнеться о $timeStr (через $minutes хв)."

        val notificationId = slotId.hashCode()
        NotificationHelper.showPreWarningNotification(context, notificationId, title, body)
    }
}