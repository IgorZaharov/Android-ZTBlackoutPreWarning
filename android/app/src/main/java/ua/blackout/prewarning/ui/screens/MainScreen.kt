package ua.blackout.prewarning.ui.screens

import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.NotificationsOff
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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ua.blackout.prewarning.data.model.BlackoutSlot
import ua.blackout.prewarning.data.model.SlotStatus
import ua.blackout.prewarning.ui.components.TimelineBar
import java.time.LocalTime
import java.time.format.DateTimeFormatter

@Composable
fun MainScreen(
    queue: String = "1.1",
    isBlackoutNow: Boolean = false,
    countdownText: String = "01:35:12",
    slotTimeText: String = "14:00 – 18:00",
    slots: List<BlackoutSlot> = emptyList(),
    tomorrowSlots: List<BlackoutSlot> = emptyList(),
    notificationsEnabled: Boolean = true,
    lastUpdated: String = "19:27",
    nextUpdated: String = "19:42",
    onToggleNotifications: () -> Unit = {},
    onRefresh: () -> Unit = {}
) {
    var selectedDayTab by remember { mutableStateOf("today") }
    val activeSlots = if (selectedDayTab == "today") slots else (if (tomorrowSlots.isNotEmpty()) tomorrowSlots else slots)

    // Compute continuous blackout intervals
    val intervals = remember(activeSlots) {
        val list = mutableListOf<Triple<String, String, Int>>()
        var inBlock = false
        var startH = 0
        for (i in 0 until 24) {
            val isOff = activeSlots.getOrNull(i)?.status == SlotStatus.POWER_OFF
            if (isOff && !inBlock) {
                inBlock = true
                startH = i
            } else if (!isOff && inBlock) {
                inBlock = false
                val sStr = String.format("%02d:00", startH)
                val eStr = String.format("%02d:00", i)
                list.add(Triple(sStr, eStr, i - startH))
            }
        }
        if (inBlock) {
            val sStr = String.format("%02d:00", startH)
            list.add(Triple(sStr, "24:00", 24 - startH))
        }
        list
    }

    // Pulse animation for status dot
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 0.85f,
        targetValue = 1.25f,
        animationSpec = infiniteRepeatable(
            animation = tween(900, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulseScale"
    )

    val currentTimeStr = remember {
        LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm"))
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
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
                    text = "Черга $queue",
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
                            text = if (isBlackoutNow) "ЗАРАЗ НЕМАЄ СВІТЛА" else "ЗАРАЗ СВІТЛО Є",
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
                        text = if (isBlackoutNow) "Світло увімкнуть через:" else "До відключення залишилось:",
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
                            text = if (isBlackoutNow) "Період відключення:" else "Найближчий період:",
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

        // 3. Day Selector (Today / Tomorrow Segmented Pill)
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
                    text = "Сьогодні",
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
                    text = "Завтра",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (selectedDayTab == "tomorrow") Color.White else Color(0x99BAE6FD)
                )
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
                TimelineBar(
                    slots = activeSlots,
                    currentHour = LocalTime.now().hour,
                    currentMinute = LocalTime.now().minute
                )

                // List of Outage Hours for this day
                Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(Color(0x1AFFFFFF)))

                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = "ГОДИНИ БЕЗ СВІТЛА НА ЦЕЙ ДЕНЬ:",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xB3BAE6FD)
                    )

                    if (intervals.isNotEmpty()) {
                        intervals.forEach { (start, end, duration) ->
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
                                        text = "$duration год",
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
                                text = "Відключень не заплановано",
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
                        Text("Останнє оновлення:", fontSize = 11.sp, color = Color(0x99BAE6FD))
                        Text(lastUpdated, fontSize = 11.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, color = Color.White)
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("Наступне оновлення:", fontSize = 11.sp, color = Color(0x99BAE6FD))
                        Text(nextUpdated, fontSize = 11.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, color = Color.White)
                    }
                }

                // Circular white refresh button
                Box(
                    modifier = Modifier
                        .size(42.dp)
                        .clip(CircleShape)
                        .background(Color.White)
                        .clickable { onRefresh() },
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

        Spacer(modifier = Modifier.height(48.dp))
    }
}
