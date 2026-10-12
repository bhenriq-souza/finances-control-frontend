---
id: '0005'
title: Cliente da API gerado do contrato e erros por code
status: draft
depends_on: ['0002', '0003']
---

# 0005 — Cliente da API Gerado do Contrato e Erros por `code`

## Goal

Dar ao frontend um único caminho até a API: tipos gerados do `openapi.yaml` do backend numa tag fixada, um cliente `openapi-fetch` com URL relativa `/api` e o ID token em toda chamada, a integração com o TanStack Query, e a tradução de toda falha para pt-BR a partir do `code` da resposta, com os desvios de navegação para os estados de conta que o backend sinaliza por erro.

## Scope / Non-goals

- **Em escopo:** a fonte `openapi` de `sources.json`; os passos 1, 2 e 4 do gate `contract`; geração dos tipos (`api:generate`, `predev`, `prebuild`); o cliente; o middleware de autenticação; o formato de erro `ApiError`; o catálogo pt-BR por `ErrorCode`; a política de retry e o tratamento global no `QueryClient`; os desvios por `UNAUTHENTICATED`, `TOKEN_EXPIRED`, `PROFILE_PENDING` e `EMAIL_NOT_VERIFIED`.
- **Fora de escopo:** as telas de destino dos desvios (login, aguardando aprovação, verificar email — spec 0006); hooks de consulta de cada recurso, que nascem com as telas (specs 0010+); o comportamento da API, normado pelas specs do backend.
- **Depende do backend:** [spec 0005](https://github.com/bhenriq-souza/finances-control-backend/blob/develop/specs/0005-http-platform.md) (erros em JSON, enum `ErrorCode`, `401`/`403` declarados, `servers` em `/api`) e [spec 0010](https://github.com/bhenriq-souza/finances-control-backend/blob/develop/specs/0010-identity.md) (`PROFILE_PENDING`, `EMAIL_NOT_VERIFIED`, `TOKEN_EXPIRED`), na tag `v1.1.0`.

## Contracts

### Fonte e geração

- `sources.json`, entrada `openapi`: `bhenriq-souza/finances-control-backend`, `ref` `v1.1.0`, `path` `docs/openapi.yaml`, `sha256` `6ee247a6256782adb865f51cf4586c852f35ab296d6cf74a1ea400fb03895d8b`.
- `scripts/api-generate.mjs` baixa a fonte, confere o `sha256` e roda `openapi-typescript` para `src/api/generated/schema.d.ts` (ignorado pelo Git). Scripts: `api:generate`, e `predev` e `prebuild` chamando-o. O gate `contract` usa a mesma função (passos 1 e 2 da spec 0002).
- O gate `contract` também extrai o enum `ErrorCode` do contrato e compara com as chaves do catálogo (passo 4).
- Atualizar o contrato: novo `ref` (tag do backend) e `sha256` em `sources.json`, no PR que adapta o código e o catálogo.

### Cliente

`src/api/client.ts`:

```ts
import createClient from 'openapi-fetch';
import type { paths } from './generated/schema';

export const api = createClient<paths>({ baseUrl: '/api' });
```

- `baseUrl` relativa: mesma origem em todo ambiente (ADR-0001, ADR-0008). Em `npm run dev`, o Vite faz proxy de `/api` para `http://localhost:3000` com o prefixo retirado, como o `stripPrefix` do ingress.
- Nenhum código fora de `src/api/` chama `fetch` para a API (a página do spike da spec 0003 é a exceção, removida pela spec 0006).

### Autenticação nas chamadas

`src/api/auth.ts` exporta `setTokenProvider(provider: (forceRefresh: boolean) => Promise<string | null>)`. O `app` registra o provider na inicialização, com o `getIdToken` da porta `AuthClient` (spec 0003) — o módulo `api` não importa `identity` (spec 0003, `api-only-shared`).

O middleware do cliente:

1. pede o token (`forceRefresh = false`) e, havendo, envia `Authorization: Bearer <token>`;
2. se a resposta for `401` com `code` `TOKEN_EXPIRED`, pede o token com `forceRefresh = true` e repete a requisição **uma** vez;
3. qualquer outra resposta segue adiante.

### Formato de erro

O backend responde todo erro como `{ "error": { "code": ErrorCode, "message": string, "details"?: unknown } }` (schema `Error` do contrato). O cliente converte toda resposta não-2xx, e toda falha de rede, em:

```ts
class ApiError extends Error {
    readonly status: number; // 0 para falha de rede
    readonly code: ErrorCode | 'NETWORK_ERROR' | 'UNEXPECTED_RESPONSE';
    readonly details?: unknown; // ex.: ValidationIssue[] de VALIDATION_FAILED
    readonly userMessage: string; // do catálogo, em pt-BR
}
```

- `ErrorCode` é o tipo gerado do contrato.
- Corpo fora do schema (HTML de um proxy, JSON sem `error.code`) vira `UNEXPECTED_RESPONSE`; o `message` do backend nunca chega à interface.
- `unwrap(result)` devolve `data` ou lança o `ApiError` — é o que os `queryFn` e `mutationFn` usam.

### Catálogo pt-BR

`src/api/errors/catalog.ts`:

```ts
export const ERROR_MESSAGES: Record<ErrorCode, string> = { … };
export const CLIENT_ERROR_MESSAGES = {
    NETWORK_ERROR: 'Sem conexão com o servidor. Verifique a rede e tente de novo.',
    UNEXPECTED_RESPONSE: 'O servidor respondeu de um jeito inesperado. Tente de novo em instantes.',
};
```

- Uma entrada para cada um dos 55 valores do `ErrorCode` da tag fixada — o `Record` faz o `types` reprovar código faltando, e o `contract` reprova sobra (INV-0000-06).
- Mensagens no tom da interface: frase curta, o que aconteceu e o que fazer, sem jargão de HTTP nem o nome do código.
- Erros de validação (`VALIDATION_FAILED`) trazem `details` com `path`: os formulários mapeiam cada `path` para o campo; o catálogo dá só a mensagem geral.

### TanStack Query

`src/app/query-client.ts` cria o `QueryClient` com:

- **retry:** nenhuma repetição para `ApiError` com `status` entre 400 e 499; até 2 para `NETWORK_ERROR`, `503` e `5xx`, com espera exponencial;
- **tratamento global** (`QueryCache.onError` e `MutationCache.onError`), pelo `code`:

| `code`                                | Efeito                                                                                 |
| ------------------------------------- | -------------------------------------------------------------------------------------- |
| `UNAUTHENTICATED`                     | sai da sessão (`AuthClient.signOut`) e navega para o login, guardando a rota de origem |
| `TOKEN_EXPIRED` (depois da repetição) | o mesmo de `UNAUTHENTICATED`                                                           |
| `PROFILE_PENDING`                     | navega para a tela de aguardando aprovação                                             |
| `EMAIL_NOT_VERIFIED`                  | navega para a tela de verificar email                                                  |
| `AUTH_UNAVAILABLE`                    | aviso não bloqueante com a mensagem do catálogo; a consulta fica em erro               |
| outros                                | nada global: a tela mostra `userMessage` no lugar da consulta ou no formulário         |

As rotas de destino são as da spec 0006. O `api` não navega: ele lança; quem navega é o `app`.

## Invariants

- **INV-0005-01:** todo tipo de requisição e de resposta vem de `src/api/generated/schema.d.ts`; nenhum é declarado à mão.
- **INV-0005-02:** toda chamada à API passa por `api` (`src/api/client.ts`) com `baseUrl` `/api`.
- **INV-0005-03:** a mensagem mostrada ao usuário vem sempre do catálogo, pelo `code` (INV-0000-06); o `message` do backend nunca é exibido.
- **INV-0005-04:** o catálogo tem exatamente os códigos do `ErrorCode` da fonte fixada.
- **INV-0005-05:** uma resposta `TOKEN_EXPIRED` é repetida no máximo uma vez, com token renovado.

## Error cases

| Código      | Situação                                  | Comportamento exigido                                        |
| ----------- | ----------------------------------------- | ------------------------------------------------------------ |
| ERR-0005-01 | Rede fora, DNS ou servidor inalcançável   | `ApiError` `NETWORK_ERROR`, `status` 0, até 2 repetições     |
| ERR-0005-02 | Corpo de erro fora do schema `Error`      | `ApiError` `UNEXPECTED_RESPONSE`, com o `status` HTTP        |
| ERR-0005-03 | `401 TOKEN_EXPIRED` duas vezes seguidas   | trata como `UNAUTHENTICATED`: sai da sessão e vai ao login   |
| ERR-0005-04 | `403 PROFILE_PENDING` em qualquer rota    | navega para aguardando aprovação                             |
| ERR-0005-05 | `403 EMAIL_NOT_VERIFIED` em qualquer rota | navega para verificar email                                  |
| ERR-0005-06 | `ErrorCode` novo no contrato sem mensagem | `types` e `contract` FAIL ao atualizar a fonte (ERR-0002-09) |

## Acceptance criteria

- **AC-0005-01:** `npm run api:generate` gera `schema.d.ts` da tag `v1.1.0`, e `paths['/users/me']['get']` tipa a resposta `200` com `data: UserResponse`.
- **AC-0005-02:** o middleware envia `Authorization: Bearer <token>` quando o provider devolve token, e nenhum header quando devolve `null`.
- **AC-0005-03:** uma resposta `401 TOKEN_EXPIRED` dispara exatamente uma repetição com `forceRefresh = true`; a segunda `401` vira `ApiError` sem nova repetição.
- **AC-0005-04:** respostas com cada um dos casos ERR-0005-01 e ERR-0005-02 viram o `ApiError` descrito, com `userMessage` do catálogo de cliente.
- **AC-0005-05:** o catálogo cobre os 55 códigos da `v1.1.0`, e o gate `contract` falha com uma chave removida e com uma chave inventada (prova da AC-0002-07 para o catálogo).
- **AC-0005-06:** o `QueryClient` não repete `4xx`, repete `503` até 2 vezes, e aplica os efeitos globais da tabela para `UNAUTHENTICATED`, `PROFILE_PENDING` e `EMAIL_NOT_VERIFIED`.
- **AC-0005-07:** um componente que mostra um `ApiError` de `VALIDATION_FAILED` exibe a mensagem do catálogo, e não o `message` do corpo.

## Test mapping

| Item                                | Teste                                            |
| ----------------------------------- | ------------------------------------------------ |
| AC-0005-01, INV-0005-01             | `scripts/api-generate.test.mjs` e o gate `types` |
| AC-0005-02, AC-0005-03, INV-0005-05 | `src/api/client.test.ts` (fetch simulado)        |
| AC-0005-04, INV-0005-02             | `src/api/errors/api-error.test.ts`               |
| AC-0005-05, INV-0005-04             | `scripts/contract.test.mjs` e prova manual no PR |
| AC-0005-06                          | `src/app/query-client.test.ts`                   |
| AC-0005-07, INV-0005-03             | `src/api/errors/error-message.test.tsx`          |

## Open questions

Nenhuma.
