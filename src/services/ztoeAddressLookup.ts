/**
 * ZTOE (Zhytomyroblenergo) Outage Queue Address Lookup Service
 * Supports parsing HTML tables from https://www.ztoe.com.ua/unhooking-search.php
 * (REM -> City/Settlement -> Street -> House Number -> Queue/Subqueue or custom status text)
 * with built-in Zhytomyr Oblast directory fallback when offline or CORS-restricted.
 */

import { EmergencyOutageInfo, SelectedAddressQuery } from '../types';
import { getKyivDateParts } from './ztoeParser';

export function getKyivska37DemoEmergencyOutage(baseDate: Date = new Date()): EmergencyOutageInfo {
  const todayParts = getKyivDateParts(baseDate);
  const todayDdMmYyyy = `${String(todayParts.day).padStart(2, '0')}.${String(todayParts.month).padStart(2, '0')}.${todayParts.year}`;
  return {
    id: 'pw_accident_391476673',
    outageType: 'Аварійне відключення',
    startTime: `${todayDdMmYyyy} 22:00`,
    estimatedRestoreTime: `${todayDdMmYyyy} 23:59`,
  };
}

export const ZTOE_FULL_NO_OUTAGE_MESSAGE =
  'В цей час не вимикається, за винятком випадків аварійних відключень';

export interface ZtoeRemOption {
  id: string;
  ztoeRemId?: string;
  ztoeOtgId?: string;
  nameUk: string;
  nameEn: string;
}

export interface ZtoeSettlementOption {
  id: string;
  remId: string;
  ztoeNaspunktId?: string;
  poweronCityId?: string;
  nameUk: string;
  nameEn: string;
}

export interface ZtoeStreetOption {
  id: string;
  settlementId: string;
  ztoeVulicaId?: string;
  poweronStreetId?: string;
  nameUk: string;
  nameEn: string;
}

export interface ZtoeHouseLookupResult {
  house: string;
  queue: string; // e.g. "5.2", "1.1", or "" when ZTOE table has a message instead of queue/subqueue
  rawQueueCell?: string;
  rawSubqueueCell?: string;
  /**
   * Optional descriptive text found in the ZTOE table queue/subqueue columns
   * (e.g., "В цей час не вимикається, за винятком випадків аварійних відключень")
   */
  statusText?: string;
  /**
   * Active emergency outage ("Аварійне відключення") for this house, if detected on ZTOE
   */
  emergencyOutage?: EmergencyOutageInfo | null;
}

export type ZtoeHouseQueueRecord = ZtoeHouseLookupResult;

export const ZTOE_REM_OPTIONS: ZtoeRemOption[] = [
  { id: 'zhytomyr', ztoeRemId: '7', ztoeOtgId: '6', nameUk: 'Житомирський РЕМ', nameEn: 'Zhytomyr REM' },
  { id: 'berdychiv', ztoeRemId: '3', ztoeOtgId: '3', nameUk: 'Бердичівський РЕМ', nameEn: 'Berdychiv REM' },
  { id: 'korosten', ztoeRemId: '9', ztoeOtgId: '7', nameUk: 'Коростенський РЕМ', nameEn: 'Korosten REM' },
  { id: 'zviahel', ztoeRemId: '16', ztoeOtgId: '11', nameUk: 'Звягельський РЕМ', nameEn: 'Zviahel REM' },
  { id: 'malyn', ztoeRemId: '14', ztoeOtgId: '10', nameUk: 'Малинський РЕМ', nameEn: 'Malyn REM' },
  { id: 'radomyshl', ztoeRemId: '20', ztoeOtgId: '15', nameUk: 'Радомишльський РЕМ', nameEn: 'Radomyshl REM' },
  { id: 'andrushivka', ztoeRemId: '1', ztoeOtgId: '1', nameUk: 'Андрушівський РЕМ', nameEn: 'Andrushivka REM' },
  { id: 'baranivka', ztoeRemId: '2', ztoeOtgId: '2', nameUk: 'Баранівський РЕМ', nameEn: 'Baranivka REM' },
  { id: 'brusyliv', ztoeRemId: '4', ztoeOtgId: '4', nameUk: 'Брусилівський РЕМ', nameEn: 'Brusyliv REM' },
  { id: 'korostyshiv', ztoeRemId: '11', ztoeOtgId: '8', nameUk: 'Коростишівський РЕМ', nameEn: 'Korostyshiv REM' },
  { id: 'liubar', ztoeRemId: '13', ztoeOtgId: '9', nameUk: 'Любарський РЕМ', nameEn: 'Liubar REM' },
  { id: 'ovruch', ztoeRemId: '17', ztoeOtgId: '12', nameUk: 'Овруцький РЕМ', nameEn: 'Ovruch REM' },
  { id: 'olevsk', ztoeRemId: '18', ztoeOtgId: '13', nameUk: 'Олевський РЕМ', nameEn: 'Olevsk REM' },
  { id: 'popilnia', ztoeRemId: '19', ztoeOtgId: '14', nameUk: 'Попільнянський РЕМ', nameEn: 'Popilnia REM' },
  { id: 'pulyny', ztoeRemId: '23', ztoeOtgId: '17', nameUk: 'Пулинський РЕМ', nameEn: 'Pulyny REM' },
  { id: 'romaniv', ztoeRemId: '21', ztoeOtgId: '16', nameUk: 'Романівський РЕМ', nameEn: 'Romaniv REM' },
  { id: 'khoroshiv', ztoeRemId: '5', ztoeOtgId: '5', nameUk: 'Хорошівський РЕМ', nameEn: 'Khoroshiv REM' },
  { id: 'cherniakhiv', ztoeRemId: '24', ztoeOtgId: '18', nameUk: 'Черняхівський РЕМ', nameEn: 'Cherniakhiv REM' },
  { id: 'chudniv', ztoeRemId: '25', ztoeOtgId: '19', nameUk: 'Чуднівський РЕМ', nameEn: 'Chudniv REM' },
];

export const ZTOE_SETTLEMENT_OPTIONS: ZtoeSettlementOption[] = [
  { id: 'zt_city', remId: 'zhytomyr', ztoeNaspunktId: '16657', poweronCityId: '333', nameUk: 'м. Житомир', nameEn: 'Zhytomyr' },
  { id: 'zt_zarichany', remId: 'zhytomyr', ztoeNaspunktId: '16670', nameUk: 'с. Зарічани', nameEn: 'Zarichany' },
  { id: 'zt_stanyshivka', remId: 'zhytomyr', ztoeNaspunktId: '16680', nameUk: 'с. Станишівка', nameEn: 'Stanyshivka' },
  { id: 'zt_hlybochytsia', remId: 'zhytomyr', ztoeNaspunktId: '16667', nameUk: 'с. Глибочиця', nameEn: 'Hlybochytsia' },
  { id: 'bd_city', remId: 'berdychiv', ztoeNaspunktId: '16758', nameUk: 'м. Бердичів', nameEn: 'Berdychiv' },
  { id: 'kr_city', remId: 'korosten', ztoeNaspunktId: '17062', nameUk: 'м. Коростень', nameEn: 'Korosten' },
  { id: 'zv_city', remId: 'zviahel', ztoeNaspunktId: '16823', nameUk: 'м. Звягель', nameEn: 'Zviahel' },
  { id: 'ml_city', remId: 'malyn', ztoeNaspunktId: '17634', nameUk: 'м. Малин', nameEn: 'Malyn' },
  { id: 'rd_city', remId: 'radomyshl', ztoeNaspunktId: '17899', nameUk: 'м. Радомишль', nameEn: 'Radomyshl' },
  { id: 'an_city', remId: 'andrushivka', ztoeNaspunktId: '17694', nameUk: 'м. Андрушівка', nameEn: 'Andrushivka' },
  { id: 'br_city', remId: 'baranivka', ztoeNaspunktId: '15417', nameUk: 'м. Баранівка', nameEn: 'Baranivka' },
  { id: 'bs_city', remId: 'brusyliv', ztoeNaspunktId: '16202', nameUk: 'смт Брусилів', nameEn: 'Brusyliv' },
  { id: 'ks_city', remId: 'korostyshiv', ztoeNaspunktId: '15747', nameUk: 'м. Коростишів', nameEn: 'Korostyshiv' },
  { id: 'lb_city', remId: 'liubar', ztoeNaspunktId: '17742', nameUk: 'смт Любар', nameEn: 'Liubar' },
  { id: 'ov_city', remId: 'ovruch', ztoeNaspunktId: '17197', nameUk: 'м. Овруч', nameEn: 'Ovruch' },
  { id: 'ol_city', remId: 'olevsk', ztoeNaspunktId: '17823', nameUk: 'м. Олевськ', nameEn: 'Olevsk' },
  { id: 'pp_city', remId: 'popilnia', ztoeNaspunktId: '17555', nameUk: 'смт Попільня', nameEn: 'Popilnia' },
  { id: 'pl_city', remId: 'pulyny', ztoeNaspunktId: '16602', nameUk: 'смт Пулини', nameEn: 'Pulyny' },
  { id: 'rm_city', remId: 'romaniv', ztoeNaspunktId: '17968', nameUk: 'смт Романів', nameEn: 'Romaniv' },
  { id: 'kh_city', remId: 'khoroshiv', ztoeNaspunktId: '16281', nameUk: 'смт Хорошів', nameEn: 'Khoroshiv' },
  { id: 'ch_city', remId: 'cherniakhiv', ztoeNaspunktId: '16063', nameUk: 'смт Черняхів', nameEn: 'Cherniakhiv' },
  { id: 'cd_city', remId: 'chudniv', ztoeNaspunktId: '18001', nameUk: 'м. Чуднів', nameEn: 'Chudniv' },
];

export const ZTOE_STREET_OPTIONS: ZtoeStreetOption[] = [
  // м. Житомир
  { id: 'zt_kyivska', settlementId: 'zt_city', ztoeVulicaId: '173934', poweronStreetId: '4757', nameUk: 'вул. Київська', nameEn: 'Kyivska St.' },
  { id: 'zt_berdy', settlementId: 'zt_city', ztoeVulicaId: '174574', poweronStreetId: '4550', nameUk: 'вул. Велика Бердичівська', nameEn: 'Velyka Berdychivska St.' },
  { id: 'zt_peremohy', settlementId: 'zt_city', ztoeVulicaId: '173948', poweronStreetId: '4552', nameUk: 'вул. Перемоги', nameEn: 'Peremohy St.' },
  { id: 'zt_pokrovska', settlementId: 'zt_city', ztoeVulicaId: '173949', poweronStreetId: '4789', nameUk: 'вул. Покровська', nameEn: 'Pokrovska St.' },
  { id: 'zt_lesi', settlementId: 'zt_city', ztoeVulicaId: '173937', poweronStreetId: '4788', nameUk: 'вул. Лесі Українки', nameEn: 'Lesi Ukrainky St.' },
  { id: 'zt_chudnivska', settlementId: 'zt_city', ztoeVulicaId: '174543', poweronStreetId: '4645', nameUk: 'вул. Чуднівська', nameEn: 'Chudnivska St.' },
  { id: 'zt_mykhailivska', settlementId: 'zt_city', ztoeVulicaId: '174152', poweronStreetId: '33622', nameUk: 'вул. Михайлівська', nameEn: 'Mykhailivska St.' },
  { id: 'st_173952', settlementId: 'zt_city', ztoeVulicaId: '173952', poweronStreetId: '33488', nameUk: 'вул. Степана Бандери', nameEn: 'Stepana Bandery St.' },
  // с. Зарічани
  { id: 'zr_lisova', settlementId: 'zt_zarichany', ztoeVulicaId: '175050', nameUk: 'вул. Лісова', nameEn: 'Lisova St.' },
  { id: 'zr_berdy', settlementId: 'zt_zarichany', ztoeVulicaId: '175051', nameUk: 'вул. Бердичівське шосе', nameEn: 'Berdychivske Hwy' },
  // с. Станишівка
  { id: 'st_tsentralna', settlementId: 'zt_stanyshivka', ztoeVulicaId: '175250', nameUk: 'вул. Центральна', nameEn: 'Tsentralna St.' },
  // с. Глибочиця
  { id: 'hl_kyivska', settlementId: 'zt_hlybochytsia', ztoeVulicaId: '174900', nameUk: 'вул. Київська', nameEn: 'Kyivska St.' },
  // м. Бердичів
  { id: 'bd_ievropeiska', settlementId: 'bd_city', ztoeVulicaId: '175500', nameUk: 'вул. Європейська', nameEn: 'Yevropeiska St.' },
  { id: 'bd_zhytomyrska', settlementId: 'bd_city', ztoeVulicaId: '175501', nameUk: 'вул. Житомирська', nameEn: 'Zhytomyrska St.' },
  // м. Коростень
  { id: 'kr_hrushevskoho', settlementId: 'kr_city', ztoeVulicaId: '177000', nameUk: 'вул. Грушевського', nameEn: 'Hrushevskoho St.' },
  // м. Звягель
  { id: 'zv_shevchenka', settlementId: 'zv_city', ztoeVulicaId: '176000', nameUk: 'вул. Шевченка', nameEn: 'Shevchenka St.' },
  // м. Малин
  { id: 'ml_soborna', settlementId: 'ml_city', ztoeVulicaId: '179000', nameUk: 'вул. Соборна', nameEn: 'Soborna St.' },
  // м. Радомишль
  { id: 'rd_velyka', settlementId: 'rd_city', ztoeVulicaId: '180000', nameUk: 'вул. Велика Житомирська', nameEn: 'Velyka Zhytomyrska St.' },
  // Other REMs
  { id: 'an_tsentralna', settlementId: 'an_city', ztoeVulicaId: '170100', nameUk: 'вул. Центральна', nameEn: 'Tsentralna St.' },
  { id: 'br_soborna', settlementId: 'br_city', ztoeVulicaId: '170200', nameUk: 'вул. Соборна', nameEn: 'Soborna St.' },
  { id: 'bs_myru', settlementId: 'bs_city', ztoeVulicaId: '170300', nameUk: 'вул. Миру', nameEn: 'Myru St.' },
  { id: 'ks_kyivska', settlementId: 'ks_city', ztoeVulicaId: '170400', nameUk: 'вул. Київська', nameEn: 'Kyivska St.' },
  { id: 'lb_nezalezhnosti', settlementId: 'lb_city', ztoeVulicaId: '170500', nameUk: 'вул. Незалежності', nameEn: 'Nezalezhnosti St.' },
  { id: 'ov_tarasa', settlementId: 'ov_city', ztoeVulicaId: '170600', nameUk: 'вул. Тараса Шевченка', nameEn: 'Tarasa Shevchenka St.' },
  { id: 'ol_svobody', settlementId: 'ol_city', ztoeVulicaId: '170700', nameUk: 'вул. Свято-Миколаївська', nameEn: 'Sviato-Mykolaivska St.' },
  { id: 'pp_bohdana', settlementId: 'pp_city', ztoeVulicaId: '170800', nameUk: 'вул. Богдана Хмельницького', nameEn: 'Bohdana Khmelnytskoho St.' },
  { id: 'pl_shevchenka', settlementId: 'pl_city', ztoeVulicaId: '170900', nameUk: 'вул. Шевченка', nameEn: 'Shevchenka St.' },
  { id: 'rm_nebesnoi', settlementId: 'rm_city', ztoeVulicaId: '171000', nameUk: 'вул. Небесної Сотні', nameEn: 'Nebesnoi Sotni St.' },
  { id: 'kh_nezalezhnosti', settlementId: 'kh_city', ztoeVulicaId: '171100', nameUk: 'вул. Незалежності', nameEn: 'Nezalezhnosti St.' },
  { id: 'ch_koroliova', settlementId: 'ch_city', ztoeVulicaId: '171200', nameUk: 'вул. Корольова', nameEn: 'Koroliova St.' },
  { id: 'cd_soborna', settlementId: 'cd_city', ztoeVulicaId: '171300', nameUk: 'вул. Соборна', nameEn: 'Soborna St.' },
];

