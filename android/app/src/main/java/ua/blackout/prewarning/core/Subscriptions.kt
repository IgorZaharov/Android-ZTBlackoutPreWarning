package ua.blackout.prewarning.core

/**
 * Multi-address subscriptions: the stored model, its repair rules, the store operations, the
 * migration from single-address settings, the primary mirror and the alert grouping. Specified in `spec/SUBSCRIPTIONS.md`, golden cases in
 * `spec/vectors/subscriptions.json`, mirrored in `src/core/subscriptions.ts`.
 *
 * The model is exchanged as plain maps (`toMap` / `fromMap`) so this package needs no JSON library;
 * the platform encodes the map as a string.
 */

enum class QueueSource { LOOKUP, MANUAL }

data class SubscriptionAddress(
    val remSlug: String,
    val settlementId: String,
    val streetId: String,
    /** Display name resolved from [streetId] when the address was stored; may be empty. */
    val streetName: String,
    val house: String,
    /** Full human readable line (1.4.0 `selected_address`); may be empty. */
    val text: String
) {
    val isValid: Boolean
        get() = remSlug.isNotBlank() && settlementId.isNotBlank() && streetId.isNotBlank() && house.isNotBlank()

    /** The 1.4.0 address key of `ledger_*`, `repair_*`, `ids_*` and emergency alert keys. */
    val key: String
        get() = "$settlementId|${StreetKey.of(streetName.ifBlank { streetId })}|${HouseKey.of(house)}"
}

data class Subscription(
    val id: String,
    /** Cleaned user label; empty = automatic (see [Subscriptions.displayLabel]). */
    val label: String = "",
    val address: SubscriptionAddress? = null,
    val queue: String? = null,
    val queueSource: QueueSource = QueueSource.MANUAL,
    val queueStatusText: String? = null,
    val plannedAlerts: Boolean = true,
    val emergencyAlerts: Boolean = true,
    val createdAtMs: Long = 0L
) {
    /** `a:<address key>` or `q:<queue>`; two items with one identity are duplicates. */
    val identity: String
        get() = address?.let { "a:${it.key}" } ?: "q:${queue.orEmpty()}"
}

data class SubscriptionStore(
    val primaryId: String? = null,
    val items: List<Subscription> = emptyList()
) {
    val primary: Subscription? get() = items.firstOrNull { it.id == primaryId }

    companion object {
        val EMPTY = SubscriptionStore()
    }
}

/** 1.4.0 single-address settings, plus the street name the platform resolved for [streetId]. */
data class LegacySettings(
    val queue: String,
    val customQueueStatusText: String?,
    val selectedAddress: String?,
    val remSlug: String,
    val settlementId: String,
    val streetId: String,
    val streetName: String?,
    val house: String,
    val notificationsEnabled: Boolean,
    val emergencyNotificationsEnabled: Boolean
)

data class MigrationResult(val store: SubscriptionStore, val alertsMaster: Boolean)

/** Values for the single-address keys, written from the primary item (`spec/SUBSCRIPTIONS.md` section 7). */
data class LegacyMirror(
    val queue: String,
    val customQueueStatusText: String?,
    val selectedAddress: String?,
    val remSlug: String,
    val settlementId: String,
    val streetId: String,
    val house: String,
    val notificationsEnabled: Boolean,
    val emergencyNotificationsEnabled: Boolean
)

data class DroppedItem(val id: String?, val reason: String)

data class RepairResult(val store: SubscriptionStore, val dropped: List<DroppedItem>)

/** Either the new store or an error code from `spec/SUBSCRIPTIONS.md` section 4. */
sealed class StoreResult {
    data class Ok(val store: SubscriptionStore) : StoreResult()
    data class Error(val code: String, val existingId: String? = null) : StoreResult()
}

object Subscriptions {
    const val SCHEMA_VERSION = 1
    const val MAX_ITEMS = 5
    const val MAX_LABEL_LENGTH = 40

