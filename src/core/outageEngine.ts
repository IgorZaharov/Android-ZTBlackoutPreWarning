/**
 * The single source of truth for "what is off when", mirrored 1:1 from
 * android/.../core/OutageEngine.kt. Pure functions over a two-day window (yesterday tail, today,
 * tomorrow) of absolute Kyiv wall-clock instants, so an outage that crosses midnight is one block
 * with its real length everywhere: list, drum, countdown, alerts.
 *
 * Rules are specified in spec/OUTAGE_ENGINE.md and verified by the JSON files in spec/vectors/.
 */
import {
  KYIV_ZONE,
  atStartOfDay,
  formatLocalDateTime,
  hourOf,
  isMidnight,
  minuteOf,
  plusDays,
  plusMinutes,
  plusSeconds,
  wallMinutesBetween,
  zonedMinutesBetween,
  zonedSecondsBetween,
  type LocalDate,
  type LocalDateTime,
} from './localTime';
import {
  OutageConfig,
  isPlannedLike,
  makeOutage,
  makeSlotState,
  outageKindOrdinal,
  statusAt,
  type AlertSpec,
  type DayRow,
  type DayView,
  type EmergencyRecord,
  type Outage,
  type OutageKind,
  type Span,
  type StatusInfo,
  type Transition,
} from './outageModels';

type Slots = readonly boolean[] | null | undefined;

// ---------------------------------------------------------------------------------------------
// Building outages
// ---------------------------------------------------------------------------------------------

/** Accepts 48 half-hour cells or 24 hourly cells and returns 48, or null for anything else. */
export function normalizeSlots(raw: Slots): readonly boolean[] | null {
  if (raw == null) return null;
  if (raw.length === 48) return raw;
  if (raw.length === 24) return raw.flatMap((v) => [v, v]);
  return null;
}

/**
 * Turns the ztoe day tables (true = power off) into planned outages. Contiguous off-cells are one
 * outage even across midnight when both days are known. A block that touches the end of the
 * last known day, whose next day is unknown, is flagged mayContinue.
 */
export function buildPlanned(today: LocalDate, todayOff: Slots, tomorrowOff: Slots, yesterdayOff: Slots = null): Outage[] {
  const candidates: [LocalDate, readonly boolean[] | null][] = [
    [plusDays(today, -1), normalizeSlots(yesterdayOff)],
    [today, normalizeSlots(todayOff)],
    [plusDays(today, 1), normalizeSlots(tomorrowOff)],
  ];
  const days: [LocalDate, readonly boolean[]][] = [];
  for (const [d, s] of candidates) if (s !== null) days.push([d, s]);
  if (days.length === 0) return [];

  const knownDates = new Set<number>(days.map(([d]) => d));
  const out: Outage[] = [];
  let runStart: LocalDateTime | null = null;

  const close = (end: LocalDateTime, mayContinue: boolean) => {
    const s = runStart;
    if (s === null) return;
    out.push(makeOutage({ id: `planned_${formatLocalDateTime(s)}`, kind: 'PLANNED', start: s, end, mayContinue }));
    runStart = null;
  };

  for (const [day, slots] of days) {
    const dayStart = atStartOfDay(day);
    for (let i = 0; i < OutageConfig.SLOTS_PER_DAY; i++) {
      const slotStart = plusMinutes(dayStart, i * OutageConfig.SLOT_MINUTES);
      if (slots[i]) {
        if (runStart === null) runStart = slotStart;
      } else {
        close(slotStart, false);
      }
    }
    if (runStart !== null && !knownDates.has(plusDays(day, 1))) {
      close(atStartOfDay(plusDays(day, 1)), true);
    }
  }
  return out;
}

/**
 * Resolves one emergency record against [now]. A listed outage past its estimated restore is
 * OVERDUE (still active) for [graceMinutes], then STALE (finished, never alerts).
 */
