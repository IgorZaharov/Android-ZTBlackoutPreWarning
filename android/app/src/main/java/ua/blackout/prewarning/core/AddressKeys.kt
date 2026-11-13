package ua.blackout.prewarning.core

/**
 * Canonical keys for matching street and house names across ztoe.com.ua, PowerOn and the device
 * cache. Specified in `spec/ADDRESS_KEY.md`; the real duplicate pairs found on both sites are in
 * `spec/vectors/address_keys.json`.
 */
object TextNorm {
    private val NUMERIC_ENTITY = Regex("&#([xX][0-9a-fA-F]+|[0-9]+);")
    private val NAMED_ENTITY = Regex("&([a-zA-Z]+);")
    private val NAMED = mapOf(
        "amp" to "&", "lt" to "<", "gt" to ">", "quot" to "\"", "apos" to "'", "nbsp" to " ",
        "rsquo" to "’", "lsquo" to "‘", "ndash" to "–", "mdash" to "—",
        "laquo" to "«", "raquo" to "»", "hellip" to "…"
    )

    /** Decodes numeric and common named entities; repeats so `&amp;#039;` (double escaped) also becomes `'`. */
    fun decodeEntities(raw: String): String {
        var s = raw
        repeat(3) {
            if (!s.contains('&')) return s
            val before = s
            s = NUMERIC_ENTITY.replace(s) { m ->
                val v = m.groupValues[1]
                val cp = if (v[0] == 'x' || v[0] == 'X') v.substring(1).toIntOrNull(16) else v.toIntOrNull()
                if (cp != null && cp in 1..0x10FFFF) String(Character.toChars(cp)) else m.value
            }
            s = NAMED_ENTITY.replace(s) { m -> NAMED[m.groupValues[1].lowercase()] ?: m.value }
            if (s == before) return s
        }
        return s
    }

    /**
     * Maps letters that look identical in Latin and Cyrillic to one skeleton letter, so
     * `16A` (Latin) and `16А` (Cyrillic) compare equal. Input must already be lower-case.
     */
    fun skeleton(lower: String): String {
        val sb = StringBuilder(lower.length)
        for (ch in lower) sb.append(CONFUSABLE[ch] ?: ch)
        return sb.toString()
    }

    private val CONFUSABLE: Map<Char, Char> = mapOf(
        'а' to 'a', 'в' to 'b', 'с' to 'c', 'е' to 'e', 'н' to 'h', 'і' to 'i',
        'к' to 'k', 'м' to 'm', 'о' to 'o', 'р' to 'p', 'т' to 't', 'х' to 'x', 'у' to 'y'
    )

    /** All apostrophe-like characters seen in street names. */
    const val APOSTROPHES = "'’ʼ‘´`ʻ′"
}

object StreetKey {
    private val INITIAL_DOT_SPACE = Regex("(?<![\\p{L}\\p{N}])(\\p{L})\\.\\s+(?=\\p{L})")
    private val SPACES = Regex("[\\s\\u00A0\\u200B]+")

    private val TYPES: Map<String, String> = mapOf(
        "вулиця" to "вул", "вул" to "вул",
        "провулок" to "пров", "пров" to "пров", "пр-к" to "пров",
        "проспект" to "просп", "просп" to "просп", "пр-т" to "просп",
        "бульвар" to "б-р", "бульв" to "б-р", "бул" to "б-р", "б-р" to "б-р",
        "площа" to "пл", "пл" to "пл",
        "проїзд" to "пр-д", "пр-д" to "пр-д",
        "узвіз" to "узв", "узв" to "узв",
        "тупик" to "туп", "туп" to "туп",
        "набережна" to "наб", "наб" to "наб",
        "шосе" to "шосе",
        "майдан" to "майдан", "м-н" to "майдан"
    )

    /** Stable comparison key. See `spec/ADDRESS_KEY.md` for the step list. */
    fun of(raw: String): String {
        var s = TextNorm.decodeEntities(raw).lowercase()
        s = s.filter { TextNorm.APOSTROPHES.indexOf(it) < 0 }
        s = SPACES.replace(s, " ").trim()
        s = INITIAL_DOT_SPACE.replace(s) { "${it.groupValues[1]}." }
        val tokens = s.split(' ').filter { it.isNotEmpty() }.map { token ->
            TYPES[token.trimEnd('.')] ?: token
        }
        return TextNorm.skeleton(tokens.joinToString(" "))
    }
}

object HouseKey {
    // "будинок" must come before "буд\.?", otherwise the shorter alternative eats its first letters
    private val PREFIX = Regex("^(?:будинок|буд\\.?|№)\\s*")
    private val JUNK = Regex("[\\s'\"«»’ʼ`.]+")
    private val HYPHEN_BEFORE_LETTER = Regex("(?<=\\p{N})-(?=\\p{L})")

    /** `34-А`, `34 А`, `34А` and `34A` (Latin) share one key; `14/а` keeps its slash. */
    fun of(raw: String): String {
        var s = TextNorm.decodeEntities(raw).lowercase().trim()
        s = PREFIX.replace(s, "")
        s = JUNK.replace(s, "")
        s = HYPHEN_BEFORE_LETTER.replace(s, "")
        return TextNorm.skeleton(s)
    }

    /** PowerOn `buildingNames` is a comma separated list ("1, 10, 43А, 51а, 14/а"). */
    fun tokens(buildingNames: String): List<String> =
        buildingNames.split(',', ';').map { it.trim() }.filter { it.isNotEmpty() }

    fun listContains(buildingNames: String, house: String): Boolean {
        val target = of(house)
        if (target.isEmpty()) return false
        return tokens(buildingNames).any { of(it) == target }
    }
}
