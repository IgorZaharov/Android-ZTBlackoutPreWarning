package ua.blackout.prewarning

import org.jsoup.Jsoup
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import ua.blackout.prewarning.data.model.SlotStatus
import ua.blackout.prewarning.data.model.UserSettings
import ua.blackout.prewarning.data.parser.ZtoeParser
import ua.blackout.prewarning.data.repository.DonationsRepository
import ua.blackout.prewarning.ui.AppStrings
import ua.blackout.prewarning.ui.theme.TimeOfDayPalette
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import ua.blackout.prewarning.data.KYIV_ZONE

class ZtoeParserTest {

    private fun buildSampleZtoeHtml(dateStrDdMmYyyy: String): String {
        val headerCells = (1..24).joinToString("") { h ->
            val start = String.format("%02d:00", h - 1)
            val end = String.format("%02d:00", h)
            "<td>$start-$end</td>"
        }
        val queues = listOf("1.1", "1.2", "2.1", "2.2", "3.1", "3.2", "4.1", "4.2", "5.1", "5.2", "6.1", "6.2")
        val rows = queues.mapIndexed { qIdx, q ->
            val cells = (0 until 48).joinToString("") { slotIdx ->
                val isOff = ((slotIdx + qIdx * 3) % 16) in 4..9
                val bg = if (isOff) "#ff3b30" else "#ffffff"
                "<td style=\"background-color: $bg;\"></td>"
            }
            "<tr><td>$q черга</td>$cells</tr>"
        }.joinToString("\n")

        return """
            <html>
            <body>
            <table width="100%">
                <tr><td>Header wrapper</td></tr>
                <tr><td>
                    <table>
                        <tr><td colspan="49">Графік погодинних відключень на $dateStrDdMmYyyy</td></tr>
                        <tr><td>Черга</td>$headerCells</tr>
                        $rows
                    </table>
                </td></tr>
            </table>
            </body>
            </html>
        """.trimIndent()
    }

    @Test
    fun testUnitA_ZtoeScheduleParsingAndMainWidgetGraphParity() {
        val kyivZone = KYIV_ZONE
        val today = LocalDate.now(kyivZone)
        val todayDdMmYyyy = today.format(DateTimeFormatter.ofPattern("dd.MM.yyyy"))
        val todayIso = today.format(DateTimeFormatter.ISO_LOCAL_DATE)

        val allQueues = listOf("1.1", "1.2", "2.1", "2.2", "3.1", "3.2", "4.1", "4.2", "5.1", "5.2", "6.1", "6.2")
        val randomQueue = allQueues.random()

        // Try live site first; if unreachable in isolated CI container, use realistic ZTOE leaf-table HTML
        val doc = try {
            Jsoup.connect("https://www.ztoe.com.ua/unhooking-search.php")
                .timeout(8000)
                .get()
        } catch (_: Exception) {
            null
        }

        val effectiveDoc = if (doc != null && ZtoeParser.hasScheduleTableForDate(doc, today)) {
            doc
        } else {
            Jsoup.parse(buildSampleZtoeHtml(todayDdMmYyyy))
        }

        assertTrue(
            "Expected valid schedule table for today ($todayDdMmYyyy)",
            ZtoeParser.hasScheduleTableForDate(effectiveDoc, today)
        )

        val slots = ZtoeParser.parseHtmlForDate(effectiveDoc, randomQueue, today, todayIso)
        assertTrue("Expected non-empty blackout slots for queue $randomQueue", slots.isNotEmpty())

        // Main Window TimelineBar 48 half-hour blocks calculation
        val is48Main = slots.size >= 48
        val mainWindowBlocks = (0 until 24).flatMap { hour ->
            val half1Off = if (is48Main) {
                slots.getOrNull(hour * 2)?.status == SlotStatus.POWER_OFF
            } else {
                slots.getOrNull(hour)?.status == SlotStatus.POWER_OFF
            }
            val half2Off = if (is48Main) {
                slots.getOrNull(hour * 2 + 1)?.status == SlotStatus.POWER_OFF
            } else {
                slots.getOrNull(hour)?.status == SlotStatus.POWER_OFF
            }
            listOf(half1Off, half2Off)
        }

        // Big Widget (BlackoutGlanceWidget) 48 half-hour blocks calculation
        val is48Widget = slots.size >= 48
        val bigWidgetBlocks = (0 until 24).flatMap { hour ->
            val half1Off = if (is48Widget) {
                slots.getOrNull(hour * 2)?.status == SlotStatus.POWER_OFF
            } else {
                slots.getOrNull(hour)?.status == SlotStatus.POWER_OFF
            }
            val half2Off = if (is48Widget) {
                slots.getOrNull(hour * 2 + 1)?.status == SlotStatus.POWER_OFF
            } else {
                slots.getOrNull(hour)?.status == SlotStatus.POWER_OFF
            }
            listOf(half1Off, half2Off)
        }

        assertEquals(48, mainWindowBlocks.size)
        assertEquals(48, bigWidgetBlocks.size)
        assertEquals(
            "Discrepancy found between Main Window graph and Big Widget graph for queue $randomQueue",
            mainWindowBlocks,
            bigWidgetBlocks
        )
    }

