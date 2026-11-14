import XCTest
@testable import ZTPreBlackout

/// Port of android/app/src/test/java/ua/blackout/prewarning/ui/PickerSearchTest.kt (no vector file exists).
final class PickerSearchTests: XCTestCase {

    private func search(_ items: [String], _ query: String, _ kind: PickerSearch.Kind = .TEXT) -> [String] {
        PickerSearch.filter(items, query: query, kind: kind) { $0 }
    }

    // ---- ranking ----

    func testPrefixBeatsWordPrefixBeatsContains() {
        let items = ["вул. Пушкіна", "вул. Старошевченківська", "вул. Нова Шевченка", "вул. Шевченка"]
        XCTAssertEqual(
            ["вул. Шевченка", "вул. Нова Шевченка", "вул. Пушкіна", "вул. Старошевченківська"],
            search(items, "ш")
        )
    }

    func testRankConstantsAreOrdered() {
        XCTAssertEqual(PickerSearch.PREFIX, PickerSearch.rank("ш", "Шевченка"))
        XCTAssertEqual(PickerSearch.WORD_PREFIX, PickerSearch.rank("ш", "Нова Шевченка"))
        XCTAssertEqual(PickerSearch.CONTAINS, PickerSearch.rank("ш", "Пушкіна"))
        XCTAssertEqual(PickerSearch.NO_MATCH, PickerSearch.rank("ш", "Київська"))
    }

    func testEmptyQueryKeepsEveryItemInOriginalOrder() {
        let items = ["Б", "А", "В"]
        XCTAssertEqual(items, search(items, ""))
        XCTAssertEqual(items, search(items, "   "))
    }

    func testNoMatchGivesEmptyList() {
        XCTAssertTrue(search(["вул. Шевченка", "вул. Київська"], "яяя").isEmpty)
    }

    func testOriginalOrderIsKeptInsideOneRank() {
        let items = ["вул. Шевченка 2", "вул. Шевченка 1", "вул. Шевченка"]
        XCTAssertEqual(items, search(items, "шев"))
    }

    // ---- prefixes and case ----

    func testStreetTypePrefixIsOptionalOnBothSides() {
        let items = ["вул. Шевченка", "пров. Шевченка", "м. Житомир", "с. Березина"]
        XCTAssertEqual(["вул. Шевченка", "пров. Шевченка"], search(items, "шевч"))
        XCTAssertEqual(["пров. Шевченка", "вул. Шевченка"], search(["вул. Шевченка", "пров. Шевченка"].reversed(), "пров шевч"))
        XCTAssertEqual(["вул. Шевченка", "пров. Шевченка"], search(items, "вул шевч"))
        XCTAssertEqual(["вул. Шевченка", "пров. Шевченка"], search(items, "вул. шевч"))
        XCTAssertEqual(["вулиця Шевченка"], search(["вулиця Шевченка"], "Шевч"))
        XCTAssertEqual(["м. Житомир"], search(items, "жито"))
        XCTAssertEqual(["с. Березина"], search(items, "берез"))
        XCTAssertEqual(["с. Березина"], search(items, "с берез"))
    }

    func testCaseDoesNotMatter() {
        XCTAssertEqual(["Шевченка"], search(["Шевченка", "Київська"], "ШЕВ"))
        XCTAssertEqual(["ШЕВЧЕНКА"], search(["ШЕВЧЕНКА"], "шев"))
    }

    func testTypeWordAloneStillMatchesByFullKey() {
        XCTAssertEqual(["вул. Шевченка"], search(["вул. Шевченка", "пров. Шевченка"], "вул"))
    }

    // ---- apostrophes ----

    func testEveryApostropheVariantMatchesEveryOther() {
        let variants = ["'", "’", "ʼ", "`", "´", "‘"]
        for inLabel in variants {
            let label = "вул. Пр\(inLabel)ятна"
            for typed in variants {
                XCTAssertEqual([label], search([label], "пр\(typed)я"), "label \(inLabel) typed \(typed)")
            }
            XCTAssertEqual([label], search([label], "пря"))
        }
        XCTAssertEqual(["вул. Пр'ятна"], search(["вул. Пр'ятна"], "прʼ"))
    }

    func testApostropheEntityInLabelIsDecoded() {
        XCTAssertEqual(["с. Кам&#039;янка"], search(["с. Кам&#039;янка"], "кам'я"))
    }

    // ---- Latin / Cyrillic look-alikes and diacritics ----

    func testLatinLookAlikesMatchCyrillicLabels() {
        XCTAssertEqual(["вул. Хрещатик"], search(["вул. Хрещатик", "вул. Київська"], "Xpe"))
        XCTAssertEqual(["вул. Садова"], search(["вул. Садова", "вул. Київська"], "Cад"))
    }

    func testCyrillicLookAlikesMatchLatinLabels() {
        XCTAssertEqual(["Pocket"], search(["Pocket", "Other"], "Ро"))
    }

    func testDiacriticsAreIgnored() {
        XCTAssertEqual(["вул. Київська"], search(["вул. Київська", "вул. Шевченка"], "киів"))
        XCTAssertEqual(["вул. Київська"], search(["вул. Київська", "вул. Шевченка"], "київ"))
        XCTAssertEqual(["вул. Військова"], search(["вул. Військова"], "віи"))
        XCTAssertEqual(["Café"], search(["Café", "Other"], "cafe"))
    }

    // ---- houses ----

    func testHouseLatinAMatchesCyrillicA() {
        let houses = ["15", "16", "16А", "16Б", "160"]
        XCTAssertEqual(["16А"], search(houses, "16a", .HOUSE))
        XCTAssertEqual(["16А"], search(houses, "16А", .HOUSE))
        XCTAssertEqual(["16Б"], search(houses, "16б", .HOUSE))
    }

    func testHouseHyphenSpaceAndPrefixWordsAreIgnored() {
        XCTAssertEqual(["34-А"], search(["34-А", "34", "340"], "34a", .HOUSE).filter { $0.contains("А") })
        XCTAssertEqual(["34-А"], search(["34-А"], "34 а", .HOUSE))
        XCTAssertEqual(["34-А"], search(["34-А"], "буд. 34а", .HOUSE))
        XCTAssertEqual(["14/а"], search(["14/а", "15"], "14/a", .HOUSE))
    }

    func testHouseNumberListsShortestFirst() {
        let houses = ["1600", "16А", "216", "16", "161", "26"]
        XCTAssertEqual(["16", "16А", "161", "1600", "216"], search(houses, "16", .HOUSE))
    }

    func testHouseQueryNeverMatchesTextAcrossWordsInTextMode() {
        XCTAssertEqual(["вул. Садова"], search(["вул. Садова", "вул. Сонячна"], "сад"))
        XCTAssertEqual(["вул. Сонячна"], search(["вул. Садова", "вул. Сонячна"], "сон"))
    }

    // ---- index ----

    func testIndexCanBeReusedForManyQueries() {
        let items = (1...966).map { "вул. Вулиця\($0)" }
        let index = PickerSearch.Index(items) { $0 }
        XCTAssertEqual(966, index.search("").count)
        XCTAssertEqual(1, index.search("вулиця966").count)
        XCTAssertEqual(["вул. Вулиця9"], Array(index.search("вулиця9").prefix(1)))
    }
}
