/**
 * Alert & Notification Manager
 * Handles advance alert thresholds, deduplication (strictly once per blackout slot),
 * sound & vibration independence, master toggle state memory, and local storage persistence.
 */
import { BlackoutSlot, DaySchedule, EmergencyOutageInfo, NotificationRecord, UserSettings } from '../types';
import { calculateOutageCountdown, DEFAULT_ZTOE_URL } from './ztoeParser';
import { translations } from './i18n';

const SETTINGS_KEY = 'zt_blackout_user_settings_v1';
const NOTIFIED_SLOTS_KEY = 'zt_blackout_notified_slots_v1';
const ALERT_LOG_KEY = 'zt_blackout_alert_log_v1';

// =========================================================================================
// CRITICAL CONSTANTS — DO NOT MODIFY DEFAULT VALUES (advanceNoticeMinutes = 15, refreshIntervalMinutes = 30) UNLESS EXPLICITLY REQUESTED
// =========================================================================================
export const DEFAULT_SETTINGS: UserSettings = {
  city: 'Житомир (ZTOE)',
  url: DEFAULT_ZTOE_URL,
  queue: '',
  customQueueStatusText: undefined,
  selectedAddress: undefined,
  selectedAddressQuery: undefined,
  activeEmergencyOutage: null,
  refreshIntervalMinutes: 30,
  advanceNoticeMinutes: 15,
  notificationsEnabled: true,
  emergencyNotificationsEnabled: true,
  soundEnabled: true,
  vibrationEnabled: true,
  prevSoundEnabled: true,
  prevVibrationEnabled: true,
  theme: 'system',
  language: 'system'
};

let memorySettings: UserSettings | null = null;

export function loadUserSettings(): UserSettings {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const merged: UserSettings = {
          ...DEFAULT_SETTINGS,
          ...parsed,
          emergencyNotificationsEnabled: parsed.emergencyNotificationsEnabled ?? true
        };
        const anyAlertsEnabled = Boolean(merged.notificationsEnabled || merged.emergencyNotificationsEnabled);
        if (!anyAlertsEnabled) {
          merged.soundEnabled = false;
          merged.vibrationEnabled = false;
        }
        return merged;
      }
    } else if (memorySettings) {
      return { ...memorySettings };
    }
  } catch {
    // fallback
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveUserSettings(settings: UserSettings): void {
  try {
    const emergencyEnabled = settings.emergencyNotificationsEnabled ?? true;
    const anyAlertsEnabled = Boolean(settings.notificationsEnabled || emergencyEnabled);
    const normalized: UserSettings = {
      ...settings,
      emergencyNotificationsEnabled: emergencyEnabled,
      soundEnabled: anyAlertsEnabled ? settings.soundEnabled : false,
      vibrationEnabled: anyAlertsEnabled ? settings.vibrationEnabled : false,
      prevSoundEnabled: anyAlertsEnabled
        ? settings.soundEnabled
        : (settings.prevSoundEnabled ?? true),
      prevVibrationEnabled: anyAlertsEnabled
        ? settings.vibrationEnabled
        : (settings.prevVibrationEnabled ?? true)
    };
    memorySettings = normalized;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
    }
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}

/**
 * Toggles master notifications ON/OFF (from widget, settings, or main screen):
 * - Does NOT turn off emergencyNotificationsEnabled.
 * - Sound & Vibration remain active if emergencyNotificationsEnabled is ON, and save/disable only when both main and emergency notifications are OFF.
 */
export function toggleMasterNotifications(settings: UserSettings, enabled?: boolean): UserSettings {
  const targetEnabled = enabled !== undefined ? enabled : !settings.notificationsEnabled;
  const emergencyEnabled = settings.emergencyNotificationsEnabled ?? true;
  const anyWasEnabled = Boolean(settings.notificationsEnabled || emergencyEnabled);
  const anyNowEnabled = Boolean(targetEnabled || emergencyEnabled);

  if (!anyNowEnabled) {
    const soundToSave = anyWasEnabled
      ? settings.soundEnabled
      : (settings.prevSoundEnabled ?? true);
    const vibeToSave = anyWasEnabled
      ? settings.vibrationEnabled
      : (settings.prevVibrationEnabled ?? true);
    return {
      ...settings,
      notificationsEnabled: false,
      emergencyNotificationsEnabled: emergencyEnabled,
      soundEnabled: false,
      vibrationEnabled: false,
      prevSoundEnabled: soundToSave,
      prevVibrationEnabled: vibeToSave
    };
  } else if (!anyWasEnabled && anyNowEnabled) {
    return {
      ...settings,
      notificationsEnabled: targetEnabled,
      emergencyNotificationsEnabled: emergencyEnabled,
      soundEnabled: settings.prevSoundEnabled ?? true,
      vibrationEnabled: settings.prevVibrationEnabled ?? true
    };
  } else {
    return {
      ...settings,
      notificationsEnabled: targetEnabled,
      emergencyNotificationsEnabled: emergencyEnabled,
      soundEnabled: settings.soundEnabled,
      vibrationEnabled: settings.vibrationEnabled,
      prevSoundEnabled: settings.soundEnabled,
      prevVibrationEnabled: settings.vibrationEnabled
    };
  }
}

/**
 * Toggles emergency power outages notifications ON/OFF independently from main notifications,
 * while sharing the Sound and Vibration switches.
 */
export function toggleEmergencyNotifications(settings: UserSettings, enabled?: boolean): UserSettings {
  const currentEmergency = settings.emergencyNotificationsEnabled ?? true;
  const targetEmergency = enabled !== undefined ? enabled : !currentEmergency;
  const anyWasEnabled = Boolean(settings.notificationsEnabled || currentEmergency);
  const anyNowEnabled = Boolean(settings.notificationsEnabled || targetEmergency);

  if (!anyNowEnabled) {
    const soundToSave = anyWasEnabled
      ? settings.soundEnabled
      : (settings.prevSoundEnabled ?? true);
    const vibeToSave = anyWasEnabled
      ? settings.vibrationEnabled
      : (settings.prevVibrationEnabled ?? true);
    return {
      ...settings,
      emergencyNotificationsEnabled: false,
      soundEnabled: false,
      vibrationEnabled: false,
      prevSoundEnabled: soundToSave,
      prevVibrationEnabled: vibeToSave
    };
  } else if (!anyWasEnabled && anyNowEnabled) {
    return {
      ...settings,
      emergencyNotificationsEnabled: targetEmergency,
      soundEnabled: settings.prevSoundEnabled ?? true,
      vibrationEnabled: settings.prevVibrationEnabled ?? true
    };
  } else {
    return {
      ...settings,
      emergencyNotificationsEnabled: targetEmergency,
      soundEnabled: settings.soundEnabled,
      vibrationEnabled: settings.vibrationEnabled,
      prevSoundEnabled: settings.soundEnabled,
      prevVibrationEnabled: settings.vibrationEnabled
    };
  }
}

const memoryNotifiedSlots = new Set<string>();

export function loadNotifiedSlotIds(): Set<string> {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(NOTIFIED_SLOTS_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        return new Set(arr);
      }
    }
  } catch {
    // fallback
  }
  return new Set(memoryNotifiedSlots);
}

