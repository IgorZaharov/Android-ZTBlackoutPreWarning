import Foundation
import UserNotifications

/// Applies `NotificationPlanner` to the notification center (Android `AlarmScheduler.syncAlarms` and
/// `NotificationHelper.postEmergencyEvents`). An actor, so a foreground refresh, a background refresh and
/// a settings change never interleave their diffs.
///
/// iOS shows a scheduled notification without running app code, so the fired registry (`AlertRegistry`)
/// learns about a planned warning at the next sync: an alert this adapter scheduled whose time has come
/// and that iOS no longer holds was delivered, and its members are marked warned (spec/SUBSCRIPTIONS.md 8.2).
public actor NotificationSync {
    public static let shared = NotificationSync()

    private let center = UNUserNotificationCenter.current()
    private let registry = AlertRegistry.shared
    /// What the last sync scheduled: identifier -> fire time and member keys.
    private let prefs = Prefs("zt_scheduled_alerts_v1")
    private static let KEY_SCHEDULED = "scheduled_planned"

    // MARK: - Planned pre-warnings

    /// Re-plans the planned pre-warnings of every address from the stored state and diffs them against
    /// the pending requests. Called on launch, on every foreground and background refresh and after
    /// every change of the addresses, the switches, the advance notice, the sound or the language.
    public func syncPlanned(now: Date = Date()) async {
        let settings = SettingsRepository.shared.getSettings()
        let subscriptions = SubscriptionSync.shared
        let store = subscriptions.store()
        let master = subscriptions.master()
        let at = KyivTime.localDateTime(of: now)
        let requests = await center.pendingNotificationRequests()
        let pendingIds = Set(requests.map(\.identifier))

        // 1. scheduled earlier, time has come, no longer pending: iOS delivered it
        var scheduled = loadScheduled()
        for (id, rec) in scheduled where !pendingIds.contains(id) && !rec.fireAt.isAfter(at) {
            rec.members.forEach { registry.markNotified($0) }
            scheduled[id] = nil
        }

        // 2. the plan of every address, the earliest 40
        let repo = OutageRepository.shared
        let groups = NotificationPlanner.plannedGroups(
            store: store, master: master, now: at, advanceMinutes: settings.advanceNoticeMinutes
        ) { item in repo.outagesFor(queue: item.queue, key: item.address?.key, now: at) }
        let desired = NotificationPlanner.plannedAlerts(
            groups, store: store, lang: AppStrings.resolveLang(settings.language),
            sound: master && settings.soundEnabled, notified: { self.registry.hasNotified($0) }
        )

        // 3. diff by key against what iOS holds
        var pending: [String: NotificationPlanner.Pending] = [:]
        for r in requests {
            let fireAt = (r.trigger as? UNCalendarNotificationTrigger).flatMap { NotificationPlanner.localDateTime($0.dateComponents) }
            pending[r.identifier] = NotificationPlanner.Pending(fireAt: fireAt, body: r.content.body, sound: r.content.sound != nil)
        }
        let diff = NotificationPlanner.diff(pending: pending, desired: desired)
        if !diff.remove.isEmpty { center.removePendingNotificationRequests(withIdentifiers: diff.remove) }
        var added = Set<String>()
        for alert in diff.add {
            do {
                try await center.add(Self.request(alert))
                added.insert(alert.identifier)
            } catch {
                // not allowed (no permission) or refused: planned again at the next sync
            }
        }

        // 4. remember what is scheduled now (kept or added)
        let kept = Set(pending.keys).subtracting(diff.remove)
        var next: [String: Scheduled] = [:]
        for a in desired where added.contains(a.identifier) || kept.contains(a.identifier) {
            if let fireAt = a.fireAt { next[a.identifier] = Scheduled(fireAt: fireAt, members: a.memberKeys) }
        }
        saveScheduled(next)
    }

    // MARK: - Emergency events

    /// Posts the events a refresh produced (spec/NOTIFICATIONS.md 2). Each event is announced once; the
    /// master switch silences every one of them (owner decision 1), and a silenced event is not replayed.
    public func deliverEmergency(_ batches: [EmergencyBatch], now: Date = Date()) async {
        guard !batches.isEmpty else { return }
        let settings = SettingsRepository.shared.getSettings()
        let master = SubscriptionSync.shared.master()
        let lang = AppStrings.resolveLang(settings.language)
        let at = KyivTime.localDateTime(of: now)
        for batch in batches {
            let alerts = NotificationPlanner.emergencyAlerts(
                batch, settings: settings, lang: lang, now: at, sound: master && settings.soundEnabled,
                fired: { self.registry.hasFired($0) }, markFired: { self.registry.markFired($0) }
            )
            guard master else { continue }
            for alert in alerts { try? await center.add(Self.request(alert)) }
        }
    }

    // MARK: - Helpers

    public func authorizationStatus() async -> UNAuthorizationStatus {
        await center.notificationSettings().authorizationStatus
    }

    /// Asks iOS for permission (App Review item R5: only after the user chose a queue or an address and
    /// read why), then plans the warnings at once.
    @discardableResult
    public func requestAuthorization() async -> Bool {
        let granted = (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        if granted { await syncPlanned() }
        return granted
    }

    static func request(_ a: LocalAlert) -> UNNotificationRequest {
        let content = UNMutableNotificationContent()
        content.title = a.title
        content.body = a.body
        content.categoryIdentifier = a.category.rawValue
        content.threadIdentifier = a.thread
        if a.sound { content.sound = .default }
        if let id = a.subscriptionId { content.userInfo = [NotificationSync.SUBSCRIPTION_ID: id] }
        let trigger = a.fireAt.map { UNCalendarNotificationTrigger(dateMatching: NotificationPlanner.triggerComponents($0), repeats: false) }
        return UNNotificationRequest(identifier: a.identifier, content: content, trigger: trigger)
    }

    /// `userInfo` key of the address a tap shows (spec/SUBSCRIPTIONS.md 9).
    public static let SUBSCRIPTION_ID = "subscriptionId"

    private struct Scheduled {
        let fireAt: LocalDateTime
        let members: [String]
    }

    private func loadScheduled() -> [String: Scheduled] {
        guard let raw = prefs.object(Self.KEY_SCHEDULED) as? [String: [String: Any]] else { return [:] }
        var out: [String: Scheduled] = [:]
        for (id, v) in raw {
            guard let t = (v["fireAt"] as? String).flatMap({ LocalDateTime(iso: $0) }) else { continue }
            out[id] = Scheduled(fireAt: t, members: v["members"] as? [String] ?? [])
        }
        return out
    }

    private func saveScheduled(_ s: [String: Scheduled]) {
        prefs.set(Self.KEY_SCHEDULED, s.mapValues { ["fireAt": $0.fireAt.description, "members": $0.members] as [String: Any] })
    }
}
