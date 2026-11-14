import XCTest
@testable import ZTPreBlackout

/// Runs the platform-neutral golden vectors in spec/vectors/ (mirror of SpecVectorsTest.kt and
/// tests/spec-vectors.test.ts). Each test asserts how many cases it executed, so an empty or
/// skipped file fails instead of passing silently.
final class SpecVectorsTests: XCTestCase {

    private func report(_ file: String, _ section: String, ran: Int, atLeast: Int) {
        print("[vectors] \(file) \(section): \(ran) cases")
        XCTAssertGreaterThanOrEqual(ran, atLeast, "\(file) \(section): too few cases ran")
    }

    // MARK: - outage_engine.json

    private func toMin(_ hhmm: String) -> Int {
        let p = hhmm.split(separator: ":").map { Int($0)! }
        return p[0] * 60 + p[1]
    }

    private func cells(_ ranges: [String]?) -> [Bool]? {
        guard let ranges else { return nil }
        var arr = [Bool](repeating: false, count: 48)
        for r in ranges {
            let ab = r.split(separator: "-").map(String.init)
            for k in (toMin(ab[0]) / 30)..<(toMin(ab[1]) / 30) { arr[k] = true }
        }
        return arr
    }

    private func rangesOf(_ flags: [Bool]) -> [String] {
        func fmt(_ slot: Int) -> String { slot == 48 ? "24:00" : String(format: "%02d:%02d", slot / 2, (slot % 2) * 30) }
        var out: [String] = []
        var start = -1
        for i in 0...flags.count {
            let on = i < flags.count && flags[i]
            if on && start < 0 { start = i }
            if !on && start >= 0 {
                out.append("\(fmt(start))-\(fmt(i))")
                start = -1
            }
        }
        return out
    }

    /// NOTIFICATIONS.md 2.4a: one continuous outage, one announcement.
    func testEmergencyDeliveryVectors() throws {
        let cases = try Vectors.load("outage_engine.json").objs("emergencyDelivery")
        var ran = 0
        for d in cases {
            let planned = d.objs("plannedSpans").map {
                Span(start: ldt($0.str("start"))!, end: ldt($0.str("end"))!, mayContinue: false, kinds: [.PLANNED])
            }
            let ev = d.obj("event")!
            let got = OutageEngine.emergencyDelivery(
                kind: EmergencyEventKind(rawValue: ev.str("kind")!)!,
                start: ldt(ev.str("start"))!,
                eta: ldt(ev.str("eta")),
                now: ldt(d.str("now"))!,
                plannedSpans: planned,
                plannedAlertsOn: d.bool("plannedAlertsOn")!
            )
            XCTAssertEqual(EmergencyDelivery(rawValue: d.str("expect")!), got, d.str("name") ?? "")
            ran += 1
        }
        report("outage_engine.json", "emergencyDelivery", ran: ran, atLeast: 12)
    }

