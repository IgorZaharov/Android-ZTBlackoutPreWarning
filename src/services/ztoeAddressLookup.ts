/**
 * ZTOE (Zhytomyroblenergo) Outage Queue Address Lookup Service
 * Supports parsing HTML tables from https://www.ztoe.com.ua/unhooking-search.php
 * (REM -> City/Settlement -> Street -> House Number -> Queue/Subqueue or custom status text)
 * with built-in Zhytomyr Oblast directory fallback when offline or CORS-restricted.
 */

import { EmergencyOutageInfo, SelectedAddressQuery } from '../types';
import { getKyivDateParts } from './ztoeParser';

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

export interface ZtoeStreetOption {
  id: string;
  settlementId: string;
  ztoeVulicaId?: string;
  poweronStreetId?: string;
  nameUk: string;
  nameEn: string;
}

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
  /**
   * Active emergency outage ("Аварійне відключення") for this house, if detected on ZTOE
   */
  emergencyOutage?: EmergencyOutageInfo | null;
}

export const ZTOE_REM_OPTIONS: ZtoeRemOption[] = [
  { id: 'zhytomyr', ztoeRemId: '7', ztoeOtgId: '6', nameUk: 'Житомирський РЕМ', nameEn: 'Zhytomyr REM' },
  { id: 'berdychiv', ztoeRemId: '3', ztoeOtgId: '3', nameUk: 'Бердичівський РЕМ', nameEn: 'Berdychiv REM' },
  { id: 'korosten', ztoeRemId: '9', ztoeOtgId: '7', nameUk: 'Коростенський РЕМ', nameEn: 'Korosten REM' },
  { id: 'zviahel', ztoeRemId: '16', ztoeOtgId: '11', nameUk: 'Звягельський РЕМ', nameEn: 'Zviahel REM' },
  { id: 'malyn', ztoeRemId: '14', ztoeOtgId: '10', nameUk: 'Малинський РЕМ', nameEn: 'Malyn REM' },
  { id: 'radomyshl', ztoeRemId: '20', ztoeOtgId: '15', nameUk: 'Радомишльський РЕМ', nameEn: 'Radomyshl REM' },
];

export const ZTOE_SETTLEMENT_OPTIONS: ZtoeSettlementOption[] = [
  { id: 'zt_city', remId: 'zhytomyr', ztoeNaspunktId: '16657', poweronCityId: '333', nameUk: 'м. Житомир', nameEn: 'Zhytomyr' },
  { id: 'zt_zarichany', remId: 'zhytomyr', ztoeNaspunktId: '16699', nameUk: 'с. Зарічани', nameEn: 'Zarichany' },
  { id: 'zt_stanyshivka', remId: 'zhytomyr', ztoeNaspunktId: '16734', nameUk: 'с. Станишівка', nameEn: 'Stanyshivka' },
  { id: 'zt_hlybochytsia', remId: 'zhytomyr', ztoeNaspunktId: '16667', nameUk: 'с. Глибочиця', nameEn: 'Hlybochytsia' },
  { id: 'bd_city', remId: 'berdychiv', nameUk: 'м. Бердичів', nameEn: 'Berdychiv' },
  { id: 'kr_city', remId: 'korosten', nameUk: 'м. Коростень', nameEn: 'Korosten' },
  { id: 'zv_city', remId: 'zviahel', nameUk: 'м. Звягель', nameEn: 'Zviahel' },
  { id: 'ml_city', remId: 'malyn', nameUk: 'м. Малин', nameEn: 'Malyn' },
  { id: 'rd_city', remId: 'radomyshl', nameUk: 'м. Радомишль', nameEn: 'Radomyshl' },
];

