/**
 * Tests of the web SERVICE layer that mirrors the Android 1.4.0 logic: the PowerOn client (a port of
 * PowerOnClientTest.kt), the ztoe site-state classification and schedule cache, the outage repository
 * with a fake clock and fake network, the duplicate-street merge, and the alert planning.
 *
 * Run: tsx tests/services.test.ts
 */
import assert from 'node:assert/strict';
import { formatLocalDateTime, fromInstant, parseLocalDate, parseLocalDateTime, type LocalDateTime } from '../src/core/localTime';
import { EmergencyFetch, eventKey, type EmergencyEvent } from '../src/core/emergencyLedger';
import { makeOutage } from '../src/core/outageModels';
import { buildPlanned } from '../src/core/outageEngine';
import {
  POWERON_BASE_URL,
  PowerOnClient,
  cityKey,
  parseRows,
  type HttpGet,
  type PowerOnTarget,
} from '../src/services/poweronClient';
import { createMemoryStorage } from '../src/services/storage';
import {
  KEY_STORE as SUB_KEY_STORE,
  SubscriptionRepository,
  decode as subDecode,
  encode as subEncode,
  randomId as subRandomId,
} from '../src/services/subscriptionStore';
import {
  add as subAdd,
  makeSubscription,
  type LegacySettings,
  type SubscriptionAddress,
  type SubscriptionStore,
} from '../src/core/subscriptions';
import { ScheduleCache } from '../src/services/scheduleCache';
import { OutageStateStore } from '../src/services/outageStore';
import { OutageRepository, type AddressResolver } from '../src/services/outageRepository';
import {
  classifyFetchFailure,
  applyEmergencyOutageToSchedule,
  calculateOutageCountdown,
  fetchFullSchedules,
  fetchZtoeSchedule,
  DEFAULT_ZTOE_URL,
} from '../src/services/ztoeParser';
import {
  ZTOE_STREET_OPTIONS,
  checkAddressOnZtoeWebsite,
  getHousesForStreet,
  findStreetById,
  getStreetsForSettlement,
  mergeHouseLists,
  mergeStreets,
  parseZtoeAddressLookupTableHtml,
  parseZtoeSettlementHousesTableHtml,
  parseZtoeStreetOptionsHtml,
  resetAddressIndexCache,
  seedAddressIndexForTests,
} from '../src/services/ztoeAddressLookup';
import {
  DEFAULT_SETTINGS,
  checkAndTriggerAdvanceAlert,
  checkAndTriggerPlannedAlerts,
  clearNotifiedHistory,
  formatWhen,
  planPreWarnings,
  triggerEmergencyEventAlerts,
} from '../src/services/alertManager';
import { durationText, plannedAlertBody, translations } from '../src/services/i18n';
import type { UserSettings } from '../src/types';

const NBSP = ' ';
const dt = (s: string): LocalDateTime => parseLocalDateTime(s);

/** Epoch ms of a Kyiv wall-clock time in November 2026 (winter time, UTC+2). */
const kyivMs = (iso: string): number => Date.parse(`${iso}:00+02:00`.replace(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}):00(.*)$/, '$1:00$2'));

const tests: [string, () => void | Promise<void>][] = [];
const test = (name: string, fn: () => void | Promise<void>) => void tests.push([name, fn]);

// -------------------------------------------------------------------------------------------------
// PowerOn client (port of PowerOnClientTest.kt)
// -------------------------------------------------------------------------------------------------

class FakeHttp {
  readonly urls: string[] = [];
  constructor(
    private readonly routes: [string, string][],
    private readonly failOn: string | null = null
  ) {}
  get: HttpGet = async (url: string) => {
    this.urls.push(url);
    if (this.failOn !== null && url.includes(this.failOn)) throw new Error('boom');
    return this.routes.find(([k]) => url.includes(k))?.[1] ?? '[]';
  };
}

const today = parseLocalDate('2026-11-12');
const nowKyiv = dt('2026-11-12T23:57');

const accident = (streetId: number, street: string, city: string, building: string, start: string, end: string, sub = 0) =>
  `{"id":1,"city":{"id":333,"name":"${city}"},"street":{"id":${streetId},"name":"${street}"},"dateEvent":"${start}","datePlanIn":"${end}","koment":"МО","switchSubReason":${sub},"typeOff":1,"buildingNames":"${building}"}`;

test('PowerOn: resolves city then ALL merged street ids and queries with dotted filters', async () => {
  const http = new FakeHttp([
    ['pw_cities?name=', '[{"id":333,"name":"Житомир"}]'],
    ['pw_streets?city.id=333', '[{"id":33382,"name":"вул. Закам’янська"},{"id":33565,"name":"вул. Закам\'янська"},{"id":1,"name":"вул. Київська"}]'],
    ['pw_accidents', '[' + accident(33565, "вул. Закам'янська", 'Житомир', '5, 7', '2026-11-12T20:00:00+00:00', '2026-11-13T01:00:00+00:00') + ']'],
    ['pw_accident_planeds', '[]'],
  ]);
  const target: PowerOnTarget = { remOtgId: 6, settlementName: 'місто Житомир', streetNames: ["вул. Закам'янська", 'вул. Закам’янська'], house: '5' };
  const result = await new PowerOnClient(http.get, POWERON_BASE_URL).fetch(target, today, nowKyiv);

  assert.deepEqual(result.ids?.cityIds, [333]);
  assert.deepEqual(result.ids?.streetIds, [33382, 33565]);
  assert.equal(result.emergency.type, 'Confirmed');
  const records = result.emergency.type === 'Confirmed' ? result.emergency.records : [];
  assert.equal(records.length, 1);
  assert.equal(records[0].id, 'pw_2026-11-12T20:00');

  // The first request is the REM-scoped city lookup with the bare name (prefix stripped, URL encoded).
  assert.ok(http.urls[0].includes('pw_cities?name=%D0%96%D0%B8%D1%82%D0%BE%D0%BC%D0%B8%D1%80&otg.id=6&pagination=false'), http.urls[0]);
  const accidentsUrl = http.urls.find((u) => u.includes('pw_accidents')) as string;
  assert.ok(accidentsUrl.includes('street.id[]=33382&street.id[]=33565'), accidentsUrl);
  assert.ok(accidentsUrl.includes('switchSubReason[]=0&switchSubReason[]=1&switchSubReason[]=3'), accidentsUrl);
  assert.ok(accidentsUrl.endsWith('pagination=false'), accidentsUrl);
  // The ignored legacy parameter names must never be used.
  assert.ok(http.urls.every((u) => !/[?&](city|street|otg|code_otg)=/.test(u)), 'legacy filter names used');
  const planedsUrl = http.urls.find((u) => u.includes('pw_accident_planeds')) as string;
  assert.ok(planedsUrl.includes('datePlanIn[after]=2026-11-12'), planedsUrl);
});

test('PowerOn: cached ids skip resolution', async () => {
  const http = new FakeHttp([['pw_accidents', '[]'], ['pw_accident_planeds', '[]']]);
  const target: PowerOnTarget = { remOtgId: 6, settlementName: 'м. Житомир', streetNames: ['вул. Київська'], house: '37', cachedCityIds: [333], cachedStreetIds: [1] };
  await new PowerOnClient(http.get, POWERON_BASE_URL).fetch(target, today, nowKyiv);
  assert.ok(http.urls.every((u) => !u.includes('pw_cities') && !u.includes('pw_streets')));
  assert.ok(http.urls[0].includes('street.id[]=1'));
});

