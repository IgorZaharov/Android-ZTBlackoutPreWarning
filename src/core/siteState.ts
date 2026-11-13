/**
 * What the user should be told about the ztoe.com.ua schedule site, mirrored 1:1 from
 * android/.../core/SiteState.kt. See spec/SITE_STATE.md.
 *  - AVAILABLE_WITH_TABLE: the site answered and today's schedule table is present.
 *  - AVAILABLE_NO_TABLE: the site answered but there is no schedule table (not published, or layout changed).
 *  - SITE_UNREACHABLE: the device has working internet but the site did not answer (DNS, timeout, TLS, HTTP error).
 *  - NO_INTERNET: the device itself has no validated internet connection.
 */
export type SiteState = 'AVAILABLE_WITH_TABLE' | 'AVAILABLE_NO_TABLE' | 'SITE_UNREACHABLE' | 'NO_INTERNET';
export const SITE_STATES: readonly SiteState[] = ['AVAILABLE_WITH_TABLE', 'AVAILABLE_NO_TABLE', 'SITE_UNREACHABLE', 'NO_INTERNET'];

/** Why a request failed, independent of the platform's exception types. */
export type FetchFailure = 'NONE' | 'DNS' | 'CONNECT' | 'TIMEOUT' | 'TLS' | 'HTTP_ERROR' | 'OTHER';
export const FETCH_FAILURES: readonly FetchFailure[] = ['NONE', 'DNS', 'CONNECT', 'TIMEOUT', 'TLS', 'HTTP_ERROR', 'OTHER'];

export const SiteStateResolver = {
  /**
   * [networkValidated] is the operating system's own verdict that the device has working internet
   * (Android NET_CAPABILITY_VALIDATED, iOS NWPath.status == .satisfied). No third-party host is
   * contacted to decide it.
   */
  resolve(failure: FetchFailure, hasTodayTable: boolean, networkValidated: boolean): SiteState {
    if (failure !== 'NONE') return networkValidated ? 'SITE_UNREACHABLE' : 'NO_INTERNET';
    return hasTodayTable ? 'AVAILABLE_WITH_TABLE' : 'AVAILABLE_NO_TABLE';
  },
} as const;
