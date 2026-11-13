package ua.blackout.prewarning.ui.screens

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Alarm
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.NotificationsOff
import androidx.compose.material.icons.filled.OpenInNew
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import ua.blackout.prewarning.R
import ua.blackout.prewarning.core.IntervalStatus
import ua.blackout.prewarning.core.Outage
import ua.blackout.prewarning.core.OutageKind
import ua.blackout.prewarning.core.Subscription
import ua.blackout.prewarning.core.Subscriptions
import ua.blackout.prewarning.data.KYIV_ZONE
import ua.blackout.prewarning.data.model.BlackoutSlot
import ua.blackout.prewarning.data.model.SlotStatus
import ua.blackout.prewarning.data.repository.OutageSnapshot
import ua.blackout.prewarning.data.repository.ScheduleStatusInfo
import ua.blackout.prewarning.ui.AppStrings
import ua.blackout.prewarning.ui.components.spinWhile
import ua.blackout.prewarning.ui.components.GlassCard
import ua.blackout.prewarning.ui.components.OutageRowFormat
import ua.blackout.prewarning.ui.components.SiteNoticeCard
import ua.blackout.prewarning.ui.components.SiteStatusBanner
import ua.blackout.prewarning.ui.components.SiteStatusChipRow
import ua.blackout.prewarning.ui.components.SiteStatusModel
import ua.blackout.prewarning.ui.components.TimelineBar
import ua.blackout.prewarning.ui.theme.ZtColors
import ua.blackout.prewarning.ui.theme.ZtMinTouch
import ua.blackout.prewarning.ui.theme.ZtShapes
import ua.blackout.prewarning.ui.theme.ZtType
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.format.DateTimeFormatter

// Small text sits on a translucent card: the secondary and tertiary text alphas are raised from the
// 0xB3 / 0x99 tokens so the contrast stays above 4.5:1 on bright backgrounds (docs/review/UI_PROPOSALS.md 4.9, #2).
private val TextSecondary = Color(0xE6BAE6FD)
private val TextTertiary = Color(0xCCBAE6FD)
private val InkOnAccent = Color(0xFF0B0B0A)
private val TabIdle = Color(0xCCBAE6FD)

private const val TAB_TODAY = "today"
private const val TAB_TOMORROW = "tomorrow"

private fun formatAddressAfterCity(address: String?): String? {
    if (address.isNullOrBlank()) return null
    val trimmed = address.trim()
    val commaIdx = trimmed.indexOf(',')
    if (commaIdx != -1) {
        val cityPart = trimmed.substring(0, commaIdx + 1).trim()
        val streetPart = trimmed.substring(commaIdx + 1).trim()
        if (streetPart.isNotEmpty()) {
            return "$cityPart\n$streetPart"
        }
    }
    return trimmed
}

/** Limits the font scale of the content (the 44 sp countdown must not char-wrap); other text keeps the user's scale. */
@Composable
private fun CappedFontScale(max: Float, content: @Composable () -> Unit) {
    val density = LocalDensity.current
    CompositionLocalProvider(
        LocalDensity provides Density(density.density, minOf(density.fontScale, max)),
        content = content
    )
}

/** False when the user turned system animations off (ANIMATOR_DURATION_SCALE == 0): decorative motion is skipped. */
@Composable
private fun rememberAnimationsEnabled(): Boolean {
    val context = LocalContext.current
    return remember {
        try {
            Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) != 0f
        } catch (_: Exception) {
            true
        }
    }
}

/** Status dot of the hero. The pulse is read inside graphicsLayer, so only this node redraws, never the screen. */
@Composable
private fun StatusDot(color: Color, pulsing: Boolean) {
    val animate = pulsing && rememberAnimationsEnabled()
    val scale: State<Float>? = if (animate) {
        rememberInfiniteTransition(label = "pulse").animateFloat(
            initialValue = 0.85f,
            targetValue = 1.25f,
            animationSpec = infiniteRepeatable(
                animation = tween(900, easing = FastOutSlowInEasing),
                repeatMode = RepeatMode.Reverse
            ),
            label = "pulseScale"
        )
    } else {
        null
    }
    Box(
        modifier = Modifier
            .size(10.dp)
            .graphicsLayer {
                val s = scale?.value ?: 1f
                scaleX = s
                scaleY = s
            }
            .clip(CircleShape)
            .background(color)
    )
}

