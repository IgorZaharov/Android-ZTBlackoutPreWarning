import XCTest
@testable import ZTPreBlackout

/// Fake HTTP for the data-layer tests: answers by URL substring, records every request.
final class FakeHttp: HttpClient, @unchecked Sendable {
    private let lock = NSLock()
    private var _urls: [String] = []
    private let routes: [(String, HttpResponse)]
    private let failOn: String?
    private let error: Error

    init(_ routes: [(String, HttpResponse)], failOn: String? = nil, error: Error = URLError(.timedOut)) {
        self.routes = routes
        self.failOn = failOn
        self.error = error
    }

    convenience init(json routes: [(String, String)], failOn: String? = nil) {
        self.init(routes.map { ($0.0, HttpResponse(status: 200, body: Data($0.1.utf8))) }, failOn: failOn)
    }

    var urls: [String] { lock.lock(); defer { lock.unlock() }; return _urls }

    func send(_ request: URLRequest) async throws -> HttpResponse {
        let url = request.url?.absoluteString ?? ""
        lock.lock(); _urls.append(url); lock.unlock()
        if let failOn, url.contains(failOn) { throw error }
        return routes.first { url.contains($0.0) }?.1 ?? HttpResponse(status: 200, body: Data("[]".utf8))
    }
}

private func isolatedDefaults() -> UserDefaults {
    let name = "zt.tests.\(UUID().uuidString)"
    return UserDefaults(suiteName: name)!
}

private func fixture(_ name: String) throws -> Data {
    let bundle = Bundle(for: FakeHttp.self)
    guard let url = bundle.url(forResource: name, withExtension: "html") else {
        throw NSError(domain: "fixture", code: 1, userInfo: [NSLocalizedDescriptionKey: "missing fixture \(name)"])
    }
    return try Data(contentsOf: url)
}

private let fixtureDay = LocalDate(year: 2026, month: 11, day: 14)!

/// Off-cells of the live page of 2026-11-14 (Tests/Fixtures/ztoe_schedule_live.html), computed by an
/// independent script that applies the Kotlin rules (ZtoeParser.parseTableForQueue).
private let fixtureExpected: [String: String] = [
    "1.1": "000011111100000011110000001111110000001111110000",
    "1.2": "111100000000000011110000001111110000001111110000",
    "2.1": "000000111111000000000000000000001111110000001111",
    "2.2": "111111000000001111110000000000001111110000001111",
    "3.1": "111111000000111100001111110000001111110000000000",
    "3.2": "111111000000111100001111110000001111110000000000",
    "4.1": "000000000000111100001111110000001111110000001111",
    "4.2": "000000000000111100001111110000001111110000001111",
    "5.1": "000000000000000011110000001111110000001111110000",
    "5.2": "000000000000000011110000001111110000001111110000",
    "6.1": "000000111111000000001111110000000000001111110000",
    "6.2": "000000111111000000000000001111110000001111110000"
]

private func bits(_ cells: [Bool]?) -> String? { cells.map { String($0.map { $0 ? "1" : "0" }) } }

final class ZtoeParserTests: XCTestCase {

    func testLivePageAllTwelveQueues() throws {
        let html = Cp1251.decode(try fixture("ztoe_schedule_live"))
        let all = ZtoeParser.parseAllQueuesSinglePass(html, today: fixtureDay)
        XCTAssertEqual(Set(all.keys), Set(UserSettings.ALL_QUEUES))
        for (q, expected) in fixtureExpected {
            XCTAssertEqual(bits(all[q]?.todayOff), expected, "queue \(q)")
            XCTAssertNil(all[q]?.tomorrowOff, "queue \(q): the page had no tomorrow table")
        }
        // The page is dated 14.11.2026: on another day it is not today's table
        XCTAssertTrue(ZtoeParser.parseAllQueuesSinglePass(html, today: fixtureDay.plusDays(1)).isEmpty)
    }