export const ZTOE_STREET_OPTIONS: ZtoeStreetOption[] = [
  // м. Житомир
  { id: 'zt_kyivska', settlementId: 'zt_city', ztoeVulicaId: '173934', poweronStreetId: '4757', nameUk: 'вул. Київська', nameEn: 'Kyivska St.' },
  { id: 'zt_berdy', settlementId: 'zt_city', poweronStreetId: '4550', nameUk: 'вул. Велика Бердичівська', nameEn: 'Velyka Berdychivska St.' },
  { id: 'zt_peremohy', settlementId: 'zt_city', poweronStreetId: '4552', nameUk: 'вул. Перемоги', nameEn: 'Peremohy St.' },
  { id: 'zt_pokrovska', settlementId: 'zt_city', poweronStreetId: '4789', nameUk: 'вул. Покровська', nameEn: 'Pokrovska St.' },
  { id: 'zt_lesi', settlementId: 'zt_city', poweronStreetId: '4788', nameUk: 'вул. Лесі Українки', nameEn: 'Lesi Ukrainky St.' },
  { id: 'zt_chudnivska', settlementId: 'zt_city', poweronStreetId: '4645', nameUk: 'вул. Чуднівська', nameEn: 'Chudnivska St.' },
  { id: 'zt_mykhailivska', settlementId: 'zt_city', poweronStreetId: '33622', nameUk: 'вул. Михайлівська', nameEn: 'Mykhailivska St.' },
  // с. Зарічани
  { id: 'zr_lisova', settlementId: 'zt_zarichany', nameUk: 'вул. Лісова', nameEn: 'Lisova St.' },
  { id: 'zr_berdy', settlementId: 'zt_zarichany', nameUk: 'вул. Бердичівське шосе', nameEn: 'Berdychivske Hwy' },
  // с. Станишівка
  { id: 'st_tsentralna', settlementId: 'zt_stanyshivka', nameUk: 'вул. Центральна', nameEn: 'Tsentralna St.' },
  // с. Глибочиця
  { id: 'hl_kyivska', settlementId: 'zt_hlybochytsia', nameUk: 'вул. Київська', nameEn: 'Kyivska St.' },
  // м. Бердичів
  { id: 'bd_ievropeiska', settlementId: 'bd_city', nameUk: 'вул. Європейська', nameEn: 'Yevropeiska St.' },
  { id: 'bd_zhytomyrska', settlementId: 'bd_city', nameUk: 'вул. Житомирська', nameEn: 'Zhytomyrska St.' },
  // м. Коростень
  { id: 'kr_hrushevskoho', settlementId: 'kr_city', nameUk: 'вул. Грушевського', nameEn: 'Hrushevskoho St.' },
  // м. Звягель
  { id: 'zv_shevchenka', settlementId: 'zv_city', nameUk: 'вул. Шевченка', nameEn: 'Shevchenka St.' },
  // м. Малин
  { id: 'ml_soborna', settlementId: 'ml_city', nameUk: 'вул. Соборна', nameEn: 'Soborna St.' },
  // м. Радомишль
  { id: 'rd_velyka', settlementId: 'rd_city', nameUk: 'вул. Велика Житомирська', nameEn: 'Velyka Zhytomyrska St.' },
];