@Composable
fun MainScreen(
    queue: String = "",
    customQueueStatusText: String? = null,
    selectedAddress: String? = null,
    snapshot: OutageSnapshot,
    statusInfo: ScheduleStatusInfo,
    isRefreshing: Boolean = false,
    exactAlarmMissing: Boolean = false,
    onOpenExactAlarmSettings: () -> Unit = {},
    notificationsEnabled: Boolean = true,
    lastUpdated: String = "19:27",
    nextUpdated: String = "19:57",
    @Suppress("UNUSED_PARAMETER") currentTime: LocalTime = LocalTime.now(KYIV_ZONE),
    lang: String = "uk",
    selectedLanguage: String = "SYSTEM",
    onToggleNotifications: () -> Unit = {},
    onRefresh: () -> Unit = {},
    onOpenQueueSelection: () -> Unit = {},
    onChangeLanguage: (String) -> Unit = {},
    // Address switcher (spec/SUBSCRIPTIONS.md 9): empty with fewer than 2 addresses, then Main looks as in 1.4.0
    addresses: List<Subscription> = emptyList(),
    primaryAddressId: String? = null,
    shownAddressId: String? = null,
    onSelectAddress: (String) -> Unit = {},
    showNoAlertsCaption: Boolean = false,
    onOpenSettings: () -> Unit = {}
) {
    val context = LocalContext.current

    // Everything below is derived from one outage snapshot (see OutageRepository)
    val isBlackoutNow = statusInfo.isBlackoutNow
    val countdownText = statusInfo.countdownText
    val slotTimeText = statusInfo.nextSlotTime
    val todayDate = snapshot.today
    val tomorrowDate = todayDate.plusDays(1)
    val now = snapshot.now

    // Another address starts on Today (spec/SUBSCRIPTIONS.md 9)
    var selectedDayTab by rememberSaveable(shownAddressId) { mutableStateOf(TAB_TODAY) }
    val isTomorrowSelected = selectedDayTab == TAB_TOMORROW
    val activeDate = if (isTomorrowSelected) tomorrowDate else todayDate

    val activeView = remember(snapshot, activeDate) { snapshot.dayView(activeDate) }
    val featuredEmergency = remember(snapshot) { snapshot.featuredEmergency() }
    val siteBanner = remember(snapshot, lang) { SiteStatusModel.banner(snapshot, lang) }
    val siteNotice = remember(snapshot) { SiteStatusModel.notice(snapshot) }

    val hasEmergencyOutage = featuredEmergency != null
    val hasCustomNoQueueStatus = !customQueueStatusText.isNullOrBlank() && !hasEmergencyOutage
    val isQueueUnselected = queue.isBlank() && !hasCustomNoQueueStatus && !hasEmergencyOutage
    val formattedSelectedAddress = remember(selectedAddress) { formatAddressAfterCity(selectedAddress) }

    // 48 light POWER_ON half-hour slots for buildings that are never disconnected by hourly schedules
    val lightNoOutageSlots = remember {
        (0 until 48).map { idx ->
            val sh = idx / 2
            val sm = if (idx % 2 == 0) "00" else "30"
            val eh = (idx + 1) / 2
            val em = if ((idx + 1) % 2 == 0) "00" else "30"
            val startStr = "${sh.toString().padStart(2, '0')}:$sm"
            val endStr = "${eh.toString().padStart(2, '0')}:$em"
            BlackoutSlot(
                hour = sh,
                startStr = startStr,
                endStr = endStr,
                status = SlotStatus.POWER_ON,
                label = "$startStr - $endStr"
            )
        }
    }

    // The ztoe table of the shown day is not known: the drum is grey, known emergency/repair outages are drawn on top
    val isTodayUnclear = !hasCustomNoQueueStatus && queue.isNotBlank() && !snapshot.plannedKnown
    val isTomorrowUnclear = !hasCustomNoQueueStatus && queue.isNotBlank() && !snapshot.tomorrowPublished
    val activeUnclear = if (isTomorrowSelected) isTomorrowUnclear else isTodayUnclear

    val activeSlots: List<BlackoutSlot> = remember(snapshot, activeDate, hasCustomNoQueueStatus) {
        if (hasCustomNoQueueStatus) lightNoOutageSlots else snapshot.slotsFor(activeDate)
    }

    val isStatusUnclear = (snapshot.isUnclear && !hasCustomNoQueueStatus) || isQueueUnselected
    val rows = activeView.rows
    val showOutageList = !isQueueUnselected && (rows.isNotEmpty() || (!activeUnclear && activeSlots.isNotEmpty()))

    val clock = now.toLocalTime()
    val currentTimeStr = remember(clock.hour, clock.minute) {
        clock.format(DateTimeFormatter.ofPattern("HH:mm"))
    }

    Box(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .then(
                    if (isQueueUnselected) {
                        // The overlay below is the only interactive thing: hide this layer from TalkBack too
                        Modifier
                            .clearAndSetSemantics {}
                            .alpha(0.15f)
                    } else {
                        Modifier.verticalScroll(rememberScrollState())
                    }
                )
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // 1. Top Header: Queue title + sleek pill toggle switch (no text)
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (isQueueUnselected || hasCustomNoQueueStatus || queue.isBlank()) {
                    Box(modifier = Modifier.weight(1f).defaultMinSize(minHeight = ZtMinTouch))
                } else {
                    Column(modifier = Modifier.weight(1f).padding(end = 12.dp)) {
                        Text(
                            text = "${AppStrings.queue(lang)} $queue",
                            style = ZtType.title,
                            color = Color.White
                        )
                        Text(
                            text = formattedSelectedAddress ?: AppStrings.mainUtilityName(),
                            style = ZtType.caption,
                            color = TextSecondary,
                            maxLines = 3,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }

                NotificationPill(
                    enabled = notificationsEnabled,
                    interactive = !isQueueUnselected,
                    lang = lang,
                    onToggle = onToggleNotifications
                )
            }

            // 1'. The master is on but no address has a switch on: say so, with a way to Settings
            if (!isQueueUnselected && showNoAlertsCaption) {
                NoAlertsCaption(lang = lang, onOpenSettings = onOpenSettings)
            }

            val hasSwitcher = addresses.isNotEmpty()

            // 1a. Featured emergency outage (active, overdue or the next upcoming one); finished ones never show here
            if (!hasSwitcher && !isQueueUnselected && featuredEmergency != null) {
                EmergencyBanner(outage = featuredEmergency, now = now, lang = lang)
            }

            // 1b. Exact alarms are not allowed (Android 12+): warnings may arrive late
            if (!isQueueUnselected && exactAlarmMissing) {
                ExactAlarmCard(lang = lang, onOpenSettings = onOpenExactAlarmSettings)
            }

            // 1c. Site is degraded (no table / unreachable / no internet), persistent
            if (!isQueueUnselected && siteBanner != null) {
                SiteStatusBanner(siteBanner)
            }

            // 1c'. ztoe is up but publishes a notice instead of the table: quote it to the user
            if (siteNotice != null) {
                SiteNoticeCard(text = siteNotice, lang = lang)
            }

            // 1c''. Address switcher: under the global banners, above everything of one address
            if (hasSwitcher) {
                AddressSwitcher(
                    addresses = addresses,
                    primaryId = primaryAddressId,
                    shownId = shownAddressId,
                    lang = lang,
                    onSelect = onSelectAddress
                )
                if (!isQueueUnselected && featuredEmergency != null) {
                    EmergencyBanner(outage = featuredEmergency, now = now, lang = lang)
                }
            }

            // 1d. Custom ZTOE queue/house status message
            if (!isQueueUnselected && !customQueueStatusText.isNullOrBlank()) {
                GlassCard(modifier = Modifier.fillMaxWidth()) {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        if (!formattedSelectedAddress.isNullOrBlank()) {
                            Text(text = formattedSelectedAddress, style = ZtType.caption, color = TextSecondary)
                        }
                        Text(text = customQueueStatusText, style = ZtType.subhead, color = Color.White)
                    }
                }
            }

            // 2. Hero outage status card
            GlassCard(modifier = Modifier.fillMaxWidth(), contentPadding = PaddingValues(18.dp)) {
                if (hasCustomNoQueueStatus && !hasEmergencyOutage) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 16.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CappedFontScale(1.15f) {
                            Text(
                                text = "--:--:--",
                                style = ZtType.display,
                                color = Color.White,
                                maxLines = 1,
                                softWrap = false
                            )
                        }
                    }
                } else {
                    val off = !isStatusUnclear && isBlackoutNow
                    Column {
                        // Status line
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                modifier = Modifier.weight(1f).padding(end = 8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                StatusDot(
                                    color = when {
                                        isStatusUnclear -> ZtColors.ChipGreyText
                                        isBlackoutNow -> ZtColors.Accent
                                        else -> ZtColors.ChipGreenText
                                    },
                                    pulsing = off
                                )
                                Text(
                                    text = when {
                                        isStatusUnclear -> AppStrings.powerUnclear(lang)
                                        isBlackoutNow -> AppStrings.powerOff(lang)
                                        else -> AppStrings.powerOn(lang)
                                    },
                                    style = ZtType.label.copy(fontWeight = FontWeight.Bold),
                                    color = Color.White,
                                    maxLines = 2,
                                    modifier = Modifier.weight(1f)
                                )
                            }

                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Icon(
                                    Icons.Default.Schedule,
                                    contentDescription = null,
                                    tint = TextSecondary,
                                    modifier = Modifier.size(14.dp)
                                )
                                Text(
                                    text = currentTimeStr,
                                    style = ZtType.captionMono,
                                    color = TextSecondary,
                                    maxLines = 1,
                                    softWrap = false
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(14.dp))

                        // Big countdown digits (font scale capped on this node only)
                        Column(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                text = if (off) AppStrings.powerOnIn(lang) else AppStrings.powerOffIn(lang),
                                style = ZtType.caption,
                                color = TextSecondary,
                                textAlign = TextAlign.Center
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            CappedFontScale(1.15f) {
                                Text(
                                    text = countdownText,
                                    style = ZtType.display,
                                    color = Color.White,
                                    maxLines = 1,
                                    softWrap = false,
                                    textAlign = TextAlign.Center
                                )
                            }
                        }

                        val effectiveSlotTimeText = if (isStatusUnclear) "--:-- - --:--" else slotTimeText
                        if (effectiveSlotTimeText.isNotEmpty() && effectiveSlotTimeText != "Відключень немає") {
                            Spacer(modifier = Modifier.height(14.dp))
                            Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(ZtColors.Divider))
                            Spacer(modifier = Modifier.height(10.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = if (off) AppStrings.outagePeriod(lang) else AppStrings.nextPeriod(lang),
                                    style = ZtType.caption,
                                    color = TextSecondary,
                                    modifier = Modifier.weight(1f)
                                )
                                Box(
                                    modifier = Modifier
                                        .clip(ZtShapes.Badge)
                                        .background(Color(0x26FFFFFF))
                                        .padding(horizontal = 10.dp, vertical = 4.dp)
                                ) {
                                    Text(
                                        text = effectiveSlotTimeText,
                                        style = ZtType.label.copy(fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold),
                                        color = Color.White,
                                        maxLines = 1,
                                        softWrap = false
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // 3. Day selector: Tomorrow is always there; before ztoe publishes it, it shows the grey drum plus a notice
            DayTabs(
                isTomorrow = isTomorrowSelected,
                enabled = !isQueueUnselected,
                lang = lang,
                onSelect = { selectedDayTab = if (it) TAB_TOMORROW else TAB_TODAY }
            )

            if (isTomorrowSelected && isTomorrowUnclear && !isQueueUnselected) {
                GlassCard(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = AppStrings.tomorrowNotPublished(lang),
                        style = ZtType.subhead,
                        color = Color.White
                    )
                }
            }

            // 4. Schedule card with the 24 h drum and the list of outages of the shown day
            GlassCard(modifier = Modifier.fillMaxWidth(), contentPadding = PaddingValues(18.dp)) {
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    TimelineBar(
                        slots = activeSlots,
                        currentHour = clock.hour,
                        currentMinute = clock.minute,
                        showNeedle = !isTomorrowSelected,
                        lang = lang,
                        unclearBase = activeUnclear
                    )

                    if (showOutageList) {
                        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(ZtColors.Divider))

                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(
                                text = if (isTomorrowSelected) AppStrings.blackoutHoursForTomorrowHeader(lang) else AppStrings.blackoutHoursForDayHeader(lang),
                                style = ZtType.label,
                                color = TextSecondary
                            )

                            if (rows.isNotEmpty()) {
                                rows.forEachIndexed { index, row ->
                                    key(index, row.outage.id) {
                                        OutageRowItem(text = OutageRowFormat.format(lang, row), lang = lang)
                                    }
                                }
                            } else {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(ZtShapes.Row)
                                        .background(ZtColors.InnerRow)
                                        .padding(14.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = AppStrings.noBlackoutsScheduled(lang),
                                        style = ZtType.caption,
                                        color = TextSecondary
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // 5. Last updated, site status chips and the circular refresh button
            GlassCard(modifier = Modifier.fillMaxWidth(), contentPadding = PaddingValues(14.dp)) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            LabelledValue(AppStrings.lastUpdated(lang), lastUpdated)
                            LabelledValue(AppStrings.nextUpdated(lang), nextUpdated)
                        }
                        RefreshButton(
                            enabled = !isQueueUnselected,
                            isRefreshing = isRefreshing,
                            lang = lang,
                            onRefresh = onRefresh
                        )
                    }
                    SiteStatusChipRow(snapshot = snapshot, lang = lang)
                }
            }

            // 6. Emergency outages info link (Facebook)
            LinkCard(
                title = AppStrings.emergencyOutagesLabel(lang),
                url = AppStrings.EMERGENCY_OUTAGES_URL,
                tileColor = Color(0xFF1877F2),
                enabled = !isQueueUnselected,
                onClick = {
                    try {
                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(AppStrings.EMERGENCY_OUTAGES_URL)))
                    } catch (_: Exception) {
                    }
                }
            ) {
                // Facebook vector logo
                Icon(
                    painter = painterResource(id = R.drawable.ic_facebook),
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(20.dp)
                )
            }

            // 7. Blackout schedules on the ZTOE website, at the very bottom after the Facebook link
            LinkCard(
                title = AppStrings.siteSchedulesLabel(lang),
                url = AppStrings.SITE_SCHEDULES_URL,
                tileColor = ZtColors.Accent,
                enabled = !isQueueUnselected,
                onClick = {
                    try {
                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(AppStrings.SITE_SCHEDULES_URL)))
                    } catch (_: Exception) {
                    }
                }
            ) {
                Icon(
                    imageVector = Icons.Default.Language,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(20.dp)
                )
            }

            // Extra spacing so the floating navigation dock does not overlap the bottom card
            Spacer(modifier = Modifier.height(96.dp))
        }

        // First launch / unselected queue overlay: dark dim, centred accent "Виберіть чергу" button, language switch
        if (isQueueUnselected) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color(0xD9070A12))
                    .clickable(enabled = false) {}
                    .padding(horizontal = 24.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(24.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .defaultMinSize(minWidth = 260.dp, minHeight = ZtMinTouch)
                            .clip(ZtShapes.Card)
                            .background(ZtColors.Accent)
                            .border(1.dp, Color(0x40FFFFFF), ZtShapes.Card)
                            .clickable(role = Role.Button) { onOpenQueueSelection() }
                            .padding(horizontal = 32.dp, vertical = 20.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            // Dark label on the accent fill: 6.9:1, where white would be 3.0:1
                            Text(
                                text = AppStrings.selectQueueAction(lang),
                                style = ZtType.title.copy(fontWeight = FontWeight.ExtraBold),
                                color = InkOnAccent,
                                textAlign = TextAlign.Center
                            )
                            Text(
                                text = AppStrings.mainUtilityName(),
                                style = ZtType.label,
                                color = InkOnAccent,
                                textAlign = TextAlign.Center
                            )
                        }
                    }

                    LanguageSwitch(
                        selectedLanguage = selectedLanguage,
                        lang = lang,
                        onChangeLanguage = onChangeLanguage
                    )
                }
            }
        }
    }
}