    /// Port of ZtoeParserTest "today and tomorrow tables" with the 1.4.0 engine in place of the 1.3 calculator.
    func testTodayAndTomorrowTablesAndNextOutageAfterLastOneOfToday() {
        let queues = UserSettings.ALL_QUEUES
        func table(_ date: String, _ off: ClosedRange<Int>) -> String {
            let header = (0..<48).map { "<td>\($0)</td>" }.joined()
            let rows = queues.map { q in
                "<tr><td>1</td><td>\(q)</td>" + (0..<48).map { "<td style=\"background: \(off.contains($0) ? "#ff0000" : "#ffffff");\"></td>" }.joined() + "</tr>"
            }.joined(separator: "\n")
            return "<table>\n<tr><td colspan=\"50\">Графік погодинних відключень на \(date)</td></tr>\n<tr><td>Черга</td><td>Підчерга</td>\(header)</tr>\n\(rows)\n</table>"
        }
        let today = LocalDate(year: 2026, month: 11, day: 2)!
        let html = "<html><body>\(table("02.11.2026", 16...19))\(table("03.11.2026", 28...33))</body></html>"
        let parsed = ZtoeParser.parseDocumentFull(html, queue: "1.1", today: today)
        XCTAssertTrue(parsed.hasTomorrowSchedule)
        XCTAssertEqual(parsed.todayOff?.indices.filter { parsed.todayOff![$0] }, Array(16...19))
        XCTAssertEqual(parsed.tomorrowOff?.indices.filter { parsed.tomorrowOff![$0] }, Array(28...33))

        let outages = OutageEngine.buildPlanned(today: today, todayOff: parsed.todayOff, tomorrowOff: parsed.tomorrowOff)
        let st = OutageEngine.status(outages, now: LocalDateTime(iso: "2026-11-02T21:00")!)
        XCTAssertFalse(st.isOffNow)
        XCTAssertEqual(st.nextSlotTime, "14:00 – 17:00")
        XCTAssertEqual(st.countdownText, "17:00:00")
    }

    func testRedCellsAndTextMarkersButNeverWhite() {
        typealias C = ZtoeParser.Cell
        XCTAssertTrue(ZtoeParser.isCellOff(C(isHeader: false, attrs: "style=\"background:#FF3333\"", html: "")))
        XCTAssertTrue(ZtoeParser.isCellOff(C(isHeader: false, attrs: "bgcolor=red class=x", html: "")) == false)
        XCTAssertTrue(ZtoeParser.isCellOff(C(isHeader: false, attrs: "class=\"cell danger\"", html: "")))
        XCTAssertTrue(ZtoeParser.isCellOff(C(isHeader: false, attrs: "", html: "<b>Вимк</b>")))
        XCTAssertFalse(ZtoeParser.isCellOff(C(isHeader: false, attrs: "style=\"background:#ffffff\"", html: "")))
    }

    func testValidUrls() {
        XCTAssertTrue(ZtoeParser.isValidUrl("https://www.ztoe.com.ua/unhooking-search.php"))
        XCTAssertTrue(ZtoeParser.isValidUrl(" https://www.ztoe.com.ua/unhooking-search.php/ "))
        XCTAssertFalse(ZtoeParser.isValidUrl("https://malicious-site.org/unhooking.php"))
        XCTAssertFalse(ZtoeParser.isValidUrl(""))
    }
}

final class ScheduleRepositoryTests: XCTestCase {
    private var day = fixtureDay

    private func repo(_ defaults: UserDefaults) -> ScheduleRepository {
        ScheduleRepository(prefs: Prefs("zt_schedule_cache_v2", defaults: defaults), today: { [unowned self] in self.day })
    }

    func testFetchCachesAllQueuesAndFailureKeepsCache() async throws {
        ZtoeParser.clearMemoryCacheForTesting()
        let defaults = isolatedDefaults()
        let r = repo(defaults)
        let page = try fixture("ztoe_schedule_live")
        let ok = FakeHttp([("unhooking-search.php", HttpResponse(status: 200, headers: ["etag": "\"abc\""], body: page))])
        let at = KyivTime.date(of: LocalDateTime(iso: "2026-11-14T12:00")!)

        let res = await ZtoeParser.fetchFullSchedule(url: "https://www.ztoe.com.ua/unhooking-search.php", queue: "2.1",
                                                     forceNetwork: true, repo: r, http: ok, now: at)
        XCTAssertEqual(res.status, .SUCCESS)
        XCTAssertEqual(res.siteState, .AVAILABLE_WITH_TABLE)
        XCTAssertEqual(bits(res.todayOff), fixtureExpected["2.1"])
        for (q, expected) in fixtureExpected { XCTAssertEqual(bits(r.todayOffCells(q)), expected, "cached \(q)") }
        XCTAssertFalse(r.hasTomorrowSchedule("2.1"))
        XCTAssertEqual(r.etag, "\"abc\"")

        ZtoeParser.clearMemoryCacheForTesting()
        let down = FakeHttp([], failOn: "ztoe", error: URLError(.timedOut))
        let failed = await ZtoeParser.fetchFullSchedule(url: "https://www.ztoe.com.ua/unhooking-search.php", queue: "2.1",
                                                        forceNetwork: true, repo: r, http: down, now: at)
        XCTAssertEqual(failed.status, .NO_INTERNET)
        XCTAssertEqual(failed.failure, .TIMEOUT)
        XCTAssertEqual(bits(r.todayOffCells("2.1")), fixtureExpected["2.1"], "a failed refresh never clears the cache")
    }

