import Foundation

public final class ScheduleRepository {
    public static let shared = ScheduleRepository()
    public static let APP_GROUP_ID = "group.ua.blackout.prewarning"
    public static let PREFS_NAME = "zt_schedule_cache_v1"

    private let lock = NSLock()
    private var todayMemoryCache: [String: [BlackoutSlot]] = [:]
    private var tomorrowMemoryCache: [String: [BlackoutSlot]] = [:]
    private var detailedIntervalsCache: [String: [DetailedInterval]] = [:]

    private var defaults: UserDefaults {
        UserDefaults(suiteName: Self.APP_GROUP_ID) ?? .standard
    }

    public func isScheduleUnclear() -> Bool {
        defaults.bool(forKey: "schedule_is_unclear")
    }

    public func clearAllSchedulesOnUnclearState() {
        lock.lock()
        todayMemoryCache.removeAll()
        tomorrowMemoryCache.removeAll()
        detailedIntervalsCache.removeAll()
        lock.unlock()

        defaults.set(true, forKey: "schedule_is_unclear")
        for q in UserSettings.ALL_QUEUES {
            defaults.removeObject(forKey: "today_slots_\(q)")
            defaults.removeObject(forKey: "tomorrow_slots_\(q)")
            defaults.set(false, forKey: "has_tomorrow_\(q)")
        }
    }

    public func saveSchedule(
        queue: String,
        todaySlots: [BlackoutSlot],
        tomorrowSlots: [BlackoutSlot]? = nil,
        now: Date = Date()
    ) {
        let todayStr = KyivZone.todayIsoString(now: now)
        let tomorrowStr = KyivZone.tomorrowIsoString(now: now)

        let todaySerialized = serializeSlots(todaySlots)
        defaults.set(false, forKey: "schedule_is_unclear")
        defaults.set(todaySerialized, forKey: "today_slots_\(queue)")
        defaults.set(todayStr, forKey: "cache_today_date_\(queue)")
        defaults.set(Int64(now.timeIntervalSince1970 * 1000), forKey: "last_successful_fetch_ms")

        lock.lock()
        todayMemoryCache[queue] = todaySlots
        lock.unlock()

        if let tomSlots = tomorrowSlots, !tomSlots.isEmpty {
            let tomSerialized = serializeSlots(tomSlots)
            defaults.set(tomSerialized, forKey: "tomorrow_slots_\(queue)")
            defaults.set(tomorrowStr, forKey: "cache_tomorrow_date_\(queue)")
            defaults.set(true, forKey: "has_tomorrow_\(queue)")
            lock.lock()
            tomorrowMemoryCache[queue] = tomSlots
            lock.unlock()
        } else {
            defaults.removeObject(forKey: "tomorrow_slots_\(queue)")
            defaults.removeObject(forKey: "cache_tomorrow_date_\(queue)")
            defaults.set(false, forKey: "has_tomorrow_\(queue)")
            lock.lock()
            tomorrowMemoryCache.removeValue(forKey: queue)
            lock.unlock()
        }
    }

    public func saveAllSchedulesBatch(
        todaySchedules: [String: [BlackoutSlot]],
        tomorrowSchedules: [String: [BlackoutSlot]],
        now: Date = Date()
    ) {
        for (queue, todaySlots) in todaySchedules {
            let tomSlots = tomorrowSchedules[queue]
            saveSchedule(queue: queue, todaySlots: todaySlots, tomorrowSlots: tomSlots, now: now)
        }
    }

    public static let MAX_INTERVAL_CACHE_ENTRIES = 64

    public func getTodaySlots(queue: String, now: Date = Date()) -> [BlackoutSlot] {
        if isScheduleUnclear() {
            return []
        }
        let todayStr = KyivZone.todayIsoString(now: now)
        let cachedDate = defaults.string(forKey: "cache_today_date_\(queue)")
        if cachedDate == todayStr {
            lock.lock()
            if let mem = todayMemoryCache[queue] {
                lock.unlock()
                return mem
            }
            lock.unlock()

            if let raw = defaults.string(forKey: "today_slots_\(queue)") {
                let parsed = deserializeSlots(raw)
                lock.lock()
                todayMemoryCache[queue] = parsed
                lock.unlock()
                return parsed
            }
        } else if defaults.string(forKey: "cache_tomorrow_date_\(queue)") == todayStr,
                  defaults.bool(forKey: "has_tomorrow_\(queue)"),
                  let promotedRaw = defaults.string(forKey: "tomorrow_slots_\(queue)") {
            // Midnight rollover: promote cached tomorrow schedule for this date into today's schedule
            let promoted = deserializeSlots(promotedRaw)
            defaults.set(promotedRaw, forKey: "today_slots_\(queue)")
            defaults.set(todayStr, forKey: "cache_today_date_\(queue)")
            defaults.removeObject(forKey: "tomorrow_slots_\(queue)")
            defaults.removeObject(forKey: "cache_tomorrow_date_\(queue)")
            defaults.set(false, forKey: "has_tomorrow_\(queue)")
            lock.lock()
            todayMemoryCache[queue] = promoted
            tomorrowMemoryCache.removeValue(forKey: queue)
            lock.unlock()
            return promoted
        }
        return []
    }

