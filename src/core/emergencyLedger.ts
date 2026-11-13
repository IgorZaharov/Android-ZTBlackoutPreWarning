/**
 * Per-address memory of emergencies, mirrored 1:1 from android/.../core/EmergencyLedger.kt.
 * See spec/NOTIFICATIONS.md.
 */
import { formatLocalDateTime, plusHours, wallMinutesBetween, type LocalDateTime } from './localTime';
import { OutageConfig, type EmergencyRecord, type Outage } from './outageModels';
import { resolveEmergency } from './outageEngine';

/** Result of asking PowerOn about one address. An empty confirmed list means "no emergency", not "failed". */
export type EmergencyFetch =
  | { readonly type: 'Confirmed'; readonly records: readonly EmergencyRecord[] }
  | { readonly type: 'Unavailable'; readonly reason: string };

export const EmergencyFetch = {
  Confirmed: (records: readonly EmergencyRecord[]): EmergencyFetch => ({ type: 'Confirmed', records }),
  Unavailable: (reason: string): EmergencyFetch => ({ type: 'Unavailable', reason }),
} as const;

/** One emergency outage seen for an address, with what has already been announced about it. */
export interface LedgerEntry {
  readonly id: string;
  readonly start: LocalDateTime;
  readonly estimatedEnd: LocalDateTime | null;
  readonly label: string | null;
  readonly firstSeen: LocalDateTime;
  readonly lastSeen: LocalDateTime;
  readonly closedAt: LocalDateTime | null;
  readonly startEmitted: boolean;
  readonly endEmitted: boolean;
  readonly lastEmittedEta: LocalDateTime | null;
}

export type EmergencyEventKind = 'START' | 'ETA_CHANGED' | 'END';

export interface EmergencyEvent {
  readonly kind: EmergencyEventKind;
  readonly entryId: string;
  readonly start: LocalDateTime;
  readonly eta: LocalDateTime | null;
  /** START only: the outage begins in the future. */
  readonly upcoming: boolean;
  /** END only: it disappeared before its estimated restore (restored early or cancelled). */
  readonly earlyEnd: boolean;
}

const fmtOrNull = (t: LocalDateTime | null) => (t === null ? 'null' : formatLocalDateTime(t));

/** Platform-neutral dedupe key, see spec/NOTIFICATIONS.md. */
export function eventKey(ev: EmergencyEvent, addressKey: string): string {
  switch (ev.kind) {
    case 'START':
      return `emerg_start_${addressKey}_${formatLocalDateTime(ev.start)}`;
    case 'ETA_CHANGED':
      return `emerg_change_${addressKey}_${formatLocalDateTime(ev.start)}_${fmtOrNull(ev.eta)}`;
    case 'END':
      return `emerg_end_${addressKey}_${formatLocalDateTime(ev.start)}`;
  }
}

export interface LedgerResult {
  readonly entries: readonly LedgerEntry[];
  readonly events: readonly EmergencyEvent[];
}

function event(
  kind: EmergencyEventKind,
  entryId: string,
  start: LocalDateTime,
  eta: LocalDateTime | null,
  opts: { upcoming?: boolean; earlyEnd?: boolean } = {}
): EmergencyEvent {
  return { kind, entryId, start, eta, upcoming: opts.upcoming ?? false, earlyEnd: opts.earlyEnd ?? false };
}

function newEntry(rec: EmergencyRecord, now: LocalDateTime, announced: boolean): LedgerEntry {
  return {
    id: rec.id,
    start: rec.start,
    estimatedEnd: rec.estimatedEnd,
    label: rec.label,
    firstSeen: now,
    lastSeen: now,
    closedAt: null,
    startEmitted: true,
    endEmitted: announced,
    lastEmittedEta: rec.estimatedEnd,
  };
}

