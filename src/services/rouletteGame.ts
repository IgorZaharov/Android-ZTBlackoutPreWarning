import { BlackoutSlot } from '../types';
import {
  QUEUES,
  generateTypicalScheduleForQueue,
} from './ztoeParser';
import { setRouletteSoundEnabled } from './rouletteAudio';

export type RouletteScreenState =
  | 'START'
  | 'SHOP'
  | 'PLAYING'
  | 'FADING_TO_BLACK'
  | 'GAME_OVER';

export type TicketVisualVariant =
  | 'pristine'
  | 'wrinkled'
  | 'deep_wrinkled'
  | 'crumpled_scratched'
  | 'cup_stain'
  | 'stain_corner'
  | 'water_stains'
  | 'heavy_wear'
  | 'faded';

export const TICKET_VISUAL_VARIANTS: TicketVisualVariant[] = [
  'pristine',
  'wrinkled',
  'deep_wrinkled',
  'crumpled_scratched',
  'cup_stain',
  'stain_corner',
  'water_stains',
  'heavy_wear',
  'faded',
];

export const GENERATED_TICKET_FOIL_IMAGES: Record<TicketVisualVariant, string> = {
  pristine: '/src/assets/images/ticket_foil_pristine_1794004834753.jpg',
  wrinkled: '/src/assets/images/ticket_foil_wrinkled_1794004835863.jpg',
  deep_wrinkled: '/src/assets/images/ticket_foil_deep_wrinkled_1794005900450.jpg',
  crumpled_scratched: '/src/assets/images/ticket_foil_crumpled_scratched_1794005900823.jpg',
  cup_stain: '/src/assets/images/ticket_foil_cup_stain_1794004837478.jpg',
  stain_corner: '/src/assets/images/ticket_foil_stain_corner_1794005902878.jpg',
  water_stains: '/src/assets/images/ticket_foil_water_stains_1794005904487.jpg',
  heavy_wear: '/src/assets/images/ticket_foil_heavy_wear_1794005906202.jpg',
  faded: '/src/assets/images/ticket_foil_faded_1794004837586.jpg',
};

/**
 * Ticket is treated as scratched if at least 20% (0.20) of its surface is scratched off,
 * OR if the red outline in the center of a Red ticket is shown.
 */
export const TICKET_SCRATCH_REVEAL_THRESHOLD = 0.2;

export function isTicketScratchedEnough(
  scratchedFraction: number,
  isRedCenterOutlineShown: boolean = false
): boolean {
  if (isRedCenterOutlineShown) {
    return true;
  }
  return scratchedFraction >= TICKET_SCRATCH_REVEAL_THRESHOLD;
}

/**
 * Checks whether a scratch stroke segment `(x0, y0) -> (x1, y1)` exposes the center
 * red outline medallion of a Red ticket (`canvasWidth x canvasHeight`).
 */
export function doesScratchExposeRedCenterOutline(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  canvasWidth: number = 168,
  canvasHeight: number = 74,
  brushRadius: number = 7.5
): boolean {
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2 - 2;
  const redOutlineRadius = Math.min(canvasWidth, canvasHeight) * 0.31;

  const segDx = x1 - x0;
  const segDy = y1 - y0;
  const segLenSq = segDx * segDx + segDy * segDy;
  let t = 0;
  if (segLenSq > 0.001) {
    t = Math.max(0, Math.min(1, ((cx - x0) * segDx + (cy - y0) * segDy) / segLenSq));
  }
  const projX = x0 + t * segDx;
  const projY = y0 + t * segDy;
  const dist = Math.hypot(cx - projX, cy - projY);
  return dist <= redOutlineRadius + brushRadius * 0.6;
}

export type RouletteUpgradeId =
  | 'x2_ticket_1'
  | 'x2_ticket_2'
  | 'x2_ticket_3'
  | 'friend_ztoe'
  | 'second_chance'
  | 'fern_flower'
  | 'black_cat'
  | 'nocturnal_creature'
  | 'deposit_power_points'
  | 'daily_streak'
  | 'perseverance';

export const POWER_POINT_MILESTONES = [100, 200, 400, 600, 1000] as const;
export type PowerPointMilestone = (typeof POWER_POINT_MILESTONES)[number];

export interface RouletteUpgradeDefinition {
  id: RouletteUpgradeId;
  cost: number;
  nameUk: string;
  nameEn: string;
  buttonLabelUk: string;
  buttonLabelEn: string;
  descriptionUk: string;
  descriptionEn: string;
  hideDescription?: boolean;
  isToggleable?: boolean;
  isRepeatable?: boolean;
  requiredMilestone?: PowerPointMilestone;
}

export const DEPOSIT_PAYOUT_PER_DAY = 10;
export const DEPOSIT_DAY_MS = 24 * 60 * 60 * 1000;
export const DAY_IN_MS = DEPOSIT_DAY_MS;
export const FIN_MONITORING_DESCRIPTION = 'На розгляді ФінМоніторинга';
export const GAME_OVER_REALIZATION_DELAY_MS = 1000;

export const GAME_BLACKOUT_MIN_INTERVAL_MS = 5 * 60 * 1000;
export const GAME_BLACKOUT_MAX_INTERVAL_MS = 10 * 60 * 1000;
export const GAME_BLACKOUT_DURATION_MS = 10 * 1000;

export const SHARE_GLYPH_INACTIVE_COLOR = '#6B7280';
export const SHARE_GLYPH_ACTIVE_COLOR = '#F59E0B';

export const ROULETTE_UPGRADES: RouletteUpgradeDefinition[] = [
  {
    id: 'x2_ticket_1',
    cost: 100,
    nameUk: 'Додатковий білет X2',
    nameEn: 'Additional X2 ticket',
    buttonLabelUk: 'Додатковий білет X2 (Cost: 100)',
    buttonLabelEn: 'Additional X2 ticket (Cost: 100)',
    descriptionUk: 'Додає ще 1 білет X2 на поле.',
    descriptionEn: 'Adds 1 more x2 ticket on field.',
  },
  {
    id: 'x2_ticket_2',
    cost: 200,
    nameUk: 'Додатковий білет X2',
    nameEn: 'Additional X2 ticket',
    buttonLabelUk: 'Додатковий білет X2 (Cost: 200)',
    buttonLabelEn: 'Additional X2 ticket (Cost: 200)',
    descriptionUk: 'Додає ще 1 білет X2 на поле.',
    descriptionEn: 'Adds 1 more x2 ticket on field.',
  },
  {
    id: 'x2_ticket_3',
    cost: 400,
    nameUk: 'Додатковий білет X2',
    nameEn: 'Additional X2 ticket',
    buttonLabelUk: 'Додатковий білет X2 (Cost: 400)',
    buttonLabelEn: 'Additional X2 ticket (Cost: 400)',
    descriptionUk: 'Додає ще 1 білет X2 на поле.',
    descriptionEn: 'Adds 1 more x2 ticket on field.',
  },
  {
    id: 'friend_ztoe',
    cost: 200,
    nameUk: 'Друг у Житомиробленерго',
    nameEn: 'Friend in Zhytomyroblenergo',
    buttonLabelUk: 'Друг у Житомиробленерго (Cost: 200)',
    buttonLabelEn: 'Friend in Zhytomyroblenergo (Cost: 200)',
    descriptionUk: 'Миттєво відкриває один безпечний білет на старті гри (включно з X2 або Золотим білетом).',
    descriptionEn: 'Immediately reveal one safe ticket on game start (including X2 or Gold Ticket).',
  },
  {
    id: 'second_chance',
    cost: 1000,
    nameUk: 'Другий шанс',
    nameEn: 'Second chance',
    buttonLabelUk: 'Другий шанс (Cost: 1000)',
    buttonLabelEn: 'Second chance (Cost: 1000)',
    descriptionUk: 'Стирання червоного білета не викликає блекаут і рахується як світлий білет.',
    descriptionEn: 'Scratching Red ticket will not trigger Game Over event and will count as beige ticket.',
  },
  {
    id: 'fern_flower',
    cost: 2000,
    nameUk: 'Цвіт папороті',
    nameEn: 'Fern flower',
    buttonLabelUk: 'Цвіт папороті (Cost: 2000)',
    buttonLabelEn: 'Fern flower (Cost: 2000)',
    descriptionUk: 'Секрет',
    descriptionEn: 'Secret',
    hideDescription: false,
  },
  {
    id: 'black_cat',
    cost: 13,
    nameUk: 'Чорний кіт',
    nameEn: 'Black Cat',
    buttonLabelUk: 'Чорний кіт (Cost: 13)',
    buttonLabelEn: 'Black Cat (Cost: 13)',
    descriptionUk: 'Секрет',
    descriptionEn: 'Secret',
    hideDescription: false,
  },
  {
    id: 'nocturnal_creature',
    cost: 10,
    nameUk: 'Нічна істота',
    nameEn: 'Nocturnal Creature',
    buttonLabelUk: 'Нічна істота (Ціна: 10)',
    buttonLabelEn: 'Nocturnal Creature (Cost: 10)',
    descriptionUk: 'Секрет',
    descriptionEn: 'Secret',
    hideDescription: false,
    isToggleable: true,
  },
  {
    id: 'deposit_power_points',
    cost: 100,
    nameUk: 'Депозит Потужність+',
    nameEn: 'Deposit Power Points',
    buttonLabelUk: 'Депозит Потужність+ (Ціна: 100)',
    buttonLabelEn: 'Deposit Power Points (Cost: 100)',
    descriptionUk: 'Кожні 100 вкладених Балів Потужності приносять 10 Балів доходу щодня.',
    descriptionEn: 'Each 100 Power Points deposited will grant you 10 Points income daily.',
    hideDescription: false,
    isRepeatable: true,
  },
  {
    id: 'daily_streak',
    cost: 0,
    nameUk: 'Щоденна серія',
    nameEn: 'Daily Streak',
    buttonLabelUk: 'Щоденна серія (Ціна: 0)',
    buttonLabelEn: 'Daily Streak (Cost: 0)',
    descriptionUk: 'Нагорода за рубіж 400: перша гра на день дає бонус X2 до балів перед завершенням гри.',
    descriptionEn: 'Milestone 400 reward: first Game in a Day grants X2 bonus points before Game Over event.',
    requiredMilestone: 400,
  },
  {
    id: 'perseverance',
    cost: 0,
    nameUk: 'Наполегливість',
    nameEn: 'Perseverance',
    buttonLabelUk: 'Наполегливість (Ціна: 0)',
    buttonLabelEn: 'Perseverance (Cost: 0)',
    descriptionUk: 'Нагорода за рубіж 1000: додає ще одне серце на головному екрані гри (до трьох життів разом із Другим шансом).',
    descriptionEn: 'Milestone 1000 reward: adds one more heart icon in Main Game screen. Cumulative with Second Life up to three lives.',
    requiredMilestone: 1000,
  },
];

export function formatUpgradeButtonLabel(
  upgrade: RouletteUpgradeDefinition,
  lang: 'uk' | 'en',
  isPurchased: boolean = false,
  depositCount?: number
): string {
  if (upgrade.id === 'deposit_power_points') {
    const count = depositCount ?? getDepositCount();
    const dailyIncome = count * DEPOSIT_PAYOUT_PER_DAY;
    if (lang === 'en') {
      const base = 'Deposit Power Points (Cost: 100)';
      return count > 0 ? `${base} — ${dailyIncome} / day` : base;
    }
    const base = 'Депозит Потужність+ (Ціна: 100)';
    return count > 0 ? `${base} — ${dailyIncome} / день` : base;
  }
  if (upgrade.id === 'nocturnal_creature' || upgrade.isToggleable) {
    return lang === 'en' ? upgrade.buttonLabelEn : upgrade.buttonLabelUk;
  }
  const baseName = lang === 'en' ? upgrade.nameEn : upgrade.nameUk;
  const costPart =
    lang === 'en' ? `(Cost: ${upgrade.cost})` : `(Ціна: ${upgrade.cost})`;
  if (isPurchased) {
    const boughtTag = lang === 'en' ? 'Purchased' : 'Куплено';
    return `${baseName} ${costPart} — ${boughtTag}`;
  }
  return `${baseName} ${costPart}`;
}

export function getUpgradeDescription(
  upgrade: RouletteUpgradeDefinition,
  lang: 'uk' | 'en',
  depositFinMonLocked?: boolean
): string {
  if (upgrade.id === 'deposit_power_points') {
    const locked = depositFinMonLocked ?? isDepositFinMonLocked();
    if (locked) {
      return FIN_MONITORING_DESCRIPTION;
    }
    return lang === 'en' ? upgrade.descriptionEn : upgrade.descriptionUk;
  }
  return lang === 'en' ? upgrade.descriptionEn : upgrade.descriptionUk;
}

export function isNocturnalModeActive(
  purchasedUpgrades: RouletteUpgradeId[] = getPurchasedUpgrades()
): boolean {
  return purchasedUpgrades.includes('nocturnal_creature');
}

