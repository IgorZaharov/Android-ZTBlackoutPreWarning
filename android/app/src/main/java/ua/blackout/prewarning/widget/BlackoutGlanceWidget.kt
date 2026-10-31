package ua.blackout.prewarning.widget

import android.content.Context
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.glance.ColorFilter
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalSize
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.appwidget.state.updateAppWidgetState
import androidx.glance.appwidget.updateAll
import androidx.glance.background
import androidx.glance.currentState
import androidx.glance.layout.*
import androidx.glance.state.GlanceStateDefinition
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import ua.blackout.prewarning.MainActivity
import ua.blackout.prewarning.R
import ua.blackout.prewarning.data.model.SlotStatus
import ua.blackout.prewarning.data.parser.ZtoeParser
import ua.blackout.prewarning.data.repository.ScheduleRepository
import ua.blackout.prewarning.data.repository.SettingsRepository
import java.time.LocalTime
import java.time.ZoneId

class BlackoutGlanceWidget : GlanceAppWidget() {

    override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

    override val sizeMode = SizeMode.Responsive(
        setOf(
            DpSize(120.dp, 60.dp),   // 2x1 Small
            DpSize(250.dp, 160.dp)   // 3x2 Big
        )
    )

    companion object {
        val KEY_NOTIFICATIONS_ENABLED = booleanPreferencesKey("glance_notifications_enabled")
        val KEY_QUEUE = stringPreferencesKey("glance_queue")
        val KEY_REFRESH_TICK = longPreferencesKey("glance_refresh_tick")

        suspend fun syncAllWidgets(context: Context) {
            val appCtx = context.applicationContext
            val settings = SettingsRepository(appCtx).getSettings()
            val manager = GlanceAppWidgetManager(appCtx)
            val glanceIds = manager.getGlanceIds(BlackoutGlanceWidget::class.java)
            val nowMs = System.currentTimeMillis()
            for (gId in glanceIds) {
                updateAppWidgetState(appCtx, PreferencesGlanceStateDefinition, gId) { prefs ->
                    prefs.toMutablePreferences().apply {
                        this[KEY_NOTIFICATIONS_ENABLED] = settings.notificationsEnabled
                        this[KEY_QUEUE] = settings.queue
                        this[KEY_REFRESH_TICK] = nowMs
                    }
                }
                BlackoutGlanceWidget().update(appCtx, gId)
            }
        }
    }

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val appContext = context.applicationContext
        val settingsRepo = SettingsRepository(appContext)
        val scheduleRepo = ScheduleRepository(appContext)
        val initialSettings = settingsRepo.getSettings()

        // Immediately fetch live schedule on first widget placement if cache is missing for selected queue
        if (!scheduleRepo.hasValidTodayCache(initialSettings.queue)) {
            withContext(Dispatchers.IO) {
                try {
                    val res = ZtoeParser.fetchFullSchedule(initialSettings.cityUrl, initialSettings.queue, appContext)
                    scheduleRepo.saveSchedule(initialSettings.queue, res.todaySlots, res.tomorrowSlots)
                } catch (_: Exception) {}
            }
        }

