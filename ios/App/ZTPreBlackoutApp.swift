import SwiftUI
import UserNotifications

@main
struct ZTPreBlackoutApp: App {
    /// CI design gallery (milestone M3), only when launched with `-ZTGallery <page>`.
    private let gallery = DesignGallery.fromLaunchArguments()

    init() {
        NetworkProbe.start()
        ZtoeAddressLookup.initDiskCache()
        UNUserNotificationCenter.current().delegate = ForegroundNotificationDelegate.shared
        AppModel.applyLaunchSeed()
        BackgroundRefresh.schedule()
    }

    var body: some Scene {
        WindowGroup {
            if let gallery {
                gallery
            } else {
                RootView()
            }
        }
        // iOS runs it when it sees fit (BackgroundRefresh.swift, plan milestone M5)
        .backgroundTask(.appRefresh(BackgroundRefresh.identifier)) {
            await BackgroundRefresh.run()
        }
    }
}
