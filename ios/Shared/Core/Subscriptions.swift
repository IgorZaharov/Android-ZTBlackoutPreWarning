import Foundation

// Multi-address subscriptions: the stored model, its repair rules, the store operations, the
// migration from single-address settings, the primary mirror, the alert grouping, the main-screen
// switcher and the widget binding. Mirror of android core/Subscriptions.kt, spec/SUBSCRIPTIONS.md,
// cases in spec/vectors/subscriptions.json.
//
// The model is exchanged as plain dictionaries (toMap / fromMap) shaped like JSONSerialization output:
// `nil` is stored as NSNull, numbers may arrive as NSNumber.

public enum QueueSource: String, Sendable { case LOOKUP, MANUAL }

public struct SubscriptionAddress: Hashable, Sendable {
    public var remSlug: String
    public var settlementId: String
    public var streetId: String
    /// Display name resolved from `streetId` when the address was stored; may be empty.
    public var streetName: String
    public var house: String
    /// Full human readable line (1.4.0 `selected_address`); may be empty.
    public var text: String

    public init(remSlug: String, settlementId: String, streetId: String, streetName: String, house: String, text: String) {
        self.remSlug = remSlug
        self.settlementId = settlementId
        self.streetId = streetId
        self.streetName = streetName
        self.house = house
        self.text = text
    }

    public var isValid: Bool {
        !remSlug.ktIsBlank && !settlementId.ktIsBlank && !streetId.ktIsBlank && !house.ktIsBlank
    }

    /// The 1.4.0 address key of `ledger_*`, `repair_*`, `ids_*` and emergency alert keys.
    public var key: String {
        "\(settlementId)|\(StreetKey.of(streetName.ktIsBlank ? streetId : streetName))|\(HouseKey.of(house))"
    }
}

public struct Subscription: Hashable, Sendable {
    public var id: String
    /// Cleaned user label; empty = automatic (see Subscriptions.displayLabel).
    public var label: String = ""
    public var address: SubscriptionAddress? = nil
    public var queue: String? = nil
    public var queueSource: QueueSource = .MANUAL
    public var queueStatusText: String? = nil
    public var plannedAlerts: Bool = true
    public var emergencyAlerts: Bool = true
    public var createdAtMs: Int64 = 0

    public init(
        id: String, label: String = "", address: SubscriptionAddress? = nil, queue: String? = nil,
        queueSource: QueueSource = .MANUAL, queueStatusText: String? = nil,
        plannedAlerts: Bool = true, emergencyAlerts: Bool = true, createdAtMs: Int64 = 0
    ) {
        self.id = id
        self.label = label
        self.address = address
        self.queue = queue
        self.queueSource = queueSource
        self.queueStatusText = queueStatusText
        self.plannedAlerts = plannedAlerts
        self.emergencyAlerts = emergencyAlerts
        self.createdAtMs = createdAtMs
    }

    /// `a:<address key>` or `q:<queue>`; two items with one identity are duplicates.
    public var identity: String { address.map { "a:\($0.key)" } ?? "q:\(queue ?? "")" }
}

public struct SubscriptionStore: Hashable, Sendable {
    public var primaryId: String?
    public var items: [Subscription]

    public init(primaryId: String? = nil, items: [Subscription] = []) {
        self.primaryId = primaryId
        self.items = items
    }

    public var primary: Subscription? { items.first { $0.id == primaryId } }

    public static let EMPTY = SubscriptionStore()
}

/// 1.4.0 single-address settings, plus the street name the platform resolved for `streetId`.
public struct LegacySettings: Hashable, Sendable {
    public var queue: String
    public var customQueueStatusText: String?
    public var selectedAddress: String?
    public var remSlug: String
    public var settlementId: String
    public var streetId: String
    public var streetName: String?
    public var house: String
    public var notificationsEnabled: Bool
    public var emergencyNotificationsEnabled: Bool

    public init(
        queue: String, customQueueStatusText: String?, selectedAddress: String?, remSlug: String,
        settlementId: String, streetId: String, streetName: String?, house: String,
        notificationsEnabled: Bool, emergencyNotificationsEnabled: Bool
    ) {
        self.queue = queue
        self.customQueueStatusText = customQueueStatusText
        self.selectedAddress = selectedAddress
        self.remSlug = remSlug
        self.settlementId = settlementId
        self.streetId = streetId
        self.streetName = streetName
        self.house = house
        self.notificationsEnabled = notificationsEnabled
        self.emergencyNotificationsEnabled = emergencyNotificationsEnabled
    }
}