// -------------------------------------------------------------------------------------------------
// Pieces
// -------------------------------------------------------------------------------------------------

/** 58 x 34 pill switch for the notifications; the touch target is 48 dp tall without changing the look. */
@Composable
private fun NotificationPill(enabled: Boolean, interactive: Boolean, lang: String, onToggle: () -> Unit) {
    val label = AppStrings.notifications(lang)
    val stateText = if (enabled) AppStrings.switchOn(lang) else AppStrings.switchOff(lang)
    Box(
        modifier = Modifier
            .minimumInteractiveComponentSize()
            .size(width = 58.dp, height = 34.dp)
            .clip(CircleShape)
            .background(if (enabled) ZtColors.Accent else Color(0x26FFFFFF))
            .semantics {
                contentDescription = label
                stateDescription = stateText
            }
            .toggleable(
                value = enabled,
                enabled = interactive,
                role = Role.Switch,
                onValueChange = { onToggle() }
            )
            .padding(4.dp),
        contentAlignment = if (enabled) Alignment.CenterEnd else Alignment.CenterStart
    ) {
        Box(
            modifier = Modifier
                .size(26.dp)
                .clip(CircleShape)
                .background(Color.White),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = if (enabled) Icons.Default.Notifications else Icons.Default.NotificationsOff,
                contentDescription = null,
                tint = if (enabled) ZtColors.Accent else Color(0xFF6B7280),
                modifier = Modifier.size(16.dp)
            )
        }
    }
}

