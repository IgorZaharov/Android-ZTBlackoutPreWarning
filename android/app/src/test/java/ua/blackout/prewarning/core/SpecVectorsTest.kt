package ua.blackout.prewarning.core

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.time.LocalDate
import java.time.LocalDateTime

/**
 * Runs the platform-neutral golden vectors in `spec/vectors/`. The TypeScript simulator and the iOS
 * port run the same files, which is how parity between the three implementations is machine-checked.
 */
class SpecVectorsTest {

    private fun specDir(): File {
        var dir: File? = File(System.getProperty("user.dir")).absoluteFile
        while (dir != null) {
            val candidate = File(dir, "spec/vectors")
            if (candidate.isDirectory) return candidate
            dir = dir.parentFile
        }
        error("spec/vectors not found above ${System.getProperty("user.dir")}")
    }

    private fun load(name: String) = JSONObject(File(specDir(), name).readText(Charsets.UTF_8))

    private fun JSONArray.objects(): List<JSONObject> = (0 until length()).map { getJSONObject(it) }
    private fun JSONArray.strings(): List<String> = (0 until length()).map { getString(it) }
    private fun JSONObject.optStr(key: String): String? = if (isNull(key)) null else getString(key)
    private fun dt(s: String?): LocalDateTime? = s?.let { LocalDateTime.parse(it) }

    // ---------------------------------------------------------------------------------------------
    // outage_engine.json
    // ---------------------------------------------------------------------------------------------

    private fun toMin(hhmm: String): Int {
        val (h, m) = hhmm.split(":").map { it.toInt() }
        return h * 60 + m
    }

    private fun cells(ranges: JSONArray?): List<Boolean>? {
        if (ranges == null) return null
        val arr = BooleanArray(48)
        for (r in ranges.strings()) {
            val (a, b) = r.split("-")
            for (k in toMin(a) / 30 until toMin(b) / 30) arr[k] = true
        }
        return arr.toList()
    }

    private fun rangesOf(flags: List<Boolean>): List<String> {
        fun fmt(slot: Int): String = if (slot == 48) "24:00" else "%02d:%02d".format(slot / 2, (slot % 2) * 30)
        val out = ArrayList<String>()
        var start = -1
        for (i in 0..flags.size) {
            val on = i < flags.size && flags[i]
            if (on && start < 0) start = i
            if (!on && start >= 0) {
                out.add("${fmt(start)}-${fmt(i)}")
                start = -1
            }
        }
        return out
    }

    @Test
    fun outageEngineVectors() {
        val cases = load("outage_engine.json").getJSONArray("cases").objects()
        assertTrue(cases.size >= 20)
        for (c in cases) {
            val name = c.getString("name")
            val today = LocalDate.parse(c.getString("today"))
            val now = LocalDateTime.parse(c.getString("now"))
            val advance = c.optInt("advanceMinutes", 15)
            val p = c.optJSONObject("planned") ?: JSONObject()

            val outages = ArrayList<Outage>()
            outages += OutageEngine.buildPlanned(
                today, cells(p.optJSONArray("today")), cells(p.optJSONArray("tomorrow")), cells(p.optJSONArray("yesterday"))
            )
            c.optJSONArray("repair")?.objects()?.forEach {
                outages += Outage(it.getString("id"), OutageKind.REPAIR, dt(it.getString("start"))!!, dt(it.getString("end"))!!)
            }
            c.optJSONArray("emergencies")?.objects()?.forEach {
                val rec = EmergencyRecord(it.getString("id"), dt(it.getString("start"))!!, dt(it.optStr("estimatedEnd")), dt(it.optStr("closedAt")), it.optStr("label"))
                outages += OutageEngine.resolveEmergency(rec, now)
            }
            val window = OutageEngine.inWindow(outages, today)
            val expect = c.getJSONObject("expect")

            expect.optJSONObject("status")?.let { s ->
                val st = OutageEngine.status(window, now)
                assertEquals("$name: isOffNow", s.getBoolean("isOffNow"), st.isOffNow)
                assertEquals("$name: countdownText", s.getString("countdownText"), st.countdownText)
                assertEquals("$name: nextSlotTime", s.getString("nextSlotTime"), st.nextSlotTime)
            }

            expect.optJSONArray("spans")?.let { exp ->
                val spans = OutageEngine.spans(window.filter { !it.stale })
                assertEquals("$name: span count", exp.length(), spans.size)
                exp.objects().forEachIndexed { i, e ->
                    assertEquals("$name: span[$i].start", e.getString("start"), spans[i].start.toString())
                    assertEquals("$name: span[$i].end", e.getString("end"), spans[i].end.toString())
                    assertEquals("$name: span[$i].mayContinue", e.getBoolean("mayContinue"), spans[i].mayContinue)
                }
            }

            expect.optJSONArray("alerts")?.let { exp ->
                val alerts = OutageEngine.planAlerts(window, now, advance)
                assertEquals("$name: alert count", exp.length(), alerts.size)
                exp.objects().forEachIndexed { i, e ->
                    assertEquals("$name: alert[$i].key", e.getString("key"), alerts[i].key)
                    assertEquals("$name: alert[$i].fireAt", e.getString("fireAt"), alerts[i].fireAt.toString())
                    assertEquals("$name: alert[$i].spanEnd", e.getString("spanEnd"), alerts[i].spanEnd.toString())
                    assertEquals("$name: alert[$i].durationMinutes", e.getLong("durationMinutes"), alerts[i].durationMinutes)
                }
            }

            expect.optJSONObject("days")?.let { days ->
                for (dateKey in days.keys()) {
                    val d = days.getJSONObject(dateKey)
                    val view = OutageEngine.dayView(window, LocalDate.parse(dateKey), now)
                    if (d.has("totalOffMinutes")) assertEquals("$name/$dateKey: total", d.getLong("totalOffMinutes"), view.totalOffMinutes)
                    d.optJSONArray("plannedCells")?.let {
                        assertEquals("$name/$dateKey: plannedCells", it.strings(), rangesOf(view.slots.map { s -> s.planned }))
                    }
                    d.optJSONArray("emergencyCells")?.let {
                        assertEquals("$name/$dateKey: emergencyCells", it.strings(), rangesOf(view.slots.map { s -> s.emergency }))
                    }
                    d.optJSONArray("rows")?.let { exp ->
                        assertEquals("$name/$dateKey: row count", exp.length(), view.rows.size)
                        exp.objects().forEachIndexed { i, e ->
                            val r = view.rows[i]
                            val tag = "$name/$dateKey: row[$i]"
                            if (e.has("kind")) assertEquals("$tag.kind", e.getString("kind"), r.outage.kind.name)
                            if (e.has("from")) assertEquals("$tag.from", e.getString("from"), r.from.toString())
                            if (e.has("to")) assertEquals("$tag.to", e.getString("to"), r.to.toString())
                            if (e.has("status")) assertEquals("$tag.status", e.getString("status"), r.status.name)
                            if (e.has("continuesFromPrevDay")) assertEquals("$tag.continuesFromPrevDay", e.getBoolean("continuesFromPrevDay"), r.continuesFromPrevDay)
                            if (e.has("continuesToNextDay")) assertEquals("$tag.continuesToNextDay", e.getBoolean("continuesToNextDay"), r.continuesToNextDay)
                            if (e.has("durationMinutes")) assertEquals("$tag.durationMinutes", e.getLong("durationMinutes"), r.durationMinutes)
                            if (e.has("inDayMinutes")) assertEquals("$tag.inDayMinutes", e.getLong("inDayMinutes"), r.inDayMinutes)
                        }
                    }
                }
            }
        }
    }

