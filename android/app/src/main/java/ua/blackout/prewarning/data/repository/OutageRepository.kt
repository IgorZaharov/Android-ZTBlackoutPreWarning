package ua.blackout.prewarning.data.repository

import ua.blackout.prewarning.widget.WidgetBindings
import android.content.Context
import ua.blackout.prewarning.core.DayView
import ua.blackout.prewarning.core.EmergencyEvent
import ua.blackout.prewarning.core.EmergencyFetch
import ua.blackout.prewarning.core.EmergencyLedger
import ua.blackout.prewarning.core.HouseKey
import ua.blackout.prewarning.core.IntervalStatus
import ua.blackout.prewarning.core.Outage
import ua.blackout.prewarning.core.OutageEngine
import ua.blackout.prewarning.core.OutageKind
import ua.blackout.prewarning.core.SiteState
import ua.blackout.prewarning.core.StatusInfo
import ua.blackout.prewarning.core.StreetKey
import ua.blackout.prewarning.core.Subscription
import ua.blackout.prewarning.core.SubscriptionStore
import ua.blackout.prewarning.core.Subscriptions
import ua.blackout.prewarning.data.KYIV_ZONE
import ua.blackout.prewarning.data.model.BlackoutSlot
import ua.blackout.prewarning.data.model.SelectedAddressQuery
import ua.blackout.prewarning.data.model.SlotStatus
import ua.blackout.prewarning.data.model.UserSettings
import ua.blackout.prewarning.data.parser.FetchStatus
import ua.blackout.prewarning.data.parser.ZtoeAddressLookup
import ua.blackout.prewarning.data.parser.ZtoeParser
import ua.blackout.prewarning.data.poweron.PowerOnClient
import ua.blackout.prewarning.data.poweron.PowerOnTarget
import ua.blackout.prewarning.notification.NotificationHelper
import java.time.LocalDate
import java.time.LocalDateTime

private fun hhmm(minuteOfDay: Int): String =
    "${(minuteOfDay / 60).toString().padStart(2, '0')}:${(minuteOfDay % 60).toString().padStart(2, '0')}"

/** Everything the screens, widgets and alarms need, derived from local state only (no network). */
data class OutageSnapshot(
    val now: LocalDateTime,
    val queue: String,
    val outages: List<Outage>,
    /** Today's ztoe table is cached and still valid for today (or the address has no queue at all). */
    val plannedKnown: Boolean,
    val tomorrowPublished: Boolean,
    val site: SiteSnapshot?,
    val poweron: PowerOnSnapshot?,
    val hasAddress: Boolean
) {
    val today: LocalDate get() = now.toLocalDate()

    fun dayView(date: LocalDate): DayView = OutageEngine.dayView(outages, date, now)

    fun status(): StatusInfo = OutageEngine.status(outages, now)

    /** The planned schedule is unknown and nothing else is known either: screens go grey. */
    val isUnclear: Boolean
        get() = queue.isNotBlank() && !plannedKnown && outages.none { !it.stale && it.kind != OutageKind.PLANNED }

    /** True when the shown schedule comes from the cache because the site could not be refreshed. */
    val isStale: Boolean
        get() = plannedKnown && queue.isNotBlank() && site != null && site.state != SiteState.AVAILABLE_WITH_TABLE

    /** Legacy shape used by the existing main screen and widgets. */
    fun scheduleStatus(): ScheduleStatusInfo {
        if (isUnclear) {
            return ScheduleStatusInfo(
                isBlackoutNow = false,
                countdownText = "--:--:--",
                nextSlotTime = "--:-- - --:--",
                totalBlackoutHours = 0.0,
                isUnclear = true
            )
        }
        val st = status()
        return ScheduleStatusInfo(
            isBlackoutNow = st.isOffNow,
            countdownText = st.countdownText,
            nextSlotTime = st.nextSlotTime,
            totalBlackoutHours = dayView(today).totalOffMinutes / 60.0,
            isUnclear = false
        )
    }

    /** The 48 cells of [date] in the shape the drum chart and widgets draw. Empty when unclear. */
    fun slotsFor(date: LocalDate): List<BlackoutSlot> {
        if (isUnclear) return emptyList()
        val view = dayView(date)
        val dateStr = date.toString()
        return view.slots.mapIndexed { i, s ->
            val startMin = i * 30
            val endMin = startMin + 30
            val startStr = hhmm(startMin)
            val endStr = if (endMin >= 1440) "24:00" else hhmm(endMin)
            BlackoutSlot(
                id = "${dateStr}_${startStr}_Q$queue",
                startHour = startMin / 60,
                endHour = endMin / 60,
                startMinute = startMin % 60,
                endMinute = endMin % 60,
                startTimeStr = startStr,
                endTimeStr = endStr,
                status = if (s.off) SlotStatus.POWER_OFF else SlotStatus.POWER_ON,
                isEmergency = s.emergency,
                isPlanned = s.planned
            )
        }
    }

    /** The emergency outage to feature in the banner: active or overdue first, then the next upcoming one. */
    fun featuredEmergency(): Outage? {
        val live = outages.filter { it.kind == OutageKind.EMERGENCY && !it.stale }
        return live.firstOrNull { val st = it.statusAt(now); st == IntervalStatus.ACTIVE || st == IntervalStatus.OVERDUE }
            ?: live.filter { it.statusAt(now) == IntervalStatus.UPCOMING }.minByOrNull { it.start }
    }
}

