import Foundation

// Mirror of android data/parser/ZtoeAddressLookup.kt: the REM → settlement → street → house index of
// https://www.ztoe.com.ua/unhooking-search.php, its regex scanners, the shared in-memory cache and its
// versioned JSON file in the App Group container. Emergencies are not read here (PowerOn does that).

public typealias AddressLookupResult = ZtoeHouseLookupResult

public struct ZtoeRemOption: Equatable, Hashable, Sendable {
    public var id: String
    public var ztoeRemId: Int
    public var nameUk: String
    public var nameEn: String
    public var ztoeOtgId: Int?

    public init(id: String, ztoeRemId: Int, nameUk: String, nameEn: String, ztoeOtgId: Int? = nil) {
        self.id = id
        self.ztoeRemId = ztoeRemId
        self.nameUk = nameUk
        self.nameEn = nameEn
        self.ztoeOtgId = ztoeOtgId
    }

    public var settlements: [ZtoeSettlementOption] { ZtoeAddressLookup.getSettlementsForRem(id) }
}

public struct ZtoeSettlementOption: Equatable, Hashable, Sendable {
    public var id: String
    public var remId: String
    public var ztoeNaspunktId: Int
    public var nameUk: String
    public var nameEn: String
    public var poweronCityId: Int?

    public init(id: String, remId: String, ztoeNaspunktId: Int, nameUk: String, nameEn: String, poweronCityId: Int? = nil) {
        self.id = id
        self.remId = remId
        self.ztoeNaspunktId = ztoeNaspunktId
        self.nameUk = nameUk
        self.nameEn = nameEn
        self.poweronCityId = poweronCityId
    }

    public var streets: [ZtoeStreetOption] { ZtoeAddressLookup.getStreetsForSettlement(id) }
}

/// One street of one settlement. ztoe and PowerOn list the same street under several ids (apostrophe,
/// case or spacing differences), so an option holds every id that `StreetKey` puts into one group:
/// `allIds` (option ids), `ztoeVulicaIds` and `poweronStreetIds`. `id`, `ztoeVulicaId` and
/// `poweronStreetId` are the canonical ones.
public struct ZtoeStreetOption: Equatable, Hashable, Sendable {
    public var id: String
    public var settlementId: String
    public var ztoeVulicaId: Int
    public var nameUk: String
    public var nameEn: String
    public var poweronStreetId: Int?
    public var allIds: [String]
    public var ztoeVulicaIds: [Int]
    public var poweronStreetIds: [Int]

    /// The list defaults are the Kotlin ones: `[id]`, `[ztoeVulicaId]` and `[poweronStreetId]` without nil.
    public init(
        id: String,
        settlementId: String,
        ztoeVulicaId: Int,
        nameUk: String,
        nameEn: String,
        poweronStreetId: Int? = nil,
        allIds: [String]? = nil,
        ztoeVulicaIds: [Int]? = nil,
        poweronStreetIds: [Int]? = nil
    ) {
        self.id = id
        self.settlementId = settlementId
        self.ztoeVulicaId = ztoeVulicaId
        self.nameUk = nameUk
        self.nameEn = nameEn
        self.poweronStreetId = poweronStreetId
        self.allIds = allIds ?? [id]
        self.ztoeVulicaIds = ztoeVulicaIds ?? [ztoeVulicaId]
        if let poweronStreetIds {
            self.poweronStreetIds = poweronStreetIds
        } else if let poweronStreetId {
            self.poweronStreetIds = [poweronStreetId]
        } else {
            self.poweronStreetIds = []
        }
    }

    public var houses: [ZtoeHouseLookupResult] { ZtoeAddressLookup.getHousesForStreet(id) }
}

/// The retired 1.3.x `emergencyOutage` field is not ported: emergencies come from PowerOn.
public struct ZtoeHouseLookupResult: Equatable, Hashable, Sendable {
    public var house: String
    public var queue: String
    public var statusText: String?
    public var addressLabel: String

    public init(house: String, queue: String, statusText: String? = nil, addressLabel: String = "") {
        self.house = house
        self.queue = queue
        self.statusText = statusText
        self.addressLabel = addressLabel
    }
}

public enum ZtoeAddressLookup {
    public static let DEFAULT_SITE_URL = "https://www.ztoe.com.ua/unhooking-search.php"

    /// Bumped to 2 when merged street ids were introduced; caches of other versions are discarded.
    /// 3: drops street house lists that were cut to ztoe's first page of 10 records (per-street request without all=1).
    static let CACHE_VERSION = 3
    /// One JSON file in the App Group container (Android: SharedPreferences `zt_address_index_cache_v1`).
    static let CACHE_FILE_NAME = "zt_address_index_cache_v1.json"
    private static let MAX_PERSISTED_HOUSE_STREETS = 50
    private static let FRESH_HOUSE_CACHE_TTL_MS: Int64 = 120_000

    /// The bulk page for a whole settlement (all=1) is large; it is fetched at most once per TTL.
    static let BULK_TTL_MS: Int64 = 6 * 60 * 60 * 1000
    private static let FORCE_REFRESH_MIN_INTERVAL_MS: Int64 = 10 * 60 * 1000
    private static let IN_FLIGHT_WAIT_SECONDS: Double = 45

    private static let SCHEDULE_MARKER = "Графіки погодинних відключень"

    /// The User-Agent the Android lookup sends with its form posts.
    static let USER_AGENT = "Mozilla/5.0 (iPhone; ZTBlackoutPreWarning)"

    /// Injectable for tests.
    public static var http: HttpClient = URLSessionHttp.shared

    /// ZtoeParser.ALL_QUEUES.
    private static let ALL_QUEUES: Set<String> = [
        "1.1", "1.2", "2.1", "2.2", "3.1", "3.2",
        "4.1", "4.2", "5.1", "5.2", "6.1", "6.2"
    ]

    // Java `\s` is ASCII whitespace: spelled with Rx.ws. Java `\d` is ASCII: spelled [0-9].
    // The `<select ...>([\s\S]*?)</select>` patterns are split into an opening-tag regex plus a literal
    // search for the closing tag (same result, no long lazy loop in ICU).
    private static let SELECT_REM_OPEN = Rx("<select[^>]*name=[\"']?rem_id[\"']?[^>]*>", ignoreCase: true)
    private static let SELECT_NASPUNKT_OPEN = Rx("<select[^>]*name=[\"']?naspunkt_id[\"']?[^>]*>", ignoreCase: true)
    private static let SELECT_VULICA_OPEN = Rx("<select[^>]*name=[\"']?vulica_id[\"']?[^>]*>", ignoreCase: true)
    private static let OPTION_TAG_REGEX = Rx("<option\(Rx.ws)+value=[\"']?([0-9]+)[\"']?[^>]*>([\\s\\S]*?)</option>", ignoreCase: true)
    private static let TR_TAG_REGEX = Rx("<tr\\b[^>]*>([\\s\\S]*?)</tr>", ignoreCase: true)
    private static let TD_TH_TAG_REGEX = Rx("<(?:td|th)\\b[^>]*>([\\s\\S]*?)</(?:td|th)>", ignoreCase: true)
    private static let HTML_TAG_STRIP_REGEX = Rx("<[^>]*>")
    private static let WHITESPACE_REGEX = Rx("\(Rx.ws)+")
    private static let NON_DIGIT_REGEX = Rx("[^0-9]")
    private static let PARENS_REGEX = Rx("\\([^)]*\\)")
    private static let CITY_PREFIX_REGEX = Rx("^(?:(?:м|с|смт)\\.\(Rx.ws)*|(?:місто|село|смт|селище)\(Rx.ws)+)")
    private static let CITY_PUNCT_REGEX = Rx("[.,\"«»]")
    private static let LABEL_VILLAGE_REGEX = Rx("^село\(Rx.ws)+", ignoreCase: true)
    private static let LABEL_TOWN_REGEX = Rx("^місто\(Rx.ws)+", ignoreCase: true)

    /// Canonical street type tokens as they appear in a `StreetKey` (after the Latin look-alike skeleton).
    private static let STREET_TYPE_KEY_TOKENS: Set<String> = Set(
        ["вул", "пров", "просп", "б-р", "пл", "пр-д", "узв", "туп", "наб", "шосе", "майдан"].map { TextNorm.skeleton($0) }
    )

    // ---------------------------------------------------------------------------------------------
    // Shared state (app, widget and background tasks): every access goes through `sync`.
    // A recursive lock, because compound updates (hydration, registerStreets) call the lookups.
    // ---------------------------------------------------------------------------------------------

    private struct InFlight {
        let token: UInt64
        let task: Task<[ZtoeStreetOption], Never>
    }

