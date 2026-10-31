package ua.blackout.prewarning.ui.screens

import android.content.SharedPreferences
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import ua.blackout.prewarning.data.parser.FetchStatus
import ua.blackout.prewarning.data.parser.ZtoeParser
import ua.blackout.prewarning.data.repository.ScheduleRepository
import ua.blackout.prewarning.data.repository.SettingsRepository
import ua.blackout.prewarning.notification.NotificationHelper
import ua.blackout.prewarning.ui.AppStrings
import ua.blackout.prewarning.ui.theme.TimeOfDayPalette
import ua.blackout.prewarning.widget.BlackoutGlanceWidget
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@Composable
fun BlackoutAppNavigation(
    onThemeChanged: (Boolean) -> Unit = {}
) {
    val context = LocalContext.current
    val appContext = remember { context.applicationContext }
    val lifecycleOwner = LocalLifecycleOwner.current
    val coroutineScope = rememberCoroutineScope()
    val settingsRepo = remember { SettingsRepository(appContext) }
    val scheduleRepo = remember { ScheduleRepository(appContext) }
    val initialSettings = remember { settingsRepo.getSettings() }

    var siteUrl by remember { mutableStateOf(initialSettings.cityUrl) }
    var queue by remember { mutableStateOf(initialSettings.queue) }
    var advanceMinutes by remember { mutableStateOf(initialSettings.advanceNoticeMinutes) }
    var refreshMinutes by remember { mutableStateOf(initialSettings.refreshIntervalMinutes.toInt()) }
    var notificationsEnabled by remember { mutableStateOf(initialSettings.notificationsEnabled) }
    var soundEnabled by remember { mutableStateOf(initialSettings.soundEnabled) }
    var vibrationEnabled by remember { mutableStateOf(initialSettings.vibrationEnabled) }
    var currentLanguage by remember { mutableStateOf(initialSettings.language) }

    // Custom In-App Banner with Application Icon (replaces raw OS Toast so Android robot icon never appears)
    var appBannerMessage by remember { mutableStateOf<String?>(null) }
    var appBannerTick by remember { mutableStateOf(0L) }

    val showAppBanner: (String) -> Unit = { msg ->
        appBannerMessage = msg
        appBannerTick = System.currentTimeMillis()
    }

    LaunchedEffect(appBannerTick) {
        if (appBannerMessage != null) {
            delay(3000L)
            appBannerMessage = null
        }
    }

    val resolvedLang = remember(currentLanguage) {
        AppStrings.resolveLang(currentLanguage)
    }

    // Dynamic Last Updated & Next Update Timers
    val nowTime = remember { LocalTime.now(ZoneId.of("Europe/Kyiv")) }
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

    // Dynamic real-time countdown info updated every second ONLY while Lifecycle is RESUMED (zero background battery drain)
    var statusInfo by remember {
        mutableStateOf(scheduleRepo.getCurrentStatusAndCountdown(queue))
    }

    LaunchedEffect(lifecycleOwner, slots, queue) {
        lifecycleOwner.lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            while (true) {
                statusInfo = scheduleRepo.getCurrentStatusAndCountdown(queue)
                delay(1000L)
            }
        }
    }

    // Listen to SharedPreferences changes from Widget (ToggleAlertsActionCallback / RefreshWidgetActionCallback)
    // Properly unregistered in onDispose to prevent memory leaks
    DisposableEffect(settingsRepo, scheduleRepo) {
        val settingsPrefs = settingsRepo.getSharedPreferences()
        val schedulePrefs = scheduleRepo.getSharedPreferences()

        val settingsListener = SharedPreferences.OnSharedPreferenceChangeListener { _, _ ->
            val updated = settingsRepo.getSettings()
            queue = updated.queue
            siteUrl = updated.cityUrl
            advanceMinutes = updated.advanceNoticeMinutes
            refreshMinutes = updated.refreshIntervalMinutes.toInt()
            notificationsEnabled = updated.notificationsEnabled
            soundEnabled = updated.soundEnabled
            vibrationEnabled = updated.vibrationEnabled
            currentLanguage = updated.language
        }

        val scheduleListener = SharedPreferences.OnSharedPreferenceChangeListener { _, _ ->
            val currentQ = settingsRepo.getSettings().queue
            slots = scheduleRepo.getTodaySlots(currentQ)
            tomorrowSlots = scheduleRepo.getTomorrowSlots(currentQ)
            hasTomorrowSchedule = scheduleRepo.hasTomorrowSchedule(currentQ)
            statusInfo = scheduleRepo.getCurrentStatusAndCountdown(currentQ)
        }

        settingsPrefs.registerOnSharedPreferenceChangeListener(settingsListener)
        schedulePrefs.registerOnSharedPreferenceChangeListener(scheduleListener)

        onDispose {
            settingsPrefs.unregisterOnSharedPreferenceChangeListener(settingsListener)
            schedulePrefs.unregisterOnSharedPreferenceChangeListener(scheduleListener)
        }
    }

    // Fetch initial schedule in background
    LaunchedEffect(queue) {
        withContext(Dispatchers.IO) {
            val res = ZtoeParser.fetchFullSchedule(siteUrl, queue, appContext)
            if (res.status == FetchStatus.SUCCESS) {
                slots = res.todaySlots
                tomorrowSlots = res.tomorrowSlots
                hasTomorrowSchedule = res.hasTomorrowSchedule
                scheduleRepo.saveSchedule(queue, res.todaySlots, res.tomorrowSlots)
                statusInfo = scheduleRepo.getCurrentStatusAndCountdown(queue)
            }
            try {
                BlackoutGlanceWidget.syncAllWidgets(appContext)
            } catch (_: Exception) {}
        }
    }

    // Helper for manual refresh with strict verification & error reporting
    val performManualRefresh: () -> Unit = {
        coroutineScope.launch {
            val res = withContext(Dispatchers.IO) {
                ZtoeParser.fetchFullSchedule(siteUrl, queue, appContext)
            }
            when (res.status) {
                FetchStatus.SUCCESS -> {
                    val now = LocalTime.now(ZoneId.of("Europe/Kyiv"))
                    lastUpdated = now.format(DateTimeFormatter.ofPattern("HH:mm"))
                    nextUpdated = now.plusMinutes(refreshMinutes.toLong()).format(DateTimeFormatter.ofPattern("HH:mm"))
                    slots = res.todaySlots
                    tomorrowSlots = res.tomorrowSlots
                    hasTomorrowSchedule = res.hasTomorrowSchedule
                    withContext(Dispatchers.IO) {
                        scheduleRepo.saveSchedule(queue, res.todaySlots, res.tomorrowSlots)
                        try {
                            BlackoutGlanceWidget.syncAllWidgets(appContext)
                        } catch (_: Exception) {}
                    }
                    statusInfo = scheduleRepo.getCurrentStatusAndCountdown(queue)
                    showAppBanner(AppStrings.refreshSuccessToast(resolvedLang))
                }
                FetchStatus.NO_INTERNET -> {
                    showAppBanner(AppStrings.errorNoInternet(resolvedLang))
                }
                FetchStatus.NO_QUEUES_FOUND -> {
                    showAppBanner(AppStrings.errorNoQueuesFound(resolvedLang))
                }
            }
        }
    }

    // Gradual Time-of-Day Background Palette (60% Primary, 30% Secondary, 10% Accent, Supporting/Core)
    // Keyed by minute-of-day so full-screen radial gradients are only recalculated once per minute instead of every second
    val currentMinuteOfDay = remember(statusInfo.countdownText) {
        val now = LocalTime.now(ZoneId.of("Europe/Kyiv"))
        now.hour * 60 + now.minute
    }
    val bgColors = remember(currentMinuteOfDay) {
        TimeOfDayPalette.getInterpolatedColors(LocalTime.now(ZoneId.of("Europe/Kyiv")))
    }

    // Pager for swipe left/right between windows with beyondViewportPageCount = 2 to eliminate swipe jittering
    val pagerState = rememberPagerState(initialPage = 0, pageCount = { 3 })

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(bgColors.primary)
            .drawBehind {
                // Primary (60%) & Secondary (30%) atmospheric base gradient
                drawRect(
                    brush = Brush.verticalGradient(
                        colors = listOf(
                            bgColors.supporting.copy(alpha = 0.55f),
                            bgColors.primary.copy(alpha = 0.60f),
                            bgColors.secondary.copy(alpha = 0.45f)
                        )
                    )
                )
                // Secondary (30%) top-right radial blurred orb
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(bgColors.secondary.copy(alpha = 0.65f), bgColors.secondary.copy(alpha = 0.25f), Color.Transparent),
                        center = Offset(size.width * 0.92f, size.height * 0.14f),
                        radius = size.width * 0.90f
                    )
                )
                // Secondary (30%) & Supporting lower-left radial blurred orb
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(bgColors.secondary.copy(alpha = 0.55f), bgColors.supporting.copy(alpha = 0.22f), Color.Transparent),
                        center = Offset(size.width * 0.08f, size.height * 0.65f),
                        radius = size.width * 0.92f
                    )
                )
                // Accent (10%) bottom-right radial blurred highlight orb
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(bgColors.accent.copy(alpha = 0.55f), bgColors.accent.copy(alpha = 0.18f), Color.Transparent),
                        center = Offset(size.width * 0.85f, size.height * 0.86f),
                        radius = size.width * 0.72f
                    )
                )
            }
    ) {
        // Main swipeable screens with pre-composed pages (beyondViewportPageCount = 2) for smooth 60fps swiping
        HorizontalPager(
            state = pagerState,
            beyondViewportPageCount = 2,
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
                            val updated = settingsRepo.updateNotificationsEnabled(!notificationsEnabled)
                            notificationsEnabled = updated.notificationsEnabled
                            soundEnabled = updated.soundEnabled
                            vibrationEnabled = updated.vibrationEnabled
                            coroutineScope.launch(Dispatchers.IO) {
                                try {
                                    BlackoutGlanceWidget.syncAllWidgets(appContext)
                                } catch (_: Exception) {}
                            }
                        },
                        onRefresh = {
                            performManualRefresh()
                        }
                    )
                }
                1 -> {
                    SettingsScreen(
                        currentQueue = queue,
                        siteUrl = siteUrl,
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
                                val res = ZtoeParser.fetchFullSchedule(siteUrl, newQueue, appContext)
                                if (res.status == FetchStatus.SUCCESS || !scheduleRepo.hasValidTodayCache(newQueue)) {
                                    scheduleRepo.saveSchedule(newQueue, res.todaySlots, res.tomorrowSlots)
                                }
                                slots = scheduleRepo.getTodaySlots(newQueue)
                                tomorrowSlots = scheduleRepo.getTomorrowSlots(newQueue)
                                hasTomorrowSchedule = scheduleRepo.hasTomorrowSchedule(newQueue)
                                statusInfo = scheduleRepo.getCurrentStatusAndCountdown(newQueue)
                                try {
                                    BlackoutGlanceWidget.syncAllWidgets(appContext)
                                } catch (_: Exception) {}
                            }
                        },
                        onSiteUrlChanged = { newUrl ->
                            siteUrl = newUrl
                            val current = settingsRepo.getSettings()
                            settingsRepo.saveSettings(current.copy(cityUrl = newUrl))
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
                            val now = LocalTime.now(ZoneId.of("Europe/Kyiv"))
                            nextUpdated = now.plusMinutes(it.toLong()).format(DateTimeFormatter.ofPattern("HH:mm"))
                            ua.blackout.prewarning.worker.ScheduleSyncWorker.schedulePeriodicWork(
                                appContext,
                                androidx.work.ExistingPeriodicWorkPolicy.UPDATE
                            )
                        },
                        onToggleNotifications = { newEnabled ->
                            val updated = settingsRepo.updateNotificationsEnabled(newEnabled)
                            notificationsEnabled = updated.notificationsEnabled
                            soundEnabled = updated.soundEnabled
                            vibrationEnabled = updated.vibrationEnabled
                            coroutineScope.launch(Dispatchers.IO) {
                                try {
                                    BlackoutGlanceWidget.syncAllWidgets(appContext)
                                } catch (_: Exception) {}
                            }
                        },
                        onToggleSound = {
                            soundEnabled = it
                            val current = settingsRepo.getSettings()
                            settingsRepo.saveSettings(current.copy(soundEnabled = it, prevSoundEnabled = it))
                        },
                        onToggleVibration = {
                            vibrationEnabled = it
                            val current = settingsRepo.getSettings()
                            settingsRepo.saveSettings(current.copy(vibrationEnabled = it, prevVibrationEnabled = it))
                        },
                        onLanguageSelected = {
                            currentLanguage = it
                            val current = settingsRepo.getSettings()
                            settingsRepo.saveSettings(current.copy(language = it))
                        },
                        onSendTestAlert = {
                            // Test notification strictly respects sound and vibration settings
                            NotificationHelper.showPreWarningNotification(
                                context = appContext,
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
                            performManualRefresh()
                        },
                        onResetDefaults = {
                            // CRITICAL CONSTANTS — Default values: advanceMinutes = 15, refreshMinutes = 30
                            queue = "1.1"
                            siteUrl = "https://www.ztoe.com.ua/unhooking-search.php"
                            advanceMinutes = 15
                            refreshMinutes = 30
                            notificationsEnabled = true
                            soundEnabled = true
                            vibrationEnabled = true
                            currentLanguage = "SYSTEM"

                            val current = settingsRepo.getSettings()
                            settingsRepo.saveSettings(
                                current.copy(
                                    cityUrl = "https://www.ztoe.com.ua/unhooking-search.php",
                                    queue = "1.1",
                                    advanceNoticeMinutes = 15,
                                    refreshIntervalMinutes = 30L,
                                    notificationsEnabled = true,
                                    soundEnabled = true,
                                    vibrationEnabled = true,
                                    prevSoundEnabled = true,
                                    prevVibrationEnabled = true,
                                    language = "SYSTEM"
                                )
                            )
                            ua.blackout.prewarning.worker.ScheduleSyncWorker.schedulePeriodicWork(
                                appContext,
                                androidx.work.ExistingPeriodicWorkPolicy.UPDATE
                            )

                            coroutineScope.launch(Dispatchers.IO) {
                                val res = ZtoeParser.fetchFullSchedule(siteUrl, "1.1", appContext)
                                if (res.status == FetchStatus.SUCCESS || !scheduleRepo.hasValidTodayCache("1.1")) {
                                    scheduleRepo.saveSchedule("1.1", res.todaySlots, res.tomorrowSlots)
                                }
                                slots = scheduleRepo.getTodaySlots("1.1")
                                tomorrowSlots = scheduleRepo.getTomorrowSlots("1.1")
                                hasTomorrowSchedule = scheduleRepo.hasTomorrowSchedule("1.1")
                                statusInfo = scheduleRepo.getCurrentStatusAndCountdown("1.1")
                                try {
                                    BlackoutGlanceWidget.syncAllWidgets(appContext)
                                } catch (_: Exception) {}
                            }
                        },
                        onShowAppBanner = showAppBanner
                    )
                }
                2 -> {
                    AboutScreen(lang = resolvedLang)
                }
            }
        }

        // Top In-App Notification Banner with Application Icon (white lightning on #FF5E3A rounded square)
        AnimatedVisibility(
            visible = appBannerMessage != null,
            enter = fadeIn() + slideInVertically(initialOffsetY = { -it }),
            exit = fadeOut() + slideOutVertically(targetOffsetY = { -it }),
            modifier = Modifier
                .align(Alignment.TopCenter)
                .statusBarsPadding()
                .padding(top = 12.dp, start = 20.dp, end = 20.dp)
        ) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(20.dp))
                    .background(Color(0xF2141A29))
                    .padding(horizontal = 16.dp, vertical = 10.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(28.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0xFFFF5E3A)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Bolt,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                    Text(
                        text = appBannerMessage ?: "",
                        color = Color.White,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
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
