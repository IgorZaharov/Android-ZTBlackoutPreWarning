import Foundation

/// What the user should be told about the ztoe.com.ua schedule site (mirror of android
/// core/SiteState.kt, spec/SITE_STATE.md).
///  - AVAILABLE_WITH_TABLE: the site answered and today's schedule table is present.
///  - AVAILABLE_NO_TABLE: the site answered but there is no schedule table (not published, or layout changed).
///  - SITE_UNREACHABLE: the device has working internet but the site did not answer (DNS, timeout, TLS, HTTP error).
///  - NO_INTERNET: the device itself has no validated internet connection.
public enum SiteState: String, Sendable { case AVAILABLE_WITH_TABLE, AVAILABLE_NO_TABLE, SITE_UNREACHABLE, NO_INTERNET }

/// Why a request failed, independent of the platform's error types.
public enum FetchFailure: String, Sendable { case NONE, DNS, CONNECT, TIMEOUT, TLS, HTTP_ERROR, OTHER }

public enum SiteStateResolver {
    /// `networkValidated` is the operating system's own verdict that the device has working internet
    /// (iOS `NWPath.status == .satisfied`). No third-party host is contacted to decide it.
    public static func resolve(failure: FetchFailure, hasTodayTable: Bool, networkValidated: Bool) -> SiteState {
        if failure != .NONE { return networkValidated ? .SITE_UNREACHABLE : .NO_INTERNET }
        return hasTodayTable ? .AVAILABLE_WITH_TABLE : .AVAILABLE_NO_TABLE
    }
}
