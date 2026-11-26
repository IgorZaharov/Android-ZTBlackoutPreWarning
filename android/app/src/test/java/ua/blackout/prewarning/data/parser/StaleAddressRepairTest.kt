package ua.blackout.prewarning.data.parser

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import ua.blackout.prewarning.data.parser.ZtoeAddressLookup.SavedStreet

/**
 * spec/ADDRESS_KEY.md section 7: saved addresses follow ztoe's renumbering of settlements and streets.
 * The street list is seeded with a fresh bulk time, so no test reaches the network.
 */
class StaleAddressRepairTest {

    @Before
    fun setUp() = ZtoeAddressLookup.clearCacheForTesting()

    @After
    fun tearDown() = ZtoeAddressLookup.clearCacheForTesting()

    private fun street(id: String, vul: Int, name: String) =
        "{\"id\":\"$id\",\"settlementId\":\"zt_city\",\"ztoeVulicaId\":$vul,\"nameUk\":\"$name\"}"

    /** The current street list of Житомир, read a minute ago. */
    private fun seedCurrent(vararg streets: String) {
        val now = System.currentTimeMillis() - 60_000
        val json = "{\"version\":${ZtoeAddressLookup.CACHE_VERSION},\"streets\":[${streets.joinToString(",")}]," +
            "\"bulkAt\":{\"zt_city\":$now}}"
        assertTrue(ZtoeAddressLookup.hydrateCacheFromJson(json))
    }

    private fun check(streetId: String, streetName: String) =
        ZtoeAddressLookup.checkSavedStreet("zhytomyr", "zt_city", "м. Житомир", streetId, streetName)

    @Test
    fun aStreetOnTheCurrentListIsCurrent() {
        seedCurrent(street("st_195700", 195700, "вул. Небесної Сотні"))
        assertEquals(SavedStreet.Current, check("st_195700", "вул. Небесної Сотні"))
    }

    @Test
    fun aRenumberedStreetIsFoundAgainByItsSavedName() {
        seedCurrent(street("st_195700", 195700, "вул. Небесної Сотні"), street("st_195701", 195701, "вул. Пушкінська"))
        val moved = check("st_174100", "вулиця Небесної Сотні")
        assertEquals(SavedStreet.Moved("zt_city", "м. Житомир", "st_195700", "вул. Небесної Сотні"), moved)
    }

    @Test
    fun withoutASavedNameTheStreetIsLost() {
        seedCurrent(street("st_195700", 195700, "вул. Небесної Сотні"))
        assertEquals(SavedStreet.Lost, check("st_174100", ""))
    }

    @Test
    fun aNameThatIsNotOnTheListIsLost() {
        seedCurrent(street("st_195700", 195700, "вул. Садова"), street("st_195900", 195900, "вул. Садова "))
        // the two spellings of one street merge (spec/ADDRESS_KEY.md section 5), so the name still finds one street
        assertTrue(check("st_174100", "вулиця Садова") is SavedStreet.Moved)
        assertEquals(SavedStreet.Lost, check("st_174100", "вул. Інша"))
    }

    @Test
    fun theNameOfADiscardedOldCacheStillRepairs() {
        // a cache of version 4 (before the renumbering) is discarded, but its street names are kept
        val old = "{\"version\":4,\"streets\":[{\"id\":\"st_174100\",\"settlementId\":\"zt_city\",\"ztoeVulicaId\":174100,\"nameUk\":\"вул. Небесної Сотні\",\"allIds\":[\"st_174100\",\"st_174101\"]}]}"
        assertFalse(ZtoeAddressLookup.hydrateCacheFromJson(old))
        seedCurrent(street("st_195700", 195700, "вул. Небесної Сотні"))
        val moved = check("st_174101", "") as SavedStreet.Moved
        assertEquals("st_195700", moved.streetId)
        // and they survive the next write of the cache
        assertTrue(ZtoeAddressLookup.serializeCacheToJson().contains("\"st_174101\":\"вул. Небесної Сотні\""))
    }

    @Test
    fun withoutAFreshStreetListNothingIsDecided() {
        // the list is not current and the site can not be asked (an unknown REM id): no verdict, no change
        assertEquals(SavedStreet.Unknown, ZtoeAddressLookup.checkSavedStreet("no_rem", "zt_city", "м. Житомир", "st_174100", "вул. Небесної Сотні"))
    }

    @Test
    fun settlementsMatchByNameOnlyWhenUnique() {
        val list = listOf(
            ZtoeSettlementOption("np_18544", "zhytomyr", 18544, "м. Житомир", "м. Житомир"),
            ZtoeSettlementOption("np_18600", "zhytomyr", 18600, "с. Тетерівка", "с. Тетерівка"),
            ZtoeSettlementOption("np_18601", "zhytomyr", 18601, "с. Тетерівка", "с. Тетерівка")
        )
        assertEquals("np_18544", ZtoeAddressLookup.matchSettlementByName("місто Житомир", list)?.id)
        assertEquals(null, ZtoeAddressLookup.matchSettlementByName("с. Тетерівка", list))
        assertEquals(null, ZtoeAddressLookup.matchSettlementByName("", list))
    }

    @Test
    fun addressTextKeepsTheStreetOrIsEmpty() {
        assertEquals("Житомирський РЕМ, м. Житомир,\nвул. Київська, буд. 10", ZtoeAddressLookup.addressText("Житомирський РЕМ", "м. Житомир", "вул. Київська", " 10 "))
        assertEquals("", ZtoeAddressLookup.addressText("Житомирський РЕМ", "м. Житомир", " ", "10"))
        assertEquals("м. Житомир", ZtoeAddressLookup.settlementNameFromText("Житомирський РЕМ, м. Житомир,\n, буд. 10"))
        assertEquals("", ZtoeAddressLookup.settlementNameFromText("Київська 10"))
    }
}
