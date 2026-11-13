package ua.blackout.prewarning.data.repository

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject
import ua.blackout.prewarning.core.LedgerEntry
import ua.blackout.prewarning.core.Outage
import ua.blackout.prewarning.core.OutageKind
import ua.blackout.prewarning.core.SiteState
import ua.blackout.prewarning.data.poweron.PowerOnIds
import java.time.LocalDateTime

/** When the ztoe site was last checked and what was found. */
data class SiteSnapshot(
    val state: SiteState,
    val checkedAtMs: Long,
    val lastSuccessMs: Long?,
    /** The site's own notice ("УВАГА! ВАЖЛИВА ІНФОРМАЦІЯ!"), kept only while the page has no table. */
    val notice: String? = null
)

/** Whether the last PowerOn refresh worked. */
data class PowerOnSnapshot(val ok: Boolean, val checkedAtMs: Long, val lastOkMs: Long?)

/**
 * Small persistent state of the outage pipeline, kept apart from user settings so a long network
 * call can never overwrite a setting the user just changed. Layout: `spec/PERSISTENCE.md`.
 */
class OutageStateStore(context: Context) {
    private val prefs: SharedPreferences =
        context.applicationContext.getSharedPreferences("zt_outage_state_v1", Context.MODE_PRIVATE)

    // --- emergency ledger (per address) ---------------------------------------------------------

    fun ledger(addressKey: String): List<LedgerEntry> = readArray("ledger_$addressKey") { o ->
        LedgerEntry(
            id = o.getString("id"),
            start = LocalDateTime.parse(o.getString("start")),
            estimatedEnd = o.optStr("estimatedEnd")?.let(LocalDateTime::parse),
            label = o.optStr("label"),
            firstSeen = LocalDateTime.parse(o.getString("firstSeen")),
            lastSeen = LocalDateTime.parse(o.getString("lastSeen")),
            closedAt = o.optStr("closedAt")?.let(LocalDateTime::parse),
            startEmitted = o.optBoolean("startEmitted", true),
            endEmitted = o.optBoolean("endEmitted", false),
            lastEmittedEta = o.optStr("lastEmittedEta")?.let(LocalDateTime::parse)
        )
    }

    fun saveLedger(addressKey: String, entries: List<LedgerEntry>) {
        val key = "ledger_$addressKey"
        if (entries.isEmpty()) {
            prefs.edit().remove(key).apply()
            return
        }
        val arr = JSONArray()
        for (e in entries) {
            arr.put(
                JSONObject()
                    .put("id", e.id)
                    .put("start", e.start.toString())
                    .putOpt("estimatedEnd", e.estimatedEnd?.toString())
                    .putOpt("label", e.label)
                    .put("firstSeen", e.firstSeen.toString())
                    .put("lastSeen", e.lastSeen.toString())
                    .putOpt("closedAt", e.closedAt?.toString())
                    .put("startEmitted", e.startEmitted)
                    .put("endEmitted", e.endEmitted)
                    .putOpt("lastEmittedEta", e.lastEmittedEta?.toString())
            )
        }
        prefs.edit().putString(key, arr.toString()).apply()
    }

    // --- planned repair works from PowerOn (per address) -----------------------------------------

    fun repairs(addressKey: String): List<Outage> = readArray("repair_$addressKey") { o ->
        Outage(
            id = o.getString("id"),
            kind = OutageKind.REPAIR,
            start = LocalDateTime.parse(o.getString("start")),
            end = LocalDateTime.parse(o.getString("end")),
            label = o.optStr("label")
        )
    }

    fun saveRepairs(addressKey: String, outages: List<Outage>) {
        val key = "repair_$addressKey"
        if (outages.isEmpty()) {
            prefs.edit().remove(key).apply()
            return
        }
        val arr = JSONArray()
        for (o in outages) {
            arr.put(
                JSONObject().put("id", o.id).put("start", o.start.toString()).put("end", o.end.toString()).putOpt("label", o.label)
            )
        }
        prefs.edit().putString(key, arr.toString()).apply()
    }