export const ZTOE_STREET_HOUSES: Record<string, ZtoeHouseLookupResult[]> = {
  zt_kyivska: [
    { house: '1', queue: '1.1', rawQueueCell: '1', rawSubqueueCell: '1' },
    { house: '10', queue: '1.2', rawQueueCell: '1', rawSubqueueCell: '2' },
    { house: '25', queue: '2.1', rawQueueCell: '2', rawSubqueueCell: '1' },
    {
      house: '37',
      queue: '2.2',
      rawQueueCell: '2',
      rawSubqueueCell: '2',
      emergencyOutage: getKyivska37DemoEmergencyOutage(),
    },
    { house: '47', queue: '3.2', rawQueueCell: '3', rawSubqueueCell: '2' },
    {
      house: '74',
      queue: '',
      rawQueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      rawSubqueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      statusText: ZTOE_FULL_NO_OUTAGE_MESSAGE,
    },
    { house: '77', queue: '5.2', rawQueueCell: '5', rawSubqueueCell: '2' },
    {
      house: '104',
      queue: '',
      rawQueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      rawSubqueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      statusText: ZTOE_FULL_NO_OUTAGE_MESSAGE,
    },
    {
      house: '106',
      queue: '',
      rawQueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      rawSubqueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      statusText: ZTOE_FULL_NO_OUTAGE_MESSAGE,
    },
  ],
  zt_berdy: [
    { house: '6', queue: '2.1', rawQueueCell: '2', rawSubqueueCell: '1' },
    { house: '8', queue: '2.1', rawQueueCell: '2', rawSubqueueCell: '1' },
    { house: '10', queue: '2.1', rawQueueCell: '2', rawSubqueueCell: '1' },
    { house: '12', queue: '2.1', rawQueueCell: '2', rawSubqueueCell: '1' },
    { house: '15', queue: '2.2', rawQueueCell: '2', rawSubqueueCell: '2' },
    {
      house: '22',
      queue: '',
      rawQueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      rawSubqueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      statusText: ZTOE_FULL_NO_OUTAGE_MESSAGE,
    },
    { house: '32', queue: '4.1', rawQueueCell: '4', rawSubqueueCell: '1' },
    { house: '67', queue: '5.1', rawQueueCell: '5', rawSubqueueCell: '1' },
    {
      house: '70',
      queue: '',
      rawQueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      rawSubqueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      statusText: ZTOE_FULL_NO_OUTAGE_MESSAGE,
    },
  ],
  zt_peremohy: [
    { house: '2', queue: '1.2', rawQueueCell: '1', rawSubqueueCell: '2' },
    { house: '12', queue: '3.1', rawQueueCell: '3', rawSubqueueCell: '1' },
    { house: '54', queue: '5.2', rawQueueCell: '5', rawSubqueueCell: '2' },
    { house: '99', queue: '6.1', rawQueueCell: '6', rawSubqueueCell: '1' },
    {
      house: '105',
      queue: '',
      rawQueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      rawSubqueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      statusText: ZTOE_FULL_NO_OUTAGE_MESSAGE,
    },
  ],
  zt_pokrovska: [
    { house: '4', queue: '2.2', rawQueueCell: '2', rawSubqueueCell: '2' },
    { house: '115', queue: '6.2', rawQueueCell: '6', rawSubqueueCell: '2' },
    {
      house: '120',
      queue: '',
      rawQueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      rawSubqueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      statusText: ZTOE_FULL_NO_OUTAGE_MESSAGE,
    },
  ],
  zt_lesi: [
    { house: '5', queue: '1.1', rawQueueCell: '1', rawSubqueueCell: '1' },
    { house: '14', queue: '3.2', rawQueueCell: '3', rawSubqueueCell: '2' },
    { house: '42', queue: '5.2', rawQueueCell: '5', rawSubqueueCell: '2' },
    {
      house: '50',
      queue: '',
      rawQueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      rawSubqueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      statusText: ZTOE_FULL_NO_OUTAGE_MESSAGE,
    },
  ],
  zt_chudnivska: [
    { house: '92', queue: '4.1', rawQueueCell: '4', rawSubqueueCell: '1' },
    { house: '106', queue: '4.2', rawQueueCell: '4', rawSubqueueCell: '2' },
    { house: '129', queue: '6.1', rawQueueCell: '6', rawSubqueueCell: '1' },
    {
      house: '135',
      queue: '',
      rawQueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      rawSubqueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      statusText: ZTOE_FULL_NO_OUTAGE_MESSAGE,
    },
  ],
  zt_mykhailivska: [
    { house: '1', queue: '1.1', rawQueueCell: '1', rawSubqueueCell: '1' },
    { house: '8', queue: '2.1', rawQueueCell: '2', rawSubqueueCell: '1' },
    {
      house: '15',
      queue: '',
      rawQueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      rawSubqueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      statusText: ZTOE_FULL_NO_OUTAGE_MESSAGE,
    },
  ],
  st_173952: [
    { house: '2', queue: '1.2', rawQueueCell: '1', rawSubqueueCell: '2' },
    { house: '3', queue: '1.2', rawQueueCell: '1', rawSubqueueCell: '2' },
    { house: '4', queue: '1.2', rawQueueCell: '1', rawSubqueueCell: '2' },
    { house: '4А', queue: '1.2', rawQueueCell: '1', rawSubqueueCell: '2' },
    { house: '5', queue: '4.1', rawQueueCell: '4', rawSubqueueCell: '1' },
    { house: '6', queue: '1.2', rawQueueCell: '1', rawSubqueueCell: '2' },
    { house: '7', queue: '4.1', rawQueueCell: '4', rawSubqueueCell: '1' },
    { house: '8', queue: '4.1', rawQueueCell: '4', rawSubqueueCell: '1' },
    { house: '9', queue: '4.1', rawQueueCell: '4', rawSubqueueCell: '1' },
    { house: '10', queue: '1.2', rawQueueCell: '1', rawSubqueueCell: '2' },
    { house: '10А', queue: '4.1', rawQueueCell: '4', rawSubqueueCell: '1' },
    { house: '11', queue: '4.1', rawQueueCell: '4', rawSubqueueCell: '1' },
    { house: '12', queue: '4.1', rawQueueCell: '4', rawSubqueueCell: '1' },
    { house: '13', queue: '4.1', rawQueueCell: '4', rawSubqueueCell: '1' },
    { house: '14', queue: '4.1', rawQueueCell: '4', rawSubqueueCell: '1' },
    { house: '15', queue: '4.1', rawQueueCell: '4', rawSubqueueCell: '1' },
    { house: '16', queue: '4.1', rawQueueCell: '4', rawSubqueueCell: '1' },
    { house: '16/63', queue: '4.1', rawQueueCell: '4', rawSubqueueCell: '1' },
    { house: '16а', queue: '4.1', rawQueueCell: '4', rawSubqueueCell: '1' },
    { house: '18', queue: '1.2', rawQueueCell: '1', rawSubqueueCell: '2' },
    { house: '32', queue: '1.2', rawQueueCell: '1', rawSubqueueCell: '2' },
  ],
  zr_lisova: [
    { house: '3', queue: '3.1', rawQueueCell: '3', rawSubqueueCell: '1' },
    { house: '18', queue: '5.2', rawQueueCell: '5', rawSubqueueCell: '2' },
    {
      house: '25',
      queue: '',
      rawQueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      rawSubqueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      statusText: ZTOE_FULL_NO_OUTAGE_MESSAGE,
    },
  ],
  zr_berdy: [
    { house: '5', queue: '2.2', rawQueueCell: '2', rawSubqueueCell: '2' },
    { house: '11', queue: '4.1', rawQueueCell: '4', rawSubqueueCell: '1' },
    {
      house: '19',
      queue: '',
      rawQueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      rawSubqueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      statusText: ZTOE_FULL_NO_OUTAGE_MESSAGE,
    },
  ],
  st_tsentralna: [
    { house: '1', queue: '3.2', rawQueueCell: '3', rawSubqueueCell: '2' },
    { house: '24', queue: '6.1', rawQueueCell: '6', rawSubqueueCell: '1' },
    {
      house: '30',
      queue: '',
      rawQueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      rawSubqueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      statusText: ZTOE_FULL_NO_OUTAGE_MESSAGE,
    },
  ],
  hl_kyivska: [
    { house: '7', queue: '1.2', rawQueueCell: '1', rawSubqueueCell: '2' },
    { house: '19', queue: '5.1', rawQueueCell: '5', rawSubqueueCell: '1' },
    {
      house: '27',
      queue: '',
      rawQueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      rawSubqueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      statusText: ZTOE_FULL_NO_OUTAGE_MESSAGE,
    },
  ],
  bd_ievropeiska: [
    { house: '10', queue: '2.1', rawQueueCell: '2', rawSubqueueCell: '1' },
    { house: '45', queue: '5.2', rawQueueCell: '5', rawSubqueueCell: '2' },
    {
      house: '52',
      queue: '',
      rawQueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      rawSubqueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      statusText: ZTOE_FULL_NO_OUTAGE_MESSAGE,
    },
  ],
  bd_zhytomyrska: [
    { house: '14', queue: '3.1', rawQueueCell: '3', rawSubqueueCell: '1' },
    { house: '80', queue: '6.2', rawQueueCell: '6', rawSubqueueCell: '2' },
    {
      house: '88',
      queue: '',
      rawQueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      rawSubqueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      statusText: ZTOE_FULL_NO_OUTAGE_MESSAGE,
    },
  ],
  kr_hrushevskoho: [
    { house: '9', queue: '1.1', rawQueueCell: '1', rawSubqueueCell: '1' },
    { house: '22', queue: '4.2', rawQueueCell: '4', rawSubqueueCell: '2' },
    {
      house: '35',
      queue: '',
      rawQueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      rawSubqueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      statusText: ZTOE_FULL_NO_OUTAGE_MESSAGE,
    },
  ],
  zv_shevchenka: [
    { house: '5', queue: '2.2', rawQueueCell: '2', rawSubqueueCell: '2' },
    { house: '31', queue: '5.1', rawQueueCell: '5', rawSubqueueCell: '1' },
    {
      house: '44',
      queue: '',
      rawQueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      rawSubqueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      statusText: ZTOE_FULL_NO_OUTAGE_MESSAGE,
    },
  ],
  ml_soborna: [
    { house: '4', queue: '3.2', rawQueueCell: '3', rawSubqueueCell: '2' },
    { house: '17', queue: '6.1', rawQueueCell: '6', rawSubqueueCell: '1' },
    {
      house: '29',
      queue: '',
      rawQueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      rawSubqueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      statusText: ZTOE_FULL_NO_OUTAGE_MESSAGE,
    },
  ],
  rd_velyka: [
    { house: '12', queue: '1.2', rawQueueCell: '1', rawSubqueueCell: '2' },
    { house: '38', queue: '4.1', rawQueueCell: '4', rawSubqueueCell: '1' },
    {
      house: '46',
      queue: '',
      rawQueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      rawSubqueueCell: ZTOE_FULL_NO_OUTAGE_MESSAGE,
      statusText: ZTOE_FULL_NO_OUTAGE_MESSAGE,
    },
  ],
  an_tsentralna: [
    { house: '1', queue: '1.1', rawQueueCell: '1', rawSubqueueCell: '1' },
    { house: '15', queue: '3.2', rawQueueCell: '3', rawSubqueueCell: '2' },
  ],
  br_soborna: [
    { house: '2', queue: '2.1', rawQueueCell: '2', rawSubqueueCell: '1' },
    { house: '20', queue: '4.2', rawQueueCell: '4', rawSubqueueCell: '2' },
  ],
  bs_myru: [
    { house: '5', queue: '1.2', rawQueueCell: '1', rawSubqueueCell: '2' },
    { house: '18', queue: '5.1', rawQueueCell: '5', rawSubqueueCell: '1' },
  ],
  ks_kyivska: [
    { house: '3', queue: '2.2', rawQueueCell: '2', rawSubqueueCell: '2' },
    { house: '24', queue: '6.1', rawQueueCell: '6', rawSubqueueCell: '1' },
  ],
  lb_nezalezhnosti: [
    { house: '7', queue: '3.1', rawQueueCell: '3', rawSubqueueCell: '1' },
    { house: '30', queue: '5.2', rawQueueCell: '5', rawSubqueueCell: '2' },
  ],
  ov_tarasa: [
    { house: '4', queue: '1.1', rawQueueCell: '1', rawSubqueueCell: '1' },
    { house: '19', queue: '4.1', rawQueueCell: '4', rawSubqueueCell: '1' },
  ],
  ol_svobody: [
    { house: '8', queue: '2.1', rawQueueCell: '2', rawSubqueueCell: '1' },
    { house: '22', queue: '6.2', rawQueueCell: '6', rawSubqueueCell: '2' },
  ],
  pp_bohdana: [
    { house: '6', queue: '3.2', rawQueueCell: '3', rawSubqueueCell: '2' },
    { house: '14', queue: '5.1', rawQueueCell: '5', rawSubqueueCell: '1' },
  ],
  pl_shevchenka: [
    { house: '10', queue: '1.2', rawQueueCell: '1', rawSubqueueCell: '2' },
    { house: '25', queue: '4.2', rawQueueCell: '4', rawSubqueueCell: '2' },
  ],
  rm_nebesnoi: [
    { house: '1', queue: '2.2', rawQueueCell: '2', rawSubqueueCell: '2' },
    { house: '16', queue: '5.2', rawQueueCell: '5', rawSubqueueCell: '2' },
  ],
  kh_nezalezhnosti: [
    { house: '9', queue: '3.1', rawQueueCell: '3', rawSubqueueCell: '1' },
    { house: '21', queue: '6.1', rawQueueCell: '6', rawSubqueueCell: '1' },
  ],
  ch_koroliova: [
    { house: '5', queue: '1.1', rawQueueCell: '1', rawSubqueueCell: '1' },
    { house: '17', queue: '4.1', rawQueueCell: '4', rawSubqueueCell: '1' },
  ],
  cd_soborna: [
    { house: '3', queue: '2.1', rawQueueCell: '2', rawSubqueueCell: '1' },
    { house: '28', queue: '5.2', rawQueueCell: '5', rawSubqueueCell: '2' },
  ],
};

