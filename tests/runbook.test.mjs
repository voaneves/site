import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('every workflow file and cron schedule is documented in docs/GITOPS_RUNBOOK.md', async () => {
  const runbook = await fs.readFile(path.join(ROOT, 'docs', 'GITOPS_RUNBOOK.md'), 'utf8');
  const workflowFiles = (await fs.readdir(path.join(ROOT, '.github', 'workflows')))
    .filter((f) => f.endsWith('.yml'))
    .sort();

  assert.ok(workflowFiles.length >= 6);

  for (const file of workflowFiles) {
    assert.ok(runbook.includes(file), `docs/GITOPS_RUNBOOK.md missing workflow ${file}`);
    const content = await fs.readFile(path.join(ROOT, '.github', 'workflows', file), 'utf8');
    for (const m of content.matchAll(/cron:\s*['"]([^'"]+)['"]/g)) {
      const cronExpr = m[1];
      assert.ok(
        runbook.includes(cronExpr),
        `docs/GITOPS_RUNBOOK.md missing cron schedule "${cronExpr}" from ${file}`,
      );
    }
  }
});
