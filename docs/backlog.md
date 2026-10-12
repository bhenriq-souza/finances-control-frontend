# Backlog

Fila de trabalho deste repositório. Formato e regras em [spec 0000](../specs/0000-spec-process.md): cada tarefa é `T-<spec>-<nn>` e declara **What** / **Where** / **Done when**, citando ao menos um `AC-*` ou `INV-*`.

Este arquivo é a camada de **execução**. A camada de **entrega** são as issues `FCF-*` e o [board](https://github.com/users/bhenriq-souza/projects/2). Cada tarefa aberta tem também a sua issue no board, sub-issue da `FCF-*` da spec, com o número anotado ao lado do título (`· #N`); o PR da tarefa fecha a issue dela, e o PR da última tarefa de uma spec fecha também a `FCF-*` (spec 0000, _Rastreabilidade com o board_).

## Plataforma e processo

Tarefas das specs [0001](../specs/0001-development-workflow.md) e [0002](../specs/0002-quality-gates.md), da issue de entrega [FCF-001](https://github.com/bhenriq-souza/finances-control-frontend/issues/1) (seed do kit). O seed já instalou o hook `commit-msg` com commitlint e o orquestrador com os onze gates.

- [ ] **T-0001-01 — Tornar o status check `check` obrigatório em `develop`** · #8
    - What: depois do merge do seed e da primeira execução do workflow `ci`, exigir o check verde para merge (regra 3 da proteção de branch)
    - Where: configurações do repositório no GitHub
    - Done when: `AC-0001-03` verificado — a proteção lista `check` como obrigatório e um PR vermelho fica bloqueado
- [ ] **T-0002-01 — Testes do orquestrador de gates** · #9
    - What: com o Vitest do scaffold, cobrir `scripts/check.mjs` — classificação PASS/FAIL/SKIP, código de saída, modo `--require-tools` e a disponibilidade dos gates `sast`, `contract`, `build` e `e2e`
    - Where: `scripts/check.test.mjs`
    - Done when: `AC-0002-01`, `AC-0002-02` e `AC-0002-03` cobertos por teste automatizado, e `AC-0002-05` no que toca ao orquestrador
