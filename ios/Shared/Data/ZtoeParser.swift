import Foundation

public enum FetchStatus: String, Sendable {
    case SUCCESS
    case NO_INTERNET
    case NO_QUEUES_FOUND
}

/// Result of one schedule refresh (mirror of android `ScheduleFetchResult`). Cells are `true` where
/// power is off: 48 half-hours (or 24 hours on an hourly table; OutageEngine.normalizeSlots handles both).
public struct ScheduleFetchResult: Sendable {
    public var todayOff: [Bool]?
    public var tomorrowOff: [Bool]?
    public var hasTomorrowSchedule: Bool
    public var status: FetchStatus
    /// What the user is told about the site.
    public var siteState: SiteState
    public var failure: FetchFailure
    /// Text of the "УВАГА! ВАЖЛИВА ІНФОРМАЦІЯ!" notice when the page has no schedule table (core/SiteNotice).
    public var notice: String?

    public init(
        todayOff: [Bool]?, tomorrowOff: [Bool]?, hasTomorrowSchedule: Bool, status: FetchStatus = .SUCCESS,
        siteState: SiteState? = nil, failure: FetchFailure = .NONE, notice: String? = nil
    ) {
        self.todayOff = todayOff
        self.tomorrowOff = tomorrowOff
        self.hasTomorrowSchedule = hasTomorrowSchedule
        self.status = status
        self.siteState = siteState ?? {
            switch status {
            case .SUCCESS: return .AVAILABLE_WITH_TABLE
            case .NO_QUEUES_FOUND: return .AVAILABLE_NO_TABLE
            case .NO_INTERNET: return .SITE_UNREACHABLE
            }
        }()
        self.failure = failure
        self.notice = notice
    }
}

// =========================================================================================
// CRITICAL SECTION — DO NOT MODIFY UNLESS EXPLICITLY REQUESTED
// ztoe HTML table parser and URL validator for https://www.ztoe.com.ua/unhooking-search.php
// (mirror of android data/parser/ZtoeParser.kt; regex scanner instead of Jsoup, same rules)
// =========================================================================================
public enum ZtoeParser {
    private static let leafTableRegex = Rx("(?is)<table\\b[^>]*>(?:(?!</?table\\b).)*</table>")
    private static let trRegex = Rx("(?is)<tr\\b[^>]*>(.*?)</tr>")
    private static let cellRegex = Rx("(?is)<(t[dh])\\b([^>]*)>(.*?)</t[dh]>")
    private static let fullDateRegex = Rx("(?<!\\d)(\\d{1,2})\\.(\\d{1,2})\\.(\\d{4})(?!\\d)")
    private static let shortDateRegex = Rx("(?<!\\d)(\\d{1,2})\\.(\\d{1,2})(?!\\.\\d|\\d)")

    public static let DEFAULT_VALID_URLS = [
        "https://www.ztoe.com.ua/unhooking-search.php",
        "https://example.com"
    ]

    public static let ALL_QUEUES = UserSettings.ALL_QUEUES

    /// URLs from the bundled valid-urls.json (app and widget both bundle it), else the defaults.
    public static let validUrls: [String] = {
        guard let url = Bundle.main.url(forResource: "valid-urls", withExtension: "json"),
              let text = try? String(contentsOf: url, encoding: .utf8) else { return DEFAULT_VALID_URLS }
        let quoted = Rx("\"([^\"]+)\"")
        let ns = text as NSString
        let found = quoted.re.matches(in: text, range: NSRange(location: 0, length: ns.length))
            .compactMap { Rx.group($0, 1, in: ns)?.ktTrim() }
            .filter { !$0.isEmpty }
        return found.isEmpty ? DEFAULT_VALID_URLS : found
    }()

    private static func strip(_ url: String) -> String {
        var t = url.ktTrim()
        if t.hasSuffix("/") { t.removeLast() }
        return t
    }

    public static func isValidUrl(_ url: String) -> Bool {
        let trimmed = strip(url)
        if trimmed.isEmpty { return false }
        return validUrls.contains { strip($0).caseInsensitiveCompare(trimmed) == .orderedSame }
    }

    // MARK: - In-memory page cache (20 s), like the Android parser

