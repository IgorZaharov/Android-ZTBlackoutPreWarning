/**
 * The queue variant the user applied from the address lookup for a house the site lists more than once
 * (spec/ADDRESS_KEY.md section 6, rule 5); mirrors android data/repository/HouseVariantChoices.kt. Re-checks
 * of the address prefer it; without a stored choice the default (households first) applies, so addresses
 * saved before 1.4.1 move to the households' queue. Keyed by street id and HouseKey.
 */
import { HouseKey } from '../core/addressKeys';
import type { HouseVariant } from '../core/houseVariants';

const STORAGE_KEY = 'house_variant_choice';

type Stored = Record<string, { queue: string; consumers: string[] }>;

const keyOf = (streetId: string, house: string) => `${streetId}|${HouseKey.of(house)}`;

function readAll(): Stored {
  try {
    if (typeof localStorage === 'undefined') return {};
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Stored) : {};
  } catch {
    return {};
  }
}

export function getHouseVariantChoice(streetId: string | undefined, house: string | undefined): HouseVariant | null {
  if (!streetId || !house || !HouseKey.of(house)) return null;
  const v = readAll()[keyOf(streetId, house)];
  return v ? { queue: v.queue, statusText: null, consumers: Array.isArray(v.consumers) ? v.consumers : [] } : null;
}

/** `variant` null forgets the choice (the house has a single queue). */
export function setHouseVariantChoice(streetId: string, house: string, variant: HouseVariant | null): void {
  if (!streetId || !HouseKey.of(house)) return;
  try {
    if (typeof localStorage === 'undefined') return;
    const all = readAll();
    if (variant) all[keyOf(streetId, house)] = { queue: variant.queue, consumers: variant.consumers };
    else delete all[keyOf(streetId, house)];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // storage full or blocked: the default variant applies
  }
}
