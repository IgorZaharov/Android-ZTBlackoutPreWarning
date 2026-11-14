import Foundation

/// Offline fallback directory of REMs, settlements and a few Zhytomyr streets. It is used only until
/// the live index from ztoe.com.ua is loaded. It holds no house numbers and no outages: the old
/// default house lists and the demo emergency were removed from the production path.
///
/// Street ids must agree with the street name (a persisted selection keeps its id). Ids that used to
/// disagree with their name are listed in `LEGACY_STREET_IDS` and `LEGACY_SETTLEMENT_IDS`.
///
/// Mirror of android data/parser/ZtoeStaticDirectory.kt. The REM table equals spec/rems.json
/// (ztoe rem_id and PowerOn otg.id are different id spaces).
enum ZtoeStaticDirectory {
    private static func rem(_ id: String, _ ztoeRemId: Int, _ nameUk: String, _ nameEn: String, _ ztoeOtgId: Int) -> ZtoeRemOption {
        ZtoeRemOption(id: id, ztoeRemId: ztoeRemId, nameUk: nameUk, nameEn: nameEn, ztoeOtgId: ztoeOtgId)
    }

    private static func settlement(
        _ id: String, _ remId: String, _ ztoeNaspunktId: Int, _ nameUk: String, _ nameEn: String, _ poweronCityId: Int? = nil
    ) -> ZtoeSettlementOption {
        ZtoeSettlementOption(id: id, remId: remId, ztoeNaspunktId: ztoeNaspunktId, nameUk: nameUk, nameEn: nameEn, poweronCityId: poweronCityId)
    }

    private static func street(
        _ id: String, _ settlementId: String, _ ztoeVulicaId: Int, _ nameUk: String, _ nameEn: String, _ poweronStreetId: Int? = nil
    ) -> ZtoeStreetOption {
        ZtoeStreetOption(
            id: id, settlementId: settlementId, ztoeVulicaId: ztoeVulicaId,
            nameUk: nameUk, nameEn: nameEn, poweronStreetId: poweronStreetId
        )
    }

    static let REMS: [ZtoeRemOption] = [
        rem("zhytomyr", 7, "Житомирський РЕМ", "Zhytomyr REM", 6),
        rem("berdychiv", 3, "Бердичівський РЕМ", "Berdychiv REM", 3),
        rem("korosten", 9, "Коростенський РЕМ", "Korosten REM", 7),
        rem("zviahel", 16, "Звягельський РЕМ", "Zviahel REM", 11),
        rem("malyn", 14, "Малинський РЕМ", "Malyn REM", 10),
        rem("radomyshl", 20, "Радомишльський РЕМ", "Radomyshl REM", 15),
        rem("andrushivka", 1, "Андрушівський РЕМ", "Andrushivka REM", 1),
        rem("baranivka", 2, "Баранівський РЕМ", "Baranivka REM", 2),
        rem("brusyliv", 4, "Брусилівський РЕМ", "Brusyliv REM", 4),
        rem("korostyshiv", 11, "Коростишівський РЕМ", "Korostyshiv REM", 8),
        rem("liubar", 13, "Любарський РЕМ", "Liubar REM", 9),
        rem("ovruch", 17, "Овруцький РЕМ", "Ovruch REM", 12),
        rem("olevsk", 18, "Олевський РЕМ", "Olevsk REM", 13),
        rem("popilnia", 19, "Попільнянський РЕМ", "Popilnia REM", 14),
        rem("pulyny", 23, "Пулинський РЕМ", "Pulyny REM", 17),
        rem("romaniv", 21, "Романівський РЕМ", "Romaniv REM", 16),
        rem("khoroshiv", 5, "Хорошівський РЕМ", "Khoroshiv REM", 5),
        rem("cherniakhiv", 24, "Черняхівський РЕМ", "Cherniakhiv REM", 18),
        rem("chudniv", 25, "Чуднівський РЕМ", "Chudniv REM", 19)
    ]