test('PowerOn: a failed accidents request is Unavailable, not "no outage"', async () => {
  const http = new FakeHttp([['pw_accident_planeds', '[]']], 'pw_accidents');
  const target: PowerOnTarget = { remOtgId: 6, settlementName: 'м. Житомир', streetNames: ['вул. Київська'], house: '37', cachedCityIds: [333], cachedStreetIds: [1] };
  const result = await new PowerOnClient(http.get, POWERON_BASE_URL).fetch(target, today, nowKyiv);
  assert.equal(result.emergency.type, 'Unavailable');
  assert.deepEqual(result.repairs, []);
});

test('PowerOn: failed planned works keep emergencies confirmed and repairs unknown (null)', async () => {
  const http = new FakeHttp([['pw_accidents', '[]']], 'pw_accident_planeds');
  const target: PowerOnTarget = { remOtgId: 6, settlementName: 'м. Житомир', streetNames: ['вул. Київська'], house: '37', cachedCityIds: [333], cachedStreetIds: [1] };
  const result = await new PowerOnClient(http.get, POWERON_BASE_URL).fetch(target, today, nowKyiv);
  assert.equal(result.emergency.type, 'Confirmed');
  assert.equal(result.repairs, null);
});

test('PowerOn: a resolution failure is Unavailable', async () => {
  const http = new FakeHttp([], 'pw_cities');
  const target: PowerOnTarget = { remOtgId: 6, settlementName: 'м. Житомир', streetNames: ['вул. Київська'], house: '37' };
  const result = await new PowerOnClient(http.get, POWERON_BASE_URL).fetch(target, today, nowKyiv);
  assert.equal(result.emergency.type, 'Unavailable');
});

test('PowerOn: city scope fallback filters rows by street key', async () => {
  const http = new FakeHttp([
    ['pw_cities?name=', '[{"id":502,"name":"Липники"}]'],
    ['pw_streets?city.id=502', '[{"id":9,"name":"вул. Інша"}]'],
    [
      'pw_accidents',
      '[' +
        accident(62411, 'вул. Лісна', 'Липники', '10', '2026-11-12T20:00:00+00:00', '2026-11-13T01:00:00+00:00') +
        ',' +
        accident(62412, 'вул. Польова', 'Липники', '10', '2026-11-12T21:00:00+00:00', '2026-11-13T02:00:00+00:00') +
        ']',
    ],
    ['pw_accident_planeds', '[]'],
  ]);
  const target: PowerOnTarget = { remOtgId: 7, settlementName: 'с. Липники', streetNames: ['вул. Лісна'], house: '10' };
  const result = await new PowerOnClient(http.get, POWERON_BASE_URL).fetch(target, today, nowKyiv);
  const records = result.emergency.type === 'Confirmed' ? result.emergency.records : [];
  assert.equal(records.length, 1);
  assert.equal(records[0].id, 'pw_2026-11-12T20:00');
  assert.ok((http.urls.find((u) => u.includes('pw_accidents')) as string).includes('city.id[]=502'));
});

test('PowerOn: parses a plain array and a hydra collection; cityKey ignores prefix, apostrophe and case', () => {
  const row = accident(1, 'вул. Київська', 'Житомир', '37', '2026-11-12T20:00:00+00:00', '2026-11-13T01:00:00+00:00');
  const plain = parseRows(`[${row}]`);
  const hydra = parseRows(`{"hydra:member":[${row}],"hydra:totalItems":1}`);
  assert.equal(plain.length, 1);
  assert.deepEqual(plain, hydra);
  assert.equal(plain[0].streetName, 'вул. Київська');
  assert.equal(plain[0].cityId, 333);
  assert.equal(plain[0].switchSubReason, 0);
  assert.deepEqual(parseRows('not json'), []);
  assert.equal(cityKey('місто Житомир'), cityKey('Житомир'));
  assert.equal(cityKey('с. Кам&#039;янка'), cityKey('Кам’янка'));
});

// -------------------------------------------------------------------------------------------------
// ztoe: fixture page, site state, schedule cache
// -------------------------------------------------------------------------------------------------

const QUEUE_IDS = ['1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2', '5.1', '5.2', '6.1', '6.2'];

/** off: half-hour index ranges [from, to) of queue 2.2; every other queue is on all day. */
function dayTable(dateLabel: string, off22: [number, number][]): string {
  const rows = QUEUE_IDS.map((q) => {
    const cells = Array.from({ length: 48 }, (_, i) => {
      const isOff = q === '2.2' && off22.some(([a, b]) => i >= a && i < b);
      return `<td style="background:${isOff ? '#ff0000' : '#00ff00'}">&nbsp;</td>`;
    }).join('');
    return `<tr><td>${q}</td>${cells}</tr>`;
  }).join('');
  return `<table><tr><td>Графік погодинних відключень на ${dateLabel}</td></tr>${rows}</table>`;
}

const page = (...tables: string[]) => `<html><body><div>Графіки</div>${tables.join('')}</body></html>`;
// 23:00-24:00 is half-hour cells 46..48, 00:00-01:00 is cells 0..2
const PAGE_12_AND_13 = page(dayTable('12.11.2026', [[46, 48]]), dayTable('13.11.2026', [[0, 2]]));
const PAGE_12_ONLY = page(dayTable('12.11.2026', [[46, 48]]));

test('ztoe: classifies the site state and never wipes the cache on failure', async () => {
  const cache = new ScheduleCache(createMemoryStorage());
  const now = new Date(kyivMs('2026-11-12T22:30'));
  const base = { cache, now };

  // 1. a page with tables -> AVAILABLE_WITH_TABLE, cached for all queues
  const ok = await fetchZtoeSchedule(DEFAULT_ZTOE_URL, '2.2', { ...base, fetchHtml: async () => PAGE_12_AND_13 });
  assert.equal(ok.siteState, 'AVAILABLE_WITH_TABLE');
  assert.equal(ok.status, 'SUCCESS');
  assert.equal(ok.todaySlots.length, 48);
  assert.equal(ok.hasTomorrowSchedule, true);
  assert.equal(cache.todayOffCells('2.2', today)?.filter(Boolean).length, 2);
  assert.equal(cache.todayOffCells('6.2', today)?.some(Boolean), false);
  assert.equal(cache.tomorrowOffCells('2.2', today)?.filter(Boolean).length, 2);

  // 2. the site does not answer (internet works) -> SITE_UNREACHABLE, cache untouched
  const down = await fetchZtoeSchedule(DEFAULT_ZTOE_URL, '2.2', { ...base, isOnline: () => true, fetchHtml: async () => { throw new TypeError('Failed to fetch'); } });
  assert.equal(down.siteState, 'SITE_UNREACHABLE');
  assert.equal(down.failure, 'CONNECT');
  assert.equal(down.status, 'NO_INTERNET');
  assert.equal(cache.todayOffCells('2.2', today)?.filter(Boolean).length, 2, 'cache survived the failure');

  // 3. HTTP error and timeout are SITE_UNREACHABLE too
  const http500 = await fetchZtoeSchedule(DEFAULT_ZTOE_URL, '2.2', { ...base, fetchHtml: async () => { throw new Error('HTTP_500'); } });
  assert.equal(http500.failure, 'HTTP_ERROR');
  assert.equal(http500.siteState, 'SITE_UNREACHABLE');
  const abort = new Error('aborted');
  abort.name = 'AbortError';
  const timeout = await fetchZtoeSchedule(DEFAULT_ZTOE_URL, '2.2', { ...base, fetchHtml: async () => { throw abort; } });
  assert.equal(timeout.failure, 'TIMEOUT');
  assert.equal(timeout.siteState, 'SITE_UNREACHABLE');

  // 4. offline device -> NO_INTERNET without a request
  let requests = 0;
  const offline = await fetchZtoeSchedule(DEFAULT_ZTOE_URL, '2.2', { ...base, isOnline: () => false, fetchHtml: async () => { requests++; return ''; } });
  assert.equal(offline.siteState, 'NO_INTERNET');
  assert.equal(requests, 0);

  // 5. the link drops during the request: classified after the failure -> NO_INTERNET
  let online = true;
  const dropped = await fetchZtoeSchedule(DEFAULT_ZTOE_URL, '2.2', {
    ...base,
    isOnline: () => online,
    fetchHtml: async () => {
      online = false;
      throw new TypeError('Failed to fetch');
    },
  });
  assert.equal(dropped.siteState, 'NO_INTERNET');

  // 6. 200 without a table -> AVAILABLE_NO_TABLE, cache untouched
  const noTable = await fetchZtoeSchedule(DEFAULT_ZTOE_URL, '2.2', { ...base, fetchHtml: async () => '<html><body>Графік ще не опубліковано</body></html>' });
  assert.equal(noTable.siteState, 'AVAILABLE_NO_TABLE');
  assert.equal(noTable.status, 'NO_QUEUES_FOUND');
  assert.equal(cache.todayOffCells('2.2', today)?.filter(Boolean).length, 2);

  // 7. a URL outside valid-urls.json drops the cache (a schedule from another source is meaningless)
  const invalid = await fetchZtoeSchedule('https://evil.example/schedule', '2.2', { ...base, fetchHtml: async () => PAGE_12_AND_13 });
  assert.equal(invalid.siteState, 'AVAILABLE_NO_TABLE');
  assert.equal(cache.todayOffCells('2.2', today), null);
});