    private static let lock = NSRecursiveLock()
    /// Android `appContext != null`: persisting is allowed only after `initDiskCache()`.
    private static var diskCacheEnabled = false
    private static var diskCacheHydrated = false
    private static var hydrateAttempted = false
    private static var cachedRems: [ZtoeRemOption]? = nil
    private static var cachedSettlementsByRem: [String: [ZtoeSettlementOption]] = [:]
    /// Merged street lists per settlement; every list written here already went through `mergeStreets`.
    private static var cachedStreetsBySettlement: [String: [ZtoeStreetOption]] = [:]
    /// Any street option id (canonical or merged duplicate) to its option.
    private static var streetByAnyId: [String: ZtoeStreetOption] = [:]
    /// Houses by canonical street id.
    private static var cachedHousesByStreet: [String: [ZtoeHouseLookupResult]] = [:]
    private static var houseCacheUpdatedAtByStreet: [String: Int64] = [:]
    private static var bulkFetchedAtBySettlement: [String: Int64] = [:]
    private static var inFlight: [String: InFlight] = [:]
    private static var flightCounter: UInt64 = 0
    private static var recentHouseStreets: [String] = []
    private static var persistPending = false
    private static let persistQueue = DispatchQueue(label: "ZtoeDiskCachePersist", qos: .background)

    private static func sync<T>(_ body: () throws -> T) rethrows -> T {
        lock.lock()
        defer { lock.unlock() }
        return try body()
    }

    private static func nowMs() -> Int64 { Int64((Date().timeIntervalSince1970 * 1000).rounded(.down)) }

    // ---------------------------------------------------------------------------------------------
    // Static fallback directory
    // ---------------------------------------------------------------------------------------------

    public static let ZTOE_REM_OPTIONS: [ZtoeRemOption] = ZtoeStaticDirectory.REMS
    public static let ZTOE_SETTLEMENTS: [ZtoeSettlementOption] = ZtoeStaticDirectory.SETTLEMENTS

    /// Static streets, already merged by `StreetKey` (lazy, like Kotlin `by lazy`).
    public static let ZTOE_STREETS: [ZtoeStreetOption] = mergeStreets(ZtoeStaticDirectory.STREETS_RAW)

    private static let staticStreetByAnyId: [String: ZtoeStreetOption] = {
        var m: [String: ZtoeStreetOption] = [:]
        for s in ZTOE_STREETS { for id in s.allIds { m[id] = s } }
        return m
    }()

    private static let staticStreetByVulica: [Int: ZtoeStreetOption] = {
        var m: [Int: ZtoeStreetOption] = [:]
        for s in ZTOE_STREETS { for v in s.ztoeVulicaIds where m[v] == nil { m[v] = s } }
        return m
    }()

    public static var DIRECTORY: [ZtoeRemOption] { getRems() }

    public static func getRems() -> [ZtoeRemOption] {
        sync { cachedRems } ?? ZTOE_REM_OPTIONS
    }

    public static func getSettlementsForRem(_ remId: String) -> [ZtoeSettlementOption] {
        sync { cachedSettlementsByRem[remId] } ?? ZTOE_SETTLEMENTS.filter { $0.remId == remId }
    }

    public static func getStreetsForSettlement(_ settlementId: String) -> [ZtoeStreetOption] {
        let sid = canonicalSettlementId(settlementId)
        return sync { cachedStreetsBySettlement[sid] } ?? ZTOE_STREETS.filter { $0.settlementId == sid }
    }

    /// Houses of the street (any of its merged ids). Empty until the live index loaded them; there are no fake defaults.
    public static func getHousesForStreet(_ streetId: String) -> [ZtoeHouseLookupResult] {
        if let direct = sync({ cachedHousesByStreet[streetId] }) { return direct }
        guard let canonical = findStreetById(streetId)?.id else { return [] }
        return sync { cachedHousesByStreet[canonical] } ?? []
    }

    private static func canonicalSettlementId(_ id: String) -> String {
        ZtoeStaticDirectory.LEGACY_SETTLEMENT_IDS[id] ?? id
    }

    public static func findSettlementById(_ settlementId: String) -> ZtoeSettlementOption? {
        let id = canonicalSettlementId(settlementId)
        let lists: [[ZtoeSettlementOption]] = sync { Array(cachedSettlementsByRem.values) }
        for list in lists {
            if let found = list.first(where: { $0.id == id }) {
                if found.poweronCityId != nil { return found }
                let staticMatch = ZTOE_SETTLEMENTS.first { $0.id == found.id || $0.ztoeNaspunktId == found.ztoeNaspunktId }
                if let cityId = staticMatch?.poweronCityId {
                    var copy = found
                    copy.poweronCityId = cityId
                    return copy
                }
                return found
            }
        }
        if let s = ZTOE_SETTLEMENTS.first(where: { $0.id == id }) { return s }
        if let npId = toIntOrNull(removePrefix(id, "np_")) {
            for list in lists {
                if let s = list.first(where: { $0.ztoeNaspunktId == npId }) { return s }
            }
            if let s = ZTOE_SETTLEMENTS.first(where: { $0.ztoeNaspunktId == npId }) { return s }
            return ZtoeSettlementOption(id: settlementId, remId: "", ztoeNaspunktId: npId, nameUk: "", nameEn: "")
        }
        return nil
    }

    /// Resolves the canonical option id or any merged duplicate id, plus the legacy ids of earlier versions.
    public static func findStreetById(_ streetId: String) -> ZtoeStreetOption? {
        if streetId.ktIsBlank { return nil }
        let id = ZtoeStaticDirectory.LEGACY_STREET_IDS[streetId] ?? streetId
        if let s = sync({ streetByAnyId[id] }) { return s }
        if let s = staticStreetByAnyId[id] { return s }
        guard let vulId = toIntOrNull(removePrefix(id, "st_")) else { return nil }
        if let s = sync({ streetByAnyId.values.first(where: { $0.ztoeVulicaIds.contains(vulId) }) }) { return s }
        if let s = staticStreetByVulica[vulId] { return s }
        return ZtoeStreetOption(id: streetId, settlementId: "", ztoeVulicaId: vulId, nameUk: "", nameEn: "")
    }

    // ---------------------------------------------------------------------------------------------
    // Street merge (spec/ADDRESS_KEY.md section 5)
    // ---------------------------------------------------------------------------------------------

    /// Groups streets of one settlement by `StreetKey.of` and returns one option per group that holds
    /// all ids. Display name: first name seen. Canonical id: a static (non "st_") id when there is one,
    /// otherwise the member with the lowest ztoe id. Idempotent, so it is safe to apply to data that
    /// is already merged (cache hydration, read).
    static func mergeStreets(_ streets: [ZtoeStreetOption]) -> [ZtoeStreetOption] {
        if streets.isEmpty { return streets }
        var order: [String] = []
        var groups: [String: [ZtoeStreetOption]] = [:]
        var anonymous = 0
        for s in streets {
            let key = StreetKey.of(s.nameUk)
            let groupKey: String
            if key.isEmpty {
                groupKey = "#\(anonymous)"
                anonymous += 1
            } else {
                groupKey = "\(s.settlementId)|\(key)"
            }
            if groups[groupKey] == nil {
                order.append(groupKey)
                groups[groupKey] = [s]
            } else {
                groups[groupKey]!.append(s)
            }
        }
        return order.map { mergeGroup(groups[$0]!) }
    }

    private static func mergeGroup(_ group: [ZtoeStreetOption]) -> ZtoeStreetOption {
        let first = group[0]
        var canonicalIndex = 0
        if let i = group.firstIndex(where: { !$0.id.ktStartsWith("st_") }) {
            canonicalIndex = i
        } else {
            // minByOrNull: the first member with the lowest ztoe id
            for (i, s) in group.enumerated() where s.ztoeVulicaId < group[canonicalIndex].ztoeVulicaId {
                canonicalIndex = i
            }
        }
        let canonical = group[canonicalIndex]
        var ordered: [ZtoeStreetOption] = [canonical]
        for (i, s) in group.enumerated() where i != canonicalIndex { ordered.append(s) }

        var allIds: [String] = [canonical.id]
        var vulicaIds: [Int] = [canonical.ztoeVulicaId]
        var poweronIds: [Int] = []
        for s in ordered {
            allIds += s.allIds
            allIds.append(s.id)
            vulicaIds += s.ztoeVulicaIds
            vulicaIds.append(s.ztoeVulicaId)
            poweronIds += s.poweronStreetIds
            if let p = s.poweronStreetId { poweronIds.append(p) }
        }
        poweronIds = distinct(poweronIds)

        var out = canonical
        out.nameUk = first.nameUk
        out.nameEn = first.nameEn
        out.poweronStreetId = canonical.poweronStreetId ?? poweronIds.first
        out.allIds = distinct(allIds)
        out.ztoeVulicaIds = distinct(vulicaIds)
        out.poweronStreetIds = poweronIds
        return out
    }

