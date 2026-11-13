package ua.blackout.prewarning.data.repository

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject
import ua.blackout.prewarning.core.LegacySettings
import ua.blackout.prewarning.core.RepairResult
import ua.blackout.prewarning.core.StoreResult
import ua.blackout.prewarning.core.SubscriptionStore
import ua.blackout.prewarning.core.Subscriptions
import ua.blackout.prewarning.data.model.UserSettings
import ua.blackout.prewarning.data.parser.ZtoeAddressLookup
import java.security.SecureRandom

/**
 * Stores the multi-address subscriptions (`spec/SUBSCRIPTIONS.md`): the store as the JSON string
 * [KEY_STORE] and the kill switch [KEY_MASTER], both in the user settings file so they travel with a
 * device backup. The rules live in [Subscriptions]; this class only encodes, reads and writes.
 *
 * Step 1 of the feature: nothing calls this at runtime yet. The Settings UI (step 2) runs
 * [ensureMigrated] on start and then treats the store as the source of truth. Running the migration
 * earlier would freeze a copy of the 1.4.0 address that later settings changes would not update.
 */
class SubscriptionRepository(
    private val prefs: SharedPreferences,
    private val clock: () -> Long = System::currentTimeMillis,
    private val random: () -> String = ::randomId
) {
    constructor(context: Context) : this(
        context.applicationContext.getSharedPreferences(SETTINGS_PREFS, Context.MODE_PRIVATE)
    )

    companion object {
        const val SETTINGS_PREFS = "zt_user_settings_v1"
        const val KEY_STORE = "zt_subscriptions_v1"
        const val KEY_MASTER = "alerts_master_enabled"

        private val LOCK = Any()
        private val RNG = SecureRandom()
        private const val ID_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789"

        /** 8 random characters from `[a-z0-9]`. */
        fun randomId(): String = buildString { repeat(8) { append(ID_CHARS[RNG.nextInt(ID_CHARS.length)]) } }

        /** The 1.4.0 settings as migration input; [streetName] is resolved by the caller (see [resolveStreetName]). */
        fun legacyFrom(settings: UserSettings, streetName: String?): LegacySettings {
            val q = settings.selectedAddressQuery
            return LegacySettings(
                queue = settings.queue,
                customQueueStatusText = settings.customQueueStatusText,
                selectedAddress = settings.selectedAddress,
                remSlug = q?.remId.orEmpty(),
                settlementId = q?.settlementId.orEmpty(),
                streetId = q?.streetId.orEmpty(),
                streetName = streetName,
                house = q?.house.orEmpty(),
                notificationsEnabled = settings.notificationsEnabled,
                emergencyNotificationsEnabled = settings.emergencyNotificationsEnabled
            )
        }

        /** Same lookup as `OutageRepository.addressKey`, so the migrated address key matches 1.4.0. */
        fun resolveStreetName(streetId: String?): String? {
            if (streetId.isNullOrBlank()) return null
            return try {
                ZtoeAddressLookup.findStreetById(streetId)?.nameUk
            } catch (_: Exception) {
                null
            }
        }

        // -----------------------------------------------------------------------------------------
        // JSON <-> plain map. Written by hand because JSONObject(Map) drops null values in some
        // org.json versions and keeps them in others; the stored text must not depend on that.
        // -----------------------------------------------------------------------------------------

        fun encode(store: SubscriptionStore): String = (toJson(Subscriptions.toMap(store)) as JSONObject).toString()

        /** Returns null for missing, unreadable or non-version-1 text ("absent"). */
        fun decode(text: String?): SubscriptionStore? {
            if (text.isNullOrBlank()) return null
            val parsed = try {
                JSONObject(text)
            } catch (_: Exception) {
                return null
            }
            return Subscriptions.fromMap(fromJson(parsed) as Map<*, *>)
        }

        private fun toJson(v: Any?): Any = when (v) {
            null -> JSONObject.NULL
            is Map<*, *> -> JSONObject().also { o -> v.forEach { (k, x) -> o.put(k.toString(), toJson(x)) } }
            is List<*> -> JSONArray().also { a -> v.forEach { a.put(toJson(it)) } }
            else -> v
        }

        private fun fromJson(v: Any?): Any? = when (v) {
            null, JSONObject.NULL -> null
            is JSONObject -> v.keys().asSequence().associateWith { fromJson(v.opt(it)) }
            is JSONArray -> (0 until v.length()).map { fromJson(v.opt(it)) }
            is Int -> v.toLong()
            else -> v
        }
    }

    /** The repaired store, or null when it has never been written (or is unreadable): then migrate. */
    fun read(): RepairResult? = decode(prefs.getString(KEY_STORE, null))?.let { Subscriptions.repair(it) }

    fun store(): SubscriptionStore = read()?.store ?: SubscriptionStore.EMPTY

    fun alertsMaster(): Boolean = prefs.getBoolean(KEY_MASTER, true)

    fun setAlertsMaster(on: Boolean) {
        prefs.edit().putBoolean(KEY_MASTER, on).apply()
    }

    /**
     * Runs the one-time migration from the 1.4.0 settings when the store is absent and returns the
     * store in use. [legacy] is only evaluated when a migration is needed.
     */
    fun ensureMigrated(legacy: () -> LegacySettings): SubscriptionStore = synchronized(LOCK) {
        read()?.let { return it.store }
        val result = Subscriptions.migrate(legacy(), random(), clock())
        prefs.edit()
            .putString(KEY_STORE, encode(result.store))
            .putBoolean(KEY_MASTER, result.alertsMaster)
            .apply()
        result.store
    }

    /** Read-modify-write under one lock; writes only when [op] succeeds. */
    fun mutate(op: (SubscriptionStore) -> StoreResult): StoreResult = synchronized(LOCK) {
        val result = op(store())
        if (result is StoreResult.Ok) prefs.edit().putString(KEY_STORE, encode(result.store)).apply()
        result
    }

    /** A fresh id that no current item uses. */
    fun newItemId(): String {
        val used = store().items.map { it.id }.toSet()
        while (true) {
            val id = random()
            if (id !in used && Subscriptions.isValidId(id)) return id
        }
    }
}
