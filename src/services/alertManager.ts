/**
 * Alert & Notification Manager
 * Handles advance alert thresholds, deduplication (strictly once per blackout slot),
 * and local storage persistence.
 */
import { BlackoutSlot, DaySchedule, NotificationRecord, UserSettings } from '../types';
import { calculateOutageCountdown, DEFAULT_ZTOE_URL } from './ztoeParser';
import { translations } from './i18n';

const SETTINGS_KEY = 'zt_blackout_user_settings_v1';
const NOTIFIED_SLOTS_KEY = 'zt_blackout_notified_slots_v1';
const ALERT_LOG_KEY = 'zt_blackout_alert_log_v1';

export const DEFAULT_SETTINGS: UserSettings = {
  city: 'Житомир (ZTOE)',
  url: DEFAULT_ZTOE_URL,
  queue: '2.1',
  refreshIntervalMinutes: 15,
  advanceNoticeMinutes: 30,
  notificationsEnabled: true,
  soundEnabled: true,
  vibrationEnabled: true,
  theme: 'system',
  language: 'system'
};

export function loadUserSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {
    // fallback
  }
  return DEFAULT_SETTINGS;
}

export function saveUserSettings(settings: UserSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save settings:', err);
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

  // Check if within the advance notice window (e.g. <= 30 min)
  if (minutes > settings.advanceNoticeMinutes) {
    return null;
  }

  // Find the continuous blackout block (merging consecutive slots)
  const intervals = countdown.intervals;
  const block = intervals.find(iv => iv.startHour <= slot.startHour && iv.endHour > slot.startHour);

  // Unique block ID identifying this entire continuous blackout period
  const blockId = block
    ? `${schedule.dateStr}_block_${block.start}_${block.end}_Q${schedule.queue}`
    : slot.id;

  // Check if already notified for this block or any sub-slot within this continuous block
  const notifiedSet = loadNotifiedSlotIds();
  if (notifiedSet.has(blockId) || notifiedSet.has(slot.id)) {
    return null;
  }

  if (block) {
    for (let h = block.startHour; h < block.endHour; h++) {
      const s = schedule.slots[h];
      if (s && notifiedSet.has(s.id)) {
        return null; // A slot in this continuous blackout was already alerted!
      }
    }
  }

  // Mark the block ID and all consecutive slots in this block as notified
  markSlotAsNotified(blockId);
  markSlotAsNotified(slot.id);
  if (block) {
    for (let h = block.startHour; h < block.endHour; h++) {
      const s = schedule.slots[h];
      if (s) {
        markSlotAsNotified(s.id);
      }
    }
  }

  // Display time: e.g. "14:00–18:00" if consecutive slots, or "14:00"
  const timeDisplay = block && block.durationHours > 1 
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
  if (settings.soundEnabled) {
    playNotificationTone();
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

  if (settings.soundEnabled) {
    playNotificationTone();
  }

  return record;
}

/**
 * Web Audio synthetic notification chime (pleasant Android chime)
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
  } catch {
    // audio context may be blocked by autoplay policies until user gesture
  }
}
