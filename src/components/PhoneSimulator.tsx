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
import { UserSettings, NotificationRecord } from '../types';
import type { OutageSnapshot } from '../services/outageRepository';
import { translations } from '../services/i18n';
import { getInterpolatedTimePalette } from '../services/timeOfDayPalette';
import { MainView } from './MainView';
import { SettingsView } from './SettingsView';
import { AboutView } from './AboutView';
import { WidgetSimulator } from './WidgetSimulator';
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'motion/react';
import { ZhytomyrRouletteModal } from './ZhytomyrRouletteModal';
import { cacheQueueSlotsForRoulette } from '../services/rouletteGame';
import { noAlertsCaption, switcherItems, type SubscriptionStore } from '../core/subscriptions';

interface PhoneSimulatorProps {
  /** One outage snapshot feeds the main screen and the three widgets (see OutageRepository.snapshot). */
  snapshot: OutageSnapshot;
  /** The address the main screen shows (spec/SUBSCRIPTIONS.md 9); the primary when absent. */
  mainSnapshot?: OutageSnapshot;
  mainSettings?: UserSettings;
  subscriptionStore?: SubscriptionStore;
  shownSubscriptionId?: string | null;
  onSelectSubscription?: (id: string) => void;
  /** What the widgets show (spec/SUBSCRIPTIONS.md 10); the primary when absent. */
  widgetSnapshot?: OutageSnapshot;
  widgetSettings?: UserSettings;
  widgetAddressLabel?: string | null;
  widgetBoundId?: string | null;
  onBindWidget?: (id: string | null) => void;
  widgetItemId?: string | null;
  /** A tap on the heads-up card: shows its address on the main screen. */
  onOpenNotification?: (record: NotificationRecord) => void;
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
  snapshot,
  mainSnapshot,
  mainSettings,
  subscriptionStore,
  shownSubscriptionId = null,
  onSelectSubscription,
  widgetSnapshot,
  widgetSettings,
  widgetAddressLabel = null,
  widgetBoundId = null,
  onBindWidget,
  widgetItemId = null,
  onOpenNotification,
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
  const [isRouletteOpen, setIsRouletteOpen] = React.useState(false);
  const [imitatedNotification, setImitatedNotification] = React.useState<NotificationRecord | null>(null);
  const [autoOpenQueueHelp, setAutoOpenQueueHelp] = React.useState(false);

  React.useEffect(() => {
    const handleFirstLaunchReset = () => {
      setIsRouletteOpen(false);
      setImitatedNotification(null);
      setAutoOpenQueueHelp(false);
    };
    window.addEventListener('zt-app-first-launch-reset', handleFirstLaunchReset);
    return () => window.removeEventListener('zt-app-first-launch-reset', handleFirstLaunchReset);
  }, []);

  React.useEffect(() => {
    // The roulette plays on today's 48 cells of the selected queue, the same cells the drum shows
    const slots = snapshot.slotsFor(snapshot.today);
    if (snapshot.queue && slots.length) {
      cacheQueueSlotsForRoulette(snapshot.queue, slots);
    }
  }, [snapshot]);

  React.useEffect(() => {
    if (activeTab !== 'about') {
      setIsRouletteOpen(false);
    }
  }, [activeTab]);

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

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  // Screens in the order of the bottom dock: swiping left goes to the next one (as the Android pager)
  const tabOrder = ['schedule', 'widget', 'settings', 'about'] as const;
  const tabIndex = tabOrder.indexOf(activeTab);
  const previousTab = React.useRef(activeTab);
  const direction = tabIndex >= tabOrder.indexOf(previousTab.current) ? 1 : -1;
  React.useEffect(() => {
    previousTab.current = activeTab;
  }, [activeTab]);
  const reduceMotion = useReducedMotion() ?? false;
  const pageRef = React.useRef<HTMLDivElement>(null);

