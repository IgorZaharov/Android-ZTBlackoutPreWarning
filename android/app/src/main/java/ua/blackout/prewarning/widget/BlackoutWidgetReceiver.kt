package ua.blackout.prewarning.widget

import android.appwidget.AppWidgetManager
import android.content.Context
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import ua.blackout.prewarning.data.repository.OutageRepository
import ua.blackout.prewarning.data.repository.ScheduleRepository
import ua.blackout.prewarning.data.repository.SettingsRepository
import ua.blackout.prewarning.notification.AlarmScheduler

open class BlackoutWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = BlackoutGlanceWidget()

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        refreshAndRedraw(context, forceNetwork = true)
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        super.onUpdate(context, appWidgetManager, appWidgetIds)
        refreshAndRedraw(context, forceNetwork = false)
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        // The last widget is gone: re-plan so the widget transition alarms are cancelled
        refreshAndRedraw(context, forceNetwork = false, fetch = false)
    }

    /**
     * Refreshes through [OutageRepository] when the cache is missing or older than the refresh interval
     * (always when [forceNetwork]), then re-plans alarms (which schedule or cancel the widget transition
     * redraws) and redraws. A failed fetch keeps the previous data and still redraws.
     */
    private fun refreshAndRedraw(context: Context, forceNetwork: Boolean, fetch: Boolean = true) {
        val pendingResult = goAsync()
        val appContext = context.applicationContext
        CoroutineScope(Dispatchers.IO).launch {
            try {
                if (fetch) {
                    try {
                        val settings = SettingsRepository(appContext).getSettings()
                        val hasSource = settings.queue.isNotBlank() || settings.selectedAddressQuery != null
                        if (hasSource) {
                            val scheduleRepo = ScheduleRepository(appContext)
                            val cacheFresh = scheduleRepo.hasValidTodayCache(settings.queue) &&
                                scheduleRepo.isCacheFresh(settings.refreshIntervalMinutes)
                            if (forceNetwork || !cacheFresh) {
                                OutageRepository(appContext).refresh(settings, forceNetwork)
                            }
                        }
                    } catch (e: CancellationException) {
                        throw e
                    } catch (_: Exception) {
                    }
                }
                try {
                    AlarmScheduler.syncAlarms(appContext)
                } catch (e: CancellationException) {
                    throw e
                } catch (_: Exception) {
                }
                try {
                    BlackoutGlanceWidget.syncAllWidgets(appContext)
                } catch (e: CancellationException) {
                    throw e
                } catch (_: Exception) {
                }
            } finally {
                try {
                    pendingResult.finish()
                } catch (_: Exception) {
                }
            }
        }
    }
}

class BlackoutBigWidgetReceiver : BlackoutWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = BlackoutBigGlanceWidget()
}

class BlackoutStripWidgetReceiver : BlackoutWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = BlackoutStripGlanceWidget()
}
