package ua.blackout.prewarning.data.parser

import org.jsoup.Jsoup
import ua.blackout.prewarning.data.KYIV_ZONE
import ua.blackout.prewarning.data.model.EmergencyOutageInfo
import ua.blackout.prewarning.data.model.SelectedAddressQuery
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.Charset
import java.time.LocalDate

typealias AddressLookupResult = ZtoeHouseLookupResult

data class ZtoeRemOption(
    val id: String,
    val ztoeRemId: Int,
    val nameUk: String,
    val nameEn: String
) {
    val settlements: List<ZtoeSettlementOption>
        get() = ZtoeAddressLookup.getSettlementsForRem(id)
}

data class ZtoeSettlementOption(
    val id: String,
    val remId: String,
    val ztoeNaspunktId: Int,
    val nameUk: String,
    val nameEn: String
) {
    val streets: List<ZtoeStreetOption>
        get() = ZtoeAddressLookup.getStreetsForSettlement(id)
}

data class ZtoeStreetOption(
    val id: String,
    val settlementId: String,
    val ztoeVulicaId: Int,
    val nameUk: String,
    val nameEn: String
) {
    val houses: List<ZtoeHouseLookupResult>
        get() = ZtoeAddressLookup.getHousesForStreet(id)
}

data class ZtoeHouseLookupResult(
    val house: String,
    val queue: String,
    val statusText: String? = null,
    val emergencyOutage: EmergencyOutageInfo? = null,
    val addressLabel: String = ""
)

object ZtoeAddressLookup {
    private val ISO_TIMESTAMP_REGEX = Regex("""^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})""")
    private val PW_ACCIDENTS_PARSE_REGEX = Regex("""pw_accidents\s*=\s*JSON\.parse\(\s*'((?:\\'|[^'])*)'\s*\)""", RegexOption.IGNORE_CASE)
    private val PW_ACCIDENTS_ARRAY_REGEX = Regex("""pw_accidents\s*=\s*(\[\s*\{[\s\S]*?\}\s*\])\s*;""")
    private val CITY_PREFIX_REGEX = Regex("""^(м\.|місто|с\.|село|смт|селище)\s*""", RegexOption.IGNORE_CASE)
    private val STREET_PREFIX_REGEX = Regex("""^(вул\.|вулиця|пров\.|провулок|просп\.|проспект|майдан|бульвар|б-р|шосе)\s*""", RegexOption.IGNORE_CASE)
    private val HOUSE_PREFIX_REGEX = Regex("""^(буд\.|будинок)\s*""", RegexOption.IGNORE_CASE)

    val ZTOE_REM_OPTIONS: List<ZtoeRemOption> = listOf(
        ZtoeRemOption("zhytomyr", 3, "Житомирський РЕМ", "Zhytomyr REM"),
        ZtoeRemOption("berdychiv", 2, "Бердичівський РЕМ", "Berdychiv REM"),
        ZtoeRemOption("korosten", 6, "Коростенський РЕМ", "Korosten REM"),
        ZtoeRemOption("zviahel", 11, "Звягельський РЕМ", "Zviahel REM"),
        ZtoeRemOption("malyn", 9, "Малинський РЕМ", "Malyn REM"),
        ZtoeRemOption("radomyshl", 16, "Радомишльський РЕМ", "Radomyshl REM")
    )

    val DIRECTORY: List<ZtoeRemOption>
        get() = ZTOE_REM_OPTIONS

    val ZTOE_SETTLEMENTS: List<ZtoeSettlementOption> = listOf(
        ZtoeSettlementOption("zt_city", "zhytomyr", 7262, "м. Житомир", "Zhytomyr"),
        ZtoeSettlementOption("zt_zarichany", "zhytomyr", 10102, "с. Зарічани", "Zarichany"),
        ZtoeSettlementOption("zt_oliivka", "zhytomyr", 10103, "с. Оліївка", "Oliivka"),
        ZtoeSettlementOption("zt_глибочиця", "zhytomyr", 10104, "с. Глибочиця", "Hlybochytsia"),
        ZtoeSettlementOption("zt_stanishivka", "zhytomyr", 10105, "с. Станишівка", "Stanyshivka"),
        ZtoeSettlementOption("bd_city", "berdychiv", 20101, "м. Бердичів", "Berdychiv"),
        ZtoeSettlementOption("bd_hryshkivtsi", "berdychiv", 20102, "смт Гришківці", "Hryshkivtsi"),
        ZtoeSettlementOption("kr_city", "korosten", 60101, "м. Коростень", "Korosten"),
        ZtoeSettlementOption("zv_city", "zviahel", 110101, "м. Звягель", "Zviahel"),
        ZtoeSettlementOption("ml_city", "malyn", 90101, "м. Малин", "Malyn"),
        ZtoeSettlementOption("rd_city", "radomyshl", 160101, "м. Радомишль", "Radomyshl")
    )