    func testPageWithoutTableReportsNoTableAndNotice() async {
        ZtoeParser.clearMemoryCacheForTesting()
        let r = repo(isolatedDefaults())
        let html = "<html><body><h3>УВАГА! ВАЖЛИВА ІНФОРМАЦІЯ!<br>Графіки погодинних відключень наразі не діють</h3></body></html>"
        let http = FakeHttp([("unhooking", HttpResponse(status: 200, body: html.data(using: .windowsCP1251)!))])
        let res = await ZtoeParser.fetchFullSchedule(url: "https://www.ztoe.com.ua/unhooking-search.php", queue: "1.1",
                                                     forceNetwork: true, repo: r, http: http,
                                                     now: KyivTime.date(of: LocalDateTime(iso: "2026-11-14T12:00")!))
        XCTAssertEqual(res.siteState, .AVAILABLE_NO_TABLE)
        XCTAssertEqual(res.notice, "УВАГА! ВАЖЛИВА ІНФОРМАЦІЯ!\nГрафіки погодинних відключень наразі не діють")
    }

    func testMidnightPromotesTomorrowAndArchivesYesterday() {
        let r = repo(isolatedDefaults())
        let todayCells = (0..<48).map { $0 < 4 }
        let tomorrowCells = (0..<48).map { $0 >= 44 }
        r.saveAllSchedulesBatch(["1.1": (today: todayCells, tomorrow: tomorrowCells)], activeQueue: "1.1")
        XCTAssertEqual(r.todayOffCells("1.1"), todayCells)
        XCTAssertEqual(r.tomorrowOffCells("1.1"), tomorrowCells)

        day = day.plusDays(1)
        XCTAssertEqual(r.todayOffCells("1.1"), tomorrowCells, "tomorrow becomes today after midnight")
        XCTAssertEqual(r.yesterdayOffCells("1.1"), todayCells, "the old today stays as yesterday's tail")
        XCTAssertNil(r.tomorrowOffCells("1.1"))

        day = day.plusDays(1)
        XCTAssertNil(r.todayOffCells("1.1"), "a two-day-old table is not today's")
    }
}

final class SettingsRepositoryTests: XCTestCase {
    func testDefaultsAndOldIosKeysAreMigrated() {
        let defaults = isolatedDefaults()
        let fresh = SettingsRepository(prefs: Prefs("zt_user_settings_v1", bareKeys: true, defaults: defaults)).getSettings()
        XCTAssertEqual(fresh.advanceNoticeMinutes, 15)
        XCTAssertEqual(fresh.refreshIntervalMinutes, 30)
        XCTAssertEqual(fresh.language, "SYSTEM")

        let old = isolatedDefaults()
        old.set(20, forKey: "advance_notice_minutes")
        old.set(45, forKey: "refresh_interval_minutes")
        old.set("system", forKey: "theme")
        old.set("en", forKey: "language")
        old.set("07.04 19:21", forKey: "active_emergency_outage_start")
        let s = SettingsRepository(prefs: Prefs("zt_user_settings_v1", bareKeys: true, defaults: old)).getSettings()
        XCTAssertEqual(s.advanceNoticeMinutes, 20)
        XCTAssertEqual(s.refreshIntervalMinutes, 45)
        XCTAssertEqual(s.themeMode, "SYSTEM")
        XCTAssertEqual(s.language, "EN")
        XCTAssertNil(old.object(forKey: "advance_notice_minutes"))
        XCTAssertEqual(old.integer(forKey: "advance_minutes"), 20)
        XCTAssertNil(old.object(forKey: "active_emergency_outage_start"))
    }

