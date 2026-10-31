import React from 'react';
import { 
  Home, 
  Settings, 
  Info, 
  Layers, 
  Wifi, 
  Battery, 
  Zap, 
  X
} from 'lucide-react';
import { DaySchedule, UserSettings, NotificationRecord } from '../types';
import { translations } from '../services/i18n';
import { getInterpolatedTimePalette } from '../services/timeOfDayPalette';
import { MainView } from './MainView';
import { SettingsView } from './SettingsView';
import { AboutView } from './AboutView';
import { WidgetSimulator } from './WidgetSimulator';

interface PhoneSimulatorProps {
  schedule: DaySchedule;
  tomorrowSchedule: DaySchedule | null;
  settings: UserSettings;
  lang: 'uk' | 'en';
  activeNotification: NotificationRecord | null;
  onDismissNotification: () => void;
  onToggleNotifications: () => void;
  onUpdateSettings: (newSettings: UserSettings) => void;
  onRefresh: () => Promise<'SUCCESS' | 'NO_INTERNET' | 'NO_QUEUES_FOUND' | void> | void;
  isRefreshing: boolean;
  onSendTestAlert: () => void;
  onResetDefaults: () => void;
  activeTab: 'schedule' | 'widget' | 'settings' | 'about';
  setActiveTab: (tab: 'schedule' | 'widget' | 'settings' | 'about') => void;
  now?: Date;
}

