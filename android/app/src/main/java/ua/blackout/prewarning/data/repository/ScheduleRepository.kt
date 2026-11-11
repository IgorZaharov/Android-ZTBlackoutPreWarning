package ua.blackout.prewarning.data.repository

import android.content.Context
import android.content.SharedPreferences
import ua.blackout.prewarning.data.model.BlackoutSlot
import ua.blackout.prewarning.data.model.EmergencyOutageInfo
import ua.blackout.prewarning.data.model.SlotStatus
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import ua.blackout.prewarning.data.KYIV_ZONE

data class ScheduleStatusInfo(
    val isBlackoutNow: Boolean,
    val countdownText: String,
    val nextSlotTime: String,
    val totalBlackoutHours: Double = 0.0,
    val isUnclear: Boolean = false
) {
    constructor(
        isBlackoutNow: Boolean,
        countdownText: String,
        nextSlotTime: String,
        isUnclear: Boolean
    ) : this(
        isBlackoutNow = isBlackoutNow,
        countdownText = countdownText,
        nextSlotTime = nextSlotTime,
        totalBlackoutHours = 0.0,
        isUnclear = isUnclear
    )
}

data class OutageInterval(
    val startStr: String,
    val endStr: String,
    val durationHours: Double,
    val startMinuteOfDay: Int = 0,
    val endMinuteOfDay: Int = 1440,
    val isEmergency: Boolean = false
)

class ScheduleRepository(context: Context) {
    private val appContext: Context = context.applicationContext
    private val prefs: SharedPreferences =
        appContext.getSharedPreferences("zt_schedule_cache_v2", Context.MODE_PRIVATE)