test('ztoe: a page without a table but with the "УВАГА! ВАЖЛИВА ІНФОРМАЦІЯ!" notice carries its text, and the store keeps it only while there is no table', async () => {
  const cache = new ScheduleCache(createMemoryStorage());
  const page = '<html><body><h3>УВАГА! ВАЖЛИВА ІНФОРМАЦІЯ!\r\n<br>\r\nГрафіки погодинних відключень електроенергії наразі не діють.\r\n<br>\r\n<br>';
  const res = await fetchZtoeSchedule(DEFAULT_ZTOE_URL, '2.2', { cache, isOnline: () => true, now: new Date('2026-11-13T10:00:00Z'), fetchHtml: async () => page });
  assert.equal(res.siteState, 'AVAILABLE_NO_TABLE');
  assert.equal(res.notice, 'УВАГА! ВАЖЛИВА ІНФОРМАЦІЯ!\nГрафіки погодинних відключень електроенергії наразі не діють.');

  const store = new OutageStateStore(createMemoryStorage());
  store.saveSite('AVAILABLE_NO_TABLE', 1, res.notice ?? null);
  assert.equal(store.site()?.notice, res.notice);
  store.saveSite('SITE_UNREACHABLE', 2);
  assert.equal(store.site()?.notice, null, 'hidden while the site is unreachable');
  store.saveSite('AVAILABLE_NO_TABLE', 3, res.notice ?? null);
  store.saveSite('AVAILABLE_WITH_TABLE', 4);
  assert.equal(store.site()?.notice, null);
  store.saveSite('AVAILABLE_NO_TABLE', 5, null);
  assert.equal(store.site()?.notice, null, 'a table page answer forgot the old notice');
});

test('ztoe: classifyFetchFailure maps errors to the platform-neutral failure kinds', () => {
  const abort = new Error('x');
  abort.name = 'AbortError';
  assert.equal(classifyFetchFailure(abort), 'TIMEOUT');
  assert.equal(classifyFetchFailure(new Error('HTTP_503')), 'HTTP_ERROR');
  assert.equal(classifyFetchFailure(new TypeError('Failed to fetch')), 'CONNECT');
  assert.equal(classifyFetchFailure(new Error('getaddrinfo ENOTFOUND www.ztoe.com.ua')), 'DNS');
  assert.equal(classifyFetchFailure(new Error('unable to verify the first certificate')), 'TLS');
  assert.equal(classifyFetchFailure('weird'), 'OTHER');
});

test('schedule cache: yesterday tail, midnight rollover, tomorrow validity', () => {
  const cache = new ScheduleCache(createMemoryStorage());
  const cells = (ranges: [number, number][]) => Array.from({ length: 48 }, (_, i) => ranges.some(([a, b]) => i >= a && i < b));
  const d12 = parseLocalDate('2026-11-12');
  const d13 = parseLocalDate('2026-11-13');
  const d14 = parseLocalDate('2026-11-14');
  cache.saveSchedule('2.2', cells([[46, 48]]), cells([[0, 2]]), d12, 1);
  assert.equal(cache.hasValidTodayCache('2.2', d12), true);
  assert.equal(cache.hasTomorrowSchedule('2.2', d12), true);
  // after midnight the cached tomorrow table is promoted to today and yesterday is archived
  assert.deepEqual(cache.todayOffCells('2.2', d13), cells([[0, 2]]));
  assert.deepEqual(cache.yesterdayOffCells('2.2', d13), cells([[46, 48]]));
  assert.equal(cache.hasTomorrowSchedule('2.2', d13), false);
  // two days later nothing is valid, and the yesterday stamp no longer matches
  assert.equal(cache.hasValidTodayCache('2.2', d14), false);
  assert.equal(cache.yesterdayOffCells('2.2', d14), null);
  // a table shorter than 24 cells is not a cache
  cache.saveSchedule('1.1', [true, false], null, d13, 2);
  assert.equal(cache.todayOffCells('1.1', d13), null);
  cache.clear();
  assert.equal(cache.hasValidTodayCache('2.2', d13), false);
});

// -------------------------------------------------------------------------------------------------
// Outage repository (fake clock, fake ztoe, fake PowerOn)
// -------------------------------------------------------------------------------------------------

const KYIVSKA: AddressResolver = {
  rem: (id) => (id === 'zhytomyr' ? { id: 'zhytomyr', ztoeRemId: '7', ztoeOtgId: '6', nameUk: 'Житомирський РЕМ', nameEn: 'Zhytomyr REM' } : undefined),
  settlement: (id) => (id === 'zt_city' ? { id: 'zt_city', remId: 'zhytomyr', nameUk: 'м. Житомир', nameEn: 'Zhytomyr' } : undefined),
  street: (id) =>
    ['zt_kyivska', 'st_173934', 'st_999001'].includes(id)
      ? { id: 'zt_kyivska', allIds: ['zt_kyivska', 'st_999001'], settlementId: 'zt_city', nameUk: 'вул. Київська', nameEn: 'Kyivska' }
      : undefined,
  streetsForSettlement: () => [{ id: 'zt_kyivska', allIds: ['zt_kyivska', 'st_999001'], settlementId: 'zt_city', nameUk: 'вул. Київська', nameEn: 'Kyivska' }],
};

const settings22: UserSettings = {
  ...DEFAULT_SETTINGS,
  queue: '2.2',
  url: DEFAULT_ZTOE_URL,
  selectedAddress: 'м. Житомир, вул. Київська, 37',
  selectedAddressQuery: { remId: 'zhytomyr', settlementId: 'zt_city', streetId: 'zt_kyivska', house: '37' },
};

