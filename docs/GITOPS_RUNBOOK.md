# Runbook de Operações GitOps — `voaneves/site`

Guia operacional para manutenção, publicação contínua no Cloudflare Pages, resposta a incidentes e recuperação de desastres (DR).

> **Convenção de responsabilidades:**
> - **[AUTO]**: Executado por GitHub Actions (`.github/workflows/`) ou scripts (`scripts/`).
> - **[MANUAL]**: Executado pelo mantenedor nos painéis do GitHub ou Cloudflare.

## 1. Visão Geral

```
PR -> CI (ci.yml) + Título (pr-title.yml) + Prévia (preview.yml)
Push main -> CI (ci.yml) -> Candidato -> Smoke -> Produção -> LHCI (deploy.yml)
Cron -> Uptime a cada 4h (uptime.yml) + Auditoria semanal (auditoria.yml)
```

## 2. Inventário de Workflows

| Workflow | Arquivo | Gatilho / Agendamento | Escopo |
|---|---|---|---|
| CI | `.github/workflows/ci.yml` | `pull_request`, `workflow_call`, `workflow_dispatch` | Lint, testes unitários, build, orçamento, HTML, Playwright + axe e LHCI estático (`mobile`/`desktop`). |
| Prévia (PR) | `.github/workflows/preview.yml` | `pull_request` (`opened`, `synchronize`, `reopened`, `closed`) | Publica prévia isolada (`pr-<n>.voaneves.pages.dev`), comenta no PR, roda LHCI na prévia e limpa ao fechar. |
| Deploy | `.github/workflows/deploy.yml` | `push: [main]`, `workflow_dispatch` | Executa CI -> publica candidato -> smoke -> promove produção -> smoke -> rollback automático se falhar. |
| Monitoramento (uptime) | `.github/workflows/uptime.yml` | `0 */4 * * *` (a cada 4h UTC) e `workflow_dispatch` | Verifica HTTP 200 em `/` e `/en/`, validade TLS (`>= 14d`) e gerencia issue `🚨 Fora do ar`. |
| Auditoria semanal | `.github/workflows/auditoria.yml` | `0 9 * * 1` (segunda 06:00 America/Araguaina) e `workflow_dispatch` | Verifica deriva de configurações Cloudflare vs `ops/cloudflare-expected.json` e LHCI em produção. |
| Título do PR | `.github/workflows/pr-title.yml` | `pull_request_target` | Valida título em formato Conventional Commits sem executar código do PR. |
| CodeQL Advanced | `.github/workflows/codeql.yml` | `push: [main]`, `pull_request: [main]`, `36 3 * * 0` (domingo 03:36 UTC) | Análise estática de segurança (CodeQL) para `javascript-typescript` e `actions`. |
| Contraste (tokens) | `.github/workflows/contrast.yml` | `push: [main]`, `pull_request`, `workflow_dispatch` | Gate WCAG 2.2/APCA dos pares de cor reais do site com `voaneves/dtcg-contrast@v1` (`.github/contrast/contrast.config.json`). |
| readme-kit | `.github/workflows/readme-kit.yml` | `push: [main]`, `workflow_dispatch` | Gate WCAG 2.2/APCA dos tokens e assets do README com `voaneves/dtcg-contrast@v1` (`.github/readme-kit/contrast.config.json`). |

### 2.1 Fatiamento do E2E (Playwright + axe)

O job `e2e-shard` do `ci.yml` roda 6 fatias em paralelo; o check agregador `Acessibilidade (Playwright + axe)` (`e2e-a11y`) é o exigido pelo ruleset. Quem distribui os specs entre as fatias é `scripts/e2e-shard.mjs`: arquivos de spec inteiros, empacotados por duração (maior primeiro) com os pesos em `e2e/shard-weights.json`. Dentro de uma fatia, `fullyParallel` espalha os testes entre os workers da máquina. Spec sem peso recebe a mediana, então nunca fica de fora.

O Chromium vem do cache de `~/.cache/ms-playwright`; só no cache perdido o passo roda `playwright install --with-deps` (apt com retries e timeout). Cada fatia grava `playwright-report/results.json` (reporter `json`) no artefato `playwright-report-<n>`.

Regenerar os pesos (quando entrar spec novo ou as durações mudarem muito):

```
gh run download <id-do-run> -D $TMP/run1 -p 'playwright-report-*'   # repita para 1-3 runs
node scripts/e2e-weights.mjs $TMP/run1 [$TMP/run2 ...]            # regrava e2e/shard-weights.json
npm test                                                           # confere cobertura e equilíbrio
```

Cada argumento é um run (soma as tentativas por spec; média entre runs). Commite só `e2e/shard-weights.json`.

## 3. Ambientes e Segredos **[MANUAL]**

- `preview`: Permite todas as branches. Segredos: `CLOUDFLARE_API_TOKEN` (Cloudflare Pages Edit), `CLOUDFLARE_ACCOUNT_ID`. Variável: `CF_PAGES_PROJECT=voaneves`.
- `production`: Permite apenas `main`. Mesmos segredos de `preview`. Variáveis: `CF_PAGES_PROJECT`, `SITE_URL`, `PUBLIC_CF_BEACON_TOKEN`.
- `ops`: Permite apenas `main`, **sem** revisor obrigatório para não bloquear crons. Segredo: `CLOUDFLARE_AUDIT_TOKEN` (somente leitura). Variáveis: `SITE_URL`, `CLOUDFLARE_ZONE_ID`.

## 4. Cloudflare Pages & Zona

- Projeto Pages (`wrangler.jsonc`): `name: "voaneves"`, `pages_build_output_dir: "./dist"`, `compatibility_date: "2026-11-01"`.
- Cabeçalhos e redirecionamentos versionados exclusivamente em `public/_headers` e `public/_redirects`.
- Configurações esperadas da zona auditadas semanalmente em `ops/cloudflare-expected.json` (`Rocket Loader` off, `Email Obfuscation` off, `SSL Full Strict`, `Early Hints` on, `HTTP/3` on).
- Kill-switch do service worker legado mantido em `public/worker.min.js` (`Cache-Control: no-cache`).

## 5. Rollback & Resposta a Incidentes

- **Falha pós-promoção (`deploy.yml`):** **[AUTO]** Executa rollback imediato para o deployment de produção anterior via API do Cloudflare Pages.
- **Incidente detectado por `uptime.yml`:** **[AUTO]** Abre ou atualiza a issue `🚨 Fora do ar` com throttled comments (1/hora) e fecha automaticamente quando recuperar.
- **Regressão visual manual:** **[MANUAL]** Reverter para deployment anterior no painel do Cloudflare Pages e abrir PR de `git revert` na `main`.

## 6. Comandos Locais

- `npm run dev` — Servidor local Astro.
- `npm run lint` — Verificação estática (`oxlint`).
- `npm test` — Testes unitários (`i18n`, `edge-config`, `runbook`).
- `npm run build && npm run check:budget && npm run check:html` — Build estático e portões de orçamento/HTML.
- `npm run preview` — Servidor local `wrangler pages dev dist --port 8788` aplicando `_headers` e `_redirects`.