    // ---------------------------------------------------------------------------------------------
    // emergency_ledger.json
    // ---------------------------------------------------------------------------------------------

    @Test
    fun emergencyLedgerVectors() {
        val cases = load("emergency_ledger.json").getJSONArray("cases").objects()
        assertTrue(cases.size >= 8)
        for (c in cases) {
            val name = c.getString("name")
            val addressKey = c.getString("addressKey")
            var entries: List<LedgerEntry> = emptyList()
            c.getJSONArray("steps").objects().forEachIndexed { stepIdx, step ->
                val now = LocalDateTime.parse(step.getString("now"))
                val fetchJson = step.getJSONObject("fetch")
                val fetch: EmergencyFetch = if (fetchJson.has("unavailable")) {
                    EmergencyFetch.Unavailable("test")
                } else {
                    EmergencyFetch.Confirmed(fetchJson.getJSONArray("confirmed").objects().map {
                        EmergencyRecord(it.getString("id"), dt(it.getString("start"))!!, dt(it.optStr("estimatedEnd")), null, it.optStr("label"))
                    })
                }
                val result = EmergencyLedger.reconcile(entries, fetch, now)
                entries = result.entries
                val expected = step.getJSONArray("events").objects()
                assertEquals("$name step $stepIdx: event count", expected.size, result.events.size)
                expected.forEachIndexed { i, e ->
                    val ev = result.events[i]
                    assertEquals("$name step $stepIdx: kind", e.getString("kind"), ev.kind.name)
                    assertEquals("$name step $stepIdx: key", e.getString("key"), ev.key(addressKey))
                    if (e.has("upcoming")) assertEquals("$name step $stepIdx: upcoming", e.getBoolean("upcoming"), ev.upcoming)
                    if (e.has("earlyEnd")) assertEquals("$name step $stepIdx: earlyEnd", e.getBoolean("earlyEnd"), ev.earlyEnd)
                }
            }
        }
    }

    // ---------------------------------------------------------------------------------------------
    // address_keys.json
    // ---------------------------------------------------------------------------------------------

