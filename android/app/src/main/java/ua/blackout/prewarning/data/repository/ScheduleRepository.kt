package ua.blackout.prewarning.data.repository

import android.content.Context
import android.content.SharedPreferences
import ua.blackout.prewarning.data.model.BlackoutSlot
import ua.blackout.prewarning.data.model.SlotStatus
import ua.blackout.prewarning.data.parser.ZtoeParser
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
)

data class OutageInterval(
    val startStr: String,
    val endStr: String,
    val durationHours: Double,
    val startMinuteOfDay: Int = 0,
    val endMinuteOfDay: Int = 1440
)

class ScheduleRepository(context: Context) {
    private val appContext: Context = context.applicationContext
    private val prefs: SharedPreferences =
        appContext.getSharedPreferences("zt_schedule_cache_v2", Context.MODE_PRIVATE)

    companion object {
        // Process-wide in-memory cache of decoded slots and intervals to eliminate
        // 48 BlackoutSlot allocations and 96 String.format calls on every 1-second UI countdown tick
        private val decodedSlotsCache = java.util.concurrent.ConcurrentHashMap<String, List<BlackoutSlot>>()
        private val detailedIntervalsCache = java.util.concurrent.ConcurrentHashMap<String, List<OutageInterval>>()

        fun computeDetailedIntervals(slots: List<BlackoutSlot>): List<OutageInterval> {
            if (slots.isEmpty()) return emptyList()
            val cacheKey = buildString(slots.size + 4) {
                append(slots.size)
                append('_')
                for (s in slots) {
                    append(if (s.status == SlotStatus.POWER_OFF) '1' else '0')
                }
            }
            detailedIntervalsCache[cacheKey]?.let { return it }

            val list = mutableListOf<OutageInterval>()
            val totalSlots = slots.size
            val minutesPerSlot = 1440 / totalSlots
            var inBlock = false
            var startIdx = 0

            for (i in 0 until totalSlots) {
                val isOff = slots[i].status == SlotStatus.POWER_OFF
                if (isOff && !inBlock) {
                    inBlock = true
                    startIdx = i
                } else if (!isOff && inBlock) {
                    inBlock = false
                    val startMin = startIdx * minutesPerSlot
                    val endMin = i * minutesPerSlot
                    val sStr = String.format("%02d:%02d", startMin / 60, startMin % 60)
                    val eStr = if (endMin >= 1440) "24:00" else String.format("%02d:%02d", endMin / 60, endMin % 60)
                    val duration = (i - startIdx) * (minutesPerSlot / 60.0)
                    list.add(OutageInterval(sStr, eStr, duration, startMin, endMin))
                }
            }
            if (inBlock) {
                val startMin = startIdx * minutesPerSlot
                val sStr = String.format("%02d:%02d", startMin / 60, startMin % 60)
                val duration = (totalSlots - startIdx) * (minutesPerSlot / 60.0)
                list.add(OutageInterval(sStr, "24:00", duration, startMin, 1440))
            }

            if (detailedIntervalsCache.size > 64) {
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

                val targetMinutes = if (targetSlotIdx != -1) {
                    targetSlotIdx * minutesPerSlot
                } else if (tomorrowSlots != null && tomorrowSlots.isNotEmpty() && tomorrowSlots[0].status == SlotStatus.POWER_OFF) {
                    val tomorrowMinutesPerSlot = 1440 / tomorrowSlots.size
                    val tomorrowOnIdx = tomorrowSlots.indexOfFirst { it.status == SlotStatus.POWER_ON }
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
                }?.let { "${it.startStr} – ${it.endStr}" }
                    ?: slots[currentSlotIdx].let { "${it.startTimeStr} – ${it.endTimeStr}" }

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

    fun getEncodedTodaySlots(queue: String): String {
        val todayStr = LocalDate.now(KYIV_ZONE).format(DateTimeFormatter.ISO_LOCAL_DATE)
        val cachedDate = prefs.getString("cache_today_date_$queue", prefs.getString("cache_today_date", null))
        val cachedEncoded = prefs.getString("cache_today_slots_$queue", null)
        if (cachedDate == todayStr && !cachedEncoded.isNullOrEmpty()) {
            return cachedEncoded
        }
        return ""
    }

    fun hasValidTodayCache(queue: String): Boolean {
        val todayStr = LocalDate.now(KYIV_ZONE).format(DateTimeFormatter.ISO_LOCAL_DATE)
        val cachedDate = prefs.getString("cache_today_date_$queue", prefs.getString("cache_today_date", null))
        val cachedEncoded = prefs.getString("cache_today_slots_$queue", null)
        return cachedDate == todayStr && !cachedEncoded.isNullOrEmpty() && cachedEncoded.length >= 24
    }

    fun clearScheduleCache() {
        prefs.edit().clear().apply()
    }

    fun getTodaySlots(queue: String): List<BlackoutSlot> {
        val kyivZone = KYIV_ZONE
        val today = LocalDate.now(kyivZone)
        val todayStr = today.format(DateTimeFormatter.ISO_LOCAL_DATE)
        val cachedDate = prefs.getString("cache_today_date_$queue", prefs.getString("cache_today_date", null))
        val cachedEncoded = prefs.getString("cache_today_slots_$queue", null)

        if (cachedDate == todayStr && !cachedEncoded.isNullOrEmpty() && cachedEncoded.length >= 24) {
            return decodeSlotsCached(cachedEncoded, queue, todayStr)
        }
        return emptyList()
    }

    fun getTomorrowSlots(queue: String): List<BlackoutSlot>? {
        val kyivZone = KYIV_ZONE
        val today = LocalDate.now(kyivZone)
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

        if (decodedSlotsCache.size > 64) {
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

    // Common status and countdown calculation for Today's schedule (falling back to Tomorrow's schedule when today's blackouts are over)
    fun getCurrentStatusAndCountdown(queue: String): ScheduleStatusInfo {
        val slots = getTodaySlots(queue)
        val tomorrowSlots = getTomorrowSlots(queue)
        val now = LocalTime.now(KYIV_ZONE)
        return calculateStatusAndCountdown(slots, tomorrowSlots, now)
    }

    /**
     * Computes the "Наступне відключення" ("Next blackout") interval text for the Big Widget.
     * Finds the first blackout interval today whose start time is strictly after current time (startMin > currentMinutes),
     * so an already-finished or currently-active blackout interval is never shown as the next blackout.
     * If no future blackout interval remains today, checks tomorrow's schedule if available.
     */
    fun getNextUpcomingIntervalText(queue: String): String {
        val todaySlots = getTodaySlots(queue)
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

        val tomorrowSlots = getTomorrowSlots(queue)
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
