/**
 * Small persistent state of the outage pipeline, ported from android/.../data/repository/OutageStateStore.kt
 * and kept apart from user settings (spec/PERSISTENCE.md section 3). One JSON object under the
 * localStorage key `zt_outage_state_v1` with the same logical keys as the Android preferences file:
 *
 *   ledger_<addr>   JSON array of ledger entries (ISO local date-times, 48 h retention)
 *   repair_<addr>   JSON array of planned repair works
 *   ids_<addr>      resolved PowerOn ids {cityIds, streetIds, resolvedAtMs}
 *   site_state, site_checked_ms, site_last_success_ms, poweron_ok, poweron_checked_ms, poweron_last_ok_ms
 */
import { formatLocalDateTime, parseLocalDateTime, type LocalDateTime } from '../core/localTime';
import type { LedgerEntry } from '../core/emergencyLedger';
import { makeOutage, type Outage } from '../core/outageModels';
import { SITE_STATES, type SiteState } from '../core/siteState';
import type { PowerOnIds } from './poweronClient';
import { JsonPrefs, defaultStorage, type KeyValueStorage } from './storage';

export const OUTAGE_STATE_STORAGE_KEY = 'zt_outage_state_v1';

/** When the ztoe site was last checked and what was found. */
export interface SiteSnapshot {
  readonly state: SiteState;
  readonly checkedAtMs: number;
  readonly lastSuccessMs: number | null;
  /** The site's own notice ("УВАГА! ВАЖЛИВА ІНФОРМАЦІЯ!"), kept only while the page has no table. */
  readonly notice: string | null;
}

/** Whether the last PowerOn refresh worked. */
export interface PowerOnSnapshot {
  readonly ok: boolean;
  readonly checkedAtMs: number;
  readonly lastOkMs: number | null;
}

const fmt = (t: LocalDateTime | null): string | undefined => (t === null ? undefined : formatLocalDateTime(t));
const optTime = (v: unknown): LocalDateTime | null => (typeof v === 'string' && v.length > 0 ? parseLocalDateTime(v) : null);
/** `JSONObject.getString`: throws when absent, which skips the element. */
const reqStr = (v: unknown): string => {
  if (typeof v !== 'string') throw new Error('missing string');
  return v;
};
const optStr = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);

export class OutageStateStore {
  private readonly prefs: JsonPrefs;

  constructor(storage: KeyValueStorage = defaultStorage(), storageKey: string = OUTAGE_STATE_STORAGE_KEY) {
    this.prefs = new JsonPrefs(storage, storageKey);
  }

  // --- helpers ---------------------------------------------------------------------------------

  /** A broken element is skipped, a broken array is empty (Kotlin `runCatching { map(...) }.getOrNull()`). */
  private readArray<T>(key: string, map: (o: Record<string, unknown>) => T): T[] {
    const raw = this.prefs.getString(key);
    if (raw === null) return [];
    try {
      const arr: unknown = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      const out: T[] = [];
      for (const o of arr) {
        try {
          if (o && typeof o === 'object') out.push(map(o as Record<string, unknown>));
        } catch {
          // skip a broken element
        }
      }
      return out;
    } catch {
      return [];
    }
  }

  // --- emergency ledger (per address) ----------------------------------------------------------

  ledger(addressKey: string): LedgerEntry[] {
    return this.readArray(`ledger_${addressKey}`, (o) => ({
      id: reqStr(o.id),
      start: parseLocalDateTime(reqStr(o.start)),
      estimatedEnd: optTime(o.estimatedEnd),
      label: optStr(o.label),
      firstSeen: parseLocalDateTime(reqStr(o.firstSeen)),
      lastSeen: parseLocalDateTime(reqStr(o.lastSeen)),
      closedAt: optTime(o.closedAt),
      startEmitted: typeof o.startEmitted === 'boolean' ? o.startEmitted : true,
      endEmitted: typeof o.endEmitted === 'boolean' ? o.endEmitted : false,
      lastEmittedEta: optTime(o.lastEmittedEta),
    }));
  }

  saveLedger(addressKey: string, entries: readonly LedgerEntry[]): void {
    const key = `ledger_${addressKey}`;
    if (entries.length === 0) {
      this.prefs.edit({ [key]: undefined });
      return;
    }
    const arr = entries.map((e) => ({
      id: e.id,
      start: formatLocalDateTime(e.start),
      estimatedEnd: fmt(e.estimatedEnd),
      label: e.label ?? undefined,
      firstSeen: formatLocalDateTime(e.firstSeen),
      lastSeen: formatLocalDateTime(e.lastSeen),
      closedAt: fmt(e.closedAt),
      startEmitted: e.startEmitted,
      endEmitted: e.endEmitted,
      lastEmittedEta: fmt(e.lastEmittedEta),
    }));
    this.prefs.edit({ [key]: JSON.stringify(arr) });
  }

