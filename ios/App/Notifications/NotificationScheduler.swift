import Foundation
import UserNotifications
import UIKit
import WidgetKit

public final class NotificationScheduler {
    public static let shared = NotificationScheduler()
    public static let SCHEDULED_IDS_KEY = "zt_scheduled_alarms_v1"

    private var defaults: UserDefaults {
        UserDefaults(suiteName: ScheduleRepository.APP_GROUP_ID) ?? .standard
    }

    public func requestAuthorizationIfNeeded() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
    }

    public func syncAlarms(onTimeChanged: Bool = false, now: Date = Date()) {
        let settings = SettingsRepository.shared.loadSettings()
        let todayStr = KyivZone.todayIsoString(now: now)
        let currentMin = KyivZone.minuteOfDay(for: now)

        if onTimeChanged {
            AlertRegistry.shared.resetFutureSlotsOnTimeChange(
                queue: settings.queue,
                todayStr: todayStr,
                currentMinuteOfDay: currentMin,
                advanceNoticeMinutes: settings.advanceNoticeMinutes
            )
        }

        let center = UNUserNotificationCenter.current()
        let previousIds = defaults.stringArray(forKey: Self.SCHEDULED_IDS_KEY) ?? []

        let rawSlots = ScheduleRepository.shared.getTodaySlots(queue: settings.queue, now: now)
        let slots = ScheduleRepository.shared.applyEmergencyOutageToSlots(
            slots: rawSlots,
            startTime: settings.activeEmergencyOutageStart,
            restoreTime: settings.activeEmergencyOutageRestore,
            isTomorrow: false
        )
        let intervals = ScheduleRepository.shared.getDetailedIntervals(slots: slots)

        // Protect any active pre-warning in-flight window [alertTime - 1min, blockStartTime + 2min]
        var inFlightSlotIds: Set<String> = []
        for interval in intervals {
            let slotId = "block_\(todayStr)_\(interval.startStr)_\(interval.endStr)_Q\(settings.queue)"
            let alertMin = interval.startMinuteOfDay - settings.advanceNoticeMinutes
            if currentMin >= alertMin - 1 && currentMin <= interval.endMinuteOfDay + 2 {
                inFlightSlotIds.insert(slotId)
            }
        }

        let idsToCancel = previousIds.filter { !inFlightSlotIds.contains($0) }
        if !idsToCancel.isEmpty {
            center.removePendingNotificationRequests(withIdentifiers: idsToCancel)
        }

        // Sweep legacy notifications across all 12 queues
        sweepLegacyQueueAlarms(activeQueue: settings.queue, preserveIds: inFlightSlotIds, now: now)

        guard settings.notificationsEnabled, !ScheduleRepository.shared.isScheduleUnclear() else {
            defaults.set(Array(inFlightSlotIds), forKey: Self.SCHEDULED_IDS_KEY)
            WidgetCenter.shared.reloadAllTimelines()
            return
        }

        let lang = AppStrings.resolveLanguage(settings.language)
        var scheduledIds: [String] = Array(inFlightSlotIds)

        for interval in intervals {
            let slotId = "block_\(todayStr)_\(interval.startStr)_\(interval.endStr)_Q\(settings.queue)"
            if AlertRegistry.shared.hasNotified(slotId: slotId) || inFlightSlotIds.contains(slotId) {
                continue
            }

            let alertMinuteOfDay = interval.startMinuteOfDay - settings.advanceNoticeMinutes
            if alertMinuteOfDay <= currentMin {
                // If currently within the pre-warning window [alertTime - 2min, blockStartTime + 2min], fire immediately once
                if currentMin >= alertMinuteOfDay - 2 && currentMin <= interval.startMinuteOfDay + 2 {
                    AlertRegistry.shared.markNotified(slotId: slotId)
                    showPreWarningNotification(
                        slotId: slotId,
                        settings: settings,
                        lang: lang,
                        intervalText: "\(interval.startStr) – \(interval.endStr)",
                        isTest: false
                    )
                }
                continue
            }

            var dateComps = KyivZone.calendar.dateComponents([.year, .month, .day], from: now)
            dateComps.timeZone = KyivZone.timeZone
            dateComps.hour = max(0, alertMinuteOfDay / 60)
            dateComps.minute = max(0, alertMinuteOfDay % 60)
            dateComps.second = 0

            let content = buildNotificationContent(
                settings: settings,
                lang: lang,
                intervalText: "\(interval.startStr) – \(interval.endStr)",
                slotId: slotId,
                isTest: false
            )
            let trigger = UNCalendarNotificationTrigger(dateMatching: dateComps, repeats: false)
            let request = UNNotificationRequest(identifier: slotId, content: content, trigger: trigger)
            center.add(request, withCompletionHandler: nil)
            scheduledIds.append(slotId)
        }

        defaults.set(scheduledIds, forKey: Self.SCHEDULED_IDS_KEY)
        WidgetCenter.shared.reloadAllTimelines()
    }

    public func showPreWarningNotification(
        slotId: String,
        settings: UserSettings,
        lang: String,
        intervalText: String,
        isTest: Bool = false
    ) {
        let content = buildNotificationContent(
            settings: settings,
            lang: lang,
            intervalText: intervalText,
            slotId: slotId,
            isTest: isTest
        )
        if settings.vibrationEnabled {
            DispatchQueue.main.async {
                let generator = UINotificationFeedbackGenerator()
                generator.notificationOccurred(.warning)
            }
        }
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 0.2, repeats: false)
        let req = UNNotificationRequest(identifier: isTest ? "test_\(UUID().uuidString)" : slotId, content: content, trigger: trigger)
        UNUserNotificationCenter.current().add(req, withCompletionHandler: nil)
    }

    public func showEmergencyOutageNotification(
        settings: UserSettings,
        lang: String,
        title: String,
        body: String,
        outageKey: String
    ) {
        guard settings.emergencyNotificationsEnabled else { return }
        guard !AlertRegistry.shared.hasNotified(slotId: outageKey) else { return }
        AlertRegistry.shared.markNotified(slotId: outageKey)

        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = settings.soundEnabled ? .default : nil
        content.userInfo = [
            "slotId": outageKey,
            "queue": settings.queue,
            "isEmergency": true
        ]
        if settings.vibrationEnabled {
            DispatchQueue.main.async {
                let generator = UINotificationFeedbackGenerator()
                generator.notificationOccurred(.warning)
            }
        }
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 0.2, repeats: false)
        let req = UNNotificationRequest(identifier: outageKey, content: content, trigger: trigger)
        UNUserNotificationCenter.current().add(req, withCompletionHandler: nil)
    }

    private func buildNotificationContent(
        settings: UserSettings,
        lang: String,
        intervalText: String,
        slotId: String,
        isTest: Bool
    ) -> UNMutableNotificationContent {
        let content = UNMutableNotificationContent()
        content.title = AppStrings.notificationTitle(lang, isTest: isTest)
        content.body = AppStrings.notificationBody(
            lang,
            queue: settings.queue,
            advanceMinutes: settings.advanceNoticeMinutes,
            intervalText: intervalText
        )
        content.sound = settings.soundEnabled ? .default : nil
        content.userInfo = [
            "slotId": slotId,
            "queue": settings.queue,
            "intervalText": intervalText,
            "isTest": isTest
        ]
        return content
    }

    private func sweepLegacyQueueAlarms(activeQueue: String, preserveIds: Set<String>, now: Date) {
        let center = UNUserNotificationCenter.current()
        center.getPendingNotificationRequests { requests in
            let staleIds = requests.map(\.identifier).filter { id in
                guard !preserveIds.contains(id) else { return false }
                return !id.hasSuffix("_Q\(activeQueue)")
            }
            if !staleIds.isEmpty {
                center.removePendingNotificationRequests(withIdentifiers: staleIds)
            }
        }
    }
}
