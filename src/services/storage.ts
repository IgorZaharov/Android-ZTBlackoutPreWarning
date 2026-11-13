/**
 * Tiny storage seam shared by the web ports of the Android stores (ScheduleRepository cache,
 * OutageStateStore). Android keeps these in named SharedPreferences files; the web keeps each one
 * as a single JSON object under one localStorage key, with the same logical key names
 * (spec/PERSISTENCE.md), so the layouts stay comparable and "clear all" is one removeItem.
 *
 * Every read and write is wrapped: a private window, blocked site data or a full quota must never
 * break the app (the in-memory fallback keeps the session working).
 */
import { fromInstant, type LocalDateTime } from '../core/localTime';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function createMemoryStorage(): KeyValueStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

let fallbackStorage: KeyValueStorage | null = null;

/** window.localStorage when it works, a process-wide in-memory store otherwise (SSR, tests, blocked storage). */
export function defaultStorage(): KeyValueStorage {
  try {
    if (typeof localStorage !== 'undefined') {
      const probe = '__zt_probe__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return localStorage;
    }
  } catch {
    // fall through to memory
  }
  return (fallbackStorage ??= createMemoryStorage());
}

type Primitive = string | number | boolean;

/** SharedPreferences-like view over one JSON object stored under [storageKey]. */
export class JsonPrefs {
  constructor(
    private readonly storage: KeyValueStorage,
    private readonly storageKey: string
  ) {}

  private read(): Record<string, Primitive> {
    try {
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) return {};
      const parsed: unknown = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, Primitive>) : {};
    } catch {
      return {};
    }
  }

  private write(data: Record<string, Primitive>): void {
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(data));
    } catch {
      // quota or blocked storage: ignore, data stays valid for the next refresh
    }
  }

  getString(key: string): string | null {
    const v = this.read()[key];
    return typeof v === 'string' ? v : null;
  }

  getLong(key: string, fallback = 0): number {
    const v = this.read()[key];
    return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  }

  getBoolean(key: string, fallback = false): boolean {
    const v = this.read()[key];
    return typeof v === 'boolean' ? v : fallback;
  }

  contains(key: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.read(), key);
  }

  /** One read-modify-write, like SharedPreferences.Editor.apply(). `undefined` removes a key. */
  edit(changes: Record<string, Primitive | undefined>): void {
    const data = this.read();
    for (const [k, v] of Object.entries(changes)) {
      if (v === undefined) delete data[k];
      else data[k] = v;
    }
    this.write(data);
  }

  clear(): void {
    try {
      this.storage.removeItem(this.storageKey);
    } catch {
      // ignore
    }
  }
}

/** Kyiv wall clock for an instant (defaults to the real now); the only place the web layer reads the system clock. */
export function kyivNow(date: Date = new Date()): LocalDateTime {
  return fromInstant(date.getTime());
}
