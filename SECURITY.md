# Política de Segurança / Security Policy

## Versões suportadas

O site é publicado de forma contínua a partir da branch `main`. Só a versão em produção (https://voaneves.com) recebe correções de segurança. Branches e prévias de PR não são suportadas.

| Versão | Suportada |
| :----- | :-------- |
| `main` (produção) | :white_check_mark: |
| Qualquer outra branch ou prévia | :x: |

## Como reportar uma vulnerabilidade

**Não abra uma issue pública** para falhas de segurança.

Use o relato privado do GitHub:

1. Abra a aba **Security** deste repositório.
2. Clique em **Report a vulnerability**.
3. Descreva o problema com o máximo de detalhe possível.

Inclua, se puder:

- a URL ou o arquivo afetado;
- os passos para reproduzir (ou uma prova de conceito mínima);
- o impacto que você enxerga;
- o navegador e o sistema usados, quando relevante.

## O que esperar

- Confirmação do recebimento em até **7 dias**.
- Uma avaliação inicial (se a falha foi reproduzida e qual a gravidade) em até **14 dias**.
- Aviso quando a correção for publicada. Se você quiser, o crédito pela descoberta vai no registro da correção.

Este é um projeto pessoal, mantido sem equipe dedicada: os prazos acima são um esforço de boa-fé, não um compromisso contratual. Não há programa de recompensas (bug bounty).

## Escopo

Dentro do escopo: o código deste repositório e o site publicado em https://voaneves.com (conteúdo, scripts, cabeçalhos de segurança, fluxos de build e de CI).

Fora do escopo:

- falhas na infraestrutura de terceiros (Cloudflare, GitHub), que devem ser reportadas aos respectivos fornecedores;
- ataques de negação de serviço, força bruta ou engenharia social;
- relatórios automáticos de scanners sem impacto demonstrado;
- ausência de cabeçalhos ou configurações sem um risco concreto explicado.

Pedimos que você teste só com contas e dados seus, não acesse nem altere dados de terceiros e dê um prazo razoável para a correção antes de divulgar o problema publicamente.

---

## English summary

Only the production site (https://voaneves.com, built from `main`) receives security fixes.

**Please do not open a public issue.** Report vulnerabilities privately through the **Security** tab → **Report a vulnerability**. Include the affected URL or file, reproduction steps and the impact you see.

This is a personal project: I aim to acknowledge reports within 7 days and give an initial assessment within 14 days. There is no bug bounty. Third-party infrastructure (Cloudflare, GitHub), denial-of-service, brute force, social engineering and unproven scanner output are out of scope. Please test only with your own accounts and data, and allow reasonable time for a fix before any public disclosure.