    companion object {
        const val MAX_INTERVAL_CACHE_ENTRIES = 64

        fun StatusAndCountdown(
            isBlackoutNow: Boolean,
            countdownText: String,
            nextSlotTime: String,
            isUnclear: Boolean = false
        ): ScheduleStatusInfo = ScheduleStatusInfo(
            isBlackoutNow = isBlackoutNow,
            countdownText = countdownText,
            nextSlotTime = nextSlotTime,
            totalBlackoutHours = 0.0,
            isUnclear = isUnclear
        )

        // Process-wide in-memory cache of decoded slots and intervals to eliminate
        // 48 BlackoutSlot allocations and 96 String.format calls on every 1-second UI countdown tick
        private val decodedSlotsCache = java.util.concurrent.ConcurrentHashMap<String, List<BlackoutSlot>>()
        private val detailedIntervalsCache = java.util.concurrent.ConcurrentHashMap<String, List<OutageInterval>>()

        private val ZTOE_DATE_TIME_REGEX = Regex("""(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?\s+(\d{1,2}):(\d{2})""")
        private val ISO_DATE_TIME_REGEX = Regex("""(\d{4})-(\d{2})-(\d{2})[\sT]+(\d{1,2}):(\d{2})""")
        private val TIME_ONLY_REGEX = Regex("""(\d{1,2}):(\d{2})""")

        private fun parseZtoeDateTimeMinutes(str: String?, defaultYear: Int = LocalDate.now(KYIV_ZONE).year): Pair<LocalDate?, Int>? {
            if (str.isNullOrBlank()) return null
            val trimmed = str.trim()
            val dmyMatch = ZTOE_DATE_TIME_REGEX.find(trimmed)
            if (dmyMatch != null) {
                val day = dmyMatch.groupValues[1].toIntOrNull() ?: return null
                val month = dmyMatch.groupValues[2].toIntOrNull() ?: return null
                val rawYear = dmyMatch.groupValues[3].takeIf { it.isNotEmpty() }?.toIntOrNull()
                val year = when {
                    rawYear == null -> defaultYear
                    rawYear < 100 -> 2000 + rawYear
                    else -> rawYear
                }
                val hour = dmyMatch.groupValues[4].toIntOrNull() ?: return null
                val minute = dmyMatch.groupValues[5].toIntOrNull() ?: return null
                val date = runCatching { LocalDate.of(year, month, day) }.getOrNull()
                return date to (hour * 60 + minute).coerceIn(0, 1440)
            }
            val isoMatch = ISO_DATE_TIME_REGEX.find(trimmed)
            if (isoMatch != null) {
                val year = isoMatch.groupValues[1].toIntOrNull() ?: defaultYear
                val month = isoMatch.groupValues[2].toIntOrNull() ?: return null
                val day = isoMatch.groupValues[3].toIntOrNull() ?: return null
                val hour = isoMatch.groupValues[4].toIntOrNull() ?: return null
                val minute = isoMatch.groupValues[5].toIntOrNull() ?: return null
                val date = runCatching { LocalDate.of(year, month, day) }.getOrNull()
                return date to (hour * 60 + minute).coerceIn(0, 1440)
            }
            val timeMatch = TIME_ONLY_REGEX.find(trimmed)
            if (timeMatch != null) {
                val hour = timeMatch.groupValues[1].toIntOrNull() ?: return null
                val minute = timeMatch.groupValues[2].toIntOrNull() ?: return null
                if (hour in 0..24 && minute in 0..59) {
                    return null to (hour * 60 + minute).coerceIn(0, 1440)
                }
            }
            return null
        }

        fun applyEmergencyOutageToSlots(
            slots: List<BlackoutSlot>,
            targetDateIso: String,
            emergencyOutage: EmergencyOutageInfo?,
            queue: String = "",
            isTomorrow: Boolean = false
        ): List<BlackoutSlot> {
            val parsedDate = runCatching { LocalDate.parse(targetDateIso, DateTimeFormatter.ISO_LOCAL_DATE) }
                .getOrNull() ?: LocalDate.now(KYIV_ZONE)
            return applyEmergencyOutageToSlots(
                slots = slots,
                emergencyOutage = emergencyOutage,
                targetDate = parsedDate,
                isTomorrow = isTomorrow,
                queue = queue
            )
        }

        fun applyEmergencyOutageToSlots(
            slots: List<BlackoutSlot>,
            emergencyOutage: EmergencyOutageInfo?,
            targetDate: LocalDate = LocalDate.now(KYIV_ZONE),
            isTomorrow: Boolean = false,
            queue: String = ""
        ): List<BlackoutSlot> {
            if (emergencyOutage == null) return slots
            val startParsed = parseZtoeDateTimeMinutes(emergencyOutage.startTime, targetDate.year) ?: return slots
            val endParsed = parseZtoeDateTimeMinutes(emergencyOutage.estimatedRestoreTime, targetDate.year) ?: return slots

            val startDate = startParsed.first
            val endDate = endParsed.first
            val startMin = startParsed.second
            val endMin = endParsed.second

            var overlap: Pair<Int, Int>? = null
            if (startDate != null && endDate != null) {
                if (startDate == endDate) {
                    if (isTomorrow) {
                        if (targetDate == startDate) {
                            overlap = startMin to endMin
                        }
                    } else {
                        // Active emergency outage on Today's schedule always applies to Today's timeline
                        overlap = startMin to endMin
                    }
                } else if (startDate < endDate) {
                    when {
                        targetDate == startDate -> overlap = startMin to 1440
                        targetDate == endDate -> overlap = 0 to endMin
                        targetDate > startDate && targetDate < endDate -> overlap = 0 to 1440
                        !isTomorrow && targetDate < endDate -> overlap = startMin to 1440
                        isTomorrow && targetDate > startDate && targetDate != endDate.plusDays(1) -> overlap = 0 to endMin
                    }
                }
            } else {
                if (startMin < endMin) {
                    if (!isTomorrow) {
                        overlap = startMin to endMin
                    }
                } else {
                    overlap = if (!isTomorrow) {
                        startMin to 1440
                    } else {
                        0 to endMin
                    }
                }
            }

            val resolvedOverlap = overlap ?: return slots
            val overlapStartMin = resolvedOverlap.first.coerceIn(0, 1440)
            val overlapEndMin = resolvedOverlap.second.coerceIn(0, 1440)
            if (overlapEndMin <= overlapStartMin) {
                return slots
            }

            val dateStr = targetDate.format(DateTimeFormatter.ISO_LOCAL_DATE)
            val baseSlots = if (slots.isNotEmpty()) {
                slots
            } else {
                (0 until 48).map { index ->
                    val startTotalMin = index * 30
                    val endTotalMin = (index + 1) * 30
                    val startH = startTotalMin / 60
                    val startM = startTotalMin % 60
                    val endH = endTotalMin / 60
                    val endM = endTotalMin % 60
                    val startStr = String.format("%02d:%02d", startH, startM)
                    val endStr = if (endH >= 24) "24:00" else String.format("%02d:%02d", endH, endM)
                    BlackoutSlot(
                        id = "${dateStr}_${startStr}_Q${queue.ifEmpty { "emergency" }}",
                        startHour = startH,
                        endHour = endH,
                        startMinute = startM,
                        endMinute = endM,
                        startTimeStr = startStr,
                        endTimeStr = endStr,
                        status = SlotStatus.POWER_ON,
                        isEmergency = false
                    )
                }
            }

            val totalSlots = baseSlots.size
            val minutesPerSlot = 1440 / totalSlots
            return baseSlots.mapIndexed { idx, slot ->
                val slotStart = idx * minutesPerSlot
                val slotEnd = (idx + 1) * minutesPerSlot
                if (slotEnd > overlapStartMin && slotStart < overlapEndMin) {
                    slot.copy(status = SlotStatus.POWER_OFF, isEmergency = true)
                } else {
                    slot
                }
            }
        }

        fun applyEmergencyOutageToSchedule(
            slots: List<BlackoutSlot>,
            emergencyOutage: EmergencyOutageInfo?,
            targetDate: LocalDate = LocalDate.now(KYIV_ZONE),
            isTomorrow: Boolean = false,
            queue: String = ""
        ): List<BlackoutSlot> {
            return applyEmergencyOutageToSlots(slots, emergencyOutage, targetDate, isTomorrow, queue)
        }

        fun computeDetailedIntervals(slots: List<BlackoutSlot>): List<OutageInterval> {
            if (slots.isEmpty()) return emptyList()
            val cacheKey = buildString(slots.size + 4) {
                append(slots.size)
                append('_')
                for (s in slots) {
                    val ch = when {
                        s.status != SlotStatus.POWER_OFF -> '0'
                        s.isEmergency -> 'E'
                        else -> '1'
                    }
                    append(ch)
                }
            }
            detailedIntervalsCache[cacheKey]?.let { return it }

            val list = mutableListOf<OutageInterval>()
            val totalSlots = slots.size
            val minutesPerSlot = 1440 / totalSlots
            var inBlock = false
            var startIdx = 0
            var hasEmergencyInBlock = false

            for (i in 0 until totalSlots) {
                val slot = slots[i]
                val isOff = slot.status == SlotStatus.POWER_OFF
                if (isOff && !inBlock) {
                    inBlock = true
                    startIdx = i
                    hasEmergencyInBlock = slot.isEmergency
                } else if (isOff && inBlock) {
                    if (slot.isEmergency) {
                        hasEmergencyInBlock = true
                    }
                } else if (!isOff && inBlock) {
                    inBlock = false
                    val startMin = startIdx * minutesPerSlot
                    val endMin = i * minutesPerSlot
                    val sStr = String.format("%02d:%02d", startMin / 60, startMin % 60)
                    val eStr = if (endMin >= 1440) "24:00" else String.format("%02d:%02d", endMin / 60, endMin % 60)
                    val duration = (i - startIdx) * (minutesPerSlot / 60.0)
                    list.add(OutageInterval(sStr, eStr, duration, startMin, endMin, hasEmergencyInBlock))
                    hasEmergencyInBlock = false
                }
            }
            if (inBlock) {
                val startMin = startIdx * minutesPerSlot
                val sStr = String.format("%02d:%02d", startMin / 60, startMin % 60)
                val duration = (totalSlots - startIdx) * (minutesPerSlot / 60.0)
                list.add(OutageInterval(sStr, "24:00", duration, startMin, 1440, hasEmergencyInBlock))
            }

            if (detailedIntervalsCache.size > MAX_INTERVAL_CACHE_ENTRIES) {
                detailedIntervalsCache.clear()
            }
            detailedIntervalsCache[cacheKey] = list
            return list
        }

        fun calculateStatusAndCountdown(
            slots: List<BlackoutSlot>,
            tomorrowSlots: List<BlackoutSlot>?,
            now: LocalTime
        ): ScheduleStatusInfo {
            val currentMinutes = now.hour * 60 + now.minute
            val currentSeconds = now.second

            if (slots.isEmpty()) {
                return ScheduleStatusInfo(
                    isBlackoutNow = false,
                    countdownText = "--:--:--",
                    nextSlotTime = "--:-- - --:--",
                    totalBlackoutHours = 0.0,
                    isUnclear = true
                )
            }

            val totalSlots = slots.size
            val minutesPerSlot = 1440 / totalSlots
            val currentSlotIdx = (currentMinutes / minutesPerSlot).coerceIn(0, totalSlots - 1)
            val isBlackoutNow = slots[currentSlotIdx].status == SlotStatus.POWER_OFF
            val intervals = computeDetailedIntervals(slots)
            val totalBlackoutHours = intervals.sumOf { it.durationHours }

            if (isBlackoutNow) {
                var targetSlotIdx = -1
                for (i in (currentSlotIdx + 1) until totalSlots) {
                    if (slots[i].status == SlotStatus.POWER_ON) {
                        targetSlotIdx = i
                        break
                    }
                }

                var crossMidnightEndStr: String? = null
                val targetMinutes = if (targetSlotIdx != -1) {
                    targetSlotIdx * minutesPerSlot
                } else if (tomorrowSlots != null && tomorrowSlots.isNotEmpty() && tomorrowSlots[0].status == SlotStatus.POWER_OFF) {
                    val tomorrowMinutesPerSlot = 1440 / tomorrowSlots.size
                    val tomorrowOnIdx = tomorrowSlots.indexOfFirst { it.status == SlotStatus.POWER_ON }
                    val tomorrowIntervals = computeDetailedIntervals(tomorrowSlots)
                    crossMidnightEndStr = tomorrowIntervals.firstOrNull { it.startMinuteOfDay == 0 }?.endStr
                    if (tomorrowOnIdx != -1) {
                        1440 + tomorrowOnIdx * tomorrowMinutesPerSlot
                    } else {
                        2880
                    }
                } else {
                    1440
                }

                val remainingMinutes = (targetMinutes - currentMinutes - 1).coerceAtLeast(0)
                val remainingSeconds = 60 - currentSeconds
                val totalSecsLeft = remainingMinutes * 60 + remainingSeconds
                val h = totalSecsLeft / 3600
                val m = (totalSecsLeft % 3600) / 60
                val s = totalSecsLeft % 60
                val countdownText = String.format("%02d:%02d:%02d", h, m, s)

                val activePeriod = intervals.firstOrNull {
                    currentMinutes in it.startMinuteOfDay until it.endMinuteOfDay
                }?.let {
                    val displayEnd = if (it.endMinuteOfDay >= 1440 && !crossMidnightEndStr.isNullOrBlank()) {
                        crossMidnightEndStr
                    } else {
                        it.endStr
                    }
                    "${it.startStr} – $displayEnd"
                } ?: slots[currentSlotIdx].let { "${it.startTimeStr} – ${it.endTimeStr}" }

                return ScheduleStatusInfo(
                    isBlackoutNow = true,
                    countdownText = countdownText,
                    nextSlotTime = activePeriod,
                    totalBlackoutHours = totalBlackoutHours
                )
            }

            // Power is currently ON: find next blackout in remainder of today
            var targetSlotIdx = -1
            for (i in (currentSlotIdx + 1) until totalSlots) {
                if (slots[i].status == SlotStatus.POWER_OFF) {
                    targetSlotIdx = i
                    break
                }
            }

            if (targetSlotIdx != -1) {
                val targetMinutes = targetSlotIdx * minutesPerSlot
                val remainingMinutes = (targetMinutes - currentMinutes - 1).coerceAtLeast(0)
                val remainingSeconds = 60 - currentSeconds
                val totalSecsLeft = remainingMinutes * 60 + remainingSeconds
                val h = totalSecsLeft / 3600
                val m = (totalSecsLeft % 3600) / 60
                val s = totalSecsLeft % 60
                val countdownText = String.format("%02d:%02d:%02d", h, m, s)

                val nextPeriod = intervals.firstOrNull {
                    it.startMinuteOfDay > currentMinutes
                }?.let { "${it.startStr} – ${it.endStr}" } ?: "Відключень немає"

                return ScheduleStatusInfo(
                    isBlackoutNow = false,
                    countdownText = countdownText,
                    nextSlotTime = nextPeriod,
                    totalBlackoutHours = totalBlackoutHours
                )
            }

            // No more blackouts today: check tomorrow's schedule if available
            val tomorrowOffIdx = tomorrowSlots?.indexOfFirst { it.status == SlotStatus.POWER_OFF } ?: -1
            if (tomorrowSlots != null && tomorrowSlots.isNotEmpty() && tomorrowOffIdx != -1) {
                val tomorrowMinutesPerSlot = 1440 / tomorrowSlots.size
                val targetMinutes = 1440 + tomorrowOffIdx * tomorrowMinutesPerSlot
                val remainingMinutes = (targetMinutes - currentMinutes - 1).coerceAtLeast(0)
                val remainingSeconds = 60 - currentSeconds
                val totalSecsLeft = remainingMinutes * 60 + remainingSeconds
                val h = totalSecsLeft / 3600
                val m = (totalSecsLeft % 3600) / 60
                val s = totalSecsLeft % 60
                val countdownText = String.format("%02d:%02d:%02d", h, m, s)

                val tomorrowIntervals = computeDetailedIntervals(tomorrowSlots)
                val nextPeriod = tomorrowIntervals.firstOrNull()?.let { "${it.startStr} – ${it.endStr}" } ?: "Відключень немає"

                return ScheduleStatusInfo(
                    isBlackoutNow = false,
                    countdownText = countdownText,
                    nextSlotTime = nextPeriod,
                    totalBlackoutHours = totalBlackoutHours
                )
            }

            // No more blackouts for today and no schedule (or no blackouts) for tomorrow
            return ScheduleStatusInfo(
                isBlackoutNow = false,
                countdownText = "--:--:--",
                nextSlotTime = "Відключень немає",
                totalBlackoutHours = totalBlackoutHours
            )
        }
    }

