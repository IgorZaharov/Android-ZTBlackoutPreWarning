package ua.blackout.prewarning.widget

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.os.Build
import android.widget.RemoteViews
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
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
import androidx.glance.action.Action
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.AndroidRemoteViews
import androidx.glance.appwidget.CircularProgressIndicator
import androidx.glance.appwidget.LocalAppWidgetOptions
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
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import ua.blackout.prewarning.MainActivity
import ua.blackout.prewarning.R
import ua.blackout.prewarning.core.OutageEngine
import ua.blackout.prewarning.data.KYIV_ZONE
import ua.blackout.prewarning.data.model.BlackoutSlot
import ua.blackout.prewarning.data.model.SlotStatus
import ua.blackout.prewarning.data.model.UserSettings
import ua.blackout.prewarning.data.repository.OutageRepository
import ua.blackout.prewarning.data.repository.OutageSnapshot
import ua.blackout.prewarning.data.repository.SettingsRepository
import ua.blackout.prewarning.notification.NotificationHelper
import ua.blackout.prewarning.data.repository.SubscriptionSync
import ua.blackout.prewarning.notification.AlarmScheduler
import ua.blackout.prewarning.ui.AppStrings
import java.time.Instant
import java.time.LocalDateTime

open class BlackoutGlanceWidget(private val forceBigLayout: Boolean = false) : GlanceAppWidget() {

    override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

    private val responsive = SizeMode.Responsive(
        setOf(
            DpSize(120.dp, 60.dp),   // 2x1 Small
            DpSize(250.dp, 110.dp),  // 4x2 Big
            DpSize(250.dp, 160.dp)   // 3x2 Big
        )
    )

    /** One RemoteViews on Android 12+, so address-stack cards (a partial update) reach it (AddressStack.sizeMode). */
    override val sizeMode: SizeMode = AddressStack.sizeMode(responsive)

