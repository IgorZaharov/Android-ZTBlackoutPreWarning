package ua.blackout.prewarning.core

import ua.blackout.prewarning.data.KYIV_ZONE
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.temporal.ChronoUnit

/**
 * The single source of truth for "what is off when". Pure functions over a two-day window
 * (yesterday tail, today, tomorrow) of absolute Kyiv wall-clock instants, so an outage that
 * crosses midnight is one block with its real length everywhere: list, drum, countdown, alerts.
 *
 * Rules are specified in `spec/OUTAGE_ENGINE.md` and verified by the JSON files in `spec/vectors/`.
 */
object OutageEngine {

    // ---------------------------------------------------------------------------------------------
    // Building outages
    // ---------------------------------------------------------------------------------------------

    /** Accepts 48 half-hour cells or 24 hourly cells and returns 48, or null for anything else. */
    fun normalizeSlots(raw: List<Boolean>?): List<Boolean>? = when (raw?.size) {
        48 -> raw
        24 -> raw!!.flatMap { listOf(it, it) }
        else -> null
    }

    /**
     * Turns the ztoe day tables (true = power off) into planned outages. Contiguous off-cells are one
     * outage even across midnight when both days are known. A block that touches the end of the
     * last known day, whose next day is unknown, is flagged [Outage.mayContinue].
     */
    fun buildPlanned(
        today: LocalDate,
        todayOff: List<Boolean>?,
        tomorrowOff: List<Boolean>?,
        yesterdayOff: List<Boolean>? = null
    ): List<Outage> {
        val days: List<Pair<LocalDate, List<Boolean>>> = listOf(
            today.minusDays(1) to normalizeSlots(yesterdayOff),
            today to normalizeSlots(todayOff),
            today.plusDays(1) to normalizeSlots(tomorrowOff)
        ).mapNotNull { (d, s) -> s?.let { d to it } }
        if (days.isEmpty()) return emptyList()

        val knownDates = days.map { it.first }.toSet()
        val out = ArrayList<Outage>()
        var runStart: LocalDateTime? = null

        fun close(end: LocalDateTime, mayContinue: Boolean) {
            val s = runStart ?: return
            out.add(Outage(id = "planned_$s", kind = OutageKind.PLANNED, start = s, end = end, mayContinue = mayContinue))
            runStart = null
        }

        for ((day, slots) in days) {
            val dayStart = day.atStartOfDay()
            for (i in 0 until OutageConfig.SLOTS_PER_DAY) {
                val slotStart = dayStart.plusMinutes(i.toLong() * OutageConfig.SLOT_MINUTES)
                if (slots[i]) {
                    if (runStart == null) runStart = slotStart
                } else {
                    close(slotStart, mayContinue = false)
                }
            }
            if (runStart != null && day.plusDays(1) !in knownDates) {
                close(day.plusDays(1).atStartOfDay(), mayContinue = true)
            }
        }
        return out
    }

    /**
     * Resolves one emergency record against [now]. A listed outage past its estimated restore is
     * OVERDUE (still active) for [graceMinutes], then STALE (finished, never alerts).
     */
    fun resolveEmergency(
        rec: EmergencyRecord,
        now: LocalDateTime,
        graceMinutes: Long = OutageConfig.OVERDUE_GRACE_MINUTES
    ): Outage {
        val est = rec.estimatedEnd
        val closed = rec.closedAt
        var end: LocalDateTime
        var overdue = false
        var stale = false
        var isEstimate = false
        when {
            closed != null -> end = if (closed.isAfter(rec.start)) closed else rec.start
            est == null -> {
                end = if (now.isAfter(rec.start)) now else rec.start
                overdue = !now.isBefore(rec.start)
                isEstimate = true
            }
            now.isBefore(est) -> {
                end = est
                isEstimate = true
            }
            else -> {
                val overdueMinutes = ChronoUnit.MINUTES.between(est, now)
                isEstimate = true
                if (overdueMinutes <= graceMinutes) {
                    end = if (now.isAfter(est)) now else est
                    overdue = true
                } else {
                    end = est
                    stale = true
                }
            }
        }
        if (end.isBefore(rec.start)) end = rec.start
        return Outage(
            id = rec.id,
            kind = OutageKind.EMERGENCY,
            start = rec.start,
            end = end,
            endIsEstimate = isEstimate,
            overdue = overdue,
            stale = stale,
            label = rec.label
        )
    }

    /** Keeps only outages that touch [yesterday 00:00, tomorrow+1 00:00). Rows dated further ahead are ignored. */
    fun inWindow(outages: List<Outage>, today: LocalDate): List<Outage> {
        val from = today.minusDays(1).atStartOfDay()
        val to = today.plusDays(2).atStartOfDay()
        return outages.filter { it.start.isBefore(to) && it.end.isAfter(from) }
    }

    // ---------------------------------------------------------------------------------------------
    // Spans, day views, status
    // ---------------------------------------------------------------------------------------------

