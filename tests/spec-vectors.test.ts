/**
 * Runs the platform-neutral golden vectors in spec/vectors/ against the TypeScript core in
 * src/core/. Performs exactly the comparisons of
 * android/app/src/test/java/ua/blackout/prewarning/core/SpecVectorsTest.kt, which is how parity
 * between the implementations is machine-checked.
 *
 * Run: tsx tests/spec-vectors.test.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {
  formatLocalDateTime,
  parseLocalDate,
  parseLocalDateTime,
  type LocalDateTime,
} from '../src/core/localTime';
import { makeOutage, type EmergencyRecord, type Outage } from '../src/core/outageModels';
import { buildPlanned, dayView, inWindow, planAlerts, resolveEmergency, spans, status } from '../src/core/outageEngine';
import { HouseKey, StreetKey, TextNorm } from '../src/core/addressKeys';
import { EmergencyFetch, eventKey, reconcile, type LedgerEntry } from '../src/core/emergencyLedger';
import { PowerOnMapper, type PowerOnRow } from '../src/core/poweronMapper';
import { FETCH_FAILURES, SITE_STATES, SiteStateResolver, type FetchFailure, type SiteState } from '../src/core/siteState';
import { extractSiteNotice } from '../src/core/siteNotice';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

function specDir(): string {
  let dir = path.resolve(process.cwd());
  for (;;) {
    const candidate = path.join(dir, 'spec', 'vectors');
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`spec/vectors not found above ${process.cwd()}`);
    dir = parent;
  }
}

const SPEC_DIR = specDir();
const REPO_ROOT = path.dirname(path.dirname(SPEC_DIR));
const load = (name: string): Json => JSON.parse(fs.readFileSync(path.join(SPEC_DIR, name), 'utf8'));

/** JSONObject.optString-like: absent or JSON null -> null. */
const optStr = (o: Json, key: string): string | null => (o[key] === undefined || o[key] === null ? null : String(o[key]));
const has = (o: Json, key: string): boolean => Object.prototype.hasOwnProperty.call(o, key);
const dt = (s: string | null): LocalDateTime | null => (s === null ? null : parseLocalDateTime(s));
const dtStr = (t: LocalDateTime | null): string | null => (t === null ? null : formatLocalDateTime(t));

// -------------------------------------------------------------------------------------------------
// outage_engine.json
// -------------------------------------------------------------------------------------------------

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
  return h * 60 + m;
}

function cells(ranges: string[] | undefined | null): boolean[] | null {
  if (ranges == null) return null;
  const arr = new Array<boolean>(48).fill(false);
  for (const r of ranges) {
    const [a, b] = r.split('-');
    for (let k = toMin(a) / 30; k < toMin(b) / 30; k++) arr[k] = true;
  }
  return arr;
}

function rangesOf(flags: readonly boolean[]): string[] {
  const fmt = (slot: number) =>
    slot === 48 ? '24:00' : `${String(Math.floor(slot / 2)).padStart(2, '0')}:${String((slot % 2) * 30).padStart(2, '0')}`;
  const out: string[] = [];
  let start = -1;
  for (let i = 0; i <= flags.length; i++) {
    const on = i < flags.length && flags[i];
    if (on && start < 0) start = i;
    if (!on && start >= 0) {
      out.push(`${fmt(start)}-${fmt(i)}`);
      start = -1;
    }
  }
  return out;
}

