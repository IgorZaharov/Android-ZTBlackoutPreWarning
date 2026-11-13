/**
 * ZTOE (Zhytomyroblenergo) Outage Queue Address Lookup Service
 * Supports parsing HTML tables from https://www.ztoe.com.ua/unhooking-search.php
 * (REM -> City/Settlement -> Street -> House Number -> Queue/Subqueue or custom status text)
 * with the static REM / settlement / street directory as an offline fallback.
 *
 * 1.4.0 (mirrors the cleanup of ZtoeAddressLookup.kt, spec/ADDRESS_KEY.md section 5):
 *  - duplicate streets of one settlement are ONE option keyed by StreetKey; it keeps every id
 *    (`allIds`, `ztoeVulicaIds`, `poweronStreetIds`) and any of them resolves it,
 *  - houses are the union over those ids, de-duplicated by HouseKey,
 *  - names are compared by key equality only, never with `contains`,
 *  - there is no demo emergency, no fake default house list and no PowerOn fetching here any more:
 *    emergencies come from poweronClient.ts through outageRepository.ts.
 */

import { EmergencyOutageInfo, SelectedAddressQuery } from '../types';
import { HouseKey, StreetKey } from '../core/addressKeys';
import { getKyivDateParts } from './ztoeParser';

/**
 * @deprecated Simulator-only helper (the "demo emergency" button of App.tsx). It is no longer
 * attached to any house of the address index; production emergencies come from PowerOn.
 */
export function getKyivska37DemoEmergencyOutage(baseDate: Date = new Date()): EmergencyOutageInfo {
  const todayParts = getKyivDateParts(baseDate);
  const todayDdMmYyyy = `${String(todayParts.day).padStart(2, '0')}.${String(todayParts.month).padStart(2, '0')}.${todayParts.year}`;
  return {
    id: 'pw_accident_391476673',
    outageType: 'Аварійне відключення',
    startTime: `${todayDdMmYyyy} 22:00`,
    estimatedRestoreTime: `${todayDdMmYyyy} 23:59`,
  };
}

export const ZTOE_FULL_NO_OUTAGE_MESSAGE =
  'В цей час не вимикається, за винятком випадків аварійних відключень';

export interface ZtoeRemOption {
  id: string;
  ztoeRemId?: string;
  ztoeOtgId?: string;
  nameUk: string;
  nameEn: string;
}

export interface ZtoeSettlementOption {
  id: string;
  remId: string;
  ztoeNaspunktId?: string;
  poweronCityId?: string;
  nameUk: string;
  nameEn: string;
}

/** One street of a settlement. Duplicate ztoe/PowerOn entries of the same street are merged into one of these. */
export interface ZtoeStreetOption {
  /** Primary option id (the first one seen). Any id in [allIds] resolves this option. */
  id: string;
  /** Every option id merged into this street, `id` included, in discovery order. */
  allIds: string[];
  settlementId: string;
  /** First ztoe `vulica_id` (kept for older call sites); see [ztoeVulicaIds]. */
  ztoeVulicaId?: string;
  /** All ztoe `vulica_id`s of this street; a per-street request loops over all of them. */
  ztoeVulicaIds?: string[];
  /** First PowerOn street id when known (hint only; PowerOn ids are resolved by poweronClient). */
  poweronStreetId?: string;
  poweronStreetIds?: string[];
  nameUk: string;
  nameEn: string;
}

type RawStreetOption = Omit<ZtoeStreetOption, 'allIds' | 'ztoeVulicaIds' | 'poweronStreetIds'> & {
  allIds?: string[];
  ztoeVulicaIds?: string[];
  poweronStreetIds?: string[];
};

export interface ZtoeHouseLookupResult {
  house: string;
  queue: string; // e.g. "5.2", "1.1", or "" when ZTOE table has a message instead of queue/subqueue
  rawQueueCell?: string;
  rawSubqueueCell?: string;
  /**
   * Optional descriptive text found in the ZTOE table queue/subqueue columns
   * (e.g., "В цей час не вимикається, за винятком випадків аварійних відключень")
   */
  statusText?: string;
  /** Human readable label of the address this record was resolved for (set by checkAddressOnZtoeWebsite). */
  addressLabel?: string;
  /**
   * @deprecated Never set any more: emergencies are tracked per address in the outage state store
   * (OutageRepository / EmergencyLedger). Kept so older views still compile.
   */
  emergencyOutage?: EmergencyOutageInfo | null;
}

export type ZtoeHouseQueueRecord = ZtoeHouseLookupResult;

function pushUnique(list: string[], value: string | undefined): void {
  if (value && !list.includes(value)) list.push(value);
}

/**
 * Groups street entries of a settlement by `StreetKey.of(name)` into ONE option each (idempotent).
 * Display name: the first name seen. Canonical id: a static (non "st_") id when there is one,
 * otherwise the member with the lowest ztoe id. All ids of all members are kept.
 */
export function mergeStreets(options: readonly RawStreetOption[]): ZtoeStreetOption[] {
  const groups = new Map<string, RawStreetOption[]>();
  for (const o of options) {
    const key = `${o.settlementId}|${StreetKey.of(o.nameUk)}`;
    const group = groups.get(key);
    if (group) group.push(o);
    else groups.set(key, [o]);
  }
  return Array.from(groups.values()).map(mergeGroup);
}

const vulicaNumber = (o: RawStreetOption): number => {
  const n = parseInt(o.ztoeVulicaId ?? '', 10);
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
};

function mergeGroup(group: readonly RawStreetOption[]): ZtoeStreetOption {
  const first = group[0];
  const canonical =
    group.find((o) => !o.id.startsWith('st_')) ?? [...group].sort((a, b) => vulicaNumber(a) - vulicaNumber(b))[0] ?? first;
  const ordered = [canonical, ...group.filter((o) => o !== canonical)];
  const allIds: string[] = [];
  const vulicaIds: string[] = [];
  const poweronIds: string[] = [];
  pushUnique(allIds, canonical.id);
  pushUnique(vulicaIds, canonical.ztoeVulicaId);
  for (const o of ordered) {
    for (const id of [...(o.allIds ?? []), o.id]) pushUnique(allIds, id);
    for (const id of [...(o.ztoeVulicaIds ?? []), o.ztoeVulicaId]) pushUnique(vulicaIds, id);
    for (const id of [...(o.poweronStreetIds ?? []), o.poweronStreetId]) pushUnique(poweronIds, id);
  }
  return {
    ...canonical,
    nameUk: first.nameUk,
    nameEn: first.nameEn,
    allIds,
    ztoeVulicaIds: vulicaIds,
    ztoeVulicaId: canonical.ztoeVulicaId ?? vulicaIds[0],
    poweronStreetIds: poweronIds,
    poweronStreetId: canonical.poweronStreetId ?? poweronIds[0],
  };
}

// Street type tokens as they look inside a StreetKey (skeleton applied), like STREET_TYPE_KEY_TOKENS in Kotlin.
const STREET_TYPE_KEY_TOKENS: ReadonlySet<string> = new Set(
  ['вул', 'пров', 'просп', 'б-р', 'пл', 'пр-д', 'узв', 'туп', 'наб', 'шосе', 'майдан'].map((t) => StreetKey.of(t))
);

/** A StreetKey without its leading type token ("byл kиїbcьka" -> "kиїbcьka"). */
function bareStreetKey(key: string): string {
  const space = key.indexOf(' ');
  if (space < 0) return STREET_TYPE_KEY_TOKENS.has(key) ? '' : key;
  return STREET_TYPE_KEY_TOKENS.has(key.slice(0, space)) ? key.slice(space + 1) : key;
}

function sortHouseLookupResults(list: Iterable<ZtoeHouseLookupResult>): ZtoeHouseLookupResult[] {
  return Array.from(list).sort((a, b) => {
    const numA = parseInt(a.house, 10);
    const numB = parseInt(b.house, 10);
    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
      return numA - numB;
    }
    return a.house.localeCompare(b.house, 'uk');
  });
}

/**
 * Union of house lists, de-duplicated by `HouseKey.of`. The first display form wins; a later entry
 * only upgrades an entry that has no queue yet.
 */
export function mergeHouseLists(lists: readonly (readonly ZtoeHouseLookupResult[])[]): ZtoeHouseLookupResult[] {
  const byKey = new Map<string, ZtoeHouseLookupResult>();
  for (const list of lists) {
    for (const h of list) {
      const key = HouseKey.of(h.house);
      if (!key) continue;
      const existing = byKey.get(key);
      if (!existing) byKey.set(key, h);
      else if (!existing.queue && h.queue) byKey.set(key, { ...h, house: existing.house });
    }
  }
  return sortHouseLookupResults(byKey.values());
}

