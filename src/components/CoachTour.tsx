/**
 * Spotlight overlay of the first-run tour (spec/ONBOARDING.md), mirrored by CoachOverlay in
 * android/.../ui/components/CoachMarks.kt. It dims the phone screen except the lit controls, and points an
 * arrow with a tip at the lit part, outside it, and rings the control to use next. The dim layer lets every
 * touch through, so the user works with the lit controls directly; only the tips («Пропустити підказки»,
 * «Зрозуміло») take touches.
 *
 * The step comes from tourStep() with what the screen shows: the controls are found by their test ids and
 * data-tour attributes and measured every frame, so the holes follow scrolling and layout changes.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { translations } from '../services/i18n';
import { tourStep, type TourPage, type TourStep } from '../services/onboarding';

interface CoachTourProps {
  active: boolean;
  page: TourPage;
  hasAddress: boolean;
  reachedRename: boolean;
  renameDone: boolean;
  lang: 'uk' | 'en';
  onReachRename: () => void;
  onRenameDone: () => void;
  onSkip: () => void;
  onDone: () => void;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Tip {
  anchor: Box;
  text: string;
  /** The control to use next, ringed in the accent colour (inside a larger lit block). */
  ring?: Box;
  /** «Зрозуміло» ends the tour (the last step). */
  done?: boolean;
  /** «Пропустити підказки» (one tip per step). */
  skip?: boolean;
  /** «Далі» goes on to the next step. */
  next?: boolean;
}
interface View {
  step: TourStep;
  w: number;
  h: number;
  holes: Box[];
  tips: Tip[];
}

const HOLE_PAD = 6;
const HOLE_RADIUS = 14;
const ARROW = 32;
const TIP_WIDTH = 260;

const union = (boxes: Box[]): Box => {
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
};

const holePath = (b: Box): string => {
  const x = b.x - HOLE_PAD;
  const y = b.y - HOLE_PAD;
  const w = b.w + HOLE_PAD * 2;
  const h = b.h + HOLE_PAD * 2;
  const r = Math.min(HOLE_RADIUS, w / 2, h / 2);
  return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
};

export const CoachTour: React.FC<CoachTourProps> = ({
  active,
  page,
  hasAddress,
  reachedRename,
  renameDone,
  lang,
  onReachRename,
  onRenameDone,
  onSkip,
  onDone,
}) => {
  const t = translations[lang];
  const rootRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View | null>(null);
  const lastKey = useRef('');
  const lastAnchor = useRef<Element | null>(null);
  const renameDialogSeen = useRef(false);

  useEffect(() => {
    if (!active) {
      setView(null);
      lastKey.current = '';
      return;
    }
    // measured on a short timer rather than animation frames, which a hidden tab pauses
    const tick = () => {
      const root = rootRef.current;
      const screen = root?.parentElement;
      if (!root || !screen) return;
      const sr = screen.getBoundingClientRect();
      const scale = screen.offsetWidth > 0 ? sr.width / screen.offsetWidth : 1;
      const box = (el: Element | null | undefined): Box | null => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return null;
        return { x: (r.left - sr.left) / scale, y: (r.top - sr.top) / scale, w: r.width / scale, h: r.height / scale };
      };
      const q = (sel: string) => screen.querySelector(sel);
      const lookup = q('[data-testid="settings-queue-help-modal"]');
      const result = q('[data-testid="ztoe-lookup-result"]');
      const renaming = q('#rename-address-title') !== null;
      const covered = renaming || q('[data-testid="picker-dialog"], #remove-address-title') !== null;
      // closing the rename dialog during RENAME goes on to ALERTS
      if (renaming && reachedRename && !renameDone) renameDialogSeen.current = true;
      if (!renaming && renameDialogSeen.current) {
        renameDialogSeen.current = false;
        onRenameDone();
      }
      const step = tourStep({ active, lookupOpen: lookup !== null, resultShown: result !== null, page, hasAddress, reachedRename, renameDone, covered });

      let holes: Box[] = [];
      let tips: Tip[] = [];
      let anchorEl: Element | null = null;
      if (step === 'PICK') {
        const field = (id: string) => q(`[data-testid="${id}"]`) as HTMLButtonElement | null;
        const settlement = field('ztoe-select-settlement');
        const street = field('ztoe-select-street');
        const house = field('ztoe-select-house');
        const lit = [settlement?.parentElement, street?.parentElement, house?.parentElement]
          .map(box)
          .filter((b): b is Box => b !== null);
        // the tip sits outside the lit block and the next field to fill is ringed
        anchorEl = house && !house.disabled ? house : street && !street.disabled ? street : settlement;
        const ring = box(anchorEl);
        if (lit.length > 0) {
          const block = union(lit);
          holes = [block];
          tips = [{ anchor: block, text: t.tourPick, ring: ring ?? undefined, skip: true }];
        }
      } else if (step === 'APPLY') {
        anchorEl = q('[data-testid="ztoe-lookup-confirm-btn"]');
        const r = box(result);
        const a = box(anchorEl);
        if (r) holes = [r];
        // the tip sits outside the card (unless the card fills most of the screen) and the button is ringed
        const outside = r !== null && r.h < screen.offsetHeight * 0.55;
        if (a) tips = [{ anchor: outside && r ? r : a, text: t.tourApply, ring: a, skip: true }];
      } else if (step === 'RENAME') {
        const rename = box(q('[data-tour="rename"]'));
        if (rename) {
          holes = [rename];
          tips = [{ anchor: rename, text: t.tourRename, next: true, skip: true }];
        }
      } else if (step === 'ALERTS') {
        const switches = [q('[data-tour="alert-planned"]'), q('[data-tour="alert-emergency"]')].map(box).filter((b): b is Box => b !== null);
        const home = box(q('[data-tour="dock-home"]'));
        const block = switches.length > 0 ? union(switches) : null;
        holes = [block, home].filter((b): b is Box => b !== null);
        tips = [
          ...(block ? [{ anchor: block, text: t.tourAlerts, skip: true }] : []),
          ...(home ? [{ anchor: home, text: t.tourBack, skip: block === null }] : []),
        ];
        anchorEl = q('[data-tour="alert-planned"]');
      } else if (step === 'ABOUT') {
        const about = box(q('[data-tour="dock-about"]'));
        if (about) {
          holes = [about];
          tips = [{ anchor: about, text: t.tourDonate, done: true }];
        }
      }
      if (step === 'RENAME' && !reachedRename) onReachRename();
      // bring the control to use next into view once, when it changes
      // (after the card has settled: the result card grows while the queue is checked)
      if ((step === 'PICK' || step === 'APPLY' || step === 'ALERTS') && anchorEl && anchorEl !== lastAnchor.current) {
        lastAnchor.current = anchorEl;
        const el = anchorEl;
        window.setTimeout(() => {
          if (el.isConnected) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }, 400);
      }

      const next: View | null = step === 'NONE' || tips.length === 0 ? null : { step, w: screen.offsetWidth, h: screen.offsetHeight, holes, tips };
      const key = next === null ? '' : JSON.stringify(next, (_, v) => (typeof v === 'number' ? Math.round(v) : v));
      if (key !== lastKey.current) {
        lastKey.current = key;
        setView(next);
      }
    };
    tick();
    const timer = window.setInterval(tick, 80);
    return () => window.clearInterval(timer);
  }, [active, page, hasAddress, reachedRename, renameDone, t, onReachRename, onRenameDone]);

  return (
    <div ref={rootRef} aria-hidden={view === null} className="pointer-events-none absolute inset-0 z-[60]" data-testid="coach-tour" data-step={view?.step ?? 'NONE'}>
      {view && (
        <>
          <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
            <path fillRule="evenodd" fill="rgba(5,8,15,0.78)" d={`M0 0H${view.w}V${view.h}H0Z ${view.holes.map(holePath).join(' ')}`} />
          </svg>
          {view.tips.map((tip, i) => (
            <TipMark
              key={i}
              tip={tip}
              w={view.w}
              h={view.h}
              labels={{ done: t.tourGotIt, skip: t.tourSkip, next: t.tourNext }}
              onDone={onDone}
              onSkip={onSkip}
              onNext={onRenameDone}
            />
          ))}
        </>
      )}
    </div>
  );
};

