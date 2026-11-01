package ua.blackout.prewarning.worker

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.work.ExistingPeriodicWorkPolicy
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import ua.blackout.prewarning.widget.BlackoutGlanceWidget

class BootCompletedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            val appContext = context.applicationContext
            ScheduleSyncWorker.schedulePeriodicWork(appContext, ExistingPeriodicWorkPolicy.UPDATE)
            val pendingResult = goAsync()
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    if (BlackoutGlanceWidget.hasActiveWidgets(appContext)) {
                        BlackoutGlanceWidget.syncAllWidgets(appContext)
                    }
                } catch (_: Exception) {
                } finally {
                    try {
                        pendingResult.finish()
                    } catch (_: Exception) {}
                }
            }
        }
    }
}

