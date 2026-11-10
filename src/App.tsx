/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Smartphone, 
  Code2, 
  BookOpen, 
  Layers, 
  Github, 
  Globe, 
  Zap,
  RotateCcw,
  Download,
  PackageCheck,
  CheckCircle2,
  Bell
} from 'lucide-react';
import { DaySchedule, UserSettings, NotificationRecord, Language } from './types';
import { fetchFullSchedules, applyEmergencyOutageToSchedule } from './services/ztoeParser';
import { checkAddressOnZtoeWebsite, getKyivska37DemoEmergencyOutage, prefetchAddressIndexInBackground } from './services/ztoeAddressLookup';
import { 
  loadUserSettings, 
  saveUserSettings, 
  createTestNotification, 
  checkAndTriggerAdvanceAlert, 
  checkAndTriggerEmergencyOutageAlert,
  DEFAULT_SETTINGS,
  clearNotifiedHistory,
  resetAllAppDataToFirstLaunch,
  toggleMasterNotifications
} from './services/alertManager';
import { resolveLanguage, translations } from './services/i18n';
import { getInterpolatedTimePalette } from './services/timeOfDayPalette';
import { PhoneSimulator } from './components/PhoneSimulator';
import { CodeExplorer } from './components/CodeExplorer';
import { PlayStoreGuide } from './components/PlayStoreGuide';
import { WidgetSimulator } from './components/WidgetSimulator';
import { BuildAndDownloadView } from './components/BuildAndDownloadView';
import { addPowerPoints, resetAllRouletteProgress, resetSavedPowerPoints } from './services/rouletteGame';

