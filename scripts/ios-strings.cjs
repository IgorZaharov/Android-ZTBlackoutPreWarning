#!/usr/bin/env node
// One source of UI strings for Android and iOS (docs/ios/IOS_PORT_PLAN.md section 7).
//
// android/.../ui/AppStrings.kt is the source. This script writes ios/Shared/AppStrings.swift from it:
// every one-expression string function (`fun x(lang: String) = if (lang == "uk") "..." else "..."`,
// a plain literal, or a literal with `$name` / `${expr}` templates) and every `const val` becomes the
// same Swift function or constant. Functions with a code body (lists, `when`, several statements) are
// ported by hand inside the MANUAL block of the Swift file, which this script keeps as it is; for those
// it checks that every string literal of the Kotlin body is also in the Swift file.
//
//   node scripts/ios-strings.cjs           rewrite ios/Shared/AppStrings.swift
//   node scripts/ios-strings.cjs --check   fail when the Swift file is stale or a hand port drifted (npm test)
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const KT = path.join(ROOT, 'android/app/src/main/java/ua/blackout/prewarning/ui/AppStrings.kt');
const SWIFT = path.join(ROOT, 'ios/Shared/AppStrings.swift');

const MANUAL_BEGIN = '    // BEGIN MANUAL';
const MANUAL_END = '    // END MANUAL';

/** Android-only strings (plan section 2): the iOS app has no screen that shows them. */
const ANDROID_ONLY = [
  /^roulette/, // owner decision D3: no mini-game on iOS
  /^formatRoulette/,
  /^exactAlarm/, // no exact-alarm permission on iOS
  /^refreshFloorHint$/, // iOS text: refreshFloorHintIos
  /^vibration$/, // no vibration control for iOS notifications
  /^soundVibrationHint$/, // iOS text: soundHintIos
  /^aboutDesktopNotice$/, // iOS text: aboutDesktopNoticeIos
];

const isAndroidOnly = (name) => ANDROID_ONLY.some((re) => re.test(name));

/** Splits AppStrings.kt into declarations (`fun` / `const val`), each with its full text. */
function declarations(src) {
  const lines = src.split(/\r?\n/);
  const out = [];
  const start = /^    (private )?(const val|fun) /;
  for (let i = 0; i < lines.length; i++) {
    if (!start.test(lines[i])) continue;
    const body = [lines[i]];
    let depth = braceDelta(lines[i]);
    let j = i + 1;
    // a declaration goes on while braces are open or the next line is indented deeper (continuation)
    while (j < lines.length && (depth > 0 || /^ {8,}\S/.test(lines[j]))) {
      body.push(lines[j]);
      depth += braceDelta(lines[j]);
      j++;
    }
    const text = body.join('\n');
    const m = text.match(/^    (?:private )?(?:const val|fun) (\w+)/);
    out.push({ name: m[1], text, isConst: /const val/.test(lines[i]), isPrivate: /^    private /.test(lines[i]) });
    i = j - 1;
  }
  return out;
}

/** Brace balance of a Kotlin line, ignoring braces inside string literals and `${...}` templates. */
function braceDelta(line) {
  let d = 0;
  let inStr = false;
  for (let k = 0; k < line.length; k++) {
    const c = line[k];
    if (inStr) {
      if (c === '\\') k++;
      else if (c === '"') inStr = false;
      else if (c === '$' && line[k + 1] === '{') {
        const close = line.indexOf('}', k);
        k = close < 0 ? line.length : close;
      }
    } else if (c === '"') inStr = true;
    else if (c === '/' && line[k + 1] === '/') break;
    else if (c === '{') d++;
    else if (c === '}') d--;
  }
  return d;
}

const STR = '"(?:[^"\\\\$]|\\\\.|\\$\\{[^}]*\\}|\\$\\w+|\\$)*"';

/** All string literals of a Kotlin text, in order. */
function literals(text) {
  return [...text.matchAll(new RegExp(STR, 'g'))].map((m) => m[0]);
}

/** Kotlin string literal -> Swift string literal (`$x` / `${x}` -> `\(x)`, non-ASCII spaces escaped). */
function swiftLiteral(kt) {
  let s = kt.replace(/\$\{([^}]*)\}/g, '\\($1)').replace(/\$([A-Za-z_]\w*)/g, '\\($1)');
  s = s.replace(/ /g, '\\u{00A0}');
  return s;
}

/** Kotlin parameter list -> Swift (all unlabeled, Long -> Int, `null` -> `nil`). */
function swiftParams(kt) {
  if (!kt.trim()) return '';
  return kt
    .split(',')
    .map((p) => p.trim())
    .map((p) => {
      const m = p.match(/^(\w+)\s*:\s*([\w?<>]+)(?:\s*=\s*(.+))?$/);
      if (!m) throw new Error(`unsupported parameter: ${p}`);
      const type = m[2].replace(/^Long/, 'Int');
      const def = m[3] === undefined ? '' : ` = ${m[3] === 'null' ? 'nil' : m[3]}`;
      return `_ ${m[1]}: ${type}${def}`;
    })
    .join(', ');
}

