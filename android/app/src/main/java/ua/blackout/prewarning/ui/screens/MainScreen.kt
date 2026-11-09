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
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ua.blackout.prewarning.R
import ua.blackout.prewarning.data.model.BlackoutSlot
import ua.blackout.prewarning.data.model.SlotStatus
import ua.blackout.prewarning.data.repository.ScheduleRepository
import ua.blackout.prewarning.ui.AppStrings
import ua.blackout.prewarning.ui.components.TimelineBar
import java.time.LocalTime
import ua.blackout.prewarning.data.KYIV_ZONE

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    queue: String = "2.1",
    isBlackoutNow: Boolean = false,
    countdownText: String = "01:35:12",
    slotTimeText: String = "14:00 – 18:00",
    slots: List<BlackoutSlot> = emptyList(),
    tomorrowSlots: List<BlackoutSlot>? = null,
    hasTomorrowSchedule: Boolean = false,
    notificationsEnabled: Boolean = true,
    lastUpdated: String = "--:--",
    nextUpdated: String = "--:--",
    lang: String = "uk",
    onToggleNotifications: () -> Unit = {},
    onRefresh: () -> Unit = {},
    onSendTestAlert: () -> Unit = {}
) {
    val context = LocalContext.current
    var selectedDayTab by remember { mutableStateOf("today") }

    LaunchedEffect(hasTomorrowSchedule, tomorrowSlots) {
        if (!hasTomorrowSchedule && selectedDayTab == "tomorrow") {
            selectedDayTab = "today"
        }
    }

    val isTomorrowSelected = selectedDayTab == "tomorrow" && tomorrowSlots != null
    val activeSlots = if (isTomorrowSelected) (tomorrowSlots ?: emptyList()) else slots
    val activeSlotsSignature = remember(activeSlots) {
        activeSlots.joinToString("") { if (it.status == SlotStatus.POWER_OFF) "1" else "0" }
    }

    val isUnclear = activeSlots.isEmpty() || activeSlots.all { it.status == SlotStatus.POWER_ON && activeSlots.isEmpty() }
    val now = remember { LocalTime.now(KYIV_ZONE) }
    val nowMinutes = now.hour * 60 + now.minute

    val intervals = remember(activeSlotsSignature) {
        ScheduleRepository.computeDetailedIntervals(activeSlots)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
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
                    color = Color(0xFFBAE6FD)
                )
            }

            IconButton(
                onClick = onToggleNotifications,
                modifier = Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(if (notificationsEnabled) Color(0xFFFF5E3A) else Color(0x33FFFFFF))
            ) {
                Icon(
                    imageVector = if (notificationsEnabled) Icons.Default.NotificationsActive else Icons.Default.NotificationsOff,
                    contentDescription = if (notificationsEnabled) "Сповіщення УВІМК" else "Сповіщення ВИМК",
                    tint = Color.White,
                    modifier = Modifier.size(22.dp)
                )
            }
        }

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xCC141A29))
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                val statusTitle = if (isUnclear) {
                    AppStrings.powerUnclear(lang)
                } else if (isBlackoutNow) {
                    AppStrings.powerOff(lang)
                } else {
                    AppStrings.powerOn(lang)
                }

                val statusColor = if (isUnclear) {
                    Color(0xFFA1A1AA)
                } else if (isBlackoutNow) {
                    Color(0xFFFF5E3A)
                } else {
                    Color(0xFF34D399)
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center
                ) {
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .clip(CircleShape)
                            .background(statusColor)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = statusTitle,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = statusColor
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                val countdownLabel = if (!isUnclear && isBlackoutNow) {
                    AppStrings.powerOnIn(lang)
                } else {
                    AppStrings.powerOffIn(lang)
                }

                Text(
                    text = countdownLabel,
                    fontSize = 12.sp,
                    color = Color(0xFFBAE6FD)
                )

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = if (isUnclear) "--:--:--" else countdownText,
                    fontSize = 44.sp,
                    fontWeight = FontWeight.Black,
                    fontFamily = FontFamily.Monospace,
                    color = Color.White
                )

                Spacer(modifier = Modifier.height(8.dp))

                val periodLabel = if (!isUnclear && isBlackoutNow) {
                    AppStrings.outagePeriod(lang)
                } else {
                    AppStrings.nextPeriod(lang)
                }
                val periodDetail = if (isUnclear) "--:-- - --:--" else slotTimeText

                Text(
                    text = "$periodLabel $periodDetail",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color(0xFFE2E8F0)
                )
            }
        }

        key(queue, selectedDayTab, activeSlotsSignature) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xCC141A29))
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color(0x22000000))
                            .padding(4.dp),
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Button(
                            onClick = { selectedDayTab = "today" },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (!isTomorrowSelected) Color.White else Color.Transparent,
                                contentColor = if (!isTomorrowSelected) Color.Black else Color.White
                            )
                        ) {
                            Text(AppStrings.today(lang), fontWeight = FontWeight.Bold)
                        }

                        if (hasTomorrowSchedule && tomorrowSlots != null) {
                            Button(
                                onClick = { selectedDayTab = "tomorrow" },
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(8.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = if (isTomorrowSelected) Color.White else Color.Transparent,
                                    contentColor = if (isTomorrowSelected) Color.Black else Color.White
                                )
                            ) {
                                Text(AppStrings.tomorrow(lang), fontWeight = FontWeight.Bold)
                            }
                        }
                    }

                    TimelineBar(
                        slots = activeSlots,
                        currentHour = if (!isTomorrowSelected) now.hour else -1,
                        currentMinute = if (!isTomorrowSelected) now.minute else -1,
                        showNeedle = !isTomorrowSelected,
                        lang = lang
                    )

                    if (!isUnclear) {
                        Text(
                            text = AppStrings.blackoutHoursHeader(lang),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFFBAE6FD)
                        )

                        if (intervals.isEmpty()) {
                            Text(
                                text = AppStrings.noBlackoutsScheduled(lang),
                                fontSize = 13.sp,
                                color = Color(0xFF34D399)
                            )
                        } else {
                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                intervals.forEach { interval ->
                                    val isCurrent = !isTomorrowSelected && nowMinutes in interval.startMinuteOfDay until interval.endMinuteOfDay
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(10.dp))
                                            .background(if (isCurrent) Color(0x33FF5E3A) else Color(0x1AFFFFFF))
                                            .padding(horizontal = 12.dp, vertical = 8.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = "${interval.startStr} – ${interval.endStr}",
                                            fontFamily = FontFamily.Monospace,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 14.sp,
                                            color = if (isCurrent) Color(0xFFFF5E3A) else Color.White
                                        )
                                        val durationFormatted = String.format("%.1f", interval.durationHours)
                                        Text(
                                            text = "${durationFormatted} ${AppStrings.hourShort(lang)}",
                                            fontSize = 12.sp,
                                            color = Color(0xFFBAE6FD)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xCC141A29))
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "${AppStrings.lastUpdated(lang)} $lastUpdated",
                        fontSize = 11.sp,
                        color = Color(0xFFBAE6FD)
                    )
                    Text(
                        text = "${AppStrings.nextUpdated(lang)} $nextUpdated",
                        fontSize = 11.sp,
                        color = Color(0xFF94A3B8)
                    )
                }

                IconButton(
                    onClick = onRefresh,
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(Color.White)
                ) {
                    Icon(
                        imageVector = Icons.Default.Refresh,
                        contentDescription = "Оновити",
                        tint = Color.Black
                    )
                }
            }
        }

        Card(
            modifier = Modifier
                .fillMaxWidth()
                .clickable {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(AppStrings.EMERGENCY_OUTAGES_URL))
                    context.startActivity(intent)
                },
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xCC141A29))
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0xFF1877F2)),
                    contentAlignment = Alignment.Center
                ) {
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
                        color = Color.White
                    )
                    Text(
                        text = AppStrings.EMERGENCY_OUTAGES_URL,
                        fontSize = 11.sp,
                        color = Color(0xFFBAE6FD)
                    )
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Language,
                        contentDescription = null,
                        tint = Color(0xFFBAE6FD),
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Icon(
                        imageVector = Icons.Default.OpenInNew,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(16.dp)
                    )
                }
            }
        }

        Card(
            modifier = Modifier
                .fillMaxWidth()
                .clickable {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(AppStrings.SITE_SCHEDULES_URL))
                    context.startActivity(intent)
                },
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xCC141A29))
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0xFFFF5E3A)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Language,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(20.dp)
                    )
                }

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = AppStrings.siteSchedulesLabel(lang),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    Text(
                        text = AppStrings.SITE_SCHEDULES_URL,
                        fontSize = 11.sp,
                        color = Color(0xFFBAE6FD)
                    )
                }

                Icon(
                    imageVector = Icons.Default.OpenInNew,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(16.dp)
                )
            }
        }
    }
}