/**
 * Multi-address subscriptions, step 1: the stored model, its repair rules, the store operations and
 * the migration from single-address settings. Mirrors android/.../core/Subscriptions.kt; specified in
 * spec/SUBSCRIPTIONS.md, golden cases in spec/vectors/subscriptions.json.
 *
 * The model is exchanged as plain objects (toMap / fromMap); the platform encodes them as a string.
 */
import { HouseKey, StreetKey, TextNorm } from './addressKeys';

export type QueueSource = 'LOOKUP' | 'MANUAL';

export interface SubscriptionAddress {
  remSlug: string;
  settlementId: string;
  streetId: string;
  /** Display name resolved from streetId when the address was stored; may be empty. */
  streetName: string;
  house: string;
  /** Full human readable line (1.4.0 `selected_address`); may be empty. */
  text: string;
}

export interface Subscription {
  id: string;
  /** Cleaned user label; empty = automatic (see displayLabel). */
  label: string;
  address: SubscriptionAddress | null;
  queue: string | null;
  queueSource: QueueSource;
  queueStatusText: string | null;
  plannedAlerts: boolean;
  emergencyAlerts: boolean;
  createdAtMs: number;
}

export interface SubscriptionStore {
  primaryId: string | null;
  items: Subscription[];
}

/** 1.4.0 single-address settings, plus the street name the platform resolved for streetId. */
export interface LegacySettings {
  queue: string;
  customQueueStatusText: string | null;
  selectedAddress: string | null;
  remSlug: string;
  settlementId: string;
  streetId: string;
  streetName: string | null;
  house: string;
  notificationsEnabled: boolean;
  emergencyNotificationsEnabled: boolean;
}

export interface MigrationResult {
  store: SubscriptionStore;
  alertsMaster: boolean;
}

export interface DroppedItem {
  id: string | null;
  reason: string;
}

export interface RepairResult {
  store: SubscriptionStore;
  dropped: DroppedItem[];
}

export type StoreResult =
  | { ok: true; store: SubscriptionStore }
  | { ok: false; code: string; existingId: string | null };

export const SCHEMA_VERSION = 1;
export const MAX_ITEMS = 5;
export const MAX_LABEL_LENGTH = 40;

export const ERR_INVALID = 'invalid';
export const ERR_DUPLICATE_ID = 'duplicate_id';
export const ERR_DUPLICATE = 'duplicate';
export const ERR_LIMIT = 'limit_reached';
export const ERR_NOT_FOUND = 'not_found';

export const EMPTY_STORE: SubscriptionStore = Object.freeze({ primaryId: null, items: [] }) as SubscriptionStore;

const ID = /^[a-z0-9]{4,32}$/;
const QUEUE = /^[1-6]\.[12]$/;
const SPACES = /[ \t\n\x0B\f\r ​]+/g;

export const isValidId = (id: unknown): id is string => typeof id === 'string' && ID.test(id);
export const isValidQueue = (q: unknown): q is string => typeof q === 'string' && QUEUE.test(q);

const collapse = (raw: string): string => raw.replace(SPACES, ' ').replace(/^ +| +$/g, '');
const isBlank = (s: string): boolean => s.trim().length === 0;

export function isValidAddress(a: SubscriptionAddress): boolean {
  return !isBlank(a.remSlug) && !isBlank(a.settlementId) && !isBlank(a.streetId) && !isBlank(a.house);
}

/** The 1.4.0 address key of ledger_*, repair_*, ids_* and emergency alert keys. */
export function addressKey(a: SubscriptionAddress): string {
  return `${a.settlementId}|${StreetKey.of(isBlank(a.streetName) ? a.streetId : a.streetName)}|${HouseKey.of(a.house)}`;
}

/** `a:<address key>` or `q:<queue>`; two items with one identity are duplicates. */
export const identity = (item: Subscription): string =>
  item.address ? `a:${addressKey(item.address)}` : `q:${item.queue ?? ''}`;

export function makeSubscription(id: string, fields: Partial<Omit<Subscription, 'id'>> = {}): Subscription {
  return {
    id,
    label: '',
    address: null,
    queue: null,
    queueSource: 'MANUAL',
    queueStatusText: null,
    plannedAlerts: true,
    emergencyAlerts: true,
    createdAtMs: 0,
    ...fields,
  };
}

