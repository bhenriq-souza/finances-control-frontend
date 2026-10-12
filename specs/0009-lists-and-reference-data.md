---
id: '0009'
title: Listas, formulários e dados de referência compartilhados
status: approved
depends_on: ['0003', '0004', '0005', '0006', '0008']
---

# 0009 — Listas, Formulários e Dados de Referência Compartilhados

## Goal

Dar às telas de domínio (specs 0010+) tudo o que elas têm em comum, para que possam ser construídas em paralelo sem que uma feature importe outra: as consultas de referência (bancos, contas, cartões, tipos), as chaves e as invalidações do TanStack Query, a matriz de permissões por perfil, datas no fuso de negócio, os componentes do Design System que faltam no código (`StatusBadge`, `EntryList`, estados vazio e de carregamento), os primitivos de formulário (diálogo responsivo, confirmação, seleção, data, erros da API nos campos), o aviso global e a página **Mais** da navegação no celular.

## Scope / Non-goals

- **Em escopo:** `src/api/queries/` (chaves, consultas de referência, usuário atual, invalidação), `src/api/permissions.ts`, `src/api/errors/form-errors.ts`; `src/shared/dates/`; em `src/ui/`: `StatusBadge` e as tabelas de status, `EntryList`, `EmptyState`, `Skeleton`, `BarList`, `FormDialog`, `ConfirmDialog`, `SelectField`, `DateField`, `Notice`; o campo `slot` da navegação e a rota `/mais`; o aviso global de `AUTH_UNAVAILABLE`; os usuários `lancador` e `leitor` no fake de autenticação do e2e e o utilitário de stubs da API; a revisão da spec 0003 (pasta `api/`).
- **Fora de escopo:** qualquer tela de domínio (specs 0010–0018); gráficos de série temporal (spec 0015); tabela com ordenação, paginação ou busca (a API não oferece nenhuma delas: as listas são sempre de um período).
- **Depende do backend:** contrato na tag `v1.1.0` — rotas de leitura de [0011](https://github.com/bhenriq-souza/finances-control-backend/blob/develop/specs/0011-accounts.md), [0012](https://github.com/bhenriq-souza/finances-control-backend/blob/develop/specs/0012-expenses.md) e [0014](https://github.com/bhenriq-souza/finances-control-backend/blob/develop/specs/0014-earnings.md) e a matriz de perfis de [0010](https://github.com/bhenriq-souza/finances-control-backend/blob/develop/specs/0010-identity.md) e do hub ([perfis](https://github.com/bhenriq-souza/finances-control/blob/main/docs/user-profiles.md)). Toda resposta de sucesso vem envelopada em `{ data }`.
- **Decisões de 2026-10-12 (aprovação):** páginas de prova `/_e2e/lista` e `/_e2e/formulario` só no build `--mode e2e`, eliminadas no de produção como o fake de autenticação; selo **Previsto** e **Em aberto** na família `info`, **Verificando** na neutra e **Aguardando** em `atencao`; as peças que o [canvas de padrões](https://claude.ai/artifact/YA6oWvBzWghdVTa2kAFTkC) (versão `1791836639-e596`) desenha e o Design System ainda não define (diálogo, folha, select, controle segmentado, etiquetas de filtro, abas, menu da linha, campo de data, estado vazio, interruptor, barra de limite, erro de validação, véu, botão destrutivo, cores de gráfico) são construídas só com os tokens existentes e voltam ao Design System do hub numa revisão futura; cores de gráfico: realizado em `acento`, previsto em `info-fundo` com contorno `info`.
- **Forma visual:** componentes do [Design System](https://claude.ai/artifact/DxDnUbE9sSQdJbxTPh6WPQ) e o [canvas de padrões](https://claude.ai/artifact/YA6oWvBzWghdVTa2kAFTkC) (lista, formulário em diálogo, confirmação, estados).

## Contracts

### Dados compartilhados entre features

Uma feature não importa outra (INV-0003-02), mas despesas, receitas, faturas, transferências e o dashboard precisam dos nomes de contas, cartões e tipos, porque a API devolve só os ids. O que é **dado do servidor** usado por mais de uma feature vive em `src/api/queries/`; o que é **regra de tela** continua dentro da feature. `src/api/queries/` importa só `api/` e bibliotecas externas (regra `api-only-shared` da spec 0003, inalterada).

| Arquivo                           | Exporta                                                                                                                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/api/queries/keys.ts`         | `queryKeys`, a fábrica de chaves de todas as consultas (tabela abaixo)                                                                                                                           |
| `src/api/queries/reference.ts`    | `banksQuery`, `bankAccountsQuery`, `creditCardsQuery`, `expenseTypesQuery`, `earningTypesQuery` e os hooks `useBanks`, `useBankAccounts`, `useCreditCards`, `useExpenseTypes`, `useEarningTypes` |
| `src/api/queries/lookups.ts`      | `useAccountLookup()`, `useCardLookup()`: `Map<id, rótulo>` com arquivados inclusos, e `rótulo(id)` que devolve "Conta removida" para id desconhecido                                             |
| `src/api/queries/current-user.ts` | `currentUserQueryOptions`, `useCurrentUser`, `CURRENT_USER_QUERY_KEY`, `CurrentUser`, `Profile` e `PROFILE_LABELS`, movidos de `identity` sem mudar comportamento                                |
| `src/api/queries/invalidation.ts` | `invalidateAfter(queryClient, domínio)`, com a matriz abaixo                                                                                                                                     |
| `src/api/permissions.ts`          | `Permission`, `can(profile, permission)`, `useCan(permission)`                                                                                                                                   |

- `identity` passa a reexportar o que foi movido; quem já importa de `@/features/identity` não muda.
- **Uma consulta por recurso de referência**, sempre com `archived=true`: as telas filtram os ativos (`archivedAt === null`) no cliente. Assim o rótulo de uma conta arquivada citada por um lançamento antigo aparece, e há uma chave só para invalidar.
- **`staleTime`:** 5 minutos para as consultas de referência e para o usuário atual; 30 segundos para listas e detalhes de lançamentos, faturas e relatórios. Toda escrita invalida pela matriz, então o `staleTime` só economiza navegação.

#### Chaves

| Raiz                  | Chaves                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `users`               | `['users', 'me']`, `['users', 'list']`                                                                                    |
| `banks`               | `['banks']`                                                                                                               |
| `bank-accounts`       | `['bank-accounts']`                                                                                                       |
| `credit-cards`        | `['credit-cards']`                                                                                                        |
| `expense-types`       | `['expense-types']`                                                                                                       |
| `earning-types`       | `['earning-types']`                                                                                                       |
| `expenses`            | `['expenses', 'list', filtros]`, `['expenses', 'detail', id]`                                                             |
| `earnings`            | `['earnings', 'list', filtros]`, `['earnings', 'detail', id]`                                                             |
| `statements`          | `['statements', 'list', creditCardId, janela]`, `['statements', 'current', creditCardId]`, `['statements', 'detail', id]` |
| `credit-card-refunds` | `['credit-card-refunds', 'list', filtros]`, `['credit-card-refunds', 'detail', id]`                                       |
| `bank-transfers`      | `['bank-transfers', 'list', filtros]`, `['bank-transfers', 'detail', id]`                                                 |
| `expense-recurrences` | `['expense-recurrences', 'list', filtros]`, `['expense-recurrences', 'detail', id]`                                       |
| `earning-recurrences` | `['earning-recurrences', 'list', filtros]`, `['earning-recurrences', 'detail', id]`                                       |
| `reports`             | `['reports', 'balance' \| 'expenses-by-type' \| 'earnings-by-type' \| 'cash-flow', parâmetros]`                           |

`filtros` e `parâmetros` são objetos com exatamente os parâmetros de query enviados (os ausentes omitidos), para que a mesma consulta tenha a mesma chave em qualquer tela.

#### Invalidação depois de uma escrita

`invalidateAfter` invalida as raízes da linha do domínio que escreveu. Toda mutação de tela chama `invalidateAfter` no `onSuccess`, nunca invalida chaves à mão.

| Domínio da escrita                                              | Raízes invalidadas                                                                          |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `profile` (perfil de usuário)                                   | `users`                                                                                     |
| `accounts` (banco, conta, cartão)                               | `banks`, `bank-accounts`, `credit-cards`, `statements`, `reports`                           |
| `expense-types`                                                 | `expense-types`, `expenses`, `statements`, `reports`                                        |
| `earning-types`                                                 | `earning-types`, `earnings`, `reports`                                                      |
| `expense` (criar, alterar, excluir, status, forma de pagamento) | `expenses`, `expense-recurrences`, `bank-accounts`, `credit-cards`, `statements`, `reports` |
| `earning` (criar, alterar, excluir, status)                     | `earnings`, `earning-recurrences`, `bank-accounts`, `reports`                               |
| `statement` (pagar, desfazer, mínimo)                           | `statements`, `expenses`, `bank-accounts`, `credit-cards`, `reports`                        |
| `refund`                                                        | `credit-card-refunds`, `statements`, `credit-cards`, `reports`                              |
| `transfer`                                                      | `bank-transfers`, `bank-accounts`, `reports`                                                |
| `expense-recurrence` (encerrar)                                 | `expense-recurrences`, `expenses`, `statements`, `reports`                                  |
| `earning-recurrence` (encerrar)                                 | `earning-recurrences`, `earnings`, `reports`                                                |

### Permissões

```ts
type Permission = 'users.manage' | 'accounts.write' | 'entries.write';
```

| Permissão        | Perfis            | Cobre                                                                                                            |
| ---------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| `users.manage`   | `ADMIN`           | listar usuários, conceder, trocar e revogar perfil (spec 0010)                                                   |
| `accounts.write` | `ADMIN`           | criar, alterar e arquivar bancos, contas e cartões (spec 0011)                                                   |
| `entries.write`  | `ADMIN`, `BILLER` | despesas, receitas e seus tipos, séries, pagamentos e estornos de fatura, transferências (0012–0014, 0017, 0018) |

- Leitura é de todo perfil; não há permissão de leitura.
- `useCan` lê o usuário atual do cache (`['users', 'me']`, garantido pela guarda de `_app`).
- **Controle sem permissão não é renderizado** — nem desabilitado, nem escondido por CSS. O backend continua sendo a autoridade: um `403 FORBIDDEN` numa escrita (perfil trocado durante a sessão) mostra a mensagem do catálogo no formulário e invalida `['users', 'me']`, o que redesenha a tela com o perfil novo.
- Rota que exige permissão (ex.: `/usuarios`) confere `can` no `beforeLoad` e, sem ela, renderiza `EmptyState` `variant="sem-acesso"`, sem chamar a API.

### Datas — `src/shared/dates/`

Datas de negócio da API são `YYYY-MM-DD` (e `YYYY-MM` nos relatórios), sem hora, no fuso `America/Sao_Paulo` (spec 0012 do backend). O cliente as trata como **strings**, nunca como `Date` com hora local.

| Função                                         | Contrato                                                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `today(): IsoDate`                             | a data de hoje em `America/Sao_Paulo`, por `Intl.DateTimeFormat`                                             |
| `addDays(date, n)`, `addMonths(month, n)`      | aritmética de calendário sobre a string (UTC interno, sem fuso)                                              |
| `monthOf(date): IsoMonth`, `monthRange(month)` | `'2026-10'` e `{ from: '2026-10-01', to: '2026-10-31' }`                                                     |
| `formatDate(date, estilo)`                     | `'curta'` → `15 out.`; `'longa'` → `15 de out. de 2026`; `'relativa'` → `Hoje`, `Ontem`, `Amanhã` ou a curta |
| `formatMonth(month)`                           | `outubro de 2026`                                                                                            |

`IsoDate` e `IsoMonth` são aliases de `string` validados por `isIsoDate`/`isIsoMonth`.

### Status — `StatusBadge`

`src/ui/status-badge.tsx`: o selo do Design System — ponto, rótulo em caixa alta e fundo da família (`positivo`, `negativo`, `atencao`, `info` ou neutro em `superficie-elevada`/`texto-apoio`), 24px de altura. A cor nunca é a única informação: o rótulo sempre aparece.

`src/ui/status-labels.ts` traz as tabelas, tipadas pelas uniões literais (o `ui` não importa os tipos gerados; a tela que passa um status fora da união falha no gate `types`):

| Recurso       | Status (API)                 | Rótulo      | Família    |
| ------------- | ---------------------------- | ----------- | ---------- |
| despesa       | `OPEN`                       | Pendente    | neutra     |
| despesa       | `FORECAST`                   | Previsto    | `info`     |
| despesa       | `PAID`                       | Pago        | `positivo` |
| despesa       | `OVERDUE`                    | Vencido     | `negativo` |
| despesa       | `VERIFYING`                  | Verificando | neutra     |
| receita       | `OPEN`                       | Pendente    | neutra     |
| receita       | `FORECAST`                   | Previsto    | `info`     |
| receita       | `RECEIVED`                   | Recebido    | `positivo` |
| receita       | `OVERDUE`                    | Atrasado    | `negativo` |
| receita       | `VERIFYING`                  | Verificando | neutra     |
| fatura        | `OPEN`                       | Em aberto   | `info`     |
| fatura        | `CLOSED`                     | Fechada     | `atencao`  |
| fatura        | `CLOSED` com `overdue: true` | Vencida     | `negativo` |
| fatura        | `PAID`                       | Paga        | `positivo` |
| fatura        | `ROLLED_OVER`                | Rolada      | neutra     |
| transferência | `SCHEDULED`                  | Agendada    | `info`     |
| transferência | `COMPLETED`                  | Concluída   | `positivo` |

Selos derivados, sem status próprio na API: **Vence hoje** (`atencao`) para despesa de conta em `OPEN` com `occurredOn` igual a `today()` e para fatura `CLOSED` com `dueOn` igual a `today()`; **Arquivado** (neutra) para banco, conta, cartão e tipo com `archivedAt`; **Aguardando** (`atencao`) para usuário sem perfil.

### Lista — `EntryList`

`src/ui/entry-list.tsx`, o componente do Design System "lista que vira tabela no tablet":

```ts
interface EntryListProps<T> {
    items: readonly T[];
    getKey: (item: T) => string;
    caption: string; // título acessível da tabela (visualmente oculto)
    columns: readonly EntryColumn<T>[]; // tabela, a partir de `md`
    renderCard: (item: T) => ReactNode; // cartão, abaixo de `md`
    href?: (item: T) => string; // linha/cartão navegável
    empty: ReactNode; // normalmente um `EmptyState`
}
interface EntryColumn<T> {
    header: string;
    cell: (item: T) => ReactNode;
    align?: 'start' | 'end'; // `end` para valores
    hideBelow?: 'lg'; // coluna que só aparece no desktop
}
```

- **Abaixo de `md`:** lista (`<ul>`) de cartões com borda `linha`, raio `raio-md`, padding `espaco-4`; com `href`, o cartão inteiro é um link (alvo ≥ 44px).
- **A partir de `md`:** `<table>` com `<caption>` oculta, cabeçalho no estilo `rotulo` sobre `superficie-elevada`, linhas separadas por `linha`; com `href`, a primeira célula de texto é o link, e a linha inteira é clicável por um `onClick` que repete o link (o teclado usa o link).
- Valores em `Money` com algarismos tabulares, alinhados ao fim.
- Sem ordenação, paginação nem seleção múltipla: as telas ordenam antes de passar `items`.

### Estados — `EmptyState`, `Skeleton`, `BarList`

- `EmptyState` (`src/ui/empty-state.tsx`): ícone lucide, título, texto de apoio e uma ação opcional. Variantes: `vazio` (lista sem itens), `erro` (consulta falhou: mensagem do `ApiError.userMessage` e **Tentar de novo**, que chama `refetch`), `nao-encontrado` (detalhe com `*_NOT_FOUND`: "Não encontramos este item." e um link de volta para a lista) e `sem-acesso` ("Seu perfil não dá acesso a esta tela.").
- `Skeleton` (`src/ui/skeleton.tsx`): blocos `superficie-elevada` com pulso (parado com `prefers-reduced-motion`), e `EntryListSkeleton` com três cartões/linhas, mostrado enquanto a consulta não tem dado. `role="status"` e `aria-label="Carregando"`.
- `BarList` (`src/ui/charts/bar-list.tsx`): barras horizontais rotuladas (nome, valor em `Money`, barra de 6px proporcional ao maior valor, em `acento` sobre `superficie-elevada`), como "Despesas por tipo" do dashboard. Sem biblioteca de gráficos; a lista é uma `<ul>` legível por leitor de tela.

### Formulários

- **`FormDialog`** (`src/ui/form-dialog.tsx`), sobre `@radix-ui/react-dialog` (dependência nova; foco preso, `Esc`, `aria-modal`, retorno do foco): abaixo de `md` é uma folha de tela cheia com o título fixo no topo e as ações fixas embaixo; a partir de `md`, um diálogo central de até 560px. Props: `open`, `onOpenChange`, `title`, `description?`, `children` (o formulário), `footer`.
- **Véu dos diálogos e folhas:** `color-mix(in oklab, var(--ft-fundo) 72%, transparent)` no tema escuro e `48%` no claro — derivado do token `fundo`, sem token novo nem cor literal.
- **`ConfirmDialog`** (`src/ui/confirm-dialog.tsx`), sobre o mesmo pacote, com `role="alertdialog"`: título, texto que diz **o que vai acontecer** (inclusive cascatas), botão de confirmar com o verbo da ação ("Excluir", "Revogar") e **Cancelar** com o foco inicial. Ação destrutiva usa a variante de botão `negativo` (fundo `negativo`, texto `sobre-acento`).
- **`SelectField`** (`src/ui/select-field.tsx`): `<select>` nativo estilizado (melhor no celular que um menu próprio), com `<optgroup>` opcional (ex.: "Contas" e "Cartões"), rótulo, ajuda e erro.
- **`DateField`** (`src/ui/date-field.tsx`): `<input type="date">` nativo; o valor já é `YYYY-MM-DD`, o formato da API.
- **Campos e erros:** todo campo tem `<label>` visível, mensagem de erro ligada por `aria-describedby` e `aria-invalid`. Os formulários usam `react-hook-form` com `zodResolver`; valores monetários usam `MoneyInput` e `moneySchema` (spec 0008).
- **Erros da API num formulário** — `applyApiError(error, form, fieldMap)` em `src/api/errors/form-errors.ts`:
    - `VALIDATION_ERROR`: cada `details[].path` cujo primeiro segmento está em `fieldMap` vira erro do campo (com a mensagem geral do catálogo para o código do campo); o que não casar vai para o alerta do formulário;
    - códigos listados em `fieldMap.codes` (ex.: `{ BANK_ALREADY_EXISTS: 'febrabanCode' }`) viram erro do campo, com a mensagem do catálogo;
    - qualquer outro código vai para o alerta do topo do formulário (`FormAlert`, `role="alert"`), com `userMessage`;
    - o formulário continua aberto e com os valores digitados.
- **Padrões de rota das telas** (normativos para 0010–0018):
    - **cadastros** (bancos, contas, cartões, tipos, usuários): lista; criar por `?novo=1` e editar por `?editar=<id>` na própria lista, em `FormDialog`;
    - **lançamentos** (despesas, receitas, transferências, faturas): lista com filtros na URL; detalhe em rota própria (`/despesas/$despesaId`); criar por `?novo=1` na lista; editar por `?editar=1` no detalhe; ações de status em `FormDialog` ou `ConfirmDialog` abertos do detalhe, também endereçáveis por parâmetro (ex.: `?pagar=1`), para que o dashboard leve direto a elas sem importar a feature.
    - Os parâmetros de busca de toda rota são validados por um schema zod no `validateSearch` da rota; parâmetro inválido é descartado.
- **Depois de uma escrita bem-sucedida:** fecha o diálogo, chama `invalidateAfter` e mostra um `Notice` de sucesso curto ("Despesa salva.").

### Aviso global — `Notice`

`src/ui/notice.tsx` e o provider no `app`: uma região `aria-live="polite"` no canto inferior (acima da barra inferior no celular) com avisos não bloqueantes que somem em 5 segundos ou ao fechar; `tone` `sucesso` | `erro` | `info`. O `app` passa a ligar o efeito global `onAuthUnavailable` (spec 0005) a um aviso de erro com a mensagem do catálogo — hoje ele não faz nada.

### Navegação — campo `slot` e a página **Mais**

O item de `src/app/shell/navigation.ts` (spec 0006) ganha `slot: 'barra' | 'mais'`:

- **Barra inferior** (celular e tablet): os itens visíveis de `slot: 'barra'`, no máximo quatro, mais o item **Mais** (`/mais`, ícone `Ellipsis`) quando houver algum item visível de `slot: 'mais'`.
- **Barra lateral** (desktop): todos os itens visíveis, na ordem da lista; **Mais** não aparece.
- **`/mais`**: lista de links grandes (ícone, rótulo, alvo ≥ 48px) com os itens visíveis de `slot: 'mais'`; no desktop, redireciona para `/`.

A lista completa, com a spec que acrescenta cada item:

| Ordem | Item           | Rota              | Perfis  | `slot`  | Spec |
| ----- | -------------- | ----------------- | ------- | ------- | ---- |
| 1     | Início         | `/`               | todos   | `barra` | 0006 |
| 2     | Despesas       | `/despesas`       | todos   | `barra` | 0012 |
| 3     | Receitas       | `/receitas`       | todos   | `barra` | 0014 |
| 4     | Cartões        | `/cartoes`        | todos   | `barra` | 0011 |
| 5     | Contas         | `/contas`         | todos   | `mais`  | 0011 |
| 6     | Transferências | `/transferencias` | todos   | `mais`  | 0018 |
| 7     | Séries fixas   | `/series`         | todos   | `mais`  | 0017 |
| 8     | Relatórios     | `/relatorios`     | todos   | `mais`  | 0015 |
| 9     | Usuários       | `/usuarios`       | `ADMIN` | `mais`  | 0010 |

Um item com `profiles` de todos os perfis é declarado com os três explicitamente. A ordem da lista em `navigation.ts` segue a coluna _Ordem_, qualquer que seja a ordem em que as specs entrem.

### E2E — usuários e stubs da API

- O fake de autenticação (spec 0006) ganha os usuários `lancador` (perfil `BILLER`) e `leitor` (perfil `VIEWER`), com nomes e emails próprios, e `stubUsersMe` responde coerente.
- `e2e/fixtures/api.ts` exporta `stubApi(page, rotas)`: registra `page.route` para cada `{ method, path, status?, body }` sob `**/api`, responde `404 ROUTE_NOT_FOUND` a qualquer chamada não declarada e guarda as requisições recebidas, para o teste conferir corpo e query. Os dados de exemplo de cada domínio ficam em `e2e/fixtures/data/<domínio>.ts`, criados pela tarefa da spec do domínio.

## Invariants

- **INV-0009-01:** nenhuma feature importa outra para obter dados do servidor; o que mais de uma feature consome vem de `src/api/queries/`.
- **INV-0009-02:** toda mutação de tela invalida o cache só por `invalidateAfter`, com o domínio da escrita.
- **INV-0009-03:** controle de escrita sem a permissão do perfil não é renderizado.
- **INV-0009-04:** todo status mostrado ao usuário passa por `StatusBadge`, com rótulo e família da tabela desta spec.
- **INV-0009-05:** datas de negócio circulam como `YYYY-MM-DD` e "hoje" é sempre `today()` no fuso `America/Sao_Paulo`.
- **INV-0009-06:** erro de API num formulário nunca fecha o formulário nem apaga o que foi digitado.

## Error cases

| Código      | Situação                                                          | Comportamento exigido                                                                  |
| ----------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| ERR-0009-01 | Consulta de lista falha (`NETWORK_ERROR`, `5xx`)                  | `EmptyState` `erro` no lugar da lista, com a mensagem do catálogo e **Tentar de novo** |
| ERR-0009-02 | Detalhe responde `404` com `*_NOT_FOUND`                          | `EmptyState` `nao-encontrado` com link para a lista                                    |
| ERR-0009-03 | Escrita responde `403 FORBIDDEN`                                  | mensagem do catálogo no alerta do formulário; `['users', 'me']` invalidado             |
| ERR-0009-04 | Escrita responde `400 VALIDATION_ERROR` com `details`             | erros nos campos de `fieldMap`, o resto no alerta; formulário aberto com os valores    |
| ERR-0009-05 | Rota com permissão acessada sem ela                               | `EmptyState` `sem-acesso`, sem chamada à API                                           |
| ERR-0009-06 | Lançamento cita conta ou cartão ausente da consulta de referência | rótulo "Conta removida" / "Cartão removido", sem quebrar a lista                       |
| ERR-0009-07 | `AUTH_UNAVAILABLE` em qualquer consulta                           | aviso de erro global com a mensagem do catálogo; a consulta fica em erro (ERR-0009-01) |

## Acceptance criteria

- **AC-0009-01:** `invalidateAfter` invalida exatamente as raízes da matriz para cada domínio, e `queryKeys` gera a mesma chave para os mesmos filtros em qualquer ordem de propriedades.
- **AC-0009-02:** `can` devolve a tabela de permissões para os três perfis e `false` sem perfil; um componente com `useCan('entries.write')` não renderiza o controle para `VIEWER`.
- **AC-0009-03:** `today()` devolve a data de São Paulo para um instante que já é o dia seguinte em UTC (ex.: `2026-10-12T02:30:00Z` → `2026-10-11`), e `formatDate` produz `15 out.`, `15 de out. de 2026` e `Hoje` nos estilos correspondentes.
- **AC-0009-04:** `StatusBadge` renderiza o rótulo e a família de cada linha da tabela de status, inclusive os selos derivados.
- **AC-0009-05:** `EntryList` mostra cartões no projeto `celular` e uma tabela com `<caption>` nos projetos `tablet` e `desktop`, com o link de cada item, e o `empty` quando não há itens.
- **AC-0009-06:** `FormDialog` é folha de tela cheia no `celular` e diálogo no `desktop`, prende o foco, fecha com `Esc` e devolve o foco ao botão que o abriu; `ConfirmDialog` começa com o foco em **Cancelar**.
- **AC-0009-07:** `applyApiError` põe um `VALIDATION_ERROR` com `path: ['name']` no campo `name`, um código de `fieldMap.codes` no seu campo e qualquer outro código no alerta, sem limpar os valores.
- **AC-0009-08:** com um item de `slot: 'mais'` visível, a barra inferior mostra **Mais** e `/mais` lista o item; sem nenhum, **Mais** não aparece; no desktop a lateral lista todos e `/mais` redireciona para `/`.
- **AC-0009-09:** um `AUTH_UNAVAILABLE` numa consulta mostra o aviso global com a mensagem do catálogo.
- **AC-0009-10:** `useAccountLookup` devolve o rótulo de uma conta arquivada e "Conta removida" para um id desconhecido.

## Test mapping

| Item                    | Teste                                                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| AC-0009-01, INV-0009-02 | `src/api/queries/invalidation.test.ts` e `src/api/queries/keys.test.ts`                                                          |
| AC-0009-02, INV-0009-03 | `src/api/permissions.test.tsx`                                                                                                   |
| AC-0009-03, INV-0009-05 | `src/shared/dates/dates.test.ts`                                                                                                 |
| AC-0009-04, INV-0009-04 | `src/ui/status-badge.test.tsx`                                                                                                   |
| AC-0009-05              | `src/ui/entry-list.test.tsx` e `e2e/entry-list.spec.ts` (página de prova `/_e2e/lista`)                                          |
| AC-0009-06              | `src/ui/form-dialog.test.tsx`, `src/ui/confirm-dialog.test.tsx` e `e2e/form-dialog.spec.ts` (página de prova `/_e2e/formulario`) |
| AC-0009-07, INV-0009-06 | `src/api/errors/form-errors.test.ts`                                                                                             |
| AC-0009-08              | `src/app/shell/navigation.test.ts` e `e2e/more.spec.ts`                                                                          |
| AC-0009-09              | `src/app/notices.test.tsx`                                                                                                       |
| AC-0009-10, INV-0009-01 | `src/api/queries/lookups.test.tsx` e o gate `boundaries`                                                                         |

## Open questions

Nenhuma.