  // --- planned repair works from PowerOn (per address) -----------------------------------------

  repairs(addressKey: string): Outage[] {
    return this.readArray(`repair_${addressKey}`, (o) =>
      makeOutage({
        id: reqStr(o.id),
        kind: 'REPAIR',
        start: parseLocalDateTime(reqStr(o.start)),
        end: parseLocalDateTime(reqStr(o.end)),
        label: optStr(o.label),
      })
    );
  }

  saveRepairs(addressKey: string, outages: readonly Outage[]): void {
    const key = `repair_${addressKey}`;
    if (outages.length === 0) {
      this.prefs.edit({ [key]: undefined });
      return;
    }
    const arr = outages.map((o) => ({
      id: o.id,
      start: formatLocalDateTime(o.start),
      end: formatLocalDateTime(o.end),
      label: o.label ?? undefined,
    }));
    this.prefs.edit({ [key]: JSON.stringify(arr) });
  }

  // --- resolved PowerOn ids (per address) ------------------------------------------------------

  ids(addressKey: string): { ids: PowerOnIds; resolvedAtMs: number } | null {
    const raw = this.prefs.getString(`ids_${addressKey}`);
    if (raw === null) return null;
    try {
      const o = JSON.parse(raw) as { cityIds?: unknown; streetIds?: unknown; resolvedAtMs?: unknown };
      const nums = (v: unknown): number[] => (Array.isArray(v) ? v.filter((n): n is number => typeof n === 'number' && Number.isFinite(n)) : []);
      return {
        ids: { cityIds: nums(o.cityIds), streetIds: nums(o.streetIds) },
        resolvedAtMs: typeof o.resolvedAtMs === 'number' ? o.resolvedAtMs : 0,
      };
    } catch {
      return null;
    }
  }

  saveIds(addressKey: string, ids: PowerOnIds, nowMs: number): void {
    this.prefs.edit({
      [`ids_${addressKey}`]: JSON.stringify({ cityIds: [...ids.cityIds], streetIds: [...ids.streetIds], resolvedAtMs: nowMs }),
    });
  }

  // --- site and source status ------------------------------------------------------------------

  site(): SiteSnapshot | null {
    const name = this.prefs.getString('site_state');
    if (name === null) return null;
    const state = SITE_STATES.find((s) => s === name);
    if (!state) return null;
    const success = this.prefs.getLong('site_last_success_ms', 0);
    const rawNotice = this.prefs.getString('site_notice');
    const notice = rawNotice && rawNotice.trim() && state === 'AVAILABLE_NO_TABLE' ? rawNotice : null;
    return { state, checkedAtMs: this.prefs.getLong('site_checked_ms', 0), lastSuccessMs: success > 0 ? success : null, notice };
  }

  saveSite(state: SiteState, nowMs: number, notice: string | null = null): void {
    // A notice only means something while the page has no table; any other answer from the site forgets it
    const keepNotice = state === 'SITE_UNREACHABLE' || state === 'NO_INTERNET';
    this.prefs.edit({
      site_state: state,
      site_checked_ms: nowMs,
      ...(state === 'AVAILABLE_WITH_TABLE' ? { site_last_success_ms: nowMs } : {}),
      ...(state === 'AVAILABLE_NO_TABLE' && notice && notice.trim()
        ? { site_notice: notice }
        : keepNotice
          ? {}
          : { site_notice: undefined }),
    });
  }

  poweron(): PowerOnSnapshot | null {
    if (!this.prefs.contains('poweron_checked_ms')) return null;
    const lastOk = this.prefs.getLong('poweron_last_ok_ms', 0);
    return {
      ok: this.prefs.getBoolean('poweron_ok', false),
      checkedAtMs: this.prefs.getLong('poweron_checked_ms', 0),
      lastOkMs: lastOk > 0 ? lastOk : null,
    };
  }

  savePowerOn(ok: boolean, nowMs: number): void {
    this.prefs.edit({
      poweron_ok: ok,
      poweron_checked_ms: nowMs,
      ...(ok ? { poweron_last_ok_ms: nowMs } : {}),
    });
  }

  /** Forgets everything (used by "reset to defaults"). */
  clearAll(): void {
    this.prefs.clear();
  }
}

let defaultStore: OutageStateStore | null = null;
/** Process-wide store on the default storage (window.localStorage in the browser). */
export function getOutageStateStore(): OutageStateStore {
  return (defaultStore ??= new OutageStateStore());
}
