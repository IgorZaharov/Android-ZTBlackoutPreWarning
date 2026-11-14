import SwiftUI

/// One outage of the day under the drum (Android `OutageRowItem`, spec/UI_DRUM.md section 5): marker,
/// full span, tags and the full-duration chip. Finished rows are dimmed to 55 %. One VoiceOver element.
public struct OutageRowView: View {
    let text: OutageRowFormat.RowText

    public init(_ text: OutageRowFormat.RowText) {
        self.text = text
    }

    private var tags: String {
        [text.kindTag, text.originTag, text.statusTag, text.continueTag].compactMap { $0 }.joined(separator: " · ")
    }

    public var body: some View {
        HStack(spacing: 10) {
            marker.frame(width: 20, height: 20)

            VStack(alignment: .leading, spacing: 2) {
                Text(verbatim: text.timeText)
                    .ztText(ZtType.timeMono)
                    .foregroundStyle(Color.white)
                    .lineLimit(2)
                if !tags.isEmpty {
                    Text(verbatim: tags)
                        .ztText(ZtType.caption)
                        .foregroundStyle(text.isEmergency && !text.isFinished ? ZtColors.accent : ZtColors.textSecondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if let duration = text.durationText {
                Text(verbatim: duration)
                    .ztText(ZtType.captionMono)
                    .foregroundStyle(ZtColors.accent)
                    .lineLimit(1)
                    .fixedSize()
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background { RoundedRectangle(cornerRadius: 8).fill(Color(argb: 0x26FF5E3A)) }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background { RoundedRectangle(cornerRadius: ZtRadius.row).fill(ZtColors.innerRow) }
        .opacity(text.isFinished ? 0.55 : 1)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(verbatim: text.accessibilityText))
    }

    /// Fixed 20 x 20 leading slot so every row's text starts at the same x.
    @ViewBuilder
    private var marker: some View {
        if text.isEmergency {
            ZStack {
                Circle().fill(ZtColors.accent)
                // The glyph does not scale with Dynamic Type: the circle is fixed at 20 pt
                Text(verbatim: "!").font(.system(size: 12, weight: .black)).foregroundStyle(Color.white)
            }
        } else if text.isRepair {
            Image(systemName: "wrench.fill")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(ZtColors.accent)
        } else {
            Circle().fill(ZtColors.accent).frame(width: 10, height: 10)
        }
    }
}
