/**
 * Schedule cache of the ztoe tables, ported from android/.../data/repository/ScheduleRepository.kt
 * (`zt_schedule_cache_v2`, spec/PERSISTENCE.md section 2).
 *
 * Today and tomorrow off-cells per queue are stored with the date stamp they were fetched for, as the
 * same '0'/'1' strings Android writes. A failed fetch never clears the cache; a cache is valid for
 * today only if its date stamp equals today (Kyiv). The previous day is archived so the tail of an
 * outage that began before midnight keeps its real start ("yesterday tail").
 *
 * Every method takes the Kyiv [today] explicitly, so tests drive it with a fake clock.
 */
import { formatLocalDate, plusDays, type LocalDate } from '../core/localTime';
import { JsonPrefs, defaultStorage, type KeyValueStorage } from './storage';

export const SCHEDULE_CACHE_STORAGE_KEY = 'zt_schedule_cache_v2';

const encode = (cells: readonly boolean[]): string => cells.map((off) => (off ? '1' : '0')).join('');

/** null for anything shorter than 24 cells, like `ScheduleRepository.encodedToCells`. */
function decode(encoded: string | null | undefined): boolean[] | null {
  if (!encoded || encoded.length < 24) return null;
  return Array.from(encoded, (ch) => ch === '1');
}

export class ScheduleCache {
  private readonly prefs: JsonPrefs;

  constructor(storage: KeyValueStorage = defaultStorage(), storageKey: string = SCHEDULE_CACHE_STORAGE_KEY) {
    this.prefs = new JsonPrefs(storage, storageKey);
  }

  // --- writes ---------------------------------------------------------------------------------

  /** Keeps the last day's cells for one more day (spec/OUTAGE_ENGINE.md, "yesterday tail"). */
  private archiveYesterday(changes: Record<string, string | number | boolean | undefined>, queue: string, yesterdayStr: string): void {
    const oldDate = this.prefs.getString(`cache_today_date_${queue}`) ?? this.prefs.getString('cache_today_date');
    const oldSlots = this.prefs.getString(`cache_today_slots_${queue}`);
    if (oldDate === yesterdayStr && oldSlots) {
      changes[`cache_yesterday_date_${queue}`] = yesterdayStr;
      changes[`cache_yesterday_slots_${queue}`] = oldSlots;
    }
  }

  private putQueue(
    changes: Record<string, string | number | boolean | undefined>,
    queue: string,
    todayCells: readonly boolean[],
    tomorrowCells: readonly boolean[] | null,
    today: LocalDate
  ): void {
    const todayStr = formatLocalDate(today);
    const tomorrowStr = formatLocalDate(plusDays(today, 1));
    this.archiveYesterday(changes, queue, formatLocalDate(plusDays(today, -1)));
    changes[`cache_today_date_${queue}`] = todayStr;
    changes[`cache_today_slots_${queue}`] = encode(todayCells);
    if (tomorrowCells && tomorrowCells.length > 0) {
      changes[`cache_tomorrow_date_${queue}`] = tomorrowStr;
      changes[`cache_tomorrow_slots_${queue}`] = encode(tomorrowCells);
      changes[`cache_has_tomorrow_${queue}`] = true;
    } else {
      changes[`cache_tomorrow_date_${queue}`] = undefined;
      changes[`cache_tomorrow_slots_${queue}`] = undefined;
      changes[`cache_has_tomorrow_${queue}`] = false;
    }
  }

  saveSchedule(queue: string, todayCells: readonly boolean[], tomorrowCells: readonly boolean[] | null, today: LocalDate, nowMs: number): void {
    if (!queue.trim()) return;
    const changes: Record<string, string | number | boolean | undefined> = {};
    this.putQueue(changes, queue, todayCells, tomorrowCells, today);
    changes.cache_today_date = formatLocalDate(today);
    changes.cache_today_queue = queue;
    changes.cache_last_sync_ms = nowMs;
    this.prefs.edit(changes);
  }

  /** All queues in one write, like `saveAllSchedulesBatch`. */
  saveAllSchedulesBatch(
    schedules: ReadonlyMap<string, { today: readonly boolean[]; tomorrow: readonly boolean[] | null }>,
    activeQueue: string,
    today: LocalDate,
    nowMs: number
  ): void {
    if (schedules.size === 0) return;
    const changes: Record<string, string | number | boolean | undefined> = {
      cache_today_date: formatLocalDate(today),
      cache_today_queue: activeQueue,
      cache_last_sync_ms: nowMs,
    };
    for (const [queue, cells] of schedules) this.putQueue(changes, queue, cells.today, cells.tomorrow, today);
    this.prefs.edit(changes);
  }