    fun saveSchedule(queue: String, todaySlots: List<BlackoutSlot>, tomorrowSlots: List<BlackoutSlot>?) {
        if (queue.isBlank()) return
        val editor = prefs.edit()
        val kyivZone = KYIV_ZONE
        val today = LocalDate.now(kyivZone)
        val todayStr = today.format(DateTimeFormatter.ISO_LOCAL_DATE)
        val tomorrowStr = today.plusDays(1).format(DateTimeFormatter.ISO_LOCAL_DATE)

        // Store serialized slot statuses as a simple 48-char string of '0' (ON) and '1' (OFF)
        val todayEncoded = todaySlots.joinToString("") { if (it.status == SlotStatus.POWER_OFF) "1" else "0" }
        editor.putString("cache_today_date", todayStr)
        editor.putString("cache_today_date_$queue", todayStr)
        editor.putString("cache_today_queue", queue)
        editor.putString("cache_today_slots_$queue", todayEncoded)
        editor.putLong("cache_last_sync_ms", System.currentTimeMillis())

        if (tomorrowSlots != null && tomorrowSlots.isNotEmpty()) {
            val tomorrowEncoded = tomorrowSlots.joinToString("") { if (it.status == SlotStatus.POWER_OFF) "1" else "0" }
            editor.putString("cache_tomorrow_date_$queue", tomorrowStr)
            editor.putString("cache_tomorrow_slots_$queue", tomorrowEncoded)
            editor.putBoolean("cache_has_tomorrow_$queue", true)
        } else {
            editor.remove("cache_tomorrow_date_$queue")
            editor.remove("cache_tomorrow_slots_$queue")
            editor.putBoolean("cache_has_tomorrow_$queue", false)
        }
        editor.apply()
    }