export const ZTOE_STREET_HOUSES: Record<string, ZtoeHouseLookupResult[]> = {
  zt_kyivska: [
    { house: '1', queue: '1.1', rawQueueCell: '1', rawSubqueueCell: '1' },
    { house: '10', queue: '1.2', rawQueueCell: '1', rawSubqueueCell: '2' },
    { house: '25', queue: '2.1', rawQueueCell: '2', rawSubqueueCell: '1' },
    {
      house: '37',
      queue: '2.2',
      rawQueueCell: '2',
      rawSubqueueCell: '2',
      emergencyOutage: getKyivska37DemoEmergencyOutage(),
    },
    { house: '47', queue: '3.2', rawQueueCell: '3', rawSubqueueCell: '2' },
    { house: '77', queue: '5.2', rawQueueCell: '5', rawSubqueueCell: '2' },
    {
      house: '104',
      queue: '',
      rawQueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      rawSubqueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      statusText: ZTOE_FULL_NO_OUTAGE_MESSAGE,
    },
    {
      house: '106',
      queue: '',
      rawQueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      rawSubqueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      statusText: ZTOE_FULL_NO_OUTAGE_MESSAGE,
    },
  ],
  zt_berdy: [
    { house: '6', queue: '2.1', rawQueueCell: '2', rawSubqueueCell: '1' },
    { house: '15', queue: '2.2', rawQueueCell: '2', rawSubqueueCell: '2' },
    { house: '32', queue: '4.1', rawQueueCell: '4', rawSubqueueCell: '1' },
    { house: '67', queue: '5.1', rawQueueCell: '5', rawSubqueueCell: '1' },
    {
      house: '70',
      queue: '',
      rawQueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      rawSubqueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      statusText: ZTOE_FULL_NO_OUTAGE_MESSAGE,
    },
  ],
  zt_peremohy: [
    { house: '2', queue: '1.2', rawQueueCell: '1', rawSubqueueCell: '2' },
    { house: '12', queue: '3.1', rawQueueCell: '3', rawSubqueueCell: '1' },
    { house: '54', queue: '5.2', rawQueueCell: '5', rawSubqueueCell: '2' },
    { house: '99', queue: '6.1', rawQueueCell: '6', rawSubqueueCell: '1' },
    {
      house: '105',
      queue: '',
      rawQueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      rawSubqueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      statusText: ZTOE_FULL_NO_OUTAGE_MESSAGE,
    },
  ],
  zt_pokrovska: [
    { house: '4', queue: '2.2', rawQueueCell: '2', rawSubqueueCell: '2' },
    { house: '28', queue: '4.2', rawQueueCell: '4', rawSubqueueCell: '2' },
    { house: '115', queue: '6.2', rawQueueCell: '6', rawSubqueueCell: '2' },
    {
      house: '120',
      queue: '',
      rawQueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      rawSubqueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      statusText: ZTOE_FULL_NO_OUTAGE_MESSAGE,
    },
  ],
  zt_lesi: [
    { house: '5', queue: '1.1', rawQueueCell: '1', rawSubqueueCell: '1' },
    { house: '14', queue: '3.2', rawQueueCell: '3', rawSubqueueCell: '2' },
    { house: '42', queue: '5.2', rawQueueCell: '5', rawSubqueueCell: '2' },
    {
      house: '50',
      queue: '',
      rawQueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      rawSubqueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      statusText: ZTOE_FULL_NO_OUTAGE_MESSAGE,
    },
  ],
  zt_chudnivska: [
    { house: '92', queue: '4.1', rawQueueCell: '4', rawSubqueueCell: '1' },
    { house: '106', queue: '4.2', rawQueueCell: '4', rawSubqueueCell: '2' },
    { house: '129', queue: '6.1', rawQueueCell: '6', rawSubqueueCell: '1' },
    {
      house: '135',
      queue: '',
      rawQueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      rawSubqueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      statusText: ZTOE_FULL_NO_OUTAGE_MESSAGE,
    },
  ],
  zt_mykhailivska: [
    { house: '1', queue: '1.1', rawQueueCell: '1', rawSubqueueCell: '1' },
    { house: '8', queue: '2.1', rawQueueCell: '2', rawSubqueueCell: '1' },
    {
      house: '15',
      queue: '',
      rawQueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      rawSubqueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      statusText: ZTOE_FULL_NO_OUTAGE_MESSAGE,
    },
  ],
  zr_lisova: [
    { house: '3', queue: '3.1', rawQueueCell: '3', rawSubqueueCell: '1' },
    { house: '18', queue: '5.2', rawQueueCell: '5', rawSubqueueCell: '2' },
    {
      house: '25',
      queue: '',
      rawQueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      rawSubqueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      statusText: ZTOE_FULL_NO_OUTAGE_MESSAGE,
    },
  ],
  zr_berdy: [
    { house: '5', queue: '2.2', rawQueueCell: '2', rawSubqueueCell: '2' },
    { house: '11', queue: '4.1', rawQueueCell: '4', rawSubqueueCell: '1' },
    {
      house: '19',
      queue: '',
      rawQueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      rawSubqueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      statusText: ZTOE_FULL_NO_OUTAGE_MESSAGE,
    },
  ],
  st_tsentralna: [
    { house: '1', queue: '3.2', rawQueueCell: '3', rawSubqueueCell: '2' },
    { house: '24', queue: '6.1', rawQueueCell: '6', rawSubqueueCell: '1' },
    {
      house: '30',
      queue: '',
      rawQueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      rawSubqueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      statusText: ZTOE_FULL_NO_OUTAGE_MESSAGE,
    },
  ],
  hl_kyivska: [
    { house: '7', queue: '1.2', rawQueueCell: '1', rawSubqueueCell: '2' },
    { house: '19', queue: '5.1', rawQueueCell: '5', rawSubqueueCell: '1' },
    {
      house: '27',
      queue: '',
      rawQueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      rawSubqueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      statusText: ZTOE_FULL_NO_OUTAGE_MESSAGE,
    },
  ],
  bd_ievropeiska: [
    { house: '10', queue: '2.1', rawQueueCell: '2', rawSubqueueCell: '1' },
    { house: '45', queue: '5.2', rawQueueCell: '5', rawSubqueueCell: '2' },
    {
      house: '52',
      queue: '',
      rawQueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      rawSubqueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      statusText: ZTOE_FULL_NO_OUTAGE_MESSAGE,
    },
  ],
  bd_zhytomyrska: [
    { house: '14', queue: '3.1', rawQueueCell: '3', rawSubqueueCell: '1' },
    { house: '80', queue: '6.2', rawQueueCell: '6', rawSubqueueCell: '2' },
    {
      house: '88',
      queue: '',
      rawQueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      rawSubqueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      statusText: ZTOE_FULL_NO_OUTAGE_MESSAGE,
    },
  ],
  kr_hrushevskoho: [
    { house: '9', queue: '1.1', rawQueueCell: '1', rawSubqueueCell: '1' },
    { house: '22', queue: '4.2', rawQueueCell: '4', rawSubqueueCell: '2' },
    {
      house: '35',
      queue: '',
      rawQueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      rawSubqueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      statusText: ZTOE_FULL_NO_OUTAGE_MESSAGE,
    },
  ],
  zv_shevchenka: [
    { house: '5', queue: '2.2', rawQueueCell: '2', rawSubqueueCell: '2' },
    { house: '31', queue: '5.1', rawQueueCell: '5', rawSubqueueCell: '1' },
    {
      house: '44',
      queue: '',
      rawQueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      rawSubqueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      statusText: ZTOE_FULL_NO_OUTAGE_MESSAGE,
    },
  ],
  ml_soborna: [
    { house: '4', queue: '3.2', rawQueueCell: '3', rawSubqueueCell: '2' },
    { house: '17', queue: '6.1', rawQueueCell: '6', rawSubqueueCell: '1' },
    {
      house: '29',
      queue: '',
      rawQueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      rawSubqueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      statusText: ZTOE_FULL_NO_OUTAGE_MESSAGE,
    },
  ],
  rd_velyka: [
    { house: '12', queue: '1.2', rawQueueCell: '1', rawSubqueueCell: '2' },
    { house: '38', queue: '4.1', rawQueueCell: '4', rawSubqueueCell: '1' },
    {
      house: '46',
      queue: '',
      rawQueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      rawSubqueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      statusText: ZTOE_FULL_NO_OUTAGE_MESSAGE,
    },
  ],
};

