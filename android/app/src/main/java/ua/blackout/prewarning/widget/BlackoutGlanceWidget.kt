package ua.blackout.prewarning.widget

import android.content.Context
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
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
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.appwidget.updateAll
import androidx.glance.background
import androidx.glance.layout.*
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import ua.blackout.prewarning.MainActivity
import ua.blackout.prewarning.R
import ua.blackout.prewarning.data.model.SlotStatus
import ua.blackout.prewarning.data.repository.ScheduleRepository
import ua.blackout.prewarning.data.repository.SettingsRepository
import java.time.LocalTime

class BlackoutGlanceWidget : GlanceAppWidget() {

    override val sizeMode = SizeMode.Responsive(
        setOf(
            DpSize(120.dp, 60.dp),   // 2x1 Small
            DpSize(250.dp, 160.dp)   // 3x2 Big
        )
    )

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val settingsRepo = SettingsRepository(context)
        val scheduleRepo = ScheduleRepository(context)
        val settings = settingsRepo.getSettings()
        val info = scheduleRepo.getCurrentStatusAndCountdown(settings.queue)
        val slots = scheduleRepo.getSlots(settings.queue)
        val intervals = scheduleRepo.getIntervals(slots)

        provideContent {
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
                            // Top Row: Queue + Status + Toggle Button
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
                                        text = "Черга ${settings.queue}",
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

                                // Dedicated toggle button (not inside clickable parent)
                                Box(
                                    modifier = GlanceModifier
                                        .size(36.dp)
                                        .cornerRadius(18.dp)
                                        .background(ColorProvider(if (settings.notificationsEnabled) Color.White else Color(0x26FFFFFF)))
                                        .clickable(actionRunCallback<ToggleAlertsActionCallback>()),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Image(
                                        provider = ImageProvider(
                                            if (settings.notificationsEnabled) R.drawable.ic_notification else R.drawable.ic_notification_off
                                        ),
                                        contentDescription = "Toggle alerts",
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

                            // 24-Hour Visual Schedule Bar matching main screen (red & gray)
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
                                val currentH = LocalTime.now().hour
                                slots.forEach { slot ->
                                    val isOff = slot.status == SlotStatus.POWER_OFF
                                    val isCurrent = slot.startHour == currentH
                                    Box(
                                        modifier = GlanceModifier
                                            .defaultWeight()
                                            .height(16.dp)
                                            .background(
                                                ColorProvider(
                                                    if (isCurrent) Color.White
                                                    else if (isOff) Color(0xFFDC3C32)
                                                    else Color(0xFF373737)
                                                )
                                            )
                                    ) {}
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
                                    text = "Черга ${settings.queue}",
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

                            // Bottom Row: Countdown + Dedicated Toggle Button
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

                                // Dedicated toggle button with direct click callback
                                Box(
                                    modifier = GlanceModifier
                                        .size(34.dp)
                                        .cornerRadius(17.dp)
                                        .background(ColorProvider(if (settings.notificationsEnabled) Color.White else Color(0x26FFFFFF)))
                                        .clickable(actionRunCallback<ToggleAlertsActionCallback>()),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Image(
                                        provider = ImageProvider(
                                            if (settings.notificationsEnabled) R.drawable.ic_notification else R.drawable.ic_notification_off
                                        ),
                                        contentDescription = "Toggle alerts",
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
        val settingsRepo = SettingsRepository(context)
        val current = settingsRepo.getSettings()
        val newState = !current.notificationsEnabled
        settingsRepo.updateNotificationsEnabled(newState)
        BlackoutGlanceWidget().updateAll(context)
    }
}