    /**
     * Saves all 12 queues in a single SharedPreferences transaction using asynchronous apply()
     * instead of 12 separate synchronous disk commits.
     */
    fun saveAllSchedulesBatch(
        schedules: Map<String, Pair<List<BlackoutSlot>, List<BlackoutSlot>?>>,
        activeQueue: String
    ) {
        if (schedules.isEmpty()) return
        val editor = prefs.edit()
        val kyivZone = KYIV_ZONE
        val today = LocalDate.now(kyivZone)
        val todayStr = today.format(DateTimeFormatter.ISO_LOCAL_DATE)
        val tomorrowStr = today.plusDays(1).format(DateTimeFormatter.ISO_LOCAL_DATE)
        editor.putString("cache_today_date", todayStr)
        editor.putString("cache_today_queue", activeQueue)
        editor.putLong("cache_last_sync_ms", System.currentTimeMillis())

        for ((queue, pair) in schedules) {
            val (todaySlots, tomorrowSlots) = pair
            val todayEncoded = todaySlots.joinToString("") { if (it.status == SlotStatus.POWER_OFF) "1" else "0" }
            editor.putString("cache_today_date_$queue", todayStr)
            editor.putString("cache_today_slots_$queue", todayEncoded)

            if (tomorrowSlots != null && tomorrowSlots.isNotEmpty()) {
                val tomorrowEncoded = tomorrowSlots.joinToString("") { if (it.status == SlotStatus.POWER_OFF) "1" else "0" }
                editor.putString("cache_tomorrow_date_$queue", tomorrowStr)
                editor.putString("cache_tomorrow_slots_$queue", tomorrowEncoded)
                editor.putBoolean("cache_has_tomorrow_$queue", true)
            } else {
                editor.remove("cache_tomorrow_date_$queue")
                editor.remove("cache_tomorrow_slots_$queue")
                editor.putBoolean("cache_has_tomorrow_$queue", false)
            }
        }
        editor.apply()
    }

