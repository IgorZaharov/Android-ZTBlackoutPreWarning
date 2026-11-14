import XCTest
@testable import ZTPreBlackout

/// Runs spec/vectors/subscriptions.json (mirror of SubscriptionVectorsTest.kt).
final class SubscriptionVectorsTests: XCTestCase {

    private func load() throws -> J { try Vectors.load("subscriptions.json") }

    private func storeOf(_ o: J) -> SubscriptionStore { Subscriptions.repair(Subscriptions.fromMap(o)!).store }

    private func assertStore(_ expected: J, _ actual: SubscriptionStore, _ name: String, file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertEqual(canonicalJSON(expected), canonicalJSON(Subscriptions.toMap(actual)), name, file: file, line: line)
    }

    private func report(_ section: String, ran: Int, atLeast: Int) {
        print("[vectors] subscriptions.json \(section): \(ran) cases")
        XCTAssertGreaterThanOrEqual(ran, atLeast, "subscriptions.json \(section): too few cases ran")
    }

    func testLabels() throws {
        let v = try load().obj("labels")!
        var ran = 0
        for c in v.objs("defaultLabel") {
            let item: Subscription
            if let house = c.str("house") {
                item = Subscription(
                    id: "test0000",
                    address: SubscriptionAddress(remSlug: "zhytomyr", settlementId: "16657", streetId: "st_1",
                                                 streetName: c.str("streetName") ?? "", house: house, text: ""),
                    queue: "1.1"
                )
            } else {
                item = Subscription(id: "test0000", queue: c.str("queue"))
            }
            XCTAssertEqual(c.str("expect"), Subscriptions.defaultLabel(item), "\(c)")
            ran += 1
        }
        for c in v.objs("cleanLabel") {
            XCTAssertEqual(c.str("expect"), Subscriptions.cleanLabel(c.str("raw")), "\(c)")
            ran += 1
        }
        report("labels", ran: ran, atLeast: 18)
    }

    func testMigrate() throws {
        var ran = 0
        for c in try load().objs("migrate") {
            let name = c.str("name") ?? "?"
            let l = c.obj("legacy")!
            let legacy = LegacySettings(
                queue: l.str("queue")!,
                customQueueStatusText: l.str("customQueueStatusText"),
                selectedAddress: l.str("selectedAddress"),
                remSlug: l.str("remSlug")!,
                settlementId: l.str("settlementId")!,
                streetId: l.str("streetId")!,
                streetName: l.str("streetName"),
                house: l.str("house")!,
                notificationsEnabled: l.bool("notificationsEnabled")!,
                emergencyNotificationsEnabled: l.bool("emergencyNotificationsEnabled")!
            )
            let r = Subscriptions.migrate(legacy, newId: c.str("id")!, nowMs: (c["nowMs"] as! NSNumber).int64Value)
            XCTAssertEqual(c.bool("expectMaster"), r.alertsMaster, name)
            assertStore(c.obj("expect")!, r.store, name)
            XCTAssertEqual(r.store, Subscriptions.repair(r.store).store, "\(name): migration output is already repaired")
            if let label = c.str("expectDisplayLabel") {
                XCTAssertEqual(1, r.store.items.count, name)
                XCTAssertEqual(label, r.store.items.first.map(Subscriptions.displayLabel), name)
            }
            if let key = c.str("expectAddressKey") {
                XCTAssertEqual(key, r.store.items.first?.address?.key, name)
            }
            ran += 1
        }
        report("migrate", ran: ran, atLeast: 7)
    }

    func testRepair() throws {
        var ran = 0
        for c in try load().objs("repair") {
            let name = c.str("name") ?? "?"
            let parsed = Subscriptions.fromMap(c.obj("input"))
            if c.bool("expectAbsent") == true {
                XCTAssertNil(parsed, name)
                ran += 1
                continue
            }
            guard let parsed else {
                XCTFail("\(name): store unexpectedly absent")
                continue
            }
            let r = Subscriptions.repair(parsed)
            assertStore(c.obj("expect")!, r.store, name)
            let dropped = c.objs("expectDropped").map { DroppedItem(id: $0.str("id"), reason: $0.str("reason")!) }
            XCTAssertEqual(dropped, r.dropped, name)
            ran += 1
        }
        report("repair", ran: ran, atLeast: 5)
    }

