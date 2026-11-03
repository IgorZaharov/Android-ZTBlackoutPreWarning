package ua.blackout.prewarning.data

import java.time.ZoneId

/**
 * Kyiv time zone resolved against the device's tzdata.
 *
 * The `Europe/Kyiv` ID only exists since tzdata 2022b. Devices with older tzdata
 * (e.g. Android 10 without Mainline time zone updates) know only the legacy
 * `Europe/Kiev` ID, and `ZoneId.of("Europe/Kyiv")` throws `ZoneRulesException` there.
 */
val KYIV_ZONE: ZoneId by lazy {
    listOf("Europe/Kyiv", "Europe/Kiev").firstNotNullOfOrNull { id ->
        runCatching { ZoneId.of(id) }.getOrNull()
    } ?: ZoneId.systemDefault()
}