    fun isCacheFresh(refreshIntervalMinutes: Long): Boolean {
        val lastSyncMs = prefs.getLong("cache_last_sync_ms", 0L)
        if (lastSyncMs <= 0L) return false
        val maxAgeMs = (refreshIntervalMinutes.coerceAtLeast(5L) * 60_000L) - 30_000L
        return (System.currentTimeMillis() - lastSyncMs) in 0..maxAgeMs
    }

    private fun promoteTomorrowCacheOnMidnightRolloverIfNeeded(queue: String, today: LocalDate) {
        if (queue.isBlank()) return
        val todayStr = today.format(DateTimeFormatter.ISO_LOCAL_DATE)
        val yesterdayStr = today.minusDays(1).format(DateTimeFormatter.ISO_LOCAL_DATE)
        val cachedDate = prefs.getString("cache_today_date_$queue", prefs.getString("cache_today_date", null))
        val cachedTomorrowDate = prefs.getString("cache_tomorrow_date_$queue", null)
        val cachedTomorrowEncoded = prefs.getString("cache_tomorrow_slots_$queue", null)

        // Midnight rollover: promote cached tomorrow schedule into today when date crosses 00:00 Kyiv time
        if (cachedDate == yesterdayStr && cachedTomorrowDate == todayStr && !cachedTomorrowEncoded.isNullOrEmpty()) {
            prefs.edit()
                .putString("cache_today_date", todayStr)
                .putString("cache_today_date_$queue", todayStr)
                .putString("cache_today_slots_$queue", cachedTomorrowEncoded)
                .remove("cache_tomorrow_date_$queue")
                .remove("cache_tomorrow_slots_$queue")
                .putBoolean("cache_has_tomorrow_$queue", false)
                .apply()
        }
    }

