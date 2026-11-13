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
import { UserSettings, NotificationRecord, Language } from './types';
import { checkAddressOnZtoeWebsite, prefetchAddressIndexInBackground } from './services/ztoeAddressLookup';
import { getSubscriptionSync } from './services/subscriptionSync';
import { displayLabel, viewItem, widgetItem, widgetLabel, type Subscription } from './core/subscriptions';
import {
  loadUserSettings,
  saveUserSettings,
  createTestNotification,
  checkAndTriggerGroupedAlerts,
  triggerEmergencyEventAlerts,
  DEFAULT_SETTINGS,
  clearNotifiedHistory,
  resetAllAppDataToFirstLaunch
} from './services/alertManager';
import { resolveLanguage, translations } from './services/i18n';
import { getInterpolatedTimePalette } from './services/timeOfDayPalette';
import { getOutageRepository } from './services/outageRepository';
import { getOutageStateStore } from './services/outageStore';
import { getScheduleCache } from './services/scheduleCache';
import { fromInstant, localDateTimeOf, plusMinutes, type LocalDateTime } from './core/localTime';
import { EmergencyFetch, reconcile } from './core/emergencyLedger';
import type { EmergencyRecord } from './core/outageModels';
import { PhoneSimulator } from './components/PhoneSimulator';
import { CodeExplorer } from './components/CodeExplorer';
import { PlayStoreGuide } from './components/PlayStoreGuide';
import { WidgetSimulator } from './components/WidgetSimulator';
import { BuildAndDownloadView } from './components/BuildAndDownloadView';
import { addPowerPoints, resetAllRouletteProgress, resetSavedPowerPoints } from './services/rouletteGame';

type RefreshStatus = 'SUCCESS' | 'NO_INTERNET' | 'NO_QUEUES_FOUND';

/** Id of the ledger entry written by the "Simulate emergency" workbench button. */
const SIMULATED_EMERGENCY_ID = 'simulator-emergency';

/** The single-address settings an item is drawn with (main view and widgets show it like the primary). */
function settingsOfItem(settings: UserSettings, item: Subscription | null): UserSettings {
  if (!item) return settings;
  const a = item.address;
  return {
    ...settings,
    queue: item.queue ?? '',
    customQueueStatusText: item.queueStatusText ?? undefined,
    selectedAddress: a ? a.text || displayLabel(item) : undefined,
    selectedAddressQuery: a ? { remId: a.remSlug, settlementId: a.settlementId, streetId: a.streetId, house: a.house } : undefined,
  };
}

