const siteUrl = (process.env.SITE_URL || 'https://voaneves.com').replace(/\/$/, '');
const form = process.env.LHCI_FORM ?? 'mobile';

module.exports = {
  ci: {
    collect: {
      url: [`${siteUrl}/`, `${siteUrl}/en/`, `${siteUrl}/privacidade/`, `${siteUrl}/en/privacy/`],
      numberOfRuns: 5,
      settings: form === 'desktop' ? { preset: 'desktop' } : {},
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
