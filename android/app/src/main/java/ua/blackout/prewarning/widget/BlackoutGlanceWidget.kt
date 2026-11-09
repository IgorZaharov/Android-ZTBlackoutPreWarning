package ua.blackout.prewarning.widget

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color as AndroidColor
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.Button
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
import androidx.glance.appwidget.provideContent
import androidx.glance.appwidget.updateAll
import androidx.glance.background
import androidx.glance.layout.*
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import ua.blackout.prewarning.MainActivity
import ua.blackout.prewarning.R
import ua.blackout.prewarning.data.KYIV_ZONE
import ua.blackout.prewarning.data.model.BlackoutSlot
import ua.blackout.prewarning.data.model.SlotStatus
import ua.blackout.prewarning.data.repository.ScheduleRepository
import ua.blackout.prewarning.data.repository.SettingsRepository
import ua.blackout.prewarning.notification.AlarmScheduler
import ua.blackout.prewarning.ui.AppStrings
import ua.blackout.prewarning.worker.ScheduleSyncWorker
import java.time.LocalTime
import java.util.concurrent.ConcurrentHashMap

class BlackoutGlanceWidget : GlanceAppWidget() {

    companion object {
        val SMALL_BOX = DpSize(110.dp, 48.dp)
        val BIG_BOX = DpSize(220.dp, 110.dp)

        suspend fun hasActiveWidgets(context: Context): Boolean {
            return try {
                val manager = GlanceAppWidgetManager(context)
                val glanceIds = manager.getGlanceIds(BlackoutGlanceWidget::class.java)
                glanceIds.isNotEmpty()
            } catch (_: Exception) {
                false
            }
        }

        suspend fun syncAllWidgets(context: Context) {
            try {
                BlackoutGlanceWidget().updateAll(context)
            } catch (_: Exception) {}
        }

        private val bitmapCache = ConcurrentHashMap<String, Bitmap>()
    }

    override val sizeMode: SizeMode = SizeMode.Responsive(setOf(SMALL_BOX, BIG_BOX))

    fun formatWidgetCountdown(rawCountdown: String, isBlackoutNow: Boolean, nextSlotTime: String, lang: String): String {
        val isUk = lang == "uk"
        if (rawCountdown.isEmpty() || rawCountdown == "--:--:--") {
            return if (isUk) "--г. --хв." else "--hr. --m."
        }
        val parts = rawCountdown.split(":")
        if (parts.size >= 2) {
            val hh = parts[0].trim()
            val mm = parts[1].trim()
            return if (isUk) "\${hh}г. \${mm}хв." else "\${hh}hr. \${mm}m."
        }
        return rawCountdown
    }

