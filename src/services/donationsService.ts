export interface DonationLink {
  title: string;
  url: string;
}

export const GITHUB_DONATIONS_URL =
  'https://raw.githubusercontent.com/IgorZaharov/Android-ZTBlackoutPreWarning/main/donations.json';
export const GITHUB_PUBLIC_DONATIONS_URL =
  'https://raw.githubusercontent.com/IgorZaharov/Android-ZTBlackoutPreWarning/main/public/donations.json';

export const DONATIONS_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 1 time per day (24 hours)

const STORAGE_DATA_KEY = 'zt_donations_links_v1';
const STORAGE_TS_KEY = 'zt_donations_last_fetch_ms_v1';

export const DEFAULT_DONATIONS: DonationLink[] = [
  {
    title: 'Допомога тваринам',
    url: 'https://send.monobank.ua/jar/7vJA5xrLoV',
  },
  {
    title: 'Фонд Повернись Живим',
    url: 'https://savelife.in.ua/donate/',
  },
];

function sanitizeDonations(raw: unknown): DonationLink[] | null {
  if (!Array.isArray(raw)) return null;
  const valid = raw
    .filter(
      (item): item is { title: string; url: string } =>
        Boolean(
          item &&
            typeof item === 'object' &&
            typeof (item as any).title === 'string' &&
            typeof (item as any).url === 'string' &&
            (item as any).title.trim().length > 0 &&
            (item as any).url.trim().startsWith('http')
        )
    )
    .map((item) => ({
      title: item.title.trim(),
      url: item.url.trim(),
    }));
  return valid.length > 0 ? valid : null;
}

export function getCachedDonations(): DonationLink[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_DONATIONS;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_DATA_KEY);
    if (!raw) return DEFAULT_DONATIONS;
    const parsed = sanitizeDonations(JSON.parse(raw));
    return parsed || DEFAULT_DONATIONS;
  } catch {
    return DEFAULT_DONATIONS;
  }
}

export function getFaviconCandidateUrls(pageUrl: string): string[] {
  try {
    const parsed = new URL(pageUrl.trim());
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (!host) return [];

    const parts = host.split('.');
    const twoPartTlds = new Set(['in.ua', 'com.ua', 'org.ua', 'gov.ua', 'net.ua', 'edu.ua', 'co.uk', 'org.uk']);
    const lastTwo = parts.length >= 2 ? `${parts[parts.length - 2]}.${parts[parts.length - 1]}` : host;
    let rootDomain = host;
    if (parts.length > 2) {
      rootDomain = twoPartTlds.has(lastTwo) && parts.length >= 3
        ? `${parts[parts.length - 3]}.${lastTwo}`
        : lastTwo;
    }

    const candidates = [
      `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(rootDomain)}`,
      ...(rootDomain !== host ? [`https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(host)}`] : []),
      `https://icons.duckduckgo.com/ip3/${host}.ico`,
      ...(rootDomain !== host ? [`https://icons.duckduckgo.com/ip3/${rootDomain}.ico`] : []),
      `https://${host}/favicon.ico`,
    ];
    return Array.from(new Set(candidates));
  } catch {
    return [];
  }
}

export async function getDonationsWithDailyRefresh(
  nowMs: number = Date.now(),
  forceRefresh: boolean = false
): Promise<DonationLink[]> {
  const cached = getCachedDonations();

  if (!forceRefresh && typeof window !== 'undefined' && window.localStorage) {
    try {
      const lastFetchStr = window.localStorage.getItem(STORAGE_TS_KEY);
      const lastFetchMs = lastFetchStr ? parseInt(lastFetchStr, 10) : 0;
      if (lastFetchMs > 0 && nowMs - lastFetchMs < DONATIONS_REFRESH_INTERVAL_MS) {
        return cached;
      }
    } catch {
      // Proceed to fetch
    }
  }

  const merged = new Map<string, DonationLink>();
  const githubEndpoints = [
    `${GITHUB_DONATIONS_URL}?t=${nowMs}`,
    `${GITHUB_PUBLIC_DONATIONS_URL}?t=${nowMs}`,
    '/donations.json',
  ];

  for (const endpoint of githubEndpoints) {
    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      if (response.ok) {
        const json = await response.json();
        const valid = sanitizeDonations(json);
        if (valid) {
          for (const item of valid) {
            if (!merged.has(item.url)) {
              merged.set(item.url, item);
            }
          }
        }
      }
    } catch {
      // Try next endpoint
    }
  }

  if (merged.size > 0) {
    const finalItems = Array.from(merged.values());
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_DATA_KEY, JSON.stringify(finalItems));
        window.localStorage.setItem(STORAGE_TS_KEY, String(nowMs));
      } catch {
        // Ignore quota errors
      }
    }
    return finalItems;
  }

  return cached;
}
