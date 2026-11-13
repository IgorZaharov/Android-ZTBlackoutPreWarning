package ua.blackout.prewarning.core

/**
 * Extracts the notice ztoe publishes in place of the schedule ("УВАГА! ВАЖЛИВА ІНФОРМАЦІЯ!",
 * for example "Графіки погодинних відключень електроенергії наразі не діють"). Regex based on purpose,
 * so Kotlin, TypeScript and Swift give the same text for the same page (spec/SITE_STATE.md, section
 * "Site notice"; vectors in site_notice.json).
 *
 * Rules: find the marker (case-insensitive, any whitespace or `&nbsp;` between the words); the block
 * ends at the first closing `h1`-`h6`, `p`, `div`, `td`, `center` tag, an opening `table`/`hr`, or after
 * [MAX_SCAN] characters. Inside it `<br>` is a line break, other tags are dropped, entities are decoded,
 * every line is trimmed with its whitespace collapsed, and empty lines are removed. The result keeps
 * the marker as its first line and is cut at [MAX_LENGTH] characters on a line boundary (with "…").
 * Returns null when there is no marker or nothing follows it.
 */
object SiteNotice {
    const val MAX_SCAN = 4000
    const val MAX_LENGTH = 1000

    /** ASCII whitespace plus the no-break space; spelled out so Kotlin, JS and Swift agree. */
    private const val WS = "[ \\t\\n\\x0B\\f\\r\\u00A0]"

    private val MARKER = Regex(
        "УВАГА!(?:$WS|&nbsp;)*ВАЖЛИВА(?:$WS|&nbsp;)+ІНФОРМАЦІЯ!?",
        RegexOption.IGNORE_CASE
    )
    private val BLOCK_END = Regex("</(?:h[1-6]|p|div|td|center)\\s*>|<(?:table|hr)\\b", RegexOption.IGNORE_CASE)
    private val BR = Regex("<br\\s*/?>", RegexOption.IGNORE_CASE)
    private val TAG = Regex("<[^>]*>")
    private val SPACES = Regex("$WS+")

    fun extract(html: String): String? {
        val m = MARKER.find(html) ?: return null
        val from = m.range.first
        val scanEnd = minOf(html.length, m.range.last + 1 + MAX_SCAN)
        val end = BLOCK_END.find(html.substring(m.range.last + 1, scanEnd))
            ?.let { m.range.last + 1 + it.range.first } ?: scanEnd
        val block = html.substring(from, end)

        // Source line breaks are plain whitespace; only <br> starts a new line
        val text = TextNorm.decodeEntities(BR.replace(block.replace(SPACES, " "), "\n").replace(TAG, ""))
        val lines = text.split('\n')
            .map { it.replace(SPACES, " ").trim() }
            .filter { it.isNotEmpty() }
        if (lines.size < 2) return null

        val out = StringBuilder()
        for (line in lines) {
            val add = if (out.isEmpty()) line.length else line.length + 1
            if (out.length + add > MAX_LENGTH) {
                out.append("\n…")
                break
            }
            if (out.isNotEmpty()) out.append('\n')
            out.append(line)
        }
        return out.toString()
    }
}
