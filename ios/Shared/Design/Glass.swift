import SwiftUI

// Liquid Glass with fallback (docs/ios/IOS_PORT_PLAN.md section 4). Every card, chip, button and widget
// surface goes through this file, and it is the only place that branches on the OS version: screens never
// call `glassEffect` or `#available(iOS 26, *)` themselves.
//
// | Surface | iOS 26+                         | iOS 17-25                                 | Reduce Transparency |
// |---------|---------------------------------|-------------------------------------------|---------------------|
// | Card    | glassEffect, card tint, r 24    | material + card fill + sheen + rim + shadow | cardSolid + border |
// | Chip    | glassEffect tinted by the tone  | material capsule + tone fill              | solid capsule       |
// | Button  | .glass / .glassProminent        | .bordered / .borderedProminent, r 16      | as the fallback     |
// | Press   | interactive glass               | scale 0.96, 150 ms (none under Reduce Motion) |                 |

/// Which glass recipe a subtree asks for. `.automatic` is the real app; the design gallery forces the
/// other two so CI screenshots show every recipe on one simulator.
public enum ZtGlassMode: String, CaseIterable, Sendable {
    /// Liquid Glass on iOS 26+, the material fallback before.
    case automatic
    /// The iOS 17-25 material recipe on any version.
    case fallback
    /// What Reduce Transparency shows, on any version.
    case solid
}

private struct ZtGlassModeKey: EnvironmentKey {
    static let defaultValue: ZtGlassMode = .automatic
}

public extension EnvironmentValues {
    var ztGlassMode: ZtGlassMode {
        get { self[ZtGlassModeKey.self] }
        set { self[ZtGlassModeKey.self] = newValue }
    }
}

/// The recipe that is actually drawn.
public enum ZtGlassRender: Sendable, Equatable {
    case liquid, material, solid

    /// Reduce Transparency always wins; Liquid Glass needs iOS 26.
    public static func resolve(mode: ZtGlassMode, reduceTransparency: Bool, liquidAvailable: Bool) -> ZtGlassRender {
        if reduceTransparency || mode == .solid { return .solid }
        if mode == .fallback || !liquidAvailable { return .material }
        return .liquid
    }

    public static var liquidAvailable: Bool {
        if #available(iOS 26.0, *) { return true }
        return false
    }
}

/// Reads the environment once and tells a modifier which recipe to draw.
private struct GlassEnvironment {
    let mode: ZtGlassMode
    let reduceTransparency: Bool
    var render: ZtGlassRender {
        ZtGlassRender.resolve(mode: mode, reduceTransparency: reduceTransparency, liquidAvailable: ZtGlassRender.liquidAvailable)
    }
}

// MARK: - Card

struct ZtGlassCardModifier: ViewModifier {
    var cornerRadius: CGFloat
    var tint: Color
    /// nil: the lit glass rim; a colour: a solid 1 pt border (warning cards).
    var border: Color?
    var interactive: Bool

    @Environment(\.ztGlassMode) private var mode
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    @ViewBuilder
    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
        switch GlassEnvironment(mode: mode, reduceTransparency: reduceTransparency).render {
        case .liquid:
            if #available(iOS 26.0, *) {
                content
                    .glassEffect(glass(), in: shape)
                    .overlay { if let border { shape.strokeBorder(border, lineWidth: 1) } }
            } else {
                materialCard(content, shape)
            }
        case .material:
            materialCard(content, shape)
        case .solid:
            content
                .background { shape.fill(ZtColors.cardSolid) }
                .overlay { shape.strokeBorder(border ?? ZtColors.cardBorder, lineWidth: 1) }
        }
    }

    @available(iOS 26.0, *)
    private func glass() -> Glass {
        let tinted = Glass.regular.tint(tint)
        return interactive ? tinted.interactive() : tinted
    }

    private func materialCard(_ content: Content, _ shape: RoundedRectangle) -> some View {
        content
            .background { shape.fill(ZtGlassTokens.sheen) }
            .background { shape.fill(tint) }
            .background {
                // Dark material whatever the system appearance: the card text is white (token textPrimary).
                // The shadow sits on this bottom layer only, so the text casts none.
                shape.fill(.ultraThinMaterial)
                    .environment(\.colorScheme, .dark)
                    .shadow(color: ZtGlassTokens.shadow, radius: ZtGlassTokens.shadowRadius, y: ZtGlassTokens.shadowOffsetY)
            }
            .overlay {
                if let border {
                    shape.strokeBorder(border, lineWidth: 1)
                } else {
                    shape.strokeBorder(ZtGlassTokens.rim, lineWidth: 1)
                }
            }
    }
}

/// The glass card every block of the app uses (Android `GlassCard`): radius 24, 16 pt padding.
public struct ZtGlassCard<Content: View>: View {
    var cornerRadius: CGFloat
    var tint: Color
    var border: Color?
    var padding: CGFloat
    var interactive: Bool
    let content: Content

    public init(
        cornerRadius: CGFloat = ZtRadius.card,
        tint: Color = ZtColors.card,
        border: Color? = nil,
        padding: CGFloat = 16,
        interactive: Bool = false,
        @ViewBuilder content: () -> Content
    ) {
        self.cornerRadius = cornerRadius
        self.tint = tint
        self.border = border
        self.padding = padding
        self.interactive = interactive
        self.content = content()
    }

    public var body: some View {
        content
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(padding)
            .modifier(ZtGlassCardModifier(cornerRadius: cornerRadius, tint: tint, border: border, interactive: interactive))
    }
}

