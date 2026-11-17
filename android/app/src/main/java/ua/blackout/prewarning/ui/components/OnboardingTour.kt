package ua.blackout.prewarning.ui.components

import android.content.Context

/**
 * First-run tour (spec/ONBOARDING.md); mirrored by src/services/onboarding.ts, cases in OnboardingTourTest.
 *
 * The tour starts when a new user taps the first-launch «Виберіть чергу» button and walks them through:
 *  PICK   - the address picker: settlement, street and house are lit, the rest is dimmed;
 *  APPLY  - the result card: the «Обрати чергу» button is ringed;
 *  RENAME - Settings with the new address: an arrow at its rename button («Далі» or the rename dialog goes on);
 *  ALERTS - its planned and emergency alert switches, and an arrow at the dock's home button;
 *  ABOUT  - the main screen: an arrow at the dock's About button, «Або допоможіть волонтерам...».
 * It ends on «Зрозуміло», on «Пропустити підказки» or when About is opened, and is never shown again.
 */
enum class TourStep { NONE, PICK, APPLY, RENAME, ALERTS, ABOUT }

enum class TourPage { SCHEDULE, SETTINGS, ABOUT, OTHER }

data class TourInput(
    /** The tour was started (first-launch button) and not finished or skipped. */
    val active: Boolean,
    /** The address lookup dialog is open. */
    val lookupOpen: Boolean,
    /** The lookup shows a result card (a house, or a settlement / street without lower levels). */
    val resultShown: Boolean,
    val page: TourPage,
    /** At least one address or queue is saved. */
    val hasAddress: Boolean,
    /** The RENAME step was shown, so the main screen goes on to ABOUT. */
    val reachedRename: Boolean,
    /** «Далі» was tapped on RENAME, or the rename dialog was closed: Settings goes on to ALERTS. */
    val renameDone: Boolean,
    /** Another dialog is on top: the tour waits (on Android a dialog is its own window above the overlay). */
    val covered: Boolean = false
)

object OnboardingTour {
    fun step(i: TourInput): TourStep = when {
        !i.active || i.covered -> TourStep.NONE
        i.lookupOpen -> if (i.resultShown) TourStep.APPLY else TourStep.PICK
        !i.hasAddress -> TourStep.NONE
        i.page == TourPage.SETTINGS -> if (i.renameDone) TourStep.ALERTS else TourStep.RENAME
        i.page == TourPage.SCHEDULE && i.reachedRename -> TourStep.ABOUT
        else -> TourStep.NONE
    }

    /** Opening About after the RENAME step finishes the tour (the donations are there). */
    fun finishedBy(page: TourPage, reachedRename: Boolean): Boolean = page == TourPage.ABOUT && reachedRename
}

/** "The tour was finished or skipped": never shown again (a reinstall shows it again). */
class OnboardingStore(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("onboarding", Context.MODE_PRIVATE)

    fun isDone(): Boolean = prefs.getBoolean(KEY_DONE, false)

    fun setDone(done: Boolean) {
        prefs.edit().putBoolean(KEY_DONE, done).apply()
    }

    private companion object {
        const val KEY_DONE = "done"
    }
}