export function markSlotAsNotified(slotId: string): void {
  memoryNotifiedSlots.add(slotId);
  try {
    if (typeof localStorage !== 'undefined') {
      const set = loadNotifiedSlotIds();
      set.add(slotId);
      // Keep max 100 recent entries to avoid unbounded growth
      const arr = Array.from(set).slice(-100);
      localStorage.setItem(NOTIFIED_SLOTS_KEY, JSON.stringify(arr));
    }
  } catch (err) {
    console.error('Failed to mark slot as notified:', err);
  }
}

export function clearNotifiedHistory(): void {
  memoryNotifiedSlots.clear();
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(NOTIFIED_SLOTS_KEY);
      localStorage.removeItem(ALERT_LOG_KEY);
    }
  } catch {
    // ignore
  }
}

export function resetAllAppDataToFirstLaunch(): UserSettings {
  memoryNotifiedSlots.clear();
  memorySettings = null;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SETTINGS_KEY);
      localStorage.removeItem(NOTIFIED_SLOTS_KEY);
      localStorage.removeItem(ALERT_LOG_KEY);
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_SETTINGS };
}

export function loadAlertLog(): NotificationRecord[] {
  try {
    const raw = localStorage.getItem(ALERT_LOG_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

export function appendAlertLog(record: NotificationRecord): void {
  try {
    const logs = loadAlertLog();
    const updated = [record, ...logs].slice(0, 50);
    localStorage.setItem(ALERT_LOG_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

/**
 * Triggers hardware / browser vibration independently of sound setting
 */
export function triggerDeviceVibration(): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([400, 200, 400]);
    }
  } catch {
    // ignore
  }
}

/**
 * Check if an advance alert should be fired for current schedule.
 * Strictly guarantees only 1 notification per continuous blackout block.
 * Several consecutive blackout timeslots are treated as ONE blackout.
 */
export function checkAndTriggerAdvanceAlert(
  schedule: DaySchedule,
  settings: UserSettings,
  lang: 'uk' | 'en',
  onNotificationFired?: (record: NotificationRecord) => void
): NotificationRecord | null {
  if (!settings.notificationsEnabled || !settings.queue) {
    return null;
  }

  const countdown = calculateOutageCountdown(schedule);
  const slot = countdown.closestBlackoutSlot;
  const minutes = countdown.minutesUntilNextBlackout;

  if (!slot || minutes === null || minutes <= 0) {
    return null;
  }

  // Check if within the advance notice window (e.g. <= 15 min)
  if (minutes > settings.advanceNoticeMinutes) {
    return null;
  }

  // Find the continuous blackout block (merging consecutive slots, including 30-min intervals)
  const intervals = countdown.intervals;
  const slotStartMin = slot.startHour * 60 + (slot.startMinute || 0);
  const block = intervals.find(iv => {
    const ivStartMin = iv.startHour * 60 + (iv.startMinute || 0);
    const ivEndMin = iv.endHour * 60 + (iv.endMinute || 0);
    return ivStartMin <= slotStartMin && ivEndMin > slotStartMin;
  });

  // Unique block ID identifying this entire continuous blackout period
  const blockId = block
    ? `${schedule.dateStr}_block_${block.start}_${block.end}_Q${schedule.queue}`
    : slot.id;

  // Check if already notified for this block or any sub-slot within this continuous block
  const notifiedSet = loadNotifiedSlotIds();
  if (notifiedSet.has(blockId) || notifiedSet.has(slot.id)) {
    return null;
  }

  // Mark the block ID and slot as notified
  markSlotAsNotified(blockId);
  markSlotAsNotified(slot.id);

  // Display time: e.g. "14:00–18:00" if consecutive slots, or "14:00"
  const timeDisplay = block
    ? `${block.start}–${block.end}`
    : slot.startTimeStr;

  const t = translations[lang];
  const record: NotificationRecord = {
    id: `alert_${Date.now()}`,
    slotId: blockId,
    timestamp: Date.now(),
    title: t.realAlertTitle,
    message: t.realAlertBody
      .replace('{queue}', schedule.queue)
      .replace('{time}', timeDisplay)
      .replace('{minutes}', minutes.toString()),
    queue: schedule.queue,
    advanceMinutes: minutes
  };

  appendAlertLog(record);

  // Play sound if enabled
  if (settings.notificationsEnabled && settings.soundEnabled) {
    playNotificationTone();
  }

  // Trigger vibration independently even if sound is disabled!
  if (settings.notificationsEnabled && settings.vibrationEnabled) {
    triggerDeviceVibration();
  }

  if (onNotificationFired) {
    onNotificationFired(record);
  }

  return record;
}

/**
 * Triggers a state-transition notification for Emergency Outages ("Аварійне відключення"):
 * 1) Fires once when an emergency outage is first detected for the user's selected house upon refresh.
 * 2) Fires once when an active emergency outage is cleared/restored upon refresh.
 * Controlled independently by settings.emergencyNotificationsEnabled (default true),
 * working independently from the main settings.notificationsEnabled switch.
 */
export function checkAndTriggerEmergencyOutageAlert(
  prevOutage: EmergencyOutageInfo | null | undefined,
  nextOutage: EmergencyOutageInfo | null | undefined,
  settings: UserSettings,
  lang: 'uk' | 'en',
  onNotificationFired?: (record: NotificationRecord) => void
): NotificationRecord | null {
  const emergencySwitchEnabled = settings.emergencyNotificationsEnabled ?? true;
  if (!emergencySwitchEnabled) {
    return null;
  }

  const notifiedSet = loadNotifiedSlotIds();
  const shouldPlaySound = Boolean(settings.soundEnabled);
  const shouldVibrate = Boolean(settings.vibrationEnabled);

  // Case 1: Emergency outage detected (transition from none or different outage ID -> active)
  if (nextOutage && (!prevOutage || prevOutage.id !== nextOutage.id)) {
    const detectKey = `emerg_detected_${nextOutage.id}`;
    if (notifiedSet.has(detectKey)) {
      return null;
    }
    markSlotAsNotified(detectKey);

    const title =
      lang === 'uk'
        ? nextOutage.outageType || 'Аварійне відключення'
        : 'Emergency Outage';
    const timeWindowUk = [
      nextOutage.startTime ? `Початок: ${nextOutage.startTime}` : '',
      nextOutage.estimatedRestoreTime ? `Орієнтовне відновлення: ${nextOutage.estimatedRestoreTime}` : '',
    ]
      .filter(Boolean)
      .join(' · ');
    const timeWindowEn = [
      nextOutage.startTime ? `Start: ${nextOutage.startTime}` : '',
      nextOutage.estimatedRestoreTime ? `Estimated restore: ${nextOutage.estimatedRestoreTime}` : '',
    ]
      .filter(Boolean)
      .join(' · ');

    const message =
      lang === 'uk'
        ? `За вашою адресою зафіксовано аварійне відключення.${timeWindowUk ? ` ${timeWindowUk}` : ''}`
        : `An emergency power outage was detected at your address.${timeWindowEn ? ` ${timeWindowEn}` : ''}`;

    const record: NotificationRecord = {
      id: `emerg_alert_${Date.now()}`,
      slotId: detectKey,
      timestamp: Date.now(),
      title,
      message,
      queue: settings.queue || '—',
      advanceMinutes: 0,
    };

    appendAlertLog(record);

    if (shouldPlaySound) {
      playNotificationTone();
    }
    if (shouldVibrate) {
      triggerDeviceVibration();
    }
    if (onNotificationFired) {
      onNotificationFired(record);
    }
    return record;
  }

  // Case 2: Emergency outage restored (transition from active -> none)
  if (prevOutage && !nextOutage) {
    const restoreKey = `emerg_restored_${prevOutage.id}`;
    if (notifiedSet.has(restoreKey)) {
      return null;
    }
    markSlotAsNotified(restoreKey);

    const title =
      lang === 'uk'
        ? 'Аварійне відключення завершено'
        : 'Emergency Outage Resolved';
    const message =
      lang === 'uk'
        ? 'Аварійне відключення за вашою адресою завершено, електропостачання відновлено.'
        : 'The emergency outage at your address has ended and power has been restored.';

    const record: NotificationRecord = {
      id: `emerg_restore_${Date.now()}`,
      slotId: restoreKey,
      timestamp: Date.now(),
      title,
      message,
      queue: settings.queue || '—',
      advanceMinutes: 0,
    };

    appendAlertLog(record);

    if (shouldPlaySound) {
      playNotificationTone();
    }
    if (shouldVibrate) {
      triggerDeviceVibration();
    }
    if (onNotificationFired) {
      onNotificationFired(record);
    }
    return record;
  }

  return null;
}

export function createTestNotification(
  settings: UserSettings,
  lang: 'uk' | 'en',
  sampleSlotOrIntervalDesc?: BlackoutSlot | string
): NotificationRecord {
  const t = translations[lang];
  const slotDesc = typeof sampleSlotOrIntervalDesc === 'string'
    ? sampleSlotOrIntervalDesc
    : sampleSlotOrIntervalDesc
    ? `${sampleSlotOrIntervalDesc.startTimeStr}–${sampleSlotOrIntervalDesc.endTimeStr}`
    : '14:00–18:00';

  const record: NotificationRecord = {
    id: `test_${Date.now()}`,
    slotId: `test_block_${Date.now()}`,
    timestamp: Date.now(),
    title: t.testAlertTitle,
    message: t.testAlertBody
      .replace('{queue}', settings.queue)
      .replace('{minutes}', settings.advanceNoticeMinutes.toString())
      .replace('{slot}', slotDesc),
    queue: settings.queue,
    advanceMinutes: settings.advanceNoticeMinutes
  };

  appendAlertLog(record);

  if (settings.notificationsEnabled && settings.soundEnabled) {
    playNotificationTone();
  }

  // Trigger vibration independently even when sound is disabled
  if (settings.notificationsEnabled && settings.vibrationEnabled) {
    triggerDeviceVibration();
  }

  return record;
}

/**
 * Web Audio synthetic notification chime (properly closes AudioContext to prevent memory leaks)
 */
export function playNotificationTone(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const now = ctx.currentTime;

    // Play two-tone ascending alert chime: E5 -> B5
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now); // E5
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(987.77, now + 0.15); // B5
    gain2.gain.setValueAtTime(0.18, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.65);

    // Close AudioContext after chime finishes to prevent memory leak
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 800);
  } catch {
    // audio context may be blocked by autoplay policies until user gesture
  }
}
