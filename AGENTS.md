# AGENTS.md — `voaneves/site`

## Regras Operacionais

- Nunca mencionar Claude, Gemini ou IA em commits, PRs ou arquivos (sem `Co-Authored-By`).
- Nunca fazer `git commit` ou `git push` sem autorização explícita do usuário.
- **One-liner PowerShell 7.6 (`pwsh`) obrigatório ao final:** Sempre encerrar respostas que criem ou alterem arquivos com um único comando one-liner para PowerShell 7.6 (encadeado com `&&`) que muda para a pasta do projeto (`Set-Location`), adiciona os arquivos (`git add -A`), faz o commit em Conventional Commits sem citar IA/Claude/Gemini e sem `Co-Authored-By` (`git commit -m "..."`), e faz o push (`git push`).
  - Exemplo:
    ```powershell
    Set-Location D:\GitHub\site && git add -A && git commit -m "chore(site): descrição" && git push
    ```
