import XCTest
@testable import ZTPreBlackout

/// First-run tour steps (spec/ONBOARDING.md); the same cases as OnboardingTourTest.kt and tests/onboarding.test.ts.
final class OnboardingTourTests: XCTestCase {

    private let base = TourInput(active: true, lookupOpen: false, resultShown: false, page: .schedule,
                                 hasAddress: false, reachedRename: false, renameDone: false)

    private func at(_ change: (inout TourInput) -> Void) -> TourStep {
        var i = base
        change(&i)
        return OnboardingTour.step(i)
    }

    func testNotStartedShowsNothing() {
        XCTAssertEqual(at { $0.active = false; $0.lookupOpen = true }, TourStep.none)
    }

    func testLookupWithoutResultIsPick() {
        XCTAssertEqual(at { $0.lookupOpen = true; $0.page = .settings }, .pick)
    }

    func testLookupWithResultIsApply() {
        XCTAssertEqual(at { $0.lookupOpen = true; $0.resultShown = true; $0.page = .settings }, .apply)
    }

    func testAnotherDialogOnTopWaits() {
        XCTAssertEqual(at { $0.lookupOpen = true; $0.covered = true }, TourStep.none)
    }

    func testSettingsWithAddressIsRenameThenAlerts() {
        XCTAssertEqual(at { $0.page = .settings; $0.hasAddress = true }, .rename)
        XCTAssertEqual(at { $0.page = .settings; $0.hasAddress = true; $0.reachedRename = true; $0.renameDone = true }, .alerts)
    }

    func testSettingsWithoutAddressShowsNothing() {
        XCTAssertEqual(at { $0.page = .settings }, TourStep.none)
    }

    func testMainScreenAfterRenameIsAbout() {
        XCTAssertEqual(at { $0.hasAddress = true }, TourStep.none)
        XCTAssertEqual(at { $0.hasAddress = true; $0.reachedRename = true }, .about)
    }

    func testAboutAfterRenameFinishes() {
        XCTAssertTrue(OnboardingTour.finishedBy(.about, reachedRename: true))
        XCTAssertFalse(OnboardingTour.finishedBy(.about, reachedRename: false))
        XCTAssertFalse(OnboardingTour.finishedBy(.schedule, reachedRename: true))
    }
}