    companion object {
        val KEY_NOTIFICATIONS_ENABLED = booleanPreferencesKey("glance_notifications_enabled")
        val KEY_QUEUE = stringPreferencesKey("glance_queue")
        val KEY_LANGUAGE = stringPreferencesKey("glance_language")
        /** Bumped on every redraw so Glance recomposes; the widget itself renders only live values. */
        val KEY_REFRESH_TICK = longPreferencesKey("glance_refresh_tick")
        /** When the widget refresh button started a refresh (0 = idle); older than [REFRESH_BUSY_MAX_MS] counts as idle. */
        val KEY_REFRESHING_SINCE = longPreferencesKey("glance_refreshing_since")
        /** A refresh killed with the process must not leave the ring spinning: 2 clients x 8 s timeouts, plus margin. */
        const val REFRESH_BUSY_MAX_MS = 30_000L

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

        /** Everything the two widget layouts show, derived from one [OutageSnapshot] (local state only). */
        internal data class WidgetModel(
            val lang: String,
            val queueHeader: String,
            val isUnclear: Boolean,
            val isOffNow: Boolean,
            val countdown: String,
            /** Current outage when off, otherwise the next one: full "HH:mm – HH:mm" (end may be past midnight). */
            val period: String,
            val nextOutage: String,
            /** The 48 half-hour cells of today (empty when unclear): the same states the main timeline draws. */
            val slots: List<BlackoutSlot>,
            val nowHour: Int,
            val nowMinute: Int,
            /** Small "data from HH:mm" caption when the cached schedule is shown because the site failed. */
            val staleCaption: String?,
            /** Address label of the shown item (`widgetLabel`, spec/SUBSCRIPTIONS.md 10); null keeps the 1.4.0 look. */
            val addressLabel: String? = null
        )

        private fun p2(n: Int) = n.toString().padStart(2, '0')

        internal fun buildWidgetModel(settings: UserSettings, snapshot: OutageSnapshot, addressLabel: String? = null): WidgetModel {
            val lang = AppStrings.resolveLang(settings.language)
            val now = snapshot.now
            val isNoQueueHouse = !settings.customQueueStatusText.isNullOrBlank()
            val queueHeader = when {
                isNoQueueHouse -> if (lang == "uk") "Черга відсутня" else "No queue"
                settings.queue.isBlank() -> if (lang == "uk") "Черга —" else "Queue —"
                else -> "Черга ${settings.queue}"
            }
            val notConfigured = settings.queue.isBlank() && !isNoQueueHouse && !snapshot.hasAddress
            if (notConfigured || snapshot.isUnclear) {
                return WidgetModel(
                    lang = lang,
                    queueHeader = queueHeader,
                    isUnclear = true,
                    isOffNow = false,
                    countdown = formatWidgetCountdown("--:--:--", lang),
                    period = "--:-- - --:--",
                    nextOutage = "--:-- - --:--",
                    slots = emptyList(),
                    nowHour = now.hour,
                    nowMinute = now.minute,
                    staleCaption = null,
                    addressLabel = addressLabel
                )
            }

            val st = snapshot.status()
            val period = if (!st.isOffNow && st.nextSpan == null) AppStrings.widgetNoOutages(lang) else st.nextSlotTime
            // The next outage after the current moment, from the same merged spans the countdown uses
            val next = OutageEngine.spans(snapshot.outages.filter { !it.stale }).firstOrNull { it.start.isAfter(now) }
            val nextText = when {
                next == null -> AppStrings.widgetNoMoreOutages(lang)
                next.start.toLocalDate() == snapshot.today -> OutageEngine.formatSpan(next)
                else -> "${AppStrings.widgetTomorrowPrefix(lang)} ${OutageEngine.formatSpan(next)}"
            }
            val staleCaption = if (snapshot.isStale) {
                snapshot.site?.lastSuccessMs?.let { ms ->
                    val t = LocalDateTime.ofInstant(Instant.ofEpochMilli(ms), KYIV_ZONE)
                    AppStrings.staleChip(lang, "${p2(t.hour)}:${p2(t.minute)}")
                }
            } else {
                null
            }
            return WidgetModel(
                lang = lang,
                queueHeader = queueHeader,
                isUnclear = false,
                isOffNow = st.isOffNow,
                countdown = formatWidgetCountdown(st.countdownText, lang),
                period = period,
                nextOutage = nextText,
                slots = snapshot.slotsFor(snapshot.today),
                nowHour = now.hour,
                nowMinute = now.minute,
                staleCaption = staleCaption,
                addressLabel = addressLabel
            )
        }

        /** 0 = power on, 1 = planned off, 2 = emergency only, 3 = emergency overlapping planned. */
        private fun cellKind(s: BlackoutSlot): Int = when {
            s.isEmergency && s.isPlanned -> 3
            s.isEmergency -> 2
            s.status == SlotStatus.POWER_OFF -> 1
            else -> 0
        }

        private const val STRIPE_PX = 8f

        @Volatile
        private var cachedChartBitmapKey: String? = null
        @Volatile
        private var cachedChartBitmap: Bitmap? = null

        suspend fun hasActiveWidgets(context: Context): Boolean {
            return try {
                val appCtx = context.applicationContext
                val manager = GlanceAppWidgetManager(appCtx)
                manager.getGlanceIds(BlackoutGlanceWidget::class.java).isNotEmpty() ||
                    manager.getGlanceIds(BlackoutBigGlanceWidget::class.java).isNotEmpty() ||
                    manager.getGlanceIds(BlackoutStripGlanceWidget::class.java).isNotEmpty() ||
                    manager.getGlanceIds(BlackoutMinimalGlanceWidget::class.java).isNotEmpty()
            } catch (_: Exception) {
                false
            }
        }

        /**
         * Redraws every placed widget. The widgets render from [OutageRepository.snapshot] at draw time,
         * so nothing computed here is persisted: this only bumps a tick that makes Glance recompose.
         */
        suspend fun syncAllWidgets(context: Context, refreshing: Boolean? = null) {
            val appCtx = context.applicationContext
            val manager = GlanceAppWidgetManager(appCtx)
            val smallIds = manager.getGlanceIds(BlackoutGlanceWidget::class.java)
            val bigIds = manager.getGlanceIds(BlackoutBigGlanceWidget::class.java)
            val stripIds = manager.getGlanceIds(BlackoutStripGlanceWidget::class.java)
            val minimalIds = manager.getGlanceIds(BlackoutMinimalGlanceWidget::class.java)
            if (smallIds.isEmpty() && bigIds.isEmpty() && stripIds.isEmpty() && minimalIds.isEmpty()) return

            val settings = SettingsRepository(appCtx).getSettings()
            val alertsMaster = SubscriptionSync(appCtx).master()
            val resolvedLang = AppStrings.resolveLang(settings.language)
            val nowMs = System.currentTimeMillis()

            suspend fun touch(gId: GlanceId) {
                updateAppWidgetState(appCtx, PreferencesGlanceStateDefinition, gId) { prefs ->
                    prefs.toMutablePreferences().apply {
                        this[KEY_NOTIFICATIONS_ENABLED] = alertsMaster
                        this[KEY_QUEUE] = settings.queue
                        this[KEY_LANGUAGE] = resolvedLang
                        this[KEY_REFRESH_TICK] = nowMs
                        if (refreshing != null) this[KEY_REFRESHING_SINCE] = if (refreshing) nowMs else 0L
                    }
                }
            }
            for (gId in smallIds) {
                try {
                    touch(gId)
                    BlackoutGlanceWidget().update(appCtx, gId)
                } catch (e: CancellationException) {
                    throw e
                } catch (_: Exception) {
                }
            }
            for (gId in bigIds) {
                try {
                    touch(gId)
                    BlackoutBigGlanceWidget().update(appCtx, gId)
                } catch (e: CancellationException) {
                    throw e
                } catch (_: Exception) {
                }
            }
            for (gId in stripIds) {
                try {
                    touch(gId)
                    BlackoutStripGlanceWidget().update(appCtx, gId)
                } catch (e: CancellationException) {
                    throw e
                } catch (_: Exception) {
                }
            }
            for (gId in minimalIds) {
                try {
                    touch(gId)
                    BlackoutMinimalGlanceWidget().update(appCtx, gId)
                } catch (e: CancellationException) {
                    throw e
                } catch (_: Exception) {
                }
            }
        }

        /**
         * Renders the 24-hour analog electricity counter (САЗУ-ИТ) chart as a high-DPI Bitmap
         * and caches it by (slotStatuses, currentH, currentM) to avoid redundant Bitmap allocations
         * and Canvas redraws within the same minute (e.g., when toggling the alert bell icon).
         */
        @Synchronized
        fun renderAnalogCounterBitmap(
            slots: List<BlackoutSlot>,
            currentH: Int,
            currentM: Int,
            lang: String = "uk",
            height: Int = 132
        ): Bitmap {
            val slotSignature = if (slots.isEmpty()) {
                "UNCLEAR"
            } else {
                buildString(slots.size) {
                    for (s in slots) {
                        append(cellKind(s))
                    }
                }
            }
            val bitmapKey = "${slotSignature}_${currentH}_${currentM}_${lang}_$height"
            val existingBmp = cachedChartBitmap
            if (cachedChartBitmapKey == bitmapKey && existingBmp != null && !existingBmp.isRecycled) {
                return existingBmp
            }

            val width = 720
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
            val contourBottom = height - 48f
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
            val trackBottom = height - 56f
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
                // Emergency overlay, same recipe as the main drum: the bottom half of the cell is amber with
                // dark 45 degree stripes; the top half keeps the planned state (spec/UI_DRUM.md 1).
                val trackMid = (trackTop + trackBottom) / 2f
                val amberShader = LinearGradient(
                    0f, trackMid, 0f, trackBottom,
                    intArrayOf(0xFFFFB020.toInt(), 0xFFF28A1B.toInt(), 0xFFC96A0B.toInt()),
                    floatArrayOf(0f, 0.5f, 1f),
                    Shader.TileMode.CLAMP
                )
                val stripePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    style = Paint.Style.STROKE
                    strokeWidth = STRIPE_PX
                }
                val bandH = trackBottom - trackMid
                val stripeStep = STRIPE_PX * 2f * 1.4142135f

                for (idx in 0 until 48) {
                    val kind = slots.getOrNull(idx)?.let { cellKind(it) } ?: 0
                    val hour = idx / 2
                    val hLeft = trackLeft + hour * (hourWidth + sepPx)
                    val left = if (idx % 2 == 0) hLeft else hLeft + halfWidth
                    val right = if (idx % 2 == 0) hLeft + halfWidth else hLeft + hourWidth

                    paint.shader = when (kind) {
                        1, 3 -> offShader
                        else -> onShader
                    }
                    canvas.drawRect(left, trackTop, right, trackBottom, paint)

                    if (kind >= 2) {
                        paint.shader = amberShader
                        canvas.drawRect(left, trackMid, right, trackBottom, paint)
                        stripePaint.color = 0x8C1A1208.toInt()
                        canvas.save()
                        canvas.clipRect(left, trackMid, right, trackBottom)
                        // Global phase (anchored at trackLeft) keeps the stripes continuous across cells
                        var n = Math.floor(((left - trackLeft) / stripeStep).toDouble()).toInt()
                        while (true) {
                            val u = trackLeft - bandH + n * stripeStep
                            if (u >= right) break
                            canvas.drawLine(u, trackBottom, u + bandH, trackMid, stripePaint)
                            n++
                        }
                        canvas.restore()
                    }
                }
                paint.shader = null
            }

