package ua.blackout.prewarning.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import ua.blackout.prewarning.core.SiteState
import ua.blackout.prewarning.data.KYIV_ZONE
import ua.blackout.prewarning.data.repository.OutageSnapshot
import ua.blackout.prewarning.data.repository.PowerOnSnapshot
import ua.blackout.prewarning.data.repository.SiteSnapshot
import ua.blackout.prewarning.ui.components.StatusIcon
import ua.blackout.prewarning.ui.components.StatusTone
import ua.blackout.prewarning.ui.components.SiteStatusModel
import java.time.LocalDateTime

/** Which site and PowerOn status the main screen shows (chips in the "Last updated" card, banner above the hero). */
class SiteStatusModelTest {

    private val now = LocalDateTime.of(2026, 11, 13, 12, 0)
    private val goodAt = LocalDateTime.of(2026, 11, 13, 9, 30).atZone(KYIV_ZONE).toInstant().toEpochMilli()

    private fun snapshot(
        state: SiteState?,
        queue: String = "5.2",
        plannedKnown: Boolean = true,
        tomorrowPublished: Boolean = false,
        lastSuccessMs: Long? = goodAt,
        poweron: PowerOnSnapshot? = null,
        notice: String? = null
    ) = OutageSnapshot(
        now = now,
        queue = queue,
        outages = emptyList(),
        plannedKnown = plannedKnown,
        tomorrowPublished = tomorrowPublished,
        site = state?.let { SiteSnapshot(it, checkedAtMs = goodAt, lastSuccessMs = lastSuccessMs, notice = notice) },
        poweron = poweron,
        hasAddress = true
    )

    @Test
    fun healthySiteShowsGreenChipAndNoBanner() {
        val s = snapshot(SiteState.AVAILABLE_WITH_TABLE, tomorrowPublished = true)
        val chips = SiteStatusModel.chips(s, "uk")
        assertEquals(2, chips.size)
        assertEquals(StatusTone.GREEN, chips[0].tone)
        assertEquals(StatusIcon.OK, chips[0].icon)
        assertEquals("Сайт ZTOE доступний, графік опубліковано", chips[0].text)
        assertEquals(StatusTone.GREEN, chips[1].tone)
        assertEquals("Графік на завтра: опубліковано", chips[1].text)
        assertNull(SiteStatusModel.banner(s, "uk"))
    }

    @Test
    fun siteWithoutTableIsAmberAndShowsStaleTime() {
        val s = snapshot(SiteState.AVAILABLE_NO_TABLE)
        val chips = SiteStatusModel.chips(s, "uk")
        assertEquals(StatusTone.AMBER, chips[0].tone)
        assertEquals(StatusIcon.WARNING, chips[0].icon)
        assertTrue(chips.any { it.tone == StatusTone.AMBER && it.text == "дані за 09:30" })
        assertTrue(chips.any { it.text == "Графік на завтра: ще немає" && it.tone == StatusTone.GREY })
        val banner = SiteStatusModel.banner(s, "uk")
        assertNotNull(banner)
        assertEquals(StatusTone.AMBER, banner!!.tone)
        assertEquals("Сайт ZTOE доступний, але графіка немає", banner.title)
        assertEquals(
            "Показано збережений графік (дані за 09:30)\nГрафік ще не опубліковано або сторінка змінилась.",
            banner.message
        )
    }

    @Test
    fun unreachableSiteIsRedAndOfflineIsGrey() {
        val red = SiteStatusModel.banner(snapshot(SiteState.SITE_UNREACHABLE), "en")!!
        assertEquals(StatusTone.RED, red.tone)
        assertEquals(StatusIcon.SERVER_DOWN, red.icon)
        assertEquals("ZTOE site unreachable, your internet works", red.title)

        val grey = SiteStatusModel.banner(snapshot(SiteState.NO_INTERNET), "en")!!
        assertEquals(StatusTone.GREY, grey.tone)
        assertEquals(StatusIcon.OFFLINE, grey.icon)
        assertEquals("No internet connection", grey.title)
    }

    @Test
    fun staleHintIsOmittedWhenThereIsNoCachedSchedule() {
        val s = snapshot(SiteState.SITE_UNREACHABLE, plannedKnown = false)
        val banner = SiteStatusModel.banner(s, "uk")!!
        assertEquals("Застосунок повторить спробу сам.", banner.message)
        assertTrue(SiteStatusModel.chips(s, "uk").none { it.text.startsWith("дані за") })
    }

    @Test
    fun siteNotCheckedYetShowsGreyChecking() {
        val chips = SiteStatusModel.chips(snapshot(null), "uk")
        assertEquals(StatusTone.GREY, chips[0].tone)
        assertEquals("Перевірка сайту ZTOE…", chips[0].text)
        assertNull(SiteStatusModel.banner(snapshot(null), "uk"))
    }

    @Test
    fun nothingIsShownWithoutAQueue() {
        val s = snapshot(SiteState.SITE_UNREACHABLE, queue = "")
        assertTrue(SiteStatusModel.chips(s, "uk").isEmpty())
        assertNull(SiteStatusModel.banner(s, "uk"))
    }

    @Test
    fun poweronLineOnlyWhenTheLastRefreshFailed() {
        val bad = snapshot(SiteState.AVAILABLE_WITH_TABLE, poweron = PowerOnSnapshot(ok = false, checkedAtMs = goodAt, lastOkMs = null))
        assertEquals("Аварійні відключення: дані недоступні", SiteStatusModel.poweronLine(bad, "uk")!!.text)
        assertEquals(StatusTone.AMBER, SiteStatusModel.poweronLine(bad, "uk")!!.tone)
        val good = snapshot(SiteState.AVAILABLE_WITH_TABLE, poweron = PowerOnSnapshot(ok = true, checkedAtMs = goodAt, lastOkMs = goodAt))
        assertNull(SiteStatusModel.poweronLine(good, "uk"))
        assertNull(SiteStatusModel.poweronLine(snapshot(SiteState.AVAILABLE_WITH_TABLE), "uk"))
    }

    @Test
    fun siteNoticeShowsOnlyWhilePageHasNoTable() {
        val text = "УВАГА! ВАЖЛИВА ІНФОРМАЦІЯ!\nГрафіки погодинних відключень електроенергії наразі не діють."
        assertEquals(text, SiteStatusModel.notice(snapshot(SiteState.AVAILABLE_NO_TABLE, notice = text)))
        // Concerns everybody: shown without a queue too
        assertEquals(text, SiteStatusModel.notice(snapshot(SiteState.AVAILABLE_NO_TABLE, queue = "", notice = text)))
        assertNull(SiteStatusModel.notice(snapshot(SiteState.AVAILABLE_WITH_TABLE, notice = text)))
        assertNull(SiteStatusModel.notice(snapshot(SiteState.AVAILABLE_NO_TABLE, notice = "  ")))
        assertNull(SiteStatusModel.notice(snapshot(null)))
    }

    @Test
    fun noticeCardReplacesTheNoTableBanner() {
        val text = "УВАГА! ВАЖЛИВА ІНФОРМАЦІЯ!\nГрафіки погодинних відключень електроенергії наразі не діють."
        val s = snapshot(SiteState.AVAILABLE_NO_TABLE, notice = text)
        assertNull(SiteStatusModel.banner(s, "uk"))
        // The chip below keeps naming the state
        assertEquals(StatusTone.AMBER, SiteStatusModel.chips(s, "uk")[0].tone)
        // Without a notice the banner is back
        assertNotNull(SiteStatusModel.banner(snapshot(SiteState.AVAILABLE_NO_TABLE), "uk"))
    }
}
