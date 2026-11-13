/**
 * Multi-address subscriptions: the stored model, its repair rules, the store operations, the
 * migration from single-address settings, the primary mirror and the alert grouping. Mirrors android/.../core/Subscriptions.kt; specified in
 * spec/SUBSCRIPTIONS.md, golden cases in spec/vectors/subscriptions.json.
 *
 * The model is exchanged as plain objects (toMap / fromMap); the platform encodes them as a string.
 */
import { HouseKey, StreetKey, TextNorm } from './addressKeys';
import { formatLocalDateTime, type LocalDateTime } from './localTime';
import type { AlertSpec } from './outageModels';

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

/** Moves the item to `toIndex` (clamped); the primary and the fields stay unchanged (spec section 4). */
export function move(store: SubscriptionStore, id: string, toIndex: number): StoreResult {
  const from = store.items.findIndex((s) => s.id === id);
  if (from < 0) return fail(ERR_NOT_FOUND);
  const to = Math.max(0, Math.min(store.items.length - 1, toIndex));
  const items = [...store.items];
  const [moved] = items.splice(from, 1);
  items.splice(to, 0, moved);
  return ok({ ...store, items });
}

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

// -------------------------------------------------------------------------------------------------
// Alerts for every item (section 8)
// -------------------------------------------------------------------------------------------------

/** One planned pre-warning shared by every item on one queue with the same span (spec/SUBSCRIPTIONS.md 8.1). */
export interface PlannedGroup {
  readonly key: string;
  readonly queue: string;
  readonly fireAt: LocalDateTime;
  readonly spanStart: LocalDateTime;
  readonly spanEnd: LocalDateTime;
  readonly mayContinue: boolean;
  readonly durationMinutes: number;
  readonly memberIds: readonly string[];
}

/** The primary first, then the other items by createdAtMs, list order on ties. */
export function alertOrder(store: SubscriptionStore): Subscription[] {
  const primary = primaryOf(store);
  const rest = store.items
    .map((item, index) => ({ item, index }))
    .filter((e) => e.item.id !== primary?.id)
    .sort((a, b) => a.item.createdAtMs - b.item.createdAtMs || a.index - b.index)
    .map((e) => e.item);
  return primary ? [primary, ...rest] : rest;
}

/** One planned alert per (queue, span start, span end) over every plannedActive item (8.1). */
export function groupAlerts(
  store: SubscriptionStore,
  master: boolean,
  alertsById: Readonly<Record<string, readonly AlertSpec[] | undefined>>,
): PlannedGroup[] {
  const groups = new Map<string, { queue: string; first: AlertSpec; mayContinue: boolean; members: string[] }>();
  for (const item of alertOrder(store)) {
    if (!plannedActive(master, item) || item.queue === null) continue;
    const alerts = Object.prototype.hasOwnProperty.call(alertsById, item.id) ? alertsById[item.id] : undefined;
    if (!alerts) continue;
    for (const a of alerts) {
      const key = `planned_q${item.queue}_${formatLocalDateTime(a.spanStart)}_${formatLocalDateTime(a.spanEnd)}`;
      let g = groups.get(key);
      if (!g) {
        g = { queue: item.queue, first: a, mayContinue: false, members: [] };
        groups.set(key, g);
      }
      g.mayContinue = g.mayContinue || a.mayContinue;
      if (!g.members.includes(item.id)) g.members.push(item.id);
    }
  }
  const out: PlannedGroup[] = [...groups.entries()].map(([key, g]) => ({
    key,
    queue: g.queue,
    fireAt: g.first.fireAt,
    spanStart: g.first.spanStart,
    spanEnd: g.first.spanEnd,
    mayContinue: g.mayContinue,
    durationMinutes: g.first.durationMinutes,
    memberIds: g.members,
  }));
  return out.sort((a, b) => a.fireAt - b.fireAt || a.spanStart - b.spanStart || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/** Fired-registry key of one item for one span (8.2). */
export const memberKey = (id: string, spanStart: LocalDateTime): string => `planned_${id}_${formatLocalDateTime(spanStart)}`;

/** The address-independent key 1.4.0 recorded; it counts for every item. */
export const legacyAlertKey = (spanStart: LocalDateTime): string => `planned_${formatLocalDateTime(spanStart)}`;

export function pendingMembers(group: PlannedGroup, notified: (key: string) => boolean): string[] {
  const legacy = notified(legacyAlertKey(group.spanStart));
  return group.memberIds.filter((id) => !legacy && !notified(memberKey(id, group.spanStart)));
}

/** Labels that open the planned text, or null when the store has at most one item (8.3). */
export function alertLabels(store: SubscriptionStore, memberIds: readonly string[]): string | null {
  if (store.items.length <= 1 || memberIds.length === 0) return null;
  const labels = memberIds
    .map((id) => store.items.find((i) => i.id === id))
    .filter((i): i is Subscription => i !== undefined)
    .map(displayLabel);
  if (labels.length === 0) return null;
  const head = labels.slice(0, 2).join(' · ');
  return labels.length > 2 ? `${head} +${labels.length - 2}` : head;
}

// --- Main screen (section 9) ---------------------------------------------------------------------

/** The chips of the address switcher: every item in list order, or none with fewer than 2 items. */
export function switcherItems(store: SubscriptionStore): Subscription[] {
  return store.items.length >= 2 ? [...store.items] : [];
}

/** The item the main screen shows: the selected one if it still exists, else the primary. */
export function viewItem(store: SubscriptionStore, selectedId: string | null): Subscription | null {
  return store.items.find((i) => i.id === selectedId) ?? store.items.find((i) => i.id === store.primaryId) ?? null;
}

/** The master is on but no item has a switch on: "on" would silently mean nothing. */
export function noAlertsCaption(master: boolean, store: SubscriptionStore): boolean {
  return master && store.items.length > 0 && !anyAlertsEnabled(master, store);
}

// -------------------------------------------------------------------------------------------------
// Widgets (spec/SUBSCRIPTIONS.md section 10)
// -------------------------------------------------------------------------------------------------

/** The item a widget shows: its bound item if it still exists, else the primary (null = follow primary). */
export function widgetItem(store: SubscriptionStore, boundId: string | null): Subscription | null {
  return viewItem(store, boundId);
}

/**
 * The address label a widget prints: always with two or more items; with one item only when the bound
 * item was removed, so the fall back to the primary is visible.
 */
export function widgetLabel(store: SubscriptionStore, boundId: string | null): string | null {
  const item = widgetItem(store, boundId);
  if (item === null) return null;
  const removed = boundId !== null && !store.items.some((i) => i.id === boundId);
  return store.items.length >= 2 || removed ? displayLabel(item) : null;
}

/** The distinct items the placed widgets show, in order of first appearance (redraw alarms, polling). */
export function widgetItemIds(store: SubscriptionStore, boundIds: (string | null)[]): string[] {
  const out: string[] = [];
  for (const b of boundIds) {
    const id = widgetItem(store, b)?.id;
    if (id !== undefined && !out.includes(id)) out.push(id);
  }
  return out;
}
