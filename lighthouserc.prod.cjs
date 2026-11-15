const siteUrl = (process.env.SITE_URL || 'https://voaneves.com').replace(/\/$/, '');
const form = process.env.LHCI_FORM ?? 'mobile';
// *.pages.dev always sends X-Robots-Tag: noindex (Cloudflare), so is-crawlable only means something on the real domain.
const isAlias = /\.pages\.dev$/.test(new URL(siteUrl).hostname);
const base = form === 'desktop' ? { preset: 'desktop' } : {};

module.exports = {
  ci: {
    collect: {
      url: [`${siteUrl}/`, `${siteUrl}/en/`, `${siteUrl}/privacidade/`, `${siteUrl}/en/privacy/`],
      numberOfRuns: 5,
      settings: isAlias ? { ...base, skipAudits: ['is-crawlable'] } : base,
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 1, aggregationMethod: 'median-run' }],
        'categories:accessibility': ['error', { minScore: 1, aggregationMethod: 'median-run' }],
        'categories:best-practices': ['error', { minScore: 1, aggregationMethod: 'median-run' }],
        'categories:seo': ['error', { minScore: 1, aggregationMethod: 'median-run' }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.01 }],
        'total-blocking-time': ['error', { maxNumericValue: 50 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: '.lighthouseci-prod',
    },
  },
};
