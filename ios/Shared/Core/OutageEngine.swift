import Foundation

/// The single source of truth for "what is off when", mirror of android core/OutageEngine.kt.
/// Pure functions over a two-day window (yesterday tail, today, tomorrow) of absolute Kyiv
/// wall-clock instants, so an outage that crosses midnight is one block with its real length
/// everywhere: list, drum, countdown, alerts. Rules: spec/OUTAGE_ENGINE.md, cases: spec/vectors/.
public enum OutageEngine {

    // MARK: - Building outages

    /// Accepts 48 half-hour cells or 24 hourly cells and returns 48, or nil for anything else.
    public static func normalizeSlots(_ raw: [Bool]?) -> [Bool]? {
        guard let raw else { return nil }
        switch raw.count {
        case 48: return raw
        case 24: return raw.flatMap { [$0, $0] }
        default: return nil
        }
    }

    /// Turns the ztoe day tables (true = power off) into planned outages. Contiguous off-cells are one
    /// outage even across midnight when both days are known. A block that touches the end of the last
    /// known day, whose next day is unknown, is flagged `mayContinue`.
    public static func buildPlanned(
        today: LocalDate,
        todayOff: [Bool]?,
        tomorrowOff: [Bool]?,
        yesterdayOff: [Bool]? = nil
    ) -> [Outage] {
        let days: [(LocalDate, [Bool])] = [
            (today.minusDays(1), normalizeSlots(yesterdayOff)),
            (today, normalizeSlots(todayOff)),
            (today.plusDays(1), normalizeSlots(tomorrowOff))
        ].compactMap { d, s in s.map { (d, $0) } }
        if days.isEmpty { return [] }

        let knownDates = Set(days.map { $0.0 })
        var out: [Outage] = []
        var runStart: LocalDateTime?

        func close(_ end: LocalDateTime, mayContinue: Bool) {
            guard let s = runStart else { return }
            out.append(Outage(id: "planned_\(s)", kind: .PLANNED, start: s, end: end, mayContinue: mayContinue))
            runStart = nil
        }

        for (day, slots) in days {
            let dayStart = day.atStartOfDay()
            for i in 0..<OutageConfig.SLOTS_PER_DAY {
                let slotStart = dayStart.plusMinutes(i * OutageConfig.SLOT_MINUTES)
                if slots[i] {
                    if runStart == nil { runStart = slotStart }
                } else {
                    close(slotStart, mayContinue: false)
                }
            }
            if runStart != nil && !knownDates.contains(day.plusDays(1)) {
                close(day.plusDays(1).atStartOfDay(), mayContinue: true)
            }
        }
        return out
    }

    /// Resolves one emergency record against `now`. A listed outage past its estimated restore is
    /// OVERDUE (still active) for `graceMinutes`, then STALE (finished, never alerts).
    public static func resolveEmergency(
        _ rec: EmergencyRecord,
        now: LocalDateTime,
        graceMinutes: Int = OutageConfig.OVERDUE_GRACE_MINUTES
    ) -> Outage {
        var end: LocalDateTime
        var overdue = false
        var stale = false
        var isEstimate = false
        if let closed = rec.closedAt {
            end = closed.isAfter(rec.start) ? closed : rec.start
        } else if let est = rec.estimatedEnd {
            if now.isBefore(est) {
                end = est
                isEstimate = true
            } else {
                let overdueMinutes = est.localMinutes(until: now)
                isEstimate = true
                if overdueMinutes <= graceMinutes {
                    end = now.isAfter(est) ? now : est
                    overdue = true
                } else {
                    end = est
                    stale = true
                }
            }
        } else {
            end = now.isAfter(rec.start) ? now : rec.start
            overdue = !now.isBefore(rec.start)
            isEstimate = true
        }
        if end.isBefore(rec.start) { end = rec.start }
        return Outage(
            id: rec.id, kind: .EMERGENCY, start: rec.start, end: end,
            endIsEstimate: isEstimate, overdue: overdue, stale: stale, label: rec.label
        )
    }

    /// Keeps only outages that touch [yesterday 00:00, tomorrow+1 00:00). Rows dated further ahead are ignored.
    public static func inWindow(_ outages: [Outage], today: LocalDate) -> [Outage] {
        let from = today.minusDays(1).atStartOfDay()
        let to = today.plusDays(2).atStartOfDay()
        return outages.filter { $0.start.isBefore(to) && $0.end.isAfter(from) }
    }

    // MARK: - Spans, day views, status