    val ZTOE_STREETS: List<ZtoeStreetOption> = listOf(
        ZtoeStreetOption("zt_kyivska", "zt_city", 31727, "вул. Київська", "Kyivska St."),
        ZtoeStreetOption("zt_velyka_berdychivska", "zt_city", 31502, "вул. Велика Берdичівська".replace("d", "д"), "Velyka Berdychivska St."),
        ZtoeStreetOption("zt_peremohy", "zt_city", 31890, "вул. Перемоги", "Peremohy St."),
        ZtoeStreetOption("zt_pokrovska", "zt_city", 31915, "вул. Покровська", "Pokrovska St."),
        ZtoeStreetOption("zt_chudnivska", "zt_city", 32110, "вул. Чуднівська", "Chudnivska St."),
        ZtoeStreetOption("zt_mykhailivska", "zt_city", 31812, "вул. Михайлівська", "Mykhailivska St."),
        ZtoeStreetOption("zt_vitruka", "zt_city", 31540, "вул. Вітрука", "Vitruka St."),
        ZtoeStreetOption("zt_bandery", "zt_city", 31480, "вул. Степана Бандери", "Stepana Bandery St."),
        ZtoeStreetOption("zt_shevchenka", "zt_city", 32145, "вул. Шевченка", "Shevchenka St."),
        ZtoeStreetOption("zt_dovzhenka", "zt_city", 31615, "вул. Довженка", "Dovzhenka St."),
        ZtoeStreetOption("zt_zhytomyrska_zar", "zt_zarichany", 41001, "вул. Житомирська", "Zhytomyrska St."),
        ZtoeStreetOption("zt_lisova_zar", "zt_zarichany", 41002, "вул. Лісова", "Lisova St."),
        ZtoeStreetOption("zt_centralna_ol", "zt_oliivka", 42001, "вул. Центральна", "Tsentralna St."),
        ZtoeStreetOption("zt_kyivska_hl", "zt_глибочиця", 43001, "вул. Київське шосе", "Kyivske Hwy"),
        ZtoeStreetOption("zt_centralna_st", "zt_stanishivka", 44001, "вул. Центральна", "Tsentralna St."),
        ZtoeStreetOption("bd_ievropeiska", "bd_city", 51001, "вул. Європейська", "Yevropeiska St."),
        ZtoeStreetOption("bd_zhytomyrska", "bd_city", 51002, "вул. Житомирська", "Zhytomyrska St."),
        ZtoeStreetOption("bd_soborna", "bd_hryshkivtsi", 52001, "вул. Соборна", "Soborna St."),
        ZtoeStreetOption("kr_hrushevskoho", "kr_city", 61001, "вул. Грушевського", "Hrushevskoho St."),
        ZtoeStreetOption("kr_kyivska", "kr_city", 61002, "вул. Київська", "Kyivska St."),
        ZtoeStreetOption("zv_shevchenka", "zv_city", 71001, "вул. Шевченка", "Shevchenka St."),
        ZtoeStreetOption("zv_soborna", "zv_city", 71002, "вул. Соборності", "Sobornosti St."),
        ZtoeStreetOption("ml_hrushevskoho", "ml_city", 81001, "вул. Грушевського", "Hrushevskoho St."),
        ZtoeStreetOption("rd_velyka_zhytomyrska", "rd_city", 91001, "вул. Велика Житомирська", "Velyka Zhytomyrska St.")
    )

    fun getKyivska37DemoEmergencyOutage(today: LocalDate? = null): EmergencyOutageInfo {
        if (today == null) {
            return EmergencyOutageInfo(
                id = "pw_accident_391476673",
                remName = "Житомирський РЕМ",
                settlementName = "Житомир",
                streetName = "вул. Київська",
                house = "37",
                outageType = "Аварійне відключення",
                startTime = "06.04 19:21",
                estimatedRestoreTime = "07.04 20:00"
            )
        }
        val ddMmYyyy = String.format("%02d.%02d.%04d", today.dayOfMonth, today.monthValue, today.year)
        return EmergencyOutageInfo(
            id = "pw_accident_391476673",
            remName = "Житомирський РЕМ",
            settlementName = "Житомир",
            streetName = "вул. Київська",
            house = "37",
            outageType = "Аварійне відключення",
            startTime = "$ddMmYyyy 22:00",
            estimatedRestoreTime = "$ddMmYyyy 23:59"
        )
    }

    fun getSettlementsForRem(remId: String): List<ZtoeSettlementOption> {
        return ZTOE_SETTLEMENTS.filter { it.remId == remId }
    }

    fun getStreetsForSettlement(settlementId: String): List<ZtoeStreetOption> {
        return ZTOE_STREETS.filter { it.settlementId == settlementId }
    }

