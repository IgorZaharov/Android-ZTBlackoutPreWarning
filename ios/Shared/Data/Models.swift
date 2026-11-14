import Foundation

// Mirror of android data/model/Models.kt (1.4.0). The retired 1.3.x emergency model
// (EmergencyOutageInfo, active_emergency_outage_*) is not ported: emergencies come from PowerOn
// through OutageRepository and the EmergencyLedger.

public enum SlotStatus: String, Codable, Hashable, Sendable {
    case POWER_ON
    case POWER_OFF
}

/// The address chosen in the "?" dialog: ztoe REM slug, settlement option id, street option id, house.
public struct SelectedAddressQuery: Hashable, Sendable {
    public var remId: String
    public var settlementId: String
    public var streetId: String
    public var house: String

    public init(remId: String, settlementId: String, streetId: String, house: String) {
        self.remId = remId
        self.settlementId = settlementId
        self.streetId = streetId
        self.house = house
    }
}

/// One half-hour cell in the shape the drum chart and widgets draw (Kotlin `BlackoutSlot`).
public struct BlackoutSlot: Hashable, Identifiable, Sendable {
    /// Unique key: "<date>_<start>_Q<queue>".
    public var id: String
    public var startHour: Int
    public var endHour: Int
    public var startMinute: Int
    public var endMinute: Int
    public var startTimeStr: String
    public var endTimeStr: String
    public var status: SlotStatus
    public var isEmergency: Bool
    /// Off because of the planned ztoe schedule (or repair works). With `isEmergency` both overlap on the drum.
    public var isPlanned: Bool

    public init(
        id: String, startHour: Int, endHour: Int, startMinute: Int, endMinute: Int,
        startTimeStr: String, endTimeStr: String, status: SlotStatus,
        isEmergency: Bool = false, isPlanned: Bool? = nil
    ) {
        self.id = id
        self.startHour = startHour
        self.endHour = endHour
        self.startMinute = startMinute
        self.endMinute = endMinute
        self.startTimeStr = startTimeStr
        self.endTimeStr = endTimeStr
        self.status = status
        self.isEmergency = isEmergency
        self.isPlanned = isPlanned ?? (status == .POWER_OFF && !isEmergency)
    }

    public var label: String { "\(startTimeStr) - \(endTimeStr)" }
}

// CRITICAL CONSTANTS — DO NOT MODIFY DEFAULT VALUES (advanceNoticeMinutes = 15, refreshIntervalMinutes = 30) UNLESS EXPLICITLY REQUESTED
public struct UserSettings: Hashable, Sendable {
    public var cityUrl: String = "https://www.ztoe.com.ua/unhooking-search.php"
    public var queue: String = ""
    public var customQueueStatusText: String? = nil
    public var selectedAddress: String? = nil
    public var selectedAddressQuery: SelectedAddressQuery? = nil
    public var refreshIntervalMinutes: Int = 30
    public var advanceNoticeMinutes: Int = 15
    public var notificationsEnabled: Bool = true
    public var emergencyNotificationsEnabled: Bool = true
    public var soundEnabled: Bool = true
    public var vibrationEnabled: Bool = true
    public var prevSoundEnabled: Bool = true
    public var prevVibrationEnabled: Bool = true
    /// Notify when the estimated restoration of an emergency moves (ETA_CHANGED), all addresses (spec/NOTIFICATIONS.md 2.4).
    public var emergencyEtaAlerts: Bool = true
    /// Notify when an emergency ends (END), all addresses. The start always notifies.
    public var emergencyEndAlerts: Bool = true
    /// "SYSTEM", "DARK", "LIGHT"
    public var themeMode: String = "SYSTEM"
    /// "SYSTEM", "UK", "EN"
    public var language: String = "SYSTEM"

    public init() {}

    public static let ALL_QUEUES: [String] = [
        "1.1", "1.2", "2.1", "2.2", "3.1", "3.2",
        "4.1", "4.2", "5.1", "5.2", "6.1", "6.2"
    ]
}

public struct DonationItem: Codable, Equatable, Identifiable {
    public var id: String { url }
    public let title: String
    public let url: String

    public init(title: String, url: String) {
        self.title = title
        self.url = url
    }
}