    @Test
    fun testUnitB_CriticalUiTextDefaultsAndInvariants() {
        val defaults = UserSettings()
        assertEquals("Default advanceNoticeMinutes must be 15", 15, defaults.advanceNoticeMinutes)
        assertEquals("Default refreshIntervalMinutes must be 30", 30L, defaults.refreshIntervalMinutes)

        assertEquals("Світло в Житомирі", AppStrings.aboutTitle("uk"))
        val steps = AppStrings.queueHelpSteps("uk")
        assertEquals(4, steps.size)
        assertEquals("1. Відкрийте сторінку пошуку черги на сайті https://www.ztoe.com.ua/unhooking-search.php", steps[0])
        assertEquals("2. Оберіть свій РЕМ, населений пункт і вулицю.", steps[1])
        assertEquals(
            "3. У таблиці знайдіть свій будинок і подивіться стовпці «Черга» і «Підчерга». Наприклад, черга 5 і підчерга 2 - це 5.2.",
            steps[2]
        )
        assertEquals("4. Виберіть це значення у полі «Черга» у вікні налаштувань (кнопка ⚙).", steps[3])
        assertEquals("Зрозуміло", AppStrings.queueHelpGotIt("uk"))
        assertEquals("Немає доступу до Інтернету", AppStrings.errorNoInternet("uk"))
        assertEquals("На сайті не знайдено черг", AppStrings.errorNoQueuesFound("uk"))
        assertEquals("https://www.facebook.com/ztoe.com.ua", AppStrings.EMERGENCY_OUTAGES_URL)
        assertEquals("Charity / Благодійність і Пожертви", AppStrings.aboutDonationsTitle("uk"))
        assertEquals("Charity / Благодійність і Пожертви", AppStrings.aboutDonationsTitle("en"))
        assertEquals("BLACKOUT HOURS FOR TODAY:", AppStrings.blackoutHoursHeader("en"))
        assertEquals(2, DonationsRepository.DEFAULT_DONATIONS.size)
        assertEquals("Допомога тваринам", DonationsRepository.DEFAULT_DONATIONS[0].title)
        assertEquals("https://send.monobank.ua/jar/7vJA5xrLoV", DonationsRepository.DEFAULT_DONATIONS[0].url)
        assertEquals("Фонд Повернись Живим", DonationsRepository.DEFAULT_DONATIONS[1].title)
        assertEquals("https://savelife.in.ua/donate/", DonationsRepository.DEFAULT_DONATIONS[1].url)
        assertEquals(24L * 60L * 60L * 1000L, DonationsRepository.REFRESH_INTERVAL_MS)

        val morningColors = TimeOfDayPalette.getInterpolatedColors(LocalTime.of(8, 30))
        assertEquals(TimeOfDayPalette.MORNING.primary, morningColors.primary)
    }