            // 5. Bright yellow current-time needle (#FFE600) with a black outline, from above the dark-grey contour
            // down to the hour labels (owner, 2026-11-17: the black needle was hard to see; the 720 px bitmap is
            // about 2.5 px per dp on the home screen, so the 5 px outline is 2 dp)
            val fraction = ((currentH.coerceIn(0, 23) * 60 + currentM.coerceIn(0, 59)) / 1440f).coerceIn(0f, 1f)
            val needleX = trackLeft + trackWidth * fraction
            val needleTop = contourTop - 8f
            val needleBottom = height - 36f // just above the hour labels (baseline height - 16)

            val needleOutline = 5f
            paint.style = Paint.Style.FILL
            paint.color = 0xFF000000.toInt()
            canvas.drawRoundRect(
                RectF(needleX - 3f - needleOutline, needleTop - needleOutline, needleX + 3f + needleOutline, needleBottom + needleOutline),
                3f + needleOutline, 3f + needleOutline, paint
            )
            paint.color = 0xFFFFE600.toInt()
            canvas.drawRoundRect(
                RectF(needleX - 3f, needleTop, needleX + 3f, needleBottom),
                3f, 3f, paint
            )

            // 6. Stamped black (#1C1B18) hour markers every 3 hours: 00, 03, 06 ... 24 (owner, 2026-11-17)
            val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = 0xFF1C1B18.toInt()
                typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
                textSize = 21f + (height - 132) * 0.1f
            }
            val labels = (0..24 step 3).map { h -> h / 24f to h.toString().padStart(2, '0') }
            val textY = height - 16f
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
        // Which address this widget shows is looked up by its app widget id (spec/SUBSCRIPTIONS.md 10)
        val appWidgetId = try {
            GlanceAppWidgetManager(appContext).getAppWidgetId(id)
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
            null
        }

        // Drawing never touches the network and never wipes caches (C13/C14): the data is refreshed by the
        // worker, the widget receiver and the refresh button, and every value below is computed live.
        provideContent {
            val prefs = currentState<Preferences>()
            // Reading the tick subscribes this composition to the Glance state that syncAllWidgets bumps
            @Suppress("UNUSED_VARIABLE")
            val refreshTick = prefs[KEY_REFRESH_TICK] ?: 0L
            val refreshingSince = prefs[KEY_REFRESHING_SINCE] ?: 0L
            val isRefreshing = refreshingSince > 0L && System.currentTimeMillis() - refreshingSince < REFRESH_BUSY_MAX_MS
            val source = widgetSource(appContext, appWidgetId)
            val model = buildWidgetModel(source.settings, source.snapshot, source.label)
            // the bell shows and toggles the master switch for all addresses (owner decision 4)
            val notificationsEnabled = SubscriptionSync(appContext).master()

            val kind = if (forceBigLayout) AddressStack.Kind.BIG else AddressStack.Kind.SMALL
            val size = AddressStack.layoutSize(appContext, kind)
            // Android 12+ lays out for the launcher's size; the big layout from the size of the 4x2 bucket of `responsive`
            val isBigWidget = forceBigLayout || if (AddressStack.supported) {
                size.width >= 250.dp && size.height >= 110.dp
            } else {
                size.height >= 110.dp || size.width >= 220.dp
            }
            // the app widget id of an address stack (spec/SUBSCRIPTIONS.md 10), null when this widget shows one address
            val stackWidgetId = appWidgetId?.takeIf { AddressStack.supported && WidgetBindings.stackIds(appContext, it).size >= 2 }
            val options = LocalAppWidgetOptions.current
            // the cards are composed off the composition and land a moment later; until then the widget is as before
            val cards by produceState<List<Pair<String, RemoteViews>>?>(null, stackWidgetId, refreshTick, options, notificationsEnabled) {
                value = stackWidgetId?.let {
                    try {
                        AddressStack.buildCards(appContext, it, kind, options)
                    } catch (e: CancellationException) {
                        throw e
                    } catch (e: Exception) {
                        android.util.Log.w("AddressStack", "cards not built: widget $it", e)
                        null
                    }
                }
            }
            val ready = cards

            if (stackWidgetId != null && !ready.isNullOrEmpty() && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                // Address stack (spec/SUBSCRIPTIONS.md 10): one card over the whole widget, and above it the buttons in
                // the corner the card leaves empty; the cards follow this frame as a partial update (see AddressStack)
                val widget = AddressStack.widgetSize(appContext, options, kind)
                LaunchedEffect(ready) {
                    kotlinx.coroutines.delay(AddressStack.PUSH_DELAY_MS)
                    AddressStack.pushCards(appContext, stackWidgetId, ready, widget)
                }
                Box(modifier = GlanceModifier.fillMaxSize()) {
                    AndroidRemoteViews(
                        remoteViews = AddressStack.frame(appContext),
                        modifier = GlanceModifier.fillMaxSize()
                    )
                    StackButtons(isBigWidget, notificationsEnabled, isRefreshing)
                }
            } else {
                WidgetBody(model, isBigWidget, notificationsEnabled, isRefreshing, openAppAction(source.itemId))
            }
        }
    }
}

