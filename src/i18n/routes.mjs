export const ROUTE_PAIRS = [
  { pt: '/', en: '/en/' },
  { pt: '/privacidade/', en: '/en/privacy/' },
];

/**
 * Resolve localized alternate links for @astrojs/sitemap serialize hook and <head>.
 */
export function routeAlternates(urlOrPath) {
  let pathname = urlOrPath;
  let origin = 'https://voaneves.com';

  try {
    const parsed = new URL(urlOrPath);
    pathname = parsed.pathname;
    origin = parsed.origin;
  } catch {
    if (!pathname.startsWith('/')) pathname = `/${pathname}`;
  }

  if (!pathname.endsWith('/')) pathname = `${pathname}/`;

  const pair = ROUTE_PAIRS.find((p) => p.pt === pathname || p.en === pathname);
  if (!pair) return [];

  return [
    { lang: 'pt-BR', url: `${origin}${pair.pt}` },
    { lang: 'en', url: `${origin}${pair.en}` },
    { lang: 'x-default', url: `${origin}${pair.pt}` },
  ];
}

export function alternatePathForLocale(pathname, targetLocale) {
  const norm = pathname.endsWith('/') ? pathname : `${pathname}/`;
  const pair = ROUTE_PAIRS.find((p) => p.pt === norm || p.en === norm);
  if (!pair) return targetLocale === 'en' ? '/en/' : '/';
  return targetLocale === 'en' ? pair.en : pair.pt;
}