    /// Union of the outages of `kinds` (all kinds when nil); touching or overlapping outages merge.
    public static func spans(_ outages: [Outage], kinds: Set<OutageKind>? = nil) -> [Span] {
        let items = outages
            .filter { (kinds == nil || kinds!.contains($0.kind)) && $0.end.isAfter($0.start) }
            .stableSorted { $0.start < $1.start }
        var result: [Span] = []
        var cur: Span?
        for o in items {
            guard var c = cur else {
                cur = Span(start: o.start, end: o.end, mayContinue: o.mayContinue, kinds: [o.kind])
                continue
            }
            if !o.start.isAfter(c.end) {
                if o.end.isAfter(c.end) {
                    c.end = o.end
                    c.mayContinue = o.mayContinue
                } else if o.end == c.end {
                    c.mayContinue = c.mayContinue || o.mayContinue
                }
                c.kinds.insert(o.kind)
                cur = c
            } else {
                result.append(c)
                cur = Span(start: o.start, end: o.end, mayContinue: o.mayContinue, kinds: [o.kind])
            }
        }
        if let c = cur { result.append(c) }
        return result
    }

    public static func minutesBetween(_ a: LocalDateTime, _ b: LocalDateTime, zone: TimeZone = KyivTime.zone) -> Int {
        KyivTime.minutesBetween(a, b, zone: zone)
    }

    public static func secondsBetween(_ a: LocalDateTime, _ b: LocalDateTime, zone: TimeZone = KyivTime.zone) -> Int {
        KyivTime.secondsBetween(a, b, zone: zone)
    }

    private static func later(_ a: LocalDateTime, _ b: LocalDateTime) -> LocalDateTime { a.isAfter(b) ? a : b }
    private static func earlier(_ a: LocalDateTime, _ b: LocalDateTime) -> LocalDateTime { a.isBefore(b) ? a : b }

    /// The drum cells and list rows for one calendar day. Finished outages stay (history); they just never alert.
    public static func dayView(
        _ outages: [Outage],
        date: LocalDate,
        now: LocalDateTime,
        zone: TimeZone = KyivTime.zone
    ) -> DayView {
        let dayStart = date.atStartOfDay()
        let dayEnd = date.plusDays(1).atStartOfDay()
        let relevant = outages.filter { $0.end.isAfter($0.start) && $0.start.isBefore(dayEnd) && $0.end.isAfter(dayStart) }

        let slots: [SlotState] = (0..<OutageConfig.SLOTS_PER_DAY).map { i in
            let s = dayStart.plusMinutes(i * OutageConfig.SLOT_MINUTES)
            let e = s.plusMinutes(OutageConfig.SLOT_MINUTES)
            return SlotState(
                planned: relevant.contains { $0.isPlannedLike && $0.start.isBefore(e) && $0.end.isAfter(s) },
                emergency: relevant.contains { $0.kind == .EMERGENCY && $0.start.isBefore(e) && $0.end.isAfter(s) }
            )
        }

        let rows = relevant
            .map { o -> DayRow in
                let from = later(o.start, dayStart)
                let to = earlier(o.end, dayEnd)
                return DayRow(
                    outage: o,
                    from: from,
                    to: to,
                    status: o.statusAt(now),
                    continuesFromPrevDay: o.start.isBefore(dayStart),
                    continuesToNextDay: o.end.isAfter(dayEnd),
                    durationMinutes: minutesBetween(o.start, o.end, zone: zone),
                    inDayMinutes: minutesBetween(from, to, zone: zone)
                )
            }
            .stableSorted { a, b in
                if a.from != b.from { return a.from < b.from }
                return a.outage.kind.ordinal < b.outage.kind.ordinal
            }

        let clipped = relevant.map { o -> Outage in
            var c = o
            c.start = later(o.start, dayStart)
            c.end = earlier(o.end, dayEnd)
            return c
        }
        let total = spans(clipped).reduce(0) { $0 + minutesBetween($1.start, $1.end, zone: zone) }
        return DayView(date: date, slots: slots, rows: rows, totalOffMinutes: total)
    }

    private static func p2(_ n: Int) -> String { n < 10 ? "0\(n)" : "\(n)" }

    /// "HH:mm" (ASCII digits whatever the device locale); an end of exactly 00:00 reads "24:00".
    public static func formatSpanTime(_ t: LocalDateTime) -> String {
        t.isMidnight ? "24:00" : "\(p2(t.hour)):\(p2(t.minute))"
    }

    public static func formatSpan(_ span: Span) -> String {
        "\(p2(span.start.hour)):\(p2(span.start.minute)) – \(formatSpanTime(span.end))"
    }

    public static func formatCountdown(_ totalSeconds: Int) -> String {
        let s = max(totalSeconds, 0)
        return "\(p2(s / 3600)):\(p2((s % 3600) / 60)):\(p2(s % 60))"
    }