function makeRepo() {
  const clock = { ms: kyivMs('2026-11-12T22:30') };
  const online = { value: true };
  const ztoe = { html: PAGE_12_AND_13 as string | null };
  const poweron = { accidents: [] as string[], fail: false };
  const notified: { key: string; events: readonly EmergencyEvent[] }[] = [];
  const http: HttpGet = async (url) => {
    if (poweron.fail) throw new Error('network down');
    if (url.includes('pw_cities')) return '[{"id":333,"name":"Житомир"}]';
    if (url.includes('pw_streets')) return '[{"id":1,"name":"вул. Київська"}]';
    if (url.includes('pw_accident_planeds')) return '[]';
    if (url.includes('pw_accidents')) return `[${poweron.accidents.join(',')}]`;
    return '[]';
  };
  const repo = new OutageRepository({
    schedule: new ScheduleCache(createMemoryStorage()),
    store: new OutageStateStore(createMemoryStorage()),
    powerOn: new PowerOnClient(http, POWERON_BASE_URL),
    address: KYIVSKA,
    nowMs: () => clock.ms,
    notify: (_s, key, events) => void notified.push({ key, events }),
    ztoeOptions: {
      isOnline: () => online.value,
      fetchHtml: async () => {
        if (ztoe.html === null) throw new TypeError('Failed to fetch');
        return ztoe.html;
      },
    },
  });
  return { repo, clock, online, ztoe, poweron, notified };
}

const ACCIDENT_22_00_TO_23_30 = accident(1, 'вул. Київська', 'Житомир', '35, 37, 39', '2026-11-12T22:00:00+00:00', '2026-11-12T23:30:00+00:00');

test('repository: emergency + planned merge into one block, cells carry isPlanned and isEmergency', async () => {
  const { repo, poweron, notified } = makeRepo();
  poweron.accidents.push(ACCIDENT_22_00_TO_23_30);
  const out = await repo.refresh(settings22);

  assert.equal(out.siteState, 'AVAILABLE_WITH_TABLE');
  assert.equal(out.fetchStatus, 'SUCCESS');
  assert.equal(out.poweronOk, true);
  assert.deepEqual(out.events.map((e) => e.kind), ['START']);
  assert.equal(notified.length, 1);
  assert.equal(notified[0].key, repo.addressKey(settings22.selectedAddressQuery));
  assert.equal(notified[0].key, 'zt_city|' + 'byл kиїbcьka' + '|37');

  const snap = out.snapshot;
  assert.equal(snap.hasAddress, true);
  assert.equal(snap.plannedKnown, true);
  assert.equal(snap.tomorrowPublished, true);
  assert.equal(snap.isUnclear, false);
  assert.equal(snap.isStale, false);
  assert.equal(snap.site?.state, 'AVAILABLE_WITH_TABLE');
  assert.equal(snap.poweron?.ok, true);

  const st = snap.status();
  assert.equal(st.isOffNow, true);
  // emergency 22:00-23:30 touches the planned 23:00-01:00: one block until 01:00 (2 h 30 min from 22:30)
  assert.equal(st.countdownSeconds, 9000);
  assert.equal(st.nextSlotTime, '22:00 – 01:00');
  assert.equal(snap.featuredEmergency()?.kind, 'EMERGENCY');

  const slots = snap.slotsFor(snap.today);
  assert.equal(slots.length, 48);
  const at = (hhmm: string) => slots.find((s) => s.startTimeStr === hhmm)!;
  assert.deepEqual([at('21:30').isEmergency, at('21:30').isPlanned, at('21:30').status], [false, false, 'POWER_ON']);
  assert.deepEqual([at('22:00').isEmergency, at('22:00').isPlanned, at('22:00').status], [true, false, 'POWER_OFF']);
  assert.deepEqual([at('23:00').isEmergency, at('23:00').isPlanned], [true, true]);
  assert.deepEqual([at('23:30').isEmergency, at('23:30').isPlanned, at('23:30').status], [false, true, 'POWER_OFF']);
  assert.equal(slots[0].id, '2026-11-12_00:00_Q2.2');
  assert.equal(slots[47].endTimeStr, '24:00');
});

test('repository: a failed source keeps its previous data and never becomes "no outage"', async () => {
  const { repo, poweron, ztoe, online, clock, notified } = makeRepo();
  poweron.accidents.push(ACCIDENT_22_00_TO_23_30);
  await repo.refresh(settings22);
  notified.length = 0;

  // both sources fail (the internet works, the sites do not answer)
  clock.ms = kyivMs('2026-11-12T22:40');
  ztoe.html = null;
  poweron.fail = true;
  const failed = await repo.refresh(settings22);
  assert.equal(failed.siteState, 'SITE_UNREACHABLE');
  assert.equal(failed.poweronOk, false);
  assert.deepEqual(failed.events, []);
  assert.equal(notified.length, 0);
  const snap = failed.snapshot;
  assert.equal(snap.isStale, true, 'cached schedule shown with a stale mark');
  assert.equal(snap.plannedKnown, true);
  assert.equal(snap.status().isOffNow, true, 'the emergency is still there');
  assert.equal(snap.featuredEmergency() !== null, true);
  assert.equal(snap.poweron?.ok, false);
  assert.equal(snap.poweron?.lastOkMs, kyivMs('2026-11-12T22:30'));
  assert.equal(snap.site?.lastSuccessMs, kyivMs('2026-11-12T22:30'));

  // no internet at all
  online.value = false;
  const offline = await repo.refresh(settings22);
  assert.equal(offline.siteState, 'NO_INTERNET');
  assert.equal(offline.snapshot.plannedKnown, true);

  // recovery: PowerOn answers again WITHOUT the emergency -> it ends (END event), the planned block stays
  online.value = true;
  ztoe.html = PAGE_12_AND_13;
  poweron.fail = false;
  poweron.accidents.length = 0;
  clock.ms = kyivMs('2026-11-12T22:45');
  const ended = await repo.refresh(settings22);
  assert.deepEqual(ended.events.map((e) => e.kind), ['END']);
  assert.equal(ended.snapshot.featuredEmergency(), null);
  const next = ended.snapshot.status();
  assert.equal(next.isOffNow, false);
  assert.equal(next.nextSlotTime, '23:00 – 01:00');
  // the finished emergency stays listable today
  const rows = ended.snapshot.dayView(ended.snapshot.today).rows;
  assert.deepEqual(rows.map((r) => [r.outage.kind, r.status]), [['EMERGENCY', 'FINISHED'], ['PLANNED', 'UPCOMING']]);
});

test('repository: midnight rollover keeps the block over midnight whole (yesterday tail)', async () => {
  const { repo, ztoe, clock } = makeRepo();
  await repo.refresh(settings22); // 12.11 22:30 caches 12.11 and 13.11
  clock.ms = kyivMs('2026-11-13T00:10');
  ztoe.html = null; // site down after midnight
  const out = await repo.refresh(settings22);
  const snap = out.snapshot;
  assert.equal(snap.plannedKnown, true, 'tomorrow table was promoted to today');
  const st = snap.status();
  assert.equal(st.isOffNow, true);
  assert.equal(st.countdownSeconds, 50 * 60);
  const rows = snap.dayView(snap.today).rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].continuesFromPrevDay, true);
  assert.equal(rows[0].durationMinutes, 120, 'real length of the whole 23:00-01:00 block');
  assert.equal(rows[0].inDayMinutes, 60);
});

test('repository: no queue / no address / unclear states', async () => {
  const { repo, ztoe } = makeRepo();
  const none = repo.snapshot({ ...DEFAULT_SETTINGS, queue: '', selectedAddressQuery: undefined });
  assert.equal(none.hasAddress, false);
  assert.equal(none.isUnclear, false);
  assert.equal(none.plannedKnown, true);
  assert.deepEqual(none.slotsFor(none.today).some((s) => s.status === 'POWER_OFF'), false);

  // a queue with nothing cached and nothing else known: grey
  ztoe.html = null;
  const unclear = (await repo.refresh({ ...settings22, selectedAddressQuery: undefined })).snapshot;
  assert.equal(unclear.plannedKnown, false);
  assert.equal(unclear.isUnclear, true);
  assert.deepEqual(unclear.slotsFor(unclear.today), []);
  assert.equal(unclear.scheduleStatus().isUnclear, true);
  assert.equal(unclear.scheduleStatus().nextSlotTime, '--:-- - --:--');
});

