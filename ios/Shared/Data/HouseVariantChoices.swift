import Foundation

/// The queue variant the user applied from the address lookup for a house the site lists more than once
/// (spec/ADDRESS_KEY.md section 6, rule 5); mirrors android data/repository/HouseVariantChoices.kt. Re-checks
/// of the address prefer it; without a stored choice the default (households first) applies, so addresses
/// saved before 1.4.1 move to the households' queue. Keyed by street id and `HouseKey`.
public enum HouseVariantChoices {
    private static let storeKey = "house_variant_choice"

    static func key(_ streetId: String, _ house: String) -> String { "\(streetId)|\(HouseKey.of(house))" }

    public static func get(streetId: String, house: String) -> HouseVariant? {
        if streetId.ktIsBlank || HouseKey.of(house).isEmpty { return nil }
        guard let all = AppGroup.suite.dictionary(forKey: storeKey),
              let entry = all[key(streetId, house)] as? [String: Any],
              let queue = entry["queue"] as? String else { return nil }
        return HouseVariant(queue: queue, statusText: nil, consumers: entry["consumers"] as? [String] ?? [])
    }

    /// `variant` nil forgets the choice (the house has a single queue).
    public static func put(streetId: String, house: String, variant: HouseVariant?) {
        if streetId.ktIsBlank || HouseKey.of(house).isEmpty { return }
        var all = AppGroup.suite.dictionary(forKey: storeKey) ?? [:]
        if let variant {
            all[key(streetId, house)] = ["queue": variant.queue, "consumers": variant.consumers]
        } else {
            all.removeValue(forKey: key(streetId, house))
        }
        AppGroup.suite.set(all, forKey: storeKey)
    }
}
