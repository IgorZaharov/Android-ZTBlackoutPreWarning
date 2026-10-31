export type TimeOfDayPeriod = 'morning' | 'day' | 'evening' | 'night';

export interface TimeOfDayPalette {
  period: TimeOfDayPeriod;
  primary: string;     // 60% weight
  secondary: string;   // 30% weight
  accent: string;      // 10% weight
  supporting: string;  // Text/Core or Supporting/UI
  weights: {
    primary: 0.6;
    secondary: 0.3;
    accent: 0.1;
  };
}

export const TIME_OF_DAY_PALETTES: Record<TimeOfDayPeriod, Omit<TimeOfDayPalette, 'period' | 'weights'>> = {
  morning: {
    primary: '#F4F9F9',    // Soft Morning Mist / Light Neutral Background (60%)
    secondary: '#4A7C59',  // Fresh Mint Green (30%)
    accent: '#FFB085',     // Early Sunrise Peach (10%)
    supporting: '#2C3E35', // Deep Sage Dark Accent (Text/Core)
  },
  day: {
    primary: '#FFFFFF',    // Crisp White Base (60%)
    secondary: '#0A2540',  // Deep Noon Sky Navy (30%)
    accent: '#FFD166',     // Direct Sunlight Yellow (10%)
    supporting: '#4682B4', // Bright Sky Blue (Supporting/UI)
  },
  evening: {
    primary: '#1A0B2E',    // Twilight Indigo / Dark Mode Base (60%)
    secondary: '#8B3A62',  // Deep Magenta Sunset (30%)
    accent: '#FF6B6B',     // Golden Hour Coral (10%)
    supporting: '#FFE66D', // Warm Amber Highlights (Supporting/UI)
  },
  night: {
    primary: '#0B0C10',    // Obsidian Midnight / True Black (60%)
    secondary: '#1F2833',  // Deep Slate Shadow (30%)
    accent: '#66FCF1',     // Neon Star Cyan / High-Contrast Interactive Elements (10%)
    supporting: '#C5C6C7', // Moonlight Silver Gray (Supporting/UI)
  },
};

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((c) => c.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

export function lerpHexColor(hexA: string, hexB: string, t: number): string {
  const clampedT = Math.max(0, Math.min(1, t));
  // Smoothstep interpolation for natural gradual transitions
  const smoothT = clampedT * clampedT * (3 - 2 * clampedT);
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  return rgbToHex(
    r1 + (r2 - r1) * smoothT,
    g1 + (g2 - g1) * smoothT,
    b1 + (b2 - b1) * smoothT
  );
}

export function getPeriodForHour(hourFloat: number): TimeOfDayPeriod {
  const h = ((hourFloat % 24) + 24) % 24;
  if (h >= 6 && h < 12) return 'morning';
  if (h >= 12 && h < 18) return 'day';
  if (h >= 18 && h < 22) return 'evening';
  return 'night';
}

/**
 * Smoothly interpolates between Morning, Day, Evening, and Night palettes
 * based on the continuous time of day (hours + minutes/60 + seconds/3600).
 * Anchors:
 * - 02:00 -> Night
 * - 08:30 -> Morning
 * - 14:30 -> Day
 * - 20:00 -> Evening
 */
export function getInterpolatedTimePalette(date: Date = new Date()): TimeOfDayPalette {
  const hourFloat =
    date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const h = ((hourFloat % 24) + 24) % 24;

  const anchors: Array<{ hour: number; period: TimeOfDayPeriod }> = [
    { hour: 2.0, period: 'night' },
    { hour: 8.5, period: 'morning' },
    { hour: 14.5, period: 'day' },
    { hour: 20.0, period: 'evening' },
    { hour: 26.0, period: 'night' }, // 02:00 next day wrap-around
  ];

  const adjustedH = h < 2.0 ? h + 24.0 : h;

  let fromAnchor = anchors[0];
  let toAnchor = anchors[1];

  for (let i = 0; i < anchors.length - 1; i++) {
    if (adjustedH >= anchors[i].hour && adjustedH <= anchors[i + 1].hour) {
      fromAnchor = anchors[i];
      toAnchor = anchors[i + 1];
      break;
    }
  }

  const span = toAnchor.hour - fromAnchor.hour;
  const factor = span > 0 ? (adjustedH - fromAnchor.hour) / span : 0;

  const fromPalette = TIME_OF_DAY_PALETTES[fromAnchor.period];
  const toPalette = TIME_OF_DAY_PALETTES[toAnchor.period];

  return {
    period: getPeriodForHour(h),
    primary: lerpHexColor(fromPalette.primary, toPalette.primary, factor),
    secondary: lerpHexColor(fromPalette.secondary, toPalette.secondary, factor),
    accent: lerpHexColor(fromPalette.accent, toPalette.accent, factor),
    supporting: lerpHexColor(fromPalette.supporting, toPalette.supporting, factor),
    weights: {
      primary: 0.6,
      secondary: 0.3,
      accent: 0.1,
    },
  };
}
