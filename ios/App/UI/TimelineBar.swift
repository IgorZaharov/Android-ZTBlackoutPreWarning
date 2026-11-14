import SwiftUI

public struct TimelineBar: View {
    public let slots: [BlackoutSlot]
    public let isUnclear: Bool
    public let currentMinuteOfDay: Int
    public let showCurrentTimeNeedle: Bool
    public let lang: String

    public init(
        slots: [BlackoutSlot],
        isUnclear: Bool = false,
        currentMinuteOfDay: Int,
        showCurrentTimeNeedle: Bool = true,
        lang: String = "uk"
    ) {
        self.slots = slots
        self.isUnclear = isUnclear
        self.currentMinuteOfDay = currentMinuteOfDay
        self.showCurrentTimeNeedle = showCurrentTimeNeedle
        self.lang = lang
    }

    public var body: some View {
        VStack(spacing: 4) {
            // САЗУ-ИТ Enamel Bezel (#DFDDD0) & Recessed Drum Slot (#4E514E)
            ZStack {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Color(red: 0xDF / 255.0, green: 0xDD / 255.0, blue: 0xD0 / 255.0))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .stroke(Color.black.opacity(0.25), lineWidth: 1)
                    )

                GeometryReader { geo in
                    let outerW = geo.size.width
                    let drumW = max(1, outerW - 12)

                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .fill(Color(red: 0x4E / 255.0, green: 0x51 / 255.0, blue: 0x4E / 255.0))
                            .frame(width: drumW, height: 28)

                        if isUnclear || slots.isEmpty {
                            RoundedRectangle(cornerRadius: 5, style: .continuous)
                                .fill(Color(red: 0x9C / 255.0, green: 0xA3 / 255.0, blue: 0xAF / 255.0))
                                .frame(width: drumW - 4, height: 24)
                                .padding(.leading, 2)
                                .overlay(
                                    Text(AppStrings.schedulesUnclear(lang))
                                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                                        .foregroundColor(Color(red: 0x1F / 255.0, green: 0x29 / 255.0, blue: 0x37 / 255.0))
                                )
                        } else {
                            HStack(spacing: 0) {
                                ForEach(0..<24, id: \.self) { hour in
                                    let firstHalfOff = (hour * 2 < slots.count) && (slots[hour * 2].status == .POWER_OFF)
                                    let secondHalfOff = (hour * 2 + 1 < slots.count) && (slots[hour * 2 + 1].status == .POWER_OFF)

                                    HStack(spacing: 0) {
                                        Rectangle()
                                            .fill(firstHalfOff
                                                  ? Color(red: 0xD6 / 255.0, green: 0x2E / 255.0, blue: 0x26 / 255.0)
                                                  : Color(red: 0xFC / 255.0, green: 0xFB / 255.0, blue: 0xF7 / 255.0))
                                        Rectangle()
                                            .fill(secondHalfOff
                                                  ? Color(red: 0xD6 / 255.0, green: 0x2E / 255.0, blue: 0x26 / 255.0)
                                                  : Color(red: 0xFC / 255.0, green: 0xFB / 255.0, blue: 0xF7 / 255.0))
                                    }
                                    .overlay(alignment: .trailing) {
                                        if hour < 23 {
                                            Rectangle()
                                                .fill(Color(red: 0x4E / 255.0, green: 0x51 / 255.0, blue: 0x4E / 255.0))
                                                .frame(width: 1.5)
                                        }
                                    }
                                }
                            }
                            .frame(width: drumW - 4, height: 24)
                            .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))
                            .padding(.leading, 2)
                        }

                        if showCurrentTimeNeedle && !isUnclear && !slots.isEmpty {
                            let progress = min(1.0, max(0.0, Double(currentMinuteOfDay) / 1440.0))
                            let xPos = 2.0 + progress * Double(drumW - 4)
                            Rectangle()
                                .fill(Color(red: 0x0B / 255.0, green: 0x0B / 255.0, blue: 0x0A / 255.0))
                                .frame(width: 2.5, height: 32)
                                .offset(x: xPos - 1.25)
                        }
                    }
                    .padding(.horizontal, 6)
                    .padding(.vertical, 6)
                }
                .frame(height: 40)
            }
            .frame(height: 40)

            // Even-hour labels 00 .. 24
            HStack(spacing: 0) {
                ForEach([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24], id: \.self) { h in
                    Text(String(format: "%02d", h))
                        .font(.system(size: 9, weight: .bold, design: .monospaced))
                        .foregroundColor(.white.opacity(0.75))
                        .frame(maxWidth: .infinity)
                }
            }
        }
    }
}
