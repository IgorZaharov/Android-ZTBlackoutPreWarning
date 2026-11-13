/**
 * ZTOE (Zhytomyroblenergo) Schedule Parser & Schedule Engine
 * Supports live scraping of https://www.ztoe.com.ua/unhooking-search.php
 * with 48 half-hour slot resolution matching iOS ZtoeParser.swift 100%.
 */
import { BlackoutSlot, DaySchedule, EmergencyOutageInfo, QueueOption } from '../types';
import validUrlsList from '../../valid-urls.json';
import {
  atStartOfDay,
  formatLocalDate,
  localDateTimeOf,
  parseLocalDate,
  plusDays,
  type LocalDate,
  type LocalDateTime,
} from '../core/localTime';
import { buildPlanned, dayView, minutesBetween, status as engineStatus } from '../core/outageEngine';
import { makeOutage, type Outage } from '../core/outageModels';
import { SiteStateResolver, type FetchFailure, type SiteState } from '../core/siteState';
import { extractSiteNotice } from '../core/siteNotice';
import { ScheduleCache, getScheduleCache } from './scheduleCache';

export const QUEUES: QueueOption[] = [
  { id: '1.1', group: 1, subgroup: 1, label: 'Черга 1.1' },
  { id: '1.2', group: 1, subgroup: 2, label: 'Черга 1.2' },
  { id: '2.1', group: 2, subgroup: 1, label: 'Черга 2.1' },
  { id: '2.2', group: 2, subgroup: 2, label: 'Черга 2.2' },
  { id: '3.1', group: 3, subgroup: 1, label: 'Черга 3.1' },
  { id: '3.2', group: 3, subgroup: 2, label: 'Черга 3.2' },
  { id: '4.1', group: 4, subgroup: 1, label: 'Черга 4.1' },
  { id: '4.2', group: 4, subgroup: 2, label: 'Черга 4.2' },
  { id: '5.1', group: 5, subgroup: 1, label: 'Черга 5.1' },
  { id: '5.2', group: 5, subgroup: 2, label: 'Черга 5.2' },
  { id: '6.1', group: 6, subgroup: 1, label: 'Черга 6.1' },
  { id: '6.2', group: 6, subgroup: 2, label: 'Черга 6.2' }
];

export const DEFAULT_ZTOE_URL = 'https://www.ztoe.com.ua/unhooking-search.php';

export const VALID_URLS: string[] = Array.isArray(validUrlsList)
  ? validUrlsList
  : ['https://www.ztoe.com.ua/unhooking-search.php', 'https://example.com'];

/**
 * Helper to get Kyiv date components (YYYY, MM, DD)
 */
export function getKyivDateParts(date: Date = new Date()): { year: number; month: number; day: number; dateStr: string } {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Kyiv',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const formatted = formatter.format(date); // "YYYY-MM-DD"
    const [y, m, d] = formatted.split('-').map(Number);
    if (y && m && d) {
      return { year: y, month: m, day: d, dateStr: formatted };
    }
  } catch {
    // fallback
  }
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return { year: y, month: m, day: d, dateStr };
}

/**
 * Standard 48 half-hour fallback schedule for a queue
 */
