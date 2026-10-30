package ua.blackout.prewarning.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import ua.blackout.prewarning.data.parser.ZtoeParser
import ua.blackout.prewarning.data.repository.SettingsRepository
import ua.blackout.prewarning.notification.NotificationHelper
import java.time.LocalDate

@Composable
fun BlackoutAppNavigation(
    onThemeChanged: (Boolean) -> Unit = {}
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val settingsRepo = remember { SettingsRepository(context) }
    val initialSettings = remember { settingsRepo.getSettings() }

    var queue by remember { mutableStateOf(initialSettings.queue) }
    var advanceMinutes by remember { mutableStateOf(initialSettings.advanceNoticeMinutes) }
    var refreshMinutes by remember { mutableStateOf(initialSettings.refreshIntervalMinutes.toInt()) }
    var notificationsEnabled by remember { mutableStateOf(initialSettings.notificationsEnabled) }
    var soundEnabled by remember { mutableStateOf(initialSettings.soundEnabled) }
    var vibrationEnabled by remember { mutableStateOf(initialSettings.vibrationEnabled) }
    var currentLanguage by remember { mutableStateOf(initialSettings.language) }

    // Slots for Today and Tomorrow
    var slots by remember {
        mutableStateOf(ZtoeParser.generateFallbackSchedule(queue, LocalDate.now().toString()))
    }
    var tomorrowSlots by remember {
        mutableStateOf(ZtoeParser.generateFallbackSchedule(queue, LocalDate.now().plusDays(1).toString()))
    }

    // Pager for swipe left/right between windows
    val pagerState = rememberPagerState(initialPage = 0, pageCount = { 3 })

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0C1019))
    ) {
        // Windows 11 Blue Silk Wave atmosphere glow
        Box(
            modifier = Modifier
                .size(260.dp)
                .align(Alignment.TopEnd)
                .blur(80.dp)
                .background(Color(0x332563EB), CircleShape)
        )
        Box(
            modifier = Modifier
                .size(240.dp)
                .align(Alignment.BottomStart)
                .blur(70.dp)
                .background(Color(0x260EA5E9), CircleShape)
        )

        // Main swipeable screens
        HorizontalPager(
            state = pagerState,
            modifier = Modifier.fillMaxSize()
        ) { page ->
            when (page) {
                0 -> {
                    MainScreen(
                        queue = queue,
                        isBlackoutNow = false,
                        countdownText = "01:35:12",
                        slotTimeText = "14:00 – 18:00",
                        slots = slots,
                        tomorrowSlots = tomorrowSlots,
                        notificationsEnabled = notificationsEnabled,
                        lastUpdated = "19:27",
                        nextUpdated = "19:42",
                        onToggleNotifications = {
                            notificationsEnabled = !notificationsEnabled
                            settingsRepo.updateNotificationsEnabled(notificationsEnabled)
                        },
                        onRefresh = {
                            slots = ZtoeParser.generateFallbackSchedule(queue, LocalDate.now().toString())
                            tomorrowSlots = ZtoeParser.generateFallbackSchedule(queue, LocalDate.now().plusDays(1).toString())
                        }
                    )
                }
                1 -> {
                    SettingsScreen(
                        currentQueue = queue,
                        advanceMinutes = advanceMinutes,
                        refreshMinutes = refreshMinutes,
                        notificationsEnabled = notificationsEnabled,
                        soundEnabled = soundEnabled,
                        vibrationEnabled = vibrationEnabled,
                        currentLanguage = currentLanguage,
                        onQueueSelected = {
                            queue = it
                            slots = ZtoeParser.generateFallbackSchedule(queue, LocalDate.now().toString())
                            tomorrowSlots = ZtoeParser.generateFallbackSchedule(queue, LocalDate.now().plusDays(1).toString())
                            val current = settingsRepo.getSettings()
                            settingsRepo.saveSettings(current.copy(queue = it))
                        },
                        onAdvanceMinutesChanged = {
                            advanceMinutes = it
                            val current = settingsRepo.getSettings()
                            settingsRepo.saveSettings(current.copy(advanceNoticeMinutes = it))
                        },
                        onRefreshMinutesChanged = {
                            refreshMinutes = it
                            val current = settingsRepo.getSettings()
                            settingsRepo.saveSettings(current.copy(refreshIntervalMinutes = it.toLong()))
                        },
                        onToggleNotifications = {
                            notificationsEnabled = it
                            settingsRepo.updateNotificationsEnabled(it)
                        },
                        onToggleSound = {
                            soundEnabled = it
                            val current = settingsRepo.getSettings()
                            settingsRepo.saveSettings(current.copy(soundEnabled = it))
                        },
                        onToggleVibration = {
                            vibrationEnabled = it
                            val current = settingsRepo.getSettings()
                            settingsRepo.saveSettings(current.copy(vibrationEnabled = it))
                        },
                        onLanguageSelected = {
                            currentLanguage = it
                            val current = settingsRepo.getSettings()
                            settingsRepo.saveSettings(current.copy(language = it))
                        },
                        onSendTestAlert = {
                            // Test Notification without any lightning icon
                            NotificationHelper.showPreWarningNotification(
                                context,
                                9999,
                                "Тестове попередження",
                                "Черга $queue: відключення розпочнеться о 14:00 (через $advanceMinutes хв)."
                            )
                        },
                        onForceRefresh = {
                            slots = ZtoeParser.generateFallbackSchedule(queue, LocalDate.now().toString())
                            tomorrowSlots = ZtoeParser.generateFallbackSchedule(queue, LocalDate.now().plusDays(1).toString())
                        },
                        onResetDefaults = {
                            queue = "1.1"
                            advanceMinutes = 30
                            refreshMinutes = 15
                            notificationsEnabled = true
                            soundEnabled = true
                            vibrationEnabled = true
                            currentLanguage = "SYSTEM"
                            val current = settingsRepo.getSettings()
                            settingsRepo.saveSettings(
                                current.copy(
                                    queue = "1.1",
                                    advanceNoticeMinutes = 30,
                                    refreshIntervalMinutes = 15L,
                                    notificationsEnabled = true,
                                    soundEnabled = true,
                                    vibrationEnabled = true,
                                    language = "SYSTEM"
                                )
                            )
                            slots = ZtoeParser.generateFallbackSchedule(queue, LocalDate.now().toString())
                        }
                    )
                }
                2 -> {
                    AboutScreen()
                }
            }
        }

        // Floating Capsule Bottom Navigation Dock matching emulator
        Box(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 16.dp)
        ) {
            Box(
                modifier = Modifier
                    .clip(CircleShape)
                    .background(Color(0xCC141A29))
                    .padding(6.dp)
            ) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Schedule Tab
                    val isSchedule = pagerState.currentPage == 0
                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .clip(CircleShape)
                            .background(if (isSchedule) Color.White else Color.Transparent)
                            .clickable {
                                coroutineScope.launch { pagerState.animateScrollToPage(0) }
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            Icons.Default.Home,
                            contentDescription = "Графік",
                            tint = if (isSchedule) Color.Black else Color(0xB3BAE6FD),
                            modifier = Modifier.size(20.dp)
                        )
                    }

                    // Settings Tab
                    val isSettings = pagerState.currentPage == 1
                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .clip(CircleShape)
                            .background(if (isSettings) Color.White else Color.Transparent)
                            .clickable {
                                coroutineScope.launch { pagerState.animateScrollToPage(1) }
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            Icons.Default.Settings,
                            contentDescription = "Налаштування",
                            tint = if (isSettings) Color.Black else Color(0xB3BAE6FD),
                            modifier = Modifier.size(20.dp)
                        )
                    }

                    // About Tab
                    val isAbout = pagerState.currentPage == 2
                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .clip(CircleShape)
                            .background(if (isAbout) Color.White else Color.Transparent)
                            .clickable {
                                coroutineScope.launch { pagerState.animateScrollToPage(2) }
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            Icons.Default.Info,
                            contentDescription = "Про додаток",
                            tint = if (isAbout) Color.Black else Color(0xB3BAE6FD),
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }
        }
    }
}
