import Foundation

/// Kotlin `ScheduleStatusInfo`: the status shape the main screen and the widgets print.
public struct ScheduleStatusInfo: Hashable, Sendable {
    public var isBlackoutNow: Bool
    public var countdownText: String
    public var nextSlotTime: String
    public var totalBlackoutHours: Double
    public var isUnclear: Bool
}

/// Everything the screens, widgets and alerts need, derived from local state only (no network).
/// Mirror of android `OutageSnapshot`.
public struct OutageSnapshot: Sendable {
    public var now: LocalDateTime
    public var queue: String
    public var outages: [Outage]
    /// Today's ztoe table is cached and still valid for today (or the address has no queue at all).
    public var plannedKnown: Bool
    public var tomorrowPublished: Bool
    public var site: SiteSnapshot?
    public var poweron: PowerOnSnapshot?
    public var hasAddress: Bool

    public var today: LocalDate { now.date }

    public func dayView(_ date: LocalDate) -> DayView { OutageEngine.dayView(outages, date: date, now: now) }

    public func status() -> StatusInfo { OutageEngine.status(outages, now: now) }

    /// The planned schedule is unknown and nothing else is known either: screens go grey.
    public var isUnclear: Bool {
        !queue.ktIsBlank && !plannedKnown && !outages.contains { !$0.stale && $0.kind != .PLANNED }
    }

    /// True when the shown schedule comes from the cache because the site could not be refreshed.
    public var isStale: Bool {
        guard plannedKnown, !queue.ktIsBlank, let site else { return false }
        return site.state != .AVAILABLE_WITH_TABLE
    }

    public func scheduleStatus() -> ScheduleStatusInfo {
        if isUnclear {
            return ScheduleStatusInfo(isBlackoutNow: false, countdownText: "--:--:--", nextSlotTime: "--:-- - --:--",
                                      totalBlackoutHours: 0, isUnclear: true)
        }
        let st = status()
        return ScheduleStatusInfo(isBlackoutNow: st.isOffNow, countdownText: st.countdownText, nextSlotTime: st.nextSlotTime,
                                  totalBlackoutHours: Double(dayView(today).totalOffMinutes) / 60.0, isUnclear: false)
    }

    private static func hhmm(_ minuteOfDay: Int) -> String { String(format: "%02d:%02d", minuteOfDay / 60, minuteOfDay % 60) }

    /// The 48 cells of `date` in the shape the drum chart and widgets draw. Empty when unclear.
    public func slotsFor(_ date: LocalDate) -> [BlackoutSlot] {
        if isUnclear { return [] }
        return dayView(date).slots.enumerated().map { i, s in
            let startMin = i * 30
            let endMin = startMin + 30
            let startStr = Self.hhmm(startMin)
            let endStr = endMin >= 1440 ? "24:00" : Self.hhmm(endMin)
            return BlackoutSlot(
                id: "\(date)_\(startStr)_Q\(queue)", startHour: startMin / 60, endHour: endMin / 60,
                startMinute: startMin % 60, endMinute: endMin % 60, startTimeStr: startStr, endTimeStr: endStr,
                status: s.off ? .POWER_OFF : .POWER_ON, isEmergency: s.emergency, isPlanned: s.planned
            )
        }
    }

    /// The emergency outage to feature in the banner: active or overdue first, then the next upcoming one.
    public func featuredEmergency() -> Outage? {
        let live = outages.filter { $0.kind == .EMERGENCY && !$0.stale }
        if let current = live.first(where: { let st = $0.statusAt(now); return st == .ACTIVE || st == .OVERDUE }) {
            return current
        }
        var best: Outage?
        for o in live where o.statusAt(now) == .UPCOMING && (best == nil || o.start < best!.start) { best = o }
        return best
    }
}

/// Emergency events of one address from one refresh, with what the announcer needs to decide how to
/// post them (spec/NOTIFICATIONS.md 2.4a). Android posts these inside the repository; on iOS the
/// notification layer posts them, so the decision inputs travel with the events.
public struct EmergencyBatch: Sendable {
    public var addressKey: String
    /// nil for the primary address (1.4.0 single-address keys).
    public var subscriptionId: String?
    /// Second line of the notification for a non-primary address (nil for the primary).
    public var addressLine: String?
    public var events: [EmergencyEvent]
    public var plannedSpans: [Span]
    public var plannedAlertsOn: Bool
    /// The address wants emergency alerts (primary: `emergencyNotificationsEnabled`; others: master and switch).
    public var alertsOn: Bool
}

public struct RefreshOutcome: Sendable {
    public var siteState: SiteState?
    public var fetchStatus: FetchStatus?
    public var poweronOk: Bool?
    /// Events of the primary address (Kotlin `RefreshOutcome.events`).
    public var events: [EmergencyEvent]
    /// Every address with new events, primary first, for the notification layer.
    public var batches: [EmergencyBatch]
    public var snapshot: OutageSnapshot
}

/// One place that refreshes both sources and turns the stored state into a snapshot (mirror of
/// android OutageRepository.kt). The main screen, background refresh, widgets and alerts all go through
/// it, so they cannot disagree about what is off and when (spec/OUTAGE_ENGINE.md).
public final class OutageRepository {
    public static let shared = OutageRepository()

