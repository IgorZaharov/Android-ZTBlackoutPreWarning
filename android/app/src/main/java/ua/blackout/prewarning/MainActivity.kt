package ua.blackout.prewarning

import android.Manifest
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import ua.blackout.prewarning.notification.NotificationHelper
import ua.blackout.prewarning.ui.screens.BlackoutAppNavigation
import ua.blackout.prewarning.ui.screens.RouletteSoundEngine
import ua.blackout.prewarning.ui.theme.ZTBlackoutTheme

class MainActivity : ComponentActivity() {

    private val requestNotificationPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { isGranted ->
            // Notification permission granted or denied
        }

    /** Subscription id from the notification the app was opened with; the main screen shows it once. */
    private var openSubscriptionId by mutableStateOf<String?>(null)

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        intent.getStringExtra(NotificationHelper.EXTRA_SUBSCRIPTION_ID)?.let { openSubscriptionId = it }
    }

    override fun onResume() {
        super.onResume()
        RouletteSoundEngine.setAppInForeground(true, this)
    }

    override fun onPause() {
        RouletteSoundEngine.setAppInForeground(false, this)
        super.onPause()
    }

    override fun onStop() {
        RouletteSoundEngine.setAppInForeground(false, this)
        super.onStop()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // a recreated activity (rotation) must not jump back to the notification's address
        if (savedInstanceState == null) openSubscriptionId = intent?.getStringExtra(NotificationHelper.EXTRA_SUBSCRIPTION_ID)

        // Initialize Notification Channels
        NotificationHelper.createNotificationChannels(this)

        // Request runtime permission for Android 13+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestNotificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }

        setContent {
            val systemDark = isSystemInDarkTheme()
            var isDarkMode by remember { mutableStateOf(systemDark) }

            ZTBlackoutTheme(darkTheme = isDarkMode) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    BlackoutAppNavigation(
                        onThemeChanged = { isDarkMode = it },
                        openSubscriptionId = openSubscriptionId,
                        onOpenSubscriptionHandled = { openSubscriptionId = null }
                    )
                }
            }
        }
    }
}