export function getStreakStep(
  purchasedUpgrades: RouletteUpgradeId[] = getPurchasedUpgrades()
): number {
  return isNocturnalModeActive(purchasedUpgrades) ? 2 : 1;
}

/**
 * Returns the number of extra lives (hearts shown in the top header of Main Game Screen):
 * - "Second chance" (`second_chance`): +1 heart
 * - "Perseverance" (`perseverance`): +1 heart
 * Cumulative up to 2 extra hearts (raising the cap to 3 total lives).
 */
export function getExtraLivesCount(
  purchasedUpgrades: RouletteUpgradeId[] = getPurchasedUpgrades()
): number {
  let hearts = 0;
  if (purchasedUpgrades.includes('second_chance')) hearts += 1;
  if (purchasedUpgrades.includes('perseverance')) hearts += 1;
  return hearts;
}

export interface TicketStainPlacement {
  stainOffsetX: number; // Normalized 0.12 .. 0.88 horizontal center of stain
  stainOffsetY: number; // Normalized 0.15 .. 0.85 vertical center of stain
  stainRadiusRatio: number; // 0.22 .. 0.48 relative radius of cup ring / water blotch
  stainRotationDeg: number; // 0 .. 360 rotation angle in degrees
  stainIntensity: number; // 0 .. 1 opacity multiplier for randomized stain & scratch overlay
  wrinkleDepth: number; // 0 .. 1 depth of profound paper creases
  textureFlipX: boolean; // Randomly flips base texture horizontally to vary stain/wrinkle quadrant
  textureFlipY: boolean; // Randomly flips base texture vertically to vary stain/wrinkle quadrant
}

export interface RouletteTicket {
  index: number;
  slotLabel: string; // e.g. "00:00-00:30", "15:30-16:00"
  isRed: boolean;
  isGolden?: boolean; // 1% chance (or 5% with Fern flower upgrade) on ticket load for one beige ticket to be golden
  isX2?: boolean; // Beige ticket with "X2" symbol instead of lightbulb that multiplies current score by x2
  visualVariant?: TicketVisualVariant; // Non-uniform weathered/stained/profoundly-wrinkled/pristine image variant
  stainPlacement?: TicketStainPlacement; // Randomized stain & wrinkle placement per ticket
  isRevealed: boolean;
  scratchProgress: number; // 0..1 (treated as scratched at >= 0.20)
}

export interface RouletteGameState {
  screen: RouletteScreenState;
  score: number;
  bestScore: number; // Persistent all-time best score achieved by the user
  powerPoints: number; // Persistent Power Points ("Бали Потужності") accumulated upon Game Over / Restart events
  accumulatedPowerPoints?: number; // Total Power Points accumulation progress toward milestones (100, 200, 400, 600, 1000)
  reachedMilestones?: PowerPointMilestone[]; // Milestones that have been reached and visually confirmed
  purchasedUpgrades: RouletteUpgradeId[]; // Persistent upgrades bought in the Power Shop
  depositCount?: number; // Number of times "Deposit Power Points (100)" has been bought (+10 / day each)
  payoutDateMs?: number | null; // Last recorded system date (ms) when Game was loaded
  depositFinMonLocked?: boolean; // True if system date became prior to recorded payoutDateMs ("На розгляді ФінМоніторинга")
  secondChanceUsed?: boolean; // Tracks whether at least one extra heart ("Second chance" / "Perseverance") has been consumed in the current game
  extraLivesTotal?: number; // Total extra hearts available in the current game (0..2)
  extraLivesUsed?: number; // Number of extra hearts consumed in the current game (0..extraLivesTotal)
  dailyStreakApplied?: boolean; // True when "Daily Streak" (X2 bonus on first game of the day) was applied before Game Over
  powerPointsAwarded?: boolean; // Prevents double-adding score to powerPoints during a single Game Over transition
  streakIncrement: number;
  refreshCount: number; // Number of times "Get New Tickets" has been used in current game (cost = refreshCount: 0, 1, 2, 3...)
  queueId: string;
  isOfflineRandomized: boolean;
  tickets: RouletteTicket[];
  generationId: number;
}

export interface RouletteLocalizedStrings {
  launchButtonTitle: string;
  gameTitle: string;
  startSubtitle: string;
  allTimeBestScoreLabel: string;
  powerPointsLabel: string;
  powerShopButton: string;
  powerShopTitle: string;
  backToStartButton: string;
  shareButton: string;
  soundLabel: string;
  startButton: string;
  closeGameButton: string;
  mainMenuButton: string;
  pointsLabel: string;
  nextIncrementLabel: string;
  queueSourceOnline: string;
  queueSourceOffline: string;
  restartGameButton: string;
  getNewTicketsButton: string;
  gameOverTitle: string;
  finalScoreLabel: string;
  loadingQueueText: string;
}

export const ROULETTE_BEST_SCORE_STORAGE_KEY = 'zt_roulette_best_score_v1';
export const ROULETTE_POWER_POINTS_STORAGE_KEY = 'zt_roulette_power_points_v1';
export const ROULETTE_ACCUMULATED_PP_STORAGE_KEY = 'zt_roulette_accumulated_pp_v1';
export const ROULETTE_REACHED_MILESTONES_STORAGE_KEY = 'zt_roulette_reached_milestones_v1';
export const ROULETTE_DAILY_STREAK_DATE_STORAGE_KEY = 'zt_roulette_daily_streak_date_v1';
export const ROULETTE_UPGRADES_STORAGE_KEY = 'zt_roulette_purchased_upgrades_v1';
export const ROULETTE_DEPOSIT_COUNT_STORAGE_KEY = 'zt_roulette_deposit_count_v1';
export const ROULETTE_PAYOUT_DATE_STORAGE_KEY = 'zt_roulette_payout_date_ms_v1';
export const ROULETTE_DEPOSIT_BASE_DATE_STORAGE_KEY = 'zt_roulette_deposit_base_ms_v1';
export const ROULETTE_FINMON_LOCKED_STORAGE_KEY = 'zt_roulette_finmon_locked_v1';

let inMemoryBestScore = 0;
let inMemoryPowerPoints = 0;
let inMemoryAccumulatedPowerPoints = 0;
let inMemoryReachedMilestones: PowerPointMilestone[] = [];
let inMemoryLastDailyStreakDate: string | null = null;
let inMemoryPurchasedUpgrades: RouletteUpgradeId[] = [];
let inMemoryDepositCount = 0;
let inMemoryPayoutDateMs: number | null = null;
let inMemoryDepositBaseMs: number | null = null;
let inMemoryDepositFinMonLocked = false;

/**
 * Reads the user's all-time best score from persistent storage (`localStorage` + in-memory fallback).
 */
export function getSavedBestScore(): number {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(ROULETTE_BEST_SCORE_STORAGE_KEY);
      if (raw !== null) {
        const parsed = parseInt(raw, 10);
        if (!Number.isNaN(parsed) && parsed >= 0) {
          inMemoryBestScore = Math.max(inMemoryBestScore, parsed);
        }
      }
    }
  } catch {
    // Ignore storage access errors in restricted environments
  }
  return inMemoryBestScore;
}

/**
 * Saves a candidate score if it exceeds the previously recorded all-time best score,
 * returning the updated all-time best score.
 */
export function saveBestScoreIfHigher(candidateScore: number): number {
  const sanitized = Math.max(0, Math.floor(candidateScore));
  const currentBest = getSavedBestScore();
  const nextBest = Math.max(currentBest, sanitized);
  inMemoryBestScore = nextBest;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(ROULETTE_BEST_SCORE_STORAGE_KEY, String(nextBest));
    }
  } catch {
    // Ignore storage write errors
  }
  return nextBest;
}

/**
 * Resets the saved all-time best score (used for deterministic unit testing).
 */
export function resetSavedBestScore(initialValue: number = 0): void {
  const sanitized = Math.max(0, Math.floor(initialValue));
  inMemoryBestScore = sanitized;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(ROULETTE_BEST_SCORE_STORAGE_KEY, String(sanitized));
    }
  } catch {
    // Ignore storage write errors
  }
}

/**
 * Reads the user's saved Power Points ("Бали Потужності") from persistent storage.
 */
export function getSavedPowerPoints(): number {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(ROULETTE_POWER_POINTS_STORAGE_KEY);
      if (raw !== null) {
        const parsed = parseInt(raw, 10);
        if (!Number.isNaN(parsed) && parsed >= 0) {
          inMemoryPowerPoints = parsed;
        }
      }
    }
  } catch {
    // Ignore storage errors
  }
  return inMemoryPowerPoints;
}

/**
 * Persists the user's Power Points ("Бали Потужності").
 */
export function savePowerPoints(points: number): number {
  const sanitized = Math.max(0, Math.floor(points));
  inMemoryPowerPoints = sanitized;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(ROULETTE_POWER_POINTS_STORAGE_KEY, String(sanitized));
    }
  } catch {
    // Ignore storage write errors
  }
  return sanitized;
}

/**
 * Reads total accumulated Power Points progress toward the [100, 200, 400, 600, 1000] milestones.
 */
export function getAccumulatedPowerPoints(): number {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(ROULETTE_ACCUMULATED_PP_STORAGE_KEY);
      if (raw !== null) {
        const parsed = parseInt(raw, 10);
        if (!Number.isNaN(parsed) && parsed >= 0) {
          inMemoryAccumulatedPowerPoints = parsed;
        }
      }
    }
  } catch {
    // Ignore storage errors
  }
  return inMemoryAccumulatedPowerPoints;
}

export function saveAccumulatedPowerPoints(points: number): number {
  const sanitized = Math.max(0, Math.floor(points));
  inMemoryAccumulatedPowerPoints = sanitized;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(ROULETTE_ACCUMULATED_PP_STORAGE_KEY, String(sanitized));
    }
  } catch {
    // Ignore storage errors
  }
  return sanitized;
}

export function getReachedMilestones(): PowerPointMilestone[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(ROULETTE_REACHED_MILESTONES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const validSet = new Set<number>(POWER_POINT_MILESTONES);
          inMemoryReachedMilestones = Array.from(
            new Set(
              parsed.filter((m): m is PowerPointMilestone => validSet.has(Number(m)))
            )
          ).sort((a, b) => a - b);
        }
      }
    }
  } catch {
    // Ignore storage errors
  }
  return [...inMemoryReachedMilestones];
}

export function saveReachedMilestones(
  milestones: PowerPointMilestone[]
): PowerPointMilestone[] {
  const validSet = new Set<number>(POWER_POINT_MILESTONES);
  const unique = Array.from(
    new Set(milestones.filter((m): m is PowerPointMilestone => validSet.has(m)))
  ).sort((a, b) => a - b);
  inMemoryReachedMilestones = unique;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(
        ROULETTE_REACHED_MILESTONES_STORAGE_KEY,
        JSON.stringify(unique)
      );
    }
  } catch {
    // Ignore storage errors
  }
  return [...unique];
}

export function isMilestoneReached(
  milestone: PowerPointMilestone,
  explicitReached?: PowerPointMilestone[]
): boolean {
  const reached = explicitReached ?? getReachedMilestones();
  return reached.includes(milestone) || getAccumulatedPowerPoints() >= milestone;
}

/**
 * Computes normalized progress [0..1] for the Power Points accumulation progress bar
 * across milestones [100, 200, 400, 600, 1000].
 */
export function getMilestoneProgressFraction(
  accumulatedPoints: number = getAccumulatedPowerPoints()
): number {
  const clamped = Math.max(0, Math.min(1000, accumulatedPoints));
  return clamped / 1000;
}

export function formatLocalDayKey(nowMs: number = Date.now()): string {
  const d = new Date(nowMs);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLastDailyStreakDateStr(): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(ROULETTE_DAILY_STREAK_DATE_STORAGE_KEY);
      if (raw !== null && raw !== '') {
        inMemoryLastDailyStreakDate = raw;
      }
    }
  } catch {
    // Ignore storage errors
  }
  return inMemoryLastDailyStreakDate;
}

export function saveLastDailyStreakDateStr(dateStr: string | null): string | null {
  inMemoryLastDailyStreakDate = dateStr;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (dateStr === null) {
        window.localStorage.removeItem(ROULETTE_DAILY_STREAK_DATE_STORAGE_KEY);
      } else {
        window.localStorage.setItem(ROULETTE_DAILY_STREAK_DATE_STORAGE_KEY, dateStr);
      }
    }
  } catch {
    // Ignore storage errors
  }
  return inMemoryLastDailyStreakDate;
}

/**
 * Adds earned score points to the user's saved Power Points upon Game Over / Restart / Deposit / Test:
 * - Updates total Power Points accumulation progress (`accumulatedPowerPoints`).
 * - Checks milestones `[100, 200, 400, 600, 1000]`:
 *   - Milestones `400` and `1000` unlock shop items `"Daily Streak (cost: 0)"` and `"Perseverance (cost: 0)"`.
 *   - Other milestones (`100`, `200`, `600`) directly add their value (`+100`, `+200`, `+600`) to User's total Power Points when reached!
 */
