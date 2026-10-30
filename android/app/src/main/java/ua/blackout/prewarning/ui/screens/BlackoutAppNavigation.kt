package ua.blackout.prewarning.ui.screens

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.glance.appwidget.updateAll
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import ua.blackout.prewarning.data.model.BlackoutSlot
import ua.blackout.prewarning.data.parser.ZtoeParser
import ua.blackout.prewarning.data.repository.ScheduleRepository
import ua.blackout.prewarning.data.repository.SettingsRepository
import ua.blackout.prewarning.notification.NotificationHelper
import ua.blackout.prewarning.ui.AppStrings
import ua.blackout.prewarning.widget.BlackoutGlanceWidget
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter

@Composable
fun BlackoutAppNavigation(
    onThemeChanged: (Boolean) -> Unit = {}
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val settingsRepo = remember { SettingsRepository(context) }
    val scheduleRepo = remember { ScheduleRepository(context) }
    val initialSettings = remember { settingsRepo.getSettings() }

    var queue by remember { mutableStateOf(initialSettings.queue) }
    var advanceMinutes by remember { mutableStateOf(initialSettings.advanceNoticeMinutes) }
    var refreshMinutes by remember { mutableStateOf(initialSettings.refreshIntervalMinutes.toInt()) }
    var notificationsEnabled by remember { mutableStateOf(initialSettings.notificationsEnabled) }
    var soundEnabled by remember { mutableStateOf(initialSettings.soundEnabled) }
    var vibrationEnabled by remember { mutableStateOf(initialSettings.vibrationEnabled) }
    var currentLanguage by remember { mutableStateOf(initialSettings.language) }

    val resolvedLang = remember(currentLanguage) {
        AppStrings.resolveLang(currentLanguage)
    }

    // Dynamic Last Updated & Next Update Timers
    val nowTime = remember { LocalTime.now() }
    var lastUpdated by remember {
        mutableStateOf(nowTime.format(DateTimeFormatter.ofPattern("HH:mm")))
    }
    var nextUpdated by remember {
        mutableStateOf(nowTime.plusMinutes(refreshMinutes.toLong()).format(DateTimeFormatter.ofPattern("HH:mm")))
    }

    // Slots for Today and Tomorrow from ScheduleRepository
    var slots by remember {
        mutableStateOf(scheduleRepo.getTodaySlots(queue))
    }
    var tomorrowSlots by remember {
        mutableStateOf(scheduleRepo.getTomorrowSlots(queue))
    }
    var hasTomorrowSchedule by remember {
        mutableStateOf(scheduleRepo.hasTomorrowSchedule(queue))
    }

    // Dynamic real-time countdown info updated every second
    var statusInfo by remember {
        mutableStateOf(scheduleRepo.getCurrentStatusAndCountdown(queue))
    }

    LaunchedEffect(slots, queue) {
        while (true) {
            statusInfo = scheduleRepo.getCurrentStatusAndCountdown(queue)
            kotlinx.coroutines.delay(1000L)
        }
    }

    // Fetch initial schedule in background
    LaunchedEffect(queue) {
        withContext(Dispatchers.IO) {
            val res = ZtoeParser.fetchFullSchedule(initialSettings.cityUrl, queue)
            slots = res.todaySlots
            tomorrowSlots = res.tomorrowSlots
            hasTomorrowSchedule = res.hasTomorrowSchedule
            scheduleRepo.saveSchedule(queue, res.todaySlots, res.tomorrowSlots)
            statusInfo = scheduleRepo.getCurrentStatusAndCountdown(queue)
            try {
                BlackoutGlanceWidget().updateAll(context)
            } catch (_: Exception) {}
        }
    }

    // Pager for swipe left/right between windows
    val pagerState = rememberPagerState(initialPage = 0, pageCount = { 3 })

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0C1019))
            .drawBehind {
                // Smooth top-right blue radial glow (zero clipping or rectangular artifacts!)
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(Color(0x552563EB), Color(0x222563EB), Color.Transparent),
                        center = Offset(size.width * 0.95f, size.height * 0.12f),
                        radius = size.width * 0.85f
                    )
                )
                // Smooth bottom-left sky radial glow
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(Color(0x400EA5E9), Color(0x180EA5E9), Color.Transparent),
                        center = Offset(size.width * 0.05f, size.height * 0.65f),
                        radius = size.width * 0.9f
                    )
                )
                // Smooth bottom-right cyan glow
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(Color(0x3006B6D4), Color.Transparent),
                        center = Offset(size.width * 0.85f, size.height * 0.88f),
                        radius = size.width * 0.75f
                    )
                )
            }
    ) {
        // Main swipeable screens
        HorizontalPager(
            state = pagerState,
            modifier = Modifier.fillMaxSize()
        ) { page ->
            when (page) {
                0 -> {
                    MainScreen(
                        queue = queue,
                        isBlackoutNow = statusInfo.isBlackoutNow,
                        countdownText = statusInfo.countdownText,
                        slotTimeText = statusInfo.nextSlotTime,
                        slots = slots,
                        tomorrowSlots = tomorrowSlots,
                        hasTomorrowSchedule = hasTomorrowSchedule,
                        notificationsEnabled = notificationsEnabled,
                        lastUpdated = lastUpdated,
                        nextUpdated = nextUpdated,
                        lang = resolvedLang,
                        onToggleNotifications = {
                            notificationsEnabled = !notificationsEnabled
                            settingsRepo.updateNotificationsEnabled(notificationsEnabled)
                            coroutineScope.launch {
                                try {
                                    BlackoutGlanceWidget().updateAll(context)
                                } catch (_: Exception) {}
                            }
                        },
                        onRefresh = {
                            val now = LocalTime.now()
                            lastUpdated = now.format(DateTimeFormatter.ofPattern("HH:mm"))
                            nextUpdated = now.plusMinutes(refreshMinutes.toLong()).format(DateTimeFormatter.ofPattern("HH:mm"))

                            coroutineScope.launch(Dispatchers.IO) {
                                val currentSettings = settingsRepo.getSettings()
                                val res = ZtoeParser.fetchFullSchedule(currentSettings.cityUrl, queue)
                                slots = res.todaySlots
                                tomorrowSlots = res.tomorrowSlots
                                hasTomorrowSchedule = res.hasTomorrowSchedule
                                scheduleRepo.saveSchedule(queue, res.todaySlots, res.tomorrowSlots)
                                statusInfo = scheduleRepo.getCurrentStatusAndCountdown(queue)
                                try {
                                    BlackoutGlanceWidget().updateAll(context)
                                } catch (_: Exception) {}
                            }
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
                        lang = resolvedLang,
                        onQueueSelected = { newQueue ->
                            queue = newQueue
                            val current = settingsRepo.getSettings()
                            settingsRepo.saveSettings(current.copy(queue = newQueue))

                            coroutineScope.launch(Dispatchers.IO) {
                                val res = ZtoeParser.fetchFullSchedule(current.cityUrl, newQueue)
                                slots = res.todaySlots
                                tomorrowSlots = res.tomorrowSlots
                                hasTomorrowSchedule = res.hasTomorrowSchedule
                                scheduleRepo.saveSchedule(newQueue, res.todaySlots, res.tomorrowSlots)
                                statusInfo = scheduleRepo.getCurrentStatusAndCountdown(newQueue)
                                try {
                                    BlackoutGlanceWidget().updateAll(context)
                                } catch (_: Exception) {}
                            }
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
                            val now = LocalTime.now()
                            nextUpdated = now.plusMinutes(it.toLong()).format(DateTimeFormatter.ofPattern("HH:mm"))
                        },
                        onToggleNotifications = {
                            notificationsEnabled = it
                            settingsRepo.updateNotificationsEnabled(it)
                            coroutineScope.launch {
                                BlackoutGlanceWidget().updateAll(context)
                            }
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
                            // Test notification strictly respects sound and vibration settings
                            NotificationHelper.showPreWarningNotification(
                                context = context,
                                notificationId = 9999,
                                title = if (resolvedLang == "uk") "Тестове попередження" else "Test notification",
                                body = if (resolvedLang == "uk")
                                    "Черга $queue: відключення розпочнеться о 14:00 (через $advanceMinutes хв)."
                                else
                                    "Queue $queue: blackout begins at 14:00 (in $advanceMinutes min).",
                                isTest = true
                            )
                        },
                        onForceRefresh = {
                            val now = LocalTime.now()
                            lastUpdated = now.format(DateTimeFormatter.ofPattern("HH:mm"))
                            nextUpdated = now.plusMinutes(refreshMinutes.toLong()).format(DateTimeFormatter.ofPattern("HH:mm"))

                            coroutineScope.launch(Dispatchers.IO) {
                                val currentSettings = settingsRepo.getSettings()
                                val res = ZtoeParser.fetchFullSchedule(currentSettings.cityUrl, queue)
                                slots = res.todaySlots
                                tomorrowSlots = res.tomorrowSlots
                                hasTomorrowSchedule = res.hasTomorrowSchedule
                                scheduleRepo.saveSchedule(queue, res.todaySlots, res.tomorrowSlots)
                                statusInfo = scheduleRepo.getCurrentStatusAndCountdown(queue)
                                try {
                                    BlackoutGlanceWidget().updateAll(context)
                                } catch (_: Exception) {}
                            }
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

                            coroutineScope.launch(Dispatchers.IO) {
                                val res = ZtoeParser.fetchFullSchedule(current.cityUrl, "1.1")
                                slots = res.todaySlots
                                tomorrowSlots = res.tomorrowSlots
                                hasTomorrowSchedule = res.hasTomorrowSchedule
                                BlackoutGlanceWidget().updateAll(context)
                            }
                        }
                    )
                }
                2 -> {
                    AboutScreen(lang = resolvedLang)
                }
            }
        }

        // Floating Capsule Bottom Navigation Dock matching emulator
        Box(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .navigationBarsPadding()
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
