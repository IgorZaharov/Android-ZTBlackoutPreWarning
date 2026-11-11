package ua.blackout.prewarning.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.NotificationsOff
import androidx.compose.material.icons.filled.OpenInNew
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ua.blackout.prewarning.R
import ua.blackout.prewarning.data.model.BlackoutSlot
import ua.blackout.prewarning.data.model.SlotStatus
import ua.blackout.prewarning.data.parser.ZtoeAddressLookup
import ua.blackout.prewarning.data.repository.ScheduleRepository
import ua.blackout.prewarning.ui.AppStrings
import ua.blackout.prewarning.ui.components.TimelineBar
import ua.blackout.prewarning.ui.components.floatingShadow
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import ua.blackout.prewarning.data.KYIV_ZONE

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

@Composable
fun MainScreen(
    queue: String = "",
    customQueueStatusText: String? = null,
    selectedAddress: String? = null,
    emergencyOutageStartTime: String? = null,
    emergencyOutageRestoreTime: String? = null,
    emergencyOutageType: String? = null,
    isBlackoutNow: Boolean = false,
    countdownText: String = "01:35:12",
    slotTimeText: String = "14:00 – 18:00",
    slots: List<BlackoutSlot> = emptyList(),
    tomorrowSlots: List<BlackoutSlot>? = null,
    hasTomorrowSchedule: Boolean = false,
    notificationsEnabled: Boolean = true,
    lastUpdated: String = "19:27",
    nextUpdated: String = "19:57",
    currentTime: LocalTime = LocalTime.now(KYIV_ZONE),
    lang: String = "uk",
    selectedLanguage: String = "SYSTEM",
    onToggleNotifications: () -> Unit = {},
    onRefresh: () -> Unit = {},
    onOpenQueueSelection: () -> Unit = {},
    onChangeLanguage: (String) -> Unit = {}
) {
    val context = LocalContext.current
    val scheduleRepo = remember { ScheduleRepository(context.applicationContext) }
    var selectedDayTab by remember { mutableStateOf("today") }

    val hasEmergencyOutage = ZtoeAddressLookup.isValidOutageTimestamp(emergencyOutageStartTime) &&
        ZtoeAddressLookup.isValidOutageTimestamp(emergencyOutageRestoreTime)
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

    // Reset to "today" if tomorrow schedule is no longer available
    LaunchedEffect(hasTomorrowSchedule, tomorrowSlots) {
        if (!hasTomorrowSchedule || tomorrowSlots == null) {
            selectedDayTab = "today"
        }
    }

    val isTomorrowSelected = selectedDayTab == "tomorrow" && hasTomorrowSchedule && tomorrowSlots != null
    val activeSlots = when {
        hasCustomNoQueueStatus && !hasEmergencyOutage -> lightNoOutageSlots
        isTomorrowSelected -> tomorrowSlots!!
        else -> slots
    }
    val isUnclear = activeSlots.isEmpty() || isQueueUnselected
    val isStatusUnclear = (slots.isEmpty() && !hasCustomNoQueueStatus) || isQueueUnselected
    val activeSlotsSignature = activeSlots.joinToString("") {
        val statusChar = if (it.status == SlotStatus.POWER_OFF) "1" else "0"
        val emgChar = if (it.isEmergency) "E" else "S"
        "$statusChar$emgChar"
    }

    // Compute continuous blackout intervals with exact 30-min resolution using hoisted ScheduleRepository
    val intervals = remember(queue, selectedDayTab, activeSlotsSignature) {
        scheduleRepo.getDetailedIntervals(activeSlots)
    }

    // Pulse animation for status dot — only active during an active blackout to avoid 60fps idle CPU/battery drain
    val pulseScale = if (!isStatusUnclear && isBlackoutNow) {
        val infiniteTransition = rememberInfiniteTransition(label = "pulse")
        val scale by infiniteTransition.animateFloat(
            initialValue = 0.85f,
            targetValue = 1.25f,
            animationSpec = infiniteRepeatable(
                animation = tween(900, easing = FastOutSlowInEasing),
                repeatMode = RepeatMode.Reverse
            ),
            label = "pulseScale"
        )
        scale
    } else {
        1f
    }

    var entryRefreshTick by remember { mutableStateOf(0) }
    LaunchedEffect(Unit) {
        entryRefreshTick++
    }

    val kyivNow = remember(countdownText, currentTime, entryRefreshTick) {
        LocalTime.now(KYIV_ZONE)
    }
    val currentTimeStr = remember(kyivNow.hour, kyivNow.minute) {
        kyivNow.format(DateTimeFormatter.ofPattern("HH:mm"))
    }

    Box(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .then(
                    if (isQueueUnselected) {
                        Modifier.alpha(0.15f)
                    } else {
                        Modifier.verticalScroll(rememberScrollState())
                    }
                )
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // 1. Top Header: Queue title + Sleek pill toggle switch (NO text)
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (isQueueUnselected || hasCustomNoQueueStatus || queue.isBlank()) {
                    Box(modifier = Modifier.weight(1f).defaultMinSize(minHeight = 44.dp))
                } else {
                    Column(modifier = Modifier.weight(1f).padding(end = 12.dp)) {
                        Text(
                            text = "${AppStrings.queue(lang)} $queue",
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Text(
                            text = formattedSelectedAddress ?: "Житомиробленерго (ZTOE)",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            color = Color(0xB3BAE6FD),
                            lineHeight = 16.sp
                        )
                    }
                }

                // Enlarged Pill Switch matching emulator exactly
                Box(
                    modifier = Modifier
                        .size(width = 58.dp, height = 34.dp)
                        .clip(CircleShape)
                        .background(if (notificationsEnabled) Color(0xFFFF5E3A) else Color(0x26FFFFFF))
                        .clickable(enabled = !isQueueUnselected) { onToggleNotifications() }
                        .padding(4.dp),
                    contentAlignment = if (notificationsEnabled) Alignment.CenterEnd else Alignment.CenterStart
                ) {
                    Box(
                        modifier = Modifier
                            .size(26.dp)
                            .clip(CircleShape)
                            .background(Color.White),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = if (notificationsEnabled) Icons.Default.Notifications else Icons.Default.NotificationsOff,
                            contentDescription = null,
                            tint = if (notificationsEnabled) Color(0xFFFF5E3A) else Color(0xFF6B7280),
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            }

            // 1c. Active Emergency Outage ("Аварійне відключення") Banner with Start & Estimated Restore Times — matching Workbench MainView.tsx
            if (!isQueueUnselected && hasEmergencyOutage) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .floatingShadow(color = Color(0xB3000000), borderRadius = 24.dp, blurRadius = 22.dp, offsetY = 8.dp)
                        .shadow(10.dp, RoundedCornerShape(24.dp), ambientColor = Color(0x66000000), spotColor = Color(0x80000000))
                        .clip(RoundedCornerShape(24.dp))
                        .background(Color(0xBF141A29))
                        .border(1.dp, Color(0x26FFFFFF), RoundedCornerShape(24.dp))
                        .padding(16.dp)
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            text = if (lang == "uk" && !emergencyOutageType.isNullOrBlank()) {
                                emergencyOutageType
                            } else {
                                AppStrings.emergencyOutageTitle(lang)
                            },
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFFFF5E3A),
                            lineHeight = 19.sp
                        )
                        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = AppStrings.emergencyStartLabel(lang),
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = Color(0xB3BAE6FD)
                                )
                                Text(
                                    text = emergencyOutageStartTime ?: "--:--",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Monospace,
                                    color = Color.White,
                                    textAlign = TextAlign.End
                                )
                            }
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = AppStrings.emergencyRestoreLabel(lang),
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = Color(0xB3BAE6FD)
                                )
                                Text(
                                    text = emergencyOutageRestoreTime ?: "--:--",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Monospace,
                                    color = Color.White,
                                    textAlign = TextAlign.End
                                )
                            }
                        }
                    }
                }
            }

            // 1b. Custom ZTOE Queue/House Status Message Bar — exact same style/color/placement as Workbench MainView.tsx
            if (!isQueueUnselected && !customQueueStatusText.isNullOrBlank()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .floatingShadow(color = Color(0xB3000000), borderRadius = 24.dp, blurRadius = 22.dp, offsetY = 8.dp)
                        .shadow(10.dp, RoundedCornerShape(24.dp), ambientColor = Color(0x66000000), spotColor = Color(0x80000000))
                        .clip(RoundedCornerShape(24.dp))
                        .background(Color(0xBF141A29))
                        .border(1.dp, Color(0x26FFFFFF), RoundedCornerShape(24.dp))
                        .padding(16.dp)
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        if (!formattedSelectedAddress.isNullOrBlank()) {
                            Text(
                                text = formattedSelectedAddress,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Medium,
                                color = Color(0xB3BAE6FD),
                                lineHeight = 16.sp
                            )
                        }
                        Text(
                            text = customQueueStatusText ?: "",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                            lineHeight = 19.sp
                        )
                    }
                }
            }

            // 2. Hero Outage Status Card (Translucent Frosted Glass)
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .floatingShadow(color = Color(0xB3000000), borderRadius = 24.dp, blurRadius = 22.dp, offsetY = 8.dp)
                    .shadow(10.dp, RoundedCornerShape(24.dp), ambientColor = Color(0x66000000), spotColor = Color(0x80000000))
                    .clip(RoundedCornerShape(24.dp))
                    .background(Color(0xBF141A29))
                    .border(1.dp, Color(0x26FFFFFF), RoundedCornerShape(24.dp))
                    .padding(18.dp)
            ) {
                if (hasCustomNoQueueStatus && !hasEmergencyOutage) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 16.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "--:--:--",
                            fontSize = 44.sp,
                            fontWeight = FontWeight.Black,
                            fontFamily = FontFamily.Monospace,
                            color = Color.White
                        )
                    }
                } else {
                    Column {
                        // Status Line
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(10.dp)
                                        .scale(if (!isStatusUnclear && isBlackoutNow) pulseScale else 1f)
                                        .clip(CircleShape)
                                        .background(
                                            when {
                                                isStatusUnclear -> Color(0xFF9CA3AF)
                                                isBlackoutNow -> Color(0xFFFF5E3A)
                                                else -> Color(0xFF34D399)
                                            }
                                        )
                                )
                                Text(
                                    text = when {
                                        isStatusUnclear -> AppStrings.powerUnclear(lang)
                                        isBlackoutNow -> AppStrings.powerOff(lang)
                                        else -> AppStrings.powerOn(lang)
                                    },
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White
                                )
                            }

                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Icon(
                                    Icons.Default.Schedule,
                                    contentDescription = null,
                                    tint = Color(0xB3BAE6FD),
                                    modifier = Modifier.size(14.dp)
                                )
                                Text(
                                    text = currentTimeStr,
                                    fontSize = 12.sp,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xB3BAE6FD)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(14.dp))

                        // Big Countdown Digits
                        Column(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                text = if (!isStatusUnclear && isBlackoutNow) AppStrings.powerOnIn(lang) else AppStrings.powerOffIn(lang),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Color(0xB3BAE6FD)
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = countdownText,
                                fontSize = 44.sp,
                                fontWeight = FontWeight.Black,
                                fontFamily = FontFamily.Monospace,
                                color = Color.White
                            )
                        }

                        val effectiveSlotTimeText = when {
                            isStatusUnclear -> "--:-- - --:--"
                            else -> slotTimeText
                        }
                        if (effectiveSlotTimeText.isNotEmpty() && effectiveSlotTimeText != "Відключень немає") {
                            Spacer(modifier = Modifier.height(14.dp))
                            Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(Color(0x1AFFFFFF)))
                            Spacer(modifier = Modifier.height(10.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = if (!isStatusUnclear && isBlackoutNow) AppStrings.outagePeriod(lang) else AppStrings.nextPeriod(lang),
                                    fontSize = 13.sp,
                                    color = Color(0xB3BAE6FD)
                                )
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(Color(0x26FFFFFF))
                                        .padding(horizontal = 10.dp, vertical = 4.dp)
                                ) {
                                    Text(
                                        text = effectiveSlotTimeText,
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Bold,
                                        fontFamily = FontFamily.Monospace,
                                        color = Color.White
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // 3. Day Selector (Today / Tomorrow)
            if (hasTomorrowSchedule && tomorrowSlots != null && !hasCustomNoQueueStatus) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .floatingShadow(color = Color(0x8C000000), borderRadius = 16.dp, blurRadius = 16.dp, offsetY = 6.dp)
                        .shadow(8.dp, RoundedCornerShape(16.dp), ambientColor = Color(0x55000000), spotColor = Color(0x66000000))
                        .clip(RoundedCornerShape(16.dp))
                        .background(Color(0x80141A29))
                        .padding(4.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(12.dp))
                            .background(if (selectedDayTab == "today") Color(0x33FFFFFF) else Color.Transparent)
                            .clickable(enabled = !isQueueUnselected) { selectedDayTab = "today" }
                            .padding(vertical = 10.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = AppStrings.today(lang),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (selectedDayTab == "today") Color.White else Color(0x99BAE6FD)
                        )
                    }
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(12.dp))
                            .background(if (selectedDayTab == "tomorrow") Color(0x33FFFFFF) else Color.Transparent)
                            .clickable(enabled = !isQueueUnselected) { selectedDayTab = "tomorrow" }
                            .padding(vertical = 10.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = AppStrings.tomorrow(lang),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (selectedDayTab == "tomorrow") Color.White else Color(0x99BAE6FD)
                        )
                    }
                }
            } else {
                // Centered "Today" button
                Box(
                    modifier = Modifier
                        .fillMaxWidth(),
                    contentAlignment = Alignment.Center
                ) {
                    Box(
                        modifier = Modifier
                            .floatingShadow(color = Color(0x8C000000), borderRadius = 16.dp, blurRadius = 16.dp, offsetY = 6.dp)
                            .shadow(8.dp, RoundedCornerShape(16.dp), ambientColor = Color(0x55000000), spotColor = Color(0x66000000))
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color(0x80141A29))
                            .padding(horizontal = 24.dp, vertical = 10.dp)
                    ) {
                        Text(
                            text = AppStrings.today(lang),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    }
                }
            }

            // 4. Schedule Card with 24h Timeline matching user screenshot
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .floatingShadow(color = Color(0xB3000000), borderRadius = 24.dp, blurRadius = 24.dp, offsetY = 10.dp)
                    .shadow(10.dp, RoundedCornerShape(24.dp), ambientColor = Color(0x66000000), spotColor = Color(0x80000000))
                    .clip(RoundedCornerShape(24.dp))
                    .background(Color(0xBF141A29))
                    .padding(18.dp)
            ) {
                key(queue, selectedDayTab, activeSlotsSignature) {
                    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                        // 24-Hour Timeline Bar (automatically refreshed on main screen entry and every minute)
                        key(kyivNow.hour, kyivNow.minute, entryRefreshTick) {
                            TimelineBar(
                                slots = activeSlots,
                                currentHour = kyivNow.hour,
                                currentMinute = kyivNow.minute,
                                showNeedle = selectedDayTab == "today",
                                lang = lang
                            )
                        }

                        // List of Outage Hours for this day (removed when outages are unclear)
                        if (!isUnclear) {
                            Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(Color(0x1AFFFFFF)))

                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text(
                                    text = if (isTomorrowSelected) AppStrings.blackoutHoursForTomorrowHeader(lang) else AppStrings.blackoutHoursForDayHeader(lang),
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xB3BAE6FD)
                                )

                                if (intervals.isNotEmpty()) {
                                    intervals.forEach { interval ->
                                        val start = interval.startStr
                                        val end = interval.endStr
                                        val dur = interval.durationHours
                                        val durStr = if (dur % 1.0 == 0.0) "${dur.toInt()} ${AppStrings.hourShort(lang)}" else "${String.format(java.util.Locale.US, "%.1f", dur)} ${AppStrings.hourShort(lang)}"
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .clip(RoundedCornerShape(14.dp))
                                                .background(Color(0x14FFFFFF))
                                                .padding(horizontal = 14.dp, vertical = 10.dp),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Row(
                                                verticalAlignment = Alignment.CenterVertically,
                                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                                            ) {
                                                // Fixed 20x20dp leading indicator slot so text start X is 100% identical
                                                Box(
                                                    modifier = Modifier.size(20.dp),
                                                    contentAlignment = Alignment.Center
                                                ) {
                                                    if (interval.isEmergency) {
                                                        Box(
                                                            modifier = Modifier
                                                                .size(20.dp)
                                                                .clip(CircleShape)
                                                                .background(Color(0xFFFF5E3A)),
                                                            contentAlignment = Alignment.Center
                                                        ) {
                                                            Text(
                                                                text = "!",
                                                                fontSize = 12.sp,
                                                                fontWeight = FontWeight.Black,
                                                                color = Color.White
                                                            )
                                                        }
                                                    } else {
                                                        Box(
                                                            modifier = Modifier
                                                                .size(10.dp)
                                                                .clip(CircleShape)
                                                                .background(Color(0xFFFF5E3A))
                                                        )
                                                    }
                                                }
                                                Text(
                                                    text = "$start – $end",
                                                    fontSize = 15.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    fontFamily = FontFamily.Monospace,
                                                    color = Color.White
                                                )
                                            }

                                            Box(
                                                modifier = Modifier
                                                    .clip(RoundedCornerShape(8.dp))
                                                    .background(Color(0x26FF5E3A))
                                                    .padding(horizontal = 8.dp, vertical = 3.dp)
                                            ) {
                                                Text(
                                                    text = durStr,
                                                    fontSize = 11.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    fontFamily = FontFamily.Monospace,
                                                    color = Color(0xFFFF5E3A)
                                                )
                                            }
                                        }
                                    }
                                } else {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(14.dp))
                                            .background(Color(0x14FFFFFF))
                                            .padding(14.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = AppStrings.noBlackoutsScheduled(lang),
                                            fontSize = 13.sp,
                                            color = Color(0xB3BAE6FD)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // 5. Last Updated & Circular Refresh Button Card
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(Color(0xBF141A29))
                    .padding(14.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(AppStrings.lastUpdated(lang), fontSize = 11.sp, color = Color(0x99BAE6FD))
                            Text(lastUpdated, fontSize = 11.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, color = Color.White)
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(AppStrings.nextUpdated(lang), fontSize = 11.sp, color = Color(0x99BAE6FD))
                            Text(nextUpdated, fontSize = 11.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, color = Color.White)
                        }
                    }

                    // Circular white refresh button with feedback
                    Box(
                        modifier = Modifier
                            .size(42.dp)
                            .clip(CircleShape)
                            .background(Color.White)
                            .clickable(enabled = !isQueueUnselected) {
                                onRefresh()
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Оновити",
                            tint = Color.Black,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }

            // 6. Emergency Outages Info Link (right after refresh block, styled like AboutScreen links with site icon)
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(24.dp))
                    .background(Color(0xBF141A29))
                    .padding(14.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color(0x14FFFFFF))
                        .clickable(enabled = !isQueueUnselected) {
                            try {
                                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(AppStrings.EMERGENCY_OUTAGES_URL))
                                context.startActivity(intent)
                            } catch (_: Exception) {}
                        }
                        .padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(Color(0xFF1877F2)),
                            contentAlignment = Alignment.Center
                        ) {
                            // Facebook vector logo (replaces generic Icons.Default.Language globe)
                            Icon(
                                painter = painterResource(id = R.drawable.ic_facebook),
                                contentDescription = "Facebook",
                                tint = Color.White,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = AppStrings.emergencyOutagesLabel(lang),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White,
                                softWrap = true
                            )
                            Text(
                                text = AppStrings.EMERGENCY_OUTAGES_URL,
                                fontSize = 10.sp,
                                fontFamily = FontFamily.Monospace,
                                color = Color(0x99BAE6FD),
                                maxLines = 1,
                                overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                            )
                        }
                    }
                    Icon(
                        imageVector = Icons.Default.OpenInNew,
                        contentDescription = null,
                        tint = Color(0x99BAE6FD),
                        modifier = Modifier.size(16.dp)
                    )
                }
            }

            // 7. Blackout Schedules on ZTOE Website Link ("Графіки відключень на сайті") at very bottom after Facebook link
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(24.dp))
                    .background(Color(0xBF141A29))
                    .padding(14.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color(0x14FFFFFF))
                        .clickable(enabled = !isQueueUnselected) {
                            try {
                                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(AppStrings.SITE_SCHEDULES_URL))
                                context.startActivity(intent)
                            } catch (_: Exception) {}
                        }
                        .padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(Color(0xFFFF5E3A)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Language,
                                contentDescription = "Графіки відключень на сайті",
                                tint = Color.White,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = AppStrings.siteSchedulesLabel(lang),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White,
                                softWrap = true
                            )
                            Text(
                                text = AppStrings.SITE_SCHEDULES_URL,
                                fontSize = 10.sp,
                                fontFamily = FontFamily.Monospace,
                                color = Color(0x99BAE6FD),
                                maxLines = 1,
                                overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                            )
                        }
                    }
                    Icon(
                        imageVector = Icons.Default.OpenInNew,
                        contentDescription = null,
                        tint = Color(0x99BAE6FD),
                        modifier = Modifier.size(16.dp)
                    )
                }
            }

            // Extra spacing so floating navigation dock does not overlap bottom card
            Spacer(modifier = Modifier.height(96.dp))
        }

        // First-launch / Unselected Queue Overlay: dark dimming + centered #FF5E3A "Виберіть чергу" button with subtitle + 3-segment language switch
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
                            .defaultMinSize(minWidth = 260.dp)
                            .clip(RoundedCornerShape(24.dp))
                            .background(Color(0xFFFF5E3A))
                            .border(1.dp, Color(0x40FFFFFF), RoundedCornerShape(24.dp))
                            .clickable { onOpenQueueSelection() }
                            .padding(horizontal = 32.dp, vertical = 20.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                text = AppStrings.selectQueueAction(lang),
                                fontSize = 24.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = Color.White,
                                textAlign = TextAlign.Center
                            )
                            Text(
                                text = "Житомиробленерго (ZTOE)",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Color(0xE6FFFFFF),
                                textAlign = TextAlign.Center
                            )
                        }
                    }

                    Row(
                        modifier = Modifier
                            .width(260.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color(0xE6141A29))
                            .border(1.dp, Color(0x33FFFFFF), RoundedCornerShape(16.dp))
                            .padding(6.dp),
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        val langOptions = listOf(
                            "SYSTEM" to "Auto",
                            "en" to "English",
                            "uk" to "Українська"
                        )
                        langOptions.forEach { (code, label) ->
                            val isActive = selectedLanguage.equals(code, ignoreCase = true)
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(if (isActive) Color.White else Color.Transparent)
                                    .clickable { onChangeLanguage(code) }
                                    .padding(horizontal = 8.dp, vertical = 8.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = label,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isActive) Color.Black else Color(0xCCBAE6FD),
                                    maxLines = 1
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