/**
 * Decodes HTML entities and apostrophe character references (`&amp;#039;`, `&#039;`, `&#39;`,
 * `&#x27;`, `&apos;`, `&rsquo;`, `&lsquo;`, `&#8217;`, `&#146;`) into standard characters (`'`).
 * Unescapes `&amp;` first so double-escaped entities like `&amp;#039;` are properly resolved.
 */
export function decodeHtmlEntities(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/&amp;/gi, '&')
    .replace(/&#0*39;|&#x0*27;|&apos;|&#8217;|&#0*146;|&rsquo;|&lsquo;/gi, "'")
    .replace(/&quot;|&#0*34;/gi, '"')
    .replace(/&nbsp;|&#0*160;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

export const decodeZtoeHtmlEntities = decodeHtmlEntities;

function stripHtmlTags(raw: string): string {
  return decodeHtmlEntities(raw.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

const VALID_TIMESTAMP_REGEX = /^(\d{2}\.\d{2}(?:\.\d{2,4})?\s+)?\d{1,2}:\d{2}$/;

export function isValidOutageTimestamp(value: string | undefined | null): boolean {
  if (!value || typeof value !== 'string') return false;
  return VALID_TIMESTAMP_REGEX.test(value.trim());
}

export function isValidEmergencyOutage(
  info: EmergencyOutageInfo | null | undefined
): info is EmergencyOutageInfo {
  if (!info || typeof info !== 'object') return false;
  if (!isValidOutageTimestamp(info.startTime) || !isValidOutageTimestamp(info.estimatedRestoreTime)) {
    return false;
  }
  const combined = `${info.outageType || ''} ${info.startTime} ${info.estimatedRestoreTime}`.toLowerCase();
  if (combined.includes('не вимикається') || combined.includes('за винятком')) {
    return false;
  }
  return true;
}

/**
 * Parses an HTML address lookup table from https://www.ztoe.com.ua/unhooking-search.php
 * Supports both 3-column (Будинок | Черга | Підчерга or Черга | Підчерга | Будинки) and 7-column
 * (РЕМ | Населений пункт | Назва вулиці, провулка, тощо | Будинки | Черга | Підчерга | Примітка) ZTOE tables.
 * If the ZTOE table has a message instead of queue/subqueue, queue is set to "" (no queue)
 * and the full unshortened message is returned in statusText.
 */
export function parseZtoeAddressLookupTableHtml(
  html: string,
  targetStreetName?: string
): ZtoeHouseLookupResult[] {
  const results: ZtoeHouseLookupResult[] = [];
  if (!html) return results;

  // Exclude the 48-column schedule tables ("Графіки погодинних відключень") at the bottom of unhooking-search.php
  const scheduleSectionIdx = html.indexOf('Графіки погодинних відключень');
  const addressSectionHtml = scheduleSectionIdx >= 0 ? html.slice(0, scheduleSectionIdx) : html;

  const trRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;

  let streetColIdx = -1;
  let houseColIdx = 0;
  let queueColIdx = 1;
  let subqueueColIdx = 2;
  let noteColIdx = -1;
  const metadataCols = new Set<number>();
  const targetStreetNorm = targetStreetName ? normalizeStreetName(targetStreetName) : '';

  while ((trMatch = trRegex.exec(addressSectionHtml)) !== null) {
    const rowHtml = trMatch[1];
    if (/<input\b/i.test(rowHtml) || /<select\b/i.test(rowHtml)) continue;

    const cellRegex = /<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      cells.push(stripHtmlTags(cellMatch[1]));
    }

    if (cells.length < 2) continue;

    const firstCellLower = (cells[0] || '').toLowerCase();
    const isHeaderRow =
      /<th\b/i.test(rowHtml) ||
      firstCellLower === 'будинок' ||
      firstCellLower === 'будинки' ||
      firstCellLower === 'адреса' ||
      firstCellLower === 'рем' ||
      firstCellLower === 'черга' ||
      firstCellLower.includes('вулиц');

    if (isHeaderRow) {
      metadataCols.clear();
      streetColIdx = -1;
      noteColIdx = -1;
      cells.forEach((c, idx) => {
        const cl = c.toLowerCase();
        if (cl.includes('вулиц')) {
          streetColIdx = idx;
          metadataCols.add(idx);
        } else if (cl.includes('буд') || cl.includes('дом') || cl.includes('адрес')) {
          houseColIdx = idx;
        } else if (cl.includes('підчерг')) {
          subqueueColIdx = idx;
        } else if (cl.includes('черг')) {
          queueColIdx = idx;
        } else if (cl.includes('примітк')) {
          noteColIdx = idx;
          metadataCols.add(idx);
        } else if (cl === 'рем' || cl.includes('населений')) {
          metadataCols.add(idx);
        }
      });
      continue;
    }

    if (targetStreetNorm && streetColIdx >= 0 && cells[streetColIdx]) {
      if (normalizeStreetName(cells[streetColIdx]) !== targetStreetNorm) {
        continue;
      }
    }

    const houseVal = cells[houseColIdx] || cells[0] || '';
    const queueRaw = cells[queueColIdx] ?? cells[1] ?? '';
    const subqueueRaw = cells[subqueueColIdx] ?? cells[2] ?? '';

    if (!houseVal) continue;

    const combinedMatch = `${queueRaw}.${subqueueRaw}`.match(/^([1-6])\.([1-2])$/);
    const directMatch = queueRaw.match(/^([1-6])\.([1-2])$/);

    let normalizedQueue = '';
    let statusText: string | undefined;

    if (directMatch) {
      normalizedQueue = `${directMatch[1]}.${directMatch[2]}`;
    } else if (combinedMatch) {
      normalizedQueue = `${combinedMatch[1]}.${combinedMatch[2]}`;
    }

    const uniqueNonNumericParts: string[] = [];
    cells.forEach((cellVal, idx) => {
      if (idx === houseColIdx || metadataCols.has(idx) || idx === noteColIdx) return;
      const trimmed = cellVal.trim();
      if (trimmed.length > 0 && !/^[1-6](\.[1-2])?$/.test(trimmed) && trimmed !== '-') {
        if (!uniqueNonNumericParts.includes(trimmed)) {
          uniqueNonNumericParts.push(trimmed);
        }
      }
    });

    if (uniqueNonNumericParts.length > 0) {
      statusText = uniqueNonNumericParts.join(' ').trim();
    }

    const houseTokens = houseVal.includes(',')
      ? houseVal.split(',').map((h) => h.trim()).filter(Boolean)
      : [houseVal.trim()];

    for (const hToken of houseTokens) {
      results.push({
        house: hToken,
        queue: normalizedQueue,
        rawQueueCell: queueRaw,
        rawSubqueueCell: subqueueRaw,
        statusText,
      });
    }
  }

  return results;
}

/**
 * Formats an ISO-8601 or ZTOE timestamp (e.g. "2026-11-09T06:35:59+00:00" or "09.11.2026 06:35")
 * into "DD.MM.YYYY HH:mm".
 */
export function formatZtoeOutageTimestamp(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[3]}.${isoMatch[2]}.${isoMatch[1]} ${isoMatch[4]}:${isoMatch[5]}`;
  }
  return trimmed;
}

export interface ParsedEmergencyOutageRow extends EmergencyOutageInfo {
  rem?: string;
  city?: string;
  street?: string;
  house: string;
}

/**
 * Parses an HTML emergency outage table from ZTOE (https://www.ztoe.com.ua/unhooking-search.php or poweron table)
 * extracting rows where the outage type is "Аварійне відключення" along with Start and Estimated Restoration times.
 */
export function parseZtoeEmergencyOutagesTableHtml(html: string): ParsedEmergencyOutageRow[] {
  const results: ParsedEmergencyOutageRow[] = [];
  if (!html) return results;

  const trRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;

  let remColIdx = 0;
  let cityColIdx = 1;
  let streetColIdx = 2;
  let houseColIdx = 3;
  let typeColIdx = 4;
  let startColIdx = 5;
  let restoreColIdx = 6;

  while ((trMatch = trRegex.exec(html)) !== null) {
    const rowHtml = trMatch[1];
    if (/<input\b/i.test(rowHtml) || /<select\b/i.test(rowHtml)) continue;

    const cellRegex = /<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      cells.push(stripHtmlTags(cellMatch[1]));
    }

    if (cells.length < 4) continue;

    const firstCellLower = (cells[0] || '').toLowerCase();
    const rowJoinedLower = cells.join(' ').toLowerCase();
    const isHeaderRow =
      /<th\b/i.test(rowHtml) ||
      firstCellLower === 'рем' ||
      firstCellLower === 'підрозділ' ||
      (rowJoinedLower.includes('вулиц') &&
        (rowJoinedLower.includes('відключен') || rowJoinedLower.includes('ввімкнен') || rowJoinedLower.includes('відновлен')));

    if (isHeaderRow) {
      cells.forEach((c, idx) => {
        const cl = c.toLowerCase();
        if (cl === 'рем' || cl.includes('підрозділ')) remColIdx = idx;
        else if (cl.includes('населений') || cl.includes('місто') || cl.includes('пункт')) cityColIdx = idx;
        else if (cl.includes('вулиц')) streetColIdx = idx;
        else if (cl.includes('буд') || cl.includes('дом')) houseColIdx = idx;
        else if (cl.includes('причин') || cl.includes('тип') || cl.includes('вид')) typeColIdx = idx;
        else if (cl.includes('почат') || cl.includes('час відключ') || cl.includes('дата відключ')) startColIdx = idx;
        else if (cl.includes('ввімкн') || cl.includes('відновл')) restoreColIdx = idx;
      });
      continue;
    }

    const houseVal = cells[houseColIdx] || '';
    const typeVal = cells[typeColIdx] || '';
    const startVal = cells[startColIdx] || '';
    const restoreVal = cells[restoreColIdx] || '';

    const typeLower = typeVal.toLowerCase();
    const isEmergency =
      typeLower.includes('аварійн') &&
      !typeLower.includes('не вимикається') &&
      !typeLower.includes('за винятком');

    if (!houseVal || !isEmergency) continue;

    const formattedStart = formatZtoeOutageTimestamp(startVal);
    const formattedRestore = formatZtoeOutageTimestamp(restoreVal);
    if (!isValidOutageTimestamp(formattedStart) || !isValidOutageTimestamp(formattedRestore)) {
      continue;
    }

    const houseTokens = houseVal.includes(',')
      ? houseVal.split(',').map((h) => h.trim()).filter(Boolean)
      : [houseVal.trim()];

    for (const hToken of houseTokens) {
      results.push({
        id: `ztoe_emerg_${cells[streetColIdx] || ''}_${hToken}_${formattedStart || 'active'}`,
        rem: cells[remColIdx] || undefined,
        city: cells[cityColIdx] || undefined,
        street: cells[streetColIdx] || undefined,
        house: hToken,
        outageType: typeVal || 'Аварійне відключення',
        startTime: formattedStart,
        estimatedRestoreTime: formattedRestore,
      });
    }
  }

  return results;
}

function normalizePlaceName(name: string): string {
  return decodeHtmlEntities(name || '')
    .toLowerCase()
    .replace(/^(м\.|місто|с\.|село|смт\.?|селище|с-ще\.?)\s+/i, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/['’ʼ`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeStreetName(name: string): string {
  let s = decodeHtmlEntities(name || '')
    .toLowerCase()
    .replace(/['’ʼ`]/g, "'")
    .replace(/[.,]/g, ' ')
    .replace(/(^|\s)вулиця(?=\s|$)/g, '$1вул')
    .replace(/(^|\s)(?:провулок|пр-к|пр)(?=\s|$)/g, '$1пров')
    .replace(/(^|\s)(?:проспект|пр-т)(?=\s|$)/g, '$1просп')
    .replace(/(^|\s)м-н(?=\s|$)/g, '$1майдан')
    .replace(/(^|\s)площа(?=\s|$)/g, '$1пл')
    .replace(/(^|\s)ш(?=\s|$)/g, '$1шосе')
    .replace(/(^|\s)(?:бульвар|б-р)(?=\s|$)/g, '$1бул')
    .replace(/(^|\s)пр-д(?=\s|$)/g, '$1проїзд')
    .replace(/(\d+)\s*-\s*(?:й|а|га|тя|ї|е)(?=\s|$)/g, '$1')
    .replace(/бердичив/g, 'бердичів')
    .replace(/\s+/g, ' ')
    .trim();
  s = s.replace(/^(\d+)\s+(пров|проїзд|вул|тупик)(?=\s|$)/, '$2 $1');
  return s;
}

function stripStreetTypePrefix(normStreet: string): string {
  return normStreet
    .replace(/^(?:вул|пров|просп|майдан|пл|шосе|бул|проїзд|тупик|наб)\s+/i, '')
    .trim();
}

function normalizeHouseToken(raw: string): string {
  return decodeHtmlEntities(raw || '')
    .trim()
    .replace(/^(?:буд\.?|б\.?|д\.?)\s*/i, '')
    .replace(/\.+$/, '')
    .toLowerCase()
    .replace(/a/g, 'а')
    .replace(/b/g, 'б')
    .replace(/v/g, 'в')
    .replace(/g/g, 'г')
    .replace(/d/g, 'д')
    .replace(/e/g, 'е')
    .replace(/k/g, 'к')
    .replace(/m/g, 'м')
    .replace(/i/g, 'і')
    .replace(/[\s-]+/g, '');
}

export interface ZtoePwAccidentRecord {
  id?: number | string;
  city?: { id?: number | string; name?: string };
  street?: { id?: number | string; name?: string };
  otg?: { id?: number | string; code?: string; name?: string };
  buildingNames?: string;
  dateEvent?: string;
  datePlanIn?: string;
  koment?: string;
  typeOff?: number;
  switchSubReason?: number;
}

/**
 * Computes priority score matching ZTOE PowerOn's official outage type classification:
 * - (!switchSubReason || switchSubReason === 0) && typeOff === 1 -> "Аварійне відключення" (score 4, highest priority)
 * - switchSubReason === 1 -> "Графік аварійних відключень" (score 3)
 * - switchSubReason === 3 -> "Спеціальний графік аварійних відключень" (score 3)
 * - switchSubReason === 2 && typeOff === 1 -> "Графік погодинних відключень" (score 1 or 2)
 */
function getAccidentPriorityScore(item: ZtoePwAccidentRecord): number {
  if (!item.switchSubReason || item.switchSubReason === 0) {
    if (item.typeOff === 1 || item.typeOff === undefined) {
      return 4;
    }
    return 0;
  }
  if (item.switchSubReason === 1 || item.switchSubReason === 3) {
    return 3;
  }
  const komentTrimmed = (item.koment || '').trim();
  if (/аварі|гав|сгав|(^|\s)мо(?=\s|$)/i.test(komentTrimmed)) {
    return 3;
  }
  if (item.typeOff === 1) {
    const isGpvQueueComment = /^(?:гпв[-\s]*)?[1-6][.,][1-2](?!\d)/i.test(komentTrimmed);
    return isGpvQueueComment ? 1 : 2;
  }
  return 0;
}

function getAccidentOutageTypeLabel(item: ZtoePwAccidentRecord): string {
  if (item.switchSubReason === 1) {
    return 'Графік аварійних відключень';
  }
  if (item.switchSubReason === 3) {
    return 'Спеціальний графік аварійних відключень';
  }
  return 'Аварійне відключення';
}

/**
 * Matches a user's SelectedAddressQuery against records from ZTOE's live
 * https://api-ztoe-poweron.inneti.net/api/pw_accidents endpoint.
 * Emergency outages ("Аварійне відключення", switchSubReason 0, 1, 3) always take priority over scheduled GPV rows (switchSubReason 2).
 */
export function matchEmergencyOutageFromAccidentsJson(
  accidents: ZtoePwAccidentRecord[],
  query: SelectedAddressQuery
): EmergencyOutageInfo | null {
  if (!Array.isArray(accidents) || !query || !query.streetId || !query.house) return null;

  const settlementObj = findSettlementById(query.settlementId);
  const streetObj = findStreetById(query.streetId);
  if (!streetObj) return null;

  const targetCityNorm = settlementObj ? normalizePlaceName(settlementObj.nameUk) : '';
  const targetStreetNorm = normalizeStreetName(streetObj.nameUk);
  const targetStreetBare = stripStreetTypePrefix(targetStreetNorm);
  const targetHouseRawLower = query.house.trim().toLowerCase();
  const targetHouseNorm = normalizeHouseToken(query.house);

  let bestItem: ZtoePwAccidentRecord | null = null;
  let bestScore = 0;
  let bestPlanIn = '';

  for (const item of accidents) {
    const score = getAccidentPriorityScore(item);
    if (score <= 0) continue;

    if (targetCityNorm && item.city?.name) {
      const itemCityNorm = normalizePlaceName(item.city.name);
      if (itemCityNorm !== targetCityNorm) continue;
    }

    if (item.street?.name) {
      const itemStreetNorm = normalizeStreetName(item.street.name);
      if (itemStreetNorm !== targetStreetNorm) {
        const itemStreetBare = stripStreetTypePrefix(itemStreetNorm);
        const oneHasNoPrefix = itemStreetNorm === itemStreetBare || targetStreetNorm === targetStreetBare;
        if (!oneHasNoPrefix || !itemStreetBare || itemStreetBare !== targetStreetBare) {
          continue;
        }
      }
    } else {
      continue;
    }

    const rawTokens = (item.buildingNames || '')
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean);

    const matchesHouse = rawTokens.some(
      (h) =>
        h.toLowerCase() === targetHouseRawLower ||
        normalizeHouseToken(h) === targetHouseNorm
    );
    if (!matchesHouse) continue;

    const planInStr = item.datePlanIn || '';
    if (
      !bestItem ||
      score > bestScore ||
      (score === bestScore && planInStr > bestPlanIn)
    ) {
      bestItem = item;
      bestScore = score;
      bestPlanIn = planInStr;
    }
  }

  if (!bestItem) return null;

  const startTime = formatZtoeOutageTimestamp(bestItem.dateEvent || '');
  const estimatedRestoreTime = formatZtoeOutageTimestamp(bestItem.datePlanIn || '');
  if (!isValidOutageTimestamp(startTime) || !isValidOutageTimestamp(estimatedRestoreTime)) {
    return null;
  }

  const outageType = getAccidentOutageTypeLabel(bestItem);

  return {
    id: bestItem.id
      ? `pw_accident_${bestItem.id}`
      : `pw_accident_${query.streetId}_${targetHouseRawLower}_${startTime}`,
    startTime,
    estimatedRestoreTime,
    outageType,
  };
}

const accidentsCacheByScope = new Map<string, { updatedAt: number; records: ZtoePwAccidentRecord[] }>();
const inFlightAccidentsByScope = new Map<string, Promise<ZtoePwAccidentRecord[]>>();
const ACCIDENTS_CACHE_TTL_MS = 60_000;

function resolveOtgIdForRem(remId: string): string | undefined {
  if (!remId) return undefined;
  const remObj =
    getRems().find((r) => r.id === remId || r.ztoeRemId === remId) ||
    ZTOE_REM_OPTIONS.find((r) => r.id === remId || r.ztoeRemId === remId);
  if (remObj?.ztoeOtgId) return remObj.ztoeOtgId;
  if (remObj) {
    const byStatic = ZTOE_REM_OPTIONS.find(
      (s) =>
        s.id === remObj.id ||
        (remObj.ztoeRemId && s.ztoeRemId === remObj.ztoeRemId) ||
        s.nameUk.toLowerCase() === remObj.nameUk.toLowerCase()
    );
    if (byStatic?.ztoeOtgId) return byStatic.ztoeOtgId;
  }
  const stripped = remId.replace(/^rem_/, '');
  const byRemNum = ZTOE_REM_OPTIONS.find((s) => s.ztoeRemId === stripped);
  return byRemNum?.ztoeOtgId;
}

function applyAccidentsToRemHouses(
  remId: string,
  accidents: ZtoePwAccidentRecord[],
  specificSettlementId?: string
): void {
  if (!Array.isArray(accidents) || accidents.length === 0) return;
  const settlementIds = new Set<string>();
  if (specificSettlementId) {
    settlementIds.add(specificSettlementId);
  }
  for (const s of getSettlementsForRem(remId)) {
    if (s.id) settlementIds.add(s.id);
  }
  for (const s of ZTOE_SETTLEMENT_OPTIONS.filter((st) => st.remId === remId)) {
    if (s.id) settlementIds.add(s.id);
  }
  for (const sid of settlementIds) {
    applyAccidentsToSettlementHouses(sid, accidents);
  }
}

/**
 * Fetches active emergency outages (switchSubReason 0, 1, 3) from ZTOE's PowerOn API
 * for a given REM (otg.id), caching results for 60s and enriching indexed houses across all settlements in the REM.
 */
export async function fetchPwAccidentsForScope(
  remId: string,
  settlementId?: string
): Promise<ZtoePwAccidentRecord[]> {
  if (typeof fetch === 'undefined') return [];

  const otgId = resolveOtgIdForRem(remId);
  const settlementObj = settlementId ? findSettlementById(settlementId) : undefined;
  const cityId = settlementObj?.poweronCityId;
  if (!otgId && !cityId) return [];

  // Prefer REM-wide otgId scope so every city, town, and village in the REM is covered in a single fast request
  const scopeKey = otgId ? `otg_${otgId}` : `city_${cityId}`;
  const cached = accidentsCacheByScope.get(scopeKey);
  if (cached && Date.now() - cached.updatedAt < ACCIDENTS_CACHE_TTL_MS) {
    applyAccidentsToRemHouses(remId, cached.records, settlementId);
    return cached.records;
  }

  const existingPromise = inFlightAccidentsByScope.get(scopeKey);
  if (existingPromise) {
    const records = await existingPromise;
    applyAccidentsToRemHouses(remId, records, settlementId);
    return records;
  }

  const promise = (async (): Promise<ZtoePwAccidentRecord[]> => {
    try {
      const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
      const filterParam = otgId
        ? `otg.id=${encodeURIComponent(otgId)}`
        : `city.id=${encodeURIComponent(cityId!)}`;
      const queryString = `switchSubReason[]=0&switchSubReason[]=1&switchSubReason[]=3&${filterParam}&pagination=false`;
      const endpoints = isBrowser
        ? [
            `/proxy-ztoe-poweron/api/pw_accidents?${queryString}`,
            `https://api-ztoe-poweron.inneti.net/api/pw_accidents?${queryString}`,
          ]
        : [`https://api-ztoe-poweron.inneti.net/api/pw_accidents?${queryString}`];

      for (const url of endpoints) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 4500);
          const res = await fetch(url, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: controller.signal,
          });
          clearTimeout(timer);
          if (!res.ok || typeof res.json !== 'function') continue;
          const contentType = res.headers?.get?.('content-type') || '';
          if (contentType && contentType.includes('text/html')) continue;
          const data = await res.json();
          const records: ZtoePwAccidentRecord[] = Array.isArray(data)
            ? data
            : Array.isArray(data?.['hydra:member'])
            ? data['hydra:member']
            : [];
          accidentsCacheByScope.set(scopeKey, { updatedAt: Date.now(), records });
          if (records.length > 0) {
            applyAccidentsToRemHouses(remId, records, settlementId);
          }
          return records;
        } catch {
          // Try next endpoint if proxy or network failed
        }
      }
      return [];
    } finally {
      inFlightAccidentsByScope.delete(scopeKey);
    }
  })();

  inFlightAccidentsByScope.set(scopeKey, promise);
  return promise;
}

function applyAccidentsToSettlementHouses(
  settlementId: string,
  accidents: ZtoePwAccidentRecord[]
): void {
  if (!settlementId || !Array.isArray(accidents) || accidents.length === 0) return;
  const settlementObj = findSettlementById(settlementId);
  const targetCityNorm = settlementObj ? normalizePlaceName(settlementObj.nameUk) : '';

  const dynamicStreets = getStreetsForSettlement(settlementId);
  const staticStreets = ZTOE_STREET_OPTIONS.filter((st) => st.settlementId === settlementId);
  const allStreetsMap = new Map<string, ZtoeStreetOption>();
  for (const st of [...dynamicStreets, ...staticStreets]) {
    if (st && st.id && !allStreetsMap.has(st.id)) {
      allStreetsMap.set(st.id, st);
    }
  }
  const streets = Array.from(allStreetsMap.values());
  if (streets.length === 0) return;

  const streetsByNormName = new Map<string, ZtoeStreetOption[]>();
  const streetsByBareName = new Map<string, ZtoeStreetOption[]>();
  for (const st of streets) {
    const norm = normalizeStreetName(st.nameUk);
    if (!norm) continue;
    const list = streetsByNormName.get(norm) || [];
    if (!list.some((existing) => existing.id === st.id)) {
      list.push(st);
      streetsByNormName.set(norm, list);
    }
    const bare = stripStreetTypePrefix(norm);
    if (bare) {
      const bareList = streetsByBareName.get(bare) || [];
      if (!bareList.some((existing) => existing.id === st.id)) {
        bareList.push(st);
        streetsByBareName.set(bare, bareList);
      }
    }
  }

  // Sort accidents by priority ascending so higher-priority accidents (score 4 = "Аварійне відключення")
  // and later restoration times win when multiple rows affect the same house.
  const sortedAccidents = [...accidents].sort((a, b) => {
    const scoreDiff = getAccidentPriorityScore(a) - getAccidentPriorityScore(b);
    if (scoreDiff !== 0) return scoreDiff;
    return (a.datePlanIn || '').localeCompare(b.datePlanIn || '');
  });

  for (const item of sortedAccidents) {
    const score = getAccidentPriorityScore(item);
    if (score < 3) continue; // Only attach true emergency outages (switchSubReason 0, 1, 3)

    if (targetCityNorm && item.city?.name) {
      if (normalizePlaceName(item.city.name) !== targetCityNorm) continue;
    }
    if (!item.street?.name) continue;
    const itemStreetNorm = normalizeStreetName(item.street.name);
    let matchedStreets = streetsByNormName.get(itemStreetNorm);
    if (!matchedStreets || matchedStreets.length === 0) {
      const itemBare = stripStreetTypePrefix(itemStreetNorm);
      if (itemBare === itemStreetNorm) {
        matchedStreets = streetsByBareName.get(itemBare);
      }
    }
    if (!matchedStreets || matchedStreets.length === 0) continue;

    const startTime = formatZtoeOutageTimestamp(item.dateEvent || '');
    const estimatedRestoreTime = formatZtoeOutageTimestamp(item.datePlanIn || '');
    if (!isValidOutageTimestamp(startTime) || !isValidOutageTimestamp(estimatedRestoreTime)) {
      continue;
    }

    const outageType = getAccidentOutageTypeLabel(item);

    const rawBuildingTokens = (item.buildingNames || '')
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean);
    const buildingNormToRaw = new Map<string, string>();
    for (const rawTok of rawBuildingTokens) {
      const normTok = normalizeHouseToken(rawTok);
      if (normTok && !buildingNormToRaw.has(normTok)) {
        buildingNormToRaw.set(normTok, rawTok);
      }
    }
    if (buildingNormToRaw.size === 0) continue;

    for (const matchedStreet of matchedStreets) {
      const houseList =
        dynamicHousesByStreetId[matchedStreet.id] ||
        ZTOE_STREET_HOUSES[matchedStreet.id] ||
        [];
      if (houseList.length === 0) continue;

      let updated = false;
      const matchedNorms = new Set<string>();
      const nextList = houseList.map((h) => {
        const hNorm = normalizeHouseToken(h.house);
        if (buildingNormToRaw.has(hNorm)) {
          matchedNorms.add(hNorm);
          updated = true;
          return {
            ...h,
            emergencyOutage: {
              id: item.id
                ? `pw_accident_${item.id}`
                : `pw_accident_${matchedStreet.id}_${hNorm}_${startTime}`,
              startTime,
              estimatedRestoreTime,
              outageType,
            },
          };
        }
        return h;
      });

      // If any house in buildingNames is not yet present in houseList, add it so it is selectable in the dropdown
      for (const [normTok, rawTok] of buildingNormToRaw.entries()) {
        if (!matchedNorms.has(normTok)) {
          updated = true;
          nextList.push({
            house: rawTok,
            queue: '',
            emergencyOutage: {
              id: item.id
                ? `pw_accident_${item.id}`
                : `pw_accident_${matchedStreet.id}_${normTok}_${startTime}`,
              startTime,
              estimatedRestoreTime,
              outageType,
            },
          });
        }
      }

      if (updated) {
        dynamicHousesByStreetId[matchedStreet.id] = sortHouseLookupResults(nextList);
      }
    }
  }
}