// -------------------------------------------------------------------------------------------------
// Labels
// -------------------------------------------------------------------------------------------------

export function cleanLabel(raw: string | null | undefined): string {
  const s = collapse(raw ?? '');
  if (s.length <= MAX_LABEL_LENGTH) return s;
  let end = MAX_LABEL_LENGTH;
  const c = s.charCodeAt(end - 1);
  if (c >= 0xd800 && c <= 0xdbff) end--;
  return s.substring(0, end);
}

export function defaultLabel(item: Subscription): string {
  const a = item.address;
  if (!a) return `Черга ${item.queue ?? ''}`;
  const house = collapse(a.house);
  const street = collapse(TextNorm.decodeEntities(a.streetName));
  if (street.length === 0) return `буд. ${house}`;
  const tokens = street.split(' ');
  const core = tokens.length > 1 && StreetKey.isTypeWord(tokens[0]) ? tokens.slice(1) : tokens;
  return `${core.join(' ')} ${house}`;
}

export const displayLabel = (item: Subscription): string => (item.label.length > 0 ? item.label : defaultLabel(item));

// -------------------------------------------------------------------------------------------------
// Maps
// -------------------------------------------------------------------------------------------------

export function itemToMap(item: Subscription): Record<string, unknown> {
  return {
    id: item.id,
    label: item.label,
    address: item.address
      ? {
          remSlug: item.address.remSlug,
          settlementId: item.address.settlementId,
          streetId: item.address.streetId,
          streetName: item.address.streetName,
          house: item.address.house,
          text: item.address.text,
        }
      : null,
    queue: item.queue,
    queueSource: item.queueSource,
    queueStatusText: item.queueStatusText,
    plannedAlerts: item.plannedAlerts,
    emergencyAlerts: item.emergencyAlerts,
    createdAtMs: item.createdAtMs,
  };
}

