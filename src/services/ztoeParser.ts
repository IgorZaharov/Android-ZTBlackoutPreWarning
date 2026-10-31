/**
 * ZTOE (Zhytomyroblenergo) Schedule Parser & Schedule Engine
 * Supports live scraping of https://www.ztoe.com.ua/unhooking-search.php
 * with 48 half-hour slot resolution matching Android ZtoeParser.kt 100%.
 */
import { BlackoutSlot, DaySchedule, QueueOption, SlotStatus } from '../types';
import validUrlsList from '../../valid-urls.json';

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
      attr.includes('background:red') ||
      attr.includes('background: red') ||
      attr.includes('background-color:red') ||
      attr.includes('background-color: red') ||
      attr.includes('rgb(255, 51, 51)') ||
      attr.includes('rgb(255,51,51)') ||
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

  const todayD1 = `${String(todayParts.day).padStart(2, '0')}.${String(todayParts.month).padStart(2, '0')}.${todayParts.year}`;
  const todayD2 = `${todayParts.day}.${todayParts.month}.${todayParts.year}`;
  const todayD3 = `${String(todayParts.day).padStart(2, '0')}.${String(todayParts.month).padStart(2, '0')}`;

  const tomorrowD1 = `${String(tomorrowParts.day).padStart(2, '0')}.${String(tomorrowParts.month).padStart(2, '0')}.${tomorrowParts.year}`;
  const tomorrowD2 = `${tomorrowParts.day}.${tomorrowParts.month}.${tomorrowParts.year}`;
  const tomorrowD3 = `${String(tomorrowParts.day).padStart(2, '0')}.${String(tomorrowParts.month).padStart(2, '0')}`;

  const leafTables = extractLeafTables(html);

  let todayTable: ParsedHtmlTable | null = null;
  let tomorrowTable: ParsedHtmlTable | null = null;

  for (const table of leafTables) {
    if (!table.fullText.includes('1.1') || !table.fullText.includes('6.2')) {
      continue;
    }
    const headerText = table.rows
      .slice(0, 3)
      .map(r => r.cells.map(c => c.text).join(' '))
      .join(' ');

    const matchesToday =
      headerText.includes(todayD1) ||
      headerText.includes(todayD2) ||
      headerText.includes(todayD3);

    const matchesTomorrow =
      headerText.includes(tomorrowD1) ||
      headerText.includes(tomorrowD2) ||
      headerText.includes(tomorrowD3);

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

async function fetchHtmlDecoded(targetUrl: string, timeoutMs: number = 6000): Promise<string> {
  const proxyUrl = targetUrl.includes('ztoe.com.ua')
    ? `/proxy-ztoe/unhooking-search.php`
    : targetUrl;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(proxyUrl, {
      signal: controller.signal,
      headers: { Accept: 'text/html' }
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

export interface FullScheduleFetchResponse {
  todaySchedule: DaySchedule;
  tomorrowSchedule: DaySchedule | null;
  status: 'SUCCESS' | 'NO_INTERNET' | 'NO_QUEUES_FOUND';
}

export async function fetchFullSchedules(
  url: string,
  queue: string
): Promise<FullScheduleFetchResponse> {
  const todayDate = new Date();
  const tomorrowDate = new Date(todayDate.getTime() + 86400000);
  const todayParts = getKyivDateParts(todayDate);
  const tomorrowParts = getKyivDateParts(tomorrowDate);

  const todayLabel = `Сьогодні (${todayDate.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })})`;
  const tomorrowLabel = `Завтра (${tomorrowDate.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })})`;
  const nowTimeStr = new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', hour12: false });

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      todaySchedule: {
        dateStr: todayParts.dateStr,
        dayLabel: todayLabel,
        queue,
        city: 'Житомир (ZTOE)',
        slots: generateTypicalScheduleForQueue(queue, todayDate),
        lastUpdated: nowTimeStr,
        sourceUrl: url
      },
      tomorrowSchedule: null,
      status: 'NO_INTERNET'
    };
  }

  if (!isValidZtoeUrl(url)) {
    return {
      todaySchedule: {
        dateStr: todayParts.dateStr,
        dayLabel: todayLabel,
        queue,
        city: 'Житомир (ZTOE)',
        slots: generateTypicalScheduleForQueue(queue, todayDate),
        lastUpdated: nowTimeStr,
        sourceUrl: url
      },
      tomorrowSchedule: null,
      status: 'NO_QUEUES_FOUND'
    };
  }

  try {
    const html = await fetchHtmlDecoded(url.trim());
    const parsed = parseZtoeHtmlFull(html, queue, todayDate);

    if (!parsed.hasTodayTable || !parsed.todaySlots) {
      return {
        todaySchedule: {
          dateStr: todayParts.dateStr,
          dayLabel: todayLabel,
          queue,
          city: 'Житомир (ZTOE)',
          slots: generateTypicalScheduleForQueue(queue, todayDate),
          lastUpdated: nowTimeStr,
          sourceUrl: url
        },
        tomorrowSchedule: null,
        status: 'NO_QUEUES_FOUND'
      };
    }

    const todaySchedule: DaySchedule = {
      dateStr: todayParts.dateStr,
      dayLabel: todayLabel,
      queue,
      city: 'Житомир (ZTOE)',
      slots: parsed.todaySlots,
      lastUpdated: nowTimeStr,
      sourceUrl: url
    };

    const tomorrowSchedule: DaySchedule | null =
      parsed.hasTomorrowTable && parsed.tomorrowSlots
        ? {
            dateStr: tomorrowParts.dateStr,
            dayLabel: tomorrowLabel,
            queue,
            city: 'Житомир (ZTOE)',
            slots: parsed.tomorrowSlots,
            lastUpdated: nowTimeStr,
            sourceUrl: url
          }
        : null;

    return {
      todaySchedule,
      tomorrowSchedule,
      status: 'SUCCESS'
    };
  } catch {
    return {
      todaySchedule: {
        dateStr: todayParts.dateStr,
        dayLabel: todayLabel,
        queue,
        city: 'Житомир (ZTOE)',
        slots: generateTypicalScheduleForQueue(queue, todayDate),
        lastUpdated: nowTimeStr,
        sourceUrl: url
      },
      tomorrowSchedule: null,
      status: 'NO_INTERNET'
    };
  }
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

  for (let i = 0; i < totalSlots; i++) {
    const isOff = slots[i]?.status === 'POWER_OFF';
    if (isOff && !inBlock) {
      inBlock = true;
      startIdx = i;
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

      intervals.push({
        start: startStr,
        end: endStr,
        startHour: sH,
        endHour: eH,
        startMinute: sM,
        endMinute: eM,
        durationHours
      });
    }
  }

  if (inBlock) {
    const startMin = startIdx * minutesPerSlot;
    const sH = Math.floor(startMin / 60);
    const sM = startMin % 60;
    const startStr = `${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')}`;
    const durationHours = (totalSlots - startIdx) * (minutesPerSlot / 60);

    intervals.push({
      start: startStr,
      end: '24:00',
      startHour: sH,
      endHour: 24,
      startMinute: sM,
      endMinute: 0,
      durationHours
    });
  }

  return intervals;
}

export interface OutageCountdownInfo {
  isCurrentlyBlackout: boolean;
  currentSlot: BlackoutSlot | null;
  closestBlackoutSlot: BlackoutSlot | null;
  minutesUntilNextBlackout: number | null;
  formattedTimeLeft: string; // "01:35:12"
  slotDescription: string; // e.g. "14:00 – 18:00"
  intervals: BlackoutInterval[];
}

/**
 * Compute the closest blackout and exact countdown from current time (supports 48 half-hour slots)
 */
export function calculateOutageCountdown(
  schedule: DaySchedule,
  now: Date = new Date()
): OutageCountdownInfo {
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  const currentSec = now.getSeconds();
  const currentMinuteOfDay = currentHour * 60 + currentMin;

  const slots = schedule.slots || [];
  const intervals = getBlackoutIntervals(slots);

  if (slots.length === 0) {
    return {
      isCurrentlyBlackout: false,
      currentSlot: null,
      closestBlackoutSlot: null,
      minutesUntilNextBlackout: null,
      formattedTimeLeft: '00:00:00',
      slotDescription: 'Відключень немає',
      intervals
    };
  }

  const totalSlots = slots.length;
  const minutesPerSlot = Math.floor(1440 / totalSlots);
  const currentSlotIdx = Math.min(totalSlots - 1, Math.max(0, Math.floor(currentMinuteOfDay / minutesPerSlot)));
  const currentSlot = slots[currentSlotIdx] || null;
  const isCurrentlyBlackout = currentSlot?.status === 'POWER_OFF';

  const parseIntervalMinutes = (iv: BlackoutInterval) => {
    const [sH, sM] = iv.start.split(':').map(Number);
    const [eH, eM] = iv.end === '24:00' ? [24, 0] : iv.end.split(':').map(Number);
    return { startMin: sH * 60 + (sM || 0), endMin: eH * 60 + (eM || 0) };
  };

  if (isCurrentlyBlackout) {
    const activeInterval = intervals.find(iv => {
      const { startMin, endMin } = parseIntervalMinutes(iv);
      return currentMinuteOfDay >= startMin && currentMinuteOfDay < endMin;
    });

    const endMinuteOfDay = activeInterval ? parseIntervalMinutes(activeInterval).endMin : (currentSlotIdx + 1) * minutesPerSlot;
    const diffMin = endMinuteOfDay - currentMinuteOfDay;
    const secondsRemaining = Math.max(0, diffMin * 60 - currentSec);
    const h = Math.floor(secondsRemaining / 3600);
    const m = Math.floor((secondsRemaining % 3600) / 60);
    const s = secondsRemaining % 60;

    return {
      isCurrentlyBlackout: true,
      currentSlot,
      closestBlackoutSlot: currentSlot,
      minutesUntilNextBlackout: 0,
      formattedTimeLeft: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
      slotDescription: activeInterval ? `${activeInterval.start} – ${activeInterval.end}` : `${currentSlot.startTimeStr} – ${currentSlot.endTimeStr}`,
      intervals
    };
  }

  const nextInterval = intervals.find(iv => {
    const { startMin } = parseIntervalMinutes(iv);
    return startMin > currentMinuteOfDay;
  });

  if (nextInterval) {
    const { startMin } = parseIntervalMinutes(nextInterval);
    const diffMin = startMin - currentMinuteOfDay;
    const secondsRemaining = Math.max(0, diffMin * 60 - currentSec);
    const h = Math.floor(secondsRemaining / 3600);
    const m = Math.floor((secondsRemaining % 3600) / 60);
    const s = secondsRemaining % 60;

    const nextSlotIdx = Math.min(totalSlots - 1, Math.floor(startMin / minutesPerSlot));
    const closestSlot = slots[nextSlotIdx] || null;

    return {
      isCurrentlyBlackout: false,
      currentSlot,
      closestBlackoutSlot: closestSlot,
      minutesUntilNextBlackout: diffMin,
      formattedTimeLeft: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
      slotDescription: `${nextInterval.start} – ${nextInterval.end}`,
      intervals
    };
  }

  return {
    isCurrentlyBlackout: false,
    currentSlot,
    closestBlackoutSlot: null,
    minutesUntilNextBlackout: null,
    formattedTimeLeft: '--:--:--',
    slotDescription: 'Відключень немає',
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
}

/**
 * Verifies site URL against /valid-urls.json, Internet accessibility, and confirms that a schedule table with current date & queues exists
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
      messageEn: 'No Internet access'
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
      messageEn: 'No queues found on site'
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
      messageEn: 'No queues found on site'
    };
  }

  try {
    const html = await fetchHtmlDecoded(trimmed, 4500);
    const parsed = parseZtoeHtmlFull(html, queue, new Date());

    if (parsed.hasTodayTable && parsed.todaySlots) {
      return {
        isChecking: false,
        isAvailable: true,
        hasData: true,
        status: 'SUCCESS',
        messageUk: 'Сайт доступний, графік оновлено',
        messageEn: 'Site reachable, schedule updated'
      };
    } else {
      return {
        isChecking: false,
        isAvailable: true,
        hasData: false,
        status: 'NO_QUEUES_FOUND',
        messageUk: 'На сайті не знайдено черг',
        messageEn: 'No queues found on site'
      };
    }
  } catch {
    return {
      isChecking: false,
      isAvailable: false,
      hasData: false,
      status: 'NO_INTERNET',
      messageUk: 'Немає доступу до Інтернету',
      messageEn: 'No Internet access'
    };
  }
}
