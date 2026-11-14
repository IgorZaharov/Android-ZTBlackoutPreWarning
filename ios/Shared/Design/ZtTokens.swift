import SwiftUI

/// Design tokens of the app, mirror of `android/.../ui/theme/ZtTokens.kt` and `spec/design-tokens.json`.
/// Every screen and widget takes its colours, radii, type roles and motion values from here, so the
/// look cannot drift between platforms. Colours are written as `0xAARRGGBB`, like Compose.

public extension Color {
    /// `0xAARRGGBB` (Compose `Color(0xAARRGGBB)`), sRGB.
    init(argb: UInt32) {
        self.init(
            .sRGB,
            red: Double((argb >> 16) & 0xFF) / 255.0,
            green: Double((argb >> 8) & 0xFF) / 255.0,
            blue: Double(argb & 0xFF) / 255.0,
            opacity: Double((argb >> 24) & 0xFF) / 255.0
        )
    }
}

public enum ZtColors {
    public static let accent = Color(argb: 0xFFFF5E3A)
    /// Translucent card fill (64 %); the glass look adds `ZtGlassTokens` on top.
    public static let card = Color(argb: 0xA3141A29)
    /// Card fill when Reduce Transparency is on.
    public static let cardSolid = Color(argb: 0xFF141A29)
    public static let cardBorder = Color(argb: 0x26FFFFFF)
    public static let innerRow = Color(argb: 0x14FFFFFF)
    public static let inputBorder = Color(argb: 0x33FFFFFF)
    public static let divider = Color(argb: 0x1AFFFFFF)
    public static let textPrimary = Color.white
    public static let textSecondary = Color(argb: 0xB3BAE6FD)
    public static let textTertiary = Color(argb: 0x99BAE6FD)

    /// Status dot of the hero (spec/UI_DRUM.md section 6).
    public static let statusOn = Color(argb: 0xFF34D399)
    public static let statusOff = accent
    public static let statusUnclear = Color(argb: 0xFF9CA3AF)
}

/// Status chips: a 20 % fill with a saturated text colour (design-tokens.json `chip`).
public enum ZtChipTone: String, CaseIterable, Sendable {
    case green, amber, red, grey

    public var fill: Color {
        switch self {
        case .green: return Color(argb: 0x3310B981)
        case .amber: return Color(argb: 0x33F59E0B)
        case .red: return Color(argb: 0x33EF4444)
        case .grey: return Color(argb: 0x339CA3AF)
        }
    }

    public var text: Color {
        switch self {
        case .green: return Color(argb: 0xFF34D399)
        case .amber: return Color(argb: 0xFFFBBF24)
        case .red: return Color(argb: 0xFFF87171)
        case .grey: return Color(argb: 0xFF9CA3AF)
        }
    }
}

/// Liquid-glass card recipe used by the iOS 17-25 fallback (design-tokens.json `glass`): matte sheen
/// that fades from the top, a rim lit at the top, a soft short shadow.
public enum ZtGlassTokens {
    public static let sheen = LinearGradient(
        colors: [Color(argb: 0x1AFFFFFF), Color(argb: 0x05FFFFFF)], startPoint: .top, endPoint: .bottom
    )
    public static let rim = LinearGradient(
        colors: [Color(argb: 0x40FFFFFF), Color(argb: 0x14FFFFFF)], startPoint: .top, endPoint: .bottom
    )
    public static let shadow = Color(argb: 0x40000000)
    /// Compose blur 14 dp; a SwiftUI shadow radius is about half the CSS/Compose blur.
    public static let shadowRadius: CGFloat = 7
    public static let shadowOffsetY: CGFloat = 4
}

/// Drum colours (spec/UI_DRUM.md, design-tokens.json `drum`).
public enum ZtDrumColors {
    public static let faceplate = [Color(argb: 0xFFDFDDD0), Color(argb: 0xFFD4D1C1), Color(argb: 0xFFC6C2B0)]
    public static let faceplateBorder = Color(argb: 0xFF7A7768)
    public static let well = Color(argb: 0xFF4E514E)
    public static let wellBorder = Color(argb: 0xFF6E716B)
    public static let hourSeparator = Color(argb: 0xFFC8C6BC)
    public static let off = [Color(argb: 0xFF9E1E18), Color(argb: 0xFFD62E26), Color(argb: 0xFF8C1914)]
    public static let on = [Color(argb: 0xFFD8D6CC), Color(argb: 0xFFFCFBF7), Color(argb: 0xFFCCC9BE)]
    public static let unclear = [Color(argb: 0xFF7E8287), Color(argb: 0xFF94989E), Color(argb: 0xFF6E7277)]
    public static let emergency = [Color(argb: 0xFFFFB020), Color(argb: 0xFFF28A1B), Color(argb: 0xFFC96A0B)]
    public static let emergencyStripeDark = Color(argb: 0x8C1A1208)
    public static let emergencyStripeLight = Color(argb: 0xD9FFB020)
    public static let tick = Color(argb: 0xFF1C1B18)
    public static let needle = Color(argb: 0xFF0B0B0A)
    public static let needleHalo = Color(argb: 0xD9FFFFFF)
}