export function resolveEmergency(
  rec: EmergencyRecord,
  now: LocalDateTime,
  graceMinutes: number = OutageConfig.OVERDUE_GRACE_MINUTES
): Outage {
  const est = rec.estimatedEnd;
  const closed = rec.closedAt;
  let end: LocalDateTime;
  let overdue = false;
  let stale = false;
  let isEstimate = false;
  if (closed !== null) {
    end = closed > rec.start ? closed : rec.start;
  } else if (est === null) {
    end = now > rec.start ? now : rec.start;
    overdue = !(now < rec.start);
    isEstimate = true;
  } else if (now < est) {
    end = est;
    isEstimate = true;
  } else {
    const overdueMinutes = wallMinutesBetween(est, now);
    isEstimate = true;
    if (overdueMinutes <= graceMinutes) {
      end = now > est ? now : est;
      overdue = true;
    } else {
      end = est;
      stale = true;
    }
  }
  if (end < rec.start) end = rec.start;
  return makeOutage({
    id: rec.id,
    kind: 'EMERGENCY',
    start: rec.start,
    end,
    endIsEstimate: isEstimate,
    overdue,
    stale,
    label: rec.label,
  });
}

/** Keeps only outages that touch [yesterday 00:00, tomorrow+1 00:00). Rows dated further ahead are ignored. */
export function inWindow(outages: readonly Outage[], today: LocalDate): Outage[] {
  const from = atStartOfDay(plusDays(today, -1));
  const to = atStartOfDay(plusDays(today, 2));
  return outages.filter((o) => o.start < to && o.end > from);
}

// ---------------------------------------------------------------------------------------------
// Spans, day views, status
// ---------------------------------------------------------------------------------------------

/** Union of the outages of [kinds] (all kinds when null); touching or overlapping outages merge. */
export function spans(outages: readonly Outage[], kinds: ReadonlySet<OutageKind> | null = null): Span[] {
  const items = outages
    .filter((o) => (kinds === null || kinds.has(o.kind)) && o.end > o.start)
    .sort((a, b) => a.start - b.start);
  const result: Span[] = [];
  let curStart: LocalDateTime | null = null;
  let curEnd: LocalDateTime | null = null;
  let curMay = false;
  let curKinds = new Set<OutageKind>();
  for (const o of items) {
    if (curStart === null || curEnd === null) {
      curStart = o.start;
      curEnd = o.end;
      curMay = o.mayContinue;
      curKinds = new Set([o.kind]);
    } else if (!(o.start > curEnd)) {
      if (o.end > curEnd) {
        curEnd = o.end;
        curMay = o.mayContinue;
      } else if (o.end === curEnd) {
        curMay = curMay || o.mayContinue;
      }
      curKinds.add(o.kind);
    } else {
      result.push({ start: curStart, end: curEnd, mayContinue: curMay, kinds: curKinds });
      curStart = o.start;
      curEnd = o.end;
      curMay = o.mayContinue;
      curKinds = new Set([o.kind]);
    }
  }
  if (curStart !== null && curEnd !== null) result.push({ start: curStart, end: curEnd, mayContinue: curMay, kinds: curKinds });
  return result;
}

export function minutesBetween(a: LocalDateTime, b: LocalDateTime, zone: string = KYIV_ZONE): number {
  return zonedMinutesBetween(a, b, zone);
}

export function secondsBetween(a: LocalDateTime, b: LocalDateTime, zone: string = KYIV_ZONE): number {
  return zonedSecondsBetween(a, b, zone);
}

const maxOf = (a: LocalDateTime, b: LocalDateTime) => (a > b ? a : b);
const minOf = (a: LocalDateTime, b: LocalDateTime) => (a < b ? a : b);

