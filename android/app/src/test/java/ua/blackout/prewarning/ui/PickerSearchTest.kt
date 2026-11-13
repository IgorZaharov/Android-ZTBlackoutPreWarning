package ua.blackout.prewarning.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import ua.blackout.prewarning.ui.components.PickerSearch
import ua.blackout.prewarning.ui.components.PickerSearch.Kind

class PickerSearchTest {

    private fun streets(vararg labels: String) = labels.toList()

    private fun search(items: List<String>, query: String, kind: Kind = Kind.TEXT) =
        PickerSearch.filter(items, query, kind) { it }

    // ---- ranking ----

    @Test
    fun prefixBeatsWordPrefixBeatsContains() {
        val items = streets("вул. Пушкіна", "вул. Старошевченківська", "вул. Нова Шевченка", "вул. Шевченка")
        // "ш": prefix (Шевченка), word prefix (Нова Шевченка), contains (Пушкіна, Старошевченківська)
        val hits = search(items, "ш")
        assertEquals(
            listOf("вул. Шевченка", "вул. Нова Шевченка", "вул. Пушкіна", "вул. Старошевченківська"),
            hits
        )
    }

    @Test
    fun rankConstantsAreOrdered() {
        assertEquals(PickerSearch.PREFIX, PickerSearch.rank("ш", "Шевченка"))
        assertEquals(PickerSearch.WORD_PREFIX, PickerSearch.rank("ш", "Нова Шевченка"))
        assertEquals(PickerSearch.CONTAINS, PickerSearch.rank("ш", "Пушкіна"))
        assertEquals(PickerSearch.NO_MATCH, PickerSearch.rank("ш", "Київська"))
    }

    @Test
    fun emptyQueryKeepsEveryItemInOriginalOrder() {
        val items = streets("Б", "А", "В")
        assertEquals(items, search(items, ""))
        assertEquals(items, search(items, "   "))
    }

    @Test
    fun noMatchGivesEmptyList() {
        assertTrue(search(streets("вул. Шевченка", "вул. Київська"), "яяя").isEmpty())
    }

    @Test
    fun originalOrderIsKeptInsideOneRank() {
        val items = streets("вул. Шевченка 2", "вул. Шевченка 1", "вул. Шевченка")
        assertEquals(items, search(items, "шев"))
    }

    // ---- prefixes and case ----

    @Test
    fun streetTypePrefixIsOptionalOnBothSides() {
        val items = streets("вул. Шевченка", "пров. Шевченка", "м. Житомир", "с. Березина")
        assertEquals(listOf("вул. Шевченка", "пров. Шевченка"), search(items, "шевч"))
        // a typed type word ranks the same type first, the other type still matches by its name
        assertEquals(listOf("пров. Шевченка", "вул. Шевченка"), search(streets("вул. Шевченка", "пров. Шевченка").reversed(), "пров шевч"))
        assertEquals(listOf("вул. Шевченка", "пров. Шевченка"), search(items, "вул шевч"))
        assertEquals(listOf("вул. Шевченка", "пров. Шевченка"), search(items, "вул. шевч"))
        assertEquals(listOf("вулиця Шевченка"), search(streets("вулиця Шевченка"), "Шевч"))
        assertEquals(listOf("м. Житомир"), search(items, "жито"))
        assertEquals(listOf("с. Березина"), search(items, "берез"))
        assertEquals(listOf("с. Березина"), search(items, "с берез"))
    }

    @Test
    fun caseDoesNotMatter() {
        assertEquals(listOf("Шевченка"), search(streets("Шевченка", "Київська"), "ШЕВ"))
        assertEquals(listOf("ШЕВЧЕНКА"), search(streets("ШЕВЧЕНКА"), "шев"))
    }

    @Test
    fun typeWordAloneStillMatchesByFullKey() {
        val items = streets("вул. Шевченка", "пров. Шевченка")
        assertEquals(listOf("вул. Шевченка"), search(items, "вул"))
    }

    // ---- apostrophes ----

