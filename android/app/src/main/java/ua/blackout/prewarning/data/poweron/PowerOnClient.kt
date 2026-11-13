package ua.blackout.prewarning.data.poweron

import org.json.JSONArray
import org.json.JSONObject
import ua.blackout.prewarning.core.EmergencyFetch
import ua.blackout.prewarning.core.HouseKey
import ua.blackout.prewarning.core.Outage
import ua.blackout.prewarning.core.PowerOnMapper
import ua.blackout.prewarning.core.PowerOnRow
import ua.blackout.prewarning.core.StreetKey
import ua.blackout.prewarning.core.TextNorm
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.time.LocalDate
import java.time.LocalDateTime

/** The only network seam of the PowerOn client, so tests can replace it. */
fun interface HttpGet {
    @Throws(IOException::class)
    fun get(url: String): String
}

class UrlConnectionHttpGet(
    private val connectTimeoutMs: Int = 8_000,
    private val readTimeoutMs: Int = 8_000
) : HttpGet {
    override fun get(url: String): String {
        val conn = URL(url).openConnection() as HttpURLConnection
        try {
            conn.requestMethod = "GET"
            conn.connectTimeout = connectTimeoutMs
            conn.readTimeout = readTimeoutMs
            conn.setRequestProperty("Accept", "application/json")
            conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Android; ZTBlackoutPreWarning)")
            val code = conn.responseCode
            if (code !in 200..299) throw IOException("HTTP $code")
            return conn.inputStream.use { String(it.readBytes(), Charsets.UTF_8) }
        } finally {
            conn.disconnect()
        }
    }
}

/** What identifies the address on PowerOn. Names come from ztoe; ids are cached after the first resolution. */
data class PowerOnTarget(
    val remOtgId: Int?,
    val settlementName: String,
    /** Names of every ztoe street option merged into the selected street (duplicates keep all names). */
    val streetNames: List<String>,
    val house: String,
    val cachedCityIds: List<Int> = emptyList(),
    val cachedStreetIds: List<Int> = emptyList()
)

data class PowerOnIds(val cityIds: List<Int>, val streetIds: List<Int>)

/**
 * Outcome of one PowerOn refresh for an address. [repairs] is null when the planned-works request
 * failed (keep what was known); [emergency] is Unavailable when the accidents request failed.
 */
data class PowerOnResult(
    val emergency: EmergencyFetch,
    val repairs: List<Outage>?,
    val ids: PowerOnIds?
)

/**
 * Per-address PowerOn queries. Everything here follows `spec/POWERON_API.md`:
 *  - only the dotted filters work (`street.id[]`, `city.id`, `otg.id`); `street=`, `otg=` are ignored by the server,
 *  - `pagination=false` is required (default page size is 30 of thousands of rows),
 *  - timestamps are Kyiv wall-clock despite the `+00:00` label (handled in [PowerOnMapper.parseTime]),
 *  - a failed request is Unavailable, never "no outage".
 */
class PowerOnClient(private val http: HttpGet = UrlConnectionHttpGet()) {

    companion object {
        const val BASE_URL = "https://api-ztoe-poweron.inneti.net/api"
        const val IDS_TTL_MS = 7L * 24 * 60 * 60 * 1000
        private val CITY_PREFIX = Regex("^(?:м\\.|місто|с\\.|село|смт\\.?|селище)\\s*", RegexOption.IGNORE_CASE)
        private val PARENS = Regex("\\([^)]*\\)")
        private const val EMERGENCY_REASONS = "switchSubReason[]=0&switchSubReason[]=1&switchSubReason[]=3"

        fun cityKey(raw: String): String {
            var s = TextNorm.decodeEntities(raw).lowercase()
            s = PARENS.replace(s, " ")
            s = CITY_PREFIX.replace(s.trim(), "")
            s = s.filter { TextNorm.APOSTROPHES.indexOf(it) < 0 }
            return s.replace(Regex("\\s+"), " ").trim()
        }

        /** Plain array (Accept: application/json) or a hydra collection, both accepted. */
        fun toArray(json: String): JSONArray {
            val trimmed = json.trim()
            return when {
                trimmed.startsWith("[") -> JSONArray(trimmed)
                trimmed.startsWith("{") -> JSONObject(trimmed).optJSONArray("hydra:member") ?: JSONArray()
                else -> JSONArray()
            }
        }

        fun parseRows(json: String): List<PowerOnRow> {
            val arr = toArray(json)
            val rows = ArrayList<PowerOnRow>(arr.length())
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                val city = o.optJSONObject("city")
                val street = o.optJSONObject("street")
                rows.add(
                    PowerOnRow(
                        id = o.optLong("id", 0L),
                        cityId = city?.takeIf { it.has("id") }?.optInt("id"),
                        cityName = city?.optString("name", "") ?: "",
                        streetId = street?.takeIf { it.has("id") }?.optInt("id"),
                        streetName = street?.optString("name", "") ?: "",
                        dateEvent = o.optString("dateEvent", ""),
                        datePlanIn = o.optString("datePlanIn", ""),
                        koment = if (o.isNull("koment")) null else o.optString("koment"),
                        switchSubReason = if (o.has("switchSubReason") && !o.isNull("switchSubReason")) o.optInt("switchSubReason") else null,
                        typeOff = if (o.has("typeOff") && !o.isNull("typeOff")) o.optInt("typeOff") else null,
                        buildingNames = o.optString("buildingNames", "")
                    )
                )
            }
            return rows
        }

