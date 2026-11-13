/**
 * Canonical keys for matching street and house names across ztoe.com.ua, PowerOn and the device
 * cache, mirrored 1:1 from android/.../core/AddressKeys.kt. Specified in spec/ADDRESS_KEY.md.
 *
 * Java's `\s` is ASCII-only by default, so it is spelled out as JAVA_SPACE here to keep the
 * TypeScript regexes (which use the `u` flag for \p{..}) equivalent.
 */

const JAVA_SPACE = '[ \\t\\n\\x0B\\f\\r]';

const NUMERIC_ENTITY = /&#([xX][0-9a-fA-F]+|[0-9]+);/g;
const NAMED_ENTITY = /&([a-zA-Z]+);/g;
const NAMED: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  rsquo: '’',
  lsquo: '‘',
  ndash: '–',
  mdash: '—',
  laquo: '«',
  raquo: '»',
  hellip: '…',
};

const CONFUSABLE: Readonly<Record<string, string>> = {
  а: 'a',
  в: 'b',
  с: 'c',
  е: 'e',
  н: 'h',
  і: 'i',
  к: 'k',
  м: 'm',
  о: 'o',
  р: 'p',
  т: 't',
  х: 'x',
  у: 'y',
};

function decodeEntities(raw: string): string {
  let s = raw;
  for (let pass = 0; pass < 3; pass++) {
    if (!s.includes('&')) return s;
    const before = s;
    s = s.replace(NUMERIC_ENTITY, (whole, v: string) => {
      const cp = v[0] === 'x' || v[0] === 'X' ? parseInt(v.substring(1), 16) : parseInt(v, 10);
      return Number.isFinite(cp) && cp >= 1 && cp <= 0x10ffff ? String.fromCodePoint(cp) : whole;
    });
    s = s.replace(NAMED_ENTITY, (whole, name: string) => NAMED[name.toLowerCase()] ?? whole);
    if (s === before) return s;
  }
  return s;
}

/**
 * Maps letters that look identical in Latin and Cyrillic to one skeleton letter, so
 * `16A` (Latin) and `16А` (Cyrillic) compare equal. Input must already be lower-case.
 */
function skeleton(lower: string): string {
  let out = '';
  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i];
    out += CONFUSABLE[ch] ?? ch;
  }
  return out;
}

export const TextNorm = {
  /** Decodes numeric and common named entities; repeats so `&amp;#039;` (double escaped) also becomes `'`. */
  decodeEntities,
  skeleton,
  /** All apostrophe-like characters seen in street names. */
  APOSTROPHES: "'’ʼ‘´`ʻ′",
} as const;

const INITIAL_DOT_SPACE = new RegExp(`(?<![\\p{L}\\p{N}])(\\p{L})\\.${JAVA_SPACE}+(?=\\p{L})`, 'gu');
const SPACES = /[ \t\n\x0B\f\r ​]+/g;

const TYPES: Readonly<Record<string, string>> = {
  вулиця: 'вул',
  вул: 'вул',
  провулок: 'пров',
  пров: 'пров',
  'пр-к': 'пров',
  проспект: 'просп',
  просп: 'просп',
  'пр-т': 'просп',
  бульвар: 'б-р',
  бульв: 'б-р',
  бул: 'б-р',
  'б-р': 'б-р',
  площа: 'пл',
  пл: 'пл',
  проїзд: 'пр-д',
  'пр-д': 'пр-д',
  узвіз: 'узв',
  узв: 'узв',
  тупик: 'туп',
  туп: 'туп',
  набережна: 'наб',
  наб: 'наб',
  шосе: 'шосе',
  майдан: 'майдан',
  'м-н': 'майдан',
};

const hasOwn = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

export const StreetKey = {
  /** True for a street-type word of the table above (`вул.`, `Провулок`, `б-р` …), compared lower-case without trailing dots. */
  isTypeWord(token: string): boolean {
    return hasOwn(TYPES, token.toLowerCase().replace(/\.+$/, ''));
  },
  /** Stable comparison key. See spec/ADDRESS_KEY.md for the step list. */
  of(raw: string): string {
    let s = decodeEntities(raw).toLowerCase();
    s = Array.from(s)
      .filter((ch) => TextNorm.APOSTROPHES.indexOf(ch) < 0)
      .join('');
    s = s.replace(SPACES, ' ').trim();
    s = s.replace(INITIAL_DOT_SPACE, (_whole, letter: string) => `${letter}.`);
    const tokens = s
      .split(' ')
      .filter((t) => t.length > 0)
      .map((token) => {
        const bare = token.replace(/\.+$/, '');
        return hasOwn(TYPES, bare) ? TYPES[bare] : token;
      });
    return skeleton(tokens.join(' '));
  },
} as const;

// "будинок" must come before "буд\.?", otherwise the shorter alternative eats its first letters
const PREFIX = new RegExp(`^(?:будинок|буд\\.?|№)${JAVA_SPACE}*`, 'u');
const JUNK = new RegExp(`(?:${JAVA_SPACE}|['"«»’ʼ\`.])+`, 'gu');
const HYPHEN_BEFORE_LETTER = /(?<=\p{N})-(?=\p{L})/gu;

function houseOf(raw: string): string {
  let s = decodeEntities(raw).toLowerCase().trim();
  s = s.replace(PREFIX, '');
  s = s.replace(JUNK, '');
  s = s.replace(HYPHEN_BEFORE_LETTER, '');
  return skeleton(s);
}

/** PowerOn `buildingNames` is a comma separated list ("1, 10, 43А, 51а, 14/а"). */
function tokens(buildingNames: string): string[] {
  return buildingNames
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

export const HouseKey = {
  /** `34-А`, `34 А`, `34А` and `34A` (Latin) share one key; `14/а` keeps its slash. */
  of: houseOf,
  tokens,
  listContains(buildingNames: string, house: string): boolean {
    const target = houseOf(house);
    if (target.length === 0) return false;
    return tokens(buildingNames).some((t) => houseOf(t) === target);
  },
} as const;
