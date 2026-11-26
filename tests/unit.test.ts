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

  // 11. Verify Build Version 1.4.4, GitHub v1.3.2 KYIV_ZONE Fix & Developer Handover Documentation across project files
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf-8'));
  assert.equal(packageJson.version, '1.4.4', 'package.json version must be 1.4.4');
  const buildGradle = fs.readFileSync(path.join(ROOT_DIR, 'android/app/build.gradle.kts'), 'utf-8');
  assert.ok(buildGradle.includes('"1.4.4"'), 'android/app/build.gradle.kts default versionName must be 1.4.4');
  const aboutScreenKt = fs.readFileSync(
    path.join(ROOT_DIR, 'android/app/src/main/java/ua/blackout/prewarning/ui/screens/AboutScreen.kt'),
    'utf-8'
  );
  assert.ok(aboutScreenKt.includes('"1.4.4"'), 'AboutScreen.kt fallback version must be 1.4.4');
  const aboutViewTsx = fs.readFileSync(path.join(ROOT_DIR, 'src/components/AboutView.tsx'), 'utf-8');
  assert.ok(aboutViewTsx.includes("'1.4.4'"), 'AboutView.tsx fallback version must be 1.4.4');
  const readmeMd = fs.readFileSync(path.join(ROOT_DIR, 'README.md'), 'utf-8');
  assert.ok(readmeMd.includes('(v1.4.4)'), 'README.md must reference v1.4.4');
  assert.ok(
    changelog.includes("## [1.4.4]") && changelog.includes("## [1.4.3]") && changelog.includes("## [1.4.2]") && changelog.includes("## [1.4.1]") && changelog.includes("## [1.4.0]") && changelog.includes("## [1.3.5]") && changelog.includes("## [1.3.4]"),
    'CHANGELOG.md must document v1.4.4, v1.4.3, v1.4.2, v1.4.1, v1.4.0, v1.3.5, and v1.3.4'
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
          (((f.endsWith('.kt') || f.endsWith('.tsx')) &&
            (f.includes('ui/') || f.includes('components/') || f.includes('widget/'))) ||
            // iOS port: SwiftUI screens and the WidgetKit extension follow the same rule.
            (f.endsWith('.swift') && (f.startsWith('ios/App/UI/') || f.startsWith('ios/Widget/'))))
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

async function runUnitTestC_CoreUiAndBuild() {
  console.log('--- Running Unit Test C: Unclear schedule state, main and About links, build signing, parser, notifications, Settings ---');
  const { fetchFullSchedules } = await import('../src/services/ztoeParser');

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


  // 8. Verify UI files: ZTOE schedules bottom link ("Графіки відключень на сайті"), Unclear schedule state, About page links
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
  const aboutScreenKt = fs.readFileSync(
    path.join(ROOT_DIR, 'android/app/src/main/java/ua/blackout/prewarning/ui/screens/AboutScreen.kt'),
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
      // 1.4.0: card and accent colours come from ZtTokens (ZtColors.Card = 0xA3141A29 since the glass look, ZtColors.Accent = 0xFFFF5E3A)
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
      iosHandoverMd.includes('Master Bootstrap Prompt') &&
      iosHandoverMd.includes('Сповіщення про аварійні відключення') &&
      iosHandoverMd.includes('Emergency outage notifications') &&
      iosHandoverMd.includes('parseZtoeSettlementHousesTableHtml') &&
      iosHandoverMd.includes('decodeZtoeHtmlEntities') &&
      iosHandoverMd.includes('prefetchAddressIndexInBackground') &&
      iosHandoverMd.includes('v1.3.4'),
    'IOS_HANDOVER.md must include repository URL, Swift/WidgetKit architecture, Master Bootstrap Prompt, and all v1.3.4 changes done today'
  );

  console.log('Unit Test C PASSED: unclear schedule state, main and About links, build signing, parser, notifications, Settings');
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
    triggerEmergencyEventAlerts,
    clearNotifiedHistory,
  } = await import('../src/services/alertManager');
  const { parseLocalDateTime } = await import('../src/core/localTime');
  const { SubscriptionSync } = await import('../src/services/subscriptionSync');
  const { SubscriptionRepository } = await import('../src/services/subscriptionStore');
  const { createMemoryStorage } = await import('../src/services/storage');
  const { setEmergency: setSubscriptionEmergency, setPlanned: setSubscriptionPlanned } = await import('../src/core/subscriptions');

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

  // 5. Alert switches (multi-address step 2): per-address "Аварійні" ON by default; the master switch is a
  //    kill switch for planned AND emergency alerts (owner decision 1, spec/SUBSCRIPTIONS.md section 7);
  //    sound / vibration are remembered when everything goes off and restored when alerts come back
  assert.equal(translations.uk.settingsEmergencyOutages, 'Сповіщення про аварійні відключення');
  assert.equal(translations.en.settingsEmergencyOutages, 'Emergency outage notifications');
  assert.equal(DEFAULT_SETTINGS.emergencyNotificationsEnabled, true, 'Emergency alerts must be ON by default');
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
  const subSync = new SubscriptionSync(new SubscriptionRepository(createMemoryStorage(), () => 1, () => 'abcd1234'));
  assert.equal(subSync.ensureReady(initial).items[0].emergencyAlerts, true, 'A migrated address keeps emergency alerts ON');
  const afterMasterOff = subSync.setMaster(initial, false);
  assert.equal(afterMasterOff.notificationsEnabled, false);
  assert.equal(afterMasterOff.emergencyNotificationsEnabled, false, 'The master switch must turn emergency alerts off too (owner decision 1)');
  assert.equal(afterMasterOff.soundEnabled, false);
  assert.equal(afterMasterOff.prevSoundEnabled, true);
  assert.equal(afterMasterOff.alertsMaster, false);

  const now = parseLocalDateTime('2026-11-13T18:00');
  const startEvent = {
    kind: 'START' as const,
    entryId: 'e1',
    start: parseLocalDateTime('2026-11-13T17:30'),
    eta: parseLocalDateTime('2026-11-13T19:00'),
    upcoming: false,
    earlyEnd: false,
  };
  assert.equal(
    triggerEmergencyEventAlerts([startEvent], 'addr1', afterMasterOff, 'uk', now).length,
    0,
    'No emergency notification while the master switch is OFF'
  );
  const afterMasterOn = subSync.setMaster(afterMasterOff, true);
  assert.equal(afterMasterOn.soundEnabled, true, 'Turning the master switch back on restores sound');
  assert.equal(afterMasterOn.vibrationEnabled, false, 'Turning the master switch back on restores vibration as it was (off)');
  // Master off -> saved and reloaded while off -> on: the values from before "off" come back, also when they differ
  {
    const mixed = { ...afterMasterOn, soundEnabled: false, vibrationEnabled: true, prevSoundEnabled: false, prevVibrationEnabled: true };
    const off = subSync.setMaster(mixed, false);
    saveUserSettings(off);
    const reloaded = loadUserSettings();
    assert.equal(reloaded.soundEnabled, false, 'Master off reads sound as off');
    assert.equal(reloaded.vibrationEnabled, false, 'Master off reads vibration as off');
    const on = subSync.setMaster(reloaded, true);
    assert.equal(on.soundEnabled, false, 'Master on restores sound to its value before "off" (off)');
    assert.equal(on.vibrationEnabled, true, 'Master on restores vibration to its value before "off" (on)');
    subSync.setMaster(afterMasterOn, true);
  }
  // Android stores the master before applyMasterSound runs, so "off" must remember the raw keys, not getSettings()
  assert.ok(
    read('android/app/src/main/java/ua/blackout/prewarning/data/repository/SettingsRepository.kt').includes(
      '.putBoolean("prev_sound_enabled", prefs.getBoolean("sound_enabled", true))'
    ),
    'SettingsRepository.applyMasterSound must remember the unmasked sound and vibration values'
  );
  const fired = triggerEmergencyEventAlerts([startEvent], 'addr1', afterMasterOn, 'uk', now);
  assert.equal(fired.length, 1, 'An emergency START notifies while the master and the address switch are ON');
  assert.equal(
    triggerEmergencyEventAlerts([startEvent], 'addr1', afterMasterOn, 'uk', now).length,
    0,
    'The same emergency event must be announced only once'
  );
  const primaryId = subSync.store(afterMasterOn).primaryId as string;
  const afterAddressEmergencyOff = subSync.change(afterMasterOn, (st) => setSubscriptionEmergency(st, primaryId, false)).settings;
  assert.equal(afterAddressEmergencyOff.emergencyNotificationsEnabled, false);
  assert.equal(afterAddressEmergencyOff.notificationsEnabled, true, 'The address switch for emergencies leaves planned alerts on');
  assert.equal(afterAddressEmergencyOff.soundEnabled, true, 'Sound stays on while planned alerts are on');
  clearNotifiedHistory();
  assert.equal(
    triggerEmergencyEventAlerts([{ ...startEvent, entryId: 'e2' }], 'addr1', afterAddressEmergencyOff, 'uk', now).length,
    0,
    'No emergency notification while the address switch for emergencies is OFF'
  );
  // Since multi-address step 3 sound and vibration follow the master only: both switches of the primary off keep them
  const afterAddressBothOff = subSync.change(afterAddressEmergencyOff, (st) => setSubscriptionPlanned(st, primaryId, false)).settings;
  assert.equal(afterAddressBothOff.notificationsEnabled, false);
  assert.equal(afterAddressBothOff.soundEnabled, true, 'Item switches never mute sound (spec/SUBSCRIPTIONS.md section 7)');
  // ... and saving / reading the settings masks sound with the master, not with the two mirrored booleans (step 4 fix)
  saveUserSettings(afterAddressBothOff);
  assert.equal(loadUserSettings().soundEnabled, true, 'A saved primary with both switches off keeps sound for the other addresses');
  saveUserSettings({ ...afterAddressBothOff, alertsMaster: false });
  assert.equal(loadUserSettings().soundEnabled, false, 'Master off reads sound as off');
  resetAllAppDataToFirstLaunch();
  assert.ok(
    read(KT + 'data/repository/SettingsRepository.kt').includes('if (prefs.contains(SubscriptionRepository.KEY_MASTER)) {'),
    'SettingsRepository.kt must mask sound and vibration with the stored master switch'
  );
  const notificationHelperKt = read(KT + 'notification/NotificationHelper.kt');
  assert.ok(
    notificationHelperKt.includes('enabled: Boolean = settings.emergencyNotificationsEnabled') &&
      notificationHelperKt.includes('if (!enabled || events.isEmpty()) return') &&
      notificationHelperKt.includes('if (!master && !isTest) return') &&
      notificationHelperKt.includes('val activeSound = master && settings.soundEnabled') &&
      notificationHelperKt.includes('val activeVibe = master && settings.vibrationEnabled'),
    'NotificationHelper.kt must gate emergency events by the master and the address switch and respect Sound / Vibration'
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
      settingsScreenKt.includes('MyAddressesCard(') &&
      settingsScreenKt.includes('AppStrings.emergencyShort(lang)') &&
      settingsScreenKt.includes('AppStrings.masterHint(lang)') &&
      settingsScreenKt.includes('SearchablePickerField(') &&
      settingsScreenKt.includes('DialogProperties(usePlatformDefaultWidth = false)') &&
      settingsScreenKt.includes('Icons.Default.HelpOutline') &&
      settingsScreenKt.includes('.size(40.dp)'),
    'SettingsScreen.kt must keep the "?" address lookup with searchable pickers, the localized subtitle, the "Мої адреси" card with per-address emergency switches and the master switch'
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
  // Fourth widget: 2x2 minimal (queue of the primary address, status, countdown, refresh; 50 % transparent)
  const minimalXml = read('android/app/src/main/res/xml/blackout_widget_minimal_info.xml');
  const minimalKt = read(KT + 'widget/BlackoutMinimalGlanceWidget.kt');
  assert.ok(
    manifest.includes('.widget.BlackoutMinimalWidgetReceiver') &&
      widgetReceiverKt.includes('class BlackoutMinimalWidgetReceiver') &&
      minimalKt.includes('class BlackoutMinimalGlanceWidget') &&
      minimalKt.includes('Color(0x80141A29)') &&
      minimalKt.includes('widgetSource(appContext, null)') &&
      !minimalXml.includes('android:configure') &&
      minimalXml.includes('android:previewImage="@drawable/widget_preview_minimal"') &&
      fs.existsSync(path.join(ROOT_DIR, 'android/app/src/main/res/drawable/widget_preview_minimal.xml')) &&
      read(KT + 'widget/WidgetBindings.kt').includes('BlackoutMinimalWidgetReceiver::class.java') &&
      glanceWidgetKt.includes('BlackoutMinimalGlanceWidget().update('),
    'Android must provide the Minimal (2x2) widget: primary address only, 50 % transparent, redrawn with the others'
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
      navScreenKt.includes('pagerState.animateScrollToPage(0, animationSpec = PageGlide)'),
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
      settingsViewTsx.includes('data-testid="my-addresses-card"') &&
      settingsViewTsx.includes('testId={`ios-switch-emergency-${item.id}`}') &&
      settingsViewTsx.includes('data-testid="ztoe-address-lookup-subtitle"') &&
      widgetSimTsx.includes('data-testid="widget-strip"') &&
      widgetSimTsx.includes('data-testid="widget-minimal"') &&
      (translations.uk as Record<string, string>).widgetMinimalName === 'Світло в Житомирі (Мінімальний)' &&
      (translations.uk as Record<string, string>).widgetStripName === 'Світло в Житомирі (Графік)',
    'MainView.tsx, SettingsView.tsx and WidgetSimulator.tsx must mirror the first launch, notice card, searchable pickers, the "Мої адреси" card with per-address emergency switches and strip widget'
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

function runUnitTestG_IosPort() {
  console.log('--- Running Unit Test G: iOS port (synced copies, invariants, no roulette) ---');
  const read = (rel: string) => fs.readFileSync(path.join(ROOT_DIR, rel), 'utf-8');

  // valid-urls.json and donations.json: the root file is canonical; public/, Android assets and iOS
  // resources are byte-identical copies (CLAUDE.md "Synced / generated files").
  for (const name of ['valid-urls.json', 'donations.json']) {
    const canonical = read(name);
    for (const dir of ['public', 'android/app/src/main/assets', 'ios/Resources']) {
      assert.equal(read(`${dir}/${name}`), canonical, `${dir}/${name} must be identical to /${name}`);
    }
  }

  // Invariants shared with Android and web.
  const infoPlist = read('ios/App/Info.plist');
  // The iPhone home screen fits about 11 characters, so the icon shows the short name chosen by the owner
  // (2026-11-15); the bundle name, the App Store listing and the widget gallery keep the full name.
  assert.ok(
    infoPlist.includes('<key>CFBundleDisplayName</key>\n\t<string>Світло</string>'),
    'iOS CFBundleDisplayName (home-screen name) must be "Світло"'
  );
  assert.ok(
    infoPlist.includes('<key>CFBundleName</key>\n\t<string>Світло в Житомирі</string>'),
    'iOS CFBundleName must be "Світло в Житомирі"'
  );
  assert.ok(infoPlist.includes('$(MARKETING_VERSION)'), 'iOS Info.plist must take the version from MARKETING_VERSION');
  assert.ok(!infoPlist.includes('<string>processing</string>'), 'iOS must not declare the unused processing background mode');
  const stringsSwift = read('ios/Shared/AppStrings.swift');
  assert.ok(stringsSwift.includes('"Світло в Житомирі"'), 'AppStrings.swift must carry the app name');
  assert.ok(stringsSwift.includes('"СВІТЛО Є"') && stringsSwift.includes('"СВІТЛА НЕМАЄ"'), 'iOS widget labels');
  assert.ok(stringsSwift.includes('"Зрозуміло"'), 'iOS queue help button');

  // iOS marketing version follows the Android versionName.
  const gradle = read('android/app/build.gradle.kts');
  const versionName = (gradle.match(/versionName\s*=\s*(?:\w+\s*\?:\s*)?"([^"]+)"/) || [])[1];
  const projectYml = read('ios/project.yml');
  assert.ok(versionName, 'versionName not found in build.gradle.kts');
  assert.ok(projectYml.includes(`MARKETING_VERSION: "${versionName}"`), `ios/project.yml MARKETING_VERSION must be ${versionName}`);

  // iPhone only (plan R10): XcodeGen's iOS target preset sets TARGETED_DEVICE_FAMILY "1,2" per target, which
  // overrides the project-level value, so the app and the widget targets must each set "1" themselves.
  for (const target of ['ZTPreBlackout', 'BlackoutWidgetExtension']) {
    const start = projectYml.indexOf(`\n  ${target}:`);
    assert.ok(start >= 0, `ios/project.yml target ${target} not found`);
    const next = projectYml.slice(start + 1).search(/\n {2}\S/);
    const block = next < 0 ? projectYml.slice(start) : projectYml.slice(start, start + 1 + next);
    assert.ok(/TARGETED_DEVICE_FAMILY:\s*"1"/.test(block), `ios/project.yml target ${target} must set TARGETED_DEVICE_FAMILY "1" (iPhone only)`);
  }

  // Owner decision D3 (docs/ios/IOS_PORT_PLAN.md): no roulette mini-game in the iOS app.
  const walk = (dir: string): string[] =>
    fs.readdirSync(path.join(ROOT_DIR, dir), { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]
    );
  for (const rel of walk('ios').filter((f) => /\.(swift|plist|yml)$/.test(f))) {
    assert.ok(!/roulette/i.test(read(rel)), `${rel} must not contain the roulette (iOS v1 ships without it)`);
  }
  // Owner, 2026-11-18: the roulette is gone from Android and the web too (code, strings, music, sounds, images).
  const appSources = [
    ...walk('android/app/src/main').filter((f) => /\.(kt|xml)$/.test(f)),
    ...walk('src').filter((f) => /\.(tsx?|css)$/.test(f) && !f.endsWith('src/data/androidProjectFiles.ts')),
  ];
  for (const rel of appSources) {
    assert.ok(!/roulette|рулетк/i.test(read(rel)), `${rel} must not contain the roulette (removed 2026-11-18)`);
  }
  const walkIfExists = (dir: string): string[] => (fs.existsSync(path.join(ROOT_DIR, dir)) ? walk(dir) : []);
  const leftoverAssets = [
    ...walkIfExists('android/app/src/main/res').filter((f) => /\/raw\/|ticket_foil/.test(f)),
    ...walkIfExists('public/assets').filter((f) => /\.mp3$/.test(f)),
    ...walkIfExists('src/assets').filter((f) => /ticket_foil|roulette/.test(f)),
  ];
  assert.deepEqual(leftoverAssets, [], 'the roulette music, sounds and ticket images must be deleted');

  // One source of strings (plan section 7): ios/Shared/AppStrings.swift is generated from AppStrings.kt,
  // and the hand-ported functions carry every Kotlin literal. Run `node scripts/ios-strings.cjs` to update.
  try {
    execSync('node scripts/ios-strings.cjs --check', { cwd: ROOT_DIR, encoding: 'utf-8', stdio: 'pipe' });
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string };
    assert.fail(`iOS strings out of sync with AppStrings.kt:\n${e.stderr || e.stdout || err}`);
  }
  console.log('Unit Test G PASSED: iOS copies, invariants and scope verified.');
}

async function main() {
  await runUnitTestA();
  runUnitTestB();
  await runUnitTestC_CoreUiAndBuild();
  await runUnitTestE_AddressLookupAndUnsetQueue();
  runUnitTestF_GlassCards();
  runUnitTestG_IosPort();
}

main().catch((err) => {
  console.error('UNIT TEST FAILED:', err);
  process.exit(1);
});