export function generateTypicalScheduleForQueue(queueId: string, date: Date): BlackoutSlot[] {
  const { dateStr } = getKyivDateParts(date);
  const [groupStr, subStr] = queueId.split('.');
  const group = parseInt(groupStr, 10) || 1;
  const sub = parseInt(subStr, 10) || 1;
  const shift = ((group - 1) * 3 + (sub - 1) * 2) % 24;

  const slots: BlackoutSlot[] = [];

  for (let index = 0; index < 48; index++) {
    const startTotalMin = index * 30;
    const endTotalMin = (index + 1) * 30;
    const startH = Math.floor(startTotalMin / 60);
    const startM = startTotalMin % 60;
    const endH = Math.floor(endTotalMin / 60);
    const endM = endTotalMin % 60;

    const cycleHour = (startH + shift) % 24;
    const isOff =
      (cycleHour >= 2 && cycleHour <= 5) ||
      (cycleHour >= 12 && cycleHour <= 15) ||
      (cycleHour >= 20 && cycleHour <= 23);

    const startStr = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;
    const endStr = endH >= 24 ? '24:00' : `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

    slots.push({
      id: `${dateStr}_${startStr}_Q${queueId}`,
      startHour: startH,
      endHour: endH,
      startMinute: startM,
      endMinute: endM,
      startTimeStr: startStr,
      endTimeStr: endStr,
      status: isOff ? 'POWER_OFF' : 'POWER_ON'
    });
  }

  return slots;
}

// =========================================================================================
// CRITICAL SECTION — DO NOT MODIFY UNLESS EXPLICITLY REQUESTED
// Real ZTOE HTML Table Parser & URL Validator for https://www.ztoe.com.ua/unhooking-search.php
// =========================================================================================

export function isValidZtoeUrl(url: string): boolean {
  const trimmed = (url || '').trim().replace(/\/+$/, '');
  if (!trimmed) return false;
  return VALID_URLS.some(valid => valid.trim().replace(/\/+$/, '').toLowerCase() === trimmed.toLowerCase());
}

function stripTags(htmlStr: string): string {
  return htmlStr
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface ParsedHtmlTable {
  rawHtml: string;
  rows: { rawHtml: string; cells: { attrs: string; text: string }[] }[];
  fullText: string;
}

function extractLeafTables(html: string): ParsedHtmlTable[] {
  // Match leaf <table>...</table> blocks that do NOT contain nested <table tags
  const leafTableRegex = /<table\b[^>]*>(?:(?!<table\b)[\s\S])*?<\/table>/gi;
  const matches = html.match(leafTableRegex) || [];
  const results: ParsedHtmlTable[] = [];

  for (const tableHtml of matches) {
    const trMatches = tableHtml.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || [];
    if (trMatches.length < 12) continue;

    const rows = trMatches.map(trHtml => {
      const cellMatches = trHtml.match(/<(?:td|th)\b([^>]*)>([\s\S]*?)<\/(?:td|th)>/gi) || [];
      const cells = cellMatches.map(cellHtml => {
        const m = cellHtml.match(/^<(?:td|th)\b([^>]*)>([\s\S]*?)<\/(?:td|th)>$/i);
        const attrs = m ? m[1] : '';
        const inner = m ? m[2] : '';
        return {
          attrs,
          text: stripTags(inner)
        };
      });
      return { rawHtml: trHtml, cells };
    });

    results.push({
      rawHtml: tableHtml,
      rows,
      fullText: stripTags(tableHtml)
    });
  }

  return results;
}

function parseLeafTableForQueue(
  table: ParsedHtmlTable,
  targetQueue: string,
  dateStr: string
): BlackoutSlot[] | null {
  const targetRow = table.rows.find(row => {
    const firstThree = row.cells.slice(0, 3);
    return firstThree.some(c => {
      const t = c.text.trim();
      return (
        t === targetQueue ||
        t === `Черга ${targetQueue}` ||
        t === `Черга ${targetQueue}.` ||
        t.toLowerCase() === `${targetQueue} черга`
      );
    });
  });

  if (!targetRow || targetRow.cells.length < 24) {
    return null;
  }

  // Filter out thin 3pt separator cells if present, then take the last 48 (or 24) schedule cells
  const nonLabelCells = targetRow.cells.slice(1).filter(c => {
    const cleanAttr = c.attrs.toLowerCase().replace(/\s+/g, '');
    return !cleanAttr.includes('width:3pt') && !cleanAttr.includes('width:1pt');
  });

  let slotCells = nonLabelCells;
  if (nonLabelCells.length >= 48) {
    slotCells = nonLabelCells.slice(-48);
  } else if (targetRow.cells.length >= 48) {
    slotCells = targetRow.cells.slice(-48);
  } else if (nonLabelCells.length >= 24) {
    slotCells = nonLabelCells.slice(-24);
  } else {
    slotCells = targetRow.cells.slice(-24);
  }

  const totalSlots = slotCells.length;
  const minutesPerSlot = Math.floor(1440 / totalSlots);

  return slotCells.map((cell, index) => {
    const startTotalMin = index * minutesPerSlot;
    const endTotalMin = (index + 1) * minutesPerSlot;
    const startH = Math.floor(startTotalMin / 60);
    const startM = startTotalMin % 60;
    const endH = Math.floor(endTotalMin / 60);
    const endM = endTotalMin % 60;

    const startStr = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;
    const endStr = endH >= 24 ? '24:00' : `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

    const attr = cell.attrs.toLowerCase();
    const text = cell.text.toLowerCase();

    const isOff =
      attr.includes('#ff3333') ||
      attr.includes('#ff3b30') ||
      attr.includes('#ff0000') ||
      attr.includes('background:red') ||
      attr.includes('background: red') ||
      attr.includes('background-color:red') ||
      attr.includes('background-color: red') ||
      attr.includes('rgb(255, 51, 51)') ||
      attr.includes('rgb(255,51,51)') ||
      attr.includes('rgb(255, 0, 0)') ||
      attr.includes('rgb(255,0,0)') ||
      attr.includes('danger') ||
      text.includes('вимк') ||
      text.includes('відкл') ||
      text === 'в' ||
      text === '-';

    return {
      id: `${dateStr}_${startStr}_Q${targetQueue}`,
      startHour: startH,
      endHour: endH,
      startMinute: startM,
      endMinute: endM,
      startTimeStr: startStr,
      endTimeStr: endStr,
      status: isOff ? 'POWER_OFF' : 'POWER_ON'
    };
  });
}

function matchesHeaderDate(
  headerText: string,
  target: { day: number; month: number; year: number }
): boolean {
  const fullDateRegex = /(?<!\d)(\d{1,2})\.(\d{1,2})\.(\d{4})(?!\d)/g;
  const fullMatches = Array.from(headerText.matchAll(fullDateRegex));
  if (fullMatches.length > 0) {
    return fullMatches.some(m => {
      const d = parseInt(m[1], 10);
      const mo = parseInt(m[2], 10);
      const y = parseInt(m[3], 10);
      return d === target.day && mo === target.month && y === target.year;
    });
  }
  const shortDateRegex = /(?<!\d)(\d{1,2})\.(\d{1,2})(?!\.\d|\d)/g;
  return Array.from(headerText.matchAll(shortDateRegex)).some(m => {
    const d = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    return d === target.day && mo === target.month;
  });
}

export interface FullZtoeParseResult {
  todaySlots: BlackoutSlot[] | null;
  tomorrowSlots: BlackoutSlot[] | null;
  hasTodayTable: boolean;
  hasTomorrowTable: boolean;
}

