package ua.blackout.prewarning.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.Event
import androidx.compose.material.icons.filled.EventBusy
import androidx.compose.material.icons.filled.HelpOutline
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import ua.blackout.prewarning.core.SiteState
import ua.blackout.prewarning.data.KYIV_ZONE
import ua.blackout.prewarning.data.repository.OutageSnapshot
import ua.blackout.prewarning.ui.AppStrings
import ua.blackout.prewarning.ui.theme.ZtColors
import ua.blackout.prewarning.ui.theme.ZtShapes
import ua.blackout.prewarning.ui.theme.ZtType
import java.time.Instant
import java.time.ZoneId

/** Colour family of a status chip or banner (UI_PROPOSALS section 3.3). Never the only cue: each also has an icon and text. */
enum class StatusTone { GREEN, AMBER, RED, GREY }

enum class StatusIcon { OK, WARNING, SERVER_DOWN, OFFLINE, UNKNOWN, TOMORROW_OK, TOMORROW_PENDING }

data class StatusChip(val tone: StatusTone, val icon: StatusIcon, val text: String)

data class SiteBanner(val tone: StatusTone, val icon: StatusIcon, val title: String, val message: String)

/** Pure rules that decide which site and PowerOn status the main screen shows, so they can be unit tested. */
object SiteStatusModel {

    fun formatHhmm(epochMs: Long, zone: ZoneId = KYIV_ZONE): String {
        val t = Instant.ofEpochMilli(epochMs).atZone(zone)
        return "${t.hour.toString().padStart(2, '0')}:${t.minute.toString().padStart(2, '0')}"
    }

    private fun siteText(lang: String, state: SiteState): String = when (state) {
        SiteState.AVAILABLE_WITH_TABLE -> AppStrings.siteStateWithTable(lang)
        SiteState.AVAILABLE_NO_TABLE -> AppStrings.siteStateNoTable(lang)
        SiteState.SITE_UNREACHABLE -> AppStrings.siteStateUnreachable(lang)
        SiteState.NO_INTERNET -> AppStrings.siteStateNoInternet(lang)
    }

    private fun tone(state: SiteState) = when (state) {
        SiteState.AVAILABLE_WITH_TABLE -> StatusTone.GREEN
        SiteState.AVAILABLE_NO_TABLE -> StatusTone.AMBER
        SiteState.SITE_UNREACHABLE -> StatusTone.RED
        SiteState.NO_INTERNET -> StatusTone.GREY
    }

    private fun icon(state: SiteState) = when (state) {
        SiteState.AVAILABLE_WITH_TABLE -> StatusIcon.OK
        SiteState.AVAILABLE_NO_TABLE -> StatusIcon.WARNING
        SiteState.SITE_UNREACHABLE -> StatusIcon.SERVER_DOWN
        SiteState.NO_INTERNET -> StatusIcon.OFFLINE
    }

    private fun hint(lang: String, state: SiteState): String? = when (state) {
        SiteState.AVAILABLE_WITH_TABLE -> null
        SiteState.AVAILABLE_NO_TABLE -> AppStrings.siteStateHintNoTable(lang)
        SiteState.SITE_UNREACHABLE -> AppStrings.siteStateHintUnreachable(lang)
        SiteState.NO_INTERNET -> AppStrings.siteStateHintNoInternet(lang)
    }

    /** Chip row of the "Last updated" card. Empty when no queue is selected (nothing is checked then). */
    fun chips(snapshot: OutageSnapshot, lang: String, zone: ZoneId = KYIV_ZONE): List<StatusChip> {
        if (snapshot.queue.isBlank()) return emptyList()
        val out = ArrayList<StatusChip>()
        val site = snapshot.site
        if (site == null) {
            out.add(StatusChip(StatusTone.GREY, StatusIcon.UNKNOWN, AppStrings.siteStateChecking(lang)))
        } else {
            out.add(StatusChip(tone(site.state), icon(site.state), siteText(lang, site.state)))
        }
        if (snapshot.isStale) {
            val since = site?.lastSuccessMs?.let { formatHhmm(it, zone) }
            if (since != null) out.add(StatusChip(StatusTone.AMBER, StatusIcon.WARNING, AppStrings.staleChip(lang, since)))
        }
        if (snapshot.tomorrowPublished) {
            out.add(StatusChip(StatusTone.GREEN, StatusIcon.TOMORROW_OK, AppStrings.tomorrowPublished(lang)))
        } else {
            out.add(StatusChip(StatusTone.GREY, StatusIcon.TOMORROW_PENDING, AppStrings.tomorrowNotPublishedShort(lang)))
        }
        return out
    }