    func testOutageEngineVectors() throws {
        let cases = try Vectors.load("outage_engine.json").objs("cases")
        var ran = 0
        for c in cases {
            let name = c.str("name") ?? "?"
            let today = ld(c.str("today")!)
            let now = ldt(c.str("now"))!
            let advance = c.int("advanceMinutes") ?? 15
            let p = c.obj("planned") ?? [:]

            var outages = OutageEngine.buildPlanned(
                today: today, todayOff: cells(p.strings("today")), tomorrowOff: cells(p.strings("tomorrow")),
                yesterdayOff: cells(p.strings("yesterday"))
            )
            for r in c.objs("repair") {
                outages.append(Outage(id: r.str("id")!, kind: .REPAIR, start: ldt(r.str("start"))!, end: ldt(r.str("end"))!))
            }
            for e in c.objs("emergencies") {
                let rec = EmergencyRecord(id: e.str("id")!, start: ldt(e.str("start"))!, estimatedEnd: ldt(e.str("estimatedEnd")),
                                          closedAt: ldt(e.str("closedAt")), label: e.str("label"))
                outages.append(OutageEngine.resolveEmergency(rec, now: now))
            }
            let window = OutageEngine.inWindow(outages, today: today)
            let expect = c.obj("expect")!

            if let s = expect.obj("status") {
                let st = OutageEngine.status(window, now: now)
                XCTAssertEqual(s.bool("isOffNow"), st.isOffNow, "\(name): isOffNow")
                XCTAssertEqual(s.str("countdownText"), st.countdownText, "\(name): countdownText")
                XCTAssertEqual(s.str("nextSlotTime"), st.nextSlotTime, "\(name): nextSlotTime")
            }

            if let exp = expect["spans"] as? [Any] {
                let spans = OutageEngine.spans(window.filter { !$0.stale })
                XCTAssertEqual(exp.count, spans.count, "\(name): span count")
                for (i, e) in exp.compactMap({ $0 as? J }).enumerated() where i < spans.count {
                    XCTAssertEqual(e.str("start"), spans[i].start.description, "\(name): span[\(i)].start")
                    XCTAssertEqual(e.str("end"), spans[i].end.description, "\(name): span[\(i)].end")
                    XCTAssertEqual(e.bool("mayContinue"), spans[i].mayContinue, "\(name): span[\(i)].mayContinue")
                }
            }

            if let exp = expect["alerts"] as? [Any] {
                let alerts = OutageEngine.planAlerts(window, now: now, advanceMinutes: advance)
                XCTAssertEqual(exp.count, alerts.count, "\(name): alert count")
                for (i, e) in exp.compactMap({ $0 as? J }).enumerated() where i < alerts.count {
                    XCTAssertEqual(e.str("key"), alerts[i].key, "\(name): alert[\(i)].key")
                    XCTAssertEqual(e.str("fireAt"), alerts[i].fireAt.description, "\(name): alert[\(i)].fireAt")
                    XCTAssertEqual(e.str("spanEnd"), alerts[i].spanEnd.description, "\(name): alert[\(i)].spanEnd")
                    XCTAssertEqual(e.int("durationMinutes"), alerts[i].durationMinutes, "\(name): alert[\(i)].durationMinutes")
                }
            }

            if let days = expect.obj("days") {
                for (dateKey, value) in days {
                    guard let d = value as? J else { continue }
                    let view = OutageEngine.dayView(window, date: ld(dateKey), now: now)
                    let tag = "\(name)/\(dateKey)"
                    if let total = d.int("totalOffMinutes") { XCTAssertEqual(total, view.totalOffMinutes, "\(tag): total") }
                    if let pc = d.strings("plannedCells") { XCTAssertEqual(pc, rangesOf(view.slots.map(\.planned)), "\(tag): plannedCells") }
                    if let ec = d.strings("emergencyCells") { XCTAssertEqual(ec, rangesOf(view.slots.map(\.emergency)), "\(tag): emergencyCells") }
                    if let rows = d["rows"] as? [Any] {
                        XCTAssertEqual(rows.count, view.rows.count, "\(tag): row count")
                        for (i, e) in rows.compactMap({ $0 as? J }).enumerated() where i < view.rows.count {
                            let r = view.rows[i]
                            let t = "\(tag): row[\(i)]"
                            if let v = e.str("kind") { XCTAssertEqual(v, r.outage.kind.rawValue, "\(t).kind") }
                            if let v = e.str("from") { XCTAssertEqual(v, r.from.description, "\(t).from") }
                            if let v = e.str("to") { XCTAssertEqual(v, r.to.description, "\(t).to") }
                            if let v = e.str("status") { XCTAssertEqual(v, r.status.rawValue, "\(t).status") }
                            if let v = e.bool("continuesFromPrevDay") { XCTAssertEqual(v, r.continuesFromPrevDay, "\(t).continuesFromPrevDay") }
                            if let v = e.bool("continuesToNextDay") { XCTAssertEqual(v, r.continuesToNextDay, "\(t).continuesToNextDay") }
                            if let v = e.int("durationMinutes") { XCTAssertEqual(v, r.durationMinutes, "\(t).durationMinutes") }
                            if let v = e.int("inDayMinutes") { XCTAssertEqual(v, r.inDayMinutes, "\(t).inDayMinutes") }
                        }
                    }
                }
            }
            ran += 1
        }
        report("outage_engine.json", "cases", ran: ran, atLeast: 26)
    }

    // MARK: - emergency_ledger.json