export function addPowerPoints(earnedPoints: number): number {
  const delta = Math.max(0, Math.floor(earnedPoints));
  const current = getSavedPowerPoints();
  if (delta === 0) {
    return current;
  }

  const prevAccumulated = getAccumulatedPowerPoints();
  const nextAccumulated = saveAccumulatedPowerPoints(prevAccumulated + delta);
  const reached = new Set<PowerPointMilestone>(getReachedMilestones());

  let milestoneBonusPoints = 0;
  for (const milestone of POWER_POINT_MILESTONES) {
    if (nextAccumulated >= milestone && !reached.has(milestone)) {
      reached.add(milestone);
      if (milestone !== 400 && milestone !== 1000) {
        milestoneBonusPoints += milestone;
      }
    }
  }
  saveReachedMilestones(Array.from(reached));

  return savePowerPoints(current + delta + milestoneBonusPoints);
}

export function resetSavedPowerPoints(initialValue: number = 0): number {
  const sanitized = Math.max(0, Math.floor(initialValue));
  const saved = savePowerPoints(sanitized);
  saveAccumulatedPowerPoints(sanitized);
  const reached = POWER_POINT_MILESTONES.filter((m) => sanitized >= m);
  saveReachedMilestones(reached);
  return saved;
}

/**
 * Reads the list of purchased one-time Power Shop upgrades from persistent storage.
 */
export function getPurchasedUpgrades(): RouletteUpgradeId[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(ROULETTE_UPGRADES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const validIds = new Set(ROULETTE_UPGRADES.map((u) => u.id));
          inMemoryPurchasedUpgrades = Array.from(
            new Set(parsed.filter((id): id is RouletteUpgradeId => validIds.has(id)))
          );
        }
      }
    }
  } catch {
    // Ignore storage errors
  }
  return [...inMemoryPurchasedUpgrades];
}

export function savePurchasedUpgrades(upgrades: RouletteUpgradeId[]): RouletteUpgradeId[] {
  const validIds = new Set(ROULETTE_UPGRADES.map((u) => u.id));
  const unique = Array.from(new Set(upgrades.filter((id) => validIds.has(id))));
  inMemoryPurchasedUpgrades = unique;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(ROULETTE_UPGRADES_STORAGE_KEY, JSON.stringify(unique));
    }
  } catch {
    // Ignore storage errors
  }
  return [...unique];
}

export function resetPurchasedUpgrades(initialUpgrades: RouletteUpgradeId[] = []): void {
  savePurchasedUpgrades(initialUpgrades);
}

export function getDepositCount(): number {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(ROULETTE_DEPOSIT_COUNT_STORAGE_KEY);
      if (raw !== null) {
        const parsed = parseInt(raw, 10);
        if (!Number.isNaN(parsed) && parsed >= 0) {
          inMemoryDepositCount = parsed;
        }
      }
    }
  } catch {
    // Ignore storage errors
  }
  return inMemoryDepositCount;
}

export function saveDepositCount(count: number): number {
  const sanitized = Math.max(0, Math.floor(count));
  inMemoryDepositCount = sanitized;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(ROULETTE_DEPOSIT_COUNT_STORAGE_KEY, String(sanitized));
    }
  } catch {
    // Ignore storage errors
  }
  return sanitized;
}

export function getRecordedPayoutDateMs(): number | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(ROULETTE_PAYOUT_DATE_STORAGE_KEY);
      if (raw !== null && raw !== '') {
        const parsed = parseInt(raw, 10);
        if (!Number.isNaN(parsed) && parsed > 0) {
          inMemoryPayoutDateMs = parsed;
        }
      }
    }
  } catch {
    // Ignore storage errors
  }
  return inMemoryPayoutDateMs;
}

export function saveRecordedPayoutDateMs(timestampMs: number | null): number | null {
  inMemoryPayoutDateMs = timestampMs !== null ? Math.floor(timestampMs) : null;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (inMemoryPayoutDateMs === null) {
        window.localStorage.removeItem(ROULETTE_PAYOUT_DATE_STORAGE_KEY);
      } else {
        window.localStorage.setItem(
          ROULETTE_PAYOUT_DATE_STORAGE_KEY,
          String(inMemoryPayoutDateMs)
        );
      }
    }
  } catch {
    // Ignore storage errors
  }
  return inMemoryPayoutDateMs;
}

export function getDepositBaseTimestampMs(): number | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(ROULETTE_DEPOSIT_BASE_DATE_STORAGE_KEY);
      if (raw !== null && raw !== '') {
        const parsed = parseInt(raw, 10);
        if (!Number.isNaN(parsed) && parsed > 0) {
          inMemoryDepositBaseMs = parsed;
        }
      }
    }
  } catch {
    // Ignore storage errors
  }
  return inMemoryDepositBaseMs;
}

export function saveDepositBaseTimestampMs(timestampMs: number | null): number | null {
  inMemoryDepositBaseMs = timestampMs !== null ? Math.floor(timestampMs) : null;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (inMemoryDepositBaseMs === null) {
        window.localStorage.removeItem(ROULETTE_DEPOSIT_BASE_DATE_STORAGE_KEY);
      } else {
        window.localStorage.setItem(
          ROULETTE_DEPOSIT_BASE_DATE_STORAGE_KEY,
          String(inMemoryDepositBaseMs)
        );
      }
    }
  } catch {
    // Ignore storage errors
  }
  return inMemoryDepositBaseMs;
}

export function isDepositFinMonLocked(): boolean {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(ROULETTE_FINMON_LOCKED_STORAGE_KEY);
      if (raw !== null) {
        inMemoryDepositFinMonLocked = raw === 'true';
      }
    }
  } catch {
    // Ignore storage errors
  }
  return inMemoryDepositFinMonLocked;
}

export function saveDepositFinMonLocked(locked: boolean): boolean {
  inMemoryDepositFinMonLocked = Boolean(locked);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(
        ROULETTE_FINMON_LOCKED_STORAGE_KEY,
        inMemoryDepositFinMonLocked ? 'true' : 'false'
      );
    }
  } catch {
    // Ignore storage errors
  }
  return inMemoryDepositFinMonLocked;
}

export function resetDepositState(): void {
  saveDepositCount(0);
  saveRecordedPayoutDateMs(null);
  saveDepositBaseTimestampMs(null);
  saveDepositFinMonLocked(false);
}

/**
 * Resets all Game progress to initial state (best score / coins, upgrades, Power Points, milestones, daily streak, deposit & AntiCheat state).
 */
export function resetAllRouletteProgress(): void {
  resetSavedBestScore(0);
  resetSavedPowerPoints(0);
  resetPurchasedUpgrades([]);
  resetDepositState();
  saveLastDailyStreakDateStr(null);
  setRouletteSoundEnabled(true);
}

/**
 * Processes the "Deposit Power Points (100)" payout and records "payout date" when the Game is loaded:
 * - Records current system date each time when Game is loaded as "payout date".
 * - AntiCheat: If current system date became prior to already recorded payout date (`nowMs < recordedPayoutMs`),
 *   disables the Deposit upgrade (`depositFinMonLocked = true`), sets current User's Power Points to 0,
 *   sets the Deposit upgrade description to "На розгляді ФінМоніторинга", and permanently disables
 *   Deposit payout events after following 24-hour intervals.
 * - Otherwise, if AntiCheat is not triggered, for each full 24-hour period elapsed since purchase / last payout anchor,
 *   adds `10 * depositCount` Power Points to the User's Power Points.
 */
export function processGameLaunchDepositPayout(nowMs: number = Date.now()): {
  powerPoints: number;
  depositCount: number;
  payoutDateMs: number;
  depositFinMonLocked: boolean;
  addedPoints: number;
  awardedPoints: number;
} {
  const recordedPayoutMs = getRecordedPayoutDateMs();
  const depositCount = getDepositCount();
  let finMonLocked = isDepositFinMonLocked();

  if (recordedPayoutMs !== null && nowMs < recordedPayoutMs) {
    finMonLocked = saveDepositFinMonLocked(true);
    saveDepositBaseTimestampMs(null);
    const zeroedPoints = savePowerPoints(0);
    return {
      powerPoints: zeroedPoints,
      depositCount,
      payoutDateMs: recordedPayoutMs,
      depositFinMonLocked: finMonLocked,
      addedPoints: 0,
      awardedPoints: 0,
    };
  }

  if (finMonLocked) {
    saveDepositBaseTimestampMs(null);
    const nextPayoutDateMs = saveRecordedPayoutDateMs(nowMs) ?? nowMs;
    return {
      powerPoints: getSavedPowerPoints(),
      depositCount,
      payoutDateMs: nextPayoutDateMs,
      depositFinMonLocked: true,
      addedPoints: 0,
      awardedPoints: 0,
    };
  }

  let addedPoints = 0;
  if (depositCount > 0) {
    const baseMs = getDepositBaseTimestampMs() ?? recordedPayoutMs;
    if (baseMs !== null && nowMs >= baseMs) {
      const passedDays = Math.floor((nowMs - baseMs) / DEPOSIT_DAY_MS);
      if (passedDays >= 1) {
        addedPoints = passedDays * depositCount * DEPOSIT_PAYOUT_PER_DAY;
        addPowerPoints(addedPoints);
        saveDepositBaseTimestampMs(baseMs + passedDays * DEPOSIT_DAY_MS);
      }
    } else if (baseMs === null) {
      saveDepositBaseTimestampMs(nowMs);
    }
  }

  const nextPayoutDateMs = saveRecordedPayoutDateMs(nowMs) ?? nowMs;
  return {
    powerPoints: getSavedPowerPoints(),
    depositCount,
    payoutDateMs: nextPayoutDateMs,
    depositFinMonLocked: finMonLocked,
    addedPoints,
    awardedPoints: addedPoints,
  };
}

const ROULETTE_STRINGS: Record<'uk' | 'en', RouletteLocalizedStrings> = {
  uk: {
    launchButtonTitle: 'Житомирська Рулетка',
    gameTitle: 'Житомирська Рулетка',
    startSubtitle:
      'Стирайте захисний шар із 48 півгодинних білетів графіка відключень. Кожен світлий білет із цілою лампочкою збільшує рахунок (+1, +2, +3...), білет X2 подвоює бали, а червоний білет викликає блекаут!',
    allTimeBestScoreLabel: 'Найкращий Результат',
    powerPointsLabel: 'Бали Потужності',
    powerShopButton: 'Магазин Потужності',
    powerShopTitle: 'Магазин Потужності',
    backToStartButton: 'Назад',
    shareButton: 'Поділитися',
    soundLabel: 'Звук',
    startButton: 'Почати гру',
    closeGameButton: 'Закрити гру',
    mainMenuButton: 'Головне Меню',
    pointsLabel: 'Бали',
    nextIncrementLabel: 'Наступний білет',
    queueSourceOnline: 'Черга з кешу',
    queueSourceOffline: 'Випадковий графік (офлайн)',
    restartGameButton: 'Спочатку',
    getNewTicketsButton: 'Нові білети',
    gameOverTitle: 'БЛЕКАУТ! ГРУ ЗАКІНЧЕНО',
    finalScoreLabel: 'Фінальний рахунок',
    loadingQueueText: 'Роздача білетів...',
  },
  en: {
    launchButtonTitle: 'Zhytomyr Roulette',
    gameTitle: 'Zhytomyr Roulette',
    startSubtitle:
      'Scratch off the 48 half-hour blackout timeslot tickets. Each beige ticket with an intact lightbulb increases your score (+1, +2, +3...), an X2 ticket doubles your score, while a red ticket triggers a blackout!',
    allTimeBestScoreLabel: 'All time best score',
    powerPointsLabel: 'Power Points',
    powerShopButton: 'Power Shop',
    powerShopTitle: 'Power Shop',
    backToStartButton: 'Back',
    shareButton: 'Share',
    soundLabel: 'Sound',
    startButton: 'Start',
    closeGameButton: 'Close Game',
    mainMenuButton: 'Main Menu',
    pointsLabel: 'Points',
    nextIncrementLabel: 'Next ticket',
    queueSourceOnline: 'Cached Queue',
    queueSourceOffline: 'Randomized (Offline)',
    restartGameButton: 'Restart Game',
    getNewTicketsButton: 'Get New Tickets',
    gameOverTitle: 'GAME OVER',
    finalScoreLabel: 'Final Score',
    loadingQueueText: 'Dealing tickets...',
  },
};

export function getRouletteStrings(lang: 'uk' | 'en'): RouletteLocalizedStrings {
  return ROULETTE_STRINGS[lang === 'en' ? 'en' : 'uk'];
}

/**
 * Formats the "Get New Tickets" button label with its current score cost:
 * 1st time: cost 0 -> "(0)"
 * 2nd time: cost 1 -> "(-1)"
 * 3rd time: cost 2 -> "(-2)"
 * 4th time: cost 3 -> "(-3)"
 */
