package ua.blackout.prewarning.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import ua.blackout.prewarning.core.SubscriptionStore
import ua.blackout.prewarning.core.Subscriptions
import ua.blackout.prewarning.data.model.UserSettings
import ua.blackout.prewarning.data.repository.OutageRepository
import ua.blackout.prewarning.data.repository.OutageSnapshot
import ua.blackout.prewarning.data.repository.SettingsRepository
import ua.blackout.prewarning.data.repository.SubscriptionSync

/**
 * Which address each placed widget shows (spec/SUBSCRIPTIONS.md section 10). One SharedPreferences entry
 * per app widget id; no entry = follow the primary. Kept outside the Glance state so the alarm planner and
 * the refresh can read it synchronously. Not backed up: app widget ids change on restore.
 */
object WidgetBindings {
    private const val PREFS = "zt_widget_bindings_v1"
    private fun key(appWidgetId: Int) = "w_$appWidgetId"
    private fun prefs(context: Context) = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private val RECEIVERS = listOf(
        BlackoutWidgetReceiver::class.java,
        BlackoutBigWidgetReceiver::class.java,
        BlackoutStripWidgetReceiver::class.java
    )

    /** The bound subscription id of one widget; null = follow the primary. */
    fun boundId(context: Context, appWidgetId: Int): String? = prefs(context).getString(key(appWidgetId), null)

    fun bind(context: Context, appWidgetId: Int, subscriptionId: String?) {
        val e = prefs(context).edit()
        if (subscriptionId == null) e.remove(key(appWidgetId)) else e.putString(key(appWidgetId), subscriptionId)
        e.apply()
    }

    fun unbind(context: Context, appWidgetIds: IntArray) {
        val e = prefs(context).edit()
        for (id in appWidgetIds) e.remove(key(id))
        e.apply()
    }

    /** App widget ids of every placed widget of the three kinds. */
    fun placedWidgetIds(context: Context): List<Int> {
        val appCtx = context.applicationContext
        val manager = AppWidgetManager.getInstance(appCtx)
        return RECEIVERS.flatMap { cls ->
            try {
                manager.getAppWidgetIds(ComponentName(appCtx, cls)).toList()
            } catch (_: Exception) {
                emptyList()
            }
        }
    }

    /** The distinct items the placed widgets show (`widgetItemIds`): redraw alarms and PowerOn polling. */
    fun shownItemIds(context: Context, store: SubscriptionStore): List<String> =
        Subscriptions.widgetItemIds(store, placedWidgetIds(context).map { boundId(context, it) })
}

/** What one widget draws: the settings and snapshot of its item, the item id (tap target) and its label. */
internal data class WidgetSource(
    val settings: UserSettings,
    val snapshot: OutageSnapshot,
    val itemId: String?,
    val label: String?
)

/** Resolves the item of [appWidgetId] (null = unknown widget, follow the primary); local state only. */
internal fun widgetSource(context: Context, appWidgetId: Int?): WidgetSource {
    val appCtx = context.applicationContext
    val settings = SettingsRepository(appCtx).getSettings()
    val outageRepo = OutageRepository(appCtx)
    val store = SubscriptionSync(appCtx).store()
    val bound = appWidgetId?.let { WidgetBindings.boundId(appCtx, it) }
    val item = Subscriptions.widgetItem(store, bound)
    val label = Subscriptions.widgetLabel(store, bound)
    if (item == null || item.id == store.primaryId) {
        // The primary reads the mirrored single-address keys, exactly as before step 5
        return WidgetSource(settings, outageRepo.snapshot(settings), item?.id, label)
    }
    val itemSettings = settings.copy(queue = item.queue.orEmpty(), customQueueStatusText = item.queueStatusText)
    return WidgetSource(itemSettings, outageRepo.snapshotFor(item), item.id, label)
}
