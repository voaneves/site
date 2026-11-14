import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { routeAlternates } from './src/i18n/routes.mjs';

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
      },
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
