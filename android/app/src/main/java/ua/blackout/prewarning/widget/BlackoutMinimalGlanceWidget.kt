package ua.blackout.prewarning.widget

import android.content.Context
import android.os.Build
import android.widget.RemoteViews
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.datastore.preferences.core.Preferences
import androidx.glance.ColorFilter
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.AndroidRemoteViews
import androidx.glance.appwidget.CircularProgressIndicator
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.LocalAppWidgetOptions
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.state.GlanceStateDefinition
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import kotlinx.coroutines.CancellationException
import ua.blackout.prewarning.R
import ua.blackout.prewarning.data.repository.SettingsRepository
import ua.blackout.prewarning.ui.AppStrings

/**
 * Fourth widget (2x2, «Мінімальний»): the queue of the primary address, the status, the countdown to the
 * next outage or to power on, and the refresh button, on a 50 % transparent layer. It always follows the
 * primary address (no configuration screen) and draws from the same snapshot as the other widgets, so the
 * status and the countdown are identical. Text sizes follow the widget size so a resized widget stays filled.
 * With two or more saved addresses (Android 12+) it is an address stack like the other widgets (spec/SUBSCRIPTIONS.md
 * 10, owner 2026-11-18): one card per address, swiped up or down, with the refresh button above the front card.
 */
class BlackoutMinimalGlanceWidget : GlanceAppWidget() {

    override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

    /** One RemoteViews while an address stack can show, so its cards (a partial update) reach it (AddressStack.active). */
    override val sizeMode: SizeMode
        get() = if (AddressStack.active()) SizeMode.Single else SizeMode.Exact

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val appContext = context.applicationContext
        val appWidgetId = try {
            GlanceAppWidgetManager(appContext).getAppWidgetId(id)
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
            null
        }

