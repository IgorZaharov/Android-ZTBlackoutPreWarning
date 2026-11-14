import Foundation
import CoreFoundation

public final class ZtoeParser {
    public static let shared = ZtoeParser()
    private static let cacheLock = NSLock()
    private static var lastEtag: String?
    private static var lastHtmlCache: String?

    // Pre-compiled static regular expressions to eliminate ~72 regex compilations per HTML refresh
    private static let leafTableRegex = try? NSRegularExpression(pattern: "(?is)<table\\b[^>]*>(?:(?!</?table\\b).)*</table>")
    private static let trRegex = try? NSRegularExpression(pattern: "(?is)<tr\\b[^>]*>(.*?)</tr>")
    private static let tdRegex = try? NSRegularExpression(pattern: "(?is)<t[dh]\\b([^>]*)>(.*?)</t[dh]>")
    private static let stripTagsRegex = try? NSRegularExpression(pattern: "<[^>]+>")

    private static var defaults: UserDefaults {
        UserDefaults(suiteName: ScheduleRepository.APP_GROUP_ID) ?? .standard
    }

    public static let DEFAULT_VALID_URLS: [String] = [
        "https://www.ztoe.com.ua/unhooking-search.php",
        "https://example.com"
    ]

    public static func isValidScheduleUrl(_ urlStr: String, validUrls: [String] = DEFAULT_VALID_URLS) -> Bool {
        let trimmed = urlStr.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard trimmed.hasPrefix("https://") || trimmed.hasPrefix("http://") else { return false }
        return validUrls.contains { allowed in
            let normAllowed = allowed.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            return trimmed == normAllowed || trimmed.hasPrefix(normAllowed + "?") || trimmed.hasPrefix(normAllowed + "#")
        }
    }

    public static func decodeWindows1251(_ data: Data) -> String {
        let cfEnc = CFStringEncodings.windowsCyrillic.rawValue
        let nsEnc = CFStringConvertEncodingToNSStringEncoding(CFStringEncoding(cfEnc))
        if let decoded = String(data: data, encoding: String.Encoding(rawValue: nsEnc)),
           (decoded.contains("черга") || decoded.contains("Черга") || decoded.contains("Графік") || decoded.contains("<table")) {
            return decoded
        }
        return String(data: data, encoding: .utf8) ?? String(decoding: data, as: UTF8.self)
    }

    public static func fetchFullSchedule(
        urlStr: String,
        now: Date = Date()
    ) async -> FullScheduleResult {
        guard isValidScheduleUrl(urlStr), let url = URL(string: urlStr) else {
            ScheduleRepository.shared.clearAllSchedulesOnUnclearState()
            return FullScheduleResult(status: .NO_QUEUES_FOUND, todaySchedules: [:], tomorrowSchedules: [:], updatedAt: "")
        }

        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15.0)
        request.setValue("gzip, deflate", forHTTPHeaderField: "Accept-Encoding")
        request.setValue("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15", forHTTPHeaderField: "User-Agent")

        cacheLock.lock()
        let currentEtag = lastEtag ?? defaults.string(forKey: "ztoe_last_etag")
        let currentHtmlCache = lastHtmlCache ?? defaults.string(forKey: "ztoe_last_html_cache")
        cacheLock.unlock()

        if let etag = currentEtag, !etag.isEmpty {
            request.setValue(etag, forHTTPHeaderField: "If-None-Match")
        }

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let httpResp = response as? HTTPURLResponse else {
                ScheduleRepository.shared.clearAllSchedulesOnUnclearState()
                return FullScheduleResult(status: .NO_INTERNET, todaySchedules: [:], tomorrowSchedules: [:], updatedAt: "")
            }

            let html: String
            if httpResp.statusCode == 304, let cached = currentHtmlCache, !cached.isEmpty {
                html = cached
            } else if (200...299).contains(httpResp.statusCode) {
                html = decodeWindows1251(data)
                if let newEtag = httpResp.value(forHTTPHeaderField: "ETag") {
                    cacheLock.lock()
                    lastEtag = newEtag
                    lastHtmlCache = html
                    defaults.set(newEtag, forKey: "ztoe_last_etag")
                    defaults.set(html, forKey: "ztoe_last_html_cache")
                    cacheLock.unlock()
                }
            } else {
                ScheduleRepository.shared.clearAllSchedulesOnUnclearState()
                return FullScheduleResult(status: .NO_INTERNET, todaySchedules: [:], tomorrowSchedules: [:], updatedAt: "")
            }

