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
import { toggleMasterNotifications } from '../services/alertManager';
import { translations } from '../services/i18n';

interface SettingsViewProps {
  settings: UserSettings;
  lang: 'uk' | 'en';
  onUpdateSettings: (newSettings: UserSettings) => void;
  onSendTestAlert: () => void;
  onForceRefresh: () => Promise<'SUCCESS' | 'NO_INTERNET' | 'NO_QUEUES_FOUND' | void> | void;
  onResetDefaults: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  lang,
  onUpdateSettings,
  onSendTestAlert,
  onForceRefresh,
  onResetDefaults
}) => {
  const t = translations[lang];
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [showQueueHelp, setShowQueueHelp] = useState(false);
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
      <div className="bg-[#141A29]/75 backdrop-blur-2xl rounded-3xl p-5 border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.45)] flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-white uppercase tracking-wider">
                {t.settingsQueue}
              </label>
              {/* Small ? glyph icon which triggers the popup */}
              <button
                type="button"
                onClick={() => setShowQueueHelp(true)}
                className="w-5 h-5 rounded-full bg-white/10 hover:bg-[#FF5E3A] text-white/80 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-white/20 shadow-sm"
                title={lang === 'uk' ? 'Як дізнатися свою чергу' : 'How to find your queue'}
                aria-label={lang === 'uk' ? 'Як дізнатися свою чергу' : 'How to find your queue'}
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-sky-200/70 mt-0.5">
              {t.settingsQueueDesc}
            </p>
          </div>
        </div>

        {/* Clean Dropdown */}
        <select
          value={settings.queue}
          onChange={(e) => onUpdateSettings({ ...settings, queue: e.target.value })}
          className="w-full text-base font-bold bg-white/[0.08] backdrop-blur-md border border-white/15 rounded-2xl px-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-[#FF5E3A] cursor-pointer"
        >
          {QUEUES.map((q) => (
            <option key={q.id} value={q.id} className="bg-[#141A29] text-white">
              {t.queue} {q.id}
            </option>
          ))}
        </select>
      </div>

      {/* 2. Site Address with Reachability and Data Verification Glyph */}
      <div className="bg-[#141A29]/75 backdrop-blur-2xl rounded-3xl p-5 border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.45)] flex flex-col gap-2">
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
      <div className="bg-[#141A29]/75 backdrop-blur-2xl rounded-3xl p-5 border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.45)] flex flex-col gap-4">
        
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
      <div className="bg-[#141A29]/75 backdrop-blur-2xl rounded-3xl p-5 border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.45)] flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-white" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              {t.notifications}
            </span>
          </div>
          <button
            onClick={() => onUpdateSettings(toggleMasterNotifications(settings))}
            className={`w-14 h-8 rounded-full p-1 transition-all duration-300 flex items-center cursor-pointer ${
              settings.notificationsEnabled
                ? 'bg-[#FF5E3A] shadow-md shadow-[#FF5E3A]/30'
                : 'bg-white/10 border border-white/10'
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-300 ${
                settings.notificationsEnabled ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className={`flex items-center justify-between pt-2.5 border-t border-white/10 ${!settings.notificationsEnabled ? 'opacity-45' : ''}`}>
          <div className="flex items-center gap-2 text-xs text-sky-100">
            <Volume2 className="w-4 h-4 text-sky-200/70" />
            <span>{t.settingsSound}</span>
          </div>
          <input
            type="checkbox"
            disabled={!settings.notificationsEnabled}
            checked={settings.notificationsEnabled && settings.soundEnabled}
            onChange={(e) =>
              onUpdateSettings({
                ...settings,
                soundEnabled: e.target.checked,
                prevSoundEnabled: e.target.checked
              })
            }
            className="w-4 h-4 accent-[#FF5E3A] rounded cursor-pointer disabled:cursor-not-allowed"
          />
        </div>

        <div className={`flex items-center justify-between pt-2.5 border-t border-white/10 ${!settings.notificationsEnabled ? 'opacity-45' : ''}`}>
          <div className="flex items-center gap-2 text-xs text-sky-100">
            <Vibrate className="w-4 h-4 text-sky-200/70" />
            <span>{t.settingsVibration}</span>
          </div>
          <input
            type="checkbox"
            disabled={!settings.notificationsEnabled}
            checked={settings.notificationsEnabled && settings.vibrationEnabled}
            onChange={(e) =>
              onUpdateSettings({
                ...settings,
                vibrationEnabled: e.target.checked,
                prevVibrationEnabled: e.target.checked
              })
            }
            className="w-4 h-4 accent-[#FF5E3A] rounded cursor-pointer disabled:cursor-not-allowed"
          />
        </div>
      </div>

      {/* 5. Language */}
      <div className="bg-[#141A29]/75 backdrop-blur-2xl rounded-3xl p-5 border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.45)] flex flex-col gap-3">
        <label className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
          <Globe className="w-3.5 h-3.5 text-[#FF5E3A]" />
          <span>{t.settingsLanguage}</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'system', label: t.settingsLangSystem },
            { id: 'uk', label: 'Українська' },
            { id: 'en', label: 'English' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => onUpdateSettings({ ...settings, language: item.id as Language })}
              className={`py-2.5 px-3 text-xs font-bold rounded-2xl transition-all ${
                settings.language === item.id
                  ? 'bg-white text-black shadow-md'
                  : 'bg-white/10 text-sky-200/70 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 6. Diagnostics & Actions (With Confirmation on Reset) */}
      <div className="bg-[#141A29]/75 backdrop-blur-2xl rounded-3xl p-5 border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.45)] flex flex-col gap-2.5">
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
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setShowQueueHelp(false)}
        >
          <div 
            className="bg-[#141A29]/95 backdrop-blur-2xl border border-white/20 rounded-3xl p-6 max-w-md w-full shadow-[0_20px_60px_rgba(0,0,0,0.7)] text-white relative flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/15">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#FF5E3A] flex items-center justify-center text-white shadow-md shadow-[#FF5E3A]/30 font-bold text-base">
                  ?
                </div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  {lang === 'uk' ? 'Як дізнатися свою чергу' : 'How to find your queue'}
                </h3>
              </div>
              <button
                onClick={() => setShowQueueHelp(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-white/10"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Numbered Instruction Steps (1..4) */}
            <div className="flex flex-col gap-2.5 text-xs leading-relaxed text-zinc-200">
              {/* Step 1 */}
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/[0.04] border border-white/10">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white font-bold flex items-center justify-center text-[11px] shrink-0 font-mono mt-0.5">
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
                        className="text-[#FF5E3A] hover:underline inline-flex items-center gap-1 font-semibold"
                      >
                        ztoe.com.ua <ExternalLink className="w-3 h-3" />
                      </a>.
                    </span>
                  ) : (
                    <span>
                      1. Open the queue lookup page on{' '}
                      <a
                        href={settings.url || DEFAULT_ZTOE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#FF5E3A] hover:underline inline-flex items-center gap-1 font-semibold"
                      >
                        ztoe.com.ua <ExternalLink className="w-3 h-3" />
                      </a>.
                    </span>
                  )}
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/[0.04] border border-white/10">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white font-bold flex items-center justify-center text-[11px] shrink-0 font-mono mt-0.5">
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
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/[0.04] border border-white/10">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white font-bold flex items-center justify-center text-[11px] shrink-0 font-mono mt-0.5">
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
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/[0.04] border border-white/10">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white font-bold flex items-center justify-center text-[11px] shrink-0 font-mono mt-0.5">
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
              className="w-full mt-1 py-3 px-4 rounded-2xl bg-white hover:bg-zinc-200 text-black font-bold text-xs transition-all shadow-lg text-center cursor-pointer"
            >
              {lang === 'uk' ? 'Зрозуміло' : 'Got it'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