  const displayedNotification = imitatedNotification || activeNotification;
  const hasFeaturedEmergency = React.useMemo(() => snapshot.featuredEmergency() !== null, [snapshot]);
  const isQueueUnselectedView =
    (!settings.queue || settings.queue.trim() === '') && !settings.customQueueStatusText && !hasFeaturedEmergency && activeTab === 'schedule';

  return (
    <div className="relative mx-auto w-[416px] max-w-full rounded-[52px] bg-[#07090E] p-3.5 shadow-[0_25px_60px_rgba(0,0,0,0.8)] ring-1 ring-white/10 select-none">
      
      {/* Phone Screen Canvas in strict 9:20 smartphone aspect ratio (1080x2400 proportion) */}
      <div
        className="relative overflow-hidden rounded-[42px] w-full aspect-[9/20] flex flex-col border border-white/15 text-white transition-colors duration-1000"
        style={{ backgroundColor: timePalette.primary, transform: 'translateZ(0)' }}
      >
        {/* Primary (60%) blurred atmospheric base layer */}
        <div
          className="absolute inset-0 opacity-60 blur-3xl pointer-events-none transition-colors duration-1000"
          style={{
            background: `radial-gradient(circle at 50% 45%, ${timePalette.primary} 0%, ${timePalette.secondary} 100%)`,
          }}
        />
        {/* The orbs drift very slowly (zt-drift-*) and move a little against the screen change (3 % per screen) */}
        <div
          className="pointer-events-none absolute inset-0 translate-x-(--zt-parallax) transition-transform duration-[600ms] ease-[cubic-bezier(0.77,0,0.175,1)] motion-reduce:translate-x-0 motion-reduce:transition-none"
          style={{ ['--zt-parallax' as string]: `${-tabIndex * 3}%` }}
        >
          {/* Secondary (30%) blurred orb */}
          <div
            className="zt-drift-1 absolute -top-8 -right-8 w-80 h-80 rounded-full opacity-75 blur-3xl pointer-events-none transition-colors duration-1000"
            style={{ backgroundColor: timePalette.secondary }}
          />
          {/* Supporting/Core top-left contrast orb for crisp header readability */}
          <div
            className="zt-drift-2 absolute -top-12 -left-12 w-72 h-72 rounded-full opacity-70 blur-3xl pointer-events-none transition-colors duration-1000"
            style={{ backgroundColor: timePalette.supporting }}
          />
          {/* Secondary (30%) lower-left wave */}
          <div
            className="zt-drift-3 absolute bottom-1/4 -left-16 w-80 h-80 rounded-full opacity-65 blur-3xl pointer-events-none transition-colors duration-1000"
            style={{ backgroundColor: timePalette.secondary }}
          />
          {/* Accent (10%) blurred highlight orb */}
          <div
            className="zt-drift-4 absolute bottom-12 right-6 w-60 h-60 rounded-full opacity-60 blur-3xl pointer-events-none transition-colors duration-1000"
            style={{ backgroundColor: timePalette.accent }}
          />
        </div>
        {/* Subtle top scrim to guarantee status bar and header contrast across all 4 day phases */}
        <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-[#0B0C10]/65 via-[#0B0C10]/25 to-transparent pointer-events-none" />

        {/* Status Bar in Strict 24-Hour Clock */}
        <div className="relative z-30 shrink-0 flex items-center justify-between px-7 pt-4 pb-2 text-[13px] font-semibold text-sky-100">
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
        {displayedNotification && (
          <div className="absolute top-12 left-4 right-4 z-[60] animate-slide-down">
            <div className="bg-[#141A29]/90 text-white backdrop-blur-2xl rounded-2xl p-4 shadow-2xl border border-white/20 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#FF5E3A] flex items-center justify-center text-white shrink-0 mt-0.5 shadow-md">
                  <Zap className="w-4 h-4 fill-current" />
                </div>
                <div
                  role={!imitatedNotification && onOpenNotification ? 'button' : undefined}
                  tabIndex={!imitatedNotification && onOpenNotification ? 0 : undefined}
                  data-testid="heads-up-open"
                  onClick={() => {
                    if (!imitatedNotification && activeNotification) onOpenNotification?.(activeNotification);
                  }}
                  className={!imitatedNotification && onOpenNotification ? 'cursor-pointer' : undefined}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-[#FF5E3A] uppercase tracking-wider">Світло в Житомирі</span>
                    <span className="text-[10px] text-sky-200/70 font-mono">· {t.now}</span>
                  </div>
                  <div className="text-xs font-bold text-white mt-0.5">
                    {displayedNotification.title}
                  </div>
                  <div className="text-[11px] text-zinc-300 leading-snug mt-0.5">
                    {displayedNotification.message}
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  if (imitatedNotification) {
                    setImitatedNotification(null);
                  } else {
                    onDismissNotification();
                  }
                }}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Scrollable View Area */}
        <div
          ref={scrollContainerRef}
          className={`flex-1 min-h-0 ${
            (!settings.queue || settings.queue.trim() === '') &&
            !settings.customQueueStatusText &&
            !hasFeaturedEmergency &&
            activeTab === 'schedule'
              ? 'overflow-hidden'
              : 'overflow-y-auto overscroll-contain scroll-smooth'
          } overflow-x-hidden px-4 pt-2 pb-28 relative z-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
        >
          {/* Swipe between screens: the page follows the finger and, past a quarter of its width (or on a
              flick), slides out while the next one comes in from that side; dock taps play the same slide.
              Spring 300/30 = PageGlide on Android. Under reduced motion the pages only cross-fade. */}
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={activeTab}
            ref={pageRef}
            data-testid="phone-page"
            custom={direction}
            variants={{
              enter: (d: number) => (reduceMotion ? { x: 0, opacity: 0 } : { x: d > 0 ? '100%' : '-100%', opacity: 0.65 }),
              center: { x: 0, opacity: 1 },
              exit: (d: number) => (reduceMotion ? { x: 0, opacity: 0 } : { x: d > 0 ? '-100%' : '100%', opacity: 0.65 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ x: { type: 'spring', stiffness: 300, damping: 30 }, opacity: { duration: 0.2, ease: [0.215, 0.61, 0.355, 1] } }}
            drag={isRouletteOpen || isQueueUnselectedView ? false : 'x'}
            dragDirectionLock
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: tabIndex < tabOrder.length - 1 ? 1 : 0.2, right: tabIndex > 0 ? 1 : 0.2 }}
            dragTransition={{ bounceStiffness: 300, bounceDamping: 30 }}
            onDragEnd={(_e: PointerEvent, info: PanInfo) => {
              const width = pageRef.current?.offsetWidth ?? 360;
              const swipe = info.offset.x + info.velocity.x * 0.2;
              if (swipe < -width * 0.25 && tabIndex < tabOrder.length - 1) setActiveTab(tabOrder[tabIndex + 1]);
              else if (swipe > width * 0.25 && tabIndex > 0) setActiveTab(tabOrder[tabIndex - 1]);
            }}
          >
          {activeTab === 'schedule' && (
            <MainView
              snapshot={mainSnapshot ?? snapshot}
              settings={mainSettings ?? settings}
              addresses={subscriptionStore ? switcherItems(subscriptionStore) : []}
              primaryAddressId={subscriptionStore?.primaryId ?? null}
              shownAddressId={shownSubscriptionId}
              onSelectAddress={onSelectSubscription}
              showNoAlertsCaption={subscriptionStore ? noAlertsCaption(settings.alertsMaster ?? true, subscriptionStore) : false}
              onOpenSettings={() => setActiveTab('settings')}
              lang={lang}
              onToggleNotifications={onToggleNotifications}
              onRefresh={onRefresh}
              isRefreshing={isRefreshing}
              onSendTestAlert={onSendTestAlert}
              onOpenQueueSelection={() => {
                setAutoOpenQueueHelp(true);
                setActiveTab('settings');
              }}
              onChangeLanguage={(newLang) =>
                onUpdateSettings({
                  ...settings,
                  language: newLang
                })
              }
            />
          )}

          {activeTab === 'widget' && (
            <WidgetSimulator
              snapshot={widgetSnapshot ?? snapshot}
              now={now}
              settings={widgetSettings ?? settings}
              lang={lang}
              onToggleNotifications={onToggleNotifications}
              onRefresh={onRefresh}
              isRefreshing={isRefreshing}
              addressLabel={widgetAddressLabel}
              subscriptionStore={subscriptionStore}
              boundId={widgetBoundId}
              onBind={onBindWidget}
              onOpenApp={() => {
                if (widgetItemId) onSelectSubscription?.(widgetItemId);
                setActiveTab('schedule');
              }}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              settings={settings}
              lang={lang}
              // the first address keeps the user in Settings (owner request)
              onUpdateSettings={onUpdateSettings}
              onSendTestAlert={onSendTestAlert}
              onForceRefresh={onRefresh}
              isRefreshing={isRefreshing}
              onResetDefaults={onResetDefaults}
              autoOpenQueueHelp={autoOpenQueueHelp}
              onQueueHelpOpened={() => setAutoOpenQueueHelp(false)}
              onNavigateToMain={() => setActiveTab('schedule')}
            />
          )}

          {activeTab === 'about' && (
            <AboutView
              lang={lang}
              onOpenRoulette={() => setIsRouletteOpen(true)}
            />
          )}
          </motion.div>
          </AnimatePresence>
        </div>

        {/* Zhytomyr Roulette Full-Screen Overlay (positioned below Android Status Bar, hiding Navigation Bar) */}
        <ZhytomyrRouletteModal
          isOpen={isRouletteOpen}
          onClose={() => setIsRouletteOpen(false)}
          lang={lang}
          providerUrl={settings.url}
          queue={settings.queue}
          now={now}
          onImitatedNotification={(record) => setImitatedNotification(record)}
        />

        {/* Floating Capsule Bottom Navigation Dock in Frosted Glass (hidden while Zhytomyr Roulette is open) */}
        {!isRouletteOpen && (
          <div
            data-testid="bottom-nav-dock"
            className={`absolute bottom-5 left-1/2 -translate-x-1/2 z-40 w-[84%] max-w-[320px] transition-all duration-300 ${
              (!settings.queue || settings.queue.trim() === '') &&
              !settings.customQueueStatusText &&
              !hasFeaturedEmergency &&
              activeTab === 'schedule'
                ? 'opacity-15 brightness-50 pointer-events-none select-none'
                : ''
            }`}
          >
            <div className="zt-glass rounded-full p-1.5 flex items-center justify-around">
              
              {/* 1. Schedule */}
              <button
                onClick={() => setActiveTab('schedule')}
                disabled={
                  (!settings.queue || settings.queue.trim() === '') &&
                  !settings.customQueueStatusText &&
                  !hasFeaturedEmergency &&
                  activeTab === 'schedule'
                }
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
                disabled={
                  (!settings.queue || settings.queue.trim() === '') &&
                  !settings.customQueueStatusText &&
                  !hasFeaturedEmergency &&
                  activeTab === 'schedule'
                }
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
                disabled={
                  (!settings.queue || settings.queue.trim() === '') &&
                  !settings.customQueueStatusText &&
                  !hasFeaturedEmergency &&
                  activeTab === 'schedule'
                }
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
                disabled={
                  (!settings.queue || settings.queue.trim() === '') &&
                  !settings.customQueueStatusText &&
                  !hasFeaturedEmergency &&
                  activeTab === 'schedule'
                }
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
        )}

        {/* Modal root: dialogs of the screens (address picker, queue help) render here, above the navigation dock */}
        <div data-phone-modal-root className="pointer-events-none absolute inset-0 z-[55] [&>*]:pointer-events-auto" />

        {/* Android Gesture Bar */}
        <div className="shrink-0 flex justify-center pb-2 bg-transparent z-10">
          <div className="w-32 h-1 rounded-full bg-white/25" />
        </div>
      </div>
    </div>
  );
};