function stripHtmlTags(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses an HTML address lookup table from https://www.ztoe.com.ua/unhooking-search.php
 * Supports both 3-column (Будинок | Черга | Підчерга) and 7-column
 * (РЕМ | Населений пункт | Назва вулиці, провулка, тощо | Будинки | Черга | Підчерга | Примітка) ZTOE tables.
 * If the ZTOE table has a message instead of queue/subqueue, queue is set to "" (no queue)
 * and the full unshortened message is returned in statusText.
 */
export function parseZtoeAddressLookupTableHtml(html: string): ZtoeHouseLookupResult[] {
  const results: ZtoeHouseLookupResult[] = [];
  if (!html) return results;

  // Exclude the 48-column schedule tables ("Графіки погодинних відключень") at the bottom of unhooking-search.php
  const scheduleSectionIdx = html.indexOf('Графіки погодинних відключень');
  const addressSectionHtml = scheduleSectionIdx >= 0 ? html.slice(0, scheduleSectionIdx) : html;

  const trRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;

  let houseColIdx = 0;
  let queueColIdx = 1;
  let subqueueColIdx = 2;
  let noteColIdx = -1;
  const metadataCols = new Set<number>();

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

    // Detect header row (uses <th> or first cell is column title like "Будинок" / "Адреса" / "РЕМ")
    const firstCellLower = (cells[0] || '').toLowerCase();
    const isHeaderRow =
      /<th\b/i.test(rowHtml) ||
      firstCellLower === 'будинок' ||
      firstCellLower === 'будинки' ||
      firstCellLower === 'адреса' ||
      firstCellLower === 'рем' ||
      firstCellLower.includes('вулиц');
    if (isHeaderRow) {
      metadataCols.clear();
      noteColIdx = -1;
      cells.forEach((c, idx) => {
        const cl = c.toLowerCase();
        if (cl.includes('буд') || cl.includes('дом') || cl.includes('адрес')) {
          houseColIdx = idx;
        } else if (cl.includes('підчерг')) {
          subqueueColIdx = idx;
        } else if (cl.includes('черг')) {
          queueColIdx = idx;
        } else if (cl.includes('примітк')) {
          noteColIdx = idx;
          metadataCols.add(idx);
        } else if (cl === 'рем' || cl.includes('населений') || cl.includes('вулиц')) {
          metadataCols.add(idx);
        }
      });
      continue;
    }

    const houseVal = cells[houseColIdx] || cells[0] || '';
    const queueRaw = cells[queueColIdx] ?? cells[1] ?? '';
    const subqueueRaw = cells[subqueueColIdx] ?? cells[2] ?? '';

    if (!houseVal) continue;

    // Check if queueRaw + subqueueRaw forms a valid numeric queue "X.Y" (e.g. "5.2")
    const combinedMatch = `${queueRaw}.${subqueueRaw}`.match(/^([1-6])\.([1-2])$/);
    const directMatch = queueRaw.match(/^([1-6])\.([1-2])$/);

    let normalizedQueue = '';
    let statusText: string | undefined;

    if (directMatch) {
      normalizedQueue = `${directMatch[1]}.${directMatch[2]}`;
    } else if (combinedMatch) {
      normalizedQueue = `${combinedMatch[1]}.${combinedMatch[2]}`;
    }

    // Extract full unshortened non-numeric status text from queue/subqueue/remark cells, deduplicating identical cells
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

/**
 * Formats an ISO timestamp from ZTOE (e.g. "2026-11-09T06:35:59+00:00") into "DD.MM.YYYY HH:mm"
 * using the UTC date/time fields (matching ZTOE's official frontend behavior).
 */
export function formatZtoeOutageTimestamp(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[3]}.${isoMatch[2]}.${isoMatch[1]} ${isoMatch[4]}:${isoMatch[5]}`;
  }
  return trimmed;
}

export interface ParsedEmergencyOutageRow extends EmergencyOutageInfo {
  rem?: string;
  city?: string;
  street?: string;
  house: string;
}

/**
 * Parses ZTOE 7-column emergency outage HTML tables
 * (РЕМ | Населений пункт | Вулиця | Будинок | Тип відключення | Час відключення | Очікуваний час ввімкнення)
 * and extracts rows where the outage type indicates an emergency outage ("Аварійне відключення").
 */
export function parseZtoeEmergencyOutagesTableHtml(html: string): ParsedEmergencyOutageRow[] {
  const results: ParsedEmergencyOutageRow[] = [];
  if (!html) return results;

  const scheduleSectionIdx = html.indexOf('Графіки погодинних відключень');
  const relevantHtml = scheduleSectionIdx >= 0 ? html.slice(0, scheduleSectionIdx) : html;

  const trRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;

  let remColIdx = 0;
  let cityColIdx = 1;
  let streetColIdx = 2;
  let houseColIdx = 3;
  let typeColIdx = 4;
  let startColIdx = 5;
  let restoreColIdx = 6;

  while ((trMatch = trRegex.exec(relevantHtml)) !== null) {
    const rowHtml = trMatch[1];
    if (/<input\b/i.test(rowHtml) || /<select\b/i.test(rowHtml)) continue;

    const cellRegex = /<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      cells.push(stripHtmlTags(cellMatch[1]));
    }

    if (cells.length < 4) continue;

    const firstCellLower = (cells[0] || '').toLowerCase();
    const isHeaderRow =
      /<th\b/i.test(rowHtml) ||
      firstCellLower === 'рем' ||
      firstCellLower === 'будинок' ||
      firstCellLower === 'будинки' ||
      cells.some((c) => c.toLowerCase().includes('тип відключення') || c.toLowerCase().includes('час відключення'));

    if (isHeaderRow) {
      cells.forEach((c, idx) => {
        const cl = c.toLowerCase();
        if (cl === 'рем') remColIdx = idx;
        else if (cl.includes('населений')) cityColIdx = idx;
        else if (cl.includes('вулиц')) streetColIdx = idx;
        else if (cl.includes('буд')) houseColIdx = idx;
        else if (cl.includes('тип відключ') || cl.includes('причин')) typeColIdx = idx;
        else if (cl.includes('час відключ') || cl.includes('початок')) startColIdx = idx;
        else if (cl.includes('ввімкн') || cl.includes('відновл')) restoreColIdx = idx;
      });
      continue;
    }

    const houseVal = cells[houseColIdx] || '';
    const typeVal = cells[typeColIdx] || '';
    const startVal = cells[startColIdx] || '';
    const restoreVal = cells[restoreColIdx] || '';

    // Must be an emergency outage ("Аварійне відключення") and NOT the static "В цей час не вимикається, за винятком випадків аварійних відключень" note
    const typeLower = typeVal.toLowerCase();
    const isEmergency =
      typeLower.includes('аварійн') &&
      !typeLower.includes('не вимикається') &&
      !typeLower.includes('за винятком');

    if (!houseVal || !isEmergency) continue;

    const formattedStart = formatZtoeOutageTimestamp(startVal);
    const formattedRestore = formatZtoeOutageTimestamp(restoreVal);

    const houseTokens = houseVal.includes(',')
      ? houseVal.split(',').map((h) => h.trim()).filter(Boolean)
      : [houseVal.trim()];

    for (const hToken of houseTokens) {
      results.push({
        id: `ztoe_emerg_${cells[streetColIdx] || ''}_${hToken}_${formattedStart || 'active'}`,
        rem: cells[remColIdx] || undefined,
        city: cells[cityColIdx] || undefined,
        street: cells[streetColIdx] || undefined,
        house: hToken,
        outageType: typeVal || 'Аварійне відключення',
        startTime: formattedStart,
        estimatedRestoreTime: formattedRestore,
      });
    }
  }

  return results;
}

function normalizePlaceName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(м\.|місто|с\.|село|смт|селище)\s+/i, '')
    .replace(/['’ʼ`]/g, "'")
    .trim();
}

