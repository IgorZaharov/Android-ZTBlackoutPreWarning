import Foundation

/// What identifies the address on PowerOn. Names come from ztoe; ids are cached after the first resolution.
public struct PowerOnTarget: Hashable, Sendable {
    public var remOtgId: Int?
    public var settlementName: String
    /// Names of every ztoe street option merged into the selected street (duplicates keep all names).
    public var streetNames: [String]
    public var house: String
    public var cachedCityIds: [Int] = []
    public var cachedStreetIds: [Int] = []

    public init(remOtgId: Int?, settlementName: String, streetNames: [String], house: String,
                cachedCityIds: [Int] = [], cachedStreetIds: [Int] = []) {
        self.remOtgId = remOtgId
        self.settlementName = settlementName
        self.streetNames = streetNames
        self.house = house
        self.cachedCityIds = cachedCityIds
        self.cachedStreetIds = cachedStreetIds
    }
}

public struct PowerOnIds: Hashable, Sendable {
    public var cityIds: [Int]
    public var streetIds: [Int]

    public init(cityIds: [Int], streetIds: [Int]) {
        self.cityIds = cityIds
        self.streetIds = streetIds
    }
}

/// Outcome of one PowerOn refresh for an address. `repairs` is nil when the planned-works request
/// failed (keep what was known); `emergency` is unavailable when the accidents request failed.
public struct PowerOnResult: Sendable {
    public var emergency: EmergencyFetch
    public var repairs: [Outage]?
    public var ids: PowerOnIds?
}

/// Per-address PowerOn queries (mirror of android data/poweron/PowerOnClient.kt). Follows
/// spec/POWERON_API.md:
///  - only the dotted filters work (`street.id[]`, `city.id`, `otg.id`),
///  - `pagination=false` is required (default page size is 30 of thousands of rows),
///  - timestamps are Kyiv wall-clock despite the `+00:00` label (handled in PowerOnMapper.parseTime),
///  - a failed request is unavailable, never "no outage".
public struct PowerOnClient: Sendable {
    public static let BASE_URL = "https://api-ztoe-poweron.inneti.net/api"
    public static let IDS_TTL_MS: Int64 = 7 * 24 * 60 * 60 * 1000
    private static let cityPrefix = Rx("^(?:м\\.|місто|с\\.|село|смт\\.?|селище)\(Rx.ws)*", ignoreCase: true)
    private static let parens = Rx("\\([^)]*\\)")
    private static let spaces = Rx("\(Rx.ws)+")
    /// `[]` written percent-encoded so URL parsing never rejects the query.
    private static let EMERGENCY_REASONS = "switchSubReason%5B%5D=0&switchSubReason%5B%5D=1&switchSubReason%5B%5D=3"

    private let http: HttpClient

    public init(http: HttpClient = URLSessionHttp.shared) {
        self.http = http
    }

    public static func cityKey(_ raw: String) -> String {
        var s = TextNorm.decodeEntities(raw).lowercased()
        s = parens.replace(s, template: " ")
        s = cityPrefix.replace(s.ktTrim(), template: "")
        s = String(String.UnicodeScalarView(s.unicodeScalars.filter { !TextNorm.apostropheScalars.contains($0) }))
        return spaces.replace(s, template: " ").ktTrim()
    }

    /// Plain array (Accept: application/json) or a hydra collection, both accepted.
    public static func toArray(_ body: Data) -> [[String: Any]] {
        guard let json = try? JSONSerialization.jsonObject(with: body) else { return [] }
        if let arr = json as? [Any] { return arr.compactMap { $0 as? [String: Any] } }
        if let obj = json as? [String: Any], let members = (obj["hydra:member"] ?? obj["member"]) as? [Any] {
            return members.compactMap { $0 as? [String: Any] }
        }
        return []
    }

    private static func int(_ v: Any?) -> Int? {
        if let n = v as? NSNumber, CFGetTypeID(n) != CFBooleanGetTypeID() { return n.intValue }
        if let s = v as? String { return Int(s) }
        return nil
    }

    private static func str(_ v: Any?) -> String? { v as? String }

    public static func parseRows(_ body: Data) -> [PowerOnRow] {
        toArray(body).map { o in
            let city = o["city"] as? [String: Any]
            let street = o["street"] as? [String: Any]
            return PowerOnRow(
                id: (o["id"] as? NSNumber)?.int64Value ?? 0,
                cityId: int(city?["id"]),
                cityName: str(city?["name"]) ?? "",
                streetId: int(street?["id"]),
                streetName: str(street?["name"]) ?? "",
                dateEvent: str(o["dateEvent"]) ?? "",
                datePlanIn: str(o["datePlanIn"]) ?? "",
                koment: str(o["koment"]),
                switchSubReason: int(o["switchSubReason"]),
                typeOff: int(o["typeOff"]),
                buildingNames: str(o["buildingNames"]) ?? ""
            )
        }
    }

    private static func enc(_ s: String) -> String {
        var allowed = CharacterSet.alphanumerics
        allowed.insert(charactersIn: "-._~")
        return s.addingPercentEncoding(withAllowedCharacters: allowed) ?? s
    }

