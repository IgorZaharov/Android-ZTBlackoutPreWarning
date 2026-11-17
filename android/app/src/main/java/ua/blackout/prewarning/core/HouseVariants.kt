package ua.blackout.prewarning.core

/**
 * A house listed in several ztoe rows (households / non-household, sometimes two queues of one type).
 * Specified in `spec/ADDRESS_KEY.md` section 6, golden cases in `spec/vectors/house_variants.json`,
 * mirrored in `src/core/houseVariants.ts` and `ios/Shared/Core/HouseVariants.swift`.
 */
object ConsumerType {
    const val HOUSEHOLD = "household"
    const val BUSINESS = "business"

    /** `household`, `business` or `""` when the text names no consumer type. A type code maps to itself. */
    fun of(raw: String?): String {
        if (raw.isNullOrBlank()) return ""
        val s = TextNorm.decodeEntities(raw).trim().lowercase()
        return when {
            s == HOUSEHOLD || s == BUSINESS -> s
            s.contains("непобут") || s.contains("юридич") -> BUSINESS
            s.contains("побут") -> HOUSEHOLD
            else -> ""
        }
    }
}

/** One queue (or one status without a queue) of a house, with the consumer types the site lists it for. */
data class HouseVariant(
    val queue: String,
    val statusText: String? = null,
    val consumers: List<String> = emptyList()
)

object HouseVariants {
    /** Folds one table row into [variants]: same non-empty queue = same variant; all status rows = one variant. */
    fun add(variants: List<HouseVariant>, queue: String, statusText: String?, consumerRaw: String?): List<HouseVariant> {
        val type = ConsumerType.of(consumerRaw)
        val q = queue.trim()
        val idx = variants.indexOfFirst { if (q.isNotEmpty()) it.queue == q else it.queue.isEmpty() }
        if (idx < 0) {
            val status = if (q.isEmpty()) statusText?.takeIf { it.isNotBlank() } else null
            return variants + HouseVariant(q, status, if (type.isEmpty()) emptyList() else listOf(type))
        }
        val existing = variants[idx]
        val merged = existing.copy(
            statusText = existing.statusText ?: if (q.isEmpty()) statusText?.takeIf { it.isNotBlank() } else null,
            consumers = if (type.isEmpty() || type in existing.consumers) existing.consumers else existing.consumers + type
        )
        return variants.toMutableList().also { it[idx] = merged }
    }

    /** Unites two variant lists (the rows of [b] come after those of [a]). */
    fun union(a: List<HouseVariant>, b: List<HouseVariant>): List<HouseVariant> {
        var out = a
        for (v in b) {
            if (v.consumers.isEmpty()) {
                out = add(out, v.queue, v.statusText, null)
            } else {
                for (c in v.consumers) out = add(out, v.queue, v.statusText, c)
            }
        }
        return out
    }

    /** Households first, then a queue before no queue, otherwise discovery order. */
    fun ordered(variants: List<HouseVariant>): List<HouseVariant> =
        variants.sortedWith(
            compareBy<HouseVariant> { if (ConsumerType.HOUSEHOLD in it.consumers) 0 else 1 }
                .thenBy { if (it.queue.isNotEmpty()) 0 else 1 }
        )

    /**
     * The variant to apply (spec/ADDRESS_KEY.md section 6, rule 5). [preferredQueue] null: the first. Otherwise the
     * variant with that queue (`""` = the one without a queue) while it still lists one of [preferredConsumers] (or
     * none were given); else the first variant that lists one of them; else the first.
     */
    fun pick(variants: List<HouseVariant>, preferredQueue: String?, preferredConsumers: List<String> = emptyList()): HouseVariant? {
        val list = ordered(variants)
        if (preferredQueue != null) {
            val p = preferredQueue.trim()
            val sharesType = { v: HouseVariant -> preferredConsumers.isEmpty() || v.consumers.any { it in preferredConsumers } }
            list.firstOrNull { it.queue == p && sharesType(it) }?.let { return it }
            if (preferredConsumers.isNotEmpty()) list.firstOrNull { v -> v.consumers.any { it in preferredConsumers } }?.let { return it }
        }
        return list.firstOrNull()
    }
}
