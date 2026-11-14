import SwiftUI

public struct MainScreen: View {
    public let queue: String
    public let customQueueStatusText: String?
    public let selectedAddress: String?
    public let emergencyOutageStartTime: String?
    public let emergencyOutageRestoreTime: String?
    public let todaySlots: [BlackoutSlot]
    public let tomorrowSlots: [BlackoutSlot]?
    public let statusInfo: StatusAndCountdown
    public let notificationsEnabled: Bool
    public let isRefreshing: Bool
    public let lang: String
    public let selectedLanguage: String
    public let now: Date
    public let onToggleNotifications: () -> Void
    public let onRefresh: () -> Void
    public let onOpenQueueSelection: (() -> Void)?
    public let onChangeLanguage: ((String) -> Void)?

    @State private var selectedDayTab: Int = 0
    @State private var pulseActive: Bool = false

    public init(
        queue: String,
        customQueueStatusText: String? = nil,
        selectedAddress: String? = nil,
        emergencyOutageStartTime: String? = nil,
        emergencyOutageRestoreTime: String? = nil,
        todaySlots: [BlackoutSlot],
        tomorrowSlots: [BlackoutSlot]?,
        statusInfo: StatusAndCountdown,
        notificationsEnabled: Bool,
        isRefreshing: Bool,
        lang: String,
        selectedLanguage: String = "system",
        now: Date,
        onToggleNotifications: @escaping () -> Void,
        onRefresh: @escaping () -> Void,
        onOpenQueueSelection: (() -> Void)? = nil,
        onChangeLanguage: ((String) -> Void)? = nil
    ) {
        self.queue = queue
        self.customQueueStatusText = customQueueStatusText
        self.selectedAddress = selectedAddress
        self.emergencyOutageStartTime = emergencyOutageStartTime
        self.emergencyOutageRestoreTime = emergencyOutageRestoreTime
        self.todaySlots = todaySlots
        self.tomorrowSlots = tomorrowSlots
        self.statusInfo = statusInfo
        self.notificationsEnabled = notificationsEnabled
        self.isRefreshing = isRefreshing
        self.lang = lang
        self.selectedLanguage = selectedLanguage
        self.now = now
        self.onToggleNotifications = onToggleNotifications
        self.onRefresh = onRefresh
        self.onOpenQueueSelection = onOpenQueueSelection
        self.onChangeLanguage = onChangeLanguage
    }

