/**
 * Maps PowerOn rows to outages for one house, mirrored 1:1 from android/.../core/PowerOnMapper.kt.
 * See spec/POWERON_API.md.
 *
 * PowerOn timestamps look like `2026-11-12T22:04:40+00:00` but are Kyiv wall-clock time with a wrong
 * offset label. The offset is therefore ignored, never converted.
 */
import { atStartOfDay, formatLocalDateTime, localDateTimeOf, plusDays, type LocalDate, type LocalDateTime } from './localTime';
import { makeOutage, type EmergencyRecord, type Outage } from './outageModels';
import { HouseKey } from './addressKeys';

/** One row of `pw_accidents` / `pw_accident_planeds` from the PowerOn API, reduced to plain types. */
export interface PowerOnRow {
  readonly id: number;
  readonly cityId: number | null;
  readonly cityName: string;
  readonly streetId: number | null;
  readonly streetName: string;
  readonly dateEvent: string;
  readonly datePlanIn: string;
  readonly koment: string | null;
  /** 2 = mirror of the hourly schedule (GPV), anything else is a real emergency. Absent on planned works. */
  readonly switchSubReason: number | null;
  readonly typeOff: number | null;
  /** Comma separated list of affected buildings on the street. */
  readonly buildingNames: string;
}

// Java's \s (ASCII only) spelled out.
const ISO = /^[ \t\n\x0B\f\r]*(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?/;

/** Minute precision; the `+00:00` / `Z` suffix is deliberately dropped. */
function parseTime(raw: string | null | undefined): LocalDateTime | null {
  if (raw == null) return null;
  const m = ISO.exec(raw);
  if (!m) return null;
  return localDateTimeOf(+m[1], +m[2], +m[3], +m[4], +m[5]);
}

const labelOf = (koment: string | null): string | null => {
  const t = koment?.trim();
  return t ? t : null;
};

/** Real emergencies for [house] (switchSubReason != 2), merged per start time. */
function emergencyRecordsFor(rows: readonly PowerOnRow[], house: string): EmergencyRecord[] {
  const byId = new Map<string, EmergencyRecord>();
  for (const row of rows) {
    if (row.switchSubReason === 2) continue;
    if (!HouseKey.listContains(row.buildingNames, house)) continue;
    const start = parseTime(row.dateEvent);
    if (start === null) continue;
    const planIn = parseTime(row.datePlanIn);
    const est = planIn !== null && planIn > start ? planIn : null;
    const id = `pw_${formatLocalDateTime(start)}`;
    const label = labelOf(row.koment);
    const old = byId.get(id);
    if (old === undefined) {
      byId.set(id, { id, start, estimatedEnd: est, closedAt: null, label });
    } else {
      const ends = [old.estimatedEnd, est].filter((t): t is LocalDateTime => t !== null);
      byId.set(id, {
        ...old,
        estimatedEnd: ends.length === 0 ? null : (Math.max(...ends) as LocalDateTime),
        label: old.label ?? label,
      });
    }
  }
  return mergeOverlapping(Array.from(byId.values()).sort((a, b) => a.start - b.start));
}

/**
 * Records whose times overlap or touch are one outage (spec/POWERON_API.md 5.1 step 7): operators re-register an
 * ongoing outage as a new row when its estimate runs out. The merged record keeps the id and start of the earliest
 * and the latest estimate; a record without an estimate is open-ended.
 */
function mergeOverlapping(sorted: EmergencyRecord[]): EmergencyRecord[] {
  const out: EmergencyRecord[] = [];
  for (const rec of sorted) {
    const last = out.length > 0 ? out[out.length - 1] : null;
    if (last !== null && (last.estimatedEnd === null || rec.start <= last.estimatedEnd)) {
      const ends = [last.estimatedEnd, rec.estimatedEnd].filter((t): t is LocalDateTime => t !== null);
      out[out.length - 1] = {
        ...last,
        estimatedEnd: ends.length === 0 ? null : (Math.max(...ends) as LocalDateTime),
        label: last.label ?? rec.label,
      };
    } else {
      out.push(rec);
    }
  }
  return out;
}

/** Planned repair works for [house]; treated as planned outages. Rows beyond tomorrow are dropped. */
function repairOutagesFor(rows: readonly PowerOnRow[], house: string, today: LocalDate): Outage[] {
  const byId = new Map<string, Outage>();
  const limit = atStartOfDay(plusDays(today, 2));
  for (const row of rows) {
    if (!HouseKey.listContains(row.buildingNames, house)) continue;
    const start = parseTime(row.dateEvent);
    if (start === null) continue;
    const end = parseTime(row.datePlanIn);
    if (end === null) continue;
    if (!(end > start) || !(start < limit)) continue;
    const id = `repair_${formatLocalDateTime(start)}`;
    const label = labelOf(row.koment);
    const old = byId.get(id);
    if (old === undefined) {
      byId.set(id, makeOutage({ id, kind: 'REPAIR', start, end, label }));
    } else {
      byId.set(id, { ...old, end: end > old.end ? end : old.end, label: old.label ?? label });
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.start - b.start);
}

export const PowerOnMapper = { parseTime, emergencyRecordsFor, repairOutagesFor } as const;
