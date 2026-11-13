package ua.blackout.prewarning.core

/**
 * What the user should be told about the ztoe.com.ua schedule site. See `spec/SITE_STATE.md`.
 *  - AVAILABLE_WITH_TABLE: the site answered and today's schedule table is present.
 *  - AVAILABLE_NO_TABLE: the site answered but there is no schedule table (not published, or layout changed).
 *  - SITE_UNREACHABLE: the device has working internet but the site did not answer (DNS, timeout, TLS, HTTP error).
 *  - NO_INTERNET: the device itself has no validated internet connection.
 */
enum class SiteState { AVAILABLE_WITH_TABLE, AVAILABLE_NO_TABLE, SITE_UNREACHABLE, NO_INTERNET }

/** Why a request failed, independent of the platform's exception types. */
enum class FetchFailure { NONE, DNS, CONNECT, TIMEOUT, TLS, HTTP_ERROR, OTHER }

object SiteStateResolver {
    /**
     * [networkValidated] is the operating system's own verdict that the device has working internet
     * (Android `NET_CAPABILITY_VALIDATED`, iOS `NWPath.status == .satisfied`). No third-party host is
     * contacted to decide it.
     */
    fun resolve(failure: FetchFailure, hasTodayTable: Boolean, networkValidated: Boolean): SiteState = when {
        failure != FetchFailure.NONE -> if (networkValidated) SiteState.SITE_UNREACHABLE else SiteState.NO_INTERNET
        hasTodayTable -> SiteState.AVAILABLE_WITH_TABLE
        else -> SiteState.AVAILABLE_NO_TABLE
    }
}
