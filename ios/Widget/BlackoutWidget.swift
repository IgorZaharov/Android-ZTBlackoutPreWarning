import WidgetKit
import SwiftUI
import AppIntents
import UIKit

public struct BlackoutWidgetEntry: TimelineEntry {
    public let date: Date
    public let queue: String
    public let slots: [BlackoutSlot]
    public let statusInfo: StatusAndCountdown
    public let notificationsEnabled: Bool
    public let lang: String
}

public struct BlackoutWidgetProvider: TimelineProvider {
    public func placeholder(in context: Context) -> BlackoutWidgetEntry {
        makeEntry(for: Date())
    }

    public func getSnapshot(in context: Context, completion: @escaping (BlackoutWidgetEntry) -> Void) {
        completion(makeEntry(for: Date()))
    }

    public func getTimeline(in context: Context, completion: @escaping (Timeline<BlackoutWidgetEntry>) -> Void) {
        let now = Date()
        let entry = makeEntry(for: now)
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: now) ?? now.addingTimeInterval(900)
        completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
    }

    private func makeEntry(for now: Date) -> BlackoutWidgetEntry {
        let settings = SettingsRepository.shared.loadSettings()
        let lang = AppStrings.resolveLanguage(settings.language)
        let rawTodaySlots = ScheduleRepository.shared.getTodaySlots(queue: settings.queue, now: now)
        let rawTomorrowSlots = ScheduleRepository.shared.getTomorrowSlots(queue: settings.queue, now: now)
        let todaySlots = ScheduleRepository.shared.applyEmergencyOutageToSlots(
            slots: rawTodaySlots,
            startTime: settings.activeEmergencyOutageStart,
            restoreTime: settings.activeEmergencyOutageRestore,
            isTomorrow: false
        )
        let tomorrowSlots: [BlackoutSlot]? = {
            if let tom = rawTomorrowSlots {
                return ScheduleRepository.shared.applyEmergencyOutageToSlots(
                    slots: tom,
                    startTime: settings.activeEmergencyOutageStart,
                    restoreTime: settings.activeEmergencyOutageRestore,
                    isTomorrow: true
                )
            } else if settings.activeEmergencyOutageStart != nil {
                return ScheduleRepository.shared.applyEmergencyOutageToSlots(
                    slots: [],
                    startTime: settings.activeEmergencyOutageStart,
                    restoreTime: settings.activeEmergencyOutageRestore,
                    isTomorrow: true
                )
            }
            return nil
        }()
        let statusInfo = ScheduleRepository.shared.calculateStatusAndCountdown(
            slots: todaySlots,
            tomorrowSlots: tomorrowSlots,
            now: now
        )
        return BlackoutWidgetEntry(
            date: now,
            queue: settings.queue,
            slots: todaySlots,
            statusInfo: statusInfo,
            notificationsEnabled: settings.notificationsEnabled,
            lang: lang
        )
    }
}

public enum BlackoutWidgetFormatter {
    // Converts HH:MM:SS into compact localized hours and minutes WITHOUT seconds: "HHг. MMхв." or "HHhr. MMm."
    public static func formatWidgetCountdown(rawCountdown: String, lang: String) -> String {
        if rawCountdown == "--:--:--" || rawCountdown.isEmpty {
            return lang == "en" ? "--hr. --m." : "--г. --хв."
        }
        let parts = rawCountdown.split(separator: ":")
        guard parts.count >= 2 else {
            return lang == "en" ? "--hr. --m." : "--г. --хв."
        }
        let h = String(parts[0])
        let m = String(parts[1])
        return lang == "en" ? "\(h)hr. \(m)m." : "\(h)г. \(m)хв."
    }

