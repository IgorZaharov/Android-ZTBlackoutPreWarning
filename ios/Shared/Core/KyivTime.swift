import Foundation

// Pure time types for the outage core (mirror of java.time as used by android core/*.kt).
// Engine instants are Kyiv wall-clock values, never Date: a Date appears only at the platform edge
// (notification trigger, widget entry) through KyivTime.date(of:).

/// A calendar date without a zone (java.time.LocalDate).
public struct LocalDate: Hashable, Comparable, CustomStringConvertible, Sendable {
    public let year: Int
    public let month: Int
    public let day: Int

    /// Validating initializer: nil for impossible dates (31 June, 29 Feb of a non-leap year, month 13).
    public init?(year: Int, month: Int, day: Int) {
        guard (1...12).contains(month), day >= 1, day <= LocalDate.daysIn(month: month, year: year) else { return nil }
        self.year = year
        self.month = month
        self.day = day
    }

    fileprivate init(unchecked year: Int, _ month: Int, _ day: Int) {
        self.year = year
        self.month = month
        self.day = day
    }

    /// Parses `yyyy-MM-dd`.
    public init?(iso: String) {
        let parts = iso.split(separator: "-", omittingEmptySubsequences: false)
        guard parts.count == 3, parts[0].count == 4, parts[1].count == 2, parts[2].count == 2,
              let y = Int(parts[0]), let m = Int(parts[1]), let d = Int(parts[2]) else { return nil }
        self.init(year: y, month: m, day: d)
    }

    public static func isLeap(_ year: Int) -> Bool { (year % 4 == 0 && year % 100 != 0) || year % 400 == 0 }

    public static func daysIn(month: Int, year: Int) -> Int {
        switch month {
        case 2: return isLeap(year) ? 29 : 28
        case 4, 6, 9, 11: return 30
        default: return 31
        }
    }

    /// Days since 1970-01-01 (Howard Hinnant's days_from_civil).
    public var epochDay: Int {
        let y = month <= 2 ? year - 1 : year
        let era = (y >= 0 ? y : y - 399) / 400
        let yoe = y - era * 400
        let mp = (month + 9) % 12
        let doy = (153 * mp + 2) / 5 + day - 1
        let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
        return era * 146_097 + doe - 719_468
    }

    public static func ofEpochDay(_ z0: Int) -> LocalDate {
        let z = z0 + 719_468
        let era = (z >= 0 ? z : z - 146_096) / 146_097
        let doe = z - era * 146_097
        let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365
        let doy = doe - (365 * yoe + yoe / 4 - yoe / 100)
        let mp = (5 * doy + 2) / 153
        let d = doy - (153 * mp + 2) / 5 + 1
        let m = mp < 10 ? mp + 3 : mp - 9
        return LocalDate(unchecked: yoe + era * 400 + (m <= 2 ? 1 : 0), m, d)
    }

    public func plusDays(_ n: Int) -> LocalDate { LocalDate.ofEpochDay(epochDay + n) }
    public func minusDays(_ n: Int) -> LocalDate { plusDays(-n) }
    public func atStartOfDay() -> LocalDateTime { LocalDateTime(date: self, hour: 0, minute: 0, second: 0) }

    public static func < (a: LocalDate, b: LocalDate) -> Bool { a.epochDay < b.epochDay }

    public var description: String { String(format: "%04d-%02d-%02d", year, month, day) }
}

/// A date and time without a zone (java.time.LocalDateTime), second precision.
public struct LocalDateTime: Hashable, Comparable, CustomStringConvertible, Sendable {
    public let date: LocalDate
    public let hour: Int
    public let minute: Int
    public let second: Int

    public init(date: LocalDate, hour: Int, minute: Int, second: Int = 0) {
        self.date = date
        self.hour = hour
        self.minute = minute
        self.second = second
    }

    /// Validating initializer (java `LocalDateTime.of`): nil for impossible values.
    public init?(year: Int, month: Int, day: Int, hour: Int, minute: Int, second: Int = 0) {
        guard let d = LocalDate(year: year, month: month, day: day),
              (0...23).contains(hour), (0...59).contains(minute), (0...59).contains(second) else { return nil }
        self.init(date: d, hour: hour, minute: minute, second: second)
    }

    /// Parses `yyyy-MM-ddTHH:mm` or `yyyy-MM-ddTHH:mm:ss` (what java `LocalDateTime.toString()` prints).
    public init?(iso: String) {
        let halves = iso.split(separator: "T", omittingEmptySubsequences: false)
        guard halves.count == 2, let d = LocalDate(iso: String(halves[0])) else { return nil }
        let t = halves[1].split(separator: ":", omittingEmptySubsequences: false)
        guard t.count == 2 || t.count == 3, t.allSatisfy({ $0.count == 2 }),
              let h = Int(t[0]), let m = Int(t[1]) else { return nil }
        let s = t.count == 3 ? Int(t[2]) : 0
        guard let sec = s else { return nil }
        self.init(year: d.year, month: d.month, day: d.day, hour: h, minute: m, second: sec)
    }

