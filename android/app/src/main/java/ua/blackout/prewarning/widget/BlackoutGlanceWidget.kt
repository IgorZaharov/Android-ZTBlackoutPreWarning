package ua.blackout.prewarning.widget

import android.content.Context
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.*
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import androidx.glance.Button
import ua.blackout.prewarning.MainActivity
import ua.blackout.prewarning.data.repository.SettingsRepository
import ua.blackout.prewarning.data.repository.ScheduleRepository

class BlackoutGlanceWidget : GlanceAppWidget() {

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val settingsRepo = SettingsRepository(context)
        val scheduleRepo = ScheduleRepository(context)
        val settings = settingsRepo.getSettings()
        val info = scheduleRepo.getCurrentStatusAndCountdown(settings.queue)

        provideContent {
            GlanceTheme {
                // Tapping anywhere on the widget container navigates to the App
                Box(
                    modifier = GlanceModifier
                        .fillMaxSize()
                        .padding(8.dp)
                        .background(GlanceTheme.colors.surface)
                        .clickable(actionStartActivity<MainActivity>())
                ) {
                    Column(
                        modifier = GlanceModifier.fillMaxSize().padding(8.dp),
                        verticalAlignment = Alignment.Vertical.CenterVertically
                    ) {
                        // Header row with Queue and Status Dot
                        Row(
                            modifier = GlanceModifier.fillMaxWidth(),
                            verticalAlignment = Alignment.Vertical.CenterVertically
                        ) {
                            Text(
                                text = "⚡ Черга ${settings.queue}",
                                style = TextStyle(
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp,
                                    color = GlanceTheme.colors.onSurface
                                )
                            )
                            Spacer(modifier = GlanceModifier.defaultWeight())
                            // Status text
                            Text(
                                text = if (info.isBlackoutNow) "ЗНЕСТРУМЛЕНО" else "СВІТЛО Є",
                                style = TextStyle(
                                    fontWeight = FontWeight.Medium,
                                    fontSize = 11.sp,
                                    color = if (info.isBlackoutNow) GlanceTheme.colors.error else GlanceTheme.colors.primary
                                )
                            )
                        }

                        Spacer(modifier = GlanceModifier.height(4.dp))

                        // Middle row: countdown and 2x1 toggle button
                        Row(
                            modifier = GlanceModifier.fillMaxWidth(),
                            verticalAlignment = Alignment.Vertical.CenterVertically
                        ) {
                            Column(modifier = GlanceModifier.defaultWeight()) {
                                Text(
                                    text = if (info.isBlackoutNow) "До увімкнення:" else "До відключення:",
                                    style = TextStyle(fontSize = 11.sp, color = GlanceTheme.colors.onSurfaceVariant)
                                )
                                Text(
                                    text = info.countdownText, // e.g. "01:35"
                                    style = TextStyle(
                                        fontSize = 18.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = GlanceTheme.colors.onSurface
                                    )
                                )
                            }

                            // 2x1 & Resizable Widget Toggle Action Button:
                            // Stops / Resumes notifications on the spot without opening app!
                            Button(
                                text = if (settings.notificationsEnabled) "🔕 Зупинити" else "🔔 Увімкнути",
                                onClick = actionRunCallback<ToggleAlertsActionCallback>()
                            )
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
        settingsRepo.updateNotificationsEnabled(!current.notificationsEnabled)
        BlackoutGlanceWidget().update(context, glanceId)
    }
}