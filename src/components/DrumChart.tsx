/**
 * The 24-hour "analog meter" drum, mirrored from android/.../ui/components/TimelineBar.kt (DrumChart, HTML)
 * and BlackoutGlanceWidget.renderAnalogCounterBitmap (DrumBitmap, SVG used by the big and the strip widget).
 *
 * Both read the same 48 BlackoutSlot cells (snapshot.slotsFor(date)), so the main timeline and the
 * widgets cannot disagree. Planned and repair outages are crimson, emergency outages are amber with
 * 45 degree stripes (a second cue besides colour), emergency over planned is crimson with amber stripes;
 * `unclearBase` paints cells without an outage grey (spec/UI_DRUM.md section 1).
 */
import React, { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { BlackoutSlot } from '../types';
import { drumSummary } from './outageRowFormat';
import { translations } from '../services/i18n';

type Lang = 'uk' | 'en';

export const DRUM_COLORS = {
  faceplate: ['#DFDDD0', '#D4D1C1', '#C6C2B0'],
  faceplateBorder: '#7A7768',
  well: '#4E514E',
  wellBorder: '#6E716B',
  track: '#C8C6BC',
  off: ['#9E1E18', '#D62E26', '#8C1914'],
  on: ['#D8D6CC', '#FCFBF7', '#CCC9BE'],
  unclear: ['#7E8287', '#94989E', '#6E7277'],
  emergency: ['#FFB020', '#F28A1B', '#C96A0B'],
  stripeDark: 'rgba(26,18,8,0.55)', // #1A1208 at 55 %
  stripeLight: 'rgba(255,176,32,0.85)', // #FFB020 at 85 %
  tick: '#1C1B18',
  needle: '#0B0B0A',
  needleHalo: 'rgba(255,255,255,0.85)',
} as const;

const vGradient = (c: readonly string[]): string => `linear-gradient(to bottom, ${c[0]}, ${c[1]}, ${c[2]})`;

/** One half-hour cell reduced to what is drawn (planned: crimson, emergency: amber stripes, both: crimson + stripes). */
export interface DrumCell {
  planned: boolean;
  emergency: boolean;
}

/** 48 cells from `slots`: 48 half-hour slots, or 24 hourly slots (legacy, each used twice). Anything else: null (grey bar). */
export function drumCells(slots: readonly BlackoutSlot[]): DrumCell[] | null {
  let src: readonly BlackoutSlot[];
  if (slots.length === 48) src = slots;
  else if (slots.length === 24) src = slots.flatMap((s) => [s, s]);
  else return null;
  return src.map((s) => {
    const off = s.status === 'POWER_OFF';
    return { planned: off && (Boolean(s.isPlanned) || !s.isEmergency), emergency: off && Boolean(s.isEmergency) };
  });
}

/** The 48 states the main drum and the widgets both draw: "0" on, "1" planned, "2" emergency, "3" both. */
export function drumSignature(slots: readonly BlackoutSlot[]): string {
  const cells = drumCells(slots);
  if (cells === null) return 'UNCLEAR';
  return cells.map((c) => (c.planned && c.emergency ? '3' : c.emergency ? '2' : c.planned ? '1' : '0')).join('');
}

/** Reduced-motion preference (decorative motion is skipped when set). */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );
  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

// ---------------------------------------------------------------------------------------------
// Main drum (HTML)
// ---------------------------------------------------------------------------------------------

const HOUR_GAP = 1.5;
const CELL_HEIGHT = 32;
const TRACK_INSET = 8; // 6 slot padding + 2 slot border, like the Compose needle
const STRIPE = 3; // 3 px stripe + 3 px gap, measured across the stripe

const ALL_MARKERS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24];

interface DrumChartProps {
  slots: readonly BlackoutSlot[];
  currentHour: number;
  currentMinute: number;
  showNeedle?: boolean;
  lang: Lang;
  unclearBase?: boolean;
  className?: string;
  testId?: string;
}

