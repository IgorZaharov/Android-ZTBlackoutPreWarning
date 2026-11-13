package ua.blackout.prewarning.notification

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import ua.blackout.prewarning.core.OutageEngine
import ua.blackout.prewarning.core.OutageKind
import ua.blackout.prewarning.data.KYIV_ZONE
import ua.blackout.prewarning.data.repository.AlertRegistry
import ua.blackout.prewarning.data.repository.OutageRepository
import ua.blackout.prewarning.data.repository.SettingsRepository
import ua.blackout.prewarning.ui.AppStrings
import ua.blackout.prewarning.widget.BlackoutGlanceWidget
import java.time.Instant
import java.time.LocalDateTime
import java.time.temporal.ChronoUnit

class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val appContext = context.applicationContext
        val pendingResult = goAsync()

        CoroutineScope(Dispatchers.IO).launch {
            try {
                // The notification goes first: redrawing widgets can involve a network fetch and must never delay a warning
                when (intent.action) {
                    AlarmScheduler.ACTION_ALERT -> handleAlert(appContext, intent)
                    AlarmScheduler.ACTION_MIDNIGHT -> AlarmScheduler.syncAlarms(appContext)
                }
                try {
                    BlackoutGlanceWidget.syncAllWidgets(appContext)
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

    private suspend fun handleAlert(appContext: Context, intent: Intent) {
        val settings = SettingsRepository(appContext).getSettings()
        if (!settings.notificationsEnabled) return

        val key = intent.getStringExtra(AlarmScheduler.EXTRA_KEY) ?: return
        val startMs = intent.getLongExtra(AlarmScheduler.EXTRA_SPAN_START_MS, -1L)
        if (startMs < 0L) return
        val advance = intent.getIntExtra(AlarmScheduler.EXTRA_MINUTES, settings.advanceNoticeMinutes)

        val spanStart = LocalDateTime.ofInstant(Instant.ofEpochMilli(startMs), KYIV_ZONE)
        val now = LocalDateTime.now(KYIV_ZONE)
        val alertTime = spanStart.minusMinutes(advance.toLong())

        if (now.isBefore(alertTime.minusMinutes(2))) {
            // The system clock moved backward before the alert window: plan again
            AlarmScheduler.syncAlarms(appContext, onTimeChanged = true)
            return
        }
        if (now.isAfter(spanStart.plusMinutes(2))) {
            // The outage has already begun: a pre-warning would be stale
            return
        }

        // The span must still be part of today's plan (schedule or repair works may have changed since scheduling)
        val snapshot = OutageRepository(appContext).snapshot(settings, now)
        val span = OutageEngine.spans(
            snapshot.outages.filter { !it.stale },
            setOf(OutageKind.PLANNED, OutageKind.REPAIR)
        ).firstOrNull { it.start == spanStart } ?: return

        val registry = AlertRegistry(appContext)
        if (registry.hasNotified(key)) return
        registry.markNotified(key)

        val lang = AppStrings.resolveLang(settings.language)
        val body = AppStrings.plannedAlertBody(
            lang = lang,
            queue = settings.queue,
            // A start is never "24:00": an outage starting at midnight reads 00:00 (spec/NOTIFICATIONS.md)
            start = "%02d:%02d".format(span.start.hour, span.start.minute),
            end = OutageEngine.formatSpanTime(span.end),
            minutesLeft = ChronoUnit.MINUTES.between(now, spanStart),
            durationMinutes = OutageEngine.minutesBetween(span.start, span.end),
            mayContinue = span.mayContinue
        )
        NotificationHelper.showPreWarningNotification(
            appContext,
            AlarmCodes.codeFor(appContext, key),
            AppStrings.plannedAlertTitle(lang),
            body
        )
    }
}
