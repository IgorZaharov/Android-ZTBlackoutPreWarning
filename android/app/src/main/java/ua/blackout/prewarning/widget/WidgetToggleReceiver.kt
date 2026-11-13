package ua.blackout.prewarning.widget

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import ua.blackout.prewarning.data.repository.SubscriptionSync
import ua.blackout.prewarning.notification.AlarmScheduler

/**
 * Toggles pre-warning alerts. Nothing in the sources sends [ACTION] any more (the widget buttons use
 * Glance action callbacks); the receiver is kept for compatibility and is non-exported in the manifest,
 * so other apps cannot reach it (C15).
 */
class WidgetToggleReceiver : BroadcastReceiver() {
    companion object {
        const val ACTION = "ua.blackout.prewarning.ACTION_TOGGLE_WIDGET_NOTIFICATIONS"
    }

    override fun onReceive(context: Context, intent: Intent?) {
        val pendingResult = goAsync()
        val appContext = context.applicationContext
        // The widget bell is the master switch for all addresses (multi-address owner decision 4)
        val sync = SubscriptionSync(appContext)
        sync.setMaster(!sync.master())

        CoroutineScope(Dispatchers.IO).launch {
            try {
                AlarmScheduler.syncAlarms(appContext)
                BlackoutGlanceWidget.syncAllWidgets(appContext)
            } catch (_: Exception) {
            } finally {
                try {
                    pendingResult.finish()
                } catch (_: Exception) {}
            }
        }
    }
}
