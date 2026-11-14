import SwiftUI

/// Presets for "warn me N minutes before" (Android SettingsScreen.kt ADVANCE_PRESETS).
private let ADVANCE_PRESETS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240]
/// Presets for the site check (Android REFRESH_PRESETS).
private let REFRESH_PRESETS = [15, 30, 60, 120, 180, 240]

/// Settings page (port of Android ui/screens/SettingsScreen.kt 1.4.0): my addresses (up to 5, each with
/// its planned and emergency switches), the site address with a live check, timers, the alert master
/// and sound, emergency follow-ups, language, and the test / refresh / reset actions.
/// iOS differences (plan section 2): no exact-alarm card, no vibration switch, iOS background hint.
struct SettingsScreen: View {
    @ObservedObject var model: AppModel
    /// False while the pager keeps this page off screen: the site check waits until it is shown.
    let isVisible: Bool

    @State private var showLookup = false
    @State private var showReset = false
    @State private var removeCandidate: Subscription?
    @State private var renameCandidate: Subscription?
    @State private var renameText = ""
    @State private var urlText = ""
    @State private var urlStatus: FetchStatus = .SUCCESS
    @State private var verifying = false
    @State private var urlChecked = false
    @State private var notificationsDenied = false
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.dynamicTypeSize) private var typeSize

    private var lang: String { model.lang }
    private var settings: UserSettings { model.settings }

    var body: some View {
        let master = model.alertsMaster
        let minShort = AppStrings.minShort(lang)
        ScrollView {
          ScrollViewReader { proxy in
            VStack(spacing: 16) {
                HStack(spacing: 10) {
                    Image(systemName: "slider.horizontal.3").font(.system(size: 20, weight: .semibold)).foregroundStyle(ZtColors.accent)
                    Text(verbatim: AppStrings.settingsTitle(lang)).ztText(ZtType.heading).foregroundStyle(Color.white)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .accessibilityAddTraits(.isHeader)
                }
                .padding(.top, 4)

                MyAddressesCard(
                    model: model,
                    onHelp: { showLookup = true },
                    onRemove: { removeCandidate = $0 },
                    onRename: { item in
                        renameText = item.label
                        renameCandidate = item
                    }
                )

                siteCard

                // timers: presets only (no free text), ranges match what really works
                ZtGlassCard(padding: 18) {
                    VStack(alignment: .leading, spacing: 14) {
                        VStack(alignment: .leading, spacing: 6) {
                            VStack(alignment: .leading, spacing: 2) {
                                CardTitle(text: AppStrings.advanceNoticeTitle(lang))
                                Text(verbatim: "\(AppStrings.advanceNoticeHint(lang)) · \(AppStrings.rangeMinutes(lang, ADVANCE_PRESETS.first!, ADVANCE_PRESETS.last!))")
                                    .ztText(ZtType.caption).foregroundStyle(ZtColors.textTertiary)
                            }
                            GlassDropdown(value: "\(settings.advanceNoticeMinutes) \(minShort)", options: ADVANCE_PRESETS.map { "\($0) \(minShort)" }) {
                                model.setAdvanceMinutes(ADVANCE_PRESETS[$0])
                            }
                        }
                        DividerLine()
                        VStack(alignment: .leading, spacing: 6) {
                            VStack(alignment: .leading, spacing: 2) {
                                CardTitle(text: AppStrings.refreshIntervalTitle(lang))
                                Text(verbatim: "\(AppStrings.rangeMinutes(lang, REFRESH_PRESETS.first!, REFRESH_PRESETS.last!)) · \(AppStrings.refreshFloorHintIos(lang))")
                                    .ztText(ZtType.caption).foregroundStyle(ZtColors.textTertiary)
                            }
                            GlassDropdown(value: "\(settings.refreshIntervalMinutes) \(minShort)", options: REFRESH_PRESETS.map { "\($0) \(minShort)" }) {
                                model.setRefreshMinutes(REFRESH_PRESETS[$0])
                            }
                        }
                    }
                }

                // alerts: the master for all addresses, then sound (follows the master, spec/SUBSCRIPTIONS.md 7)
                ZtGlassCard(padding: 18) {
                    VStack(alignment: .leading, spacing: 8) {
                        SwitchRow(icon: "bell.fill", title: AppStrings.notifications(lang), hint: AppStrings.masterHint(lang), isOn: master) {
                            model.setMaster($0)
                        }
                        if Subscriptions.noAlertsCaption(master: master, store: model.subscriptions) {
                            Text(verbatim: AppStrings.noAddressAlerts(lang)).ztText(ZtType.caption).foregroundStyle(ZtColors.accent)
                        }
                        if notificationsDenied {
                            HStack(spacing: 8) {
                                Text(verbatim: AppStrings.notificationsDeniedIos(lang)).ztText(ZtType.caption).foregroundStyle(ZtChipTone.amber.text)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                Button {
                                    openExternal(UIApplication.openNotificationSettingsURLString)
                                } label: {
                                    Text(verbatim: AppStrings.openIosSettings(lang)).ztText(ZtType.label.weight(.bold)).foregroundStyle(Color.white)
                                        .padding(.horizontal, 8).frame(minHeight: ZtMinTouch)
                                }
                                .buttonStyle(ZtPressStyle())
                            }
                        }
                        DividerLine()
                        SwitchRow(icon: "speaker.wave.2.fill", iconTint: master ? UiColors.iconSecondary : UiColors.disabledIcon,
                                  title: AppStrings.sound(lang), isOn: master && settings.soundEnabled, enabled: master) {
                            model.setSound($0)
                        }
                        Text(verbatim: AppStrings.soundHintIos(lang)).ztText(ZtType.caption).foregroundStyle(ZtColors.textTertiary)
                            .padding(.top, 2)
                    }
                }
                .id("settings-alerts")

                // emergency follow-ups for all addresses; the start is always announced (spec/NOTIFICATIONS.md 2.4)
                ZtGlassCard(padding: 18) {
                    VStack(alignment: .leading, spacing: 8) {
                        CardTitle(text: AppStrings.emergencyAlertsTitle(lang))
                        Text(verbatim: AppStrings.emergencyAlertsDesc(lang)).ztText(ZtType.caption).foregroundStyle(ZtColors.textSecondary)
                        SwitchRow(icon: "clock.fill", iconTint: master ? UiColors.emergencyAmber : UiColors.disabledIcon,
                                  title: AppStrings.emergencyEtaAlertsTitle(lang), hint: AppStrings.emergencyEtaAlertsHint(lang),
                                  isOn: master && settings.emergencyEtaAlerts, enabled: master) {
                            model.setEmergencyEtaAlerts($0)
                        }
                        DividerLine()
                        SwitchRow(icon: "bolt.fill", iconTint: master ? ZtChipTone.green.text : UiColors.disabledIcon,
                                  title: AppStrings.emergencyEndAlertsTitle(lang), hint: AppStrings.emergencyEndAlertsHint(lang),
                                  isOn: master && settings.emergencyEndAlerts, enabled: master) {
                            model.setEmergencyEndAlerts($0)
                        }
                    }
                }

                languageCard.id("settings-actions")

                // diagnostics and actions
                ZtGlassCard(padding: 18) {
                    VStack(spacing: 10) {
                        if typeSize.isAccessibilitySize {
                            testButton(fill: false)
                            refreshButton(fill: false)
                        } else {
                            // same height even when only one label wraps to two lines (as on Android)
                            HStack(spacing: 8) { testButton(fill: true); refreshButton(fill: true) }
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        ActionButton(text: AppStrings.resetDefaultsBtn(lang), icon: "arrow.counterclockwise", subdued: true) { showReset = true }
                    }
                }

                Spacer(minLength: 96)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .launchScroll(proxy, active: isVisible)
          }
        }
        .scrollDismissesKeyboard(.interactively)
        .onAppear { urlText = settings.cityUrl }
        .onChange(of: settings.cityUrl) { _, url in if url != urlText { urlText = url } }
        // live URL check against valid-urls.json and the real table; waits until the page is on screen
        .task(id: "\(settings.cityUrl)|\(settings.queue)|\(isVisible)") { await verifyUrl() }
        .task(id: scenePhase) { notificationsDenied = await TestAlert.isDenied() }
        // CI screenshots only: `-ZTDialog reset|remove|rename` opens that dialog once Settings is shown
        .task(id: isVisible) {
            guard isVisible, let dialog = UserDefaults.standard.string(forKey: "ZTDialog") else { return }
            try? await Task.sleep(for: .seconds(2))
            switch dialog {
            case "reset": showReset = true
            case "remove": removeCandidate = model.subscriptions.items.last
            case "rename":
                renameText = model.subscriptions.items.first?.label ?? ""
                renameCandidate = model.subscriptions.items.first
            default: break
            }
        }
        .onChange(of: model.autoOpenQueueHelp, initial: true) { _, open in
            if open {
                showLookup = true
                model.autoOpenQueueHelp = false
            }
        }
        .fullScreenCover(isPresented: $showLookup) {
            AddressLookupSheet(
                siteUrl: settings.cityUrl,
                lang: lang,
                saved: settings.selectedAddressQuery,
                onDismiss: { showLookup = false },
                onApply: { queue, status, label, query in
                    model.addAddress(queue: queue, statusText: status, addressLabel: label, query: query)
                    showLookup = false
                },
                onBanner: { model.showBanner($0) }
            )
        }
        .alert(Text(verbatim: AppStrings.removeConfirmTitle(lang)), isPresented: Binding(get: { removeCandidate != nil }, set: { if !$0 { removeCandidate = nil } }), presenting: removeCandidate) { item in
            Button(role: .destructive) { model.remove(item.id) } label: { Text(verbatim: AppStrings.removeAddress(lang)) }
            Button(role: .cancel) {} label: { Text(verbatim: AppStrings.cancel(lang)) }
        } message: { item in
            Text(verbatim: AppStrings.removeConfirmBody(lang, Subscriptions.displayLabel(item)))
        }
        .alert(Text(verbatim: AppStrings.renameAddress(lang)), isPresented: Binding(get: { renameCandidate != nil }, set: { if !$0 { renameCandidate = nil } }), presenting: renameCandidate) { item in
            TextField(text: Binding(get: { renameText }, set: { renameText = String($0.prefix(Subscriptions.MAX_LABEL_LENGTH)) })) {
                Text(verbatim: Subscriptions.defaultLabel(item))
            }
            Button { model.rename(item.id, renameText) } label: { Text(verbatim: AppStrings.save(lang)) }
            Button(role: .cancel) {} label: { Text(verbatim: AppStrings.cancel(lang)) }
        } message: { _ in
            Text(verbatim: AppStrings.renameHint(lang))
        }
        .alert(Text(verbatim: AppStrings.resetConfirmTitle(lang)), isPresented: $showReset) {
            Button(role: .destructive) { model.resetDefaults() } label: { Text(verbatim: AppStrings.resetYes(lang)) }
            Button(role: .cancel) {} label: { Text(verbatim: AppStrings.cancel(lang)) }
        } message: {
            Text(verbatim: AppStrings.resetConfirmDesc(lang))
        }
    }

    private func testButton(fill: Bool) -> some View {
        ActionButton(text: AppStrings.testAlertBtn(lang), icon: "paperplane.fill", filled: true, fillHeight: fill) { model.sendTestAlert() }
    }

    private func refreshButton(fill: Bool) -> some View {
        ActionButton(text: AppStrings.refreshBtn(lang), icon: "arrow.clockwise", busy: model.isRefreshing, busyText: AppStrings.refreshing(lang), fillHeight: fill) {
            model.manualRefresh()
        }
    }

    // MARK: - Site address

    private var siteCard: some View {
        let checking = verifying || !urlChecked
        let ok = ZtoeParser.isValidUrl(settings.cityUrl) && urlStatus == .SUCCESS
        let bad = !checking && !ok
        return ZtGlassCard(padding: 18) {
            VStack(alignment: .leading, spacing: 8) {
                FlowLayout(spacing: 10, lineSpacing: 6) {
                    CardTitle(text: AppStrings.siteAddressTitle(lang)).padding(.vertical, 6)
                    if checking {
                        PlainChip(text: AppStrings.siteStateChecking(lang))
                    } else if ok {
                        PlainChip(text: AppStrings.siteReachable(lang), fill: ZtChipTone.green.fill, foreground: ZtChipTone.green.text)
                    } else {
                        PlainChip(text: urlStatus == .NO_INTERNET ? AppStrings.errorNoInternet(lang) : AppStrings.errorNoQueuesFound(lang),
                                  fill: ZtChipTone.red.fill, foreground: ZtChipTone.red.text, icon: "exclamationmark.circle")
                    }
                }
                Text(verbatim: AppStrings.siteAddressDesc(lang)).ztText(ZtType.caption).foregroundStyle(ZtColors.textSecondary)
                TextField(text: $urlText) { Text(verbatim: AppStrings.siteAddressTitle(lang)) }
                    .ztText(ZtType.body)
                    .foregroundStyle(Color.white)
                    .tint(ZtColors.accent)
                    .keyboardType(.URL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .submitLabel(.done)
                    .onChange(of: urlText) { _, url in if url != settings.cityUrl { model.setSiteUrl(url) } }
                    .padding(.horizontal, 16)
                    .frame(minHeight: 56)
                    .background {
                        RoundedRectangle(cornerRadius: ZtRadius.control).fill(UiColors.field)
                            .overlay(RoundedRectangle(cornerRadius: ZtRadius.control)
                                .strokeBorder(bad ? Color(argb: 0x66EF4444) : ZtColors.inputBorder, lineWidth: 1))
                    }
            }
        }
    }

    private func verifyUrl() async {
        guard isVisible else { return }
        let url = settings.cityUrl
        if !ZtoeParser.isValidUrl(url) {
            urlStatus = .NO_QUEUES_FOUND
            urlChecked = true
            return
        }
        verifying = true
        let queue = settings.queue.ktIsBlank ? "1.1" : settings.queue
        let res = await ZtoeParser.fetchFullSchedule(url: url, queue: queue)
        if Task.isCancelled { return }
        urlStatus = res.status
        verifying = false
        urlChecked = true
    }

    // MARK: - Language

    private var languageCard: some View {
        ZtGlassCard(padding: 18) {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 8) {
                    Image(systemName: "globe").font(.system(size: 15, weight: .semibold)).foregroundStyle(ZtColors.accent)
                    CardTitle(text: AppStrings.languageTitle(lang))
                }
                HStack(spacing: 4) {
                    ForEach([LangOption(code: "SYSTEM", label: AppStrings.langSystem(lang)), LangOption(code: "uk", label: "Українська"), LangOption(code: "en", label: "English")], id: \.code) { option in
                        let selected = settings.language.caseInsensitiveCompare(option.code) == .orderedSame
                        Button { model.setLanguage(option.code) } label: {
                            Text(verbatim: option.label)
                                .ztText(selected ? ZtType.label.weight(.bold) : ZtType.label)
                                .foregroundStyle(selected ? Color.black : Color(argb: 0xBFE0F2FE))
                                .multilineTextAlignment(.center)
                                .lineLimit(2)
                                .padding(.horizontal, 6)
                                .frame(maxWidth: .infinity, minHeight: ZtMinTouch - 8)
                                .background { RoundedRectangle(cornerRadius: 9).fill(selected ? Color.white : Color.clear) }
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(selected ? [.isSelected] : [])
                    }
                }
                .padding(4)
                .background {
                    RoundedRectangle(cornerRadius: 12).fill(Color(argb: 0x59000000))
                        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Color(argb: 0x1AFFFFFF), lineWidth: 1))
                }
            }
        }
    }
}

