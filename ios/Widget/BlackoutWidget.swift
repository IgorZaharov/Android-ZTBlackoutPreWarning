import AppIntents
import SwiftUI
import WidgetKit

// The three 1.4.0 widgets (plan milestone M6; Android widget/BlackoutGlanceWidget.kt): Small (status,
// countdown, buttons), Big (medium and large: buttons, countdown, drum; the large one adds the next
// outage and today's rows) and «Графік» (info line and drum). Each widget shows its own address
// (`SelectAddressIntent`, default: follow the primary). The views and intents are in ios/Shared/Widget.

struct BlackoutEntry: TimelineEntry {
    let date: Date
    let model: WidgetModel
    let master: Bool
    let refreshing: Bool
}

struct BlackoutProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> BlackoutEntry {
        entries(for: SelectAddressIntent(), dates: [Date()]).first!
    }

    func snapshot(for configuration: SelectAddressIntent, in context: Context) async -> BlackoutEntry {
        entries(for: configuration, dates: [Date()]).first!
    }

    /// Widgets can not tick: one entry every minute for the next 90 minutes (the countdown has minutes,
    /// no seconds) and one at every power transition of the next 48 hours; then WidgetKit asks again.
    /// The app reloads all timelines after every refresh and settings change.
    func timeline(for configuration: SelectAddressIntent, in context: Context) async -> Timeline<BlackoutEntry> {
        let now = Date()
        WidgetDiag.log("timeline \(context.family)")
        let source = WidgetModelBuilder.source(boundId: configuration.boundId, at: now)
        let kyivNow = KyivTime.localDateTime(of: now)
        let transitions = OutageEngine.transitions(source.snapshot.outages, from: kyivNow, to: kyivNow.plusHours(48))
        let dates = WidgetModelBuilder.entryDates(now: now, transitions: transitions)
        return Timeline(entries: entries(for: configuration, dates: dates, source: source), policy: .after(now.addingTimeInterval(90 * 60)))
    }

    private func entries(for configuration: SelectAddressIntent, dates: [Date], source: WidgetModelBuilder.Source? = nil) -> [BlackoutEntry] {
        let src = source ?? WidgetModelBuilder.source(boundId: configuration.boundId, at: dates.first ?? Date())
        let master = SubscriptionSync.shared.master()
        let refreshing = WidgetState.isRefreshing()
        return dates.map { BlackoutEntry(date: $0, model: src.model(at: $0), master: master, refreshing: refreshing) }
    }
}

/// A tap opens the main screen with the widget's address shown (spec/SUBSCRIPTIONS.md 9 and 10).
private func openURL(_ itemId: String?) -> URL {
    var c = URLComponents()
    c.scheme = "svitlozt"
    c.host = "open"
    if let itemId { c.queryItems = [URLQueryItem(name: "item", value: itemId)] }
    return c.url!
}

struct SmallEntryView: View {
    let entry: BlackoutEntry
    @Environment(\.widgetRenderingMode) private var mode

    var body: some View {
        SmallWidgetView(model: entry.model, master: entry.master, refreshing: entry.refreshing, look: WidgetLook(mode))
            .widgetURL(openURL(entry.model.itemId))
            .containerBackground(for: .widget) { WidgetBackground(date: entry.date) }
    }
}

struct BigEntryView: View {
    let entry: BlackoutEntry
    @Environment(\.widgetRenderingMode) private var mode
    @Environment(\.widgetFamily) private var family

    var body: some View {
        BigWidgetView(model: entry.model, master: entry.master, refreshing: entry.refreshing, look: WidgetLook(mode),
                      large: family == .systemLarge)
            .widgetURL(openURL(entry.model.itemId))
            .containerBackground(for: .widget) { WidgetBackground(date: entry.date) }
    }
}

struct StripEntryView: View {
    let entry: BlackoutEntry
    @Environment(\.widgetRenderingMode) private var mode

    var body: some View {
        StripWidgetView(model: entry.model, look: WidgetLook(mode))
            .widgetURL(openURL(entry.model.itemId))
            .containerBackground(for: .widget) { WidgetBackground(date: entry.date) }
    }
}

struct BlackoutSmallWidget: Widget {
    // the interim widget's kind, so a widget placed from an earlier build keeps working
    let kind = "BlackoutWidget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: kind, intent: SelectAddressIntent.self, provider: BlackoutProvider()) { entry in
            SmallEntryView(entry: entry)
        }
        .configurationDisplayName(AppStrings.APP_NAME)
        .description("СВІТЛО Є / СВІТЛА НЕМАЄ, відлік і сповіщення")
        .supportedFamilies([.systemSmall])
    }
}

struct BlackoutBigWidget: Widget {
    let kind = "BlackoutBigWidget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: kind, intent: SelectAddressIntent.self, provider: BlackoutProvider()) { entry in
            BigEntryView(entry: entry)
        }
        .configurationDisplayName(AppStrings.APP_NAME)
        .description("Відлік, шкала доби та сповіщення")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

struct BlackoutStripWidget: Widget {
    let kind = "BlackoutStripWidget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: kind, intent: SelectAddressIntent.self, provider: BlackoutProvider()) { entry in
            StripEntryView(entry: entry)
        }
        .configurationDisplayName("Графік")
        .description("Шкала доби")
        .supportedFamilies([.systemMedium])
    }
}

@main
struct BlackoutWidgets: WidgetBundle {
    var body: some Widget {
        BlackoutSmallWidget()
        BlackoutBigWidget()
        BlackoutStripWidget()
    }
}
