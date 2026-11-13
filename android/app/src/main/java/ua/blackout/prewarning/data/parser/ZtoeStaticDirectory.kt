package ua.blackout.prewarning.data.parser

/**
 * Offline fallback directory of REMs, settlements and a few Zhytomyr streets. It is used only until
 * the live index from ztoe.com.ua is loaded. It holds no house numbers and no outages: the old
 * default house lists and the demo emergency were removed from the production path.
 *
 * Street ids must agree with the street name (a persisted selection keeps its id). Ids that used to
 * disagree with their name are listed in [LEGACY_STREET_IDS] and [LEGACY_SETTLEMENT_IDS].
 */
internal object ZtoeStaticDirectory {
    val REMS: List<ZtoeRemOption> = listOf(
        ZtoeRemOption("zhytomyr", 7, "Житомирський РЕМ", "Zhytomyr REM", 6),
        ZtoeRemOption("berdychiv", 3, "Бердичівський РЕМ", "Berdychiv REM", 3),
        ZtoeRemOption("korosten", 9, "Коростенський РЕМ", "Korosten REM", 7),
        ZtoeRemOption("zviahel", 16, "Звягельський РЕМ", "Zviahel REM", 11),
        ZtoeRemOption("malyn", 14, "Малинський РЕМ", "Malyn REM", 10),
        ZtoeRemOption("radomyshl", 20, "Радомишльський РЕМ", "Radomyshl REM", 15),
        ZtoeRemOption("andrushivka", 1, "Андрушівський РЕМ", "Andrushivka REM", 1),
        ZtoeRemOption("baranivka", 2, "Баранівський РЕМ", "Baranivka REM", 2),
        ZtoeRemOption("brusyliv", 4, "Брусилівський РЕМ", "Brusyliv REM", 4),
        ZtoeRemOption("korostyshiv", 11, "Коростишівський РЕМ", "Korostyshiv REM", 8),
        ZtoeRemOption("liubar", 13, "Любарський РЕМ", "Liubar REM", 9),
        ZtoeRemOption("ovruch", 17, "Овруцький РЕМ", "Ovruch REM", 12),
        ZtoeRemOption("olevsk", 18, "Олевський РЕМ", "Olevsk REM", 13),
        ZtoeRemOption("popilnia", 19, "Попільнянський РЕМ", "Popilnia REM", 14),
        ZtoeRemOption("pulyny", 23, "Пулинський РЕМ", "Pulyny REM", 17),
        ZtoeRemOption("romaniv", 21, "Романівський РЕМ", "Romaniv REM", 16),
        ZtoeRemOption("khoroshiv", 5, "Хорошівський РЕМ", "Khoroshiv REM", 5),
        ZtoeRemOption("cherniakhiv", 24, "Черняхівський РЕМ", "Cherniakhiv REM", 18),
        ZtoeRemOption("chudniv", 25, "Чуднівський РЕМ", "Chudniv REM", 19)
    )