export const PhoneSimulator: React.FC<PhoneSimulatorProps> = ({
  schedule,
  tomorrowSchedule,
  settings,
  lang,
  activeNotification,
  onDismissNotification,
  onToggleNotifications,
  onUpdateSettings,
  onRefresh,
  isRefreshing,
  onSendTestAlert,
  onResetDefaults,
  activeTab,
  setActiveTab,
  now = new Date()
}) => {
  const t = translations[lang];

  const currentTimeStr = React.useMemo(() => {
    const h = now.getHours().toString().padStart(2, '0');
    const m = now.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  }, [now]);

  // Recompute time-of-day palette every minute for smooth gradual background color transition
  const timePalette = React.useMemo(
    () => getInterpolatedTimePalette(now),
    [now.getHours(), now.getMinutes()]
  );

  return (
    <div className="relative mx-auto w-full max-w-[420px] rounded-[52px] bg-[#07090E] p-3.5 shadow-[0_25px_60px_rgba(0,0,0,0.8)] ring-1 ring-white/10 select-none">
      
      {/* Phone Screen Canvas with Gradual Time-of-Day Blurred Background (60% Primary, 30% Secondary, 10% Accent) */}
      <div
        className="relative overflow-hidden rounded-[42px] min-h-[790px] flex flex-col border border-white/15 text-white transition-colors duration-1000"
        style={{ backgroundColor: timePalette.primary }}
      >
        {/* Primary (60%) blurred atmospheric base layer */}
        <div
          className="absolute inset-0 opacity-60 blur-3xl pointer-events-none transition-colors duration-1000"
          style={{
            background: `radial-gradient(circle at 50% 45%, ${timePalette.primary} 0%, ${timePalette.secondary} 100%)`,
          }}
        />
        {/* Secondary (30%) blurred orb */}
        <div
          className="absolute -top-8 -right-8 w-80 h-80 rounded-full opacity-75 blur-3xl pointer-events-none transition-colors duration-1000"
          style={{ backgroundColor: timePalette.secondary }}
        />
        {/* Supporting/Core top-left contrast orb for crisp header readability */}
        <div
          className="absolute -top-12 -left-12 w-72 h-72 rounded-full opacity-70 blur-3xl pointer-events-none transition-colors duration-1000"
          style={{ backgroundColor: timePalette.supporting }}
        />
        {/* Secondary (30%) lower-left wave */}
        <div
          className="absolute bottom-1/4 -left-16 w-80 h-80 rounded-full opacity-65 blur-3xl pointer-events-none transition-colors duration-1000"
          style={{ backgroundColor: timePalette.secondary }}
        />
        {/* Accent (10%) blurred highlight orb */}
        <div
          className="absolute bottom-12 right-6 w-60 h-60 rounded-full opacity-60 blur-3xl pointer-events-none transition-colors duration-1000"
          style={{ backgroundColor: timePalette.accent }}
        />
        {/* Subtle top scrim to guarantee status bar and header contrast across all 4 day phases */}
        <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-[#0B0C10]/65 via-[#0B0C10]/25 to-transparent pointer-events-none" />

        {/* Status Bar in Strict 24-Hour Clock */}
        <div className="relative z-30 flex items-center justify-between px-7 pt-4 pb-2 text-[13px] font-semibold text-sky-100">
          <div className="tracking-tight font-mono">{currentTimeStr || '19:27'}</div>
          
          {/* Subtle Camera Notch */}
          <div className="absolute left-1/2 -translate-x-1/2 top-3 w-4 h-4 rounded-full bg-black ring-1 ring-white/15 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-[#1A1B20]" />
          </div>

          <div className="flex items-center gap-1.5 text-sky-200/80">
            <Wifi className="w-3.5 h-3.5" />
            <Battery className="w-4 h-4" />
          </div>
        </div>

        {/* Heads-up Notification Toast with Application Icon */}
        {activeNotification && (
          <div className="absolute top-12 left-4 right-4 z-50 animate-slide-down">
            <div className="bg-[#141A29]/90 text-white backdrop-blur-2xl rounded-2xl p-4 shadow-2xl border border-white/20 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#FF5E3A] flex items-center justify-center text-white shrink-0 mt-0.5 shadow-md">
                  <Zap className="w-4 h-4 fill-current" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-[#FF5E3A] uppercase tracking-wider">Світло в Житомирі</span>
                    <span className="text-[10px] text-sky-200/70 font-mono">· {t.now}</span>
                  </div>
                  <div className="text-xs font-bold text-white mt-0.5">
                    {activeNotification.title}
                  </div>
                  <div className="text-[11px] text-zinc-300 leading-snug mt-0.5">
                    {activeNotification.message}
                  </div>
                </div>
              </div>

              <button
                onClick={onDismissNotification}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Scrollable View Area */}
        <div className="flex-1 overflow-y-auto px-4 pt-2 pb-28 relative z-10">
          {activeTab === 'schedule' && (
            <MainView
              schedule={schedule}
              tomorrowSchedule={tomorrowSchedule}
              settings={settings}
              lang={lang}
              now={now}
              onToggleNotifications={onToggleNotifications}
              onRefresh={onRefresh}
              isRefreshing={isRefreshing}
              onSendTestAlert={onSendTestAlert}
            />
          )}

          {activeTab === 'widget' && (
            <WidgetSimulator
              schedule={schedule}
              settings={settings}
              lang={lang}
              onToggleNotifications={onToggleNotifications}
              onRefresh={onRefresh}
              isRefreshing={isRefreshing}
              onOpenApp={() => setActiveTab('schedule')}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              settings={settings}
              lang={lang}
              onUpdateSettings={onUpdateSettings}
              onSendTestAlert={onSendTestAlert}
              onForceRefresh={onRefresh}
              onResetDefaults={onResetDefaults}
            />
          )}

          {activeTab === 'about' && (
            <AboutView lang={lang} />
          )}
        </div>

        {/* Floating Capsule Bottom Navigation Dock in Frosted Glass */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-40 w-[84%] max-w-[320px]">
          <div className="bg-[#141A29]/80 backdrop-blur-2xl rounded-full p-1.5 border border-white/20 shadow-2xl flex items-center justify-around">
            
            {/* 1. Schedule */}
            <button
              onClick={() => setActiveTab('schedule')}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
                activeTab === 'schedule'
                  ? 'bg-white text-black shadow-lg scale-105'
                  : 'text-sky-200/70 hover:text-white'
              }`}
              title={t.navSchedule}
            >
              <Home className="w-5 h-5" />
            </button>

            {/* 2. Widget Preview */}
            <button
              onClick={() => setActiveTab('widget')}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
                activeTab === 'widget'
                  ? 'bg-white text-black shadow-lg scale-105'
                  : 'text-sky-200/70 hover:text-white'
              }`}
              title={t.navWidget}
            >
              <Layers className="w-5 h-5" />
            </button>

            {/* 3. Settings */}
            <button
              onClick={() => setActiveTab('settings')}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
                activeTab === 'settings'
                  ? 'bg-white text-black shadow-lg scale-105'
                  : 'text-sky-200/70 hover:text-white'
              }`}
              title={t.navSettings}
            >
              <Settings className="w-5 h-5" />
            </button>

            {/* 4. About */}
            <button
              onClick={() => setActiveTab('about')}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
                activeTab === 'about'
                  ? 'bg-white text-black shadow-lg scale-105'
                  : 'text-sky-200/70 hover:text-white'
              }`}
              title={t.navAbout}
            >
              <Info className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Android Gesture Bar */}
        <div className="flex justify-center pb-2 bg-transparent z-10">
          <div className="w-32 h-1 rounded-full bg-white/25" />
        </div>
      </div>
    </div>
  );
};
