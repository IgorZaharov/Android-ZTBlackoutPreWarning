import React, { useState } from 'react';
import { 
  RotateCcw, 
  Send, 
  Globe, 
  Volume2, 
  Vibrate, 
  Bell, 
  Clock, 
  Sliders, 
  AlertTriangle,
  HelpCircle,
  X,
  ExternalLink,
  Zap
} from 'lucide-react';
import { UserSettings, Language } from '../types';
import { QUEUES, DEFAULT_ZTOE_URL, verifyZtoeSiteAndData } from '../services/ztoeParser';
import {
  getRems,
  getSettlementsForRem,
  getStreetsForSettlement,
  getHousesForStreet,
  fetchRemsFromZtoe,
  fetchSettlementsForRem,
  fetchStreetsForSettlement,
  fetchHousesForStreet,
  checkAddressOnZtoeWebsite
} from '../services/ztoeAddressLookup';
import { toggleMasterNotifications, toggleEmergencyNotifications } from '../services/alertManager';
import { translations } from '../services/i18n';

interface SettingsViewProps {
  settings: UserSettings;
  lang: 'uk' | 'en';
  onUpdateSettings: (newSettings: UserSettings) => void;
  onSendTestAlert: () => void;
  onForceRefresh: () => Promise<'SUCCESS' | 'NO_INTERNET' | 'NO_QUEUES_FOUND' | void> | void;
  onResetDefaults: () => void;
  autoOpenQueueHelp?: boolean;
  onQueueHelpOpened?: () => void;
  onNavigateToMain?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  lang,
  onUpdateSettings,
  onSendTestAlert,
  onForceRefresh,
  onResetDefaults,
  autoOpenQueueHelp = false,
  onQueueHelpOpened,
  onNavigateToMain
}) => {
  const t = translations[lang];
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [showQueueHelp, setShowQueueHelp] = useState(Boolean(autoOpenQueueHelp));
  const [selectedRemId, setSelectedRemId] = useState<string>(
    settings.selectedAddressQuery?.remId || 'zhytomyr'
  );
  const [selectedSettlementId, setSelectedSettlementId] = useState<string>(
    settings.selectedAddressQuery?.settlementId || 'zt_city'
  );
  const [selectedStreetId, setSelectedStreetId] = useState<string>(
    settings.selectedAddressQuery?.streetId || ''
  );
  const [selectedHouseNumber, setSelectedHouseNumber] = useState<string>(
    settings.selectedAddressQuery?.house || ''
  );
  const [rems, setRems] = useState(() => getRems());
  const [settlements, setSettlements] = useState(() => getSettlementsForRem(selectedRemId));
  const [streets, setStreets] = useState(() => getStreetsForSettlement(selectedSettlementId));
  const [houses, setHouses] = useState(() => getHousesForStreet(selectedStreetId));
  const [verification, setVerification] = useState<{
    isChecking: boolean;
    isAvailable: boolean;
    hasData: boolean;
    status: 'SUCCESS' | 'NO_INTERNET' | 'NO_QUEUES_FOUND';
    message: string;
  }>({
    isChecking: false,
    isAvailable: true,
    hasData: true,
    status: 'SUCCESS',
    message: ''
  });

  React.useEffect(() => {
    if (autoOpenQueueHelp) {
      setShowQueueHelp(true);
      onQueueHelpOpened?.();
    }
  }, [autoOpenQueueHelp, onQueueHelpOpened]);

  // Keep selected address fields in the "?" popup filled in with the user's saved address when re-entering Settings or reopening the "?" popup
  React.useEffect(() => {
    if (settings.selectedAddressQuery) {
      setSelectedRemId(settings.selectedAddressQuery.remId || 'zhytomyr');
      setSelectedSettlementId(settings.selectedAddressQuery.settlementId || 'zt_city');
      setSelectedStreetId(settings.selectedAddressQuery.streetId || '');
      setSelectedHouseNumber(settings.selectedAddressQuery.house || '');
    } else if (!settings.selectedAddress && !settings.queue) {
      setSelectedRemId('zhytomyr');
      setSelectedSettlementId('zt_city');
      setSelectedStreetId('');
      setSelectedHouseNumber('');
    }
  }, [
    settings.selectedAddressQuery?.remId,
    settings.selectedAddressQuery?.settlementId,
    settings.selectedAddressQuery?.streetId,
    settings.selectedAddressQuery?.house,
    settings.selectedAddress,
    settings.queue,
    showQueueHelp
  ]);

  // Refresh the list of all REMs, Cities, and Streets (plus bulk-indexed houses for all streets in the settlement)
  // whenever User enters the "?" screen or changes REM/Settlement, without re-running when User selects a Street
  React.useEffect(() => {
    setRems(getRems());
    setSettlements(getSettlementsForRem(selectedRemId));
    setStreets(getStreetsForSettlement(selectedSettlementId));
    if (!showQueueHelp) return;

    let cancelled = false;
    (async () => {
      if (selectedSettlementId) {
        const freshStreets = await fetchStreetsForSettlement(
          selectedRemId,
          selectedSettlementId,
          settings.url,
          true
        );
        if (!cancelled && freshStreets.length > 0) {
          setStreets(freshStreets);
          setRems(getRems());
          setSettlements(getSettlementsForRem(selectedRemId));
          if (selectedStreetId) {
            const indexedHouses = getHousesForStreet(selectedStreetId);
            if (indexedHouses.length > 0) {
              setHouses(indexedHouses);
            }
          }
        }
      }
      const [freshRems, freshSettlements] = await Promise.all([
        fetchRemsFromZtoe(settings.url, true),
        fetchSettlementsForRem(selectedRemId, settings.url, true),
      ]);
      if (!cancelled && freshRems.length > 0) {
        setRems(freshRems);
      }
      if (!cancelled && freshSettlements.length > 0) {
        setSettlements(freshSettlements);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showQueueHelp, selectedRemId, selectedSettlementId, settings.url]);

  // Immediately populate all houses for the selected street in 0ms from the settlement-wide bulk index
  React.useEffect(() => {
    setHouses(getHousesForStreet(selectedStreetId));
    if (!showQueueHelp || !selectedStreetId) return;

    let cancelled = false;
    (async () => {
      const freshHouses = await fetchHousesForStreet(
        selectedRemId,
        selectedSettlementId,
        selectedStreetId,
        settings.url,
        true
      );
      if (!cancelled && freshHouses.length > 0) {
        setHouses(freshHouses);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showQueueHelp, selectedRemId, selectedSettlementId, selectedStreetId, settings.url]);

  // 4. When User selects a House, check ZTOE (including live pw_accidents emergency outages) and enrich the house record
  React.useEffect(() => {
    if (!showQueueHelp || !selectedStreetId || !selectedHouseNumber) return;

    let cancelled = false;
    (async () => {
      const checked = await checkAddressOnZtoeWebsite(
        {
          remId: selectedRemId,
          settlementId: selectedSettlementId,
          streetId: selectedStreetId,
          house: selectedHouseNumber,
        },
        settings.url
      );
      if (!cancelled && checked) {
        setHouses((prev) => {
          const exists = prev.some((h) => h.house === checked.house);
          if (!exists) return [...prev, checked];
          return prev.map((h) => (h.house === checked.house ? { ...h, ...checked } : h));
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showQueueHelp, selectedRemId, selectedSettlementId, selectedStreetId, selectedHouseNumber, settings.url]);

  const matchedHouseRecord = houses.find((h) => h.house === selectedHouseNumber) || null;
  const selectedRemObj = rems.find((r) => r.id === selectedRemId);
  const selectedSettlementObj = settlements.find((s) => s.id === selectedSettlementId);
  const selectedStreetObj = streets.find((st) => st.id === selectedStreetId);
  const selectedAddressStr = selectedHouseNumber
    ? lang === 'uk'
      ? `${selectedRemObj?.nameUk || ''}, ${selectedSettlementObj?.nameUk || ''},\n${selectedStreetObj?.nameUk || ''}, буд. ${selectedHouseNumber}`
      : `${selectedRemObj?.nameEn || ''}, ${selectedSettlementObj?.nameEn || ''},\n${selectedStreetObj?.nameEn || ''}, bldg. ${selectedHouseNumber}`
    : undefined;

  // Verify site accessibility and data presence against /valid-urls.json on URL or queue change
  React.useEffect(() => {
    let isMounted = true;
    setVerification(prev => ({ ...prev, isChecking: true }));

    const timer = setTimeout(async () => {
      const res = await verifyZtoeSiteAndData(settings.url, settings.queue);
      if (isMounted) {
        setVerification({
          isChecking: false,
          isAvailable: res.isAvailable,
          hasData: res.hasData,
          status: res.status,
          message: lang === 'uk' ? res.messageUk : res.messageEn
        });
      }
    }, 350);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [settings.url, settings.queue, lang]);

  const handleForceRefreshWithVerification = async () => {
    setVerification(prev => ({ ...prev, isChecking: true }));
    await onForceRefresh();
    const res = await verifyZtoeSiteAndData(settings.url, settings.queue);
    const msg = lang === 'uk' ? res.messageUk : res.messageEn;
    setVerification({
      isChecking: false,
      isAvailable: res.isAvailable,
      hasData: res.hasData,
      status: res.status,
      message: msg
    });
    showToast(msg);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="flex flex-col gap-4 max-w-lg mx-auto select-none">
      {/* Toast Feedback with Application Icon (white lightning on #FF5E3A rounded square) */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-[#141A29]/95 backdrop-blur-2xl text-white text-xs py-2 px-4 rounded-2xl shadow-2xl flex items-center gap-2.5 border border-white/20">
          <div className="w-6 h-6 rounded-lg bg-[#FF5E3A] flex items-center justify-center text-white shrink-0">
            <Zap className="w-3.5 h-3.5 fill-current" />
          </div>
          <span className="font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2.5 pt-1">
        <Sliders className="w-5 h-5 text-[#FF5E3A]" />
        <h2 className="text-xl font-bold text-white tracking-tight">
          {t.settingsTitle}
        </h2>
      </div>

      {/* 1. Queue Selection (Only Drop-down List + ? Help Glyph) */}
      <div className="bg-[#141A29]/75 backdrop-blur-2xl rounded-3xl p-5 border border-white/15 shadow-[0_16px_44px_rgba(0,0,0,0.55)] flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-white uppercase tracking-wider">
                {t.settingsQueue}
              </label>
            </div>
            <p className="text-[11px] text-sky-200/70 mt-0.5">
              {t.settingsQueueDesc}
            </p>
          </div>
          {/* Prominent ? button which triggers the queue lookup & help popup */}
          <button
            type="button"
            data-testid="settings-queue-help-btn"
            onClick={() => setShowQueueHelp(true)}
            className="w-10 h-10 rounded-2xl bg-[#FF5E3A] hover:bg-[#ff4b24] text-white flex items-center justify-center transition-all cursor-pointer border border-white/25 shadow-lg shadow-[#FF5E3A]/35 shrink-0 active:scale-95"
            title={lang === 'uk' ? 'Як дізнатися свою чергу' : 'How to find your queue'}
            aria-label={lang === 'uk' ? 'Як дізнатися свою чергу' : 'How to find your queue'}
          >
            <HelpCircle className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Clean Dropdown */}
        <select
          value={settings.queue}
          onChange={(e) =>
            onUpdateSettings({
              ...settings,
              queue: e.target.value,
              customQueueStatusText: undefined,
              selectedAddress: undefined,
              selectedAddressQuery: undefined,
              activeEmergencyOutage: null
            })
          }
          className="w-full text-base font-bold bg-white/[0.08] backdrop-blur-md border border-white/15 rounded-2xl px-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-[#FF5E3A] cursor-pointer"
        >
          <option value="" className="bg-[#141A29] text-white">
            {lang === 'uk' ? 'Виберіть чергу' : 'Queue not selected'}
          </option>
          {QUEUES.map((q) => (
            <option key={q.id} value={q.id} className="bg-[#141A29] text-white">
              {t.queue} {q.id}
            </option>
          ))}
        </select>
      </div>

      {/* 2. Site Address with Reachability and Data Verification Glyph */}
      <div className="bg-[#141A29]/75 backdrop-blur-2xl rounded-3xl p-5 border border-white/15 shadow-[0_16px_44px_rgba(0,0,0,0.55)] flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
            <Globe className="w-3.5 h-3.5 text-[#FF5E3A]" />
            <span>{t.settingsProviderUrl}</span>
          </label>

          {/* Small Reachability & Data Status Glyph */}
          <div className="flex items-center gap-1.5">
            {verification.isChecking && (
              <span className="flex items-center gap-1 text-[11px] text-sky-300 font-mono">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                <span>{lang === 'uk' ? 'Перевірка сайту і даних...' : 'Checking data...'}</span>
              </span>
            )}
            {!verification.isChecking && verification.status === 'SUCCESS' && (
              <span 
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[11px] font-bold"
                title={verification.message}
              >
                <span className="w-4 h-4 rounded-full bg-emerald-500 text-black flex items-center justify-center text-[10px] font-black">✓</span>
                <span>{lang === 'uk' ? 'Доступний' : 'Reachable'}</span>
              </span>
            )}
            {!verification.isChecking && verification.status === 'NO_QUEUES_FOUND' && (
              <span 
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[11px] font-bold"
                title={verification.message}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{t.errorNoQueuesFound}</span>
              </span>
            )}
            {!verification.isChecking && verification.status === 'NO_INTERNET' && (
              <span 
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-[11px] font-bold"
                title={verification.message}
              >
                <X className="w-3.5 h-3.5" />
                <span>{t.errorNoInternet}</span>
              </span>
            )}
          </div>
        </div>

        <p className="text-[11px] text-sky-200/70">
          {t.settingsProviderDesc}
        </p>

        <div className="relative flex items-center">
          <input
            type="text"
            value={settings.url}
            onChange={(e) => onUpdateSettings({ ...settings, url: e.target.value })}
            className="w-full text-xs bg-white/[0.08] backdrop-blur-md border border-white/15 rounded-2xl pl-4 pr-10 py-3 text-white font-mono focus:outline-none focus:ring-2 focus:ring-[#FF5E3A]"
            placeholder={DEFAULT_ZTOE_URL}
          />
          <div className="absolute right-3 pointer-events-none">
            {!verification.isChecking && verification.status === 'SUCCESS' && (
              <div className="w-5 h-5 rounded-full bg-emerald-500 text-black flex items-center justify-center text-xs font-black shadow-sm shadow-emerald-500/50">
                ✓
              </div>
            )}
          </div>
        </div>

        {verification.message && (
          <div className="text-[10px] text-sky-200/60 font-mono">
            {verification.message}
          </div>
        )}
      </div>

      {/* 3. Timers: Clean Edit Boxes restricted strictly to 1..240 */}
      <div className="bg-[#141A29]/75 backdrop-blur-2xl rounded-3xl p-5 border border-white/15 shadow-[0_16px_44px_rgba(0,0,0,0.55)] flex flex-col gap-4">
        
        {/* Advance Alert Notice - Default 15 min (CRITICAL CONSTANT) */}
        <div>
          <label className="text-xs font-bold text-white flex items-center gap-1.5 mb-1 uppercase tracking-wider">
            <Bell className="w-3.5 h-3.5 text-[#FF5E3A]" />
            <span>{t.settingsAdvanceNotice}</span>
          </label>
          <div className="flex items-center gap-3 mt-2">
            <input
              type="number"
              min="1"
              max="240"
              value={settings.advanceNoticeMinutes}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  onUpdateSettings({ ...settings, advanceNoticeMinutes: Math.min(240, Math.max(1, val)) });
                }
              }}
              onBlur={(e) => {
                const val = parseInt(e.target.value, 10);
                const clamped = isNaN(val) ? 15 : Math.min(240, Math.max(1, val));
                onUpdateSettings({ ...settings, advanceNoticeMinutes: clamped });
              }}
              className="flex-1 text-base font-bold bg-white/[0.08] backdrop-blur-md border border-white/15 rounded-2xl px-4 py-3 text-white font-mono text-center focus:outline-none focus:ring-2 focus:ring-[#FF5E3A]"
            />
            <span className="text-sm font-semibold text-sky-200/80 w-16">{t.minutesShort}</span>
          </div>
        </div>

        {/* Site Refresh Interval - Default 30 min (CRITICAL CONSTANT) */}
        <div className="pt-3 border-t border-white/10">
          <label className="text-xs font-bold text-white flex items-center gap-1.5 mb-1 uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5 text-[#FF5E3A]" />
            <span>{t.settingsRefreshInterval}</span>
          </label>
          <div className="flex items-center gap-3 mt-2">
            <input
              type="number"
              min="1"
              max="240"
              value={settings.refreshIntervalMinutes}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  onUpdateSettings({ ...settings, refreshIntervalMinutes: Math.min(240, Math.max(1, val)) });
                }
              }}
              onBlur={(e) => {
                const val = parseInt(e.target.value, 10);
                const clamped = isNaN(val) ? 30 : Math.min(240, Math.max(1, val));
                onUpdateSettings({ ...settings, refreshIntervalMinutes: clamped });
              }}
              className="flex-1 text-base font-bold bg-white/[0.08] backdrop-blur-md border border-white/15 rounded-2xl px-4 py-3 text-white font-mono text-center focus:outline-none focus:ring-2 focus:ring-[#FF5E3A]"
            />
            <span className="text-sm font-semibold text-sky-200/80 w-16">{t.minutesShort}</span>
          </div>
        </div>

      </div>

      {/* 4. Notification Toggles (Turning OFF notifications turns off & disables sound and vibration; turning ON restores previous states) */}
      <div className="bg-[#141A29]/75 backdrop-blur-2xl rounded-3xl p-5 border border-white/15 shadow-[0_16px_44px_rgba(0,0,0,0.55)] flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-white" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              {t.notifications}
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.notificationsEnabled}
            data-testid="ios-switch-notifications"
            onClick={() => onUpdateSettings(toggleMasterNotifications(settings))}
            className={`w-[51px] h-[31px] rounded-full p-[2px] transition-colors duration-200 flex items-center cursor-pointer shrink-0 ${
              settings.notificationsEnabled
                ? 'bg-[#FF5E3A] shadow-inner'
                : 'bg-white/15 border border-white/10'
            }`}
          >
            <div
              className={`w-[27px] h-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.25),0_1px_1px_rgba(0,0,0,0.16)] transition-transform duration-200 ${
                settings.notificationsEnabled ? 'translate-x-[20px]' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className={`flex items-center justify-between pt-2.5 border-t border-white/10 ${!(settings.notificationsEnabled || (settings.emergencyNotificationsEnabled ?? true)) ? 'opacity-45' : ''}`}>
          <div className="flex items-center gap-2 text-xs text-sky-100">
            <Volume2 className="w-4 h-4 text-sky-200/70" />
            <span>{t.settingsSound}</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={Boolean((settings.notificationsEnabled || (settings.emergencyNotificationsEnabled ?? true)) && settings.soundEnabled)}
            data-testid="ios-switch-sound"
            disabled={!(settings.notificationsEnabled || (settings.emergencyNotificationsEnabled ?? true))}
            onClick={() => {
              if (!(settings.notificationsEnabled || (settings.emergencyNotificationsEnabled ?? true))) return;
              const nextVal = !settings.soundEnabled;
              onUpdateSettings({
                ...settings,
                soundEnabled: nextVal,
                prevSoundEnabled: nextVal
              });
            }}
            className={`w-[51px] h-[31px] rounded-full p-[2px] transition-colors duration-200 flex items-center shrink-0 ${
              !(settings.notificationsEnabled || (settings.emergencyNotificationsEnabled ?? true)) ? 'cursor-not-allowed' : 'cursor-pointer'
            } ${
              (settings.notificationsEnabled || (settings.emergencyNotificationsEnabled ?? true)) && settings.soundEnabled
                ? 'bg-[#FF5E3A] shadow-inner'
                : 'bg-white/15 border border-white/10'
            }`}
          >
            <div
              className={`w-[27px] h-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.25),0_1px_1px_rgba(0,0,0,0.16)] transition-transform duration-200 ${
                (settings.notificationsEnabled || (settings.emergencyNotificationsEnabled ?? true)) && settings.soundEnabled ? 'translate-x-[20px]' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className={`flex items-center justify-between pt-2.5 border-t border-white/10 ${!(settings.notificationsEnabled || (settings.emergencyNotificationsEnabled ?? true)) ? 'opacity-45' : ''}`}>
          <div className="flex items-center gap-2 text-xs text-sky-100">
            <Vibrate className="w-4 h-4 text-sky-200/70" />
            <span>{t.settingsVibration}</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={Boolean((settings.notificationsEnabled || (settings.emergencyNotificationsEnabled ?? true)) && settings.vibrationEnabled)}
            data-testid="ios-switch-vibration"
            disabled={!(settings.notificationsEnabled || (settings.emergencyNotificationsEnabled ?? true))}
            onClick={() => {
              if (!(settings.notificationsEnabled || (settings.emergencyNotificationsEnabled ?? true))) return;
              const nextVal = !settings.vibrationEnabled;
              onUpdateSettings({
                ...settings,
                vibrationEnabled: nextVal,
                prevVibrationEnabled: nextVal
              });
            }}
            className={`w-[51px] h-[31px] rounded-full p-[2px] transition-colors duration-200 flex items-center shrink-0 ${
              !(settings.notificationsEnabled || (settings.emergencyNotificationsEnabled ?? true)) ? 'cursor-not-allowed' : 'cursor-pointer'
            } ${
              (settings.notificationsEnabled || (settings.emergencyNotificationsEnabled ?? true)) && settings.vibrationEnabled
                ? 'bg-[#FF5E3A] shadow-inner'
                : 'bg-white/15 border border-white/10'
            }`}
          >
            <div
              className={`w-[27px] h-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.25),0_1px_1px_rgba(0,0,0,0.16)] transition-transform duration-200 ${
                (settings.notificationsEnabled || (settings.emergencyNotificationsEnabled ?? true)) && settings.vibrationEnabled ? 'translate-x-[20px]' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* 4b. Emergency Power Outages Switch (Separate block below Notifications block; always visible even when no outages detected; ON by default) */}
      <div
        data-testid="emergency-outage-switch-block"
        className="bg-[#141A29]/75 backdrop-blur-2xl rounded-3xl p-5 border border-white/15 shadow-[0_16px_44px_rgba(0,0,0,0.55)] flex flex-col gap-3"
      >
        <div
          data-testid="emergency-outage-switch-row"
          className="flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <AlertTriangle className="w-4 h-4 text-[#FF5E3A] shrink-0" />
            <span className="text-xs font-bold text-white uppercase tracking-wider break-words leading-snug">
              {t.settingsEmergencyOutages}
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.emergencyNotificationsEnabled ?? true}
            data-testid="ios-switch-emergency-notifications"
            onClick={() => onUpdateSettings(toggleEmergencyNotifications(settings))}
            className={`w-[51px] h-[31px] rounded-full p-[2px] transition-colors duration-200 flex items-center cursor-pointer shrink-0 ${
              (settings.emergencyNotificationsEnabled ?? true)
                ? 'bg-[#FF5E3A] shadow-inner'
                : 'bg-white/15 border border-white/10'
            }`}
          >
            <div
              className={`w-[27px] h-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.25),0_1px_1px_rgba(0,0,0,0.16)] transition-transform duration-200 ${
                (settings.emergencyNotificationsEnabled ?? true) ? 'translate-x-[20px]' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* 5. Language (iOS Segmented Control) */}
      <div className="bg-[#141A29]/75 backdrop-blur-2xl rounded-3xl p-5 border border-white/15 shadow-[0_16px_44px_rgba(0,0,0,0.55)] flex flex-col gap-3">
        <label className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
          <Globe className="w-3.5 h-3.5 text-[#FF5E3A]" />
          <span>{t.settingsLanguage}</span>
        </label>
        <div
          data-testid="ios-segmented-language"
          role="tablist"
          className="grid grid-cols-3 gap-1 p-1 bg-black/35 rounded-[12px] border border-white/10 items-stretch"
        >
          {[
            { id: 'system', label: t.settingsLangSystem },
            { id: 'uk', label: 'Українська' },
            { id: 'en', label: 'English' }
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={settings.language === item.id}
              onClick={() => onUpdateSettings({ ...settings, language: item.id as Language })}
              className={`py-2 px-2 text-[11px] leading-tight text-center flex items-center justify-center font-semibold rounded-[9px] transition-all duration-150 cursor-pointer break-words ${
                settings.language === item.id
                  ? 'bg-white text-black shadow-[0_2px_6px_rgba(0,0,0,0.3)] font-bold'
                  : 'text-sky-100/75 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 6. Diagnostics & Actions (With Confirmation on Reset) */}
      <div className="bg-[#141A29]/75 backdrop-blur-2xl rounded-3xl p-5 border border-white/15 shadow-[0_16px_44px_rgba(0,0,0,0.55)] flex flex-col gap-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            onClick={() => {
              onSendTestAlert();
              showToast(t.testAlertSent);
            }}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-[#FF5E3A] hover:bg-[#ff4b24] text-white text-xs font-bold transition-all shadow-md shadow-[#FF5E3A]/20 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{t.sendTestAlert}</span>
          </button>

          <button
            onClick={handleForceRefreshWithVerification}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all border border-white/15 cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{t.forceRefresh}</span>
          </button>
        </div>

        {/* Confirmation prompt for Reset to Defaults */}
        {confirmResetOpen ? (
          <div className="mt-2 p-4 rounded-2xl bg-black/40 border border-[#FF5E3A]/30 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <AlertTriangle className="w-4 h-4 text-[#FF5E3A]" />
              <span>{lang === 'uk' ? 'Скинути всі налаштування до початкових (15/30 хв)?' : 'Reset all settings to defaults (15/30 min)?'}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onResetDefaults();
                  setConfirmResetOpen(false);
                  showToast(t.settingsResetConfirm);
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-[#FF5E3A] text-white text-xs font-bold hover:bg-[#ff4b24] transition-all"
              >
                {lang === 'uk' ? 'Так, скинути' : 'Yes, Reset'}
              </button>
              <button
                onClick={() => setConfirmResetOpen(false)}
                className="flex-1 py-2 px-3 rounded-xl bg-white/10 text-sky-100 text-xs font-bold hover:bg-white/20 transition-all border border-white/10"
              >
                {lang === 'uk' ? 'Скасувати' : 'Cancel'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmResetOpen(true)}
            className="mt-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl border border-white/10 text-sky-200/70 hover:text-white hover:bg-white/5 text-xs font-medium transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t.settingsResetDefaults}</span>
          </button>
        )}
      </div>

      {/* =========================================================================================
          CRITICAL SECTION — DO NOT MODIFY UNLESS EXPLICITLY REQUESTED
          Queue Help Modal Popup with numbered instruction for Users on how to find their queue
          ========================================================================================= */}
      {showQueueHelp && (
        <div 
          className="fixed inset-0 z-50 bg-[#141A29] flex flex-col w-full h-full"
          onClick={() => setShowQueueHelp(false)}
        >
          <div 
            data-testid="settings-queue-help-modal"
            className="bg-[#141A29] w-full h-full flex-1 pt-14 pb-10 px-3.5 overflow-y-auto text-white relative flex flex-col gap-5 animate-in fade-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-3 pb-3.5 px-1 border-b border-white/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FF5E3A] flex items-center justify-center text-white shadow-md shadow-[#FF5E3A]/30 font-black text-xl shrink-0">
                  ?
                </div>
                <h3 className="text-xl font-extrabold text-white tracking-tight">
                  {lang === 'uk' ? 'Як дізнатися свою чергу' : 'How to find your queue'}
                </h3>
              </div>
              <button
                onClick={() => setShowQueueHelp(false)}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-white/15 shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 1. Interactive ZTOE Address Queue Lookup (switched to top, expanded internal block border) */}
            <div
              data-testid="ztoe-address-lookup-section"
              className="w-full flex flex-col gap-3.5 p-5 rounded-3xl bg-white/[0.05] border-2 border-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
            >
              <div className="flex flex-col gap-1">
                <div className="text-sm font-extrabold text-white uppercase tracking-wider">
                  {lang === 'uk' ? 'Пошук черги за адресою' : 'Find Queue by Address'}
                </div>
                <div
                  data-testid="ztoe-address-lookup-subtitle"
                  className="text-xs font-medium text-sky-200/80"
                >
                  {lang === 'uk'
                    ? '(Або закрийте це вікно та виберіть тільки чергу)'
                    : '(Or close this window and select directly)'}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-xs font-bold text-sky-200/90 mb-1.5">
                    {lang === 'uk' ? 'РЕМ' : 'District (РЕМ)'}
                  </label>
                  <select
                    data-testid="ztoe-select-rem"
                    value={selectedRemId}
                    onChange={(e) => {
                      const nextRem = e.target.value;
                      setSelectedRemId(nextRem);
                      const nextSettlements = getSettlementsForRem(nextRem);
                      setSettlements(nextSettlements);
                      const firstSettlement = nextSettlements[0]?.id || '';
                      setSelectedSettlementId(firstSettlement);
                      const nextStreets = getStreetsForSettlement(firstSettlement);
                      setStreets(nextStreets);
                      const firstStreet = nextStreets[0]?.id || '';
                      setSelectedStreetId(firstStreet);
                      setHouses(getHousesForStreet(firstStreet));
                      setSelectedHouseNumber('');
                    }}
                    className="w-full text-base font-bold bg-white/[0.08] border-2 border-white/20 rounded-2xl px-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-[#FF5E3A] cursor-pointer"
                  >
                    {rems.map((rem) => (
                      <option key={rem.id} value={rem.id} className="bg-[#141A29] text-white">
                        {lang === 'uk' ? rem.nameUk : rem.nameEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-sky-200/90 mb-1.5">
                    {lang === 'uk' ? 'Населений пункт' : 'City / Settlement'}
                  </label>
                  <select
                    data-testid="ztoe-select-settlement"
                    value={selectedSettlementId}
                    onChange={(e) => {
                      const nextSettlement = e.target.value;
                      setSelectedSettlementId(nextSettlement);
                      const nextStreets = getStreetsForSettlement(nextSettlement);
                      setStreets(nextStreets);
                      const firstStreet = nextStreets[0]?.id || '';
                      setSelectedStreetId(firstStreet);
                      setHouses(getHousesForStreet(firstStreet));
                      setSelectedHouseNumber('');
                    }}
                    className="w-full text-base font-bold bg-white/[0.08] border-2 border-white/20 rounded-2xl px-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-[#FF5E3A] cursor-pointer"
                  >
                    {settlements.map((s) => (
                      <option key={s.id} value={s.id} className="bg-[#141A29] text-white">
                        {lang === 'uk' ? s.nameUk : s.nameEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-sky-200/90 mb-1.5">
                    {lang === 'uk' ? 'Вулиця' : 'Street'}
                  </label>
                  <select
                    data-testid="ztoe-select-street"
                    value={selectedStreetId}
                    onChange={(e) => {
                      const nextStreet = e.target.value;
                      setSelectedStreetId(nextStreet);
                      setHouses(getHousesForStreet(nextStreet));
                      setSelectedHouseNumber('');
                    }}
                    className="w-full text-base font-bold bg-white/[0.08] border-2 border-white/20 rounded-2xl px-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-[#FF5E3A] cursor-pointer"
                  >
                    <option value="" className="bg-[#141A29] text-white">
                      {lang === 'uk' ? 'Оберіть вулицю' : 'Select street'}
                    </option>
                    {streets.map((st) => (
                      <option key={st.id} value={st.id} className="bg-[#141A29] text-white">
                        {lang === 'uk' ? st.nameUk : st.nameEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-sky-200/90 mb-1.5">
                    {lang === 'uk' ? 'Будинок' : 'House Number'}
                  </label>
                  <select
                    data-testid="ztoe-select-house"
                    value={selectedHouseNumber}
                    onChange={(e) => setSelectedHouseNumber(e.target.value)}
                    className="w-full text-base font-bold bg-white/[0.08] border-2 border-white/20 rounded-2xl px-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-[#FF5E3A] cursor-pointer"
                  >
                    <option value="" className="bg-[#141A29] text-white">
                      {lang === 'uk' ? 'Оберіть будинок' : 'Select house'}
                    </option>
                    {houses.map((h) => (
                      <option key={h.house} value={h.house} className="bg-[#141A29] text-white">
                        {h.house}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {matchedHouseRecord && (
                <div
                  data-testid="ztoe-lookup-result"
                  className="mt-1.5 p-4 rounded-2xl bg-[#141A29]/85 backdrop-blur-2xl border-2 border-white/25 shadow-[0_12px_40px_rgba(0,0,0,0.45)] flex flex-col gap-2.5"
                >
                  {selectedAddressStr && (
                    <div
                      data-testid="ztoe-lookup-selected-address"
                      className="text-sm text-sky-200/90 font-semibold leading-snug whitespace-pre-line"
                    >
                      {selectedAddressStr}
                    </div>
                  )}
                  {matchedHouseRecord.queue && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-sky-200/80 font-medium">
                        {lang === 'uk' ? 'Знайдена черга:' : 'Found Queue:'}
                      </span>
                      <span className="text-base font-extrabold text-white font-mono">
                        {t.queue} {matchedHouseRecord.queue}
                      </span>
                    </div>
                  )}
                  {matchedHouseRecord.statusText && (
                    <div
                      data-testid="ztoe-lookup-status-text"
                      className="text-sm font-bold text-white bg-white/[0.06] border-2 border-white/20 rounded-2xl px-4 py-3 leading-snug whitespace-normal break-words"
                    >
                      {matchedHouseRecord.statusText}
                    </div>
                  )}
                  {matchedHouseRecord.emergencyOutage && (
                    <div
                      data-testid="ztoe-lookup-emergency-outage"
                      className="text-sm font-bold text-[#FF5E3A] bg-[#FF5E3A]/10 border-2 border-[#FF5E3A]/35 rounded-2xl px-4 py-3 leading-snug"
                    >
                      <div>
                        {lang === 'uk'
                          ? matchedHouseRecord.emergencyOutage.outageType || 'Аварійне відключення'
                          : 'Emergency Outage'}
                      </div>
                      <div className="text-xs text-white font-mono mt-1">
                        {lang === 'uk' ? 'Початок: ' : 'Start: '}
                        {matchedHouseRecord.emergencyOutage.startTime} ·{' '}
                        {lang === 'uk' ? 'Відновлення: ' : 'Restore: '}
                        {matchedHouseRecord.emergencyOutage.estimatedRestoreTime}
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    data-testid="ztoe-lookup-confirm-btn"
                    onClick={() => {
                      onUpdateSettings({
                        ...settings,
                        queue: matchedHouseRecord.queue,
                        customQueueStatusText: matchedHouseRecord.statusText,
                        selectedAddress: selectedAddressStr,
                        selectedAddressQuery: {
                          remId: selectedRemId,
                          settlementId: selectedSettlementId,
                          streetId: selectedStreetId,
                          house: selectedHouseNumber
                        },
                        activeEmergencyOutage: matchedHouseRecord.emergencyOutage ?? null
                      });
                      setShowQueueHelp(false);
                      onNavigateToMain?.();
                      showToast(
                        matchedHouseRecord.queue
                          ? `${t.queue} ${matchedHouseRecord.queue}`
                          : (matchedHouseRecord.statusText || (lang === 'uk' ? 'Адресу збережено' : 'Address saved'))
                      );
                    }}
                    className="w-full py-3.5 px-4 rounded-2xl bg-[#FF5E3A] hover:bg-[#ff4b24] text-white text-base font-extrabold transition-all cursor-pointer shadow-lg shadow-[#FF5E3A]/30"
                  >
                    {matchedHouseRecord.queue
                      ? lang === 'uk'
                        ? `Обрати чергу ${matchedHouseRecord.queue}`
                        : `Apply Queue ${matchedHouseRecord.queue}`
                      : lang === 'uk'
                        ? 'Підтвердити вибір'
                        : 'Confirm selection'}
                  </button>
                </div>
              )}
            </div>

            {/* 2. Manual Search Section Header ("Пошук вручну" / "Manual search") */}
            <div
              data-testid="queue-help-manual-search-title"
              className="text-sm font-extrabold text-white uppercase tracking-wider pt-1 px-1"
            >
              {lang === 'uk' ? 'Пошук вручну' : 'Manual search'}
            </div>

            {/* 3. Numbered Instruction Steps (1..4) */}
            <div className="flex flex-col gap-3 text-sm leading-relaxed text-zinc-100">
              {/* Step 1 */}
              <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white/[0.04] border-2 border-white/15">
                <span className="w-6 h-6 rounded-full bg-white/15 text-white font-bold flex items-center justify-center text-xs shrink-0 font-mono mt-0.5">
                  1
                </span>
                <div className="flex-1">
                  {lang === 'uk' ? (
                    <span>
                      1. Відкрийте сторінку пошуку черги на сайті{' '}
                      <a
                        href={settings.url || DEFAULT_ZTOE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#FF5E3A] underline hover:opacity-80 inline-flex items-center gap-1 font-semibold break-all"
                      >
                        https://www.ztoe.com.ua/unhooking-search.php <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      </a>
                    </span>
                  ) : (
                    <span>
                      1. Open the queue lookup page on{' '}
                      <a
                        href={settings.url || DEFAULT_ZTOE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#FF5E3A] underline hover:opacity-80 inline-flex items-center gap-1 font-semibold break-all"
                      >
                        https://www.ztoe.com.ua/unhooking-search.php <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      </a>
                    </span>
                  )}
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white/[0.04] border-2 border-white/15">
                <span className="w-6 h-6 rounded-full bg-white/15 text-white font-bold flex items-center justify-center text-xs shrink-0 font-mono mt-0.5">
                  2
                </span>
                <div className="flex-1">
                  {lang === 'uk' ? (
                    <span>2. Оберіть свій РЕМ, населений пункт і вулицю.</span>
                  ) : (
                    <span>2. Select your distribution district (РЕМ), settlement, and street.</span>
                  )}
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white/[0.04] border-2 border-white/15">
                <span className="w-6 h-6 rounded-full bg-white/15 text-white font-bold flex items-center justify-center text-xs shrink-0 font-mono mt-0.5">
                  3
                </span>
                <div className="flex-1">
                  {lang === 'uk' ? (
                    <span>
                      3. У таблиці знайдіть свій будинок і подивіться стовпці «Черга» і «Підчерга». Наприклад, черга 5 і підчерга 2 - це 5.2.
                    </span>
                  ) : (
                    <span>
                      3. In the table, find your building and check the «Queue» and «Subqueue» columns. For example, queue 5 and subqueue 2 is 5.2.
                    </span>
                  )}
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white/[0.04] border-2 border-white/15">
                <span className="w-6 h-6 rounded-full bg-white/15 text-white font-bold flex items-center justify-center text-xs shrink-0 font-mono mt-0.5">
                  4
                </span>
                <div className="flex-1">
                  {lang === 'uk' ? (
                    <span>
                      4. Виберіть це значення у полі «Черга» у вікні налаштувань (кнопка ⚙).
                    </span>
                  ) : (
                    <span>
                      4. Select this value in the «Queue» field in the Settings window (⚙ button).
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Got it action button */}
            <button
              onClick={() => setShowQueueHelp(false)}
              className="w-full mt-1 py-3.5 px-5 rounded-2xl bg-white hover:bg-zinc-200 text-black font-extrabold text-base transition-all shadow-lg text-center cursor-pointer"
            >
              {lang === 'uk' ? 'Зрозуміло' : 'Got it'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
