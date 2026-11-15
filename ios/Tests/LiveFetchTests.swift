import XCTest
@testable import ZTPreBlackout

/// Talks to the real sites. Runs only when the test runner has `ZT_LIVE=1` (CI passes
/// `TEST_RUNNER_ZT_LIVE=1`), so local and offline runs stay deterministic. Prints what it parsed, so the
/// CI log shows the live queue table (milestone M2 acceptance in docs/ios/IOS_PORT_PLAN.md).
final class LiveFetchTests: XCTestCase {

    override func setUpWithError() throws {
        try XCTSkipUnless(ProcessInfo.processInfo.environment["ZT_LIVE"] == "1", "live network tests are off")
    }

    func testLiveScheduleTable() async throws {
        ZtoeParser.clearMemoryCacheForTesting()
        let defaults = UserDefaults(suiteName: "zt.live.\(UUID().uuidString)")!
        let repo = ScheduleRepository(prefs: Prefs("zt_schedule_cache_v2", defaults: defaults))
        let res = await ZtoeParser.fetchFullSchedule(url: SettingsRepository.DEFAULT_URL, queue: "1.1", forceNetwork: true, repo: repo)
        print("[live] ztoe site state: \(res.siteState.rawValue), failure: \(res.failure.rawValue), tomorrow: \(res.hasTomorrowSchedule)")
        if let notice = res.notice { print("[live] notice: \(notice.replacingOccurrences(of: "\n", with: " | "))") }
        XCTAssertNotEqual(res.siteState, .SITE_UNREACHABLE, "ztoe.com.ua did not answer the CI runner")
        guard res.siteState == .AVAILABLE_WITH_TABLE else { return }
        let now = KyivTime.localDateTime(of: Date())
        for q in UserSettings.ALL_QUEUES {
            let planned = OutageEngine.buildPlanned(today: now.date, todayOff: repo.todayOffCells(q), tomorrowOff: repo.tomorrowOffCells(q))
            let rows = OutageEngine.dayView(planned, date: now.date, now: now).rows
            let text = rows.map { String(format: "%02d:%02d–%@", $0.from.hour, $0.from.minute, OutageEngine.formatSpanTime($0.to)) }
                .joined(separator: ", ")
            print("[live] \(q): \(text.isEmpty ? "no outages" : text)")
            XCTAssertNotNil(repo.todayOffCells(q), "queue \(q) missing from today's table")
        }
    }

    func testLivePowerOnAnswers() async throws {
        let target = PowerOnTarget(remOtgId: 6, settlementName: "м. Житомир", streetNames: ["вул. Київська"], house: "37")
        let now = KyivTime.localDateTime(of: Date())
        let result = await PowerOnClient().fetch(target, today: now.date, now: now)
        print("[live] PowerOn ids: \(String(describing: result.ids)), emergency: \(result.emergency), repairs: \(result.repairs?.count ?? -1)")
        XCTAssertEqual(result.ids?.cityIds.contains(333), true, "Zhytomyr is PowerOn city 333")
        if case .unavailable(let reason) = result.emergency { XCTFail("PowerOn unavailable: \(reason)") }
    }
}
