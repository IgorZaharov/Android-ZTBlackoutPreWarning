import SwiftUI
import UIKit

/// Design gallery of milestone M3 (docs/ios/IOS_PORT_PLAN.md section 6). Not reachable by users: the app
/// shows it only when launched with `-ZTGallery <page>`, which CI does to screenshot every component with
/// each glass recipe and on the darkest and the brightest time-of-day palette.
///
/// Launch arguments (read from the UserDefaults argument domain):
/// - `-ZTGallery components|drum|rows`
/// - `-ZTGlassMode automatic|fallback|solid` (solid = what Reduce Transparency shows)
/// - `-ZTGalleryTime HH:mm` Kyiv time of the background palette (default 02:00)
/// - `-ZTGalleryLang uk|en`
struct DesignGallery: View {
    enum Page: String, CaseIterable { case components, drum, rows }

    let page: Page
    let mode: ZtGlassMode
    let hour: Int
    let minute: Int
    let lang: String

    static func fromLaunchArguments() -> DesignGallery? {
        let d = UserDefaults.standard
        guard let raw = d.string(forKey: "ZTGallery") else { return nil }
        let time = (d.string(forKey: "ZTGalleryTime") ?? "02:00").split(separator: ":").compactMap { Int($0) }
        return DesignGallery(
            page: Page(rawValue: raw) ?? .components,
            mode: ZtGlassMode(rawValue: d.string(forKey: "ZTGlassMode") ?? "") ?? .automatic,
            hour: time.first ?? 2,
            minute: time.count > 1 ? time[1] : 0,
            lang: d.string(forKey: "ZTGalleryLang") == "en" ? "en" : "uk"
        )
    }

    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    private var render: ZtGlassRender {
        ZtGlassRender.resolve(mode: mode, reduceTransparency: reduceTransparency, liquidAvailable: ZtGlassRender.liquidAvailable)
    }