public struct MigrationResult: Hashable, Sendable {
    public var store: SubscriptionStore
    public var alertsMaster: Bool
}

/// Values for the single-address keys, written from the primary item (spec/SUBSCRIPTIONS.md section 7).
public struct LegacyMirror: Hashable, Sendable {
    public var queue: String
    public var customQueueStatusText: String?
    public var selectedAddress: String?
    public var remSlug: String
    public var settlementId: String
    public var streetId: String
    public var house: String
    public var notificationsEnabled: Bool
    public var emergencyNotificationsEnabled: Bool

    public init(
        queue: String, customQueueStatusText: String?, selectedAddress: String?, remSlug: String,
        settlementId: String, streetId: String, house: String,
        notificationsEnabled: Bool, emergencyNotificationsEnabled: Bool
    ) {
        self.queue = queue
        self.customQueueStatusText = customQueueStatusText
        self.selectedAddress = selectedAddress
        self.remSlug = remSlug
        self.settlementId = settlementId
        self.streetId = streetId
        self.house = house
        self.notificationsEnabled = notificationsEnabled
        self.emergencyNotificationsEnabled = emergencyNotificationsEnabled
    }
}

public struct DroppedItem: Hashable, Sendable {
    public var id: String?
    public var reason: String

    public init(id: String?, reason: String) {
        self.id = id
        self.reason = reason
    }
}

public struct RepairResult: Hashable, Sendable {
    public var store: SubscriptionStore
    public var dropped: [DroppedItem]
}

/// Either the new store or an error code from spec/SUBSCRIPTIONS.md section 4.
public enum StoreResult: Hashable, Sendable {
    case ok(SubscriptionStore)
    case error(code: String, existingId: String?)
}

/// One planned pre-warning shared by every item on one queue with the same span (spec/SUBSCRIPTIONS.md 8.1).
public struct PlannedGroup: Hashable, Sendable {
    public var key: String
    public var queue: String
    public var fireAt: LocalDateTime
    public var spanStart: LocalDateTime
    public var spanEnd: LocalDateTime
    public var mayContinue: Bool
    public var durationMinutes: Int
    public var memberIds: [String]
}

public enum Subscriptions {
    public static let SCHEMA_VERSION = 1
    public static let MAX_ITEMS = 5
    public static let MAX_LABEL_LENGTH = 40

    public static let ERR_INVALID = "invalid"
    public static let ERR_DUPLICATE_ID = "duplicate_id"
    public static let ERR_DUPLICATE = "duplicate"
    public static let ERR_LIMIT = "limit_reached"
    public static let ERR_NOT_FOUND = "not_found"

    private static let idPattern = Rx("^[a-z0-9]{4,32}$")
    private static let queuePattern = Rx("^[1-6]\\.[12]$")
    private static let spaces = Rx("[ \\t\\n\\x{0B}\\f\\r\\u00A0\\u200B]+")

    public static func isValidId(_ id: String?) -> Bool { id.map { idPattern.matches($0) } ?? false }
    public static func isValidQueue(_ queue: String?) -> Bool { queue.map { queuePattern.matches($0) } ?? false }

    /// Collapses whitespace runs to one space, then trims spaces only (Kotlin `trim(' ')`).
    private static func collapse(_ raw: String) -> String {
        var s = Substring(spaces.replace(raw, template: " "))
        while s.hasPrefix(" ") { s = s.dropFirst() }
        while s.hasSuffix(" ") { s = s.dropLast() }
        return String(s)
    }

    // MARK: - Labels

    public static func cleanLabel(_ raw: String?) -> String {
        let s = collapse(raw ?? "")
        let units = Array(s.utf16)
        if units.count <= MAX_LABEL_LENGTH { return s }
        var end = MAX_LABEL_LENGTH
        if UTF16.isLeadSurrogate(units[end - 1]) { end -= 1 }
        return String(decoding: units[0..<end], as: UTF16.self)
    }

    public static func defaultLabel(_ item: Subscription) -> String {
        guard let a = item.address else { return "Черга \(item.queue ?? "")" }
        let house = collapse(a.house)
        let street = collapse(TextNorm.decodeEntities(a.streetName))
        if street.isEmpty { return "буд. \(house)" }
        let tokens = street.components(separatedBy: " ")
        let core = tokens.count > 1 && StreetKey.isTypeWord(tokens[0]) ? Array(tokens.dropFirst()) : tokens
        return "\(core.joined(separator: " ")) \(house)"
    }

