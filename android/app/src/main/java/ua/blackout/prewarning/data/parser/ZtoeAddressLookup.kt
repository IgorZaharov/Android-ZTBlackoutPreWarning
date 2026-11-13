package ua.blackout.prewarning.data.parser

import org.json.JSONArray
import org.json.JSONObject
import ua.blackout.prewarning.core.HouseKey
import ua.blackout.prewarning.core.StreetKey
import ua.blackout.prewarning.core.TextNorm
import ua.blackout.prewarning.data.model.EmergencyOutageInfo
import ua.blackout.prewarning.data.model.SelectedAddressQuery
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.nio.CharBuffer
import java.nio.charset.Charset
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

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

/**
 * One street of one settlement. ztoe and PowerOn list the same street under several ids (apostrophe,
 * case or spacing differences), so an option holds every id that [StreetKey] puts into one group:
 * [allIds] (option ids), [ztoeVulicaIds] and [poweronStreetIds]. [id], [ztoeVulicaId] and
 * [poweronStreetId] are the canonical ones.
 */
data class ZtoeStreetOption(
    val id: String,
    val settlementId: String,
    val ztoeVulicaId: Int,
    val nameUk: String,
    val nameEn: String,
    val poweronStreetId: Int? = null,
    val allIds: List<String> = listOf(id),
    val ztoeVulicaIds: List<Int> = listOf(ztoeVulicaId),
    val poweronStreetIds: List<Int> = listOfNotNull(poweronStreetId)
) {
    val houses: List<ZtoeHouseLookupResult>
        get() = ZtoeAddressLookup.getHousesForStreet(id)
}

/** [emergencyOutage] is kept for source compatibility only; emergencies come from PowerOnClient and are always null here. */
data class ZtoeHouseLookupResult(
    val house: String,
    val queue: String,
    val statusText: String? = null,
    val emergencyOutage: EmergencyOutageInfo? = null,
    val addressLabel: String = ""
)

object ZtoeAddressLookup {
    const val DEFAULT_SITE_URL = "https://www.ztoe.com.ua/unhooking-search.php"

    /** Bumped to 2 when merged street ids were introduced; caches of other versions are discarded. */
    internal const val CACHE_VERSION = 2
    private const val PREFS_NAME = "zt_address_index_cache_v1"
    private const val KEY_INDEX_JSON = "address_index_json_v1"
    private const val MAX_PERSISTED_HOUSE_STREETS = 50
    private const val FRESH_HOUSE_CACHE_TTL_MS = 120_000L

    /** The bulk page for a whole settlement (all=1) is large; it is fetched at most once per TTL. */
    internal const val BULK_TTL_MS = 6L * 60 * 60 * 1000
    private const val FORCE_REFRESH_MIN_INTERVAL_MS = 10L * 60 * 1000
    private const val IN_FLIGHT_WAIT_SECONDS = 45L

    private const val SCHEDULE_MARKER = "Графіки погодинних відключень"

    private val VALID_OUTAGE_TIMESTAMP_REGEX = Regex("""(?:\b\d{1,2}\.\d{1,2}(?:\.\d{2,4})?\b|\b\d{4}-\d{2}-\d{2}\b)?[\sT]*\b([01]?\d|2[0-3]):[0-5]\d\b""")
    private val SELECT_REM_REGEX = Regex("""<select[^>]*name=["']?rem_id["']?[^>]*>([\s\S]*?)</select>""", RegexOption.IGNORE_CASE)
    private val SELECT_NASPUNKT_REGEX = Regex("""<select[^>]*name=["']?naspunkt_id["']?[^>]*>([\s\S]*?)</select>""", RegexOption.IGNORE_CASE)
    private val SELECT_VULICA_REGEX = Regex("""<select[^>]*name=["']?vulica_id["']?[^>]*>([\s\S]*?)</select>""", RegexOption.IGNORE_CASE)
    private val OPTION_TAG_REGEX = Regex("""<option\s+value=["']?(\d+)["']?[^>]*>([\s\S]*?)</option>""", RegexOption.IGNORE_CASE)
    private val TR_TAG_REGEX = Regex("""<tr\b[^>]*>([\s\S]*?)</tr>""", RegexOption.IGNORE_CASE)
    private val TD_TH_TAG_REGEX = Regex("""<(?:td|th)\b[^>]*>([\s\S]*?)</(?:td|th)>""", RegexOption.IGNORE_CASE)
    private val HTML_TAG_STRIP_REGEX = Regex("""<[^>]*>""")
    private val WHITESPACE_REGEX = Regex("""\s+""")
    private val HOUSE_SPLIT_REGEX = Regex("[,;]")
    private val NON_DIGIT_REGEX = Regex("[^0-9]")
    private val PARENS_REGEX = Regex("""\([^)]*\)""")
    private val CITY_PREFIX_REGEX = Regex("""^(?:(?:м|с|смт)\.\s*|(?:місто|село|смт|селище)\s+)""")
    private val CITY_PUNCT_REGEX = Regex("""[.,"«»]""")
    private val LABEL_VILLAGE_REGEX = Regex("^село\\s+", RegexOption.IGNORE_CASE)
    private val LABEL_TOWN_REGEX = Regex("^місто\\s+", RegexOption.IGNORE_CASE)

    /** Canonical street type tokens as they appear in a [StreetKey] (after the Latin look-alike skeleton). */
    private val STREET_TYPE_KEY_TOKENS: Set<String> = listOf(
        "вул", "пров", "просп", "б-р", "пл", "пр-д", "узв", "туп", "наб", "шосе", "майдан"
    ).map { TextNorm.skeleton(it) }.toSet()

    @Volatile
    private var appContext: android.content.Context? = null

    @Volatile
    private var diskCacheHydrated: Boolean = false
    private val hydrateAttempted = AtomicBoolean(false)

    @Volatile
    private var cachedRems: List<ZtoeRemOption>? = null
    private val cachedSettlementsByRem = ConcurrentHashMap<String, List<ZtoeSettlementOption>>()

    /** Merged street lists per settlement; every list written here already went through [mergeStreets]. */
    private val cachedStreetsBySettlement = ConcurrentHashMap<String, List<ZtoeStreetOption>>()

    /** Any street option id (canonical or merged duplicate) to its option. */
    private val streetByAnyId = ConcurrentHashMap<String, ZtoeStreetOption>()