test('repository: the address key survives a duplicate-street merge', () => {
  const { repo } = makeRepo();
  const a = repo.addressKey({ remId: 'zhytomyr', settlementId: 'zt_city', streetId: 'zt_kyivska', house: '37' });
  const b = repo.addressKey({ remId: 'zhytomyr', settlementId: 'zt_city', streetId: 'st_999001', house: '№ 37' });
  assert.equal(a, b);
  assert.equal(repo.addressKey({ remId: 'zhytomyr', settlementId: 'zt_city', streetId: 'zt_kyivska', house: '  ' }), null);
  assert.equal(repo.addressKey(undefined), null);
});

// -------------------------------------------------------------------------------------------------
// Duplicate streets (spec/ADDRESS_KEY.md section 5)
// -------------------------------------------------------------------------------------------------

test('streets: duplicates of one settlement merge into ONE option keeping all ids', () => {
  const merged = mergeStreets([
    { id: 'st_176316', settlementId: 'zt_city', ztoeVulicaId: '176316', nameUk: "вул. В'ячеслава Липинського", nameEn: 'a' },
    { id: 'st_174295', settlementId: 'zt_city', ztoeVulicaId: '174295', nameUk: 'вул. В’ячеслава Липинського', nameEn: 'b' },
    { id: 'st_1', settlementId: 'zt_city', ztoeVulicaId: '1', nameUk: 'вул. Шевченка', nameEn: 'c' },
    { id: 'st_2', settlementId: 'zt_city', ztoeVulicaId: '2', nameUk: 'вул. Тараса Шевченка', nameEn: 'd' },
    { id: 'st_3', settlementId: 'other', ztoeVulicaId: '3', nameUk: "вул. В'ячеслава Липинського", nameEn: 'e' },
  ]);
  assert.equal(merged.length, 4, 'Шевченка is not Тараса Шевченка, and another settlement stays apart');
  const vya = merged[0];
  assert.equal(vya.nameUk, "вул. В'ячеслава Липинського", 'the first display name stays');
  // canonical id: no static id here, so the member with the lowest ztoe id leads
  assert.equal(vya.id, 'st_174295');
  assert.deepEqual(vya.allIds, ['st_174295', 'st_176316']);
  assert.deepEqual(vya.ztoeVulicaIds, ['174295', '176316']);
  assert.equal(vya.ztoeVulicaId, '174295');
  // a static (non st_) id wins as the canonical one, whatever the order
  const withStatic = mergeStreets([
    { id: 'st_173935', settlementId: 'zt_city', ztoeVulicaId: '173935', nameUk: 'вул. Київська ', nameEn: 'x' },
    { id: 'zt_kyivska', settlementId: 'zt_city', ztoeVulicaId: '173934', poweronStreetId: '4757', nameUk: 'вул. Київська', nameEn: 'y' },
  ]);
  assert.equal(withStatic.length, 1);
  assert.equal(withStatic[0].id, 'zt_kyivska');
  assert.deepEqual(withStatic[0].allIds, ['zt_kyivska', 'st_173935']);
  assert.equal(withStatic[0].nameUk, 'вул. Київська ', 'the display name is the first one seen');
  assert.deepEqual(mergeStreets(withStatic), withStatic, 'merging is idempotent');
});

test('streets: ztoe <select> duplicates parse to one option; any merged id resolves; houses are the union', () => {
  resetAddressIndexCache(true);
  const html =
    '<select name="vulica_id"><option value="0">Оберіть</option>' +
    '<option value="176316">вул. В\'ячеслава Липинського</option>' +
    '<option value="174295">вул. В&#039;ячеслава  Липинського</option>' +
    '<option value="174537">вул. Закам\'янська</option><option value="174536">вул. Закам’янська</option>' +
    '<option value="5">вул. Шевченка</option><option value="6">вул. Тараса Шевченка</option></select>';
  const streets = parseZtoeStreetOptionsHtml('zt_city', html);
  assert.equal(streets.length, 4);
  const vya = streets.find((s) => s.nameUk.includes('Липинського'))!;
  assert.deepEqual(vya.ztoeVulicaIds, ['174295', '176316']);
  assert.equal(vya.allIds.length, 2);

  // houses of both ids, with the 34-А / 34А / 34A variants of one house
  const rows = (street: string, ...houses: string[]) => houses.map((h) => `<tr><td>Житомирський</td><td>м. Житомир</td><td>${street}</td><td>${h}</td><td>1</td><td>2</td><td></td></tr>`).join('');
  const table =
    '<table><tr><th>РЕМ</th><th>Населений пункт</th><th>Вулиця</th><th>Будинки</th><th>Черга</th><th>Підчерга</th><th>Примітка</th></tr>' +
    rows("вул. В'ячеслава Липинського", '1', '34-А') +
    rows('вул. В’ячеслава Липинського', '2', '34А') +
    rows('вул. Шевченка', '7') +
    rows('вул. Тараса Шевченка', '9') +
    '</table>';
  seedAddressIndexForTests({ streetsBySettlementId: { zt_city: streets } });
  const indexed = parseZtoeSettlementHousesTableHtml('zt_city', streets, table);
  // only streets that have rows are indexed, and only under the merged option's primary id
  assert.deepEqual(Object.keys(indexed).sort(), [vya.id, 'st_5', 'st_6'].sort());
  assert.deepEqual(indexed[vya.id].map((h) => h.house), ['1', '2', '34-А'], 'one list, 34-А and 34А are one house');

  // any id resolves the one option, and its houses
  for (const id of vya.allIds) {
    assert.equal(findStreetById(id)?.id, vya.id);
    assert.deepEqual(getHousesForStreet(id).map((h) => h.house), ['1', '2', '34-А']);
  }
  assert.equal(findStreetById('st_174295')?.id, vya.id);
  assert.equal(findStreetById('176316')?.id, vya.id, 'a bare ztoe vulica id resolves too');
  assert.equal(getStreetsForSettlement('zt_city').length, 4);
  // strict equality: Шевченка never picks up the houses of Тараса Шевченка
  const shev = streets.find((s) => s.nameUk === 'вул. Шевченка')!;
  assert.deepEqual(getHousesForStreet(shev.id).map((h) => h.house), ['7']);
  resetAddressIndexCache(true);
});

test('streets: the houses table may omit the street type, but only for a unique option', () => {
  resetAddressIndexCache(true);
  const row = (street: string, house: string) =>
    `<tr><td>Житомирський</td><td>м. Житомир</td><td>${street}</td><td>${house}</td><td>3</td><td>1</td><td></td></tr>`;
  const head = '<tr><th>РЕМ</th><th>Населений пункт</th><th>Вулиця</th><th>Будинки</th><th>Черга</th><th>Підчерга</th><th>Примітка</th></tr>';
  const only = mergeStreets([{ id: 'st_1', settlementId: 'zt_city', ztoeVulicaId: '1', nameUk: 'вул. Київська', nameEn: 'k' }]);
  assert.deepEqual(Object.keys(parseZtoeSettlementHousesTableHtml('zt_city', only, `<table>${head}${row('Київська', '5')}</table>`)), ['st_1']);
  const both = mergeStreets([
    { id: 'st_1', settlementId: 'zt_city', ztoeVulicaId: '1', nameUk: 'вул. Київська', nameEn: 'k' },
    { id: 'st_2', settlementId: 'zt_city', ztoeVulicaId: '2', nameUk: 'пров. Київська', nameEn: 'k' },
  ]);
  assert.deepEqual(parseZtoeSettlementHousesTableHtml('zt_city', both, `<table>${head}${row('Київська', '5')}</table>`), {}, 'ambiguous: no guess');
  assert.deepEqual(Object.keys(parseZtoeSettlementHousesTableHtml('zt_city', both, `<table>${head}${row('пров. Київська', '5')}</table>`)), ['st_2'], 'exact key still works');
  resetAddressIndexCache(true);
});

