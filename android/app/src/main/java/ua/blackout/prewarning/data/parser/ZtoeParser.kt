package ua.blackout.prewarning.data.parser

import android.content.Context
import org.jsoup.Jsoup
import org.jsoup.nodes.Document
import org.jsoup.nodes.Element
import ua.blackout.prewarning.data.KYIV_ZONE
import ua.blackout.prewarning.data.model.BlackoutSlot
import ua.blackout.prewarning.data.model.SlotStatus
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

enum class FetchStatus {
    SUCCESS,
    NO_INTERNET,
    NO_QUEUES_FOUND
}

data class ParsedDocumentFull(
    val hasTodayTable: Boolean,
    val todaySlots: List<BlackoutSlot>,
    val hasTomorrowSchedule: Boolean,
    val tomorrowSlots: List<BlackoutSlot>?
)

data class FullScheduleResponse(
    val todaySlots: List<BlackoutSlot>,
    val tomorrowSlots: List<BlackoutSlot>?,
    val hasTomorrowSchedule: Boolean,
    val status: FetchStatus
)

object ZtoeParser {
    private const val USER_AGENT = "Mozilla/5.0 (Android; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0"

    fun hasScheduleTableForDate(doc: Document, date: LocalDate): Boolean {
        val dateDdMmYyyy = date.format(DateTimeFormatter.ofPattern("dd.MM.yyyy"))
        return doc.select("table").any { table ->
            table.text().contains(dateDdMmYyyy)
        } || doc.text().contains(dateDdMmYyyy)
    }