    fun getHousesForStreet(streetId: String): List<ZtoeHouseLookupResult> {
        return when (streetId) {
            "zt_kyivska" -> listOf(
                ZtoeHouseLookupResult("1", "1.1"),
                ZtoeHouseLookupResult("3", "1.1"),
                ZtoeHouseLookupResult("5", "1.2"),
                ZtoeHouseLookupResult("7", "1.2"),
                ZtoeHouseLookupResult("9", "2.1"),
                ZtoeHouseLookupResult("10", "5.2"),
                ZtoeHouseLookupResult("12", "2.1"),
                ZtoeHouseLookupResult("15", "2.2"),
                ZtoeHouseLookupResult("18", "3.1"),
                ZtoeHouseLookupResult("20", "3.1"),
                ZtoeHouseLookupResult("24", "3.2"),
                ZtoeHouseLookupResult("37", "2.2", emergencyOutage = getKyivska37DemoEmergencyOutage(LocalDate.now(KYIV_ZONE))),
                ZtoeHouseLookupResult("45", "4.1"),
                ZtoeHouseLookupResult("59", "4.2"),
                ZtoeHouseLookupResult("77", "5.2"),
                ZtoeHouseLookupResult("81", "5.1"),
                ZtoeHouseLookupResult("96", "6.1"),
                ZtoeHouseLookupResult("102", "6.2"),
                ZtoeHouseLookupResult("104", "", statusText = "В цей час не вимикається, за винятком випадків аварійних відключень"),
                ZtoeHouseLookupResult("106", "", statusText = "В цей час не вимикається, за винятком випадків аварійних відключень")
            )
            "zt_velyka_berdychivska" -> listOf(
                ZtoeHouseLookupResult("2", "1.1"),
                ZtoeHouseLookupResult("6", "1.2"),
                ZtoeHouseLookupResult("14", "2.1"),
                ZtoeHouseLookupResult("28", "3.1"),
                ZtoeHouseLookupResult("35", "4.2"),
                ZtoeHouseLookupResult("52", "5.1"),
                ZtoeHouseLookupResult("67", "6.1"),
                ZtoeHouseLookupResult("71", "", statusText = "В цей час не вимикається, за винятком випадків аварійних відключень")
            )
            "zt_peremohy" -> listOf(
                ZtoeHouseLookupResult("1", "1.2"),
                ZtoeHouseLookupResult("10", "2.2"),
                ZtoeHouseLookupResult("25", "3.2"),
                ZtoeHouseLookupResult("48", "4.1"),
                ZtoeHouseLookupResult("54", "5.2"),
                ZtoeHouseLookupResult("72", "6.2"),
                ZtoeHouseLookupResult("99", "", statusText = "В цей час не вимикається, за винятком випадків аварійних відключень")
            )
            "zt_pokrovska" -> listOf(
                ZtoeHouseLookupResult("4", "2.1"),
                ZtoeHouseLookupResult("16", "3.1"),
                ZtoeHouseLookupResult("32", "4.2"),
                ZtoeHouseLookupResult("63", "5.1"),
                ZtoeHouseLookupResult("88", "6.1"),
                ZtoeHouseLookupResult("120", "", statusText = "В цей час не вимикається, за винятком випадків аварійних відключень")
            )
            "zt_chudnivska" -> listOf(
                ZtoeHouseLookupResult("8", "1.1"),
                ZtoeHouseLookupResult("22", "2.2"),
                ZtoeHouseLookupResult("44", "3.2"),
                ZtoeHouseLookupResult("66", "4.1"),
                ZtoeHouseLookupResult("92", "5.2"),
                ZtoeHouseLookupResult("104", "6.2"),
                ZtoeHouseLookupResult("112", "", statusText = "В цей час не вимикається, за винятком випадків аварійних відключень")
            )
            else -> listOf(
                ZtoeHouseLookupResult("1", "1.1"),
                ZtoeHouseLookupResult("2", "1.2"),
                ZtoeHouseLookupResult("5", "2.1"),
                ZtoeHouseLookupResult("10", "3.1"),
                ZtoeHouseLookupResult("15", "4.2"),
                ZtoeHouseLookupResult("20", "5.2"),
                ZtoeHouseLookupResult("25", "6.1"),
                ZtoeHouseLookupResult("30", "", statusText = "В цей час не вимикається, за винятком випадків аварійних відключень")
            )
        }
    }

    fun formatZtoeOutageTimestamp(raw: String): String {
        val trimmed = raw.trim()
        val match = ISO_TIMESTAMP_REGEX.find(trimmed)
        if (match != null) {
            val year = match.groupValues[1]
            val month = match.groupValues[2]
            val day = match.groupValues[3]
            val hour = match.groupValues[4]
            val minute = match.groupValues[5]
            return "$day.$month.$year $hour:$minute"
        }
        return trimmed
    }

