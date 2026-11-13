package ua.blackout.prewarning.data.poweron

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import ua.blackout.prewarning.core.EmergencyFetch
import java.io.IOException
import java.time.LocalDate
import java.time.LocalDateTime

class PowerOnClientTest {

    private class FakeHttp(private val routes: List<Pair<String, String>>, private val failOn: String? = null) : HttpGet {
        val urls = ArrayList<String>()
        override fun get(url: String): String {
            urls.add(url)
            if (failOn != null && url.contains(failOn)) throw IOException("boom")
            return routes.firstOrNull { url.contains(it.first) }?.second ?: "[]"
        }
    }

    private val today = LocalDate.of(2026, 11, 12)
    private val now = LocalDateTime.of(2026, 11, 12, 23, 57)

    private fun accident(streetId: Int, street: String, city: String, building: String, start: String, end: String, sub: Int = 0) =
        """{"id":1,"city":{"id":333,"name":"$city"},"street":{"id":$streetId,"name":"$street"},"dateEvent":"$start","datePlanIn":"$end","koment":"МО","switchSubReason":$sub,"typeOff":1,"buildingNames":"$building"}"""

    @Test
    fun resolvesCityThenAllMergedStreetIdsAndQueriesWithDottedFilters() {
        val http = FakeHttp(
            listOf(
                "pw_cities?name=" to """[{"id":333,"name":"Житомир"}]""",
                "pw_streets?city.id=333" to """[{"id":33382,"name":"вул. Закам’янська"},{"id":33565,"name":"вул. Закам'янська"},{"id":1,"name":"вул. Київська"}]""",
                "pw_accidents" to "[" + accident(33565, "вул. Закам'янська", "Житомир", "5, 7", "2026-11-12T20:00:00+00:00", "2026-11-13T01:00:00+00:00") + "]",
                "pw_accident_planeds" to "[]"
            )
        )
        val target = PowerOnTarget(remOtgId = 6, settlementName = "місто Житомир", streetNames = listOf("вул. Закам'янська", "вул. Закам’янська"), house = "5")
        val result = PowerOnClient(http).fetch(target, today, now)

        assertEquals(listOf(333), result.ids?.cityIds)
        assertEquals(listOf(33382, 33565), result.ids?.streetIds)
        val emergency = result.emergency as EmergencyFetch.Confirmed
        assertEquals(1, emergency.records.size)
        assertEquals("pw_2026-11-12T20:00", emergency.records[0].id)

        // The first request is the REM-scoped city lookup with the bare name (prefix stripped, URL encoded).
        assertTrue(http.urls[0], http.urls[0].contains("pw_cities?name=%D0%96%D0%B8%D1%82%D0%BE%D0%BC%D0%B8%D1%80&otg.id=6&pagination=false"))
        val accidentsUrl = http.urls.first { it.contains("pw_accidents") }
        assertTrue(accidentsUrl, accidentsUrl.contains("street.id[]=33382&street.id[]=33565"))
        assertTrue(accidentsUrl, accidentsUrl.contains("switchSubReason[]=0&switchSubReason[]=1&switchSubReason[]=3"))
        assertTrue(accidentsUrl, accidentsUrl.endsWith("pagination=false"))
        // The ignored legacy parameter names must never be used.
        assertTrue(http.urls.none { Regex("[?&](city|street|otg|code_otg)=").containsMatchIn(it) })
        val planedsUrl = http.urls.first { it.contains("pw_accident_planeds") }
        assertTrue(planedsUrl, planedsUrl.contains("datePlanIn[after]=2026-11-12"))
    }

    @Test
    fun cachedIdsSkipResolution() {
        val http = FakeHttp(listOf("pw_accidents" to "[]", "pw_accident_planeds" to "[]"))
        val target = PowerOnTarget(6, "м. Житомир", listOf("вул. Київська"), "37", cachedCityIds = listOf(333), cachedStreetIds = listOf(1))
        PowerOnClient(http).fetch(target, today, now)
        assertTrue(http.urls.none { it.contains("pw_cities") || it.contains("pw_streets") })
        assertTrue(http.urls.first().contains("street.id[]=1"))
    }

