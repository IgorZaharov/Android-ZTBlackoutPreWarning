import SwiftUI

/// Loading flags of one level of the REM, settlement, street, house cascade; `retry` re-runs its fetch
/// with forceRefresh.
private struct LevelState: Equatable {
    var loading = false
    var failed = false
    var retry = 0
}

/// Full-screen queue help and address lookup (the "?" button; port of Android SettingsScreen.kt
/// `AddressLookupDialog`). The cascade starts from the saved address, or from Zhytomyr city on a first
/// launch; choosing another REM clears settlement, street and house. Nothing is applied until the user
/// presses the result button.
struct AddressLookupSheet: View {
    let siteUrl: String
    let lang: String
    let saved: SelectedAddressQuery?
    let onDismiss: () -> Void
    let onApply: (_ queue: String, _ statusText: String?, _ addressLabel: String, _ query: SelectedAddressQuery) -> Void
    let onBanner: (String) -> Void

    @State private var remId: String
    @State private var settlementId: String
    @State private var streetId: String
    @State private var house: String

    @State private var rems: [ZtoeRemOption]
    @State private var settlements: [ZtoeSettlementOption]
    @State private var streets: [ZtoeStreetOption]
    @State private var houses: [ZtoeHouseLookupResult]
    @State private var remsState = LevelState()
    @State private var settlementsState = LevelState()
    @State private var streetsState = LevelState()
    @State private var housesState = LevelState()

    @State private var checking = false
    @State private var checkFailed = false
    @State private var lookup: ZtoeHouseLookupResult?

    private static let ZTOE_SEARCH_URL = "https://www.ztoe.com.ua/unhooking-search.php"

    init(
        siteUrl: String, lang: String, saved: SelectedAddressQuery?,
        onDismiss: @escaping () -> Void,
        onApply: @escaping (String, String?, String, SelectedAddressQuery) -> Void,
        onBanner: @escaping (String) -> Void
    ) {
        self.siteUrl = siteUrl
        self.lang = lang
        self.saved = saved
        self.onDismiss = onDismiss
        self.onApply = onApply
        self.onBanner = onBanner
        let rem = saved.map { $0.remId.ktIsBlank ? "zhytomyr" : $0.remId } ?? "zhytomyr"
        let settlement = saved.map { $0.settlementId.ktIsBlank ? "zt_city" : $0.settlementId } ?? "zt_city"
        let street = saved?.streetId ?? ""
        _remId = State(initialValue: rem)
        _settlementId = State(initialValue: settlement)
        _streetId = State(initialValue: street)
        _house = State(initialValue: saved?.house ?? "")
        _rems = State(initialValue: ZtoeAddressLookup.getRems())
        _settlements = State(initialValue: ZtoeAddressLookup.getSettlementsForRem(rem))
        _streets = State(initialValue: settlement.ktIsBlank ? [] : ZtoeAddressLookup.getStreetsForSettlement(settlement))
        _houses = State(initialValue: street.ktIsBlank ? [] : ZtoeAddressLookup.getHousesForStreet(street))
    }

    // MARK: - Derived

    private func name(uk: String, en: String) -> String { lang == "uk" ? uk : en }
    private var currentRem: ZtoeRemOption? { rems.first { $0.id == remId } }
    private var currentSettlement: ZtoeSettlementOption? {
        settlementId.ktIsBlank ? nil : (settlements.first { $0.id == settlementId } ?? ZtoeAddressLookup.findSettlementById(settlementId))
    }
    private var currentStreet: ZtoeStreetOption? {
        streetId.ktIsBlank ? nil : (streets.first { $0.id == streetId } ?? ZtoeAddressLookup.findStreetById(streetId))
    }
    private var currentHouseRecord: ZtoeHouseLookupResult? {
        houses.first { $0.house.caseInsensitiveCompare(house) == .orderedSame }
    }

    private var selectedAddressStr: String {
        guard let street = currentStreet, !house.ktIsBlank else { return "" }
        let remName = currentRem.map { name(uk: $0.nameUk, en: $0.nameEn) } ?? ""
        let settlementName = currentSettlement.map { name(uk: $0.nameUk, en: $0.nameEn) } ?? ""
        return "\(remName), \(settlementName),\n\(name(uk: street.nameUk, en: street.nameEn)), \(AppStrings.addrHousePrefix(lang)) \(house)"
    }

