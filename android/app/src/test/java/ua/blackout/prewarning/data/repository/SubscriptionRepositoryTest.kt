package ua.blackout.prewarning.data.repository

import android.content.SharedPreferences
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import ua.blackout.prewarning.core.LegacySettings
import ua.blackout.prewarning.core.QueueSource
import ua.blackout.prewarning.core.StoreResult
import ua.blackout.prewarning.core.Subscription
import ua.blackout.prewarning.core.SubscriptionAddress
import ua.blackout.prewarning.core.SubscriptionStore
import ua.blackout.prewarning.core.Subscriptions
import ua.blackout.prewarning.data.model.SelectedAddressQuery
import ua.blackout.prewarning.data.model.UserSettings

class SubscriptionRepositoryTest {

    /** Minimal in-memory SharedPreferences: enough for the repository, no listeners. */
    private class FakePrefs : SharedPreferences {
        val values = HashMap<String, Any?>()
        override fun getAll(): MutableMap<String, *> = HashMap(values)
        override fun getString(key: String, defValue: String?): String? = values[key] as? String ?: defValue
        override fun getStringSet(key: String, defValues: MutableSet<String>?): MutableSet<String>? = defValues
        override fun getInt(key: String, defValue: Int): Int = values[key] as? Int ?: defValue
        override fun getLong(key: String, defValue: Long): Long = values[key] as? Long ?: defValue
        override fun getFloat(key: String, defValue: Float): Float = values[key] as? Float ?: defValue
        override fun getBoolean(key: String, defValue: Boolean): Boolean = values[key] as? Boolean ?: defValue
        override fun contains(key: String): Boolean = values.containsKey(key)
        override fun registerOnSharedPreferenceChangeListener(l: SharedPreferences.OnSharedPreferenceChangeListener?) = Unit
        override fun unregisterOnSharedPreferenceChangeListener(l: SharedPreferences.OnSharedPreferenceChangeListener?) = Unit
        override fun edit(): SharedPreferences.Editor = Editor()

        inner class Editor : SharedPreferences.Editor {
            private val pending = HashMap<String, Any?>()
            private val removed = HashSet<String>()
            private var clear = false
            override fun putString(key: String, value: String?) = apply { pending[key] = value }
            override fun putStringSet(key: String, values: MutableSet<String>?) = apply { pending[key] = values }
            override fun putInt(key: String, value: Int) = apply { pending[key] = value }
            override fun putLong(key: String, value: Long) = apply { pending[key] = value }
            override fun putFloat(key: String, value: Float) = apply { pending[key] = value }
            override fun putBoolean(key: String, value: Boolean) = apply { pending[key] = value }
            override fun remove(key: String) = apply { removed += key }
            override fun clear() = apply { clear = true }
            override fun commit(): Boolean {
                if (clear) values.clear()
                removed.forEach { values.remove(it) }
                values.putAll(pending)
                return true
            }
            override fun apply() {
                commit()
            }
        }
    }

    private val address = SubscriptionAddress(
        remSlug = "zhytomyr", settlementId = "16657", streetId = "st_123",
        streetName = "вул. Київська", house = "77", text = "Житомирський РЕМ, м. Житомир, вул. Київська, буд. 77"
    )

    private fun legacy(notif: Boolean = true, emerg: Boolean = true) = LegacySettings(
        queue = "5.2", customQueueStatusText = null, selectedAddress = address.text, remSlug = "zhytomyr",
        settlementId = "16657", streetId = "st_123", streetName = "вул. Київська", house = "77",
        notificationsEnabled = notif, emergencyNotificationsEnabled = emerg
    )

    private fun ids(vararg ids: String): () -> String {
        val it = ids.iterator()
        return { it.next() }
    }