    static let SETTLEMENTS: [ZtoeSettlementOption] = [
        settlement("zt_city", "zhytomyr", 16657, "м. Житомир", "Zhytomyr", 333),
        settlement("zt_zarichany", "zhytomyr", 16670, "с. Зарічани", "Zarichany"),
        settlement("zt_oliivka", "zhytomyr", 16700, "с. Оліївка", "Oliivka"),
        settlement("zt_hlybochytsia", "zhytomyr", 16667, "с. Глибочиця", "Hlybochytsia"),
        settlement("zt_stanishivka", "zhytomyr", 16680, "с. Станишівка", "Stanyshivka"),
        settlement("bd_city", "berdychiv", 16758, "м. Бердичів", "Berdychiv"),
        settlement("bd_hryshkivtsi", "berdychiv", 16760, "смт Гришківці", "Hryshkivtsi"),
        settlement("kr_city", "korosten", 17062, "м. Коростень", "Korosten"),
        settlement("zv_city", "zviahel", 16823, "м. Звягель", "Zviahel"),
        settlement("ml_city", "malyn", 17634, "м. Малин", "Malyn"),
        settlement("rd_city", "radomyshl", 17899, "м. Радомишль", "Radomyshl"),
        settlement("an_city", "andrushivka", 17694, "м. Андрушівка", "Andrushivka"),
        settlement("br_city", "baranivka", 15417, "м. Баранівка", "Baranivka"),
        settlement("bs_city", "brusyliv", 16202, "селище Брусилів", "Brusyliv"),
        settlement("ks_city", "korostyshiv", 15747, "м. Коростишів", "Korostyshiv"),
        settlement("lb_city", "liubar", 17742, "селище Любар", "Liubar"),
        settlement("ov_city", "ovruch", 17197, "м. Овруч", "Ovruch"),
        settlement("ol_city", "olevsk", 17823, "м. Олевськ", "Olevsk"),
        settlement("pp_city", "popilnia", 17555, "селище Попільня", "Popilnia"),
        settlement("pl_city", "pulyny", 16602, "селище Пулини", "Pulyny"),
        settlement("rm_city", "romaniv", 17968, "селище Романів", "Romaniv"),
        settlement("kh_city", "khoroshiv", 16281, "селище Хорошів", "Khoroshiv"),
        settlement("ch_city", "cherniakhiv", 16063, "селище Черняхів", "Cherniakhiv"),
        settlement("cd_city", "chudniv", 18001, "м. Чуднів", "Chudniv")
    ]