    @Test
    fun everyApostropheVariantMatchesEveryOther() {
        val variants = listOf("'", "’", "ʼ", "`", "´", "‘")
        for (inLabel in variants) {
            val label = "вул. Пр${inLabel}ятна"
            for (typed in variants) {
                assertEquals("label $inLabel typed $typed", listOf(label), search(streets(label), "пр${typed}я"))
            }
            // and no apostrophe at all
            assertEquals(listOf(label), search(streets(label), "пря"))
        }
        assertEquals(listOf("вул. Пр'ятна"), search(streets("вул. Пр'ятна"), "прʼ"))
    }

    @Test
    fun apostropheEntityInLabelIsDecoded() {
        assertEquals(listOf("с. Кам&#039;янка"), search(streets("с. Кам&#039;янка"), "кам'я"))
    }

    // ---- Latin / Cyrillic look-alikes and diacritics ----

    @Test
    fun latinLookAlikesMatchCyrillicLabels() {
        // x, p, e, a, c ... typed with the Latin keyboard
        assertEquals(listOf("вул. Хрещатик"), search(streets("вул. Хрещатик", "вул. Київська"), "Xpe"))
        assertEquals(listOf("вул. Садова"), search(streets("вул. Садова", "вул. Київська"), "Cад"))
    }

    @Test
    fun cyrillicLookAlikesMatchLatinLabels() {
        assertEquals(listOf("Pocket"), search(streets("Pocket", "Other"), "Ро"))
    }

    @Test
    fun diacriticsAreIgnored() {
        assertEquals(listOf("вул. Київська"), search(streets("вул. Київська", "вул. Шевченка"), "киів"))
        assertEquals(listOf("вул. Київська"), search(streets("вул. Київська", "вул. Шевченка"), "київ"))
        assertEquals(listOf("вул. Військова"), search(streets("вул. Військова"), "віи"))
        assertEquals(listOf("Café"), search(streets("Café", "Other"), "cafe"))
    }

    // ---- houses ----

    @Test
    fun houseLatinAMatchesCyrillicA() {
        val houses = streets("15", "16", "16А", "16Б", "160")
        val hits = search(houses, "16a", Kind.HOUSE)
        assertEquals(listOf("16А"), hits)
        assertEquals(listOf("16А"), search(houses, "16А", Kind.HOUSE))
        assertEquals(listOf("16Б"), search(houses, "16б", Kind.HOUSE))
    }

    @Test
    fun houseHyphenSpaceAndPrefixWordsAreIgnored() {
        val houses = streets("34-А", "34", "340")
        assertEquals(listOf("34-А"), search(houses, "34a", Kind.HOUSE).filter { it.contains("А") })
        assertEquals(listOf("34-А"), search(streets("34-А"), "34 а", Kind.HOUSE))
        assertEquals(listOf("34-А"), search(streets("34-А"), "буд. 34а", Kind.HOUSE))
        assertEquals(listOf("14/а"), search(streets("14/а", "15"), "14/a", Kind.HOUSE))
    }

    @Test
    fun houseNumberListsShortestFirst() {
        val houses = streets("1600", "16А", "216", "16", "161", "26")
        // prefix hits first (shortest key first, ties in list order), then plain substrings; 26 does not contain 16
        assertEquals(listOf("16", "16А", "161", "1600", "216"), search(houses, "16", Kind.HOUSE))
    }

    @Test
    fun houseQueryNeverMatchesTextAcrossWordsInTextMode() {
        // regression guard: TEXT mode must not strip digits or letters that are not type words
        assertEquals(listOf("вул. Садова"), search(streets("вул. Садова", "вул. Сонячна"), "сад"))
        assertEquals(listOf("вул. Сонячна"), search(streets("вул. Садова", "вул. Сонячна"), "сон"))
    }

    // ---- index ----

    @Test
    fun indexCanBeReusedForManyQueries() {
        val items = (1..966).map { "вул. Вулиця$it" }
        val index = PickerSearch.Index(items) { it }
        assertEquals(966, index.search("").size)
        assertEquals(1, index.search("вулиця966").size)
        assertEquals(listOf("вул. Вулиця9"), index.search("вулиця9").take(1))
    }
}
