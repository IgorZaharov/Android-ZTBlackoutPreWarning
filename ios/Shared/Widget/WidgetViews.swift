import AppIntents
import SwiftUI
import UIKit
import WidgetKit

/// How a widget is drawn: in full colour, or as one tint (the home screen's tinted and clear styles,
/// `widgetRenderingMode` accented / vibrant). In the tinted look the state is carried by opacity and the
/// emergency stripes, never by colour alone (plan section 4).
public enum WidgetLook: Sendable {
    case fullColor, tinted

    public init(_ mode: WidgetRenderingMode) {
        self = mode == .fullColor ? .fullColor : .tinted
    }
}

// MARK: - Drum

/// The 24-hour drum of the widgets: the same cells (`DrumGeometry.cells`) and, in full colour, the same
/// drawing (`DrumRenderer.drawCells`) as the main screen's `TimelineBar`, so both show the same 48 states;
/// only the frame is compact (ticks every 6 h) to fit a medium widget.
public struct WidgetDrum: View {
    let cells: [DrumCell]?
    let summary: String
    let hour: Int
    let minute: Int
    let lang: String
    let look: WidgetLook

    public init(slots: [BlackoutSlot], hour: Int, minute: Int, lang: String, look: WidgetLook) {
        cells = DrumGeometry.cells(slots)
        summary = OutageRowFormat.drumSummary(lang, slots, unclearBase: false)
        self.hour = hour
        self.minute = minute
        self.lang = lang
        self.look = look
    }

    /// Opacity of one cell in the tinted look: off = solid, on = faint (emergency adds stripes on top).
    public static func tintedAlpha(_ cell: DrumCell) -> Double { cell.planned ? 1 : 0.28 }

    public var body: some View {
        VStack(spacing: 2) {
            ZStack {
                if let cells {
                    Canvas { gc, size in
                        if look == .fullColor {
                            DrumRenderer.drawCells(gc, size: size, cells: cells, unclearBase: false)
                        } else {
                            Self.drawTinted(gc, size: size, cells: cells)
                        }
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 2))
                    .padding(3)
                    needle.padding(.vertical, 1)
                } else {
                    Text(verbatim: AppStrings.outagesUnclear(lang))
                        .font(.system(size: 12, weight: .heavy))
                        .foregroundStyle(Color.white)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background {
                            RoundedRectangle(cornerRadius: 2)
                                .fill(look == .fullColor
                                      ? AnyShapeStyle(LinearGradient(colors: ZtDrumColors.unclear, startPoint: .top, endPoint: .bottom))
                                      : AnyShapeStyle(Color.white.opacity(0.28)))
                        }
                        .padding(3)
                }
            }
            .background { RoundedRectangle(cornerRadius: 6).fill(look == .fullColor ? ZtDrumColors.well : Color.clear) }
            .overlay {
                RoundedRectangle(cornerRadius: 6)
                    .strokeBorder(look == .fullColor ? ZtDrumColors.wellBorder : Color.white.opacity(0.5), lineWidth: 1.5)
            }
            .frame(maxHeight: .infinity)
            ticks
        }
        .padding(.horizontal, 6)
        .padding(.top, 5)
        .padding(.bottom, 3)
        .background {
            RoundedRectangle(cornerRadius: 12)
                .fill(look == .fullColor
                      ? AnyShapeStyle(LinearGradient(colors: ZtDrumColors.faceplate, startPoint: .top, endPoint: .bottom))
                      : AnyShapeStyle(Color.white.opacity(0.08)))
        }
        .widgetAccentable(look == .tinted)
        .invalidatableContent()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(verbatim: summary))
    }

    /// One-tint cells: solid when off, faint when on, emergency bottom halves striped solid.
    static func drawTinted(_ gc: GraphicsContext, size: CGSize, cells: [DrumCell]) {
        let w = size.width
        let h = size.height
        let halfW = DrumGeometry.hourWidth(trackWidth: w) / 2
        for (i, cell) in cells.prefix(48).enumerated() {
            let left = DrumGeometry.cellLeft(i, trackWidth: w)
            let width = halfW + (i % 2 == 0 ? 0.5 : 0)
            gc.fill(Path(CGRect(x: left, y: 0, width: width, height: h)), with: .color(Color.white.opacity(tintedAlpha(cell))))
            if cell.emergency {
                var g = gc
                let rect = CGRect(x: left, y: h / 2, width: width, height: h / 2)
                g.clip(to: Path(rect))
                var path = Path()
                let period = DrumGeometry.stripePeriod
                var x = (floor((rect.minX - rect.height) / period)) * period
                while x < rect.maxX {
                    path.move(to: CGPoint(x: x, y: rect.maxY))
                    path.addLine(to: CGPoint(x: x + rect.height, y: rect.minY))
                    x += period
                }
                g.stroke(path, with: .color(Color.white), lineWidth: DrumGeometry.stripeWidth)
            }
        }
    }

    private var needle: some View {
        Canvas { gc, size in
            let inset: CGFloat = 3
            let x = inset + DrumGeometry.needleX(trackWidth: size.width - inset * 2, hour: hour, minute: minute)
            if look == .fullColor {
                gc.fill(Path(roundedRect: CGRect(x: x - 2, y: 0, width: 4, height: size.height), cornerRadius: 2), with: .color(ZtDrumColors.needleHalo))
                gc.fill(Path(roundedRect: CGRect(x: x - 1.25, y: 0, width: 2.5, height: size.height), cornerRadius: 1.25), with: .color(ZtDrumColors.needle))
            } else {
                gc.fill(Path(roundedRect: CGRect(x: x - 1.5, y: 0, width: 3, height: size.height), cornerRadius: 1.5), with: .color(Color.white))
            }
        }
        .allowsHitTesting(false)
    }

    private var ticks: some View {
        HStack(spacing: 0) {
            ForEach(DrumGeometry.tickHours(every: 6), id: \.self) { h in
                if h != 0 { Spacer(minLength: 0) }
                Text(verbatim: h < 10 ? "0\(h)" : "\(h)")
                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                    .foregroundStyle(look == .fullColor ? ZtDrumColors.tick : Color.white)
                    .fixedSize()
            }
        }
        .padding(.horizontal, 1)
    }
}

