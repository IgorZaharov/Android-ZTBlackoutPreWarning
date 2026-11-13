/**
 * Bilingual localization engine (Ukrainian & English)
 */
import { Language } from '../types';

export const translations = {
  uk: {
    appTitle: 'Світло в Житомирі',
    appSubtitle: 'Попередження про відключення світла',
    queue: 'Черга',
    queueShort: 'Ч',
    today: 'Сьогодні',
    tomorrow: 'Завтра',
    now: 'Зараз',
    statusPowerOn: 'Світло є',
    statusPowerOff: 'Немає світла',
    statusUnclear: 'Невідомо',
    outagesUnclear: 'Графіки не діють',
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
    notifications: 'Увімкнути сповіщення',
    notificationsOn: 'Сповіщення: ВКЛ',
    notificationsOff: 'Сповіщення: ВИКЛ',
    notificationsTurnedOffShort: 'ВИКЛ',
    notificationsTurnedOnShort: 'ВКЛ',
    quickToggleAlerts: 'Перемкнути сповіщення',
    forceRefresh: 'Оновити',
    refreshing: 'Оновлення…',
    lastUpdated: 'Останнє оновлення:',
    nextRefreshAt: 'Наступне оновлення',
    sendTestAlert: 'Тестове сповіщення',
    testAlertSent: 'Тестове сповіщення надіслано',
    testAlertTitle: 'Попередження про відключення',
    testAlertBody: 'Черга {queue}: відключення через {minutes} хв ({slot}).',
    realAlertTitle: 'Попередження про відключення',
    realAlertBody: 'Черга {queue}: відключення о {time} (через {minutes} хв).',
    errorNoInternet: 'Немає доступу до Інтернету',
    errorNoQueuesFound: 'На сайті не знайдено черг',
    refreshSuccessToast: 'Сайт доступний, графік оновлено',
    emergencyOutagesLabel: 'Інформація про аварійні відключення:',
    siteSchedulesLabel: 'Графіки відключень на сайті',
    
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
    settingsEmergencyOutages: 'Сповіщення про аварійні відключення',
    myAddressesTitle: 'МОЇ АДРЕСИ',
    myAddressesDesc: 'Окремі сповіщення для кожної адреси',
    primaryBadge: 'Основна',
    makePrimary: 'Зробити основною',
    plannedShort: 'Планові',
    emergencyShort: 'Аварійні',
    emergencyDesc: 'Початок, зміна часу, відновлення',
    emergencyNeedsAddress: 'Лише для адреси: за чергою аварійних даних немає',
    queueOnlyCaption: 'Без адреси, лише черга',
    addAddress: 'Додати адресу',
    addQueueOnly: 'Або додати лише чергу',
    addressDuplicate: 'Ця адреса вже є у списку',
    addressAdded: 'Адресу додано',
    removeAddress: 'Видалити',
    removeConfirmTitle: 'Видалити адресу?',
    renameAddress: 'Перейменувати',
    renameHint: 'Порожньо — назва з адреси',
    save: 'Зберегти',
    masterHint: 'Головний вимикач для всіх адрес',
    noAddressAlerts: 'Для жодної адреси сповіщення не ввімкнені',
    queueHelpSubtitle: '(Або закрийте це вікно та виберіть тільки чергу)',
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
    aboutDonations: 'Charity / Благодійність і Пожертви',
    aboutGithubProfile: 'Мій головний GitHub профіль',
    aboutRepoIssues: 'Повідомити про помилку / Пропозиції (GitHub Issues)',
    aboutDesktopRepo: 'Світло в Житомирі на Github',
    aboutDisclaimer: 'Додаток використовує відкриті загальнодоступні дані офіційного веб-сайту ztoe.com.ua. Не є офіційним представником компанії.',

    // Widget
    widgetPreviewTitle: 'Віджет робочого столу Android (Glance)',
    widgetTapNotice: 'Натискання на віджет відкриває додаток. Кнопка керує сповіщеннями на місці.',
    widgetSize2x1: 'Компактний 2x1',
    widgetSize3x2: 'Розширений 3x2 / 4x2',
    widgetSize4x1: 'Графік 4x1',
    widgetSizeAll: 'Усі три',
    widgetStripName: 'Світло в Житомирі (Графік)',
    widgetSmallName: 'Світло в Житомирі (Малий)',
    widgetBigName: 'Світло в Житомирі (Великий)',
    widgetMuteAlerts: 'Вимкнути',
    widgetResumeAlerts: 'Увімкнути',
    widgetNextIn: 'Через',

    // Parser status
    liveSiteOnline: 'Сайт ztoe.com.ua онлайн',
    tableParsedSuccess: 'Таблицю ГПВ успішно розпізнано',
    currentQueueHighlight: 'Виділено чергу',

    // v1.4.0 (mirrors the "v1.4.0" block of android/.../ui/AppStrings.kt)
    siteStateWithTable: 'Сайт ZTOE доступний, графік опубліковано',
    siteStateNoTable: 'Сайт ZTOE доступний, але графіка немає',
    siteStateUnreachable: 'Сайт ZTOE недоступний, інтернет є',
    siteStateNoInternet: 'Немає інтернету',
    siteStateChecking: 'Перевірка сайту ZTOE…',
    siteStateHintNoTable: 'Графік ще не опубліковано або сторінка змінилась.',
    siteStateHintUnreachable: 'Застосунок повторить спробу сам.',
    siteStateHintNoInternet: "Перевірте з'єднання з Інтернетом.",
    tomorrowPublished: 'Графік на завтра: опубліковано',
    tomorrowNotPublishedShort: 'Графік на завтра: ще немає',
    tomorrowNotPublished: 'Графік на завтра ще не опубліковано на сайті',
    poweronUnavailable: 'Аварійні відключення: дані недоступні',
    kindPlanned: 'Планове',
    kindRepair: 'Планові роботи',
    kindEmergency: 'Аварійне',
    rowFinished: 'завершено',
    rowOverdue: 'очікується відновлення',
    rowMayContinue: 'можливе продовження',
    tomorrowWord: 'завтра',
    yesterdayWord: 'вчора',
    plannedAlertTitle: 'Попередження: відключення світла',
    emergencyStartTitle: 'Аварійне відключення',
    emergencyUpcomingTitle: 'Заплановано аварійне відключення',
    emergencyChangedTitle: 'Змінився час відновлення',
    emergencyEndTitle: 'Аварійне відключення завершено',
    exactAlarmTitle: 'Дозвольте точні сповіщення',
    exactAlarmBody: 'Щоб попередження приходили вчасно, увімкніть для застосунку дозвіл «Будильники й нагадування» в налаштуваннях телефону. Без нього сповіщення можуть запізнюватись.',
    exactAlarmButton: 'Відкрити налаштування',
    mainUtilityName: 'Житомиробленерго (ZTOE)',
    mainLangAuto: 'Авто',
    switchOn: 'Увімкнено',
    switchOff: 'Вимкнено',
    drumTitle: 'Шкала доби',
    drumNoOutages: 'відключень немає',
    drumEmergencyMark: 'аварійне',

    // v1.4.0 main / widget / settings strings (same names as AppStrings.kt)
    tabSelected: 'Обрано',
    widgetNoOutages: 'Відключень немає',
    widgetNoMoreOutages: 'Сьогодні більше немає',
    widgetTomorrowPrefix: 'Завтра',
    pickerSearchHint: 'Пошук',
    pickerNothingFound: 'Нічого не знайдено',
    pickerLoading: 'Завантаження…',
    pickerLoadError: 'Не вдалося завантажити список',
    pickerRetry: 'Повторити',
    pickerClearSearch: 'Очистити пошук',
    pickerClose: 'Закрити',
    pickerSelected: 'Обрано',
    pickerChooseFirst: 'Спочатку оберіть попереднє поле',
    addrFindTitle: 'Пошук черги за адресою',
    addrRemLabel: 'РЕМ',
    addrCityLabel: 'Населений пункт',
    addrStreetLabel: 'Вулиця',
    addrHouseLabel: 'Будинок',
    addrRemPlaceholder: 'Оберіть РЕМ',
    addrCityPlaceholder: 'Оберіть населений пункт',
    addrStreetPlaceholder: 'Оберіть вулицю',
    addrHousePlaceholder: 'Оберіть будинок',
    addrHousePrefix: 'буд.',
    addrChecking: 'Перевіряємо адресу на сайті…',
    addrCheckFailed: 'Не вдалося перевірити адресу на сайті. Показано збережені дані.',
    addrConfirm: 'Підтвердити вибір',
    addrSaved: 'Адресу збережено',
    noQueueNotDisconnected: 'Черга відсутня (не вимикається)',
    settingsReset: 'Налаштування скинуто',
    langSystem: 'Системна',
    notificationsHint: 'Попередження за графіком: за вибраний час до початку відключення',
    emergencyHint: 'Аварійні сповіщення працюють окремо від планових',
    soundVibrationHint: 'Звук і вібрація діють для всіх сповіщень',
    advanceNoticeHint: 'Для планових сповіщень',
    refreshFloorHint: 'Android перевіряє не частіше ніж раз на 15 хв',

    // v1.4.0 main / settings strings still missing (same names as AppStrings.kt)
    powerOn: 'ЗАРАЗ СВІТЛО Є',
    powerOff: 'ЗАРАЗ НЕМАЄ СВІТЛА',
    powerUnclear: 'Невідомо',
    powerOnIn: 'Світло увімкнуть через:',
    powerOffIn: 'До відключення залишилось:',
    outagePeriod: 'Період відключення:',
    nextPeriod: 'Найближчий період:',
    blackoutHoursHeader: 'ГОДИНИ БЕЗ СВІТЛА НА ЦЕЙ ДЕНЬ:',
    blackoutHoursForDayHeader: 'Години відключень на сьогодні:',
    blackoutHoursForTomorrowHeader: 'Години відключень на завтра:',
    selectQueueAction: 'Виберіть чергу',
    emergencyOutageTitle: 'Аварійне відключення!',
    emergencyStartLabel: 'Початок:',
    emergencyRestoreLabel: 'Орієнтовне відновлення:',
    noBlackoutsScheduled: 'Відключень не заплановано',
    hourShort: 'год',
    minShort: 'хв',
    nextUpdated: 'Наступне оновлення:',
    refreshBtn: 'Оновити дані',
    queueTitle: 'ЧЕРГА ВІДКЛЮЧЕННЯ',
    queueDesc: 'Оберіть підчергу за вашою адресою',
    siteAddressTitle: 'АДРЕСА САЙТУ',
    siteAddressDesc: 'Адреса графіка відключень, зазвичай не потрібно змінювати',
    siteReachable: '✓ Доступний',
    siteInvalid: '⚠ Некоректна адреса',
    advanceNoticeTitle: 'ПОПЕРЕДЖАТИ ЗАЗДАЛЕГІДЬ',
    refreshIntervalTitle: 'ІНТЕРВАЛ ПЕРЕВІРКИ САЙТУ',
    sound: 'Звуковий сигнал',
    vibration: 'Вібрація',
    emergencyNotifications: 'Сповіщення про аварійні відключення',
    languageTitle: 'МОВА ІНТЕРФЕЙСУ',
    testAlertBtn: 'Тест сповіщення',
    resetDefaultsBtn: 'Скинути налаштування',
    resetConfirmTitle: 'Скинути налаштування?',
    resetConfirmDesc: 'Усі параметри повернуться до початкових значень (черга не обрана, таймери 15/30 хв).',
    resetYes: 'Скинути',
    cancel: 'Скасувати',
    queueHelpTitle: 'Як дізнатися свою чергу',
    queueHelpAddressSubtitle: '(Або закрийте це вікно та виберіть тільки чергу)',
    queueHelpManualSearchTitle: 'Пошук вручну',
    queueHelpGotIt: 'Зрозуміло',
    foundQueue: 'Знайдена черга:',
    applyQueue: 'Обрати чергу',
    pickerShowMore: 'Показати ще'
  },
  en: {
    appTitle: 'Світло в Житомирі',
    appSubtitle: 'Power Outage Advance Warning Alert',
    queue: 'Queue',
    queueShort: 'Q',
    today: 'Today',
    tomorrow: 'Tomorrow',
    now: 'Now',
    statusPowerOn: 'Power ON',
    statusPowerOff: 'Blackout (Power OFF)',
    statusMaybeOff: 'Possible Outage',
    statusUnclear: 'Unclear',
    outagesUnclear: 'Outages unclear',
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
    notifications: 'Enable notifications',
    notificationsOn: 'Notifications: ON',
    notificationsOff: 'Notifications: OFF',
    notificationsTurnedOffShort: 'OFF',
    notificationsTurnedOnShort: 'ON',
    quickToggleAlerts: 'Toggle Alerts',
    forceRefresh: 'Refresh',
    refreshing: 'Refreshing…',
    lastUpdated: 'Last updated:',
    nextRefreshAt: 'Next refresh',
    sendTestAlert: 'Test Notification',
    testAlertSent: 'Test alert dispatched',
    testAlertTitle: 'Blackout Warning',
    testAlertBody: 'Queue {queue}: power outage in {minutes} min ({slot}).',
    realAlertTitle: 'Blackout Warning',
    realAlertBody: 'Queue {queue}: power will turn off at {time} (in {minutes} min).',
    errorNoInternet: 'No Internet access',
    errorNoQueuesFound: 'No queues found on site',
    refreshSuccessToast: 'Site reachable, schedule updated',
    emergencyOutagesLabel: 'Emergency outages info:',
    siteSchedulesLabel: 'Графіки відключень на сайті',

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
    settingsEmergencyOutages: 'Emergency outage notifications',
    myAddressesTitle: 'MY ADDRESSES',
    myAddressesDesc: 'Separate alerts for each address',
    primaryBadge: 'Primary',
    makePrimary: 'Make primary',
    plannedShort: 'Planned',
    emergencyShort: 'Emergency',
    emergencyDesc: 'Start, time change, restoration',
    emergencyNeedsAddress: 'Address only: a queue alone has no emergency data',
    queueOnlyCaption: 'No address, queue only',
    addAddress: 'Add address',
    addQueueOnly: 'Or add a queue only',
    addressDuplicate: 'This address is already in the list',
    addressAdded: 'Address added',
    removeAddress: 'Remove',
    removeConfirmTitle: 'Remove this address?',
    renameAddress: 'Rename',
    renameHint: 'Empty — name from the address',
    save: 'Save',
    masterHint: 'Master switch for all addresses',
    noAddressAlerts: 'No address has alerts turned on',
    queueHelpSubtitle: '(Or close this window and select directly)',
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
    aboutDonations: 'Charity / Благодійність і Пожертви',
    aboutGithubProfile: 'My Main GitHub Profile',
    aboutRepoIssues: 'Report Issues & Requests (GitHub Issues)',
    aboutDesktopRepo: 'Світло в Житомирі на Github',
    aboutDisclaimer: 'This application uses public schedule information from ztoe.com.ua. Not an official affiliate of the utility company.',

    // Widget
    widgetPreviewTitle: 'Android Home Screen Widget (Glance)',
    widgetTapNotice: 'Tapping widget opens the app. Button toggles alerts on the spot.',
    widgetSize2x1: 'Compact 2x1',
    widgetSize3x2: 'Expanded 3x2 / 4x2',
    widgetSize4x1: 'Chart 4x1',
    widgetSizeAll: 'All three',
    widgetStripName: 'Світло в Житомирі (Графік)',
    widgetSmallName: 'Світло в Житомирі (Малий)',
    widgetBigName: 'Світло в Житомирі (Великий)',
    widgetMuteAlerts: 'Mute',
    widgetResumeAlerts: 'Resume',
    widgetNextIn: 'In',

    // Parser status
    liveSiteOnline: 'ztoe.com.ua website online',
    tableParsedSuccess: 'Schedule table parsed successfully',
    currentQueueHighlight: 'Highlighting queue',

    // v1.4.0 (mirrors the "v1.4.0" block of android/.../ui/AppStrings.kt)
    siteStateWithTable: 'ZTOE site online, schedule published',
    siteStateNoTable: 'ZTOE site online, but no schedule table',
    siteStateUnreachable: 'ZTOE site unreachable, your internet works',
    siteStateNoInternet: 'No internet connection',
    siteStateChecking: 'Checking the ZTOE site…',
    siteStateHintNoTable: 'The schedule is not published yet or the page has changed.',
    siteStateHintUnreachable: 'The app will retry on its own.',
    siteStateHintNoInternet: 'Check your internet connection.',
    tomorrowPublished: "Tomorrow's schedule: published",
    tomorrowNotPublishedShort: "Tomorrow's schedule: not yet",
    tomorrowNotPublished: "Tomorrow's schedule is not published on the site yet",
    poweronUnavailable: 'Emergency outages: data unavailable',
    kindPlanned: 'Planned',
    kindRepair: 'Planned works',
    kindEmergency: 'Emergency',
    rowFinished: 'finished',
    rowOverdue: 'restoration pending',
    rowMayContinue: 'may continue',
    tomorrowWord: 'tomorrow',
    yesterdayWord: 'yesterday',
    plannedAlertTitle: 'Heads-up: power outage',
    emergencyStartTitle: 'Emergency outage',
    emergencyUpcomingTitle: 'Emergency outage scheduled',
    emergencyChangedTitle: 'Restoration time changed',
    emergencyEndTitle: 'Emergency outage ended',
    exactAlarmTitle: 'Allow exact alerts',
    exactAlarmBody: 'To get warnings on time, turn on the "Alarms & reminders" permission for this app in the phone settings. Without it alerts can arrive late.',
    exactAlarmButton: 'Open settings',
    mainUtilityName: 'Житомиробленерго (ZTOE)',
    mainLangAuto: 'Auto',
    switchOn: 'On',
    switchOff: 'Off',
    drumTitle: 'Day timeline',
    drumNoOutages: 'no outages',
    drumEmergencyMark: 'emergency',

    // v1.4.0 main / widget / settings strings (same names as AppStrings.kt)
    tabSelected: 'Selected',
    widgetNoOutages: 'No outages',
    widgetNoMoreOutages: 'None more today',
    widgetTomorrowPrefix: 'Tomorrow',
    pickerSearchHint: 'Search',
    pickerNothingFound: 'Nothing found',
    pickerLoading: 'Loading…',
    pickerLoadError: 'Could not load the list',
    pickerRetry: 'Retry',
    pickerClearSearch: 'Clear search',
    pickerClose: 'Close',
    pickerSelected: 'Selected',
    pickerChooseFirst: 'Choose the previous field first',
    addrFindTitle: 'Find Queue by Address',
    addrRemLabel: 'District (РЕМ)',
    addrCityLabel: 'City / Settlement',
    addrStreetLabel: 'Street',
    addrHouseLabel: 'House Number',
    addrRemPlaceholder: 'Select district',
    addrCityPlaceholder: 'Select settlement',
    addrStreetPlaceholder: 'Select street',
    addrHousePlaceholder: 'Select house',
    addrHousePrefix: 'bldg.',
    addrChecking: 'Checking the address on the site…',
    addrCheckFailed: 'Could not check the address on the site. Showing saved data.',
    addrConfirm: 'Confirm selection',
    addrSaved: 'Address saved',
    noQueueNotDisconnected: 'No queue (not disconnected)',
    settingsReset: 'Settings reset',
    langSystem: 'System',
    notificationsHint: 'Schedule alerts: shortly before a planned outage starts',
    emergencyHint: 'Emergency alerts work separately from planned ones',
    soundVibrationHint: 'Sound and vibration apply to all alerts',
    advanceNoticeHint: 'For planned alerts',
    refreshFloorHint: 'Android checks at most once every 15 min',

    // v1.4.0 main / settings strings still missing (same names as AppStrings.kt)
    powerOn: 'POWER IS ON',
    powerOff: 'POWER IS OFF',
    powerUnclear: 'Unclear',
    powerOnIn: 'Power on in:',
    powerOffIn: 'Time until outage:',
    outagePeriod: 'Outage period:',
    nextPeriod: 'Next period:',
    blackoutHoursHeader: 'BLACKOUT HOURS FOR TODAY:',
    blackoutHoursForDayHeader: 'Blackout hours for today:',
    blackoutHoursForTomorrowHeader: 'Blackout hours for tomorrow:',
    selectQueueAction: 'Select queue',
    emergencyOutageTitle: 'Emergency outage!',
    emergencyStartLabel: 'Start:',
    emergencyRestoreLabel: 'Estimated restoration:',
    noBlackoutsScheduled: 'No blackouts scheduled',
    hourShort: 'h',
    minShort: 'min',
    nextUpdated: 'Next update:',
    refreshBtn: 'Refresh data',
    queueTitle: 'OUTAGE QUEUE',
    queueDesc: 'Select sub-queue for your address',
    siteAddressTitle: 'SITE ADDRESS',
    siteAddressDesc: 'Schedule URL, usually no change needed',
    siteReachable: '✓ Reachable',
    siteInvalid: '⚠ Invalid URL',
    advanceNoticeTitle: 'ADVANCE WARNING NOTICE',
    refreshIntervalTitle: 'SITE REFRESH INTERVAL',
    sound: 'Sound',
    vibration: 'Vibration',
    emergencyNotifications: 'Emergency outage notifications',
    languageTitle: 'INTERFACE LANGUAGE',
    testAlertBtn: 'Test notification',
    resetDefaultsBtn: 'Reset to defaults',
    resetConfirmTitle: 'Reset all settings?',
    resetConfirmDesc: 'All parameters will revert to defaults (queue unselected, timers 15/30 min).',
    resetYes: 'Reset',
    cancel: 'Cancel',
    queueHelpTitle: 'How to find your queue',
    queueHelpAddressSubtitle: '(Or close this window and select directly)',
    queueHelpManualSearchTitle: 'Manual search',
    queueHelpGotIt: 'Got it',
    foundQueue: 'Found Queue:',
    applyQueue: 'Apply Queue',
    pickerShowMore: 'Show more'
  }
};