    /// Publishes a merged street list and re-keys houses cached under an id that stopped being canonical.
    private static func registerStreets(_ settlementId: String, _ merged: [ZtoeStreetOption]) {
        sync {
            cachedStreetsBySettlement[settlementId] = merged
            for st in merged {
                for id in st.allIds {
                    let prev = streetByAnyId.updateValue(st, forKey: id)
                    if let prev, prev.id != st.id {
                        if let old = cachedHousesByStreet.removeValue(forKey: prev.id) {
                            if let existing = cachedHousesByStreet[st.id] {
                                cachedHousesByStreet[st.id] = unionHouses(existing, old)
                            } else {
                                cachedHousesByStreet[st.id] = old
                            }
                        }
                        houseCacheUpdatedAtByStreet.removeValue(forKey: prev.id)
                    }
                }
            }
        }
    }

    // ---------------------------------------------------------------------------------------------
    // House helpers
    // ---------------------------------------------------------------------------------------------

    /// Kotlin `LinkedHashMap<HouseKey, house>` filled through `putHouse`.
    private struct HouseMap {
        private var order: [String] = []
        private var byKey: [String: ZtoeHouseLookupResult] = [:]

        var isEmpty: Bool { order.isEmpty }
        var values: [ZtoeHouseLookupResult] { order.compactMap { byKey[$0] } }

        /// First display form wins, except that a row with a queue replaces a row without one.
        mutating func put(_ h: ZtoeHouseLookupResult) {
            let key = HouseKey.of(h.house)
            if key.isEmpty { return }
            if let existing = byKey[key] {
                if existing.queue.isEmpty && !h.queue.isEmpty { byKey[key] = h }
            } else {
                order.append(key)
                byKey[key] = h
            }
        }
    }

    /// Number prefix first, then the lower-cased text compared by UTF-16 code units (Kotlin String.compareTo).
    private static func sortHouses(_ houses: [ZtoeHouseLookupResult]) -> [ZtoeHouseLookupResult] {
        let maxInt = Int(Int32.max)
        let entries: [(house: ZtoeHouseLookupResult, number: Int, text: [UInt16])] = houses.map { (h: ZtoeHouseLookupResult) -> (house: ZtoeHouseLookupResult, number: Int, text: [UInt16]) in
            let text = h.house.ktTrim().lowercased()
            let units = Array(text.utf16)
            var end = 0
            while end < units.count && units[end] >= 0x30 && units[end] <= 0x39 { end += 1 }
            let number: Int
            if end == 0 {
                number = maxInt
            } else {
                let digits = String(decoding: units[0..<end], as: UTF16.self)
                number = Int32(digits).map { Int($0) } ?? maxInt
            }
            return (house: h, number: number, text: units)
        }
        return entries.stableSorted { a, b in
            if a.number != b.number { return a.number < b.number }
            return a.text.lexicographicallyPrecedes(b.text)
        }.map { $0.house }
    }

    static func unionHouses(_ a: [ZtoeHouseLookupResult], _ b: [ZtoeHouseLookupResult]) -> [ZtoeHouseLookupResult] {
        var map = HouseMap()
        for h in a { map.put(h) }
        for h in b { map.put(h) }
        return sortHouses(map.values)
    }

    private static func storeStreetHouses(_ canonicalStreetId: String, _ houses: [ZtoeHouseLookupResult]) {
        sync {
            cachedHousesByStreet[canonicalStreetId] = houses
            houseCacheUpdatedAtByStreet[canonicalStreetId] = nowMs()
        }
        recordRecentHouseStreet(canonicalStreetId)
    }

    private static func recordRecentHouseStreet(_ streetId: String) {
        if streetId.ktIsBlank { return }
        sync {
            recentHouseStreets.removeAll { $0 == streetId }
            recentHouseStreets.insert(streetId, at: 0)
            while recentHouseStreets.count > MAX_PERSISTED_HOUSE_STREETS {
                recentHouseStreets.removeLast()
            }
        }
    }

    private static func recentSnapshot() -> [String] { sync { recentHouseStreets } }

    // ---------------------------------------------------------------------------------------------
    // Text helpers
    // ---------------------------------------------------------------------------------------------

    private static func stripHtmlFast(_ raw: String) -> String {
        let noTags = HTML_TAG_STRIP_REGEX.replace(raw, template: " ")
        let decoded = TextNorm.decodeEntities(noTags).replacingOccurrences(of: "\u{00A0}", with: " ")
        return WHITESPACE_REGEX.replace(decoded, template: " ").ktTrim()
    }

    /// Exact-match key for settlement names: no prefix, no parentheses, no apostrophes; never a substring test.
    static func cityKey(_ raw: String) -> String {
        var s = TextNorm.decodeEntities(raw).lowercased()
        s = PARENS_REGEX.replace(s, template: "")
        s = CITY_PREFIX_REGEX.replace(s.ktTrim(), template: "")
        s = String(String.UnicodeScalarView(s.unicodeScalars.filter { !TextNorm.apostropheScalars.contains($0) }))
        s = CITY_PUNCT_REGEX.replace(s, template: " ").replacingOccurrences(of: "бердичив", with: "бердичів")
        return WHITESPACE_REGEX.replace(s, template: " ").ktTrim()
    }

    private static func formatSettlementLabelUk(_ rawLabel: String) -> String {
        let village = LABEL_VILLAGE_REGEX.replace(rawLabel, template: "с. ")
        return LABEL_TOWN_REGEX.replace(village, template: "м. ").ktTrim()
    }

    private static func splitHouses(_ field: String) -> [String] {
        field
            .split(omittingEmptySubsequences: false, whereSeparator: { $0 == "," || $0 == ";" })
            .map { String($0).ktTrim() }
            .filter { !$0.isEmpty && !equalsIgnoreCase($0, "будинки") }
    }

    /// The part of the page before the schedule section.
    private static func addressSection(_ html: String) -> String {
        let ns = html as NSString
        let r = ns.range(of: SCHEDULE_MARKER, options: .literal)
        return r.location != NSNotFound ? ns.substring(to: r.location) : html
    }

    private static func bareStreetKey(_ key: String) -> String {
        let ns = key as NSString
        let space = ns.range(of: " ", options: .literal)
        if space.location == NSNotFound { return STREET_TYPE_KEY_TOKENS.contains(key) ? "" : key }
        return STREET_TYPE_KEY_TOKENS.contains(ns.substring(to: space.location))
            ? ns.substring(from: space.location + 1)
            : key
    }

    private static func containsIgnoreCase(_ s: String, _ other: String) -> Bool {
        (s as NSString).range(of: other, options: .caseInsensitive).location != NSNotFound
    }

    private static func equalsIgnoreCase(_ a: String, _ b: String) -> Bool {
        (a as NSString).caseInsensitiveCompare(b) == .orderedSame
    }

    private static func isBlank(_ s: String?) -> Bool {
        guard let s else { return true }
        return !s.unicodeScalars.contains { !CharacterSet.whitespacesAndNewlines.contains($0) }
    }

    /// Kotlin `String.toIntOrNull()` (32-bit, optional sign, no whitespace).
    private static func toIntOrNull(_ s: String) -> Int? {
        Int32(s).map { Int($0) }
    }

    private static func removePrefix(_ s: String, _ prefix: String) -> String {
        s.ktStartsWith(prefix) ? (s as NSString).substring(from: (prefix as NSString).length) : s
    }

    private static func distinct<T: Hashable>(_ items: [T]) -> [T] {
        var seen = Set<T>()
        return items.filter { seen.insert($0).inserted }
    }

    private static func digitsOnly(_ s: String) -> String { NON_DIGIT_REGEX.replace(s, template: "") }

    /// All matches over a whole string in one scan.
    private static func scan(_ rx: Rx, _ ns: NSString) -> [NSTextCheckingResult] {
        rx.re.matches(in: ns as String, options: [], range: NSRange(location: 0, length: ns.length))
    }

    private static func group(_ m: NSTextCheckingResult, _ i: Int, _ ns: NSString) -> String {
        Rx.group(m, i, in: ns) ?? ""
    }

    /// Inner HTML of the first select whose opening tag matches `open`, up to the next `</select>`
    /// (Kotlin `<select ...>([\s\S]*?)</select>`).
    private static func selectInner(_ open: Rx, _ html: String) -> String? {
        let ns = NSString(string: html)
        guard let m = open.re.firstMatch(in: ns as String, options: [], range: NSRange(location: 0, length: ns.length)) else {
            return nil
        }
        let start = m.range.location + m.range.length
        let close = ns.range(of: "</select>", options: .caseInsensitive, range: NSRange(location: start, length: ns.length - start))
        if close.location == NSNotFound { return nil }
        return ns.substring(with: NSRange(location: start, length: close.location - start))
    }

    // ---------------------------------------------------------------------------------------------
    // Disk cache (one versioned JSON file in the App Group container)
    // ---------------------------------------------------------------------------------------------

    /// org.json `optString`: numbers become their text, null becomes "".
    private static func optString(_ v: Any) -> String {
        if let s = v as? String { return s }
        if v is NSNull { return "" }
        if let n = v as? NSNumber { return n.stringValue }
        return "\(v)"
    }

