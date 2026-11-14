import SwiftUI

@main
struct ZTPreBlackoutApp: App {
    init() {
        NetworkProbe.start()
        ZtoeAddressLookup.initDiskCache()
    }

    var body: some Scene {
        WindowGroup {
            // Interim screen of milestone M2 (data layer); replaced by the 1.4.0 screens in M4.
            DataCheckScreen()
        }
    }
}
