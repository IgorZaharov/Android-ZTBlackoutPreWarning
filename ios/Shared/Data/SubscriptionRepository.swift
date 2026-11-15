import Foundation
import Security

/// Stores the multi-address subscriptions (mirror of android SubscriptionRepository.kt,
/// spec/SUBSCRIPTIONS.md): the store as the JSON string `KEY_STORE` and the kill switch `KEY_MASTER`,
/// both among the user settings. The rules live in `Subscriptions`; this class only encodes, reads, writes.
public final class SubscriptionRepository {
    public static let KEY_STORE = "zt_subscriptions_v1"
    public static let KEY_MASTER = "alerts_master_enabled"

    private static let lock = NSLock()
    private static let ID_CHARS = Array("abcdefghijklmnopqrstuvwxyz0123456789")

    private let prefs: Prefs
    private let clock: () -> Int64
    private let random: () -> String

    public init(
        prefs: Prefs = Prefs("zt_user_settings_v1", bareKeys: true),
        clock: @escaping () -> Int64 = { Int64(Date().timeIntervalSince1970 * 1000) },
        random: @escaping () -> String = SubscriptionRepository.randomId
    ) {
        self.prefs = prefs
        self.clock = clock
        self.random = random
    }

    /// 8 random characters from `[a-z0-9]` (cryptographic source, like SecureRandom).
    public static func randomId() -> String {
        var bytes = [UInt8](repeating: 0, count: 8)
        if SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) != errSecSuccess {
            bytes = (0..<8).map { _ in UInt8.random(in: 0...255) }
        }
        return String(bytes.map { ID_CHARS[Int($0) % ID_CHARS.count] })
    }

    /// The 1.4.0 settings as migration input; `streetName` is resolved by the caller (see `resolveStreetName`).
    public static func legacyFrom(_ settings: UserSettings, streetName: String?) -> LegacySettings {
        let q = settings.selectedAddressQuery
        return LegacySettings(
            queue: settings.queue,
            customQueueStatusText: settings.customQueueStatusText,
            selectedAddress: settings.selectedAddress,
            remSlug: q?.remId ?? "",
            settlementId: q?.settlementId ?? "",
            streetId: q?.streetId ?? "",
            streetName: streetName,
            house: q?.house ?? "",
            notificationsEnabled: settings.notificationsEnabled,
            emergencyNotificationsEnabled: settings.emergencyNotificationsEnabled
        )
    }

    /// Same lookup as `OutageRepository.addressKey`, so the migrated address key matches 1.4.0.
    public static func resolveStreetName(_ streetId: String?) -> String? {
        guard let streetId, !streetId.ktIsBlank else { return nil }
        return ZtoeAddressLookup.findStreetById(streetId)?.nameUk
    }

    // MARK: - JSON text <-> store

    public static func encode(_ store: SubscriptionStore) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: Subscriptions.toMap(store), options: [.sortedKeys]) else {
            return ""
        }
        return String(decoding: data, as: UTF8.self)
    }

    /// nil for missing, unreadable or non-version-1 text ("absent").
    public static func decode(_ text: String?) -> SubscriptionStore? {
        guard let text, !text.ktIsBlank, let data = text.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        return Subscriptions.fromMap(obj)
    }

    // MARK: - Store

    /// The repaired store, or nil when it has never been written (or is unreadable): then migrate.
    public func read() -> RepairResult? { Self.decode(prefs.string(Self.KEY_STORE)).map { Subscriptions.repair($0) } }

    public func store() -> SubscriptionStore { read()?.store ?? .EMPTY }

    public func alertsMaster() -> Bool { prefs.bool(Self.KEY_MASTER, true) }

    public func setAlertsMaster(_ on: Bool) { prefs.set(Self.KEY_MASTER, on) }

    /// Runs the one-time migration from the 1.4.0 settings when the store is absent and returns the
    /// store in use. `legacy` is only evaluated when a migration is needed.
    public func ensureMigrated(_ legacy: () -> LegacySettings) -> SubscriptionStore {
        Self.lock.lock(); defer { Self.lock.unlock() }
        if let r = read() { return r.store }
        let result = Subscriptions.migrate(legacy(), newId: random(), nowMs: clock())
        prefs.set(Self.KEY_STORE, Self.encode(result.store))
        prefs.set(Self.KEY_MASTER, result.alertsMaster)
        return result.store
    }

    /// Read-modify-write under one lock; writes only when `op` succeeds.
    @discardableResult
    public func mutate(_ op: (SubscriptionStore) -> StoreResult) -> StoreResult {
        Self.lock.lock(); defer { Self.lock.unlock() }
        let result = op(store())
        if case let .ok(newStore) = result { prefs.set(Self.KEY_STORE, Self.encode(newStore)) }
        return result
    }

    /// A fresh id that no current item uses.
    public func newItemId() -> String {
        let used = Set(store().items.map(\.id))
        while true {
            let id = random()
            if !used.contains(id) && Subscriptions.isValidId(id) { return id }
        }
    }

    public func nowMs() -> Int64 { clock() }
}

