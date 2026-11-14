import Foundation

public final class DonationsRepository {
    public static let shared = DonationsRepository()
    public static let REMOTE_DONATIONS_URL = "https://raw.githubusercontent.com/IgorZaharov/Android-ZTBlackoutPreWarning/main/donations.json"
    public static let REFRESH_INTERVAL_MS: Int64 = 86_400_000

    public static let DEFAULT_DONATIONS: [DonationItem] = [
        DonationItem(title: "Допомога тваринам | Help animal volunteers", url: "https://send.monobank.ua/jar/7vJA5xrLoV"),
        DonationItem(title: "Фонд Повернись Живим | Come Back Alive Foundation", url: "https://savelife.in.ua/donate/")
    ]

    private var defaults: UserDefaults {
        UserDefaults(suiteName: ScheduleRepository.APP_GROUP_ID) ?? .standard
    }

    public func getDonationsWithDailyRefresh(nowMs: Int64 = Int64(Date().timeIntervalSince1970 * 1000), forceRefresh: Bool = false) async -> [DonationItem] {
        let lastFetch = defaults.object(forKey: "donations_last_fetch_ms") as? Int64 ?? 0
        if !forceRefresh, nowMs - lastFetch < Self.REFRESH_INTERVAL_MS,
           let cachedJson = defaults.string(forKey: "donations_cached_json"),
           let data = cachedJson.data(using: .utf8),
           let items = try? JSONDecoder().decode([DonationItem].self, from: data),
           !items.isEmpty {
            return items
        }

        if let url = URL(string: Self.REMOTE_DONATIONS_URL) {
            var req = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 10.0)
            req.setValue("gzip, deflate", forHTTPHeaderField: "Accept-Encoding")
            if let etag = defaults.string(forKey: "donations_etag") {
                req.setValue(etag, forHTTPHeaderField: "If-None-Match")
            }

            if let (data, resp) = try? await URLSession.shared.data(for: req),
               let httpResp = resp as? HTTPURLResponse {
                if httpResp.statusCode == 200,
                   let items = try? JSONDecoder().decode([DonationItem].self, from: data),
                   !items.isEmpty {
                    if let rawStr = String(data: data, encoding: .utf8) {
                        defaults.set(rawStr, forKey: "donations_cached_json")
                    }
                    if let newEtag = httpResp.value(forHTTPHeaderField: "ETag") {
                        defaults.set(newEtag, forKey: "donations_etag")
                    }
                    defaults.set(nowMs, forKey: "donations_last_fetch_ms")
                    return items
                }
            }
        }

        if let bundleUrl = Bundle.main.url(forResource: "donations", withExtension: "json"),
           let data = try? Data(contentsOf: bundleUrl),
           let items = try? JSONDecoder().decode([DonationItem].self, from: data),
           !items.isEmpty {
            return items
        }

        return Self.DEFAULT_DONATIONS
    }

    public static func getFaviconCandidateUrls(for pageUrl: String) -> [String] {
        guard let url = URL(string: pageUrl), let host = url.host?.lowercased() else { return [] }
        let parts = host.split(separator: ".").map(String.init)
        var rootDomain = host
        if parts.count >= 3 {
            let lastTwo = "\(parts[parts.count - 2]).\(parts[parts.count - 1])"
            if lastTwo == "in.ua" || lastTwo == "com.ua" || lastTwo == "org.ua" || lastTwo == "gov.ua" {
                rootDomain = parts.suffix(3).joined(separator: ".")
            } else {
                rootDomain = lastTwo
            }
        }

        var candidates = [
            "https://icons.duckduckgo.com/ip3/\(host).ico",
            "https://\(host)/favicon.ico"
        ]
        if rootDomain != host {
            candidates.append("https://icons.duckduckgo.com/ip3/\(rootDomain).ico")
            candidates.append("https://\(rootDomain)/favicon.ico")
        }
        return candidates
    }
}
