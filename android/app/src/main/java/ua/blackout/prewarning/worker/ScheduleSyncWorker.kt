package ua.blackout.prewarning.worker

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import ua.blackout.prewarning.data.parser.FetchStatus
import ua.blackout.prewarning.data.parser.ZtoeAddressLookup
import ua.blackout.prewarning.data.parser.ZtoeParser
import ua.blackout.prewarning.data.repository.ScheduleRepository
import ua.blackout.prewarning.data.repository.SettingsRepository
import ua.blackout.prewarning.notification.AlarmScheduler
import ua.blackout.prewarning.notification.NotificationHelper
import ua.blackout.prewarning.ui.AppStrings
import ua.blackout.prewarning.widget.BlackoutGlanceWidget
import java.util.concurrent.TimeUnit

class ScheduleSyncWorker(
    private val context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    override suspend fun doWork(): Result {
        return try {
            val appContext = context.applicationContext
            val settingsRepo = SettingsRepository(appContext)
            var settings = settingsRepo.getSettings()
            val resolvedLang = AppStrings.resolveLang(settings.language)

            // Re-check saved address query & emergency outages on ZTOE website
            val addressQuery = settings.selectedAddressQuery
            if (addressQuery != null) {
                val latestAddressLookup = ZtoeAddressLookup.checkAddressOnZtoeWebsite(addressQuery, settings.cityUrl)
                if (latestAddressLookup != null) {
                    val prevEmergency = settings.activeEmergencyOutage
                    val nextEmergency = latestAddressLookup.emergencyOutage

                    NotificationHelper.checkAndTriggerEmergencyOutageAlert(
                        context = appContext,
                        prevOutage = prevEmergency,
                        nextOutage = nextEmergency,
                        settings = settings,
                        lang = resolvedLang
                    )

                    val emergencyChanged =
                        (prevEmergency?.id != nextEmergency?.id) ||
                            (prevEmergency?.startTime != nextEmergency?.startTime) ||
                            (prevEmergency?.estimatedRestoreTime != nextEmergency?.estimatedRestoreTime)

                    val hadNoQueue = settings.queue.isBlank()
                    val queueAssignedForNoQueueHouse = hadNoQueue &&
                        (latestAddressLookup.queue != settings.queue ||
                            latestAddressLookup.statusText != settings.customQueueStatusText)

                    if (queueAssignedForNoQueueHouse || emergencyChanged) {
                        val nextQueue = if (queueAssignedForNoQueueHouse) latestAddressLookup.queue else settings.queue
                        val nextStatusText = if (queueAssignedForNoQueueHouse) latestAddressLookup.statusText else settings.customQueueStatusText
                        settings = settings.copy(
                            queue = nextQueue,
                            customQueueStatusText = nextStatusText,
                            activeEmergencyOutage = nextEmergency
                        )
                        settingsRepo.saveSettings(settings)
                    }
                }
            }

            val scheduleRepo = ScheduleRepository(appContext)
            val fetchRes = ZtoeParser.fetchFullSchedule(settings.cityUrl, settings.queue, appContext)

            // Only save schedule when live fetch succeeded; clear cached results if unreachable or no queues found
            if (fetchRes.status == FetchStatus.SUCCESS) {
                if (settings.queue.isNotBlank()) {
                    scheduleRepo.saveSchedule(settings.queue, fetchRes.todaySlots, fetchRes.tomorrowSlots)
                }
            } else {
                scheduleRepo.clearScheduleCache()
            }

            val hasWidgets = try {
                BlackoutGlanceWidget.hasActiveWidgets(appContext)
            } catch (_: Exception) {
                false
            }

            if (hasWidgets) {
                try {
                    BlackoutGlanceWidget.syncAllWidgets(appContext)
                } catch (_: Exception) {}
            }

            // Re-read latest settings right before scheduling alarms in case user changed queue while network fetch was running
            AlarmScheduler.syncAlarms(appContext)

            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }

    companion object {
        const val WORK_NAME = "ScheduleSyncWorker"

        fun schedulePeriodicWork(
            context: Context,
            policy: ExistingPeriodicWorkPolicy = ExistingPeriodicWorkPolicy.KEEP
        ) {
            val appContext = context.applicationContext
            val settings = SettingsRepository(appContext).getSettings()
            val intervalMinutes = settings.refreshIntervalMinutes.coerceAtLeast(15L)

            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val syncRequest = PeriodicWorkRequestBuilder<ScheduleSyncWorker>(intervalMinutes, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .build()

            WorkManager.getInstance(appContext).enqueueUniquePeriodicWork(
                WORK_NAME,
                policy,
                syncRequest
            )
        }
    }
}