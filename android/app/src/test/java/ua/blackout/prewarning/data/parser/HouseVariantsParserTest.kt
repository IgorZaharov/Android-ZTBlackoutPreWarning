package ua.blackout.prewarning.data.parser

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import ua.blackout.prewarning.core.ConsumerType
import ua.blackout.prewarning.core.HouseVariants

/**
 * A house listed in several ztoe rows (spec/ADDRESS_KEY.md section 6). The rows are copied from the
 * live ztoe table of Zhytomyr city (2026-11-17), seventh column «Споживач».
 */
class HouseVariantsParserTest {

    @Before
    fun setUp() = ZtoeAddressLookup.clearCacheForTesting()

    @After
    fun tearDown() = ZtoeAddressLookup.clearCacheForTesting()

    private val header =
        "<tr><td align=\"center\">РЕМ</td><td align=\"center\">Населений пункт</td><td align=\"center\">Назва вулиці, провулка, тощо</td>" +
            "<td align=\"center\">Будинки</td><td align=\"center\">Черга</td><td align=\"center\">Підчерга</td><td align=\"center\">Примітка</td></tr>"

    private fun row(street: String, houses: String, q: String, sub: String, consumer: String) =
        "<tr><td align=\"center\">Житомирський</td><td align=\"center\">місто Житомир</td><td align=\"center\">$street</td>" +
            "<td align=\"center\">$houses</td><td align=\"center\">$q</td><td align=\"center\">$sub</td><td align=\"center\">$consumer</td></tr>"

    private val household = "побутові споживачі"
    private val business = "непобутові (юридичні) споживачі"
    private val noOutage = "В цей час не вимикається, за винятком випадків аварійних відключень"

    private val myruHtml = "<table>$header" +
        row("проспект Миру", "21, 21-А, 15, 23, 19 а, 23-Б, 27, 19а", "1", "2", business) +
        row("проспект Миру", "21, 23", "5", "2", household) +
        row("проспект Миру", "23-А, 23-Б, 23 а, 23, 15-А, ТП-575, 21, 21-Г, 19-А", "5", "2", business) +
        row("проспект Миру", "25", "4", "1", household) +
        "</table>"

    private val andriivskaHtml = "<table>$header" +
        row("вул. Андріївська", "1, 1А, 2А, 2Б, 3, 4, 5, 6, 7", noOutage, noOutage, household) +
        row("вул. Андріївська", "2, 4, 2-Б, 2-А, 6", "3", "1", business) +
        "</table>"

    private val myru = ZtoeStreetOption("st_174171", "zt_city", 174171, "проспект Миру", "проспект Миру")
    private val andriivska = ZtoeStreetOption("st_1", "zt_city", 1, "вул. Андріївська", "вул. Андріївська")

    @Test
    fun myru23GetsTheHouseholdQueueAndKeepsBothQueues() {
        val houses = ZtoeAddressLookup.parseZtoeSettlementHousesTableHtml("zt_city", listOf(myru), myruHtml)["st_174171"]!!
        val h23 = houses.single { it.house == "23" }
        assertEquals("5.2", h23.queue)
        assertNull(h23.statusText)
        assertTrue(h23.hasChoice)
        assertEquals(listOf("5.2", "1.2"), h23.choices.map { it.queue })
        assertEquals(listOf(ConsumerType.HOUSEHOLD, ConsumerType.BUSINESS), h23.choices[0].consumers)
        assertEquals(listOf(ConsumerType.BUSINESS), h23.choices[1].consumers)

        // a house listed once has no choice
        val h25 = houses.single { it.house == "25" }
        assertEquals("4.1", h25.queue)
        assertFalse(h25.hasChoice)
        // 27 is only in the non-household row
        assertEquals("1.2", houses.single { it.house == "27" }.queue)
    }

    @Test
    fun householdStatusWinsOverABusinessQueue() {
        val houses = ZtoeAddressLookup.parseZtoeSettlementHousesTableHtml("zt_city", listOf(andriivska), andriivskaHtml)["st_1"]!!
        val h2a = houses.single { it.house == "2А" }
        assertEquals("", h2a.queue)
        assertEquals(noOutage, h2a.statusText)
        assertEquals(listOf("", "3.1"), h2a.choices.map { it.queue })
        val business = h2a.withVariant(HouseVariants.pick(h2a.choices, "3.1")!!)
        assertEquals("3.1", business.queue)
        assertNull(business.statusText)
        // house 2 is only in the business row
        assertEquals("3.1", houses.single { it.house == "2" }.queue)
    }

    @Test
    fun singleStreetPageKeepsVariantsToo() {
        val rows = ZtoeAddressLookup.parseZtoeAddressLookupTableHtml(myruHtml).filter { it.house == "23" }
        assertEquals(listOf("1.2", "5.2", "5.2"), rows.map { it.queue })
        assertEquals("5.2" to null, ZtoeAddressLookup.parseZtoeAddressLookupTableHtml(myruHtml, "23"))
        assertEquals(null to noOutage, ZtoeAddressLookup.parseZtoeAddressLookupTableHtml(andriivskaHtml, "2А"))
    }

    @Test
    fun variantsSurviveTheDiskCache() {
        ZtoeAddressLookup.parseZtoeSettlementHousesTableHtml("zt_city", listOf(myru), myruHtml)
        val json = ZtoeAddressLookup.serializeCacheToJson()
        ZtoeAddressLookup.clearCacheForTesting()
        assertTrue(ZtoeAddressLookup.hydrateCacheFromJson(json))
        val h23 = ZtoeAddressLookup.getHousesForStreet("st_174171").single { it.house == "23" }
        assertEquals("5.2", h23.queue)
        assertEquals(listOf("5.2", "1.2"), h23.choices.map { it.queue })
    }

    @Test
    fun aCacheOfTheOldVersionIsRejected() {
        assertFalse(ZtoeAddressLookup.hydrateCacheFromJson("{\"version\":3,\"houses\":[]}"))
    }

    @Test
    fun storedChoiceRoundTrip() {
        val v = ua.blackout.prewarning.core.HouseVariant("1.2", null, listOf(ConsumerType.BUSINESS))
        assertEquals(v, ua.blackout.prewarning.data.repository.HouseVariantChoices.decode(
            ua.blackout.prewarning.data.repository.HouseVariantChoices.encode(v)
        ))
        val status = ua.blackout.prewarning.core.HouseVariant("", null, emptyList())
        assertEquals(status, ua.blackout.prewarning.data.repository.HouseVariantChoices.decode(
            ua.blackout.prewarning.data.repository.HouseVariantChoices.encode(status)
        ))
        assertNull(ua.blackout.prewarning.data.repository.HouseVariantChoices.decode(null))
    }

    @Test
    fun savedBefore141WithoutChoiceGetsTheHouseholdQueue() {
        // a 1.4.0 user at Миру 23 saved 1.2 (the old first-row bug); with no stored choice the default applies
        val houses = ZtoeAddressLookup.parseZtoeSettlementHousesTableHtml("zt_city", listOf(myru), myruHtml)["st_174171"]!!
        val h23 = houses.single { it.house == "23" }
        assertEquals("5.2", HouseVariants.pick(h23.choices, null)?.queue)
        assertEquals("1.2", HouseVariants.pick(h23.choices, "1.2", listOf(ConsumerType.BUSINESS))?.queue)
    }
}