    // --- resolved PowerOn ids (per address) -------------------------------------------------------

    fun ids(addressKey: String): Pair<PowerOnIds, Long>? {
        val raw = prefs.getString("ids_$addressKey", null) ?: return null
        return try {
            val o = JSONObject(raw)
            val cities = o.optJSONArray("cityIds") ?: JSONArray()
            val streets = o.optJSONArray("streetIds") ?: JSONArray()
            PowerOnIds((0 until cities.length()).map { cities.getInt(it) }, (0 until streets.length()).map { streets.getInt(it) }) to
                o.optLong("resolvedAtMs", 0L)
        } catch (_: Exception) {
            null
        }
    }

    fun saveIds(addressKey: String, ids: PowerOnIds, nowMs: Long) {
        val o = JSONObject()
            .put("cityIds", JSONArray(ids.cityIds))
            .put("streetIds", JSONArray(ids.streetIds))
            .put("resolvedAtMs", nowMs)
        prefs.edit().putString("ids_$addressKey", o.toString()).apply()
    }

    // --- site and source status -------------------------------------------------------------------

    fun site(): SiteSnapshot? {
        val name = prefs.getString("site_state", null) ?: return null
        val state = runCatching { SiteState.valueOf(name) }.getOrNull() ?: return null
        val success = prefs.getLong("site_last_success_ms", 0L).takeIf { it > 0L }
        val notice = prefs.getString("site_notice", null)?.takeIf { it.isNotBlank() && state == SiteState.AVAILABLE_NO_TABLE }
        return SiteSnapshot(state, prefs.getLong("site_checked_ms", 0L), success, notice)
    }

    fun saveSite(state: SiteState, nowMs: Long, notice: String? = null) {
        val editor = prefs.edit().putString("site_state", state.name).putLong("site_checked_ms", nowMs)
        // A notice only means something while the page has no table; any other state forgets it
        if (state == SiteState.AVAILABLE_NO_TABLE && !notice.isNullOrBlank()) {
            editor.putString("site_notice", notice)
        } else if (state != SiteState.SITE_UNREACHABLE && state != SiteState.NO_INTERNET) {
            editor.remove("site_notice")
        }
        if (state == SiteState.AVAILABLE_WITH_TABLE) editor.putLong("site_last_success_ms", nowMs)
        editor.apply()
    }

    fun poweron(): PowerOnSnapshot? {
        if (!prefs.contains("poweron_checked_ms")) return null
        return PowerOnSnapshot(
            ok = prefs.getBoolean("poweron_ok", false),
            checkedAtMs = prefs.getLong("poweron_checked_ms", 0L),
            lastOkMs = prefs.getLong("poweron_last_ok_ms", 0L).takeIf { it > 0L }
        )
    }

    fun savePowerOn(ok: Boolean, nowMs: Long) {
        val editor = prefs.edit().putBoolean("poweron_ok", ok).putLong("poweron_checked_ms", nowMs)
        if (ok) editor.putLong("poweron_last_ok_ms", nowMs)
        editor.apply()
    }

    /** Forgets everything (used by "reset to defaults"). */
    fun clearAll() {
        prefs.edit().clear().apply()
    }

    fun getSharedPreferences(): SharedPreferences = prefs

    // --- helpers --------------------------------------------------------------------------------

    private fun <T> readArray(key: String, map: (JSONObject) -> T): List<T> {
        val raw = prefs.getString(key, null) ?: return emptyList()
        return try {
            val arr = JSONArray(raw)
            (0 until arr.length()).mapNotNull { i -> runCatching { map(arr.getJSONObject(i)) }.getOrNull() }
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun JSONObject.optStr(key: String): String? = if (isNull(key)) null else getString(key).takeIf { it.isNotEmpty() }
}