@Composable
private fun EmergencyBanner(outage: Outage, now: LocalDateTime, lang: String) {
    val format = remember { DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm") }
    val status = outage.statusAt(now)
    val title = when {
        lang == "uk" && !outage.label.isNullOrBlank() -> outage.label
        status == IntervalStatus.UPCOMING -> AppStrings.emergencyUpcomingTitle(lang)
        else -> AppStrings.emergencyOutageTitle(lang)
    }
    val restoreText = if (outage.overdue || !outage.end.isAfter(outage.start)) "--:--" else outage.end.format(format)

    GlassCard(modifier = Modifier.fillMaxWidth()) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(text = title, style = ZtType.subhead, color = ZtColors.Accent)
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                BannerLine(AppStrings.emergencyStartLabel(lang), outage.start.format(format))
                BannerLine(AppStrings.emergencyRestoreLabel(lang), restoreText)
                if (status == IntervalStatus.OVERDUE) {
                    Text(text = AppStrings.rowOverdue(lang), style = ZtType.caption, color = TextSecondary)
                }
            }
        }
    }
}

@Composable
private fun BannerLine(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(text = label, style = ZtType.caption, color = TextSecondary, modifier = Modifier.weight(1f))
        Text(
            text = value,
            style = ZtType.captionMono,
            color = Color.White,
            maxLines = 1,
            softWrap = false,
            textAlign = TextAlign.End
        )
    }
}