// ---------------------------------------------------------------------------------------------
// v1.4.0 parametrised strings, mirrored from android/.../ui/AppStrings.kt (same names)
// ---------------------------------------------------------------------------------------------

type Lang = 'uk' | 'en';
const NBSP = ' ';

// Multi-address ("Мої адреси"), mirrored in AppStrings.kt
export const addressesCount = (lang: Lang, n: number, max: number): string => (lang === 'uk' ? `${n} з ${max}` : `${n} of ${max}`);
export const plannedDesc = (lang: Lang, min: number): string =>
  lang === 'uk' ? `За графіком, за ${min} хв до початку` : `Scheduled, ${min} min before start`;
export const addressesLeft = (lang: Lang, n: number): string => (lang === 'uk' ? `Можна додати ще: ${n}` : `You can add ${n} more`);
export const addressLimitReached = (lang: Lang, max: number): string =>
  lang === 'uk' ? `Досягнуто ліміт: ${max} адрес` : `Limit reached: ${max} addresses`;
export const removeConfirmBody = (lang: Lang, label: string): string =>
  lang === 'uk' ? `«${label}» зникне зі списку разом зі своїми сповіщеннями.` : `"${label}" and its alerts will be removed.`;

export const staleDataSince = (lang: Lang, hhmm: string): string =>
  lang === 'uk' ? `Показано збережений графік (дані за ${hhmm})` : `Showing the saved schedule (data from ${hhmm})`;