export default function App() {
  // The multi-address store is migrated on first start; the master switch is copied into the settings
  // so the bells show it (spec/SUBSCRIPTIONS.md section 7)
  const [settings, setSettings] = useState<UserSettings>(() => {
    const loaded = loadUserSettings();
    return { ...loaded, alertsMaster: getSubscriptionSync().master(loaded) };
  });
  // Bumped after every refresh so the outage snapshot is rebuilt from the freshly stored state
  const [dataVersion, setDataVersion] = useState(0);
  // The address the main view shows (spec/SUBSCRIPTIONS.md 9): session state, a fresh start shows the primary
  const [shownSubscriptionId, setShownSubscriptionId] = useState<string | null>(null);
  const shownOtherIdRef = React.useRef<string | null>(null);
  // The address of the simulated widgets (spec/SUBSCRIPTIONS.md 10): null = follow the primary
  const [widgetBoundId, setWidgetBoundId] = useState<string | null>(null);
  const widgetOtherIdRef = React.useRef<string | null>(null);
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

  // One refresh pipeline (OutageRepository.refresh): ztoe schedule + PowerOn emergencies/repairs for the selected address.
  // A source that fails keeps its previous data; emergency events (start / ETA changed / end) are announced once.
  const skipNextSettingsRefresh = React.useRef(false);
  const loadSchedules = useCallback(async (currentSettings: UserSettings, force = false): Promise<RefreshStatus> => {
    setIsRefreshing(true);
    try {
      const repo = getOutageRepository();
      let effective = currentSettings;

      // A house that "is not disconnected" can get a queue later: re-check the address when no queue is stored
      if (currentSettings.selectedAddressQuery && (!currentSettings.queue || currentSettings.queue.trim() === '')) {
        const latest = await checkAddressOnZtoeWebsite(currentSettings.selectedAddressQuery, currentSettings.url);
        if (latest && ((latest.queue || '') !== currentSettings.queue || latest.statusText !== currentSettings.customQueueStatusText)) {
          // into the primary subscription, which is mirrored back into the single-address fields
          const synced = getSubscriptionSync().assignPrimaryQueue(
            currentSettings,
            latest.queue || null,
            latest.queue ? null : (latest.statusText ?? null),
            null
          );
          if (synced.result.ok) {
            effective = synced.settings;
            skipNextSettingsRefresh.current = true;
            setSettings(effective);
            saveUserSettings(effective);
          }
        }
      }

      // The notifications are delivered here (not inside refresh) so the in-app heads-up card shows them too
      const outcome = await repo.refresh(
        effective,
        force,
        false,
        shownOtherIdRef.current,
        widgetOtherIdRef.current ? [widgetOtherIdRef.current] : []
      );
      const key = repo.addressKey(effective.selectedAddressQuery);
      if (key && outcome.events.length > 0) {
        triggerEmergencyEventAlerts(
          outcome.events,
          key,
          effective,
          resolveLanguage(effective.language),
          fromInstant(Date.now()),
          (record) => setActiveNotification(record),
          {
            subscriptionId: getSubscriptionSync().store(effective).primaryId,
            plannedSpans: outcome.plannedSpans,
            plannedAlertsOn: outcome.plannedAlertsOn,
          }
        );
      }
      // The other addresses that want emergency alerts (spec/SUBSCRIPTIONS.md 8.4)
      for (const other of outcome.otherEvents) {
        triggerEmergencyEventAlerts(
          other.events,
          other.addressKey,
          effective,
          resolveLanguage(effective.language),
          fromInstant(Date.now()),
          (record) => setActiveNotification(record),
          {
            addressLine: other.addressLine,
            enabled: true,
            subscriptionId: other.itemId,
            plannedSpans: other.plannedSpans,
            plannedAlertsOn: other.plannedAlertsOn,
          }
        );
      }
      setDataVersion((v) => v + 1);
      return outcome.fetchStatus ?? 'SUCCESS';
    } catch (err) {
      console.error('Failed to refresh outage data:', err);
      setDataVersion((v) => v + 1);
      return 'NO_INTERNET';
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Refresh on load and whenever the queue, the site or the address changes
  useEffect(() => {
    if (skipNextSettingsRefresh.current) {
      skipNextSettingsRefresh.current = false;
      setDataVersion((v) => v + 1);
      return;
    }
    loadSchedules(settings);
  }, [
    loadSchedules,
    settings.queue,
    settings.url,
    settings.selectedAddress,
    settings.selectedAddressQuery?.remId,
    settings.selectedAddressQuery?.settlementId,
    settings.selectedAddressQuery?.streetId,
    settings.selectedAddressQuery?.house,
  ]);

  // Automatically refresh timer and drum bar when User enters main screen
  useEffect(() => {
    if (activeMode === 'app' && phoneTab === 'schedule') {
      setNow(new Date());
      loadSchedules(settings);
    }
  }, [activeMode, phoneTab]);

  // Periodic background refresh at the chosen interval
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

  // Pre-load and index REMs, cities, and active city streets in the background after initial UI render
  useEffect(() => {
    const timer = setTimeout(() => {
      prefetchAddressIndexInBackground(settings.url, settings.selectedAddressQuery).catch(() => {});
    }, 150);
    return () => clearTimeout(timer);
  }, [settings.url]);

  // Battery & Power optimization: shared system clock state
  const [now, setNow] = useState<Date>(() => new Date());
  const [timeOfDayOverride, setTimeOfDayOverride] = useState<'auto' | 'morning' | 'day' | 'evening' | 'night'>('auto');

  // Background ticker: updates the countdown and fires the planned pre-warnings (the web stand-in for the exact alarms).
  // 1s on the countdown screens, 15s elsewhere, 30s while the browser tab is hidden (battery).
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
        // The cached table is valid for one day: fetch the new day's table
        loadSchedules(settings);
      }

      // Planned pre-warnings for every address, one per queue and span (spec/SUBSCRIPTIONS.md section 8)
      const sync = getSubscriptionSync();
      const master = sync.master(settings);
      if (master) {
        const realNow = fromInstant(currentNow.getTime());
        const repo = getOutageRepository();
        checkAndTriggerGroupedAlerts(
          sync.store(settings),
          master,
          (queue, key) => repo.outagesFor(queue, key, realNow),
          realNow,
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
  }, [settings, resolvedLang, activeMode, phoneTab, loadSchedules]);

  // Handle setting updates
  const handleUpdateSettings = (newSettings: UserSettings) => {
    setSettings(newSettings);
    saveUserSettings(newSettings);
  };

  // The bells (main header, widget) are the master switch for all addresses (owner decision 4)
  const handleToggleNotifications = () => {
    const sync = getSubscriptionSync();
    handleUpdateSettings(sync.setMaster(settings, !sync.master(settings)));
  };

  const handleSendTestAlert = () => {
    const slot = snapshot.slotsFor(snapshot.today).find((s) => s.status === 'POWER_OFF');
    const record = createTestNotification(settings, resolvedLang, slot);
    setActiveNotification(record);
  };

  const handleResetDefaults = () => {
    getSubscriptionSync().clear();
    clearNotifiedHistory();
    getOutageStateStore().clearAll();
    getScheduleCache().clear();
    setSettings(DEFAULT_SETTINGS);
    saveUserSettings(DEFAULT_SETTINGS);
  };

  const handleResetAllAppDataFirstLaunch = () => {
    getSubscriptionSync().clear();
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

  // The Kyiv wall clock of the shown moment. With a time-of-day override the simulated local clock is used as is.
  const nowLdt = React.useMemo<LocalDateTime>(() => {
    if (timeOfDayOverride === 'auto') return fromInstant(now.getTime());
    return (
      localDateTimeOf(
        effectiveNow.getFullYear(),
        effectiveNow.getMonth() + 1,
        effectiveNow.getDate(),
        effectiveNow.getHours(),
        effectiveNow.getMinutes(),
        effectiveNow.getSeconds()
      ) ?? fromInstant(now.getTime())
    );
  }, [now, effectiveNow, timeOfDayOverride]);

  // One snapshot (local state only) feeds the main screen, the widgets and the roulette; dataVersion bumps after every refresh
  const snapshot = React.useMemo(
    () => getOutageRepository().snapshot(settings, nowLdt),
    [settings, nowLdt, dataVersion]
  );

  // The main view can show another address (step 4); widgets and the roulette keep the primary
  const subscriptionStore = React.useMemo(() => getSubscriptionSync().store(settings), [settings]);
  const shownOther = React.useMemo(() => {
    const item = viewItem(subscriptionStore, shownSubscriptionId);
    return item !== null && item.id !== subscriptionStore.primaryId ? item : null;
  }, [subscriptionStore, shownSubscriptionId]);
  shownOtherIdRef.current = shownOther?.id ?? null;
  const mainSnapshot = React.useMemo(
    () => (shownOther ? getOutageRepository().snapshotFor(shownOther, nowLdt) : snapshot),
    [shownOther, snapshot, nowLdt, dataVersion]
  );
  const mainSettings = React.useMemo<UserSettings>(() => settingsOfItem(settings, shownOther), [settings, shownOther]);

  // The widgets show their bound address, else the primary (step 5); a removed binding falls back visibly
  const widgetOther = React.useMemo(() => {
    const item = widgetItem(subscriptionStore, widgetBoundId);
    return item !== null && item.id !== subscriptionStore.primaryId ? item : null;
  }, [subscriptionStore, widgetBoundId]);
  widgetOtherIdRef.current = widgetOther?.id ?? null;
  const widgetSnapshot = React.useMemo(
    () => (widgetOther ? getOutageRepository().snapshotFor(widgetOther, nowLdt) : snapshot),
    [widgetOther, snapshot, nowLdt, dataVersion]
  );
  const widgetSettings = React.useMemo<UserSettings>(() => settingsOfItem(settings, widgetOther), [settings, widgetOther]);
  const widgetAddressLabel = widgetLabel(subscriptionStore, widgetBoundId);
  const widgetItemId = widgetItem(subscriptionStore, widgetBoundId)?.id ?? null;
  const widgetOtherId = widgetOther?.id ?? null;
  useEffect(() => {
    if (widgetOtherId !== null) loadSchedules(settings);
  }, [widgetOtherId]);
  // Another address is shown: poll its PowerOn too (its switches gate notifications only)
  const shownOtherId = shownOther?.id ?? null;
  useEffect(() => {
    if (shownOtherId !== null) loadSchedules(settings);
  }, [shownOtherId]);

  /** Workbench tool: writes a simulated emergency into the ledger (through the same reconcile the refresh uses) so the new pipeline shows and announces it. */
  const handleSimulateEmergency = () => {
    clearNotifiedHistory();
    const nextSettings: UserSettings = {
      ...settings,
      queue: settings.queue || '2.2',
      customQueueStatusText: undefined,
      selectedAddress:
        settings.selectedAddress ??
        (resolvedLang === 'uk'
          ? 'Житомирський РЕМ, м. Житомир,\nвул. Київська, буд. 37'
          : 'Zhytomyr REM, Zhytomyr,\nKyivska St., bldg. 37'),
      selectedAddressQuery: settings.selectedAddressQuery ?? {
        remId: 'zhytomyr',
        settlementId: 'zt_city',
        streetId: 'zt_kyivska',
        house: '37',
      },
    };
    const repo = getOutageRepository();
    const key = repo.addressKey(nextSettings.selectedAddressQuery);
    if (key) {
      const store = getOutageStateStore();
      const at = fromInstant(Date.now());
      const record: EmergencyRecord = {
        id: SIMULATED_EMERGENCY_ID,
        start: plusMinutes(at, -35),
        estimatedEnd: plusMinutes(at, 125),
        closedAt: null,
        label: null,
      };
      const previous = store.ledger(key).filter((e) => e.id !== SIMULATED_EMERGENCY_ID);
      const result = reconcile(previous, EmergencyFetch.Confirmed([record]), at);
      store.saveLedger(key, result.entries);
      triggerEmergencyEventAlerts(result.events, key, nextSettings, resolvedLang, at, (r) => setActiveNotification(r));
    }
    // the settings change below must not start a refresh right away: a live PowerOn answer would close the simulated entry
    const refreshWouldRun =
      nextSettings.queue !== settings.queue ||
      nextSettings.selectedAddress !== settings.selectedAddress ||
      nextSettings.selectedAddressQuery?.streetId !== settings.selectedAddressQuery?.streetId ||
      nextSettings.selectedAddressQuery?.house !== settings.selectedAddressQuery?.house;
    if (refreshWouldRun) skipNextSettingsRefresh.current = true;
    setSettings(nextSettings);
    saveUserSettings(nextSettings);
    setPhoneTab('schedule');
    setDataVersion((v) => v + 1);
  };

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
          {activeMode === 'app' && (
            <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-8 py-2">
              
              {/* Left / Main: The Physical Phone Simulator */}
              <div className="w-full max-w-[420px] shrink-0">
                <PhoneSimulator
                  snapshot={snapshot}
                  mainSnapshot={mainSnapshot}
                  mainSettings={mainSettings}
                  subscriptionStore={subscriptionStore}
                  shownSubscriptionId={viewItem(subscriptionStore, shownSubscriptionId)?.id ?? null}
                  onSelectSubscription={setShownSubscriptionId}
                  widgetSnapshot={widgetSnapshot}
                  widgetSettings={widgetSettings}
                  widgetAddressLabel={widgetAddressLabel}
                  widgetBoundId={widgetBoundId}
                  onBindWidget={setWidgetBoundId}
                  widgetItemId={widgetItemId}
                  onOpenNotification={(record) => {
                    if (record.subscriptionId) setShownSubscriptionId(record.subscriptionId);
                    setPhoneTab('schedule');
                    setActiveNotification(null);
                  }}
                  settings={settings}
                  lang={resolvedLang}
                  activeNotification={activeNotification}
                  onDismissNotification={() => setActiveNotification(null)}
                  onToggleNotifications={handleToggleNotifications}
                  onUpdateSettings={handleUpdateSettings}
                  onRefresh={() => loadSchedules(settings, true)}
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
                      onClick={handleSimulateEmergency}
                      className="col-span-2 flex items-center justify-center gap-2 p-3 rounded-2xl bg-[#FF5E3A]/20 hover:bg-[#FF5E3A]/30 text-[#FF5E3A] font-bold text-xs transition-all border border-[#FF5E3A]/50 active:scale-95 shadow-md cursor-pointer"
                    >
                      <Zap className="w-4 h-4 fill-current" />
                      <span>
                        {resolvedLang === 'uk'
                          ? 'Симулювати аварійне відключення (Житомир, Київська, 37)'
                          : 'Simulate emergency outage (Zhytomyr, Kyivska St., 37)'}
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

          {activeMode === 'widget' && (
            <div className="flex flex-col items-center justify-center">
              <WidgetSimulator
                snapshot={widgetSnapshot}
                now={effectiveNow}
                settings={widgetSettings}
                lang={resolvedLang}
                onToggleNotifications={handleToggleNotifications}
                onRefresh={() => loadSchedules(settings, true)}
                isRefreshing={isRefreshing}
                addressLabel={widgetAddressLabel}
                subscriptionStore={subscriptionStore}
                boundId={widgetBoundId}
                onBind={setWidgetBoundId}
                onOpenApp={() => {
                  if (widgetItemId) setShownSubscriptionId(widgetItemId);
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
