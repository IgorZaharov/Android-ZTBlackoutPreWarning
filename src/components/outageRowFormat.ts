/**
 * Pure text rules of the outage list under the drum (spec/UI_DRUM.md section 5), ported from
 * android/.../ui/components/OutageRowFormat.kt: one row per outage with its full span, the date on the
 * far side of midnight, kind and state tags.
 */
import { formatLocalDate, hourOf, isMidnight, minuteOf, plusDays, toLocalDate, type LocalDateTime } from '../core/localTime';
import { formatSpanTime } from '../core/outageEngine';
import type { DayRow, OutageKind } from '../core/outageModels';
import type { BlackoutSlot } from '../types';
import { drumPowerOffAt, durationText, rowFromEarlier, translations } from '../services/i18n';

type Lang = 'uk' | 'en';

export interface RowText {
  kind: OutageKind;
  /** "10:00 – 12:00", "23:00 – 01:00 (14.11)", "00:00 – 01:00", "10:00 – --:--" for an overdue emergency. */
  timeText: string;
  /** Full length of the outage ("2 год"); null when the end is unknown (overdue emergency). */
  durationText: string | null;
  /** "Аварійне" / "Планові роботи"; null for a plain planned outage (the dot is its marker). */
  kindTag: string | null;
  /** "з 13.11 23:00" on the day an outage continues into. */
  originTag: string | null;
  /** "завершено" / "очікується відновлення". */
  statusTag: string | null;
  /** "можливе продовження" when the real end is later than the known schedule. */
  continueTag: string | null;
  isFinished: boolean;
  isEmergency: boolean;
  isRepair: boolean;
  /** One sentence for screen readers: kind, time, duration and tags. */
  contentDescription: string;
}

const p2 = (n: number): string => String(n).padStart(2, '0');
export const hhmm = (t: LocalDateTime): string => `${p2(hourOf(t))}:${p2(minuteOf(t))}`;
const dayMonthOfDate = (t: LocalDateTime): string => {
  const d = formatLocalDate(toLocalDate(t));
  return `${d.slice(8, 10)}.${d.slice(5, 7)}`;
};
export const dayMonth = dayMonthOfDate;

/** End of an outage that leaves the day, with the date it really ends on; exactly 00:00 reads "24:00" of the day before. */
function endWithDate(end: LocalDateTime): string {
  if (isMidnight(end)) {
    const prev = formatLocalDate(plusDays(toLocalDate(end), -1));
    return `24:00 (${prev.slice(8, 10)}.${prev.slice(5, 7)})`;
  }
  return `${hhmm(end)} (${dayMonthOfDate(end)})`;
}

export function kindLabel(lang: Lang, kind: OutageKind): string {
  const t = translations[lang];
  switch (kind) {
    case 'EMERGENCY':
      return t.kindEmergency;
    case 'REPAIR':
      return t.kindRepair;
    default:
      return t.kindPlanned;
  }
}

export function formatRow(lang: Lang, row: DayRow): RowText {
  const t = translations[lang];
  const o = row.outage;
  const overdue = row.status === 'OVERDUE';
  const finished = row.status === 'FINISHED';

  const startText = row.continuesFromPrevDay ? '00:00' : hhmm(row.from);
  const endText = overdue ? '--:--' : row.continuesToNextDay ? endWithDate(o.end) : formatSpanTime(row.to);
  const timeText = `${startText} – ${endText}`;
  const dur = overdue ? null : durationText(lang, row.durationMinutes);
  const kindTag = o.kind === 'EMERGENCY' ? t.kindEmergency : o.kind === 'REPAIR' ? t.kindRepair : null;
  const originTag = row.continuesFromPrevDay ? rowFromEarlier(lang, `${dayMonthOfDate(o.start)} ${hhmm(o.start)}`) : null;
  const statusTag = row.status === 'FINISHED' ? t.rowFinished : row.status === 'OVERDUE' ? t.rowOverdue : null;
  const continueTag = o.mayContinue && !finished ? t.rowMayContinue : null;

  const description = [kindLabel(lang, o.kind), timeText, dur, originTag, statusTag, continueTag]
    .filter((x): x is string => x !== null)
    .join(', ');

  return {
    kind: o.kind,
    timeText,
    durationText: dur,
    kindTag,
    originTag,
    statusTag,
    continueTag,
    isFinished: finished,
    isEmergency: o.kind === 'EMERGENCY',
    isRepair: o.kind === 'REPAIR',
    contentDescription: description,
  };
}

interface Run {
  from: number;
  to: number;
  emergency: boolean;
}

function cellsOf(slots: readonly BlackoutSlot[]): BlackoutSlot[] | null {
  if (slots.length === 48) return [...slots];
  if (slots.length === 24) return slots.flatMap((s) => [s, s]);
  return null;
}

function runsOf(cells: readonly BlackoutSlot[]): Run[] {
  const out: Run[] = [];
  let start = -1;
  let emergency = false;
  for (let i = 0; i < cells.length; i++) {
    const off = cells[i].status === 'POWER_OFF';
    if (off) {
      if (start < 0) {
        start = i;
        emergency = false;
      }
      if (cells[i].isEmergency) emergency = true;
    } else if (start >= 0) {
      out.push({ from: start, to: i, emergency });
      start = -1;
    }
  }
  if (start >= 0) out.push({ from: start, to: cells.length, emergency });
  return out;
}

function cellTime(index: number): string {
  const minutes = index * 30;
  return minutes >= 1440 ? '24:00' : `${p2(Math.floor(minutes / 60))}:${p2(minutes % 60)}`;
}

/**
 * One screen-reader sentence for the whole drum, replacing the 48 silent cells:
 * "Шкала доби: без світла: 00:00 – 02:00, 10:00 – 12:00 (аварійне)".
 */
export function drumSummary(lang: Lang, slots: readonly BlackoutSlot[], unclearBase: boolean): string {
  const t = translations[lang];
  const head = t.drumTitle;
  const cells = cellsOf(slots);
  if (cells === null) return `${head}: ${t.outagesUnclear}`;
  const found = runsOf(cells);
  const spans = found
    .map((r) => {
      const text = `${cellTime(r.from)} – ${cellTime(r.to)}`;
      return r.emergency ? `${text} (${t.drumEmergencyMark})` : text;
    })
    .join(', ');
  const parts: string[] = [];
  if (unclearBase) parts.push(t.outagesUnclear);
  if (found.length > 0) parts.push(drumPowerOffAt(lang, spans));
  else if (!unclearBase) parts.push(t.drumNoOutages);
  return `${head}: ${parts.join('; ')}`;
}
