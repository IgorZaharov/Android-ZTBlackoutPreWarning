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
    }

    var body: some Scene {
        WindowGroup {
            if let gallery {
                gallery
            } else {
                RootView()
            }
        }
    }
}
