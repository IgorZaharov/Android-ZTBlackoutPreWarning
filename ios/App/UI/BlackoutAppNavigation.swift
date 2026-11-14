import SwiftUI

public struct BlackoutAppNavigation: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var settings: UserSettings = SettingsRepository.shared.loadSettings()
    @State private var todaySlots: [BlackoutSlot] = []
    @State private var tomorrowSlots: [BlackoutSlot]? = nil
    @State private var statusInfo: StatusAndCountdown = StatusAndCountdown(
        isBlackoutNow: false,
        isUnclear: false,
        countdownText: "--:--:--",
        nextSlotTime: "--:-- - --:--"
    )
    @State private var donations: [DonationItem] = DonationsRepository.DEFAULT_DONATIONS
    @State private var selectedPage: Int = 0
    @State private var autoOpenQueueHelp: Bool = false
    @State private var isRefreshing: Bool = false
    @State private var now: Date = Date()

    public init() {}

    public var body: some View {
        let lang = AppStrings.resolveLanguage(settings.language)
        let currentMinuteOfDay = KyivZone.minuteOfDay(for: now)
        let palette = TimeOfDayPalette.getInterpolatedPalette(now: now)

        ZStack {
            // Minute-keyed ambient radial gradient background
            RadialGradient(
                gradient: Gradient(colors: [palette.primary, palette.secondary]),
                center: .center,
                startRadius: 20,
                endRadius: 480
            )
            .id("bg_\(currentMinuteOfDay)")
            .ignoresSafeArea()

            TabView(selection: $selectedPage) {
                MainScreen(
                    queue: settings.queue,
                    customQueueStatusText: settings.customQueueStatusText,
                    selectedAddress: settings.selectedAddress,
                    emergencyOutageStartTime: settings.activeEmergencyOutageStart,
                    emergencyOutageRestoreTime: settings.activeEmergencyOutageRestore,
                    todaySlots: todaySlots,
                    tomorrowSlots: tomorrowSlots,
                    statusInfo: statusInfo,
                    notificationsEnabled: settings.notificationsEnabled,
                    isRefreshing: isRefreshing,
                    lang: lang,
                    selectedLanguage: settings.language,
                    now: now,
                    onToggleNotifications: {
                        settings = SettingsRepository.shared.updateNotificationsEnabled(!settings.notificationsEnabled)
                        NotificationScheduler.shared.syncAlarms()
                    },
                    onRefresh: {
                        Task { await refreshSchedules() }
                    },
                    onOpenQueueSelection: {
                        autoOpenQueueHelp = true
                        selectedPage = 1
                    },
                    onChangeLanguage: { newLanguage in
                        var updated = settings
                        updated.language = newLanguage
                        settings = updated
                        SettingsRepository.shared.saveSettings(updated)
                    }
                )
                .tag(0)

                SettingsScreen(
                    settings: settings,
                    lang: lang,
                    autoOpenQueueHelp: autoOpenQueueHelp,
                    onQueueHelpOpened: {
                        autoOpenQueueHelp = false
                    },
                    onUpdateSettings: { newSettings in
                        let wasUnselected = settings.queue.isEmpty &&
                            (settings.customQueueStatusText?.isEmpty ?? true) &&
                            (settings.selectedAddress?.isEmpty ?? true)
                        let isNowSelected = !newSettings.queue.isEmpty ||
                            !(newSettings.customQueueStatusText?.isEmpty ?? true) ||
                            !(newSettings.selectedAddress?.isEmpty ?? true)
                        let intervalChanged = newSettings.refreshIntervalMinutes != settings.refreshIntervalMinutes
                        settings = newSettings
                        SettingsRepository.shared.saveSettings(newSettings)
                        reloadLocalSlots()
                        NotificationScheduler.shared.syncAlarms()
                        if intervalChanged {
                            BackgroundSyncManager.shared.schedulePeriodicWork()
                        }
                        if wasUnselected && isNowSelected {
                            selectedPage = 0
                        }
                    },
                    onSendTestAlert: {
                        NotificationScheduler.shared.showPreWarningNotification(
                            slotId: "test_manual",
                            settings: settings,
                            lang: lang,
                            intervalText: statusInfo.nextSlotTime,
                            isTest: true
                        )
                    },
                    onForceRefresh: {
                        Task { await refreshSchedules() }
                    },
                    onResetDefaults: {
                        AlertRegistry.shared.clearAll()
                        settings = SettingsRepository.shared.resetDefaults()
                        reloadLocalSlots()
                        NotificationScheduler.shared.syncAlarms()
                        BackgroundSyncManager.shared.schedulePeriodicWork()
                    }
                )
                .tag(1)

                AboutScreen(
                    lang: lang,
                    donations: donations
                )
                .tag(2)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))

            // Bottom floating capsule navigation bar (dimmed/disabled on first start)
            Group {
                let isFirstStartLocked = settings.queue.isEmpty &&
                    (settings.customQueueStatusText?.isEmpty ?? true) &&
                    (settings.activeEmergencyOutageStart?.isEmpty ?? true) &&
                    selectedPage == 0
                VStack {
                    Spacer()
                    HStack(spacing: 24) {
                        navButton(icon: "house.fill", index: 0)
                        navButton(icon: "gearshape.fill", index: 1)
                        navButton(icon: "info.circle.fill", index: 2)
                    }
                    .padding(.horizontal, 24)
                    .padding(.vertical, 10)
                    .background(Color(red: 0x14 / 255.0, green: 0x1A / 255.0, blue: 0x29 / 255.0).opacity(0.85))
                    .clipShape(Capsule())
                    .padding(.bottom, 16)
                    .opacity(isFirstStartLocked ? 0.15 : 1.0)
                    .disabled(isFirstStartLocked)
                }
            }
        }
        .onChange(of: selectedPage) { _, newPage in
            if newPage == 0 {
                let currentNow = Date()
                now = currentNow
                updateCountdownStatus(at: currentNow)
            }
        }
        .task {
            NotificationScheduler.shared.requestAuthorizationIfNeeded()
            reloadLocalSlots()
            await refreshSchedules()
            donations = await DonationsRepository.shared.getDonationsWithDailyRefresh(forceRefresh: false)
        }
        .task(id: "\(scenePhase)_\(selectedPage)") {
            // Battery-optimized foreground ticker: runs 1s countdown updates ONLY while scenePhase == .active,
            // on the Main screen (selectedPage == 0)
            guard scenePhase == .active, selectedPage == 0 else { return }
            var lastDateStr = KyivZone.todayIsoString(now: now)
            while !Task.isCancelled && scenePhase == .active && selectedPage == 0 {
                let currentNow = Date()
                now = currentNow
                let currentDateStr = KyivZone.todayIsoString(now: currentNow)
                if currentDateStr != lastDateStr {
                    // Midnight day rollover: automatically promote tomorrow's schedule to today's schedule
                    lastDateStr = currentDateStr
                    reloadLocalSlots(at: currentNow)
                    NotificationScheduler.shared.syncAlarms(onTimeChanged: false, now: currentNow)
                } else {
                    updateCountdownStatus(at: currentNow)
                }
                let sleepNs: UInt64 = (statusInfo.countdownText == "--:--:--") ? 15_000_000_000 : 1_000_000_000
                try? await Task.sleep(nanoseconds: sleepNs)
            }
        }
    }

    private func reloadLocalSlots(at date: Date? = nil) {
        let targetNow = date ?? now
        todaySlots = ScheduleRepository.shared.getTodaySlots(queue: settings.queue, now: targetNow)
        tomorrowSlots = ScheduleRepository.shared.getTomorrowSlots(queue: settings.queue, now: targetNow)
        updateCountdownStatus(at: targetNow)
    }

    private func updateCountdownStatus(at targetNow: Date) {
        let effectiveToday = ScheduleRepository.shared.applyEmergencyOutageToSlots(
            slots: todaySlots,
            startTime: settings.activeEmergencyOutageStart,
            restoreTime: settings.activeEmergencyOutageRestore,
            isTomorrow: false
        )
        let effectiveTomorrow: [BlackoutSlot]? = {
            if let tom = tomorrowSlots {
                return ScheduleRepository.shared.applyEmergencyOutageToSlots(
                    slots: tom,
                    startTime: settings.activeEmergencyOutageStart,
                    restoreTime: settings.activeEmergencyOutageRestore,
                    isTomorrow: true
                )
            } else if let start = settings.activeEmergencyOutageStart, !start.isEmpty {
                return ScheduleRepository.shared.applyEmergencyOutageToSlots(
                    slots: [],
                    startTime: start,
                    restoreTime: settings.activeEmergencyOutageRestore,
                    isTomorrow: true
                )
            }
            return nil
        }()
        statusInfo = ScheduleRepository.shared.calculateStatusAndCountdown(
            slots: effectiveToday,
            tomorrowSlots: effectiveTomorrow,
            now: targetNow
        )
    }

    private func refreshSchedules() async {
        isRefreshing = true
        if let savedAddress = settings.selectedAddress, !savedAddress.isEmpty {
            // Re-check saved address against ZTOE website in case it received a queue at a later stage
            _ = await ZtoeParser.fetchFullSchedule(urlStr: settings.url, now: Date())
        } else {
            _ = await ZtoeParser.fetchFullSchedule(urlStr: settings.url, now: Date())
        }
        reloadLocalSlots()
        NotificationScheduler.shared.syncAlarms()
        isRefreshing = false
    }

    @ViewBuilder
    private func navButton(icon: String, index: Int) -> some View {
        Button(action: { selectedPage = index }) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .bold))
                .foregroundColor(selectedPage == index ? .black : .white.opacity(0.75))
                .frame(width: 40, height: 40)
                .background(selectedPage == index ? Color.white : Color.clear)
                .clipShape(Circle())
        }
    }
}
