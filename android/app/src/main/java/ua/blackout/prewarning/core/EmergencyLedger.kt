package ua.blackout.prewarning.core

import java.time.LocalDateTime
import java.time.temporal.ChronoUnit
import kotlin.math.abs

/** Result of asking PowerOn about one address. An empty confirmed list means "no emergency", not "failed". */
sealed interface EmergencyFetch {
    data class Confirmed(val records: List<EmergencyRecord>) : EmergencyFetch
    data class Unavailable(val reason: String) : EmergencyFetch
}

/** One emergency outage seen for an address, with what has already been announced about it. */
data class LedgerEntry(
    val id: String,
    val start: LocalDateTime,
    val estimatedEnd: LocalDateTime?,
    val label: String?,
    val firstSeen: LocalDateTime,
    val lastSeen: LocalDateTime,
    val closedAt: LocalDateTime?,
    val startEmitted: Boolean,
    val endEmitted: Boolean,
    val lastEmittedEta: LocalDateTime?
)

enum class EmergencyEventKind { START, ETA_CHANGED, END }

data class EmergencyEvent(
    val kind: EmergencyEventKind,
    val entryId: String,
    val start: LocalDateTime,
    val eta: LocalDateTime?,
    /** START only: the outage begins in the future. */
    val upcoming: Boolean = false,
    /** END only: it disappeared before its estimated restore (restored early or cancelled). */
    val earlyEnd: Boolean = false
) {
    /** Platform-neutral dedupe key, see `spec/NOTIFICATIONS.md`. */
    fun key(addressKey: String): String = when (kind) {
        EmergencyEventKind.START -> "emerg_start_${addressKey}_$start"
        EmergencyEventKind.ETA_CHANGED -> "emerg_change_${addressKey}_${start}_$eta"
        EmergencyEventKind.END -> "emerg_end_${addressKey}_$start"
    }
}

data class LedgerResult(val entries: List<LedgerEntry>, val events: List<EmergencyEvent>)

/**
 * Remembers emergencies per address so that:
 *  - a failed fetch never looks like "power restored" (Unavailable changes nothing),
 *  - an outage that was already over when first seen never alerts,
 *  - finished emergencies of today stay listable (PowerOn keeps no history),
 *  - each transition (start / eta changed / end) is announced exactly once.
 */
object EmergencyLedger {

    fun reconcile(
        entries: List<LedgerEntry>,
        fetch: EmergencyFetch,
        now: LocalDateTime,
        graceMinutes: Long = OutageConfig.OVERDUE_GRACE_MINUTES
    ): LedgerResult {
        val pruned = prune(entries, now)
        if (fetch is EmergencyFetch.Unavailable) return LedgerResult(pruned, emptyList())
        fetch as EmergencyFetch.Confirmed

        val byId = pruned.associateBy { it.id }
        val events = ArrayList<EmergencyEvent>()
        val out = LinkedHashMap<String, LedgerEntry>()
        val seen = HashSet<String>()

        for (rec in fetch.records) {
            if (!seen.add(rec.id)) continue
            val resolved = OutageEngine.resolveEmergency(rec.copy(closedAt = null), now, graceMinutes)
            val old = byId[rec.id]
            when {
                old == null -> {
                    if (resolved.stale) {
                        out[rec.id] = newEntry(rec, now, announced = true)
                    } else {
                        out[rec.id] = newEntry(rec, now, announced = false)
                        events.add(EmergencyEvent(EmergencyEventKind.START, rec.id, rec.start, rec.estimatedEnd, upcoming = now.isBefore(rec.start)))
                    }
                }
                old.closedAt != null -> {
                    if (resolved.stale) {
                        out[rec.id] = old.copy(lastSeen = now)
                    } else {
                        out[rec.id] = newEntry(rec, now, announced = false).copy(firstSeen = old.firstSeen)
                        events.add(EmergencyEvent(EmergencyEventKind.START, rec.id, rec.start, rec.estimatedEnd, upcoming = now.isBefore(rec.start)))
                    }
                }
                else -> {
                    var e = old.copy(lastSeen = now, estimatedEnd = rec.estimatedEnd, label = rec.label ?: old.label)
                    if (!resolved.stale && old.startEmitted && !old.endEmitted) {
                        val newEta = rec.estimatedEnd
                        val last = old.lastEmittedEta
                        if (newEta != null && last == null) {
                            e = e.copy(lastEmittedEta = newEta)
                        } else if (newEta != null && last != null &&
                            abs(ChronoUnit.MINUTES.between(last, newEta)) >= OutageConfig.ETA_CHANGE_MIN_DELTA_MINUTES
                        ) {
                            events.add(EmergencyEvent(EmergencyEventKind.ETA_CHANGED, rec.id, rec.start, newEta))
                            e = e.copy(lastEmittedEta = newEta)
                        }
                    }
                    out[rec.id] = e
                }
            }
        }

        for (old in pruned) {
            if (old.id in seen) continue
            if (old.closedAt != null) {
                out[old.id] = old
                continue
            }
            val est = old.estimatedEnd
            val wasStale = est != null && ChronoUnit.MINUTES.between(est, now) > graceMinutes
            val silent = old.endEmitted || wasStale || !old.startEmitted
            out[old.id] = old.copy(closedAt = now, endEmitted = true)
            if (!silent) {
                events.add(EmergencyEvent(EmergencyEventKind.END, old.id, old.start, est, earlyEnd = est != null && now.isBefore(est)))
            }
        }
        return LedgerResult(out.values.toList(), events)
    }

    private fun newEntry(rec: EmergencyRecord, now: LocalDateTime, announced: Boolean) = LedgerEntry(
        id = rec.id,
        start = rec.start,
        estimatedEnd = rec.estimatedEnd,
        label = rec.label,
        firstSeen = now,
        lastSeen = now,
        closedAt = null,
        startEmitted = true,
        endEmitted = announced,
        lastEmittedEta = rec.estimatedEnd
    )

    fun prune(entries: List<LedgerEntry>, now: LocalDateTime): List<LedgerEntry> {
        val cutoff = now.minusHours(OutageConfig.LEDGER_RETENTION_HOURS)
        return entries.filter { (it.closedAt ?: it.lastSeen).isAfter(cutoff) }
    }

    /** Ledger entries as outages for the engine (active, overdue, stale and closed ones alike). */
    fun outages(entries: List<LedgerEntry>, now: LocalDateTime): List<Outage> = entries.map {
        OutageEngine.resolveEmergency(EmergencyRecord(it.id, it.start, it.estimatedEnd, it.closedAt, it.label), now)
    }
}