        provideContent {
            val prefs = currentState<Preferences>()
            // Reading the tick subscribes this composition to the Glance state that syncAllWidgets bumps
            @Suppress("UNUSED_VARIABLE")
            val refreshTick = prefs[BlackoutGlanceWidget.KEY_REFRESH_TICK] ?: 0L
            val refreshingSince = prefs[BlackoutGlanceWidget.KEY_REFRESHING_SINCE] ?: 0L
            val isRefreshing = refreshingSince > 0L &&
                System.currentTimeMillis() - refreshingSince < BlackoutGlanceWidget.REFRESH_BUSY_MAX_MS

            // the app widget id of an address stack (never bound, so it follows the primary), null = one address
            val stackWidgetId = appWidgetId?.takeIf { AddressStack.supported && WidgetBindings.stackIds(appContext, it).size >= 2 }
            val options = LocalAppWidgetOptions.current
            // the cards are composed off the composition and land a moment later; until then the widget is as before
            val cards by produceState<List<Pair<String, RemoteViews>>?>(null, stackWidgetId, refreshTick, options) {
                value = stackWidgetId?.let {
                    try {
                        AddressStack.buildCards(appContext, it, AddressStack.Kind.MINIMAL, options)
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
                // one card over the whole widget and the refresh button above it, in the corner the card leaves empty
                val widget = AddressStack.widgetSize(appContext, options, AddressStack.Kind.MINIMAL)
                LaunchedEffect(ready) {
                    kotlinx.coroutines.delay(AddressStack.PUSH_DELAY_MS)
                    AddressStack.pushCards(appContext, stackWidgetId, ready, widget)
                }
                val lang = AppStrings.resolveLang(SettingsRepository(appContext).getSettings().language)
                Box(modifier = GlanceModifier.fillMaxSize()) {
                    AndroidRemoteViews(
                        remoteViews = AddressStack.frame(appContext),
                        modifier = GlanceModifier.fillMaxSize()
                    )
                    Box(
                        modifier = GlanceModifier.fillMaxSize().padding(12.dp),
                        contentAlignment = Alignment.TopEnd
                    ) {
                        RefreshButton(34.dp, isRefreshing, minimalRefreshDescription(lang))
                    }
                }
            } else {
                // null app widget id = follow the primary address
                MinimalBody(widgetSource(appContext, null), isRefreshing)
            }
        }
    }

    /** The widget content of the primary address (one address, or Android 8 to 11). */
    @androidx.compose.runtime.Composable
    private fun MinimalBody(source: WidgetSource, isRefreshing: Boolean) {
        val model = BlackoutGlanceWidget.buildWidgetModel(source.settings, source.snapshot)
        val openApp = openAppAction(source.itemId)
        val m = minimalWidgetTexts(model.lang, model.isUnclear, model.isOffNow, model.countdown)

        val statusColor = when {
            model.isUnclear -> Color(0xFF9CA3AF)
            model.isOffNow -> Color(0xFFFF5E3A)
            else -> Color(0xFF34D399)
        }

        val size = LocalSize.current
        val scale = (minOf(size.width.value, size.height.value) / BASE_DP).coerceIn(0.8f, 1.8f)
        val pad = 12f * scale
        val button = 34f * scale
        val innerWidth = size.width.value - 2 * pad
        val queueSp = fit(14f * scale, model.queueHeader, innerWidth - button - 6f, 0.6f)
        val statusSp = fit(20f * scale, m.status, innerWidth, 0.68f)
        val labelSp = m.label?.let { fit(12f * scale, it, innerWidth, 0.52f) } ?: 0f
        val countdownSp = m.countdown?.let { fit(22f * scale, it, innerWidth, 0.58f) } ?: 0f

        GlanceTheme {
            Column(
                modifier = GlanceModifier
                    .fillMaxSize()
                    .cornerRadius(20.dp)
                    .background(ColorProvider(Color(0x80141A29)))
                    .padding(pad.dp)
                    .clickable(openApp)
            ) {
                Row(
                    modifier = GlanceModifier.fillMaxWidth(),
                    verticalAlignment = Alignment.Vertical.CenterVertically
                ) {
                    Text(
                        text = model.queueHeader,
                        style = TextStyle(
                            fontWeight = FontWeight.Bold,
                            fontSize = queueSp.sp,
                            color = ColorProvider(Color.White)
                        ),
                        maxLines = 1,
                        modifier = GlanceModifier.defaultWeight()
                    )
                    RefreshButton(button.dp, isRefreshing, m.refreshDescription)
                }

                Column(
                    modifier = GlanceModifier.fillMaxWidth().defaultWeight(),
                    horizontalAlignment = Alignment.Horizontal.CenterHorizontally,
                    verticalAlignment = Alignment.Vertical.CenterVertically
                ) {
                    Text(
                        text = m.status,
                        style = TextStyle(
                            fontWeight = FontWeight.Bold,
                            fontSize = statusSp.sp,
                            color = ColorProvider(statusColor),
                            textAlign = TextAlign.Center
                        ),
                        maxLines = 1
                    )
                    if (m.label != null) {
                        Spacer(modifier = GlanceModifier.height((4f * scale).dp))
                        Text(
                            text = m.label,
                            style = TextStyle(
                                fontSize = labelSp.sp,
                                color = ColorProvider(Color(0xFFA9B4C2)),
                                textAlign = TextAlign.Center
                            ),
                            maxLines = 1
                        )
                    }
                    if (m.countdown != null) {
                        Text(
                            text = m.countdown,
                            style = TextStyle(
                                fontWeight = FontWeight.Bold,
                                fontSize = countdownSp.sp,
                                color = ColorProvider(Color.White),
                                textAlign = TextAlign.Center
                            ),
                            maxLines = 1
                        )
                    }
                }
            }
        }
    }

    @androidx.compose.runtime.Composable
    private fun RefreshButton(size: Dp, isRefreshing: Boolean, description: String) {
        Box(
            modifier = GlanceModifier
                .size(size)
                .cornerRadius(size / 2)
                .background(ColorProvider(Color(0x26FFFFFF)))
                .clickable(actionRunCallback<RefreshWidgetActionCallback>()),
            contentAlignment = Alignment.Center
        ) {
            val icon = size * 0.5f
            if (isRefreshing) {
                // Glance cannot rotate an image; the platform progress ring animates on its own
                CircularProgressIndicator(
                    color = ColorProvider(Color.White),
                    modifier = GlanceModifier.size(icon)
                )
            } else {
                Image(
                    provider = ImageProvider(R.drawable.ic_refresh),
                    contentDescription = description,
                    colorFilter = ColorFilter.tint(ColorProvider(Color.White)),
                    modifier = GlanceModifier.size(icon)
                )
            }
        }
    }

    private companion object {
        /** Widget side (dp) the base text sizes are designed for: a usual 2x2 launcher cell. */
        const val BASE_DP = 150f

        /** [base] sp, or smaller so [text] fits [widthDp] at about [emPerChar] em per character. */
        fun fit(base: Float, text: String, widthDp: Float, emPerChar: Float): Float {
            if (text.isEmpty() || widthDp <= 0f) return base
            return minOf(base, widthDp / (text.length * emPerChar))
        }
    }
}

/** The texts of the minimal widget; null [label] or [countdown] = that line is not drawn. */
internal data class MinimalWidgetTexts(
    val status: String,
    val label: String?,
    val countdown: String?,
    val refreshDescription: String
)

/**
 * Unclear: the status alone. No outage ahead while the power is on: «Відключень немає» instead of a
 * countdown of dashes. Otherwise the label and the countdown of the other widgets (`HHг. MMхв.`).
 */
internal fun minimalWidgetTexts(lang: String, isUnclear: Boolean, isOffNow: Boolean, countdown: String): MinimalWidgetTexts {
    val isUk = lang == "uk"
    val refresh = minimalRefreshDescription(lang)
    if (isUnclear) return MinimalWidgetTexts(AppStrings.powerUnclear(lang), null, null, refresh)
    val status = if (isOffNow) "СВІТЛА НЕМАЄ" else "СВІТЛО Є"
    if (!isOffNow && countdown.contains("--")) {
        return MinimalWidgetTexts(status, AppStrings.widgetNoOutages(lang), null, refresh)
    }
    val label = when {
        isOffNow -> if (isUk) "До увімкнення:" else "Power on in:"
        else -> if (isUk) "До відключення:" else "Time to blackout:"
    }
    return MinimalWidgetTexts(status, label, countdown, refresh)
}

/** The refresh button's description of the minimal widget (and of its address stack). */
internal fun minimalRefreshDescription(lang: String): String = if (lang == "uk") "Оновити дані" else "Refresh"
