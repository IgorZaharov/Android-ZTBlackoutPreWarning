import SwiftUI

/// The three pages side by side with page swipes, over the time-of-day background, with the floating
/// dock and the in-app banner (port of Android ui/screens/BlackoutAppNavigation.kt). The app is
/// dark-on-glass whatever the system appearance, as on Android.
struct RootView: View {
    @StateObject private var model = AppModel()
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// Scroll position of the pager in pages, written every frame of a swipe. A separate observable, so only the
    /// background that draws the parallax re-renders, not this view and the three pages under it.
    @State private var pagerMotion = PagerMotion()
    /// The page the scroll view is on; `model.page` follows it once the swipe has settled,
    /// so the whole app does not re-render in the middle of the swipe.
    @State private var scrolledPage: Int? = 0
    @State private var paletteMinute = KyivZone.minuteOfDay()
    /// Tour targets of the main window (spec/ONBOARDING.md); the address lookup collects its own.
    @State private var coachRects: [String: CGRect] = [:]

    private var page: Int { model.page ?? 0 }

    /// What decides the fetch: the queue, its status text, the site and the address (Android LaunchedEffect keys).
    private var selectionKey: String {
        let s = model.settings
        let q = s.selectedAddressQuery
        return [s.queue, s.customQueueStatusText ?? "", s.cityUrl, q?.remId ?? "", q?.settlementId ?? "", q?.streetId ?? "", q?.house ?? ""]
            .joined(separator: "|")
    }

