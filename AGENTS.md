# AGENTS.md — `voaneves/site`

Site institucional `voaneves.com` (Astro 7 + `@voaneves/brand` + Cloudflare Pages). Runbook GitOps em `docs/GITOPS_RUNBOOK.md`.

## Regras

- Nunca mencione IA, Claude ou Gemini em commits, PRs, código ou arquivos (sem `Co-Authored-By`).
- Não faça commit nem push. Resposta que altera arquivos termina com um one-liner para PowerShell 7.6:
  `Set-Location <raiz do repo>; git add -- <arquivos alterados> && git commit -m '<tipo>(<escopo>): <resumo>' && git pull --rebase --autostash && git push`
- `git add` só com os arquivos alterados, nunca `-A` nem `.`. Conventional Commits em inglês, sem gitmoji. Aspas simples (apóstrofo vira `''`).
