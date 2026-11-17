package ua.blackout.prewarning.data.repository

import android.content.Context
import ua.blackout.prewarning.core.HouseKey
import ua.blackout.prewarning.core.HouseVariant

/**
 * The queue variant the user applied from the address lookup for a house the site lists more than once
 * (spec/ADDRESS_KEY.md section 6, rule 5). Re-checks of the address prefer it; without a stored choice the
 * default (households first) applies, so addresses saved before 1.4.1 move to the households' queue.
 * Keyed by street id and [HouseKey]; mirrored by src/services/houseVariantChoices.ts and
 * ios/Shared/Data/HouseVariantChoices.swift.
 */
object HouseVariantChoices {
    private const val PREFS = "house_variant_choice"

    internal fun key(streetId: String, house: String) = "$streetId|${HouseKey.of(house)}"

    /** Stored as `queue` TAB `consumer,consumer`. */
    internal fun encode(v: HouseVariant) = "${v.queue}\t${v.consumers.joinToString(",")}"

    internal fun decode(raw: String?): HouseVariant? {
        if (raw == null) return null
        val tab = raw.indexOf('\t')
        if (tab < 0) return null
        val consumers = raw.substring(tab + 1).split(',').filter { it.isNotBlank() }
        return HouseVariant(queue = raw.substring(0, tab), consumers = consumers)
    }

    fun get(context: Context, streetId: String, house: String): HouseVariant? {
        if (streetId.isBlank() || HouseKey.of(house).isEmpty()) return null
        return decode(prefs(context).getString(key(streetId, house), null))
    }

    /** [variant] null forgets the choice (the house has a single queue). */
    fun put(context: Context, streetId: String, house: String, variant: HouseVariant?) {
        if (streetId.isBlank() || HouseKey.of(house).isEmpty()) return
        val edit = prefs(context).edit()
        if (variant == null) edit.remove(key(streetId, house)) else edit.putString(key(streetId, house), encode(variant))
        edit.apply()
    }

    private fun prefs(context: Context) = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
