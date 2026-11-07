import React, { useEffect, useRef, useState, useCallback } from 'react';
import { RefreshCw, Share2 } from 'lucide-react';
import { NotificationRecord } from '../types';
import {
  GAME_BLACKOUT_DURATION_MS,
  GAME_OVER_REALIZATION_DELAY_MS,
  GENERATED_TICKET_FOIL_IMAGES,
  POWER_POINT_MILESTONES,
  PowerPointMilestone,
  ROULETTE_UPGRADES,
  RouletteGameState,
  RouletteTicket,
  RouletteUpgradeId,
  TICKET_VISUAL_VARIANTS,
  TicketStainPlacement,
  TicketVisualVariant,
  applyCloseGame,
  applyGameOverRestart,
  applyGetNewTickets,
  applyRestartGame,
  applyReturnToMainMenu,
  buildBlackCatNotificationPayload,
  canPurchaseUpgrade,
  canRefreshTickets,
  closePowerShopScreen,
  completeFadeToGameOver,
  createInitialRouletteState,
  doesScratchExposeRedCenterOutline,
  formatNewTicketsButtonWithCost,
  formatUpgradeButtonLabel,
  generateRouletteShareImageDataUrl,
  getAccumulatedPowerPoints,
  getDepositCount,
  getExtraLivesCount,
  getFlickerDurationMs,
  getHourlyTicketPairs,
  getMilestoneProgressFraction,
  getNextFlickerDelayMs,
  getNextGameBlackoutDelayMs,
  getPurchasedUpgrades,
  getReachedMilestones,
  getRouletteStrings,
  getSavedBestScore,
  getSavedPowerPoints,
  getUpgradeDescription,
  isDepositFinMonLocked,
  isMilestoneReached,
  isTicketScratchedEnough,
  loadRandomQueueTicketsSync,
  openPowerShopScreen,
  purchaseRouletteUpgrade,
  revealRouletteTicket,
  startRouletteGame,
} from '../services/rouletteGame';
import {
  isRouletteSoundEnabled,
  playBulbExplosionSound,
  playCardShuffleSound,
  playCashRegisterSound,
  playCoinSound,
  playElectricBuzzSound,
  playFlickerBuzzSound,
  playGameBlackoutSound,
  playScratchSound,
  resumeRouletteMusicIfNeeded,
  setRouletteSoundEnabled,
  syncRouletteBackgroundMusic,
} from '../services/rouletteAudio';
import { playNotificationTone, triggerDeviceVibration } from '../services/alertManager';

interface ZhytomyrRouletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'uk' | 'en';
  providerUrl?: string;
  queue?: string;
  now?: Date;
  onImitatedNotification?: (record: NotificationRecord) => void;
}

// Cache of preloaded generated ticket foil images (9 variations)
const loadedFoilImageCache: Partial<Record<TicketVisualVariant, HTMLImageElement>> = {};

function getOrLoadTicketFoilImage(
  variant: TicketVisualVariant,
  onLoadCallback?: () => void
): HTMLImageElement | null {
  if (typeof window === 'undefined' || typeof Image === 'undefined') {
    return null;
  }
  const existing = loadedFoilImageCache[variant];
  if (existing) {
    if (existing.complete && existing.naturalWidth > 0) {
      return existing;
    }
    if (onLoadCallback) {
      existing.addEventListener('load', onLoadCallback, { once: true });
    }
    return existing;
  }

  const img = new Image();
  img.referrerPolicy = 'no-referrer';
  img.src = GENERATED_TICKET_FOIL_IMAGES[variant];
  if (onLoadCallback) {
    img.addEventListener('load', onLoadCallback, { once: true });
  }
  loadedFoilImageCache[variant] = img;
  return img;
}

/**
 * Detailed contour line drawing of a vintage filament lightbulb (matches Screenshot 1 & Beige/Golden tickets)
 */
const IntactLightbulbContourSvg: React.FC<{ className?: string; strokeColor?: string }> = ({
  className = 'w-8 h-8',
  strokeColor = '#2B261F',
}) => (
  <svg
    viewBox="0 0 120 160"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="Intact Lightbulb"
  >
    {/* Outer glass bulb contour */}
    <path
      d="M60 12C33.5 12 14 31.8 14 57.5C14 73.2 21.8 86.2 32.5 96.4C38.4 102 41.5 109.2 42.2 117H77.8C78.5 109.2 81.6 102 87.5 96.4C98.2 86.2 106 73.2 106 57.5C106 31.8 86.5 12 60 12Z"
      stroke={strokeColor}
      strokeWidth="3.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Inner glass reflection highlight arcs */}
    <path
      d="M25 48C26.5 34 36.5 23.5 50 20.5"
      stroke={strokeColor}
      strokeWidth="2"
      strokeLinecap="round"
      strokeOpacity="0.65"
    />
    <path
      d="M89 82C93.5 75.5 96.5 67.5 96.5 58"
      stroke={strokeColor}
      strokeWidth="2"
      strokeLinecap="round"
      strokeOpacity="0.55"
    />
    {/* Glass stem mount at base of bulb */}
    <path
      d="M52 117V92C52 88.5 55 86 60 86C65 86 68 88.5 68 92V117"
      stroke={strokeColor}
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <ellipse cx="60" cy="76" rx="5.5" ry="2.5" stroke={strokeColor} strokeWidth="2" />
    <line x1="60" y1="78.5" x2="60" y2="86" stroke={strokeColor} strokeWidth="2" />
    {/* Tungsten filament support wires & twin loops */}
    <path
      d="M54 88L43 52C46 55 51 55 54 50C56.5 46 63.5 46 66 50C69 55 74 55 77 52L66 88"
      stroke={strokeColor}
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Screw base threads */}
    <path
      d="M42 117H78V124C78 126 42 128 42 124V117Z"
      stroke={strokeColor}
      strokeWidth="2.6"
      strokeLinejoin="round"
    />
    <path
      d="M43 126.5C52 129 68 127.5 77 125"
      stroke={strokeColor}
      strokeWidth="2.6"
      strokeLinecap="round"
    />
    <path
      d="M44 132.5C52 135 68 133.5 76 131"
      stroke={strokeColor}
      strokeWidth="2.6"
      strokeLinecap="round"
    />
    <path
      d="M46 138.5C53 140.5 67 139.5 74 137"
      stroke={strokeColor}
      strokeWidth="2.6"
      strokeLinecap="round"
    />
    {/* Bottom contact tip */}
    <path
      d="M50 141.5C53 146.5 67 146.5 70 141.5"
      stroke={strokeColor}
      strokeWidth="2.8"
      strokeLinecap="round"
    />
  </svg>
);

/**
 * Contour line drawing of an exploded/shattered lightbulb for scratched Red (blackout) tickets
 */
const ExplodedLightbulbContourSvg: React.FC<{ className?: string; strokeColor?: string }> = ({
  className = 'w-8 h-8',
  strokeColor = '#FFF5F5',
}) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="Exploded Lightbulb"
  >
    <path
      d="M21 44L16 36L22 34L18 26L25 29L27 38 M43 44L48 35L42 33L46 25L39 28L37 38"
      stroke={strokeColor}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M27 52V39L23 31 M37 52V39L41 31"
      stroke={strokeColor}
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M32 14L34.5 22L42 19L37 26L45 30L36.5 32L39 39L32 34L25 39L27.5 32L19 30L27 26L22 19L29.5 22L32 14Z"
      stroke={strokeColor}
      strokeWidth="1.9"
      strokeLinejoin="round"
    />
    <polygon points="14,16 20,13 18,20" stroke={strokeColor} strokeWidth="1.6" />
    <polygon points="50,15 44,12 46,19" stroke={strokeColor} strokeWidth="1.6" />
    <polygon points="9,28 14,25 13,31" stroke={strokeColor} strokeWidth="1.6" />
    <polygon points="55,28 50,25 51,31" stroke={strokeColor} strokeWidth="1.6" />
    <line x1="25" y1="53" x2="39" y2="53" stroke={strokeColor} strokeWidth="2.2" strokeLinecap="round" />
    <line x1="26" y1="56.5" x2="38" y2="56.5" stroke={strokeColor} strokeWidth="2.2" strokeLinecap="round" />
    <line x1="28" y1="60" x2="36" y2="60" stroke={strokeColor} strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

/**
 * Multi-frame (2.5-second, 60fps) Exploding Lightbulb Animation for Game Over screen (matches Screenshot 3)
 */