    const val ERR_INVALID = "invalid"
    const val ERR_DUPLICATE_ID = "duplicate_id"
    const val ERR_DUPLICATE = "duplicate"
    const val ERR_LIMIT = "limit_reached"
    const val ERR_NOT_FOUND = "not_found"

    private val ID = Regex("^[a-z0-9]{4,32}$")
    private val QUEUE = Regex("^[1-6]\\.[12]$")
    private val SPACES = Regex("[ \\t\\n\\u000B\\f\\r\\u00A0\\u200B]+")

    fun isValidId(id: String?): Boolean = id != null && ID.matches(id)
    fun isValidQueue(queue: String?): Boolean = queue != null && QUEUE.matches(queue)

    private fun collapse(raw: String): String = SPACES.replace(raw, " ").trim(' ')

    // ---------------------------------------------------------------------------------------------
    // Labels
    // ---------------------------------------------------------------------------------------------

    fun cleanLabel(raw: String?): String {
        val s = collapse(raw.orEmpty())
        if (s.length <= MAX_LABEL_LENGTH) return s
        var end = MAX_LABEL_LENGTH
        if (Character.isHighSurrogate(s[end - 1])) end--
        return s.substring(0, end)
    }

    fun defaultLabel(item: Subscription): String {
        val a = item.address ?: return "Черга ${item.queue.orEmpty()}"
        val house = collapse(a.house)
        val street = collapse(TextNorm.decodeEntities(a.streetName))
        if (street.isEmpty()) return "буд. $house"
        val tokens = street.split(' ')
        val core = if (tokens.size > 1 && StreetKey.isTypeWord(tokens[0])) tokens.drop(1) else tokens
        return "${core.joinToString(" ")} $house"
    }

    fun displayLabel(item: Subscription): String = item.label.ifEmpty { defaultLabel(item) }

    // ---------------------------------------------------------------------------------------------
    // Maps
    // ---------------------------------------------------------------------------------------------

    fun toMap(store: SubscriptionStore): Map<String, Any?> = linkedMapOf(
        "schemaVersion" to SCHEMA_VERSION,
        "primaryId" to store.primaryId,
        "items" to store.items.map { itemToMap(it) }
    )

    fun itemToMap(item: Subscription): Map<String, Any?> = linkedMapOf(
        "id" to item.id,
        "label" to item.label,
        "address" to item.address?.let {
            linkedMapOf(
                "remSlug" to it.remSlug,
                "settlementId" to it.settlementId,
                "streetId" to it.streetId,
                "streetName" to it.streetName,
                "house" to it.house,
                "text" to it.text
            )
        },
        "queue" to item.queue,
        "queueSource" to item.queueSource.name,
        "queueStatusText" to item.queueStatusText,
        "plannedAlerts" to item.plannedAlerts,
        "emergencyAlerts" to item.emergencyAlerts,
        "createdAtMs" to item.createdAtMs
    )

    /**
     * Lenient read: wrong types read as missing, nothing throws. Returns null ("absent") when the map
     * is not a version-1 store, so the caller migrates again from the legacy keys. Call [repair] on
     * the result before use.
     */
    fun fromMap(map: Map<*, *>?): SubscriptionStore? {
        map ?: return null
        val version = (map["schemaVersion"] as? Number)?.toInt() ?: return null
        if (version != SCHEMA_VERSION) return null
        val items = (map["items"] as? List<*>).orEmpty().mapNotNull { (it as? Map<*, *>)?.let(::itemFromMap) }
        return SubscriptionStore(primaryId = map["primaryId"] as? String, items = items)
    }