export const ZTOE_REM_OPTIONS: ZtoeRemOption[] = [
  { id: 'zhytomyr', ztoeRemId: '7', ztoeOtgId: '6', nameUk: 'Житомирський РЕМ', nameEn: 'Zhytomyr REM' },
  { id: 'berdychiv', ztoeRemId: '3', ztoeOtgId: '3', nameUk: 'Бердичівський РЕМ', nameEn: 'Berdychiv REM' },
  { id: 'korosten', ztoeRemId: '9', ztoeOtgId: '7', nameUk: 'Коростенський РЕМ', nameEn: 'Korosten REM' },
  { id: 'zviahel', ztoeRemId: '16', ztoeOtgId: '11', nameUk: 'Звягельський РЕМ', nameEn: 'Zviahel REM' },
  { id: 'malyn', ztoeRemId: '14', ztoeOtgId: '10', nameUk: 'Малинський РЕМ', nameEn: 'Malyn REM' },
  { id: 'radomyshl', ztoeRemId: '20', ztoeOtgId: '15', nameUk: 'Радомишльський РЕМ', nameEn: 'Radomyshl REM' },
  { id: 'andrushivka', ztoeRemId: '1', ztoeOtgId: '1', nameUk: 'Андрушівський РЕМ', nameEn: 'Andrushivka REM' },
  { id: 'baranivka', ztoeRemId: '2', ztoeOtgId: '2', nameUk: 'Баранівський РЕМ', nameEn: 'Baranivka REM' },
  { id: 'brusyliv', ztoeRemId: '4', ztoeOtgId: '4', nameUk: 'Брусилівський РЕМ', nameEn: 'Brusyliv REM' },
  { id: 'korostyshiv', ztoeRemId: '11', ztoeOtgId: '8', nameUk: 'Коростишівський РЕМ', nameEn: 'Korostyshiv REM' },
  { id: 'liubar', ztoeRemId: '13', ztoeOtgId: '9', nameUk: 'Любарський РЕМ', nameEn: 'Liubar REM' },
  { id: 'ovruch', ztoeRemId: '17', ztoeOtgId: '12', nameUk: 'Овруцький РЕМ', nameEn: 'Ovruch REM' },
  { id: 'olevsk', ztoeRemId: '18', ztoeOtgId: '13', nameUk: 'Олевський РЕМ', nameEn: 'Olevsk REM' },
  { id: 'popilnia', ztoeRemId: '19', ztoeOtgId: '14', nameUk: 'Попільнянський РЕМ', nameEn: 'Popilnia REM' },
  { id: 'pulyny', ztoeRemId: '23', ztoeOtgId: '17', nameUk: 'Пулинський РЕМ', nameEn: 'Pulyny REM' },
  { id: 'romaniv', ztoeRemId: '21', ztoeOtgId: '16', nameUk: 'Романівський РЕМ', nameEn: 'Romaniv REM' },
  { id: 'khoroshiv', ztoeRemId: '5', ztoeOtgId: '5', nameUk: 'Хорошівський РЕМ', nameEn: 'Khoroshiv REM' },
  { id: 'cherniakhiv', ztoeRemId: '24', ztoeOtgId: '18', nameUk: 'Черняхівський РЕМ', nameEn: 'Cherniakhiv REM' },
  { id: 'chudniv', ztoeRemId: '25', ztoeOtgId: '19', nameUk: 'Чуднівський РЕМ', nameEn: 'Chudniv REM' },
];

export const ZTOE_SETTLEMENT_OPTIONS: ZtoeSettlementOption[] = [
  { id: 'zt_city', remId: 'zhytomyr', ztoeNaspunktId: '16657', poweronCityId: '333', nameUk: 'м. Житомир', nameEn: 'Zhytomyr' },
  { id: 'zt_zarichany', remId: 'zhytomyr', ztoeNaspunktId: '16670', nameUk: 'с. Зарічани', nameEn: 'Zarichany' },
  { id: 'zt_stanyshivka', remId: 'zhytomyr', ztoeNaspunktId: '16680', nameUk: 'с. Станишівка', nameEn: 'Stanyshivka' },
  { id: 'zt_hlybochytsia', remId: 'zhytomyr', ztoeNaspunktId: '16667', nameUk: 'с. Глибочиця', nameEn: 'Hlybochytsia' },
  { id: 'bd_city', remId: 'berdychiv', ztoeNaspunktId: '16758', nameUk: 'м. Бердичів', nameEn: 'Berdychiv' },
  { id: 'kr_city', remId: 'korosten', ztoeNaspunktId: '17062', nameUk: 'м. Коростень', nameEn: 'Korosten' },
  { id: 'zv_city', remId: 'zviahel', ztoeNaspunktId: '16823', nameUk: 'м. Звягель', nameEn: 'Zviahel' },
  { id: 'ml_city', remId: 'malyn', ztoeNaspunktId: '17634', nameUk: 'м. Малин', nameEn: 'Malyn' },
  { id: 'rd_city', remId: 'radomyshl', ztoeNaspunktId: '17899', nameUk: 'м. Радомишль', nameEn: 'Radomyshl' },
  { id: 'an_city', remId: 'andrushivka', ztoeNaspunktId: '17694', nameUk: 'м. Андрушівка', nameEn: 'Andrushivka' },
  { id: 'br_city', remId: 'baranivka', ztoeNaspunktId: '15417', nameUk: 'м. Баранівка', nameEn: 'Baranivka' },
  { id: 'bs_city', remId: 'brusyliv', ztoeNaspunktId: '16202', nameUk: 'смт Брусилів', nameEn: 'Brusyliv' },
  { id: 'ks_city', remId: 'korostyshiv', ztoeNaspunktId: '15747', nameUk: 'м. Коростишів', nameEn: 'Korostyshiv' },
  { id: 'lb_city', remId: 'liubar', ztoeNaspunktId: '17742', nameUk: 'смт Любар', nameEn: 'Liubar' },
  { id: 'ov_city', remId: 'ovruch', ztoeNaspunktId: '17197', nameUk: 'м. Овруч', nameEn: 'Ovruch' },
  { id: 'ol_city', remId: 'olevsk', ztoeNaspunktId: '17823', nameUk: 'м. Олевськ', nameEn: 'Olevsk' },
  { id: 'pp_city', remId: 'popilnia', ztoeNaspunktId: '17555', nameUk: 'смт Попільня', nameEn: 'Popilnia' },
  { id: 'pl_city', remId: 'pulyny', ztoeNaspunktId: '16602', nameUk: 'смт Пулини', nameEn: 'Pulyny' },
  { id: 'rm_city', remId: 'romaniv', ztoeNaspunktId: '17968', nameUk: 'смт Романів', nameEn: 'Romaniv' },
  { id: 'kh_city', remId: 'khoroshiv', ztoeNaspunktId: '16281', nameUk: 'смт Хорошів', nameEn: 'Khoroshiv' },
  { id: 'ch_city', remId: 'cherniakhiv', ztoeNaspunktId: '16063', nameUk: 'смт Черняхів', nameEn: 'Cherniakhiv' },
  { id: 'cd_city', remId: 'chudniv', ztoeNaspunktId: '18001', nameUk: 'м. Чуднів', nameEn: 'Chudniv' },
];

