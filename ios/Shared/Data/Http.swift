import Foundation

/// A finished HTTP exchange, independent of URLSession so parsers and clients can be tested with fakes.
public struct HttpResponse: Sendable {
    public var status: Int
    /// Header names lower-cased.
    public var headers: [String: String]
    public var body: Data

    public init(status: Int, headers: [String: String] = [:], body: Data) {
        self.status = status
        self.headers = headers
        self.body = body
    }

    public func header(_ name: String) -> String? { headers[name.lowercased()] }
}

public enum HttpError: Error, Sendable {
    /// A non-2xx answer (304 is returned as a response, never thrown).
    case status(Int)
}

/// Seam for tests (mirror of the `HttpGet` interface of android PowerOnClient).
public protocol HttpClient: Sendable {
    func send(_ request: URLRequest) async throws -> HttpResponse
}

/// The production client. gzip is handled by URLSession; caching is done by the callers (ETag, own caches).
public struct URLSessionHttp: HttpClient {
    public static let shared = URLSessionHttp()

    private let session: URLSession

    public init(timeoutSeconds: TimeInterval = 8) {
        let config = URLSessionConfiguration.ephemeral
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        config.urlCache = nil
        config.timeoutIntervalForRequest = timeoutSeconds
        config.timeoutIntervalForResource = timeoutSeconds * 4
        config.waitsForConnectivity = false
        session = URLSession(configuration: config)
    }

    public func send(_ request: URLRequest) async throws -> HttpResponse {
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
        var headers: [String: String] = [:]
        for (k, v) in http.allHeaderFields {
            if let key = k as? String, let value = v as? String { headers[key.lowercased()] = value }
        }
        return HttpResponse(status: http.statusCode, headers: headers, body: data)
    }
}

public enum Http {
    /// Same desktop browser identity the Android app sends to ztoe.com.ua.
    public static let userAgent =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

    /// Maps a thrown error to the platform-neutral failure kind of spec/SITE_STATE.md.
    public static func failure(of error: Error) -> FetchFailure {
        if case HttpError.status = error { return .HTTP_ERROR }
        guard let u = error as? URLError else { return .OTHER }
        switch u.code {
        case .cannotFindHost, .dnsLookupFailed:
            return .DNS
        case .cannotConnectToHost, .networkConnectionLost, .notConnectedToInternet, .internationalRoamingOff,
             .dataNotAllowed, .callIsActive:
            return .CONNECT
        case .timedOut:
            return .TIMEOUT
        case .secureConnectionFailed, .serverCertificateHasBadDate, .serverCertificateUntrusted,
             .serverCertificateHasUnknownRoot, .serverCertificateNotYetValid, .clientCertificateRejected,
             .clientCertificateRequired, .appTransportSecurityRequiresSecureConnection:
            return .TLS
        case .badServerResponse:
            return .HTTP_ERROR
        default:
            return .OTHER
        }
    }
}

/// ztoe.com.ua answers in Windows-1251. The raw bytes are decoded once (never decoded and re-encoded).
public enum Cp1251 {
    private static let encoding: String.Encoding = {
        let cf = CFStringConvertEncodingToNSStringEncoding(CFStringEncoding(CFStringEncodings.windowsCyrillic.rawValue))
        return String.Encoding(rawValue: cf)
    }()

    /// Decodes as Windows-1251 unless the server declared UTF-8 (`Content-Type`), like the Android
    /// parser; falls back to UTF-8 only when the bytes are not valid Windows-1251.
    public static func decode(_ data: Data, contentType: String? = nil) -> String {
        if let ct = contentType?.lowercased(), ct.contains("utf-8"), let s = String(data: data, encoding: .utf8) {
            return s
        }
        if let s = String(data: data, encoding: encoding) { return s }
        return String(decoding: data, as: UTF8.self)
    }

    /// Encodes a form value for an application/x-www-form-urlencoded body in Windows-1251
    /// (ztoe expects its own charset in POST bodies).
    public static func formEncode(_ value: String) -> String {
        guard let bytes = value.data(using: encoding, allowLossyConversion: true) else { return value }
        var out = ""
        for b in bytes {
            let c = Character(UnicodeScalar(b))
            if (b >= 0x30 && b <= 0x39) || (b >= 0x41 && b <= 0x5A) || (b >= 0x61 && b <= 0x7A) || "-_.*".contains(c) {
                out.append(c)
            } else if b == 0x20 {
                out.append("+")
            } else {
                out += String(format: "%%%02X", b)
            }
        }
        return out
    }
}

/// Shared HTML helpers for the regex scanners (no DOM parser on iOS).
public enum Html {
    private static let blockTag = Rx("<(?:br|/?(?:p|div|tr|td|th|li|table|tbody|thead|h[1-6]))\\b[^>]*>", ignoreCase: true)
    private static let tag = Rx("<[^>]*>")
    private static let ws = Rx("[ \\t\\n\\x{0B}\\f\\r\\u00A0]+")

    /// Jsoup `Element.text()`: block tags become a space, inline tags (`<b>`, `<font>`) vanish without
    /// one, entities are decoded, whitespace is collapsed and trimmed.
    public static func text(_ html: String) -> String {
        let noTags = tag.replace(blockTag.replace(html, template: " "), template: "")
        return ws.replace(TextNorm.decodeEntities(noTags), template: " ").ktTrim()
    }
}
