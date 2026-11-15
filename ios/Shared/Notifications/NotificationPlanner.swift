import Foundation

/// One local notification the app wants iOS to hold or show: the platform-free form of a
/// `UNNotificationRequest`, so the plan and the diff are unit tested without the notification center.
public struct LocalAlert: Equatable, Sendable {
    public enum Category: String, Sendable { case planned, emergency }

    /// `UNNotificationRequest.identifier`: the planned group key or the emergency event key (spec/NOTIFICATIONS.md).
    public var identifier: String
    /// Kyiv wall-clock time to fire at; nil = deliver now (emergency events).
    public var fireAt: LocalDateTime?
    public var title: String
    public var body: String
    public var category: Category
    /// Groups the notifications of one address in Notification Center (`threadIdentifier`).
    public var thread: String
    /// The address a tap shows on the main screen (spec/SUBSCRIPTIONS.md 9).
    public var subscriptionId: String?
    public var sound: Bool
    /// Fired-registry keys to mark when this alert has been delivered (planned members).
    public var memberKeys: [String]
}

/// The iOS notification adapter's rules (spec/NOTIFICATIONS.md 1.2 and 2; Android `AlarmScheduler`,
/// `AlarmReceiver` and `NotificationHelper.postEmergencyEvents`). Pure: `NotificationSync` applies the result.
public enum NotificationPlanner {
    /// iOS keeps at most 64 pending local notifications per app; planned pre-warnings use the earliest 40
    /// (spec/NOTIFICATIONS.md 1.2), the rest is left for emergency events.
    public static let MAX_PENDING_PLANNED = 40
    /// Identifiers this adapter owns among the pending requests: planned groups and the 1.3.5 per-slot ids.
    public static let PLANNED_PREFIX = "planned_"
    public static let LEGACY_PREFIX = "block_"

    // MARK: - Planned pre-warnings

    /// The planned groups of every address at `now` (Android `AlarmScheduler.plannedGroups`).
    public static func plannedGroups(
        store: SubscriptionStore,
        master: Bool,
        now: LocalDateTime,
        advanceMinutes: Int,
        outagesFor: (Subscription) -> [Outage]
    ) -> [PlannedGroup] {
        guard master else { return [] }
        var alerts: [String: [AlertSpec]] = [:]
        for item in store.items where Subscriptions.plannedActive(master: master, item: item) {
            alerts[item.id] = OutageEngine.planAlerts(outagesFor(item), now: now, advanceMinutes: advanceMinutes)
        }
        return Subscriptions.groupAlerts(store, master: master, alertsById: alerts)
    }

    /// One request per group that still has a member not warned yet, the earliest `limit` of them.
    /// The text is fixed when scheduled (iOS can not compute it at delivery), so "через N хв" is the
    /// distance from `fireAt` to the start: the advance notice.
    public static func plannedAlerts(
        _ groups: [PlannedGroup],
        store: SubscriptionStore,
        lang: String,
        sound: Bool,
        notified: (String) -> Bool,
        limit: Int = MAX_PENDING_PLANNED
    ) -> [LocalAlert] {
        let due = groups.filter { !Subscriptions.pendingMembers($0, notified: notified).isEmpty }
        return due.prefix(limit).map { g in
            let body = AppStrings.plannedAlertBody(
                lang,
                g.queue,
                // a start is never "24:00": an outage starting at midnight reads 00:00
                String(format: "%02d:%02d", g.spanStart.hour, g.spanStart.minute),
                OutageEngine.formatSpanTime(g.spanEnd),
                KyivTime.minutesBetween(g.fireAt, g.spanStart),
                g.durationMinutes,
                g.mayContinue,
                labels: Subscriptions.alertLabels(store, memberIds: g.memberIds)
            )
            return LocalAlert(
                identifier: g.key,
                fireAt: g.fireAt,
                title: AppStrings.plannedAlertTitle(lang),
                body: body,
                category: .planned,
                // a tap shows the first member, the primary when it is one (spec/SUBSCRIPTIONS.md 9)
                thread: g.memberIds.first ?? "q\(g.queue)",
                subscriptionId: g.memberIds.first,
                sound: sound,
                memberKeys: g.memberIds.map { Subscriptions.memberKey(id: $0, spanStart: g.spanStart) }
            )
        }
    }

    /// What iOS has pending for one of our identifiers.
    public struct Pending: Equatable, Sendable {
        public var fireAt: LocalDateTime?
        public var body: String
        public var sound: Bool
        public init(fireAt: LocalDateTime?, body: String, sound: Bool) {
            self.fireAt = fireAt
            self.body = body
            self.sound = sound
        }
    }

    public struct Diff: Equatable, Sendable {
        public var remove: [String]
        public var add: [LocalAlert]
    }

    /// Diff by key (spec/NOTIFICATIONS.md 1.1): gone keys are cancelled, new keys scheduled, a key whose
    /// time, text or sound changed is replaced, the rest is kept. Only planned and legacy identifiers are ours:
    /// emergency events and the test alert are never removed here.
    public static func diff(pending: [String: Pending], desired: [LocalAlert]) -> Diff {
        let wanted = Dictionary(desired.map { ($0.identifier, $0) }, uniquingKeysWith: { a, _ in a })
        var remove: [String] = []
        for (id, p) in pending where id.hasPrefix(PLANNED_PREFIX) || id.hasPrefix(LEGACY_PREFIX) {
            if let w = wanted[id], same(w, p) { continue }
            remove.append(id)
        }
        let add = desired.filter { a in
            guard let p = pending[a.identifier] else { return true }
            return !same(a, p)
        }
        return Diff(remove: remove.sorted(), add: add)
    }