const RAW_STREET_OPTIONS: RawStreetOption[] = [
  // м. Житомир
  { id: 'zt_kyivska', settlementId: 'zt_city', ztoeVulicaId: '173934', poweronStreetId: '4757', nameUk: 'вул. Київська', nameEn: 'Kyivska St.' },
  { id: 'zt_berdy', settlementId: 'zt_city', ztoeVulicaId: '174574', poweronStreetId: '4550', nameUk: 'вул. Велика Бердичівська', nameEn: 'Velyka Berdychivska St.' },
  { id: 'zt_peremohy', settlementId: 'zt_city', ztoeVulicaId: '173948', poweronStreetId: '4552', nameUk: 'вул. Перемоги', nameEn: 'Peremohy St.' },
  { id: 'zt_pokrovska', settlementId: 'zt_city', ztoeVulicaId: '173949', poweronStreetId: '4789', nameUk: 'вул. Покровська', nameEn: 'Pokrovska St.' },
  { id: 'zt_lesi', settlementId: 'zt_city', ztoeVulicaId: '173937', poweronStreetId: '4788', nameUk: 'вул. Лесі Українки', nameEn: 'Lesi Ukrainky St.' },
  { id: 'zt_chudnivska', settlementId: 'zt_city', ztoeVulicaId: '174543', poweronStreetId: '4645', nameUk: 'вул. Чуднівська', nameEn: 'Chudnivska St.' },
  { id: 'zt_mykhailivska', settlementId: 'zt_city', ztoeVulicaId: '174152', poweronStreetId: '33622', nameUk: 'вул. Михайлівська', nameEn: 'Mykhailivska St.' },
  { id: 'st_173952', settlementId: 'zt_city', ztoeVulicaId: '173952', poweronStreetId: '33488', nameUk: 'вул. Степана Бандери', nameEn: 'Stepana Bandery St.' },
  // с. Зарічани
  { id: 'zr_lisova', settlementId: 'zt_zarichany', ztoeVulicaId: '175050', nameUk: 'вул. Лісова', nameEn: 'Lisova St.' },
  { id: 'zr_berdy', settlementId: 'zt_zarichany', ztoeVulicaId: '175051', nameUk: 'вул. Бердичівське шосе', nameEn: 'Berdychivske Hwy' },
  // с. Станишівка
  { id: 'st_tsentralna', settlementId: 'zt_stanyshivka', ztoeVulicaId: '175250', nameUk: 'вул. Центральна', nameEn: 'Tsentralna St.' },
  // с. Глибочиця
  { id: 'hl_kyivska', settlementId: 'zt_hlybochytsia', ztoeVulicaId: '174900', nameUk: 'вул. Київська', nameEn: 'Kyivska St.' },
  // м. Бердичів
  { id: 'bd_ievropeiska', settlementId: 'bd_city', ztoeVulicaId: '175500', nameUk: 'вул. Європейська', nameEn: 'Yevropeiska St.' },
  { id: 'bd_zhytomyrska', settlementId: 'bd_city', ztoeVulicaId: '175501', nameUk: 'вул. Житомирська', nameEn: 'Zhytomyrska St.' },
  // м. Коростень
  { id: 'kr_hrushevskoho', settlementId: 'kr_city', ztoeVulicaId: '177000', nameUk: 'вул. Грушевського', nameEn: 'Hrushevskoho St.' },
  // м. Звягель
  { id: 'zv_shevchenka', settlementId: 'zv_city', ztoeVulicaId: '176000', nameUk: 'вул. Шевченка', nameEn: 'Shevchenka St.' },
  // м. Малин
  { id: 'ml_soborna', settlementId: 'ml_city', ztoeVulicaId: '179000', nameUk: 'вул. Соборна', nameEn: 'Soborna St.' },
  // м. Радомишль
  { id: 'rd_velyka', settlementId: 'rd_city', ztoeVulicaId: '180000', nameUk: 'вул. Велика Житомирська', nameEn: 'Velyka Zhytomyrska St.' },
  // Other REMs
  { id: 'an_tsentralna', settlementId: 'an_city', ztoeVulicaId: '170100', nameUk: 'вул. Центральна', nameEn: 'Tsentralna St.' },
  { id: 'br_soborna', settlementId: 'br_city', ztoeVulicaId: '170200', nameUk: 'вул. Соборна', nameEn: 'Soborna St.' },
  { id: 'bs_myru', settlementId: 'bs_city', ztoeVulicaId: '170300', nameUk: 'вул. Миру', nameEn: 'Myru St.' },
  { id: 'ks_kyivska', settlementId: 'ks_city', ztoeVulicaId: '170400', nameUk: 'вул. Київська', nameEn: 'Kyivska St.' },
  { id: 'lb_nezalezhnosti', settlementId: 'lb_city', ztoeVulicaId: '170500', nameUk: 'вул. Незалежності', nameEn: 'Nezalezhnosti St.' },
  { id: 'ov_tarasa', settlementId: 'ov_city', ztoeVulicaId: '170600', nameUk: 'вул. Тараса Шевченка', nameEn: 'Tarasa Shevchenka St.' },
  { id: 'ol_svobody', settlementId: 'ol_city', ztoeVulicaId: '170700', nameUk: 'вул. Свято-Миколаївська', nameEn: 'Sviato-Mykolaivska St.' },
  { id: 'pp_bohdana', settlementId: 'pp_city', ztoeVulicaId: '170800', nameUk: 'вул. Богдана Хмельницького', nameEn: 'Bohdana Khmelnytskoho St.' },
  { id: 'pl_shevchenka', settlementId: 'pl_city', ztoeVulicaId: '170900', nameUk: 'вул. Шевченка', nameEn: 'Shevchenka St.' },
  { id: 'rm_nebesnoi', settlementId: 'rm_city', ztoeVulicaId: '171000', nameUk: 'вул. Небесної Сотні', nameEn: 'Nebesnoi Sotni St.' },
  { id: 'kh_nezalezhnosti', settlementId: 'kh_city', ztoeVulicaId: '171100', nameUk: 'вул. Незалежності', nameEn: 'Nezalezhnosti St.' },
  { id: 'ch_koroliova', settlementId: 'ch_city', ztoeVulicaId: '171200', nameUk: 'вул. Корольова', nameEn: 'Koroliova St.' },
  { id: 'cd_soborna', settlementId: 'cd_city', ztoeVulicaId: '171300', nameUk: 'вул. Соборна', nameEn: 'Soborna St.' },
];

export const ZTOE_STREET_OPTIONS: ZtoeStreetOption[] = mergeStreets(RAW_STREET_OPTIONS);

/**
 * Decodes HTML entities and apostrophe character references (`&amp;#039;`, `&#039;`, `&#39;`,
 * `&#x27;`, `&apos;`, `&rsquo;`, `&lsquo;`, `&#8217;`, `&#146;`) into standard characters (`'`).
 * Unescapes `&amp;` first so double-escaped entities like `&amp;#039;` are properly resolved.
 */