test('streets: an old index with duplicates heals on load, and old ids keep resolving', () => {
  resetAddressIndexCache(true);
  seedAddressIndexForTests({
    streetsBySettlementId: {
      zt_city: [
        { id: 'st_1', settlementId: 'zt_city', ztoeVulicaId: '1', nameUk: 'вул. Закам\'янська', nameEn: 'a' },
        { id: 'st_2', settlementId: 'zt_city', ztoeVulicaId: '2', nameUk: 'вул. Закам’янська', nameEn: 'b' },
      ],
    },
    housesByStreetId: { st_1: [{ house: '5', queue: '' }], st_2: [{ house: '5', queue: '1.2' }, { house: '7', queue: '2.1' }] },
  });
  assert.equal(getStreetsForSettlement('zt_city').length, 1);
  const houses = getHousesForStreet('st_2');
  assert.deepEqual(houses.map((h) => [h.house, h.queue]), [['5', '1.2'], ['7', '2.1']], 'the entry with a queue wins, one entry per HouseKey');
  assert.deepEqual(getHousesForStreet('st_1'), houses);
  resetAddressIndexCache(true);
});

test('streets: no demo emergency and no fake default houses in production data', () => {
  resetAddressIndexCache(true);
  assert.deepEqual(getHousesForStreet('zt_kyivska'), []);
  assert.ok(ZTOE_STREET_OPTIONS.every((s) => s.allIds.includes(s.id)));
  const rows = parseZtoeAddressLookupTableHtml('<table><tr><td>37</td><td>2</td><td>2</td></tr></table>');
  assert.ok(rows.every((r) => r.emergencyOutage === undefined));
  // name comparison is by key equality: a street filter never matches by substring
  const table =
    '<table><tr><th>РЕМ</th><th>Населений пункт</th><th>Вулиця</th><th>Будинки</th><th>Черга</th><th>Підчерга</th><th>Примітка</th></tr>' +
    '<tr><td>Житомирський</td><td>м. Житомир</td><td>вул. Тараса Шевченка</td><td>9</td><td>1</td><td>1</td><td></td></tr>' +
    '<tr><td>Житомирський</td><td>м. Житомир</td><td>вул. Шевченка</td><td>7</td><td>2</td><td>2</td><td></td></tr></table>';
  assert.deepEqual(parseZtoeAddressLookupTableHtml(table, 'вул. Шевченка').map((r) => r.house), ['7']);
  assert.deepEqual(mergeHouseLists([[{ house: '1', queue: '' }], [{ house: ' 1 ', queue: '3.1' }]]).map((h) => h.queue), ['3.1']);
});

test('streets: checkAddressOnZtoeWebsite asks once per merged vulica id and unions the rows', async () => {
  resetAddressIndexCache(true);
  const streets = [
    { id: 'zt_kyivska', settlementId: 'zt_city', ztoeVulicaId: '111', nameUk: "вул. Закам'янська", nameEn: 'a' },
    { id: 'st_222', settlementId: 'zt_city', ztoeVulicaId: '222', nameUk: 'вул. Закам’янська', nameEn: 'b' },
  ];
  seedAddressIndexForTests({ streetsBySettlementId: { zt_city: streets } });
  const bodies: string[] = [];
  const table = (street: string, house: string, q: string, sub: string) =>
    `<table><tr><th>РЕМ</th><th>Населений пункт</th><th>Вулиця</th><th>Будинки</th><th>Черга</th><th>Підчерга</th><th>Примітка</th></tr>` +
    `<tr><td>Житомирський</td><td>м. Житомир</td><td>${street}</td><td>${house}</td><td>${q}</td><td>${sub}</td><td></td></tr></table><p>Черга Будинки Оберіть</p>`;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
    bodies.push(String(init?.body));
    const html = String(init?.body).includes('vulica_id=222') ? table('вул. Закам’янська', '34А, 36', '4', '2') : table("вул. Закам'янська", '1', '1', '1');
    return { ok: true, arrayBuffer: async () => new TextEncoder().encode(html).buffer } as unknown as Response;
  }) as typeof fetch;
  try {
    const res = await checkAddressOnZtoeWebsite({ remId: 'zhytomyr', settlementId: 'zt_city', streetId: 'st_222', house: '34-А' });
    assert.equal(res?.queue, '4.2');
    assert.equal(bodies.length, 2);
    assert.ok(bodies.some((b) => b.includes('vulica_id=111')) && bodies.some((b) => b.includes('vulica_id=222')));
    assert.ok(bodies.every((b) => !b.includes('all=1')));
    assert.equal(res?.emergencyOutage, undefined);
  } finally {
    globalThis.fetch = realFetch;
    resetAddressIndexCache(true);
  }
});

// -------------------------------------------------------------------------------------------------
// Alerts (fake clock)
// -------------------------------------------------------------------------------------------------

const alertSettings: UserSettings = { ...DEFAULT_SETTINGS, queue: '2.2', notificationsEnabled: true, emergencyNotificationsEnabled: true };
const planned14to16 = () => buildPlanned(parseLocalDate('2026-11-13'), Array.from({ length: 48 }, (_, i) => i >= 28 && i < 32), null);

test('alerts: the plan is one alert per merged span with key planned_<ISO start>, never retroactive', () => {
  const plan = planPreWarnings(planned14to16(), dt('2026-11-13T13:00'), alertSettings);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].key, 'planned_2026-11-13T14:00');
  assert.equal(formatLocalDateTime(plan[0].fireAt), '2026-11-13T13:45');
  assert.equal(plan[0].durationMinutes, 120);
  assert.deepEqual(planPreWarnings(planned14to16(), dt('2026-11-13T13:50'), alertSettings), [], 'fireAt already passed');
  assert.deepEqual(planPreWarnings(planned14to16(), dt('2026-11-13T14:30'), alertSettings), [], 'the span has started');
  assert.deepEqual(planPreWarnings(planned14to16(), dt('2026-11-13T13:00'), { ...alertSettings, notificationsEnabled: false }), []);
});

test('alerts: fires once at fireAt with the engine text; never twice, never for a started span', () => {
  clearNotifiedHistory();
  const outages = planned14to16();
  const fired: string[] = [];
  const cb = (r: { message: string }) => void fired.push(r.message);
  assert.deepEqual(checkAndTriggerPlannedAlerts(outages, dt('2026-11-13T13:44'), alertSettings, 'uk', cb), []);
  const first = checkAndTriggerPlannedAlerts(outages, dt('2026-11-13T13:45'), alertSettings, 'uk', cb);
  assert.equal(first.length, 1);
  assert.equal(first[0].slotId, 'planned_2026-11-13T14:00');
  assert.equal(first[0].message, `Черга 2.2: відключення о 14:00 (через 15${NBSP}хв), орієнтовно до 16:00 (2${NBSP}год).`);
  assert.equal(first[0].title, translations.uk.plannedAlertTitle);
  assert.deepEqual(checkAndTriggerPlannedAlerts(outages, dt('2026-11-13T13:50'), alertSettings, 'uk', cb), [], 'deduped by key');
  assert.equal(fired.length, 1);

  // a late tick (throttled tab) still alerts while the outage has not begun; "starting now" within the 2 minute tolerance
  clearNotifiedHistory();
  const late = checkAndTriggerPlannedAlerts(outages, dt('2026-11-13T14:01'), alertSettings, 'en');
  assert.equal(late.length, 1);
  assert.ok(late[0].message.startsWith('Queue 2.2: outage is starting now, at 14:00'), late[0].message);
  clearNotifiedHistory();
  assert.deepEqual(checkAndTriggerPlannedAlerts(outages, dt('2026-11-13T14:05'), alertSettings, 'uk'), [], 'already started');
  assert.deepEqual(checkAndTriggerPlannedAlerts(outages, dt('2026-11-13T15:00'), alertSettings, 'uk'), [], 'in progress');
  clearNotifiedHistory();
  assert.deepEqual(checkAndTriggerPlannedAlerts(outages, dt('2026-11-13T13:50'), { ...alertSettings, notificationsEnabled: false }, 'uk'), []);
  clearNotifiedHistory();
});

