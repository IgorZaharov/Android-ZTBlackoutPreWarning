import Foundation
import SwiftUI
import WidgetKit

/// State and actions of the three pages (port of Android `ui/screens/BlackoutAppNavigation.kt`).
///
/// Everything the screens show about outages comes from one `OutageSnapshot` of the stored state.
/// Android re-reads its stores from SharedPreferences listeners; iOS has no listeners, so every action
/// here calls `reload()` after it writes, and the root view calls it again when the app comes to the
/// foreground (a widget or a background refresh may have written meanwhile).
@MainActor
final class AppModel: ObservableObject {
    // Stores
    private let settingsRepo = SettingsRepository.shared
    private let scheduleRepo = ScheduleRepository.shared
    private let outageRepo = OutageRepository.shared
    private let outageStore = OutageStateStore.shared
    private let sync = SubscriptionSync.shared

    // Persisted state, re-read by reload()
    @Published private(set) var settings: UserSettings
    @Published private(set) var subscriptions: SubscriptionStore
    @Published private(set) var alertsMaster: Bool

    // Session state
    /// The address the main screen shows; a cold start shows the primary (spec/SUBSCRIPTIONS.md 9).
    @Published var shownSubscriptionId: String? {
        didSet { if oldValue != shownSubscriptionId { shownChanged() } }
    }
    @Published private(set) var snapshot: OutageSnapshot
    @Published private(set) var statusInfo: ScheduleStatusInfo
    @Published private(set) var isRefreshing = false
    @Published private(set) var bannerMessage: String?
    /// 0 = main, 1 = settings, 2 = about. Follows the pager (swipes write it back).
    @Published var page: Int? = 0
    /// A page change the app asks for (dock, "Select queue", reset): RootView scrolls the pager to it.
    /// The pager's `scrollPosition` alone ignores a value set before its first layout.
    @Published private(set) var pageJump = PageJump(page: 0, seq: 0)

    struct PageJump: Equatable {
        let page: Int
        let seq: Int
    }

    func go(to target: Int) {
        page = target
        pageJump = PageJump(page: target, seq: pageJump.seq + 1)
    }
    /// Main's "Select queue" asks Settings to open the address lookup at once.
    @Published var autoOpenQueueHelp = false

    private var hasCompletedInitialScheduleFetch = false
    private var bannerTask: Task<Void, Never>?

    init() {
        let s = SettingsRepository.shared.getSettings()
        settings = s
        subscriptions = SubscriptionSync.shared.ensureReady()
        alertsMaster = SubscriptionSync.shared.master()
        let snap = OutageRepository.shared.snapshot(s)
        snapshot = snap
        statusInfo = snap.scheduleStatus()
        // CI screenshots: `-ZTPage 0|1|2` opens a page, `-ZTLookup 1` the address lookup
        let d = UserDefaults.standard
        if let p = d.string(forKey: "ZTPage").flatMap(Int.init), (0...2).contains(p) { go(to: p) }
        if d.bool(forKey: "ZTLookup") {
            go(to: 1)
            autoOpenQueueHelp = true
        }
    }

    // MARK: - Derived

    var lang: String { AppStrings.resolveLang(settings.language) }

    /// An address counts as a selection even when it has no queue and no emergency right now.
    var isQueueUnselected: Bool {
        settings.queue.ktIsBlank && (settings.customQueueStatusText ?? "").ktIsBlank && settings.selectedAddressQuery == nil
    }

    /// The shown item when it is not the primary; the primary is read through the mirrored settings.
    var otherShownItem: Subscription? {
        guard let item = Subscriptions.viewItem(subscriptions, selectedId: shownSubscriptionId), item.id != subscriptions.primaryId else { return nil }
        return item
    }

    /// Fields of the main screen for the shown address.
    var shownQueue: String { otherShownItem.map { $0.queue ?? "" } ?? settings.queue }
    var shownStatusText: String? { otherShownItem.map { $0.queueStatusText } ?? settings.customQueueStatusText }
    var shownAddress: String? {
        if let other = otherShownItem {
            return other.address.map { $0.text.ktIsBlank ? Subscriptions.displayLabel(other) : $0.text }
        }
        return settings.selectedAddress
    }

    /// "Last updated" is the last successful ztoe fetch; "next" is one refresh interval after the last check.
    var lastUpdated: String {
        let ms = snapshot.site?.lastSuccessMs ?? (scheduleRepo.lastSyncMs() > 0 ? scheduleRepo.lastSyncMs() : nil)
        return ms.map(SiteStatusModel.formatHhmm) ?? "--:--"
    }

    var nextUpdated: String {
        let checked = snapshot.site?.checkedAtMs ?? 0
        let base = checked > 0 ? checked : Int64(Date().timeIntervalSince1970 * 1000)
        return SiteStatusModel.formatHhmm(base + Int64(settings.refreshIntervalMinutes) * 60_000)
    }

    // MARK: - Snapshot

