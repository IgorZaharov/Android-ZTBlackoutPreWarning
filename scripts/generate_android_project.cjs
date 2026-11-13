const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const androidDir = path.join(__dirname, '../android');
const tsFilePath = path.join(__dirname, '../src/data/androidProjectFiles.ts');

// Read existing metadata from src/data/androidProjectFiles.ts and sync content FROM /android (source of truth)
const existingTs = fs.readFileSync(tsFilePath, 'utf8');
const entryRegex = /\{\s*path:\s*'([^']+)',\s*language:\s*'([^']+)',\s*description:\s*'([^']+)',\s*content:\s*`([\s\S]*?)`\s*\}/g;

let match;
const entries = [];
while ((match = entryRegex.exec(existingTs)) !== null) {
  const relPath = match[1];
  const language = match[2];
  const description = match[3];
  const diskPath = path.join(androidDir, relPath);

  if (fs.existsSync(diskPath)) {
    const diskContent = fs.readFileSync(diskPath, 'utf8');
    entries.push({ path: relPath, language, description, content: diskContent });
    console.log(`Synced from /android: ${relPath}`);
  } else {
    const fallbackContent = match[4].replace(/\\\$/g, '$').replace(/\\`/g, '`');
    fs.mkdirSync(path.dirname(diskPath), { recursive: true });
    fs.writeFileSync(diskPath, fallbackContent, 'utf8');
    entries.push({ path: relPath, language, description, content: fallbackContent });
    console.log(`Created missing file in /android: ${relPath}`);
  }
}

const additionalFiles = [
  {
    path: 'app/src/main/java/ua/blackout/prewarning/core/Subscriptions.kt',
    language: 'kotlin',
    description: 'Multi-address subscriptions: model, repair, store operations and migration (spec/SUBSCRIPTIONS.md)',
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/data/repository/SubscriptionRepository.kt',
    language: 'kotlin',
    description: 'Stores the multi-address subscriptions and the alerts master switch in the user settings',
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/data/repository/SubscriptionSync.kt',
    language: 'kotlin',
    description: 'Changes the subscription store and mirrors the primary address into the single-address settings',
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/ui/screens/AboutScreen.kt',
    language: 'kotlin',
    description: 'About screen with app version, developer links, donations, and disclaimer',
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/ui/screens/BlackoutAppNavigation.kt',
    language: 'kotlin',
    description: 'Main navigation pager with time-of-day dynamic background and top scrim',
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/ui/screens/ZhytomyrRouletteScreen.kt',
    language: 'kotlin',
    description: 'Zhytomyr Roulette mini-game dialog screen',
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/ui/components/FloatingShadow.kt',
    language: 'kotlin',
    description: 'Custom drop-shadow extension modifier with Gaussian BlurMaskFilter',
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/data/parser/ZtoeAddressLookup.kt',
    language: 'kotlin',
    description: 'ZTOE Address Queue Lookup & Emergency Outage Parser',
  },
  {
    path: 'app/src/main/res/xml/blackout_widget_big_info.xml',
    language: 'xml',
    description: 'Big (4x2) Home Screen AppWidget Provider Metadata',
  },
  {
    path: 'app/src/main/res/drawable/widget_preview_small.xml',
    language: 'xml',
    description: 'Small (2x1) Widget Picker Thumbnail Vector Drawable',
  },
  {
    path: 'app/src/main/res/drawable/widget_preview_big.xml',
    language: 'xml',
    description: 'Big (4x2) Widget Picker Thumbnail Vector Drawable',
  },
];

for (const extra of additionalFiles) {
  const extraDiskPath = path.join(androidDir, extra.path);
  if (fs.existsSync(extraDiskPath) && !entries.some((e) => e.path === extra.path)) {
    entries.push({
      path: extra.path,
      language: extra.language,
      description: extra.description,
      content: fs.readFileSync(extraDiskPath, 'utf8'),
    });
    console.log(`Added new file from /android: ${extra.path}`);
  }
}


if (entries.length > 0) {
  const escapeTemplateLiteral = (str) =>
    str.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

  const tsOut = `/**
 * Complete Native Android (Kotlin + Jetpack Compose) Source Files
 * Ready for direct commit to https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning
 */

export interface AndroidFile {
  path: string;
  language: string;
  description: string;
  content: string;
}

export const ANDROID_PROJECT_FILES: AndroidFile[] = [
${entries
  .map(
    (e) => `  {
    path: '${e.path}',
    language: '${e.language}',
    description: '${e.description.replace(/'/g, "\\'")}',
    content: \`${escapeTemplateLiteral(e.content)}\`
  }`
  )
  .join(',\n')}
];
`;
  fs.writeFileSync(tsFilePath, tsOut, 'utf8');
  console.log(`Updated src/data/androidProjectFiles.ts with ${entries.length} authentic files from /android.`);
}

// Copy .github into android/ as well so if someone pushes android/ alone, GitHub Actions is present
const workflowSrc = path.join(__dirname, '../.github');
const workflowDest = path.join(androidDir, '.github');
if (fs.existsSync(workflowSrc)) {
  fs.cpSync(workflowSrc, workflowDest, { recursive: true });
}

// Generate the zip file using python3 zipfile
const publicDir = path.join(__dirname, '../public');
fs.mkdirSync(publicDir, { recursive: true });

try {
  execSync(`python3 -c "
import shutil
shutil.make_archive('${publicDir}/Android-ZTBlackoutPreWarning', 'zip', '${androidDir}')
"`, { stdio: 'inherit' });
  console.log('Successfully generated /public/Android-ZTBlackoutPreWarning.zip');
} catch (e) {
  console.error('Failed to create zip:', e);
}
