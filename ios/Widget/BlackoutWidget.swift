import SwiftUI
import WidgetKit

// Interim widget of milestone M2/M3: power state and countdown of the primary address from the shared
// data layer (local state only); the medium size also draws the shared drum (TimelineBar) on the
// time-of-day background, so the design layer is proven inside WidgetKit. M6 replaces it with the three
// 1.4.0 widgets (small, big, «Графік»).

struct BlackoutWidgetEntry: TimelineEntry {
    let date: Date
    let isOff: Bool
    let isUnclear: Bool
    let queue: String
    let next: String
    /// Today's 48 drum cells; empty when unclear.
    var slots: [BlackoutSlot] = []
    var hour = 12
    var minute = 0
}

struct BlackoutWidgetProvider: TimelineProvider {
    private func entry(at date: Date) -> BlackoutWidgetEntry {
        let settings = SettingsRepository.shared.getSettings()
        let snap = OutageRepository.shared.snapshot(settings, now: KyivTime.localDateTime(of: date))
        let st = snap.scheduleStatus()
        return BlackoutWidgetEntry(date: date, isOff: st.isBlackoutNow, isUnclear: st.isUnclear,
                                   queue: settings.queue, next: st.nextSlotTime,
                                   slots: snap.slotsFor(snap.today), hour: snap.now.hour, minute: snap.now.minute)
    }

    func placeholder(in context: Context) -> BlackoutWidgetEntry {
        BlackoutWidgetEntry(date: Date(), isOff: false, isUnclear: false, queue: "1.1", next: "18:00 – 21:00")
    }

    func getSnapshot(in context: Context, completion: @escaping (BlackoutWidgetEntry) -> Void) {
        completion(entry(at: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<BlackoutWidgetEntry>) -> Void) {
        // One entry now and one at every power transition of the next 24 hours (widgets cannot tick)
        let now = Date()
        let settings = SettingsRepository.shared.getSettings()
        let kyivNow = KyivTime.localDateTime(of: now)
        let outages = OutageRepository.shared.outagesFor(queue: settings.queue,
                                                          key: OutageRepository.shared.addressKey(settings.selectedAddressQuery),
                                                          now: kyivNow)
        let transitions = OutageEngine.transitions(outages, from: kyivNow, to: kyivNow.plusHours(24))
        let dates = [now] + transitions.map { KyivTime.date(of: $0.at) }.filter { $0 > now }
        let entries = dates.map { entry(at: $0) }
        completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(30 * 60))))
    }
}

struct BlackoutWidgetEntryView: View {
    let entry: BlackoutWidgetEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        let lang = AppStrings.resolveLang("SYSTEM")
        let status = Text(entry.isUnclear ? AppStrings.outagesUnclear(lang)
                          : entry.isOff ? AppStrings.widgetPowerOff(lang) : AppStrings.widgetPowerOn(lang))
            .ztText(ZtType.subhead)
            .foregroundStyle(entry.isUnclear ? ZtColors.statusUnclear : entry.isOff ? ZtColors.statusOff : ZtColors.statusOn)
        Group {
            if family == .systemMedium {
                // One info line above the drum: the drum alone is about 97 pt of the ~126 pt the widget has
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 8) {
                        status.lineLimit(1)
                        Spacer(minLength: 0)
                        Text(entry.next).ztText(ZtType.captionMono).foregroundStyle(ZtColors.textSecondary).lineLimit(1)
                    }
                    TimelineBar(slots: entry.slots, currentHour: entry.hour, currentMinute: entry.minute,
                                lang: lang, tickEvery: 6)
                }
            } else {
                VStack(alignment: .leading, spacing: 4) {
                    status
                    if !entry.queue.isEmpty {
                        Text(entry.queue).ztText(ZtType.captionMono).foregroundStyle(ZtColors.textPrimary)
                    }
                    Text(entry.next).ztText(ZtType.captionMono).foregroundStyle(ZtColors.textSecondary)
                }
            }
        }
        .containerBackground(for: .widget) {
            AmbientBackground(palette: TimeOfDayPalette.current(now: entry.date), frozenSeconds: 0)
        }
    }
}

@main
struct BlackoutWidget: Widget {
    let kind = "BlackoutWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: BlackoutWidgetProvider()) { entry in
            BlackoutWidgetEntryView(entry: entry)
        }
        .configurationDisplayName(AppStrings.APP_NAME)
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
