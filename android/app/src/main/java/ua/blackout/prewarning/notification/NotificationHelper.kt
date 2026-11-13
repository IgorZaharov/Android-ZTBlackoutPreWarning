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
import androidx.core.app.NotificationManagerCompat
import ua.blackout.prewarning.MainActivity
import ua.blackout.prewarning.R
import ua.blackout.prewarning.core.EmergencyEvent
import ua.blackout.prewarning.core.EmergencyEventKind
import ua.blackout.prewarning.data.KYIV_ZONE
import ua.blackout.prewarning.data.model.UserSettings
import ua.blackout.prewarning.data.repository.AlertRegistry
import ua.blackout.prewarning.data.repository.SettingsRepository
import ua.blackout.prewarning.ui.AppStrings
import java.time.LocalDate
import java.time.LocalDateTime

object NotificationHelper {
    const val CHANNEL_SOUND_VIBE = "zt_blackout_sound_vibe_v2"
    const val CHANNEL_SOUND_ONLY = "zt_blackout_sound_only_v2"
    const val CHANNEL_VIBE_ONLY = "zt_blackout_vibe_only_v2"
    const val CHANNEL_SILENT = "zt_blackout_silent_v2"

    // Emergency outages get their own channels so users can tune them separately in the system settings
    const val CHANNEL_EMERGENCY_SOUND_VIBE = "zt_emergency_sound_vibe_v1"
    const val CHANNEL_EMERGENCY_SOUND_ONLY = "zt_emergency_sound_only_v1"
    const val CHANNEL_EMERGENCY_VIBE_ONLY = "zt_emergency_vibe_only_v1"
    const val CHANNEL_EMERGENCY_SILENT = "zt_emergency_silent_v1"

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

            fun emergencyChannel(id: String, name: String, importance: Int, sound: Boolean, vibrate: Boolean) =
                NotificationChannel(id, name, importance).apply {
                    description = "Сповіщення про аварійні відключення"
                    enableVibration(vibrate)
                    vibrationPattern = if (vibrate) VIBRATION_PATTERN else longArrayOf(0)
                    if (sound) setSound(soundUri, audioAttributes) else setSound(null, null)
                }

            manager.createNotificationChannels(
                listOf(
                    ch1, ch2, ch3, ch4,
                    emergencyChannel(CHANNEL_EMERGENCY_SOUND_VIBE, "Аварійні відключення (Звук + Вібрація)", NotificationManager.IMPORTANCE_HIGH, true, true),
                    emergencyChannel(CHANNEL_EMERGENCY_SOUND_ONLY, "Аварійні відключення (Тільки звук)", NotificationManager.IMPORTANCE_HIGH, true, false),
                    emergencyChannel(CHANNEL_EMERGENCY_VIBE_ONLY, "Аварійні відключення (Тільки вібрація)", NotificationManager.IMPORTANCE_HIGH, false, true),
                    emergencyChannel(CHANNEL_EMERGENCY_SILENT, "Аварійні відключення (Без звуку і вібрації)", NotificationManager.IMPORTANCE_LOW, false, false)
                )
            )
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

