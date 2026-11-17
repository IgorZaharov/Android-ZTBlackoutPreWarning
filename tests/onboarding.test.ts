/**
 * First-run tour steps (spec/ONBOARDING.md); the same cases run in android/.../ui/OnboardingTourTest.kt.
 */
import assert from 'node:assert/strict';
import { tourFinishedBy, tourStep, type TourInput } from '../src/services/onboarding';

const base: TourInput = {
  active: true,
  lookupOpen: false,
  resultShown: false,
  page: 'schedule',
  hasAddress: false,
  reachedRename: false,
  renameDone: false,
  covered: false,
};
const at = (patch: Partial<TourInput>) => tourStep({ ...base, ...patch });

const cases: [string, () => void][] = [
  ['notStartedShowsNothing', () => {
    assert.equal(at({ active: false, lookupOpen: true }), 'NONE');
  }],
  ['lookupWithoutResultIsPick', () => {
    assert.equal(at({ lookupOpen: true, page: 'settings' }), 'PICK');
  }],
  ['lookupWithResultIsApply', () => {
    assert.equal(at({ lookupOpen: true, resultShown: true, page: 'settings' }), 'APPLY');
  }],
  ['anotherDialogOnTopWaits', () => {
    assert.equal(at({ lookupOpen: true, covered: true }), 'NONE');
  }],
  ['settingsWithAddressIsRenameThenAlerts', () => {
    assert.equal(at({ page: 'settings', hasAddress: true }), 'RENAME');
    assert.equal(at({ page: 'settings', hasAddress: true, reachedRename: true, renameDone: true }), 'ALERTS');
  }],
  ['settingsWithoutAddressShowsNothing', () => {
    assert.equal(at({ page: 'settings' }), 'NONE');
  }],
  ['mainScreenAfterRenameIsAbout', () => {
    assert.equal(at({ page: 'schedule', hasAddress: true }), 'NONE');
    assert.equal(at({ page: 'schedule', hasAddress: true, reachedRename: true }), 'ABOUT');
  }],
  ['aboutAfterRenameFinishes', () => {
    assert.equal(tourFinishedBy('about', true), true);
    assert.equal(tourFinishedBy('about', false), false);
    assert.equal(tourFinishedBy('schedule', true), false);
  }],
];

let failed = 0;
for (const [name, fn] of cases) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (e) {
    failed++;
    console.error(`FAIL ${name}`);
    console.error(e instanceof Error ? e.message : e);
  }
}
if (failed > 0) {
  console.error(`${failed} onboarding test(s) failed`);
  process.exit(1);
}
console.log(`All ${cases.length} onboarding tests passed`);
