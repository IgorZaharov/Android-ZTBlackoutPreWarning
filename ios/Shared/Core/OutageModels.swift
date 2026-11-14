import Foundation

// Platform-neutral outage model, mirror of android core/OutageModels.kt.
// All instants are Kyiv wall-clock LocalDateTime values; durations are elapsed time in Kyiv.

public enum OutageConfig {
    public static let SLOTS_PER_DAY = 48
    public static let SLOT_MINUTES = 30
    /// An emergency still listed by PowerOn this long after its estimated restore is "overdue" (still active).
    public static let OVERDUE_GRACE_MINUTES = 60
    /// Ledger entries older than this (since last sighting or close) are dropped.
    public static let LEDGER_RETENTION_HOURS = 48
    /// A changed restore estimate notifies only when it moved by at least this much.
    public static let ETA_CHANGE_MIN_DELTA_MINUTES = 10
}

/// What produced an outage. REPAIR (PowerOn planned works) is treated like PLANNED for alerts.
public enum OutageKind: String, CaseIterable, Hashable, Sendable {
    case PLANNED, REPAIR, EMERGENCY

    /// Kotlin `ordinal`, used as a sort tie-breaker.
    public var ordinal: Int {
        switch self {
        case .PLANNED: return 0
        case .REPAIR: return 1
        case .EMERGENCY: return 2
        }
    }
}

public enum IntervalStatus: String, Sendable { case FINISHED, ACTIVE, UPCOMING, OVERDUE }

public struct Outage: Hashable, Sendable {
    public var id: String
    public var kind: OutageKind
    public var start: LocalDateTime
    /// Effective end. For a listed emergency past its estimate this is "now" while within the grace.
    public var end: LocalDateTime
    /// The block touches the end of the known schedule window, so the real end may be later.
    public var mayContinue: Bool
    public var endIsEstimate: Bool
    /// Emergency still listed after its estimated restore, within the grace: treated as active.
    public var overdue: Bool
    /// Emergency still listed but beyond the grace: shown as finished, never alerts.
    public var stale: Bool
    public var label: String?

    public init(
        id: String, kind: OutageKind, start: LocalDateTime, end: LocalDateTime,
        mayContinue: Bool = false, endIsEstimate: Bool = false, overdue: Bool = false, stale: Bool = false,
        label: String? = nil
    ) {
        self.id = id
        self.kind = kind
        self.start = start
        self.end = end
        self.mayContinue = mayContinue
        self.endIsEstimate = endIsEstimate
        self.overdue = overdue
        self.stale = stale
        self.label = label
    }

    public var isPlannedLike: Bool { kind == .PLANNED || kind == .REPAIR }

    public func statusAt(_ now: LocalDateTime) -> IntervalStatus {
        if stale { return .FINISHED }
        if now.isBefore(start) { return .UPCOMING }
        if overdue { return .OVERDUE }
        if now.isBefore(end) { return .ACTIVE }
        return .FINISHED
    }
}

/// One emergency outage as observed from PowerOn (or restored from the ledger).
public struct EmergencyRecord: Hashable, Sendable {
    public var id: String
    public var start: LocalDateTime
    public var estimatedEnd: LocalDateTime?
    /// Set by the ledger when a confirmed fetch no longer lists the outage.
    public var closedAt: LocalDateTime?
    public var label: String?

    public init(id: String, start: LocalDateTime, estimatedEnd: LocalDateTime?, closedAt: LocalDateTime? = nil, label: String? = nil) {
        self.id = id
        self.start = start
        self.estimatedEnd = estimatedEnd
        self.closedAt = closedAt
        self.label = label
    }
}

/// A maximal union of outages that touch or overlap.
public struct Span: Hashable, Sendable {
    public var start: LocalDateTime
    public var end: LocalDateTime
    public var mayContinue: Bool
    public var kinds: Set<OutageKind>

    public init(start: LocalDateTime, end: LocalDateTime, mayContinue: Bool, kinds: Set<OutageKind>) {
        self.start = start
        self.end = end
        self.mayContinue = mayContinue
        self.kinds = kinds
    }
}

/// State of one half-hour cell of a day on the drum chart.
public struct SlotState: Hashable, Sendable {
    public var planned: Bool
    public var emergency: Bool
    public var off: Bool { planned || emergency }

    public init(planned: Bool, emergency: Bool) {
        self.planned = planned
        self.emergency = emergency
    }
}

/// One outage as it appears in a day's list, clipped to that day.
public struct DayRow: Hashable, Sendable {
    public var outage: Outage
    public var from: LocalDateTime
    public var to: LocalDateTime
    public var status: IntervalStatus
    public var continuesFromPrevDay: Bool
    public var continuesToNextDay: Bool
    /// Full length of the outage in minutes (not clipped to the day).
    public var durationMinutes: Int
    /// Minutes of the outage that fall inside this day.
    public var inDayMinutes: Int
}

public struct DayView: Hashable, Sendable {
    public var date: LocalDate
    public var slots: [SlotState]
    public var rows: [DayRow]
    /// Union of all kinds, clipped to the day, in elapsed minutes.
    public var totalOffMinutes: Int
}

public struct StatusInfo: Hashable, Sendable {
    public var isOffNow: Bool
    public var countdownSeconds: Int?
    /// HH:MM:SS, or "--:--:--" when nothing is ahead.
    public var countdownText: String
    /// "HH:mm – HH:mm" of the current or next span, or "Відключень немає".
    public var nextSlotTime: String
    public var currentSpan: Span?
    public var nextSpan: Span?
}

public struct AlertSpec: Hashable, Sendable {
    public var key: String
    public var fireAt: LocalDateTime
    public var spanStart: LocalDateTime
    public var spanEnd: LocalDateTime
    public var mayContinue: Bool
    public var durationMinutes: Int

    public init(key: String, fireAt: LocalDateTime, spanStart: LocalDateTime, spanEnd: LocalDateTime, mayContinue: Bool, durationMinutes: Int) {
        self.key = key
        self.fireAt = fireAt
        self.spanStart = spanStart
        self.spanEnd = spanEnd
        self.mayContinue = mayContinue
        self.durationMinutes = durationMinutes
    }
}

public struct Transition: Hashable, Sendable {
    public var at: LocalDateTime
    public var isOff: Bool
}

extension Array {
    /// Stable sort (Kotlin `sortedBy` / `sortedWith` keep the order of equal elements; Swift's `sorted` does not promise it).
    func stableSorted(by areInIncreasingOrder: (Element, Element) -> Bool) -> [Element] {
        enumerated()
            .sorted { a, b in
                if areInIncreasingOrder(a.element, b.element) { return true }
                if areInIncreasingOrder(b.element, a.element) { return false }
                return a.offset < b.offset
            }
            .map(\.element)
    }
}
