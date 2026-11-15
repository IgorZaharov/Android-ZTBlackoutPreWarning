import AppIntents
import Foundation
import WidgetKit

// App Intents of the widgets (plan milestone M6): the configuration that binds a widget to an address
// (spec/SUBSCRIPTIONS.md 10) and the two interactive buttons (Android ToggleAlertsActionCallback and
// RefreshWidgetActionCallback). Titles are literals because App Intents metadata is read at build time;
// they repeat AppStrings.kt `widgetConfigTitle` / `widgetConfigDesc` / `widgetFollowPrimary`.

/// One address a widget can show; `PRIMARY` = follow the primary address (the default).
public struct AddressEntity: AppEntity {
    public static let PRIMARY = "primary"
    public static var typeDisplayRepresentation: TypeDisplayRepresentation = "Адреса"
    public static var defaultQuery = AddressQuery()

    public var id: String
    public var name: String

    public init(id: String, name: String) {
        self.id = id
        self.name = name
    }

    public var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(name)") }
}

public struct AddressQuery: EntityQuery {
    public init() {}

    /// "Основна адреса (авто)" first, then every address in list order, the primary with a star.
    static func all() -> [AddressEntity] {
        let lang = AppStrings.resolveLang(SettingsRepository.shared.getSettings().language)
        let store = SubscriptionSync.shared.store()
        return [AddressEntity(id: AddressEntity.PRIMARY, name: AppStrings.widgetFollowPrimary(lang))]
            + store.items.map { AddressEntity(id: $0.id, name: ($0.id == store.primaryId ? "★ " : "") + Subscriptions.displayLabel($0)) }
    }

    public func entities(for identifiers: [String]) async throws -> [AddressEntity] {
        Self.all().filter { identifiers.contains($0.id) }
    }

    public func suggestedEntities() async throws -> [AddressEntity] { Self.all() }

    public func defaultResult() async -> AddressEntity? { Self.all().first }
}

/// "Адреса віджета": which address this widget shows.
public struct SelectAddressIntent: WidgetConfigurationIntent {
    public static var title: LocalizedStringResource = "Адреса віджета"
    public static var description = IntentDescription("Яку адресу показує цей віджет")

    @Parameter(title: "Адреса віджета")
    public var address: AddressEntity?

    public init() {}

    /// The bound subscription id; nil follows the primary (also for a removed address, spec/SUBSCRIPTIONS.md 10).
    public var boundId: String? {
        guard let id = address?.id, id != AddressEntity.PRIMARY else { return nil }
        return id
    }
}

/// The widget bell: the master switch for all addresses (owner decision 4).
public struct ToggleAlertsIntent: AppIntent {
    public static var title: LocalizedStringResource = "Сповіщення"
    public static var isDiscoverable: Bool = false

    public init() {}

    /// The switch is written and the widgets redrawn first; re-planning the warnings is bounded, so a slow
    /// notification centre in the extension can never keep the bell from changing (TestFlight 1.4.0 (31):
    /// the bell did not react). The app re-plans on every launch and refresh anyway.
    public func perform() async throws -> some IntentResult {
        let sync = SubscriptionSync.shared
        sync.setMaster(!sync.master())
        WidgetCenter.shared.reloadAllTimelines()
        await WidgetWork.bounded(seconds: 5) { await NotificationSync.shared.syncPlanned() }
        return .result()
    }
}

/// The widget refresh button: refreshes every source like the app's button, then re-plans and redraws.
public struct RefreshWidgetIntent: AppIntent {
    public static var title: LocalizedStringResource = "Оновити дані"
    public static var isDiscoverable: Bool = false

    public init() {}

    /// While the intent runs, iOS shows the button and the countdowns as updating (`invalidatableContent`).
    /// The refresh gets 20 s: if it is still running then, the widget is redrawn with the busy button, and the
    /// refresh redraws it again when it ends (the busy mark expires after `WidgetState.BUSY_MAX_MS`).
    public func perform() async throws -> some IntentResult {
        WidgetState.setRefreshing(true)
        await WidgetWork.bounded(seconds: 20) {
            let settings = SettingsRepository.shared.getSettings()
            let outcome = await OutageRepository.shared.refresh(
                settings, forceNetwork: true, widgetItemIds: await WidgetBindings.shownItemIds()
            )
            await NotificationSync.shared.deliverEmergency(outcome.batches)
            await NotificationSync.shared.syncPlanned()
            WidgetState.setRefreshing(false)
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

/// Small widget state shared by the app and the extension.
public enum WidgetState {
    private static let prefs = Prefs("zt_widget_state_v1")
    /// A refresh killed with the process must not leave the button busy (Android REFRESH_BUSY_MAX_MS).
    static let BUSY_MAX_MS: Int64 = 30_000

    public static func setRefreshing(_ on: Bool) {
        prefs.set("refreshing_since_ms", on ? Int64(Date().timeIntervalSince1970 * 1000) : Int64(0))
    }

    public static func isRefreshing(now: Date = Date()) -> Bool {
        let since = prefs.int64("refreshing_since_ms", 0)
        return since > 0 && Int64(now.timeIntervalSince1970 * 1000) - since < BUSY_MAX_MS
    }
}

/// Which addresses the placed widgets show (Android `WidgetBindings.shownItemIds`): each is polled on
/// PowerOn whatever its switches (spec/SUBSCRIPTIONS.md 10).
public enum WidgetBindings {
    public static func shownItemIds() async -> [String] {
        // the async `currentConfigurations()` needs iOS 18; the completion form works on iOS 17
        let configs: [WidgetInfo] = await withCheckedContinuation { cont in
            WidgetCenter.shared.getCurrentConfigurations { result in
                cont.resume(returning: (try? result.get()) ?? [])
            }
        }
        let bound: [String?] = configs.map { $0.widgetConfigurationIntent(of: SelectAddressIntent.self)?.boundId }
        return Subscriptions.widgetItemIds(SubscriptionSync.shared.store(), boundIds: bound)
    }
}