    private static let memoryLock = NSLock()
    private static var cachedHtml: (url: String, date: LocalDate, atMs: Int64, html: String)?
    private static let DOC_MEMORY_CACHE_MS: Int64 = 20_000

    static func clearMemoryCacheForTesting() {
        memoryLock.lock(); cachedHtml = nil; memoryLock.unlock()
    }

    // MARK: - Fetch

    /// Fetches the page, caches all 12 queues and returns `queue`'s cells. A failed refresh never erases
    /// a schedule that is still valid for today (spec/SITE_STATE.md).
    public static func fetchFullSchedule(
        url: String,
        queue: String,
        forceNetwork: Bool = false,
        repo: ScheduleRepository = .shared,
        http: HttpClient = URLSessionHttp.shared,
        now: Date = Date()
    ) async -> ScheduleFetchResult {
        let today = KyivTime.localDateTime(of: now).date
        let cleanUrl = url.ktTrim()

        func failed(_ failure: FetchFailure) -> ScheduleFetchResult {
            ScheduleFetchResult(
                todayOff: nil, tomorrowOff: nil, hasTomorrowSchedule: false, status: .NO_INTERNET,
                siteState: SiteStateResolver.resolve(failure: failure, hasTodayTable: false, networkValidated: NetworkProbe.isValidated()),
                failure: failure
            )
        }
        func noTable(_ html: String? = nil) -> ScheduleFetchResult {
            ScheduleFetchResult(
                todayOff: nil, tomorrowOff: nil, hasTomorrowSchedule: false, status: .NO_QUEUES_FOUND,
                siteState: .AVAILABLE_NO_TABLE, notice: html.flatMap { SiteNotice.extract($0) }
            )
        }

        if !isValidUrl(url) {
            repo.clearScheduleCache() // a schedule from a non-whitelisted source is meaningless
            return noTable()
        }
        let q = queue.ktTrim()
        let nowMs = Int64(now.timeIntervalSince1970 * 1000)
        let canUseConditional = !forceNetwork && !q.isEmpty && repo.hasValidTodayCache(q) && repo.hasTomorrowSchedule(q)

        var html: String?
        memoryLock.lock()
        if !forceNetwork, let c = cachedHtml, c.url == cleanUrl, c.date == today, (0..<DOC_MEMORY_CACHE_MS).contains(nowMs - c.atMs) {
            html = c.html
        }
        memoryLock.unlock()

        if html == nil {
            guard let requestUrl = URL(string: cleanUrl) else { return noTable() }
            var request = URLRequest(url: requestUrl)
            request.setValue(Http.userAgent, forHTTPHeaderField: "User-Agent")
            if canUseConditional, let etag = repo.etag { request.setValue(etag, forHTTPHeaderField: "If-None-Match") }
            do {
                let response = try await http.send(request)
                if response.status == 304 {
                    // Not modified: reuse the cached schedule with zero transfer or parsing
                    if canUseConditional, let cached = repo.todayOffCells(q) {
                        let tomorrow = repo.tomorrowOffCells(q)
                        return ScheduleFetchResult(todayOff: cached, tomorrowOff: tomorrow, hasTomorrowSchedule: tomorrow != nil)
                    }
                    return noTable()
                }
                guard (200...299).contains(response.status) else { throw HttpError.status(response.status) }
                if let etag = response.header("ETag"), !etag.ktIsBlank { repo.etag = etag }
                let page = Cp1251.decode(response.body, contentType: response.header("Content-Type"))
                html = page
                memoryLock.lock()
                cachedHtml = (cleanUrl, today, nowMs, page)
                memoryLock.unlock()
            } catch {
                return failed(Http.failure(of: error))
            }
        }
        guard let page = html else { return noTable() }

        let all = parseAllQueuesSinglePass(page, today: today)
        if !all.isEmpty {
            repo.saveAllSchedulesBatch(all.mapValues { (today: $0.todayOff ?? [], tomorrow: $0.tomorrowOff) }, activeQueue: q)
        } else {
            return noTable(page)
        }
        if q.isEmpty {
            return ScheduleFetchResult(todayOff: nil, tomorrowOff: nil, hasTomorrowSchedule: false, status: .SUCCESS)
        }
        var result = all[q] ?? parseDocumentFull(page, queue: q, today: today)
        // The page and its table are there even when this queue's row is missing
        result.siteState = .AVAILABLE_WITH_TABLE
        return result
    }

