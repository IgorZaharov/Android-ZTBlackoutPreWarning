package ua.blackout.prewarning.data.parser

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import ua.blackout.prewarning.core.HouseKey
import ua.blackout.prewarning.core.StreetKey

class StreetDedupTest {

    @Before
    fun setUp() = ZtoeAddressLookup.clearCacheForTesting()

    @After
    fun tearDown() = ZtoeAddressLookup.clearCacheForTesting()

    private fun streetSelect(vararg options: Pair<Int, String>): String =
        "<select name=\"vulica_id\"><option value=\"0\">--Оберіть вулицю--</option>" +
            options.joinToString("") { (id, label) -> "<option value=\"$id\">$label</option>" } +
            "</select>"

    // --- ztoe duplicates ---------------------------------------------------------------------

    @Test
    fun ztoeDuplicatePairsMergeToOneOptionHoldingAllIds() {
        val html = streetSelect(
            176316 to "вул. В&#039;ячеслава Липинського",
            174295 to "вул. В’ячеслава Липинського",
            174537 to "вул. Закам&#039;янська",
            174536 to "вул. Закам&#039;янська",
            176383 to "вул. С.П. Корольова",
            176334 to "вул. С.П.Корольова",
            173934 to "вул. Київська"
        )
        val streets = ZtoeAddressLookup.parseZtoeStreetOptionsHtml("zt_city", html)
        assertEquals("3 duplicate pairs + 1 plain street", 4, streets.size)

        val lypynskoho = streets.single { StreetKey.of(it.nameUk) == StreetKey.of("вул. В'ячеслава Липинського") }
        assertEquals(setOf("st_176316", "st_174295"), lypynskoho.allIds.toSet())
        assertEquals(setOf(176316, 174295), lypynskoho.ztoeVulicaIds.toSet())
        assertEquals("canonical id is the one with the lowest ztoe id", "st_174295", lypynskoho.id)
        assertEquals(174295, lypynskoho.ztoeVulicaId)
        assertEquals("display name is the first name seen", "вул. В'ячеслава Липинського", lypynskoho.nameUk)

        val zakamianska = streets.single { StreetKey.of(it.nameUk) == StreetKey.of("вул. Закам'янська") }
        assertEquals(setOf("st_174537", "st_174536"), zakamianska.allIds.toSet())
        assertEquals(setOf(174537, 174536), zakamianska.ztoeVulicaIds.toSet())

        val korolova = streets.single { StreetKey.of(it.nameUk) == StreetKey.of("вул. С.П. Корольова") }
        assertEquals(setOf("st_176383", "st_176334"), korolova.allIds.toSet())
        assertEquals("вул. С.П. Корольова", korolova.nameUk)

        val kyivska = streets.single { it.id == "zt_kyivska" }
        assertEquals(listOf("zt_kyivska"), kyivska.allIds)
    }

    @Test
    fun everyMergedIdResolvesToTheSameOption() {
        val streets = ZtoeAddressLookup.parseZtoeStreetOptionsHtml(
            "zt_city",
            streetSelect(176316 to "вул. В'ячеслава Липинського", 174295 to "вул. В’ячеслава Липинського")
        )
        assertEquals(1, streets.size)
        val hydrated = hydrate(streets = streets.map { """{"id":"${it.id}","settlementId":"zt_city","ztoeVulicaId":${it.ztoeVulicaId},"nameUk":"${it.nameUk}","nameEn":"x","allIds":["st_176316","st_174295"],"ztoeVulicaIds":[176316,174295]}""" })
        assertTrue(hydrated)
        val a = ZtoeAddressLookup.findStreetById("st_176316")
        val b = ZtoeAddressLookup.findStreetById("st_174295")
        assertNotNull(a)
        assertEquals(a, b)
        assertEquals("st_174295", a!!.id)
        // a bare ztoe id without prefix also resolves
        assertEquals("st_174295", ZtoeAddressLookup.findStreetById("176316")!!.id)
    }

