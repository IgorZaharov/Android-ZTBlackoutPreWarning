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
import androidx.compose.ui.geometry.Size
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

private fun smoothGaussianRadialBrush(
    color: Color,
    maxAlpha: Float,
    center: Offset,
    radius: Float
): Brush {
    val safeRadius = radius.coerceAtLeast(1f)
    return Brush.radialGradient(
        colorStops = arrayOf(
            0.00f to color.copy(alpha = maxAlpha),
            0.18f to color.copy(alpha = maxAlpha * 0.90f),
            0.36f to color.copy(alpha = maxAlpha * 0.68f),
            0.54f to color.copy(alpha = maxAlpha * 0.42f),
            0.72f to color.copy(alpha = maxAlpha * 0.18f),
            0.88f to color.copy(alpha = maxAlpha * 0.04f),
            1.00f to color.copy(alpha = 0f)
        ),
        center = center,
        radius = safeRadius
    )
}

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

    // Keep strong references to SharedPreferences listeners (Android stores them in a WeakHashMap)
    val settingsListener = remember(settingsRepo, scheduleRepo) {
        SharedPreferences.OnSharedPreferenceChangeListener { _, _ ->
            val updated = settingsRepo.getSettings()
            val queueChanged = queue != updated.queue
            queue = updated.queue
            siteUrl = updated.cityUrl
            advanceMinutes = updated.advanceNoticeMinutes
            refreshMinutes = updated.refreshIntervalMinutes.toInt()
            notificationsEnabled = updated.notificationsEnabled
            soundEnabled = updated.soundEnabled
            vibrationEnabled = updated.vibrationEnabled
            currentLanguage = updated.language
            if (queueChanged) {
                slots = scheduleRepo.getTodaySlots(updated.queue)
                tomorrowSlots = scheduleRepo.getTomorrowSlots(updated.queue)
                hasTomorrowSchedule = scheduleRepo.hasTomorrowSchedule(updated.queue)
                statusInfo = scheduleRepo.getCurrentStatusAndCountdown(updated.queue)
            }
        }
    }

    val scheduleListener = remember(settingsRepo, scheduleRepo) {
        SharedPreferences.OnSharedPreferenceChangeListener { _, _ ->
            val currentQ = settingsRepo.getSettings().queue
            slots = scheduleRepo.getTodaySlots(currentQ)
            tomorrowSlots = scheduleRepo.getTomorrowSlots(currentQ)
            hasTomorrowSchedule = scheduleRepo.hasTomorrowSchedule(currentQ)
            statusInfo = scheduleRepo.getCurrentStatusAndCountdown(currentQ)
        }
    }

    // Listen to SharedPreferences changes from Widget (ToggleAlertsActionCallback / RefreshWidgetActionCallback)
    // Properly unregistered in onDispose to prevent memory leaks
    DisposableEffect(settingsRepo, scheduleRepo, settingsListener, scheduleListener) {
        val settingsPrefs = settingsRepo.getSharedPreferences()
        val schedulePrefs = scheduleRepo.getSharedPreferences()

        settingsPrefs.registerOnSharedPreferenceChangeListener(settingsListener)
        schedulePrefs.registerOnSharedPreferenceChangeListener(scheduleListener)

        onDispose {
            settingsPrefs.unregisterOnSharedPreferenceChangeListener(settingsListener)
            schedulePrefs.unregisterOnSharedPreferenceChangeListener(scheduleListener)
        }
    }

    // Fetch schedule when queue or siteUrl changes; update all Compose states on the Main UI thread
    LaunchedEffect(queue, siteUrl) {
        val activeQ = queue
        slots = scheduleRepo.getTodaySlots(activeQ)
        tomorrowSlots = scheduleRepo.getTomorrowSlots(activeQ)
        hasTomorrowSchedule = scheduleRepo.hasTomorrowSchedule(activeQ)
        statusInfo = scheduleRepo.getCurrentStatusAndCountdown(activeQ)

        val res = withContext(Dispatchers.IO) {
            ZtoeParser.fetchFullSchedule(siteUrl, activeQ, appContext)
        }
        if (res.status == FetchStatus.SUCCESS || !scheduleRepo.hasValidTodayCache(activeQ)) {
            withContext(Dispatchers.IO) {
                scheduleRepo.saveSchedule(activeQ, res.todaySlots, res.tomorrowSlots)
            }
        }
        slots = scheduleRepo.getTodaySlots(activeQ)
        tomorrowSlots = scheduleRepo.getTomorrowSlots(activeQ)
        hasTomorrowSchedule = scheduleRepo.hasTomorrowSchedule(activeQ)
        statusInfo = scheduleRepo.getCurrentStatusAndCountdown(activeQ)
        val now = LocalTime.now(ZoneId.of("Europe/Kyiv"))
        lastUpdated = now.format(DateTimeFormatter.ofPattern("HH:mm"))
        nextUpdated = now.plusMinutes(refreshMinutes.toLong()).format(DateTimeFormatter.ofPattern("HH:mm"))

        withContext(Dispatchers.IO) {
            try {
                BlackoutGlanceWidget.syncAllWidgets(appContext)
            } catch (_: Exception) {}
        }
    }

    // Helper for manual refresh with strict verification & error reporting
    val performManualRefresh: () -> Unit = {
        coroutineScope.launch {
            val res = withContext(Dispatchers.IO) {
                ZtoeParser.fetchFullSchedule(siteUrl, queue, appContext, forceNetwork = true)
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
                val w = size.width.coerceAtLeast(1f)
                val h = size.height.coerceAtLeast(1f)
                val maxDim = maxOf(w, h)

                // 1. Primary (60%) & Secondary (30%) full-canvas radial atmospheric base matching PhoneSimulator.tsx
                drawRect(
                    brush = Brush.radialGradient(
                        colorStops = arrayOf(
                            0.0f to bgColors.primary.copy(alpha = 0.60f),
                            0.55f to bgColors.primary.copy(alpha = 0.35f),
                            1.0f to bgColors.secondary.copy(alpha = 0.60f)
                        ),
                        center = Offset(w * 0.50f, h * 0.45f),
                        radius = maxDim * 0.85f
                    )
                )

                // 2. Secondary (30%) top-right smooth Gaussian blurred orb (full-rect draw avoids circular edge clipping)
                drawRect(
                    brush = smoothGaussianRadialBrush(
                        color = bgColors.secondary,
                        maxAlpha = 0.68f,
                        center = Offset(w * 0.88f, h * 0.08f),
                        radius = w * 0.98f
                    )
                )

                // 3. Supporting/Core top-left contrast orb matching PhoneSimulator.tsx
                drawRect(
                    brush = smoothGaussianRadialBrush(
                        color = bgColors.supporting,
                        maxAlpha = 0.62f,
                        center = Offset(w * 0.12f, h * 0.06f),
                        radius = w * 0.92f
                    )
                )

                // 4. Secondary (30%) lower-left smooth Gaussian wave matching PhoneSimulator.tsx
                drawRect(
                    brush = smoothGaussianRadialBrush(
                        color = bgColors.secondary,
                        maxAlpha = 0.58f,
                        center = Offset(w * 0.08f, h * 0.68f),
                        radius = w * 0.98f
                    )
                )

                // 5. Accent (10%) bottom-right highlight orb matching PhoneSimulator.tsx
                drawRect(
                    brush = smoothGaussianRadialBrush(
                        color = bgColors.accent,
                        maxAlpha = 0.52f,
                        center = Offset(w * 0.82f, h * 0.84f),
                        radius = w * 0.82f
                    )
                )

                // 6. Subtle top scrim (#0B0C10 at 65% -> 25% -> 0%) matching PhoneSimulator.tsx for crisp header contrast
                val scrimHeight = 148.dp.toPx().coerceAtMost(h)
                drawRect(
                    brush = Brush.verticalGradient(
                        colorStops = arrayOf(
                            0.0f to Color(0xFF0B0C10).copy(alpha = 0.65f),
                            0.45f to Color(0xFF0B0C10).copy(alpha = 0.25f),
                            1.0f to Color(0xFF0B0C10).copy(alpha = 0.0f)
                        ),
                        startY = 0f,
                        endY = scrimHeight
                    ),
                    topLeft = Offset.Zero,
                    size = Size(w, scrimHeight)
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
                            // Immediately update MainScreen chart and status on the Main UI thread
                            slots = scheduleRepo.getTodaySlots(newQueue)
                            tomorrowSlots = scheduleRepo.getTomorrowSlots(newQueue)
                            hasTomorrowSchedule = scheduleRepo.hasTomorrowSchedule(newQueue)
                            statusInfo = scheduleRepo.getCurrentStatusAndCountdown(newQueue)
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
                            slots = scheduleRepo.getTodaySlots("1.1")
                            tomorrowSlots = scheduleRepo.getTomorrowSlots("1.1")
                            hasTomorrowSchedule = scheduleRepo.hasTomorrowSchedule("1.1")
                            statusInfo = scheduleRepo.getCurrentStatusAndCountdown("1.1")

                            ua.blackout.prewarning.worker.ScheduleSyncWorker.schedulePeriodicWork(
                                appContext,
                                androidx.work.ExistingPeriodicWorkPolicy.UPDATE
                            )
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