    fun getEncodedTodaySlots(queue: String): String {
        if (queue.isBlank()) return ""
        val today = LocalDate.now(KYIV_ZONE)
        promoteTomorrowCacheOnMidnightRolloverIfNeeded(queue, today)
        val todayStr = today.format(DateTimeFormatter.ISO_LOCAL_DATE)
        val cachedDate = prefs.getString("cache_today_date_$queue", prefs.getString("cache_today_date", null))
        val cachedEncoded = prefs.getString("cache_today_slots_$queue", null)
        if (cachedDate == todayStr && !cachedEncoded.isNullOrEmpty()) {
            return cachedEncoded
        }
        return ""
    }

    fun hasValidTodayCache(queue: String): Boolean {
        if (queue.isBlank()) return false
        val today = LocalDate.now(KYIV_ZONE)
        promoteTomorrowCacheOnMidnightRolloverIfNeeded(queue, today)
        val todayStr = today.format(DateTimeFormatter.ISO_LOCAL_DATE)
        val cachedDate = prefs.getString("cache_today_date_$queue", prefs.getString("cache_today_date", null))
        val cachedEncoded = prefs.getString("cache_today_slots_$queue", null)
        return cachedDate == todayStr && !cachedEncoded.isNullOrEmpty() && cachedEncoded.length >= 24
    }

