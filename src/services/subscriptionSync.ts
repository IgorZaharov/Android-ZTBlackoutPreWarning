/**
 * Web port of android/.../data/repository/SubscriptionSync.kt (multi-address step 2,
 * spec/SUBSCRIPTIONS.md section 7): the one way to change addresses and alert switches. Every call
 * runs the one-time migration first, changes the subscription store, then returns the UserSettings with
 * the primary item mirrored into the single-address fields that the main view and widgets read (alerts read
 * the store, section 8).
 * Callers save the returned settings.
 */
import {
  ERR_NOT_FOUND,
  add,
  isValidQueue,
  makeSubscription,
  primaryMirror,
  setAddress,
  setQueueInfo,
  type LegacyMirror,
  type LegacySettings,
  type StoreResult,
  type SubscriptionStore,
} from '../core/subscriptions';
import type { SelectedAddressQuery, UserSettings } from '../types';
import { SubscriptionRepository } from './subscriptionStore';
import { getHouseVariantChoice, setHouseVariantChoice } from './houseVariantChoices';
import {
  ZTOE_REM_OPTIONS,
  addressText as buildAddressText,
  checkSavedStreet,
  findStreetById,
  getRems,
  settlementNameFromText,
  type SavedStreet,
} from './ztoeAddressLookup';

const LOST_STORAGE_KEY = 'zt_lost_street_ids';
let lostInMemory: string[] = [];

function readLost(): string[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LOST_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    }
  } catch {
    // storage blocked: memory only
  }
  return lostInMemory;
}

function writeLost(ids: string[]): void {
  lostInMemory = ids;
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(LOST_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // storage blocked: memory only
  }
}

export function resolveStreetName(streetId: string | undefined): string | null {
  if (!streetId) return null;
  try {
    return findStreetById(streetId)?.nameUk ?? null;
  } catch {
    return null;
  }
}

export function legacyFromSettings(s: UserSettings, streetName: string | null): LegacySettings {
  const q = s.selectedAddressQuery;
  return {
    queue: s.queue ?? '',
    customQueueStatusText: s.customQueueStatusText ?? null,
    selectedAddress: s.selectedAddress ?? null,
    remSlug: q?.remId ?? '',
    settlementId: q?.settlementId ?? '',
    streetId: q?.streetId ?? '',
    streetName,
    house: q?.house ?? '',
    notificationsEnabled: s.notificationsEnabled,
    emergencyNotificationsEnabled: s.emergencyNotificationsEnabled ?? true,
  };
}

/**
 * Sound and vibration follow the alerts master switch (spec/SUBSCRIPTIONS.md section 7): off remembers
 * and mutes them, on restores them (as SettingsRepository.applyMasterSound). Only for a real change.
 */
export function applyMasterSound(s: UserSettings, masterOn: boolean): UserSettings {
  if (masterOn) return { ...s, soundEnabled: s.prevSoundEnabled ?? true, vibrationEnabled: s.prevVibrationEnabled ?? true };
  return { ...s, prevSoundEnabled: s.soundEnabled, prevVibrationEnabled: s.vibrationEnabled, soundEnabled: false, vibrationEnabled: false };
}

/**
 * Writes the mirror into the settings (as SettingsRepository.applyPrimaryMirror). Sound and vibration are
 * untouched: they follow the master switch ([applyMasterSound]).
 */
export function applyPrimaryMirror(s: UserSettings, m: LegacyMirror, master: boolean): UserSettings {
  const query: SelectedAddressQuery | undefined =
    m.remSlug && m.settlementId && m.streetId && m.house
      ? { remId: m.remSlug, settlementId: m.settlementId, streetId: m.streetId, house: m.house }
      : undefined;
  return {
    ...s,
    queue: m.queue,
    customQueueStatusText: m.customQueueStatusText ?? undefined,
    selectedAddress: m.selectedAddress ?? undefined,
    selectedAddressQuery: query,
    notificationsEnabled: m.notificationsEnabled,
    emergencyNotificationsEnabled: m.emergencyNotificationsEnabled,
    alertsMaster: master,
  };
}

export interface SyncResult {
  result: StoreResult;
  /** The settings to save: mirrored on success, unchanged on an error. */
  settings: UserSettings;
}

export class SubscriptionSync {
  constructor(private readonly repo: SubscriptionRepository = new SubscriptionRepository()) {}

  ensureReady(settings: UserSettings): SubscriptionStore {
    return this.repo.ensureMigrated(() =>
      legacyFromSettings(settings, resolveStreetName(settings.selectedAddressQuery?.streetId)),
    );
  }

  store(settings: UserSettings): SubscriptionStore {
    this.ensureReady(settings);
    return this.repo.store();
  }

  master(settings: UserSettings): boolean {
    this.ensureReady(settings);
    return this.repo.alertsMaster();
  }

  mirror(settings: UserSettings): UserSettings {
    const master = this.repo.alertsMaster();
    return applyPrimaryMirror(settings, primaryMirror(this.repo.store(), master), master);
  }

  setMaster(settings: UserSettings, on: boolean): UserSettings {
    this.ensureReady(settings);
    const was = this.repo.alertsMaster();
    this.repo.setAlertsMaster(on);
    return this.mirror(was !== on ? applyMasterSound(settings, on) : settings);
  }

