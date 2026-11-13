/**
 * Platform-neutral outage model, mirrored 1:1 from android/.../core/OutageModels.kt and verified
 * against spec/vectors/. All instants are Kyiv wall-clock LocalDateTimes; durations are elapsed
 * time in the Kyiv zone so a span over a DST night is counted correctly.
 */
import type { LocalDate, LocalDateTime } from './localTime';

export const OutageConfig = {
  SLOTS_PER_DAY: 48,
  SLOT_MINUTES: 30,
  /** An emergency still listed by PowerOn this long after its estimated restore is "overdue" (still active). */
  OVERDUE_GRACE_MINUTES: 60,
  /** Ledger entries older than this (since last sighting or close) are dropped. */
  LEDGER_RETENTION_HOURS: 48,
  /** A changed restore estimate notifies only when it moved by at least this much. */
  ETA_CHANGE_MIN_DELTA_MINUTES: 10,
} as const;

/** What produced an outage. REPAIR (PowerOn planned works) is treated like PLANNED for alerts. */
export type OutageKind = 'PLANNED' | 'REPAIR' | 'EMERGENCY';
/** Declaration order of the Kotlin enum; index = ordinal. */
export const OUTAGE_KINDS: readonly OutageKind[] = ['PLANNED', 'REPAIR', 'EMERGENCY'];
export const outageKindOrdinal = (k: OutageKind): number => OUTAGE_KINDS.indexOf(k);

export type IntervalStatus = 'FINISHED' | 'ACTIVE' | 'UPCOMING' | 'OVERDUE';

export interface Outage {
  readonly id: string;
  readonly kind: OutageKind;
  readonly start: LocalDateTime;
  /** Effective end. For a listed emergency past its estimate this is "now" while within the grace. */
  readonly end: LocalDateTime;
  /** The block touches the end of the known schedule window, so the real end may be later. */
  readonly mayContinue: boolean;
  readonly endIsEstimate: boolean;
  /** Emergency still listed after its estimated restore, within the grace: treated as active. */
  readonly overdue: boolean;
  /** Emergency still listed but beyond the grace: shown as finished, never alerts. */
  readonly stale: boolean;
  readonly label: string | null;
}

/** The Kotlin primary constructor with its default arguments. */
export function makeOutage(
  init: Pick<Outage, 'id' | 'kind' | 'start' | 'end'> & Partial<Omit<Outage, 'id' | 'kind' | 'start' | 'end'>>
): Outage {
  return {
    mayContinue: false,
    endIsEstimate: false,
    overdue: false,
    stale: false,
    label: null,
    ...init,
  };
}

export const isPlannedLike = (o: Outage): boolean => o.kind === 'PLANNED' || o.kind === 'REPAIR';

export function statusAt(o: Outage, now: LocalDateTime): IntervalStatus {
  if (o.stale) return 'FINISHED';
  if (now < o.start) return 'UPCOMING';
  if (o.overdue) return 'OVERDUE';
  if (now < o.end) return 'ACTIVE';
  return 'FINISHED';
}

/** One emergency outage as observed from PowerOn (or restored from the ledger). */
export interface EmergencyRecord {
  readonly id: string;
  readonly start: LocalDateTime;
  readonly estimatedEnd: LocalDateTime | null;
  /** Set by the ledger when a confirmed fetch no longer lists the outage. */
  readonly closedAt: LocalDateTime | null;
  readonly label: string | null;
}

/** A maximal union of outages that touch or overlap. */
export interface Span {
  readonly start: LocalDateTime;
  readonly end: LocalDateTime;
  readonly mayContinue: boolean;
  readonly kinds: ReadonlySet<OutageKind>;
}

/** State of one half-hour cell of a day on the drum chart. */
export interface SlotState {
  readonly planned: boolean;
  readonly emergency: boolean;
  readonly off: boolean;
}

export const makeSlotState = (planned: boolean, emergency: boolean): SlotState => ({
  planned,
  emergency,
  off: planned || emergency,
});

/** One outage as it appears in a day's list, clipped to that day. */
export interface DayRow {
  readonly outage: Outage;
  readonly from: LocalDateTime;
  readonly to: LocalDateTime;
  readonly status: IntervalStatus;
  readonly continuesFromPrevDay: boolean;
  readonly continuesToNextDay: boolean;
  /** Full length of the outage in minutes (not clipped to the day). */
  readonly durationMinutes: number;
  /** Minutes of the outage that fall inside this day. */
  readonly inDayMinutes: number;
}

export interface DayView {
  readonly date: LocalDate;
  readonly slots: readonly SlotState[];
  readonly rows: readonly DayRow[];
  /** Union of all kinds, clipped to the day, in elapsed minutes. */
  readonly totalOffMinutes: number;
}

export interface StatusInfo {
  readonly isOffNow: boolean;
  readonly countdownSeconds: number | null;
  /** HH:MM:SS, or "--:--:--" when nothing is ahead. */
  readonly countdownText: string;
  /** "HH:mm – HH:mm" of the current or next span, or "Відключень немає". */
  readonly nextSlotTime: string;
  readonly currentSpan: Span | null;
  readonly nextSpan: Span | null;
}

export interface AlertSpec {
  readonly key: string;
  readonly fireAt: LocalDateTime;
  readonly spanStart: LocalDateTime;
  readonly spanEnd: LocalDateTime;
  readonly mayContinue: boolean;
  readonly durationMinutes: number;
}

export interface Transition {
  readonly at: LocalDateTime;
  readonly isOff: boolean;
}
