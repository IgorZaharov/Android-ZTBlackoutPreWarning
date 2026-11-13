/**
 * Per-address PowerOn queries, ported 1:1 from android/.../data/poweron/PowerOnClient.kt.
 * Everything here follows spec/POWERON_API.md:
 *  - only the dotted filters work (`street.id[]`, `city.id`, `otg.id`); `street=`, `otg=` are ignored by the server,
 *  - `pagination=false` is required (default page size is 30 of thousands of rows),
 *  - timestamps are Kyiv wall-clock despite the `+00:00` label (handled in PowerOnMapper.parseTime),
 *  - a failed request is Unavailable, never "no outage".
 *
 * The only network seam is [HttpGet], so tests replace it exactly like PowerOnClientTest.kt does.
 */
import { atStartOfDay, formatLocalDate, plusDays, type LocalDate, type LocalDateTime } from '../core/localTime';
import { StreetKey, TextNorm } from '../core/addressKeys';
import { EmergencyFetch } from '../core/emergencyLedger';
import type { Outage } from '../core/outageModels';
import { PowerOnMapper, type PowerOnRow } from '../core/poweronMapper';

/** The only network seam of the PowerOn client. Rejects (or throws) on any failure. */
export type HttpGet = (url: string) => Promise<string>;

export const POWERON_BASE_URL = 'https://api-ztoe-poweron.inneti.net/api';
/** Same host through the Vite dev/preview proxy (the browser cannot call it directly because of CORS). */
export const POWERON_PROXY_BASE_URL = '/proxy-ztoe-poweron/api';
export const POWERON_IDS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const isBrowser = (): boolean => typeof window !== 'undefined' && typeof window.document !== 'undefined';

/** What identifies the address on PowerOn. Names come from ztoe; ids are cached after the first resolution. */
export interface PowerOnTarget {
  readonly remOtgId: number | null;
  readonly settlementName: string;
  /** Names of every ztoe street option merged into the selected street (duplicates keep all names). */
  readonly streetNames: readonly string[];
  readonly house: string;
  readonly cachedCityIds?: readonly number[];
  readonly cachedStreetIds?: readonly number[];
}

export interface PowerOnIds {
  readonly cityIds: readonly number[];
  readonly streetIds: readonly number[];
}

/**
 * Outcome of one PowerOn refresh for an address. [repairs] is null when the planned-works request
 * failed (keep what was known); [emergency] is Unavailable when the accidents request failed.
 */
export interface PowerOnResult {
  readonly emergency: EmergencyFetch;
  readonly repairs: readonly Outage[] | null;
  readonly ids: PowerOnIds | null;
}

// Java's \s (ASCII only) spelled out so web and Android agree.
const JS = '[ \\t\\n\\x0B\\f\\r]';
const CITY_PREFIX = new RegExp(`^(?:м\\.|місто|с\\.|село|смт\\.?|селище)${JS}*`, 'iu');
const PARENS = /\([^)]*\)/g;
const SPACES = new RegExp(`${JS}+`, 'g');
const EMERGENCY_REASONS = 'switchSubReason[]=0&switchSubReason[]=1&switchSubReason[]=3';

