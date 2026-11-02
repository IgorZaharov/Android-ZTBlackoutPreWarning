package ua.blackout.prewarning.data.parser

import android.content.Context
import org.jsoup.Jsoup
import org.jsoup.nodes.Document
import org.jsoup.nodes.Element
import ua.blackout.prewarning.data.model.BlackoutSlot
import ua.blackout.prewarning.data.model.SlotStatus
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.UnknownHostException
import java.net.SocketTimeoutException
import java.net.ConnectException
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

enum class FetchStatus {
    SUCCESS,
    NO_INTERNET,
    NO_QUEUES_FOUND
}

data class ScheduleFetchResult(
    val todaySlots: List<BlackoutSlot>,
    val tomorrowSlots: List<BlackoutSlot>?,
    val hasTomorrowSchedule: Boolean,
    val status: FetchStatus = FetchStatus.SUCCESS
)

// =========================================================================================
// CRITICAL SECTION — DO NOT MODIFY UNLESS EXPLICITLY REQUESTED
// Real ZTOE HTML Table Parser & URL Validator for https://www.ztoe.com.ua/unhooking-search.php
// =========================================================================================
object ZtoeParser {
    private const val USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

    private val DEFAULT_VALID_URLS = listOf(
        "https://www.ztoe.com.ua/unhooking-search.php",
        "https://example.com"
    )

    fun loadValidUrls(context: Context? = null): List<String> {
        if (context != null) {
            try {
                val jsonStr = context.assets.open("valid-urls.json").bufferedReader().use { it.readText() }
                val regex = Regex("\"([^\"]+)\"")
                val matches = regex.findAll(jsonStr).map { it.groupValues[1].trim() }.filter { it.isNotEmpty() }.toList()
                if (matches.isNotEmpty()) {
                    return matches
                }
            } catch (_: Exception) {}
        }
        return DEFAULT_VALID_URLS
    }

    fun isValidUrl(url: String, context: Context? = null): Boolean {
        val trimmed = url.trim().removeSuffix("/")
        if (trimmed.isEmpty()) return false
        val validUrls = loadValidUrls(context).map { it.trim().removeSuffix("/") }
        return validUrls.any { it.equals(trimmed, ignoreCase = true) }
    }

    private val ALL_QUEUES = listOf(
        "1.1", "1.2", "2.1", "2.2", "3.1", "3.2",
        "4.1", "4.2", "5.1", "5.2", "6.1", "6.2"
    )

    @Volatile
    private var cachedDocUrl: String? = null
    @Volatile
    private var cachedDoc: Document? = null
    @Volatile
    private var cachedDocDate: LocalDate? = null
    @Volatile
    private var cachedDocTimestampMs: Long = 0L
    @Volatile
    private var lastETag: String? = null
    @Volatile
    private var lastModifiedHeader: String? = null
    private const val DOC_MEMORY_CACHE_MS = 20_000L
    private val FULL_DATE_REGEX = Regex("""(?<!\d)(\d{1,2})\.(\d{1,2})\.(\d{4})(?!\d)""")
    private val SHORT_DATE_REGEX = Regex("""(?<!\d)(\d{1,2})\.(\d{1,2})(?!\.\d|\d)""")

    private fun matchesTableDate(headerText: String, targetDate: LocalDate): Boolean {
        val fullMatches = FULL_DATE_REGEX.findAll(headerText).toList()
        if (fullMatches.isNotEmpty()) {
            return fullMatches.any { m ->
                val d = m.groupValues[1].toIntOrNull()
                val mo = m.groupValues[2].toIntOrNull()
                val y = m.groupValues[3].toIntOrNull()
                d == targetDate.dayOfMonth && mo == targetDate.monthValue && y == targetDate.year
            }
        }
        return SHORT_DATE_REGEX.findAll(headerText).any { m ->
            val d = m.groupValues[1].toIntOrNull()
            val mo = m.groupValues[2].toIntOrNull()
            d == targetDate.dayOfMonth && mo == targetDate.monthValue
        }
    }

