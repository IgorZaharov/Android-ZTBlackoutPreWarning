import XCTest
@testable import ZTPreBlackout

/// Which site and PowerOn status the main screen shows (chips in the "Last updated" card, banner above
/// the hero). Port of android/app/src/test/.../ui/SiteStatusModelTest.kt.
final class SiteStatusModelTests: XCTestCase {
    private let now = LocalDateTime(year: 2026, month: 11, day: 13, hour: 12, minute: 0)!
    private let goodAt = Int64(KyivTime.epochSecond(of: LocalDateTime(year: 2026, month: 11, day: 13, hour: 9, minute: 30)!)) * 1000
    private let notice = "УВАГА! ВАЖЛИВА ІНФОРМАЦІЯ!\nГрафіки погодинних відключень електроенергії наразі не діють."

    private func snapshot(
        _ state: SiteState?,
        queue: String = "5.2",
        plannedKnown: Bool = true,
        tomorrowPublished: Bool = false,
        lastSuccessMs: Int64?? = nil,
        poweron: PowerOnSnapshot? = nil,
        notice: String? = nil
    ) -> OutageSnapshot {
        OutageSnapshot(
            now: now,
            queue: queue,
            outages: [],
            plannedKnown: plannedKnown,
            tomorrowPublished: tomorrowPublished,
            site: state.map { SiteSnapshot(state: $0, checkedAtMs: goodAt, lastSuccessMs: lastSuccessMs ?? goodAt, notice: notice) },
            poweron: poweron,
            hasAddress: true
        )
    }

    func testHealthySiteShowsGreenChipAndNoBanner() {
        let s = snapshot(.AVAILABLE_WITH_TABLE, tomorrowPublished: true)
        let chips = SiteStatusModel.chips(s, "uk")
        XCTAssertEqual(chips.count, 2)
        XCTAssertEqual(chips[0].tone, .green)
        XCTAssertEqual(chips[0].icon, .OK)
        XCTAssertEqual(chips[0].text, "Сайт ZTOE доступний, графік опубліковано")
        XCTAssertEqual(chips[1].tone, .green)
        XCTAssertEqual(chips[1].text, "Графік на завтра: опубліковано")
        XCTAssertNil(SiteStatusModel.banner(s, "uk"))
    }

    func testSiteWithoutTableIsAmberAndShowsStaleTime() {
        let s = snapshot(.AVAILABLE_NO_TABLE)
        let chips = SiteStatusModel.chips(s, "uk")
        XCTAssertEqual(chips[0].tone, .amber)
        XCTAssertEqual(chips[0].icon, .WARNING)
        XCTAssertTrue(chips.contains { $0.tone == .amber && $0.text == "дані за 09:30" })
        XCTAssertTrue(chips.contains { $0.text == "Графік на завтра: ще немає" && $0.tone == .grey })
        let banner = SiteStatusModel.banner(s, "uk")
        XCTAssertEqual(banner?.tone, .amber)
        XCTAssertEqual(banner?.title, "Сайт ZTOE доступний, але графіка немає")
        XCTAssertEqual(banner?.message, "Показано збережений графік (дані за 09:30)\nГрафік ще не опубліковано або сторінка змінилась.")
    }

    func testUnreachableSiteIsRedAndOfflineIsGrey() {
        let red = SiteStatusModel.banner(snapshot(.SITE_UNREACHABLE), "en")
        XCTAssertEqual(red?.tone, .red)
        XCTAssertEqual(red?.icon, .SERVER_DOWN)
        XCTAssertEqual(red?.title, "ZTOE site unreachable, your internet works")
        let grey = SiteStatusModel.banner(snapshot(.NO_INTERNET), "en")
        XCTAssertEqual(grey?.tone, .grey)
        XCTAssertEqual(grey?.icon, .OFFLINE)
        XCTAssertEqual(grey?.title, "No internet connection")
    }

    func testStaleHintIsOmittedWhenThereIsNoCachedSchedule() {
        let s = snapshot(.SITE_UNREACHABLE, plannedKnown: false)
        XCTAssertEqual(SiteStatusModel.banner(s, "uk")?.message, "Застосунок повторить спробу сам.")
        XCTAssertFalse(SiteStatusModel.chips(s, "uk").contains { $0.text.hasPrefix("дані за") })
    }

    func testSiteNotCheckedYetShowsGreyChecking() {
        let chips = SiteStatusModel.chips(snapshot(nil), "uk")
        XCTAssertEqual(chips[0].tone, .grey)
        XCTAssertEqual(chips[0].text, "Перевірка сайту ZTOE…")
        XCTAssertNil(SiteStatusModel.banner(snapshot(nil), "uk"))
    }

    func testNothingIsShownWithoutAQueue() {
        let s = snapshot(.SITE_UNREACHABLE, queue: "")
        XCTAssertTrue(SiteStatusModel.chips(s, "uk").isEmpty)
        XCTAssertNil(SiteStatusModel.banner(s, "uk"))
    }

    func testPoweronLineOnlyWhenTheLastRefreshFailed() {
        let bad = snapshot(.AVAILABLE_WITH_TABLE, poweron: PowerOnSnapshot(ok: false, checkedAtMs: goodAt, lastOkMs: nil))
        XCTAssertEqual(SiteStatusModel.poweronLine(bad, "uk")?.text, "Аварійні відключення: дані недоступні")
        XCTAssertEqual(SiteStatusModel.poweronLine(bad, "uk")?.tone, .amber)
        let good = snapshot(.AVAILABLE_WITH_TABLE, poweron: PowerOnSnapshot(ok: true, checkedAtMs: goodAt, lastOkMs: goodAt))
        XCTAssertNil(SiteStatusModel.poweronLine(good, "uk"))
        XCTAssertNil(SiteStatusModel.poweronLine(snapshot(.AVAILABLE_WITH_TABLE), "uk"))
    }

