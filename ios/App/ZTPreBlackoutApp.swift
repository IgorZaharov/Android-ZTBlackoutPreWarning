import SwiftUI

@main
struct ZTPreBlackoutApp: App {
    /// CI design gallery (milestone M3), only when launched with `-ZTGallery <page>`.
    private let gallery = DesignGallery.fromLaunchArguments()

    init() {
        NetworkProbe.start()
        ZtoeAddressLookup.initDiskCache()
    }

    var body: some Scene {
        WindowGroup {
            if let gallery {
                gallery
            } else {
                // Interim screen of milestone M2 (data layer); replaced by the 1.4.0 screens in M4.
                DataCheckScreen()
            }
        }
    }
}
