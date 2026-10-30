package ua.blackout.prewarning.widget

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.glance.appwidget.updateAll
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import ua.blackout.prewarning.data.repository.SettingsRepository

class WidgetToggleReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val settingsRepo = SettingsRepository(context)
        val current = settingsRepo.getSettings()
        val newState = !current.notificationsEnabled
        settingsRepo.updateNotificationsEnabled(newState)

        CoroutineScope(Dispatchers.IO).launch {
            try {
                BlackoutGlanceWidget().updateAll(context)
            } catch (_: Exception) {}
        }
    }
}