test('alerts: consecutive slots, a repair next to them and an emergency are ONE span; stale emergencies never alert', () => {
  clearNotifiedHistory();
  const planned = planned14to16();
  const repair = makeOutage({ id: 'repair_x', kind: 'REPAIR', start: dt('2026-11-13T16:00'), end: dt('2026-11-13T17:00') });
  const emergency = makeOutage({ id: 'pw_x', kind: 'EMERGENCY', start: dt('2026-11-13T17:00'), end: dt('2026-11-13T18:00') });
  const stale = makeOutage({ id: 'pw_stale', kind: 'EMERGENCY', start: dt('2026-11-13T20:00'), end: dt('2026-11-13T21:00'), stale: true });
  const fired = checkAndTriggerPlannedAlerts([...planned, repair, emergency, stale], dt('2026-11-13T13:45'), alertSettings, 'uk');
  assert.equal(fired.length, 1);
  assert.ok(fired[0].message.includes('орієнтовно до 17:00 (3'), fired[0].message);
  const planOnly = planPreWarnings([stale], dt('2026-11-13T10:00'), alertSettings);
  assert.deepEqual(planOnly, []);
  clearNotifiedHistory();
});

test('alerts: legacy checkAndTriggerAdvanceAlert is engine based (one notification per continuous block)', () => {
  clearNotifiedHistory();
  const slots = Array.from({ length: 48 }, (_, i) => ({
    id: `s${i}`,
    startHour: Math.floor(i / 2),
    endHour: Math.floor((i + 1) / 2),
    startMinute: (i % 2) * 30,
    endMinute: ((i + 1) % 2) * 30,
    startTimeStr: '',
    endTimeStr: '',
    status: i >= 28 && i < 32 ? ('POWER_OFF' as const) : ('POWER_ON' as const),
  }));
  const sched = { dateStr: '2026-11-13', dayLabel: 'x', queue: '2.2', city: 'c', sourceUrl: '', lastUpdated: '', isUnclear: false, slots };
  // 13:44 is before the 15 minute window; 13:45 is inside it (the legacy clock is the schedule's date with the local time of day)
  assert.equal(checkAndTriggerAdvanceAlert(sched, alertSettings, 'uk', undefined, new Date(2026, 10, 13, 13, 44, 0)), null);
  const record = checkAndTriggerAdvanceAlert(sched, alertSettings, 'uk', undefined, new Date(2026, 10, 13, 13, 45, 0));
  assert.equal(record?.slotId, 'planned_2026-11-13T14:00');
  assert.equal(checkAndTriggerAdvanceAlert(sched, alertSettings, 'uk', undefined, new Date(2026, 10, 13, 13, 46, 0)), null, 'once per block');
  // emergency-flagged cells are not planned outages
  clearNotifiedHistory();
  const emergencyOnly = { ...sched, slots: slots.map((s) => (s.status === 'POWER_OFF' ? { ...s, isEmergency: true } : s)) };
  assert.equal(checkAndTriggerAdvanceAlert(emergencyOnly, alertSettings, 'uk', undefined, new Date(2026, 10, 13, 13, 45, 0)), null);
  clearNotifiedHistory();
});

const ev = (kind: EmergencyEvent['kind'], start: string, eta: string | null, extra: Partial<EmergencyEvent> = {}): EmergencyEvent => ({
  kind,
  entryId: 'pw_x',
  start: dt(start),
  eta: eta === null ? null : dt(eta),
  upcoming: false,
  earlyEnd: false,
  ...extra,
});

test('alerts: emergency events use their own switch, dedupe keys and the Android texts', () => {
  clearNotifiedHistory();
  const now = dt('2026-11-13T17:35');
  const key = 'zt_city|key|37';
  const events = [ev('START', '2026-11-13T17:30', '2026-11-13T19:30'), ev('ETA_CHANGED', '2026-11-13T17:30', '2026-11-13T20:00'), ev('END', '2026-11-13T17:30', null)];
  assert.equal(eventKey(events[0], key), 'emerg_start_zt_city|key|37_2026-11-13T17:30');
  assert.equal(eventKey(events[1], key), 'emerg_change_zt_city|key|37_2026-11-13T17:30_2026-11-13T20:00');

  // the master switch does not affect emergency alerts; the emergency switch does
  const off = { ...alertSettings, emergencyNotificationsEnabled: false, notificationsEnabled: true };
  assert.deepEqual(triggerEmergencyEventAlerts(events, key, off, 'uk', now), []);
  const onlyEmergency = { ...alertSettings, notificationsEnabled: false, emergencyNotificationsEnabled: true, selectedAddress: 'м. Житомир,\nвул. Київська, 37' };
  const fired = triggerEmergencyEventAlerts(events, key, onlyEmergency, 'uk', now);
  assert.deepEqual(fired.map((r) => r.slotId), events.map((e) => eventKey(e, key)));
  assert.equal(fired[0].title, 'Аварійне відключення');
  assert.equal(fired[0].message, 'Початок: 17:30. Орієнтовне відновлення: 19:30.\nм. Житомир, вул. Київська, 37');
  assert.equal(fired[1].title, 'Змінився час відновлення');
  assert.ok(fired[1].message.startsWith('Нове орієнтовне відновлення: 20:00.'));
  assert.equal(fired[2].title, 'Аварійне відключення завершено');
  assert.ok(fired[2].message.startsWith('Електропостачання за вашою адресою відновлено (початок був: 17:30).'));
  // never twice
  assert.deepEqual(triggerEmergencyEventAlerts(events, key, onlyEmergency, 'uk', now), []);

  clearNotifiedHistory();
  const upcoming = triggerEmergencyEventAlerts([ev('START', '2026-11-13T22:00', null, { upcoming: true })], key, onlyEmergency, 'en', now);
  assert.equal(upcoming[0].title, 'Emergency outage scheduled');
  assert.ok(upcoming[0].message.startsWith('Start: 22:00. Restoration time unknown.'));
  clearNotifiedHistory();
});

test('alerts: formatWhen and duration formatting', () => {
  const td = parseLocalDate('2026-11-13');
  assert.equal(formatWhen('uk', dt('2026-11-13T22:04'), td), '22:04');
  assert.equal(formatWhen('uk', dt('2026-11-14T01:00'), td), 'завтра 01:00');
  assert.equal(formatWhen('en', dt('2026-11-12T23:30'), td), 'yesterday 23:30');
  assert.equal(formatWhen('uk', dt('2026-11-20T08:05'), td), '20.11 08:05');
  assert.equal(durationText('uk', 120), `2${NBSP}год`);
  assert.equal(durationText('uk', 90), `1${NBSP}год 30${NBSP}хв`);
  assert.equal(durationText('en', 45), `45${NBSP}min`);
  assert.equal(
    plannedAlertBody('uk', '', '22:00', '24:00', 0, 120, true),
    `відключення розпочинається зараз, о 22:00, орієнтовно до 24:00 (2${NBSP}год), можливе продовження.`
  );
});

// -------------------------------------------------------------------------------------------------
// Legacy wrappers over the engine
// -------------------------------------------------------------------------------------------------

