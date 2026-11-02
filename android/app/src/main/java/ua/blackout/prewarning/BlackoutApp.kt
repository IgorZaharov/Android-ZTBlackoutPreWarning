package ua.blackout.prewarning

import android.app.Application
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import androidx.core.content.ContextCompat
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import ua.blackout.prewarning.data.repository.SettingsRepository
import ua.blackout.prewarning.notification.AlarmScheduler
import ua.blackout.prewarning.notification.NotificationHelper
import ua.blackout.prewarning.widget.BlackoutGlanceWidget
import ua.blackout.prewarning.worker.ScheduleSyncWorker
import java.util.concurrent.TimeUnit

class BlackoutApp : Application() {

    private val systemTimeChangeReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent?) {
            val appContext = context.applicationContext
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    AlarmScheduler.syncAlarms(appContext, onTimeChanged = true)
                    if (BlackoutGlanceWidget.hasActiveWidgets(appContext)) {
                        BlackoutGlanceWidget.syncAllWidgets(appContext)
                    }
                } catch (_: Exception) {}
            }
        }
    }

    override fun onCreate() {
        super.onCreate()

        // Setup high-priority Notification Channels
        NotificationHelper.createNotificationChannels(this)

        // Register dynamic receiver for system clock, date, and timezone adjustments
        try {
            val filter = IntentFilter().apply {
                addAction(Intent.ACTION_TIME_CHANGED)
                addAction(Intent.ACTION_TIMEZONE_CHANGED)
                addAction(Intent.ACTION_DATE_CHANGED)
            }
            ContextCompat.registerReceiver(
                this,
                systemTimeChangeReceiver,
                filter,
                ContextCompat.RECEIVER_NOT_EXPORTED
            )
        } catch (_: Exception) {}

        // Immediately clean up any stale alarms and sync active queue alarms
        CoroutineScope(Dispatchers.IO).launch {
            try {
                AlarmScheduler.syncAlarms(this@BlackoutApp)
            } catch (_: Exception) {}
        }

        // Schedule periodic background check with WorkManager using user's configured interval (default 30 min)
        schedulePeriodicSync()
    }

    private fun schedulePeriodicSync() {
        val settings = SettingsRepository(this).getSettings()
        val intervalMinutes = settings.refreshIntervalMinutes.coerceAtLeast(15L)

        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val syncRequest = PeriodicWorkRequestBuilder<ScheduleSyncWorker>(intervalMinutes, TimeUnit.MINUTES)
            .setConstraints(constraints)
            .build()

        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            ScheduleSyncWorker.WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            syncRequest
        )
    }
}
