package ua.blackout.prewarning.worker

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.work.ExistingPeriodicWorkPolicy
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import ua.blackout.prewarning.notification.AlarmScheduler
import ua.blackout.prewarning.widget.BlackoutGlanceWidget

class BootCompletedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        if (
            action == Intent.ACTION_BOOT_COMPLETED ||
            action == Intent.ACTION_MY_PACKAGE_REPLACED ||
            action == Intent.ACTION_TIME_CHANGED ||
            action == Intent.ACTION_TIMEZONE_CHANGED ||
            action == Intent.ACTION_DATE_CHANGED
        ) {
            val appContext = context.applicationContext
            val isTimeChanged = action == Intent.ACTION_TIME_CHANGED ||
                action == Intent.ACTION_TIMEZONE_CHANGED ||
                action == Intent.ACTION_DATE_CHANGED

            if (!isTimeChanged) {
                ScheduleSyncWorker.schedulePeriodicWork(appContext, ExistingPeriodicWorkPolicy.UPDATE)
            }

            val pendingResult = goAsync()
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    AlarmScheduler.syncAlarms(appContext, onTimeChanged = isTimeChanged)
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
