package ua.blackout.prewarning.ui.screens

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import ua.blackout.prewarning.data.model.BlackoutSlot
import ua.blackout.prewarning.data.model.SlotStatus
import ua.blackout.prewarning.data.parser.ZtoeParser
import ua.blackout.prewarning.notification.NotificationHelper
import java.time.LocalDate

enum class AppTab(val title: String) {
    SCHEDULE("Графік"),
    SETTINGS("Налаштування"),
    ABOUT("Про додаток")
}

@Composable
fun BlackoutAppNavigation(
    onThemeChanged: (Boolean) -> Unit = {}
) {
    val context = LocalContext.current
    var currentTab by remember { mutableStateOf(AppTab.SCHEDULE) }
    var queue by remember { mutableStateOf("2.1") }
    var advanceMinutes by remember { mutableStateOf(30) }
    var refreshMinutes by remember { mutableStateOf(15) }
    var notificationsEnabled by remember { mutableStateOf(true) }
    var soundEnabled by remember { mutableStateOf(true) }
    var vibrationEnabled by remember { mutableStateOf(true) }

    // Slots
    var slots by remember {
        mutableStateOf(ZtoeParser.generateFallbackSchedule(queue, LocalDate.now().toString()))
    }

    Scaffold(
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = currentTab == AppTab.SCHEDULE,
                    onClick = { currentTab = AppTab.SCHEDULE },
                    icon = { Icon(Icons.Default.Schedule, contentDescription = "Графік") },
                    label = { Text("Графік") }
                )
                NavigationBarItem(
                    selected = currentTab == AppTab.SETTINGS,
                    onClick = { currentTab = AppTab.SETTINGS },
                    icon = { Icon(Icons.Default.Settings, contentDescription = "Налаштування") },
                    label = { Text("Налаштування") }
                )
                NavigationBarItem(
                    selected = currentTab == AppTab.ABOUT,
                    onClick = { currentTab = AppTab.ABOUT },
                    icon = { Icon(Icons.Default.Info, contentDescription = "Про додаток") },
                    label = { Text("Про додаток") }
                )
            }
        }
    ) { padding ->
        Surface(modifier = Modifier.padding(padding)) {
            when (currentTab) {
                AppTab.SCHEDULE -> {
                    MainScreen(
                        queue = queue,
                        isBlackoutNow = false,
                        countdownText = "01:35:12",
                        slotTimeText = "14:00 – 18:00",
                        notificationsEnabled = notificationsEnabled,
                        onToggleNotifications = { notificationsEnabled = !notificationsEnabled },
                        onRefresh = {
                            slots = ZtoeParser.generateFallbackSchedule(queue, LocalDate.now().toString())
                        },
                        onSendTestAlert = {
                            NotificationHelper.showPreWarningNotification(
                                context,
                                9999,
                                "⚡ Тестове попередження",
                                "Черга $queue: відключення розпочнеться о 14:00 (через $advanceMinutes хв)."
                            )
                        }
                    )
                }
                AppTab.SETTINGS -> {
                    SettingsScreen(
                        currentQueue = queue,
                        advanceMinutes = advanceMinutes,
                        refreshMinutes = refreshMinutes,
                        notificationsEnabled = notificationsEnabled,
                        soundEnabled = soundEnabled,
                        vibrationEnabled = vibrationEnabled,
                        onQueueSelected = {
                            queue = it
                            slots = ZtoeParser.generateFallbackSchedule(queue, LocalDate.now().toString())
                        },
                        onAdvanceMinutesChanged = { advanceMinutes = it },
                        onRefreshMinutesChanged = { refreshMinutes = it },
                        onToggleNotifications = { notificationsEnabled = it },
                        onToggleSound = { soundEnabled = it },
                        onToggleVibration = { vibrationEnabled = it },
                        onResetDefaults = {
                            queue = "2.1"
                            advanceMinutes = 30
                            refreshMinutes = 15
                            notificationsEnabled = true
                            soundEnabled = true
                            vibrationEnabled = true
                        }
                    )
                }
                AppTab.ABOUT -> {
                    AboutScreen()
                }
            }
        }
    }
}