    /// Power state, countdown and next/current period from `now`. Stale emergencies never count as off.
    public static func status(_ outages: [Outage], now: LocalDateTime, zone: TimeZone = KyivTime.zone) -> StatusInfo {
        // An overdue emergency has no known end: treat it as lasting just past now so it is "current".
        let openEnd = now.plusSeconds(1)
        let effective = outages
            .filter { !$0.stale }
            .map { o -> Outage in
                guard o.overdue else { return o }
                var c = o
                c.end = openEnd
                return c
            }
        let all = spans(effective)
        if let current = all.first(where: { !now.isBefore($0.start) && now.isBefore($0.end) }) {
            if current.end == openEnd && effective.contains(where: { $0.overdue }) {
                var cut = current
                cut.end = now
                return StatusInfo(
                    isOffNow: true,
                    countdownSeconds: nil,
                    countdownText: "--:--:--",
                    nextSlotTime: "\(p2(current.start.hour)):\(p2(current.start.minute)) – --:--",
                    currentSpan: cut,
                    nextSpan: nil
                )
            }
            let secs = secondsBetween(now, current.end, zone: zone)
            return StatusInfo(isOffNow: true, countdownSeconds: secs, countdownText: formatCountdown(secs),
                              nextSlotTime: formatSpan(current), currentSpan: current, nextSpan: nil)
        }
        if let next = all.first(where: { $0.start.isAfter(now) }) {
            let secs = secondsBetween(now, next.start, zone: zone)
            return StatusInfo(isOffNow: false, countdownSeconds: secs, countdownText: formatCountdown(secs),
                              nextSlotTime: formatSpan(next), currentSpan: nil, nextSpan: next)
        }
        return StatusInfo(isOffNow: false, countdownSeconds: nil, countdownText: "--:--:--",
                          nextSlotTime: "Відключень немає", currentSpan: nil, nextSpan: nil)
    }

    // MARK: - Alerts and widget transitions

    /// One pre-warning per merged planned span (planned and repair works only), keyed by the span's
    /// absolute start. Spans already started, or whose alert time has passed, never alert; a 00:00
    /// continuation never gets its own alert because it is part of the earlier span.
    public static func planAlerts(
        _ outages: [Outage],
        now: LocalDateTime,
        advanceMinutes: Int,
        zone: TimeZone = KyivTime.zone
    ) -> [AlertSpec] {
        let plannedSpans = spans(outages.filter { !$0.stale }, kinds: [.PLANNED, .REPAIR])
        let emergencies = outages.filter { $0.kind == .EMERGENCY && !$0.stale }
        return plannedSpans.compactMap { sp -> AlertSpec? in
            if !sp.start.isAfter(now) { return nil }
            // One continuous outage, one warning (spec/OUTAGE_ENGINE.md 6.2 step 2a): an emergency that
            // started before the block and is still on at its start means power is already off
            if emergencies.contains(where: { $0.start.isBefore(sp.start) && ($0.overdue || !$0.end.isBefore(sp.start)) }) {
                return nil
            }
            let fireAt = sp.start.minusMinutes(advanceMinutes)
            if !fireAt.isAfter(now) { return nil }
            return AlertSpec(
                key: "planned_\(sp.start)",
                fireAt: fireAt,
                spanStart: sp.start,
                spanEnd: sp.end,
                mayContinue: sp.mayContinue,
                durationMinutes: minutesBetween(sp.start, sp.end, zone: zone)
            )
        }
    }

    /// The planned and repair spans of an address (not stale): what its pre-warnings are about.
    public static func plannedSpans(_ outages: [Outage]) -> [Span] {
        spans(outages.filter { !$0.stale }, kinds: [.PLANNED, .REPAIR])
    }

    /// Whether an emergency event is announced when emergency and scheduled outages of one address form
    /// one continuous outage (spec/NOTIFICATIONS.md 2.4a).
    public static func emergencyDelivery(
        kind: EmergencyEventKind,
        start: LocalDateTime,
        eta: LocalDateTime?,
        now: LocalDateTime,
        plannedSpans: [Span],
        plannedAlertsOn: Bool
    ) -> EmergencyDelivery {
        switch kind {
        case .ETA_CHANGED:
            return .SEND
        case .END:
            return plannedSpans.contains(where: { !$0.start.isAfter(now) && now.isBefore($0.end) }) ? .DROP : .SEND
        case .START:
            let holder = plannedAlertsOn
                ? plannedSpans.first(where: { !$0.start.isAfter(start) && !start.isAfter($0.end) })
                : nil
            guard let holder else { return .SEND }
            if let eta, eta.isAfter(holder.end) { return .PROLONG }
            return .DROP
        }
    }

    /// Instants where the power state flips (all kinds, stale excluded), inclusive of `from` and `to`.
    public static func transitions(_ outages: [Outage], from: LocalDateTime, to: LocalDateTime) -> [Transition] {
        spans(outages.filter { !$0.stale && !$0.overdue })
            .flatMap { [Transition(at: $0.start, isOff: true), Transition(at: $0.end, isOff: false)] }
            .filter { !$0.at.isBefore(from) && !$0.at.isAfter(to) }
            .stableSorted { $0.at < $1.at }
    }
}

/// How one emergency event is announced within a continuous outage (spec/NOTIFICATIONS.md 2.4a).
public enum EmergencyDelivery: String, Sendable { case SEND, PROLONG, DROP }
