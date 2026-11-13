/**
 * One place that refreshes both sources and turns the stored state into a snapshot, ported from
 * android/.../data/repository/OutageRepository.kt. The main screen, the widget simulator and the
 * alert checks all go through it, so they cannot disagree about what is off and when
 * (spec/OUTAGE_ENGINE.md).
 *
 *  - `snapshot(settings, now)` is local only (no network): ztoe cache + PowerOn repairs + the ledger.
 *  - `refresh(settings, force, notify)` fetches ztoe and PowerOn. A source that fails keeps its previous
 *    data and is reported as such; it never becomes "no outage".
 */
import { HouseKey, StreetKey } from '../core/addressKeys';
import { reconcile, outages as ledgerOutages, type EmergencyEvent } from '../core/emergencyLedger';
import { fromInstant, formatLocalDate, toLocalDate, type LocalDate, type LocalDateTime } from '../core/localTime';
import { buildPlanned, dayView as engineDayView, inWindow, status as engineStatus } from '../core/outageEngine';
import { statusAt, type DayView, type Outage, type StatusInfo } from '../core/outageModels';
import type { SiteState } from '../core/siteState';
import type { BlackoutSlot, SelectedAddressQuery, UserSettings } from '../types';
import { PowerOnClient, POWERON_IDS_TTL_MS, type PowerOnResult, type PowerOnTarget } from './poweronClient';
import { OutageStateStore, getOutageStateStore, type PowerOnSnapshot, type SiteSnapshot } from './outageStore';
import { ScheduleCache, getScheduleCache } from './scheduleCache';
import {
  fetchZtoeSchedule,
  type ScheduleFetchResult,
  type ZtoeFetchOptions,
  type ZtoeFetchStatus,
} from './ztoeParser';
import {
  ZTOE_REM_OPTIONS,
  findSettlementById,
  findStreetById,
  getRems,
  getStreetsForSettlement,
  type ZtoeRemOption,
  type ZtoeSettlementOption,
  type ZtoeStreetOption,
} from './ztoeAddressLookup';
import { triggerEmergencyEventAlerts } from './alertManager';
import { resolveLanguage } from './i18n';
import { addressKey as subscriptionAddressKey, alertOrder, displayLabel, type Subscription, type SubscriptionStore } from '../core/subscriptions';
import { getSubscriptionSync } from './subscriptionSync';

const p2 = (n: number): string => String(n).padStart(2, '0');
const hhmm = (minuteOfDay: number): string => `${p2(Math.floor(minuteOfDay / 60))}:${p2(minuteOfDay % 60)}`;

/** Legacy shape used by the existing main screen and widget simulator. */
export interface ScheduleStatusInfo {
  isBlackoutNow: boolean;
  countdownText: string;
  nextSlotTime: string;
  totalBlackoutHours: number;
  isUnclear: boolean;
}

export interface OutageSnapshotInit {
  now: LocalDateTime;
  queue: string;
  outages: readonly Outage[];
  /** Today's ztoe table is cached and still valid for today (or the address has no queue at all). */
  plannedKnown: boolean;
  tomorrowPublished: boolean;
  site: SiteSnapshot | null;
  poweron: PowerOnSnapshot | null;
  hasAddress: boolean;
}

/** Everything the screens, the widget simulator and alert checks need, derived from local state only. */
export class OutageSnapshot {
  readonly now: LocalDateTime;
  readonly queue: string;
  readonly outages: readonly Outage[];
  readonly plannedKnown: boolean;
  readonly tomorrowPublished: boolean;
  readonly site: SiteSnapshot | null;
  readonly poweron: PowerOnSnapshot | null;
  readonly hasAddress: boolean;

  constructor(init: OutageSnapshotInit) {
    this.now = init.now;
    this.queue = init.queue;
    this.outages = init.outages;
    this.plannedKnown = init.plannedKnown;
    this.tomorrowPublished = init.tomorrowPublished;
    this.site = init.site;
    this.poweron = init.poweron;
    this.hasAddress = init.hasAddress;
  }

  get today(): LocalDate {
    return toLocalDate(this.now);
  }

  dayView(date: LocalDate): DayView {
    return engineDayView(this.outages, date, this.now);
  }