export default function App() {
  const [settings, setSettings] = useState<UserSettings>(() => loadUserSettings());
  const [schedule, setSchedule] = useState<DaySchedule | null>(null);
  const [tomorrowSchedule, setTomorrowSchedule] = useState<DaySchedule | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeNotification, setActiveNotification] = useState<NotificationRecord | null>(null);
  
  // Navigation: main top-level mode
  const [activeMode, setActiveMode] = useState<'app' | 'widget' | 'build' | 'code' | 'playstore'>('app');
  const [phoneTab, setPhoneTab] = useState<'schedule' | 'widget' | 'settings' | 'about'>('schedule');

  // Resolved language and theme
  const resolvedLang = resolveLanguage(settings.language);
  const t = translations[resolvedLang];

  // Theme calculation
  const [, setIsDarkMode] = useState<boolean>(() => {
    if (settings.theme === 'dark') return true;
    if (settings.theme === 'light') return false;
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  useEffect(() => {
    if (settings.theme === 'dark') {
      setIsDarkMode(true);
    } else if (settings.theme === 'light') {
      setIsDarkMode(false);
    } else {
      const match = window.matchMedia('(prefers-color-scheme: dark)');
      setIsDarkMode(match.matches);
      const listener = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
      match.addEventListener('change', listener);
      return () => match.removeEventListener('change', listener);
    }
  }, [settings.theme]);

  // Load schedule from ztoe.com.ua / rotation engine and re-check saved address & emergency outages against ZTOE website
  const loadSchedules = useCallback(async (currentSettings: UserSettings): Promise<'SUCCESS' | 'NO_INTERNET' | 'NO_QUEUES_FOUND'> => {
    setIsRefreshing(true);
    try {
      let effectiveQueue = currentSettings.queue;

      if (currentSettings.selectedAddressQuery) {
        const latestAddressLookup = await checkAddressOnZtoeWebsite(
          currentSettings.selectedAddressQuery,
          currentSettings.url
        );
        if (latestAddressLookup) {
          const prevEmergency = currentSettings.activeEmergencyOutage ?? null;
          const nextEmergency = latestAddressLookup.emergencyOutage ?? null;

          checkAndTriggerEmergencyOutageAlert(
            prevEmergency,
            nextEmergency,
            currentSettings,
            resolveLanguage(currentSettings.language),
            (record) => {
              setActiveNotification(record);
            }
          );

          const emergencyChanged =
            (prevEmergency?.id || null) !== (nextEmergency?.id || null) ||
            (prevEmergency?.startTime || '') !== (nextEmergency?.startTime || '') ||
            (prevEmergency?.estimatedRestoreTime || '') !== (nextEmergency?.estimatedRestoreTime || '');

          const hadNoQueue = !currentSettings.queue || currentSettings.queue.trim() === '';
          const queueAssignedForNoQueueHouse =
            hadNoQueue &&
            (latestAddressLookup.queue !== currentSettings.queue ||
              latestAddressLookup.statusText !== currentSettings.customQueueStatusText);

          if (queueAssignedForNoQueueHouse || emergencyChanged) {
            const nextQueue = queueAssignedForNoQueueHouse
              ? latestAddressLookup.queue
              : currentSettings.queue;
            const nextStatusText = queueAssignedForNoQueueHouse
              ? latestAddressLookup.statusText
              : currentSettings.customQueueStatusText;
            effectiveQueue = nextQueue;
            const updatedSettings: UserSettings = {
              ...currentSettings,
              queue: nextQueue,
              customQueueStatusText: nextStatusText,
              activeEmergencyOutage: nextEmergency,
            };
            setSettings(updatedSettings);
            saveUserSettings(updatedSettings);
          }
        }
      }

      const res = await fetchFullSchedules(currentSettings.url, effectiveQueue);
      setSchedule(res.todaySchedule);
      setTomorrowSchedule(res.tomorrowSchedule);
      return res.status;
    } catch (err) {
      console.error('Failed to load schedule:', err);
      return 'NO_INTERNET';
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSchedules(settings);
  }, [loadSchedules, settings.queue, settings.url, settings.selectedAddress]);

  // Automatically refresh timer and drum bar when User enters main screen
  useEffect(() => {
    if (activeMode === 'app' && phoneTab === 'schedule') {
      setNow(new Date());
      loadSchedules(settings);
    }
  }, [activeMode, phoneTab]);

  // Periodic background refresh that also re-checks selectedAddressQuery against the ZTOE website
  useEffect(() => {
    const intervalMs = Math.max(1, settings.refreshIntervalMinutes || 30) * 60 * 1000;
    const refreshTimerId = setInterval(() => {
      loadSchedules(settings);
    }, intervalMs);
    return () => clearInterval(refreshTimerId);
  }, [loadSchedules, settings]);

  useEffect(() => {
    import('./services/donationsService').then(({ getDonationsWithDailyRefresh }) => {
      getDonationsWithDailyRefresh(Date.now(), false).catch(() => {});
    });
  }, []);

  // Pre-load and index REMs, cities, and active city streets in the background on app launch
  useEffect(() => {
    prefetchAddressIndexInBackground(settings.url, settings.selectedAddressQuery).catch(() => {});
  }, [settings.url]);

  // Battery & Power optimization: shared system clock state
  const [now, setNow] = useState<Date>(() => new Date());
  const [timeOfDayOverride, setTimeOfDayOverride] = useState<'auto' | 'morning' | 'day' | 'evening' | 'night'>('auto');

  // Background ticker: updates countdown and checks advance alerts.
  // Pauses 1s countdown updates when not on Main screen (phoneTab !== 'schedule' in 'app' mode)
  // and throttles to 30s when browser tab is hidden to maximize device battery life.
  useEffect(() => {
    let tickerId: any;
    const formatLocalIsoDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    let lastDateStr = formatLocalIsoDate(new Date());

    const runTick = () => {
      const currentNow = new Date();
      setNow(currentNow);

      const currentDateStr = formatLocalIsoDate(currentNow);
      if (currentDateStr !== lastDateStr) {
        lastDateStr = currentDateStr;
        if (tomorrowSchedule && tomorrowSchedule.dateStr === currentDateStr) {
          setSchedule({ ...tomorrowSchedule, dayLabel: 'Сьогодні' });
          setTomorrowSchedule(null);
        }
        loadSchedules(settings);
      }

      if (schedule && settings.notificationsEnabled) {
        const effectiveSchedule =
          applyEmergencyOutageToSchedule(schedule, settings.activeEmergencyOutage, false) || schedule;
        checkAndTriggerAdvanceAlert(
          effectiveSchedule,
          settings,
          resolvedLang,
          (record) => {
            setActiveNotification(record);
          }
        );
      }
    };

    const isCountdownScreenActive =
      (activeMode === 'app' && phoneTab === 'schedule') || activeMode === 'widget';

    const setupTicker = () => {
      clearInterval(tickerId);
      const isHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
      const intervalMs = isHidden ? 30000 : isCountdownScreenActive ? 1000 : 15000;
      tickerId = setInterval(runTick, intervalMs);
    };

    if (isCountdownScreenActive) {
      runTick();
    }
    setupTicker();

    const handleVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        runTick();
      }
      setupTicker();
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    return () => {
      clearInterval(tickerId);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }, [schedule, tomorrowSchedule, settings, resolvedLang, activeMode, phoneTab, loadSchedules]);

  // Handle setting updates
  const handleUpdateSettings = (newSettings: UserSettings) => {
    setSettings(newSettings);
    saveUserSettings(newSettings);
  };

  // Master notification toggle saves/restores sound & vibration states
  const handleToggleNotifications = () => {
    const updated = toggleMasterNotifications(settings);
    handleUpdateSettings(updated);
  };

  const handleSendTestAlert = () => {
    const slot = schedule?.slots.find(s => s.status === 'POWER_OFF');
    const record = createTestNotification(settings, resolvedLang, slot);
    setActiveNotification(record);
  };

  const handleResetDefaults = () => {
    clearNotifiedHistory();
    setSettings(DEFAULT_SETTINGS);
    saveUserSettings(DEFAULT_SETTINGS);
  };

  const handleResetAllAppDataFirstLaunch = () => {
    const freshSettings = resetAllAppDataToFirstLaunch();
    resetAllRouletteProgress();
    setSettings(freshSettings);
    setActiveNotification(null);
    setTimeOfDayOverride('auto');
    setActiveMode('app');
    setPhoneTab('schedule');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('zt-app-first-launch-reset'));
      window.dispatchEvent(new CustomEvent('zt-roulette-progress-reset'));
      window.dispatchEvent(
        new CustomEvent('zt-roulette-power-points-updated', {
          detail: { powerPoints: 0 },
        })
      );
    }
  };

  const effectiveNow = React.useMemo(() => {
    if (timeOfDayOverride === 'auto') return now;
    const simulated = new Date(now);
    if (timeOfDayOverride === 'morning') simulated.setHours(8, 30, 0, 0);
    else if (timeOfDayOverride === 'day') simulated.setHours(14, 0, 0, 0);
    else if (timeOfDayOverride === 'evening') simulated.setHours(19, 30, 0, 0);
    else if (timeOfDayOverride === 'night') simulated.setHours(3, 0, 0, 0);
    return simulated;
  }, [now, timeOfDayOverride]);

  const timePalette = React.useMemo(
    () => getInterpolatedTimePalette(effectiveNow),
    [effectiveNow.getHours(), effectiveNow.getMinutes()]
  );

  const effectiveSchedule = React.useMemo(
    () => (schedule ? applyEmergencyOutageToSchedule(schedule, settings.activeEmergencyOutage, false) || schedule : null),
    [schedule, settings.activeEmergencyOutage]
  );

  const effectiveTomorrowSchedule = React.useMemo(
    () => applyEmergencyOutageToSchedule(tomorrowSchedule, settings.activeEmergencyOutage, true),
    [tomorrowSchedule, settings.activeEmergencyOutage]
  );

  return (
    <div className="dark">
      <div
        className="min-h-screen text-zinc-100 transition-colors duration-1000 font-sans flex flex-col relative overflow-hidden"
        style={{ backgroundColor: timePalette.primary }}
      >
        {/* Ambient Gradual Time-of-Day Blurred Background (60% Primary, 30% Secondary, 10% Accent) */}
        <div
          className="fixed inset-0 opacity-60 blur-[130px] pointer-events-none transition-colors duration-1000"
          style={{
            background: `radial-gradient(circle at 50% 40%, ${timePalette.primary} 0%, ${timePalette.secondary} 100%)`,
          }}
        />
        <div
          className="fixed top-0 right-0 w-[600px] h-[600px] rounded-full opacity-55 blur-[130px] pointer-events-none transition-colors duration-1000"
          style={{ backgroundColor: timePalette.secondary }}
        />
        <div
          className="fixed bottom-0 -left-20 w-[650px] h-[650px] rounded-full opacity-50 blur-[140px] pointer-events-none transition-colors duration-1000"
          style={{ backgroundColor: timePalette.supporting }}
        />
        <div
          className="fixed top-1/2 left-1/3 w-[500px] h-[500px] rounded-full opacity-45 blur-[120px] pointer-events-none transition-colors duration-1000"
          style={{ backgroundColor: timePalette.accent }}
        />

        {/* Top Global Bar (Frosted Glass) */}
        <header className="sticky top-0 z-50 bg-[#0E1320]/80 backdrop-blur-2xl border-b border-white/10 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
            
            {/* Brand Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#FF5E3A] flex items-center justify-center text-white shadow-md shadow-[#FF5E3A]/30 font-black">
                <Zap className="w-5 h-5 fill-current" />
              </div>
              <div>
                <div className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                  <span>Світло в Житомирі</span>
                  <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-[#FF5E3A]/15 text-[#FF5E3A] font-semibold border border-[#FF5E3A]/20">
                    Android
                  </span>
                </div>
                <div className="text-[11px] text-[#8E92A0]">
                  ztoe.com.ua · Житомиробленерго
                </div>
              </div>
            </div>

            {/* Desktop Navigation Modes */}
            <div className="hidden md:flex items-center gap-1.5 p-1 bg-[#1C1D24] rounded-2xl border border-white/5">
              <button
                onClick={() => {
                  setActiveMode('app');
                  setPhoneTab('schedule');
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeMode === 'app'
                    ? 'bg-white text-black shadow-md'
                    : 'text-[#8E92A0] hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Емулятор</span>
              </button>

              <button
                onClick={() => {
                  setActiveMode('widget');
                  setPhoneTab('widget');
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeMode === 'widget'
                    ? 'bg-white text-black shadow-md'
                    : 'text-[#8E92A0] hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Віджет Glance</span>
              </button>

              <button
                onClick={() => setActiveMode('build')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeMode === 'build'
                    ? 'bg-[#FF5E3A] text-white shadow-md shadow-[#FF5E3A]/30'
                    : 'text-[#8E92A0] hover:text-white'
                }`}
              >
                <PackageCheck className="w-3.5 h-3.5" />
                <span>Збірка & APK</span>
              </button>

              <button
                onClick={() => setActiveMode('code')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeMode === 'code'
                    ? 'bg-white text-black shadow-md'
                    : 'text-[#8E92A0] hover:text-white'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Kotlin код</span>
              </button>

              <button
                onClick={() => setActiveMode('playstore')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeMode === 'playstore'
                    ? 'bg-white text-black shadow-md'
                    : 'text-[#8E92A0] hover:text-white'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Play Store</span>
              </button>
            </div>

            {/* Quick Action Controls */}
            <div className="flex items-center gap-2">
              <a
                href="/Android-ZTBlackoutPreWarning.zip"
                download="Android-ZTBlackoutPreWarning.zip"
                className="hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 text-xs font-bold hover:bg-emerald-500/25 transition-all"
                title="Завантажити готовий архів Android проєкту"
              >
                <Download className="w-3.5 h-3.5" />
                <span>.ZIP</span>
              </a>

              {/* Language Switcher */}
              <button
                onClick={() => {
                  const nextLang: Language = resolvedLang === 'uk' ? 'en' : 'uk';
                  handleUpdateSettings({ ...settings, language: nextLang });
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1C1D24] text-xs font-bold text-white border border-white/5 hover:bg-[#252732] transition-all"
                title="Перемкнути мову (Українська / English)"
              >
                <Globe className="w-3.5 h-3.5 text-[#FF5E3A]" />
                <span>{resolvedLang.toUpperCase()}</span>
              </button>

              {/* GitHub Link */}
              <a
                href="https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning"
                target="_blank"
                rel="noreferrer"
                className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black text-xs font-bold hover:bg-zinc-200 transition-all shadow-md"
              >
                <Github className="w-3.5 h-3.5" />
                <span>GitHub</span>
              </a>
            </div>
          </div>
        </header>

        {/* Mobile Header Tabs (visible on small screens) */}
        <div className="md:hidden flex items-center justify-around bg-[#121316] border-b border-white/5 px-2 py-2 text-xs overflow-x-auto">
          <button
            onClick={() => {
              setActiveMode('app');
              setPhoneTab('schedule');
            }}
            className={`px-3 py-1.5 rounded-xl font-bold shrink-0 ${activeMode === 'app' ? 'bg-white text-black' : 'text-[#8E92A0]'}`}
          >
            Емулятор
          </button>
          <button
            onClick={() => {
              setActiveMode('widget');
              setPhoneTab('widget');
            }}
            className={`px-3 py-1.5 rounded-xl font-bold shrink-0 ${activeMode === 'widget' ? 'bg-white text-black' : 'text-[#8E92A0]'}`}
          >
            Віджет
          </button>
          <button
            onClick={() => setActiveMode('build')}
            className={`px-3 py-1.5 rounded-xl font-bold shrink-0 ${activeMode === 'build' ? 'bg-[#FF5E3A] text-white' : 'text-[#8E92A0]'}`}
          >
            Збірка & APK
          </button>
          <button
            onClick={() => setActiveMode('code')}
            className={`px-3 py-1.5 rounded-xl font-bold shrink-0 ${activeMode === 'code' ? 'bg-white text-black' : 'text-[#8E92A0]'}`}
          >
            Kotlin
          </button>
          <button
            onClick={() => setActiveMode('playstore')}
            className={`px-3 py-1.5 rounded-xl font-bold shrink-0 ${activeMode === 'playstore' ? 'bg-white text-black' : 'text-[#8E92A0]'}`}
          >
            Play Store
          </button>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 flex flex-col justify-center">
          {activeMode === 'app' && schedule && (
            <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-8 py-2">
              
              {/* Left / Main: The Physical Phone Simulator */}
              <div className="w-full max-w-[420px] shrink-0">
                <PhoneSimulator
                  schedule={effectiveSchedule || schedule}
                  tomorrowSchedule={effectiveTomorrowSchedule}
                  settings={settings}
                  lang={resolvedLang}
                  activeNotification={activeNotification}
                  onDismissNotification={() => setActiveNotification(null)}
                  onToggleNotifications={handleToggleNotifications}
                  onUpdateSettings={handleUpdateSettings}
                  onRefresh={() => loadSchedules(settings)}
                  isRefreshing={isRefreshing}
                  onSendTestAlert={handleSendTestAlert}
                  onResetDefaults={handleResetDefaults}
                  activeTab={phoneTab}
                  setActiveTab={setPhoneTab}
                  now={effectiveNow}
                />
              </div>

              {/* Right: Emulator Testing & Verification Console */}
              <div className="w-full max-w-md flex flex-col gap-4">
                
                {/* Panel 1: Live Emulator Test Controls */}
                <div className="bg-[#141A29]/75 backdrop-blur-2xl rounded-3xl p-5 border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.45)] flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-[#FF5E3A] flex items-center justify-center text-white shadow-sm">
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <h2 className="text-sm font-bold text-white">
                        {resolvedLang === 'uk' ? 'Стенд тестування емулятора' : 'Emulator Test Workbench'}
                      </h2>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                      LIVE ACTIVE
                    </span>
                  </div>

                  <p className="text-xs text-sky-200/70">
                    {resolvedLang === 'uk'
                      ? 'Використовуйте кнопки нижче для миттєвої перевірки реакції додатка, звуку сповіщень та об\'єднання слотів:'
                      : 'Trigger events instantly to verify app responsiveness, audio notifications, and slot aggregation:'}
                  </p>

                  {/* Test Action Buttons */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      onClick={handleSendTestAlert}
                      className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-[#FF5E3A] hover:bg-[#e04e2c] text-white font-bold text-xs shadow-md shadow-[#FF5E3A]/25 transition-all active:scale-95"
                    >
                      <Bell className="w-4 h-4" />
                      <span>{resolvedLang === 'uk' ? 'Тест алярму' : 'Trigger Alert'}</span>
                    </button>

                    <button
                      onClick={() => loadSchedules(settings)}
                      disabled={isRefreshing}
                      className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-all border border-white/10 active:scale-95 disabled:opacity-50"
                    >
                      <RotateCcw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#FF5E3A]' : ''}`} />
                      <span>{resolvedLang === 'uk' ? 'Оновити дані' : 'Refresh Data'}</span>
                    </button>

                    <button
                      type="button"
                      data-testid="emulator-add-power-points-100"
                      onClick={() => {
                        const updated = addPowerPoints(100);
                        if (typeof window !== 'undefined') {
                          window.dispatchEvent(
                            new CustomEvent('zt-roulette-power-points-updated', {
                              detail: { powerPoints: updated },
                            })
                          );
                        }
                      }}
                      className="col-span-2 flex items-center justify-center gap-2 p-3 rounded-2xl bg-[#141A29] hover:bg-white/15 text-[#F5D061] font-bold text-xs transition-all border border-[#D8B467]/60 active:scale-95 shadow-md cursor-pointer"
                    >
                      <Zap className="w-4 h-4 fill-current" />
                      <span>
                        {resolvedLang === 'uk'
                          ? '+100 Балів Потужності'
                          : '+100 Power Points'}
                      </span>
                    </button>

                    <button
                      type="button"
                      data-testid="emulator-set-power-points-9999"
                      onClick={() => {
                        const updated = resetSavedPowerPoints(9999);
                        if (typeof window !== 'undefined') {
                          window.dispatchEvent(
                            new CustomEvent('zt-roulette-power-points-updated', {
                              detail: { powerPoints: updated },
                            })
                          );
                        }
                      }}
                      className="col-span-2 flex items-center justify-center gap-2 p-3 rounded-2xl bg-[#141A29] hover:bg-white/15 text-[#F5D061] font-bold text-xs transition-all border border-[#D8B467]/60 active:scale-95 shadow-md cursor-pointer"
                    >
                      <Zap className="w-4 h-4 fill-current" />
                      <span>
                        {resolvedLang === 'uk'
                          ? 'Встановити Бали Потужності: 9999'
                          : 'Set Power Points to 9999'}
                      </span>
                    </button>

                    <button
                      type="button"
                      data-testid="emulator-reset-game-progress"
                      onClick={() => {
                        resetAllRouletteProgress();
                        if (typeof window !== 'undefined') {
                          window.dispatchEvent(new CustomEvent('zt-roulette-progress-reset'));
                          window.dispatchEvent(
                            new CustomEvent('zt-roulette-power-points-updated', {
                              detail: { powerPoints: 0 },
                            })
                          );
                        }
                      }}
                      className="col-span-2 flex items-center justify-center gap-2 p-3 rounded-2xl bg-rose-950/70 hover:bg-rose-900/70 text-rose-200 font-bold text-xs transition-all border border-rose-500/40 active:scale-95 shadow-md cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>
                        {resolvedLang === 'uk'
                          ? 'Скинути весь прогрес гри (монети, покращення, Бали Потужності)'
                          : 'Reset All Game Progress (Coins, Upgrades, Power Points)'}
                      </span>
                    </button>

                    <button
                      type="button"
                      data-testid="emulator-reset-all-app-data-first-launch"
                      onClick={handleResetAllAppDataFirstLaunch}
                      className="col-span-2 flex items-center justify-center gap-2 p-3 rounded-2xl bg-amber-950/70 hover:bg-amber-900/70 text-amber-200 font-bold text-xs transition-all border border-amber-500/45 active:scale-95 shadow-md cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>
                        {resolvedLang === 'uk'
                          ? 'Скинути всі дані застосунку та імітувати перший запуск'
                          : 'Reset All App Data & Imitate First Launch'}
                      </span>
                    </button>

                    <button
                      type="button"
                      data-testid="emulator-simulate-emergency-outage-kyivska-37"
                      onClick={() => {
                        clearNotifiedHistory();
                        const kyivska37Emergency = getKyivska37DemoEmergencyOutage();
                        const nextSettings: UserSettings = {
                          ...settings,
                          queue: '2.2',
                          customQueueStatusText: undefined,
                          selectedAddress:
                            resolvedLang === 'uk'
                              ? 'Житомирський РЕМ, м. Житомир,\nвул. Київська, буд. 37'
                              : 'Zhytomyr REM, Zhytomyr,\nKyivska St., bldg. 37',
                          selectedAddressQuery: {
                            remId: 'zhytomyr',
                            settlementId: 'zt_city',
                            streetId: 'zt_kyivska',
                            house: '37',
                          },
                          activeEmergencyOutage: kyivska37Emergency,
                        };
                        setSettings(nextSettings);
                        saveUserSettings(nextSettings);
                        setPhoneTab('schedule');
                        loadSchedules(nextSettings);
                        checkAndTriggerEmergencyOutageAlert(
                          null,
                          kyivska37Emergency,
                          nextSettings,
                          resolvedLang,
                          (record) => {
                            setActiveNotification(record);
                          }
                        );
                      }}
                      className="col-span-2 flex items-center justify-center gap-2 p-3 rounded-2xl bg-[#FF5E3A]/20 hover:bg-[#FF5E3A]/30 text-[#FF5E3A] font-bold text-xs transition-all border border-[#FF5E3A]/50 active:scale-95 shadow-md cursor-pointer"
                    >
                      <Zap className="w-4 h-4 fill-current" />
                      <span>
                        {resolvedLang === 'uk'
                          ? 'Житомир, вул. Київська, 37 (Аварійне відключення)'
                          : 'Zhytomyr, Kyivska St., 37 (Emergency Outage)'}
                      </span>
                    </button>
                  </div>

                  {/* Fast Queue Switcher */}
                  <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white">
                        {resolvedLang === 'uk' ? 'Швидка зміна черги' : 'Quick Queue Switch'}:
                      </span>
                      <span className="font-mono text-[#FF5E3A] font-bold">
                        {settings.queue || (resolvedLang === 'uk' ? 'Виберіть чергу' : 'Queue not selected')}
                      </span>
                    </div>

                    <div className="grid grid-cols-6 gap-1.5">
                      {['1.1', '1.2', '2.1', '2.2', '3.1', '3.2', '4.1', '4.2', '5.1', '5.2', '6.1', '6.2'].map((q) => (
                        <button
                          key={q}
                          onClick={() =>
                            handleUpdateSettings({
                              ...settings,
                              queue: q,
                              customQueueStatusText: undefined,
                              selectedAddress: undefined,
                              selectedAddressQuery: undefined,
                              activeEmergencyOutage: null,
                            })
                          }
                          className={`py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                            settings.queue === q
                              ? 'bg-[#FF5E3A] text-white shadow-sm'
                              : 'bg-white/5 hover:bg-white/10 text-sky-200/80 border border-white/5'
                          }`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Time of Day Background Preview */}
                  <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white">
                        {resolvedLang === 'uk' ? 'Час доби (Фон)' : 'Time of Day (Background)'}:
                      </span>
                      <span className="font-mono text-[#FF5E3A] font-bold">
                        {effectiveNow.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="grid grid-cols-5 gap-1.5">
                      {([
                        { id: 'auto', uk: 'Авто', en: 'Auto' },
                        { id: 'morning', uk: 'Ранок', en: 'Morning' },
                        { id: 'day', uk: 'День', en: 'Day' },
                        { id: 'evening', uk: 'Вечір', en: 'Evening' },
                        { id: 'night', uk: 'Ніч', en: 'Night' },
                      ] as const).map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setTimeOfDayOverride(item.id)}
                          className={`py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                            timeOfDayOverride === item.id
                              ? 'bg-[#FF5E3A] text-white shadow-sm'
                              : 'bg-white/5 hover:bg-white/10 text-sky-200/80 border border-white/5'
                          }`}
                        >
                          {resolvedLang === 'uk' ? item.uk : item.en}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Rule 1 Check: Consecutive Timeslot Aggregation */}
                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <div className="font-bold text-emerald-300">
                        {resolvedLang === 'uk' ? 'Правило 1 сповіщення діє:' : 'Single Alert Rule Active:'}
                      </div>
                      <div className="text-emerald-100/80 text-[11px] mt-0.5 leading-relaxed">
                        {resolvedLang === 'uk'
                          ? 'Кілька послідовних годин відключення об\'єднані в один блок. Повторні алярми заблоковані.'
                          : 'Consecutive outage hours merged into one window. Duplicate alarms suppressed.'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Panel 2: Direct Build & Deploy Quick CTA */}
                <div className="bg-[#141A29]/75 backdrop-blur-2xl rounded-3xl p-5 border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.45)] flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-sky-200/70">
                      {resolvedLang === 'uk' ? 'Готово до інсталяції' : 'Ready for Installation'}
                    </h3>
                    <span className="text-[10px] font-mono text-zinc-400">Kotlin M3</span>
                  </div>

                  <p className="text-xs text-zinc-300 leading-relaxed">
                    {resolvedLang === 'uk'
                      ? 'Всі вихідні коди Android протестовані. Завантажте готовий архів або запустіть хмарну збірку APK:'
                      : 'All Android source files verified. Download project zip or build APK in cloud:'}
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => setActiveMode('build')}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-all shadow-md"
                    >
                      <PackageCheck className="w-4 h-4" />
                      <span>{resolvedLang === 'uk' ? 'Збірка & Завантажити APK' : 'Build & Get APK'}</span>
                    </button>

                    <a
                      href="/Android-ZTBlackoutPreWarning.zip"
                      download="Android-ZTBlackoutPreWarning.zip"
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-all border border-white/10"
                      title="Завантажити ZIP"
                    >
                      <Download className="w-4 h-4 text-[#FF5E3A]" />
                      <span>.ZIP</span>
                    </a>
                  </div>
                </div>

              </div>

            </div>
          )}

          {activeMode === 'build' && (
            <BuildAndDownloadView
              settings={settings}
              lang={resolvedLang}
              onOpenEmulator={() => {
                setActiveMode('app');
                setPhoneTab('schedule');
              }}
              onSendTestAlert={handleSendTestAlert}
            />
          )}

          {activeMode === 'widget' && schedule && (
            <div className="flex flex-col items-center justify-center">
              <WidgetSimulator
                schedule={effectiveSchedule || schedule}
                tomorrowSchedule={effectiveTomorrowSchedule}
                now={effectiveNow}
                settings={settings}
                lang={resolvedLang}
                onToggleNotifications={handleToggleNotifications}
                onRefresh={() => loadSchedules(settings)}
                isRefreshing={isRefreshing}
                onOpenApp={() => {
                  setActiveMode('app');
                  setPhoneTab('schedule');
                }}
              />
            </div>
          )}

          {activeMode === 'code' && (
            <CodeExplorer />
          )}

          {activeMode === 'playstore' && (
            <PlayStoreGuide />
          )}
        </main>

        {/* Global Footer */}
        <footer className="border-t border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div>
              <span>Світло в Житомирі · Розробник: </span>
              <a href="https://github.com/IgorZaharov" target="_blank" rel="noreferrer" className="font-semibold text-slate-800 dark:text-slate-200 underline">
                Ігор Захаров (Igor Zaharov)
              </a>
            </div>
            <div className="flex items-center gap-4 text-[11px]">
              <a href="https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning/issues" target="_blank" rel="noreferrer" className="hover:underline text-rose-600 dark:text-rose-400">
                Повідомити про проблему (GitHub Issues)
              </a>
              <span>·</span>
              <a href="https://www.ztoe.com.ua/unhooking-search.php" target="_blank" rel="noreferrer" className="hover:underline">
                ztoe.com.ua
              </a>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
}
