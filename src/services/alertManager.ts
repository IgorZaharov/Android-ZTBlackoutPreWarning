/**
 * Alert & Notification Manager
 * Handles advance alert thresholds, deduplication (strictly once per blackout slot),
 * sound & vibration independence, master toggle state memory, and local storage persistence.
 */
import { BlackoutSlot, DaySchedule, NotificationRecord, UserSettings } from '../types';
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
  queue: '1.1',
  refreshIntervalMinutes: 30,
  advanceNoticeMinutes: 15,
  notificationsEnabled: true,
  soundEnabled: true,
  vibrationEnabled: true,
  prevSoundEnabled: true,
  prevVibrationEnabled: true,
  theme: 'system',
  language: 'system'
};

export function loadUserSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const merged: UserSettings = { ...DEFAULT_SETTINGS, ...parsed };
      if (!merged.notificationsEnabled) {
        merged.soundEnabled = false;
        merged.vibrationEnabled = false;
      }
      return merged;
    }
  } catch {
    // fallback
  }
  return DEFAULT_SETTINGS;
}

export function saveUserSettings(settings: UserSettings): void {
  try {
    const normalized: UserSettings = {
      ...settings,
      soundEnabled: settings.notificationsEnabled ? settings.soundEnabled : false,
      vibrationEnabled: settings.notificationsEnabled ? settings.vibrationEnabled : false,
      prevSoundEnabled: settings.notificationsEnabled
        ? settings.soundEnabled
        : (settings.prevSoundEnabled ?? true),
      prevVibrationEnabled: settings.notificationsEnabled
        ? settings.vibrationEnabled
        : (settings.prevVibrationEnabled ?? true)
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}

/**
 * Toggles master notifications ON/OFF:
 * - Turning OFF saves current sound & vibration states and sets both to false (disabled).
 * - Turning ON restores sound & vibration to their previous states.
 */
export function toggleMasterNotifications(settings: UserSettings, enabled?: boolean): UserSettings {
  const targetEnabled = enabled !== undefined ? enabled : !settings.notificationsEnabled;
  if (!targetEnabled) {
    const soundToSave = settings.notificationsEnabled
      ? settings.soundEnabled
      : (settings.prevSoundEnabled ?? true);
    const vibeToSave = settings.notificationsEnabled
      ? settings.vibrationEnabled
      : (settings.prevVibrationEnabled ?? true);
    return {
      ...settings,
      notificationsEnabled: false,
      soundEnabled: false,
      vibrationEnabled: false,
      prevSoundEnabled: soundToSave,
      prevVibrationEnabled: vibeToSave
    };
  } else {
    return {
      ...settings,
      notificationsEnabled: true,
      soundEnabled: settings.prevSoundEnabled ?? true,
      vibrationEnabled: settings.prevVibrationEnabled ?? true
    };
  }
}

export function loadNotifiedSlotIds(): Set<string> {
  try {
    const raw = localStorage.getItem(NOTIFIED_SLOTS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      return new Set(arr);
    }
  } catch {
    // fallback
  }
  return new Set();
}

export function markSlotAsNotified(slotId: string): void {
  try {
    const set = loadNotifiedSlotIds();
    set.add(slotId);
    // Keep max 100 recent entries to avoid unbounded growth
    const arr = Array.from(set).slice(-100);
    localStorage.setItem(NOTIFIED_SLOTS_KEY, JSON.stringify(arr));
  } catch (err) {
    console.error('Failed to mark slot as notified:', err);
  }
}

export function clearNotifiedHistory(): void {
  try {
    localStorage.removeItem(NOTIFIED_SLOTS_KEY);
    localStorage.removeItem(ALERT_LOG_KEY);
  } catch {
    // ignore
  }
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
  if (!settings.notificationsEnabled) {
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
