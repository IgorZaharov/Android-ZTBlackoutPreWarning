import Foundation

/// Extracts the notice ztoe publishes in place of the schedule ("УВАГА! ВАЖЛИВА ІНФОРМАЦІЯ!").
/// Mirror of android core/SiteNotice.kt: regex based on purpose, so Kotlin, TypeScript and Swift give
/// the same text for the same page (spec/SITE_STATE.md "Site notice", spec/vectors/site_notice.json).
/// All lengths and offsets are UTF-16 code units, like Kotlin.
public enum SiteNotice {
    public static let MAX_SCAN = 4000
    public static let MAX_LENGTH = 1000

    /// ASCII whitespace plus the no-break space; spelled out so Kotlin, JS and Swift agree.
    private static let ws = "[ \\t\\n\\x{0B}\\f\\r\\u00A0]"

    private static let marker = Rx("УВАГА!(?:\(ws)|&nbsp;)*ВАЖЛИВА(?:\(ws)|&nbsp;)+ІНФОРМАЦІЯ!?", ignoreCase: true)
    private static let blockEnd = Rx("</(?:h[1-6]|p|div|td|center)\(Rx.ws)*>|<(?:table|hr)\\b", ignoreCase: true)
    private static let br = Rx("<br\(Rx.ws)*/?>", ignoreCase: true)
    private static let tag = Rx("<[^>]*>")
    private static let spaces = Rx("\(ws)+")

    public static func extract(_ html: String) -> String? {
        guard let m = marker.firstMatch(in: html) else { return nil }
        let ns = html as NSString
        let from = m.range.location
        let afterMarker = m.range.location + m.range.length
        let scanEnd = min(ns.length, afterMarker + MAX_SCAN)
        let tail = ns.substring(with: NSRange(location: afterMarker, length: scanEnd - afterMarker))
        let end = blockEnd.firstMatch(in: tail).map { afterMarker + $0.range.location } ?? scanEnd
        let block = ns.substring(with: NSRange(location: from, length: end - from))

        // Source line breaks are plain whitespace; only <br> starts a new line
        let text = TextNorm.decodeEntities(tag.replace(br.replace(spaces.replace(block, template: " "), template: "\n"), template: ""))
        let lines = text
            .components(separatedBy: "\n")
            .map { spaces.replace($0, template: " ").ktTrim() }
            .filter { !$0.isEmpty }
        if lines.count < 2 { return nil }

        var out = ""
        var outLength = 0 // UTF-16 length of `out`
        for line in lines {
            let add = out.isEmpty ? line.ktLength : line.ktLength + 1
            if outLength + add > MAX_LENGTH {
                out += "\n…"
                break
            }
            if !out.isEmpty { out += "\n" }
            out += line
            outLength += add
        }
        return out
    }
}
