import XCTest
@testable import ZTPreBlackout

/// The iOS notification adapter (plan milestone M5, spec/NOTIFICATIONS.md): planned pre-warnings from the
/// shared vectors become pending requests at the right Kyiv time, the window keeps the earliest 40, the
/// diff touches only our identifiers, and emergency events follow the gating and continuity rules.
final class NotificationPlannerTests: XCTestCase {
    private let nb = "\u{00A0}"
    private let item = Subscription(id: "aaaa1111", queue: "5.1", queueSource: .MANUAL, createdAtMs: 1)
    private var store: SubscriptionStore { SubscriptionStore(primaryId: item.id, items: [item]) }

    private func at(_ s: String) -> LocalDateTime { LocalDateTime(iso: s)! }

    private func cells(_ ranges: [String]?) -> [Bool]? {
        guard let ranges else { return nil }
        var out = [Bool](repeating: false, count: 48)
        for r in ranges {
            let parts = r.split(separator: "-").map { $0.split(separator: ":").compactMap { Int($0) } }
            let from = parts[0][0] * 2 + parts[0][1] / 30
            let to = parts[1][0] * 2 + parts[1][1] / 30
            for i in from..<min(to, 48) { out[i] = true }
        }
        return out
    }

    /// The window of an outage_engine.json case, built like SpecVectorsTests does.
    private func window(_ c: J, now: LocalDateTime) -> [Outage] {
        let today = ld(c.str("today")!)
        let p = c.obj("planned") ?? [:]
        var outages = OutageEngine.buildPlanned(
            today: today, todayOff: cells(p.strings("today")), tomorrowOff: cells(p.strings("tomorrow")),
            yesterdayOff: cells(p.strings("yesterday"))
        )
        for r in c.objs("repair") {
            outages.append(Outage(id: r.str("id")!, kind: .REPAIR, start: at(r.str("start")!), end: at(r.str("end")!)))
        }
        for e in c.objs("emergencies") {
            let rec = EmergencyRecord(id: e.str("id")!, start: at(e.str("start")!), estimatedEnd: e.str("estimatedEnd").map(at),
                                      closedAt: e.str("closedAt").map(at), label: e.str("label"))
            outages.append(OutageEngine.resolveEmergency(rec, now: now))
        }
        return OutageEngine.inWindow(outages, today: today)
    }

    /// Every vector case with expected alerts: the pending set holds exactly those alerts, in order, at
    /// the vector's Kyiv fire time, with the start time in the text.
    func testVectorAlertPlansBecomeThePendingSet() throws {
        let cases = try Vectors.load("outage_engine.json").objs("cases")
        var ran = 0
        for c in cases {
            guard let expected = c.obj("expect")?["alerts"] as? [Any] else { continue }
            let name = c.str("name") ?? "?"
            let now = at(c.str("now")!)
            let outages = window(c, now: now)
            let groups = NotificationPlanner.plannedGroups(store: store, master: true, now: now, advanceMinutes: c.int("advanceMinutes") ?? 15) { _ in outages }
            let alerts = NotificationPlanner.plannedAlerts(groups, store: store, lang: "uk", sound: true, notified: { _ in false })
            let exp = expected.compactMap { $0 as? J }
            XCTAssertEqual(alerts.count, exp.count, "\(name): pending count")
            for (a, e) in zip(alerts, exp) {
                XCTAssertEqual(a.fireAt?.description, e.str("fireAt"), "\(name): fireAt")
                XCTAssertTrue(a.identifier.hasPrefix(NotificationPlanner.PLANNED_PREFIX), "\(name): identifier \(a.identifier)")
                XCTAssertEqual(a.category, .planned)
                XCTAssertEqual(a.subscriptionId, item.id)
                // the trigger reads back as the same Kyiv wall-clock time
                let comps = NotificationPlanner.triggerComponents(a.fireAt!)
                XCTAssertEqual(comps.timeZone?.identifier, "Europe/Kyiv")
                XCTAssertEqual(NotificationPlanner.localDateTime(comps), a.fireAt, "\(name): trigger")
                // the span start of the vector key ("planned_2026-11-13T14:00") is in the text as HH:mm
                let spanStart = at(String(e.str("key")!.dropFirst("planned_".count)))
                XCTAssertTrue(a.body.contains(String(format: "о %02d:%02d", spanStart.hour, spanStart.minute)), "\(name): \(a.body)")
            }
            ran += 1
        }
        print("[vectors] NotificationPlanner: \(ran) outage_engine cases with alerts")
        XCTAssertGreaterThanOrEqual(ran, 8)
    }

