---
name: check
description: Roda o pipeline local completo de qualidade (contrato e artefatos gerados, formatação, lint, tipos, fronteiras de módulo, testes com cobertura, auditoria de dependências, validação das specs, SAST, build com orçamento de bundle e e2e nos três tamanhos de tela) através do orquestrador único. Use antes de abrir qualquer PR, ou quando pedirem para verificar se o workspace está verde.
---

# Rodar o pipeline de qualidade

Existe **um** comando, e é ele que o CI executa também (spec 0002, INV-0002-03):

```bash
npm run check
```

Ao final, reporte a tabela de estado que o próprio orquestrador imprime. Uma tarefa não está pronta com qualquer gate vermelho (DoD da spec 0000).

## Regras

- Os gates rodam **em sequência e até o fim** — não pare no primeiro erro: colete todas as falhas e só então corrija.
- Um gate aparece como **SKIP** quando a ferramenta ainda não existe nesta fase do repositório (antes do scaffold, por exemplo) ou não está no ambiente (o Chromium do Playwright: `npx playwright install chromium`). SKIP não é PASS: verifique se o motivo faz sentido para o estado atual.
- `contract` e `sast` precisam de rede (GitHub e registro do Semgrep). Sem rede eles falham, não pulam.
- Para simular o rigor do CI, use `npm run check -- --require-tools`: todo SKIP vira falha.
- Formatadores podem ser usados na forma que corrige (`npx prettier --write .`, `npx eslint . --fix`); depois rode `npm run check` de novo.
- **Nunca afrouxe a configuração de um gate para passar.** Mudar gate exige alterar a spec 0002 no próprio PR.
- **Nunca invente resultado.** Cole a saída real; se não executou, diga que não executou.