/** Exact alarms are off: explains why warnings can be late and opens the system screen where they are allowed. */
@Composable
private fun ExactAlarmCard(lang: String, onOpenSettings: () -> Unit) {
    GlassCard(modifier = Modifier.fillMaxWidth()) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(ZtColors.ChipAmber),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Alarm,
                    contentDescription = null,
                    tint = ZtColors.ChipAmberText,
                    modifier = Modifier.size(20.dp)
                )
            }
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(text = AppStrings.exactAlarmTitle(lang), style = ZtType.subhead, color = ZtColors.ChipAmberText)
                Text(text = AppStrings.exactAlarmBody(lang), style = ZtType.body, color = TextSecondary)
                Spacer(modifier = Modifier.height(2.dp))
                Box(
                    modifier = Modifier
                        .defaultMinSize(minHeight = ZtMinTouch)
                        .clip(ZtShapes.Control)
                        .background(ZtColors.Accent)
                        .clickable(role = Role.Button, onClick = onOpenSettings)
                        .padding(horizontal = 20.dp, vertical = 10.dp),
                    contentAlignment = Alignment.Center
                ) {
                    // Dark label on the accent fill (6.9:1)
                    Text(
                        text = AppStrings.exactAlarmButton(lang),
                        style = ZtType.label.copy(fontWeight = FontWeight.Bold),
                        color = InkOnAccent,
                        textAlign = TextAlign.Center
                    )
                }
            }
        }
    }
}