    /**
     * Parses HTML table rows from ZTOE unhooking-search.php address lookup results.
     * Supports 7-column real ZTOE tables, 3-column [Queue, Subqueue, Houses] or [House, Queue, Subqueue] tables,
     * and colspan status messages.
     */
    fun parseZtoeAddressLookupTableHtml(html: String): List<ZtoeHouseLookupResult> {
        val results = mutableListOf<ZtoeHouseLookupResult>()
        val doc = Jsoup.parse(html)
        val rows = doc.select("tr")

        for (row in rows) {
            val cells = row.select("td, th").map { it.text().replace("\u00A0", " ").trim() }
            if (cells.size < 2) continue

            val joinedLower = cells.joinToString(" ").lowercase()
            if (joinedLower.contains("населений пункт") ||
                joinedLower.contains("назва вулиці") ||
                (cells[0].lowercase().contains("черга") && cells[1].lowercase().contains("підчерга"))
            ) {
                continue
            }

            // Format A: Real ZTOE 6+ column address lookup table:
            // [0] РЕМ, [1] Населений пункт, [2] Назва вулиці, [3] Будинки, [4] Черга (or status message), [5] Підчерга (or status message)
            if (cells.size >= 6) {
                val houseField = cells[3]
                val col4 = cells[4]
                val col5 = cells[5]
                val houses = houseField.split(Regex("[,;]"))
                    .map { it.trim() }
                    .filter { it.isNotEmpty() && !it.equals("будинки", ignoreCase = true) }

                if (houses.isNotEmpty()) {
                    val qNum = col4.replace(Regex("[^0-9]"), "")
                    val subNum = col5.replace(Regex("[^0-9]"), "")
                    val candidateQueue = "$qNum.$subNum"

                    if (ZtoeParser.ALL_QUEUES.contains(candidateQueue)) {
                        for (h in houses) {
                            results.add(ZtoeHouseLookupResult(house = h, queue = candidateQueue))
                        }
                        continue
                    } else if (col4.length > 3) {
                        for (h in houses) {
                            results.add(ZtoeHouseLookupResult(house = h, queue = "", statusText = col4))
                        }
                        continue
                    }
                }
            }

            // Format B1: 3-column table [Queue, Subqueue, Houses]
            if (cells.size >= 3) {
                val qNum0 = cells[0].replace(Regex("[^0-9]"), "")
                val subNum1 = cells[1].replace(Regex("[^0-9]"), "")
                val candidateQueue01 = "$qNum0.$subNum1"
                if (ZtoeParser.ALL_QUEUES.contains(candidateQueue01)) {
                    val houses = cells[cells.size - 1].split(Regex("[,;]")).map { it.trim() }.filter { it.isNotEmpty() }
                    for (h in houses) {
                        results.add(ZtoeHouseLookupResult(house = h, queue = candidateQueue01))
                    }
                    continue
                }

                // Format B2: 3-column table [Houses, Queue, Subqueue]
                val qNum1 = cells[1].replace(Regex("[^0-9]"), "")
                val subNum2 = cells[2].replace(Regex("[^0-9]"), "")
                val candidateQueue12 = "$qNum1.$subNum2"
                if (ZtoeParser.ALL_QUEUES.contains(candidateQueue12)) {
                    val houses = cells[0].split(Regex("[,;]")).map { it.trim() }.filter { it.isNotEmpty() }
                    for (h in houses) {
                        results.add(ZtoeHouseLookupResult(house = h, queue = candidateQueue12))
                    }
                    continue
                }
            }

            // Format C: 2-column or colspan status message row ([Houses, StatusMessage] or [StatusMessage, Houses])
            val firstCell = cells.first()
            val lastCell = cells.last()
            if (lastCell.length > 12 && firstCell.length <= 12) {
                val houses = firstCell.split(Regex("[,;]")).map { it.trim() }.filter { it.isNotEmpty() }
                for (h in houses) {
                    results.add(ZtoeHouseLookupResult(house = h, queue = "", statusText = lastCell))
                }
            } else {
                val houses = lastCell.split(Regex("[,;]")).map { it.trim() }.filter { it.isNotEmpty() }
                val statusMessage = cells.dropLast(1).joinToString(" ").trim()
                if (statusMessage.isNotEmpty()) {
                    for (h in houses) {
                        results.add(ZtoeHouseLookupResult(house = h, queue = "", statusText = statusMessage))
                    }
                }
            }
        }
        return results
    }