    // MARK: - Parsing (pure, tested with saved pages)

    struct Cell {
        let isHeader: Bool
        let attrs: String
        let html: String
        var text: String { Html.text(html) }
    }

    static func rows(_ tableHtml: String) -> [[Cell]] {
        let ns = tableHtml as NSString
        return trRegex.re.matches(in: tableHtml, range: NSRange(location: 0, length: ns.length)).map { tr in
            let rowHtml = Rx.group(tr, 1, in: ns) ?? ""
            let rns = rowHtml as NSString
            return cellRegex.re.matches(in: rowHtml, range: NSRange(location: 0, length: rns.length)).map { m in
                Cell(
                    isHeader: (Rx.group(m, 1, in: rns) ?? "").lowercased() == "th",
                    attrs: Rx.group(m, 2, in: rns) ?? "",
                    html: Rx.group(m, 3, in: rns) ?? ""
                )
            }
        }
    }

    /// Value of one HTML attribute inside a tag's attribute text (`style="..."`, `bgcolor=red`).
    private static let attributeRegexes: [String: Rx] = Dictionary(uniqueKeysWithValues: ["style", "bgcolor", "class"].map { name in
        (name, Rx("(?i)(?<![\\w-])\(name)\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))"))
    })

    static func attribute(_ name: String, in attrs: String) -> String {
        guard let rx = attributeRegexes[name], let m = rx.firstMatch(in: attrs) else { return "" }
        let ns = attrs as NSString
        return Rx.group(m, 1, in: ns) ?? Rx.group(m, 2, in: ns) ?? Rx.group(m, 3, in: ns) ?? ""
    }

    private static func matchesTableDate(_ headerText: String, _ date: LocalDate) -> Bool {
        let ns = headerText as NSString
        let range = NSRange(location: 0, length: ns.length)
        let full = fullDateRegex.re.matches(in: headerText, range: range)
        func n(_ m: NSTextCheckingResult, _ i: Int) -> Int? { Rx.group(m, i, in: ns).flatMap { Int($0) } }
        if !full.isEmpty {
            return full.contains { n($0, 1) == date.day && n($0, 2) == date.month && n($0, 3) == date.year }
        }
        return shortDateRegex.re.matches(in: headerText, range: range).contains { n($0, 1) == date.day && n($0, 2) == date.month }
    }

    /// Leaf tables (no nested table) with at least 12 rows that list queues 1.1 and 6.2.
    private static func scheduleTables(_ html: String) -> [(html: String, header: String)] {
        let ns = html as NSString
        return leafTableRegex.re.matches(in: html, range: NSRange(location: 0, length: ns.length)).compactMap { m in
            let table = ns.substring(with: m.range)
            let r = rows(table)
            guard r.count >= 12 else { return nil }
            let text = Html.text(table)
            guard text.ktContains("1.1") && text.ktContains("6.2") else { return nil }
            let header = r.prefix(2).map { row in row.map(\.text).joined(separator: " ") }.joined(separator: " ")
            return (table, header)
        }
    }

    static func findTodayAndTomorrowTables(_ html: String, today: LocalDate) -> (today: String?, tomorrow: String?) {
        let tomorrow = today.plusDays(1)
        var todayTable: String?
        var tomorrowTable: String?
        for t in scheduleTables(html) {
            let matchesToday = matchesTableDate(t.header, today)
            let matchesTomorrow = matchesTableDate(t.header, tomorrow)
            if matchesToday && todayTable == nil {
                todayTable = t.html
            } else if matchesTomorrow && tomorrowTable == nil {
                tomorrowTable = t.html
            }
        }
        return (todayTable, tomorrowTable)
    }