/** "No address has alerts turned on" under the header bell, with a link to Settings (spec/SUBSCRIPTIONS.md 9). */
@Composable
private fun NoAlertsCaption(lang: String, onOpenSettings: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text(
            text = AppStrings.noAddressAlerts(lang),
            style = ZtType.caption,
            color = ZtColors.Accent,
            modifier = Modifier.weight(1f)
        )
        Box(
            modifier = Modifier
                .heightIn(min = ZtMinTouch)
                .clip(ZtShapes.Chip)
                .clickable(role = Role.Button, onClick = onOpenSettings)
                .padding(horizontal = 8.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = AppStrings.settingsTitle(lang),
                style = ZtType.label.copy(fontWeight = FontWeight.Bold),
                color = Color.White
            )
        }
    }
}

/** One chip per address, the primary with a star; scrolls sideways when the labels do not fit. */
@Composable
private fun AddressSwitcher(
    addresses: List<Subscription>,
    primaryId: String?,
    shownId: String?,
    lang: String,
    onSelect: (String) -> Unit
) {
    val selectedText = AppStrings.tabSelected(lang)
    val primaryText = AppStrings.primaryBadge(lang)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .selectableGroup(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        for (item in addresses) {
            val selected = item.id == shownId
            val isPrimary = item.id == primaryId
            val label = Subscriptions.displayLabel(item)
            Row(
                modifier = Modifier
                    .heightIn(min = ZtMinTouch)
                    .clip(ZtShapes.Chip)
                    .background(if (selected) Color(0x33FFFFFF) else Color(0x80141A29))
                    .border(1.dp, if (selected) Color(0x66FFFFFF) else Color(0x1FFFFFFF), ZtShapes.Chip)
                    .semantics { if (selected) stateDescription = selectedText }
                    .selectable(selected = selected, role = Role.Tab, onClick = { onSelect(item.id) })
                    .padding(horizontal = 14.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                if (isPrimary) {
                    Icon(Icons.Default.Star, contentDescription = primaryText, tint = ZtColors.Accent, modifier = Modifier.size(16.dp))
                }
                Text(
                    text = label,
                    style = ZtType.label.copy(fontWeight = FontWeight.Bold),
                    color = if (selected) Color.White else TabIdle,
                    maxLines = 1,
                    softWrap = false
                )
            }
        }
    }
}

@Composable
private fun DayTabs(isTomorrow: Boolean, enabled: Boolean, lang: String, onSelect: (Boolean) -> Unit) {
    GlassCard(
        modifier = Modifier.fillMaxWidth(),
        shape = ZtShapes.Control,
        cornerRadius = 16.dp,
        background = Color(0x80141A29),
        borderColor = null,
        contentPadding = PaddingValues(4.dp)
    ) {
        Row(modifier = Modifier.fillMaxWidth().selectableGroup()) {
            DayTab(AppStrings.today(lang), selected = !isTomorrow, enabled = enabled, lang = lang, modifier = Modifier.weight(1f)) {
                onSelect(false)
            }
            DayTab(AppStrings.tomorrow(lang), selected = isTomorrow, enabled = enabled, lang = lang, modifier = Modifier.weight(1f)) {
                onSelect(true)
            }
        }
    }
}

@Composable
private fun DayTab(text: String, selected: Boolean, enabled: Boolean, lang: String, modifier: Modifier, onClick: () -> Unit) {
    val selectedText = AppStrings.tabSelected(lang)
    Box(
        modifier = modifier
            .heightIn(min = ZtMinTouch)
            .clip(ZtShapes.Chip)
            .background(if (selected) Color(0x33FFFFFF) else Color.Transparent)
            .semantics { if (selected) stateDescription = selectedText }
            .selectable(selected = selected, enabled = enabled, role = Role.Tab, onClick = onClick)
            .padding(horizontal = 8.dp, vertical = 8.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            style = ZtType.label.copy(fontWeight = FontWeight.Bold),
            color = if (selected) Color.White else TabIdle,
            maxLines = 1,
            textAlign = TextAlign.Center
        )
    }
}

/** One outage of the day: marker, full span, tags and the full duration chip. Finished rows are dimmed to 55 %. */
@Composable
private fun OutageRowItem(text: OutageRowFormat.RowText, lang: String) {
    val tags = listOfNotNull(text.kindTag, text.originTag, text.statusTag, text.continueTag).joinToString(" · ")
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .alpha(if (text.isFinished) 0.55f else 1f)
            .clip(ZtShapes.Row)
            .background(ZtColors.InnerRow)
            .clearAndSetSemantics { contentDescription = text.contentDescription }
            .padding(horizontal = 14.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Fixed 20x20dp leading indicator slot so the text start X is identical in every row
        Box(modifier = Modifier.size(20.dp), contentAlignment = Alignment.Center) {
            when {
                text.isEmergency -> {
                    Box(
                        modifier = Modifier
                            .size(20.dp)
                            .clip(CircleShape)
                            .background(ZtColors.Accent),
                        contentAlignment = Alignment.Center
                    ) {
                        // The glyph does not scale with the font size: the circle is fixed at 20 dp
                        CappedFontScale(1f) {
                            Text(
                                text = "!",
                                style = ZtType.overline.copy(fontWeight = FontWeight.Black, letterSpacing = androidx.compose.ui.unit.TextUnit.Unspecified),
                                color = Color.White
                            )
                        }
                    }
                }
                text.isRepair -> Icon(
                    imageVector = Icons.Default.Build,
                    contentDescription = null,
                    tint = ZtColors.Accent,
                    modifier = Modifier.size(18.dp)
                )
                else -> Box(
                    modifier = Modifier
                        .size(10.dp)
                        .clip(CircleShape)
                        .background(ZtColors.Accent)
                )
            }
        }

        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(text = text.timeText, style = ZtType.timeMono, color = Color.White, maxLines = 2)
            if (tags.isNotEmpty()) {
                Text(
                    text = tags,
                    style = ZtType.caption,
                    color = if (text.isEmergency && !text.isFinished) ZtColors.Accent else TextSecondary
                )
            }
        }

        if (text.durationText != null) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(Color(0x26FF5E3A))
                    .padding(horizontal = 8.dp, vertical = 3.dp)
            ) {
                Text(
                    text = text.durationText,
                    style = ZtType.captionMono,
                    color = ZtColors.Accent,
                    maxLines = 1,
                    softWrap = false
                )
            }
        }
    }
}

