package ua.blackout.prewarning.data.repository

import android.content.Context
import ua.blackout.prewarning.core.QueueSource
import ua.blackout.prewarning.core.StoreResult
import ua.blackout.prewarning.core.Subscription
import ua.blackout.prewarning.core.SubscriptionAddress
import ua.blackout.prewarning.core.SubscriptionStore
import ua.blackout.prewarning.core.Subscriptions
import ua.blackout.prewarning.data.model.SelectedAddressQuery
import ua.blackout.prewarning.data.parser.ZtoeAddressLookup

/**
 * The one way to change addresses and alert switches since multi-address step 2
 * (`spec/SUBSCRIPTIONS.md` section 7). Every call runs the one-time migration first, changes the
 * subscription store, then writes the primary item into the single-address keys that the main
 * screen and widgets still read (alerts read the store, section 8). Callers sync alarms and widgets themselves.
 */
class SubscriptionSync(context: Context) {
    private val appContext = context.applicationContext
    private val settingsRepo = SettingsRepository(appContext)
    private val repo = SubscriptionRepository(appContext)

    fun ensureReady(): SubscriptionStore = repo.ensureMigrated {
        val s = settingsRepo.getSettings()
        SubscriptionRepository.legacyFrom(s, SubscriptionRepository.resolveStreetName(s.selectedAddressQuery?.streetId))
    }

    fun store(): SubscriptionStore {
        ensureReady()
        return repo.store()
    }

    fun master(): Boolean {
        ensureReady()
        return repo.alertsMaster()
    }

    fun setMaster(on: Boolean) {
        ensureReady()
        val was = repo.alertsMaster()
        repo.setAlertsMaster(on)
        if (was != on) settingsRepo.applyMasterSound(on)
        mirror()
    }

    /** Applies [op] to the store; on success writes the mirror. */
    fun change(op: (SubscriptionStore) -> StoreResult): StoreResult {
        ensureReady()
        val result = repo.mutate(op)
        if (result is StoreResult.Ok) mirror()
        return result
    }

    fun addFromLookup(queue: String, statusText: String?, addressText: String, query: SelectedAddressQuery): StoreResult {
        ensureReady()
        val item = Subscription(
            id = repo.newItemId(),
            address = SubscriptionAddress(
                remSlug = query.remId,
                settlementId = query.settlementId,
                streetId = query.streetId,
                streetName = SubscriptionRepository.resolveStreetName(query.streetId).orEmpty(),
                house = query.house,
                text = addressText
            ),
            queue = queue.takeIf { Subscriptions.isValidQueue(it) },
            queueSource = QueueSource.LOOKUP,
            queueStatusText = statusText?.takeIf { it.isNotBlank() },
            createdAtMs = System.currentTimeMillis()
        )
        return change { Subscriptions.add(it, item) }
    }

    /** The user edited the address of item [id] in Settings (`Subscriptions.setAddress`). */
    fun editAddress(id: String, queue: String, statusText: String?, addressText: String, query: SelectedAddressQuery): StoreResult {
        ensureReady()
        val address = SubscriptionAddress(
            remSlug = query.remId,
            settlementId = query.settlementId,
            streetId = query.streetId,
            streetName = SubscriptionRepository.resolveStreetName(query.streetId).orEmpty(),
            house = query.house,
            text = addressText
        )
        val result = change { Subscriptions.setAddress(it, id, address, queue, statusText) }
        if (result is StoreResult.Ok) forgetLost(id)
        return result
    }

    fun addQueueOnly(queue: String): StoreResult {
        ensureReady()
        val item = Subscription(
            id = repo.newItemId(),
            queue = queue,
            queueSource = QueueSource.MANUAL,
            createdAtMs = System.currentTimeMillis()
        )
        return change { Subscriptions.add(it, item) }
    }

    /**
     * Brings every saved address to ztoe's current ids (spec/ADDRESS_KEY.md section 7): a renumbered
     * address gets its new ids and a text with the street, keeping its queue, switches and name; an address
     * whose street can not be found again is remembered for the notice ([lostStreetIds]). Network; never throws.
     */
    fun repairAddresses(siteUrl: String) {
        ensureReady()
        val lost = HashSet<String>()
        val known = HashSet<String>()
        for (item in repo.store().items) {
            val a = item.address ?: continue
            val check = try {
                ZtoeAddressLookup.checkSavedStreet(
                    a.remSlug, a.settlementId, ZtoeAddressLookup.settlementNameFromText(a.text), a.streetId, a.streetName, siteUrl
                )
            } catch (_: Exception) {
                ZtoeAddressLookup.SavedStreet.Unknown
            }
            when (check) {
                is ZtoeAddressLookup.SavedStreet.Moved -> {
                    val rem = ZtoeAddressLookup.getRems().firstOrNull { it.id == a.remSlug }
                        ?: ZtoeAddressLookup.ZTOE_REM_OPTIONS.firstOrNull { it.id == a.remSlug }
                    val moved = a.copy(
                        settlementId = check.settlementId,
                        streetId = check.streetId,
                        // the saved name is the address key: it stays, and is only filled in when it was missing
                        streetName = a.streetName.ifBlank { check.streetName },
                        text = ZtoeAddressLookup.addressText(rem?.nameUk, check.settlementName, check.streetName, a.house)
                    )
                    HouseVariantChoices.get(appContext, a.streetId, a.house)?.let { choice ->
                        HouseVariantChoices.put(appContext, check.streetId, a.house, choice)
                    }
                    if (change { Subscriptions.setAddress(it, item.id, moved, item.queue, item.queueStatusText) } is StoreResult.Ok) {
                        known += item.id
                    }
                }
                ZtoeAddressLookup.SavedStreet.Current -> known += item.id
                ZtoeAddressLookup.SavedStreet.Lost -> lost += item.id
                ZtoeAddressLookup.SavedStreet.Unknown -> Unit
            }
        }
        // an address that could not be checked keeps its previous mark
        val next = (lostStreetIds() - known) + lost
        lostPrefs().edit().putStringSet(KEY_LOST, next).apply()
    }

    /** Ids of saved addresses whose street ztoe no longer lists (spec/ADDRESS_KEY.md section 7). */
    fun lostStreetIds(): Set<String> {
        val ids = lostPrefs().getStringSet(KEY_LOST, emptySet()).orEmpty()
        val present = repo.store().items.mapTo(HashSet()) { it.id }
        return ids.filterTo(HashSet()) { it in present }
    }

    private fun forgetLost(id: String) {
        val ids = lostPrefs().getStringSet(KEY_LOST, emptySet()).orEmpty()
        if (id in ids) lostPrefs().edit().putStringSet(KEY_LOST, ids - id).apply()
    }

    private fun lostPrefs() = appContext.getSharedPreferences(LOST_PREFS, Context.MODE_PRIVATE)

    private companion object {
        const val LOST_PREFS = "address_repair"
        const val KEY_LOST = "lost_street_ids"
    }

    /** A background ZTOE lookup for the primary address found its queue (or "no queue"). */
    fun assignPrimaryQueue(queue: String?, statusText: String?, addressText: String?): StoreResult = change { s ->
        val id = s.primaryId ?: return@change StoreResult.Error(Subscriptions.ERR_NOT_FOUND)
        Subscriptions.setQueueInfo(s, id, queue, statusText, addressText)
    }

    fun mirror() {
        settingsRepo.applyPrimaryMirror(Subscriptions.primaryMirror(repo.store(), repo.alertsMaster()))
    }
}
