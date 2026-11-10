package ua.blackout.prewarning.widget

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
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
import ua.blackout.prewarning.data.model.BlackoutSlot
import ua.blackout.prewarning.data.model.SlotStatus
import ua.blackout.prewarning.data.parser.ZtoeParser
import ua.blackout.prewarning.data.repository.ScheduleRepository
import ua.blackout.prewarning.data.repository.SettingsRepository
import ua.blackout.prewarning.notification.AlarmScheduler
import ua.blackout.prewarning.ui.AppStrings
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import ua.blackout.prewarning.data.KYIV_ZONE

open class BlackoutGlanceWidget(private val forceBigLayout: Boolean = false) : GlanceAppWidget() {

    override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

    override val sizeMode = SizeMode.Responsive(
        setOf(
            DpSize(120.dp, 60.dp),   // 2x1 Small
            DpSize(250.dp, 110.dp),  // 4x2 Big
            DpSize(250.dp, 160.dp)   // 3x2 Big
        )
    )

    companion object {
        val KEY_NOTIFICATIONS_ENABLED = booleanPreferencesKey("glance_notifications_enabled")
        val KEY_QUEUE = stringPreferencesKey("glance_queue")
        val KEY_LANGUAGE = stringPreferencesKey("glance_language")
        val KEY_REFRESH_TICK = longPreferencesKey("glance_refresh_tick")
        val KEY_IS_BLACKOUT_NOW = booleanPreferencesKey("glance_is_blackout_now")
        val KEY_IS_UNCLEAR = booleanPreferencesKey("glance_is_unclear")
        val KEY_COUNTDOWN_TEXT = stringPreferencesKey("glance_countdown_text")
        val KEY_NEXT_SLOT_TIME = stringPreferencesKey("glance_next_slot_time")
        val KEY_NEXT_BLACKOUT_TEXT = stringPreferencesKey("glance_next_blackout_text")

        private val COUNTDOWN_PART_REGEX = Regex("(\\d{1,2}|--)")

        fun formatWidgetCountdown(rawCountdown: String, lang: String): String {
            val isEn = lang.equals("en", ignoreCase = true)
            val matches = COUNTDOWN_PART_REGEX.findAll(rawCountdown).map { it.value }.toList()
            if (matches.size >= 2) {
                val hh = if (matches[0] == "--") "--" else matches[0].padStart(2, '0')
                val mm = if (matches[1] == "--") "--" else matches[1].padStart(2, '0')
                return if (isEn) "${hh}hr. ${mm}m." else "${hh}г. ${mm}хв."
            }
            return rawCountdown
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

        @Volatile
        private var cachedChartBitmapKey: String? = null
        @Volatile
        private var cachedChartBitmap: Bitmap? = null

        suspend fun hasActiveWidgets(context: Context): Boolean {
            return try {
                val appCtx = context.applicationContext
                val manager = GlanceAppWidgetManager(appCtx)
                manager.getGlanceIds(BlackoutGlanceWidget::class.java).isNotEmpty() ||
                    manager.getGlanceIds(BlackoutBigGlanceWidget::class.java).isNotEmpty()
            } catch (_: Exception) {
                false
            }
        }

        suspend fun syncAllWidgets(context: Context) {
            val appCtx = context.applicationContext
            val manager = GlanceAppWidgetManager(appCtx)
            val smallIds = manager.getGlanceIds(BlackoutGlanceWidget::class.java)
            val bigIds = manager.getGlanceIds(BlackoutBigGlanceWidget::class.java)
            val glanceIds = smallIds + bigIds
            if (glanceIds.isEmpty()) return

            val settings = SettingsRepository(appCtx).getSettings()
            val resolvedLang = AppStrings.resolveLang(settings.language)
            val scheduleRepo = ScheduleRepository(appCtx)

            val todayDateIso = LocalDate.now(KYIV_ZONE).format(DateTimeFormatter.ISO_LOCAL_DATE)
            val tomorrowDateIso = LocalDate.now(KYIV_ZONE).plusDays(1).format(DateTimeFormatter.ISO_LOCAL_DATE)
            val isNoQueueHouse = !settings.customQueueStatusText.isNullOrBlank()
            val baseTodaySlots = when {
                isNoQueueHouse && settings.activeEmergencyOutage == null -> buildLightNoOutageSlots()
                settings.queue.isBlank() && isNoQueueHouse -> buildLightNoOutageSlots()
                else -> scheduleRepo.getTodaySlots(settings.queue)
            }
            val effectiveTodaySlots = ScheduleRepository.applyEmergencyOutageToSlots(
                baseTodaySlots,
                todayDateIso,
                settings.activeEmergencyOutage
            )
            val rawTomorrowSlots = scheduleRepo.getTomorrowSlots(settings.queue)
            val effectiveTomorrowSlots = rawTomorrowSlots?.let {
                ScheduleRepository.applyEmergencyOutageToSlots(it, tomorrowDateIso, settings.activeEmergencyOutage)
            }

            val info = when {
                settings.queue.isBlank() && !isNoQueueHouse && settings.activeEmergencyOutage == null ->
                    ScheduleRepository.StatusAndCountdown(false, "--:--:--", "--:-- - --:--", true)
                isNoQueueHouse && settings.activeEmergencyOutage == null ->
                    ScheduleRepository.StatusAndCountdown(false, "--:--:--", "Відключень немає", false)
                else ->
                    ScheduleRepository.calculateStatusAndCountdown(
                        slots = effectiveTodaySlots,
                        tomorrowSlots = effectiveTomorrowSlots,
                        now = LocalTime.now(KYIV_ZONE)
                    )
            }
            val formattedCountdown = formatWidgetCountdown(info.countdownText, resolvedLang)
            val nextBlackoutText = if (isNoQueueHouse && settings.activeEmergencyOutage == null) {
                "Сьогодні більше немає"
            } else {
                val nowMin = LocalTime.now(KYIV_ZONE).let { it.hour * 60 + it.minute }
                val upcoming = scheduleRepo.getDetailedIntervals(effectiveTodaySlots).firstOrNull { interval ->
                    val p = interval.startStr.split(":")
                    val startMin = (p.getOrNull(0)?.toIntOrNull() ?: 0) * 60 + (p.getOrNull(1)?.toIntOrNull() ?: 0)
                    startMin > nowMin
                }
                if (upcoming != null) "${upcoming.startStr} – ${upcoming.endStr}" else "Сьогодні більше немає"
            }
            val nowMs = System.currentTimeMillis()
            for (gId in smallIds) {
                updateAppWidgetState(appCtx, PreferencesGlanceStateDefinition, gId) { prefs ->
                    prefs.toMutablePreferences().apply {
                        this[KEY_NOTIFICATIONS_ENABLED] = settings.notificationsEnabled
                        this[KEY_QUEUE] = settings.queue
                        this[KEY_LANGUAGE] = resolvedLang
                        this[KEY_REFRESH_TICK] = nowMs
                        this[KEY_IS_BLACKOUT_NOW] = info.isBlackoutNow
                        this[KEY_IS_UNCLEAR] = info.isUnclear
                        this[KEY_COUNTDOWN_TEXT] = formattedCountdown
                        this[KEY_NEXT_SLOT_TIME] = info.nextSlotTime
                        this[KEY_NEXT_BLACKOUT_TEXT] = nextBlackoutText
                    }
                }
                BlackoutGlanceWidget().update(appCtx, gId)
            }
            for (gId in bigIds) {
                updateAppWidgetState(appCtx, PreferencesGlanceStateDefinition, gId) { prefs ->
                    prefs.toMutablePreferences().apply {
                        this[KEY_NOTIFICATIONS_ENABLED] = settings.notificationsEnabled
                        this[KEY_QUEUE] = settings.queue
                        this[KEY_LANGUAGE] = resolvedLang
                        this[KEY_REFRESH_TICK] = nowMs
                        this[KEY_IS_BLACKOUT_NOW] = info.isBlackoutNow
                        this[KEY_IS_UNCLEAR] = info.isUnclear
                        this[KEY_COUNTDOWN_TEXT] = formattedCountdown
                        this[KEY_NEXT_SLOT_TIME] = info.nextSlotTime
                        this[KEY_NEXT_BLACKOUT_TEXT] = nextBlackoutText
                    }
                }
                BlackoutBigGlanceWidget().update(appCtx, gId)
            }
        }

        /**
         * Renders the 24-hour analog electricity counter (САЗУ-ИТ) chart as a high-DPI Bitmap
         * and caches it by (slotStatuses, currentH, currentM) to avoid redundant Bitmap allocations
         * and Canvas redraws within the same minute (e.g., when toggling the alert bell icon).
         */
        fun renderAnalogCounterBitmap(
            slots: List<BlackoutSlot>,
            currentH: Int,
            currentM: Int,
            lang: String = "uk"
        ): Bitmap {
            val slotSignature = if (slots.isEmpty()) {
                "UNCLEAR"
            } else {
                buildString(slots.size) {
                    for (s in slots) {
                        append(if (s.status == SlotStatus.POWER_OFF) '1' else '0')
                    }
                }
            }
            val bitmapKey = "${slotSignature}_${currentH}_${currentM}_$lang"
            val existingBmp = cachedChartBitmap
            if (cachedChartBitmapKey == bitmapKey && existingBmp != null && !existingBmp.isRecycled) {
                return existingBmp
            }

            val width = 720
            val height = 132
            val bmp = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bmp)
            val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { isDither = true }

            // 1. Vintage enamel beige faceplate (#DFDDD0 -> #D4D1C1 -> #C6C2B0) with #7A7768 border
            val faceplateRect = RectF(2f, 2f, width - 2f, height - 2f)
            paint.style = Paint.Style.FILL
            paint.shader = LinearGradient(
                0f, 0f, 0f, height.toFloat(),
                intArrayOf(0xFFDFDDD0.toInt(), 0xFFD4D1C1.toInt(), 0xFFC6C2B0.toInt()),
                floatArrayOf(0f, 0.5f, 1f),
                Shader.TileMode.CLAMP
            )
            canvas.drawRoundRect(faceplateRect, 24f, 24f, paint)

            paint.shader = null
            paint.style = Paint.Style.STROKE
            paint.strokeWidth = 4f
            paint.color = 0xFF7A7768.toInt()
            canvas.drawRoundRect(faceplateRect, 24f, 24f, paint)

            // 2. Recessed dark-grey contour (#4E514E) with #6E716B border
            val contourLeft = 18f
            val contourTop = 18f
            val contourRight = width - 18f
            val contourBottom = 84f
            val contourRect = RectF(contourLeft, contourTop, contourRight, contourBottom)

            paint.style = Paint.Style.FILL
            paint.color = 0xFF4E514E.toInt()
            canvas.drawRoundRect(contourRect, 12f, 12f, paint)

            paint.style = Paint.Style.STROKE
            paint.strokeWidth = 3f
            paint.color = 0xFF6E716B.toInt()
            canvas.drawRoundRect(contourRect, 12f, 12f, paint)

            // 3. Inner light-gray slot track (#C8C6BC) for 1.5px hour separators
            val trackLeft = 26f
            val trackTop = 26f
            val trackRight = width - 26f
            val trackBottom = 76f
            val trackWidth = trackRight - trackLeft
            val trackRect = RectF(trackLeft, trackTop, trackRight, trackBottom)

            paint.style = Paint.Style.FILL
            paint.color = 0xFFC8C6BC.toInt()
            canvas.drawRoundRect(trackRect, 4f, 4f, paint)

            // 4. 24 hours x 2 half-hour cylindrical blocks (no half-hour separators)
            val sepPx = 3f
            val totalSep = sepPx * 23f
            val hourWidth = (trackWidth - totalSep) / 24f
            val halfWidth = hourWidth / 2f

            val offShader = LinearGradient(
                0f, trackTop, 0f, trackBottom,
                intArrayOf(0xFF9E1E18.toInt(), 0xFFD62E26.toInt(), 0xFF8C1914.toInt()),
                floatArrayOf(0f, 0.5f, 1f),
                Shader.TileMode.CLAMP
            )
            val onShader = LinearGradient(
                0f, trackTop, 0f, trackBottom,
                intArrayOf(0xFFD8D6CC.toInt(), 0xFFFCFBF7.toInt(), 0xFFCCC9BE.toInt()),
                floatArrayOf(0f, 0.5f, 1f),
                Shader.TileMode.CLAMP
            )

            if (slots.isEmpty()) {
                // Grey drum chart with "Графіки не діють" / "Outages unclear" when site is unreachable or no queues found
                val unclearShader = LinearGradient(
                    0f, trackTop, 0f, trackBottom,
                    intArrayOf(0xFF7E8287.toInt(), 0xFF94989E.toInt(), 0xFF6E7277.toInt()),
                    floatArrayOf(0f, 0.5f, 1f),
                    Shader.TileMode.CLAMP
                )
                paint.shader = unclearShader
                canvas.drawRoundRect(trackRect, 4f, 4f, paint)
                paint.shader = null

                val unclearText = AppStrings.outagesUnclear(lang)
                val unclearTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color = 0xFFFFFFFF.toInt()
                    typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
                    textSize = 22f
                }
                val textWidth = unclearTextPaint.measureText(unclearText)
                val textX = trackLeft + (trackWidth - textWidth) / 2f
                val textYCenter = (trackTop + trackBottom) / 2f - (unclearTextPaint.descent() + unclearTextPaint.ascent()) / 2f
                canvas.drawText(unclearText, textX, textYCenter, unclearTextPaint)
            } else {
                val is48 = slots.size >= 48
                (0 until 24).forEach { hour ->
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

                    val hLeft = trackLeft + hour * (hourWidth + sepPx)

                    // Half 1: XX:00 - XX:30
                    paint.shader = if (half1Off) offShader else onShader
                    canvas.drawRect(hLeft, trackTop, hLeft + halfWidth, trackBottom, paint)

                    // Half 2: XX:30 - (XX+1):00 (contiguous with Half 1, no half-hour separator)
                    paint.shader = if (half2Off) offShader else onShader
                    canvas.drawRect(hLeft + halfWidth, trackTop, hLeft + hourWidth, trackBottom, paint)
                }
                paint.shader = null
            }

            // 5. Black current-time needle (#0B0B0A) protruding above and below the dark-grey contour
            val fraction = ((currentH.coerceIn(0, 23) * 60 + currentM.coerceIn(0, 59)) / 1440f).coerceIn(0f, 1f)
            val needleX = trackLeft + trackWidth * fraction
            val needleTop = contourTop - 8f
            val needleBottom = contourBottom + 8f

            // Subtle white halo around the black needle
            paint.style = Paint.Style.FILL
            paint.color = 0xD9FFFFFF.toInt()
            canvas.drawRoundRect(
                RectF(needleX - 4.5f, needleTop, needleX + 4.5f, needleBottom),
                4.5f, 4.5f, paint
            )

            // Solid black needle
            paint.color = 0xFF0B0B0A.toInt()
            canvas.drawRoundRect(
                RectF(needleX - 3f, needleTop, needleX + 3f, needleBottom),
                3f, 3f, paint
            )

            // 6. Stamped black (#1C1B18) hour markers: 00, 06, 12, 18, 24
            val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = 0xFF1C1B18.toInt()
                typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
                textSize = 21f
            }
            val labels = listOf(
                0f to "00",
                0.25f to "06",
                0.50f to "12",
                0.75f to "18",
                1.0f to "24"
            )
            val textY = 116f
            labels.forEach { (pos, label) ->
                val tw = textPaint.measureText(label)
                val x = when (pos) {
                    0f -> trackLeft
                    1.0f -> trackRight - tw
                    else -> trackLeft + trackWidth * pos - tw / 2f
                }
                canvas.drawText(label, x, textY, textPaint)
            }