    private static func same(_ a: LocalAlert, _ p: Pending) -> Bool {
        a.fireAt == p.fireAt && a.body == p.body && a.sound == p.sound
    }

    // MARK: - Emergency events

    /// Requests for the events of one address (Android `NotificationHelper.postEmergencyEvents`). Each
    /// event is announced once: `fired` / `markFired` are the fired registry; a dropped event is marked
    /// too, so it is never replayed (spec/NOTIFICATIONS.md 2.3, 2.4, 2.4a).
    public static func emergencyAlerts(
        _ batch: EmergencyBatch,
        settings: UserSettings,
        lang: String,
        now: LocalDateTime,
        sound: Bool,
        fired: (String) -> Bool,
        markFired: (String) -> Void
    ) -> [LocalAlert] {
        guard batch.alertsOn, !batch.events.isEmpty else { return [] }
        // the primary's batch has no line of its own: its saved address (Android's default parameter)
        let address = (batch.addressLine ?? settings.selectedAddress)
            .map { $0.replacingOccurrences(of: "\n", with: " ") }
            .flatMap { $0.ktIsBlank ? nil : $0 }
        var out: [LocalAlert] = []
        for ev in batch.events {
            let key = ev.key(addressKey: batch.addressKey)
            if fired(key) { continue }
            markFired(key)
            // one continuous outage, one announcement
            let delivery = OutageEngine.emergencyDelivery(
                kind: ev.kind, start: ev.start, eta: ev.eta, now: now,
                plannedSpans: batch.plannedSpans, plannedAlertsOn: batch.plannedAlertsOn
            )
            if delivery == .DROP { continue }
            // follow-ups the user turned off are dropped, never replayed later
            let asKind: EmergencyEventKind = delivery == .PROLONG ? .ETA_CHANGED : ev.kind
            if asKind == .ETA_CHANGED && !settings.emergencyEtaAlerts { continue }
            if asKind == .END && !settings.emergencyEndAlerts { continue }

            let start = formatWhen(lang, ev.start, today: now.date)
            let eta = ev.eta.map { formatWhen(lang, $0, today: now.date) }
            let title: String
            let body: String
            switch asKind {
            case .START:
                title = ev.upcoming ? AppStrings.emergencyUpcomingTitle(lang) : AppStrings.emergencyStartTitle(lang)
                body = AppStrings.emergencyStartBody(lang, start, eta)
            case .ETA_CHANGED:
                title = AppStrings.emergencyChangedTitle(lang)
                body = AppStrings.emergencyChangedBody(lang, eta ?? start)
            case .END:
                if ev.earlyEnd, let eta {
                    title = AppStrings.emergencyEarlyEndTitle(lang)
                    body = AppStrings.emergencyEarlyEndBody(lang, eta)
                } else {
                    title = AppStrings.emergencyEndTitle(lang)
                    body = AppStrings.emergencyEndBody(lang, start)
                }
            }
            out.append(LocalAlert(
                identifier: key,
                fireAt: nil,
                title: title,
                body: address.map { "\(body)\n\($0)" } ?? body,
                category: .emergency,
                thread: batch.subscriptionId ?? batch.addressKey,
                subscriptionId: batch.subscriptionId,
                sound: sound,
                memberKeys: []
            ))
        }
        return out
    }

    /// "22:04", "завтра 01:00", "вчора 23:00" or "13.11 22:04" relative to `today`.
    public static func formatWhen(_ lang: String, _ dt: LocalDateTime, today: LocalDate) -> String {
        let hm = String(format: "%02d:%02d", dt.hour, dt.minute)
        if dt.date == today { return hm }
        if dt.date == today.plusDays(1) { return "\(AppStrings.tomorrowWord(lang)) \(hm)" }
        if dt.date == today.plusDays(-1) { return "\(AppStrings.yesterdayWord(lang)) \(hm)" }
        return String(format: "%02d.%02d ", dt.date.day, dt.date.month) + hm
    }

    // MARK: - Trigger

    /// Calendar components of a Kyiv wall-clock time (spec/NOTIFICATIONS.md 1.2): the time zone is Kyiv,
    /// never the device's, so a traveller still gets the warning at the right moment.
    public static func triggerComponents(_ t: LocalDateTime) -> DateComponents {
        var c = DateComponents()
        c.calendar = Calendar(identifier: .gregorian)
        c.timeZone = KyivTime.zone
        c.year = t.date.year
        c.month = t.date.month
        c.day = t.date.day
        c.hour = t.hour
        c.minute = t.minute
        return c
    }

    /// The Kyiv wall-clock time of trigger components read back from a pending request.
    public static func localDateTime(_ c: DateComponents) -> LocalDateTime? {
        guard let y = c.year, let mo = c.month, let d = c.day, let h = c.hour, let mi = c.minute else { return nil }
        return LocalDateTime(year: y, month: mo, day: d, hour: h, minute: mi)
    }
}
