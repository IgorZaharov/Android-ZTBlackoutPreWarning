import SwiftUI

// Small building blocks shared by the Main, Settings and About pages (Android: the private composables
// at the bottom of MainScreen.kt and SettingsScreen.kt). Colours and sizes follow those files.

enum UiColors {
    /// Small text on a translucent card: alphas raised from the 0xB3 / 0x99 tokens so the contrast stays
    /// above 4.5:1 on bright backgrounds (Android MainScreen.kt TextSecondary / TextTertiary).
    static let textSecondaryHi = Color(argb: 0xE6BAE6FD)
    static let textTertiaryHi = Color(argb: 0xCCBAE6FD)
    static let tabIdle = Color(argb: 0xCCBAE6FD)
    static let inkOnAccent = Color(argb: 0xFF0B0B0A)
    static let disabledText = Color(argb: 0x80FFFFFF)
    static let disabledIcon = Color(argb: 0x4DBAE6FD)
    static let iconSecondary = Color(argb: 0xB3BAE6FD)
    static let field = ZtColors.innerRow
    static let emergencyAmber = Color(argb: 0xFFFFB020)
}

/// 1 pt hairline between rows of a card.
struct DividerLine: View {
    var color: Color = ZtColors.divider
    var body: some View { Rectangle().fill(color).frame(height: 1) }
}

/// Overline card title ("МОЇ АДРЕСИ").
struct CardTitle: View {
    let text: String
    var color: Color = .white
    var body: some View {
        Text(verbatim: text).ztText(ZtType.overline).foregroundStyle(color)
    }
}

/// Rotates its content while `active` (refresh icons). Still under Reduce Motion.
struct SpinWhile: ViewModifier {
    let active: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var angle: Double = 0

    func body(content: Content) -> some View {
        content
            .rotationEffect(.degrees(angle))
            .onChange(of: active, initial: true) { _, on in
                if on && !reduceMotion {
                    withAnimation(.linear(duration: 0.9).repeatForever(autoreverses: false)) { angle = 360 }
                } else {
                    withAnimation(.default) { angle = 0 }
                }
            }
    }
}

extension View {
    func spinWhile(_ active: Bool) -> some View { modifier(SpinWhile(active: active)) }
}

/// Pill with a tinted fill, optional icon and text (Settings StatusChip, Android SettingsScreen.kt).
struct PlainChip: View {
    let text: String
    var fill: Color = ZtChipTone.grey.fill
    var foreground: Color = ZtChipTone.grey.text
    var icon: String? = nil

    var body: some View {
        HStack(spacing: 6) {
            if let icon { Image(systemName: icon).font(.system(size: 13, weight: .semibold)) }
            Text(verbatim: text).ztText(ZtType.label)
        }
        .foregroundStyle(foreground)
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .background { RoundedRectangle(cornerRadius: ZtRadius.chip).fill(fill) }
    }
}

/// Labelled switch row. The whole row toggles (Android: role Switch on the row), so VoiceOver reads
/// "title, hint, On" once. Disabled rows show off and dim.
struct SwitchRow: View {
    let icon: String
    var iconTint: Color = .white
    let title: String
    var hint: String? = nil
    let isOn: Bool
    var enabled: Bool = true
    let onChange: (Bool) -> Void