/** `java.net.URLEncoder.encode(s, "UTF-8")`: space becomes `+`, only `.-*_` and alphanumerics stay. */
function enc(s: string): string {
  return encodeURIComponent(s)
    .replace(/[!'()~]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, '+');
}

export function cityKey(raw: string): string {
  let s = TextNorm.decodeEntities(raw).toLowerCase();
  s = s.replace(PARENS, ' ');
  s = s.trim().replace(CITY_PREFIX, '');
  s = Array.from(s)
    .filter((ch) => TextNorm.APOSTROPHES.indexOf(ch) < 0)
    .join('');
  return s.replace(SPACES, ' ').trim();
}

type JsonObject = Record<string, unknown>;
const isObject = (v: unknown): v is JsonObject => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Plain array (Accept: application/json) or a hydra collection, both accepted. Throws on malformed JSON. */
export function toArray(json: string): unknown[] {
  const trimmed = json.trim();
  if (trimmed.startsWith('[')) {
    const parsed: unknown = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [];
  }
  if (trimmed.startsWith('{')) {
    const parsed: unknown = JSON.parse(trimmed);
    const member = isObject(parsed) ? parsed['hydra:member'] : undefined;
    return Array.isArray(member) ? member : [];
  }
  return [];
}

/** `JSONObject.optInt`: numbers and numeric strings, otherwise 0. */
function optInt(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === 'string' && /^\s*-?\d+(?:\.\d+)?\s*$/.test(v)) return Math.trunc(Number(v));
  return 0;
}

/** `JSONObject.optString(key, "")`: absent and null both give the empty string. */
const optString = (v: unknown): string => (v === undefined || v === null ? '' : String(v));

export function parseRows(json: string): PowerOnRow[] {
  const rows: PowerOnRow[] = [];
  for (const raw of toArray(json)) {
    if (!isObject(raw)) continue;
    const city = isObject(raw.city) ? raw.city : null;
    const street = isObject(raw.street) ? raw.street : null;
    const has = (o: JsonObject | null, k: string) => o !== null && Object.prototype.hasOwnProperty.call(o, k);
    const present = (k: string) => raw[k] !== undefined && raw[k] !== null;
    rows.push({
      id: optInt(raw.id),
      cityId: city !== null && has(city, 'id') ? optInt(city.id) : null,
      cityName: city ? optString(city.name) : '',
      streetId: street !== null && has(street, 'id') ? optInt(street.id) : null,
      streetName: street ? optString(street.name) : '',
      dateEvent: optString(raw.dateEvent),
      datePlanIn: optString(raw.datePlanIn),
      koment: present('koment') ? String(raw.koment) : null,
      switchSubReason: present('switchSubReason') ? optInt(raw.switchSubReason) : null,
      typeOff: present('typeOff') ? optInt(raw.typeOff) : null,
      buildingNames: optString(raw.buildingNames),
    });
  }
  return rows;
}

const errMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/**
 * Browser/Node `fetch` as an [HttpGet]. In the browser it goes through the dev proxy first and then
 * straight to the API (works when the host sends CORS headers); a non-JSON answer (the SPA fallback
 * page of a static host) counts as a failure.
 */
export function createFetchHttpGet(timeoutMs = 8000): HttpGet {
  return async (url: string): Promise<string> => {
    const candidates = url.startsWith(POWERON_PROXY_BASE_URL)
      ? [url, POWERON_BASE_URL + url.slice(POWERON_PROXY_BASE_URL.length)]
      : [url];
    let lastError: unknown = new Error('no request made');
    for (const candidate of candidates) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(candidate, { method: 'GET', headers: { Accept: 'application/json' }, signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if ((res.headers.get('content-type') || '').toLowerCase().includes('text/html')) throw new Error('HTML instead of JSON');
        return await res.text();
      } catch (e) {
        lastError = e;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError;
  };
}

export class PowerOnClient {
  static readonly BASE_URL = POWERON_BASE_URL;
  static readonly IDS_TTL_MS = POWERON_IDS_TTL_MS;
  static readonly cityKey = cityKey;
  static readonly toArray = toArray;
  static readonly parseRows = parseRows;

  private readonly baseUrl: string;

  /** [baseUrl] defaults to the dev proxy in a browser and to the real host elsewhere (Node, tests). */
  constructor(
    private readonly http: HttpGet = createFetchHttpGet(),
    baseUrl: string = isBrowser() ? POWERON_PROXY_BASE_URL : POWERON_BASE_URL
  ) {
    this.baseUrl = baseUrl;
  }

  /** City ids by exact name (inside the REM when known), then street ids by canonical street key. */
  async resolveIds(target: PowerOnTarget): Promise<PowerOnIds> {
    const wanted = cityKey(target.settlementName);
    const byRem = target.remOtgId !== null ? `&otg.id=${target.remOtgId}` : '';
    const cityRows = await this.fetchCities(wanted, target.settlementName, byRem);
    const cityIds = Array.from(new Set(cityRows.map((c) => c.id)));
    if (cityIds.length === 0) return { cityIds: [], streetIds: [] };

    const streetKeys = new Set(target.streetNames.map((n) => StreetKey.of(n)));
    const streetIds = new Set<number>();
    for (const cityId of cityIds) {
      const body = await this.http(`${this.baseUrl}/pw_streets?city.id=${cityId}&pagination=false`);
      for (const o of toArray(body)) {
        if (!isObject(o)) continue;
        if (streetKeys.has(StreetKey.of(optString(o.name)))) streetIds.add(optInt(o.id));
      }
    }
    return { cityIds, streetIds: Array.from(streetIds) };
  }

  private async fetchCities(wantedKey: string, rawName: string, byRem: string): Promise<{ id: number; name: string }[]> {
    const query = async (extra: string) => {
      const bare = TextNorm.decodeEntities(rawName).trim().replace(CITY_PREFIX, '').trim();
      const body = await this.http(`${this.baseUrl}/pw_cities?name=${enc(bare)}${extra}&pagination=false`);
      const out: { id: number; name: string }[] = [];
      for (const o of toArray(body)) {
        if (!isObject(o)) continue;
        const name = optString(o.name);
        if (cityKey(name) === wantedKey) out.push({ id: optInt(o.id), name });
      }
      return out;
    };
    const inRem = byRem ? await query(byRem) : [];
    return inRem.length > 0 ? inRem : query('');
  }

  /**
   * Fetches emergencies and planned works for the address. Resolution order for the query scope:
   * street ids, then city ids (rows filtered by street key), then the REM (filtered by city and street).
   * [now] is accepted for symmetry with the Kotlin signature (the engine, not the client, resolves "now").
   */
  async fetch(target: PowerOnTarget, today: LocalDate, _now?: LocalDateTime): Promise<PowerOnResult> {
    const cachedStreets = target.cachedStreetIds ?? [];
    const cachedCities = target.cachedCityIds ?? [];
    let ids: PowerOnIds | null = cachedStreets.length > 0 || cachedCities.length > 0 ? { cityIds: cachedCities, streetIds: cachedStreets } : null;
    try {
      if (ids === null) ids = await this.resolveIds(target);
    } catch (e) {
      return { emergency: EmergencyFetch.Unavailable(`resolve: ${errMessage(e)}`), repairs: null, ids: null };
    }

    let scope: string;
    let streetFilter: Set<string> | null = null;
    let cityFilter: string | null = null;
    if (ids.streetIds.length > 0) {
      scope = ids.streetIds.map((id) => `street.id[]=${id}`).join('&');
    } else if (ids.cityIds.length > 0) {
      scope = ids.cityIds.map((id) => `city.id[]=${id}`).join('&');
      streetFilter = new Set(target.streetNames.map((n) => StreetKey.of(n)));
    } else if (target.remOtgId !== null) {
      scope = `otg.id=${target.remOtgId}`;
      streetFilter = new Set(target.streetNames.map((n) => StreetKey.of(n)));
      cityFilter = cityKey(target.settlementName);
    } else {
      return { emergency: EmergencyFetch.Unavailable('no scope'), repairs: null, ids };
    }

    const filtered = (rows: PowerOnRow[]): PowerOnRow[] =>
      rows.filter(
        (r) => (streetFilter === null || streetFilter.has(StreetKey.of(r.streetName))) && (cityFilter === null || cityKey(r.cityName) === cityFilter)
      );

    let emergency: EmergencyFetch;
    try {
      const rows = filtered(parseRows(await this.http(`${this.baseUrl}/pw_accidents?${scope}&${EMERGENCY_REASONS}&pagination=false`)));
      const limit = atStartOfDay(plusDays(today, 2));
      const records = PowerOnMapper.emergencyRecordsFor(rows, target.house).filter((r) => r.start < limit);
      emergency = EmergencyFetch.Confirmed(records);
    } catch (e) {
      emergency = EmergencyFetch.Unavailable(`accidents: ${errMessage(e)}`);
    }

    let repairs: Outage[] | null;
    try {
      const rows = filtered(
        parseRows(await this.http(`${this.baseUrl}/pw_accident_planeds?${scope}&datePlanIn[after]=${formatLocalDate(today)}&pagination=false`))
      );
      repairs = PowerOnMapper.repairOutagesFor(rows, target.house, today);
    } catch {
      repairs = null;
    }
    return { emergency, repairs, ids };
  }
}
