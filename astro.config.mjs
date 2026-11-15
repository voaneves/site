import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { routeAlternates } from './src/i18n/routes.mjs';

// Astro does not hash `is:inline` scripts. The theme/js head script in Base.astro must run before
// first paint, so hash it here from the same text Astro emits (verbatim, LF line endings).
const baseSrc = readFileSync(new URL('./src/layouts/Base.astro', import.meta.url), 'utf8');
const headInline = [...baseSrc.matchAll(/<script is:inline>([\s\S]*?)<\/script>/g)].map(
  (m) => `sha256-${createHash('sha256').update(m[1].replace(/\r\n/g, '\n')).digest('base64')}`,
);

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? 'https://voaneves.com',
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
    inlineStylesheets: 'always',
  },
  i18n: {
    defaultLocale: 'pt-br',
    locales: ['pt-br', 'en'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
  prefetch: false,
  security: {
    csp: {
      algorithm: 'SHA-256',
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self' https://cloudflareinsights.com",
        "manifest-src 'self'",
        "frame-src 'none'",
      ],
      scriptDirective: {
        resources: ["'self'", 'https://static.cloudflareinsights.com'],
        hashes: headInline,
      },
    },
  },
  vite: {
    build: {
      // Inline the ~6 KB entry script into the HTML (CSP hashes it automatically): an extra request
      // otherwise lands inside the LCP window.
      assetsInlineLimit: 8192,
    },
  },
  integrations: [
    mdx(),
    sitemap({
      serialize: (item) => ({
        ...item,
        links: routeAlternates(item.url),
      }),
    }),
  ],
});