    public func getTomorrowSlots(queue: String, now: Date = Date()) -> [BlackoutSlot]? {
        if isScheduleUnclear() {
            return nil
        }
        let tomorrowStr = KyivZone.tomorrowIsoString(now: now)
        let cachedTomorrowDate = defaults.string(forKey: "cache_tomorrow_date_\(queue)")
        guard cachedTomorrowDate == tomorrowStr,
              defaults.bool(forKey: "has_tomorrow_\(queue)") else {
            return nil
        }

        lock.lock()
        if let mem = tomorrowMemoryCache[queue] {
            lock.unlock()
            return mem
        }
        lock.unlock()

        guard let raw = defaults.string(forKey: "tomorrow_slots_\(queue)") else { return nil }
        let parsed = deserializeSlots(raw)
        lock.lock()
        tomorrowMemoryCache[queue] = parsed
        lock.unlock()
        return parsed
    }

    public func hasTomorrowSchedule(queue: String, now: Date = Date()) -> Bool {
        getTomorrowSlots(queue: queue, now: now) != nil
    }

    public func getDetailedIntervals(slots: [BlackoutSlot]) -> [DetailedInterval] {
        if slots.isEmpty { return [] }
        let signature = "\(slots.count)_" + slots.map { $0.isEmergency ? "E" : ($0.status == .POWER_OFF ? "1" : "0") }.joined()
        lock.lock()
        if let cached = detailedIntervalsCache[signature] {
            lock.unlock()
            return cached
        }
        lock.unlock()

        let computed = computeDetailedIntervals(slots: slots)
        lock.lock()
        if detailedIntervalsCache.count >= Self.MAX_INTERVAL_CACHE_ENTRIES {
            detailedIntervalsCache.removeAll(keepingCapacity: true)
        }
        detailedIntervalsCache[signature] = computed
        lock.unlock()
        return computed
    }

    public func computeDetailedIntervals(slots: [BlackoutSlot]) -> [DetailedInterval] {
        var intervals: [DetailedInterval] = []
        var currentStart: Int?
        var currentEnd: Int?
        var currentHasEmergency: Bool = false

        for slot in slots {
            if slot.status == .POWER_OFF {
                if currentStart == nil {
                    currentStart = slot.startMinute
                    currentEnd = slot.endMinute
                    currentHasEmergency = slot.isEmergency
                } else if currentEnd == slot.startMinute {
                    currentEnd = slot.endMinute
                    if slot.isEmergency { currentHasEmergency = true }
                } else {
                    if let s = currentStart, let e = currentEnd {
                        intervals.append(makeInterval(startMin: s, endMin: e, isEmergency: currentHasEmergency))
                    }
                    currentStart = slot.startMinute
                    currentEnd = slot.endMinute
                    currentHasEmergency = slot.isEmergency
                }
            } else {
                if let s = currentStart, let e = currentEnd {
                    intervals.append(makeInterval(startMin: s, endMin: e, isEmergency: currentHasEmergency))
                    currentStart = nil
                    currentEnd = nil
                    currentHasEmergency = false
                }
            }
        }
        if let s = currentStart, let e = currentEnd {
            intervals.append(makeInterval(startMin: s, endMin: e, isEmergency: currentHasEmergency))
        }
        return intervals
    }

    public func calculateStatusAndCountdown(
        slots: [BlackoutSlot],
        tomorrowSlots: [BlackoutSlot]? = nil,
        now: Date = Date()
    ) -> StatusAndCountdown {
        if slots.isEmpty {
            return StatusAndCountdown(
                isBlackoutNow: false,
                isUnclear: true,
                countdownText: "--:--:--",
                nextSlotTime: "--:-- - --:--",
                currentOrNextInterval: nil
            )
        }

        let currentMin = KyivZone.minuteOfDay(for: now)
        let currentSec = KyivZone.secondOfMinute(for: now)
        let todayIntervals = getDetailedIntervals(slots: slots)
        let tomorrowIntervals = tomorrowSlots.map { getDetailedIntervals(slots: $0) } ?? []

        // Case A: Currently in Blackout
        if let active = todayIntervals.first(where: { currentMin >= $0.startMinuteOfDay && currentMin < $0.endMinuteOfDay }) {
            var targetEndMinutes = active.endMinuteOfDay
            var displayEndStr = active.endStr
            if active.endMinuteOfDay >= 1440, let firstTom = tomorrowIntervals.first, firstTom.startMinuteOfDay == 0 {
                targetEndMinutes = 1440 + firstTom.endMinuteOfDay
                displayEndStr = firstTom.endStr
            }
            let remainingSec = max(0, (targetEndMinutes - currentMin) * 60 - currentSec)
            return StatusAndCountdown(
                isBlackoutNow: true,
                isUnclear: false,
                countdownText: formatSecondsAsHMS(remainingSec),
                nextSlotTime: "\(active.startStr) – \(displayEndStr)",
                currentOrNextInterval: active
            )
        }

        // Case B: Power ON, Upcoming Blackout Today
        if let nextToday = todayIntervals.first(where: { $0.startMinuteOfDay > currentMin }) {
            let remainingSec = max(0, (nextToday.startMinuteOfDay - currentMin) * 60 - currentSec)
            return StatusAndCountdown(
                isBlackoutNow: false,
                isUnclear: false,
                countdownText: formatSecondsAsHMS(remainingSec),
                nextSlotTime: "\(nextToday.startStr) – \(nextToday.endStr)",
                currentOrNextInterval: nextToday
            )
        }

        // Case C: Power ON, All Today's Blackouts Passed, Tomorrow Schedule Available
        if let firstTomorrow = tomorrowIntervals.first {
            let targetStartMinutes = 1440 + firstTomorrow.startMinuteOfDay
            let remainingSec = max(0, (targetStartMinutes - currentMin) * 60 - currentSec)
            return StatusAndCountdown(
                isBlackoutNow: false,
                isUnclear: false,
                countdownText: formatSecondsAsHMS(remainingSec),
                nextSlotTime: "\(firstTomorrow.startStr) – \(firstTomorrow.endStr)",
                currentOrNextInterval: firstTomorrow
            )
        }

        // Case D: No More Blackouts Today & No Tomorrow Blackouts
        return StatusAndCountdown(
            isBlackoutNow: false,
            isUnclear: false,
            countdownText: "--:--:--",
            nextSlotTime: "Відключень немає",
            currentOrNextInterval: nil
        )
    }