export function parseZtoeHtmlFull(
  html: string,
  targetQueue: string,
  baseDate: Date = new Date()
): FullZtoeParseResult {
  const todayParts = getKyivDateParts(baseDate);
  const tomorrowDate = new Date(baseDate.getTime() + 86400000);
  const tomorrowParts = getKyivDateParts(tomorrowDate);

  const leafTables = extractLeafTables(html);

  let todayTable: ParsedHtmlTable | null = null;
  let tomorrowTable: ParsedHtmlTable | null = null;

  for (const table of leafTables) {
    if (!table.fullText.includes('1.1') || !table.fullText.includes('6.2')) {
      continue;
    }
    const headerText = table.rows
      .slice(0, 2)
      .map(r => r.cells.map(c => c.text).join(' '))
      .join(' ');

    const matchesToday = matchesHeaderDate(headerText, todayParts);
    const matchesTomorrow = matchesHeaderDate(headerText, tomorrowParts);

    if (matchesToday && !todayTable) {
      todayTable = table;
    } else if (matchesTomorrow && !tomorrowTable) {
      tomorrowTable = table;
    }
  }

  const todaySlots = todayTable
    ? parseLeafTableForQueue(todayTable, targetQueue, todayParts.dateStr)
    : null;

  const tomorrowSlots = tomorrowTable
    ? parseLeafTableForQueue(tomorrowTable, targetQueue, tomorrowParts.dateStr)
    : null;

  return {
    todaySlots,
    tomorrowSlots,
    hasTodayTable: todaySlots !== null,
    hasTomorrowTable: tomorrowSlots !== null
  };
}

/**
 * Parse raw HTML from ztoe.com.ua table for either Today or Tomorrow
 */
export function parseZtoeHtml(
  html: string,
  targetQueue: string,
  date: Date = new Date(),
  isTomorrow: boolean = false
): BlackoutSlot[] {
  const baseDate = isTomorrow ? new Date(date.getTime() - 86400000) : date;
  const full = parseZtoeHtmlFull(html, targetQueue, baseDate);
  if (isTomorrow) {
    return full.tomorrowSlots || generateTypicalScheduleForQueue(targetQueue, date);
  }
  return full.todaySlots || generateTypicalScheduleForQueue(targetQueue, date);
}

/**
 * Shared 24-hour x 2 half-hour chart block generator used by BOTH MainView and WidgetSimulator
 */
export interface HourChartBlock {
  hour: number;
  half1Off: boolean;
  half2Off: boolean;
}

export function getChartHalfHourBlocks(slots: BlackoutSlot[]): HourChartBlock[] {
  const is48 = slots.length >= 48;
  const blocks: HourChartBlock[] = [];
  for (let hour = 0; hour < 24; hour++) {
    const half1Off = is48
      ? slots[hour * 2]?.status === 'POWER_OFF'
      : slots[hour]?.status === 'POWER_OFF';
    const half2Off = is48
      ? slots[hour * 2 + 1]?.status === 'POWER_OFF'
      : slots[hour]?.status === 'POWER_OFF';
    blocks.push({ hour, half1Off, half2Off });
  }
  return blocks;
}

// =========================================================================================
// END OF CRITICAL SECTION — DO NOT MODIFY UNLESS EXPLICITLY REQUESTED
// =========================================================================================

// =========================================================================================
// Everything below is the 1.4.0 layer: all-queue parsing, site-state classification, the
// schedule cache (a failed fetch never wipes it) and the legacy helpers kept for the views.
// Mirrors android/.../data/parser/ZtoeParser.kt + ScheduleRepository.kt.
// =========================================================================================

const p2 = (n: number): string => String(n).padStart(2, '0');

/** Calendar parts of a Kyiv LocalDate, in the shape the table matcher wants. */
function partsOfDate(date: LocalDate): { year: number; month: number; day: number; dateStr: string } {
  const dateStr = formatLocalDate(date);
  const [year, month, day] = dateStr.split('-').map(Number);
  return { year, month, day, dateStr };
}

/** The 48 (or 24) cells of one day as `BlackoutSlot`s, like `ScheduleRepository.decodeSlotsCached`. */
export function cellsToSlots(cells: readonly boolean[], queueId: string, dateStr: string): BlackoutSlot[] {
  const total = cells.length;
  if (total === 0) return [];
  const minutesPerSlot = Math.floor(1440 / total);
  return cells.map((off, index) => {
    const startTotal = index * minutesPerSlot;
    const endTotal = (index + 1) * minutesPerSlot;
    const startH = Math.floor(startTotal / 60);
    const endH = Math.floor(endTotal / 60);
    const startStr = `${p2(startH)}:${p2(startTotal % 60)}`;
    const endStr = endH >= 24 ? '24:00' : `${p2(endH)}:${p2(endTotal % 60)}`;
    return {
      id: `${dateStr}_${startStr}_Q${queueId}`,
      startHour: startH,
      endHour: endH,
      startMinute: startTotal % 60,
      endMinute: endTotal % 60,
      startTimeStr: startStr,
      endTimeStr: endStr,
      status: off ? 'POWER_OFF' : 'POWER_ON',
    };
  });
}

/** True where power is off. */
export function slotsToOffCells(slots: readonly BlackoutSlot[]): boolean[] {
  return slots.map((s) => s.status === 'POWER_OFF');
}

export interface ParsedQueueSchedule {
  today: BlackoutSlot[];
  tomorrow: BlackoutSlot[] | null;
}

/**
 * Parses all 12 queues of the page in one pass (the table lookup runs once), like
 * `ZtoeParser.parseAllQueuesSinglePass`. Empty map when the page has no table dated [today].
 */
