import XCTest
@testable import ZTPreBlackout

/// Mirror of android StreetDedupTest.kt (no network).
final class StreetDedupTests: XCTestCase {

    override func setUp() {
        super.setUp()
        ZtoeAddressLookup.clearCacheForTesting()
    }

    override func tearDown() {
        ZtoeAddressLookup.clearCacheForTesting()
        super.tearDown()
    }

    private func streetSelect(_ options: [(Int, String)]) -> String {
        "<select name=\"vulica_id\"><option value=\"0\">--Оберіть вулицю--</option>" +
            options.map { "<option value=\"\($0.0)\">\($0.1)</option>" }.joined() +
            "</select>"
    }

    private func single(_ streets: [ZtoeStreetOption], file: StaticString = #filePath, line: UInt = #line,
                        _ predicate: (ZtoeStreetOption) -> Bool) throws -> ZtoeStreetOption {
        let matches = streets.filter(predicate)
        XCTAssertEqual(matches.count, 1, file: file, line: line)
        return try XCTUnwrap(matches.first, file: file, line: line)
    }

    private func hydrate(streets: [String], houses: [String] = []) -> Bool {
        let json = "{\"version\":\(ZtoeAddressLookup.CACHE_VERSION),\"rems\":[],\"settlements\":[],\"streets\":[" +
            streets.joined(separator: ",") + "],\"houses\":[" + houses.joined(separator: ",") + "]}"
        return ZtoeAddressLookup.hydrateCacheFromJson(json)
    }

    // --- ztoe duplicates ---------------------------------------------------------------------

    func testZtoeDuplicatePairsMergeToOneOptionHoldingAllIds() throws {
        let html = streetSelect([
            (176316, "вул. В&#039;ячеслава Липинського"),
            (174295, "вул. В’ячеслава Липинського"),
            (174537, "вул. Закам&#039;янська"),
            (174536, "вул. Закам&#039;янська"),
            (176383, "вул. С.П. Корольова"),
            (176334, "вул. С.П.Корольова"),
            (173934, "вул. Київська")
        ])
        let streets = ZtoeAddressLookup.parseZtoeStreetOptionsHtml("zt_city", html)
        XCTAssertEqual(streets.count, 4, "3 duplicate pairs + 1 plain street")

        let lypynskoho = try single(streets) { StreetKey.of($0.nameUk) == StreetKey.of("вул. В'ячеслава Липинського") }
        XCTAssertEqual(Set(lypynskoho.allIds), ["st_176316", "st_174295"])
        XCTAssertEqual(Set(lypynskoho.ztoeVulicaIds), [176316, 174295])
        XCTAssertEqual(lypynskoho.id, "st_174295", "canonical id is the one with the lowest ztoe id")
        XCTAssertEqual(lypynskoho.ztoeVulicaId, 174295)
        XCTAssertEqual(lypynskoho.nameUk, "вул. В'ячеслава Липинського", "display name is the first name seen")

        let zakamianska = try single(streets) { StreetKey.of($0.nameUk) == StreetKey.of("вул. Закам'янська") }
        XCTAssertEqual(Set(zakamianska.allIds), ["st_174537", "st_174536"])
        XCTAssertEqual(Set(zakamianska.ztoeVulicaIds), [174537, 174536])

        let korolova = try single(streets) { StreetKey.of($0.nameUk) == StreetKey.of("вул. С.П. Корольова") }
        XCTAssertEqual(Set(korolova.allIds), ["st_176383", "st_176334"])
        XCTAssertEqual(korolova.nameUk, "вул. С.П. Корольова")

        let kyivska = try single(streets) { $0.id == "zt_kyivska" }
        XCTAssertEqual(kyivska.allIds, ["zt_kyivska"])
    }