export function toMap(store: SubscriptionStore): Record<string, unknown> {
  return { schemaVersion: SCHEMA_VERSION, primaryId: store.primaryId, items: store.items.map(itemToMap) };
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const bool = (v: unknown, dflt: boolean): boolean => (typeof v === 'boolean' ? v : dflt);

export function itemFromMap(m: Obj): Subscription {
  const a = isObj(m.address) ? m.address : null;
  return {
    id: str(m.id) ?? '',
    label: str(m.label) ?? '',
    address: a
      ? {
          remSlug: str(a.remSlug) ?? '',
          settlementId: str(a.settlementId) ?? '',
          streetId: str(a.streetId) ?? '',
          streetName: str(a.streetName) ?? '',
          house: str(a.house) ?? '',
          text: str(a.text) ?? '',
        }
      : null,
    queue: str(m.queue),
    queueSource: m.queueSource === 'LOOKUP' ? 'LOOKUP' : 'MANUAL',
    queueStatusText: str(m.queueStatusText),
    plannedAlerts: bool(m.plannedAlerts, true),
    emergencyAlerts: bool(m.emergencyAlerts, true),
    createdAtMs: typeof m.createdAtMs === 'number' && Number.isFinite(m.createdAtMs) ? Math.trunc(m.createdAtMs) : 0,
  };
}

/**
 * Lenient read: wrong types read as missing, nothing throws. Returns null ("absent") when the value
 * is not a version-1 store, so the caller migrates again from the legacy keys. Call repair on the
 * result before use.
 */
export function fromMap(map: unknown): SubscriptionStore | null {
  if (!isObj(map)) return null;
  if (typeof map.schemaVersion !== 'number' || Math.trunc(map.schemaVersion) !== SCHEMA_VERSION) return null;
  const raw = Array.isArray(map.items) ? map.items : [];
  return { primaryId: str(map.primaryId), items: raw.filter(isObj).map(itemFromMap) };
}

// -------------------------------------------------------------------------------------------------
// Repair
// -------------------------------------------------------------------------------------------------

/** Repair step 2: invalid queue or address -> null, label cleaned. */
export function normalize(item: Subscription): Subscription {
  return {
    ...item,
    label: cleanLabel(item.label),
    address: item.address && isValidAddress(item.address) ? item.address : null,
    queue: isValidQueue(item.queue) ? item.queue : null,
  };
}

export function repair(store: SubscriptionStore): RepairResult {
  const dropped: DroppedItem[] = [];
  const keep = (list: Subscription[], test: (s: Subscription) => boolean, reason: string): Subscription[] =>
    list.filter((s) => {
      const ok = test(s);
      if (!ok) dropped.push({ id: s.id, reason });
      return ok;
    });
  let items = keep(store.items, (s) => isValidId(s.id), 'invalid_id');
  items = items.map(normalize);
  items = keep(items, (s) => s.address !== null || s.queue !== null, 'empty');
  const ids = new Set<string>();
  items = keep(items, (s) => !ids.has(s.id) && ids.add(s.id) !== undefined, 'duplicate_id');
  const identities = new Set<string>();
  items = keep(items, (s) => {
    const k = identity(s);
    if (identities.has(k)) return false;
    identities.add(k);
    return true;
  }, 'duplicate_address');
  if (items.length > MAX_ITEMS) {
    for (const s of items.slice(MAX_ITEMS)) dropped.push({ id: s.id, reason: 'over_limit' });
    items = items.slice(0, MAX_ITEMS);
  }
  const primaryId =
    store.primaryId !== null && items.some((s) => s.id === store.primaryId) ? store.primaryId : items[0]?.id ?? null;
  return { store: { primaryId, items }, dropped };
}

// -------------------------------------------------------------------------------------------------
// Operations
// -------------------------------------------------------------------------------------------------

const fail = (code: string, existingId: string | null = null): StoreResult => ({ ok: false, code, existingId });
const ok = (store: SubscriptionStore): StoreResult => ({ ok: true, store });

export function add(store: SubscriptionStore, candidate: Subscription): StoreResult {
  if (!isValidId(candidate.id)) return fail(ERR_INVALID);
  const item = normalize(candidate);
  if (item.address === null && item.queue === null) return fail(ERR_INVALID);
  if (store.items.some((s) => s.id === item.id)) return fail(ERR_DUPLICATE_ID);
  const key = identity(item);
  const dup = store.items.find((s) => identity(s) === key);
  if (dup) return fail(ERR_DUPLICATE, dup.id);
  if (store.items.length >= MAX_ITEMS) return fail(ERR_LIMIT);
  return ok({ primaryId: store.primaryId ?? item.id, items: [...store.items, item] });
}

export function remove(store: SubscriptionStore, id: string): StoreResult {
  if (!store.items.some((s) => s.id === id)) return fail(ERR_NOT_FOUND);
  const rest = store.items.filter((s) => s.id !== id);
  let primaryId: string | null;
  if (store.primaryId !== id && rest.some((s) => s.id === store.primaryId)) {
    primaryId = store.primaryId;
  } else {
    // strict < keeps the first of equal values, which is the list-order tie rule
    let best: Subscription | null = null;
    for (const s of rest) if (best === null || s.createdAtMs < best.createdAtMs) best = s;
    primaryId = best?.id ?? null;
  }
  return ok({ primaryId, items: rest });
}

/** Result of a ZTOE lookup for an address item (spec/SUBSCRIPTIONS.md section 4). */
export function setQueueInfo(
  store: SubscriptionStore,
  id: string,
  queue: string | null,
  statusText: string | null,
  addressText: string | null,
): StoreResult {
  const item = store.items.find((s) => s.id === id);
  if (!item) return fail(ERR_NOT_FOUND);
  const address = item.address;
  if (!address) return fail(ERR_INVALID);
  return update(store, id, (s) => ({
    ...s,
    queue: isValidQueue(queue) ? queue : null,
    queueStatusText: statusText !== null && !isBlank(statusText) ? statusText : null,
    address: addressText === null || isBlank(addressText) ? address : { ...address, text: addressText },
  }));
}

function update(store: SubscriptionStore, id: string, change: (s: Subscription) => Subscription): StoreResult {
  if (!store.items.some((s) => s.id === id)) return fail(ERR_NOT_FOUND);
  return ok({ ...store, items: store.items.map((s) => (s.id === id ? change(s) : s)) });
}

export const setPrimary = (store: SubscriptionStore, id: string): StoreResult =>
  store.items.some((s) => s.id === id) ? ok({ ...store, primaryId: id }) : fail(ERR_NOT_FOUND);

export const setPlanned = (store: SubscriptionStore, id: string, on: boolean): StoreResult =>
  update(store, id, (s) => ({ ...s, plannedAlerts: on }));

export const setEmergency = (store: SubscriptionStore, id: string, on: boolean): StoreResult =>
  update(store, id, (s) => ({ ...s, emergencyAlerts: on }));

export const rename = (store: SubscriptionStore, id: string, raw: string | null): StoreResult =>
  update(store, id, (s) => ({ ...s, label: cleanLabel(raw) }));

// -------------------------------------------------------------------------------------------------
// Effective switches
// -------------------------------------------------------------------------------------------------

export const plannedActive = (master: boolean, item: Subscription): boolean =>
  master && item.plannedAlerts && item.queue !== null;

export const emergencyActive = (master: boolean, item: Subscription, poweronIdsKnown: boolean): boolean =>
  master && item.emergencyAlerts && item.address !== null && poweronIdsKnown;

export const anyAlertsEnabled = (master: boolean, store: SubscriptionStore): boolean =>
  master && store.items.some((s) => s.plannedAlerts || s.emergencyAlerts);

// -------------------------------------------------------------------------------------------------
// Mirror of the primary item into the single-address keys (section 7)
// -------------------------------------------------------------------------------------------------

/** Values for the single-address keys, written from the primary item. */
export interface LegacyMirror {
  queue: string;
  customQueueStatusText: string | null;
  selectedAddress: string | null;
  remSlug: string;
  settlementId: string;
  streetId: string;
  house: string;
  notificationsEnabled: boolean;
  emergencyNotificationsEnabled: boolean;
}

export const primaryOf = (store: SubscriptionStore): Subscription | null =>
  store.items.find((s) => s.id === store.primaryId) ?? null;

export function primaryMirror(store: SubscriptionStore, master: boolean): LegacyMirror {
  const p = primaryOf(store);
  const a = p?.address ?? null;
  return {
    queue: p?.queue ?? '',
    customQueueStatusText: p?.queueStatusText ?? null,
    selectedAddress: p && a ? (a.text.length > 0 ? a.text : displayLabel(p)) : null,
    remSlug: a?.remSlug ?? '',
    settlementId: a?.settlementId ?? '',
    streetId: a?.streetId ?? '',
    house: a?.house ?? '',
    notificationsEnabled: master && (p?.plannedAlerts ?? true),
    emergencyNotificationsEnabled: master && (p?.emergencyAlerts ?? true),
  };
}

// -------------------------------------------------------------------------------------------------
// Migration
// -------------------------------------------------------------------------------------------------

export function migrate(legacy: LegacySettings, newId: string, nowMs: number): MigrationResult {
  const queue = isValidQueue(legacy.queue) ? legacy.queue : null;
  const address: SubscriptionAddress = {
    remSlug: legacy.remSlug,
    settlementId: legacy.settlementId,
    streetId: legacy.streetId,
    streetName: legacy.streetName ?? '',
    house: legacy.house,
    text: legacy.selectedAddress ?? '',
  };
  const switches = { plannedAlerts: legacy.notificationsEnabled, emergencyAlerts: legacy.emergencyNotificationsEnabled };
  let item: Subscription | null = null;
  if (isValidAddress(address)) {
    const status = legacy.customQueueStatusText;
    item = makeSubscription(newId, {
      address,
      queue,
      queueSource: 'LOOKUP',
      queueStatusText: status !== null && !isBlank(status) ? status : null,
      createdAtMs: nowMs,
      ...switches,
    });
  } else if (queue !== null) {
    item = makeSubscription(newId, { queue, queueSource: 'MANUAL', createdAtMs: nowMs, ...switches });
  }
  const store: SubscriptionStore = item ? { primaryId: item.id, items: [item] } : { primaryId: null, items: [] };
  return { store, alertsMaster: legacy.notificationsEnabled || legacy.emergencyNotificationsEnabled };
}
