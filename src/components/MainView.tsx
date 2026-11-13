import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BellOff,
  CalendarCheck,
  CalendarX,
  CheckCircle2,
  Clock,
  CloudOff,
  ExternalLink,
  HelpCircle,
  Info,
  RefreshCw,
  WifiOff,
  Wrench,
  Zap
} from 'lucide-react';
import { Language, BlackoutSlot, UserSettings } from '../types';
import { siteNoticeA11y, siteNoticeTitle, translations } from '../services/i18n';
import type { OutageSnapshot } from '../services/outageRepository';
import { formatLocalDate, hourOf, minuteOf, plusDays, type LocalDateTime, toLocalDate } from '../core/localTime';
import { statusAt, type Outage } from '../core/outageModels';
import { formatRow, hhmm } from './outageRowFormat';
import { poweronLine, siteBanner, siteChips, siteNotice as siteNoticeOf, TONE_COLORS, formatHhmm, type StatusIcon, type StatusChip } from './siteStatus';
import { DrumChart } from './DrumChart';
import { GlassCard, TEXT_SECONDARY, TEXT_TERTIARY } from './GlassCard';

export type RefreshStatus = 'SUCCESS' | 'NO_INTERNET' | 'NO_QUEUES_FOUND';

/**
 * Text kept on one line (SiteStatusIndicator.kt OneLineText): when it does not fit, the size steps down
 * 5 % at a time to at most 15 % below `size` (never under 12 px); if it still does not fit, it wraps.
 */
const OneLineText: React.FC<{ text: string; size: number; lineHeight: number; className?: string; style?: React.CSSProperties }> = ({
  text,
  size,
  lineHeight,
  className = '',
  style
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ size: number; wrap: boolean }>({ size, wrap: false });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const min = Math.max(size * 0.85, 12);
      let s = size;
      el.style.whiteSpace = 'nowrap';
      el.style.fontSize = `${s}px`;
      while (el.scrollWidth > el.clientWidth && s * 0.95 >= min) {
        s *= 0.95;
        el.style.fontSize = `${s}px`;
      }
      const wrap = el.scrollWidth > el.clientWidth;
      el.style.whiteSpace = '';
      setFit((prev) => (prev.size === s && prev.wrap === wrap ? prev : { size: s, wrap }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el.parentElement ?? el);
    return () => ro.disconnect();
  }, [text, size]);
  return (
    <div
      ref={ref}
      className={`overflow-hidden ${fit.wrap ? 'whitespace-normal break-words' : 'whitespace-nowrap'} ${className}`}
      style={{ ...style, fontSize: `${fit.size}px`, lineHeight: `${(lineHeight * fit.size) / size}px` }}
    >
      {text}
    </div>
  );
};

interface MainViewProps {
  /** Everything below is derived from this one snapshot (OutageRepository.snapshot), like MainScreen.kt. */
  snapshot: OutageSnapshot;
  settings: UserSettings;
  lang: 'uk' | 'en';
  onToggleNotifications: () => void;
  onRefresh: () => Promise<RefreshStatus | void> | void;
  isRefreshing: boolean;
  onSendTestAlert?: () => void;
  onOpenQueueSelection?: () => void;
  onChangeLanguage?: (lang: Language) => void;
}

/** 48 light POWER_ON half-hour slots for buildings that are never disconnected by hourly schedules. */
const LIGHT_NO_OUTAGE_SLOTS: BlackoutSlot[] = Array.from({ length: 48 }, (_, idx) => {
  const p2 = (n: number) => String(n).padStart(2, '0');
  const sh = Math.floor(idx / 2);
  const eh = Math.floor((idx + 1) / 2);
  const startStr = `${p2(sh)}:${idx % 2 === 0 ? '00' : '30'}`;
  const endStr = `${p2(eh)}:${(idx + 1) % 2 === 0 ? '00' : '30'}`;
  return {
    id: `no_outage_${startStr}`,
    startHour: sh,
    endHour: eh,
    startTimeStr: startStr,
    endTimeStr: endStr,
    status: 'POWER_ON' as const,
  };
});

