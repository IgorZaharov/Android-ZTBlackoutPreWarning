/**
 * Alert & Notification Manager
 * Mirrors the Android alert logic (spec/NOTIFICATIONS.md):
 *  - planned pre-warnings come from the outage engine's plan (one alert per merged span of today and
 *    tomorrow, key `planned_<ISO start>`, never for a started, finished or stale span),
 *  - emergency alerts are events of the emergency ledger (START / ETA_CHANGED / END), gated by their
 *    own switch, independent of the master switch,
 *  - deduplication by key in the notified registry, sound & vibration independence, master toggle
 *    state memory, and local storage persistence.
 */
import { BlackoutSlot, DaySchedule, EmergencyOutageInfo, NotificationRecord, UserSettings } from '../types';
import { DEFAULT_ZTOE_URL, legacyClock } from './ztoeParser';
import { isValidEmergencyOutage } from './ztoeAddressLookup';
import {
  emergencyChangedBody,
  emergencyEndBody,
  emergencyEarlyEndTitle,
  emergencyEarlyEndBody,
  emergencyStartBody,
  plannedAlertBody,
  translations,
} from './i18n';
import { eventKey, type EmergencyEvent } from '../core/emergencyLedger';
import {
  formatLocalDate,
  hourOf,
  minuteOf,
  plusDays,
  plusMinutes,
  toLocalDate,
  wallMinutesBetween,
  type LocalDate,
  type LocalDateTime,
} from '../core/localTime';
import { OutageEngine, buildPlanned } from '../core/outageEngine';
import type { AlertSpec, Outage } from '../core/outageModels';
import {
  alertLabels,
  groupAlerts,
  memberKey,
  pendingMembers,
  plannedActive,
  addressKey as subscriptionAddressKey,
  type SubscriptionStore,
} from '../core/subscriptions';
import { getOutageStateStore } from './outageStore';
import { getScheduleCache } from './scheduleCache';

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

/**
 * Whether sound and vibration may be on: the master switch once it is known, else the 1.4.0 rule
 * (spec/SUBSCRIPTIONS.md section 7), so a primary with both switches off never mutes the other addresses.
 */
function soundGate(s: UserSettings): boolean {
  if (typeof s.alertsMaster === 'boolean') return s.alertsMaster;
  return Boolean(s.notificationsEnabled || (s.emergencyNotificationsEnabled ?? true));
}

