import SwiftUI

// Views of the site and PowerOn status (Android ui/components/SiteStatusIndicator.kt). The rules that
// decide what is shown live in ios/Shared/Design/SiteStatusModel.swift.

/// One status pill: tinted glass, icon and text in the same family. Text wraps instead of clipping.
struct StatusChipView: View {
    let chip: StatusChip

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: chip.icon.symbol).font(.system(size: 13, weight: .semibold))
            Text(verbatim: chip.text).ztText(ZtType.label)
        }
        .foregroundStyle(chip.tone.text)
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .ztGlassChip(chip.tone)
    }
}

/// Chips of the "Last updated" card, plus the PowerOn line when that source is down.
struct SiteStatusChipRow: View {
    let snapshot: OutageSnapshot
    let lang: String

    var body: some View {
        let chips = SiteStatusModel.chips(snapshot, lang)
        let poweron = SiteStatusModel.poweronLine(snapshot, lang)
        if !chips.isEmpty || poweron != nil {
            VStack(alignment: .leading, spacing: 8) {
                if !chips.isEmpty {
                    FlowLayout(spacing: 8, lineSpacing: 8) {
                        ForEach(Array(chips.enumerated()), id: \.offset) { _, chip in StatusChipView(chip: chip) }
                    }
                }
                if let poweron {
                    HStack(spacing: 6) {
                        Image(systemName: poweron.icon.symbol).font(.system(size: 13, weight: .semibold))
                        Text(verbatim: poweron.text).ztText(ZtType.caption)
                    }
                    .foregroundStyle(poweron.tone.text)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

/// Card with the text ztoe publishes in place of the schedule, quoted as is.
struct SiteNoticeCard: View {
    let text: String
    let lang: String

    var body: some View {
        ZtGlassCard {
            HStack(alignment: .top, spacing: 12) {
                Circle().fill(ZtChipTone.amber.fill).frame(width: 36, height: 36)
                    .overlay { Image(systemName: "info.circle.fill").font(.system(size: 18)).foregroundStyle(ZtChipTone.amber.text) }
                VStack(alignment: .leading, spacing: 6) {
                    Text(verbatim: AppStrings.siteNoticeTitle(lang)).ztText(ZtType.overline).foregroundStyle(ZtChipTone.amber.text)
                    let lines = text.components(separatedBy: "\n")
                    ForEach(Array(lines.enumerated()), id: \.offset) { i, line in
                        Text(verbatim: line)
                            .ztText(i == 0 ? ZtType.subhead : ZtType.body)
                            .foregroundStyle(i == 0 ? Color.white : UiColors.textSecondaryHi)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(verbatim: AppStrings.siteNoticeA11y(lang) + ". " + text))
    }
}

/// Persistent banner for a degraded site state (not a 3 s toast). Title and each message line keep to
/// one line, shrinking up to 15 % before they wrap (Android OneLineText).
struct SiteStatusBanner: View {
    let banner: SiteBanner

    var body: some View {
        ZtGlassCard(padding: 12) {
            HStack(spacing: 10) {
                Circle().fill(banner.tone.fill).frame(width: 32, height: 32)
                    .overlay { Image(systemName: banner.icon.symbol).font(.system(size: 15, weight: .semibold)).foregroundStyle(banner.tone.text) }
                VStack(alignment: .leading, spacing: 0) {
                    OneLineText(text: banner.title, role: ZtType.label.weight(.bold), color: banner.tone.text)
                    ForEach(banner.message.components(separatedBy: "\n").filter { !$0.ktIsBlank }, id: \.self) { line in
                        OneLineText(text: line, role: ZtType.caption, color: UiColors.textSecondaryHi)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 2)
        }
        .accessibilityElement(children: .combine)
    }
}

/// Text kept on one line: when it does not fit, the size steps down 5 % at a time to at most 15 % below
/// the role (never under 12 pt); if it still does not fit, it wraps instead of being cut.
struct OneLineText: View {
    let text: String
    let role: ZtTypeRole
    let color: Color

    private func sized(_ factor: CGFloat) -> ZtTypeRole {
        var r = role
        r.size = max(12, role.size * factor)
        r.line = r.size * role.line / role.size
        return r
    }

    private func oneLine(_ factor: CGFloat) -> some View {
        Text(verbatim: text).ztText(sized(factor)).lineLimit(1).fixedSize(horizontal: true, vertical: false)
    }

    var body: some View {
        ViewThatFits(in: .horizontal) {
            oneLine(1.0)
            oneLine(0.95)
            oneLine(0.9)
            oneLine(0.85)
            Text(verbatim: text).ztText(role).fixedSize(horizontal: false, vertical: true)
        }
        .foregroundStyle(color)
    }
}