    func testBothSwitchesOffMuteSoundAndRestoreIt() {
        let repo = SettingsRepository(prefs: Prefs("zt_user_settings_v1", bareKeys: true, defaults: isolatedDefaults()))
        var s = repo.getSettings()
        s.soundEnabled = false
        s.vibrationEnabled = true
        repo.saveSettings(s)
        _ = repo.updateNotificationsEnabled(false)
        let off = repo.updateEmergencyNotificationsEnabled(false)
        XCTAssertFalse(off.soundEnabled)
        XCTAssertFalse(off.vibrationEnabled)
        let on = repo.updateNotificationsEnabled(true)
        XCTAssertFalse(on.soundEnabled, "restored to the remembered value")
        XCTAssertTrue(on.vibrationEnabled)
    }
}

/// Port of android PowerOnClientTest.kt. URLs are compared percent-decoded (iOS writes `[]` as `%5B%5D`).
final class PowerOnClientTests: XCTestCase {
    private let today = LocalDate(year: 2026, month: 11, day: 12)!
    private let now = LocalDateTime(iso: "2026-11-12T23:57")!

    private func accident(_ streetId: Int, _ street: String, _ city: String, _ building: String, _ start: String, _ end: String, sub: Int = 0) -> String {
        "{\"id\":1,\"city\":{\"id\":333,\"name\":\"\(city)\"},\"street\":{\"id\":\(streetId),\"name\":\"\(street)\"},\"dateEvent\":\"\(start)\",\"datePlanIn\":\"\(end)\",\"koment\":\"МО\",\"switchSubReason\":\(sub),\"typeOff\":1,\"buildingNames\":\"\(building)\"}"
    }

    private func decoded(_ url: String) -> String { url.removingPercentEncoding ?? url }

    func testResolvesCityThenAllMergedStreetIdsAndQueriesWithDottedFilters() async {
        let http = FakeHttp(json: [
            ("pw_cities?name=", "[{\"id\":333,\"name\":\"Житомир\"}]"),
            ("pw_streets?city.id=333", "[{\"id\":33382,\"name\":\"вул. Закам’янська\"},{\"id\":33565,\"name\":\"вул. Закам'янська\"},{\"id\":1,\"name\":\"вул. Київська\"}]"),
            ("pw_accidents", "[" + accident(33565, "вул. Закам'янська", "Житомир", "5, 7", "2026-11-12T20:00:00+00:00", "2026-11-13T01:00:00+00:00") + "]"),
            ("pw_accident_planeds", "[]")
        ])
        let target = PowerOnTarget(remOtgId: 6, settlementName: "місто Житомир", streetNames: ["вул. Закам'янська", "вул. Закам’янська"], house: "5")
        let result = await PowerOnClient(http: http).fetch(target, today: today, now: now)
        XCTAssertEqual(result.ids?.cityIds, [333])
        XCTAssertEqual(result.ids?.streetIds, [33382, 33565])
        guard case let .confirmed(records) = result.emergency else { return XCTFail("expected confirmed") }
        XCTAssertEqual(records.map(\.id), ["pw_2026-11-12T20:00"])

        let urls = http.urls
        XCTAssertTrue(urls[0].contains("pw_cities?name=%D0%96%D0%B8%D1%82%D0%BE%D0%BC%D0%B8%D1%80&otg.id=6&pagination=false"), urls[0])
        let accidents = decoded(urls.first { $0.contains("pw_accidents") }!)
        XCTAssertTrue(accidents.contains("street.id[]=33382&street.id[]=33565"), accidents)
        XCTAssertTrue(accidents.contains("switchSubReason[]=0&switchSubReason[]=1&switchSubReason[]=3"), accidents)
        XCTAssertTrue(accidents.hasSuffix("pagination=false"), accidents)
        let legacy = Rx("[?&](city|street|otg|code_otg)=")
        XCTAssertTrue(urls.allSatisfy { legacy.firstMatch(in: decoded($0)) == nil })
        let planeds = decoded(urls.first { $0.contains("pw_accident_planeds") }!)
        XCTAssertTrue(planeds.contains("datePlanIn[after]=2026-11-12"), planeds)
    }

