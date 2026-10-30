package ua.blackout.prewarning.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ua.blackout.prewarning.ui.components.TimelineBar

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    queue: String = "2.1",
    isBlackoutNow: Boolean = false,
    countdownText: String = "01:35:12",
    slotTimeText: String = "14:00 – 18:00",
    notificationsEnabled: Boolean = true,
    onToggleNotifications: () -> Unit = {},
    onRefresh: () -> Unit = {},
    onSendTestAlert: () -> Unit = {}
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("ZT Blackout Pre-Warning", fontSize = 18.sp, fontWeight = FontWeight.Bold)
                        Text("Житомиробленерго (ztoe.com.ua)", fontSize = 12.sp, color = MaterialTheme.colorScheme.outline)
                    }
                },
                actions = {
                    IconButton(onClick = onRefresh) {
                        Icon(Icons.Default.Refresh, contentDescription = "Оновити")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Queue Badge & Notification Toggle
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    color = MaterialTheme.colorScheme.primaryContainer,
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(
                        text = "Черга $queue",
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp),
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }

                FilledTonalButton(
                    onClick = onToggleNotifications,
                    colors = ButtonDefaults.filledTonalButtonColors(
                        containerColor = if (notificationsEnabled) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.errorContainer
                    )
                ) {
                    Icon(
                        if (notificationsEnabled) Icons.Default.NotificationsActive else Icons.Default.NotificationsOff,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(if (notificationsEnabled) "Сповіщення УВІМК" else "Сповіщення ВИМК")
                }
            }

            // Hero Outage Countdown Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(
                    containerColor = if (isBlackoutNow) Color(0xFFFEE2E2) else Color(0xFFECFDF5)
                )
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = if (isBlackoutNow) "ТРИВАЄ ВІДКЛЮЧЕННЯ" else "ДО НАЙБЛИЖЧОГО ВІДКЛЮЧЕННЯ",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (isBlackoutNow) Color(0xFF991B1B) else Color(0xFF065F46)
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = countdownText,
                        fontSize = 42.sp,
                        fontWeight = FontWeight.Black,
                        color = if (isBlackoutNow) Color(0xFFDC2626) else Color(0xFF059669)
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Слот: $slotTimeText",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium,
                        color = Color.DarkGray
                    )
                }
            }

            // 24-Hour Visual Schedule Timeline
            Text("Графік на сьогодні (24 години)", fontWeight = FontWeight.Bold, fontSize = 16.sp)
            TimelineBar()

            // Quick actions
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedButton(
                    onClick = onSendTestAlert,
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.Send, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Тест сповіщення")
                }
            }
        }
    }
}