  status(): StatusInfo {
    return engineStatus(this.outages, this.now);
  }

  /** The planned schedule is unknown and nothing else is known either: screens go grey. */
  get isUnclear(): boolean {
    return this.queue.trim() !== '' && !this.plannedKnown && !this.outages.some((o) => !o.stale && o.kind !== 'PLANNED');
  }

  /** True when the shown schedule comes from the cache because the site could not be refreshed. */
  get isStale(): boolean {
    return this.plannedKnown && this.queue.trim() !== '' && this.site !== null && this.site.state !== 'AVAILABLE_WITH_TABLE';
  }

  scheduleStatus(): ScheduleStatusInfo {
    if (this.isUnclear) {
      return { isBlackoutNow: false, countdownText: '--:--:--', nextSlotTime: '--:-- - --:--', totalBlackoutHours: 0, isUnclear: true };
    }
    const st = this.status();
    return {
      isBlackoutNow: st.isOffNow,
      countdownText: st.countdownText,
      nextSlotTime: st.nextSlotTime,
      totalBlackoutHours: this.dayView(this.today).totalOffMinutes / 60,
      isUnclear: false,
    };
  }

  /** The 48 cells of [date] in the shape the drum chart and widgets draw. Empty when unclear. */
  slotsFor(date: LocalDate): BlackoutSlot[] {
    if (this.isUnclear) return [];
    const view = this.dayView(date);
    const dateStr = formatLocalDate(date);
    return view.slots.map((s, i): BlackoutSlot => {
      const startMin = i * 30;
      const endMin = startMin + 30;
      const startStr = hhmm(startMin);
      return {
        id: `${dateStr}_${startStr}_Q${this.queue}`,
        startHour: Math.floor(startMin / 60),
        endHour: Math.floor(endMin / 60),
        startMinute: startMin % 60,
        endMinute: endMin % 60,
        startTimeStr: startStr,
        endTimeStr: endMin >= 1440 ? '24:00' : hhmm(endMin),
        status: s.off ? 'POWER_OFF' : 'POWER_ON',
        isEmergency: s.emergency,
        isPlanned: s.planned,
      };
    });
  }

  /** The emergency outage to feature in the banner: active or overdue first, then the next upcoming one. */
  featuredEmergency(): Outage | null {
    const live = this.outages.filter((o) => o.kind === 'EMERGENCY' && !o.stale);
    const active = live.find((o) => {
      const st = statusAt(o, this.now);
      return st === 'ACTIVE' || st === 'OVERDUE';
    });
    if (active) return active;
    const upcoming = live.filter((o) => statusAt(o, this.now) === 'UPCOMING').sort((a, b) => a.start - b.start);
    return upcoming[0] ?? null;
  }
}

/** Emergency events of a subscription other than the primary (spec/SUBSCRIPTIONS.md 8.4). */
export interface AddressEvents {
  itemId: string;
  addressKey: string;
  /** Second line of the notification: the address text, or the label. */
  addressLine: string;
  events: readonly EmergencyEvent[];
}

export interface RefreshOutcome {
  siteState: SiteState | null;
  fetchStatus: ZtoeFetchStatus | null;
  poweronOk: boolean | null;
  /** Events of the primary (selected) address. */
  events: readonly EmergencyEvent[];
  /** Events of the other subscriptions that want emergency alerts. */
  otherEvents: readonly AddressEvents[];
  snapshot: OutageSnapshot;
}

/** Names and ids of the selected address, resolved from the address index (a seam for tests). */
export interface AddressResolver {
  rem(remId: string): ZtoeRemOption | undefined;
  settlement(settlementId: string): ZtoeSettlementOption | undefined;
  street(streetId: string): ZtoeStreetOption | undefined;
  streetsForSettlement(settlementId: string): ZtoeStreetOption[];
}

export const defaultAddressResolver: AddressResolver = {
  rem: (remId) => getRems().find((r) => r.id === remId) ?? ZTOE_REM_OPTIONS.find((r) => r.id === remId),
  settlement: findSettlementById,
  street: findStreetById,
  streetsForSettlement: getStreetsForSettlement,
};

