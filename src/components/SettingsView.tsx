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
  Check,
  AlertTriangle,
  HelpCircle,
  X,
  ExternalLink
} from 'lucide-react';
import { UserSettings, Language } from '../types';
import { QUEUES, DEFAULT_ZTOE_URL } from '../services/ztoeParser';
import { translations } from '../services/i18n';

interface SettingsViewProps {
  settings: UserSettings;
  lang: 'uk' | 'en';
  onUpdateSettings: (newSettings: UserSettings) => void;
  onSendTestAlert: () => void;
  onForceRefresh: () => void;
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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="flex flex-col gap-4 max-w-lg mx-auto select-none">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-[#141A29]/95 backdrop-blur-2xl text-white text-xs py-2 px-4 rounded-full shadow-2xl flex items-center gap-2 border border-white/20">
          <Check className="w-3.5 h-3.5 text-[#FF5E3A]" />
          <span>{toastMessage}</span>
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

      {/* 2. Site Address (Point 9: short explanation) */}
      <div className="bg-[#141A29]/75 backdrop-blur-2xl rounded-3xl p-5 border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.45)] flex flex-col gap-2">
        <label className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
          <Globe className="w-3.5 h-3.5 text-[#FF5E3A]" />
          <span>{t.settingsProviderUrl}</span>
        </label>
        <p className="text-[11px] text-sky-200/70">
          {t.settingsProviderDesc}
        </p>
        <input
          type="text"
          value={settings.url}
          onChange={(e) => onUpdateSettings({ ...settings, url: e.target.value })}
          className="text-xs bg-white/[0.08] backdrop-blur-md border border-white/15 rounded-2xl px-4 py-3 text-white font-mono focus:outline-none focus:ring-2 focus:ring-[#FF5E3A]"
          placeholder={DEFAULT_ZTOE_URL}
        />
      </div>

      {/* 3. Timers: Only Edit Boxes - No Separate Buttons */}
      <div className="bg-[#141A29]/75 backdrop-blur-2xl rounded-3xl p-5 border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.45)] flex flex-col gap-4">
        
        {/* Advance Alert Notice - Edit box only */}
        <div>
          <label className="text-xs font-bold text-white flex items-center gap-1.5 mb-1 uppercase tracking-wider">
            <Bell className="w-3.5 h-3.5 text-[#FF5E3A]" />
            <span>{t.settingsAdvanceNotice}</span>
          </label>
          <div className="flex items-center gap-3 mt-2">
            <input
              type="number"
              min="1"
              max="180"
              value={settings.advanceNoticeMinutes}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 1) {
                  onUpdateSettings({ ...settings, advanceNoticeMinutes: val });
                }
              }}
              className="flex-1 text-base font-bold bg-white/[0.08] backdrop-blur-md border border-white/15 rounded-2xl px-4 py-3 text-white font-mono text-center focus:outline-none focus:ring-2 focus:ring-[#FF5E3A]"
            />
            <span className="text-sm font-semibold text-sky-200/80 w-16">{t.minutesShort}</span>
          </div>
        </div>

        {/* Site Refresh Interval - Edit box only */}
        <div className="pt-3 border-t border-white/10">
          <label className="text-xs font-bold text-white flex items-center gap-1.5 mb-1 uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5 text-[#FF5E3A]" />
            <span>{t.settingsRefreshInterval}</span>
          </label>
          <div className="flex items-center gap-3 mt-2">
            <input
              type="number"
              min="1"
              max="360"
              value={settings.refreshIntervalMinutes}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 1) {
                  onUpdateSettings({ ...settings, refreshIntervalMinutes: val });
                }
              }}
              className="flex-1 text-base font-bold bg-white/[0.08] backdrop-blur-md border border-white/15 rounded-2xl px-4 py-3 text-white font-mono text-center focus:outline-none focus:ring-2 focus:ring-[#FF5E3A]"
            />
            <span className="text-sm font-semibold text-sky-200/80 w-16">{t.minutesShort}</span>
          </div>
        </div>

      </div>

      {/* 4. Notification Toggles */}
      <div className="bg-[#141A29]/75 backdrop-blur-2xl rounded-3xl p-5 border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.45)] flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-white" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              {t.notifications}
            </span>
          </div>
          <button
            onClick={() => onUpdateSettings({ ...settings, notificationsEnabled: !settings.notificationsEnabled })}
            className={`w-14 h-8 rounded-full p-1 transition-all duration-300 flex items-center ${
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

        <div className="flex items-center justify-between pt-2.5 border-t border-white/10">
          <div className="flex items-center gap-2 text-xs text-sky-100">
            <Volume2 className="w-4 h-4 text-sky-200/70" />
            <span>{t.settingsSound}</span>
          </div>
          <input
            type="checkbox"
            checked={settings.soundEnabled}
            onChange={(e) => onUpdateSettings({ ...settings, soundEnabled: e.target.checked })}
            className="w-4 h-4 accent-[#FF5E3A] rounded cursor-pointer"
          />
        </div>

        <div className="flex items-center justify-between pt-2.5 border-t border-white/10">
          <div className="flex items-center gap-2 text-xs text-sky-100">
            <Vibrate className="w-4 h-4 text-sky-200/70" />
            <span>{t.settingsVibration}</span>
          </div>
          <input
            type="checkbox"
            checked={settings.vibrationEnabled}
            onChange={(e) => onUpdateSettings({ ...settings, vibrationEnabled: e.target.checked })}
            className="w-4 h-4 accent-[#FF5E3A] rounded cursor-pointer"
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
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-[#FF5E3A] hover:bg-[#ff4b24] text-white text-xs font-bold transition-all shadow-md shadow-[#FF5E3A]/20"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{t.sendTestAlert}</span>
          </button>

          <button
            onClick={() => {
              onForceRefresh();
              showToast(t.lastUpdated);
            }}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all border border-white/15"
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
              <span>{lang === 'uk' ? 'Скинути всі налаштування до початкових?' : 'Reset all settings to defaults?'}</span>
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

      {/* Queue Help Modal Popup */}
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

            {/* Instruction Steps with bullets & nice markup */}
            <div className="flex flex-col gap-2.5 text-xs leading-relaxed text-zinc-200">
              {/* Step 1 */}
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/[0.04] border border-white/10">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white font-bold flex items-center justify-center text-[11px] shrink-0 font-mono mt-0.5">
                  1
                </span>
                <div className="flex-1">
                  {lang === 'uk' ? (
                    <span>
                      Відкрийте сторінку пошуку черги на сайті{' '}
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
                      Open the queue lookup page on{' '}
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
                    <span>Оберіть свій <strong>РЕМ</strong>, населений пункт і вулицю.</span>
                  ) : (
                    <span>Select your <strong>distribution district (РЕМ)</strong>, settlement, and street.</span>
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
                      У таблиці знайдіть свій будинок і подивіться стовпці <strong>«Черга»</strong> і <strong>«Підчерга»</strong>. Наприклад, черга <span className="px-1.5 py-0.5 rounded-md bg-[#FF5E3A]/20 text-[#FF5E3A] font-bold font-mono">5</span> і підчерга <span className="px-1.5 py-0.5 rounded-md bg-[#FF5E3A]/20 text-[#FF5E3A] font-bold font-mono">2</span> — це <span className="px-1.5 py-0.5 rounded-md bg-white/20 text-white font-bold font-mono">5.2</span>.
                    </span>
                  ) : (
                    <span>
                      In the table, find your building and look at the <strong>«Queue»</strong> and <strong>«Subqueue»</strong> columns. For example, queue <span className="px-1.5 py-0.5 rounded-md bg-[#FF5E3A]/20 text-[#FF5E3A] font-bold font-mono">5</span> and subqueue <span className="px-1.5 py-0.5 rounded-md bg-[#FF5E3A]/20 text-[#FF5E3A] font-bold font-mono">2</span> is <span className="px-1.5 py-0.5 rounded-md bg-white/20 text-white font-bold font-mono">5.2</span>.
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
                      Виберіть це значення у полі <strong>«Черга»</strong> у вікні налаштувань (кнопка ⚙).
                    </span>
                  ) : (
                    <span>
                      Select this value in the <strong>«Queue»</strong> field in the Settings window (⚙ button).
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
