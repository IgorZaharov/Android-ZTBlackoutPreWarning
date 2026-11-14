import XCTest
@testable import ZTPreBlackout

/// Row texts of the outage list under the drum (spec/UI_DRUM.md section 5). Port of OutageRowFormatTest.kt.
final class OutageRowFormatTests: XCTestCase {
    private let today = LocalDate(year: 2026, month: 11, day: 13)!
    private var tomorrow: LocalDate { today.plusDays(1) }
    private let noon = LocalDateTime(year: 2026, month: 11, day: 13, hour: 12, minute: 0)!
    private let nbsp = "\u{00A0}"

    private func at(_ day: Int, _ h: Int, _ m: Int = 0) -> LocalDateTime {
        LocalDateTime(year: 2026, month: 11, day: day, hour: h, minute: m)!
    }

    private func planned(_ start: LocalDateTime, _ end: LocalDateTime, mayContinue: Bool = false) -> Outage {
        Outage(id: "p_\(start)", kind: .PLANNED, start: start, end: end, mayContinue: mayContinue)
    }

    private func row(_ outage: Outage, _ date: LocalDate, now: LocalDateTime? = nil, file: StaticString = #filePath, line: UInt = #line) -> DayRow {
        let rows = OutageEngine.dayView([outage], date: date, now: now ?? noon).rows
        XCTAssertEqual(rows.count, 1, "exactly one row", file: file, line: line)
        return rows[0]
    }

    func testSameDayPlannedRowHasPlainSpanAndDuration() {
        let text = OutageRowFormat.format("uk", row(planned(at(13, 14), at(13, 16)), today))
        XCTAssertEqual(text.timeText, "14:00 – 16:00")
        XCTAssertEqual(text.durationText, "2\(nbsp)год")
        XCTAssertNil(text.kindTag)
        XCTAssertNil(text.originTag)
        XCTAssertNil(text.statusTag)
        XCTAssertNil(text.continueTag)
        XCTAssertFalse(text.isFinished)
        XCTAssertFalse(text.isEmergency)
        XCTAssertFalse(text.isRepair)
    }

    func testOutageLeavingTheDayShowsRealEndWithDateAndFullDurationOnToday() {
        let text = OutageRowFormat.format("uk", row(planned(at(13, 23), at(14, 1)), today))
        XCTAssertEqual(text.timeText, "23:00 – 01:00 (14.11)")
        XCTAssertEqual(text.durationText, "2\(nbsp)год")
        XCTAssertNil(text.originTag)
    }

    func testOutageComingFromYesterdayShowsMidnightStartOriginTagAndFullDurationOnTomorrow() {
        let text = OutageRowFormat.format("uk", row(planned(at(13, 23), at(14, 1)), tomorrow))
        XCTAssertEqual(text.timeText, "00:00 – 01:00")
        XCTAssertEqual(text.durationText, "2\(nbsp)год")
        XCTAssertEqual(text.originTag, "з 13.11 23:00")
    }

    func testOutageEndingExactlyAtMidnightPrintsTwentyFourWithoutDate() {
        let text = OutageRowFormat.format("uk", row(planned(at(13, 22), at(14, 0)), today))
        XCTAssertEqual(text.timeText, "22:00 – 24:00")
        XCTAssertEqual(text.durationText, "2\(nbsp)год")
    }

    func testOutageSpanningTheWholeNextDayEndsOnTwentyFourOfThatDay() {
        let outage = planned(at(13, 20), at(15, 0))
        XCTAssertEqual(OutageRowFormat.format("uk", row(outage, today)).timeText, "20:00 – 24:00 (14.11)")
        let onTomorrow = OutageRowFormat.format("uk", row(outage, tomorrow))
        XCTAssertEqual(onTomorrow.timeText, "00:00 – 24:00")
        XCTAssertEqual(onTomorrow.originTag, "з 13.11 20:00")
    }

    func testFinishedRowIsMarkedAndKeepsItsDuration() {
        let text = OutageRowFormat.format("uk", row(planned(at(13, 6), at(13, 8)), today))
        XCTAssertTrue(text.isFinished)
        XCTAssertEqual(text.statusTag, "завершено")
        XCTAssertEqual(text.durationText, "2\(nbsp)год")
        XCTAssertTrue(text.accessibilityText.contains("завершено"))
    }

    func testActiveAndUpcomingRowsHaveNoStatusTag() {
        let active = OutageRowFormat.format("uk", row(planned(at(13, 11), at(13, 13)), today))
        XCTAssertNil(active.statusTag)
        XCTAssertFalse(active.isFinished)
    }