    private let schedule: ScheduleRepository
    private let store: OutageStateStore
    private let settingsRepo: SettingsRepository
    private let subscriptions: SubscriptionSync
    private let poweronClient: PowerOnClient

    public init(
        schedule: ScheduleRepository = .shared,
        store: OutageStateStore = .shared,
        settingsRepo: SettingsRepository = .shared,
        subscriptions: SubscriptionSync = .shared,
        poweronClient: PowerOnClient = PowerOnClient()
    ) {
        self.schedule = schedule
        self.store = store
        self.settingsRepo = settingsRepo
        self.subscriptions = subscriptions
        self.poweronClient = poweronClient
    }

    private static func kyivNow() -> LocalDateTime { KyivTime.localDateTime(of: Date()) }
    private static func epochMs() -> Int64 { Int64(Date().timeIntervalSince1970 * 1000) }

    /// Stable key of the selected address; survives duplicate-street merges because it uses the canonical street key.
    public func addressKey(_ query: SelectedAddressQuery?) -> String? {
        guard let query, !query.house.ktIsBlank else { return nil }
        let streetName = ZtoeAddressLookup.findStreetById(query.streetId)?.nameUk ?? query.streetId
        return "\(query.settlementId)|\(StreetKey.of(streetName))|\(HouseKey.of(query.house))"
    }

    public func snapshot(_ settings: UserSettings, now: LocalDateTime? = nil) -> OutageSnapshot {
        let key = addressKey(settings.selectedAddressQuery)
        return snapshotOf(settings.queue, key, now ?? Self.kyivNow(), store.poweron())
    }

    /// The snapshot of one non-primary subscription for the main screen (spec/SUBSCRIPTIONS.md 9).
    public func snapshotFor(_ item: Subscription, now: LocalDateTime? = nil) -> OutageSnapshot {
        let key = item.address?.key
        return snapshotOf(item.queue ?? "", key, now ?? Self.kyivNow(), key.flatMap { store.poweron($0) })
    }

    private func snapshotOf(_ q: String, _ key: String?, _ now: LocalDateTime, _ poweron: PowerOnSnapshot?) -> OutageSnapshot {
        OutageSnapshot(
            now: now,
            queue: q,
            outages: outagesFor(queue: q, key: key, now: now),
            plannedKnown: q.ktIsBlank || schedule.hasValidTodayCache(q),
            tomorrowPublished: !q.ktIsBlank && schedule.hasTomorrowSchedule(q),
            site: store.site(),
            poweron: poweron,
            hasAddress: key != nil
        )
    }

    /// The outages of one queue and address key (either may be absent), local state only. One ztoe
    /// fetch caches all 12 queues, so this works for every subscription (spec/SUBSCRIPTIONS.md 8.1).
    public func outagesFor(queue: String?, key: String?, now: LocalDateTime? = nil) -> [Outage] {
        let at = now ?? Self.kyivNow()
        let today = at.date
        let q = queue ?? ""
        let planned = q.ktIsBlank ? [] : OutageEngine.buildPlanned(
            today: today, todayOff: schedule.todayOffCells(q), tomorrowOff: schedule.tomorrowOffCells(q),
            yesterdayOff: schedule.yesterdayOffCells(q)
        )
        let emergencies = key.map { EmergencyLedger.outages(store.ledger($0), now: at) } ?? []
        let repairs = key.map { store.repairs($0) } ?? []
        return OutageEngine.inWindow(planned + repairs + emergencies, today: today)
    }

    /// Refreshes ztoe (planned) and PowerOn (emergency + repair works) for every address that needs it.
    /// A source that fails keeps its previous data and is reported as such; it never counts as "no outage".
    /// `shownId` is the item the main screen shows and `widgetItemIds` the items placed widgets show: both
    /// are polled whatever their switches (spec/SUBSCRIPTIONS.md 8.4 and 10).
    public func refresh(
        _ settings: UserSettings,
        forceNetwork: Bool = false,
        shownId: String? = nil,
        widgetItemIds: [String] = []
    ) async -> RefreshOutcome {
        let nowMs = Self.epochMs()
        var siteState: SiteState?
        var fetchStatus: FetchStatus?
        let subs = subscriptions.store()
        let master = subscriptions.master()

        // One fetch caches all 12 queues. A primary without a queue still fetches for the other addresses.
        let ztoeQueue = settings.queue.ktIsBlank
            ? (Subscriptions.alertOrder(subs).compactMap(\.queue).first ?? "")
            : settings.queue
        if !ztoeQueue.ktIsBlank {
            let res = await ZtoeParser.fetchFullSchedule(url: settings.cityUrl, queue: ztoeQueue, forceNetwork: forceNetwork,
                                                         repo: schedule)
            store.saveSite(res.siteState, nowMs: nowMs, notice: res.notice)
            if !settings.queue.ktIsBlank {
                fetchStatus = res.status
                siteState = res.siteState
            }
        }

        var poweronOk: Bool?
        var events: [EmergencyEvent] = []
        var batches: [EmergencyBatch] = []
        let query = settings.selectedAddressQuery
        let key = addressKey(query)
        if let query, let key {
            let polled = await pollPowerOn(query, key: key, nowMs: nowMs)
            poweronOk = polled?.ok ?? false
            events = polled?.events ?? []
            store.savePowerOn(ok: poweronOk ?? false, nowMs: nowMs)
            if !events.isEmpty {
                let primary = subs.primary
                batches.append(EmergencyBatch(
                    addressKey: key,
                    subscriptionId: subs.primaryId,
                    addressLine: nil,
                    events: events,
                    plannedSpans: OutageEngine.plannedSpans(outagesFor(queue: settings.queue, key: key)),
                    plannedAlertsOn: primary.map { Subscriptions.plannedActive(master: master, item: $0) } ?? settings.notificationsEnabled,
                    alertsOn: settings.emergencyNotificationsEnabled
                ))
            }
        }
        batches += await refreshOtherAddresses(subs, master: master, primaryKey: key, nowMs: nowMs,
                                               shownId: shownId, widgetItemIds: widgetItemIds)
        return RefreshOutcome(siteState: siteState, fetchStatus: fetchStatus, poweronOk: poweronOk, events: events,
                              batches: batches, snapshot: snapshot(settings))
    }

