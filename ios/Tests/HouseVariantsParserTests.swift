import XCTest
@testable import ZTPreBlackout

/// Mirror of android HouseVariantsParserTest.kt: a house listed in several ztoe rows
/// (spec/ADDRESS_KEY.md section 6). Rows copied from the live table of Zhytomyr city, 2026-11-17.
final class HouseVariantsParserTests: XCTestCase {

    override func setUp() {
        super.setUp()
        ZtoeAddressLookup.clearCacheForTesting()
    }

    override func tearDown() {
        ZtoeAddressLookup.clearCacheForTesting()
        super.tearDown()
    }

    private let header =
        "<tr><td align=\"center\">РЕМ</td><td align=\"center\">Населений пункт</td><td align=\"center\">Назва вулиці, провулка, тощо</td>" +
        "<td align=\"center\">Будинки</td><td align=\"center\">Черга</td><td align=\"center\">Підчерга</td><td align=\"center\">Примітка</td></tr>"

    private func row(_ street: String, _ houses: String, _ q: String, _ sub: String, _ consumer: String) -> String {
        "<tr><td align=\"center\">Житомирський</td><td align=\"center\">місто Житомир</td><td align=\"center\">\(street)</td>" +
            "<td align=\"center\">\(houses)</td><td align=\"center\">\(q)</td><td align=\"center\">\(sub)</td><td align=\"center\">\(consumer)</td></tr>"
    }

    private let household = "побутові споживачі"
    private let business = "непобутові (юридичні) споживачі"
    private let noOutage = "В цей час не вимикається, за винятком випадків аварійних відключень"

    private var myruHtml: String {
        "<table>\(header)" +
            row("проспект Миру", "21, 21-А, 15, 23, 19 а, 23-Б, 27, 19а", "1", "2", business) +
            row("проспект Миру", "21, 23", "5", "2", household) +
            row("проспект Миру", "23-А, 23-Б, 23 а, 23, 15-А, ТП-575, 21, 21-Г, 19-А", "5", "2", business) +
            row("проспект Миру", "25", "4", "1", household) +
            "</table>"
    }

    private var andriivskaHtml: String {
        "<table>\(header)" +
            row("вул. Андріївська", "1, 1А, 2А, 2Б, 3, 4, 5, 6, 7", noOutage, noOutage, household) +
            row("вул. Андріївська", "2, 4, 2-Б, 2-А, 6", "3", "1", business) +
            "</table>"
    }

    private let myru = ZtoeStreetOption(id: "st_174171", settlementId: "zt_city", ztoeVulicaId: 174171, nameUk: "проспект Миру", nameEn: "проспект Миру")
    private let andriivska = ZtoeStreetOption(id: "st_1", settlementId: "zt_city", ztoeVulicaId: 1, nameUk: "вул. Андріївська", nameEn: "вул. Андріївська")

    func testMyru23GetsTheHouseholdQueueAndKeepsBothQueues() throws {
        let houses = try XCTUnwrap(ZtoeAddressLookup.parseZtoeSettlementHousesTableHtml("zt_city", [myru], myruHtml)["st_174171"])
        let h23 = try XCTUnwrap(houses.first { $0.house == "23" })
        XCTAssertEqual(h23.queue, "5.2")
        XCTAssertNil(h23.statusText)
        XCTAssertTrue(h23.hasChoice)
        XCTAssertEqual(h23.choices.map(\.queue), ["5.2", "1.2"])
        XCTAssertEqual(h23.choices[0].consumers, [ConsumerType.HOUSEHOLD, ConsumerType.BUSINESS])
        let h25 = try XCTUnwrap(houses.first { $0.house == "25" })
        XCTAssertEqual(h25.queue, "4.1")
        XCTAssertFalse(h25.hasChoice)
        XCTAssertEqual(houses.first { $0.house == "27" }?.queue, "1.2")
    }

    func testHouseholdStatusWinsOverABusinessQueue() throws {
        let houses = try XCTUnwrap(ZtoeAddressLookup.parseZtoeSettlementHousesTableHtml("zt_city", [andriivska], andriivskaHtml)["st_1"])
        let h2a = try XCTUnwrap(houses.first { $0.house == "2А" })
        XCTAssertEqual(h2a.queue, "")
        XCTAssertEqual(h2a.statusText, noOutage)
        XCTAssertEqual(h2a.choices.map(\.queue), ["", "3.1"])
        let picked = h2a.withVariant(try XCTUnwrap(HouseVariants.pick(h2a.choices, preferredQueue: "3.1")))
        XCTAssertEqual(picked.queue, "3.1")
        XCTAssertNil(picked.statusText)
    }

    func testSingleStreetPageKeepsVariantsToo() {
        XCTAssertEqual(ZtoeAddressLookup.parseZtoeAddressLookupTableHtml(myruHtml, targetHouse: "23")?.queue, "5.2")
        XCTAssertEqual(ZtoeAddressLookup.parseZtoeAddressLookupTableHtml(andriivskaHtml, targetHouse: "2А")?.statusText, noOutage)
    }

    func testVariantsSurviveTheDiskCache() throws {
        ZtoeAddressLookup.parseZtoeSettlementHousesTableHtml("zt_city", [myru], myruHtml)
        let json = ZtoeAddressLookup.serializeCacheToJson()
        ZtoeAddressLookup.clearCacheForTesting()
        XCTAssertTrue(ZtoeAddressLookup.hydrateCacheFromJson(json))
        let h23 = try XCTUnwrap(ZtoeAddressLookup.getHousesForStreet("st_174171").first { $0.house == "23" })
        XCTAssertEqual(h23.queue, "5.2")
        XCTAssertEqual(h23.choices.map(\.queue), ["5.2", "1.2"])
    }

    func testSavedBefore141WithoutChoiceGetsTheHouseholdQueue() throws {
        // a 1.4.0 user at Миру 23 saved 1.2 (the old first-row bug); with no stored choice the default applies
        let houses = try XCTUnwrap(ZtoeAddressLookup.parseZtoeSettlementHousesTableHtml("zt_city", [myru], myruHtml)["st_174171"])
        let h23 = try XCTUnwrap(houses.first { $0.house == "23" })
        XCTAssertEqual(HouseVariants.pick(h23.choices, preferredQueue: nil)?.queue, "5.2")
        XCTAssertEqual(HouseVariants.pick(h23.choices, preferredQueue: "1.2", preferredConsumers: [ConsumerType.BUSINESS])?.queue, "1.2")
    }

    func testStoredChoiceRoundTrip() {
        let v = HouseVariant(queue: "1.2", statusText: nil, consumers: [ConsumerType.BUSINESS])
        HouseVariantChoices.put(streetId: "st_test", house: "23", variant: v)
        XCTAssertEqual(HouseVariantChoices.get(streetId: "st_test", house: "23"), v)
        HouseVariantChoices.put(streetId: "st_test", house: "23", variant: nil)
        XCTAssertNil(HouseVariantChoices.get(streetId: "st_test", house: "23"))
    }
}