    /// All 12 queues from one table lookup.
    static func parseAllQueuesSinglePass(_ html: String, today: LocalDate) -> [String: ScheduleFetchResult] {
        let tables = findTodayAndTomorrowTables(html, today: today)
        guard let todayTable = tables.today else { return [:] }
        let todayRows = rows(todayTable)
        let tomorrowRows = tables.tomorrow.map(rows)
        var results: [String: ScheduleFetchResult] = [:]
        for q in ALL_QUEUES {
            guard let todayCells = parseRowsForQueue(todayRows, queue: q) else { continue }
            let tomorrowCells = tomorrowRows.flatMap { parseRowsForQueue($0, queue: q) }
            results[q] = ScheduleFetchResult(
                todayOff: todayCells, tomorrowOff: tomorrowCells,
                hasTomorrowSchedule: tomorrowCells != nil && tables.tomorrow != nil
            )
        }
        return results
    }

    static func parseDocumentFull(_ html: String, queue: String, today: LocalDate) -> ScheduleFetchResult {
        let tables = findTodayAndTomorrowTables(html, today: today)
        guard let todayTable = tables.today else {
            return ScheduleFetchResult(todayOff: nil, tomorrowOff: nil, hasTomorrowSchedule: false, status: .NO_QUEUES_FOUND)
        }
        if queue.ktIsBlank {
            return ScheduleFetchResult(todayOff: nil, tomorrowOff: nil, hasTomorrowSchedule: false, status: .SUCCESS)
        }
        guard let todayCells = parseTableForQueue(todayTable, queue: queue) else {
            return ScheduleFetchResult(todayOff: nil, tomorrowOff: nil, hasTomorrowSchedule: false, status: .NO_QUEUES_FOUND)
        }
        let tomorrowCells = tables.tomorrow.flatMap { parseTableForQueue($0, queue: queue) }
        return ScheduleFetchResult(todayOff: todayCells, tomorrowOff: tomorrowCells,
                                   hasTomorrowSchedule: tomorrowCells != nil && tables.tomorrow != nil)
    }

    /// The off-cells of `queue` in one table: 48 (or 24) booleans, nil when the queue row is missing.
    static func parseTableForQueue(_ tableHtml: String, queue: String) -> [Bool]? {
        parseRowsForQueue(rows(tableHtml), queue: queue)
    }

    static func parseRowsForQueue(_ tableRows: [[Cell]], queue: String) -> [Bool]? {
        // The row with this queue ("1.1", "Черга 1.1") in its first 3 cells
        guard let row = tableRows.first(where: { cells in
            cells.prefix(3).contains { cell in
                let txt = cell.text.ktTrim()
                return txt == queue || txt == "Черга \(queue)" || txt == "Черга \(queue)." ||
                    txt.lowercased() == "\(queue) черга"
            }
        }) else { return nil }

        let tds = row.filter { !$0.isHeader }
        if tds.count < 24 { return nil }

        // Drop thin 3pt separator cells, then take the last 48 (or 24) schedule cells
        let valid = tds.dropFirst().filter { cell in
            let style = attribute("style", in: cell.attrs).lowercased().replacingOccurrences(of: " ", with: "")
            return !style.contains("width:3pt") && !style.contains("width:1pt")
        }
        let slotCells: [Cell]
        if valid.count >= 48 {
            slotCells = Array(valid.suffix(48))
        } else if tds.count >= 48 {
            slotCells = Array(tds.suffix(48))
        } else if valid.count >= 24 {
            slotCells = Array(valid.suffix(24))
        } else {
            slotCells = Array(tds.suffix(24))
        }
        return slotCells.map { isCellOff($0) }
    }

    static func isCellOff(_ cell: Cell) -> Bool {
        let attr = (attribute("style", in: cell.attrs) + " " + attribute("bgcolor", in: cell.attrs) + " " +
                    attribute("class", in: cell.attrs)).lowercased()
        let text = cell.text.ktTrim().lowercased()
        let redMarkers = [
            "#ff3333", "#ff3b30", "#ff0000", "background:red", "background: red", "background-color:red",
            "background-color: red", "rgb(255, 51, 51)", "rgb(255,51,51)", "rgb(255, 0, 0)", "rgb(255,0,0)", "danger"
        ]
        return redMarkers.contains { attr.ktContains($0) } ||
            text.ktContains("вимк") || text.ktContains("відкл") || text == "в" || text == "-"
    }
}
// =========================================================================================
// END OF CRITICAL SECTION — DO NOT MODIFY UNLESS EXPLICITLY REQUESTED
// =========================================================================================
