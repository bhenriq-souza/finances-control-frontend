---
id: '0003'
title: Scaffold, estrutura de pastas e configuração de runtime
status: draft
depends_on: ['0000', '0001', '0002']
---

# 0003 — Scaffold, Estrutura de Pastas e Configuração de Runtime

## Goal

Pôr de pé a SPA do [ADR-0001](https://github.com/bhenriq-souza/finances-control/blob/main/docs/adr/ADR-0001-frontend.md) com todos os gates da spec 0002 executando de fato: o kit de bibliotecas fixado, a estrutura de pastas por módulo com as fronteiras verificadas pelo gate `boundaries`, a configuração lida em runtime de `/config.js`, e uma página mínima de login que permita o spike do login Google na origem HTTP de `dev` (spec 0006) assim que a publicação (spec 0007) existir.

## Scope / Non-goals

- **Em escopo:** dependências e versões-base; `package.json` e scripts; TypeScript strict; Vite; TanStack Router (rotas por arquivo) e TanStack Query; Tailwind e a inicialização do shadcn/ui; Vitest, Testing Library e Playwright; ESLint e Prettier para TS/TSX; estrutura de pastas e regras do `dependency-cruiser`; configuração de runtime (`/config.js`); `scripts/build.mjs` (gate `build`); `--require-tools` e Chromium no CI; a página do spike.
- **Fora de escopo:** o tema (spec 0004 — até lá, o shadcn/ui fica com o tema neutro dele); o cliente da API gerado e o catálogo de erros (spec 0005 — a página do spike usa `fetch` direto, único lugar autorizado, e é removida pela spec 0006); autenticação definitiva e app shell (spec 0006); imagem, nginx e manifests (spec 0007); dinheiro (spec 0008); qualquer tela de F001–F005.

## Contracts

### Kit e versões-base

| Peça               | Pacote(s)                                                                              |
| ------------------ | -------------------------------------------------------------------------------------- |
| UI                 | `react@19`, `react-dom@19`                                                             |
| Build              | `vite@7`, `@vitejs/plugin-react`                                                       |
| Tipos              | `typescript@~5.8`, `strict: true`, `noUncheckedIndexedAccess: true`                    |
| Rotas              | `@tanstack/react-router`, `@tanstack/router-plugin` (rotas por arquivo)                |
| Estado de servidor | `@tanstack/react-query`                                                                |
| Formulários        | `react-hook-form`, `zod@4`, `@hookform/resolvers`                                      |
| Estilo             | `tailwindcss@4`, `@tailwindcss/vite`, shadcn/ui (CLI, componentes copiados)            |
| Ícones             | `lucide-react`                                                                         |
| Auth               | `firebase` (só o módulo `firebase/auth`)                                               |
| Testes             | `vitest`, `@vitest/coverage-v8`, `@testing-library/react`, `jsdom`                     |
| E2E                | `@playwright/test` (Chromium)                                                          |
| Fronteiras         | `dependency-cruiser`                                                                   |
| Lint               | `eslint@9`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-config-prettier` |

As versões exatas ficam no `package-lock.json`. Trocar uma peça do kit exige ADR local em `specs/adr/` (ADR-0001, _Consequences_).

### Scripts do `package.json`

| Script    | Comando                  |
| --------- | ------------------------ |
| `dev`     | `vite` (porta 5173)      |
| `build`   | `vite build`             |
| `preview` | `vite preview`           |
| `check`   | `node scripts/check.mjs` |
| `test`    | `vitest`                 |
| `e2e`     | `playwright test`        |
| `format`  | `prettier --write .`     |

Os scripts `predev`/`prebuild` que geram os tipos da API e `theme` entram pelas specs 0005 e 0004.

### Estrutura de pastas

```
src/
  main.tsx                ponto de entrada: lê a configuração, monta os providers e o roteador
  app/                    providers (QueryClient, roteador), app shell, telas de erro fatal
  routes/                 rotas do TanStack Router por arquivo — finas, só compõem features
  routeTree.gen.ts        gerado pelo plugin do roteador, commitado
  features/
    identity/             autenticação e usuário (F001); único lugar que importa `firebase`
    accounts/ expenses/ statements/ earnings/ reporting/   vazios até as specs 0011+
  api/                    cliente gerado e catálogo de erros (spec 0005)
  ui/                     componentes (shadcn/ui copiados e os do Design System) e tema (spec 0004)
  shared/                 utilitários sem regra de domínio: config, money (spec 0008), datas
e2e/                      testes do Playwright e fixtures da API
public/                   estáticos copiados para a raiz do build
scripts/                  gates e geradores
```

Cada pasta de `features/` expõe só o seu `index.ts`; o resto é interno.

### Fronteiras (`.dependency-cruiser.cjs`)

| Regra                       | Proíbe                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| `no-cross-feature`          | `src/features/<a>/**` importar `src/features/<b>/**`, para `a ≠ b`                          |
| `feature-public-api`        | importar de `src/features/<a>/` algo que não seja `src/features/<a>/index.ts`, de fora dela |
| `shared-is-a-leaf`          | `src/shared/**` importar qualquer outra pasta de `src/`                                     |
| `ui-only-shared`            | `src/ui/**` importar algo de `src/` fora de `ui/` e `shared/`                               |
| `api-only-shared`           | `src/api/**` importar algo de `src/` fora de `api/` e `shared/`                             |
| `routes-are-thin`           | `src/routes/**` importar `src/api/**` direto                                                |
| `nobody-imports-app`        | qualquer pasta, exceto `main.tsx`, `routes/` e o próprio `app/`, importar `src/app/**`      |
| `firebase-only-in-identity` | importar `firebase` ou `firebase/*` fora de `src/features/identity/**`                      |
| `no-circular`               | ciclos de importação                                                                        |
| `not-to-test-from-src`      | código de `src/` importar arquivo de teste ou de `e2e/`                                     |

Permitido, por exclusão: `features` → `api`, `ui`, `shared`; `routes` → `app`, `features`, `ui`, `shared`; `app` → tudo; `main.tsx` → `app`, `shared`.

### Configuração de runtime

A mesma imagem serve `dev` e `prd` (ADR-0001): nada de ambiente entra no bundle. O `index.html` carrega `/config.js` com um `<script>` clássico **antes** do módulo da aplicação. O arquivo define:

```js
window.__FTECH_CONFIG__ = {
    environment: 'dev', // 'local' | 'dev' | 'prd'
    firebase: {
        apiKey: '…',
        authDomain: 'dev-financial-control.firebaseapp.com',
        projectId: 'dev-financial-control',
        appId: '1:805955182517:web:652d21a187283fa505c3fc',
    },
};
```

- `src/shared/config/` valida o objeto com zod e expõe `getRuntimeConfig(): RuntimeConfig`, tipado. Nenhum outro código lê `window.__FTECH_CONFIG__`.
- `public/config.example.js` é commitado com os valores de `dev` (a web config do Firebase não é segredo); `public/config.js` é ignorado pelo Git e copiado do exemplo para rodar localmente. O build não contém `config.js`: em `dev` e `prd` ele vem do ConfigMap (spec 0007).

### Porta de autenticação

O SDK do Firebase fica atrás de uma porta, para que o `e2e` rode sem o Firebase real (spec 0002, gate `e2e`). Em `src/features/identity/auth-client/`:

```ts
interface AuthUser {
    uid: string;
    email: string | null;
    emailVerified: boolean;
}

interface AuthClient {
    onAuthStateChanged(listener: (user: AuthUser | null) => void): () => void;
    signInWithEmail(email: string, password: string): Promise<void>;
    signInWithGoogle(): Promise<void>;
    signOut(): Promise<void>;
    getIdToken(forceRefresh?: boolean): Promise<string | null>;
}
```

- `firebase-auth-client.ts` implementa a porta com `firebase/auth`, inicializado com `getRuntimeConfig().firebase`.
- `fake-auth-client.ts` implementa a porta em memória, com usuários fixos que o e2e escolhe; o arquivo contém a string `__E2E_FAKE_AUTH__`.
- `index.ts` escolhe a implementação por `import.meta.env.MODE === 'e2e'`. Como a condição é constante no build, o Vite elimina o ramo falso: o build de produção não contém a implementação falsa, e o gate `build` confere (INV-0002-08).
- A spec 0006 amplia a porta (cadastro, verificação de email, redefinição de senha); os nomes acima não mudam.

### Página do spike

Rota `/`, temporária, em `src/features/identity/spike/`, sem tema nem shell:

- formulário de email e senha (`signInWithEmail`) e botão **Entrar com Google** (`signInWithGoogle`, que na implementação do Firebase é `signInWithPopup` com `GoogleAuthProvider`), sempre pela porta acima;
- depois de autenticado, mostra o email, o `emailVerified` do Firebase e o resultado de `GET /api/users/me` com `Authorization: Bearer <ID token>` — status HTTP e corpo JSON, crus;
- botão **Sair**; mostra cru qualquer erro do Firebase (`code` e mensagem), porque o objetivo é diagnóstico.

É a única exceção às regras 6 e 8 do `AGENTS.md` (cliente gerado e pt-BR por catálogo) e é removida pela T-0006-02.

### Gate `build`

`scripts/build.mjs` implementa o contrato do gate `build` da spec 0002: roda `vite build`, mede o gzip de cada arquivo `.js` e `.css` de `dist/assets/`, identifica o JavaScript inicial pelo `.vite/manifest.json` (entrada e os seus `imports` estáticos), aplica o orçamento e procura o marcador `__E2E_FAKE_AUTH__`.

### Playwright

`playwright.config.ts` com os projetos `celular`, `tablet` e `desktop` da spec 0002 e o `webServer` `vite build --mode e2e && vite preview --port 4173`. Um teste de fumaça (`e2e/smoke.spec.ts`) abre `/` com `config.js` e `/api/**` interceptados por `page.route` e confere que a página do spike renderiza.

### CI

O `ci.yml` passa a ter, antes do orquestrador, `npx playwright install --with-deps chromium`, e o orquestrador roda com `--require-tools`.

## Invariants

- **INV-0003-01:** só `src/features/identity/**` importa o SDK do Firebase, e o resto do código autentica pela porta `AuthClient`.
- **INV-0003-02:** uma feature nunca importa outra, e de fora dela só se importa o seu `index.ts`.
- **INV-0003-03:** nenhum valor de ambiente entra no bundle; a configuração vem só de `/config.js`, validada por `src/shared/config/`.
- **INV-0003-04:** a partir desta spec, nenhum gate aparece como SKIP no CI.

## Error cases

| Código      | Situação                                    | Comportamento exigido                                                                                          |
| ----------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| ERR-0003-01 | `/config.js` ausente (404) ou sem o objeto  | tela de erro fatal em pt-BR: "Configuração da aplicação ausente. Avise o administrador." — nada mais é montado |
| ERR-0003-02 | `__FTECH_CONFIG__` falha na validação zod   | a mesma tela, com "Configuração da aplicação inválida." e os campos inválidos listados no console              |
| ERR-0003-03 | Importação que viola uma regra de fronteira | gate `boundaries` FAIL, citando a regra e o par de arquivos                                                    |

## Acceptance criteria

- **AC-0003-01:** `npm ci && npm run check -- --require-tools` sai com 0 e nenhum gate em SKIP, com Docker e o Chromium do Playwright disponíveis.
- **AC-0003-02:** `npm run dev`, com `public/config.js` copiado do exemplo, serve a página do spike em `http://localhost:5173/`.
- **AC-0003-03:** um arquivo de prova em `src/features/accounts/` que importa `src/features/identity/spike/` e outro em `src/shared/` que importa `firebase/auth` fazem o gate `boundaries` falhar, citando `no-cross-feature`, `feature-public-api` e `firebase-only-in-identity`.
- **AC-0003-04:** sem `/config.js`, a aplicação mostra a tela de ERR-0003-01; com um `config.js` sem `firebase.apiKey`, a de ERR-0003-02.
- **AC-0003-05:** a página do spike, com o Firebase e `/api/users/me` simulados, mostra o status e o corpo da resposta depois do login por email e senha, nos três projetos do Playwright.
- **AC-0003-06:** o `ci.yml` instala o Chromium e roda `npm run check -- --require-tools`, e o run do PR desta tarefa fica verde.
- **AC-0003-07:** o gate `build` prova a AC-0002-08: FAIL com o orçamento rebaixado e com o marcador no build de produção, PASS no código da tarefa.

## Test mapping

| Item                                 | Teste                                                               |
| ------------------------------------ | ------------------------------------------------------------------- |
| AC-0003-01, INV-0003-04              | execução local e do CI coladas no PR                                |
| AC-0003-02                           | execução manual no PR                                               |
| AC-0003-03, INV-0003-01, INV-0003-02 | prova manual no PR (arquivos de prova não commitados)               |
| AC-0003-04, INV-0003-03              | `src/shared/config/config.test.ts` e `src/app/fatal-error.test.tsx` |
| AC-0003-05                           | `e2e/smoke.spec.ts` (com a implementação falsa da porta)            |
| AC-0003-06                           | inspeção do `ci.yml` e run do CI no PR                              |
| AC-0003-07                           | `scripts/build.test.mjs` e prova manual no PR                       |

## Open questions

Nenhuma.
