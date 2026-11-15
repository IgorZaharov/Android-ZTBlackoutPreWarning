import Foundation

/// Cache of the ztoe hourly tables (mirror of android data/repository/ScheduleRepository.kt,
/// spec/PERSISTENCE.md section 2): today's and tomorrow's off-cells of every queue as "0"/"1" strings
/// with the date they were fetched for, plus yesterday's cells for the tail past midnight.
/// A failed fetch never clears it.
///
/// Not ported (dead code in the Android 1.4.0 app, superseded by core/OutageEngine): the 1.3.x status
/// and countdown calculator, the emergency overlay and the interval helpers.
public final class ScheduleRepository {
    public static let shared = ScheduleRepository()

    let prefs: Prefs
    private let lock = NSLock()
    /// Kyiv "today"; injectable for tests.
    private let today: () -> LocalDate
    private let nowMs: () -> Int64

    public init(
        prefs: Prefs = Prefs("zt_schedule_cache_v2"),
        today: @escaping () -> LocalDate = { KyivTime.localDateTime(of: Date()).date },
        nowMs: @escaping () -> Int64 = { Int64(Date().timeIntervalSince1970 * 1000) }
    ) {
        self.prefs = prefs
        self.today = today
        self.nowMs = nowMs
    }

    private static func encode(_ cells: [Bool]) -> String { String(cells.map { $0 ? "1" : "0" }) }

    private static func decode(_ encoded: String?) -> [Bool]? {
        guard let encoded, encoded.count >= 24 else { return nil }
        return encoded.map { $0 == "1" }
    }

    /// Saves all queues of one fetch in one go. `schedules[queue] = (todayOff, tomorrowOff)`.
    public func saveAllSchedulesBatch(_ schedules: [String: (today: [Bool], tomorrow: [Bool]?)], activeQueue: String) {
        if schedules.isEmpty { return }
        lock.lock(); defer { lock.unlock() }
        let t = today()
        let todayStr = t.description
        let tomorrowStr = t.plusDays(1).description
        let yesterdayStr = t.minusDays(1).description
        prefs.set("cache_today_date", todayStr)
        prefs.set("cache_today_queue", activeQueue)
        prefs.set("cache_last_sync_ms", nowMs())
        for (queue, pair) in schedules {
            archiveYesterday(queue, yesterdayStr)
            prefs.set("cache_today_date_\(queue)", todayStr)
            prefs.set("cache_today_slots_\(queue)", Self.encode(pair.today))
            if let tomorrow = pair.tomorrow, !tomorrow.isEmpty {
                prefs.set("cache_tomorrow_date_\(queue)", tomorrowStr)
                prefs.set("cache_tomorrow_slots_\(queue)", Self.encode(tomorrow))
                prefs.set("cache_has_tomorrow_\(queue)", true)
            } else {
                prefs.remove("cache_tomorrow_date_\(queue)")
                prefs.remove("cache_tomorrow_slots_\(queue)")
                prefs.set("cache_has_tomorrow_\(queue)", false)
            }
        }
    }

    public func isCacheFresh(refreshIntervalMinutes: Int) -> Bool {
        let lastSync = prefs.int64("cache_last_sync_ms", 0)
        if lastSync <= 0 { return false }
        let maxAge = Int64(max(refreshIntervalMinutes, 5)) * 60_000 - 30_000
        let age = nowMs() - lastSync
        return age >= 0 && age <= maxAge
    }

    private func cachedTodayDate(_ queue: String) -> String? {
        prefs.string("cache_today_date_\(queue)") ?? prefs.string("cache_today_date")
    }

    /// Midnight rollover: promote the cached tomorrow schedule into today when the date crosses 00:00 Kyiv.
    private func promoteTomorrowIfNeeded(_ queue: String, _ t: LocalDate) {
        if queue.ktIsBlank { return }
        let todayStr = t.description
        let yesterdayStr = t.minusDays(1).description
        guard cachedTodayDate(queue) == yesterdayStr,
              prefs.string("cache_tomorrow_date_\(queue)") == todayStr,
              let tomorrowEncoded = prefs.string("cache_tomorrow_slots_\(queue)"), !tomorrowEncoded.isEmpty else { return }
        lock.lock(); defer { lock.unlock() }
        archiveYesterday(queue, yesterdayStr)
        prefs.set("cache_today_date", todayStr)
        prefs.set("cache_today_date_\(queue)", todayStr)
        prefs.set("cache_today_slots_\(queue)", tomorrowEncoded)
        prefs.remove("cache_tomorrow_date_\(queue)")
        prefs.remove("cache_tomorrow_slots_\(queue)")
        prefs.set("cache_has_tomorrow_\(queue)", false)
    }

    /// Keeps the last day's cells for one more day so an outage that began before midnight keeps its
    /// real start and length in today's list (spec/OUTAGE_ENGINE.md, "yesterday tail").
    private func archiveYesterday(_ queue: String, _ yesterdayStr: String) {
        if cachedTodayDate(queue) == yesterdayStr, let old = prefs.string("cache_today_slots_\(queue)"), !old.isEmpty {
            prefs.set("cache_yesterday_date_\(queue)", yesterdayStr)
            prefs.set("cache_yesterday_slots_\(queue)", old)
        }
    }

    /// True where power is off per the ztoe table; nil when there is no valid cache for today.
    public func todayOffCells(_ queue: String) -> [Bool]? {
        if queue.ktIsBlank { return nil }
        let t = today()
        promoteTomorrowIfNeeded(queue, t)
        guard cachedTodayDate(queue) == t.description else { return nil }
        return Self.decode(prefs.string("cache_today_slots_\(queue)"))
    }

    public func tomorrowOffCells(_ queue: String) -> [Bool]? {
        if queue.ktIsBlank { return nil }
        let t = today()
        promoteTomorrowIfNeeded(queue, t)
        let tomorrowDate = prefs.string("cache_tomorrow_date_\(queue)")
        let dateValid = cachedTodayDate(queue) == t.description && (tomorrowDate == nil || tomorrowDate == t.plusDays(1).description)
        guard dateValid, prefs.bool("cache_has_tomorrow_\(queue)", false) else { return nil }
        return Self.decode(prefs.string("cache_tomorrow_slots_\(queue)"))
    }

    public func yesterdayOffCells(_ queue: String) -> [Bool]? {
        if queue.ktIsBlank { return nil }
        guard prefs.string("cache_yesterday_date_\(queue)") == today().minusDays(1).description else { return nil }
        return Self.decode(prefs.string("cache_yesterday_slots_\(queue)"))
    }

    public func lastSyncMs() -> Int64 { prefs.int64("cache_last_sync_ms", 0) }

    public func hasValidTodayCache(_ queue: String) -> Bool { todayOffCells(queue) != nil }

    public func hasTomorrowSchedule(_ queue: String) -> Bool { tomorrowOffCells(queue) != nil }

    public func clearScheduleCache() {
        lock.lock(); defer { lock.unlock() }
        prefs.clear()
    }

    /// The saved ETag of the schedule page (sent as If-None-Match).
    public var etag: String? {
        get { prefs.string("ztoe_last_etag").flatMap { $0.ktIsBlank ? nil : $0 } }
        set { prefs.set("ztoe_last_etag", newValue) }
    }
}
