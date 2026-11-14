import SwiftUI

/// Interim screen of milestone M2 (docs/ios/IOS_PORT_PLAN.md): runs the real data layer against the
/// live sites and shows what it found, so CI screenshots prove the port end to end. M4 replaces it with
/// the 1.4.0 main, settings and about screens.
struct DataCheckScreen: View {
    @State private var site: SiteState?
    @State private var notice: String?
    @State private var tomorrowPublished = false
    @State private var queues: [(queue: String, today: String, tomorrow: String)] = []
    @State private var rems = 0
    @State private var settlements = 0
    @State private var status = "Loading…"

    var body: some View {
        NavigationStack {
            List {
                Section("ztoe.com.ua") {
                    LabeledContent("Site state", value: site?.rawValue ?? "…")
                    LabeledContent("Tomorrow published", value: tomorrowPublished ? "yes" : "no")
                    if let notice { Text(notice).font(.footnote) }
                }
                Section("Address index") {
                    LabeledContent("REMs", value: "\(rems)")
                    LabeledContent("Settlements of Житомирський РЕМ", value: "\(settlements)")
                }
                Section("Queues: off today / tomorrow") {
                    ForEach(queues, id: \.queue) { q in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(q.queue).font(.headline.monospacedDigit())
                            Text(q.today).font(.footnote.monospacedDigit())
                            Text(q.tomorrow).font(.footnote.monospacedDigit()).foregroundStyle(.secondary)
                        }
                    }
                }
                Section { Text(status).font(.footnote).foregroundStyle(.secondary) }
            }
            .navigationTitle(AppStrings.APP_NAME)
        }
        .task { await load() }
    }

    private func load() async {
        let settings = SettingsRepository.shared.getSettings()
        let queue = settings.queue.ktIsBlank ? "1.1" : settings.queue
        let result = await ZtoeParser.fetchFullSchedule(url: settings.cityUrl, queue: queue)
        site = result.siteState
        notice = result.notice
        tomorrowPublished = result.hasTomorrowSchedule

        let now = KyivTime.localDateTime(of: Date())
        let repo = ScheduleRepository.shared
        queues = UserSettings.ALL_QUEUES.map { q in
            let planned = OutageEngine.buildPlanned(today: now.date, todayOff: repo.todayOffCells(q), tomorrowOff: repo.tomorrowOffCells(q))
            func line(_ date: LocalDate) -> String {
                let rows = OutageEngine.dayView(planned, date: date, now: now).rows
                return rows.isEmpty ? "—" : rows.map { "\(OutageEngine.formatSpanTime($0.from)) – \(OutageEngine.formatSpanTime($0.to))" }.joined(separator: ", ")
            }
            return (q, line(now.date), line(now.date.plusDays(1)))
        }

        rems = ZtoeAddressLookup.getRems().count
        let zhytomyr = ZtoeAddressLookup.getRems().first { $0.id == "zhytomyr" }
        if let zhytomyr {
            settlements = await ZtoeAddressLookup.fetchSettlementsForRem(zhytomyr.id).count
        }
        status = "Updated \(OutageEngine.formatSpanTime(now)) Kyiv · failure: \(result.failure.rawValue)"
    }
}