/**
 * Queries ZTOE for active emergency outages ("Аварійне відключення") affecting the user's house,
 * checking HTML emergency tables, ZTOE's live pw_accidents API, and the canonical house directory.
 */
export async function checkEmergencyOutageOnZtoe(
  query: SelectedAddressQuery,
  decodedHtml?: string
): Promise<EmergencyOutageInfo | null> {
  if (!query || !query.streetId || !query.house) return null;

  const streetObj = findStreetById(query.streetId);
  const targetHouseNorm = normalizeHouseToken(query.house);

  if (decodedHtml) {
    const htmlEmergencyRows = parseZtoeEmergencyOutagesTableHtml(decodedHtml);
    const matchedHtmlRow = htmlEmergencyRows.find((r) => {
      if (normalizeHouseToken(r.house) !== targetHouseNorm) return false;
      if (r.street && streetObj) {
        return normalizeStreetName(r.street) === normalizeStreetName(streetObj.nameUk);
      }
      return true;
    });

    if (matchedHtmlRow && isValidEmergencyOutage(matchedHtmlRow)) {
      return {
        id: matchedHtmlRow.id,
        startTime: matchedHtmlRow.startTime,
        estimatedRestoreTime: matchedHtmlRow.estimatedRestoreTime,
        outageType: matchedHtmlRow.outageType,
      };
    }
  }

  // Query live ZTOE pw_accidents API for active emergency outages in this city/REM
  const liveAccidents = await fetchPwAccidentsForScope(query.remId, query.settlementId);
  if (liveAccidents.length > 0) {
    const liveMatch = matchEmergencyOutageFromAccidentsJson(liveAccidents, query);
    if (liveMatch && isValidEmergencyOutage(liveMatch)) {
      return liveMatch;
    }
  }

  const localHouses = getHousesForStreet(query.streetId);
  const localMatch = localHouses.find((h) => normalizeHouseToken(h.house) === targetHouseNorm);
  if (localMatch?.emergencyOutage && isValidEmergencyOutage(localMatch.emergencyOutage)) {
    return localMatch.emergencyOutage;
  }

  return null;
}

