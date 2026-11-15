import AppIntents
import Foundation
import WidgetKit

// App Intents of the widgets (plan milestone M6): the configuration that binds a widget to an address
// (spec/SUBSCRIPTIONS.md 10) and the shared widget state; the two interactive buttons are in
// ios/Widget/WidgetButtonIntents.swift (widget extension only). Titles are literals because App Intents
// metadata is read at build time; they repeat AppStrings.kt `widgetConfigTitle` / `widgetConfigDesc` / `widgetFollowPrimary`.

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
