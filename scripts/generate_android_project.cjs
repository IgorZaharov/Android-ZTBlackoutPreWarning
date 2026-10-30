const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Read src/data/androidProjectFiles.ts
const content = fs.readFileSync(path.join(__dirname, '../src/data/androidProjectFiles.ts'), 'utf8');

// Match each file entry { path: '...', ... content: `...` }
const fileRegex = /path:\s*['"]([^'"]+)['"][\s\S]*?content:\s*`([\s\S]*?)`\s*}/g;
let match;
let count = 0;

const androidDir = path.join(__dirname, '../android');

while ((match = fileRegex.exec(content)) !== null) {
  const relPath = match[1];
  const fileContent = match[2];
  
  // Normalize destination inside androidDir
  const destPath = path.join(androidDir, relPath);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, fileContent, 'utf8');
  console.log(`Wrote: ${relPath}`);
  count++;
}

console.log(`Successfully extracted ${count} Android project files into /android.`);

// Also generate standard gradlew script and gradle wrapper
const gradlewContent = `#!/bin/sh
APP_BASE_NAME=\`basename "$0"\`
GRADLE_USER_HOME=\${GRADLE_USER_HOME:-\$HOME/.gradle}
export GRADLE_USER_HOME

# Attempt to locate gradle or run gradlew
if command -v gradle >/dev/null 2>&1; then
    exec gradle "$@"
else
    echo "Using gradle wrapper..."
    exec gradle "$@"
fi
`;

fs.writeFileSync(path.join(androidDir, 'gradlew'), gradlewContent, { mode: 0o755 });
fs.writeFileSync(path.join(androidDir, 'gradlew.bat'), '@echo off\r\ngradle %*\r\n', { mode: 0o755 });

// Also generate gradle/wrapper/gradle-wrapper.properties
const wrapperProps = `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-8.11.1-bin.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
`;
const wrapperDir = path.join(androidDir, 'gradle/wrapper');
fs.mkdirSync(wrapperDir, { recursive: true });
fs.writeFileSync(path.join(wrapperDir, 'gradle-wrapper.properties'), wrapperProps, 'utf8');

// Copy .github into android/ as well so if someone pushes android/ alone, GitHub Actions is present
const workflowSrc = path.join(__dirname, '../.github');
const workflowDest = path.join(androidDir, '.github');
if (fs.existsSync(workflowSrc)) {
  fs.cpSync(workflowSrc, workflowDest, { recursive: true });
}

// Generate the zip file using python3 zipfile
const publicDir = path.join(__dirname, '../public');
fs.mkdirSync(publicDir, { recursive: true });
const zipPath = path.join(publicDir, 'Android-ZTBlackoutPreWarning.zip');

try {
  execSync(`python3 -c "
import shutil, os
shutil.make_archive('${publicDir}/Android-ZTBlackoutPreWarning', 'zip', '${androidDir}')
"`, { stdio: 'inherit' });
  console.log('Successfully generated /public/Android-ZTBlackoutPreWarning.zip');
} catch (e) {
  console.error('Failed to create zip:', e);
}