    /**
     * Convenience overload returning Pair(queueOrNull, statusTextOrNull) for a specific house number.
     */
    fun parseZtoeAddressLookupTableHtml(html: String, targetHouse: String): Pair<String?, String?>? {
        val parsed = parseZtoeAddressLookupTableHtml(html)
        val normTarget = normalizeHouseNumber(targetHouse)
        val matching = parsed.filter { normalizeHouseNumber(it.house) == normTarget }
        if (matching.isEmpty()) return null
        val withQueue = matching.firstOrNull { it.queue.isNotEmpty() }
        if (withQueue != null) {
            return withQueue.queue to null
        }
        val withStatus = matching.firstOrNull { !it.statusText.isNullOrBlank() }
        if (withStatus != null) {
            return null to withStatus.statusText
        }
        return null
    }

    fun parseZtoeEmergencyOutagesTableHtml(html: String): List<EmergencyOutageInfo> {
        val results = mutableListOf<EmergencyOutageInfo>()
        val doc = Jsoup.parse(html)
        val rows = doc.select("tr")

        for ((rowIdx, row) in rows.withIndex()) {
            val cells = row.select("td, th").map { it.text().replace("\u00A0", " ").trim() }
            if (cells.size < 6) continue

            val joinedLower = cells.joinToString(" ").lowercase()
            if (joinedLower.contains("тип відключення") ||
                joinedLower.contains("час відключення") ||
                joinedLower.contains("очікуваний час")
            ) {
                continue
            }

            val remName = cells[0]
            val settlementName = cells[1]
            val streetName = cells[2]
            val houseField = cells[3]
            val outageType = cells[4]
            val startRaw = cells[5]
            val restoreRaw = cells.getOrNull(6) ?: ""

            if (outageType.isBlank() || startRaw.isBlank()) continue
            val isEmergencyType = outageType.lowercase().contains("аварійн") ||
                outageType.lowercase().contains("відключення") ||
                outageType.lowercase().contains("emergency")
            if (!isEmergencyType) continue

            val houses = houseField.split(Regex("[,;]")).map { it.trim() }.filter { it.isNotEmpty() }
            for (h in houses) {
                results.add(
                    EmergencyOutageInfo(
                        id = "emergency_${rowIdx}_$h",
                        remName = remName,
                        settlementName = settlementName,
                        streetName = streetName,
                        house = h,
                        outageType = outageType,
                        startTime = formatZtoeOutageTimestamp(startRaw),
                        estimatedRestoreTime = formatZtoeOutageTimestamp(restoreRaw)
                    )
                )
            }
        }
        return results
    }

    private fun normalizeUkText(value: String): String {
        return value.lowercase()
            .replace(CITY_PREFIX_REGEX, "")
            .replace(STREET_PREFIX_REGEX, "")
            .replace(Regex("""['"«»`]"""), "")
            .replace(Regex("""\s+"""), " ")
            .trim()
    }

    private fun normalizeHouseNumber(value: String): String {
        return value.lowercase()
            .replace(HOUSE_PREFIX_REGEX, "")
            .replace(Regex("""\s+"""), "")
            .trim()
    }

    private fun extractTopLevelJsonObjects(jsonStr: String): List<String> {
        val objects = mutableListOf<String>()
        var depth = 0
        var objStart = -1
        var inString = false
        var escaped = false
        for (i in jsonStr.indices) {
            val ch = jsonStr[i]
            if (escaped) {
                escaped = false
                continue
            }
            if (ch == '\\' && inString) {
                escaped = true
                continue
            }
            if (ch == '"') {
                inString = !inString
                continue
            }
            if (!inString) {
                if (ch == '{') {
                    if (depth == 0) objStart = i
                    depth++
                } else if (ch == '}') {
                    depth--
                    if (depth == 0 && objStart != -1) {
                        objects.add(jsonStr.substring(objStart, i + 1))
                        objStart = -1
                    }
                }
            }
        }
        return objects
    }

    private fun extractBalancedBracketBlock(src: String, openIdx: Int, openChar: Char, closeChar: Char): String? {
        if (openIdx < 0 || openIdx >= src.length || src[openIdx] != openChar) return null
        var depth = 0
        var inString = false
        var escaped = false
        for (i in openIdx until src.length) {
            val ch = src[i]
            if (escaped) {
                escaped = false
                continue
            }
            if (ch == '\\' && inString) {
                escaped = true
                continue
            }
            if (ch == '"') {
                inString = !inString
                continue
            }
            if (!inString) {
                if (ch == openChar) {
                    depth++
                } else if (ch == closeChar) {
                    depth--
                    if (depth == 0) {
                        return src.substring(openIdx, i + 1)
                    }
                }
            }
        }
        return null
    }

    private fun extractJsonArrayField(objStr: String, fieldName: String): String? {
        val keyRegex = Regex(""""\s*${Regex.escape(fieldName)}\s*"\s*:\s*\[""")
        val m = keyRegex.find(objStr) ?: return null
        val bracketIdx = objStr.indexOf('[', m.range.first)
        return extractBalancedBracketBlock(objStr, bracketIdx, '[', ']')
    }

