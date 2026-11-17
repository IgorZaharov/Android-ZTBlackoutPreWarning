import SwiftUI

/// First-run tour (spec/ONBOARDING.md); port of android ui/components/OnboardingTour.kt and CoachMarks.kt,
/// cases in OnboardingTourTests.swift (the same as OnboardingTourTest.kt and tests/onboarding.test.ts).
///
/// The tour starts when a new user taps the first-launch «Виберіть чергу» button and walks them through:
///  PICK   - the address lookup: settlement, street and house are lit, the rest is dimmed;
///  APPLY  - the result card: the «Обрати чергу» button is ringed;
///  RENAME - Settings with the new address: an arrow at its rename button («Далі» or the rename dialog goes on);
///  ALERTS - its planned and emergency alert switches, and an arrow at the dock's home button;
///  ABOUT  - the main screen: an arrow at the dock's About button, «Або допоможіть волонтерам...».
/// It ends on «Зрозуміло», on «Пропустити підказки» or when About is opened, and is never shown again.
enum TourStep: Equatable { case none, pick, apply, rename, alerts, about }

enum TourPage: Equatable { case schedule, settings, about, other }

struct TourInput {
    /// The tour was started (first-launch button) and not finished or skipped.
    var active: Bool
    /// The address lookup is open.
    var lookupOpen: Bool
    /// The lookup shows a result card.
    var resultShown: Bool
    var page: TourPage
    /// At least one address or queue is saved.
    var hasAddress: Bool
    /// The RENAME step was shown, so the main screen goes on to ABOUT.
    var reachedRename: Bool
    /// «Далі» was tapped on RENAME, or the rename dialog was closed: Settings goes on to ALERTS.
    var renameDone: Bool
    /// Another dialog is on top: the tour waits.
    var covered: Bool = false
}

enum OnboardingTour {
    static func step(_ i: TourInput) -> TourStep {
        if !i.active || i.covered { return .none }
        if i.lookupOpen { return i.resultShown ? .apply : .pick }
        if !i.hasAddress { return .none }
        if i.page == .settings { return i.renameDone ? .alerts : .rename }
        if i.page == .schedule && i.reachedRename { return .about }
        return .none
    }

    /// Opening About after the RENAME step finishes the tour (the donations are there).
    static func finishedBy(_ page: TourPage, reachedRename: Bool) -> Bool { page == .about && reachedRename }

    /// "The tour was finished or skipped": never shown again (a reinstall shows it again).
    private static let doneKey = "onboarding_done"
    static var isDone: Bool { UserDefaults.standard.bool(forKey: doneKey) }
    static func setDone(_ done: Bool) { UserDefaults.standard.set(done, forKey: doneKey) }
}

// MARK: - Spotlight overlay

/// Frames of the tour targets in global coordinates, collected up the view tree.
struct CoachRectsKey: PreferenceKey {
    static var defaultValue: [String: CGRect] = [:]
    static func reduce(value: inout [String: CGRect], nextValue: () -> [String: CGRect]) {
        value.merge(nextValue()) { $1 }
    }
}

extension View {
    /// Registers this view as tour target `key` (spec/ONBOARDING.md). A full-screen cover is its own
    /// hierarchy, so the address lookup collects its own targets and draws its own overlay.
    func coachTarget(_ key: String) -> some View {
        background(GeometryReader { g in Color.clear.preference(key: CoachRectsKey.self, value: [key: g.frame(in: .global)]) })
    }
}

/// One tip: an arrow and a text next to `anchor` (the union of its keys), outside it.
struct CoachTip {
    var anchor: [String]
    var text: String
    /// The control to use next, ringed in the accent colour.
    var ring: String? = nil
    /// «Далі» goes on to the next step.
    var next = false
    /// «Зрозуміло» ends the tour.
    var done = false
    /// «Пропустити підказки» (one tip per step).
    var skip = false
}

private func coachUnion(_ rects: [String: CGRect], _ keys: [String]) -> CGRect? {
    let found = keys.compactMap { rects[$0] }
    guard var r = found.first else { return nil }
    for f in found.dropFirst() { r = r.union(f) }
    return r
}

/// Dims the screen except the `holes` (each the union of its keys) and draws the `tips`. The dim layer takes
/// no touches, so the user works with the lit controls directly; only the tips' buttons take touches.
/// Draws nothing until a tip's anchor is on screen.
struct CoachOverlay: View {
    let rects: [String: CGRect]
    let holes: [[String]]
    let tips: [CoachTip]
    let lang: String
    var onSkip: () -> Void
    var onNext: () -> Void = {}
    var onDone: () -> Void = {}

    static let holePad: CGFloat = 6
    static let holeRadius: CGFloat = 14
    static let dim = Color(argb: 0xC705080F)

