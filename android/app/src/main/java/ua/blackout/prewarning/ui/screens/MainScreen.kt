package ua.blackout.prewarning.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ua.blackout.prewarning.R
import ua.blackout.prewarning.data.model.BlackoutSlot
import ua.blackout.prewarning.data.repository.ScheduleRepository
import ua.blackout.prewarning.ui.AppStrings
import ua.blackout.prewarning.ui.components.TimelineBar
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@Composable
fun MainScreen(
    queue: String = "1.1",
    isBlackoutNow: Boolean = false,
    countdownText: String = "01:35:12",
    slotTimeText: String = "14:00 – 18:00",
    slots: List<BlackoutSlot> = emptyList(),
    tomorrowSlots: List<BlackoutSlot>? = null,
    hasTomorrowSchedule: Boolean = false,
    notificationsEnabled: Boolean = true,
    lastUpdated: String = "19:27",
    nextUpdated: String = "19:57",
    lang: String = "uk",
    onToggleNotifications: () -> Unit = {},
    onRefresh: () -> Unit = {}
) {
    val context = LocalContext.current
    val scheduleRepo = remember { ScheduleRepository(context.applicationContext) }
    var selectedDayTab by remember { mutableStateOf("today") }

    // Reset to "today" if tomorrow schedule is no longer available
    LaunchedEffect(hasTomorrowSchedule, tomorrowSlots) {
        if (!hasTomorrowSchedule || tomorrowSlots == null) {
            selectedDayTab = "today"
        }
    }

    val activeSlots = if (selectedDayTab == "today") slots else (tomorrowSlots ?: slots)

    // Compute continuous blackout intervals with exact 30-min resolution using hoisted ScheduleRepository
    val intervals = remember(queue, activeSlots, selectedDayTab) {
        scheduleRepo.getDetailedIntervals(activeSlots)
    }

    // Pulse animation for status dot — only active during an active blackout to avoid 60fps idle CPU/battery drain
    val pulseScale = if (isBlackoutNow) {
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

    val kyivNow = remember(countdownText) {
        LocalTime.now(ZoneId.of("Europe/Kyiv"))
    }
    val currentTimeStr = remember(kyivNow.hour, kyivNow.minute) {
        kyivNow.format(DateTimeFormatter.ofPattern("HH:mm"))
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // 1. Top Header: Queue title + Sleek pill toggle switch (NO text)
        Row(
            modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "${AppStrings.queue(lang)} $queue",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
                Text(
                    text = "Житомиробленерго (ZTOE)",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color(0xB3BAE6FD)
                )
            }

            // Enlarged Pill Switch matching emulator exactly
            Box(
                modifier = Modifier
                    .size(width = 58.dp, height = 34.dp)
                    .clip(CircleShape)
                    .background(if (notificationsEnabled) Color(0xFFFF5E3A) else Color(0x26FFFFFF))
                    .clickable { onToggleNotifications() }
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

        // 2. Hero Outage Status Card (Translucent Frosted Glass)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(24.dp))
                .background(Color(0xBF141A29))
                .padding(18.dp)
        ) {
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
                                .scale(if (isBlackoutNow) pulseScale else 1f)
                                .clip(CircleShape)
                                .background(if (isBlackoutNow) Color(0xFFFF5E3A) else Color(0xFF34D399))
                        )
                        Text(
                            text = if (isBlackoutNow) AppStrings.powerOff(lang) else AppStrings.powerOn(lang),
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
                        text = if (isBlackoutNow) AppStrings.powerOnIn(lang) else AppStrings.powerOffIn(lang),
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

                if (slotTimeText.isNotEmpty() && slotTimeText != "Відключень немає") {
                    Spacer(modifier = Modifier.height(14.dp))
                    Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(Color(0x1AFFFFFF)))
                    Spacer(modifier = Modifier.height(10.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = if (isBlackoutNow) AppStrings.outagePeriod(lang) else AppStrings.nextPeriod(lang),
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
                                text = slotTimeText,
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

        // 3. Day Selector (Today / Tomorrow)
        // If tomorrow's table exists on site: show segmented selector. Otherwise: center single "Today" button!
        if (hasTomorrowSchedule && tomorrowSlots != null) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color(0x80141A29))
                    .padding(4.dp)
            ) {
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(12.dp))
                        .background(if (selectedDayTab == "today") Color(0x33FFFFFF) else Color.Transparent)
                        .clickable { selectedDayTab = "today" }
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
                        .clickable { selectedDayTab = "tomorrow" }
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
                .clip(RoundedCornerShape(24.dp))
                .background(Color(0xBF141A29))
                .padding(18.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                // 24-Hour Timeline Bar
                key(queue, selectedDayTab, activeSlots) {
                    TimelineBar(
                        slots = activeSlots,
                        currentHour = kyivNow.hour,
                        currentMinute = kyivNow.minute,
                        showNeedle = selectedDayTab == "today"
                    )
                }

                // List of Outage Hours for this day
                Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(Color(0x1AFFFFFF)))

                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = AppStrings.blackoutHoursHeader(lang),
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
                                    Box(
                                        modifier = Modifier
                                            .size(8.dp)
                                            .clip(CircleShape)
                                            .background(Color(0xFFFF5E3A))
                                    )
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
                        .clickable {
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
                    .clickable {
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

        // Extra spacing so floating navigation dock does not overlap bottom card
        Spacer(modifier = Modifier.height(96.dp))
    }
}
