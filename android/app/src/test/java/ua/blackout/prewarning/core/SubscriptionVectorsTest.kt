package ua.blackout.prewarning.core

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.io.File

/**
 * Runs `spec/vectors/subscriptions.json` against [Subscriptions]. The TypeScript mirror runs the same
 * file in `tests/spec-vectors.test.ts`.
 */
class SubscriptionVectorsTest {

    private fun load(): JSONObject {
        var dir: File? = File(System.getProperty("user.dir")).absoluteFile
        while (dir != null) {
            val f = File(dir, "spec/vectors/subscriptions.json")
            if (f.isFile) return JSONObject(f.readText(Charsets.UTF_8))
            dir = dir.parentFile
        }
        error("spec/vectors/subscriptions.json not found above ${System.getProperty("user.dir")}")
    }

    private fun JSONArray.objects(): List<JSONObject> = (0 until length()).map { getJSONObject(it) }
    private fun JSONObject.optStr(key: String): String? = if (!has(key) || isNull(key)) null else getString(key)

    /** org.json -> plain maps and lists; all integral numbers become Long so they compare with toMap. */
    private fun plain(v: Any?): Any? = when (v) {
        null, JSONObject.NULL -> null
        is JSONObject -> v.keys().asSequence().associateWith { plain(v.get(it)) }
        is JSONArray -> (0 until v.length()).map { plain(v.get(it)) }
        is Int -> v.toLong()
        is Long -> v
        is Number -> v.toDouble()
        else -> v
    }

    private fun canon(v: Any?): Any? = when (v) {
        is Map<*, *> -> v.entries.associate { it.key.toString() to canon(it.value) }
        is List<*> -> v.map { canon(it) }
        is Int -> v.toLong()
        else -> v
    }

    private fun storeOf(o: JSONObject): SubscriptionStore =
        Subscriptions.repair(Subscriptions.fromMap(plain(o) as Map<*, *>)!!).store

    private fun assertStore(expected: JSONObject, actual: SubscriptionStore, name: String) =
        assertEquals(name, canon(plain(expected)), canon(Subscriptions.toMap(actual)))

    @Test
    fun labels() {
        val v = load().getJSONObject("labels")
        for (c in v.getJSONArray("defaultLabel").objects()) {
            val house = c.optStr("house")
            val item = if (house == null) {
                Subscription(id = "test0000", queue = c.getString("queue"))
            } else {
                Subscription(
                    id = "test0000",
                    address = SubscriptionAddress("zhytomyr", "16657", "st_1", c.optStr("streetName").orEmpty(), house, ""),
                    queue = "1.1"
                )
            }
            assertEquals(c.toString(), c.getString("expect"), Subscriptions.defaultLabel(item))
        }
        for (c in v.getJSONArray("cleanLabel").objects()) {
            assertEquals(c.toString(), c.getString("expect"), Subscriptions.cleanLabel(c.getString("raw")))
        }
    }

    @Test
    fun migrate() {
        for (c in load().getJSONArray("migrate").objects()) {
            val name = c.getString("name")
            val l = c.getJSONObject("legacy")
            val legacy = LegacySettings(
                queue = l.getString("queue"),
                customQueueStatusText = l.optStr("customQueueStatusText"),
                selectedAddress = l.optStr("selectedAddress"),
                remSlug = l.getString("remSlug"),
                settlementId = l.getString("settlementId"),
                streetId = l.getString("streetId"),
                streetName = l.optStr("streetName"),
                house = l.getString("house"),
                notificationsEnabled = l.getBoolean("notificationsEnabled"),
                emergencyNotificationsEnabled = l.getBoolean("emergencyNotificationsEnabled")
            )
            val r = Subscriptions.migrate(legacy, c.getString("id"), c.getLong("nowMs"))
            assertEquals(name, c.getBoolean("expectMaster"), r.alertsMaster)
            assertStore(c.getJSONObject("expect"), r.store, name)
            assertEquals("$name: migration output is already repaired", r.store, Subscriptions.repair(r.store).store)
            c.optStr("expectDisplayLabel")?.let { assertEquals(name, it, Subscriptions.displayLabel(r.store.items.single())) }
            c.optStr("expectAddressKey")?.let { assertEquals(name, it, r.store.items.single().address!!.key) }
        }
    }

