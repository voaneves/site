const form = process.env.LHCI_FORM ?? 'mobile';

module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npx wrangler pages dev dist --port 8788',
      startServerReadyPattern: 'Ready on',
      url: [
        'http://localhost:8788/',
        'http://localhost:8788/en/',
        'http://localhost:8788/privacidade/',
        'http://localhost:8788/en/privacy/',
      ],
      numberOfRuns: 5,
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