  change(settings: UserSettings, op: (store: SubscriptionStore) => StoreResult): SyncResult {
    this.ensureReady(settings);
    const result = this.repo.mutate(op);
    return { result, settings: result.ok ? this.mirror(settings) : settings };
  }

  addFromLookup(
    settings: UserSettings,
    queue: string,
    statusText: string | undefined,
    addressText: string,
    query: SelectedAddressQuery,
  ): SyncResult {
    this.ensureReady(settings);
    const item = makeSubscription(this.repo.newItemId(), {
      address: {
        remSlug: query.remId,
        settlementId: query.settlementId,
        streetId: query.streetId,
        streetName: resolveStreetName(query.streetId) ?? '',
        house: query.house,
        text: addressText,
      },
      queue: isValidQueue(queue) ? queue : null,
      queueSource: 'LOOKUP',
      queueStatusText: statusText && statusText.trim().length > 0 ? statusText : null,
      createdAtMs: Date.now(),
    });
    return this.change(settings, (s) => add(s, item));
  }

  /** The user edited the address of item `id` in Settings (`setAddress`, spec/SUBSCRIPTIONS.md section 4). */
  editAddress(
    settings: UserSettings,
    id: string,
    queue: string,
    statusText: string | undefined,
    addressText: string,
    query: SelectedAddressQuery,
  ): SyncResult {
    this.ensureReady(settings);
    const address = {
      remSlug: query.remId,
      settlementId: query.settlementId,
      streetId: query.streetId,
      streetName: resolveStreetName(query.streetId) ?? '',
      house: query.house,
      text: addressText,
    };
    const synced = this.change(settings, (s) => setAddress(s, id, address, queue, statusText ?? null));
    if (synced.result.ok) writeLost(readLost().filter((x) => x !== id));
    return synced;
  }

  /**
   * Brings every saved address to ztoe's current ids (spec/ADDRESS_KEY.md section 7); mirrors
   * SubscriptionSync.repairAddresses on Android. A renumbered address gets its new ids and a text with the
   * street, keeping its queue, switches and name; an address whose street can not be found again is
   * remembered for the notice (`lostStreetIds`). Returns the settings to save. Never throws.
   */
  async repairAddresses(settings: UserSettings, siteUrl?: string): Promise<UserSettings> {
    this.ensureReady(settings);
    let next = settings;
    const lost = new Set<string>();
    const known = new Set<string>();
    for (const item of this.repo.store().items) {
      const a = item.address;
      if (!a) continue;
      let check: SavedStreet;
      try {
        check = await checkSavedStreet(a.remSlug, a.settlementId, settlementNameFromText(a.text), a.streetId, a.streetName, siteUrl);
      } catch {
        check = { kind: 'unknown' };
      }
      if (check.kind === 'moved') {
        const rem = getRems().find((r) => r.id === a.remSlug) ?? ZTOE_REM_OPTIONS.find((r) => r.id === a.remSlug);
        const moved = {
          ...a,
          settlementId: check.settlementId,
          streetId: check.streetId,
          // the saved name is the address key: it stays, and is only filled in when it was missing
          streetName: a.streetName || check.streetName,
          text: buildAddressText(rem?.nameUk, check.settlementName, check.streetName, a.house),
        };
        const choice = getHouseVariantChoice(a.streetId, a.house);
        if (choice) setHouseVariantChoice(check.streetId, a.house, choice);
        const synced = this.change(next, (s) => setAddress(s, item.id, moved, item.queue, item.queueStatusText));
        if (synced.result.ok) {
          next = synced.settings;
          known.add(item.id);
        }
      } else if (check.kind === 'current') {
        known.add(item.id);
      } else if (check.kind === 'lost') {
        lost.add(item.id);
      }
    }
    // an address that could not be checked keeps its previous mark
    writeLost([...new Set([...readLost().filter((id) => !known.has(id)), ...lost])]);
    return next;
  }

  /** Ids of saved addresses whose street ztoe no longer lists (spec/ADDRESS_KEY.md section 7). */
  lostStreetIds(settings: UserSettings): Set<string> {
    const present = new Set(this.store(settings).items.map((i) => i.id));
    return new Set(readLost().filter((id) => present.has(id)));
  }

  addQueueOnly(settings: UserSettings, queue: string): SyncResult {
    this.ensureReady(settings);
    const item = makeSubscription(this.repo.newItemId(), { queue, queueSource: 'MANUAL', createdAtMs: Date.now() });
    return this.change(settings, (s) => add(s, item));
  }

  /** A background ZTOE lookup for the primary address found its queue (or "no queue"). */
  assignPrimaryQueue(
    settings: UserSettings,
    queue: string | null,
    statusText: string | null,
    addressText: string | null,
  ): SyncResult {
    return this.change(settings, (s) =>
      s.primaryId === null
        ? { ok: false, code: ERR_NOT_FOUND, existingId: null }
        : setQueueInfo(s, s.primaryId, queue, statusText, addressText),
    );
  }

  /** Forgets the store and the master switch (reset to first launch). */
  clear(): void {
    this.repo.clear();
  }
}

let shared: SubscriptionSync | null = null;

/** The app-wide instance over localStorage (or memory when storage is blocked). */
export function getSubscriptionSync(): SubscriptionSync {
  return (shared ??= new SubscriptionSync());
}