    func testTextIsThePlannedBodyWithTheAdvanceNotice() {
        let g = PlannedGroup(key: "planned_q5.1_2026-11-13T23:00_2026-11-14T01:00", queue: "5.1",
                             fireAt: at("2026-11-13T22:45"), spanStart: at("2026-11-13T23:00"), spanEnd: at("2026-11-14T01:00"),
                             mayContinue: false, durationMinutes: 120, memberIds: [item.id])
        let a = NotificationPlanner.plannedAlerts([g], store: store, lang: "uk", sound: false, notified: { _ in false })
        XCTAssertEqual(a.first?.title, "Попередження: відключення світла")
        XCTAssertEqual(a.first?.body, "Черга 5.1: відключення о 23:00 (через 15\(nb)хв), орієнтовно до 01:00 (2\(nb)год).")
        XCTAssertEqual(a.first?.sound, false)
        XCTAssertEqual(a.first?.memberKeys, ["planned_aaaa1111_2026-11-13T23:00"])
    }

    func testWindowKeepsTheEarliestFortyAndSkipsWarnedGroups() {
        let base = at("2026-11-13T00:00")
        let groups = (0..<50).map { i -> PlannedGroup in
            let start = LocalDateTime(year: 2026, month: 11, day: 13 + i / 24, hour: i % 24, minute: 30)!
            return PlannedGroup(key: "planned_q5.1_\(start)", queue: "5.1", fireAt: start, spanStart: start,
                                spanEnd: start, mayContinue: false, durationMinutes: 30, memberIds: [item.id])
        }
        XCTAssertTrue(base < groups[0].fireAt)
        let all = NotificationPlanner.plannedAlerts(groups, store: store, lang: "uk", sound: true, notified: { _ in false })
        XCTAssertEqual(all.count, NotificationPlanner.MAX_PENDING_PLANNED)
        XCTAssertEqual(all.map(\.identifier), groups.prefix(40).map(\.key))

        // the first group was delivered earlier (or 1.4.0 recorded its address-independent key)
        let warned: Set<String> = [Subscriptions.memberKey(id: item.id, spanStart: groups[0].spanStart),
                                   Subscriptions.legacyAlertKey(spanStart: groups[1].spanStart)]
        let rest = NotificationPlanner.plannedAlerts(groups, store: store, lang: "uk", sound: true, notified: { warned.contains($0) })
        XCTAssertEqual(rest.first?.identifier, groups[2].key)
        XCTAssertEqual(rest.count, 40)
    }

    func testDiffTouchesOnlyOurIdentifiers() {
        func alert(_ id: String, _ t: String, body: String = "b") -> LocalAlert {
            LocalAlert(identifier: id, fireAt: at(t), title: "t", body: body, category: .planned, thread: "x",
                       subscriptionId: nil, sound: true, memberKeys: [])
        }
        let pending: [String: NotificationPlanner.Pending] = [
            "planned_keep": .init(fireAt: at("2026-11-13T10:00"), body: "b", sound: true),
            "planned_moved": .init(fireAt: at("2026-11-13T11:00"), body: "b", sound: true),
            "planned_gone": .init(fireAt: at("2026-11-13T12:00"), body: "b", sound: true),
            "planned_text": .init(fireAt: at("2026-11-13T13:00"), body: "old", sound: true),
            "planned_quiet": .init(fireAt: at("2026-11-13T14:00"), body: "b", sound: false),
            "block_2026-11-13_10": .init(fireAt: at("2026-11-13T09:45"), body: "1.3.5", sound: true),
            "emerg_start_addr_2026-11-13T09:00": .init(fireAt: nil, body: "e", sound: true),
            "test_alert": .init(fireAt: nil, body: "t", sound: true),
        ]
        let desired = [
            alert("planned_keep", "2026-11-13T10:00"),
            alert("planned_moved", "2026-11-13T11:15"),
            alert("planned_text", "2026-11-13T13:00", body: "new"),
            alert("planned_quiet", "2026-11-13T14:00"),
            alert("planned_new", "2026-11-13T15:00"),
        ]
        let d = NotificationPlanner.diff(pending: pending, desired: desired)
        XCTAssertEqual(d.remove, ["block_2026-11-13_10", "planned_gone", "planned_moved", "planned_quiet", "planned_text"])
        XCTAssertEqual(d.add.map(\.identifier), ["planned_moved", "planned_text", "planned_quiet", "planned_new"])
    }

    // MARK: - Emergency events