// MARK: - "Мої адреси" card (spec/SUBSCRIPTIONS.md)

private struct MyAddressesCard: View {
    @ObservedObject var model: AppModel
    let onHelp: () -> Void
    let onRemove: (Subscription) -> Void
    let onRename: (Subscription) -> Void

    // drag the handle to reorder: a local order follows the finger, the store is written on release
    @State private var order: [String] = []
    @State private var draggingId: String?
    @State private var dragOffset: CGFloat = 0
    @State private var lastTranslation: CGFloat = 0
    @State private var heights: [String: CGFloat] = [:]
    private let gap: CGFloat = 12

    var body: some View {
        let lang = model.lang
        let store = model.subscriptions
        let master = model.alertsMaster
        let count = store.items.count
        let ids = store.items.map(\.id)
        let shownOrder = draggingId == nil ? ids : order
        let byId = Dictionary(uniqueKeysWithValues: store.items.map { ($0.id, $0) })
        ZtGlassCard(padding: 18) {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 8) {
                    VStack(alignment: .leading, spacing: 2) {
                        CardTitle(text: AppStrings.myAddressesTitle(lang))
                        Text(verbatim: AppStrings.myAddressesDesc(lang)).ztText(ZtType.caption).foregroundStyle(ZtColors.textSecondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    if count > 0 {
                        PlainChip(text: AppStrings.addressesCount(lang, count, Subscriptions.MAX_ITEMS))
                    }
                    // 48 pt target around the 40 pt "?" tile; opens the address lookup
                    Button(action: onHelp) {
                        RoundedRectangle(cornerRadius: 16).fill(ZtColors.accent).frame(width: 40, height: 40)
                            .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Color(argb: 0x40FFFFFF), lineWidth: 1))
                            .overlay { Image(systemName: "questionmark").font(.system(size: 17, weight: .bold)).foregroundStyle(Color.white) }
                            .frame(width: ZtMinTouch, height: ZtMinTouch)
                    }
                    .buttonStyle(ZtPressStyle())
                    .accessibilityLabel(Text(verbatim: AppStrings.queueHelpTitle(lang)))
                }

                if !master && count > 0 {
                    Text(verbatim: AppStrings.masterOffCaption(lang)).ztText(ZtType.caption).foregroundStyle(ZtChipTone.amber.text)
                }

                ForEach(Array(shownOrder.enumerated()), id: \.element) { index, id in
                    if let item = byId[id] {
                        let dragging = draggingId == id
                        SubscriptionBlock(
                            item: item,
                            master: master,
                            isPrimary: item.id == store.primaryId,
                            advanceMinutes: model.settings.advanceNoticeMinutes,
                            lang: lang,
                            showHandle: count >= 2,
                            handleGesture: dragGesture(id),
                            onMoveUp: index > 0 ? { model.move(id, to: index - 1) } : nil,
                            onMoveDown: index < count - 1 ? { model.move(id, to: index + 1) } : nil,
                            onRemove: { onRemove(item) },
                            onRename: { onRename(item) },
                            onMakePrimary: { model.makePrimary(id) },
                            onSetPlanned: { model.setPlanned(id, $0) },
                            onSetEmergency: { model.setEmergency(id, $0) }
                        )
                        .background(GeometryReader { g in Color.clear.preference(key: BlockHeights.self, value: [id: g.size.height]) })
                        .scaleEffect(dragging ? 1.02 : 1)
                        .offset(y: dragging ? dragOffset : 0)
                        .shadow(color: dragging ? Color.black.opacity(0.45) : .clear, radius: 10, y: 4)
                        .zIndex(dragging ? 1 : 0)
                    }
                }
                .onPreferenceChange(BlockHeights.self) { heights = $0 }

                if count < Subscriptions.MAX_ITEMS {
                    ActionButton(text: AppStrings.addAddress(lang), icon: "plus", filled: true, action: onHelp)
                    let used = Set(store.items.compactMap { $0.address == nil ? $0.queue : nil })
                    let free = UserSettings.ALL_QUEUES.filter { !used.contains($0) }
                    GlassDropdown(value: AppStrings.addQueueOnly(lang), options: free.map { "\(AppStrings.queue(lang)) \($0)" }) {
                        model.addQueueOnly(free[$0])
                    }
                    if count > 0 {
                        Text(verbatim: AppStrings.addressesLeft(lang, Subscriptions.MAX_ITEMS - count)).ztText(ZtType.caption).foregroundStyle(ZtColors.textTertiary)
                    }
                } else {
                    Text(verbatim: AppStrings.addressLimitReached(lang, Subscriptions.MAX_ITEMS)).ztText(ZtType.caption).foregroundStyle(ZtColors.textSecondary)
                }
            }
        }
    }

    private func dragGesture(_ id: String) -> some Gesture {
        DragGesture(minimumDistance: 4, coordinateSpace: .global)
            .onChanged { value in
                if draggingId != id {
                    order = model.subscriptions.items.map(\.id)
                    draggingId = id
                    dragOffset = 0
                    lastTranslation = 0
                }
                let dy = value.translation.height - lastTranslation
                lastTranslation = value.translation.height
                dragBy(id, dy)
            }
            .onEnded { _ in dropped(id) }
    }

    private func dragBy(_ id: String, _ dy: CGFloat) {
        dragOffset += dy
        guard let i = order.firstIndex(of: id) else { return }
        if dragOffset > 0 && i < order.count - 1 {
            let step = (heights[order[i + 1]] ?? 0) + gap
            if dragOffset > step / 2 {
                order.swapAt(i, i + 1)
                dragOffset -= step
            }
        } else if dragOffset < 0 && i > 0 {
            let step = (heights[order[i - 1]] ?? 0) + gap
            if -dragOffset > step / 2 {
                order.swapAt(i, i - 1)
                dragOffset += step
            }
        }
    }

    private func dropped(_ id: String) {
        let to = order.firstIndex(of: id)
        let from = model.subscriptions.items.firstIndex { $0.id == id }
        withAnimation(.easeOut(duration: 0.2)) {
            draggingId = nil
            dragOffset = 0
        }
        if let to, to != from { model.move(id, to: to) }
    }
}