private fun GlanceModifier.clickableIf(action: Action?): GlanceModifier = if (action != null) clickable(action) else this

/** The 2x1 and 4x2 widget content of one address ([BlackoutGlanceWidget]). */
@Composable
internal fun WidgetBody(
    model: BlackoutGlanceWidget.Companion.WidgetModel,
    isBigWidget: Boolean,
    notificationsEnabled: Boolean,
    isRefreshing: Boolean,
    openApp: Action?
) {
    fun ink(c: Color): ColorProvider = ColorProvider(c)
    val open = openApp

    val resolvedLang = model.lang
    val isUnclear = model.isUnclear
    val isBlackoutNow = model.isOffNow
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
                .background(ink(Color(0xCC141A29)))
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
                        Column(modifier = GlanceModifier.defaultWeight().clickableIf(open)) {
                            Row(verticalAlignment = Alignment.Vertical.CenterVertically) {
                                Text(
                                    text = model.queueHeader,
                                    style = TextStyle(fontWeight = FontWeight.Bold, fontSize = 16.sp, color = ink(Color.White)),
                                    maxLines = 1
                                )
                                if (model.addressLabel != null) {
                                    Spacer(modifier = GlanceModifier.width(6.dp))
                                    Text(
                                        text = model.addressLabel,
                                        style = TextStyle(fontSize = 11.sp, color = ink(Color(0xB3BAE6FD))),
                                        maxLines = 1
                                    )
                                }
                            }
                            Row(verticalAlignment = Alignment.Vertical.CenterVertically) {
                                Text(
                                    text = statusText,
                                    style = TextStyle(fontWeight = FontWeight.Bold, fontSize = 11.sp, color = ink(statusColor))
                                )
                                if (model.staleCaption != null) {
                                    Spacer(modifier = GlanceModifier.width(6.dp))
                                    Text(
                                        text = model.staleCaption,
                                        style = TextStyle(fontSize = 9.sp, color = ink(Color(0xFFFFB020))),
                                        maxLines = 1
                                    )
                                }
                            }
                        }
                        RefreshButton(36.dp, 18.dp, isRefreshing)
                        Spacer(modifier = GlanceModifier.width(8.dp))
                        BellButton(36.dp, 20.dp, notificationsEnabled)
                    }

                    Spacer(modifier = GlanceModifier.height(6.dp))

                    // Countdown Card Row (clickable to open app)
                    Row(
                        modifier = GlanceModifier
                            .fillMaxWidth()
                            .cornerRadius(12.dp)
                            .background(ink(Color(0x33000000)))
                            .padding(horizontal = 10.dp, vertical = 6.dp)
                            .clickableIf(open),
                        verticalAlignment = Alignment.Vertical.CenterVertically
                    ) {
                        Column(modifier = GlanceModifier.defaultWeight()) {
                            Text(
                                text = if (isBlackoutNow) "До увімкнення:" else "До відключення:",
                                style = TextStyle(fontSize = 10.sp, color = ink(Color(0xB3BAE6FD)))
                            )
                            Text(
                                text = model.countdown,
                                style = TextStyle(fontSize = 20.sp, fontWeight = FontWeight.Bold, color = ink(Color.White)),
                                maxLines = 1
                            )
                        }
                        Column(horizontalAlignment = Alignment.Horizontal.End) {
                            Text(
                                text = "Період",
                                style = TextStyle(fontSize = 10.sp, color = ink(Color(0xB3BAE6FD)))
                            )
                            Text(
                                text = model.period,
                                style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Bold, color = ink(Color.White))
                            )
                        }
                    }

                    Spacer(modifier = GlanceModifier.height(6.dp))

                    // 24-Hour Analog Electricity Counter (САЗУ-ИТ) Chart rendered via Bitmap
                    val chartBitmap = BlackoutGlanceWidget.renderAnalogCounterBitmap(
                        model.slots, model.nowHour, model.nowMinute, resolvedLang
                    )
                    Image(
                        provider = ImageProvider(chartBitmap),
                        contentDescription = "24-годинний графік відключень",
                        contentScale = ContentScale.FillBounds,
                        modifier = GlanceModifier.fillMaxWidth().height(52.dp).clickableIf(open)
                    )

                    // Upcoming Outage Interval ("Наступне відключення")
                    Spacer(modifier = GlanceModifier.height(4.dp))
                    Row(
                        modifier = GlanceModifier
                            .fillMaxWidth()
                            .cornerRadius(8.dp)
                            .background(ink(Color(0x26000000)))
                            .padding(horizontal = 8.dp, vertical = 3.dp)
                            .clickableIf(open),
                        verticalAlignment = Alignment.Vertical.CenterVertically
                    ) {
                        Text(
                            text = model.nextOutage,
                            style = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.Bold, color = ink(Color.White))
                        )
                        Spacer(modifier = GlanceModifier.defaultWeight())
                        Text(
                            text = "Наступне відключення",
                            style = TextStyle(fontSize = 10.sp, color = ink(Color(0xFFFF5E3A)))
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
                            text = model.queueHeader,
                            style = TextStyle(fontWeight = FontWeight.Bold, fontSize = 14.sp, color = ink(Color.White)),
                            maxLines = 1,
                            modifier = GlanceModifier.clickableIf(open)
                        )
                        if (model.addressLabel != null) {
                            Spacer(modifier = GlanceModifier.width(6.dp))
                            Text(
                                text = model.addressLabel,
                                style = TextStyle(fontSize = 10.sp, color = ink(Color(0xB3BAE6FD))),
                                maxLines = 1,
                                modifier = GlanceModifier.defaultWeight().clickableIf(open)
                            )
                            Spacer(modifier = GlanceModifier.width(6.dp))
                        } else {
                            Spacer(modifier = GlanceModifier.defaultWeight())
                        }
                        Text(
                            text = statusText,
                            style = TextStyle(fontWeight = FontWeight.Bold, fontSize = 10.sp, color = ink(statusColor)),
                            modifier = GlanceModifier.clickableIf(open)
                        )
                    }

                    Spacer(modifier = GlanceModifier.height(4.dp))

                    // Bottom Row: Countdown + Round Refresh Button + Round Notification Toggle Button
                    Row(
                        modifier = GlanceModifier.fillMaxWidth(),
                        verticalAlignment = Alignment.Vertical.CenterVertically
                    ) {
                        Column(modifier = GlanceModifier.defaultWeight().clickableIf(open)) {
                            Text(
                                text = if (isBlackoutNow) "До увімкнення:" else "До відключення:",
                                style = TextStyle(fontSize = 10.sp, color = ink(Color(0xB3BAE6FD)))
                            )
                            Text(
                                text = model.countdown,
                                style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Bold, color = ink(Color.White)),
                                maxLines = 1
                            )
                        }
                        RefreshButton(34.dp, 16.dp, isRefreshing)
                        Spacer(modifier = GlanceModifier.width(6.dp))
                        BellButton(34.dp, 18.dp, notificationsEnabled)
                    }
                }
            }
        }
    }
}

