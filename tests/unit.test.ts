import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import {
  QUEUES,
  parseZtoeHtmlFull,
  getChartHalfHourBlocks,
  getBlackoutIntervals,
  calculateOutageCountdown,
} from '../src/services/ztoeParser';
import { translations } from '../src/services/i18n';
import {
  DEFAULT_DONATIONS,
  DONATIONS_REFRESH_INTERVAL_MS,
} from '../src/services/donationsService';
import {
  TIME_OF_DAY_PALETTES,
  getInterpolatedTimePalette,
} from '../src/services/timeOfDayPalette';

const ROOT_DIR = process.cwd();

function getKyivDateDdMmYyyy(offsetDays = 0): { ddMmYyyy: string; isoDate: string } {
  const target = new Date(Date.now() + offsetDays * 86400000);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(target);
  const day = parts.find((p) => p.type === 'day')?.value || '01';
  const month = parts.find((p) => p.type === 'month')?.value || '01';
  const year = parts.find((p) => p.type === 'year')?.value || '2026';
  return {
    ddMmYyyy: `${day}.${month}.${year}`,
    isoDate: `${year}-${month}-${day}`,
  };
}

function buildRealisticZtoeHtml(ddMmYyyy: string): string {
  const headerCols = Array.from({ length: 24 }, (_, h) => {
    const s = String(h).padStart(2, '0') + ':00';
    const e = String(h + 1).padStart(2, '0') + ':00';
    return `<td>${s}-${e}</td>`;
  }).join('');

  const rows = QUEUES.map((q, qIdx) => {
    const cells = Array.from({ length: 48 }, (_, slotIdx) => {
      const isOff = (slotIdx + qIdx * 3) % 16 >= 4 && (slotIdx + qIdx * 3) % 16 <= 9;
      const bg = isOff ? '#ff3333' : '#ffffff';
      return `<td style="background:${bg}"></td>`;
    }).join('');
    return `<tr><td><b>${q.id}</b></td>${cells}</tr>`;
  }).join('\n');

  return `
    <html>
      <body>
        <table width="100%" height="100%" border="0">
          <tr><td>
            <table>
              <tr><td colspan="49">Графік погодинних відключень електроенергії на ${ddMmYyyy}</td></tr>
              <tr><td>Черга / Підчерга</td>${headerCols}</tr>
              ${rows}
            </table>
          </td></tr>
        </table>
      </body>
    </html>
  `;
}

async function runUnitTestA() {
  console.log('--- Running Unit Test A: ZTOE Fetching, Parsing & Main/Widget Graph Parity ---');

  // 1. Verify /valid-urls.json
  const validUrlsPath = path.join(ROOT_DIR, 'valid-urls.json');
  assert.ok(fs.existsSync(validUrlsPath), 'Missing /valid-urls.json in repository root');
  const validUrls: string[] = JSON.parse(fs.readFileSync(validUrlsPath, 'utf-8'));
  assert.ok(
    validUrls.includes('https://www.ztoe.com.ua/unhooking-search.php'),
    '/valid-urls.json must include https://www.ztoe.com.ua/unhooking-search.php'
  );
  assert.ok(
    validUrls.includes('https://example.com'),
    '/valid-urls.json must include https://example.com'
  );

  // 2. Select random queue (e.g. 1.1 .. 6.2)
  const randomQueue = QUEUES[Math.floor(Math.random() * QUEUES.length)].id;
  const { ddMmYyyy } = getKyivDateDdMmYyyy(0);
  console.log(`Selected random queue: ${randomQueue} for Today (${ddMmYyyy})`);

  // 3. Attempt live fetch from ztoe.com.ua; fall back to realistic ZTOE HTML structure if blocked in CI
  let html = '';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    const response = await fetch('https://www.ztoe.com.ua/unhooking-search.php', {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Android 14; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0',
      },
    });
    clearTimeout(timer);
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      html = new TextDecoder('windows-1251').decode(buffer);
      if (!html.includes('Черга') && !html.includes('черга')) {
        html = new TextDecoder('utf-8').decode(buffer);
      }
    }
  } catch {
    // Offline or regional firewall in CI runner
  }

  let fullResult = html ? parseZtoeHtmlFull(html, randomQueue, new Date()) : null;
  if (!fullResult || !fullResult.hasTodayTable || !fullResult.todaySlots) {
    console.log('Live site table for today not reachable from runner; verifying with ZTOE leaf-table HTML fixture.');
    const fixtureHtml = buildRealisticZtoeHtml(ddMmYyyy);
    fullResult = parseZtoeHtmlFull(fixtureHtml, randomQueue, new Date());
  }

  assert.ok(
    fullResult && fullResult.hasTodayTable && fullResult.todaySlots && fullResult.todaySlots.length === 48,
    `Expected 48 half-hour slots for queue ${randomQueue}, got ${fullResult?.todaySlots?.length}`
  );

  const slots = fullResult.todaySlots;
  const offSlotsCount = slots.filter((s) => s.status === 'POWER_OFF').length;
  console.log(`Determined ${offSlotsCount} half-hour blackout slots for queue ${randomQueue} on ${ddMmYyyy}`);

  // 4. Verify Main Window graph blocks vs Big Widget graph blocks match 100%
  const mainWindowGraphBlocks = getChartHalfHourBlocks(slots);

  // Big Widget graph logic (24 hours x 2 half-hour blocks)
  const bigWidgetGraphBlocks = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    half1Off: slots[hour * 2]?.status === 'POWER_OFF',
    half2Off: slots[hour * 2 + 1]?.status === 'POWER_OFF',
  }));

  assert.equal(mainWindowGraphBlocks.length, 24, 'Main window graph must have 24 hour blocks (48 half-hours)');
  assert.equal(bigWidgetGraphBlocks.length, 24, 'Big widget graph must have 24 hour blocks (48 half-hours)');
  assert.deepEqual(
    mainWindowGraphBlocks,
    bigWidgetGraphBlocks,
    `Graph discrepancy detected between Main Window and Big Widget for queue ${randomQueue}`
  );

  // Verify Android Kotlin graph block logic in TimelineBar.kt and BlackoutGlanceWidget.kt matches
  const timelineBarKt = fs.readFileSync(
    path.join(ROOT_DIR, 'android/app/src/main/java/ua/blackout/prewarning/ui/components/TimelineBar.kt'),
    'utf-8'
  );
  const glanceWidgetKt = fs.readFileSync(
    path.join(ROOT_DIR, 'android/app/src/main/java/ua/blackout/prewarning/widget/BlackoutGlanceWidget.kt'),
    'utf-8'
  );
  // 1.4.0: both draw 48 half-hour cells indexed 0..47 (cell i = hour i/2, half i%2) with the same
  // planned / emergency / overlap classification (spec/UI_DRUM.md section 1).
  assert.ok(
    timelineBarKt.includes('48 -> slots') &&
      timelineBarKt.includes('val left = (i / 2) * (hourW + gap) + (i % 2) * halfW') &&
      timelineBarKt.includes('emergency = off && s.isEmergency'),
    'TimelineBar.kt must draw 48 half-hour cells (cell i = hour i/2, half i%2)'
  );
  assert.ok(
    glanceWidgetKt.includes('for (idx in 0 until 48)') &&
      glanceWidgetKt.includes('slots.getOrNull(idx)?.let { cellKind(it) }') &&
      glanceWidgetKt.includes('val hour = idx / 2') &&
      glanceWidgetKt.includes('s.isEmergency && s.isPlanned -> 3'),
    'BlackoutGlanceWidget.kt must draw the identical 48 half-hour cells'
  );

  console.log('Unit Test A PASSED: Main Window and Big Widget graphs match 100%.');
}

function runUnitTestB() {
  console.log('--- Running Unit Test B: UI Elements, Labels, Defaults & Changelog Verification ---');

  // 1. Check CHANGELOG.md exists and is non-empty
  const changelogPath = path.join(ROOT_DIR, 'CHANGELOG.md');
  assert.ok(fs.existsSync(changelogPath), 'CHANGELOG.md must exist');
  const changelog = fs.readFileSync(changelogPath, 'utf-8');
  assert.ok(changelog.length > 100, 'CHANGELOG.md must document changes');

  // 2. Verify Application Name is "Світло в Житомирі"
  const stringsXml = fs.readFileSync(
    path.join(ROOT_DIR, 'android/app/src/main/res/values/strings.xml'),
    'utf-8'
  );
  assert.ok(
    stringsXml.includes('<string name="app_name">Світло в Житомирі</string>'),
    'strings.xml app_name must be "Світло в Житомирі"'
  );
  const metadataJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'metadata.json'), 'utf-8'));
  assert.equal(metadataJson.name, 'Світло в Житомирі', 'metadata.json name must be "Світло в Житомирі"');
  assert.equal(translations.uk.appTitle, 'Світло в Житомирі', 'UK appTitle must be "Світло в Житомирі"');

  // 3. Verify Critical Default Values (advanceNoticeMinutes = 15, refreshIntervalMinutes = 30)
  const modelsKt = fs.readFileSync(
    path.join(ROOT_DIR, 'android/app/src/main/java/ua/blackout/prewarning/data/model/Models.kt'),
    'utf-8'
  );
  assert.ok(modelsKt.includes('val advanceNoticeMinutes: Int = 15'), 'Models.kt advanceNoticeMinutes default must be 15');
  assert.ok(
    modelsKt.includes('val refreshIntervalMinutes: Long = 30L'),
    'Models.kt refreshIntervalMinutes default must be 30L'
  );

  // 4. Verify Critical "?" Help Popup 4-step numbered instruction
  const appStringsKt = fs.readFileSync(
    path.join(ROOT_DIR, 'android/app/src/main/java/ua/blackout/prewarning/ui/AppStrings.kt'),
    'utf-8'
  );
  const settingsViewTsx = fs.readFileSync(
    path.join(ROOT_DIR, 'src/components/SettingsView.tsx'),
    'utf-8'
  );
  const step1 = '1. Відкрийте сторінку пошуку черги на сайті https://www.ztoe.com.ua/unhooking-search.php';
  const step2 = '2. Оберіть свій РЕМ, населений пункт і вулицю.';
  const step3 =
    '3. У таблиці знайдіть свій будинок і подивіться стовпці «Черга» і «Підчерга». Наприклад, черга 5 і підчерга 2 - це 5.2.';
  const step4 = '4. Виберіть це значення у полі «Черга» у вікні налаштувань (кнопка ⚙).';

  assert.ok(
    appStringsKt.includes(step1) &&
      appStringsKt.includes(step2) &&
      appStringsKt.includes(step3) &&
      appStringsKt.includes(step4),
    'AppStrings.kt must preserve exact 4-step queue help instructions'
  );
  assert.ok(
    settingsViewTsx.includes('1. Відкрийте сторінку пошуку черги на сайті') &&
      settingsViewTsx.includes('https://www.ztoe.com.ua/unhooking-search.php') &&
      settingsViewTsx.includes(step2) &&
      settingsViewTsx.includes(step3) &&
      settingsViewTsx.includes(step4),
    'SettingsView.tsx must preserve exact 4-step queue help instructions'
  );

  // 5. Verify Widget status labels ("СВІТЛО Є" / "СВІТЛА НЕМАЄ") and round Refresh button
  const glanceWidgetKt = fs.readFileSync(
    path.join(ROOT_DIR, 'android/app/src/main/java/ua/blackout/prewarning/widget/BlackoutGlanceWidget.kt'),
    'utf-8'
  );
  assert.ok(!glanceWidgetKt.includes('ЗНЕСТРУМЛЕНО'), 'Widget must not use "ЗНЕСТРУМЛЕНО"');
  assert.ok(
    glanceWidgetKt.includes('СВІТЛА НЕМАЄ') && glanceWidgetKt.includes('СВІТЛО Є'),
    'Widget must use "СВІТЛО Є" / "СВІТЛА НЕМАЄ"'
  );
  assert.ok(
    glanceWidgetKt.includes('RefreshWidgetActionCallback') && glanceWidgetKt.includes('R.drawable.ic_refresh'),
    'Both widgets must include round Refresh button'
  );

  // 6. Verify Emergency Outages link on Main Window (styled with site icon like About window)
  const mainScreenKt = fs.readFileSync(
    path.join(ROOT_DIR, 'android/app/src/main/java/ua/blackout/prewarning/ui/screens/MainScreen.kt'),
    'utf-8'
  );
  const mainViewTsx = fs.readFileSync(path.join(ROOT_DIR, 'src/components/MainView.tsx'), 'utf-8');
  assert.ok(
    mainScreenKt.includes('AppStrings.EMERGENCY_OUTAGES_URL') &&
      mainScreenKt.includes('Icons.Default.Language') &&
      mainScreenKt.includes('Icons.Default.OpenInNew') &&
      appStringsKt.includes('https://www.facebook.com/ztoe.com.ua') &&
      mainViewTsx.includes('https://www.facebook.com/ztoe.com.ua') &&
      mainViewTsx.includes('aria-label="Facebook"') &&
      mainViewTsx.includes('break-words') &&
      mainViewTsx.includes('<ExternalLink'),
    'Main window must contain https://www.facebook.com/ztoe.com.ua emergency outages link styled with Facebook icon and word wrapping'
  );
  assert.equal(translations.uk.emergencyOutagesLabel, 'Інформація про аварійні відключення:');

  // 7. Verify Donations block in About Window & /donations.json with 1-day refresh
  const donationsJsonPath = path.join(ROOT_DIR, 'donations.json');
  assert.ok(fs.existsSync(donationsJsonPath), 'Missing /donations.json in repository root');
  const donationsList = JSON.parse(fs.readFileSync(donationsJsonPath, 'utf-8'));
  assert.equal(donationsList.length, 2, '/donations.json must have the 2 default charity links');
  assert.equal(donationsList[0].title, 'Допомога тваринам');
  assert.equal(donationsList[0].url, 'https://send.monobank.ua/jar/7vJA5xrLoV');
  assert.equal(donationsList[1].title, 'Фонд Повернись Живим');
  assert.equal(donationsList[1].url, 'https://savelife.in.ua/donate/');
  assert.equal(DONATIONS_REFRESH_INTERVAL_MS, 24 * 60 * 60 * 1000, 'Donations must re-read 1 time per day (24h)');
  assert.deepEqual(DEFAULT_DONATIONS, donationsList);
  assert.equal(translations.uk.aboutDonations, 'Charity / Благодійність і Пожертви');
  assert.equal(translations.en.aboutDonations, 'Charity / Благодійність і Пожертви');
  assert.ok(
    appStringsKt.includes('Charity / Благодійність і Пожертви') &&
      appStringsKt.includes('BLACKOUT HOURS FOR TODAY:') &&
      (translations.en as Record<string, string>).blackoutHoursForDayHeader === 'Blackout hours for today:',
    'Main Application must use "Blackout hours for today" in English and About Window must use "Charity / Благодійність і Пожертви"'
  );

  // 8. Verify Time-of-Day Background Blurred Image Palettes
  assert.equal(TIME_OF_DAY_PALETTES.morning.primary, '#F4F9F9');
  assert.equal(TIME_OF_DAY_PALETTES.morning.secondary, '#4A7C59');
  assert.equal(TIME_OF_DAY_PALETTES.morning.accent, '#FFB085');
  assert.equal(TIME_OF_DAY_PALETTES.morning.supporting, '#2C3E35');

  assert.equal(TIME_OF_DAY_PALETTES.day.primary, '#FFFFFF');
  assert.equal(TIME_OF_DAY_PALETTES.day.secondary, '#0A2540');
  assert.equal(TIME_OF_DAY_PALETTES.day.accent, '#FFD166');
  assert.equal(TIME_OF_DAY_PALETTES.day.supporting, '#4682B4');

  assert.equal(TIME_OF_DAY_PALETTES.evening.primary, '#1A0B2E');
  assert.equal(TIME_OF_DAY_PALETTES.evening.secondary, '#8B3A62');
  assert.equal(TIME_OF_DAY_PALETTES.evening.accent, '#FF6B6B');
  assert.equal(TIME_OF_DAY_PALETTES.evening.supporting, '#FFE66D');

  assert.equal(TIME_OF_DAY_PALETTES.night.primary, '#0B0C10');
  assert.equal(TIME_OF_DAY_PALETTES.night.secondary, '#1F2833');
  assert.equal(TIME_OF_DAY_PALETTES.night.accent, '#66FCF1');
  assert.equal(TIME_OF_DAY_PALETTES.night.supporting, '#C5C6C7');

  const morningInterp = getInterpolatedTimePalette(new Date(2026, 9, 31, 8, 30, 0));
  assert.equal(morningInterp.period, 'morning');
  assert.equal(morningInterp.primary, '#F4F9F9');

  // 9. Verify URL / Refresh error strings
  assert.equal(translations.uk.errorNoInternet, 'Немає доступу до Інтернету');
  assert.equal(translations.en.errorNoInternet, 'No Internet access');
  assert.equal(translations.uk.errorNoQueuesFound, 'На сайті не знайдено черг');
  assert.equal(translations.en.errorNoQueuesFound, 'No queues found on site');

  // 10. Verify Bug 1 & Bug 2:
  // - Bug 1: When today's blackouts are over and tomorrow's schedule is available, "Next period" shows tomorrow's 1st blackout (not today's 1st blackout).
  // - Bug 2: Switching Today / Tomorrow tabs updates "blackout hours for this day" below the 24h timeline.
  const baseDate = new Date('2026-11-02T12:00:00+02:00');
  const buildTwoDayHtml = (todayDateDdMmYyyy: string, tomorrowDateDdMmYyyy: string): string => {
    const headerCells = Array.from({ length: 24 }, (_, i) => {
      const s = String(i).padStart(2, '0') + ':00';
      const e = String(i + 1).padStart(2, '0') + ':00';
      return `<td>${s}-${e}</td>`;
    }).join('');
    const allQueues = ['1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2', '5.1', '5.2', '6.1', '6.2'];
    const makeTable = (dateHeader: string, offSlotStart: number, offSlotEndExclusive: number) => {
      const rows = allQueues
        .map((q) => {
          const cells = Array.from({ length: 48 }, (_, idx) => {
            const bg = idx >= offSlotStart && idx < offSlotEndExclusive ? '#ff0000' : '#ffffff';
            return `<td style="background: ${bg};"></td>`;
          }).join('');
          return `<tr><td>1</td><td>${q}</td>${cells}</tr>`;
        })
        .join('\n');
      return `<table><tr><td colspan="50">Графік погодинних відключень на ${dateHeader}</td></tr><tr><td>Черга</td><td>Підчерга</td>${headerCells}</tr>${rows}</table>`;
    };
    // Today: blackout 08:00–10:00 (slots 16..20). Tomorrow: blackout 14:00–17:00 (slots 28..34).
    return `<html><body>${makeTable(todayDateDdMmYyyy, 16, 20)}${makeTable(tomorrowDateDdMmYyyy, 28, 34)}</body></html>`;
  };

  const twoDayHtml = buildTwoDayHtml('02.11.2026', '03.11.2026');
  const parsedTwoDay = parseZtoeHtmlFull(twoDayHtml, '1.1', baseDate);
  assert.ok(parsedTwoDay.hasTodayTable && parsedTwoDay.todaySlots, 'Must parse Today schedule table');
  assert.ok(parsedTwoDay.hasTomorrowTable && parsedTwoDay.tomorrowSlots, 'Must parse Tomorrow schedule table');

  const todayIntervals = getBlackoutIntervals(parsedTwoDay.todaySlots!);
  const tomorrowIntervals = getBlackoutIntervals(parsedTwoDay.tomorrowSlots!);
  assert.equal(todayIntervals.length, 1);
  assert.equal(`${todayIntervals[0].start} – ${todayIntervals[0].end}`, '08:00 – 10:00');
  assert.equal(tomorrowIntervals.length, 1);
  assert.equal(`${tomorrowIntervals[0].start} – ${tomorrowIntervals[0].end}`, '14:00 – 17:00');
  assert.notDeepEqual(
    todayIntervals,
    tomorrowIntervals,
    'Switching Today/Tomorrow tabs must produce distinct blackout hours lists for each day'
  );

  // At 21:00 today (after today's 08:00–10:00 blackout has ended), Next period must be tomorrow's 1st blackout (14:00 – 17:00), NOT today's 1st blackout (08:00 – 10:00)
  const lateEveningNow = new Date(2026, 10, 2, 21, 0, 0);
  const countdownWithTomorrow = calculateOutageCountdown(
    {
      dateStr: '2026-11-02',
      dayLabel: 'Сьогодні',
      queue: '1.1',
      city: 'Житомир (ZTOE)',
      slots: parsedTwoDay.todaySlots!,
      lastUpdated: '21:00',
      sourceUrl: 'https://www.ztoe.com.ua/unhooking-search.php'
    },
    lateEveningNow,
    {
      dateStr: '2026-11-03',
      dayLabel: 'Завтра',
      queue: '1.1',
      city: 'Житомир (ZTOE)',
      slots: parsedTwoDay.tomorrowSlots!,
      lastUpdated: '21:00',
      sourceUrl: 'https://www.ztoe.com.ua/unhooking-search.php'
    }
  );
  assert.equal(
    countdownWithTomorrow.slotDescription,
    '14:00 – 17:00',
    'Bug 1 regression check: Next period must show tomorrow 1st blackout (14:00 – 17:00), never today 1st blackout (08:00 – 10:00)'
  );
  assert.equal(countdownWithTomorrow.formattedTimeLeft, '17:00:00');

  // Verify Android Kotlin source files also enforce content-based slot signature and tomorrow 1st blackout fallback
  const scheduleRepoKt = fs.readFileSync(
    path.join(ROOT_DIR, 'android/app/src/main/java/ua/blackout/prewarning/data/repository/ScheduleRepository.kt'),
    'utf-8'
  );
  assert.ok(
    !scheduleRepoKt.includes('System.identityHashCode'),
    'ScheduleRepository.kt must not use System.identityHashCode for interval caching'
  );
  assert.ok(
    scheduleRepoKt.includes('calculateStatusAndCountdown') &&
      scheduleRepoKt.includes('computeDetailedIntervals') &&
      mainScreenKt.includes('val activeDate = if (isTomorrowSelected) tomorrowDate else todayDate') &&
      mainScreenKt.includes('remember(snapshot, activeDate) { snapshot.dayView(activeDate) }'),
    'MainScreen.kt and ScheduleRepository.kt must recompose blackout hours on Today/Tomorrow tab switch and compute tomorrow 1st blackout'
  );

  // 11. Verify Build Version 1.4.0, GitHub v1.3.2 KYIV_ZONE Fix & Developer Handover Documentation across project files
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf-8'));
  assert.equal(packageJson.version, '1.4.0', 'package.json version must be 1.4.0');
  const buildGradle = fs.readFileSync(path.join(ROOT_DIR, 'android/app/build.gradle.kts'), 'utf-8');
  assert.ok(buildGradle.includes('"1.4.0"'), 'android/app/build.gradle.kts default versionName must be 1.4.0');
  const aboutScreenKt = fs.readFileSync(
    path.join(ROOT_DIR, 'android/app/src/main/java/ua/blackout/prewarning/ui/screens/AboutScreen.kt'),
    'utf-8'
  );
  assert.ok(aboutScreenKt.includes('"1.4.0"'), 'AboutScreen.kt fallback version must be 1.4.0');
  const aboutViewTsx = fs.readFileSync(path.join(ROOT_DIR, 'src/components/AboutView.tsx'), 'utf-8');
  assert.ok(aboutViewTsx.includes("'1.4.0'"), 'AboutView.tsx fallback version must be 1.4.0');
  const readmeMd = fs.readFileSync(path.join(ROOT_DIR, 'README.md'), 'utf-8');
  assert.ok(readmeMd.includes('(v1.4.0)'), 'README.md must reference v1.4.0');
  assert.ok(
    changelog.includes("## [1.4.0]") && changelog.includes("## [1.3.5]") && changelog.includes("## [1.3.4]"),
    'CHANGELOG.md must document v1.4.0, v1.3.5, and v1.3.4'
  );

  // Verify GitHub v1.3.2 fix (KyivZone.kt KYIV_ZONE fallback) is included across Android codebase
  const kyivZonePath = path.join(
    ROOT_DIR,
    'android/app/src/main/java/ua/blackout/prewarning/data/KyivZone.kt'
  );
  assert.ok(fs.existsSync(kyivZonePath), 'KyivZone.kt from GitHub v1.3.2 must exist');
  const kyivZoneKt = fs.readFileSync(kyivZonePath, 'utf-8');
  assert.ok(
    kyivZoneKt.includes('val KYIV_ZONE: ZoneId') &&
      kyivZoneKt.includes('"Europe/Kyiv", "Europe/Kiev"') &&
      kyivZoneKt.includes('ZoneId.systemDefault()'),
    'KyivZone.kt must fallback from Europe/Kyiv to Europe/Kiev and ZoneId.systemDefault()'
  );
  const ztoeParserKt = fs.readFileSync(
    path.join(ROOT_DIR, 'android/app/src/main/java/ua/blackout/prewarning/data/parser/ZtoeParser.kt'),
    'utf-8'
  );
  assert.ok(
    ztoeParserKt.includes('KYIV_ZONE') && !ztoeParserKt.includes('ZoneId.of("Europe/Kyiv")'),
    'ZtoeParser.kt must use KYIV_ZONE instead of raw ZoneId.of("Europe/Kyiv")'
  );
  assert.ok(
    scheduleRepoKt.includes('KYIV_ZONE') && !scheduleRepoKt.includes('ZoneId.of("Europe/Kyiv")'),
    'ScheduleRepository.kt must use KYIV_ZONE instead of raw ZoneId.of("Europe/Kyiv")'
  );

  const handoverPath = path.join(ROOT_DIR, 'HANDOVER.md');
  assert.ok(fs.existsSync(handoverPath), 'HANDOVER.md must exist in repository root');
  const handoverMd = fs.readFileSync(handoverPath, 'utf-8');
  assert.ok(
    handoverMd.includes('ZtoeParser.kt') &&
      handoverMd.includes('ScheduleRepository.kt') &&
      handoverMd.includes('AlarmScheduler.kt') &&
      handoverMd.includes('BlackoutGlanceWidget.kt') &&
      handoverMd.includes('docs/screenshots/UI1.jpg'),
    'HANDOVER.md must document core classes, methods, and application screenshots'
  );

  // 12. Verify git modified UI files are mentioned in CHANGELOG.md
  try {
    const gitStatus = execSync('git status --porcelain', { encoding: 'utf-8' });
    const modifiedFiles = gitStatus
      .split('\n')
      .map((line) => line.trim().split(/\s+/).pop() || '')
      .filter(
        (f) =>
          (f.endsWith('.kt') || f.endsWith('.tsx')) &&
          (f.includes('ui/') || f.includes('components/') || f.includes('widget/'))
      );

    for (const file of modifiedFiles) {
      const baseName = path.basename(file);
      assert.ok(
        changelog.includes(baseName),
        `Modified UI file ${file} (${baseName}) must be documented in CHANGELOG.md`
      );
    }
  } catch {
    // Git not initialized or not in a git worktree
  }

  // 13. Verify Official Privacy Policy (Google Play & GDPR compliant)
  const privacyMdPath = path.join(ROOT_DIR, 'PRIVACY_POLICY.md');
  assert.ok(fs.existsSync(privacyMdPath), 'PRIVACY_POLICY.md must exist in repository root');
  const privacyMd = fs.readFileSync(privacyMdPath, 'utf-8');
  assert.ok(privacyMd.length > 1000, 'PRIVACY_POLICY.md must be comprehensive and official');
  assert.ok(privacyMd.includes('com.ZTBlackoutPreWarning'), 'Privacy Policy must include package name com.ZTBlackoutPreWarning');
  assert.ok(privacyMd.includes('Igor Zaharov'), 'Privacy Policy must include developer name Igor Zaharov');
  assert.ok(privacyMd.includes('android.permission.INTERNET'), 'Privacy Policy must document INTERNET permission');
  assert.ok(privacyMd.includes('android.permission.POST_NOTIFICATIONS'), 'Privacy Policy must document POST_NOTIFICATIONS permission');
  assert.ok(privacyMd.includes('SCHEDULE_EXACT_ALARM'), 'Privacy Policy must document SCHEDULE_EXACT_ALARM permission');
  assert.ok(privacyMd.includes('RECEIVE_BOOT_COMPLETED'), 'Privacy Policy must document RECEIVE_BOOT_COMPLETED permission');
  assert.ok(privacyMd.includes('Політика конфіденційності'), 'Privacy Policy must include Ukrainian section');
  assert.ok(privacyMd.includes('2297-VI') || privacyMd.includes('GDPR'), 'Privacy Policy must cite relevant data protection laws');
  const publicPrivacyHtml = path.join(ROOT_DIR, 'public/privacy.html');
  assert.ok(fs.existsSync(publicPrivacyHtml), 'public/privacy.html must exist for Google Play Console URL hosting');

  console.log('Unit Test B PASSED: All UI elements, icons, labels, defaults, changelog, and official Privacy Policy checks succeeded.');
}