    fun renderAnalogCounterBitmap(slots: List<BlackoutSlot>, currentH: Int, currentM: Int, lang: String = "uk"): Bitmap {
        val slotSig = if (slots.isEmpty()) "empty" else slots.joinToString("") { if (it.status == SlotStatus.POWER_OFF) "1" else "0" }
        val cacheKey = "\${slotSig}_\${currentH}_\${currentM}_\$lang"
        bitmapCache[cacheKey]?.let { return it }

        val width = 720
        val height = 132
        val bmp = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bmp)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG)

        paint.color = AndroidColor.parseColor("#DFDDD0")
        val outerRect = RectF(0f, 0f, width.toFloat(), height.toFloat())
        canvas.drawRoundRect(outerRect, 20f, 20f, paint)

        paint.color = AndroidColor.parseColor("#7A7768")
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = 3f
        canvas.drawRoundRect(outerRect, 20f, 20f, paint)
        paint.style = Paint.Style.FILL

        val drumLeft = 16f
        val drumTop = 16f
        val drumRight = width - 16f
        val drumBottom = 80f
        paint.color = AndroidColor.parseColor("#4E514E")
        val drumRect = RectF(drumLeft, drumTop, drumRight, drumBottom)
        canvas.drawRoundRect(drumRect, 10f, 10f, paint)

        val innerPad = 4f
        val slotAreaLeft = drumLeft + innerPad
        val slotAreaTop = drumTop + innerPad
        val slotAreaRight = drumRight - innerPad
        val slotAreaBottom = drumBottom - innerPad
        val slotAreaWidth = slotAreaRight - slotAreaLeft
        val slotAreaHeight = slotAreaBottom - slotAreaTop

        if (slots.isEmpty()) {
            paint.color = AndroidColor.parseColor("#7E8287")
            val unclearRect = RectF(slotAreaLeft, slotAreaTop, slotAreaRight, slotAreaBottom)
            canvas.drawRoundRect(unclearRect, 4f, 4f, paint)

            paint.color = AndroidColor.WHITE
            paint.textSize = 24f
            paint.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            paint.textAlign = Paint.Align.CENTER
            val textY = slotAreaTop + (slotAreaHeight / 2f) - ((paint.descent() + paint.ascent()) / 2f)
            canvas.drawText(AppStrings.outagesUnclear(lang), width / 2f, textY, paint)
        } else {
            val is48Slots = slots.size >= 48
            val hourWidth = slotAreaWidth / 24f
            val halfWidth = hourWidth / 2f

            for (hour in 0 until 24) {
                val half1Off = if (is48Slots) {
                    slots.getOrNull(hour * 2)?.status == SlotStatus.POWER_OFF
                } else {
                    slots.getOrNull(hour)?.status == SlotStatus.POWER_OFF
                }
                val half2Off = if (is48Slots) {
                    slots.getOrNull(hour * 2 + 1)?.status == SlotStatus.POWER_OFF
                } else {
                    slots.getOrNull(hour)?.status == SlotStatus.POWER_OFF
                }

                val hLeft = slotAreaLeft + hour * hourWidth

                paint.color = if (half1Off) AndroidColor.parseColor("#D62E26") else AndroidColor.parseColor("#FCFBF7")
                canvas.drawRect(hLeft, slotAreaTop, hLeft + halfWidth, slotAreaBottom, paint)

                paint.color = if (half2Off) AndroidColor.parseColor("#D62E26") else AndroidColor.parseColor("#FCFBF7")
                canvas.drawRect(hLeft + halfWidth, slotAreaTop, hLeft + hourWidth, slotAreaBottom, paint)

                if (hour > 0) {
                    paint.color = AndroidColor.parseColor("#C8C6BC")
                    canvas.drawRect(hLeft - 0.75f, slotAreaTop, hLeft + 0.75f, slotAreaBottom, paint)
                }
            }

            val totalMinutes = currentH * 60 + currentM
            val needleX = slotAreaLeft + (totalMinutes / 1440f) * slotAreaWidth
            paint.color = AndroidColor.parseColor("#0B0B0A")
            val needleRect = RectF(needleX - 2.5f, drumTop - 4f, needleX + 2.5f, drumBottom + 4f)
            canvas.drawRoundRect(needleRect, 2.5f, 2.5f, paint)
        }

        paint.color = AndroidColor.parseColor("#1C1B18")
        paint.textSize = 20f
        paint.typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
        paint.textAlign = Paint.Align.CENTER

        val markers = listOf(0, 4, 8, 12, 16, 20, 24)
        for (m in markers) {
            val markX = slotAreaLeft + (m / 24f) * slotAreaWidth
            canvas.drawRect(markX - 1f, drumBottom + 4f, markX + 1f, drumBottom + 12f, paint)
            val label = String.format("%02d", m)
            canvas.drawText(label, markX.coerceIn(slotAreaLeft + 16f, slotAreaRight - 16f), height - 12f, paint)
        }

        if (bitmapCache.size > 32) {
            bitmapCache.clear()
        }
        bitmapCache[cacheKey] = bmp
        return bmp
    }

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val settingsRepo = SettingsRepository(context)
        val scheduleRepo = ScheduleRepository(context)
        val settings = settingsRepo.getSettings()
        val info = scheduleRepo.getCurrentStatusAndCountdown(settings.queue)
        val slots = scheduleRepo.getTodaySlots(settings.queue)
        val resolvedLang = AppStrings.resolveLang(settings.language)
        val now = LocalTime.now(KYIV_ZONE)

        provideContent {
            GlanceTheme {
                val size = LocalSize.current
                val isBig = size.width >= BIG_BOX.width || size.height >= BIG_BOX.height

                Box(
                    modifier = GlanceModifier
                        .fillMaxSize()
                        .padding(6.dp)
                        .background(ColorProvider(androidx.compose.ui.graphics.Color(0xCC141A29)))
                        .clickable(actionStartActivity<MainActivity>())
                ) {
                    if (isBig) {
                        BigWidgetContent(context, settings, scheduleRepo, info, slots, resolvedLang, now)
                    } else {
                        SmallWidgetContent(settings, info, resolvedLang)
                    }
                }
            }
        }
    }

    @androidx.compose.runtime.Composable
    private fun SmallWidgetContent(
        settings: ua.blackout.prewarning.data.model.UserSettings,
        info: ua.blackout.prewarning.data.repository.ScheduleStatusInfo,
        resolvedLang: String
    ) {
        val isUnclear = info.isUnclear
        val statusText = if (isUnclear) {
            AppStrings.powerUnclear(resolvedLang)
        } else if (info.isBlackoutNow) {
            "СВІТЛА НЕМАЄ"
        } else {
            "СВІТЛО Є"
        }

        val formattedCountdown = formatWidgetCountdown(info.countdownText, info.isBlackoutNow, info.nextSlotTime, resolvedLang)
        val countdownLabel = if (!isUnclear && info.isBlackoutNow) {
            if (resolvedLang == "uk") "До увімкнення:" else "Power on in:"
        } else {
            if (resolvedLang == "uk") "До відключення:" else "Time to blackout:"
        }

        Column(
            modifier = GlanceModifier.fillMaxSize().padding(6.dp),
            verticalAlignment = Alignment.Vertical.CenterVertically
        ) {
            Row(
                modifier = GlanceModifier.fillMaxWidth(),
                verticalAlignment = Alignment.Vertical.CenterVertically
            ) {
                Text(
                    text = "\${AppStrings.queue(resolvedLang)} \${settings.queue}",
                    style = TextStyle(
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp,
                        color = ColorProvider(androidx.compose.ui.graphics.Color.White)
                    )
                )
                Spacer(modifier = GlanceModifier.defaultWeight())
                Text(
                    text = statusText,
                    style = TextStyle(
                        fontWeight = FontWeight.Bold,
                        fontSize = 11.sp,
                        color = if (isUnclear) {
                            ColorProvider(androidx.compose.ui.graphics.Color(0xFFA1A1AA))
                        } else if (info.isBlackoutNow) {
                            ColorProvider(androidx.compose.ui.graphics.Color(0xFFFF5E3A))
                        } else {
                            ColorProvider(androidx.compose.ui.graphics.Color(0xFF34D399))
                        }
                    )
                )
            }

            Spacer(modifier = GlanceModifier.height(4.dp))

            Row(
                modifier = GlanceModifier.fillMaxWidth(),
                verticalAlignment = Alignment.Vertical.CenterVertically
            ) {
                Column(modifier = GlanceModifier.defaultWeight()) {
                    Text(
                        text = countdownLabel,
                        style = TextStyle(
                            fontSize = 9.sp,
                            color = ColorProvider(androidx.compose.ui.graphics.Color(0xFFBAE6FD))
                        )
                    )
                    Text(
                        text = formattedCountdown,
                        style = TextStyle(
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = ColorProvider(androidx.compose.ui.graphics.Color.White)
                        ),
                        maxLines = 1
                    )
                }

                Image(
                    provider = ImageProvider(R.drawable.ic_refresh),
                    contentDescription = "Refresh",
                    modifier = GlanceModifier
                        .size(32.dp)
                        .padding(4.dp)
                        .clickable(actionRunCallback<RefreshWidgetActionCallback>())
                )

                Spacer(modifier = GlanceModifier.width(4.dp))

                Button(
                    text = if (settings.notificationsEnabled) "🔕" else "🔔",
                    onClick = actionRunCallback<ToggleAlertsActionCallback>()
                )
            }
        }
    }

    @androidx.compose.runtime.Composable
    private fun BigWidgetContent(
        context: Context,
        settings: ua.blackout.prewarning.data.model.UserSettings,
        scheduleRepo: ScheduleRepository,
        info: ua.blackout.prewarning.data.repository.ScheduleStatusInfo,
        slots: List<BlackoutSlot>,
        resolvedLang: String,
        now: LocalTime
    ) {
        val isUnclear = info.isUnclear
        val statusText = if (isUnclear) {
            AppStrings.powerUnclear(resolvedLang)
        } else if (info.isBlackoutNow) {
            "СВІТЛА НЕМАЄ"
        } else {
            "СВІТЛО Є"
        }

        val formattedCountdown = formatWidgetCountdown(info.countdownText, info.isBlackoutNow, info.nextSlotTime, resolvedLang)
        val countdownLabel = if (!isUnclear && info.isBlackoutNow) {
            if (resolvedLang == "uk") "До увімкнення:" else "Power on in:"
        } else {
            if (resolvedLang == "uk") "До відключення:" else "Time to blackout:"
        }

        val nextBlackoutText = if (isUnclear) "--:-- - --:--" else scheduleRepo.getNextUpcomingIntervalText(settings.queue)
        val nextLabel = if (resolvedLang == "uk") "Наступне відключення:" else "Next blackout:"

        val timelineBitmap = renderAnalogCounterBitmap(slots, now.hour, now.minute, resolvedLang)

        Column(
            modifier = GlanceModifier.fillMaxSize().padding(8.dp),
            verticalAlignment = Alignment.Vertical.Top
        ) {
            Row(
                modifier = GlanceModifier.fillMaxWidth(),
                verticalAlignment = Alignment.Vertical.CenterVertically
            ) {
                Column {
                    Text(
                        text = "\${AppStrings.queue(resolvedLang)} \${settings.queue}",
                        style = TextStyle(
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp,
                            color = ColorProvider(androidx.compose.ui.graphics.Color.White)
                        )
                    )
                    Text(
                        text = statusText,
                        style = TextStyle(
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp,
                            color = if (isUnclear) {
                                ColorProvider(androidx.compose.ui.graphics.Color(0xFFA1A1AA))
                            } else if (info.isBlackoutNow) {
                                ColorProvider(androidx.compose.ui.graphics.Color(0xFFFF5E3A))
                            } else {
                                ColorProvider(androidx.compose.ui.graphics.Color(0xFF34D399))
                            }
                        )
                    )
                }

                Spacer(modifier = GlanceModifier.defaultWeight())

                Image(
                    provider = ImageProvider(R.drawable.ic_refresh),
                    contentDescription = "Refresh",
                    modifier = GlanceModifier
                        .size(32.dp)
                        .padding(4.dp)
                        .clickable(actionRunCallback<RefreshWidgetActionCallback>())
                )

                Spacer(modifier = GlanceModifier.width(4.dp))

                Button(
                    text = if (settings.notificationsEnabled) "🔕" else "🔔",
                    onClick = actionRunCallback<ToggleAlertsActionCallback>()
                )
            }

            Spacer(modifier = GlanceModifier.height(4.dp))

            Row(
                modifier = GlanceModifier.fillMaxWidth(),
                verticalAlignment = Alignment.Vertical.CenterVertically
            ) {
                Text(
                    text = "$countdownLabel $formattedCountdown",
                    style = TextStyle(
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = ColorProvider(androidx.compose.ui.graphics.Color.White)
                    )
                )
                Spacer(modifier = GlanceModifier.defaultWeight())
                Text(
                    text = if (isUnclear) "--:-- - --:--" else info.nextSlotTime,
                    style = TextStyle(
                        fontSize = 11.sp,
                        color = ColorProvider(androidx.compose.ui.graphics.Color(0xFFBAE6FD))
                    )
                )
            }

            Spacer(modifier = GlanceModifier.height(4.dp))

            Image(
                provider = ImageProvider(timelineBitmap),
                contentDescription = "24h Timeline",
                modifier = GlanceModifier
                    .fillMaxWidth()
                    .height(38.dp)
            )

            Spacer(modifier = GlanceModifier.height(2.dp))

            Row(
                modifier = GlanceModifier.fillMaxWidth(),
                verticalAlignment = Alignment.Vertical.CenterVertically
            ) {
                Text(
                    text = nextLabel,
                    style = TextStyle(
                        fontSize = 10.sp,
                        color = ColorProvider(androidx.compose.ui.graphics.Color(0xFFFF5E3A))
                    )
                )
                Spacer(modifier = GlanceModifier.width(4.dp))
                Text(
                    text = nextBlackoutText,
                    style = TextStyle(
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = ColorProvider(androidx.compose.ui.graphics.Color.White)
                    )
                )
            }
        }
    }
}

class RefreshWidgetActionCallback : ActionCallback {
    override suspend fun onAction(
        context: Context,
        glanceId: GlanceId,
        parameters: ActionParameters
    ) {
        val appContext = context.applicationContext
        CoroutineScope(Dispatchers.IO).launch {
            try {
                ScheduleSyncWorker.syncImmediately(appContext)
                AlarmScheduler.syncAlarms(appContext)
                BlackoutGlanceWidget.syncAllWidgets(appContext)
            } catch (_: Exception) {}
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
        CoroutineScope(Dispatchers.IO).launch {
            try {
                AlarmScheduler.syncAlarms(appContext)
                BlackoutGlanceWidget.syncAllWidgets(appContext)
            } catch (_: Exception) {}
        }
    }
}