import React, { useMemo, useState } from 'react';
import { Bell, BellOff, RefreshCw, Layers } from 'lucide-react';
import { BlackoutSlot, UserSettings } from '../types';
import { translations } from '../services/i18n';
import type { OutageSnapshot } from '../services/outageRepository';
import { formatSpan, spans } from '../core/outageEngine';
import { hourOf, minuteOf, toLocalDate } from '../core/localTime';
import { DrumBitmap, drumSignature } from './DrumChart';
import { formatHhmm } from './siteStatus';
import { staleChip } from '../services/i18n';

interface WidgetSimulatorProps {
  snapshot: OutageSnapshot;
  settings: UserSettings;
  lang: 'uk' | 'en';
  /** Wall clock for the faux home screen clock (the widgets themselves use snapshot.now). */
  now?: Date;
  onToggleNotifications: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onOpenApp: () => void;
  /** Initial gallery selection. */
  initialSize?: WidgetSize;
}

export type WidgetSize = '2x1' | '3x2' | '4x1' | 'all';

/** Everything the three widget layouts show, derived from one OutageSnapshot (port of BlackoutGlanceWidget.buildWidgetModel). */
export interface WidgetModel {
  queueHeader: string;
  isUnclear: boolean;
  isOffNow: boolean;
  countdown: string;
  /** Current outage when off, otherwise the next one: full "HH:mm – HH:mm" (end may be past midnight). */
  period: string;
  nextOutage: string;
  /** The 48 half-hour cells of today (empty when unclear): the same states the main timeline draws. */
  slots: BlackoutSlot[];
  nowHour: number;
  nowMinute: number;
  /** Small "data from HH:mm" caption when the cached schedule is shown because the site failed. */
  staleCaption: string | null;
}

/** "HHг. MMхв." (uk) / "HHhr. MMm." (en); no seconds. */
export function formatWidgetCountdown(raw: string, lang: 'uk' | 'en'): string {
  const matches = raw.match(/(\d{1,2}|--)/g) ?? [];
  if (matches.length >= 2) {
    const m0 = matches[0] ?? '--';
    const m1 = matches[1] ?? '--';
    const hh = m0 === '--' ? '--' : m0.padStart(2, '0');
    const mm = m1 === '--' ? '--' : m1.padStart(2, '0');
    return lang === 'en' ? `${hh}hr. ${mm}m.` : `${hh}г. ${mm}хв.`;
  }
  return raw;
}

export function buildWidgetModel(settings: UserSettings, snapshot: OutageSnapshot, lang: 'uk' | 'en'): WidgetModel {
  const t = translations[lang];
  const now = snapshot.now;
  const nowHour = hourOf(now);
  const nowMinute = minuteOf(now);
  const queue = settings.queue || '';
  const noQueueHouse = Boolean(settings.customQueueStatusText && settings.customQueueStatusText.trim() !== '');
  const queueHeader = noQueueHouse
    ? lang === 'uk' ? 'Черга відсутня' : 'No queue'
    : queue.trim() === ''
    ? lang === 'uk' ? 'Черга —' : 'Queue —'
    : `${t.queue} ${queue}`;
  const notConfigured = queue.trim() === '' && !noQueueHouse && !snapshot.hasAddress;
  if (notConfigured || snapshot.isUnclear) {
    return {
      queueHeader,
      isUnclear: true,
      isOffNow: false,
      countdown: formatWidgetCountdown('--:--:--', lang),
      period: '--:-- - --:--',
      nextOutage: '--:-- - --:--',
      slots: [],
      nowHour,
      nowMinute,
      staleCaption: null,
    };
  }

  const st = snapshot.status();
  const period = !st.isOffNow && st.nextSpan === null ? t.widgetNoOutages : st.nextSlotTime;
  // The next outage after the current moment, from the same merged spans the countdown uses
  const next = spans(snapshot.outages.filter((o) => !o.stale)).find((sp) => sp.start > now) ?? null;
  const nextText =
    next === null
      ? t.widgetNoMoreOutages
      : toLocalDate(next.start) === snapshot.today
      ? formatSpan(next)
      : `${t.widgetTomorrowPrefix} ${formatSpan(next)}`;
  const staleCaption = snapshot.isStale && snapshot.site?.lastSuccessMs ? staleChip(lang, formatHhmm(snapshot.site.lastSuccessMs)) : null;
  return {
    queueHeader,
    isUnclear: false,
    isOffNow: st.isOffNow,
    countdown: formatWidgetCountdown(st.countdownText, lang),
    period,
    nextOutage: nextText,
    slots: snapshot.slotsFor(snapshot.today),
    nowHour,
    nowMinute,
    staleCaption,
  };
}

