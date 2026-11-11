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
    val nameEn: String,
    val ztoeOtgId: Int? = null
) {
    val settlements: List<ZtoeSettlementOption>
        get() = ZtoeAddressLookup.getSettlementsForRem(id)
}

data class ZtoeSettlementOption(
    val id: String,
    val remId: String,
    val ztoeNaspunktId: Int,
    val nameUk: String,
    val nameEn: String,
    val poweronCityId: Int? = null
) {
    val streets: List<ZtoeStreetOption>
        get() = ZtoeAddressLookup.getStreetsForSettlement(id)
}

data class ZtoeStreetOption(
    val id: String,
    val settlementId: String,
    val ztoeVulicaId: Int,
    val nameUk: String,
    val nameEn: String,
    val poweronStreetId: Int? = null
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

    private val VALID_OUTAGE_TIMESTAMP_REGEX = Regex("""(?:\b\d{1,2}\.\d{1,2}(?:\.\d{2,4})?\b|\b\d{4}-\d{2}-\d{2}\b)?[\sT]*\b([01]?\d|2[0-3]):[0-5]\d\b""")

    private const val PREFS_NAME = "zt_address_index_cache_v1"
    private const val KEY_INDEX_JSON = "address_index_json_v1"
    private const val MAX_PERSISTED_HOUSE_STREETS = 50
    private const val FRESH_HOUSE_CACHE_TTL_MS = 120_000L

    private val SELECT_REM_REGEX = Regex("""<select[^>]*name=["']?rem_id["']?[^>]*>([\s\S]*?)</select>""", RegexOption.IGNORE_CASE)
    private val SELECT_NASPUNKT_REGEX = Regex("""<select[^>]*name=["']?naspunkt_id["']?[^>]*>([\s\S]*?)</select>""", RegexOption.IGNORE_CASE)
    private val SELECT_VULICA_REGEX = Regex("""<select[^>]*name=["']?vulica_id["']?[^>]*>([\s\S]*?)</select>""", RegexOption.IGNORE_CASE)
    private val OPTION_TAG_REGEX = Regex("""<option\s+value=["']?(\d+)["']?[^>]*>([\s\S]*?)</option>""", RegexOption.IGNORE_CASE)
    private val TR_TAG_REGEX = Regex("""<tr\b[^>]*>([\s\S]*?)</tr>""", RegexOption.IGNORE_CASE)
    private val TD_TH_TAG_REGEX = Regex("""<(?:td|th)\b[^>]*>([\s\S]*?)</(?:td|th)>""", RegexOption.IGNORE_CASE)
    private val HTML_TAG_STRIP_REGEX = Regex("""<[^>]*>""")
    private val WHITESPACE_COLLAPSE_REGEX = Regex("""\s+""")

    @Volatile
    private var appContext: android.content.Context? = null

    @Volatile
    private var diskCacheHydrated: Boolean = false

    @Volatile
    private var cachedRems: List<ZtoeRemOption>? = null
    private val cachedSettlementsByRem = java.util.concurrent.ConcurrentHashMap<String, List<ZtoeSettlementOption>>()
    private val cachedStreetsBySettlement = java.util.concurrent.ConcurrentHashMap<String, List<ZtoeStreetOption>>()
    private val cachedHousesByStreet = java.util.concurrent.ConcurrentHashMap<String, List<ZtoeHouseLookupResult>>()
    private val houseCacheUpdatedAtByStreet = java.util.concurrent.ConcurrentHashMap<String, Long>()
    private val settlementFetchLocks = java.util.concurrent.ConcurrentHashMap<String, Any>()
    private val recentHouseStreetOrder = java.util.concurrent.CopyOnWriteArrayList<String>()
    private const val ACCIDENTS_CACHE_TTL_MS = 60_000L
    private val accidentsCacheByScope = java.util.concurrent.ConcurrentHashMap<String, Pair<Long, String>>()
    private val diskPersistExecutor = java.util.concurrent.Executors.newSingleThreadExecutor { r ->
        Thread(r, "ZtoeDiskCachePersist").apply {
            isDaemon = true
            priority = Thread.MIN_PRIORITY
        }
    }

    private val APOS_ENTITY_REGEX = Regex("""&#0*39;|&#x0*27;|&apos;|&#8217;|&#0*146;""", RegexOption.IGNORE_CASE)
    private val QUOT_ENTITY_REGEX = Regex("""&quot;|&#0*34;""", RegexOption.IGNORE_CASE)
    private val NBSP_ENTITY_REGEX = Regex("""&nbsp;|&#0*160;""", RegexOption.IGNORE_CASE)

    private fun stripHtmlFast(raw: String): String {
        return raw
            .replace(HTML_TAG_STRIP_REGEX, " ")
            .replace("&amp;", "&", ignoreCase = true)
            .replace(NBSP_ENTITY_REGEX, " ")
            .replace("\u00A0", " ")
            .replace(APOS_ENTITY_REGEX, "'")
            .replace(QUOT_ENTITY_REGEX, "\"")
            .replace(WHITESPACE_COLLAPSE_REGEX, " ")
            .trim()
    }

    private fun recordRecentHouseStreet(streetId: String) {
        if (streetId.isBlank()) return
        recentHouseStreetOrder.remove(streetId)
        recentHouseStreetOrder.add(0, streetId)
        while (recentHouseStreetOrder.size > MAX_PERSISTED_HOUSE_STREETS) {
            recentHouseStreetOrder.removeAt(recentHouseStreetOrder.size - 1)
        }
    }

    private fun escapeJsonStr(value: String): String {
        return value
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
    }

    fun serializeCacheToJson(): String {
        return buildString {
            append("{")
            append("\"version\":1,")
            append("\"rems\":[")
            val remsToSave = cachedRems ?: emptyList()
            remsToSave.forEachIndexed { idx, r ->
                if (idx > 0) append(",")
                append("{")
                append("\"id\":\"${escapeJsonStr(r.id)}\",")
                append("\"ztoeRemId\":${r.ztoeRemId},")
                append("\"nameUk\":\"${escapeJsonStr(r.nameUk)}\",")
                append("\"nameEn\":\"${escapeJsonStr(r.nameEn)}\"")
                append("}")
            }
            append("],")

            append("\"settlements\":[")
            var sFirst = true
            for (list in cachedSettlementsByRem.values) {
                for (s in list) {
                    if (!sFirst) append(",")
                    sFirst = false
                    append("{")
                    append("\"id\":\"${escapeJsonStr(s.id)}\",")
                    append("\"remId\":\"${escapeJsonStr(s.remId)}\",")
                    append("\"ztoeNaspunktId\":${s.ztoeNaspunktId},")
                    append("\"nameUk\":\"${escapeJsonStr(s.nameUk)}\",")
                    append("\"nameEn\":\"${escapeJsonStr(s.nameEn)}\"")
                    append("}")
                }
            }
            append("],")

            append("\"streets\":[")
            var stFirst = true
            for (list in cachedStreetsBySettlement.values) {
                for (st in list) {
                    if (!stFirst) append(",")
                    stFirst = false
                    append("{")
                    append("\"id\":\"${escapeJsonStr(st.id)}\",")
                    append("\"settlementId\":\"${escapeJsonStr(st.settlementId)}\",")
                    append("\"ztoeVulicaId\":${st.ztoeVulicaId},")
                    append("\"nameUk\":\"${escapeJsonStr(st.nameUk)}\",")
                    append("\"nameEn\":\"${escapeJsonStr(st.nameEn)}\"")
                    append("}")
                }
            }
            append("],")

            append("\"houses\":[")
            var hFirst = true
            val orderedStreets = (recentHouseStreetOrder.toList() + cachedHousesByStreet.keys().toList())
                .distinct()
                .take(MAX_PERSISTED_HOUSE_STREETS)

            for (streetId in orderedStreets) {
                val hList = cachedHousesByStreet[streetId] ?: continue
                for (h in hList) {
                    if (!hFirst) append(",")
                    hFirst = false
                    append("{")
                    append("\"streetId\":\"${escapeJsonStr(streetId)}\",")
                    append("\"house\":\"${escapeJsonStr(h.house)}\",")
                    append("\"queue\":\"${escapeJsonStr(h.queue)}\"")
                    if (!h.statusText.isNullOrBlank()) {
                        append(",\"statusText\":\"${escapeJsonStr(h.statusText)}\"")
                    }
                    append("}")
                }
            }
            append("]}")
        }
    }

    fun hydrateCacheFromJson(jsonStr: String): Boolean {
        if (jsonStr.isBlank()) return false
        return try {
            val remsArrStr = extractJsonArrayField(jsonStr, "rems")
            if (remsArrStr != null) {
                val parsedRems = mutableListOf<ZtoeRemOption>()
                for (objStr in extractTopLevelJsonObjects(remsArrStr)) {
                    val id = extractJsonStringField(objStr, "id") ?: continue
                    val ztoeRemId = extractJsonIntField(objStr, "ztoeRemId") ?: continue
                    val nameUk = stripHtmlFast(extractJsonStringField(objStr, "nameUk") ?: continue)
                    val nameEn = stripHtmlFast(extractJsonStringField(objStr, "nameEn") ?: nameUk)
                    parsedRems.add(ZtoeRemOption(id, ztoeRemId, nameUk, nameEn))
                }
                if (parsedRems.isNotEmpty()) {
                    cachedRems = parsedRems
                }
            }

            val settlementsArrStr = extractJsonArrayField(jsonStr, "settlements")
            if (settlementsArrStr != null) {
                val grouped = LinkedHashMap<String, MutableList<ZtoeSettlementOption>>()
                for (objStr in extractTopLevelJsonObjects(settlementsArrStr)) {
                    val id = extractJsonStringField(objStr, "id") ?: continue
                    val remId = extractJsonStringField(objStr, "remId") ?: continue
                    val npId = extractJsonIntField(objStr, "ztoeNaspunktId") ?: continue
                    val nameUk = stripHtmlFast(extractJsonStringField(objStr, "nameUk") ?: continue)
                    val nameEn = stripHtmlFast(extractJsonStringField(objStr, "nameEn") ?: nameUk)
                    grouped.getOrPut(remId) { mutableListOf() }.add(
                        ZtoeSettlementOption(id, remId, npId, nameUk, nameEn)
                    )
                }
                for ((remId, list) in grouped) {
                    if (list.isNotEmpty()) {
                        cachedSettlementsByRem[remId] = list
                    }
                }
            }

            val streetsArrStr = extractJsonArrayField(jsonStr, "streets")
            if (streetsArrStr != null) {
                val grouped = LinkedHashMap<String, MutableList<ZtoeStreetOption>>()
                for (objStr in extractTopLevelJsonObjects(streetsArrStr)) {
                    val id = extractJsonStringField(objStr, "id") ?: continue
                    val settlementId = extractJsonStringField(objStr, "settlementId") ?: continue
                    val vulId = extractJsonIntField(objStr, "ztoeVulicaId") ?: continue
                    val nameUk = stripHtmlFast(extractJsonStringField(objStr, "nameUk") ?: continue)
                    val nameEn = stripHtmlFast(extractJsonStringField(objStr, "nameEn") ?: nameUk)
                    grouped.getOrPut(settlementId) { mutableListOf() }.add(
                        ZtoeStreetOption(id, settlementId, vulId, nameUk, nameEn)
                    )
                }
                for ((settlementId, list) in grouped) {
                    if (list.isNotEmpty()) {
                        cachedStreetsBySettlement[settlementId] = list
                    }
                }
            }

            val housesArrStr = extractJsonArrayField(jsonStr, "houses")
            if (housesArrStr != null) {
                val grouped = LinkedHashMap<String, MutableList<ZtoeHouseLookupResult>>()
                var loadedStreets = 0
                for (objStr in extractTopLevelJsonObjects(housesArrStr)) {
                    val streetId = extractJsonStringField(objStr, "streetId") ?: continue
                    if (!grouped.containsKey(streetId)) {
                        if (loadedStreets >= MAX_PERSISTED_HOUSE_STREETS) continue
                        loadedStreets++
                    }
                    val house = extractJsonStringField(objStr, "house") ?: continue
                    val queue = extractJsonStringField(objStr, "queue") ?: ""
                    val statusText = extractJsonStringField(objStr, "statusText")
                    grouped.getOrPut(streetId) { mutableListOf() }.add(
                        ZtoeHouseLookupResult(house = house, queue = queue, statusText = statusText)
                    )
                }
                for ((streetId, list) in grouped) {
                    if (list.isNotEmpty()) {
                        cachedHousesByStreet[streetId] = list
                    }
                }
            }
            diskCacheHydrated = true
            true
        } catch (_: Exception) {
            false
        }
    }

    fun initDiskCache(context: android.content.Context): Boolean {
        appContext = context.applicationContext
        if (diskCacheHydrated && cachedRems != null) return true
        return try {
            val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE)
            val rawJson = prefs.getString(KEY_INDEX_JSON, null) ?: return false
            hydrateCacheFromJson(rawJson)
        } catch (_: Exception) {
            false
        }
    }

    fun persistToDiskCache() {
        val ctx = appContext ?: return
        diskPersistExecutor.execute {
            try {
                val json = serializeCacheToJson()
                ctx.getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE)
                    .edit()
                    .putString(KEY_INDEX_JSON, json)
                    .apply()
            } catch (_: Exception) {
            }
        }
    }

    fun clearCacheForTesting() {
        diskCacheHydrated = false
        cachedRems = null
        cachedSettlementsByRem.clear()
        cachedStreetsBySettlement.clear()
        cachedHousesByStreet.clear()
        houseCacheUpdatedAtByStreet.clear()
        settlementFetchLocks.clear()
        recentHouseStreetOrder.clear()
        accidentsCacheByScope.clear()
    }

    val ZTOE_REM_OPTIONS: List<ZtoeRemOption> = listOf(
        ZtoeRemOption("zhytomyr", 7, "Житомирський РЕМ", "Zhytomyr REM", 6),
        ZtoeRemOption("berdychiv", 3, "Бердичівський РЕМ", "Berdychiv REM", 3),
        ZtoeRemOption("korosten", 9, "Коростенський РЕМ", "Korosten REM", 7),
        ZtoeRemOption("zviahel", 16, "Звягельський РЕМ", "Zviahel REM", 11),
        ZtoeRemOption("malyn", 14, "Малинський РЕМ", "Malyn REM", 10),
        ZtoeRemOption("radomyshl", 20, "Радомишльський РЕМ", "Radomyshl REM", 15),
        ZtoeRemOption("andrushivka", 1, "Андрушівський РЕМ", "Andrushivka REM", 1),
        ZtoeRemOption("baranivka", 2, "Баранівський РЕМ", "Baranivka REM", 2),
        ZtoeRemOption("brusyliv", 4, "Брусилівський РЕМ", "Brusyliv REM", 4),
        ZtoeRemOption("korostyshiv", 11, "Коростишівський РЕМ", "Korostyshiv REM", 8),
        ZtoeRemOption("liubar", 13, "Любарський РЕМ", "Liubar REM", 9),
        ZtoeRemOption("ovruch", 17, "Овруцький РЕМ", "Ovruch REM", 12),
        ZtoeRemOption("olevsk", 18, "Олевський РЕМ", "Olevsk REM", 13),
        ZtoeRemOption("popilnia", 19, "Попільнянський РЕМ", "Popilnia REM", 14),
        ZtoeRemOption("pulyny", 23, "Пулинський РЕМ", "Pulyny REM", 17),
        ZtoeRemOption("romaniv", 21, "Романівський РЕМ", "Romaniv REM", 16),
        ZtoeRemOption("khoroshiv", 5, "Хорошівський РЕМ", "Khoroshiv REM", 5),
        ZtoeRemOption("cherniakhiv", 24, "Черняхівський РЕМ", "Cherniakhiv REM", 18),
        ZtoeRemOption("chudniv", 25, "Чуднівський РЕМ", "Chudniv REM", 19)
    )

    fun getRems(): List<ZtoeRemOption> = cachedRems ?: ZTOE_REM_OPTIONS

    val DIRECTORY: List<ZtoeRemOption>
        get() = getRems()

    val ZTOE_SETTLEMENTS: List<ZtoeSettlementOption> = listOf(
        ZtoeSettlementOption("zt_city", "zhytomyr", 16657, "м. Житомир", "Zhytomyr", 333),
        ZtoeSettlementOption("zt_zarichany", "zhytomyr", 16670, "с. Зарічани", "Zarichany"),
        ZtoeSettlementOption("zt_oliivka", "zhytomyr", 16700, "с. Оліївка", "Oliivka"),
        ZtoeSettlementOption("zt_глибочиця", "zhytomyr", 16667, "с. Глибочиця", "Hlybochytsia"),
        ZtoeSettlementOption("zt_stanishivka", "zhytomyr", 16680, "с. Станишівка", "Stanyshivka"),
        ZtoeSettlementOption("bd_city", "berdychiv", 16758, "м. Бердичів", "Berdychiv"),
        ZtoeSettlementOption("bd_hryshkivtsi", "berdychiv", 16760, "смт Гришківці", "Hryshkivtsi"),
        ZtoeSettlementOption("kr_city", "korosten", 17062, "м. Коростень", "Korosten"),
        ZtoeSettlementOption("zv_city", "zviahel", 16823, "м. Звягель", "Zviahel"),
        ZtoeSettlementOption("ml_city", "malyn", 17634, "м. Малин", "Malyn"),
        ZtoeSettlementOption("rd_city", "radomyshl", 17899, "м. Радомишль", "Radomyshl"),
        ZtoeSettlementOption("an_city", "andrushivka", 17694, "м. Андрушівка", "Andrushivka"),
        ZtoeSettlementOption("br_city", "baranivka", 15417, "м. Баранівка", "Baranivka"),
        ZtoeSettlementOption("bs_city", "brusyliv", 16202, "селище Брусилів", "Brusyliv"),
        ZtoeSettlementOption("ks_city", "korostyshiv", 15747, "м. Коростишів", "Korostyshiv"),
        ZtoeSettlementOption("lb_city", "liubar", 17742, "селище Любар", "Liubar"),
        ZtoeSettlementOption("ov_city", "ovruch", 17197, "м. Овруч", "Ovruch"),
        ZtoeSettlementOption("ol_city", "olevsk", 17823, "м. Олевськ", "Olevsk"),
        ZtoeSettlementOption("pp_city", "popilnia", 17555, "селище Попільня", "Popilnia"),
        ZtoeSettlementOption("pl_city", "pulyny", 16602, "селище Пулини", "Pulyny"),
        ZtoeSettlementOption("rm_city", "romaniv", 17968, "селище Романів", "Romaniv"),
        ZtoeSettlementOption("kh_city", "khoroshiv", 16281, "селище Хорошів", "Khoroshiv"),
        ZtoeSettlementOption("ch_city", "cherniakhiv", 16063, "селище Черняхів", "Cherniakhiv"),
        ZtoeSettlementOption("cd_city", "chudniv", 18001, "м. Чуднів", "Chudniv")
    )

    val ZTOE_STREETS: List<ZtoeStreetOption> = listOf(
        ZtoeStreetOption("zt_kyivska", "zt_city", 173934, "вул. Київська", "Kyivska St.", 4755),
        ZtoeStreetOption("zt_velyka_berdychivska", "zt_city", 174574, "вул. Велика Бердичівська", "Velyka Berdychivska St.", 4642),
        ZtoeStreetOption("zt_peremohy", "zt_city", 173948, "вул. Перемоги", "Peremohy St.", 4754),
        ZtoeStreetOption("zt_pokrovska", "zt_city", 173949, "вул. Покровська", "Pokrovska St.", 4633),
        ZtoeStreetOption("zt_chudnivska", "zt_city", 174543, "вул. Чуднівська", "Chudnivska St.", 4645),
        ZtoeStreetOption("zt_mykhailivska", "zt_city", 174152, "вул. Михайлівська", "Mykhailivska St.", 33622),
        ZtoeStreetOption("zt_vitruka", "zt_city", 174457, "вул. Вітрука", "Vitruka St.", 4620),
        ZtoeStreetOption("zt_bandery", "zt_city", 173952, "вул. Степана Бандери", "Stepana Bandery St.", 33488),
        ZtoeStreetOption("st_173952", "zt_city", 173952, "вул. Степана Бандери", "Stepana Bandery St.", 33488),
        ZtoeStreetOption("zt_shevchenka", "zt_city", 174478, "вул. Шевченка", "Shevchenka St.", 4625),
        ZtoeStreetOption("zt_dovzhenka", "zt_city", 174495, "вул. Довженка", "Dovzhenka St.", 4631),
        ZtoeStreetOption("zt_lesi", "zt_city", 173937, "вул. Лесі Українки", "Lesi Ukrainky St.", 4788),
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
        ZtoeStreetOption("rd_velyka_zhytomyrska", "rd_city", 91001, "вул. Велика Житомирська", "Velyka Zhytomyrska St."),
        ZtoeStreetOption("an_soborna", "an_city", 101001, "вул. Соборна", "Soborna St."),
        ZtoeStreetOption("br_soborna", "br_city", 102001, "вул. Соборна", "Soborna St."),
        ZtoeStreetOption("bs_soborna", "bs_city", 103001, "вул. Соборна", "Soborna St."),
        ZtoeStreetOption("ks_soborna", "ks_city", 104001, "вул. Соборна", "Soborna St."),
        ZtoeStreetOption("lb_soborna", "lb_city", 105001, "вул. Незалежності", "Nezalezhnosti St."),
        ZtoeStreetOption("ov_soborna", "ov_city", 106001, "вул. Соборна", "Soborna St."),
        ZtoeStreetOption("ol_soborna", "ol_city", 107001, "вул. Свято-Миколаївська", "Sviato-Mykolaivska St."),
        ZtoeStreetOption("pp_soborna", "pp_city", 108001, "вул. Богдана Хмельницького", "Bohdana Khmelnytskoho St."),
        ZtoeStreetOption("pl_soborna", "pl_city", 109001, "вул. Незалежності", "Nezalezhnosti St."),
        ZtoeStreetOption("rm_soborna", "rm_city", 110001, "вул. Небесної Сотні", "Nebesnoi Sotni St."),
        ZtoeStreetOption("kh_soborna", "kh_city", 111001, "вул. Незалежності", "Nezalezhnosti St."),
        ZtoeStreetOption("ch_soborna", "ch_city", 112001, "вул. Володимирська", "Volodymyrska St."),
        ZtoeStreetOption("cd_soborna", "cd_city", 113001, "вул. Соборна", "Soborna St.")
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
        return cachedSettlementsByRem[remId] ?: ZTOE_SETTLEMENTS.filter { it.remId == remId }
    }

    fun getStreetsForSettlement(settlementId: String): List<ZtoeStreetOption> {
        return cachedStreetsBySettlement[settlementId] ?: ZTOE_STREETS.filter { it.settlementId == settlementId }
    }

    fun getDefaultHousesForStreet(streetId: String): List<ZtoeHouseLookupResult> {
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
                ZtoeHouseLookupResult("74", "", statusText = "В цей час не вимикається, за винятком випадків аварійних відключень"),
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
            "zt_bandery", "st_173952" -> listOf(
                ZtoeHouseLookupResult("2", "1.2"),
                ZtoeHouseLookupResult("3", "1.2"),
                ZtoeHouseLookupResult("4", "1.2"),
                ZtoeHouseLookupResult("4А", "1.2"),
                ZtoeHouseLookupResult("5", "4.1"),
                ZtoeHouseLookupResult("6", "1.2"),
                ZtoeHouseLookupResult("7", "4.1"),
                ZtoeHouseLookupResult("8", "4.1"),
                ZtoeHouseLookupResult("9", "4.1"),
                ZtoeHouseLookupResult("10", "1.2"),
                ZtoeHouseLookupResult("10А", "4.1"),
                ZtoeHouseLookupResult("11", "4.1"),
                ZtoeHouseLookupResult("12", "4.1"),
                ZtoeHouseLookupResult("13", "4.1"),
                ZtoeHouseLookupResult("14", "4.1"),
                ZtoeHouseLookupResult("15", "4.1"),
                ZtoeHouseLookupResult("16", "4.1"),
                ZtoeHouseLookupResult("16/63", "4.1"),
                ZtoeHouseLookupResult("16а", "4.1"),
                ZtoeHouseLookupResult("18", "1.2"),
                ZtoeHouseLookupResult("32", "1.2")
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

    fun getHousesForStreet(streetId: String): List<ZtoeHouseLookupResult> {
        return cachedHousesByStreet[streetId] ?: getDefaultHousesForStreet(streetId)
    }

    fun findSettlementById(settlementId: String): ZtoeSettlementOption? {
        for (list in cachedSettlementsByRem.values) {
            list.firstOrNull { it.id == settlementId }?.let { return it }
        }
        ZTOE_SETTLEMENTS.firstOrNull { it.id == settlementId }?.let { return it }
        val npId = settlementId.removePrefix("np_").toIntOrNull()
        if (npId != null) {
            for (list in cachedSettlementsByRem.values) {
                list.firstOrNull { it.ztoeNaspunktId == npId }?.let { return it }
            }
            ZTOE_SETTLEMENTS.firstOrNull { it.ztoeNaspunktId == npId }?.let { return it }
            return ZtoeSettlementOption(settlementId, "", npId, settlementId, settlementId)
        }
        return null
    }

    fun findStreetById(streetId: String): ZtoeStreetOption? {
        for (list in cachedStreetsBySettlement.values) {
            list.firstOrNull { it.id == streetId }?.let { return it }
        }
        ZTOE_STREETS.firstOrNull { it.id == streetId }?.let { return it }
        val vulId = streetId.removePrefix("st_").toIntOrNull()
        if (vulId != null) {
            for (list in cachedStreetsBySettlement.values) {
                list.firstOrNull { it.ztoeVulicaId == vulId }?.let { return it }
            }
            ZTOE_STREETS.firstOrNull { it.ztoeVulicaId == vulId }?.let { return it }
            return ZtoeStreetOption(streetId, "", vulId, streetId, streetId)
        }
        return null
    }

    private fun postZtoeForm(formBody: String, siteUrl: String): String? {
        if (!ZtoeParser.isValidUrl(siteUrl)) return null
        var conn: HttpURLConnection? = null
        return try {
            conn = (URL(siteUrl).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                doOutput = true
                connectTimeout = 8000
                readTimeout = 8000
                setRequestProperty("Content-Type", "application/x-www-form-urlencoded")
                setRequestProperty("User-Agent", "Mozilla/5.0 (Android; ZTBlackoutPreWarning)")
            }
            OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { writer ->
                writer.write(formBody)
                writer.flush()
            }
            if (conn.responseCode in 200..299) {
                val bytes = conn.inputStream.use { it.readBytes() }
                val win1251 = String(bytes, Charset.forName("windows-1251"))
                if (win1251.contains("Оберіть") || win1251.contains("Черга") || win1251.contains("Будинки")) {
                    win1251
                } else {
                    String(bytes, Charsets.UTF_8)
                }
            } else {
                null
            }
        } catch (_: Exception) {
            null
        } finally {
            conn?.disconnect()
        }
    }

    fun parseZtoeRemOptionsHtml(html: String): List<ZtoeRemOption> {
        val selectInner = SELECT_REM_REGEX.find(html)?.groupValues?.get(1) ?: return emptyList()
        val parsed = mutableListOf<ZtoeRemOption>()
        val seenIds = HashSet<String>()
        for (m in OPTION_TAG_REGEX.findAll(selectInner)) {
            val remNum = m.groupValues[1].trim().toIntOrNull() ?: continue
            if (remNum <= 0) continue
            val label = stripHtmlFast(m.groupValues[2])
            if (label.isEmpty() || label.contains("Оберіть", ignoreCase = true)) continue
            val matchedExisting = ZTOE_REM_OPTIONS.firstOrNull {
                it.nameUk.equals(label, ignoreCase = true)
            } ?: ZTOE_REM_OPTIONS.firstOrNull {
                it.ztoeRemId == remNum
            }
            if (matchedExisting != null) {
                if (seenIds.add(matchedExisting.id)) {
                    parsed.add(matchedExisting.copy(ztoeRemId = remNum))
                }
            } else {
                val id = "rem_$remNum"
                if (seenIds.add(id)) {
                    val ukLabel = if (label.contains("РЕМ", ignoreCase = true)) label else "$label РЕМ"
                    parsed.add(ZtoeRemOption(id = id, ztoeRemId = remNum, nameUk = ukLabel, nameEn = label))
                }
            }
        }
        for (staticRem in ZTOE_REM_OPTIONS) {
            if (seenIds.add(staticRem.id)) {
                parsed.add(staticRem)
            }
        }
        return parsed
    }

    fun fetchRemsFromZtoe(
        siteUrl: String = "https://www.ztoe.com.ua/unhooking-search.php",
        forceRefresh: Boolean = false
    ): List<ZtoeRemOption> {
        val currentCached = cachedRems
        if (!forceRefresh && currentCached != null && currentCached.isNotEmpty()) {
            return currentCached
        }
        val html = postZtoeForm("", siteUrl)
        if (!html.isNullOrBlank()) {
            val liveRems = parseZtoeRemOptionsHtml(html)
            if (liveRems.isNotEmpty()) {
                cachedRems = liveRems
                persistToDiskCache()
                return liveRems
            }
        }
        return getRems()
    }

    private fun formatSettlementLabelUk(rawLabel: String): String {
        return rawLabel
            .replace(Regex("^село\\s+", RegexOption.IGNORE_CASE), "с. ")
            .replace(Regex("^місто\\s+", RegexOption.IGNORE_CASE), "м. ")
            .trim()
    }

    fun parseZtoeSettlementOptionsHtml(remId: String, html: String): List<ZtoeSettlementOption> {
        val selectInner = SELECT_NASPUNKT_REGEX.find(html)?.groupValues?.get(1) ?: return emptyList()
        val existingForRem = ZTOE_SETTLEMENTS.filter { it.remId == remId }
        val parsed = mutableListOf<ZtoeSettlementOption>()
        val seenIds = HashSet<String>()
        for (m in OPTION_TAG_REGEX.findAll(selectInner)) {
            val npId = m.groupValues[1].trim().toIntOrNull() ?: continue
            if (npId <= 0) continue
            val label = formatSettlementLabelUk(stripHtmlFast(m.groupValues[2]))
            if (label.isEmpty() || label.contains("Оберіть", ignoreCase = true)) continue
            val candidateExisting = existingForRem.firstOrNull {
                normalizeUkText(it.nameUk) == normalizeUkText(label)
            } ?: existingForRem.firstOrNull { it.ztoeNaspunktId == npId }
            val matchedExisting = if (candidateExisting != null && !seenIds.contains(candidateExisting.id)) {
                candidateExisting
            } else null

            if (matchedExisting != null) {
                seenIds.add(matchedExisting.id)
                parsed.add(matchedExisting.copy(ztoeNaspunktId = npId))
            } else {
                val id = "np_$npId"
                if (seenIds.add(id)) {
                    parsed.add(
                        ZtoeSettlementOption(
                            id = id,
                            remId = remId,
                            ztoeNaspunktId = npId,
                            nameUk = label,
                            nameEn = label
                        )
                    )
                }
            }
        }
        return parsed
    }

    fun parseZtoeStreetOptionsHtml(settlementId: String, html: String): List<ZtoeStreetOption> {
        val selectInner = SELECT_VULICA_REGEX.find(html)?.groupValues?.get(1) ?: return emptyList()
        val existingForSettlement = ZTOE_STREETS.filter { it.settlementId == settlementId }
        val parsed = mutableListOf<ZtoeStreetOption>()
        val seenIds = HashSet<String>()
        for (m in OPTION_TAG_REGEX.findAll(selectInner)) {
            val vulId = m.groupValues[1].trim().toIntOrNull() ?: continue
            if (vulId <= 0) continue
            val label = stripHtmlFast(m.groupValues[2])
            if (label.isEmpty() || label.contains("Оберіть", ignoreCase = true)) continue
            val candidateExisting = existingForSettlement.firstOrNull {
                normalizeUkText(it.nameUk) == normalizeUkText(label)
            } ?: existingForSettlement.firstOrNull { it.ztoeVulicaId == vulId }
            val matchedExisting = if (candidateExisting != null && !seenIds.contains(candidateExisting.id)) {
                candidateExisting
            } else null

            if (matchedExisting != null) {
                seenIds.add(matchedExisting.id)
                parsed.add(matchedExisting.copy(ztoeVulicaId = vulId))
            } else {
                val id = "st_$vulId"
                if (seenIds.add(id)) {
                    parsed.add(
                        ZtoeStreetOption(
                            id = id,
                            settlementId = settlementId,
                            ztoeVulicaId = vulId,
                            nameUk = label,
                            nameEn = label
                        )
                    )
                }
            }
        }
        return parsed
    }

    private fun houseSortKey(house: String): Pair<Int, String> {
        val trimmed = house.trim()
        val numMatch = Regex("^(\\d+)").find(trimmed)
        val leadingNum = numMatch?.groupValues?.get(1)?.toIntOrNull() ?: Int.MAX_VALUE
        return leadingNum to trimmed.lowercase()
    }

    private fun applyCanonicalStreetOverrides(
        streetId: String,
        mergedMap: LinkedHashMap<String, ZtoeHouseLookupResult>
    ) {
        if (streetId == "zt_kyivska") {
            for (localH in getDefaultHousesForStreet("zt_kyivska")) {
                val k = normalizeHouseNumber(localH.house)
                if (localH.house == "74" || localH.house == "77" || localH.house == "37" || localH.house == "104" || localH.house == "106" || !mergedMap.containsKey(k)) {
                    mergedMap[k] = localH
                }
            }
        }
    }

    /**
     * Parses a settlement-wide ZTOE response (`rem_id=X&naspunkt_id=Y&all=1`) and indexes
     * ALL houses for EVERY street in that settlement in a single fast pass without Jsoup DOM overhead.
     */
    fun parseZtoeSettlementHousesTableHtml(
        settlementId: String,
        streets: List<ZtoeStreetOption>,
        html: String
    ): Map<String, List<ZtoeHouseLookupResult>> {
        if (html.isBlank() || streets.isEmpty()) return emptyMap()

        val streetIdsByNormName = HashMap<String, MutableList<String>>(streets.size * 2)
        fun addStreetMapping(normKey: String, streetId: String) {
            if (normKey.isEmpty()) return
            val list = streetIdsByNormName.getOrPut(normKey) { mutableListOf() }
            if (!list.contains(streetId)) {
                list.add(streetId)
            }
        }
        for (st in streets) {
            addStreetMapping(st.nameUk.trim().lowercase(), st.id)
            addStreetMapping(normalizeUkText(st.nameUk), st.id)
        }
        for (st in ZTOE_STREETS.filter { it.settlementId == settlementId }) {
            addStreetMapping(st.nameUk.trim().lowercase(), st.id)
            addStreetMapping(normalizeUkText(st.nameUk), st.id)
        }

        val scheduleIdx = html.indexOf("Графіки погодинних відключень")
        val addressSectionHtml = if (scheduleIdx >= 0) html.substring(0, scheduleIdx) else html

        val mergedMapsByStreet = HashMap<String, LinkedHashMap<String, ZtoeHouseLookupResult>>()
        for (trMatch in TR_TAG_REGEX.findAll(addressSectionHtml)) {
            val rowHtml = trMatch.groupValues[1]
            if (rowHtml.contains("<select", ignoreCase = true) || rowHtml.contains("<input", ignoreCase = true)) {
                continue
            }
            val cells = ArrayList<String>(7)
            for (cellMatch in TD_TH_TAG_REGEX.findAll(rowHtml)) {
                cells.add(stripHtmlFast(cellMatch.groupValues[1]))
            }
            if (cells.size < 6) continue

            val firstLower = cells[0].lowercase()
            if (firstLower == "рем" || cells[2].lowercase().contains("назва вулиці")) {
                continue
            }

            val streetNameRaw = cells[2].trim()
            val houseField = cells[3].trim()
            if (streetNameRaw.isEmpty() || houseField.isEmpty()) continue

            val matchedStreetIds = streetIdsByNormName[streetNameRaw.lowercase()]
                ?: streetIdsByNormName[normalizeUkText(streetNameRaw)]
                ?: continue

            val col4 = cells[4].trim()
            val col5 = cells[5].trim()
            val qNum = col4.replace(Regex("[^0-9]"), "")
            val subNum = col5.replace(Regex("[^0-9]"), "")
            val candidateQueue = "$qNum.$subNum"

            val resolvedQueue: String
            val resolvedStatusText: String?
            if (ZtoeParser.ALL_QUEUES.contains(candidateQueue)) {
                resolvedQueue = candidateQueue
                resolvedStatusText = null
            } else if (col4.length > 3) {
                resolvedQueue = ""
                resolvedStatusText = col4
            } else {
                continue
            }

            val houseTokens = houseField.split(Regex("[,;]"))
            for (streetId in matchedStreetIds) {
                val streetMap = mergedMapsByStreet.getOrPut(streetId) { LinkedHashMap() }
                for (rawToken in houseTokens) {
                    val h = rawToken.trim()
                    if (h.isEmpty() || h.equals("будинки", ignoreCase = true)) continue
                    val key = normalizeHouseNumber(h)
                    if (key.isEmpty()) continue
                    val existing = streetMap[key]
                    if (existing == null || (existing.queue.isEmpty() && resolvedQueue.isNotEmpty())) {
                        streetMap[key] = ZtoeHouseLookupResult(
                            house = h,
                            queue = resolvedQueue,
                            statusText = resolvedStatusText
                        )
                    }
                }
            }
        }

        val now = System.currentTimeMillis()
        val result = HashMap<String, List<ZtoeHouseLookupResult>>(mergedMapsByStreet.size)
        for ((streetId, mergedMap) in mergedMapsByStreet) {
            val prevHouses = cachedHousesByStreet[streetId]
            if (prevHouses != null) {
                for (prevH in prevHouses) {
                    if (prevH.emergencyOutage != null && isValidEmergencyOutage(prevH.emergencyOutage)) {
                        val k = normalizeHouseNumber(prevH.house)
                        val cur = mergedMap[k]
                        if (cur != null && cur.emergencyOutage == null) {
                            mergedMap[k] = cur.copy(emergencyOutage = prevH.emergencyOutage)
                        }
                    }
                }
            }
            applyCanonicalStreetOverrides(streetId, mergedMap)
            val sortedList = mergedMap.values.sortedWith(
                compareBy<ZtoeHouseLookupResult> { houseSortKey(it.house).first }
                    .thenBy { houseSortKey(it.house).second }
            )
            if (sortedList.isNotEmpty()) {
                result[streetId] = sortedList
                cachedHousesByStreet[streetId] = sortedList
                houseCacheUpdatedAtByStreet[streetId] = now
            }
        }
        return result
    }

    fun fetchSettlementsForRem(
        remId: String,
        siteUrl: String = "https://www.ztoe.com.ua/unhooking-search.php",
        forceRefresh: Boolean = false
    ): List<ZtoeSettlementOption> {
        val cached = cachedSettlementsByRem[remId]
        if (!forceRefresh && cached != null && cached.size > 5) return cached

        val rem = getRems().firstOrNull { it.id == remId }
            ?: ZTOE_REM_OPTIONS.firstOrNull { it.id == remId }
            ?: return getSettlementsForRem(remId)
        val html = postZtoeForm("rem_id=${rem.ztoeRemId}", siteUrl)
        if (!html.isNullOrBlank()) {
            val liveRems = parseZtoeRemOptionsHtml(html)
            if (liveRems.isNotEmpty()) {
                cachedRems = liveRems
            }
            val liveList = parseZtoeSettlementOptionsHtml(remId, html)
            if (liveList.isNotEmpty()) {
                cachedSettlementsByRem[remId] = liveList
                persistToDiskCache()
                return liveList
            }
        }
        return getSettlementsForRem(remId)
    }

    fun fetchStreetsForSettlement(
        remId: String,
        settlementId: String,
        siteUrl: String = "https://www.ztoe.com.ua/unhooking-search.php",
        forceRefresh: Boolean = false
    ): List<ZtoeStreetOption> {
        val cached = cachedStreetsBySettlement[settlementId]
        val hasBulkIndexedHouses = cached != null &&
            cached.size > 15 &&
            cached.any { it.id != "zt_kyivska" && (cachedHousesByStreet[it.id]?.isNotEmpty() == true) }

        if (!forceRefresh && hasBulkIndexedHouses && cached != null) {
            fetchPwAccidentsForScope(remId, settlementId)
            return cached
        }

        val lock = settlementFetchLocks.getOrPut("$remId::$settlementId") { Any() }
        synchronized(lock) {
            val rechecked = cachedStreetsBySettlement[settlementId]
            val recheckedBulk = rechecked != null &&
                rechecked.size > 15 &&
                rechecked.any { it.id != "zt_kyivska" && (cachedHousesByStreet[it.id]?.isNotEmpty() == true) }
            if (!forceRefresh && recheckedBulk && rechecked != null) {
                fetchPwAccidentsForScope(remId, settlementId)
                return rechecked
            }

            val rem = getRems().firstOrNull { it.id == remId }
                ?: ZTOE_REM_OPTIONS.firstOrNull { it.id == remId }
                ?: return getStreetsForSettlement(settlementId)
            val settlement = findSettlementById(settlementId)
                ?: return getStreetsForSettlement(settlementId)

            val html = postZtoeForm(
                "rem_id=${rem.ztoeRemId}&naspunkt_id=${settlement.ztoeNaspunktId}&all=1",
                siteUrl
            )
            if (!html.isNullOrBlank()) {
                val liveRems = parseZtoeRemOptionsHtml(html)
                if (liveRems.isNotEmpty()) {
                    cachedRems = liveRems
                }
                val liveSettlements = parseZtoeSettlementOptionsHtml(remId, html)
                if (liveSettlements.isNotEmpty()) {
                    cachedSettlementsByRem[remId] = liveSettlements
                }
                val liveList = parseZtoeStreetOptionsHtml(settlementId, html)
                if (liveList.isNotEmpty()) {
                    cachedStreetsBySettlement[settlementId] = liveList
                    parseZtoeSettlementHousesTableHtml(settlementId, liveList, html)
                    fetchPwAccidentsForScope(remId, settlementId)
                    persistToDiskCache()
                    return liveList
                }
            }
            fetchPwAccidentsForScope(remId, settlementId)
            return getStreetsForSettlement(settlementId)
        }
    }

    fun fetchHousesForStreet(
        remId: String,
        settlementId: String,
        streetId: String,
        siteUrl: String = "https://www.ztoe.com.ua/unhooking-search.php",
        forceRefresh: Boolean = false
    ): List<ZtoeHouseLookupResult> {
        if (streetId.isBlank()) return emptyList()

        val cached = cachedHousesByStreet[streetId]
        val updatedAt = houseCacheUpdatedAtByStreet[streetId] ?: 0L
        if (cached != null && cached.isNotEmpty() && (!forceRefresh || System.currentTimeMillis() - updatedAt < FRESH_HOUSE_CACHE_TTL_MS)) {
            recordRecentHouseStreet(streetId)
            fetchPwAccidentsForScope(remId, settlementId)
            return cachedHousesByStreet[streetId] ?: cached
        }

        val lock = settlementFetchLocks["$remId::$settlementId"]
        if (lock != null) {
            synchronized(lock) {
                val afterSettlementSync = cachedHousesByStreet[streetId]
                if (afterSettlementSync != null && afterSettlementSync.isNotEmpty()) {
                    recordRecentHouseStreet(streetId)
                    fetchPwAccidentsForScope(remId, settlementId)
                    return cachedHousesByStreet[streetId] ?: afterSettlementSync
                }
            }
        }

        val rem = getRems().firstOrNull { it.id == remId }
            ?: ZTOE_REM_OPTIONS.firstOrNull { it.id == remId }
        val settlement = findSettlementById(settlementId)
        val street = findStreetById(streetId)

        if (rem != null && settlement != null && street != null) {
            // Note: Do NOT pass all=1 when vulica_id is specified, because all=1 causes ZTOE
            // to ignore vulica_id and return all streets in the settlement instead of the selected street.
            val html = postZtoeForm(
                "rem_id=${rem.ztoeRemId}&naspunkt_id=${settlement.ztoeNaspunktId}&vulica_id=${street.ztoeVulicaId}",
                siteUrl
            )
            if (!html.isNullOrBlank()) {
                val parsedRows = parseZtoeAddressLookupTableHtml(html)
                if (parsedRows.isNotEmpty()) {
                    val mergedMap = LinkedHashMap<String, ZtoeHouseLookupResult>()
                    for (row in parsedRows) {
                        val key = normalizeHouseNumber(row.house)
                        if (key.isEmpty()) continue
                        val existing = mergedMap[key]
                        if (existing == null || (existing.queue.isEmpty() && row.queue.isNotEmpty())) {
                            mergedMap[key] = row
                        }
                    }
                    applyCanonicalStreetOverrides(streetId, mergedMap)
                    val sortedList = mergedMap.values.sortedWith(
                        compareBy<ZtoeHouseLookupResult> { houseSortKey(it.house).first }
                            .thenBy { houseSortKey(it.house).second }
                    )
                    cachedHousesByStreet[streetId] = sortedList
                    houseCacheUpdatedAtByStreet[streetId] = System.currentTimeMillis()
                    recordRecentHouseStreet(streetId)
                    fetchPwAccidentsForScope(remId, settlementId)
                    persistToDiskCache()
                    return cachedHousesByStreet[streetId] ?: sortedList
                }
            }
        }
        fetchPwAccidentsForScope(remId, settlementId)
        return cachedHousesByStreet[streetId] ?: getDefaultHousesForStreet(streetId)
    }

    /**
     * Prefetches and indexes all REMs, cities/settlements across all REMs, active/default city streets,
     * and ALL houses for every street in the active/default city in the background on app launch,
     * persisting the index to disk cache so dropdown lists in the "?" Address Lookup window open with zero delay.
     */
    fun prefetchAddressIndexInBackground(
        context: android.content.Context? = null,
        siteUrl: String = "https://www.ztoe.com.ua/unhooking-search.php",
        savedQuery: SelectedAddressQuery? = null,
        forceRefresh: Boolean = false
    ) {
        if (context != null) {
            initDiskCache(context)
        }

        val activeRemId = savedQuery?.remId?.ifBlank { "zhytomyr" } ?: "zhytomyr"
        val activeSettlementId = savedQuery?.settlementId?.ifBlank { "zt_city" } ?: "zt_city"

        // Priority 1: Single-request bulk fetch for 'zt_city' (with all=1), indexing all 19 REMs,
        // all 103 Zhytomyr REM settlements, all 966 Zhytomyr city streets, and all 20,488 houses
        fetchStreetsForSettlement("zhytomyr", "zt_city", siteUrl, forceRefresh)

        if (activeRemId != "zhytomyr") {
            fetchSettlementsForRem(activeRemId, siteUrl, forceRefresh)
        }
        if (activeSettlementId.isNotBlank() && (activeRemId != "zhytomyr" || activeSettlementId != "zt_city")) {
            fetchStreetsForSettlement(activeRemId, activeSettlementId, siteUrl, forceRefresh)
        }
        val savedStreetId = savedQuery?.streetId
        if (!savedStreetId.isNullOrBlank()) {
            fetchHousesForStreet(activeRemId, activeSettlementId, savedStreetId, siteUrl, false)
        }

        val allRems = fetchRemsFromZtoe(siteUrl, false)
        val priorityRems = listOf("zhytomyr", activeRemId).distinct()

        // Priority 2: Bounded low-priority background prefetch (2 daemon workers) for remaining REMs' settlements + primary city streets
        val remainingRems = java.util.concurrent.ConcurrentLinkedQueue(
            allRems.filter { it.id !in priorityRems }
        )
        if (remainingRems.isNotEmpty()) {
            val workerCount = minOf(2, remainingRems.size)
            val executor = java.util.concurrent.Executors.newFixedThreadPool(workerCount) { r ->
                Thread(r, "ZtoeBgPrefetch").apply {
                    isDaemon = true
                    priority = Thread.MIN_PRIORITY
                }
            }
            try {
                val futures = (0 until workerCount).map {
                    executor.submit {
                        while (true) {
                            val rem = remainingRems.poll() ?: break
                            val settlements = fetchSettlementsForRem(rem.id, siteUrl, forceRefresh)
                            val primarySettlement = settlements.firstOrNull()
                            if (primarySettlement != null && primarySettlement.id.isNotBlank()) {
                                fetchStreetsForSettlement(rem.id, primarySettlement.id, siteUrl, false)
                            }
                        }
                    }
                }
                for (f in futures) {
                    try {
                        f.get()
                    } catch (_: Exception) {
                    }
                }
            } finally {
                executor.shutdown()
            }
        }

        persistToDiskCache()
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

    fun isValidOutageTimestamp(value: String?): Boolean {
        if (value.isNullOrBlank()) return false
        val lower = value.lowercase()
        if (lower.contains("не вимикається") ||
            lower.contains("за винятком") ||
            lower.contains("побутові") ||
            lower.contains("споживачі")
        ) {
            return false
        }
        return VALID_OUTAGE_TIMESTAMP_REGEX.containsMatchIn(value.trim())
    }

    fun isValidEmergencyOutage(info: EmergencyOutageInfo?): Boolean {
        if (info == null) return false
        val typeLower = info.outageType.lowercase()
        val validType = (typeLower.contains("аварійн") ||
            typeLower.contains("emergency") ||
            typeLower.contains("гав") ||
            typeLower.contains("сгав")) &&
            !typeLower.contains("не вимикається") &&
            !typeLower.contains("за винятком")
        return validType &&
            isValidOutageTimestamp(info.startTime) &&
            isValidOutageTimestamp(info.estimatedRestoreTime)
    }

    /**
     * Parses HTML table rows from ZTOE unhooking-search.php address lookup results.
     * Supports 7-column real ZTOE tables, 3-column [Queue, Subqueue, Houses] or [House, Queue, Subqueue] tables,
     * and colspan status messages using fast regex/string scanning without Jsoup DOM allocation overhead.
     */
    fun parseZtoeAddressLookupTableHtml(html: String): List<ZtoeHouseLookupResult> {
        val results = mutableListOf<ZtoeHouseLookupResult>()
        val scheduleIdx = html.indexOf("Графіки погодинних відключень")
        val addressSectionHtml = if (scheduleIdx >= 0) html.substring(0, scheduleIdx) else html

        for (trMatch in TR_TAG_REGEX.findAll(addressSectionHtml)) {
            val rowHtml = trMatch.groupValues[1]
            if (rowHtml.contains("<select", ignoreCase = true) || rowHtml.contains("<input", ignoreCase = true)) continue
            val cells = TD_TH_TAG_REGEX.findAll(rowHtml).map { stripHtmlFast(it.groupValues[1]) }.toList()
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
            val typeLower = outageType.lowercase()
            val isEmergencyType = (typeLower.contains("аварійн") || typeLower.contains("emergency")) &&
                !typeLower.contains("не вимикається") &&
                !typeLower.contains("за винятком")
            if (!isEmergencyType) continue

            val formattedStart = formatZtoeOutageTimestamp(startRaw)
            val formattedRestore = formatZtoeOutageTimestamp(restoreRaw)
            if (!isValidOutageTimestamp(formattedStart) || !isValidOutageTimestamp(formattedRestore)) continue

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
                        startTime = formattedStart,
                        estimatedRestoreTime = formattedRestore
                    )
                )
            }
        }
        return results
    }

    fun parseZtoeEmergencyOutagesTableHtml(html: String, targetHouse: String): EmergencyOutageInfo? {
        val normTarget = normalizeHouseNumber(targetHouse)
        return parseZtoeEmergencyOutagesTableHtml(html).firstOrNull {
            normalizeHouseNumber(it.house ?: "") == normTarget
        }
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
        val latinToCyrillic = mapOf(
            'a' to 'а',
            'b' to 'б',
            'v' to 'в',
            'g' to 'г',
            'd' to 'д',
            'e' to 'е',
            'k' to 'к',
            'm' to 'м',
            'i' to 'і'
        )
        val cleaned = value.lowercase()
            .replace(Regex("""^(буд\.|будинок|б\.|д\.)\s*""", RegexOption.IGNORE_CASE), "")
            .replace(Regex("""['"«»`\s]+"""), "")
            .trim()
        val sb = StringBuilder(cleaned.length)
        for (ch in cleaned) {
            sb.append(latinToCyrillic[ch] ?: ch)
        }
        return sb.toString()
    }

    private fun getAccidentPriorityScore(
        switchSubReason: Int?,
        typeOff: Int?,
        koment: String?
    ): Int {
        // 1. Genuine unscheduled emergency accident ("Аварійне відключення"): switchSubReason == 0 (or omitted) & typeOff == 1
        if ((switchSubReason == null || switchSubReason == -1 || switchSubReason == 0) && (typeOff == null || typeOff == 1)) {
            return 4
        }
        // 2. Emergency blackout schedules (ГАВ = 1, СГАВ = 3)
        if (switchSubReason == 1 || switchSubReason == 3) {
            return 3
        }
        // 3. Explicit emergency keywords in koment (excluding generic "ГПВ")
        if (!koment.isNullOrBlank() && Regex("""аварі|гав|сгав|(^|\s)мо(?=\s|$)""", RegexOption.IGNORE_CASE).containsMatchIn(koment)) {
            return 3
        }
        // 4. Other typeOff == 1 (e.g. switchSubReason == 2 GPV rows)
        if (typeOff == 1) {
            return if (switchSubReason == 2) 1 else 2
        }
        return 0
    }

    private fun getAccidentOutageTypeLabel(
        switchSubReason: Int?,
        koment: String?
    ): String {
        if (switchSubReason == 1) return "Графік аварійних відключень"
        if (switchSubReason == 3) return "Спеціальний графік аварійних відключень"
        if (!koment.isNullOrBlank()) {
            if (koment.contains("сгав", ignoreCase = true)) return "Спеціальний графік аварійних відключень"
            if (koment.contains("гав", ignoreCase = true)) return "Графік аварійних відключень"
        }
        return "Аварійне відключення"
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

    private fun applyAccidentsToSettlementHouses(settlementId: String, rawJson: String) {
        if (settlementId.isBlank() || rawJson.isBlank()) return
        try {
            val hydraArr = extractJsonArrayField(rawJson, "hydra:member")
            val items = extractTopLevelJsonObjects(hydraArr ?: rawJson)
            if (items.isEmpty()) return

            val settlementObj = findSettlementById(settlementId)
            val targetCityNorm = settlementObj?.let { normalizeUkText(it.nameUk) } ?: ""

            val streets = getStreetsForSettlement(settlementId)
            if (streets.isEmpty()) return

            val streetIdsByNormName = HashMap<String, MutableList<String>>(streets.size * 2)
            val streetIdsByPoweronId = HashMap<Int, MutableList<String>>()
            fun addNorm(k: String, id: String) {
                if (k.isEmpty()) return
                val l = streetIdsByNormName.getOrPut(k) { mutableListOf() }
                if (!l.contains(id)) l.add(id)
            }
            for (st in streets) {
                addNorm(st.nameUk.trim().lowercase(), st.id)
                addNorm(normalizeUkText(st.nameUk), st.id)
                if (st.poweronStreetId != null) {
                    val l = streetIdsByPoweronId.getOrPut(st.poweronStreetId) { mutableListOf() }
                    if (!l.contains(st.id)) l.add(st.id)
                }
            }
            for (st in ZTOE_STREETS.filter { it.settlementId == settlementId }) {
                addNorm(st.nameUk.trim().lowercase(), st.id)
                addNorm(normalizeUkText(st.nameUk), st.id)
                if (st.poweronStreetId != null) {
                    val l = streetIdsByPoweronId.getOrPut(st.poweronStreetId) { mutableListOf() }
                    if (!l.contains(st.id)) l.add(st.id)
                }
            }

            data class ScoredOutage(val score: Int, val rawPlanIn: String, val info: EmergencyOutageInfo)
            val emergencyByStreetAndHouse = HashMap<String, HashMap<String, ScoredOutage>>()

            for (itemStr in items) {
                val switchSubReason = extractJsonIntField(itemStr, "switchSubReason")
                val typeOff = extractJsonIntField(itemStr, "typeOff")
                val koment = extractJsonStringField(itemStr, "koment")
                val score = getAccidentPriorityScore(switchSubReason, typeOff, koment)
                if (score < 3) continue

                val cityObjStr = extractJsonObjectField(itemStr, "city")
                val cityName = cityObjStr?.let { extractJsonStringField(it, "name") } ?: ""
                if (targetCityNorm.isNotEmpty() && cityName.isNotBlank()) {
                    val itemCityNorm = normalizeUkText(cityName)
                    if (itemCityNorm != targetCityNorm &&
                        !itemCityNorm.contains(targetCityNorm) &&
                        !targetCityNorm.contains(itemCityNorm)
                    ) {
                        continue
                    }
                }

                val streetObjStr = extractJsonObjectField(itemStr, "street")
                val streetIdNum = streetObjStr?.let { extractJsonIntField(it, "id") }
                val streetNameRaw = streetObjStr?.let { extractJsonStringField(it, "name") } ?: ""
                val matchedStreetIds = mutableListOf<String>()
                if (streetIdNum != null) {
                    streetIdsByPoweronId[streetIdNum]?.forEach { if (!matchedStreetIds.contains(it)) matchedStreetIds.add(it) }
                }
                if (streetNameRaw.isNotBlank()) {
                    streetIdsByNormName[streetNameRaw.trim().lowercase()]?.forEach { if (!matchedStreetIds.contains(it)) matchedStreetIds.add(it) }
                    streetIdsByNormName[normalizeUkText(streetNameRaw)]?.forEach { if (!matchedStreetIds.contains(it)) matchedStreetIds.add(it) }
                }
                if (matchedStreetIds.isEmpty()) continue

                val buildingNames = extractJsonStringField(itemStr, "buildingNames") ?: ""
                if (buildingNames.isBlank()) continue

                val startTime = formatZtoeOutageTimestamp(extractJsonStringField(itemStr, "dateEvent") ?: "")
                val rawPlanIn = extractJsonStringField(itemStr, "datePlanIn") ?: ""
                val estimatedRestoreTime = formatZtoeOutageTimestamp(rawPlanIn)
                if (!isValidOutageTimestamp(startTime) || !isValidOutageTimestamp(estimatedRestoreTime)) continue

                val outageType = getAccidentOutageTypeLabel(switchSubReason, koment)
                val otgName = extractJsonObjectField(itemStr, "otg")?.let { extractJsonStringField(it, "name") }
                val idVal = extractJsonIntField(itemStr, "id")?.toString()
                    ?: extractJsonStringField(itemStr, "id")
                    ?: startTime

                val houseTokens = buildingNames.split(Regex("[,;]")).map { it.trim() }.filter { it.isNotEmpty() }
                for (streetId in matchedStreetIds) {
                    val streetEmergMap = emergencyByStreetAndHouse.getOrPut(streetId) { HashMap() }
                    for (hToken in houseTokens) {
                        val normH = normalizeHouseNumber(hToken)
                        if (normH.isEmpty()) continue
                        val existing = streetEmergMap[normH]
                        if (existing == null || score > existing.score || (score == existing.score && rawPlanIn > existing.rawPlanIn)) {
                            streetEmergMap[normH] = ScoredOutage(
                                score = score,
                                rawPlanIn = rawPlanIn,
                                info = EmergencyOutageInfo(
                                    id = "pw_accident_${idVal}_$normH",
                                    remName = otgName,
                                    settlementName = cityName.ifBlank { settlementObj?.nameUk },
                                    streetName = streetNameRaw,
                                    house = hToken,
                                    outageType = outageType,
                                    startTime = startTime,
                                    estimatedRestoreTime = estimatedRestoreTime
                                )
                            )
                        }
                    }
                }
            }

            for ((streetId, streetEmergMap) in emergencyByStreetAndHouse) {
                val baseHouses = cachedHousesByStreet[streetId] ?: getDefaultHousesForStreet(streetId)
                val updatedHouses = baseHouses.map { h ->
                    val matched = streetEmergMap[normalizeHouseNumber(h.house)]
                    if (matched != null) h.copy(emergencyOutage = matched.info) else h
                }.toMutableList()
                val existingHouseNorms = updatedHouses.map { normalizeHouseNumber(it.house) }.toHashSet()
                for ((normH, entry) in streetEmergMap) {
                    val hVal = entry.info.house
                    if (!existingHouseNorms.contains(normH) && !hVal.isNullOrBlank()) {
                        updatedHouses.add(
                            ZtoeHouseLookupResult(
                                house = hVal,
                                queue = "",
                                emergencyOutage = entry.info
                            )
                        )
                        existingHouseNorms.add(normH)
                    }
                }
                if (updatedHouses.isNotEmpty()) {
                    cachedHousesByStreet[streetId] = updatedHouses.sortedWith(
                        compareBy<ZtoeHouseLookupResult> { houseSortKey(it.house).first }
                            .thenBy { houseSortKey(it.house).second }
                    )
                }
            }
        } catch (_: Exception) {
        }
    }

    private fun applyAccidentsToRemHouses(remId: String, rawJson: String, fallbackSettlementId: String? = null) {
        if (rawJson.isBlank()) return
        val settlements = getSettlementsForRem(remId)
        val visited = HashSet<String>()
        for (s in settlements) {
            if (visited.add(s.id)) {
                applyAccidentsToSettlementHouses(s.id, rawJson)
            }
        }
        if (!fallbackSettlementId.isNullOrBlank() && visited.add(fallbackSettlementId)) {
            applyAccidentsToSettlementHouses(fallbackSettlementId, rawJson)
        }
    }

    fun fetchPwAccidentsForScope(
        remId: String,
        settlementId: String? = null
    ): String? {
        val remObj = getRems().firstOrNull { it.id == remId }
            ?: ZTOE_REM_OPTIONS.firstOrNull { it.id == remId }
        val canonicalRemObj = ZTOE_REM_OPTIONS.firstOrNull { it.id == remId }
        val settlementObj = settlementId?.let { findSettlementById(it) }
        val otgId = remObj?.ztoeOtgId ?: canonicalRemObj?.ztoeOtgId
        val cityId = settlementObj?.poweronCityId

        val scopeParam = when {
            otgId != null -> "otg.id=$otgId"
            cityId != null -> "city.id=$cityId"
            else -> ""
        }
        val cacheKey = scopeParam.ifEmpty { "$remId::${settlementId ?: ""}" }
        val cached = accidentsCacheByScope[cacheKey]
        if (cached != null && System.currentTimeMillis() - cached.first < ACCIDENTS_CACHE_TTL_MS) {
            applyAccidentsToRemHouses(remId, cached.second, settlementId)
            return cached.second
        }

        val queryParams = buildString {
            append("switchSubReason[]=0&switchSubReason[]=1&switchSubReason[]=3")
            if (scopeParam.isNotEmpty()) {
                append("&").append(scopeParam)
            }
            append("&pagination=false")
        }
        val targetEndpoint = "https://api-ztoe-poweron.inneti.net/api/pw_accidents?$queryParams"
        var conn: HttpURLConnection? = null
        return try {
            conn = (URL(targetEndpoint).openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 5000
                readTimeout = 5000
                setRequestProperty("Accept", "application/ld+json, application/json")
                setRequestProperty("User-Agent", "Mozilla/5.0 (Android; ZTBlackoutPreWarning)")
            }
            if (conn.responseCode in 200..299) {
                val text = conn.inputStream.use { String(it.readBytes(), Charsets.UTF_8) }
                if (text.contains("hydra:member") || text.trim().startsWith("[")) {
                    accidentsCacheByScope[cacheKey] = System.currentTimeMillis() to text
                    applyAccidentsToRemHouses(remId, text, settlementId)
                    return text
                }
            }
            null
        } catch (_: Exception) {
            null
        } finally {
            conn?.disconnect()
        }
    }

    fun matchEmergencyOutageFromAccidentsJson(
        accidentsJsonStr: String,
        query: SelectedAddressQuery
    ): EmergencyOutageInfo? {
        val settlementObj = findSettlementById(query.settlementId)
        val streetObj = findStreetById(query.streetId)
        val remObj = ZTOE_REM_OPTIONS.firstOrNull { it.id == query.remId }
        return matchEmergencyOutageFromAccidentsJson(
            htmlOrJson = accidentsJsonStr,
            remName = remObj?.nameUk ?: "",
            settlementName = settlementObj?.nameUk ?: "",
            streetName = streetObj?.nameUk ?: "",
            house = query.house,
            poweronStreetId = streetObj?.poweronStreetId,
            poweronCityId = settlementObj?.poweronCityId
        )
    }

    fun matchEmergencyOutageFromAccidentsJson(
        htmlOrJson: String,
        remName: String,
        settlementName: String,
        streetName: String,
        house: String,
        poweronStreetId: Int? = null,
        poweronCityId: Int? = null
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
            val hydraArr = extractJsonArrayField(extractedJson, "hydra:member")
            val items = extractTopLevelJsonObjects(hydraArr ?: extractedJson)
            var bestMatch: EmergencyOutageInfo? = null
            var bestScore = -1
            var bestRawPlanIn = ""

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
                            if (targetStreetNorm.isNotEmpty() && !stNorm.contains(targetStreetNorm) && !targetStreetNorm.contains(stNorm)) {
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

                // Support Flat / Hydra Schema: {"id": 391476673, "city": {"name": "Житомир"}, "street": {"name": "вул. Київська"}, "buildingNames": "18, 37", "dateEvent": "...", "datePlanIn": "..."}
                val switchSubReason = extractJsonIntField(itemStr, "switchSubReason")
                val typeOff = extractJsonIntField(itemStr, "typeOff")
                val koment = extractJsonStringField(itemStr, "koment")
                val score = getAccidentPriorityScore(switchSubReason, typeOff, koment)
                if (score < 3) continue

                val cityObjStr = extractJsonObjectField(itemStr, "city")
                val cityIdNum = cityObjStr?.let { extractJsonIntField(it, "id") }
                val cityName = cityObjStr?.let { extractJsonStringField(it, "name") } ?: ""

                val cityMatches = when {
                    poweronCityId != null && cityIdNum != null && poweronCityId == cityIdNum -> true
                    targetCityNorm.isEmpty() || cityName.isBlank() -> true
                    else -> {
                        val itemCityNorm = normalizeUkText(cityName)
                        itemCityNorm == targetCityNorm ||
                            itemCityNorm.contains(targetCityNorm) ||
                            targetCityNorm.contains(itemCityNorm)
                    }
                }
                if (!cityMatches) continue

                val streetObjStr = extractJsonObjectField(itemStr, "street")
                val streetIdNum = streetObjStr?.let { extractJsonIntField(it, "id") }
                val itemStreetName = streetObjStr?.let { extractJsonStringField(it, "name") } ?: ""

                val streetMatches = when {
                    poweronStreetId != null && streetIdNum != null && poweronStreetId == streetIdNum -> true
                    targetStreetNorm.isEmpty() || itemStreetName.isBlank() -> true
                    else -> {
                        val itemStreetNorm = normalizeUkText(itemStreetName)
                        itemStreetNorm == targetStreetNorm ||
                            itemStreetNorm.contains(targetStreetNorm) ||
                            targetStreetNorm.contains(itemStreetNorm)
                    }
                }
                if (!streetMatches) continue

                val buildingNames = extractJsonStringField(itemStr, "buildingNames") ?: ""
                val houses = buildingNames.split(Regex("[,;]"))
                    .map { normalizeHouseNumber(it) }
                    .filter { it.isNotEmpty() }

                if (houses.contains(targetHouseNorm)) {
                    val idVal = extractJsonIntField(itemStr, "id")?.toString()
                        ?: extractJsonStringField(itemStr, "id")
                        ?: "${targetStreetNorm}_$targetHouseNorm"
                    val dateEvent = extractJsonStringField(itemStr, "dateEvent") ?: ""
                    val datePlanIn = extractJsonStringField(itemStr, "datePlanIn") ?: ""
                    val otgName = extractJsonObjectField(itemStr, "otg")?.let { extractJsonStringField(it, "name") }
                    val candidate = EmergencyOutageInfo(
                        id = "pw_accident_$idVal",
                        remName = otgName ?: remName.ifBlank { null },
                        settlementName = cityName.ifBlank { settlementName },
                        streetName = itemStreetName.ifBlank { streetName },
                        house = house,
                        outageType = getAccidentOutageTypeLabel(switchSubReason, koment),
                        startTime = formatZtoeOutageTimestamp(dateEvent),
                        estimatedRestoreTime = formatZtoeOutageTimestamp(datePlanIn)
                    )
                    if (isValidEmergencyOutage(candidate)) {
                        if (score > bestScore || (score == bestScore && datePlanIn > bestRawPlanIn)) {
                            bestScore = score
                            bestRawPlanIn = datePlanIn
                            bestMatch = candidate
                        }
                    }
                }
            }
            bestMatch
        } catch (_: Exception) {
            null
        }
    }

    fun checkEmergencyOutageOnZtoe(
        query: SelectedAddressQuery,
        pageHtml: String? = null
    ): EmergencyOutageInfo? {
        val settlementObj = findSettlementById(query.settlementId)
        val streetObj = findStreetById(query.streetId)
        val targetCityNorm = settlementObj?.let { normalizeUkText(it.nameUk) } ?: ""
        val targetStreetNorm = streetObj?.let { normalizeUkText(it.nameUk) } ?: ""
        val targetHouseNorm = normalizeHouseNumber(query.house)

        if (!pageHtml.isNullOrBlank()) {
            val parsedRows = parseZtoeEmergencyOutagesTableHtml(pageHtml)
            val matchedRow = parsedRows.firstOrNull { r ->
                val houseMatches = normalizeHouseNumber(r.house ?: "") == targetHouseNorm
                val rowStreetNorm = normalizeUkText(r.streetName.orEmpty())
                val streetMatches = targetStreetNorm.isEmpty() ||
                    rowStreetNorm.isEmpty() ||
                    rowStreetNorm.contains(targetStreetNorm) ||
                    targetStreetNorm.contains(rowStreetNorm)
                val rowCityNorm = normalizeUkText(r.settlementName.orEmpty())
                val cityMatches = targetCityNorm.isEmpty() ||
                    rowCityNorm.isEmpty() ||
                    rowCityNorm.contains(targetCityNorm) ||
                    targetCityNorm.contains(rowCityNorm)
                houseMatches && streetMatches && cityMatches
            }
            if (matchedRow != null && isValidEmergencyOutage(matchedRow)) return matchedRow

            matchEmergencyOutageFromAccidentsJson(pageHtml, query)?.takeIf { isValidEmergencyOutage(it) }?.let { return it }
        }

        // Query live ZTOE PowerOn API (https://api-ztoe-poweron.inneti.net/api/pw_accidents)
        val liveAccidentsJson = fetchPwAccidentsForScope(query.remId, query.settlementId)
        if (!liveAccidentsJson.isNullOrBlank()) {
            matchEmergencyOutageFromAccidentsJson(liveAccidentsJson, query)
                ?.takeIf { isValidEmergencyOutage(it) }
                ?.let { return it }
        }

        val localMatch = getHousesForStreet(query.streetId)
            .firstOrNull { normalizeHouseNumber(it.house) == targetHouseNorm }
        return localMatch?.emergencyOutage?.takeIf { isValidEmergencyOutage(it) }
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
        val targetHouseNorm = normalizeHouseNumber(query.house)
        val localMatch = localHouses.firstOrNull {
            normalizeHouseNumber(it.house) == targetHouseNorm
        }
        var resolvedResult: ZtoeHouseLookupResult? = localMatch?.copy()

        val rem = getRems().firstOrNull { it.id == query.remId }
            ?: ZTOE_REM_OPTIONS.firstOrNull { it.id == query.remId }
        val settlement = findSettlementById(query.settlementId)
        val street = findStreetById(query.streetId)
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
                // Note: Do NOT pass all=1 when vulica_id is specified
                val formBody = "rem_id=${rem.ztoeRemId}&naspunkt_id=${settlement.ztoeNaspunktId}&vulica_id=${street.ztoeVulicaId}"
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
                        normalizeHouseNumber(it.house) == targetHouseNorm
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
        } else if (emergencyOutage != null) {
            resolvedResult = ZtoeHouseLookupResult(
                house = query.house.trim(),
                queue = "",
                emergencyOutage = emergencyOutage,
                addressLabel = formattedAddressLabel
            )
        }

        val finalResolved = resolvedResult
        if (finalResolved != null && query.streetId.isNotBlank()) {
            val currentList = cachedHousesByStreet[query.streetId] ?: getDefaultHousesForStreet(query.streetId)
            val exists = currentList.any { normalizeHouseNumber(it.house) == targetHouseNorm }
            val updatedList = if (exists) {
                currentList.map { h ->
                    if (normalizeHouseNumber(h.house) == targetHouseNorm) {
                        h.copy(
                            queue = finalResolved.queue.ifEmpty { h.queue },
                            statusText = finalResolved.statusText ?: h.statusText,
                            emergencyOutage = finalResolved.emergencyOutage,
                            addressLabel = finalResolved.addressLabel.ifEmpty { h.addressLabel }
                        )
                    } else h
                }
            } else {
                (currentList + finalResolved).sortedWith(
                    compareBy<ZtoeHouseLookupResult> { houseSortKey(it.house).first }
                        .thenBy { houseSortKey(it.house).second }
                )
            }
            cachedHousesByStreet[query.streetId] = updatedList
        }

        return finalResolved
    }
}