    func testEveryMergedIdResolvesToTheSameOption() throws {
        let streets = ZtoeAddressLookup.parseZtoeStreetOptionsHtml(
            "zt_city",
            streetSelect([(176316, "вул. В'ячеслава Липинського"), (174295, "вул. В’ячеслава Липинського")])
        )
        XCTAssertEqual(streets.count, 1)
        let hydrated = hydrate(streets: streets.map {
            "{\"id\":\"\($0.id)\",\"settlementId\":\"zt_city\",\"ztoeVulicaId\":\($0.ztoeVulicaId),\"nameUk\":\"\($0.nameUk)\"," +
                "\"nameEn\":\"x\",\"allIds\":[\"st_176316\",\"st_174295\"],\"ztoeVulicaIds\":[176316,174295]}"
        })
        XCTAssertTrue(hydrated)
        let a = ZtoeAddressLookup.findStreetById("st_176316")
        let b = ZtoeAddressLookup.findStreetById("st_174295")
        XCTAssertNotNil(a)
        XCTAssertEqual(a, b)
        XCTAssertEqual(try XCTUnwrap(a).id, "st_174295")
        // a bare ztoe id without prefix also resolves
        XCTAssertEqual(ZtoeAddressLookup.findStreetById("176316")?.id, "st_174295")
    }

    func testOldCacheWithDuplicatesHealsOnHydrationAndHousesAreUnited() throws {
        let ok = hydrate(
            streets: [
                #"{"id":"st_176316","settlementId":"zt_city","ztoeVulicaId":176316,"nameUk":"вул. В'ячеслава Липинського","nameEn":"a"}"#,
                #"{"id":"st_174295","settlementId":"zt_city","ztoeVulicaId":174295,"nameUk":"вул. В’ячеслава Липинського","nameEn":"b"}"#,
                #"{"id":"st_555","settlementId":"zt_city","ztoeVulicaId":555,"nameUk":"вул. Інша","nameEn":"c"}"#
            ],
            houses: [
                #"{"streetId":"st_176316","house":"1","queue":"1.1"}"#,
                #"{"streetId":"st_176316","house":"34-А","queue":"2.1"}"#,
                #"{"streetId":"st_174295","house":"34А","queue":"2.1"}"#,
                #"{"streetId":"st_174295","house":"2","queue":"3.2"}"#
            ]
        )
        XCTAssertTrue(ok)
        let list = ZtoeAddressLookup.getStreetsForSettlement("zt_city")
        XCTAssertEqual(list.count, 2)
        let merged = try single(list) { $0.id == "st_174295" }
        XCTAssertEqual(merged.allIds, ["st_174295", "st_176316"])

        let viaCanonical = ZtoeAddressLookup.getHousesForStreet("st_174295")
        let viaDuplicate = ZtoeAddressLookup.getHousesForStreet("st_176316")
        XCTAssertEqual(viaCanonical, viaDuplicate)
        XCTAssertEqual(viaCanonical.map { $0.house }, ["1", "2", "34-А"], "union over both ids, 34-А and 34А are one house")
    }

    func testCacheOfAnotherVersionIsDiscarded() {
        let v1 = #"{"version":1,"rems":[],"settlements":[],"streets":[{"id":"st_1","settlementId":"zt_city","ztoeVulicaId":1,"nameUk":"вул. Стара","nameEn":"x"}],"houses":[]}"#
        XCTAssertFalse(ZtoeAddressLookup.hydrateCacheFromJson(v1))
        XCTAssertFalse(ZtoeAddressLookup.getStreetsForSettlement("zt_city").contains { $0.id == "st_1" })
        let noVersion = #"{"streets":[{"id":"st_1","settlementId":"zt_city","ztoeVulicaId":1,"nameUk":"вул. Стара","nameEn":"x"}]}"#
        XCTAssertFalse(ZtoeAddressLookup.hydrateCacheFromJson(noVersion))
    }

