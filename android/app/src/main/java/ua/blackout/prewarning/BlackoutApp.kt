package ua.blackout.prewarning

import android.app.Application
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import ua.blackout.prewarning.notification.NotificationHelper
import ua.blackout.prewarning.worker.ScheduleSyncWorker
import java.util.concurrent.TimeUnit

class BlackoutApp : Application() {

    override fun onCreate() {
        super.onCreate()
        
        // Setup high-priority Notification Channels
        NotificationHelper.createNotificationChannels(this)

        // Schedule periodic 15-minute background check with WorkManager
        schedulePeriodicSync()
    }

    private fun schedulePeriodicSync() {
        val syncRequest = PeriodicWorkRequestBuilder<ScheduleSyncWorker>(15, TimeUnit.MINUTES)
            .build()

        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            ScheduleSyncWorker.WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            syncRequest
        )
    }
}