    func testEmergencyRowHasTextTagAndDescription() {
        let outage = Outage(id: "e1", kind: .EMERGENCY, start: at(13, 10), end: at(13, 14), endIsEstimate: true)
        let text = OutageRowFormat.format("uk", row(outage, today))
        XCTAssertTrue(text.isEmergency)
        XCTAssertEqual(text.kindTag, "Аварійне")
        XCTAssertEqual(text.timeText, "10:00 – 14:00")
        XCTAssertEqual(text.durationText, "4\(nbsp)год")
        XCTAssertEqual(text.accessibilityText, "Аварійне, 10:00 – 14:00, 4\(nbsp)год")
    }

    func testOverdueEmergencyHasNoEndAndNoDuration() {
        let outage = Outage(id: "e2", kind: .EMERGENCY, start: at(13, 10), end: noon, endIsEstimate: true, overdue: true)
        let text = OutageRowFormat.format("uk", row(outage, today))
        XCTAssertEqual(text.timeText, "10:00 – --:--")
        XCTAssertNil(text.durationText)
        XCTAssertEqual(text.statusTag, "очікується відновлення")
        XCTAssertEqual(text.kindTag, "Аварійне")
    }

    func testStaleEmergencyIsFinished() {
        let outage = Outage(id: "e3", kind: .EMERGENCY, start: at(13, 8), end: at(13, 9), endIsEstimate: true, stale: true)
        let text = OutageRowFormat.format("uk", row(outage, today))
        XCTAssertTrue(text.isFinished)
        XCTAssertEqual(text.statusTag, "завершено")
    }

    func testRepairWorksRowHasWrenchKindAndPlannedWorksTag() {
        let outage = Outage(id: "r1", kind: .REPAIR, start: at(13, 8), end: at(13, 17))
        let text = OutageRowFormat.format("uk", row(outage, today))
        XCTAssertTrue(text.isRepair)
        XCTAssertEqual(text.kindTag, "Планові роботи")
        XCTAssertEqual(text.timeText, "08:00 – 17:00")
        XCTAssertEqual(text.durationText, "9\(nbsp)год")
    }

    func testPartialHoursUseHoursAndMinutes() {
        let text = OutageRowFormat.format("uk", row(planned(at(13, 14), at(13, 15, 30)), today))
        XCTAssertEqual(text.durationText, "1\(nbsp)год 30\(nbsp)хв")
    }

    func testMayContinueIsTaggedUntilFinished() {
        let text = OutageRowFormat.format("uk", row(planned(at(13, 20), at(14, 0), mayContinue: true), today))
        XCTAssertEqual(text.continueTag, "можливе продовження")
        let past = OutageRowFormat.format("uk", row(planned(at(13, 2), at(13, 4), mayContinue: true), today))
        XCTAssertNil(past.continueTag)
    }

    func testEnglishTexts() {
        let tomorrowText = OutageRowFormat.format("en", row(planned(at(13, 23), at(14, 1)), tomorrow))
        XCTAssertEqual(tomorrowText.durationText, "2\(nbsp)h")
        XCTAssertEqual(tomorrowText.originTag, "from 13.11 23:00")
        let emergency = Outage(id: "e", kind: .EMERGENCY, start: at(13, 10), end: at(13, 14), endIsEstimate: true)
        XCTAssertEqual(OutageRowFormat.format("en", row(emergency, today)).kindTag, "Emergency")
        let repair = Outage(id: "r", kind: .REPAIR, start: at(13, 8), end: at(13, 17))
        XCTAssertEqual(OutageRowFormat.format("en", row(repair, today)).kindTag, "Planned works")
    }

    // MARK: - drum summary

    static func cells(planned: Range<Int> = 0..<0, emergency: Range<Int> = 0..<0) -> [BlackoutSlot] {
        (0..<48).map { i in
            let p = planned.contains(i)
            let e = emergency.contains(i)
            let endMin = (i + 1) * 30
            let start = String(format: "%02d:%02d", i / 2, (i % 2) * 30)
            let end = endMin >= 1440 ? "24:00" : String(format: "%02d:%02d", endMin / 60, endMin % 60)
            return BlackoutSlot(
                id: "slot_\(i)", startHour: i / 2, endHour: endMin / 60, startMinute: (i % 2) * 30,
                endMinute: endMin % 60, startTimeStr: start, endTimeStr: end,
                status: p || e ? .POWER_OFF : .POWER_ON, isEmergency: e, isPlanned: p
            )
        }
    }

    func testDrumSummaryListsPlannedAndEmergencyRuns() {
        XCTAssertEqual(
            OutageRowFormat.drumSummary("uk", Self.cells(planned: 0..<4, emergency: 20..<24), unclearBase: false),
            "Шкала доби: без світла: 00:00 – 02:00, 10:00 – 12:00 (аварійне)"
        )
    }