    func testCachedIdsSkipResolution() async {
        let http = FakeHttp(json: [("pw_accidents", "[]"), ("pw_accident_planeds", "[]")])
        let target = PowerOnTarget(remOtgId: 6, settlementName: "м. Житомир", streetNames: ["вул. Київська"], house: "37",
                                   cachedCityIds: [333], cachedStreetIds: [1])
        _ = await PowerOnClient(http: http).fetch(target, today: today, now: now)
        XCTAssertTrue(http.urls.allSatisfy { !$0.contains("pw_cities") && !$0.contains("pw_streets") })
        XCTAssertTrue(decoded(http.urls[0]).contains("street.id[]=1"))
    }

    func testFailedAccidentsRequestIsUnavailableNotNoOutage() async {
        let http = FakeHttp(json: [("pw_accident_planeds", "[]")], failOn: "pw_accidents")
        let target = PowerOnTarget(remOtgId: 6, settlementName: "м. Житомир", streetNames: ["вул. Київська"], house: "37",
                                   cachedCityIds: [333], cachedStreetIds: [1])
        let result = await PowerOnClient(http: http).fetch(target, today: today, now: now)
        guard case .unavailable = result.emergency else { return XCTFail("expected unavailable") }
        XCTAssertEqual(result.repairs, [])
    }

    func testFailedPlannedWorksKeepEmergenciesConfirmedAndRepairsUnknown() async {
        let http = FakeHttp(json: [("pw_accidents", "[]")], failOn: "pw_accident_planeds")
        let target = PowerOnTarget(remOtgId: 6, settlementName: "м. Житомир", streetNames: ["вул. Київська"], house: "37",
                                   cachedCityIds: [333], cachedStreetIds: [1])
        let result = await PowerOnClient(http: http).fetch(target, today: today, now: now)
        guard case .confirmed = result.emergency else { return XCTFail("expected confirmed") }
        XCTAssertNil(result.repairs)
    }

    func testResolutionFailureIsUnavailable() async {
        let http = FakeHttp(json: [], failOn: "pw_cities")
        let target = PowerOnTarget(remOtgId: 6, settlementName: "м. Житомир", streetNames: ["вул. Київська"], house: "37")
        let result = await PowerOnClient(http: http).fetch(target, today: today, now: now)
        guard case .unavailable = result.emergency else { return XCTFail("expected unavailable") }
    }

    func testCityScopeFallbackFiltersRowsByStreetKey() async {
        let http = FakeHttp(json: [
            ("pw_cities?name=", "[{\"id\":502,\"name\":\"Липники\"}]"),
            ("pw_streets?city.id=502", "[{\"id\":9,\"name\":\"вул. Інша\"}]"),
            ("pw_accidents", "[" +
                accident(62411, "вул. Лісна", "Липники", "10", "2026-11-12T20:00:00+00:00", "2026-11-13T01:00:00+00:00") + "," +
                accident(62412, "вул. Польова", "Липники", "10", "2026-11-12T21:00:00+00:00", "2026-11-13T02:00:00+00:00") + "]"),
            ("pw_accident_planeds", "[]")
        ])
        let target = PowerOnTarget(remOtgId: 7, settlementName: "с. Липники", streetNames: ["вул. Лісна"], house: "10")
        let result = await PowerOnClient(http: http).fetch(target, today: today, now: now)
        guard case let .confirmed(records) = result.emergency else { return XCTFail("expected confirmed") }
        XCTAssertEqual(records.map(\.id), ["pw_2026-11-12T20:00"])
        XCTAssertTrue(decoded(http.urls.first { $0.contains("pw_accidents") }!).contains("city.id[]=502"))
    }

    func testParsesPlainArrayAndHydraCollections() {
        let row = accident(1, "вул. Київська", "Житомир", "37", "2026-11-12T20:00:00+00:00", "2026-11-13T01:00:00+00:00")
        let plain = PowerOnClient.parseRows(Data("[\(row)]".utf8))
        let hydra = PowerOnClient.parseRows(Data("{\"hydra:member\":[\(row)],\"hydra:totalItems\":1}".utf8))
        XCTAssertEqual(plain.count, 1)
        XCTAssertEqual(plain, hydra)
        XCTAssertEqual(plain[0].streetName, "вул. Київська")
        XCTAssertEqual(plain[0].cityId, 333)
        XCTAssertEqual(plain[0].switchSubReason, 0)
        XCTAssertEqual(PowerOnClient.parseRows(Data("not json".utf8)), [])
    }

