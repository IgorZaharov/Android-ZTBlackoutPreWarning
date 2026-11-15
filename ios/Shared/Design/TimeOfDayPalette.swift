import Foundation
import SwiftUI

/// Four background colours of one moment of the day (Android `TimeOfDayColors`):
/// primary 60 %, secondary 30 %, accent 10 %, supporting for text/core.
public struct TimePaletteColors: Equatable, Sendable {
    public let primaryHex: UInt32
    public let secondaryHex: UInt32
    public let accentHex: UInt32
    public let supportingHex: UInt32

    public init(primaryHex: UInt32, secondaryHex: UInt32, accentHex: UInt32, supportingHex: UInt32) {
        self.primaryHex = primaryHex
        self.secondaryHex = secondaryHex
        self.accentHex = accentHex
        self.supportingHex = supportingHex
    }

    public var primary: Color { Self.color(from: primaryHex) }
    public var secondary: Color { Self.color(from: secondaryHex) }
    public var accent: Color { Self.color(from: accentHex) }
    public var supporting: Color { Self.color(from: supportingHex) }

    /// `0xRRGGBB`, opaque sRGB.
    public static func color(from hex: UInt32) -> Color {
        Color(argb: 0xFF00_0000 | (hex & 0xFF_FFFF))
    }
}

/// Background palette that drifts through the day, mirror of `android/.../ui/theme/TimeOfDayPalette.kt`:
/// anchors at 02:00 night, 08:30 morning, 14:30 day, 20:00 evening; smoothstep easing between them;
/// colours blended in Oklab, like Compose `lerp(Color, Color, Float)`. Kyiv wall-clock time.
public enum TimeOfDayPalette {
    public static let MORNING = TimePaletteColors(primaryHex: 0xF4F9F9, secondaryHex: 0x4A7C59, accentHex: 0xFFB085, supportingHex: 0x2C3E35)
    public static let DAY = TimePaletteColors(primaryHex: 0xFFFFFF, secondaryHex: 0x0A2540, accentHex: 0xFFD166, supportingHex: 0x4682B4)
    public static let EVENING = TimePaletteColors(primaryHex: 0x1A0B2E, secondaryHex: 0x8B3A62, accentHex: 0xFF6B6B, supportingHex: 0xFFE66D)
    public static let NIGHT = TimePaletteColors(primaryHex: 0x0B0C10, secondaryHex: 0x1F2833, accentHex: 0x66FCF1, supportingHex: 0xC5C6C7)

    private static let anchors: [(hour: Double, colors: TimePaletteColors)] = [
        (2.0, NIGHT),
        (8.5, MORNING),
        (14.5, DAY),
        (20.0, EVENING),
        (26.0, NIGHT)
    ]

    /// Palette at a Kyiv wall-clock time.
    public static func colors(hour: Int, minute: Int, second: Int = 0) -> TimePaletteColors {
        let h = Double(hour) + Double(minute) / 60.0 + Double(second) / 3600.0
        let adjusted = h < 2.0 ? h + 24.0 : h

        var from = anchors[0]
        var to = anchors[1]
        for i in 0..<(anchors.count - 1) where adjusted >= anchors[i].hour && adjusted <= anchors[i + 1].hour {
            from = anchors[i]
            to = anchors[i + 1]
            break
        }
        let span = to.hour - from.hour
        let raw = span > 0 ? min(1, max(0, (adjusted - from.hour) / span)) : 0
        let t = raw * raw * (3 - 2 * raw)
        return TimePaletteColors(
            primaryHex: Oklab.lerp(from.colors.primaryHex, to.colors.primaryHex, t),
            secondaryHex: Oklab.lerp(from.colors.secondaryHex, to.colors.secondaryHex, t),
            accentHex: Oklab.lerp(from.colors.accentHex, to.colors.accentHex, t),
            supportingHex: Oklab.lerp(from.colors.supportingHex, to.colors.supportingHex, t)
        )
    }

    /// Palette now (Kyiv time).
    public static func current(now: Date = Date()) -> TimePaletteColors {
        let t = KyivTime.localDateTime(of: now)
        return colors(hour: t.hour, minute: t.minute, second: t.second)
    }
}

/// sRGB <-> Oklab (Björn Ottosson), used to blend palette colours the way Compose does.
enum Oklab {
    static func lerp(_ a: UInt32, _ b: UInt32, _ t: Double) -> UInt32 {
        if a == b { return a }
        let la = toOklab(a)
        let lb = toOklab(b)
        let mixed = (la.0 + (lb.0 - la.0) * t, la.1 + (lb.1 - la.1) * t, la.2 + (lb.2 - la.2) * t)
        return fromOklab(mixed)
    }

    private static func toLinear(_ c: Double) -> Double {
        c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4)
    }

    private static func toGamma(_ c: Double) -> Double {
        c <= 0.0031308 ? c * 12.92 : 1.055 * pow(c, 1.0 / 2.4) - 0.055
    }

    static func toOklab(_ hex: UInt32) -> (Double, Double, Double) {
        let r = toLinear(Double((hex >> 16) & 0xFF) / 255.0)
        let g = toLinear(Double((hex >> 8) & 0xFF) / 255.0)
        let b = toLinear(Double(hex & 0xFF) / 255.0)
        let l = cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
        let m = cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
        let s = cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
        return (
            0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
            1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
        )
    }

    static func fromOklab(_ lab: (Double, Double, Double)) -> UInt32 {
        let l = pow(lab.0 + 0.3963377774 * lab.1 + 0.2158037573 * lab.2, 3)
        let m = pow(lab.0 - 0.1055613458 * lab.1 - 0.0638541728 * lab.2, 3)
        let s = pow(lab.0 - 0.0894841775 * lab.1 - 1.2914855480 * lab.2, 3)
        let r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
        let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
        let b = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
        func byte(_ c: Double) -> UInt32 { UInt32((min(1, max(0, toGamma(c))) * 255).rounded()) }
        return (byte(r) << 16) | (byte(g) << 8) | byte(b)
    }
}
