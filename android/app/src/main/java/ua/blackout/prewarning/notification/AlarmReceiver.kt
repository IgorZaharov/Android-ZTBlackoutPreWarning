package ua.blackout.prewarning.notification

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import ua.blackout.prewarning.core.OutageEngine
import ua.blackout.prewarning.core.Subscriptions
import ua.blackout.prewarning.data.KYIV_ZONE
import ua.blackout.prewarning.data.repository.AlertRegistry
import ua.blackout.prewarning.data.repository.SettingsRepository
import ua.blackout.prewarning.data.repository.SubscriptionSync
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

    /**
     * Posts every planned group that starts at the alarm's span start and still has a member that
     * was not warned (spec/SUBSCRIPTIONS.md 8.2). The plan is recomputed from the current state, so
     * a changed schedule, queue or address list never posts a stale warning or loses a due one.
     */
    private suspend fun handleAlert(appContext: Context, intent: Intent) {
        val settings = SettingsRepository(appContext).getSettings()
        val sync = SubscriptionSync(appContext)
        val master = sync.master()
        if (!master) return
        val subs = sync.store()

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

        // Plan as seen a little before the alarm, so the alert that is firing now is still part of it
        val lookback = now.minusMinutes(advance.toLong() + 3)
        val groups = AlarmScheduler.plannedGroups(appContext, subs, master, lookback, advance)
            .filter { it.spanStart == spanStart }
        if (groups.isEmpty()) return

        val registry = AlertRegistry(appContext)
        val lang = AppStrings.resolveLang(settings.language)
        for (group in groups) {
            if (Subscriptions.pendingMembers(group) { registry.hasNotified(it) }.isEmpty()) continue
            for (id in group.memberIds) registry.markNotified(Subscriptions.memberKey(id, group.spanStart))

            val body = AppStrings.plannedAlertBody(
                lang = lang,
                queue = group.queue,
                // A start is never "24:00": an outage starting at midnight reads 00:00 (spec/NOTIFICATIONS.md)
                start = "%02d:%02d".format(group.spanStart.hour, group.spanStart.minute),
                end = OutageEngine.formatSpanTime(group.spanEnd),
                minutesLeft = ChronoUnit.MINUTES.between(now, spanStart),
                durationMinutes = group.durationMinutes,
                mayContinue = group.mayContinue,
                labels = Subscriptions.alertLabels(subs, group.memberIds)
            )
            NotificationHelper.showPreWarningNotification(
                appContext,
                AlarmCodes.codeFor(appContext, group.key),
                AppStrings.plannedAlertTitle(lang),
                body
            )
        }
    }
}
