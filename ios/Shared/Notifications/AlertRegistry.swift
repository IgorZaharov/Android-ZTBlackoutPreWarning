import Foundation

/// Keys that were already notified, so an alert is never posted twice (mirror of android
/// AlertRegistry.kt, spec/PERSISTENCE.md section 4). Store `zt_notified_blackouts_v1`.
public final class AlertRegistry {
    public static let shared = AlertRegistry()
    public static let MAX_STORED_ENTRIES = 300
    private static let WEEK_MS: Int64 = 7 * 24 * 60 * 60 * 1000

    let prefs: Prefs
    private let lock = NSLock()
    private let nowMs: () -> Int64

    public init(prefs: Prefs = Prefs("zt_notified_blackouts_v1"),
                nowMs: @escaping () -> Int64 = { Int64(Date().timeIntervalSince1970 * 1000) }) {
        self.prefs = prefs
        self.nowMs = nowMs
    }

    public func hasNotified(_ key: String) -> Bool { prefs.bool("notified_\(key)", false) }

    public func hasFired(_ key: String) -> Bool { hasNotified(key) }

    public func markFired(_ key: String) { markNotified(key) }

    /// Marks `key` with a timestamp, prunes entries older than 7 days and keeps at most
    /// MAX_STORED_ENTRIES (300: up to 5 addresses share it).
    public func markNotified(_ key: String) {
        lock.lock(); defer { lock.unlock() }
        let now = nowMs()
        let cutoff = now - Self.WEEK_MS
        var stamps: [(key: String, at: Int64)] = []
        for k in prefs.keys() where k.hasPrefix("ts_") {
            let old = String(k.dropFirst(3))
            let at = prefs.int64(k, 0)
            if at < cutoff {
                prefs.remove(k)
                prefs.remove("notified_\(old)")
            } else {
                stamps.append((old, at))
            }
        }
        if stamps.count >= Self.MAX_STORED_ENTRIES {
            let oldestFirst = stamps.stableSorted { $0.at < $1.at }
            let excess = stamps.count - Self.MAX_STORED_ENTRIES + 1
            for s in oldestFirst.prefix(excess) {
                prefs.remove("ts_\(s.key)")
                prefs.remove("notified_\(s.key)")
            }
        }
        prefs.set("notified_\(key)", true)
        prefs.set("ts_\(key)", now)
    }

    /// When the clock was set back, clears keys whose notification time now lies in the future and the
    /// given blocks whose alert time is in the future again.
    public func resetFutureSlotsOnTimeChange(nowMs: Int64, futureBlockIds: Set<String>) {
        lock.lock(); defer { lock.unlock() }
        for k in prefs.keys() where k.hasPrefix("ts_") && prefs.int64(k, 0) > nowMs {
            prefs.remove(k)
            prefs.remove("notified_\(k.dropFirst(3))")
        }
        for id in futureBlockIds {
            prefs.remove("notified_\(id)")
            prefs.remove("ts_\(id)")
        }
    }

    public func clearHistory() {
        lock.lock(); defer { lock.unlock() }
        prefs.clear()
    }
}