test('legacy: applyEmergencyOutageToSchedule and calculateOutageCountdown are engine wrappers', async () => {
  const cells = Array.from({ length: 48 }, (_, i) => i >= 46);
  const mk = (dateStr: string, off: boolean[]) => ({
    dateStr,
    dayLabel: 'x',
    queue: '2.2',
    city: 'c',
    sourceUrl: '',
    lastUpdated: '',
    isUnclear: false,
    slots: off.map((o, i) => ({
      id: `${dateStr}_${i}`,
      startHour: Math.floor(i / 2),
      endHour: Math.floor((i + 1) / 2),
      startMinute: (i % 2) * 30,
      endMinute: ((i + 1) % 2) * 30,
      startTimeStr: '',
      endTimeStr: '',
      status: o ? ('POWER_OFF' as const) : ('POWER_ON' as const),
    })),
  });
  const today12 = mk('2026-11-12', cells);
  const merged = applyEmergencyOutageToSchedule(today12, { id: 'e', startTime: '12.11.2026 20:00', estimatedRestoreTime: '12.11.2026 21:30' }, false)!;
  assert.equal(merged.slots.length, 48);
  assert.deepEqual(
    merged.slots.map((s, i) => (s.isEmergency ? i : -1)).filter((i) => i >= 0),
    [40, 41, 42]
  );
  assert.equal(merged.slots[46].status, 'POWER_OFF');
  assert.equal(merged.slots[46].isEmergency, undefined);
  assert.equal(applyEmergencyOutageToSchedule(today12, null, false), today12);

  // an outage 23:00-01:00 across midnight: countdown at 23:30 runs to 01:00 when tomorrow starts off
  const tomorrow = mk('2026-11-13', Array.from({ length: 48 }, (_, i) => i < 2));
  const info = calculateOutageCountdown(today12, new Date(2026, 10, 12, 23, 30, 0), tomorrow);
  assert.equal(info.isCurrentlyBlackout, true);
  assert.equal(info.formattedTimeLeft, '01:30:00');
  assert.equal(info.slotDescription, '23:00 – 01:00');
  const unclear = calculateOutageCountdown({ ...today12, slots: [], isUnclear: true }, new Date());
  assert.equal(unclear.isUnclear, true);
  assert.equal(unclear.slotDescription, '--:-- - --:--');
});

test('core: fromInstant gives the Kyiv wall clock', () => {
  assert.equal(formatLocalDateTime(fromInstant(Date.parse('2026-11-12T21:57:00Z'))), '2026-11-12T23:57');
  assert.equal(formatLocalDateTime(fromInstant(Date.parse('2026-07-01T21:30:00Z'))), '2026-07-02T00:30'); // summer time, UTC+3
});

// -------------------------------------------------------------------------------------------------
// Subscription store (mirrors SubscriptionRepositoryTest.kt)
// -------------------------------------------------------------------------------------------------

const SUB_ADDRESS: SubscriptionAddress = {
  remSlug: 'zhytomyr',
  settlementId: '16657',
  streetId: 'st_123',
  streetName: 'вул. Київська',
  house: '77',
  text: 'Житомирський РЕМ, м. Житомир, вул. Київська, буд. 77',
};

const subLegacy = (notif = true, emerg = true): LegacySettings => ({
  queue: '5.2',
  customQueueStatusText: null,
  selectedAddress: SUB_ADDRESS.text,
  remSlug: 'zhytomyr',
  settlementId: '16657',
  streetId: 'st_123',
  streetName: 'вул. Київська',
  house: '77',
  notificationsEnabled: notif,
  emergencyNotificationsEnabled: emerg,
});

const subIds = (...ids: string[]) => {
  let i = 0;
  return () => ids[i++];
};

test('subscriptions: absent store migrates once and writes both keys', () => {
  const storage = createMemoryStorage();
  const repo = new SubscriptionRepository(storage, () => 1000, subIds('k3f9x2qd', 'zzzzzzzz'));
  assert.equal(repo.read(), null);
  let legacyCalls = 0;
  const store = repo.ensureMigrated(() => {
    legacyCalls++;
    return subLegacy(false, false);
  });
  assert.equal(store.primaryId, 'k3f9x2qd');
  assert.equal(store.items.length, 1);
  assert.equal(repo.alertsMaster(), false);
  assert.notEqual(storage.getItem(SUB_KEY_STORE), null);
  const again = repo.ensureMigrated(() => {
    legacyCalls++;
    return subLegacy();
  });
  assert.deepStrictEqual(again, store);
  assert.equal(legacyCalls, 1);
  assert.equal(repo.alertsMaster(), false);
});

test('subscriptions: unreadable or other-version text migrates again', () => {
  for (const text of ['not json', '{"schemaVersion":2,"items":[]}', '[]', '']) {
    const storage = createMemoryStorage();
    storage.setItem(SUB_KEY_STORE, text);
    const repo = new SubscriptionRepository(storage, () => 1, subIds('abcd1234'));
    assert.equal(repo.read(), null, text);
    assert.equal(repo.ensureMigrated(() => subLegacy()).primaryId, 'abcd1234', text);
  }
});

test('subscriptions: encode/decode round trip keeps nulls', () => {
  const store: SubscriptionStore = {
    primaryId: 'aaaa0001',
    items: [
      makeSubscription('aaaa0001', {
        address: SUB_ADDRESS,
        queueSource: 'LOOKUP',
        queueStatusText: 'Не підлягає відключенням',
        createdAtMs: 1794500000000,
      }),
      makeSubscription('aaaa0002', { label: 'Дача', queue: '3.1', plannedAlerts: false }),
    ],
  };
  const text = subEncode(store);
  const json = JSON.parse(text);
  assert.ok('queue' in json.items[0] && json.items[0].queue === null, 'null fields are written explicitly');
  assert.equal(json.items[1].address, null);
  assert.deepStrictEqual(subDecode(text), store);
});

test('subscriptions: mutate writes only on success', () => {
  const storage = createMemoryStorage();
  const repo = new SubscriptionRepository(storage, Date.now, subIds('q1q1q1q1'));
  repo.ensureMigrated(() => subLegacy());
  const before = storage.getItem(SUB_KEY_STORE);
  const dup = repo.mutate((s) =>
    subAdd(s, makeSubscription('bbbb0001', { address: { ...SUB_ADDRESS, streetName: 'вулиця Київська' }, queue: '5.2' })),
  );
  assert.deepStrictEqual(dup, { ok: false, code: 'duplicate', existingId: 'q1q1q1q1' });
  assert.equal(storage.getItem(SUB_KEY_STORE), before);
  const ok = repo.mutate((s) => subAdd(s, makeSubscription('bbbb0002', { queue: '1.1' })));
  assert.equal(ok.ok, true);
  assert.deepStrictEqual(repo.store().items.map((s) => s.id), ['q1q1q1q1', 'bbbb0002']);
});

test('subscriptions: newItemId skips ids in use and randomId has the id shape', () => {
  const repo = new SubscriptionRepository(createMemoryStorage(), Date.now, subIds('aaaa0001', 'aaaa0001', 'BAD!', 'aaaa0002'));
  repo.ensureMigrated(() => subLegacy());
  assert.equal(repo.newItemId(), 'aaaa0002');
  for (let i = 0; i < 50; i++) assert.match(subRandomId(), /^[a-z0-9]{8}$/);
});

// -------------------------------------------------------------------------------------------------

async function main() {
  let failed = 0;
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`PASS ${name}`);
    } catch (e) {
      failed++;
      console.error(`FAIL ${name}`);
      console.error(e instanceof Error ? (e.stack ?? e.message) : e);
    }
  }
  if (failed > 0) {
    console.error(`${failed} of ${tests.length} service tests failed`);
    process.exit(1);
  }
  console.log(`All ${tests.length} service tests passed`);
}

void main();
