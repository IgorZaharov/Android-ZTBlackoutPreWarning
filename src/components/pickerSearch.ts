/**
 * Pure matching used by the searchable address picker, ported 1:1 from
 * android/.../ui/components/PickerSearch.kt (cases in tests/picker-search.test.ts mirror PickerSearchTest.kt).
 *
 * Matching is case-, apostrophe-, diacritic- and prefix-insensitive:
 *  - apostrophes of every kind are dropped on both sides (via StreetKey);
 *  - Latin and Cyrillic look-alike letters share one skeleton letter, so a Latin "16a" finds the Cyrillic "16А";
 *  - combining marks are stripped, so "ї" matches "і" and "й" matches "и";
 *  - a leading type word ("вул.", "пров.", "м.", "с.", "смт") is optional on both sides.
 *
 * Results are ranked: prefix first, then a match at the start of any word, then a plain substring. Inside
 * one rank the original order of the list is kept; houses put shorter keys first.
 */
import { HouseKey, StreetKey, TextNorm } from '../core/addressKeys';

export const NO_MATCH = -1;
export const PREFIX = 0;
export const WORD_PREFIX = 1;
export const CONTAINS = 2;

export type SearchKind = 'TEXT' | 'HOUSE';

/** Normalized form of one label or query: `full` with the type word, `core` without it. */
export interface SearchKey {
  readonly full: string;
  readonly core: string;
  readonly kind: SearchKind;
}

const MARKS = /\p{Mn}+/gu;
const SEPARATORS = /[-/,()"]/g;

/** Type words that may open a street or settlement name, folded exactly like the labels are. */
const PREFIX_WORDS = [
  'вул', 'вулиця', 'пров', 'провулок', 'просп', 'проспект', 'пр-т', 'пр-к', 'б-р', 'бульвар', 'бульв', 'бул',
  'пл', 'площа', 'пр-д', 'проїзд', 'узв', 'узвіз', 'туп', 'тупик', 'наб', 'набережна', 'шосе', 'майдан', 'м-н',
  'м', 'с', 'смт', 'сел', 'селище', 'місто', 'село', 'район', 'р-н',
];

const fold = (raw: string): string => raw.normalize('NFD').replace(MARKS, '');
const foldWord = (word: string): string => TextNorm.skeleton(fold(word).toLowerCase());
const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let leadingType: RegExp | null = null;
function leadingTypeRegex(): RegExp {
  if (leadingType === null) {
    const alternatives = Array.from(new Set(PREFIX_WORDS.map(foldWord)))
      .sort((a, b) => b.length - a.length)
      .map(escapeRegex)
      .join('|');
    leadingType = new RegExp(`^(?:${alternatives})(?:\\.\\s*|\\s+)`, 'u');
  }
  return leadingType;
}

export function keyOf(raw: string, kind: SearchKind = 'TEXT'): SearchKey {
  if (kind === 'HOUSE') {
    const k = HouseKey.of(fold(raw));
    return { full: k, core: k, kind };
  }
  const full = StreetKey.of(fold(raw));
  let core = full;
  // two passes so "м. вул. X" style double prefixes lose both words; never strip down to nothing
  for (let pass = 0; pass < 2; pass++) {
    const stripped = core.replace(leadingTypeRegex(), '');
    if (stripped.length > 0 && stripped !== core) core = stripped;
  }
  return { full, core, kind };
}

const isEmpty = (k: SearchKey): boolean => k.full.length === 0;
const wordForm = (core: string): string => ' ' + core.replace(SEPARATORS, ' ');

/** Rank of `candidate` for `query`. An empty query matches everything as PREFIX. */
export function rankKeys(query: SearchKey, candidate: SearchKey): number {
  if (isEmpty(query)) return PREFIX;
  if (isEmpty(candidate)) return NO_MATCH;
  if (candidate.full.startsWith(query.full)) return PREFIX;
  if (candidate.core.startsWith(query.core)) {
    // "вул ш" ranks "вул. Шевченка" above "пров. Шевченка"; plain "ш" treats the type word as absent
    return query.core === query.full || query.kind === 'HOUSE' ? PREFIX : WORD_PREFIX;
  }
  if (query.kind === 'TEXT' && wordForm(candidate.core).includes(wordForm(query.core))) return WORD_PREFIX;
  if (candidate.core.includes(query.core) || candidate.full.includes(query.full)) return CONTAINS;
  return NO_MATCH;
}

export function rank(query: string, label: string, kind: SearchKind = 'TEXT'): number {
  return rankKeys(keyOf(query, kind), keyOf(label, kind));
}

/** Keys are computed once per list (966 streets), then every keystroke only compares strings. */
export class PickerIndex<T> {
  private readonly keys: SearchKey[];

  constructor(
    private readonly items: readonly T[],
    private readonly kind: SearchKind,
    label: (item: T) => string
  ) {
    this.keys = items.map((it) => keyOf(label(it), kind));
  }

  search(query: string): T[] {
    const q = keyOf(query, this.kind);
    if (isEmpty(q)) return [...this.items];
    const hits: { index: number; rank: number; length: number }[] = [];
    for (let i = 0; i < this.items.length; i++) {
      const r = rankKeys(q, this.keys[i]);
      if (r !== NO_MATCH) hits.push({ index: i, rank: r, length: this.keys[i].core.length });
    }
    hits.sort(
      this.kind === 'HOUSE'
        ? (a, b) => a.rank - b.rank || a.length - b.length || a.index - b.index
        : (a, b) => a.rank - b.rank || a.index - b.index
    );
    return hits.map((h) => this.items[h.index]);
  }
}

export function filterItems<T>(items: readonly T[], query: string, kind: SearchKind, label: (item: T) => string): T[] {
  return new PickerIndex(items, kind, label).search(query);
}