    /// The live answer when it is for this house, merged with the indexed row; else the indexed row.
    private var matchedRecord: ZtoeHouseLookupResult? {
        let valid = lookup.flatMap { $0.house.caseInsensitiveCompare(house) == .orderedSame ? $0 : nil }
        if var v = valid, let rec = currentHouseRecord {
            if v.queue.isEmpty { v.queue = rec.queue }
            if v.statusText == nil { v.statusText = rec.statusText }
            return v
        }
        if let valid { return valid }
        if let rec = currentHouseRecord { return rec }
        if !house.ktIsBlank { return ZtoeHouseLookupResult(house: house, queue: "", addressLabel: selectedAddressStr) }
        return nil
    }

    private func clearBelowRem() {
        settlementId = ""
        streetId = ""
        house = ""
        streets = []
        houses = []
        lookup = nil
    }

    private func clearBelowSettlement() {
        streetId = ""
        house = ""
        houses = []
        lookup = nil
    }

    // MARK: - Body

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                header
                searchCard
                Text(verbatim: AppStrings.queueHelpManualSearchTitle(lang).uppercased())
                    .ztText(ZtType.label.weight(.heavy).tracking(0.05))
                    .foregroundStyle(Color.white)
                    .padding(.top, 4)
                    .padding(.leading, 4)
                steps
                Button(action: onDismiss) {
                    Text(verbatim: AppStrings.queueHelpGotIt(lang))
                        .ztText(ZtType.subhead.weight(.heavy))
                        .foregroundStyle(Color.black)
                        .frame(maxWidth: .infinity, minHeight: ZtMinTouch)
                        .padding(.vertical, 4)
                        .background { RoundedRectangle(cornerRadius: 16).fill(Color.white) }
                }
                .buttonStyle(ZtPressStyle())
                .padding(.top, 4)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 16)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(ZtColors.cardSolid.ignoresSafeArea())
        .preferredColorScheme(.dark)
        // REM list. A retry forces a fresh fetch; otherwise the in-memory cache is used.
        .task(id: "\(siteUrl)|\(remsState.retry)") { await loadRems() }
        // settlements of the REM: never picks one by itself, only drops a choice that no longer exists
        .task(id: "\(remId)|\(siteUrl)|\(settlementsState.retry)") { await loadSettlements() }
        // streets (the fetch also bulk-indexes the houses of the whole settlement)
        .task(id: "\(remId)|\(settlementId)|\(siteUrl)|\(streetsState.retry)") { await loadStreets() }
        .task(id: "\(remId)|\(settlementId)|\(streetId)|\(siteUrl)|\(housesState.retry)") { await loadHouses() }
        // asks the site when street and house are chosen
        .task(id: "\(remId)|\(settlementId)|\(streetId)|\(house)|\(siteUrl)") { await checkAddress() }
    }

    private var header: some View {
        VStack(spacing: 14) {
            HStack(spacing: 12) {
                RoundedRectangle(cornerRadius: 12).fill(ZtColors.accent).frame(width: 40, height: 40)
                    .overlay { Text(verbatim: "?").font(.system(size: 22, weight: .black)).foregroundStyle(Color.white) }
                    .accessibilityHidden(true)
                Text(verbatim: AppStrings.queueHelpTitle(lang)).ztText(ZtType.heading).foregroundStyle(Color.white)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .accessibilityAddTraits(.isHeader)
                Button(action: onDismiss) {
                    Circle().fill(Color(argb: 0x1AFFFFFF)).frame(width: 40, height: 40)
                        .overlay(Circle().strokeBorder(ZtColors.cardBorder, lineWidth: 1))
                        .overlay { Image(systemName: "xmark").font(.system(size: 16, weight: .semibold)).foregroundStyle(Color.white) }
                        .frame(width: ZtMinTouch, height: ZtMinTouch)
                }
                .buttonStyle(ZtPressStyle())
                .accessibilityLabel(Text(verbatim: AppStrings.pickerClose(lang)))
            }
            .padding(.horizontal, 4)
            DividerLine(color: ZtColors.inputBorder)
        }
    }

    private var searchCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text(verbatim: AppStrings.addrFindTitle(lang).uppercased())
                    .ztText(ZtType.label.weight(.heavy).tracking(0.05))
                    .foregroundStyle(Color.white)
                Text(verbatim: AppStrings.queueHelpAddressSubtitle(lang)).ztText(ZtType.caption).foregroundStyle(UiColors.textTertiaryHi)
            }

            SearchablePickerField(
                label: AppStrings.addrRemLabel(lang),
                value: currentRem.map { name(uk: $0.nameUk, en: $0.nameEn) },
                placeholder: AppStrings.addrRemPlaceholder(lang),
                items: rems.map { PickerItem(id: $0.id, label: name(uk: $0.nameUk, en: $0.nameEn)) },
                selectedId: remId,
                lang: lang,
                loading: remsState.loading,
                loadFailed: remsState.failed,
                onRetry: { remsState.retry += 1 }
            ) { item in
                if item.id != remId {
                    remId = item.id
                    clearBelowRem()
                }
            }

            SearchablePickerField(
                label: AppStrings.addrCityLabel(lang),
                value: currentSettlement.map { name(uk: $0.nameUk, en: $0.nameEn) },
                placeholder: AppStrings.addrCityPlaceholder(lang),
                items: settlements.map { PickerItem(id: $0.id, label: name(uk: $0.nameUk, en: $0.nameEn)) },
                selectedId: settlementId.ktIsBlank ? nil : settlementId,
                lang: lang,
                loading: settlementsState.loading,
                loadFailed: settlementsState.failed,
                onRetry: { settlementsState.retry += 1 }
            ) { item in
                if item.id != settlementId {
                    settlementId = item.id
                    clearBelowSettlement()
                }
            }

            SearchablePickerField(
                label: AppStrings.addrStreetLabel(lang),
                value: currentStreet.map { name(uk: $0.nameUk, en: $0.nameEn) },
                placeholder: AppStrings.addrStreetPlaceholder(lang),
                items: streets.map { PickerItem(id: $0.id, label: name(uk: $0.nameUk, en: $0.nameEn)) },
                selectedId: streetId.ktIsBlank ? nil : streetId,
                lang: lang,
                enabled: !settlementId.ktIsBlank,
                loading: streetsState.loading,
                loadFailed: streetsState.failed && !settlementId.ktIsBlank,
                onRetry: { streetsState.retry += 1 },
                disabledHint: AppStrings.pickerChooseFirst(lang)
            ) { item in
                if item.id != streetId {
                    streetId = item.id
                    house = ""
                    houses = ZtoeAddressLookup.getHousesForStreet(item.id)
                    lookup = nil
                }
            }

            SearchablePickerField(
                label: AppStrings.addrHouseLabel(lang),
                value: house,
                placeholder: AppStrings.addrHousePlaceholder(lang),
                items: houses.map { PickerItem(id: $0.house, label: $0.house) },
                selectedId: house.ktIsBlank ? nil : house,
                lang: lang,
                enabled: currentStreet != nil,
                loading: housesState.loading,
                loadFailed: housesState.failed && currentStreet != nil,
                onRetry: { housesState.retry += 1 },
                kind: .HOUSE,
                disabledHint: AppStrings.pickerChooseFirst(lang)
            ) { item in
                house = item.id
                lookup = nil
            }

            if !house.ktIsBlank, let record = matchedRecord {
                resultCard(record)
            }
        }
        .padding(20)
        .background {
            RoundedRectangle(cornerRadius: 24).fill(Color(argb: 0x0DFFFFFF))
                .overlay(RoundedRectangle(cornerRadius: 24).strokeBorder(Color.white.opacity(0.25), lineWidth: 2))
        }
    }

    private func resultCard(_ record: ZtoeHouseLookupResult) -> some View {
        // while the site answers, an address without a known queue cannot be confirmed yet
        let canApply = !(checking && record.queue.ktIsBlank)
        return VStack(alignment: .leading, spacing: 10) {
            if !selectedAddressStr.ktIsBlank {
                Text(verbatim: selectedAddressStr).ztText(ZtType.label).foregroundStyle(UiColors.textSecondaryHi)
            }
            if checking {
                HStack(spacing: 10) {
                    ProgressView().tint(ZtColors.accent).controlSize(.small)
                    Text(verbatim: AppStrings.addrChecking(lang)).ztText(ZtType.caption).foregroundStyle(ZtColors.textSecondary)
                }
            } else if checkFailed {
                HStack(spacing: 10) {
                    Image(systemName: "exclamationmark.circle").foregroundStyle(ZtChipTone.amber.text)
                    Text(verbatim: AppStrings.addrCheckFailed(lang)).ztText(ZtType.caption).foregroundStyle(ZtChipTone.amber.text)
                }
            }
            if !record.queue.ktIsBlank {
                HStack(spacing: 12) {
                    Text(verbatim: AppStrings.addrFoundQueue(lang)).ztText(ZtType.label).foregroundStyle(UiColors.textTertiaryHi)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Text(verbatim: "\(AppStrings.queue(lang)) \(record.queue)").ztText(ZtType.timeMono.weight(.heavy))
                        .foregroundStyle(Color.white).fixedSize()
                }
            }
            if let status = record.statusText, !status.ktIsBlank {
                Text(verbatim: status).ztText(ZtType.label.weight(.bold)).foregroundStyle(Color.white)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .background {
                        RoundedRectangle(cornerRadius: 16).fill(Color(argb: 0x0FFFFFFF))
                            .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Color(argb: 0x33FFFFFF), lineWidth: 2))
                    }
            }
            Button {
                let query = SelectedAddressQuery(remId: remId, settlementId: settlementId, streetId: streetId, house: house)
                let address = selectedAddressStr.ktIsBlank ? record.addressLabel : selectedAddressStr
                if !record.queue.ktIsBlank {
                    onApply(record.queue, nil, address, query)
                    onBanner("\(AppStrings.queue(lang)) \(record.queue)")
                } else {
                    onApply("", record.statusText, address, query)
                    onBanner(record.statusText ?? AppStrings.addrSaved(lang))
                }
            } label: {
                Text(verbatim: record.queue.ktIsBlank ? AppStrings.addrConfirm(lang) : AppStrings.addrApplyQueue(lang, record.queue))
                    .ztText(ZtType.subhead.weight(.heavy))
                    .foregroundStyle(Color.white)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity, minHeight: ZtMinTouch)
                    .padding(.vertical, 4)
                    .background { RoundedRectangle(cornerRadius: 16).fill(canApply ? ZtColors.accent : Color(argb: 0x66FF5E3A)) }
            }
            .buttonStyle(ZtPressStyle())
            .disabled(!canApply)
        }
        .padding(16)
        .background {
            RoundedRectangle(cornerRadius: 16).fill(Color(argb: 0xD9141A29))
                .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Color.white.opacity(0.25), lineWidth: 2))
        }
        .padding(.top, 6)
    }

    /// Numbered instructions 1-4, text unchanged from AppStrings.queueHelpSteps; only the address is a link.
    private var steps: some View {
        VStack(spacing: 12) {
            ForEach(Array(AppStrings.queueHelpSteps(lang).enumerated()), id: \.offset) { idx, step in
                HStack(alignment: .top, spacing: 14) {
                    Text(verbatim: "\(idx + 1)").ztText(ZtType.captionMono).foregroundStyle(Color.white)
                        .padding(.horizontal, 6)
                        .frame(minWidth: 24, minHeight: 24)
                        .background { Capsule().fill(Color(argb: 0x26FFFFFF)) }
                        .padding(.top, 2)
                        .accessibilityHidden(true)
                    Text(Self.linked(step)).ztText(ZtType.body).foregroundStyle(Color(argb: 0xFFF4F4F5))
                        .tint(ZtColors.accent)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(16)
                .background {
                    RoundedRectangle(cornerRadius: 16).fill(Color(argb: 0x0AFFFFFF))
                        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Color(argb: 0x26FFFFFF), lineWidth: 2))
                }
            }
        }
    }

    static func linked(_ step: String) -> AttributedString {
        var s = AttributedString(step)
        if let range = s.range(of: ZTOE_SEARCH_URL) {
            s[range].link = URL(string: ZTOE_SEARCH_URL)
            // the SwiftUI scope: UIKit has attributes with the same names
            s[range].swiftUI.underlineStyle = Text.LineStyle(pattern: .solid)
            s[range].swiftUI.foregroundColor = ZtColors.accent
        }
        return s
    }

    // MARK: - Loading

    private func loadRems() async {
        remsState.loading = true
        remsState.failed = false
        let fetched = await ZtoeAddressLookup.fetchRemsFromZtoe(siteUrl: siteUrl, forceRefresh: remsState.retry > 0)
        if Task.isCancelled { return }
        if !fetched.isEmpty { rems = fetched }
        remsState.failed = rems.isEmpty
        remsState.loading = false
    }

    private func loadSettlements() async {
        settlements = ZtoeAddressLookup.getSettlementsForRem(remId)
        settlementsState.loading = true
        settlementsState.failed = false
        let fetched = await ZtoeAddressLookup.fetchSettlementsForRem(remId, siteUrl: siteUrl, forceRefresh: settlementsState.retry > 0)
        if Task.isCancelled { return }
        if !fetched.isEmpty { settlements = fetched }
        settlementsState.failed = settlements.isEmpty
        settlementsState.loading = false
        if !settlementId.ktIsBlank && !settlements.isEmpty && !settlements.contains(where: { $0.id == settlementId }) {
            settlementId = ""
            clearBelowSettlement()
        }
    }

    private func loadStreets() async {
        if settlementId.ktIsBlank {
            streets = []
            streetsState.loading = false
            streetsState.failed = false
            return
        }
        streets = ZtoeAddressLookup.getStreetsForSettlement(settlementId)
        streetsState.loading = true
        streetsState.failed = false
        let fetched = await ZtoeAddressLookup.fetchStreetsForSettlement(remId, settlementId, siteUrl: siteUrl, forceRefresh: streetsState.retry > 0)
        if Task.isCancelled { return }
        if !fetched.isEmpty {
            streets = fetched
            rems = ZtoeAddressLookup.getRems()
            settlements = ZtoeAddressLookup.getSettlementsForRem(remId)
            if !streetId.ktIsBlank {
                let indexed = ZtoeAddressLookup.getHousesForStreet(streetId)
                if !indexed.isEmpty { houses = indexed }
            }
        }
        streetsState.failed = streets.isEmpty
        streetsState.loading = false
    }

    private func loadHouses() async {
        if streetId.ktIsBlank {
            houses = []
            housesState.loading = false
            housesState.failed = false
            return
        }
        houses = ZtoeAddressLookup.getHousesForStreet(streetId)
        housesState.loading = true
        housesState.failed = false
        let fetched = await ZtoeAddressLookup.fetchHousesForStreet(remId, settlementId, streetId, siteUrl: siteUrl, forceRefresh: housesState.retry > 0)
        if Task.isCancelled { return }
        if !fetched.isEmpty { houses = fetched }
        housesState.failed = houses.isEmpty
        housesState.loading = false
    }

    private func checkAddress() async {
        lookup = nil
        checkFailed = false
        if streetId.ktIsBlank || house.ktIsBlank {
            checking = false
            return
        }
        checking = true
        let res = await ZtoeAddressLookup.checkAddressOnZtoeWebsite(
            remId: remId, settlementId: settlementId, streetId: streetId, house: house, siteUrl: siteUrl
        )
        if Task.isCancelled { return }
        checking = false
        lookup = res
        checkFailed = res == nil
        guard let res else { return }
        if let i = houses.firstIndex(where: { $0.house.caseInsensitiveCompare(res.house) == .orderedSame }) {
            var h = houses[i]
            if !res.queue.isEmpty { h.queue = res.queue }
            if let s = res.statusText { h.statusText = s }
            if !res.addressLabel.isEmpty { h.addressLabel = res.addressLabel }
            houses[i] = h
        } else {
            houses.append(res)
        }
    }
}
