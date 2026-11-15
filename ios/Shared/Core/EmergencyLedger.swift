import Foundation

/// Result of asking PowerOn about one address. An empty confirmed list means "no emergency", not "failed".
public enum EmergencyFetch: Hashable, Sendable {
    case confirmed([EmergencyRecord])
    case unavailable(String)
}

/// One emergency outage seen for an address, with what has already been announced about it.
public struct LedgerEntry: Hashable, Sendable {
    public var id: String
    public var start: LocalDateTime
    public var estimatedEnd: LocalDateTime?
    public var label: String?
    public var firstSeen: LocalDateTime
    public var lastSeen: LocalDateTime
    public var closedAt: LocalDateTime?
    public var startEmitted: Bool
    public var endEmitted: Bool
    public var lastEmittedEta: LocalDateTime?

    public init(
        id: String, start: LocalDateTime, estimatedEnd: LocalDateTime?, label: String?,
        firstSeen: LocalDateTime, lastSeen: LocalDateTime, closedAt: LocalDateTime?,
        startEmitted: Bool, endEmitted: Bool, lastEmittedEta: LocalDateTime?
    ) {
        self.id = id
        self.start = start
        self.estimatedEnd = estimatedEnd
        self.label = label
        self.firstSeen = firstSeen
        self.lastSeen = lastSeen
        self.closedAt = closedAt
        self.startEmitted = startEmitted
        self.endEmitted = endEmitted
        self.lastEmittedEta = lastEmittedEta
    }
}

public enum EmergencyEventKind: String, Sendable { case START, ETA_CHANGED, END }

public struct EmergencyEvent: Hashable, Sendable {
    public var kind: EmergencyEventKind
    public var entryId: String
    public var start: LocalDateTime
    public var eta: LocalDateTime?
    /// START only: the outage begins in the future.
    public var upcoming: Bool = false
    /// END only: it disappeared before its estimated restore (restored early or cancelled).
    public var earlyEnd: Bool = false

    /// Platform-neutral dedupe key, see spec/NOTIFICATIONS.md.
    public func key(addressKey: String) -> String {
        let etaText = eta.map { $0.description } ?? "null"
        switch kind {
        case .START: return "emerg_start_\(addressKey)_\(start)"
        case .ETA_CHANGED: return "emerg_change_\(addressKey)_\(start)_\(etaText)"
        case .END: return "emerg_end_\(addressKey)_\(start)"
        }
    }
}

public struct LedgerResult: Hashable, Sendable {
    public var entries: [LedgerEntry]
    public var events: [EmergencyEvent]
}

/// Remembers emergencies per address (mirror of android core/EmergencyLedger.kt) so that:
///  - a failed fetch never looks like "power restored" (unavailable changes nothing),
///  - an outage that was already over when first seen never alerts,
///  - finished emergencies of today stay listable (PowerOn keeps no history),
///  - each transition (start / eta changed / end) is announced exactly once.
public enum EmergencyLedger {