@Composable
private fun LabelledValue(label: String, value: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            text = label,
            style = ZtType.caption,
            color = TextTertiary,
            modifier = Modifier.weight(1f, fill = false)
        )
        Text(
            text = value,
            style = ZtType.captionMono,
            color = Color.White,
            maxLines = 1,
            softWrap = false
        )
    }
}

/** 42 dp white refresh disc; 48 dp touch target; the arrow rotates while a refresh runs. */
@Composable
private fun RefreshButton(enabled: Boolean, isRefreshing: Boolean, lang: String, onRefresh: () -> Unit) {
    val label = AppStrings.refreshBtn(lang)
    val busyText = AppStrings.refreshing(lang)
    Box(
        modifier = Modifier
            .minimumInteractiveComponentSize()
            .size(42.dp)
            .clip(CircleShape)
            .background(Color.White)
            .semantics {
                contentDescription = label
                if (isRefreshing) stateDescription = busyText
            }
            .clickable(enabled = enabled && !isRefreshing, role = Role.Button) { onRefresh() },
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = Icons.Default.Refresh,
            contentDescription = null,
            tint = Color.Black,
            modifier = Modifier.size(20.dp).spinWhile(isRefreshing)
        )
    }
}

/** Card with one tappable link row: icon tile, title and the full URL (wraps to two lines instead of a dead ellipsis). */
@Composable
private fun LinkCard(
    title: String,
    url: String,
    tileColor: Color,
    enabled: Boolean,
    onClick: () -> Unit,
    icon: @Composable () -> Unit
) {
    GlassCard(modifier = Modifier.fillMaxWidth(), contentPadding = PaddingValues(14.dp)) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(ZtShapes.Row)
                .background(ZtColors.InnerRow)
                .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
                .padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(ZtShapes.Badge)
                    .background(tileColor),
                contentAlignment = Alignment.Center
            ) {
                icon()
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(text = title, style = ZtType.label.copy(fontWeight = FontWeight.Bold), color = Color.White)
                Text(
                    text = url,
                    style = ZtType.captionMono.copy(fontWeight = FontWeight.Normal),
                    color = TextTertiary,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }
            Icon(
                imageVector = Icons.Default.OpenInNew,
                contentDescription = null,
                tint = TextTertiary,
                modifier = Modifier.size(16.dp)
            )
        }
    }
}