    @Test
    fun addressKeyVectors() {
        val v = load("address_keys.json")
        for (group in v.getJSONArray("streetEqual")) {
            val names = (group as JSONArray).strings()
            val keys = names.map { StreetKey.of(it) }.toSet()
            assertEquals("streetEqual should collapse to one key: $names -> $keys", 1, keys.size)
        }
        for (pair in v.getJSONArray("streetDistinct")) {
            val (a, b) = (pair as JSONArray).strings()
            assertNotEquals("streetDistinct must differ: $a vs $b", StreetKey.of(a), StreetKey.of(b))
        }
        for (group in v.getJSONArray("houseEqual")) {
            val names = (group as JSONArray).strings()
            val keys = names.map { HouseKey.of(it) }.toSet()
            assertEquals("houseEqual should collapse to one key: $names -> $keys", 1, keys.size)
        }
        for (pair in v.getJSONArray("houseDistinct")) {
            val (a, b) = (pair as JSONArray).strings()
            assertNotEquals("houseDistinct must differ: $a vs $b", HouseKey.of(a), HouseKey.of(b))
        }
        for (c in v.getJSONArray("listContains").objects()) {
            assertEquals(
                "listContains ${c.getString("buildingNames")} / '${c.getString("house")}'",
                c.getBoolean("expect"),
                HouseKey.listContains(c.getString("buildingNames"), c.getString("house"))
            )
        }
        assertEquals("'", TextNorm.decodeEntities("&amp;#039;"))
        assertEquals("'", TextNorm.decodeEntities("&#39;"))
        assertEquals("'", TextNorm.decodeEntities("&#x27;"))
        assertEquals("a&b", TextNorm.decodeEntities("a&amp;b"))
    }

    // ---------------------------------------------------------------------------------------------
    // poweron_api.json
    // ---------------------------------------------------------------------------------------------

    private fun row(o: JSONObject) = PowerOnRow(
        id = o.getLong("id"),
        cityId = if (o.isNull("cityId")) null else o.getInt("cityId"),
        cityName = o.getString("cityName"),
        streetId = if (o.isNull("streetId")) null else o.getInt("streetId"),
        streetName = o.getString("streetName"),
        dateEvent = o.getString("dateEvent"),
        datePlanIn = o.getString("datePlanIn"),
        koment = o.optStr("koment"),
        switchSubReason = if (o.isNull("switchSubReason")) null else o.getInt("switchSubReason"),
        typeOff = if (o.isNull("typeOff")) null else o.getInt("typeOff"),
        buildingNames = o.getString("buildingNames")
    )

    @Test
    fun powerOnVectors() {
        val v = load("poweron_api.json")
        for (t in v.getJSONArray("timestamps").objects()) {
            val parsed = PowerOnMapper.parseTime(t.getString("in"))
            if (t.isNull("out")) assertNull("timestamp '${t.getString("in")}'", parsed)
            else assertEquals("timestamp '${t.getString("in")}'", t.getString("out"), parsed.toString())
        }
        for (c in v.getJSONArray("emergencyMapping").objects()) {
            val name = c.getString("name")
            val got = PowerOnMapper.emergencyRecordsFor(c.getJSONArray("rows").objects().map(::row), c.getString("house"))
            val exp = c.getJSONArray("expect").objects()
            assertEquals("$name: count", exp.size, got.size)
            exp.forEachIndexed { i, e ->
                assertEquals("$name: id", e.getString("id"), got[i].id)
                assertEquals("$name: start", e.getString("start"), got[i].start.toString())
                assertEquals("$name: estimatedEnd", e.optStr("estimatedEnd"), got[i].estimatedEnd?.toString())
                assertEquals("$name: label", e.optStr("label"), got[i].label)
            }
        }
        for (c in v.getJSONArray("repairMapping").objects()) {
            val name = c.getString("name")
            val got = PowerOnMapper.repairOutagesFor(
                c.getJSONArray("rows").objects().map(::row), c.getString("house"), LocalDate.parse(c.getString("today"))
            )
            val exp = c.getJSONArray("expect").objects()
            assertEquals("$name: count", exp.size, got.size)
            exp.forEachIndexed { i, e ->
                assertEquals("$name: id", e.getString("id"), got[i].id)
                assertEquals("$name: kind", OutageKind.REPAIR, got[i].kind)
                assertEquals("$name: start", e.getString("start"), got[i].start.toString())
                assertEquals("$name: end", e.getString("end"), got[i].end.toString())
                assertEquals("$name: label", e.optStr("label"), got[i].label)
            }
        }
    }

    // ---------------------------------------------------------------------------------------------
    // site_state.json
    // ---------------------------------------------------------------------------------------------

    @Test
    fun siteStateVectors() {
        for (c in load("site_state.json").getJSONArray("cases").objects()) {
            val got = SiteStateResolver.resolve(
                FetchFailure.valueOf(c.getString("failure")), c.getBoolean("hasTodayTable"), c.getBoolean("networkValidated")
            )
            assertEquals(c.toString(), SiteState.valueOf(c.getString("expect")), got)
        }
    }

    // ---------------------------------------------------------------------------------------------
    // site_notice.json
    // ---------------------------------------------------------------------------------------------

    @Test
    fun siteNoticeVectors() {
        val cases = load("site_notice.json").getJSONArray("cases").objects()
        assertTrue(cases.size >= 5)
        for (c in cases) {
            assertEquals(c.getString("name"), c.optStr("expect"), SiteNotice.extract(c.getString("html")))
        }
    }
}