    public static func displayLabel(_ item: Subscription) -> String { item.label.isEmpty ? defaultLabel(item) : item.label }

    // MARK: - Maps

    private static func orNull(_ v: Any?) -> Any { v ?? NSNull() }

    public static func toMap(_ store: SubscriptionStore) -> [String: Any] {
        [
            "schemaVersion": SCHEMA_VERSION,
            "primaryId": orNull(store.primaryId),
            "items": store.items.map { itemToMap($0) }
        ]
    }

    public static func itemToMap(_ item: Subscription) -> [String: Any] {
        [
            "id": item.id,
            "label": item.label,
            "address": orNull(item.address.map { a -> [String: Any] in
                [
                    "remSlug": a.remSlug,
                    "settlementId": a.settlementId,
                    "streetId": a.streetId,
                    "streetName": a.streetName,
                    "house": a.house,
                    "text": a.text
                ]
            }),
            "queue": orNull(item.queue),
            "queueSource": item.queueSource.rawValue,
            "queueStatusText": orNull(item.queueStatusText),
            "plannedAlerts": item.plannedAlerts,
            "emergencyAlerts": item.emergencyAlerts,
            "createdAtMs": item.createdAtMs
        ]
    }

    /// JSON booleans arrive as NSNumber too; tell them apart from numbers like Kotlin's type checks do.
    private static func isBoolean(_ v: Any?) -> Bool {
        guard let n = v as? NSNumber else { return v is Bool }
        return CFGetTypeID(n) == CFBooleanGetTypeID()
    }

    private static func number(_ v: Any?) -> NSNumber? {
        guard let n = v as? NSNumber, !isBoolean(n) else { return nil }
        return n
    }

    private static func bool(_ v: Any?) -> Bool? { isBoolean(v) ? (v as? NSNumber)?.boolValue ?? (v as? Bool) : nil }

    private static func string(_ v: Any?) -> String? { v as? String }

    /// Lenient read: wrong types read as missing, nothing throws. Returns nil ("absent") when the map is
    /// not a version-1 store, so the caller migrates again from the legacy keys. Call `repair` before use.
    public static func fromMap(_ map: [String: Any]?) -> SubscriptionStore? {
        guard let map, let version = number(map["schemaVersion"])?.intValue, version == SCHEMA_VERSION else { return nil }
        let items = (map["items"] as? [Any] ?? []).compactMap { ($0 as? [String: Any]).map(itemFromMap) }
        return SubscriptionStore(primaryId: string(map["primaryId"]), items: items)
    }

    public static func itemFromMap(_ m: [String: Any]) -> Subscription {
        let a = m["address"] as? [String: Any]
        return Subscription(
            id: string(m["id"]) ?? "",
            label: string(m["label"]) ?? "",
            address: a.map {
                SubscriptionAddress(
                    remSlug: string($0["remSlug"]) ?? "",
                    settlementId: string($0["settlementId"]) ?? "",
                    streetId: string($0["streetId"]) ?? "",
                    streetName: string($0["streetName"]) ?? "",
                    house: string($0["house"]) ?? "",
                    text: string($0["text"]) ?? ""
                )
            },
            queue: string(m["queue"]),
            queueSource: string(m["queueSource"]) == QueueSource.LOOKUP.rawValue ? .LOOKUP : .MANUAL,
            queueStatusText: string(m["queueStatusText"]),
            plannedAlerts: bool(m["plannedAlerts"]) ?? true,
            emergencyAlerts: bool(m["emergencyAlerts"]) ?? true,
            createdAtMs: number(m["createdAtMs"])?.int64Value ?? 0
        )
    }

    // MARK: - Repair

    /// Repair step 2: invalid queue or address -> nil, label cleaned.
    public static func normalize(_ item: Subscription) -> Subscription {
        var c = item
        c.label = cleanLabel(item.label)
        c.address = item.address.flatMap { $0.isValid ? $0 : nil }
        c.queue = item.queue.flatMap { isValidQueue($0) ? $0 : nil }
        return c
    }