    fun clearScheduleCache() {
        prefs.edit().clear().apply()
    }

    fun getTodaySlots(queue: String): List<BlackoutSlot> {
        if (queue.isBlank()) return emptyList()
        val kyivZone = KYIV_ZONE
        val today = LocalDate.now(kyivZone)
        promoteTomorrowCacheOnMidnightRolloverIfNeeded(queue, today)
        val todayStr = today.format(DateTimeFormatter.ISO_LOCAL_DATE)
        val cachedDate = prefs.getString("cache_today_date_$queue", prefs.getString("cache_today_date", null))
        val cachedEncoded = prefs.getString("cache_today_slots_$queue", null)

        if (cachedDate == todayStr && !cachedEncoded.isNullOrEmpty() && cachedEncoded.length >= 24) {
            return decodeSlotsCached(cachedEncoded, queue, todayStr)
        }
        return emptyList()
    }

    fun getTomorrowSlots(queue: String): List<BlackoutSlot>? {
        if (queue.isBlank()) return null
        val kyivZone = KYIV_ZONE
        val today = LocalDate.now(kyivZone)
        promoteTomorrowCacheOnMidnightRolloverIfNeeded(queue, today)
        val todayStr = today.format(DateTimeFormatter.ISO_LOCAL_DATE)
        val tomorrowStr = today.plusDays(1).format(DateTimeFormatter.ISO_LOCAL_DATE)
        val cachedTodayDate = prefs.getString("cache_today_date_$queue", prefs.getString("cache_today_date", null))
        val cachedTomorrowDate = prefs.getString("cache_tomorrow_date_$queue", null)
        val hasTomorrow = prefs.getBoolean("cache_has_tomorrow_$queue", false)
        val cachedEncoded = prefs.getString("cache_tomorrow_slots_$queue", null)

        val isDateValid = cachedTodayDate == todayStr && (cachedTomorrowDate == null || cachedTomorrowDate == tomorrowStr)
        if (isDateValid && hasTomorrow && !cachedEncoded.isNullOrEmpty() && cachedEncoded.length >= 24) {
            return decodeSlotsCached(cachedEncoded, queue, tomorrowStr)
        }
        return null
    }

    fun hasTomorrowSchedule(queue: String): Boolean {
        return getTomorrowSlots(queue) != null
    }

    fun getSharedPreferences(): SharedPreferences = prefs

    private fun decodeSlotsCached(encoded: String, queue: String, dateStr: String): List<BlackoutSlot> {
        val cacheKey = "${dateStr}_${queue}_$encoded"
        decodedSlotsCache[cacheKey]?.let { return it }

        val totalSlots = encoded.length
        val minutesPerSlot = 1440 / totalSlots

        val decoded = (0 until totalSlots).map { index ->
            val isOff = encoded[index] == '1'
            val startTotalMin = index * minutesPerSlot
            val endTotalMin = (index + 1) * minutesPerSlot

            val startH = startTotalMin / 60
            val startM = startTotalMin % 60
            val endH = endTotalMin / 60
            val endM = endTotalMin % 60

            val startStr = String.format("%02d:%02d", startH, startM)
            val endStr = if (endH >= 24) "24:00" else String.format("%02d:%02d", endH, endM)

            BlackoutSlot(
                id = "${dateStr}_${startStr}_Q$queue",
                startHour = startH,
                endHour = endH,
                startMinute = startM,
                endMinute = endM,
                startTimeStr = startStr,
                endTimeStr = endStr,
                status = if (isOff) SlotStatus.POWER_OFF else SlotStatus.POWER_ON
            )
        }

        if (decodedSlotsCache.size > MAX_INTERVAL_CACHE_ENTRIES) {
            decodedSlotsCache.clear()
        }
        decodedSlotsCache[cacheKey] = decoded
        return decoded
    }