    /// PowerOn for every other subscription that wants emergency alerts, plus the one the main screen
    /// shows and the ones on widgets (spec/SUBSCRIPTIONS.md 8.4): own request, failure, ledger, status line.
    private func refreshOtherAddresses(
        _ subs: SubscriptionStore, master: Bool, primaryKey: String?, nowMs: Int64,
        shownId: String?, widgetItemIds: [String]
    ) async -> [EmergencyBatch] {
        var out: [EmergencyBatch] = []
        for item in subs.items {
            guard let a = item.address, item.id != subs.primaryId else { continue }
            let alerts = master && item.emergencyAlerts
            if !alerts && item.id != shownId && !widgetItemIds.contains(item.id) { continue }
            let key = a.key
            if key == primaryKey { continue }
            let query = SelectedAddressQuery(remId: a.remSlug, settlementId: a.settlementId, streetId: a.streetId, house: a.house)
            let polled = await pollPowerOn(query, key: key, nowMs: nowMs)
            store.savePowerOn(key, ok: polled?.ok ?? false, nowMs: nowMs)
            guard let polled, !polled.events.isEmpty else { continue }
            out.append(EmergencyBatch(
                addressKey: key,
                subscriptionId: item.id,
                addressLine: a.text.ktIsBlank ? Subscriptions.displayLabel(item) : a.text,
                events: polled.events,
                plannedSpans: OutageEngine.plannedSpans(outagesFor(queue: item.queue, key: key)),
                plannedAlertsOn: Subscriptions.plannedActive(master: master, item: item),
                alertsOn: alerts
            ))
        }
        return out
    }

    /// One PowerOn query: saves ids, ledger and repairs under `key`. nil when it could not be built.
    private func pollPowerOn(_ query: SelectedAddressQuery, key: String, nowMs: Int64) async -> (ok: Bool, events: [EmergencyEvent])? {
        ZtoeAddressLookup.initDiskCache()
        guard let target = buildTarget(query, key: key, nowMs: nowMs) else { return nil }
        let now = Self.kyivNow()
        let result = await poweronClient.fetch(target, today: now.date, now: now)
        if let ids = result.ids, !ids.cityIds.isEmpty || !ids.streetIds.isEmpty { store.saveIds(key, ids, nowMs: nowMs) }
        let ledger = EmergencyLedger.reconcile(store.ledger(key), fetch: result.emergency, now: now)
        store.saveLedger(key, ledger.entries)
        if let repairs = result.repairs { store.saveRepairs(key, repairs) }
        if case .confirmed = result.emergency { return (true, ledger.events) }
        return (false, ledger.events)
    }

    private func buildTarget(_ query: SelectedAddressQuery, key: String, nowMs: Int64) -> PowerOnTarget? {
        let rem = ZtoeAddressLookup.getRems().first { $0.id == query.remId }
            ?? ZtoeAddressLookup.ZTOE_REM_OPTIONS.first { $0.id == query.remId }
        guard let settlement = ZtoeAddressLookup.findSettlementById(query.settlementId),
              let street = ZtoeAddressLookup.findStreetById(query.streetId) else { return nil }
        let streetKey = StreetKey.of(street.nameUk)
        var names = ZtoeAddressLookup.getStreetsForSettlement(settlement.id)
            .filter { StreetKey.of($0.nameUk) == streetKey }
            .map(\.nameUk)
        if names.isEmpty { names = [street.nameUk] }
        let cached = store.ids(key).flatMap { c in (0..<PowerOnClient.IDS_TTL_MS).contains(nowMs - c.resolvedAtMs) ? c.ids : nil }
        return PowerOnTarget(
            remOtgId: rem?.ztoeOtgId,
            settlementName: settlement.nameUk,
            streetNames: names,
            house: query.house,
            cachedCityIds: cached?.cityIds ?? [],
            cachedStreetIds: cached?.streetIds ?? []
        )
    }
}
