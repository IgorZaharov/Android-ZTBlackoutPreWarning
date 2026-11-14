import SwiftUI

@main
struct ZTPreBlackoutApp: App {
    init() {
        BackgroundSyncManager.shared.registerBackgroundTasks()
        BackgroundSyncManager.shared.schedulePeriodicWork()
    }

    var body: some Scene {
        WindowGroup {
            BlackoutAppNavigation()
        }
    }
}
