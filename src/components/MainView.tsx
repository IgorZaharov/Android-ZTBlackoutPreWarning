import React, { useState, useMemo, useEffect } from 'react';
import { 
  Bell, 
  BellOff, 
  RefreshCw, 
  Clock,
  Zap,
  ExternalLink
} from 'lucide-react';
import { DaySchedule, Language, UserSettings } from '../types';
import {
  applyEmergencyOutageToSchedule,
  calculateOutageCountdown,
  getBlackoutIntervals,
  getChartHalfHourBlocks
} from '../services/ztoeParser';
import { isValidEmergencyOutage } from '../services/ztoeAddressLookup';
import { translations } from '../services/i18n';

interface MainViewProps {
  schedule: DaySchedule;
  tomorrowSchedule: DaySchedule | null;
  settings: UserSettings;
  lang: 'uk' | 'en';
  now?: Date;
  onToggleNotifications: () => void;
  onRefresh: () => Promise<'SUCCESS' | 'NO_INTERNET' | 'NO_QUEUES_FOUND' | void> | void;
  isRefreshing: boolean;
  onSendTestAlert: () => void;
  onOpenQueueSelection?: () => void;
  onChangeLanguage?: (lang: Language) => void;
}

export const MainView: React.FC<MainViewProps> = ({
  schedule,
  tomorrowSchedule,
  settings,
  lang,
  now = new Date(),
  onToggleNotifications,
  onRefresh,
  isRefreshing,
  onOpenQueueSelection,
  onChangeLanguage,
}) => {
  const t = translations[lang];
  const [selectedDayTab, setSelectedDayTab] = useState<'today' | 'tomorrow'>('today');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const hasActiveEmergencyOutage = isValidEmergencyOutage(settings.activeEmergencyOutage);
  const hasNoQueueMessage = Boolean(
    settings.customQueueStatusText &&
      (!settings.queue || settings.queue.trim() === '') &&
      !hasActiveEmergencyOutage
  );
  const isQueueUnselected =
    (!settings.queue || settings.queue.trim() === '') &&
    !hasNoQueueMessage &&
    !hasActiveEmergencyOutage;

  const effectiveTodaySchedule = useMemo(
    () => applyEmergencyOutageToSchedule(schedule, settings.activeEmergencyOutage, false) || schedule,
    [schedule, settings.activeEmergencyOutage]
  );

  const effectiveTomorrowSchedule = useMemo(
    () => applyEmergencyOutageToSchedule(tomorrowSchedule, settings.activeEmergencyOutage, true),
    [tomorrowSchedule, settings.activeEmergencyOutage]
  );

  useEffect(() => {
    if (!effectiveTomorrowSchedule && selectedDayTab === 'tomorrow') {
      setSelectedDayTab('today');
    }
  }, [effectiveTomorrowSchedule, selectedDayTab]);

  const [entryTick, setEntryTick] = useState(0);

  // Automatically refresh timer and drum bar when User enters main screen
  useEffect(() => {
    setEntryTick((prev) => prev + 1);
  }, []);

  const isTomorrowActive = selectedDayTab === 'tomorrow' && effectiveTomorrowSchedule !== null;
  const activeSchedule = isTomorrowActive ? effectiveTomorrowSchedule! : effectiveTodaySchedule;
  const activeSlotsSignature = useMemo(
    () => activeSchedule.slots.map(s => (s.isEmergency ? 'E' : s.status === 'POWER_OFF' ? '1' : '0')).join(''),
    [activeSchedule]
  );

  const blackoutIntervals = useMemo(
    () => getBlackoutIntervals(activeSchedule.slots),
    [selectedDayTab, activeSchedule.dateStr, activeSlotsSignature, activeSchedule.slots, entryTick]
  );

  const chartBlocks = useMemo(
    () => getChartHalfHourBlocks(activeSchedule.slots),
    [selectedDayTab, activeSchedule.dateStr, activeSlotsSignature, activeSchedule.slots, entryTick]
  );

  const countdown = useMemo(
    () => calculateOutageCountdown(effectiveTodaySchedule, now, effectiveTomorrowSchedule),
    [effectiveTodaySchedule, now, effectiveTomorrowSchedule, entryTick]
  );

  const isUnclear =
    isQueueUnselected ||
    hasNoQueueMessage ||
    activeSchedule.slots.length === 0 ||
    Boolean(activeSchedule.isUnclear);
  const isStatusUnclear =
    isQueueUnselected ||
    hasNoQueueMessage ||
    effectiveTodaySchedule.slots.length === 0 ||
    Boolean(effectiveTodaySchedule.isUnclear) ||
    Boolean(countdown.isUnclear);

  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  const format24Time = (d: Date): string => {
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const formatAddressAfterCity = (address: string): string => {
    if (address.includes('\n')) return address;
    const parts = address
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length >= 3) {
      return `${parts.slice(0, 2).join(', ')},\n${parts.slice(2).join(', ')}`;
    }
    return address;
  };

  const nextRefreshTimeStr = useMemo((): string => {
    try {
      const parts = (activeSchedule.lastUpdated || '').split(':');
      if (parts.length >= 2) {
        const lastH = parseInt(parts[0], 10);
        const lastM = parseInt(parts[1], 10);
        const lastTotalM = lastH * 60 + lastM;
        const nextTotalM = (lastTotalM + settings.refreshIntervalMinutes) % 1440;
        const nH = Math.floor(nextTotalM / 60);
        const nM = nextTotalM % 60;
        return `${nH.toString().padStart(2, '0')}:${nM.toString().padStart(2, '0')}`;
      }
    } catch {
      // fallback
    }
    const nextDate = new Date(Date.now() + settings.refreshIntervalMinutes * 60000);
    return format24Time(nextDate);
  }, [activeSchedule.lastUpdated, settings.refreshIntervalMinutes]);

  const handleManualRefresh = async () => {
    const status = await onRefresh();
    let msg = t.refreshSuccessToast;
    if (status === 'NO_INTERNET') {
      msg = t.errorNoInternet;
    } else if (status === 'NO_QUEUES_FOUND') {
      msg = t.errorNoQueuesFound;
    }
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="flex flex-col gap-4 max-w-lg mx-auto select-none">
      {/* In-App Toast Banner with Application Icon */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-[#141A29]/95 backdrop-blur-2xl text-white text-xs py-2 px-4 rounded-2xl shadow-2xl flex items-center gap-2.5 border border-white/20">
          <div className="w-6 h-6 rounded-lg bg-[#FF5E3A] flex items-center justify-center text-white shrink-0">
            <Zap className="w-3.5 h-3.5 fill-current" />
          </div>
          <span className="font-bold">{toastMessage}</span>
        </div>
      )}

      {/* First application start: Full-screen overlay with centered, enlarged "Select queue" button and Auto/English/Ukrainian language switch blocking all other clicks */}
      {isQueueUnselected && (
        <div
          data-testid="first-start-select-queue-overlay"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 px-6 pointer-events-auto"
        >
          <button
            type="button"
            data-testid="unselected-queue-header-btn"
            onClick={onOpenQueueSelection}
            className="group cursor-pointer px-8 py-5 rounded-3xl bg-[#FF5E3A] hover:bg-[#ff4b24] text-white shadow-[0_20px_50px_rgba(255,94,58,0.5)] border border-white/25 transition-all active:scale-95 text-center flex flex-col items-center justify-center gap-1.5 min-w-[260px]"
          >
            <div className="text-2xl font-extrabold tracking-tight text-white drop-shadow-sm">
              {lang === 'uk' ? 'Виберіть чергу' : 'Select queue'}
            </div>
            <div className="text-xs text-white/90 font-semibold">
              Житомиробленерго (ZTOE)
            </div>
          </button>

          <div
            data-testid="first-start-language-switch"
            role="tablist"
            className="grid grid-cols-3 gap-1 p-1.5 bg-[#141A29]/90 backdrop-blur-2xl rounded-2xl border border-white/20 shadow-[0_12px_32px_rgba(0,0,0,0.5)] min-w-[260px]"
          >
            {[
              { id: 'system', label: 'Auto' },
              { id: 'en', label: 'English' },
              { id: 'uk', label: 'Українська' }
            ].map((item) => {
              const currentLangSetting = settings.language || 'system';
              const isSelected = currentLangSetting === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  data-testid={`first-start-lang-${item.id}`}
                  aria-selected={isSelected}
                  onClick={() => onChangeLanguage?.(item.id as Language)}
                  className={`py-2 px-3 text-xs leading-tight text-center flex items-center justify-center font-bold rounded-xl transition-all duration-150 cursor-pointer ${
                    isSelected
                      ? 'bg-white text-black shadow-[0_2px_6px_rgba(0,0,0,0.3)]'
                      : 'text-sky-100/80 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Top Header: Queue title (or empty if queue is unselected or house has no queue) + Sleek pill toggle switch */}
      <div className="flex items-center justify-between pt-1">
        {isQueueUnselected || hasNoQueueMessage || !settings.queue || settings.queue.trim() === '' ? (
          <div data-testid="empty-queue-header" className="min-h-[44px]" />
        ) : (
          <div>
            <div className="text-2xl font-bold tracking-tight text-white drop-shadow-sm">
              {t.queue} {settings.queue}
            </div>
            <div className="text-xs text-sky-200/70 font-medium whitespace-pre-line leading-snug">
              {settings.selectedAddress
                ? formatAddressAfterCity(settings.selectedAddress)
                : 'Житомиробленерго (ZTOE)'}
            </div>
          </div>
        )}

        {/* Enlarged Pill Switch (No text ВКЛ/ВИКЛ) — dimmed when queue is not selected */}
        <button
          onClick={onToggleNotifications}
          disabled={isQueueUnselected}
          className={`w-16 h-9 rounded-full p-1 transition-all duration-300 flex items-center shadow-lg ${
            isQueueUnselected ? 'opacity-15 brightness-50 pointer-events-none select-none' : ''
          } ${
            settings.notificationsEnabled
              ? 'bg-[#FF5E3A] shadow-[#FF5E3A]/30'
              : 'bg-white/10 backdrop-blur-md border border-white/15'
          }`}
          title={t.quickToggleAlerts}
        >
          <div
            className={`w-7 h-7 rounded-full bg-white shadow-md flex items-center justify-center transition-transform duration-300 ${
              settings.notificationsEnabled ? 'translate-x-7' : 'translate-x-0'
            }`}
          >
            {settings.notificationsEnabled ? (
              <Bell className="w-4 h-4 text-[#FF5E3A] stroke-[2.5]" />
            ) : (
              <BellOff className="w-4 h-4 text-zinc-500 stroke-[2]" />
            )}
          </div>
        </button>
      </div>

      {/* All other UI elements dimmed when Queue is not selected */}
      <div
        data-testid="main-dimmed-content-wrapper"
        className={`flex flex-col gap-4 transition-opacity duration-300 ${
          isQueueUnselected ? 'opacity-15 brightness-50 pointer-events-none select-none' : ''
        }`}
      >
      {/* Active Emergency Outage ("Аварійне відключення") Banner with Start & Estimated Restore Times */}
      {!isQueueUnselected && hasActiveEmergencyOutage && settings.activeEmergencyOutage && (
        <div
          data-testid="main-emergency-outage-banner"
          className="bg-[#141A29]/75 backdrop-blur-2xl rounded-3xl p-4 border border-white/15 shadow-[0_8px_28px_rgba(0,0,0,0.4)] flex flex-col gap-1.5"
        >
          <div
            data-testid="main-emergency-outage-title"
            className="text-sm font-bold text-[#FF5E3A] leading-snug"
          >
            {lang === 'uk'
              ? settings.activeEmergencyOutage.outageType || 'Аварійне відключення'
              : 'Emergency Outage'}
          </div>
          <div
            data-testid="main-emergency-outage-times"
            className="flex flex-col gap-0.5 text-xs text-white font-mono tabular-nums leading-snug"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sky-200/70 font-sans font-medium">
                {lang === 'uk' ? 'Початок: ' : 'Start: '}
              </span>
              <span className="font-bold text-right">{settings.activeEmergencyOutage.startTime || '--:--'}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sky-200/70 font-sans font-medium">
                {lang === 'uk' ? 'Орієнтовне відновлення: ' : 'Estimated restore: '}
              </span>
              <span className="font-bold text-right">
                {settings.activeEmergencyOutage.estimatedRestoreTime || '--:--'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Custom ZTOE Queue/House Status Message Bar — exact same style/color as other Main screen bars */}
      {!isQueueUnselected && settings.customQueueStatusText && (
        <div
          data-testid="main-custom-queue-status-text"
          className="bg-[#141A29]/75 backdrop-blur-2xl rounded-3xl p-4 border border-white/15 shadow-[0_8px_28px_rgba(0,0,0,0.4)] flex flex-col gap-1"
        >
          {settings.selectedAddress && (
            <div
              data-testid="main-selected-address-text"
              className="text-xs text-sky-200/70 font-medium whitespace-pre-line leading-snug"
            >
              {formatAddressAfterCity(settings.selectedAddress)}
            </div>
          )}
          <div className="text-sm font-bold text-white leading-snug whitespace-normal break-words">
            {settings.customQueueStatusText}
          </div>
        </div>
      )}

      {/* Hero Outage Status Card (Frosted Glass with Subtle Blue Glow) */}
      <div
        data-testid="main-counter-card"
        className="rounded-3xl p-5 bg-[#141A29]/75 backdrop-blur-2xl border border-white/15 shadow-[0_8px_28px_rgba(0,0,0,0.4)] transition-all"
      >
        {hasNoQueueMessage ? (
          <div data-testid="main-counter-empty" className="my-4 text-center">
            <div
              data-testid="main-counter-no-queue-placeholder"
              className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-white drop-shadow-md"
            >
              --:--:--
            </div>
          </div>
        ) : (
          <>
            {/* Status Line */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span
                  data-testid="power-status-indicator"
                  className={`w-3 h-3 rounded-full ${
                    isStatusUnclear
                      ? 'bg-zinc-400 shadow-md shadow-zinc-400/40'
                      : countdown.isCurrentlyBlackout
                      ? 'bg-[#FF5E3A] shadow-md shadow-[#FF5E3A]/60 animate-pulse'
                      : 'bg-emerald-400 shadow-md shadow-emerald-400/40'
                  }`}
                />
                <span
                  data-testid="power-status-text"
                  className="text-sm font-bold tracking-wide uppercase text-white"
                >
                  {isStatusUnclear
                    ? t.statusUnclear
                    : countdown.isCurrentlyBlackout
                    ? (lang === 'uk' ? 'Зараз немає світла' : 'Power is OFF')
                    : (lang === 'uk' ? 'Зараз світло є' : 'Power is ON')}
                </span>
              </div>

              <div className="text-xs font-mono text-sky-200/80 flex items-center gap-1.5 font-bold">
                <Clock className="w-3.5 h-3.5" />
                <span>{format24Time(now)}</span>
              </div>
            </div>

            {/* Big Countdown Digits */}
            <div className="my-4 text-center">
              <div className="text-xs uppercase tracking-wider text-sky-200/70 font-semibold mb-1">
                {isStatusUnclear
                  ? (lang === 'uk' ? 'До відключення залишилось:' : 'Time until next outage:')
                  : countdown.isCurrentlyBlackout
                  ? (lang === 'uk' ? 'Світло увімкнуть через:' : 'Power on in:')
                  : countdown.closestBlackoutSlot
                  ? (lang === 'uk' ? 'До відключення залишилось:' : 'Time until next outage:')
                  : (lang === 'uk' ? 'Відключень більше немає' : 'No more blackouts today')}
              </div>
              <div className="text-5xl font-black font-mono tracking-tight text-white drop-shadow-md">
                {isStatusUnclear ? '--:--:--' : countdown.formattedTimeLeft}
              </div>
            </div>

            {/* Outage Window */}
            {countdown.slotDescription && countdown.slotDescription !== 'Відключень немає' && (
              <div className="mt-4 pt-3.5 border-t border-white/10 flex items-center justify-between text-sm">
                <span className="text-sky-200/70">
                  {!isStatusUnclear && countdown.isCurrentlyBlackout 
                    ? (lang === 'uk' ? 'Період відключення:' : 'Outage period:') 
                    : (lang === 'uk' ? 'Найближчий період:' : 'Next period:')}
                </span>
                <span
                  data-testid="next-period-value"
                  className="text-base font-bold text-white font-mono bg-white/10 backdrop-blur-md px-3 py-1 rounded-xl border border-white/15"
                >
                  {isStatusUnclear ? '--:-- - --:--' : countdown.slotDescription}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Day Selector (Today / Tomorrow if Tomorrow table exists on site; otherwise centered Today button) */}
      {effectiveTomorrowSchedule ? (
        <div className="flex gap-2 p-1.5 bg-[#141A29]/70 backdrop-blur-xl rounded-2xl border border-white/10">
          <button
            onClick={() => setSelectedDayTab('today')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition-all ${
              selectedDayTab === 'today'
                ? 'bg-white/20 text-white shadow-md border border-white/20 backdrop-blur-md'
                : 'text-sky-200/60 hover:text-white'
            }`}
          >
            {t.today}
          </button>
          <button
            onClick={() => setSelectedDayTab('tomorrow')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition-all ${
              selectedDayTab === 'tomorrow'
                ? 'bg-white/20 text-white shadow-md border border-white/20 backdrop-blur-md'
                : 'text-sky-200/60 hover:text-white'
            }`}
          >
            {t.tomorrow}
          </button>
        </div>
      ) : (
        <div className="flex justify-center">
          <div className="py-2.5 px-6 bg-[#141A29]/80 backdrop-blur-xl rounded-2xl border border-white/15 text-sm font-bold text-white shadow-md">
            {t.today}
          </div>
        </div>
      )}

      {/* Schedule Card with 24h Timeline */}
      <div className="bg-[#141A29]/75 backdrop-blur-2xl rounded-3xl p-5 border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.45)] flex flex-col gap-4">
        
        {/* Inner 24h Timeline Graph & Needle styled after classic analog electricity meter (САЗУ-ИТ) */}
        <div className="bg-gradient-to-b from-[#DFDDD0] via-[#D4D1C1] to-[#C6C2B0] border-2 border-[#7A7768] shadow-[inset_0_2px_5px_rgba(0,0,0,0.3)] rounded-2xl px-3 pt-4 pb-3 select-none flex flex-col">
          
          {/* 24-hour block row with recessed metallic drum bezel and stamped tick marks */}
          <div className="relative w-full pb-6">
            
            {/* Recessed metallic counter drum slot */}
            <div className="bg-[#4E514E] p-1.5 rounded-lg border-2 border-[#6E716B] shadow-[inset_0_3px_6px_rgba(0,0,0,0.85)]">
              {isUnclear && !hasNoQueueMessage ? (
                <div
                  data-testid="drum-chart-unclear"
                  className="relative flex w-full h-8 items-center justify-center bg-gradient-to-b from-[#7E8287] via-[#94989E] to-[#6E7277] rounded-[2px] overflow-visible"
                >
                  <span className="text-xs font-extrabold tracking-wide text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] z-10">
                    {t.outagesUnclear}
                  </span>
                  {selectedDayTab === 'today' && (
                    <div
                      className="absolute -top-3 -bottom-3 w-[3px] bg-[#0B0B0A] rounded-full shadow-[0_0_2px_rgba(255,255,255,0.9)] pointer-events-none z-20 -translate-x-1/2"
                      style={{ left: `${((currentHour * 60 + currentMinute) / 1440) * 100}%` }}
                    />
                  )}
                </div>
              ) : (
                /* The 24 hours with 1-2px light gray hour separators and no half-hour separators */
                <div
                  data-testid={hasNoQueueMessage ? 'drum-chart-no-outage-light' : undefined}
                  className="flex w-full items-center justify-between gap-[1.5px] bg-[#C8C6BC] rounded-[2px] overflow-visible"
                >
                  {chartBlocks.map(({ hour: h, half1Off, half2Off }) => {
                    const hStr = h.toString().padStart(2, '0');
                    const nextHStr = (h + 1 === 24 ? 24 : h + 1).toString().padStart(2, '0');
                    const isCurrentHour = selectedDayTab === 'today' && h === currentHour;

                    return (
                      <div
                        key={`${selectedDayTab}_hour_${h}`}
                        className="relative flex-1"
                      >
                        {/* Two 30-min vertical drum blocks with no half-hour separator */}
                        <div className="flex w-full items-center gap-0">
                          {/* 00 - 30 */}
                          <div
                            className={`flex-1 h-8 transition-colors cursor-pointer ${
                              half1Off 
                                ? 'bg-gradient-to-b from-[#9E1E18] via-[#D62E26] to-[#8C1914]' 
                                : 'bg-gradient-to-b from-[#D8D6CC] via-[#FCFBF7] to-[#CCC9BE]'
                            }`}
                            title={`${hStr}:00 – ${hStr}:30: ${half1Off ? 'Немає світла (відключення)' : 'Світло є'}`}
                          />
                          {/* 30 - 60 */}
                          <div
                            className={`flex-1 h-8 transition-colors cursor-pointer ${
                              half2Off 
                                ? 'bg-gradient-to-b from-[#9E1E18] via-[#D62E26] to-[#8C1914]' 
                                : 'bg-gradient-to-b from-[#D8D6CC] via-[#FCFBF7] to-[#CCC9BE]'
                            }`}
                            title={`${hStr}:30 – ${nextHStr}:00: ${half2Off ? 'Немає світла (відключення)' : 'Світло є'}`}
                          />
                        </div>

                        {/* Exact Current Time Position (black needle protruding 4px above and below dark-grey contour) */}
                        {isCurrentHour && (
                          <div
                            className="absolute -top-3 -bottom-3 w-[3px] bg-[#0B0B0A] rounded-full shadow-[0_0_2px_rgba(255,255,255,0.9)] pointer-events-none z-20 -translate-x-1/2"
                            style={{ left: `${(currentMinute / 60) * 100}%` }}
                          />
                        )}

                        {/* Stamped black tick mark and hour label at the left boundary of every even hour (00, 02..22) */}
                        {h % 2 === 0 && (
                          <div className="absolute top-[46px] left-0 -translate-x-1/2 flex flex-col items-center pointer-events-none z-10">
                            <div className="w-[1.5px] h-[5px] bg-[#1C1B18]" />
                            <span className="text-[10px] sm:text-[11px] font-mono text-[#1C1B18] font-bold mt-0.5 leading-none">
                              {hStr}
                            </span>
                          </div>
                        )}

                        {/* Stamped black tick mark and label 24 at the right boundary of hour 23 */}
                        {h === 23 && (
                          <div className="absolute top-[46px] right-0 translate-x-1/2 flex flex-col items-center pointer-events-none z-10">
                            <div className="w-[1.5px] h-[5px] bg-[#1C1B18]" />
                            <span className="text-[10px] sm:text-[11px] font-mono text-[#1C1B18] font-bold mt-0.5 leading-none">
                              24
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {isUnclear && !hasNoQueueMessage && (
              <div className="flex justify-between text-[10px] sm:text-[11px] font-mono text-[#1C1B18] font-bold mt-1.5 px-0.5">
                {['00', '02', '04', '06', '08', '10', '12', '14', '16', '18', '20', '22', '24'].map((lbl) => (
                  <span key={lbl}>{lbl}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Clear List of Outage Hours for this day (removed when outages are unclear or house has no queue) */}
        {!isUnclear && !hasNoQueueMessage && (
          <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
            <div className="text-xs font-bold text-sky-200/70 uppercase tracking-wider">
              {selectedDayTab === 'tomorrow'
                ? lang === 'uk'
                  ? 'Години відключень на завтра:'
                  : 'Blackout hours for tomorrow:'
                : lang === 'uk'
                ? 'Години відключень на сьогодні:'
                : 'Blackout hours for today:'}
            </div>

            {blackoutIntervals.length > 0 ? (
              <div className="flex flex-col gap-2">
                {blackoutIntervals.map((interval, idx) => (
                  <div
                    key={`${selectedDayTab}_${interval.start}_${interval.end}_${idx}`}
                    data-testid={interval.isEmergency ? 'blackout-interval-row-emergency' : 'blackout-interval-row'}
                    className="flex items-center justify-between p-3 rounded-xl bg-white/[0.06] backdrop-blur-md border border-white/10"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        data-testid="blackout-interval-indicator-slot"
                        className="w-5 h-5 flex items-center justify-center shrink-0"
                      >
                        {interval.isEmergency ? (
                          <span
                            data-testid="blackout-interval-emergency-icon"
                            className="w-5 h-5 rounded-full border-2 border-[#FF5E3A] bg-[#FF5E3A]/20 text-[#FF5E3A] font-black text-xs leading-none flex items-center justify-center shadow-[0_0_8px_rgba(255,94,58,0.45)] shrink-0"
                            title={lang === 'uk' ? 'Аварійне відключення' : 'Emergency outage'}
                          >
                            !
                          </span>
                        ) : (
                          <span className="w-2.5 h-2.5 rounded-full bg-[#FF5E3A] shadow-[0_0_8px_#FF5E3A]" />
                        )}
                      </span>
                      <span className="text-base font-black text-white font-mono tracking-tight">
                        {interval.start} – {interval.end}
                      </span>
                    </div>
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#FF5E3A]/15 text-[#FF5E3A] font-mono border border-[#FF5E3A]/30">
                      {interval.durationHours} {lang === 'uk' ? 'год' : 'h'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-emerald-500/10 text-emerald-300 font-bold text-center text-sm border border-emerald-400/20">
                {lang === 'uk' ? 'Відключень не заплановано' : 'No blackouts scheduled'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Last Updated, Next Refresh & Circular Refresh Button */}
      <div className="bg-[#141A29]/75 backdrop-blur-2xl rounded-2xl p-4 border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.45)] flex items-center justify-between gap-3">
        <div className="text-xs text-sky-200/80 space-y-1">
          <div>
            <span className="font-medium text-sky-200/60">{t.lastUpdated}: </span>
            <span className="font-bold text-white font-mono">{activeSchedule.lastUpdated}</span>
          </div>
          <div>
            <span className="font-medium text-sky-200/60">{t.nextRefreshAt}: </span>
            <span className="font-bold text-white font-mono">{nextRefreshTimeStr}</span>
          </div>
        </div>

        {/* Circular Action Refresh Button */}
        <button
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className="w-11 h-11 rounded-full bg-white text-black hover:bg-zinc-200 flex items-center justify-center transition-all shadow-lg disabled:opacity-50 cursor-pointer"
          title={t.forceRefresh}
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Emergency Outages Info Link right after the Refresh block (with Facebook logo and word wrapping on caption only) */}
      <div className="bg-[#141A29]/75 backdrop-blur-2xl rounded-3xl p-4 border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
        <a
          href="https://www.facebook.com/ztoe.com.ua"
          target="_blank"
          rel="noopener noreferrer"
          title="https://www.facebook.com/ztoe.com.ua"
          className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 transition-all group overflow-hidden"
        >
          <div className="flex items-center gap-3.5 min-w-0 flex-1 mr-2">
            <div className="w-10 h-10 rounded-2xl bg-[#1877F2] text-white flex items-center justify-center shrink-0 shadow-sm">
              <svg
                className="w-5 h-5 fill-current"
                viewBox="0 0 24 24"
                aria-label="Facebook"
              >
                <path d="M15.12 5.32H17V2.14A26.11 26.11 0 0 0 14.26 2c-2.72 0-4.58 1.66-4.58 4.7v2.62H6.61v3.56h3.07V22h3.68v-9.12h3.06l.46-3.56h-3.52V6.65c0-1.05.29-1.73 1.76-1.73Z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white group-hover:text-[#FF5E3A] transition-colors whitespace-normal break-words leading-snug">
                {t.emergencyOutagesLabel}
              </div>
              <div className="text-[11px] text-sky-200/70 font-mono truncate mt-0.5">
                https://www.facebook.com/ztoe.com.ua
              </div>
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-sky-200/70 group-hover:text-white transition-colors shrink-0" />
        </a>
      </div>

      {/* Blackout Schedules on ZTOE Website Link at very bottom after Facebook link */}
      <div className="bg-[#141A29]/75 backdrop-blur-2xl rounded-3xl p-4 border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
        <a
          href="https://www.ztoe.com.ua/unhooking-search.php"
          target="_blank"
          rel="noopener noreferrer"
          title="https://www.ztoe.com.ua/unhooking-search.php"
          className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 transition-all group overflow-hidden"
        >
          <div className="flex items-center gap-3.5 min-w-0 flex-1 mr-2">
            <div className="w-10 h-10 rounded-2xl bg-[#FF5E3A] text-white flex items-center justify-center shrink-0 shadow-sm">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white group-hover:text-[#FF5E3A] transition-colors whitespace-normal break-words leading-snug">
                {lang === 'uk' ? 'Графіки відключень на сайті' : 'Blackout schedules on website'}
              </div>
              <div className="text-[11px] text-sky-200/70 font-mono truncate mt-0.5">
                https://www.ztoe.com.ua/unhooking-search.php
              </div>
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-sky-200/70 group-hover:text-white transition-colors shrink-0" />
        </a>
      </div>
      </div>

    </div>
  );
};