    func testOps() throws {
        var ran = 0
        for c in try load().objs("ops") {
            let name = c.str("name") ?? "?"
            var store = storeOf(c.obj("start")!)
            for (i, s) in c.objs("steps").enumerated() {
                let op = s.str("op")!
                let label = "\(name), step \(i) \(op)"
                let id = s.str("id") ?? ""
                let result: StoreResult
                switch op {
                case "add": result = Subscriptions.add(store, Subscriptions.itemFromMap(s.obj("item")!))
                case "remove": result = Subscriptions.remove(store, id: id)
                case "setPrimary": result = Subscriptions.setPrimary(store, id: id)
                case "setPlanned": result = Subscriptions.setPlanned(store, id: id, on: s.bool("on")!)
                case "setEmergency": result = Subscriptions.setEmergency(store, id: id, on: s.bool("on")!)
                case "rename": result = Subscriptions.rename(store, id: id, raw: s.str("label"))
                case "move": result = Subscriptions.move(store, id: id, toIndex: s.int("toIndex")!)
                case "setQueueInfo":
                    result = Subscriptions.setQueueInfo(store, id: id, queue: s.str("queue"), statusText: s.str("statusText"),
                                                        addressText: s.str("addressText"))
                default:
                    XCTFail("unknown op in \(label)")
                    continue
                }
                let expectError = s.str("expectError")
                switch result {
                case .ok(let newStore):
                    XCTAssertNil(expectError, "\(label): expected error \(expectError ?? "")")
                    store = newStore
                case .error(let code, let existingId):
                    XCTAssertEqual(expectError, code, label)
                    XCTAssertEqual(s.str("expectExistingId"), existingId, label)
                }
                if s.has("expectPrimary") { XCTAssertEqual(s.str("expectPrimary"), store.primaryId, label) }
            }
            assertStore(c.obj("expect")!, store, name)
            if let labels = c.obj("expectDisplayLabels") {
                for (id, value) in labels {
                    let item = store.items.first { $0.id == id }
                    XCTAssertEqual(value as? String, item.map(Subscriptions.displayLabel), "\(name): \(id)")
                }
            }
            ran += 1
        }
        report("ops", ran: ran, atLeast: 4)
    }

    func testMirror() throws {
        var ran = 0
        for c in try load().objs("mirror") {
            let name = c.str("name") ?? "?"
            let m = Subscriptions.primaryMirror(storeOf(c.obj("store")!), master: c.bool("master")!)
            let e = c.obj("expect")!
            XCTAssertEqual(
                LegacyMirror(
                    queue: e.str("queue")!,
                    customQueueStatusText: e.str("customQueueStatusText"),
                    selectedAddress: e.str("selectedAddress"),
                    remSlug: e.str("remSlug")!,
                    settlementId: e.str("settlementId")!,
                    streetId: e.str("streetId")!,
                    house: e.str("house")!,
                    notificationsEnabled: e.bool("notificationsEnabled")!,
                    emergencyNotificationsEnabled: e.bool("emergencyNotificationsEnabled")!
                ),
                m,
                name
            )
            ran += 1
        }
        report("mirror", ran: ran, atLeast: 6)
    }

    func testEffective() throws {
        let v = try load().obj("effective")!
        var ran = 0
        for c in v.objs("items") {
            let item = Subscription(
                id: "test0000",
                address: c.bool("address")! ? SubscriptionAddress(remSlug: "zhytomyr", settlementId: "16657", streetId: "st_1",
                                                                  streetName: "вул. Лісова", house: "1", text: "") : nil,
                queue: c.str("queue"),
                plannedAlerts: c.bool("planned")!,
                emergencyAlerts: c.bool("emergency")!
            )
            let master = c.bool("master")!
            XCTAssertEqual(c.bool("expectPlanned"), Subscriptions.plannedActive(master: master, item: item), "\(c)")
            XCTAssertEqual(c.bool("expectEmergency"),
                           Subscriptions.emergencyActive(master: master, item: item, poweronIdsKnown: c.bool("poweronIdsKnown")!), "\(c)")
            ran += 1
        }
        for c in v.objs("anyAlertsEnabled") {
            let switches = c.array("switches") as? [[Any]] ?? []
            let items = switches.enumerated().map { i, pair in
                Subscription(id: "item000\(i)", queue: "1.1",
                             plannedAlerts: (pair[0] as! NSNumber).boolValue, emergencyAlerts: (pair[1] as! NSNumber).boolValue)
            }
            XCTAssertEqual(c.bool("expect"),
                           Subscriptions.anyAlertsEnabled(master: c.bool("master")!, store: SubscriptionStore(primaryId: items.first?.id, items: items)),
                           "\(c)")
            ran += 1
        }
        report("effective", ran: ran, atLeast: 12)
    }