export function decodeHtmlEntities(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/&amp;/gi, '&')
    .replace(/&#0*39;|&#x0*27;|&apos;|&#8217;|&#0*146;|&rsquo;|&lsquo;/gi, "'")
    .replace(/&quot;|&#0*34;/gi, '"')
    .replace(/&nbsp;|&#0*160;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

export const decodeZtoeHtmlEntities = decodeHtmlEntities;

function stripHtmlTags(raw: string): string {
  return decodeHtmlEntities(raw.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

const VALID_TIMESTAMP_REGEX = /^(\d{2}\.\d{2}(?:\.\d{2,4})?\s+)?\d{1,2}:\d{2}$/;

export function isValidOutageTimestamp(value: string | undefined | null): boolean {
  if (!value || typeof value !== 'string') return false;
  return VALID_TIMESTAMP_REGEX.test(value.trim());
}

export function isValidEmergencyOutage(
  info: EmergencyOutageInfo | null | undefined
): info is EmergencyOutageInfo {
  if (!info || typeof info !== 'object') return false;
  if (!isValidOutageTimestamp(info.startTime) || !isValidOutageTimestamp(info.estimatedRestoreTime)) {
    return false;
  }
  const combined = `${info.outageType || ''} ${info.startTime} ${info.estimatedRestoreTime}`.toLowerCase();
  if (combined.includes('не вимикається') || combined.includes('за винятком')) {
    return false;
  }
  return true;
}

/**
 * Parses an HTML address lookup table from https://www.ztoe.com.ua/unhooking-search.php
 * Supports both 3-column (Будинок | Черга | Підчерга or Черга | Підчерга | Будинки) and 7-column
 * (РЕМ | Населений пункт | Назва вулиці, провулка, тощо | Будинки | Черга | Підчерга | Примітка) ZTOE tables.
 * If the ZTOE table has a message instead of queue/subqueue, queue is set to "" (no queue)
 * and the full unshortened message is returned in statusText.
 */
export function parseZtoeAddressLookupTableHtml(
  html: string,
  targetStreetName?: string
): ZtoeHouseLookupResult[] {
  const results: ZtoeHouseLookupResult[] = [];
  if (!html) return results;

  // Exclude the 48-column schedule tables ("Графіки погодинних відключень") at the bottom of unhooking-search.php
  const scheduleSectionIdx = html.indexOf('Графіки погодинних відключень');
  const addressSectionHtml = scheduleSectionIdx >= 0 ? html.slice(0, scheduleSectionIdx) : html;

  const trRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;

  let streetColIdx = -1;
  let houseColIdx = 0;
  let queueColIdx = 1;
  let subqueueColIdx = 2;
  let noteColIdx = -1;
  const metadataCols = new Set<number>();
  const targetStreetKey = targetStreetName ? StreetKey.of(targetStreetName) : '';

  while ((trMatch = trRegex.exec(addressSectionHtml)) !== null) {
    const rowHtml = trMatch[1];
    if (/<input\b/i.test(rowHtml) || /<select\b/i.test(rowHtml)) continue;

    const cellRegex = /<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      cells.push(stripHtmlTags(cellMatch[1]));
    }

    if (cells.length < 2) continue;

    const firstCellLower = (cells[0] || '').toLowerCase();
    const isHeaderRow =
      /<th\b/i.test(rowHtml) ||
      firstCellLower === 'будинок' ||
      firstCellLower === 'будинки' ||
      firstCellLower === 'адреса' ||
      firstCellLower === 'рем' ||
      firstCellLower === 'черга' ||
      firstCellLower.includes('вулиц');

    if (isHeaderRow) {
      metadataCols.clear();
      streetColIdx = -1;
      noteColIdx = -1;
      cells.forEach((c, idx) => {
        const cl = c.toLowerCase();
        if (cl.includes('вулиц')) {
          streetColIdx = idx;
          metadataCols.add(idx);
        } else if (cl.includes('буд') || cl.includes('дом') || cl.includes('адрес')) {
          houseColIdx = idx;
        } else if (cl.includes('підчерг')) {
          subqueueColIdx = idx;
        } else if (cl.includes('черг')) {
          queueColIdx = idx;
        } else if (cl.includes('примітк')) {
          noteColIdx = idx;
          metadataCols.add(idx);
        } else if (cl === 'рем' || cl.includes('населений')) {
          metadataCols.add(idx);
        }
      });
      continue;
    }

    if (targetStreetKey && streetColIdx >= 0 && cells[streetColIdx]) {
      if (StreetKey.of(cells[streetColIdx]) !== targetStreetKey) {
        continue;
      }
    }

    const houseVal = cells[houseColIdx] || cells[0] || '';
    const queueRaw = cells[queueColIdx] ?? cells[1] ?? '';
    const subqueueRaw = cells[subqueueColIdx] ?? cells[2] ?? '';

    if (!houseVal) continue;

    const combinedMatch = `${queueRaw}.${subqueueRaw}`.match(/^([1-6])\.([1-2])$/);
    const directMatch = queueRaw.match(/^([1-6])\.([1-2])$/);

    let normalizedQueue = '';
    let statusText: string | undefined;

    if (directMatch) {
      normalizedQueue = `${directMatch[1]}.${directMatch[2]}`;
    } else if (combinedMatch) {
      normalizedQueue = `${combinedMatch[1]}.${combinedMatch[2]}`;
    }

    const uniqueNonNumericParts: string[] = [];
    cells.forEach((cellVal, idx) => {
      if (idx === houseColIdx || metadataCols.has(idx) || idx === noteColIdx) return;
      const trimmed = cellVal.trim();
      if (trimmed.length > 0 && !/^[1-6](\.[1-2])?$/.test(trimmed) && trimmed !== '-') {
        if (!uniqueNonNumericParts.includes(trimmed)) {
          uniqueNonNumericParts.push(trimmed);
        }
      }
    });

    if (uniqueNonNumericParts.length > 0) {
      statusText = uniqueNonNumericParts.join(' ').trim();
    }

    const houseTokens = houseVal.includes(',')
      ? houseVal.split(',').map((h) => h.trim()).filter(Boolean)
      : [houseVal.trim()];

    for (const hToken of houseTokens) {
      results.push({
        house: hToken,
        queue: normalizedQueue,
        rawQueueCell: queueRaw,
        rawSubqueueCell: subqueueRaw,
        statusText,
      });
    }
  }

  return results;
}

function normalizePlaceName(name: string): string {
  return decodeHtmlEntities(name || '')
    .toLowerCase()
    .replace(/^(м\.|місто|с\.|село|смт\.?|селище|с-ще\.?)\s+/i, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/['’ʼ`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resolves the queue (or the "does not switch off" status) of the selected house from the ztoe site.
 * The live row is authoritative; the cached row is used only when the site is unreachable or does
 * not list the house. Emergencies are not looked up here: OutageRepository asks PowerOnClient, and
 * the result's `emergencyOutage` is never set. The street is requested once per ztoe `vulica_id`
 * of the merged street and the rows are unioned; the whole street list is stored for the next use.
 */
export async function checkAddressOnZtoeWebsite(
  query: SelectedAddressQuery,
  siteUrl?: string
): Promise<ZtoeHouseLookupResult | null> {
  if (!query || !query.streetId || !query.house) return null;

  const targetHouseKey = HouseKey.of(query.house);
  if (!targetHouseKey) return null;

  const remObj =
    getRems().find((r) => r.id === query.remId) ||
    ZTOE_REM_OPTIONS.find((r) => r.id === query.remId);
  const settlementObj = findSettlementById(query.settlementId);
  const streetObj = findStreetById(query.streetId);
  const vulicaIds = streetObj?.ztoeVulicaIds ?? (streetObj?.ztoeVulicaId ? [streetObj.ztoeVulicaId] : []);

  const sameHouse = (h: ZtoeHouseLookupResult) => HouseKey.of(h.house) === targetHouseKey;
  let resolved: ZtoeHouseLookupResult | null = getHousesForStreet(query.streetId).find(sameHouse) ?? null;

  if (typeof fetch !== 'undefined' && streetObj && remObj?.ztoeRemId && settlementObj?.ztoeNaspunktId && vulicaIds.length > 0) {
    const lists: ZtoeHouseLookupResult[][] = [];
    for (const vulicaId of vulicaIds) {
      // Note: Do NOT pass `all: '1'` when `vulica_id` is specified, because `all=1` causes ZTOE
      // to ignore `vulica_id` and return all streets in the settlement instead of the selected street.
      const html = await postZtoeLookupForm(
        { rem_id: remObj.ztoeRemId, naspunkt_id: settlementObj.ztoeNaspunktId, vulica_id: vulicaId },
        siteUrl
      );
      if (!html) continue;
      const rows = parseZtoeAddressLookupTableHtml(html, streetObj.nameUk);
      if (rows.length > 0) lists.push(rows);
    }
    if (lists.length > 0) {
      const merged = mergeHouseLists(lists);
      for (const id of streetObj.allIds) if (id !== streetObj.id) delete dynamicHousesByStreetId[id];
      dynamicHousesByStreetId[streetObj.id] = merged;
      houseCacheUpdatedAtByStreetId[streetObj.id] = Date.now();
      recordRecentHouseStreet(streetObj.id);
      // A house with a "does not switch off" status row beats a plain row without queue
      const rows = merged.filter(sameHouse);
      const live = rows.find((r) => !r.queue && r.statusText) ?? rows.find((r) => Boolean(r.queue)) ?? rows[0];
      if (live) resolved = live;
    }
  }

  if (!resolved) return null;
  const head = [remObj?.nameUk, settlementObj?.nameUk].filter((x): x is string => Boolean(x && x.trim())).join(', ');
  const streetPart = streetObj?.nameUk?.trim() ? `${streetObj.nameUk}, ` : '';
  return {
    ...resolved,
    emergencyOutage: undefined,
    addressLabel: (head ? `${head},\n` : '') + streetPart + 'буд. ' + query.house.trim(),
  };
}

export const ADDRESS_INDEX_STORAGE_KEY = 'zt_address_index_cache_v1';
// v5: duplicate streets are merged and the fake default houses / injected emergencies of v4 are gone
const CACHE_SCHEMA_VERSION = 5;
const MAX_PERSISTED_HOUSE_STREETS = 50;
const FRESH_HOUSE_CACHE_TTL_MS = 120_000;

export interface PersistedAddressIndexCache {
  version: number;
  updatedAt: number;
  rems?: ZtoeRemOption[];
  settlementsByRemId?: Record<string, ZtoeSettlementOption[]>;
  streetsBySettlementId?: Record<string, ZtoeStreetOption[]>;
  housesByStreetId?: Record<string, ZtoeHouseLookupResult[]>;
  recentHouseStreetIds?: string[];
}

let dynamicRems: ZtoeRemOption[] | null = null;
const dynamicSettlementsByRemId: Record<string, ZtoeSettlementOption[]> = {};
const dynamicStreetsBySettlementId: Record<string, ZtoeStreetOption[]> = {};
const dynamicHousesByStreetId: Record<string, ZtoeHouseLookupResult[]> = {};
const houseCacheUpdatedAtByStreetId: Record<string, number> = {};
const inFlightSettlementPromises = new Map<string, Promise<ZtoeStreetOption[]>>();
let recentHouseStreetOrder: string[] = [];
let hasHydratedFromStorage = false;

function recordRecentHouseStreet(streetId: string): void {
  if (!streetId) return;
  recentHouseStreetOrder = [
    streetId,
    ...recentHouseStreetOrder.filter((id) => id !== streetId),
  ].slice(0, MAX_PERSISTED_HOUSE_STREETS);
}

/**
 * A stored index (or an old v4-style list) may hold the same street under several option ids:
 * move all houses of the merged ids under the primary id so every reader sees one list.
 */
function healMergedHouses(streets: readonly ZtoeStreetOption[]): void {
  for (const st of streets) {
    const lists = st.allIds.map((id) => dynamicHousesByStreetId[id]).filter((l): l is ZtoeHouseLookupResult[] => Array.isArray(l) && l.length > 0);
    if (lists.length === 0) continue;
    if (lists.length === 1 && Array.isArray(dynamicHousesByStreetId[st.id])) continue;
    dynamicHousesByStreetId[st.id] = mergeHouseLists(lists);
    for (const id of st.allIds) if (id !== st.id) delete dynamicHousesByStreetId[id];
  }
}

export function hydrateAddressIndexFromStorage(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    const raw = localStorage.getItem(ADDRESS_INDEX_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Partial<PersistedAddressIndexCache>;
    if (!parsed || typeof parsed !== 'object') return false;

    // Validate schema version and ensure Zhytomyr REM has ztoeRemId === '7'
    const cachedZtRem = Array.isArray(parsed.rems)
      ? parsed.rems.find((r) => r.id === 'zhytomyr')
      : undefined;
    if (parsed.version !== CACHE_SCHEMA_VERSION || (cachedZtRem && cachedZtRem.ztoeRemId !== '7')) {
      localStorage.removeItem(ADDRESS_INDEX_STORAGE_KEY);
      return false;
    }

    if (Array.isArray(parsed.rems) && parsed.rems.length > 0) {
      const cleaned = parsed.rems.map((r) => ({
        ...r,
        nameUk: stripHtmlTags(r.nameUk || ''),
        nameEn: stripHtmlTags(r.nameEn || r.nameUk || ''),
      }));
      // Ensure Житомирський РЕМ ('zhytomyr') is always at index 0
      const zt = cleaned.find((r) => r.id === 'zhytomyr');
      const rest = cleaned.filter((r) => r.id !== 'zhytomyr');
      dynamicRems = zt ? [zt, ...rest] : cleaned;
    }
    if (parsed.settlementsByRemId && typeof parsed.settlementsByRemId === 'object') {
      for (const [remId, list] of Object.entries(parsed.settlementsByRemId)) {
        if (Array.isArray(list) && list.length > 0) {
          dynamicSettlementsByRemId[remId] = list.map((s) => ({
            ...s,
            nameUk: stripHtmlTags(s.nameUk || ''),
            nameEn: stripHtmlTags(s.nameEn || s.nameUk || ''),
          }));
        }
      }
    }
    if (parsed.housesByStreetId && typeof parsed.housesByStreetId === 'object') {
      for (const [streetId, list] of Object.entries(parsed.housesByStreetId)) {
        if (Array.isArray(list) && list.length > 0) {
          dynamicHousesByStreetId[streetId] = list.map((h) => ({
            ...h,
            house: decodeHtmlEntities(h.house),
            statusText: h.statusText ? decodeHtmlEntities(h.statusText) : undefined,
            emergencyOutage: undefined,
          }));
        }
      }
    }
    if (parsed.streetsBySettlementId && typeof parsed.streetsBySettlementId === 'object') {
      for (const [settlementId, list] of Object.entries(parsed.streetsBySettlementId)) {
        if (Array.isArray(list) && list.length > 0) {
          // heals duplicates of an older index on read (spec/ADDRESS_KEY.md section 5, rule 6)
          const merged = mergeStreets(
            list.map((st) => ({
              ...st,
              nameUk: stripHtmlTags(st.nameUk || ''),
              nameEn: stripHtmlTags(st.nameEn || st.nameUk || ''),
            }))
          );
          dynamicStreetsBySettlementId[settlementId] = merged;
          healMergedHouses(merged);
        }
      }
    }
    if (Array.isArray(parsed.recentHouseStreetIds)) {
      recentHouseStreetOrder = parsed.recentHouseStreetIds.slice(0, MAX_PERSISTED_HOUSE_STREETS);
    } else {
      recentHouseStreetOrder = Object.keys(dynamicHousesByStreetId).slice(0, MAX_PERSISTED_HOUSE_STREETS);
    }
    hasHydratedFromStorage = true;
    return true;
  } catch {
    return false;
  }
}

export function persistAddressIndexToStorage(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const boundedHousesByStreetId: Record<string, ZtoeHouseLookupResult[]> = {};
    const allHouseKeys = Array.from(
      new Set([...recentHouseStreetOrder, ...Object.keys(dynamicHousesByStreetId)])
    ).slice(0, MAX_PERSISTED_HOUSE_STREETS);
    for (const streetId of allHouseKeys) {
      const houses = dynamicHousesByStreetId[streetId];
      if (Array.isArray(houses) && houses.length > 0) {
        boundedHousesByStreetId[streetId] = houses.map((h) => {
          const compact: ZtoeHouseLookupResult = {
            house: h.house,
            queue: h.queue,
          };
          if (h.statusText) compact.statusText = h.statusText;
          return compact;
        });
      }
    }
    const payload: PersistedAddressIndexCache = {
      version: CACHE_SCHEMA_VERSION,
      updatedAt: Date.now(),
      rems: dynamicRems || undefined,
      settlementsByRemId: { ...dynamicSettlementsByRemId },
      streetsBySettlementId: { ...dynamicStreetsBySettlementId },
      housesByStreetId: boundedHousesByStreetId,
      recentHouseStreetIds: recentHouseStreetOrder.slice(0, 100),
    };
    localStorage.setItem(ADDRESS_INDEX_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota or serialization errors
  }
}

export function resetAddressIndexCache(clearDisk = false): void {
  dynamicRems = null;
  for (const key of Object.keys(dynamicSettlementsByRemId)) {
    delete dynamicSettlementsByRemId[key];
  }
  for (const key of Object.keys(dynamicStreetsBySettlementId)) {
    delete dynamicStreetsBySettlementId[key];
  }
  for (const key of Object.keys(dynamicHousesByStreetId)) {
    delete dynamicHousesByStreetId[key];
  }
  for (const key of Object.keys(houseCacheUpdatedAtByStreetId)) {
    delete houseCacheUpdatedAtByStreetId[key];
  }
  inFlightSettlementPromises.clear();
  recentHouseStreetOrder = [];
  hasHydratedFromStorage = false;
  if (clearDisk && typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(ADDRESS_INDEX_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

/**
 * Installs an index directly (tests and the simulator): streets are merged by key and the houses of
 * merged ids are unioned, exactly as when a stored index is loaded.
 */
export function seedAddressIndexForTests(index: {
  settlementsByRemId?: Record<string, ZtoeSettlementOption[]>;
  streetsBySettlementId?: Record<string, RawStreetOption[]>;
  housesByStreetId?: Record<string, ZtoeHouseLookupResult[]>;
}): void {
  hasHydratedFromStorage = true;
  for (const [remId, list] of Object.entries(index.settlementsByRemId ?? {})) dynamicSettlementsByRemId[remId] = list;
  for (const [streetId, list] of Object.entries(index.housesByStreetId ?? {})) dynamicHousesByStreetId[streetId] = list;
  for (const [settlementId, list] of Object.entries(index.streetsBySettlementId ?? {})) {
    const merged = mergeStreets(list);
    dynamicStreetsBySettlementId[settlementId] = merged;
    healMergedHouses(merged);
  }
}

export function getAddressIndexStats(): {
  remCount: number;
  settlementGroupCount: number;
  streetGroupCount: number;
  houseGroupCount: number;
  indexedRemSettlementsCount: number;
  indexedSettlementStreetsCount: number;
  indexedStreetHousesCount: number;
} {
  ensureHydrated();
  const sCount = Object.keys(dynamicSettlementsByRemId).length;
  const stCount = Object.keys(dynamicStreetsBySettlementId).length;
  const hCount = Object.keys(dynamicHousesByStreetId).length;
  return {
    remCount: (dynamicRems || ZTOE_REM_OPTIONS).length,
    settlementGroupCount: sCount,
    streetGroupCount: stCount,
    houseGroupCount: hCount,
    indexedRemSettlementsCount: sCount,
    indexedSettlementStreetsCount: stCount,
    indexedStreetHousesCount: hCount,
  };
}

function ensureHydrated(): void {
  if (!hasHydratedFromStorage) {
    hasHydratedFromStorage = true;
    hydrateAddressIndexFromStorage();
  }
}

export function getRems(): ZtoeRemOption[] {
  ensureHydrated();
  if (dynamicRems && dynamicRems.length > 0) return dynamicRems;
  return ZTOE_REM_OPTIONS;
}

export function findSettlementById(settlementId: string): ZtoeSettlementOption | undefined {
  ensureHydrated();
  for (const list of Object.values(dynamicSettlementsByRemId)) {
    const found = list.find((s) => s.id === settlementId);
    if (found) return found;
  }
  const staticMatch = ZTOE_SETTLEMENT_OPTIONS.find((s) => s.id === settlementId);
  if (staticMatch) return staticMatch;
  const npId = settlementId.replace(/^(?:np|nasp_[a-z]+)_/, '');
  if (/^\d+$/.test(npId)) {
    for (const list of Object.values(dynamicSettlementsByRemId)) {
      const byDynamicNp = list.find((s) => s.ztoeNaspunktId === npId);
      if (byDynamicNp) return byDynamicNp;
    }
    const byNp = ZTOE_SETTLEMENT_OPTIONS.find((s) => s.ztoeNaspunktId === npId);
    if (byNp) return byNp;
  }
  return undefined;
}

/** Ids older versions stored for a street (kept resolving). */
function canonicalStreetId(streetId: string): string {
  return streetId === 'zt_velyka_berdychivska' ? 'zt_berdy' : streetId;
}

/** Resolves a street by ANY of its merged option ids (or by its ztoe vulica id). */
export function findStreetById(streetId: string): ZtoeStreetOption | undefined {
  ensureHydrated();
  if (!streetId) return undefined;
  const canonicalId = canonicalStreetId(streetId);
  const hasId = (st: ZtoeStreetOption) => st.allIds.includes(streetId) || st.allIds.includes(canonicalId);
  for (const list of Object.values(dynamicStreetsBySettlementId)) {
    const found = list.find(hasId);
    if (found) return found;
  }
  const staticMatch = ZTOE_STREET_OPTIONS.find(hasId);
  if (staticMatch) return staticMatch;
  const vulId = streetId.replace(/^(?:st|vul_[a-z_]+)_/, '');
  if (/^\d+$/.test(vulId)) {
    const byVul = (st: ZtoeStreetOption) => (st.ztoeVulicaIds ?? []).includes(vulId);
    for (const list of Object.values(dynamicStreetsBySettlementId)) {
      const found = list.find(byVul);
      if (found) return found;
    }
    return ZTOE_STREET_OPTIONS.find(byVul);
  }
  return undefined;
}

export function getSettlementsForRem(remId: string): ZtoeSettlementOption[] {
  ensureHydrated();
  const dynamicList = dynamicSettlementsByRemId[remId];
  if (dynamicList && dynamicList.length > 0) return dynamicList;
  return ZTOE_SETTLEMENT_OPTIONS.filter((s) => s.remId === remId);
}

export function getStreetsForSettlement(settlementId: string): ZtoeStreetOption[] {
  ensureHydrated();
  const dynamicList = dynamicStreetsBySettlementId[settlementId];
  if (dynamicList && dynamicList.length > 0) return dynamicList;
  return ZTOE_STREET_OPTIONS.filter((st) => st.settlementId === settlementId);
}

/** Houses of a street: the union over all its merged ids, de-duplicated by HouseKey. Empty when nothing was fetched. */
export function getHousesForStreet(streetId: string): ZtoeHouseLookupResult[] {
  ensureHydrated();
  const street = findStreetById(streetId);
  const ids = street ? street.allIds : [streetId, canonicalStreetId(streetId)];
  const lists = ids.map((id) => dynamicHousesByStreetId[id]).filter((l): l is ZtoeHouseLookupResult[] => Array.isArray(l) && l.length > 0);
  if (lists.length === 0) return [];
  return lists.length === 1 ? lists[0] : mergeHouseLists(lists);
}

export function parseZtoeRemOptionsHtml(html: string): ZtoeRemOption[] {
  if (!html || typeof html !== 'string') return [];
  const selectMatch = html.match(
    /<select[^>]*?(?:name=["']?rem_id["']?|id=["']?rem_id["']?)[^>]*>([\s\S]*?)<\/select>/i
  );
  const selectInner = selectMatch ? selectMatch[1] : html;
  const results: ZtoeRemOption[] = [];
  const seenIds = new Set<string>();
  const optRegex = /<option\s+value=["']?(\d+)["']?[^>]*>([\s\S]*?)<\/option>/gi;
  let m: RegExpExecArray | null;
  while ((m = optRegex.exec(selectInner)) !== null) {
    const remNum = m[1].trim();
    if (!remNum || remNum === '0') continue;
    const rawLabel = stripHtmlTags(m[2]).trim();
    if (!rawLabel || /оберіть|виберіть/i.test(rawLabel)) continue;

    const normalizedRawName = rawLabel.replace(/\s*РЕМ$/i, '').trim().toLowerCase();
    const staticMatch =
      ZTOE_REM_OPTIONS.find(
        (r) =>
          r.nameUk.toLowerCase() === rawLabel.toLowerCase() ||
          r.nameUk.replace(/\s*РЕМ$/i, '').trim().toLowerCase() === normalizedRawName
      ) || ZTOE_REM_OPTIONS.find((r) => r.ztoeRemId === remNum);

    const opt: ZtoeRemOption = {
      id: staticMatch?.id || `rem_${remNum}`,
      ztoeRemId: remNum,
      ztoeOtgId: staticMatch?.ztoeOtgId,
      nameUk: staticMatch?.nameUk || (rawLabel.includes('РЕМ') ? rawLabel : `${rawLabel} РЕМ`),
      nameEn: staticMatch?.nameEn || rawLabel,
    };
    if (!seenIds.has(opt.id)) {
      seenIds.add(opt.id);
      results.push(opt);
    }
  }
  if (results.length > 0) {
    for (const def of ZTOE_REM_OPTIONS) {
      if (!seenIds.has(def.id)) {
        seenIds.add(def.id);
        results.push(def);
      }
    }
  }
  // Ensure Житомирський РЕМ ('zhytomyr') is always placed first if present
  const ztIdx = results.findIndex((r) => r.id === 'zhytomyr');
  if (ztIdx > 0) {
    const [ztItem] = results.splice(ztIdx, 1);
    results.unshift(ztItem);
  }
  return results;
}

export function parseZtoeSettlementOptionsHtml(remId: string, html: string): ZtoeSettlementOption[] {
  if (!html || typeof html !== 'string') return [];
  const selectMatch = html.match(
    /<select[^>]*?(?:name=["']?naspunkt_id["']?|id=["']?naspunkt_id["']?)[^>]*>([\s\S]*?)<\/select>/i
  );
  const selectInner = selectMatch ? selectMatch[1] : !/<select\b/i.test(html) ? html : '';
  if (!selectInner) return [];

  const staticForRem = ZTOE_SETTLEMENT_OPTIONS.filter((s) => s.remId === remId);
  const results: ZtoeSettlementOption[] = [];
  const seenIds = new Set<string>();
  const optRegex = /<option\s+value=["']?(\d+)["']?[^>]*>([\s\S]*?)<\/option>/gi;
  let m: RegExpExecArray | null;
  while ((m = optRegex.exec(selectInner)) !== null) {
    const npId = m[1].trim();
    if (!npId || npId === '0') continue;
    const rawLabel = stripHtmlTags(m[2]).trim();
    if (!rawLabel || /оберіть|виберіть/i.test(rawLabel)) continue;
    const formattedUk = rawLabel
      .replace(/^місто\s+/i, 'м. ')
      .replace(/^село\s+/i, 'с. ')
      .replace(/^селище\s+/i, 'смт ');
    const candidateStatic =
      staticForRem.find((s) => normalizePlaceName(s.nameUk) === normalizePlaceName(formattedUk)) ||
      staticForRem.find((s) => s.ztoeNaspunktId === npId);
    const staticMatch = candidateStatic && !seenIds.has(candidateStatic.id) ? candidateStatic : undefined;
    const opt: ZtoeSettlementOption = {
      id: staticMatch?.id || `np_${npId}`,
      remId,
      ztoeNaspunktId: npId,
      poweronCityId: staticMatch?.poweronCityId,
      nameUk: staticMatch?.nameUk || formattedUk,
      nameEn: staticMatch?.nameEn || formattedUk,
    };
    if (!seenIds.has(opt.id)) {
      seenIds.add(opt.id);
      results.push(opt);
    }
  }
  return results;
}

/**
 * Street `<select>` of a ztoe response. Entries whose names share a StreetKey (apostrophe, case or
 * spacing variants, or the same name under two ids) become ONE option that keeps every `vulica_id`.
 */
export function parseZtoeStreetOptionsHtml(settlementId: string, html: string): ZtoeStreetOption[] {
  if (!html || typeof html !== 'string') return [];
  const selectMatch = html.match(
    /<select[^>]*?(?:name=["']?vulica_id["']?|id=["']?vulica_id["']?)[^>]*>([\s\S]*?)<\/select>/i
  );
  const selectInner = selectMatch ? selectMatch[1] : !/<select\b/i.test(html) ? html : '';
  if (!selectInner) return [];

  // Static entries only lend their stable id and hints; names are compared by key equality.
  const staticForSettlement = ZTOE_STREET_OPTIONS.filter((st) => st.settlementId === settlementId);
  const usedStaticIds = new Set<string>();
  const raw: RawStreetOption[] = [];
  const optRegex = /<option\s+value=["']?(\d+)["']?[^>]*>([\s\S]*?)<\/option>/gi;
  let m: RegExpExecArray | null;
  while ((m = optRegex.exec(selectInner)) !== null) {
    const vulId = m[1].trim();
    if (!vulId || vulId === '0') continue;
    const rawLabel = stripHtmlTags(m[2]).trim();
    if (!rawLabel || /оберіть|виберіть/i.test(rawLabel)) continue;
    const labelKey = StreetKey.of(rawLabel);
    const candidateStatic =
      staticForSettlement.find((st) => !usedStaticIds.has(st.id) && StreetKey.of(st.nameUk) === labelKey) ||
      staticForSettlement.find((st) => !usedStaticIds.has(st.id) && (st.ztoeVulicaIds ?? []).includes(vulId));
    if (candidateStatic) usedStaticIds.add(candidateStatic.id);
    raw.push({
      id: candidateStatic?.id || `st_${vulId}`,
      settlementId,
      ztoeVulicaId: vulId,
      poweronStreetId: candidateStatic?.poweronStreetId,
      nameUk: rawLabel,
      nameEn: candidateStatic?.nameEn || rawLabel,
    });
  }
  return mergeStreets(raw);
}

/**
 * Parses a settlement-wide ZTOE response (`rem_id=X&naspunkt_id=Y&all=1`) and indexes
 * ALL houses for EVERY street in that settlement in a single pass so selecting any street
 * in the dropdown opens its complete house list in 0ms without additional network requests.
 *
 * Also supports a 1-argument `parseZtoeSettlementHousesTableHtml(html)` call returning
 * a `Map<string, ZtoeHouseLookupResult[]>` keyed by lowercased street name.
 */
export function parseZtoeSettlementHousesTableHtml(
  html: string
): Map<string, ZtoeHouseLookupResult[]>;
export function parseZtoeSettlementHousesTableHtml(
  settlementId: string,
  streets: ZtoeStreetOption[],
  html: string
): Record<string, ZtoeHouseLookupResult[]>;
export function parseZtoeSettlementHousesTableHtml(
  settlementIdOrHtml: string,
  streets?: ZtoeStreetOption[],
  maybeHtml?: string
): Map<string, ZtoeHouseLookupResult[]> | Record<string, ZtoeHouseLookupResult[]> {
  // Single-argument overload: returns Map<streetNameLower, ZtoeHouseLookupResult[]>
  if (streets === undefined && maybeHtml === undefined) {
    const html = settlementIdOrHtml;
    const streetMap = new Map<string, ZtoeHouseLookupResult[]>();
    if (!html || typeof html !== 'string') return streetMap;

    const scheduleSectionIdx = html.indexOf('Графіки погодинних відключень');
    const addressSectionHtml = scheduleSectionIdx >= 0 ? html.slice(0, scheduleSectionIdx) : html;
    const trRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let trMatch: RegExpExecArray | null;

    let streetColIdx = 2;
    let houseColIdx = 3;
    let queueColIdx = 4;
    let subqueueColIdx = 5;
    let noteColIdx = 6;
    const metadataCols = new Set<number>([0, 1, 2, 6]);

    while ((trMatch = trRegex.exec(addressSectionHtml)) !== null) {
      const rowHtml = trMatch[1];
      if (/<input\b/i.test(rowHtml) || /<select\b/i.test(rowHtml)) continue;
      const cellRegex = /<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
      const cells: string[] = [];
      let cellMatch: RegExpExecArray | null;
      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        cells.push(stripHtmlTags(cellMatch[1]));
      }
      if (cells.length < 5) continue;

      const firstCellLower = (cells[0] || '').toLowerCase();
      const isHeaderRow =
        /<th\b/i.test(rowHtml) ||
        firstCellLower === 'рем' ||
        firstCellLower === 'будинок' ||
        firstCellLower === 'будинки' ||
        firstCellLower.includes('вулиц');

      if (isHeaderRow) {
        metadataCols.clear();
        noteColIdx = -1;
        cells.forEach((c, idx) => {
          const cl = c.toLowerCase();
          if (cl.includes('вулиц')) {
            streetColIdx = idx;
            metadataCols.add(idx);
          } else if (cl.includes('буд') || cl.includes('дом')) {
            houseColIdx = idx;
          } else if (cl.includes('підчерг')) {
            subqueueColIdx = idx;
          } else if (cl.includes('черг')) {
            queueColIdx = idx;
          } else if (cl.includes('примітк')) {
            noteColIdx = idx;
            metadataCols.add(idx);
          } else if (cl === 'рем' || cl.includes('населений')) {
            metadataCols.add(idx);
          }
        });
        continue;
      }

      const streetRaw = decodeHtmlEntities(cells[streetColIdx] || '').trim();
      const houseVal = decodeHtmlEntities(cells[houseColIdx] || '').trim();
      if (!streetRaw || !houseVal) continue;

      const queueRaw = cells[queueColIdx] ?? '';
      const subqueueRaw = cells[subqueueColIdx] ?? '';
      const combinedMatch = `${queueRaw}.${subqueueRaw}`.match(/^([1-6])\.([1-2])$/);
      const directMatch = queueRaw.match(/^([1-6])\.([1-2])$/);
      let normalizedQueue = '';
      let statusText: string | undefined;

      if (directMatch) {
        normalizedQueue = `${directMatch[1]}.${directMatch[2]}`;
      } else if (combinedMatch) {
        normalizedQueue = `${combinedMatch[1]}.${combinedMatch[2]}`;
      }

      const uniqueNonNumericParts: string[] = [];
      cells.forEach((cellVal, idx) => {
        if (idx === houseColIdx || metadataCols.has(idx) || idx === noteColIdx) return;
        const trimmed = cellVal.trim();
        if (trimmed.length > 0 && !/^[1-6](\.[1-2])?$/.test(trimmed) && trimmed !== '-') {
          if (!uniqueNonNumericParts.includes(trimmed)) {
            uniqueNonNumericParts.push(trimmed);
          }
        }
      });

      if (uniqueNonNumericParts.length > 0) {
        statusText = uniqueNonNumericParts.join(' ').trim();
      }

      const key = streetRaw.toLowerCase();
      const list = streetMap.get(key) || [];
      const houseTokens = houseVal.includes(',')
        ? houseVal.split(',').map((h) => h.trim()).filter(Boolean)
        : [houseVal.trim()];

      for (const hToken of houseTokens) {
        if (!list.some((item) => item.house === hToken)) {
          list.push({
            house: hToken,
            queue: normalizedQueue,
            rawQueueCell: queueRaw,
            rawSubqueueCell: subqueueRaw,
            ...(statusText ? { statusText } : {}),
          });
        }
      }
      streetMap.set(key, list);
    }

    return streetMap;
  }

  // 3-argument overload: indexes into dynamicHousesByStreetId by the (merged) street option id
  const html = maybeHtml || '';
  const indexedByStreetId: Record<string, ZtoeHouseLookupResult[]> = {};
  if (!html || !streets || streets.length === 0) return indexedByStreetId;

  // One option per StreetKey (the caller passes merged options). Names are compared by key equality;
  // the only tolerance is a table that omits the street type, which matches a UNIQUE option whose
  // key differs from it by that type alone (so "вул. X" never matches "пров. X").
  const streetByKey = new Map<string, ZtoeStreetOption>();
  const keyById = new Map<string, string>();
  const idsByBare = new Map<string, ZtoeStreetOption[]>();
  for (const st of streets) {
    const key = StreetKey.of(st.nameUk);
    if (!key) continue;
    if (!streetByKey.has(key)) streetByKey.set(key, st);
    keyById.set(st.id, key);
    const bare = bareStreetKey(key);
    if (bare) idsByBare.set(bare, [...(idsByBare.get(bare) ?? []), st]);
  }
  const matchStreet = (rawName: string): ZtoeStreetOption | undefined => {
    const key = StreetKey.of(rawName);
    const exact = streetByKey.get(key);
    if (exact || !key) return exact;
    const bare = bareStreetKey(key);
    const candidates = bare ? idsByBare.get(bare) : undefined;
    if (candidates && candidates.length === 1 && (key === bare || keyById.get(candidates[0].id) === bare)) return candidates[0];
    return undefined;
  };

  const scheduleSectionIdx = html.indexOf('Графіки погодинних відключень');
  const addressSectionHtml = scheduleSectionIdx >= 0 ? html.slice(0, scheduleSectionIdx) : html;

  const trRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;

  let streetColIdx = 2;
  let houseColIdx = 3;
  let queueColIdx = 4;
  let subqueueColIdx = 5;
  let noteColIdx = 6;
  const metadataCols = new Set<number>([0, 1, 2, 6]);

  const rowsByStreetId = new Map<string, ZtoeHouseLookupResult[]>();

  while ((trMatch = trRegex.exec(addressSectionHtml)) !== null) {
    const rowHtml = trMatch[1];
    if (/<input\b/i.test(rowHtml) || /<select\b/i.test(rowHtml)) continue;

    const cellRegex = /<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      cells.push(stripHtmlTags(cellMatch[1]));
    }

    if (cells.length < 5) continue;

    const firstCellLower = (cells[0] || '').toLowerCase();
    const isHeaderRow =
      /<th\b/i.test(rowHtml) ||
      firstCellLower === 'рем' ||
      firstCellLower === 'будинок' ||
      firstCellLower === 'будинки' ||
      firstCellLower.includes('вулиц');

    if (isHeaderRow) {
      metadataCols.clear();
      noteColIdx = -1;
      cells.forEach((c, idx) => {
        const cl = c.toLowerCase();
        if (cl.includes('вулиц')) {
          streetColIdx = idx;
          metadataCols.add(idx);
        } else if (cl.includes('буд') || cl.includes('дом')) {
          houseColIdx = idx;
        } else if (cl.includes('підчерг')) {
          subqueueColIdx = idx;
        } else if (cl.includes('черг')) {
          queueColIdx = idx;
        } else if (cl.includes('примітк')) {
          noteColIdx = idx;
          metadataCols.add(idx);
        } else if (cl === 'рем' || cl.includes('населений')) {
          metadataCols.add(idx);
        }
      });
      continue;
    }

    const streetRaw = (cells[streetColIdx] || '').trim();
    const houseVal = (cells[houseColIdx] || '').trim();
    if (!streetRaw || !houseVal) continue;

    const matchedStreet = matchStreet(streetRaw);
    if (!matchedStreet) continue;

    const queueRaw = cells[queueColIdx] ?? '';
    const subqueueRaw = cells[subqueueColIdx] ?? '';

    const combinedMatch = `${queueRaw}.${subqueueRaw}`.match(/^([1-6])\.([1-2])$/);
    const directMatch = queueRaw.match(/^([1-6])\.([1-2])$/);

    let normalizedQueue = '';
    let statusText: string | undefined;

    if (directMatch) {
      normalizedQueue = `${directMatch[1]}.${directMatch[2]}`;
    } else if (combinedMatch) {
      normalizedQueue = `${combinedMatch[1]}.${combinedMatch[2]}`;
    }

    const uniqueNonNumericParts: string[] = [];
    cells.forEach((cellVal, idx) => {
      if (idx === houseColIdx || metadataCols.has(idx) || idx === noteColIdx) return;
      const trimmed = cellVal.trim();
      if (trimmed.length > 0 && !/^[1-6](\.[1-2])?$/.test(trimmed) && trimmed !== '-') {
        if (!uniqueNonNumericParts.includes(trimmed)) {
          uniqueNonNumericParts.push(trimmed);
        }
      }
    });

    if (uniqueNonNumericParts.length > 0) {
      statusText = uniqueNonNumericParts.join(' ').trim();
    }

    const houseTokens = houseVal.includes(',')
      ? houseVal.split(',').map((h) => h.trim()).filter(Boolean)
      : [houseVal.trim()];

    const list = rowsByStreetId.get(matchedStreet.id) ?? [];
    for (const hToken of houseTokens) {
      if (!HouseKey.of(hToken)) continue;
      list.push({
        house: hToken,
        queue: normalizedQueue,
        rawQueueCell: queueRaw,
        rawSubqueueCell: subqueueRaw,
        ...(statusText ? { statusText } : {}),
      });
    }
    rowsByStreetId.set(matchedStreet.id, list);
  }

  const now = Date.now();
  for (const [streetId, rows] of rowsByStreetId.entries()) {
    const sorted = mergeHouseLists([rows]);
    if (sorted.length > 0) {
      indexedByStreetId[streetId] = sorted;
      dynamicHousesByStreetId[streetId] = sorted;
      houseCacheUpdatedAtByStreetId[streetId] = now;
    }
  }

  return indexedByStreetId;
}

async function postZtoeLookupForm(bodyParams: Record<string, string>, siteUrl?: string): Promise<string | null> {
  if (typeof fetch === 'undefined') return null;
  try {
    const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
    const targetEndpoint =
      !siteUrl || siteUrl.includes('ztoe.com.ua')
        ? isBrowser
          ? '/proxy-ztoe/unhooking-search.php'
          : 'https://www.ztoe.com.ua/unhooking-search.php'
        : siteUrl;
    const params = new URLSearchParams(bodyParams);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(targetEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const win1251Text = new TextDecoder('windows-1251').decode(buffer);
    return win1251Text.includes('Оберіть') || win1251Text.includes('Черга') || win1251Text.includes('Будинки')
      ? win1251Text
      : new TextDecoder('utf-8').decode(buffer);
  } catch {
    return null;
  }
}

export async function fetchRemsFromZtoe(
  siteUrl?: string,
  forceRefresh = false
): Promise<ZtoeRemOption[]> {
  ensureHydrated();
  if (!forceRefresh && dynamicRems && dynamicRems.length > 0) {
    return dynamicRems;
  }
  const html = await postZtoeLookupForm({}, siteUrl);
  if (html) {
    const parsed = parseZtoeRemOptionsHtml(html);
    if (parsed.length > 0) {
      dynamicRems = parsed;
      persistAddressIndexToStorage();
      return parsed;
    }
  }
  return getRems();
}

export async function fetchSettlementsForRem(
  remId: string,
  siteUrl?: string,
  forceRefresh = false
): Promise<ZtoeSettlementOption[]> {
  ensureHydrated();
  if (!forceRefresh && dynamicSettlementsByRemId[remId] && dynamicSettlementsByRemId[remId].length > 5) {
    return dynamicSettlementsByRemId[remId];
  }
  const remObj = getRems().find((r) => r.id === remId);
  if (remObj?.ztoeRemId) {
    const html = await postZtoeLookupForm({ rem_id: remObj.ztoeRemId }, siteUrl);
    if (html) {
      const parsedRems = parseZtoeRemOptionsHtml(html);
      if (parsedRems.length > 0) {
        dynamicRems = parsedRems;
      }
      const parsed = parseZtoeSettlementOptionsHtml(remId, html);
      if (parsed.length > 0) {
        dynamicSettlementsByRemId[remId] = parsed;
        persistAddressIndexToStorage();
        return parsed;
      }
    }
  }
  return getSettlementsForRem(remId);
}

export async function fetchStreetsForSettlement(
  remId: string,
  settlementId: string,
  siteUrl?: string,
  forceRefresh = false
): Promise<ZtoeStreetOption[]> {
  ensureHydrated();
  const cachedStreets = dynamicStreetsBySettlementId[settlementId];
  const hasBulkIndexedHouses =
    cachedStreets &&
    cachedStreets.length > 15 &&
    cachedStreets.some((st) => (dynamicHousesByStreetId[st.id]?.length || 0) > 0);

  if (!forceRefresh && hasBulkIndexedHouses) {
    return cachedStreets;
  }

  const inflightKey = `${remId}::${settlementId}`;
  const existingPromise = inFlightSettlementPromises.get(inflightKey);
  if (existingPromise) {
    return existingPromise;
  }

  const promise = (async () => {
    try {
      const remObj =
        getRems().find((r) => r.id === remId) ||
        ZTOE_REM_OPTIONS.find((r) => r.id === remId);
      const settlementObj = findSettlementById(settlementId);
      if (remObj?.ztoeRemId && settlementObj?.ztoeNaspunktId) {
        const html = await postZtoeLookupForm(
          {
            rem_id: remObj.ztoeRemId,
            naspunkt_id: settlementObj.ztoeNaspunktId,
            all: '1',
          },
          siteUrl
        );
        if (html) {
          const parsedRems = parseZtoeRemOptionsHtml(html);
          if (parsedRems.length > 0) {
            dynamicRems = parsedRems;
          }
          const parsedSettlements = parseZtoeSettlementOptionsHtml(remId, html);
          if (parsedSettlements.length > 0) {
            dynamicSettlementsByRemId[remId] = parsedSettlements;
          }
          const parsedStreets = parseZtoeStreetOptionsHtml(settlementId, html);
          if (parsedStreets.length > 0) {
            dynamicStreetsBySettlementId[settlementId] = parsedStreets;
            parseZtoeSettlementHousesTableHtml(settlementId, parsedStreets, html);
            persistAddressIndexToStorage();
            return parsedStreets;
          }
        }
      }
      return getStreetsForSettlement(settlementId);
    } finally {
      inFlightSettlementPromises.delete(inflightKey);
    }
  })();

  inFlightSettlementPromises.set(inflightKey, promise);
  return promise;
}

/** Houses of a street: one request per ztoe `vulica_id` of the merged street, unioned by HouseKey. */
export async function fetchHousesForStreet(
  remId: string,
  settlementId: string,
  streetId: string,
  siteUrl?: string,
  forceRefresh = false
): Promise<ZtoeHouseLookupResult[]> {
  ensureHydrated();
  if (!streetId) return [];

  const streetObj = findStreetById(streetId);
  const primaryId = streetObj?.id ?? streetId;

  const existingHouses = getHousesForStreet(primaryId);
  const updatedAt = houseCacheUpdatedAtByStreetId[primaryId] || 0;
  if (
    existingHouses.length > 0 &&
    (!forceRefresh || Date.now() - updatedAt < FRESH_HOUSE_CACHE_TTL_MS)
  ) {
    recordRecentHouseStreet(primaryId);
    return existingHouses;
  }

  const inflightKey = `${remId}::${settlementId}`;
  const inflightSettlement = inFlightSettlementPromises.get(inflightKey);
  if (inflightSettlement) {
    await inflightSettlement;
    const afterInflight = getHousesForStreet(primaryId);
    if (afterInflight.length > 0) {
      recordRecentHouseStreet(primaryId);
      return afterInflight;
    }
  }

  const remObj =
    getRems().find((r) => r.id === remId) ||
    ZTOE_REM_OPTIONS.find((r) => r.id === remId);
  const settlementObj = findSettlementById(settlementId);
  const vulicaIds = streetObj?.ztoeVulicaIds ?? (streetObj?.ztoeVulicaId ? [streetObj.ztoeVulicaId] : []);
  if (streetObj && remObj?.ztoeRemId && settlementObj?.ztoeNaspunktId && vulicaIds.length > 0) {
    const lists: ZtoeHouseLookupResult[][] = [];
    for (const vulicaId of vulicaIds) {
      // Note: Do NOT pass `all: '1'` when `vulica_id` is specified, because `all=1` causes ZTOE
      // to ignore `vulica_id` and return all streets in the settlement instead of the selected street.
      const html = await postZtoeLookupForm(
        {
          rem_id: remObj.ztoeRemId,
          naspunkt_id: settlementObj.ztoeNaspunktId,
          vulica_id: vulicaId,
        },
        siteUrl
      );
      if (!html) continue;
      const parsedRows = parseZtoeAddressLookupTableHtml(html, streetObj.nameUk);
      if (parsedRows.length > 0) lists.push(parsedRows);
    }
    if (lists.length > 0) {
      const merged = mergeHouseLists(lists);
      for (const id of streetObj.allIds) if (id !== primaryId) delete dynamicHousesByStreetId[id];
      dynamicHousesByStreetId[primaryId] = merged;
      houseCacheUpdatedAtByStreetId[primaryId] = Date.now();
      recordRecentHouseStreet(primaryId);
      persistAddressIndexToStorage();
      return merged;
    }
  }
  return getHousesForStreet(primaryId);
}

/**
 * Prefetches and indexes all REMs, cities/settlements across all REMs, active/default city streets,
 * and ALL houses for every street in the active/default city in the background on app launch,
 * persisting the index to disk cache so dropdown lists in the "?" Address Lookup window open with zero delay.
 */
export async function prefetchAddressIndexInBackground(
  siteUrl?: string,
  savedQuery?: SelectedAddressQuery | null,
  forceRefresh = false
): Promise<void> {
  ensureHydrated();
  const activeRemId = savedQuery?.remId || 'zhytomyr';
  const activeSettlementId = savedQuery?.settlementId || 'zt_city';

  // Priority 1: Single-request bulk fetch for 'zt_city' (with all=1), which returns and indexes:
  // - All 19 REMs (<select name="rem_id">)
  // - All 103 Settlements of Zhytomyr REM (<select name="naspunkt_id">)
  // - All 966 Streets of Zhytomyr city (<select name="vulica_id">)
  // - All 20,488 Houses across all 966 Streets of Zhytomyr city (7-column table)
  await fetchStreetsForSettlement('zhytomyr', 'zt_city', siteUrl, forceRefresh);

  if (activeRemId !== 'zhytomyr') {
    await fetchSettlementsForRem(activeRemId, siteUrl, forceRefresh);
  }

  if (activeSettlementId && (activeRemId !== 'zhytomyr' || activeSettlementId !== 'zt_city')) {
    await fetchStreetsForSettlement(activeRemId, activeSettlementId, siteUrl, forceRefresh);
  }

  if (savedQuery?.streetId) {
    await fetchHousesForStreet(activeRemId, activeSettlementId, savedQuery.streetId, siteUrl, false);
  }

  const allRems = await fetchRemsFromZtoe(siteUrl, false);
  const priorityRems = Array.from(new Set(['zhytomyr', activeRemId]));

  // Priority 2: Bounded parallel prefetch (4 workers) for all remaining REMs' settlements + each REM's primary city streets & houses
  const remainingRems = allRems.filter((r) => !priorityRems.includes(r.id));
  const concurrency = 4;
  let cursor = 0;

  const runWorker = async () => {
    while (cursor < remainingRems.length) {
      const idx = cursor++;
      const rem = remainingRems[idx];
      if (!rem) break;
      const settlements = await fetchSettlementsForRem(rem.id, siteUrl, forceRefresh);
      const primarySettlement = settlements[0];
      if (primarySettlement?.id) {
        await fetchStreetsForSettlement(rem.id, primarySettlement.id, siteUrl, false);
      }
    }
  };

  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(1, remainingRems.length)) },
    () => runWorker()
  );
  await Promise.all(workers);

  persistAddressIndexToStorage();
}