    val SETTLEMENTS: List<ZtoeSettlementOption> = listOf(
        ZtoeSettlementOption("zt_city", "zhytomyr", 16657, "м. Житомир", "Zhytomyr", 333),
        ZtoeSettlementOption("zt_zarichany", "zhytomyr", 16670, "с. Зарічани", "Zarichany"),
        ZtoeSettlementOption("zt_oliivka", "zhytomyr", 16700, "с. Оліївка", "Oliivka"),
        ZtoeSettlementOption("zt_hlybochytsia", "zhytomyr", 16667, "с. Глибочиця", "Hlybochytsia"),
        ZtoeSettlementOption("zt_stanishivka", "zhytomyr", 16680, "с. Станишівка", "Stanyshivka"),
        ZtoeSettlementOption("bd_city", "berdychiv", 16758, "м. Бердичів", "Berdychiv"),
        ZtoeSettlementOption("bd_hryshkivtsi", "berdychiv", 16760, "смт Гришківці", "Hryshkivtsi"),
        ZtoeSettlementOption("kr_city", "korosten", 17062, "м. Коростень", "Korosten"),
        ZtoeSettlementOption("zv_city", "zviahel", 16823, "м. Звягель", "Zviahel"),
        ZtoeSettlementOption("ml_city", "malyn", 17634, "м. Малин", "Malyn"),
        ZtoeSettlementOption("rd_city", "radomyshl", 17899, "м. Радомишль", "Radomyshl"),
        ZtoeSettlementOption("an_city", "andrushivka", 17694, "м. Андрушівка", "Andrushivka"),
        ZtoeSettlementOption("br_city", "baranivka", 15417, "м. Баранівка", "Baranivka"),
        ZtoeSettlementOption("bs_city", "brusyliv", 16202, "селище Брусилів", "Brusyliv"),
        ZtoeSettlementOption("ks_city", "korostyshiv", 15747, "м. Коростишів", "Korostyshiv"),
        ZtoeSettlementOption("lb_city", "liubar", 17742, "селище Любар", "Liubar"),
        ZtoeSettlementOption("ov_city", "ovruch", 17197, "м. Овруч", "Ovruch"),
        ZtoeSettlementOption("ol_city", "olevsk", 17823, "м. Олевськ", "Olevsk"),
        ZtoeSettlementOption("pp_city", "popilnia", 17555, "селище Попільня", "Popilnia"),
        ZtoeSettlementOption("pl_city", "pulyny", 16602, "селище Пулини", "Pulyny"),
        ZtoeSettlementOption("rm_city", "romaniv", 17968, "селище Романів", "Romaniv"),
        ZtoeSettlementOption("kh_city", "khoroshiv", 16281, "селище Хорошів", "Khoroshiv"),
        ZtoeSettlementOption("ch_city", "cherniakhiv", 16063, "селище Черняхів", "Cherniakhiv"),
        ZtoeSettlementOption("cd_city", "chudniv", 18001, "м. Чуднів", "Chudniv")
    )