export function parseZtoeHtmlAllQueues(html: string, today: LocalDate): Map<string, ParsedQueueSchedule> {
  const todayParts = partsOfDate(today);
  const tomorrowParts = partsOfDate(plusDays(today, 1));
  const result = new Map<string, ParsedQueueSchedule>();

  let todayTable: ParsedHtmlTable | null = null;
  let tomorrowTable: ParsedHtmlTable | null = null;
  for (const table of extractLeafTables(html)) {
    if (!table.fullText.includes('1.1') || !table.fullText.includes('6.2')) continue;
    const headerText = table.rows
      .slice(0, 2)
      .map((r) => r.cells.map((c) => c.text).join(' '))
      .join(' ');
    if (matchesHeaderDate(headerText, todayParts) && !todayTable) todayTable = table;
    else if (matchesHeaderDate(headerText, tomorrowParts) && !tomorrowTable) tomorrowTable = table;
  }
  if (!todayTable) return result;

  for (const q of QUEUES) {
    const todaySlots = parseLeafTableForQueue(todayTable, q.id, todayParts.dateStr);
    if (!todaySlots) continue;
    const tomorrowSlots = tomorrowTable ? parseLeafTableForQueue(tomorrowTable, q.id, tomorrowParts.dateStr) : null;
    result.set(q.id, { today: todaySlots, tomorrow: tomorrowSlots });
  }
  return result;
}

// ---------------------------------------------------------------------------------------------
// Fetching with site-state classification
// ---------------------------------------------------------------------------------------------

const FETCH_TIMEOUT_MS = 8000;

async function fetchHtmlDecoded(targetUrl: string, timeoutMs: number = FETCH_TIMEOUT_MS, force: boolean = false): Promise<string> {
  const proxyUrl = targetUrl.includes('ztoe.com.ua')
    ? `/proxy-ztoe/unhooking-search.php`
    : targetUrl;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(proxyUrl, {
      signal: controller.signal,
      headers: { Accept: 'text/html' },
      ...(force ? { cache: 'no-store' as RequestCache } : {})
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`HTTP_${res.status}`);
    }

    const buffer = await res.arrayBuffer();
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    // ztoe.com.ua uses windows-1251 encoding
    if (contentType.includes('utf-8')) {
      return new TextDecoder('utf-8').decode(buffer);
    }
    const win1251Text = new TextDecoder('windows-1251').decode(buffer);
    if (win1251Text.includes('Черга') || win1251Text.includes('windows-1251') || targetUrl.includes('ztoe.com.ua')) {
      return win1251Text;
    }
    return new TextDecoder('utf-8').decode(buffer);
  } finally {
    clearTimeout(timeout);
  }
}

/** Maps a fetch error to the platform-neutral [FetchFailure] (spec/SITE_STATE.md section 2). */
export function classifyFetchFailure(error: unknown): FetchFailure {
  const name = error instanceof Error ? error.name : '';
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (name === 'AbortError' || name === 'TimeoutError' || message.includes('timeout') || message.includes('timed out') || message.includes('abort')) return 'TIMEOUT';
  if (/^http[_ ]\d+/.test(message)) return 'HTTP_ERROR';
  if (message.includes('enotfound') || message.includes('getaddrinfo') || message.includes('name not resolved')) return 'DNS';
  if (message.includes('certificate') || message.includes('ssl') || message.includes('tls')) return 'TLS';
  if (error instanceof TypeError || message.includes('failed to fetch') || message.includes('econnrefused') || message.includes('network')) return 'CONNECT';
  return 'OTHER';
}

/** The web has no validated-network flag; `navigator.onLine` is the closest signal (spec/SITE_STATE.md section 4). */
function browserOnline(): boolean {
  return !(typeof navigator !== 'undefined' && navigator.onLine === false);
}

export type ZtoeFetchStatus = 'SUCCESS' | 'NO_INTERNET' | 'NO_QUEUES_FOUND';

/** Result of one ztoe refresh, the web twin of Kotlin's `ScheduleFetchResult`. */
export interface ScheduleFetchResult {
  todaySlots: BlackoutSlot[];
  tomorrowSlots: BlackoutSlot[] | null;
  hasTomorrowSchedule: boolean;
  status: ZtoeFetchStatus;
  siteState: SiteState;
  failure: FetchFailure;
  /** Text of the "УВАГА! ВАЖЛИВА ІНФОРМАЦІЯ!" notice when the page has no schedule table (core/siteNotice). */
  notice?: string | null;
}

export interface ZtoeFetchOptions {
  /** Bypass the browser HTTP cache. */
  force?: boolean;
  /** The real instant; only tests pass one. */
  now?: Date;
  cache?: ScheduleCache;
  /** Replaces the network (tests). Must reject on failure. */
  fetchHtml?: (url: string, timeoutMs: number, force: boolean) => Promise<string>;
  /** Replaces `navigator.onLine` (tests). */
  isOnline?: () => boolean;
}

/**
 * Fetches the ztoe page, parses all queues, stores them in the schedule cache and classifies the
 * site. A failed request NEVER clears or overwrites the cache (spec/SITE_STATE.md section 6);
 * only a non-whitelisted URL drops it, because a schedule from another source is meaningless.
 */
