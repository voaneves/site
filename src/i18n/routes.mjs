export const ROUTE_PAIRS = [
  { pt: '/', en: '/en/' },
  { pt: '/privacidade/', en: '/en/privacy/' },
  { pt: '/projetos/mte/', en: '/en/projects/mte/' },
  { pt: '/projetos/dashboards/', en: '/en/projects/dashboards/' },
  { pt: '/projetos/caato/', en: '/en/projects/caato/' },
  { pt: '/projetos/mota-godinho/', en: '/en/projects/mota-godinho/' },
  { pt: '/projetos/boas-obras/', en: '/en/projects/boas-obras/' },
  { pt: '/projetos/midflow/', en: '/en/projects/midflow/' },
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