    fun itemFromMap(m: Map<*, *>): Subscription {
        val a = m["address"] as? Map<*, *>
        return Subscription(
            id = m["id"] as? String ?: "",
            label = m["label"] as? String ?: "",
            address = a?.let {
                SubscriptionAddress(
                    remSlug = it["remSlug"] as? String ?: "",
                    settlementId = it["settlementId"] as? String ?: "",
                    streetId = it["streetId"] as? String ?: "",
                    streetName = it["streetName"] as? String ?: "",
                    house = it["house"] as? String ?: "",
                    text = it["text"] as? String ?: ""
                )
            },
            queue = m["queue"] as? String,
            queueSource = if (m["queueSource"] == QueueSource.LOOKUP.name) QueueSource.LOOKUP else QueueSource.MANUAL,
            queueStatusText = m["queueStatusText"] as? String,
            plannedAlerts = m["plannedAlerts"] as? Boolean ?: true,
            emergencyAlerts = m["emergencyAlerts"] as? Boolean ?: true,
            createdAtMs = (m["createdAtMs"] as? Number)?.toLong() ?: 0L
        )
    }

    // ---------------------------------------------------------------------------------------------
    // Repair
    // ---------------------------------------------------------------------------------------------

    /** Repair step 2: invalid queue or address -> null, label cleaned. */
    fun normalize(item: Subscription): Subscription = item.copy(
        label = cleanLabel(item.label),
        address = item.address?.takeIf { it.isValid },
        queue = item.queue?.takeIf { isValidQueue(it) }
    )

    fun repair(store: SubscriptionStore): RepairResult {
        val dropped = ArrayList<DroppedItem>()
        var items = store.items.filter { ok -> isValidId(ok.id).also { if (!it) dropped += DroppedItem(ok.id, "invalid_id") } }
        items = items.map(::normalize)
        items = items.filter { ok -> (ok.address != null || ok.queue != null).also { if (!it) dropped += DroppedItem(ok.id, "empty") } }
        val ids = HashSet<String>()
        items = items.filter { ok -> ids.add(ok.id).also { if (!it) dropped += DroppedItem(ok.id, "duplicate_id") } }
        val identities = HashSet<String>()
        items = items.filter { ok -> identities.add(ok.identity).also { if (!it) dropped += DroppedItem(ok.id, "duplicate_address") } }
        if (items.size > MAX_ITEMS) {
            items.drop(MAX_ITEMS).forEach { dropped += DroppedItem(it.id, "over_limit") }
            items = items.take(MAX_ITEMS)
        }
        val primaryId = store.primaryId?.takeIf { p -> items.any { it.id == p } } ?: items.firstOrNull()?.id
        return RepairResult(SubscriptionStore(primaryId, items), dropped)
    }

    // ---------------------------------------------------------------------------------------------
    // Operations
    // ---------------------------------------------------------------------------------------------

    fun add(store: SubscriptionStore, candidate: Subscription): StoreResult {
        if (!isValidId(candidate.id)) return StoreResult.Error(ERR_INVALID)
        val item = normalize(candidate)
        if (item.address == null && item.queue == null) return StoreResult.Error(ERR_INVALID)
        if (store.items.any { it.id == item.id }) return StoreResult.Error(ERR_DUPLICATE_ID)
        store.items.firstOrNull { it.identity == item.identity }?.let { return StoreResult.Error(ERR_DUPLICATE, it.id) }
        if (store.items.size >= MAX_ITEMS) return StoreResult.Error(ERR_LIMIT)
        return StoreResult.Ok(SubscriptionStore(store.primaryId ?: item.id, store.items + item))
    }

    fun remove(store: SubscriptionStore, id: String): StoreResult {
        if (store.items.none { it.id == id }) return StoreResult.Error(ERR_NOT_FOUND)
        val rest = store.items.filter { it.id != id }
        val primaryId = if (store.primaryId != id && rest.any { it.id == store.primaryId }) {
            store.primaryId
        } else {
            // minByOrNull keeps the first of equal values, which is the list-order tie rule
            rest.minByOrNull { it.createdAtMs }?.id
        }
        return StoreResult.Ok(SubscriptionStore(primaryId, rest))
    }

    fun setPrimary(store: SubscriptionStore, id: String): StoreResult =
        if (store.items.none { it.id == id }) StoreResult.Error(ERR_NOT_FOUND) else StoreResult.Ok(store.copy(primaryId = id))