public extension View {
    /// Glass surface without the card's padding and width (About blocks, the bottom navigation, rows).
    func ztGlassSurface(
        cornerRadius: CGFloat = ZtRadius.card,
        tint: Color = ZtColors.card,
        border: Color? = nil,
        interactive: Bool = false
    ) -> some View {
        modifier(ZtGlassCardModifier(cornerRadius: cornerRadius, tint: tint, border: border, interactive: interactive))
    }
}

// MARK: - Chips

struct ZtGlassChipModifier: ViewModifier {
    var tone: ZtChipTone

    @Environment(\.ztGlassMode) private var mode
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    @ViewBuilder
    func body(content: Content) -> some View {
        let label = content
            .foregroundStyle(tone.text)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .frame(minHeight: 32)
        switch GlassEnvironment(mode: mode, reduceTransparency: reduceTransparency).render {
        case .liquid:
            if #available(iOS 26.0, *) {
                label.glassEffect(Glass.regular.tint(tone.fill), in: Capsule())
            } else {
                label.background { materialChip }
            }
        case .material:
            label.background { materialChip }
        case .solid:
            label.background {
                ZStack {
                    Capsule().fill(ZtColors.cardSolid)
                    Capsule().fill(tone.fill)
                }
            }
        }
    }

    private var materialChip: some View {
        ZStack {
            Capsule().fill(.ultraThinMaterial).environment(\.colorScheme, .dark)
            Capsule().fill(tone.fill)
            Capsule().strokeBorder(ZtColors.cardBorder, lineWidth: 1)
        }
    }
}

public extension View {
    /// A status chip (green / amber / red / grey) on glass.
    func ztGlassChip(_ tone: ZtChipTone) -> some View { modifier(ZtGlassChipModifier(tone: tone)) }
}

/// Groups glass shapes so neighbours merge and morph on iOS 26 (`GlassEffectContainer`); a plain
/// container before, where there is nothing to merge.
public struct ZtGlassGroup<Content: View>: View {
    var spacing: CGFloat
    let content: Content

    @Environment(\.ztGlassMode) private var mode
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    public init(spacing: CGFloat = 8, @ViewBuilder content: () -> Content) {
        self.spacing = spacing
        self.content = content()
    }

    public var body: some View {
        if GlassEnvironment(mode: mode, reduceTransparency: reduceTransparency).render == .liquid {
            if #available(iOS 26.0, *) {
                GlassEffectContainer(spacing: spacing) { content }
            } else {
                content
            }
        } else {
            content
        }
    }
}

struct ZtGlassIDModifier: ViewModifier {
    var id: String
    var namespace: Namespace.ID

    @Environment(\.ztGlassMode) private var mode
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    @ViewBuilder
    func body(content: Content) -> some View {
        if GlassEnvironment(mode: mode, reduceTransparency: reduceTransparency).render == .liquid {
            if #available(iOS 26.0, *) {
                content.glassEffectID(id, in: namespace)
            } else {
                content
            }
        } else {
            content
        }
    }
}

public extension View {
    /// Morph identity of a glass shape inside a `ZtGlassGroup` (the address switcher pill). No-op before iOS 26.
    func ztGlassID(_ id: String, in namespace: Namespace.ID) -> some View {
        modifier(ZtGlassIDModifier(id: id, namespace: namespace))
    }
}

// MARK: - Buttons

public enum ZtButtonKind: Sendable {
    /// Secondary action: clear glass / bordered.
    case regular
    /// Primary action tinted with the accent.
    case prominent
}

struct ZtButtonStyleModifier: ViewModifier {
    var kind: ZtButtonKind
    var tint: Color

    @Environment(\.ztGlassMode) private var mode
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    @ViewBuilder
    func body(content: Content) -> some View {
        if GlassEnvironment(mode: mode, reduceTransparency: reduceTransparency).render == .liquid {
            if #available(iOS 26.0, *) {
                switch kind {
                case .prominent: content.buttonStyle(.glassProminent).tint(tint).controlSize(.large)
                case .regular: content.buttonStyle(.glass).tint(tint).controlSize(.large)
                }
            } else {
                bordered(content)
            }
        } else {
            bordered(content)
        }
    }

    @ViewBuilder
    private func bordered(_ content: Content) -> some View {
        switch kind {
        case .prominent:
            content.buttonStyle(.borderedProminent).tint(tint).controlSize(.large)
                .buttonBorderShape(.roundedRectangle(radius: ZtRadius.control))
        case .regular:
            content.buttonStyle(.bordered).tint(tint).controlSize(.large)
                .buttonBorderShape(.roundedRectangle(radius: ZtRadius.control))
        }
    }
}

public extension View {
    /// Glass button (iOS 26) or the bordered fallback with the same tint and radius 16.
    func ztButtonStyle(_ kind: ZtButtonKind, tint: Color? = nil) -> some View {
        modifier(ZtButtonStyleModifier(kind: kind, tint: tint ?? (kind == .prominent ? ZtColors.accent : ZtColors.textPrimary)))
    }
}

/// Press feedback for tappable glass cards and rows before iOS 26 (interactive glass does it there):
/// scale 0.96 over 150 ms, opacity only under Reduce Motion.
public struct ZtPressStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init() {}

    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed && !reduceMotion ? ZtMotion.pressScale : 1)
            .opacity(configuration.isPressed && reduceMotion ? 0.8 : 1)
            .animation(.easeOut(duration: ZtMotion.pressDuration), value: configuration.isPressed)
    }
}

// MARK: - Background extension

struct ZtBackgroundExtensionModifier: ViewModifier {
    @ViewBuilder
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.backgroundExtensionEffect()
        } else {
            content
        }
    }
}

public extension View {
    /// Lets the time-of-day background continue under the glass bars on iOS 26; no-op before.
    func ztBackgroundExtension() -> some View { modifier(ZtBackgroundExtensionModifier()) }
}