            return parseHtmlFullSchedules(html: html, now: now)
        } catch {
            ScheduleRepository.shared.clearAllSchedulesOnUnclearState()
            return FullScheduleResult(status: .NO_INTERNET, todaySchedules: [:], tomorrowSchedules: [:], updatedAt: "")
        }
    }

    public static func parseHtmlFullSchedules(html: String, now: Date = Date()) -> FullScheduleResult {
        let leafTables = extractLeafTables(from: html)
        if leafTables.isEmpty {
            ScheduleRepository.shared.clearAllSchedulesOnUnclearState()
            return FullScheduleResult(status: .NO_QUEUES_FOUND, todaySchedules: [:], tomorrowSchedules: [:], updatedAt: "")
        }

        let cal = KyivZone.calendar
        let todayComps = cal.dateComponents([.year, .month, .day], from: now)
        let tomorrowDate = cal.date(byAdding: .day, value: 1, to: now) ?? now.addingTimeInterval(86400)
        let tomorrowComps = cal.dateComponents([.year, .month, .day], from: tomorrowDate)

        var todayTable: String?
        var tomorrowTable: String?

        for table in leafTables {
            let headerText = extractFirstTwoRowsText(from: table)
            if todayTable == nil, tableMatchesDate(headerText: headerText, comps: todayComps) {
                todayTable = table
            } else if tomorrowTable == nil, tableMatchesDate(headerText: headerText, comps: tomorrowComps) {
                tomorrowTable = table
            }
        }

        if todayTable == nil {
            todayTable = leafTables.first { countMatchingQueues(in: $0) >= 6 } ?? leafTables.first
        }

        var todayMap: [String: [BlackoutSlot]] = [:]
        var tomorrowMap: [String: [BlackoutSlot]] = [:]

        if let tTable = todayTable {
            for q in UserSettings.ALL_QUEUES {
                if let slots = extractQueueSlotsFromTable(tableHtml: tTable, targetQueue: q) {
                    todayMap[q] = slots
                }
            }
        }

        if let tomTable = tomorrowTable {
            for q in UserSettings.ALL_QUEUES {
                if let slots = extractQueueSlotsFromTable(tableHtml: tomTable, targetQueue: q) {
                    tomorrowMap[q] = slots
                }
            }
        }

        if todayMap.isEmpty {
            ScheduleRepository.shared.clearAllSchedulesOnUnclearState()
            return FullScheduleResult(status: .NO_QUEUES_FOUND, todaySchedules: [:], tomorrowSchedules: [:], updatedAt: "")
        }

        let comps = cal.dateComponents([.hour, .minute], from: now)
        let updatedAt = String(format: "%02d:%02d", comps.hour ?? 0, comps.minute ?? 0)
        ScheduleRepository.shared.saveAllSchedulesBatch(todaySchedules: todayMap, tomorrowSchedules: tomorrowMap, now: now)

        return FullScheduleResult(
            status: .SUCCESS,
            todaySchedules: todayMap,
            tomorrowSchedules: tomorrowMap,
            updatedAt: updatedAt
        )
    }

    public static func extractLeafTables(from html: String) -> [String] {
        guard let regex = leafTableRegex else { return [] }
        let nsHtml = html as NSString
        let matches = regex.matches(in: html, range: NSRange(location: 0, length: nsHtml.length))
        return matches.map { nsHtml.substring(with: $0.range) }
    }

    private static func extractFirstTwoRowsText(from tableHtml: String) -> String {
        guard let regex = trRegex else { return tableHtml }
        let nsTable = tableHtml as NSString
        let matches = regex.matches(in: tableHtml, range: NSRange(location: 0, length: nsTable.length))
        let rows = matches.prefix(2).map { stripTags(nsTable.substring(with: $0.range)) }
        return rows.joined(separator: " ")
    }

    public static func tableMatchesDate(headerText: String, comps: DateComponents) -> Bool {
        guard let day = comps.day, let month = comps.month, let year = comps.year else { return false }
        let d2 = String(format: "%02d", day)
        let m2 = String(format: "%02d", month)
        let y4 = String(format: "%04d", year)
        let y2 = String(format: "%02d", year % 100)

        let numericPatterns = [
            "\\b\(d2)[./-]\(m2)[./-]\(y4)\\b",
            "\\b\(day)[./-]\(m2)[./-]\(y4)\\b",
            "\\b\(d2)[./-]\(m2)[./-]\(y2)\\b"
        ]
        for pat in numericPatterns {
            if let rx = try? NSRegularExpression(pattern: pat, options: .caseInsensitive),
               rx.firstMatch(in: headerText, range: NSRange(location: 0, length: (headerText as NSString).length)) != nil {
                return true
            }
        }

        let ukMonths: [Int: String] = [
            1: "січня", 2: "лютого", 3: "березня", 4: "квітня",
            5: "травня", 6: "червня", 7: "липня", 8: "серпня",
            9: "вересня", 10: "жовтня", 11: "листопада", 12: "грудня"
        ]
        if let mName = ukMonths[month] {
            let wordPat = "\\b0?\(day)\\s+\(mName)(?:\\s+\(y4))?\\b"
            if let rx = try? NSRegularExpression(pattern: wordPat, options: .caseInsensitive),
               rx.firstMatch(in: headerText, range: NSRange(location: 0, length: (headerText as NSString).length)) != nil {
                return true
            }
        }
        return false
    }

    private static func countMatchingQueues(in tableHtml: String) -> Int {
        UserSettings.ALL_QUEUES.filter { extractQueueSlotsFromTable(tableHtml: tableHtml, targetQueue: $0) != nil }.count
    }

    public static func extractQueueSlotsFromTable(tableHtml: String, targetQueue: String) -> [BlackoutSlot]? {
        guard let trRegex = Self.trRegex,
              let tdRegex = Self.tdRegex else { return nil }

        let nsTable = tableHtml as NSString
        let trMatches = trRegex.matches(in: tableHtml, range: NSRange(location: 0, length: nsTable.length))

        for trMatch in trMatches {
            let rowHtml = nsTable.substring(with: trMatch.range)
            let nsRow = rowHtml as NSString
            let tdMatches = tdRegex.matches(in: rowHtml, range: NSRange(location: 0, length: nsRow.length))
            if tdMatches.count < 24 { continue }

            let cells: [(attrs: String, text: String)] = tdMatches.map { match in
                let attrs = nsRow.substring(with: match.range(at: 1))
                let inner = stripTags(nsRow.substring(with: match.range(at: 2)))
                return (attrs: attrs, text: inner)
            }

            let matchesQueue = cells.prefix(3).contains { cell in
                let clean = cell.text.replacingOccurrences(of: ",", with: ".").trimmingCharacters(in: .whitespacesAndNewlines)
                return clean == targetQueue || clean == "Черга \(targetQueue)" || clean == "\(targetQueue) черга" || clean == "Підчерга \(targetQueue)"
            }
            if !matchesQueue { continue }

            let dataCells = cells.filter { cell in
                let attrLower = cell.attrs.lowercased().replacingOccurrences(of: " ", with: "")
                return !attrLower.contains("width:3pt") && !attrLower.contains("width:1pt") && !attrLower.contains("width=\"3\"")
            }

            let slotCount = dataCells.count >= 48 ? 48 : (dataCells.count >= 24 ? 24 : 0)
            if slotCount == 0 { continue }

            let scheduleCells = Array(dataCells.suffix(slotCount))
            if slotCount == 24 {
                var expanded: [BlackoutSlot] = []
                for (hourIdx, cell) in scheduleCells.enumerated() {
                    let isOff = isCellPowerOff(attrs: cell.attrs, text: cell.text)
                    let status: SlotStatus = isOff ? .POWER_OFF : .POWER_ON
                    for half in 0..<2 {
                        let slotIdx = hourIdx * 2 + half
                        let startMin = slotIdx * 30
                        let endMin = startMin + 30
                        expanded.append(BlackoutSlot(
                            index: slotIdx,
                            startMinute: startMin,
                            endMinute: endMin,
                            label: formatSlotLabel(startMin: startMin, endMin: endMin),
                            status: status
                        ))
                    }
                }
                return expanded
            } else {
                return scheduleCells.enumerated().map { idx, cell in
                    let startMin = idx * 30
                    let endMin = startMin + 30
                    let status: SlotStatus = isCellPowerOff(attrs: cell.attrs, text: cell.text) ? .POWER_OFF : .POWER_ON
                    return BlackoutSlot(
                        index: idx,
                        startMinute: startMin,
                        endMinute: endMin,
                        label: formatSlotLabel(startMin: startMin, endMin: endMin),
                        status: status
                    )
                }
            }
        }
        return nil
    }

    public static func isCellPowerOff(attrs: String, text: String) -> Bool {
        let attr = attrs.lowercased()
        let txt = text.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)

        let hasRedAttr =
            attr.contains("#ff3333") ||
            attr.contains("#ff3b30") ||
            attr.contains("#ff0000") ||
            attr.contains("background:red") ||
            attr.contains("background-color:red") ||
            attr.contains("rgb(255, 51, 51)") ||
            attr.contains("rgb(255,51,51)") ||
            attr.contains("rgb(255, 0, 0)") ||
            attr.contains("rgb(255,0,0)") ||
            attr.contains("danger")

        let hasOffText =
            txt == "вимк" ||
            txt == "відкл" ||
            txt == "в" ||
            txt == "-"

        return hasRedAttr || hasOffText
    }

    private static func formatSlotLabel(startMin: Int, endMin: Int) -> String {
        let sh = startMin / 60
        let sm = startMin % 60
        let eh = endMin / 60
        let em = endMin % 60
        return String(format: "%02d:%02d - %02d:%02d", sh, sm, eh, em)
    }

    public static func decodeHtmlEntities(_ raw: String) -> String {
        guard !raw.isEmpty else { return "" }
        var result = raw.replacingOccurrences(of: "&amp;", with: "&", options: .caseInsensitive)
        let apostropheEntities = ["&#039;", "&#39;", "&#x27;", "&#x0027;", "&apos;", "&#8217;", "&#146;", "&#0146;", "&rsquo;", "&lsquo;"]
        for entity in apostropheEntities {
            result = result.replacingOccurrences(of: entity, with: "'", options: .caseInsensitive)
        }
        result = result
            .replacingOccurrences(of: "&quot;", with: "\"", options: .caseInsensitive)
            .replacingOccurrences(of: "&#34;", with: "\"", options: .caseInsensitive)
            .replacingOccurrences(of: "&#034;", with: "\"", options: .caseInsensitive)
            .replacingOccurrences(of: "&nbsp;", with: " ", options: .caseInsensitive)
            .replacingOccurrences(of: "&#160;", with: " ", options: .caseInsensitive)
            .replacingOccurrences(of: "&#0160;", with: " ", options: .caseInsensitive)
            .replacingOccurrences(of: "&lt;", with: "<", options: .caseInsensitive)
            .replacingOccurrences(of: "&gt;", with: ">", options: .caseInsensitive)
        return result
    }

    public static func isValidOutageTimestamp(_ value: String?) -> Bool {
        guard let val = value?.trimmingCharacters(in: .whitespacesAndNewlines), !val.isEmpty else {
            return false
        }
        let lower = val.lowercased()
        if lower.contains("не вимикається") || lower.contains("за винятком") {
            return false
        }
        let pattern = "^(\\d{2}\\.\\d{2}(?:\\.\\d{2,4})?\\s+)?\\d{1,2}:\\d{2}$"
        guard let rx = try? NSRegularExpression(pattern: pattern) else { return false }
        let nsVal = val as NSString
        return rx.firstMatch(in: val, range: NSRange(location: 0, length: nsVal.length)) != nil
    }

    private static func stripTags(_ html: String) -> String {
        guard let regex = stripTagsRegex else {
            return decodeHtmlEntities(html)
                .trimmingCharacters(in: .whitespacesAndNewlines)
        }
        let nsHtml = html as NSString
        let stripped = regex.stringByReplacingMatches(in: html, range: NSRange(location: 0, length: nsHtml.length), withTemplate: "")
        return decodeHtmlEntities(stripped)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
