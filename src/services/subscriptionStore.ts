/**
 * Web port of android/.../data/repository/SubscriptionRepository.kt (spec/SUBSCRIPTIONS.md): the
 * multi-address store as JSON under KEY_STORE and the kill switch under KEY_MASTER. The rules live in
 * src/core/subscriptions.ts; this class only encodes, reads and writes.
 *
 * Step 1 of the feature: nothing calls this at runtime yet. The Settings UI (step 2) runs
 * ensureMigrated on start and then treats the store as the source of truth.
 */
import {
  EMPTY_STORE,
  fromMap,
  isValidId,
  migrate,
  repair,
  toMap,
  type LegacySettings,
  type RepairResult,
  type StoreResult,
  type SubscriptionStore,
} from '../core/subscriptions';
import { defaultStorage, type KeyValueStorage } from './storage';

export const KEY_STORE = 'zt_subscriptions_v1';
export const KEY_MASTER = 'alerts_master_enabled';

const ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** 8 random characters from [a-z0-9]. */
export function randomId(): string {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ID_CHARS[b % ID_CHARS.length]).join('');
}

export const encode = (store: SubscriptionStore): string => JSON.stringify(toMap(store));

/** Returns null for missing, unreadable or non-version-1 text ("absent"). */
export function decode(text: string | null): SubscriptionStore | null {
  if (text === null || text.trim().length === 0) return null;
  try {
    return fromMap(JSON.parse(text));
  } catch {
    return null;
  }
}

export class SubscriptionRepository {
  constructor(
    private readonly storage: KeyValueStorage = defaultStorage(),
    private readonly clock: () => number = Date.now,
    private readonly random: () => string = randomId,
  ) {}

  private get(key: string): string | null {
    try {
      return this.storage.getItem(key);
    } catch {
      return null;
    }
  }

  private set(key: string, value: string): void {
    try {
      this.storage.setItem(key, value);
    } catch {
      // quota or blocked storage: the session keeps working, the next start migrates again
    }
  }

  /** The repaired store, or null when it has never been written (or is unreadable): then migrate. */
  read(): RepairResult | null {
    const s = decode(this.get(KEY_STORE));
    return s === null ? null : repair(s);
  }

  store(): SubscriptionStore {
    return this.read()?.store ?? EMPTY_STORE;
  }

  alertsMaster(): boolean {
    return this.get(KEY_MASTER) !== 'false';
  }

  setAlertsMaster(on: boolean): void {
    this.set(KEY_MASTER, String(on));
  }

  /** Runs the one-time migration when the store is absent; legacy is only evaluated then. */
  ensureMigrated(legacy: () => LegacySettings): SubscriptionStore {
    const current = this.read();
    if (current !== null) return current.store;
    const result = migrate(legacy(), this.random(), this.clock());
    this.set(KEY_STORE, encode(result.store));
    this.set(KEY_MASTER, String(result.alertsMaster));
    return result.store;
  }

  /** Read-modify-write; writes only when op succeeds. */
  mutate(op: (store: SubscriptionStore) => StoreResult): StoreResult {
    const result = op(this.store());
    if (result.ok) this.set(KEY_STORE, encode(result.store));
    return result;
  }

  /** A fresh id that no current item uses. */
  newItemId(): string {
    const used = new Set(this.store().items.map((s) => s.id));
    for (;;) {
      const id = this.random();
      if (!used.has(id) && isValidId(id)) return id;
    }
  }
}