    /** Houses by canonical street id. */
    private val cachedHousesByStreet = ConcurrentHashMap<String, List<ZtoeHouseLookupResult>>()
    private val houseCacheUpdatedAtByStreet = ConcurrentHashMap<String, Long>()
    private val bulkFetchedAtBySettlement = ConcurrentHashMap<String, Long>()
    private val inFlight = ConcurrentHashMap<String, CompletableFuture<Any?>>()

    private val recentLock = Any()
    private val recentHouseStreets = ArrayList<String>()

    private val persistPending = AtomicBoolean(false)
    private val diskPersistExecutor = Executors.newSingleThreadExecutor { r ->
        Thread(r, "ZtoeDiskCachePersist").apply {
            isDaemon = true
            priority = Thread.MIN_PRIORITY
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Static fallback directory
    // ---------------------------------------------------------------------------------------------

    val ZTOE_REM_OPTIONS: List<ZtoeRemOption> = ZtoeStaticDirectory.REMS
    val ZTOE_SETTLEMENTS: List<ZtoeSettlementOption> = ZtoeStaticDirectory.SETTLEMENTS

    /** Static streets, already merged by [StreetKey]. */
    val ZTOE_STREETS: List<ZtoeStreetOption> by lazy { mergeStreets(ZtoeStaticDirectory.STREETS_RAW) }

    private val staticStreetByAnyId: Map<String, ZtoeStreetOption> by lazy {
        HashMap<String, ZtoeStreetOption>().also { m -> for (s in ZTOE_STREETS) for (id in s.allIds) m[id] = s }
    }
    private val staticStreetByVulica: Map<Int, ZtoeStreetOption> by lazy {
        HashMap<Int, ZtoeStreetOption>().also { m -> for (s in ZTOE_STREETS) for (v in s.ztoeVulicaIds) m.putIfAbsent(v, s) }
    }

    val DIRECTORY: List<ZtoeRemOption>
        get() = getRems()

    fun getRems(): List<ZtoeRemOption> = cachedRems ?: ZTOE_REM_OPTIONS

    fun getSettlementsForRem(remId: String): List<ZtoeSettlementOption> {
        return cachedSettlementsByRem[remId] ?: ZTOE_SETTLEMENTS.filter { it.remId == remId }
    }

    fun getStreetsForSettlement(settlementId: String): List<ZtoeStreetOption> {
        val sid = canonicalSettlementId(settlementId)
        return cachedStreetsBySettlement[sid] ?: ZTOE_STREETS.filter { it.settlementId == sid }
    }

    /** Houses of the street (any of its merged ids). Empty until the live index loaded them; there are no fake defaults. */
    fun getHousesForStreet(streetId: String): List<ZtoeHouseLookupResult> {
        cachedHousesByStreet[streetId]?.let { return it }
        val canonical = findStreetById(streetId)?.id ?: return emptyList()
        return cachedHousesByStreet[canonical] ?: emptyList()
    }

    private fun canonicalSettlementId(id: String): String = ZtoeStaticDirectory.LEGACY_SETTLEMENT_IDS[id] ?: id

    fun findSettlementById(settlementId: String): ZtoeSettlementOption? {
        val id = canonicalSettlementId(settlementId)
        for (list in cachedSettlementsByRem.values) {
            list.firstOrNull { it.id == id }?.let { found ->
                if (found.poweronCityId != null) return found
                val staticMatch = ZTOE_SETTLEMENTS.firstOrNull { it.id == found.id || it.ztoeNaspunktId == found.ztoeNaspunktId }
                return if (staticMatch?.poweronCityId != null) found.copy(poweronCityId = staticMatch.poweronCityId) else found
            }
        }
        ZTOE_SETTLEMENTS.firstOrNull { it.id == id }?.let { return it }
        val npId = id.removePrefix("np_").toIntOrNull()
        if (npId != null) {
            for (list in cachedSettlementsByRem.values) {
                list.firstOrNull { it.ztoeNaspunktId == npId }?.let { return it }
            }
            ZTOE_SETTLEMENTS.firstOrNull { it.ztoeNaspunktId == npId }?.let { return it }
            return ZtoeSettlementOption(settlementId, "", npId, "", "")
        }
        return null
    }

    /** Resolves the canonical option id or any merged duplicate id, plus the legacy ids of earlier versions. */
    fun findStreetById(streetId: String): ZtoeStreetOption? {
        if (streetId.isBlank()) return null
        val id = ZtoeStaticDirectory.LEGACY_STREET_IDS[streetId] ?: streetId
        streetByAnyId[id]?.let { return it }
        staticStreetByAnyId[id]?.let { return it }
        val vulId = id.removePrefix("st_").toIntOrNull() ?: return null
        streetByAnyId.values.firstOrNull { vulId in it.ztoeVulicaIds }?.let { return it }
        staticStreetByVulica[vulId]?.let { return it }
        return ZtoeStreetOption(streetId, "", vulId, "", "")
    }

    // ---------------------------------------------------------------------------------------------
    // Street merge (spec/ADDRESS_KEY.md section 5)
    // ---------------------------------------------------------------------------------------------

    /**
     * Groups streets of one settlement by [StreetKey.of] and returns one option per group that holds
     * all ids. Display name: first name seen. Canonical id: a static (non "st_") id when there is one,
     * otherwise the member with the lowest ztoe id. Idempotent, so it is safe to apply to data that
     * is already merged (cache hydration, read).
     */
    internal fun mergeStreets(streets: List<ZtoeStreetOption>): List<ZtoeStreetOption> {
        if (streets.isEmpty()) return streets
        val groups = LinkedHashMap<String, MutableList<ZtoeStreetOption>>(streets.size * 2)
        var anonymous = 0
        for (s in streets) {
            val key = StreetKey.of(s.nameUk)
            val groupKey = if (key.isEmpty()) "#${anonymous++}" else "${s.settlementId}|$key"
            groups.getOrPut(groupKey) { ArrayList(1) }.add(s)
        }
        val out = ArrayList<ZtoeStreetOption>(groups.size)
        for (g in groups.values) out.add(mergeGroup(g))
        return out
    }

    private fun mergeGroup(group: List<ZtoeStreetOption>): ZtoeStreetOption {
        val first = group[0]
        val canonical = group.firstOrNull { !it.id.startsWith("st_") }
            ?: group.minByOrNull { it.ztoeVulicaId }
            ?: first
        val ordered = listOf(canonical) + group.filter { it !== canonical }
        val allIds = (listOf(canonical.id) + ordered.flatMap { it.allIds + it.id }).distinct()
        val vulicaIds = (listOf(canonical.ztoeVulicaId) + ordered.flatMap { it.ztoeVulicaIds + it.ztoeVulicaId }).distinct()
        val poweronIds = ordered.flatMap { it.poweronStreetIds + listOfNotNull(it.poweronStreetId) }.distinct()
        return canonical.copy(
            nameUk = first.nameUk,
            nameEn = first.nameEn,
            poweronStreetId = canonical.poweronStreetId ?: poweronIds.firstOrNull(),
            allIds = allIds,
            ztoeVulicaIds = vulicaIds,
            poweronStreetIds = poweronIds
        )
    }

    /** Publishes a merged street list and re-keys houses cached under an id that stopped being canonical. */
    private fun registerStreets(settlementId: String, merged: List<ZtoeStreetOption>) {
        cachedStreetsBySettlement[settlementId] = merged
        for (st in merged) {
            for (id in st.allIds) {
                val prev = streetByAnyId.put(id, st)
                if (prev != null && prev.id != st.id) {
                    cachedHousesByStreet.remove(prev.id)?.let { old ->
                        cachedHousesByStreet.merge(st.id, old) { a, b -> unionHouses(a, b) }
                    }
                    houseCacheUpdatedAtByStreet.remove(prev.id)
                }
            }
        }
    }

    // ---------------------------------------------------------------------------------------------
    // House helpers
    // ---------------------------------------------------------------------------------------------

    private class HouseSortEntry(val house: ZtoeHouseLookupResult) {
        val number: Int
        val text: String = house.house.trim().lowercase()

        init {
            var end = 0
            while (end < text.length && text[end] in '0'..'9') end++
            number = if (end == 0) Int.MAX_VALUE else text.substring(0, end).toIntOrNull() ?: Int.MAX_VALUE
        }
    }

    private fun sortHouses(houses: Collection<ZtoeHouseLookupResult>): List<ZtoeHouseLookupResult> {
        return houses.map { HouseSortEntry(it) }
            .sortedWith(compareBy<HouseSortEntry> { it.number }.thenBy { it.text })
            .map { it.house }
    }

    /** First display form wins, except that a row with a queue replaces a row without one. */
    private fun putHouse(map: MutableMap<String, ZtoeHouseLookupResult>, h: ZtoeHouseLookupResult) {
        val key = HouseKey.of(h.house)
        if (key.isEmpty()) return
        val existing = map[key]
        if (existing == null || (existing.queue.isEmpty() && h.queue.isNotEmpty())) {
            map[key] = h
        }
    }

    internal fun unionHouses(a: List<ZtoeHouseLookupResult>, b: List<ZtoeHouseLookupResult>): List<ZtoeHouseLookupResult> {
        val map = LinkedHashMap<String, ZtoeHouseLookupResult>()
        for (h in a) putHouse(map, h)
        for (h in b) putHouse(map, h)
        return sortHouses(map.values)
    }

    private fun storeStreetHouses(canonicalStreetId: String, houses: List<ZtoeHouseLookupResult>) {
        cachedHousesByStreet[canonicalStreetId] = houses
        houseCacheUpdatedAtByStreet[canonicalStreetId] = System.currentTimeMillis()
        recordRecentHouseStreet(canonicalStreetId)
    }

    private fun recordRecentHouseStreet(streetId: String) {
        if (streetId.isBlank()) return
        synchronized(recentLock) {
            recentHouseStreets.remove(streetId)
            recentHouseStreets.add(0, streetId)
            while (recentHouseStreets.size > MAX_PERSISTED_HOUSE_STREETS) {
                recentHouseStreets.removeAt(recentHouseStreets.lastIndex)
            }
        }
    }

    private fun recentSnapshot(): List<String> = synchronized(recentLock) { ArrayList(recentHouseStreets) }

    // ---------------------------------------------------------------------------------------------
    // Text helpers
    // ---------------------------------------------------------------------------------------------

    private fun stripHtmlFast(raw: String): String {
        val noTags = HTML_TAG_STRIP_REGEX.replace(raw, " ")
        val decoded = TextNorm.decodeEntities(noTags).replace(' ', ' ')
        return WHITESPACE_REGEX.replace(decoded, " ").trim()
    }

    /** Exact-match key for settlement names: no prefix, no parentheses, no apostrophes; never a substring test. */
    internal fun cityKey(raw: String): String {
        var s = TextNorm.decodeEntities(raw).lowercase()
        s = PARENS_REGEX.replace(s, "")
        s = CITY_PREFIX_REGEX.replace(s.trim(), "")
        s = s.filter { TextNorm.APOSTROPHES.indexOf(it) < 0 }
        s = CITY_PUNCT_REGEX.replace(s, " ").replace("бердичив", "бердичів")
        return WHITESPACE_REGEX.replace(s, " ").trim()
    }

    private fun formatSettlementLabelUk(rawLabel: String): String {
        return rawLabel
            .replace(LABEL_VILLAGE_REGEX, "с. ")
            .replace(LABEL_TOWN_REGEX, "м. ")
            .trim()
    }

    private fun splitHouses(field: String): List<String> {
        return field.split(HOUSE_SPLIT_REGEX)
            .map { it.trim() }
            .filter { it.isNotEmpty() && !it.equals("будинки", ignoreCase = true) }
    }

    /** The part of the page before the schedule section, without copying the string. */
    private fun addressSection(html: String): CharSequence {
        val idx = html.indexOf(SCHEDULE_MARKER)
        return if (idx >= 0) CharBuffer.wrap(html, 0, idx) else html
    }

    private fun bareStreetKey(key: String): String {
        val space = key.indexOf(' ')
        if (space < 0) return if (key in STREET_TYPE_KEY_TOKENS) "" else key
        return if (key.substring(0, space) in STREET_TYPE_KEY_TOKENS) key.substring(space + 1) else key
    }

    // ---------------------------------------------------------------------------------------------
    // Disk cache (org.json)
    // ---------------------------------------------------------------------------------------------

    private fun JSONObject.str(name: String): String? = if (has(name) && !isNull(name)) optString(name) else null
    private fun JSONObject.int(name: String): Int? = if (has(name) && !isNull(name)) optInt(name) else null

    private fun JSONObject.strList(name: String): List<String> {
        val arr = optJSONArray(name) ?: return emptyList()
        return (0 until arr.length()).mapNotNull { i -> arr.optString(i).takeIf { it.isNotEmpty() } }
    }

    private fun JSONObject.intList(name: String): List<Int> {
        val arr = optJSONArray(name) ?: return emptyList()
        return (0 until arr.length()).map { i -> arr.optInt(i) }
    }

    fun serializeCacheToJson(): String {
        val root = JSONObject()
        root.put("version", CACHE_VERSION)

        val rems = JSONArray()
        for (r in cachedRems ?: emptyList()) {
            rems.put(JSONObject().apply {
                put("id", r.id)
                put("ztoeRemId", r.ztoeRemId)
                r.ztoeOtgId?.let { put("ztoeOtgId", it) }
                put("nameUk", r.nameUk)
                put("nameEn", r.nameEn)
            })
        }
        root.put("rems", rems)

        val settlements = JSONArray()
        for (list in cachedSettlementsByRem.values) {
            for (s in list) {
                settlements.put(JSONObject().apply {
                    put("id", s.id)
                    put("remId", s.remId)
                    put("ztoeNaspunktId", s.ztoeNaspunktId)
                    s.poweronCityId?.let { put("poweronCityId", it) }
                    put("nameUk", s.nameUk)
                    put("nameEn", s.nameEn)
                })
            }
        }
        root.put("settlements", settlements)

        val streets = JSONArray()
        for (list in cachedStreetsBySettlement.values) {
            for (st in list) {
                streets.put(JSONObject().apply {
                    put("id", st.id)
                    put("settlementId", st.settlementId)
                    put("ztoeVulicaId", st.ztoeVulicaId)
                    st.poweronStreetId?.let { put("poweronStreetId", it) }
                    put("nameUk", st.nameUk)
                    put("nameEn", st.nameEn)
                    put("allIds", JSONArray(st.allIds))
                    put("ztoeVulicaIds", JSONArray(st.ztoeVulicaIds))
                    put("poweronStreetIds", JSONArray(st.poweronStreetIds))
                })
            }
        }
        root.put("streets", streets)

        val houses = JSONArray()
        val recent = recentSnapshot()
        val orderedStreets = (recent + cachedHousesByStreet.keys.toList()).distinct().take(MAX_PERSISTED_HOUSE_STREETS)
        for (streetId in orderedStreets) {
            val list = cachedHousesByStreet[streetId] ?: continue
            for (h in list) {
                houses.put(JSONObject().apply {
                    put("streetId", streetId)
                    put("house", h.house)
                    put("queue", h.queue)
                    if (!h.statusText.isNullOrBlank()) put("statusText", h.statusText)
                })
            }
        }
        root.put("houses", houses)
        root.put("recent", JSONArray(recent))

        val bulk = JSONObject()
        for ((sid, at) in bulkFetchedAtBySettlement) bulk.put(sid, at)
        root.put("bulkAt", bulk)
        return root.toString()
    }

    /**
     * Loads a stored index. A cache of another [CACHE_VERSION] is rejected. Street lists are merged
     * again (an old cache with duplicates heals on read) and in-memory data that is already present
     * is not overwritten by older stored data.
     */
    fun hydrateCacheFromJson(jsonStr: String): Boolean {
        if (jsonStr.isBlank()) return false
        return try {
            val root = JSONObject(jsonStr)
            if (root.optInt("version", -1) != CACHE_VERSION) return false

            root.optJSONArray("rems")?.let { arr ->
                val parsed = mutableListOf<ZtoeRemOption>()
                for (i in 0 until arr.length()) {
                    val o = arr.optJSONObject(i) ?: continue
                    val id = o.str("id") ?: continue
                    val ztoeRemId = o.int("ztoeRemId") ?: continue
                    val nameUk = stripHtmlFast(o.str("nameUk") ?: continue)
                    val nameEn = stripHtmlFast(o.str("nameEn") ?: nameUk)
                    val staticRem = ZTOE_REM_OPTIONS.firstOrNull { it.id == id || it.ztoeRemId == ztoeRemId }
                    parsed.add(ZtoeRemOption(id, ztoeRemId, nameUk, nameEn, o.int("ztoeOtgId") ?: staticRem?.ztoeOtgId))
                }
                if (parsed.isNotEmpty() && cachedRems == null) cachedRems = parsed
            }

            root.optJSONArray("settlements")?.let { arr ->
                val grouped = LinkedHashMap<String, MutableList<ZtoeSettlementOption>>()
                for (i in 0 until arr.length()) {
                    val o = arr.optJSONObject(i) ?: continue
                    val id = o.str("id") ?: continue
                    val remId = o.str("remId") ?: continue
                    val npId = o.int("ztoeNaspunktId") ?: continue
                    val nameUk = stripHtmlFast(o.str("nameUk") ?: continue)
                    val nameEn = stripHtmlFast(o.str("nameEn") ?: nameUk)
                    val staticSettlement = ZTOE_SETTLEMENTS.firstOrNull { it.id == id || it.ztoeNaspunktId == npId }
                    val cityId = o.int("poweronCityId") ?: staticSettlement?.poweronCityId
                    grouped.getOrPut(remId) { mutableListOf() }.add(ZtoeSettlementOption(id, remId, npId, nameUk, nameEn, cityId))
                }
                for ((remId, list) in grouped) {
                    if (list.isNotEmpty()) cachedSettlementsByRem.putIfAbsent(remId, list)
                }
            }

            root.optJSONArray("streets")?.let { arr ->
                val grouped = LinkedHashMap<String, MutableList<ZtoeStreetOption>>()
                for (i in 0 until arr.length()) {
                    val o = arr.optJSONObject(i) ?: continue
                    val id = o.str("id") ?: continue
                    val settlementId = o.str("settlementId") ?: continue
                    val vulId = o.int("ztoeVulicaId") ?: continue
                    val nameUk = stripHtmlFast(o.str("nameUk") ?: continue)
                    val nameEn = stripHtmlFast(o.str("nameEn") ?: nameUk)
                    val static = staticStreetByAnyId[id] ?: staticStreetByVulica[vulId]
                    val poweronIds = (o.intList("poweronStreetIds") + (static?.poweronStreetIds ?: emptyList())).distinct()
                    grouped.getOrPut(settlementId) { mutableListOf() }.add(
                        ZtoeStreetOption(
                            id = id,
                            settlementId = settlementId,
                            ztoeVulicaId = vulId,
                            nameUk = nameUk,
                            nameEn = nameEn,
                            poweronStreetId = o.int("poweronStreetId") ?: static?.poweronStreetId,
                            allIds = (listOf(id) + o.strList("allIds")).distinct(),
                            ztoeVulicaIds = (listOf(vulId) + o.intList("ztoeVulicaIds")).distinct(),
                            poweronStreetIds = poweronIds
                        )
                    )
                }
                for ((settlementId, list) in grouped) {
                    if (list.isNotEmpty() && !cachedStreetsBySettlement.containsKey(settlementId)) {
                        registerStreets(settlementId, mergeStreets(list))
                    }
                }
            }

            root.optJSONArray("houses")?.let { arr ->
                val grouped = LinkedHashMap<String, MutableList<ZtoeHouseLookupResult>>()
                val accepted = HashSet<String>()
                for (i in 0 until arr.length()) {
                    val o = arr.optJSONObject(i) ?: continue
                    val streetId = o.str("streetId") ?: continue
                    if (streetId !in accepted) {
                        if (accepted.size >= MAX_PERSISTED_HOUSE_STREETS) continue
                        accepted.add(streetId)
                    }
                    val house = o.str("house") ?: continue
                    val canonical = findStreetById(streetId)?.id ?: streetId
                    grouped.getOrPut(canonical) { mutableListOf() }.add(
                        ZtoeHouseLookupResult(house = house, queue = o.str("queue") ?: "", statusText = o.str("statusText"))
                    )
                }
                for ((canonical, list) in grouped) {
                    if (list.isNotEmpty()) cachedHousesByStreet.putIfAbsent(canonical, unionHouses(list, emptyList()))
                }
            }

            root.optJSONArray("recent")?.let { arr ->
                synchronized(recentLock) {
                    if (recentHouseStreets.isEmpty()) {
                        for (i in 0 until arr.length()) {
                            val id = arr.optString(i)
                            if (id.isNotEmpty() && recentHouseStreets.size < MAX_PERSISTED_HOUSE_STREETS && id !in recentHouseStreets) {
                                recentHouseStreets.add(id)
                            }
                        }
                    }
                }
            }

            root.optJSONObject("bulkAt")?.let { bulk ->
                for (sid in bulk.keys()) {
                    val at = bulk.optLong(sid, 0L)
                    if (at > 0L) bulkFetchedAtBySettlement.putIfAbsent(sid, at)
                }
            }
            diskCacheHydrated = true
            true
        } catch (_: Exception) {
            false
        }
    }

    /** Hydrates once per process from SharedPreferences; a stale or unreadable cache is removed. */
    fun initDiskCache(context: android.content.Context): Boolean {
        appContext = context.applicationContext
        if (hydrateAttempted.getAndSet(true)) return diskCacheHydrated
        return try {
            val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE)
            val rawJson = prefs.getString(KEY_INDEX_JSON, null) ?: return false
            val ok = hydrateCacheFromJson(rawJson)
            if (!ok) prefs.edit().remove(KEY_INDEX_JSON).apply()
            ok
        } catch (_: Exception) {
            false
        }
    }

    /** Writes are coalesced: calls made while a write is queued share that write. */
    fun persistToDiskCache() {
        val ctx = appContext ?: return
        if (!persistPending.compareAndSet(false, true)) return
        try {
            diskPersistExecutor.execute {
                persistPending.set(false)
                try {
                    val json = serializeCacheToJson()
                    ctx.getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE)
                        .edit()
                        .putString(KEY_INDEX_JSON, json)
                        .apply()
                } catch (_: Exception) {
                }
            }
        } catch (_: Exception) {
            persistPending.set(false)
        }
    }