    func testSerializedCacheCarriesTheVersionAndMergedIds() {
        let streets = ZtoeAddressLookup.parseZtoeStreetOptionsHtml(
            "zt_city",
            streetSelect([(174537, "вул. Закам'янська"), (174536, "вул. Закам'янська")])
        )
        XCTAssertTrue(hydrate(streets: streets.map {
            "{\"id\":\"\($0.id)\",\"settlementId\":\"zt_city\",\"ztoeVulicaId\":\($0.ztoeVulicaId),\"nameUk\":\"\($0.nameUk)\"," +
                "\"nameEn\":\"x\",\"allIds\":[\"st_174537\",\"st_174536\"],\"ztoeVulicaIds\":[174537,174536]}"
        }))
        let json = ZtoeAddressLookup.serializeCacheToJson()
        XCTAssertTrue(json.contains("\"version\":\(ZtoeAddressLookup.CACHE_VERSION)"))
        ZtoeAddressLookup.clearCacheForTesting()
        XCTAssertTrue(ZtoeAddressLookup.hydrateCacheFromJson(json))
        let back = ZtoeAddressLookup.getStreetsForSettlement("zt_city")
        XCTAssertEqual(back.count, 1)
        XCTAssertEqual(Set(back[0].allIds), ["st_174537", "st_174536"])
        XCTAssertEqual(Set(back[0].ztoeVulicaIds), [174537, 174536])
    }

    // --- PowerOn style duplicates ------------------------------------------------------------

    private func poweron(_ id: Int, _ name: String) -> ZtoeStreetOption {
        ZtoeStreetOption(id: "p_\(id)", settlementId: "zt_city", ztoeVulicaId: id, nameUk: name, nameEn: name, poweronStreetId: id)
    }

    func testPoweronDuplicateNamesMerge() {
        let pairs: [(ZtoeStreetOption, ZtoeStreetOption)] = [
            (poweron(33798, "Житній Базар"), poweron(34709, "Житній базар")),
            (poweron(33382, "Закам’янська"), poweron(33565, "Закам’янська")),
            (poweron(33970, "В’ячеслава Липинського"), poweron(35135, "В’ячеслава Липинського")),
            (poweron(5650, "майдан С.П.Корольова"), poweron(6236, "майдан С.П.Корольова")),
            (poweron(33651, "пров. Єлизавети Епштейн "), poweron(33652, "пров. Єлизавети Епштейн"))
        ]
        for (a, b) in pairs {
            let merged = ZtoeAddressLookup.mergeStreets([a, b])
            XCTAssertEqual(merged.count, 1, "\(a.nameUk) / \(b.nameUk)")
            guard let m = merged.first else { continue }
            XCTAssertEqual(Set(m.poweronStreetIds), [a.poweronStreetId!, b.poweronStreetId!])
            XCTAssertEqual(Set(m.allIds), [a.id, b.id])
            XCTAssertEqual(m.nameUk, a.nameUk)
        }
        // different spellings of the same street group together with the ztoe form (apostrophe kinds)
        let mixed = ZtoeAddressLookup.mergeStreets([
            poweron(1, "В’ячеслава Липинського"), poweron(2, "В'ячеслава Липинського"), poweron(3, "В&#039;ячеслава Липинського")
        ])
        XCTAssertEqual(mixed.count, 1)
        XCTAssertEqual(mixed.first?.poweronStreetIds.count, 3)
    }

    func testMergeIsIdempotentAndKeepsDistinctStreetsApart() {
        let input = [
            poweron(1, "вул. Київська"),
            poweron(2, "пров. Київська"),
            poweron(3, "Київська"),
            poweron(4, "вул. Шевченка"),
            poweron(5, "вул. Тараса Шевченка")
        ]
        let once = ZtoeAddressLookup.mergeStreets(input)
        XCTAssertEqual(once.count, 5, "type and full name are part of the key")
        XCTAssertEqual(once, ZtoeAddressLookup.mergeStreets(once))
    }