    func testEmergencyLedgerVectors() throws {
        let cases = try Vectors.load("emergency_ledger.json").objs("cases")
        var ran = 0
        for c in cases {
            let name = c.str("name") ?? "?"
            let addressKey = c.str("addressKey")!
            var entries: [LedgerEntry] = []
            for (stepIdx, step) in c.objs("steps").enumerated() {
                let now = ldt(step.str("now"))!
                let fetchJson = step.obj("fetch")!
                let fetch: EmergencyFetch = fetchJson.has("unavailable")
                    ? .unavailable("test")
                    : .confirmed(fetchJson.objs("confirmed").map {
                        EmergencyRecord(id: $0.str("id")!, start: ldt($0.str("start"))!, estimatedEnd: ldt($0.str("estimatedEnd")),
                                        closedAt: nil, label: $0.str("label"))
                    })
                let result = EmergencyLedger.reconcile(entries, fetch: fetch, now: now)
                entries = result.entries
                let expected = step.objs("events")
                XCTAssertEqual(expected.count, result.events.count, "\(name) step \(stepIdx): event count")
                for (i, e) in expected.enumerated() where i < result.events.count {
                    let ev = result.events[i]
                    XCTAssertEqual(e.str("kind"), ev.kind.rawValue, "\(name) step \(stepIdx): kind")
                    XCTAssertEqual(e.str("key"), ev.key(addressKey: addressKey), "\(name) step \(stepIdx): key")
                    if let v = e.bool("upcoming") { XCTAssertEqual(v, ev.upcoming, "\(name) step \(stepIdx): upcoming") }
                    if let v = e.bool("earlyEnd") { XCTAssertEqual(v, ev.earlyEnd, "\(name) step \(stepIdx): earlyEnd") }
                }
            }
            ran += 1
        }
        report("emergency_ledger.json", "cases", ran: ran, atLeast: 11)
    }

    // MARK: - address_keys.json

    func testAddressKeyVectors() throws {
        let v = try Vectors.load("address_keys.json")
        var ran = 0
        for g in v.array("streetEqual") ?? [] {
            let names = g as! [String]
            XCTAssertEqual(1, Set(names.map { StreetKey.of($0) }).count, "streetEqual \(names) -> \(names.map { StreetKey.of($0) })")
            ran += 1
        }
        for p in v.array("streetDistinct") ?? [] {
            let ab = p as! [String]
            XCTAssertNotEqual(StreetKey.of(ab[0]), StreetKey.of(ab[1]), "streetDistinct \(ab)")
            ran += 1
        }
        for g in v.array("houseEqual") ?? [] {
            let names = g as! [String]
            XCTAssertEqual(1, Set(names.map { HouseKey.of($0) }).count, "houseEqual \(names) -> \(names.map { HouseKey.of($0) })")
            ran += 1
        }
        for p in v.array("houseDistinct") ?? [] {
            let ab = p as! [String]
            XCTAssertNotEqual(HouseKey.of(ab[0]), HouseKey.of(ab[1]), "houseDistinct \(ab)")
            ran += 1
        }
        for c in v.objs("listContains") {
            XCTAssertEqual(c.bool("expect"), HouseKey.listContains(c.str("buildingNames")!, house: c.str("house")!),
                           "listContains \(c.str("buildingNames")!) / '\(c.str("house")!)'")
            ran += 1
        }
        // Checked directly by the Kotlin runner, not in JSON
        XCTAssertEqual("'", TextNorm.decodeEntities("&amp;#039;"))
        XCTAssertEqual("'", TextNorm.decodeEntities("&#39;"))
        XCTAssertEqual("'", TextNorm.decodeEntities("&#x27;"))
        XCTAssertEqual("a&b", TextNorm.decodeEntities("a&amp;b"))
        report("address_keys.json", "all groups", ran: ran, atLeast: 8 + 5 + 6 + 5 + 9)
    }

    // MARK: - poweron_api.json

    private func row(_ o: J) -> PowerOnRow {
        PowerOnRow(
            id: (o["id"] as! NSNumber).int64Value,
            cityId: o.int("cityId"),
            cityName: o.str("cityName") ?? "",
            streetId: o.int("streetId"),
            streetName: o.str("streetName") ?? "",
            dateEvent: o.str("dateEvent") ?? "",
            datePlanIn: o.str("datePlanIn") ?? "",
            koment: o.str("koment"),
            switchSubReason: o.int("switchSubReason"),
            typeOff: o.int("typeOff"),
            buildingNames: o.str("buildingNames") ?? ""
        )
    }

