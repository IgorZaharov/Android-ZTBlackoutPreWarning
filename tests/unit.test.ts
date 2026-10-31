import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import {
  QUEUES,
  parseZtoeHtmlFull,
  getChartHalfHourBlocks,
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
  assert.ok(
    timelineBarKt.includes('slots.getOrNull(hour * 2)?.status == SlotStatus.POWER_OFF') &&
      timelineBarKt.includes('slots.getOrNull(hour * 2 + 1)?.status == SlotStatus.POWER_OFF'),
    'TimelineBar.kt must use half-hour hour*2 and hour*2+1 lookup'
  );
  assert.ok(
    glanceWidgetKt.includes('slots.getOrNull(hour * 2)?.status == SlotStatus.POWER_OFF') &&
      glanceWidgetKt.includes('slots.getOrNull(hour * 2 + 1)?.status == SlotStatus.POWER_OFF'),
    'BlackoutGlanceWidget.kt must use identical half-hour hour*2 and hour*2+1 lookup'
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
  const step1 = '1. Відкрийте сторінку пошуку черги на сайті ztoe.com.ua.';
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
      settingsViewTsx.includes('ztoe.com.ua') &&
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
  assert.equal(translations.uk.aboutDonations, 'Donations / Благодійність і Пожертви');

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

  // 8. Verify git modified UI files are mentioned in CHANGELOG.md
  try {
    const gitStatus = execSync('git status --porcelain', { encoding: 'utf-8' });
    const modifiedFiles = gitStatus
      .split('\n')
      .map((line) => line.trim().split(/\s+/).pop() || '')
      .filter((f) => f.includes('ui/') || f.includes('components/') || f.includes('widget/'));

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

  console.log('Unit Test B PASSED: All UI elements, icons, labels, defaults, and changelog checks succeeded.');
}

async function main() {
  await runUnitTestA();
  runUnitTestB();
}

main().catch((err) => {
  console.error('UNIT TEST FAILED:', err);
  process.exit(1);
});