    /** Union of the outages of [kinds] (all kinds when null); touching or overlapping outages merge. */
    fun spans(outages: List<Outage>, kinds: Set<OutageKind>? = null): List<Span> {
        val items = outages
            .filter { (kinds == null || it.kind in kinds) && it.end.isAfter(it.start) }
            .sortedBy { it.start }
        val result = ArrayList<Span>()
        var curStart: LocalDateTime? = null
        var curEnd: LocalDateTime? = null
        var curMay = false
        var curKinds = LinkedHashSet<OutageKind>()
        for (o in items) {
            if (curStart == null || curEnd == null) {
                curStart = o.start
                curEnd = o.end
                curMay = o.mayContinue
                curKinds = linkedSetOf(o.kind)
            } else if (!o.start.isAfter(curEnd)) {
                if (o.end.isAfter(curEnd)) {
                    curEnd = o.end
                    curMay = o.mayContinue
                } else if (o.end == curEnd) {
                    curMay = curMay || o.mayContinue
                }
                curKinds.add(o.kind)
            } else {
                result.add(Span(curStart, curEnd, curMay, curKinds))
                curStart = o.start
                curEnd = o.end
                curMay = o.mayContinue
                curKinds = linkedSetOf(o.kind)
            }
        }
        if (curStart != null && curEnd != null) result.add(Span(curStart, curEnd, curMay, curKinds))
        return result
    }

    fun minutesBetween(a: LocalDateTime, b: LocalDateTime, zone: ZoneId = KYIV_ZONE): Long =
        ChronoUnit.MINUTES.between(a.atZone(zone), b.atZone(zone))

    fun secondsBetween(a: LocalDateTime, b: LocalDateTime, zone: ZoneId = KYIV_ZONE): Long =
        ChronoUnit.SECONDS.between(a.atZone(zone), b.atZone(zone))

    private fun maxOf(a: LocalDateTime, b: LocalDateTime) = if (a.isAfter(b)) a else b
    private fun minOf(a: LocalDateTime, b: LocalDateTime) = if (a.isBefore(b)) a else b

    /** The drum cells and list rows for one calendar day. Finished outages stay (history); they just never alert. */
    fun dayView(
        outages: List<Outage>,
        date: LocalDate,
        now: LocalDateTime,
        zone: ZoneId = KYIV_ZONE
    ): DayView {
        val dayStart = date.atStartOfDay()
        val dayEnd = date.plusDays(1).atStartOfDay()
        val relevant = outages.filter { it.end.isAfter(it.start) && it.start.isBefore(dayEnd) && it.end.isAfter(dayStart) }

        val slots = (0 until OutageConfig.SLOTS_PER_DAY).map { i ->
            val s = dayStart.plusMinutes(i.toLong() * OutageConfig.SLOT_MINUTES)
            val e = s.plusMinutes(OutageConfig.SLOT_MINUTES.toLong())
            SlotState(
                planned = relevant.any { it.isPlannedLike && it.start.isBefore(e) && it.end.isAfter(s) },
                emergency = relevant.any { it.kind == OutageKind.EMERGENCY && it.start.isBefore(e) && it.end.isAfter(s) }
            )
        }

        val rows = relevant
            .map { o ->
                val from = maxOf(o.start, dayStart)
                val to = minOf(o.end, dayEnd)
                DayRow(
                    outage = o,
                    from = from,
                    to = to,
                    status = o.statusAt(now),
                    continuesFromPrevDay = o.start.isBefore(dayStart),
                    continuesToNextDay = o.end.isAfter(dayEnd),
                    durationMinutes = minutesBetween(o.start, o.end, zone),
                    inDayMinutes = minutesBetween(from, to, zone)
                )
            }
            .sortedWith(compareBy<DayRow> { it.from }.thenBy { it.outage.kind.ordinal })

        val clipped = relevant.map { it.copy(start = maxOf(it.start, dayStart), end = minOf(it.end, dayEnd)) }
        val total = spans(clipped).sumOf { minutesBetween(it.start, it.end, zone) }
        return DayView(date, slots, rows, total)
    }

    private fun p2(n: Number): String = n.toString().padStart(2, '0')

    /** "HH:mm" (ASCII digits whatever the device locale); an end of exactly 00:00 reads "24:00". */
    fun formatSpanTime(t: LocalDateTime): String =
        if (t.toLocalTime() == LocalTime.MIDNIGHT) "24:00" else "${p2(t.hour)}:${p2(t.minute)}"

    fun formatSpan(span: Span): String =
        "${p2(span.start.hour)}:${p2(span.start.minute)} – ${formatSpanTime(span.end)}"

    fun formatCountdown(totalSeconds: Long): String {
        val s = totalSeconds.coerceAtLeast(0L)
        return "${p2(s / 3600)}:${p2((s % 3600) / 60)}:${p2(s % 60)}"
    }

