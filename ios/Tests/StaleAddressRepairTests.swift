import XCTest
@testable import ZTPreBlackout

/// Mirror of android StaleAddressRepairTest.kt (spec/ADDRESS_KEY.md section 7): saved addresses follow ztoe's
/// renumbering of settlements and streets. The street list is seeded with a fresh bulk time, so no test reaches the network.
final class StaleAddressRepairTests: XCTestCase {

    override func setUp() {
        super.setUp()
        ZtoeAddressLookup.clearCacheForTesting()
    }

    override func tearDown() {
        ZtoeAddressLookup.clearCacheForTesting()
        super.tearDown()
    }

    private func street(_ id: String, _ vul: Int, _ name: String) -> String {
        "{\"id\":\"\(id)\",\"settlementId\":\"zt_city\",\"ztoeVulicaId\":\(vul),\"nameUk\":\"\(name)\"}"
    }

    /// The current street list of Житомир, read a minute ago.
    private func seedCurrent(_ streets: String...) {
        let now = Int64(Date().timeIntervalSince1970 * 1000) - 60_000
        let json = "{\"version\":\(ZtoeAddressLookup.CACHE_VERSION),\"streets\":[\(streets.joined(separator: ","))],\"bulkAt\":{\"zt_city\":\(now)}}"
        XCTAssertTrue(ZtoeAddressLookup.hydrateCacheFromJson(json))
    }

    private func check(_ streetId: String, _ streetName: String) async -> ZtoeAddressLookup.SavedStreet {
        await ZtoeAddressLookup.checkSavedStreet(remId: "zhytomyr", settlementId: "zt_city", settlementNameHint: "м. Житомир",
                                                 streetId: streetId, streetName: streetName)
    }

    func testAStreetOnTheCurrentListIsCurrent() async {
        seedCurrent(street("st_195700", 195700, "вул. Небесної Сотні"))
        let result = await check("st_195700", "вул. Небесної Сотні")
        XCTAssertEqual(result, .current)
    }

    func testARenumberedStreetIsFoundAgainByItsSavedName() async {
        seedCurrent(street("st_195700", 195700, "вул. Небесної Сотні"), street("st_195701", 195701, "вул. Пушкінська"))
        let result = await check("st_174100", "вулиця Небесної Сотні")
        XCTAssertEqual(result, .moved(settlementId: "zt_city", settlementName: "м. Житомир", streetId: "st_195700", streetName: "вул. Небесної Сотні"))
    }

    func testWithoutASavedNameTheStreetIsLost() async {
        seedCurrent(street("st_195700", 195700, "вул. Небесної Сотні"))
        let result = await check("st_174100", "")
        XCTAssertEqual(result, .lost)
    }

    func testANameThatIsNotOnTheListIsLost() async {
        seedCurrent(street("st_195700", 195700, "вул. Садова"), street("st_195900", 195900, "вул. Садова "))
        // the two spellings of one street merge (spec/ADDRESS_KEY.md section 5), so the name still finds one street
        let sadova = await check("st_174100", "вулиця Садова")
        if case .moved = sadova {} else { XCTFail("expected moved, got \(sadova)") }
        let other = await check("st_174100", "вул. Інша")
        XCTAssertEqual(other, .lost)
    }

    func testTheNameOfADiscardedOldCacheStillRepairs() async {
        // a cache of version 4 (before the renumbering) is discarded, but its street names are kept
        let old = "{\"version\":4,\"streets\":[{\"id\":\"st_174100\",\"settlementId\":\"zt_city\",\"ztoeVulicaId\":174100,\"nameUk\":\"вул. Небесної Сотні\",\"allIds\":[\"st_174100\",\"st_174101\"]}]}"
        XCTAssertFalse(ZtoeAddressLookup.hydrateCacheFromJson(old))
        seedCurrent(street("st_195700", 195700, "вул. Небесної Сотні"))
        let result = await check("st_174101", "")
        guard case let .moved(_, _, streetId, _) = result else { return XCTFail("expected moved, got \(result)") }
        XCTAssertEqual(streetId, "st_195700")
        // and they survive the next write of the cache
        let names = ZtoeAddressLookup.serializeCacheToObject()["legacyStreetNames"] as? [String: String]
        XCTAssertEqual(names?["st_174101"], "вул. Небесної Сотні")
    }

    func testWithoutAFreshStreetListNothingIsDecided() async {
        // the list is not current and the site can not be asked (an unknown REM id): no verdict, no change
        let result = await ZtoeAddressLookup.checkSavedStreet(remId: "no_rem", settlementId: "zt_city", settlementNameHint: "м. Житомир",
                                                              streetId: "st_174100", streetName: "вул. Небесної Сотні")
        XCTAssertEqual(result, .unknown)
    }

    func testSettlementsMatchByNameOnlyWhenUnique() {
        let list = [
            ZtoeSettlementOption(id: "np_18544", remId: "zhytomyr", ztoeNaspunktId: 18544, nameUk: "м. Житомир", nameEn: "м. Житомир"),
            ZtoeSettlementOption(id: "np_18600", remId: "zhytomyr", ztoeNaspunktId: 18600, nameUk: "с. Тетерівка", nameEn: "с. Тетерівка"),
            ZtoeSettlementOption(id: "np_18601", remId: "zhytomyr", ztoeNaspunktId: 18601, nameUk: "с. Тетерівка", nameEn: "с. Тетерівка")
        ]
        XCTAssertEqual(ZtoeAddressLookup.matchSettlementByName("місто Житомир", list)?.id, "np_18544")
        XCTAssertNil(ZtoeAddressLookup.matchSettlementByName("с. Тетерівка", list))
        XCTAssertNil(ZtoeAddressLookup.matchSettlementByName("", list))
    }

    func testAddressTextKeepsTheStreetOrIsEmpty() {
        XCTAssertEqual(ZtoeAddressLookup.addressText("Житомирський РЕМ", "м. Житомир", "вул. Київська", " 10 "),
                       "Житомирський РЕМ, м. Житомир,\nвул. Київська, буд. 10")
        XCTAssertEqual(ZtoeAddressLookup.addressText("Житомирський РЕМ", "м. Житомир", " ", "10"), "")
        XCTAssertEqual(ZtoeAddressLookup.settlementNameFromText("Житомирський РЕМ, м. Житомир,\n, буд. 10"), "м. Житомир")
        XCTAssertEqual(ZtoeAddressLookup.settlementNameFromText("Київська 10"), "")
    }
}
