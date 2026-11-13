import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  ExternalLink,
  Globe,
  HelpCircle,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Sliders,
  Star,
  Trash2,
  Vibrate,
  Volume2,
  X,
  Zap
} from 'lucide-react';
import { Language, UserSettings } from '../types';
import { QUEUES, DEFAULT_ZTOE_URL, verifyZtoeSiteAndData } from '../services/ztoeParser';
import {
  checkAddressOnZtoeWebsite,
  fetchHousesForStreet,
  fetchRemsFromZtoe,
  fetchSettlementsForRem,
  fetchStreetsForSettlement,
  findSettlementById,
  findStreetById,
  getHousesForStreet,
  getRems,
  getSettlementsForRem,
  getStreetsForSettlement,
  type ZtoeHouseLookupResult,
  type ZtoeRemOption,
  type ZtoeSettlementOption,
  type ZtoeStreetOption
} from '../services/ztoeAddressLookup';
import { getSubscriptionSync, type SyncResult } from '../services/subscriptionSync';
import {
  ERR_DUPLICATE,
  ERR_LIMIT,
  MAX_ITEMS,
  MAX_LABEL_LENGTH,
  anyAlertsEnabled as anyItemAlerts,
  defaultLabel,
  displayLabel,
  remove as removeItem,
  rename as renameItem,
  setEmergency,
  setPlanned,
  setPrimary,
  type Subscription,
} from '../core/subscriptions';
import {
  addressLimitReached,
  addressesCount,
  addressesLeft,
  plannedDesc,
  rangeMinutes,
  removeConfirmBody,
  translations,
} from '../services/i18n';
import { HouseKey } from '../core/addressKeys';
import { GlassCard, TEXT_SECONDARY, TEXT_TERTIARY } from './GlassCard';
import { SearchablePickerField, type PickerItem } from './SearchablePickerField';
import { ModalPortal } from './ModalPortal';

/** Presets for "warn me N minutes before". 5 and 10 work: alarms are exact, only the site refresh is bounded. */
export const ADVANCE_PRESETS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240];
/** Presets for the site check (Android never runs periodic work more often than every 15 minutes). */
export const REFRESH_PRESETS = [15, 30, 60, 120, 180, 240];

type RefreshStatus = 'SUCCESS' | 'NO_INTERNET' | 'NO_QUEUES_FOUND';

interface SettingsViewProps {
  settings: UserSettings;
  lang: 'uk' | 'en';
  onUpdateSettings: (newSettings: UserSettings) => void;
  onSendTestAlert: () => void;
  onForceRefresh: () => Promise<RefreshStatus | void> | void;
  onResetDefaults: () => void;
  autoOpenQueueHelp?: boolean;
  onQueueHelpOpened?: () => void;
  onNavigateToMain?: () => void;
}

const displayName = (o: { nameUk: string; nameEn: string }, lang: 'uk' | 'en') => (lang === 'uk' ? o.nameUk : o.nameEn);
const sameHouse = (a: string, b: string) => a.toLowerCase() === b.toLowerCase() || (HouseKey.of(a) !== '' && HouseKey.of(a) === HouseKey.of(b));

// ---------------------------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------------------------

const fieldClass =
  'min-h-14 w-full cursor-pointer rounded-2xl border border-white/20 bg-white/[0.08] px-4 py-2 text-base font-medium text-white focus:border-[#FF5E3A] focus:outline-none focus-visible:outline-2 focus-visible:outline-[#FF5E3A]';

/** A labelled switch row: the whole row is the toggle target (role switch, aria-checked), 48 px high at least. */
const SwitchRow: React.FC<{
  icon: React.ReactNode;
  title: string;
  hint?: string;
  checked: boolean;
  enabled?: boolean;
  onToggle: () => void;
  testId: string;
  rowTestId?: string;
  titleClassName?: string;
}> = ({ icon, title, hint, checked, enabled = true, onToggle, testId, rowTestId, titleClassName = '' }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-disabled={!enabled}
    data-testid={testId}
    disabled={!enabled}
    onClick={onToggle}
    className={`flex min-h-12 w-full items-center gap-3 text-left ${enabled ? 'cursor-pointer' : 'cursor-not-allowed'}`}
  >
    <span data-testid={rowTestId} className="flex min-w-0 flex-1 items-center gap-3">
      <span className="shrink-0" aria-hidden="true">
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={`text-base font-bold leading-[23px] ${enabled ? 'text-white' : 'text-white/50'} ${titleClassName}`}>{title}</span>
        {hint && <span className={`text-[13px] font-medium leading-[19px] ${enabled ? TEXT_SECONDARY : TEXT_TERTIARY}`}>{hint}</span>}
      </span>
    </span>
    <span
      aria-hidden="true"
      className={`flex h-[31px] w-[51px] shrink-0 items-center rounded-full p-[2px] transition-colors duration-200 motion-reduce:transition-none ${
        checked ? (enabled ? 'bg-[#FF5E3A] shadow-inner' : 'bg-[#FF5E3A]/30') : enabled ? 'border border-white/10 bg-white/15' : 'bg-white/10'
      }`}
    >
      <span
        className={`h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.25),0_1px_1px_rgba(0,0,0,0.16)] transition-transform duration-200 motion-reduce:transition-none ${
          checked ? 'translate-x-[20px]' : 'translate-x-0'
        } ${enabled ? '' : 'opacity-60'}`}
      />
    </span>
  </button>
);

const Divider = () => <div className="h-px w-full bg-white/10" />;

const Overline: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <span className={`text-xs font-bold uppercase leading-[17px] tracking-[0.05em] text-white ${className}`}>{children}</span>
);

