/**
 * Minimal java.time stand-in for the outage core.
 *
 * A [LocalDateTime] is a Kyiv wall-clock date-time stored as "wall-clock milliseconds since
 * 1970-01-01T00:00 treated as UTC". Arithmetic on it (plusMinutes, plusDays, compare) is plain
 * number arithmetic on the wall clock, exactly like java.time.LocalDateTime, and never goes
 * through a JS Date. Only elapsed time between two wall-clock values is zone aware: both ends are
 * mapped to real instants in the zone (java.time `atZone` semantics) and the instants subtracted.
 *
 * A [LocalDate] is an epoch-day number (days since 1970-01-01).
 */

export type LocalDateTime = number & { readonly __brand: 'LocalDateTime' };
export type LocalDate = number & { readonly __brand: 'LocalDate' };

export const KYIV_ZONE = 'Europe/Kyiv';

const MS_SECOND = 1000;
const MS_MINUTE = 60_000;
const MS_HOUR = 3_600_000;
const MS_DAY = 86_400_000;

const ldt = (n: number) => n as LocalDateTime;
const ld = (n: number) => n as LocalDate;
const mod = (a: number, b: number) => ((a % b) + b) % b;
const pad = (n: number, w = 2) => String(n).padStart(w, '0');

// ---------------------------------------------------------------------------------------------
// Proleptic Gregorian calendar (H. Hinnant's civil algorithms)
// ---------------------------------------------------------------------------------------------

function daysFromCivil(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function civilFromDays(days: number): [number, number, number] {
  const z = days + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp + (mp < 10 ? 3 : -9);
  return [yoe + era * 400 + (month <= 2 ? 1 : 0), month, day];
}

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function daysInMonth(y: number, m: number): number {
  return [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

// ---------------------------------------------------------------------------------------------
// Construction, parsing, formatting
// ---------------------------------------------------------------------------------------------

/** `LocalDate.of`, or null when a field is out of range. */
export function localDateOf(year: number, month: number, day: number): LocalDate | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return ld(daysFromCivil(year, month, day));
}

/** `LocalDateTime.of`, or null when a field is out of range. */
export function localDateTimeOf(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0,
  millis = 0
): LocalDateTime | null {
  const date = localDateOf(year, month, day);
  if (date === null) return null;
  const fields = [hour, minute, second, millis];
  if (!fields.every(Number.isInteger)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59 || millis < 0 || millis > 999) return null;
  return ldt(date * MS_DAY + hour * MS_HOUR + minute * MS_MINUTE + second * MS_SECOND + millis);
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?$/;

/** `LocalDate.parse("YYYY-MM-DD")`; throws on malformed input like java.time does. */
export function parseLocalDate(s: string): LocalDate {
  const m = DATE_RE.exec(s);
  const d = m ? localDateOf(+m[1], +m[2], +m[3]) : null;
  if (d === null) throw new Error(`Invalid LocalDate: '${s}'`);
  return d;
}

/** `LocalDateTime.parse("YYYY-MM-DDTHH:mm[:ss[.fff]]")`; throws on malformed input. */
export function parseLocalDateTime(s: string): LocalDateTime {
  const m = DATE_TIME_RE.exec(s);
  const millis = m && m[7] ? Math.floor(Number(`0.${m[7]}`) * 1000) : 0;
  const t = m ? localDateTimeOf(+m[1], +m[2], +m[3], +m[4], +m[5], m[6] ? +m[6] : 0, millis) : null;
  if (t === null) throw new Error(`Invalid LocalDateTime: '${s}'`);
  return t;
}

export function formatLocalDate(d: LocalDate): string {
  const [y, m, day] = civilFromDays(d);
  return `${pad(y, 4)}-${pad(m)}-${pad(day)}`;
}

/** `LocalDateTime.toString()`: seconds (and millis) are printed only when non-zero. */
export function formatLocalDateTime(t: LocalDateTime): string {
  const ms = mod(t, MS_DAY);
  const h = Math.floor(ms / MS_HOUR);
  const mi = Math.floor((ms % MS_HOUR) / MS_MINUTE);
  const s = Math.floor((ms % MS_MINUTE) / MS_SECOND);
  const frac = ms % MS_SECOND;
  let out = `${formatLocalDate(toLocalDate(t))}T${pad(h)}:${pad(mi)}`;
  if (s !== 0 || frac !== 0) out += `:${pad(s)}`;
  if (frac !== 0) out += `.${pad(frac, 3)}`;
  return out;
}

// ---------------------------------------------------------------------------------------------
// Wall-clock arithmetic
// ---------------------------------------------------------------------------------------------

export const plusSeconds = (t: LocalDateTime, n: number) => ldt(t + n * MS_SECOND);
export const plusMinutes = (t: LocalDateTime, n: number) => ldt(t + n * MS_MINUTE);
export const plusHours = (t: LocalDateTime, n: number) => ldt(t + n * MS_HOUR);
export const plusDays = (d: LocalDate, n: number) => ld(d + n);
export const atStartOfDay = (d: LocalDate) => ldt(d * MS_DAY);
export const toLocalDate = (t: LocalDateTime) => ld(Math.floor(t / MS_DAY));
export const hourOf = (t: LocalDateTime) => Math.floor(mod(t, MS_DAY) / MS_HOUR);
export const minuteOf = (t: LocalDateTime) => Math.floor(mod(t, MS_HOUR) / MS_MINUTE);
/** `toLocalTime() == LocalTime.MIDNIGHT` */
export const isMidnight = (t: LocalDateTime) => mod(t, MS_DAY) === 0;

/** `ChronoUnit.MINUTES.between(a, b)` on two LocalDateTimes: wall-clock difference, truncated toward zero. */
export function wallMinutesBetween(a: LocalDateTime, b: LocalDateTime): number {
  return Math.trunc((b - a) / MS_MINUTE);
}

// ---------------------------------------------------------------------------------------------
// Zone mapping (only for elapsed time)
// ---------------------------------------------------------------------------------------------

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(zone: string): Intl.DateTimeFormat {
  let f = formatters.get(zone);
  if (!f) {
    const options: Intl.DateTimeFormatOptions = {
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    };
    try {
      f = new Intl.DateTimeFormat('en-US', { ...options, timeZone: zone });
    } catch (e) {
      // Older ICU data only knows the legacy id.
      if (zone !== KYIV_ZONE) throw e;
      f = new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'Europe/Kiev' });
    }
    formatters.set(zone, f);
  }
  return f;
}

/** Offset (ms) of [zone] at the UTC instant [instant]. */
function offsetAt(instant: number, zone: string): number {
  const parts = formatter(zone).formatToParts(new Date(instant));
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? NaN);
  const wall =
    daysFromCivil(get('year'), get('month'), get('day')) * MS_DAY +
    get('hour') * MS_HOUR +
    get('minute') * MS_MINUTE +
    get('second') * MS_SECOND;
  return wall - (instant - mod(instant, MS_SECOND));
}