// MARK: - Pieces

private enum WidgetText {
    // Inline in android/.../widget/BlackoutGlanceWidget.kt (Ukrainian in both languages, as on Android)
    static func countdownLabel(_ off: Bool) -> String { off ? "До увімкнення:" : "До відключення:" }
    static let period = "Період"
    static let next = "Наступне відключення"
}

private extension WidgetModel {
    var statusText: String { isUnclear ? AppStrings.powerUnclear(lang) : isOffNow ? AppStrings.widgetPowerOff(lang) : AppStrings.widgetPowerOn(lang) }
    var statusColor: Color { isUnclear ? WidgetInk.unclear : isOffNow ? ZtColors.accent : WidgetInk.powerOn }
}

/// Round refresh and bell buttons: interactive App Intents (iOS 17), the bell is the master switch for all
/// addresses (owner decision 4) and the refresh refreshes everything.
private struct WidgetButtons: View {
    let master: Bool
    let refreshing: Bool
    let size: CGFloat
    let look: WidgetLook
    let lang: String

    var body: some View {
        HStack(spacing: 6) {
            Button(intent: RefreshWidgetIntent()) {
                Circle().fill(WidgetInk.buttonFill).frame(width: size, height: size)
                    .overlay {
                        Image(systemName: refreshing ? "ellipsis" : "arrow.clockwise")
                            .font(.system(size: size * 0.45, weight: .bold))
                            .foregroundStyle(WidgetInk.text)
                    }
                    .invalidatableContent()
            }
            .buttonStyle(.plain)
            .accessibilityLabel(Text(verbatim: AppStrings.refreshBtn(lang)))
            Button(intent: ToggleAlertsIntent()) {
                Circle().fill(master ? (look == .fullColor ? WidgetInk.bellOnFill : Color.white) : WidgetInk.buttonFill).frame(width: size, height: size)
                    .overlay {
                        Image(systemName: master ? "bell.fill" : "bell.slash.fill")
                            .font(.system(size: size * 0.48, weight: .semibold))
                            .foregroundStyle(master ? (look == .fullColor ? WidgetInk.bellOnIcon : Color.black) : WidgetInk.text)
                    }
                    .widgetAccentable(look == .tinted && master)
                    .invalidatableContent()
            }
            .buttonStyle(.plain)
            .accessibilityLabel(Text(verbatim: AppStrings.masterHint(lang)))
            .accessibilityAddTraits(master ? .isSelected : [])
        }
    }
}

