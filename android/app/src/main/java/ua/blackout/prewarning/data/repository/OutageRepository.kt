package ua.blackout.prewarning.data.repository

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
    ): OutageSnapshot {
        val today = now.toLocalDate()
        val q = settings.queue

        val planned = if (q.isNotBlank()) {
            OutageEngine.buildPlanned(today, schedule.todayOffCells(q), schedule.tomorrowOffCells(q), schedule.yesterdayOffCells(q))
        } else {
            emptyList()
        }
        val emergencies = if (key != null) EmergencyLedger.outages(store.ledger(key), now) else emptyList()
        val repairs = if (key != null) store.repairs(key) else emptyList()

        return OutageSnapshot(
            now = now,
            queue = q,
            outages = OutageEngine.inWindow(planned + repairs + emergencies, today),
            plannedKnown = q.isBlank() || schedule.hasValidTodayCache(q),
            tomorrowPublished = q.isNotBlank() && schedule.hasTomorrowSchedule(q),
            site = store.site(),
            poweron = store.poweron(),
            hasAddress = key != null
        )
    }

    /**
     * Refreshes ztoe (planned) and PowerOn (emergency + repair works) for the selected address.
     * Runs on a worker thread. A source that fails keeps its previous data and is reported as such;
     * it never counts as "no outage".
     */
    fun refresh(settings: UserSettings, forceNetwork: Boolean = false, notify: Boolean = true): RefreshOutcome {
        val nowMs = System.currentTimeMillis()
        var siteState: SiteState? = null
        var fetchStatus: FetchStatus? = null

        if (settings.queue.isNotBlank()) {
            try {
                val res = ZtoeParser.fetchFullSchedule(settings.cityUrl, settings.queue, appContext, forceNetwork)
                fetchStatus = res.status
                siteState = res.siteState
                store.saveSite(res.siteState, nowMs, res.notice)
            } catch (_: Exception) {
            }
        }

        var poweronOk: Boolean? = null
        var events: List<EmergencyEvent> = emptyList()
        val query = settings.selectedAddressQuery
        val key = addressKey(query)
        if (query != null && key != null) {
            try {
                ZtoeAddressLookup.initDiskCache(appContext)
                val target = buildTarget(query, key, nowMs)
                if (target != null) {
                    val now = LocalDateTime.now(KYIV_ZONE)
                    val result = PowerOnClient().fetch(target, now.toLocalDate(), now)
                    result.ids?.let { if (it.cityIds.isNotEmpty() || it.streetIds.isNotEmpty()) store.saveIds(key, it, nowMs) }

                    val ledger = EmergencyLedger.reconcile(store.ledger(key), result.emergency, now)
                    store.saveLedger(key, ledger.entries)
                    events = ledger.events
                    result.repairs?.let { store.saveRepairs(key, it) }

                    poweronOk = result.emergency is EmergencyFetch.Confirmed
                    store.savePowerOn(poweronOk, nowMs)
                    if (notify && events.isNotEmpty() && settings.emergencyNotificationsEnabled) {
                        NotificationHelper.postEmergencyEvents(appContext, settings, key, events)
                    }
                } else {
                    store.savePowerOn(false, nowMs)
                    poweronOk = false
                }
            } catch (_: Exception) {
                store.savePowerOn(false, nowMs)
                poweronOk = false
            }
        }
        return RefreshOutcome(siteState, fetchStatus, poweronOk, events, snapshot(settings))
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