export interface OutageRepositoryDeps {
  schedule?: ScheduleCache;
  store?: OutageStateStore;
  powerOn?: { fetch(target: PowerOnTarget, today: LocalDate, now?: LocalDateTime): Promise<PowerOnResult> };
  /** Replaces the ztoe refresh (tests). */
  fetchSchedule?: (url: string, queue: string, options: ZtoeFetchOptions) => Promise<ScheduleFetchResult>;
  address?: AddressResolver;
  /** The real instant in epoch milliseconds (tests pass a fake clock). */
  nowMs?: () => number;
  /** Delivers emergency events (default: the browser notification adapter in alertManager). */
  notify?: (settings: UserSettings, addressKey: string, events: readonly EmergencyEvent[], now: LocalDateTime) => void;
  /** Passed through to the ztoe fetch (tests inject the HTML here). */
  ztoeOptions?: Pick<ZtoeFetchOptions, 'fetchHtml' | 'isOnline'>;
  /** The subscription store and the master switch (default: the app-wide SubscriptionSync). */
  subscriptions?: (settings: UserSettings) => { store: SubscriptionStore; master: boolean };
  /** Delivers the events of another subscription (default: the browser notification adapter). */
  notifyOther?: (settings: UserSettings, other: AddressEvents, now: LocalDateTime) => void;
}

export class OutageRepository {
  private readonly schedule: ScheduleCache;
  private readonly store: OutageStateStore;
  private readonly powerOn: NonNullable<OutageRepositoryDeps['powerOn']>;
  private readonly fetchSchedule: NonNullable<OutageRepositoryDeps['fetchSchedule']>;
  private readonly address: AddressResolver;
  private readonly nowMs: () => number;
  private readonly notifyEvents: NonNullable<OutageRepositoryDeps['notify']>;
  private readonly ztoeOptions: NonNullable<OutageRepositoryDeps['ztoeOptions']>;
  private readonly subscriptions: NonNullable<OutageRepositoryDeps['subscriptions']>;
  private readonly notifyOther: NonNullable<OutageRepositoryDeps['notifyOther']>;

  constructor(deps: OutageRepositoryDeps = {}) {
    this.schedule = deps.schedule ?? getScheduleCache();
    this.store = deps.store ?? getOutageStateStore();
    this.powerOn = deps.powerOn ?? new PowerOnClient();
    this.fetchSchedule = deps.fetchSchedule ?? fetchZtoeSchedule;
    this.address = deps.address ?? defaultAddressResolver;
    this.nowMs = deps.nowMs ?? (() => Date.now());
    this.notifyEvents =
      deps.notify ??
      ((settings, addressKey, events, now) => {
        triggerEmergencyEventAlerts(events, addressKey, settings, resolveLanguage(settings.language), now);
      });
    this.ztoeOptions = deps.ztoeOptions ?? {};
    this.subscriptions =
      deps.subscriptions ??
      ((settings) => {
        const sync = getSubscriptionSync();
        return { store: sync.store(settings), master: sync.master(settings) };
      });
    this.notifyOther =
      deps.notifyOther ??
      ((settings, other, now) => {
        triggerEmergencyEventAlerts(other.events, other.addressKey, settings, resolveLanguage(settings.language), now, undefined, {
          addressLine: other.addressLine,
          enabled: true,
        });
      });
  }

  /** Stable key of the selected address; survives duplicate-street merges because it uses the canonical street key. */
  addressKey(query: SelectedAddressQuery | null | undefined): string | null {
    if (!query) return null;
    if (!query.house || query.house.trim() === '') return null;
    let streetName: string | undefined;
    try {
      streetName = this.address.street(query.streetId)?.nameUk;
    } catch {
      streetName = undefined;
    }
    return `${query.settlementId}|${StreetKey.of(streetName ?? query.streetId)}|${HouseKey.of(query.house)}`;
  }

  /** Local state only. [now] is the Kyiv wall clock. */
  snapshot(settings: UserSettings, now: LocalDateTime = fromInstant(this.nowMs()), key: string | null = this.addressKey(settings.selectedAddressQuery)): OutageSnapshot {
    return this.snapshotOf(settings.queue || '', key, now, this.store.poweron());
  }