    @Test
    fun absentStoreMigratesOnceAndWritesBothKeys() {
        val prefs = FakePrefs()
        val repo = SubscriptionRepository(prefs, clock = { 1000L }, random = ids("k3f9x2qd", "zzzzzzzz"))
        assertNull(repo.read())

        var legacyCalls = 0
        val store = repo.ensureMigrated { legacyCalls++; legacy(notif = false, emerg = false) }
        assertEquals("k3f9x2qd", store.primaryId)
        assertEquals(1, store.items.size)
        assertFalse(repo.alertsMaster())
        assertTrue(prefs.contains(SubscriptionRepository.KEY_STORE))

        // second run reads the stored copy and never asks for the legacy settings again
        val again = repo.ensureMigrated { legacyCalls++; legacy() }
        assertEquals(store, again)
        assertEquals(1, legacyCalls)
        assertFalse(repo.alertsMaster())
    }

    @Test
    fun unreadableOrOtherVersionTextMigratesAgain() {
        for (text in listOf("not json", "{\"schemaVersion\":2,\"items\":[]}", "[]", "")) {
            val prefs = FakePrefs()
            prefs.values[SubscriptionRepository.KEY_STORE] = text
            val repo = SubscriptionRepository(prefs, clock = { 1L }, random = ids("abcd1234"))
            assertNull(text, repo.read())
            assertEquals(text, "abcd1234", repo.ensureMigrated { legacy() }.primaryId)
        }
    }

    @Test
    fun encodeDecodeRoundTripKeepsNullsAndLongs() {
        val store = SubscriptionStore(
            primaryId = "aaaa0001",
            items = listOf(
                Subscription(id = "aaaa0001", address = address, queue = null, queueSource = QueueSource.LOOKUP,
                    queueStatusText = "Не підлягає відключенням", createdAtMs = 1794500000000L),
                Subscription(id = "aaaa0002", label = "Дача", queue = "3.1", plannedAlerts = false)
            )
        )
        val text = SubscriptionRepository.encode(store)
        val json = JSONObject(text)
        val first = json.getJSONArray("items").getJSONObject(0)
        assertTrue("null fields are written explicitly", first.has("queue") && first.isNull("queue"))
        assertTrue(json.getJSONArray("items").getJSONObject(1).isNull("address"))
        assertEquals(store, SubscriptionRepository.decode(text))
    }

    @Test
    fun mutateWritesOnlyOnSuccess() {
        val prefs = FakePrefs()
        val repo = SubscriptionRepository(prefs, random = ids("q1q1q1q1"))
        repo.ensureMigrated { legacy() }
        val before = prefs.values[SubscriptionRepository.KEY_STORE]

        val dup = repo.mutate { Subscriptions.add(it, Subscription(id = "bbbb0001", address = address.copy(streetName = "вулиця Київська"), queue = "5.2")) }
        assertEquals(StoreResult.Error(Subscriptions.ERR_DUPLICATE, "q1q1q1q1"), dup)
        assertEquals(before, prefs.values[SubscriptionRepository.KEY_STORE])

        val ok = repo.mutate { Subscriptions.add(it, Subscription(id = "bbbb0002", queue = "1.1")) }
        assertTrue(ok is StoreResult.Ok)
        assertEquals(listOf("q1q1q1q1", "bbbb0002"), repo.store().items.map { it.id })
    }

    @Test
    fun newItemIdSkipsIdsInUse() {
        val prefs = FakePrefs()
        val repo = SubscriptionRepository(prefs, random = ids("aaaa0001", "aaaa0001", "BAD!", "aaaa0002"))
        repo.ensureMigrated { legacy() }
        assertEquals("aaaa0002", repo.newItemId())
    }

    @Test
    fun legacyFromUserSettingsCopiesTheAddressFields() {
        val settings = UserSettings(
            queue = "5.2",
            customQueueStatusText = null,
            selectedAddress = address.text,
            selectedAddressQuery = SelectedAddressQuery("zhytomyr", "16657", "st_123", "77"),
            notificationsEnabled = false,
            emergencyNotificationsEnabled = true
        )
        assertEquals(legacy(notif = false), SubscriptionRepository.legacyFrom(settings, "вул. Київська"))
        assertNull(SubscriptionRepository.resolveStreetName(""))
    }
}