function outageEngineVectors(): number {
  const cases: Json[] = load('outage_engine.json').cases;
  assert.ok(cases.length >= 20, 'outage_engine.json must hold at least 20 cases');
  for (const c of cases) {
    const name: string = c.name;
    const today = parseLocalDate(c.today);
    const now = parseLocalDateTime(c.now);
    const advance: number = typeof c.advanceMinutes === 'number' ? c.advanceMinutes : 15;
    const p: Json = c.planned ?? {};

    const outages: Outage[] = [];
    outages.push(...buildPlanned(today, cells(p.today), cells(p.tomorrow), cells(p.yesterday)));
    for (const it of (c.repair ?? []) as Json[]) {
      outages.push(makeOutage({ id: it.id, kind: 'REPAIR', start: parseLocalDateTime(it.start), end: parseLocalDateTime(it.end) }));
    }
    for (const it of (c.emergencies ?? []) as Json[]) {
      const rec: EmergencyRecord = {
        id: it.id,
        start: parseLocalDateTime(it.start),
        estimatedEnd: dt(optStr(it, 'estimatedEnd')),
        closedAt: dt(optStr(it, 'closedAt')),
        label: optStr(it, 'label'),
      };
      outages.push(resolveEmergency(rec, now));
    }
    const window = inWindow(outages, today);
    const expect: Json = c.expect;

    if (expect.status) {
      const s = expect.status;
      const st = status(window, now);
      assert.equal(st.isOffNow, s.isOffNow, `${name}: isOffNow`);
      assert.equal(st.countdownText, s.countdownText, `${name}: countdownText`);
      assert.equal(st.nextSlotTime, s.nextSlotTime, `${name}: nextSlotTime`);
    }

    if (Array.isArray(expect.spans)) {
      const exp: Json[] = expect.spans;
      const got = spans(window.filter((o) => !o.stale));
      assert.equal(got.length, exp.length, `${name}: span count`);
      exp.forEach((e, i) => {
        assert.equal(formatLocalDateTime(got[i].start), e.start, `${name}: span[${i}].start`);
        assert.equal(formatLocalDateTime(got[i].end), e.end, `${name}: span[${i}].end`);
        assert.equal(got[i].mayContinue, e.mayContinue, `${name}: span[${i}].mayContinue`);
      });
    }

    if (Array.isArray(expect.alerts)) {
      const exp: Json[] = expect.alerts;
      const alerts = planAlerts(window, now, advance);
      assert.equal(alerts.length, exp.length, `${name}: alert count`);
      exp.forEach((e, i) => {
        assert.equal(alerts[i].key, e.key, `${name}: alert[${i}].key`);
        assert.equal(formatLocalDateTime(alerts[i].fireAt), e.fireAt, `${name}: alert[${i}].fireAt`);
        assert.equal(formatLocalDateTime(alerts[i].spanEnd), e.spanEnd, `${name}: alert[${i}].spanEnd`);
        assert.equal(alerts[i].durationMinutes, e.durationMinutes, `${name}: alert[${i}].durationMinutes`);
      });
    }

    if (expect.days) {
      for (const dateKey of Object.keys(expect.days)) {
        const d: Json = expect.days[dateKey];
        const view = dayView(window, parseLocalDate(dateKey), now);
        if (has(d, 'totalOffMinutes')) assert.equal(view.totalOffMinutes, d.totalOffMinutes, `${name}/${dateKey}: total`);
        if (Array.isArray(d.plannedCells)) {
          assert.deepEqual(rangesOf(view.slots.map((s) => s.planned)), d.plannedCells, `${name}/${dateKey}: plannedCells`);
        }
        if (Array.isArray(d.emergencyCells)) {
          assert.deepEqual(rangesOf(view.slots.map((s) => s.emergency)), d.emergencyCells, `${name}/${dateKey}: emergencyCells`);
        }
        if (Array.isArray(d.rows)) {
          const exp: Json[] = d.rows;
          assert.equal(view.rows.length, exp.length, `${name}/${dateKey}: row count`);
          exp.forEach((e, i) => {
            const r = view.rows[i];
            const tag = `${name}/${dateKey}: row[${i}]`;
            if (has(e, 'kind')) assert.equal(r.outage.kind, e.kind, `${tag}.kind`);
            if (has(e, 'from')) assert.equal(formatLocalDateTime(r.from), e.from, `${tag}.from`);
            if (has(e, 'to')) assert.equal(formatLocalDateTime(r.to), e.to, `${tag}.to`);
            if (has(e, 'status')) assert.equal(r.status, e.status, `${tag}.status`);
            if (has(e, 'continuesFromPrevDay')) assert.equal(r.continuesFromPrevDay, e.continuesFromPrevDay, `${tag}.continuesFromPrevDay`);
            if (has(e, 'continuesToNextDay')) assert.equal(r.continuesToNextDay, e.continuesToNextDay, `${tag}.continuesToNextDay`);
            if (has(e, 'durationMinutes')) assert.equal(r.durationMinutes, e.durationMinutes, `${tag}.durationMinutes`);
            if (has(e, 'inDayMinutes')) assert.equal(r.inDayMinutes, e.inDayMinutes, `${tag}.inDayMinutes`);
          });
        }
      }
    }
  }
  return cases.length;
}

// -------------------------------------------------------------------------------------------------
// emergency_ledger.json
// -------------------------------------------------------------------------------------------------