    /** Small status line shown only when the last PowerOn (emergency outages) refresh failed. */
    fun poweronLine(snapshot: OutageSnapshot, lang: String): StatusChip? =
        if (snapshot.poweron?.ok == false) {
            StatusChip(StatusTone.AMBER, StatusIcon.WARNING, AppStrings.poweronUnavailable(lang))
        } else {
            null
        }

    /**
     * The site's own notice ("УВАГА! ВАЖЛИВА ІНФОРМАЦІЯ!") while the page is up but has no schedule
     * table. Shown even without a queue: it concerns everybody in the region.
     */
    fun notice(snapshot: OutageSnapshot): String? {
        val site = snapshot.site ?: return null
        return site.notice?.takeIf { site.state == SiteState.AVAILABLE_NO_TABLE && it.isNotBlank() }
    }

    /**
     * Glass banner above the hero, for degraded site states only. Not shown while the ztoe notice card
     * is: the notice already explains the missing table and the chip below still names the state.
     */
    fun banner(snapshot: OutageSnapshot, lang: String, zone: ZoneId = KYIV_ZONE): SiteBanner? {
        if (snapshot.queue.isBlank()) return null
        val site = snapshot.site ?: return null
        if (site.state == SiteState.AVAILABLE_WITH_TABLE) return null
        if (notice(snapshot) != null) return null
        val since = if (snapshot.isStale) site.lastSuccessMs?.let { formatHhmm(it, zone) } else null
        val message = listOfNotNull(since?.let { AppStrings.staleDataSince(lang, it) }, hint(lang, site.state))
            .joinToString("\n")
        return SiteBanner(tone(site.state), icon(site.state), siteText(lang, site.state), message)
    }
}

private fun StatusTone.background(): Color = when (this) {
    StatusTone.GREEN -> ZtColors.ChipGreen
    StatusTone.AMBER -> ZtColors.ChipAmber
    StatusTone.RED -> ZtColors.ChipRed
    StatusTone.GREY -> ZtColors.ChipGrey
}

private fun StatusTone.content(): Color = when (this) {
    StatusTone.GREEN -> ZtColors.ChipGreenText
    StatusTone.AMBER -> ZtColors.ChipAmberText
    StatusTone.RED -> ZtColors.ChipRedText
    StatusTone.GREY -> ZtColors.ChipGreyText
}

private fun StatusIcon.vector(): ImageVector = when (this) {
    StatusIcon.OK -> Icons.Default.CheckCircle
    StatusIcon.WARNING -> Icons.Default.Warning
    StatusIcon.SERVER_DOWN -> Icons.Default.CloudOff
    StatusIcon.OFFLINE -> Icons.Default.WifiOff
    StatusIcon.UNKNOWN -> Icons.Default.HelpOutline
    StatusIcon.TOMORROW_OK -> Icons.Default.Event
    StatusIcon.TOMORROW_PENDING -> Icons.Default.EventBusy
}

/** One status pill: tinted background, icon and text in the same family. Text wraps instead of clipping. */
@Composable
fun StatusChipView(chip: StatusChip, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .clip(ZtShapes.Badge)
            .background(chip.tone.background())
            .padding(horizontal = 10.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Icon(
            imageVector = chip.icon.vector(),
            contentDescription = null,
            tint = chip.tone.content(),
            modifier = Modifier.size(16.dp)
        )
        Text(text = chip.text, style = ZtType.label, color = chip.tone.content())
    }
}