/**
 * The refresh and bell buttons of an address stack, above the front card (see [AddressStack]): in the corner each
 * card leaves empty: top right on the 4x2 card, 12 dp from the corner; bottom right on the 2x1 card, 12 dp from the
 * right and 8 dp from the bottom (the card's padding, widget_card_small.xml).
 */
@Composable
internal fun StackButtons(isBigWidget: Boolean, notificationsEnabled: Boolean, isRefreshing: Boolean) {
    Box(
        modifier = GlanceModifier.fillMaxSize()
            .padding(start = 12.dp, top = 12.dp, end = 12.dp, bottom = if (isBigWidget) 12.dp else 8.dp),
        contentAlignment = if (isBigWidget) Alignment.TopEnd else Alignment.BottomEnd
    ) {
        Row(verticalAlignment = Alignment.Vertical.CenterVertically) {
            if (isBigWidget) {
                RefreshButton(36.dp, 18.dp, isRefreshing)
                Spacer(modifier = GlanceModifier.width(8.dp))
                BellButton(36.dp, 20.dp, notificationsEnabled)
            } else {
                RefreshButton(34.dp, 16.dp, isRefreshing)
                Spacer(modifier = GlanceModifier.width(6.dp))
                BellButton(34.dp, 18.dp, notificationsEnabled)
            }
        }
    }
}