    public func applyEmergencyOutageToSlots(
        slots: [BlackoutSlot],
        startTime: String?,
        restoreTime: String?,
        isTomorrow: Bool = false
    ) -> [BlackoutSlot] {
        guard let startRaw = startTime, !startRaw.isEmpty,
              let endRaw = restoreTime, !endRaw.isEmpty else {
            return slots
        }
        func parseMin(_ str: String) -> Int? {
            let comps = str.split(separator: " ")
            let timePart = comps.last ?? Substring(str)
            let hm = timePart.split(separator: ":")
            guard hm.count >= 2, let h = Int(hm[0]), let m = Int(hm[1]) else { return nil }
            return min(1440, max(0, h * 60 + m))
        }
        guard let sMin = parseMin(startRaw), let eMin = parseMin(endRaw) else { return slots }
        let overlapStart = isTomorrow ? 0 : sMin
        let overlapEnd = isTomorrow ? eMin : (eMin <= sMin ? 1440 : eMin)
        guard overlapEnd > overlapStart else { return slots }

        let baseSlots: [BlackoutSlot] = slots.isEmpty ? (0..<48).map { idx in
            let sm = idx * 30
            let em = sm + 30
            let label = String(format: "%02d:%02d - %02d:%02d", sm / 60, sm % 60, em / 60, em % 60)
            return BlackoutSlot(index: idx, startMinute: sm, endMinute: em, label: label, status: .POWER_ON)
        } : slots

        return baseSlots.map { slot in
            if slot.startMinute < overlapEnd && slot.endMinute > overlapStart {
                return BlackoutSlot(
                    index: slot.index,
                    startMinute: slot.startMinute,
                    endMinute: slot.endMinute,
                    label: slot.label,
                    status: .POWER_OFF,
                    isEmergency: true
                )
            }
            return slot
        }
    }

    private func makeInterval(startMin: Int, endMin: Int, isEmergency: Bool = false) -> DetailedInterval {
        let startStr = String(format: "%02d:%02d", startMin / 60, startMin % 60)
        let endStr = String(format: "%02d:%02d", endMin / 60, endMin % 60)
        let hours = Double(endMin - startMin) / 60.0
        return DetailedInterval(
            startStr: startStr,
            endStr: endStr,
            startMinuteOfDay: startMin,
            endMinuteOfDay: endMin,
            durationHours: hours,
            isEmergency: isEmergency
        )
    }

    private func formatSecondsAsHMS(_ totalSeconds: Int) -> String {
        let h = totalSeconds / 3600
        let m = (totalSeconds % 3600) / 60
        let s = totalSeconds % 60
        return String(format: "%02d:%02d:%02d", h, m, s)
    }

    private func serializeSlots(_ slots: [BlackoutSlot]) -> String {
        slots.map { $0.status == .POWER_OFF ? "1" : "0" }.joined(separator: ",")
    }

    private func deserializeSlots(_ raw: String) -> [BlackoutSlot] {
        let parts = raw.split(separator: ",")
        return parts.enumerated().map { idx, token in
            let startMin = idx * 30
            let endMin = startMin + 30
            let label = String(format: "%02d:%02d - %02d:%02d", startMin / 60, startMin % 60, endMin / 60, endMin % 60)
            return BlackoutSlot(
                index: idx,
                startMinute: startMin,
                endMinute: endMin,
                label: label,
                status: token == "1" ? .POWER_OFF : .POWER_ON
            )
        }
    }
}