export async function fetchZtoeSchedule(url: string, queue: string, options: ZtoeFetchOptions = {}): Promise<ScheduleFetchResult> {
  const now = options.now ?? new Date();
  const cache = options.cache ?? getScheduleCache();
  const isOnline = options.isOnline ?? browserOnline;
  const fetchHtml = options.fetchHtml ?? fetchHtmlDecoded;
  const today = parseLocalDate(getKyivDateParts(now).dateStr);
  const trimmedQueue = (queue || '').trim();

  const empty = { todaySlots: [] as BlackoutSlot[], tomorrowSlots: null, hasTomorrowSchedule: false };
  const noTable = (pageHtml?: string): ScheduleFetchResult => ({
    ...empty,
    status: 'NO_QUEUES_FOUND',
    siteState: 'AVAILABLE_NO_TABLE',
    failure: 'NONE',
    notice: pageHtml ? extractSiteNotice(pageHtml) : null,
  });
  // Read the network verdict after the failure, so a link that dropped during the request counts as NO_INTERNET.
  const failed = (failure: FetchFailure): ScheduleFetchResult => ({
    ...empty,
    status: 'NO_INTERNET',
    siteState: SiteStateResolver.resolve(failure, false, isOnline()),
    failure,
  });

  const trimmedUrl = (url || '').trim();
  if (!isValidZtoeUrl(trimmedUrl)) {
    cache.clear();
    return noTable();
  }
  // A valid but unrelated entry of valid-urls.json (example.com) has no schedule and cannot be read cross-origin.
  if (!trimmedUrl.toLowerCase().includes('ztoe.com.ua')) return noTable();
  if (!isOnline()) return failed('CONNECT');

  let html: string;
  try {
    html = await fetchHtml(trimmedUrl, FETCH_TIMEOUT_MS, options.force ?? false);
  } catch (e) {
    return failed(classifyFetchFailure(e));
  }

  // From here the page arrived: whatever goes wrong is "available, but no usable table", not a fetch failure.
  let queues: Map<string, ParsedQueueSchedule>;
  try {
    queues = parseZtoeHtmlAllQueues(html, today);
  } catch {
    return noTable(html);
  }
  if (queues.size === 0) return noTable(html);

  try {
    const batch = new Map<string, { today: boolean[]; tomorrow: boolean[] | null }>();
    for (const [q, r] of queues) batch.set(q, { today: slotsToOffCells(r.today), tomorrow: r.tomorrow ? slotsToOffCells(r.tomorrow) : null });
    cache.saveAllSchedulesBatch(batch, trimmedQueue, today, now.getTime());
  } catch {
    // a full or blocked storage must not turn a good fetch into a failure
  }

  const withTable = { siteState: 'AVAILABLE_WITH_TABLE' as SiteState, failure: 'NONE' as FetchFailure };
  if (!trimmedQueue) return { ...empty, status: 'SUCCESS', ...withTable };
  const mine = queues.get(trimmedQueue);
  // The page and its table are there even when this queue's row is missing
  if (!mine) return { ...empty, status: 'NO_QUEUES_FOUND', ...withTable };
  return {
    todaySlots: mine.today,
    tomorrowSlots: mine.tomorrow,
    hasTomorrowSchedule: mine.tomorrow !== null,
    status: 'SUCCESS',
    ...withTable,
  };
}

// ---------------------------------------------------------------------------------------------
// Cached cells for the outage engine (ScheduleRepository.todayOffCells and friends)
// ---------------------------------------------------------------------------------------------

export function todayOffCells(queue: string, today: LocalDate, cache: ScheduleCache = getScheduleCache()): boolean[] | null {
  return cache.todayOffCells(queue, today);
}
export function tomorrowOffCells(queue: string, today: LocalDate, cache: ScheduleCache = getScheduleCache()): boolean[] | null {
  return cache.tomorrowOffCells(queue, today);
}
/** The previous day's cells, kept for one more day so a block that began before midnight keeps its real start. */
export function yesterdayOffCells(queue: string, today: LocalDate, cache: ScheduleCache = getScheduleCache()): boolean[] | null {
  return cache.yesterdayOffCells(queue, today);
}
export function hasValidTodayCache(queue: string, today: LocalDate, cache: ScheduleCache = getScheduleCache()): boolean {
  return cache.hasValidTodayCache(queue, today);
}
export function hasTomorrowSchedule(queue: string, today: LocalDate, cache: ScheduleCache = getScheduleCache()): boolean {
  return cache.hasTomorrowSchedule(queue, today);
}

// ---------------------------------------------------------------------------------------------
// Legacy DaySchedule API (still used by MainView / WidgetSimulator / App until the views are reworked)
// ---------------------------------------------------------------------------------------------

export interface FullScheduleFetchResponse {
  todaySchedule: DaySchedule;
  tomorrowSchedule: DaySchedule | null;
  status: ZtoeFetchStatus;
  siteState?: SiteState;
  failure?: FetchFailure;
}

