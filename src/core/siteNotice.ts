/**
 * Mirrors android/.../core/SiteNotice.kt: extracts the notice ztoe publishes in place of the schedule
 * ("УВАГА! ВАЖЛИВА ІНФОРМАЦІЯ!"). Same rules, same vectors (spec/vectors/site_notice.json).
 */
import { TextNorm } from './addressKeys';

export const SITE_NOTICE_MAX_SCAN = 4000;
export const SITE_NOTICE_MAX_LENGTH = 1000;

/** ASCII whitespace plus the no-break space; spelled out so Kotlin, JS and Swift agree. */
const WS = '[ \t\n\u000B\f\r\u00A0]';
const MARKER = new RegExp(`УВАГА!(?:${WS}|&nbsp;)*ВАЖЛИВА(?:${WS}|&nbsp;)+ІНФОРМАЦІЯ!?`, 'iu');
const BLOCK_END = /<\/(?:h[1-6]|p|div|td|center)\s*>|<(?:table|hr)\b/i;
const BR = /<br\s*\/?>/gi;
const TAG = /<[^>]*>/g;
const SPACES = new RegExp(`${WS}+`, 'g');

export function extractSiteNotice(html: string): string | null {
  const m = MARKER.exec(html);
  if (!m) return null;
  const from = m.index;
  const after = m.index + m[0].length;
  const scanEnd = Math.min(html.length, after + SITE_NOTICE_MAX_SCAN);
  const endMatch = BLOCK_END.exec(html.substring(after, scanEnd));
  const end = endMatch ? after + endMatch.index : scanEnd;
  const block = html.substring(from, end);

  // Source line breaks are plain whitespace; only <br> starts a new line
  const text = TextNorm.decodeEntities(block.replace(SPACES, ' ').replace(BR, '\n').replace(TAG, ''));
  const lines = text
    .split('\n')
    .map((l) => l.replace(SPACES, ' ').trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return null;

  let out = '';
  for (const line of lines) {
    const add = out.length === 0 ? line.length : line.length + 1;
    if (out.length + add > SITE_NOTICE_MAX_LENGTH) {
      out += '\n…';
      break;
    }
    if (out.length > 0) out += '\n';
    out += line;
  }
  return out;
}