            cachedChartBitmapKey = bitmapKey
            cachedChartBitmap = bmp
            return bmp
        }
    }

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val appContext = context.applicationContext
        val settingsRepo = SettingsRepository(appContext)
        val scheduleRepo = ScheduleRepository(appContext)
        val initialSettings = settingsRepo.getSettings()

        // Immediately fetch live schedule on first widget placement if cache is missing for selected queue
        if (initialSettings.queue.isNotBlank() && !scheduleRepo.hasValidTodayCache(initialSettings.queue)) {
            withContext(Dispatchers.IO) {
                try {
                    val res = ZtoeParser.fetchFullSchedule(initialSettings.cityUrl, initialSettings.queue, appContext)
                    if (res.status == ua.blackout.prewarning.data.parser.FetchStatus.SUCCESS) {
                        scheduleRepo.saveSchedule(initialSettings.queue, res.todaySlots, res.tomorrowSlots)
                    } else {
                        scheduleRepo.clearScheduleCache()
                    }
                } catch (_: Exception) {
                    scheduleRepo.clearScheduleCache()
                }
            }
        }

        provideContent {
            val prefs = currentState<Preferences>()
            // Observe Glance state preferences so recomposition always triggers when toggled or refreshed
            val currentSettings = settingsRepo.getSettings()
            val resolvedLang = AppStrings.resolveLang(prefs[KEY_LANGUAGE] ?: currentSettings.language)
            val notificationsEnabled = prefs[KEY_NOTIFICATIONS_ENABLED] ?: currentSettings.notificationsEnabled
            val activeQueue = currentSettings.queue
            val isNoQueueHouse = !currentSettings.customQueueStatusText.isNullOrBlank()
            val refreshTick = prefs[KEY_REFRESH_TICK] ?: 0L

            val todayDateIso = LocalDate.now(KYIV_ZONE).format(DateTimeFormatter.ISO_LOCAL_DATE)
            val tomorrowDateIso = LocalDate.now(KYIV_ZONE).plusDays(1).format(DateTimeFormatter.ISO_LOCAL_DATE)

            // Always use Today's schedule for the widget, with active emergency outage overlaid
            val baseTodaySlots = when {
                isNoQueueHouse && currentSettings.activeEmergencyOutage == null -> buildLightNoOutageSlots()
                activeQueue.isBlank() && isNoQueueHouse -> buildLightNoOutageSlots()
                else -> scheduleRepo.getTodaySlots(activeQueue)
            }
            val slots = ScheduleRepository.applyEmergencyOutageToSlots(
                baseTodaySlots,
                todayDateIso,
                currentSettings.activeEmergencyOutage
            )
            val rawTomorrowSlots = scheduleRepo.getTomorrowSlots(activeQueue)
            val effectiveTomorrowSlots = rawTomorrowSlots?.let {
                ScheduleRepository.applyEmergencyOutageToSlots(it, tomorrowDateIso, currentSettings.activeEmergencyOutage)
            }
            val liveInfo = when {
                activeQueue.isBlank() && !isNoQueueHouse && currentSettings.activeEmergencyOutage == null ->
                    ScheduleRepository.StatusAndCountdown(false, "--:--:--", "--:-- - --:--", true)
                isNoQueueHouse && currentSettings.activeEmergencyOutage == null ->
                    ScheduleRepository.StatusAndCountdown(false, "--:--:--", "Відключень немає", false)
                else ->
                    ScheduleRepository.calculateStatusAndCountdown(
                        slots = slots,
                        tomorrowSlots = effectiveTomorrowSlots,
                        now = LocalTime.now(KYIV_ZONE)
                    )
            }

            val isUnclear = slots.isEmpty() || (if (refreshTick > 0L) (prefs[KEY_IS_UNCLEAR] ?: liveInfo.isUnclear) else liveInfo.isUnclear)
            val isBlackoutNow = !isUnclear && (if (refreshTick > 0L) (prefs[KEY_IS_BLACKOUT_NOW] ?: liveInfo.isBlackoutNow) else liveInfo.isBlackoutNow)
            val rawCountdownText = if (isUnclear) "--:--:--" else (prefs[KEY_COUNTDOWN_TEXT]?.takeIf { it.isNotBlank() && refreshTick > 0L } ?: liveInfo.countdownText)
            val countdownText = formatWidgetCountdown(rawCountdownText, resolvedLang)
            val nextSlotTime = if (isUnclear) "--:-- - --:--" else (prefs[KEY_NEXT_SLOT_TIME]?.takeIf { it.isNotBlank() && refreshTick > 0L } ?: liveInfo.nextSlotTime)
            val nextBlackoutText = if (isUnclear) {
                "--:-- - --:--"
            } else if (isNoQueueHouse && currentSettings.activeEmergencyOutage == null) {
                "Сьогодні більше немає"
            } else {
                val nowMin = LocalTime.now(KYIV_ZONE).let { it.hour * 60 + it.minute }
                val upcoming = scheduleRepo.getDetailedIntervals(slots).firstOrNull { interval ->
                    val p = interval.startStr.split(":")
                    val startMin = (p.getOrNull(0)?.toIntOrNull() ?: 0) * 60 + (p.getOrNull(1)?.toIntOrNull() ?: 0)
                    startMin > nowMin
                }
                if (upcoming != null) "${upcoming.startStr} – ${upcoming.endStr}" else (prefs[KEY_NEXT_BLACKOUT_TEXT] ?: "Сьогодні більше немає")
            }

            val size = LocalSize.current
            val isBigWidget = forceBigLayout || size.height >= 110.dp || size.width >= 220.dp

            val queueHeaderText = when {
                isNoQueueHouse -> if (resolvedLang == "uk") "Черга відсутня" else "No queue"
                activeQueue.isBlank() -> if (resolvedLang == "uk") "Черга —" else "Queue —"
                else -> "Черга $activeQueue"
            }

            val statusText = when {
                isUnclear -> AppStrings.powerUnclear(resolvedLang)
                isBlackoutNow -> "СВІТЛА НЕМАЄ"
                else -> "СВІТЛО Є"
            }
            val statusColor = when {
                isUnclear -> Color(0xFF9CA3AF)
                isBlackoutNow -> Color(0xFFFF5E3A)
                else -> Color(0xFF34D399)
            }

            GlanceTheme {
                Box(
                    modifier = GlanceModifier
                        .fillMaxSize()
                        .cornerRadius(20.dp)
                        .background(ColorProvider(Color(0xCC141A29)))
                        .padding(12.dp)
                ) {
                    if (isBigWidget) {
                        val now = LocalTime.now(KYIV_ZONE)
                        val chartBitmap = renderAnalogCounterBitmap(slots, now.hour, now.minute, resolvedLang)

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
                                        text = queueHeaderText,
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

                            Spacer(modifier = GlanceModifier.height(6.dp))

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
                                        text = if (isBlackoutNow) "До увімкнення:" else "До відключення:",
                                        style = TextStyle(fontSize = 10.sp, color = ColorProvider(Color(0xB3BAE6FD)))
                                    )
                                    Text(
                                        text = countdownText,
                                        style = TextStyle(
                                            fontSize = 20.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = ColorProvider(Color.White)
                                        ),
                                        maxLines = 1
                                    )
                                }
                                Column(horizontalAlignment = Alignment.Horizontal.End) {
                                    Text(
                                        text = "Період",
                                        style = TextStyle(fontSize = 10.sp, color = ColorProvider(Color(0xB3BAE6FD)))
                                    )
                                    Text(
                                        text = nextSlotTime,
                                        style = TextStyle(
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = ColorProvider(Color.White)
                                        )
                                    )
                                }
                            }

                            Spacer(modifier = GlanceModifier.height(6.dp))

                            // 24-Hour Analog Electricity Counter (САЗУ-ИТ) Chart rendered via Bitmap
                            Image(
                                provider = ImageProvider(chartBitmap),
                                contentDescription = "24-годинний графік відключень",
                                contentScale = ContentScale.FillBounds,
                                modifier = GlanceModifier
                                    .fillMaxWidth()
                                    .height(52.dp)
                                    .clickable(actionStartActivity<MainActivity>())
                            )

                            // Upcoming Outage Interval ("Наступне відключення")
                            Spacer(modifier = GlanceModifier.height(4.dp))
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
                                    text = nextBlackoutText,
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
                                    text = queueHeaderText,
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
                                        text = if (isBlackoutNow) "До увімкнення:" else "До відключення:",
                                        style = TextStyle(fontSize = 10.sp, color = ColorProvider(Color(0xB3BAE6FD)))
                                    )
                                    Text(
                                        text = countdownText,
                                        style = TextStyle(
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = ColorProvider(Color.White)
                                        ),
                                        maxLines = 1
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

class BlackoutBigGlanceWidget : BlackoutGlanceWidget(forceBigLayout = true)

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
            AlarmScheduler.syncAlarms(appContext)
        } catch (_: Exception) {}
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
                if (current.queue.isNotBlank()) {
                    val res = ZtoeParser.fetchFullSchedule(current.cityUrl, current.queue, appContext, forceNetwork = true)
                    if (res.status == ua.blackout.prewarning.data.parser.FetchStatus.SUCCESS) {
                        scheduleRepo.saveSchedule(current.queue, res.todaySlots, res.tomorrowSlots)
                    } else {
                        scheduleRepo.clearScheduleCache()
                    }
                }
                AlarmScheduler.syncAlarms(appContext)
                BlackoutGlanceWidget.syncAllWidgets(appContext)
            } catch (_: Exception) {
                try {
                    scheduleRepo.clearScheduleCache()
                    AlarmScheduler.syncAlarms(appContext)
                    BlackoutGlanceWidget.syncAllWidgets(appContext)
                } catch (_: Exception) {}
            }
        }
    }
}