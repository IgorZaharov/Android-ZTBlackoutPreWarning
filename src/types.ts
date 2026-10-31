/**
 * Type definitions for Світло в Житомирі
 */

export type SlotStatus = 'POWER_ON' | 'POWER_OFF';

export interface BlackoutSlot {
  id: string; // e.g. "2026-10-30_14:00_Q2.1"
  startHour: number; // 0..23
  endHour: number; // 0..24
  startMinute?: number; // 0 or 30
  endMinute?: number; // 0 or 30
  startTimeStr: string; // "14:00" or "14:30"
  endTimeStr: string; // "18:00" or "15:00"
  status: SlotStatus;
  rawLabel?: string;
}

export interface DaySchedule {
  dateStr: string; // "2026-10-30"
  dayLabel: string; // "Сьогодні (30 жовтня)" or "Завтра (31 жовтня)"
  queue: string; // "1.1"
  city: string; // "Житомир (ZTOE)"
  slots: BlackoutSlot[]; // 48 half-hour slots (or 24 1-hour slots)
  lastUpdated: string;
  sourceUrl: string;
}

export type ThemeMode = 'system' | 'dark' | 'light';
export type Language = 'system' | 'uk' | 'en';

export interface UserSettings {
  city: string;
  url: string;
  queue: string; // e.g. "1.1"
  refreshIntervalMinutes: number; // default 30
  advanceNoticeMinutes: number; // default 15
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  prevSoundEnabled?: boolean;
  prevVibrationEnabled?: boolean;
  theme: ThemeMode;
  language: Language;
}

export interface NotificationRecord {
  id: string;
  slotId: string;
  timestamp: number;
  title: string;
  message: string;
  queue: string;
  advanceMinutes: number;
}

export interface QueueOption {
  id: string; // "1.1", "1.2", "2.1" ...
  group: number; // 1..6
  subgroup: number; // 1..2
  label: string; // "Черга 1.1"
}
