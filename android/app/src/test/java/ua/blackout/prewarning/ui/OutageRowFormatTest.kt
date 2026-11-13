package ua.blackout.prewarning.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import ua.blackout.prewarning.core.Outage
import ua.blackout.prewarning.core.OutageEngine
import ua.blackout.prewarning.core.OutageKind
import ua.blackout.prewarning.data.model.BlackoutSlot
import ua.blackout.prewarning.data.model.SlotStatus
import ua.blackout.prewarning.ui.components.OutageRowFormat
import java.time.LocalDate
import java.time.LocalDateTime

/** Row texts of the outage list under the drum (spec/UI_DRUM.md section 5). */
class OutageRowFormatTest {

    private val today = LocalDate.of(2026, 11, 13)
    private val tomorrow = today.plusDays(1)
    private val noon = LocalDateTime.of(2026, 11, 13, 12, 0)
    private val nbsp = " "

    private fun at(day: Int, h: Int, m: Int = 0) = LocalDateTime.of(2026, 11, day, h, m)

    private fun planned(start: LocalDateTime, end: LocalDateTime, mayContinue: Boolean = false) =
        Outage(id = "p_$start", kind = OutageKind.PLANNED, start = start, end = end, mayContinue = mayContinue)

    private fun rowsOf(outage: Outage, date: LocalDate, now: LocalDateTime = noon) =
        OutageEngine.dayView(listOf(outage), date, now).rows

    @Test
    fun sameDayPlannedRowHasPlainSpanAndDuration() {
        val row = rowsOf(planned(at(13, 14), at(13, 16)), today).single()
        val text = OutageRowFormat.format("uk", row)
        assertEquals("14:00 – 16:00", text.timeText)
        assertEquals("2${nbsp}год", text.durationText)
        assertNull(text.kindTag)
        assertNull(text.originTag)
        assertNull(text.statusTag)
        assertNull(text.continueTag)
        assertFalse(text.isFinished)
        assertFalse(text.isEmergency)
        assertFalse(text.isRepair)
    }

    @Test
    fun outageLeavingTheDayShowsRealEndWithDateAndFullDurationOnToday() {
        val outage = planned(at(13, 23), at(14, 1))
        val text = OutageRowFormat.format("uk", rowsOf(outage, today).single())
        assertEquals("23:00 – 01:00 (14.11)", text.timeText)
        assertEquals("2${nbsp}год", text.durationText)
        assertNull(text.originTag)
    }

    @Test
    fun outageComingFromYesterdayShowsMidnightStartOriginTagAndFullDurationOnTomorrow() {
        val outage = planned(at(13, 23), at(14, 1))
        val text = OutageRowFormat.format("uk", rowsOf(outage, tomorrow).single())
        assertEquals("00:00 – 01:00", text.timeText)
        assertEquals("2${nbsp}год", text.durationText)
        assertEquals("з 13.11 23:00", text.originTag)
    }

    @Test
    fun outageEndingExactlyAtMidnightPrintsTwentyFourWithoutDate() {
        val text = OutageRowFormat.format("uk", rowsOf(planned(at(13, 22), at(14, 0)), today).single())
        assertEquals("22:00 – 24:00", text.timeText)
        assertEquals("2${nbsp}год", text.durationText)
    }

    @Test
    fun outageSpanningTheWholeNextDayEndsOnTwentyFourOfThatDay() {
        val outage = planned(at(13, 20), at(15, 0))
        val onToday = OutageRowFormat.format("uk", rowsOf(outage, today).single())
        assertEquals("20:00 – 24:00 (14.11)", onToday.timeText)
        val onTomorrow = OutageRowFormat.format("uk", rowsOf(outage, tomorrow).single())
        assertEquals("00:00 – 24:00", onTomorrow.timeText)
        assertEquals("з 13.11 20:00", onTomorrow.originTag)
    }

    @Test
    fun finishedRowIsMarkedAndKeepsItsDuration() {
        val text = OutageRowFormat.format("uk", rowsOf(planned(at(13, 6), at(13, 8)), today).single())
        assertTrue(text.isFinished)
        assertEquals("завершено", text.statusTag)
        assertEquals("2${nbsp}год", text.durationText)
        assertTrue(text.contentDescription.contains("завершено"))
    }

    @Test
    fun activeAndUpcomingRowsHaveNoStatusTag() {
        val active = OutageRowFormat.format("uk", rowsOf(planned(at(13, 11), at(13, 13)), today).single())
        assertNull(active.statusTag)
        assertFalse(active.isFinished)
    }

    @Test
    fun emergencyRowHasTextTagAndDescription() {
        val outage = Outage(
            id = "e1", kind = OutageKind.EMERGENCY, start = at(13, 10), end = at(13, 14), endIsEstimate = true
        )
        val text = OutageRowFormat.format("uk", rowsOf(outage, today).single())
        assertTrue(text.isEmergency)
        assertEquals("Аварійне", text.kindTag)
        assertEquals("10:00 – 14:00", text.timeText)
        assertEquals("4${nbsp}год", text.durationText)
        assertEquals("Аварійне, 10:00 – 14:00, 4${nbsp}год", text.contentDescription)
    }

