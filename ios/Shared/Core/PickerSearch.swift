import Foundation

/// Pure matching for the searchable address picker (mirror of android ui/components/PickerSearch.kt).
///
/// Matching is case-, apostrophe-, diacritic- and prefix-insensitive:
///  - apostrophes of every kind are dropped on both sides (via StreetKey);
///  - Latin and Cyrillic look-alike letters share one skeleton letter (via TextNorm.skeleton), so a
///    Latin "16a" finds the Cyrillic house "16А";
///  - combining marks are stripped, so "ї" matches "і" and "й" matches "и";
///  - a leading type word ("вул.", "пров.", "м.", "с.", "смт") is optional on both sides.
///
/// Results are ranked: prefix match first, then a match at the start of any word, then a plain
/// substring. Inside one rank the original order of the list is kept; houses additionally put shorter
/// keys first so "16" lists 16 before 16А and 160.
public enum PickerSearch {
    public static let NO_MATCH = -1
    public static let PREFIX = 0
    public static let WORD_PREFIX = 1
    public static let CONTAINS = 2

    public enum Kind: Sendable { case TEXT, HOUSE }

    /// Normalized form of one label or query: `full` with the type word, `core` without it.
    public struct Key: Hashable, Sendable {
        public let full: String
        public let core: String
        let kind: Kind
        public var isEmpty: Bool { full.isEmpty }
    }

    private static let marks = Rx("\\p{Mn}+")
    private static let separators = Rx("[-/,()\"]")

    /// Type words that may open a street or settlement name, folded exactly like the labels are.
    private static let prefixWords = [
        "вул", "вулиця", "пров", "провулок", "просп", "проспект", "пр-т", "пр-к", "б-р", "бульвар", "бульв", "бул",
        "пл", "площа", "пр-д", "проїзд", "узв", "узвіз", "туп", "тупик", "наб", "набережна", "шосе", "майдан", "м-н",
        "м", "с", "смт", "сел", "селище", "місто", "село", "район", "р-н"
    ]

    private static let leadingType: Rx = {
        var seen = Set<String>()
        let alternatives = prefixWords
            .map { foldWord($0) }
            .filter { seen.insert($0).inserted }
            .stableSorted { $0.ktLength > $1.ktLength }
            .map { NSRegularExpression.escapedPattern(for: $0) }
            .joined(separator: "|")
        return Rx("^(?:\(alternatives))(?:\\.\(Rx.ws)*|\(Rx.ws)+)")
    }()

    private static func fold(_ raw: String) -> String {
        marks.replace(raw.decomposedStringWithCanonicalMapping, template: "")
    }

    private static func foldWord(_ word: String) -> String { TextNorm.skeleton(fold(word).lowercased()) }

    public static func keyOf(_ raw: String, kind: Kind = .TEXT) -> Key {
        switch kind {
        case .HOUSE:
            let k = HouseKey.of(fold(raw))
            return Key(full: k, core: k, kind: kind)
        case .TEXT:
            let full = StreetKey.of(fold(raw))
            var core = full
            // two passes so "м. вул. X" style double prefixes lose both words; never strip down to nothing
            for _ in 0..<2 {
                let stripped = leadingType.replaceFirst(core, template: "")
                if !stripped.isEmpty && stripped != core { core = stripped }
            }
            return Key(full: full, core: core, kind: kind)
        }
    }

    private static func wordForm(_ core: String) -> String { " " + separators.replace(core, template: " ") }

    /// Rank of `candidate` for `query`: PREFIX, WORD_PREFIX, CONTAINS or NO_MATCH. An empty query matches everything as PREFIX.
    public static func rank(_ query: Key, _ candidate: Key) -> Int {
        if query.isEmpty { return PREFIX }
        if candidate.isEmpty { return NO_MATCH }
        if candidate.full.ktStartsWith(query.full) { return PREFIX }
        if candidate.core.ktStartsWith(query.core) {
            // "вул ш" ranks "вул. Шевченка" above "пров. Шевченка"; plain "ш" treats the type word as absent
            return query.core == query.full || query.kind == .HOUSE ? PREFIX : WORD_PREFIX
        }
        if query.kind == .TEXT && wordForm(candidate.core).ktContains(wordForm(query.core)) { return WORD_PREFIX }
        if candidate.core.ktContains(query.core) || candidate.full.ktContains(query.full) { return CONTAINS }
        return NO_MATCH
    }

    public static func rank(_ query: String, _ label: String, kind: Kind = .TEXT) -> Int {
        rank(keyOf(query, kind: kind), keyOf(label, kind: kind))
    }

    /// Keys are computed once per list (966 streets), then every keystroke only compares strings.
    public struct Index<T> {
        private let items: [T]
        private let kind: Kind
        private let keys: [Key]

        public init(_ items: [T], kind: Kind = .TEXT, label: (T) -> String) {
            self.items = items
            self.kind = kind
            self.keys = items.map { PickerSearch.keyOf(label($0), kind: kind) }
        }

        public func search(_ query: String) -> [T] {
            let q = PickerSearch.keyOf(query, kind: kind)
            if q.isEmpty { return items }
            var hits: [(index: Int, rank: Int, length: Int)] = []
            for i in items.indices {
                let r = PickerSearch.rank(q, keys[i])
                if r != PickerSearch.NO_MATCH { hits.append((i, r, keys[i].core.ktLength)) }
            }
            let house = kind == .HOUSE
            hits.sort { a, b in
                if a.rank != b.rank { return a.rank < b.rank }
                if house && a.length != b.length { return a.length < b.length }
                return a.index < b.index
            }
            return hits.map { items[$0.index] }
        }
    }

    public static func filter<T>(_ items: [T], query: String, kind: Kind = .TEXT, label: (T) -> String) -> [T] {
        Index(items, kind: kind, label: label).search(query)
    }
}