    fun fetchFullSchedule(
        url: String,
        queue: String,
        context: Context? = null,
        forceNetwork: Boolean = false
    ): ScheduleFetchResult {
        val kyivZone = ZoneId.of("Europe/Kyiv")
        val today = LocalDate.now(kyivZone)
        val todayStr = today.format(DateTimeFormatter.ISO_LOCAL_DATE)

        if (!isValidUrl(url, context)) {
            return ScheduleFetchResult(
                todaySlots = generateFallbackSchedule(queue, todayStr),
                tomorrowSlots = null,
                hasTomorrowSchedule = false,
                status = FetchStatus.NO_QUEUES_FOUND
            )
        }

        val cleanUrl = url.trim()
        val repo = if (context != null) {
            ua.blackout.prewarning.data.repository.ScheduleRepository(context.applicationContext)
        } else {
            null
        }

        return try {
            val nowMs = System.currentTimeMillis()
            val recentDoc = cachedDoc
            val canUseConditionalHeaders = !forceNetwork && repo != null && repo.hasValidTodayCache(queue) && repo.hasTomorrowSchedule(queue)

            val doc: Document? = if (!forceNetwork && recentDoc != null && cachedDocUrl == cleanUrl && cachedDocDate == today && (nowMs - cachedDocTimestampMs) in 0 until DOC_MEMORY_CACHE_MS) {
                recentDoc
            } else {
                fetchDocumentWithWindows1251(
                    urlStr = cleanUrl,
                    sendConditionalHeaders = canUseConditionalHeaders
                )?.also { fetched ->
                    cachedDocUrl = cleanUrl
                    cachedDoc = fetched
                    cachedDocDate = today
                    cachedDocTimestampMs = System.currentTimeMillis()
                }
            }

            // HTTP 304 Not Modified: reuse already-cached schedule with zero HTML transfer or Jsoup parsing
            if (doc == null && repo != null && repo.hasValidTodayCache(queue)) {
                val cachedToday = repo.getTodaySlots(queue)
                val cachedTomorrow = repo.getTomorrowSlots(queue)
                return ScheduleFetchResult(
                    todaySlots = cachedToday,
                    tomorrowSlots = cachedTomorrow,
                    hasTomorrowSchedule = cachedTomorrow != null,
                    status = FetchStatus.SUCCESS
                )
            }

            val effectiveDoc = doc ?: return ScheduleFetchResult(
                todaySlots = generateFallbackSchedule(queue, todayStr),
                tomorrowSlots = null,
                hasTomorrowSchedule = false,
                status = FetchStatus.NO_QUEUES_FOUND
            )

            // Single-pass DOM table lookup for all 12 queues + single batched asynchronous SharedPreferences write
            val allQueueResults = parseAllQueuesSinglePass(effectiveDoc, today)
            if (repo != null && allQueueResults.isNotEmpty()) {
                try {
                    val batchMap = allQueueResults.mapValues { (_, r) ->
                        Pair(r.todaySlots, r.tomorrowSlots)
                    }
                    repo.saveAllSchedulesBatch(batchMap, queue)
                } catch (_: Exception) {}
            }

            allQueueResults[queue] ?: parseDocumentFull(effectiveDoc, queue, today)
        } catch (e: UnknownHostException) {
            ScheduleFetchResult(
                todaySlots = generateFallbackSchedule(queue, todayStr),
                tomorrowSlots = null,
                hasTomorrowSchedule = false,
                status = FetchStatus.NO_INTERNET
            )
        } catch (e: ConnectException) {
            ScheduleFetchResult(
                todaySlots = generateFallbackSchedule(queue, todayStr),
                tomorrowSlots = null,
                hasTomorrowSchedule = false,
                status = FetchStatus.NO_INTERNET
            )
        } catch (e: SocketTimeoutException) {
            ScheduleFetchResult(
                todaySlots = generateFallbackSchedule(queue, todayStr),
                tomorrowSlots = null,
                hasTomorrowSchedule = false,
                status = FetchStatus.NO_INTERNET
            )
        } catch (e: IOException) {
            ScheduleFetchResult(
                todaySlots = generateFallbackSchedule(queue, todayStr),
                tomorrowSlots = null,
                hasTomorrowSchedule = false,
                status = FetchStatus.NO_INTERNET
            )
        } catch (e: Exception) {
            ScheduleFetchResult(
                todaySlots = generateFallbackSchedule(queue, todayStr),
                tomorrowSlots = null,
                hasTomorrowSchedule = false,
                status = FetchStatus.NO_QUEUES_FOUND
            )
        }
    }