/** 3-segment language switch of the first-launch overlay; stacks vertically at large font scales instead of clipping. */
@Composable
private fun LanguageSwitch(selectedLanguage: String, lang: String, onChangeLanguage: (String) -> Unit) {
    val options = listOf(
        "SYSTEM" to AppStrings.mainLangAuto(lang),
        "en" to "English",
        "uk" to "Українська"
    )
    val stacked = LocalDensity.current.fontScale > 1.15f

    @Composable
    fun Segment(code: String, label: String, modifier: Modifier) {
        val isActive = selectedLanguage.equals(code, ignoreCase = true)
        Box(
            modifier = modifier
                .heightIn(min = ZtMinTouch)
                .clip(ZtShapes.Chip)
                .background(if (isActive) Color.White else Color.Transparent)
                .selectable(selected = isActive, role = Role.RadioButton) { onChangeLanguage(code) }
                .padding(horizontal = 8.dp, vertical = 8.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = label,
                style = ZtType.label.copy(fontWeight = FontWeight.Bold),
                color = if (isActive) Color.Black else Color(0xE6BAE6FD),
                maxLines = 1,
                textAlign = TextAlign.Center
            )
        }
    }

    val containerModifier = Modifier
        .fillMaxWidth(0.9f)
        .clip(ZtShapes.Control)
        .background(Color(0xE6141A29))
        .border(1.dp, Color(0x33FFFFFF), ZtShapes.Control)
        .padding(6.dp)
        .selectableGroup()

    if (stacked) {
        Column(modifier = containerModifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            options.forEach { (code, label) -> Segment(code, label, Modifier.fillMaxWidth()) }
        }
    } else {
        Row(
            modifier = containerModifier,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            options.forEach { (code, label) -> Segment(code, label, Modifier.weight(1f)) }
        }
    }
}
