package ua.blackout.prewarning.ui

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * The planned pre-warning text with address labels (spec/NOTIFICATIONS.md 1.3, spec/SUBSCRIPTIONS.md 8.3).
 * The same strings are asserted for the web in tests/services.test.ts.
 */
class PlannedAlertTextTest {
    private val nb = " "

    @Test
    fun withoutLabelsTheTextIsThe140One() {
        assertEquals(
            "Черга 2.2: відключення о 14:00 (через 15${nb}хв), орієнтовно до 16:00 (2${nb}год).",
            AppStrings.plannedAlertBody("uk", "2.2", "14:00", "16:00", 15, 120, false)
        )
    }

    @Test
    fun labelsOpenTheTextWithTheQueueInBrackets() {
        assertEquals(
            "Київська 37 · Київська 39 (черга 2.2): відключення о 14:00 (через 15${nb}хв), орієнтовно до 16:00 (2${nb}год).",
            AppStrings.plannedAlertBody("uk", "2.2", "14:00", "16:00", 15, 120, false, labels = "Київська 37 · Київська 39")
        )
        assertEquals(
            "Kyivska 37 (queue 2.2): outage is starting now, at 14:00, expected until 16:00 (2${nb}h), may continue.",
            AppStrings.plannedAlertBody("en", "2.2", "14:00", "16:00", 0, 120, true, labels = "Kyivska 37")
        )
    }

    @Test
    fun aQueueOnlyLabelIsNotRepeated() {
        assertEquals(
            "Черга 1.1: відключення о 14:00 (через 15${nb}хв), орієнтовно до 15:00 (1${nb}год).",
            AppStrings.plannedAlertBody("uk", "1.1", "14:00", "15:00", 15, 60, false, labels = "Черга 1.1")
        )
    }
}