    func testCityKeyIgnoresPrefixApostropheAndCase() {
        XCTAssertEqual(PowerOnClient.cityKey("місто Житомир"), PowerOnClient.cityKey("Житомир"))
        XCTAssertEqual(PowerOnClient.cityKey("с. Кам&#039;янка"), PowerOnClient.cityKey("Кам’янка"))
    }
}

final class StoresTests: XCTestCase {
    func testOutageStateRoundTripAndSiteNoticeRule() {
        let file = "test_outage_\(UUID().uuidString).json"
        let store = OutageStateStore(prefs: Prefs("zt_outage_state_test", defaults: isolatedDefaults()), fileName: file)
        defer { AppGroup.removeFile(file) }
        let t = LocalDateTime(iso: "2026-11-14T10:00")!
        let entry = LedgerEntry(id: "pw_2026-11-14T09:00", start: t.minusHours(1), estimatedEnd: t.plusHours(2), label: "МО",
                                firstSeen: t, lastSeen: t, closedAt: nil, startEmitted: true, endEmitted: false, lastEmittedEta: t.plusHours(2))
        store.saveLedger("16657|вул київська|37", [entry])
        XCTAssertEqual(store.ledger("16657|вул київська|37"), [entry])
        store.saveRepairs("k", [Outage(id: "repair_x", kind: .REPAIR, start: t, end: t.plusHours(3), label: nil)])
        XCTAssertEqual(store.repairs("k").map(\.id), ["repair_x"])
        store.saveIds("k", PowerOnIds(cityIds: [333], streetIds: [1, 2]), nowMs: 42)
        XCTAssertEqual(store.ids("k")?.ids.streetIds, [1, 2])
        XCTAssertEqual(store.ids("k")?.resolvedAtMs, 42)

        store.saveSite(.AVAILABLE_NO_TABLE, nowMs: 1, notice: "УВАГА")
        XCTAssertEqual(store.site()?.notice, "УВАГА")
        store.saveSite(.SITE_UNREACHABLE, nowMs: 2)
        XCTAssertNil(store.site()?.notice, "the notice is shown only while the page has no table")
        store.saveSite(.AVAILABLE_WITH_TABLE, nowMs: 3)
        XCTAssertEqual(store.site()?.lastSuccessMs, 3)

        store.saveLedger("16657|вул київська|37", [])
        XCTAssertEqual(store.ledger("16657|вул київська|37"), [])
    }

    func testSubscriptionMigrationRunsOnceAndRoundTrips() {
        let prefs = Prefs("zt_user_settings_v1", bareKeys: true, defaults: isolatedDefaults())
        var counter = 0
        let repo = SubscriptionRepository(prefs: prefs, clock: { 1000 }, random: { counter += 1; return "item000\(counter)" })
        var legacyCalls = 0
        let legacy = LegacySettings(queue: "2.1", customQueueStatusText: nil, selectedAddress: nil, remSlug: "", settlementId: "",
                                    streetId: "", streetName: nil, house: "", notificationsEnabled: true, emergencyNotificationsEnabled: false)
        let first = repo.ensureMigrated { legacyCalls += 1; return legacy }
        XCTAssertEqual(first.items.map(\.queue), ["2.1"])
        XCTAssertTrue(repo.alertsMaster())
        _ = repo.ensureMigrated { legacyCalls += 1; return legacy }
        XCTAssertEqual(legacyCalls, 1, "the migration runs once")
        XCTAssertEqual(SubscriptionRepository.decode(SubscriptionRepository.encode(first)), first)
        XCTAssertNil(SubscriptionRepository.decode("{\"schemaVersion\":2}"))
    }

    func testAlertRegistryMarksOnceAndBoundsEntries() {
        var now: Int64 = 1_000_000_000_000
        let registry = AlertRegistry(prefs: Prefs("zt_notified_test", defaults: isolatedDefaults()), nowMs: { now })
        XCTAssertFalse(registry.hasFired("planned_2026-11-14T18:00"))
        registry.markFired("planned_2026-11-14T18:00")
        XCTAssertTrue(registry.hasFired("planned_2026-11-14T18:00"))
        for i in 0..<(AlertRegistry.MAX_STORED_ENTRIES + 5) {
            now += 1
            registry.markFired("k\(i)")
        }
        XCTAssertFalse(registry.hasFired("planned_2026-11-14T18:00"), "the oldest entry is evicted")
        XCTAssertTrue(registry.hasFired("k\(AlertRegistry.MAX_STORED_ENTRIES + 4)"))
    }
}