public enum ZtRadius {
    public static let card: CGFloat = 24
    public static let control: CGFloat = 16
    public static let row: CGFloat = 14
    public static let chip: CGFloat = 12
    public static let badge: CGFloat = 10
}

/// Minimum touch target (token `minTouchDp`, kept at 48 although iOS asks for 44).
public let ZtMinTouch: CGFloat = 48

public enum ZtMotion {
    public static let pressScale: CGFloat = 0.96
    public static let pressDuration: Double = 0.15
    /// Page change of the main pager: critically damped spring, stiffness 300 (Compose `PageGlide`).
    public static let pageGlide = Animation.interpolatingSpring(mass: 1, stiffness: 300, damping: 2 * 300.0.squareRoot())
}

// MARK: - Type scale

/// One type role of design-tokens.json `type`. Sizes scale with Dynamic Type relative to `textStyle`.
public struct ZtTypeRole: Sendable {
    public var size: CGFloat
    public var line: CGFloat
    public var weight: Font.Weight
    public var mono: Bool
    public var tracking: CGFloat
    public var uppercase: Bool
    public var textStyle: Font.TextStyle

    public func weight(_ w: Font.Weight) -> ZtTypeRole {
        var c = self
        c.weight = w
        return c
    }

    public func monospaced(_ on: Bool = true) -> ZtTypeRole {
        var c = self
        c.mono = on
        return c
    }

    public func tracking(_ em: CGFloat) -> ZtTypeRole {
        var c = self
        c.tracking = em
        return c
    }
}

public enum ZtType {
    /// Hero countdown.
    public static let display = ZtTypeRole(size: 44, line: 48, weight: .black, mono: true, tracking: 0, uppercase: false, textStyle: .largeTitle)
    /// "Черга 5.2".
    public static let title = ZtTypeRole(size: 24, line: 30, weight: .bold, mono: false, tracking: 0, uppercase: false, textStyle: .title)
    /// Screen and modal titles.
    public static let heading = ZtTypeRole(size: 20, line: 28, weight: .heavy, mono: false, tracking: 0, uppercase: false, textStyle: .title2)
    /// Card titles, field values, banner titles.
    public static let subhead = ZtTypeRole(size: 16, line: 23, weight: .bold, mono: false, tracking: 0, uppercase: false, textStyle: .headline)
    /// Toggle labels, step text, descriptions.
    public static let body = ZtTypeRole(size: 16, line: 24, weight: .medium, mono: false, tracking: 0, uppercase: false, textStyle: .body)
    /// Field labels, buttons, tabs, chips.
    public static let label = ZtTypeRole(size: 14, line: 20, weight: .semibold, mono: false, tracking: 0, uppercase: false, textStyle: .subheadline)
    /// Addresses, last-updated lines, durations, hints.
    public static let caption = ZtTypeRole(size: 13, line: 19, weight: .medium, mono: false, tracking: 0, uppercase: false, textStyle: .footnote)
    /// Upper-case section headings and drum ticks; tracking 0.05 em.
    public static let overline = ZtTypeRole(size: 12, line: 17, weight: .bold, mono: false, tracking: 0.05, uppercase: true, textStyle: .caption)
    /// Times in the outage list.
    public static let timeMono = ZtTypeRole(size: 16, line: 22, weight: .bold, mono: true, tracking: 0, uppercase: false, textStyle: .body)
    /// Durations and small figures.
    public static let captionMono = ZtTypeRole(size: 13, line: 19, weight: .bold, mono: true, tracking: 0, uppercase: false, textStyle: .footnote)
}

/// Applies a type role with Dynamic Type scaling. Line height is approximated with extra line spacing
/// on top of the system font's natural line height (about 1.19 x size).
struct ZtTextModifier: ViewModifier {
    let role: ZtTypeRole
    @ScaledMetric private var size: CGFloat
    @ScaledMetric private var line: CGFloat

    init(role: ZtTypeRole) {
        self.role = role
        _size = ScaledMetric(wrappedValue: role.size, relativeTo: role.textStyle)
        _line = ScaledMetric(wrappedValue: role.line, relativeTo: role.textStyle)
    }

    func body(content: Content) -> some View {
        content
            .font(.system(size: size, weight: role.weight, design: role.mono ? .monospaced : .default))
            .monospacedDigit()
            .lineSpacing(max(0, line - size * 1.19))
            .tracking(role.tracking * size)
            .textCase(role.uppercase ? .uppercase : nil)
    }
}

public extension View {
    /// Text in one of the design-token type roles (`ZtType`).
    func ztText(_ role: ZtTypeRole) -> some View { modifier(ZtTextModifier(role: role)) }
}