    /** Power state, countdown and next/current period from [now]. Stale emergencies never count as off. */
    fun status(
        outages: List<Outage>,
        now: LocalDateTime,
        zone: ZoneId = KYIV_ZONE
    ): StatusInfo {
        // An overdue emergency has no known end: treat it as lasting just past now so it is "current".
        val openEnd = now.plusSeconds(1)
        val effective = outages
            .filter { !it.stale }
            .map { if (it.overdue) it.copy(end = openEnd) else it }
        val all = spans(effective)
        val current = all.firstOrNull { !now.isBefore(it.start) && now.isBefore(it.end) }

        if (current != null) {
            if (current.end == openEnd && effective.any { it.overdue }) {
                return StatusInfo(
                    isOffNow = true,
                    countdownSeconds = null,
                    countdownText = "--:--:--",
                    nextSlotTime = "${p2(current.start.hour)}:${p2(current.start.minute)} – --:--",
                    currentSpan = current.copy(end = now),
                    nextSpan = null
                )
            }
            val secs = secondsBetween(now, current.end, zone)
            return StatusInfo(true, secs, formatCountdown(secs), formatSpan(current), current, null)
        }
        val next = all.firstOrNull { it.start.isAfter(now) }
        if (next != null) {
            val secs = secondsBetween(now, next.start, zone)
            return StatusInfo(false, secs, formatCountdown(secs), formatSpan(next), null, next)
        }
        return StatusInfo(false, null, "--:--:--", "Відключень немає", null, null)
    }

    // ---------------------------------------------------------------------------------------------
    // Alerts and widget transitions
    // ---------------------------------------------------------------------------------------------

    /**
     * One pre-warning per merged planned span (planned and repair works only), keyed by the span's
     * absolute start. Spans already started, or whose alert time has passed, never alert; a 00:00
     * continuation never gets its own alert because it is part of the earlier span.
     */
    fun planAlerts(
        outages: List<Outage>,
        now: LocalDateTime,
        advanceMinutes: Int,
        zone: ZoneId = KYIV_ZONE
    ): List<AlertSpec> {
        val plannedSpans = spans(outages.filter { !it.stale }, setOf(OutageKind.PLANNED, OutageKind.REPAIR))
        val emergencies = outages.filter { it.kind == OutageKind.EMERGENCY && !it.stale }
        return plannedSpans.mapNotNull { sp ->
            if (!sp.start.isAfter(now)) return@mapNotNull null
            // One continuous outage, one warning (spec/OUTAGE_ENGINE.md 6.2 step 2a): an emergency that started
            // before the block and is still on at its start means power is already off
            if (emergencies.any { it.start.isBefore(sp.start) && (it.overdue || !it.end.isBefore(sp.start)) }) return@mapNotNull null
            val fireAt = sp.start.minusMinutes(advanceMinutes.toLong())
            if (!fireAt.isAfter(now)) return@mapNotNull null
            AlertSpec(
                key = "planned_${sp.start}",
                fireAt = fireAt,
                spanStart = sp.start,
                spanEnd = sp.end,
                mayContinue = sp.mayContinue,
                durationMinutes = minutesBetween(sp.start, sp.end, zone)
            )
        }
    }

    /** The planned and repair spans of an address (not stale): what its pre-warnings are about. */
    fun plannedSpans(outages: List<Outage>): List<Span> =
        spans(outages.filter { !it.stale }, setOf(OutageKind.PLANNED, OutageKind.REPAIR))

    /**
     * Whether an emergency event is announced when emergency and scheduled outages of one address form
     * one continuous outage (spec/NOTIFICATIONS.md 2.4a): only its beginning is announced, a longer
     * emergency inside a warned block becomes a prolongation, and the end is not "restored" while the
     * schedule keeps the power off.
     */
    fun emergencyDelivery(
        kind: EmergencyEventKind,
        start: LocalDateTime,
        eta: LocalDateTime?,
        now: LocalDateTime,
        plannedSpans: List<Span>,
        plannedAlertsOn: Boolean
    ): EmergencyDelivery = when (kind) {
        EmergencyEventKind.ETA_CHANGED -> EmergencyDelivery.SEND
        EmergencyEventKind.END ->
            if (plannedSpans.any { !it.start.isAfter(now) && now.isBefore(it.end) }) EmergencyDelivery.DROP else EmergencyDelivery.SEND
        EmergencyEventKind.START -> {
            val holder = if (plannedAlertsOn) plannedSpans.firstOrNull { !it.start.isAfter(start) && !start.isAfter(it.end) } else null
            when {
                holder == null -> EmergencyDelivery.SEND
                eta != null && eta.isAfter(holder.end) -> EmergencyDelivery.PROLONG
                else -> EmergencyDelivery.DROP
            }
        }
    }

    /** Instants where the power state flips (all kinds, stale excluded), inclusive of [from] and [to]. */
    fun transitions(outages: List<Outage>, from: LocalDateTime, to: LocalDateTime): List<Transition> =
        spans(outages.filter { !it.stale && !it.overdue })
            .flatMap { listOf(Transition(it.start, true), Transition(it.end, false)) }
            .filter { !it.at.isBefore(from) && !it.at.isAfter(to) }
            .sortedBy { it.at }
}

/** How one emergency event is announced within a continuous outage (spec/NOTIFICATIONS.md 2.4a). */
enum class EmergencyDelivery { SEND, PROLONG, DROP }