function normalizeStreetName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/['’ʼ`]/g, "'")
    .trim();
}

export interface ZtoePwAccidentRecord {
  id?: number | string;
  city?: { name?: string };
  street?: { name?: string };
  otg?: { id?: number | string; code?: string; name?: string };
  buildingNames?: string;
  dateEvent?: string;
  datePlanIn?: string;
  typeOff?: number;
  switchSubReason?: number;
}

/**
 * Matches a user's SelectedAddressQuery against records from ZTOE's live
 * https://api-ztoe-poweron.inneti.net/api/pw_accidents endpoint.
 */
export function matchEmergencyOutageFromAccidentsJson(
  accidents: ZtoePwAccidentRecord[],
  query: SelectedAddressQuery
): EmergencyOutageInfo | null {
  if (!Array.isArray(accidents) || !query || !query.streetId || !query.house) return null;

  const settlementObj = ZTOE_SETTLEMENT_OPTIONS.find((s) => s.id === query.settlementId);
  const streetObj = ZTOE_STREET_OPTIONS.find((st) => st.id === query.streetId);
  if (!streetObj) return null;

  const targetCityNorm = settlementObj ? normalizePlaceName(settlementObj.nameUk) : '';
  const targetStreetNorm = normalizeStreetName(streetObj.nameUk);
  const targetHouseNorm = query.house.trim().toLowerCase();

  for (const item of accidents) {
    // Only match emergency outages from ZTOE pw_accidents:
    // - typeOff === 1 (emergency / active outage on ZTOE pw_accidents, including switchSubReason 0 or 2) -> "Аварійне відключення"
    // - switchSubReason === 1 -> "Графік аварійних відключень"
    // - switchSubReason === 3 -> "Спеціальний графік аварійних відключень"
    const isEmergencyRecord =
      item.typeOff === 1 ||
      item.switchSubReason === 1 ||
      item.switchSubReason === 3;
    if (!isEmergencyRecord) continue;

    if (targetCityNorm && item.city?.name) {
      const itemCityNorm = normalizePlaceName(item.city.name);
      if (itemCityNorm !== targetCityNorm) continue;
    }

    if (item.street?.name) {
      const itemStreetNorm = normalizeStreetName(item.street.name);
      if (itemStreetNorm !== targetStreetNorm) continue;
    } else {
      continue;
    }

    const housesList = (item.buildingNames || '')
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);

    if (!housesList.includes(targetHouseNorm)) continue;

    const startTime = formatZtoeOutageTimestamp(item.dateEvent || '');
    const estimatedRestoreTime = formatZtoeOutageTimestamp(item.datePlanIn || '');
    const outageType =
      item.switchSubReason === 1
        ? 'Графік аварійних відключень'
        : item.switchSubReason === 3
        ? 'Спеціальний графік аварійних відключень'
        : 'Аварійне відключення';

    return {
      id: item.id
        ? `pw_accident_${item.id}`
        : `pw_accident_${query.streetId}_${targetHouseNorm}_${startTime}`,
      startTime,
      estimatedRestoreTime,
      outageType,
    };
  }

  return null;
}