    private fun findTodayAndTomorrowTables(
        doc: Document,
        today: LocalDate
    ): Pair<Element?, Element?> {
        val tomorrow = today.plusDays(1)
        val leafTables = doc.select("table").filter { table ->
            table.select("table").size == 1 && table.select("tr").size >= 12
        }

        var todayTable: Element? = null
        var tomorrowTable: Element? = null

        for (table in leafTables) {
            val rows = table.select("tr")
            val headerText = rows.take(2).joinToString(" ") { it.text() }
            val tableText = table.text()
            val hasQueues = tableText.contains("1.1") && tableText.contains("6.2")
            if (!hasQueues) continue

            val matchesToday = matchesTableDate(headerText, today)
            val matchesTomorrow = matchesTableDate(headerText, tomorrow)

            if (matchesToday && todayTable == null) {
                todayTable = table
            } else if (matchesTomorrow && tomorrowTable == null) {
                tomorrowTable = table
            }
        }
        return Pair(todayTable, tomorrowTable)
    }

    /**
     * Parses all 12 queues from the document in a single table-lookup pass, avoiding 12 redundant Jsoup DOM scans.
     */
    private fun parseAllQueuesSinglePass(
        doc: Document,
        today: LocalDate
    ): Map<String, ScheduleFetchResult> {
        val tomorrow = today.plusDays(1)
        val (todayTable, tomorrowTable) = findTodayAndTomorrowTables(doc, today)
        if (todayTable == null) return emptyMap()

        val results = LinkedHashMap<String, ScheduleFetchResult>(ALL_QUEUES.size)
        for (q in ALL_QUEUES) {
            val todaySlots = parseTableForQueue(todayTable, q, today) ?: continue
            val tomorrowSlots = if (tomorrowTable != null) {
                parseTableForQueue(tomorrowTable, q, tomorrow)
            } else {
                null
            }
            results[q] = ScheduleFetchResult(
                todaySlots = todaySlots,
                tomorrowSlots = tomorrowSlots,
                hasTomorrowSchedule = tomorrowSlots != null && tomorrowTable != null,
                status = FetchStatus.SUCCESS
            )
        }
        return results
    }

    fun parseDocumentFull(
        doc: Document,
        queue: String,
        today: LocalDate = LocalDate.now(ZoneId.of("Europe/Kyiv"))
    ): ScheduleFetchResult {
        val tomorrow = today.plusDays(1)
        val todayStr = today.format(DateTimeFormatter.ISO_LOCAL_DATE)
        val (todayTable, tomorrowTable) = findTodayAndTomorrowTables(doc, today)

        if (todayTable == null) {
            return ScheduleFetchResult(
                todaySlots = generateFallbackSchedule(queue, todayStr),
                tomorrowSlots = null,
                hasTomorrowSchedule = false,
                status = FetchStatus.NO_QUEUES_FOUND
            )
        }

        val todaySlots = parseTableForQueue(todayTable, queue, today)
        if (todaySlots == null) {
            return ScheduleFetchResult(
                todaySlots = generateFallbackSchedule(queue, todayStr),
                tomorrowSlots = null,
                hasTomorrowSchedule = false,
                status = FetchStatus.NO_QUEUES_FOUND
            )
        }

        val tomorrowSlots = if (tomorrowTable != null) {
            parseTableForQueue(tomorrowTable, queue, tomorrow)
        } else {
            null
        }

        return ScheduleFetchResult(
            todaySlots = todaySlots,
            tomorrowSlots = tomorrowSlots,
            hasTomorrowSchedule = tomorrowSlots != null && tomorrowTable != null,
            status = FetchStatus.SUCCESS
        )
    }

    fun hasScheduleTableForDate(doc: Document, date: LocalDate): Boolean {
        val leafTables = doc.select("table").filter { table ->
            table.select("table").size == 1 && table.select("tr").size >= 12
        }

        return leafTables.any { table ->
            val hasQueues = table.text().contains("1.1") && table.text().contains("6.2")
            val headerText = table.select("tr").take(2).joinToString(" ") { it.text() }
            hasQueues && matchesTableDate(headerText, date)
        }
    }