    private func batch(_ events: [EmergencyEvent], planned: [Span] = [], plannedOn: Bool = true, alertsOn: Bool = true) -> EmergencyBatch {
        EmergencyBatch(addressKey: "addr", subscriptionId: item.id, addressLine: "вул. Київська, 1", events: events,
                       plannedSpans: planned, plannedAlertsOn: plannedOn, alertsOn: alertsOn)
    }

    private func deliver(_ b: EmergencyBatch, settings: UserSettings = UserSettings(), now: String = "2026-11-13T12:00",
                         registry: inout Set<String>) -> [LocalAlert] {
        var marked = registry
        let out = NotificationPlanner.emergencyAlerts(b, settings: settings, lang: "uk", now: at(now), sound: true,
                                                      fired: { marked.contains($0) }, markFired: { marked.insert($0) })
        registry = marked
        return out
    }

    func testEmergencyStartIsAnnouncedOnceWithTheAddress() {
        var reg = Set<String>()
        let start = EmergencyEvent(kind: .START, entryId: "1", start: at("2026-11-13T11:50"), eta: at("2026-11-13T15:00"))
        let a = deliver(batch([start]), registry: &reg)
        XCTAssertEqual(a.count, 1)
        XCTAssertEqual(a.first?.identifier, "emerg_start_addr_2026-11-13T11:50")
        XCTAssertEqual(a.first?.title, "Аварійне відключення")
        XCTAssertEqual(a.first?.body, "Початок: 11:50. Орієнтовне відновлення: 15:00.\nвул. Київська, 1")
        XCTAssertNil(a.first?.fireAt)
        XCTAssertEqual(a.first?.category, .emergency)
        XCTAssertTrue(deliver(batch([start]), registry: &reg).isEmpty, "the fired registry stops a repeat")
    }

    func testFollowUpSwitchesAndAddressSwitch() {
        var reg = Set<String>()
        var settings = UserSettings()
        settings.emergencyEtaAlerts = false
        let change = EmergencyEvent(kind: .ETA_CHANGED, entryId: "1", start: at("2026-11-13T11:00"), eta: at("2026-11-13T16:00"))
        XCTAssertTrue(deliver(batch([change]), settings: settings, registry: &reg).isEmpty)
        XCTAssertTrue(reg.contains("emerg_change_addr_2026-11-13T11:00_2026-11-13T16:00"), "a dropped event is not replayed")

        let start = EmergencyEvent(kind: .START, entryId: "2", start: at("2026-11-13T11:30"), eta: nil)
        XCTAssertTrue(deliver(batch([start], alertsOn: false), registry: &reg).isEmpty)
    }

    func testOneContinuousOutageIsAnnouncedOnce() {
        var reg = Set<String>()
        let planned = [Span(start: at("2026-11-13T10:00"), end: at("2026-11-13T14:00"), mayContinue: false, kinds: [.PLANNED])]
        // starts inside a warned block and outlasts it: announced as a later restoration
        let prolong = EmergencyEvent(kind: .START, entryId: "1", start: at("2026-11-13T11:00"), eta: at("2026-11-13T17:00"))
        let p = deliver(batch([prolong], planned: planned), registry: &reg)
        XCTAssertEqual(p.first?.title, "Змінився час відновлення")
        XCTAssertEqual(p.first?.body, "Нове орієнтовне відновлення: 17:00.\nвул. Київська, 1")
        // ends while the scheduled block still holds the power off: dropped
        let end = EmergencyEvent(kind: .END, entryId: "3", start: at("2026-11-13T10:30"), eta: at("2026-11-13T11:30"))
        XCTAssertTrue(deliver(batch([end], planned: planned), registry: &reg).isEmpty)
    }

    func testEarlyEndAndDatesAreRelativeToToday() {
        var reg = Set<String>()
        let end = EmergencyEvent(kind: .END, entryId: "1", start: at("2026-11-12T23:00"), eta: at("2026-11-14T01:00"), earlyEnd: true)
        let a = deliver(batch([end]), registry: &reg)
        XCTAssertEqual(a.first?.title, "Аварійне відключення скасовано")
        XCTAssertEqual(a.first?.body, "Відключення зникло зі списку до завтра 01:00: світло, імовірно, вже є.\nвул. Київська, 1")
        let today = LocalDate(year: 2026, month: 11, day: 13)!
        XCTAssertEqual(NotificationPlanner.formatWhen("uk", at("2026-11-12T23:00"), today: today), "вчора 23:00")
        XCTAssertEqual(NotificationPlanner.formatWhen("en", at("2026-11-15T07:05"), today: today), "15.11 07:05")
    }
}
