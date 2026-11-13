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

export interface RefreshOutcome {
  siteState: SiteState | null;
  fetchStatus: ZtoeFetchStatus | null;
  poweronOk: boolean | null;
  events: readonly EmergencyEvent[];
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
    const today = toLocalDate(now);
    const q = settings.queue || '';
    const hasQueue = q.trim() !== '';

    const planned = hasQueue
      ? buildPlanned(today, this.schedule.todayOffCells(q, today), this.schedule.tomorrowOffCells(q, today), this.schedule.yesterdayOffCells(q, today))
      : [];
    const emergencies = key !== null ? ledgerOutages(this.store.ledger(key), now) : [];
    const repairs = key !== null ? this.store.repairs(key) : [];

    return new OutageSnapshot({
      now,
      queue: q,
      outages: inWindow([...planned, ...repairs, ...emergencies], today),
      plannedKnown: !hasQueue || this.schedule.hasValidTodayCache(q, today),
      tomorrowPublished: hasQueue && this.schedule.hasTomorrowSchedule(q, today),
      site: this.store.site(),
      poweron: this.store.poweron(),
      hasAddress: key !== null,
    });
  }

  /**
   * Refreshes ztoe (planned) and PowerOn (emergency + repair works) for the selected address.
   * A source that fails keeps its previous data and is reported as such; it never counts as "no outage".
   */
  async refresh(settings: UserSettings, forceNetwork = false, notify = true): Promise<RefreshOutcome> {
    const nowMs = this.nowMs();
    let siteState: SiteState | null = null;
    let fetchStatus: ZtoeFetchStatus | null = null;

    if ((settings.queue || '').trim() !== '') {
      try {
        const res = await this.fetchSchedule(settings.url, settings.queue, {
          force: forceNetwork,
          now: new Date(nowMs),
          cache: this.schedule,
          ...this.ztoeOptions,
        });
        fetchStatus = res.status;
        siteState = res.siteState;
        this.store.saveSite(res.siteState, nowMs, res.notice ?? null);
      } catch {
        // keep the previous site state
      }
    }

    let poweronOk: boolean | null = null;
    let events: readonly EmergencyEvent[] = [];
    const query = settings.selectedAddressQuery;
    const key = this.addressKey(query);
    if (query && key) {
      try {
        const target = this.buildTarget(query, key, nowMs);
        if (target) {
          const now = fromInstant(nowMs);
          const result = await this.powerOn.fetch(target, toLocalDate(now), now);
          if (result.ids && (result.ids.cityIds.length > 0 || result.ids.streetIds.length > 0)) this.store.saveIds(key, result.ids, nowMs);

          const ledger = reconcile(this.store.ledger(key), result.emergency, now);
          this.store.saveLedger(key, ledger.entries);
          events = ledger.events;
          if (result.repairs) this.store.saveRepairs(key, result.repairs);

          poweronOk = result.emergency.type === 'Confirmed';
          this.store.savePowerOn(poweronOk, nowMs);
          if (notify && events.length > 0 && (settings.emergencyNotificationsEnabled ?? true)) {
            this.notifyEvents(settings, key, events, now);
          }
        } else {
          this.store.savePowerOn(false, nowMs);
          poweronOk = false;
        }
      } catch {
        this.store.savePowerOn(false, nowMs);
        poweronOk = false;
      }
    }
    return { siteState, fetchStatus, poweronOk, events, snapshot: this.snapshot(settings, fromInstant(this.nowMs())) };
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

let defaultRepository: OutageRepository | null = null;
/** Process-wide repository on the default storage and network (used by the views and the alert checks). */
export function getOutageRepository(): OutageRepository {
  return (defaultRepository ??= new OutageRepository());
}