  /**
   * The snapshot of one non-primary subscription for the main view (spec/SUBSCRIPTIONS.md 9). The primary
   * goes through [snapshot]; another item has its own PowerOn status under its address key.
   */
  snapshotFor(item: Subscription, now: LocalDateTime = fromInstant(this.nowMs())): OutageSnapshot {
    const key = item.address ? subscriptionAddressKey(item.address) : null;
    return this.snapshotOf(item.queue ?? '', key, now, key !== null ? this.store.poweronFor(key) : null);
  }

  private snapshotOf(q: string, key: string | null, now: LocalDateTime, poweron: PowerOnSnapshot | null): OutageSnapshot {
    const today = toLocalDate(now);
    const hasQueue = q.trim() !== '';
    return new OutageSnapshot({
      now,
      queue: q,
      outages: this.outagesFor(q, key, now),
      plannedKnown: !hasQueue || this.schedule.hasValidTodayCache(q, today),
      tomorrowPublished: hasQueue && this.schedule.hasTomorrowSchedule(q, today),
      site: this.store.site(),
      poweron,
      hasAddress: key !== null,
    });
  }

  /**
   * The outages of one queue and address key (either may be absent), local state only. One ztoe fetch
   * caches all 12 queues, so this works for every subscription (spec/SUBSCRIPTIONS.md 8.1).
   */
  outagesFor(queue: string | null, key: string | null, now: LocalDateTime = fromInstant(this.nowMs())): Outage[] {
    const today = toLocalDate(now);
    const q = (queue ?? '').trim();
    const planned =
      q !== ''
        ? buildPlanned(today, this.schedule.todayOffCells(q, today), this.schedule.tomorrowOffCells(q, today), this.schedule.yesterdayOffCells(q, today))
        : [];
    const emergencies = key !== null ? ledgerOutages(this.store.ledger(key), now) : [];
    const repairs = key !== null ? this.store.repairs(key) : [];
    return inWindow([...planned, ...repairs, ...emergencies], today);
  }

  /**
   * Refreshes ztoe (planned) and PowerOn (emergency + repair works) for the selected address.
   * A source that fails keeps its previous data and is reported as such; it never counts as "no outage".
   * [shownId] is the item the main view shows: it is polled whatever its switches (spec/SUBSCRIPTIONS.md 8.4).
   */
  async refresh(settings: UserSettings, forceNetwork = false, notify = true, shownId: string | null = null): Promise<RefreshOutcome> {
    const nowMs = this.nowMs();
    let siteState: SiteState | null = null;
    let fetchStatus: ZtoeFetchStatus | null = null;
    let subs: { store: SubscriptionStore; master: boolean } | null = null;
    try {
      subs = this.subscriptions(settings);
    } catch {
      subs = null;
    }

    // One fetch caches all 12 queues. A primary without a queue still fetches for the other addresses.
    const primaryQueue = (settings.queue || '').trim();
    const ztoeQueue = primaryQueue !== '' ? primaryQueue : (subs ? alertOrder(subs.store).find((i) => i.queue !== null)?.queue ?? '' : '');
    if (ztoeQueue !== '') {
      try {
        const res = await this.fetchSchedule(settings.url, ztoeQueue, {
          force: forceNetwork,
          now: new Date(nowMs),
          cache: this.schedule,
          ...this.ztoeOptions,
        });
        this.store.saveSite(res.siteState, nowMs, res.notice ?? null);
        if (primaryQueue !== '') {
          fetchStatus = res.status;
          siteState = res.siteState;
        }
      } catch {
        // keep the previous site state
      }
    }

    let poweronOk: boolean | null = null;
    let events: readonly EmergencyEvent[] = [];
    const query = settings.selectedAddressQuery;
    const key = this.addressKey(query);
    if (query && key) {
      const polled = await this.pollPowerOn(query, key, nowMs);
      poweronOk = polled?.ok ?? false;
      events = polled?.events ?? [];
      this.store.savePowerOn(poweronOk, nowMs);
      if (notify && events.length > 0 && (settings.emergencyNotificationsEnabled ?? true)) {
        this.notifyEvents(settings, key, events, fromInstant(nowMs));
      }
    }
    const otherEvents = subs ? await this.refreshOtherAddresses(settings, subs, key, nowMs, notify, shownId) : [];
    return { siteState, fetchStatus, poweronOk, events, otherEvents, snapshot: this.snapshot(settings, fromInstant(this.nowMs())) };
  }

