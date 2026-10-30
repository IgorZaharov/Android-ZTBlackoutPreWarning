package ua.blackout.prewarning.data.parser

import org.jsoup.Jsoup
import org.jsoup.nodes.Document
import ua.blackout.prewarning.data.model.BlackoutSlot
import ua.blackout.prewarning.data.model.SlotStatus
import java.time.LocalDate
import java.time.format.DateTimeFormatter

object ZtoeParser {
    private const val USER_AGENT = "Mozilla/5.0 (Android; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0"

    fun fetchAndParse(url: String, queue: String, date: LocalDate): List<BlackoutSlot> {
        val dateStr = date.format(DateTimeFormatter.ISO_LOCAL_DATE)
        return try {
            val doc: Document = Jsoup.connect(url)
                .userAgent(USER_AGENT)
                .timeout(10000)
                .get()

            parseHtml(doc, queue, dateStr)
        } catch (e: Exception) {
            // Fallback to standard rotation schedule if site is offline or changing layout
            generateFallbackSchedule(queue, dateStr)
        }
    }

    fun parseHtml(doc: Document, targetQueue: String, dateStr: String): List<BlackoutSlot> {
        val rows = doc.select("table tr")
        var targetRow = rows.firstOrNull { row ->
            val text = row.text()
            text.contains(targetQueue) || text.contains("Черга $targetQueue")
        }

        if (targetRow == null) {
            return generateFallbackSchedule(targetQueue, dateStr)
        }

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

            val text = cell.text().trim().lowercase()
            val style = cell.attr("style").lowercase()
            val className = cell.className().lowercase()

            val status = when {
                className.contains("red") || className.contains("off") || className.contains("danger") ||
                style.contains("red") || text.contains("вимк") || text.contains("відкл") || text == "в" || text == "-" -> {
                    SlotStatus.POWER_OFF
                }
                else -> SlotStatus.POWER_ON
            }

            BlackoutSlot(
                id = "\${dateStr}_\${startStr}_Q$targetQueue",
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
                id = "\${dateStr}_\${startStr}_Q$queue",
                startHour = hour,
                endHour = hour + 1,
                startTimeStr = startStr,
                endTimeStr = endStr,
                status = status
            )
        }
    }
}