const MultiFrameExplodingBulbAnimation: React.FC = () => {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    let rafId = 0;
    const startPerf = performance.now();

    const tick = (now: number) => {
      const dt = now - startPerf;
      setElapsedMs(dt);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const explosionProgress = Math.min(1, elapsedMs / 2400);
  const shardSpread = 1 - Math.pow(1 - explosionProgress, 2.6);
  const flashIntensity =
    elapsedMs < 450
      ? 1 - elapsedMs / 450
      : 0.45 + 0.15 * Math.sin(elapsedMs * 0.014);
  const arcFrame = Math.floor(elapsedMs / 45);
  const arcJitterX = Math.sin(arcFrame * 1.9) * 5;
  const arcJitterY = Math.cos(arcFrame * 2.3) * 4;

  const shards = [
    { points: '70,34 86,20 96,38 78,46', dx: -44, dy: -36, rot: -48 },
    { points: '105,22 128,28 118,48 98,40', dx: 18, dy: -46, rot: 36 },
    { points: '128,36 148,50 134,68 116,54', dx: 48, dy: -28, rot: 54 },
    { points: '58,52 74,46 78,68 60,72', dx: -52, dy: -8, rot: -62 },
    { points: '132,68 152,76 144,98 126,88', dx: 54, dy: 8, rot: 45 },
    { points: '62,78 78,74 84,96 66,98', dx: -46, dy: 22, rot: -38 },
    { points: '118,82 136,88 128,108 112,100', dx: 42, dy: 26, rot: 40 },
    { points: '88,42 108,38 112,58 92,62', dx: -10, dy: -34, rot: -22 },
    { points: '52,32 64,24 68,38', dx: -64, dy: -42, rot: -75 },
    { points: '142,26 156,18 150,36', dx: 66, dy: -44, rot: 82 },
    { points: '46,66 56,60 54,74', dx: -68, dy: 4, rot: -64 },
    { points: '148,64 160,60 156,74', dx: 68, dy: 6, rot: 70 },
  ];

  return (
    <div
      data-testid="roulette-explosion-animation"
      className="relative w-64 h-64 flex items-center justify-center mx-auto"
    >
      {/* Radial Crimson-Amber Glow Behind Exploding Bulb */}
      <div
        className="absolute inset-4 rounded-full pointer-events-none blur-2xl"
        style={{
          background:
            'radial-gradient(circle, rgba(255,140,50,0.55) 0%, rgba(214,46,38,0.38) 45%, rgba(0,0,0,0) 75%)',
          transform: `scale(${0.85 + shardSpread * 0.35})`,
          opacity: 0.75 + flashIntensity * 0.25,
        }}
      />

      <svg
        viewBox="0 0 200 210"
        className="w-full h-full relative z-10 overflow-visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="coreBurstGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFBEB" stopOpacity="1" />
            <stop offset="32%" stopColor="#FBBF24" stopOpacity="0.92" />
            <stop offset="68%" stopColor="#DC2626" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#DC2626" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="glassShardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.42)" />
            <stop offset="50%" stopColor="rgba(148,163,184,0.22)" />
            <stop offset="100%" stopColor="rgba(220,38,38,0.28)" />
          </linearGradient>
        </defs>

        {/* Expanding Shockwave Ring (0.0s -> 2.4s) */}
        <circle
          cx="100"
          cy="82"
          r={18 + shardSpread * 74}
          stroke="#F97316"
          strokeWidth={Math.max(0.5, (1 - shardSpread) * 3.5)}
          strokeOpacity={Math.max(0, 0.85 - shardSpread * 0.8)}
        />

        {/* Central Incandescent Core Burst */}
        <circle
          cx="100"
          cy="84"
          r={26 + Math.sin(elapsedMs * 0.018) * 4}
          fill="url(#coreBurstGrad)"
        />

        {/* Dynamic Crackling Lightning Arcs (Left & Right) */}
        <path
          d={`M100 80 L${78 + arcJitterX} ${86 + arcJitterY} L${56 - arcJitterY} ${98 + arcJitterX} L${32 + arcJitterX} ${112 - arcJitterY} L18 124`}
          stroke="#FB923C"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={`M100 80 L${124 - arcJitterX} ${72 + arcJitterY} L${146 + arcJitterY} ${64 - arcJitterX} L${168 - arcJitterX} ${54 + arcJitterY} L184 48`}
          stroke="#FBBF24"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {arcFrame % 2 === 0 && (
          <path
            d={`M100 80 L${84 - arcJitterY} ${62 + arcJitterX} L${64 + arcJitterX} ${48 - arcJitterY}`}
            stroke="#FEF08A"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        )}

        {/* 12 Flying Shattered Glass Shards */}
        {shards.map((sh, idx) => {
          const tx = sh.dx * shardSpread;
          const ty = sh.dy * shardSpread + shardSpread * shardSpread * 8;
          const rot = sh.rot * shardSpread;
          return (
            <g
              key={idx}
              transform={`translate(${tx.toFixed(1)}, ${ty.toFixed(1)}) rotate(${rot.toFixed(1)} 100 78)`}
            >
              <polygon
                points={sh.points}
                fill="url(#glassShardGrad)"
                stroke="#F8FAFC"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </g>
          );
        })}

        {/* Flying Glowing Ember Particles */}
        {Array.from({ length: 14 }).map((_, i) => {
          const angle = (i / 14) * Math.PI * 2 + 0.3;
          const dist = (22 + (i % 4) * 14) * (0.35 + shardSpread * 1.15);
          const px = 100 + Math.cos(angle) * dist;
          const py = 82 + Math.sin(angle) * dist;
          return (
            <circle
              key={`ember_${i}`}
              cx={px}
              cy={py}
              r={i % 3 === 0 ? 2.2 : 1.5}
              fill={i % 2 === 0 ? '#FDE047' : '#F97316'}
              opacity={Math.max(0.2, 1 - shardSpread * 0.45)}
            />
          );
        })}

        {/* Jagged Broken Lower Glass Bulb Neck */}
        <path
          d="M72 136 C70 122 64 114 60 104 L70 96 L76 106 L82 98 M128 136 C130 122 136 114 140 104 L130 94 L122 106 L116 98"
          stroke="#F87171"
          strokeWidth="2.4"
          fill="rgba(30, 15, 18, 0.65)"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Inner Filament Stem & Glowing Broken Tungsten Wire */}
        <path
          d="M93 136 V112 C93 108 96 105 100 105 C104 105 107 108 107 112 V136"
          stroke="#F87171"
          strokeWidth="2"
        />
        <path
          d={`M95 108 L${86 + arcJitterX * 0.3} 78 L${94 - arcJitterY * 0.3} 82 L100 76 L${106 + arcJitterY * 0.3} 82 L${114 - arcJitterX * 0.3} 78 L105 108`}
          stroke="#FDE047"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Metallic Screw Base */}
        <rect
          x="74"
          y="136"
          width="52"
          height="10"
          rx="4"
          fill="#1E2028"
          stroke="#94A3B8"
          strokeWidth="2"
        />
        <rect
          x="76"
          y="147"
          width="48"
          height="9"
          rx="4"
          fill="#181A20"
          stroke="#94A3B8"
          strokeWidth="2"
        />
        <rect
          x="80"
          y="157"
          width="40"
          height="8"
          rx="4"
          fill="#14161C"
          stroke="#64748B"
          strokeWidth="1.8"
        />
        <path
          d="M88 166 C92 173 108 173 112 166 Z"
          fill="#0F1117"
          stroke="#64748B"
          strokeWidth="1.8"
        />
      </svg>
    </div>
  );
};

/**
 * Draws the unscratched lottery ticket surface using the 9 generated ticket image assets
 * (`pristine`, `wrinkled`, `deep_wrinkled`, `crumpled_scratched`, `cup_stain`, `stain_corner`,
 * `water_stains`, `heavy_wear`, `faded`) combined with randomized stain placements and profound
 * paper wrinkle creases per ticket.
 */
