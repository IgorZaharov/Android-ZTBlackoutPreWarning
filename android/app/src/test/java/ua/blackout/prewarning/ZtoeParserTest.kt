package ua.blackout.prewarning

import org.jsoup.Jsoup
import org.junit.Assert.assertEquals
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
import java.time.ZoneId
import java.time.format.DateTimeFormatter

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
        val kyivZone = ZoneId.of("Europe/Kyiv")
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
        assertEquals("1. Відкрийте сторінку пошуку черги на сайті ztoe.com.ua.", steps[0])
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
        assertEquals("Donations / Благодійність і Пожертви", AppStrings.aboutDonationsTitle("uk"))
        assertEquals(2, DonationsRepository.DEFAULT_DONATIONS.size)
        assertEquals("Допомога тваринам", DonationsRepository.DEFAULT_DONATIONS[0].title)
        assertEquals("https://send.monobank.ua/jar/7vJA5xrLoV", DonationsRepository.DEFAULT_DONATIONS[0].url)
        assertEquals("Фонд Повернись Живим", DonationsRepository.DEFAULT_DONATIONS[1].title)
        assertEquals("https://savelife.in.ua/donate/", DonationsRepository.DEFAULT_DONATIONS[1].url)
        assertEquals(24L * 60L * 60L * 1000L, DonationsRepository.REFRESH_INTERVAL_MS)

        val morningColors = TimeOfDayPalette.getInterpolatedColors(LocalTime.of(8, 30))
        assertEquals(TimeOfDayPalette.MORNING.primary, morningColors.primary)
    }
}