        provideContent {
            val prefs = currentState<Preferences>()
            // Observe Glance state preferences so recomposition always triggers when toggled or refreshed
            val currentSettings = settingsRepo.getSettings()
            val notificationsEnabled = prefs[KEY_NOTIFICATIONS_ENABLED] ?: currentSettings.notificationsEnabled
            val activeQueue = prefs[KEY_QUEUE] ?: currentSettings.queue
            val _tick = prefs[KEY_REFRESH_TICK] ?: 0L

            // Always use Today's schedule for the widget
            val slots = scheduleRepo.getTodaySlots(activeQueue)
            val info = scheduleRepo.getCurrentStatusAndCountdown(activeQueue)
            val intervals = scheduleRepo.getIntervals(slots)

            val size = LocalSize.current
            val isBigWidget = size.height >= 115.dp || size.width >= 230.dp

            val statusText = if (info.isBlackoutNow) "СВІТЛА НЕМАЄ" else "СВІТЛО Є"
            val statusColor = if (info.isBlackoutNow) Color(0xFFFF5E3A) else Color(0xFF34D399)

            GlanceTheme {
                Box(
                    modifier = GlanceModifier
                        .fillMaxSize()
                        .cornerRadius(20.dp)
                        .background(ColorProvider(Color(0xFF141A29)))
                        .padding(12.dp)
                ) {
                    if (isBigWidget) {
                        // ----------------- 3x2 BIG WIDGET -----------------
                        Column(
                            modifier = GlanceModifier.fillMaxSize(),
                            verticalAlignment = Alignment.Vertical.CenterVertically
                        ) {
                            // Top Row: Queue + Status + Round Refresh Button + Round Notification Toggle Button
                            Row(
                                modifier = GlanceModifier.fillMaxWidth(),
                                verticalAlignment = Alignment.Vertical.CenterVertically
                            ) {
                                Column(
                                    modifier = GlanceModifier
                                        .defaultWeight()
                                        .clickable(actionStartActivity<MainActivity>())
                                ) {
                                    Text(
                                        text = "Черга $activeQueue",
                                        style = TextStyle(
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 16.sp,
                                            color = ColorProvider(Color.White)
                                        )
                                    )
                                    Text(
                                        text = statusText,
                                        style = TextStyle(
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 11.sp,
                                            color = ColorProvider(statusColor)
                                        )
                                    )
                                }

                                // Round Refresh Button (same style as Notification toggle)
                                Box(
                                    modifier = GlanceModifier
                                        .size(36.dp)
                                        .cornerRadius(18.dp)
                                        .background(ColorProvider(Color(0x26FFFFFF)))
                                        .clickable(actionRunCallback<RefreshWidgetActionCallback>()),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Image(
                                        provider = ImageProvider(R.drawable.ic_refresh),
                                        contentDescription = "Оновити дані",
                                        colorFilter = ColorFilter.tint(ColorProvider(Color.White)),
                                        modifier = GlanceModifier.size(18.dp)
                                    )
                                }

                                Spacer(modifier = GlanceModifier.width(8.dp))

                                // Round Notification Toggle Button
                                Box(
                                    modifier = GlanceModifier
                                        .size(36.dp)
                                        .cornerRadius(18.dp)
                                        .background(ColorProvider(if (notificationsEnabled) Color.White else Color(0x26FFFFFF)))
                                        .clickable(actionRunCallback<ToggleAlertsActionCallback>()),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Image(
                                        provider = ImageProvider(
                                            if (notificationsEnabled) R.drawable.ic_notification else R.drawable.ic_notification_off
                                        ),
                                        contentDescription = "Toggle alerts",
                                        colorFilter = ColorFilter.tint(
                                            ColorProvider(if (notificationsEnabled) Color(0xFFFF5E3A) else Color.White)
                                        ),
                                        modifier = GlanceModifier.size(20.dp)
                                    )
                                }
                            }

                            Spacer(modifier = GlanceModifier.height(8.dp))

                            // Countdown Card Row (clickable to open app)
                            Row(
                                modifier = GlanceModifier
                                    .fillMaxWidth()
                                    .cornerRadius(12.dp)
                                    .background(ColorProvider(Color(0x33000000)))
                                    .padding(horizontal = 10.dp, vertical = 6.dp)
                                    .clickable(actionStartActivity<MainActivity>()),
                                verticalAlignment = Alignment.Vertical.CenterVertically
                            ) {
                                Column(modifier = GlanceModifier.defaultWeight()) {
                                    Text(
                                        text = if (info.isBlackoutNow) "До увімкнення:" else "До відключення:",
                                        style = TextStyle(fontSize = 10.sp, color = ColorProvider(Color(0xB3BAE6FD)))
                                    )
                                    Text(
                                        text = info.countdownText,
                                        style = TextStyle(
                                            fontSize = 20.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = ColorProvider(Color.White)
                                        )
                                    )
                                }
                                Column(horizontalAlignment = Alignment.Horizontal.End) {
                                    Text(
                                        text = "Період",
                                        style = TextStyle(fontSize = 10.sp, color = ColorProvider(Color(0xB3BAE6FD)))
                                    )
                                    Text(
                                        text = info.nextSlotTime,
                                        style = TextStyle(
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = ColorProvider(Color.White)
                                        )
                                    )
                                }
                            }

                            Spacer(modifier = GlanceModifier.height(8.dp))

                            // 24-Hour Visual Schedule Bar matching main screen chart logic exactly:
                            // 24 hours, each hour composed of two 30-min vertical rectangles (half 1 and half 2)
                            Row(
                                modifier = GlanceModifier
                                    .fillMaxWidth()
                                    .height(20.dp)
                                    .cornerRadius(6.dp)
                                    .background(ColorProvider(Color(0xFF18181A)))
                                    .padding(2.dp)
                                    .clickable(actionStartActivity<MainActivity>()),
                                verticalAlignment = Alignment.Vertical.CenterVertically
                            ) {
                                val now = LocalTime.now(ZoneId.of("Europe/Kyiv"))
                                val currentH = now.hour
                                val currentM = now.minute
                                val is48 = slots.size >= 48

                                (0 until 24).forEach { hour ->
                                    val isCurrentH = hour == currentH
                                    val half1Off = if (is48) {
                                        slots.getOrNull(hour * 2)?.status == SlotStatus.POWER_OFF
                                    } else {
                                        slots.getOrNull(hour)?.status == SlotStatus.POWER_OFF
                                    }
                                    val half2Off = if (is48) {
                                        slots.getOrNull(hour * 2 + 1)?.status == SlotStatus.POWER_OFF
                                    } else {
                                        slots.getOrNull(hour)?.status == SlotStatus.POWER_OFF
                                    }

                                    // Each hour column with two 30-min blocks
                                    Row(
                                        modifier = GlanceModifier.defaultWeight().height(16.dp),
                                        verticalAlignment = Alignment.Vertical.CenterVertically
                                    ) {
                                        // Half 1
                                        Box(
                                            modifier = GlanceModifier
                                                .defaultWeight()
                                                .height(16.dp)
                                                .cornerRadius(1.dp)
                                                .background(
                                                    ColorProvider(
                                                        if (isCurrentH && currentM < 30) Color.White
                                                        else if (half1Off) Color(0xFFDC3C32)
                                                        else Color(0xFF373737)
                                                    )
                                                )
                                        ) {}
                                        Spacer(modifier = GlanceModifier.width(1.dp))
                                        // Half 2
                                        Box(
                                            modifier = GlanceModifier
                                                .defaultWeight()
                                                .height(16.dp)
                                                .cornerRadius(1.dp)
                                                .background(
                                                    ColorProvider(
                                                        if (isCurrentH && currentM >= 30) Color.White
                                                        else if (half2Off) Color(0xFFDC3C32)
                                                        else Color(0xFF373737)
                                                    )
                                                )
                                        ) {}
                                    }
                                    if (hour < 23) {
                                        Spacer(modifier = GlanceModifier.width(2.dp))
                                    }
                                }
                            }

                            Spacer(modifier = GlanceModifier.height(2.dp))

                            // 24-Hour Markers
                            Row(
                                modifier = GlanceModifier.fillMaxWidth(),
                                verticalAlignment = Alignment.Vertical.CenterVertically
                            ) {
                                Text(text = "00", style = TextStyle(fontSize = 9.sp, color = ColorProvider(Color(0x80BAE6FD))))
                                Spacer(modifier = GlanceModifier.defaultWeight())
                                Text(text = "06", style = TextStyle(fontSize = 9.sp, color = ColorProvider(Color(0x80BAE6FD))))
                                Spacer(modifier = GlanceModifier.defaultWeight())
                                Text(text = "12", style = TextStyle(fontSize = 9.sp, color = ColorProvider(Color(0x80BAE6FD))))
                                Spacer(modifier = GlanceModifier.defaultWeight())
                                Text(text = "18", style = TextStyle(fontSize = 9.sp, color = ColorProvider(Color(0x80BAE6FD))))
                                Spacer(modifier = GlanceModifier.defaultWeight())
                                Text(text = "24", style = TextStyle(fontSize = 9.sp, color = ColorProvider(Color(0x80BAE6FD))))
                            }

                            // Upcoming Outage Interval
                            if (intervals.isNotEmpty()) {
                                Spacer(modifier = GlanceModifier.height(4.dp))
                                val firstInterval = intervals.first()
                                Row(
                                    modifier = GlanceModifier
                                        .fillMaxWidth()
                                        .cornerRadius(8.dp)
                                        .background(ColorProvider(Color(0x26000000)))
                                        .padding(horizontal = 8.dp, vertical = 3.dp)
                                        .clickable(actionStartActivity<MainActivity>()),
                                    verticalAlignment = Alignment.Vertical.CenterVertically
                                ) {
                                    Text(
                                        text = "${firstInterval.first} – ${firstInterval.second}",
                                        style = TextStyle(
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = ColorProvider(Color.White)
                                        )
                                    )
                                    Spacer(modifier = GlanceModifier.defaultWeight())
                                    Text(
                                        text = "Наступне відключення",
                                        style = TextStyle(
                                            fontSize = 10.sp,
                                            color = ColorProvider(Color(0xFFFF5E3A))
                                        )
                                    )
                                }
                            }
                        }
                    } else {
                        // ----------------- 2x1 SMALL WIDGET -----------------
                        Column(
                            modifier = GlanceModifier.fillMaxSize(),
                            verticalAlignment = Alignment.Vertical.CenterVertically
                        ) {
                            // Top Row: Queue + Status
                            Row(
                                modifier = GlanceModifier.fillMaxWidth(),
                                verticalAlignment = Alignment.Vertical.CenterVertically
                            ) {
                                Text(
                                    text = "Черга $activeQueue",
                                    style = TextStyle(
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp,
                                        color = ColorProvider(Color.White)
                                    ),
                                    modifier = GlanceModifier.clickable(actionStartActivity<MainActivity>())
                                )
                                Spacer(modifier = GlanceModifier.defaultWeight())
                                Text(
                                    text = statusText,
                                    style = TextStyle(
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 10.sp,
                                        color = ColorProvider(statusColor)
                                    ),
                                    modifier = GlanceModifier.clickable(actionStartActivity<MainActivity>())
                                )
                            }

                            Spacer(modifier = GlanceModifier.height(4.dp))

                            // Bottom Row: Countdown + Round Refresh Button + Round Notification Toggle Button
                            Row(
                                modifier = GlanceModifier.fillMaxWidth(),
                                verticalAlignment = Alignment.Vertical.CenterVertically
                            ) {
                                Column(
                                    modifier = GlanceModifier
                                        .defaultWeight()
                                        .clickable(actionStartActivity<MainActivity>())
                                ) {
                                    Text(
                                        text = if (info.isBlackoutNow) "До увімкнення:" else "До відключення:",
                                        style = TextStyle(fontSize = 10.sp, color = ColorProvider(Color(0xB3BAE6FD)))
                                    )
                                    Text(
                                        text = info.countdownText,
                                        style = TextStyle(
                                            fontSize = 18.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = ColorProvider(Color.White)
                                        )
                                    )
                                }

                                // Round Refresh Button (same style as Notification toggle)
                                Box(
                                    modifier = GlanceModifier
                                        .size(34.dp)
                                        .cornerRadius(17.dp)
                                        .background(ColorProvider(Color(0x26FFFFFF)))
                                        .clickable(actionRunCallback<RefreshWidgetActionCallback>()),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Image(
                                        provider = ImageProvider(R.drawable.ic_refresh),
                                        contentDescription = "Оновити дані",
                                        colorFilter = ColorFilter.tint(ColorProvider(Color.White)),
                                        modifier = GlanceModifier.size(16.dp)
                                    )
                                }

                                Spacer(modifier = GlanceModifier.width(6.dp))

                                // Round Notification Toggle Button
                                Box(
                                    modifier = GlanceModifier
                                        .size(34.dp)
                                        .cornerRadius(17.dp)
                                        .background(ColorProvider(if (notificationsEnabled) Color.White else Color(0x26FFFFFF)))
                                        .clickable(actionRunCallback<ToggleAlertsActionCallback>()),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Image(
                                        provider = ImageProvider(
                                            if (notificationsEnabled) R.drawable.ic_notification else R.drawable.ic_notification_off
                                        ),
                                        contentDescription = "Toggle alerts",
                                        colorFilter = ColorFilter.tint(
                                            ColorProvider(if (notificationsEnabled) Color(0xFFFF5E3A) else Color.White)
                                        ),
                                        modifier = GlanceModifier.size(18.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

class ToggleAlertsActionCallback : ActionCallback {
    override suspend fun onAction(
        context: Context,
        glanceId: GlanceId,
        parameters: ActionParameters
    ) {
        val appContext = context.applicationContext
        val settingsRepo = SettingsRepository(appContext)
        val current = settingsRepo.getSettings()
        val newState = !current.notificationsEnabled
        settingsRepo.updateNotificationsEnabled(newState)
        try {
            BlackoutGlanceWidget.syncAllWidgets(appContext)
        } catch (_: Exception) {}
    }
}

class RefreshWidgetActionCallback : ActionCallback {
    override suspend fun onAction(
        context: Context,
        glanceId: GlanceId,
        parameters: ActionParameters
    ) {
        val appContext = context.applicationContext
        val settingsRepo = SettingsRepository(appContext)
        val scheduleRepo = ScheduleRepository(appContext)
        val current = settingsRepo.getSettings()

        withContext(Dispatchers.IO) {
            try {
                val res = ZtoeParser.fetchFullSchedule(current.cityUrl, current.queue, appContext)
                if (res.status == ua.blackout.prewarning.data.parser.FetchStatus.SUCCESS || !scheduleRepo.hasValidTodayCache(current.queue)) {
                    scheduleRepo.saveSchedule(current.queue, res.todaySlots, res.tomorrowSlots)
                }
                BlackoutGlanceWidget.syncAllWidgets(appContext)
            } catch (_: Exception) {
                try {
                    BlackoutGlanceWidget.syncAllWidgets(appContext)
                } catch (_: Exception) {}
            }
        }
    }
}