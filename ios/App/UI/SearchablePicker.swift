import SwiftUI

/// One row of a `SearchablePickerField`. `id` must be unique inside one list; duplicates are dropped.
struct PickerItem: Hashable, Identifiable {
    let id: String
    let label: String
}

/// A read-only field that opens a full-screen searchable list (port of Android
/// ui/components/SearchablePickerField.kt). Built for the address lookup, where one list can hold
/// almost a thousand streets: rows are lazy, search is `PickerSearch` (apostrophe, diacritic, case and
/// street-type-prefix insensitive), and there is no entrance animation because people open it often.
struct SearchablePickerField: View {
    let label: String
    let value: String?
    let placeholder: String
    let items: [PickerItem]
    let selectedId: String?
    let lang: String
    var enabled: Bool = true
    var loading: Bool = false
    var loadFailed: Bool = false
    var onRetry: (() -> Void)? = nil
    var kind: PickerSearch.Kind = .TEXT
    var disabledHint: String? = nil
    /// CI screenshots only: opens the list as soon as the field appears.
    var autoOpen: Bool = false
    let onSelect: (PickerItem) -> Void

    @State private var open = false

    var body: some View {
        let shown = (value?.ktIsBlank == false) ? value! : placeholder
        VStack(alignment: .leading, spacing: 6) {
            Text(verbatim: label).ztText(ZtType.label).foregroundStyle(UiColors.textSecondaryHi)
            Button { withoutAnimation { open = true } } label: {
                HStack(spacing: 8) {
                    Text(verbatim: shown)
                        .ztText(ZtType.body)
                        .foregroundStyle(!enabled ? UiColors.disabledText : (value?.ktIsBlank ?? true) ? ZtColors.textTertiary : Color.white)
                        .lineLimit(2)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    if loading { ProgressView().tint(ZtColors.accent).controlSize(.small) }
                    Image(systemName: "chevron.down")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(enabled ? Color(argb: 0xB3FFFFFF) : Color(argb: 0x4DFFFFFF))
                }
                .padding(.leading, 16)
                .padding(.trailing, 12)
                .padding(.vertical, 8)
                .frame(minHeight: 56)
                .background {
                    RoundedRectangle(cornerRadius: ZtRadius.control).fill(enabled ? ZtColors.innerRow : Color(argb: 0x0DFFFFFF))
                        .overlay(RoundedRectangle(cornerRadius: ZtRadius.control)
                            .strokeBorder(enabled ? ZtColors.inputBorder : ZtColors.divider, lineWidth: 1))
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(!enabled)
            .accessibilityLabel(Text(verbatim: "\(label), \(shown)"))
            .accessibilityHint(Text(verbatim: !enabled ? (disabledHint ?? "") : ""))
        }
        .task {
            guard autoOpen else { return }
            try? await Task.sleep(for: .seconds(1))
            withoutAnimation { open = true }
        }
        .fullScreenCover(isPresented: $open) {
            PickerList(
                title: label, items: items, selectedId: selectedId, lang: lang,
                loading: loading, loadFailed: loadFailed, onRetry: onRetry, kind: kind,
                onDismiss: { withoutAnimation { open = false } },
                onSelect: { item in
                    withoutAnimation { open = false }
                    onSelect(item)
                }
            )
        }
    }

    /// People open the picker often: no slide-up animation (as on Android).
    private func withoutAnimation(_ change: () -> Void) {
        var t = Transaction()
        t.disablesAnimations = true
        withTransaction(t, change)
    }
}

/// Full-screen list with the search field focused on open.
private struct PickerList: View {
    let title: String
    let items: [PickerItem]
    let selectedId: String?
    let lang: String
    let loading: Bool
    let loadFailed: Bool
    let onRetry: (() -> Void)?
    let kind: PickerSearch.Kind
    let onDismiss: () -> Void
    let onSelect: (PickerItem) -> Void

    @State private var query = ""
    @FocusState private var focused: Bool

    var body: some View {
        // duplicate ids would confuse the lazy list, so the list is made unique once
        let unique = Self.unique(items)
        let shown = PickerSearch.Index(unique, kind: kind) { $0.label }.search(query)
        VStack(spacing: 0) {
            HStack(spacing: 4) {
                Button(action: onDismiss) {
                    Image(systemName: "chevron.backward")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(Color.white)
                        .frame(width: ZtMinTouch, height: ZtMinTouch)
                        .contentShape(Rectangle())
                }
                .accessibilityLabel(Text(verbatim: AppStrings.pickerClose(lang)))
                Text(verbatim: title).ztText(ZtType.heading).foregroundStyle(Color.white).lineLimit(2)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.leading, 4)
            .padding(.trailing, 16)
            .padding(.top, 4)

            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass").foregroundStyle(Color(argb: 0xB3FFFFFF))
                TextField(text: $query, prompt: Text(verbatim: AppStrings.pickerSearchHint(lang)).foregroundStyle(ZtColors.textTertiary)) {
                    Text(verbatim: AppStrings.pickerSearchHint(lang))
                }
                .ztText(ZtType.body)
                .foregroundStyle(Color.white)
                .tint(ZtColors.accent)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.search)
                .focused($focused)
                if !query.isEmpty {
                    Button { query = "" } label: {
                        Image(systemName: "xmark.circle.fill").foregroundStyle(Color(argb: 0xB3FFFFFF))
                            .frame(width: ZtMinTouch, height: ZtMinTouch)
                    }
                    .accessibilityLabel(Text(verbatim: AppStrings.pickerClearSearch(lang)))
                }
            }
            .padding(.leading, 16)
            .frame(minHeight: 56)
            .background {
                RoundedRectangle(cornerRadius: ZtRadius.control).fill(focused ? Color(argb: 0x1AFFFFFF) : ZtColors.innerRow)
                    .overlay(RoundedRectangle(cornerRadius: ZtRadius.control).strokeBorder(focused ? ZtColors.accent : ZtColors.inputBorder, lineWidth: 1))
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)

            if loading && !shown.isEmpty {
                ProgressView().progressViewStyle(.linear).tint(ZtColors.accent).padding(.horizontal, 16)
            }
            if loadFailed && !unique.isEmpty {
                statusRow.padding(.horizontal, 16).padding(.vertical, 4)
            }

            Group {
                if !shown.isEmpty {
                    ScrollViewReader { proxy in
                        ScrollView {
                            LazyVStack(spacing: 0) {
                                ForEach(shown) { item in row(item) }
                            }
                            .padding(.bottom, 16)
                        }
                        .scrollDismissesKeyboard(.interactively)
                        .onAppear { if let selectedId { proxy.scrollTo(selectedId, anchor: .center) } }
                    }
                } else if loading {
                    centered {
                        ProgressView().tint(ZtColors.accent).controlSize(.large)
                        Text(verbatim: AppStrings.pickerLoading(lang)).ztText(ZtType.body).foregroundStyle(ZtColors.textSecondary)
                    }
                } else if loadFailed && unique.isEmpty {
                    centered {
                        Image(systemName: "exclamationmark.circle").font(.system(size: 30)).foregroundStyle(ZtChipTone.red.text)
                        Text(verbatim: AppStrings.pickerLoadError(lang)).ztText(ZtType.body).foregroundStyle(Color.white).multilineTextAlignment(.center)
                        if let onRetry { retryButton(onRetry) }
                    }
                } else {
                    centered {
                        Text(verbatim: AppStrings.pickerNothingFound(lang)).ztText(ZtType.body).foregroundStyle(ZtColors.textSecondary)
                            .multilineTextAlignment(.center)
                        if unique.isEmpty, let onRetry { retryButton(onRetry) }
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(ZtColors.cardSolid.ignoresSafeArea())
        .preferredColorScheme(.dark)
        .onAppear { focused = true }
    }

    private func row(_ item: PickerItem) -> some View {
        let selected = item.id == selectedId
        return Button { onSelect(item) } label: {
            HStack {
                Text(verbatim: item.label).ztText(ZtType.body).foregroundStyle(Color.white)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.trailing, 12)
                if selected {
                    Image(systemName: "checkmark").font(.system(size: 17, weight: .bold)).foregroundStyle(ZtColors.accent)
                        .accessibilityLabel(Text(verbatim: AppStrings.pickerSelected(lang)))
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .frame(minHeight: 52)
            .background(selected ? ZtColors.innerRow : Color.clear)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .id(item.id)
        .accessibilityAddTraits(selected ? [.isSelected] : [])
    }

    private var statusRow: some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.circle").foregroundStyle(ZtChipTone.red.text)
            Text(verbatim: AppStrings.pickerLoadError(lang)).ztText(ZtType.caption).foregroundStyle(ZtChipTone.red.text)
                .frame(maxWidth: .infinity, alignment: .leading)
            if let onRetry { retryButton(onRetry) }
        }
    }

    private func retryButton(_ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(verbatim: AppStrings.pickerRetry(lang)).ztText(ZtType.label).foregroundStyle(Color.white)
                .padding(.horizontal, 20)
                .frame(minHeight: ZtMinTouch)
                .background {
                    RoundedRectangle(cornerRadius: ZtRadius.control).fill(Color(argb: 0x1AFFFFFF))
                        .overlay(RoundedRectangle(cornerRadius: ZtRadius.control).strokeBorder(ZtColors.inputBorder, lineWidth: 1))
                }
        }
        .buttonStyle(ZtPressStyle())
    }

    private func centered<C: View>(@ViewBuilder _ content: () -> C) -> some View {
        VStack(spacing: 14) { content() }.padding(24).frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    static func unique(_ items: [PickerItem]) -> [PickerItem] {
        var seen = Set<String>()
        return items.filter { seen.insert($0.id).inserted }
    }
}