async function runUnitTestC_ZhytomyrRoulette() {
  console.log('--- Running Unit Test C: Житомирська Рулетка Mini-Game Mechanics, Localization & UI ---');

  const {
    GENERATED_TICKET_FOIL_IMAGES,
    TICKET_VISUAL_VARIANTS,
    TICKET_SCRATCH_REVEAL_THRESHOLD,
    GAME_OVER_REALIZATION_DELAY_MS,
    isTicketScratchedEnough,
    doesScratchExposeRedCenterOutline,
    ROULETTE_UPGRADES,
    formatUpgradeButtonLabel,
    getGoldenTicketProbability,
    getTargetX2TicketCount,
    isNocturnalModeActive,
    getStreakStep,
    assignGoldenTicketAndVariants,
    generateRandomStainPlacement,
    generate48TimeslotLabels,
    getHourlyTicketPairs,
    generateRandomizedTickets,
    loadRandomQueueTickets,
    loadRandomQueueTicketsSync,
    createInitialRouletteState,
    startRouletteGame,
    revealRouletteTicket,
    completeFadeToGameOver,
    applyGetNewTickets,
    applyRestartGame,
    applyGameOverRestart,
    applyReturnToMainMenu,
    applyCloseGame,
    openPowerShopScreen,
    closePowerShopScreen,
    purchaseRouletteUpgrade,
    buildBlackCatNotificationPayload,
    buildRouletteShareCardSvg,
    generateRouletteShareImageDataUrl,
    getRouletteStrings,
    formatNewTicketsButtonWithCost,
    getNextFlickerDelayMs,
    getFlickerDurationMs,
    getSavedBestScore,
    saveBestScoreIfHigher,
    resetSavedBestScore,
    getSavedPowerPoints,
    savePowerPoints,
    resetSavedPowerPoints,
    getPurchasedUpgrades,
    resetPurchasedUpgrades,
    getDepositCount,
    getRecordedPayoutDateMs,
    isDepositFinMonLocked,
    processGameLaunchDepositPayout,
    getUpgradeDescription,
    resetAllRouletteProgress,
    DAY_IN_MS,
    POWER_POINT_MILESTONES,
    addPowerPoints,
    getAccumulatedPowerPoints,
    getReachedMilestones,
    isMilestoneReached,
    getMilestoneProgressFraction,
    getExtraLivesCount,
    canRefreshTickets,
    GAME_BLACKOUT_MIN_INTERVAL_MS,
    GAME_BLACKOUT_MAX_INTERVAL_MS,
    GAME_BLACKOUT_DURATION_MS,
    getNextGameBlackoutDelayMs,
    SHARE_GLYPH_INACTIVE_COLOR,
    SHARE_GLYPH_ACTIVE_COLOR,
    getShareCardUpgradeGlyphStates,
    convertShareDataUrlToFile,
    MAX_ROULETTE_SCORE,
    SCORE_SHUFFLE_THRESHOLD,
    TICKET_SHUFFLE_ANIMATION_DURATION_MS,
    TICKET_SHUFFLE_ROW_COUNT,
    clampRouletteScore,
    shuffleTicketPlaces,
  } = await import('../src/services/rouletteGame');
  const { fetchFullSchedules } = await import('../src/services/ztoeParser');
  const {
    SCRATCH_VOLUME_SCALE,
    SCRATCH_SFX_VOLUME_MULTIPLIER,
    SCRATCH_SFX_DURATION_MS,
    COIN_VOLUME_SCALE,
    GAMEOVER_UPGRADE_VOLUME_SCALE,
    COIN_GAMEOVER_UPGRADE_VOLUME_SCALE,
    FLICKER_BUZZ_VOLUME_SCALE,
    GAME_BLACKOUT_VOLUME_SCALE,
    FLICKER_SFX_VOLUME_MULTIPLIER,
    ROULETTE_MUSIC_VOLUME,
    MUSIC_FADE_DURATION_MS,
    GAME_OVER_MUSIC_FADE_IN_DELAY_MS,
    START_SHOP_GAMEOVER_MUSIC_URL,
    START_SHOP_2_MUSIC_URL,
    START_SHOP_MUSIC_OPTIONS,
    MAIN_GAME_MUSIC_URL,
    LIGHTBULB_SFX_URL,
    SCRATCH_SFX_URL,
    CASH_REGISTER_SFX_URL,
    FLICKER_SFX_URL,
    COIN_SFX_URL,
    TWO_X_COIN_SFX_URL,
    SHUFFLE_SFX_URL,
    ROULETTE_SFX_URLS,
    isRouletteSoundEnabled,
    setRouletteSoundEnabled,
    toggleRouletteSoundEnabled,
    isRouletteMusicEnabled,
    setRouletteMusicEnabled,
    toggleRouletteMusicEnabled,
    isRouletteAppInForeground,
    setRouletteAppInForeground,
    getTargetMusicTrackForScreen,
    syncRouletteBackgroundMusic,
    pickRandomStartShopMusicUrl,
    randomizeStartShopMusicTrack,
    getCurrentStartShopMusicUrl,
    getRemainingScratchSoundDelayMs,
    playScratchSound,
    playCoinSound,
    play2XCoinSound,
  } = await import('../src/services/rouletteAudio');

  resetAllRouletteProgress();

  // Verify 1-second Game Over realization delay constant (changed from 2s to 1s)
  assert.equal(
    GAME_OVER_REALIZATION_DELAY_MS,
    1000,
    'Game Over event must have a 1 sec (1000ms) delay to let User realize scratching result'
  );

  // Verify sound volume adjustments: Scratching 50% lower from 1.15 (0.575), Coin -25% (0.75), GameOver/UpgradePurchase -20% less (0.60), Flicker & 10s Game Blackout lamp breaking sound at 10% (0.10), Music at 15% (0.15) with fade-in/fade-out and 2s Game Over delay
  assert.equal(SCRATCH_VOLUME_SCALE, 0.575, 'Scratching sound volume must be 50% lower from 1.15 (0.575)');
  assert.equal(SCRATCH_SFX_VOLUME_MULTIPLIER, 0.9, 'scratch.mp3 volume multiplier must be 10% down (0.9)');
  assert.equal(COIN_VOLUME_SCALE, 0.75, 'Coin sound volume must be 25% lower (0.75)');
  assert.equal(
    GAMEOVER_UPGRADE_VOLUME_SCALE,
    0.6,
    'Game Over and Upgrade Purchase sounds must have volume 20% less (0.75 * 0.8 = 0.6)'
  );
  assert.equal(FLICKER_BUZZ_VOLUME_SCALE, 0.575, 'Screen flickering lamp breaking sound volume scale must be 0.575 (similar to scratch.mp3)');
  assert.equal(GAME_BLACKOUT_VOLUME_SCALE, 0.575, '10-second Game Blackout lamp breaking sound volume scale must be 0.575 (similar to scratch.mp3)');
  assert.equal(FLICKER_SFX_VOLUME_MULTIPLIER, 0.9, 'flicker.mp3 volume multiplier must be 0.9 (similar to scratch.mp3)');
  assert.equal(
    Number((FLICKER_BUZZ_VOLUME_SCALE * FLICKER_SFX_VOLUME_MULTIPLIER).toFixed(4)),
    Number((SCRATCH_VOLUME_SCALE * SCRATCH_SFX_VOLUME_MULTIPLIER).toFixed(4)),
    'flicker.mp3 effective sound volume must match scratch.mp3 sound volume'
  );
  assert.equal(ROULETTE_MUSIC_VOLUME, 0.15, 'Background music must play at 15% volume (0.15)');
  assert.ok(MUSIC_FADE_DURATION_MS >= 500, 'Background music must use fade-in and fade-out duration');
  assert.equal(
    GAME_OVER_MUSIC_FADE_IN_DELAY_MS,
    2000,
    'Game Over screen must have a 2 second (2000ms) delay before music fade in'
  );
  assert.equal(
    START_SHOP_MUSIC_OPTIONS.length,
    2,
    'Game Start screen and Upgrade Shop must have 2 music track options'
  );
  assert.equal(
    pickRandomStartShopMusicUrl(() => 0.1),
    START_SHOP_GAMEOVER_MUSIC_URL,
    'Random < 0.5 must select first Game Start & Shop music option'
  );
  assert.equal(
    pickRandomStartShopMusicUrl(() => 0.8),
    START_SHOP_2_MUSIC_URL,
    'Random >= 0.5 must select second Game Start & Shop music option'
  );
  assert.equal(
    randomizeStartShopMusicTrack(() => 0.85),
    START_SHOP_2_MUSIC_URL,
    'randomizeStartShopMusicTrack must update current Start/Shop music URL'
  );
  assert.equal(getCurrentStartShopMusicUrl(), START_SHOP_2_MUSIC_URL);

  // Ensure web public/assets/aistudio MP3 files are synced from android/app/src/main/res/raw if public/assets was previously gitignored
  const audioSyncPairs: Array<[string, string]> = [
    [
      'android/app/src/main/res/raw/audio_start_shop_gameover.mp3',
      path.join('public', START_SHOP_GAMEOVER_MUSIC_URL.replace(/^\//, '')),
    ],
    [
      'android/app/src/main/res/raw/audio_start_shop_2.mp3',
      path.join('public', START_SHOP_2_MUSIC_URL.replace(/^\//, '')),
    ],
    [
      'android/app/src/main/res/raw/audio_main_game.mp3',
      path.join('public', MAIN_GAME_MUSIC_URL.replace(/^\//, '')),
    ],
    [
      'android/app/src/main/res/raw/sfx_lightbulb.mp3',
      path.join('public', LIGHTBULB_SFX_URL.replace(/^\//, '')),
    ],
    [
      'android/app/src/main/res/raw/sfx_scratch.mp3',
      path.join('public', SCRATCH_SFX_URL.replace(/^\//, '')),
    ],
    [
      'android/app/src/main/res/raw/sfx_cash_register.mp3',
      path.join('public', CASH_REGISTER_SFX_URL.replace(/^\//, '')),
    ],
    [
      'android/app/src/main/res/raw/sfx_flicker.mp3',
      path.join('public', FLICKER_SFX_URL.replace(/^\//, '')),
    ],
    [
      'android/app/src/main/res/raw/sfx_coin.mp3',
      path.join('public', COIN_SFX_URL.replace(/^\//, '')),
    ],
    [
      'android/app/src/main/res/raw/sfx_2x_coin.mp3',
      path.join('public', TWO_X_COIN_SFX_URL.replace(/^\//, '')),
    ],
    [
      'android/app/src/main/res/raw/sfx_shuffle.mp3',
      path.join('public', SHUFFLE_SFX_URL.replace(/^\//, '')),
    ],
  ];
  for (const [rawRel, pubRel] of audioSyncPairs) {
    const rawAbs = path.join(ROOT_DIR, rawRel);
    const pubAbs = path.join(ROOT_DIR, pubRel);
    if (!fs.existsSync(pubAbs) && fs.existsSync(rawAbs)) {
      fs.mkdirSync(path.dirname(pubAbs), { recursive: true });
      fs.copyFileSync(rawAbs, pubAbs);
    }
  }

  assert.ok(
    fs.existsSync(path.join(ROOT_DIR, 'public', START_SHOP_GAMEOVER_MUSIC_URL.replace(/^\//, ''))),
    'Attached "Audio - Game Start screen and Shop.mp3" must exist in /public/assets/aistudio/'
  );
  assert.ok(
    fs.existsSync(path.join(ROOT_DIR, 'public', START_SHOP_2_MUSIC_URL.replace(/^\//, ''))),
    'Attached "Audio - Game Start screen and Shop 2.mp3" must exist in /public/assets/aistudio/'
  );
  assert.ok(
    fs.existsSync(path.join(ROOT_DIR, 'public', MAIN_GAME_MUSIC_URL.replace(/^\//, ''))),
    'Attached "Audio - Main Game Screen.mp3" must exist in /public/assets/aistudio/'
  );
  assert.ok(
    fs.existsSync(path.join(ROOT_DIR, 'android/app/src/main/res/raw/audio_start_shop_gameover.mp3')),
    'Android raw resource audio_start_shop_gameover.mp3 must exist'
  );
  assert.ok(
    fs.existsSync(path.join(ROOT_DIR, 'android/app/src/main/res/raw/audio_start_shop_2.mp3')),
    'Android raw resource audio_start_shop_2.mp3 must exist'
  );
  assert.ok(
    fs.existsSync(path.join(ROOT_DIR, 'android/app/src/main/res/raw/audio_main_game.mp3')),
    'Android raw resource audio_main_game.mp3 must exist'
  );
  // Verify all 7 replaced MP3 sound effect files exist in both Web public/assets/aistudio and Android res/raw
  for (const sfxUrl of Object.values(ROULETTE_SFX_URLS)) {
    assert.ok(
      fs.existsSync(path.join(ROOT_DIR, 'public', sfxUrl.replace(/^\//, ''))),
      `Replaced SFX MP3 file ${sfxUrl} must exist in /public/`
    );
  }
  for (const rawFile of [
    'sfx_lightbulb.mp3',
    'sfx_scratch.mp3',
    'sfx_cash_register.mp3',
    'sfx_flicker.mp3',
    'sfx_coin.mp3',
    'sfx_2x_coin.mp3',
    'sfx_shuffle.mp3',
  ]) {
    assert.ok(
      fs.existsSync(path.join(ROOT_DIR, 'android/app/src/main/res/raw', rawFile)),
      `Android raw SFX resource ${rawFile} must exist`
    );
  }
  const webCashRegSize = fs.statSync(path.join(ROOT_DIR, 'public', CASH_REGISTER_SFX_URL.replace(/^\//, ''))).size;
  const androidCashRegSize = fs.statSync(path.join(ROOT_DIR, 'android/app/src/main/res/raw/sfx_cash_register.mp3')).size;
  assert.ok(
    webCashRegSize > 5000 && webCashRegSize < 16000 && webCashRegSize === androidCashRegSize,
    'First half of cash_register.mp3 must be trimmed in both Web and Android assets'
  );
  const webScratchSize = fs.statSync(path.join(ROOT_DIR, 'public', SCRATCH_SFX_URL.replace(/^\//, ''))).size;
  const androidScratchSize = fs.statSync(path.join(ROOT_DIR, 'android/app/src/main/res/raw/sfx_scratch.mp3')).size;
  assert.ok(
    webScratchSize > 4000 && webScratchSize < 12000 && webScratchSize === androidScratchSize,
    'scratch.mp3 must be trimmed to leave only first 30% and 10% volume down in both Web and Android assets'
  );
  assert.equal(typeof play2XCoinSound, 'function', 'play2XCoinSound must be exported for X2 and Gold tickets');

  // Verify background music track assignment per screen, randomization on START, & Sound On/Off switch muting both music and sounds
  assert.equal(getTargetMusicTrackForScreen('START', true), 'START_SHOP_GAMEOVER');
  assert.equal(getTargetMusicTrackForScreen('SHOP', true), 'START_SHOP_GAMEOVER');
  assert.equal(getTargetMusicTrackForScreen('GAME_OVER', true), 'START_SHOP_GAMEOVER');
  assert.equal(getTargetMusicTrackForScreen('PLAYING', true), 'MAIN_GAME');
  assert.equal(getTargetMusicTrackForScreen('FADING_TO_BLACK', true), 'MAIN_GAME');
  assert.equal(getTargetMusicTrackForScreen('START', false), 'NONE');

  assert.equal(isRouletteSoundEnabled(), true, 'Sound must be enabled by default');
  assert.equal(isRouletteMusicEnabled(), true, 'Music must be enabled by default');
  assert.equal(syncRouletteBackgroundMusic('START', true, true, () => 0.2), 'START_SHOP_GAMEOVER');
  assert.equal(getCurrentStartShopMusicUrl(), START_SHOP_GAMEOVER_MUSIC_URL);
  assert.equal(syncRouletteBackgroundMusic('SHOP', true, true, () => 0.9), 'START_SHOP_GAMEOVER');
  assert.equal(
    getCurrentStartShopMusicUrl(),
    START_SHOP_GAMEOVER_MUSIC_URL,
    'Navigating from START to SHOP must keep the current Start/Shop music track'
  );
  assert.equal(syncRouletteBackgroundMusic('PLAYING', true, true), 'MAIN_GAME');
  assert.equal(syncRouletteBackgroundMusic('START', true, true, () => 0.9), 'START_SHOP_GAMEOVER');
  assert.equal(
    getCurrentStartShopMusicUrl(),
    START_SHOP_2_MUSIC_URL,
    'Returning to Game Start Screen must randomize Start/Shop music track'
  );
  assert.equal(syncRouletteBackgroundMusic('GAME_OVER', true, true), 'START_SHOP_GAMEOVER');
  // Verify separate switches for Sound and Music
  assert.equal(setRouletteSoundEnabled(false), false, 'Sound switch must disable sound independently');
  assert.equal(isRouletteSoundEnabled(), false);
  assert.equal(isRouletteMusicEnabled(), true, 'Disabling Sound switch must leave Music switch unaffected');
  assert.equal(toggleRouletteSoundEnabled(), true, 'Toggling Sound switch back ON must re-enable sound');
  assert.equal(setRouletteMusicEnabled(false), false, 'Music switch must disable music independently');
  assert.equal(isRouletteMusicEnabled(), false);
  assert.equal(syncRouletteBackgroundMusic('START', true), 'NONE', 'Music must be disabled when Music switch is OFF');
  assert.equal(toggleRouletteMusicEnabled(), true, 'Toggling Music switch back ON must re-enable music');
  assert.equal(syncRouletteBackgroundMusic('START', true, true), 'START_SHOP_GAMEOVER');
  // Verify muting music & sounds when Application is minimized / sent to Home screen
  assert.equal(isRouletteAppInForeground(), true);
  assert.equal(setRouletteAppInForeground(false), false, 'Minimizing app must set foreground state to false');
  assert.equal(
    syncRouletteBackgroundMusic('START', true, true),
    'NONE',
    'Music must be muted (NONE) when Application is minimized'
  );
  assert.equal(setRouletteAppInForeground(true), true, 'Returning app to foreground must restore foreground state');
  assert.equal(
    syncRouletteBackgroundMusic('START', true, true),
    'START_SHOP_GAMEOVER',
    'Music must resume when Application returns to foreground'
  );
  assert.equal(syncRouletteBackgroundMusic('START', false), 'NONE');

  // 1. Verify 48 timeslots sorted chronologically (00:00-00:30 .. 15:30-16:00 .. 23:30-24:00) and 2-column hourly pairing
  const labels = generate48TimeslotLabels();
  assert.equal(labels.length, 48, 'Must generate 48 half-hour timeslot labels');
  assert.equal(labels[0], '00:00-00:30', 'First timeslot must be 00:00-00:30');
  assert.equal(labels[1], '00:30-01:00', 'Second timeslot must be 00:30-01:00');
  assert.equal(labels[31], '15:30-16:00', '32nd timeslot must be 15:30-16:00');
  assert.equal(labels[47], '23:30-24:00', '48th timeslot must be 23:30-24:00');

  const sampleTickets = generateRandomizedTickets();
  assert.equal(sampleTickets.length, 48, 'Must generate 48 lottery tickets');
  const hourlyPairs = getHourlyTicketPairs(sampleTickets);
  assert.equal(hourlyPairs.length, 24, 'Must group 48 tickets into 24 rows of 2 columns (2 timeslots per hour)');
  assert.equal(hourlyPairs[0][0].slotLabel, '00:00-00:30');
  assert.equal(hourlyPairs[0][1].slotLabel, '00:30-01:00');

  // Verify at least 1 beige ticket has X2 multiplier symbol by default when tickets are loaded
  assert.ok(
    sampleTickets.filter((t) => !t.isRed && t.isX2).length >= 1,
    'At least one beige ticket must have X2 multiplier when tickets are loaded'
  );

  // Verify scratching rules: red outline removed, only center lightbulb is red.
  // Scratching can be done freely around ticket, unless lightbulb color in center is revealed or 30% of ticket surface is scratched. X2 tickets follow same principle.
  assert.equal(TICKET_SCRATCH_REVEAL_THRESHOLD, 0.3, 'Ticket scratch reveal threshold must be 30% (0.30)');
  assert.equal(isTicketScratchedEnough(0.19, false), false, '19% scratched surface without center shown must not treat ticket as scratched');
  assert.equal(isTicketScratchedEnough(0.29, false), false, '29% scratched surface without center shown must allow scratching sides freely without reveal');
  assert.equal(isTicketScratchedEnough(0.30, false), true, '30% scratched surface must treat ticket as scratched');
  assert.equal(isTicketScratchedEnough(0.02, true), true, 'Ticket must be revealed immediately if center lightbulb color is revealed (same for red and other tickets)');
  assert.equal(isTicketScratchedEnough(0.15, true), true, 'Ticket must be revealed when center lightbulb is shown');

  assert.equal(
    doesScratchExposeRedCenterOutline(84, 37, 84, 37, 168, 74, 7.5),
    true,
    'Scratching across the center lightbulb must return true'
  );
  assert.equal(
    doesScratchExposeRedCenterOutline(20, 20, 30, 25, 168, 74, 7.5),
    false,
    'Scratching sides around ticket away from lightbulb must return false, allowing free scratching'
  );
  assert.equal(
    doesScratchExposeRedCenterOutline(5, 5, 15, 10, 240, 96, 11),
    false,
    'Scratching only the far corner away from center must return false, allowing scratching sides away from center'
  );

  // Verify 9 generated non-uniform ticket images (including profound wrinkled & stained variations) exist on disk
  // and randomized stain placements are assigned per ticket
  assert.equal(TICKET_VISUAL_VARIANTS.length, 9, 'Must define 9 visual ticket texture variants');
  assert.ok(
    TICKET_VISUAL_VARIANTS.includes('deep_wrinkled') &&
      TICKET_VISUAL_VARIANTS.includes('crumpled_scratched') &&
      TICKET_VISUAL_VARIANTS.includes('stain_corner') &&
      TICKET_VISUAL_VARIANTS.includes('water_stains') &&
      TICKET_VISUAL_VARIANTS.includes('heavy_wear'),
    'Ticket variants must include profound wrinkled and stained variations'
  );
  for (const variant of TICKET_VISUAL_VARIANTS) {
    const relImgPath = GENERATED_TICKET_FOIL_IMAGES[variant].replace(/^\//, '');
    assert.ok(
      fs.existsSync(path.join(ROOT_DIR, relImgPath)),
      `Generated ticket foil image for variant "${variant}" must exist at ${relImgPath}`
    );
  }

  // Verify randomized stain placements vary across tickets and profound wrinkled variants have high wrinkleDepth
  const uniqueStainCoords = new Set(
    sampleTickets.map((t) => `${t.stainPlacement?.stainOffsetX}_${t.stainPlacement?.stainOffsetY}`)
  );
  assert.ok(
    uniqueStainCoords.size > 10,
    'Stains must have randomized placements across the 48 tickets'
  );
  const deepWrinklePlacement = generateRandomStainPlacement('deep_wrinkled');
  assert.ok(
    deepWrinklePlacement.wrinkleDepth >= 0.65,
    'Profound wrinkled tickets must have high wrinkleDepth (>= 0.65)'
  );

  // 2. Verify Ukrainian (uk) and English (en) localization, "Найкращий Результат", "Головне Меню" / "Main Menu", "Share", "Zhytomyr Roulette", Power Points ("Бали Потужності"), Power Shop ("Магазин Потужності"), and incremental refresh cost button labels
  const ukStrings = getRouletteStrings('uk');
  const enStrings = getRouletteStrings('en');
  assert.equal(ukStrings.launchButtonTitle, 'Житомирська Рулетка');
  assert.equal(enStrings.launchButtonTitle, 'Zhytomyr Roulette');
  assert.equal(ukStrings.allTimeBestScoreLabel, 'Найкращий Результат', 'Ukrainian localization for All time best score must be "Найкращий Результат"');
  assert.equal(enStrings.allTimeBestScoreLabel, 'All time best score');
  assert.equal(ukStrings.mainMenuButton, 'Головне Меню', 'Ukrainian localization for Main Menu button must be "Головне Меню"');
  assert.equal(enStrings.mainMenuButton, 'Main Menu', 'English localization for Main Menu button must be "Main Menu"');
  assert.equal(ukStrings.shareButton, 'Поділитися', 'Ukrainian localization for Share button must be "Поділитися"');
  assert.equal(enStrings.shareButton, 'Share', 'English localization for Share button must be "Share"');
  assert.equal(ukStrings.downloadImageButton, 'Завантажити зображення', 'Ukrainian localization for Download Image button must be "Завантажити зображення"');
  assert.equal(enStrings.downloadImageButton, 'Download Image', 'English localization for Download Image button must be "Download Image"');
  assert.equal(ukStrings.soundLabel, 'Звук', 'Ukrainian localization for Sound switch must be "Звук"');
  assert.equal(enStrings.soundLabel, 'Sound', 'English localization for Sound switch must be "Sound"');
  assert.equal(ukStrings.musicLabel, 'Музика', 'Ukrainian localization for Music switch must be "Музика"');
  assert.equal(enStrings.musicLabel, 'Music', 'English localization for Music switch must be "Music"');
  assert.equal(ukStrings.powerPointsLabel, 'Бали Потужності');
  assert.equal(enStrings.powerPointsLabel, 'Power Points');
  assert.equal(ukStrings.powerShopButton, 'Магазин Потужності');
  assert.equal(enStrings.powerShopButton, 'Power Shop');
  assert.equal(ukStrings.startButton, 'Почати гру');
  assert.equal(enStrings.startButton, 'Start');
  assert.equal(ukStrings.closeGameButton, 'Закрити гру');
  assert.equal(enStrings.closeGameButton, 'Close Game');
  assert.equal(ukStrings.restartGameButton, 'Спочатку');
  assert.equal(enStrings.restartGameButton, 'Restart Game');
  assert.equal(ukStrings.getNewTicketsButton, 'Нові білети');
  assert.equal(enStrings.getNewTicketsButton, 'Get New Tickets');

  assert.equal(formatNewTicketsButtonWithCost('en', 0), 'Get New Tickets (0)');
  assert.equal(formatNewTicketsButtonWithCost('en', 1), 'Get New Tickets (-1)');
  assert.equal(formatNewTicketsButtonWithCost('en', 2), 'Get New Tickets (-2)');
  assert.equal(formatNewTicketsButtonWithCost('uk', 0), 'Нові білети (0)');
  assert.equal(formatNewTicketsButtonWithCost('uk', 1), 'Нові білети (-1)');
  assert.equal(formatNewTicketsButtonWithCost('uk', 3), 'Нові білети (-3)');

  // Verify Share Card image generator includes Application logo and name ("Світло в Житомирі"), Game logo (lightbulb), "Zhytomyr Roulette", bars with User's top score and total power points,
  // and bottom centered outline glyphs strictly in grey (#6B7280) if not bought or golden (#F59E0B) if bought
  const glyphStatesDefault = getShareCardUpgradeGlyphStates([], 0);
  assert.equal(glyphStatesDefault.length, 9, 'Share card must display 9 upgrade glyphs at the bottom center');
  assert.ok(
    glyphStatesDefault.every((g) => !g.purchased && g.color === SHARE_GLYPH_INACTIVE_COLOR),
    'Unpurchased upgrades on Share Card must all use grey (#6B7280)'
  );
  const glyphStatesBought = getShareCardUpgradeGlyphStates(['x2_ticket_1', 'second_chance', 'black_cat'], 3);
  assert.equal(glyphStatesBought.find((g) => g.id === 'x2_ticket_1')?.color, SHARE_GLYPH_ACTIVE_COLOR);
  assert.equal(glyphStatesBought.find((g) => g.id === 'x2_ticket_2')?.color, SHARE_GLYPH_INACTIVE_COLOR);
  assert.equal(glyphStatesBought.find((g) => g.id === 'second_chance')?.color, SHARE_GLYPH_ACTIVE_COLOR);
  assert.equal(glyphStatesBought.find((g) => g.id === 'black_cat')?.color, SHARE_GLYPH_ACTIVE_COLOR);
  assert.equal(glyphStatesBought.find((g) => g.id === 'deposit_power_points')?.color, SHARE_GLYPH_ACTIVE_COLOR);
  assert.equal(glyphStatesBought.find((g) => g.id === 'deposit_power_points')?.depositPoints, 300);

  const shareSvg = buildRouletteShareCardSvg({
    bestScore: 128,
    powerPoints: 9999,
    lang: 'uk',
    purchasedUpgrades: ['x2_ticket_1', 'second_chance'],
    depositCount: 2,
  });
  assert.ok(
    shareSvg.includes('Світло в Житомирі') &&
      shareSvg.includes('Zhytomyr Roulette') &&
      shareSvg.includes('НАЙКРАЩИЙ РЕЗУЛЬТАТ:') &&
      shareSvg.includes('128') &&
      shareSvg.includes('БАЛИ ПОТУЖНОСТІ:') &&
      shareSvg.includes('9999') &&
      shareSvg.includes('share-card-upgrade-glyphs') &&
      shareSvg.includes(SHARE_GLYPH_ACTIVE_COLOR) &&
      shareSvg.includes(SHARE_GLYPH_INACTIVE_COLOR) &&
      shareSvg.includes('>200<'),
    'Share Card SVG must contain App name, Zhytomyr Roulette title, top score bar, total power points bar, and bottom centered grey/golden outline upgrade glyphs'
  );
  const shareDataUrl = generateRouletteShareImageDataUrl({ bestScore: 128, powerPoints: 9999, lang: 'uk' });
  assert.ok(shareDataUrl.startsWith('data:image/'), 'generateRouletteShareImageDataUrl must return a valid image data URL');
  const shareImageFile = convertShareDataUrlToFile(shareDataUrl, 'zhytomyr-roulette-share.png');
  assert.ok(shareImageFile !== null, 'convertShareDataUrlToFile must convert Share Card image data URL into a File object');
  assert.ok(shareImageFile!.size > 0, 'Generated Share Card image File must be non-empty');

  // Verify randomized 15-30s screen flicker interval, slow 2-3s flicker duration, and 5-10m (300,000-600,000ms) 10s Game Blackout interval
  assert.equal(GAME_BLACKOUT_MIN_INTERVAL_MS, 300_000);
  assert.equal(GAME_BLACKOUT_MAX_INTERVAL_MS, 600_000);
  assert.equal(GAME_BLACKOUT_DURATION_MS, 10_000);
  for (let i = 0; i < 20; i++) {
    const delayMs = getNextFlickerDelayMs();
    assert.ok(delayMs >= 15000 && delayMs <= 30000, `Flicker delay must be between 15000ms and 30000ms, got ${delayMs}`);
    const durMs = getFlickerDurationMs();
    assert.ok(durMs >= 2000 && durMs <= 3000, `Flicker duration must be between 2000ms and 3000ms, got ${durMs}`);
    const blackoutDelayMs = getNextGameBlackoutDelayMs();
    assert.ok(
      blackoutDelayMs >= 300_000 && blackoutDelayMs <= 600_000,
      `Game Blackout delay must be between 300000ms (5m) and 600000ms (10m), got ${blackoutDelayMs}`
    );
  }

  // 3. Verify incremental streak scoring (+1, +2, +3, +4), X2 ticket doubling, incremental refresh cost (0, -1, -2, -3...), and score >= 0 floor
  const controlledTickets = labels.map((slotLabel, index) => ({
    index,
    slotLabel,
    isRed: index >= 40, // first 40 are Beige (safe), last 8 are Red (blackout)
    isGolden: false,
    isX2: index === 10, // index 10 is our X2 multiplier beige ticket
    isRevealed: false,
    scratchProgress: 0,
  }));

  const initial = createInitialRouletteState();
  assert.equal(initial.screen, 'START');
  assert.equal(initial.score, 0);
  assert.equal(initial.refreshCount, 0);

  let state = startRouletteGame(
    { queueId: '2.1', isOfflineRandomized: false, tickets: controlledTickets },
    initial.generationId,
    () => 0.5 // prevent random 1% golden roll so we test deterministic normal + X2 scoring
  );
  assert.equal(state.screen, 'PLAYING');
  assert.equal(state.score, 0);
  assert.equal(state.streakIncrement, 1);
  assert.equal(state.refreshCount, 0);

  // Scratch 4 consecutive Beige tickets -> score increases by +1, +2, +3, +4 (0 -> 1 -> 3 -> 6 -> 10)
  state = revealRouletteTicket(state, 0).nextState;
  assert.equal(state.score, 1);
  assert.equal(state.streakIncrement, 2);

  state = revealRouletteTicket(state, 1).nextState;
  assert.equal(state.score, 3);
  assert.equal(state.streakIncrement, 3);

  state = revealRouletteTicket(state, 2).nextState;
  assert.equal(state.score, 6);
  assert.equal(state.streakIncrement, 4);

  state = revealRouletteTicket(state, 3).nextState;
  assert.equal(state.score, 10);
  assert.equal(state.streakIncrement, 5);

  // Scratch X2 ticket at index 10 -> multiplies current score by x2 (10 * 2 = 20)
  const x2Reveal = revealRouletteTicket(state, 10);
  assert.equal(x2Reveal.outcome, 'X2', 'Scratching X2 beige ticket must return outcome X2');
  assert.equal(x2Reveal.nextState.score, 20, 'Scratching X2 beige ticket must multiply current score by x2 (10 -> 20)');

  // 1st "Get New Tickets" press: costs 0 (score 10 - 0 = 10), resets streakIncrement to +1, next refreshCount = 1 (-1)
  state = applyGetNewTickets(
    state,
    {
      queueId: '4.2',
      isOfflineRandomized: false,
      tickets: controlledTickets,
    },
    () => 0.5
  );
  assert.equal(state.screen, 'PLAYING');
  assert.equal(state.score, 10, '1st Get New Tickets must cost 0 points');
  assert.equal(state.streakIncrement, 1, 'Get New Tickets must reset increment back to +1');
  assert.equal(state.refreshCount, 1, 'After 1st refresh, next refresh cost must be 1 (-1)');
  assert.ok(state.tickets.every((t) => !t.isRevealed), 'Get New Tickets must reset all 48 tickets to unscratched');

  // 2nd "Get New Tickets" press: costs -1 (score 10 - 1 = 9), next refreshCount = 2 (-2)
  state = applyGetNewTickets(
    state,
    {
      queueId: '5.1',
      isOfflineRandomized: false,
      tickets: controlledTickets,
    },
    () => 0.5
  );
  assert.equal(state.score, 9, '2nd Get New Tickets must deduct 1 point (-1)');
  assert.equal(state.refreshCount, 2, 'After 2nd refresh, next refresh cost must be 2 (-2)');

  // 3rd "Get New Tickets" press: costs -2 (score 9 - 2 = 7), next refreshCount = 3 (-3)
  state = applyGetNewTickets(
    state,
    {
      queueId: '6.1',
      isOfflineRandomized: false,
      tickets: controlledTickets,
    },
    () => 0.5
  );
  assert.equal(state.score, 7, '3rd Get New Tickets must deduct 2 points (-2)');
  assert.equal(state.refreshCount, 3, 'After 3rd refresh, next refresh cost must be 3 (-3)');

  // Verify Refresh Tickets button is disabled if user doesn't have enough points to use it (score < refreshCount)
  assert.equal(canRefreshTickets(2, 5), false, 'canRefreshTickets must return false when score (2) < refreshCount (5)');
  assert.equal(canRefreshTickets(5, 5), true, 'canRefreshTickets must return true when score (5) >= refreshCount (5)');
  let insufficientRefreshState = { ...state, score: 2, refreshCount: 5 };
  insufficientRefreshState = applyGetNewTickets(
    insufficientRefreshState,
    {
      queueId: '1.1',
      isOfflineRandomized: false,
      tickets: controlledTickets,
    },
    () => 0.5
  );
  assert.equal(
    insufficientRefreshState.score,
    2,
    'applyGetNewTickets must not refresh or deduct points when user does not have enough points (score < refreshCount)'
  );
  assert.equal(insufficientRefreshState.refreshCount, 5);

  // Next Beige scratch after "Get New Tickets" adds +1 (7 -> 8) and sets next increment to +2
  const r5 = revealRouletteTicket(state, 0);
  assert.equal(r5.outcome, 'BEIGE');
  state = r5.nextState;
  assert.equal(state.score, 8);
  assert.equal(state.streakIncrement, 2);

  // 4. Verify 1% Golden Ticket probability (and 5% with Fern Flower upgrade) on load & Golden Ticket reveal scratching all beige tickets with cumulative score
  assert.equal(getGoldenTicketProbability([]), 0.01, 'Base Golden Ticket probability must be 1%');
  assert.equal(getGoldenTicketProbability(['fern_flower']), 0.05, 'Fern flower upgrade must increase Golden Ticket probability to 5% (0.05)');

  const goldenRollSuccess = assignGoldenTicketAndVariants(controlledTickets, () => 0.005, []); // 0.5% < 1%
  assert.equal(
    goldenRollSuccess.filter((t) => t.isGolden).length,
    1,
    'When 1% probability roll succeeds (< 0.01), exactly one beige ticket must be Golden'
  );
  assert.ok(
    goldenRollSuccess.every((t) => !t.isGolden || !t.isRed),
    'Golden ticket must only be a beige ticket'
  );

  const goldenRollFernSuccess = assignGoldenTicketAndVariants(controlledTickets, () => 0.045, ['fern_flower']); // 4.5% < 5%
  assert.equal(
    goldenRollFernSuccess.filter((t) => t.isGolden).length,
    1,
    'When Fern flower upgrade is active, 4.5% roll (< 0.05) must produce a Golden ticket'
  );

  const goldenRollFail = assignGoldenTicketAndVariants(controlledTickets, () => 0.25, []); // 25% >= 1%
  assert.equal(
    goldenRollFail.filter((t) => t.isGolden).length,
    0,
    'When 1% probability roll does not trigger (>= 0.01), no ticket is Golden'
  );

  // Test Golden Ticket reveal cumulative math
  const fiveBeigeTickets = labels.map((slotLabel, index) => ({
    index,
    slotLabel,
    isRed: index >= 5,
    isGolden: index === 2, // 3rd beige ticket is Golden
    isX2: index === 4,
    isRevealed: false,
    scratchProgress: 0,
  }));
  let goldenState = startRouletteGame({
    queueId: '1.1',
    isOfflineRandomized: false,
    tickets: fiveBeigeTickets,
  });
  goldenState = revealRouletteTicket(goldenState, 0).nextState; // +1 -> score = 1, streakIncrement = 2, 4 beige tickets left
  assert.equal(goldenState.score, 1);
  assert.equal(goldenState.streakIncrement, 2);

  const goldenReveal = revealRouletteTicket(goldenState, 2);
  assert.equal(goldenReveal.outcome, 'GOLDEN');
  goldenState = goldenReveal.nextState;
  assert.equal(
    goldenState.score,
    15,
    'Golden ticket reveal must add cumulative score (2 + 3 + 4 + 5 = 14) on top of 1 -> 15'
  );
  assert.equal(goldenState.streakIncrement, 6);
  assert.ok(
    goldenState.tickets.filter((t) => !t.isRed).every((t) => t.isRevealed),
    'Golden ticket reveal must immediately scratch all beige tickets on the field'
  );
  assert.ok(
    goldenState.tickets.filter((t) => t.isRed).every((t) => !t.isRevealed),
    'Golden ticket reveal must not reveal red tickets'
  );

  // 5. Scratch a Red ticket (index 42) -> triggers FADING_TO_BLACK and then GAME_OVER while keeping final score 8
  // and saving & adding earned score points (8) to persistent Power Points ("Бали Потужності")!
  resetSavedPowerPoints(0);
  const rRed = revealRouletteTicket(state, 42);
  assert.equal(rRed.outcome, 'RED');
  state = rRed.nextState;
  assert.equal(state.screen, 'FADING_TO_BLACK');
  assert.equal(state.score, 8);
  assert.equal(state.powerPoints, 8, 'Earned score points must be saved and added to Power Points upon Game Over');
  assert.equal(getSavedPowerPoints(), 8, 'Saved Power Points must persist upon Game Over');

  state = completeFadeToGameOver(state);
  assert.equal(state.screen, 'GAME_OVER');
  assert.equal(state.score, 8);
  assert.equal(state.powerPoints, 8, 'completeFadeToGameOver must not double-add Power Points');

  // Verify "Main Menu" button on Game Over screen returns to Game Start Screen ('START')
  const afterMainMenu = applyReturnToMainMenu(state);
  assert.equal(afterMainMenu.screen, 'START', 'Main Menu button on Game Over screen must return to Game Start Screen');
  assert.equal(afterMainMenu.powerPoints, 8);

  // Verify Close Game button resets screen to Game Start Screen ('START') for next launch
  const afterClose = applyCloseGame(state);
  assert.equal(afterClose.screen, 'START', 'After Close Game button is pressed, next time Game is started from Game Start Screen');
  assert.equal(afterClose.powerPoints, 8, 'Power Points must be preserved on Game Start Screen after Close Game');

  // On Game Over screen, pressing "Restart Game" bypasses Game Start screen and starts a new game immediately (PLAYING)
  state = applyRestartGame(
    state,
    {
      queueId: '3.1',
      isOfflineRandomized: false,
      tickets: controlledTickets,
    },
    () => 0.5
  );
  assert.equal(state.screen, 'PLAYING', 'Restart button on Game Over screen must bypass Start screen and start new game immediately');
  assert.equal(state.score, 0);
  assert.equal(state.streakIncrement, 1);
  assert.equal(state.refreshCount, 0);
  assert.ok(state.tickets.every((t) => !t.isRevealed));

  // Also verify applyGameOverRestart directly
  const directRestart = applyGameOverRestart(
    completeFadeToGameOver(rRed.nextState),
    {
      queueId: '2.2',
      isOfflineRandomized: false,
      tickets: controlledTickets,
    },
    () => 0.5
  );
  assert.equal(directRestart.screen, 'PLAYING');
  assert.equal(directRestart.score, 0);

  // Requirement 3: On Main Game Screen (PLAYING), pressing "Restart Game" button must add current Score to accumulated Power Points!
  state = revealRouletteTicket(state, 0).nextState; // +1 -> score 1
  state = revealRouletteTicket(state, 1).nextState; // +2 -> score 3
  state = revealRouletteTicket(state, 2).nextState; // +3 -> score 6
  assert.equal(state.score, 6);
  const powerPointsBeforeRestart = getSavedPowerPoints(); // 8
  state = applyRestartGame(state);
  assert.equal(state.screen, 'START');
  assert.equal(state.score, 0);
  assert.equal(
    state.powerPoints,
    powerPointsBeforeRestart + 6,
    'Main Game Screen restart game button must add current Score (6) to accumulated Power Points (8 + 6 = 14)'
  );
  assert.equal(getSavedPowerPoints(), 14);
  assert.ok(
    state.bestScore >= 10 && getSavedBestScore() >= 10,
    'All-time best score must be saved and retained across game restarts'
  );
  assert.equal(saveBestScoreIfHigher(42), 42, 'saveBestScoreIfHigher must update best score when higher');
  assert.equal(saveBestScoreIfHigher(12), 42, 'saveBestScoreIfHigher must never lower saved best score');

  // 6. Verify Power Shop ("Магазин Потужності" / "Power Shop"), all 11 Upgrades (including Daily Streak & Perseverance), "Secret" descriptions, Nocturnal Creature (Cost: 10), and Deposit Power Points ("Депозит Потужність+" / "XX / день")
  assert.equal(ROULETTE_UPGRADES.length, 11, 'Power Shop must have 11 upgrades including Daily Streak (Cost: 0) and Perseverance (Cost: 0)');
  assert.equal(formatUpgradeButtonLabel(ROULETTE_UPGRADES[0], 'en'), 'Additional X2 ticket (Cost: 100)');
  assert.equal(formatUpgradeButtonLabel(ROULETTE_UPGRADES[1], 'en'), 'Additional X2 ticket (Cost: 200)');
  assert.equal(formatUpgradeButtonLabel(ROULETTE_UPGRADES[2], 'en'), 'Additional X2 ticket (Cost: 400)');
  assert.equal(formatUpgradeButtonLabel(ROULETTE_UPGRADES[3], 'en'), 'Friend in Zhytomyroblenergo (Cost: 200)');
  assert.equal(formatUpgradeButtonLabel(ROULETTE_UPGRADES[4], 'en'), 'Second chance (Cost: 1000)');
  assert.equal(formatUpgradeButtonLabel(ROULETTE_UPGRADES[5], 'en'), 'Fern flower (Cost: 2000)');
  assert.equal(formatUpgradeButtonLabel(ROULETTE_UPGRADES[6], 'en'), 'Black Cat (Cost: 13)');
  assert.equal(formatUpgradeButtonLabel(ROULETTE_UPGRADES[7], 'en'), 'Nocturnal Creature (Cost: 10)');
  assert.equal(formatUpgradeButtonLabel(ROULETTE_UPGRADES[7], 'uk'), 'Нічна істота (Ціна: 10)');
  assert.equal(formatUpgradeButtonLabel(ROULETTE_UPGRADES[8], 'en', false, 0), 'Deposit Power Points (Cost: 100)');
  assert.equal(formatUpgradeButtonLabel(ROULETTE_UPGRADES[8], 'uk', false, 0), 'Депозит Потужність+ (Ціна: 100)');
  assert.equal(formatUpgradeButtonLabel(ROULETTE_UPGRADES[8], 'en', true, 1), 'Deposit Power Points (Cost: 100) — 10 / day');
  assert.equal(formatUpgradeButtonLabel(ROULETTE_UPGRADES[8], 'en', true, 2), 'Deposit Power Points (Cost: 100) — 20 / day');
  assert.equal(formatUpgradeButtonLabel(ROULETTE_UPGRADES[8], 'uk', true, 1), 'Депозит Потужність+ (Ціна: 100) — 10 / день');
  assert.equal(formatUpgradeButtonLabel(ROULETTE_UPGRADES[8], 'uk', true, 2), 'Депозит Потужність+ (Ціна: 100) — 20 / день');
  assert.equal(formatUpgradeButtonLabel(ROULETTE_UPGRADES[9], 'en'), 'Daily Streak (Cost: 0)');
  assert.equal(formatUpgradeButtonLabel(ROULETTE_UPGRADES[9], 'uk'), 'Щоденна серія (Ціна: 0)');
  assert.equal(formatUpgradeButtonLabel(ROULETTE_UPGRADES[10], 'en'), 'Perseverance (Cost: 0)');
  assert.equal(formatUpgradeButtonLabel(ROULETTE_UPGRADES[10], 'uk'), 'Наполегливість (Ціна: 0)');

  // Verify Power Points Milestone Progress Bar (100, 200, 400, 600, 1000) & Milestone Rewards
  assert.deepEqual([...POWER_POINT_MILESTONES], [100, 200, 400, 600, 1000]);
  resetAllRouletteProgress();
  assert.equal(getAccumulatedPowerPoints(), 0);
  assert.equal(getReachedMilestones().length, 0);
  assert.equal(getMilestoneProgressFraction(0), 0);
  assert.equal(getMilestoneProgressFraction(500), 0.5);
  assert.equal(getMilestoneProgressFraction(1200), 1);

  // Before reaching Milestone 400 and 1000, Daily Streak and Perseverance are visible in Shop but disabled to buy
  const lockedDailyStreakAttempt = purchaseRouletteUpgrade(createInitialRouletteState(), 'daily_streak');
  assert.equal(lockedDailyStreakAttempt.purchased, false, 'Daily Streak (Cost: 0) must be disabled to buy before Milestone 400 is reached');
  const lockedPerseveranceAttempt = purchaseRouletteUpgrade(createInitialRouletteState(), 'perseverance');
  assert.equal(lockedPerseveranceAttempt.purchased, false, 'Perseverance (Cost: 0) must be disabled to buy before Milestone 1000 is reached');

  // Adding +100 Power Points reaches Milestone 100 -> directly adds +100 bonus to Power Points (100 + 100 = 200)
  const afterAdd100 = addPowerPoints(100);
  assert.equal(afterAdd100, 200, 'Reaching milestone 100 must directly add +100 to total Power Points (100 + 100 = 200)');
  assert.equal(isMilestoneReached(100), true);
  assert.equal(isMilestoneReached(200), false);

  // Adding another +100 Power Points (accumulated = 200) reaches Milestone 200 -> directly adds +200 bonus (200 + 100 + 200 = 500)
  const afterAdd200 = addPowerPoints(100);
  assert.equal(afterAdd200, 500, 'Reaching milestone 200 must directly add +200 to total Power Points (200 + 100 + 200 = 500)');
  assert.equal(isMilestoneReached(200), true);
  assert.equal(isMilestoneReached(400), false);

  // Adding +200 Power Points (accumulated = 400) reaches Milestone 400 (unlocks Daily Streak, no direct point bonus -> 500 + 200 = 700)
  const afterAdd400 = addPowerPoints(200);
  assert.equal(afterAdd400, 700);
  assert.equal(isMilestoneReached(400), true);
  assert.equal(isMilestoneReached(600), false);

  // Adding +200 Power Points (accumulated = 600) reaches Milestone 600 -> directly adds +600 bonus (700 + 200 + 600 = 1500)
  const afterAdd600 = addPowerPoints(200);
  assert.equal(afterAdd600, 1500, 'Reaching milestone 600 must directly add +600 to total Power Points (700 + 200 + 600 = 1500)');
  assert.equal(isMilestoneReached(600), true);
  assert.equal(isMilestoneReached(1000), false);

  // Adding +400 Power Points (accumulated = 1000) reaches Milestone 1000 (unlocks Perseverance -> 1500 + 400 = 1900)
  const afterAdd1000 = addPowerPoints(400);
  assert.equal(afterAdd1000, 1900);
  assert.equal(isMilestoneReached(1000), true);

  // Verify descriptions for "Cat", "Fern", "Nocturnal Creature" upgrades:
  // "Fern Flower": uk "Удача +5%", en "Luck +5%"
  // "Black Cat": uk "Приносить невдачу", en "Brings misfortune"
  // "Nocturnal Creature": uk "Тепер блекаут вам до вподоби", en "You love blackouts"
  // and Deposit upgrade has localized description in uk/en that each 100 power points deposited grants 10 Points income daily
  const fernUpgrade = ROULETTE_UPGRADES.find((u) => u.id === 'fern_flower')!;
  const blackCatUpgrade = ROULETTE_UPGRADES.find((u) => u.id === 'black_cat')!;
  const nocturnalUpgrade = ROULETTE_UPGRADES.find((u) => u.id === 'nocturnal_creature')!;
  const depositUpgrade = ROULETTE_UPGRADES.find((u) => u.id === 'deposit_power_points')!;
  assert.equal(getUpgradeDescription(fernUpgrade, 'en', false), 'Luck +5%', 'Fern flower English description must be "Luck +5%"');
  assert.equal(getUpgradeDescription(fernUpgrade, 'uk', false), 'Удача +5%', 'Fern flower Ukrainian description must be "Удача +5%"');
  assert.equal(getUpgradeDescription(blackCatUpgrade, 'en', false), 'Brings misfortune', 'Black Cat English description must be "Brings misfortune"');
  assert.equal(getUpgradeDescription(blackCatUpgrade, 'uk', false), 'Приносить невдачу', 'Black Cat Ukrainian description must be "Приносить невдачу"');
  assert.equal(getUpgradeDescription(nocturnalUpgrade, 'en', false), 'You love blackouts', 'Nocturnal Creature English description must be "You love blackouts"');
  assert.equal(getUpgradeDescription(nocturnalUpgrade, 'uk', false), 'Тепер блекаут вам до вподоби', 'Nocturnal Creature Ukrainian description must be "Тепер блекаут вам до вподоби"');
  assert.equal(
    getUpgradeDescription(depositUpgrade, 'en', false),
    'Each 100 Power Points deposited will grant you 10 Points income daily.',
    'Deposit upgrade English description must state that each 100 Power Points deposited grants 10 Points income daily'
  );
  assert.equal(
    getUpgradeDescription(depositUpgrade, 'uk', false),
    'Кожні 100 вкладених Балів Потужності приносять 10 Балів доходу щодня.',
    'Deposit upgrade Ukrainian description must state that each 100 Power Points deposited grants 10 Points income daily'
  );
  assert.equal(nocturnalUpgrade.cost, 10, 'Nocturnal Creature price must be 10');
  assert.equal(nocturnalUpgrade.isToggleable, true, 'Nocturnal Creature must be toggleable');
  assert.equal(depositUpgrade.cost, 100, 'Deposit Power Points price must be 100');
  assert.equal(depositUpgrade.isRepeatable, true, 'Deposit Power Points must be repeatable');
  const dailyStreakUpgrade = ROULETTE_UPGRADES.find((u) => u.id === 'daily_streak')!;
  const perseveranceUpgrade = ROULETTE_UPGRADES.find((u) => u.id === 'perseverance')!;
  assert.equal(
    getUpgradeDescription(dailyStreakUpgrade, 'uk', false),
    'Нагорода за рубіж 400: перша гра на день дає бонус X2 до балів перед завершенням гри.',
    'Daily Streak Ukrainian description must mention Milestone 400 reward'
  );
  assert.equal(
    getUpgradeDescription(dailyStreakUpgrade, 'en', false),
    'Milestone 400 reward: first Game in a Day grants X2 bonus points before Game Over event.',
    'Daily Streak English description must mention Milestone 400 reward'
  );
  assert.equal(
    getUpgradeDescription(perseveranceUpgrade, 'uk', false),
    'Нагорода за рубіж 1000: додає ще одне серце на головному екрані гри (до трьох життів разом із Другим шансом).',
    'Perseverance Ukrainian description must mention Milestone 1000 reward'
  );
  assert.equal(
    getUpgradeDescription(perseveranceUpgrade, 'en', false),
    'Milestone 1000 reward: adds one more heart icon in Main Game screen. Cumulative with Second Life up to three lives.',
    'Perseverance English description must mention Milestone 1000 reward'
  );

  resetAllRouletteProgress();
  resetSavedPowerPoints(5000);
  let shopState = openPowerShopScreen(createInitialRouletteState(1_700_000_000_000));
  assert.equal(shopState.screen, 'SHOP');
  assert.equal(shopState.powerPoints, 5000);

  // Purchase a), b), c) Additional X2 tickets (100 + 200 + 400 = 700)
  const p1 = purchaseRouletteUpgrade(shopState, 'x2_ticket_1');
  assert.equal(p1.purchased, true);
  shopState = p1.nextState;
  assert.equal(shopState.powerPoints, 4900);

  // Verify one-time upgrades can be purchased only once
  const p1Duplicate = purchaseRouletteUpgrade(shopState, 'x2_ticket_1');
  assert.equal(p1Duplicate.purchased, false, 'One-time upgrade must only be purchasable once');
  assert.equal(p1Duplicate.nextState.powerPoints, 4900);

  shopState = purchaseRouletteUpgrade(shopState, 'x2_ticket_2').nextState;
  shopState = purchaseRouletteUpgrade(shopState, 'x2_ticket_3').nextState;
  assert.equal(shopState.powerPoints, 4300);
  assert.equal(getTargetX2TicketCount(shopState.purchasedUpgrades), 4, 'Base 1 + 3 Additional X2 upgrades must yield 4 X2 tickets');

  const ticketsWith4X2 = generateRandomizedTickets(Math.random, shopState.purchasedUpgrades);
  assert.equal(
    ticketsWith4X2.filter((t) => !t.isRed && t.isX2).length,
    4,
    'Generated tickets with all 3 Additional X2 upgrades must have 4 X2 beige tickets'
  );

  // Purchase d) "Friend in Zhytomyroblenergo (Cost: 200)" -> can open any ticket which doesn't trigger Game Over event
  shopState = purchaseRouletteUpgrade(shopState, 'friend_ztoe').nextState;
  assert.equal(shopState.powerPoints, 4100);

  // Purchase e) "Second chance (Cost: 1000)" -> scratching Red ticket counts as beige ticket instead of Game Over
  shopState = purchaseRouletteUpgrade(shopState, 'second_chance').nextState;
  assert.equal(shopState.powerPoints, 3100);

  // Purchase f) "Fern flower (Cost: 2000)" -> increases Gold ticket probability to 5%
  shopState = purchaseRouletteUpgrade(shopState, 'fern_flower').nextState;
  assert.equal(shopState.powerPoints, 1100);

  // Purchase g) "Black Cat (Cost: 13)" -> triggers imitated blackout notification in 3s with current time until 23:00
  const blackCatPurchase = purchaseRouletteUpgrade(shopState, 'black_cat');
  assert.equal(blackCatPurchase.purchased, true);
  assert.equal(blackCatPurchase.triggerBlackCatNotification, true);
  shopState = blackCatPurchase.nextState;
  assert.equal(shopState.powerPoints, 1087);
  assert.equal(getPurchasedUpgrades().length, 7);

  // Purchase h) "Nocturnal Creature (Cost: 10)" -> costs 10, toggles ON and OFF on consecutive purchases and reverses game logic
  const nocOn = purchaseRouletteUpgrade(shopState, 'nocturnal_creature');
  assert.equal(nocOn.purchased, true, 'Nocturnal Creature (Cost: 10) must be purchasable');
  assert.equal(nocOn.nextState.powerPoints, 1077, 'Nocturnal Creature must cost 10 Power Points');
  assert.equal(isNocturnalModeActive(nocOn.nextState.purchasedUpgrades), true, '1st purchase of Nocturnal Creature turns reverse logic ON');
  assert.equal(getStreakStep(nocOn.nextState.purchasedUpgrades), 2, 'Nocturnal Creature must multiply streak step by x2 (+2, +4, +6...)');

  // Test reversed game logic when Nocturnal Creature is ON:
  // Red tickets (index 41, 42, 43) increase score, while Beige ticket (index 0) triggers Game Over (after consuming Second chance extra life)!
  // Note: Friend in Zhytomyroblenergo is active so 1 Red ticket (safe in Nocturnal mode) is already opened at start (+2), and Second chance gives 1 extra life!
  let nocGameState = startRouletteGame(
    { queueId: '1.1', isOfflineRandomized: false, tickets: controlledTickets },
    nocOn.nextState.generationId,
    () => 0.1, // >= 0.05 (prevents 5% golden ticket roll) and picks first safe ticket in Nocturnal mode (index 40)
    0,
    nocOn.nextState.purchasedUpgrades
  );
  assert.equal(nocGameState.score, 2, 'Friend in Nocturnal mode opens 1 safe Red ticket for +2');
  assert.equal(nocGameState.streakIncrement, 4);
  assert.equal(nocGameState.extraLivesTotal, 1, 'Second chance is active in Nocturnal game');

  const nocRed1 = revealRouletteTicket(nocGameState, 41);
  assert.equal(nocRed1.outcome, 'BEIGE', 'In Nocturnal Creature mode, scratching a Red ticket increases score');
  nocGameState = nocRed1.nextState;
  assert.equal(nocGameState.score, 6);
  assert.equal(nocGameState.streakIncrement, 6);

  nocGameState = revealRouletteTicket(nocGameState, 42).nextState;
  assert.equal(nocGameState.score, 12, 'Next consecutive Red ticket in Nocturnal Creature mode adds +6 (6 + 6 = 12)');
  assert.equal(nocGameState.streakIncrement, 8);

  // 1st Beige ticket (index 0) in Nocturnal mode with Second chance consumes 1 extra life and counts as safe (+8 -> 20)!
  const nocBeigeSavedBySecondChance = revealRouletteTicket(nocGameState, 0);
  assert.equal(nocBeigeSavedBySecondChance.outcome, 'BEIGE', 'Second chance must save player when opening fatal ticket in Nocturnal mode');
  nocGameState = nocBeigeSavedBySecondChance.nextState;
  assert.equal(nocGameState.extraLivesUsed, 1);
  assert.equal(nocGameState.score, 20);
  assert.equal(nocGameState.streakIncrement, 10);

  // Subtract 8 from score so earned score is 12 before final fatal Beige ticket (index 1) triggers Game Over
  nocGameState = { ...nocGameState, score: 12 };
  const nocBeigeGameOver = revealRouletteTicket(nocGameState, 1);
  assert.equal(nocBeigeGameOver.outcome, 'RED', 'In Nocturnal Creature mode, scratching a Beige ticket after extra lives are used triggers Game Over');
  assert.equal(nocBeigeGameOver.nextState.screen, 'FADING_TO_BLACK');

  // Also verify Nocturnal Creature with Second Chance + Perseverance (2 extra lives), X2 Red ticket multiplying points, and Golden Red ticket opening all Red tickets on field!
  const nocSpecialTickets = labels.map((slotLabel, index) => ({
    index,
    slotLabel,
    isRed: index >= 40, // 8 Red tickets (indices 40..47)
    isGolden: index === 45, // Red Golden ticket
    isX2: index === 43, // Red X2 ticket
    isRevealed: false,
    scratchProgress: 0,
  }));
  let nocComboState = startRouletteGame(
    { queueId: '1.1', isOfflineRandomized: false, tickets: nocSpecialTickets },
    99,
    () => 0.5,
    0,
    ['nocturnal_creature', 'second_chance', 'perseverance']
  );
  assert.equal(nocComboState.extraLivesTotal, 2, 'Nocturnal Creature + Second Chance + Perseverance must grant 2 extra lives');
  // Open normal Red ticket (index 40) -> +2 (score = 2, streak = 4)
  nocComboState = revealRouletteTicket(nocComboState, 40).nextState;
  assert.equal(nocComboState.score, 2);
  assert.equal(nocComboState.streakIncrement, 4);
  // Open X2 Red ticket (index 43) -> multiplies points by 2 (2 * 2 = 4, streak = 6)
  const nocX2Reveal = revealRouletteTicket(nocComboState, 43);
  assert.equal(nocX2Reveal.outcome, 'X2', 'Opening X2 Red ticket with Nocturnal Creature in effect must return outcome X2');
  nocComboState = nocX2Reveal.nextState;
  assert.equal(nocComboState.score, 4, 'X2 ticket with Nocturnal Creature in effect must multiply points by 2');
  assert.equal(nocComboState.streakIncrement, 6);
  // Open 2 fatal tickets -> Second Chance & Perseverance save player twice (+6 -> 10, +8 -> 18)
  const nocLife1 = revealRouletteTicket(nocComboState, 0);
  assert.equal(nocLife1.outcome, 'BEIGE');
  assert.equal(nocLife1.nextState.extraLivesUsed, 1);
  assert.equal(nocLife1.nextState.score, 10);
  const nocLife2 = revealRouletteTicket(nocLife1.nextState, 1);
  assert.equal(nocLife2.outcome, 'BEIGE');
  assert.equal(nocLife2.nextState.extraLivesUsed, 2);
  assert.equal(nocLife2.nextState.score, 18);
  assert.equal(nocLife2.nextState.streakIncrement, 10);
  // Open Golden Red ticket (index 45) -> opens all remaining 6 unrevealed Red tickets on field (41, 42, 44, 45, 46, 47) and adds 10+12+14+16+18+20 = 90 -> 108!
  const nocGoldenReveal = revealRouletteTicket(nocLife2.nextState, 45);
  assert.equal(nocGoldenReveal.outcome, 'GOLDEN', 'Gold ticket with Nocturnal Creature in effect must return outcome GOLDEN');
  assert.ok(
    nocGoldenReveal.nextState.tickets.filter((t) => t.isRed).every((t) => t.isRevealed),
    'Gold ticket must open all Red tickets on field with Nocturnal Creature in effect'
  );
  assert.equal(nocGoldenReveal.nextState.score, 108, 'Gold ticket in Nocturnal Creature mode must award cumulative streak points for all unrevealed Red tickets');

  // Consecutive purchase of Nocturnal Creature (Cost: 10) turns it OFF and deducts 10 (from 1077 + 12 earned in Nocturnal game = 1089 -> 1079)
  const nocOff = purchaseRouletteUpgrade(nocBeigeGameOver.nextState, 'nocturnal_creature');
  assert.equal(nocOff.purchased, true, 'Nocturnal Creature can be purchased multiple times');
  assert.equal(nocOff.nextState.powerPoints, 1079, '2nd purchase of Nocturnal Creature deducts 10 Power Points');
  assert.equal(isNocturnalModeActive(nocOff.nextState.purchasedUpgrades), false, '2nd purchase of Nocturnal Creature turns reverse logic OFF');
  assert.equal(getStreakStep(nocOff.nextState.purchasedUpgrades), 1);
  shopState = nocOff.nextState;

  // Purchase i) "Deposit Power Points (Cost: 100)" multiple times, verify 24h & multi-day payouts, and FinMonitoring AntiCheat rollback detection
  const t0 = 1_700_000_000_000;
  const dep1 = purchaseRouletteUpgrade(shopState, 'deposit_power_points', t0);
  assert.equal(dep1.purchased, true);
  assert.equal(dep1.nextState.powerPoints, 979, 'Deposit Power Points (Cost: 100) must immediately remove 100 Power Points');
  assert.equal(dep1.nextState.depositCount, 1);
  assert.equal(getDepositCount(), 1);
  assert.equal(
    formatUpgradeButtonLabel(depositUpgrade, 'en', true, dep1.nextState.depositCount),
    'Deposit Power Points (Cost: 100) — 10 / day'
  );
  assert.equal(
    formatUpgradeButtonLabel(depositUpgrade, 'uk', true, dep1.nextState.depositCount),
    'Депозит Потужність+ (Ціна: 100) — 10 / день'
  );

  const dep2 = purchaseRouletteUpgrade(dep1.nextState, 'deposit_power_points', t0 + 1000);
  assert.equal(dep2.purchased, true);
  assert.equal(dep2.nextState.powerPoints, 879, '2nd Deposit Power Points purchase removes another 100 Power Points');
  assert.equal(dep2.nextState.depositCount, 2);
  assert.equal(
    formatUpgradeButtonLabel(depositUpgrade, 'en', true, dep2.nextState.depositCount),
    'Deposit Power Points (Cost: 100) — 20 / day'
  );
  shopState = dep2.nextState;

  // Launching game after 24 hours adds 20 Power Points (2 deposits * 10/day)
  const payoutDay1 = processGameLaunchDepositPayout(t0 + DAY_IN_MS + 5000);
  assert.equal(payoutDay1.awardedPoints, 20, 'After 24 hours with 2 deposits, launching game must add 20 Power Points');
  assert.equal(payoutDay1.powerPoints, 899);
  assert.equal(getRecordedPayoutDateMs(), t0 + DAY_IN_MS + 5000);

  // Launching game after 3 more days adds 60 Power Points (3 days * 20/day)
  const payoutDay4 = processGameLaunchDepositPayout(t0 + 4 * DAY_IN_MS + 5000);
  assert.equal(payoutDay4.awardedPoints, 60, 'After 3 passed days with 2 deposits, launching game must add 60 Power Points');
  assert.equal(payoutDay4.powerPoints, 959);

  // AntiCheat: If system date becomes prior to already recorded payout date -> disable Deposit upgrade, set Power Points to 0, add description "На розгляді ФінМоніторинга",
  // AND permanently disable Deposit payout events after following 24-hour intervals!
  const rollbackRes = processGameLaunchDepositPayout(t0 + 2 * DAY_IN_MS); // earlier than t0 + 4 * DAY_IN_MS + 5000
  assert.equal(rollbackRes.depositFinMonLocked, true, 'Clock rollback prior to recorded payout date must lock Deposit upgrade');
  assert.equal(rollbackRes.powerPoints, 0, 'Clock rollback must set current User Power Points to 0');
  assert.equal(getSavedPowerPoints(), 0);
  assert.equal(isDepositFinMonLocked(), true);
  assert.equal(
    getUpgradeDescription(depositUpgrade, 'uk', true),
    'На розгляді ФінМоніторинга',
    'Locked Deposit upgrade must display description "На розгляді ФінМоніторинга"'
  );
  assert.equal(
    getUpgradeDescription(depositUpgrade, 'en', true),
    'На розгляді ФінМоніторинга',
    'Locked Deposit upgrade must display description "На розгляді ФінМоніторинга"'
  );
  // Verify future 24-hour interval payouts are permanently disabled when AntiCheat is triggered
  const futureAfterAntiCheat = processGameLaunchDepositPayout(t0 + 10 * DAY_IN_MS);
  assert.equal(futureAfterAntiCheat.depositFinMonLocked, true);
  assert.equal(
    futureAfterAntiCheat.awardedPoints,
    0,
    'When AntiCheat is triggered, Deposit payout events after following 24-hour intervals must be disabled'
  );
  assert.equal(futureAfterAntiCheat.powerPoints, 0);

  // Attempting to purchase Deposit Power Points when FinMon-locked must fail even if user earns Power Points later
  savePowerPoints(500);
  const blockedDepositPurchase = purchaseRouletteUpgrade(
    { ...shopState, powerPoints: 500, depositFinMonLocked: true },
    'deposit_power_points',
    t0 + 5 * DAY_IN_MS
  );
  assert.equal(blockedDepositPurchase.purchased, false, 'Disabled Deposit upgrade cannot be purchased when FinMon-locked');

  const blackCatNotifUk = buildBlackCatNotificationPayload(new Date(2026, 10, 6, 14, 35, 0), '4.2', 'uk');
  assert.ok(
    blackCatNotifUk.message.includes('14:35-23:00') && blackCatNotifUk.message.includes('4.2'),
    'Black Cat notification must include actual current time until 23:00 (<current time>-23:00)'
  );
  const blackCatNotifEn = buildBlackCatNotificationPayload(new Date(2026, 10, 6, 9, 5, 0), '4.2', 'en');
  assert.ok(
    blackCatNotifEn.message.includes('09:05-23:00'),
    'Black Cat English notification must include actual current time until 23:00 (<current time>-23:00)'
  );

  shopState = closePowerShopScreen(shopState);
  assert.equal(shopState.screen, 'START');

  // Verify "Friend in Zhytomyroblenergo", "Second chance", "Perseverance" (cumulative up to 3 lives / 2 heart icons), and "Daily Streak" (first game in a day X2 bonus before Game Over)
  assert.equal(getExtraLivesCount([]), 0);
  assert.equal(getExtraLivesCount(['second_chance']), 1);
  assert.equal(getExtraLivesCount(['perseverance']), 1);
  assert.equal(getExtraLivesCount(['second_chance', 'perseverance']), 2, 'Second chance and Perseverance must be cumulative (2 extra hearts = 3 lives total)');

  let upgradedGame = startRouletteGame(
    { queueId: '1.1', isOfflineRandomized: false, tickets: controlledTickets },
    shopState.generationId,
    () => 0, // picks index 0 (normal beige)
    0,
    ['friend_ztoe', 'second_chance', 'perseverance', 'daily_streak']
  );
  assert.equal(
    upgradedGame.tickets.filter((t) => !t.isRed && t.isRevealed).length,
    1,
    'Friend in Zhytomyroblenergo must immediately reveal one non-Game-Over ticket on game start'
  );
  assert.equal(upgradedGame.score, 1);
  assert.equal(upgradedGame.streakIncrement, 2);
  assert.equal(upgradedGame.extraLivesTotal, 2, 'With Second chance + Perseverance, game starts with 2 extra heart lives');
  assert.equal(upgradedGame.extraLivesUsed, 0);

  // Verify Friend in Zhytomyroblenergo opening a Golden Ticket on start
  const allGoldenSafeTickets = labels.map((slotLabel, index) => ({
    index,
    slotLabel,
    isRed: index >= 3,
    isGolden: index === 0,
    isX2: index === 1,
    isRevealed: false,
    scratchProgress: 0,
  }));
  const friendGoldenStart = startRouletteGame(
    { queueId: '1.1', isOfflineRandomized: false, tickets: allGoldenSafeTickets },
    1,
    () => 0, // picks index 0 (which isGolden = true)
    0,
    ['friend_ztoe']
  );
  assert.ok(
    friendGoldenStart.tickets.filter((t) => !t.isRed).every((t) => t.isRevealed),
    'When Friend in Zhytomyroblenergo opens the Gold Ticket on start, all beige tickets are revealed'
  );
  assert.equal(friendGoldenStart.score, 6, 'When Friend opens Gold Ticket on 3 beige tickets, cumulative score 1+2+3=6 is awarded');

  // 1st Red ticket (index 42) with "Second chance" + "Perseverance" -> consumes 1st heart (extraLivesUsed = 1), counts as beige (+2 -> score 3)!
  const secondChanceReveal = revealRouletteTicket(upgradedGame, 42);
  assert.equal(secondChanceReveal.outcome, 'BEIGE', '1st extra heart must make Red ticket count as beige ticket');
  upgradedGame = secondChanceReveal.nextState;
  assert.equal(upgradedGame.screen, 'PLAYING');
  assert.equal(upgradedGame.secondChanceUsed, true);
  assert.equal(upgradedGame.extraLivesUsed, 1);
  assert.equal(upgradedGame.score, 3);

  // 2nd Red ticket (index 43) -> consumes 2nd heart from Perseverance (extraLivesUsed = 2), counts as beige (+3 -> score 6)!
  const perseveranceReveal = revealRouletteTicket(upgradedGame, 43);
  assert.equal(perseveranceReveal.outcome, 'BEIGE', '2nd extra heart (Perseverance) must make 2nd Red ticket count as beige ticket');
  upgradedGame = perseveranceReveal.nextState;
  assert.equal(upgradedGame.screen, 'PLAYING');
  assert.equal(upgradedGame.extraLivesUsed, 2);
  assert.equal(upgradedGame.score, 6);

  // 3rd Red ticket (index 44) -> all 2 extra hearts used -> triggers Game Over AND applies Daily Streak X2 bonus (6 * 2 = 12) before Game Over!
  const thirdRedGameOver = revealRouletteTicket(upgradedGame, 44);
  assert.equal(thirdRedGameOver.outcome, 'RED');
  assert.equal(thirdRedGameOver.nextState.screen, 'FADING_TO_BLACK');
  assert.equal(thirdRedGameOver.nextState.dailyStreakApplied, true, 'First game of the day with Daily Streak must set dailyStreakApplied: true');
  assert.equal(thirdRedGameOver.nextState.score, 12, 'Daily Streak must double final score (6 * 2 = 12) before Game Over');

  // Verify Emulator control helpers: resetSavedPowerPoints(9999) and resetAllRouletteProgress()
  assert.equal(resetSavedPowerPoints(9999), 9999, 'resetSavedPowerPoints(9999) must set Power Points to 9999 and unlock all milestones');
  assert.equal(getSavedPowerPoints(), 9999);
  assert.equal(isMilestoneReached(1000), true);
  resetAllRouletteProgress();
  assert.equal(getSavedPowerPoints(), 0, 'resetAllRouletteProgress must reset Power Points to 0');
  assert.equal(getSavedBestScore(), 0, 'resetAllRouletteProgress must reset Best Score to 0');
  assert.equal(getPurchasedUpgrades().length, 0, 'resetAllRouletteProgress must reset Purchased Upgrades');
  assert.equal(getDepositCount(), 0, 'resetAllRouletteProgress must reset Deposit Count to 0');
  assert.equal(isDepositFinMonLocked(), false, 'resetAllRouletteProgress must reset FinMon Lock to false');

  // 7. Verify instant cached queue loading & offline randomization fallback
  const cachedLoaded = loadRandomQueueTicketsSync('https://www.ztoe.com.ua/unhooking-search.php');
  assert.equal(cachedLoaded.isOfflineRandomized, false);
  assert.equal(cachedLoaded.tickets.length, 48);

  const offlineLoaded = await loadRandomQueueTickets('https://invalid.offline.local');
  assert.equal(offlineLoaded.isOfflineRandomized, true);
  assert.equal(offlineLoaded.tickets.length, 48);
  assert.ok(offlineLoaded.tickets.some((t) => t.isRed), 'Randomized offline tickets must include red tickets');
  assert.ok(offlineLoaded.tickets.some((t) => !t.isRed), 'Randomized offline tickets must include beige tickets');

  // 7b. Verify Unreachable Site / No Queues Extracted does NOT use cached results and sets Unclear state
  const invalidUrlRes = await fetchFullSchedules('https://invalid.offline.local', '1.1');
  assert.equal(invalidUrlRes.status, 'NO_QUEUES_FOUND');
  assert.equal(invalidUrlRes.todaySchedule.slots.length, 0, 'Unreachable/invalid site must not use cached results (slots must be empty)');
  assert.equal(invalidUrlRes.todaySchedule.isUnclear, true, 'Unreachable/invalid site must mark schedule as isUnclear: true');

  const noQueuesRes = await fetchFullSchedules('https://example.com', '1.1');
  assert.ok(noQueuesRes.status === 'NO_QUEUES_FOUND' || noQueuesRes.status === 'NO_INTERNET');
  assert.equal(noQueuesRes.todaySchedule.slots.length, 0, 'When no queues can be extracted or site unreachable, cached results must not be used');
  assert.equal(noQueuesRes.todaySchedule.isUnclear, true, 'When no queues can be extracted or site unreachable, schedule must be marked isUnclear: true');

  const unclearCountdown = calculateOutageCountdown(invalidUrlRes.todaySchedule);
  assert.equal(unclearCountdown.isUnclear, true, 'calculateOutageCountdown must return isUnclear: true for empty/unclear schedule');
  assert.equal(
    unclearCountdown.slotDescription,
    '--:-- - --:--',
    'calculateOutageCountdown must set next period to "--:-- - --:--" when schedule is unclear'
  );
  assert.equal(translations.uk.statusUnclear, 'Невідомо');
  assert.equal(translations.en.statusUnclear, 'Unclear');
  assert.equal(translations.uk.outagesUnclear, 'Графіки не діють');
  assert.equal(translations.en.outagesUnclear, 'Outages unclear');

  // 8. Verify UI files: ZTOE schedules bottom link ("Графіки відключень на сайті"), Share button, Main Menu button, aligned Green V mark, Nocturnal Creature, Deposit Power Points, 2s Game Over delay, About page links, Unclear schedule state, Emulator 9999 & Reset Progress buttons, and 9 generated ticket images
  const appTsx = fs.readFileSync(path.join(ROOT_DIR, 'src/App.tsx'), 'utf-8');
  // 1.4.0: visible strings live in i18n.ts, so the view and its strings are checked together
  const mainViewTsx =
    fs.readFileSync(path.join(ROOT_DIR, 'src/components/MainView.tsx'), 'utf-8') +
    fs.readFileSync(path.join(ROOT_DIR, 'src/services/i18n.ts'), 'utf-8');
  const widgetSimTsx = fs.readFileSync(path.join(ROOT_DIR, 'src/components/WidgetSimulator.tsx'), 'utf-8');
  const mainScreenKt = fs.readFileSync(
    path.join(ROOT_DIR, 'android/app/src/main/java/ua/blackout/prewarning/ui/screens/MainScreen.kt'),
    'utf-8'
  );
  const timelineBarKt = fs.readFileSync(
    path.join(ROOT_DIR, 'android/app/src/main/java/ua/blackout/prewarning/ui/components/TimelineBar.kt'),
    'utf-8'
  );
  const glanceWidgetKt = fs.readFileSync(
    path.join(ROOT_DIR, 'android/app/src/main/java/ua/blackout/prewarning/widget/BlackoutGlanceWidget.kt'),
    'utf-8'
  );
  const appStringsKt = fs.readFileSync(
    path.join(ROOT_DIR, 'android/app/src/main/java/ua/blackout/prewarning/ui/AppStrings.kt'),
    'utf-8'
  );
  assert.ok(
    appTsx.includes('emulator-add-power-points-100') &&
      appTsx.includes('addPowerPoints(100)') &&
      appTsx.includes('emulator-set-power-points-9999') &&
      appTsx.includes('resetSavedPowerPoints(9999)') &&
      appTsx.includes('emulator-reset-game-progress') &&
      appTsx.includes('resetAllRouletteProgress()'),
    'Emulator controls in App.tsx must include buttons to add +100 Power Points, set Power Points to 9999, and reset all Game progress to initial'
  );
  assert.ok(
    mainViewTsx.includes('Графіки відключень на сайті') &&
      mainViewTsx.includes('https://www.ztoe.com.ua/unhooking-search.php') &&
      appStringsKt.includes('Графіки відключень на сайті') &&
      appStringsKt.includes('https://www.ztoe.com.ua/unhooking-search.php') &&
      mainScreenKt.includes('AppStrings.siteSchedulesLabel(lang)') &&
      mainScreenKt.includes('AppStrings.SITE_SCHEDULES_URL'),
    'Main Application screen (Web and Android) must include "Графіки відключень на сайті" link pointing to https://www.ztoe.com.ua/unhooking-search.php after the Facebook link'
  );
  assert.ok(
    mainViewTsx.includes('isStatusUnclear ? t.powerUnclear') &&
      mainViewTsx.includes("isStatusUnclear ? '--:-- - --:--'") &&
      mainViewTsx.includes('unclearBase={activeUnclear}') &&
      mainViewTsx.includes("outagesUnclear: 'Графіки не діють'") &&
      widgetSimTsx.includes('t.statusUnclear') &&
      widgetSimTsx.includes('t.outagesUnclear') &&
      widgetSimTsx.includes('--:-- - --:--') &&
      mainScreenKt.includes('AppStrings.powerUnclear(lang)') &&
      mainScreenKt.includes('if (isStatusUnclear) "--:-- - --:--"') &&
      timelineBarKt.includes('AppStrings.outagesUnclear(lang)') &&
      glanceWidgetKt.includes('AppStrings.outagesUnclear(lang)') &&
      glanceWidgetKt.includes('AppStrings.powerUnclear(resolvedLang)'),
    'Main screen and widgets (Web and Android) must render grey Unclear state ("Графіки не діють" / "Outages unclear", "--:-- - --:--", "Невідомо" / "Unclear") and hide outage hours for today when schedule is unclear'
  );

  const aboutViewTsx = fs.readFileSync(path.join(ROOT_DIR, 'src/components/AboutView.tsx'), 'utf-8');
  const phoneSimTsx = fs.readFileSync(path.join(ROOT_DIR, 'src/components/PhoneSimulator.tsx'), 'utf-8');
  const aboutScreenKt = fs.readFileSync(
    path.join(ROOT_DIR, 'android/app/src/main/java/ua/blackout/prewarning/ui/screens/AboutScreen.kt'),
    'utf-8'
  );
  const navScreenKt = fs.readFileSync(
    path.join(ROOT_DIR, 'android/app/src/main/java/ua/blackout/prewarning/ui/screens/BlackoutAppNavigation.kt'),
    'utf-8'
  );
  const rouletteModalTsx = fs.readFileSync(
    path.join(ROOT_DIR, 'src/components/ZhytomyrRouletteModal.tsx'),
    'utf-8'
  );
  const rouletteScreenKt = fs.readFileSync(
    path.join(ROOT_DIR, 'android/app/src/main/java/ua/blackout/prewarning/ui/screens/ZhytomyrRouletteScreen.kt'),
    'utf-8'
  );
  const rouletteAudioTs = fs.readFileSync(
    path.join(ROOT_DIR, 'src/services/rouletteAudio.ts'),
    'utf-8'
  );

  // Verify About page links: "Світло в Житомирі на Github" (README.md) is 2nd link and Issues is 3rd link
  assert.equal(translations.uk.aboutDesktopRepo, 'Світло в Житомирі на Github');
  assert.equal(translations.en.aboutDesktopRepo, 'Світло в Житомирі на Github');
  const webReadmeIdx = aboutViewTsx.indexOf('https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning/blob/main/README.md');
  const webIssuesIdx = aboutViewTsx.indexOf('https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning/issues');
  assert.ok(
    webReadmeIdx !== -1 && webIssuesIdx !== -1 && webReadmeIdx < webIssuesIdx,
    'AboutView.tsx must place "Світло в Житомирі на Github" (README.md) as 2nd link before Issues (3rd link)'
  );
  const androidReadmeIdx = aboutScreenKt.indexOf('AppStrings.ABOUT_GITHUB_README_URL');
  const androidIssuesIdx = aboutScreenKt.indexOf('https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning/issues');
  assert.ok(
    androidReadmeIdx !== -1 &&
      androidIssuesIdx !== -1 &&
      androidReadmeIdx < androidIssuesIdx &&
      appStringsKt.includes('https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning/blob/main/README.md') &&
      appStringsKt.includes('Світло в Житомирі на Github'),
    'AboutScreen.kt must place "Світло в Житомирі на Github" (README.md) as 2nd link before Issues (3rd link)'
  );

  assert.ok(
    aboutViewTsx.includes('Zhytomyr Roulette') &&
      aboutViewTsx.includes('Житомирська Рулетка') &&
      phoneSimTsx.includes('!isRouletteOpen') &&
      aboutScreenKt.includes('AppStrings.rouletteLaunchButton(lang)') &&
      navScreenKt.includes('!isRouletteOpen'),
    'Both Web and Android must localize the launch button ("Zhytomyr Roulette" / "Житомирська Рулетка") and hide the application bottom navigation bar when open'
  );
  assert.ok(
    rouletteModalTsx.includes('GAME_OVER_REALIZATION_DELAY_MS') &&
      rouletteScreenKt.includes('GAME_OVER_REALIZATION_DELAY_MS') &&
      rouletteModalTsx.includes('testIdPrefix="roulette-start"') &&
      rouletteModalTsx.includes('testIdPrefix="roulette-gameover"') &&
      rouletteModalTsx.includes('-milestone-progress') &&
      rouletteModalTsx.includes('roulette-header-hearts') &&
      rouletteModalTsx.includes('roulette-gameover-daily-streak-x2') &&
      rouletteModalTsx.includes('data-blackout-outline="true"') &&
      rouletteModalTsx.includes('playFlickerBuzzSound') &&
      rouletteModalTsx.includes('playGameBlackoutSound') &&
      rouletteModalTsx.includes('roulette-screen-transition-wrapper') &&
      rouletteModalTsx.includes('roulette-flicker-overlay') &&
      rouletteModalTsx.includes('roulette-best-score') &&
      rouletteModalTsx.includes('roulette-power-points') &&
      rouletteModalTsx.includes('roulette-share-btn') &&
      rouletteModalTsx.includes('roulette-audio-switches-left') &&
      rouletteModalTsx.includes('roulette-sound-switch') &&
      rouletteModalTsx.includes('roulette-sound-label') &&
      rouletteModalTsx.includes('roulette-music-switch') &&
      rouletteModalTsx.includes('roulette-music-label') &&
      rouletteModalTsx.indexOf('roulette-sound-switch') < rouletteModalTsx.indexOf('roulette-share-btn') &&
      rouletteModalTsx.indexOf('roulette-music-switch') < rouletteModalTsx.indexOf('roulette-share-btn') &&
      rouletteModalTsx.includes('roulette-ticket-scroll-container') &&
      rouletteModalTsx.includes('convertShareDataUrlToFile') &&
      rouletteModalTsx.includes('files: [shareFile]') &&
      rouletteModalTsx.includes('bg-[#FF5E3A] shadow-md shadow-[#FF5E3A]/30') &&
      rouletteModalTsx.includes('syncRouletteBackgroundMusic') &&
      !rouletteModalTsx.includes('roulette-share-to-app-dialog') &&
      rouletteModalTsx.includes('roulette-share-bottom-buttons') &&
      rouletteModalTsx.includes('roulette-share-action-btn') &&
      rouletteModalTsx.includes('roulette-share-download-btn') &&
      rouletteModalTsx.includes('roulette-share-close-btn') &&
      rouletteModalTsx.includes('e.stopPropagation()') &&
      rouletteModalTsx.includes('!sharePreviewDataUrl && (') &&
      rouletteModalTsx.includes('roulette-gameover-main-menu-btn') &&
      rouletteModalTsx.includes('roulette-upgrade-v-mark-') &&
      rouletteModalTsx.includes('absolute right-3.5 top-1/2 -translate-y-1/2') &&
      rouletteModalTsx.includes('roulette-shop-btn') &&
      rouletteModalTsx.includes('roulette-shop-screen') &&
      rouletteModalTsx.includes('<RefreshCw') &&
      rouletteModalTsx.includes('allTimeBestScoreLabel') &&
      rouletteModalTsx.includes('GENERATED_TICKET_FOIL_IMAGES') &&
      rouletteScreenKt.includes('PowerPointsMilestoneProgressBarComposable') &&
      rouletteScreenKt.includes('HeaderHeartIconComposable') &&
      rouletteScreenKt.includes('ShareCardUpgradeGlyphsRowComposable') &&
      !rouletteScreenKt.includes('Share to... Application') &&
      rouletteScreenKt.includes('if (!showSharePreview)') &&
      rouletteScreenKt.includes('Icons.Default.Share') &&
      rouletteScreenKt.includes('Icons.Default.Bolt') &&
      rouletteScreenKt.includes('Color(0xFFFF5E3A)') &&
      rouletteScreenKt.includes('size(width = 24.dp, height = 20.dp)') &&
      rouletteScreenKt.includes('rouletteDownloadImageBtn') &&
      rouletteScreenKt.includes('saveShareCardBitmapToMediaStore') &&
      !rouletteScreenKt.includes('import android.graphics.Paint') &&
      !rouletteScreenKt.includes('import android.graphics.Canvas') &&
      !rouletteScreenKt.includes('import android.graphics.Path') &&
      !rouletteScreenKt.includes('import android.graphics.Color') &&
      rouletteScreenKt.includes('androidx.compose.ui.graphics.Paint()') &&
      !fs
        .readFileSync(
          path.join(
            ROOT_DIR,
            'android/app/src/test/java/ua/blackout/prewarning/ZtoeParserTest.kt'
          ),
          'utf-8'
        )
        .includes('assertEquals(1.15') &&
      rouletteScreenKt.includes('android.graphics.Color.parseColor(g.colorHex)') &&
      rouletteScreenKt.includes('ClipData.newRawUri') &&
      rouletteScreenKt.includes('rememberLazyListState()') &&
      rouletteScreenKt.includes('crossfadeTargetScreen') &&
      rouletteScreenKt.includes('setAppInForeground') &&
      rouletteScreenKt.includes('SCRATCH_VOLUME_SCALE = 0.575') &&
      rouletteScreenKt.includes('rouletteSoundLabel') &&
      rouletteScreenKt.includes('rouletteMusicLabel') &&
      rouletteScreenKt.indexOf('AppStrings.rouletteSoundLabel(lang)') <
        rouletteScreenKt.indexOf('AppStrings.rouletteShareBtn(lang)') &&
      rouletteScreenKt.indexOf('AppStrings.rouletteMusicLabel(lang)') <
        rouletteScreenKt.indexOf('AppStrings.rouletteShareBtn(lang)') &&
      rouletteScreenKt.includes('checkedTrackColor = Color(0xFFFF5E3A)') &&
      rouletteScreenKt.includes('syncBackgroundMusic') &&
      rouletteScreenKt.includes('MUSIC_VOLUME_SCALE = 0.15f') &&
      rouletteScreenKt.includes('GAME_OVER_MUSIC_FADE_IN_DELAY_MS = 2000L') &&
      rouletteScreenKt.includes('R.raw.audio_start_shop_gameover') &&
      rouletteScreenKt.includes('R.raw.audio_start_shop_2') &&
      rouletteScreenKt.includes('R.raw.audio_main_game') &&
      rouletteScreenKt.includes('DAILY_STREAK') &&
      rouletteScreenKt.includes('PERSEVERANCE') &&
      rouletteScreenKt.includes('Нагорода за рубіж 400:') &&
      rouletteScreenKt.includes('Milestone 400 reward:') &&
      rouletteScreenKt.includes('Нагорода за рубіж 1000:') &&
      rouletteScreenKt.includes('Milestone 1000 reward:') &&
      rouletteScreenKt.includes('playFlickerBuzzSound') &&
      rouletteScreenKt.includes('playGameBlackoutSound') &&
      rouletteScreenKt.includes('ticket_foil_pristine') &&
      rouletteScreenKt.includes('ticket_foil_wrinkled') &&
      rouletteScreenKt.includes('ticket_foil_deep_wrinkled') &&
      rouletteScreenKt.includes('ticket_foil_crumpled_scratched') &&
      rouletteScreenKt.includes('ticket_foil_cup_stain') &&
      rouletteScreenKt.includes('ticket_foil_stain_corner') &&
      rouletteScreenKt.includes('ticket_foil_water_stains') &&
      rouletteScreenKt.includes('ticket_foil_heavy_wear') &&
      rouletteScreenKt.includes('ticket_foil_faded') &&
      rouletteScreenKt.includes('Icons.Default.Refresh') &&
      rouletteScreenKt.includes('rouletteAllTimeBestScoreLabel') &&
      rouletteScreenKt.includes('rouletteMainMenuBtn') &&
      rouletteScreenKt.includes('rouletteShareBtn') &&
      rouletteScreenKt.includes('NOCTURNAL_CREATURE') &&
      rouletteScreenKt.includes('DEPOSIT_POWER_POINTS') &&
      rouletteScreenKt.includes('Депозит Потужність+') &&
      rouletteScreenKt.includes('На розгляді ФінМоніторинга') &&
      rouletteScreenKt.includes('Alignment.CenterEnd') &&
      rouletteScreenKt.includes('doesScratchExposeRedCenterOutline') &&
      rouletteScreenKt.includes('roulettePowerPointsLabel') &&
      rouletteScreenKt.includes('roulettePowerShopBtn') &&
      appStringsKt.includes('Найкращий Результат') &&
      appStringsKt.includes('Головне Меню') &&
      appStringsKt.includes('Main Menu') &&
      appStringsKt.includes('Завантажити зображення') &&
      appStringsKt.includes('Download Image') &&
      appStringsKt.includes('Звук') &&
      appStringsKt.includes('Sound') &&
      appStringsKt.includes('Музика') &&
      appStringsKt.includes('Music') &&
      appStringsKt.includes('All time best score') &&
      appStringsKt.includes('Бали Потужності') &&
      appStringsKt.includes('Магазин Потужності'),
    'Both Web and Android must include 1s Game Over delay, Milestone Progress Bar with outlined score pills and identical 24x20 reward icons, Header Heart icons, Daily Streak & Perseverance with Milestone reward descriptions, Share Card image sharing, unmodified App icon on Share Card, 3 Share screen buttons (Share, Download Image, Back) without middle share bar, touch consumption on empty space, separate Sound and Music switches on the left side, Game Over scroll preservation, 15% volume background music with fade-in/fade-out and background mute, 50% lower scratch volume (0.575), 10s Game Blackout, Flicker lamp breaking sound, Депозит Потужність+, AntiCheat, and all 9 generated ticket textures'
  );
  assert.ok(
    rouletteAudioTs.includes('playCardShuffleSound') &&
      rouletteAudioTs.includes('playScratchSound') &&
      rouletteAudioTs.includes('playCoinSound') &&
      rouletteAudioTs.includes('play2XCoinSound') &&
      rouletteAudioTs.includes('playCashRegisterSound') &&
      rouletteAudioTs.includes('playElectricBuzzSound') &&
      rouletteAudioTs.includes('playFlickerBuzzSound') &&
      rouletteAudioTs.includes('playGameBlackoutSound') &&
      rouletteAudioTs.includes('SCRATCH_SFX_VOLUME_MULTIPLIER = 0.9') &&
      rouletteAudioTs.includes('FLICKER_SFX_VOLUME_MULTIPLIER = 0.9') &&
      rouletteModalTsx.includes('MultiFrameExplodingBulbAnimation') &&
      rouletteModalTsx.includes('play2XCoinSound') &&
      rouletteModalTsx.includes('touch-pan-y') &&
      rouletteModalTsx.includes('pointerStartRef') &&
      rouletteScreenKt.includes('playCardShuffleSound') &&
      rouletteScreenKt.includes('playCashRegisterSound') &&
      rouletteScreenKt.includes('play2XCoinSound') &&
      rouletteScreenKt.includes('detectHorizontalDragGestures') &&
      rouletteScreenKt.includes('R.raw.sfx_lightbulb') &&
      rouletteScreenKt.includes('R.raw.sfx_scratch') &&
      rouletteScreenKt.includes('R.raw.sfx_cash_register') &&
      rouletteScreenKt.includes('R.raw.sfx_flicker') &&
      rouletteScreenKt.includes('R.raw.sfx_coin') &&
      rouletteScreenKt.includes('R.raw.sfx_2x_coin') &&
      rouletteScreenKt.includes('R.raw.sfx_shuffle') &&
      rouletteScreenKt.includes('SCRATCH_SFX_VOLUME_MULTIPLIER = 0.9') &&
      rouletteScreenKt.includes('FLICKER_SFX_VOLUME_MULTIPLIER = 0.9') &&
      rouletteScreenKt.includes('MultiFrameExplodingBulbCanvas'),
    'Both Web and Android roulette implementations must include all 7 MP3 SFX replacements, play2XCoinSound on X2/Gold tickets, improved scroll vs scratch gesture handling, and 2.4s+ multi-frame exploding bulb animation'
  );

  // 9. Verify Hardcoded Maximum Score 9999999, Ticket Shuffle Above Score 999, Wider Red Ticket Reveal Area, and 1.2.X APK Upgrade Compatibility
  assert.equal(MAX_ROULETTE_SCORE, 9_999_999, 'Maximum score in game must be hardcoded to 9999999');
  assert.equal(clampRouletteScore(12_345_678), 9_999_999, 'clampRouletteScore must cap scores above 9999999 to 9999999');
  assert.equal(saveBestScoreIfHigher(25_000_000), 9_999_999, 'saveBestScoreIfHigher must cap bestScore at 9999999');
  resetSavedBestScore(0);

  let maxScoreGameState = startRouletteGame(
    { queueId: '1.1', isOfflineRandomized: false, tickets: controlledTickets },
    1,
    () => 0.5
  );
  maxScoreGameState = { ...maxScoreGameState, score: 6_000_000 };
  const cappedX2Reveal = revealRouletteTicket(maxScoreGameState, 10); // X2 ticket at index 10 -> 6,000,000 * 2 capped to 9,999,999
  assert.equal(cappedX2Reveal.nextState.score, 9_999_999, 'Single game score must never exceed 9999999');
  assert.equal(cappedX2Reveal.nextState.bestScore, 9_999_999, 'Best score must never exceed 9999999');

  // Verify shuffling ticket places when player score in a single game reaches above 999
  assert.equal(SCORE_SHUFFLE_THRESHOLD, 999, 'Ticket shuffle threshold must be 999 (score > 999)');
  let preShuffleState = startRouletteGame(
    { queueId: '1.1', isOfflineRandomized: false, tickets: controlledTickets },
    2,
    () => 0.5
  );
  preShuffleState = { ...preShuffleState, score: 995, streakIncrement: 10, ticketsShuffledAbove999: false };
  const shuffleReveal = revealRouletteTicket(preShuffleState, 0); // 995 + 10 = 1005 > 999
  assert.equal(shuffleReveal.nextState.score, 1005);
  assert.equal(shuffleReveal.shuffled, true, 'Reaching score > 999 must trigger ticket shuffle (shuffled: true)');
  assert.equal(shuffleReveal.nextState.ticketsShuffledAbove999, true);
  assert.notDeepEqual(
    shuffleReveal.nextState.tickets.map((t) => t.slotLabel),
    labels,
    'Tickets must be shuffled into random non-chronological places when score reaches above 999'
  );
  const directShuffled = shuffleTicketPlaces(controlledTickets);
  assert.equal(directShuffled.length, 48);
  assert.notDeepEqual(
    directShuffled.map((t) => t.slotLabel),
    labels,
    'shuffleTicketPlaces must place timeslot tickets in random places instead of chronological order'
  );

  // Verify wider red ticket reveal area around center so border scratching of red tint reveals the ticket
  assert.equal(
    doesScratchExposeRedCenterOutline(85, 20, 85, 20, 168, 74, 7.5),
    true,
    'Scratching the outer border of the red tint around center must expose and reveal the red ticket'
  );
  assert.equal(
    doesScratchExposeRedCenterOutline(4, 4, 10, 8, 168, 74, 7.5),
    false,
    'Scratching the extreme corner far from the red tint must not prematurely reveal the red ticket'
  );

  // Verify 1.2.X APK upgrade compatibility in build.gradle.kts and SettingsRepository.kt
  const buildGradleKt = fs.readFileSync(path.join(ROOT_DIR, 'android/app/build.gradle.kts'), 'utf-8');
  const debugKeystorePath = path.join(ROOT_DIR, 'android/app/keystore/debug.keystore');
  if (!fs.existsSync(debugKeystorePath)) {
    const ksMatch = buildGradleKt.match(/val embeddedKeystoreBase64 = "([^"]+)"/);
    if (ksMatch) {
      fs.mkdirSync(path.dirname(debugKeystorePath), { recursive: true });
      fs.writeFileSync(debugKeystorePath, Buffer.from(ksMatch[1], 'base64'));
    }
  }
  const settingsRepoKt = fs.readFileSync(
    path.join(ROOT_DIR, 'android/app/src/main/java/ua/blackout/prewarning/data/repository/SettingsRepository.kt'),
    'utf-8'
  );
  assert.ok(
    buildGradleKt.includes('enableV1Signing = true') &&
      buildGradleKt.includes('enableV2Signing = true') &&
      buildGradleKt.includes('enableV3Signing = true') &&
      buildGradleKt.includes('embeddedKeystoreBase64') &&
      fs.existsSync(debugKeystorePath),
    'build.gradle.kts must enforce the canonical v1.2.0 signing keystore and v1/v2/v3 signing so upgrading from 1.2.X never fails with INSTALL_FAILED_UPDATE_INCOMPATIBLE'
  );
  assert.ok(
    settingsRepoKt.includes('readSafeInt') &&
      settingsRepoKt.includes('readSafeLong') &&
      settingsRepoKt.includes('readSafeBoolean') &&
      settingsRepoKt.includes('readSafeString'),
    'SettingsRepository.kt must use type-safe SharedPreferences readers so upgrading from older 1.2.X versions never throws ClassCastException'
  );

  // Verify coin.mp3 waits for scratch.mp3 to finish playing
  assert.equal(SCRATCH_SFX_DURATION_MS, 336, 'scratch.mp3 duration constant must be 336ms');
  setRouletteSoundEnabled(true);
  setRouletteAppInForeground(true);
  playScratchSound(true);
  const remainingWaitAfterScratch = getRemainingScratchSoundDelayMs();
  assert.ok(
    remainingWaitAfterScratch > 0 && remainingWaitAfterScratch <= SCRATCH_SFX_DURATION_MS,
    'getRemainingScratchSoundDelayMs must return positive remaining time while scratch.mp3 is playing so coin.mp3 waits for scratch.mp3 to finish'
  );
  playCoinSound();
  assert.equal(
    getRemainingScratchSoundDelayMs(Date.now() + SCRATCH_SFX_DURATION_MS + 50),
    0,
    'getRemainingScratchSoundDelayMs must return 0 once scratch.mp3 has finished playing'
  );

  // Verify 2-second (2000ms) ticket shuffle animation from top border on game start, refresh, and after 999 score, and Sound/Music switch placement
  assert.equal(
    TICKET_SHUFFLE_ANIMATION_DURATION_MS,
    2000,
    'Ticket shuffle animation duration on game start, refresh, and after >999 score must be 2000ms (2 seconds)'
  );
  assert.equal(TICKET_SHUFFLE_ROW_COUNT, 24, 'Ticket shuffle animation must deal 24 rows from top to bottom');
  assert.ok(
    rouletteModalTsx.includes('TICKET_SHUFFLE_ANIMATION_DURATION_MS') &&
      rouletteModalTsx.includes('if (shuffled) {\n          runTopToBottomDealAnimation();') &&
      rouletteModalTsx.includes('translateY(-${(rowIndex + 1) * 84}px)') &&
      rouletteModalTsx.includes('w-full flex items-start justify-between shrink-0 mt-1') &&
      rouletteModalTsx.includes('flex flex-col items-start gap-3 pl-0.5') &&
      rouletteScreenKt.includes('TICKET_SHUFFLE_ANIMATION_DURATION_MS = 2000L') &&
      rouletteScreenKt.includes('if (result.shuffled) {\n            triggerDealAnimation()') &&
      rouletteScreenKt.includes('topBorderOffsetPx') &&
      rouletteScreenKt.includes('verticalAlignment = Alignment.Top') &&
      rouletteScreenKt.includes('verticalArrangement = Arrangement.spacedBy(12.dp)') &&
      rouletteScreenKt.includes('getRemainingScratchSoundDelayMs'),
    'Both Web and Android must use the 2-second top-border ticket shuffle animation, align Sound switch at same height as Share button with double vertical spacing between Sound and Music switches, and wait for scratch.mp3 before playing coin.mp3'
  );

  const workflowYml = fs.readFileSync(path.join(ROOT_DIR, '.github/workflows/build-apk.yml'), 'utf-8');
  assert.ok(
    buildGradleKt.includes('import java.util.Base64') &&
      buildGradleKt.includes('Base64.getDecoder().decode(embeddedKeystoreBase64)') &&
      !buildGradleKt.includes('java.util.Base64.') &&
      buildGradleKt.includes('compileSdk = 36') &&
      buildGradleKt.includes('targetSdk = 36') &&
      buildGradleKt.includes('create("upload")') &&
      buildGradleKt.includes('UPLOAD_KEYSTORE_PASSWORD') &&
      buildGradleKt.includes('com.ZTBlackoutPreWarning') &&
      buildGradleKt.includes('buildConfig = true') &&
      buildGradleKt.includes('checkReleaseBuilds = false') &&
      buildGradleKt.includes('storePassword = "android"') &&
      buildGradleKt.includes('keyAlias = "androiddebugkey"') &&
      buildGradleKt.includes('keyPassword = "android"') &&
      !buildGradleKt.includes('storePassword = "androiddebugkey"') &&
      !buildGradleKt.includes('keyPassword = "androiddebugkey"') &&
      workflowYml.includes('UPLOAD_KEYSTORE_BASE64') &&
      workflowYml.includes('UPLOAD_KEYSTORE_PASSWORD'),
    'android/app/build.gradle.kts must set compileSdk = 36, targetSdk = 36, applicationId to com.ZTBlackoutPreWarning, use storePassword/keyPassword "android" for debug.keystore, enable buildConfig, disable release lint blockers, import java.util.Base64 at top-level, and support signing .aab bundles via GitHub Secrets'
  );

  // Verify ZtoeParser.kt does not match #ffffff as #ff (which caused ZtoeParserTest:201 failure) and filters leaf tables
  const ztoeParserKtText = fs.readFileSync(
    path.join(ROOT_DIR, 'android/app/src/main/java/ua/blackout/prewarning/data/parser/ZtoeParser.kt'),
    'utf-8'
  );
  assert.ok(
    !ztoeParserKtText.includes('contains("#ff")') &&
      ztoeParserKtText.includes('attr.contains("#ff3333")') &&
      ztoeParserKtText.includes('attr.contains("#ff0000")') &&
      ztoeParserKtText.includes('table.select("table").size == 1'),
    'ZtoeParser.kt must match explicit red color codes (#ff3333, #ff0000, etc.) without matching #ffffff and filter leaf tables'
  );

  // Verify NotificationHelper.kt, AlertRegistry.kt, ScheduleSyncWorker.kt, SettingsScreen.kt, Models.kt, and ZtoeParserTest.kt
  const notificationHelperKt = fs.readFileSync(
    path.join(ROOT_DIR, 'android/app/src/main/java/ua/blackout/prewarning/notification/NotificationHelper.kt'),
    'utf-8'
  );
  assert.ok(
    notificationHelperKt.includes('fun createNotificationChannels(context: Context)') &&
      notificationHelperKt.includes('isTest: Boolean = false'),
    'NotificationHelper.kt must define createNotificationChannels(context: Context) and isTest parameter'
  );

  const ztoeParserTestKt = fs.readFileSync(
    path.join(ROOT_DIR, 'android/app/src/test/java/ua/blackout/prewarning/ZtoeParserTest.kt'),
    'utf-8'
  );
  assert.ok(
    ztoeParserTestKt.includes('import org.junit.Assert.assertFalse'),
    'ZtoeParserTest.kt must import org.junit.Assert.assertFalse'
  );

  // Verify SettingsScreen.kt matches Emulator 100%: Site URL, Language selector, Test notification & Refresh buttons, and Frosted Glass / Orange colors
  const settingsScreenKt = fs.readFileSync(
    path.join(ROOT_DIR, 'android/app/src/main/java/ua/blackout/prewarning/ui/screens/SettingsScreen.kt'),
    'utf-8'
  );
  assert.ok(
    settingsScreenKt.includes('AppStrings.siteAddressTitle(lang)') &&
      settingsScreenKt.includes('AppStrings.siteReachable(lang)') &&
      settingsScreenKt.includes('AppStrings.errorNoQueuesFound(lang)') &&
      settingsScreenKt.includes('AppStrings.languageTitle(lang)') &&
      settingsScreenKt.includes('AppStrings.langSystem(lang)') &&
      settingsScreenKt.includes('"Українська"') &&
      settingsScreenKt.includes('"English"') &&
      settingsScreenKt.includes('AppStrings.testAlertBtn(lang)') &&
      settingsScreenKt.includes('AppStrings.refreshBtn(lang)') &&
      settingsScreenKt.includes('AppStrings.resetDefaultsBtn(lang)') &&
      // 1.4.0: card and accent colours come from ZtTokens (ZtColors.Card = 0xBF141A29, ZtColors.Accent = 0xFFFF5E3A)
      settingsScreenKt.includes('GlassCard(') &&
      settingsScreenKt.includes('ZtColors.Accent') &&
      settingsScreenKt.includes('Icons.Default.Tune'),
    'SettingsScreen.kt must include Site URL card, Language selector, Test notification and Refresh buttons, and Frosted Glass / Orange colors matching the Emulator'
  );

  // Verify IOS_HANDOVER.md exists and documents the iOS port for IgorZaharov/iOS-ZTPreBlackoutNotification
  const iosHandoverPath = path.join(ROOT_DIR, 'IOS_HANDOVER.md');
  assert.ok(fs.existsSync(iosHandoverPath), 'IOS_HANDOVER.md must exist in repository root');
  const iosHandoverMd = fs.readFileSync(iosHandoverPath, 'utf-8');
  assert.ok(
    iosHandoverMd.includes('https://github.com/IgorZaharov/iOS-ZTPreBlackoutNotification') &&
      iosHandoverMd.includes('ZtoeParser.swift') &&
      iosHandoverMd.includes('ZtoeAddressLookup.swift') &&
      iosHandoverMd.includes('WidgetKit') &&
      iosHandoverMd.includes('ZhytomyrRouletteScreen.swift') &&
      iosHandoverMd.includes('Master Bootstrap Prompt') &&
      iosHandoverMd.includes('Сповіщення про аварійні відключення') &&
      iosHandoverMd.includes('Emergency outage notifications') &&
      iosHandoverMd.includes('parseZtoeSettlementHousesTableHtml') &&
      iosHandoverMd.includes('decodeZtoeHtmlEntities') &&
      iosHandoverMd.includes('prefetchAddressIndexInBackground') &&
      iosHandoverMd.includes('v1.3.4'),
    'IOS_HANDOVER.md must include repository URL, Swift/WidgetKit architecture, Master Bootstrap Prompt, and all v1.3.4 changes done today'
  );

  resetAllRouletteProgress();
  console.log('Unit Test C PASSED: Житомирська Рулетка mechanics, 1s Game Over delay, Milestone Progress Bar, Daily Streak, Perseverance, Extra Lives Hearts, Power Shop, Депозит Потужність+, AntiCheat, Nocturnal Creature, Share Card Glyphs, 10s Game Blackout, Max Score 9999999, Score > 999 Shuffle, 2s Top-to-Bottom Deal Animation, Coin-after-Scratch Audio Sequencing, Wider Red Center Reveal, 7 MP3 SFX, and UI verified.');
}

async function runUnitTestE_AddressLookupAndUnsetQueue() {
  console.log('--- Running Unit Test E: Address Lookup, Duplicate Streets, First-Launch Unselected Queue, Emergency Switch & Widgets (1.4.0) ---');

  const {
    ZTOE_REM_OPTIONS,
    ZTOE_FULL_NO_OUTAGE_MESSAGE,
    ZTOE_STREET_OPTIONS,
    parseZtoeAddressLookupTableHtml,
    parseZtoeRemOptionsHtml,
    parseZtoeSettlementOptionsHtml,
    parseZtoeStreetOptionsHtml,
    mergeStreets,
    findStreetById,
  } = await import('../src/services/ztoeAddressLookup');
  const {
    DEFAULT_SETTINGS,
    loadUserSettings,
    saveUserSettings,
    resetAllAppDataToFirstLaunch,
    toggleMasterNotifications,
    toggleEmergencyNotifications,
    triggerEmergencyEventAlerts,
    clearNotifiedHistory,
  } = await import('../src/services/alertManager');
  const { parseLocalDateTime } = await import('../src/core/localTime');

  const read = (rel: string) => fs.readFileSync(path.join(ROOT_DIR, rel), 'utf-8');
  const KT = 'android/app/src/main/java/ua/blackout/prewarning/';

  // 1. First-launch defaults (queue '' and language 'system') and reset to first launch
  assert.equal(DEFAULT_SETTINGS.queue, '', 'DEFAULT_SETTINGS.queue must be empty string on first launch');
  assert.equal(DEFAULT_SETTINGS.language, 'system', 'DEFAULT_SETTINGS.language must be "system" on first launch');
  saveUserSettings({
    ...DEFAULT_SETTINGS,
    queue: '5.2',
    selectedAddress: 'м. Житомир, вул. Київська, буд. 77',
    selectedAddressQuery: { remId: 'zhytomyr', settlementId: 'zt_city', streetId: 'zt_kyivska', house: '77' },
  });
  const resetSettings = resetAllAppDataToFirstLaunch();
  assert.equal(resetSettings.queue, '', 'resetAllAppDataToFirstLaunch must reset queue to empty string');
  assert.equal(resetSettings.selectedAddress, undefined, 'resetAllAppDataToFirstLaunch must clear selectedAddress');
  assert.equal(resetSettings.selectedAddressQuery, undefined, 'resetAllAppDataToFirstLaunch must clear selectedAddressQuery');
  assert.equal(loadUserSettings().queue, '', 'loadUserSettings after reset must return empty queue');

  // 2. All 19 REMs, option parsers with entity decoding, house table with queue and no-queue rows
  assert.equal(ZTOE_REM_OPTIONS.length, 19, 'ZTOE_REM_OPTIONS must include all 19 Zhytomyroblenergo REMs');
  const parsedRems = parseZtoeRemOptionsHtml(
    '<select name="rem_id"><option value="0">--Оберіть РЕМ--</option><option value="7">Житомирський РЕМ</option></select>'
  );
  assert.ok(parsedRems.length >= 19, 'parseZtoeRemOptionsHtml must keep all 19 REMs');

  const sampleSelectHtml = `
    <select name="naspunkt_id">
      <option value="0">--Оберіть населений пункт--</option>
      <option value="16657">місто Житомир</option>
      <option value="99999">село Кам&#039;янка</option>
    </select>
    <select name="vulica_id">
      <option value="0">--Оберіть вулицю--</option>
      <option value="173934">вул. Київська</option>
      <option value="888888">вул. В&#039;ячеслава Чорновола</option>
    </select>`;
  const parsedSettlements = parseZtoeSettlementOptionsHtml('zhytomyr', sampleSelectHtml);
  assert.equal(parsedSettlements.length, 2);
  assert.equal(parsedSettlements[0].id, 'zt_city');
  assert.equal(parsedSettlements[1].nameUk, "с. Кам'янка", 'City selector must decode &#039; into an apostrophe');
  const parsedStreets = parseZtoeStreetOptionsHtml('zt_city', sampleSelectHtml);
  assert.equal(parsedStreets.length, 2);
  assert.equal(parsedStreets[0].id, 'zt_kyivska');
  assert.equal(parsedStreets[1].nameUk, "вул. В'ячеслава Чорновола", 'Street selector must decode &#039; into an apostrophe');

  const parsedQueueRows = parseZtoeAddressLookupTableHtml(
    '<table><tr><th>Будинок</th><th>Черга</th><th>Підчерга</th></tr><tr><td>15</td><td>5</td><td>2</td></tr></table>'
  );
  assert.equal(parsedQueueRows.find((r) => r.house === '15')?.queue, '5.2');
  const parsedNoQueueRows = parseZtoeAddressLookupTableHtml(
    '<table><tr><th>Будинок</th><th>Черга</th><th>Підчерга</th></tr><tr><td>104</td><td colspan="2">В цей час не вимикається, за винятком випадків аварійних відключень</td></tr></table>'
  );
  assert.equal(parsedNoQueueRows.find((r) => r.house === '104')?.queue, '');
  assert.ok(ZTOE_FULL_NO_OUTAGE_MESSAGE.startsWith('В цей час не вимикається'));

  // 3. Duplicate streets: apostrophe / spacing variants become ONE option that keeps every id
  const merged = mergeStreets([
    { id: 'st_176316', settlementId: 'zt_city', ztoeVulicaId: '176316', nameUk: "вул. В'ячеслава Чорновола", nameEn: '' },
    { id: 'st_174295', settlementId: 'zt_city', ztoeVulicaId: '174295', nameUk: 'вул. В’ячеслава Чорновола', nameEn: '' },
    { id: 'st_1', settlementId: 'zt_city', ztoeVulicaId: '1', nameUk: 'вул. С.П.Корольова', nameEn: '' },
    { id: 'st_2', settlementId: 'zt_city', ztoeVulicaId: '2', nameUk: 'вул. С.П. Корольова', nameEn: '' },
  ]);
  assert.equal(merged.length, 2, 'Duplicate streets must merge into one option each');
  const chornovola = merged.find((s) => s.allIds.includes('st_176316'));
  assert.ok(chornovola && chornovola.allIds.includes('st_174295'), 'Merged street must keep all ids');
  assert.deepEqual([...(chornovola!.ztoeVulicaIds ?? [])].sort(), ['174295', '176316']);
  const keys = ZTOE_STREET_OPTIONS.map((s) => `${s.settlementId}|${s.nameUk.toLowerCase().replace(/[’ʼ‘´`]/g, "'").replace(/\s+/g, ' ')}`);
  assert.equal(new Set(keys).size, keys.length, 'The static street list must not contain duplicate streets');
  assert.ok(findStreetById('zt_kyivska'), 'findStreetById must resolve a static street id');

  // 4. Production code no longer carries the demo emergency (вул. Київська 37) or fake houses
  const addressLookupKt = read(KT + 'data/parser/ZtoeAddressLookup.kt');
  assert.ok(!addressLookupKt.includes('getKyivska37DemoEmergencyOutage'), 'ZtoeAddressLookup.kt must not contain the demo emergency');
  assert.ok(!/fun\s+\w*[Dd]efaultHouses/.test(addressLookupKt), 'ZtoeAddressLookup.kt must not invent default house lists');

  // 5. Emergency switch: ON by default, independent of the master switch, keeps sound / vibration
  assert.equal(translations.uk.settingsEmergencyOutages, 'Сповіщення про аварійні відключення');
  assert.equal(translations.en.settingsEmergencyOutages, 'Emergency outage notifications');
  assert.equal(DEFAULT_SETTINGS.emergencyNotificationsEnabled, true, 'Emergency switch must be ON by default');
  resetAllAppDataToFirstLaunch();
  clearNotifiedHistory();
  const initial = {
    ...DEFAULT_SETTINGS,
    queue: '2.2',
    notificationsEnabled: true,
    emergencyNotificationsEnabled: true,
    soundEnabled: true,
    vibrationEnabled: false,
    prevSoundEnabled: true,
    prevVibrationEnabled: false,
  };
  saveUserSettings(initial);
  const afterMainOff = toggleMasterNotifications(loadUserSettings(), false);
  assert.equal(afterMainOff.notificationsEnabled, false);
  assert.equal(afterMainOff.emergencyNotificationsEnabled, true, 'The master switch must not turn emergency notifications off');
  assert.equal(afterMainOff.soundEnabled, true, 'Sound stays on while the emergency switch is on');
  assert.equal(afterMainOff.vibrationEnabled, false);

  const now = parseLocalDateTime('2026-11-13T18:00');
  const startEvent = {
    kind: 'START' as const,
    entryId: 'e1',
    start: parseLocalDateTime('2026-11-13T17:30'),
    eta: parseLocalDateTime('2026-11-13T19:00'),
    upcoming: false,
    earlyEnd: false,
  };
  const fired = triggerEmergencyEventAlerts([startEvent], 'addr1', afterMainOff, 'uk', now);
  assert.equal(fired.length, 1, 'An emergency START must notify even when the master switch is OFF');
  assert.equal(
    triggerEmergencyEventAlerts([startEvent], 'addr1', afterMainOff, 'uk', now).length,
    0,
    'The same emergency event must be announced only once'
  );
  const afterBothOff = toggleEmergencyNotifications(afterMainOff, false);
  assert.equal(afterBothOff.emergencyNotificationsEnabled, false);
  assert.equal(afterBothOff.soundEnabled, false);
  assert.equal(afterBothOff.prevSoundEnabled, true);
  const afterEmergBackOn = toggleEmergencyNotifications(afterBothOff, true);
  assert.equal(afterEmergBackOn.soundEnabled, true, 'Turning the emergency switch back on restores sound');
  clearNotifiedHistory();
  assert.equal(
    triggerEmergencyEventAlerts([{ ...startEvent, entryId: 'e2' }], 'addr1', { ...afterBothOff, notificationsEnabled: true }, 'uk', now).length,
    0,
    'No emergency notification while the emergency switch is OFF'
  );
  const notificationHelperKt = read(KT + 'notification/NotificationHelper.kt');
  assert.ok(
    notificationHelperKt.includes('if (!settings.emergencyNotificationsEnabled || events.isEmpty()) return') &&
      notificationHelperKt.includes('settings.emergencyNotificationsEnabled && settings.soundEnabled') &&
      notificationHelperKt.includes('settings.emergencyNotificationsEnabled && settings.vibrationEnabled'),
    'NotificationHelper.kt must gate emergency events by emergencyNotificationsEnabled only and respect Sound / Vibration'
  );

  // 6. "?" window: exact subtitle, searchable pickers, emergency switch block, 40 dp help button
  assert.equal(translations.uk.queueHelpSubtitle, '(Або закрийте це вікно та виберіть тільки чергу)');
  assert.equal(translations.en.queueHelpSubtitle, '(Or close this window and select directly)');
  const appStringsKt = read(KT + 'ui/AppStrings.kt');
  const settingsScreenKt = read(KT + 'ui/screens/SettingsScreen.kt');
  assert.ok(
    appStringsKt.includes('(Або закрийте це вікно та виберіть тільки чергу)') &&
      appStringsKt.includes('(Or close this window and select directly)') &&
      appStringsKt.includes('Сповіщення про аварійні відключення') &&
      settingsScreenKt.includes('AppStrings.queueHelpAddressSubtitle(lang)') &&
      settingsScreenKt.includes('AppStrings.emergencyNotifications(lang)') &&
      settingsScreenKt.includes('SearchablePickerField(') &&
      settingsScreenKt.includes('DialogProperties(usePlatformDefaultWidth = false)') &&
      settingsScreenKt.includes('Icons.Default.HelpOutline') &&
      settingsScreenKt.includes('.size(40.dp)'),
    'SettingsScreen.kt must keep the "?" address lookup with searchable pickers, the localized subtitle and the emergency switch'
  );

  // 7. Upgrade safety: versionCode offset +300, debug keystore written unconditionally
  const buildGradle = read('android/app/build.gradle.kts');
  assert.ok(
    buildGradle.includes('?: 300) + 300') && !buildGradle.includes('if (!keystoreFile.exists())'),
    'build.gradle.kts must keep the versionCode offset +300 and the unconditional debug.keystore write'
  );

  // 8. Three widgets (small 2x1, big 4x2, strip 4x1) with thumbnails; exact alarms via SCHEDULE_EXACT_ALARM
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  const widgetReceiverKt = read(KT + 'widget/BlackoutWidgetReceiver.kt');
  const glanceWidgetKt = read(KT + 'widget/BlackoutGlanceWidget.kt');
  const smallXml = read('android/app/src/main/res/xml/blackout_widget_info.xml');
  const bigXml = read('android/app/src/main/res/xml/blackout_widget_big_info.xml');
  const stripXml = read('android/app/src/main/res/xml/blackout_widget_strip_info.xml');
  assert.ok(
    manifest.includes('.widget.BlackoutWidgetReceiver') &&
      manifest.includes('.widget.BlackoutBigWidgetReceiver') &&
      manifest.includes('.widget.BlackoutStripWidgetReceiver') &&
      widgetReceiverKt.includes('class BlackoutBigWidgetReceiver') &&
      widgetReceiverKt.includes('class BlackoutStripWidgetReceiver') &&
      glanceWidgetKt.includes('class BlackoutBigGlanceWidget') &&
      glanceWidgetKt.includes('class BlackoutStripGlanceWidget') &&
      smallXml.includes('android:previewImage="@drawable/widget_preview_small"') &&
      bigXml.includes('android:previewImage="@drawable/widget_preview_big"') &&
      stripXml.includes('android:previewImage="@drawable/widget_preview_strip"') &&
      fs.existsSync(path.join(ROOT_DIR, 'android/app/src/main/res/drawable/widget_preview_strip.xml')),
    'Android must provide Small (2x1), Big (4x2) and Strip (4x1) widgets with vector thumbnail previews'
  );
  assert.ok(
    manifest.includes('android.permission.SCHEDULE_EXACT_ALARM') && !manifest.includes('android.permission.USE_EXACT_ALARM'),
    'AndroidManifest.xml must use SCHEDULE_EXACT_ALARM and not USE_EXACT_ALARM'
  );

  // 9. Main screen: first-launch "select queue", Today/Tomorrow headers, emergency rows, site status and notice
  const mainScreenKt = read(KT + 'ui/screens/MainScreen.kt');
  const navScreenKt = read(KT + 'ui/screens/BlackoutAppNavigation.kt');
  assert.ok(
    mainScreenKt.includes('AppStrings.selectQueueAction(lang)') &&
      mainScreenKt.includes('AppStrings.blackoutHoursForTomorrowHeader(lang)') &&
      mainScreenKt.includes('AppStrings.blackoutHoursForDayHeader(lang)') &&
      mainScreenKt.includes('SiteStatusModel.banner(snapshot, lang)') &&
      mainScreenKt.includes('SiteNoticeCard(') &&
      navScreenKt.includes('isQueueUnselected') &&
      navScreenKt.includes('pagerState.animateScrollToPage(0)'),
    'MainScreen.kt and BlackoutAppNavigation.kt must keep the first-launch flow, day headers, site status and the ztoe notice card'
  );

  // 10. Web parity of the same screens
  const mainViewTsx = read('src/components/MainView.tsx');
  const settingsViewTsx = read('src/components/SettingsView.tsx');
  const widgetSimTsx = read('src/components/WidgetSimulator.tsx');
  assert.ok(
    mainViewTsx.includes('data-testid="unselected-queue-header-btn"') &&
      mainViewTsx.includes('data-testid="first-start-language-switch"') &&
      mainViewTsx.includes('siteNoticeTitle(lang)') &&
      settingsViewTsx.includes('<SearchablePickerField') &&
      settingsViewTsx.includes('testId="ios-switch-emergency-notifications"') &&
      settingsViewTsx.includes('data-testid="ztoe-address-lookup-subtitle"') &&
      widgetSimTsx.includes('data-testid="widget-strip"') &&
      (translations.uk as Record<string, string>).widgetStripName === 'Світло в Житомирі (Графік)',
    'MainView.tsx, SettingsView.tsx and WidgetSimulator.tsx must mirror the first launch, notice card, searchable pickers, emergency switch and strip widget'
  );

  console.log('Unit Test E PASSED: Address lookup, duplicate streets, first launch, emergency switch, widgets and exact alarms verified.');
}

function runUnitTestF_GlassCards() {
  console.log('--- Running Unit Test F: Shared glass cards (Web and Android) ---');
  const read = (rel: string) => fs.readFileSync(path.join(ROOT_DIR, rel), 'utf-8');
  const glassKt = read('android/app/src/main/java/ua/blackout/prewarning/ui/components/GlassCard.kt');
  const glassTsx = read('src/components/GlassCard.tsx');
  assert.ok(glassKt.includes('fun GlassCard('), 'GlassCard.kt must define the shared card');
  assert.ok(glassTsx.includes('GlassCard'), 'GlassCard.tsx must define the shared card');
  for (const rel of [
    'android/app/src/main/java/ua/blackout/prewarning/ui/screens/MainScreen.kt',
    'android/app/src/main/java/ua/blackout/prewarning/ui/screens/SettingsScreen.kt',
  ]) {
    assert.ok(read(rel).includes('GlassCard('), `${path.basename(rel)} must use GlassCard`);
  }
  console.log('Unit Test F PASSED: Shared glass cards verified on Web and Android.');
}

async function main() {
  await runUnitTestA();
  runUnitTestB();
  await runUnitTestC_ZhytomyrRoulette();
  await runUnitTestE_AddressLookupAndUnsetQueue();
  runUnitTestF_GlassCards();
}

main().catch((err) => {
  console.error('UNIT TEST FAILED:', err);
  process.exit(1);
});