export async function fetchFullSchedules(
  url: string,
  queue: string,
  options: ZtoeFetchOptions = {}
): Promise<FullScheduleFetchResponse> {
  const todayDate = options.now ?? new Date();
  const tomorrowDate = new Date(todayDate.getTime() + 86400000);
  const todayParts = getKyivDateParts(todayDate);
  const tomorrowParts = getKyivDateParts(tomorrowDate);
  const today = parseLocalDate(todayParts.dateStr);
  const cache = options.cache ?? getScheduleCache();

  const todayLabel = `Сьогодні (${todayDate.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })})`;
  const tomorrowLabel = `Завтра (${tomorrowDate.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })})`;
  const nowTimeStr = todayDate.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', hour12: false });

  const make = (dateStr: string, dayLabel: string, slots: BlackoutSlot[], isUnclear: boolean): DaySchedule => ({
    dateStr,
    dayLabel,
    queue,
    city: 'Житомир (ZTOE)',
    slots,
    lastUpdated: nowTimeStr,
    sourceUrl: url,
    isUnclear,
  });

  if (!queue || queue.trim() === '') {
    return {
      todaySchedule: make(todayParts.dateStr, todayLabel, [], true),
      tomorrowSchedule: null,
      status: 'NO_QUEUES_FOUND',
    };
  }

  const res = await fetchZtoeSchedule(url, queue, options);

  if (res.status === 'SUCCESS') {
    return {
      todaySchedule: make(todayParts.dateStr, todayLabel, res.todaySlots, false),
      tomorrowSchedule: res.tomorrowSlots ? make(tomorrowParts.dateStr, tomorrowLabel, res.tomorrowSlots, false) : null,
      status: 'SUCCESS',
      siteState: res.siteState,
      failure: res.failure,
    };
  }

  // The site could not be used: keep showing the saved schedule (it is only valid for today's date stamp).
  const cachedToday = todayOffCells(queue, today, cache);
  const cachedTomorrow = tomorrowOffCells(queue, today, cache);
  return {
    todaySchedule: cachedToday
      ? make(todayParts.dateStr, todayLabel, cellsToSlots(cachedToday, queue, todayParts.dateStr), false)
      : make(todayParts.dateStr, todayLabel, [], true),
    tomorrowSchedule:
      cachedToday && cachedTomorrow ? make(tomorrowParts.dateStr, tomorrowLabel, cellsToSlots(cachedTomorrow, queue, tomorrowParts.dateStr), false) : null,
    status: res.status,
    siteState: res.siteState,
    failure: res.failure,
  };
}

/**
 * Fetch schedule for a given date and queue
 */
export async function fetchSchedule(
  url: string,
  queue: string,
  isTomorrow: boolean = false
): Promise<DaySchedule> {
  const full = await fetchFullSchedules(url, queue);
  if (isTomorrow && full.tomorrowSchedule) {
    return full.tomorrowSchedule;
  }
  return full.todaySchedule;
}

export interface BlackoutInterval {
  start: string; // "14:00" or "14:30"
  end: string;   // "18:00"
  startHour: number;
  endHour: number;
  startMinute?: number;
  endMinute?: number;
  durationHours: number;
  isEmergency?: boolean;
}

/**
 * Extracts continuous blocks of power outage for the selected queue (supports both 48 half-hour and 24 1-hour slots)
 */
export function getBlackoutIntervals(slots: BlackoutSlot[]): BlackoutInterval[] {
  const intervals: BlackoutInterval[] = [];
  if (!slots || slots.length === 0) return intervals;

  const totalSlots = slots.length;
  const minutesPerSlot = Math.floor(1440 / totalSlots);
  let inBlock = false;
  let startIdx = 0;
  let blockHasEmergency = false;

  for (let i = 0; i < totalSlots; i++) {
    const isOff = slots[i]?.status === 'POWER_OFF';
    if (isOff && !inBlock) {
      inBlock = true;
      startIdx = i;
      blockHasEmergency = Boolean(slots[i]?.isEmergency);
    } else if (isOff && inBlock) {
      if (slots[i]?.isEmergency) {
        blockHasEmergency = true;
      }
    } else if (!isOff && inBlock) {
      inBlock = false;
      const startMin = startIdx * minutesPerSlot;
      const endMin = i * minutesPerSlot;
      const sH = Math.floor(startMin / 60);
      const sM = startMin % 60;
      const eH = Math.floor(endMin / 60);
      const eM = endMin % 60;
      const startStr = `${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')}`;
      const endStr = endMin >= 1440 ? '24:00' : `${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}`;
      const durationHours = (i - startIdx) * (minutesPerSlot / 60);

      const intervalObj: BlackoutInterval = {
        start: startStr,
        end: endStr,
        startHour: sH,
        endHour: eH,
        startMinute: sM,
        endMinute: eM,
        durationHours
      };
      if (blockHasEmergency) {
        intervalObj.isEmergency = true;
      }
      intervals.push(intervalObj);
      blockHasEmergency = false;
    }
  }

  if (inBlock) {
    const startMin = startIdx * minutesPerSlot;
    const sH = Math.floor(startMin / 60);
    const sM = startMin % 60;
    const startStr = `${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')}`;
    const durationHours = (totalSlots - startIdx) * (minutesPerSlot / 60);

    const intervalObj: BlackoutInterval = {
      start: startStr,
      end: '24:00',
      startHour: sH,
      endHour: 24,
      startMinute: sM,
      endMinute: 0,
      durationHours
    };
    if (blockHasEmergency) {
      intervalObj.isEmergency = true;
    }
    intervals.push(intervalObj);
  }

  return intervals;
}

// ---------------------------------------------------------------------------------------------
// Legacy overlay + countdown: thin wrappers over the outage engine (the old year-less HTML-table
// emergency path is gone). The views should move to outageRepository.snapshot() instead.
// ---------------------------------------------------------------------------------------------