    func testStreetsOfDifferentSettlementsAreNotMerged() {
        let a = ZtoeStreetOption(id: "a", settlementId: "zt_city", ztoeVulicaId: 1, nameUk: "вул. Соборна", nameEn: "x")
        let b = ZtoeStreetOption(id: "b", settlementId: "bd_city", ztoeVulicaId: 2, nameUk: "вул. Соборна", nameEn: "x")
        XCTAssertEqual(ZtoeAddressLookup.mergeStreets([a, b]).count, 2)
    }

    // --- houses ------------------------------------------------------------------------------

    func testHouseKeyEquivalenceForMergedHouseLists() {
        let forms = ["34-А", "34 А", "34А", "34A", "34а"]
        XCTAssertEqual(Set(forms.map { HouseKey.of($0) }).count, 1)
        XCTAssertEqual(HouseKey.of("14/а"), HouseKey.of("14/A"))
        XCTAssertNotEqual(HouseKey.of("1"), HouseKey.of("12"))

        let a = [ZtoeHouseLookupResult(house: "34-А", queue: "2.1"), ZtoeHouseLookupResult(house: "1", queue: "")]
        let b = [
            ZtoeHouseLookupResult(house: "34A", queue: "2.1"),
            ZtoeHouseLookupResult(house: "1", queue: "1.2"),
            ZtoeHouseLookupResult(house: "16А", queue: "4.1")
        ]
        let union = ZtoeAddressLookup.unionHouses(a, b)
        XCTAssertEqual(union.map { $0.house }, ["1", "16А", "34-А"])
        XCTAssertEqual(union.first(where: { $0.house == "1" })?.queue, "1.2", "a row with a queue replaces a row without")
    }

    private let bulkHeader = """
        <tr><td><b>РЕМ</b></td><td><b>Населений пункт</b></td><td><b>Назва вулиці</b></td>
        <td><b>Будинки</b></td><td><b>Черга</b></td><td><b>Підчерга</b></td><td><b>Примітка</b></td></tr>
        """

    private func bulkRow(_ street: String, _ houses: String, _ q: Int, _ sub: Int) -> String {
        "<tr><td>Житомирський</td><td>місто Житомир</td><td>\(street)</td><td>\(houses)</td><td>\(q)</td><td>\(sub)</td><td></td></tr>"
    }

    func testBulkRowsOfDuplicateSpellingsGoToOneStreetAndHousesAreUnited() throws {
        let streets = ZtoeAddressLookup.parseZtoeStreetOptionsHtml(
            "zt_city",
            streetSelect([(176316, "вул. В'ячеслава Липинського"), (174295, "вул. В’ячеслава Липинського")])
        )
        XCTAssertEqual(streets.count, 1)
        let html = "<table>\(bulkHeader)" +
            bulkRow("вул. В'ячеслава Липинського", "1, 3, 34-А", 1, 2) +
            bulkRow("вул. В’ячеслава Липинського", "3, 34А, 5", 1, 2) +
            "</table>"
        let map = ZtoeAddressLookup.parseZtoeSettlementHousesTableHtml("zt_city", streets, html)
        XCTAssertEqual(Set(map.keys), ["st_174295"])
        let houses = try XCTUnwrap(map["st_174295"])
        XCTAssertEqual(houses.map { $0.house }, ["1", "3", "5", "34-А"])
        XCTAssertEqual(houses, ZtoeAddressLookup.getHousesForStreet("st_174295"))
    }

    func testStreetNamesAreMatchedStrictlyNotBySubstring() {
        let streets = [ZtoeStreetOption(id: "zt_shevchenka", settlementId: "zt_city", ztoeVulicaId: 174478, nameUk: "вул. Шевченка", nameEn: "x")]
        let html = "<table>\(bulkHeader)" +
            bulkRow("вул. Тараса Шевченка", "1, 2", 1, 1) +
            bulkRow("вул. Шевченка", "7", 2, 2) +
            bulkRow("пров. Шевченка", "9", 3, 1) +
            "</table>"
        let map = ZtoeAddressLookup.parseZtoeSettlementHousesTableHtml("zt_city", streets, html)
        XCTAssertEqual(map["zt_shevchenka"]?.map { $0.house }, ["7"])
    }