    public static func repair(_ store: SubscriptionStore) -> RepairResult {
        var dropped: [DroppedItem] = []
        var items = store.items.filter { ok in
            let keep = isValidId(ok.id)
            if !keep { dropped.append(DroppedItem(id: ok.id, reason: "invalid_id")) }
            return keep
        }
        items = items.map(normalize)
        items = items.filter { ok in
            let keep = ok.address != nil || ok.queue != nil
            if !keep { dropped.append(DroppedItem(id: ok.id, reason: "empty")) }
            return keep
        }
        var ids = Set<String>()
        items = items.filter { ok in
            let keep = ids.insert(ok.id).inserted
            if !keep { dropped.append(DroppedItem(id: ok.id, reason: "duplicate_id")) }
            return keep
        }
        var identities = Set<String>()
        items = items.filter { ok in
            let keep = identities.insert(ok.identity).inserted
            if !keep { dropped.append(DroppedItem(id: ok.id, reason: "duplicate_address")) }
            return keep
        }
        if items.count > MAX_ITEMS {
            items.dropFirst(MAX_ITEMS).forEach { dropped.append(DroppedItem(id: $0.id, reason: "over_limit")) }
            items = Array(items.prefix(MAX_ITEMS))
        }
        let primaryId = store.primaryId.flatMap { p in items.contains { $0.id == p } ? p : nil } ?? items.first?.id
        return RepairResult(store: SubscriptionStore(primaryId: primaryId, items: items), dropped: dropped)
    }

    // MARK: - Operations

    public static func add(_ store: SubscriptionStore, _ candidate: Subscription) -> StoreResult {
        if !isValidId(candidate.id) { return .error(code: ERR_INVALID, existingId: nil) }
        let item = normalize(candidate)
        if item.address == nil && item.queue == nil { return .error(code: ERR_INVALID, existingId: nil) }
        if store.items.contains(where: { $0.id == item.id }) { return .error(code: ERR_DUPLICATE_ID, existingId: nil) }
        if let dup = store.items.first(where: { $0.identity == item.identity }) {
            return .error(code: ERR_DUPLICATE, existingId: dup.id)
        }
        if store.items.count >= MAX_ITEMS { return .error(code: ERR_LIMIT, existingId: nil) }
        return .ok(SubscriptionStore(primaryId: store.primaryId ?? item.id, items: store.items + [item]))
    }

    public static func remove(_ store: SubscriptionStore, id: String) -> StoreResult {
        if !store.items.contains(where: { $0.id == id }) { return .error(code: ERR_NOT_FOUND, existingId: nil) }
        let rest = store.items.filter { $0.id != id }
        let primaryId: String?
        if store.primaryId != id && rest.contains(where: { $0.id == store.primaryId }) {
            primaryId = store.primaryId
        } else {
            // Kotlin minByOrNull keeps the first of equal values, which is the list-order tie rule
            var best: Subscription?
            for it in rest where best == nil || it.createdAtMs < best!.createdAtMs { best = it }
            primaryId = best?.id
        }
        return .ok(SubscriptionStore(primaryId: primaryId, items: rest))
    }

    public static func setPrimary(_ store: SubscriptionStore, id: String) -> StoreResult {
        guard store.items.contains(where: { $0.id == id }) else { return .error(code: ERR_NOT_FOUND, existingId: nil) }
        var s = store
        s.primaryId = id
        return .ok(s)
    }

    public static func setPlanned(_ store: SubscriptionStore, id: String, on: Bool) -> StoreResult {
        update(store, id: id) { $0.plannedAlerts = on }
    }

    public static func setEmergency(_ store: SubscriptionStore, id: String, on: Bool) -> StoreResult {
        update(store, id: id) { $0.emergencyAlerts = on }
    }

    public static func rename(_ store: SubscriptionStore, id: String, raw: String?) -> StoreResult {
        update(store, id: id) { $0.label = cleanLabel(raw) }
    }

    /// Moves the item to `toIndex` (clamped); the primary and the fields stay unchanged (spec section 4).
    public static func move(_ store: SubscriptionStore, id: String, toIndex: Int) -> StoreResult {
        guard let from = store.items.firstIndex(where: { $0.id == id }) else { return .error(code: ERR_NOT_FOUND, existingId: nil) }
        let to = min(max(toIndex, 0), store.items.count - 1)
        var items = store.items
        let moved = items.remove(at: from)
        items.insert(moved, at: to)
        var s = store
        s.items = items
        return .ok(s)
    }