    var body: some View {
        let unselected = model.isQueueUnselected
        ZStack(alignment: .top) {
            // recomputed once a minute, not every second (Android keys it by minute-of-day too)
            PagerBackground(palette: TimeOfDayPalette.colors(hour: paletteMinute / 60, minute: paletteMinute % 60),
                            motion: pagerMotion, dimmed: unselected)

            GeometryReader { outer in
              ScrollViewReader { proxy in
                ScrollView(.horizontal) {
                    HStack(spacing: 0) {
                        ForEach(0..<3, id: \.self) { index in
                            pageView(index)
                                .containerRelativeFrame(.horizontal)
                                .scrollTransition(.interactive, axis: .horizontal) { content, phase in
                                    // the page leaving dims and recedes a little (only fades under Reduce Motion)
                                    let away = min(1, abs(phase.value))
                                    return content
                                        .opacity(1 - 0.35 * away)
                                        .scaleEffect(reduceMotion ? 1 : 1 - 0.05 * away)
                                }
                                .id(index)
                        }
                    }
                    .scrollTargetLayout()
                    .background(GeometryReader { g in
                        Color.clear.preference(key: PagerOffset.self, value: -g.frame(in: .named("pager")).minX / max(1, outer.size.width))
                    })
                }
                .coordinateSpace(name: "pager")
                .scrollTargetBehavior(.paging)
                .scrollPosition(id: $scrolledPage)
                .scrollIndicators(.hidden)
                .scrollDisabled(unselected)
                .onPreferenceChange(PagerOffset.self) { pagerMotion.position = $0 }
                // the app learns the page only after the swipe settles (Android settledPage)
                .task(id: scrolledPage) {
                    guard let target = scrolledPage, target != model.page else { return }
                    try? await Task.sleep(for: .milliseconds(300))
                    guard !Task.isCancelled else { return }
                    model.page = target
                }
                // a page asked for by the app (dock, "Select queue", reset); also the one a launch
                // argument set before the first layout, which scrollPosition alone ignores
                .onChange(of: model.pageJump) { _, jump in
                    withAnimation(ZtMotion.pageGlide) { proxy.scrollTo(jump.page, anchor: .leading) }
                }
                .onAppear {
                    // the settle task above must not move a launch page back to 0
                    scrolledPage = model.page
                    let start = model.pageJump.page
                    if start != 0 { DispatchQueue.main.async { proxy.scrollTo(start, anchor: .leading) } }
                }
              }
            }

            if let message = model.bannerMessage {
                AppBanner(message: message)
                    .padding(.top, 12)
                    .padding(.horizontal, 20)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .zIndex(2)
            }
        }
        .overlay(alignment: .bottom) {
            Dock(page: scrolledPage ?? page, enabled: !unselected) { target in
                model.go(to: target)
            } onDoubleTap: { target in
                model.scrollToTop(target)
            }
            .padding(.bottom, 16)
            .opacity(unselected ? 0.15 : 1)
        }
        .onPreferenceChange(CoachRectsKey.self) { coachRects = $0 }
        // First-run tour on the main window: RENAME, ALERTS (Settings) and ABOUT (main screen)
        .overlay { tourOverlay }
        .onChange(of: tourStep) { _, step in if step == .rename { model.tourReachedRename = true } }
        .onChange(of: page) { _, _ in
            if model.tourActive && OnboardingTour.finishedBy(tourPage, reachedRename: model.tourReachedRename) { model.endTour() }
        }
        .preferredColorScheme(.dark)
        .task { await model.prefetchAddressIndex() }
        // refresh both sources when the queue, site or address changes (and once at launch)
        .task(id: selectionKey) { await model.selectionChanged() }
        // entering the main page: fresh numbers at once, then a quiet refresh
        .onChange(of: page) { _, p in if p == 0 { Task { await model.mainPageShown() } } }
        // live countdown while the main page is in front and the app is active (battery friendly)
        .task(id: "\(page == 0)|\(scenePhase == .active)") {
            guard page == 0, scenePhase == .active else { return }
            while !Task.isCancelled {
                let delay = model.tick()
                let minute = KyivZone.minuteOfDay()
                if minute != paletteMinute { paletteMinute = minute }
                try? await Task.sleep(for: delay)
            }
        }
        .onChange(of: scenePhase, initial: true) { _, phase in
            switch phase {
            // a widget or a background refresh may have written while the app was away; the permission
            // may have changed in iOS Settings; the warnings are re-planned
            case .active:
                model.foreground()
                // ask iOS for the next background refresh (BackgroundRefresh.swift); the scene is set up,
                // so its `.backgroundTask` handler is registered
                BackgroundRefresh.schedule()
            case .background: BackgroundRefresh.schedule()
            default: break
            }
        }
        // a tapped notification shows its address (also when the tap launched the app)
        .onReceive(NotificationRouter.shared.$tapped) { tap in
            guard let tap else { return }
            model.openFromNotification(tap.subscriptionId)
            NotificationRouter.shared.tapped = nil
        }
        // a widget tap: svitlozt://open?item=<subscription id> shows that address (spec/SUBSCRIPTIONS.md 10)
        .onOpenURL { url in
            let item = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first { $0.name == "item" }?.value
            model.openFromNotification(item)
        }
    }

    private var tourPage: TourPage { page == 0 ? .schedule : page == 1 ? .settings : .about }

    private var tourStep: TourStep {
        OnboardingTour.step(TourInput(
            active: model.tourActive, lookupOpen: false, resultShown: false, page: tourPage,
            hasAddress: !model.subscriptions.items.isEmpty,
            reachedRename: model.tourReachedRename, renameDone: model.tourRenameDone
        ))
    }

    @ViewBuilder
    private var tourOverlay: some View {
        let lang = model.lang
        switch tourStep {
        case .rename:
            CoachOverlay(
                rects: coachRects,
                holes: [["rename"]],
                tips: [CoachTip(anchor: ["rename"], text: AppStrings.tourRename(lang), next: true, skip: true)],
                lang: lang,
                onSkip: { model.endTour() },
                onNext: { model.tourRenameDone = true }
            )
        case .alerts:
            let switches = ["alert-planned", "alert-emergency"]
            CoachOverlay(
                rects: coachRects,
                holes: [switches, ["dock-home"]],
                tips: [
                    CoachTip(anchor: switches, text: AppStrings.tourAlerts(lang), skip: true),
                    CoachTip(anchor: ["dock-home"], text: AppStrings.tourBack(lang))
                ],
                lang: lang,
                onSkip: { model.endTour() }
            )
        case .about:
            CoachOverlay(
                rects: coachRects,
                holes: [["dock-about"]],
                tips: [CoachTip(anchor: ["dock-about"], text: AppStrings.tourDonate(lang), done: true)],
                lang: lang,
                onSkip: { model.endTour() },
                onDone: { model.endTour() }
            )
        default:
            EmptyView()
        }
    }