data class RefreshOutcome(
    val siteState: SiteState?,
    val fetchStatus: FetchStatus?,
    val poweronOk: Boolean?,
    val events: List<EmergencyEvent>,
    val snapshot: OutageSnapshot
)

/**
 * One place that refreshes both sources and turns the stored state into a snapshot. The main
 * screen, the background worker, the widgets and the alarm scheduler all go through it, so they
 * can no longer disagree about what is off and when (spec/OUTAGE_ENGINE.md).
 */
class OutageRepository(context: Context) {
    private val appContext: Context = context.applicationContext
    private val schedule = ScheduleRepository(appContext)
    private val store = OutageStateStore(appContext)

    /** Stable key of the selected address; survives duplicate-street merges because it uses the canonical street key. */
    fun addressKey(query: SelectedAddressQuery?): String? {
        query ?: return null
        if (query.house.isBlank()) return null
        val streetName = try {
            ZtoeAddressLookup.findStreetById(query.streetId)?.nameUk
        } catch (_: Exception) {
            null
        } ?: query.streetId
        return "${query.settlementId}|${StreetKey.of(streetName)}|${HouseKey.of(query.house)}"
    }

    fun snapshot(
        settings: UserSettings,
        now: LocalDateTime = LocalDateTime.now(KYIV_ZONE),
        key: String? = addressKey(settings.selectedAddressQuery)
    ): OutageSnapshot = snapshotOf(settings.queue, key, now, store.poweron())

    /**
     * The snapshot of one non-primary subscription for the main screen (spec/SUBSCRIPTIONS.md 9).
     * The primary goes through [snapshot]; another item has its own PowerOn status under its address key.
     */
    fun snapshotFor(item: Subscription, now: LocalDateTime = LocalDateTime.now(KYIV_ZONE)): OutageSnapshot {
        val key = item.address?.key
        return snapshotOf(item.queue.orEmpty(), key, now, key?.let { store.poweron(it) })
    }

    private fun snapshotOf(q: String, key: String?, now: LocalDateTime, poweron: PowerOnSnapshot?): OutageSnapshot =
        OutageSnapshot(
            now = now,
            queue = q,
            outages = outagesFor(q, key, now),
            plannedKnown = q.isBlank() || schedule.hasValidTodayCache(q),
            tomorrowPublished = q.isNotBlank() && schedule.hasTomorrowSchedule(q),
            site = store.site(),
            poweron = poweron,
            hasAddress = key != null
        )