/**
 * Checks the user's selected address against https://www.ztoe.com.ua/unhooking-search.php
 * and ZTOE's live emergency outage table service so that:
 * 1) If an address without a queue receives a queue at a later stage, the app automatically updates the user's queue.
 * 2) If there is an active emergency outage ("Аварійне відключення") for the user's house, it returns emergencyOutage details.
 */
export async function checkAddressOnZtoeWebsite(
  query: SelectedAddressQuery,
  siteUrl?: string
): Promise<ZtoeHouseLookupResult | null> {
  if (!query || !query.streetId || !query.house) return null;

  const targetHouseNorm = normalizeHouseToken(query.house);
  const localHouses = getHousesForStreet(query.streetId);
  const localMatch =
    localHouses.find((h) => normalizeHouseToken(h.house) === targetHouseNorm) || null;

  const remObj =
    getRems().find((r) => r.id === query.remId) ||
    ZTOE_REM_OPTIONS.find((r) => r.id === query.remId);
  const settlementObj = findSettlementById(query.settlementId);
  const streetObj = findStreetById(query.streetId);

  let decodedHtml: string | undefined;
  let resolvedResult: ZtoeHouseLookupResult | null = localMatch ? { ...localMatch } : null;

  if (
    typeof fetch !== 'undefined' &&
    remObj?.ztoeRemId &&
    settlementObj?.ztoeNaspunktId &&
    streetObj?.ztoeVulicaId
  ) {
    try {
      const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
      const targetEndpoint =
        !siteUrl || siteUrl.includes('ztoe.com.ua')
          ? isBrowser
            ? '/proxy-ztoe/unhooking-search.php'
            : 'https://www.ztoe.com.ua/unhooking-search.php'
          : siteUrl;

      // Note: Do NOT pass `all: '1'` when `vulica_id` is specified, because `all=1` causes ZTOE
      // to ignore `vulica_id` and return all streets in the settlement instead of the selected street.
      const bodyParams = new URLSearchParams({
        rem_id: remObj.ztoeRemId,
        naspunkt_id: settlementObj.ztoeNaspunktId,
        vulica_id: streetObj.ztoeVulicaId,
      });

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(targetEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: bodyParams.toString(),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        const buffer = await res.arrayBuffer();
        const win1251Text = new TextDecoder('windows-1251').decode(buffer);
        decodedHtml =
          win1251Text.includes('Черга') || win1251Text.includes('Будинки') || win1251Text.includes('Оберіть')
            ? win1251Text
            : new TextDecoder('utf-8').decode(buffer);

        const parsedRows = parseZtoeAddressLookupTableHtml(decodedHtml, streetObj.nameUk);
        const matchingRows = parsedRows.filter(
          (r) => normalizeHouseToken(r.house) === targetHouseNorm
        );
        if (matchingRows.length > 0 && (!localMatch || localMatch.queue === '')) {
          const noQueueRow = matchingRows.find((r) => !r.queue && r.statusText);
          if (noQueueRow) {
            resolvedResult = { ...noQueueRow };
          } else {
            const withQueueRow = matchingRows.find((r) => Boolean(r.queue));
            resolvedResult = { ...(withQueueRow || matchingRows[0]) };
          }
        }
      }
    } catch {
      // Fallback to local directory below
    }
  }

  const emergencyOutage = await checkEmergencyOutageOnZtoe(query, decodedHtml);

  if (!resolvedResult && emergencyOutage) {
    resolvedResult = {
      house: query.house,
      queue: '',
      emergencyOutage,
    };
  } else if (resolvedResult) {
    resolvedResult.emergencyOutage = emergencyOutage;
  }

  // Keep in-memory house list synchronized with the resolved record
  if (resolvedResult && query.streetId) {
    const existingList = dynamicHousesByStreetId[query.streetId];
    if (Array.isArray(existingList) && existingList.length > 0) {
      dynamicHousesByStreetId[query.streetId] = existingList.map((h) =>
        normalizeHouseToken(h.house) === targetHouseNorm ? { ...h, ...resolvedResult! } : h
      );
    }
  }

  return resolvedResult;
}

export const ADDRESS_INDEX_STORAGE_KEY = 'zt_address_index_cache_v1';
const CACHE_SCHEMA_VERSION = 4;
const MAX_PERSISTED_HOUSE_STREETS = 50;
const FRESH_HOUSE_CACHE_TTL_MS = 120_000;

export interface PersistedAddressIndexCache {
  version: number;
  updatedAt: number;
  rems?: ZtoeRemOption[];
  settlementsByRemId?: Record<string, ZtoeSettlementOption[]>;
  streetsBySettlementId?: Record<string, ZtoeStreetOption[]>;
  housesByStreetId?: Record<string, ZtoeHouseLookupResult[]>;
  recentHouseStreetIds?: string[];
}

let dynamicRems: ZtoeRemOption[] | null = null;
const dynamicSettlementsByRemId: Record<string, ZtoeSettlementOption[]> = {};
const dynamicStreetsBySettlementId: Record<string, ZtoeStreetOption[]> = {};
const dynamicHousesByStreetId: Record<string, ZtoeHouseLookupResult[]> = {};
const houseCacheUpdatedAtByStreetId: Record<string, number> = {};
const inFlightSettlementPromises = new Map<string, Promise<ZtoeStreetOption[]>>();
let recentHouseStreetOrder: string[] = [];
let hasHydratedFromStorage = false;

function recordRecentHouseStreet(streetId: string): void {
  if (!streetId) return;
  recentHouseStreetOrder = [
    streetId,
    ...recentHouseStreetOrder.filter((id) => id !== streetId),
  ].slice(0, MAX_PERSISTED_HOUSE_STREETS);
}

function sortHouseLookupResults(list: Iterable<ZtoeHouseLookupResult>): ZtoeHouseLookupResult[] {
  return Array.from(list).sort((a, b) => {
    const numA = parseInt(a.house, 10);
    const numB = parseInt(b.house, 10);
    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
      return numA - numB;
    }
    return a.house.localeCompare(b.house, 'uk');
  });
}

