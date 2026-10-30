import React, { useState, useMemo } from 'react';
import { 
  Bell, 
  BellOff, 
  RefreshCw, 
  Clock
} from 'lucide-react';
import { DaySchedule, UserSettings } from '../types';
import { calculateOutageCountdown, getBlackoutIntervals } from '../services/ztoeParser';
import { translations } from '../services/i18n';

interface MainViewProps {
  schedule: DaySchedule;
  tomorrowSchedule: DaySchedule | null;
  settings: UserSettings;
  lang: 'uk' | 'en';
  now?: Date;
  onToggleNotifications: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onSendTestAlert: () => void;
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
}) => {
  const t = translations[lang];
  const [selectedDayTab, setSelectedDayTab] = useState<'today' | 'tomorrow'>('today');

  const activeSchedule = selectedDayTab === 'today' ? schedule : (tomorrowSchedule || schedule);

  // High performance: Memoize interval aggregation to avoid recalculating on every render tick
  const blackoutIntervals = useMemo(
    () => getBlackoutIntervals(activeSchedule.slots),
    [activeSchedule.slots]
  );

  // Memoize countdown calculation
  const countdown = useMemo(
    () => calculateOutageCountdown(activeSchedule, now),
    [activeSchedule, now]
  );

  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const timePercent = useMemo(
    () => ((currentHour * 60 + currentMinute) / 1440) * 100,
    [currentHour, currentMinute]
  );

  // Strict 24-hour time formatter (no AM/PM anywhere)
  const format24Time = (d: Date): string => {
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
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

  return (
    <div className="flex flex-col gap-4 max-w-lg mx-auto select-none">
      
      {/* Top Header: Queue title + Sleek pill toggle switch */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <div className="text-2xl font-bold tracking-tight text-white drop-shadow-sm">
            {t.queue} {settings.queue}
          </div>
          <div className="text-xs text-sky-200/70 font-medium">
            Житомиробленерго (ZTOE)
          </div>
        </div>

        {/* Enlarged Pill Switch (No text ВКЛ/ВИКЛ) */}
        <button
          onClick={onToggleNotifications}
          className={`w-16 h-9 rounded-full p-1 transition-all duration-300 flex items-center shadow-lg ${
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

      {/* Hero Outage Status Card (Frosted Glass with Subtle Blue Glow) */}
      <div className="rounded-3xl p-5 bg-[#141A29]/75 backdrop-blur-2xl border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.45)] transition-all">
        
        {/* Status Line */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-3 h-3 rounded-full ${
                countdown.isCurrentlyBlackout
                  ? 'bg-[#FF5E3A] shadow-md shadow-[#FF5E3A]/60 animate-pulse'
                  : 'bg-emerald-400 shadow-md shadow-emerald-400/40'
              }`}
            />
            <span className="text-sm font-bold tracking-wide uppercase text-white">
              {countdown.isCurrentlyBlackout
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
            {countdown.isCurrentlyBlackout
              ? (lang === 'uk' ? 'Світло увімкнуть через:' : 'Power on in:')
              : countdown.closestBlackoutSlot
              ? (lang === 'uk' ? 'До відключення залишилось:' : 'Time until next outage:')
              : (lang === 'uk' ? 'Відключень більше немає' : 'No more blackouts today')}
          </div>
          <div className="text-5xl font-black font-mono tracking-tight text-white drop-shadow-md">
            {countdown.formattedTimeLeft}
          </div>
        </div>

        {/* Outage Window */}
        {countdown.slotDescription && countdown.slotDescription !== 'Відключень немає' && (
          <div className="mt-4 pt-3.5 border-t border-white/10 flex items-center justify-between text-sm">
            <span className="text-sky-200/70">
              {countdown.isCurrentlyBlackout 
                ? (lang === 'uk' ? 'Період відключення:' : 'Outage period:') 
                : (lang === 'uk' ? 'Найближчий період:' : 'Next period:')}
            </span>
            <span className="text-base font-bold text-white font-mono bg-white/10 backdrop-blur-md px-3 py-1 rounded-xl border border-white/15">
              {countdown.slotDescription}
            </span>
          </div>
        )}
      </div>

      {/* Day Selector (Today / Tomorrow - Frosted Glass Segment) */}
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

      {/* Schedule Card (Point 4: NO "24-hour schedule" text heading) */}
      <div className="bg-[#141A29]/75 backdrop-blur-2xl rounded-3xl p-5 border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.45)] flex flex-col gap-4">
        
        {/* Pillar Chart Canvas */}
        <div className="relative pt-6 pb-2">
          {/* Current time floating needle indicator */}
          {selectedDayTab === 'today' && (
            <div
              className="absolute top-0 bottom-0 z-20 flex flex-col items-center pointer-events-none transition-all duration-500"
              style={{ left: `${Math.min(97, Math.max(3, timePercent))}%` }}
            >
              <div className="bg-white text-black text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-lg -translate-y-1">
                {format24Time(now)}
              </div>
              <div className="w-0.5 flex-1 bg-white" />
            </div>
          )}

          {/* 24 Rounded Vertical Pillars */}
          <div className="flex items-end justify-between gap-1 h-20 px-1.5 bg-black/35 backdrop-blur-md rounded-2xl p-2 border border-white/10">
            {activeSchedule.slots.map((slot, sIdx) => {
              const isOff = slot.status === 'POWER_OFF';
              const isCurrent = selectedDayTab === 'today' && currentHour === slot.startHour;
              
              return (
                <div
                  key={`${selectedDayTab}_${slot.id}_${slot.startHour}_${sIdx}`}
                  className="flex-1 flex flex-col items-center justify-end h-full"
                  title={`${slot.startTimeStr} - ${slot.endTimeStr}: ${isOff ? 'Немає світла' : 'Світло є'}`}
                >
                  <div
                    className={`w-full rounded-md transition-all ${
                      isOff
                        ? 'h-[85%] bg-[#FF5E3A] shadow-md shadow-[#FF5E3A]/40'
                        : 'h-[35%] bg-white/15 hover:bg-white/25'
                    } ${isCurrent ? 'ring-2 ring-white scale-105' : ''}`}
                  />
                </div>
              );
            })}
          </div>

          {/* Clean 24-Hour Markers */}
          <div className="flex justify-between text-xs font-mono text-sky-200/70 mt-2.5 px-1 font-semibold">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>24:00</span>
          </div>
        </div>

        {/* Clear List of Outage Hours for this day */}
        <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
          <div className="text-xs font-semibold text-sky-200/70 uppercase tracking-wide">
            {lang === 'uk' ? 'Години без світла на цей день:' : 'Outage hours for this day:'}
          </div>

          {blackoutIntervals.length > 0 ? (
            <div className="flex flex-col gap-2">
              {blackoutIntervals.map((interval, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.06] backdrop-blur-md border border-white/10"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-[#FF5E3A] shrink-0 shadow-md shadow-[#FF5E3A]/50" />
                    <span className="text-base font-bold text-white font-mono">
                      {interval.start} – {interval.end}
                    </span>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 rounded-xl bg-[#FF5E3A]/15 text-[#FF5E3A] font-mono border border-[#FF5E3A]/30">
                    {interval.durationHours} {lang === 'uk' ? 'год' : 'h'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-white/[0.06] backdrop-blur-md text-sky-100 font-medium text-center text-sm border border-white/10">
              {lang === 'uk' ? 'Відключень не заплановано' : 'No blackouts scheduled'}
            </div>
          )}
        </div>
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
          onClick={onRefresh}
          disabled={isRefreshing}
          className="w-11 h-11 rounded-full bg-white text-black hover:bg-zinc-200 flex items-center justify-center transition-all shadow-lg disabled:opacity-50"
          title={t.forceRefresh}
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

    </div>
  );
};
