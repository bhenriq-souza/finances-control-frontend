---
id: '0002'
title: Portões de qualidade e orquestrador único
status: approved
depends_on: ['0000', '0001']
---

# 0002 — Portões de Qualidade

## Goal

Definir os portões de qualidade do repositório e o **orquestrador único** que os executa, de modo que o mesmo comando rode localmente e no CI, que nenhum gate exista apenas em um dos dois lados, e que a ausência de uma ferramenta seja sempre visível em vez de silenciosamente transformar o pipeline em verde.

## Scope / Non-goals

- **Em escopo:** lista de gates, o orquestrador `scripts/check.mjs`, semântica de PASS/FAIL/SKIP, modo estrito do CI, política de alteração de gates, a análise de segurança do código (o gate `sast` e o CodeQL complementar) e os três gates próprios do frontend: `contract`, `build` e `e2e`.
- **Fora de escopo:** conteúdo dos testes de cada tela (specs 0010+); como o cliente da API e o tema são gerados (specs 0005 e 0004 — aqui só se define o que o gate `contract` verifica); o pipeline de build e publicação de imagem (spec 0007).

## Contracts

### Gates

Executados nesta ordem: `contract` vem primeiro porque gera os tipos da API e a árvore de rotas que `lint`, `types`, `test`, `build` e `e2e` consomem.

| Gate         | Comando                                   | Verifica                                                             |
| ------------ | ----------------------------------------- | -------------------------------------------------------------------- |
| `contract`   | `node scripts/contract.mjs`               | artefatos gerados batem com as fontes fixadas (abaixo)               |
| `format`     | `npx prettier --check .`                  | formatação                                                           |
| `lint`       | `npx eslint .`                            | regras de lint                                                       |
| `types`      | `npx tsc --noEmit`                        | tipagem (TypeScript strict)                                          |
| `boundaries` | `npx depcruise src`                       | fronteiras entre módulos (spec 0003)                                 |
| `test`       | `npx vitest run --coverage`               | testes de unidade e de componente, e cobertura mínima                |
| `audit`      | `npm audit --audit-level=high --omit=dev` | vulnerabilidades em dependências de runtime                          |
| `specs`      | `node scripts/check-specs.mjs`            | estrutura das specs e do backlog (spec 0000)                         |
| `sast`       | `node scripts/sast.mjs`                   | vulnerabilidades no código (Semgrep CE)                              |
| `build`      | `node scripts/build.mjs`                  | build de produção, orçamento de bundle e ausência de código de teste |
| `e2e`        | `npx playwright test`                     | fluxos ponta a ponta nos três tamanhos de tela                       |

Cópias de trabalho de agentes em `.claude/worktrees/` ficam fora dos gates `format` e `lint` (ignoradas pelo Git, pelo Prettier e pelo ESLint): não são código deste working tree, e sim de outras branches.

O gate `boundaries` é o enforcement automatizado das fronteiras entre módulos; as regras (uma feature nunca importa outra, `shared` e `ui` nunca importam feature, o SDK do Firebase só dentro de `identity`) são definidas pela spec 0003, e mudar uma delas exige mudar aquela spec.

**Cobertura mínima** do gate `test`, global: 75% de branches e 90% de funções, linhas e statements — os mesmos limiares do backend. Código gerado (`src/api/generated/`, `src/ui/theme/tokens.css`) e os componentes copiados do shadcn/ui sem alteração ficam fora da medição; a lista exata vive na configuração do Vitest e muda só com esta spec.

### Gate `contract` — artefatos gerados

O frontend não escreve à mão o que vem de outro repositório: os tipos da API vêm do contrato do backend e o tema vem dos tokens do hub. As duas fontes são **fixadas** em `sources.json`, na raiz:

```json
{
    "openapi": {
        "repository": "bhenriq-souza/finances-control-backend",
        "ref": "v1.1.0",
        "path": "docs/openapi.yaml",
        "sha256": "<hash do arquivo nesse ref>"
    },
    "tokens": {
        "repository": "bhenriq-souza/finances-control",
        "ref": "<commit do hub>",
        "path": "docs/design/tokens.json",
        "sha256": "<hash do arquivo nesse ref>"
    }
}
```

- `ref` é uma tag ou um commit; o `sha256` garante que o conteúdo é o esperado mesmo se uma tag for movida.
- Atualizar uma fonte é mudar `ref` e `sha256` juntos, num PR que também regenera o que deriva dela.