const RoundButton: React.FC<{
  onClick: () => void;
  title: string;
  active?: boolean;
  children: React.ReactNode;
  testId?: string;
  pressed?: boolean;
}> = ({ onClick, title, active = false, children, testId, pressed }) => (
  <button
    type="button"
    data-testid={testId}
    aria-label={title}
    aria-pressed={pressed}
    title={title}
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    className={`flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border backdrop-blur-xl transition-colors ${
      active ? 'border-white bg-white text-[#FF5E3A] shadow-lg shadow-black/20' : 'border-white/20 bg-white/15 text-white hover:bg-white/25'
    }`}
  >
    {children}
  </button>
);

export const WidgetSimulator: React.FC<WidgetSimulatorProps> = ({
  snapshot,
  settings,
  lang,
  now = new Date(),
  onToggleNotifications,
  onRefresh,
  isRefreshing = false,
  onOpenApp,
  initialSize = 'all',
}) => {
  const t = translations[lang];
  const isUk = lang === 'uk';
  const [widgetSize, setWidgetSize] = useState<WidgetSize>(initialSize);

  const model = useMemo(() => buildWidgetModel(settings, snapshot, lang), [settings, snapshot, lang]);
  const signature = useMemo(() => drumSignature(model.slots), [model.slots]);

  const statusLabel = model.isUnclear ? t.statusUnclear : model.isOffNow ? (isUk ? 'СВІТЛА НЕМАЄ' : 'POWER OFF') : isUk ? 'СВІТЛО Є' : 'POWER ON';
  const statusColorClass = model.isUnclear ? 'text-[#9CA3AF]' : model.isOffNow ? 'text-[#FF5E3A]' : 'text-[#34D399]';
  const countdownLabel = !model.isUnclear && model.isOffNow ? (isUk ? 'До увімкнення:' : 'Power on in:') : isUk ? 'До відключення:' : 'Time to blackout:';
  const periodLabel = isUk ? 'Період' : 'Period';
  const nextBlackoutLabel = isUk ? 'Наступне відключення' : 'Next blackout';
  const nowStr = `${String(model.nowHour).padStart(2, '0')}:${String(model.nowMinute).padStart(2, '0')}`;
  const stripDescription = model.isUnclear ? t.outagesUnclear : `${model.queueHeader}. ${model.isOffNow ? (isUk ? 'СВІТЛА НЕМАЄ' : 'POWER OFF') : isUk ? 'СВІТЛО Є' : 'POWER ON'}`;

  // the bell shows and toggles the master switch for all addresses (owner decision 4)
  const alertsOn = settings.alertsMaster ?? settings.notificationsEnabled;
  const refreshTitle = t.refreshBtn;
  const toggleTitle = alertsOn ? (isUk ? 'Вимкнути сповіщення' : 'Mute alerts') : isUk ? 'Увімкнути сповіщення' : 'Enable alerts';

  const buttons = (
    <div className="flex items-center gap-2">
      <RoundButton testId="widget-refresh" onClick={() => onRefresh?.()} title={refreshTitle}>
        <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
      </RoundButton>
      <RoundButton testId="widget-toggle-alerts" onClick={onToggleNotifications} title={toggleTitle} active={alertsOn} pressed={alertsOn}>
        {alertsOn ? <Bell className="h-4 w-4 fill-current" aria-hidden="true" /> : <BellOff className="h-4 w-4 stroke-[2]" aria-hidden="true" />}
      </RoundButton>
    </div>
  );

  const small = (
    <div key="small" data-testid="widget-small" className="flex flex-col gap-1.5">
      <div className="text-center text-xs font-semibold text-sky-200/80">{t.widgetSmallName}</div>
      <div
        role="button"
        tabIndex={0}
        onClick={onOpenApp}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpenApp()}
        aria-label={`${model.queueHeader}. ${statusLabel}. ${countdownLabel} ${model.countdown}`}
        className="w-full max-w-[340px] cursor-pointer rounded-3xl border border-white/25 bg-[#141A29]/80 p-4 text-white shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl transition-colors hover:border-white/40"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-base font-bold tracking-tight text-white">{model.queueHeader}</span>
          <span data-testid="widget-small-status" className={`text-xs font-bold ${statusColorClass}`}>
            {statusLabel}
          </span>
        </div>
        <div className="flex items-center justify-between border-t border-white/15 pt-2.5">
          <div className="min-w-0 pr-2">
            <div className="text-xs font-semibold leading-tight text-[#BAE6FD]/80">{countdownLabel}</div>
            <div data-testid="widget-small-countdown" className="whitespace-nowrap font-mono text-base font-black text-white">
              {model.countdown}
            </div>
          </div>
          {buttons}
        </div>
      </div>
    </div>
  );

  const big = (
    <div key="big" data-testid="widget-big" className="flex flex-col gap-1.5">
      <div className="text-center text-xs font-semibold text-sky-200/80">{t.widgetBigName}</div>
      <div
        role="button"
        tabIndex={0}
        onClick={onOpenApp}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpenApp()}
        aria-label={`${model.queueHeader}. ${statusLabel}`}
        className="flex w-full max-w-[360px] cursor-pointer flex-col gap-3 rounded-3xl border border-white/25 bg-[#141A29]/80 p-5 text-white shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl transition-colors hover:border-white/40"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-lg font-bold tracking-tight text-white">{model.queueHeader}</span>
            <div className="flex items-center gap-1.5">
              <span data-testid="widget-big-status" className={`shrink-0 whitespace-nowrap text-xs font-bold ${statusColorClass}`}>
                {statusLabel}
              </span>
              {model.staleCaption && (
                <span data-testid="widget-stale-caption" className="truncate text-xs font-medium text-[#FFB020]">
                  {model.staleCaption}
                </span>
              )}
            </div>
          </div>
          {buttons}
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 p-3 backdrop-blur-md">
          <div>
            <div className="text-xs font-semibold text-[#BAE6FD]/80">{countdownLabel}</div>
            <div data-testid="widget-big-countdown" className="whitespace-nowrap font-mono text-xl font-black text-white">
              {model.countdown}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-[#BAE6FD]/80">{periodLabel}</div>
            <div className="font-mono text-sm font-bold text-white">{model.period}</div>
          </div>
        </div>

        {/* 24-hour drum chart: 720 x 132 bitmap drawn 52 px high like Glance FillBounds (the strip widget uses the same) */}
        <DrumBitmap
          testId="widget-big-drum"
          slots={model.slots}
          currentHour={model.nowHour}
          currentMinute={model.nowMinute}
          lang={lang}
          height={132}
          fill
          className="h-[52px]"
          label={model.isUnclear ? t.outagesUnclear : isUk ? '24-годинний графік відключень' : '24-hour outage chart'}
        />

        <div className="flex items-center justify-between rounded-lg bg-black/25 px-2 py-1 font-mono text-sm">
          <span className="font-bold text-white">{model.nextOutage}</span>
          <span className="font-sans text-xs font-bold text-[#FF5E3A]">{nextBlackoutLabel}</span>
        </div>
      </div>
    </div>
  );

  // Third widget (4x1): only the drum chart with the black needle. No text, buttons or switches; a tap opens the app.
  const strip = (
    <div key="strip" data-testid="widget-strip" className="flex flex-col gap-1.5">
      <div className="text-center text-xs font-semibold text-sky-200/80">{t.widgetStripName}</div>
      <div
        role="button"
        tabIndex={0}
        onClick={onOpenApp}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpenApp()}
        aria-label={stripDescription}
        className="flex w-full max-w-[360px] cursor-pointer items-center rounded-[20px] border border-white/25 bg-[#141A29]/80 p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl transition-colors hover:border-white/40"
      >
        {/* Same drum as the big widget: 720 x 132 bitmap drawn 52 px high */}
        <DrumBitmap
          testId="widget-strip-drum"
          slots={model.slots}
          currentHour={model.nowHour}
          currentMinute={model.nowMinute}
          lang={lang}
          height={132}
          fill
          className="h-[52px]"
          label={stripDescription}
        />
      </div>
    </div>
  );

  const sizes: { id: WidgetSize; label: string }[] = [
    { id: '2x1', label: t.widgetSize2x1 },
    { id: '3x2', label: t.widgetSize3x2 },
    { id: '4x1', label: t.widgetSize4x1 },
    { id: 'all', label: t.widgetSizeAll },
  ];

  return (
    <div className="mx-auto flex max-w-lg select-none flex-col gap-4" data-widget-signature={signature}>
      {/* Header & size switcher */}
      <div className="flex flex-col gap-3 rounded-2xl border border-white/15 bg-[#141A29]/75 p-4 shadow-xl backdrop-blur-2xl">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#FF5E3A]" aria-hidden="true" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-white">{t.widgetPreviewTitle}</h2>
          </div>
          <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-0.5 font-mono text-xs text-sky-200">
            {isUk ? 'Віджет Android Glance' : 'Android Glance Widget'}
          </span>
        </div>

        <div role="radiogroup" aria-label={t.widgetPreviewTitle} className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-black/30 p-1 sm:grid-cols-4">
          {sizes.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={widgetSize === s.id}
              data-testid={`widget-size-${s.id}`}
              onClick={() => setWidgetSize(s.id)}
              className={`min-h-11 cursor-pointer rounded-lg px-2 py-2 text-xs font-bold leading-tight transition-colors ${
                widgetSize === s.id ? 'bg-white text-black shadow-md' : 'text-sky-200/70 hover:text-white'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Simulated Android wallpaper with the widgets */}
      <div className="relative flex min-h-[400px] flex-col items-center justify-center gap-5 overflow-hidden rounded-3xl border border-white/15 bg-[#0A0D14] p-6 shadow-2xl">
        <div className="pointer-events-none absolute top-1/4 -left-16 h-64 w-64 rounded-full bg-blue-600/35 blur-3xl" />
        <div className="pointer-events-none absolute right-0 -bottom-10 h-80 w-80 rounded-full bg-sky-500/30 blur-3xl" />
        <div className="pointer-events-none absolute top-1/2 left-1/4 h-48 w-48 rounded-full bg-cyan-400/25 blur-3xl" />

        {/* Ambient clock in strict 24-hour format */}
        <div className="pointer-events-none z-10 text-center">
          <div className="font-sans text-4xl font-light tracking-widest text-white drop-shadow-lg">{nowStr}</div>
          <div className="mt-0.5 text-xs font-medium text-sky-200/80">
            {now.toLocaleDateString(isUk ? 'uk-UA' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
        </div>

        <div className="z-10 flex w-full flex-col items-center gap-5">
          {(widgetSize === '2x1' || widgetSize === 'all') && small}
          {(widgetSize === '3x2' || widgetSize === 'all') && big}
          {(widgetSize === '4x1' || widgetSize === 'all') && strip}
        </div>
      </div>
    </div>
  );
};
