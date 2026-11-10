package ua.blackout.prewarning.notification

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import android.os.VibrationAttributes
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat
import ua.blackout.prewarning.MainActivity
import ua.blackout.prewarning.R
import ua.blackout.prewarning.data.model.EmergencyOutageInfo
import ua.blackout.prewarning.data.model.UserSettings
import ua.blackout.prewarning.data.repository.AlertRegistry
import ua.blackout.prewarning.data.repository.SettingsRepository

object NotificationHelper {
    const val CHANNEL_SOUND_VIBE = "zt_blackout_sound_vibe_v2"
    const val CHANNEL_SOUND_ONLY = "zt_blackout_sound_only_v2"
    const val CHANNEL_VIBE_ONLY = "zt_blackout_vibe_only_v2"
    const val CHANNEL_SILENT = "zt_blackout_silent_v2"

    private val VIBRATION_PATTERN = longArrayOf(0, 400, 200, 400)

    fun createNotificationChannel(context: Context) {
        createNotificationChannels(context)
    }

    fun createNotificationChannels(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            val audioAttributes = AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
                .build()

            // 1. Sound + Vibration
            val ch1 = NotificationChannel(
                CHANNEL_SOUND_VIBE,
                "Сповіщення (Звук + Вібрація)",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Сповіщення про відключення зі звуком та вібрацією"
                enableVibration(true)
                vibrationPattern = VIBRATION_PATTERN
                setSound(soundUri, audioAttributes)
            }

            // 2. Sound Only
            val ch2 = NotificationChannel(
                CHANNEL_SOUND_ONLY,
                "Сповіщення (Тільки звук)",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Сповіщення про відключення тільки зі звуком"
                enableVibration(false)
                vibrationPattern = longArrayOf(0)
                setSound(soundUri, audioAttributes)
            }

            // 3. Vibration Only (Sound OFF, Vibration ON)
            val ch3 = NotificationChannel(
                CHANNEL_VIBE_ONLY,
                "Сповіщення (Тільки вібрація)",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Сповіщення про відключення тільки з вібрацією (без звуку)"
                enableVibration(true)
                vibrationPattern = VIBRATION_PATTERN
                setSound(null, null)
            }

            // 4. Silent
            val ch4 = NotificationChannel(
                CHANNEL_SILENT,
                "Сповіщення (Без звуку і вібрації)",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Беззвучні сповіщення"
                enableVibration(false)
                vibrationPattern = longArrayOf(0)
                setSound(null, null)
            }

            manager.createNotificationChannels(listOf(ch1, ch2, ch3, ch4))
        }
    }

    fun triggerVibration(context: Context) {
        try {
            val vibrator: Vibrator? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vm?.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            }

            if (vibrator == null || !vibrator.hasVibrator()) return

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                val effect = VibrationEffect.createWaveform(VIBRATION_PATTERN, -1)
                val attrs = VibrationAttributes.Builder()
                    .setUsage(VibrationAttributes.USAGE_ALARM)
                    .build()
                vibrator.vibrate(effect, attrs)
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val effect = VibrationEffect.createWaveform(VIBRATION_PATTERN, -1)
                val audioAttrs = AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .build()
                @Suppress("DEPRECATION")
                vibrator.vibrate(effect, audioAttrs)
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(VIBRATION_PATTERN, -1)
            }
        } catch (_: Exception) {}
    }

    fun checkAndTriggerEmergencyOutageAlert(
        context: Context,
        settings: UserSettings,
        previousEmergency: EmergencyOutageInfo?,
        currentEmergency: EmergencyOutageInfo?
    ): Pair<String, String>? {
        val lang = ua.blackout.prewarning.ui.AppStrings.resolveLang(settings.language)
        return checkAndTriggerEmergencyOutageAlert(
            context = context,
            prevOutage = previousEmergency,
            nextOutage = currentEmergency,
            settings = settings,
            lang = lang
        )
    }

    fun checkAndTriggerEmergencyOutageAlert(
        context: Context,
        prevOutage: EmergencyOutageInfo?,
        nextOutage: EmergencyOutageInfo?,
        settings: UserSettings,
        lang: String
    ): Pair<String, String>? {
        if (!settings.notificationsEnabled) return null
        val registry = AlertRegistry(context.applicationContext)

        // 1. Outage Restored (prev active -> next null)
        if (prevOutage != null && nextOutage == null) {
            val restoreKey = "emergency_restore_${prevOutage.id}_${prevOutage.startTime}"
            if (registry.hasFired(restoreKey)) return null
            registry.markFired(restoreKey)
            val title = if (lang == "uk") "Аварійне відключення завершено" else "Emergency Outage Restored"
            val body = if (lang == "uk") {
                "Електропостачання за вашою адресою відновлено (початок був: ${prevOutage.startTime})."
            } else {
                "Power supply at your address has been restored (started: ${prevOutage.startTime})."
            }
            showPreWarningNotification(
                context = context,
                notificationId = restoreKey.hashCode(),
                title = title,
                body = body,
                isTest = false
            )
            return title to body
        }

        // 2. Outage Detected (next active)
        if (nextOutage != null) {
            val detectKey = "emergency_detect_${nextOutage.id}_${nextOutage.startTime}_${nextOutage.estimatedRestoreTime}"
            if (registry.hasFired(detectKey)) return null
            registry.markFired(detectKey)
            val title = if (lang == "uk") {
                nextOutage.outageType.ifBlank { "Аварійне відключення" }
            } else {
                "Emergency Outage"
            }
            val body = if (lang == "uk") {
                "Зафіксовано аварійне відключення. Початок: ${nextOutage.startTime}. Орієнтовне відновлення: ${nextOutage.estimatedRestoreTime}."
            } else {
                "Emergency outage detected. Start: ${nextOutage.startTime}. Estimated restore: ${nextOutage.estimatedRestoreTime}."
            }
            showPreWarningNotification(
                context = context,
                notificationId = detectKey.hashCode(),
                title = title,
                body = body,
                isTest = false
            )
            return title to body
        }

        return null
    }

    fun showPreWarningNotification(
        context: Context,
        notificationId: Int,
        title: String,
        body: String,
        isTest: Boolean = false
    ) {
        val settings = SettingsRepository(context).getSettings()

        // If notifications are disabled globally in the app, do NOT send unless this is an explicit Test
        if (!settings.notificationsEnabled && !isTest) {
            return
        }

        val activeSound = settings.notificationsEnabled && settings.soundEnabled
        val activeVibe = settings.notificationsEnabled && settings.vibrationEnabled

        createNotificationChannels(context)

        val targetChannelId = when {
            activeSound && activeVibe -> CHANNEL_SOUND_VIBE
            activeSound && !activeVibe -> CHANNEL_SOUND_ONLY
            !activeSound && activeVibe -> CHANNEL_VIBE_ONLY
            else -> CHANNEL_SILENT
        }

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

        val builder = NotificationCompat.Builder(context, targetChannelId)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(if (activeSound || activeVibe) NotificationCompat.PRIORITY_HIGH else NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)

        // Strict sound & vibration configuration
        if (activeSound) {
            builder.setSound(soundUri)
        } else {
            builder.setSound(null)
        }

        if (activeVibe) {
            builder.setVibrate(VIBRATION_PATTERN)
            if (!activeSound) {
                builder.setDefaults(NotificationCompat.DEFAULT_VIBRATE)
            }
            // Trigger hardware vibrator directly with USAGE_ALARM so vibration always fires even when sound is disabled
            triggerVibration(context)
        } else {
            builder.setVibrate(longArrayOf(0))
        }

        // Only mark silent if BOTH sound AND vibration are disabled
        if (!activeSound && !activeVibe) {
            builder.setSilent(true)
        }

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(notificationId, builder.build())
    }
}