/**
 * Queries ZTOE for active emergency outages ("Аварійне відключення") affecting the user's house,
 * checking both any HTML table passed in and ZTOE's live pw_accidents service.
 */
export async function checkEmergencyOutageOnZtoe(
  query: SelectedAddressQuery,
  decodedHtml?: string
): Promise<EmergencyOutageInfo | null> {
  if (!query || !query.streetId || !query.house) return null;

  const streetObj = ZTOE_STREET_OPTIONS.find((st) => st.id === query.streetId);
  const remObj = ZTOE_REM_OPTIONS.find((r) => r.id === query.remId);
  const targetHouseNorm = query.house.trim().toLowerCase();

  // 1. Check HTML table if available
  if (decodedHtml) {
    const htmlEmergencyRows = parseZtoeEmergencyOutagesTableHtml(decodedHtml);
    const matchedHtmlRow = htmlEmergencyRows.find((r) => {
      if (r.house.toLowerCase() !== targetHouseNorm) return false;
      if (r.street && streetObj) {
        return normalizeStreetName(r.street) === normalizeStreetName(streetObj.nameUk);
      }
      return true;
    });
    if (matchedHtmlRow) {
      return {
        id: matchedHtmlRow.id,
        startTime: matchedHtmlRow.startTime,
        estimatedRestoreTime: matchedHtmlRow.estimatedRestoreTime,
        outageType: matchedHtmlRow.outageType,
      };
    }
  }

  // 2. Query ZTOE live pw_accidents API (prefer street.id filter so all street outages are returned directly)
  if (typeof fetch !== 'undefined' && (streetObj?.poweronStreetId || remObj?.ztoeOtgId)) {
    const querySuffix = streetObj?.poweronStreetId
      ? `/api/pw_accidents?street.id=${encodeURIComponent(streetObj.poweronStreetId)}`
      : `/api/pw_accidents?page=1&otg.id=${encodeURIComponent(remObj!.ztoeOtgId!)}&typeOff=1`;
    const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
    const candidateUrls = isBrowser
      ? [`/proxy-ztoe-poweron${querySuffix}`, `https://api-ztoe-poweron.inneti.net${querySuffix}`]
      : [`https://api-ztoe-poweron.inneti.net${querySuffix}`];

    for (const url of candidateUrls) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(url, {
          headers: { Accept: 'application/ld+json, application/json' },
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (res.ok) {
          const data = await res.json();
          const members: ZtoePwAccidentRecord[] = Array.isArray(data?.['hydra:member'])
            ? data['hydra:member']
            : Array.isArray(data)
            ? data
            : [];
          const matched = matchEmergencyOutageFromAccidentsJson(members, query);
          if (matched) {
            return matched;
          }
        }
      } catch {
        // Try next candidate URL or fall through
      }
    }
  }

  const localHouses = getHousesForStreet(query.streetId);
  const localMatch = localHouses.find((h) => h.house.toLowerCase() === targetHouseNorm);
  if (localMatch?.emergencyOutage) {
    return localMatch.emergencyOutage;
  }

  return null;
}