    /// Unmerged static streets; `ZtoeAddressLookup.ZTOE_STREETS` holds the merged view.
    static let STREETS_RAW: [ZtoeStreetOption] = [
        street("zt_kyivska", "zt_city", 173934, "вул. Київська", "Kyivska St.", 4757),
        street("zt_velyka_berdychivska", "zt_city", 174574, "вул. Велика Бердичівська", "Velyka Berdychivska St.", 4550),
        street("zt_peremohy", "zt_city", 173948, "вул. Перемоги", "Peremohy St.", 4552),
        street("zt_pokrovska", "zt_city", 173949, "вул. Покровська", "Pokrovska St.", 4789),
        street("zt_chudnivska", "zt_city", 174543, "вул. Чуднівська", "Chudnivska St.", 4645),
        street("zt_mykhailivska", "zt_city", 174152, "вул. Михайлівська", "Mykhailivska St.", 33622),
        street("zt_vitruka", "zt_city", 174457, "вул. Вітрука", "Vitruka St.", 4620),
        street("zt_bandery", "zt_city", 173952, "вул. Степана Бандери", "Stepana Bandery St.", 33488),
        street("zt_shevchenka", "zt_city", 174478, "вул. Шевченка", "Shevchenka St.", 4625),
        street("zt_dovzhenka", "zt_city", 174495, "вул. Довженка", "Dovzhenka St.", 4631),
        street("zt_lesi", "zt_city", 173937, "вул. Лесі Українки", "Lesi Ukrainky St.", 4788),
        street("zt_zhytomyrska_zar", "zt_zarichany", 41001, "вул. Житомирська", "Zhytomyrska St."),
        street("zt_lisova_zar", "zt_zarichany", 41002, "вул. Лісова", "Lisova St."),
        street("zt_centralna_ol", "zt_oliivka", 42001, "вул. Центральна", "Tsentralna St."),
        street("zt_kyivske_shose_hl", "zt_hlybochytsia", 43001, "вул. Київське шосе", "Kyivske Hwy"),
        street("zt_centralna_st", "zt_stanishivka", 44001, "вул. Центральна", "Tsentralna St."),
        street("bd_ievropeiska", "bd_city", 51001, "вул. Європейська", "Yevropeiska St."),
        street("bd_zhytomyrska", "bd_city", 51002, "вул. Житомирська", "Zhytomyrska St."),
        street("bd_soborna", "bd_hryshkivtsi", 52001, "вул. Соборна", "Soborna St."),
        street("kr_hrushevskoho", "kr_city", 61001, "вул. Грушевського", "Hrushevskoho St."),
        street("kr_kyivska", "kr_city", 61002, "вул. Київська", "Kyivska St."),
        street("zv_shevchenka", "zv_city", 71001, "вул. Шевченка", "Shevchenka St."),
        street("zv_sobornosti", "zv_city", 71002, "вул. Соборності", "Sobornosti St."),
        street("ml_hrushevskoho", "ml_city", 81001, "вул. Грушевського", "Hrushevskoho St."),
        street("rd_velyka_zhytomyrska", "rd_city", 91001, "вул. Велика Житомирська", "Velyka Zhytomyrska St."),
        street("an_soborna", "an_city", 101001, "вул. Соборна", "Soborna St."),
        street("br_soborna", "br_city", 102001, "вул. Соборна", "Soborna St."),
        street("bs_soborna", "bs_city", 103001, "вул. Соборна", "Soborna St."),
        street("ks_soborna", "ks_city", 104001, "вул. Соборна", "Soborna St."),
        street("lb_nezalezhnosti", "lb_city", 105001, "вул. Незалежності", "Nezalezhnosti St."),
        street("ov_soborna", "ov_city", 106001, "вул. Соборна", "Soborna St."),
        street("ol_sviato_mykolaivska", "ol_city", 107001, "вул. Свято-Миколаївська", "Sviato-Mykolaivska St."),
        street("pp_khmelnytskoho", "pp_city", 108001, "вул. Богдана Хмельницького", "Bohdana Khmelnytskoho St."),
        street("pl_nezalezhnosti", "pl_city", 109001, "вул. Незалежності", "Nezalezhnosti St."),
        street("rm_nebesnoi_sotni", "rm_city", 110001, "вул. Небесної Сотні", "Nebesnoi Sotni St."),
        street("kh_nezalezhnosti", "kh_city", 111001, "вул. Незалежності", "Nezalezhnosti St."),
        street("ch_volodymyrska", "ch_city", 112001, "вул. Володимирська", "Volodymyrska St."),
        street("cd_soborna", "cd_city", 113001, "вул. Соборна", "Soborna St.")
    ]

    /// Street ids that were stored by earlier versions mapped to the current canonical id.
    static let LEGACY_STREET_IDS: [String: String] = [
        "zt_berdy": "zt_velyka_berdychivska",
        "st_173952": "zt_bandery",
        "zt_kyivska_hl": "zt_kyivske_shose_hl",
        "zv_soborna": "zv_sobornosti",
        "lb_soborna": "lb_nezalezhnosti",
        "ol_soborna": "ol_sviato_mykolaivska",
        "pp_soborna": "pp_khmelnytskoho",
        "pl_soborna": "pl_nezalezhnosti",
        "rm_soborna": "rm_nebesnoi_sotni",
        "kh_soborna": "kh_nezalezhnosti",
        "ch_soborna": "ch_volodymyrska"
    ]

    static let LEGACY_SETTLEMENT_IDS: [String: String] = [
        "zt_глибочиця": "zt_hlybochytsia"
    ]
}
