package ua.blackout.prewarning.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.drawable.Icon
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.util.SizeF
import android.util.TypedValue
import android.view.View
import android.widget.RemoteViews
import androidx.annotation.RequiresApi
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import ua.blackout.prewarning.MainActivity
import ua.blackout.prewarning.R
import ua.blackout.prewarning.data.repository.SubscriptionSync
import ua.blackout.prewarning.notification.NotificationHelper
import ua.blackout.prewarning.ui.AppStrings
import java.io.ByteArrayOutputStream

/**
 * Android address stack (spec/SUBSCRIPTIONS.md section 10, owner 2026-11-18): a widget that follows the primary
 * shows every saved address as a card of a platform [android.widget.StackView]; swiping up or down flips to the
 * next card with the stack animation. Only the front card is seen, exactly over the widget and with the widget's
 * glass; [pushCards] sizes the stack so the cards behind lie outside the widget's bounds. Android 12 and later.
 *
 * How it reaches the launcher (each step was needed on a real device, Xiaomi, Android 12):
 * - Glance draws the frame with an empty StackView ([frame]). The cards follow as a partial widget update
 *   ([pushCards]) with inline [RemoteViews.RemoteCollectionItems]: the platform accepts a collection adapter only
 *   when it is applied from the widget root ("setRemoteAdapter can only be used for AppWidgets"), and Glance nests
 *   every view it is given; a partial update is applied from the root and finds the stack by its id.
 * - While a stack can show, the widgets draw with SizeMode.Single ([active]): a responsive widget is one
 *   RemoteViews per size, and a partial update merged into that outer container is never applied.
 * - The cards are plain XML layouts (widget_card_big / _small / _strip / _minimal) filled from the widget model: content
 *   composed by Glance came out empty inside a stack item.
 * - Each drum goes as compressed PNG data ([Icon]), so five cards stay far below the binder limit of one update.
 *
 * Cards can not carry buttons (collection items take one fill-in click), so the Glance frame draws the bell and
 * refresh buttons above the card ([StackButtons]) in the corner each card leaves empty; a tap on a card opens the
 * app on its address through the stack's pending-intent template.
 */
object AddressStack {
    /** StackView pads each card frame by 4 dp on every side (AOSP StackView FRAME_PADDING). */

    /**
     * The stack is this many times a card frame. The card right behind the front one is shifted by a third of the
     * free space (index 2 of the 3 positions in front of the hidden ones), so 4 puts it a full card away.
     */
    private const val STACK_SCALE = 4f
    private const val FRAME_PADDING_DP = 4f

    /** Glance waits this long before the cards follow its update, so they land on the frame it just drew. */
    const val PUSH_DELAY_MS = 600L

    private const val TAG = "AddressStack"

    /** Inline collection items need Android 12; older versions keep one address per widget. */
    val supported: Boolean get() = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S

    @Volatile
    private var appContext: Context? = null

    /** Keeps the application context for [active], which Glance asks without one. */
    fun remember(context: Context) {
        appContext = context.applicationContext
    }

    /** True while a stack can show (Android 12+, two or more saved addresses): the widgets then use SizeMode.Single. */
    fun active(): Boolean {
        val ctx = appContext ?: return false
        return supported && try {
            SubscriptionSync(ctx).store().items.size >= 2
        } catch (_: Exception) {
            false
        }
    }

    enum class Kind { SMALL, BIG, STRIP, MINIMAL }

