package ua.blackout.prewarning.core

import java.time.LocalDate
import java.time.LocalDateTime

/** One row of `pw_accidents` / `pw_accident_planeds` from the PowerOn API, reduced to plain types. */
data class PowerOnRow(
    val id: Long,
    val cityId: Int?,
    val cityName: String,
    val streetId: Int?,
    val streetName: String,
    val dateEvent: String,
    val datePlanIn: String,
    val koment: String?,
    /** 2 = mirror of the hourly schedule (GPV), anything else is a real emergency. Absent on planned works. */
    val switchSubReason: Int?,
    val typeOff: Int?,
    /** Comma separated list of affected buildings on the street. */
    val buildingNames: String
)

/**
 * Maps PowerOn rows to outages for one house. See `spec/POWERON_API.md`.
 *
 * PowerOn timestamps look like `2026-11-12T22:04:40+00:00` but are Kyiv wall-clock time with a wrong
 * offset label (verified: the mirror of queue 3.1 reads 22:04 to 00:04 while ztoe shows 22:00-24:00).
 * The offset is therefore ignored, never converted.
 */
object PowerOnMapper {
    private val ISO = Regex("^\\s*(\\d{4})-(\\d{2})-(\\d{2})[T ](\\d{2}):(\\d{2})(?::\\d{2}(?:\\.\\d+)?)?")

    /** Minute precision; the `+00:00` / `Z` suffix is deliberately dropped. */
    fun parseTime(raw: String?): LocalDateTime? {
        val m = ISO.find(raw ?: return null) ?: return null
        return runCatching {
            LocalDateTime.of(
                m.groupValues[1].toInt(), m.groupValues[2].toInt(), m.groupValues[3].toInt(),
                m.groupValues[4].toInt(), m.groupValues[5].toInt()
            )
        }.getOrNull()
    }

    /** Real emergencies for [house] (switchSubReason != 2), merged per start time. */
    fun emergencyRecordsFor(rows: List<PowerOnRow>, house: String): List<EmergencyRecord> {
        val byId = LinkedHashMap<String, EmergencyRecord>()
        for (row in rows) {
            if (row.switchSubReason == 2) continue
            if (!HouseKey.listContains(row.buildingNames, house)) continue
            val start = parseTime(row.dateEvent) ?: continue
            val est = parseTime(row.datePlanIn)?.takeIf { it.isAfter(start) }
            val id = "pw_$start"
            val label = row.koment?.trim()?.takeIf { it.isNotEmpty() }
            val old = byId[id]
            byId[id] = if (old == null) {
                EmergencyRecord(id, start, est, null, label)
            } else {
                old.copy(
                    estimatedEnd = listOfNotNull(old.estimatedEnd, est).maxOrNull(),
                    label = old.label ?: label
                )
            }
        }
        return byId.values.sortedBy { it.start }
    }

    /** Planned repair works for [house]; treated as planned outages. Rows beyond tomorrow are dropped. */
    fun repairOutagesFor(rows: List<PowerOnRow>, house: String, today: LocalDate): List<Outage> {
        val byId = LinkedHashMap<String, Outage>()
        val limit = today.plusDays(2).atStartOfDay()
        for (row in rows) {
            if (!HouseKey.listContains(row.buildingNames, house)) continue
            val start = parseTime(row.dateEvent) ?: continue
            val end = parseTime(row.datePlanIn) ?: continue
            if (!end.isAfter(start) || !start.isBefore(limit)) continue
            val id = "repair_$start"
            val label = row.koment?.trim()?.takeIf { it.isNotEmpty() }
            val old = byId[id]
            byId[id] = if (old == null) {
                Outage(id, OutageKind.REPAIR, start, end, label = label)
            } else {
                old.copy(end = if (end.isAfter(old.end)) end else old.end, label = old.label ?: label)
            }
        }
        return byId.values.sortedBy { it.start }
    }
}