    func testPowerOnVectors() throws {
        let v = try Vectors.load("poweron_api.json")
        var ts = 0, em = 0, rp = 0
        for t in v.objs("timestamps") {
            let parsed = PowerOnMapper.parseTime(t.str("in"))
            XCTAssertEqual(t.str("out"), parsed?.description, "timestamp '\(t.str("in") ?? "nil")'")
            ts += 1
        }
        for c in v.objs("emergencyMapping") {
            let name = c.str("name") ?? "?"
            let got = PowerOnMapper.emergencyRecordsFor(c.objs("rows").map(row), house: c.str("house")!)
            let exp = c.objs("expect")
            XCTAssertEqual(exp.count, got.count, "\(name): count")
            for (i, e) in exp.enumerated() where i < got.count {
                XCTAssertEqual(e.str("id"), got[i].id, "\(name): id")
                XCTAssertEqual(e.str("start"), got[i].start.description, "\(name): start")
                XCTAssertEqual(e.str("estimatedEnd"), got[i].estimatedEnd?.description, "\(name): estimatedEnd")
                XCTAssertEqual(e.str("label"), got[i].label, "\(name): label")
            }
            em += 1
        }
        for c in v.objs("repairMapping") {
            let name = c.str("name") ?? "?"
            let got = PowerOnMapper.repairOutagesFor(c.objs("rows").map(row), house: c.str("house")!, today: ld(c.str("today")!))
            let exp = c.objs("expect")
            XCTAssertEqual(exp.count, got.count, "\(name): count")
            for (i, e) in exp.enumerated() where i < got.count {
                XCTAssertEqual(e.str("id"), got[i].id, "\(name): id")
                XCTAssertEqual(.REPAIR, got[i].kind, "\(name): kind")
                XCTAssertEqual(e.str("start"), got[i].start.description, "\(name): start")
                XCTAssertEqual(e.str("end"), got[i].end.description, "\(name): end")
                XCTAssertEqual(e.str("label"), got[i].label, "\(name): label")
            }
            rp += 1
        }
        report("poweron_api.json", "timestamps", ran: ts, atLeast: 9)
        report("poweron_api.json", "emergencyMapping", ran: em, atLeast: 7)
        report("poweron_api.json", "repairMapping", ran: rp, atLeast: 2)
    }

    // MARK: - site_state.json

    func testSiteStateVectors() throws {
        var ran = 0
        for c in try Vectors.load("site_state.json").objs("cases") {
            let got = SiteStateResolver.resolve(
                failure: FetchFailure(rawValue: c.str("failure")!)!,
                hasTodayTable: c.bool("hasTodayTable")!,
                networkValidated: c.bool("networkValidated")!
            )
            XCTAssertEqual(SiteState(rawValue: c.str("expect")!), got, "\(c)")
            ran += 1
        }
        report("site_state.json", "cases", ran: ran, atLeast: 12)
    }

    // MARK: - site_notice.json

    func testSiteNoticeVectors() throws {
        var ran = 0
        for c in try Vectors.load("site_notice.json").objs("cases") {
            XCTAssertEqual(c.str("expect"), SiteNotice.extract(c.str("html")!), c.str("name") ?? "?")
            ran += 1
        }
        report("site_notice.json", "cases", ran: ran, atLeast: 6)
    }

    // MARK: - Kyiv DST (spec/OUTAGE_ENGINE.md section 7), also covered by DST vectors above

    func testKyivDstRules() {
        // Autumn 2026-10-25: 03:00-04:00 happens twice; a 02:00-05:00 block lasts 4 h
        XCTAssertEqual(240, KyivTime.minutesBetween(ldt("2026-10-25T02:00")!, ldt("2026-10-25T05:00")!))
        // Spring 2027-03-28: 03:00-04:00 does not exist; a 02:00-05:00 block lasts 2 h
        XCTAssertEqual(120, KyivTime.minutesBetween(ldt("2027-03-28T02:00")!, ldt("2027-03-28T05:00")!))
        // Round trip outside transitions
        let t = ldt("2026-11-14T13:45")!
        XCTAssertEqual(t, KyivTime.localDateTime(of: KyivTime.date(of: t)))
    }

    func testLocalDateTimeTextMatchesJavaToString() {
        XCTAssertEqual("2026-11-13T23:00", ldt("2026-11-13T23:00")!.description)
        XCTAssertEqual("2026-11-13T23:00:01", ldt("2026-11-13T23:00")!.plusSeconds(1).description)
        XCTAssertEqual("2026-11-14T00:00", ldt("2026-11-13T23:30")!.plusMinutes(30).description)
        XCTAssertEqual("2028-02-29", LocalDate(year: 2028, month: 2, day: 28)!.plusDays(1).description)
        XCTAssertNil(LocalDate(year: 2027, month: 2, day: 29))
    }
}