const ActionButton: React.FC<{
  text: string;
  icon?: React.ReactNode;
  filled?: boolean;
  subdued?: boolean;
  onClick: () => void;
  testId?: string;
}> = ({ text, icon, filled = false, subdued = false, onClick, testId }) => (
  <button
    type="button"
    data-testid={testId}
    onClick={onClick}
    className={`flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-center text-sm leading-5 transition-colors focus-visible:outline-2 focus-visible:outline-white ${
      filled
        ? 'bg-[#FF5E3A] font-bold text-white shadow-md shadow-[#FF5E3A]/20 hover:bg-[#ff4b24]'
        : subdued
        ? 'border border-white/10 font-semibold text-[#BAE6FD]/90 hover:bg-white/5 hover:text-white'
        : 'border border-white/15 bg-white/10 font-semibold text-white hover:bg-white/20'
    }`}
  >
    {icon}
    <span>{text}</span>
  </button>
);

/** Loading flags of one level of the REM, city, street, house cascade; `retry` re-runs its fetch with forceRefresh. */
interface LevelState {
  loading: boolean;
  failed: boolean;
  retry: number;
}
const initialLevel: LevelState = { loading: false, failed: false, retry: 0 };

// ---------------------------------------------------------------------------------------------
// Settings screen
// ---------------------------------------------------------------------------------------------

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
  const [removeCandidate, setRemoveCandidate] = useState<Subscription | null>(null);
  const [renameCandidate, setRenameCandidate] = useState<Subscription | null>(null);
  const [renameText, setRenameText] = useState('');
  const [verification, setVerification] = useState<{ isChecking: boolean; status: RefreshStatus }>({ isChecking: true, status: 'SUCCESS' });

  useEffect(() => {
    if (autoOpenQueueHelp) {
      setShowQueueHelp(true);
      onQueueHelpOpened?.();
    }
  }, [autoOpenQueueHelp, onQueueHelpOpened]);

  // Live URL verification against valid-urls.json and the real table
  useEffect(() => {
    let isMounted = true;
    setVerification((prev) => ({ ...prev, isChecking: true }));
    const timer = setTimeout(async () => {
      const res = await verifyZtoeSiteAndData(settings.url, settings.queue || '1.1');
      if (isMounted) setVerification({ isChecking: false, status: res.status });
    }, 350);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [settings.url, settings.queue]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleForceRefresh = async () => {
    const status = await onForceRefresh();
    showToast(status === 'NO_INTERNET' ? t.errorNoInternet : status === 'NO_QUEUES_FOUND' ? t.errorNoQueuesFound : t.refreshSuccessToast);
  };

  // Sound and vibration follow the primary address' effective switches, as the single-address fields do
  const anyAlertsEnabled = settings.notificationsEnabled || (settings.emergencyNotificationsEnabled ?? true);

  // Multi-address store (step 2): every change goes through the sync, which mirrors the primary back
  const sync = getSubscriptionSync();
  const store = useMemo(() => sync.store(settings), [sync, settings]);
  const alertsMaster = settings.alertsMaster ?? sync.master(settings);
  const noAddressAlerts = alertsMaster && store.items.length > 0 && !anyItemAlerts(alertsMaster, store);
  const usedQueues = new Set(store.items.filter((i) => i.address === null).map((i) => i.queue));
  const freeQueues = QUEUES.filter((q) => !usedQueues.has(q.id));

  /** Saves the mirrored settings, or says why the store refused the change. */
  const applySync = ({ result, settings: next }: SyncResult): boolean => {
    if (result.ok) {
      onUpdateSettings(next);
      return true;
    }
    if (result.code === ERR_DUPLICATE) showToast(t.addressDuplicate);
    else if (result.code === ERR_LIMIT) showToast(addressLimitReached(lang, MAX_ITEMS));
    return false;
  };
  const isSiteVerified = !verification.isChecking && verification.status === 'SUCCESS';
  const minShort = t.minShort;

  const presetOptions = (presets: number[], current: number) =>
    (presets.includes(current) ? presets : [...presets, current].sort((a, b) => a - b)).map((m) => (
      <option key={m} value={m} className="bg-[#141A29] text-white">
        {m} {minShort}
      </option>
    ));

  return (
    <div className="mx-auto flex max-w-lg select-none flex-col gap-4">
      {/* Toast with the application icon */}
      {toastMessage && (
        <div
          role="status"
          className="fixed top-14 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2.5 rounded-2xl border border-white/20 bg-[#141A29]/95 px-4 py-2 text-sm text-white shadow-2xl backdrop-blur-2xl"
        >
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#FF5E3A] text-white">
            <Zap className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
          </div>
          <span className="font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2.5 pt-1">
        <Sliders className="h-6 w-6 text-[#FF5E3A]" aria-hidden="true" />
        <h2 className="text-xl font-extrabold leading-7 tracking-tight text-white">{t.settingsTitle}</h2>
      </div>

      {/* 1. My addresses: up to 5 addresses (or queues), each with its own planned / emergency switches */}
      <GlassCard data-testid="my-addresses-card" padding={18} className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <Overline>{t.myAddressesTitle}</Overline>
            <span className={`text-[13px] font-medium leading-[19px] ${TEXT_SECONDARY}`}>{t.myAddressesDesc}</span>
          </div>
          {store.items.length > 0 && (
            <span data-testid="my-addresses-count" className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-white/80">
              {addressesCount(lang, store.items.length, MAX_ITEMS)}
            </span>
          )}
          {/* 48 px touch target around the 40 px "?" tile; opens the address lookup */}
          <button
            type="button"
            data-testid="settings-queue-help-btn"
            onClick={() => setShowQueueHelp(true)}
            className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center"
            title={t.queueHelpTitle}
            aria-label={t.queueHelpTitle}
          >
            <span className="w-10 h-10 rounded-2xl bg-[#FF5E3A] hover:bg-[#ff4b24] text-white flex items-center justify-center border border-white/25 shadow-lg shadow-[#FF5E3A]/35">
              <HelpCircle className="h-5 w-5 stroke-[2.5]" aria-hidden="true" />
            </span>
          </button>
        </div>

        {store.items.map((item) => {
          const isPrimary = item.id === store.primaryId;
          const label = displayLabel(item);
          const caption = item.address ? (item.address.text.trim() ? item.address.text : null) : t.queueOnlyCaption;
          return (
            <div
              key={item.id}
              data-testid={`subscription-${item.id}`}
              className={`flex flex-col gap-1.5 rounded-2xl border bg-white/[0.08] px-3.5 py-3 ${isPrimary ? 'border-[#FF5E3A]/35' : 'border-white/10'}`}
            >
              <div className="flex items-center gap-1.5">
                <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                  {/* a queue-only item already says "Черга X" in its label */}
                  {item.address !== null && (
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-white/80">
                      {item.queue !== null ? `${t.queue} ${item.queue}` : item.queueStatusText ? t.noQueueNotDisconnected : t.selectQueueAction}
                    </span>
                  )}
                  {isPrimary && (
                    <span className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-white">
                      <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                      {t.primaryBadge}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  aria-label={`${t.renameAddress}: ${label}`}
                  onClick={() => {
                    setRenameText(item.label);
                    setRenameCandidate(item);
                  }}
                  className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white">
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`${t.removeAddress}: ${label}`}
                  data-testid={`subscription-remove-${item.id}`}
                  onClick={() => setRemoveCandidate(item)}
                  className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/20 text-red-300">
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </span>
                </button>
              </div>
              <span className="text-base font-bold leading-[23px] text-white">{label}</span>
              {caption && <span className={`text-[13px] font-medium leading-[19px] ${TEXT_SECONDARY}`}>{caption}</span>}
              <SwitchRow
                icon={<Bell className="h-5 w-5 text-white" />}
                title={t.plannedShort}
                hint={plannedDesc(lang, settings.advanceNoticeMinutes)}
                checked={item.plannedAlerts}
                enabled={item.queue !== null}
                onToggle={() => applySync(sync.change(settings, (st) => setPlanned(st, item.id, !item.plannedAlerts)))}
                testId={`ios-switch-planned-${item.id}`}
              />
              <SwitchRow
                icon={<AlertTriangle className="h-5 w-5 text-[#FF5E3A]" />}
                title={t.emergencyShort}
                hint={item.address ? t.emergencyDesc : t.emergencyNeedsAddress}
                checked={item.emergencyAlerts && item.address !== null}
                enabled={item.address !== null}
                onToggle={() => applySync(sync.change(settings, (st) => setEmergency(st, item.id, !item.emergencyAlerts)))}
                testId={`ios-switch-emergency-${item.id}`}
                titleClassName="break-words leading-snug"
              />
              {!isPrimary && (
                <ActionButton
                  text={t.makePrimary}
                  icon={<Star className="h-4 w-4" aria-hidden="true" />}
                  onClick={() => applySync(sync.change(settings, (st) => setPrimary(st, item.id)))}
                  testId={`subscription-make-primary-${item.id}`}
                />
              )}
            </div>
          );
        })}

        {store.items.length < MAX_ITEMS ? (
          <>
            <ActionButton
              text={t.addAddress}
              icon={<Plus className="h-4 w-4" aria-hidden="true" />}
              filled
              onClick={() => setShowQueueHelp(true)}
              testId="add-address-btn"
            />
            <select
              aria-label={t.addQueueOnly}
              data-testid="settings-queue-select"
              value=""
              onChange={(e) => {
                const q = e.target.value;
                if (!q) return;
                const wasEmpty = store.items.length === 0;
                if (applySync(sync.addQueueOnly(settings, q)) && wasEmpty) onNavigateToMain?.();
              }}
              className={fieldClass}
            >
              <option value="" className="bg-[#141A29] text-white">
                {t.addQueueOnly}
              </option>
              {freeQueues.map((q) => (
                <option key={q.id} value={q.id} className="bg-[#141A29] text-white">
                  {t.queue} {q.id}
                </option>
              ))}
            </select>
            {store.items.length > 0 && (
              <p className={`text-[13px] font-medium leading-[19px] ${TEXT_TERTIARY}`}>{addressesLeft(lang, MAX_ITEMS - store.items.length)}</p>
            )}
          </>
        ) : (
          <p className={`text-[13px] font-medium leading-[19px] ${TEXT_SECONDARY}`}>{addressLimitReached(lang, MAX_ITEMS)}</p>
        )}
      </GlassCard>

      {/* 2. Site address with a strict check against valid-urls.json and the live table */}
      <GlassCard padding={18} className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <Overline className="py-1.5">{t.siteAddressTitle}</Overline>
          {verification.isChecking ? (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#9CA3AF]/20 px-2.5 py-1 text-sm font-semibold leading-5 text-[#9CA3AF]" role="status">
              {t.siteStateChecking}
            </span>
          ) : isSiteVerified ? (
            <span
              data-testid="site-address-reachable"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#10B981]/20 px-2.5 py-1 text-sm font-semibold leading-5 text-[#34D399]"
            >
              {t.siteReachable}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#EF4444]/20 px-2.5 py-1 text-sm font-semibold leading-5 text-[#F87171]" role="alert">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              {verification.status === 'NO_INTERNET' ? t.errorNoInternet : t.errorNoQueuesFound}
            </span>
          )}
        </div>
        <p className={`text-[13px] font-medium leading-[19px] ${TEXT_SECONDARY}`}>{t.siteAddressDesc}</p>
        <input
          type="url"
          inputMode="url"
          aria-label={t.siteAddressTitle}
          value={settings.url}
          onChange={(e) => onUpdateSettings({ ...settings, url: e.target.value })}
          placeholder={DEFAULT_ZTOE_URL}
          className={`min-h-14 w-full rounded-2xl border bg-white/[0.08] px-4 py-2 font-mono text-sm text-white focus:outline-none ${
            !verification.isChecking && !isSiteVerified ? 'border-[#EF4444]/40 focus:border-[#EF4444]' : 'border-white/20 focus:border-[#FF5E3A]'
          }`}
        />
      </GlassCard>

      {/* 3. Timers: presets only (no free text), ranges match what really works */}
      <GlassCard padding={18} className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-col gap-0.5">
            <Overline>{t.advanceNoticeTitle}</Overline>
            <span className={`text-[13px] font-medium leading-[19px] ${TEXT_TERTIARY}`}>
              {t.advanceNoticeHint} · {rangeMinutes(lang, ADVANCE_PRESETS[0], ADVANCE_PRESETS[ADVANCE_PRESETS.length - 1])}
            </span>
          </div>
          <select
            aria-label={t.advanceNoticeTitle}
            data-testid="settings-advance-select"
            value={settings.advanceNoticeMinutes}
            onChange={(e) => onUpdateSettings({ ...settings, advanceNoticeMinutes: parseInt(e.target.value, 10) })}
            className={fieldClass}
          >
            {presetOptions(ADVANCE_PRESETS, settings.advanceNoticeMinutes)}
          </select>
        </div>

        <Divider />

        <div className="flex flex-col gap-1.5">
          <div className="flex flex-col gap-0.5">
            <Overline>{t.refreshIntervalTitle}</Overline>
            <span className={`text-[13px] font-medium leading-[19px] ${TEXT_TERTIARY}`}>
              {rangeMinutes(lang, REFRESH_PRESETS[0], REFRESH_PRESETS[REFRESH_PRESETS.length - 1])} · {t.refreshFloorHint}
            </span>
          </div>
          <select
            aria-label={t.refreshIntervalTitle}
            data-testid="settings-refresh-select"
            value={settings.refreshIntervalMinutes}
            onChange={(e) => onUpdateSettings({ ...settings, refreshIntervalMinutes: parseInt(e.target.value, 10) })}
            className={fieldClass}
          >
            {presetOptions(REFRESH_PRESETS, settings.refreshIntervalMinutes)}
          </select>
        </div>
      </GlassCard>

      {/* 4. Alerts: the master switch for all addresses (owner decision 1), then sound and vibration */}
      <GlassCard padding={18} className="flex flex-col gap-2">
        <SwitchRow
          icon={<Bell className="h-5 w-5 text-white" />}
          title={t.notifications}
          hint={t.masterHint}
          checked={alertsMaster}
          onToggle={() => onUpdateSettings(sync.setMaster(settings, !alertsMaster))}
          testId="ios-switch-notifications"
        />
        {noAddressAlerts && (
          <p data-testid="no-address-alerts" className="text-[13px] font-medium leading-[19px] text-[#FF5E3A]">
            {t.noAddressAlerts}
          </p>
        )}
        <Divider />
        <SwitchRow
          icon={<Volume2 className={`h-5 w-5 ${anyAlertsEnabled ? 'text-[#BAE6FD]/70' : 'text-[#BAE6FD]/30'}`} />}
          title={t.sound}
          checked={Boolean(anyAlertsEnabled && settings.soundEnabled)}
          enabled={anyAlertsEnabled}
          onToggle={() => {
            const nextVal = !settings.soundEnabled;
            onUpdateSettings({ ...settings, soundEnabled: nextVal, prevSoundEnabled: nextVal });
          }}
          testId="ios-switch-sound"
        />
        <Divider />
        <SwitchRow
          icon={<Vibrate className={`h-5 w-5 ${anyAlertsEnabled ? 'text-[#BAE6FD]/70' : 'text-[#BAE6FD]/30'}`} />}
          title={t.vibration}
          checked={Boolean(anyAlertsEnabled && settings.vibrationEnabled)}
          enabled={anyAlertsEnabled}
          onToggle={() => {
            const nextVal = !settings.vibrationEnabled;
            onUpdateSettings({ ...settings, vibrationEnabled: nextVal, prevVibrationEnabled: nextVal });
          }}
          testId="ios-switch-vibration"
        />
        <p className={`pt-0.5 text-[13px] font-medium leading-[19px] ${TEXT_TERTIARY}`}>{t.soundVibrationHint}</p>
      </GlassCard>


      {/* 5. Language */}
      <GlassCard padding={18} className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <Globe className="h-[18px] w-[18px] text-[#FF5E3A]" aria-hidden="true" />
          <Overline>{t.languageTitle}</Overline>
        </div>
        <div
          data-testid="ios-segmented-language"
          role="radiogroup"
          aria-label={t.languageTitle}
          className="grid grid-cols-3 items-stretch gap-1 rounded-xl border border-white/10 bg-black/35 p-1"
        >
          {[
            { id: 'system', label: t.langSystem },
            { id: 'uk', label: 'Українська' },
            { id: 'en', label: 'English' }
          ].map((item) => {
            const selected = settings.language === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onUpdateSettings({ ...settings, language: item.id as Language })}
                className={`flex min-h-10 cursor-pointer items-center justify-center break-words rounded-[9px] px-1.5 py-2 text-center text-sm leading-tight transition-colors ${
                  selected ? 'bg-white font-bold text-black shadow-[0_2px_6px_rgba(0,0,0,0.3)]' : 'font-semibold text-sky-100/80 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </GlassCard>

      {/* 6. Diagnostics and actions */}
      <GlassCard padding={18} className="flex flex-col gap-2.5">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ActionButton
            text={t.testAlertBtn}
            icon={<Send className="h-4 w-4" aria-hidden="true" />}
            filled
            testId="settings-test-alert"
            onClick={() => {
              onSendTestAlert();
              showToast(t.testAlertSent);
            }}
          />
          <ActionButton
            text={t.refreshBtn}
            icon={<Globe className="h-4 w-4" aria-hidden="true" />}
            testId="settings-force-refresh"
            onClick={handleForceRefresh}
          />
        </div>
        <ActionButton
          text={t.resetDefaultsBtn}
          icon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}
          subdued
          testId="settings-reset-defaults"
          onClick={() => setConfirmResetOpen(true)}
        />
      </GlassCard>

      {confirmResetOpen && (
        <ModalPortal>
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/60 p-6" onClick={() => setConfirmResetOpen(false)}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reset-confirm-title"
            aria-describedby="reset-confirm-desc"
            data-testid="reset-confirm-dialog"
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-sm flex-col gap-3 rounded-3xl border border-white/15 bg-[#141A29] p-6 text-white shadow-2xl"
          >
            <h3 id="reset-confirm-title" className="text-xl font-extrabold leading-7">
              {t.resetConfirmTitle}
            </h3>
            <p id="reset-confirm-desc" className={`text-base font-medium leading-6 ${TEXT_SECONDARY}`}>
              {t.resetConfirmDesc}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmResetOpen(false)}
                className="min-h-12 cursor-pointer rounded-xl px-4 text-sm font-semibold text-white hover:bg-white/10"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                data-testid="reset-confirm-yes"
                onClick={() => {
                  onResetDefaults();
                  setConfirmResetOpen(false);
                  showToast(t.settingsReset);
                }}
                className="min-h-12 cursor-pointer rounded-xl px-4 text-sm font-bold text-[#FF5E3A] hover:bg-white/10"
              >
                {t.resetYes}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {showQueueHelp && (
        <ModalPortal>
        <AddressLookupDialog
          settings={settings}
          lang={lang}
          onDismiss={() => setShowQueueHelp(false)}
          onApply={(next, toast) => {
            const wasEmpty = store.items.length === 0;
            const synced = next.selectedAddressQuery
              ? sync.addFromLookup(settings, next.queue, next.customQueueStatusText, next.selectedAddress ?? '', next.selectedAddressQuery)
              : sync.addQueueOnly(settings, next.queue);
            setShowQueueHelp(false);
            if (applySync(synced)) {
              // the first address becomes the primary: show it on the main screen
              if (wasEmpty) onNavigateToMain?.();
              showToast(wasEmpty ? toast : t.addressAdded);
            }
          }}
        />
        </ModalPortal>
      )}

      {removeCandidate && (
        <ModalPortal>
          <div role="dialog" aria-modal="true" aria-labelledby="remove-address-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="flex w-full max-w-sm flex-col gap-3 rounded-3xl border border-white/15 bg-[#141A29] p-5 shadow-2xl">
              <h3 id="remove-address-title" className="text-xl font-extrabold leading-7 text-white">{t.removeConfirmTitle}</h3>
              <p className={`text-[15px] leading-[22px] ${TEXT_SECONDARY}`}>{removeConfirmBody(lang, displayLabel(removeCandidate))}</p>
              <div className="flex gap-2">
                <ActionButton text={t.cancel} onClick={() => setRemoveCandidate(null)} />
                <ActionButton
                  text={t.removeAddress}
                  filled
                  testId="confirm-remove-address"
                  onClick={() => {
                    const id = removeCandidate.id;
                    setRemoveCandidate(null);
                    applySync(sync.change(settings, (st) => removeItem(st, id)));
                  }}
                />
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {renameCandidate && (
        <ModalPortal>
          <div role="dialog" aria-modal="true" aria-labelledby="rename-address-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="flex w-full max-w-sm flex-col gap-3 rounded-3xl border border-white/15 bg-[#141A29] p-5 shadow-2xl">
              <h3 id="rename-address-title" className="text-xl font-extrabold leading-7 text-white">{t.renameAddress}</h3>
              <input
                type="text"
                value={renameText}
                maxLength={MAX_LABEL_LENGTH}
                placeholder={defaultLabel(renameCandidate)}
                aria-label={t.renameAddress}
                data-testid="rename-address-input"
                onChange={(e) => setRenameText(e.target.value)}
                className="min-h-14 w-full rounded-2xl border border-white/20 bg-white/[0.08] px-4 py-2 text-base font-medium text-white placeholder:text-white/40 focus:border-[#FF5E3A] focus:outline-none"
              />
              <p className={`text-[13px] leading-[19px] ${TEXT_TERTIARY}`}>{t.renameHint}</p>
              <div className="flex gap-2">
                <ActionButton text={t.cancel} onClick={() => setRenameCandidate(null)} />
                <ActionButton
                  text={t.save}
                  filled
                  testId="confirm-rename-address"
                  onClick={() => {
                    const id = renameCandidate.id;
                    setRenameCandidate(null);
                    applySync(sync.change(settings, (st) => renameItem(st, id, renameText)));
                  }}
                />
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------------------------
// Full-screen queue help and address lookup ("?" button)
// =========================================================================================
// CRITICAL SECTION — DO NOT MODIFY THE STEP TEXTS UNLESS EXPLICITLY REQUESTED
// Queue help modal with the numbered instruction for users on how to find their queue
// =========================================================================================

interface AddressLookupDialogProps {
  settings: UserSettings;
  lang: 'uk' | 'en';
  onDismiss: () => void;
  onApply: (next: UserSettings, toast: string) => void;
}

const AddressLookupDialog: React.FC<AddressLookupDialogProps> = ({ settings, lang, onDismiss, onApply }) => {
  const t = translations[lang];
  const siteUrl = settings.url;
  const saved = settings.selectedAddressQuery;

  // The cascade starts from the saved address, or from Zhytomyr city on a first launch. After that a REM
  // never picks a city for the user: choosing another REM clears city, street and house.
  const [selectedRemId, setSelectedRemId] = useState<string>(saved?.remId || 'zhytomyr');
  const [selectedSettlementId, setSelectedSettlementId] = useState<string>(saved?.settlementId || 'zt_city');
  const [selectedStreetId, setSelectedStreetId] = useState<string>(saved?.streetId || '');
  const [selectedHouse, setSelectedHouse] = useState<string>(saved?.house || '');

  const [allRems, setAllRems] = useState<ZtoeRemOption[]>(() => getRems());
  const [settlementsList, setSettlementsList] = useState<ZtoeSettlementOption[]>(() => getSettlementsForRem(selectedRemId));
  const [streetsList, setStreetsList] = useState<ZtoeStreetOption[]>(() => (selectedSettlementId ? getStreetsForSettlement(selectedSettlementId) : []));
  const [housesList, setHousesList] = useState<ZtoeHouseLookupResult[]>(() => (selectedStreetId ? getHousesForStreet(selectedStreetId) : []));
  const [rems, setRems] = useState<LevelState>(initialLevel);
  const [settlements, setSettlements] = useState<LevelState>(initialLevel);
  const [streets, setStreets] = useState<LevelState>(initialLevel);
  const [houses, setHouses] = useState<LevelState>(initialLevel);

  const [isChecking, setIsChecking] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);
  const [lookup, setLookup] = useState<ZtoeHouseLookupResult | null>(null);

  const patch = (set: React.Dispatch<React.SetStateAction<LevelState>>, p: Partial<LevelState>) => set((s) => ({ ...s, ...p }));

  const clearBelowSettlement = () => {
    setSelectedStreetId('');
    setSelectedHouse('');
    setHousesList([]);
    setLookup(null);
  };
  const clearBelowRem = () => {
    setSelectedSettlementId('');
    setStreetsList([]);
    clearBelowSettlement();
  };

  // REM list. A retry forces a fresh fetch; otherwise the in-memory cache is used.
  useEffect(() => {
    let cancelled = false;
    patch(setRems, { loading: true, failed: false });
    (async () => {
      let fetched: ZtoeRemOption[] | null = null;
      try {
        fetched = await fetchRemsFromZtoe(siteUrl, rems.retry > 0);
      } catch {
        fetched = null;
      }
      if (cancelled) return;
      const next = fetched && fetched.length > 0 ? fetched : getRems();
      setAllRems(next);
      patch(setRems, { loading: false, failed: next.length === 0 });
    })();
    return () => {
      cancelled = true;
    };
  }, [siteUrl, rems.retry]);

  // City list of the chosen REM. Never selects a city by itself; only drops a choice that no longer exists.
  useEffect(() => {
    let cancelled = false;
    setSettlementsList(getSettlementsForRem(selectedRemId));
    patch(setSettlements, { loading: true, failed: false });
    (async () => {
      let fetched: ZtoeSettlementOption[] = [];
      try {
        fetched = await fetchSettlementsForRem(selectedRemId, siteUrl, settlements.retry > 0);
      } catch {
        fetched = [];
      }
      if (cancelled) return;
      const list = fetched.length > 0 ? fetched : getSettlementsForRem(selectedRemId);
      setSettlementsList(list);
      patch(setSettlements, { loading: false, failed: list.length === 0 });
      if (selectedSettlementId && list.length > 0 && !list.some((s) => s.id === selectedSettlementId)) {
        setSelectedSettlementId('');
        clearBelowSettlement();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRemId, siteUrl, settlements.retry]);

  // Street list (the fetch also bulk-indexes the houses of the whole settlement)
  useEffect(() => {
    if (!selectedSettlementId) {
      setStreetsList([]);
      patch(setStreets, { loading: false, failed: false });
      return;
    }
    let cancelled = false;
    setStreetsList(getStreetsForSettlement(selectedSettlementId));
    patch(setStreets, { loading: true, failed: false });
    (async () => {
      let fetched: ZtoeStreetOption[] = [];
      try {
        fetched = await fetchStreetsForSettlement(selectedRemId, selectedSettlementId, siteUrl, streets.retry > 0);
      } catch {
        fetched = [];
      }
      if (cancelled) return;
      const list = fetched.length > 0 ? fetched : getStreetsForSettlement(selectedSettlementId);
      setStreetsList(list);
      if (fetched.length > 0) {
        setAllRems(getRems());
        setSettlementsList(getSettlementsForRem(selectedRemId));
        if (selectedStreetId) {
          const bulk = getHousesForStreet(selectedStreetId);
          if (bulk.length > 0) setHousesList(bulk);
        }
      }
      patch(setStreets, { loading: false, failed: list.length === 0 });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRemId, selectedSettlementId, siteUrl, streets.retry]);

  // House list of the chosen street (served from the bulk index when it is already there)
  useEffect(() => {
    if (!selectedStreetId) {
      setHousesList([]);
      patch(setHouses, { loading: false, failed: false });
      return;
    }
    let cancelled = false;
    setHousesList(getHousesForStreet(selectedStreetId));
    patch(setHouses, { loading: true, failed: false });
    (async () => {
      let fetched: ZtoeHouseLookupResult[] = [];
      try {
        fetched = await fetchHousesForStreet(selectedRemId, selectedSettlementId, selectedStreetId, siteUrl, houses.retry > 0);
      } catch {
        fetched = [];
      }
      if (cancelled) return;
      const list = fetched.length > 0 ? fetched : getHousesForStreet(selectedStreetId);
      setHousesList(list);
      patch(setHouses, { loading: false, failed: list.length === 0 });
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedRemId, selectedSettlementId, selectedStreetId, siteUrl, houses.retry]);

  const currentRem = allRems.find((r) => r.id === selectedRemId);
  const currentSettlement = selectedSettlementId
    ? settlementsList.find((s) => s.id === selectedSettlementId) ?? findSettlementById(selectedSettlementId)
    : undefined;
  const currentStreet = selectedStreetId ? streetsList.find((s) => s.id === selectedStreetId) ?? findStreetById(selectedStreetId) : undefined;
  const currentHouseRecord = housesList.find((h) => sameHouse(h.house, selectedHouse));

  // Queries the site when street and house are chosen. Nothing closes or applies until the user presses the button.
  useEffect(() => {
    setLookup(null);
    setCheckFailed(false);
    if (!selectedStreetId || !selectedHouse) {
      setIsChecking(false);
      return;
    }
    let cancelled = false;
    setIsChecking(true);
    (async () => {
      let res: ZtoeHouseLookupResult | null = null;
      try {
        res = await checkAddressOnZtoeWebsite(
          { remId: selectedRemId, settlementId: selectedSettlementId, streetId: selectedStreetId, house: selectedHouse },
          siteUrl
        );
      } catch {
        res = null;
      }
      if (cancelled) return;
      setIsChecking(false);
      setLookup(res);
      setCheckFailed(res === null);
      if (res) {
        setHousesList((prev) => {
          const exists = prev.some((h) => sameHouse(h.house, res!.house));
          if (!exists) return [...prev, res!];
          return prev.map((h) =>
            sameHouse(h.house, res!.house)
              ? { ...h, queue: res!.queue || h.queue, statusText: res!.statusText ?? h.statusText, addressLabel: res!.addressLabel || h.addressLabel }
              : h
          );
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedRemId, selectedSettlementId, selectedStreetId, selectedHouse, siteUrl]);

  const selectedAddressStr =
    currentStreet && selectedHouse.trim() !== ''
      ? `${currentRem ? displayName(currentRem, lang) : ''}, ${currentSettlement ? displayName(currentSettlement, lang) : ''},\n${displayName(
          currentStreet,
          lang
        )}, ${t.addrHousePrefix} ${selectedHouse}`
      : '';

  const remItems = useMemo<PickerItem[]>(() => allRems.map((r) => ({ id: r.id, label: displayName(r, lang) })), [allRems, lang]);
  const settlementItems = useMemo<PickerItem[]>(() => settlementsList.map((s) => ({ id: s.id, label: displayName(s, lang) })), [settlementsList, lang]);
  const streetItems = useMemo<PickerItem[]>(() => streetsList.map((s) => ({ id: s.id, label: displayName(s, lang) })), [streetsList, lang]);
  const houseItems = useMemo<PickerItem[]>(() => housesList.map((h) => ({ id: h.house, label: h.house })), [housesList]);

  // Result card (shown when a house is selected)
  const validLookup = lookup && sameHouse(lookup.house, selectedHouse) ? lookup : null;
  const matched: ZtoeHouseLookupResult | null = validLookup && currentHouseRecord
    ? { ...validLookup, queue: validLookup.queue || currentHouseRecord.queue, statusText: validLookup.statusText ?? currentHouseRecord.statusText }
    : validLookup ?? currentHouseRecord ?? (selectedHouse.trim() !== '' ? { house: selectedHouse, queue: '', addressLabel: selectedAddressStr } : null);
  // while the site answers, an address without a known queue cannot be confirmed yet
  const canApply = matched ? !(isChecking && !matched.queue) : false;

  const apply = () => {
    if (!matched) return;
    const query = { remId: selectedRemId, settlementId: selectedSettlementId, streetId: selectedStreetId, house: selectedHouse };
    const addressToSave = selectedAddressStr || matched.addressLabel;
    const hasQueue = Boolean(matched.queue);
    onApply(
      {
        ...settings,
        queue: hasQueue ? matched.queue : '',
        customQueueStatusText: hasQueue ? undefined : matched.statusText,
        selectedAddress: addressToSave,
        selectedAddressQuery: query,
        activeEmergencyOutage: null
      },
      hasQueue ? `${t.queue} ${matched.queue}` : matched.statusText || t.addrSaved
    );
  };

  const stepClass = 'flex items-start gap-3.5 rounded-2xl border-2 border-white/15 bg-white/[0.04] p-4';
  const numClass = 'mt-0.5 flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-white/15 px-1.5 font-mono text-[13px] font-bold text-white';
  const linkClass = 'inline-flex items-center gap-1 break-all font-semibold text-[#FF5E3A] underline hover:opacity-80';

  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex h-full w-full flex-col bg-[#141A29]" onClick={onDismiss}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t.queueHelpTitle}
        data-testid="settings-queue-help-modal"
        className="relative flex h-full w-full flex-1 flex-col gap-5 overflow-y-auto px-3.5 pt-14 pb-10 text-white focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between gap-3 border-b border-white/20 px-1 pb-3.5">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FF5E3A] text-xl font-black text-white shadow-md shadow-[#FF5E3A]/30"
            >
              ?
            </div>
            <h3 className="text-xl font-extrabold leading-7 tracking-tight text-white">{t.queueHelpTitle}</h3>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t.pickerClose}
            data-testid="settings-queue-help-close"
            className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/90 hover:bg-white/20">
              <X className="h-5 w-5" aria-hidden="true" />
            </span>
          </button>
        </div>

        {/* 1) Interactive search by address */}
        <div
          data-testid="ztoe-address-lookup-section"
          className="flex w-full flex-col gap-3.5 rounded-3xl border-2 border-white/25 bg-white/[0.05] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
        >
          <div className="flex flex-col gap-1">
            <div className="text-sm font-extrabold uppercase leading-5 tracking-wider text-white">{t.addrFindTitle}</div>
            <div data-testid="ztoe-address-lookup-subtitle" className="text-[13px] font-medium leading-[19px] text-[#BAE6FD]/80">
              {t.queueHelpAddressSubtitle}
            </div>
          </div>

          <SearchablePickerField
            testId="ztoe-select-rem"
            label={t.addrRemLabel}
            value={currentRem ? displayName(currentRem, lang) : null}
            placeholder={t.addrRemPlaceholder}
            items={remItems}
            selectedId={selectedRemId}
            lang={lang}
            loading={rems.loading}
            loadFailed={rems.failed}
            onRetry={() => patch(setRems, { retry: rems.retry + 1 })}
            onSelect={(item) => {
              if (item.id !== selectedRemId) {
                setSelectedRemId(item.id);
                clearBelowRem();
              }
            }}
          />

          <SearchablePickerField
            testId="ztoe-select-settlement"
            label={t.addrCityLabel}
            value={currentSettlement ? displayName(currentSettlement, lang) : null}
            placeholder={t.addrCityPlaceholder}
            items={settlementItems}
            selectedId={selectedSettlementId || null}
            lang={lang}
            loading={settlements.loading}
            loadFailed={settlements.failed}
            onRetry={() => patch(setSettlements, { retry: settlements.retry + 1 })}
            onSelect={(item) => {
              if (item.id !== selectedSettlementId) {
                setSelectedSettlementId(item.id);
                clearBelowSettlement();
              }
            }}
          />

          <SearchablePickerField
            testId="ztoe-select-street"
            label={t.addrStreetLabel}
            value={currentStreet ? displayName(currentStreet, lang) : null}
            placeholder={t.addrStreetPlaceholder}
            items={streetItems}
            selectedId={selectedStreetId || null}
            lang={lang}
            enabled={selectedSettlementId !== ''}
            disabledHint={t.pickerChooseFirst}
            loading={streets.loading}
            loadFailed={streets.failed && selectedSettlementId !== ''}
            onRetry={() => patch(setStreets, { retry: streets.retry + 1 })}
            onSelect={(item) => {
              if (item.id !== selectedStreetId) {
                setSelectedStreetId(item.id);
                setSelectedHouse('');
                setHousesList(getHousesForStreet(item.id));
                setLookup(null);
              }
            }}
          />

          <SearchablePickerField
            testId="ztoe-select-house"
            label={t.addrHouseLabel}
            value={selectedHouse}
            placeholder={t.addrHousePlaceholder}
            items={houseItems}
            selectedId={selectedHouse || null}
            lang={lang}
            enabled={Boolean(currentStreet)}
            disabledHint={t.pickerChooseFirst}
            loading={houses.loading}
            loadFailed={houses.failed && Boolean(currentStreet)}
            onRetry={() => patch(setHouses, { retry: houses.retry + 1 })}
            kind="HOUSE"
            onSelect={(item) => {
              setSelectedHouse(item.id);
              setLookup(null);
            }}
          />

          {selectedHouse.trim() !== '' && matched && (
            <div
              data-testid="ztoe-lookup-result"
              className="mt-1.5 flex flex-col gap-2.5 rounded-2xl border-2 border-white/25 bg-[#141A29]/85 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
            >
              {selectedAddressStr && (
                <div data-testid="ztoe-lookup-selected-address" className="whitespace-pre-line text-sm font-semibold leading-5 text-[#BAE6FD]/90">
                  {selectedAddressStr}
                </div>
              )}

              {isChecking ? (
                <div className="flex items-center gap-2.5" role="status" data-testid="ztoe-lookup-checking">
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#FF5E3A]" aria-hidden="true" />
                  <span className={`flex-1 text-[13px] font-medium leading-[19px] ${TEXT_SECONDARY}`}>{t.addrChecking}</span>
                </div>
              ) : checkFailed ? (
                <div className="flex items-center gap-2.5" role="alert" data-testid="ztoe-lookup-check-failed">
                  <AlertCircle className="h-5 w-5 shrink-0 text-[#FBBF24]" aria-hidden="true" />
                  <span className="flex-1 text-[13px] font-medium leading-[19px] text-[#FBBF24]">{t.addrCheckFailed}</span>
                </div>
              ) : null}

              {matched.queue && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold leading-5 text-[#BAE6FD]/80">{t.foundQueue}</span>
                  <span className="whitespace-nowrap font-mono text-base font-extrabold leading-[22px] text-white">
                    {t.queue} {matched.queue}
                  </span>
                </div>
              )}

              {matched.statusText && (
                <div
                  data-testid="ztoe-lookup-status-text"
                  className="whitespace-normal break-words rounded-2xl border-2 border-white/20 bg-white/[0.06] px-4 py-3 text-sm font-bold leading-5 text-white"
                >
                  {matched.statusText}
                </div>
              )}

              <button
                type="button"
                data-testid="ztoe-lookup-confirm-btn"
                disabled={!canApply}
                onClick={apply}
                className={`min-h-12 w-full rounded-2xl px-4 py-3 text-base font-extrabold text-white transition-colors ${
                  canApply ? 'cursor-pointer bg-[#FF5E3A] shadow-lg shadow-[#FF5E3A]/30 hover:bg-[#ff4b24]' : 'cursor-not-allowed bg-[#FF5E3A]/40'
                }`}
              >
                {matched.queue ? `${t.applyQueue} ${matched.queue}` : t.addrConfirm}
              </button>
            </div>
          )}
        </div>

        {/* 2) Manual search heading ("Пошук вручну" / "Manual search") */}
        <div data-testid="queue-help-manual-search-title" className="px-1 pt-1 text-sm font-extrabold uppercase leading-5 tracking-wider text-white">
          {t.queueHelpManualSearchTitle}
        </div>

        {/* 3) Numbered instruction steps (1..4) */}
        <div className="flex flex-col gap-3 text-base leading-6 text-zinc-100">
          {/* Step 1 */}
          <div className={stepClass}>
            <span className={numClass}>1</span>
            <div className="flex-1">
              {lang === 'uk' ? (
                <span>
                  1. Відкрийте сторінку пошуку черги на сайті{' '}
                  <a href={settings.url || DEFAULT_ZTOE_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
                    https://www.ztoe.com.ua/unhooking-search.php <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  </a>
                </span>
              ) : (
                <span>
                  1. Open the queue lookup page on{' '}
                  <a href={settings.url || DEFAULT_ZTOE_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
                    https://www.ztoe.com.ua/unhooking-search.php <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  </a>
                </span>
              )}
            </div>
          </div>

          {/* Step 2 */}
          <div className={stepClass}>
            <span className={numClass}>2</span>
            <div className="flex-1">
              {lang === 'uk' ? (
                <span>2. Оберіть свій РЕМ, населений пункт і вулицю.</span>
              ) : (
                <span>2. Select your distribution district (РЕМ), settlement, and street.</span>
              )}
            </div>
          </div>

          {/* Step 3 */}
          <div className={stepClass}>
            <span className={numClass}>3</span>
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
          <div className={stepClass}>
            <span className={numClass}>4</span>
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
          type="button"
          data-testid="settings-queue-help-got-it"
          onClick={onDismiss}
          className="mt-1 min-h-12 w-full cursor-pointer rounded-2xl bg-white px-5 py-3 text-center text-base font-extrabold text-black shadow-lg transition-colors hover:bg-zinc-200"
        >
          {lang === 'uk' ? 'Зрозуміло' : 'Got it'}
        </button>
      </div>
    </div>
  );
};