/** Round refresh button (same style as the notification toggle). */
@Composable
private fun RefreshButton(boxSize: Dp, iconSize: Dp, isRefreshing: Boolean) {
    Box(
        modifier = GlanceModifier
            .size(boxSize)
            .cornerRadius(boxSize / 2)
            .background(ColorProvider(Color(0x26FFFFFF)))
            .clickable(actionRunCallback<RefreshWidgetActionCallback>()),
        contentAlignment = Alignment.Center
    ) {
        if (isRefreshing) {
            // Glance cannot rotate an image; the platform progress ring animates on its own
            CircularProgressIndicator(color = ColorProvider(Color.White), modifier = GlanceModifier.size(iconSize))
        } else {
            Image(
                provider = ImageProvider(R.drawable.ic_refresh),
                contentDescription = "Оновити дані",
                colorFilter = ColorFilter.tint(ColorProvider(Color.White)),
                modifier = GlanceModifier.size(iconSize)
            )
        }
    }
}

/** Round notification toggle (the master switch for all addresses, owner decision 4). */
@Composable
private fun BellButton(boxSize: Dp, iconSize: Dp, notificationsEnabled: Boolean) {
    Box(
        modifier = GlanceModifier
            .size(boxSize)
            .cornerRadius(boxSize / 2)
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
            modifier = GlanceModifier.size(iconSize)
        )
    }
}

