package ua.blackout.prewarning.data.model

enum class SlotStatus {
    POWER_ON,
    POWER_OFF
}

data class BlackoutSlot(
    val id: String, // Unique key: "\${date}_\${startHour}_\${queue}"
    val startHour: Int, // 0..23
    val endHour: Int, // 1..24
    val startTimeStr: String, // "14:00"
    val endTimeStr: String, // "18:00"
    val status: SlotStatus
)

data class DaySchedule(
    val dateStr: String,
    val dayLabel: String,
    val queue: String,
    val slots: List<BlackoutSlot>,
    val lastUpdated: String
)

data class UserSettings(
    val cityUrl: String = "https://www.ztoe.com.ua/unhooking-search.php",
    val queue: String = "2.1",
    val refreshIntervalMinutes: Long = 15L,
    val advanceNoticeMinutes: Int = 30,
    val notificationsEnabled: Boolean = true,
    val soundEnabled: Boolean = true,
    val vibrationEnabled: Boolean = true,
    val themeMode: String = "SYSTEM", // "SYSTEM", "DARK", "LIGHT"
    val language: String = "SYSTEM" // "SYSTEM", "UK", "EN"
)