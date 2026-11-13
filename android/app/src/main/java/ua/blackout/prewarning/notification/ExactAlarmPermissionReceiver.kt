package ua.blackout.prewarning.notification

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * The user granted or revoked "Alarms & reminders": plan the alerts again so they switch between
 * exact and inexact delivery immediately.
 */
class ExactAlarmPermissionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val appContext = context.applicationContext
        val pending = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                AlarmScheduler.syncAlarms(appContext)
            } catch (_: Exception) {
            } finally {
                try {
                    pending.finish()
                } catch (_: Exception) {
                }
            }
        }
    }
}