    @ViewBuilder
    private func pageView(_ index: Int) -> some View {
        switch index {
        case 0: MainScreen(model: model)
        case 1: SettingsScreen(model: model, isVisible: page == 1)
        default: AboutScreen(lang: model.lang, scrollTop: model.scrollTop)
        }
    }
}

private struct PagerOffset: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = nextValue() }
}

/// Top banner with the app icon (white bolt on the accent square), replaces Android's toast.
private struct AppBanner: View {
    let message: String

    var body: some View {
        HStack(spacing: 10) {
            RoundedRectangle(cornerRadius: 8).fill(ZtColors.accent).frame(width: 28, height: 28)
                .overlay { Image(systemName: "bolt.fill").font(.system(size: 14, weight: .bold)).foregroundStyle(Color.white) }
            Text(verbatim: message).ztText(ZtType.caption.weight(.bold)).foregroundStyle(Color.white)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background { RoundedRectangle(cornerRadius: 20).fill(Color(argb: 0xF2141A29)) }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.updatesFrequently)
        .onAppear { UIAccessibility.post(notification: .announcement, argument: message) }
    }
}

/// Floating capsule with the three page buttons; the shown page is a white disc. A tap switches to the page at
/// once; a second tap on the same button within `doubleTapWindow` also scrolls that page to its top (owner,
/// 2026-11-15). Timed by hand, so a single tap never waits for a double-tap gesture to fail.
private struct Dock: View {
    let page: Int
    let enabled: Bool
    let onSelect: (Int) -> Void
    let onDoubleTap: (Int) -> Void

    static let doubleTapWindow: TimeInterval = 0.4
    @State private var lastTap: (index: Int, at: Date)?

    private let items: [(icon: String, label: String)] = [("house.fill", "Графік"), ("gearshape.fill", "Налаштування"), ("info.circle.fill", "Про додаток")]

    var body: some View {
        ZtGlassGroup(spacing: 12) {
            HStack(spacing: 12) {
                ForEach(0..<3, id: \.self) { i in
                    let selected = page == i
                    Button {
                        let now = Date()
                        if let last = lastTap, last.index == i, now.timeIntervalSince(last.at) < Self.doubleTapWindow {
                            lastTap = nil
                            onSelect(i)
                            onDoubleTap(i)
                        } else {
                            lastTap = (i, now)
                            onSelect(i)
                        }
                    } label: {
                        Circle().fill(selected ? Color.white : Color.clear).frame(width: 44, height: 44)
                            .overlay {
                                Image(systemName: items[i].icon).font(.system(size: 18, weight: .semibold))
                                    .foregroundStyle(selected ? Color.black : Color(argb: 0xB3BAE6FD))
                            }
                            .contentShape(Circle())
                    }
                    .buttonStyle(ZtPressStyle())
                    .coachTarget(i == 0 ? "dock-home" : i == 2 ? "dock-about" : "dock-settings")
                    .accessibilityLabel(Text(verbatim: items[i].label))
                    .accessibilityAddTraits(selected ? [.isSelected] : [])
                }
            }
            .padding(6)
            .ztGlassSurface(cornerRadius: 32, tint: Color(argb: 0xB8141A29), interactive: true)
        }
        .disabled(!enabled)
    }
}

/// The pager's scroll position in pages (0, 1, 2 and fractions while swiping). Observation tracks it per
/// view, so writing it every frame re-renders only `PagerBackground`.
@Observable
final class PagerMotion {
    var position: CGFloat = 0
}

/// The ambient background with the swipe parallax; the only reader of `PagerMotion.position`.
private struct PagerBackground: View {
    let palette: TimePaletteColors
    let motion: PagerMotion
    let dimmed: Bool

    var body: some View {
        AmbientBackground(palette: palette, pagePosition: motion.position, dimmed: dimmed)
    }
}