export function prune(entries: readonly LedgerEntry[], now: LocalDateTime): LedgerEntry[] {
  const cutoff = plusHours(now, -OutageConfig.LEDGER_RETENTION_HOURS);
  return entries.filter((e) => (e.closedAt ?? e.lastSeen) > cutoff);
}

/**
 * Remembers emergencies per address so that:
 *  - a failed fetch never looks like "power restored" (Unavailable changes nothing),
 *  - an outage that was already over when first seen never alerts,
 *  - finished emergencies of today stay listable (PowerOn keeps no history),
 *  - each transition (start / eta changed / end) is announced exactly once.
 */
export function reconcile(
  entries: readonly LedgerEntry[],
  fetch: EmergencyFetch,
  now: LocalDateTime,
  graceMinutes: number = OutageConfig.OVERDUE_GRACE_MINUTES
): LedgerResult {
  const pruned = prune(entries, now);
  if (fetch.type === 'Unavailable') return { entries: pruned, events: [] };

  const byId = new Map<string, LedgerEntry>();
  for (const e of pruned) byId.set(e.id, e);
  const events: EmergencyEvent[] = [];
  const out = new Map<string, LedgerEntry>();
  const seen = new Set<string>();

  for (const rec of fetch.records) {
    if (seen.has(rec.id)) continue;
    seen.add(rec.id);
    const resolved = resolveEmergency({ ...rec, closedAt: null }, now, graceMinutes);
    const old = byId.get(rec.id);
    if (old === undefined) {
      if (resolved.stale) {
        out.set(rec.id, newEntry(rec, now, true));
      } else {
        out.set(rec.id, newEntry(rec, now, false));
        events.push(event('START', rec.id, rec.start, rec.estimatedEnd, { upcoming: now < rec.start }));
      }
    } else if (old.closedAt !== null) {
      if (resolved.stale) {
        out.set(rec.id, { ...old, lastSeen: now });
      } else {
        out.set(rec.id, { ...newEntry(rec, now, false), firstSeen: old.firstSeen });
        events.push(event('START', rec.id, rec.start, rec.estimatedEnd, { upcoming: now < rec.start }));
      }
    } else {
      let e: LedgerEntry = { ...old, lastSeen: now, estimatedEnd: rec.estimatedEnd, label: rec.label ?? old.label };
      if (!resolved.stale && old.startEmitted && !old.endEmitted) {
        const newEta = rec.estimatedEnd;
        const last = old.lastEmittedEta;
        if (newEta !== null && last === null) {
          e = { ...e, lastEmittedEta: newEta };
        } else if (
          newEta !== null &&
          last !== null &&
          Math.abs(wallMinutesBetween(last, newEta)) >= OutageConfig.ETA_CHANGE_MIN_DELTA_MINUTES
        ) {
          events.push(event('ETA_CHANGED', rec.id, rec.start, newEta));
          e = { ...e, lastEmittedEta: newEta };
        }
      }
      out.set(rec.id, e);
    }
  }

  for (const old of pruned) {
    if (seen.has(old.id)) continue;
    if (old.closedAt !== null) {
      out.set(old.id, old);
      continue;
    }
    const est = old.estimatedEnd;
    const wasStale = est !== null && wallMinutesBetween(est, now) > graceMinutes;
    const silent = old.endEmitted || wasStale || !old.startEmitted;
    out.set(old.id, { ...old, closedAt: now, endEmitted: true });
    if (!silent) {
      events.push(event('END', old.id, old.start, est, { earlyEnd: est !== null && now < est }));
    }
  }
  return { entries: Array.from(out.values()), events };
}

/** Ledger entries as outages for the engine (active, overdue, stale and closed ones alike). */
export function outages(entries: readonly LedgerEntry[], now: LocalDateTime): Outage[] {
  return entries.map((e) =>
    resolveEmergency({ id: e.id, start: e.start, estimatedEnd: e.estimatedEnd, closedAt: e.closedAt, label: e.label }, now)
  );
}

export const EmergencyLedger = { reconcile, prune, outages } as const;
