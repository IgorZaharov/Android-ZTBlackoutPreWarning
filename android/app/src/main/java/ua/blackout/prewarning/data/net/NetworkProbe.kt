package ua.blackout.prewarning.data.net

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities

/**
 * Asks the operating system whether the device has working internet. Uses the system's own
 * validation (`NET_CAPABILITY_VALIDATED`), so no third-party host is contacted and the privacy
 * policy stays accurate.
 */
object NetworkProbe {
    fun isValidated(context: Context?): Boolean {
        if (context == null) return true // unit tests / no context: do not claim "offline"
        return try {
            val cm = context.applicationContext.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
                ?: return true
            val network = cm.activeNetwork ?: return false
            val caps = cm.getNetworkCapabilities(network) ?: return false
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
        } catch (_: SecurityException) {
            true
        } catch (_: Exception) {
            true
        }
    }
}