  clear(): void {
    this.prefs.clear();
  }

  // --- reads ----------------------------------------------------------------------------------

  /** Midnight rollover: promotes the cached tomorrow table into today when the date crossed 00:00 Kyiv time. */
  private promoteTomorrowOnRollover(queue: string, today: LocalDate): void {
    if (!queue.trim()) return;
    const todayStr = formatLocalDate(today);
    const yesterdayStr = formatLocalDate(plusDays(today, -1));
    const cachedDate = this.prefs.getString(`cache_today_date_${queue}`) ?? this.prefs.getString('cache_today_date');
    const tomorrowDate = this.prefs.getString(`cache_tomorrow_date_${queue}`);
    const tomorrowEncoded = this.prefs.getString(`cache_tomorrow_slots_${queue}`);
    if (cachedDate === yesterdayStr && tomorrowDate === todayStr && tomorrowEncoded) {
      const changes: Record<string, string | number | boolean | undefined> = {};
      this.archiveYesterday(changes, queue, yesterdayStr);
      changes.cache_today_date = todayStr;
      changes[`cache_today_date_${queue}`] = todayStr;
      changes[`cache_today_slots_${queue}`] = tomorrowEncoded;
      changes[`cache_tomorrow_date_${queue}`] = undefined;
      changes[`cache_tomorrow_slots_${queue}`] = undefined;
      changes[`cache_has_tomorrow_${queue}`] = false;
      this.prefs.edit(changes);
    }
  }

  private encodedToday(queue: string, today: LocalDate): string {
    if (!queue.trim()) return '';
    this.promoteTomorrowOnRollover(queue, today);
    const cachedDate = this.prefs.getString(`cache_today_date_${queue}`) ?? this.prefs.getString('cache_today_date');
    const encoded = this.prefs.getString(`cache_today_slots_${queue}`);
    return cachedDate === formatLocalDate(today) && encoded ? encoded : '';
  }

  /** True where power is off per the ztoe table; null when there is no valid cache for that day. */
  todayOffCells(queue: string, today: LocalDate): boolean[] | null {
    if (!queue.trim()) return null;
    return decode(this.encodedToday(queue, today));
  }

  tomorrowOffCells(queue: string, today: LocalDate): boolean[] | null {
    if (!queue.trim()) return null;
    this.promoteTomorrowOnRollover(queue, today);
    const cachedToday = this.prefs.getString(`cache_today_date_${queue}`) ?? this.prefs.getString('cache_today_date');
    const cachedTomorrowDate = this.prefs.getString(`cache_tomorrow_date_${queue}`);
    const hasTomorrow = this.prefs.getBoolean(`cache_has_tomorrow_${queue}`, false);
    const encoded = this.prefs.getString(`cache_tomorrow_slots_${queue}`);
    const dateValid =
      cachedToday === formatLocalDate(today) && (cachedTomorrowDate === null || cachedTomorrowDate === formatLocalDate(plusDays(today, 1)));
    return dateValid && hasTomorrow ? decode(encoded) : null;
  }

  yesterdayOffCells(queue: string, today: LocalDate): boolean[] | null {
    if (!queue.trim()) return null;
    if (this.prefs.getString(`cache_yesterday_date_${queue}`) !== formatLocalDate(plusDays(today, -1))) return null;
    return decode(this.prefs.getString(`cache_yesterday_slots_${queue}`));
  }

  hasValidTodayCache(queue: string, today: LocalDate): boolean {
    return this.todayOffCells(queue, today) !== null;
  }

  hasTomorrowSchedule(queue: string, today: LocalDate): boolean {
    return this.tomorrowOffCells(queue, today) !== null;
  }

  lastSyncMs(): number {
    return this.prefs.getLong('cache_last_sync_ms', 0);
  }
}

/** Process-wide cache on the default storage (window.localStorage in the browser). */
let defaultCache: ScheduleCache | null = null;
export function getScheduleCache(): ScheduleCache {
  return (defaultCache ??= new ScheduleCache());
}