    /**
     * Posts the notifications for ledger events (start / restore time changed / end). Each event is
     * announced once: its key (`spec/NOTIFICATIONS.md`) is remembered in [AlertRegistry].
     * Callers only pass events produced by a confirmed fetch, so a failed request never reaches here.
     */
    fun postEmergencyEvents(
        context: Context,
        settings: UserSettings,
        addressKey: String,
        events: List<EmergencyEvent>
    ) {
        if (!settings.emergencyNotificationsEnabled || events.isEmpty()) return
        val appContext = context.applicationContext
        val lang = AppStrings.resolveLang(settings.language)
        val today = LocalDate.now(KYIV_ZONE)
        val registry = AlertRegistry(appContext)
        val address = settings.selectedAddress?.replace("\n", " ")?.takeIf { it.isNotBlank() }

        for (ev in events) {
            val key = ev.key(addressKey)
            if (registry.hasFired(key)) continue
            registry.markFired(key)

            val start = formatWhen(lang, ev.start, today)
            val eta = ev.eta?.let { formatWhen(lang, it, today) }
            val (title, body) = when (ev.kind) {
                EmergencyEventKind.START -> {
                    val t = if (ev.upcoming) AppStrings.emergencyUpcomingTitle(lang) else AppStrings.emergencyStartTitle(lang)
                    t to AppStrings.emergencyStartBody(lang, start, eta)
                }
                EmergencyEventKind.ETA_CHANGED ->
                    AppStrings.emergencyChangedTitle(lang) to AppStrings.emergencyChangedBody(lang, eta ?: start)
                EmergencyEventKind.END ->
                    if (ev.earlyEnd && eta != null) {
                        AppStrings.emergencyEarlyEndTitle(lang) to AppStrings.emergencyEarlyEndBody(lang, eta)
                    } else {
                        AppStrings.emergencyEndTitle(lang) to AppStrings.emergencyEndBody(lang, start)
                    }
            }
            showPreWarningNotification(
                context = appContext,
                notificationId = AlarmCodes.codeFor(appContext, key),
                title = title,
                body = if (address != null) "$body\n$address" else body,
                isTest = false,
                isEmergencyAlert = true
            )
        }
    }

    /** "22:04", "завтра 01:00" or "13.11 22:04" relative to [today]. */
    fun formatWhen(lang: String, dt: LocalDateTime, today: LocalDate): String {
        val hm = "${dt.hour.toString().padStart(2, '0')}:${dt.minute.toString().padStart(2, '0')}"
        return when (dt.toLocalDate()) {
            today -> hm
            today.plusDays(1) -> "${AppStrings.tomorrowWord(lang)} $hm"
            today.minusDays(1) -> "${AppStrings.yesterdayWord(lang)} $hm"
            else -> "${dt.dayOfMonth.toString().padStart(2, '0')}.${dt.monthValue.toString().padStart(2, '0')} $hm"
        }
    }

    fun showPreWarningNotification(
        context: Context,
        notificationId: Int,
        title: String,
        body: String,
        isTest: Boolean = false,
        isEmergencyAlert: Boolean = false
    ) {
        val settings = SettingsRepository(context).getSettings()

        // If notifications are disabled globally in the app, do NOT send unless this is an explicit Test or an enabled Emergency Alert
        if (isEmergencyAlert) {
            if (!settings.emergencyNotificationsEnabled) return
        } else if (!settings.notificationsEnabled && !isTest) {
            return
        }

        val activeSound = if (isEmergencyAlert) {
            settings.emergencyNotificationsEnabled && settings.soundEnabled
        } else {
            settings.notificationsEnabled && settings.soundEnabled
        }
        val activeVibe = if (isEmergencyAlert) {
            settings.emergencyNotificationsEnabled && settings.vibrationEnabled
        } else {
            settings.notificationsEnabled && settings.vibrationEnabled
        }

        createNotificationChannels(context)

        val targetChannelId = if (isEmergencyAlert) {
            when {
                activeSound && activeVibe -> CHANNEL_EMERGENCY_SOUND_VIBE
                activeSound && !activeVibe -> CHANNEL_EMERGENCY_SOUND_ONLY
                !activeSound && activeVibe -> CHANNEL_EMERGENCY_VIBE_ONLY
                else -> CHANNEL_EMERGENCY_SILENT
            }
        } else {
            when {
                activeSound && activeVibe -> CHANNEL_SOUND_VIBE
                activeSound && !activeVibe -> CHANNEL_SOUND_ONLY
                !activeSound && activeVibe -> CHANNEL_VIBE_ONLY
                else -> CHANNEL_SILENT
            }
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
            // Trigger hardware vibrator directly with USAGE_ALARM so vibration always fires even when sound is disabled,
            // but never when the notification itself is blocked (no POST_NOTIFICATIONS permission or app muted)
            if (NotificationManagerCompat.from(context).areNotificationsEnabled()) {
                triggerVibration(context)
            }
        } else {
            builder.setVibrate(longArrayOf(0))
        }

        // Only mark silent if BOTH sound AND vibration are disabled
        if (!activeSound && !activeVibe) {
            builder.setSilent(true)
        }

        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(notificationId, builder.build())
    }
}