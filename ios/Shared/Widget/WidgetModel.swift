import Foundation

/// Everything the three widgets show, derived from one `OutageSnapshot` (local state only). Port of
/// Android `BlackoutGlanceWidget.buildWidgetModel` and `widget/WidgetBindings.kt` `widgetSource`.
public struct WidgetModel: Equatable, Sendable {
    public var lang: String
    /// "Черга 5.2", "Черга відсутня" or "Черга —" (Ukrainian on Android too).
    public var queueHeader: String
    /// The small widget's header: the queue alone ("5.2"), "—" without one; "Черга 5.2" clipped the address
    /// on a small widget (owner, 2026-11-15).
    public var queueShort: String
    public var isUnclear: Bool
    public var isOffNow: Bool
    /// "02г. 15хв." / "02hr. 15m.": never seconds (CLAUDE.md invariant).
    public var countdown: String
    /// The current outage when off, otherwise the next one ("Відключень немає" when there is none).
    public var period: String
    /// The next outage after now, "Завтра 01:00 – 03:00" when it is tomorrow.
    public var nextOutage: String
    /// The 48 half-hour cells of today (empty when unclear): the same states the main drum draws.
    public var slots: [BlackoutSlot]
    public var nowHour: Int
    public var nowMinute: Int
    /// "дані за HH:mm" when the cached schedule is shown because the site failed.
    public var staleCaption: String?
    /// The widget's address label (`widgetLabel`, spec/SUBSCRIPTIONS.md 10); nil keeps the 1.4.0 look.
    public var addressLabel: String?
    /// The item a tap shows on the main screen.
    public var itemId: String?
    /// Today's outages as list rows (the large widget).
    public var rows: [OutageRowFormat.RowText]
}

public enum WidgetModelBuilder {
    /// "01:02:03" -> "01г. 02хв." (uk) or "01hr. 02m." (en); "--:--:--" -> "--г. --хв.".
    public static func formatCountdown(_ raw: String, lang: String) -> String {
        let parts = raw.split(separator: ":").map(String.init).filter { $0 == "--" || Int($0) != nil }
        guard parts.count >= 2 else { return raw }
        func pad(_ s: String) -> String { s == "--" ? "--" : (s.count < 2 ? "0" + s : s) }
        let hh = pad(parts[0])
        let mm = pad(parts[1])
        return lang.lowercased() == "en" ? "\(hh)hr. \(mm)m." : "\(hh)г. \(mm)хв."
    }

    public static func build(
        queue: String,
        statusText: String?,
        snapshot: OutageSnapshot,
        lang: String,
        label: String? = nil,
        itemId: String? = nil
    ) -> WidgetModel {
        let now = snapshot.now
        let isNoQueueHouse = !(statusText ?? "").ktIsBlank
        let queueHeader: String
        if isNoQueueHouse {
            queueHeader = lang == "uk" ? "Черга відсутня" : "No queue"
        } else if queue.ktIsBlank {
            queueHeader = lang == "uk" ? "Черга —" : "Queue —"
        } else {
            queueHeader = "Черга \(queue)"
        }
        let queueShort = isNoQueueHouse || queue.ktIsBlank ? "—" : queue
        let notConfigured = queue.ktIsBlank && !isNoQueueHouse && !snapshot.hasAddress
        if notConfigured || snapshot.isUnclear {
            return WidgetModel(
                lang: lang, queueHeader: queueHeader, queueShort: queueShort, isUnclear: true, isOffNow: false,
                countdown: formatCountdown("--:--:--", lang: lang), period: "--:-- - --:--", nextOutage: "--:-- - --:--",
                slots: [], nowHour: now.hour, nowMinute: now.minute, staleCaption: nil,
                addressLabel: label, itemId: itemId, rows: []
            )
        }

        let st = snapshot.status()
        let period = !st.isOffNow && st.nextSpan == nil ? AppStrings.widgetNoOutages(lang) : st.nextSlotTime
        // the next outage after now, from the same merged spans the countdown uses
        let next = OutageEngine.spans(snapshot.outages.filter { !$0.stale }).first { $0.start.isAfter(now) }
        let nextText: String
        if let next {
            nextText = next.start.date == snapshot.today
                ? OutageEngine.formatSpan(next)
                : "\(AppStrings.widgetTomorrowPrefix(lang)) \(OutageEngine.formatSpan(next))"
        } else {
            nextText = AppStrings.widgetNoMoreOutages(lang)
        }
        let stale = snapshot.isStale ? snapshot.site?.lastSuccessMs.map { AppStrings.staleChip(lang, SiteStatusModel.formatHhmm($0)) } : nil
        return WidgetModel(
            lang: lang, queueHeader: queueHeader, queueShort: queueShort, isUnclear: false, isOffNow: st.isOffNow,
            countdown: formatCountdown(st.countdownText, lang: lang), period: period, nextOutage: nextText,
            slots: snapshot.slotsFor(snapshot.today), nowHour: now.hour, nowMinute: now.minute, staleCaption: stale,
            addressLabel: label, itemId: itemId,
            rows: snapshot.dayView(snapshot.today).rows.map { OutageRowFormat.format(lang, $0) }
        )
    }

    /// What one widget shows, read from the stores once (Android `widgetSource`).
    public struct Source {
        public var queue: String
        public var statusText: String?
        public var snapshot: OutageSnapshot
        public var lang: String
        public var label: String?
        public var itemId: String?

        /// The model at `date`: the stored outages seen at another moment (timeline entries).
        public func model(at date: Date) -> WidgetModel {
            var snap = snapshot
            snap.now = KyivTime.localDateTime(of: date)
            return WidgetModelBuilder.build(queue: queue, statusText: statusText, snapshot: snap, lang: lang, label: label, itemId: itemId)
        }
    }

    /// The source of a widget bound to `boundId` (nil = follow the primary) at `date`.
    public static func source(boundId: String?, at date: Date) -> Source {
        let settings = SettingsRepository.shared.getSettings()
        let store = SubscriptionSync.shared.store()
        let repo = OutageRepository.shared
        let now = KyivTime.localDateTime(of: date)
        let lang = AppStrings.resolveLang(settings.language)
        let item = Subscriptions.widgetItem(store, boundId: boundId)
        let label = Subscriptions.widgetLabel(store, boundId: boundId)
        if let other = item, other.id != store.primaryId {
            return Source(queue: other.queue ?? "", statusText: other.queueStatusText, snapshot: repo.snapshotFor(other, now: now),
                          lang: lang, label: label, itemId: other.id)
        }
        // the primary reads the mirrored single-address keys, exactly as before multi-address step 5
        return Source(queue: settings.queue, statusText: settings.customQueueStatusText, snapshot: repo.snapshot(settings, now: now),
                      lang: lang, label: label, itemId: item?.id)
    }

    /// Entry dates of a widget timeline: now, every minute for the next `minutes` (the countdown has no
    /// seconds but changes every minute; widgets can not tick), and every power transition within 48 h
    /// (spec/OUTAGE_ENGINE.md 6.3).
    public static func entryDates(now: Date, transitions: [Transition], minutes: Int = 90) -> [Date] {
        let minuteStart = Date(timeIntervalSince1970: (now.timeIntervalSince1970 / 60).rounded(.down) * 60)
        var dates = Set<Date>([now])
        for i in 1...max(1, minutes) { dates.insert(minuteStart.addingTimeInterval(TimeInterval(i * 60))) }
        for t in transitions {
            let d = KyivTime.date(of: t.at)
            if d > now { dates.insert(d) }
        }
        return dates.sorted()
    }
}