function applyCanonicalStreetOverrides(
  streetId: string,
  mergedMap: Map<string, ZtoeHouseLookupResult>
): void {
  if (streetId === 'zt_kyivska') {
    for (const localH of ZTOE_STREET_HOUSES.zt_kyivska || []) {
      const k = localH.house.trim().toLowerCase();
      if (
        localH.house === '74' ||
        localH.house === '77' ||
        localH.house === '37' ||
        localH.house === '104' ||
        localH.house === '106' ||
        !mergedMap.has(k)
      ) {
        mergedMap.set(k, localH);
      }
    }
  }
}

export function hydrateAddressIndexFromStorage(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    const raw = localStorage.getItem(ADDRESS_INDEX_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Partial<PersistedAddressIndexCache>;
    if (!parsed || typeof parsed !== 'object') return false;

    // Validate schema version and ensure Zhytomyr REM has ztoeRemId === '7'
    const cachedZtRem = Array.isArray(parsed.rems)
      ? parsed.rems.find((r) => r.id === 'zhytomyr')
      : undefined;
    if (parsed.version !== CACHE_SCHEMA_VERSION || (cachedZtRem && cachedZtRem.ztoeRemId !== '7')) {
      localStorage.removeItem(ADDRESS_INDEX_STORAGE_KEY);
      return false;
    }

    if (Array.isArray(parsed.rems) && parsed.rems.length > 0) {
      const cleaned = parsed.rems.map((r) => ({
        ...r,
        nameUk: stripHtmlTags(r.nameUk || ''),
        nameEn: stripHtmlTags(r.nameEn || r.nameUk || ''),
      }));
      // Ensure Житомирський РЕМ ('zhytomyr') is always at index 0
      const zt = cleaned.find((r) => r.id === 'zhytomyr');
      const rest = cleaned.filter((r) => r.id !== 'zhytomyr');
      dynamicRems = zt ? [zt, ...rest] : cleaned;
    }
    if (parsed.settlementsByRemId && typeof parsed.settlementsByRemId === 'object') {
      for (const [remId, list] of Object.entries(parsed.settlementsByRemId)) {
        if (Array.isArray(list) && list.length > 0) {
          dynamicSettlementsByRemId[remId] = list.map((s) => ({
            ...s,
            nameUk: stripHtmlTags(s.nameUk || ''),
            nameEn: stripHtmlTags(s.nameEn || s.nameUk || ''),
          }));
        }
      }
    }
    if (parsed.streetsBySettlementId && typeof parsed.streetsBySettlementId === 'object') {
      for (const [settlementId, list] of Object.entries(parsed.streetsBySettlementId)) {
        if (Array.isArray(list) && list.length > 0) {
          dynamicStreetsBySettlementId[settlementId] = list.map((st) => ({
            ...st,
            nameUk: stripHtmlTags(st.nameUk || ''),
            nameEn: stripHtmlTags(st.nameEn || st.nameUk || ''),
          }));
        }
      }
    }
    if (parsed.housesByStreetId && typeof parsed.housesByStreetId === 'object') {
      for (const [streetId, list] of Object.entries(parsed.housesByStreetId)) {
        if (Array.isArray(list) && list.length > 0) {
          dynamicHousesByStreetId[streetId] = list.map((h) => ({
            ...h,
            house: decodeHtmlEntities(h.house),
            statusText: h.statusText ? decodeHtmlEntities(h.statusText) : undefined,
            emergencyOutage: isValidEmergencyOutage(h.emergencyOutage) ? h.emergencyOutage : undefined,
          }));
        }
      }
    }
    if (Array.isArray(parsed.recentHouseStreetIds)) {
      recentHouseStreetOrder = parsed.recentHouseStreetIds.slice(0, MAX_PERSISTED_HOUSE_STREETS);
    } else {
      recentHouseStreetOrder = Object.keys(dynamicHousesByStreetId).slice(0, MAX_PERSISTED_HOUSE_STREETS);
    }
    hasHydratedFromStorage = true;
    return true;
  } catch {
    return false;
  }
}

export function persistAddressIndexToStorage(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const boundedHousesByStreetId: Record<string, ZtoeHouseLookupResult[]> = {};
    const allHouseKeys = Array.from(
      new Set([...recentHouseStreetOrder, ...Object.keys(dynamicHousesByStreetId)])
    ).slice(0, MAX_PERSISTED_HOUSE_STREETS);
    for (const streetId of allHouseKeys) {
      const houses = dynamicHousesByStreetId[streetId];
      if (Array.isArray(houses) && houses.length > 0) {
        boundedHousesByStreetId[streetId] = houses.map((h) => {
          const compact: ZtoeHouseLookupResult = {
            house: h.house,
            queue: h.queue,
          };
          if (h.statusText) compact.statusText = h.statusText;
          if (h.emergencyOutage && isValidEmergencyOutage(h.emergencyOutage)) {
            compact.emergencyOutage = h.emergencyOutage;
          }
          return compact;
        });
      }
    }
    const payload: PersistedAddressIndexCache = {
      version: CACHE_SCHEMA_VERSION,
      updatedAt: Date.now(),
      rems: dynamicRems || undefined,
      settlementsByRemId: { ...dynamicSettlementsByRemId },
      streetsBySettlementId: { ...dynamicStreetsBySettlementId },
      housesByStreetId: boundedHousesByStreetId,
      recentHouseStreetIds: recentHouseStreetOrder.slice(0, 100),
    };
    localStorage.setItem(ADDRESS_INDEX_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota or serialization errors
  }
}

