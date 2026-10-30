/**
 * Bilingual localization engine (Ukrainian & English)
 */
import { Language } from '../types';

export const translations = {
  uk: {
    appTitle: 'ZT Blackout Pre-Warning',
    appSubtitle: 'Попередження про відключення світла',
    queue: 'Черга',
    queueShort: 'Ч',
    today: 'Сьогодні',
    tomorrow: 'Завтра',
    now: 'Зараз',
    statusPowerOn: 'Світло є',
    statusPowerOff: 'Немає світла',
    nextBlackoutIn: 'До відключення',
    blackoutActiveNow: 'Зараз немає світла',
    powerRestoresIn: 'Світло увімкнуть через',
    noMoreBlackoutsToday: 'Відключень більше немає',
    scheduledSlot: 'Період',
    currentTime: 'Поточний час',
    timeRemaining: 'Залишилось',
    hoursShort: 'год',
    minutesShort: 'хв',
    secondsShort: 'сек',
    notifications: 'Сповіщення',
    notificationsOn: 'Сповіщення: ВКЛ',
    notificationsOff: 'Сповіщення: ВИКЛ',
    notificationsTurnedOffShort: 'ВИКЛ',
    notificationsTurnedOnShort: 'ВКЛ',
    quickToggleAlerts: 'Перемкнути сповіщення',
    forceRefresh: 'Оновити',
    refreshing: 'Оновлення...',
    lastUpdated: 'Оновлено',
    nextRefreshAt: 'Наступне оновлення',
    sendTestAlert: 'Тестове сповіщення',
    testAlertSent: 'Тестове сповіщення надіслано',
    testAlertTitle: 'Попередження про відключення',
    testAlertBody: 'Черга {queue}: відключення через {minutes} хв ({slot}).',
    realAlertTitle: 'Попередження про відключення',
    realAlertBody: 'Черга {queue}: відключення о {time} (через {minutes} хв).',
    
    // Navigation
    navSchedule: 'Графік',
    navSettings: 'Налаштування',
    navAbout: 'Про додаток',
    navWidget: 'Віджет',
    navCode: 'Код',
    navPlayStore: 'Play Store',

    // Settings
    settingsTitle: 'Налаштування',
    settingsProviderUrl: 'Адреса сайту',
    settingsProviderDesc: 'Адреса графіка відключень, зазвичай не потрібно змінювати',
    settingsQueue: 'Черга',
    settingsQueueDesc: 'Оберіть вашу чергу',
    settingsRefreshInterval: 'Період автооновлення (хвилин)',
    settingsAdvanceNotice: 'Попереджати заздалегідь (хвилин)',
    settingsMinutes: 'хвилин',
    settingsSound: 'Звуковий сигнал сповіщення',
    settingsVibration: 'Вібрація при сповіщенні',
    settingsTheme: 'Тема оформлення',
    settingsThemeSystem: 'Як у системі (за замовчуванням)',
    settingsThemeDark: 'Темна (економія батареї)',
    settingsThemeLight: 'Світла',
    settingsLanguage: 'Мова інтерфейсу',
    settingsLangSystem: 'Як у системі (Auto)',
    settingsLangUk: 'Українська',
    settingsLangEn: 'English',
    settingsActions: 'Дії та діагностика',
    settingsResetDefaults: 'Скинути до стандартних значень',
    settingsResetConfirm: 'Усі налаштування повернуто до значень за замовчуванням.',
    
    // About
    aboutTitle: 'Про додаток',
    aboutVersion: 'Версія',
    aboutAuthor: 'Розробник',
    aboutAuthorName: 'Ігор Захаров (Igor Zaharov)',
    aboutDesc: 'Мобільний застосунок для Android для своєчасного інформування про планові та аварійні відключення електроенергії в мережах АТ «Житомиробленерго» (ztoe.com.ua). Створено на базі оригінального Windows Desktop додатку UABlackoutPreWarning.',
    aboutDesktopNotice: 'Базується на алгоритмі парсингу оригінальної програми для Windows.',
    aboutLinks: 'Посилання на проект',
    aboutGithubProfile: 'Мій головний GitHub профіль',
    aboutRepoIssues: 'Повідомити про помилку / Пропозиції (GitHub Issues)',
    aboutDesktopRepo: 'Оригінальний Windows Desktop додаток',
    aboutDisclaimer: 'Додаток використовує відкриті загальнодоступні дані офіційного веб-сайту ztoe.com.ua. Не є офіційним представником компанії.',

    // Widget
    widgetPreviewTitle: 'Віджет робочого столу Android (Glance)',
    widgetTapNotice: 'Натискання на віджет відкриває додаток. Кнопка керує сповіщеннями на місці.',
    widgetSize2x1: 'Компактний 2x1',
    widgetSize3x2: 'Розширений 3x2 / 4x2',
    widgetMuteAlerts: 'Вимкнути',
    widgetResumeAlerts: 'Увімкнути',
    widgetNextIn: 'Через',

    // Parser status
    liveSiteOnline: 'Сайт ztoe.com.ua онлайн',
    tableParsedSuccess: 'Таблицю ГПВ успішно розпізнано',
    currentQueueHighlight: 'Виділено чергу'
  },
  en: {
    appTitle: 'ZT Blackout Pre-Warning',
    appSubtitle: 'Power Outage Advance Warning Alert',
    queue: 'Queue',
    queueShort: 'Q',
    today: 'Today',
    tomorrow: 'Tomorrow',
    now: 'Now',
    statusPowerOn: 'Power ON',
    statusPowerOff: 'Blackout (Power OFF)',
    statusMaybeOff: 'Possible Outage',
    nextBlackoutIn: 'Closest Power Outage In',
    blackoutActiveNow: 'Power Outage is Active Right Now!',
    powerRestoresIn: 'Power expected to restore in',
    noMoreBlackoutsToday: 'No more blackouts scheduled for today',
    scheduledSlot: 'Scheduled timeslot',
    currentTime: 'Current time',
    timeRemaining: 'Time remaining',
    hoursShort: 'h',
    minutesShort: 'm',
    secondsShort: 's',
    notifications: 'Notifications',
    notificationsOn: 'Notifications: ON',
    notificationsOff: 'Notifications: OFF',
    notificationsTurnedOffShort: 'OFF',
    notificationsTurnedOnShort: 'ON',
    quickToggleAlerts: 'Toggle Alerts',
    forceRefresh: 'Refresh',
    refreshing: 'Refreshing...',
    lastUpdated: 'Updated',
    nextRefreshAt: 'Next refresh',
    sendTestAlert: 'Test Notification',
    testAlertSent: 'Test alert sent',
    testAlertTitle: 'Blackout Warning',
    testAlertBody: 'Queue {queue}: power outage in {minutes} min ({slot}).',
    realAlertTitle: 'Blackout Warning',
    realAlertBody: 'Queue {queue}: power will turn off at {time} (in {minutes} min).',

    // Navigation
    navSchedule: 'Schedule',
    navSettings: 'Settings',
    navAbout: 'About',
    navWidget: 'Widget',
    navCode: 'Code',
    navPlayStore: 'Play Store',

    // Settings
    settingsTitle: 'Settings',
    settingsProviderUrl: 'Site address',
    settingsProviderDesc: 'Blackout chart address, usually no need to change',
    settingsQueue: 'Queue',
    settingsQueueDesc: 'Select your queue',
    settingsRefreshInterval: 'Site refresh interval (minutes)',
    settingsAdvanceNotice: 'Advance warning (minutes)',
    settingsMinutes: 'minutes',
    settingsSound: 'Notification sound',
    settingsVibration: 'Vibration on alert',
    settingsTheme: 'App Theme',
    settingsThemeSystem: 'Follow System (Default)',
    settingsThemeDark: 'Dark Mode (OLED battery save)',
    settingsThemeLight: 'Light Mode',
    settingsLanguage: 'Interface Language',
    settingsLangSystem: 'Follow System (Auto)',
    settingsLangUk: 'Українська',
    settingsLangEn: 'English',
    settingsActions: 'Diagnostics & Actions',
    settingsResetDefaults: 'Restore Default Settings',
    settingsResetConfirm: 'All settings have been restored to defaults.',

    // About
    aboutTitle: 'About Application',
    aboutVersion: 'Version',
    aboutAuthor: 'Developer',
    aboutAuthorName: 'Igor Zaharov',
    aboutDesc: 'Native Android application for timely pre-warnings and monitoring of scheduled and emergency electricity blackouts on the Zhytomyroblenergo (ztoe.com.ua) power grid. Rebuilt from the original Windows Desktop UABlackoutPreWarning application.',
    aboutDesktopNotice: 'Built upon the parsing logic and algorithms of the original Windows application.',
    aboutLinks: 'Project Links',
    aboutGithubProfile: 'My Main GitHub Profile',
    aboutRepoIssues: 'Report Issues & Requests (GitHub Issues)',
    aboutDesktopRepo: 'Original Windows Desktop Application',
    aboutDisclaimer: 'This application uses public schedule information from ztoe.com.ua. Not an official affiliate of the utility company.',

    // Widget
    widgetPreviewTitle: 'Android Home Screen Widget (Glance)',
    widgetTapNotice: 'Tapping widget opens the app. Button toggles alerts on the spot.',
    widgetSize2x1: 'Compact 2x1',
    widgetSize3x2: 'Expanded 3x2 / 4x2',
    widgetMuteAlerts: 'Mute',
    widgetResumeAlerts: 'Resume',
    widgetNextIn: 'In',

    // Parser status
    liveSiteOnline: 'ztoe.com.ua website online',
    tableParsedSuccess: 'Schedule table parsed successfully',
    currentQueueHighlight: 'Highlighting queue'
  }
};

export function resolveLanguage(pref: Language): 'uk' | 'en' {
  if (pref === 'uk') return 'uk';
  if (pref === 'en') return 'en';
  // Follow OS / browser language
  if (typeof navigator !== 'undefined' && navigator.language) {
    if (navigator.language.toLowerCase().startsWith('uk')) {
      return 'uk';
    }
  }
  return 'uk'; // Default to Ukrainian for this Ukrainian utility app
}
