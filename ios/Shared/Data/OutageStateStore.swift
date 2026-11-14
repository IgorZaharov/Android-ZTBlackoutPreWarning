import Foundation

/// When the ztoe site was last checked and what was found.
public struct SiteSnapshot: Hashable, Sendable {
    public var state: SiteState
    public var checkedAtMs: Int64
    public var lastSuccessMs: Int64?
    /// The site's own notice ("УВАГА! ВАЖЛИВА ІНФОРМАЦІЯ!"), kept only while the page has no table.
    public var notice: String?
}

/// Whether the last PowerOn refresh worked.
public struct PowerOnSnapshot: Hashable, Sendable {
    public var ok: Bool
    public var checkedAtMs: Int64
    public var lastOkMs: Int64?
}

/// Small persistent state of the outage pipeline, kept apart from user settings so a long network call
/// can never overwrite a setting the user just changed (mirror of android OutageStateStore.kt,
/// spec/PERSISTENCE.md section 3).
///
/// iOS layout (spec/PERSISTENCE.md section 6): ledgers, repair works and resolved ids are one versioned
/// JSON file in the App Group container (`outage_state_v1.json`, read by the widget too); the scalar site
/// and PowerOn status live in the `zt_outage_state_v1` key/value store with the Android key names.
public final class OutageStateStore {
    public static let shared = OutageStateStore()
    public static let FILE = "outage_state_v1.json"
    public static let SCHEMA_VERSION = 1

    let prefs: Prefs
    private let fileName: String
    private let lock = NSLock()

    public init(prefs: Prefs = Prefs("zt_outage_state_v1"), fileName: String = OutageStateStore.FILE) {
        self.prefs = prefs
        self.fileName = fileName
    }

    // MARK: - JSON file (ledgers, repairs, ids)

    private typealias Doc = [String: Any]

    private func readDoc() -> Doc {
        guard let doc = AppGroup.readJSON(fileName) as? Doc,
              (doc["schemaVersion"] as? NSNumber)?.intValue == Self.SCHEMA_VERSION else { return [:] }
        return doc
    }

    /// Read-modify-write of one section ("ledger", "repair", "ids") under the lock.
    private func update(_ section: String, _ key: String, _ value: Any?) {
        lock.lock(); defer { lock.unlock() }
        var doc = readDoc()
        doc["schemaVersion"] = Self.SCHEMA_VERSION
        var map = doc[section] as? Doc ?? [:]
        map[key] = value
        doc[section] = map
        AppGroup.writeJSON(fileName, doc)
    }

    private func section(_ section: String, _ key: String) -> Any? {
        lock.lock(); defer { lock.unlock() }
        return (readDoc()[section] as? Doc)?[key]
    }

    private static func dt(_ v: Any?) -> LocalDateTime? {
        guard let s = v as? String, !s.isEmpty else { return nil }
        return LocalDateTime(iso: s)
    }

    private static func put(_ o: inout Doc, _ k: String, _ v: LocalDateTime?) {
        if let v { o[k] = v.description }
    }

    // MARK: Emergency ledger (per address)

    public func ledger(_ addressKey: String) -> [LedgerEntry] {
        (section("ledger", addressKey) as? [Any] ?? []).compactMap { item -> LedgerEntry? in
            guard let o = item as? Doc, let id = o["id"] as? String, let start = Self.dt(o["start"]),
                  let firstSeen = Self.dt(o["firstSeen"]), let lastSeen = Self.dt(o["lastSeen"]) else { return nil }
            return LedgerEntry(
                id: id, start: start, estimatedEnd: Self.dt(o["estimatedEnd"]),
                label: (o["label"] as? String).flatMap { $0.isEmpty ? nil : $0 },
                firstSeen: firstSeen, lastSeen: lastSeen, closedAt: Self.dt(o["closedAt"]),
                startEmitted: (o["startEmitted"] as? NSNumber)?.boolValue ?? true,
                endEmitted: (o["endEmitted"] as? NSNumber)?.boolValue ?? false,
                lastEmittedEta: Self.dt(o["lastEmittedEta"])
            )
        }
    }

    public func saveLedger(_ addressKey: String, _ entries: [LedgerEntry]) {
        if entries.isEmpty {
            update("ledger", addressKey, nil)
            return
        }
        update("ledger", addressKey, entries.map { e -> Doc in
            var o: Doc = [
                "id": e.id, "start": e.start.description, "firstSeen": e.firstSeen.description,
                "lastSeen": e.lastSeen.description, "startEmitted": e.startEmitted, "endEmitted": e.endEmitted
            ]
            Self.put(&o, "estimatedEnd", e.estimatedEnd)
            Self.put(&o, "closedAt", e.closedAt)
            Self.put(&o, "lastEmittedEta", e.lastEmittedEta)
            if let label = e.label { o["label"] = label }
            return o
        })
    }