/**
 * `LocalDateTime.atZone(zone).toInstant()` as UTC epoch milliseconds. An ambiguous (repeated)
 * wall time maps to the earlier instant; a skipped wall time is shifted forward by the gap.
 */
export function toInstant(t: LocalDateTime, zone: string = KYIV_ZONE): number {
  const before = offsetAt(t - MS_DAY, zone);
  const after = offsetAt(t + MS_DAY, zone);
  const candidates = before === after ? [before] : [Math.max(before, after), Math.min(before, after)];
  for (const off of candidates) {
    const instant = t - off;
    if (offsetAt(instant, zone) === off) return instant;
  }
  return t - before;
}

/**
 * `LocalDateTime.ofInstant(Instant.ofEpochMilli(instantMs), zone)`: the wall clock of [zone] at the
 * UTC instant [instantMs]. This is how "now" enters the core (Kyiv wall clock).
 */
export function fromInstant(instantMs: number, zone: string = KYIV_ZONE): LocalDateTime {
  return ldt(instantMs + offsetAt(instantMs, zone));
}

/** `ChronoUnit.MINUTES.between(a.atZone(zone), b.atZone(zone))` */
export function zonedMinutesBetween(a: LocalDateTime, b: LocalDateTime, zone: string = KYIV_ZONE): number {
  return Math.trunc((toInstant(b, zone) - toInstant(a, zone)) / MS_MINUTE);
}

/** `ChronoUnit.SECONDS.between(a.atZone(zone), b.atZone(zone))` */
export function zonedSecondsBetween(a: LocalDateTime, b: LocalDateTime, zone: string = KYIV_ZONE): number {
  return Math.trunc((toInstant(b, zone) - toInstant(a, zone)) / MS_SECOND);
}