    func testSiteNoticeShowsOnlyWhilePageHasNoTable() {
        XCTAssertEqual(SiteStatusModel.notice(snapshot(.AVAILABLE_NO_TABLE, notice: notice)), notice)
        // concerns everybody: shown without a queue too
        XCTAssertEqual(SiteStatusModel.notice(snapshot(.AVAILABLE_NO_TABLE, queue: "", notice: notice)), notice)
        XCTAssertNil(SiteStatusModel.notice(snapshot(.AVAILABLE_WITH_TABLE, notice: notice)))
        XCTAssertNil(SiteStatusModel.notice(snapshot(.AVAILABLE_NO_TABLE, notice: "  ")))
        XCTAssertNil(SiteStatusModel.notice(snapshot(nil)))
    }

    func testNoticeCardReplacesTheNoTableBanner() {
        let s = snapshot(.AVAILABLE_NO_TABLE, notice: notice)
        XCTAssertNil(SiteStatusModel.banner(s, "uk"))
        // the chip below keeps naming the state
        XCTAssertEqual(SiteStatusModel.chips(s, "uk")[0].tone, .amber)
        // without a notice the banner is back
        XCTAssertNotNil(SiteStatusModel.banner(snapshot(.AVAILABLE_NO_TABLE), "uk"))
    }
}

/// The planned pre-warning text with address labels (spec/NOTIFICATIONS.md 1.3, spec/SUBSCRIPTIONS.md 8.3).
/// Port of android/app/src/test/.../ui/PlannedAlertTextTest.kt.
final class PlannedAlertTextTests: XCTestCase {
    private let nb = "\u{00A0}"

    func testWithoutLabelsTheTextIsThe140One() {
        XCTAssertEqual(
            AppStrings.plannedAlertBody("uk", "2.2", "14:00", "16:00", 15, 120, false),
            "Черга 2.2: відключення о 14:00 (через 15\(nb)хв), орієнтовно до 16:00 (2\(nb)год)."
        )
    }

    func testLabelsOpenTheTextWithTheQueueInBrackets() {
        XCTAssertEqual(
            AppStrings.plannedAlertBody("uk", "2.2", "14:00", "16:00", 15, 120, false, labels: "Київська 37 · Київська 39"),
            "Київська 37 · Київська 39 (черга 2.2): відключення о 14:00 (через 15\(nb)хв), орієнтовно до 16:00 (2\(nb)год)."
        )
        XCTAssertEqual(
            AppStrings.plannedAlertBody("en", "2.2", "14:00", "16:00", 0, 120, true, labels: "Kyivska 37"),
            "Kyivska 37 (queue 2.2): outage is starting now, at 14:00, expected until 16:00 (2\(nb)h), may continue."
        )
    }

    func testAQueueOnlyLabelIsNotRepeated() {
        XCTAssertEqual(
            AppStrings.plannedAlertBody("uk", "1.1", "14:00", "15:00", 15, 60, false, labels: "Черга 1.1"),
            "Черга 1.1: відключення о 14:00 (через 15\(nb)хв), орієнтовно до 15:00 (1\(nb)год)."
        )
    }
}

/// Strings and small main-screen rules that have no Android unit test of their own.
final class AppStringsRulesTests: XCTestCase {
    /// Like Kotlin `resolveLang`: "SYSTEM" is Ukrainian only on a Ukrainian phone, English otherwise.
    func testResolveLangFollowsKotlin() {
        XCTAssertEqual(AppStrings.resolveLang("uk"), "uk")
        XCTAssertEqual(AppStrings.resolveLang("EN"), "en")
        XCTAssertEqual(AppStrings.resolveLang("SYSTEM", systemLanguage: "uk"), "uk")
        XCTAssertEqual(AppStrings.resolveLang("SYSTEM", systemLanguage: "ru"), "en")
        XCTAssertEqual(AppStrings.resolveLang("SYSTEM", systemLanguage: "en"), "en")
    }

    /// Owner invariants (CLAUDE.md): queue help steps and button, widget labels.
    func testCriticalTexts() {
        XCTAssertEqual(AppStrings.queueHelpSteps("uk").count, 4)
        XCTAssertEqual(AppStrings.queueHelpGotIt("uk"), "Зрозуміло")
        XCTAssertEqual(AppStrings.widgetPowerOn("uk"), "СВІТЛО Є")
        XCTAssertEqual(AppStrings.widgetPowerOff("uk"), "СВІТЛА НЕМАЄ")
        XCTAssertEqual(AppStrings.rangeMinutes("uk", 5, 240), "5–240\u{00A0}хв")
    }

    func testAddressSplitsAfterTheCity() {
        XCTAssertEqual(MainScreen.formatAddressAfterCity("м. Житомир, вул. Київська, 1"), "м. Житомир,\nвул. Київська, 1")
        XCTAssertEqual(MainScreen.formatAddressAfterCity("Житомир"), "Житомир")
        XCTAssertNil(MainScreen.formatAddressAfterCity("  "))
        XCTAssertEqual(MainScreen.lightNoOutageSlots.count, 48)
        XCTAssertEqual(MainScreen.lightNoOutageSlots.last?.endTimeStr, "24:00")
    }
}