    /**
     * The outages of one queue and address key (either may be absent), local state only. One ztoe
     * fetch caches all 12 queues, so this works for every subscription (spec/SUBSCRIPTIONS.md 8.1).
     */
    fun outagesFor(queue: String?, key: String?, now: LocalDateTime = LocalDateTime.now(KYIV_ZONE)): List<Outage> {
        val today = now.toLocalDate()
        val q = queue.orEmpty()
        val planned = if (q.isNotBlank()) {
            OutageEngine.buildPlanned(today, schedule.todayOffCells(q), schedule.tomorrowOffCells(q), schedule.yesterdayOffCells(q))
        } else {
            emptyList()
        }
        val emergencies = if (key != null) EmergencyLedger.outages(store.ledger(key), now) else emptyList()
        val repairs = if (key != null) store.repairs(key) else emptyList()
        return OutageEngine.inWindow(planned + repairs + emergencies, today)
    }

    /**
     * Refreshes ztoe (planned) and PowerOn (emergency + repair works) for the selected address.
     * Runs on a worker thread. A source that fails keeps its previous data and is reported as such;
     * it never counts as "no outage". [shownId] is the item the main screen shows: it is polled whatever
     * its switches (spec/SUBSCRIPTIONS.md 8.4).
     */
    fun refresh(settings: UserSettings, forceNetwork: Boolean = false, notify: Boolean = true, shownId: String? = null): RefreshOutcome {
        val nowMs = System.currentTimeMillis()
        var siteState: SiteState? = null
        var fetchStatus: FetchStatus? = null
        val subs: Pair<SubscriptionStore, Boolean>? = try {
            val sync = SubscriptionSync(appContext)
            sync.store() to sync.master()
        } catch (_: Exception) {
            null
        }

        // One fetch caches all 12 queues. A primary without a queue still fetches for the other addresses.
        val ztoeQueue = settings.queue.ifBlank {
            subs?.first?.let { s -> Subscriptions.alertOrder(s).firstNotNullOfOrNull { it.queue } }.orEmpty()
        }
        if (ztoeQueue.isNotBlank()) {
            try {
                val res = ZtoeParser.fetchFullSchedule(settings.cityUrl, ztoeQueue, appContext, forceNetwork)
                store.saveSite(res.siteState, nowMs, res.notice)
                if (settings.queue.isNotBlank()) {
                    fetchStatus = res.status
                    siteState = res.siteState
                }
            } catch (_: Exception) {
            }
        }

        var poweronOk: Boolean? = null
        var events: List<EmergencyEvent> = emptyList()
        val query = settings.selectedAddressQuery
        val key = addressKey(query)
        if (query != null && key != null) {
            val polled = pollPowerOn(query, key, nowMs)
            poweronOk = polled?.first ?: false
            events = polled?.second.orEmpty()
            store.savePowerOn(poweronOk, nowMs)
            if (notify && events.isNotEmpty() && settings.emergencyNotificationsEnabled) {
                val primary = subs?.first?.primary
                NotificationHelper.postEmergencyEvents(
                    appContext, settings, key, events, subscriptionId = subs?.first?.primaryId,
                    plannedSpans = OutageEngine.plannedSpans(outagesFor(settings.queue, key)),
                    plannedAlertsOn = if (subs != null && primary != null) Subscriptions.plannedActive(subs.second, primary) else settings.notificationsEnabled
                )
            }
        }
        if (subs != null) refreshOtherAddresses(settings, subs.first, subs.second, key, nowMs, notify, shownId)
        return RefreshOutcome(siteState, fetchStatus, poweronOk, events, snapshot(settings))
    }

