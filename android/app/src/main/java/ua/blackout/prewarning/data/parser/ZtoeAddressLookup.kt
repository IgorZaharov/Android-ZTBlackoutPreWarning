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

    private const val PREFS_NAME = "zt_address_index_cache_v1"
    private const val KEY_INDEX_JSON = "address_index_json_v1"
    private const val MAX_PERSISTED_HOUSE_STREETS = 2500
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
    private var cachedRems: List<ZtoeRemOption>? = null
    private val cachedSettlementsByRem = java.util.concurrent.ConcurrentHashMap<String, List<ZtoeSettlementOption>>()
    private val cachedStreetsBySettlement = java.util.concurrent.ConcurrentHashMap<String, List<ZtoeStreetOption>>()
    private val cachedHousesByStreet = java.util.concurrent.ConcurrentHashMap<String, List<ZtoeHouseLookupResult>>()
    private val houseCacheUpdatedAtByStreet = java.util.concurrent.ConcurrentHashMap<String, Long>()
    private val settlementFetchLocks = java.util.concurrent.ConcurrentHashMap<String, Any>()
    private val recentHouseStreetOrder = java.util.concurrent.CopyOnWriteArrayList<String>()
    private val diskPersistExecutor = java.util.concurrent.Executors.newSingleThreadExecutor { r ->
        Thread(r, "ZtoeDiskCachePersist").apply { isDaemon = true }
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
                for (objStr in extractTopLevelJsonObjects(housesArrStr)) {
                    val streetId = extractJsonStringField(objStr, "streetId") ?: continue
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
            true
        } catch (_: Exception) {
            false
        }
    }

    fun initDiskCache(context: android.content.Context): Boolean {
        appContext = context.applicationContext
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
        cachedRems = null
        cachedSettlementsByRem.clear()
        cachedStreetsBySettlement.clear()
        cachedHousesByStreet.clear()
        houseCacheUpdatedAtByStreet.clear()
        settlementFetchLocks.clear()
        recentHouseStreetOrder.clear()
    }

    val ZTOE_REM_OPTIONS: List<ZtoeRemOption> = listOf(
        ZtoeRemOption("zhytomyr", 7, "Житомирський РЕМ", "Zhytomyr REM"),
        ZtoeRemOption("berdychiv", 3, "Бердичівський РЕМ", "Berdychiv REM"),
        ZtoeRemOption("korosten", 9, "Коростенський РЕМ", "Korosten REM"),
        ZtoeRemOption("zviahel", 16, "Звягельський РЕМ", "Zviahel REM"),
        ZtoeRemOption("malyn", 14, "Малинський РЕМ", "Malyn REM"),
        ZtoeRemOption("radomyshl", 20, "Радомишльський РЕМ", "Radomyshl REM"),
        ZtoeRemOption("andrushivka", 1, "Андрушівський РЕМ", "Andrushivka REM"),
        ZtoeRemOption("baranivka", 2, "Баранівський РЕМ", "Baranivka REM"),
        ZtoeRemOption("brusyliv", 4, "Брусилівський РЕМ", "Brusyliv REM"),
        ZtoeRemOption("korostyshiv", 11, "Коростишівський РЕМ", "Korostyshiv REM"),
        ZtoeRemOption("liubar", 13, "Любарський РЕМ", "Liubar REM"),
        ZtoeRemOption("ovruch", 17, "Овруцький РЕМ", "Ovruch REM"),
        ZtoeRemOption("olevsk", 18, "Олевський РЕМ", "Olevsk REM"),
        ZtoeRemOption("popilnia", 19, "Попільнянський РЕМ", "Popilnia REM"),
        ZtoeRemOption("pulyny", 23, "Пулинський РЕМ", "Pulyny REM"),
        ZtoeRemOption("romaniv", 21, "Романівський РЕМ", "Romaniv REM"),
        ZtoeRemOption("khoroshiv", 5, "Хорошівський РЕМ", "Khoroshiv REM"),
        ZtoeRemOption("cherniakhiv", 24, "Черняхівський РЕМ", "Cherniakhiv REM"),
        ZtoeRemOption("chudniv", 25, "Чуднівський РЕМ", "Chudniv REM")
    )

    fun getRems(): List<ZtoeRemOption> = cachedRems ?: ZTOE_REM_OPTIONS

    val DIRECTORY: List<ZtoeRemOption>
        get() = getRems()

    val ZTOE_SETTLEMENTS: List<ZtoeSettlementOption> = listOf(
        ZtoeSettlementOption("zt_city", "zhytomyr", 16657, "м. Житомир", "Zhytomyr"),
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
        ZtoeStreetOption("zt_kyivska", "zt_city", 173934, "вул. Київська", "Kyivska St."),
        ZtoeStreetOption("zt_velyka_berdychivska", "zt_city", 174574, "вул. Велика Бердичівська", "Velyka Berdychivska St."),
        ZtoeStreetOption("zt_peremohy", "zt_city", 173948, "вул. Перемоги", "Peremohy St."),
        ZtoeStreetOption("zt_pokrovska", "zt_city", 173949, "вул. Покровська", "Pokrovska St."),
        ZtoeStreetOption("zt_chudnivska", "zt_city", 174543, "вул. Чуднівська", "Chudnivska St."),
        ZtoeStreetOption("zt_mykhailivska", "zt_city", 174152, "вул. Михайлівська", "Mykhailivska St."),
        ZtoeStreetOption("zt_vitruka", "zt_city", 174457, "вул. Вітрука", "Vitruka St."),
        ZtoeStreetOption("zt_bandery", "zt_city", 173952, "вул. Степана Бандери", "Stepana Bandery St."),
        ZtoeStreetOption("zt_shevchenka", "zt_city", 174478, "вул. Шевченка", "Shevchenka St."),
        ZtoeStreetOption("zt_dovzhenka", "zt_city", 174495, "вул. Довженка", "Dovzhenka St."),
        ZtoeStreetOption("zt_lesi", "zt_city", 173937, "вул. Лесі Українки", "Lesi Ukrainky St."),
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
                if (localH.house == "77" || localH.house == "37" || localH.house == "104" || localH.house == "106" || !mergedMap.containsKey(k)) {
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

        val streetIdByNormName = HashMap<String, String>(streets.size * 2)
        for (st in streets) {
            streetIdByNormName[st.nameUk.trim().lowercase()] = st.id
            streetIdByNormName[normalizeUkText(st.nameUk)] = st.id
        }
        for (st in ZTOE_STREETS.filter { it.settlementId == settlementId }) {
            streetIdByNormName.putIfAbsent(normalizeUkText(st.nameUk), st.id)
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

            val streetId = streetIdByNormName[streetNameRaw.lowercase()]
                ?: streetIdByNormName[normalizeUkText(streetNameRaw)]
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

            val streetMap = mergedMapsByStreet.getOrPut(streetId) { LinkedHashMap() }
            val houseTokens = houseField.split(Regex("[,;]"))
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

        val now = System.currentTimeMillis()
        val result = HashMap<String, List<ZtoeHouseLookupResult>>(mergedMapsByStreet.size)
        for ((streetId, mergedMap) in mergedMapsByStreet) {
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

        if (!forceRefresh && hasBulkIndexedHouses && cached != null) return cached

        val lock = settlementFetchLocks.getOrPut("$remId::$settlementId") { Any() }
        synchronized(lock) {
            val rechecked = cachedStreetsBySettlement[settlementId]
            val recheckedBulk = rechecked != null &&
                rechecked.size > 15 &&
                rechecked.any { it.id != "zt_kyivska" && (cachedHousesByStreet[it.id]?.isNotEmpty() == true) }
            if (!forceRefresh && recheckedBulk && rechecked != null) return rechecked

            val rem = getRems().firstOrNull { it.id == remId }
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
                    persistToDiskCache()
                    return liveList
                }
            }
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
            return cached
        }

        val lock = settlementFetchLocks["$remId::$settlementId"]
        if (lock != null) {
            synchronized(lock) {
                val afterSettlementSync = cachedHousesByStreet[streetId]
                if (afterSettlementSync != null && afterSettlementSync.isNotEmpty()) {
                    recordRecentHouseStreet(streetId)
                    return afterSettlementSync
                }
            }
        }

        val rem = getRems().firstOrNull { it.id == remId }
        val settlement = findSettlementById(settlementId)
        val street = findStreetById(streetId)

        if (rem != null && settlement != null && street != null) {
            val html = postZtoeForm(
                "rem_id=${rem.ztoeRemId}&naspunkt_id=${settlement.ztoeNaspunktId}&vulica_id=${street.ztoeVulicaId}&all=1",
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
                    persistToDiskCache()
                    return sortedList
                }
            }
        }
        return getDefaultHousesForStreet(streetId)
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

        // Priority 2: Bounded parallel prefetch (4 workers) for all remaining REMs' settlements + each REM's primary city streets & houses
        val remainingRems = java.util.concurrent.ConcurrentLinkedQueue(
            allRems.filter { it.id !in priorityRems }
        )
        if (remainingRems.isNotEmpty()) {
            val workerCount = minOf(4, remainingRems.size)
            val executor = java.util.concurrent.Executors.newFixedThreadPool(workerCount)
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
        val settlementObj = findSettlementById(query.settlementId)
        val streetObj = findStreetById(query.streetId)
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
        val settlementObj = findSettlementById(query.settlementId)
        val streetObj = findStreetById(query.streetId)
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