/// The one way to change addresses and alert switches (mirror of android SubscriptionSync.kt,
/// spec/SUBSCRIPTIONS.md section 7). Every call runs the one-time migration first, changes the store,
/// then writes the primary item into the single-address keys. Callers sync alerts and widgets themselves.
public final class SubscriptionSync {
    public static let shared = SubscriptionSync()

    private let settingsRepo: SettingsRepository
    private let repo: SubscriptionRepository

    public init(settingsRepo: SettingsRepository = .shared, repo: SubscriptionRepository = SubscriptionRepository()) {
        self.settingsRepo = settingsRepo
        self.repo = repo
    }

    @discardableResult
    public func ensureReady() -> SubscriptionStore {
        repo.ensureMigrated {
            let s = settingsRepo.getSettings()
            return SubscriptionRepository.legacyFrom(s, streetName: SubscriptionRepository.resolveStreetName(s.selectedAddressQuery?.streetId))
        }
    }

    public func store() -> SubscriptionStore {
        ensureReady()
        return repo.store()
    }

    public func master() -> Bool {
        ensureReady()
        return repo.alertsMaster()
    }

    public func setMaster(_ on: Bool) {
        ensureReady()
        let was = repo.alertsMaster()
        repo.setAlertsMaster(on)
        if was != on { settingsRepo.applyMasterSound(on) }
        mirror()
    }

    /// Applies `op` to the store; on success writes the mirror.
    @discardableResult
    public func change(_ op: (SubscriptionStore) -> StoreResult) -> StoreResult {
        ensureReady()
        let result = repo.mutate(op)
        if case .ok = result { mirror() }
        return result
    }

    @discardableResult
    public func addFromLookup(queue: String, statusText: String?, addressText: String, query: SelectedAddressQuery) -> StoreResult {
        ensureReady()
        let item = Subscription(
            id: repo.newItemId(),
            address: SubscriptionAddress(
                remSlug: query.remId,
                settlementId: query.settlementId,
                streetId: query.streetId,
                streetName: SubscriptionRepository.resolveStreetName(query.streetId) ?? "",
                house: query.house,
                text: addressText
            ),
            queue: Subscriptions.isValidQueue(queue) ? queue : nil,
            queueSource: .LOOKUP,
            queueStatusText: statusText?.nonBlank,
            createdAtMs: repo.nowMs()
        )
        return change { Subscriptions.add($0, item) }
    }

    @discardableResult
    public func addQueueOnly(_ queue: String) -> StoreResult {
        ensureReady()
        let item = Subscription(id: repo.newItemId(), queue: queue, queueSource: .MANUAL, createdAtMs: repo.nowMs())
        return change { Subscriptions.add($0, item) }
    }

    /// A background ZTOE lookup for the primary address found its queue (or "no queue").
    @discardableResult
    public func assignPrimaryQueue(queue: String?, statusText: String?, addressText: String?) -> StoreResult {
        change { s in
            guard let id = s.primaryId else { return .error(code: Subscriptions.ERR_NOT_FOUND, existingId: nil) }
            return Subscriptions.setQueueInfo(s, id: id, queue: queue, statusText: statusText, addressText: addressText)
        }
    }

    public func mirror() {
        settingsRepo.applyPrimaryMirror(Subscriptions.primaryMirror(repo.store(), master: repo.alertsMaster()))
    }
}