        private fun enc(s: String): String = URLEncoder.encode(s, "UTF-8")
    }

    /** City ids by exact name (inside the REM when known), then street ids by canonical street key. */
    fun resolveIds(target: PowerOnTarget): PowerOnIds {
        val wanted = cityKey(target.settlementName)
        val byRem = target.remOtgId?.let { "&otg.id=$it" } ?: ""
        val cityRows = fetchCities(wanted, target.settlementName, byRem)
        val cityIds = cityRows.map { it.first }.distinct()
        if (cityIds.isEmpty()) return PowerOnIds(emptyList(), emptyList())

        val streetKeys = target.streetNames.map { StreetKey.of(it) }.toSet()
        val streetIds = LinkedHashSet<Int>()
        for (cityId in cityIds) {
            val body = http.get("$BASE_URL/pw_streets?city.id=$cityId&pagination=false")
            val arr = toArray(body)
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                if (StreetKey.of(o.optString("name", "")) in streetKeys) streetIds.add(o.optInt("id"))
            }
        }
        return PowerOnIds(cityIds, streetIds.toList())
    }

    private fun fetchCities(wantedKey: String, rawName: String, byRem: String): List<Pair<Int, String>> {
        fun query(extra: String): List<Pair<Int, String>> {
            val bare = CITY_PREFIX.replace(TextNorm.decodeEntities(rawName).trim(), "").trim()
            val body = http.get("$BASE_URL/pw_cities?name=${enc(bare)}$extra&pagination=false")
            val arr = toArray(body)
            val out = ArrayList<Pair<Int, String>>()
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                val name = o.optString("name", "")
                if (cityKey(name) == wantedKey) out.add(o.optInt("id") to name)
            }
            return out
        }
        val inRem = if (byRem.isNotEmpty()) query(byRem) else emptyList()
        return inRem.ifEmpty { query("") }
    }

    /**
     * Fetches emergencies and planned works for the address. Resolution order for the query scope:
     * street ids, then city ids (rows filtered by street key), then the REM (filtered by city and street).
     */
    fun fetch(target: PowerOnTarget, today: LocalDate, now: LocalDateTime): PowerOnResult {
        var ids: PowerOnIds? = if (target.cachedStreetIds.isNotEmpty() || target.cachedCityIds.isNotEmpty()) {
            PowerOnIds(target.cachedCityIds, target.cachedStreetIds)
        } else {
            null
        }
        try {
            if (ids == null) ids = resolveIds(target)
        } catch (e: Exception) {
            return PowerOnResult(EmergencyFetch.Unavailable("resolve: ${e.message}"), null, null)
        }

        val scope: String
        var streetFilter: Set<String>? = null
        var cityFilter: String? = null
        when {
            ids.streetIds.isNotEmpty() -> scope = ids.streetIds.joinToString("&") { "street.id[]=$it" }
            ids.cityIds.isNotEmpty() -> {
                scope = ids.cityIds.joinToString("&") { "city.id[]=$it" }
                streetFilter = target.streetNames.map { StreetKey.of(it) }.toSet()
            }
            target.remOtgId != null -> {
                scope = "otg.id=${target.remOtgId}"
                streetFilter = target.streetNames.map { StreetKey.of(it) }.toSet()
                cityFilter = cityKey(target.settlementName)
            }
            else -> return PowerOnResult(EmergencyFetch.Unavailable("no scope"), null, ids)
        }

        fun filtered(rows: List<PowerOnRow>): List<PowerOnRow> = rows.filter { r ->
            (streetFilter == null || StreetKey.of(r.streetName) in streetFilter) &&
                (cityFilter == null || cityKey(r.cityName) == cityFilter)
        }

        val emergency: EmergencyFetch = try {
            val rows = filtered(parseRows(http.get("$BASE_URL/pw_accidents?$scope&$EMERGENCY_REASONS&pagination=false")))
            val limit = today.plusDays(2).atStartOfDay()
            val records = PowerOnMapper.emergencyRecordsFor(rows, target.house).filter { it.start.isBefore(limit) }
            EmergencyFetch.Confirmed(records)
        } catch (e: Exception) {
            EmergencyFetch.Unavailable("accidents: ${e.message}")
        }

        val repairs: List<Outage>? = try {
            val rows = filtered(parseRows(http.get("$BASE_URL/pw_accident_planeds?$scope&datePlanIn[after]=$today&pagination=false")))
            PowerOnMapper.repairOutagesFor(rows, target.house, today)
        } catch (_: Exception) {
            null
        }
        return PowerOnResult(emergency, repairs, ids)
    }
}
