package ua.blackout.prewarning

import android.app.Application
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import ua.blackout.prewarning.data.repository.SettingsRepository
import ua.blackout.prewarning.notification.NotificationHelper
import ua.blackout.prewarning.worker.ScheduleSyncWorker
import java.util.concurrent.TimeUnit

class BlackoutApp : Application() {

    override fun onCreate() {
        super.onCreate()

        // Setup high-priority Notification Channels
        NotificationHelper.createNotificationChannels(this)

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