function emergencyLedgerVectors(): number {
  const cases: Json[] = load('emergency_ledger.json').cases;
  assert.ok(cases.length >= 8, 'emergency_ledger.json must hold at least 8 cases');
  for (const c of cases) {
    const name: string = c.name;
    const addressKey: string = c.addressKey;
    let entries: readonly LedgerEntry[] = [];
    (c.steps as Json[]).forEach((step, stepIdx) => {
      const now = parseLocalDateTime(step.now);
      const fetchJson: Json = step.fetch;
      const fetchResult = has(fetchJson, 'unavailable')
        ? EmergencyFetch.Unavailable('test')
        : EmergencyFetch.Confirmed(
            (fetchJson.confirmed as Json[]).map(
              (it): EmergencyRecord => ({
                id: it.id,
                start: parseLocalDateTime(it.start),
                estimatedEnd: dt(optStr(it, 'estimatedEnd')),
                closedAt: null,
                label: optStr(it, 'label'),
              })
            )
          );
      const result = reconcile(entries, fetchResult, now);
      entries = result.entries;
      const expected: Json[] = step.events;
      assert.equal(result.events.length, expected.length, `${name} step ${stepIdx}: event count`);
      expected.forEach((e, i) => {
        const ev = result.events[i];
        assert.equal(ev.kind, e.kind, `${name} step ${stepIdx}: kind`);
        assert.equal(eventKey(ev, addressKey), e.key, `${name} step ${stepIdx}: key`);
        if (has(e, 'upcoming')) assert.equal(ev.upcoming, e.upcoming, `${name} step ${stepIdx}: upcoming`);
        if (has(e, 'earlyEnd')) assert.equal(ev.earlyEnd, e.earlyEnd, `${name} step ${stepIdx}: earlyEnd`);
      });
    });
  }
  return cases.length;
}

// -------------------------------------------------------------------------------------------------
// address_keys.json
// -------------------------------------------------------------------------------------------------

function addressKeyVectors(): number {
  const v: Json = load('address_keys.json');
  let checks = 0;
  for (const names of v.streetEqual as string[][]) {
    const keys = new Set(names.map((n) => StreetKey.of(n)));
    assert.equal(keys.size, 1, `streetEqual should collapse to one key: ${JSON.stringify(names)} -> ${JSON.stringify([...keys])}`);
    checks++;
  }
  for (const [a, b] of v.streetDistinct as string[][]) {
    assert.notEqual(StreetKey.of(a), StreetKey.of(b), `streetDistinct must differ: ${a} vs ${b}`);
    checks++;
  }
  for (const names of v.houseEqual as string[][]) {
    const keys = new Set(names.map((n) => HouseKey.of(n)));
    assert.equal(keys.size, 1, `houseEqual should collapse to one key: ${JSON.stringify(names)} -> ${JSON.stringify([...keys])}`);
    checks++;
  }
  for (const [a, b] of v.houseDistinct as string[][]) {
    assert.notEqual(HouseKey.of(a), HouseKey.of(b), `houseDistinct must differ: ${a} vs ${b}`);
    checks++;
  }
  for (const c of v.listContains as Json[]) {
    assert.equal(
      HouseKey.listContains(c.buildingNames, c.house),
      c.expect,
      `listContains ${c.buildingNames} / '${c.house}'`
    );
    checks++;
  }
  assert.equal(TextNorm.decodeEntities('&amp;#039;'), "'");
  assert.equal(TextNorm.decodeEntities('&#39;'), "'");
  assert.equal(TextNorm.decodeEntities('&#x27;'), "'");
  assert.equal(TextNorm.decodeEntities('a&amp;b'), 'a&b');
  return checks + 4;
}

// -------------------------------------------------------------------------------------------------
// poweron_api.json
// -------------------------------------------------------------------------------------------------

const intOrNull = (o: Json, key: string): number | null => (o[key] === undefined || o[key] === null ? null : Number(o[key]));

function row(o: Json): PowerOnRow {
  return {
    id: Number(o.id),
    cityId: intOrNull(o, 'cityId'),
    cityName: String(o.cityName),
    streetId: intOrNull(o, 'streetId'),
    streetName: String(o.streetName),
    dateEvent: String(o.dateEvent),
    datePlanIn: String(o.datePlanIn),
    koment: optStr(o, 'koment'),
    switchSubReason: intOrNull(o, 'switchSubReason'),
    typeOff: intOrNull(o, 'typeOff'),
    buildingNames: String(o.buildingNames),
  };
}

function powerOnVectors(): number {
  const v: Json = load('poweron_api.json');
  let checks = 0;
  for (const t of v.timestamps as Json[]) {
    const parsed = PowerOnMapper.parseTime(t.in);
    if (t.out === null) assert.equal(parsed, null, `timestamp '${t.in}'`);
    else assert.equal(dtStr(parsed), t.out, `timestamp '${t.in}'`);
    checks++;
  }
  for (const c of v.emergencyMapping as Json[]) {
    const name: string = c.name;
    const got = PowerOnMapper.emergencyRecordsFor((c.rows as Json[]).map(row), c.house);
    const exp: Json[] = c.expect;
    assert.equal(got.length, exp.length, `${name}: count`);
    exp.forEach((e, i) => {
      assert.equal(got[i].id, e.id, `${name}: id`);
      assert.equal(formatLocalDateTime(got[i].start), e.start, `${name}: start`);
      assert.equal(dtStr(got[i].estimatedEnd), optStr(e, 'estimatedEnd'), `${name}: estimatedEnd`);
      assert.equal(got[i].label, optStr(e, 'label'), `${name}: label`);
    });
    checks++;
  }
  for (const c of v.repairMapping as Json[]) {
    const name: string = c.name;
    const got = PowerOnMapper.repairOutagesFor((c.rows as Json[]).map(row), c.house, parseLocalDate(c.today));
    const exp: Json[] = c.expect;
    assert.equal(got.length, exp.length, `${name}: count`);
    exp.forEach((e, i) => {
      assert.equal(got[i].id, e.id, `${name}: id`);
      assert.equal(got[i].kind, 'REPAIR', `${name}: kind`);
      assert.equal(formatLocalDateTime(got[i].start), e.start, `${name}: start`);
      assert.equal(formatLocalDateTime(got[i].end), e.end, `${name}: end`);
      assert.equal(got[i].label, optStr(e, 'label'), `${name}: label`);
    });
    checks++;
  }
  return checks;
}

