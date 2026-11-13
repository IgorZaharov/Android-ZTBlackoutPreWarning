package ua.blackout.prewarning.data.parser

import ua.blackout.prewarning.data.model.EmergencyOutageInfo

/** Test-only fixtures. The demo emergency that used to live in ZtoeAddressLookup is not part of the production path. */
object AddressFixtures {
    fun kyivska37Demo(): EmergencyOutageInfo = EmergencyOutageInfo(
        id = "pw_accident_391476673",
        remName = "Житомирський РЕМ",
        settlementName = "Житомир",
        streetName = "вул. Київська",
        house = "37",
        outageType = "Аварійне відключення",
        startTime = "06.04 19:21",
        estimatedRestoreTime = "07.04 20:00"
    )
}
