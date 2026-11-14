import XCTest
@testable import ZTPreBlackout

final class ZtoeParserTests: XCTestCase {

    func testUrlValidationAgainstValidUrlsJson() {
        XCTAssertTrue(ZtoeParser.isValidScheduleUrl("https://www.ztoe.com.ua/unhooking-search.php"))
        XCTAssertTrue(ZtoeParser.isValidScheduleUrl("https://example.com"))
        XCTAssertFalse(ZtoeParser.isValidScheduleUrl("https://malicious-site.org/unhooking.php"))
    }

    func testCellPowerOffDetectionNeverMatchesWhiteAsRed() {
        XCTAssertFalse(ZtoeParser.isCellPowerOff(attrs: "style=\"background:#ffffff\"", text: ""))
        XCTAssertTrue(ZtoeParser.isCellPowerOff(attrs: "style=\"background:#ff3333\"", text: ""))
        XCTAssertTrue(ZtoeParser.isCellPowerOff(attrs: "bgcolor=\"#ff0000\"", text: ""))
        XCTAssertTrue(ZtoeParser.isCellPowerOff(attrs: "", text: "вимк"))
    }

    func testContiguousSlotAggregationAndCountdown() {
        var slots: [BlackoutSlot] = (0..<48).map { idx in
            let startMin = idx * 30
            let endMin = startMin + 30
            let isOff = (idx >= 28 && idx < 32) // 14:00 - 16:00 (4 contiguous 30-min slots)
            return BlackoutSlot(
                index: idx,
                startMinute: startMin,
                endMinute: endMin,
                label: String(format: "%02d:%02d - %02d:%02d", startMin / 60, startMin % 60, endMin / 60, endMin % 60),
                status: isOff ? .POWER_OFF : .POWER_ON
            )
        }

        let intervals = ScheduleRepository.shared.computeDetailedIntervals(slots: slots)
        XCTAssertEqual(intervals.count, 1)
        XCTAssertEqual(intervals.first?.startStr, "14:00")
        XCTAssertEqual(intervals.first?.endStr, "16:00")
        XCTAssertEqual(intervals.first?.durationHours, 2.0)

        // Tomorrow first blackout fallback when all today's blackouts have passed
        slots = (0..<48).map { idx in
            BlackoutSlot(
                index: idx,
                startMinute: idx * 30,
                endMinute: (idx + 1) * 30,
                label: "",
                status: (idx >= 4 && idx < 8) ? .POWER_OFF : .POWER_ON // 02:00 - 04:00
            )
        }
        let tomorrowSlots: [BlackoutSlot] = (0..<48).map { idx in
            BlackoutSlot(
                index: idx,
                startMinute: idx * 30,
                endMinute: (idx + 1) * 30,
                label: "",
                status: (idx >= 12 && idx < 16) ? .POWER_OFF : .POWER_ON // 06:00 - 08:00 tomorrow
            )
        }

        var comps = DateComponents()
        comps.year = 2026
        comps.month = 11
        comps.day = 9
        comps.hour = 20
        comps.minute = 0
        comps.second = 0
        comps.timeZone = KyivZone.timeZone
        let eveningNow = KyivZone.calendar.date(from: comps)!

        let status = ScheduleRepository.shared.calculateStatusAndCountdown(
            slots: slots,
            tomorrowSlots: tomorrowSlots,
            now: eveningNow
        )
        XCTAssertFalse(status.isBlackoutNow)
        XCTAssertEqual(status.nextSlotTime, "06:00 – 08:00")
        XCTAssertEqual(status.countdownText, "10:00:00")
    }

    func testCriticalInvariantsAndStrings() {
        XCTAssertEqual(AppStrings.APP_NAME, "Світло в Житомирі")
        let defaultSettings = UserSettings()
        XCTAssertEqual(defaultSettings.advanceNoticeMinutes, 15)
        XCTAssertEqual(defaultSettings.refreshIntervalMinutes, 30)
        XCTAssertEqual(AppStrings.queueHelpConfirm("uk"), "Зрозуміло")
        XCTAssertEqual(AppStrings.queueHelpSteps("uk").count, 4)
        XCTAssertEqual(AppStrings.widgetPowerOn("uk"), "СВІТЛО Є")
        XCTAssertEqual(AppStrings.widgetPowerOff("uk"), "СВІТЛА НЕМАЄ")
        XCTAssertEqual(AppStrings.schedulesUnclear("uk"), "Графіки не діють")
        XCTAssertEqual(AppStrings.schedulesUnclear("en"), "Outages unclear")
        XCTAssertEqual(AppStrings.donationsSectionTitle("uk"), "Charity / Благодійність і Пожертви")
    }
}