class BlackoutBigGlanceWidget : BlackoutGlanceWidget(forceBigLayout = true)

private val OPEN_SUBSCRIPTION = ActionParameters.Key<String>(NotificationHelper.EXTRA_SUBSCRIPTION_ID)

/** A tap opens the main screen with the widget's address shown (spec/SUBSCRIPTIONS.md 9 and 10). */
internal fun openAppAction(itemId: String?): Action =
    if (itemId == null) actionStartActivity<MainActivity>()
    else actionStartActivity<MainActivity>(actionParametersOf(OPEN_SUBSCRIPTION to itemId))

/**
 * Third widget (4x1): the 24-hour drum chart with the current-time needle, no buttons or switches; a tap
 * opens the app. It draws from the same snapshot as the other two widgets, so the 48 half-hour states
 * (including the emergency stripes) are identical. When the launcher cell is at least [INFO_MIN_HEIGHT]
 * tall (a usual portrait row is about 100 dp) one line with the queue, status and countdown sits above it.
 */
class BlackoutStripGlanceWidget : GlanceAppWidget() {

    override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

    private val responsive = SizeMode.Responsive(
        setOf(
            DpSize(250.dp, 40.dp),              // drum only
            DpSize(250.dp, INFO_MIN_HEIGHT)     // info line + drum
        )
    )

    /** One RemoteViews on Android 12+, so address-stack cards (a partial update) reach it (AddressStack.sizeMode). */
    override val sizeMode: SizeMode = AddressStack.sizeMode(responsive)

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val appContext = context.applicationContext
        // Which address this widget shows is looked up by its app widget id (spec/SUBSCRIPTIONS.md 10)
        val appWidgetId = try {
            GlanceAppWidgetManager(appContext).getAppWidgetId(id)
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
            null
        }

        provideContent {
            val prefs = currentState<Preferences>()
            @Suppress("UNUSED_VARIABLE")
            val refreshTick = prefs[BlackoutGlanceWidget.KEY_REFRESH_TICK] ?: 0L
            // the app widget id of an address stack (spec/SUBSCRIPTIONS.md 10), null when this widget shows one address
            val stackWidgetId = appWidgetId?.takeIf { AddressStack.supported && WidgetBindings.stackIds(appContext, it).size >= 2 }
            val options = LocalAppWidgetOptions.current
            val cards by produceState<List<Pair<String, RemoteViews>>?>(null, stackWidgetId, refreshTick, options) {
                value = stackWidgetId?.let { AddressStack.buildCards(appContext, it, AddressStack.Kind.STRIP, options) }
            }
            val ready = cards
            if (stackWidgetId != null && !ready.isNullOrEmpty() && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                // Address stack (spec/SUBSCRIPTIONS.md 10): this widget has no buttons, so the cards are all of it;
                // they follow this frame as a partial update (see AddressStack)
                LaunchedEffect(ready) {
                    kotlinx.coroutines.delay(AddressStack.PUSH_DELAY_MS)
                    AddressStack.pushCards(appContext, stackWidgetId, ready, AddressStack.widgetSize(appContext, options, AddressStack.Kind.STRIP))
                }
                AndroidRemoteViews(
                    remoteViews = AddressStack.frame(appContext),
                    modifier = GlanceModifier.fillMaxSize()
                )
            } else {
                val source = widgetSource(appContext, appWidgetId)
                val model = BlackoutGlanceWidget.buildWidgetModel(source.settings, source.snapshot, source.label)
                val size = AddressStack.layoutSize(appContext, AddressStack.Kind.STRIP)
                StripBody(model, openAppAction(source.itemId), showInfo = size.height >= INFO_MIN_HEIGHT)
            }
        }
    }

    companion object {
        /** Drum height of the big widget, so both widgets show the drum at the same size. */
        internal val DRUM_HEIGHT = 52.dp
        /** Smallest widget height with room for the info line: 52 drum + 12 padding + 4 gap + 16 line. */
        internal val INFO_MIN_HEIGHT = 84.dp
    }
}