    func testDrumSummaryEndsAtTwentyFourAndMergesPlannedWithEmergency() {
        XCTAssertEqual(
            OutageRowFormat.drumSummary("en", Self.cells(planned: 44..<48, emergency: 46..<48), unclearBase: false),
            "Day timeline: no power: 22:00 – 24:00 (emergency)"
        )
    }

    func testDrumSummaryForQuietAndUnclearDays() {
        XCTAssertEqual(OutageRowFormat.drumSummary("uk", Self.cells(), unclearBase: false), "Шкала доби: відключень немає")
        XCTAssertEqual(OutageRowFormat.drumSummary("uk", Self.cells(), unclearBase: true), "Шкала доби: Графіки не діють")
        XCTAssertEqual(OutageRowFormat.drumSummary("uk", [], unclearBase: false), "Шкала доби: Графіки не діють")
        XCTAssertEqual(
            OutageRowFormat.drumSummary("en", Self.cells(emergency: 20..<22), unclearBase: true),
            "Day timeline: Outages unclear; no power: 10:00 – 11:00 (emergency)"
        )
    }
}

/// Drum cell mapping and geometry shared by the app and the widgets (spec/UI_DRUM.md sections 1-3).
final class DrumGeometryTests: XCTestCase {

    func testCellsKeepPlannedAndEmergencySeparate() {
        let cells = DrumGeometry.cells(OutageRowFormatTests.cells(planned: 0..<4, emergency: 2..<6))!
        XCTAssertEqual(cells.count, 48)
        XCTAssertEqual(cells[0], DrumCell(planned: true, emergency: false))
        XCTAssertEqual(cells[2], DrumCell(planned: true, emergency: true))
        XCTAssertEqual(cells[4], DrumCell(planned: false, emergency: true))
        XCTAssertEqual(cells[6], DrumCell(planned: false, emergency: false))
    }

    func testLegacyHourlySlotsAreUsedTwiceAndOtherLengthsAreUnclear() {
        let hourly = Array(OutageRowFormatTests.cells(planned: 0..<2).enumerated().filter { $0.offset % 2 == 0 }.map { $0.element })
        XCTAssertEqual(hourly.count, 24)
        let cells = DrumGeometry.cells(hourly)!
        XCTAssertEqual(cells.count, 48)
        XCTAssertTrue(cells[0].planned && cells[1].planned)
        XCTAssertFalse(cells[2].planned)
        XCTAssertNil(DrumGeometry.cells([]))
        XCTAssertNil(DrumGeometry.cells(Array(OutageRowFormatTests.cells().prefix(47))))
    }

    /// A legacy POWER_OFF slot without flags is drawn as a planned outage.
    func testOffSlotWithoutFlagsCountsAsPlanned() {
        var slots = OutageRowFormatTests.cells()
        slots[10] = BlackoutSlot(id: "x", startHour: 5, endHour: 5, startMinute: 0, endMinute: 30,
                                 startTimeStr: "05:00", endTimeStr: "05:30", status: .POWER_OFF)
        XCTAssertEqual(DrumGeometry.cells(slots)![10], DrumCell(planned: true, emergency: false))
    }

    func testNeedleSitsOnTheCellOfTheCurrentHalfHour() {
        let w: CGFloat = 331
        for h in 0..<24 {
            XCTAssertEqual(DrumGeometry.needleX(trackWidth: w, hour: h, minute: 0), DrumGeometry.cellLeft(h * 2, trackWidth: w), accuracy: 0.0001)
            XCTAssertEqual(DrumGeometry.needleX(trackWidth: w, hour: h, minute: 30), DrumGeometry.cellLeft(h * 2 + 1, trackWidth: w), accuracy: 0.0001)
        }
        let hourW = DrumGeometry.hourWidth(trackWidth: w)
        // the last half-hour ends exactly at the right edge of the strip
        XCTAssertEqual(DrumGeometry.cellLeft(47, trackWidth: w) + hourW / 2, w, accuracy: 0.0001)
        // clamped: 23:59 stays inside the last hour box, out-of-range input does not leave the strip
        XCTAssertLessThan(DrumGeometry.needleX(trackWidth: w, hour: 23, minute: 59), w)
        XCTAssertEqual(DrumGeometry.needleX(trackWidth: w, hour: 30, minute: 99), DrumGeometry.needleX(trackWidth: w, hour: 23, minute: 59), accuracy: 0.0001)
        XCTAssertEqual(DrumGeometry.needleX(trackWidth: w, hour: -1, minute: -5), 0, accuracy: 0.0001)
    }

    func testTicksEveryTwoOrFourHours() {
        XCTAssertEqual(DrumGeometry.tickHours(every: 2), [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24])
        XCTAssertEqual(DrumGeometry.tickHours(every: 4), [0, 4, 8, 12, 16, 20, 24])
    }
}