    @Test
    fun oldCacheWithDuplicatesHealsOnHydrationAndHousesAreUnited() {
        val ok = hydrate(
            streets = listOf(
                """{"id":"st_176316","settlementId":"zt_city","ztoeVulicaId":176316,"nameUk":"вул. В'ячеслава Липинського","nameEn":"a"}""",
                """{"id":"st_174295","settlementId":"zt_city","ztoeVulicaId":174295,"nameUk":"вул. В’ячеслава Липинського","nameEn":"b"}""",
                """{"id":"st_555","settlementId":"zt_city","ztoeVulicaId":555,"nameUk":"вул. Інша","nameEn":"c"}"""
            ),
            houses = listOf(
                """{"streetId":"st_176316","house":"1","queue":"1.1"}""",
                """{"streetId":"st_176316","house":"34-А","queue":"2.1"}""",
                """{"streetId":"st_174295","house":"34А","queue":"2.1"}""",
                """{"streetId":"st_174295","house":"2","queue":"3.2"}"""
            )
        )
        assertTrue(ok)
        val list = ZtoeAddressLookup.getStreetsForSettlement("zt_city")
        assertEquals(2, list.size)
        val merged = list.single { it.id == "st_174295" }
        assertEquals(listOf("st_174295", "st_176316"), merged.allIds)

        val viaCanonical = ZtoeAddressLookup.getHousesForStreet("st_174295")
        val viaDuplicate = ZtoeAddressLookup.getHousesForStreet("st_176316")
        assertEquals(viaCanonical, viaDuplicate)
        assertEquals("union over both ids, 34-А and 34А are one house", listOf("1", "2", "34-А"), viaCanonical.map { it.house })
    }

    @Test
    fun cacheOfAnotherVersionIsDiscarded() {
        val v1 = """{"version":1,"rems":[],"settlements":[],"streets":[{"id":"st_1","settlementId":"zt_city","ztoeVulicaId":1,"nameUk":"вул. Стара","nameEn":"x"}],"houses":[]}"""
        assertFalse(ZtoeAddressLookup.hydrateCacheFromJson(v1))
        assertTrue(ZtoeAddressLookup.getStreetsForSettlement("zt_city").none { it.id == "st_1" })
        val noVersion = """{"streets":[{"id":"st_1","settlementId":"zt_city","ztoeVulicaId":1,"nameUk":"вул. Стара","nameEn":"x"}]}"""
        assertFalse(ZtoeAddressLookup.hydrateCacheFromJson(noVersion))
    }

    @Test
    fun serializedCacheCarriesTheVersionAndMergedIds() {
        val streets = ZtoeAddressLookup.parseZtoeStreetOptionsHtml(
            "zt_city",
            streetSelect(174537 to "вул. Закам'янська", 174536 to "вул. Закам'янська")
        )
        assertTrue(hydrate(streets = streets.map { """{"id":"${it.id}","settlementId":"zt_city","ztoeVulicaId":${it.ztoeVulicaId},"nameUk":"${it.nameUk}","nameEn":"x","allIds":["st_174537","st_174536"],"ztoeVulicaIds":[174537,174536]}""" }))
        val json = ZtoeAddressLookup.serializeCacheToJson()
        assertTrue(json.contains("\"version\":${ZtoeAddressLookup.CACHE_VERSION}"))
        ZtoeAddressLookup.clearCacheForTesting()
        assertTrue(ZtoeAddressLookup.hydrateCacheFromJson(json))
        val back = ZtoeAddressLookup.getStreetsForSettlement("zt_city")
        assertEquals(1, back.size)
        assertEquals(setOf("st_174537", "st_174536"), back[0].allIds.toSet())
        assertEquals(setOf(174537, 174536), back[0].ztoeVulicaIds.toSet())
    }

    // --- PowerOn style duplicates ------------------------------------------------------------

    private fun poweron(id: Int, name: String) =
        ZtoeStreetOption("p_$id", "zt_city", id, name, name, poweronStreetId = id)

    @Test
    fun poweronDuplicateNamesMerge() {
        val pairs = listOf(
            poweron(33798, "Житній Базар") to poweron(34709, "Житній базар"),
            poweron(33382, "Закам’янська") to poweron(33565, "Закам’янська"),
            poweron(33970, "В’ячеслава Липинського") to poweron(35135, "В’ячеслава Липинського"),
            poweron(5650, "майдан С.П.Корольова") to poweron(6236, "майдан С.П.Корольова"),
            poweron(33651, "пров. Єлизавети Епштейн ") to poweron(33652, "пров. Єлизавети Епштейн")
        )
        for ((a, b) in pairs) {
            val merged = ZtoeAddressLookup.mergeStreets(listOf(a, b))
            assertEquals("${a.nameUk} / ${b.nameUk}", 1, merged.size)
            assertEquals(setOf(a.poweronStreetId!!, b.poweronStreetId!!), merged[0].poweronStreetIds.toSet())
            assertEquals(setOf(a.id, b.id), merged[0].allIds.toSet())
            assertEquals(a.nameUk, merged[0].nameUk)
        }
        // different spellings of the same street group together with the ztoe form (apostrophe kinds)
        val mixed = ZtoeAddressLookup.mergeStreets(
            listOf(poweron(1, "В’ячеслава Липинського"), poweron(2, "В'ячеслава Липинського"), poweron(3, "В&#039;ячеслава Липинського"))
        )
        assertEquals(1, mixed.size)
        assertEquals(3, mixed[0].poweronStreetIds.size)
    }

