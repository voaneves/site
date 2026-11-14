# Checklist de Migração (`voaneves/site`)

## M2 — Esqueleto Astro 7 & GitOps (Atual)

- [x] Estrutura Astro 7 estática com `@voaneves/brand`
- [x] Configuração `wrangler.jsonc`, `public/_headers` e `public/_redirects`
- [x] Kill-switch service worker (`public/worker.min.js`)
- [x] Portões locais (`check:budget`, `check:html`, `tests/*.test.mjs`, `oxlint`)
- [x] Workflows (`ci.yml`, `preview.yml`, `deploy.yml`, `uptime.yml`, `auditoria.yml`, `pr-title.yml`) e `docs/GITOPS_RUNBOOK.md`
- [ ] Gate `[MANUAL]` na nuvem: criar projeto Cloudflare Pages `voaneves`, configurar secrets e conferir prévia PR + Lighthouse 100 x4

## M3–M6 — Próximos Marcos

- [ ] Migração integral das seções e coleções (`M3`)
- [ ] Cutover DNS de `voaneves.com` e `www` (`M4`)
- [ ] Polimento de movimento, cursor e transições (`M5`)
- [ ] Estudos de caso e paridade completa em inglês (`M6`)
