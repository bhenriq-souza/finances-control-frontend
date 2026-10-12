# Backlog

Fila de trabalho deste repositório. Formato e regras em [spec 0000](../specs/0000-spec-process.md): cada tarefa é `T-<spec>-<nn>` e declara **What** / **Where** / **Done when**, citando ao menos um `AC-*` ou `INV-*`.

Este arquivo é a camada de **execução**. A camada de **entrega** são as issues `FCF-*` e o [board](https://github.com/users/bhenriq-souza/projects/2). Cada tarefa aberta tem também a sua issue no board, sub-issue da `FCF-*` da spec, com o número anotado ao lado do título (`· #N`); o PR da tarefa fecha a issue dela, e o PR da última tarefa de uma spec fecha também a `FCF-*` (spec 0000, _Rastreabilidade com o board_).

## Plataforma e processo

Tarefas das specs [0001](../specs/0001-development-workflow.md) e [0002](../specs/0002-quality-gates.md), da issue de entrega [FCF-001](https://github.com/bhenriq-souza/finances-control-frontend/issues/1) (seed do kit). O seed já instalou o hook `commit-msg` com commitlint e o orquestrador com os onze gates.

- [x] **T-0001-01 — Tornar o status check `check` obrigatório em `develop`** · #8
    - What: depois do merge do seed e da primeira execução do workflow `ci`, exigir o check verde para merge (regra 3 da proteção de branch)
    - Where: configurações do repositório no GitHub
    - Done when: `AC-0001-03` verificado — a proteção lista `check` como obrigatório e um PR vermelho fica bloqueado
- [x] **T-0002-01 — Testes do orquestrador de gates** · #9
    - What: com o Vitest do scaffold, cobrir `scripts/check.mjs` — classificação PASS/FAIL/SKIP, código de saída, modo `--require-tools` e a disponibilidade dos gates `sast`, `contract`, `build` e `e2e`
    - Where: `scripts/check.test.mjs`
    - Done when: `AC-0002-01`, `AC-0002-02` e `AC-0002-03` cobertos por teste automatizado, e `AC-0002-05` no que toca ao orquestrador

## Scaffold

Tarefas da [spec 0003](../specs/0003-scaffold.md), da issue de entrega [FCF-002](https://github.com/bhenriq-souza/finances-control-frontend/issues/2). Habilitam o spike (T-0006-01), junto com a publicação.

- [x] **T-0003-01 — Scaffold e gates em execução** · #11
    - What: kit do ADR-0001, estrutura de pastas, regras do `dependency-cruiser`, configuração de runtime, Vitest, Playwright com o teste de fumaça da página provisória, `scripts/build.mjs`, o esqueleto do gate `contract` (passo 1 e a entrada `openapi`) e o CI com Chromium e `--require-tools`
    - Where: raiz, `src/`, `e2e/`, `scripts/build.mjs`, `scripts/contract.mjs`, `sources.json`, `.dependency-cruiser.cjs`, `.github/workflows/ci.yml`
    - Done when: `AC-0003-01`, `AC-0003-03`, `AC-0003-04`, `AC-0003-06` e `AC-0003-07` cobertos; `INV-0003-02` a `INV-0003-04` verificados
- [x] **T-0003-02 — Porta de autenticação e página do spike** · #12
    - What: `AuthClient` com as implementações do Firebase e falsa, e a página mínima de login em `/` que mostra o resultado de `GET /api/users/me`
    - Where: `src/features/identity/`, `src/routes/`, `e2e/smoke.spec.ts`
    - Done when: `AC-0003-02` e `AC-0003-05` cobertos; `INV-0003-01` verificado

## Tema

Tarefas da [spec 0004](../specs/0004-theme.md), da issue de entrega [FCF-003](https://github.com/bhenriq-souza/finances-control-frontend/issues/3).

- [x] **T-0004-01 — Gerador do tema e sincronia no gate `contract`** · #13
    - What: entrada `tokens` em `sources.json`, `scripts/theme.mjs`, `npm run theme`, `tokens.css` gerado e o passo 3 de `scripts/contract.mjs`, sobre o esqueleto da T-0003-01
    - Where: `sources.json`, `scripts/theme.mjs`, `scripts/contract.mjs`, `src/ui/theme/tokens.css`, `src/index.css`
    - Done when: `AC-0004-01` e `AC-0004-02` cobertos; `INV-0004-01` verificado
- [x] **T-0004-02 — Fontes, escolha de tema, contraste e lint de cor** · #14
    - What: `@fontsource`, `ThemeProvider` com o script anti-piscada, teste dos 60 pares de contraste e a regra de lint contra cor literal
    - Where: `src/ui/theme/`, `index.html`, `eslint.config.js`
    - Done when: `AC-0004-03`, `AC-0004-04` e `AC-0004-05` cobertos; `INV-0004-02` a `INV-0004-04` verificados

## Cliente da API

Tarefas da [spec 0005](../specs/0005-api-client.md), da issue de entrega [FCF-004](https://github.com/bhenriq-souza/finances-control-frontend/issues/4). Contrato fixado na tag `v1.1.0` do backend.

- [x] **T-0005-01 — Tipos gerados, catálogo pt-BR e o gate `contract`** · #15
    - What: `scripts/api-generate.mjs` com `predev`/`prebuild`, os passos 2 e 4 de `scripts/contract.mjs`, sobre o esqueleto da T-0003-01 (que já traz a entrada `openapi` e o passo 1), e o catálogo com os 55 códigos
    - Where: `sources.json`, `scripts/`, `src/api/errors/catalog.ts`
    - Done when: `AC-0005-01` e `AC-0005-05` cobertos; `INV-0005-01` e `INV-0005-04` verificados
- [x] **T-0005-02 — Cliente, token, `ApiError` e `QueryClient`** · #16
    - What: `api` com `openapi-fetch`, `setTokenProvider` e a repetição de `TOKEN_EXPIRED`, `ApiError` e `unwrap`, proxy de `/api` no `vite dev`, retry e efeitos globais por `code`
    - Where: `src/api/`, `src/app/query-client.ts`, `vite.config.ts`
    - Done when: `AC-0005-02`, `AC-0005-03`, `AC-0005-04`, `AC-0005-06` e `AC-0005-07` cobertos; `INV-0005-02`, `INV-0005-03` e `INV-0005-05` verificados

## Autenticação e app shell

Tarefas da [spec 0006](../specs/0006-auth-and-shell.md), da issue de entrega [FCF-005](https://github.com/bhenriq-souza/finances-control-frontend/issues/5).

- [x] **T-0006-01 — Spike: login Google numa origem HTTP fora de `localhost`** · #17
    - What: primeira tarefa depois das specs de fundação; roteiro da spec no desktop e no celular, contra a página do spike publicada em `http://finances.dev.homelab.local/`; sucesso = login Google concluído e `GET /api/users/me` com `200` pelo token obtido; plano B = TLS no ingress de `dev` com CA local
    - Where: evidência no PR; só `docs/backlog.md` e, se falhar, a revisão da spec 0006
    - Done when: `AC-0006-01` — resultado registrado; depende de T-0003-02 e T-0007-04
- [x] **T-0006-02 — Rotas de autenticação, estados da conta e guarda** · #18
    - What: porta `AuthClient` completa, `/entrar`, `/criar-conta`, `/redefinir-senha`, `/verificar-email`, `/aguardando-aprovacao`, layout `_app` com a guarda por `GET /users/me`, `setTokenProvider` e a remoção da página do spike
    - Where: `src/features/identity/`, `src/routes/`, `src/app/`, `e2e/`
    - Done when: `AC-0006-02` a `AC-0006-05`, `AC-0006-09` e `AC-0006-10` cobertos; `INV-0006-01`, `INV-0006-02`, `INV-0006-05` e `INV-0006-06` verificados
- [x] **T-0006-03 — App shell responsivo** · #19
    - What: cabeçalho, barra inferior e lateral, lista de navegação por perfil, menu do usuário com o seletor de tema, marca da FarmTech e a tela inicial provisória
    - Where: `src/app/shell/`, `src/ui/brand/`, `e2e/shell.spec.ts`
    - Done when: `AC-0006-06`, `AC-0006-07` e `AC-0006-08` cobertos; `INV-0006-03` e `INV-0006-04` verificados

## Publicação

Tarefas da [spec 0007](../specs/0007-publication.md), da issue de entrega [FCF-006](https://github.com/bhenriq-souza/finances-control-frontend/issues/6), na ordem de publicação da spec. Habilitam o spike (T-0006-01).

- [x] **T-0007-01 — Imagem nginx** · #20
    - What: `Dockerfile` multi-stage, `nginx/default.conf` com cache, fallback da SPA, `/healthz` e cabeçalhos, e `.dockerignore`
    - Where: `Dockerfile`, `nginx/`, `.dockerignore`
    - Done when: `AC-0007-01` e `AC-0007-02` verificados localmente; `INV-0007-02` e `INV-0007-03`
- [x] **T-0007-02 — WIF, deploy key e secrets do CI** · #21
    - What: repositório em `github_allowed_repositories` do `homelab-infra` (o responsável aplica o Terraform), deploy key no `homelab-gitops` e os secrets `GCP_WIF_PROVIDER`, `GCP_SERVICE_ACCOUNT` e `GITOPS_DEPLOY_KEY`; executada pelo líder com o ok do responsável
    - Where: `homelab-infra`, `homelab-gitops` (deploy keys) e secrets deste repositório
    - Done when: pré-requisitos cumpridos, provados pela autenticação no GCP da `AC-0007-03` na T-0007-03
- [x] **T-0007-03 — Workflow de deploy** · #22
    - What: `.github/workflows/deploy.yml` chamando o workflow reutilizável com `app-name: finances-frontend`; o primeiro run publica a imagem e falha no passo de GitOps, como previsto
    - Where: `.github/workflows/deploy.yml`
    - Done when: `AC-0007-03` verificado; `INV-0007-01`
- [x] **T-0007-04 — Manifests de `dev` e troca da raiz do host** · #23
    - What: `finances-frontend` no `homelab-gitops` (deployment, ConfigMap com a web config, service, ingress `/`), registro no kustomization de `dev` e a retirada do ingress `/` do backend; executada pelo líder, com a evidência colada aqui
    - Where: `homelab-gitops` (`clusters/homelab/workloads/dev/manifests/`); evidência no PR deste repositório
    - Done when: `AC-0007-04`, `AC-0007-05` e `AC-0007-06` verificados no cluster; `INV-0007-04`

## Dinheiro

Tarefas da [spec 0008](../specs/0008-money.md), da issue de entrega [FCF-007](https://github.com/bhenriq-souza/finances-control-frontend/issues/7). Não bloqueiam o spike; precisam estar prontas antes das telas de F003.

- [x] **T-0008-01 — Parser, formatação e lint de dinheiro** · #24
    - What: `Cents`, `isCents`, `parseBRL`, `formatBRL` e a regra de lint contra `parseFloat`, `toFixed` e `Math.round`
    - Where: `src/shared/money/`, `eslint.config.js`
    - Done when: `AC-0008-01` a `AC-0008-04` e `AC-0008-06` cobertos; `INV-0008-01`, `INV-0008-02` e `INV-0008-04` verificados
- [x] **T-0008-02 — `Money`, `MoneyInput` e `moneySchema`** · #25
    - What: componente de exibição com sinal e tom, campo de entrada que entrega centavos e o schema zod com as mensagens pt-BR
    - Where: `src/ui/money.tsx`, `src/ui/money-input.tsx`, `src/shared/money/schema.ts`
    - Done when: `AC-0008-05` coberto; `INV-0008-03` verificado

## Telas de domínio — ordem de execução

As tarefas das specs 0009 a 0018 rodam em quatro rodadas de subagentes, com arquivos disjuntos dentro de cada rodada. O conflito esperado fica só em `package-lock.json`, nesta lista de checkboxes e em `src/app/shell/navigation.ts`, onde cada spec acrescenta o seu item na ordem da spec 0009.

| Rodada | Tarefas (spec: números das tarefas)                          |
| ------ | ------------------------------------------------------------ |
| R1     | 0009: 01 a 05                                                |
| R2     | 0010: 01 · 0011: 01 · 0012: 01, 04 · 0014: 01, 04 · 0018: 01 |
| R3     | 0011: 02 · 0012: 02, 03 · 0014: 02, 03 · 0013: 01            |
| R4     | 0013: 02, 03 · 0015: 01, 02 · 0017: 01                       |

## Listas, formulários e dados de referência

Tarefas da [spec 0009](../specs/0009-lists-and-reference-data.md), da issue de entrega [FCF-008](https://github.com/bhenriq-souza/finances-control-frontend/issues/49).

- [ ] **T-0009-01 — Consultas, chaves, invalidação e permissões** · #59
    - What: `src/api/queries/` (chaves, consultas de referência, lookups, usuário atual movido de `identity`, `invalidateAfter`), `src/api/permissions.ts`, os usuários `lancador` e `leitor` no fake e o `stubApi` do e2e
    - Where: `src/api/queries/`, `src/api/permissions.ts`, `src/features/identity/current-user.ts`, `src/features/identity/index.ts`, `src/features/identity/auth-client/fake-auth-client.ts`, `e2e/fixtures/`
    - Done when: `AC-0009-01`, `AC-0009-02` e `AC-0009-10` cobertos; `INV-0009-01`, `INV-0009-02` e `INV-0009-03` verificados
- [ ] **T-0009-02 — Datas e `StatusBadge`** · #60
    - What: `src/shared/dates/` e o selo com as tabelas de status e os selos derivados
    - Where: `src/shared/dates/`, `src/ui/status-badge.tsx`, `src/ui/status-labels.ts`
    - Done when: `AC-0009-03` e `AC-0009-04` cobertos; `INV-0009-04` e `INV-0009-05` verificados
- [ ] **T-0009-03 — `EntryList`, estados e `BarList`** · #61
    - What: lista que vira tabela, `EmptyState`, `Skeleton`, `EntryListSkeleton`, `BarList` e a página de prova `/_e2e/lista`
    - Where: `src/ui/entry-list.tsx`, `src/ui/empty-state.tsx`, `src/ui/skeleton.tsx`, `src/ui/charts/bar-list.tsx`, `src/routes/_e2e/lista.tsx`, `e2e/entry-list.spec.ts`
    - Done when: `AC-0009-05` coberto
- [ ] **T-0009-04 — Formulários, erros da API nos campos e aviso global** · #62
    - What: `@radix-ui/react-dialog`, `FormDialog`, `ConfirmDialog`, `SelectField`, `DateField`, `applyApiError`, `Notice` e o provider, `onAuthUnavailable` ligado ao aviso, página de prova `/_e2e/formulario`
    - Where: `src/ui/`, `src/api/errors/form-errors.ts`, `src/app/app.tsx`, `src/app/notices.tsx`, `src/routes/_e2e/formulario.tsx`, `e2e/form-dialog.spec.ts`, `package.json`
    - Done when: `AC-0009-06`, `AC-0009-07` e `AC-0009-09` cobertos; `INV-0009-06` verificado
- [x] **T-0009-05 — Campo `slot` da navegação e a página Mais** · #63
    - What: `slot` nos itens, barra inferior com no máximo quatro itens e **Mais**, rota `/mais` e o redirecionamento no desktop
    - Where: `src/app/shell/`, `src/routes/_app/mais.tsx`, `e2e/more.spec.ts`
    - Done when: `AC-0009-08` coberto

## Administração de usuários

Tarefas da [spec 0010](../specs/0010-users-admin.md), da issue de entrega [FCF-009](https://github.com/bhenriq-souza/finances-control-frontend/issues/50).

- [ ] **T-0010-01 — Tela de usuários e perfis** · #64
    - What: `/usuarios`, item **Usuários**, lista com o filtro de aguardando, diálogo de perfil e revogação
    - Where: `src/features/identity/users-admin/`, `src/routes/_app/usuarios.tsx`, `src/app/shell/navigation.ts`, `e2e/users-admin.spec.ts`, `e2e/fixtures/data/users.ts`
    - Done when: `AC-0010-01` a `AC-0010-07` cobertos; `INV-0010-01` a `INV-0010-03` verificados

## Bancos, contas e cartões

Tarefas da [spec 0011](../specs/0011-accounts.md), da issue de entrega [FCF-010](https://github.com/bhenriq-souza/finances-control-frontend/issues/51).

- [ ] **T-0011-01 — Listas de contas, bancos e cartões** · #65
    - What: `/contas`, `/contas/bancos`, `/cartoes`, `/cartoes/$cartaoId` (resumo), itens **Cartões** e **Contas**, só leitura
    - Where: `src/features/accounts/` (exceto `forms/` e `transfers/`), `src/routes/_app/contas*`, `src/routes/_app/cartoes*`, `src/app/shell/navigation.ts`, `e2e/accounts.spec.ts`, `e2e/fixtures/data/accounts.ts`
    - Done when: `AC-0011-01`, `AC-0011-02` e `AC-0011-08` cobertos; `INV-0011-03` verificado
- [ ] **T-0011-02 — Cadastro de bancos, contas e cartões** · #66
    - What: formulários de criar e alterar, arquivar e desarquivar, só com `accounts.write`; depende de T-0011-01
    - Where: `src/features/accounts/forms/`, as páginas de lista da T-0011-01 (botões e `?novo`/`?editar`), `e2e/accounts-admin.spec.ts`
    - Done when: `AC-0011-03` a `AC-0011-07` cobertos; `INV-0011-01`, `INV-0011-02` e `INV-0011-04` verificados

## Despesas

Tarefas da [spec 0012](../specs/0012-expenses.md), da issue de entrega [FCF-011](https://github.com/bhenriq-souza/finances-control-frontend/issues/52).

- [ ] **T-0012-01 — Lista e detalhe de despesas** · #67
    - What: `/despesas` com filtros e resumo, `/despesas/$despesaId` só leitura, item **Despesas**
    - Where: `src/features/expenses/list/`, `src/features/expenses/detail/expense-detail.tsx`, `src/routes/_app/despesas*`, `src/app/shell/navigation.ts`, `e2e/expenses-list.spec.ts`, `e2e/fixtures/data/expenses.ts`
    - Done when: `AC-0012-01`, `AC-0012-02` e `AC-0012-12` cobertos; `INV-0012-01` verificado
- [ ] **T-0012-02 — Formulário de despesa** · #68
    - What: criar (variável, parcelada, fixa) e alterar com escopo de série; depende de T-0012-01
    - Where: `src/features/expenses/form/`, `e2e/expenses-form.spec.ts`
    - Done when: `AC-0012-03`, `AC-0012-04` e `AC-0012-05` cobertos; `INV-0012-05` verificado
- [ ] **T-0012-03 — Ações de status, exclusão e forma de pagamento** · #69
    - What: ações do detalhe por status, pagar, excluir com cascata, trocar forma de pagamento, parâmetros `?pagar`, `?excluir`, `?meio`; depende de T-0012-01
    - Where: `src/features/expenses/detail/actions/`, `e2e/expenses-detail.spec.ts`
    - Done when: `AC-0012-06` a `AC-0012-10` cobertos; `INV-0012-02`, `INV-0012-03` e `INV-0012-04` verificados
- [ ] **T-0012-04 — Tipos de despesa** · #70
    - What: `/despesas/tipos` com criar, renomear, arquivar e desarquivar
    - Where: `src/features/expenses/types/`, `src/routes/_app/despesas.tipos.tsx`, `e2e/expense-types.spec.ts`
    - Done when: `AC-0012-11` coberto

## Faturas e estornos

Tarefas da [spec 0013](../specs/0013-statements.md), da issue de entrega [FCF-012](https://github.com/bhenriq-souza/finances-control-frontend/issues/53).

- [ ] **T-0013-01 — Painel e detalhe de faturas** · #71
    - What: fatura atual, anteriores e próximas em `/cartoes/$cartaoId`, e `/cartoes/$cartaoId/faturas/$faturaId`, só leitura
    - Where: `src/features/statements/panel/`, `src/features/statements/detail/`, `src/routes/_app/cartoes.$cartaoId*`, `e2e/statements.spec.ts`, `e2e/fixtures/data/statements.ts`
    - Done when: `AC-0013-01`, `AC-0013-02` e `AC-0013-10` cobertos; `INV-0013-01` e `INV-0013-03` verificados
- [ ] **T-0013-02 — Pagamentos e mínimo** · #72
    - What: pagar (total, mínimo, outro valor; aberta e fechada), desfazer o último, informar mínimo; depende de T-0013-01
    - Where: `src/features/statements/payment/`, `e2e/statement-payments.spec.ts`
    - Done when: `AC-0013-03` a `AC-0013-07` e `AC-0013-09` cobertos; `INV-0013-02` e `INV-0013-04` verificados
- [ ] **T-0013-03 — Estornos** · #73
    - What: novo estorno (com despesa de origem por `?despesa`), alterar descrição e observações, excluir; depende de T-0013-01
    - Where: `src/features/statements/refunds/`, `e2e/refunds.spec.ts`
    - Done when: `AC-0013-08` coberto

## Receitas

Tarefas da [spec 0014](../specs/0014-earnings.md), da issue de entrega [FCF-013](https://github.com/bhenriq-souza/finances-control-frontend/issues/54).

- [ ] **T-0014-01 — Lista e detalhe de receitas** · #74
    - What: `/receitas` com filtros e resumo, `/receitas/$receitaId` só leitura, item **Receitas**
    - Where: `src/features/earnings/list/`, `src/features/earnings/detail/earning-detail.tsx`, `src/routes/_app/receitas*`, `src/app/shell/navigation.ts`, `e2e/earnings-list.spec.ts`, `e2e/fixtures/data/earnings.ts`
    - Done when: `AC-0014-01`, `AC-0014-02` e `AC-0014-09` cobertos; `INV-0014-01` verificado
- [ ] **T-0014-02 — Formulário de receita** · #75
    - What: criar (variável, parcelada, fixa) e alterar com escopo de série e troca de conta; depende de T-0014-01
    - Where: `src/features/earnings/form/`, `e2e/earnings-form.spec.ts`
    - Done when: `AC-0014-03` e `AC-0014-04` cobertos; `INV-0014-04` verificado
- [ ] **T-0014-03 — Ações de status e exclusão** · #76
    - What: receber, verificar, desfazer recebimento, excluir com cascata, `?receber` e `?excluir`; depende de T-0014-01
    - Where: `src/features/earnings/detail/actions/`, `e2e/earnings-detail.spec.ts`
    - Done when: `AC-0014-05`, `AC-0014-06` e `AC-0014-07` cobertos; `INV-0014-02` e `INV-0014-03` verificados
- [ ] **T-0014-04 — Tipos de receita** · #77
    - What: `/receitas/tipos` com criar, renomear, arquivar e desarquivar
    - Where: `src/features/earnings/types/`, `src/routes/_app/receitas.tipos.tsx`, `e2e/earning-types.spec.ts`
    - Done when: `AC-0014-08` coberto

## Dashboard e relatórios

Tarefas da [spec 0015](../specs/0015-dashboard-and-reports.md), da issue de entrega [FCF-014](https://github.com/bhenriq-souza/finances-control-frontend/issues/55).

- [ ] **T-0015-01 — Dashboard de saldo** · #78
    - What: o dashboard em `/` pelos artboards aprovados e a remoção da `HomePage` provisória
    - Where: `src/features/reporting/dashboard/`, `src/routes/_app/index.tsx`, `src/features/identity/pages/home-page.tsx` (remoção), `e2e/dashboard.spec.ts`, `e2e/fixtures/data/reports.ts`
    - Done when: `AC-0015-01` a `AC-0015-05` e `AC-0015-10` cobertos; `INV-0015-01`, `INV-0015-02` e `INV-0015-04` verificados
- [ ] **T-0015-02 — Relatórios** · #79
    - What: `/relatorios` com as abas de saldo, por tipo e fluxo de caixa, `MonthColumns` e o item **Relatórios**
    - Where: `src/features/reporting/reports/`, `src/ui/charts/month-columns.tsx`, `src/routes/_app/relatorios.tsx`, `src/app/shell/navigation.ts`, `e2e/reports.spec.ts`
    - Done when: `AC-0015-06` a `AC-0015-09` cobertos; `INV-0015-03` verificado

## Séries fixas

Tarefas da [spec 0017](../specs/0017-recurrences.md), da issue de entrega [FCF-015](https://github.com/bhenriq-souza/finances-control-frontend/issues/56).

- [ ] **T-0017-01 — Séries de despesas e receitas** · #80
    - What: `/series` com as duas abas, os detalhes com as ocorrências, encerrar série, **Ver série** nos detalhes de despesa e de receita, item **Séries fixas**
    - Where: `src/features/expenses/recurrences/`, `src/features/earnings/recurrences/`, os detalhes de despesa e de receita (link), `src/routes/_app/series*`, `src/app/shell/navigation.ts`, `e2e/recurrences.spec.ts`
    - Done when: `AC-0017-01` a `AC-0017-05` cobertos; `INV-0017-01` a `INV-0017-03` verificados

## Transferências

Tarefas da [spec 0018](../specs/0018-transfers.md), da issue de entrega [FCF-016](https://github.com/bhenriq-souza/finances-control-frontend/issues/57).

- [ ] **T-0018-01 — Transferências** · #81
    - What: `/transferencias` e o detalhe, formulário, concluir, desfazer, excluir, item **Transferências**
    - Where: `src/features/accounts/transfers/`, `src/routes/_app/transferencias*`, `src/app/shell/navigation.ts`, `e2e/transfers.spec.ts`, `e2e/fixtures/data/transfers.ts`
    - Done when: `AC-0018-01` a `AC-0018-07` cobertos; `INV-0018-01` a `INV-0018-03` verificados