export const staleChip = (lang: Lang, hhmm: string): string => (lang === 'uk' ? `дані за ${hhmm}` : `data from ${hhmm}`);
export const rowFromEarlier = (lang: Lang, whenText: string): string => (lang === 'uk' ? `з ${whenText}` : `from ${whenText}`);
export const rowUntilLater = (lang: Lang, whenText: string): string => (lang === 'uk' ? `до ${whenText}` : `until ${whenText}`);
export const drumPowerOffAt = (lang: Lang, spans: string): string => (lang === 'uk' ? `без світла: ${spans}` : `no power: ${spans}`);

/** "2 год", "1 год 30 хв", "45 хв" with non-breaking spaces so a value never splits across lines. */
export function durationText(lang: Lang, totalMinutes: number): string {
  const m = Math.max(Math.trunc(totalMinutes), 0);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const hUnit = lang === 'uk' ? 'год' : 'h';
  const mUnit = lang === 'uk' ? 'хв' : 'min';
  if (h > 0 && mm > 0) return `${h}${NBSP}${hUnit} ${mm}${NBSP}${mUnit}`;
  if (h > 0) return `${h}${NBSP}${hUnit}`;
  return `${mm}${NBSP}${mUnit}`;
}

/** One planned pre-warning per merged span. */
export function plannedAlertBody(
  lang: Lang,
  queue: string,
  start: string,
  end: string,
  minutesLeft: number,
  durationMinutes: number,
  mayContinue: boolean
): string {
  const dur = durationText(lang, durationMinutes);
  const uk = lang === 'uk';
  const q = queue.trim() === '' ? '' : uk ? `Черга ${queue}: ` : `Queue ${queue}: `;
  let head: string;
  if (minutesLeft > 0) {
    head = uk ? `${q}відключення о ${start} (через ${minutesLeft}${NBSP}хв)` : `${q}outage at ${start} (in ${minutesLeft}${NBSP}min)`;
  } else {
    head = uk ? `${q}відключення розпочинається зараз, о ${start}` : `${q}outage is starting now, at ${start}`;
  }
  let tail: string;
  if (mayContinue) tail = uk ? `, орієнтовно до ${end} (${dur}), можливе продовження.` : `, expected until ${end} (${dur}), may continue.`;
  else tail = uk ? `, орієнтовно до ${end} (${dur}).` : `, expected until ${end} (${dur}).`;
  return head + tail;
}