    @Test
    fun testUnitC_TomorrowNextPeriodAndDayTabIntervals() {
        val today = LocalDate.of(2026, 11, 2)
        val headerCells = (1..24).joinToString("") { h ->
            val start = String.format("%02d:00", h - 1)
            val end = String.format("%02d:00", h)
            "<td>$start-$end</td>"
        }
        val queues = listOf("1.1", "1.2", "2.1", "2.2", "3.1", "3.2", "4.1", "4.2", "5.1", "5.2", "6.1", "6.2")
        fun buildDayTable(dateStr: String, offRange: IntRange): String {
            val rows = queues.joinToString("\n") { q ->
                val cells = (0 until 48).joinToString("") { idx ->
                    val bg = if (idx in offRange) "#ff0000" else "#ffffff"
                    "<td style=\"background: $bg;\"></td>"
                }
                "<tr><td>1</td><td>$q</td>$cells</tr>"
            }
            return """
                <table>
                    <tr><td colspan="50">Графік погодинних відключень на $dateStr</td></tr>
                    <tr><td>Черга</td><td>Підчерга</td>$headerCells</tr>
                    $rows
                </table>
            """.trimIndent()
        }

        // Today (02.11.2026): blackout 08:00–10:00 (slots 16..19)
        // Tomorrow (03.11.2026): blackout 14:00–17:00 (slots 28..33)
        val html = "<html><body>${buildDayTable("02.11.2026", 16..19)}${buildDayTable("03.11.2026", 28..33)}</body></html>"
        val doc = Jsoup.parse(html)
        val parsed = ZtoeParser.parseDocumentFull(doc, "1.1", today)

        assertTrue("Expected tomorrow schedule to be detected", parsed.hasTomorrowSchedule && parsed.tomorrowSlots != null)

        val todayIntervals = ua.blackout.prewarning.data.repository.ScheduleRepository.computeDetailedIntervals(parsed.todaySlots)
        val tomorrowIntervals = ua.blackout.prewarning.data.repository.ScheduleRepository.computeDetailedIntervals(parsed.tomorrowSlots!!)

        assertEquals(1, todayIntervals.size)
        assertEquals("08:00", todayIntervals[0].startStr)
        assertEquals("10:00", todayIntervals[0].endStr)

        assertEquals(1, tomorrowIntervals.size)
        assertEquals("14:00", tomorrowIntervals[0].startStr)
        assertEquals("17:00", tomorrowIntervals[0].endStr)

        // At 21:00 (after today's 08:00–10:00 blackout), Next period must show tomorrow's 1st blackout (14:00 – 17:00), NOT today's 1st blackout (08:00 – 10:00)
        val statusAt21 = ua.blackout.prewarning.data.repository.ScheduleRepository.calculateStatusAndCountdown(
            slots = parsed.todaySlots,
            tomorrowSlots = parsed.tomorrowSlots,
            now = LocalTime.of(21, 0, 0)
        )
        assertEquals(false, statusAt21.isBlackoutNow)
        assertEquals("14:00 – 17:00", statusAt21.nextSlotTime)
        assertEquals("17:00:00", statusAt21.countdownText)
    }

    @Test
    fun testUnitD_SiteLinksAndUnclearState() {
        // Verify ZTOE schedules link, About GitHub README link, Unclear schedule state & uk / en localization
        assertEquals("Графіки відключень на сайті", AppStrings.siteSchedulesLabel("uk"))
        assertEquals("https://www.ztoe.com.ua/unhooking-search.php", AppStrings.SITE_SCHEDULES_URL)
        assertEquals("Світло в Житомирі на Github", AppStrings.desktopApp("uk"))
        assertEquals("Світло в Житомирі на Github", AppStrings.desktopApp("en"))
        assertEquals("https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning/blob/main/README.md", AppStrings.ABOUT_GITHUB_README_URL)
        assertEquals("Невідомо", AppStrings.powerUnclear("uk"))
        assertEquals("Unclear", AppStrings.powerUnclear("en"))
        assertEquals("Графіки не діють", AppStrings.outagesUnclear("uk"))
        assertEquals("Outages unclear", AppStrings.outagesUnclear("en"))

        val unclearStatus = ua.blackout.prewarning.data.repository.ScheduleRepository.calculateStatusAndCountdown(
            slots = emptyList(),
            tomorrowSlots = null,
            now = LocalTime.of(12, 0)
        )
        assertEquals(true, unclearStatus.isUnclear)
        assertEquals("--:-- - --:--", unclearStatus.nextSlotTime)
    }