    fun setPlanned(store: SubscriptionStore, id: String, on: Boolean): StoreResult = update(store, id) { it.copy(plannedAlerts = on) }

    fun setEmergency(store: SubscriptionStore, id: String, on: Boolean): StoreResult = update(store, id) { it.copy(emergencyAlerts = on) }

    fun rename(store: SubscriptionStore, id: String, raw: String?): StoreResult = update(store, id) { it.copy(label = cleanLabel(raw)) }

    /** Result of a ZTOE lookup for an address item (`spec/SUBSCRIPTIONS.md` section 4). */
    fun setQueueInfo(store: SubscriptionStore, id: String, queue: String?, statusText: String?, addressText: String?): StoreResult {
        val item = store.items.firstOrNull { it.id == id } ?: return StoreResult.Error(ERR_NOT_FOUND)
        val address = item.address ?: return StoreResult.Error(ERR_INVALID)
        return update(store, id) {
            it.copy(
                queue = queue?.takeIf { q -> isValidQueue(q) },
                queueStatusText = statusText?.takeIf { s -> s.isNotBlank() },
                address = if (addressText.isNullOrBlank()) address else address.copy(text = addressText)
            )
        }
    }

    private inline fun update(store: SubscriptionStore, id: String, change: (Subscription) -> Subscription): StoreResult {
        if (store.items.none { it.id == id }) return StoreResult.Error(ERR_NOT_FOUND)
        return StoreResult.Ok(store.copy(items = store.items.map { if (it.id == id) change(it) else it }))
    }

    // ---------------------------------------------------------------------------------------------
    // Effective switches
    // ---------------------------------------------------------------------------------------------

    fun plannedActive(master: Boolean, item: Subscription): Boolean = master && item.plannedAlerts && item.queue != null

    fun emergencyActive(master: Boolean, item: Subscription, poweronIdsKnown: Boolean): Boolean =
        master && item.emergencyAlerts && item.address != null && poweronIdsKnown

    fun anyAlertsEnabled(master: Boolean, store: SubscriptionStore): Boolean =
        master && store.items.any { it.plannedAlerts || it.emergencyAlerts }

    // ---------------------------------------------------------------------------------------------
    // Mirror of the primary item into the single-address keys (section 7)
    // ---------------------------------------------------------------------------------------------

    fun primaryMirror(store: SubscriptionStore, master: Boolean): LegacyMirror {
        val p = store.primary
        val a = p?.address
        return LegacyMirror(
            queue = p?.queue.orEmpty(),
            customQueueStatusText = p?.queueStatusText,
            selectedAddress = if (p != null && a != null) a.text.ifEmpty { displayLabel(p) } else null,
            remSlug = a?.remSlug.orEmpty(),
            settlementId = a?.settlementId.orEmpty(),
            streetId = a?.streetId.orEmpty(),
            house = a?.house.orEmpty(),
            notificationsEnabled = master && (p?.plannedAlerts ?: true),
            emergencyNotificationsEnabled = master && (p?.emergencyAlerts ?: true)
        )
    }

    // ---------------------------------------------------------------------------------------------
    // Migration
    // ---------------------------------------------------------------------------------------------

    fun migrate(legacy: LegacySettings, newId: String, nowMs: Long): MigrationResult {
        val queue = legacy.queue.takeIf { isValidQueue(it) }
        val address = SubscriptionAddress(
            remSlug = legacy.remSlug,
            settlementId = legacy.settlementId,
            streetId = legacy.streetId,
            streetName = legacy.streetName.orEmpty(),
            house = legacy.house,
            text = legacy.selectedAddress.orEmpty()
        )
        val item = when {
            address.isValid -> Subscription(
                id = newId,
                address = address,
                queue = queue,
                queueSource = QueueSource.LOOKUP,
                queueStatusText = legacy.customQueueStatusText?.takeIf { it.isNotBlank() },
                createdAtMs = nowMs
            )
            queue != null -> Subscription(id = newId, queue = queue, queueSource = QueueSource.MANUAL, createdAtMs = nowMs)
            else -> null
        }?.copy(
            plannedAlerts = legacy.notificationsEnabled,
            emergencyAlerts = legacy.emergencyNotificationsEnabled
        )
        val store = if (item == null) SubscriptionStore.EMPTY else SubscriptionStore(item.id, listOf(item))
        return MigrationResult(store, legacy.notificationsEnabled || legacy.emergencyNotificationsEnabled)
    }

