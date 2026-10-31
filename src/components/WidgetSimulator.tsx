import React, { useState, useMemo } from 'react';
import { 
  Bell, 
  BellOff, 
  RefreshCw,
  Layers
} from 'lucide-react';
import { DaySchedule, UserSettings } from '../types';
import { calculateOutageCountdown, getBlackoutIntervals, getChartHalfHourBlocks } from '../services/ztoeParser';
import { translations } from '../services/i18n';

interface WidgetSimulatorProps {
  schedule: DaySchedule;
  settings: UserSettings;
  lang: 'uk' | 'en';
  onToggleNotifications: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onOpenApp: () => void;
}

export const WidgetSimulator: React.FC<WidgetSimulatorProps> = ({
  schedule,
  settings,
  lang,
  onToggleNotifications,
  onRefresh,
  isRefreshing = false,
  onOpenApp
}) => {
  const t = translations[lang];
  const [widgetSize, setWidgetSize] = useState<'2x1' | '3x2'>('2x1');
  const now = new Date();
  const countdown = calculateOutageCountdown(schedule, now);
  const blackoutIntervals = getBlackoutIntervals(schedule.slots);
  const chartBlocks = useMemo(() => getChartHalfHourBlocks(schedule.slots), [schedule.slots]);

  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  // Strict 24-hour clock (no AM/PM anywhere)
  const format24Time = (d: Date): string => {
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const isUk = lang === 'uk';
  const queueLabel = isUk ? `Черга ${settings.queue}` : `Queue ${settings.queue}`;
  const statusLabel = countdown.isCurrentlyBlackout 
    ? (isUk ? 'СВІТЛА НЕМАЄ' : 'POWER OFF')
    : (isUk ? 'СВІТЛО Є' : 'POWER ON');
  
  const countdownLabel = countdown.isCurrentlyBlackout
    ? (isUk ? 'До увімкнення:' : 'Power on in:')
    : (isUk ? 'До відключення:' : 'Time to blackout:');

  const periodLabel = isUk ? 'Період' : 'Period';
  const hoursUnit = isUk ? 'год' : 'h';

  return (
    <div className="flex flex-col gap-4 max-w-lg mx-auto select-none">
      
      {/* Header & Size Switcher */}
      <div className="bg-[#141A29]/75 backdrop-blur-2xl rounded-2xl p-4 border border-white/15 shadow-xl flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#FF5E3A]" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
              {t.widgetPreviewTitle}
            </h2>
          </div>
          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-white/10 text-sky-200 font-mono border border-white/10">
            {isUk ? 'Віджет Android Glance' : 'Android Glance Widget'}
          </span>
        </div>

        {/* Size Selector */}
        <div className="flex items-center gap-2 p-1 bg-black/30 rounded-xl border border-white/10">
          <button
            onClick={() => setWidgetSize('2x1')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              widgetSize === '2x1'
                ? 'bg-white text-black shadow-md'
                : 'text-sky-200/60 hover:text-white'
            }`}
          >
            {t.widgetSize2x1}
          </button>
          <button
            onClick={() => setWidgetSize('3x2')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              widgetSize === '3x2'
                ? 'bg-white text-black shadow-md'
                : 'text-sky-200/60 hover:text-white'
            }`}
          >
            {t.widgetSize3x2}
          </button>
        </div>
      </div>

      {/* Simulated Android Wallpaper Canvas with Windows 11 Flowing Blue Silk Effect */}
      <div className="relative rounded-3xl p-6 overflow-hidden bg-[#0A0D14] border border-white/15 shadow-2xl flex flex-col items-center justify-center min-h-[400px]">
        
        {/* Windows 11 Style Azure Silk Ribbon Gradients */}
        <div className="absolute top-1/4 -left-16 w-64 h-64 rounded-full bg-blue-600/35 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 right-0 w-80 h-80 rounded-full bg-sky-500/30 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/4 w-48 h-48 rounded-full bg-cyan-400/25 blur-3xl pointer-events-none" />

        {/* Ambient Clock in strict 24-hour format */}
        <div className="text-center mb-6 pointer-events-none z-10">
          <div className="text-4xl font-light text-white tracking-widest font-sans drop-shadow-lg">
            {format24Time(now)}
          </div>
          <div className="text-xs text-sky-200/80 drop-shadow-sm font-medium mt-0.5">
            {now.toLocaleDateString(isUk ? 'uk-UA' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
        </div>

        {/* ----------------- 2x1 SMALL WIDGET ----------------- */}
        {widgetSize === '2x1' ? (
          <div
            onClick={onOpenApp}
            className="w-full max-w-[340px] z-10 bg-[#141A29]/90 backdrop-blur-2xl text-white rounded-3xl p-4.5 border border-white/25 shadow-[0_12px_40px_rgba(0,0,0,0.5)] cursor-pointer hover:border-white/40 transition-all group"
          >
            {/* Top row: Localized Queue + Status */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-base font-bold text-white tracking-tight drop-shadow-sm">
                {queueLabel}
              </span>

              <span className={`text-xs font-bold drop-shadow-sm ${countdown.isCurrentlyBlackout ? 'text-[#FF5E3A]' : 'text-emerald-400'}`}>
                {statusLabel}
              </span>
            </div>

            {/* Bottom row: Countdown + Round Refresh Button + Round Notification Toggle */}
            <div className="flex items-center justify-between pt-2.5 border-t border-white/15">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-sky-200/70 font-semibold">
                  {countdownLabel}
                </div>
                <div className="text-2xl font-black font-mono text-white drop-shadow-md">
                  {countdown.formattedTimeLeft}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Round Refresh Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onRefresh) onRefresh();
                  }}
                  className="w-10 h-10 rounded-full flex items-center justify-center transition-all backdrop-blur-xl bg-white/15 text-white hover:bg-white/25 border border-white/20 cursor-pointer"
                  title={isUk ? 'Оновити дані' : 'Refresh data'}
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>

                {/* Round Notification Toggle Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleNotifications();
                  }}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all backdrop-blur-xl border cursor-pointer ${
                    settings.notificationsEnabled
                      ? 'bg-white text-[#FF5E3A] shadow-lg shadow-black/20 border-white'
                      : 'bg-white/15 text-white/80 hover:text-white border-white/20 hover:bg-white/25'
                  }`}
                  title={settings.notificationsEnabled ? (isUk ? 'Вимкнути сповіщення' : 'Mute alerts') : (isUk ? 'Увімкнути сповіщення' : 'Enable alerts')}
                >
                  {settings.notificationsEnabled ? (
                    <Bell className="w-4 h-4 fill-current" />
                  ) : (
                    <BellOff className="w-4 h-4 stroke-[2]" />
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ----------------- 3x2 BIG WIDGET ----------------- */
          <div
            onClick={onOpenApp}
            className="w-full max-w-[360px] z-10 bg-[#141A29]/90 backdrop-blur-2xl text-white rounded-3xl p-5 border border-white/25 shadow-[0_12px_40px_rgba(0,0,0,0.5)] cursor-pointer hover:border-white/40 transition-all flex flex-col gap-3.5 group"
          >
            {/* Header: Localized Queue + Round Refresh Button + Round Notification Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-lg font-bold text-white tracking-tight drop-shadow-sm">
                  {queueLabel}
                </span>
                <div className={`text-xs font-bold ${countdown.isCurrentlyBlackout ? 'text-[#FF5E3A]' : 'text-emerald-400'}`}>
                  {statusLabel}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Round Refresh Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onRefresh) onRefresh();
                  }}
                  className="w-10 h-10 rounded-full flex items-center justify-center transition-all backdrop-blur-xl bg-white/15 text-white hover:bg-white/25 border border-white/20 cursor-pointer"
                  title={isUk ? 'Оновити дані' : 'Refresh data'}
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>

                {/* Round Notification Toggle */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleNotifications();
                  }}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all backdrop-blur-xl border cursor-pointer ${
                    settings.notificationsEnabled
                      ? 'bg-white text-[#FF5E3A] shadow-lg shadow-black/20 border-white'
                      : 'bg-white/15 text-white/80 hover:text-white border-white/20 hover:bg-white/25'
                  }`}
                  title={settings.notificationsEnabled ? (isUk ? 'Вимкнути сповіщення' : 'Mute alerts') : (isUk ? 'Увімкнути сповіщення' : 'Enable alerts')}
                >
                  {settings.notificationsEnabled ? (
                    <Bell className="w-4 h-4 fill-current" />
                  ) : (
                    <BellOff className="w-4 h-4 stroke-[2]" />
                  )}
                </button>
              </div>
            </div>

            {/* Countdown Banner in Frosted Glass */}
            <div className="p-3.5 rounded-2xl bg-black/30 backdrop-blur-md border border-white/10 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase text-sky-200/70 font-semibold">
                  {countdownLabel}
                </div>
                <div className="text-2xl font-black font-mono text-white drop-shadow-md">
                  {countdown.formattedTimeLeft}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-sky-200/70">{periodLabel}</div>
                <div className="text-xs font-mono font-bold text-white">
                  {countdown.slotDescription}
                </div>
              </div>
            </div>

            {/* 24-Hour Timeline Bar matching MainView analog electricity meter style */}
            <div className="bg-gradient-to-b from-[#DFDDD0] via-[#D4D1C1] to-[#C6C2B0] rounded-xl px-2.5 pt-3 pb-2.5 border-2 border-[#7A7768] shadow-[inset_0_2px_5px_rgba(0,0,0,0.3)]">
              <div className="bg-[#4E514E] p-1 rounded-md border border-[#6E716B] shadow-[inset_0_2px_4px_rgba(0,0,0,0.85)]">
                <div className="flex w-full items-center justify-between gap-[1.5px] bg-[#C8C6BC] rounded-[2px] overflow-visible">
                  {chartBlocks.map(({ hour: h, half1Off, half2Off }) => {
                    const isCurrentH = h === currentHour;
                    return (
                      <div key={`widget_hour_${h}`} className="relative flex-1 flex items-center gap-0">
                        <div
                          className={`flex-1 h-4 ${
                            half1Off
                              ? 'bg-gradient-to-b from-[#9E1E18] via-[#D62E26] to-[#8C1914]'
                              : 'bg-gradient-to-b from-[#D8D6CC] via-[#FCFBF7] to-[#CCC9BE]'
                          }`}
                        />
                        <div
                          className={`flex-1 h-4 ${
                            half2Off
                              ? 'bg-gradient-to-b from-[#9E1E18] via-[#D62E26] to-[#8C1914]'
                              : 'bg-gradient-to-b from-[#D8D6CC] via-[#FCFBF7] to-[#CCC9BE]'
                          }`}
                        />
                        {isCurrentH && (
                          <div
                            className="absolute -top-[9px] -bottom-[9px] w-[2.5px] bg-[#0B0B0A] rounded-full shadow-[0_0_2px_rgba(255,255,255,0.9)] pointer-events-none z-20 -translate-x-1/2"
                            style={{ left: `${(currentMinute / 60) * 100}%` }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 24-Hour Stamped Markers */}
              <div className="flex justify-between text-[9px] font-mono text-[#1C1B18] font-bold mt-2 px-0.5">
                <span>00</span>
                <span>06</span>
                <span>12</span>
                <span>18</span>
                <span>24</span>
              </div>
            </div>

            {/* Outage windows list */}
            {blackoutIntervals.length > 0 && (
              <div className="pt-2 border-t border-white/10 flex flex-col gap-1.5">
                {blackoutIntervals.slice(0, 2).map((iv, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs py-1.5 px-3 rounded-xl bg-black/30 backdrop-blur-md border border-white/10 font-mono">
                    <span className="font-bold text-white">{iv.start} – {iv.end}</span>
                    <span className="text-[11px] text-[#FF5E3A] font-bold">{iv.durationHours} {hoursUnit}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
