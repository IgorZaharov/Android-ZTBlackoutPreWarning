import Foundation
import BackgroundTasks
import UIKit
import WidgetKit

public final class BackgroundSyncManager {
    public static let shared = BackgroundSyncManager()
    public static let TASK_IDENTIFIER = "ua.blackout.prewarning.sync"

    public func registerBackgroundTasks() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: Self.TASK_IDENTIFIER, using: nil) { task in
            guard let refreshTask = task as? BGAppRefreshTask else {
                task.setTaskCompleted(success: false)
                return
            }
            self.handleAppRefresh(task: refreshTask)
        }

        NotificationCenter.default.addObserver(
            forName: NSNotification.Name.NSSystemClockDidChange,
            object: nil,
            queue: .main
        ) { _ in
            NotificationScheduler.shared.syncAlarms(onTimeChanged: true)
        }
    }

    public func schedulePeriodicWork() {
        let settings = SettingsRepository.shared.loadSettings()
        let intervalMinutes = max(15, settings.refreshIntervalMinutes)
        let request = BGAppRefreshTaskRequest(identifier: Self.TASK_IDENTIFIER)
        request.earliestBeginDate = Date(timeIntervalSinceNow: TimeInterval(intervalMinutes * 60))
        try? BGTaskScheduler.shared.submit(request)
    }

    private func handleAppRefresh(task: BGAppRefreshTask) {
        schedulePeriodicWork()
        let settings = SettingsRepository.shared.loadSettings()

        let syncTask = Task {
            let result = await ZtoeParser.fetchFullSchedule(urlStr: settings.url)
            NotificationScheduler.shared.syncAlarms(onTimeChanged: false)
            WidgetCenter.shared.reloadAllTimelines()
            task.setTaskCompleted(success: result.status == .SUCCESS)
        }

        task.expirationHandler = {
            syncTask.cancel()
        }
    }
}