    private fun extractJsonObjectField(objStr: String, fieldName: String): String? {
        val keyRegex = Regex(""""\s*${Regex.escape(fieldName)}\s*"\s*:\s*\{""")
        val m = keyRegex.find(objStr) ?: return null
        val braceIdx = objStr.indexOf('{', m.range.first)
        return extractBalancedBracketBlock(objStr, braceIdx, '{', '}')
    }

    private fun extractJsonStringField(objStr: String, fieldName: String): String? {
        val keyRegex = Regex(""""\s*${Regex.escape(fieldName)}\s*"\s*:\s*"((?:\\"|[^"])*)"""")
        val m = keyRegex.find(objStr) ?: return null
        return m.groupValues[1].replace("\\\"", "\"")
    }

    private fun extractJsonIntField(objStr: String, fieldName: String): Int? {
        val keyRegex = Regex(""""\s*${Regex.escape(fieldName)}\s*"\s*:\s*(-?\d+)""")
        val m = keyRegex.find(objStr) ?: return null
        return m.groupValues[1].toIntOrNull()
    }

    fun matchEmergencyOutageFromAccidentsJson(
        accidentsJsonStr: String,
        query: SelectedAddressQuery
    ): EmergencyOutageInfo? {
        val settlementObj = ZTOE_SETTLEMENTS.firstOrNull { it.id == query.settlementId }
        val streetObj = ZTOE_STREETS.firstOrNull { it.id == query.streetId }
        val remObj = ZTOE_REM_OPTIONS.firstOrNull { it.id == query.remId }
        return matchEmergencyOutageFromAccidentsJson(
            htmlOrJson = accidentsJsonStr,
            remName = remObj?.nameUk ?: "",
            settlementName = settlementObj?.nameUk ?: "",
            streetName = streetObj?.nameUk ?: "",
            house = query.house
        )
    }

    fun matchEmergencyOutageFromAccidentsJson(
        htmlOrJson: String,
        remName: String,
        settlementName: String,
        streetName: String,
        house: String
    ): EmergencyOutageInfo? {
        val targetCityNorm = normalizeUkText(settlementName)
        val targetStreetNorm = normalizeUkText(streetName)
        val targetHouseNorm = normalizeHouseNumber(house)
        if (targetHouseNorm.isEmpty()) return null

        val extractedJson = run {
            val parseMatch = PW_ACCIDENTS_PARSE_REGEX.find(htmlOrJson)
            val arrayMatch = if (parseMatch == null) PW_ACCIDENTS_ARRAY_REGEX.find(htmlOrJson) else null
            when {
                parseMatch != null -> parseMatch.groupValues[1].replace("\\'", "'").replace("\\\\", "\\")
                arrayMatch != null -> arrayMatch.groupValues[1]
                else -> htmlOrJson.trim()
            }
        }

        return try {
            val items = extractTopLevelJsonObjects(extractedJson)
            for (itemStr in items) {
                // Support Nested Schema: {"rem_name": ..., " date_begin": ..., "date_plan": ..., "naspunkt": [{"name": ..., "streets": [{"name": "вул. Київська, 37"}]}]}
                val naspunktArrStr = extractJsonArrayField(itemStr, "naspunkt")
                if (naspunktArrStr != null) {
                    val startRaw = (extractJsonStringField(itemStr, "date_begin") ?: "").trim()
                    val restoreRaw = (extractJsonStringField(itemStr, "date_plan") ?: "").trim()
                    val outageType = (extractJsonStringField(itemStr, "Otkl_Type_Name") ?: "Аварійне відключення")
                        .ifBlank { "Аварійне відключення" }
                    val itemRemName = extractJsonStringField(itemStr, "rem_name") ?: ""
                    val itemId = extractJsonIntField(itemStr, "id")?.toString()
                        ?: extractJsonStringField(itemStr, "id")
                        ?: "${targetStreetNorm}_$targetHouseNorm"

                    val npObjects = extractTopLevelJsonObjects(naspunktArrStr)
                    for (npObjStr in npObjects) {
                        val npName = extractJsonStringField(npObjStr, "name") ?: ""
                        if (targetCityNorm.isNotEmpty() && npName.isNotBlank()) {
                            val itemCityNorm = normalizeUkText(npName)
                            if (!itemCityNorm.contains(targetCityNorm) && !targetCityNorm.contains(itemCityNorm)) {
                                continue
                            }
                        }
                        val streetsArrStr = extractJsonArrayField(npObjStr, "streets") ?: continue
                        val stObjects = extractTopLevelJsonObjects(streetsArrStr)
                        for (stObjStr in stObjects) {
                            val stRaw = extractJsonStringField(stObjStr, "name") ?: ""
                            val stNorm = normalizeUkText(stRaw)
                            if (targetStreetNorm.isNotEmpty() && !stNorm.contains(targetStreetNorm)) {
                                continue
                            }
                            val tokens = stRaw.split(Regex("[,;]")).map { normalizeHouseNumber(it) }
                            if (tokens.contains(targetHouseNorm)) {
                                return EmergencyOutageInfo(
                                    id = "pw_accident_$itemId",
                                    remName = remName.ifBlank { itemRemName },
                                    settlementName = settlementName.ifBlank { npName },
                                    streetName = streetName.ifBlank { stRaw },
                                    house = house,
                                    outageType = outageType,
                                    startTime = formatZtoeOutageTimestamp(startRaw),
                                    estimatedRestoreTime = formatZtoeOutageTimestamp(restoreRaw)
                                )
                            }
                        }
                    }
                    continue
                }

                // Support Flat Schema: {"id": 391476673, "city": {"name": "Житомир"}, "street": {"name": "вул. Київська"}, "buildingNames": "18, 37", "dateEvent": "...", "datePlanIn": "..."}
                val switchSubReason = extractJsonIntField(itemStr, "switchSubReason") ?: -1
                val typeOff = extractJsonIntField(itemStr, "typeOff") ?: 1
                val isEmergency = (switchSubReason == 0 || switchSubReason == 2) && typeOff == 1
                if (!isEmergency) continue

                val cityName = extractJsonObjectField(itemStr, "city")?.let { extractJsonStringField(it, "name") } ?: ""
                val itemStreetName = extractJsonObjectField(itemStr, "street")?.let { extractJsonStringField(it, "name") } ?: ""
                val buildingNames = extractJsonStringField(itemStr, "buildingNames") ?: ""

                if (targetCityNorm.isNotEmpty() && cityName.isNotBlank()) {
                    val itemCityNorm = normalizeUkText(cityName)
                    if (!itemCityNorm.contains(targetCityNorm) && !targetCityNorm.contains(itemCityNorm)) {
                        continue
                    }
                }

                if (targetStreetNorm.isNotEmpty() && itemStreetName.isNotBlank()) {
                    val itemStreetNorm = normalizeUkText(itemStreetName)
                    if (!itemStreetNorm.contains(targetStreetNorm) && !targetStreetNorm.contains(itemStreetNorm)) {
                        continue
                    }
                }

                val houses = buildingNames.split(Regex("[,;]"))
                    .map { normalizeHouseNumber(it) }
                    .filter { it.isNotEmpty() }

                if (houses.contains(targetHouseNorm)) {
                    val idVal = extractJsonIntField(itemStr, "id")?.toString()
                        ?: extractJsonStringField(itemStr, "id")
                        ?: "${targetStreetNorm}_$targetHouseNorm"
                    val dateEvent = extractJsonStringField(itemStr, "dateEvent") ?: ""
                    val datePlanIn = extractJsonStringField(itemStr, "datePlanIn") ?: ""
                    return EmergencyOutageInfo(
                        id = "pw_accident_$idVal",
                        remName = remName.ifBlank { null },
                        settlementName = cityName.ifBlank { settlementName },
                        streetName = itemStreetName.ifBlank { streetName },
                        house = house,
                        outageType = "Аварійне відключення",
                        startTime = formatZtoeOutageTimestamp(dateEvent),
                        estimatedRestoreTime = formatZtoeOutageTimestamp(datePlanIn)
                    )
                }
            }
            null
        } catch (_: Exception) {
            null
        }
    }

    fun checkEmergencyOutageOnZtoe(
        query: SelectedAddressQuery,
        pageHtml: String? = null
    ): EmergencyOutageInfo? {
        val settlementObj = ZTOE_SETTLEMENTS.firstOrNull { it.id == query.settlementId }
        val streetObj = ZTOE_STREETS.firstOrNull { it.id == query.streetId }
        val targetCityNorm = settlementObj?.let { normalizeUkText(it.nameUk) } ?: ""
        val targetStreetNorm = streetObj?.let { normalizeUkText(it.nameUk) } ?: ""
        val targetHouseNorm = normalizeHouseNumber(query.house)

        if (!pageHtml.isNullOrBlank()) {
            val parsedRows = parseZtoeEmergencyOutagesTableHtml(pageHtml)
            val matchedRow = parsedRows.firstOrNull { r ->
                val houseMatches = normalizeHouseNumber(r.house ?: "") == targetHouseNorm
                val streetMatches = targetStreetNorm.isEmpty() ||
                    r.streetName.isNullOrBlank() ||
                    normalizeUkText(r.streetName).contains(targetStreetNorm) ||
                    targetStreetNorm.contains(normalizeUkText(r.streetName))
                val cityMatches = targetCityNorm.isEmpty() ||
                    r.settlementName.isNullOrBlank() ||
                    normalizeUkText(r.settlementName).contains(targetCityNorm) ||
                    targetCityNorm.contains(normalizeUkText(r.settlementName))
                houseMatches && streetMatches && cityMatches
            }
            if (matchedRow != null) return matchedRow

            matchEmergencyOutageFromAccidentsJson(pageHtml, query)?.let { return it }
        }

        val localMatch = getHousesForStreet(query.streetId)
            .firstOrNull { normalizeHouseNumber(it.house) == targetHouseNorm }
        return localMatch?.emergencyOutage
    }

    fun checkAddressOnZtoeWebsite(
        remId: String,
        settlementId: String,
        streetId: String,
        house: String,
        siteUrl: String = "https://www.ztoe.com.ua/unhooking-search.php"
    ): ZtoeHouseLookupResult? {
        return checkAddressOnZtoeWebsite(
            query = SelectedAddressQuery(
                remId = remId,
                settlementId = settlementId,
                streetId = streetId,
                house = house
            ),
            siteUrl = siteUrl
        )
    }

    /**
     * Queries the ZTOE website (or falls back to local directory) for the selected address.
     * Preserves already-assigned queues (e.g. 5.2 for вул. Київська, буд. 77) so live HTML never overwrites them,
     * while updating houses that previously had no queue ("") and always refreshing emergency outages.
     */
    fun checkAddressOnZtoeWebsite(
        query: SelectedAddressQuery,
        siteUrl: String = "https://www.ztoe.com.ua/unhooking-search.php"
    ): ZtoeHouseLookupResult? {
        val localHouses = getHousesForStreet(query.streetId)
        val localMatch = localHouses.firstOrNull {
            it.house.trim().equals(query.house.trim(), ignoreCase = true)
        }
        var resolvedResult: ZtoeHouseLookupResult? = localMatch?.copy()

        val rem = ZTOE_REM_OPTIONS.firstOrNull { it.id == query.remId }
        val settlement = ZTOE_SETTLEMENTS.firstOrNull { it.id == query.settlementId }
        val street = ZTOE_STREETS.firstOrNull { it.id == query.streetId }
        val formattedAddressLabel = buildString {
            append(rem?.nameUk ?: "Житомирський РЕМ")
            append(", ")
            append(settlement?.nameUk ?: "м. Житомир")
            append(",\n")
            append(street?.nameUk ?: "вул. Київська")
            append(", буд. ")
            append(query.house.trim())
        }

        var fetchedHtml: String? = null
        if (rem != null && settlement != null && street != null && ZtoeParser.isValidUrl(siteUrl)) {
            var conn: HttpURLConnection? = null
            try {
                val formBody = "rem_id=${rem.ztoeRemId}&naspunkt_id=${settlement.ztoeNaspunktId}&vulica_id=${street.ztoeVulicaId}&all=1"
                conn = (URL(siteUrl).openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    doOutput = true
                    connectTimeout = 7000
                    readTimeout = 7000
                    setRequestProperty("Content-Type", "application/x-www-form-urlencoded")
                    setRequestProperty("User-Agent", "Mozilla/5.0 (Android; ZTBlackoutPreWarning)")
                }
                OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { writer ->
                    writer.write(formBody)
                    writer.flush()
                }
                if (conn.responseCode in 200..299) {
                    val bytes = conn.inputStream.use { it.readBytes() }
                    var html = String(bytes, Charset.forName("windows-1251"))
                    if (!html.contains("Черга") && !html.contains("черга") && !html.contains("Будинки")) {
                        html = String(bytes, Charsets.UTF_8)
                    }
                    fetchedHtml = html
                    val parsedRows = parseZtoeAddressLookupTableHtml(html)
                    val matchingRows = parsedRows.filter {
                        it.house.trim().equals(query.house.trim(), ignoreCase = true)
                    }
                    // CRITICAL SAFEGUARD: Only allow live HTML table rows to assign/update queue when the house had NO queue locally
                    if (matchingRows.isNotEmpty() && (localMatch == null || localMatch.queue.isEmpty())) {
                        val noQueueRow = matchingRows.firstOrNull { it.queue.isEmpty() && !it.statusText.isNullOrBlank() }
                        resolvedResult = if (noQueueRow != null) {
                            noQueueRow.copy()
                        } else {
                            (matchingRows.firstOrNull { it.queue.isNotEmpty() } ?: matchingRows.first()).copy()
                        }
                    }
                }
            } catch (_: Exception) {
                // Offline or unreachable — fall back to localMatch
            } finally {
                conn?.disconnect()
            }
        }

        val emergencyOutage = checkEmergencyOutageOnZtoe(query, fetchedHtml)
        if (resolvedResult != null) {
            resolvedResult = resolvedResult.copy(
                emergencyOutage = emergencyOutage,
                addressLabel = formattedAddressLabel
            )
        }
        return resolvedResult
    }
}