    fun parseHtmlForDate(
        doc: Document,
        queue: String,
        date: LocalDate,
        dateIso: String = date.format(DateTimeFormatter.ISO_LOCAL_DATE)
    ): List<BlackoutSlot> {
        val leafTables = doc.select("table").filter { table ->
            table.select("table").size == 1 && table.select("tr").size >= 12
        }

        val matchingTable = leafTables.firstOrNull { table ->
            val hasQueues = table.text().contains("1.1") && table.text().contains("6.2")
            val headerText = table.select("tr").take(2).joinToString(" ") { it.text() }
            hasQueues && matchesTableDate(headerText, date)
        }

        if (matchingTable != null) {
            parseTableForQueue(matchingTable, queue, date)?.let { return it }
        }
        return generateFallbackSchedule(queue, dateIso)
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

    private fun fetchDocumentWithWindows1251(
        urlStr: String,
        sendConditionalHeaders: Boolean = false
    ): Document? {
        val url = URL(urlStr)
        val connection = url.openConnection() as HttpURLConnection
        return try {
            connection.setRequestProperty("User-Agent", USER_AGENT)
            connection.setRequestProperty("Accept-Encoding", "gzip")
            if (sendConditionalHeaders && cachedDocUrl == urlStr) {
                lastETag?.let { connection.setRequestProperty("If-None-Match", it) }
                lastModifiedHeader?.let { connection.setRequestProperty("If-Modified-Since", it) }
            }
            connection.connectTimeout = 8000
            connection.readTimeout = 8000
            connection.connect()
            val responseCode = connection.responseCode
            if (responseCode == HttpURLConnection.HTTP_NOT_MODIFIED) {
                return null
            }
            if (responseCode !in 200..299) {
                throw IOException("HTTP $responseCode")
            }
            connection.getHeaderField("ETag")?.takeIf { it.isNotBlank() }?.let { lastETag = it }
            connection.getHeaderField("Last-Modified")?.takeIf { it.isNotBlank() }?.let { lastModifiedHeader = it }

            val contentType = connection.contentType?.lowercase() ?: ""
            val charset = if (contentType.contains("utf-8")) "UTF-8" else "windows-1251"
            val contentEncoding = connection.contentEncoding?.lowercase() ?: ""
            val rawStream = connection.inputStream
            val stream = if (contentEncoding.contains("gzip")) {
                java.util.zip.GZIPInputStream(rawStream)
            } else {
                rawStream
            }
            stream.use { input ->
                Jsoup.parse(input, charset, urlStr)
            }
        } finally {
            connection.disconnect()
        }
    }

    private fun parseTableForQueue(table: Element, targetQueue: String, date: LocalDate): List<BlackoutSlot>? {
        val dateStr = date.format(DateTimeFormatter.ISO_LOCAL_DATE)
        val rows = table.select("tr")

        // Find the row containing this specific queue (e.g. "1.1") in its first 3 cells
        val targetRow = rows.firstOrNull { row ->
            val firstCells = row.select("td, th").take(3)
            firstCells.any { cell ->
                val txt = cell.text().trim()
                txt == targetQueue ||
                        txt == "Черга $targetQueue" ||
                        txt == "Черга $targetQueue." ||
                        txt.equals("$targetQueue черга", ignoreCase = true)
            }
        } ?: return null

        val tds = targetRow.select("td")
        if (tds.size < 24) {
            return null
        }

        // Filter out thin 3pt separator cells if any, then take the last 48 (or 24) schedule cells
        val validCells = tds.drop(1).filter { cell ->
            val style = cell.attr("style").lowercase().replace(" ", "")
            !style.contains("width:3pt") && !style.contains("width:1pt")
        }

        val slotCells = when {
            validCells.size >= 48 -> validCells.takeLast(48)
            tds.size >= 48 -> tds.takeLast(48)
            validCells.size >= 24 -> validCells.takeLast(24)
            else -> tds.takeLast(24)
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

            val isOff = attr.contains("#ff3333") || attr.contains("#ff3b30") || attr.contains("#ff0000") ||
                    attr.contains("background:red") || attr.contains("background: red") ||
                    attr.contains("background-color:red") || attr.contains("background-color: red") ||
                    attr.contains("rgb(255, 51, 51)") || attr.contains("rgb(255,51,51)") ||
                    attr.contains("rgb(255, 0, 0)") || attr.contains("rgb(255,0,0)") ||
                    attr.contains("danger") || text.contains("вимк") || text.contains("відкл") || text == "в" || text == "-"

            val status = if (isOff) SlotStatus.POWER_OFF else SlotStatus.POWER_ON

            BlackoutSlot(
                id = "${dateStr}_${startStr}_Q$targetQueue",
                startHour = startH,
                endHour = endH,
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
// =========================================================================================
// END OF CRITICAL SECTION — DO NOT MODIFY UNLESS EXPLICITLY REQUESTED
// =========================================================================================