    var body: some View {
        Toggle(isOn: Binding(get: { isOn }, set: { onChange($0) })) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(iconTint)
                    .frame(width: 22)
                VStack(alignment: .leading, spacing: 2) {
                    Text(verbatim: title)
                        .ztText(ZtType.subhead)
                        .foregroundStyle(enabled ? Color.white : UiColors.disabledText)
                    if let hint {
                        Text(verbatim: hint)
                            .ztText(ZtType.caption)
                            .foregroundStyle(enabled ? ZtColors.textSecondary : ZtColors.textTertiary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .contentShape(Rectangle())
            .onTapGesture { if enabled { onChange(!isOn) } }
        }
        .tint(ZtColors.accent)
        .disabled(!enabled)
        .frame(minHeight: ZtMinTouch)
    }
}

/// Button with a 48 pt minimum height. `filled` is the accent button, `subdued` the quiet outlined one.
struct ActionButton: View {
    let text: String
    var icon: String? = nil
    var filled: Bool = false
    var subdued: Bool = false
    /// Work is running: the icon rotates, taps are ignored and `busyText` is announced.
    var busy: Bool = false
    var busyText: String? = nil
    /// Fills the height its row gives it, so two buttons side by side stay equal when one label wraps.
    var fillHeight: Bool = false
    let action: () -> Void

    var body: some View {
        let content = subdued ? ZtColors.textSecondary : Color.white
        Button(action: action) {
            HStack(spacing: 8) {
                if let icon {
                    Image(systemName: icon).font(.system(size: 14, weight: .semibold)).spinWhile(busy)
                }
                Text(verbatim: text)
                    .ztText(filled ? ZtType.label.weight(.bold) : ZtType.label)
                    .multilineTextAlignment(.center)
            }
            .foregroundStyle(content)
            .frame(maxWidth: .infinity, minHeight: ZtMinTouch, maxHeight: fillHeight ? .infinity : nil)
            .padding(.horizontal, 12)
            .background {
                let shape = RoundedRectangle(cornerRadius: ZtRadius.control)
                if filled {
                    shape.fill(ZtColors.accent)
                } else if subdued {
                    shape.strokeBorder(ZtColors.divider, lineWidth: 1)
                } else {
                    shape.fill(Color(argb: 0x1AFFFFFF)).overlay(shape.strokeBorder(ZtColors.cardBorder, lineWidth: 1))
                }
            }
            .contentShape(RoundedRectangle(cornerRadius: ZtRadius.control))
        }
        .buttonStyle(ZtPressStyle())
        .disabled(busy)
        .accessibilityValue(busy ? Text(verbatim: busyText ?? "") : Text(verbatim: ""))
    }
}

/// Read-only field that opens a short preset list (queues, minutes). Long lists use SearchablePickerField.
struct GlassDropdown: View {
    let value: String
    let options: [String]
    let onSelect: (Int) -> Void

    var body: some View {
        Menu {
            ForEach(Array(options.enumerated()), id: \.offset) { index, text in
                Button(text) { onSelect(index) }
            }
        } label: {
            HStack {
                Text(verbatim: value).ztText(ZtType.body).foregroundStyle(Color.white)
                Spacer(minLength: 8)
                Image(systemName: "chevron.up.chevron.down")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color(argb: 0xB3FFFFFF))
            }
            .padding(.horizontal, 16)
            .frame(maxWidth: .infinity, minHeight: 56)
            .background {
                RoundedRectangle(cornerRadius: ZtRadius.control).fill(UiColors.field)
                    .overlay(RoundedRectangle(cornerRadius: ZtRadius.control).strokeBorder(ZtColors.inputBorder, lineWidth: 1))
            }
            .contentShape(Rectangle())
        }
    }
}

/// 48 pt touch target around a 36 pt icon tile (rename / remove an address).
struct IconTile: View {
    let icon: String
    let description: String
    var danger: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            RoundedRectangle(cornerRadius: 12)
                .fill(danger ? Color(argb: 0x33EF4444) : Color(argb: 0x1AFFFFFF))
                .frame(width: 36, height: 36)
                .overlay {
                    Image(systemName: icon)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(danger ? Color(argb: 0xFFFCA5A5) : Color.white)
                }
                .frame(width: ZtMinTouch, height: ZtMinTouch)
                .contentShape(Rectangle())
        }
        .buttonStyle(ZtPressStyle())
        .accessibilityLabel(Text(verbatim: description))
    }
}

/// Wrapping row (Compose FlowRow): children left to right, a new line when the width is used up.
struct FlowLayout: Layout {
    var spacing: CGFloat = 8
    var lineSpacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, lineHeight: CGFloat = 0, maxX: CGFloat = 0
        for s in subviews {
            let size = s.sizeThatFits(ProposedViewSize(width: width, height: nil))
            if x > 0 && x + size.width > width {
                y += lineHeight + lineSpacing
                x = 0
                lineHeight = 0
            }
            x += size.width + spacing
            maxX = max(maxX, x - spacing)
            lineHeight = max(lineHeight, size.height)
        }
        return CGSize(width: proposal.width ?? maxX, height: y + lineHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, lineHeight: CGFloat = 0
        for s in subviews {
            let size = s.sizeThatFits(ProposedViewSize(width: bounds.width, height: nil))
            if x > bounds.minX && x + size.width > bounds.maxX {
                y += lineHeight + lineSpacing
                x = bounds.minX
                lineHeight = 0
            }
            s.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(width: min(size.width, bounds.width), height: size.height))
            x += size.width + spacing
            lineHeight = max(lineHeight, size.height)
        }
    }
}

/// Opens a link in Safari (App Review item R3: donation and Facebook links leave the app, never a web view).
@MainActor
func openExternal(_ url: String) {
    guard let u = URL(string: url) else { return }
    UIApplication.shared.open(u)
}

// MARK: - CI screenshots

/// CI screenshots only (ios/scripts/gallery_screenshots.sh): `-ZTScroll <id>` scrolls the page in front
/// to the card with that id once the page is shown. People never pass launch arguments.
extension View {
    func launchScroll(_ proxy: ScrollViewProxy, active: Bool) -> some View {
        task(id: active) {
            guard active, let target = UserDefaults.standard.string(forKey: "ZTScroll") else { return }
            try? await Task.sleep(for: .seconds(2))
            proxy.scrollTo(target, anchor: .top)
        }
    }
}