// -------------------------------------------------------------------------------------------------
// site_state.json
// -------------------------------------------------------------------------------------------------

function valueOf<T extends string>(values: readonly T[], name: string): T {
  const found = values.find((v) => v === name);
  if (found === undefined) throw new Error(`No enum constant ${name}`);
  return found;
}

function siteStateVectors(): number {
  const cases: Json[] = load('site_state.json').cases;
  for (const c of cases) {
    const got = SiteStateResolver.resolve(
      valueOf<FetchFailure>(FETCH_FAILURES, c.failure),
      c.hasTodayTable,
      c.networkValidated
    );
    assert.equal(got, valueOf<SiteState>(SITE_STATES, c.expect), JSON.stringify(c));
  }
  return cases.length;
}

// -------------------------------------------------------------------------------------------------
// site_notice.json
// -------------------------------------------------------------------------------------------------

function siteNoticeVectors(): number {
  const cases: Json[] = JSON.parse(fs.readFileSync(path.join(SPEC_DIR, 'site_notice.json'), 'utf8')).cases;
  assert.ok(cases.length >= 5);
  for (const c of cases) {
    assert.equal(extractSiteNotice(c.html), c.expect ?? null, c.name);
  }
  return cases.length;
}

// -------------------------------------------------------------------------------------------------
// Purity gate: src/core must stay platform-neutral
// -------------------------------------------------------------------------------------------------

function coreSourceGate(): number {
  const coreDir = path.join(REPO_ROOT, 'src', 'core');
  const files = fs
    .readdirSync(coreDir, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile() && /\.(ts|tsx|js|mjs|cjs)$/.test(d.name))
    .map((d) => path.join(d.parentPath, d.name));
  assert.ok(files.length >= 7, `expected the core sources in ${coreDir}`);
  const banned: [RegExp, string][] = [
    [/from\s+['"]react(?:-dom)?(?:\/[^'"]*)?['"]/, 'imports react'],
    [/['"]node:/, "references a 'node:' module"],
    [/\brequire\s*\(/, 'uses require()'],
    [/\bwindow\b/, 'references window'],
    [/\bdocument\b/, 'references document'],
    [/\blocalStorage\b/, 'references localStorage'],
    [/\bsessionStorage\b/, 'references sessionStorage'],
    [/\bfetch\s*\(/, 'calls fetch()'],
    [/\bXMLHttpRequest\b/, 'references XMLHttpRequest'],
  ];
  for (const file of files) {
    // Doc comments may say "window" (a two-day window) in prose; only code is gated.
    const src = fs
      .readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:\\])\/\/.*$/gm, '$1');
    const rel = path.relative(REPO_ROOT, file);
    for (const [re, what] of banned) assert.ok(!re.test(src), `${rel} ${what}`);
    for (const m of src.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) {
      assert.ok(m[1].startsWith('./'), `${rel} imports '${m[1]}' (src/core may only import its own modules)`);
    }
  }
  return files.length;
}

// -------------------------------------------------------------------------------------------------

const suites: [string, () => number][] = [
  ['outage_engine.json', outageEngineVectors],
  ['emergency_ledger.json', emergencyLedgerVectors],
  ['address_keys.json', addressKeyVectors],
  ['poweron_api.json', powerOnVectors],
  ['site_state.json', siteStateVectors],
  ['site_notice.json', siteNoticeVectors],
  ['src/core purity gate', coreSourceGate],
];

let failed = 0;
for (const [name, run] of suites) {
  try {
    const n = run();
    console.log(`PASS ${name} (${n} checked)`);
  } catch (e) {
    failed++;
    console.error(`FAIL ${name}`);
    console.error(e instanceof Error ? e.message : e);
  }
}
if (failed > 0) {
  console.error(`${failed} spec vector suite(s) failed`);
  process.exit(1);
}
console.log(`All ${suites.length} spec vector suites passed`);