    fun clearCacheForTesting() {
        diskCacheHydrated = false
        hydrateAttempted.set(false)
        cachedRems = null
        cachedSettlementsByRem.clear()
        cachedStreetsBySettlement.clear()
        streetByAnyId.clear()
        cachedHousesByStreet.clear()
        houseCacheUpdatedAtByStreet.clear()
        bulkFetchedAtBySettlement.clear()
        inFlight.clear()
        synchronized(recentLock) { recentHouseStreets.clear() }
    }

    // ---------------------------------------------------------------------------------------------
    // Network
    // ---------------------------------------------------------------------------------------------

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

    /**
     * Runs [block] once per [key]; concurrent callers wait (outside any monitor) for the first
     * caller's result and get [fallback] if it failed or took too long.
     */
    @Suppress("UNCHECKED_CAST")
    private fun <T> singleFlight(key: String, fallback: () -> T, block: () -> T): T {
        val mine = CompletableFuture<Any?>()
        val running = inFlight.putIfAbsent(key, mine)
        if (running != null) {
            return try {
                running.get(IN_FLIGHT_WAIT_SECONDS, TimeUnit.SECONDS) as T
            } catch (e: InterruptedException) {
                Thread.currentThread().interrupt()
                fallback()
            } catch (_: Exception) {
                fallback()
            }
        }
        try {
            val value = block()
            mine.complete(value)
            return value
        } catch (t: Throwable) {
            mine.completeExceptionally(t)
            throw t
        } finally {
            inFlight.remove(key, mine)
        }
    }