/** Chips for the "Last updated" card, plus the PowerOn status line when that source is down. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SiteStatusChipRow(snapshot: OutageSnapshot, lang: String, modifier: Modifier = Modifier) {
    val chips = SiteStatusModel.chips(snapshot, lang)
    val poweron = SiteStatusModel.poweronLine(snapshot, lang)
    if (chips.isEmpty() && poweron == null) return
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (chips.isNotEmpty()) {
            FlowRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                chips.forEach { StatusChipView(it) }
            }
        }
        if (poweron != null) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Icon(
                    imageVector = poweron.icon.vector(),
                    contentDescription = null,
                    tint = poweron.tone.content(),
                    modifier = Modifier.size(16.dp)
                )
                Text(text = poweron.text, style = ZtType.caption, color = poweron.tone.content())
            }
        }
    }
}

/** Information card with the text ztoe publishes in place of the schedule, quoted as is. */
@Composable
fun SiteNoticeCard(text: String, lang: String, modifier: Modifier = Modifier) {
    GlassCard(
        modifier = modifier
            .fillMaxWidth()
            .semantics(mergeDescendants = true) { contentDescription = AppStrings.siteNoticeA11y(lang) + ". " + text }
    ) {
        Row(
            verticalAlignment = Alignment.Top,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(ZtColors.ChipAmber),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Info,
                    contentDescription = null,
                    tint = ZtColors.ChipAmberText,
                    modifier = Modifier.size(20.dp)
                )
            }
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Text(text = AppStrings.siteNoticeTitle(lang), style = ZtType.overline, color = ZtColors.ChipAmberText)
                text.lines().forEachIndexed { i, line ->
                    Text(
                        text = line,
                        style = if (i == 0) ZtType.subhead else ZtType.body,
                        color = if (i == 0) Color.White else Color(0xE6BAE6FD)
                    )
                }
            }
        }
    }
}

/**
 * Persistent glass banner for a degraded site state (not a 3 s toast). Compact: the title and each
 * message line keep to one line each (two lines for the usual banner).
 */
@Composable
fun SiteStatusBanner(banner: SiteBanner, modifier: Modifier = Modifier) {
    GlassCard(
        modifier = modifier
            .fillMaxWidth()
            .semantics(mergeDescendants = true) { liveRegion = LiveRegionMode.Polite },
        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 12.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(banner.tone.background()),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = banner.icon.vector(),
                    contentDescription = null,
                    tint = banner.tone.content(),
                    modifier = Modifier.size(18.dp)
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                OneLineText(text = banner.title, style = BannerTitle, color = banner.tone.content())
                banner.message.lines().filter { it.isNotBlank() }.forEach { line ->
                    // 0xE6 alpha instead of the 0xB3 token: small text on a translucent card needs the extra contrast
                    OneLineText(text = line, style = ZtType.caption, color = Color(0xE6BAE6FD))
                }
            }
        }
    }
}

private val BannerTitle = ZtType.label.copy(fontWeight = FontWeight.Bold)

/**
 * Text kept on one line: when it does not fit, the size steps down 5 % at a time to at most 15 % below
 * the style (never under 12 sp). If it still does not fit, it wraps instead of being cut.
 */
@Composable
private fun OneLineText(text: String, style: TextStyle, color: Color) = BoxWithConstraints {
    // Measured again when the width changes (rotation, split screen)
    val width = maxWidth
    val minSize = maxOf(style.fontSize.value * 0.85f, 12f)
    var size by remember(text, style, width) { mutableFloatStateOf(style.fontSize.value) }
    var wrap by remember(text, style, width) { mutableStateOf(false) }
    var settled by remember(text, style, width) { mutableStateOf(false) }
    Text(
        text = text,
        style = style.copy(fontSize = size.sp),
        color = color,
        maxLines = if (wrap) Int.MAX_VALUE else 1,
        softWrap = wrap,
        modifier = Modifier.drawWithContent { if (settled) drawContent() },
        onTextLayout = { result ->
            when {
                settled -> Unit
                !result.didOverflowWidth -> settled = true
                size * 0.95f >= minSize -> size *= 0.95f
                else -> { wrap = true; settled = true }
            }
        }
    )
}