    @Test
    fun failedAccidentsRequestIsUnavailableNotNoOutage() {
        val http = FakeHttp(listOf("pw_accident_planeds" to "[]"), failOn = "pw_accidents")
        val target = PowerOnTarget(6, "м. Житомир", listOf("вул. Київська"), "37", cachedCityIds = listOf(333), cachedStreetIds = listOf(1))
        val result = PowerOnClient(http).fetch(target, today, now)
        assertTrue(result.emergency is EmergencyFetch.Unavailable)
        assertEquals(emptyList<Any>(), result.repairs)
    }

    @Test
    fun failedPlannedWorksKeepEmergenciesConfirmedAndRepairsUnknown() {
        val http = FakeHttp(listOf("pw_accidents" to "[]"), failOn = "pw_accident_planeds")
        val target = PowerOnTarget(6, "м. Житомир", listOf("вул. Київська"), "37", cachedCityIds = listOf(333), cachedStreetIds = listOf(1))
        val result = PowerOnClient(http).fetch(target, today, now)
        assertTrue(result.emergency is EmergencyFetch.Confirmed)
        assertEquals(null, result.repairs)
    }

    @Test
    fun resolutionFailureIsUnavailable() {
        val http = FakeHttp(emptyList(), failOn = "pw_cities")
        val target = PowerOnTarget(6, "м. Житомир", listOf("вул. Київська"), "37")
        val result = PowerOnClient(http).fetch(target, today, now)
        assertTrue(result.emergency is EmergencyFetch.Unavailable)
    }

    @Test
    fun cityScopeFallbackFiltersRowsByStreetKey() {
        val http = FakeHttp(
            listOf(
                "pw_cities?name=" to """[{"id":502,"name":"Липники"}]""",
                "pw_streets?city.id=502" to """[{"id":9,"name":"вул. Інша"}]""",
                "pw_accidents" to "[" +
                    accident(62411, "вул. Лісна", "Липники", "10", "2026-11-12T20:00:00+00:00", "2026-11-13T01:00:00+00:00") + "," +
                    accident(62412, "вул. Польова", "Липники", "10", "2026-11-12T21:00:00+00:00", "2026-11-13T02:00:00+00:00") + "]",
                "pw_accident_planeds" to "[]"
            )
        )
        // The selected street is not in PowerOn's street list, so the query falls back to the city and filters by street key.
        val target = PowerOnTarget(7, "с. Липники", listOf("вул. Лісна"), "10")
        val result = PowerOnClient(http).fetch(target, today, now)
        val records = (result.emergency as EmergencyFetch.Confirmed).records
        assertEquals(1, records.size)
        assertEquals("pw_2026-11-12T20:00", records[0].id)
        assertTrue(http.urls.first { it.contains("pw_accidents") }.contains("city.id[]=502"))
    }

    @Test
    fun parsesPlainArrayAndHydraCollections() {
        val row = accident(1, "вул. Київська", "Житомир", "37", "2026-11-12T20:00:00+00:00", "2026-11-13T01:00:00+00:00")
        val plain = PowerOnClient.parseRows("[$row]")
        val hydra = PowerOnClient.parseRows("""{"hydra:member":[$row],"hydra:totalItems":1}""")
        assertEquals(1, plain.size)
        assertEquals(plain, hydra)
        assertEquals("вул. Київська", plain[0].streetName)
        assertEquals(333, plain[0].cityId)
        assertEquals(0, plain[0].switchSubReason)
        assertEquals(emptyList<Any>(), PowerOnClient.parseRows("not json"))
    }

    @Test
    fun cityKeyIgnoresPrefixApostropheAndCase() {
        assertEquals(PowerOnClient.cityKey("місто Житомир"), PowerOnClient.cityKey("Житомир"))
        assertEquals(PowerOnClient.cityKey("с. Кам&#039;янка"), PowerOnClient.cityKey("Кам’янка"))
    }
}
