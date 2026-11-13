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
import androidx.compose.runtime.saveable.rememberSaveable
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
import ua.blackout.prewarning.core.SiteState
import ua.blackout.prewarning.data.parser.ZtoeAddressLookup
import ua.blackout.prewarning.data.repository.OutageRepository
import ua.blackout.prewarning.data.repository.OutageStateStore
import ua.blackout.prewarning.data.repository.RefreshOutcome
import ua.blackout.prewarning.data.repository.ScheduleRepository
import ua.blackout.prewarning.data.repository.SettingsRepository
import ua.blackout.prewarning.data.repository.SubscriptionSync
import ua.blackout.prewarning.core.StoreResult
import ua.blackout.prewarning.core.Subscriptions
import ua.blackout.prewarning.data.model.UserSettings
import ua.blackout.prewarning.data.repository.OutageSnapshot
import ua.blackout.prewarning.notification.AlarmScheduler
import ua.blackout.prewarning.notification.ExactAlarmGate
import ua.blackout.prewarning.notification.NotificationHelper
import ua.blackout.prewarning.ui.AppStrings
import ua.blackout.prewarning.ui.components.floatingShadow
import ua.blackout.prewarning.ui.theme.TimeOfDayPalette
import ua.blackout.prewarning.widget.BlackoutGlanceWidget
import java.time.Instant
import java.time.LocalDateTime
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

