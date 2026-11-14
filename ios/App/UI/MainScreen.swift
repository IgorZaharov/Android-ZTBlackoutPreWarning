import SwiftUI

/// Main page (port of Android ui/screens/MainScreen.kt 1.4.0): header with the notification bell,
/// banners, address switcher, hero countdown, Today/Tomorrow, the drum with the day's outages, last
/// update and site chips, the Facebook and ztoe links. With no queue and no address the page is dimmed
/// and only "Select queue" and the language switch work (first launch).
struct MainScreen: View {
    @ObservedObject var model: AppModel
    @State private var isTomorrow = false

    private var lang: String { model.lang }
    private var snapshot: OutageSnapshot { model.snapshot }
    private var status: ScheduleStatusInfo { model.statusInfo }

    var body: some View {
        let featured = snapshot.featuredEmergency()
        let hasEmergency = featured != nil
        let statusText = model.shownStatusText ?? ""
        let hasCustomNoQueueStatus = !statusText.ktIsBlank && !hasEmergency
        let queue = model.shownQueue
        let isQueueUnselected = queue.ktIsBlank && !hasCustomNoQueueStatus && !hasEmergency
        let formattedAddress = Self.formatAddressAfterCity(model.shownAddress)
        let today = snapshot.today
        let activeDate = isTomorrow ? today.plusDays(1) : today
        let activeView = snapshot.dayView(activeDate)
        // the ztoe table of the shown day is not known: the drum is grey, known emergency/repair outages are drawn on top
        let isTodayUnclear = !hasCustomNoQueueStatus && !queue.ktIsBlank && !snapshot.plannedKnown
        let isTomorrowUnclear = !hasCustomNoQueueStatus && !queue.ktIsBlank && !snapshot.tomorrowPublished
        let activeUnclear = isTomorrow ? isTomorrowUnclear : isTodayUnclear
        let activeSlots = hasCustomNoQueueStatus ? Self.lightNoOutageSlots : snapshot.slotsFor(activeDate)
        let isStatusUnclear = (snapshot.isUnclear && !hasCustomNoQueueStatus) || isQueueUnselected
        let rows = activeView.rows
        let showOutageList = !isQueueUnselected && (!rows.isEmpty || (!activeUnclear && !activeSlots.isEmpty))
        let switcher = Subscriptions.switcherItems(model.subscriptions)
        let siteBanner = SiteStatusModel.banner(snapshot, lang)
        let siteNotice = SiteStatusModel.notice(snapshot)

        ZStack {
            ScrollView {
                VStack(spacing: 16) {
                    header(queue: queue, hideQueue: isQueueUnselected || hasCustomNoQueueStatus || queue.ktIsBlank, address: formattedAddress, interactive: !isQueueUnselected)

                    if !isQueueUnselected && Subscriptions.noAlertsCaption(master: model.alertsMaster, store: model.subscriptions) {
                        noAlertsCaption
                    }
                    if switcher.isEmpty, !isQueueUnselected, let featured {
                        EmergencyBanner(outage: featured, now: snapshot.now, lang: lang)
                    }
                    if !isQueueUnselected, let siteBanner {
                        SiteStatusBanner(banner: siteBanner)
                    }
                    if let siteNotice {
                        SiteNoticeCard(text: siteNotice, lang: lang)
                    }
                    if !switcher.isEmpty {
                        AddressSwitcher(
                            addresses: switcher,
                            primaryId: model.subscriptions.primaryId,
                            shownId: Subscriptions.viewItem(model.subscriptions, selectedId: model.shownSubscriptionId)?.id,
                            lang: lang
                        ) { model.shownSubscriptionId = $0 }
                        if !isQueueUnselected, let featured {
                            EmergencyBanner(outage: featured, now: snapshot.now, lang: lang)
                        }
                    }
                    if !isQueueUnselected && !statusText.ktIsBlank {
                        ZtGlassCard {
                            VStack(alignment: .leading, spacing: 4) {
                                if let formattedAddress {
                                    Text(verbatim: formattedAddress).ztText(ZtType.caption).foregroundStyle(UiColors.textSecondaryHi)
                                }
                                Text(verbatim: statusText).ztText(ZtType.subhead).foregroundStyle(Color.white)
                            }
                        }
                    }

                    hero(customNoQueue: hasCustomNoQueueStatus && !hasEmergency, isStatusUnclear: isStatusUnclear)

                    DayTabs(isTomorrow: $isTomorrow, enabled: !isQueueUnselected, lang: lang)

                    if isTomorrow && isTomorrowUnclear && !isQueueUnselected {
                        ZtGlassCard {
                            Text(verbatim: AppStrings.tomorrowNotPublished(lang)).ztText(ZtType.subhead).foregroundStyle(Color.white)
                        }
                    }

                    // schedule card: the 24 h drum and the outages of the shown day
                    ZtGlassCard(padding: 18) {
                        VStack(alignment: .leading, spacing: 14) {
                            TimelineBar(
                                slots: activeSlots,
                                currentHour: snapshot.now.hour,
                                currentMinute: snapshot.now.minute,
                                showNeedle: !isTomorrow,
                                lang: lang,
                                unclearBase: activeUnclear
                            )
                            .ztBackgroundExtension()
                            if showOutageList {
                                DividerLine()
                                VStack(alignment: .leading, spacing: 8) {
                                    Text(verbatim: isTomorrow ? AppStrings.blackoutHoursForTomorrowHeader(lang) : AppStrings.blackoutHoursForDayHeader(lang))
                                        .ztText(ZtType.label)
                                        .foregroundStyle(UiColors.textSecondaryHi)
                                    if rows.isEmpty {
                                        Text(verbatim: AppStrings.noBlackoutsScheduled(lang))
                                            .ztText(ZtType.caption)
                                            .foregroundStyle(UiColors.textSecondaryHi)
                                            .frame(maxWidth: .infinity)
                                            .padding(14)
                                            .background { RoundedRectangle(cornerRadius: ZtRadius.row).fill(ZtColors.innerRow) }
                                    } else {
                                        ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                                            OutageRowView(OutageRowFormat.format(lang, row))
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // last update, site chips and the round refresh button
                    ZtGlassCard(padding: 14) {
                        VStack(alignment: .leading, spacing: 10) {
                            HStack(spacing: 12) {
                                VStack(alignment: .leading, spacing: 4) {
                                    LabelledValue(label: AppStrings.lastUpdated(lang), value: model.lastUpdated)
                                    LabelledValue(label: AppStrings.nextUpdated(lang), value: model.nextUpdated)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                RefreshDisc(enabled: !isQueueUnselected, busy: model.isRefreshing, lang: lang) { model.manualRefresh() }
                            }
                            SiteStatusChipRow(snapshot: snapshot, lang: lang)
                        }
                    }

                    LinkCard(title: AppStrings.emergencyOutagesLabel(lang), url: AppStrings.EMERGENCY_OUTAGES_URL, tile: Color(argb: 0xFF1877F2), enabled: !isQueueUnselected, lang: lang) {
                        Text(verbatim: "f").font(.system(size: 24, weight: .black, design: .rounded)).foregroundStyle(Color.white)
                    }
                    LinkCard(title: AppStrings.siteSchedulesLabel(lang), url: AppStrings.SITE_SCHEDULES_URL, tile: ZtColors.accent, enabled: !isQueueUnselected, lang: lang) {
                        Image(systemName: "globe").font(.system(size: 18, weight: .semibold)).foregroundStyle(Color.white)
                    }

                    // room for the floating navigation dock
                    Spacer(minLength: 96)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }
            .scrollDisabled(isQueueUnselected)
            .opacity(isQueueUnselected ? 0.15 : 1)
            // the overlay below is the only interactive thing: hide this layer from VoiceOver too
            .accessibilityHidden(isQueueUnselected)
            .allowsHitTesting(!isQueueUnselected)

            if isQueueUnselected {
                FirstLaunchOverlay(model: model)
            }
        }
        // another address starts on Today (spec/SUBSCRIPTIONS.md 9)
        .onChange(of: model.shownSubscriptionId) { _, _ in isTomorrow = false }
    }

    // MARK: - Pieces

    private func header(queue: String, hideQueue: Bool, address: String?, interactive: Bool) -> some View {
        HStack(alignment: .center) {
            if hideQueue {
                Color.clear.frame(height: ZtMinTouch).frame(maxWidth: .infinity)
            } else {
                VStack(alignment: .leading, spacing: 0) {
                    Text(verbatim: "\(AppStrings.queue(lang)) \(queue)").ztText(ZtType.title).foregroundStyle(Color.white)
                    Text(verbatim: address ?? AppStrings.mainUtilityName())
                        .ztText(ZtType.caption)
                        .foregroundStyle(UiColors.textSecondaryHi)
                        .lineLimit(3)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.trailing, 12)
            }
            NotificationPill(enabled: model.alertsMaster, interactive: interactive, lang: lang) {
                model.setMaster(!model.alertsMaster)
            }
        }
        .padding(.top, 4)
    }

    /// "No address has alerts turned on" under the bell, with a way to Settings.
    private var noAlertsCaption: some View {
        HStack(spacing: 8) {
            Text(verbatim: AppStrings.noAddressAlerts(lang))
                .ztText(ZtType.caption)
                .foregroundStyle(ZtColors.accent)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button {
                model.go(to: 1)
            } label: {
                Text(verbatim: AppStrings.settingsTitle(lang))
                    .ztText(ZtType.label.weight(.bold))
                    .foregroundStyle(Color.white)
                    .padding(.horizontal, 8)
                    .frame(minHeight: ZtMinTouch)
            }
            .buttonStyle(ZtPressStyle())
        }
    }

    @ViewBuilder
    private func hero(customNoQueue: Bool, isStatusUnclear: Bool) -> some View {
        ZtGlassCard(padding: 18) {
            if customNoQueue {
                Text(verbatim: "--:--:--")
                    .ztText(ZtType.display)
                    .foregroundStyle(Color.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                    .dynamicTypeSize(...DynamicTypeSize.xLarge)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
            } else {
                let isOff = status.isBlackoutNow
                let off = !isStatusUnclear && isOff
                VStack(spacing: 0) {
                    HStack(spacing: 8) {
                        StatusDot(color: isStatusUnclear ? ZtChipTone.grey.text : isOff ? ZtColors.accent : ZtChipTone.green.text, pulsing: off)
                        Text(verbatim: isStatusUnclear ? AppStrings.powerUnclear(lang) : isOff ? AppStrings.powerOff(lang) : AppStrings.powerOn(lang))
                            .ztText(ZtType.label.weight(.bold))
                            .foregroundStyle(Color.white)
                            .lineLimit(2)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        HStack(spacing: 4) {
                            Image(systemName: "clock").font(.system(size: 12, weight: .semibold))
                            Text(verbatim: String(format: "%02d:%02d", snapshot.now.hour, snapshot.now.minute))
                                .ztText(ZtType.captionMono)
                                .fixedSize()
                        }
                        .foregroundStyle(UiColors.textSecondaryHi)
                    }
                    Spacer().frame(height: 14)
                    Text(verbatim: off ? AppStrings.powerOnIn(lang) : AppStrings.powerOffIn(lang))
                        .ztText(ZtType.caption)
                        .foregroundStyle(UiColors.textSecondaryHi)
                        .multilineTextAlignment(.center)
                    Spacer().frame(height: 4)
                    // the countdown never wraps: Dynamic Type is capped on this one node
                    Text(verbatim: status.countdownText)
                        .ztText(ZtType.display)
                        .foregroundStyle(Color.white)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                        .dynamicTypeSize(...DynamicTypeSize.xLarge)
                        .contentTransition(.numericText())
                    let period = isStatusUnclear ? "--:-- - --:--" : status.nextSlotTime
                    if !period.isEmpty && period != "Відключень немає" {
                        Spacer().frame(height: 14)
                        DividerLine()
                        Spacer().frame(height: 10)
                        HStack(spacing: 8) {
                            Text(verbatim: off ? AppStrings.outagePeriod(lang) : AppStrings.nextPeriod(lang))
                                .ztText(ZtType.caption)
                                .foregroundStyle(UiColors.textSecondaryHi)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            Text(verbatim: period)
                                .ztText(ZtType.label.monospaced().weight(.bold))
                                .foregroundStyle(Color.white)
                                .lineLimit(1)
                                .fixedSize()
                                .padding(.horizontal, 10)
                                .padding(.vertical, 4)
                                .background { RoundedRectangle(cornerRadius: ZtRadius.badge).fill(Color(argb: 0x26FFFFFF)) }
                        }
                    }
                }
                .accessibilityElement(children: .combine)
            }
        }
    }

    // MARK: - Helpers

    /// "Житомир, вул. Київська, 1" -> city line and street line.
    static func formatAddressAfterCity(_ address: String?) -> String? {
        guard let address, !address.ktIsBlank else { return nil }
        let trimmed = address.ktTrim()
        if let comma = trimmed.firstIndex(of: ",") {
            let city = String(trimmed[...comma]).ktTrim()
            let street = String(trimmed[trimmed.index(after: comma)...]).ktTrim()
            if !street.isEmpty { return "\(city)\n\(street)" }
        }
        return trimmed
    }

    /// 48 light half-hours for a building that hourly schedules never switch off.
    static let lightNoOutageSlots: [BlackoutSlot] = (0..<48).map { i in
        let sMin = i * 30
        let eMin = sMin + 30
        let start = String(format: "%02d:%02d", sMin / 60, sMin % 60)
        let end = String(format: "%02d:%02d", eMin / 60, eMin % 60)
        return BlackoutSlot(id: "light_\(i)", startHour: sMin / 60, endHour: eMin / 60, startMinute: sMin % 60, endMinute: eMin % 60,
                            startTimeStr: start, endTimeStr: end, status: .POWER_ON)
    }
}

// MARK: - Main page pieces

/// Status dot of the hero; pulses while the power is off (still under Reduce Motion).
private struct StatusDot: View {
    let color: Color
    let pulsing: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var big = false

    var body: some View {
        Circle().fill(color).frame(width: 10, height: 10)
            .scaleEffect(pulsing && !reduceMotion ? (big ? 1.25 : 0.85) : 1)
            .onAppear { big = true }
            .animation(pulsing && !reduceMotion ? .easeInOut(duration: 0.9).repeatForever(autoreverses: true) : .default, value: big)
            .accessibilityHidden(true)
    }
}

/// 58 x 34 pill switch of the notification master; the touch target is 48 pt tall.
private struct NotificationPill: View {
    let enabled: Bool
    let interactive: Bool
    let lang: String
    let onToggle: () -> Void

    var body: some View {
        Button(action: onToggle) {
            Capsule()
                .fill(enabled ? ZtColors.accent : Color(argb: 0x26FFFFFF))
                .frame(width: 58, height: 34)
                .overlay(alignment: enabled ? .trailing : .leading) {
                    Circle().fill(Color.white).frame(width: 26, height: 26)
                        .overlay {
                            Image(systemName: enabled ? "bell.fill" : "bell.slash.fill")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(enabled ? ZtColors.accent : Color(argb: 0xFF6B7280))
                        }
                        .padding(4)
                }
                .frame(minHeight: ZtMinTouch)
                .contentShape(Rectangle())
        }
        .buttonStyle(ZtPressStyle())
        .disabled(!interactive)
        .animation(.easeInOut(duration: 0.2), value: enabled)
        .accessibilityLabel(Text(verbatim: AppStrings.notifications(lang)))
        .accessibilityValue(Text(verbatim: enabled ? AppStrings.switchOn(lang) : AppStrings.switchOff(lang)))
        .accessibilityAddTraits(.isToggle)
    }
}

/// Featured emergency outage (active, overdue or the next upcoming one).
private struct EmergencyBanner: View {
    let outage: Outage
    let now: LocalDateTime
    let lang: String

    private static func format(_ t: LocalDateTime) -> String {
        String(format: "%02d.%02d.%04d %02d:%02d", t.date.day, t.date.month, t.date.year, t.hour, t.minute)
    }

    var body: some View {
        let state = outage.statusAt(now)
        let title: String = {
            if lang == "uk", let label = outage.label, !label.ktIsBlank { return label }
            return state == .UPCOMING ? AppStrings.emergencyUpcomingTitle(lang) : AppStrings.emergencyOutageTitle(lang)
        }()
        let restore = outage.overdue || !outage.end.isAfter(outage.start) ? "--:--" : Self.format(outage.end)
        ZtGlassCard {
            VStack(alignment: .leading, spacing: 6) {
                Text(verbatim: title).ztText(ZtType.subhead).foregroundStyle(ZtColors.accent)
                VStack(alignment: .leading, spacing: 2) {
                    line(AppStrings.emergencyStartLabel(lang), Self.format(outage.start))
                    line(AppStrings.emergencyRestoreLabel(lang), restore)
                    if state == .OVERDUE {
                        Text(verbatim: AppStrings.rowOverdue(lang)).ztText(ZtType.caption).foregroundStyle(UiColors.textSecondaryHi)
                    }
                }
            }
        }
        .accessibilityElement(children: .combine)
    }

    private func line(_ label: String, _ value: String) -> some View {
        HStack(spacing: 8) {
            Text(verbatim: label).ztText(ZtType.caption).foregroundStyle(UiColors.textSecondaryHi)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text(verbatim: value).ztText(ZtType.captionMono).foregroundStyle(Color.white).lineLimit(1).fixedSize()
        }
    }
}

/// One chip per address, the primary with a star; scrolls sideways when the labels do not fit.
private struct AddressSwitcher: View {
    let addresses: [Subscription]
    let primaryId: String?
    let shownId: String?
    let lang: String
    let onSelect: (String) -> Void
    @Namespace private var glass

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            ZtGlassGroup(spacing: 8) {
                HStack(spacing: 8) {
                    ForEach(addresses, id: \.id) { item in
                        let selected = item.id == shownId
                        Button { onSelect(item.id) } label: {
                            HStack(spacing: 6) {
                                if item.id == primaryId {
                                    Image(systemName: "star.fill").font(.system(size: 13)).foregroundStyle(ZtColors.accent)
                                        .accessibilityLabel(Text(verbatim: AppStrings.primaryBadge(lang)))
                                }
                                Text(verbatim: Subscriptions.displayLabel(item))
                                    .ztText(ZtType.label.weight(.bold))
                                    .foregroundStyle(selected ? Color.white : UiColors.tabIdle)
                                    .lineLimit(1)
                                    .fixedSize()
                            }
                            .padding(.horizontal, 14)
                            .frame(minHeight: ZtMinTouch)
                            .ztGlassSurface(
                                cornerRadius: ZtRadius.chip,
                                tint: selected ? Color(argb: 0x33FFFFFF) : Color(argb: 0x80141A29),
                                border: selected ? Color(argb: 0x66FFFFFF) : Color(argb: 0x1FFFFFFF),
                                interactive: true
                            )
                            .ztGlassID(item.id, in: glass)
                        }
                        .buttonStyle(ZtPressStyle())
                        .accessibilityAddTraits(selected ? [.isSelected] : [])
                    }
                }
            }
            .padding(.vertical, 2)
        }
    }
}

/// Today / Tomorrow segmented tabs on a dark glass strip.
private struct DayTabs: View {
    @Binding var isTomorrow: Bool
    let enabled: Bool
    let lang: String

    var body: some View {
        HStack(spacing: 0) {
            tab(AppStrings.today(lang), selected: !isTomorrow) { isTomorrow = false }
            tab(AppStrings.tomorrow(lang), selected: isTomorrow) { isTomorrow = true }
        }
        .padding(4)
        .ztGlassSurface(cornerRadius: ZtRadius.control, tint: Color(argb: 0x80141A29))
        .disabled(!enabled)
    }

    private func tab(_ text: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button {
            withAnimation(.easeInOut(duration: 0.2)) { action() }
        } label: {
            Text(verbatim: text)
                .ztText(ZtType.label.weight(.bold))
                .foregroundStyle(selected ? Color.white : UiColors.tabIdle)
                .lineLimit(1)
                .frame(maxWidth: .infinity, minHeight: ZtMinTouch)
                .background { RoundedRectangle(cornerRadius: ZtRadius.chip).fill(selected ? Color(argb: 0x33FFFFFF) : Color.clear) }
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? [.isSelected] : [])
    }
}

private struct LabelledValue: View {
    let label: String
    let value: String

    var body: some View {
        HStack(spacing: 6) {
            Text(verbatim: label).ztText(ZtType.caption).foregroundStyle(UiColors.textTertiaryHi)
            Text(verbatim: value).ztText(ZtType.captionMono).foregroundStyle(Color.white).lineLimit(1).fixedSize()
        }
        .accessibilityElement(children: .combine)
    }
}

/// 42 pt white refresh disc in a 48 pt target; the arrow rotates while a refresh runs.
private struct RefreshDisc: View {
    let enabled: Bool
    let busy: Bool
    let lang: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Circle().fill(Color.white).frame(width: 42, height: 42)
                .overlay {
                    Image(systemName: "arrow.clockwise").font(.system(size: 17, weight: .bold)).foregroundStyle(Color.black).spinWhile(busy)
                }
                .frame(width: ZtMinTouch, height: ZtMinTouch)
                .contentShape(Circle())
        }
        .buttonStyle(ZtPressStyle())
        .disabled(!enabled || busy)
        .accessibilityLabel(Text(verbatim: AppStrings.refreshBtn(lang)))
        .accessibilityValue(Text(verbatim: busy ? AppStrings.refreshing(lang) : ""))
    }
}

/// Card with one link row: icon tile, title and the full URL (two lines, then ellipsis). Opens Safari.
struct LinkCard<Icon: View>: View {
    let title: String
    let url: String
    let tile: Color
    let enabled: Bool
    let lang: String
    @ViewBuilder let icon: () -> Icon

    var body: some View {
        ZtGlassCard(padding: 14) {
            Button { openExternal(url) } label: {
                HStack(spacing: 10) {
                    RoundedRectangle(cornerRadius: ZtRadius.badge).fill(tile).frame(width: 36, height: 36).overlay { icon() }
                    VStack(alignment: .leading, spacing: 0) {
                        Text(verbatim: title).ztText(ZtType.label.weight(.bold)).foregroundStyle(Color.white)
                        Text(verbatim: url).ztText(ZtType.captionMono.weight(.regular)).foregroundStyle(UiColors.textTertiaryHi).lineLimit(2)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    Image(systemName: "arrow.up.right.square").font(.system(size: 15)).foregroundStyle(UiColors.textTertiaryHi)
                }
                .padding(12)
                .background { RoundedRectangle(cornerRadius: ZtRadius.row).fill(ZtColors.innerRow) }
                .contentShape(Rectangle())
            }
            .buttonStyle(ZtPressStyle())
            .disabled(!enabled)
            .accessibilityHint(Text(verbatim: AppStrings.externalLinkIos(lang)))
        }
    }
}

/// First launch / no queue: dark dim, the accent "Select queue" button and the language switch.
private struct FirstLaunchOverlay: View {
    @ObservedObject var model: AppModel

    var body: some View {
        let lang = model.lang
        VStack(spacing: 24) {
            Button {
                model.autoOpenQueueHelp = true
                model.go(to: 1)
            } label: {
                VStack(spacing: 6) {
                    // white label on the accent fill (owner request; large bold title)
                    Text(verbatim: AppStrings.selectQueueAction(lang))
                        .ztText(ZtType.title.weight(.heavy))
                        .multilineTextAlignment(.center)
                    Text(verbatim: AppStrings.mainUtilityName())
                        .ztText(ZtType.label.weight(.bold))
                        .multilineTextAlignment(.center)
                }
                .foregroundStyle(Color.white)
                .padding(.horizontal, 32)
                .padding(.vertical, 20)
                .frame(minWidth: 260, minHeight: ZtMinTouch)
                .background {
                    RoundedRectangle(cornerRadius: ZtRadius.card).fill(ZtColors.accent)
                        .overlay(RoundedRectangle(cornerRadius: ZtRadius.card).strokeBorder(Color(argb: 0x40FFFFFF), lineWidth: 1))
                }
            }
            .buttonStyle(ZtPressStyle())

            LanguageSwitch(selected: model.settings.language, lang: lang) { model.setLanguage($0) }

            // not an official service, data from ztoe.com.ua: shown here once and in About (App Review item R2)
            Text(verbatim: AppStrings.disclaimerText(lang))
                .ztText(ZtType.caption)
                .foregroundStyle(ZtColors.textSecondary)
                .multilineTextAlignment(.center)
                .containerRelativeFrame(.horizontal) { w, _ in w * 0.9 }
        }
        .padding(.horizontal, 24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// Three-segment language switch of the first-launch overlay; stacks at large text sizes instead of clipping.
private struct LanguageSwitch: View {
    let selected: String
    let lang: String
    let onChange: (String) -> Void
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        let options = [LangOption(code: "SYSTEM", label: AppStrings.mainLangAuto(lang)), LangOption(code: "en", label: "English"), LangOption(code: "uk", label: "Українська")]
        let layout = typeSize > .xLarge ? AnyLayout(VStackLayout(spacing: 4)) : AnyLayout(HStackLayout(spacing: 4))
        layout {
            ForEach(options, id: \.code) { option in
                let code = option.code
                let label = option.label
                let active = selected.caseInsensitiveCompare(code) == .orderedSame
                Button { onChange(code) } label: {
                    Text(verbatim: label)
                        .ztText(ZtType.label.weight(.bold))
                        .foregroundStyle(active ? Color.black : UiColors.textSecondaryHi)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity, minHeight: ZtMinTouch)
                        .background { RoundedRectangle(cornerRadius: ZtRadius.chip).fill(active ? Color.white : Color.clear) }
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(active ? [.isSelected] : [])
            }
        }
        .padding(6)
        .background {
            RoundedRectangle(cornerRadius: ZtRadius.control).fill(Color(argb: 0xE6141A29))
                .overlay(RoundedRectangle(cornerRadius: ZtRadius.control).strokeBorder(Color(argb: 0x33FFFFFF), lineWidth: 1))
        }
        .containerRelativeFrame(.horizontal) { w, _ in w * 0.9 }
    }
}

/// One segment of a language switch.
struct LangOption: Hashable {
    let code: String
    let label: String
}