    private func shownSnapshot(_ now: LocalDateTime? = nil) -> OutageSnapshot {
        if let other = otherShownItem { return outageRepo.snapshotFor(other, now: now) }
        return outageRepo.snapshot(settings, now: now)
    }

    /// Re-reads every store and recomputes the snapshot (Android's preference listeners).
    func reload() {
        settings = settingsRepo.getSettings()
        subscriptions = sync.store()
        alertsMaster = sync.master()
        recompute()
    }

    func recompute() {
        snapshot = shownSnapshot()
        statusInfo = snapshot.scheduleStatus()
    }

    /// One tick of the live countdown. Returns the delay to the next tick: every second, every 15 s
    /// while there is nothing to count down to (battery friendly, as on Android).
    func tick() -> Duration {
        recompute()
        let idle = !statusInfo.isBlackoutNow && statusInfo.countdownText == "--:--:--" && statusInfo.nextSlotTime == "Відключень немає"
        return idle ? .seconds(15) : .seconds(1)
    }

    // MARK: - Refresh

    /// Re-checks the saved address (a house without a queue may get one), then refreshes both sources
    /// through `OutageRepository`. A failing source keeps its old data.
    @discardableResult
    func runRefresh(force: Bool, resolveAddress: Bool) async -> RefreshOutcome {
        isRefreshing = true
        defer { isRefreshing = false }
        let current = settingsRepo.getSettings()
        if resolveAddress, let q = current.selectedAddressQuery, !q.streetId.ktIsBlank, !q.house.ktIsBlank {
            if let lookup = await ZtoeAddressLookup.checkAddressOnZtoeWebsite(
                remId: q.remId, settlementId: q.settlementId, streetId: q.streetId, house: q.house, siteUrl: current.cityUrl
            ) {
                let latest = settingsRepo.getSettings()
                let status = lookup.statusText ?? ""
                let nextQueue = !lookup.queue.ktIsBlank ? lookup.queue : (!status.ktIsBlank ? "" : latest.queue)
                let nextStatus: String? = !lookup.queue.ktIsBlank ? nil : (!status.ktIsBlank ? status : latest.customQueueStatusText)
                let nextLabel = lookup.addressLabel.ktIsBlank ? latest.selectedAddress : lookup.addressLabel
                if nextQueue != latest.queue || nextStatus != latest.customQueueStatusText || nextLabel != latest.selectedAddress {
                    // into the primary subscription, which is mirrored back into the settings keys
                    sync.assignPrimaryQueue(queue: nextQueue, statusText: nextStatus, addressText: nextLabel)
                }
            }
        }
        let outcome = await outageRepo.refresh(settingsRepo.getSettings(), forceNetwork: force, shownId: otherShownItem?.id)
        syncWidgets()
        reload()
        return outcome
    }

    /// The selection that decides what is fetched changed (or the app started): refresh both sources.
    func selectionChanged() async {
        if settings.queue.ktIsBlank && settings.selectedAddressQuery == nil {
            hasCompletedInitialScheduleFetch = true
            recompute()
            return
        }
        await runRefresh(force: false, resolveAddress: true)
        hasCompletedInitialScheduleFetch = true
    }

    /// Entering the main page: fresh numbers at once, then a quiet refresh.
    func mainPageShown() async {
        recompute()
        if hasCompletedInitialScheduleFetch {
            await runRefresh(force: false, resolveAddress: true)
        }
    }

    private func shownChanged() {
        recompute()
        // another address is shown: poll its PowerOn too (its switches gate notifications only)
        if hasCompletedInitialScheduleFetch && otherShownItem != nil {
            Task { await runRefresh(force: false, resolveAddress: false) }
        }
    }

    /// Manual refresh: always goes to the network and tells the user what the site answered.
    func manualRefresh() {
        guard !isRefreshing else { return }
        Task {
            let outcome = await runRefresh(force: true, resolveAddress: true)
            let l = lang
            let message: String
            switch outcome.siteState {
            case nil, .AVAILABLE_WITH_TABLE: message = AppStrings.refreshSuccessToast(l)
            case .AVAILABLE_NO_TABLE: message = AppStrings.siteStateNoTable(l)
            case .SITE_UNREACHABLE: message = AppStrings.siteStateUnreachable(l)
            case .NO_INTERNET: message = AppStrings.siteStateNoInternet(l)
            }
            showBanner(message)
        }
    }

    /// Loads the address index from the disk cache and the site after the first frame, so the "?"
    /// lookup opens without delay.
    func prefetchAddressIndex() async {
        try? await Task.sleep(for: .milliseconds(250))
        let q = settings.selectedAddressQuery
        await ZtoeAddressLookup.prefetchAddressIndexInBackground(
            siteUrl: settings.cityUrl, savedRemId: q?.remId, savedSettlementId: q?.settlementId, savedStreetId: q?.streetId
        )
    }

    private func syncWidgets() {
        // Alerts are re-planned in milestone M5; widgets read the same stores (M6).
        WidgetCenter.shared.reloadAllTimelines()
    }

    // MARK: - In-app banner (replaces Android's toast)