    public static func reconcile(
        _ entries: [LedgerEntry],
        fetch: EmergencyFetch,
        now: LocalDateTime,
        graceMinutes: Int = OutageConfig.OVERDUE_GRACE_MINUTES
    ) -> LedgerResult {
        let pruned = prune(entries, now: now)
        guard case let .confirmed(records) = fetch else { return LedgerResult(entries: pruned, events: []) }

        var byId: [String: LedgerEntry] = [:]
        for e in pruned { byId[e.id] = e } // Kotlin associateBy: the last entry of an id wins
        var events: [EmergencyEvent] = []
        // Insertion-ordered map (Kotlin LinkedHashMap): re-assigning a key keeps its position
        var outKeys: [String] = []
        var out: [String: LedgerEntry] = [:]
        func put(_ id: String, _ e: LedgerEntry) {
            if out[id] == nil { outKeys.append(id) }
            out[id] = e
        }
        var seen = Set<String>()
        // Open entries PowerOn stopped listing: a listed record overlapping one is the same outage
        // re-registered under a new start (continuation, spec/NOTIFICATIONS.md 2.2)
        let listed = Set(records.map(\.id))
        let vanished = pruned.filter { $0.closedAt == nil && !listed.contains($0.id) }
        var absorbed = Set<String>()

        func etaChange(_ e: inout LedgerEntry, last: LocalDateTime?, rec: EmergencyRecord) {
            guard let newEta = rec.estimatedEnd else { return }
            if let last {
                if abs(last.localMinutes(until: newEta)) >= OutageConfig.ETA_CHANGE_MIN_DELTA_MINUTES {
                    events.append(EmergencyEvent(kind: .ETA_CHANGED, entryId: rec.id, start: rec.start, eta: newEta))
                    e.lastEmittedEta = newEta
                }
            } else {
                e.lastEmittedEta = newEta
            }
        }

        for rec in records {
            if !seen.insert(rec.id).inserted { continue }
            var open = rec
            open.closedAt = nil
            let resolved = OutageEngine.resolveEmergency(open, now: now, graceMinutes: graceMinutes)
            let old = byId[rec.id]
            let continued: LedgerEntry? = old == nil
                ? vanished.first(where: { !absorbed.contains($0.id) && overlaps($0, rec) })
                : nil

            if let continued {
                absorbed.insert(continued.id)
                var e = newEntry(rec, now: now, announced: continued.endEmitted)
                e.firstSeen = continued.firstSeen
                e.startEmitted = continued.startEmitted
                e.lastEmittedEta = continued.lastEmittedEta
                if !resolved.stale && e.startEmitted && !e.endEmitted {
                    etaChange(&e, last: continued.lastEmittedEta, rec: rec)
                }
                put(rec.id, e)
            } else if let old {
                if old.closedAt != nil {
                    if resolved.stale {
                        var e = old
                        e.lastSeen = now
                        put(rec.id, e)
                    } else {
                        var e = newEntry(rec, now: now, announced: false)
                        e.firstSeen = old.firstSeen
                        put(rec.id, e)
                        events.append(EmergencyEvent(kind: .START, entryId: rec.id, start: rec.start, eta: rec.estimatedEnd,
                                                     upcoming: now.isBefore(rec.start)))
                    }
                } else {
                    var e = old
                    e.lastSeen = now
                    e.estimatedEnd = rec.estimatedEnd
                    e.label = rec.label ?? old.label
                    if !resolved.stale && old.startEmitted && !old.endEmitted {
                        etaChange(&e, last: old.lastEmittedEta, rec: rec)
                    }
                    put(rec.id, e)
                }
            } else {
                if resolved.stale {
                    put(rec.id, newEntry(rec, now: now, announced: true))
                } else {
                    put(rec.id, newEntry(rec, now: now, announced: false))
                    events.append(EmergencyEvent(kind: .START, entryId: rec.id, start: rec.start, eta: rec.estimatedEnd,
                                                 upcoming: now.isBefore(rec.start)))
                }
            }
        }

        for old in pruned {
            if seen.contains(old.id) { continue }
            if old.closedAt != nil {
                put(old.id, old)
                continue
            }
            // Taken over by a new record, or covered by a listed one: the outage goes on, nothing ended
            if absorbed.contains(old.id) || records.contains(where: { overlaps(old, $0) }) { continue }
            let est = old.estimatedEnd
            let wasStale = est.map { $0.localMinutes(until: now) > graceMinutes } ?? false
            let silent = old.endEmitted || wasStale || !old.startEmitted
            var closed = old
            closed.closedAt = now
            closed.endEmitted = true
            put(old.id, closed)
            if !silent {
                events.append(EmergencyEvent(kind: .END, entryId: old.id, start: old.start, eta: est,
                                             earlyEnd: est.map { now.isBefore($0) } ?? false))
            }
        }
        return LedgerResult(entries: outKeys.compactMap { out[$0] }, events: events)
    }

    /// The entry's time and the record's time overlap or touch; a missing estimate is open-ended.
    private static func overlaps(_ e: LedgerEntry, _ r: EmergencyRecord) -> Bool {
        (r.estimatedEnd.map { !e.start.isAfter($0) } ?? true) && (e.estimatedEnd.map { !r.start.isAfter($0) } ?? true)
    }

    private static func newEntry(_ rec: EmergencyRecord, now: LocalDateTime, announced: Bool) -> LedgerEntry {
        LedgerEntry(
            id: rec.id, start: rec.start, estimatedEnd: rec.estimatedEnd, label: rec.label,
            firstSeen: now, lastSeen: now, closedAt: nil,
            startEmitted: true, endEmitted: announced, lastEmittedEta: rec.estimatedEnd
        )
    }

    public static func prune(_ entries: [LedgerEntry], now: LocalDateTime) -> [LedgerEntry] {
        let cutoff = now.minusHours(OutageConfig.LEDGER_RETENTION_HOURS)
        return entries.filter { ($0.closedAt ?? $0.lastSeen).isAfter(cutoff) }
    }

    /// Ledger entries as outages for the engine (active, overdue, stale and closed ones alike).
    public static func outages(_ entries: [LedgerEntry], now: LocalDateTime) -> [Outage] {
        entries.map {
            OutageEngine.resolveEmergency(
                EmergencyRecord(id: $0.id, start: $0.start, estimatedEnd: $0.estimatedEnd, closedAt: $0.closedAt, label: $0.label),
                now: now
            )
        }
    }
}
