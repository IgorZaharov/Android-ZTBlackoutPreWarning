package ua.blackout.prewarning.ui.components

import java.text.Normalizer
import ua.blackout.prewarning.core.HouseKey
import ua.blackout.prewarning.core.StreetKey
import ua.blackout.prewarning.core.TextNorm

/**
 * Pure matching used by [SearchablePickerField] (no Compose, unit-tested in `PickerSearchTest`).
 *
 * Matching is case-, apostrophe-, diacritic- and prefix-insensitive:
 *  - apostrophes of every kind (`'`, `’`, `ʼ` ...) are dropped on both sides (via [StreetKey]);
 *  - Latin and Cyrillic look-alike letters share one skeleton letter (via [TextNorm.skeleton]), so a
 *    Latin "16a" finds the Cyrillic house "16А";
 *  - combining marks are stripped, so "ї" matches "і" and "й" matches "и" (typing without the special
 *    letters still finds the street);
 *  - a leading type word ("вул.", "пров.", "м.", "с.", "смт") is optional on both sides: "ш" finds
 *    "вул. Шевченка" and "вул ш" finds "Шевченка".
 *
 * Results are ranked: prefix match first, then a match at the start of any word, then a plain
 * substring. Inside one rank the original order of the list is kept (streets arrive sorted); houses
 * additionally put shorter keys first so "16" lists 16 before 16А and 160.
 */
object PickerSearch {
    const val NO_MATCH = -1
    const val PREFIX = 0
    const val WORD_PREFIX = 1
    const val CONTAINS = 2

    enum class Kind { TEXT, HOUSE }

    /** Normalized form of one label or query: [full] with the type word, [core] without it. */
    class Key internal constructor(val full: String, val core: String, internal val kind: Kind) {
        val isEmpty: Boolean get() = full.isEmpty()
    }

    private val MARKS = Regex("\\p{Mn}+")
    private val SEPARATORS = Regex("[-/,()\"]")

    /** Type words that may open a street or settlement name, folded exactly like the labels are. */
    private val PREFIX_WORDS = listOf(
        "вул", "вулиця", "пров", "провулок", "просп", "проспект", "пр-т", "пр-к", "б-р", "бульвар", "бульв", "бул",
        "пл", "площа", "пр-д", "проїзд", "узв", "узвіз", "туп", "тупик", "наб", "набережна", "шосе", "майдан", "м-н",
        "м", "с", "смт", "сел", "селище", "місто", "село", "район", "р-н"
    )

    private val LEADING_TYPE: Regex by lazy {
        val alternatives = PREFIX_WORDS
            .map { foldWord(it) }
            .distinct()
            .sortedByDescending { it.length }
            .joinToString("|") { Regex.escape(it) }
        Regex("^(?:$alternatives)(?:\\.\\s*|\\s+)")
    }

    private fun fold(raw: String): String = MARKS.replace(Normalizer.normalize(raw, Normalizer.Form.NFD), "")

    private fun foldWord(word: String): String = TextNorm.skeleton(fold(word).lowercase())

    fun keyOf(raw: String, kind: Kind = Kind.TEXT): Key {
        return when (kind) {
            Kind.HOUSE -> {
                val k = HouseKey.of(fold(raw))
                Key(k, k, kind)
            }
            Kind.TEXT -> {
                val full = StreetKey.of(fold(raw))
                var core = full
                // two passes so "м. вул. X" style double prefixes lose both words; never strip down to nothing
                repeat(2) {
                    val stripped = LEADING_TYPE.replaceFirst(core, "")
                    if (stripped.isNotEmpty() && stripped != core) core = stripped
                }
                Key(full, core, kind)
            }
        }
    }

    private fun wordForm(core: String): String = " " + SEPARATORS.replace(core, " ")

    /** Rank of [candidate] for [query]: [PREFIX], [WORD_PREFIX], [CONTAINS] or [NO_MATCH]. An empty query matches everything as [PREFIX]. */
    fun rank(query: Key, candidate: Key): Int {
        if (query.isEmpty) return PREFIX
        if (candidate.isEmpty) return NO_MATCH
        if (candidate.full.startsWith(query.full)) return PREFIX
        if (candidate.core.startsWith(query.core)) {
            // "вул ш" ranks "вул. Шевченка" above "пров. Шевченка"; plain "ш" treats the type word as absent
            return if (query.core == query.full || query.kind == Kind.HOUSE) PREFIX else WORD_PREFIX
        }
        if (query.kind == Kind.TEXT && wordForm(candidate.core).contains(wordForm(query.core))) return WORD_PREFIX
        if (candidate.core.contains(query.core) || candidate.full.contains(query.full)) return CONTAINS
        return NO_MATCH
    }

    fun rank(query: String, label: String, kind: Kind = Kind.TEXT): Int =
        rank(keyOf(query, kind), keyOf(label, kind))

    /** Keys are computed once per list (966 streets), then every keystroke only compares strings. */
    class Index<T>(items: List<T>, private val kind: Kind = Kind.TEXT, label: (T) -> String) {
        private val items: List<T> = items
        private val keys: List<Key> = items.map { keyOf(label(it), kind) }

        fun search(query: String): List<T> {
            val q = keyOf(query, kind)
            if (q.isEmpty) return items
            val hits = ArrayList<Hit>()
            for (i in items.indices) {
                val r = rank(q, keys[i])
                if (r != NO_MATCH) hits.add(Hit(i, r, keys[i].core.length))
            }
            val comparator = if (kind == Kind.HOUSE) {
                compareBy<Hit>({ it.rank }, { it.length }, { it.index })
            } else {
                compareBy<Hit>({ it.rank }, { it.index })
            }
            hits.sortWith(comparator)
            return hits.map { items[it.index] }
        }

        private class Hit(val index: Int, val rank: Int, val length: Int)
    }

    fun <T> filter(items: List<T>, query: String, kind: Kind = Kind.TEXT, label: (T) -> String): List<T> =
        Index(items, kind, label).search(query)
}