  /**
   * PowerOn for every other subscription that wants emergency alerts, plus the one the main view shows
   * (spec/SUBSCRIPTIONS.md 8.4): own request, own failure, own ledger, own status line.
   */
  private async refreshOtherAddresses(
    settings: UserSettings,
    subs: { store: SubscriptionStore; master: boolean },
    primaryKey: string | null,
    nowMs: number,
    notify: boolean,
    shownId: string | null,
  ): Promise<AddressEvents[]> {
    const out: AddressEvents[] = [];
    for (const item of subs.store.items) {
      const a = item.address;
      if (!a || item.id === subs.store.primaryId) continue;
      const alerts = subs.master && item.emergencyAlerts;
      if (!alerts && item.id !== shownId) continue;
      const key = subscriptionAddressKey(a);
      if (key === primaryKey) continue;
      const polled = await this.pollPowerOn({ remId: a.remSlug, settlementId: a.settlementId, streetId: a.streetId, house: a.house }, key, nowMs);
      this.store.savePowerOnFor(key, polled?.ok ?? false, nowMs);
      if (!alerts || !polled || polled.events.length === 0) continue;
      const other: AddressEvents = { itemId: item.id, addressKey: key, addressLine: addressLine(item), events: polled.events };
      out.push(other);
      if (notify) this.notifyOther(settings, other, fromInstant(nowMs));
    }
    return out;
  }

  /** One PowerOn query: saves ids, ledger and repairs under [key]. Null when it failed or could not be built. */
  private async pollPowerOn(query: SelectedAddressQuery, key: string, nowMs: number): Promise<{ ok: boolean; events: readonly EmergencyEvent[] } | null> {
    try {
      const target = this.buildTarget(query, key, nowMs);
      if (!target) return null;
      const now = fromInstant(nowMs);
      const result = await this.powerOn.fetch(target, toLocalDate(now), now);
      if (result.ids && (result.ids.cityIds.length > 0 || result.ids.streetIds.length > 0)) this.store.saveIds(key, result.ids, nowMs);
      const ledger = reconcile(this.store.ledger(key), result.emergency, now);
      this.store.saveLedger(key, ledger.entries);
      if (result.repairs) this.store.saveRepairs(key, result.repairs);
      return { ok: result.emergency.type === 'Confirmed', events: ledger.events };
    } catch {
      return null;
    }
  }

  private buildTarget(query: SelectedAddressQuery, key: string, nowMs: number): PowerOnTarget | null {
    const rem = this.address.rem(query.remId);
    const settlement = this.address.settlement(query.settlementId);
    if (!settlement) return null;
    const street = this.address.street(query.streetId);
    if (!street) return null;
    // A merged street is one option: its other spellings share the StreetKey, which is all PowerOn matching uses
    const streetKey = StreetKey.of(street.nameUk);
    const names = this.address
      .streetsForSettlement(settlement.id)
      .filter((s) => StreetKey.of(s.nameUk) === streetKey)
      .map((s) => s.nameUk);
    const cached = this.store.ids(key);
    const fresh = cached !== null && nowMs - cached.resolvedAtMs >= 0 && nowMs - cached.resolvedAtMs < POWERON_IDS_TTL_MS ? cached.ids : null;
    const otg = rem?.ztoeOtgId !== undefined ? parseInt(rem.ztoeOtgId, 10) : NaN;
    return {
      remOtgId: Number.isFinite(otg) ? otg : null,
      settlementName: settlement.nameUk,
      streetNames: names.length > 0 ? names : [street.nameUk],
      house: query.house,
      cachedCityIds: fresh?.cityIds ?? [],
      cachedStreetIds: fresh?.streetIds ?? [],
    };
  }
}

/** Second line of an emergency notification for [item] (spec/SUBSCRIPTIONS.md 8.4). */
export function addressLine(item: Subscription): string {
  const text = item.address?.text ?? '';
  return text.trim() !== '' ? text : displayLabel(item);
}

let defaultRepository: OutageRepository | null = null;
/** Process-wide repository on the default storage and network (used by the views and the alert checks). */
export function getOutageRepository(): OutageRepository {
  return (defaultRepository ??= new OutageRepository());
}