    /// org.json `optInt`: numbers are truncated, numeric strings are parsed, anything else is `def`.
    private static func optInt(_ v: Any?, _ def: Int) -> Int {
        guard let v, !(v is NSNull) else { return def }
        if let n = v as? NSNumber { return n.intValue }
        if let s = v as? String {
            let t = s.ktTrim()
            if let i = Int(t) { return i }
            if let d = Double(t), d.isFinite, abs(d) < 9.0e18 { return Int(d) }
        }
        return def
    }

    private static func optInt64(_ v: Any?, _ def: Int64) -> Int64 {
        guard let v, !(v is NSNull) else { return def }
        if let n = v as? NSNumber { return n.int64Value }
        if let s = v as? String {
            let t = s.ktTrim()
            if let i = Int64(t) { return i }
            if let d = Double(t), d.isFinite, abs(d) < 9.0e18 { return Int64(d) }
        }
        return def
    }

    private static func jStr(_ o: [String: Any], _ name: String) -> String? {
        guard let v = o[name], !(v is NSNull) else { return nil }
        return optString(v)
    }

    private static func jInt(_ o: [String: Any], _ name: String) -> Int? {
        guard let v = o[name], !(v is NSNull) else { return nil }
        return optInt(v, 0)
    }

    private static func jStrList(_ o: [String: Any], _ name: String) -> [String] {
        guard let arr = o[name] as? [Any] else { return [] }
        return arr.map { optString($0) }.filter { !$0.isEmpty }
    }

    private static func jIntList(_ o: [String: Any], _ name: String) -> [Int] {
        guard let arr = o[name] as? [Any] else { return [] }
        return arr.map { optInt($0, 0) }
    }

    /// The cache as Foundation objects (same shape as the Kotlin serializer).
    static func serializeCacheToObject() -> [String: Any] {
        sync {
            var root: [String: Any] = ["version": CACHE_VERSION]

            var rems: [[String: Any]] = []
            for r in cachedRems ?? [] {
                var o: [String: Any] = ["id": r.id, "ztoeRemId": r.ztoeRemId, "nameUk": r.nameUk, "nameEn": r.nameEn]
                if let otg = r.ztoeOtgId { o["ztoeOtgId"] = otg }
                rems.append(o)
            }
            root["rems"] = rems

            var settlements: [[String: Any]] = []
            for list in cachedSettlementsByRem.values {
                for s in list {
                    var o: [String: Any] = [
                        "id": s.id, "remId": s.remId, "ztoeNaspunktId": s.ztoeNaspunktId,
                        "nameUk": s.nameUk, "nameEn": s.nameEn
                    ]
                    if let city = s.poweronCityId { o["poweronCityId"] = city }
                    settlements.append(o)
                }
            }
            root["settlements"] = settlements

            var streets: [[String: Any]] = []
            for list in cachedStreetsBySettlement.values {
                for st in list {
                    var o: [String: Any] = [
                        "id": st.id, "settlementId": st.settlementId, "ztoeVulicaId": st.ztoeVulicaId,
                        "nameUk": st.nameUk, "nameEn": st.nameEn,
                        "allIds": st.allIds, "ztoeVulicaIds": st.ztoeVulicaIds, "poweronStreetIds": st.poweronStreetIds
                    ]
                    if let p = st.poweronStreetId { o["poweronStreetId"] = p }
                    streets.append(o)
                }
            }
            root["streets"] = streets

            var houses: [[String: Any]] = []
            let recent = recentHouseStreets
            let orderedStreets = Array(distinct(recent + Array(cachedHousesByStreet.keys)).prefix(MAX_PERSISTED_HOUSE_STREETS))
            for streetId in orderedStreets {
                guard let list = cachedHousesByStreet[streetId] else { continue }
                for h in list {
                    var o: [String: Any] = ["streetId": streetId, "house": h.house, "queue": h.queue]
                    if let status = h.statusText, !status.ktIsBlank { o["statusText"] = status }
                    houses.append(o)
                }
            }
            root["houses"] = houses
            root["recent"] = recent

            var bulk: [String: Any] = [:]
            for (sid, at) in bulkFetchedAtBySettlement { bulk[sid] = NSNumber(value: at) }
            root["bulkAt"] = bulk
            return root
        }
    }

    public static func serializeCacheToJson() -> String {
        let obj = serializeCacheToObject()
        guard let data = try? JSONSerialization.data(withJSONObject: obj) else { return "" }
        return String(decoding: data, as: UTF8.self)
    }

    /// Loads a stored index. A cache of another `CACHE_VERSION` is rejected. Street lists are merged
    /// again (an old cache with duplicates heals on read) and in-memory data that is already present
    /// is not overwritten by older stored data.
    @discardableResult
    public static func hydrateCacheFromJson(_ jsonStr: String) -> Bool {
        if jsonStr.ktIsBlank { return false }
        guard let data = jsonStr.data(using: .utf8),
              let parsed = try? JSONSerialization.jsonObject(with: data, options: []),
              let root = parsed as? [String: Any] else { return false }
        return hydrateCacheFromObject(root)
    }

    static func hydrateCacheFromObject(_ root: [String: Any]) -> Bool {
        if optInt(root["version"], -1) != CACHE_VERSION { return false }
        sync {
            if let arr = root["rems"] as? [Any] {
                var parsed: [ZtoeRemOption] = []
                for item in arr {
                    guard let o = item as? [String: Any],
                          let id = jStr(o, "id"),
                          let ztoeRemId = jInt(o, "ztoeRemId"),
                          let rawUk = jStr(o, "nameUk") else { continue }
                    let nameUk = stripHtmlFast(rawUk)
                    let nameEn = stripHtmlFast(jStr(o, "nameEn") ?? nameUk)
                    let staticRem = ZTOE_REM_OPTIONS.first { $0.id == id || $0.ztoeRemId == ztoeRemId }
                    parsed.append(ZtoeRemOption(
                        id: id, ztoeRemId: ztoeRemId, nameUk: nameUk, nameEn: nameEn,
                        ztoeOtgId: jInt(o, "ztoeOtgId") ?? staticRem?.ztoeOtgId
                    ))
                }
                if !parsed.isEmpty && cachedRems == nil { cachedRems = parsed }
            }

            if let arr = root["settlements"] as? [Any] {
                var order: [String] = []
                var grouped: [String: [ZtoeSettlementOption]] = [:]
                for item in arr {
                    guard let o = item as? [String: Any],
                          let id = jStr(o, "id"),
                          let remId = jStr(o, "remId"),
                          let npId = jInt(o, "ztoeNaspunktId"),
                          let rawUk = jStr(o, "nameUk") else { continue }
                    let nameUk = stripHtmlFast(rawUk)
                    let nameEn = stripHtmlFast(jStr(o, "nameEn") ?? nameUk)
                    let staticSettlement = ZTOE_SETTLEMENTS.first { $0.id == id || $0.ztoeNaspunktId == npId }
                    let cityId = jInt(o, "poweronCityId") ?? staticSettlement?.poweronCityId
                    if grouped[remId] == nil { order.append(remId) }
                    grouped[remId, default: []].append(ZtoeSettlementOption(
                        id: id, remId: remId, ztoeNaspunktId: npId, nameUk: nameUk, nameEn: nameEn, poweronCityId: cityId
                    ))
                }
                for remId in order {
                    if let list = grouped[remId], !list.isEmpty, cachedSettlementsByRem[remId] == nil {
                        cachedSettlementsByRem[remId] = list
                    }
                }
            }

            if let arr = root["streets"] as? [Any] {
                var order: [String] = []
                var grouped: [String: [ZtoeStreetOption]] = [:]
                for item in arr {
                    guard let o = item as? [String: Any],
                          let id = jStr(o, "id"),
                          let settlementId = jStr(o, "settlementId"),
                          let vulId = jInt(o, "ztoeVulicaId"),
                          let rawUk = jStr(o, "nameUk") else { continue }
                    let nameUk = stripHtmlFast(rawUk)
                    let nameEn = stripHtmlFast(jStr(o, "nameEn") ?? nameUk)
                    let staticStreet = staticStreetByAnyId[id] ?? staticStreetByVulica[vulId]
                    let poweronIds = distinct(jIntList(o, "poweronStreetIds") + (staticStreet?.poweronStreetIds ?? []))
                    if grouped[settlementId] == nil { order.append(settlementId) }
                    grouped[settlementId, default: []].append(ZtoeStreetOption(
                        id: id,
                        settlementId: settlementId,
                        ztoeVulicaId: vulId,
                        nameUk: nameUk,
                        nameEn: nameEn,
                        poweronStreetId: jInt(o, "poweronStreetId") ?? staticStreet?.poweronStreetId,
                        allIds: distinct([id] + jStrList(o, "allIds")),
                        ztoeVulicaIds: distinct([vulId] + jIntList(o, "ztoeVulicaIds")),
                        poweronStreetIds: poweronIds
                    ))
                }
                for settlementId in order {
                    if let list = grouped[settlementId], !list.isEmpty, cachedStreetsBySettlement[settlementId] == nil {
                        registerStreets(settlementId, mergeStreets(list))
                    }
                }
            }

            if let arr = root["houses"] as? [Any] {
                var order: [String] = []
                var grouped: [String: [ZtoeHouseLookupResult]] = [:]
                var accepted = Set<String>()
                for item in arr {
                    guard let o = item as? [String: Any], let streetId = jStr(o, "streetId") else { continue }
                    if !accepted.contains(streetId) {
                        if accepted.count >= MAX_PERSISTED_HOUSE_STREETS { continue }
                        accepted.insert(streetId)
                    }
                    guard let house = jStr(o, "house") else { continue }
                    let canonical = findStreetById(streetId)?.id ?? streetId
                    if grouped[canonical] == nil { order.append(canonical) }
                    grouped[canonical, default: []].append(ZtoeHouseLookupResult(
                        house: house, queue: jStr(o, "queue") ?? "", statusText: jStr(o, "statusText")
                    ))
                }
                for canonical in order {
                    if let list = grouped[canonical], !list.isEmpty, cachedHousesByStreet[canonical] == nil {
                        cachedHousesByStreet[canonical] = unionHouses(list, [])
                    }
                }
            }

            if let arr = root["recent"] as? [Any], recentHouseStreets.isEmpty {
                for item in arr {
                    let id = optString(item)
                    if !id.isEmpty && recentHouseStreets.count < MAX_PERSISTED_HOUSE_STREETS && !recentHouseStreets.contains(id) {
                        recentHouseStreets.append(id)
                    }
                }
            }

            if let bulk = root["bulkAt"] as? [String: Any] {
                for (sid, value) in bulk {
                    let at = optInt64(value, 0)
                    if at > 0 && bulkFetchedAtBySettlement[sid] == nil { bulkFetchedAtBySettlement[sid] = at }
                }
            }
            diskCacheHydrated = true
        }
        return true
    }