    private fun awaitInFlight(key: String) {
        val running = inFlight[key] ?: return
        try {
            running.get(IN_FLIGHT_WAIT_SECONDS, TimeUnit.SECONDS)
        } catch (e: InterruptedException) {
            Thread.currentThread().interrupt()
        } catch (_: Exception) {
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Directory parsing (rem, settlement, street selects)
    // ---------------------------------------------------------------------------------------------

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

    fun parseZtoeSettlementOptionsHtml(remId: String, html: String): List<ZtoeSettlementOption> {
        val selectInner = SELECT_NASPUNKT_REGEX.find(html)?.groupValues?.get(1) ?: return emptyList()
        val existingForRem = ZTOE_SETTLEMENTS.filter { it.remId == remId }
        val existingKeys = existingForRem.map { cityKey(it.nameUk) }
        val parsed = mutableListOf<ZtoeSettlementOption>()
        val seenIds = HashSet<String>()
        for (m in OPTION_TAG_REGEX.findAll(selectInner)) {
            val npId = m.groupValues[1].trim().toIntOrNull() ?: continue
            if (npId <= 0) continue
            val label = formatSettlementLabelUk(stripHtmlFast(m.groupValues[2]))
            if (label.isEmpty() || label.contains("Оберіть", ignoreCase = true)) continue
            val labelKey = cityKey(label)
            val byName = existingKeys.indexOf(labelKey).takeIf { it >= 0 }?.let { existingForRem[it] }
            val candidate = byName ?: existingForRem.firstOrNull { it.ztoeNaspunktId == npId }
            val matchedExisting = candidate?.takeIf { !seenIds.contains(it.id) }

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

    /** Parses the street select and returns the list already merged by [StreetKey]. */
    fun parseZtoeStreetOptionsHtml(settlementId: String, html: String): List<ZtoeStreetOption> {
        val selectInner = SELECT_VULICA_REGEX.find(html)?.groupValues?.get(1) ?: return emptyList()
        val staticForSettlement = ZTOE_STREETS.filter { it.settlementId == settlementId }
        val staticByKey = HashMap<String, ZtoeStreetOption>()
        for (s in staticForSettlement) staticByKey.putIfAbsent(StreetKey.of(s.nameUk), s)
        val usedStatic = HashSet<String>()
        val parsed = ArrayList<ZtoeStreetOption>()
        for (m in OPTION_TAG_REGEX.findAll(selectInner)) {
            val vulId = m.groupValues[1].trim().toIntOrNull() ?: continue
            if (vulId <= 0) continue
            val label = stripHtmlFast(m.groupValues[2])
            if (label.isEmpty() || label.contains("Оберіть", ignoreCase = true)) continue
            val candidate = staticByKey[StreetKey.of(label)]
                ?: staticStreetByVulica[vulId]?.takeIf { it.settlementId == settlementId }
            val matchedStatic = candidate?.takeIf { usedStatic.add(it.id) }
            if (matchedStatic != null) {
                parsed.add(
                    matchedStatic.copy(
                        ztoeVulicaId = vulId,
                        ztoeVulicaIds = listOf(vulId),
                        allIds = listOf(matchedStatic.id)
                    )
                )
            } else {
                parsed.add(ZtoeStreetOption(id = "st_$vulId", settlementId = settlementId, ztoeVulicaId = vulId, nameUk = label, nameEn = label))
            }
        }
        return mergeStreets(parsed)
    }

    // ---------------------------------------------------------------------------------------------
    // House table parsing
    // ---------------------------------------------------------------------------------------------

    /**
     * Parses a settlement-wide ZTOE response (`rem_id=X&naspunkt_id=Y&all=1`) and indexes the houses of
     * EVERY street of the settlement in one pass. A row is assigned to a street only when the
     * [StreetKey] of its name equals the key of the street (or, when exactly one street fits and one
     * side has no street type, the bare names are equal). Never by substring.
     */
    fun parseZtoeSettlementHousesTableHtml(
        settlementId: String,
        streets: List<ZtoeStreetOption>,
        html: String
    ): Map<String, List<ZtoeHouseLookupResult>> {
        if (html.isBlank() || streets.isEmpty()) return emptyMap()

        val merged = mergeStreets(streets)
        val idByKey = HashMap<String, String>(merged.size * 2)
        val keyById = HashMap<String, String>(merged.size * 2)
        val idsByBare = HashMap<String, MutableList<String>>(merged.size * 2)
        for (st in merged) {
            val key = StreetKey.of(st.nameUk)
            if (key.isEmpty()) continue
            idByKey.putIfAbsent(key, st.id)
            keyById[st.id] = key
            val bare = bareStreetKey(key)
            if (bare.isNotEmpty()) idsByBare.getOrPut(bare) { mutableListOf() }.add(st.id)
        }

        val rowMatchCache = HashMap<String, String?>()
        fun matchStreet(rawName: String): String? {
            if (rowMatchCache.containsKey(rawName)) return rowMatchCache[rawName]
            val key = StreetKey.of(rawName)
            var found = idByKey[key]
            if (found == null && key.isNotEmpty()) {
                val bare = bareStreetKey(key)
                val candidates = if (bare.isEmpty()) null else idsByBare[bare]
                if (candidates != null && candidates.size == 1) {
                    // at least one side must have no street type, otherwise "вул. X" would match "пров. X"
                    val candidateKey = keyById[candidates[0]].orEmpty()
                    if (key == bare || candidateKey == bare) {
                        found = candidates[0]
                    }
                }
            }
            rowMatchCache[rawName] = found
            return found
        }

        val houseMaps = HashMap<String, LinkedHashMap<String, ZtoeHouseLookupResult>>()
        for (trMatch in TR_TAG_REGEX.findAll(addressSection(html))) {
            val rowHtml = trMatch.groupValues[1]
            if (rowHtml.contains("<select", ignoreCase = true) || rowHtml.contains("<input", ignoreCase = true)) {
                continue
            }
            val cells = ArrayList<String>(7)
            for (cellMatch in TD_TH_TAG_REGEX.findAll(rowHtml)) {
                cells.add(stripHtmlFast(cellMatch.groupValues[1]))
            }
            if (cells.size < 5) continue

            if (cells[0].lowercase() == "рем" || cells[2].lowercase().contains("назва вулиці")) {
                continue
            }

            val streetNameRaw = cells[2].trim()
            val houseField = cells[3].trim()
            if (streetNameRaw.isEmpty() || houseField.isEmpty()) continue

            val streetId = matchStreet(streetNameRaw) ?: continue

            val col4 = cells[4].trim()
            val col5 = if (cells.size >= 6) cells[5].trim() else ""
            val candidateQueue = "${NON_DIGIT_REGEX.replace(col4, "")}.${NON_DIGIT_REGEX.replace(col5, "")}"

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

            val streetMap = houseMaps.getOrPut(streetId) { LinkedHashMap() }
            for (h in splitHouses(houseField)) {
                putHouse(streetMap, ZtoeHouseLookupResult(house = h, queue = resolvedQueue, statusText = resolvedStatusText))
            }
        }

        val result = HashMap<String, List<ZtoeHouseLookupResult>>(houseMaps.size)
        for ((streetId, map) in houseMaps) {
            if (map.isEmpty()) continue
            val sorted = sortHouses(map.values)
            result[streetId] = sorted
            cachedHousesByStreet[streetId] = sorted
            houseCacheUpdatedAtByStreet[streetId] = System.currentTimeMillis()
        }
        return result
    }

    /**
     * Parses HTML table rows from ZTOE unhooking-search.php address lookup results.
     * Supports 7-column real ZTOE tables, 3-column [Queue, Subqueue, Houses] or [House, Queue, Subqueue] tables,
     * and colspan status messages using fast regex/string scanning without Jsoup DOM allocation overhead.
     */
    fun parseZtoeAddressLookupTableHtml(html: String): List<ZtoeHouseLookupResult> {
        val results = mutableListOf<ZtoeHouseLookupResult>()

        for (trMatch in TR_TAG_REGEX.findAll(addressSection(html))) {
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

            // Format A: Real ZTOE 5+ column address lookup table:
            // [0] REM, [1] settlement, [2] street, [3] houses, [4] queue (or colspan="3" status message), [5] subqueue
            if (cells.size >= 5) {
                val col4 = cells[4].trim()
                val col5 = if (cells.size >= 6) cells[5].trim() else ""
                val houses = splitHouses(cells[3])

                if (houses.isNotEmpty()) {
                    val candidateQueue = "${NON_DIGIT_REGEX.replace(col4, "")}.${NON_DIGIT_REGEX.replace(col5, "")}"

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
                val candidateQueue01 = "${NON_DIGIT_REGEX.replace(cells[0], "")}.${NON_DIGIT_REGEX.replace(cells[1], "")}"
                if (ZtoeParser.ALL_QUEUES.contains(candidateQueue01)) {
                    for (h in splitHouses(cells[cells.size - 1])) {
                        results.add(ZtoeHouseLookupResult(house = h, queue = candidateQueue01))
                    }
                    continue
                }

                // Format B2: 3-column table [Houses, Queue, Subqueue]
                val candidateQueue12 = "${NON_DIGIT_REGEX.replace(cells[1], "")}.${NON_DIGIT_REGEX.replace(cells[2], "")}"
                if (ZtoeParser.ALL_QUEUES.contains(candidateQueue12)) {
                    for (h in splitHouses(cells[0])) {
                        results.add(ZtoeHouseLookupResult(house = h, queue = candidateQueue12))
                    }
                    continue
                }
            }

            // Format C: 2-column or colspan status message row ([Houses, StatusMessage] or [StatusMessage, Houses])
            val firstCell = cells.first()
            val lastCell = cells.last()
            if (lastCell.length > 12 && firstCell.length <= 12) {
                for (h in splitHouses(firstCell)) {
                    results.add(ZtoeHouseLookupResult(house = h, queue = "", statusText = lastCell))
                }
            } else {
                val statusMessage = cells.dropLast(1).joinToString(" ").trim()
                if (statusMessage.isNotEmpty()) {
                    for (h in splitHouses(lastCell)) {
                        results.add(ZtoeHouseLookupResult(house = h, queue = "", statusText = statusMessage))
                    }
                }
            }
        }
        return results
    }

    /** Returns Pair(queueOrNull, statusTextOrNull) for a specific house number (compared by [HouseKey]). */
    fun parseZtoeAddressLookupTableHtml(html: String, targetHouse: String): Pair<String?, String?>? {
        val target = HouseKey.of(targetHouse)
        if (target.isEmpty()) return null
        val matching = parseZtoeAddressLookupTableHtml(html).filter { HouseKey.of(it.house) == target }
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

    // ---------------------------------------------------------------------------------------------
    // Fetching
    // ---------------------------------------------------------------------------------------------

    fun fetchRemsFromZtoe(
        siteUrl: String = DEFAULT_SITE_URL,
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

    fun fetchSettlementsForRem(
        remId: String,
        siteUrl: String = DEFAULT_SITE_URL,
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

    private fun bulkRefreshDue(settlementId: String, forceRefresh: Boolean): Boolean {
        val at = bulkFetchedAtBySettlement[settlementId] ?: return true
        val age = System.currentTimeMillis() - at
        if (age < 0L || age >= BULK_TTL_MS) return true
        return forceRefresh && age >= FORCE_REFRESH_MIN_INTERVAL_MS
    }

    /**
     * Streets (merged) and, from the same single response, all houses of the settlement. The bulk
     * page is requested at most once per [BULK_TTL_MS] per settlement; a force refresh is honoured only
     * after [FORCE_REFRESH_MIN_INTERVAL_MS]. Concurrent callers share one request.
     */
    fun fetchStreetsForSettlement(
        remId: String,
        settlementId: String,
        siteUrl: String = DEFAULT_SITE_URL,
        forceRefresh: Boolean = false
    ): List<ZtoeStreetOption> {
        val sid = canonicalSettlementId(settlementId)
        val cached = cachedStreetsBySettlement[sid]
        if (cached != null && !bulkRefreshDue(sid, forceRefresh)) return cached
        return singleFlight(
            key = "bulk::$sid",
            fallback = { getStreetsForSettlement(sid) }
        ) {
            loadSettlementBulk(remId, sid, siteUrl)
        }
    }

    private fun loadSettlementBulk(remId: String, settlementId: String, siteUrl: String): List<ZtoeStreetOption> {
        val rem = getRems().firstOrNull { it.id == remId }
            ?: ZTOE_REM_OPTIONS.firstOrNull { it.id == remId }
            ?: return getStreetsForSettlement(settlementId)
        val settlement = findSettlementById(settlementId) ?: return getStreetsForSettlement(settlementId)

        val html = postZtoeForm("rem_id=${rem.ztoeRemId}&naspunkt_id=${settlement.ztoeNaspunktId}&all=1", siteUrl)
        if (!html.isNullOrBlank()) {
            val liveRems = parseZtoeRemOptionsHtml(html)
            if (liveRems.isNotEmpty()) {
                cachedRems = liveRems
            }
            val liveSettlements = parseZtoeSettlementOptionsHtml(remId, html)
            if (liveSettlements.isNotEmpty()) {
                cachedSettlementsByRem[remId] = liveSettlements
            }
            val liveStreets = parseZtoeStreetOptionsHtml(settlementId, html)
            if (liveStreets.isNotEmpty()) {
                registerStreets(settlementId, liveStreets)
                parseZtoeSettlementHousesTableHtml(settlementId, liveStreets, html)
                bulkFetchedAtBySettlement[settlementId] = System.currentTimeMillis()
                persistToDiskCache()
                return liveStreets
            }
        }
        return getStreetsForSettlement(settlementId)
    }

    /**
     * Houses of one (merged) street straight from the site: one request per ztoe id of the street,
     * results united and de-duplicated by [HouseKey]. Null when no request succeeded.
     * Note: all=1 is not passed here, because with all=1 ZTOE ignores vulica_id.
     */
    private fun fetchStreetHouseRows(
        rem: ZtoeRemOption,
        settlement: ZtoeSettlementOption,
        street: ZtoeStreetOption,
        siteUrl: String
    ): List<ZtoeHouseLookupResult>? {
        var anyResponse = false
        val map = LinkedHashMap<String, ZtoeHouseLookupResult>()
        for (vulicaId in street.ztoeVulicaIds) {
            val html = postZtoeForm(
                "rem_id=${rem.ztoeRemId}&naspunkt_id=${settlement.ztoeNaspunktId}&vulica_id=$vulicaId",
                siteUrl
            )
            if (html.isNullOrBlank()) continue
            anyResponse = true
            for (row in parseZtoeAddressLookupTableHtml(html)) putHouse(map, row)
        }
        return if (anyResponse) sortHouses(map.values) else null
    }

    fun fetchHousesForStreet(
        remId: String,
        settlementId: String,
        streetId: String,
        siteUrl: String = DEFAULT_SITE_URL,
        forceRefresh: Boolean = false
    ): List<ZtoeHouseLookupResult> {
        if (streetId.isBlank()) return emptyList()

        val street = findStreetById(streetId)
        val canonical = street?.id ?: streetId
        val sid = canonicalSettlementId(settlementId)

        fun fresh(): List<ZtoeHouseLookupResult>? {
            val cached = cachedHousesByStreet[canonical]
            if (cached.isNullOrEmpty()) return null
            val updatedAt = houseCacheUpdatedAtByStreet[canonical] ?: 0L
            val age = System.currentTimeMillis() - updatedAt
            return if (!forceRefresh || age in 0 until FRESH_HOUSE_CACHE_TTL_MS) cached else null
        }

        fresh()?.let {
            recordRecentHouseStreet(canonical)
            return it
        }
        // A bulk fetch of the settlement may be filling this street right now.
        awaitInFlight("bulk::$sid")
        fresh()?.let {
            recordRecentHouseStreet(canonical)
            return it
        }

        val rem = getRems().firstOrNull { it.id == remId } ?: ZTOE_REM_OPTIONS.firstOrNull { it.id == remId }
        val settlement = findSettlementById(sid)
        if (rem != null && settlement != null && street != null) {
            val rows = fetchStreetHouseRows(rem, settlement, street, siteUrl)
            if (!rows.isNullOrEmpty()) {
                storeStreetHouses(canonical, rows)
                persistToDiskCache()
                return rows
            }
        }
        return cachedHousesByStreet[canonical] ?: emptyList()
    }

    /**
     * Loads the REM list, the settlements of all REMs, the streets of the active and default city
     * and the houses of the saved street in the background, so the "?" lookup opens without delay.
     */
    fun prefetchAddressIndexInBackground(
        context: android.content.Context? = null,
        siteUrl: String = DEFAULT_SITE_URL,
        savedQuery: SelectedAddressQuery? = null,
        forceRefresh: Boolean = false
    ) {
        if (context != null) {
            initDiskCache(context)
        }

        val activeRemId = savedQuery?.remId?.ifBlank { "zhytomyr" } ?: "zhytomyr"
        val activeSettlementId = savedQuery?.settlementId?.ifBlank { "zt_city" } ?: "zt_city"

        // One bulk request indexes the REM list, the settlements of the REM, all streets and all houses of the city.
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

        // Bounded low-priority prefetch (2 daemon workers) of the remaining REMs' settlements and primary city streets.
        val remainingRems = java.util.concurrent.ConcurrentLinkedQueue(
            allRems.filter { it.id !in priorityRems }
        )
        if (remainingRems.isNotEmpty()) {
            val workerCount = minOf(2, remainingRems.size)
            val executor = Executors.newFixedThreadPool(workerCount) { r ->
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

    // ---------------------------------------------------------------------------------------------
    // Timestamp validation (used by settings and the main screen)
    // ---------------------------------------------------------------------------------------------

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

    // ---------------------------------------------------------------------------------------------
    // Queue lookup for the selected address
    // ---------------------------------------------------------------------------------------------

    fun checkAddressOnZtoeWebsite(
        remId: String,
        settlementId: String,
        streetId: String,
        house: String,
        siteUrl: String = DEFAULT_SITE_URL
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
     * Resolves the queue (or the "does not switch off" status) of the selected house from the ztoe
     * site. The live row is authoritative (A-H1: upstream queue changes propagate); the cached row is
     * used only when the site is unreachable or does not list the house. Emergencies are not looked up
     * here: [OutageRepository] asks PowerOnClient. The result's `emergencyOutage` is always null.
     */
    fun checkAddressOnZtoeWebsite(
        query: SelectedAddressQuery,
        siteUrl: String = DEFAULT_SITE_URL
    ): ZtoeHouseLookupResult? {
        val targetKey = HouseKey.of(query.house)
        if (targetKey.isEmpty()) return null

        val rem = getRems().firstOrNull { it.id == query.remId }
            ?: ZTOE_REM_OPTIONS.firstOrNull { it.id == query.remId }
        var settlement = findSettlementById(query.settlementId)
        var street = findStreetById(query.streetId)

        // After a restore without the index the names are unknown: reload the index once (one bulk request, shared and cached).
        if (rem != null && settlement != null && (street == null || street.nameUk.isBlank() || settlement.nameUk.isBlank())) {
            fetchStreetsForSettlement(query.remId, settlement.id, siteUrl, false)
            settlement = findSettlementById(query.settlementId) ?: settlement
            street = findStreetById(query.streetId) ?: street
        }

        val canonical = street?.id ?: query.streetId
        var resolved = cachedHousesByStreet[canonical]?.firstOrNull { HouseKey.of(it.house) == targetKey }

        if (rem != null && settlement != null && street != null) {
            val rows = fetchStreetHouseRows(rem, settlement, street, siteUrl)
            if (!rows.isNullOrEmpty()) {
                storeStreetHouses(canonical, rows)
                rows.firstOrNull { HouseKey.of(it.house) == targetKey }?.let { resolved = it }
            }
        }

        val base = resolved ?: return null
        val head = listOf(rem?.nameUk, settlement?.nameUk).filter { !it.isNullOrBlank() }.joinToString(", ")
        val streetPart = street?.nameUk?.takeIf { it.isNotBlank() }?.let { "$it, " } ?: ""
        val label = (if (head.isNotEmpty()) "$head,\n" else "") + streetPart + "буд. " + query.house.trim()
        return base.copy(emergencyOutage = null, addressLabel = label)
    }
}
