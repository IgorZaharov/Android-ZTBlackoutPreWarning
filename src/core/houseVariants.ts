/**
 * A house listed in several ztoe rows (households / non-household, sometimes two queues of one type).
 * Specified in `spec/ADDRESS_KEY.md` section 6, golden cases in `spec/vectors/house_variants.json`.
 * Mirrors `core/HouseVariants.kt` and `ios/Shared/Core/HouseVariants.swift`.
 */
import { TextNorm } from './addressKeys';

export const ConsumerType = {
  HOUSEHOLD: 'household',
  BUSINESS: 'business',

  /** `household`, `business` or `''` when the text names no consumer type. A type code maps to itself. */
  of(raw: string | null | undefined): string {
    if (!raw || !raw.trim()) return '';
    const s = TextNorm.decodeEntities(raw).trim().toLowerCase();
    if (s === 'household' || s === 'business') return s;
    if (s.includes('непобут') || s.includes('юридич')) return 'business';
    if (s.includes('побут')) return 'household';
    return '';
  },
} as const;

/** One queue (or one status without a queue) of a house, with the consumer types the site lists it for. */
export interface HouseVariant {
  queue: string;
  statusText: string | null;
  consumers: string[];
}

const nonBlank = (s: string | null | undefined): string | null => (s && s.trim() ? s : null);

export const HouseVariants = {
  /** Folds one table row into `variants`: same non-empty queue = same variant; all status rows = one variant. */
  add(variants: readonly HouseVariant[], queue: string, statusText: string | null | undefined, consumerRaw: string | null | undefined): HouseVariant[] {
    const type = ConsumerType.of(consumerRaw);
    const q = (queue ?? '').trim();
    const idx = variants.findIndex((v) => (q ? v.queue === q : v.queue === ''));
    if (idx < 0) {
      return [...variants, { queue: q, statusText: q ? null : nonBlank(statusText), consumers: type ? [type] : [] }];
    }
    const existing = variants[idx];
    const merged: HouseVariant = {
      queue: existing.queue,
      statusText: existing.statusText ?? (q ? null : nonBlank(statusText)),
      consumers: !type || existing.consumers.includes(type) ? existing.consumers : [...existing.consumers, type],
    };
    const out = [...variants];
    out[idx] = merged;
    return out;
  },

  /** Unites two variant lists (the rows of `b` come after those of `a`). */
  union(a: readonly HouseVariant[], b: readonly HouseVariant[]): HouseVariant[] {
    let out: HouseVariant[] = [...a];
    for (const v of b) {
      if (v.consumers.length === 0) out = HouseVariants.add(out, v.queue, v.statusText, null);
      else for (const c of v.consumers) out = HouseVariants.add(out, v.queue, v.statusText, c);
    }
    return out;
  },

  /** Households first, then a queue before no queue, otherwise discovery order. */
  ordered(variants: readonly HouseVariant[]): HouseVariant[] {
    const rank = (v: HouseVariant) => (v.consumers.includes('household') ? 0 : 2) + (v.queue ? 0 : 1);
    return variants
      .map((v, i) => ({ v, i }))
      .sort((x, y) => rank(x.v) - rank(y.v) || x.i - y.i)
      .map((x) => x.v);
  },

  /**
   * The variant to apply (spec/ADDRESS_KEY.md section 6, rule 5). `preferredQueue` null: the first. Otherwise the
   * variant with that queue (`''` = the one without a queue) while it still lists one of `preferredConsumers` (or
   * none were given); else the first variant that lists one of them; else the first.
   */
  pick(
    variants: readonly HouseVariant[],
    preferredQueue: string | null | undefined,
    preferredConsumers: readonly string[] = []
  ): HouseVariant | null {
    const list = HouseVariants.ordered(variants);
    if (preferredQueue !== null && preferredQueue !== undefined) {
      const p = preferredQueue.trim();
      const sharesType = (v: HouseVariant) => preferredConsumers.length === 0 || v.consumers.some((c) => preferredConsumers.includes(c));
      const hit = list.find((v) => v.queue === p && sharesType(v));
      if (hit) return hit;
      if (preferredConsumers.length > 0) {
        const byType = list.find((v) => v.consumers.some((c) => preferredConsumers.includes(c)));
        if (byType) return byType;
      }
    }
    return list[0] ?? null;
  },
};
