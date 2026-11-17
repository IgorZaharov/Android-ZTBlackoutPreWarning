package ua.blackout.prewarning.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import ua.blackout.prewarning.ui.components.OnboardingTour
import ua.blackout.prewarning.ui.components.TourInput
import ua.blackout.prewarning.ui.components.TourPage
import ua.blackout.prewarning.ui.components.TourStep

/** First-run tour steps (spec/ONBOARDING.md); the same cases run in tests/onboarding.test.ts. */
class OnboardingTourTest {

    private val base = TourInput(
        active = true,
        lookupOpen = false,
        resultShown = false,
        page = TourPage.SCHEDULE,
        hasAddress = false,
        reachedRename = false,
        renameDone = false
    )

    private fun at(i: TourInput) = OnboardingTour.step(i)

    @Test
    fun notStartedShowsNothing() {
        assertEquals(TourStep.NONE, at(base.copy(active = false, lookupOpen = true)))
    }

    @Test
    fun lookupWithoutResultIsPick() {
        assertEquals(TourStep.PICK, at(base.copy(lookupOpen = true, page = TourPage.SETTINGS)))
    }

    @Test
    fun lookupWithResultIsApply() {
        assertEquals(TourStep.APPLY, at(base.copy(lookupOpen = true, resultShown = true, page = TourPage.SETTINGS)))
    }

    @Test
    fun anotherDialogOnTopWaits() {
        assertEquals(TourStep.NONE, at(base.copy(lookupOpen = true, covered = true)))
    }

    @Test
    fun settingsWithAddressIsRenameThenAlerts() {
        assertEquals(TourStep.RENAME, at(base.copy(page = TourPage.SETTINGS, hasAddress = true)))
        assertEquals(TourStep.ALERTS, at(base.copy(page = TourPage.SETTINGS, hasAddress = true, reachedRename = true, renameDone = true)))
    }

    @Test
    fun settingsWithoutAddressShowsNothing() {
        assertEquals(TourStep.NONE, at(base.copy(page = TourPage.SETTINGS)))
    }

    @Test
    fun mainScreenAfterRenameIsAbout() {
        assertEquals(TourStep.NONE, at(base.copy(page = TourPage.SCHEDULE, hasAddress = true)))
        assertEquals(TourStep.ABOUT, at(base.copy(page = TourPage.SCHEDULE, hasAddress = true, reachedRename = true)))
    }

    @Test
    fun aboutAfterRenameFinishes() {
        assertTrue(OnboardingTour.finishedBy(TourPage.ABOUT, true))
        assertFalse(OnboardingTour.finishedBy(TourPage.ABOUT, false))
        assertFalse(OnboardingTour.finishedBy(TourPage.SCHEDULE, true))
    }
}