    @Test
    fun repair() {
        for (c in load().getJSONArray("repair").objects()) {
            val name = c.getString("name")
            val parsed = Subscriptions.fromMap(plain(c.getJSONObject("input")) as Map<*, *>)
            if (c.optBoolean("expectAbsent", false)) {
                assertNull(name, parsed)
                continue
            }
            val r = Subscriptions.repair(parsed!!)
            assertStore(c.getJSONObject("expect"), r.store, name)
            val dropped = c.getJSONArray("expectDropped").objects().map { DroppedItem(it.optStr("id"), it.getString("reason")) }
            assertEquals(name, dropped, r.dropped)
        }
    }

    @Test
    fun ops() {
        for (c in load().getJSONArray("ops").objects()) {
            val name = c.getString("name")
            var store = storeOf(c.getJSONObject("start"))
            for ((i, s) in c.getJSONArray("steps").objects().withIndex()) {
                val label = "$name, step $i ${s.getString("op")}"
                val result = when (s.getString("op")) {
                    "add" -> Subscriptions.add(store, Subscriptions.itemFromMap(plain(s.getJSONObject("item")) as Map<*, *>))
                    "remove" -> Subscriptions.remove(store, s.getString("id"))
                    "setPrimary" -> Subscriptions.setPrimary(store, s.getString("id"))
                    "setPlanned" -> Subscriptions.setPlanned(store, s.getString("id"), s.getBoolean("on"))
                    "setEmergency" -> Subscriptions.setEmergency(store, s.getString("id"), s.getBoolean("on"))
                    "rename" -> Subscriptions.rename(store, s.getString("id"), s.getString("label"))
                    else -> error("unknown op in $label")
                }
                val expectError = s.optStr("expectError")
                when (result) {
                    is StoreResult.Ok -> {
                        assertNull("$label: expected error $expectError", expectError)
                        store = result.store
                    }
                    is StoreResult.Error -> {
                        assertEquals(label, expectError, result.code)
                        assertEquals(label, s.optStr("expectExistingId"), result.existingId)
                    }
                }
                if (s.has("expectPrimary")) assertEquals(label, s.optStr("expectPrimary"), store.primaryId)
            }
            assertStore(c.getJSONObject("expect"), store, name)
            c.optJSONObject("expectDisplayLabels")?.let { labels ->
                for (id in labels.keys()) {
                    assertEquals("$name: $id", labels.getString(id), Subscriptions.displayLabel(store.items.single { it.id == id }))
                }
            }
        }
    }

    @Test
    fun effective() {
        val v = load().getJSONObject("effective")
        for (c in v.getJSONArray("items").objects()) {
            val item = Subscription(
                id = "test0000",
                address = if (c.getBoolean("address")) SubscriptionAddress("zhytomyr", "16657", "st_1", "вул. Лісова", "1", "") else null,
                queue = c.optStr("queue"),
                plannedAlerts = c.getBoolean("planned"),
                emergencyAlerts = c.getBoolean("emergency")
            )
            val master = c.getBoolean("master")
            assertEquals(c.toString(), c.getBoolean("expectPlanned"), Subscriptions.plannedActive(master, item))
            assertEquals(c.toString(), c.getBoolean("expectEmergency"), Subscriptions.emergencyActive(master, item, c.getBoolean("poweronIdsKnown")))
        }
        for (c in v.getJSONArray("anyAlertsEnabled").objects()) {
            val sw = c.getJSONArray("switches")
            val items = (0 until sw.length()).map { i ->
                val pair = sw.getJSONArray(i)
                Subscription(id = "item000$i", queue = "1.1", plannedAlerts = pair.getBoolean(0), emergencyAlerts = pair.getBoolean(1))
            }
            assertEquals(c.toString(), c.getBoolean("expect"), Subscriptions.anyAlertsEnabled(c.getBoolean("master"), SubscriptionStore(items.firstOrNull()?.id, items)))
        }
    }
}