    // Renders the 720x132 САЗУ-ИТ 24h analog electricity meter bitmap matching TimelineBar.swift
    public static func renderAnalogCounterBitmap(
        slots: [BlackoutSlot],
        isUnclear: Bool,
        currentMinuteOfDay: Int
    ) -> UIImage {
        let size = CGSize(width: 720, height: 132)
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { ctx in
            let cg = ctx.cgContext
            // Enamel bezel #DFDDD0
            UIColor(red: 0xDF / 255.0, green: 0xDD / 255.0, blue: 0xD0 / 255.0, alpha: 1.0).setFill()
            UIBezierPath(roundedRect: CGRect(origin: .zero, size: size), cornerRadius: 20).fill()

            // Recessed drum slot #4E514E
            let drumRect = CGRect(x: 16, y: 16, width: 688, height: 74)
            UIColor(red: 0x4E / 255.0, green: 0x51 / 255.0, blue: 0x4E / 255.0, alpha: 1.0).setFill()
            UIBezierPath(roundedRect: drumRect, cornerRadius: 10).fill()

            if isUnclear || slots.isEmpty {
                UIColor(red: 0x9C / 255.0, green: 0xA3 / 255.0, blue: 0xAF / 255.0, alpha: 1.0).setFill()
                UIBezierPath(roundedRect: drumRect.insetBy(dx: 4, dy: 4), cornerRadius: 8).fill()
            } else {
                let innerRect = drumRect.insetBy(dx: 4, dy: 4)
                let slotWidth = innerRect.width / 48.0
                for hour in 0..<24 {
                    for half in 0..<2 {
                        let idx = hour * 2 + half
                        let isOff = idx < slots.count && slots[idx].status == .POWER_OFF
                        let color = isOff
                            ? UIColor(red: 0xD6 / 255.0, green: 0x2E / 255.0, blue: 0x26 / 255.0, alpha: 1.0)
                            : UIColor(red: 0xFC / 255.0, green: 0xFB / 255.0, blue: 0xF7 / 255.0, alpha: 1.0)
                        color.setFill()
                        let cellRect = CGRect(
                            x: innerRect.minX + CGFloat(idx) * slotWidth,
                            y: innerRect.minY,
                            width: slotWidth,
                            height: innerRect.height
                        )
                        cg.fill(cellRect)
                    }
                }

                // Current time needle #0B0B0A
                let progress = CGFloat(min(1440, max(0, currentMinuteOfDay))) / 1440.0
                let needleX = innerRect.minX + progress * innerRect.width
                UIColor(red: 0x0B / 255.0, green: 0x0B / 255.0, blue: 0x0A / 255.0, alpha: 1.0).setFill()
                cg.fill(CGRect(x: needleX - 2, y: drumRect.minY - 2, width: 4, height: drumRect.height + 4))
            }
        }
    }
}

@available(iOS 17.0, *)
public struct BlackoutWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    public let entry: BlackoutWidgetEntry

    // 20% transparent dark navy background (0xCC141A29 = 80% opacity)
    private let widgetBg = Color(red: 0x14 / 255.0, green: 0x1A / 255.0, blue: 0x29 / 255.0, opacity: 0.80)

    public var body: some View {
        let isUnclear = entry.statusInfo.isUnclear || entry.slots.isEmpty
        let statusLabel = isUnclear
            ? AppStrings.schedulesUnclear(entry.lang)
            : (entry.statusInfo.isBlackoutNow ? "СВІТЛА НЕМАЄ" : "СВІТЛО Є")
        let compactCountdown = BlackoutWidgetFormatter.formatWidgetCountdown(
            rawCountdown: entry.statusInfo.countdownText,
            lang: entry.lang
        )

        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(statusLabel)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(isUnclear ? .gray : (entry.statusInfo.isBlackoutNow ? .red : .green))
                Spacer()
                Button(intent: RefreshScheduleIntent()) {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(.white)
                }
                .buttonStyle(.plain)

                Button(intent: ToggleAlertsIntent()) {
                    Image(systemName: entry.notificationsEnabled ? "bell.fill" : "bell.slash.fill")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(entry.notificationsEnabled
                                         ? Color(red: 1.0, green: 0x5E / 255.0, blue: 0x3A / 255.0)
                                         : .gray)
                }
                .buttonStyle(.plain)
            }

            Text(compactCountdown)
                .font(.system(size: family == .systemSmall ? 18 : 22, weight: .heavy, design: .monospaced))
                .foregroundColor(.white)

            if family != .systemSmall {
                let bitmap = BlackoutWidgetFormatter.renderAnalogCounterBitmap(
                    slots: entry.slots,
                    isUnclear: isUnclear,
                    currentMinuteOfDay: KyivZone.minuteOfDay(for: entry.date)
                )
                Image(uiImage: bitmap)
                    .resizable()
                    .scaledToFit()
                    .cornerRadius(8)

                HStack {
                    Text(entry.lang == "en" ? "Next blackout:" : "Наступне відключення:")
                        .font(.system(size: 10))
                        .foregroundColor(.white.opacity(0.7))
                    Spacer()
                    Text(isUnclear ? "--:-- - --:--" : entry.statusInfo.nextSlotTime)
                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                        .foregroundColor(.white)
                }
            }
        }
        .padding(12)
        .containerBackground(widgetBg, for: .widget)
    }
}

@available(iOS 17.0, *)
@main
public struct BlackoutWidget: Widget {
    public let kind: String = "BlackoutWidget"

    public init() {}

    public var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: BlackoutWidgetProvider()) { entry in
            BlackoutWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Світло в Житомирі")
        .description("Моніторинг відключень світла Житомиробленерго та лічильник САЗУ-ИТ.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