/** The drum cells and list rows for one calendar day. Finished outages stay (history); they just never alert. */
export function dayView(outages: readonly Outage[], date: LocalDate, now: LocalDateTime, zone: string = KYIV_ZONE): DayView {
  const dayStart = atStartOfDay(date);
  const dayEnd = atStartOfDay(plusDays(date, 1));
  const relevant = outages.filter((o) => o.end > o.start && o.start < dayEnd && o.end > dayStart);

  const slots = Array.from({ length: OutageConfig.SLOTS_PER_DAY }, (_, i) => {
    const s = plusMinutes(dayStart, i * OutageConfig.SLOT_MINUTES);
    const e = plusMinutes(s, OutageConfig.SLOT_MINUTES);
    return makeSlotState(
      relevant.some((o) => isPlannedLike(o) && o.start < e && o.end > s),
      relevant.some((o) => o.kind === 'EMERGENCY' && o.start < e && o.end > s)
    );
  });

  const rows: DayRow[] = relevant
    .map((o) => {
      const from = maxOf(o.start, dayStart);
      const to = minOf(o.end, dayEnd);
      return {
        outage: o,
        from,
        to,
        status: statusAt(o, now),
        continuesFromPrevDay: o.start < dayStart,
        continuesToNextDay: o.end > dayEnd,
        durationMinutes: minutesBetween(o.start, o.end, zone),
        inDayMinutes: minutesBetween(from, to, zone),
      };
    })
    .sort((a, b) => a.from - b.from || outageKindOrdinal(a.outage.kind) - outageKindOrdinal(b.outage.kind));

  const clipped = relevant.map((o) => ({ ...o, start: maxOf(o.start, dayStart), end: minOf(o.end, dayEnd) }));
  const total = spans(clipped).reduce((sum, sp) => sum + minutesBetween(sp.start, sp.end, zone), 0);
  return { date, slots, rows, totalOffMinutes: total };
}

const p2 = (n: number): string => String(n).padStart(2, '0');

/** "HH:mm" (ASCII digits whatever the device locale); an end of exactly 00:00 reads "24:00". */
export function formatSpanTime(t: LocalDateTime): string {
  return isMidnight(t) ? '24:00' : `${p2(hourOf(t))}:${p2(minuteOf(t))}`;
}

export function formatSpan(span: Span): string {
  return `${p2(hourOf(span.start))}:${p2(minuteOf(span.start))} – ${formatSpanTime(span.end)}`;
}

export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(totalSeconds, 0);
  return `${p2(Math.trunc(s / 3600))}:${p2(Math.trunc((s % 3600) / 60))}:${p2(s % 60)}`;
}

/** Power state, countdown and next/current period from [now]. Stale emergencies never count as off. */
export function status(outages: readonly Outage[], now: LocalDateTime, zone: string = KYIV_ZONE): StatusInfo {
  // An overdue emergency has no known end: treat it as lasting just past now so it is "current".
  const openEnd = plusSeconds(now, 1);
  const effective = outages.filter((o) => !o.stale).map((o) => (o.overdue ? { ...o, end: openEnd } : o));
  const all = spans(effective);
  const current = all.find((sp) => !(now < sp.start) && now < sp.end) ?? null;

  if (current !== null) {
    if (current.end === openEnd && effective.some((o) => o.overdue)) {
      return {
        isOffNow: true,
        countdownSeconds: null,
        countdownText: '--:--:--',
        nextSlotTime: `${p2(hourOf(current.start))}:${p2(minuteOf(current.start))} – --:--`,
        currentSpan: { ...current, end: now },
        nextSpan: null,
      };
    }
    const secs = secondsBetween(now, current.end, zone);
    return {
      isOffNow: true,
      countdownSeconds: secs,
      countdownText: formatCountdown(secs),
      nextSlotTime: formatSpan(current),
      currentSpan: current,
      nextSpan: null,
    };
  }
  const next = all.find((sp) => sp.start > now) ?? null;
  if (next !== null) {
    const secs = secondsBetween(now, next.start, zone);
    return {
      isOffNow: false,
      countdownSeconds: secs,
      countdownText: formatCountdown(secs),
      nextSlotTime: formatSpan(next),
      currentSpan: null,
      nextSpan: next,
    };
  }
  return {
    isOffNow: false,
    countdownSeconds: null,
    countdownText: '--:--:--',
    nextSlotTime: 'Відключень немає',
    currentSpan: null,
    nextSpan: null,
  };
}

