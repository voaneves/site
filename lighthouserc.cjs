const form = process.env.LHCI_FORM ?? 'mobile';
const port = process.env.PW_PORT ?? '8788';
const base = `http://localhost:${port}`;

module.exports = {
  ci: {
    collect: {
      startServerCommand: `npx wrangler pages dev dist --port ${port}`,
      startServerReadyPattern: 'Ready on',
      url: [
        `${base}/`,
        `${base}/en/`,
        `${base}/privacidade/`,
        `${base}/en/privacy/`,
        `${base}/projetos/caato/`,
      ],
      numberOfRuns: 3,
      settings: form === 'desktop' ? { preset: 'desktop' } : {},
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 1, aggregationMethod: 'median-run' }],
        'categories:accessibility': ['error', { minScore: 1, aggregationMethod: 'median-run' }],
        'categories:best-practices': ['error', { minScore: 1, aggregationMethod: 'median-run' }],
        'categories:seo': ['error', { minScore: 1, aggregationMethod: 'median-run' }],
        'largest-contentful-paint': ['error', { maxNumericValue: form === 'desktop' ? 800 : 1200, aggregationMethod: 'median-run' }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.01 }],
        'total-blocking-time': ['error', { maxNumericValue: 50 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: '.lighthouseci',
    },
  },
};