private struct HeaderLine: View {
    let m: WidgetModel
    let queueSize: CGFloat
    let labelSize: CGFloat

    var body: some View {
        HStack(spacing: 6) {
            Text(verbatim: m.queueHeader).font(.system(size: queueSize, weight: .bold)).foregroundStyle(WidgetInk.text).lineLimit(1)
            if let label = m.addressLabel {
                Text(verbatim: label).font(.system(size: labelSize)).foregroundStyle(WidgetInk.secondary).lineLimit(1)
            }
        }
    }
}

// MARK: - Small

/// Small widget (Android 2x1): queue, status, countdown and the two buttons.
public struct SmallWidgetView: View {
    let m: WidgetModel
    let master: Bool
    let refreshing: Bool
    let look: WidgetLook

    public init(model: WidgetModel, master: Bool, refreshing: Bool, look: WidgetLook) {
        m = model
        self.master = master
        self.refreshing = refreshing
        self.look = look
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HeaderLine(m: m, queueSize: 15, labelSize: 10)
            Text(verbatim: m.statusText).font(.system(size: 12, weight: .bold)).foregroundStyle(m.statusColor)
                .lineLimit(1).minimumScaleFactor(0.8).widgetAccentable()
            Spacer(minLength: 0)
            Text(verbatim: WidgetText.countdownLabel(m.isOffNow)).font(.system(size: 10)).foregroundStyle(WidgetInk.secondary).lineLimit(1)
            Text(verbatim: m.countdown).font(.system(size: 18, weight: .bold, design: .rounded)).foregroundStyle(WidgetInk.text)
                .lineLimit(1).minimumScaleFactor(0.7).widgetAccentable().invalidatableContent()
            HStack {
                Spacer(minLength: 0)
                WidgetButtons(master: master, refreshing: refreshing, size: 32, look: look, lang: m.lang)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

// MARK: - Big (medium and large)

/// Big widget (Android 3x2 / 4x2): header with the buttons, countdown card with the period, the drum; the
/// large size adds the next outage and today's outage rows.
public struct BigWidgetView: View {
    let m: WidgetModel
    let master: Bool
    let refreshing: Bool
    let look: WidgetLook
    let large: Bool

    public init(model: WidgetModel, master: Bool, refreshing: Bool, look: WidgetLook, large: Bool) {
        m = model
        self.master = master
        self.refreshing = refreshing
        self.look = look
        self.large = large
    }

    public var body: some View {
        VStack(spacing: 6) {
            HStack(alignment: .center, spacing: 8) {
                VStack(alignment: .leading, spacing: 1) {
                    HeaderLine(m: m, queueSize: 16, labelSize: 11)
                    HStack(spacing: 6) {
                        Text(verbatim: m.statusText).font(.system(size: 11, weight: .bold)).foregroundStyle(m.statusColor)
                            .lineLimit(1).widgetAccentable()
                        if let stale = m.staleCaption {
                            Text(verbatim: stale).font(.system(size: 9)).foregroundStyle(UiTokens.amber).lineLimit(1)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                WidgetButtons(master: master, refreshing: refreshing, size: 34, look: look, lang: m.lang)
            }
            HStack(alignment: .bottom) {
                VStack(alignment: .leading, spacing: 0) {
                    Text(verbatim: WidgetText.countdownLabel(m.isOffNow)).font(.system(size: 10)).foregroundStyle(WidgetInk.secondary)
                    Text(verbatim: m.countdown).font(.system(size: 18, weight: .bold, design: .rounded)).foregroundStyle(WidgetInk.text)
                        .lineLimit(1).minimumScaleFactor(0.7).widgetAccentable().invalidatableContent()
                }
                Spacer(minLength: 6)
                VStack(alignment: .trailing, spacing: 0) {
                    Text(verbatim: WidgetText.period).font(.system(size: 10)).foregroundStyle(WidgetInk.secondary)
                    Text(verbatim: m.period).font(.system(size: 12, weight: .bold)).foregroundStyle(WidgetInk.text).lineLimit(1).minimumScaleFactor(0.8)
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background { RoundedRectangle(cornerRadius: 12).fill(look == .fullColor ? WidgetInk.innerCard : Color.black.opacity(0.1)) }
            WidgetDrum(slots: m.slots, hour: m.nowHour, minute: m.nowMinute, lang: m.lang, look: look)
                .frame(height: large ? 64 : nil)
            if large {
                HStack {
                    Text(verbatim: m.nextOutage).font(.system(size: 11, weight: .bold)).foregroundStyle(WidgetInk.text).lineLimit(1)
                    Spacer(minLength: 6)
                    Text(verbatim: WidgetText.next).font(.system(size: 10)).foregroundStyle(ZtColors.accent).lineLimit(1).widgetAccentable()
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background { RoundedRectangle(cornerRadius: 8).fill(WidgetInk.innerCard) }
                // The app's rows are too tall for a large widget on a smaller iPhone (the content overflowed
                // and cut the header, TestFlight 1.4.0 (31)): compact rows, and the list gives way first.
                VStack(spacing: 4) {
                    ForEach(Array(m.rows.prefix(4).enumerated()), id: \.offset) { _, row in
                        WidgetRowView(text: row)
                    }
                }
                .frame(minHeight: 0, maxHeight: .infinity, alignment: .top)
                .clipped()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }
}

/// One outage of the day in the large widget: the row of the main screen (`OutageRowView`) in one line
/// with smaller type, so four rows fit on every iPhone.
struct WidgetRowView: View {
    let text: OutageRowFormat.RowText

    private var tags: String {
        [text.kindTag, text.originTag, text.statusTag, text.continueTag].compactMap { $0 }.joined(separator: " · ")
    }

    var body: some View {
        HStack(spacing: 8) {
            marker.frame(width: 14, height: 14)
            Text(verbatim: text.timeText)
                .font(.system(size: 13, weight: .bold, design: .monospaced))
                .foregroundStyle(WidgetInk.text)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
                .layoutPriority(1)
            if !tags.isEmpty {
                Text(verbatim: tags)
                    .font(.system(size: 10))
                    .foregroundStyle(text.isEmergency && !text.isFinished ? ZtColors.accent : WidgetInk.secondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 4)
            if let duration = text.durationText {
                Text(verbatim: duration)
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundStyle(ZtColors.accent)
                    .lineLimit(1)
                    .fixedSize()
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background { RoundedRectangle(cornerRadius: 6).fill(Color(argb: 0x26FF5E3A)) }
                    .widgetAccentable()
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background { RoundedRectangle(cornerRadius: 8).fill(WidgetInk.innerCard) }
        .opacity(text.isFinished ? 0.55 : 1)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(verbatim: text.accessibilityText))
    }

    @ViewBuilder
    private var marker: some View {
        if text.isEmergency {
            ZStack {
                Circle().fill(ZtColors.accent)
                Text(verbatim: "!").font(.system(size: 9, weight: .black)).foregroundStyle(Color.white)
            }
        } else if text.isRepair {
            Image(systemName: "wrench.fill").font(.system(size: 11, weight: .semibold)).foregroundStyle(ZtColors.accent)
        } else {
            Circle().fill(ZtColors.accent).frame(width: 8, height: 8)
        }
    }
}

// MARK: - «Графік» strip

/// «Графік» (Android 4x1 strip, a medium widget on iOS): one info line and the drum, no buttons; a tap
/// opens the app.
public struct StripWidgetView: View {
    let m: WidgetModel
    let look: WidgetLook

    public init(model: WidgetModel, look: WidgetLook) {
        m = model
        self.look = look
    }

    /// Android's 4x1 strip is one line over the drum; an iOS medium widget is twice as tall, so the drum
    /// keeps the large widget's height (stretched to the full height it looked squeezed, TestFlight 1.4.0
    /// (31)) and the info takes two lines instead of truncating.
    public var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HeaderLine(m: m, queueSize: 15, labelSize: 11)
                .frame(maxWidth: .infinity, alignment: .leading)
            HStack(spacing: 6) {
                Text(verbatim: m.statusText).font(.system(size: 12, weight: .bold)).foregroundStyle(m.statusColor)
                    .lineLimit(1).minimumScaleFactor(0.8).widgetAccentable()
                Spacer(minLength: 4)
                if !m.isUnclear {
                    Text(verbatim: m.countdown).font(.system(size: 15, weight: .bold, design: .rounded)).foregroundStyle(WidgetInk.text)
                        .lineLimit(1).invalidatableContent()
                }
            }
            WidgetDrum(slots: m.slots, hour: m.nowHour, minute: m.nowMinute, lang: m.lang, look: look)
                .frame(height: 64)
        }
        .padding(.horizontal, 2)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// Background of every widget: the time-of-day palette under a layer that follows the iPhone's light or dark
/// appearance (owner, 2026-11-15: like the system widgets, and lighter than Android's #CC141A29 card); in the
/// tinted and clear styles the system replaces it with its own glass.
public struct WidgetBackground: View {
    let date: Date

    public init(date: Date) { self.date = date }

    public var body: some View {
        ZStack {
            AmbientBackground(palette: TimeOfDayPalette.current(now: date), frozenSeconds: 0)
            WidgetInk.layer
        }
    }
}

/// Widget colours that follow the iPhone's light or dark appearance. A dynamic `UIColor` resolves against the
/// widget's own colour scheme, so no view has to read the environment. The drum keeps its own colours.
enum WidgetInk {
    private static func dynamic(light: UInt32, dark: UInt32) -> Color {
        Color(UIColor { traits in
            let v = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat((v >> 16) & 0xFF) / 255, green: CGFloat((v >> 8) & 0xFF) / 255,
                           blue: CGFloat(v & 0xFF) / 255, alpha: CGFloat((v >> 24) & 0xFF) / 255)
        })
    }

    /// Main text: near-black on the light layer, white on the dark one.
    static let text = dynamic(light: 0xFF111827, dark: 0xFFFFFFFF)
    /// Labels and the address: about 7:1 on light, 8:1 on dark.
    static let secondary = dynamic(light: 0xFF374151, dark: 0xB8FFFFFF)
    /// The layer over the time-of-day palette: 55 % in both modes, so the wallpaper colours show through.
    static let layer = dynamic(light: 0x8CF4F6FA, dark: 0x8C141A29)
    /// Cards inside the widget (countdown, next outage, rows).
    static let innerCard = dynamic(light: 0x14000000, dark: 0x2E000000)
    /// Round button background when the bell is off and for the refresh button.
    static let buttonFill = dynamic(light: 0x1A000000, dark: 0x26FFFFFF)
    /// The bell when alerts are on: white disc with the accent bell on dark, accent disc with a white bell on light.
    static let bellOnFill = dynamic(light: 0xFFFF5E3A, dark: 0xFFFFFFFF)
    static let bellOnIcon = dynamic(light: 0xFFFFFFFF, dark: 0xFFFF5E3A)
    /// "СВІТЛО Є": the app's green on dark, a darker green on light for contrast.
    static let powerOn = dynamic(light: 0xFF047857, dark: 0xFF34D399)
    static let unclear = dynamic(light: 0xFF4B5563, dark: 0xFF9CA3AF)
}

enum UiTokens {
    static let amber = Color(argb: 0xFFFFB020)
}