/** One tip: the arrow next to the anchor (above it when the anchor is in the lower half) and the text beyond. */
const TipMark: React.FC<{
  tip: Tip;
  w: number;
  h: number;
  labels: { done: string; skip: string; next: string };
  onDone: () => void;
  onSkip: () => void;
  onNext: () => void;
}> = ({ tip, w, h, labels, onDone, onSkip, onNext }) => {
  const a = tip.anchor;
  const cx = a.x + a.w / 2;
  const above = a.y + a.h / 2 > h * 0.45;
  const arrowTop = above ? a.y - HOLE_PAD - 4 - ARROW : a.y + a.h + HOLE_PAD + 4;
  const width = Math.min(TIP_WIDTH, w - 24);
  const left = Math.max(12, Math.min(w - 12 - width, cx - width / 2));
  const bubble = (
    <div
      role="status"
      data-testid="coach-tip"
      className="pointer-events-auto flex flex-col items-center gap-2.5 rounded-2xl border border-white/20 bg-[#141A29] px-4 py-3 text-center text-[15px] font-bold leading-[21px] text-white shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
      style={{ width }}
    >
      <span>{tip.text}</span>
      {tip.done && (
        <button
          type="button"
          data-testid="coach-done"
          onClick={onDone}
          className="min-h-11 cursor-pointer rounded-xl bg-[#FF5E3A] px-5 text-sm font-extrabold text-white hover:bg-[#ff4b24]"
        >
          {labels.done}
        </button>
      )}
      {tip.next && (
        <button
          type="button"
          data-testid="coach-next"
          onClick={onNext}
          className="min-h-11 cursor-pointer rounded-xl bg-[#FF5E3A] px-5 text-sm font-extrabold text-white hover:bg-[#ff4b24]"
        >
          {labels.next}
        </button>
      )}
      {tip.skip && (
        <button
          type="button"
          data-testid="coach-skip"
          onClick={onSkip}
          className="-my-1 min-h-11 cursor-pointer px-3 text-[13px] font-semibold text-[#BAE6FD]/80 underline underline-offset-2 hover:text-white"
        >
          {labels.skip}
        </button>
      )}
    </div>
  );
  const ring = tip.ring;
  return (
    <>
      {ring && (
        <div
          aria-hidden="true"
          className="absolute rounded-2xl border-2 border-[#FF5E3A]"
          style={{ left: ring.x - 3, top: ring.y - 3, width: ring.w + 6, height: ring.h + 6 }}
        />
      )}
      {above ? (
        <ArrowDown className="zt-nudge absolute h-8 w-8 text-[#FF5E3A]" strokeWidth={3} style={{ left: cx - ARROW / 2, top: arrowTop }} aria-hidden="true" />
      ) : (
        <ArrowUp className="zt-nudge-up absolute h-8 w-8 text-[#FF5E3A]" strokeWidth={3} style={{ left: cx - ARROW / 2, top: arrowTop }} aria-hidden="true" />
      )}
      <div className="absolute" style={above ? { left, bottom: h - arrowTop + 2 } : { left, top: arrowTop + ARROW + 2 }}>
        {bubble}
      </div>
    </>
  );
};
