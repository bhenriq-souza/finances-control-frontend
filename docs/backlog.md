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

- [ ] **T-0004-01 — Gerador do tema e sincronia no gate `contract`** · #13
    - What: entrada `tokens` em `sources.json`, `scripts/theme.mjs`, `npm run theme`, `tokens.css` gerado e o passo 3 de `scripts/contract.mjs`, sobre o esqueleto da T-0003-01
    - Where: `sources.json`, `scripts/theme.mjs`, `scripts/contract.mjs`, `src/ui/theme/tokens.css`, `src/index.css`
    - Done when: `AC-0004-01` e `AC-0004-02` cobertos; `INV-0004-01` verificado
- [ ] **T-0004-02 — Fontes, escolha de tema, contraste e lint de cor** · #14
    - What: `@fontsource`, `ThemeProvider` com o script anti-piscada, teste dos 60 pares de contraste e a regra de lint contra cor literal
    - Where: `src/ui/theme/`, `index.html`, `eslint.config.js`
    - Done when: `AC-0004-03`, `AC-0004-04` e `AC-0004-05` cobertos; `INV-0004-02` a `INV-0004-04` verificados

## Cliente da API

Tarefas da [spec 0005](../specs/0005-api-client.md), da issue de entrega [FCF-004](https://github.com/bhenriq-souza/finances-control-frontend/issues/4). Contrato fixado na tag `v1.1.0` do backend.

- [x] **T-0005-01 — Tipos gerados, catálogo pt-BR e o gate `contract`** · #15
    - What: `scripts/api-generate.mjs` com `predev`/`prebuild`, os passos 2 e 4 de `scripts/contract.mjs`, sobre o esqueleto da T-0003-01 (que já traz a entrada `openapi` e o passo 1), e o catálogo com os 55 códigos
    - Where: `sources.json`, `scripts/`, `src/api/errors/catalog.ts`
    - Done when: `AC-0005-01` e `AC-0005-05` cobertos; `INV-0005-01` e `INV-0005-04` verificados
- [ ] **T-0005-02 — Cliente, token, `ApiError` e `QueryClient`** · #16
    - What: `api` com `openapi-fetch`, `setTokenProvider` e a repetição de `TOKEN_EXPIRED`, `ApiError` e `unwrap`, proxy de `/api` no `vite dev`, retry e efeitos globais por `code`
    - Where: `src/api/`, `src/app/query-client.ts`, `vite.config.ts`
    - Done when: `AC-0005-02`, `AC-0005-03`, `AC-0005-04`, `AC-0005-06` e `AC-0005-07` cobertos; `INV-0005-02`, `INV-0005-03` e `INV-0005-05` verificados

## Autenticação e app shell

Tarefas da [spec 0006](../specs/0006-auth-and-shell.md), da issue de entrega [FCF-005](https://github.com/bhenriq-souza/finances-control-frontend/issues/5).

- [ ] **T-0006-01 — Spike: login Google numa origem HTTP fora de `localhost`** · #17
    - What: primeira tarefa depois das specs de fundação; roteiro da spec no desktop e no celular, contra a página do spike publicada em `http://finances.dev.homelab.local/`; sucesso = login Google concluído e `GET /api/users/me` com `200` pelo token obtido; plano B = TLS no ingress de `dev` com CA local
    - Where: evidência no PR; só `docs/backlog.md` e, se falhar, a revisão da spec 0006
    - Done when: `AC-0006-01` — resultado registrado; depende de T-0003-02 e T-0007-04
- [ ] **T-0006-02 — Rotas de autenticação, estados da conta e guarda** · #18
    - What: porta `AuthClient` completa, `/entrar`, `/criar-conta`, `/redefinir-senha`, `/verificar-email`, `/aguardando-aprovacao`, layout `_app` com a guarda por `GET /users/me`, `setTokenProvider` e a remoção da página do spike
    - Where: `src/features/identity/`, `src/routes/`, `src/app/`, `e2e/`
    - Done when: `AC-0006-02` a `AC-0006-05`, `AC-0006-09` e `AC-0006-10` cobertos; `INV-0006-01`, `INV-0006-02`, `INV-0006-05` e `INV-0006-06` verificados
- [ ] **T-0006-03 — App shell responsivo** · #19
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
- [ ] **T-0008-02 — `Money`, `MoneyInput` e `moneySchema`** · #25
    - What: componente de exibição com sinal e tom, campo de entrada que entrega centavos e o schema zod com as mensagens pt-BR
    - Where: `src/ui/money.tsx`, `src/ui/money-input.tsx`, `src/shared/money/schema.ts`
    - Done when: `AC-0008-05` coberto; `INV-0008-03` verificado
