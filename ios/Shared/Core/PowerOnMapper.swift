import Foundation

/// One row of `pw_accidents` / `pw_accident_planeds` from the PowerOn API, reduced to plain types.
public struct PowerOnRow: Hashable, Sendable {
    public var id: Int64
    public var cityId: Int?
    public var cityName: String
    public var streetId: Int?
    public var streetName: String
    public var dateEvent: String
    public var datePlanIn: String
    public var koment: String?
    /// 2 = mirror of the hourly schedule (GPV), anything else is a real emergency. Absent on planned works.
    public var switchSubReason: Int?
    public var typeOff: Int?
    /// Comma separated list of affected buildings on the street.
    public var buildingNames: String

    public init(
        id: Int64, cityId: Int?, cityName: String, streetId: Int?, streetName: String,
        dateEvent: String, datePlanIn: String, koment: String?, switchSubReason: Int?, typeOff: Int?,
        buildingNames: String
    ) {
        self.id = id
        self.cityId = cityId
        self.cityName = cityName
        self.streetId = streetId
        self.streetName = streetName
        self.dateEvent = dateEvent
        self.datePlanIn = datePlanIn
        self.koment = koment
        self.switchSubReason = switchSubReason
        self.typeOff = typeOff
        self.buildingNames = buildingNames
    }
}

/// Maps PowerOn rows to outages for one house (mirror of android core/PowerOnMapper.kt,
/// spec/POWERON_API.md).
///
/// PowerOn timestamps look like `2026-11-12T22:04:40+00:00` but are Kyiv wall-clock time with a wrong
/// offset label. The offset is therefore ignored, never converted. Never use ISO8601DateFormatter here.
public enum PowerOnMapper {
    private static let iso = Rx("^\(Rx.ws)*(\\d{4})-(\\d{2})-(\\d{2})[T ](\\d{2}):(\\d{2})(?::\\d{2}(?:\\.\\d+)?)?")

    /// Minute precision; the `+00:00` / `Z` suffix is deliberately dropped.
    public static func parseTime(_ raw: String?) -> LocalDateTime? {
        guard let raw, let m = iso.firstMatch(in: raw) else { return nil }
        let ns = raw as NSString
        func n(_ i: Int) -> Int? { Rx.group(m, i, in: ns).flatMap { Int($0) } }
        guard let y = n(1), let mo = n(2), let d = n(3), let h = n(4), let mi = n(5) else { return nil }
        return LocalDateTime(year: y, month: mo, day: d, hour: h, minute: mi)
    }

    private static func cleanLabel(_ koment: String?) -> String? {
        guard let t = koment?.ktTrim(), !t.isEmpty else { return nil }
        return t
    }

    private static func maxOrNil(_ a: LocalDateTime?, _ b: LocalDateTime?) -> LocalDateTime? {
        switch (a, b) {
        case let (x?, y?): return x > y ? x : y
        case let (x?, nil): return x
        case let (nil, y?): return y
        default: return nil
        }
    }

    /// Real emergencies for `house` (switchSubReason != 2), merged per start time.
    public static func emergencyRecordsFor(_ rows: [PowerOnRow], house: String) -> [EmergencyRecord] {
        var order: [String] = []
        var byId: [String: EmergencyRecord] = [:]
        for row in rows {
            if row.switchSubReason == 2 { continue }
            if !HouseKey.listContains(row.buildingNames, house: house) { continue }
            guard let start = parseTime(row.dateEvent) else { continue }
            let est = parseTime(row.datePlanIn).flatMap { $0.isAfter(start) ? $0 : nil }
            let id = "pw_\(start)"
            let label = cleanLabel(row.koment)
            if var old = byId[id] {
                old.estimatedEnd = maxOrNil(old.estimatedEnd, est)
                old.label = old.label ?? label
                byId[id] = old
            } else {
                order.append(id)
                byId[id] = EmergencyRecord(id: id, start: start, estimatedEnd: est, closedAt: nil, label: label)
            }
        }
        return mergeOverlapping(order.compactMap { byId[$0] }.stableSorted { $0.start < $1.start })
    }

    /// Records whose times overlap or touch are one outage (spec/POWERON_API.md 5.1 step 7). The merged
    /// record keeps the id and start of the earliest and the latest estimate; no estimate is open-ended.
    private static func mergeOverlapping(_ sorted: [EmergencyRecord]) -> [EmergencyRecord] {
        var out: [EmergencyRecord] = []
        for rec in sorted {
            if var last = out.last, last.estimatedEnd.map({ !rec.start.isAfter($0) }) ?? true {
                last.estimatedEnd = maxOrNil(last.estimatedEnd, rec.estimatedEnd)
                last.label = last.label ?? rec.label
                out[out.count - 1] = last
            } else {
                out.append(rec)
            }
        }
        return out
    }

    /// Planned repair works for `house`; treated as planned outages. Rows beyond tomorrow are dropped.
    public static func repairOutagesFor(_ rows: [PowerOnRow], house: String, today: LocalDate) -> [Outage] {
        var order: [String] = []
        var byId: [String: Outage] = [:]
        let limit = today.plusDays(2).atStartOfDay()
        for row in rows {
            if !HouseKey.listContains(row.buildingNames, house: house) { continue }
            guard let start = parseTime(row.dateEvent), let end = parseTime(row.datePlanIn) else { continue }
            if !end.isAfter(start) || !start.isBefore(limit) { continue }
            let id = "repair_\(start)"
            let label = cleanLabel(row.koment)
            if var old = byId[id] {
                if end.isAfter(old.end) { old.end = end }
                old.label = old.label ?? label
                byId[id] = old
            } else {
                order.append(id)
                byId[id] = Outage(id: id, kind: .REPAIR, start: start, end: end, label: label)
            }
        }
        return order.compactMap { byId[$0] }.stableSorted { $0.start < $1.start }
    }
}