/** The «Графік» widget content of one address: the info line (when there is room) and the drum. */
@Composable
internal fun StripBody(
    model: BlackoutGlanceWidget.Companion.WidgetModel,
    openApp: Action?,
    showInfo: Boolean
) {
    // Same bitmap as the big widget's drum (720 x 132), drawn at the same 52 dp height
    val chartBitmap = BlackoutGlanceWidget.renderAnalogCounterBitmap(
        model.slots, model.nowHour, model.nowMinute, model.lang
    )
    val statusText = when {
        model.isUnclear -> AppStrings.powerUnclear(model.lang)
        model.isOffNow -> "СВІТЛА НЕМАЄ"
        else -> "СВІТЛО Є"
    }
    val statusColor = when {
        model.isUnclear -> Color(0xFF9CA3AF)
        model.isOffNow -> Color(0xFFFF5E3A)
        else -> Color(0xFF34D399)
    }
    val description = if (model.isUnclear) {
        AppStrings.outagesUnclear(model.lang)
    } else {
        "${model.queueHeader}. ${if (model.isOffNow) "СВІТЛА НЕМАЄ" else "СВІТЛО Є"}"
    }

    GlanceTheme {
        Column(
            modifier = GlanceModifier
                .fillMaxSize()
                .cornerRadius(20.dp)
                .background(ColorProvider(Color(0xCC141A29)))
                .padding(6.dp)
                .clickableIf(openApp),
            verticalAlignment = Alignment.Vertical.CenterVertically
        ) {
            if (showInfo) {
                Row(
                    modifier = GlanceModifier.fillMaxWidth().padding(horizontal = 6.dp),
                    verticalAlignment = Alignment.Vertical.CenterVertically
                ) {
                    Text(
                        text = model.queueHeader,
                        style = TextStyle(
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                            color = ColorProvider(Color.White)
                        ),
                        maxLines = 1
                    )
                    Spacer(modifier = GlanceModifier.width(6.dp))
                    if (model.addressLabel != null) {
                        Text(
                            text = model.addressLabel,
                            style = TextStyle(fontSize = 10.sp, color = ColorProvider(Color(0xB3BAE6FD))),
                            maxLines = 1,
                            modifier = GlanceModifier.defaultWeight()
                        )
                        Spacer(modifier = GlanceModifier.width(6.dp))
                    }
                    Text(
                        text = statusText,
                        style = TextStyle(
                            fontWeight = FontWeight.Bold,
                            fontSize = 10.sp,
                            color = ColorProvider(statusColor)
                        ),
                        maxLines = 1,
                        modifier = if (model.addressLabel == null) GlanceModifier.defaultWeight() else GlanceModifier
                    )
                    if (model.addressLabel != null && !model.isUnclear) Spacer(modifier = GlanceModifier.width(6.dp))
                    if (!model.isUnclear) {
                        Text(
                            text = model.countdown,
                            style = TextStyle(
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp,
                                color = ColorProvider(Color.White)
                            ),
                            maxLines = 1
                        )
                    }
                }
                Spacer(modifier = GlanceModifier.height(4.dp))
            }
            Image(
                provider = ImageProvider(chartBitmap),
                contentDescription = description,
                contentScale = ContentScale.FillBounds,
                modifier = GlanceModifier
                    .fillMaxWidth()
                    .height(BlackoutStripGlanceWidget.DRUM_HEIGHT)
            )
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
        // The widget bell is the master switch for all addresses (multi-address owner decision 4)
        val sync = SubscriptionSync(appContext)
        sync.setMaster(!sync.master())
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
        // Show the progress ring on the refresh buttons while the refresh runs
        try {
            BlackoutGlanceWidget.syncAllWidgets(appContext, refreshing = true)
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
        }
        // Network refresh on IO through the one shared pipeline. A failed source keeps its previous data
        // (nothing is cleared); each call is bounded by the connection timeouts of the clients (8 s).
        try {
            withContext(Dispatchers.IO) {
                val settings = SettingsRepository(appContext).getSettings()
                OutageRepository(appContext).refresh(settings, forceNetwork = true)
            }
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
        }
        // Whatever happened, re-plan alarms and redraw from what is stored now
        try {
            AlarmScheduler.syncAlarms(appContext)
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
        }
        try {
            BlackoutGlanceWidget.syncAllWidgets(appContext, refreshing = false)
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
        }
    }
}