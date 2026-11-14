import Foundation
import UserNotifications

/// The Settings "Test notification" button (Android `NotificationHelper.showPreWarningNotification`
/// with `isTest = true`). Permission is asked here, after the user acted, never at launch (App Review
/// item R5). Milestone M5 replaces this with the full notification planner.
enum TestAlert {
    static func send(title: String, body: String, sound: Bool) {
        let center = UNUserNotificationCenter.current()
        center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            guard granted else { return }
            let content = UNMutableNotificationContent()
            content.title = title
            content.body = body
            content.categoryIdentifier = "planned"
            if sound { content.sound = .default }
            // a short delay so the banner shows even while the app is in front
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
            center.add(UNNotificationRequest(identifier: "test_alert", content: content, trigger: trigger))
        }
    }

    /// Whether iOS currently refuses notifications for the app (shown as a hint in Settings).
    static func isDenied() async -> Bool {
        await UNUserNotificationCenter.current().notificationSettings().authorizationStatus == .denied
    }
}

/// Shows test alerts as a banner while the app is in front (iOS hides foreground notifications otherwise).
final class ForegroundNotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
    static let shared = ForegroundNotificationDelegate()

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound, .list])
    }
}