    // ---------------------------------------------------------------------------------------------
    // Alerts for every item (section 8)
    // ---------------------------------------------------------------------------------------------

    /** The primary first, then the other items by `createdAtMs`, list order on ties. */
    fun alertOrder(store: SubscriptionStore): List<Subscription> {
        val primary = store.primary
        val rest = store.items.withIndex()
            .filter { it.value.id != primary?.id }
            .sortedWith(compareBy<IndexedValue<Subscription>> { it.value.createdAtMs }.thenBy { it.index })
            .map { it.value }
        return listOfNotNull(primary) + rest
    }

    /** One planned alert per (queue, span start, span end) over every `plannedActive` item (8.1). */
    fun groupAlerts(store: SubscriptionStore, master: Boolean, alertsById: Map<String, List<AlertSpec>>): List<PlannedGroup> {
        data class Acc(val queue: String, val first: AlertSpec, var mayContinue: Boolean, val members: LinkedHashSet<String>)
        val groups = LinkedHashMap<String, Acc>()
        for (item in alertOrder(store)) {
            if (!plannedActive(master, item)) continue
            val queue = item.queue ?: continue
            val alerts = alertsById[item.id] ?: continue
            for (a in alerts) {
                val key = "planned_q${queue}_${a.spanStart}_${a.spanEnd}"
                val acc = groups.getOrPut(key) { Acc(queue, a, false, LinkedHashSet()) }
                acc.mayContinue = acc.mayContinue || a.mayContinue
                acc.members.add(item.id)
            }
        }
        return groups.map { (key, g) ->
            PlannedGroup(
                key = key,
                queue = g.queue,
                fireAt = g.first.fireAt,
                spanStart = g.first.spanStart,
                spanEnd = g.first.spanEnd,
                mayContinue = g.mayContinue,
                durationMinutes = g.first.durationMinutes,
                memberIds = g.members.toList()
            )
        }.sortedWith(compareBy<PlannedGroup> { it.fireAt }.thenBy { it.spanStart }.thenBy { it.key })
    }

    /** Fired-registry key of one item for one span (8.2). */
    fun memberKey(id: String, spanStart: java.time.LocalDateTime): String = "planned_${id}_$spanStart"

    /** The address-independent key 1.4.0 recorded; it counts for every item. */
    fun legacyAlertKey(spanStart: java.time.LocalDateTime): String = "planned_$spanStart"

    fun pendingMembers(group: PlannedGroup, notified: (String) -> Boolean): List<String> =
        group.memberIds.filter { !notified(memberKey(it, group.spanStart)) && !notified(legacyAlertKey(group.spanStart)) }

    /** Labels that open the planned text, or null when the store has at most one item (8.3). */
    fun alertLabels(store: SubscriptionStore, memberIds: List<String>): String? {
        if (store.items.size <= 1 || memberIds.isEmpty()) return null
        val labels = memberIds.mapNotNull { id -> store.items.firstOrNull { it.id == id }?.let { displayLabel(it) } }
        if (labels.isEmpty()) return null
        val head = labels.take(2).joinToString(" · ")
        return if (labels.size > 2) "$head +${labels.size - 2}" else head
    }
}

/** One planned pre-warning shared by every item on one queue with the same span (`spec/SUBSCRIPTIONS.md` 8.1). */
data class PlannedGroup(
    val key: String,
    val queue: String,
    val fireAt: java.time.LocalDateTime,
    val spanStart: java.time.LocalDateTime,
    val spanEnd: java.time.LocalDateTime,
    val mayContinue: Boolean,
    val durationMinutes: Long,
    val memberIds: List<String>
)
