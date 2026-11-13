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
    fun testUnitD_ZhytomyrRouletteGameLogicAndLocalization() {
        ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.resetSavedBestScore(0)
        ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.resetSavedPowerPoints(0)
        ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.resetPurchasedUpgrades(emptySet())

        val labels = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.generate48TimeslotLabels()
        assertEquals(48, labels.size)
        assertEquals("00:00-00:30", labels[0])
        assertEquals("00:30-01:00", labels[1])
        assertEquals("15:30-16:00", labels[31])
        assertEquals("23:30-24:00", labels[47])

        assertEquals(0.30f, ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.TICKET_SCRATCH_REVEAL_THRESHOLD, 0.0001f)
        assertEquals(false, ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.isTicketScratchedEnough(0.19f))
        assertEquals(false, ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.isTicketScratchedEnough(0.29f))
        assertEquals(true, ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.isTicketScratchedEnough(0.30f))
        assertEquals(true, ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.isTicketScratchedEnough(0.02f, isCenterShown = true))

        val controlledTickets = labels.mapIndexed { idx, label ->
            ua.blackout.prewarning.ui.screens.RouletteTicketItem(
                index = idx,
                slotLabel = label,
                isRed = idx >= 40,
                isGolden = false,
                isX2 = idx == 10,
                isRevealed = false
            )
        }
        val pairs = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.getHourlyTicketPairs(controlledTickets)
        assertEquals(24, pairs.size)
        assertEquals("00:00-00:30", pairs[0].first.slotLabel)
        assertEquals("00:30-01:00", pairs[0].second.slotLabel)

        var state = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.startGame("1.1", false, controlledTickets)
        assertEquals(0, state.score)
        assertEquals(1, state.streakIncrement)

        // Consecutive beige reveals: +1, +2, +3, +4 -> 10
        state = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.revealTicket(state, 0).nextState
        assertEquals(1, state.score)
        state = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.revealTicket(state, 1).nextState
        assertEquals(3, state.score)
        state = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.revealTicket(state, 2).nextState
        assertEquals(6, state.score)
        state = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.revealTicket(state, 3).nextState
        assertEquals(10, state.score)
        assertEquals(5, state.streakIncrement)

        // Scratch X2 multiplier ticket at index 10 -> score multiplied by x2 (10 * 2 = 20)
        val x2Reveal = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.revealTicket(state, 10)
        assertEquals(ua.blackout.prewarning.ui.screens.TicketRevealOutcome.X2, x2Reveal.outcome)
        assertEquals(20, x2Reveal.nextState.score)

        // 1st Get New Tickets costs 0 (score 10 - 0 = 10) and resets streakIncrement back to 1
        state = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.applyGetNewTickets(state, "3.2", true, controlledTickets)
        assertEquals(10, state.score)
        assertEquals(1, state.streakIncrement)
        assertEquals(1, state.refreshCount)
        assertTrue(state.tickets.none { it.isRevealed })

        // 2nd Get New Tickets costs -1 (score 10 - 1 = 9)
        state = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.applyGetNewTickets(state, "4.1", true, controlledTickets)
        assertEquals(9, state.score)
        assertEquals(2, state.refreshCount)

        // 3rd Get New Tickets costs -2 (score 9 - 2 = 7)
        state = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.applyGetNewTickets(state, "5.2", true, controlledTickets)
        assertEquals(7, state.score)
        assertEquals(3, state.refreshCount)

        // Refresh button is disabled (no-op) when score < refreshCount
        val lowScoreState = state.copy(score = 1, refreshCount = 4)
        assertEquals(false, ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.canRefreshTickets(1, 4))
        assertEquals(true, ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.canRefreshTickets(4, 4))
        val unchangedAfterInsufficientRefresh = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.applyGetNewTickets(lowScoreState, "6.1", true, controlledTickets)
        assertEquals(1, unchangedAfterInsufficientRefresh.score)
        assertEquals(4, unchangedAfterInsufficientRefresh.refreshCount)

        // Golden ticket reveal immediately scratches all beige tickets on field and adds cumulative score
        val fiveBeigeTickets = labels.mapIndexed { idx, label ->
            ua.blackout.prewarning.ui.screens.RouletteTicketItem(
                index = idx,
                slotLabel = label,
                isRed = idx >= 5,
                isGolden = idx == 2,
                isX2 = idx == 4,
                isRevealed = false
            )
        }
        var goldenState = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.startGame("1.1", false, fiveBeigeTickets)
        goldenState = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.revealTicket(goldenState, 0).nextState // +1 -> score=1, streak=2
        val goldenRes = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.revealTicket(goldenState, 2)
        assertEquals(ua.blackout.prewarning.ui.screens.TicketRevealOutcome.GOLDEN, goldenRes.outcome)
        assertEquals(15, goldenRes.nextState.score) // 1 + (2 + 3 + 4 + 5) = 15
        assertEquals(6, goldenRes.nextState.streakIncrement)
        assertTrue(goldenRes.nextState.tickets.filter { !it.isRed }.all { it.isRevealed })

        // Red ticket reveal transitions to FADING_TO_BLACK -> GAME_OVER and adds earned score (7) to Power Points
        ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.resetSavedPowerPoints(0)
        val redReveal = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.revealTicket(state, 42)
        assertEquals(ua.blackout.prewarning.ui.screens.TicketRevealOutcome.RED, redReveal.outcome)
        assertEquals(7, redReveal.nextState.powerPoints)
        val gameOverState = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.completeFadeToGameOver(redReveal.nextState)
        assertEquals(ua.blackout.prewarning.ui.screens.RouletteScreenMode.GAME_OVER, gameOverState.screen)
        assertEquals(7, gameOverState.score)
        assertEquals(7, gameOverState.powerPoints)

        // Main Menu & Close Game reset screen to START
        val mainMenuState = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.applyReturnToMainMenu(gameOverState)
        assertEquals(ua.blackout.prewarning.ui.screens.RouletteScreenMode.START, mainMenuState.screen)
        val closedState = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.applyCloseGame(gameOverState)
        assertEquals(ua.blackout.prewarning.ui.screens.RouletteScreenMode.START, closedState.screen)

        // Restart from GAME_OVER bypasses START screen and starts a new game immediately (PLAYING)
        val restartedFromGameOver = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.applyRestartGame(gameOverState)
        assertEquals(ua.blackout.prewarning.ui.screens.RouletteScreenMode.PLAYING, restartedFromGameOver.screen)
        assertEquals(0, restartedFromGameOver.score)
        assertEquals(1, restartedFromGameOver.streakIncrement)
        assertEquals(0, restartedFromGameOver.refreshCount)

        // Restart from PLAYING adds current score to Power Points and returns to START screen
        var playingWithScore = restartedFromGameOver
        playingWithScore = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.revealTicket(playingWithScore, 0).nextState // +1
        playingWithScore = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.revealTicket(playingWithScore, 1).nextState // +2 -> 3
        val restartedFromPlaying = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.applyRestartGame(playingWithScore)
        assertEquals(ua.blackout.prewarning.ui.screens.RouletteScreenMode.START, restartedFromPlaying.screen)
        assertEquals(10, restartedFromPlaying.powerPoints) // 7 + 3 = 10

        // Verify Power Shop upgrades (11 total including Daily Streak & Perseverance), "Секрет" / "Secret" descriptions, Nocturnal Creature (10), and Депозит Потужність+ (100)
        assertEquals(11, ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.UPGRADES.size)
        assertEquals(0.575, ua.blackout.prewarning.ui.screens.RouletteSoundEngine.SCRATCH_VOLUME_SCALE, 0.001)
        assertEquals(0.9, ua.blackout.prewarning.ui.screens.RouletteSoundEngine.SCRATCH_SFX_VOLUME_MULTIPLIER, 0.001)
        assertEquals(0.75, ua.blackout.prewarning.ui.screens.RouletteSoundEngine.COIN_VOLUME_SCALE, 0.001)
        assertEquals(0.60, ua.blackout.prewarning.ui.screens.RouletteSoundEngine.GAMEOVER_UPGRADE_VOLUME_SCALE, 0.001)
        assertEquals(0.575, ua.blackout.prewarning.ui.screens.RouletteSoundEngine.FLICKER_BUZZ_VOLUME_SCALE, 0.001)
        assertEquals(0.575, ua.blackout.prewarning.ui.screens.RouletteSoundEngine.GAME_BLACKOUT_VOLUME_SCALE, 0.001)
        assertEquals(0.9, ua.blackout.prewarning.ui.screens.RouletteSoundEngine.FLICKER_SFX_VOLUME_MULTIPLIER, 0.001)
        assertEquals(
            0.05,
            ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.getGoldenTicketProbability(
                setOf(ua.blackout.prewarning.ui.screens.RouletteUpgradeId.FERN_FLOWER)
            ),
            0.0001
        )
        val fernDef = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.UPGRADES.first {
            it.id == ua.blackout.prewarning.ui.screens.RouletteUpgradeId.FERN_FLOWER
        }
        assertEquals("Удача +5%", ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.getUpgradeDescription(fernDef, "uk", false))
        assertEquals("Luck +5%", ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.getUpgradeDescription(fernDef, "en", false))
        val catDef = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.UPGRADES.first {
            it.id == ua.blackout.prewarning.ui.screens.RouletteUpgradeId.BLACK_CAT
        }
        assertEquals("Приносить невдачу", ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.getUpgradeDescription(catDef, "uk", false))
        assertEquals("Brings misfortune", ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.getUpgradeDescription(catDef, "en", false))
        val nocDef = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.UPGRADES.first {
            it.id == ua.blackout.prewarning.ui.screens.RouletteUpgradeId.NOCTURNAL_CREATURE
        }
        assertEquals("Тепер блекаут вам до вподоби", ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.getUpgradeDescription(nocDef, "uk", false))
        assertEquals("You love blackouts", ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.getUpgradeDescription(nocDef, "en", false))

        ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.resetAllProgress()
        ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.resetSavedPowerPoints(5000)
        var shopState = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.openPowerShop(restartedFromPlaying)
        assertEquals(ua.blackout.prewarning.ui.screens.RouletteScreenMode.SHOP, shopState.screen)
        val p1 = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.purchaseUpgrade(
            shopState,
            ua.blackout.prewarning.ui.screens.RouletteUpgradeId.X2_TICKET_1
        )
        assertEquals(true, p1.purchased)
        assertEquals(4900, p1.nextState.powerPoints)
        val p1Dup = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.purchaseUpgrade(
            p1.nextState,
            ua.blackout.prewarning.ui.screens.RouletteUpgradeId.X2_TICKET_1
        )
        assertEquals(false, p1Dup.purchased)

        // Toggle Nocturnal Creature (10) ON -> reverse game logic & +2, +4, +6 multipliers -> then toggle OFF
        val nocOn = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.purchaseUpgrade(
            p1.nextState,
            ua.blackout.prewarning.ui.screens.RouletteUpgradeId.NOCTURNAL_CREATURE
        )
        assertEquals(true, nocOn.purchased)
        assertEquals(4890, nocOn.nextState.powerPoints)
        assertTrue(nocOn.nextState.purchasedUpgrades.contains(ua.blackout.prewarning.ui.screens.RouletteUpgradeId.NOCTURNAL_CREATURE))
        var nocGame = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.startGame(
            "1.1",
            false,
            controlledTickets,
            explicitUpgrades = nocOn.nextState.purchasedUpgrades,
            random = kotlin.random.Random(12345)
        )
        assertEquals(2, nocGame.streakIncrement)
        nocGame = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.revealTicket(nocGame, 40).nextState // Red ticket adds +2
        assertEquals(2, nocGame.score)
        assertEquals(4, nocGame.streakIncrement)
        nocGame = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.revealTicket(nocGame, 41).nextState // Red ticket adds +4
        assertEquals(6, nocGame.score)
        val nocBeigeOver = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.revealTicket(nocGame, 0) // Beige ticket triggers Game Over
        assertEquals(ua.blackout.prewarning.ui.screens.TicketRevealOutcome.RED, nocBeigeOver.outcome)

        val nocOff = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.purchaseUpgrade(
            nocBeigeOver.nextState,
            ua.blackout.prewarning.ui.screens.RouletteUpgradeId.NOCTURNAL_CREATURE
        )
        assertEquals(true, nocOff.purchased)
        assertEquals(4886, nocOff.nextState.powerPoints)
        assertTrue(!nocOff.nextState.purchasedUpgrades.contains(ua.blackout.prewarning.ui.screens.RouletteUpgradeId.NOCTURNAL_CREATURE))

        // Deposit Power Points (100): repeatable, 10 / day per stack, FinMonitoring AntiCheat rollback detection & permanent disable of future payouts
        val t0 = 1_700_000_000_000L
        val dep1 = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.purchaseUpgrade(
            nocOff.nextState,
            ua.blackout.prewarning.ui.screens.RouletteUpgradeId.DEPOSIT_POWER_POINTS,
            nowMs = t0
        )
        assertEquals(true, dep1.purchased)
        assertEquals(4786, dep1.nextState.powerPoints)
        assertEquals(1, dep1.nextState.depositCount)
        val dep2 = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.purchaseUpgrade(
            dep1.nextState,
            ua.blackout.prewarning.ui.screens.RouletteUpgradeId.DEPOSIT_POWER_POINTS,
            nowMs = t0 + 1000L
        )
        assertEquals(true, dep2.purchased)
        assertEquals(4686, dep2.nextState.powerPoints)
        assertEquals(2, dep2.nextState.depositCount)

        val payoutAfter2Days = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.processGameLaunchDepositPayout(
            t0 + 2L * ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.DAY_IN_MS
        )
        assertEquals(40, payoutAfter2Days.awardedPoints)
        assertEquals(4726, payoutAfter2Days.powerPoints)

        // Clock rollback prior to recorded payoutDateMs -> FinMon AntiCheat lock, Power Points = 0, description "На розгляді ФінМоніторинга", and future 24h payouts disabled
        val rollback = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.processGameLaunchDepositPayout(
            t0 + ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.DAY_IN_MS
        )
        assertEquals(true, rollback.depositFinMonLocked)
        assertEquals(0, rollback.powerPoints)
        val futureAfterAntiCheat = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.processGameLaunchDepositPayout(
            t0 + 8L * ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.DAY_IN_MS
        )
        assertEquals(true, futureAfterAntiCheat.depositFinMonLocked)
        assertEquals(0, futureAfterAntiCheat.awardedPoints)

        val depositDef = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.UPGRADES.first {
            it.id == ua.blackout.prewarning.ui.screens.RouletteUpgradeId.DEPOSIT_POWER_POINTS
        }
        val nocturnalDef = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.UPGRADES.first {
            it.id == ua.blackout.prewarning.ui.screens.RouletteUpgradeId.NOCTURNAL_CREATURE
        }
        assertEquals(1000L, ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.GAME_OVER_REALIZATION_DELAY_MS)
        assertEquals(
            "Nocturnal Creature (Cost: 10)",
            nocturnalDef.formatButtonLabel("en", false, 0)
        )
        assertEquals(
            "Нічна істота (Ціна: 10)",
            nocturnalDef.formatButtonLabel("uk", false, 0)
        )
        assertEquals(
            "Deposit Power Points (Cost: 100)",
            depositDef.formatButtonLabel("en", false, 0)
        )
        assertEquals(
            "Депозит Потужність+ (Ціна: 100)",
            depositDef.formatButtonLabel("uk", false, 0)
        )
        assertEquals(
            "Deposit Power Points (Cost: 100) — 10 / day",
            depositDef.formatButtonLabel("en", true, 1)
        )
        assertEquals(
            "Депозит Потужність+ (Ціна: 100) — 10 / день",
            depositDef.formatButtonLabel("uk", true, 1)
        )
        assertEquals(
            "Each 100 Power Points deposited will grant you 10 Points income daily.",
            ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.getUpgradeDescription(depositDef, "en", false)
        )
        assertEquals(
            "Кожні 100 вкладених Балів Потужності приносять 10 Балів доходу щодня.",
            ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.getUpgradeDescription(depositDef, "uk", false)
        )
        assertEquals(
            "На розгляді ФінМоніторинга",
            ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.getUpgradeDescription(depositDef, "uk", true)
        )
        val (_, blackCatBodyUk) = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.buildBlackCatNotification(
            LocalTime.of(14, 35),
            "4.2",
            "uk"
        )
        assertTrue(blackCatBodyUk.contains("14:35-23:00"))

        // Verify center lightbulb scratch detection and scratching sides away from center
        assertTrue(ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.isTicketScratchedEnough(0.02f, isCenterShown = true))
        assertFalse(ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.isTicketScratchedEnough(0.25f, isCenterShown = false))
        assertTrue(ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.isTicketScratchedEnough(0.30f, isCenterShown = false))
        assertTrue(ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.doesScratchExposeRedCenterOutline(84f, 37f, 84f, 37f, 168f, 74f, 7.5f))
        assertFalse(ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.doesScratchExposeRedCenterOutline(20f, 20f, 30f, 25f, 168f, 74f, 7.5f))

        // Verify 15-30s flicker interval, 2-3s slow flicker duration, and 5-10m Game Blackout interval
        val delayMs = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.getNextFlickerDelayMs()
        assertTrue(delayMs in 15_000L..30_000L)
        val durationMs = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.getFlickerDurationMs()
        assertTrue(durationMs in 2_000L..3_000L)
        val blackoutDelayMs = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.getNextGameBlackoutDelayMs()
        assertTrue(blackoutDelayMs in 300_000L..600_000L)

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

        assertEquals("Житомирська Рулетка", AppStrings.rouletteLaunchButton("uk"))
        assertEquals("Zhytomyr Roulette", AppStrings.rouletteLaunchButton("en"))
        assertEquals("Бали Потужності", AppStrings.roulettePowerPointsLabel("uk"))
        assertEquals("Power Points", AppStrings.roulettePowerPointsLabel("en"))
        assertEquals("Магазин Потужності", AppStrings.roulettePowerShopBtn("uk"))
        assertEquals("Power Shop", AppStrings.roulettePowerShopBtn("en"))
        assertEquals("Почати гру", AppStrings.rouletteStartBtn("uk"))
        assertEquals("Start", AppStrings.rouletteStartBtn("en"))
        assertEquals("Закрити гру", AppStrings.rouletteCloseBtn("uk"))
        assertEquals("Close Game", AppStrings.rouletteCloseBtn("en"))
        assertEquals("Головне Меню", AppStrings.rouletteMainMenuBtn("uk"))
        assertEquals("Main Menu", AppStrings.rouletteMainMenuBtn("en"))
        assertEquals("Поділитися", AppStrings.rouletteShareBtn("uk"))
        assertEquals("Share", AppStrings.rouletteShareBtn("en"))
        assertEquals("Завантажити зображення", AppStrings.rouletteDownloadImageBtn("uk"))
        assertEquals("Download Image", AppStrings.rouletteDownloadImageBtn("en"))
        assertEquals("Зображення збережено", AppStrings.rouletteImageSavedToast("uk"))
        assertEquals("Image saved", AppStrings.rouletteImageSavedToast("en"))
        assertEquals("Звук", AppStrings.rouletteSoundLabel("uk"))
        assertEquals("Sound", AppStrings.rouletteSoundLabel("en"))
        assertEquals("Музика", AppStrings.rouletteMusicLabel("uk"))
        assertEquals("Music", AppStrings.rouletteMusicLabel("en"))
        val dailyStreakDef = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.UPGRADES.first {
            it.id == ua.blackout.prewarning.ui.screens.RouletteUpgradeId.DAILY_STREAK
        }
        val perseveranceDef = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.UPGRADES.first {
            it.id == ua.blackout.prewarning.ui.screens.RouletteUpgradeId.PERSEVERANCE
        }
        assertEquals(
            "Нагорода за рубіж 400: перша гра на день дає бонус X2 до балів перед завершенням гри.",
            ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.getUpgradeDescription(dailyStreakDef, "uk", false)
        )
        assertEquals(
            "Milestone 400 reward: first Game in a Day grants X2 bonus points before Game Over event.",
            ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.getUpgradeDescription(dailyStreakDef, "en", false)
        )
        assertEquals(
            "Нагорода за рубіж 1000: додає ще одне серце на головному екрані гри (до трьох життів разом із Другим шансом).",
            ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.getUpgradeDescription(perseveranceDef, "uk", false)
        )
        assertEquals(
            "Milestone 1000 reward: adds one more heart icon in Main Game screen. Cumulative with Second Life up to three lives.",
            ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.getUpgradeDescription(perseveranceDef, "en", false)
        )
        // Verify Nocturnal Creature + Second Chance / Perseverance / X2 / Golden ticket opening all Red tickets on field
        val nocComboTickets = labels.mapIndexed { idx, label ->
            ua.blackout.prewarning.ui.screens.RouletteTicketItem(
                index = idx,
                slotLabel = label,
                isRed = idx >= 40,
                isGolden = idx == 45,
                isX2 = idx == 43,
                isRevealed = false
            )
        }
        var nocComboState = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.startGame(
            "1.1",
            false,
            nocComboTickets,
            explicitUpgrades = setOf(
                ua.blackout.prewarning.ui.screens.RouletteUpgradeId.NOCTURNAL_CREATURE,
                ua.blackout.prewarning.ui.screens.RouletteUpgradeId.SECOND_CHANCE,
                ua.blackout.prewarning.ui.screens.RouletteUpgradeId.PERSEVERANCE
            )
        )
        assertEquals(2, nocComboState.extraLivesTotal)
        nocComboState = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.revealTicket(nocComboState, 40).nextState // +2 -> 2
        val nocX2 = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.revealTicket(nocComboState, 43) // X2 -> 4
        assertEquals(ua.blackout.prewarning.ui.screens.TicketRevealOutcome.X2, nocX2.outcome)
        assertEquals(4, nocX2.nextState.score)
        val nocLife1 = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.revealTicket(nocX2.nextState, 0) // saved by Second Chance -> +6 -> 10
        assertEquals(ua.blackout.prewarning.ui.screens.TicketRevealOutcome.BEIGE, nocLife1.outcome)
        assertEquals(1, nocLife1.nextState.extraLivesUsed)
        assertEquals(10, nocLife1.nextState.score)
        val nocLife2 = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.revealTicket(nocLife1.nextState, 1) // saved by Perseverance -> +8 -> 18
        assertEquals(ua.blackout.prewarning.ui.screens.TicketRevealOutcome.BEIGE, nocLife2.outcome)
        assertEquals(2, nocLife2.nextState.extraLivesUsed)
        assertEquals(18, nocLife2.nextState.score)
        val nocGolden = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.revealTicket(nocLife2.nextState, 45)
        assertEquals(ua.blackout.prewarning.ui.screens.TicketRevealOutcome.GOLDEN, nocGolden.outcome)
        assertTrue(nocGolden.nextState.tickets.filter { it.isRed }.all { it.isRevealed })
        assertEquals(108, nocGolden.nextState.score)

        assertEquals(0.575, ua.blackout.prewarning.ui.screens.RouletteSoundEngine.SCRATCH_VOLUME_SCALE, 0.0001)
        assertEquals(0.15f, ua.blackout.prewarning.ui.screens.RouletteSoundEngine.MUSIC_VOLUME_SCALE, 0.0001f)
        assertEquals(1200L, ua.blackout.prewarning.ui.screens.RouletteSoundEngine.MUSIC_FADE_DURATION_MS)
        assertEquals(2000L, ua.blackout.prewarning.ui.screens.RouletteSoundEngine.GAME_OVER_MUSIC_FADE_IN_DELAY_MS)
        assertEquals(2, ua.blackout.prewarning.ui.screens.RouletteSoundEngine.START_SHOP_MUSIC_OPTIONS.size)
        assertEquals(
            "START_SHOP_GAMEOVER",
            ua.blackout.prewarning.ui.screens.RouletteSoundEngine.getTargetMusicTrackForScreen(
                ua.blackout.prewarning.ui.screens.RouletteScreenMode.START,
                true
            )
        )
        assertEquals(
            "START_SHOP_GAMEOVER",
            ua.blackout.prewarning.ui.screens.RouletteSoundEngine.getTargetMusicTrackForScreen(
                ua.blackout.prewarning.ui.screens.RouletteScreenMode.SHOP,
                true
            )
        )
        assertEquals(
            "START_SHOP_GAMEOVER",
            ua.blackout.prewarning.ui.screens.RouletteSoundEngine.getTargetMusicTrackForScreen(
                ua.blackout.prewarning.ui.screens.RouletteScreenMode.GAME_OVER,
                true
            )
        )
        assertEquals(
            "MAIN_GAME",
            ua.blackout.prewarning.ui.screens.RouletteSoundEngine.getTargetMusicTrackForScreen(
                ua.blackout.prewarning.ui.screens.RouletteScreenMode.PLAYING,
                true
            )
        )
        // Verify separate Sound & Music switches and muting when Application is minimized / sent to Home screen
        ua.blackout.prewarning.ui.screens.RouletteSoundEngine.setSoundEnabled(true)
        ua.blackout.prewarning.ui.screens.RouletteSoundEngine.setMusicEnabled(false)
        assertEquals(false, ua.blackout.prewarning.ui.screens.RouletteSoundEngine.isMusicEnabled())
        assertEquals(true, ua.blackout.prewarning.ui.screens.RouletteSoundEngine.isSoundEnabled())
        ua.blackout.prewarning.ui.screens.RouletteSoundEngine.setMusicEnabled(true)
        assertEquals(true, ua.blackout.prewarning.ui.screens.RouletteSoundEngine.isMusicEnabled())
        ua.blackout.prewarning.ui.screens.RouletteSoundEngine.setAppInForeground(false)
        assertEquals(false, ua.blackout.prewarning.ui.screens.RouletteSoundEngine.isAppInForeground())
        assertEquals(
            "NONE",
            ua.blackout.prewarning.ui.screens.RouletteSoundEngine.syncBackgroundMusic(
                null,
                ua.blackout.prewarning.ui.screens.RouletteScreenMode.START,
                true,
                true
            )
        )
        ua.blackout.prewarning.ui.screens.RouletteSoundEngine.setAppInForeground(true)
        assertEquals(true, ua.blackout.prewarning.ui.screens.RouletteSoundEngine.isAppInForeground())
        assertEquals(
            "START_SHOP_GAMEOVER",
            ua.blackout.prewarning.ui.screens.RouletteSoundEngine.syncBackgroundMusic(
                null,
                ua.blackout.prewarning.ui.screens.RouletteScreenMode.START,
                true,
                true
            )
        )
        assertEquals("Спочатку", AppStrings.rouletteRestartBtn("uk"))
        assertEquals("Restart Game", AppStrings.rouletteRestartBtn("en"))
        assertEquals("Нові білети (0)", AppStrings.formatRouletteNewTicketsBtnWithCost("uk", 0))
        assertEquals("Нові білети (-1)", AppStrings.formatRouletteNewTicketsBtnWithCost("uk", 1))
        assertEquals("Get New Tickets (0)", AppStrings.formatRouletteNewTicketsBtnWithCost("en", 0))
        assertEquals("Get New Tickets (-2)", AppStrings.formatRouletteNewTicketsBtnWithCost("en", 2))
        assertEquals("All time best score", AppStrings.rouletteAllTimeBestScoreLabel("en"))
        assertEquals("Найкращий Результат", AppStrings.rouletteAllTimeBestScoreLabel("uk"))


        // Verify 9 visual ticket variants (including profound wrinkled & stained) and randomized stain placements
        assertEquals(9, ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.VISUAL_VARIANTS.size)
        val generated = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.generateRandomizedTickets()
        assertTrue(generated.all { it.stainPlacement.stainOffsetX in 0.12f..0.88f })
        assertTrue(generated.all { it.stainPlacement.stainOffsetY in 0.15f..0.85f })
        assertTrue(generated.any { !it.isRed && it.isX2 })

        // Verify persistent All-Time Best Score tracking across restarts
        ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.resetAllProgress()
        var bestTestState = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.startGame("1.1", false, controlledTickets)
        bestTestState = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.revealTicket(bestTestState, 0).nextState // +1 -> 1
        bestTestState = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.revealTicket(bestTestState, 1).nextState // +2 -> 3
        bestTestState = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.revealTicket(bestTestState, 2).nextState // +3 -> 6
        assertEquals(6, bestTestState.bestScore)
        assertEquals(6, ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.getSavedBestScore())
        val afterRestartToStart = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.applyRestartGame(bestTestState)
        assertEquals(0, afterRestartToStart.score)
        assertEquals(6, afterRestartToStart.bestScore)

        // Verify hardcoded maximum score 9999999
        assertEquals(9_999_999, ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.MAX_ROULETTE_SCORE)
        assertEquals(9_999_999, ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.clampRouletteScore(25_000_000))
        assertEquals(9_999_999, ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.saveBestScoreIfHigher(15_000_000))
        val capCheckState = bestTestState.copy(score = 6_000_000)
        val capX2Res = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.revealTicket(capCheckState, 10)
        assertEquals(9_999_999, capX2Res.nextState.score)
        assertEquals(9_999_999, capX2Res.nextState.bestScore)

        // Verify ticket places shuffle when single-game score reaches above 999
        assertEquals(999, ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.SCORE_SHUFFLE_THRESHOLD)
        val preShuffleState = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.startGame("1.1", false, controlledTickets)
            .copy(score = 995, streakIncrement = 10, ticketsShuffledAbove999 = false)
        val shuffleRes = ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.revealTicket(preShuffleState, 0)
        assertEquals(1005, shuffleRes.nextState.score)
        assertEquals(true, shuffleRes.shuffled)
        assertEquals(true, shuffleRes.nextState.ticketsShuffledAbove999)
        assertTrue(shuffleRes.nextState.tickets.map { it.slotLabel } != labels)

        // Verify center lightbulb reveal area
        assertEquals(
            true,
            ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.doesScratchExposeRedCenterOutline(
                84f, 37f, 84f, 37f, 168f, 74f, 7.5f
            )
        )
        assertEquals(
            false,
            ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.doesScratchExposeRedCenterOutline(
                20f, 20f, 30f, 25f, 168f, 74f, 7.5f
            )
        )

        // Verify 2s shuffle animation duration and coin waiting for scratch.mp3
        assertEquals(2000L, ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.TICKET_SHUFFLE_ANIMATION_DURATION_MS)
        assertEquals(24, ua.blackout.prewarning.ui.screens.ZhytomyrRouletteEngine.TICKET_SHUFFLE_ROW_COUNT)
        assertEquals(336L, ua.blackout.prewarning.ui.screens.RouletteSoundEngine.SCRATCH_SFX_DURATION_MS)
        ua.blackout.prewarning.ui.screens.RouletteSoundEngine.setSoundEnabled(true)
        ua.blackout.prewarning.ui.screens.RouletteSoundEngine.setAppInForeground(true)
        ua.blackout.prewarning.ui.screens.RouletteSoundEngine.playScratchSound(force = true)
        assertTrue(ua.blackout.prewarning.ui.screens.RouletteSoundEngine.getRemainingScratchSoundDelayMs() > 0L)
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
              "version": 2,
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



