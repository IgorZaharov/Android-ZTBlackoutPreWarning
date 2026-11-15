import AppIntents
import Foundation
import WidgetKit

// The two interactive widget buttons (Android ToggleAlertsActionCallback and RefreshWidgetActionCallback).
// They live in the widget extension only, never in the app target: with the same intent in both, a tap on
// the button opened the app and `perform()` never ran (TestFlight 1.4.0, owner 2026-11-15). The views in
// ios/Shared/Widget/WidgetViews.swift use them under `#if WIDGET_EXTENSION` (project.yml).

/// The widget bell: the master switch for all addresses (owner decision 4).
struct ToggleAlertsIntent: AppIntent {
    static var title: LocalizedStringResource = "Сповіщення"
    static var isDiscoverable: Bool = false

    init() {}

    /// The switch is written and the widgets redrawn first; re-planning the warnings is bounded, so a slow
    /// notification centre in the extension can never keep the bell from changing (TestFlight 1.4.0 (31):
    /// the bell did not react). The app re-plans on every launch and refresh anyway.
    func perform() async throws -> some IntentResult {
        WidgetDiag.log("bell perform start")
        let sync = SubscriptionSync.shared
        sync.setMaster(!sync.master())
        WidgetDiag.log("bell master=\(sync.master())")
        WidgetCenter.shared.reloadAllTimelines()
        await WidgetWork.bounded(seconds: 5) { await NotificationSync.shared.syncPlanned() }
        return .result()
    }
}

/// The widget refresh button: refreshes every source like the app's button, then re-plans and redraws.
struct RefreshWidgetIntent: AppIntent {
    static var title: LocalizedStringResource = "Оновити дані"
    static var isDiscoverable: Bool = false

    init() {}

    /// While the intent runs, iOS shows the button and the countdowns as updating (`invalidatableContent`).
    /// The refresh gets 20 s: if it is still running then, the widget is redrawn with the busy button, and the
    /// refresh redraws it again when it ends (the busy mark expires after `WidgetState.BUSY_MAX_MS`).
    func perform() async throws -> some IntentResult {
        WidgetDiag.log("refresh perform start")
        WidgetState.setRefreshing(true)
        await WidgetWork.bounded(seconds: 20) {
            let settings = SettingsRepository.shared.getSettings()
            let outcome = await OutageRepository.shared.refresh(
                settings, forceNetwork: true, widgetItemIds: await WidgetBindings.shownItemIds()
            )
            await NotificationSync.shared.deliverEmergency(outcome.batches)
            await NotificationSync.shared.syncPlanned()
            WidgetState.setRefreshing(false)
            WidgetDiag.log("refresh done")
            WidgetCenter.shared.reloadAllTimelines()
        }
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}

/// Runs widget work with a time limit. A task group would wait for a child that ignores cancellation, so
/// the work runs in its own task and whichever ends first, the work or the timer, resumes the caller; the
/// work goes on in the background while the extension lives.
enum WidgetWork {
    private final class Once: @unchecked Sendable {
        private let lock = NSLock()
        private var done = false
        func first() -> Bool {
            lock.lock(); defer { lock.unlock() }
            if done { return false }
            done = true
            return true
        }
    }

    static func bounded(seconds: Double, _ work: @escaping @Sendable () async -> Void) async {
        await withCheckedContinuation { (cont: CheckedContinuation<Void, Never>) in
            let once = Once()
            Task {
                await work()
                if once.first() { cont.resume() }
            }
            Task {
                try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
                if once.first() { cont.resume() }
            }
        }
    }
}
