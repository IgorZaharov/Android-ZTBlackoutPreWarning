import SwiftUI
import WidgetKit

// Interim widget of milestone M2: power state and countdown of the primary address from the shared
// data layer (local state only). M6 replaces it with the three 1.4.0 widgets (small, big, «Графік»).

struct BlackoutWidgetEntry: TimelineEntry {
    let date: Date
    let isOff: Bool
    let isUnclear: Bool
    let queue: String
    let next: String
}

struct BlackoutWidgetProvider: TimelineProvider {
    private func entry(at date: Date) -> BlackoutWidgetEntry {
        let settings = SettingsRepository.shared.getSettings()
        let snap = OutageRepository.shared.snapshot(settings, now: KyivTime.localDateTime(of: date))
        let st = snap.scheduleStatus()
        return BlackoutWidgetEntry(date: date, isOff: st.isBlackoutNow, isUnclear: st.isUnclear,
                                   queue: settings.queue, next: st.nextSlotTime)
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

    var body: some View {
        let lang = AppStrings.resolveLanguage("SYSTEM")
        VStack(alignment: .leading, spacing: 4) {
            Text(entry.isUnclear ? AppStrings.schedulesUnclear(lang)
                 : entry.isOff ? AppStrings.widgetPowerOff(lang) : AppStrings.widgetPowerOn(lang))
                .font(.headline)
                .foregroundStyle(entry.isUnclear ? Color.gray : entry.isOff ? Color.red : Color.green)
            if !entry.queue.isEmpty {
                Text(entry.queue).font(.caption.monospacedDigit())
            }
            Text(entry.next).font(.caption2.monospacedDigit()).foregroundStyle(.secondary)
        }
        .containerBackground(for: .widget) { Color.black }
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