    func showBanner(_ message: String) {
        bannerTask?.cancel()
        withAnimation(.easeOut(duration: 0.25)) { bannerMessage = message }
        bannerTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(3))
            guard !Task.isCancelled else { return }
            withAnimation(.easeIn(duration: 0.25)) { self?.bannerMessage = nil }
        }
    }

    // MARK: - Addresses (spec/SUBSCRIPTIONS.md section 4)

    /// Shows why a store change was refused; on success the primary is mirrored and widgets follow.
    @discardableResult
    private func apply(_ result: StoreResult) -> Bool {
        switch result {
        case .ok:
            syncWidgets()
            reload()
            return true
        case let .error(code, _):
            if code == Subscriptions.ERR_DUPLICATE { showBanner(AppStrings.addressDuplicate(lang)) }
            if code == Subscriptions.ERR_LIMIT { showBanner(AppStrings.addressLimitReached(lang, Subscriptions.MAX_ITEMS)) }
            return false
        }
    }

    func addAddress(queue: String, statusText: String?, addressLabel: String, query: SelectedAddressQuery) {
        // the user stays in Settings (owner request): the address is added in place
        if apply(sync.addFromLookup(queue: queue, statusText: statusText, addressText: addressLabel, query: query)) {
            showBanner(AppStrings.addressAdded(lang))
        }
    }

    func addQueueOnly(_ queue: String) { apply(sync.addQueueOnly(queue)) }
    func remove(_ id: String) { apply(sync.change { Subscriptions.remove($0, id: id) }) }
    func makePrimary(_ id: String) { apply(sync.change { Subscriptions.setPrimary($0, id: id) }) }
    func setPlanned(_ id: String, _ on: Bool) { apply(sync.change { Subscriptions.setPlanned($0, id: id, on: on) }) }
    func setEmergency(_ id: String, _ on: Bool) { apply(sync.change { Subscriptions.setEmergency($0, id: id, on: on) }) }
    func rename(_ id: String, _ label: String) { apply(sync.change { Subscriptions.rename($0, id: id, raw: label) }) }
    func move(_ id: String, to index: Int) { apply(sync.change { Subscriptions.move($0, id: id, toIndex: index) }) }

    // MARK: - Settings

    private func save(_ change: (inout UserSettings) -> Void) {
        var s = settingsRepo.getSettings()
        change(&s)
        settingsRepo.saveSettings(s)
        reload()
    }

    /// The header bell and the Settings master switch: all addresses at once (owner decision 4).
    func setMaster(_ on: Bool) {
        sync.setMaster(on)
        syncWidgets()
        reload()
    }

    func setSiteUrl(_ url: String) { save { $0.cityUrl = url } }
    func setAdvanceMinutes(_ m: Int) { save { $0.advanceNoticeMinutes = m } }
    func setRefreshMinutes(_ m: Int) { save { $0.refreshIntervalMinutes = m } }
    func setSound(_ on: Bool) { save { $0.soundEnabled = on; $0.prevSoundEnabled = on } }
    func setEmergencyEtaAlerts(_ on: Bool) { save { $0.emergencyEtaAlerts = on } }
    func setEmergencyEndAlerts(_ on: Bool) { save { $0.emergencyEndAlerts = on } }

    func setLanguage(_ code: String) {
        save { $0.language = code }
        syncWidgets()
    }

    func sendTestAlert() {
        let queue = settings.queue.ktIsBlank ? "1.1" : settings.queue
        TestAlert.send(
            title: AppStrings.testAlertTitle(lang),
            body: AppStrings.testAlertBody(lang, queue, settings.advanceNoticeMinutes),
            sound: alertsMaster && settings.soundEnabled
        )
        showBanner(AppStrings.testAlertSent(lang))
    }

    /// "Reset to defaults": first-launch settings (queue unselected, timers 15/30 min), no cached data.
    func resetDefaults() {
        settingsRepo.resetAllAppDataToFirstLaunch()
        scheduleRepo.clearScheduleCache()
        outageStore.clearAll()
        shownSubscriptionId = nil
        subscriptions = sync.ensureReady()
        go(to: 0)
        syncWidgets()
        reload()
        showBanner(AppStrings.settingsReset(lang))
    }

    // MARK: - CI screenshots

    /// `-ZTSeedQueues 5.2,3.1` adds queue-only addresses on an empty store, so CI can screenshot the
    /// filled screens without typing (ios/scripts/gallery_screenshots.sh). Never used by people.
    static func applyLaunchSeed() {
        let d = UserDefaults.standard
        let sync = SubscriptionSync.shared
        if let lang = d.string(forKey: "ZTLang") {
            var s = SettingsRepository.shared.getSettings()
            s.language = lang
            SettingsRepository.shared.saveSettings(s)
        }
        guard let raw = d.string(forKey: "ZTSeedQueues"), sync.ensureReady().items.isEmpty else { return }
        for q in raw.split(separator: ",").map({ String($0).ktTrim() }) where Subscriptions.isValidQueue(q) {
            sync.addQueueOnly(q)
        }
    }
}
