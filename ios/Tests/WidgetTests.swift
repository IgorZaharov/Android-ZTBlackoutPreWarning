import XCTest
@testable import ZTPreBlackout

/// Widgets (plan milestone M6, spec/SUBSCRIPTIONS.md 10): the widget drum shows the same 48 states as the
/// main screen's drum, the countdown has no seconds, and the model follows Android `buildWidgetModel`.
final class WidgetTests: XCTestCase {
    private let today = LocalDate(year: 2026, month: 11, day: 13)!

    private func at(_ day: Int, _ h: Int, _ m: Int = 0) -> LocalDateTime {
        LocalDateTime(year: 2026, month: 11, day: day, hour: h, minute: m)!
    }

    private func off(_ ranges: [(Int, Int)]) -> [Bool] {
        var cells = [Bool](repeating: false, count: 48)
        for (a, b) in ranges { for i in a..<b { cells[i] = true } }
        return cells
    }

    /// Planned 08:00-10:00 and 13:00-16:00 today, 01:00-03:00 tomorrow, an emergency 15:00-17:00.
    private func snapshot(now: LocalDateTime, queue: String = "5.2", tomorrow: Bool = true) -> OutageSnapshot {
        var outages = OutageEngine.buildPlanned(today: today, todayOff: off([(16, 20), (26, 32)]),
                                                tomorrowOff: tomorrow ? off([(2, 6)]) : nil)
        outages.append(OutageEngine.resolveEmergency(EmergencyRecord(id: "e1", start: at(13, 15), estimatedEnd: at(13, 17)), now: now))
        return OutageSnapshot(now: now, queue: queue, outages: OutageEngine.inWindow(outages, today: today), plannedKnown: true,
                              tomorrowPublished: tomorrow, site: nil, poweron: nil, hasAddress: true)
    }

    /// CLAUDE.md invariant: the main timeline and the big widget produce identical 48 half-hour states.
    func testWidgetDrumShowsTheSame48StatesAsTheMainDrum() {
        let snap = snapshot(now: at(13, 12, 40))
        let m = WidgetModelBuilder.build(queue: "5.2", statusText: nil, snapshot: snap, lang: "uk")
        let mainSlots = snap.slotsFor(snap.today)
        XCTAssertEqual(m.slots, mainSlots)
        let widgetCells = DrumGeometry.cells(m.slots)
        let mainCells = DrumGeometry.cells(mainSlots)
        XCTAssertEqual(widgetCells?.count, 48)
        XCTAssertEqual(widgetCells, mainCells)
        // 15:00-16:00 is planned with an emergency on top, 16:00-17:00 emergency only
        XCTAssertEqual(widgetCells?[30], DrumCell(planned: true, emergency: true))
        XCTAssertEqual(widgetCells?[32], DrumCell(planned: false, emergency: true))
        // the tinted look tells off from on by opacity
        XCTAssertEqual(WidgetDrum.tintedAlpha(DrumCell(planned: true, emergency: false)), 1)
        XCTAssertLessThan(WidgetDrum.tintedAlpha(DrumCell(planned: false, emergency: false)), 0.5)
    }

    func testCountdownHasNoSeconds() {
        XCTAssertEqual(WidgetModelBuilder.formatCountdown("01:02:03", lang: "uk"), "01г. 02хв.")
        XCTAssertEqual(WidgetModelBuilder.formatCountdown("01:02:03", lang: "en"), "01hr. 02m.")
        XCTAssertEqual(WidgetModelBuilder.formatCountdown("--:--:--", lang: "uk"), "--г. --хв.")
        XCTAssertEqual(WidgetModelBuilder.formatCountdown("1:05:00", lang: "uk"), "01г. 05хв.")
    }

    func testModelFollowsBuildWidgetModel() {
        // at 12:40 the power is on, the next outage is 13:00, today
        let on = WidgetModelBuilder.build(queue: "5.2", statusText: nil, snapshot: snapshot(now: at(13, 12, 40)), lang: "uk", label: "Київська 1")
        XCTAssertEqual(on.queueHeader, "Черга 5.2")
        XCTAssertFalse(on.isOffNow)
        XCTAssertEqual(on.countdown, "00г. 20хв.")
        XCTAssertEqual(on.nextOutage, "13:00 – 17:00")
        XCTAssertEqual(on.addressLabel, "Київська 1")
        XCTAssertFalse(on.rows.isEmpty)

        // at 20:00 nothing more today (the emergency went stale an hour after its 17:00 estimate): the next is tomorrow
        let evening = WidgetModelBuilder.build(queue: "5.2", statusText: nil, snapshot: snapshot(now: at(13, 20)), lang: "uk")
        XCTAssertEqual(evening.nextOutage, "Завтра 01:00 – 03:00")

        // no tomorrow table and the day is over: "Відключень немає" in the period
        let quiet = WidgetModelBuilder.build(queue: "5.2", statusText: nil, snapshot: snapshot(now: at(13, 20), tomorrow: false), lang: "uk")
        XCTAssertEqual(quiet.period, AppStrings.widgetNoOutages("uk"))
        XCTAssertEqual(quiet.nextOutage, AppStrings.widgetNoMoreOutages("uk"))

        // a house without a queue and an empty first launch
        let noQueue = WidgetModelBuilder.build(queue: "", statusText: "Будинок не відключається", snapshot: snapshot(now: at(13, 12), queue: ""), lang: "uk")
        XCTAssertEqual(noQueue.queueHeader, "Черга відсутня")
        var empty = snapshot(now: at(13, 12), queue: "")
        empty.hasAddress = false
        let unset = WidgetModelBuilder.build(queue: "", statusText: nil, snapshot: empty, lang: "en")
        XCTAssertTrue(unset.isUnclear)
        XCTAssertEqual(unset.queueHeader, "Queue —")
        XCTAssertEqual(unset.countdown, "--hr. --m.")
        XCTAssertTrue(unset.slots.isEmpty)
    }

    func testTimelineHasEveryMinuteAndEveryTransition() {
        let now = KyivTime.date(of: at(13, 12, 40)).addingTimeInterval(25)
        let transitions = [Transition(at: at(13, 13), isOff: true), Transition(at: at(13, 17), isOff: false), Transition(at: at(13, 12), isOff: false)]
        let dates = WidgetModelBuilder.entryDates(now: now, transitions: transitions, minutes: 90)
        XCTAssertEqual(dates.first, now)
        XCTAssertEqual(dates, dates.sorted())
        XCTAssertEqual(Set(dates).count, dates.count)
        XCTAssertTrue(dates.contains(KyivTime.date(of: at(13, 12, 41))), "the next whole minute")
        XCTAssertTrue(dates.contains(KyivTime.date(of: at(13, 17))), "a transition beyond the 90 minutes")
        XCTAssertFalse(dates.contains(KyivTime.date(of: at(13, 12))), "a past transition")
        // 1 + 90 minutes + the 17:00 transition (13:00 falls on a minute already listed)
        XCTAssertEqual(dates.count, 92)
    }
}