// ---------------------------------------------------------------------------------------------
// Alerts and widget transitions
// ---------------------------------------------------------------------------------------------

const PLANNED_KINDS: ReadonlySet<OutageKind> = new Set<OutageKind>(['PLANNED', 'REPAIR']);

/**
 * One pre-warning per merged planned span (planned and repair works only), keyed by the span's
 * absolute start. Spans already started, or whose alert time has passed, never alert; a 00:00
 * continuation never gets its own alert because it is part of the earlier span.
 */
export function planAlerts(
  outages: readonly Outage[],
  now: LocalDateTime,
  advanceMinutes: number,
  zone: string = KYIV_ZONE
): AlertSpec[] {
  const plannedSpans = spans(
    outages.filter((o) => !o.stale),
    PLANNED_KINDS
  );
  const emergencies = outages.filter((o) => o.kind === 'EMERGENCY' && !o.stale);
  const out: AlertSpec[] = [];
  for (const sp of plannedSpans) {
    if (!(sp.start > now)) continue;
    // One continuous outage, one warning (spec/OUTAGE_ENGINE.md 6.2 step 2a): an emergency that started before the
    // block and is still on at its start means power is already off
    if (emergencies.some((e) => e.start < sp.start && (e.overdue || e.end >= sp.start))) continue;
    const fireAt = plusMinutes(sp.start, -advanceMinutes);
    if (!(fireAt > now)) continue;
    out.push({
      key: `planned_${formatLocalDateTime(sp.start)}`,
      fireAt,
      spanStart: sp.start,
      spanEnd: sp.end,
      mayContinue: sp.mayContinue,
      durationMinutes: minutesBetween(sp.start, sp.end, zone),
    });
  }
  return out;
}

/** The planned and repair spans of an address (not stale): what its pre-warnings are about. */
export function plannedSpans(outages: readonly Outage[]): Span[] {
  return spans(outages.filter((o) => !o.stale), PLANNED_KINDS);
}

/** How one emergency event is announced within a continuous outage (spec/NOTIFICATIONS.md 2.4a). */
export type EmergencyDelivery = 'SEND' | 'PROLONG' | 'DROP';

/**
 * Whether an emergency event is announced when emergency and scheduled outages of one address form one continuous
 * outage (spec/NOTIFICATIONS.md 2.4a): only its beginning is announced, a longer emergency inside a warned block
 * becomes a prolongation, and the end is not "restored" while the schedule keeps the power off.
 */
export function emergencyDelivery(
  kind: 'START' | 'ETA_CHANGED' | 'END',
  start: LocalDateTime,
  eta: LocalDateTime | null,
  now: LocalDateTime,
  planned: readonly Span[],
  plannedAlertsOn: boolean
): EmergencyDelivery {
  if (kind === 'ETA_CHANGED') return 'SEND';
  if (kind === 'END') return planned.some((p) => p.start <= now && now < p.end) ? 'DROP' : 'SEND';
  const holder = plannedAlertsOn ? planned.find((p) => p.start <= start && start <= p.end) : undefined;
  if (holder === undefined) return 'SEND';
  return eta !== null && eta > holder.end ? 'PROLONG' : 'DROP';
}

/** Instants where the power state flips (all kinds, stale excluded), inclusive of [from] and [to]. */
export function transitions(outages: readonly Outage[], from: LocalDateTime, to: LocalDateTime): Transition[] {
  return spans(outages.filter((o) => !o.stale && !o.overdue))
    .flatMap((sp): Transition[] => [
      { at: sp.start, isOff: true },
      { at: sp.end, isOff: false },
    ])
    .filter((t) => !(t.at < from) && !(t.at > to))
    .sort((a, b) => a.at - b.at);
}

export const OutageEngine = {
  normalizeSlots,
  buildPlanned,
  resolveEmergency,
  inWindow,
  spans,
  minutesBetween,
  secondsBetween,
  dayView,
  formatSpanTime,
  formatSpan,
  formatCountdown,
  status,
  planAlerts,
  transitions,
} as const;