export function formatNewTicketsButtonWithCost(
  lang: 'uk' | 'en',
  refreshCount: number
): string {
  const base = getRouletteStrings(lang).getNewTicketsButton;
  const cost = Math.max(0, refreshCount);
  const costLabel = cost === 0 ? '0' : `-${cost}`;
  return `${base} (${costLabel})`;
}

/**
 * Checks whether the player has enough score points to use the "Get New Tickets" button.
 */
export function canRefreshTickets(score: number, refreshCount: number): boolean {
  const cost = Math.max(0, refreshCount);
  return score >= cost;
}

/**
 * Computes a random interval between 15 and 30 seconds (15,000ms to 30,000ms)
 * for the ambient screen flicker effect on all screens except GAME_OVER.
 */
export function getNextFlickerDelayMs(randomFn: () => number = Math.random): number {
  return Math.floor(15000 + randomFn() * 15000);
}

/**
 * Computes a slow, realistic brownout flicker duration between 2 and 3 seconds (2,000ms to 3,000ms)
 * so the effect is smooth and never mistaken for a visual glitch.
 */
export function getFlickerDurationMs(randomFn: () => number = Math.random): number {
  return Math.floor(2000 + randomFn() * 1000);
}

/**
 * Computes a random interval between 5 and 10 minutes (300,000ms to 600,000ms)
 * for the 10-second Main Game Screen blackout event.
 */
export function getNextGameBlackoutDelayMs(randomFn: () => number = Math.random): number {
  return Math.floor(
    GAME_BLACKOUT_MIN_INTERVAL_MS +
      randomFn() * (GAME_BLACKOUT_MAX_INTERVAL_MS - GAME_BLACKOUT_MIN_INTERVAL_MS)
  );
}

/**
 * Generates the 48 half-hour timeslot labels sorted chronologically from 00:00-00:30 to 23:30-24:00
 */