    /// Result of a ZTOE lookup for an address item (spec/SUBSCRIPTIONS.md section 4).
    public static func setQueueInfo(_ store: SubscriptionStore, id: String, queue: String?, statusText: String?, addressText: String?) -> StoreResult {
        guard let item = store.items.first(where: { $0.id == id }) else { return .error(code: ERR_NOT_FOUND, existingId: nil) }
        guard let address = item.address else { return .error(code: ERR_INVALID, existingId: nil) }
        return update(store, id: id) {
            $0.queue = queue.flatMap { isValidQueue($0) ? $0 : nil }
            $0.queueStatusText = statusText.flatMap { $0.ktIsBlank ? nil : $0 }
            var a = address
            if let addressText, !addressText.ktIsBlank { a.text = addressText }
            $0.address = a
        }
    }

    private static func update(_ store: SubscriptionStore, id: String, _ change: (inout Subscription) -> Void) -> StoreResult {
        guard store.items.contains(where: { $0.id == id }) else { return .error(code: ERR_NOT_FOUND, existingId: nil) }
        var s = store
        s.items = store.items.map { item in
            guard item.id == id else { return item }
            var c = item
            change(&c)
            return c
        }
        return .ok(s)
    }

    // MARK: - Effective switches

    public static func plannedActive(master: Bool, item: Subscription) -> Bool {
        master && item.plannedAlerts && item.queue != nil
    }

    public static func emergencyActive(master: Bool, item: Subscription, poweronIdsKnown: Bool) -> Bool {
        master && item.emergencyAlerts && item.address != nil && poweronIdsKnown
    }

    public static func anyAlertsEnabled(master: Bool, store: SubscriptionStore) -> Bool {
        master && store.items.contains { $0.plannedAlerts || $0.emergencyAlerts }
    }

    // MARK: - Mirror of the primary item into the single-address keys (section 7)

    public static func primaryMirror(_ store: SubscriptionStore, master: Bool) -> LegacyMirror {
        let p = store.primary
        let a = p?.address
        let selected: String?
        if let p, let a { selected = a.text.isEmpty ? displayLabel(p) : a.text } else { selected = nil }
        return LegacyMirror(
            queue: p?.queue ?? "",
            customQueueStatusText: p?.queueStatusText,
            selectedAddress: selected,
            remSlug: a?.remSlug ?? "",
            settlementId: a?.settlementId ?? "",
            streetId: a?.streetId ?? "",
            house: a?.house ?? "",
            notificationsEnabled: master && (p?.plannedAlerts ?? true),
            emergencyNotificationsEnabled: master && (p?.emergencyAlerts ?? true)
        )
    }

    // MARK: - Migration

    public static func migrate(_ legacy: LegacySettings, newId: String, nowMs: Int64) -> MigrationResult {
        let queue = isValidQueue(legacy.queue) ? legacy.queue : nil
        let address = SubscriptionAddress(
            remSlug: legacy.remSlug,
            settlementId: legacy.settlementId,
            streetId: legacy.streetId,
            streetName: legacy.streetName ?? "",
            house: legacy.house,
            text: legacy.selectedAddress ?? ""
        )
        var item: Subscription?
        if address.isValid {
            item = Subscription(
                id: newId, address: address, queue: queue, queueSource: .LOOKUP,
                queueStatusText: legacy.customQueueStatusText.flatMap { $0.ktIsBlank ? nil : $0 },
                createdAtMs: nowMs
            )
        } else if let queue {
            item = Subscription(id: newId, queue: queue, queueSource: .MANUAL, createdAtMs: nowMs)
        }
        item?.plannedAlerts = legacy.notificationsEnabled
        item?.emergencyAlerts = legacy.emergencyNotificationsEnabled
        let store = item.map { SubscriptionStore(primaryId: $0.id, items: [$0]) } ?? .EMPTY
        return MigrationResult(store: store, alertsMaster: legacy.notificationsEnabled || legacy.emergencyNotificationsEnabled)
    }

    // MARK: - Alerts for every item (section 8)

    /// The primary first, then the other items by `createdAtMs`, list order on ties.
    public static func alertOrder(_ store: SubscriptionStore) -> [Subscription] {
        let primary = store.primary
        let rest = store.items
            .filter { $0.id != primary?.id }
            .stableSorted { $0.createdAtMs < $1.createdAtMs }
        return (primary.map { [$0] } ?? []) + rest
    }