function drawTicketFoilSurface(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  slotLabel: string,
  variant: TicketVisualVariant,
  imgElement: HTMLImageElement | null,
  stainPlacement?: TicketStainPlacement
) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, width, height);

  const flipX = Boolean(stainPlacement?.textureFlipX);
  const flipY = Boolean(stainPlacement?.textureFlipY);

  if (imgElement && imgElement.complete && imgElement.naturalWidth > 0) {
    ctx.save();
    ctx.translate(flipX ? width : 0, flipY ? height : 0);
    ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    const sx = imgElement.naturalWidth * 0.085;
    const sy = imgElement.naturalHeight * 0.085;
    const sw = imgElement.naturalWidth * 0.83;
    const sh = imgElement.naturalHeight * 0.83;
    ctx.drawImage(imgElement, sx, sy, sw, sh, 0, 0, width, height);
    ctx.restore();
  } else {
    const baseGrad = ctx.createLinearGradient(0, 0, width, height);
    if (variant === 'faded') {
      baseGrad.addColorStop(0, '#9B8B65');
      baseGrad.addColorStop(0.5, '#DFD5B8');
      baseGrad.addColorStop(1, '#8C7A53');
    } else {
      baseGrad.addColorStop(0, '#8A7342');
      baseGrad.addColorStop(0.48, '#EFE2BA');
      baseGrad.addColorStop(1, '#755F31');
    }
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, width, height);
  }

  // Randomized Stain Placement Overlay (coffee ring, tea blotch, water droplets at randomized coordinates)
  if (stainPlacement && stainPlacement.stainIntensity > 0.05) {
    const cx = stainPlacement.stainOffsetX * width;
    const cy = stainPlacement.stainOffsetY * height;
    const radius = Math.min(width, height) * stainPlacement.stainRadiusRatio * 1.15;
    const alpha = stainPlacement.stainIntensity * 0.42;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((stainPlacement.stainRotationDeg * Math.PI) / 180);

    const stainGrad = ctx.createRadialGradient(0, 0, radius * 0.45, 0, 0, radius);
    stainGrad.addColorStop(0, `rgba(78, 44, 16, ${(alpha * 0.22).toFixed(3)})`);
    stainGrad.addColorStop(0.76, `rgba(68, 36, 12, ${(alpha * 0.85).toFixed(3)})`);
    stainGrad.addColorStop(0.92, `rgba(48, 24, 6, ${alpha.toFixed(3)})`);
    stainGrad.addColorStop(1, 'rgba(48, 24, 6, 0)');
    ctx.fillStyle = stainGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 1.08, radius * 0.92, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(62, 32, 10, ${(alpha * 0.65).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(radius * 0.85, -radius * 0.35, Math.max(2.2, radius * 0.14), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Profound Wrinkle Crease Ridges & Scratches for deeply wrinkled tickets
  if (stainPlacement && stainPlacement.wrinkleDepth >= 0.55) {
    const wAlpha = stainPlacement.wrinkleDepth * 0.34;
    ctx.save();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = `rgba(28, 18, 6, ${wAlpha.toFixed(3)})`;
    ctx.beginPath();
    const startX = width * (0.15 + stainPlacement.stainOffsetX * 0.5);
    ctx.moveTo(startX, 0);
    ctx.lineTo(startX - 14, height * 0.45);
    ctx.lineTo(startX + 9, height);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255, 247, 214, ${(wAlpha * 0.85).toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(startX + 1.5, 0);
    ctx.lineTo(startX - 12.5, height * 0.45);
    ctx.lineTo(startX + 10.5, height);
    ctx.stroke();
    ctx.restore();
  }

  // Large, Clear Timeslot Text in Distinct Condensed Display Font (matches Screenshot 2)
  ctx.font = '700 17px "Trebuchet MS", "Arial Narrow", "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = 'rgba(255, 250, 224, 0.78)';
  ctx.fillText(slotLabel, width / 2 + 0.8, height / 2 + 0.9);

  ctx.fillStyle = variant === 'faded' ? '#2B2212' : '#181206';
  ctx.fillText(slotLabel, width / 2, height / 2);

  ctx.restore();
}

interface ScratchTicketCardProps {
  ticket: RouletteTicket;
  generationId: number;
  disabled: boolean;
  isBlackoutMode?: boolean;
  onReveal: (index: number) => void;
}

/**
 * Small Heart Icon for Main Game Screen Top Header ("Second Life" & "Perseverance" upgrades):
 * - Filled when available in current game
 * - Outline only when used during current game
 */
const HeaderHeartIcon: React.FC<{ isUsed: boolean; index: number }> = ({ isUsed, index }) => (
  <svg
    data-testid={`roulette-header-heart-${index}`}
    data-state={isUsed ? 'outline' : 'filled'}
    viewBox="0 0 24 24"
    className="w-4 h-4 shrink-0 transition-all duration-300"
  >
    <path
      d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
      fill={isUsed ? 'none' : '#EF4444'}
      stroke="#EF4444"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Power Points Accumulation Progress Bar shown at the top of Game Start Screen and Game Over Screen:
 * - Milestones: 100, 200, 400, 600, 1000 labeled under the progress bar
 * - Reached milestones are visually confirmed
 * - Below milestones 400 and 1000, shows icons for the unlocked upgrades ("Daily Streak" X2 & "Perseverance" Heart)
 */
const PowerPointsMilestoneProgressBar: React.FC<{
  accumulatedPoints: number;
  reachedMilestones: PowerPointMilestone[];
  testIdPrefix: string;
}> = ({ accumulatedPoints, reachedMilestones, testIdPrefix }) => {
  const progressPct = Math.round(getMilestoneProgressFraction(accumulatedPoints) * 100);

  return (
    <div
      data-testid={`${testIdPrefix}-milestone-progress`}
      data-accumulated={accumulatedPoints}
      className="w-full pt-0.5 pb-1.5 select-none shrink-0"
    >
      {/* Progress Track */}
      <div className="relative w-full h-2.5 rounded-full bg-[#141A29] border border-[#D8B467]/50 overflow-hidden shadow-inner">
        <div
          data-testid={`${testIdPrefix}-milestone-bar-fill`}
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${progressPct}%`,
            background: 'linear-gradient(90deg, #D97706 0%, #F59E0B 55%, #FDE047 100%)',
          }}
        />
      </div>

      {/* Milestone Labels & Reached Confirmations Under Progress Bar */}
      <div className="mt-1.5 grid grid-cols-5 gap-1 w-full text-center">
        {POWER_POINT_MILESTONES.map((milestone) => {
          const reached =
            reachedMilestones.includes(milestone) || accumulatedPoints >= milestone;
          return (
            <div
              key={milestone}
              data-testid={`roulette-milestone-item-${milestone}`}
              data-reached={reached ? 'true' : 'false'}
              className="flex flex-col items-center"
            >
              <div
                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold font-mono border transition-all ${
                  reached
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.35)]'
                    : 'bg-[#141A29]/75 border-[#D8B467]/30 text-[#E5D5B5]/65'
                }`}
              >
                <span data-testid={`roulette-milestone-label-${milestone}`}>
                  {milestone}
                </span>
                {reached && (
                  <span
                    data-testid={`roulette-milestone-confirmed-${milestone}`}
                    className="text-[9px] font-black text-emerald-400 leading-none"
                  >
                    V
                  </span>
                )}
              </div>

              {/* Upgrade Reward Icons below Milestone 400 (Daily Streak X2) and Milestone 1000 (Perseverance Heart) */}
              {milestone === 400 && (
                <div
                  data-testid="roulette-milestone-icon-400"
                  className={`mt-1 inline-flex items-center justify-center w-6 h-5 rounded border text-[9px] font-black font-mono ${
                    reached
                      ? 'border-[#F5D061] text-[#F5D061] bg-[#F5D061]/15 shadow-[0_0_8px_rgba(245,208,97,0.4)]'
                      : 'border-zinc-600 text-zinc-500 bg-zinc-900/60'
                  }`}
                  title="Daily Streak (X2)"
                >
                  X2
                </div>
              )}

              {milestone === 1000 && (
                <div
                  data-testid="roulette-milestone-icon-1000"
                  className={`mt-1 inline-flex items-center justify-center w-6 h-5 rounded border ${
                    reached
                      ? 'border-[#F5D061] text-[#F5D061] bg-[#F5D061]/15 shadow-[0_0_8px_rgba(245,208,97,0.4)]'
                      : 'border-zinc-600 text-zinc-500 bg-zinc-900/60'
                  }`}
                  title="Perseverance (+1 Heart)"
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5">
                    <path
                      d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                    />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const GRID_COLS = 20;
const GRID_ROWS = 10;
const TOTAL_GRID_CELLS = GRID_COLS * GRID_ROWS; // 200 cells -> 20% = 40 cells

const ScratchTicketCard: React.FC<ScratchTicketCardProps> = ({
  ticket,
  generationId,
  disabled,
  isBlackoutMode = false,
  onReveal,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const scratchedCellsRef = useRef<Set<number>>(new Set());
  const redCenterOutlineShownRef = useRef<boolean>(false);

  const CANVAS_W = 168;
  const CANVAS_H = 74;
  // Slightly narrower scratch brush (radius 7.5px / lineWidth 15px instead of 24px) for more intrigue
  const SCRATCH_BRUSH_RADIUS = 7.5;
  const SCRATCH_LINE_WIDTH = 15;

  const variant: TicketVisualVariant =
    ticket.visualVariant ?? TICKET_VISUAL_VARIANTS[ticket.index % TICKET_VISUAL_VARIANTS.length];

  const renderUnscratchedCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (ticket.isRevealed) {
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    } else {
      const img = getOrLoadTicketFoilImage(variant, () => {
        if (!ticket.isRevealed && scratchedCellsRef.current.size === 0) {
          const currentCanvas = canvasRef.current;
          const currentCtx = currentCanvas?.getContext('2d');
          if (currentCtx) {
            drawTicketFoilSurface(
              currentCtx,
              CANVAS_W,
              CANVAS_H,
              ticket.slotLabel,
              variant,
              loadedFoilImageCache[variant] ?? null,
              ticket.stainPlacement
            );
          }
        }
      });
      drawTicketFoilSurface(
        ctx,
        CANVAS_W,
        CANVAS_H,
        ticket.slotLabel,
        variant,
        img,
        ticket.stainPlacement
      );
    }
  }, [ticket.slotLabel, ticket.isRevealed, variant, ticket.stainPlacement]);

  useEffect(() => {
    scratchedCellsRef.current.clear();
    redCenterOutlineShownRef.current = false;
    renderUnscratchedCanvas();
  }, [ticket.index, ticket.slotLabel, ticket.isRevealed, generationId, renderUnscratchedCanvas]);

  const markScratchedGridCells = useCallback(
    (x0: number, y0: number, x1: number, y1: number) => {
      const cellW = CANVAS_W / GRID_COLS;
      const cellH = CANVAS_H / GRID_ROWS;
      const rSq = (SCRATCH_BRUSH_RADIUS * 1.35) ** 2;
      const segDx = x1 - x0;
      const segDy = y1 - y0;
      const segLenSq = segDx * segDx + segDy * segDy;

      for (let row = 0; row < GRID_ROWS; row++) {
        const cy = (row + 0.5) * cellH;
        for (let col = 0; col < GRID_COLS; col++) {
          const cellId = row * GRID_COLS + col;
          if (scratchedCellsRef.current.has(cellId)) continue;
          const cx = (col + 0.5) * cellW;
          let t = 0;
          if (segLenSq > 0.001) {
            t = Math.max(0, Math.min(1, ((cx - x0) * segDx + (cy - y0) * segDy) / segLenSq));
          }
          const projX = x0 + t * segDx;
          const projY = y0 + t * segDy;
          const distSq = (cx - projX) ** 2 + (cy - projY) ** 2;
          if (distSq <= rSq) {
            scratchedCellsRef.current.add(cellId);
          }
        }
      }
    },
    []
  );

  const scratchAtPoint = useCallback(
    (clientX: number, clientY: number) => {
      if (disabled || isBlackoutMode || ticket.isRevealed) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const x = ((clientX - rect.left) / rect.width) * CANVAS_W;
      const y = ((clientY - rect.top) / rect.height) * CANVAS_H;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = SCRATCH_LINE_WIDTH;

      const prev = lastPointRef.current;
      const x0 = prev ? prev.x : x;
      const y0 = prev ? prev.y : y;
      ctx.beginPath();
      if (prev) {
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(x, y);
        markScratchedGridCells(prev.x, prev.y, x, y);
      } else {
        ctx.arc(x, y, SCRATCH_BRUSH_RADIUS, 0, Math.PI * 2);
        markScratchedGridCells(x, y, x, y);
      }
      ctx.stroke();
      ctx.fill();
      ctx.restore();

      lastPointRef.current = { x, y };
      playScratchSound(false);

      // Requirement 7: Count ticket as scratched off if red outline in center is shown (or >= 20% surface is scratched off)
      if (
        ticket.isRed &&
        doesScratchExposeRedCenterOutline(x0, y0, x, y, CANVAS_W, CANVAS_H, SCRATCH_BRUSH_RADIUS)
      ) {
        redCenterOutlineShownRef.current = true;
      }

      const scratchedFraction = scratchedCellsRef.current.size / TOTAL_GRID_CELLS;
      if (isTicketScratchedEnough(scratchedFraction, redCenterOutlineShownRef.current)) {
        onReveal(ticket.index);
      }
    },
    [disabled, isBlackoutMode, ticket.isRevealed, ticket.isRed, ticket.index, onReveal, markScratchedGridCells]
  );

  // During 10-second Main Game Screen blackout: only outlines of tickets are visible without text or scratching area
  if (isBlackoutMode) {
    return (
      <div
        data-testid={`roulette-ticket-${ticket.index}`}
        data-timeslot={ticket.slotLabel}
        data-blackout-outline="true"
        className="relative h-[74px] w-full rounded-xl overflow-hidden border border-[#C9A85C]/35 bg-[#04060A] select-none touch-none"
      />
    );
  }

  const isGoldenRevealed = Boolean(ticket.isGolden && !ticket.isRed && ticket.isRevealed);

  return (
    <div
      data-testid={`roulette-ticket-${ticket.index}`}
      data-timeslot={ticket.slotLabel}
      data-variant={variant}
      data-golden={ticket.isGolden ? 'true' : 'false'}
      data-x2={ticket.isX2 ? 'true' : 'false'}
      data-stain-x={ticket.stainPlacement?.stainOffsetX ?? 0.5}
      data-stain-y={ticket.stainPlacement?.stainOffsetY ?? 0.5}
      className="relative h-[74px] w-full rounded-xl overflow-hidden border border-[#C9A85C]/65 shadow-[0_4px_14px_rgba(0,0,0,0.5)] select-none touch-none"
      style={{
        background: isGoldenRevealed
          ? 'linear-gradient(180deg, #FDE68A 0%, #FFFBEB 48%, #F59E0B 100%)'
          : 'linear-gradient(180deg, #D8D6CC 0%, #FCFBF7 45%, #CCC9BE 100%)',
      }}
    >
      {/* Revealed Underlying Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        {ticket.isRed ? (
          /* Scratched Red ticket: red color & red outline ONLY in the center medallion so it isn't revealed too soon */
          <div
            data-testid={`roulette-ticket-red-center-${ticket.index}`}
            className="w-12 h-12 rounded-full flex items-center justify-center shadow-inner border-2 border-[#EF4444]"
            style={{
              background:
                'radial-gradient(circle, #D62E26 0%, #9E1E18 68%, rgba(216, 214, 204, 0) 100%)',
            }}
          >
            <ExplodedLightbulbContourSvg className="w-7 h-7" strokeColor="#FFF7F5" />
          </div>
        ) : ticket.isGolden ? (
          /* Scratched Golden ticket (1% or 5% chance): radiant golden medallion & bulb */
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center shadow-inner"
            style={{
              background:
                'radial-gradient(circle, rgba(251, 191, 36, 0.55) 0%, rgba(217, 119, 6, 0.25) 68%, rgba(254, 243, 199, 0) 100%)',
            }}
          >
            <IntactLightbulbContourSvg className="w-8 h-8" strokeColor="#92400E" />
          </div>
        ) : ticket.isX2 ? (
          /* Scratched X2 multiplier beige ticket: bold "X2" symbol instead of lightbulb */
          <div
            data-testid={`roulette-ticket-x2-symbol-${ticket.index}`}
            className="w-12 h-12 rounded-full flex items-center justify-center border border-[#92400E]/35"
            style={{
              background:
                'radial-gradient(circle, rgba(245, 208, 97, 0.45) 0%, rgba(217, 119, 6, 0.15) 70%, rgba(216, 214, 204, 0) 100%)',
            }}
          >
            <span className="text-xl font-black tracking-tighter text-[#78350F] font-mono">
              X2
            </span>
          </div>
        ) : (
          /* Scratched Beige ticket: contour drawing of an intact lightbulb */
          <div className="w-12 h-12 rounded-full flex items-center justify-center">
            <IntactLightbulbContourSvg className="w-8 h-8" strokeColor="#25211B" />
          </div>
        )}
        <span className="text-[10px] font-bold text-[#3D372E]/90 leading-none mt-0.5">
          {ticket.slotLabel}
        </span>
      </div>

      {/* Scratchable Generated Ticket Foil Image Layer */}
      {!ticket.isRevealed && (
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onPointerDown={(e) => {
            if (disabled) return;
            isDrawingRef.current = true;
            lastPointRef.current = null;
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              // ignore pointer capture issues on synthetic events
            }
            scratchAtPoint(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (!isDrawingRef.current || disabled) return;
            scratchAtPoint(e.clientX, e.clientY);
          }}
          onPointerUp={() => {
            isDrawingRef.current = false;
            lastPointRef.current = null;
          }}
          onPointerCancel={() => {
            isDrawingRef.current = false;
            lastPointRef.current = null;
          }}
          className="absolute inset-0 w-full h-full cursor-pointer touch-none"
        />
      )}
    </div>
  );
};

export const ZhytomyrRouletteModal: React.FC<ZhytomyrRouletteModalProps> = ({
  isOpen,
  onClose,
  lang,
  providerUrl,
  queue = '1.1',
  now,
  onImitatedNotification,
}) => {
  const strings = getRouletteStrings(lang);
  const [gameState, setGameState] = useState<RouletteGameState>(() =>
    createInitialRouletteState()
  );
  // Inner screen transition fade-out / fade-in opacity (outer modal stays 100% opaque #070A10 so Main App UI is NEVER visible)
  const [screenOpacity, setScreenOpacity] = useState(1);
  // Top-to-bottom ticket dealing animation visible row count (0..24)
  const [dealtRowsCount, setDealtRowsCount] = useState(24);
  // Slow 2-3s voltage brownout flicker overlay opacity
  const [flickerOverlayAlpha, setFlickerOverlayAlpha] = useState(0);
  // Share Image Preview Data URL when user clicks "Share" on Game Start Screen
  const [sharePreviewDataUrl, setSharePreviewDataUrl] = useState<string | null>(null);
  // Controls whether the black fade-to-game-over overlay is opaque (starts after 1s realization delay)
  const [isFadeOverlayOpaque, setIsFadeOverlayOpaque] = useState(false);
  // 10-second Main Game Screen blackout state (triggered every 5-10 minutes during PLAYING)
  const [isGameBlackoutActive, setIsGameBlackoutActive] = useState(false);
  // Sound & Music On/Off switch state on Game Start Screen (persisted in localStorage)
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() =>
    isRouletteSoundEnabled()
  );

  const realizationTimerRef = useRef<number | null>(null);
  const fadeTimerRef = useRef<number | null>(null);
  const dealIntervalRef = useRef<number | null>(null);
  const screenTransitionTimerRef = useRef<number | null>(null);
  const blackCatTimerRef = useRef<number | null>(null);
  const gameBlackoutEndTimerRef = useRef<number | null>(null);
  const nowRef = useRef<Date | undefined>(now);
  nowRef.current = now;

  useEffect(() => {
    TICKET_VISUAL_VARIANTS.forEach((v) => {
      getOrLoadTicketFoilImage(v);
    });
    return () => {
      if (realizationTimerRef.current) window.clearTimeout(realizationTimerRef.current);
      if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);
      if (dealIntervalRef.current) window.clearInterval(dealIntervalRef.current);
      if (screenTransitionTimerRef.current)
        window.clearTimeout(screenTransitionTimerRef.current);
      if (blackCatTimerRef.current) window.clearTimeout(blackCatTimerRef.current);
      if (gameBlackoutEndTimerRef.current)
        window.clearTimeout(gameBlackoutEndTimerRef.current);
    };
  }, []);

  // Listen for Emulator Control setting Power Points (e.g., to 9999 or +100) or resetting all progress so open Roulette screens update live
  useEffect(() => {
    const handlePowerPointsUpdated = (ev: Event) => {
      const customEv = ev as CustomEvent<{ powerPoints?: number }>;
      const updated = customEv.detail?.powerPoints ?? getSavedPowerPoints();
      const upgrades = getPurchasedUpgrades();
      setGameState((prev) => ({
        ...prev,
        powerPoints: updated,
        accumulatedPowerPoints: getAccumulatedPowerPoints(),
        reachedMilestones: getReachedMilestones(),
        bestScore: getSavedBestScore(),
        purchasedUpgrades: upgrades,
        extraLivesTotal: getExtraLivesCount(upgrades),
        depositCount: getDepositCount(),
        depositFinMonLocked: isDepositFinMonLocked(),
      }));
    };
    const handleProgressReset = () => {
      setIsGameBlackoutActive(false);
      setSoundEnabledState(isRouletteSoundEnabled());
      setGameState(createInitialRouletteState());
    };
    const handleTriggerGameBlackout = () => {
      if (gameBlackoutEndTimerRef.current) {
        window.clearTimeout(gameBlackoutEndTimerRef.current);
      }
      setIsGameBlackoutActive(true);
      playGameBlackoutSound();
      gameBlackoutEndTimerRef.current = window.setTimeout(() => {
        setIsGameBlackoutActive(false);
        playFlickerBuzzSound();
      }, GAME_BLACKOUT_DURATION_MS);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('zt-roulette-power-points-updated', handlePowerPointsUpdated);
      window.addEventListener('zt-roulette-progress-reset', handleProgressReset);
      window.addEventListener('zt-roulette-trigger-game-blackout', handleTriggerGameBlackout);
      return () => {
        window.removeEventListener('zt-roulette-power-points-updated', handlePowerPointsUpdated);
        window.removeEventListener('zt-roulette-progress-reset', handleProgressReset);
        window.removeEventListener('zt-roulette-trigger-game-blackout', handleTriggerGameBlackout);
      };
    }
  }, []);

  // Ensure every time the game modal opens after being closed, it starts on the Game Start Screen ('START')
  // and processes any 24h Deposit Power Points payout or AntiCheat clock rollback check
  useEffect(() => {
    if (isOpen) {
      setSharePreviewDataUrl(null);
      setIsGameBlackoutActive(false);
      setSoundEnabledState(isRouletteSoundEnabled());
      const effectiveNowMs = nowRef.current ? nowRef.current.getTime() : Date.now();
      setGameState((prev) => applyCloseGame(prev, effectiveNowMs));
    }
  }, [isOpen]);

  // Synchronize background music with current screen ('START'/'SHOP'/'GAME_OVER' vs 'PLAYING'/'FADING_TO_BLACK'),
  // modal open state, and Sound On/Off switch using smooth fade-in / fade-out at 15% volume.
  useEffect(() => {
    syncRouletteBackgroundMusic(gameState.screen, isOpen, soundEnabled);
  }, [gameState.screen, isOpen, soundEnabled]);

  // Ensure music fades out cleanly if the modal component unmounts
  useEffect(() => {
    return () => {
      syncRouletteBackgroundMusic('START', false, false);
    };
  }, []);

  const handleToggleSound = useCallback(() => {
    setSoundEnabledState((prev) => {
      const next = setRouletteSoundEnabled(!prev);
      return next;
    });
  }, []);

  // Trigger top-to-bottom ticket drawing animation + card deck shuffling sound
  const runTopToBottomDealAnimation = useCallback(() => {
    if (dealIntervalRef.current) {
      window.clearInterval(dealIntervalRef.current);
    }
    playCardShuffleSound();
    setDealtRowsCount(0);
    let currentRow = 0;
    dealIntervalRef.current = window.setInterval(() => {
      currentRow += 2;
      if (currentRow >= 24) {
        setDealtRowsCount(24);
        if (dealIntervalRef.current) {
          window.clearInterval(dealIntervalRef.current);
          dealIntervalRef.current = null;
        }
      } else {
        setDealtRowsCount(currentRow);
      }
    }, 24);
  }, []);

  // Slow 2-3 second voltage brownout flickering every 15-30 seconds on all screens EXCEPT Game Over
  // Plays 20% volume electric buzz sound during screen flickering
  useEffect(() => {
    if (!isOpen || gameState.screen === 'GAME_OVER') {
      setFlickerOverlayAlpha(0);
      return;
    }

    let timeoutId: number;
    const flickerSeqTimers: number[] = [];

    const scheduleNextFlicker = () => {
      const delayMs = getNextFlickerDelayMs();
      timeoutId = window.setTimeout(() => {
        const totalDurationMs = getFlickerDurationMs();
        playFlickerBuzzSound(totalDurationMs);
        setFlickerOverlayAlpha(0.45);
        flickerSeqTimers.push(
          window.setTimeout(() => setFlickerOverlayAlpha(0.16), Math.round(totalDurationMs * 0.24)),
          window.setTimeout(() => setFlickerOverlayAlpha(0.55), Math.round(totalDurationMs * 0.52)),
          window.setTimeout(() => setFlickerOverlayAlpha(0.22), Math.round(totalDurationMs * 0.78)),
          window.setTimeout(() => {
            setFlickerOverlayAlpha(0);
            scheduleNextFlicker();
          }, totalDurationMs)
        );
      }, delayMs);
    };

    scheduleNextFlicker();

    return () => {
      window.clearTimeout(timeoutId);
      flickerSeqTimers.forEach((id) => window.clearTimeout(id));
    };
  }, [isOpen, gameState.screen]);

  // Requirement 13: During game on Main Game Screen at random intervals of 5-10 minutes trigger 10-second "blackout":
  // screen fades to almost black and only outlines of tickets are visible without text or scratching area.
  // When triggered - play same sound as Game Over event with 30% volume, when screen returns back to normal - play small buzzing sound as during screen flickering.
  useEffect(() => {
    if (!isOpen || gameState.screen !== 'PLAYING') {
      setIsGameBlackoutActive(false);
      if (gameBlackoutEndTimerRef.current) {
        window.clearTimeout(gameBlackoutEndTimerRef.current);
        gameBlackoutEndTimerRef.current = null;
      }
      return;
    }

    let nextBlackoutTimerId: number;

    const scheduleNextGameBlackout = () => {
      const delayMs = getNextGameBlackoutDelayMs();
      nextBlackoutTimerId = window.setTimeout(() => {
        setIsGameBlackoutActive(true);
        playGameBlackoutSound();
        gameBlackoutEndTimerRef.current = window.setTimeout(() => {
          setIsGameBlackoutActive(false);
          playFlickerBuzzSound();
          scheduleNextGameBlackout();
        }, GAME_BLACKOUT_DURATION_MS);
      }, delayMs);
    };

    scheduleNextGameBlackout();

    return () => {
      window.clearTimeout(nextBlackoutTimerId);
      if (gameBlackoutEndTimerRef.current) {
        window.clearTimeout(gameBlackoutEndTimerRef.current);
        gameBlackoutEndTimerRef.current = null;
      }
    };
  }, [isOpen, gameState.screen]);

  const withScreenFadeTransition = useCallback((action: () => void) => {
    setScreenOpacity(0);
    if (screenTransitionTimerRef.current) {
      window.clearTimeout(screenTransitionTimerRef.current);
    }
    screenTransitionTimerRef.current = window.setTimeout(() => {
      action();
      setScreenOpacity(1);
    }, 180);
  }, []);

  // Close Game button handler: resets game screen to START so next time Game is started from Game Start Screen
  const handleCloseGame = useCallback(() => {
    if (realizationTimerRef.current) {
      window.clearTimeout(realizationTimerRef.current);
      realizationTimerRef.current = null;
    }
    if (fadeTimerRef.current) {
      window.clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
    setIsFadeOverlayOpaque(false);
    setIsGameBlackoutActive(false);
    setSharePreviewDataUrl(null);
    const effectiveNowMs = nowRef.current ? nowRef.current.getTime() : Date.now();
    setGameState((prev) => applyCloseGame(prev, effectiveNowMs));
    onClose();
  }, [onClose]);

  const [selectedShareApp, setSelectedShareApp] = useState<string | null>(null);

  // Share button on top-right corner of Game Start Screen: generates image with Application logo and name,
  // Game logo from Game Start Screen (lightbulb), name "Zhytomyr Roulette", bars with top score & power points,
  // and bottom centered grey/golden outline glyphs for bought upgrades, and opens the Share Card with the
  // standard mobile "Share to... Application" dialog.
  const handleShareScoreCard = useCallback(() => {
    const bestScore = Math.max(gameState.bestScore ?? 0, getSavedBestScore());
    const powerPoints = Math.max(gameState.powerPoints ?? 0, getSavedPowerPoints());
    const purchasedUpgrades = gameState.purchasedUpgrades ?? getPurchasedUpgrades();
    const depositCount = gameState.depositCount ?? getDepositCount();
    const dataUrl = generateRouletteShareImageDataUrl({
      bestScore,
      powerPoints,
      lang,
      purchasedUpgrades,
      depositCount,
    });
    setSelectedShareApp(null);
    setSharePreviewDataUrl(dataUrl);
  }, [
    gameState.bestScore,
    gameState.powerPoints,
    gameState.purchasedUpgrades,
    gameState.depositCount,
    lang,
  ]);

  const handleShareToApplication = useCallback(
    async (appName: string) => {
      setSelectedShareApp(appName);
      if (!sharePreviewDataUrl) return;

      const bestScore = Math.max(gameState.bestScore ?? 0, getSavedBestScore());
      const powerPoints = Math.max(gameState.powerPoints ?? 0, getSavedPowerPoints());
      const shareText =
        lang === 'en'
          ? `Zhytomyr Roulette — Best Score: ${bestScore}, Power Points: ${powerPoints}`
          : `Житомирська Рулетка — Найкращий Результат: ${bestScore}, Бали Потужності: ${powerPoints}`;

      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        try {
          await navigator.share({
            title: 'Zhytomyr Roulette',
            text: shareText,
          });
          return;
        } catch {
          // Fall back to downloading the share card image if Web Share API is cancelled or unsupported
        }
      }

      if (typeof document !== 'undefined') {
        try {
          const link = document.createElement('a');
          link.href = sharePreviewDataUrl;
          link.download = 'zhytomyr-roulette-score.png';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } catch {
          // Ignore download errors in headless environments
        }
      }
    },
    [sharePreviewDataUrl, gameState.bestScore, gameState.powerPoints, lang]
  );

  // Open Power Shop screen ("Магазин Потужності" / "Power Shop")
  const handleOpenShop = useCallback(() => {
    withScreenFadeTransition(() => {
      setGameState((prev) => openPowerShopScreen(prev));
    });
  }, [withScreenFadeTransition]);

  // Return from Power Shop screen to Game Start screen
  const handleCloseShop = useCallback(() => {
    withScreenFadeTransition(() => {
      setGameState((prev) => closePowerShopScreen(prev));
    });
  }, [withScreenFadeTransition]);

  // Purchase upgrade in Power Shop
  const handlePurchaseUpgrade = useCallback(
    (upgradeId: RouletteUpgradeId) => {
      const effectiveNowMs = now ? now.getTime() : Date.now();
      setGameState((prev) => {
        const { nextState, purchased, triggerBlackCatNotification } =
          purchaseRouletteUpgrade(prev, upgradeId, effectiveNowMs);
        if (purchased) {
          playCashRegisterSound();
          if (triggerBlackCatNotification) {
            if (blackCatTimerRef.current) {
              window.clearTimeout(blackCatTimerRef.current);
            }
            blackCatTimerRef.current = window.setTimeout(() => {
              const effectiveDate = now ?? new Date();
              const payload = buildBlackCatNotificationPayload(
                effectiveDate,
                queue,
                lang
              );
              if (isRouletteSoundEnabled()) {
                playNotificationTone();
              }
              triggerDeviceVibration();
              if (onImitatedNotification) {
                onImitatedNotification({
                  id: `black_cat_${Date.now()}`,
                  slotId: `black_cat_slot_${Date.now()}`,
                  timestamp: Date.now(),
                  title: payload.title,
                  message: payload.message,
                  queue,
                  advanceMinutes: payload.minutesUntilMidnight,
                });
              }
            }, 3000);
          }
        }
        return nextState;
      });
    },
    [now, queue, lang, onImitatedNotification]
  );

  // Instant ticket loading from cached queue + top-to-bottom dealing animation
  const handleStartGame = useCallback(() => {
    if (realizationTimerRef.current) {
      window.clearTimeout(realizationTimerRef.current);
      realizationTimerRef.current = null;
    }
    if (fadeTimerRef.current) {
      window.clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
    setIsFadeOverlayOpaque(false);
    setIsGameBlackoutActive(false);
    const upgrades = getPurchasedUpgrades();
    const loaded = loadRandomQueueTicketsSync(providerUrl, Math.random, upgrades);
    withScreenFadeTransition(() => {
      setGameState((prev) =>
        startRouletteGame(loaded, prev.generationId, Math.random, prev.bestScore, upgrades)
      );
      runTopToBottomDealAnimation();
    });
  }, [providerUrl, withScreenFadeTransition, runTopToBottomDealAnimation]);

  const handleGetNewTickets = useCallback(() => {
    if (gameState.screen !== 'PLAYING') return;
    if (!canRefreshTickets(gameState.score, gameState.refreshCount)) return;
    const upgrades = gameState.purchasedUpgrades ?? getPurchasedUpgrades();
    const loaded = loadRandomQueueTicketsSync(providerUrl, Math.random, upgrades);
    setGameState((prev) => applyGetNewTickets(prev, loaded));
    runTopToBottomDealAnimation();
  }, [
    gameState.screen,
    gameState.score,
    gameState.refreshCount,
    gameState.purchasedUpgrades,
    providerUrl,
    runTopToBottomDealAnimation,
  ]);

  // Active Game screen Restart button -> returns to Game Start Screen, adds current score to Power Points, and resets score to 0
  const handleRestartToStartScreen = useCallback(() => {
    if (realizationTimerRef.current) {
      window.clearTimeout(realizationTimerRef.current);
      realizationTimerRef.current = null;
    }
    if (fadeTimerRef.current) {
      window.clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
    setIsFadeOverlayOpaque(false);
    setIsGameBlackoutActive(false);
    withScreenFadeTransition(() => {
      setGameState((prev) => applyRestartGame({ ...prev, screen: 'PLAYING' }));
    });
  }, [withScreenFadeTransition]);

  // Game Over screen Main Menu ("Головне Меню") button -> returns to Game Start Screen
  const handleReturnToMainMenu = useCallback(() => {
    if (realizationTimerRef.current) {
      window.clearTimeout(realizationTimerRef.current);
      realizationTimerRef.current = null;
    }
    if (fadeTimerRef.current) {
      window.clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
    setIsFadeOverlayOpaque(false);
    setIsGameBlackoutActive(false);
    withScreenFadeTransition(() => {
      setGameState((prev) => applyReturnToMainMenu(prev));
    });
  }, [withScreenFadeTransition]);

  // Game Over screen Restart button -> bypasses Game Start Screen and starts a new game immediately
  const handleGameOverRestartImmediately = useCallback(() => {
    if (realizationTimerRef.current) {
      window.clearTimeout(realizationTimerRef.current);
      realizationTimerRef.current = null;
    }
    if (fadeTimerRef.current) {
      window.clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
    setIsFadeOverlayOpaque(false);
    setIsGameBlackoutActive(false);
    const upgrades = gameState.purchasedUpgrades ?? getPurchasedUpgrades();
    const loaded = loadRandomQueueTicketsSync(providerUrl, Math.random, upgrades);
    withScreenFadeTransition(() => {
      setGameState((prev) => applyGameOverRestart(prev, loaded));
      runTopToBottomDealAnimation();
    });
  }, [gameState.purchasedUpgrades, providerUrl, withScreenFadeTransition, runTopToBottomDealAnimation]);

  const handleTicketReveal = useCallback((ticketIndex: number) => {
    // Play scratching sound when ticket is scratched off
    playScratchSound(true);
    const effectiveNowMs = nowRef.current ? nowRef.current.getTime() : Date.now();
    setGameState((prev) => {
      const { nextState, outcome } = revealRouletteTicket(prev, ticketIndex, effectiveNowMs);
      if (outcome === 'BEIGE' || outcome === 'X2' || outcome === 'GOLDEN') {
        playCoinSound();
        if (outcome === 'GOLDEN' || outcome === 'X2') {
          window.setTimeout(() => playCoinSound(), 110);
          if (outcome === 'GOLDEN') {
            window.setTimeout(() => playCoinSound(), 220);
          }
        }
      } else if (outcome === 'RED') {
        // 1-second realization delay to let User realize the scratching result before Game Over fade-to-black
        setIsFadeOverlayOpaque(false);
        if (realizationTimerRef.current) {
          window.clearTimeout(realizationTimerRef.current);
        }
        if (fadeTimerRef.current) {
          window.clearTimeout(fadeTimerRef.current);
        }
        realizationTimerRef.current = window.setTimeout(() => {
          // Stage 1: Electric buzzing while screen fades to black
          setIsFadeOverlayOpaque(true);
          playElectricBuzzSound(750);
          fadeTimerRef.current = window.setTimeout(() => {
            // Stage 2: Sound of exploding lightbulb along with 2s+ animation
            playBulbExplosionSound();
            setIsFadeOverlayOpaque(false);
            setGameState((s) => completeFadeToGameOver(s));
          }, 750);
        }, GAME_OVER_REALIZATION_DELAY_MS);
      }
      return nextState;
    });
  }, []);

  if (!isOpen) return null;

  const hourlyPairs = getHourlyTicketPairs(gameState.tickets);
  const newTicketsButtonLabel = formatNewTicketsButtonWithCost(
    lang,
    gameState.refreshCount
  );
  const currentBestScore = Math.max(gameState.bestScore ?? 0, getSavedBestScore());
  const currentPowerPoints = gameState.depositFinMonLocked
    ? getSavedPowerPoints()
    : Math.max(gameState.powerPoints ?? 0, getSavedPowerPoints());
  const currentAccumulatedPoints = Math.max(
    gameState.accumulatedPowerPoints ?? 0,
    getAccumulatedPowerPoints()
  );
  const currentReachedMilestones =
    gameState.reachedMilestones && gameState.reachedMilestones.length > 0
      ? gameState.reachedMilestones
      : getReachedMilestones();
  const currentUpgrades = gameState.purchasedUpgrades ?? getPurchasedUpgrades();
  const currentDepositCount = gameState.depositCount ?? getDepositCount();
  const currentFinMonLocked = Boolean(
    gameState.depositFinMonLocked ?? isDepositFinMonLocked()
  );
  const extraLivesTotal =
    gameState.extraLivesTotal ?? getExtraLivesCount(currentUpgrades);
  const extraLivesUsed =
    gameState.extraLivesUsed ?? (gameState.secondChanceUsed ? 1 : 0);
  const isRefreshAffordable = canRefreshTickets(
    gameState.score,
    gameState.refreshCount
  );

  return (
    <div
      data-testid="zhytomyr-roulette-modal"
      onPointerDown={() => resumeRouletteMusicIfNeeded()}
      className="absolute inset-0 top-9 z-50 flex flex-col bg-[#070A10] text-white select-none overflow-hidden"
    >
      {/* Preloaded generated ticket texture assets */}
      <div className="hidden" aria-hidden="true">
        {TICKET_VISUAL_VARIANTS.map((variant) => (
          <img
            key={variant}
            src={GENERATED_TICKET_FOIL_IMAGES[variant]}
            alt={`Ticket texture ${variant}`}
            referrerPolicy="no-referrer"
          />
        ))}
      </div>

      {/* Inner Screen Wrapper: Fades out/in against solid #070A10 modal background so Main Application UI is never visible */}
      <div
        data-testid="roulette-screen-transition-wrapper"
        className="flex-1 flex flex-col w-full h-full relative transition-opacity duration-200 overflow-hidden"
        style={{ opacity: screenOpacity }}
      >
        {/* 1. GAME START SCREEN */}
        {gameState.screen === 'START' && (
          <div
            data-testid="roulette-start-screen"
            className="relative flex-1 flex flex-col items-center justify-between px-5 pt-3 pb-5 text-center max-w-md mx-auto w-full overflow-y-auto"
          >
            {/* Top Progress Bar Counting Total Power Points Accumulation Progress (100, 200, 400, 600, 1000) */}
            <PowerPointsMilestoneProgressBar
              accumulatedPoints={currentAccumulatedPoints}
              reachedMilestones={currentReachedMilestones}
              testIdPrefix="roulette-start"
            />

            {/* Top Bar: Sound On/Off Switch on Left side across from Share Button on Right side */}
            <div className="w-full flex items-center justify-between shrink-0 mt-1">
              {/* Sound On/Off Switch (en: Sound / uk: Звук) on Left side using exact same design and colors as notification switches in main application */}
              <div
                data-testid="roulette-sound-control"
                className="flex items-center gap-2 pl-0.5"
              >
                <span
                  data-testid="roulette-sound-label"
                  className="text-xs font-medium text-white/90"
                >
                  {strings.soundLabel}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={soundEnabled}
                  aria-label={strings.soundLabel}
                  data-testid="roulette-sound-switch"
                  onClick={handleToggleSound}
                  className={`w-12 h-6 rounded-full transition-all duration-300 relative cursor-pointer ${
                    soundEnabled
                      ? 'bg-[#FF5E3A] shadow-md shadow-[#FF5E3A]/30'
                      : 'bg-white/10 border border-white/10'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-md absolute top-0.5 transition-transform duration-300 ${
                      soundEnabled ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              <button
                type="button"
                data-testid="roulette-share-btn"
                onClick={handleShareScoreCard}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#141A29]/90 hover:bg-white/10 text-xs font-bold text-[#F5D061] border border-[#D8B467]/65 shadow-md transition-all active:scale-95 cursor-pointer"
                title={strings.shareButton}
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{strings.shareButton}</span>
              </button>
            </div>

            {/* Large Centered Glowing Lightbulb Contour + Big Game Name Text */}
            <div className="flex-1 flex flex-col items-center justify-center w-full">
              <div className="relative w-36 h-40 flex items-center justify-center mb-1">
                <div
                  className="absolute inset-0 rounded-full blur-2xl pointer-events-none"
                  style={{
                    background:
                      'radial-gradient(circle, rgba(245, 196, 81, 0.38) 0%, rgba(180, 120, 28, 0.14) 52%, rgba(0, 0, 0, 0) 76%)',
                  }}
                />
                <IntactLightbulbContourSvg
                  className="w-32 h-36 relative z-10 drop-shadow-[0_0_16px_rgba(253,224,71,0.45)]"
                  strokeColor="#F4D06F"
                />
              </div>

              <h2 className="text-[28px] leading-[1.12] font-extrabold tracking-tight text-white max-w-[280px]">
                {strings.gameTitle}
              </h2>
              <p className="text-xs leading-relaxed text-zinc-300/85 mt-1.5 max-w-[290px]">
                {strings.startSubtitle}
              </p>

              {/* All-Time Best Score & Power Points Bars on Game Start Screen */}
              <div className="mt-2.5 flex flex-col items-center gap-2 w-full max-w-[280px]">
                <div
                  data-testid="roulette-best-score"
                  className="w-full px-4 py-1.5 rounded-full bg-[#141A29]/90 border border-[#D8B467]/55 flex items-center justify-between gap-2 shadow-md"
                >
                  <span className="text-xs font-bold uppercase tracking-wider text-[#E5D5B5]">
                    {strings.allTimeBestScoreLabel}:
                  </span>
                  <span className="text-base font-extrabold font-mono text-[#F5D061]">
                    {currentBestScore}
                  </span>
                </div>

                {/* Power Points ("Бали Потужності" / "Power Points") in same style as All Time Best Score bar */}
                <div
                  data-testid="roulette-power-points"
                  className="w-full px-4 py-1.5 rounded-full bg-[#141A29]/90 border border-[#D8B467]/55 flex items-center justify-between gap-2 shadow-md"
                >
                  <span className="text-xs font-bold uppercase tracking-wider text-[#E5D5B5]">
                    {strings.powerPointsLabel}:
                  </span>
                  <span className="text-base font-extrabold font-mono text-[#F5D061]">
                    {currentPowerPoints}
                  </span>
                </div>
              </div>
            </div>

            {/* Start, Power Shop & Close Game Vertical Pill Buttons (hidden while Share Card dialog is open so buttons on the bottom never overlap with the dialog) */}
            {!sharePreviewDataUrl && (
              <div className="w-full flex flex-col gap-2.5 pt-2.5">
                <button
                  type="button"
                  data-testid="roulette-start-btn"
                  onClick={handleStartGame}
                  className="w-full py-3.5 px-5 rounded-full font-bold text-sm text-white shadow-lg transition-transform active:scale-[0.98] cursor-pointer"
                  style={{
                    background: 'linear-gradient(90deg, #A3221C 0%, #C93B2B 50%, #9E1E18 100%)',
                    border: '1.5px solid #D8B467',
                  }}
                >
                  {strings.startButton}
                </button>

                <button
                  type="button"
                  data-testid="roulette-shop-btn"
                  onClick={handleOpenShop}
                  className="w-full py-3.5 px-5 rounded-full font-bold text-sm text-[#E5D5B5] bg-[#141A29]/85 hover:bg-white/10 transition-all cursor-pointer"
                  style={{
                    border: '1.3px solid rgba(216, 180, 103, 0.75)',
                  }}
                >
                  {strings.powerShopButton}
                </button>

                <button
                  type="button"
                  data-testid="roulette-close-btn"
                  onClick={handleCloseGame}
                  className="w-full py-3.5 px-5 rounded-full font-bold text-sm text-[#E5D5B5] bg-transparent hover:bg-white/5 transition-all cursor-pointer"
                  style={{
                    border: '1.2px solid rgba(216, 180, 103, 0.55)',
                  }}
                >
                  {strings.closeGameButton}
                </button>
              </div>
            )}

            {/* Share Printed Image Modal Overlay with Standard Mobile "Share to... Application" Dialog and Non-Overlapping Bottom Buttons */}
            {sharePreviewDataUrl && (
              <div
                data-testid="roulette-share-modal"
                className="absolute inset-0 z-50 bg-[#070A10] flex flex-col items-center justify-between px-4 pt-3 pb-4 overflow-y-auto gap-2.5"
              >
                <div className="shrink-0 text-xs font-extrabold text-[#F5D061] uppercase tracking-wider">
                  Zhytomyr Roulette — Share Card
                </div>

                <div className="flex-1 min-h-[160px] max-h-[260px] w-full flex items-center justify-center overflow-hidden">
                  <img
                    data-testid="roulette-share-image"
                    src={sharePreviewDataUrl}
                    alt="Zhytomyr Roulette Share Card"
                    className="max-h-full max-w-full object-contain rounded-2xl border border-[#D8B467]/60 shadow-2xl"
                  />
                </div>

                {/* Standard Mobile "Share to... Application" Dialog Sheet (positioned in flex flow above bottom buttons so they never overlap) */}
                <div
                  data-testid="roulette-share-to-app-dialog"
                  role="dialog"
                  aria-label="Share to... Application"
                  className="shrink-0 w-full rounded-2xl bg-[#141A29]/95 border border-[#D8B467]/50 px-3 py-2.5 shadow-xl"
                >
                  <div className="w-8 h-1 rounded-full bg-zinc-500/60 mx-auto mb-1.5" />
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-[#E5D5B5] tracking-wide">
                      {lang === 'en'
                        ? 'Share to... Application'
                        : 'Поділитися... (Share to... Application)'}
                    </span>
                    {selectedShareApp && (
                      <span
                        data-testid="roulette-share-app-status"
                        className="text-[10px] font-bold text-emerald-400"
                      >
                        {lang === 'en'
                          ? `Shared: ${selectedShareApp}`
                          : `Обрано: ${selectedShareApp}`}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[
                      { id: 'telegram', label: 'Telegram', badge: 'TG', color: '#229ED9' },
                      { id: 'viber', label: 'Viber', badge: 'VB', color: '#7360F2' },
                      { id: 'whatsapp', label: 'WhatsApp', badge: 'WA', color: '#25D366' },
                      { id: 'instagram', label: 'Instagram', badge: 'IG', color: '#E1306C' },
                      { id: 'messages', label: 'Messages', badge: 'SMS', color: '#3B82F6' },
                    ].map((app) => (
                      <button
                        key={app.id}
                        type="button"
                        data-testid={`roulette-share-app-${app.id}`}
                        onClick={() => handleShareToApplication(app.label)}
                        className="flex flex-col items-center gap-1 py-1.5 px-1 rounded-xl hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                      >
                        <span
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-extrabold text-white shadow-md border border-white/20"
                          style={{ backgroundColor: app.color }}
                        >
                          {app.badge}
                        </span>
                        <span className="text-[9px] font-semibold text-zinc-200 truncate max-w-full">
                          {app.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Non-overlapping Bottom Action Buttons */}
                <div
                  data-testid="roulette-share-bottom-buttons"
                  className="shrink-0 w-full flex flex-col gap-2 pt-0.5"
                >
                  <a
                    href={sharePreviewDataUrl}
                    download="zhytomyr-roulette-score.png"
                    className="w-full py-2.5 px-4 rounded-full font-bold text-xs text-white text-center shadow-lg"
                    style={{
                      background: 'linear-gradient(90deg, #A3221C 0%, #C93B2B 50%, #9E1E18 100%)',
                      border: '1.5px solid #D8B467',
                    }}
                  >
                    {lang === 'en' ? 'Download Image' : 'Завантажити зображення'}
                  </a>
                  <button
                    type="button"
                    data-testid="roulette-share-close-btn"
                    onClick={() => setSharePreviewDataUrl(null)}
                    className="w-full py-2.5 px-4 rounded-full font-bold text-xs text-[#E5D5B5] border border-[#D8B467]/55 bg-transparent hover:bg-white/10 cursor-pointer"
                  >
                    {strings.backToStartButton}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 1B. POINT SHOP SCREEN ("Магазин Потужності" / "Power Shop") */}
        {gameState.screen === 'SHOP' && (
          <div
            data-testid="roulette-shop-screen"
            className="flex-1 flex flex-col h-full max-w-md mx-auto w-full px-5 pt-4 pb-6 overflow-hidden"
          >
            {/* Header & Current Power Points Balance */}
            <div className="shrink-0 flex flex-col items-center text-center pb-3 border-b border-[#C9A85C]/25">
              <h2 className="text-2xl font-extrabold tracking-tight text-white">
                {strings.powerShopTitle}
              </h2>
              <div
                data-testid="roulette-shop-power-points"
                className="mt-2 px-4 py-1.5 rounded-full bg-[#141A29]/90 border border-[#D8B467]/55 flex items-center gap-2 shadow-md"
              >
                <span className="text-xs font-bold uppercase tracking-wider text-[#E5D5B5]">
                  {strings.powerPointsLabel}:
                </span>
                <span className="text-base font-extrabold font-mono text-[#F5D061]">
                  {currentPowerPoints}
                </span>
              </div>
            </div>

            {/* Scrollable Upgrade Buttons List (in same style as Start Game Screen buttons) */}
            <div className="flex-1 overflow-y-auto py-3.5 space-y-3 pr-0.5">
              {ROULETTE_UPGRADES.map((upgrade) => {
                const isPurchased = currentUpgrades.includes(upgrade.id);
                const isToggleable = Boolean(upgrade.isToggleable);
                const isRepeatable = Boolean(upgrade.isRepeatable);
                const canAfford = canPurchaseUpgrade(
                  upgrade,
                  currentPowerPoints,
                  currentUpgrades,
                  currentFinMonLocked,
                  currentReachedMilestones
                );
                const isDisabled = !canAfford;
                const buttonLabel = formatUpgradeButtonLabel(
                  upgrade,
                  lang,
                  isPurchased,
                  currentDepositCount
                );
                const desc = getUpgradeDescription(
                  upgrade,
                  lang,
                  currentFinMonLocked
                );

                return (
                  <div
                    key={upgrade.id}
                    className="flex flex-col gap-1 bg-[#0E1422]/80 rounded-2xl p-2.5 border border-[#D8B467]/25"
                  >
                    <button
                      type="button"
                      data-testid={`roulette-upgrade-btn-${upgrade.id}`}
                      disabled={isDisabled}
                      onClick={() => handlePurchaseUpgrade(upgrade.id)}
                      className={`relative w-full py-3 pl-4 pr-11 rounded-full font-bold text-xs shadow-lg transition-transform flex items-center justify-center ${
                        isPurchased && !isToggleable && !isRepeatable
                          ? 'text-[#F5D061] bg-[#141A29] opacity-90 cursor-default'
                          : canAfford
                          ? 'text-white active:scale-[0.98] cursor-pointer'
                          : 'text-[#E5D5B5]/55 bg-transparent opacity-60 cursor-not-allowed'
                      }`}
                      style={
                        canAfford
                          ? {
                              background:
                                'linear-gradient(90deg, #A3221C 0%, #C93B2B 50%, #9E1E18 100%)',
                              border: '1.5px solid #D8B467',
                            }
                          : {
                              border: '1.2px solid rgba(216, 180, 103, 0.55)',
                            }
                      }
                    >
                      <span className="text-center leading-tight">{buttonLabel}</span>
                      {isPurchased && (
                        <span
                          data-testid={`roulette-upgrade-v-mark-${upgrade.id}`}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/25 border border-emerald-400 text-emerald-400 font-black text-xs leading-none shrink-0"
                        >
                          V
                        </span>
                      )}
                    </button>
                    {Boolean(desc) && (
                      <p
                        data-testid={`roulette-upgrade-desc-${upgrade.id}`}
                        className="text-[11px] text-zinc-300/85 px-2 leading-snug"
                      >
                        {desc}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Back to Start Screen Button (same style as Start Game Screen buttons) */}
            <div className="shrink-0 pt-2">
              <button
                type="button"
                data-testid="roulette-shop-back-btn"
                onClick={handleCloseShop}
                className="w-full py-3.5 px-5 rounded-full font-bold text-sm text-[#E5D5B5] bg-transparent hover:bg-white/5 transition-all cursor-pointer"
                style={{
                  border: '1.2px solid rgba(216, 180, 103, 0.55)',
                }}
              >
                {strings.backToStartButton}
              </button>
            </div>
          </div>
        )}

        {/* 2. ACTIVE GAME SCREEN (Also visible underneath during FADING_TO_BLACK) */}
        {(gameState.screen === 'PLAYING' || gameState.screen === 'FADING_TO_BLACK') && (
          <div
            data-testid="roulette-active-screen"
            data-blackout-active={isGameBlackoutActive ? 'true' : 'false'}
            className={`flex-1 flex flex-col h-full max-w-md mx-auto w-full overflow-hidden relative transition-colors duration-500 ${
              isGameBlackoutActive ? 'bg-[#020306]' : ''
            }`}
          >
            {/* Top Sticky Score Bar with Bigger Font, Extra Life Hearts & Clear Separation from Android Status Bar */}
            <div className="shrink-0 px-4 py-3 bg-[#0B0F18] border-b border-[#C9A85C]/25 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-base uppercase tracking-wide font-extrabold text-white">
                    {strings.pointsLabel}:
                  </span>
                  <span
                    data-testid="roulette-points-counter"
                    className="text-2xl font-extrabold font-mono text-[#F5D061]"
                  >
                    {gameState.score}
                  </span>
                </div>

                {/* Heart icons for "Second Life" (`second_chance`) and "Perseverance" (`perseverance`) */}
                {extraLivesTotal > 0 && (
                  <div
                    data-testid="roulette-header-hearts"
                    className="flex items-center gap-1 ml-1"
                  >
                    {Array.from({ length: extraLivesTotal }).map((_, idx) => {
                      const remainingHearts = Math.max(0, extraLivesTotal - extraLivesUsed);
                      const isUsed = idx >= remainingHearts;
                      return <HeaderHeartIcon key={idx} index={idx} isUsed={isUsed} />;
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="text-sm uppercase tracking-wide font-extrabold text-white">
                  {lang === 'uk' ? 'СЕРІЯ:' : 'STREAK:'}
                </span>
                <span
                  data-testid="roulette-streak-counter"
                  className="text-xl font-extrabold font-mono text-[#F5D061]"
                >
                  +{gameState.streakIncrement}
                </span>
              </div>
            </div>

            {/* Scrollable 2-Column Hourly Grid of 48 Timeslot Tickets with Top-to-Bottom Dealing Animation */}
            <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-2.5">
              {hourlyPairs.map(([leftTicket, rightTicket], rowIndex) => {
                const isDealt = rowIndex < dealtRowsCount;
                return (
                  <div
                    key={`hour_row_${rowIndex}_${gameState.generationId}`}
                    className="grid grid-cols-2 gap-2.5 transition-all duration-300 ease-out"
                    style={{
                      opacity: isDealt ? 1 : 0,
                      transform: isDealt ? 'translateY(0px) scale(1)' : 'translateY(-22px) scale(0.95)',
                    }}
                  >
                    <ScratchTicketCard
                      ticket={leftTicket}
                      generationId={gameState.generationId}
                      disabled={gameState.screen === 'FADING_TO_BLACK' || isGameBlackoutActive}
                      isBlackoutMode={isGameBlackoutActive}
                      onReveal={handleTicketReveal}
                    />
                    <ScratchTicketCard
                      ticket={rightTicket}
                      generationId={gameState.generationId}
                      disabled={gameState.screen === 'FADING_TO_BLACK' || isGameBlackoutActive}
                      isBlackoutMode={isGameBlackoutActive}
                      onReveal={handleTicketReveal}
                    />
                  </div>
                );
              })}
            </div>

            {/* Bottom Control Bar: Restart Game & Get New Tickets (disabled if player doesn't have enough points) */}
            <div className="shrink-0 px-3.5 py-3 bg-[#0B0F18] border-t border-[#C9A85C]/25 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                data-testid="roulette-restart-btn"
                onClick={handleRestartToStartScreen}
                className="py-3 px-2 rounded-full font-bold text-xs text-white bg-transparent hover:bg-white/5 transition-all cursor-pointer"
                style={{
                  border: '1.2px solid rgba(216, 180, 103, 0.6)',
                }}
              >
                {strings.restartGameButton}
              </button>

              <button
                type="button"
                data-testid="roulette-new-tickets-btn"
                disabled={
                  gameState.screen === 'FADING_TO_BLACK' ||
                  isGameBlackoutActive ||
                  !isRefreshAffordable
                }
                onClick={handleGetNewTickets}
                className={`py-3 px-2.5 rounded-full font-bold text-xs shadow-md transition-transform flex items-center justify-center gap-1.5 truncate ${
                  isRefreshAffordable &&
                  gameState.screen !== 'FADING_TO_BLACK' &&
                  !isGameBlackoutActive
                    ? 'text-[#1B1406] active:scale-[0.98] cursor-pointer'
                    : 'text-[#1B1406]/50 opacity-50 cursor-not-allowed'
                }`}
                style={{
                  background: 'linear-gradient(135deg, #E2CE9F 0%, #C6AE7A 100%)',
                }}
              >
                <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{newTicketsButtonLabel}</span>
              </button>
            </div>

            {/* Fade-to-Black Overlay during Electric Buzz (starts after 1s realization delay) */}
            {gameState.screen === 'FADING_TO_BLACK' && (
              <div
                data-testid="roulette-fade-overlay"
                className={`absolute inset-0 bg-black z-30 transition-opacity duration-700 pointer-events-auto ${
                  isFadeOverlayOpaque ? 'opacity-100' : 'opacity-0'
                }`}
              />
            )}
          </div>
        )}

        {/* 3. GAME OVER SCREEN: Progress bar on top + Vertical button placement with "Main Menu" ("Головне Меню") */}
        {gameState.screen === 'GAME_OVER' && (
          <div
            data-testid="roulette-gameover-screen"
            className="flex-1 flex flex-col items-center justify-between px-5 pt-3 pb-6 text-center bg-black w-full max-w-md mx-auto overflow-y-auto"
          >
            {/* Top Progress Bar Counting Total Power Points Accumulation Progress (100, 200, 400, 600, 1000) */}
            <PowerPointsMilestoneProgressBar
              accumulatedPoints={currentAccumulatedPoints}
              reachedMilestones={currentReachedMilestones}
              testIdPrefix="roulette-gameover"
            />

            {/* Upper-Center Multi-Frame Exploding Lightbulb Animation (>2.4 seconds) */}
            <div className="flex-1 flex flex-col items-center justify-center w-full">
              <MultiFrameExplodingBulbAnimation />

              {/* Final Score Below Animation with Big Font + Big Glowing X2 Icon when Daily Streak is Applied */}
              <h2 className="text-3xl font-extrabold tracking-wide text-white uppercase mt-3">
                {strings.gameOverTitle}
              </h2>
              <div className="mt-2 flex items-center justify-center gap-3">
                <p
                  data-testid="roulette-final-score"
                  className="text-2xl font-bold text-zinc-100"
                >
                  {strings.finalScoreLabel}:{' '}
                  <span className="font-extrabold text-white">{gameState.score}</span>
                </p>
                {gameState.dailyStreakApplied && (
                  <span
                    data-testid="roulette-gameover-daily-streak-x2"
                    className="inline-flex items-center justify-center px-3 py-1 rounded-xl font-black font-mono text-2xl text-[#FDE047] border-2 border-[#F59E0B] bg-[#F59E0B]/20 shadow-[0_0_20px_rgba(245,158,11,0.75)] animate-pulse"
                  >
                    X2
                  </span>
                )}
              </div>
            </div>

            {/* Bottom Vertical Restart Game, Main Menu & Close Game Pill Buttons */}
            <div className="w-full flex flex-col gap-2.5 pt-3">
              <button
                type="button"
                data-testid="roulette-gameover-restart-btn"
                onClick={handleGameOverRestartImmediately}
                className="w-full py-3.5 px-5 rounded-full font-bold text-sm text-white shadow-lg transition-transform active:scale-[0.98] cursor-pointer"
                style={{
                  background: 'linear-gradient(90deg, #A3221C 0%, #C93B2B 50%, #9E1E18 100%)',
                  border: '1.5px solid #D8B467',
                }}
              >
                {strings.restartGameButton}
              </button>

              <button
                type="button"
                data-testid="roulette-gameover-main-menu-btn"
                onClick={handleReturnToMainMenu}
                className="w-full py-3.5 px-5 rounded-full font-bold text-sm text-[#E5D5B5] bg-[#141A29]/85 hover:bg-white/10 transition-all cursor-pointer"
                style={{
                  border: '1.3px solid rgba(216, 180, 103, 0.75)',
                }}
              >
                {strings.mainMenuButton}
              </button>

              <button
                type="button"
                data-testid="roulette-gameover-close-btn"
                onClick={handleCloseGame}
                className="w-full py-3.5 px-5 rounded-full font-bold text-sm text-[#E5D5B5] bg-transparent hover:bg-white/10 transition-all cursor-pointer"
                style={{
                  border: '1.2px solid rgba(216, 180, 103, 0.55)',
                }}
              >
                {strings.closeGameButton}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Slow 2-3s Voltage Brownout Flicker Overlay inside solid modal so Main Application UI is never visible */}
      {gameState.screen !== 'GAME_OVER' && (
        <div
          data-testid="roulette-flicker-overlay"
          className="absolute inset-0 z-40 pointer-events-none bg-black transition-opacity duration-500 ease-in-out"
          style={{ opacity: flickerOverlayAlpha }}
        />
      )}
    </div>
  );
};
