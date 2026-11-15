import Foundation

/// Pure text rules of the outage list under the drum (spec/UI_DRUM.md section 5), mirror of
/// `android/.../ui/components/OutageRowFormat.kt`: one row per outage with its full span, the date on
/// the far side of midnight, kind and state tags. No UI types, so it is unit tested (OutageRowFormatTests).
public enum OutageRowFormat {

    public struct RowText: Equatable, Sendable {
        public var kind: OutageKind
        /// "10:00 – 12:00", "23:00 – 01:00 (14.11)", "00:00 – 01:00", "10:00 – --:--" for an overdue emergency.
        public var timeText: String
        /// Full length of the outage ("2 год"); nil when the end is unknown (overdue emergency).
        public var durationText: String?
        /// "Аварійне" / "Планові роботи"; nil for a plain planned outage (the dot is its marker).
        public var kindTag: String?
        /// "з 13.11 23:00" on the day an outage continues into.
        public var originTag: String?
        /// "завершено" / "очікується відновлення".
        public var statusTag: String?
        /// "можливе продовження" when the real end is later than the known schedule.
        public var continueTag: String?
        public var isFinished: Bool
        public var isEmergency: Bool
        public var isRepair: Bool
        /// One sentence for VoiceOver: kind, time, duration and tags.
        public var accessibilityText: String
    }

    private static func p2(_ n: Int) -> String { n < 10 ? "0\(n)" : "\(n)" }

    public static func hhmm(_ t: LocalDateTime) -> String { "\(p2(t.hour)):\(p2(t.minute))" }

    public static func dayMonth(_ t: LocalDateTime) -> String { "\(p2(t.date.day)).\(p2(t.date.month))" }

    /// End of an outage that leaves the day, with the date it really ends on; exactly 00:00 reads "24:00" of the day before.
    private static func endWithDate(_ end: LocalDateTime) -> String {
        end.isMidnight ? "24:00 (\(dayMonth(end.plusDays(-1))))" : "\(hhmm(end)) (\(dayMonth(end)))"
    }

    public static func kindLabel(_ lang: String, _ kind: OutageKind) -> String {
        switch kind {
        case .EMERGENCY: return AppStrings.kindEmergency(lang)
        case .REPAIR: return AppStrings.kindRepair(lang)
        case .PLANNED: return AppStrings.kindPlanned(lang)
        }
    }

    public static func format(_ lang: String, _ row: DayRow) -> RowText {
        let o = row.outage
        let overdue = row.status == .OVERDUE
        let finished = row.status == .FINISHED

        let startText = row.continuesFromPrevDay ? "00:00" : hhmm(row.from)
        let endText: String
        if overdue {
            endText = "--:--"
        } else if row.continuesToNextDay {
            endText = endWithDate(o.end)
        } else {
            endText = OutageEngine.formatSpanTime(row.to)
        }
        let timeText = "\(startText) – \(endText)"
        let durationText = overdue ? nil : AppStrings.durationText(lang, row.durationMinutes)
        let kindTag: String?
        switch o.kind {
        case .EMERGENCY: kindTag = AppStrings.kindEmergency(lang)
        case .REPAIR: kindTag = AppStrings.kindRepair(lang)
        case .PLANNED: kindTag = nil
        }
        let originTag = row.continuesFromPrevDay ? AppStrings.rowFromEarlier(lang, "\(dayMonth(o.start)) \(hhmm(o.start))") : nil
        let statusTag: String?
        switch row.status {
        case .FINISHED: statusTag = AppStrings.rowFinished(lang)
        case .OVERDUE: statusTag = AppStrings.rowOverdue(lang)
        default: statusTag = nil
        }
        let continueTag = o.mayContinue && !finished ? AppStrings.rowMayContinue(lang) : nil

        let description = [kindLabel(lang, o.kind), timeText, durationText, originTag, statusTag, continueTag]
            .compactMap { $0 }
            .joined(separator: ", ")

        return RowText(
            kind: o.kind,
            timeText: timeText,
            durationText: durationText,
            kindTag: kindTag,
            originTag: originTag,
            statusTag: statusTag,
            continueTag: continueTag,
            isFinished: finished,
            isEmergency: o.kind == .EMERGENCY,
            isRepair: o.kind == .REPAIR,
            accessibilityText: description
        )
    }

    /// 48 cells from `slots`: 48 half-hour slots, or 24 hourly slots (legacy, each used twice). Anything
    /// else yields nil (the drum shows the grey "unclear" bar).
    static func cells(_ slots: [BlackoutSlot]) -> [BlackoutSlot]? {
        switch slots.count {
        case 48: return slots
        case 24: return slots.flatMap { [$0, $0] }
        default: return nil
        }
    }

    /// Contiguous runs of off half-hours of a day as (first cell, last cell exclusive, any emergency).
    private static func runs(_ cells: [BlackoutSlot]) -> [(from: Int, to: Int, emergency: Bool)] {
        var out: [(from: Int, to: Int, emergency: Bool)] = []
        var start = -1
        var emergency = false
        for (i, c) in cells.enumerated() {
            if c.status == .POWER_OFF {
                if start < 0 {
                    start = i
                    emergency = false
                }
                if c.isEmergency { emergency = true }
            } else if start >= 0 {
                out.append((start, i, emergency))
                start = -1
            }
        }
        if start >= 0 { out.append((start, cells.count, emergency)) }
        return out
    }

    private static func cellTime(_ index: Int) -> String {
        let minutes = index * 30
        return minutes >= 1440 ? "24:00" : "\(p2(minutes / 60)):\(p2(minutes % 60))"
    }

    /// One VoiceOver sentence for the whole drum, replacing the 48 silent cells:
    /// "Шкала доби: без світла: 00:00 – 02:00, 10:00 – 12:00 (аварійне)".
    /// `unclearBase` is true when the schedule of the day is not known (grey drum).
    public static func drumSummary(_ lang: String, _ slots: [BlackoutSlot], unclearBase: Bool) -> String {
        let head = AppStrings.drumTitle(lang)
        guard let cells = cells(slots) else { return "\(head): \(AppStrings.outagesUnclear(lang))" }
        let found = runs(cells)
        let spans = found.map { r -> String in
            let text = "\(cellTime(r.from)) – \(cellTime(r.to))"
            return r.emergency ? "\(text) (\(AppStrings.drumEmergencyMark(lang)))" : text
        }.joined(separator: ", ")
        var parts: [String] = []
        if unclearBase { parts.append(AppStrings.outagesUnclear(lang)) }
        if !found.isEmpty {
            parts.append(AppStrings.drumPowerOffAt(lang, spans))
        } else if !unclearBase {
            parts.append(AppStrings.drumNoOutages(lang))
        }
        return "\(head): \(parts.joined(separator: "; "))"
    }
}