    /// Hydrates once per process from the App Group file; a stale or unreadable cache is removed.
    /// Also enables `persistToDiskCache()` (Android: the stored application context).
    @discardableResult
    public static func initDiskCache() -> Bool {
        let alreadyAttempted: Bool = sync {
            diskCacheEnabled = true
            if hydrateAttempted { return true }
            hydrateAttempted = true
            return false
        }
        if alreadyAttempted { return sync { diskCacheHydrated } }
        let url = AppGroup.fileURL(CACHE_FILE_NAME)
        guard FileManager.default.fileExists(atPath: url.path) else { return false }
        guard let root = AppGroup.readJSON(CACHE_FILE_NAME) as? [String: Any] else {
            AppGroup.removeFile(CACHE_FILE_NAME)
            return false
        }
        let ok = hydrateCacheFromObject(root)
        if !ok { AppGroup.removeFile(CACHE_FILE_NAME) }
        return ok
    }

    /// Writes are coalesced: calls made while a write is queued share that write.
    public static func persistToDiskCache() {
        let schedule: Bool = sync {
            if !diskCacheEnabled || persistPending { return false }
            persistPending = true
            return true
        }
        if !schedule { return }
        persistQueue.async {
            ZtoeAddressLookup.sync { ZtoeAddressLookup.persistPending = false }
            let obj = ZtoeAddressLookup.serializeCacheToObject()
            AppGroup.writeJSON(ZtoeAddressLookup.CACHE_FILE_NAME, obj)
        }
    }

