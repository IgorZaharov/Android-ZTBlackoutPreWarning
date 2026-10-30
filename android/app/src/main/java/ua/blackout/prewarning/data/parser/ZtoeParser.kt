package ua.blackout.prewarning.data.parser

import org.jsoup.Jsoup
import org.jsoup.nodes.Document
import ua.blackout.prewarning.data.model.BlackoutSlot
import ua.blackout.prewarning.data.model.SlotStatus
import java.time.LocalDate
import java.time.format.DateTimeFormatter

data class ScheduleFetchResult(
    val todaySlots: List<BlackoutSlot>,
    val tomorrowSlots: List<BlackoutSlot>?,
    val hasTomorrowSchedule: Boolean
)

object ZtoeParser {
    private const val USER_AGENT = "Mozilla/5.0 (Android; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0"

    fun isValidUrl(url: String): Boolean {
        val trimmed = url.trim()
        if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) return false
        val uri = try { java.net.URI(trimmed) } catch (e: Exception) { return false }
        val host = uri.host?.lowercase() ?: return false
        if (host != "www.ztoe.com.ua" && host != "ztoe.com.ua") return false
        val path = uri.path ?: ""
        return path == "/unhooking-search.php" || path == "/" || path.isEmpty()
    }

    fun fetchFullSchedule(url: String, queue: String): ScheduleFetchResult {
        val today = LocalDate.now()
        val tomorrow = today.plusDays(1)
        val todayStr = today.format(DateTimeFormatter.ISO_LOCAL_DATE)
        val tomorrowStr = tomorrow.format(DateTimeFormatter.ISO_LOCAL_DATE)

        if (!isValidUrl(url)) {
            val todayFallback = generateFallbackSchedule(queue, todayStr)
            return ScheduleFetchResult(
                todaySlots = todayFallback,
                tomorrowSlots = null,
                hasTomorrowSchedule = false
            )
        }

        return try {
            val doc: Document = Jsoup.connect(url)
                .userAgent(USER_AGENT)
                .timeout(8000)
                .get()

            val text = doc.text()
            // Format variants for dates: "30.10.2026", "30.10", "2026-10-30"
            val tomorrowD1 = String.format("%02d.%02d", tomorrow.dayOfMonth, tomorrow.monthValue)
            val tomorrowD2 = tomorrowStr

            val hasTomorrow = text.contains(tomorrowD1) || text.contains(tomorrowD2) || text.contains("на завтра")

            val todaySlots = parseHtmlForDate(doc, queue, today)
            val tomorrowSlots = if (hasTomorrow) parseHtmlForDate(doc, queue, tomorrow) else null

            ScheduleFetchResult(
                todaySlots = todaySlots,
                tomorrowSlots = tomorrowSlots,
                hasTomorrowSchedule = hasTomorrow && tomorrowSlots != null
            )
        } catch (e: Exception) {
            val todayFallback = generateFallbackSchedule(queue, todayStr)
            ScheduleFetchResult(
                todaySlots = todayFallback,
                tomorrowSlots = null,
                hasTomorrowSchedule = false
            )
        }
    }

    fun fetchAndParse(url: String, queue: String, date: LocalDate): List<BlackoutSlot> {
        val dateStr = date.format(DateTimeFormatter.ISO_LOCAL_DATE)
        if (!isValidUrl(url)) {
            return generateFallbackSchedule(queue, dateStr)
        }
        return try {
            val doc: Document = Jsoup.connect(url)
                .userAgent(USER_AGENT)
                .timeout(8000)
                .get()

            parseHtmlForDate(doc, queue, date)
        } catch (e: Exception) {
            generateFallbackSchedule(queue, dateStr)
        }
    }

    private fun parseHtmlForDate(doc: Document, targetQueue: String, date: LocalDate): List<BlackoutSlot> {
        val dateStr = date.format(DateTimeFormatter.ISO_LOCAL_DATE)
        val rows = doc.select("table tr")
        val targetRow = rows.firstOrNull { row ->
            val text = row.text()
            text.contains(targetQueue) || text.contains("Черга $targetQueue")
        } ?: return generateFallbackSchedule(targetQueue, dateStr)

        val cells = targetRow.select("td, th").drop(1)
        if (cells.size < 12) {
            return generateFallbackSchedule(targetQueue, dateStr)
        }

        val hoursPerCell = 24 / cells.size
        return cells.mapIndexed { index, cell ->
            val startH = index * hoursPerCell
            val endH = (index + 1) * hoursPerCell
            val startStr = String.format("%02d:00", startH)
            val endStr = if (endH == 24) "24:00" else String.format("%02d:00", endH)

            val cellText = cell.text().trim().lowercase()
            val style = cell.attr("style").lowercase()
            val className = cell.className().lowercase()

            val status = when {
                className.contains("red") || className.contains("off") || className.contains("danger") ||
                style.contains("red") || cellText.contains("вимк") || cellText.contains("відкл") || cellText == "в" || cellText == "-" -> {
                    SlotStatus.POWER_OFF
                }
                else -> SlotStatus.POWER_ON
            }

            BlackoutSlot(
                id = "${dateStr}_${startStr}_Q$targetQueue",
                startHour = startH,
                endHour = endH,
                startTimeStr = startStr,
                endTimeStr = endStr,
                status = status
            )
        }
    }

    fun generateFallbackSchedule(queue: String, dateStr: String): List<BlackoutSlot> {
        val parts = queue.split(".")
        val group = parts.getOrNull(0)?.toIntOrNull() ?: 1
        val sub = parts.getOrNull(1)?.toIntOrNull() ?: 1
        val shift = ((group - 1) * 3 + (sub - 1) * 2) % 24

        return (0 until 24).map { hour ->
            val cycleHour = (hour + shift) % 24
            val status = when {
                (cycleHour in 2..5) || (cycleHour in 12..15) || (cycleHour in 20..23) -> SlotStatus.POWER_OFF
                else -> SlotStatus.POWER_ON
            }
            val startStr = String.format("%02d:00", hour)
            val endStr = if (hour + 1 == 24) "24:00" else String.format("%02d:00", hour + 1)

            BlackoutSlot(
                id = "${dateStr}_${startStr}_Q$queue",
                startHour = hour,
                endHour = hour + 1,
                startTimeStr = startStr,
                endTimeStr = endStr,
                status = status
            )
        }
    }
}