    func testBareNameFallbackNeedsOneSideWithoutStreetType() {
        let streets = [ZtoeStreetOption(id: "zt_x", settlementId: "zt_city", ztoeVulicaId: 10, nameUk: "Київська", nameEn: "x")]
        let html = "<table>\(bulkHeader)" + bulkRow("вул. Київська", "4", 1, 1) + "</table>"
        let map = ZtoeAddressLookup.parseZtoeSettlementHousesTableHtml("zt_city", streets, html)
        XCTAssertEqual(map["zt_x"]?.map { $0.house }, ["4"])

        let typed = [ZtoeStreetOption(id: "zt_y", settlementId: "zt_city", ztoeVulicaId: 11, nameUk: "пров. Київський", nameEn: "x")]
        let html2 = "<table>\(bulkHeader)" + bulkRow("вул. Київський", "4", 1, 1) + "</table>"
        XCTAssertTrue(ZtoeAddressLookup.parseZtoeSettlementHousesTableHtml("zt_city", typed, html2).isEmpty)
    }

    // --- static directory, demo removal, names -----------------------------------------------

    func testStaticDirectoryHasNoDuplicatesAndNoFakeHouses() {
        let ids = ZtoeAddressLookup.ZTOE_STREETS.flatMap { $0.allIds }
        XCTAssertEqual(ids.count, Set(ids).count, "every static street id is unique")
        XCTAssertEqual(ZtoeAddressLookup.ZTOE_STREETS.filter { $0.ztoeVulicaId == 173952 }.count, 1)
        XCTAssertEqual(ZtoeAddressLookup.findStreetById("st_173952")?.id, "zt_bandery")

        XCTAssertEqual(ZtoeAddressLookup.findStreetById("lb_soborna")?.nameUk, "вул. Незалежності")
        XCTAssertEqual(ZtoeAddressLookup.findStreetById("lb_soborna")?.id, "lb_nezalezhnosti")
        XCTAssertEqual(ZtoeAddressLookup.findSettlementById("zt_глибочиця")?.nameUk, "с. Глибочиця")
        XCTAssertEqual(ZtoeAddressLookup.getStreetsForSettlement("zt_глибочиця").first?.settlementId, "zt_hlybochytsia")
        XCTAssertEqual(ZtoeAddressLookup.findStreetById("zt_berdy")?.id, "zt_velyka_berdychivska")

        // no default house list on the production path (the retired emergencyOutage field does not exist on iOS)
        for street in ZtoeAddressLookup.ZTOE_STREETS {
            XCTAssertTrue(ZtoeAddressLookup.getHousesForStreet(street.id).isEmpty)
        }
    }

    func testCityNamesAreComparedExactly() {
        XCTAssertEqual(ZtoeAddressLookup.cityKey("м. Житомир"), ZtoeAddressLookup.cityKey("місто Житомир"))
        XCTAssertEqual(ZtoeAddressLookup.cityKey("с. Кам'янка"), ZtoeAddressLookup.cityKey("село Кам’янка"))
        XCTAssertNotEqual(ZtoeAddressLookup.cityKey("Житомир"), ZtoeAddressLookup.cityKey("Житомирський"))
        XCTAssertNotEqual(ZtoeAddressLookup.cityKey("с. Зарічани"), ZtoeAddressLookup.cityKey("с. Нові Зарічани"))
    }

    /// Android also checks the test-only AddressFixtures demo emergency; that fixture is not ported
    /// (emergencies come from PowerOn), only the production-path half of the check is.
    func testDemoEmergencyFixtureLivesOnlyInTests() {
        XCTAssertFalse(ZtoeAddressLookup.getHousesForStreet("zt_kyivska").contains { $0.house == "37" })
    }
}