private struct BlockHeights: PreferenceKey {
    static var defaultValue: [String: CGFloat] = [:]
    static func reduce(value: inout [String: CGFloat], nextValue: () -> [String: CGFloat]) {
        value.merge(nextValue()) { $1 }
    }
}

/// One address of "Мої адреси": queue and primary chips, rename / remove, label and address, its planned
/// and emergency switches, and "Make primary".
private struct SubscriptionBlock<G: Gesture>: View {
    let item: Subscription
    let master: Bool
    let isPrimary: Bool
    let advanceMinutes: Int
    let lang: String
    let showHandle: Bool
    let handleGesture: G
    let onMoveUp: (() -> Void)?
    let onMoveDown: (() -> Void)?
    let onRemove: () -> Void
    let onRename: () -> Void
    let onMakePrimary: () -> Void
    let onSetPlanned: (Bool) -> Void
    let onSetEmergency: (Bool) -> Void

    var body: some View {
        let label = Subscriptions.displayLabel(item)
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                if showHandle {
                    // press and drag up or down; VoiceOver offers "move up" / "move down"
                    Image(systemName: "line.3.horizontal")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(ZtColors.textSecondary)
                        .frame(width: ZtMinTouch, height: ZtMinTouch)
                        .contentShape(Rectangle())
                        .gesture(handleGesture)
                        .accessibilityLabel(Text(verbatim: "\(AppStrings.reorderHandle(lang)): \(label)"))
                        .accessibilityActions {
                            if let onMoveUp { Button(AppStrings.moveUp(lang), action: onMoveUp) }
                            if let onMoveDown { Button(AppStrings.moveDown(lang), action: onMoveDown) }
                        }
                }
                FlowLayout(spacing: 6, lineSpacing: 6) {
                    // a queue-only item already says "Черга X" in its label
                    if item.address != nil {
                        PlainChip(text: item.queue.map { "\(AppStrings.queue(lang)) \($0)" }
                            ?? ((item.queueStatusText ?? "").ktIsBlank ? AppStrings.selectQueueAction(lang) : AppStrings.noQueueNotDisconnected(lang)))
                    }
                    if isPrimary {
                        PlainChip(text: AppStrings.primaryBadge(lang), foreground: .white, icon: "star.fill")
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                IconTile(icon: "pencil", description: "\(AppStrings.renameAddress(lang)): \(label)", action: onRename)
                IconTile(icon: "trash", description: "\(AppStrings.removeAddress(lang)): \(label)", danger: true, action: onRemove)
            }
            Text(verbatim: label).ztText(ZtType.subhead).foregroundStyle(Color.white)
            let caption: String? = item.address.map { $0.text.ktIsBlank ? nil : $0.text } ?? AppStrings.queueOnlyCaption(lang)
            if let caption {
                Text(verbatim: caption).ztText(ZtType.caption).foregroundStyle(ZtColors.textSecondary)
            }
            SwitchRow(icon: "bell.fill", title: AppStrings.plannedShort(lang), hint: AppStrings.plannedDesc(lang, advanceMinutes),
                      isOn: master && item.plannedAlerts, enabled: master && item.queue != nil, onChange: onSetPlanned)
            SwitchRow(icon: "exclamationmark.triangle.fill", iconTint: ZtColors.accent, title: AppStrings.emergencyShort(lang),
                      hint: item.address != nil ? AppStrings.emergencyDesc(lang) : AppStrings.emergencyNeedsAddress(lang),
                      isOn: master && item.emergencyAlerts && item.address != nil, enabled: master && item.address != nil, onChange: onSetEmergency)
            if !isPrimary {
                ActionButton(text: AppStrings.makePrimary(lang), icon: "star", action: onMakePrimary)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background {
            RoundedRectangle(cornerRadius: 16).fill(ZtColors.innerRow)
                .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(isPrimary ? Color(argb: 0x59FF5E3A) : ZtColors.divider, lineWidth: 1))
        }
    }
}