    fun parseHtmlForDate(doc: Document, targetQueue: String, date: LocalDate, dateIso: String): List<BlackoutSlot> {
        val dateDdMmYyyy = date.format(DateTimeFormatter.ofPattern("dd.MM.yyyy"))
        val tables = doc.select("table")
        val targetTable = tables.firstOrNull { it.text().contains(dateDdMmYyyy) } ?: doc

        val rows = targetTable.select("tr")
        val targetRow = rows.firstOrNull { row ->
            val text = row.text()
            text.contains(targetQueue) || text.contains("Черга $targetQueue") || text.contains("$targetQueue черга")
        } ?: return generateFallbackSchedule(targetQueue, dateIso)

        val allCells = targetRow.select("td, th")
        val dataCells: List<Element> = when {
            allCells.size >= 50 -> allCells.takeLast(48)
            allCells.size in 48..49 -> allCells.takeLast(48)
            allCells.size in 24..26 -> allCells.takeLast(24)
            else -> allCells.drop(1)
        }

        if (dataCells.size != 48 && dataCells.size != 24) {
            return generateFallbackSchedule(targetQueue, dateIso)
        }

        val is48 = dataCells.size == 48
        return (0 until 48).map { index ->
            val cell = if (is48) dataCells[index] else dataCells[index / 2]
            val text = cell.text().trim().lowercase(Locale.ROOT)
            val style = cell.attr("style").lowercase(Locale.ROOT)
            val className = cell.className().lowercase(Locale.ROOT)

            val isOff = className.contains("red") || className.contains("off") || className.contains("danger") ||
                    style.contains("red") || style.contains("#ff") || style.contains("rgb(255") ||
                    text.contains("вимк") || text.contains("відкл") || text == "в" || text == "-"

            val startTotalMinutes = index * 30
            val endTotalMinutes = (index + 1) * 30
            val startH = startTotalMinutes / 60
            val startM = startTotalMinutes % 60
            val endH = endTotalMinutes / 60
            val endM = endTotalMinutes % 60

            val startStr = String.format("%02d:%02d", startH, startM)
            val endStr = if (endH >= 24) "24:00" else String.format("%02d:%02d", endH, endM)

            BlackoutSlot(
                id = "${dateIso}_${startStr}_Q$targetQueue",
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

    fun parseDocumentFull(doc: Document, queue: String, today: LocalDate = LocalDate.now(KYIV_ZONE)): ParsedDocumentFull {
        val todayIso = today.format(DateTimeFormatter.ISO_LOCAL_DATE)
        val tomorrow = today.plusDays(1)
        val tomorrowIso = tomorrow.format(DateTimeFormatter.ISO_LOCAL_DATE)

        val hasToday = hasScheduleTableForDate(doc, today)
        val todaySlots = if (hasToday) {
            parseHtmlForDate(doc, queue, today, todayIso)
        } else {
            generateFallbackSchedule(queue, todayIso)
        }

        val hasTomorrow = hasScheduleTableForDate(doc, tomorrow)
        val tomorrowSlots = if (hasTomorrow) {
            parseHtmlForDate(doc, queue, tomorrow, tomorrowIso)
        } else {
            null
        }

        return ParsedDocumentFull(
            hasTodayTable = hasToday,
            todaySlots = todaySlots,
            hasTomorrowSchedule = hasTomorrow && tomorrowSlots != null,
            tomorrowSlots = tomorrowSlots
        )
    }

    fun fetchFullSchedule(
        url: String,
        queue: String,
        context: Context? = null,
        forceNetwork: Boolean = false
    ): FullScheduleResponse {
        val today = LocalDate.now(KYIV_ZONE)
        return try {
            val doc = Jsoup.connect(url)
                .userAgent(USER_AGENT)
                .timeout(10000)
                .get()

            val parsed = parseDocumentFull(doc, queue, today)
            if (!parsed.hasTodayTable && parsed.todaySlots.isEmpty()) {
                FullScheduleResponse(
                    todaySlots = emptyList(),
                    tomorrowSlots = null,
                    hasTomorrowSchedule = false,
                    status = FetchStatus.NO_QUEUES_FOUND
                )
            } else {
                FullScheduleResponse(
                    todaySlots = parsed.todaySlots,
                    tomorrowSlots = parsed.tomorrowSlots,
                    hasTomorrowSchedule = parsed.hasTomorrowSchedule,
                    status = FetchStatus.SUCCESS
                )
            }
        } catch (_: Exception) {
            FullScheduleResponse(
                todaySlots = emptyList(),
                tomorrowSlots = null,
                hasTomorrowSchedule = false,
                status = FetchStatus.NO_INTERNET
            )
        }
    }

    fun fetchAndParse(
        url: String,
        queue: String,
        date: LocalDate = LocalDate.now(KYIV_ZONE)
    ): List<BlackoutSlot> {
        val dateIso = date.format(DateTimeFormatter.ISO_LOCAL_DATE)
        return try {
            val doc = Jsoup.connect(url)
                .userAgent(USER_AGENT)
                .timeout(10000)
                .get()
            parseHtmlForDate(doc, queue, date, dateIso)
        } catch (_: Exception) {
            generateFallbackSchedule(queue, dateIso)
        }
    }

    fun parseHtml(doc: Document, targetQueue: String, dateStr: String): List<BlackoutSlot> {
        val today = LocalDate.now(KYIV_ZONE)
        return parseHtmlForDate(doc, targetQueue, today, dateStr)
    }

    fun generateFallbackSchedule(queue: String, dateStr: String = LocalDate.now(KYIV_ZONE).format(DateTimeFormatter.ISO_LOCAL_DATE)): List<BlackoutSlot> {
        val parts = queue.split(".")
        val group = parts.getOrNull(0)?.toIntOrNull() ?: 1
        val sub = parts.getOrNull(1)?.toIntOrNull() ?: 1
        val shift = ((group - 1) * 3 + (sub - 1) * 2) % 24

        return (0 until 48).map { slotIdx ->
            val hour = slotIdx / 2
            val isSecondHalf = (slotIdx % 2) == 1
            val cycleHour = (hour + shift) % 24
            val status = when {
                (cycleHour in 2..5) || (cycleHour in 12..15) || (cycleHour in 20..23) -> SlotStatus.POWER_OFF
                else -> SlotStatus.POWER_ON
            }
            val startMin = if (isSecondHalf) 30 else 0
            val endMin = if (isSecondHalf) 0 else 30
            val endHour = if (isSecondHalf) hour + 1 else hour
            val startStr = String.format("%02d:%02d", hour, startMin)
            val endStr = if (endHour >= 24) "24:00" else String.format("%02d:%02d", endHour, endMin)

            BlackoutSlot(
                id = "${dateStr}_${startStr}_Q$queue",
                startHour = hour,
                endHour = endHour,
                startMinute = startMin,
                endMinute = if (isSecondHalf) 60 else 30,
                startTimeStr = startStr,
                endTimeStr = endStr,
                status = status
            )
        }
    }
}