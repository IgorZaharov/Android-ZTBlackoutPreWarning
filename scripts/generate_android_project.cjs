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

const addressLookupRelPath = 'app/src/main/java/ua/blackout/prewarning/data/parser/ZtoeAddressLookup.kt';
const addressLookupDiskPath = path.join(androidDir, addressLookupRelPath);
if (fs.existsSync(addressLookupDiskPath) && !entries.some((e) => e.path === addressLookupRelPath)) {
  entries.push({
    path: addressLookupRelPath,
    language: 'kotlin',
    description: 'ZTOE Address Queue Lookup & Emergency Outage Parser',
    content: fs.readFileSync(addressLookupDiskPath, 'utf8'),
  });
  console.log(`Added new file from /android: ${addressLookupRelPath}`);
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