export function loadUserSettings(): UserSettings {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const validEmergency = isValidEmergencyOutage(parsed.activeEmergencyOutage)
          ? parsed.activeEmergencyOutage
          : null;
        const merged: UserSettings = {
          ...DEFAULT_SETTINGS,
          ...parsed,
          activeEmergencyOutage: validEmergency,
          emergencyNotificationsEnabled: parsed.emergencyNotificationsEnabled ?? true
        };
        const anyAlertsEnabled = soundGate(merged);
        if (!anyAlertsEnabled) {
          merged.soundEnabled = false;
          merged.vibrationEnabled = false;
        }
        return merged;
      }
    } else if (memorySettings) {
      return {
        ...memorySettings,
        activeEmergencyOutage: isValidEmergencyOutage(memorySettings.activeEmergencyOutage)
          ? memorySettings.activeEmergencyOutage
          : null,
      };
    }
  } catch {
    // fallback
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveUserSettings(settings: UserSettings): void {
  try {
    const emergencyEnabled = settings.emergencyNotificationsEnabled ?? true;
    const anyAlertsEnabled = soundGate({ ...settings, emergencyNotificationsEnabled: emergencyEnabled });
    const validEmergency = isValidEmergencyOutage(settings.activeEmergencyOutage)
      ? settings.activeEmergencyOutage
      : null;
    const normalized: UserSettings = {
      ...settings,
      activeEmergencyOutage: validEmergency,
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
      // Keep max 300 recent entries (shared by up to 5 addresses) to avoid unbounded growth
      const arr = Array.from(set).slice(-300);
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
    // the schedule cache, the emergency ledger and the site/PowerOn status belong to the old address
    getScheduleCache().clear();
    getOutageStateStore().clearAll();
  } catch {
    // ignore
  }
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

// ---------------------------------------------------------------------------------------------
// Planned pre-warnings (spec/NOTIFICATIONS.md section 1), driven by the outage engine
// ---------------------------------------------------------------------------------------------

/** An alert whose moment passed this long ago is still delivered (a throttled background tab), like AlarmReceiver's tolerance. */
const ALERT_GRACE_MINUTES = 2;

/**
 * The alert plan: one alert per merged planned/repair span of the window yesterday..tomorrow, at
 * `start - advance`, never retroactive, never for a started, finished or stale span. Key
 * `planned_<ISO start>`. Empty while the master switch is off.
 */
export function planPreWarnings(outages: readonly Outage[], now: LocalDateTime, settings: Pick<UserSettings, 'notificationsEnabled' | 'advanceNoticeMinutes'>): AlertSpec[] {
  if (!settings.notificationsEnabled) return [];
  return OutageEngine.planAlerts(outages, now, settings.advanceNoticeMinutes);
}

const hm = (t: LocalDateTime): string => `${String(hourOf(t)).padStart(2, '0')}:${String(minuteOf(t)).padStart(2, '0')}`;

function deliver(record: NotificationRecord, playSound: boolean, vibrate: boolean, onFired?: (record: NotificationRecord) => void): void {
  appendAlertLog(record);
  if (playSound) playNotificationTone();
  // Vibration is independent of sound
  if (vibrate) triggerDeviceVibration();
  if (onFired) onFired(record);
}

/**
 * The web stand-in for the exact alarms: called on every tick with the current outages, it fires
 * the alerts whose moment has come (`fireAt <= now`, the span has not begun more than 2 minutes ago)
 * once each (registry key). The plan comes from the engine; like AlarmReceiver it never alerts for
 * finished or stale spans. Gated by `notificationsEnabled` only.
 */
export function checkAndTriggerPlannedAlerts(
  outages: readonly Outage[],
  now: LocalDateTime,
  settings: UserSettings,
  lang: 'uk' | 'en',
  onNotificationFired?: (record: NotificationRecord) => void
): NotificationRecord[] {
  if (!settings.notificationsEnabled) return [];
  const advance = settings.advanceNoticeMinutes;
  // Look back far enough that an alert that became due since the last tick (or a throttled tab) is still planned
  const lookback = plusMinutes(now, -(advance + ALERT_GRACE_MINUTES));
  const due = OutageEngine.planAlerts(outages, lookback, advance).filter((a) => !(a.fireAt > now));
  if (due.length === 0) return [];

  const t = translations[lang];
  const fired: NotificationRecord[] = [];
  for (const alert of due) {
    if (loadNotifiedSlotIds().has(alert.key)) continue;
    markSlotAsNotified(alert.key);
    const minutesLeft = wallMinutesBetween(now, alert.spanStart);
    const record: NotificationRecord = {
      id: `alert_${Date.now()}_${fired.length}`,
      slotId: alert.key,
      timestamp: Date.now(),
      title: t.plannedAlertTitle,
      message: plannedAlertBody(
        lang,
        settings.queue,
        hm(alert.spanStart),
        OutageEngine.formatSpanTime(alert.spanEnd),
        minutesLeft,
        alert.durationMinutes,
        alert.mayContinue
      ),
      queue: settings.queue,
      advanceMinutes: Math.max(minutesLeft, 0),
    };
    deliver(record, settings.soundEnabled, settings.vibrationEnabled, onNotificationFired);
    fired.push(record);
  }
  return fired;
}

/**
 * The web stand-in for the exact alarms with several addresses (spec/SUBSCRIPTIONS.md section 8): the
 * plan of every plannedActive subscription is grouped per queue and span, and each due group is posted
 * once while one of its members was not warned yet; posting marks every member. Gated by the master
 * switch and each address's planned switch. [outagesFor] returns the outages of a queue and address key.
 */
export function checkAndTriggerGroupedAlerts(
  store: SubscriptionStore,
  master: boolean,
  outagesFor: (queue: string | null, key: string | null) => readonly Outage[],
  now: LocalDateTime,
  settings: UserSettings,
  lang: 'uk' | 'en',
  onNotificationFired?: (record: NotificationRecord) => void
): NotificationRecord[] {
  if (!master) return [];
  const advance = settings.advanceNoticeMinutes;
  // Look back far enough that an alert that became due since the last tick (or a throttled tab) is still planned
  const lookback = plusMinutes(now, -(advance + ALERT_GRACE_MINUTES));
  const alertsById: Record<string, AlertSpec[]> = {};
  for (const item of store.items) {
    if (!plannedActive(master, item)) continue;
    const key = item.address ? subscriptionAddressKey(item.address) : null;
    alertsById[item.id] = OutageEngine.planAlerts(outagesFor(item.queue, key), lookback, advance);
  }
  const due = groupAlerts(store, master, alertsById).filter((g) => !(g.fireAt > now));
  if (due.length === 0) return [];

  const t = translations[lang];
  const fired: NotificationRecord[] = [];
  for (const group of due) {
    const notified = loadNotifiedSlotIds();
    if (pendingMembers(group, (k) => notified.has(k)).length === 0) continue;
    for (const id of group.memberIds) markSlotAsNotified(memberKey(id, group.spanStart));
    const minutesLeft = wallMinutesBetween(now, group.spanStart);
    const record: NotificationRecord = {
      id: `alert_${Date.now()}_${fired.length}`,
      slotId: group.key,
      timestamp: Date.now(),
      title: t.plannedAlertTitle,
      message: plannedAlertBody(
        lang,
        group.queue,
        hm(group.spanStart),
        OutageEngine.formatSpanTime(group.spanEnd),
        minutesLeft,
        group.durationMinutes,
        group.mayContinue,
        alertLabels(store, group.memberIds)
      ),
      queue: group.queue,
      advanceMinutes: Math.max(minutesLeft, 0),
      // a tap shows the first member, the primary when it is one
      subscriptionId: group.memberIds[0],
    };
    deliver(record, settings.soundEnabled, settings.vibrationEnabled, onNotificationFired);
    fired.push(record);
  }
  return fired;
}

/**
 * Check if an advance alert should be fired for a legacy DaySchedule (today's table, emergency
 * cells excluded). Thin wrapper over [checkAndTriggerPlannedAlerts]: several consecutive blackout
 * slots are ONE merged span, so there is strictly one notification per continuous block.
 */
export function checkAndTriggerAdvanceAlert(
  schedule: DaySchedule,
  settings: UserSettings,
  lang: 'uk' | 'en',
  onNotificationFired?: (record: NotificationRecord) => void,
  now: Date = new Date()
): NotificationRecord | null {
  if (!settings.notificationsEnabled || !settings.queue) return null;
  const slots = schedule.slots || [];
  if (slots.length === 0 || schedule.isUnclear) return null;
  const clock = legacyClock(schedule, now);
  const planned = slots.map((s) => s.status === 'POWER_OFF' && !s.isEmergency);
  const fired = checkAndTriggerPlannedAlerts(buildPlanned(clock.today, planned, null), clock.now, settings, lang, onNotificationFired);
  return fired[0] ?? null;
}

// ---------------------------------------------------------------------------------------------
// Emergency events (spec/NOTIFICATIONS.md section 2), produced by the ledger
// ---------------------------------------------------------------------------------------------

/** "22:04", "завтра 01:00", "вчора 23:30" or "13.11 22:04" relative to [today]. */
export function formatWhen(lang: 'uk' | 'en', dt: LocalDateTime, today: LocalDate): string {
  const time = hm(dt);
  const date = toLocalDate(dt);
  if (date === today) return time;
  if (date === plusDays(today, 1)) return `${translations[lang].tomorrowWord} ${time}`;
  if (date === plusDays(today, -1)) return `${translations[lang].yesterdayWord} ${time}`;
  const dateStr = formatLocalDate(date);
  return `${dateStr.slice(8, 10)}.${dateStr.slice(5, 7)} ${time}`;
}

/**
 * Posts the notifications for ledger events (start / restore time changed / end). Each event is
 * announced once: its key (`emerg_start_<addr>_<startISO>` etc.) is remembered in the notified
 * registry. Callers only pass events produced by a confirmed fetch, so a failed request never gets
 * here. Gated by `emergencyNotificationsEnabled`, which is the primary's `master AND emergencyAlerts`
 * (owner decision 1); another subscription passes its own gate and address line in [options]
 * (spec/SUBSCRIPTIONS.md 8.4).
 */
export function triggerEmergencyEventAlerts(
  events: readonly EmergencyEvent[],
  addressKey: string,
  settings: UserSettings,
  lang: 'uk' | 'en',
  now: LocalDateTime,
  onNotificationFired?: (record: NotificationRecord) => void,
  options: { addressLine?: string | null; enabled?: boolean; subscriptionId?: string | null } = {}
): NotificationRecord[] {
  const emergencyEnabled = options.enabled ?? settings.emergencyNotificationsEnabled ?? true;
  if (!emergencyEnabled || events.length === 0) return [];
  const t = translations[lang];
  const today = toLocalDate(now);
  const line = options.addressLine !== undefined ? options.addressLine : settings.selectedAddress;
  const address = line?.replace(/\n/g, ' ').trim() || null;
  const fired: NotificationRecord[] = [];

  for (const ev of events) {
    const key = eventKey(ev, addressKey);
    if (loadNotifiedSlotIds().has(key)) continue;
    markSlotAsNotified(key);

    const start = formatWhen(lang, ev.start, today);
    const eta = ev.eta !== null ? formatWhen(lang, ev.eta, today) : null;
    let title: string;
    let body: string;
    switch (ev.kind) {
      case 'START':
        title = ev.upcoming ? t.emergencyUpcomingTitle : t.emergencyStartTitle;
        body = emergencyStartBody(lang, start, eta);
        break;
      case 'ETA_CHANGED':
        title = t.emergencyChangedTitle;
        body = emergencyChangedBody(lang, eta ?? start);
        break;
      case 'END':
        if (ev.earlyEnd && eta !== null) {
          // Before the estimated restore PowerOn can not tell "restored early" from "cancelled"
          title = emergencyEarlyEndTitle(lang);
          body = emergencyEarlyEndBody(lang, eta);
        } else {
          title = t.emergencyEndTitle;
          body = emergencyEndBody(lang, start);
        }
        break;
    }
    const record: NotificationRecord = {
      id: `emerg_${Date.now()}_${fired.length}`,
      slotId: key,
      timestamp: Date.now(),
      title,
      message: address ? `${body}\n${address}` : body,
      queue: settings.queue || '—',
      advanceMinutes: 0,
      ...(options.subscriptionId ? { subscriptionId: options.subscriptionId } : {}),
    };
    deliver(record, settings.soundEnabled, settings.vibrationEnabled, onNotificationFired);
    fired.push(record);
  }
  return fired;
}

/**
 * @deprecated Retired in 1.4.0. Emergency alerts are events of the ledger now: `OutageRepository.refresh`
 * reconciles PowerOn with the ledger and calls [triggerEmergencyEventAlerts]. This shim stays only so
 * the old App.tsx keeps compiling; it never fires anything.
 */
export function checkAndTriggerEmergencyOutageAlert(
  _prevOutage: EmergencyOutageInfo | null | undefined,
  _nextOutage: EmergencyOutageInfo | null | undefined,
  _settings: UserSettings,
  _lang: 'uk' | 'en',
  _onNotificationFired?: (record: NotificationRecord) => void
): NotificationRecord | null {
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