    public var body: some View {
        let hasActiveEmergency = emergencyOutageStartTime != nil && !(emergencyOutageStartTime?.isEmpty ?? true)
        let hasNoQueueMessage = queue.isEmpty && (customQueueStatusText != nil && !(customQueueStatusText?.isEmpty ?? true)) && !hasActiveEmergency
        let isQueueUnselected = queue.isEmpty && !hasNoQueueMessage && !hasActiveEmergency
        let isTomorrowSelected = selectedDayTab == 1
        let effectiveTodaySlots = ScheduleRepository.shared.applyEmergencyOutageToSlots(
            slots: todaySlots,
            startTime: emergencyOutageStartTime,
            restoreTime: emergencyOutageRestoreTime,
            isTomorrow: false
        )
        let effectiveTomorrowSlots = tomorrowSlots.map {
            ScheduleRepository.shared.applyEmergencyOutageToSlots(
                slots: $0,
                startTime: emergencyOutageStartTime,
                restoreTime: emergencyOutageRestoreTime,
                isTomorrow: true
            )
        }
        let activeSlots: [BlackoutSlot] = isTomorrowSelected ? (effectiveTomorrowSlots ?? []) : effectiveTodaySlots
        let activeSlotsSignature = activeSlots.map { $0.isEmergency ? "E" : ($0.status == .POWER_OFF ? "1" : "0") }.joined()
        let activeIntervals = ScheduleRepository.shared.getDetailedIntervals(slots: activeSlots)
        let isUnclear = isQueueUnselected || hasNoQueueMessage || (statusInfo.isUnclear && !hasActiveEmergency) || effectiveTodaySlots.isEmpty

        ZStack {
            ScrollView(.vertical, showsIndicators: false) {
                VStack(spacing: 14) {
                    // Top Header: Queue + Master Notification Switch
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            if isQueueUnselected {
                                Text(AppStrings.APP_NAME)
                                    .font(.system(size: 18, weight: .bold))
                                    .foregroundColor(.white)
                                    .opacity(0.15)
                            } else if !hasNoQueueMessage {
                                Text(AppStrings.APP_NAME)
                                    .font(.system(size: 18, weight: .bold))
                                    .foregroundColor(.white)
                                Text(lang == "en" ? "Queue \(queue)" : "Черга \(queue)")
                                    .font(.system(size: 13, weight: .semibold, design: .monospaced))
                                    .foregroundColor(Color(red: 1.0, green: 0x5E / 255.0, blue: 0x3A / 255.0))
                                if let addr = selectedAddress, !addr.isEmpty {
                                    Text(addr)
                                        .font(.system(size: 11, weight: .medium))
                                        .foregroundColor(.white.opacity(0.7))
                                }
                            }
                        }
                        Spacer()
                        Toggle("", isOn: Binding(
                            get: { notificationsEnabled },
                            set: { _ in onToggleNotifications() }
                        ))
                        .labelsHidden()
                        .tint(Color(red: 1.0, green: 0x5E / 255.0, blue: 0x3A / 255.0))
                        .opacity(isQueueUnselected ? 0.15 : 1.0)
                        .disabled(isQueueUnselected)
                    }
                    .padding(.horizontal, 4)

                VStack(spacing: 14) {
                    // Active Emergency Outage ("Аварійне відключення") Banner with Symmetrical Start & Estimated Restore Times — always shown first with top priority
                    if !isQueueUnselected, let start = emergencyOutageStartTime, !start.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(lang == "en" ? "Emergency Outage" : "Аварійне відключення")
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(Color(red: 1.0, green: 0x5E / 255.0, blue: 0x3A / 255.0))
                            HStack {
                                Text(lang == "en" ? "Start: " : "Початок: ")
                                    .font(.system(size: 11, weight: .medium))
                                    .foregroundColor(.white.opacity(0.75))
                                Spacer()
                                Text(start)
                                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                                    .monospacedDigit()
                                    .foregroundColor(.white)
                            }
                            if let restore = emergencyOutageRestoreTime, !restore.isEmpty {
                                HStack {
                                    Text(lang == "en" ? "Estimated restore: " : "Орієнтовне відновлення: ")
                                        .font(.system(size: 11, weight: .medium))
                                        .foregroundColor(.white.opacity(0.75))
                                    Spacer()
                                    Text(restore)
                                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                                        .monospacedDigit()
                                        .foregroundColor(.white)
                                }
                            }
                        }
                        .padding(16)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(red: 0x14 / 255.0, green: 0x1A / 255.0, blue: 0x29 / 255.0).opacity(0.75))
                        .cornerRadius(24)
                        .shadow(color: Color.black.opacity(0.65), radius: 18, x: 0, y: 12)
                    }

