package ua.blackout.prewarning.data.repository

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.util.concurrent.ConcurrentHashMap

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
    const val GITHUB_PUBLIC_DONATIONS_URL =
        "https://raw.githubusercontent.com/IgorZaharov/Android-ZTBlackoutPreWarning/main/public/donations.json"

    // Re-read 1 time per day (24 hours) in addition to refreshing on every application start
    const val REFRESH_INTERVAL_MS = 24L * 60L * 60L * 1000L

    private val faviconMemoryCache = ConcurrentHashMap<String, Bitmap>()

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

    private fun fetchUrlText(
        endpoint: String,
        prefs: android.content.SharedPreferences? = null,
        cachedJsonFallback: String? = null
    ): String? {
        var conn: HttpURLConnection? = null
        val etagKey = "etag_${endpoint.hashCode()}"
        val lastModKey = "lastmod_${endpoint.hashCode()}"
        return try {
            conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                connectTimeout = 6000
                readTimeout = 6000
                useCaches = true
                requestMethod = "GET"
                setRequestProperty("Accept-Encoding", "gzip")
                if (prefs != null && !cachedJsonFallback.isNullOrBlank()) {
                    prefs.getString(etagKey, null)?.takeIf { it.isNotBlank() }?.let {
                        setRequestProperty("If-None-Match", it)
                    }
                    prefs.getString(lastModKey, null)?.takeIf { it.isNotBlank() }?.let {
                        setRequestProperty("If-Modified-Since", it)
                    }
                }
            }
            val code = conn.responseCode
            if (code == HttpURLConnection.HTTP_NOT_MODIFIED && !cachedJsonFallback.isNullOrBlank()) {
                return cachedJsonFallback
            }
            if (code in 200..299) {
                if (prefs != null) {
                    val editor = prefs.edit()
                    conn.getHeaderField("ETag")?.takeIf { it.isNotBlank() }?.let { editor.putString(etagKey, it) }
                    conn.getHeaderField("Last-Modified")?.takeIf { it.isNotBlank() }?.let { editor.putString(lastModKey, it) }
                    editor.apply()
                }
                val encoding = conn.contentEncoding?.lowercase() ?: ""
                val stream = if (encoding.contains("gzip")) {
                    java.util.zip.GZIPInputStream(conn.inputStream)
                } else {
                    conn.inputStream
                }
                stream.bufferedReader().use { it.readText() }
            } else {
                null
            }
        } catch (_: Exception) {
            null
        } finally {
            conn?.disconnect()
        }
    }

    fun getDonationsWithDailyRefresh(
        context: Context,
        nowMs: Long = System.currentTimeMillis(),
        forceRefresh: Boolean = false
    ): List<DonationLink> {
        val appContext = context.applicationContext
        val prefs = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val lastFetchMs = prefs.getLong(KEY_LAST_FETCH_MS, 0L)
        val cachedJsonStr = prefs.getString(KEY_CACHED_JSON, null)
        val cached = getCachedDonations(appContext)

        if (!forceRefresh && lastFetchMs > 0L && (nowMs - lastFetchMs) < REFRESH_INTERVAL_MS) {
            return cached
        }

        // Fetch primary GitHub URL first; only query fallback URL if primary failed or returned empty
        val rootText = fetchUrlText(GITHUB_DONATIONS_URL, prefs, cachedJsonStr)
        val rootParsed = if (!rootText.isNullOrBlank()) parseDonationsJson(rootText) else null

        val finalItems = if (!rootParsed.isNullOrEmpty()) {
            rootParsed
        } else {
            val publicText = fetchUrlText(GITHUB_PUBLIC_DONATIONS_URL, prefs, cachedJsonStr)
            if (!publicText.isNullOrBlank()) parseDonationsJson(publicText) else null
        }

        if (!finalItems.isNullOrEmpty()) {
            val serialized = JSONArray().apply {
                finalItems.forEach { item ->
                    put(JSONObject().apply {
                        put("title", item.title)
                        put("url", item.url)
                    })
                }
            }.toString()
            prefs.edit()
                .putString(KEY_CACHED_JSON, serialized)
                .putLong(KEY_LAST_FETCH_MS, nowMs)
                .apply()
            return finalItems
        }

        return cached
    }

    fun getFaviconCandidateUrls(pageUrl: String): List<String> {
        val host = try {
            URI(pageUrl.trim()).host?.lowercase()?.removePrefix("www.") ?: ""
        } catch (_: Exception) {
            ""
        }
        if (host.isEmpty()) return emptyList()

        val parts = host.split(".")
        val twoPartTlds = setOf("in.ua", "com.ua", "org.ua", "gov.ua", "net.ua", "edu.ua", "co.uk", "org.uk")
        val lastTwo = if (parts.size >= 2) "${parts[parts.size - 2]}.${parts.last()}" else host
        val rootDomain = when {
            parts.size <= 2 -> host
            twoPartTlds.contains(lastTwo) && parts.size >= 3 ->
                "${parts[parts.size - 3]}.$lastTwo"
            else -> lastTwo
        }

        val candidates = mutableListOf<String>()
        candidates.add("https://www.google.com/s2/favicons?sz=64&domain=$rootDomain")
        if (rootDomain != host) {
            candidates.add("https://www.google.com/s2/favicons?sz=64&domain=$host")
        }
        candidates.add("https://icons.duckduckgo.com/ip3/$host.ico")
        if (rootDomain != host) {
            candidates.add("https://icons.duckduckgo.com/ip3/$rootDomain.ico")
        }
        candidates.add("https://$host/favicon.ico")
        return candidates.distinct()
    }

    fun fetchFaviconBitmap(context: Context, pageUrl: String): Bitmap? {
        val candidates = getFaviconCandidateUrls(pageUrl)
        if (candidates.isEmpty()) return null

        val cacheKey = pageUrl.trim().lowercase()
        faviconMemoryCache[cacheKey]?.let { return it }

        val appContext = context.applicationContext
        val cacheFile = File(appContext.cacheDir, "favicon_${cacheKey.hashCode()}.png")
        if (cacheFile.exists() && cacheFile.length() > 64) {
            try {
                BitmapFactory.decodeFile(cacheFile.absolutePath)?.let { bmp ->
                    faviconMemoryCache[cacheKey] = bmp
                    return bmp
                }
            } catch (_: Exception) {}
        }

        for (faviconUrl in candidates) {
            var conn: HttpURLConnection? = null
            try {
                conn = (URL(faviconUrl).openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    instanceFollowRedirects = true
                    connectTimeout = 6000
                    readTimeout = 6000
                    setRequestProperty("User-Agent", "Mozilla/5.0 (Android; ZTBlackoutPreWarning)")
                }
                if (conn.responseCode in 200..299) {
                    val bytes = conn.inputStream.use { it.readBytes() }
                    if (bytes.size > 64) {
                        val bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                        if (bmp != null && bmp.width > 0 && bmp.height > 0) {
                            faviconMemoryCache[cacheKey] = bmp
                            try {
                                FileOutputStream(cacheFile).use { out ->
                                    bmp.compress(Bitmap.CompressFormat.PNG, 100, out)
                                }
                            } catch (_: Exception) {}
                            return bmp
                        }
                    }
                }
            } catch (_: Exception) {
                // Try next candidate
            } finally {
                conn?.disconnect()
            }
        }
        return null
    }
}