    @Test
    fun mergeIsIdempotentAndKeepsDistinctStreetsApart() {
        val input = listOf(
            poweron(1, "вул. Київська"),
            poweron(2, "пров. Київська"),
            poweron(3, "Київська"),
            poweron(4, "вул. Шевченка"),
            poweron(5, "вул. Тараса Шевченка")
        )
        val once = ZtoeAddressLookup.mergeStreets(input)
        assertEquals("type and full name are part of the key", 5, once.size)
        assertEquals(once, ZtoeAddressLookup.mergeStreets(once))
    }

    @Test
    fun streetsOfDifferentSettlementsAreNotMerged() {
        val a = ZtoeStreetOption("a", "zt_city", 1, "вул. Соборна", "x")
        val b = ZtoeStreetOption("b", "bd_city", 2, "вул. Соборна", "x")
        assertEquals(2, ZtoeAddressLookup.mergeStreets(listOf(a, b)).size)
    }

    // --- houses ------------------------------------------------------------------------------

    @Test
    fun houseKeyEquivalenceForMergedHouseLists() {
        val forms = listOf("34-А", "34 А", "34А", "34A", "34а")
        assertEquals(1, forms.map { HouseKey.of(it) }.toSet().size)
        assertEquals(HouseKey.of("14/а"), HouseKey.of("14/A"))
        assertNotEquals(HouseKey.of("1"), HouseKey.of("12"))

        val a = listOf(ZtoeHouseLookupResult("34-А", "2.1"), ZtoeHouseLookupResult("1", ""))
        val b = listOf(ZtoeHouseLookupResult("34A", "2.1"), ZtoeHouseLookupResult("1", "1.2"), ZtoeHouseLookupResult("16А", "4.1"))
        val union = ZtoeAddressLookup.unionHouses(a, b)
        assertEquals(listOf("1", "16А", "34-А"), union.map { it.house })
        assertEquals("a row with a queue replaces a row without", "1.2", union.first { it.house == "1" }.queue)
    }

    private val bulkHeader = """
        <tr><td><b>РЕМ</b></td><td><b>Населений пункт</b></td><td><b>Назва вулиці</b></td>
        <td><b>Будинки</b></td><td><b>Черга</b></td><td><b>Підчерга</b></td><td><b>Примітка</b></td></tr>
    """.trimIndent()

    private fun bulkRow(street: String, houses: String, q: Int, sub: Int) =
        "<tr><td>Житомирський</td><td>місто Житомир</td><td>$street</td><td>$houses</td><td>$q</td><td>$sub</td><td></td></tr>"

    @Test
    fun bulkRowsOfDuplicateSpellingsGoToOneStreetAndHousesAreUnited() {
        val streets = ZtoeAddressLookup.parseZtoeStreetOptionsHtml(
            "zt_city",
            streetSelect(176316 to "вул. В'ячеслава Липинського", 174295 to "вул. В’ячеслава Липинського")
        )
        assertEquals(1, streets.size)
        val html = "<table>$bulkHeader" +
            bulkRow("вул. В'ячеслава Липинського", "1, 3, 34-А", 1, 2) +
            bulkRow("вул. В’ячеслава Липинського", "3, 34А, 5", 1, 2) +
            "</table>"
        val map = ZtoeAddressLookup.parseZtoeSettlementHousesTableHtml("zt_city", streets, html)
        assertEquals(setOf("st_174295"), map.keys)
        assertEquals(listOf("1", "3", "5", "34-А"), map["st_174295"]!!.map { it.house })
        assertEquals(map["st_174295"], ZtoeAddressLookup.getHousesForStreet("st_174295"))
    }

