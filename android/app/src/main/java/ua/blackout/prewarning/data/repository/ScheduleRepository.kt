package ua.blackout.prewarning.data.repository

import android.content.Context
import android.content.SharedPreferences
import ua.blackout.prewarning.data.model.BlackoutSlot
import ua.blackout.prewarning.data.model.SlotStatus
import ua.blackout.prewarning.data.parser.ZtoeParser
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

data class ScheduleStatusInfo(
    val isBlackoutNow: Boolean,
    val countdownText: String,
    val nextSlotTime: String,
    val totalBlackoutHours: Double = 0.0
)

data class OutageInterval(
    val startStr: String,
    val endStr: String,
    val durationHours: Double
)

class ScheduleRepository(private val context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("zt_schedule_cache_v2", Context.MODE_PRIVATE)

    fun saveSchedule(queue: String, todaySlots: List<BlackoutSlot>, tomorrowSlots: List<BlackoutSlot>?) {
        val editor = prefs.edit()
        val todayStr = LocalDate.now(ZoneId.of("Europe/Kyiv")).format(DateTimeFormatter.ISO_LOCAL_DATE)

        // Store serialized slot statuses as a simple 48-char string of '0' (ON) and '1' (OFF)
        val todayEncoded = todaySlots.joinToString("") { if (it.status == SlotStatus.POWER_OFF) "1" else "0" }
        editor.putString("cache_today_date", todayStr)
        editor.putString("cache_today_queue", queue)
        editor.putString("cache_today_slots_$queue", todayEncoded)

        if (tomorrowSlots != null) {
            val tomorrowEncoded = tomorrowSlots.joinToString("") { if (it.status == SlotStatus.POWER_OFF) "1" else "0" }
            editor.putString("cache_tomorrow_slots_$queue", tomorrowEncoded)
            editor.putBoolean("cache_has_tomorrow_$queue", true)
        } else {
            editor.remove("cache_tomorrow_slots_$queue")
            editor.putBoolean("cache_has_tomorrow_$queue", false)
        }
        editor.apply()
    }

    fun getTodaySlots(queue: String): List<BlackoutSlot> {
        val kyivZone = ZoneId.of("Europe/Kyiv")
        val today = LocalDate.now(kyivZone)
        val todayStr = today.format(DateTimeFormatter.ISO_LOCAL_DATE)
        val cachedDate = prefs.getString("cache_today_date", null)
        val cachedEncoded = prefs.getString("cache_today_slots_$queue", null)

        if (cachedDate == todayStr && !cachedEncoded.isNullOrEmpty() && cachedEncoded.length >= 24) {
            return decodeSlots(cachedEncoded, queue, todayStr)
        }
        return ZtoeParser.generateFallbackSchedule(queue, todayStr)
    }

    fun getTomorrowSlots(queue: String): List<BlackoutSlot>? {
        val kyivZone = ZoneId.of("Europe/Kyiv")
        val tomorrow = LocalDate.now(kyivZone).plusDays(1)
        val tomorrowStr = tomorrow.format(DateTimeFormatter.ISO_LOCAL_DATE)
        val hasTomorrow = prefs.getBoolean("cache_has_tomorrow_$queue", false)
        val cachedEncoded = prefs.getString("cache_tomorrow_slots_$queue", null)

        if (hasTomorrow && !cachedEncoded.isNullOrEmpty() && cachedEncoded.length >= 24) {
            return decodeSlots(cachedEncoded, queue, tomorrowStr)
        }
        return null
    }

    fun hasTomorrowSchedule(queue: String): Boolean {
        return prefs.getBoolean("cache_has_tomorrow_$queue", false)
    }

    private fun decodeSlots(encoded: String, queue: String, dateStr: String): List<BlackoutSlot> {
        val totalSlots = encoded.length
        val minutesPerSlot = 1440 / totalSlots

        return (0 until totalSlots).map { index ->
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
    }

    // Common calculation of blackout intervals from any slot list (today or tomorrow)
    fun getIntervals(slots: List<BlackoutSlot>): List<Pair<String, String>> {
        val detailed = getDetailedIntervals(slots)
        return detailed.map { Pair(it.startStr, it.endStr) }
    }

    fun getDetailedIntervals(slots: List<BlackoutSlot>): List<OutageInterval> {
        val list = mutableListOf<OutageInterval>()
        if (slots.isEmpty()) return list

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
                list.add(OutageInterval(sStr, eStr, duration))
            }
        }
        if (inBlock) {
            val startMin = startIdx * minutesPerSlot
            val sStr = String.format("%02d:%02d", startMin / 60, startMin % 60)
            val duration = (totalSlots - startIdx) * (minutesPerSlot / 60.0)
            list.add(OutageInterval(sStr, "24:00", duration))
        }
        return list
    }

    // Common status and countdown calculation for Today's schedule
    fun getCurrentStatusAndCountdown(queue: String): ScheduleStatusInfo {
        val slots = getTodaySlots(queue)
        val now = LocalTime.now(ZoneId.of("Europe/Kyiv"))
        val currentMinutes = now.hour * 60 + now.minute
        val currentSeconds = now.second

        if (slots.isEmpty()) {
            return ScheduleStatusInfo(
                isBlackoutNow = false,
                countdownText = "00:00:00",
                nextSlotTime = "Відключень немає"
            )
        }

        val totalSlots = slots.size
        val minutesPerSlot = 1440 / totalSlots
        val currentSlotIdx = (currentMinutes / minutesPerSlot).coerceIn(0, totalSlots - 1)
        val isBlackoutNow = slots[currentSlotIdx].status == SlotStatus.POWER_OFF

        // Find next transition
        val targetStatus = if (isBlackoutNow) SlotStatus.POWER_ON else SlotStatus.POWER_OFF
        var targetSlotIdx = -1

        for (i in (currentSlotIdx + 1) until totalSlots) {
            if (slots[i].status == targetStatus) {
                targetSlotIdx = i
                break
            }
        }

        // If not found in remainder of day, search from midnight (next day wrap)
        if (targetSlotIdx == -1) {
            for (i in 0..currentSlotIdx) {
                if (slots[i].status == targetStatus) {
                    targetSlotIdx = i
                    break
                }
            }
        }

        if (targetSlotIdx == -1) {
            // Whole day is in the same status
            return ScheduleStatusInfo(
                isBlackoutNow = isBlackoutNow,
                countdownText = "24:00:00",
                nextSlotTime = if (isBlackoutNow) "Цілий день" else "Відключень немає"
            )
        }

        val targetMinutes = targetSlotIdx * minutesPerSlot
        val remainingMinutes = if (targetMinutes > currentMinutes) {
            targetMinutes - currentMinutes - 1
        } else {
            (1440 + targetMinutes) - currentMinutes - 1
        }
        val remainingSeconds = 60 - currentSeconds

        val totalSecsLeft = remainingMinutes * 60 + remainingSeconds
        val h = totalSecsLeft / 3600
        val m = (totalSecsLeft % 3600) / 60
        val s = totalSecsLeft % 60
        val countdownText = String.format("%02d:%02d:%02d", h, m, s)

        // Find time range for the upcoming or current blackout block
        val intervals = getDetailedIntervals(slots)
        val nextPeriod = if (isBlackoutNow) {
            // Find interval containing current time
            intervals.firstOrNull {
                val sMin = it.startStr.split(":")[0].toInt() * 60 + it.startStr.split(":")[1].toInt()
                val eMin = if (it.endStr == "24:00") 1440 else (it.endStr.split(":")[0].toInt() * 60 + it.endStr.split(":")[1].toInt())
                currentMinutes in sMin until eMin
            }?.let { "${it.startStr} – ${it.endStr}" } ?: slots[currentSlotIdx].let { "${it.startTimeStr} – ${it.endTimeStr}" }
        } else {
            // Find next upcoming blackout interval
            intervals.firstOrNull {
                val sMin = it.startStr.split(":")[0].toInt() * 60 + it.startStr.split(":")[1].toInt()
                sMin >= currentMinutes
            }?.let { "${it.startStr} – ${it.endStr}" } ?: intervals.firstOrNull()?.let { "${it.startStr} – ${it.endStr}" } ?: "Відключень немає"
        }

        val totalBlackoutHours = intervals.sumOf { it.durationHours }

        return ScheduleStatusInfo(
            isBlackoutNow = isBlackoutNow,
            countdownText = countdownText,
            nextSlotTime = nextPeriod,
            totalBlackoutHours = totalBlackoutHours
        )
    }
}