export const DrumChart: React.FC<DrumChartProps> = ({
  slots,
  currentHour,
  currentMinute,
  showNeedle = true,
  lang,
  unclearBase = false,
  className = '',
  testId,
}) => {
  const t = translations[lang];
  const cells = useMemo(() => drumCells(slots), [slots]);
  const summary = useMemo(() => drumSummary(lang, slots, unclearBase), [slots, lang, unclearBase]);

  const stripRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(300);
  useLayoutEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(1, el.getBoundingClientRect().width));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cells === null]);

  const hourW = (width - HOUR_GAP * 23) / 24;
  const halfW = hourW / 2;
  const hour = Math.min(23, Math.max(0, currentHour));
  const minuteFraction = Math.min(59, Math.max(0, currentMinute)) / 60;
  // Exact position inside the hour cell, so the 1.5 px hour gaps do not skew the needle
  const needleLeft = TRACK_INSET + hour * (hourW + HOUR_GAP) + minuteFraction * hourW;
  const stripeBackground = (light: boolean) =>
    `repeating-linear-gradient(135deg, ${light ? DRUM_COLORS.stripeLight : DRUM_COLORS.stripeDark} 0px, ${
      light ? DRUM_COLORS.stripeLight : DRUM_COLORS.stripeDark
    } ${STRIPE}px, transparent ${STRIPE}px, transparent ${STRIPE * 2}px)`;

  return (
    <div
      data-testid={testId}
      data-signature={drumSignature(slots)}
      role="img"
      aria-label={summary}
      className={`rounded-2xl border-2 px-3 pt-3 pb-2.5 select-none ${className}`}
      style={{ background: vGradient(DRUM_COLORS.faceplate), borderColor: DRUM_COLORS.faceplateBorder, boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.3)' }}
    >
      {/* Wrapper with 4px top/bottom padding so the needle protrudes 4px above and below the dark-grey well */}
      <div className="relative py-1">
        <div
          className="rounded-lg border-2 p-1.5"
          style={{ background: DRUM_COLORS.well, borderColor: DRUM_COLORS.wellBorder, boxShadow: 'inset 0 3px 6px rgba(0,0,0,0.85)' }}
        >
          {cells === null ? (
            <div
              data-testid="drum-chart-unclear"
              ref={stripRef}
              className="flex w-full items-center justify-center rounded-[2px] px-2 py-1"
              style={{ minHeight: CELL_HEIGHT, background: vGradient(DRUM_COLORS.unclear) }}
            >
              <span className="text-sm font-extrabold text-white text-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{t.outagesUnclear}</span>
            </div>
          ) : (
            <div
              ref={stripRef}
              className="relative w-full overflow-hidden rounded-[2px]"
              style={{ height: CELL_HEIGHT, background: DRUM_COLORS.track }}
            >
              {cells.map((cell, i) => {
                const left = Math.floor(i / 2) * (hourW + HOUR_GAP) + (i % 2) * halfW;
                const w = halfW + (i % 2 === 0 ? 0.5 : 0); // +0.5 px hides the seam of the two halves of one hour
                const base = cell.planned
                  ? vGradient(DRUM_COLORS.off)
                  : cell.emergency
                  ? vGradient(DRUM_COLORS.emergency)
                  : unclearBase
                  ? vGradient(DRUM_COLORS.unclear)
                  : vGradient(DRUM_COLORS.on);
                const style: React.CSSProperties = { left, width: w, top: 0, bottom: 0 };
                if (cell.emergency) {
                  // The stripe layer is as wide as the whole drum and shifted by the cell offset, so the
                  // stripes of neighbouring emergency cells continue each other.
                  style.backgroundImage = `${stripeBackground(cell.planned)}, ${base}`;
                  style.backgroundSize = `${width}px 100%, 100% 100%`;
                  style.backgroundPosition = `${-left}px 0, 0 0`;
                  style.backgroundRepeat = 'no-repeat, no-repeat';
                } else {
                  style.backgroundImage = base;
                }
                return <div key={i} className="absolute" style={style} />;
              })}
            </div>
          )}
        </div>

        {showNeedle && (
          <>
            <div
              aria-hidden="true"
              data-testid="drum-needle"
              className="absolute top-0 bottom-0 rounded-full pointer-events-none"
              style={{ left: needleLeft - 2.25, width: 4.5, background: DRUM_COLORS.needleHalo }}
            />
            <div
              aria-hidden="true"
              className="absolute top-0 bottom-0 rounded-full pointer-events-none"
              style={{ left: needleLeft - 1.5, width: 3, background: DRUM_COLORS.needle }}
            />
          </>
        )}
      </div>

      {/* Stamped black tick marks and numbers every 2 hours: 00, 02..24 (12 px is the floor of the type scale) */}
      <div aria-hidden="true" className="mt-0.5 flex justify-between px-0.5">
        {ALL_MARKERS.map((h) => (
          <div key={h} className="flex flex-col items-center">
            <div style={{ width: 1.5, height: 5, background: DRUM_COLORS.tick }} />
            <span className="mt-px font-mono text-xs font-bold leading-none tracking-normal" style={{ color: DRUM_COLORS.tick }}>
              {String(h).padStart(2, '0')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------------------------
// Widget bitmap (SVG), mirror of renderAnalogCounterBitmap
// ---------------------------------------------------------------------------------------------

interface DrumBitmapProps {
  slots: readonly BlackoutSlot[];
  currentHour: number;
  currentMinute: number;
  lang: Lang;
  /** 132 for the big widget, 200 for the strip widget (the bitmap is always 720 wide). */
  height?: number;
  /** Stretch to the box like Glance ContentScale.FillBounds (big widget) instead of keeping the aspect ratio. */
  fill?: boolean;
  label: string;
  className?: string;
  testId?: string;
}

const WIDTH = 720;
const SEP_PX = 3;
const STRIPE_PX = 8;

export const DrumBitmap: React.FC<DrumBitmapProps> = ({
  slots,
  currentHour,
  currentMinute,
  lang,
  height = 132,
  fill = false,
  label,
  className = '',
  testId,
}) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const t = translations[lang];
  const cells = drumCells(slots);

  const trackLeft = 26;
  const trackTop = 26;
  const trackRight = WIDTH - 26;
  const trackBottom = height - 56;
  const trackWidth = trackRight - trackLeft;
  const trackH = trackBottom - trackTop;
  const contourTop = 18;
  const contourBottom = height - 48;
  const hourWidth = (trackWidth - SEP_PX * 23) / 24;
  const halfWidth = hourWidth / 2;
  const stripeStep = STRIPE_PX * 2 * 1.4142135;

  const fraction = Math.min(1, Math.max(0, (Math.min(23, Math.max(0, currentHour)) * 60 + Math.min(59, Math.max(0, currentMinute))) / 1440));
  const needleX = trackLeft + trackWidth * fraction;
  const needleTop = contourTop - 8;
  const needleBottom = contourBottom + 8;
  const fontSize = 21 + (height - 132) * 0.1;
  const labels: [number, string][] = [[0, '00'], [0.25, '06'], [0.5, '12'], [0.75, '18'], [1, '24']];

  const stops = (id: string, c: readonly string[]) => (
    <linearGradient id={`${uid}${id}`} x1="0" y1={trackTop} x2="0" y2={trackBottom} gradientUnits="userSpaceOnUse">
      <stop offset="0" stopColor={c[0]} />
      <stop offset="0.5" stopColor={c[1]} />
      <stop offset="1" stopColor={c[2]} />
    </linearGradient>
  );

  const cellEls: React.ReactNode[] = [];
  if (cells !== null) {
    cells.forEach((cell, idx) => {
      const hour = Math.floor(idx / 2);
      const hLeft = trackLeft + hour * (hourWidth + SEP_PX);
      const left = idx % 2 === 0 ? hLeft : hLeft + halfWidth;
      const right = idx % 2 === 0 ? hLeft + halfWidth : hLeft + hourWidth;
      const fillId = cell.planned ? 'off' : cell.emergency ? 'amber' : 'on';
      cellEls.push(<rect key={`c${idx}`} x={left} y={trackTop} width={right - left} height={trackH} fill={`url(#${uid}${fillId})`} />);
      if (cell.emergency) {
        const color = cell.planned ? DRUM_COLORS.stripeLight : DRUM_COLORS.stripeDark;
        const lines: React.ReactNode[] = [];
        // Global phase (anchored at trackLeft) keeps the stripes continuous across cells
        let n = Math.floor((left - trackLeft) / stripeStep);
        for (;;) {
          const u = trackLeft - trackH + n * stripeStep;
          if (u >= right) break;
          lines.push(<line key={n} x1={u} y1={trackBottom} x2={u + trackH} y2={trackTop} stroke={color} strokeWidth={STRIPE_PX} />);
          n++;
        }
        cellEls.push(
          <g key={`s${idx}`} clipPath={`url(#${uid}clip${idx})`}>
            <clipPath id={`${uid}clip${idx}`}>
              <rect x={left} y={trackTop} width={right - left} height={trackH} />
            </clipPath>
            {lines}
          </g>
        );
      }
    });
  }

  return (
    <svg
      data-testid={testId}
      data-signature={drumSignature(slots)}
      viewBox={`0 0 ${WIDTH} ${height}`}
      preserveAspectRatio={fill ? 'none' : 'xMidYMid meet'}
      role="img"
      aria-label={label}
      className={`block w-full ${className}`}
    >
      <defs>
        <linearGradient id={`${uid}face`} x1="0" y1="0" x2="0" y2={height} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={DRUM_COLORS.faceplate[0]} />
          <stop offset="0.5" stopColor={DRUM_COLORS.faceplate[1]} />
          <stop offset="1" stopColor={DRUM_COLORS.faceplate[2]} />
        </linearGradient>
        {stops('off', DRUM_COLORS.off)}
        {stops('on', DRUM_COLORS.on)}
        {stops('amber', DRUM_COLORS.emergency)}
        {stops('grey', DRUM_COLORS.unclear)}
      </defs>
      {/* 1. Vintage enamel faceplate with #7A7768 border */}
      <rect x={2} y={2} width={WIDTH - 4} height={height - 4} rx={24} fill={`url(#${uid}face)`} stroke={DRUM_COLORS.faceplateBorder} strokeWidth={4} />
      {/* 2. Recessed dark-grey contour */}
      <rect x={18} y={18} width={WIDTH - 36} height={contourBottom - 18} rx={12} fill={DRUM_COLORS.well} stroke={DRUM_COLORS.wellBorder} strokeWidth={3} />
      {/* 3. Light-gray track: the hour separators show through */}
      <rect x={trackLeft} y={trackTop} width={trackWidth} height={trackH} rx={4} fill={DRUM_COLORS.track} />
      {cells === null ? (
        <>
          <rect x={trackLeft} y={trackTop} width={trackWidth} height={trackH} rx={4} fill={`url(#${uid}grey)`} />
          <text
            x={trackLeft + trackWidth / 2}
            y={(trackTop + trackBottom) / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#FFFFFF"
            fontFamily="system-ui, sans-serif"
            fontWeight={700}
            fontSize={22}
          >
            {t.outagesUnclear}
          </text>
        </>
      ) : (
        cellEls
      )}
      {/* 5. Black current-time needle with a light halo */}
      <rect x={needleX - 4.5} y={needleTop} width={9} height={needleBottom - needleTop} rx={4.5} fill={DRUM_COLORS.needleHalo} />
      <rect x={needleX - 3} y={needleTop} width={6} height={needleBottom - needleTop} rx={3} fill={DRUM_COLORS.needle} />
      {/* 6. Stamped hour markers 00, 06, 12, 18, 24 */}
      {labels.map(([pos, text]) => (
        <text
          key={text}
          x={pos === 0 ? trackLeft : pos === 1 ? trackRight : trackLeft + trackWidth * pos}
          y={height - 16}
          textAnchor={pos === 0 ? 'start' : pos === 1 ? 'end' : 'middle'}
          fill={DRUM_COLORS.tick}
          fontFamily="ui-monospace, monospace"
          fontWeight={700}
          fontSize={fontSize}
        >
          {text}
        </text>
      ))}
    </svg>
  );
};