    /// One planned alert per (queue, span start, span end) over every `plannedActive` item (8.1).
    public static func groupAlerts(_ store: SubscriptionStore, master: Bool, alertsById: [String: [AlertSpec]]) -> [PlannedGroup] {
        struct Acc {
            let queue: String
            let first: AlertSpec
            var mayContinue: Bool
            var members: [String]
        }
        var order: [String] = []
        var groups: [String: Acc] = [:]
        for item in alertOrder(store) {
            guard plannedActive(master: master, item: item), let queue = item.queue, let alerts = alertsById[item.id] else { continue }
            for a in alerts {
                let key = "planned_q\(queue)_\(a.spanStart)_\(a.spanEnd)"
                var acc: Acc
                if let existing = groups[key] {
                    acc = existing
                } else {
                    order.append(key)
                    acc = Acc(queue: queue, first: a, mayContinue: false, members: [])
                }
                acc.mayContinue = acc.mayContinue || a.mayContinue
                if !acc.members.contains(item.id) { acc.members.append(item.id) }
                groups[key] = acc
            }
        }
        return order.compactMap { key -> PlannedGroup? in
            guard let g = groups[key] else { return nil }
            return PlannedGroup(
                key: key, queue: g.queue, fireAt: g.first.fireAt, spanStart: g.first.spanStart, spanEnd: g.first.spanEnd,
                mayContinue: g.mayContinue, durationMinutes: g.first.durationMinutes, memberIds: g.members
            )
        }
        .stableSorted { a, b in
            if a.fireAt != b.fireAt { return a.fireAt < b.fireAt }
            if a.spanStart != b.spanStart { return a.spanStart < b.spanStart }
            return a.key < b.key
        }
    }

    /// Fired-registry key of one item for one span (8.2).
    public static func memberKey(id: String, spanStart: LocalDateTime) -> String { "planned_\(id)_\(spanStart)" }

    /// The address-independent key 1.4.0 recorded; it counts for every item.
    public static func legacyAlertKey(spanStart: LocalDateTime) -> String { "planned_\(spanStart)" }

    public static func pendingMembers(_ group: PlannedGroup, notified: (String) -> Bool) -> [String] {
        group.memberIds.filter {
            !notified(memberKey(id: $0, spanStart: group.spanStart)) && !notified(legacyAlertKey(spanStart: group.spanStart))
        }
    }

    /// Labels that open the planned text, or nil when the store has at most one item (8.3).
    public static func alertLabels(_ store: SubscriptionStore, memberIds: [String]) -> String? {
        if store.items.count <= 1 || memberIds.isEmpty { return nil }
        let labels = memberIds.compactMap { id in store.items.first { $0.id == id }.map(displayLabel) }
        if labels.isEmpty { return nil }
        let head = labels.prefix(2).joined(separator: " · ")
        return labels.count > 2 ? "\(head) +\(labels.count - 2)" : head
    }

    // MARK: - Main screen (section 9)

    /// The chips of the address switcher: every item in list order, or none with fewer than 2 items.
    public static func switcherItems(_ store: SubscriptionStore) -> [Subscription] { store.items.count >= 2 ? store.items : [] }

    /// The item the main screen shows: the selected one if it still exists, else the primary.
    public static func viewItem(_ store: SubscriptionStore, selectedId: String?) -> Subscription? {
        store.items.first { $0.id == selectedId } ?? store.primary
    }

    /// The master is on but no item has a switch on: "on" would silently mean nothing.
    public static func noAlertsCaption(master: Bool, store: SubscriptionStore) -> Bool {
        master && !store.items.isEmpty && !anyAlertsEnabled(master: master, store: store)
    }

    // MARK: - Widgets (spec/SUBSCRIPTIONS.md section 10)

    /// The item a widget shows: its bound item if it still exists, else the primary (nil = follow primary).
    public static func widgetItem(_ store: SubscriptionStore, boundId: String?) -> Subscription? { viewItem(store, selectedId: boundId) }

    /// The address label a widget prints: always with two or more items; with one item only when the
    /// bound item was removed, so the fall back to the primary is visible.
    public static func widgetLabel(_ store: SubscriptionStore, boundId: String?) -> String? {
        guard let item = widgetItem(store, boundId: boundId) else { return nil }
        let removed = boundId != nil && !store.items.contains { $0.id == boundId }
        return store.items.count >= 2 || removed ? displayLabel(item) : nil
    }

    /// The distinct items the placed widgets show, in order of first appearance (redraw, polling).
    public static func widgetItemIds(_ store: SubscriptionStore, boundIds: [String?]) -> [String] {
        var out: [String] = []
        for b in boundIds {
            if let id = widgetItem(store, boundId: b)?.id, !out.contains(id) { out.append(id) }
        }
        return out
    }
}
