import Foundation

public final class AlertRegistry {
    public static let shared = AlertRegistry()
    public static let PREFS_KEY = "zt_alert_registry_v1"

    private var defaults: UserDefaults {
        UserDefaults(suiteName: ScheduleRepository.APP_GROUP_ID) ?? .standard
    }

    public static let MAX_STORED_ENTRIES = 100

    public func hasNotified(slotId: String) -> Bool {
        let set = Set(defaults.stringArray(forKey: Self.PREFS_KEY) ?? [])
        return set.contains(slotId)
    }

    public func markNotified(slotId: String, now: Date = Date()) {
        let todayStr = KyivZone.todayIsoString(now: now)
        let tomorrowStr = KyivZone.tomorrowIsoString(now: now)
        var list = (defaults.stringArray(forKey: Self.PREFS_KEY) ?? []).filter { id in
            !id.hasPrefix("block_") || id.hasPrefix("block_\(todayStr)_") || id.hasPrefix("block_\(tomorrowStr)_")
        }
        if !list.contains(slotId) {
            list.append(slotId)
        }
        if list.count > Self.MAX_STORED_ENTRIES {
            list = Array(list.suffix(Self.MAX_STORED_ENTRIES))
        }
        defaults.set(list, forKey: Self.PREFS_KEY)
    }

    public func resetFutureSlotsOnTimeChange(queue: String, todayStr: String, currentMinuteOfDay: Int, advanceNoticeMinutes: Int) {
        let existing = defaults.stringArray(forKey: Self.PREFS_KEY) ?? []
        let filtered = existing.filter { id in
            guard id.hasPrefix("block_\(todayStr)_"), id.hasSuffix("_Q\(queue)") else {
                return true
            }
            let parts = id.split(separator: "_")
            guard parts.count >= 4 else { return true }
            let startStr = String(parts[2])
            let hm = startStr.split(separator: ":")
            guard hm.count == 2, let h = Int(hm[0]), let m = Int(hm[1]) else { return true }
            let blockStartMin = h * 60 + m
            let alertMin = blockStartMin - advanceNoticeMinutes
            return currentMinuteOfDay >= alertMin
        }
        defaults.set(filtered, forKey: Self.PREFS_KEY)
    }

    public func clearAll() {
        defaults.removeObject(forKey: Self.PREFS_KEY)
    }
}