/// Time-of-day palette (TimeOfDayPalette.kt) and the glass recipe choice (plan section 4).
final class DesignTokenTests: XCTestCase {

    private func assertClose(_ a: UInt32, _ b: UInt32, file: StaticString = #filePath, line: UInt = #line) {
        for shift in [16, 8, 0] as [UInt32] {
            let ca = Int((a >> shift) & 0xFF)
            let cb = Int((b >> shift) & 0xFF)
            XCTAssertLessThanOrEqual(abs(ca - cb), 1, String(format: "%06X vs %06X", a, b), file: file, line: line)
        }
    }

    private func assertPalette(_ got: TimePaletteColors, _ want: TimePaletteColors, file: StaticString = #filePath, line: UInt = #line) {
        assertClose(got.primaryHex, want.primaryHex, file: file, line: line)
        assertClose(got.secondaryHex, want.secondaryHex, file: file, line: line)
        assertClose(got.accentHex, want.accentHex, file: file, line: line)
        assertClose(got.supportingHex, want.supportingHex, file: file, line: line)
    }

    func testPaletteHitsItsAnchorsExactly() {
        assertPalette(TimeOfDayPalette.colors(hour: 2, minute: 0), TimeOfDayPalette.NIGHT)
        assertPalette(TimeOfDayPalette.colors(hour: 8, minute: 30), TimeOfDayPalette.MORNING)
        assertPalette(TimeOfDayPalette.colors(hour: 14, minute: 30), TimeOfDayPalette.DAY)
        assertPalette(TimeOfDayPalette.colors(hour: 20, minute: 0), TimeOfDayPalette.EVENING)
    }

    func testPaletteWrapsAroundMidnight() {
        // 01:00 is 5/6 of the way from evening (20:00) to night (02:00): close to night, not equal
        let late = TimeOfDayPalette.colors(hour: 1, minute: 0)
        XCTAssertNotEqual(late, TimeOfDayPalette.NIGHT)
        XCTAssertNotEqual(late, TimeOfDayPalette.EVENING)
        // 23:59 and 00:00 are one minute apart on the same segment
        let a = TimeOfDayPalette.colors(hour: 23, minute: 59)
        let b = TimeOfDayPalette.colors(hour: 0, minute: 0)
        assertClose(a.primaryHex, b.primaryHex)
    }

    /// Compose `lerp(Color, Color)` blends in Oklab: the midpoint of black and white is #636363, not #808080.
    func testOklabMidpointOfBlackAndWhite() {
        assertClose(Oklab.lerp(0x000000, 0xFFFFFF, 0.5), 0x636363)
        XCTAssertEqual(Oklab.lerp(0x123456, 0x123456, 0.3), 0x123456)
        assertClose(Oklab.lerp(0xFF5E3A, 0x0A2540, 0), 0xFF5E3A)
        assertClose(Oklab.lerp(0xFF5E3A, 0x0A2540, 1), 0x0A2540)
    }

    func testGlassRecipe() {
        XCTAssertEqual(ZtGlassRender.resolve(mode: .automatic, reduceTransparency: false, liquidAvailable: true), .liquid)
        XCTAssertEqual(ZtGlassRender.resolve(mode: .automatic, reduceTransparency: false, liquidAvailable: false), .material)
        XCTAssertEqual(ZtGlassRender.resolve(mode: .fallback, reduceTransparency: false, liquidAvailable: true), .material)
        // Reduce Transparency always wins, on any version and in any mode
        for mode in ZtGlassMode.allCases {
            XCTAssertEqual(ZtGlassRender.resolve(mode: mode, reduceTransparency: true, liquidAvailable: true), .solid)
            XCTAssertEqual(ZtGlassRender.resolve(mode: mode, reduceTransparency: true, liquidAvailable: false), .solid)
        }
        XCTAssertEqual(ZtGlassRender.resolve(mode: .solid, reduceTransparency: false, liquidAvailable: true), .solid)
    }

    func testAmbientDriftStaysWithinItsAmplitude() {
        for seed in 0..<4 {
            for s in stride(from: 0.0, through: 120.0, by: 0.7) {
                let d = AmbientMotion.drift(seconds: s, seed: seed, width: 400, height: 800)
                XCTAssertLessThanOrEqual(abs(d.width), 400 * 0.16 + 0.001)
                XCTAssertLessThanOrEqual(abs(d.height), 800 * 0.16 * 0.7 + 0.001)
                let b = AmbientMotion.breath(seconds: s, seed: seed)
                XCTAssertTrue((0.85...1.15).contains(b))
            }
        }
        XCTAssertEqual(AmbientMotion.drift(seconds: 0, seed: 0, width: 400, height: 800).width, 0, accuracy: 0.0001)
    }
}