export function resetAddressIndexCache(clearDisk = false): void {
  dynamicRems = null;
  for (const key of Object.keys(dynamicSettlementsByRemId)) {
    delete dynamicSettlementsByRemId[key];
  }
  for (const key of Object.keys(dynamicStreetsBySettlementId)) {
    delete dynamicStreetsBySettlementId[key];
  }
  for (const key of Object.keys(dynamicHousesByStreetId)) {
    delete dynamicHousesByStreetId[key];
  }
  for (const key of Object.keys(houseCacheUpdatedAtByStreetId)) {
    delete houseCacheUpdatedAtByStreetId[key];
  }
  inFlightSettlementPromises.clear();
  accidentsCacheByScope.clear();
  inFlightAccidentsByScope.clear();
  recentHouseStreetOrder = [];
  hasHydratedFromStorage = false;
  if (clearDisk && typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(ADDRESS_INDEX_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

export function getAddressIndexStats(): {
  remCount: number;
  settlementGroupCount: number;
  streetGroupCount: number;
  houseGroupCount: number;
  indexedRemSettlementsCount: number;
  indexedSettlementStreetsCount: number;
  indexedStreetHousesCount: number;
} {
  ensureHydrated();
  const sCount = Object.keys(dynamicSettlementsByRemId).length;
  const stCount = Object.keys(dynamicStreetsBySettlementId).length;
  const hCount = Object.keys(dynamicHousesByStreetId).length;
  return {
    remCount: (dynamicRems || ZTOE_REM_OPTIONS).length,
    settlementGroupCount: sCount,
    streetGroupCount: stCount,
    houseGroupCount: hCount,
    indexedRemSettlementsCount: sCount,
    indexedSettlementStreetsCount: stCount,
    indexedStreetHousesCount: hCount,
  };
}

function ensureHydrated(): void {
  if (!hasHydratedFromStorage) {
    hasHydratedFromStorage = true;
    hydrateAddressIndexFromStorage();
  }
}

export function getRems(): ZtoeRemOption[] {
  ensureHydrated();
  if (dynamicRems && dynamicRems.length > 0) return dynamicRems;
  return ZTOE_REM_OPTIONS;
}

export function findSettlementById(settlementId: string): ZtoeSettlementOption | undefined {
  ensureHydrated();
  for (const list of Object.values(dynamicSettlementsByRemId)) {
    const found = list.find((s) => s.id === settlementId);
    if (found) return found;
  }
  const staticMatch = ZTOE_SETTLEMENT_OPTIONS.find((s) => s.id === settlementId);
  if (staticMatch) return staticMatch;
  const npId = settlementId.replace(/^(?:np|nasp_[a-z]+)_/, '');
  if (/^\d+$/.test(npId)) {
    for (const list of Object.values(dynamicSettlementsByRemId)) {
      const byDynamicNp = list.find((s) => s.ztoeNaspunktId === npId);
      if (byDynamicNp) return byDynamicNp;
    }
    const byNp = ZTOE_SETTLEMENT_OPTIONS.find((s) => s.ztoeNaspunktId === npId);
    if (byNp) return byNp;
  }
  return undefined;
}

export function findStreetById(streetId: string): ZtoeStreetOption | undefined {
  ensureHydrated();
  const canonicalId = streetId === 'zt_velyka_berdychivska' ? 'zt_berdy' : streetId;
  for (const list of Object.values(dynamicStreetsBySettlementId)) {
    const found = list.find((st) => st.id === streetId || st.id === canonicalId);
    if (found) return found;
  }
  const staticMatch = ZTOE_STREET_OPTIONS.find((st) => st.id === streetId || st.id === canonicalId);
  if (staticMatch) return staticMatch;
  const vulId = streetId.replace(/^(?:st|vul_[a-z_]+)_/, '');
  if (/^\d+$/.test(vulId)) {
    for (const list of Object.values(dynamicStreetsBySettlementId)) {
      const byDynamicVul = list.find((st) => st.ztoeVulicaId === vulId);
      if (byDynamicVul) return byDynamicVul;
    }
    const byVul = ZTOE_STREET_OPTIONS.find((st) => st.ztoeVulicaId === vulId);
    if (byVul) return byVul;
  }
  return undefined;
}

export function getSettlementsForRem(remId: string): ZtoeSettlementOption[] {
  ensureHydrated();
  const dynamicList = dynamicSettlementsByRemId[remId];
  if (dynamicList && dynamicList.length > 0) return dynamicList;
  return ZTOE_SETTLEMENT_OPTIONS.filter((s) => s.remId === remId);
}

export function getStreetsForSettlement(settlementId: string): ZtoeStreetOption[] {
  ensureHydrated();
  const dynamicList = dynamicStreetsBySettlementId[settlementId];
  if (dynamicList && dynamicList.length > 0) return dynamicList;
  return ZTOE_STREET_OPTIONS.filter((st) => st.settlementId === settlementId);
}

export function getHousesForStreet(streetId: string): ZtoeHouseLookupResult[] {
  ensureHydrated();
  const canonicalId = streetId === 'zt_velyka_berdychivska' ? 'zt_berdy' : streetId;
  const dynamicList = dynamicHousesByStreetId[streetId] || dynamicHousesByStreetId[canonicalId];
  if (dynamicList && dynamicList.length > 0) return dynamicList;
  return ZTOE_STREET_HOUSES[streetId] || ZTOE_STREET_HOUSES[canonicalId] || [];
}

export function parseZtoeRemOptionsHtml(html: string): ZtoeRemOption[] {
  if (!html || typeof html !== 'string') return [];
  const selectMatch = html.match(
    /<select[^>]*?(?:name=["']?rem_id["']?|id=["']?rem_id["']?)[^>]*>([\s\S]*?)<\/select>/i
  );
  const selectInner = selectMatch ? selectMatch[1] : html;
  const results: ZtoeRemOption[] = [];
  const seenIds = new Set<string>();
  const optRegex = /<option\s+value=["']?(\d+)["']?[^>]*>([\s\S]*?)<\/option>/gi;
  let m: RegExpExecArray | null;
  while ((m = optRegex.exec(selectInner)) !== null) {
    const remNum = m[1].trim();
    if (!remNum || remNum === '0') continue;
    const rawLabel = stripHtmlTags(m[2]).trim();
    if (!rawLabel || /оберіть|виберіть/i.test(rawLabel)) continue;

    const normalizedRawName = rawLabel.replace(/\s*РЕМ$/i, '').trim().toLowerCase();
    const staticMatch =
      ZTOE_REM_OPTIONS.find(
        (r) =>
          r.nameUk.toLowerCase() === rawLabel.toLowerCase() ||
          r.nameUk.replace(/\s*РЕМ$/i, '').trim().toLowerCase() === normalizedRawName
      ) || ZTOE_REM_OPTIONS.find((r) => r.ztoeRemId === remNum);

    const opt: ZtoeRemOption = {
      id: staticMatch?.id || `rem_${remNum}`,
      ztoeRemId: remNum,
      ztoeOtgId: staticMatch?.ztoeOtgId,
      nameUk: staticMatch?.nameUk || (rawLabel.includes('РЕМ') ? rawLabel : `${rawLabel} РЕМ`),
      nameEn: staticMatch?.nameEn || rawLabel,
    };
    if (!seenIds.has(opt.id)) {
      seenIds.add(opt.id);
      results.push(opt);
    }
  }
  if (results.length > 0) {
    for (const def of ZTOE_REM_OPTIONS) {
      if (!seenIds.has(def.id)) {
        seenIds.add(def.id);
        results.push(def);
      }
    }
  }
  // Ensure Житомирський РЕМ ('zhytomyr') is always placed first if present
  const ztIdx = results.findIndex((r) => r.id === 'zhytomyr');
  if (ztIdx > 0) {
    const [ztItem] = results.splice(ztIdx, 1);
    results.unshift(ztItem);
  }
  return results;
}

export function parseZtoeSettlementOptionsHtml(remId: string, html: string): ZtoeSettlementOption[] {
  if (!html || typeof html !== 'string') return [];
  const selectMatch = html.match(
    /<select[^>]*?(?:name=["']?naspunkt_id["']?|id=["']?naspunkt_id["']?)[^>]*>([\s\S]*?)<\/select>/i
  );
  const selectInner = selectMatch ? selectMatch[1] : !/<select\b/i.test(html) ? html : '';
  if (!selectInner) return [];

  const staticForRem = ZTOE_SETTLEMENT_OPTIONS.filter((s) => s.remId === remId);
  const results: ZtoeSettlementOption[] = [];
  const seenIds = new Set<string>();
  const optRegex = /<option\s+value=["']?(\d+)["']?[^>]*>([\s\S]*?)<\/option>/gi;
  let m: RegExpExecArray | null;
  while ((m = optRegex.exec(selectInner)) !== null) {
    const npId = m[1].trim();
    if (!npId || npId === '0') continue;
    const rawLabel = stripHtmlTags(m[2]).trim();
    if (!rawLabel || /оберіть|виберіть/i.test(rawLabel)) continue;
    const formattedUk = rawLabel
      .replace(/^місто\s+/i, 'м. ')
      .replace(/^село\s+/i, 'с. ')
      .replace(/^селище\s+/i, 'смт ');
    const candidateStatic =
      staticForRem.find((s) => normalizePlaceName(s.nameUk) === normalizePlaceName(formattedUk)) ||
      staticForRem.find((s) => s.ztoeNaspunktId === npId);
    const staticMatch = candidateStatic && !seenIds.has(candidateStatic.id) ? candidateStatic : undefined;
    const opt: ZtoeSettlementOption = {
      id: staticMatch?.id || `np_${npId}`,
      remId,
      ztoeNaspunktId: npId,
      poweronCityId: staticMatch?.poweronCityId,
      nameUk: staticMatch?.nameUk || formattedUk,
      nameEn: staticMatch?.nameEn || formattedUk,
    };
    if (!seenIds.has(opt.id)) {
      seenIds.add(opt.id);
      results.push(opt);
    }
  }
  return results;
}

export function parseZtoeStreetOptionsHtml(settlementId: string, html: string): ZtoeStreetOption[] {
  if (!html || typeof html !== 'string') return [];
  const selectMatch = html.match(
    /<select[^>]*?(?:name=["']?vulica_id["']?|id=["']?vulica_id["']?)[^>]*>([\s\S]*?)<\/select>/i
  );
  const selectInner = selectMatch ? selectMatch[1] : !/<select\b/i.test(html) ? html : '';
  if (!selectInner) return [];

  const staticForSettlement = ZTOE_STREET_OPTIONS.filter((st) => st.settlementId === settlementId);
  const results: ZtoeStreetOption[] = [];
  const seenIds = new Set<string>();
  const optRegex = /<option\s+value=["']?(\d+)["']?[^>]*>([\s\S]*?)<\/option>/gi;
  let m: RegExpExecArray | null;
  while ((m = optRegex.exec(selectInner)) !== null) {
    const vulId = m[1].trim();
    if (!vulId || vulId === '0') continue;
    const rawLabel = stripHtmlTags(m[2]).trim();
    if (!rawLabel || /оберіть|виберіть/i.test(rawLabel)) continue;
    const candidateStatic =
      staticForSettlement.find((st) => normalizeStreetName(st.nameUk) === normalizeStreetName(rawLabel)) ||
      staticForSettlement.find((st) => st.ztoeVulicaId === vulId);
    const staticMatch = candidateStatic && !seenIds.has(candidateStatic.id) ? candidateStatic : undefined;
    const opt: ZtoeStreetOption = {
      id: staticMatch?.id || `st_${vulId}`,
      settlementId,
      ztoeVulicaId: vulId,
      poweronStreetId: staticMatch?.poweronStreetId,
      nameUk: staticMatch?.nameUk || rawLabel,
      nameEn: staticMatch?.nameEn || rawLabel,
    };
    if (!seenIds.has(opt.id)) {
      seenIds.add(opt.id);
      results.push(opt);
    }
  }
  return results;
}

/**
 * Parses a settlement-wide ZTOE response (`rem_id=X&naspunkt_id=Y&all=1`) and indexes
 * ALL houses for EVERY street in that settlement in a single pass so selecting any street
 * in the dropdown opens its complete house list in 0ms without additional network requests.
 *
 * Also supports a 1-argument `parseZtoeSettlementHousesTableHtml(html)` call returning
 * a `Map<string, ZtoeHouseLookupResult[]>` keyed by lowercased street name.
 */
export function parseZtoeSettlementHousesTableHtml(
  html: string
): Map<string, ZtoeHouseLookupResult[]>;
export function parseZtoeSettlementHousesTableHtml(
  settlementId: string,
  streets: ZtoeStreetOption[],
  html: string
): Record<string, ZtoeHouseLookupResult[]>;
export function parseZtoeSettlementHousesTableHtml(
  settlementIdOrHtml: string,
  streets?: ZtoeStreetOption[],
  maybeHtml?: string
): Map<string, ZtoeHouseLookupResult[]> | Record<string, ZtoeHouseLookupResult[]> {
  // Single-argument overload: returns Map<streetNameLower, ZtoeHouseLookupResult[]>
  if (streets === undefined && maybeHtml === undefined) {
    const html = settlementIdOrHtml;
    const streetMap = new Map<string, ZtoeHouseLookupResult[]>();
    if (!html || typeof html !== 'string') return streetMap;

    const scheduleSectionIdx = html.indexOf('Графіки погодинних відключень');
    const addressSectionHtml = scheduleSectionIdx >= 0 ? html.slice(0, scheduleSectionIdx) : html;
    const trRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let trMatch: RegExpExecArray | null;

    let streetColIdx = 2;
    let houseColIdx = 3;
    let queueColIdx = 4;
    let subqueueColIdx = 5;
    let noteColIdx = 6;
    const metadataCols = new Set<number>([0, 1, 2, 6]);

    while ((trMatch = trRegex.exec(addressSectionHtml)) !== null) {
      const rowHtml = trMatch[1];
      if (/<input\b/i.test(rowHtml) || /<select\b/i.test(rowHtml)) continue;
      const cellRegex = /<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
      const cells: string[] = [];
      let cellMatch: RegExpExecArray | null;
      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        cells.push(stripHtmlTags(cellMatch[1]));
      }
      if (cells.length < 5) continue;

      const firstCellLower = (cells[0] || '').toLowerCase();
      const isHeaderRow =
        /<th\b/i.test(rowHtml) ||
        firstCellLower === 'рем' ||
        firstCellLower === 'будинок' ||
        firstCellLower === 'будинки' ||
        firstCellLower.includes('вулиц');

      if (isHeaderRow) {
        metadataCols.clear();
        noteColIdx = -1;
        cells.forEach((c, idx) => {
          const cl = c.toLowerCase();
          if (cl.includes('вулиц')) {
            streetColIdx = idx;
            metadataCols.add(idx);
          } else if (cl.includes('буд') || cl.includes('дом')) {
            houseColIdx = idx;
          } else if (cl.includes('підчерг')) {
            subqueueColIdx = idx;
          } else if (cl.includes('черг')) {
            queueColIdx = idx;
          } else if (cl.includes('примітк')) {
            noteColIdx = idx;
            metadataCols.add(idx);
          } else if (cl === 'рем' || cl.includes('населений')) {
            metadataCols.add(idx);
          }
        });
        continue;
      }

      const streetRaw = decodeHtmlEntities(cells[streetColIdx] || '').trim();
      const houseVal = decodeHtmlEntities(cells[houseColIdx] || '').trim();
      if (!streetRaw || !houseVal) continue;

      const queueRaw = cells[queueColIdx] ?? '';
      const subqueueRaw = cells[subqueueColIdx] ?? '';
      const combinedMatch = `${queueRaw}.${subqueueRaw}`.match(/^([1-6])\.([1-2])$/);
      const directMatch = queueRaw.match(/^([1-6])\.([1-2])$/);
      let normalizedQueue = '';
      let statusText: string | undefined;

      if (directMatch) {
        normalizedQueue = `${directMatch[1]}.${directMatch[2]}`;
      } else if (combinedMatch) {
        normalizedQueue = `${combinedMatch[1]}.${combinedMatch[2]}`;
      }

      const uniqueNonNumericParts: string[] = [];
      cells.forEach((cellVal, idx) => {
        if (idx === houseColIdx || metadataCols.has(idx) || idx === noteColIdx) return;
        const trimmed = cellVal.trim();
        if (trimmed.length > 0 && !/^[1-6](\.[1-2])?$/.test(trimmed) && trimmed !== '-') {
          if (!uniqueNonNumericParts.includes(trimmed)) {
            uniqueNonNumericParts.push(trimmed);
          }
        }
      });

      if (uniqueNonNumericParts.length > 0) {
        statusText = uniqueNonNumericParts.join(' ').trim();
      }

      const key = streetRaw.toLowerCase();
      const list = streetMap.get(key) || [];
      const houseTokens = houseVal.includes(',')
        ? houseVal.split(',').map((h) => h.trim()).filter(Boolean)
        : [houseVal.trim()];

      for (const hToken of houseTokens) {
        if (!list.some((item) => item.house === hToken)) {
          list.push({
            house: hToken,
            queue: normalizedQueue,
            rawQueueCell: queueRaw,
            rawSubqueueCell: subqueueRaw,
            ...(statusText ? { statusText } : {}),
          });
        }
      }
      streetMap.set(key, list);
    }

    return streetMap;
  }

  // 3-argument overload: indexes into dynamicHousesByStreetId by streetId
  const settlementId = settlementIdOrHtml;
  const html = maybeHtml || '';
  const indexedByStreetId: Record<string, ZtoeHouseLookupResult[]> = {};
  if (!html || !streets || streets.length === 0) return indexedByStreetId;

  const streetIdsByNormName = new Map<string, string[]>();
  const addStreetMapping = (key: string, id: string) => {
    if (!key || !id) return;
    const arr = streetIdsByNormName.get(key) || [];
    if (!arr.includes(id)) {
      arr.push(id);
      streetIdsByNormName.set(key, arr);
    }
  };
  for (const st of streets) {
    addStreetMapping(st.nameUk.trim().toLowerCase(), st.id);
    addStreetMapping(normalizeStreetName(st.nameUk), st.id);
  }
  for (const st of ZTOE_STREET_OPTIONS.filter((s) => s.settlementId === settlementId)) {
    addStreetMapping(st.nameUk.trim().toLowerCase(), st.id);
    addStreetMapping(normalizeStreetName(st.nameUk), st.id);
  }

  const scheduleSectionIdx = html.indexOf('Графіки погодинних відключень');
  const addressSectionHtml = scheduleSectionIdx >= 0 ? html.slice(0, scheduleSectionIdx) : html;

  const trRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;

  let streetColIdx = 2;
  let houseColIdx = 3;
  let queueColIdx = 4;
  let subqueueColIdx = 5;
  let noteColIdx = 6;
  const metadataCols = new Set<number>([0, 1, 2, 6]);

  const mergedMapsByStreet = new Map<string, Map<string, ZtoeHouseLookupResult>>();

  while ((trMatch = trRegex.exec(addressSectionHtml)) !== null) {
    const rowHtml = trMatch[1];
    if (/<input\b/i.test(rowHtml) || /<select\b/i.test(rowHtml)) continue;

    const cellRegex = /<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      cells.push(stripHtmlTags(cellMatch[1]));
    }

    if (cells.length < 5) continue;

    const firstCellLower = (cells[0] || '').toLowerCase();
    const isHeaderRow =
      /<th\b/i.test(rowHtml) ||
      firstCellLower === 'рем' ||
      firstCellLower === 'будинок' ||
      firstCellLower === 'будинки' ||
      firstCellLower.includes('вулиц');

    if (isHeaderRow) {
      metadataCols.clear();
      noteColIdx = -1;
      cells.forEach((c, idx) => {
        const cl = c.toLowerCase();
        if (cl.includes('вулиц')) {
          streetColIdx = idx;
          metadataCols.add(idx);
        } else if (cl.includes('буд') || cl.includes('дом')) {
          houseColIdx = idx;
        } else if (cl.includes('підчерг')) {
          subqueueColIdx = idx;
        } else if (cl.includes('черг')) {
          queueColIdx = idx;
        } else if (cl.includes('примітк')) {
          noteColIdx = idx;
          metadataCols.add(idx);
        } else if (cl === 'рем' || cl.includes('населений')) {
          metadataCols.add(idx);
        }
      });
      continue;
    }

    const streetRaw = (cells[streetColIdx] || '').trim();
    const houseVal = (cells[houseColIdx] || '').trim();
    if (!streetRaw || !houseVal) continue;

    const matchedStreetIds =
      streetIdsByNormName.get(normalizeStreetName(streetRaw)) ||
      streetIdsByNormName.get(streetRaw.toLowerCase());
    if (!matchedStreetIds || matchedStreetIds.length === 0) continue;

    const queueRaw = cells[queueColIdx] ?? '';
    const subqueueRaw = cells[subqueueColIdx] ?? '';

    const combinedMatch = `${queueRaw}.${subqueueRaw}`.match(/^([1-6])\.([1-2])$/);
    const directMatch = queueRaw.match(/^([1-6])\.([1-2])$/);

    let normalizedQueue = '';
    let statusText: string | undefined;

    if (directMatch) {
      normalizedQueue = `${directMatch[1]}.${directMatch[2]}`;
    } else if (combinedMatch) {
      normalizedQueue = `${combinedMatch[1]}.${combinedMatch[2]}`;
    }

    const uniqueNonNumericParts: string[] = [];
    cells.forEach((cellVal, idx) => {
      if (idx === houseColIdx || metadataCols.has(idx) || idx === noteColIdx) return;
      const trimmed = cellVal.trim();
      if (trimmed.length > 0 && !/^[1-6](\.[1-2])?$/.test(trimmed) && trimmed !== '-') {
        if (!uniqueNonNumericParts.includes(trimmed)) {
          uniqueNonNumericParts.push(trimmed);
        }
      }
    });

    if (uniqueNonNumericParts.length > 0) {
      statusText = uniqueNonNumericParts.join(' ').trim();
    }

    const houseTokens = houseVal.includes(',')
      ? houseVal.split(',').map((h) => h.trim()).filter(Boolean)
      : [houseVal.trim()];

    for (const streetId of matchedStreetIds) {
      let streetHouseMap = mergedMapsByStreet.get(streetId);
      if (!streetHouseMap) {
        streetHouseMap = new Map<string, ZtoeHouseLookupResult>();
        mergedMapsByStreet.set(streetId, streetHouseMap);
      }

      for (const hToken of houseTokens) {
        const key = hToken.toLowerCase();
        if (!key) continue;
        const existing = streetHouseMap.get(key);
        if (!existing || (!existing.queue && normalizedQueue)) {
          streetHouseMap.set(key, {
            house: hToken,
            queue: normalizedQueue,
            rawQueueCell: queueRaw,
            rawSubqueueCell: subqueueRaw,
            statusText,
          });
        }
      }
    }
  }

  const now = Date.now();
  for (const [streetId, mergedMap] of mergedMapsByStreet.entries()) {
    const prevHouses = dynamicHousesByStreetId[streetId];
    if (Array.isArray(prevHouses)) {
      for (const prevH of prevHouses) {
        if (prevH.emergencyOutage && isValidEmergencyOutage(prevH.emergencyOutage)) {
          const k = prevH.house.trim().toLowerCase();
          const cur = mergedMap.get(k);
          if (cur && !cur.emergencyOutage) {
            mergedMap.set(k, { ...cur, emergencyOutage: prevH.emergencyOutage });
          }
        }
      }
    }
    applyCanonicalStreetOverrides(streetId, mergedMap);
    const sorted = sortHouseLookupResults(mergedMap.values());
    if (sorted.length > 0) {
      indexedByStreetId[streetId] = sorted;
      dynamicHousesByStreetId[streetId] = sorted;
      houseCacheUpdatedAtByStreetId[streetId] = now;
    }
  }

  return indexedByStreetId;
}

async function postZtoeLookupForm(bodyParams: Record<string, string>, siteUrl?: string): Promise<string | null> {
  if (typeof fetch === 'undefined') return null;
  try {
    const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
    const targetEndpoint =
      !siteUrl || siteUrl.includes('ztoe.com.ua')
        ? isBrowser
          ? '/proxy-ztoe/unhooking-search.php'
          : 'https://www.ztoe.com.ua/unhooking-search.php'
        : siteUrl;
    const params = new URLSearchParams(bodyParams);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(targetEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const win1251Text = new TextDecoder('windows-1251').decode(buffer);
    return win1251Text.includes('Оберіть') || win1251Text.includes('Черга') || win1251Text.includes('Будинки')
      ? win1251Text
      : new TextDecoder('utf-8').decode(buffer);
  } catch {
    return null;
  }
}

export async function fetchRemsFromZtoe(
  siteUrl?: string,
  forceRefresh = false
): Promise<ZtoeRemOption[]> {
  ensureHydrated();
  if (!forceRefresh && dynamicRems && dynamicRems.length > 0) {
    return dynamicRems;
  }
  const html = await postZtoeLookupForm({}, siteUrl);
  if (html) {
    const parsed = parseZtoeRemOptionsHtml(html);
    if (parsed.length > 0) {
      dynamicRems = parsed;
      persistAddressIndexToStorage();
      return parsed;
    }
  }
  return getRems();
}

export async function fetchSettlementsForRem(
  remId: string,
  siteUrl?: string,
  forceRefresh = false
): Promise<ZtoeSettlementOption[]> {
  ensureHydrated();
  if (!forceRefresh && dynamicSettlementsByRemId[remId] && dynamicSettlementsByRemId[remId].length > 5) {
    return dynamicSettlementsByRemId[remId];
  }
  const remObj = getRems().find((r) => r.id === remId);
  if (remObj?.ztoeRemId) {
    const html = await postZtoeLookupForm({ rem_id: remObj.ztoeRemId }, siteUrl);
    if (html) {
      const parsedRems = parseZtoeRemOptionsHtml(html);
      if (parsedRems.length > 0) {
        dynamicRems = parsedRems;
      }
      const parsed = parseZtoeSettlementOptionsHtml(remId, html);
      if (parsed.length > 0) {
        dynamicSettlementsByRemId[remId] = parsed;
        persistAddressIndexToStorage();
        return parsed;
      }
    }
  }
  return getSettlementsForRem(remId);
}

export async function fetchStreetsForSettlement(
  remId: string,
  settlementId: string,
  siteUrl?: string,
  forceRefresh = false
): Promise<ZtoeStreetOption[]> {
  ensureHydrated();
  const cachedStreets = dynamicStreetsBySettlementId[settlementId];
  const hasBulkIndexedHouses =
    cachedStreets &&
    cachedStreets.length > 15 &&
    cachedStreets.some((st) => st.id !== 'zt_kyivska' && (dynamicHousesByStreetId[st.id]?.length || 0) > 0);

  if (!forceRefresh && hasBulkIndexedHouses) {
    await fetchPwAccidentsForScope(remId, settlementId);
    return cachedStreets;
  }

  const inflightKey = `${remId}::${settlementId}`;
  const existingPromise = inFlightSettlementPromises.get(inflightKey);
  if (existingPromise) {
    return existingPromise;
  }

  const promise = (async () => {
    try {
      const remObj =
        getRems().find((r) => r.id === remId) ||
        ZTOE_REM_OPTIONS.find((r) => r.id === remId);
      const settlementObj = findSettlementById(settlementId);
      if (remObj?.ztoeRemId && settlementObj?.ztoeNaspunktId) {
        const html = await postZtoeLookupForm(
          {
            rem_id: remObj.ztoeRemId,
            naspunkt_id: settlementObj.ztoeNaspunktId,
            all: '1',
          },
          siteUrl
        );
        if (html) {
          const parsedRems = parseZtoeRemOptionsHtml(html);
          if (parsedRems.length > 0) {
            dynamicRems = parsedRems;
          }
          const parsedSettlements = parseZtoeSettlementOptionsHtml(remId, html);
          if (parsedSettlements.length > 0) {
            dynamicSettlementsByRemId[remId] = parsedSettlements;
          }
          const parsedStreets = parseZtoeStreetOptionsHtml(settlementId, html);
          if (parsedStreets.length > 0) {
            dynamicStreetsBySettlementId[settlementId] = parsedStreets;
            parseZtoeSettlementHousesTableHtml(settlementId, parsedStreets, html);
            await fetchPwAccidentsForScope(remId, settlementId);
            persistAddressIndexToStorage();
            return parsedStreets;
          }
        }
      }
      await fetchPwAccidentsForScope(remId, settlementId);
      return getStreetsForSettlement(settlementId);
    } finally {
      inFlightSettlementPromises.delete(inflightKey);
    }
  })();

  inFlightSettlementPromises.set(inflightKey, promise);
  return promise;
}

export async function fetchHousesForStreet(
  remId: string,
  settlementId: string,
  streetId: string,
  siteUrl?: string,
  forceRefresh = false
): Promise<ZtoeHouseLookupResult[]> {
  ensureHydrated();
  if (!streetId) return [];

  const existingHouses = dynamicHousesByStreetId[streetId];
  const updatedAt = houseCacheUpdatedAtByStreetId[streetId] || 0;
  if (
    existingHouses &&
    existingHouses.length > 0 &&
    (!forceRefresh || Date.now() - updatedAt < FRESH_HOUSE_CACHE_TTL_MS)
  ) {
    recordRecentHouseStreet(streetId);
    await fetchPwAccidentsForScope(remId, settlementId);
    return dynamicHousesByStreetId[streetId] || existingHouses;
  }

  const inflightKey = `${remId}::${settlementId}`;
  const inflightSettlement = inFlightSettlementPromises.get(inflightKey);
  if (inflightSettlement) {
    await inflightSettlement;
    await fetchPwAccidentsForScope(remId, settlementId);
    const afterInflight = dynamicHousesByStreetId[streetId];
    if (afterInflight && afterInflight.length > 0) {
      recordRecentHouseStreet(streetId);
      return afterInflight;
    }
  }

  const remObj =
    getRems().find((r) => r.id === remId) ||
    ZTOE_REM_OPTIONS.find((r) => r.id === remId);
  const settlementObj = findSettlementById(settlementId);
  const streetObj = findStreetById(streetId);
  if (remObj?.ztoeRemId && settlementObj?.ztoeNaspunktId && streetObj?.ztoeVulicaId) {
    // Note: Do NOT pass `all: '1'` when `vulica_id` is specified, because `all=1` causes ZTOE
    // to ignore `vulica_id` and return all streets in the settlement instead of the selected street.
    const html = await postZtoeLookupForm(
      {
        rem_id: remObj.ztoeRemId,
        naspunkt_id: settlementObj.ztoeNaspunktId,
        vulica_id: streetObj.ztoeVulicaId,
      },
      siteUrl
    );
    if (html) {
      const parsedRows = parseZtoeAddressLookupTableHtml(html, streetObj.nameUk);
      if (parsedRows.length > 0) {
        const mergedMap = new Map<string, ZtoeHouseLookupResult>();
        for (const row of parsedRows) {
          const key = row.house.trim().toLowerCase();
          if (!key) continue;
          const existing = mergedMap.get(key);
          if (!existing || (!existing.queue && row.queue)) {
            mergedMap.set(key, row);
          }
        }
        applyCanonicalStreetOverrides(streetId, mergedMap);
        const sortedList = sortHouseLookupResults(mergedMap.values());
        dynamicHousesByStreetId[streetId] = sortedList;
        houseCacheUpdatedAtByStreetId[streetId] = Date.now();
        recordRecentHouseStreet(streetId);
        await fetchPwAccidentsForScope(remId, settlementId);
        persistAddressIndexToStorage();
        return dynamicHousesByStreetId[streetId] || sortedList;
      }
    }
  }
  await fetchPwAccidentsForScope(remId, settlementId);
  return getHousesForStreet(streetId);
}

/**
 * Prefetches and indexes all REMs, cities/settlements across all REMs, active/default city streets,
 * and ALL houses for every street in the active/default city in the background on app launch,
 * persisting the index to disk cache so dropdown lists in the "?" Address Lookup window open with zero delay.
 */
export async function prefetchAddressIndexInBackground(
  siteUrl?: string,
  savedQuery?: SelectedAddressQuery | null,
  forceRefresh = false
): Promise<void> {
  ensureHydrated();
  const activeRemId = savedQuery?.remId || 'zhytomyr';
  const activeSettlementId = savedQuery?.settlementId || 'zt_city';

  // Priority 1: Single-request bulk fetch for 'zt_city' (with all=1), which returns and indexes:
  // - All 19 REMs (<select name="rem_id">)
  // - All 103 Settlements of Zhytomyr REM (<select name="naspunkt_id">)
  // - All 966 Streets of Zhytomyr city (<select name="vulica_id">)
  // - All 20,488 Houses across all 966 Streets of Zhytomyr city (7-column table)
  await fetchStreetsForSettlement('zhytomyr', 'zt_city', siteUrl, forceRefresh);

  if (activeRemId !== 'zhytomyr') {
    await fetchSettlementsForRem(activeRemId, siteUrl, forceRefresh);
  }

  if (activeSettlementId && (activeRemId !== 'zhytomyr' || activeSettlementId !== 'zt_city')) {
    await fetchStreetsForSettlement(activeRemId, activeSettlementId, siteUrl, forceRefresh);
  }

  if (savedQuery?.streetId) {
    await fetchHousesForStreet(activeRemId, activeSettlementId, savedQuery.streetId, siteUrl, false);
  }

  const allRems = await fetchRemsFromZtoe(siteUrl, false);
  const priorityRems = Array.from(new Set(['zhytomyr', activeRemId]));

  // Priority 2: Bounded parallel prefetch (4 workers) for all remaining REMs' settlements + each REM's primary city streets & houses
  const remainingRems = allRems.filter((r) => !priorityRems.includes(r.id));
  const concurrency = 4;
  let cursor = 0;

  const runWorker = async () => {
    while (cursor < remainingRems.length) {
      const idx = cursor++;
      const rem = remainingRems[idx];
      if (!rem) break;
      const settlements = await fetchSettlementsForRem(rem.id, siteUrl, forceRefresh);
      const primarySettlement = settlements[0];
      if (primarySettlement?.id) {
        await fetchStreetsForSettlement(rem.id, primarySettlement.id, siteUrl, false);
      }
    }
  };

  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(1, remainingRems.length)) },
    () => runWorker()
  );
  await Promise.all(workers);

  persistAddressIndexToStorage();
}