    var body: some View {
        ZStack {
            AmbientBackground(palette: TimeOfDayPalette.colors(hour: hour, minute: minute), frozenSeconds: 0)
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text(verbatim: "\(page.rawValue) · glass \(String(describing: render)) · \(String(format: "%02d:%02d", hour, minute)) · iOS \(UIDevice.current.systemVersion)")
                        .ztText(ZtType.caption)
                        .foregroundStyle(ZtColors.textSecondary)
                    switch page {
                    case .components: components
                    case .drum: drums
                    case .rows: rows
                    }
                }
                .padding(16)
            }
        }
        .environment(\.ztGlassMode, mode)
        .preferredColorScheme(.dark)
    }

    // MARK: - Page 1: cards, chips, buttons, type

    @Namespace private var glassNamespace

    private var components: some View {
        VStack(alignment: .leading, spacing: 16) {
            ZtGlassCard {
                VStack(alignment: .leading, spacing: 6) {
                    Text(verbatim: "Черга 5.2").ztText(ZtType.title).foregroundStyle(ZtColors.textPrimary)
                    Text(verbatim: AppStrings.widgetPowerOn(lang)).ztText(ZtType.overline).foregroundStyle(ZtColors.statusOn)
                    Text(verbatim: "01:25:07").ztText(ZtType.display).foregroundStyle(ZtColors.textPrimary)
                    Text(verbatim: "вул. Київська, 1 · Житомир").ztText(ZtType.caption).foregroundStyle(ZtColors.textSecondary)
                }
            }

            ZtGlassGroup(spacing: 8) {
                VStack(alignment: .leading, spacing: 8) {
                    Text(verbatim: AppStrings.siteStateWithTable(lang)).ztText(ZtType.label).ztGlassChip(.green)
                    Text(verbatim: AppStrings.siteStateNoTable(lang)).ztText(ZtType.label).ztGlassChip(.amber)
                    Text(verbatim: AppStrings.siteStateUnreachable(lang)).ztText(ZtType.label).ztGlassChip(.red)
                    Text(verbatim: AppStrings.siteStateNoInternet(lang)).ztText(ZtType.label).ztGlassChip(.grey)
                }
            }

            ZtGlassGroup(spacing: 12) {
                HStack(spacing: 8) {
                    ForEach(["Дім", "Робота", "Дача"], id: \.self) { name in
                        Text(verbatim: name)
                            .ztText(ZtType.label)
                            .foregroundStyle(ZtColors.textPrimary)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .ztGlassSurface(cornerRadius: 18, tint: name == "Дім" ? ZtColors.accent.opacity(0.55) : ZtColors.card)
                            .ztGlassID(name, in: glassNamespace)
                    }
                }
            }

            HStack(spacing: 12) {
                Button(AppStrings.refreshBtn(lang)) {}
                    .ztButtonStyle(.prominent)
                Button(AppStrings.testAlertBtn(lang)) {}
                    .ztButtonStyle(.regular)
            }

            ZtGlassCard(border: ZtChipTone.amber.text) {
                Text(verbatim: AppStrings.siteStateNoTable(lang))
                    .ztText(ZtType.body)
                    .foregroundStyle(ZtColors.textPrimary)
            }

            ZtGlassCard {
                VStack(alignment: .leading, spacing: 4) {
                    Text(verbatim: "display 44").ztText(ZtType.display)
                    Text(verbatim: "title 24").ztText(ZtType.title)
                    Text(verbatim: "heading 20").ztText(ZtType.heading)
                    Text(verbatim: "subhead 16").ztText(ZtType.subhead)
                    Text(verbatim: "body 16").ztText(ZtType.body)
                    Text(verbatim: "label 14").ztText(ZtType.label)
                    Text(verbatim: "caption 13").ztText(ZtType.caption).foregroundStyle(ZtColors.textSecondary)
                    Text(verbatim: "overline 12").ztText(ZtType.overline).foregroundStyle(ZtColors.textTertiary)
                    Text(verbatim: "10:00 – 12:00").ztText(ZtType.timeMono)
                    Text(verbatim: "2 год").ztText(ZtType.captionMono).foregroundStyle(ZtColors.accent)
                }
                .foregroundStyle(ZtColors.textPrimary)
            }
        }
    }

    // MARK: - Sample day (13.11: planned, repair, emergency over planned, emergency alone, over midnight)

    private static let today = LocalDate(year: 2026, month: 11, day: 13)!
    private static let now = LocalDateTime(year: 2026, month: 11, day: 13, hour: 12, minute: 40)!

    private static func at(_ day: Int, _ h: Int, _ m: Int = 0) -> LocalDateTime {
        LocalDateTime(year: 2026, month: 11, day: day, hour: h, minute: m)!
    }

    private static let outages: [Outage] = [
        Outage(id: "p1", kind: .PLANNED, start: at(13, 0), end: at(13, 2)),
        Outage(id: "p2", kind: .PLANNED, start: at(13, 10), end: at(13, 14)),
        Outage(id: "e1", kind: .EMERGENCY, start: at(13, 12), end: at(13, 16), endIsEstimate: true),
        Outage(id: "r1", kind: .REPAIR, start: at(13, 17), end: at(13, 18)),
        Outage(id: "e2", kind: .EMERGENCY, start: at(13, 20), end: at(13, 21, 30), endIsEstimate: true),
        Outage(id: "p3", kind: .PLANNED, start: at(13, 23), end: at(14, 1), mayContinue: true),
        Outage(id: "e3", kind: .EMERGENCY, start: at(14, 9), end: at(14, 11), endIsEstimate: true)
    ]

    /// The drum's input shape (same mapping as `OutageSnapshot.slotsFor`).
    private static func slots(_ date: LocalDate, only: Set<OutageKind>? = nil) -> [BlackoutSlot] {
        let list = only.map { kinds in outages.filter { kinds.contains($0.kind) } } ?? outages
        return OutageEngine.dayView(list, date: date, now: now).slots.enumerated().map { i, s in
            let start = i * 30
            let end = start + 30
            func hhmm(_ m: Int) -> String { m >= 1440 ? "24:00" : String(format: "%02d:%02d", m / 60, m % 60) }
            return BlackoutSlot(
                id: "\(date)_\(hhmm(start))", startHour: start / 60, endHour: end / 60, startMinute: start % 60,
                endMinute: end % 60, startTimeStr: hhmm(start), endTimeStr: hhmm(end),
                status: s.off ? .POWER_OFF : .POWER_ON, isEmergency: s.emergency, isPlanned: s.planned
            )
        }
    }

    private func caption(_ s: String) -> some View {
        Text(verbatim: s).ztText(ZtType.overline).foregroundStyle(ZtColors.textTertiary)
    }

    // MARK: - Page 2: drum states

    private var drums: some View {
        VStack(alignment: .leading, spacing: 16) {
            ZtGlassCard {
                VStack(alignment: .leading, spacing: 10) {
                    caption("13.11 · needle 12:40 · planned, emergency over planned, repair, emergency")
                    TimelineBar(slots: Self.slots(Self.today), currentHour: 12, currentMinute: 40, lang: lang)
                }
            }
            ZtGlassCard {
                VStack(alignment: .leading, spacing: 10) {
                    caption("14.11 · table not published · PowerOn emergency 09:00-11:00 on grey")
                    TimelineBar(
                        slots: Self.slots(Self.today.plusDays(1), only: [.EMERGENCY, .REPAIR]),
                        showNeedle: false, lang: lang, unclearBase: true
                    )
                }
            }
            ZtGlassCard {
                VStack(alignment: .leading, spacing: 10) {
                    caption("no data")
                    TimelineBar(slots: [], showNeedle: false, lang: lang)
                }
            }
            ZtGlassCard {
                VStack(alignment: .leading, spacing: 10) {
                    caption("widget ticks every 6 h")
                    TimelineBar(slots: Self.slots(Self.today), currentHour: 12, currentMinute: 40, lang: lang, tickEvery: 6)
                        .frame(width: 300)
                }
            }
        }
    }

    // MARK: - Page 3: outage rows

    private var rows: some View {
        VStack(alignment: .leading, spacing: 16) {
            ForEach([Self.today, Self.today.plusDays(1)], id: \.self) { date in
                ZtGlassCard {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(verbatim: date == Self.today ? AppStrings.blackoutHoursForDayHeader(lang) : AppStrings.blackoutHoursForTomorrowHeader(lang))
                            .ztText(ZtType.overline)
                            .foregroundStyle(ZtColors.textSecondary)
                        ForEach(OutageEngine.dayView(Self.outages, date: date, now: Self.now).rows, id: \.self) { row in
                            OutageRowView(OutageRowFormat.format(lang, row))
                        }
                    }
                }
            }
        }
    }
}