    /** Unmerged static streets; [ZtoeAddressLookup.ZTOE_STREETS] holds the merged view. */
    val STREETS_RAW: List<ZtoeStreetOption> = listOf(
        ZtoeStreetOption("zt_kyivska", "zt_city", 173934, "вул. Київська", "Kyivska St.", 4757),
        ZtoeStreetOption("zt_velyka_berdychivska", "zt_city", 174574, "вул. Велика Бердичівська", "Velyka Berdychivska St.", 4550),
        ZtoeStreetOption("zt_peremohy", "zt_city", 173948, "вул. Перемоги", "Peremohy St.", 4552),
        ZtoeStreetOption("zt_pokrovska", "zt_city", 173949, "вул. Покровська", "Pokrovska St.", 4789),
        ZtoeStreetOption("zt_chudnivska", "zt_city", 174543, "вул. Чуднівська", "Chudnivska St.", 4645),
        ZtoeStreetOption("zt_mykhailivska", "zt_city", 174152, "вул. Михайлівська", "Mykhailivska St.", 33622),
        ZtoeStreetOption("zt_vitruka", "zt_city", 174457, "вул. Вітрука", "Vitruka St.", 4620),
        ZtoeStreetOption("zt_bandery", "zt_city", 173952, "вул. Степана Бандери", "Stepana Bandery St.", 33488),
        ZtoeStreetOption("zt_shevchenka", "zt_city", 174478, "вул. Шевченка", "Shevchenka St.", 4625),
        ZtoeStreetOption("zt_dovzhenka", "zt_city", 174495, "вул. Довженка", "Dovzhenka St.", 4631),
        ZtoeStreetOption("zt_lesi", "zt_city", 173937, "вул. Лесі Українки", "Lesi Ukrainky St.", 4788),
        ZtoeStreetOption("zt_zhytomyrska_zar", "zt_zarichany", 41001, "вул. Житомирська", "Zhytomyrska St."),
        ZtoeStreetOption("zt_lisova_zar", "zt_zarichany", 41002, "вул. Лісова", "Lisova St."),
        ZtoeStreetOption("zt_centralna_ol", "zt_oliivka", 42001, "вул. Центральна", "Tsentralna St."),
        ZtoeStreetOption("zt_kyivske_shose_hl", "zt_hlybochytsia", 43001, "вул. Київське шосе", "Kyivske Hwy"),
        ZtoeStreetOption("zt_centralna_st", "zt_stanishivka", 44001, "вул. Центральна", "Tsentralna St."),
        ZtoeStreetOption("bd_ievropeiska", "bd_city", 51001, "вул. Європейська", "Yevropeiska St."),
        ZtoeStreetOption("bd_zhytomyrska", "bd_city", 51002, "вул. Житомирська", "Zhytomyrska St."),
        ZtoeStreetOption("bd_soborna", "bd_hryshkivtsi", 52001, "вул. Соборна", "Soborna St."),
        ZtoeStreetOption("kr_hrushevskoho", "kr_city", 61001, "вул. Грушевського", "Hrushevskoho St."),
        ZtoeStreetOption("kr_kyivska", "kr_city", 61002, "вул. Київська", "Kyivska St."),
        ZtoeStreetOption("zv_shevchenka", "zv_city", 71001, "вул. Шевченка", "Shevchenka St."),
        ZtoeStreetOption("zv_sobornosti", "zv_city", 71002, "вул. Соборності", "Sobornosti St."),
        ZtoeStreetOption("ml_hrushevskoho", "ml_city", 81001, "вул. Грушевського", "Hrushevskoho St."),
        ZtoeStreetOption("rd_velyka_zhytomyrska", "rd_city", 91001, "вул. Велика Житомирська", "Velyka Zhytomyrska St."),
        ZtoeStreetOption("an_soborna", "an_city", 101001, "вул. Соборна", "Soborna St."),
        ZtoeStreetOption("br_soborna", "br_city", 102001, "вул. Соборна", "Soborna St."),
        ZtoeStreetOption("bs_soborna", "bs_city", 103001, "вул. Соборна", "Soborna St."),
        ZtoeStreetOption("ks_soborna", "ks_city", 104001, "вул. Соборна", "Soborna St."),
        ZtoeStreetOption("lb_nezalezhnosti", "lb_city", 105001, "вул. Незалежності", "Nezalezhnosti St."),
        ZtoeStreetOption("ov_soborna", "ov_city", 106001, "вул. Соборна", "Soborna St."),
        ZtoeStreetOption("ol_sviato_mykolaivska", "ol_city", 107001, "вул. Свято-Миколаївська", "Sviato-Mykolaivska St."),
        ZtoeStreetOption("pp_khmelnytskoho", "pp_city", 108001, "вул. Богдана Хмельницького", "Bohdana Khmelnytskoho St."),
        ZtoeStreetOption("pl_nezalezhnosti", "pl_city", 109001, "вул. Незалежності", "Nezalezhnosti St."),
        ZtoeStreetOption("rm_nebesnoi_sotni", "rm_city", 110001, "вул. Небесної Сотні", "Nebesnoi Sotni St."),
        ZtoeStreetOption("kh_nezalezhnosti", "kh_city", 111001, "вул. Незалежності", "Nezalezhnosti St."),
        ZtoeStreetOption("ch_volodymyrska", "ch_city", 112001, "вул. Володимирська", "Volodymyrska St."),
        ZtoeStreetOption("cd_soborna", "cd_city", 113001, "вул. Соборна", "Soborna St.")
    )

    /** Street ids that were stored by earlier versions mapped to the current canonical id. */
    val LEGACY_STREET_IDS: Map<String, String> = mapOf(
        "zt_berdy" to "zt_velyka_berdychivska",
        "st_173952" to "zt_bandery",
        "zt_kyivska_hl" to "zt_kyivske_shose_hl",
        "zv_soborna" to "zv_sobornosti",
        "lb_soborna" to "lb_nezalezhnosti",
        "ol_soborna" to "ol_sviato_mykolaivska",
        "pp_soborna" to "pp_khmelnytskoho",
        "pl_soborna" to "pl_nezalezhnosti",
        "rm_soborna" to "rm_nebesnoi_sotni",
        "kh_soborna" to "kh_nezalezhnosti",
        "ch_soborna" to "ch_volodymyrska"
    )

    val LEGACY_SETTLEMENT_IDS: Map<String, String> = mapOf(
        "zt_глибочиця" to "zt_hlybochytsia"
    )
}