    func testFanout() throws {
        let v = try load().obj("fanout")!
        var ran = 0
        for c in v.objs("alertOrder") {
            XCTAssertEqual(c.strings("expect"), Subscriptions.alertOrder(storeOf(c.obj("store")!)).map(\.id), c.str("name") ?? "?")
            ran += 1
        }
        for c in v.objs("groupAlerts") {
            let name = c.str("name") ?? "?"
            let store = storeOf(c.obj("store")!)
            var alerts: [String: [AlertSpec]] = [:]
            for (id, list) in c.obj("alerts")! {
                alerts[id] = ((list as? [Any]) ?? []).compactMap { $0 as? J }.map { a in
                    AlertSpec(
                        key: "planned_" + a.str("spanStart")!,
                        fireAt: ldt(a.str("fireAt"))!,
                        spanStart: ldt(a.str("spanStart"))!,
                        spanEnd: ldt(a.str("spanEnd"))!,
                        mayContinue: a.bool("mayContinue")!,
                        durationMinutes: a.int("durationMinutes")!
                    )
                }
            }
            let groups = Subscriptions.groupAlerts(store, master: c.bool("master")!, alertsById: alerts)
            let expected = c.objs("expect")
            XCTAssertEqual(expected.count, groups.count, name)
            for (e, g) in zip(expected, groups) {
                XCTAssertEqual(e.str("key"), g.key, name)
                XCTAssertEqual(e.str("queue"), g.queue, name)
                XCTAssertEqual(ldt(e.str("spanStart")), g.spanStart, name)
                XCTAssertEqual(ldt(e.str("spanEnd")), g.spanEnd, name)
                XCTAssertEqual(ldt(e.str("fireAt")), g.fireAt, name)
                XCTAssertEqual(e.int("durationMinutes"), g.durationMinutes, name)
                XCTAssertEqual(e.bool("mayContinue"), g.mayContinue, name)
                XCTAssertEqual(e.strings("memberIds"), g.memberIds, name)
                XCTAssertEqual(e.str("labels"), Subscriptions.alertLabels(store, memberIds: g.memberIds), name)
            }
            for pc in c.objs("pending") {
                let notified = Set(pc.strings("notified") ?? [])
                let exp = (pc.array("expect") as? [[Any]] ?? []).map { $0.compactMap { $0 as? String } }
                let got = groups.map { g in Subscriptions.pendingMembers(g) { notified.contains($0) } }
                XCTAssertEqual(exp, got, name)
            }
            ran += 1
        }
        for c in v.objs("alertLabels") {
            let store = storeOf(c.obj("store")!)
            for lc in c.objs("cases") {
                let ids = lc.strings("memberIds") ?? []
                XCTAssertEqual(lc.str("expect"), Subscriptions.alertLabels(store, memberIds: ids), "\(c.str("name") ?? "?") \(ids)")
            }
            ran += 1
        }
        report("fanout", ran: ran, atLeast: 8)
    }

    func testMainScreen() throws {
        let v = try load().obj("main")!
        var ran = 0
        for c in v.objs("switcherItems") {
            XCTAssertEqual(c.strings("expect"), Subscriptions.switcherItems(storeOf(c.obj("store")!)).map(\.id), c.str("name") ?? "?")
            ran += 1
        }
        for c in v.objs("viewItem") {
            let store = storeOf(c.obj("store")!)
            for vc in c.objs("cases") {
                let sel = vc.str("selectedId")
                XCTAssertEqual(vc.str("expect"), Subscriptions.viewItem(store, selectedId: sel)?.id, "\(c.str("name") ?? "?") \(sel ?? "nil")")
            }
            ran += 1
        }
        for c in v.objs("noAlertsCaption") {
            XCTAssertEqual(c.bool("expect"), Subscriptions.noAlertsCaption(master: c.bool("master")!, store: storeOf(c.obj("store")!)),
                           c.str("name") ?? "?")
            ran += 1
        }
        report("main", ran: ran, atLeast: 9)
    }

    func testWidgets() throws {
        let v = try load().obj("widget")!
        var ran = 0
        for c in v.objs("widgetItem") {
            let store = storeOf(c.obj("store")!)
            for vc in c.objs("cases") {
                let b = vc.str("boundId")
                XCTAssertEqual(vc.str("expect"), Subscriptions.widgetItem(store, boundId: b)?.id, "\(c.str("name") ?? "?") \(b ?? "nil")")
            }
            ran += 1
        }
        for c in v.objs("widgetLabel") {
            let store = storeOf(c.obj("store")!)
            for vc in c.objs("cases") {
                let b = vc.str("boundId")
                XCTAssertEqual(vc.str("expect"), Subscriptions.widgetLabel(store, boundId: b), "\(c.str("name") ?? "?") \(b ?? "nil")")
            }
            ran += 1
        }
        for c in v.objs("widgetItemIds") {
            let bound: [String?] = (c.array("boundIds") ?? []).map { $0 as? String }
            XCTAssertEqual(c.strings("expect"), Subscriptions.widgetItemIds(storeOf(c.obj("store")!), boundIds: bound), c.str("name") ?? "?")
            ran += 1
        }
        report("widget", ran: ran, atLeast: 8)
    }
}