    /// Seconds since 1970-01-01T00:00 of this wall-clock value read as if it were UTC (field arithmetic only).
    public var localEpochSecond: Int { date.epochDay * 86_400 + hour * 3600 + minute * 60 + second }

    public init(localEpochSecond s: Int) {
        let day = s >= 0 ? s / 86_400 : (s - 86_399) / 86_400
        let rest = s - day * 86_400
        self.init(date: LocalDate.ofEpochDay(day), hour: rest / 3600, minute: (rest % 3600) / 60, second: rest % 60)
    }

    public func plusSeconds(_ n: Int) -> LocalDateTime { LocalDateTime(localEpochSecond: localEpochSecond + n) }
    public func plusMinutes(_ n: Int) -> LocalDateTime { plusSeconds(n * 60) }
    public func minusMinutes(_ n: Int) -> LocalDateTime { plusSeconds(-n * 60) }
    public func plusHours(_ n: Int) -> LocalDateTime { plusSeconds(n * 3600) }
    public func minusHours(_ n: Int) -> LocalDateTime { plusSeconds(-n * 3600) }
    public func plusDays(_ n: Int) -> LocalDateTime { LocalDateTime(date: date.plusDays(n), hour: hour, minute: minute, second: second) }

    public func isBefore(_ other: LocalDateTime) -> Bool { self < other }
    public func isAfter(_ other: LocalDateTime) -> Bool { self > other }

    /// java `ChronoUnit.MINUTES.between(self, other)` on wall-clock fields (no zone), truncated toward zero.
    public func localMinutes(until other: LocalDateTime) -> Int { (other.localEpochSecond - localEpochSecond) / 60 }

    public var isMidnight: Bool { hour == 0 && minute == 0 && second == 0 }

    public static func < (a: LocalDateTime, b: LocalDateTime) -> Bool { a.localEpochSecond < b.localEpochSecond }

    /// Same text as java `LocalDateTime.toString()`: seconds only when they are not zero.
    public var description: String {
        second == 0
            ? String(format: "%@T%02d:%02d", date.description, hour, minute)
            : String(format: "%@T%02d:%02d:%02d", date.description, hour, minute, second)
    }
}

/// Europe/Kyiv mapping between wall-clock values and real instants, with java.time's DST rules
/// (spec/OUTAGE_ENGINE.md section 7): a repeated wall time maps to the earlier instant, a skipped wall
/// time is shifted forward by the length of the gap.
public enum KyivTime {
    public static let zone: TimeZone =
        TimeZone(identifier: "Europe/Kyiv") ?? TimeZone(identifier: "Europe/Kiev") ?? TimeZone(secondsFromGMT: 7200)!

    private static func offset(atEpoch s: Int, zone: TimeZone) -> Int {
        zone.secondsFromGMT(for: Date(timeIntervalSince1970: TimeInterval(s)))
    }

    /// Real epoch second of a Kyiv wall-clock value.
    public static func epochSecond(of t: LocalDateTime, zone: TimeZone = KyivTime.zone) -> Int {
        let local = t.localEpochSecond
        // The two offsets around this wall time (equal when no transition is near)
        let early = offset(atEpoch: local - 14 * 3600 - 86_400 / 2, zone: zone)
        let late = offset(atEpoch: local + 14 * 3600, zone: zone)
        let candidates = Array(Set([early, late])).sorted(by: >)
        let valid = candidates.filter { offset(atEpoch: local - $0, zone: zone) == $0 }
        if let larger = valid.first {
            // Overlap: both valid, the larger (summer) offset gives the earlier instant
            return local - larger
        }
        // Gap: shift forward by the gap, i.e. use the offset that was in force before the transition
        return local - min(early, late)
    }

    /// Elapsed minutes between two wall-clock values in Kyiv (java `ChronoUnit.MINUTES.between` of ZonedDateTimes).
    public static func minutesBetween(_ a: LocalDateTime, _ b: LocalDateTime, zone: TimeZone = KyivTime.zone) -> Int {
        (epochSecond(of: b, zone: zone) - epochSecond(of: a, zone: zone)) / 60
    }

    public static func secondsBetween(_ a: LocalDateTime, _ b: LocalDateTime, zone: TimeZone = KyivTime.zone) -> Int {
        epochSecond(of: b, zone: zone) - epochSecond(of: a, zone: zone)
    }

    /// Platform edge: the real instant of a Kyiv wall-clock value.
    public static func date(of t: LocalDateTime, zone: TimeZone = KyivTime.zone) -> Date {
        Date(timeIntervalSince1970: TimeInterval(epochSecond(of: t, zone: zone)))
    }

    /// Platform edge: the Kyiv wall-clock value of a real instant (seconds truncated toward the past).
    public static func localDateTime(of date: Date, zone: TimeZone = KyivTime.zone) -> LocalDateTime {
        let s = Int(date.timeIntervalSince1970.rounded(.down))
        return LocalDateTime(localEpochSecond: s + offset(atEpoch: s, zone: zone))
    }
}