    private func get(_ url: String) async throws -> Data {
        guard let u = URL(string: url) else { throw URLError(.badURL) }
        var request = URLRequest(url: u)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Mozilla/5.0 (iPhone; ZTBlackoutPreWarning)", forHTTPHeaderField: "User-Agent")
        let response = try await http.send(request)
        guard (200...299).contains(response.status) else { throw HttpError.status(response.status) }
        return response.body
    }

    /// City ids by exact name (inside the REM when known), then street ids by canonical street key.
    public func resolveIds(_ target: PowerOnTarget) async throws -> PowerOnIds {
        let wanted = Self.cityKey(target.settlementName)
        let byRem = target.remOtgId.map { "&otg.id=\($0)" } ?? ""
        let cityRows = try await fetchCities(wanted, rawName: target.settlementName, byRem: byRem)
        var cityIds: [Int] = []
        for (id, _) in cityRows where !cityIds.contains(id) { cityIds.append(id) }
        if cityIds.isEmpty { return PowerOnIds(cityIds: [], streetIds: []) }

        let streetKeys = Set(target.streetNames.map { StreetKey.of($0) })
        var streetIds: [Int] = []
        for cityId in cityIds {
            let body = try await get("\(Self.BASE_URL)/pw_streets?city.id=\(cityId)&pagination=false")
            for o in Self.toArray(body) where streetKeys.contains(StreetKey.of(Self.str(o["name"]) ?? "")) {
                if let id = Self.int(o["id"]), !streetIds.contains(id) { streetIds.append(id) }
            }
        }
        return PowerOnIds(cityIds: cityIds, streetIds: streetIds)
    }

    private func fetchCities(_ wantedKey: String, rawName: String, byRem: String) async throws -> [(Int, String)] {
        func query(_ extra: String) async throws -> [(Int, String)] {
            let bare = Self.cityPrefix.replace(TextNorm.decodeEntities(rawName).ktTrim(), template: "").ktTrim()
            let body = try await get("\(Self.BASE_URL)/pw_cities?name=\(Self.enc(bare))\(extra)&pagination=false")
            return Self.toArray(body).compactMap { o in
                let name = Self.str(o["name"]) ?? ""
                guard Self.cityKey(name) == wantedKey, let id = Self.int(o["id"]) else { return nil }
                return (id, name)
            }
        }
        if !byRem.isEmpty {
            let inRem = try await query(byRem)
            if !inRem.isEmpty { return inRem }
        }
        return try await query("")
    }

    /// Fetches emergencies and planned works for the address. Query scope: street ids, then city ids
    /// (rows filtered by street key), then the REM (filtered by city and street).
    public func fetch(_ target: PowerOnTarget, today: LocalDate, now: LocalDateTime) async -> PowerOnResult {
        var ids: PowerOnIds? = target.cachedStreetIds.isEmpty && target.cachedCityIds.isEmpty
            ? nil
            : PowerOnIds(cityIds: target.cachedCityIds, streetIds: target.cachedStreetIds)
        if ids == nil {
            do {
                ids = try await resolveIds(target)
            } catch {
                return PowerOnResult(emergency: .unavailable("resolve: \(error)"), repairs: nil, ids: nil)
            }
        }
        guard let resolved = ids else { return PowerOnResult(emergency: .unavailable("resolve"), repairs: nil, ids: nil) }

        let scope: String
        var streetFilter: Set<String>?
        var cityFilter: String?
        if !resolved.streetIds.isEmpty {
            scope = resolved.streetIds.map { "street.id%5B%5D=\($0)" }.joined(separator: "&")
        } else if !resolved.cityIds.isEmpty {
            scope = resolved.cityIds.map { "city.id%5B%5D=\($0)" }.joined(separator: "&")
            streetFilter = Set(target.streetNames.map { StreetKey.of($0) })
        } else if let otg = target.remOtgId {
            scope = "otg.id=\(otg)"
            streetFilter = Set(target.streetNames.map { StreetKey.of($0) })
            cityFilter = Self.cityKey(target.settlementName)
        } else {
            return PowerOnResult(emergency: .unavailable("no scope"), repairs: nil, ids: resolved)
        }

        func filtered(_ rows: [PowerOnRow]) -> [PowerOnRow] {
            rows.filter { r in
                (streetFilter.map { $0.contains(StreetKey.of(r.streetName)) } ?? true) &&
                    (cityFilter.map { Self.cityKey(r.cityName) == $0 } ?? true)
            }
        }

        let emergency: EmergencyFetch
        do {
            let rows = filtered(Self.parseRows(try await get("\(Self.BASE_URL)/pw_accidents?\(scope)&\(Self.EMERGENCY_REASONS)&pagination=false")))
            let limit = today.plusDays(2).atStartOfDay()
            emergency = .confirmed(PowerOnMapper.emergencyRecordsFor(rows, house: target.house).filter { $0.start.isBefore(limit) })
        } catch {
            emergency = .unavailable("accidents: \(error)")
        }

        var repairs: [Outage]?
        do {
            let rows = filtered(Self.parseRows(try await get(
                "\(Self.BASE_URL)/pw_accident_planeds?\(scope)&datePlanIn%5Bafter%5D=\(today)&pagination=false")))
            repairs = PowerOnMapper.repairOutagesFor(rows, house: target.house, today: today)
        } catch {
            repairs = nil
        }
        return PowerOnResult(emergency: emergency, repairs: repairs, ids: resolved)
    }
}
