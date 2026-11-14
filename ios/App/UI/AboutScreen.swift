import SwiftUI

/// About page (port of Android ui/screens/AboutScreen.kt 1.4.0): identity, description, links,
/// donations (from donations.json, refreshed once a day) and the disclaimer. iOS differences: no
/// mini-game entry (owner decision D3), a privacy policy link (App Review item R6), and every link
/// opens in Safari, never inside the app (R3).
struct AboutScreen: View {
    let lang: String

    @State private var donations: [DonationItem] = DonationsRepository.DEFAULT_DONATIONS

    private var version: String {
        let raw = (Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "").ktTrim()
        return "v" + (raw.range(of: #"^[0-9]+\.[0-9]+"#, options: .regularExpression) != nil ? raw : "1.4.0")
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                identity
                description
                block(title: AppStrings.aboutLinksTitle(lang)) {
                    LinkRow(title: AppStrings.devProfile(lang), detail: "github.com/IgorZaharov", url: "https://github.com/IgorZaharov", lang: lang) {
                        tile(Color.white) { Image(systemName: "chevron.left.forwardslash.chevron.right").foregroundStyle(Color.black) }
                    }
                    LinkRow(title: AppStrings.desktopApp(lang), detail: "github.com/IgorZaharov/Android-ZTBlackoutPreWarning/blob/main/README.md",
                            url: AppStrings.ABOUT_GITHUB_README_URL, lang: lang) {
                        tile(Color(argb: 0x26FFFFFF)) { Image(systemName: "desktopcomputer").foregroundStyle(Color.white) }
                    }
                    LinkRow(title: AppStrings.repoIssues(lang), detail: "github.com/IgorZaharov/.../issues",
                            url: "https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning/issues", lang: lang) {
                        tile(ZtColors.accent) { Image(systemName: "ladybug.fill").foregroundStyle(Color.white) }
                    }
                    LinkRow(title: AppStrings.privacyPolicyIos(lang), detail: "github.com/IgorZaharov/.../PRIVACY_POLICY.md",
                            url: AppStrings.PRIVACY_POLICY_URL_IOS, lang: lang) {
                        tile(Color(argb: 0x26FFFFFF)) { Image(systemName: "hand.raised.fill").foregroundStyle(Color.white) }
                    }
                }
                block(title: AppStrings.aboutDonationsTitle(lang)) {
                    ForEach(donations) { item in
                        LinkRow(title: item.title, detail: item.url.replacingOccurrences(of: #"^https?://"#, with: "", options: .regularExpression),
                                url: item.url, lang: lang) {
                            tile(Color(argb: 0x26FFFFFF)) { Favicon(pageUrl: item.url) }
                        }
                    }
                }
                disclaimer
                Spacer(minLength: 96)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .task {
            let fresh = await DonationsRepository.shared.getDonationsWithDailyRefresh(forceRefresh: true)
            if !fresh.isEmpty { donations = fresh }
        }
    }

    private var identity: some View {
        VStack(spacing: 0) {
            RoundedRectangle(cornerRadius: 18).fill(ZtColors.accent).frame(width: 60, height: 60)
                .overlay { Image(systemName: "bolt.fill").font(.system(size: 30, weight: .bold)).foregroundStyle(Color.white) }
                .accessibilityHidden(true)
            Spacer().frame(height: 12)
            Text(verbatim: AppStrings.aboutTitle(lang)).ztText(ZtType.heading.weight(.bold)).foregroundStyle(Color.white)
                .accessibilityAddTraits(.isHeader)
            Spacer().frame(height: 4)
            Text(verbatim: AppStrings.aboutSubtitle(lang)).ztText(ZtType.caption).foregroundStyle(ZtColors.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 12)
            Spacer().frame(height: 10)
            HStack(spacing: 8) {
                Text(verbatim: version).ztText(ZtType.captionMono.weight(.regular)).foregroundStyle(Color.white)
                    .padding(.horizontal, 10).padding(.vertical, 4)
                    .background { RoundedRectangle(cornerRadius: 12).fill(Color(argb: 0x1AFFFFFF)) }
                Text(verbatim: "SwiftUI").ztText(ZtType.caption.weight(.bold)).foregroundStyle(ZtColors.accent)
                    .padding(.horizontal, 10).padding(.vertical, 4)
                    .background { RoundedRectangle(cornerRadius: 12).fill(Color(argb: 0x33FF5E3A)) }
            }
        }
        .frame(maxWidth: .infinity)
        .padding(20)
        .ztGlassSurface()
    }

    private var description: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(verbatim: AppStrings.aboutDescTitle(lang)).ztText(ZtType.overline).foregroundStyle(ZtColors.textSecondary)
            Text(verbatim: AppStrings.aboutDescText(lang)).ztText(ZtType.caption).foregroundStyle(Color(argb: 0xFFE2E8F0))
            Text(verbatim: AppStrings.aboutDesktopNoticeIos(lang)).ztText(ZtType.caption).foregroundStyle(ZtColors.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
                .background { RoundedRectangle(cornerRadius: ZtRadius.row).fill(ZtColors.innerRow) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .ztGlassSurface()
    }

    private var disclaimer: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 10).fill(ZtChipTone.amber.fill).frame(width: 36, height: 36)
                .overlay { Image(systemName: "checkmark.shield.fill").font(.system(size: 16)).foregroundStyle(ZtChipTone.amber.text) }
                .accessibilityHidden(true)
            Text(verbatim: AppStrings.disclaimerText(lang)).ztText(ZtType.caption).foregroundStyle(ZtColors.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(18)
        .ztGlassSurface()
    }

    private func block<C: View>(title: String, @ViewBuilder _ content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(verbatim: title).ztText(ZtType.overline).foregroundStyle(ZtColors.textSecondary)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .ztGlassSurface()
    }

    private func tile<C: View>(_ fill: Color, @ViewBuilder _ content: () -> C) -> some View {
        RoundedRectangle(cornerRadius: 10).fill(fill).frame(width: 36, height: 36)
            .overlay { content().font(.system(size: 16, weight: .semibold)) }
    }
}

/// One tappable link: icon tile, title, the address in mono, and the external-link mark. Opens Safari.
private struct LinkRow<Icon: View>: View {
    let title: String
    let detail: String
    let url: String
    let lang: String
    @ViewBuilder let icon: () -> Icon

    var body: some View {
        Button { openExternal(url) } label: {
            HStack(spacing: 10) {
                icon()
                VStack(alignment: .leading, spacing: 0) {
                    Text(verbatim: title).ztText(ZtType.label.weight(.bold)).foregroundStyle(Color.white)
                    Text(verbatim: detail).ztText(ZtType.captionMono.weight(.regular)).foregroundStyle(ZtColors.textTertiary).lineLimit(2)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Image(systemName: "arrow.up.right.square").font(.system(size: 15)).foregroundStyle(ZtColors.textTertiary)
            }
            .padding(12)
            .background { RoundedRectangle(cornerRadius: ZtRadius.row).fill(ZtColors.innerRow) }
            .contentShape(Rectangle())
        }
        .buttonStyle(ZtPressStyle())
        .accessibilityHint(Text(verbatim: AppStrings.externalLinkIos(lang)))
    }
}

/// Site icon of a donation link: the first favicon candidate that loads, a globe until then.
private struct Favicon: View {
    let pageUrl: String
    @State private var index = 0

    var body: some View {
        let candidates = DonationsRepository.getFaviconCandidateUrls(for: pageUrl)
        if index < candidates.count, let url = URL(string: candidates[index]) {
            AsyncImage(url: url) { phase in
                switch phase {
                case let .success(image):
                    image.resizable().scaledToFit().frame(width: 22, height: 22).clipShape(RoundedRectangle(cornerRadius: 4))
                case .failure:
                    globe.onAppear { index += 1 }
                default:
                    globe
                }
            }
            .id(index)
        } else {
            globe
        }
    }

    private var globe: some View {
        Image(systemName: "globe").font(.system(size: 16, weight: .semibold)).foregroundStyle(Color.white)
    }
}
