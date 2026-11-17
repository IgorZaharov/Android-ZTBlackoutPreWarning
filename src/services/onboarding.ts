/**
 * First-run tour (spec/ONBOARDING.md), mirrored from android/.../ui/components/OnboardingTour.kt.
 *
 * The tour starts when a new user taps the first-launch «Виберіть чергу» button and walks them through:
 *  PICK   - the address picker: settlement, street and house are lit, the rest is dimmed;
 *  APPLY  - the result card: the arrow points at the «Обрати чергу» button;
 *  RENAME - Settings with the new address: an arrow at its rename button («Далі» or a rename goes on);
 *  ALERTS - its planned and emergency alert switches, and an arrow at the dock's home button;
 *  ABOUT  - the main screen: an arrow at the dock's About button, «Або допоможіть волонтерам...».
 * It ends on «Зрозуміло», on «Пропустити підказки» or when About is opened, and is never shown again.
 */

export type TourStep = 'NONE' | 'PICK' | 'APPLY' | 'RENAME' | 'ALERTS' | 'ABOUT';
export type TourPage = 'schedule' | 'settings' | 'about' | 'other';

export interface TourInput {
  /** The tour was started (first-launch button) and not finished or skipped. */
  active: boolean;
  /** The address lookup dialog is open. */
  lookupOpen: boolean;
  /** The lookup shows a result card (a house, or a settlement / street without lower levels). */
  resultShown: boolean;
  page: TourPage;
  /** At least one address or queue is saved. */
  hasAddress: boolean;
  /** The RENAME step was shown, so the main screen goes on to ABOUT. */
  reachedRename: boolean;
  /** «Далі» was tapped on RENAME, or the address was renamed: Settings goes on to ALERTS. */
  renameDone: boolean;
  /** Another dialog (a picker list, rename, remove) is on top: the tour waits. */
  covered: boolean;
}

export function tourStep(i: TourInput): TourStep {
  if (!i.active || i.covered) return 'NONE';
  if (i.lookupOpen) return i.resultShown ? 'APPLY' : 'PICK';
  if (!i.hasAddress) return 'NONE';
  if (i.page === 'settings') return i.renameDone ? 'ALERTS' : 'RENAME';
  if (i.page === 'schedule' && i.reachedRename) return 'ABOUT';
  return 'NONE';
}

/** Opening About after the RENAME step finishes the tour (the donations are there). */
export const tourFinishedBy = (page: TourPage, reachedRename: boolean): boolean => page === 'about' && reachedRename;

const DONE_KEY = 'onboarding_done';

export function isOnboardingDone(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(DONE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setOnboardingDone(done: boolean): void {
  try {
    if (typeof window === 'undefined') return;
    if (done) window.localStorage.setItem(DONE_KEY, '1');
    else window.localStorage.removeItem(DONE_KEY);
  } catch {
    // private mode: the tour may show again, nothing else breaks
  }
}