`scripts/contract.mjs` faz, nesta ordem, e reporta todas as falhas antes de sair:

1. **Baixa** cada fonte de `https://raw.githubusercontent.com/<repository>/<ref>/<path>` e confere o `sha256`. Hash diferente é FAIL.
2. **Gera os tipos da API** com `openapi-typescript` em `src/api/generated/schema.d.ts`. O arquivo é ignorado pelo Git: ele é refeito por este gate e pelos scripts `predev`/`prebuild` (spec 0005), nunca commitado — o contrato não é vendorizado.
3. **Confere o tema:** regenera o tema a partir dos tokens, em memória, e compara com `src/ui/theme/tokens.css`, que é commitado (spec 0004). Qualquer diferença é FAIL — significa que o CSS foi editado à mão ou que o `ref` mudou sem regenerar. Correção: `npm run theme`.
4. **Confere o catálogo de erros:** as chaves do catálogo pt-BR (spec 0005) são exatamente os valores do enum `ErrorCode` do contrato. Código sem mensagem, ou mensagem de código que não existe, é FAIL, citando os códigos (INV-0000-06).
5. **Gera a árvore de rotas** `src/routeTree.gen.ts` a partir de `src/routes/`, com a configuração de `tsr.config.json` (spec 0003). Não deriva de outro repositório, mas é gerada aqui porque os gates seguintes a consomem e ela não é commitada. Falha do gerador (rota inválida ou duplicada) é FAIL, com a mensagem dele.

- **Rede:** sem rede o gate falha; ele não vira SKIP, como o `sast`.
- **Disponibilidade:** sem `scripts/contract.mjs` ou sem `sources.json`, o gate é SKIP (contexto). Os passos 3 e 4 são SKIP (contexto), dentro do gate, enquanto o tema ou o catálogo ainda não existirem (antes das tarefas das specs 0004 e 0005), com o motivo impresso.

### Gate `build`

`scripts/build.mjs` roda `vite build` (modo produção) e, sobre o resultado em `dist/`:

