import Foundation

/// Thin NSRegularExpression wrapper used by the pure core so Swift gives the same results as the
/// Kotlin (java.util.regex) and TypeScript cores. All offsets are UTF-16, like Kotlin and JS strings.
///
/// Java's `\s` is ASCII only (`[ \t\n\x0B\f\r]`) while ICU's `\s` also matches Unicode spaces, so the
/// patterns in the core spell the class out with `Rx.ws` instead of using `\s`.
struct Rx {
    /// java.util.regex `\s` (ASCII whitespace), for use inside or outside a character class body.
    static let wsChars = " \\t\\n\\x{0B}\\f\\r"
    static let ws = "[\(wsChars)]"

    let re: NSRegularExpression

    init(_ pattern: String, ignoreCase: Bool = false) {
        // Patterns are compile-time constants; a bad one is a programming error caught by the tests.
        re = try! NSRegularExpression(pattern: pattern, options: ignoreCase ? [.caseInsensitive] : [])
    }

    private static func full(_ s: String) -> NSRange { NSRange(location: 0, length: (s as NSString).length) }

    func firstMatch(in s: String) -> NSTextCheckingResult? {
        re.firstMatch(in: s, options: [], range: Rx.full(s))
    }

    /// Whole-string match (Kotlin `Regex.matches`).
    func matches(_ s: String) -> Bool {
        guard let m = firstMatch(in: s) else { return false }
        return m.range.location == 0 && m.range.length == (s as NSString).length
    }

    /// Replaces every match with a template (`$1` refers to a group).
    func replace(_ s: String, template: String) -> String {
        re.stringByReplacingMatches(in: s, options: [], range: Rx.full(s), withTemplate: template)
    }

    /// Replaces every match with the result of `transform` (Kotlin `Regex.replace(input) { ... }`).
    func replace(_ s: String, _ transform: (NSTextCheckingResult, NSString) -> String) -> String {
        let ns = s as NSString
        let matches = re.matches(in: s, options: [], range: Rx.full(s))
        if matches.isEmpty { return s }
        let out = NSMutableString()
        var cursor = 0
        for m in matches {
            out.append(ns.substring(with: NSRange(location: cursor, length: m.range.location - cursor)))
            out.append(transform(m, ns))
            cursor = m.range.location + m.range.length
        }
        out.append(ns.substring(from: cursor))
        return out as String
    }

    /// Replaces only the first match (Kotlin `Regex.replaceFirst`).
    func replaceFirst(_ s: String, template: String) -> String {
        guard let m = firstMatch(in: s) else { return s }
        let ns = s as NSString
        let replacement = re.replacementString(for: m, in: s, offset: 0, template: template)
        return ns.replacingCharacters(in: m.range, with: replacement)
    }

    static func group(_ m: NSTextCheckingResult, _ i: Int, in ns: NSString) -> String? {
        let r = m.range(at: i)
        return r.location == NSNotFound ? nil : ns.substring(with: r)
    }
}

extension String {
    /// Literal UTF-16 prefix test (Kotlin `startsWith`), no Unicode canonical equivalence.
    func ktStartsWith(_ prefix: String) -> Bool { (self as NSString).hasPrefix(prefix) }

    /// Literal UTF-16 containment (Kotlin `contains`).
    func ktContains(_ other: String) -> Bool {
        if other.isEmpty { return true }
        return (self as NSString).range(of: other, options: .literal).location != NSNotFound
    }

    /// Kotlin `String.length` (UTF-16 code units).
    var ktLength: Int { utf16.count }

    /// Kotlin `trim()`: drops leading and trailing whitespace.
    func ktTrim() -> String { trimmingCharacters(in: .whitespacesAndNewlines) }

    /// Kotlin `isBlank()`.
    var ktIsBlank: Bool { ktTrim().isEmpty }
}
