import SwiftUI

/// Slow background warp, mirror of `android/.../ui/components/AmbientMotion.kt` and the background of
/// `BlackoutAppNavigation.kt`: four soft orbs drift on Lissajous paths over the time-of-day gradient.
public enum AmbientMotion {
    /// 23-37 s: slow, but the movement is visible.
    static let periods: [Double] = [23, 31, 27, 37, 29]

    /// One orb's drift: a Lissajous path of `amplitude` (a fraction of the width or height) on
    /// incommensurate periods, so the background never visibly repeats.
    public static func drift(seconds: Double, seed: Int, width: Double, height: Double, amplitude: Double = 0.16) -> CGSize {
        let px = periods[seed % periods.count]
        let py = periods[(seed + 2) % periods.count]
        let phase = Double(seed) * 1.7
        let tau = 2 * Double.pi
        return CGSize(
            width: width * amplitude * sin(tau * seconds / px + phase),
            height: height * amplitude * 0.7 * cos(tau * seconds / py + phase * 0.6)
        )
    }

    /// Slow "breathing" of an orb's radius, within +-15 %.
    public static func breath(seconds: Double, seed: Int) -> Double {
        let p = periods[(seed + 1) % periods.count] * 1.3
        return 1 + 0.15 * sin(2 * Double.pi * seconds / p + Double(seed))
    }

    /// Stops of a soft radial orb (Android `smoothGaussianRadialBrush`).
    static func orbStops(_ color: Color, maxAlpha: Double) -> [Gradient.Stop] {
        [
            .init(color: color.opacity(maxAlpha), location: 0),
            .init(color: color.opacity(maxAlpha * 0.90), location: 0.18),
            .init(color: color.opacity(maxAlpha * 0.68), location: 0.36),
            .init(color: color.opacity(maxAlpha * 0.42), location: 0.54),
            .init(color: color.opacity(maxAlpha * 0.18), location: 0.72),
            .init(color: color.opacity(maxAlpha * 0.04), location: 0.88),
            .init(color: color.opacity(0), location: 1)
        ]
    }

    /// Draws the whole background for one moment. Shared by the app (animated) and widgets (frozen).
    static func draw(
        _ gc: GraphicsContext, size: CGSize, palette: TimePaletteColors,
        seconds: Double, parallaxX: Double, dimmed: Bool
    ) {
        let w = max(1, Double(size.width))
        let h = max(1, Double(size.height))
        let full = Path(CGRect(origin: .zero, size: size))
        gc.fill(full, with: .color(palette.primary))

        // 1. primary / secondary radial base
        gc.fill(full, with: .radialGradient(
            Gradient(stops: [
                .init(color: palette.primary.opacity(0.60), location: 0),
                .init(color: palette.primary.opacity(0.35), location: 0.55),
                .init(color: palette.secondary.opacity(0.60), location: 1)
            ]),
            center: CGPoint(x: w * 0.50, y: h * 0.45), startRadius: 0, endRadius: max(w, h) * 0.85
        ))

        // 2-5. four drifting orbs
        let orbs: [(Color, Double, Double, Double, Double)] = [
            (palette.secondary, 0.68, 0.88, 0.08, 0.98),
            (palette.supporting, 0.62, 0.12, 0.06, 0.92),
            (palette.secondary, 0.58, 0.08, 0.68, 0.98),
            (palette.accent, 0.52, 0.82, 0.84, 0.82)
        ]
        for (seed, orb) in orbs.enumerated() {
            let d = drift(seconds: seconds, seed: seed, width: w, height: h)
            let center = CGPoint(x: w * orb.2 + Double(d.width) + parallaxX, y: h * orb.3 + Double(d.height))
            let radius = max(1, w * orb.4 * breath(seconds: seconds, seed: seed))
            gc.fill(full, with: .radialGradient(
                Gradient(stops: orbStops(orb.0, maxAlpha: orb.1)), center: center, startRadius: 0, endRadius: radius
            ))
        }

        // 6. top scrim for the header contrast
        let scrim = min(148, h)
        gc.fill(Path(CGRect(x: 0, y: 0, width: w, height: scrim)), with: .linearGradient(
            Gradient(stops: [
                .init(color: Color(argb: 0xFF0B0C10).opacity(0.65), location: 0),
                .init(color: Color(argb: 0xFF0B0C10).opacity(0.25), location: 0.45),
                .init(color: Color(argb: 0xFF0B0C10).opacity(0), location: 1)
            ]),
            startPoint: .zero, endPoint: CGPoint(x: 0, y: scrim)
        ))

        // 7. first launch (no queue yet): dark dimming
        if dimmed { gc.fill(full, with: .color(Color(argb: 0xD9070A12))) }
    }
}

/// The animated time-of-day background of the app. Redrawn about 15 times a second (the orbs move a
/// fraction of a point per frame); still under Reduce Motion. `pagePosition` (0, 1, 2 and fractions while
/// swiping) moves the orbs 3 % of the width per page against the swipe.
public struct AmbientBackground: View {
    var palette: TimePaletteColors
    var pagePosition: CGFloat
    var dimmed: Bool
    /// Fixed time for screenshots and widgets (no animation).
    var frozenSeconds: Double?

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var start = Date()

    public init(palette: TimePaletteColors, pagePosition: CGFloat = 0, dimmed: Bool = false, frozenSeconds: Double? = nil) {
        self.palette = palette
        self.pagePosition = pagePosition
        self.dimmed = dimmed
        self.frozenSeconds = frozenSeconds
    }

    public var body: some View {
        Group {
            if reduceMotion || frozenSeconds != nil {
                canvas(seconds: reduceMotion ? 0 : (frozenSeconds ?? 0))
            } else {
                TimelineView(.periodic(from: start, by: 1.0 / 15.0)) { ctx in
                    canvas(seconds: ctx.date.timeIntervalSince(start))
                }
            }
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
    }

    private func canvas(seconds: Double) -> some View {
        Canvas { gc, size in
            let parallax = reduceMotion ? 0 : -Double(pagePosition) * Double(size.width) * 0.03
            AmbientMotion.draw(gc, size: size, palette: palette, seconds: seconds, parallaxX: parallax, dimmed: dimmed)
        }
    }
}