    @Test
    fun overdueEmergencyHasNoEndAndNoDuration() {
        val outage = Outage(
            id = "e2", kind = OutageKind.EMERGENCY, start = at(13, 10), end = noon,
            endIsEstimate = true, overdue = true
        )
        val text = OutageRowFormat.format("uk", rowsOf(outage, today).single())
        assertEquals("10:00 – --:--", text.timeText)
        assertNull(text.durationText)
        assertEquals("очікується відновлення", text.statusTag)
        assertEquals("Аварійне", text.kindTag)
    }

    @Test
    fun staleEmergencyIsFinished() {
        val outage = Outage(
            id = "e3", kind = OutageKind.EMERGENCY, start = at(13, 8), end = at(13, 9),
            endIsEstimate = true, stale = true
        )
        val text = OutageRowFormat.format("uk", rowsOf(outage, today).single())
        assertTrue(text.isFinished)
        assertEquals("завершено", text.statusTag)
    }

    @Test
    fun repairWorksRowHasWrenchKindAndPlannedWorksTag() {
        val outage = Outage(id = "r1", kind = OutageKind.REPAIR, start = at(13, 8), end = at(13, 17))
        val text = OutageRowFormat.format("uk", rowsOf(outage, today).single())
        assertTrue(text.isRepair)
        assertEquals("Планові роботи", text.kindTag)
        assertEquals("08:00 – 17:00", text.timeText)
        assertEquals("9${nbsp}год", text.durationText)
    }

    @Test
    fun partialHoursUseHoursAndMinutes() {
        val text = OutageRowFormat.format("uk", rowsOf(planned(at(13, 14), at(13, 15, 30)), today).single())
        assertEquals("1${nbsp}год 30${nbsp}хв", text.durationText)
    }

    @Test
    fun mayContinueIsTaggedUntilFinished() {
        val text = OutageRowFormat.format("uk", rowsOf(planned(at(13, 20), at(14, 0), mayContinue = true), today).single())
        assertEquals("можливе продовження", text.continueTag)
        val past = OutageRowFormat.format(
            "uk", rowsOf(planned(at(13, 2), at(13, 4), mayContinue = true), today).single()
        )
        assertNull(past.continueTag)
    }

    @Test
    fun englishTexts() {
        val outage = planned(at(13, 23), at(14, 1))
        val tomorrowText = OutageRowFormat.format("en", rowsOf(outage, tomorrow).single())
        assertEquals("2${nbsp}h", tomorrowText.durationText)
        assertEquals("from 13.11 23:00", tomorrowText.originTag)
        val emergency = Outage(id = "e", kind = OutageKind.EMERGENCY, start = at(13, 10), end = at(13, 14), endIsEstimate = true)
        assertEquals("Emergency", OutageRowFormat.format("en", rowsOf(emergency, today).single()).kindTag)
        val repair = Outage(id = "r", kind = OutageKind.REPAIR, start = at(13, 8), end = at(13, 17))
        assertEquals("Planned works", OutageRowFormat.format("en", rowsOf(repair, today).single()).kindTag)
    }

    // ---- drum summary --------------------------------------------------------------------------

    private fun cells(planned: IntRange = IntRange.EMPTY, emergency: IntRange = IntRange.EMPTY): List<BlackoutSlot> =
        (0 until 48).map { i ->
            val p = i in planned
            val e = i in emergency
            val start = "%02d:%02d".format(i / 2, (i % 2) * 30)
            val endMin = (i + 1) * 30
            val end = if (endMin >= 1440) "24:00" else "%02d:%02d".format(endMin / 60, endMin % 60)
            BlackoutSlot(
                id = "slot_$i",
                startHour = i / 2,
                endHour = endMin / 60,
                startMinute = (i % 2) * 30,
                endMinute = endMin % 60,
                startTimeStr = start,
                endTimeStr = end,
                status = if (p || e) SlotStatus.POWER_OFF else SlotStatus.POWER_ON,
                isEmergency = e,
                isPlanned = p
            )
        }

    @Test
    fun drumSummaryListsPlannedAndEmergencyRuns() {
        val text = OutageRowFormat.drumSummary("uk", cells(planned = 0..3, emergency = 20..23), unclearBase = false)
        assertEquals("Шкала доби: без світла: 00:00 – 02:00, 10:00 – 12:00 (аварійне)", text)
    }

    @Test
    fun drumSummaryEndsAtTwentyFourAndMergesPlannedWithEmergency() {
        val text = OutageRowFormat.drumSummary("en", cells(planned = 44..47, emergency = 46..47), unclearBase = false)
        assertEquals("Day timeline: no power: 22:00 – 24:00 (emergency)", text)
    }

    @Test
    fun drumSummaryForQuietAndUnclearDays() {
        assertEquals("Шкала доби: відключень немає", OutageRowFormat.drumSummary("uk", cells(), unclearBase = false))
        assertEquals("Шкала доби: Графіки не діють", OutageRowFormat.drumSummary("uk", cells(), unclearBase = true))
        assertEquals("Шкала доби: Графіки не діють", OutageRowFormat.drumSummary("uk", emptyList(), unclearBase = false))
        assertEquals(
            "Day timeline: Outages unclear; no power: 10:00 – 11:00 (emergency)",
            OutageRowFormat.drumSummary("en", cells(emergency = 20..21), unclearBase = true)
        )
    }
}
