import Foundation

public enum SlotStatus: String, Codable, Equatable {
    case POWER_ON
    case POWER_OFF
}

public struct BlackoutSlot: Codable, Equatable, Identifiable {
    public var id: Int { index }
    public let index: Int
    public let startMinute: Int
    public let endMinute: Int
    public let label: String
    public let status: SlotStatus
    public let isEmergency: Bool

    public init(index: Int, startMinute: Int, endMinute: Int, label: String, status: SlotStatus, isEmergency: Bool = false) {
        self.index = index
        self.startMinute = startMinute
        self.endMinute = endMinute
        self.label = label
        self.status = status
        self.isEmergency = isEmergency
    }
}

public struct DetailedInterval: Codable, Equatable, Identifiable {
    public var id: String { "\(startStr)-\(endStr)" }
    public let startStr: String
    public let endStr: String
    public let startMinuteOfDay: Int
    public let endMinuteOfDay: Int
    public let durationHours: Double
    public let isEmergency: Bool

    public init(
        startStr: String,
        endStr: String,
        startMinuteOfDay: Int,
        endMinuteOfDay: Int,
        durationHours: Double,
        isEmergency: Bool = false
    ) {
        self.startStr = startStr
        self.endStr = endStr
        self.startMinuteOfDay = startMinuteOfDay
        self.endMinuteOfDay = endMinuteOfDay
        self.durationHours = durationHours
        self.isEmergency = isEmergency
    }
}

public struct StatusAndCountdown: Equatable {
    public let isBlackoutNow: Bool
    public let isUnclear: Bool
    public let countdownText: String
    public let nextSlotTime: String
    public let currentOrNextInterval: DetailedInterval?

    public init(
        isBlackoutNow: Bool,
        isUnclear: Bool = false,
        countdownText: String,
        nextSlotTime: String,
        currentOrNextInterval: DetailedInterval? = nil
    ) {
        self.isBlackoutNow = isBlackoutNow
        self.isUnclear = isUnclear
        self.countdownText = countdownText
        self.nextSlotTime = nextSlotTime
        self.currentOrNextInterval = currentOrNextInterval
    }
}

public enum FetchStatus: String, Codable, Equatable {
    case SUCCESS
    case NO_INTERNET
    case NO_QUEUES_FOUND
}

public struct FullScheduleResult: Equatable {
    public let status: FetchStatus
    public let todaySchedules: [String: [BlackoutSlot]]
    public let tomorrowSchedules: [String: [BlackoutSlot]]
    public let updatedAt: String
}

public struct UserSettings: Codable, Equatable {
    public var queue: String
    public var customQueueStatusText: String?
    public var selectedAddress: String?
    public var selectedRem: String?
    public var selectedSettlement: String?
    public var selectedStreet: String?
    public var selectedHouse: String?
    public var activeEmergencyOutageStart: String?
    public var activeEmergencyOutageRestore: String?
    public var url: String
    public var advanceNoticeMinutes: Int
    public var refreshIntervalMinutes: Int
    public var notificationsEnabled: Bool
    public var emergencyNotificationsEnabled: Bool
    public var soundEnabled: Bool
    public var vibrationEnabled: Bool
    public var language: String
    public var theme: String

    public init(
        queue: String = "",
        customQueueStatusText: String? = nil,
        selectedAddress: String? = nil,
        selectedRem: String? = nil,
        selectedSettlement: String? = nil,
        selectedStreet: String? = nil,
        selectedHouse: String? = nil,
        activeEmergencyOutageStart: String? = nil,
        activeEmergencyOutageRestore: String? = nil,
        url: String = "https://www.ztoe.com.ua/unhooking-search.php",
        advanceNoticeMinutes: Int = 15,
        refreshIntervalMinutes: Int = 30,
        notificationsEnabled: Bool = true,
        emergencyNotificationsEnabled: Bool = true,
        soundEnabled: Bool = true,
        vibrationEnabled: Bool = true,
        language: String = "system",
        theme: String = "system"
    ) {
        self.queue = queue
        self.customQueueStatusText = customQueueStatusText
        self.selectedAddress = selectedAddress
        self.selectedRem = selectedRem
        self.selectedSettlement = selectedSettlement
        self.selectedStreet = selectedStreet
        self.selectedHouse = selectedHouse
        self.activeEmergencyOutageStart = activeEmergencyOutageStart
        self.activeEmergencyOutageRestore = activeEmergencyOutageRestore
        self.url = url
        self.advanceNoticeMinutes = advanceNoticeMinutes
        self.refreshIntervalMinutes = refreshIntervalMinutes
        self.notificationsEnabled = notificationsEnabled
        self.emergencyNotificationsEnabled = emergencyNotificationsEnabled
        self.soundEnabled = soundEnabled
        self.vibrationEnabled = vibrationEnabled
        self.language = language
        self.theme = theme
    }

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