    /**
     * PowerOn for every other subscription that wants emergency alerts, plus the one the main screen
     * shows (spec/SUBSCRIPTIONS.md 8.4): own request, own failure, own ledger, own status line.
     */
    private fun refreshOtherAddresses(
        settings: UserSettings,
        subs: SubscriptionStore,
        master: Boolean,
        primaryKey: String?,
        nowMs: Long,
        notify: Boolean,
        shownId: String?
    ) {
        // Addresses on a widget are polled too, so the widget's emergency state is fresh (spec/SUBSCRIPTIONS.md 10)
        val onWidgets = try {
            WidgetBindings.shownItemIds(appContext, subs)
        } catch (_: Exception) {
            emptyList()
        }
        for (item in subs.items) {
            val a = item.address ?: continue
            if (item.id == subs.primaryId) continue
            val alerts = master && item.emergencyAlerts
            if (!alerts && item.id != shownId && item.id !in onWidgets) continue
            val key = a.key
            if (key == primaryKey) continue
            val polled = pollPowerOn(SelectedAddressQuery(a.remSlug, a.settlementId, a.streetId, a.house), key, nowMs)
            store.savePowerOn(key, polled?.first ?: false, nowMs)
            if (polled == null) continue
            if (notify && alerts && polled.second.isNotEmpty()) {
                NotificationHelper.postEmergencyEvents(
                    appContext, settings, key, polled.second, addressLine(item), enabled = true, subscriptionId = item.id,
                    plannedSpans = OutageEngine.plannedSpans(outagesFor(item.queue, key)),
                    plannedAlertsOn = Subscriptions.plannedActive(master, item)
                )
            }
        }
    }

    /** Second line of an emergency notification for [item] (spec/SUBSCRIPTIONS.md 8.4). */
    private fun addressLine(item: Subscription): String =
        item.address?.text?.takeIf { it.isNotBlank() } ?: Subscriptions.displayLabel(item)

    /** One PowerOn query: saves ids, ledger and repairs under [key]. Null when it failed or could not be built. */
    private fun pollPowerOn(query: SelectedAddressQuery, key: String, nowMs: Long): Pair<Boolean, List<EmergencyEvent>>? = try {
        ZtoeAddressLookup.initDiskCache(appContext)
        val target = buildTarget(query, key, nowMs)
        if (target == null) {
            null
        } else {
            val now = LocalDateTime.now(KYIV_ZONE)
            val result = PowerOnClient().fetch(target, now.toLocalDate(), now)
            result.ids?.let { if (it.cityIds.isNotEmpty() || it.streetIds.isNotEmpty()) store.saveIds(key, it, nowMs) }
            val ledger = EmergencyLedger.reconcile(store.ledger(key), result.emergency, now)
            store.saveLedger(key, ledger.entries)
            result.repairs?.let { store.saveRepairs(key, it) }
            (result.emergency is EmergencyFetch.Confirmed) to ledger.events
        }
    } catch (_: Exception) {
        null
    }

    private fun buildTarget(query: SelectedAddressQuery, key: String, nowMs: Long): PowerOnTarget? {
        val rem = ZtoeAddressLookup.getRems().firstOrNull { it.id == query.remId }
            ?: ZtoeAddressLookup.ZTOE_REM_OPTIONS.firstOrNull { it.id == query.remId }
        val settlement = ZtoeAddressLookup.findSettlementById(query.settlementId) ?: return null
        val street = ZtoeAddressLookup.findStreetById(query.streetId) ?: return null
        val streetKey = StreetKey.of(street.nameUk)
        val names = ZtoeAddressLookup.getStreetsForSettlement(settlement.id)
            .filter { StreetKey.of(it.nameUk) == streetKey }
            .map { it.nameUk }
            .ifEmpty { listOf(street.nameUk) }
        val cached = store.ids(key)?.takeIf { nowMs - it.second in 0 until PowerOnClient.IDS_TTL_MS }
        return PowerOnTarget(
            remOtgId = rem?.ztoeOtgId,
            settlementName = settlement.nameUk,
            streetNames = names,
            house = query.house,
            cachedCityIds = cached?.first?.cityIds.orEmpty(),
            cachedStreetIds = cached?.first?.streetIds.orEmpty()
        )
    }
}