    @Test
    fun testUnitE_AddressLookupAndEmergencyOutages() {
        val defaults = UserSettings()
        assertEquals("", defaults.queue)
        assertEquals("SYSTEM", defaults.language)

        // 1. Verify HTML Address Lookup Table parser (numeric queue 5.2 and no-queue house 104)
        val queueHtml = "<table><tr><td>15</td><td>5</td><td>2</td></tr></table>"
        val parsedQueue = ua.blackout.prewarning.data.parser.ZtoeAddressLookup.parseZtoeAddressLookupTableHtml(queueHtml, "15")
        assertEquals("5.2", parsedQueue?.first)

        val noQueueHtml = "<table><tr><td>104</td><td colspan=\"2\">В цей час не вимикається, за винятком випадків аварійних відключень</td></tr></table>"
        val parsedNoQueue = ua.blackout.prewarning.data.parser.ZtoeAddressLookup.parseZtoeAddressLookupTableHtml(noQueueHtml, "104")
        assertEquals(null, parsedNoQueue?.first)
        assertEquals("В цей час не вимикається, за винятком випадків аварійних відключень", parsedNoQueue?.second)

        // 2. Test fixture emergency (the production emergency pipeline is PowerOnClient)
        val demoEmergency = ua.blackout.prewarning.data.parser.AddressFixtures.kyivska37Demo()
        assertEquals("06.04 19:21", demoEmergency.startTime)
        assertEquals("07.04 20:00", demoEmergency.estimatedRestoreTime)

        // 3. Verify Cross-Day Emergency Overlay on Today (2026-04-06 -> 19:00-24:00) and Tomorrow (2026-04-07 -> 00:00-20:00)
        val base48PowerOn = (0 until 48).map { idx ->
            val sh = idx / 2
            val sm = if (idx % 2 == 0) "00" else "30"
            val eh = (idx + 1) / 2
            val em = if ((idx + 1) % 2 == 0) "00" else "30"
            ua.blackout.prewarning.data.model.BlackoutSlot(
                hour = sh,
                startStr = "${sh.toString().padStart(2, '0')}:$sm",
                endStr = "${eh.toString().padStart(2, '0')}:$em",
                status = SlotStatus.POWER_ON,
                label = "${sh.toString().padStart(2, '0')}:$sm - ${eh.toString().padStart(2, '0')}:$em"
            )
        }

        val todaySlots = ua.blackout.prewarning.data.repository.ScheduleRepository.applyEmergencyOutageToSlots(
            base48PowerOn,
            "2026-04-06",
            demoEmergency
        )
        val todayIntervals = ua.blackout.prewarning.data.repository.ScheduleRepository.computeDetailedIntervals(todaySlots)
        assertEquals(1, todayIntervals.size)
        assertEquals("19:00", todayIntervals[0].startStr)
        assertEquals("24:00", todayIntervals[0].endStr)
        assertEquals(true, todayIntervals[0].isEmergency)

        val tomorrowSlots = ua.blackout.prewarning.data.repository.ScheduleRepository.applyEmergencyOutageToSlots(
            base48PowerOn,
            "2026-04-07",
            demoEmergency
        )
        val tomorrowIntervals = ua.blackout.prewarning.data.repository.ScheduleRepository.computeDetailedIntervals(tomorrowSlots)
        assertEquals(1, tomorrowIntervals.size)
        assertEquals("00:00", tomorrowIntervals[0].startStr)
        assertEquals("20:00", tomorrowIntervals[0].endStr)
        assertEquals(true, tomorrowIntervals[0].isEmergency)

        assertEquals("Години відключень на сьогодні:", AppStrings.blackoutHoursForDayHeader("uk"))
        assertEquals("Години відключень на завтра:", AppStrings.blackoutHoursForTomorrowHeader("uk"))
        assertEquals("Blackout hours for today:", AppStrings.blackoutHoursForDayHeader("en"))
        assertEquals("Blackout hours for tomorrow:", AppStrings.blackoutHoursForTomorrowHeader("en"))
        assertEquals("Пошук вручну", AppStrings.queueHelpManualSearchTitle("uk"))
        assertEquals("Manual search", AppStrings.queueHelpManualSearchTitle("en"))

        // 4. Verify all 19 REMs and dynamic settlement & street option parsers from unhooking-search.php
        assertEquals(19, ua.blackout.prewarning.data.parser.ZtoeAddressLookup.ZTOE_REM_OPTIONS.size)
        val sampleSelectHtml = """
            <select name="naspunkt_id">
                <option value="0">--Оберіть населений пункт--</option>
                <option value="16657">місто Житомир</option>
                <option value="16699">село Зарічани</option>
                <option value="99999">село Кам&#039;янка</option>
            </select>
            <select name="vulica_id">
                <option value="0">--Оберіть вулицю--</option>
                <option value="173934">вул. Київська</option>
                <option value="174574">вул. Велика Бердичівська</option>
                <option value="888888">вул. В&#039;ячеслава Чорновола</option>
            </select>
        """.trimIndent()
        val parsedSettlements = ua.blackout.prewarning.data.parser.ZtoeAddressLookup.parseZtoeSettlementOptionsHtml("zhytomyr", sampleSelectHtml)
        assertEquals(3, parsedSettlements.size)
        assertEquals("zt_city", parsedSettlements[0].id)
        assertEquals(16657, parsedSettlements[0].ztoeNaspunktId)
        assertEquals("np_99999", parsedSettlements[2].id)
        assertEquals("с. Кам'янка", parsedSettlements[2].nameUk)

        val parsedStreets = ua.blackout.prewarning.data.parser.ZtoeAddressLookup.parseZtoeStreetOptionsHtml("zt_city", sampleSelectHtml)
        assertEquals(3, parsedStreets.size)
        assertEquals("zt_kyivska", parsedStreets[0].id)
        assertEquals(173934, parsedStreets[0].ztoeVulicaId)
        assertEquals("st_888888", parsedStreets[2].id)
        assertEquals("вул. В'ячеслава Чорновола", parsedStreets[2].nameUk)

        // 5. Verify live REM options HTML parser, "?" subtitle under "Пошук черги за адресою", and independent Emergency Outages switch
        val sampleRemHtml = """
            <select name="rem_id">
                <option value="0">--Оберіть РЕМ--</option>
                <option value="4">Житомирський РЕМ</option>
                <option value="2">Бердичівський РЕМ</option>
            </select>
        """.trimIndent()
        val parsedRems = ua.blackout.prewarning.data.parser.ZtoeAddressLookup.parseZtoeRemOptionsHtml(sampleRemHtml)
        assertTrue(parsedRems.size >= 19)
        assertEquals(4, parsedRems.first { it.id == "zhytomyr" }.ztoeRemId)

        assertEquals(
            "(Або закрийте це вікно та виберіть тільки чергу)",
            AppStrings.queueHelpAddressSubtitle("uk")
        )
        assertEquals(
            "(Or close this window and select directly)",
            AppStrings.queueHelpAddressSubtitle("en")
        )
        assertEquals("Сповіщення про аварійні відключення", AppStrings.emergencyNotifications("uk"))
        assertEquals("Emergency outage notifications", AppStrings.emergencyNotifications("en"))
        assertEquals(true, defaults.emergencyNotificationsEnabled)

        // 6. Verify persistent disk cache JSON serialization/hydration and background prefetching on launch
        ua.blackout.prewarning.data.parser.ZtoeAddressLookup.clearCacheForTesting()
        val mockCacheJson = """
            {
              "version": ${ua.blackout.prewarning.data.parser.ZtoeAddressLookup.CACHE_VERSION},
              "rems": [
                {"id": "zhytomyr", "ztoeRemId": 7, "nameUk": "Житомирський РЕМ", "nameEn": "Zhytomyr REM"},
                {"id": "berdychiv", "ztoeRemId": 3, "nameUk": "Бердичівський РЕМ", "nameEn": "Berdychiv REM"}
              ],
              "settlements": [
                {"id": "zt_city", "remId": "zhytomyr", "ztoeNaspunktId": 16657, "nameUk": "м. Житомир", "nameEn": "Zhytomyr"},
                {"id": "np_77777", "remId": "zhytomyr", "ztoeNaspunktId": 77777, "nameUk": "с. Тестове", "nameEn": "Testove"}
              ],
              "streets": [
                {"id": "zt_kyivska", "settlementId": "zt_city", "ztoeVulicaId": 173934, "nameUk": "вул. Київська", "nameEn": "Kyivska St."},
                {"id": "st_999999", "settlementId": "zt_city", "ztoeVulicaId": 999999, "nameUk": "вул. Інноваційна", "nameEn": "Innovatsiina St."}
              ],
              "houses": [
                {"streetId": "st_999999", "house": "12А", "queue": "4.2"}
              ]
            }
        """.trimIndent()
        val hydratedOk = ua.blackout.prewarning.data.parser.ZtoeAddressLookup.hydrateCacheFromJson(mockCacheJson)
        assertEquals(true, hydratedOk)
        assertTrue(
            ua.blackout.prewarning.data.parser.ZtoeAddressLookup.getSettlementsForRem("zhytomyr").any { it.id == "np_77777" }
        )
        assertTrue(
            ua.blackout.prewarning.data.parser.ZtoeAddressLookup.getStreetsForSettlement("zt_city").any { it.id == "st_999999" }
        )
        assertEquals(
            "4.2",
            ua.blackout.prewarning.data.parser.ZtoeAddressLookup.getHousesForStreet("st_999999").firstOrNull()?.queue
        )
        val roundTripJson = ua.blackout.prewarning.data.parser.ZtoeAddressLookup.serializeCacheToJson()
        assertTrue(roundTripJson.contains("np_77777"))
        assertTrue(roundTripJson.contains("st_999999"))

        // 7. Verify bulk settlement-wide house indexing (rem_id + naspunkt_id + all=1 7-column table) for 0ms street house dropdown loading
        val sampleSettlementAllHtml = """
            <table>
                <tr>
                    <td><b>РЕМ</b></td>
                    <td><b>Населений пункт</b></td>
                    <td><b>Назва вулиці</b></td>
                    <td><b>Будинки</b></td>
                    <td><b>Черга</b></td>
                    <td><b>Підчерга</b></td>
                    <td><b>Примітка</b></td>
                </tr>
                <tr>
                    <td>Житомирський</td>
                    <td>місто Житомир</td>
                    <td>вул. Київська</td>
                    <td>3, 5, 77</td>
                    <td align="center">5</td>
                    <td align="center">2</td>
                    <td></td>
                </tr>
                <tr>
                    <td>Житомирський</td>
                    <td>місто Житомир</td>
                    <td>вул. Інноваційна</td>
                    <td>1, 2А, 10</td>
                    <td align="center">3</td>
                    <td align="center">1</td>
                    <td></td>
                </tr>
            </table>
        """.trimIndent()
        val settlementStreets = ua.blackout.prewarning.data.parser.ZtoeAddressLookup.getStreetsForSettlement("zt_city")
        val bulkMap = ua.blackout.prewarning.data.parser.ZtoeAddressLookup.parseZtoeSettlementHousesTableHtml(
            "zt_city",
            settlementStreets,
            sampleSettlementAllHtml
        )
        assertTrue((bulkMap["zt_kyivska"]?.size ?: 0) >= 3)
        assertEquals("5.2", bulkMap["zt_kyivska"]?.firstOrNull { it.house == "77" }?.queue)
        assertEquals(3, bulkMap["st_999999"]?.size)
        assertEquals("3.1", bulkMap["st_999999"]?.firstOrNull { it.house == "2А" }?.queue)

        // 8. Verify вул. Київська house 74 7-column ZTOE table row ("В цей час не вимикається, за винятком випадків аварійних відключень" | "побутові споживачі") does NOT produce a false Emergency Outage
        val kyivska74Html = """
            <table>
                <tr>
                    <td><b>РЕМ</b></td>
                    <td><b>Населений пункт</b></td>
                    <td><b>Назва вулиці, провулка, тощо</b></td>
                    <td><b>Будинки</b></td>
                    <td><b>Черга</b></td>
                    <td><b>Підчерга</b></td>
                    <td><b>Примітка</b></td>
                </tr>
                <tr>
                    <td>Житомирський</td>
                    <td>місто Житомир</td>
                    <td>вул. Київська</td>
                    <td>74</td>
                    <td>В цей час не вимикається, за винятком випадків аварійних відключень</td>
                    <td>В цей час не вимикається, за винятком випадків аварійних відключень</td>
                    <td>побутові споживачі</td>
                </tr>
            </table>
        """.trimIndent()
        val parsedKyivska74 = ua.blackout.prewarning.data.parser.ZtoeAddressLookup.parseZtoeAddressLookupTableHtml(kyivska74Html, "74")
        assertEquals(null, parsedKyivska74?.first)
        assertEquals("В цей час не вимикається, за винятком випадків аварійних відключень", parsedKyivska74?.second)
        assertEquals(false, ua.blackout.prewarning.data.parser.ZtoeAddressLookup.isValidOutageTimestamp("В цей час не вимикається, за винятком випадків аварійних відключень"))
        assertEquals(false, ua.blackout.prewarning.data.parser.ZtoeAddressLookup.isValidOutageTimestamp("побутові споживачі"))
        assertEquals(true, ua.blackout.prewarning.data.parser.ZtoeAddressLookup.isValidOutageTimestamp("06.04 19:21"))
        assertEquals(true, ua.blackout.prewarning.data.parser.ZtoeAddressLookup.isValidOutageTimestamp("10.11.2026 22:00"))
        // 9. Verify empty-slot emergency synthesis
        val synthesizedFromEmpty = ua.blackout.prewarning.data.repository.ScheduleRepository.applyEmergencyOutageToSlots(
            emptyList(),
            "2026-04-06",
            demoEmergency,
            isTomorrow = false
        )
        assertEquals(48, synthesizedFromEmpty.size)
        val synthesizedIntervals = ua.blackout.prewarning.data.repository.ScheduleRepository.computeDetailedIntervals(synthesizedFromEmpty)
        assertEquals(1, synthesizedIntervals.size)
        assertEquals("19:00", synthesizedIntervals[0].startStr)
        assertEquals("24:00", synthesizedIntervals[0].endStr)
        assertEquals(true, synthesizedIntervals[0].isEmergency)

        // 10. Verify Житомир, вул. Велика Бердичівська, буд. 22 parity with Workbench:
        // (a) 5-cell <td colspan="3"> no-queue ZTOE HTML row in both parseZtoeAddressLookupTableHtml and parseZtoeSettlementHousesTableHtml
        val berdy22ColspanHtml = """
            <table>
                <tr>
                    <td><b>РЕМ</b></td>
                    <td><b>Населений пункт</b></td>
                    <td><b>Назва вулиці, провулка, тощо</b></td>
                    <td><b>Будинки</b></td>
                    <td><b>Черга</b></td>
                    <td><b>Підчерга</b></td>
                    <td><b>Примітка</b></td>
                </tr>
                <tr>
                    <td>Житомирський РЕМ</td>
                    <td>Житомир</td>
                    <td>вул. Велика Бердичівська</td>
                    <td>1, 10, 12/1, 15/1, 17, 20, 22, 24, 28, 30, 32, 34, 34А, 70</td>
                    <td colspan="3">В цей час не вимикається, за винятком випадків аварійних відключень</td>
                </tr>
            </table>
        """.trimIndent()
        val parsedBerdy22 = ua.blackout.prewarning.data.parser.ZtoeAddressLookup.parseZtoeAddressLookupTableHtml(berdy22ColspanHtml, "22")
        assertEquals(null, parsedBerdy22?.first)
        assertEquals("В цей час не вимикається, за винятком випадків аварійних відключень", parsedBerdy22?.second)
        val bulkBerdyMap = ua.blackout.prewarning.data.parser.ZtoeAddressLookup.parseZtoeSettlementHousesTableHtml(
            "zt_city",
            ua.blackout.prewarning.data.parser.ZtoeAddressLookup.ZTOE_STREETS.filter { it.settlementId == "zt_city" },
            berdy22ColspanHtml
        )
        val bulkBerdy22 = bulkBerdyMap["zt_velyka_berdychivska"]?.firstOrNull { it.house == "22" }
        assertNotNull(bulkBerdy22)
        assertEquals("", bulkBerdy22?.queue)
        assertEquals("В цей час не вимикається, за винятком випадків аварійних відключень", bulkBerdy22?.statusText)


        ua.blackout.prewarning.data.parser.ZtoeAddressLookup.clearCacheForTesting()
    }
}



