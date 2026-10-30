package ua.blackout.prewarning.data.repository

import android.content.Context
import ua.blackout.prewarning.data.model.BlackoutSlot
import ua.blackout.prewarning.data.model.SlotStatus
import ua.blackout.prewarning.data.parser.ZtoeParser
import java.time.LocalDate
import java.time.LocalTime

data class ScheduleStatusInfo(
    val isBlackoutNow: Boolean,
    val countdownText: String,
    val nextSlotTime: String
)

class ScheduleRepository(private val context: Context) {

    fun getCurrentStatusAndCountdown(queue: String): ScheduleStatusInfo {
        val today = LocalDate.now()
        val nowTime = LocalTime.now()
        val currentHour = nowTime.hour
        val currentMinute = nowTime.minute

        val slots = ZtoeParser.generateFallbackSchedule(queue, today.toString())
        val currentSlot = slots.find { it.startHour == currentHour }
        val isBlackoutNow = currentSlot?.status == SlotStatus.POWER_OFF

        // Find next event (either next power off if currently ON, or next power ON if currently OFF)
        val targetStatus = if (isBlackoutNow) SlotStatus.POWER_ON else SlotStatus.POWER_OFF
        val nextSlot = slots.find { it.startHour > currentHour && it.status == targetStatus }
            ?: slots.firstOrNull { it.status == targetStatus }

        val targetHour = nextSlot?.startHour ?: ((currentHour + 2) % 24)
        val diffMinutes = if (targetHour >= currentHour) {
            (targetHour - currentHour) * 60 - currentMinute
        } else {
            (24 + targetHour - currentHour) * 60 - currentMinute
        }

        val clampedDiff = if (diffMinutes < 0) 60 + diffMinutes else diffMinutes
        val hoursLeft = clampedDiff / 60
        val minsLeft = clampedDiff % 60
        val countdownText = String.format("%02d:%02d", hoursLeft, minsLeft)
        val nextSlotTime = String.format("%02d:00", targetHour)

        return ScheduleStatusInfo(
            isBlackoutNow = isBlackoutNow,
            countdownText = countdownText,
            nextSlotTime = nextSlotTime
        )
    }
}