export function emergencyStartBody(lang: Lang, start: string, eta: string | null): string {
  if (lang === 'uk') return eta !== null ? `Початок: ${start}. Орієнтовне відновлення: ${eta}.` : `Початок: ${start}. Час відновлення невідомий.`;
  return eta !== null ? `Start: ${start}. Estimated restoration: ${eta}.` : `Start: ${start}. Restoration time unknown.`;
}
export const emergencyChangedBody = (lang: Lang, eta: string): string =>
  lang === 'uk' ? `Нове орієнтовне відновлення: ${eta}.` : `New estimated restoration: ${eta}.`;
export const emergencyEndBody = (lang: Lang, start: string): string =>
  lang === 'uk'
    ? `Електропостачання за вашою адресою відновлено (початок був: ${start}).`
    : `Power supply at your address has been restored (started: ${start}).`;

/** END before the estimated restore (mirrors AppStrings.emergencyEarlyEndTitle/Body). */
export const emergencyEarlyEndTitle = (lang: Lang): string =>
  lang === 'uk' ? 'Аварійне відключення скасовано' : 'Emergency outage cancelled';
export const emergencyEarlyEndBody = (lang: Lang, eta: string): string =>
  lang === 'uk'
    ? `Відключення зникло зі списку до ${eta}: світло, імовірно, вже є.`
    : `The outage left the list before ${eta}: power is probably back.`;

/** "1–240 хв" with a non-breaking space before the unit. */
export const rangeMinutes = (lang: Lang, from: number, to: number): string => `${from}–${to}${NBSP}${lang === 'uk' ? 'хв' : 'min'}`;

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

/** Card that quotes the notice ztoe shows instead of the schedule table (mirrors AppStrings.siteNoticeTitle / siteNoticeA11y). */
export const siteNoticeTitle = (lang: Lang): string =>
  lang === 'uk' ? 'Повідомлення з сайту ztoe.com.ua' : 'Notice from ztoe.com.ua';
export const siteNoticeA11y = (lang: Lang): string =>
  lang === 'uk' ? 'Повідомлення Житомиробленерго' : 'Zhytomyroblenergo notice';