    // MARK: Planned repair works from PowerOn (per address)

    public func repairs(_ addressKey: String) -> [Outage] {
        (section("repair", addressKey) as? [Any] ?? []).compactMap { item -> Outage? in
            guard let o = item as? Doc, let id = o["id"] as? String, let start = Self.dt(o["start"]),
                  let end = Self.dt(o["end"]) else { return nil }
            return Outage(id: id, kind: .REPAIR, start: start, end: end,
                          label: (o["label"] as? String).flatMap { $0.isEmpty ? nil : $0 })
        }
    }

    public func saveRepairs(_ addressKey: String, _ outages: [Outage]) {
        if outages.isEmpty {
            update("repair", addressKey, nil)
            return
        }
        update("repair", addressKey, outages.map { o -> Doc in
            var d: Doc = ["id": o.id, "start": o.start.description, "end": o.end.description]
            if let label = o.label { d["label"] = label }
            return d
        })
    }

    // MARK: Resolved PowerOn ids (per address)

    public func ids(_ addressKey: String) -> (ids: PowerOnIds, resolvedAtMs: Int64)? {
        guard let o = section("ids", addressKey) as? Doc else { return nil }
        let cities = (o["cityIds"] as? [Any] ?? []).compactMap { ($0 as? NSNumber)?.intValue }
        let streets = (o["streetIds"] as? [Any] ?? []).compactMap { ($0 as? NSNumber)?.intValue }
        return (PowerOnIds(cityIds: cities, streetIds: streets), (o["resolvedAtMs"] as? NSNumber)?.int64Value ?? 0)
    }

    public func saveIds(_ addressKey: String, _ ids: PowerOnIds, nowMs: Int64) {
        update("ids", addressKey, ["cityIds": ids.cityIds, "streetIds": ids.streetIds, "resolvedAtMs": nowMs] as Doc)
    }

    // MARK: - Site and source status (key/value store)

    public func site() -> SiteSnapshot? {
        guard let name = prefs.string("site_state"), let state = SiteState(rawValue: name) else { return nil }
        let success = prefs.int64("site_last_success_ms", 0)
        let notice = prefs.string("site_notice").flatMap { !$0.ktIsBlank && state == .AVAILABLE_NO_TABLE ? $0 : nil }
        return SiteSnapshot(state: state, checkedAtMs: prefs.int64("site_checked_ms", 0),
                            lastSuccessMs: success > 0 ? success : nil, notice: notice)
    }

    public func saveSite(_ state: SiteState, nowMs: Int64, notice: String? = nil) {
        prefs.set("site_state", state.rawValue)
        prefs.set("site_checked_ms", nowMs)
        // A notice only means something while the page has no table; any other state forgets it
        if state == .AVAILABLE_NO_TABLE, let notice, !notice.ktIsBlank {
            prefs.set("site_notice", notice)
        } else if state != .SITE_UNREACHABLE && state != .NO_INTERNET {
            prefs.remove("site_notice")
        }
        if state == .AVAILABLE_WITH_TABLE { prefs.set("site_last_success_ms", nowMs) }
    }

    /// PowerOn status of the primary address (`addressKey == nil`) or of another subscription
    /// (spec/SUBSCRIPTIONS.md 8.4, keys suffixed with `_<addressKey>`).
    public func poweron(_ addressKey: String? = nil) -> PowerOnSnapshot? {
        let suffix = addressKey.map { "_\($0)" } ?? ""
        guard prefs.contains("poweron_checked_ms\(suffix)") else { return nil }
        let lastOk = prefs.int64("poweron_last_ok_ms\(suffix)", 0)
        return PowerOnSnapshot(ok: prefs.bool("poweron_ok\(suffix)", false),
                               checkedAtMs: prefs.int64("poweron_checked_ms\(suffix)", 0),
                               lastOkMs: lastOk > 0 ? lastOk : nil)
    }

    public func savePowerOn(_ addressKey: String? = nil, ok: Bool, nowMs: Int64) {
        let suffix = addressKey.map { "_\($0)" } ?? ""
        prefs.set("poweron_ok\(suffix)", ok)
        prefs.set("poweron_checked_ms\(suffix)", nowMs)
        if ok { prefs.set("poweron_last_ok_ms\(suffix)", nowMs) }
    }

    /// Forgets everything (used by "reset to defaults").
    public func clearAll() {
        lock.lock(); defer { lock.unlock() }
        prefs.clear()
        AppGroup.removeFile(fileName)
    }
}
