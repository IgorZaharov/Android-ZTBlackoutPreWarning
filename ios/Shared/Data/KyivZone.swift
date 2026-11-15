import Foundation

public enum KyivZone {
    public static let timeZone: TimeZone = {
        if let tz = TimeZone(identifier: "Europe/Kyiv") {
            return tz
        }
        if let legacyTz = TimeZone(identifier: "Europe/Kiev") {
            return legacyTz
        }
        return TimeZone.current
    }()

    public static let calendar: Calendar = {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        cal.locale = Locale(identifier: "uk_UA")
        return cal
    }()

    public static func todayIsoString(now: Date = Date()) -> String {
        let comps = calendar.dateComponents([.year, .month, .day], from: now)
        return String(format: "%04d-%02d-%02d", comps.year ?? 2026, comps.month ?? 1, comps.day ?? 1)
    }

    public static func tomorrowIsoString(now: Date = Date()) -> String {
        let tomorrow = calendar.date(byAdding: .day, value: 1, to: now) ?? now.addingTimeInterval(86400)
        return todayIsoString(now: tomorrow)
    }

    public static func yesterdayIsoString(now: Date = Date()) -> String {
        let yesterday = calendar.date(byAdding: .day, value: -1, to: now) ?? now.addingTimeInterval(-86400)
        return todayIsoString(now: yesterday)
    }

    public static func minuteOfDay(for date: Date = Date()) -> Int {
        let comps = calendar.dateComponents([.hour, .minute], from: date)
        return (comps.hour ?? 0) * 60 + (comps.minute ?? 0)
    }

    public static func secondOfMinute(for date: Date = Date()) -> Int {
        let comps = calendar.dateComponents([.second], from: date)
        return comps.second ?? 0
    }
}