    // Common calculation of blackout intervals from any slot list (today or tomorrow)
    fun getIntervals(slots: List<BlackoutSlot>): List<Pair<String, String>> {
        val detailed = getDetailedIntervals(slots)
        return detailed.map { Pair(it.startStr, it.endStr) }
    }

    fun getDetailedIntervals(slots: List<BlackoutSlot>): List<OutageInterval> {
        return computeDetailedIntervals(slots)
    }

    // Common status and countdown calculation for Today's schedule (including active emergency outage overlap)
    fun getCurrentStatusAndCountdown(
        queue: String,
        emergencyOutage: EmergencyOutageInfo? = null
    ): ScheduleStatusInfo {
        val today = LocalDate.now(KYIV_ZONE)
        val baseTodaySlots = getTodaySlots(queue)
        val baseTomorrowSlots = getTomorrowSlots(queue)
        val effectiveTodaySlots = applyEmergencyOutageToSlots(baseTodaySlots, emergencyOutage, today, isTomorrow = false, queue = queue)
        val effectiveTomorrowSlots = if (baseTomorrowSlots != null || emergencyOutage != null) {
            applyEmergencyOutageToSlots(baseTomorrowSlots ?: emptyList(), emergencyOutage, today.plusDays(1), isTomorrow = true, queue = queue)
                .takeIf { it.isNotEmpty() && (baseTomorrowSlots != null || it.any { s -> s.status == SlotStatus.POWER_OFF }) }
        } else {
            null
        }
        val now = LocalTime.now(KYIV_ZONE)
        return calculateStatusAndCountdown(effectiveTodaySlots, effectiveTomorrowSlots, now)
    }

    /**
     * Computes the "Наступне відключення" ("Next blackout") interval text for the Big Widget.
     */
    fun getNextUpcomingIntervalText(
        queue: String,
        emergencyOutage: EmergencyOutageInfo? = null
    ): String {
        val today = LocalDate.now(KYIV_ZONE)
        val todaySlots = applyEmergencyOutageToSlots(getTodaySlots(queue), emergencyOutage, today, isTomorrow = false, queue = queue)
        if (todaySlots.isEmpty()) {
            return "--:-- - --:--"
        }
        val now = LocalTime.now(KYIV_ZONE)
        val currentMinutes = now.hour * 60 + now.minute
        val todayIntervals = getDetailedIntervals(todaySlots)

        val nextToday = todayIntervals.firstOrNull { interval ->
            interval.startMinuteOfDay > currentMinutes
        }
        if (nextToday != null) {
            return "${nextToday.startStr} – ${nextToday.endStr}"
        }

        val baseTomorrowSlots = getTomorrowSlots(queue)
        val tomorrowSlots = if (baseTomorrowSlots != null || emergencyOutage != null) {
            applyEmergencyOutageToSlots(baseTomorrowSlots ?: emptyList(), emergencyOutage, today.plusDays(1), isTomorrow = true, queue = queue)
                .takeIf { it.isNotEmpty() && (baseTomorrowSlots != null || it.any { s -> s.status == SlotStatus.POWER_OFF }) }
        } else {
            null
        }
        if (tomorrowSlots != null) {
            val tomorrowIntervals = getDetailedIntervals(tomorrowSlots)
            val firstTomorrow = tomorrowIntervals.firstOrNull()
            if (firstTomorrow != null) {
                return "Завтра ${firstTomorrow.startStr} – ${firstTomorrow.endStr}"
            }
        }

        return if (todayIntervals.isEmpty()) "Відключень немає" else "Сьогодні більше немає"
    }
}
