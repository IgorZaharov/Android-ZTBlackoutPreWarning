import Foundation
import SwiftUI

public struct TimePaletteColors: Equatable {
    public let primaryHex: UInt32
    public let secondaryHex: UInt32
    public let accentHex: UInt32
    public let supportingHex: UInt32

    public var primary: Color { Self.color(from: primaryHex) }
    public var secondary: Color { Self.color(from: secondaryHex) }
    public var accent: Color { Self.color(from: accentHex) }
    public var supporting: Color { Self.color(from: supportingHex) }

    public static func color(from hex: UInt32) -> Color {
        let r = Double((hex >> 16) & 0xFF) / 255.0
        let g = Double((hex >> 8) & 0xFF) / 255.0
        let b = Double(hex & 0xFF) / 255.0
        return Color(red: r, green: g, blue: b)
    }
}

public enum TimeOfDayPalette {
    // Morning (05:00-11:00, anchor 08:00 = 480m)
    public static let MORNING = TimePaletteColors(
        primaryHex: 0xF4F9F9,
        secondaryHex: 0x4A7C59,
        accentHex: 0xFFB085,
        supportingHex: 0x2C3E35
    )

    // Day (11:00-17:00, anchor 14:00 = 840m)
    public static let DAY = TimePaletteColors(
        primaryHex: 0xFFFFFF,
        secondaryHex: 0x0A2540,
        accentHex: 0xFFD166,
        supportingHex: 0x4682B4
    )

    // Evening (17:00-22:00, anchor 19:30 = 1170m)
    public static let EVENING = TimePaletteColors(
        primaryHex: 0x1A0B2E,
        secondaryHex: 0x8B3A62,
        accentHex: 0xFF6B6B,
        supportingHex: 0xFFE66D
    )

    // Night (22:00-05:00, anchor 01:30 = 90m)
    public static let NIGHT = TimePaletteColors(
        primaryHex: 0x0B0C10,
        secondaryHex: 0x1F2833,
        accentHex: 0x66FCF1,
        supportingHex: 0xC5C6C7
    )

    public static func getInterpolatedPalette(now: Date = Date()) -> TimePaletteColors {
        let minuteOfDay = KyivZone.minuteOfDay(for: now)
        let anchors: [(minute: Int, palette: TimePaletteColors)] = [
            (90, NIGHT),
            (480, MORNING),
            (840, DAY),
            (1170, EVENING),
            (1440 + 90, NIGHT)
        ]

        let adjustedMinute = minuteOfDay < 90 ? minuteOfDay + 1440 : minuteOfDay
        for i in 0..<(anchors.count - 1) {
            let start = anchors[i]
            let end = anchors[i + 1]
            if adjustedMinute >= start.minute && adjustedMinute <= end.minute {
                let t = Double(adjustedMinute - start.minute) / Double(max(1, end.minute - start.minute))
                return interpolate(from: start.palette, to: end.palette, t: t)
            }
        }
        return NIGHT
    }

    private static func interpolate(from a: TimePaletteColors, to b: TimePaletteColors, t: Double) -> TimePaletteColors {
        TimePaletteColors(
            primaryHex: lerpHex(a.primaryHex, b.primaryHex, t: t),
            secondaryHex: lerpHex(a.secondaryHex, b.secondaryHex, t: t),
            accentHex: lerpHex(a.accentHex, b.accentHex, t: t),
            supportingHex: lerpHex(a.supportingHex, b.supportingHex, t: t)
        )
    }

    private static func lerpHex(_ c1: UInt32, _ c2: UInt32, t: Double) -> UInt32 {
        let r1 = Double((c1 >> 16) & 0xFF)
        let g1 = Double((c1 >> 8) & 0xFF)
        let b1 = Double(c1 & 0xFF)

        let r2 = Double((c2 >> 16) & 0xFF)
        let g2 = Double((c2 >> 8) & 0xFF)
        let b2 = Double(c2 & 0xFF)

        let r = UInt32((r1 + (r2 - r1) * t).rounded()) & 0xFF
        let g = UInt32((g1 + (g2 - g1) * t).rounded()) & 0xFF
        let b = UInt32((b1 + (b2 - b1) * t).rounded()) & 0xFF
        return (r << 16) | (g << 8) | b
    }
}
