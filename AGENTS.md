# Manual Operacional de Agentes — finances-control-frontend

Este é um repositório **spec-driven**. O comportamento é definido em `specs/`, o trabalho vive em `docs/backlog.md`. **Não improvise além da spec**: se uma tarefa estiver ambígua, a spec é corrigida primeiro (spec 0000), em PR separado.

O produto se chama **FTech Finance** (Finances Control nos repositórios), da FarmTech. Contexto de produto (requisitos, ADRs de arquitetura, roadmap, identidade visual): repositório hub [finances-control](https://github.com/bhenriq-souza/finances-control). A API é a do [finances-control-backend](https://github.com/bhenriq-souza/finances-control-backend), descrita pelo `docs/openapi.yaml` dele.

## Leia antes de trabalhar

1. `specs/0000-spec-process.md` — processo, formato de tarefa, definition of done, convenções normativas.
2. `specs/0001-development-workflow.md` — o fluxo Git que você **deve** seguir.
3. `specs/0002-quality-gates.md` — os portões de qualidade e o orquestrador único.
4. A(s) spec(s) referenciada(s) pela sua tarefa em `docs/backlog.md`.

## Regras de ouro

1. **Uma tarefa = uma branch = um PR.** IDs de tarefa têm a forma `T-0006-01`.
2. **Ritual de branch, sempre:**
    ```bash
    git checkout develop && git pull origin develop
    git checkout -b <tipo>/<task-id>-<slug>     # ex.: feat/t-0006-02-app-shell
    ```
    Dentro de um git worktree (execução paralela), `develop` está em uso no working tree principal: use `git fetch origin && git checkout -b <tipo>/<task-id>-<slug> origin/develop`. O playbook de subagentes em worktrees é o do backend ([`docs/parallel-execution.md`](https://github.com/bhenriq-souza/finances-control-backend/blob/develop/docs/parallel-execution.md)), sem a parte de banco por worktree, que aqui não existe.
3. **Conventional Commits** (`feat|fix|docs|test|refactor|chore|ci`), escopo = módulo, rodapé `Task: T-xxxx-yy`. Nunca use `--no-verify`.
4. **Abra um PR ao final da tarefa** (`gh pr create`, o template se aplica sozinho). Título do PR em formato Conventional Commit. **Nunca faça merge** — o merge é decisão do responsável, após revisão. Nunca faça push direto em `develop`.
5. **Definition of done** (spec 0000): contratos implementados exatamente, testes mapeados passando, todos os gates verdes, checkbox do backlog marcado no mesmo PR, `status` da spec alterado quando for a última tarefa dela.
6. **O contrato OpenAPI é a única fonte dos tipos da API** ([ADR-0001](https://github.com/bhenriq-souza/finances-control/blob/main/docs/adr/ADR-0001-frontend.md)). Os tipos são gerados do `openapi.yaml` do backend, baixado numa tag fixada; nunca escreva à mão um tipo de requisição ou de resposta, e nunca chame a API por fora do cliente gerado.
7. **Dinheiro nunca é ponto flutuante** (INV-0000-04). Valores trafegam e são manipulados como inteiro de centavos ([ADR-0007](https://github.com/bhenriq-souza/finances-control/blob/main/docs/adr/ADR-0007-monetary-representation.md)); só viram texto na apresentação (`R$ 1.234,56`), e o texto digitado só vira centavos pelo parser da plataforma — jamais `number` com fração, `parseFloat` ou `toFixed`.
8. **A interface é só em pt-BR, e erro se traduz pelo `code`** (INV-0000-06). Toda mensagem de erro mostrada ao usuário vem do catálogo indexado pelo `ErrorCode` do contrato; nunca mostre o `message` cru da API nem texto em inglês.
9. **Fronteiras de módulo são normativas.** Uma feature nunca importa outra; `shared` e `ui` nunca importam feature; o SDK do Firebase só é importado pelo módulo `identity`. Verificado pelo gate `boundaries`.
10. **Só tokens semânticos na interface.** Cores, tipografia, espaço e raios vêm do tema gerado do `tokens.json` do hub; nada de cor literal nem de `marca-*` direto em componente. Layout mobile-first, nos breakpoints `md` (768px) e `lg` (1024px).
11. **Nunca invente resultado de teste.** Cole o resumo real do Vitest, do Playwright e da tabela do `npm run check`. Se um gate está vermelho, a tarefa não está pronta.
12. **Nunca afrouxe um gate para passar.** Mudar configuração de gate exige alterar a spec 0002 no seu próprio PR.
13. As skills do repositório automatizam o processo — prefira-as: `/new-spec`, `/implement-task`, `/check`, `/finish-task` (ver `.claude/skills/`).

## Portões de qualidade

Um comando só — o CI executa exatamente o mesmo (INV-0002-03):

```bash
npm run check
```

Ele orquestra: contrato da API e artefatos gerados, formatação, lint, tipos, fronteiras entre módulos, testes com cobertura, auditoria de dependências, validação estrutural das specs, análise de segurança do código (SAST), build com orçamento de bundle e testes end-to-end nos três tamanhos de tela. Detalhes e política de PASS/FAIL/SKIP na spec 0002.

## Mapa do repositório

| Caminho                   | O que é                                                     |
| ------------------------- | ----------------------------------------------------------- |
| `specs/`                  | Specs normativas (contratos, invariantes, ACs)              |
| `specs/adr/`              | Decisões **locais do frontend** (ver abaixo)                |
| `docs/backlog.md`         | Tarefas ordenadas — sua fila de trabalho                    |
| `scripts/check.mjs`       | Orquestrador único dos gates                                |
| `scripts/check-specs.mjs` | Validador estrutural das specs                              |
| `scripts/sast.mjs`        | Gate de SAST (Semgrep CE)                                   |
| `src/`                    | Código da SPA; estrutura definida pela spec 0003 (scaffold) |

### Onde cada decisão é registrada

- **Produto e arquitetura macro** (stack, autenticação, dinheiro, publicação): ADRs no **hub**, em `docs/adr/`. Não duplique aqui — referencie por link.
- **Decisões locais do frontend** (organização interna, troca de uma peça do kit do ADR-0001, escolha de biblioteca pontual): `specs/adr/` deste repositório.
- Em ambos os casos ADRs são **imutáveis** depois de aceitos: para mudar, crie um novo que supersede.

## Módulos

Módulos de domínio, com os nomes dos módulos do backend: `identity` (F001) · `accounts` (F002) · `expenses` (F003) · `statements` (F004) · `earnings` (F005) · `reporting`.

Módulos de plataforma: `app` (bootstrap, providers, roteador, app shell) · `api` (cliente gerado e catálogo de erros) · `ui` (componentes e tema) · `shared` (utilitários sem regra de domínio, como dinheiro e datas).

A estrutura de pastas e as regras exatas de dependência entre eles são definidas pela spec 0003.

## Idioma

Specs, ADRs, backlog e documentação em **português**. Código, identificadores, mensagens de commit, títulos e corpo de PR em **inglês**. A interface do produto é **só em pt-BR**. Não misture dentro de um mesmo artefato.