/** "Житомирський РЕМ, м. Житомир,\nвул. Київська, буд. 37": the city part and the street part on two lines. */
export function formatAddressAfterCity(address?: string | null): string | null {
  if (!address || address.trim() === '') return null;
  const trimmed = address.trim();
  const commaIdx = trimmed.indexOf(',');
  if (commaIdx !== -1) {
    const cityPart = trimmed.substring(0, commaIdx + 1).trim();
    const streetPart = trimmed.substring(commaIdx + 1).trim();
    if (streetPart.length > 0) return `${cityPart}\n${streetPart}`;
  }
  return trimmed;
}

/** "dd.MM.yyyy HH:mm" */
function formatDateTime(t: LocalDateTime): string {
  const d = formatLocalDate(toLocalDate(t));
  return `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)} ${hhmm(t)}`;
}

const ICONS: Record<StatusIcon, React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  OK: CheckCircle2,
  WARNING: AlertTriangle,
  SERVER_DOWN: CloudOff,
  OFFLINE: WifiOff,
  UNKNOWN: HelpCircle,
  TOMORROW_OK: CalendarCheck,
  TOMORROW_PENDING: CalendarX,
};

/** One status pill: tinted background, icon and text in the same family. Text wraps instead of clipping. */
const StatusChipView: React.FC<{ chip: StatusChip }> = ({ chip }) => {
  const Icon = ICONS[chip.icon];
  const c = TONE_COLORS[chip.tone];
  return (
    <span
      data-testid="site-status-chip"
      className="inline-flex items-center gap-1.5 rounded-[10px] px-2.5 py-1 text-sm font-semibold leading-5"
      style={{ background: c.fill, color: c.text }}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden={true} />
      <span>{chip.text}</span>
    </span>
  );
};

const LabelledValue: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex gap-1.5 text-[13px] leading-[19px]">
    <span className={`${TEXT_TERTIARY} font-medium`}>{label}</span>
    <span className="whitespace-nowrap font-mono font-bold tabular-nums text-white">{value}</span>
  </div>
);