- **Orçamento de bundle** ([ADR-0001](https://github.com/bhenriq-souza/finances-control/blob/main/docs/adr/ADR-0001-frontend.md), code-splitting por rota):
    - JavaScript inicial (o chunk de entrada e os que ele importa estaticamente): no máximo **250 KB** depois de gzip;
    - qualquer outro chunk de JavaScript: no máximo **100 KB** depois de gzip;
    - CSS total: no máximo **50 KB** depois de gzip.
- **Nada de código de teste em produção:** nenhum arquivo de `dist/` contém o marcador `__E2E_FAKE_AUTH__`, que identifica a implementação falsa de autenticação usada só pelo `e2e` (spec 0006).
- Imprime o tamanho de cada chunk e sai com 1 se algum limite for excedido ou o marcador aparecer.

### Gate `e2e`

- **Ferramenta:** Playwright (`@playwright/test`), só com o Chromium.
- **Alvo:** o build de `vite build --mode e2e`, servido por `vite preview` (o `webServer` da configuração do Playwright). Esse modo troca a autenticação do Firebase pela implementação falsa e nada mais (spec 0006).
- **API:** simulada por `page.route` sobre `/api/**`, com respostas tipadas pelo contrato gerado. O e2e não depende do backend nem do Firebase reais.
- **Três projetos**, nos tamanhos dos artboards aprovados do Design ([identidade visual](https://github.com/bhenriq-souza/finances-control/blob/main/docs/design/visual-identity.md)): `celular` 390×844, `tablet` 834×1112 e `desktop` 1440×900. Todo teste roda nos três, salvo marcação explícita com o motivo.
- **Disponibilidade:** sem `@playwright/test` ou sem a pasta `e2e/`, SKIP (contexto); sem o Chromium do Playwright instalado, SKIP (ambiente), com o comando de instalação no motivo.

### Análise de segurança do código

Decidida pelo responsável em 2026-10-10 (D5 do levantamento da Fase 3), igual à do backend, com as regras de React no lugar das de Express (decisão de 2026-10-12).

- **Gate `sast`:** `scripts/sast.mjs` roda o Semgrep CE em `src/` e `scripts/`.
    - **Regras:** os pacotes `p/javascript`, `p/typescript`, `p/react`, `p/nodejs` e `p/secrets` do registro do Semgrep.
    - **Limiar:** qualquer achado de severidade `ERROR` ou `WARNING` reprova (`--error`). `INFO` não é avaliado.
    - **Versão:** fixada no script (`SEMGREP_VERSION`). O script usa a imagem `semgrep/semgrep:<versão>` pelo Docker, e o `semgrep` instalado na máquina só quando não há Docker.
    - **Métricas:** desligadas (`--metrics=off`).
    - **Rede:** os pacotes são baixados do registro a cada execução. Sem rede o gate falha; ele não vira SKIP.
    - **Disponibilidade:** sem `docker` nem `semgrep` no PATH, o gate é SKIP (ambiente) com o motivo na tabela.
- **Supressão:** só pontual, com `// nosemgrep: <id-da-regra>` na linha e o motivo no comentário, como manda a política de alteração abaixo. Nunca por arquivo ou diretório inteiro.
- **CodeQL, complementar:** `.github/workflows/codeql.yml` roda a análise `security-extended` do CodeQL para `javascript-typescript` em PR e push para `develop` e `main`, e uma vez por semana.
    - **Não é um gate:** não roda no `npm run check`, não reimplementa o `sast` e não entra no `ci.yml` (INV-0002-03).
    - **Resultado:** os alertas aparecem na aba _Security_ do repositório. Tornar o check do CodeQL obrigatório no merge é decisão do responsável, fora desta spec.

### Orquestrador único

`scripts/check.mjs`, exposto como `npm run check`, é a **única** forma de executar o conjunto. Ele:

1. Executa todos os gates **sequencialmente e até o fim** — não para no primeiro erro, para que uma rodada revele todas as falhas.
2. Classifica cada gate como:
    - **PASS** — executou e passou;
    - **FAIL** — executou e falhou;
    - **SKIP (contexto)** — a ferramenta ainda não existe no repositório nesta fase (ex.: antes do scaffold);
    - **SKIP (ambiente)** — a ferramenta é opcional e não está instalada no ambiente atual.
3. Imprime uma tabela final com o estado de cada gate e o motivo de cada SKIP.
4. Sai com código diferente de zero se houver qualquer FAIL.
5. Com `--require-tools`, converte **todo SKIP em FAIL**. O CI sempre usa esta flag a partir da conclusão do scaffold (T-0003-01).

O modo estrito existe porque um ambiente sem as ferramentas instaladas produziria um pipeline verde com metade dos gates ausentes, e ninguém perceberia.

### Política de alteração

- Nunca afrouxar a configuração de um gate para fazer uma tarefa passar.
- Supressões pontuais são explícitas, justificadas em comentário no próprio ponto e, quando protegem um comportamento, fixadas por teste.
- Alterar a lista de gates, seus comandos ou seus limiares (cobertura, orçamento de bundle, viewports, pacotes de regras) exige alterar **esta spec** no PR que faz a alteração.

## Invariants

- **INV-0002-01:** todo gate da tabela é executado por `npm run check`.
- **INV-0002-02:** um gate ausente aparece como SKIP com motivo, nunca como PASS.
- **INV-0002-03:** o CI invoca o orquestrador e não reimplementa nenhum gate.
- **INV-0002-04:** `npm run check` sai com código diferente de zero se qualquer gate falhar.
- **INV-0002-05:** no CI, nenhum gate é pulado (`--require-tools` ativo) a partir do scaffold.
- **INV-0002-06:** o gate `sast` reprova qualquer achado `ERROR` ou `WARNING` dos pacotes de regras desta spec; uma supressão é sempre pontual, com a regra e o motivo na própria linha.
- **INV-0002-07:** nenhum artefato derivado de outro repositório é escrito à mão: os tipos da API e o tema batem com as fontes fixadas em `sources.json`, e o catálogo de erros cobre exatamente o `ErrorCode` do contrato.
- **INV-0002-08:** o bundle de produção respeita o orçamento e não contém código usado só pelo `e2e`.

## Error cases

| Código      | Situação                                    | Comportamento exigido                                                                |
| ----------- | ------------------------------------------- | ------------------------------------------------------------------------------------ |
| ERR-0002-01 | Ferramenta não instalada, modo normal       | SKIP (ambiente ou contexto), com motivo na tabela; código de saída não é afetado     |
| ERR-0002-02 | Ferramenta não instalada, `--require-tools` | FAIL, com mensagem indicando qual ferramenta falta                                   |
| ERR-0002-03 | Gate falha                                  | registrar a falha, seguir para os demais, reportar tudo ao final e sair com código 1 |
| ERR-0002-04 | Script de gate inexistente                  | tratado como SKIP (contexto), citando o caminho esperado                             |
| ERR-0002-05 | Sem `docker` nem `semgrep` no PATH          | `sast` é SKIP (ambiente), citando as duas ferramentas; no CI, FAIL                   |
| ERR-0002-06 | Registro do Semgrep ou GitHub fora do ar    | `sast` ou `contract` é FAIL, nunca SKIP nem PASS                                     |
| ERR-0002-07 | `sha256` de uma fonte diverge do baixado    | `contract` é FAIL, citando a fonte, o `ref` e os dois hashes                         |
| ERR-0002-08 | `tokens.css` difere do tema regenerado      | `contract` é FAIL, mandando rodar `npm run theme`                                    |
| ERR-0002-09 | Catálogo de erros e `ErrorCode` divergem    | `contract` é FAIL, listando os códigos sem mensagem e as mensagens sem código        |
| ERR-0002-10 | Chunk acima do orçamento ou marcador de e2e | `build` é FAIL, com a tabela de tamanhos e o arquivo ofensor                         |
| ERR-0002-11 | Chromium do Playwright não instalado        | `e2e` é SKIP (ambiente), citando `npx playwright install chromium`; no CI, FAIL      |

## Acceptance criteria

- **AC-0002-01:** `npm run check` executa todos os gates disponíveis e imprime tabela final com estado e motivo.
- **AC-0002-02:** `npm run check` sai com código 1 quando ao menos um gate falha, e 0 quando não há falha.
- **AC-0002-03:** `npm run check -- --require-tools` sai com código 1 se qualquer gate for pulado.
- **AC-0002-04:** `.github/workflows/ci.yml` executa o orquestrador e nenhum outro comando de verificação; a partir do scaffold, com `--require-tools`.
- **AC-0002-05:** o gate `sast` é PASS no código atual e FAIL com um achado: um componente que passa `location.search` a `dangerouslySetInnerHTML` e faz `eval` de um parâmetro, posto em `src/` só para a prova, sai com código 1 e cita as regras.
- **AC-0002-06:** `.github/workflows/codeql.yml` analisa `javascript-typescript` com `security-extended` em PR e push para `develop` e `main` e semanalmente, e o run no próprio PR que o cria termina com a análise publicada.
- **AC-0002-07:** o gate `contract` é PASS no código atual e FAIL, com o diagnóstico de ERR-0002-07, ERR-0002-08 e ERR-0002-09, em três provas: um `sha256` alterado em `sources.json`, uma cor editada à mão em `tokens.css` e uma chave removida do catálogo.
- **AC-0002-08:** o gate `build` é FAIL com um limite de orçamento rebaixado abaixo do tamanho atual e com o marcador `__E2E_FAKE_AUTH__` importado no build de produção, e PASS no código atual.
- **AC-0002-09:** o gate `e2e` roda cada teste nos projetos `celular`, `tablet` e `desktop` e o relatório lista os três.

## Test mapping

| Item                                                          | Teste                                                                                     |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| AC-0002-01, AC-0002-02, INV-0002-01, INV-0002-02, INV-0002-04 | execução manual documentada no PR do seed; testes de unidade do orquestrador em T-0002-01 |
| AC-0002-03, INV-0002-05                                       | execução do modo estrito no CI                                                            |
| AC-0002-04, INV-0002-03                                       | inspeção de `.github/workflows/ci.yml` em revisão de PR                                   |
| AC-0002-05, INV-0002-06                                       | `scripts/check.test.mjs` (gate no orquestrador) e prova manual no PR (achado)             |
| AC-0002-06                                                    | inspeção do workflow em revisão e o run do CodeQL no PR                                   |
| AC-0002-07, INV-0002-07                                       | testes de `scripts/contract.mjs` e prova manual no PR das tarefas das specs 0004 e 0005   |
| AC-0002-08, INV-0002-08                                       | testes de `scripts/build.mjs` e prova manual no PR do scaffold                            |
| AC-0002-09                                                    | relatório do Playwright colado no PR do scaffold                                          |

## Open questions

Nenhuma.
