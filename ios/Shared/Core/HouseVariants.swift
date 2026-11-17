import Foundation

/// A house listed in several ztoe rows (households / non-household, sometimes two queues of one type).
/// Mirror of android core/HouseVariants.kt; rules in spec/ADDRESS_KEY.md section 6, cases in
/// spec/vectors/house_variants.json.
public enum ConsumerType {
    public static let HOUSEHOLD = "household"
    public static let BUSINESS = "business"

    /// `household`, `business` or `""` when the text names no consumer type. A type code maps to itself.
    public static func of(_ raw: String?) -> String {
        guard let raw, !raw.ktTrim().isEmpty else { return "" }
        let s = TextNorm.decodeEntities(raw).ktTrim().lowercased()
        if s == HOUSEHOLD || s == BUSINESS { return s }
        if s.contains("непобут") || s.contains("юридич") { return BUSINESS }
        if s.contains("побут") { return HOUSEHOLD }
        return ""
    }
}

/// One queue (or one status without a queue) of a house, with the consumer types the site lists it for.
public struct HouseVariant: Equatable, Hashable, Sendable {
    public var queue: String
    public var statusText: String?
    public var consumers: [String]

    public init(queue: String, statusText: String? = nil, consumers: [String] = []) {
        self.queue = queue
        self.statusText = statusText
        self.consumers = consumers
    }
}

public enum HouseVariants {
    private static func nonBlank(_ s: String?) -> String? {
        guard let s, !s.ktTrim().isEmpty else { return nil }
        return s
    }

    /// Folds one table row into `variants`: same non-empty queue = same variant; all status rows = one variant.
    public static func add(_ variants: [HouseVariant], queue: String, statusText: String?, consumerRaw: String?) -> [HouseVariant] {
        let type = ConsumerType.of(consumerRaw)
        let q = queue.ktTrim()
        guard let idx = variants.firstIndex(where: { q.isEmpty ? $0.queue.isEmpty : $0.queue == q }) else {
            return variants + [HouseVariant(queue: q, statusText: q.isEmpty ? nonBlank(statusText) : nil, consumers: type.isEmpty ? [] : [type])]
        }
        var out = variants
        var merged = out[idx]
        if merged.statusText == nil && q.isEmpty { merged.statusText = nonBlank(statusText) }
        if !type.isEmpty && !merged.consumers.contains(type) { merged.consumers.append(type) }
        out[idx] = merged
        return out
    }

    /// Unites two variant lists (the rows of `b` come after those of `a`).
    public static func union(_ a: [HouseVariant], _ b: [HouseVariant]) -> [HouseVariant] {
        var out = a
        for v in b {
            if v.consumers.isEmpty {
                out = add(out, queue: v.queue, statusText: v.statusText, consumerRaw: nil)
            } else {
                for c in v.consumers { out = add(out, queue: v.queue, statusText: v.statusText, consumerRaw: c) }
            }
        }
        return out
    }

    /// Households first, then a queue before no queue, otherwise discovery order.
    public static func ordered(_ variants: [HouseVariant]) -> [HouseVariant] {
        func rank(_ v: HouseVariant) -> Int { (v.consumers.contains(ConsumerType.HOUSEHOLD) ? 0 : 2) + (v.queue.isEmpty ? 1 : 0) }
        return variants.enumerated()
            .sorted { a, b in rank(a.element) != rank(b.element) ? rank(a.element) < rank(b.element) : a.offset < b.offset }
            .map { $0.element }
    }

    /// The variant to apply (spec/ADDRESS_KEY.md section 6, rule 5). `preferredQueue` nil: the first. Otherwise the
    /// variant with that queue (`""` = the one without a queue) while it still lists one of `preferredConsumers` (or
    /// none were given); else the first variant that lists one of them; else the first.
    public static func pick(_ variants: [HouseVariant], preferredQueue: String?, preferredConsumers: [String] = []) -> HouseVariant? {
        let list = ordered(variants)
        if let preferredQueue {
            let p = preferredQueue.ktTrim()
            func sharesType(_ v: HouseVariant) -> Bool { preferredConsumers.isEmpty || v.consumers.contains { preferredConsumers.contains($0) } }
            if let hit = list.first(where: { $0.queue == p && sharesType($0) }) { return hit }
            if !preferredConsumers.isEmpty, let byType = list.first(where: { v in v.consumers.contains { preferredConsumers.contains($0) } }) {
                return byType
            }
        }
        return list.first
    }
}