export const MainView: React.FC<MainViewProps> = ({
  snapshot,
  settings,
  lang,
  onToggleNotifications,
  onRefresh,
  isRefreshing,
  onOpenQueueSelection,
  onChangeLanguage,
}) => {
  const t = translations[lang];
  // the header bell shows and toggles the master switch for all addresses (owner decision 4)
  const alertsOn = settings.alertsMaster ?? settings.notificationsEnabled;
  const [selectedDayTab, setSelectedDayTab] = useState<'today' | 'tomorrow'>('today');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const queue = settings.queue || '';
  const hasQueue = queue.trim() !== '';
  const customStatus = settings.customQueueStatusText?.trim() ? settings.customQueueStatusText : null;

  // Everything below is derived from the one outage snapshot
  const todayDate = snapshot.today;
  const tomorrowDate = plusDays(todayDate, 1);
  const isTomorrowSelected = selectedDayTab === 'tomorrow';
  const activeDate = isTomorrowSelected ? tomorrowDate : todayDate;

  const activeView = useMemo(() => snapshot.dayView(activeDate), [snapshot, activeDate]);
  const featured: Outage | null = useMemo(() => snapshot.featuredEmergency(), [snapshot]);
  const banner = useMemo(() => siteBanner(snapshot, lang), [snapshot, lang]);
  const chips = useMemo(() => siteChips(snapshot, lang), [snapshot, lang]);
  const poweron = useMemo(() => poweronLine(snapshot, lang), [snapshot, lang]);
  const statusInfo = useMemo(() => snapshot.scheduleStatus(), [snapshot]);

  const siteNotice = useMemo(() => siteNoticeOf(snapshot), [snapshot]);
  const hasEmergencyOutage = featured !== null;
  const hasCustomNoQueueStatus = customStatus !== null && !hasEmergencyOutage;
  const isQueueUnselected = !hasQueue && !hasCustomNoQueueStatus && !hasEmergencyOutage;
  const formattedSelectedAddress = formatAddressAfterCity(settings.selectedAddress);

  // The ztoe table of the shown day is not known: the drum is grey, known emergency/repair outages are drawn on top
  const isTodayUnclear = !hasCustomNoQueueStatus && hasQueue && !snapshot.plannedKnown;
  const isTomorrowUnclear = !hasCustomNoQueueStatus && hasQueue && !snapshot.tomorrowPublished;
  const activeUnclear = isTomorrowSelected ? isTomorrowUnclear : isTodayUnclear;

  const activeSlots = useMemo<BlackoutSlot[]>(
    () => (hasCustomNoQueueStatus ? LIGHT_NO_OUTAGE_SLOTS : snapshot.slotsFor(activeDate)),
    [snapshot, activeDate, hasCustomNoQueueStatus]
  );

  const isStatusUnclear = (snapshot.isUnclear && !hasCustomNoQueueStatus) || isQueueUnselected;
  const rows = activeView.rows;
  const showOutageList = !isQueueUnselected && (rows.length > 0 || (!activeUnclear && activeSlots.length > 0));
  const off = !isStatusUnclear && statusInfo.isBlackoutNow;

  const slotTimeText = isStatusUnclear ? '--:-- - --:--' : statusInfo.nextSlotTime;
  const nowStr = hhmm(snapshot.now);

  const lastUpdated = snapshot.site?.lastSuccessMs ? formatHhmm(snapshot.site.lastSuccessMs) : '--:--';
  const nextUpdated = useMemo(() => {
    const ms = snapshot.site?.checkedAtMs && snapshot.site.checkedAtMs > 0 ? snapshot.site.checkedAtMs : Date.now();
    return formatHhmm(ms + Math.max(1, settings.refreshIntervalMinutes || 30) * 60_000);
  }, [snapshot.site, settings.refreshIntervalMinutes]);

  const handleManualRefresh = async () => {
    const status = await onRefresh();
    let msg = t.refreshSuccessToast;
    if (status === 'NO_INTERNET') msg = t.errorNoInternet;
    else if (status === 'NO_QUEUES_FOUND') msg = t.errorNoQueuesFound;
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const dimmed = isQueueUnselected;
  const tabClass = (selected: boolean) =>
    `flex-1 min-h-12 rounded-xl px-2 py-2 text-sm font-bold transition-colors ${
      selected ? 'bg-white/20 text-white' : 'text-[#BAE6FD]/80 hover:text-white'
    } disabled:opacity-50`;

  return (
    <div className="mx-auto flex max-w-lg select-none flex-col gap-4">
      {/* In-App Toast Banner with Application Icon */}
      {toastMessage && (
        <div
          role="status"
          className="fixed top-14 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2.5 rounded-2xl border border-white/20 bg-[#141A29]/95 px-4 py-2 text-sm text-white shadow-2xl backdrop-blur-2xl"
        >
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#FF5E3A] text-white">
            <Zap className="h-3.5 w-3.5 fill-current" />
          </div>
          <span className="font-bold">{toastMessage}</span>
        </div>
      )}

      {/* First application start: centred "Виберіть чергу" button and the Auto/English/Ukrainian switch; everything else is dimmed and inert */}
      {isQueueUnselected && (
        <div
          data-testid="first-start-select-queue-overlay"
          className="pointer-events-auto fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 px-6"
        >
          <button
            type="button"
            data-testid="unselected-queue-header-btn"
            onClick={onOpenQueueSelection}
            className="flex min-h-12 min-w-[260px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-3xl border border-white/25 bg-[#FF5E3A] px-8 py-5 text-center shadow-[0_20px_50px_rgba(255,94,58,0.5)] transition-transform hover:bg-[#ff4b24] active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            {/* Dark label on the accent fill: 6.9:1, where white would be 3.0:1 */}
            <span className="text-2xl font-extrabold leading-[30px] tracking-tight text-[#0B0B0A]">{t.selectQueueAction}</span>
            <span className="text-sm font-semibold leading-5 text-[#0B0B0A]">{t.mainUtilityName}</span>
          </button>

          <div
            data-testid="first-start-language-switch"
            role="radiogroup"
            aria-label={t.settingsLanguage}
            className="grid min-w-[260px] grid-cols-3 gap-1 rounded-2xl border border-white/20 bg-[#141A29]/90 p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.5)] backdrop-blur-2xl"
          >
            {[
              { id: 'system', label: t.mainLangAuto },
              { id: 'en', label: 'English' },
              { id: 'uk', label: 'Українська' }
            ].map((item) => {
              const isSelected = (settings.language || 'system') === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  data-testid={`first-start-lang-${item.id}`}
                  onClick={() => onChangeLanguage?.(item.id as Language)}
                  className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl px-2 py-2 text-center text-sm font-bold leading-tight transition-colors ${
                    isSelected ? 'bg-white text-black shadow-[0_2px_6px_rgba(0,0,0,0.3)]' : 'text-[#BAE6FD]/90 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Top header: queue title + address (or empty) and the pill switch */}
      <div
        className={`flex items-center justify-between pt-1 ${dimmed ? 'pointer-events-none select-none opacity-15 brightness-50' : ''}`}
        aria-hidden={dimmed || undefined}
      >
        {isQueueUnselected || hasCustomNoQueueStatus || !hasQueue ? (
          <div data-testid="empty-queue-header" className="min-h-12" />
        ) : (
          <div className="min-w-0 flex-1 pr-3">
            <div className="text-2xl font-bold leading-[30px] tracking-tight text-white drop-shadow-sm">
              {t.queue} {queue}
            </div>
            <div className={`line-clamp-3 whitespace-pre-line text-[13px] font-medium leading-[19px] ${TEXT_SECONDARY}`}>
              {formattedSelectedAddress ?? t.mainUtilityName}
            </div>
          </div>
        )}

        {/* 58 x 34 pill; the touch target is 48 px tall without changing the look */}
        <button
          type="button"
          role="switch"
          aria-checked={alertsOn}
          aria-label={t.notifications}
          title={t.quickToggleAlerts}
          data-testid="main-notifications-switch"
          onClick={onToggleNotifications}
          disabled={isQueueUnselected}
          className="flex min-h-12 min-w-[58px] shrink-0 cursor-pointer items-center justify-center"
        >
          <span
            className={`flex h-[34px] w-[58px] items-center rounded-full p-1 shadow-lg transition-colors duration-300 motion-reduce:transition-none ${
              alertsOn ? 'bg-[#FF5E3A] shadow-[#FF5E3A]/30' : 'border border-white/15 bg-white/15'
            }`}
          >
            <span
              className={`flex h-[26px] w-[26px] items-center justify-center rounded-full bg-white shadow-md transition-transform duration-300 motion-reduce:transition-none ${
                alertsOn ? 'translate-x-6' : 'translate-x-0'
              }`}
            >
              {alertsOn ? (
                <Bell className="h-4 w-4 stroke-[2.5] text-[#FF5E3A]" aria-hidden="true" />
              ) : (
                <BellOff className="h-4 w-4 stroke-[2] text-zinc-500" aria-hidden="true" />
              )}
            </span>
          </span>
        </button>
      </div>

      {/* All other UI elements dimmed (and hidden from assistive technology) while the queue is not selected */}
      <div
        data-testid="main-dimmed-content-wrapper"
        aria-hidden={dimmed || undefined}
        className={`flex flex-col gap-4 transition-opacity duration-300 motion-reduce:transition-none ${
          dimmed ? 'pointer-events-none select-none opacity-15 brightness-50' : ''
        }`}
      >
        {/* Featured emergency outage: active, overdue or the next upcoming one; finished ones never show here */}
        {!isQueueUnselected && featured !== null && (
          <GlassCard data-testid="main-emergency-outage-banner" className="flex flex-col gap-1.5">
            {(() => {
              const status = statusAt(featured, snapshot.now);
              const title =
                lang === 'uk' && featured.label && featured.label.trim() !== ''
                  ? featured.label
                  : status === 'UPCOMING'
                  ? t.emergencyUpcomingTitle
                  : t.emergencyOutageTitle;
              const restore = featured.overdue || !(featured.end > featured.start) ? '--:--' : formatDateTime(featured.end);
              return (
                <>
                  <div data-testid="main-emergency-outage-title" className="text-base font-bold leading-[23px] text-[#FF5E3A]">
                    {title}
                  </div>
                  <div data-testid="main-emergency-outage-times" className="flex flex-col gap-0.5">
                    <div className="flex items-center justify-between gap-2 text-[13px] leading-[19px]">
                      <span className={`${TEXT_SECONDARY} font-medium`}>{t.emergencyStartLabel}</span>
                      <span className="whitespace-nowrap text-right font-mono font-bold tabular-nums text-white">{formatDateTime(featured.start)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[13px] leading-[19px]">
                      <span className={`${TEXT_SECONDARY} font-medium`}>{t.emergencyRestoreLabel}</span>
                      <span className="whitespace-nowrap text-right font-mono font-bold tabular-nums text-white">{restore}</span>
                    </div>
                    {status === 'OVERDUE' && <div className={`text-[13px] font-medium leading-[19px] ${TEXT_SECONDARY}`}>{t.rowOverdue}</div>}
                  </div>
                </>
              );
            })()}
          </GlassCard>
        )}

        {/* Site is degraded (no table / unreachable / no internet): persistent banner, not a toast */}
        {!isQueueUnselected && banner !== null && (
          <GlassCard data-testid="site-status-banner" role="status" aria-live="polite" padding={14} className="flex items-center gap-2.5 py-3">
            {(() => {
              const Icon = ICONS[banner.icon];
              const c = TONE_COLORS[banner.tone];
              return (
                <>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: c.fill }}>
                    <Icon className="h-[18px] w-[18px]" aria-hidden={true} />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <OneLineText text={banner.title} size={14} lineHeight={20} className="font-bold" style={{ color: c.text }} />
                    {banner.message.split('\n').filter((l) => l.trim() !== '').map((line) => (
                      <OneLineText key={line} text={line} size={13} lineHeight={19} className="font-medium text-[#BAE6FD]/90" />
                    ))}
                  </div>
                </>
              );
            })()}
          </GlassCard>
        )}

        {/* ztoe is up but publishes a notice instead of the table: quote it as is (shown even without a queue) */}
        {siteNotice !== null && (
          <GlassCard data-testid="site-notice-card" role="note" aria-label={`${siteNoticeA11y(lang)}. ${siteNotice}`} className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: TONE_COLORS.AMBER.fill }}>
              <Info className="h-5 w-5" style={{ color: TONE_COLORS.AMBER.text }} aria-hidden="true" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="text-xs font-bold uppercase leading-[17px] tracking-[0.05em]" style={{ color: TONE_COLORS.AMBER.text }}>
                {siteNoticeTitle(lang)}
              </div>
              {siteNotice.split(/\r?\n/).map((line, i) => (
                <div
                  key={i}
                  className={`break-words ${i === 0 ? 'text-base font-bold leading-[23px] text-white' : 'text-base font-medium leading-6 text-[#BAE6FD]/90'}`}
                >
                  {line}
                </div>
              ))}
            </div>
          </GlassCard>
        )}

        {/* Custom ZTOE queue/house status message */}
        {!isQueueUnselected && customStatus !== null && (
          <GlassCard data-testid="main-custom-queue-status-text" className="flex flex-col gap-1">
            {formattedSelectedAddress && (
              <div data-testid="main-selected-address-text" className={`whitespace-pre-line text-[13px] font-medium leading-[19px] ${TEXT_SECONDARY}`}>
                {formattedSelectedAddress}
              </div>
            )}
            <div className="whitespace-normal break-words text-base font-bold leading-[23px] text-white">{customStatus}</div>
          </GlassCard>
        )}

        {/* Hero outage status card */}
        <GlassCard data-testid="main-counter-card" padding={18} className="transition-all">
          {hasCustomNoQueueStatus && !hasEmergencyOutage ? (
            <div data-testid="main-counter-empty" className="my-4 text-center">
              <div
                data-testid="main-counter-no-queue-placeholder"
                className="whitespace-nowrap font-mono text-[44px] font-black leading-[48px] tracking-tight text-white drop-shadow-md"
              >
                --:--:--
              </div>
            </div>
          ) : (
            <>
              <div className="mb-3.5 flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span
                    data-testid="power-status-indicator"
                    aria-hidden="true"
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                      isStatusUnclear
                        ? 'bg-[#9CA3AF]'
                        : statusInfo.isBlackoutNow
                        ? 'animate-pulse bg-[#FF5E3A] motion-reduce:animate-none'
                        : 'bg-[#34D399]'
                    }`}
                  />
                  <span data-testid="power-status-text" className="text-sm font-bold leading-5 text-white">
                    {isStatusUnclear ? t.powerUnclear : statusInfo.isBlackoutNow ? t.powerOff : t.powerOn}
                  </span>
                </div>
                <div className={`flex shrink-0 items-center gap-1 font-mono text-[13px] font-bold leading-[19px] ${TEXT_SECONDARY}`}>
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{nowStr}</span>
                </div>
              </div>

              <div className="flex flex-col items-center text-center">
                <div className={`text-[13px] font-medium leading-[19px] ${TEXT_SECONDARY}`}>{off ? t.powerOnIn : t.powerOffIn}</div>
                <div className="mt-1 whitespace-nowrap font-mono text-[44px] font-black leading-[48px] tracking-tight text-white drop-shadow-md tabular-nums">
                  {isStatusUnclear ? '--:--:--' : statusInfo.countdownText}
                </div>
              </div>

              {slotTimeText !== '' && slotTimeText !== 'Відключень немає' && (
                <div className="mt-3.5 flex items-center gap-2 border-t border-white/10 pt-2.5">
                  <span className={`flex-1 text-[13px] font-medium leading-[19px] ${TEXT_SECONDARY}`}>{off ? t.outagePeriod : t.nextPeriod}</span>
                  <span
                    data-testid="next-period-value"
                    className="whitespace-nowrap rounded-[10px] bg-white/15 px-2.5 py-1 font-mono text-sm font-bold leading-5 text-white"
                  >
                    {slotTimeText}
                  </span>
                </div>
              )}
            </>
          )}
        </GlassCard>

        {/* Day selector: Tomorrow is always there; before ztoe publishes it, it shows the grey drum plus a notice */}
        <GlassCard control padding={4} data-testid="main-day-tabs">
          <div role="tablist" aria-label={`${t.today} / ${t.tomorrow}`} className="flex gap-1">
            <button
              type="button"
              role="tab"
              id="main-tab-today"
              aria-selected={!isTomorrowSelected}
              aria-label={!isTomorrowSelected ? `${t.today}, ${t.tabSelected}` : t.today}
              disabled={isQueueUnselected}
              onClick={() => setSelectedDayTab('today')}
              className={tabClass(!isTomorrowSelected)}
            >
              {t.today}
            </button>
            <button
              type="button"
              role="tab"
              id="main-tab-tomorrow"
              aria-selected={isTomorrowSelected}
              aria-label={isTomorrowSelected ? `${t.tomorrow}, ${t.tabSelected}` : t.tomorrow}
              disabled={isQueueUnselected}
              onClick={() => setSelectedDayTab('tomorrow')}
              className={tabClass(isTomorrowSelected)}
            >
              {t.tomorrow}
            </button>
          </div>
        </GlassCard>

        {isTomorrowSelected && isTomorrowUnclear && !isQueueUnselected && (
          <GlassCard data-testid="tomorrow-not-published" role="status">
            <div className="text-base font-bold leading-[23px] text-white">{t.tomorrowNotPublished}</div>
          </GlassCard>
        )}

        {/* Schedule card with the 24 h drum and the list of outages of the shown day */}
        <GlassCard padding={18} className="flex flex-col gap-3.5" role="tabpanel" aria-labelledby={isTomorrowSelected ? 'main-tab-tomorrow' : 'main-tab-today'}>
          <DrumChart
            slots={activeSlots}
            currentHour={hourOf(snapshot.now)}
            currentMinute={minuteOf(snapshot.now)}
            showNeedle={!isTomorrowSelected}
            lang={lang}
            unclearBase={activeUnclear}
            testId={isTomorrowSelected ? 'drum-tomorrow' : 'drum-today'}
          />

          {showOutageList && (
            <div className="flex flex-col gap-2 border-t border-white/10 pt-3.5">
              <div className={`text-sm font-semibold leading-5 ${TEXT_SECONDARY}`}>
                {isTomorrowSelected ? t.blackoutHoursForTomorrowHeader : t.blackoutHoursForDayHeader}
              </div>

              {rows.length > 0 ? (
                <div role="list" className="flex flex-col gap-2">
                  {rows.map((row, idx) => {
                    const text = formatRow(lang, row);
                    const tags = [text.kindTag, text.originTag, text.statusTag, text.continueTag].filter((x): x is string => x !== null).join(' · ');
                    return (
                      <div
                        key={`${idx}_${row.outage.id}`}
                        role="listitem"
                        aria-label={text.contentDescription}
                        data-testid={text.isEmergency ? 'blackout-interval-row-emergency' : 'blackout-interval-row'}
                        className={`flex items-center gap-2.5 rounded-[14px] bg-white/[0.08] px-3.5 py-2.5 ${text.isFinished ? 'opacity-55' : ''}`}
                      >
                        {/* Fixed 20x20 leading indicator slot so the text start is identical in every row */}
                        <span data-testid="blackout-interval-indicator-slot" aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center">
                          {text.isEmergency ? (
                            <span
                              data-testid="blackout-interval-emergency-icon"
                              className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FF5E3A] text-xs font-black leading-none text-white"
                            >
                              !
                            </span>
                          ) : text.isRepair ? (
                            <Wrench className="h-[18px] w-[18px] text-[#FF5E3A]" aria-hidden="true" />
                          ) : (
                            <span className="h-2.5 w-2.5 rounded-full bg-[#FF5E3A]" />
                          )}
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="font-mono text-base font-bold leading-[22px] tabular-nums text-white">{text.timeText}</span>
                          {tags !== '' && (
                            <span
                              className={`text-[13px] font-medium leading-[19px] ${
                                text.isEmergency && !text.isFinished ? 'text-[#FF5E3A]' : TEXT_SECONDARY
                              }`}
                            >
                              {tags}
                            </span>
                          )}
                        </div>
                        {text.durationText !== null && (
                          <span className="whitespace-nowrap rounded-lg bg-[#FF5E3A]/15 px-2 py-[3px] font-mono text-[13px] font-bold leading-[19px] text-[#FF5E3A]">
                            {text.durationText}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className={`rounded-[14px] bg-white/[0.08] p-3.5 text-center text-[13px] font-medium leading-[19px] ${TEXT_SECONDARY}`}>
                  {t.noBlackoutsScheduled}
                </div>
              )}
            </div>
          )}
        </GlassCard>

        {/* Last updated, site status chips and the circular refresh button */}
        <GlassCard padding={14} className="flex flex-col gap-2.5">
          <div className="flex items-center gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <LabelledValue label={t.lastUpdated} value={lastUpdated} />
              <LabelledValue label={t.nextUpdated} value={nextUpdated} />
            </div>
            {/* 42 px white disc with a 48 px touch target */}
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isQueueUnselected || isRefreshing}
              aria-label={t.refreshBtn}
              title={t.forceRefresh}
              aria-busy={isRefreshing}
              data-testid="main-refresh-button"
              className="flex min-h-12 min-w-12 shrink-0 cursor-pointer items-center justify-center disabled:cursor-default"
            >
              <span className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-white text-black shadow-lg transition-colors hover:bg-zinc-200">
                <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
              </span>
              {isRefreshing && <span className="sr-only">{t.refreshing}</span>}
            </button>
          </div>
          {(chips.length > 0 || poweron !== null) && (
            <div className="flex flex-col gap-2" data-testid="site-status-chip-row">
              {chips.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {chips.map((chip, i) => (
                    <StatusChipView key={`${chip.icon}_${i}`} chip={chip} />
                  ))}
                </div>
              )}
              {poweron !== null && (
                <div data-testid="poweron-status-line" className="flex items-center gap-1.5 text-[13px] font-medium leading-[19px]" style={{ color: TONE_COLORS[poweron.tone].text }}>
                  {(() => {
                    const Icon = ICONS[poweron.icon];
                    return <Icon className="h-4 w-4 shrink-0" aria-hidden={true} />;
                  })()}
                  <span>{poweron.text}</span>
                </div>
              )}
            </div>
          )}
        </GlassCard>

        {/* Emergency outages info link (Facebook): the URL wraps to two lines instead of a dead ellipsis */}
        <GlassCard padding={14}>
          <a
            href="https://www.facebook.com/ztoe.com.ua"
            target="_blank"
            rel="noopener noreferrer"
            title="https://www.facebook.com/ztoe.com.ua"
            className="group flex min-h-12 items-center justify-between gap-2.5 overflow-hidden rounded-[14px] bg-white/[0.08] p-3 transition-colors hover:bg-white/[0.14]"
          >
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#1877F2] text-white shadow-sm">
                <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" aria-label="Facebook">
                  <path d="M15.12 5.32H17V2.14A26.11 26.11 0 0 0 14.26 2c-2.72 0-4.58 1.66-4.58 4.7v2.62H6.61v3.56h3.07V22h3.68v-9.12h3.06l.46-3.56h-3.52V6.65c0-1.05.29-1.73 1.76-1.73Z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="whitespace-normal break-words text-sm font-bold leading-5 text-white transition-colors group-hover:text-[#FF5E3A]">
                  {t.emergencyOutagesLabel}
                </div>
                <div className={`line-clamp-2 break-all font-mono text-[13px] font-normal leading-[19px] ${TEXT_TERTIARY}`}>
                  https://www.facebook.com/ztoe.com.ua
                </div>
              </div>
            </div>
            <ExternalLink className={`h-4 w-4 shrink-0 ${TEXT_TERTIARY}`} aria-hidden="true" />
          </a>
        </GlassCard>

        {/* Blackout schedules on the ZTOE website, at the very bottom */}
        <GlassCard padding={14}>
          <a
            href="https://www.ztoe.com.ua/unhooking-search.php"
            target="_blank"
            rel="noopener noreferrer"
            title="https://www.ztoe.com.ua/unhooking-search.php"
            className="group flex min-h-12 items-center justify-between gap-2.5 overflow-hidden rounded-[14px] bg-white/[0.08] p-3 transition-colors hover:bg-white/[0.14]"
          >
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#FF5E3A] text-white shadow-sm">
                <Zap className="h-5 w-5 fill-current" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="whitespace-normal break-words text-sm font-bold leading-5 text-white transition-colors group-hover:text-[#FF5E3A]">
                  {t.siteSchedulesLabel}
                </div>
                <div className={`line-clamp-2 break-all font-mono text-[13px] font-normal leading-[19px] ${TEXT_TERTIARY}`}>
                  https://www.ztoe.com.ua/unhooking-search.php
                </div>
              </div>
            </div>
            <ExternalLink className={`h-4 w-4 shrink-0 ${TEXT_TERTIARY}`} aria-hidden="true" />
          </a>
        </GlassCard>
      </div>
    </div>
  );
};
