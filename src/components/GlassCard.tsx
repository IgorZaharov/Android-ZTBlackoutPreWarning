/**
 * Liquid-glass card of the app, mirrored from android/.../ui/components/GlassCard.kt (fill #A3141A29 with a
 * top sheen, lit rim, soft shadow, 24 radius) and spec/design-tokens.json "glass"; the look is the
 * `.zt-glass` class in index.css.
 */
import React from 'react';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Padding in px (Compose contentPadding): 14, 16 (default) or 18. */
  padding?: 4 | 14 | 16 | 18 | 20;
  /** Smaller 16 px corner radius used by the day tabs. */
  control?: boolean;
}

const PADDING: Record<number, string> = { 4: 'p-1', 14: 'p-3.5', 16: 'p-4', 18: 'p-[18px]', 20: 'p-5' };

export const GlassCard: React.FC<GlassCardProps> = ({ padding = 16, control = false, className = '', children, ...rest }) => (
  <div
    {...rest}
    className={`zt-glass ${
      control ? 'rounded-2xl' : 'rounded-3xl'
    } ${PADDING[padding]} ${className}`}
  >
    {children}
  </div>
);

/** Secondary / tertiary text colours with raised alpha (docs/review/UI_PROPOSALS.md 4.9) for contrast on the translucent card. */
export const TEXT_SECONDARY = 'text-[#BAE6FD]/90';
export const TEXT_TERTIARY = 'text-[#BAE6FD]/80';
