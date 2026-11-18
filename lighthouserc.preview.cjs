const baseUrl = (process.env.PREVIEW_URL || 'https://voaneves.pages.dev').replace(/\/$/, '');

module.exports = {
  ci: {
    collect: {
      url: [`${baseUrl}/`, `${baseUrl}/en/`, `${baseUrl}/privacidade/`],
      numberOfRuns: 5,
      // *.pages.dev always sends X-Robots-Tag: noindex (Cloudflare). Turning the assertion off is not enough: the failed audit
      // still counts in the SEO category score (~0.69), so it is skipped at collection time, as in lighthouserc.prod.cjs.
      settings: { skipAudits: ['is-crawlable', 'canonical'] },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 1, aggregationMethod: 'median-run' }],
        'categories:accessibility': ['error', { minScore: 1, aggregationMethod: 'median-run' }],
        'categories:best-practices': ['error', { minScore: 1, aggregationMethod: 'median-run' }],
        'categories:seo': ['error', { minScore: 0.9, aggregationMethod: 'median-run' }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: '.lighthouseci-preview',
    },
  },
};