    public static func clearCacheForTesting() {
        sync {
            diskCacheHydrated = false
            hydrateAttempted = false
            cachedRems = nil
            cachedSettlementsByRem.removeAll()
            cachedStreetsBySettlement.removeAll()
            streetByAnyId.removeAll()
            cachedHousesByStreet.removeAll()
            houseCacheUpdatedAtByStreet.removeAll()
            bulkFetchedAtBySettlement.removeAll()
            inFlight.removeAll()
            recentHouseStreets.removeAll()
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Network
    // ---------------------------------------------------------------------------------------------

    private static func postZtoeForm(_ formBody: String, _ siteUrl: String) async -> String? {
        guard ZtoeParser.isValidUrl(siteUrl), let url = URL(string: siteUrl) else { return nil }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 8
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.setValue(USER_AGENT, forHTTPHeaderField: "User-Agent")
        request.httpBody = Data(formBody.utf8)
        do {
            let response = try await http.send(request)
            guard (200...299).contains(response.status) else { return nil }
            let win1251 = Cp1251.decode(response.body)
            if win1251.ktContains("Оберіть") || win1251.ktContains("Черга") || win1251.ktContains("Будинки") {
                return win1251
            }
            return String(decoding: response.body, as: UTF8.self)
        } catch {
            return nil
        }
    }

    /// Resumes a continuation once, from whichever side (value or timeout) comes first.
    private final class ResumeOnce<T>: @unchecked Sendable {
        private let guardLock = NSLock()
        private var continuation: CheckedContinuation<T?, Never>?

        init(_ continuation: CheckedContinuation<T?, Never>) { self.continuation = continuation }

        func resume(_ value: T?) {
            guardLock.lock()
            let c = continuation
            continuation = nil
            guardLock.unlock()
            c?.resume(returning: value)
        }
    }

    /// The task's value, or nil when it did not finish within `timeoutSeconds`.
    private static func awaitTask(_ task: Task<[ZtoeStreetOption], Never>, timeoutSeconds: Double) async -> [ZtoeStreetOption]? {
        await withCheckedContinuation { (continuation: CheckedContinuation<[ZtoeStreetOption]?, Never>) in
            let once = ResumeOnce<[ZtoeStreetOption]>(continuation)
            let timer = Task.detached {
                try? await Task.sleep(nanoseconds: UInt64(timeoutSeconds * 1_000_000_000))
                once.resume(nil)
            }
            Task.detached {
                let value = await task.value
                once.resume(value)
                timer.cancel()
            }
        }
    }

    /// Runs `block` once per `key`; concurrent callers wait for the first caller's result and get
    /// `fallback` if it took too long (Kotlin singleFlight with a CompletableFuture per key).
    private static func singleFlightStreets(
        key: String,
        fallback: () -> [ZtoeStreetOption],
        block: @escaping @Sendable () async -> [ZtoeStreetOption]
    ) async -> [ZtoeStreetOption] {
        var mine: Task<[ZtoeStreetOption], Never>? = nil
        let running: Task<[ZtoeStreetOption], Never>? = sync {
            if let r = inFlight[key] { return r.task }
            flightCounter &+= 1
            let token = flightCounter
            let task = Task.detached { () -> [ZtoeStreetOption] in
                let value = await block()
                ZtoeAddressLookup.finishFlight(key, token)
                return value
            }
            inFlight[key] = InFlight(token: token, task: task)
            mine = task
            return nil
        }
        if let running {
            return await awaitTask(running, timeoutSeconds: IN_FLIGHT_WAIT_SECONDS) ?? fallback()
        }
        guard let mine else { return fallback() }
        return await mine.value
    }

    private static func finishFlight(_ key: String, _ token: UInt64) {
        sync {
            if inFlight[key]?.token == token { inFlight.removeValue(forKey: key) }
        }
    }

    private static func awaitInFlight(_ key: String) async {
        guard let running = sync({ inFlight[key]?.task }) else { return }
        _ = await awaitTask(running, timeoutSeconds: IN_FLIGHT_WAIT_SECONDS)
    }

    // ---------------------------------------------------------------------------------------------
    // Directory parsing (rem, settlement, street selects)
    // ---------------------------------------------------------------------------------------------

    public static func parseZtoeRemOptionsHtml(_ html: String) -> [ZtoeRemOption] {
        guard let inner = selectInner(SELECT_REM_OPEN, html) else { return [] }
        let ns = inner as NSString
        var parsed: [ZtoeRemOption] = []
        var seenIds = Set<String>()
        for m in scan(OPTION_TAG_REGEX, ns) {
            guard let remNum = toIntOrNull(group(m, 1, ns).ktTrim()) else { continue }
            if remNum <= 0 { continue }
            let label = stripHtmlFast(group(m, 2, ns))
            if label.isEmpty || containsIgnoreCase(label, "Оберіть") { continue }
            let matchedExisting = ZTOE_REM_OPTIONS.first(where: { equalsIgnoreCase($0.nameUk, label) })
                ?? ZTOE_REM_OPTIONS.first(where: { $0.ztoeRemId == remNum })
            if let matchedExisting {
                if seenIds.insert(matchedExisting.id).inserted {
                    var copy = matchedExisting
                    copy.ztoeRemId = remNum
                    parsed.append(copy)
                }
            } else {
                let id = "rem_\(remNum)"
                if seenIds.insert(id).inserted {
                    let ukLabel = containsIgnoreCase(label, "РЕМ") ? label : "\(label) РЕМ"
                    parsed.append(ZtoeRemOption(id: id, ztoeRemId: remNum, nameUk: ukLabel, nameEn: label))
                }
            }
        }
        for staticRem in ZTOE_REM_OPTIONS where seenIds.insert(staticRem.id).inserted {
            parsed.append(staticRem)
        }
        return parsed
    }

    public static func parseZtoeSettlementOptionsHtml(_ remId: String, _ html: String) -> [ZtoeSettlementOption] {
        guard let inner = selectInner(SELECT_NASPUNKT_OPEN, html) else { return [] }
        let ns = inner as NSString
        let existingForRem = ZTOE_SETTLEMENTS.filter { $0.remId == remId }
        let existingKeys = existingForRem.map { cityKey($0.nameUk) }
        var parsed: [ZtoeSettlementOption] = []
        var seenIds = Set<String>()
        for m in scan(OPTION_TAG_REGEX, ns) {
            guard let npId = toIntOrNull(group(m, 1, ns).ktTrim()) else { continue }
            if npId <= 0 { continue }
            let label = formatSettlementLabelUk(stripHtmlFast(group(m, 2, ns)))
            if label.isEmpty || containsIgnoreCase(label, "Оберіть") { continue }
            let labelKey = cityKey(label)
            let byName = existingKeys.firstIndex(of: labelKey).map { existingForRem[$0] }
            let candidate = byName ?? existingForRem.first { $0.ztoeNaspunktId == npId }
            let matchedExisting = candidate.flatMap { (c: ZtoeSettlementOption) -> ZtoeSettlementOption? in seenIds.contains(c.id) ? nil : c }

            if let matchedExisting {
                seenIds.insert(matchedExisting.id)
                var copy = matchedExisting
                copy.ztoeNaspunktId = npId
                parsed.append(copy)
            } else {
                let id = "np_\(npId)"
                if seenIds.insert(id).inserted {
                    parsed.append(ZtoeSettlementOption(id: id, remId: remId, ztoeNaspunktId: npId, nameUk: label, nameEn: label))
                }
            }
        }
        return parsed
    }

    /// Parses the street select and returns the list already merged by `StreetKey`.
    public static func parseZtoeStreetOptionsHtml(_ settlementId: String, _ html: String) -> [ZtoeStreetOption] {
        guard let inner = selectInner(SELECT_VULICA_OPEN, html) else { return [] }
        let ns = inner as NSString
        let staticForSettlement = ZTOE_STREETS.filter { $0.settlementId == settlementId }
        var staticByKey: [String: ZtoeStreetOption] = [:]
        for s in staticForSettlement {
            let key = StreetKey.of(s.nameUk)
            if staticByKey[key] == nil { staticByKey[key] = s }
        }
        var usedStatic = Set<String>()
        var parsed: [ZtoeStreetOption] = []
        for m in scan(OPTION_TAG_REGEX, ns) {
            guard let vulId = toIntOrNull(group(m, 1, ns).ktTrim()) else { continue }
            if vulId <= 0 { continue }
            let label = stripHtmlFast(group(m, 2, ns))
            if label.isEmpty || containsIgnoreCase(label, "Оберіть") { continue }
            var candidate = staticByKey[StreetKey.of(label)]
            if candidate == nil, let byVulica = staticStreetByVulica[vulId], byVulica.settlementId == settlementId {
                candidate = byVulica
            }
            if let matchedStatic = candidate, usedStatic.insert(matchedStatic.id).inserted {
                var copy = matchedStatic
                copy.ztoeVulicaId = vulId
                copy.ztoeVulicaIds = [vulId]
                copy.allIds = [matchedStatic.id]
                parsed.append(copy)
            } else {
                parsed.append(ZtoeStreetOption(id: "st_\(vulId)", settlementId: settlementId, ztoeVulicaId: vulId, nameUk: label, nameEn: label))
            }
        }
        return mergeStreets(parsed)
    }

    // ---------------------------------------------------------------------------------------------
    // House table parsing
    // ---------------------------------------------------------------------------------------------

    /// Parses a settlement-wide ZTOE response (`rem_id=X&naspunkt_id=Y&all=1`) and indexes the houses of
    /// EVERY street of the settlement in one pass. A row is assigned to a street only when the
    /// `StreetKey` of its name equals the key of the street (or, when exactly one street fits and one
    /// side has no street type, the bare names are equal). Never by substring.
    /// `cache` is false for a one-street page: the caller unites the rows of all ids of the street first.
    @discardableResult
    public static func parseZtoeSettlementHousesTableHtml(
        _ settlementId: String,
        _ streets: [ZtoeStreetOption],
        _ html: String,
        cache: Bool = true
    ) -> [String: [ZtoeHouseLookupResult]] {
        if isBlank(html) || streets.isEmpty { return [:] }

        let merged = mergeStreets(streets)
        var idByKey: [String: String] = [:]
        var keyById: [String: String] = [:]
        var idsByBare: [String: [String]] = [:]
        for st in merged {
            let key = StreetKey.of(st.nameUk)
            if key.isEmpty { continue }
            if idByKey[key] == nil { idByKey[key] = st.id }
            keyById[st.id] = key
            let bare = bareStreetKey(key)
            if !bare.isEmpty { idsByBare[bare, default: []].append(st.id) }
        }

        var rowMatchCache: [String: String?] = [:]
        func matchStreet(_ rawName: String) -> String? {
            if let cached = rowMatchCache[rawName] { return cached }
            let key = StreetKey.of(rawName)
            var found = idByKey[key]
            if found == nil && !key.isEmpty {
                let bare = bareStreetKey(key)
                let candidates = bare.isEmpty ? nil : idsByBare[bare]
                if let candidates, candidates.count == 1 {
                    // at least one side must have no street type, otherwise "вул. X" would match "пров. X"
                    let candidateKey = keyById[candidates[0]] ?? ""
                    if key == bare || candidateKey == bare {
                        found = candidates[0]
                    }
                }
            }
            rowMatchCache.updateValue(found, forKey: rawName)
            return found
        }

        var houseMaps: [String: HouseMap] = [:]
        let section = NSString(string: addressSection(html))
        for trMatch in scan(TR_TAG_REGEX, section) {
            let rowHtml = group(trMatch, 1, section)
            if containsIgnoreCase(rowHtml, "<select") || containsIgnoreCase(rowHtml, "<input") {
                continue
            }
            let rowNs = rowHtml as NSString
            var cells: [String] = []
            cells.reserveCapacity(7)
            for cellMatch in scan(TD_TH_TAG_REGEX, rowNs) {
                cells.append(stripHtmlFast(group(cellMatch, 1, rowNs)))
            }
            if cells.count < 5 { continue }

            if cells[0].lowercased() == "рем" || cells[2].lowercased().ktContains("назва вулиці") {
                continue
            }

            let streetNameRaw = cells[2].ktTrim()
            let houseField = cells[3].ktTrim()
            if streetNameRaw.isEmpty || houseField.isEmpty { continue }

            guard let streetId = matchStreet(streetNameRaw) else { continue }

            let col4 = cells[4].ktTrim()
            let col5 = cells.count >= 6 ? cells[5].ktTrim() : ""
            let candidateQueue = "\(digitsOnly(col4)).\(digitsOnly(col5))"

            let resolvedQueue: String
            let resolvedStatusText: String?
            if ALL_QUEUES.contains(candidateQueue) {
                resolvedQueue = candidateQueue
                resolvedStatusText = nil
            } else if col4.ktLength > 3 {
                resolvedQueue = ""
                resolvedStatusText = col4
            } else {
                continue
            }

            for h in splitHouses(houseField) {
                houseMaps[streetId, default: HouseMap()].put(
                    ZtoeHouseLookupResult(house: h, queue: resolvedQueue, statusText: resolvedStatusText)
                )
            }
        }

        var result: [String: [ZtoeHouseLookupResult]] = [:]
        for (streetId, map) in houseMaps {
            if map.isEmpty { continue }
            result[streetId] = sortHouses(map.values)
        }
        if cache && !result.isEmpty {
            let now = nowMs()
            sync {
                for (streetId, sorted) in result {
                    cachedHousesByStreet[streetId] = sorted
                    houseCacheUpdatedAtByStreet[streetId] = now
                }
            }
        }
        return result
    }

    /// Parses HTML table rows from ZTOE unhooking-search.php address lookup results.
    /// Supports 7-column real ZTOE tables, 3-column [Queue, Subqueue, Houses] or [House, Queue, Subqueue] tables,
    /// and colspan status messages using fast regex/string scanning.
    public static func parseZtoeAddressLookupTableHtml(_ html: String) -> [ZtoeHouseLookupResult] {
        var results: [ZtoeHouseLookupResult] = []
        let section = NSString(string: addressSection(html))

        for trMatch in scan(TR_TAG_REGEX, section) {
            let rowHtml = group(trMatch, 1, section)
            if containsIgnoreCase(rowHtml, "<select") || containsIgnoreCase(rowHtml, "<input") { continue }
            let rowNs = rowHtml as NSString
            let cells = scan(TD_TH_TAG_REGEX, rowNs).map { stripHtmlFast(group($0, 1, rowNs)) }
            if cells.count < 2 { continue }

            let joinedLower = cells.joined(separator: " ").lowercased()
            if joinedLower.ktContains("населений пункт") ||
                joinedLower.ktContains("назва вулиці") ||
                (cells[0].lowercased().ktContains("черга") && cells[1].lowercased().ktContains("підчерга")) {
                continue
            }

            // Format A: Real ZTOE 5+ column address lookup table:
            // [0] REM, [1] settlement, [2] street, [3] houses, [4] queue (or colspan="3" status message), [5] subqueue
            if cells.count >= 5 {
                let col4 = cells[4].ktTrim()
                let col5 = cells.count >= 6 ? cells[5].ktTrim() : ""
                let houses = splitHouses(cells[3])

                if !houses.isEmpty {
                    let candidateQueue = "\(digitsOnly(col4)).\(digitsOnly(col5))"

                    if ALL_QUEUES.contains(candidateQueue) {
                        for h in houses {
                            results.append(ZtoeHouseLookupResult(house: h, queue: candidateQueue))
                        }
                        continue
                    } else if col4.ktLength > 3 {
                        for h in houses {
                            results.append(ZtoeHouseLookupResult(house: h, queue: "", statusText: col4))
                        }
                        continue
                    }
                }
            }

            // Format B1: 3-column table [Queue, Subqueue, Houses]
            if cells.count >= 3 {
                let candidateQueue01 = "\(digitsOnly(cells[0])).\(digitsOnly(cells[1]))"
                if ALL_QUEUES.contains(candidateQueue01) {
                    for h in splitHouses(cells[cells.count - 1]) {
                        results.append(ZtoeHouseLookupResult(house: h, queue: candidateQueue01))
                    }
                    continue
                }

                // Format B2: 3-column table [Houses, Queue, Subqueue]
                let candidateQueue12 = "\(digitsOnly(cells[1])).\(digitsOnly(cells[2]))"
                if ALL_QUEUES.contains(candidateQueue12) {
                    for h in splitHouses(cells[0]) {
                        results.append(ZtoeHouseLookupResult(house: h, queue: candidateQueue12))
                    }
                    continue
                }
            }

            // Format C: 2-column or colspan status message row ([Houses, StatusMessage] or [StatusMessage, Houses])
            let firstCell = cells[0]
            let lastCell = cells[cells.count - 1]
            if lastCell.ktLength > 12 && firstCell.ktLength <= 12 {
                for h in splitHouses(firstCell) {
                    results.append(ZtoeHouseLookupResult(house: h, queue: "", statusText: lastCell))
                }
            } else {
                let statusMessage = cells.dropLast().joined(separator: " ").ktTrim()
                if !statusMessage.isEmpty {
                    for h in splitHouses(lastCell) {
                        results.append(ZtoeHouseLookupResult(house: h, queue: "", statusText: statusMessage))
                    }
                }
            }
        }
        return results
    }

    /// (queueOrNil, statusTextOrNil) for a specific house number (compared by `HouseKey`).
    public static func parseZtoeAddressLookupTableHtml(_ html: String, targetHouse: String) -> (queue: String?, statusText: String?)? {
        let target = HouseKey.of(targetHouse)
        if target.isEmpty { return nil }
        let matching = parseZtoeAddressLookupTableHtml(html).filter { HouseKey.of($0.house) == target }
        if matching.isEmpty { return nil }
        if let withQueue = matching.first(where: { !$0.queue.isEmpty }) {
            return (queue: withQueue.queue, statusText: nil)
        }
        if let withStatus = matching.first(where: { !isBlank($0.statusText) }) {
            return (queue: nil, statusText: withStatus.statusText)
        }
        return nil
    }

    // ---------------------------------------------------------------------------------------------
    // Fetching (async; the parsing runs inside these calls, never on the caller's actor)
    // ---------------------------------------------------------------------------------------------

    private static func findRem(_ remId: String) -> ZtoeRemOption? {
        getRems().first(where: { $0.id == remId }) ?? ZTOE_REM_OPTIONS.first(where: { $0.id == remId })
    }

    @discardableResult
    public static func fetchRemsFromZtoe(
        siteUrl: String = DEFAULT_SITE_URL,
        forceRefresh: Bool = false
    ) async -> [ZtoeRemOption] {
        let currentCached = sync { cachedRems }
        if !forceRefresh, let currentCached, !currentCached.isEmpty {
            return currentCached
        }
        let html = await postZtoeForm("", siteUrl)
        if let html, !isBlank(html) {
            let liveRems = parseZtoeRemOptionsHtml(html)
            if !liveRems.isEmpty {
                sync { cachedRems = liveRems }
                persistToDiskCache()
                return liveRems
            }
        }
        return getRems()
    }

    @discardableResult
    public static func fetchSettlementsForRem(
        _ remId: String,
        siteUrl: String = DEFAULT_SITE_URL,
        forceRefresh: Bool = false
    ) async -> [ZtoeSettlementOption] {
        let cached = sync { cachedSettlementsByRem[remId] }
        if !forceRefresh, let cached, cached.count > 5 { return cached }

        guard let rem = findRem(remId) else { return getSettlementsForRem(remId) }
        let html = await postZtoeForm("rem_id=\(rem.ztoeRemId)", siteUrl)
        if let html, !isBlank(html) {
            let liveRems = parseZtoeRemOptionsHtml(html)
            if !liveRems.isEmpty {
                sync { cachedRems = liveRems }
            }
            let liveList = parseZtoeSettlementOptionsHtml(remId, html)
            if !liveList.isEmpty {
                sync { cachedSettlementsByRem[remId] = liveList }
                persistToDiskCache()
                return liveList
            }
        }
        return getSettlementsForRem(remId)
    }

    private static func bulkRefreshDue(_ settlementId: String, _ forceRefresh: Bool) -> Bool {
        guard let at = sync({ bulkFetchedAtBySettlement[settlementId] }) else { return true }
        let age = nowMs() - at
        if age < 0 || age >= BULK_TTL_MS { return true }
        return forceRefresh && age >= FORCE_REFRESH_MIN_INTERVAL_MS
    }

    /// Streets (merged) and, from the same single response, all houses of the settlement. The bulk
    /// page is requested at most once per `BULK_TTL_MS` per settlement; a force refresh is honoured only
    /// after `FORCE_REFRESH_MIN_INTERVAL_MS`. Concurrent callers share one request.
    @discardableResult
    public static func fetchStreetsForSettlement(
        _ remId: String,
        _ settlementId: String,
        siteUrl: String = DEFAULT_SITE_URL,
        forceRefresh: Bool = false
    ) async -> [ZtoeStreetOption] {
        let sid = canonicalSettlementId(settlementId)
        let cached = sync { cachedStreetsBySettlement[sid] }
        if let cached, !bulkRefreshDue(sid, forceRefresh) { return cached }
        return await singleFlightStreets(
            key: "bulk::\(sid)",
            fallback: { getStreetsForSettlement(sid) },
            block: { await ZtoeAddressLookup.loadSettlementBulk(remId, sid, siteUrl) }
        )
    }

    private static func loadSettlementBulk(_ remId: String, _ settlementId: String, _ siteUrl: String) async -> [ZtoeStreetOption] {
        guard let rem = findRem(remId) else { return getStreetsForSettlement(settlementId) }
        guard let settlement = findSettlementById(settlementId) else { return getStreetsForSettlement(settlementId) }

        let html = await postZtoeForm("rem_id=\(rem.ztoeRemId)&naspunkt_id=\(settlement.ztoeNaspunktId)&all=1", siteUrl)
        if let html, !isBlank(html) {
            let liveRems = parseZtoeRemOptionsHtml(html)
            if !liveRems.isEmpty {
                sync { cachedRems = liveRems }
            }
            let liveSettlements = parseZtoeSettlementOptionsHtml(remId, html)
            if !liveSettlements.isEmpty {
                sync { cachedSettlementsByRem[remId] = liveSettlements }
            }
            let liveStreets = parseZtoeStreetOptionsHtml(settlementId, html)
            if !liveStreets.isEmpty {
                registerStreets(settlementId, liveStreets)
                parseZtoeSettlementHousesTableHtml(settlementId, liveStreets, html)
                sync { bulkFetchedAtBySettlement[settlementId] = nowMs() }
                persistToDiskCache()
                return liveStreets
            }
        }
        return getStreetsForSettlement(settlementId)
    }

    /// Houses of one (merged) street straight from the site: one request per ztoe id of the street,
    /// results united and de-duplicated by `HouseKey`. Nil when no request succeeded.
    ///
    /// The request carries `all=1`: without it ztoe lists only the first 10 records of the street and a
    /// "показати ще N записів" button (vul. Київська in Zhytomyr: 21 of 127 houses). Rows are kept only
    /// when their street name has the street's `StreetKey`, so a page that ignored `vulica_id` cannot
    /// add other streets. Only when no row carries the name (an unusual spelling) the first page is
    /// used unfiltered, as before.
    private static func fetchStreetHouseRows(
        _ rem: ZtoeRemOption,
        _ settlement: ZtoeSettlementOption,
        _ street: ZtoeStreetOption,
        _ siteUrl: String
    ) async -> [ZtoeHouseLookupResult]? {
        var anyResponse = false
        var map = HouseMap()
        for vulicaId in street.ztoeVulicaIds {
            let form = "rem_id=\(rem.ztoeRemId)&naspunkt_id=\(settlement.ztoeNaspunktId)&vulica_id=\(vulicaId)"
            guard let html = await postZtoeForm("\(form)&all=1", siteUrl), !isBlank(html) else { continue }
            anyResponse = true
            let rows = parseZtoeSettlementHousesTableHtml(settlement.id, [street], html, cache: false).values.flatMap { $0 }
            if !rows.isEmpty {
                for row in rows { map.put(row) }
                continue
            }
            guard let firstPage = await postZtoeForm(form, siteUrl) else { continue }
            for row in parseZtoeAddressLookupTableHtml(firstPage) { map.put(row) }
        }
        return anyResponse ? sortHouses(map.values) : nil
    }

    @discardableResult
    public static func fetchHousesForStreet(
        _ remId: String,
        _ settlementId: String,
        _ streetId: String,
        siteUrl: String = DEFAULT_SITE_URL,
        forceRefresh: Bool = false
    ) async -> [ZtoeHouseLookupResult] {
        if streetId.ktIsBlank { return [] }

        let street = findStreetById(streetId)
        let canonical = street?.id ?? streetId
        let sid = canonicalSettlementId(settlementId)

        func fresh() -> [ZtoeHouseLookupResult]? {
            let (cached, updatedAt): ([ZtoeHouseLookupResult]?, Int64) = sync {
                (cachedHousesByStreet[canonical], houseCacheUpdatedAtByStreet[canonical] ?? 0)
            }
            guard let cached, !cached.isEmpty else { return nil }
            let age = nowMs() - updatedAt
            return (!forceRefresh || (age >= 0 && age < FRESH_HOUSE_CACHE_TTL_MS)) ? cached : nil
        }

        if let hit = fresh() {
            recordRecentHouseStreet(canonical)
            return hit
        }
        // A bulk fetch of the settlement may be filling this street right now.
        await awaitInFlight("bulk::\(sid)")
        if let hit = fresh() {
            recordRecentHouseStreet(canonical)
            return hit
        }

        let rem = findRem(remId)
        let settlement = findSettlementById(sid)
        if let rem, let settlement, let street {
            if let rows = await fetchStreetHouseRows(rem, settlement, street, siteUrl), !rows.isEmpty {
                storeStreetHouses(canonical, rows)
                persistToDiskCache()
                return rows
            }
        }
        return sync { cachedHousesByStreet[canonical] } ?? []
    }

    /// Loads the REM list, the settlements of all REMs, the streets of the active and default city
    /// and the houses of the saved street, so the "?" lookup opens without delay. Hydrates the disk
    /// cache first (Android passes a Context for that). The saved address is given field by field
    /// (Android: `SelectedAddressQuery`).
    public static func prefetchAddressIndexInBackground(
        siteUrl: String = DEFAULT_SITE_URL,
        savedRemId: String? = nil,
        savedSettlementId: String? = nil,
        savedStreetId: String? = nil,
        forceRefresh: Bool = false
    ) async {
        initDiskCache()

        let activeRemId = isBlank(savedRemId) ? "zhytomyr" : savedRemId!
        let activeSettlementId = isBlank(savedSettlementId) ? "zt_city" : savedSettlementId!

        // One bulk request indexes the REM list, the settlements of the REM, all streets and all houses of the city.
        await fetchStreetsForSettlement("zhytomyr", "zt_city", siteUrl: siteUrl, forceRefresh: forceRefresh)

        if activeRemId != "zhytomyr" {
            await fetchSettlementsForRem(activeRemId, siteUrl: siteUrl, forceRefresh: forceRefresh)
        }
        if !activeSettlementId.ktIsBlank && (activeRemId != "zhytomyr" || activeSettlementId != "zt_city") {
            await fetchStreetsForSettlement(activeRemId, activeSettlementId, siteUrl: siteUrl, forceRefresh: forceRefresh)
        }
        if let savedStreetId, !savedStreetId.ktIsBlank {
            await fetchHousesForStreet(activeRemId, activeSettlementId, savedStreetId, siteUrl: siteUrl, forceRefresh: false)
        }

        let allRems = await fetchRemsFromZtoe(siteUrl: siteUrl, forceRefresh: false)
        let priorityRems = distinct(["zhytomyr", activeRemId])

        // Bounded low-priority prefetch (2 workers) of the remaining REMs' settlements and primary city streets.
        let remaining = allRems.filter { !priorityRems.contains($0.id) }
        if !remaining.isEmpty {
            let queue = RemQueue(remaining)
            let workerCount = min(2, remaining.count)
            await withTaskGroup(of: Void.self) { group in
                for _ in 0..<workerCount {
                    group.addTask(priority: .background) {
                        while let rem = queue.poll() {
                            let settlements = await ZtoeAddressLookup.fetchSettlementsForRem(
                                rem.id, siteUrl: siteUrl, forceRefresh: forceRefresh
                            )
                            if let primary = settlements.first, !primary.id.ktIsBlank {
                                await ZtoeAddressLookup.fetchStreetsForSettlement(
                                    rem.id, primary.id, siteUrl: siteUrl, forceRefresh: false
                                )
                            }
                        }
                    }
                }
            }
        }

        persistToDiskCache()
    }

    // ---------------------------------------------------------------------------------------------
    // Queue lookup for the selected address
    // ---------------------------------------------------------------------------------------------

    /// Resolves the queue (or the "does not switch off" status) of the selected house from the ztoe
    /// site. The live row is authoritative (A-H1: upstream queue changes propagate); the cached row is
    /// used only when the site is unreachable or does not list the house. Emergencies are not looked up
    /// here: OutageRepository asks PowerOnClient.
    public static func checkAddressOnZtoeWebsite(
        remId: String,
        settlementId: String,
        streetId: String,
        house: String,
        siteUrl: String = DEFAULT_SITE_URL
    ) async -> ZtoeHouseLookupResult? {
        let targetKey = HouseKey.of(house)
        if targetKey.isEmpty { return nil }

        let rem = findRem(remId)
        var settlement = findSettlementById(settlementId)
        var street = findStreetById(streetId)

        // After a restore without the index the names are unknown: reload the index once (one bulk request, shared and cached).
        if rem != nil, let knownSettlement = settlement,
           street == nil || street!.nameUk.ktIsBlank || knownSettlement.nameUk.ktIsBlank {
            await fetchStreetsForSettlement(remId, knownSettlement.id, siteUrl: siteUrl, forceRefresh: false)
            settlement = findSettlementById(settlementId) ?? settlement
            street = findStreetById(streetId) ?? street
        }

        let canonical = street?.id ?? streetId
        let cachedRows = sync { cachedHousesByStreet[canonical] }
        var resolved = cachedRows?.first(where: { HouseKey.of($0.house) == targetKey })

        if let rem, let settlement, let street {
            if let rows = await fetchStreetHouseRows(rem, settlement, street, siteUrl), !rows.isEmpty {
                storeStreetHouses(canonical, rows)
                if let live = rows.first(where: { HouseKey.of($0.house) == targetKey }) { resolved = live }
            }
        }

        guard var base = resolved else { return nil }
        let head = [rem?.nameUk, settlement?.nameUk].compactMap { $0 }.filter { !$0.ktIsBlank }.joined(separator: ", ")
        var streetPart = ""
        if let name = street?.nameUk, !name.ktIsBlank { streetPart = "\(name), " }
        base.addressLabel = (head.isEmpty ? "" : "\(head),\n") + streetPart + "буд. " + house.ktTrim()
        return base
    }
}

/// Work list shared by the prefetch workers (Kotlin ConcurrentLinkedQueue).
private final class RemQueue: @unchecked Sendable {
    private let queueLock = NSLock()
    private let items: [ZtoeRemOption]
    private var next = 0

    init(_ items: [ZtoeRemOption]) { self.items = items }

    func poll() -> ZtoeRemOption? {
        queueLock.lock()
        defer { queueLock.unlock() }
        guard next < items.count else { return nil }
        let item = items[next]
        next += 1
        return item
    }
}
