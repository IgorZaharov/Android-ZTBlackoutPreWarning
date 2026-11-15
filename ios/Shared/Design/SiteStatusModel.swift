import Foundation

/// Icon of a status chip or banner. Never the only cue: each chip also has a tone and text.
public enum StatusIcon: String, Sendable {
    case OK, WARNING, SERVER_DOWN, OFFLINE, UNKNOWN, TOMORROW_OK, TOMORROW_PENDING

    /// SF Symbol for the Material icon Android draws.
    public var symbol: String {
        switch self {
        case .OK: return "checkmark.circle.fill"
        case .WARNING: return "exclamationmark.triangle.fill"
        case .SERVER_DOWN: return "icloud.slash.fill"
        case .OFFLINE: return "wifi.slash"
        case .UNKNOWN: return "questionmark.circle"
        case .TOMORROW_OK: return "calendar"
        case .TOMORROW_PENDING: return "calendar.badge.exclamationmark"
        }
    }
}

public struct StatusChip: Equatable, Sendable {
    public var tone: ZtChipTone
    public var icon: StatusIcon
    public var text: String
}

public struct SiteBanner: Equatable, Sendable {
    public var tone: ZtChipTone
    public var icon: StatusIcon
    public var title: String
    public var message: String
}

/// Pure rules for the site and PowerOn status the main screen shows (port of Android
/// `ui/components/SiteStatusIndicator.kt` `SiteStatusModel`, spec/SITE_STATE.md).
public enum SiteStatusModel {
    public static func formatHhmm(_ epochMs: Int64) -> String {
        let t = KyivTime.localDateTime(of: Date(timeIntervalSince1970: Double(epochMs) / 1000))
        return String(format: "%02d:%02d", t.hour, t.minute)
    }

    static func siteText(_ lang: String, _ state: SiteState) -> String {
        switch state {
        case .AVAILABLE_WITH_TABLE: return AppStrings.siteStateWithTable(lang)
        case .AVAILABLE_NO_TABLE: return AppStrings.siteStateNoTable(lang)
        case .SITE_UNREACHABLE: return AppStrings.siteStateUnreachable(lang)
        case .NO_INTERNET: return AppStrings.siteStateNoInternet(lang)
        }
    }

    static func tone(_ state: SiteState) -> ZtChipTone {
        switch state {
        case .AVAILABLE_WITH_TABLE: return .green
        case .AVAILABLE_NO_TABLE: return .amber
        case .SITE_UNREACHABLE: return .red
        case .NO_INTERNET: return .grey
        }
    }

    static func icon(_ state: SiteState) -> StatusIcon {
        switch state {
        case .AVAILABLE_WITH_TABLE: return .OK
        case .AVAILABLE_NO_TABLE: return .WARNING
        case .SITE_UNREACHABLE: return .SERVER_DOWN
        case .NO_INTERNET: return .OFFLINE
        }
    }

    static func hint(_ lang: String, _ state: SiteState) -> String? {
        switch state {
        case .AVAILABLE_WITH_TABLE: return nil
        case .AVAILABLE_NO_TABLE: return AppStrings.siteStateHintNoTable(lang)
        case .SITE_UNREACHABLE: return AppStrings.siteStateHintUnreachable(lang)
        case .NO_INTERNET: return AppStrings.siteStateHintNoInternet(lang)
        }
    }

    /// Chip row of the "Last updated" card. Empty when no queue is selected (nothing is checked then).
    public static func chips(_ snapshot: OutageSnapshot, _ lang: String) -> [StatusChip] {
        if snapshot.queue.ktIsBlank { return [] }
        var out: [StatusChip] = []
        if let site = snapshot.site {
            out.append(StatusChip(tone: tone(site.state), icon: icon(site.state), text: siteText(lang, site.state)))
        } else {
            out.append(StatusChip(tone: .grey, icon: .UNKNOWN, text: AppStrings.siteStateChecking(lang)))
        }
        if snapshot.isStale, let since = snapshot.site?.lastSuccessMs.map(formatHhmm) {
            out.append(StatusChip(tone: .amber, icon: .WARNING, text: AppStrings.staleChip(lang, since)))
        }
        if snapshot.tomorrowPublished {
            out.append(StatusChip(tone: .green, icon: .TOMORROW_OK, text: AppStrings.tomorrowPublished(lang)))
        } else {
            out.append(StatusChip(tone: .grey, icon: .TOMORROW_PENDING, text: AppStrings.tomorrowNotPublishedShort(lang)))
        }
        return out
    }

    /// Status line shown only when the last PowerOn (emergency outages) refresh failed.
    public static func poweronLine(_ snapshot: OutageSnapshot, _ lang: String) -> StatusChip? {
        snapshot.poweron?.ok == false ? StatusChip(tone: .amber, icon: .WARNING, text: AppStrings.poweronUnavailable(lang)) : nil
    }

    /// The site's own notice while the page is up but has no schedule table. Shown even without a
    /// queue: it concerns everybody in the region.
    public static func notice(_ snapshot: OutageSnapshot) -> String? {
        guard let site = snapshot.site, site.state == .AVAILABLE_NO_TABLE, let notice = site.notice, !notice.ktIsBlank else { return nil }
        return notice
    }

    /// Banner above the hero, for degraded site states only. Not shown while the notice card is: the
    /// notice already explains the missing table and the chip below still names the state.
    public static func banner(_ snapshot: OutageSnapshot, _ lang: String) -> SiteBanner? {
        if snapshot.queue.ktIsBlank { return nil }
        guard let site = snapshot.site, site.state != .AVAILABLE_WITH_TABLE else { return nil }
        if notice(snapshot) != nil { return nil }
        let since = snapshot.isStale ? site.lastSuccessMs.map(formatHhmm) : nil
        let message = [since.map { AppStrings.staleDataSince(lang, $0) }, hint(lang, site.state)]
            .compactMap { $0 }
            .joined(separator: "\n")
        return SiteBanner(tone: tone(site.state), icon: icon(site.state), title: siteText(lang, site.state), message: message)
    }
}