    /**
     * The widget's size in dp in the current orientation, or a default per kind when unknown. Android 12+ launchers
     * list the exact size per orientation (OPTION_APPWIDGET_SIZES): portrait is the narrowest entry, landscape the
     * widest. Otherwise the portrait size is min width x max height and the landscape one max width x min height. A
     * card taller than the widget is cut at the bottom, so the exact size matters (owner report 2026-11-18, 2x1).
     */
    fun widgetSize(context: Context, options: Bundle?, kind: Kind): DpSize {
        val landscape = context.resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            @Suppress("DEPRECATION")
            val sizes = options?.getParcelableArrayList<SizeF>(AppWidgetManager.OPTION_APPWIDGET_SIZES)
                ?.filter { it.width > 0f && it.height > 0f }
            if (!sizes.isNullOrEmpty()) {
                val s = if (landscape) sizes.maxBy { it.width } else sizes.minBy { it.width }
                return DpSize(s.width.dp, s.height.dp)
            }
        }
        fun opt(key: String) = options?.getInt(key, 0) ?: 0
        val w = opt(if (landscape) AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH else AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH)
        val h = opt(if (landscape) AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT else AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT)
        if (w > 0 && h > 0) return DpSize(w.dp, h.dp)
        return when (kind) {
            Kind.SMALL -> DpSize(120.dp, 60.dp)
            Kind.BIG -> DpSize(250.dp, 110.dp)
            Kind.STRIP -> DpSize(250.dp, 40.dp)
            Kind.MINIMAL -> DpSize(150.dp, 150.dp)
        }
    }

    /** The empty StackView that Glance draws; the cards arrive with [pushCards]. */
    fun frame(context: Context): RemoteViews = RemoteViews(context.applicationContext.packageName, R.layout.widget_address_stack)

    /** One filled card per address of the stack, as (subscription id, card); local state only. */
    suspend fun buildCards(context: Context, appWidgetId: Int, kind: Kind, options: Bundle?): List<Pair<String, RemoteViews>> =
        withContext(Dispatchers.IO) {
            val appCtx = context.applicationContext
            val ids = WidgetBindings.stackIds(appCtx, appWidgetId)
            if (ids.size < 2) return@withContext emptyList()
            val widget = widgetSize(appCtx, options, kind)
            ids.map { id ->
                val source = widgetSourceForItem(appCtx, id)
                val model = BlackoutGlanceWidget.buildWidgetModel(source.settings, source.snapshot, source.label)
                id to card(appCtx, id, model, kind, widget, showInfo = widget.height >= BlackoutStripGlanceWidget.INFO_MIN_HEIGHT)
            }
        }

    /**
     * Sends [cards] and the tap template to the stack of [appWidgetId] as a partial update (applied from the root),
     * and sizes the stack for a [widget] of that size so only the front card shows (see [STACK_SCALE]).
     */
    @RequiresApi(Build.VERSION_CODES.S)
    fun pushCards(context: Context, appWidgetId: Int, cards: List<Pair<String, RemoteViews>>, widget: DpSize) {
        try {
            val rv = adapterViews(context, appWidgetId, cards)
            // Each card (exactly the widget's size) sits in a frame with FRAME_PADDING on every side. When the frames
            // are smaller than the stack's room for them, StackView spreads the cards behind over the free space:
            // with a stack STACK_SCALE times the frame, the card behind lands a whole widget up and to the right,
            // outside the widget's bounds, so it is clipped and a translucent card shows nothing behind it. The
            // stack is moved up so the front frame (bottom left) puts its card exactly on the widget.
            val pad = FRAME_PADDING_DP
            val frameW = widget.width.value + 2 * pad
            val frameH = widget.height.value + 2 * pad
            val stackW = frameW * STACK_SCALE
            val stackH = frameH * STACK_SCALE
            val dip = TypedValue.COMPLEX_UNIT_DIP
            rv.setViewLayoutWidth(R.id.address_stack, stackW, dip)
            rv.setViewLayoutHeight(R.id.address_stack, stackH, dip)
            rv.setViewLayoutMargin(R.id.address_stack, RemoteViews.MARGIN_LEFT, -pad, dip)
            rv.setViewLayoutMargin(R.id.address_stack, RemoteViews.MARGIN_TOP, -(stackH - frameH) - pad, dip)
            AppWidgetManager.getInstance(context.applicationContext).partiallyUpdateAppWidget(appWidgetId, rv)
        } catch (e: Exception) {
            Log.w(TAG, "cards not sent: widget $appWidgetId", e)
        }
    }

    /** The StackView of [appWidgetId] with [cards] inline and the tap template (opens the app on a card's address). */
    @RequiresApi(Build.VERSION_CODES.S)
    private fun adapterViews(context: Context, appWidgetId: Int, cards: List<Pair<String, RemoteViews>>): RemoteViews {
        val appCtx = context.applicationContext
        val items = RemoteViews.RemoteCollectionItems.Builder()
            .setHasStableIds(true)
            // fixed and covering the four card layouts: the launcher reuses its adapter (and the front card)
            .setViewTypeCount(4)
        for ((id, card) in cards) items.addItem(id.hashCode().toLong(), card)
        val rv = RemoteViews(appCtx.packageName, R.layout.widget_address_stack)
        rv.setRemoteAdapter(R.id.address_stack, items.build())
        val open = Intent(appCtx, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        // mutable: each card fills in its subscription id
        val template = PendingIntent.getActivity(
            appCtx, appWidgetId, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )
        rv.setPendingIntentTemplate(R.id.address_stack, template)
        return rv
    }

    /** One card: the widget's content of [model] in the layout of [kind], with the texts of the Glance widget. */
    private fun card(
        context: Context,
        id: String,
        model: BlackoutGlanceWidget.Companion.WidgetModel,
        kind: Kind,
        widget: DpSize,
        showInfo: Boolean
    ): RemoteViews {
        val layout = when (kind) {
            Kind.BIG -> R.layout.widget_card_big
            Kind.SMALL -> R.layout.widget_card_small
            Kind.STRIP -> R.layout.widget_card_strip
            Kind.MINIMAL -> R.layout.widget_card_minimal
        }
        val rv = RemoteViews(context.packageName, layout)
        val status = when {
            model.isUnclear -> AppStrings.powerUnclear(model.lang)
            model.isOffNow -> "СВІТЛА НЕМАЄ"
            else -> "СВІТЛО Є"
        }
        val statusColor = when {
            model.isUnclear -> 0xFF9CA3AF.toInt()
            model.isOffNow -> 0xFFFF5E3A.toInt()
            else -> 0xFF34D399.toInt()
        }
        rv.setTextViewText(R.id.card_queue, model.queueHeader)
        rv.setTextViewText(R.id.card_label, model.addressLabel.orEmpty())
        rv.setTextViewText(R.id.card_status, status)
        rv.setTextColor(R.id.card_status, statusColor)
        rv.setTextViewText(R.id.card_countdown, model.countdown)
        val untilCaption = if (model.isOffNow) "До увімкнення:" else "До відключення:"
        when (kind) {
            Kind.BIG -> {
                rv.setViewVisibility(R.id.card_label, if (model.addressLabel == null) View.GONE else View.VISIBLE)
                rv.setTextViewText(R.id.card_stale, model.staleCaption.orEmpty())
                rv.setViewVisibility(R.id.card_stale, if (model.staleCaption == null) View.GONE else View.VISIBLE)
                rv.setTextViewText(R.id.card_countdown_caption, untilCaption)
                rv.setTextViewText(R.id.card_period_caption, "Період")
                rv.setTextViewText(R.id.card_period, model.period)
                rv.setTextViewText(R.id.card_next, model.nextOutage)
                rv.setTextViewText(R.id.card_next_caption, "Наступне відключення")
                setDrum(rv, model, "24-годинний графік відключень")
            }
            Kind.SMALL -> {
                rv.setViewVisibility(R.id.card_label, if (model.addressLabel == null) View.GONE else View.VISIBLE)
                rv.setTextViewText(R.id.card_countdown_caption, untilCaption)
            }
            Kind.STRIP -> {
                rv.setViewVisibility(R.id.card_info, if (showInfo) View.VISIBLE else View.GONE)
                rv.setViewVisibility(R.id.card_countdown, if (model.isUnclear) View.GONE else View.VISIBLE)
                val description = if (model.isUnclear) {
                    AppStrings.outagesUnclear(model.lang)
                } else {
                    "${model.queueHeader}. ${if (model.isOffNow) "СВІТЛА НЕМАЄ" else "СВІТЛО Є"}"
                }
                setDrum(rv, model, description)
            }
            Kind.MINIMAL -> {
                // the texts of the minimal widget (unclear: the status alone; no outage ahead: «Відключень немає»)
                val m = minimalWidgetTexts(model.lang, model.isUnclear, model.isOffNow, model.countdown)
                rv.setTextViewText(R.id.card_status, m.status)
                rv.setViewVisibility(R.id.card_label, if (model.addressLabel == null) View.GONE else View.VISIBLE)
                rv.setTextViewText(R.id.card_countdown_caption, m.label.orEmpty())
                rv.setViewVisibility(R.id.card_countdown_caption, if (m.label == null) View.GONE else View.VISIBLE)
                rv.setTextViewText(R.id.card_countdown, m.countdown.orEmpty())
                rv.setViewVisibility(R.id.card_countdown, if (m.countdown == null) View.GONE else View.VISIBLE)
            }
        }
        rv.setOnClickFillInIntent(R.id.card_root, Intent().putExtra(NotificationHelper.EXTRA_SUBSCRIPTION_ID, id))
        // exactly the widget's size: StackView measures its cards "at most", so a card would shrink to its content
        // and the stack would spread the cards behind into the free space, where they show
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            rv.setViewLayoutWidth(R.id.card_root, widget.width.value, TypedValue.COMPLEX_UNIT_DIP)
            rv.setViewLayoutHeight(R.id.card_root, widget.height.value, TypedValue.COMPLEX_UNIT_DIP)
        }
        return rv
    }

    /** The drum of the big widget as PNG data: a raw 720 x 132 bitmap is about 380 KB, PNG a few KB. */
    private fun setDrum(rv: RemoteViews, model: BlackoutGlanceWidget.Companion.WidgetModel, description: String) {
        val bitmap = BlackoutGlanceWidget.renderAnalogCounterBitmap(model.slots, model.nowHour, model.nowMinute, model.lang)
        val png = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, png)
        val bytes = png.toByteArray()
        rv.setImageViewIcon(R.id.card_drum, Icon.createWithData(bytes, 0, bytes.size))
        rv.setContentDescription(R.id.card_drum, description)
    }
}
