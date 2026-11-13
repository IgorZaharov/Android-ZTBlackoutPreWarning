package ua.blackout.prewarning.data.repository

import android.content.Context
import ua.blackout.prewarning.core.QueueSource
import ua.blackout.prewarning.core.StoreResult
import ua.blackout.prewarning.core.Subscription
import ua.blackout.prewarning.core.SubscriptionAddress
import ua.blackout.prewarning.core.SubscriptionStore
import ua.blackout.prewarning.core.Subscriptions
import ua.blackout.prewarning.data.model.SelectedAddressQuery

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

    /** A background ZTOE lookup for the primary address found its queue (or "no queue"). */
    fun assignPrimaryQueue(queue: String?, statusText: String?, addressText: String?): StoreResult = change { s ->
        val id = s.primaryId ?: return@change StoreResult.Error(Subscriptions.ERR_NOT_FOUND)
        Subscriptions.setQueueInfo(s, id, queue, statusText, addressText)
    }

    fun mirror() {
        settingsRepo.applyPrimaryMirror(Subscriptions.primaryMirror(repo.store(), repo.alertsMaster()))
    }
}