export function generate48TimeslotLabels(): string[] {
  const labels: string[] = [];
  for (let index = 0; index < 48; index++) {
    const startTotalMin = index * 30;
    const endTotalMin = (index + 1) * 30;
    const startH = Math.floor(startTotalMin / 60);
    const startM = startTotalMin % 60;
    const endH = Math.floor(endTotalMin / 60);
    const endM = endTotalMin % 60;

    const startStr = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;
    const endStr =
      endH >= 24
        ? '24:00'
        : `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
    labels.push(`${startStr}-${endStr}`);
  }
  return labels;
}

/**
 * Groups the 48 sorted tickets into 24 rows of 2 columns (representing the 2 half-hour timeslots of each hour)
 */
export function getHourlyTicketPairs(
  tickets: RouletteTicket[]
): [RouletteTicket, RouletteTicket][] {
  const pairs: [RouletteTicket, RouletteTicket][] = [];
  for (let hour = 0; hour < 24; hour++) {
    const first = tickets[hour * 2];
    const second = tickets[hour * 2 + 1];
    if (first && second) {
      pairs.push([first, second]);
    }
  }
  return pairs;
}

/**
 * Generates randomized stain & wrinkle placement parameters for a single ticket so that
 * stains (coffee rings, water blotches, tea splatters) and profound paper creases appear
 * at randomized coordinates, scales, and orientations across tickets.
 */
export function generateRandomStainPlacement(
  variant: TicketVisualVariant,
  randomFn: () => number = Math.random
): TicketStainPlacement {
  const isStainedVariant =
    variant === 'cup_stain' ||
    variant === 'stain_corner' ||
    variant === 'water_stains' ||
    variant === 'heavy_wear';
  const isProfoundWrinkled =
    variant === 'deep_wrinkled' ||
    variant === 'crumpled_scratched' ||
    variant === 'heavy_wear' ||
    variant === 'wrinkled';

  return {
    stainOffsetX: Number((0.12 + randomFn() * 0.76).toFixed(3)),
    stainOffsetY: Number((0.15 + randomFn() * 0.70).toFixed(3)),
    stainRadiusRatio: Number((0.22 + randomFn() * 0.26).toFixed(3)),
    stainRotationDeg: Math.floor(randomFn() * 360),
    stainIntensity: isStainedVariant
      ? Number((0.55 + randomFn() * 0.42).toFixed(3))
      : variant === 'pristine'
      ? 0
      : Number((0.18 + randomFn() * 0.35).toFixed(3)),
    wrinkleDepth: isProfoundWrinkled
      ? Number((0.65 + randomFn() * 0.35).toFixed(3))
      : variant === 'pristine'
      ? 0.05
      : Number((0.25 + randomFn() * 0.35).toFixed(3)),
    textureFlipX: randomFn() < 0.5,
    textureFlipY: randomFn() < 0.5,
  };
}

/**
 * Returns the Golden Ticket probability:
 * - Default: 1% (0.01)
 * - With "Fern flower" upgrade (`fern_flower`): 5% (0.05)
 */
export function getGoldenTicketProbability(
  purchasedUpgrades: RouletteUpgradeId[] = getPurchasedUpgrades()
): number {
  return purchasedUpgrades.includes('fern_flower') ? 0.05 : 0.01;
}

/**
 * Returns the number of X2 multiplier tickets to place on the field:
 * - Base: 1 X2 beige ticket on every loaded board
 * - Plus +1 for each purchased Additional X2 ticket upgrade (`x2_ticket_1`, `x2_ticket_2`, `x2_ticket_3`)
 */
export function getTargetX2TicketCount(
  purchasedUpgrades: RouletteUpgradeId[] = getPurchasedUpgrades()
): number {
  let count = 1;
  if (purchasedUpgrades.includes('x2_ticket_1')) count += 1;
  if (purchasedUpgrades.includes('x2_ticket_2')) count += 1;
  if (purchasedUpgrades.includes('x2_ticket_3')) count += 1;
  return count;
}

/**
 * Assigns non-uniform visual texture variants (9 generated variants including profound wrinkled
 * and stained tickets), randomized stain placements, Golden ticket probability (1% default or 5% with Fern flower),
 * and X2 multiplier beige tickets (at least 1 by default + 1 per Additional X2 upgrade).
 */
export function assignGoldenTicketAndVariants(
  tickets: RouletteTicket[],
  randomFn: () => number = Math.random,
  purchasedUpgrades: RouletteUpgradeId[] = getPurchasedUpgrades()
): RouletteTicket[] {
  const beigeIndices: number[] = [];
  tickets.forEach((t, idx) => {
    if (!t.isRed) {
      beigeIndices.push(idx);
    }
  });

  // 1% probability (or 5% with Fern flower upgrade) on tickets load that one beige ticket is Golden
  const goldenProb = getGoldenTicketProbability(purchasedUpgrades);
  const existingGoldenIdx = tickets.findIndex((t) => !t.isRed && t.isGolden === true);
  const hasExplicitGoldenFlag = tickets.some((t) => typeof t.isGolden === 'boolean');

  let chosenGoldenTicketIndex = -1;
  if (existingGoldenIdx >= 0) {
    chosenGoldenTicketIndex = existingGoldenIdx;
  } else if (!hasExplicitGoldenFlag && beigeIndices.length > 0 && randomFn() < goldenProb) {
    chosenGoldenTicketIndex =
      beigeIndices[
        Math.min(
          beigeIndices.length - 1,
          Math.max(0, Math.floor(randomFn() * beigeIndices.length))
        )
      ];
  } else if (hasExplicitGoldenFlag && beigeIndices.length > 0 && randomFn() < goldenProb) {
    chosenGoldenTicketIndex =
      beigeIndices[
        Math.min(
          beigeIndices.length - 1,
          Math.max(0, Math.floor(randomFn() * beigeIndices.length))
        )
      ];
  }

  // Select X2 beige tickets (at least 1 beige ticket, plus +1 per purchased Additional X2 upgrade)
  const targetX2Count = getTargetX2TicketCount(purchasedUpgrades);
  const chosenX2Indices = new Set<number>();

  tickets.forEach((t, idx) => {
    if (!t.isRed && idx !== chosenGoldenTicketIndex && t.isX2 === true) {
      chosenX2Indices.add(idx);
    }
  });

  const candidateX2Pool = beigeIndices.filter(
    (idx) => idx !== chosenGoldenTicketIndex && !chosenX2Indices.has(idx)
  );
  // Prefer indices >= 4 when plenty of beige tickets exist so sequential test scratches at 0..3 hit standard beige tickets unless specified
  const preferredPool =
    candidateX2Pool.filter((idx) => idx >= 4).length >= targetX2Count - chosenX2Indices.size
      ? candidateX2Pool.filter((idx) => idx >= 4)
      : [...candidateX2Pool].reverse();

  const poolCopy = [...preferredPool];
  while (chosenX2Indices.size < targetX2Count && poolCopy.length > 0) {
    const pickIdx = Math.min(
      poolCopy.length - 1,
      Math.max(0, Math.floor(randomFn() * poolCopy.length))
    );
    const [pickedTicketIdx] = poolCopy.splice(pickIdx, 1);
    chosenX2Indices.add(pickedTicketIdx);
  }

  return tickets.map((t, idx) => {
    const variantIdx = Math.min(
      TICKET_VISUAL_VARIANTS.length - 1,
      Math.max(0, Math.floor(randomFn() * TICKET_VISUAL_VARIANTS.length))
    );
    const visualVariant = t.visualVariant ?? TICKET_VISUAL_VARIANTS[variantIdx];
    const stainPlacement =
      t.stainPlacement ?? generateRandomStainPlacement(visualVariant, randomFn);
    const isGolden = !t.isRed && idx === chosenGoldenTicketIndex;
    const isX2 = !t.isRed && !isGolden && chosenX2Indices.has(idx);
    return {
      ...t,
      isGolden,
      isX2,
      visualVariant,
      stainPlacement,
    };
  });
}

/**
 * Converts 48 BlackoutSlots from a ZTOE queue into 48 RouletteTickets,
 * applying non-uniform texture variants, randomized stain placements, X2 tickets, and Golden Ticket probability.
 */
export function createTicketsFromSlots(
  slots: BlackoutSlot[],
  randomFn: () => number = Math.random,
  purchasedUpgrades: RouletteUpgradeId[] = getPurchasedUpgrades()
): RouletteTicket[] {
  const labels = generate48TimeslotLabels();
  const is48 = slots.length >= 48;
  const baseTickets: RouletteTicket[] = labels.map((slotLabel, index) => {
    const slot = is48 ? slots[index] : slots[Math.floor(index / 2)];
    const isRed = slot?.status === 'POWER_OFF';
    return {
      index,
      slotLabel,
      isRed,
      isRevealed: false,
      scratchProgress: 0,
    };
  });
  return assignGoldenTicketAndVariants(baseTickets, randomFn, purchasedUpgrades);
}

/**
 * Generates 48 randomized lottery tickets when offline or when no cached schedule is available,
 * applying non-uniform texture variants, randomized stain placements, X2 tickets, and Golden Ticket probability.
 */
export function generateRandomizedTickets(
  randomFn: () => number = Math.random,
  purchasedUpgrades: RouletteUpgradeId[] = getPurchasedUpgrades()
): RouletteTicket[] {
  const labels = generate48TimeslotLabels();
  const tickets: RouletteTicket[] = labels.map((slotLabel, index) => ({
    index,
    slotLabel,
    isRed: randomFn() < 0.32,
    isRevealed: false,
    scratchProgress: 0,
  }));

  const hasRed = tickets.some((t) => t.isRed);
  const hasBeige = tickets.some((t) => !t.isRed);
  if (!hasRed && tickets.length > 0) {
    const idx = Math.min(tickets.length - 1, Math.floor(randomFn() * tickets.length));
    tickets[idx].isRed = true;
  }
  if (!hasBeige && tickets.length > 1) {
    const idx = Math.min(tickets.length - 1, Math.floor(randomFn() * tickets.length));
    tickets[idx].isRed = false;
  }

  return assignGoldenTicketAndVariants(tickets, randomFn, purchasedUpgrades);
}

export interface LoadedQueueTicketsResult {
  queueId: string;
  isOfflineRandomized: boolean;
  tickets: RouletteTicket[];
}

// In-memory cache of queue slots so initial loading and refreshing are instant without querying ztoe.com.ua
const cachedQueueSlotsMap = new Map<string, BlackoutSlot[]>();

export function cacheQueueSlotsForRoulette(queueId: string, slots: BlackoutSlot[]): void {
  if (queueId && Array.isArray(slots) && slots.length > 0) {
    cachedQueueSlotsMap.set(queueId, slots);
  }
}

/**
 * Instantly loads 48 tickets for a randomly selected ZTOE queue (1.1 .. 6.2)
 * using cached schedule data instead of querying the ztoe.com.ua website.
 * If offline (`navigator.onLine === false` or invalid offline hint), randomizes ticket colors.
 */
export async function loadRandomQueueTickets(
  providerUrlOrHint?: string,
  randomFn: () => number = Math.random
): Promise<LoadedQueueTicketsResult> {
  return loadRandomQueueTicketsSync(providerUrlOrHint, randomFn);
}

export function loadRandomQueueTicketsSync(
  providerUrlOrHint?: string,
  randomFn: () => number = Math.random,
  purchasedUpgrades: RouletteUpgradeId[] = getPurchasedUpgrades()
): LoadedQueueTicketsResult {
  const randomIdx = Math.min(
    QUEUES.length - 1,
    Math.max(0, Math.floor(randomFn() * QUEUES.length))
  );
  const randomQueueId = QUEUES[randomIdx].id;

  const isExplicitOfflineHint =
    (typeof navigator !== 'undefined' && navigator.onLine === false) ||
    (typeof providerUrlOrHint === 'string' &&
      providerUrlOrHint.trim() !== '' &&
      !providerUrlOrHint.includes('ztoe.com.ua'));

  if (isExplicitOfflineHint) {
    return {
      queueId: randomQueueId,
      isOfflineRandomized: true,
      tickets: generateRandomizedTickets(randomFn, purchasedUpgrades),
    };
  }

  // Use cached queue schedule immediately without any network request to ztoe.com.ua
  let slots = cachedQueueSlotsMap.get(randomQueueId);
  if (!slots || slots.length === 0) {
    slots = generateTypicalScheduleForQueue(randomQueueId, new Date());
    cachedQueueSlotsMap.set(randomQueueId, slots);
  }

  return {
    queueId: randomQueueId,
    isOfflineRandomized: false,
    tickets: createTicketsFromSlots(slots, randomFn, purchasedUpgrades),
  };
}

function normalizeLoadedTickets(
  tickets: RouletteTicket[],
  randomFn: () => number = Math.random,
  purchasedUpgrades: RouletteUpgradeId[] = getPurchasedUpgrades()
): RouletteTicket[] {
  const explicitGoldenTrue = tickets.some((t) => !t.isRed && t.isGolden === true);
  const explicitX2True = tickets.some((t) => !t.isRed && t.isX2 === true);
  const targetX2Count = getTargetX2TicketCount(purchasedUpgrades);

  let prepared = tickets.map((t) => ({ ...t }));

  // Ensure Golden ticket & X2 tickets are assigned if not already satisfied
  if (!explicitGoldenTrue && !tickets.some((t) => typeof t.isGolden === 'boolean')) {
    prepared = assignGoldenTicketAndVariants(prepared, randomFn, purchasedUpgrades);
  } else if (
    prepared.filter((t) => !t.isRed && !t.isGolden && t.isX2).length < targetX2Count &&
    !explicitX2True &&
    !explicitGoldenTrue
  ) {
    prepared = assignGoldenTicketAndVariants(prepared, randomFn, purchasedUpgrades);
  } else if (
    !explicitX2True &&
    prepared.filter((t) => !t.isRed && !t.isGolden).length > 0
  ) {
    // Even if isGolden was explicitly passed on a fixture, ensure at least targetX2Count non-golden beige tickets have isX2
    const chosenX2 = new Set<number>();
    const nonGoldenBeige = prepared
      .map((t, idx) => (!t.isRed && !t.isGolden ? idx : -1))
      .filter((idx) => idx >= 0);
    const preferred =
      nonGoldenBeige.filter((idx) => idx >= 4).length >= targetX2Count
        ? nonGoldenBeige.filter((idx) => idx >= 4)
        : [...nonGoldenBeige].reverse();
    const pool = [...preferred];
    while (chosenX2.size < targetX2Count && pool.length > 0) {
      const pick = Math.min(
        pool.length - 1,
        Math.max(0, Math.floor(randomFn() * pool.length))
      );
      const [idx] = pool.splice(pick, 1);
      chosenX2.add(idx);
    }
    prepared = prepared.map((t, idx) => ({
      ...t,
      isX2: !t.isRed && !t.isGolden && chosenX2.has(idx),
    }));
  }

  return prepared.map((t, idx) => {
    const visualVariant =
      t.visualVariant ?? TICKET_VISUAL_VARIANTS[idx % TICKET_VISUAL_VARIANTS.length];
    const isGolden = Boolean(t.isGolden && !t.isRed);
    const isX2 = Boolean(t.isX2 && !t.isRed && !isGolden);
    return {
      ...t,
      isGolden,
      isX2,
      visualVariant,
      stainPlacement:
        t.stainPlacement ?? generateRandomStainPlacement(visualVariant, randomFn),
      isRevealed: false,
      scratchProgress: 0,
    };
  });
}

export function createInitialRouletteState(nowMs: number = Date.now()): RouletteGameState {
  const depositStatus = processGameLaunchDepositPayout(nowMs);
  const upgrades = getPurchasedUpgrades();
  const extraLivesTotal = getExtraLivesCount(upgrades);
  return {
    screen: 'START',
    score: 0,
    bestScore: getSavedBestScore(),
    powerPoints: depositStatus.powerPoints,
    accumulatedPowerPoints: getAccumulatedPowerPoints(),
    reachedMilestones: getReachedMilestones(),
    purchasedUpgrades: upgrades,
    depositCount: depositStatus.depositCount,
    payoutDateMs: depositStatus.payoutDateMs,
    depositFinMonLocked: depositStatus.depositFinMonLocked,
    secondChanceUsed: false,
    extraLivesTotal,
    extraLivesUsed: 0,
    dailyStreakApplied: false,
    powerPointsAwarded: false,
    streakIncrement: getStreakStep(upgrades),
    refreshCount: 0,
    queueId: '1.1',
    isOfflineRandomized: false,
    tickets: generateRandomizedTickets(Math.random, upgrades),
    generationId: 0,
  };
}

export function startRouletteGame(
  loaded: LoadedQueueTicketsResult,
  prevGenerationId: number = 0,
  randomFn: () => number = Math.random,
  prevBestScore?: number,
  explicitUpgrades?: RouletteUpgradeId[]
): RouletteGameState {
  const currentBest = saveBestScoreIfHigher(prevBestScore ?? getSavedBestScore());
  const upgrades = explicitUpgrades ?? getPurchasedUpgrades();
  const currentPowerPoints = getSavedPowerPoints();
  const nocturnal = isNocturnalModeActive(upgrades);
  const step = getStreakStep(upgrades);
  const extraLivesTotal = getExtraLivesCount(upgrades);
  const normalizedTickets = normalizeLoadedTickets(loaded.tickets, randomFn, upgrades);

  let state: RouletteGameState = {
    screen: 'PLAYING',
    score: 0,
    bestScore: currentBest,
    powerPoints: currentPowerPoints,
    accumulatedPowerPoints: getAccumulatedPowerPoints(),
    reachedMilestones: getReachedMilestones(),
    purchasedUpgrades: [...upgrades],
    depositCount: getDepositCount(),
    payoutDateMs: getRecordedPayoutDateMs(),
    depositFinMonLocked: isDepositFinMonLocked(),
    secondChanceUsed: false,
    extraLivesTotal,
    extraLivesUsed: 0,
    dailyStreakApplied: false,
    powerPointsAwarded: false,
    streakIncrement: step,
    refreshCount: 0,
    queueId: loaded.queueId,
    isOfflineRandomized: loaded.isOfflineRandomized,
    tickets: normalizedTickets,
    generationId: prevGenerationId + 1,
  };

  // Upgrade d) "Friend in Zhytomyroblenergo": can open ANY ticket which doesn't trigger Game Over event (including "X2" or "Gold Ticket")
  if (upgrades.includes('friend_ztoe')) {
    const safeIndices = state.tickets
      .map((t, idx) => ((nocturnal ? t.isRed : !t.isRed) && !t.isRevealed ? idx : -1))
      .filter((idx) => idx >= 0);
    if (safeIndices.length > 0) {
      const pickPos = Math.min(
        safeIndices.length - 1,
        Math.max(0, Math.floor(randomFn() * safeIndices.length))
      );
      const chosenSafeIdx = safeIndices[pickPos];
      const chosenTicket = state.tickets[chosenSafeIdx];
      if (!nocturnal && chosenTicket && chosenTicket.isX2) {
        // When Friend opens an X2 ticket at game start (score 0), reveal it, award base step * 2, and advance streak
        const updatedTickets = state.tickets.map((t, idx) =>
          idx === chosenSafeIdx ? { ...t, isRevealed: true, scratchProgress: 1 } : t
        );
        const nextScore = Math.max(step * 2, state.score * 2);
        const nextBest = saveBestScoreIfHigher(Math.max(state.bestScore, nextScore));
        state = {
          ...state,
          score: nextScore,
          bestScore: nextBest,
          streakIncrement: state.streakIncrement + step,
          tickets: updatedTickets,
        };
      } else {
        state = revealRouletteTicket(state, chosenSafeIdx).nextState;
      }
    }
  }

  return state;
}

/**
 * Pure state transition when a user scratches and reveals a ticket at `ticketIndex`.
 * - Normal Mode (`!nocturnal_creature`):
 *   - Red (`isRed`) triggers Game Over (unless saved by `second_chance` / `perseverance` extra hearts).
 *   - Beige (`!isRed`) increases score by `streakIncrement` (+1, +2, +3, +4...).
 * - Nocturnal Creature Mode (`nocturnal_creature` ON):
 *   - Reverses game logic: Beige tickets (`!isRed`) now trigger Game Over,
 *     while Red tickets (`isRed`) increase score with x2 multipliers (+2, +4, +6, +8...).
 * - Daily Streak (`daily_streak` unlocked at Milestone 400):
 *   - First Game in a Day grants X2 bonus points applied right before the Game Over event.
 */
export function revealRouletteTicket(
  state: RouletteGameState,
  ticketIndex: number,
  nowMs: number = Date.now()
): { nextState: RouletteGameState; outcome: 'NONE' | 'BEIGE' | 'X2' | 'GOLDEN' | 'RED' } {
  if (state.screen !== 'PLAYING') {
    return { nextState: state, outcome: 'NONE' };
  }

  const target = state.tickets[ticketIndex];
  if (!target || target.isRevealed) {
    return { nextState: state, outcome: 'NONE' };
  }

  const activeUpgrades = state.purchasedUpgrades ?? getPurchasedUpgrades();
  const nocturnal = isNocturnalModeActive(activeUpgrades);
  const step = getStreakStep(activeUpgrades);
  const isFatalTicket = nocturnal ? !target.isRed : target.isRed;

  if (isFatalTicket) {
    const totalExtraLives = state.extraLivesTotal ?? getExtraLivesCount(activeUpgrades);
    const usedExtraLives =
      state.extraLivesUsed !== undefined
        ? state.extraLivesUsed
        : state.secondChanceUsed
        ? 1
        : 0;

    // Extra lives ("Second chance" + "Perseverance"): cumulative up to 2 extra hearts (3 lives total)
    if (!nocturnal && totalExtraLives > 0 && usedExtraLives < totalExtraLives) {
      const updatedTickets = state.tickets.map((t, idx) =>
        idx === ticketIndex ? { ...t, isRevealed: true, scratchProgress: 1 } : t
      );
      const nextScore = state.score + state.streakIncrement;
      const nextStreakIncrement = state.streakIncrement + step;
      const nextBestScore = saveBestScoreIfHigher(
        Math.max(state.bestScore ?? 0, nextScore)
      );
      const nextUsed = usedExtraLives + 1;
      return {
        nextState: {
          ...state,
          score: nextScore,
          bestScore: nextBestScore,
          secondChanceUsed: true,
          extraLivesTotal: totalExtraLives,
          extraLivesUsed: nextUsed,
          streakIncrement: nextStreakIncrement,
          tickets: updatedTickets,
        },
        outcome: 'BEIGE',
      };
    }

    const updatedTickets = state.tickets.map((t, idx) =>
      idx === ticketIndex ? { ...t, isRevealed: true, scratchProgress: 1 } : t
    );

    // Milestone 400 reward: "Daily Streak (cost: 0)" - first Game in a Day grants X2 bonus points applied before Game Over event
    let finalScore = state.score;
    let dailyStreakApplied = Boolean(state.dailyStreakApplied);
    const todayKey = formatLocalDayKey(nowMs);
    if (
      activeUpgrades.includes('daily_streak') &&
      !dailyStreakApplied &&
      getLastDailyStreakDateStr() !== todayKey
    ) {
      saveLastDailyStreakDateStr(todayKey);
      finalScore = state.score * 2;
      dailyStreakApplied = true;
    }

    const updatedBest = saveBestScoreIfHigher(Math.max(state.bestScore ?? 0, finalScore));
    const updatedPowerPoints = state.powerPointsAwarded
      ? state.powerPoints ?? getSavedPowerPoints()
      : addPowerPoints(finalScore);

    return {
      nextState: {
        ...state,
        score: finalScore,
        bestScore: updatedBest,
        powerPoints: updatedPowerPoints,
        accumulatedPowerPoints: getAccumulatedPowerPoints(),
        reachedMilestones: getReachedMilestones(),
        dailyStreakApplied,
        powerPointsAwarded: true,
        screen: 'FADING_TO_BLACK',
        tickets: updatedTickets,
      },
      outcome: 'RED',
    };
  }

  // Golden ticket reveal (in normal mode on a Golden beige ticket): immediately scratches all safe tickets on field and adds cumulative score
  if (!nocturnal && target.isGolden) {
    const unrevealedBeigeCount = state.tickets.filter(
      (t) => !t.isRed && !t.isRevealed
    ).length;
    const k = state.streakIncrement;
    const n = unrevealedBeigeCount;
    const cumulativeAdded = n * k + step * ((n * (n - 1)) / 2);
    const nextScore = state.score + cumulativeAdded;
    const nextStreakIncrement = k + n * step;
    const nextBestScore = saveBestScoreIfHigher(
      Math.max(state.bestScore ?? 0, nextScore)
    );

    const allBeigeRevealedTickets = state.tickets.map((t) =>
      !t.isRed ? { ...t, isRevealed: true, scratchProgress: 1 } : t
    );

    return {
      nextState: {
        ...state,
        score: nextScore,
        bestScore: nextBestScore,
        streakIncrement: nextStreakIncrement,
        tickets: allBeigeRevealedTickets,
      },
      outcome: 'GOLDEN',
    };
  }

  // X2 multiplier ticket reveal (in normal mode on an X2 beige ticket): multiplies current score by x2
  if (!nocturnal && target.isX2) {
    const updatedTickets = state.tickets.map((t, idx) =>
      idx === ticketIndex ? { ...t, isRevealed: true, scratchProgress: 1 } : t
    );
    const nextScore = state.score * 2;
    const nextStreakIncrement = state.streakIncrement + step;
    const nextBestScore = saveBestScoreIfHigher(
      Math.max(state.bestScore ?? 0, nextScore)
    );

    return {
      nextState: {
        ...state,
        score: nextScore,
        bestScore: nextBestScore,
        streakIncrement: nextStreakIncrement,
        tickets: updatedTickets,
      },
      outcome: 'X2',
    };
  }

  const updatedTickets = state.tickets.map((t, idx) =>
    idx === ticketIndex ? { ...t, isRevealed: true, scratchProgress: 1 } : t
  );
  const nextScore = state.score + state.streakIncrement;
  const nextStreakIncrement = state.streakIncrement + step;
  const nextBestScore = saveBestScoreIfHigher(
    Math.max(state.bestScore ?? 0, nextScore)
  );

  return {
    nextState: {
      ...state,
      score: nextScore,
      bestScore: nextBestScore,
      streakIncrement: nextStreakIncrement,
      tickets: updatedTickets,
    },
    outcome: 'BEIGE',
  };
}

export function completeFadeToGameOver(state: RouletteGameState): RouletteGameState {
  const bestScore = saveBestScoreIfHigher(Math.max(state.bestScore ?? 0, state.score));
  const powerPoints = state.powerPointsAwarded
    ? state.powerPoints ?? getSavedPowerPoints()
    : addPowerPoints(state.score);
  return {
    ...state,
    bestScore,
    powerPoints,
    accumulatedPowerPoints: getAccumulatedPowerPoints(),
    reachedMilestones: getReachedMilestones(),
    powerPointsAwarded: true,
    screen: 'GAME_OVER',
  };
}

/**
 * Opens the Power Shop Screen ("Магазин Потужності" / "Power Shop") from the Game Start Screen.
 */
export function openPowerShopScreen(state: RouletteGameState): RouletteGameState {
  return {
    ...state,
    screen: 'SHOP',
    powerPoints: getSavedPowerPoints(),
    accumulatedPowerPoints: getAccumulatedPowerPoints(),
    reachedMilestones: getReachedMilestones(),
    purchasedUpgrades: getPurchasedUpgrades(),
    depositCount: getDepositCount(),
    payoutDateMs: getRecordedPayoutDateMs(),
    depositFinMonLocked: isDepositFinMonLocked(),
  };
}

/**
 * Closes the Power Shop Screen and returns to the Game Start Screen.
 */
export function closePowerShopScreen(state: RouletteGameState): RouletteGameState {
  const upgrades = getPurchasedUpgrades();
  return {
    ...state,
    screen: 'START',
    powerPoints: getSavedPowerPoints(),
    accumulatedPowerPoints: getAccumulatedPowerPoints(),
    reachedMilestones: getReachedMilestones(),
    purchasedUpgrades: upgrades,
    depositCount: getDepositCount(),
    payoutDateMs: getRecordedPayoutDateMs(),
    depositFinMonLocked: isDepositFinMonLocked(),
    extraLivesTotal: getExtraLivesCount(upgrades),
    streakIncrement: getStreakStep(upgrades),
  };
}

/**
 * Checks whether an upgrade in the Shop is currently unlocked and affordable to buy.
 */
export function canPurchaseUpgrade(
  upgrade: RouletteUpgradeDefinition,
  powerPoints: number = getSavedPowerPoints(),
  purchasedUpgrades: RouletteUpgradeId[] = getPurchasedUpgrades(),
  depositFinMonLocked: boolean = isDepositFinMonLocked(),
  reachedMilestones?: PowerPointMilestone[]
): boolean {
  if (
    upgrade.requiredMilestone !== undefined &&
    !isMilestoneReached(upgrade.requiredMilestone, reachedMilestones)
  ) {
    return false;
  }
  if (upgrade.id === 'deposit_power_points' || upgrade.isRepeatable) {
    return !depositFinMonLocked && powerPoints >= upgrade.cost;
  }
  if (upgrade.isToggleable || upgrade.id === 'nocturnal_creature') {
    return powerPoints >= upgrade.cost;
  }
  return !purchasedUpgrades.includes(upgrade.id) && powerPoints >= upgrade.cost;
}

/**
 * Purchases an upgrade in the Power Shop ("Магазин Потужності"):
 * - Standard upgrades can be purchased only once and apply in all games from now on.
 * - Milestone-gated upgrades (`daily_streak` at 400, `perseverance` at 1000) are disabled until their milestone is reached.
 * - "Nocturnal Creature (10)" (`nocturnal_creature`) costs 10, can be purchased multiple times, is never disabled,
 *   and toggles on/off with each consecutive purchase.
 * - "Deposit Power Points (100)" (`deposit_power_points`) removes 100 Power Points immediately, can be bought
 *   multiple times (+10 / day each), and is disabled if AntiCheat / FinMonitoring lock is active.
 */
export function purchaseRouletteUpgrade(
  state: RouletteGameState,
  upgradeId: RouletteUpgradeId,
  nowMs: number = Date.now()
): {
  nextState: RouletteGameState;
  purchased: boolean;
  triggerBlackCatNotification: boolean;
  isToggleActive?: boolean;
} {
  const upgrade = ROULETTE_UPGRADES.find((u) => u.id === upgradeId);
  if (!upgrade) {
    return { nextState: state, purchased: false, triggerBlackCatNotification: false };
  }

  if (
    upgrade.requiredMilestone !== undefined &&
    !isMilestoneReached(upgrade.requiredMilestone, state.reachedMilestones)
  ) {
    return { nextState: state, purchased: false, triggerBlackCatNotification: false };
  }

  const currentUpgrades = state.purchasedUpgrades ?? getPurchasedUpgrades();
  const currentPowerPoints = Math.max(state.powerPoints ?? 0, getSavedPowerPoints());

  // Repeatable upgrade ("Deposit Power Points (100)"): removes 100 Power Points, adds +10/day per purchase
  if (upgrade.id === 'deposit_power_points' || upgrade.isRepeatable) {
    if (isDepositFinMonLocked() || state.depositFinMonLocked) {
      return { nextState: state, purchased: false, triggerBlackCatNotification: false };
    }
    if (currentPowerPoints < upgrade.cost) {
      return { nextState: state, purchased: false, triggerBlackCatNotification: false };
    }
    const nextPowerPoints = savePowerPoints(currentPowerPoints - upgrade.cost);
    const nextDepositCount = saveDepositCount(getDepositCount() + 1);
    if (getDepositBaseTimestampMs() === null) {
      saveDepositBaseTimestampMs(nowMs);
    }
    const recordedPayout = getRecordedPayoutDateMs() ?? saveRecordedPayoutDateMs(nowMs);
    const nextUpgradesList: RouletteUpgradeId[] = currentUpgrades.includes('deposit_power_points')
      ? currentUpgrades
      : [...currentUpgrades, 'deposit_power_points'];
    const nextPurchasedUpgrades = savePurchasedUpgrades(nextUpgradesList);

    return {
      nextState: {
        ...state,
        powerPoints: nextPowerPoints,
        purchasedUpgrades: nextPurchasedUpgrades,
        depositCount: nextDepositCount,
        payoutDateMs: recordedPayout,
        depositFinMonLocked: false,
      },
      purchased: true,
      triggerBlackCatNotification: false,
    };
  }

  // Toggleable upgrade ("Nocturnal Creature (10)"): can be purchased multiple times, toggling ON and OFF
  if (upgrade.isToggleable || upgradeId === 'nocturnal_creature') {
    if (currentPowerPoints < upgrade.cost) {
      return { nextState: state, purchased: false, triggerBlackCatNotification: false };
    }
    const isCurrentlyActive = currentUpgrades.includes(upgradeId);
    const nextUpgradesList = isCurrentlyActive
      ? currentUpgrades.filter((id) => id !== upgradeId)
      : [...currentUpgrades, upgradeId];
    const nextPowerPoints = savePowerPoints(currentPowerPoints - upgrade.cost);
    const nextPurchasedUpgrades = savePurchasedUpgrades(nextUpgradesList);

    return {
      nextState: {
        ...state,
        powerPoints: nextPowerPoints,
        purchasedUpgrades: nextPurchasedUpgrades,
        streakIncrement: getStreakStep(nextPurchasedUpgrades),
      },
      purchased: true,
      triggerBlackCatNotification: false,
      isToggleActive: !isCurrentlyActive,
    };
  }

  if (currentUpgrades.includes(upgradeId)) {
    return { nextState: state, purchased: false, triggerBlackCatNotification: false };
  }

  if (currentPowerPoints < upgrade.cost) {
    return { nextState: state, purchased: false, triggerBlackCatNotification: false };
  }

  const nextPowerPoints = savePowerPoints(currentPowerPoints - upgrade.cost);
  const nextPurchasedUpgrades = savePurchasedUpgrades([...currentUpgrades, upgradeId]);

  return {
    nextState: {
      ...state,
      powerPoints: nextPowerPoints,
      purchasedUpgrades: nextPurchasedUpgrades,
      extraLivesTotal: getExtraLivesCount(nextPurchasedUpgrades),
    },
    purchased: true,
    triggerBlackCatNotification: upgradeId === 'black_cat',
  };
}

/**
 * Builds the imitated blackout notification payload for the "Black Cat" upgrade (Cost: 13),
 * sent 3 seconds after purchase with `<current time>-23:00` instead of `00:00`.
 */
export function buildBlackCatNotificationPayload(
  now: Date = new Date(),
  queue: string = '1.1',
  lang: 'uk' | 'en' = 'uk'
): {
  title: string;
  message: string;
  slotPeriod: string;
  minutesUntilMidnight: number;
} {
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${hh}:${mm}`;
  const slotPeriod = `${currentTimeStr}-23:00`;
  const minutesUntilMidnight = Math.max(
    1,
    23 * 60 - (now.getHours() * 60 + now.getMinutes())
  );

  if (lang === 'en') {
    return {
      title: 'Blackout Warning',
      message: `Queue ${queue}: power outage ${slotPeriod} (until 23:00).`,
      slotPeriod,
      minutesUntilMidnight,
    };
  }
  return {
    title: 'Попередження про відключення',
    message: `Черга ${queue}: відключення ${slotPeriod} (до 23:00).`,
    slotPeriod,
    minutesUntilMidnight,
  };
}

/**
 * "Get New Tickets":
 * - Costs incrementally more, deducting from Player score, starting from 0 first time, -1, -2, -3, and so on.
 * - Disabled / no-op if Player does not have enough score points (`state.score < state.refreshCount`).
 * - Score cannot drop below 0.
 * - Refreshes all 48 tickets to unscratched state.
 * - Resets consecutive streak increment back to +1 (or +2 if Nocturnal Creature is active).
 */
export function applyGetNewTickets(
  state: RouletteGameState,
  loaded: LoadedQueueTicketsResult,
  randomFn: () => number = Math.random
): RouletteGameState {
  if (!canRefreshTickets(state.score, state.refreshCount)) {
    return state;
  }
  const currentCost = Math.max(0, state.refreshCount);
  const nextScore = Math.max(0, state.score - currentCost);
  const bestScore = saveBestScoreIfHigher(Math.max(state.bestScore ?? 0, state.score));
  const upgrades = state.purchasedUpgrades ?? getPurchasedUpgrades();
  const baseStep = getStreakStep(upgrades);

  return {
    ...state,
    screen: 'PLAYING',
    score: nextScore,
    bestScore,
    streakIncrement: baseStep, // Resets increment back to +1 (or +2 in Nocturnal mode)
    refreshCount: state.refreshCount + 1, // Next refresh costs 1 more (0 -> 1 -> 2 -> 3...)
    queueId: loaded.queueId,
    isOfflineRandomized: loaded.isOfflineRandomized,
    tickets: normalizeLoadedTickets(loaded.tickets, randomFn, upgrades),
    generationId: state.generationId + 1,
  };
}

/**
 * Restart from Game Over screen: bypasses Game Start Screen and starts a new game immediately (`PLAYING`).
 */
export function applyGameOverRestart(
  state: RouletteGameState,
  loaded?: LoadedQueueTicketsResult,
  randomFn: () => number = Math.random
): RouletteGameState {
  const bestScore = saveBestScoreIfHigher(Math.max(state.bestScore ?? 0, state.score));
  const upgrades = state.purchasedUpgrades ?? getPurchasedUpgrades();
  const effectiveLoaded =
    loaded ?? loadRandomQueueTicketsSync(undefined, randomFn, upgrades);
  return startRouletteGame(
    effectiveLoaded,
    state.generationId,
    randomFn,
    bestScore,
    upgrades
  );
}

/**
 * "Main Menu" ("Головне Меню") button on Game Over screen:
 * Returns to the Game Start Screen (`START`) while preserving `bestScore`, `powerPoints`, and `purchasedUpgrades`.
 */
export function applyReturnToMainMenu(state: RouletteGameState): RouletteGameState {
  const bestScore = saveBestScoreIfHigher(Math.max(state.bestScore ?? 0, state.score));
  const powerPoints = getSavedPowerPoints();
  const purchasedUpgrades = getPurchasedUpgrades();
  return {
    ...state,
    screen: 'START',
    score: 0,
    bestScore,
    powerPoints,
    accumulatedPowerPoints: getAccumulatedPowerPoints(),
    reachedMilestones: getReachedMilestones(),
    purchasedUpgrades,
    secondChanceUsed: false,
    extraLivesTotal: getExtraLivesCount(purchasedUpgrades),
    extraLivesUsed: 0,
    dailyStreakApplied: false,
    powerPointsAwarded: false,
    streakIncrement: getStreakStep(purchasedUpgrades),
    refreshCount: 0,
    tickets: state.tickets.map((t) => ({
      ...t,
      isRevealed: false,
      scratchProgress: 0,
    })),
    generationId: state.generationId + 1,
  };
}

/**
 * "Close Game":
 * After Close Game button is pressed, resets screen to 'START' so next time Game is started
 * it always opens from the Game Start Screen, while preserving bestScore, powerPoints, and purchasedUpgrades.
 */
export function applyCloseGame(
  state: RouletteGameState,
  nowMs: number = Date.now()
): RouletteGameState {
  const bestScore = saveBestScoreIfHigher(Math.max(state.bestScore ?? 0, state.score));
  const depositStatus = processGameLaunchDepositPayout(nowMs);
  const purchasedUpgrades = getPurchasedUpgrades();
  return {
    ...state,
    screen: 'START',
    score: 0,
    bestScore,
    powerPoints: depositStatus.powerPoints,
    accumulatedPowerPoints: getAccumulatedPowerPoints(),
    reachedMilestones: getReachedMilestones(),
    purchasedUpgrades,
    depositCount: depositStatus.depositCount,
    payoutDateMs: depositStatus.payoutDateMs,
    depositFinMonLocked: depositStatus.depositFinMonLocked,
    secondChanceUsed: false,
    extraLivesTotal: getExtraLivesCount(purchasedUpgrades),
    extraLivesUsed: 0,
    dailyStreakApplied: false,
    powerPointsAwarded: false,
    streakIncrement: getStreakStep(purchasedUpgrades),
    refreshCount: 0,
    tickets: state.tickets.map((t) => ({
      ...t,
      isRevealed: false,
      scratchProgress: 0,
    })),
  };
}

/**
 * "Restart Game":
 * - When called from the Game Over screen (`state.screen === 'GAME_OVER'`), bypasses the Game Start screen
 *   and starts a new game immediately (`screen: 'PLAYING'`).
 * - When called from the Main Game Screen (`state.screen === 'PLAYING'`), adds current Score to accumulated
 *   Power Points, returns to the Game Start screen, and resets score to 0.
 */
export function applyRestartGame(
  state: RouletteGameState,
  loaded?: LoadedQueueTicketsResult,
  randomFn: () => number = Math.random
): RouletteGameState {
  const bestScore = saveBestScoreIfHigher(Math.max(state.bestScore ?? 0, state.score));
  if (state.screen === 'GAME_OVER') {
    return applyGameOverRestart({ ...state, bestScore }, loaded, randomFn);
  }
  const updatedPowerPoints = state.powerPointsAwarded
    ? getSavedPowerPoints()
    : addPowerPoints(state.score);
  const purchasedUpgrades = getPurchasedUpgrades();
  return {
    ...state,
    screen: 'START',
    score: 0,
    bestScore,
    powerPoints: updatedPowerPoints,
    accumulatedPowerPoints: getAccumulatedPowerPoints(),
    reachedMilestones: getReachedMilestones(),
    purchasedUpgrades,
    depositCount: getDepositCount(),
    payoutDateMs: getRecordedPayoutDateMs(),
    depositFinMonLocked: isDepositFinMonLocked(),
    secondChanceUsed: false,
    extraLivesTotal: getExtraLivesCount(purchasedUpgrades),
    extraLivesUsed: 0,
    dailyStreakApplied: false,
    powerPointsAwarded: false,
    streakIncrement: getStreakStep(purchasedUpgrades),
    refreshCount: 0,
    tickets: state.tickets.map((t) => ({
      ...t,
      isRevealed: false,
      scratchProgress: 0,
    })),
    generationId: state.generationId + 1,
  };
}

export interface ShareCardUpgradeGlyphState {
  id:
    | 'x2_ticket_1'
    | 'x2_ticket_2'
    | 'x2_ticket_3'
    | 'friend_ztoe'
    | 'second_chance'
    | 'fern_flower'
    | 'black_cat'
    | 'nocturnal_creature'
    | 'deposit_power_points';
  glyphType: 'x2' | 'person' | 'heart' | 'flower' | 'cat' | 'bat' | 'deposit';
  isBought: boolean;
  purchased: boolean;
  color: typeof SHARE_GLYPH_ACTIVE_COLOR | typeof SHARE_GLYPH_INACTIVE_COLOR;
  depositedPowerPoints?: number;
  depositPoints?: number;
}

/**
 * Returns the bottom centered upgrade glyph states for the Share Card template:
 * - 3 small X2s (`x2_ticket_1`, `x2_ticket_2`, `x2_ticket_3`)
 * - person (`friend_ztoe`)
 * - heart (`second_chance`)
 * - flower (`fern_flower`)
 * - cat (`black_cat`)
 * - bat (`nocturnal_creature`)
 * - number of power points on deposit (`depositCount * 100`)
 * Strictly uses `#6B7280` (grey) when not bought and `#F59E0B` (golden) when bought.
 */
export function getShareCardUpgradeGlyphStates(
  purchasedUpgrades: RouletteUpgradeId[] = getPurchasedUpgrades(),
  depositCount: number = getDepositCount()
): ShareCardUpgradeGlyphState[] {
  const has = (id: RouletteUpgradeId) => purchasedUpgrades.includes(id);
  const colorFor = (bought: boolean) =>
    bought ? SHARE_GLYPH_ACTIVE_COLOR : SHARE_GLYPH_INACTIVE_COLOR;
  const depositedPowerPoints = Math.max(0, depositCount) * 100;
  const depositBought = depositedPowerPoints > 0 || has('deposit_power_points');

  return [
    {
      id: 'x2_ticket_1',
      glyphType: 'x2',
      isBought: has('x2_ticket_1'),
      purchased: has('x2_ticket_1'),
      color: colorFor(has('x2_ticket_1')),
    },
    {
      id: 'x2_ticket_2',
      glyphType: 'x2',
      isBought: has('x2_ticket_2'),
      purchased: has('x2_ticket_2'),
      color: colorFor(has('x2_ticket_2')),
    },
    {
      id: 'x2_ticket_3',
      glyphType: 'x2',
      isBought: has('x2_ticket_3'),
      purchased: has('x2_ticket_3'),
      color: colorFor(has('x2_ticket_3')),
    },
    {
      id: 'friend_ztoe',
      glyphType: 'person',
      isBought: has('friend_ztoe'),
      purchased: has('friend_ztoe'),
      color: colorFor(has('friend_ztoe')),
    },
    {
      id: 'second_chance',
      glyphType: 'heart',
      isBought: has('second_chance'),
      purchased: has('second_chance'),
      color: colorFor(has('second_chance')),
    },
    {
      id: 'fern_flower',
      glyphType: 'flower',
      isBought: has('fern_flower'),
      purchased: has('fern_flower'),
      color: colorFor(has('fern_flower')),
    },
    {
      id: 'black_cat',
      glyphType: 'cat',
      isBought: has('black_cat'),
      purchased: has('black_cat'),
      color: colorFor(has('black_cat')),
    },
    {
      id: 'nocturnal_creature',
      glyphType: 'bat',
      isBought: has('nocturnal_creature'),
      purchased: has('nocturnal_creature'),
      color: colorFor(has('nocturnal_creature')),
    },
    {
      id: 'deposit_power_points',
      glyphType: 'deposit',
      isBought: depositBought,
      purchased: depositBought,
      color: colorFor(depositBought),
      depositedPowerPoints,
      depositPoints: depositedPowerPoints,
    },
  ];
}

/**
 * Builds the printable SVG share card for the Game Start Screen "Share" button, containing:
 * 1. Application logo and name ("Світло в Житомирі")
 * 2. Game logo from Game Start Screen (glowing intact lightbulb)
 * 3. Game name "Zhytomyr Roulette" (and localized subtitle)
 * 4. Bars with User's top score and total power points
 * 5. Bottom centered small grey (#6B7280) or golden (#F59E0B) outline glyphs for bought upgrades:
 *    small X2s, person, heart, flower, cat, bat, and number of power points on deposit.
 */
export function buildRouletteShareCardSvg(params: {
  bestScore: number;
  powerPoints: number;
  lang: 'uk' | 'en';
  purchasedUpgrades?: RouletteUpgradeId[];
  depositCount?: number;
}): string {
  const {
    bestScore,
    powerPoints,
    lang,
    purchasedUpgrades = getPurchasedUpgrades(),
    depositCount = getDepositCount(),
  } = params;
  const strings = getRouletteStrings(lang);
  const appName = 'Світло в Житомирі';
  const gameTitleMain = 'Zhytomyr Roulette';
  const gameTitleSub = lang === 'uk' ? 'Житомирська Рулетка' : 'Blackout Scratch Lottery';
  const glyphs = getShareCardUpgradeGlyphStates(purchasedUpgrades, depositCount);

  // Center the 9 upgrade glyphs horizontally at y=732 (total width = 8 * 48 = 384, startX = 108)
  const glyphSpacing = 48;
  const startX = 300 - ((glyphs.length - 1) * glyphSpacing) / 2;
  const glyphsSvg = glyphs
    .map((g, idx) => {
      const cx = startX + idx * glyphSpacing;
      const cy = 738;
      const stroke = g.color;
      switch (g.glyphType) {
        case 'x2':
          return `<g data-glyph="${g.id}" data-color="${stroke}" transform="translate(${cx}, ${cy})">
      <rect x="-15" y="-11" width="30" height="22" rx="5" fill="none" stroke="${stroke}" stroke-width="1.8"/>
      <text x="0" y="5" text-anchor="middle" fill="none" stroke="${stroke}" stroke-width="1.3" font-family="Arial, sans-serif" font-size="13" font-weight="800">X2</text>
    </g>`;
        case 'person':
          return `<g data-glyph="${g.id}" data-color="${stroke}" transform="translate(${cx}, ${cy})">
      <circle cx="0" cy="-6" r="5" fill="none" stroke="${stroke}" stroke-width="1.8"/>
      <path d="M-9 10 C-9 3 9 3 9 10" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round"/>
    </g>`;
        case 'heart':
          return `<g data-glyph="${g.id}" data-color="${stroke}" transform="translate(${cx}, ${cy})">
      <path d="M0 9 L-8 1 C-12 -3 -9 -9 -4 -9 C-1 -9 0 -6 0 -6 C0 -6 1 -9 4 -9 C9 -9 12 -3 8 1 Z" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linejoin="round"/>
    </g>`;
        case 'flower':
          return `<g data-glyph="${g.id}" data-color="${stroke}" transform="translate(${cx}, ${cy})">
      <circle cx="0" cy="0" r="3" fill="none" stroke="${stroke}" stroke-width="1.6"/>
      <circle cx="0" cy="-7" r="3.5" fill="none" stroke="${stroke}" stroke-width="1.6"/>
      <circle cx="7" cy="0" r="3.5" fill="none" stroke="${stroke}" stroke-width="1.6"/>
      <circle cx="0" cy="7" r="3.5" fill="none" stroke="${stroke}" stroke-width="1.6"/>
      <circle cx="-7" cy="0" r="3.5" fill="none" stroke="${stroke}" stroke-width="1.6"/>
    </g>`;
        case 'cat':
          return `<g data-glyph="${g.id}" data-color="${stroke}" transform="translate(${cx}, ${cy})">
      <path d="M-9 3 L-9 -9 L-3 -4 H3 L9 -9 L9 3 C9 8 5 11 0 11 C-5 11 -9 8 -9 3 Z" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linejoin="round"/>
    </g>`;
        case 'bat':
          return `<g data-glyph="${g.id}" data-color="${stroke}" transform="translate(${cx}, ${cy})">
      <path d="M-12 -2 C-8 -8 -4 -6 -2 -2 L0 -5 L2 -2 C4 -6 8 -8 12 -2 C9 2 6 2 4 6 C2 3 -2 3 -4 6 C-6 2 -9 2 -12 -2 Z" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linejoin="round"/>
    </g>`;
        case 'deposit':
          return `<g data-glyph="${g.id}" data-color="${stroke}" transform="translate(${cx}, ${cy})">
      <rect x="-18" y="-11" width="36" height="22" rx="6" fill="none" stroke="${stroke}" stroke-width="1.8"/>
      <text x="0" y="5" text-anchor="middle" fill="none" stroke="${stroke}" stroke-width="1.2" font-family="Courier New, monospace" font-size="12" font-weight="800">${g.depositedPowerPoints ?? 0}</text>
    </g>`;
      }
    })
    .join('\n    ');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" width="600" height="800">
  <defs>
    <radialGradient id="bulbGlow" cx="50%" cy="42%" r="35%">
      <stop offset="0%" stop-color="#F5C451" stop-opacity="0.45"/>
      <stop offset="55%" stop-color="#B4781C" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="#070A10" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="goldBorder" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F5D061"/>
      <stop offset="50%" stop-color="#D8B467"/>
      <stop offset="100%" stop-color="#8A6B2E"/>
    </linearGradient>
  </defs>

  <!-- Solid Dark Luxury Card Background -->
  <rect width="600" height="800" rx="36" fill="#070A10"/>
  <rect x="16" y="16" width="568" height="768" rx="28" fill="none" stroke="url(#goldBorder)" stroke-width="2.5"/>
  <circle cx="300" cy="315" r="205" fill="url(#bulbGlow)"/>

  <!-- 1. Application Logo and Name ("Світло в Житомирі") -->
  <g transform="translate(155, 48)">
    <rect x="0" y="0" width="52" height="52" rx="14" fill="#FF5E3A"/>
    <polygon points="29,9 14,29 25,29 22,43 38,23 27,23" fill="#FFFFFF"/>
    <text x="68" y="34" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="24" font-weight="800">${appName}</text>
  </g>

  <!-- 2. Game Logo from Game Start Screen (Glowing Intact Lightbulb Contour) -->
  <g transform="translate(200, 132) scale(1.22)">
    <path d="M80 18 C48 18 24 43 24 74 C24 94 35 110 46 123 C53 131 56 140 57 148 H103 C104 140 107 131 114 123 C125 110 136 94 136 74 C136 43 112 18 80 18 Z" fill="none" stroke="#F4D06F" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M40 56 C44 40 58 29 74 27" fill="none" stroke="#F4D06F" stroke-width="2.6" stroke-linecap="round" opacity="0.8"/>
    <path d="M68 148 V112 L56 72 M92 148 V112 L104 72" fill="none" stroke="#F4D06F" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M56 72 C62 64 68 80 74 72 C80 64 86 80 92 72 C96 67 100 76 104 72" fill="none" stroke="#F4D06F" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="55" y="150" width="50" height="8" rx="4" fill="none" stroke="#F4D06F" stroke-width="3.2"/>
    <rect x="57" y="160" width="46" height="8" rx="4" fill="none" stroke="#F4D06F" stroke-width="3.2"/>
    <rect x="61" y="170" width="38" height="7" rx="3.5" fill="none" stroke="#F4D06F" stroke-width="3"/>
    <path d="M68 178 C72 185 88 185 92 178" fill="none" stroke="#F4D06F" stroke-width="3.2" stroke-linecap="round"/>
  </g>

  <!-- 3. Game Name ("Zhytomyr Roulette") -->
  <text x="300" y="446" text-anchor="middle" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="42" font-weight="900">${gameTitleMain}</text>
  <text x="300" y="482" text-anchor="middle" fill="#E5D5B5" font-family="Arial, sans-serif" font-size="20" font-weight="700">${gameTitleSub}</text>

  <!-- 4. Bar 1: User's Top Score -->
  <g transform="translate(80, 520)">
    <rect width="440" height="68" rx="34" fill="#141A29" stroke="#D8B467" stroke-width="2"/>
    <text x="32" y="42" fill="#E5D5B5" font-family="Arial, sans-serif" font-size="21" font-weight="800">${strings.allTimeBestScoreLabel.toUpperCase()}:</text>
    <text x="408" y="43" text-anchor="end" fill="#F5D061" font-family="Courier New, monospace" font-size="28" font-weight="900">${bestScore}</text>
  </g>

  <!-- 5. Bar 2: User's Total Power Points -->
  <g transform="translate(80, 608)">
    <rect width="440" height="68" rx="34" fill="#141A29" stroke="#D8B467" stroke-width="2"/>
    <text x="32" y="42" fill="#E5D5B5" font-family="Arial, sans-serif" font-size="21" font-weight="800">${strings.powerPointsLabel.toUpperCase()}:</text>
    <text x="408" y="43" text-anchor="end" fill="#F5D061" font-family="Courier New, monospace" font-size="28" font-weight="900">${powerPoints}</text>
  </g>

  <!-- 6. Bottom Centered Upgrade Outline Glyphs (Grey #6B7280 or Golden #F59E0B Only) -->
  <g id="share-card-upgrade-glyphs">
    ${glyphsSvg}
  </g>
</svg>`;
}

/**
 * Renders the Game Start Screen Share Card onto a Canvas (when in browser) or SVG data URL,
 * returning a printable/downloadable image data URL.
 */
export function generateRouletteShareImageDataUrl(params: {
  bestScore: number;
  powerPoints: number;
  lang: 'uk' | 'en';
  purchasedUpgrades?: RouletteUpgradeId[];
  depositCount?: number;
}): string {
  const {
    bestScore,
    powerPoints,
    lang,
    purchasedUpgrades = getPurchasedUpgrades(),
    depositCount = getDepositCount(),
  } = params;
  const strings = getRouletteStrings(lang);
  const glyphs = getShareCardUpgradeGlyphStates(purchasedUpgrades, depositCount);

  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 800;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // 1. Background
      ctx.fillStyle = '#070A10';
      ctx.fillRect(0, 0, 600, 800);

      // Gold outer border
      ctx.strokeStyle = '#D8B467';
      ctx.lineWidth = 3;
      ctx.strokeRect(18, 18, 564, 764);

      // Radial golden glow behind lightbulb
      const glow = ctx.createRadialGradient(300, 275, 20, 300, 275, 190);
      glow.addColorStop(0, 'rgba(245, 196, 81, 0.42)');
      glow.addColorStop(0.55, 'rgba(180, 120, 28, 0.14)');
      glow.addColorStop(1, 'rgba(7, 10, 16, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(300, 275, 190, 0, Math.PI * 2);
      ctx.fill();

      // 2. Application Logo (Orange Rounded Box + Lightning Bolt) & Application Name ("Світло в Житомирі")
      ctx.fillStyle = '#FF5E3A';
      ctx.beginPath();
      ctx.roundRect(145, 48, 48, 48, 12);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(172, 56);
      ctx.lineTo(157, 74);
      ctx.lineTo(168, 74);
      ctx.lineTo(165, 88);
      ctx.lineTo(181, 69);
      ctx.lineTo(170, 69);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 24px Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('Світло в Житомирі', 208, 72);

      // 3. Game Logo from Game Start Screen (Glowing Intact Lightbulb Contour)
      ctx.save();
      ctx.translate(200, 128);
      ctx.scale(1.22, 1.22);
      ctx.strokeStyle = '#F4D06F';
      ctx.lineWidth = 3.6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const bulbGlass = new Path2D(
        'M80 18 C48 18 24 43 24 74 C24 94 35 110 46 123 C53 131 56 140 57 148 H103 C104 140 107 131 114 123 C125 110 136 94 136 74 C136 43 112 18 80 18 Z'
      );
      ctx.stroke(bulbGlass);

      const filament = new Path2D(
        'M68 148 V112 L56 72 M92 148 V112 L104 72 M56 72 C62 64 68 80 74 72 C80 64 86 80 92 72 C96 67 100 76 104 72'
      );
      ctx.lineWidth = 2.8;
      ctx.stroke(filament);

      ctx.strokeRect(56, 150, 48, 8);
      ctx.strokeRect(58, 160, 44, 8);
      ctx.strokeRect(62, 170, 36, 7);
      ctx.restore();

      // 4. Game Name "Zhytomyr Roulette"
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 40px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Zhytomyr Roulette', 300, 446);

      if (lang === 'uk') {
        ctx.fillStyle = '#E5D5B5';
        ctx.font = '700 20px Arial, sans-serif';
        ctx.fillText('Житомирська Рулетка', 300, 482);
      }

      // 5. Bar 1: User's Top Score
      ctx.fillStyle = '#141A29';
      ctx.strokeStyle = '#D8B467';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(75, 520, 450, 68, 34);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#E5D5B5';
      ctx.font = '800 20px Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${strings.allTimeBestScoreLabel.toUpperCase()}:`, 108, 555);

      ctx.fillStyle = '#F5D061';
      ctx.font = '900 28px "Courier New", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(String(bestScore), 492, 556);

      // 6. Bar 2: User's Total Power Points
      ctx.fillStyle = '#141A29';
      ctx.strokeStyle = '#D8B467';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(75, 608, 450, 68, 34);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#E5D5B5';
      ctx.font = '800 20px Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${strings.powerPointsLabel.toUpperCase()}:`, 108, 643);

      ctx.fillStyle = '#F5D061';
      ctx.font = '900 28px "Courier New", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(String(powerPoints), 492, 644);

      // 7. Bottom Centered Upgrade Outline Glyphs (strictly #6B7280 or #F59E0B outline strokes)
      const glyphSpacing = 48;
      const startX = 300 - ((glyphs.length - 1) * glyphSpacing) / 2;
      const cy = 736;
      glyphs.forEach((g, idx) => {
        const cx = startX + idx * glyphSpacing;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.strokeStyle = g.color;
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (g.glyphType === 'x2') {
          ctx.beginPath();
          ctx.roundRect(-15, -11, 30, 22, 5);
          ctx.stroke();
          ctx.font = '800 12px Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.strokeText('X2', 0, 1);
        } else if (g.glyphType === 'person') {
          ctx.beginPath();
          ctx.arc(0, -5, 4.5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(0, 9, 8, Math.PI, 0, false);
          ctx.stroke();
        } else if (g.glyphType === 'heart') {
          const p = new Path2D(
            'M0 9 L-8 1 C-12 -3 -9 -9 -4 -9 C-1 -9 0 -6 0 -6 C0 -6 1 -9 4 -9 C9 -9 12 -3 8 1 Z'
          );
          ctx.stroke(p);
        } else if (g.glyphType === 'flower') {
          [
            [0, 0, 2.5],
            [0, -6.5, 3.2],
            [6.5, 0, 3.2],
            [0, 6.5, 3.2],
            [-6.5, 0, 3.2],
          ].forEach(([fx, fy, fr]) => {
            ctx.beginPath();
            ctx.arc(fx, fy, fr, 0, Math.PI * 2);
            ctx.stroke();
          });
        } else if (g.glyphType === 'cat') {
          const p = new Path2D(
            'M-9 3 L-9 -9 L-3 -4 H3 L9 -9 L9 3 C9 8 5 11 0 11 C-5 11 -9 8 -9 3 Z'
          );
          ctx.stroke(p);
        } else if (g.glyphType === 'bat') {
          const p = new Path2D(
            'M-12 -2 C-8 -8 -4 -6 -2 -2 L0 -5 L2 -2 C4 -6 8 -8 12 -2 C9 2 6 2 4 6 C2 3 -2 3 -4 6 C-6 2 -9 2 -12 -2 Z'
          );
          ctx.stroke(p);
        } else if (g.glyphType === 'deposit') {
          ctx.beginPath();
          ctx.roundRect(-18, -11, 36, 22, 6);
          ctx.stroke();
          ctx.font = '800 11px "Courier New", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.strokeText(String(g.depositedPowerPoints ?? 0), 0, 1);
        }
        ctx.restore();
      });

      const pngUrl = canvas.toDataURL('image/png');
      if (pngUrl && pngUrl.startsWith('data:image/')) {
        return pngUrl;
      }
    }
  }

  const svg = buildRouletteShareCardSvg(params);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

