/**
 * Frosted glass card of the app, mirrored from android/.../ui/components/GlassCard.kt (card fill
 * #BF141A29, 24 radius, hairline border) and spec/design-tokens.json. Keeps the original web look.
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
    className={`bg-[#141A29]/75 backdrop-blur-2xl border border-white/15 shadow-[0_16px_40px_rgba(0,0,0,0.55)] ${
      control ? 'rounded-2xl' : 'rounded-3xl'
    } ${PADDING[padding]} ${className}`}
  >
    {children}
  </div>
);

/** Secondary / tertiary text colours with raised alpha (docs/review/UI_PROPOSALS.md 4.9) for contrast on the translucent card. */
export const TEXT_SECONDARY = 'text-[#BAE6FD]/90';
export const TEXT_TERTIARY = 'text-[#BAE6FD]/80';
