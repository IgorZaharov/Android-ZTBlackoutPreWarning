/**
 * Which site and PowerOn status the main screen shows, ported from SiteStatusModel in
 * android/.../ui/components/SiteStatusIndicator.kt (rules only; the view is in MainView).
 */
import { fromInstant, hourOf, minuteOf } from '../core/localTime';
import type { SiteState } from '../core/siteState';
import type { OutageSnapshot } from '../services/outageRepository';
import { staleChip, staleDataSince, translations } from '../services/i18n';

type Lang = 'uk' | 'en';

export type StatusTone = 'GREEN' | 'AMBER' | 'RED' | 'GREY';
export type StatusIcon = 'OK' | 'WARNING' | 'SERVER_DOWN' | 'OFFLINE' | 'UNKNOWN' | 'TOMORROW_OK' | 'TOMORROW_PENDING';

export interface StatusChip {
  tone: StatusTone;
  icon: StatusIcon;
  text: string;
}

export interface SiteBanner {
  tone: StatusTone;
  icon: StatusIcon;
  title: string;
  message: string;
}

/** Chip and banner colours from spec/design-tokens.json (never the only cue: each also has an icon and text). */
export const TONE_COLORS: Record<StatusTone, { fill: string; text: string }> = {
  GREEN: { fill: 'rgba(16,185,129,0.20)', text: '#34D399' },
  AMBER: { fill: 'rgba(245,158,11,0.20)', text: '#FBBF24' },
  RED: { fill: 'rgba(239,68,68,0.20)', text: '#F87171' },
  GREY: { fill: 'rgba(156,163,175,0.20)', text: '#9CA3AF' },
};

export function formatHhmm(epochMs: number): string {
  const t = fromInstant(epochMs);
  return `${String(hourOf(t)).padStart(2, '0')}:${String(minuteOf(t)).padStart(2, '0')}`;
}

function siteText(lang: Lang, state: SiteState): string {
  const t = translations[lang];
  switch (state) {
    case 'AVAILABLE_WITH_TABLE':
      return t.siteStateWithTable;
    case 'AVAILABLE_NO_TABLE':
      return t.siteStateNoTable;
    case 'SITE_UNREACHABLE':
      return t.siteStateUnreachable;
    case 'NO_INTERNET':
      return t.siteStateNoInternet;
  }
}

const toneOf = (s: SiteState): StatusTone =>
  s === 'AVAILABLE_WITH_TABLE' ? 'GREEN' : s === 'AVAILABLE_NO_TABLE' ? 'AMBER' : s === 'SITE_UNREACHABLE' ? 'RED' : 'GREY';

const iconOf = (s: SiteState): StatusIcon =>
  s === 'AVAILABLE_WITH_TABLE' ? 'OK' : s === 'AVAILABLE_NO_TABLE' ? 'WARNING' : s === 'SITE_UNREACHABLE' ? 'SERVER_DOWN' : 'OFFLINE';

function hint(lang: Lang, state: SiteState): string | null {
  const t = translations[lang];
  switch (state) {
    case 'AVAILABLE_WITH_TABLE':
      return null;
    case 'AVAILABLE_NO_TABLE':
      return t.siteStateHintNoTable;
    case 'SITE_UNREACHABLE':
      return t.siteStateHintUnreachable;
    case 'NO_INTERNET':
      return t.siteStateHintNoInternet;
  }
}

/** Chip row of the "Last updated" card. Empty when no queue is selected (nothing is checked then). */
export function siteChips(snapshot: OutageSnapshot, lang: Lang): StatusChip[] {
  if (snapshot.queue.trim() === '') return [];
  const t = translations[lang];
  const out: StatusChip[] = [];
  const site = snapshot.site;
  if (site === null) {
    out.push({ tone: 'GREY', icon: 'UNKNOWN', text: t.siteStateChecking });
  } else {
    out.push({ tone: toneOf(site.state), icon: iconOf(site.state), text: siteText(lang, site.state) });
  }
  if (snapshot.isStale) {
    const since = site?.lastSuccessMs != null ? formatHhmm(site.lastSuccessMs) : null;
    if (since !== null) out.push({ tone: 'AMBER', icon: 'WARNING', text: staleChip(lang, since) });
  }
  if (snapshot.tomorrowPublished) out.push({ tone: 'GREEN', icon: 'TOMORROW_OK', text: t.tomorrowPublished });
  else out.push({ tone: 'GREY', icon: 'TOMORROW_PENDING', text: t.tomorrowNotPublishedShort });
  return out;
}

/** Small status line shown only when the last PowerOn (emergency outages) refresh failed. */
export function poweronLine(snapshot: OutageSnapshot, lang: Lang): StatusChip | null {
  return snapshot.poweron?.ok === false
    ? { tone: 'AMBER', icon: 'WARNING', text: translations[lang].poweronUnavailable }
    : null;
}

/** Text of the ztoe notice card: only while the page answers without a table (mirrors SiteStatusModel.notice). */
export function siteNotice(snapshot: OutageSnapshot): string | null {
  const site = snapshot.site;
  if (site === null || site.state !== 'AVAILABLE_NO_TABLE') return null;
  return site.notice && site.notice.trim() !== '' ? site.notice : null;
}

/**
 * Glass banner above the hero, for degraded site states only. Not shown while the ztoe notice card
 * is: the notice already explains the missing table and the chip below still names the state.
 */
export function siteBanner(snapshot: OutageSnapshot, lang: Lang): SiteBanner | null {
  if (snapshot.queue.trim() === '') return null;
  const site = snapshot.site;
  if (site === null || site.state === 'AVAILABLE_WITH_TABLE') return null;
  if (siteNotice(snapshot) !== null) return null;
  const since = snapshot.isStale && site.lastSuccessMs != null ? formatHhmm(site.lastSuccessMs) : null;
  const message = [since !== null ? staleDataSince(lang, since) : null, hint(lang, site.state)]
    .filter((x): x is string => x !== null)
    .join('\n');
  return { tone: toneOf(site.state), icon: iconOf(site.state), title: siteText(lang, site.state), message };
}