@Composable
fun BlackoutAppNavigation(
    onThemeChanged: (Boolean) -> Unit = {},
    // Subscription id from a tapped notification: shown once on the main screen (spec/SUBSCRIPTIONS.md 9)
    openSubscriptionId: String? = null,
    onOpenSubscriptionHandled: () -> Unit = {}
) {
    val context = LocalContext.current
    val appContext = remember { context.applicationContext }
    val lifecycleOwner = LocalLifecycleOwner.current
    val coroutineScope = rememberCoroutineScope()
    val settingsRepo = remember { SettingsRepository(appContext) }
    val scheduleRepo = remember { ScheduleRepository(appContext) }
    val outageRepo = remember { OutageRepository(appContext) }
    val outageStore = remember { OutageStateStore(appContext) }
    val initialSettings = remember { settingsRepo.getSettings() }
    // Multi-address store (step 2): Settings edits it, the primary is mirrored into the keys above
    val subscriptionSync = remember { SubscriptionSync(appContext) }
    var subscriptions by remember { mutableStateOf(subscriptionSync.ensureReady()) }
    var alertsMaster by remember { mutableStateOf(subscriptionSync.master()) }
    // The address the main screen shows (step 4): session state, a cold start shows the primary (decision 5)
    var shownSubscriptionId by rememberSaveable { mutableStateOf<String?>(null) }

    // Latest persisted settings; kept in sync by the preference listener below
    var currentSettings by remember { mutableStateOf(initialSettings) }
    var siteUrl by remember { mutableStateOf(initialSettings.cityUrl) }
    var queue by remember { mutableStateOf(initialSettings.queue) }
    var customQueueStatusText by remember { mutableStateOf(initialSettings.customQueueStatusText) }
    var selectedAddress by remember { mutableStateOf(initialSettings.selectedAddress) }
    var selectedAddressQuery by remember { mutableStateOf(initialSettings.selectedAddressQuery) }
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

    // An address counts as a selection even when it has no queue and no emergency right now
    val isQueueUnselected = queue.isBlank() && customQueueStatusText.isNullOrBlank() && selectedAddressQuery == null

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

    // Everything the screens show about outages comes from one snapshot of the stored state
    val addressKey = remember(selectedAddressQuery) { outageRepo.addressKey(selectedAddressQuery) }
    // The shown item when it is not the primary; the primary is read through the mirrored settings as in 1.4.0
    fun otherShownItem() = Subscriptions.viewItem(subscriptions, shownSubscriptionId)?.takeIf { it.id != subscriptions.primaryId }
    fun shownSnapshot(
        settings: UserSettings,
        now: LocalDateTime = LocalDateTime.now(KYIV_ZONE),
        primaryKey: String? = outageRepo.addressKey(settings.selectedAddressQuery)
    ): OutageSnapshot = otherShownItem()?.let { outageRepo.snapshotFor(it, now) } ?: outageRepo.snapshot(settings, now, primaryKey)

    var snapshot by remember {
        mutableStateOf(outageRepo.snapshot(initialSettings, LocalDateTime.now(KYIV_ZONE)))
    }
    val recomputeSnapshot: () -> Unit = {
        snapshot = shownSnapshot(currentSettings, LocalDateTime.now(KYIV_ZONE), addressKey)
    }
    var statusInfo by remember { mutableStateOf(snapshot.scheduleStatus()) }
    var isRefreshing by remember { mutableStateOf(false) }

    // "Last updated" is the last successful ztoe fetch; "next" is one refresh interval after the last check
    val hhmm = remember { DateTimeFormatter.ofPattern("HH:mm") }
    val lastUpdated = remember(snapshot.site, snapshot.plannedKnown) {
        val ms = snapshot.site?.lastSuccessMs ?: scheduleRepo.lastSyncMs().takeIf { it > 0L }
        if (ms == null) "--:--" else Instant.ofEpochMilli(ms).atZone(KYIV_ZONE).format(hhmm)
    }
    val nextUpdated = remember(snapshot.site, refreshMinutes) {
        val ms = snapshot.site?.checkedAtMs?.takeIf { it > 0L } ?: System.currentTimeMillis()
        Instant.ofEpochMilli(ms).plusSeconds(refreshMinutes * 60L).atZone(KYIV_ZONE).format(hhmm)
    }

    // The exact-alarm permission can change while the app is in the background, so it is re-read on every resume
    var resumeTick by remember { mutableStateOf(0) }
    DisposableEffect(lifecycleOwner) {
        val observer = androidx.lifecycle.LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) resumeTick++
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }
    // Planned warnings of any address need exact alarms (spec/SUBSCRIPTIONS.md 8.1)
    val anyPlannedActive = subscriptions.items.any { Subscriptions.plannedActive(alertsMaster, it) }
    val exactAlarmMissing = remember(resumeTick, anyPlannedActive) {
        anyPlannedActive && !ExactAlarmGate.canScheduleExact(appContext)
    }

    val isMainScreenVisible = pagerState.currentPage == 0 && !isRouletteOpen
    val isCountdownScreenActive = isMainScreenVisible && !isQueueUnselected
    var hasCompletedInitialScheduleFetch by remember { mutableStateOf(false) }

    /**
     * Re-checks the saved address (a house without a queue may get one), then refreshes both sources
     * through [OutageRepository] and re-plans alarms and widgets. A failing source keeps its old data.
     */
    suspend fun runRefresh(force: Boolean, resolveAddress: Boolean): RefreshOutcome {
        isRefreshing = true
        try {
            val outcome = withContext(Dispatchers.IO) {
                ZtoeAddressLookup.initDiskCache(appContext)
                val addrQuery = settingsRepo.getSettings().selectedAddressQuery
                if (resolveAddress && addrQuery != null && addrQuery.streetId.isNotBlank() && addrQuery.house.isNotBlank()) {
                    val lookup = try {
                        ZtoeAddressLookup.checkAddressOnZtoeWebsite(
                            remId = addrQuery.remId,
                            settlementId = addrQuery.settlementId,
                            streetId = addrQuery.streetId,
                            house = addrQuery.house,
                            siteUrl = settingsRepo.getSettings().cityUrl
                        )
                    } catch (_: Exception) {
                        null
                    }
                    if (lookup != null) {
                        val current = settingsRepo.getSettings()
                        val nextQueue = when {
                            !lookup.queue.isNullOrBlank() -> lookup.queue
                            !lookup.statusText.isNullOrBlank() -> ""
                            else -> current.queue
                        }
                        val nextStatus = when {
                            !lookup.queue.isNullOrBlank() -> null
                            !lookup.statusText.isNullOrBlank() -> lookup.statusText
                            else -> current.customQueueStatusText
                        }
                        val nextLabel = lookup.addressLabel.takeIf { it.isNotBlank() } ?: current.selectedAddress
                        if (nextQueue != current.queue || nextStatus != current.customQueueStatusText || nextLabel != current.selectedAddress) {
                            // into the primary subscription, which is mirrored back into these keys
                            subscriptionSync.assignPrimaryQueue(nextQueue, nextStatus, nextLabel)
                        }
                    }
                }
                val result = outageRepo.refresh(settingsRepo.getSettings(), forceNetwork = force, shownId = otherShownItem()?.id)
                try {
                    AlarmScheduler.syncAlarms(appContext)
                } catch (_: Exception) {
                }
                try {
                    BlackoutGlanceWidget.syncAllWidgets(appContext)
                } catch (_: Exception) {
                }
                result
            }
            snapshot = shownSnapshot(settingsRepo.getSettings())
            return outcome
        } finally {
            isRefreshing = false
        }
    }

    // Entering the main screen: show fresh numbers at once, then refresh quietly in the background
    LaunchedEffect(isMainScreenVisible) {
        if (isMainScreenVisible) {
            currentTime = LocalTime.now(KYIV_ZONE)
            recomputeSnapshot()
            if (hasCompletedInitialScheduleFetch) {
                runRefresh(force = false, resolveAddress = true)
            }
        }
    }

    // Live countdown: once per second while the main screen is visible and the app is resumed (battery friendly)
    LaunchedEffect(lifecycleOwner, isCountdownScreenActive, currentSettings, addressKey, shownSubscriptionId, subscriptions) {
        if (!isCountdownScreenActive) {
            val nowDt = LocalDateTime.now(KYIV_ZONE)
            currentTime = nowDt.toLocalTime()
            snapshot = shownSnapshot(currentSettings, nowDt, addressKey)
            statusInfo = snapshot.scheduleStatus()
            return@LaunchedEffect
        }
        lifecycleOwner.lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            withContext(Dispatchers.IO) {
                try {
                    AlarmScheduler.syncAlarms(appContext)
                } catch (_: Exception) {
                }
            }
            while (true) {
                val nowDt = LocalDateTime.now(KYIV_ZONE)
                currentTime = nowDt.toLocalTime()
                val fresh = shownSnapshot(currentSettings, nowDt, addressKey)
                snapshot = fresh
                val updatedStatus = fresh.scheduleStatus()
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
    val settingsListener = remember(settingsRepo) {
        SharedPreferences.OnSharedPreferenceChangeListener { _, _ ->
            val updated = settingsRepo.getSettings()
            currentSettings = updated
            queue = updated.queue
            customQueueStatusText = updated.customQueueStatusText
            selectedAddress = updated.selectedAddress
            selectedAddressQuery = updated.selectedAddressQuery
            siteUrl = updated.cityUrl
            advanceMinutes = updated.advanceNoticeMinutes
            refreshMinutes = updated.refreshIntervalMinutes.toInt()
            notificationsEnabled = updated.notificationsEnabled
            emergencyNotificationsEnabled = updated.emergencyNotificationsEnabled
            soundEnabled = updated.soundEnabled
            vibrationEnabled = updated.vibrationEnabled
            currentLanguage = updated.language
            subscriptions = subscriptionSync.store()
            alertsMaster = subscriptionSync.master()
            snapshot = shownSnapshot(updated)
        }
    }

    // Schedule cache or outage state changed (worker, widget, refresh): show it
    val stateListener = remember(settingsRepo, outageRepo) {
        SharedPreferences.OnSharedPreferenceChangeListener { _, _ ->
            snapshot = shownSnapshot(settingsRepo.getSettings())
        }
    }

    // Listen to SharedPreferences changes from Widget (ToggleAlertsActionCallback / RefreshWidgetActionCallback)
    DisposableEffect(settingsRepo, scheduleRepo, outageStore, settingsListener, stateListener) {
        val settingsPrefs = settingsRepo.getSharedPreferences()
        val schedulePrefs = scheduleRepo.getSharedPreferences()
        val outagePrefs = outageStore.getSharedPreferences()

        settingsPrefs.registerOnSharedPreferenceChangeListener(settingsListener)
        schedulePrefs.registerOnSharedPreferenceChangeListener(stateListener)
        outagePrefs.registerOnSharedPreferenceChangeListener(stateListener)

        onDispose {
            settingsPrefs.unregisterOnSharedPreferenceChangeListener(settingsListener)
            schedulePrefs.unregisterOnSharedPreferenceChangeListener(stateListener)
            outagePrefs.unregisterOnSharedPreferenceChangeListener(stateListener)
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

    // Hydrate address index from disk cache and prefetch REMs, cities, and streets strictly in the background after initial UI render
    LaunchedEffect(siteUrl) {
        delay(250L)
        withContext(Dispatchers.IO) {
            try {
                ZtoeAddressLookup.initDiskCache(appContext)
                ZtoeAddressLookup.prefetchAddressIndexInBackground(
                    context = appContext,
                    siteUrl = siteUrl,
                    savedQuery = selectedAddressQuery,
                    forceRefresh = false
                )
            } catch (_: Exception) {}
        }
    }

    // Refresh both sources when the queue, site address or selected address changes (and once at launch)
    LaunchedEffect(queue, customQueueStatusText, siteUrl, selectedAddressQuery) {
        if (queue.isBlank() && selectedAddressQuery == null) {
            hasCompletedInitialScheduleFetch = true
            recomputeSnapshot()
            return@LaunchedEffect
        }
        runRefresh(force = false, resolveAddress = true)
        hasCompletedInitialScheduleFetch = true
    }

    // Another address is shown: poll its PowerOn too (its switches gate notifications only)
    LaunchedEffect(shownSubscriptionId) {
        if (hasCompletedInitialScheduleFetch && otherShownItem() != null) {
            runRefresh(force = false, resolveAddress = false)
        }
    }

    // A tapped notification shows its address on the main screen
    LaunchedEffect(openSubscriptionId) {
        val id = openSubscriptionId ?: return@LaunchedEffect
        shownSubscriptionId = id
        isRouletteOpen = false
        pagerState.scrollToPage(0)
        onOpenSubscriptionHandled()
    }

    // Manual refresh: always goes to the network and tells the user what the site answered
    val performManualRefresh: () -> Unit = {
        coroutineScope.launch {
            val outcome = runRefresh(force = true, resolveAddress = true)
            val message = when (outcome.siteState) {
                null, SiteState.AVAILABLE_WITH_TABLE -> AppStrings.refreshSuccessToast(resolvedLang)
                SiteState.AVAILABLE_NO_TABLE -> AppStrings.siteStateNoTable(resolvedLang)
                SiteState.SITE_UNREACHABLE -> AppStrings.siteStateUnreachable(resolvedLang)
                SiteState.NO_INTERNET -> AppStrings.siteStateNoInternet(resolvedLang)
            }
            showAppBanner(message)
        }
    }

    val syncAlarmsAndWidgets: () -> Unit = {
        coroutineScope.launch(Dispatchers.IO) {
            try {
                AlarmScheduler.syncAlarms(appContext)
                BlackoutGlanceWidget.syncAllWidgets(appContext)
            } catch (_: Exception) {}
        }
    }

    /** Shows why a store change was refused; on success alarms and widgets follow the new primary mirror. */
    val onStoreResult: (StoreResult) -> Boolean = { result ->
        when (result) {
            is StoreResult.Ok -> {
                subscriptions = result.store
                syncAlarmsAndWidgets()
                true
            }
            is StoreResult.Error -> {
                when (result.code) {
                    Subscriptions.ERR_DUPLICATE -> showAppBanner(AppStrings.addressDuplicate(resolvedLang))
                    Subscriptions.ERR_LIMIT -> showAppBanner(AppStrings.addressLimitReached(resolvedLang, Subscriptions.MAX_ITEMS))
                    else -> Unit
                }
                false
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
                    val other = otherShownItem()
                    MainScreen(
                        queue = if (other != null) other.queue.orEmpty() else queue,
                        customQueueStatusText = if (other != null) other.queueStatusText else customQueueStatusText,
                        selectedAddress = if (other != null) {
                            other.address?.let { a -> a.text.ifBlank { Subscriptions.displayLabel(other) } }
                        } else {
                            selectedAddress
                        },
                        addresses = Subscriptions.switcherItems(subscriptions),
                        primaryAddressId = subscriptions.primaryId,
                        shownAddressId = Subscriptions.viewItem(subscriptions, shownSubscriptionId)?.id,
                        onSelectAddress = { shownSubscriptionId = it },
                        showNoAlertsCaption = Subscriptions.noAlertsCaption(alertsMaster, subscriptions),
                        onOpenSettings = { coroutineScope.launch { pagerState.animateScrollToPage(1) } },
                        snapshot = snapshot,
                        statusInfo = statusInfo,
                        isRefreshing = isRefreshing,
                        exactAlarmMissing = exactAlarmMissing,
                        onOpenExactAlarmSettings = {
                            ExactAlarmGate.settingsIntent(appContext)?.let {
                                try {
                                    appContext.startActivity(it)
                                } catch (_: Exception) {
                                }
                            }
                        },
                        // the header bell is the master switch for all addresses (owner decision 4)
                        notificationsEnabled = alertsMaster,
                        lastUpdated = lastUpdated,
                        nextUpdated = nextUpdated,
                        currentTime = currentTime,
                        lang = resolvedLang,
                        selectedLanguage = currentLanguage,
                        onToggleNotifications = {
                            subscriptionSync.setMaster(!alertsMaster)
                            alertsMaster = subscriptionSync.master()
                            syncAlarmsAndWidgets()
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
                        subscriptions = subscriptions,
                        alertsMaster = alertsMaster,
                        selectedAddressQuery = selectedAddressQuery,
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
                        onAddAddress = { resolvedQueue, statusText, addressLabel, query ->
                            val wasEmpty = subscriptions.items.isEmpty()
                            val ok = onStoreResult(subscriptionSync.addFromLookup(resolvedQueue, statusText, addressLabel, query))
                            if (ok) {
                                showAppBanner(AppStrings.addressAdded(resolvedLang))
                                // the first address becomes the primary: show it on the main screen
                                if (wasEmpty) coroutineScope.launch { pagerState.animateScrollToPage(0) }
                            }
                        },
                        onAddQueueOnly = { newQueue ->
                            val wasEmpty = subscriptions.items.isEmpty()
                            val ok = onStoreResult(subscriptionSync.addQueueOnly(newQueue))
                            if (ok && wasEmpty) coroutineScope.launch { pagerState.animateScrollToPage(0) }
                        },
                        onRemoveSubscription = { id -> onStoreResult(subscriptionSync.change { Subscriptions.remove(it, id) }) },
                        onMakePrimary = { id -> onStoreResult(subscriptionSync.change { Subscriptions.setPrimary(it, id) }) },
                        onSetPlanned = { id, on -> onStoreResult(subscriptionSync.change { Subscriptions.setPlanned(it, id, on) }) },
                        onSetEmergency = { id, on -> onStoreResult(subscriptionSync.change { Subscriptions.setEmergency(it, id, on) }) },
                        onRenameSubscription = { id, label -> onStoreResult(subscriptionSync.change { Subscriptions.rename(it, id, label) }) },
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
                            if (intervalChanged) {
                                ua.blackout.prewarning.worker.ScheduleSyncWorker.schedulePeriodicWork(
                                    appContext,
                                    androidx.work.ExistingPeriodicWorkPolicy.UPDATE
                                )
                            }
                        },
                        onToggleMaster = { on ->
                            subscriptionSync.setMaster(on)
                            alertsMaster = subscriptionSync.master()
                            syncAlarmsAndWidgets()
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
                        isRefreshing = isRefreshing,
                        onResetDefaults = {
                            // CRITICAL CONSTANTS — Default values: advanceMinutes = 15, refreshMinutes = 30
                            settingsRepo.resetAllAppDataToFirstLaunch()
                            coroutineScope.launch {
                                pagerState.animateScrollToPage(0)
                            }
                            coroutineScope.launch(Dispatchers.IO) {
                                try {
                                    scheduleRepo.clearScheduleCache()
                                    outageStore.clearAll()
                                    AlarmScheduler.syncAlarms(appContext)
                                    BlackoutGlanceWidget.syncAllWidgets(appContext)
                                } catch (_: Exception) {}
                            }
                        },
                        onShowAppBanner = showAppBanner,
                        exactAlarmMissing = exactAlarmMissing,
                        onOpenExactAlarmSettings = {
                            ExactAlarmGate.settingsIntent(appContext)?.let {
                                try {
                                    appContext.startActivity(it)
                                } catch (_: Exception) {
                                }
                            }
                        },
                        isVisible = pagerState.currentPage == 1
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
                        .floatingShadow(color = Color(0xB3000000), borderRadius = 32.dp, blurRadius = 24.dp, offsetY = 8.dp)
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