                    // Custom ZTOE Queue/House Status Message Bar — same style/color as other Main screen bars
                    if !isQueueUnselected, let customText = customQueueStatusText, !customText.isEmpty {
                        VStack(alignment: .leading, spacing: 4) {
                            if let addr = selectedAddress, !addr.isEmpty {
                                Text(addr)
                                    .font(.system(size: 11, weight: .medium))
                                    .foregroundColor(.white.opacity(0.7))
                            }
                            Text(customText)
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(.white)
                        }
                        .padding(16)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(red: 0x14 / 255.0, green: 0x1A / 255.0, blue: 0x29 / 255.0).opacity(0.75))
                        .cornerRadius(24)
                        .shadow(color: Color.black.opacity(0.65), radius: 18, x: 0, y: 12)
                    }

                    // Hero Status & Countdown Card
                    VStack(alignment: .leading, spacing: 12) {
                        if !hasNoQueueMessage {
                            HStack(spacing: 8) {
                                Circle()
                                    .fill(isUnclear
                                          ? Color(red: 0x9C / 255.0, green: 0xA3 / 255.0, blue: 0xAF / 255.0)
                                          : (statusInfo.isBlackoutNow
                                             ? Color(red: 0xEF / 255.0, green: 0x44 / 255.0, blue: 0x44 / 255.0)
                                             : Color(red: 0x10 / 255.0, green: 0xB9 / 255.0, blue: 0x81 / 255.0)))
                                    .frame(width: 10, height: 10)
                                    .scaleEffect(statusInfo.isBlackoutNow && pulseActive ? 1.25 : 1.0)

                                Text(isUnclear
                                     ? AppStrings.statusUnclear(lang)
                                     : (statusInfo.isBlackoutNow
                                        ? AppStrings.widgetPowerOff(lang)
                                        : AppStrings.widgetPowerOn(lang)))
                                    .font(.system(size: 13, weight: .bold))
                                    .foregroundColor(.white)
                            }

                            Text(isUnclear ? "--:--:--" : statusInfo.countdownText)
                                .font(.system(size: 36, weight: .heavy, design: .monospaced))
                                .monospacedDigit()
                                .foregroundColor(.white)

                            HStack {
                                Text(lang == "en" ? "Next period:" : "Найближчий період:")
                                    .font(.system(size: 12))
                                    .foregroundColor(.white.opacity(0.7))
                                Spacer()
                                Text(isUnclear ? "--:-- - --:--" : statusInfo.nextSlotTime)
                                    .font(.system(size: 12, weight: .bold, design: .monospaced))
                                    .monospacedDigit()
                                    .foregroundColor(.white)
                            }
                        } else {
                            Text("--:--:--")
                                .font(.system(size: 32, weight: .heavy, design: .monospaced))
                                .monospacedDigit()
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity, alignment: .center)
                                .padding(.vertical, 8)
                        }
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(red: 0x14 / 255.0, green: 0x1A / 255.0, blue: 0x29 / 255.0).opacity(0.75))
                    .cornerRadius(24)
                    .shadow(color: Color.black.opacity(0.65), radius: 18, x: 0, y: 12)

                    // 24h Schedule Card + Outage Hours List keyed by (queue, selectedDayTab, activeSlotsSignature)
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Button(lang == "en" ? "Today" : "Сьогодні") {
                                selectedDayTab = 0
                            }
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(selectedDayTab == 0 ? .black : .white)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(selectedDayTab == 0 ? Color.white : Color.white.opacity(0.08))
                            .cornerRadius(12)

                            Button(lang == "en" ? "Tomorrow" : "Завтра") {
                                selectedDayTab = 1
                            }
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(selectedDayTab == 1 ? .black : .white)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(selectedDayTab == 1 ? Color.white : Color.white.opacity(0.08))
                            .cornerRadius(12)

                            Spacer()

                            Button(action: onRefresh) {
                                Image(systemName: "arrow.clockwise")
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundColor(.white)
                            }
                        }

                        let lightNoOutageSlots: [BlackoutSlot] = (0..<48).map { idx in
                            BlackoutSlot(
                                index: idx,
                                startMinute: idx * 30,
                                endMinute: (idx + 1) * 30,
                                label: "",
                                status: .POWER_ON
                            )
                        }

                        TimelineBar(
                            slots: hasNoQueueMessage ? lightNoOutageSlots : activeSlots,
                            isUnclear: isUnclear && !hasNoQueueMessage,
                            currentMinuteOfDay: KyivZone.minuteOfDay(for: now),
                            showCurrentTimeNeedle: !isTomorrowSelected,
                            lang: lang
                        )
                        .id("\(queue)_\(selectedDayTab)_\(activeSlotsSignature)")

                        if !isUnclear && !hasNoQueueMessage {
                            VStack(alignment: .leading, spacing: 8) {
                                Text(isTomorrowSelected ? AppStrings.blackoutHoursForTomorrowHeader(lang) : AppStrings.blackoutHoursForDayHeader(lang))
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundColor(.white.opacity(0.75))

                                ForEach(activeIntervals) { interval in
                                    HStack(spacing: 12) {
                                        ZStack {
                                            if interval.isEmergency {
                                                Text("!")
                                                    .font(.system(size: 11, weight: .black))
                                                    .foregroundColor(Color(red: 1.0, green: 0x5E / 255.0, blue: 0x3A / 255.0))
                                                    .frame(width: 20, height: 20)
                                                    .background(Color(red: 1.0, green: 0x5E / 255.0, blue: 0x3A / 255.0).opacity(0.2))
                                                    .clipShape(Circle())
                                                    .overlay(
                                                        Circle().stroke(Color(red: 1.0, green: 0x5E / 255.0, blue: 0x3A / 255.0), lineWidth: 1.5)
                                                    )
                                            } else {
                                                Circle()
                                                    .fill(Color(red: 1.0, green: 0x5E / 255.0, blue: 0x3A / 255.0))
                                                    .frame(width: 10, height: 10)
                                                    .shadow(color: Color(red: 1.0, green: 0x5E / 255.0, blue: 0x3A / 255.0), radius: 4)
                                            }
                                        }
                                        .frame(width: 20, height: 20)
                                        Text("\(interval.startStr) – \(interval.endStr)")
                                            .font(.system(size: 13, weight: .bold, design: .monospaced))
                                            .foregroundColor(.white)
                                        Spacer()
                                        Text(String(format: "%.1f год", interval.durationHours))
                                            .font(.system(size: 12, weight: .semibold))
                                            .foregroundColor(Color(red: 1.0, green: 0x5E / 255.0, blue: 0x3A / 255.0))
                                    }
                                    .padding(10)
                                    .background(Color.white.opacity(0.06))
                                    .cornerRadius(12)
                                }
                            }
                            .id("intervals_\(queue)_\(selectedDayTab)_\(activeSlotsSignature)")
                        }
                    }
                    .padding(16)
                    .background(Color(red: 0x14 / 255.0, green: 0x1A / 255.0, blue: 0x29 / 255.0).opacity(0.75))
                    .cornerRadius(24)
                    .shadow(color: Color.black.opacity(0.65), radius: 18, x: 0, y: 12)

                    // Emergency Outages Facebook Link & ZTOE Website Schedules Link
                    VStack(alignment: .leading, spacing: 10) {
                        Text(AppStrings.emergencyOutagesLabel(lang))
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(.white.opacity(0.85))

                        if let fbUrl = URL(string: AppStrings.EMERGENCY_OUTAGES_URL) {
                            Link(destination: fbUrl) {
                                HStack(spacing: 8) {
                                    Image(systemName: "link.circle.fill")
                                        .foregroundColor(Color(red: 0x18 / 255.0, green: 0x77 / 255.0, blue: 0xF2 / 255.0))
                                    Text(AppStrings.EMERGENCY_OUTAGES_URL)
                                        .font(.system(size: 12, weight: .bold))
                                        .foregroundColor(.white)
                                        .lineLimit(1)
                                }
                            }
                        }

                        if let ztoeUrl = URL(string: AppStrings.DEFAULT_ZTOE_URL) {
                            Link(destination: ztoeUrl) {
                                HStack(spacing: 8) {
                                    Image(systemName: "globe")
                                        .foregroundColor(Color(red: 1.0, green: 0x5E / 255.0, blue: 0x3A / 255.0))
                                    Text(AppStrings.ztoeSiteSchedulesLinkLabel(lang))
                                        .font(.system(size: 12, weight: .bold))
                                        .foregroundColor(.white)
                                }
                            }
                        }
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(red: 0x14 / 255.0, green: 0x1A / 255.0, blue: 0x29 / 255.0).opacity(0.75))
                    .cornerRadius(24)
                    .shadow(color: Color.black.opacity(0.65), radius: 18, x: 0, y: 12)
                }
                .opacity(isQueueUnselected ? 0.15 : 1.0)
                .disabled(isQueueUnselected)
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 96)
            }
            .disabled(isQueueUnselected)

            if isQueueUnselected {
                VStack(spacing: 20) {
                    Spacer()
                    Button(action: { onOpenQueueSelection?() }) {
                        VStack(spacing: 6) {
                            Text(lang == "en" ? "Select queue" : "Виберіть чергу")
                                .font(.system(size: 22, weight: .heavy))
                                .foregroundColor(.white)
                            Text("Житомиробленерго (ZTOE)")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(.white.opacity(0.9))
                        }
                        .padding(.horizontal, 32)
                        .padding(.vertical, 20)
                        .frame(minWidth: 260)
                        .background(Color(red: 1.0, green: 0x5E / 255.0, blue: 0x3A / 255.0))
                        .cornerRadius(24)
                        .shadow(color: Color(red: 1.0, green: 0x5E / 255.0, blue: 0x3A / 255.0).opacity(0.5), radius: 20, x: 0, y: 10)
                    }

                    Picker("Language", selection: Binding(
                        get: { selectedLanguage.isEmpty ? "system" : selectedLanguage },
                        set: { code in onChangeLanguage?(code) }
                    )) {
                        Text("Auto").tag("system")
                        Text("English").tag("en")
                        Text("Українська").tag("uk")
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 260)
                    .padding(6)
                    .background(Color(red: 0x14 / 255.0, green: 0x1A / 255.0, blue: 0x29 / 255.0).opacity(0.9))
                    .cornerRadius(16)
                    Spacer()
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
    }
}
