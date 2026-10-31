package ua.blackout.prewarning.data.repository

import android.content.Context
import org.json.JSONArray
import java.net.HttpURLConnection
import java.net.URL

data class DonationLink(
    val title: String,
    val url: String
)

object DonationsRepository {
    private const val PREFS_NAME = "blackout_donations_prefs"
    private const val KEY_CACHED_JSON = "cached_donations_json"
    private const val KEY_LAST_FETCH_MS = "last_fetch_ms"

    const val GITHUB_DONATIONS_URL =
        "https://raw.githubusercontent.com/IgorZaharov/Android-ZTBlackoutPreWarning/main/donations.json"

    // Re-read 1 time per day (24 hours)
    const val REFRESH_INTERVAL_MS = 24L * 60L * 60L * 1000L

    val DEFAULT_DONATIONS = listOf(
        DonationLink(
            title = "Допомога тваринам",
            url = "https://send.monobank.ua/jar/7vJA5xrLoV"
        ),
        DonationLink(
            title = "Фонд Повернись Живим",
            url = "https://savelife.in.ua/donate/"
        )
    )

    private fun parseDonationsJson(jsonStr: String): List<DonationLink>? {
        return try {
            val arr = JSONArray(jsonStr)
            val result = mutableListOf<DonationLink>()
            for (i in 0 until arr.length()) {
                val obj = arr.optJSONObject(i) ?: continue
                val title = obj.optString("title", "").trim()
                val url = obj.optString("url", "").trim()
                if (title.isNotEmpty() && url.startsWith("http")) {
                    result.add(DonationLink(title = title, url = url))
                }
            }
            if (result.isNotEmpty()) result else null
        } catch (_: Exception) {
            null
        }
    }

    fun getCachedDonations(context: Context): List<DonationLink> {
        val appContext = context.applicationContext
        val prefs = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val cachedStr = prefs.getString(KEY_CACHED_JSON, null)
        if (!cachedStr.isNullOrBlank()) {
            parseDonationsJson(cachedStr)?.let { return it }
        }
        return try {
            val assetStr = appContext.assets.open("donations.json").bufferedReader().use { it.readText() }
            parseDonationsJson(assetStr) ?: DEFAULT_DONATIONS
        } catch (_: Exception) {
            DEFAULT_DONATIONS
        }
    }

    fun getDonationsWithDailyRefresh(context: Context, nowMs: Long = System.currentTimeMillis()): List<DonationLink> {
        val appContext = context.applicationContext
        val prefs = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val lastFetchMs = prefs.getLong(KEY_LAST_FETCH_MS, 0L)
        val cached = getCachedDonations(appContext)

        if (lastFetchMs > 0L && (nowMs - lastFetchMs) < REFRESH_INTERVAL_MS) {
            return cached
        }

        var conn: HttpURLConnection? = null
        return try {
            conn = (URL(GITHUB_DONATIONS_URL).openConnection() as HttpURLConnection).apply {
                connectTimeout = 6000
                readTimeout = 6000
                requestMethod = "GET"
            }
            if (conn.responseCode in 200..299) {
                val responseText = conn.inputStream.bufferedReader().use { it.readText() }
                val parsed = parseDonationsJson(responseText)
                if (parsed != null) {
                    prefs.edit()
                        .putString(KEY_CACHED_JSON, responseText)
                        .putLong(KEY_LAST_FETCH_MS, nowMs)
                        .apply()
                    return parsed
                }
            }
            cached
        } catch (_: Exception) {
            cached
        } finally {
            conn?.disconnect()
        }
    }
}
