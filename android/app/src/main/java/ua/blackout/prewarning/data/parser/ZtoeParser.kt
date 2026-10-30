package ua.blackout.prewarning.data.parser

import org.jsoup.Jsoup
import org.jsoup.nodes.Document
import org.jsoup.nodes.Element
import ua.blackout.prewarning.data.model.BlackoutSlot
import ua.blackout.prewarning.data.model.SlotStatus
import java.net.HttpURLConnection
import java.net.URL
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

data class ScheduleFetchResult(
    val todaySlots: List<BlackoutSlot>,
    val tomorrowSlots: List<BlackoutSlot>?,
    val hasTomorrowSchedule: Boolean
)

object ZtoeParser {
    private const val USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

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
        val kyivZone = ZoneId.of("Europe/Kyiv")
        val today = LocalDate.now(kyivZone)
        val tomorrow = today.plusDays(1)
        val todayStr = today.format(DateTimeFormatter.ISO_LOCAL_DATE)

        if (!isValidUrl(url)) {
            return ScheduleFetchResult(
                todaySlots = generateFallbackSchedule(queue, todayStr),
                tomorrowSlots = null,
                hasTomorrowSchedule = false
            )
        }

        return try {
            val doc = fetchDocumentWithWindows1251(url)
            val tables = doc.select("table")

            // Format patterns to locate tables in ZTOE HTML
            val todayD1 = String.format("%02d.%02d.%04d", today.dayOfMonth, today.monthValue, today.year)
            val todayD2 = String.format("%d.%d.%04d", today.dayOfMonth, today.monthValue, today.year)
            val todayD3 = String.format("%02d.%02d", today.dayOfMonth, today.monthValue)

            val tomorrowD1 = String.format("%02d.%02d.%04d", tomorrow.dayOfMonth, tomorrow.monthValue, tomorrow.year)
            val tomorrowD2 = String.format("%d.%d.%04d", tomorrow.dayOfMonth, tomorrow.monthValue, tomorrow.year)
            val tomorrowD3 = String.format("%02d.%02d", tomorrow.dayOfMonth, tomorrow.monthValue)

            var todayTable: Element? = null
            var tomorrowTable: Element? = null

            for (table in tables) {
                val tableHtml = table.html()
                val headerText = table.select("tr").firstOrNull()?.text() ?: ""
                val fullText = table.text()

                val matchesToday = headerText.contains(todayD1) || headerText.contains(todayD2) ||
                        tableHtml.contains(todayD1) || tableHtml.contains(todayD2)
                val matchesTomorrow = headerText.contains(tomorrowD1) || headerText.contains(tomorrowD2) ||
                        tableHtml.contains(tomorrowD1) || tableHtml.contains(tomorrowD2)

                if (matchesToday && todayTable == null) {
                    todayTable = table
                } else if (matchesTomorrow && tomorrowTable == null) {
                    tomorrowTable = table
                }
            }

            // Fallback table search if exact date in header wasn't found (e.g. DD.MM only)
            if (todayTable == null) {
                todayTable = tables.firstOrNull { t ->
                    val txt = t.text()
                    txt.contains(todayD3) && (txt.contains("Черга") || txt.contains("Підчерга") || txt.contains("1.1"))
                }
            }

            if (tomorrowTable == null) {
                tomorrowTable = tables.firstOrNull { t ->
                    t != todayTable && (t.text().contains(tomorrowD3) || t.text().contains("на завтра")) &&
                            (t.text().contains("Черга") || t.text().contains("1.1"))
                }
            }

            val todaySlots = if (todayTable != null) {
                parseTableForQueue(todayTable, queue, today)
            } else {
                generateFallbackSchedule(queue, todayStr)
            }

            val tomorrowSlots = if (tomorrowTable != null) {
                parseTableForQueue(tomorrowTable, queue, tomorrow)
            } else {
                null
            }

            ScheduleFetchResult(
                todaySlots = todaySlots,
                tomorrowSlots = tomorrowSlots,
                hasTomorrowSchedule = tomorrowSlots != null && tomorrowTable != null
            )
        } catch (e: Exception) {
            ScheduleFetchResult(
                todaySlots = generateFallbackSchedule(queue, todayStr),
                tomorrowSlots = null,
                hasTomorrowSchedule = false
            )
        }
    }

    fun fetchAndParse(url: String, queue: String, date: LocalDate): List<BlackoutSlot> {
        val result = fetchFullSchedule(url, queue)
        val today = LocalDate.now(ZoneId.of("Europe/Kyiv"))
        return if (date == today) {
            result.todaySlots
        } else if (date == today.plusDays(1) && result.tomorrowSlots != null) {
            result.tomorrowSlots
        } else {
            generateFallbackSchedule(queue, date.format(DateTimeFormatter.ISO_LOCAL_DATE))
        }
    }

    private fun fetchDocumentWithWindows1251(urlStr: String): Document {
        val url = URL(urlStr)
        val connection = url.openConnection() as HttpURLConnection
        connection.setRequestProperty("User-Agent", USER_AGENT)
        connection.connectTimeout = 8000
        connection.readTimeout = 8000
        connection.connect()
        return connection.inputStream.use { input ->
            Jsoup.parse(input, "windows-1251", urlStr)
        }
    }

    private fun parseTableForQueue(table: Element, targetQueue: String, date: LocalDate): List<BlackoutSlot> {
        val dateStr = date.format(DateTimeFormatter.ISO_LOCAL_DATE)
        val rows = table.select("tr")

        // Find the row containing this specific queue (e.g. "1.1")
        val targetRow = rows.firstOrNull { row ->
            val cells = row.select("td, th")
            cells.any { cell ->
                val txt = cell.text().trim()
                txt == targetQueue || txt == "Черга $targetQueue" || txt == "Черга $targetQueue."
            }
        } ?: return generateFallbackSchedule(targetQueue, dateStr)

        val tds = targetRow.select("td")
        if (tds.size < 24) {
            return generateFallbackSchedule(targetQueue, dateStr)
        }

        // ZTOE table row structure: last 48 cells represent the 48 half-hour slots of the day (00:00 to 24:00)
        val slotCells = if (tds.size >= 48) {
            tds.takeLast(48)
        } else {
            // In case of 24 1-hour cells
            tds.takeLast(24)
        }

        val totalSlots = slotCells.size
        val minutesPerSlot = 1440 / totalSlots // 30 mins for 48 slots, 60 mins for 24 slots

        return slotCells.mapIndexed { index, cell ->
            val startTotalMin = index * minutesPerSlot
            val endTotalMin = (index + 1) * minutesPerSlot

            val startH = startTotalMin / 60
            val startM = startTotalMin % 60
            val endH = endTotalMin / 60
            val endM = endTotalMin % 60

            val startStr = String.format("%02d:%02d", startH, startM)
            val endStr = if (endH >= 24) "24:00" else String.format("%02d:%02d", endH, endM)

            val attr = (cell.attr("style") + " " + cell.attr("bgcolor") + " " + cell.className()).lowercase()
            val text = cell.text().trim().lowercase()

            val isOff = attr.contains("#ff3333") || attr.contains("red") || attr.contains("rgb(255, 51, 51)") ||
                    attr.contains("danger") || text.contains("вимк") || text.contains("відкл") || text == "в" || text == "-"

            val status = if (isOff) SlotStatus.POWER_OFF else SlotStatus.POWER_ON

            BlackoutSlot(
                id = "${dateStr}_${startStr}_Q$targetQueue",
                startHour = startH,
                endHour = if (endM > 0) endH else endH,
                startMinute = startM,
                endMinute = endM,
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

        // Generate 48 half-hour slots for uniform 30-min resolution
        return (0 until 48).map { index ->
            val startTotalMin = index * 30
            val endTotalMin = (index + 1) * 30
            val startH = startTotalMin / 60
            val startM = startTotalMin % 60
            val endH = endTotalMin / 60
            val endM = endTotalMin % 60

            val cycleHour = (startH + shift) % 24
            val isOff = (cycleHour in 2..5) || (cycleHour in 12..15) || (cycleHour in 20..23)

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
}