/**
 * Checks the user's selected address against https://www.ztoe.com.ua/unhooking-search.php
 * and ZTOE's live emergency outage table service so that:
 * 1) If an address without a queue receives a queue at a later stage, the app automatically updates the user's queue.
 * 2) If there is an active emergency outage ("Аварійне відключення") for the user's house, it returns emergencyOutage details.
 */
export async function checkAddressOnZtoeWebsite(
  query: SelectedAddressQuery,
  siteUrl?: string
): Promise<ZtoeHouseLookupResult | null> {
  if (!query || !query.streetId || !query.house) return null;

  const localHouses = getHousesForStreet(query.streetId);
  const localMatch =
    localHouses.find((h) => h.house.toLowerCase() === query.house.trim().toLowerCase()) || null;

  const remObj = ZTOE_REM_OPTIONS.find((r) => r.id === query.remId);
  const settlementObj = ZTOE_SETTLEMENT_OPTIONS.find((s) => s.id === query.settlementId);
  const streetObj = ZTOE_STREET_OPTIONS.find((st) => st.id === query.streetId);

  let decodedHtml: string | undefined;
  let resolvedResult: ZtoeHouseLookupResult | null = localMatch ? { ...localMatch } : null;

  if (
    typeof fetch !== 'undefined' &&
    remObj?.ztoeRemId &&
    settlementObj?.ztoeNaspunktId &&
    streetObj?.ztoeVulicaId
  ) {
    try {
      const targetEndpoint =
        !siteUrl || siteUrl.includes('ztoe.com.ua')
          ? '/proxy-ztoe/unhooking-search.php'
          : siteUrl;
      const bodyParams = new URLSearchParams({
        rem_id: remObj.ztoeRemId,
        naspunkt_id: settlementObj.ztoeNaspunktId,
        vulica_id: streetObj.ztoeVulicaId,
        all: '1',
      });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(targetEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: bodyParams.toString(),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        const win1251Text = new TextDecoder('windows-1251').decode(buffer);
        decodedHtml =
          win1251Text.includes('Черга') || win1251Text.includes('Будинки')
            ? win1251Text
            : new TextDecoder('utf-8').decode(buffer);
        const parsedRows = parseZtoeAddressLookupTableHtml(decodedHtml);
        const matchingRows = parsedRows.filter(
          (r) => r.house.toLowerCase() === query.house.trim().toLowerCase()
        );
        if (matchingRows.length > 0 && (!localMatch || localMatch.queue === '')) {
          // If the user selected a no-queue address (or the house had no queue locally),
          // keep the no-queue status as long as the ZTOE table still lists the no-outage message for this house.
          // Only assign a queue if the ZTOE table no longer has a no-queue status row for it.
          const noQueueRow = matchingRows.find((r) => !r.queue && r.statusText);
          if (noQueueRow) {
            resolvedResult = { ...noQueueRow };
          } else {
            const withQueueRow = matchingRows.find((r) => Boolean(r.queue));
            resolvedResult = { ...(withQueueRow || matchingRows[0]) };
          }
        }
      }
    } catch {
      // Fallback to local directory below
    }
  }

  const emergencyOutage = await checkEmergencyOutageOnZtoe(query, decodedHtml);
  if (resolvedResult) {
    resolvedResult.emergencyOutage = emergencyOutage;
  }

  return resolvedResult;
}

export function getSettlementsForRem(remId: string): ZtoeSettlementOption[] {
  return ZTOE_SETTLEMENT_OPTIONS.filter((s) => s.remId === remId);
}

export function getStreetsForSettlement(settlementId: string): ZtoeStreetOption[] {
  return ZTOE_STREET_OPTIONS.filter((st) => st.settlementId === settlementId);
}

export function getHousesForStreet(streetId: string): ZtoeHouseLookupResult[] {
  return ZTOE_STREET_HOUSES[streetId] || [];
}