/** Swift line for a one-expression string function, or null when it needs a hand port. */
function generated(decl) {
  if (decl.isConst) {
    const m = decl.text.match(/const val (\w+) = (.+)$/s);
    const value = m[2].trim();
    if (!new RegExp(`^${STR}$`).test(value)) return null;
    const vis = decl.isPrivate ? 'private' : 'public';
    return `    ${vis} static let ${m[1]} = ${swiftLiteral(value)}`;
  }
  const m = decl.text.match(/^    fun (\w+)\(([^)]*)\)\s*=\s*([\s\S]+)$/);
  if (!m) return null;
  const expr = m[3].replace(/\s*\n\s*/g, ' ').trim();
  const ifElse = expr.match(new RegExp(`^if \\(lang == "uk"\\) (${STR}) else (${STR})$`));
  let body;
  if (ifElse) body = `lang == "uk" ? ${swiftLiteral(ifElse[1])} : ${swiftLiteral(ifElse[2])}`;
  else if (new RegExp(`^${STR}$`).test(expr)) body = swiftLiteral(expr);
  else return null;
  return `    public static func ${m[1]}(${swiftParams(m[2])}) -> String { ${body} }`;
}

function build(ktSrc, swiftSrc) {
  const decls = declarations(ktSrc).filter((d) => !isAndroidOnly(d.name));
  const gen = [];
  const manual = [];
  for (const d of decls) {
    const line = generated(d);
    if (line) gen.push(line);
    else manual.push(d);
  }
  const b = swiftSrc.indexOf(MANUAL_BEGIN);
  const e = swiftSrc.indexOf(MANUAL_END);
  if (b < 0 || e < b) throw new Error(`${SWIFT} has no ${MANUAL_BEGIN.trim()} ... ${MANUAL_END.trim()} block`);
  const manualBlock = swiftSrc.slice(b, e + MANUAL_END.length);
  const text = [
    '// Generated by scripts/ios-strings.cjs from android/app/src/main/java/ua/blackout/prewarning/ui/AppStrings.kt.',
    '// Do not edit the generated part: change AppStrings.kt and run `node scripts/ios-strings.cjs`.',
    '// Functions with a code body are ported by hand in the MANUAL block below; `npm test` checks them.',
    'import Foundation',
    '',
    'public enum AppStrings {',
    manualBlock,
    '',
    '    // MARK: - Generated',
    '',
    ...gen,
    '}',
    '',
  ].join('\n');
  return { text, manual, manualBlock };
}

/** Problems of the hand ports: a missing function or a Kotlin literal that is not in the Swift block. */
function manualProblems(manual, manualBlock) {
  const problems = [];
  for (const d of manual) {
    if (!new RegExp(`static (func|let|var) ${d.name}\\b`).test(manualBlock)) {
      problems.push(`${d.name}: no hand port in the MANUAL block of AppStrings.swift`);
      continue;
    }
    for (const lit of literals(d.text)) {
      if (lit === '"uk"' || lit === '"en"') continue;
      const swift = swiftLiteral(lit);
      if (!manualBlock.includes(swift)) problems.push(`${d.name}: literal ${swift} is not in the Swift port`);
    }
  }
  return problems;
}

function main() {
  const check = process.argv.includes('--check');
  const ktSrc = fs.readFileSync(KT, 'utf-8');
  const swiftSrc = fs.readFileSync(SWIFT, 'utf-8').replace(/\r\n/g, '\n');
  const { text, manual, manualBlock } = build(ktSrc, swiftSrc);
  const problems = manualProblems(manual, manualBlock);
  if (check) {
    if (text !== swiftSrc) problems.unshift('ios/Shared/AppStrings.swift is stale: run `node scripts/ios-strings.cjs`');
    if (problems.length) {
      console.error(problems.map((p) => `  ${p}`).join('\n'));
      process.exit(1);
    }
    console.log(`iOS strings in sync: ${manual.length} hand ports, ${text.split('\n').filter((l) => l.includes('static func') || l.includes('static let')).length - manual.length} generated`);
    return;
  }
  fs.writeFileSync(SWIFT, text);
  console.log(`wrote ${path.relative(ROOT, SWIFT)}`);
  if (problems.length) {
    console.error(problems.map((p) => `  ${p}`).join('\n'));
    process.exit(1);
  }
}

if (require.main === module) main();
module.exports = { declarations, generated, swiftLiteral, build, manualProblems };
