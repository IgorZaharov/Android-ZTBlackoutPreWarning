import Foundation

/// Canonical keys for matching street and house names across ztoe.com.ua, PowerOn and the device
/// cache. Mirror of android core/AddressKeys.kt; rules in spec/ADDRESS_KEY.md, cases in
/// spec/vectors/address_keys.json.
public enum TextNorm {
    private static let numericEntity = Rx("&#([xX][0-9a-fA-F]+|[0-9]+);")
    private static let namedEntity = Rx("&([a-zA-Z]+);")
    private static let named: [String: String] = [
        "amp": "&", "lt": "<", "gt": ">", "quot": "\"", "apos": "'", "nbsp": " ",
        "rsquo": "’", "lsquo": "‘", "ndash": "–", "mdash": "—",
        "laquo": "«", "raquo": "»", "hellip": "…"
    ]

    /// Decodes numeric and common named entities; repeats so `&amp;#039;` (double escaped) also becomes `'`.
    public static func decodeEntities(_ raw: String) -> String {
        var s = raw
        for _ in 0..<3 {
            if !s.contains("&") { return s }
            let before = s
            s = numericEntity.replace(s) { m, ns in
                let whole = ns.substring(with: m.range)
                let v = Rx.group(m, 1, in: ns) ?? ""
                let cp: Int? = (v.hasPrefix("x") || v.hasPrefix("X")) ? Int(v.dropFirst(), radix: 16) : Int(v)
                if let cp, (1...0x10FFFF).contains(cp), let scalar = Unicode.Scalar(UInt32(cp)) {
                    return String(Character(scalar))
                }
                return whole
            }
            s = namedEntity.replace(s) { m, ns in
                named[(Rx.group(m, 1, in: ns) ?? "").lowercased()] ?? ns.substring(with: m.range)
            }
            if s == before { return s }
        }
        return s
    }

    private static let confusable: [Unicode.Scalar: Unicode.Scalar] = [
        "а": "a", "в": "b", "с": "c", "е": "e", "н": "h", "і": "i",
        "к": "k", "м": "m", "о": "o", "р": "p", "т": "t", "х": "x", "у": "y"
    ]

    /// Maps letters that look identical in Latin and Cyrillic to one skeleton letter, so `16A` (Latin)
    /// and `16А` (Cyrillic) compare equal. Input must already be lower-case.
    public static func skeleton(_ lower: String) -> String {
        var out = String.UnicodeScalarView()
        for ch in lower.unicodeScalars { out.append(confusable[ch] ?? ch) }
        return String(out)
    }

    /// All apostrophe-like characters seen in street names.
    public static let APOSTROPHES = "'’ʼ‘´`ʻ′"
    static let apostropheScalars = Set(APOSTROPHES.unicodeScalars)
}

public enum StreetKey {
    private static let initialDotSpace = Rx("(?<![\\p{L}\\p{N}])(\\p{L})\\.\(Rx.ws)+(?=\\p{L})")
    private static let spaces = Rx("[\(Rx.wsChars)\\u00A0\\u200B]+")

    private static let types: [String: String] = [
        "вулиця": "вул", "вул": "вул",
        "провулок": "пров", "пров": "пров", "пр-к": "пров",
        "проспект": "просп", "просп": "просп", "пр-т": "просп",
        "бульвар": "б-р", "бульв": "б-р", "бул": "б-р", "б-р": "б-р",
        "площа": "пл", "пл": "пл",
        "проїзд": "пр-д", "пр-д": "пр-д",
        "узвіз": "узв", "узв": "узв",
        "тупик": "туп", "туп": "туп",
        "набережна": "наб", "наб": "наб",
        "шосе": "шосе",
        "майдан": "майдан", "м-н": "майдан"
    ]

    static func trimTrailingDots(_ s: String) -> String {
        var t = Substring(s)
        while t.hasSuffix(".") { t = t.dropLast() }
        return String(t)
    }

    /// True for a street-type word (`вул.`, `Провулок`, `б-р` ...), compared lower-case without trailing dots.
    public static func isTypeWord(_ token: String) -> Bool { types[trimTrailingDots(token.lowercased())] != nil }

    /// Stable comparison key. See spec/ADDRESS_KEY.md for the step list.
    public static func of(_ raw: String) -> String {
        var s = TextNorm.decodeEntities(raw).lowercased()
        s = String(String.UnicodeScalarView(s.unicodeScalars.filter { !TextNorm.apostropheScalars.contains($0) }))
        s = spaces.replace(s, template: " ").ktTrim()
        s = initialDotSpace.replace(s, template: "$1.")
        let tokens = s.split(separator: " ", omittingEmptySubsequences: true).map { token -> String in
            let t = String(token)
            return types[trimTrailingDots(t)] ?? t
        }
        return TextNorm.skeleton(tokens.joined(separator: " "))
    }
}

public enum HouseKey {
    // "будинок" must come before "буд\.?", otherwise the shorter alternative eats its first letters
    private static let prefix = Rx("^(?:будинок|буд\\.?|№)\(Rx.ws)*")
    private static let junk = Rx("[\(Rx.wsChars)'\"«»’ʼ`.]+")
    private static let hyphenBeforeLetter = Rx("(?<=\\p{N})-(?=\\p{L})")

    /// `34-А`, `34 А`, `34А` and `34A` (Latin) share one key; `14/а` keeps its slash.
    public static func of(_ raw: String) -> String {
        var s = TextNorm.decodeEntities(raw).lowercased().ktTrim()
        s = prefix.replace(s, template: "")
        s = junk.replace(s, template: "")
        s = hyphenBeforeLetter.replace(s, template: "")
        return TextNorm.skeleton(s)
    }

    /// PowerOn `buildingNames` is a comma separated list ("1, 10, 43А, 51а, 14/а").
    public static func tokens(_ buildingNames: String) -> [String] {
        buildingNames
            .split(omittingEmptySubsequences: false, whereSeparator: { $0 == "," || $0 == ";" })
            .map { String($0).ktTrim() }
            .filter { !$0.isEmpty }
    }

    public static func listContains(_ buildingNames: String, house: String) -> Bool {
        let target = of(house)
        if target.isEmpty { return false }
        return tokens(buildingNames).contains { of($0) == target }
    }
}