const LEGACY_DT = /(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?[ \t]+(\d{1,2}):(\d{2})/;
const LEGACY_ISO = /(\d{4})-(\d{2})-(\d{2})[ \tT]+(\d{1,2}):(\d{2})/;
const LEGACY_TIME = /(\d{1,2}):(\d{2})/;

/** "DD.MM.YYYY HH:mm", "DD.MM HH:mm", ISO, or a bare "HH:mm" (date null) as a LocalDateTime on [anchor] when undated. */
function parseLegacyDateTime(raw: string | undefined | null, anchor: LocalDate): { at: LocalDateTime; dated: boolean } | null {
  if (!raw) return null;
  const s = raw.trim();
  const dmy = LEGACY_DT.exec(s);
  if (dmy) {
    const year = dmy[3] ? (dmy[3].length <= 2 ? 2000 + +dmy[3] : +dmy[3]) : partsOfDate(anchor).year;
    const at = localDateTimeOf(year, +dmy[2], +dmy[1], +dmy[4], +dmy[5]);
    return at === null ? null : { at, dated: true };
  }
  const iso = LEGACY_ISO.exec(s);
  if (iso) {
    const at = localDateTimeOf(+iso[1], +iso[2], +iso[3], +iso[4], +iso[5]);
    return at === null ? null : { at, dated: true };
  }
  const t = LEGACY_TIME.exec(s);
  if (t) {
    const h = +t[1];
    const m = +t[2];
    if (h > 24 || m > 59) return null;
    const base = atStartOfDay(anchor);
    return { at: (base + (h * 60 + m) * 60_000) as LocalDateTime, dated: false };
  }
  return null;
}

/** A legacy "active emergency" record as one engine outage (no resolving against "now": the record says it applies). */
function legacyEmergencyOutage(info: EmergencyOutageInfo, anchorToday: LocalDate): Outage | null {
  const start = parseLegacyDateTime(info.startTime, anchorToday);
  const end = parseLegacyDateTime(info.estimatedRestoreTime, anchorToday);
  if (!start || !end) return null;
  let endAt = end.at;
  if (!start.dated && !end.dated && endAt <= start.at) endAt = (endAt + 86_400_000) as LocalDateTime;
  if (!(endAt > start.at)) return null;
  return makeOutage({ id: info.id || `legacy_${start.at}`, kind: 'EMERGENCY', start: start.at, end: endAt, label: info.outageType ?? null });
}

function safeLocalDate(dateStr: string | undefined): LocalDate {
  try {
    return parseLocalDate(dateStr || '');
  } catch {
    return parseLocalDate(getKyivDateParts().dateStr);
  }
}

/**
 * Overlays an emergency outage on a DaySchedule (Today or Tomorrow). Now a wrapper over the engine's
 * day view: the day's cells are planned cells plus the emergency outage clipped to that day.
 * Returns 48-slot schedules; when [schedule] is null a schedule is synthesised if the outage touches the day.
 */
export function applyEmergencyOutageToSchedule(
  schedule: DaySchedule | null,
  emergencyOutage: EmergencyOutageInfo | null | undefined,
  isTomorrow: boolean = false
): DaySchedule | null {
  if (!emergencyOutage) return schedule;

  const targetDate: LocalDate = schedule
    ? safeLocalDate(schedule.dateStr)
    : parseLocalDate(getKyivDateParts(isTomorrow ? new Date(Date.now() + 86400000) : new Date()).dateStr);
  const anchorToday = isTomorrow ? plusDays(targetDate, -1) : targetDate;
  const emergency = legacyEmergencyOutage(emergencyOutage, anchorToday);
  if (!emergency) return schedule;

  const baseSlots = schedule?.slots ?? [];
  const planned = baseSlots.length > 0 ? baseSlots.map((s) => s.status === 'POWER_OFF' && !s.isEmergency) : null;
  const outages = [...buildPlanned(anchorToday, isTomorrow ? null : planned, isTomorrow ? planned : null), emergency];
  const view = dayView(outages, targetDate, atStartOfDay(anchorToday));
  if (!view.slots.some((s) => s.emergency)) return schedule;

  const queueId = schedule?.queue || 'emergency';
  const dateStr = formatLocalDate(targetDate);
  const cellSlots = cellsToSlots(
    view.slots.map((s) => s.off),
    queueId,
    dateStr
  ).map((slot, i) => {
    const wasEmergency = Boolean(baseSlots.length === 48 && baseSlots[i]?.isEmergency);
    const isEmergency = view.slots[i].emergency || wasEmergency;
    return isEmergency ? { ...slot, status: 'POWER_OFF' as const, isEmergency: true } : slot;
  });

  if (schedule) return { ...schedule, slots: cellSlots, isUnclear: false };
  const targetJs = isTomorrow ? new Date(Date.now() + 86400000) : new Date();
  return {
    dateStr,
    dayLabel: `${isTomorrow ? 'Завтра' : 'Сьогодні'} (${targetJs.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })})`,
    queue: '',
    city: 'Житомир (ZTOE)',
    slots: cellSlots,
    lastUpdated: new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', hour12: false }),
    sourceUrl: DEFAULT_ZTOE_URL,
    isUnclear: false,
  };
}

export interface OutageCountdownInfo {
  isCurrentlyBlackout: boolean;
  isUnclear?: boolean;
  currentSlot: BlackoutSlot | null;
  closestBlackoutSlot: BlackoutSlot | null;
  minutesUntilNextBlackout: number | null;
  formattedTimeLeft: string; // "01:35:12"
  slotDescription: string; // e.g. "14:00 – 18:00" or "--:-- - --:--"
  intervals: BlackoutInterval[];
}

/**
 * The wall clock the legacy DaySchedule helpers use: the date of [schedule] with the local
 * hours/minutes/seconds of [now] (what the old implementation did). New code reads a true Kyiv
 * "now" through `fromInstant` / `kyivNow` instead.
 */
export function legacyClock(schedule: DaySchedule, now: Date = new Date()): { today: LocalDate; now: LocalDateTime } {
  const today = safeLocalDate(schedule.dateStr);
  return {
    today,
    now: (atStartOfDay(today) + ((now.getHours() * 60 + now.getMinutes()) * 60 + now.getSeconds()) * 1000) as LocalDateTime,
  };
}

/**
 * Status and countdown from a Today (and optional Tomorrow) DaySchedule, computed by the outage
 * engine, so a block over midnight is one block. [now] is read as the wall clock of the schedule's
 * day (its local hours/minutes/seconds), exactly like the old implementation.
 */
export function calculateOutageCountdown(
  schedule: DaySchedule,
  now: Date = new Date(),
  tomorrowSchedule: DaySchedule | null = null
): OutageCountdownInfo {
  const slots = schedule.slots || [];
  const intervals = getBlackoutIntervals(slots);

  if (slots.length === 0 || schedule.isUnclear) {
    return {
      isCurrentlyBlackout: false,
      isUnclear: true,
      currentSlot: null,
      closestBlackoutSlot: null,
      minutesUntilNextBlackout: null,
      formattedTimeLeft: '--:--:--',
      slotDescription: '--:-- - --:--',
      intervals
    };
  }

  const { today, now: nowLdt } = legacyClock(schedule, now);
  const tomorrowSlots = tomorrowSchedule?.slots && tomorrowSchedule.slots.length > 0 ? tomorrowSchedule.slots : null;
  const outages = buildPlanned(today, slotsToOffCells(slots), tomorrowSlots ? slotsToOffCells(tomorrowSlots) : null);
  const st = engineStatus(outages, nowLdt);

  const minutesPerSlot = Math.floor(1440 / slots.length);
  const currentIdx = Math.min(slots.length - 1, Math.max(0, Math.floor((now.getHours() * 60 + now.getMinutes()) / minutesPerSlot)));
  const currentSlot = slots[currentIdx] || null;

  const slotAt = (at: LocalDateTime): BlackoutSlot | null => {
    const tomorrowStart = atStartOfDay(plusDays(today, 1));
    const onTomorrow = at >= tomorrowStart;
    const list = onTomorrow ? tomorrowSlots : slots;
    if (!list) return null;
    const offsetMin = Math.floor((at - (onTomorrow ? tomorrowStart : atStartOfDay(today))) / 60_000);
    const per = Math.floor(1440 / list.length);
    return list[Math.min(list.length - 1, Math.max(0, Math.floor(offsetMin / per)))] || null;
  };

  const next = st.nextSpan;
  return {
    isCurrentlyBlackout: st.isOffNow,
    currentSlot,
    closestBlackoutSlot: st.isOffNow ? currentSlot : next ? slotAt(next.start) : null,
    minutesUntilNextBlackout: st.isOffNow ? 0 : next ? minutesBetween(nowLdt, next.start) : null,
    formattedTimeLeft: st.countdownText,
    slotDescription: st.nextSlotTime,
    intervals
  };
}

export interface SiteVerificationResult {
  isChecking: boolean;
  isAvailable: boolean;
  hasData: boolean;
  status: 'SUCCESS' | 'NO_INTERNET' | 'NO_QUEUES_FOUND';
  messageUk: string;
  messageEn: string;
  siteState?: SiteState;
}

/**
 * Verifies site URL against /valid-urls.json, Internet accessibility, and confirms that a schedule table with current date & queues exists.
 * A diagnostic only: it never touches the schedule cache.
 */
export async function verifyZtoeSiteAndData(
  url: string,
  queue: string
): Promise<SiteVerificationResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      isChecking: false,
      isAvailable: false,
      hasData: false,
      status: 'NO_INTERNET',
      messageUk: 'Немає доступу до Інтернету',
      messageEn: 'No Internet access',
      siteState: 'NO_INTERNET'
    };
  }

  const trimmed = (url || '').trim();
  if (!isValidZtoeUrl(trimmed)) {
    return {
      isChecking: false,
      isAvailable: false,
      hasData: false,
      status: 'NO_QUEUES_FOUND',
      messageUk: 'На сайті не знайдено черг',
      messageEn: 'No queues found on site',
      siteState: 'AVAILABLE_NO_TABLE'
    };
  }

  // If URL is https://example.com (in valid-urls.json, but has no ZTOE schedule tables), verify and return No queues found on site
  if (!trimmed.toLowerCase().includes('ztoe.com.ua')) {
    return {
      isChecking: false,
      isAvailable: true,
      hasData: false,
      status: 'NO_QUEUES_FOUND',
      messageUk: 'На сайті не знайдено черг',
      messageEn: 'No queues found on site',
      siteState: 'AVAILABLE_NO_TABLE'
    };
  }

  try {
    const html = await fetchHtmlDecoded(trimmed, 4500);
    const parsed = parseZtoeHtmlFull(html, queue || '1.1', new Date());

    if (parsed.hasTodayTable && parsed.todaySlots) {
      return {
        isChecking: false,
        isAvailable: true,
        hasData: true,
        status: 'SUCCESS',
        messageUk: 'Сайт доступний, графік оновлено',
        messageEn: 'Site reachable, schedule updated',
        siteState: 'AVAILABLE_WITH_TABLE'
      };
    } else {
      return {
        isChecking: false,
        isAvailable: true,
        hasData: false,
        status: 'NO_QUEUES_FOUND',
        messageUk: 'На сайті не знайдено черг',
        messageEn: 'No queues found on site',
        siteState: 'AVAILABLE_NO_TABLE'
      };
    }
  } catch (e) {
    const failure = classifyFetchFailure(e);
    return {
      isChecking: false,
      isAvailable: false,
      hasData: false,
      status: 'NO_INTERNET',
      messageUk: 'Немає доступу до Інтернету',
      messageEn: 'No Internet access',
      siteState: SiteStateResolver.resolve(failure, false, browserOnline())
    };
  }
}
