package ua.blackout.prewarning.ui.components

import ua.blackout.prewarning.core.DayRow
import ua.blackout.prewarning.core.IntervalStatus
import ua.blackout.prewarning.core.OutageEngine
import ua.blackout.prewarning.core.OutageKind
import ua.blackout.prewarning.data.model.BlackoutSlot
import ua.blackout.prewarning.data.model.SlotStatus
import ua.blackout.prewarning.ui.AppStrings
import java.time.LocalDateTime

/**
 * Pure text rules of the outage list under the drum (spec/UI_DRUM.md section 5): one row per outage
 * with its full span, the date on the far side of midnight, kind and state tags. No Android types, so
 * it is unit tested (OutageRowFormatTest) and mirrored by the web simulator.
 */
object OutageRowFormat {

    data class RowText(
        val kind: OutageKind,
        /** "10:00 – 12:00", "23:00 – 01:00 (14.11)", "00:00 – 01:00", "10:00 – --:--" for an overdue emergency. */
        val timeText: String,
        /** Full length of the outage ("2 год"); null when the end is unknown (overdue emergency). */
        val durationText: String?,
        /** "Аварійне" / "Планові роботи"; null for a plain planned outage (the dot is its marker). */
        val kindTag: String?,
        /** "з 13.11 23:00" on the day an outage continues into. */
        val originTag: String?,
        /** "завершено" / "очікується відновлення". */
        val statusTag: String?,
        /** "можливе продовження" when the real end is later than the known schedule. */
        val continueTag: String?,
        val isFinished: Boolean,
        val isEmergency: Boolean,
        val isRepair: Boolean,
        /** One sentence for TalkBack: kind, time, duration and tags. */
        val contentDescription: String
    )

    private fun p2(n: Int) = n.toString().padStart(2, '0')

    fun hhmm(t: LocalDateTime): String = "${p2(t.hour)}:${p2(t.minute)}"

    fun dayMonth(t: LocalDateTime): String = "${p2(t.dayOfMonth)}.${p2(t.monthValue)}"

    /** End of an outage that leaves the day, with the date it really ends on; exactly 00:00 reads "24:00" of the day before. */
    private fun endWithDate(end: LocalDateTime): String =
        if (end.toLocalTime() == java.time.LocalTime.MIDNIGHT) {
            "24:00 (${dayMonth(end.minusDays(1))})"
        } else {
            "${hhmm(end)} (${dayMonth(end)})"
        }

    fun kindLabel(lang: String, kind: OutageKind): String = when (kind) {
        OutageKind.EMERGENCY -> AppStrings.kindEmergency(lang)
        OutageKind.REPAIR -> AppStrings.kindRepair(lang)
        OutageKind.PLANNED -> AppStrings.kindPlanned(lang)
    }

    fun format(lang: String, row: DayRow): RowText {
        val o = row.outage
        val overdue = row.status == IntervalStatus.OVERDUE
        val finished = row.status == IntervalStatus.FINISHED

        val startText = if (row.continuesFromPrevDay) "00:00" else hhmm(row.from)
        val endText = when {
            overdue -> "--:--"
            row.continuesToNextDay -> endWithDate(o.end)
            else -> OutageEngine.formatSpanTime(row.to)
        }
        val timeText = "$startText – $endText"
        val durationText = if (overdue) null else AppStrings.durationText(lang, row.durationMinutes)
        val kindTag = when (o.kind) {
            OutageKind.EMERGENCY -> AppStrings.kindEmergency(lang)
            OutageKind.REPAIR -> AppStrings.kindRepair(lang)
            OutageKind.PLANNED -> null
        }
        val originTag = if (row.continuesFromPrevDay) {
            AppStrings.rowFromEarlier(lang, "${dayMonth(o.start)} ${hhmm(o.start)}")
        } else {
            null
        }
        val statusTag = when (row.status) {
            IntervalStatus.FINISHED -> AppStrings.rowFinished(lang)
            IntervalStatus.OVERDUE -> AppStrings.rowOverdue(lang)
            else -> null
        }
        val continueTag = if (o.mayContinue && !finished) AppStrings.rowMayContinue(lang) else null

        val description = listOfNotNull(kindLabel(lang, o.kind), timeText, durationText, originTag, statusTag, continueTag)
            .joinToString(", ")

        return RowText(
            kind = o.kind,
            timeText = timeText,
            durationText = durationText,
            kindTag = kindTag,
            originTag = originTag,
            statusTag = statusTag,
            continueTag = continueTag,
            isFinished = finished,
            isEmergency = o.kind == OutageKind.EMERGENCY,
            isRepair = o.kind == OutageKind.REPAIR,
            contentDescription = description
        )
    }

    /** Contiguous runs of off half-hours of a day as (first cell, last cell exclusive, any emergency). */
    private data class Run(val from: Int, val to: Int, val emergency: Boolean)

    private fun cellsOf(slots: List<BlackoutSlot>): List<BlackoutSlot>? = when (slots.size) {
        48 -> slots
        24 -> slots.flatMap { listOf(it, it) }
        else -> null
    }

    private fun runs(cells: List<BlackoutSlot>): List<Run> {
        val out = ArrayList<Run>()
        var start = -1
        var emergency = false
        for (i in cells.indices) {
            val off = cells[i].status == SlotStatus.POWER_OFF
            if (off) {
                if (start < 0) {
                    start = i
                    emergency = false
                }
                if (cells[i].isEmergency) emergency = true
            } else if (start >= 0) {
                out.add(Run(start, i, emergency))
                start = -1
            }
        }
        if (start >= 0) out.add(Run(start, cells.size, emergency))
        return out
    }

    private fun cellTime(index: Int): String {
        val minutes = index * 30
        return if (minutes >= 1440) "24:00" else "${p2(minutes / 60)}:${p2(minutes % 60)}"
    }

    /**
     * One TalkBack sentence for the whole drum, replacing the 48 silent cells:
     * "Шкала доби: без світла: 00:00 – 02:00, 10:00 – 12:00 (аварійне)".
     * [unclearBase] is true when the schedule of the day is not known (grey drum).
     */
    fun drumSummary(lang: String, slots: List<BlackoutSlot>, unclearBase: Boolean): String {
        val head = AppStrings.drumTitle(lang)
        val cells = cellsOf(slots) ?: return "$head: ${AppStrings.outagesUnclear(lang)}"
        val found = runs(cells)
        val spans = found.joinToString(", ") { r ->
            val text = "${cellTime(r.from)} – ${cellTime(r.to)}"
            if (r.emergency) "$text (${AppStrings.drumEmergencyMark(lang)})" else text
        }
        val parts = ArrayList<String>()
        if (unclearBase) parts.add(AppStrings.outagesUnclear(lang))
        if (found.isNotEmpty()) {
            parts.add(AppStrings.drumPowerOffAt(lang, spans))
        } else if (!unclearBase) {
            parts.add(AppStrings.drumNoOutages(lang))
        }
        return "$head: ${parts.joinToString("; ")}"
    }
}
