package ua.blackout.prewarning.widget

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Icon
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RadioButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import ua.blackout.prewarning.core.Subscription
import ua.blackout.prewarning.core.Subscriptions
import ua.blackout.prewarning.data.repository.SettingsRepository
import ua.blackout.prewarning.data.repository.SubscriptionSync
import ua.blackout.prewarning.notification.AlarmScheduler
import ua.blackout.prewarning.ui.AppStrings
import ua.blackout.prewarning.ui.theme.ZTBlackoutTheme
import ua.blackout.prewarning.ui.theme.ZtColors
import ua.blackout.prewarning.ui.theme.ZtMinTouch
import ua.blackout.prewarning.ui.theme.ZtShapes
import ua.blackout.prewarning.ui.theme.ZtType

/**
 * Picks the address of one widget (spec/SUBSCRIPTIONS.md section 10): "follow the primary" or one item.
 * On Android 12+ the widget is placed bound to the primary and this opens from "reconfigure"; on older
 * versions it opens on placement, and with fewer than two addresses it confirms at once (nothing to pick).
 */
class WidgetConfigActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val appWidgetId = intent?.extras?.getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
            ?: AppWidgetManager.INVALID_APPWIDGET_ID
        val resultIntent = Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
        // Backing out removes a widget that is being placed (Android 11 and older)
        setResult(Activity.RESULT_CANCELED, resultIntent)
        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish()
            return
        }
        val store = SubscriptionSync(this).store()
        if (store.items.size < 2) {
            setResult(Activity.RESULT_OK, resultIntent)
            finish()
            return
        }
        val lang = AppStrings.resolveLang(SettingsRepository(this).getSettings().language)
        // A binding to a removed item shows as "follow the primary", which is what the widget does
        val current = WidgetBindings.boundId(this, appWidgetId)?.takeIf { id -> store.items.any { it.id == id } }

        setContent {
            ZTBlackoutTheme(darkTheme = true) {
                WidgetConfigScreen(
                    lang = lang,
                    items = store.items,
                    primaryId = store.primaryId,
                    initial = current,
                    onCancel = { finish() },
                    onSave = { chosen -> save(appWidgetId, chosen, resultIntent) }
                )
            }
        }
    }

    private fun save(appWidgetId: Int, subscriptionId: String?, resultIntent: Intent) {
        WidgetBindings.bind(this, appWidgetId, subscriptionId)
        lifecycleScope.launch {
            withContext(Dispatchers.IO) {
                try {
                    // The new address may need its own redraw alarms and PowerOn polling
                    AlarmScheduler.syncAlarms(applicationContext)
                } catch (_: Exception) {
                }
                try {
                    BlackoutGlanceWidget.syncAllWidgets(applicationContext)
                } catch (_: Exception) {
                }
            }
            setResult(Activity.RESULT_OK, resultIntent)
            finish()
        }
    }
}

@Composable
private fun WidgetConfigScreen(
    lang: String,
    items: List<Subscription>,
    primaryId: String?,
    initial: String?,
    onCancel: () -> Unit,
    onSave: (String?) -> Unit
) {
    // null = follow the primary
    var selected by rememberSaveable { mutableStateOf(initial) }
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0A0D14))
            .safeDrawingPadding()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(AppStrings.widgetConfigTitle(lang), style = ZtType.title, color = ZtColors.TextPrimary)
        Text(AppStrings.widgetConfigDesc(lang), style = ZtType.body, color = ZtColors.TextSecondary)
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(ZtShapes.Card)
                .background(ZtColors.Card)
                .border(1.dp, ZtColors.CardBorder, ZtShapes.Card)
                .padding(8.dp)
                .selectableGroup()
        ) {
            ChoiceRow(
                title = AppStrings.widgetFollowPrimary(lang),
                subtitle = AppStrings.widgetFollowPrimaryHint(lang),
                isPrimary = false,
                primaryLabel = AppStrings.primaryBadge(lang),
                selected = selected == null,
                onSelect = { selected = null }
            )
            for (item in items) {
                ChoiceRow(
                    title = Subscriptions.displayLabel(item),
                    subtitle = item.queue?.let { "Черга $it" } ?: item.queueStatusText,
                    isPrimary = item.id == primaryId,
                    primaryLabel = AppStrings.primaryBadge(lang),
                    selected = selected == item.id,
                    onSelect = { selected = item.id }
                )
            }
        }
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            ConfigButton(AppStrings.cancel(lang), filled = false, modifier = Modifier.weight(1f), onClick = onCancel)
            ConfigButton(AppStrings.save(lang), filled = true, modifier = Modifier.weight(1f), onClick = { onSave(selected) })
        }
    }
}

@Composable
private fun ChoiceRow(
    title: String,
    subtitle: String?,
    isPrimary: Boolean,
    primaryLabel: String,
    selected: Boolean,
    onSelect: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = ZtMinTouch)
            .clip(ZtShapes.Row)
            .selectable(selected = selected, role = Role.RadioButton, onClick = onSelect)
            .padding(horizontal = 8.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        RadioButton(
            selected = selected,
            onClick = null,
            colors = RadioButtonDefaults.colors(selectedColor = ZtColors.Accent, unselectedColor = ZtColors.TextSecondary)
        )
        Spacer(Modifier.width(8.dp))
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(title, style = ZtType.body, fontWeight = FontWeight.SemiBold, color = ZtColors.TextPrimary)
                if (isPrimary) {
                    Spacer(Modifier.width(6.dp))
                    Icon(Icons.Default.Star, contentDescription = primaryLabel, tint = ZtColors.Accent, modifier = Modifier.size(16.dp))
                }
            }
            if (!subtitle.isNullOrBlank()) Text(subtitle, style = ZtType.caption, color = ZtColors.TextSecondary)
        }
    }
}

@Composable
private fun ConfigButton(text: String, filled: Boolean, modifier: Modifier, onClick: () -> Unit) {
    Row(
        modifier = modifier
            .heightIn(min = ZtMinTouch)
            .clip(ZtShapes.Control)
            .then(
                if (filled) Modifier.background(ZtColors.Accent)
                else Modifier.background(Color(0x1AFFFFFF)).border(1.dp, ZtColors.CardBorder, ZtShapes.Control)
            )
            .clickable(role = Role.Button, onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(text, style = ZtType.label, fontWeight = if (filled) FontWeight.Bold else FontWeight.SemiBold, color = Color.White)
    }
}
