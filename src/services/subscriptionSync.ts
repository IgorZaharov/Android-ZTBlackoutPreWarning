/**
 * Web port of android/.../data/repository/SubscriptionSync.kt (multi-address step 2,
 * spec/SUBSCRIPTIONS.md section 7): the one way to change addresses and alert switches. Every call
 * runs the one-time migration first, changes the subscription store, then returns the UserSettings with
 * the primary item mirrored into the single-address fields that the main view, widgets and alerts read.
 * Callers save the returned settings.
 */
import {
  ERR_NOT_FOUND,
  add,
  isValidQueue,
  makeSubscription,
  primaryMirror,
  setQueueInfo,
  type LegacyMirror,
  type LegacySettings,
  type StoreResult,
  type SubscriptionStore,
} from '../core/subscriptions';
import type { SelectedAddressQuery, UserSettings } from '../types';
import { SubscriptionRepository } from './subscriptionStore';
import { findStreetById } from './ztoeAddressLookup';

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
 * Writes the mirror into the settings. Sound and vibration keep the 1.4.0 rule: remembered and switched
 * off when both alert switches go off, restored when one comes back on (as SettingsRepository.applyPrimaryMirror).
 */
export function applyPrimaryMirror(s: UserSettings, m: LegacyMirror, master: boolean): UserSettings {
  const anyWas = Boolean(s.notificationsEnabled || (s.emergencyNotificationsEnabled ?? true));
  const anyNow = m.notificationsEnabled || m.emergencyNotificationsEnabled;
  const query: SelectedAddressQuery | undefined =
    m.remSlug && m.settlementId && m.streetId && m.house
      ? { remId: m.remSlug, settlementId: m.settlementId, streetId: m.streetId, house: m.house }
      : undefined;
  const next: UserSettings = {
    ...s,
    queue: m.queue,
    customQueueStatusText: m.customQueueStatusText ?? undefined,
    selectedAddress: m.selectedAddress ?? undefined,
    selectedAddressQuery: query,
    notificationsEnabled: m.notificationsEnabled,
    emergencyNotificationsEnabled: m.emergencyNotificationsEnabled,
    alertsMaster: master,
  };
  if (anyWas && !anyNow) {
    return {
      ...next,
      prevSoundEnabled: s.soundEnabled,
      prevVibrationEnabled: s.vibrationEnabled,
      soundEnabled: false,
      vibrationEnabled: false,
    };
  }
  if (!anyWas && anyNow) {
    return { ...next, soundEnabled: s.prevSoundEnabled ?? true, vibrationEnabled: s.prevVibrationEnabled ?? true };
  }
  return next;
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
    this.repo.setAlertsMaster(on);
    return this.mirror(settings);
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