    var body: some View {
        GeometryReader { geo in
            let origin = geo.frame(in: .global).origin
            let local = { (r: CGRect) in r.offsetBy(dx: -origin.x, dy: -origin.y) }
            let shown: [(CoachTip, CGRect)] = tips.compactMap { t in coachUnion(rects, t.anchor).map { (t, local($0)) } }
            if !shown.isEmpty {
                let holeRects = holes.compactMap { coachUnion(rects, $0).map(local) }
                ZStack(alignment: .topLeading) {
                    Canvas { ctx, size in
                        var path = Path(CGRect(origin: .zero, size: size))
                        for h in holeRects {
                            path.addRoundedRect(in: h.insetBy(dx: -Self.holePad, dy: -Self.holePad),
                                                cornerSize: CGSize(width: Self.holeRadius, height: Self.holeRadius))
                        }
                        ctx.fill(path, with: .color(Self.dim), style: FillStyle(eoFill: true))
                    }
                    .allowsHitTesting(false)
                    ForEach(shown.indices, id: \.self) { i in
                        CoachTipMark(
                            tip: shown[i].0,
                            anchor: shown[i].1,
                            ring: shown[i].0.ring.flatMap { rects[$0] }.map(local),
                            size: geo.size,
                            lang: lang,
                            onSkip: onSkip,
                            onNext: onNext,
                            onDone: onDone
                        )
                        // a new tip is a new view: its arrow animation restarts and VoiceOver announces it
                        .id(shown[i].0.text)
                    }
                }
            }
        }
        .ignoresSafeArea()
    }
}

private struct CoachTipMark: View {
    let tip: CoachTip
    let anchor: CGRect
    let ring: CGRect?
    let size: CGSize
    let lang: String
    let onSkip: () -> Void
    let onNext: () -> Void
    let onDone: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var nudge = false
    private let arrowSize: CGFloat = 32

    var body: some View {
        // above the anchor when its centre is in the lower 55 % of the screen, otherwise below it
        let above = anchor.midY > size.height * 0.45
        let arrowTop = above ? anchor.minY - CoachOverlay.holePad - 4 - arrowSize : anchor.maxY + CoachOverlay.holePad + 4
        let bubbleWidth = min(260, size.width - 24)
        let bubbleLeft = min(max(12, anchor.midX - bubbleWidth / 2), max(12, size.width - 12 - bubbleWidth))
        let nudgeY: CGFloat = nudge ? (above ? 8 : -8) : 0
        ZStack(alignment: .topLeading) {
            if let ring {
                RoundedRectangle(cornerRadius: 16)
                    .strokeBorder(ZtColors.accent, lineWidth: 2)
                    .frame(width: ring.width + 6, height: ring.height + 6)
                    .offset(x: ring.minX - 3, y: ring.minY - 3)
                    .allowsHitTesting(false)
            }
            Image(systemName: above ? "arrow.down" : "arrow.up")
                .font(.system(size: 28, weight: .heavy))
                .foregroundStyle(ZtColors.accent)
                .frame(width: arrowSize, height: arrowSize)
                .offset(x: anchor.midX - arrowSize / 2, y: arrowTop + nudgeY)
                .allowsHitTesting(false)
                .accessibilityHidden(true)
            bubble
                .frame(width: bubbleWidth)
                .padding(.leading, bubbleLeft)
                .padding(above ? .bottom : .top, above ? max(0, size.height - (arrowTop - 2)) : arrowTop + arrowSize + 2)
                .frame(width: size.width, height: size.height, alignment: above ? .bottomLeading : .topLeading)
        }
        .onAppear {
            UIAccessibility.post(notification: .announcement, argument: tip.text)
            guard !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 0.7).repeatForever(autoreverses: true)) { nudge = true }
        }
    }

    private var bubble: some View {
        VStack(spacing: 10) {
            Text(verbatim: tip.text)
                .ztText(ZtType.body.weight(.bold))
                .foregroundStyle(Color.white)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            if tip.next || tip.done {
                Button {
                    if tip.done { onDone() } else { onNext() }
                } label: {
                    Text(verbatim: tip.done ? AppStrings.tourGotIt(lang) : AppStrings.tourNext(lang))
                        .ztText(ZtType.label.weight(.heavy))
                        .foregroundStyle(Color.white)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 10)
                        .frame(minHeight: 44)
                        .background { RoundedRectangle(cornerRadius: 12).fill(ZtColors.accent) }
                }
                .buttonStyle(ZtPressStyle())
            }
            if tip.skip {
                Button(action: onSkip) {
                    Text(verbatim: AppStrings.tourSkip(lang))
                        .underline()
                        .ztText(ZtType.caption.weight(.semibold))
                        .foregroundStyle(ZtColors.textSecondary)
                        .padding(.horizontal, 12)
                        .frame(minHeight: ZtMinTouch)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity)
        .background {
            RoundedRectangle(cornerRadius: 16).fill(ZtColors.cardSolid)
                .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Color(argb: 0x33FFFFFF), lineWidth: 1))
        }
    }
}
