package ua.blackout.prewarning.core

import java.time.LocalDateTime

/**
 * Platform-neutral outage model. Everything in `core/` is pure Kotlin (java.time only) so the same
 * rules can be ported to TypeScript and Swift and verified against the JSON files in `spec/vectors/`.
 *
 * All instants are Kyiv wall-clock [LocalDateTime]s. Durations are measured as elapsed time in the
 * Kyiv zone so a span over a DST night is counted correctly.
 */
object OutageConfig {
    const val SLOTS_PER_DAY = 48
    const val SLOT_MINUTES = 30

    /** An emergency still listed by PowerOn this long after its estimated restore is "overdue" (still active). */
    const val OVERDUE_GRACE_MINUTES = 60L

    /** Ledger entries older than this (since last sighting or close) are dropped. */
    const val LEDGER_RETENTION_HOURS = 48L

    /** A changed restore estimate notifies only when it moved by at least this much. */
    const val ETA_CHANGE_MIN_DELTA_MINUTES = 10L
}

/** What produced an outage. REPAIR (PowerOn planned works) is treated like PLANNED for alerts. */
enum class OutageKind { PLANNED, REPAIR, EMERGENCY }

enum class IntervalStatus { FINISHED, ACTIVE, UPCOMING, OVERDUE }

data class Outage(
    val id: String,
    val kind: OutageKind,
    val start: LocalDateTime,
    /** Effective end. For a listed emergency past its estimate this is "now" while within the grace. */
    val end: LocalDateTime,
    /** The block touches the end of the known schedule window, so the real end may be later. */
    val mayContinue: Boolean = false,
    val endIsEstimate: Boolean = false,
    /** Emergency still listed after its estimated restore, within the grace: treated as active. */
    val overdue: Boolean = false,
    /** Emergency still listed but beyond the grace: shown as finished, never alerts. */
    val stale: Boolean = false,
    val label: String? = null
) {
    val isPlannedLike: Boolean get() = kind == OutageKind.PLANNED || kind == OutageKind.REPAIR

    fun statusAt(now: LocalDateTime): IntervalStatus = when {
        stale -> IntervalStatus.FINISHED
        now.isBefore(start) -> IntervalStatus.UPCOMING
        overdue -> IntervalStatus.OVERDUE
        now.isBefore(end) -> IntervalStatus.ACTIVE
        else -> IntervalStatus.FINISHED
    }
}

/** One emergency outage as observed from PowerOn (or restored from the ledger). */
data class EmergencyRecord(
    val id: String,
    val start: LocalDateTime,
    val estimatedEnd: LocalDateTime?,
    /** Set by the ledger when a confirmed fetch no longer lists the outage. */
    val closedAt: LocalDateTime? = null,
    val label: String? = null
)

/** A maximal union of outages that touch or overlap. */
data class Span(
    val start: LocalDateTime,
    val end: LocalDateTime,
    val mayContinue: Boolean,
    val kinds: Set<OutageKind>
)

/** State of one half-hour cell of a day on the drum chart. */
data class SlotState(val planned: Boolean, val emergency: Boolean) {
    val off: Boolean get() = planned || emergency
}

/** One outage as it appears in a day's list, clipped to that day. */
data class DayRow(
    val outage: Outage,
    val from: LocalDateTime,
    val to: LocalDateTime,
    val status: IntervalStatus,
    val continuesFromPrevDay: Boolean,
    val continuesToNextDay: Boolean,
    /** Full length of the outage in minutes (not clipped to the day). */
    val durationMinutes: Long,
    /** Minutes of the outage that fall inside this day. */
    val inDayMinutes: Long
)

data class DayView(
    val date: java.time.LocalDate,
    val slots: List<SlotState>,
    val rows: List<DayRow>,
    /** Union of all kinds, clipped to the day, in elapsed minutes. */
    val totalOffMinutes: Long
)

data class StatusInfo(
    val isOffNow: Boolean,
    val countdownSeconds: Long?,
    /** HH:MM:SS, or "--:--:--" when nothing is ahead. */
    val countdownText: String,
    /** "HH:mm – HH:mm" of the current or next span, or "Відключень немає". */
    val nextSlotTime: String,
    val currentSpan: Span?,
    val nextSpan: Span?
)

data class AlertSpec(
    val key: String,
    val fireAt: LocalDateTime,
    val spanStart: LocalDateTime,
    val spanEnd: LocalDateTime,
    val mayContinue: Boolean,
    val durationMinutes: Long
)

data class Transition(val at: LocalDateTime, val isOff: Boolean)