    @Test
    fun streetNamesAreMatchedStrictlyNotBySubstring() {
        val streets = listOf(ZtoeStreetOption("zt_shevchenka", "zt_city", 174478, "вул. Шевченка", "x"))
        val html = "<table>$bulkHeader" +
            bulkRow("вул. Тараса Шевченка", "1, 2", 1, 1) +
            bulkRow("вул. Шевченка", "7", 2, 2) +
            bulkRow("пров. Шевченка", "9", 3, 1) +
            "</table>"
        val map = ZtoeAddressLookup.parseZtoeSettlementHousesTableHtml("zt_city", streets, html)
        assertEquals(listOf("7"), map["zt_shevchenka"]!!.map { it.house })
    }

    @Test
    fun bareNameFallbackNeedsOneSideWithoutStreetType() {
        val streets = listOf(ZtoeStreetOption("zt_x", "zt_city", 10, "Київська", "x"))
        val html = "<table>$bulkHeader" + bulkRow("вул. Київська", "4", 1, 1) + "</table>"
        val map = ZtoeAddressLookup.parseZtoeSettlementHousesTableHtml("zt_city", streets, html)
        assertEquals(listOf("4"), map["zt_x"]!!.map { it.house })

        val typed = listOf(ZtoeStreetOption("zt_y", "zt_city", 11, "пров. Київський", "x"))
        val html2 = "<table>$bulkHeader" + bulkRow("вул. Київський", "4", 1, 1) + "</table>"
        assertTrue(ZtoeAddressLookup.parseZtoeSettlementHousesTableHtml("zt_city", typed, html2).isEmpty())
    }

    // --- static directory, demo removal, names -----------------------------------------------

    @Test
    fun staticDirectoryHasNoDuplicatesAndNoFakeHouses() {
        val ids = ZtoeAddressLookup.ZTOE_STREETS.flatMap { it.allIds }
        assertEquals("every static street id is unique", ids.size, ids.toSet().size)
        assertEquals(1, ZtoeAddressLookup.ZTOE_STREETS.count { it.ztoeVulicaId == 173952 })
        assertEquals("zt_bandery", ZtoeAddressLookup.findStreetById("st_173952")!!.id)

        assertEquals("вул. Незалежності", ZtoeAddressLookup.findStreetById("lb_soborna")!!.nameUk)
        assertEquals("lb_nezalezhnosti", ZtoeAddressLookup.findStreetById("lb_soborna")!!.id)
        assertEquals("с. Глибочиця", ZtoeAddressLookup.findSettlementById("zt_глибочиця")!!.nameUk)
        assertEquals("zt_hlybochytsia", ZtoeAddressLookup.getStreetsForSettlement("zt_глибочиця").first().settlementId)
        assertEquals("zt_velyka_berdychivska", ZtoeAddressLookup.findStreetById("zt_berdy")!!.id)

        // no default house list and no demo emergency on the production path
        for (street in ZtoeAddressLookup.ZTOE_STREETS) {
            assertTrue(ZtoeAddressLookup.getHousesForStreet(street.id).isEmpty())
        }
        assertNull(ZtoeAddressLookup.getHousesForStreet("zt_kyivska").firstOrNull { it.emergencyOutage != null })
    }

    @Test
    fun cityNamesAreComparedExactly() {
        assertEquals(ZtoeAddressLookup.cityKey("м. Житомир"), ZtoeAddressLookup.cityKey("місто Житомир"))
        assertEquals(ZtoeAddressLookup.cityKey("с. Кам'янка"), ZtoeAddressLookup.cityKey("село Кам’янка"))
        assertNotEquals(ZtoeAddressLookup.cityKey("Житомир"), ZtoeAddressLookup.cityKey("Житомирський"))
        assertNotEquals(ZtoeAddressLookup.cityKey("с. Зарічани"), ZtoeAddressLookup.cityKey("с. Нові Зарічани"))
    }

    @Test
    fun demoEmergencyFixtureLivesOnlyInTests() {
        val demo = AddressFixtures.kyivska37Demo()
        assertEquals("37", demo.house)
        assertTrue(ZtoeAddressLookup.getHousesForStreet("zt_kyivska").none { it.house == "37" })
    }

    private fun hydrate(streets: List<String>, houses: List<String> = emptyList()): Boolean {
        val json = """{"version":${ZtoeAddressLookup.CACHE_VERSION},"rems":[],"settlements":[],"streets":[${streets.joinToString(",")}],"houses":[${houses.joinToString(",")}]}"""
        return ZtoeAddressLookup.hydrateCacheFromJson(json)
    }
}
