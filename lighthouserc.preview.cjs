const baseUrl = (process.env.PREVIEW_URL || 'https://voaneves.pages.dev').replace(/\/$/, '');

module.exports = {
  ci: {
    collect: {
      url: [`${baseUrl}/`, `${baseUrl}/en/`, `${baseUrl}/privacidade/`],
      numberOfRuns: 5,
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 1, aggregationMethod: 'median-run' }],
        'categories:accessibility': ['error', { minScore: 1, aggregationMethod: 'median-run' }],
        'categories:best-practices': ['error', { minScore: 1, aggregationMethod: 'median-run' }],
        'categories:seo': ['error', { minScore: 0.9, aggregationMethod: 'median-run' }],
        'is-crawlable': 'off',
        canonical: 'off',
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: '.lighthouseci-preview',
    },
  },
};
