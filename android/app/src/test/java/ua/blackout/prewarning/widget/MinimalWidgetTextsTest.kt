package ua.blackout.prewarning.widget

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** Texts of the 2x2 minimal widget; mirrored by `minimalWidgetTexts` in src/components/WidgetSimulator.tsx. */
class MinimalWidgetTextsTest {

    @Test
    fun powerOnShowsCountdownToOutage() {
        val t = minimalWidgetTexts("uk", isUnclear = false, isOffNow = false, countdown = "00г. 46хв.")
        assertEquals("СВІТЛО Є", t.status)
        assertEquals("До відключення:", t.label)
        assertEquals("00г. 46хв.", t.countdown)
    }

    @Test
    fun powerOffShowsCountdownToPowerOn() {
        val t = minimalWidgetTexts("uk", isUnclear = false, isOffNow = true, countdown = "02г. 05хв.")
        assertEquals("СВІТЛА НЕМАЄ", t.status)
        assertEquals("До увімкнення:", t.label)
        assertEquals("02г. 05хв.", t.countdown)
    }

    @Test
    fun noOutageAheadShowsNoOutagesInsteadOfDashes() {
        val t = minimalWidgetTexts("uk", isUnclear = false, isOffNow = false, countdown = "--г. --хв.")
        assertEquals("СВІТЛО Є", t.status)
        assertEquals("Відключень немає", t.label)
        assertNull(t.countdown)
    }

    @Test
    fun offWithUnknownEndKeepsDashes() {
        val t = minimalWidgetTexts("uk", isUnclear = false, isOffNow = true, countdown = "--г. --хв.")
        assertEquals("До увімкнення:", t.label)
        assertEquals("--г. --хв.", t.countdown)
    }

    @Test
    fun unclearShowsStatusOnly() {
        val t = minimalWidgetTexts("uk", isUnclear = true, isOffNow = false, countdown = "--г. --хв.")
        assertEquals("Невідомо", t.status)
        assertNull(t.label)
        assertNull(t.countdown)
    }

    @Test
    fun englishLabels() {
        assertEquals("Time to blackout:", minimalWidgetTexts("en", false, false, "01hr. 00m.").label)
        assertEquals("Power on in:", minimalWidgetTexts("en", false, true, "01hr. 00m.").label)
    }
}
