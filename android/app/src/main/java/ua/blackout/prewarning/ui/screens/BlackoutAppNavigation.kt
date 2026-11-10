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
import androidx.compose.ui.draw.alpha
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
import ua.blackout.prewarning.data.model.BlackoutSlot
import ua.blackout.prewarning.data.model.EmergencyOutageInfo
import ua.blackout.prewarning.data.model.SelectedAddressQuery
import ua.blackout.prewarning.data.model.SlotStatus
import ua.blackout.prewarning.data.parser.FetchStatus
import ua.blackout.prewarning.data.parser.ZtoeAddressLookup
import ua.blackout.prewarning.data.parser.ZtoeParser
import ua.blackout.prewarning.data.repository.ScheduleRepository
import ua.blackout.prewarning.data.repository.SettingsRepository
import ua.blackout.prewarning.notification.AlarmScheduler
import ua.blackout.prewarning.notification.NotificationHelper
import ua.blackout.prewarning.ui.AppStrings
import ua.blackout.prewarning.ui.theme.TimeOfDayPalette
import ua.blackout.prewarning.widget.BlackoutGlanceWidget
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import ua.blackout.prewarning.data.KYIV_ZONE

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

private fun buildLightNoOutageSlots(): List<BlackoutSlot> {
    return (0 until 48).map { idx ->
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
    var customQueueStatusText by remember { mutableStateOf(initialSettings.customQueueStatusText) }
    var selectedAddress by remember { mutableStateOf(initialSettings.selectedAddress) }
    var selectedAddressQuery by remember { mutableStateOf(initialSettings.selectedAddressQuery) }
    var activeEmergencyOutage by remember { mutableStateOf(initialSettings.activeEmergencyOutage) }
    var advanceMinutes by remember { mutableStateOf(initialSettings.advanceNoticeMinutes) }
    var refreshMinutes by remember { mutableStateOf(initialSettings.refreshIntervalMinutes.toInt()) }
    var notificationsEnabled by remember { mutableStateOf(initialSettings.notificationsEnabled) }
    var emergencyNotificationsEnabled by remember { mutableStateOf(initialSettings.emergencyNotificationsEnabled) }
    var soundEnabled by remember { mutableStateOf(initialSettings.soundEnabled) }
    var vibrationEnabled by remember { mutableStateOf(initialSettings.vibrationEnabled) }
    var currentLanguage by remember { mutableStateOf(initialSettings.language) }
    var isRouletteOpen by remember { mutableStateOf(false) }
    var autoOpenQueueHelp by remember { mutableStateOf(false) }
    var currentTime by remember { mutableStateOf(LocalTime.now(KYIV_ZONE)) }

    val isQueueUnselected = queue.isBlank() && customQueueStatusText.isNullOrBlank()

    // Pager for swipe left/right between windows with beyondViewportPageCount = 2 to eliminate swipe jittering
    val pagerState = rememberPagerState(initialPage = 0, pageCount = { 3 })

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
    val nowTime = remember { LocalTime.now(KYIV_ZONE) }
    var lastUpdated by remember {
        mutableStateOf(nowTime.format(DateTimeFormatter.ofPattern("HH:mm")))
    }
    var nextUpdated by remember {
        mutableStateOf(nowTime.plusMinutes(refreshMinutes.toLong()).format(DateTimeFormatter.ofPattern("HH:mm")))
    }

    // Base slots for Today and Tomorrow from ScheduleRepository
    var baseSlots by remember {
        mutableStateOf(scheduleRepo.getTodaySlots(queue))
    }
    var baseTomorrowSlots by remember {
        mutableStateOf(scheduleRepo.getTomorrowSlots(queue))
    }
    var hasTomorrowSchedule by remember {
        mutableStateOf(scheduleRepo.hasTomorrowSchedule(queue))
    }

    val todayDateIso = remember(lastUpdated) {
        LocalDate.now(KYIV_ZONE).format(DateTimeFormatter.ISO_LOCAL_DATE)
    }
    val tomorrowDateIso = remember(lastUpdated) {
        LocalDate.now(KYIV_ZONE).plusDays(1).format(DateTimeFormatter.ISO_LOCAL_DATE)
    }

    // Effective slots with active emergency outage overlaid across Today and Tomorrow
    val effectiveSlots = remember(baseSlots, customQueueStatusText, activeEmergencyOutage, todayDateIso) {
        val raw = if (!customQueueStatusText.isNullOrBlank() && baseSlots.isEmpty()) {
            buildLightNoOutageSlots()
        } else {
            baseSlots
        }
        ScheduleRepository.applyEmergencyOutageToSlots(raw, todayDateIso, activeEmergencyOutage)
    }
    val effectiveTomorrowSlots = remember(baseTomorrowSlots, activeEmergencyOutage, tomorrowDateIso) {
        baseTomorrowSlots?.let {
            ScheduleRepository.applyEmergencyOutageToSlots(it, tomorrowDateIso, activeEmergencyOutage)
        }
    }

    // Dynamic real-time countdown info updated every second ONLY while Lifecycle is RESUMED and MainScreen is visible
    var statusInfo by remember {
        mutableStateOf(
            ScheduleRepository.calculateStatusAndCountdown(
                slots = effectiveSlots,
                tomorrowSlots = if (hasTomorrowSchedule) effectiveTomorrowSlots else null,
                now = LocalTime.now(KYIV_ZONE)
            )
        )
    }

    val isMainScreenVisible = pagerState.currentPage == 0 && !isRouletteOpen
    val isCountdownScreenActive = isMainScreenVisible && !isQueueUnselected

    // Automatically refresh timer and drum bar when User enters main screen
    LaunchedEffect(isMainScreenVisible) {
        if (isMainScreenVisible) {
            val now = LocalTime.now(KYIV_ZONE)
            currentTime = now
            if (queue.isNotBlank()) {
                baseSlots = scheduleRepo.getTodaySlots(queue)
                baseTomorrowSlots = scheduleRepo.getTomorrowSlots(queue)
                hasTomorrowSchedule = scheduleRepo.hasTomorrowSchedule(queue)
            }
            statusInfo = ScheduleRepository.calculateStatusAndCountdown(
                slots = effectiveSlots,
                tomorrowSlots = if (hasTomorrowSchedule) effectiveTomorrowSlots else null,
                now = now
            )
            if (queue.isNotBlank()) {
                val res = withContext(Dispatchers.IO) {
                    ZtoeParser.fetchFullSchedule(siteUrl, queue, appContext)
                }
                if (res.status == FetchStatus.SUCCESS) {
                    baseSlots = res.todaySlots
                    baseTomorrowSlots = res.tomorrowSlots
                    hasTomorrowSchedule = res.hasTomorrowSchedule && res.tomorrowSlots != null
                    withContext(Dispatchers.IO) {
                        scheduleRepo.saveSchedule(queue, res.todaySlots, res.tomorrowSlots)
                    }
                    val refreshedNow = LocalTime.now(KYIV_ZONE)
                    currentTime = refreshedNow
                    lastUpdated = refreshedNow.format(DateTimeFormatter.ofPattern("HH:mm"))
                    nextUpdated = refreshedNow.plusMinutes(refreshMinutes.toLong()).format(DateTimeFormatter.ofPattern("HH:mm"))
                }
            }
        }
    }

    LaunchedEffect(
        lifecycleOwner,
        effectiveSlots,
        effectiveTomorrowSlots,
        hasTomorrowSchedule,
        queue,
        customQueueStatusText,
        isCountdownScreenActive
    ) {
        if (!isCountdownScreenActive) {
            val now = LocalTime.now(KYIV_ZONE)
            currentTime = now
            statusInfo = ScheduleRepository.calculateStatusAndCountdown(
                slots = effectiveSlots,
                tomorrowSlots = if (hasTomorrowSchedule) effectiveTomorrowSlots else null,
                now = now
            )
            return@LaunchedEffect
        }
        lifecycleOwner.lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            withContext(Dispatchers.IO) {
                try {
                    AlarmScheduler.syncAlarms(appContext)
                } catch (_: Exception) {}
            }
            while (true) {
                val now = LocalTime.now(KYIV_ZONE)
                currentTime = now
                val updatedStatus = ScheduleRepository.calculateStatusAndCountdown(
                    slots = effectiveSlots,
                    tomorrowSlots = if (hasTomorrowSchedule) effectiveTomorrowSlots else null,
                    now = now
                )
                statusInfo = updatedStatus
                if (!updatedStatus.isBlackoutNow && updatedStatus.countdownText == "--:--:--" && updatedStatus.nextSlotTime == "Відключень немає") {
                    delay(15_000L)
                } else {
                    delay(1000L)
                }
            }
        }
    }

    // Keep strong references to SharedPreferences listeners (Android stores them in a WeakHashMap)
    val settingsListener = remember(settingsRepo, scheduleRepo) {
        SharedPreferences.OnSharedPreferenceChangeListener { _, _ ->
            val updated = settingsRepo.getSettings()
            val queueChanged = queue != updated.queue
            queue = updated.queue
            customQueueStatusText = updated.customQueueStatusText
            selectedAddress = updated.selectedAddress
            selectedAddressQuery = updated.selectedAddressQuery
            activeEmergencyOutage = updated.activeEmergencyOutage
            siteUrl = updated.cityUrl
            advanceMinutes = updated.advanceNoticeMinutes
            refreshMinutes = updated.refreshIntervalMinutes.toInt()
            notificationsEnabled = updated.notificationsEnabled
            emergencyNotificationsEnabled = updated.emergencyNotificationsEnabled
            soundEnabled = updated.soundEnabled
            vibrationEnabled = updated.vibrationEnabled
            currentLanguage = updated.language
            if (queueChanged) {
                baseSlots = scheduleRepo.getTodaySlots(updated.queue)
                baseTomorrowSlots = scheduleRepo.getTomorrowSlots(updated.queue)
                hasTomorrowSchedule = scheduleRepo.hasTomorrowSchedule(updated.queue)
            }
        }
    }

    val scheduleListener = remember(settingsRepo, scheduleRepo) {
        SharedPreferences.OnSharedPreferenceChangeListener { _, _ ->
            val currentQ = settingsRepo.getSettings().queue
            baseSlots = scheduleRepo.getTodaySlots(currentQ)
            baseTomorrowSlots = scheduleRepo.getTomorrowSlots(currentQ)
            hasTomorrowSchedule = scheduleRepo.hasTomorrowSchedule(currentQ)
        }
    }

    // Listen to SharedPreferences changes from Widget (ToggleAlertsActionCallback / RefreshWidgetActionCallback)
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

    // Refresh donations links from .json on GitHub using daily 24h cache
    LaunchedEffect(Unit) {
        withContext(Dispatchers.IO) {
            try {
                val links = ua.blackout.prewarning.data.repository.DonationsRepository.getDonationsWithDailyRefresh(
                    appContext,
                    forceRefresh = false
                )
                for (item in links) {
                    ua.blackout.prewarning.data.repository.DonationsRepository.fetchFaviconBitmap(appContext, item.url)
                }
            } catch (_: Exception) {}
        }
    }

    // Hydrate address index from disk cache immediately and prefetch all REMs, cities, and active city streets in the background on app launch
    remember(appContext) {
        ZtoeAddressLookup.initDiskCache(appContext)
        true
    }
    LaunchedEffect(siteUrl) {
        withContext(Dispatchers.IO) {
            try {
                ZtoeAddressLookup.prefetchAddressIndexInBackground(
                    context = appContext,
                    siteUrl = siteUrl,
                    savedQuery = selectedAddressQuery,
                    forceRefresh = false
                )
            } catch (_: Exception) {}
        }
    }

    // Fetch schedule when queue or siteUrl changes; update all Compose states on the Main UI thread
    LaunchedEffect(queue, customQueueStatusText, siteUrl) {
        val activeQ = queue
        if (activeQ.isBlank()) {
            baseSlots = emptyList()
            baseTomorrowSlots = null
            hasTomorrowSchedule = false
            return@LaunchedEffect
        }

        baseSlots = scheduleRepo.getTodaySlots(activeQ)
        baseTomorrowSlots = scheduleRepo.getTomorrowSlots(activeQ)
        hasTomorrowSchedule = scheduleRepo.hasTomorrowSchedule(activeQ)

        val res = withContext(Dispatchers.IO) {
            ZtoeParser.fetchFullSchedule(siteUrl, activeQ, appContext)
        }
        if (res.status == FetchStatus.SUCCESS) {
            baseSlots = res.todaySlots
            baseTomorrowSlots = res.tomorrowSlots
            hasTomorrowSchedule = res.hasTomorrowSchedule && res.tomorrowSlots != null
            withContext(Dispatchers.IO) {
                scheduleRepo.saveSchedule(activeQ, res.todaySlots, res.tomorrowSlots)
            }
        } else {
            baseSlots = emptyList()
            baseTomorrowSlots = null
            hasTomorrowSchedule = false
            withContext(Dispatchers.IO) {
                scheduleRepo.clearScheduleCache()
            }
        }
        val now = LocalTime.now(KYIV_ZONE)
        lastUpdated = now.format(DateTimeFormatter.ofPattern("HH:mm"))
        nextUpdated = now.plusMinutes(refreshMinutes.toLong()).format(DateTimeFormatter.ofPattern("HH:mm"))

        withContext(Dispatchers.IO) {
            try {
                AlarmScheduler.syncAlarms(appContext)
            } catch (_: Exception) {}
            try {
                BlackoutGlanceWidget.syncAllWidgets(appContext)
            } catch (_: Exception) {}
        }
    }

    // Helper for manual refresh with strict verification, address/emergency re-check & error reporting
    val performManualRefresh: () -> Unit = {
        coroutineScope.launch {
            // Re-check selected address on ZTOE for emergency outages and dynamic queue updates
            val addrQuery = selectedAddressQuery
            if (addrQuery != null && addrQuery.streetId.isNotBlank() && addrQuery.house.isNotBlank()) {
                val addrRes = withContext(Dispatchers.IO) {
                    ZtoeAddressLookup.checkAddressOnZtoeWebsite(
                        remId = addrQuery.remId,
                        settlementId = addrQuery.settlementId,
                        streetId = addrQuery.streetId,
                        house = addrQuery.house
                    )
                }
                if (addrRes != null) {
                    val prevEmergency = activeEmergencyOutage
                    activeEmergencyOutage = addrRes.emergencyOutage
                    selectedAddress = addrRes.addressLabel
                    if (!addrRes.queue.isNullOrBlank()) {
                        queue = addrRes.queue
                        customQueueStatusText = null
                    } else if (!addrRes.statusText.isNullOrBlank()) {
                        queue = ""
                        customQueueStatusText = addrRes.statusText
                    }
                    val current = settingsRepo.getSettings()
                    val updatedSettings = current.copy(
                        queue = queue,
                        customQueueStatusText = customQueueStatusText,
                        selectedAddress = selectedAddress,
                        selectedAddressQuery = addrQuery,
                        activeEmergencyOutage = activeEmergencyOutage
                    )
                    settingsRepo.saveSettings(updatedSettings)
                    NotificationHelper.checkAndTriggerEmergencyOutageAlert(
                        context = appContext,
                        settings = updatedSettings,
                        previousEmergency = prevEmergency,
                        currentEmergency = activeEmergencyOutage
                    )
                }
            }

            if (queue.isBlank() && !customQueueStatusText.isNullOrBlank()) {
                val now = LocalTime.now(KYIV_ZONE)
                lastUpdated = now.format(DateTimeFormatter.ofPattern("HH:mm"))
                nextUpdated = now.plusMinutes(refreshMinutes.toLong()).format(DateTimeFormatter.ofPattern("HH:mm"))
                withContext(Dispatchers.IO) {
                    try {
                        AlarmScheduler.syncAlarms(appContext)
                        BlackoutGlanceWidget.syncAllWidgets(appContext)
                    } catch (_: Exception) {}
                }
                showAppBanner(AppStrings.refreshSuccessToast(resolvedLang))
                return@launch
            }

            val res = withContext(Dispatchers.IO) {
                ZtoeParser.fetchFullSchedule(siteUrl, queue, appContext, forceNetwork = true)
            }
            when (res.status) {
                FetchStatus.SUCCESS -> {
                    val now = LocalTime.now(KYIV_ZONE)
                    lastUpdated = now.format(DateTimeFormatter.ofPattern("HH:mm"))
                    nextUpdated = now.plusMinutes(refreshMinutes.toLong()).format(DateTimeFormatter.ofPattern("HH:mm"))
                    baseSlots = res.todaySlots
                    baseTomorrowSlots = res.tomorrowSlots
                    hasTomorrowSchedule = res.hasTomorrowSchedule && res.tomorrowSlots != null
                    withContext(Dispatchers.IO) {
                        scheduleRepo.saveSchedule(queue, res.todaySlots, res.tomorrowSlots)
                        try {
                            AlarmScheduler.syncAlarms(appContext)
                        } catch (_: Exception) {}
                        try {
                            BlackoutGlanceWidget.syncAllWidgets(appContext)
                        } catch (_: Exception) {}
                    }
                    showAppBanner(AppStrings.refreshSuccessToast(resolvedLang))
                }
                FetchStatus.NO_INTERNET, FetchStatus.NO_QUEUES_FOUND -> {
                    val now = LocalTime.now(KYIV_ZONE)
                    lastUpdated = now.format(DateTimeFormatter.ofPattern("HH:mm"))
                    nextUpdated = now.plusMinutes(refreshMinutes.toLong()).format(DateTimeFormatter.ofPattern("HH:mm"))
                    baseSlots = emptyList()
                    baseTomorrowSlots = null
                    hasTomorrowSchedule = false
                    withContext(Dispatchers.IO) {
                        scheduleRepo.clearScheduleCache()
                        try {
                            AlarmScheduler.syncAlarms(appContext)
                        } catch (_: Exception) {}
                        try {
                            BlackoutGlanceWidget.syncAllWidgets(appContext)
                        } catch (_: Exception) {}
                    }
                    if (res.status == FetchStatus.NO_INTERNET) {
                        showAppBanner(AppStrings.errorNoInternet(resolvedLang))
                    } else {
                        showAppBanner(AppStrings.errorNoQueuesFound(resolvedLang))
                    }
                }
            }
        }
    }

    // Gradual Time-of-Day Background Palette (60% Primary, 30% Secondary, 10% Accent, Supporting/Core)
    // Keyed by minute-of-day so full-screen radial gradients are only recalculated once per minute instead of every second
    val currentMinuteOfDay = remember(statusInfo.countdownText) {
        val now = LocalTime.now(KYIV_ZONE)
        now.hour * 60 + now.minute
    }
    val bgColors = remember(currentMinuteOfDay) {
        TimeOfDayPalette.getInterpolatedColors(LocalTime.now(KYIV_ZONE))
    }

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

                // 7. First-launch / unselected queue dark dimming base matching Workbench (#0b0f19 / brightness-50)
                if (isQueueUnselected) {
                    drawRect(color = Color(0xD9070A12))
                }
            }
    ) {
        // Main swipeable screens with pre-composed pages (beyondViewportPageCount = 2) for smooth 60fps swiping
        HorizontalPager(
            state = pagerState,
            beyondViewportPageCount = 2,
            userScrollEnabled = !isRouletteOpen && !isQueueUnselected,
            modifier = Modifier.fillMaxSize()
        ) { page ->
            when (page) {
                0 -> {
                    MainScreen(
                        queue = queue,
                        customQueueStatusText = customQueueStatusText,
                        selectedAddress = selectedAddress,
                        emergencyOutageStartTime = activeEmergencyOutage?.startTime,
                        emergencyOutageRestoreTime = activeEmergencyOutage?.estimatedRestoreTime,
                        isBlackoutNow = statusInfo.isBlackoutNow,
                        countdownText = statusInfo.countdownText,
                        slotTimeText = statusInfo.nextSlotTime,
                        slots = effectiveSlots,
                        tomorrowSlots = effectiveTomorrowSlots,
                        hasTomorrowSchedule = hasTomorrowSchedule,
                        notificationsEnabled = notificationsEnabled,
                        lastUpdated = lastUpdated,
                        nextUpdated = nextUpdated,
                        currentTime = currentTime,
                        lang = resolvedLang,
                        selectedLanguage = currentLanguage,
                        onToggleNotifications = {
                            val updated = settingsRepo.updateNotificationsEnabled(!notificationsEnabled)
                            notificationsEnabled = updated.notificationsEnabled
                            soundEnabled = updated.soundEnabled
                            vibrationEnabled = updated.vibrationEnabled
                            coroutineScope.launch(Dispatchers.IO) {
                                try {
                                    AlarmScheduler.syncAlarms(appContext)
                                    BlackoutGlanceWidget.syncAllWidgets(appContext)
                                } catch (_: Exception) {}
                            }
                        },
                        onRefresh = {
                            performManualRefresh()
                        },
                        onOpenQueueSelection = {
                            autoOpenQueueHelp = true
                            coroutineScope.launch {
                                pagerState.animateScrollToPage(1)
                            }
                        },
                        onChangeLanguage = { newLang ->
                            currentLanguage = newLang
                            val current = settingsRepo.getSettings()
                            settingsRepo.saveSettings(current.copy(language = newLang))
                            coroutineScope.launch(Dispatchers.IO) {
                                try {
                                    BlackoutGlanceWidget.syncAllWidgets(appContext)
                                } catch (_: Exception) {}
                            }
                        }
                    )
                }
                1 -> {
                    SettingsScreen(
                        currentQueue = queue,
                        customQueueStatusText = customQueueStatusText,
                        selectedAddressQuery = selectedAddressQuery,
                        activeEmergencyOutage = activeEmergencyOutage,
                        siteUrl = siteUrl,
                        advanceMinutes = advanceMinutes,
                        refreshMinutes = refreshMinutes,
                        notificationsEnabled = notificationsEnabled,
                        emergencyNotificationsEnabled = emergencyNotificationsEnabled,
                        soundEnabled = soundEnabled,
                        vibrationEnabled = vibrationEnabled,
                        currentLanguage = currentLanguage,
                        lang = resolvedLang,
                        autoOpenQueueHelp = autoOpenQueueHelp,
                        onAutoOpenQueueHelpHandled = { autoOpenQueueHelp = false },
                        onQueueSelected = { newQueue ->
                            val wasUnselected = queue.isBlank() && customQueueStatusText.isNullOrBlank()
                            queue = newQueue
                            customQueueStatusText = null
                            selectedAddress = null
                            selectedAddressQuery = null
                            activeEmergencyOutage = null
                            val current = settingsRepo.getSettings()
                            settingsRepo.saveSettings(
                                current.copy(
                                    queue = newQueue,
                                    customQueueStatusText = null,
                                    selectedAddress = null,
                                    selectedAddressQuery = null,
                                    activeEmergencyOutage = null
                                )
                            )
                            // Immediately update MainScreen chart and status on the Main UI thread
                            baseSlots = scheduleRepo.getTodaySlots(newQueue)
                            baseTomorrowSlots = scheduleRepo.getTomorrowSlots(newQueue)
                            hasTomorrowSchedule = scheduleRepo.hasTomorrowSchedule(newQueue)
                            if (wasUnselected) {
                                coroutineScope.launch {
                                    pagerState.animateScrollToPage(0)
                                }
                            }
                            coroutineScope.launch(Dispatchers.IO) {
                                try {
                                    AlarmScheduler.syncAlarms(appContext)
                                    BlackoutGlanceWidget.syncAllWidgets(appContext)
                                } catch (_: Exception) {}
                            }
                        },
                        onAddressQueueResolved = { resolvedQueue, statusText, addressLabel, emergencyOutage, query ->
                            val prevEmergency = activeEmergencyOutage
                            queue = resolvedQueue
                            customQueueStatusText = statusText
                            selectedAddress = addressLabel
                            selectedAddressQuery = query
                            activeEmergencyOutage = emergencyOutage
                            val current = settingsRepo.getSettings()
                            val updatedSettings = current.copy(
                                queue = resolvedQueue,
                                customQueueStatusText = statusText,
                                selectedAddress = addressLabel,
                                selectedAddressQuery = query,
                                activeEmergencyOutage = emergencyOutage
                            )
                            settingsRepo.saveSettings(updatedSettings)
                            NotificationHelper.checkAndTriggerEmergencyOutageAlert(
                                context = appContext,
                                settings = updatedSettings,
                                previousEmergency = prevEmergency,
                                currentEmergency = emergencyOutage
                            )
                            if (resolvedQueue.isNotBlank()) {
                                baseSlots = scheduleRepo.getTodaySlots(resolvedQueue)
                                baseTomorrowSlots = scheduleRepo.getTomorrowSlots(resolvedQueue)
                                hasTomorrowSchedule = scheduleRepo.hasTomorrowSchedule(resolvedQueue)
                            } else {
                                baseSlots = emptyList()
                                baseTomorrowSlots = null
                                hasTomorrowSchedule = false
                            }
                            coroutineScope.launch {
                                pagerState.animateScrollToPage(0)
                            }
                            coroutineScope.launch(Dispatchers.IO) {
                                try {
                                    AlarmScheduler.syncAlarms(appContext)
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
                            coroutineScope.launch(Dispatchers.IO) {
                                try {
                                    AlarmScheduler.syncAlarms(appContext)
                                } catch (_: Exception) {}
                            }
                        },
                        onRefreshMinutesChanged = {
                            val intervalChanged = refreshMinutes != it
                            refreshMinutes = it
                            val current = settingsRepo.getSettings()
                            settingsRepo.saveSettings(current.copy(refreshIntervalMinutes = it.toLong()))
                            val now = LocalTime.now(KYIV_ZONE)
                            nextUpdated = now.plusMinutes(it.toLong()).format(DateTimeFormatter.ofPattern("HH:mm"))
                            if (intervalChanged) {
                                ua.blackout.prewarning.worker.ScheduleSyncWorker.schedulePeriodicWork(
                                    appContext,
                                    androidx.work.ExistingPeriodicWorkPolicy.UPDATE
                                )
                            }
                        },
                        onToggleNotifications = { newEnabled ->
                            val updated = settingsRepo.updateNotificationsEnabled(newEnabled)
                            notificationsEnabled = updated.notificationsEnabled
                            soundEnabled = updated.soundEnabled
                            vibrationEnabled = updated.vibrationEnabled
                            coroutineScope.launch(Dispatchers.IO) {
                                try {
                                    AlarmScheduler.syncAlarms(appContext)
                                    BlackoutGlanceWidget.syncAllWidgets(appContext)
                                } catch (_: Exception) {}
                            }
                        },
                        onToggleEmergencyNotifications = { newEmergencyEnabled ->
                            val updated = settingsRepo.updateEmergencyNotificationsEnabled(newEmergencyEnabled)
                            emergencyNotificationsEnabled = updated.emergencyNotificationsEnabled
                            soundEnabled = updated.soundEnabled
                            vibrationEnabled = updated.vibrationEnabled
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
                            coroutineScope.launch(Dispatchers.IO) {
                                try {
                                    BlackoutGlanceWidget.syncAllWidgets(appContext)
                                } catch (_: Exception) {}
                            }
                        },
                        onSendTestAlert = {
                            val displayQ = queue.ifBlank { "1.1" }
                            NotificationHelper.showPreWarningNotification(
                                context = appContext,
                                notificationId = 9999,
                                title = if (resolvedLang == "uk") "Тестове попередження" else "Test notification",
                                body = if (resolvedLang == "uk")
                                    "Черга $displayQ: відключення розпочнеться о 14:00 (через $advanceMinutes хв)."
                                else
                                    "Queue $displayQ: blackout begins at 14:00 (in $advanceMinutes min).",
                                isTest = true
                            )
                        },
                        onForceRefresh = {
                            performManualRefresh()
                        },
                        onResetDefaults = {
                            // CRITICAL CONSTANTS — Default values: advanceMinutes = 15, refreshMinutes = 30
                            val resetState = settingsRepo.resetAllAppDataToFirstLaunch()
                            queue = resetState.queue
                            customQueueStatusText = resetState.customQueueStatusText
                            selectedAddress = resetState.selectedAddress
                            selectedAddressQuery = resetState.selectedAddressQuery
                            activeEmergencyOutage = resetState.activeEmergencyOutage
                            siteUrl = resetState.cityUrl
                            advanceMinutes = resetState.advanceNoticeMinutes
                            refreshMinutes = resetState.refreshIntervalMinutes.toInt()
                            notificationsEnabled = resetState.notificationsEnabled
                            emergencyNotificationsEnabled = resetState.emergencyNotificationsEnabled
                            soundEnabled = resetState.soundEnabled
                            vibrationEnabled = resetState.vibrationEnabled
                            currentLanguage = resetState.language

                            baseSlots = emptyList()
                            baseTomorrowSlots = null
                            hasTomorrowSchedule = false

                            coroutineScope.launch {
                                pagerState.animateScrollToPage(0)
                            }
                            coroutineScope.launch(Dispatchers.IO) {
                                try {
                                    scheduleRepo.clearScheduleCache()
                                    AlarmScheduler.syncAlarms(appContext)
                                    BlackoutGlanceWidget.syncAllWidgets(appContext)
                                } catch (_: Exception) {}
                            }
                        },
                        onShowAppBanner = showAppBanner
                    )
                }
                2 -> {
                    AboutScreen(
                        lang = resolvedLang,
                        onOpenRoulette = { isRouletteOpen = true }
                    )
                }
            }
        }

        if (isRouletteOpen) {
            ZhytomyrRouletteDialog(
                lang = resolvedLang,
                providerUrl = siteUrl,
                queue = queue.ifBlank { "1.1" },
                onShowAppBanner = showAppBanner,
                onDismiss = { isRouletteOpen = false }
            )
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

        // Floating Capsule Bottom Navigation Dock matching emulator (hidden when Житомирська Рулетка is open; dimmed & disabled when queue unselected)
        if (!isRouletteOpen) {
            Box(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .navigationBarsPadding()
                    .padding(bottom = 16.dp)
                    .alpha(if (isQueueUnselected) 0.15f else 1f)
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
                                .clickable(enabled = !isQueueUnselected) {
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
                                .clickable(enabled = !isQueueUnselected) {
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
                                .clickable(enabled = !isQueueUnselected) {
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
}
