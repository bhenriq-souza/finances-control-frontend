---
id: '0011'
title: Bancos, contas bancárias e cartões de crédito
status: draft
depends_on: ['0008', '0009']
---

# 0011 — Bancos, Contas Bancárias e Cartões de Crédito

## Goal

Mostrar a todo perfil onde o dinheiro está — saldo de cada conta, limite e ciclo de cada cartão — e dar ao `ADMIN` o cadastro de bancos, contas e cartões (F002), com arquivamento em vez de exclusão, como o backend define.

## Scope / Non-goals

- **Em escopo:** `/contas` (contas bancárias), `/contas/bancos` (bancos), `/cartoes` (cartões), `/cartoes/$cartaoId` (resumo do cartão, onde a spec 0013 acrescenta as faturas); os formulários de criar e alterar e as ações de arquivar e desarquivar; os itens **Cartões** e **Contas** da navegação.
- **Fora de escopo:** extrato de movimentos por conta (a API não tem; o fluxo de caixa mensal é da spec 0015); ajuste manual de saldo; importação CSV (fora da v1); faturas (spec 0013); transferências (spec 0018).
- **Depende do backend:** [spec 0011](https://github.com/bhenriq-souza/finances-control-backend/blob/develop/specs/0011-accounts.md) na tag `v1.1.0` — `/banks`, `/bank-accounts`, `/credit-cards`, leitura para todo perfil e escrita só `ADMIN`.
- **Forma visual:** padrão de **cadastro** da spec 0009 e o [canvas de padrões](https://claude.ai/artifact/YA6oWvBzWghdVTa2kAFTkC); a seção "Contas e cartões" do [dashboard](https://claude.ai/artifact/HEj1d1jqqwAPMBVYZdMsyy) é a referência dos cartões de conta e de cartão.

## Contracts

### Rotas e navegação

| Rota                 | Conteúdo                                                                                                 | Parâmetros                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `/contas`            | contas bancárias e o total em contas; link **Bancos**                                                    | `?arquivadas=1`, `?novo=1`, `?editar=<id>` |
| `/contas/bancos`     | bancos                                                                                                   | `?arquivados=1`, `?novo=1`, `?editar=<id>` |
| `/cartoes`           | cartões de crédito                                                                                       | `?arquivados=1`, `?novo=1`, `?editar=<id>` |
| `/cartoes/$cartaoId` | resumo do cartão (limite, ciclo atual, conta pagadora); a rota compõe também o painel de faturas da 0013 | `?editar=1`                                |

- Navegação: `{ to: '/cartoes', label: 'Cartões', icon: CreditCard, profiles: [todos], slot: 'barra' }` e `{ to: '/contas', label: 'Contas', icon: Landmark, profiles: [todos], slot: 'mais' }`.
- `?novo` e `?editar` só têm efeito com `accounts.write`; sem a permissão, são descartados.
- Código em `src/features/accounts/`; dados por `useBanks`, `useBankAccounts` e `useCreditCards` (spec 0009).

### Contas — `/contas`

- Cabeçalho: "Saldo em contas" com a soma de `currentBalanceCents` das contas ativas (`Money`, `valor-destaque`).
- `EntryList` das contas ativas (ou de todas, com **Mostrar arquivadas**), em ordem de `description`:

| Coluna          | Conteúdo                                                                        |
| --------------- | ------------------------------------------------------------------------------- |
| Conta           | `description` e, no apoio, `bank.name`                                          |
| Tipo            | `CHECKING` Corrente · `SAVINGS` Poupança · `INVESTMENT` Investimento            |
| Número          | `accountNumber` em `codigo` (JetBrains Mono); só no desktop                     |
| Cheque especial | `overdraftLimitCents` quando maior que zero; só no desktop                      |
| Saldo           | `currentBalanceCents` (`Money sign="auto"`, `tone="neutral"`; negativo com `−`) |
| (estado)        | selo **Arquivado** quando `archivedAt`                                          |

- Com `accounts.write`: **Nova conta**; em cada linha, **Editar** e **Arquivar** (ou **Desarquivar**).

### Bancos — `/contas/bancos`

- `EntryList` por `name`: `febrabanCode` em `codigo`, `name`, selo **Arquivado**.
- Com `accounts.write`: **Novo banco**, **Editar** (só o nome), **Arquivar**/**Desarquivar**.

### Cartões — `/cartoes` e `/cartoes/$cartaoId`

- `EntryList` por `name`:

| Coluna         | Conteúdo                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| Cartão         | `name` e, no apoio, `bank.name`                                                                          |
| Usado          | `creditLimitCents − availableLimitCents` (`Money`, sem sinal), com a barra de uso (`BarList` de um item) |
| Disponível     | `availableLimitCents`; negativo com `−` e tom `negativo` (o backend permite limite estourado)            |
| Ciclo          | "Fecha em `currentCycle.closesOn` · vence em `currentCycle.dueOn`" (`formatDate` curta)                  |
| Conta pagadora | rótulo de `paymentBankAccountId` por `useAccountLookup`, ou "—"; só no desktop                           |

- Cada linha leva a `/cartoes/$cartaoId`, que mostra os mesmos dados em `Card`, o limite total e as ações (**Editar**, **Arquivar**/**Desarquivar**) para `accounts.write`.

### Formulários

| Formulário        | Campos (criar)                                                                                                                               | Campos (alterar)                                                                                | Rota do backend                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Banco             | `febrabanCode` (3 dígitos, `^[0-9]{3}$`), `name`                                                                                             | `name`                                                                                          | `POST /banks`, `PATCH /banks/{id}`                 |
| Conta bancária    | `bankId` (bancos ativos), `type`, `accountNumber`, `description`, `openingBalanceCents`, `overdraftLimitCents` (opcional, ≥ 0)               | `type`, `accountNumber`, `description`, `overdraftLimitCents`                                   | `POST /bank-accounts`, `PATCH /bank-accounts/{id}` |
| Cartão de crédito | `bankId` (bancos ativos), `name`, `creditLimitCents` (> 0), `closingDay` e `dueDay` (1–31), `paymentBankAccountId` (contas ativas, opcional) | `name`, `creditLimitCents`, `closingDay`, `dueDay`, `paymentBankAccountId` (vazio envia `null`) | `POST /credit-cards`, `PATCH /credit-cards/{id}`   |

- **Saldo inicial:** `MoneyInput` com `moneySchema({ min: 'nonnegative' })` e a caixa **Saldo inicial negativo**, que nega o valor antes de enviar (o parser não aceita sinal, spec 0008). Ao alterar, `openingBalanceCents` e `currentBalanceCents` aparecem só para leitura, com a nota "O saldo só muda por lançamentos."
- **Cartão, ao alterar:** nota fixa "Mudar o limite muda o disponível na mesma diferença. Mudar os dias vale só para ciclos ainda não fechados."
- PATCH envia só os campos alterados.
- Arquivar e desarquivar: `POST`/`DELETE /…/{id}/archive`, sem confirmação (é reversível e idempotente); `Notice` "Conta arquivada." etc.
- Toda escrita: `invalidateAfter(..., 'accounts')`.

### Mapa de erros dos formulários (`applyApiError`)

| Código                        | Campo                                             |
| ----------------------------- | ------------------------------------------------- |
| `BANK_ALREADY_EXISTS`         | `febrabanCode`                                    |
| `BANK_ACCOUNT_ALREADY_EXISTS` | `accountNumber`                                   |
| `CREDIT_CARD_ALREADY_EXISTS`  | `name`                                            |
| `BANK_ARCHIVED`               | `bankId`                                          |
| `BANK_NOT_FOUND`              | `bankId`                                          |
| `BANK_ACCOUNT_ARCHIVED`       | `paymentBankAccountId`                            |
| `BANK_ACCOUNT_NOT_FOUND`      | `paymentBankAccountId` no cartão; alerta na conta |

## Invariants

- **INV-0011-01:** só `ADMIN` vê controles de criar, alterar, arquivar e desarquivar; `BILLER` e `VIEWER` veem as mesmas listas, só leitura.
- **INV-0011-02:** nenhum formulário envia `openingBalanceCents`, `currentBalanceCents` ou `bankId` num `PATCH` de conta, nem `bankId` num `PATCH` de cartão.
- **INV-0011-03:** saldos e limites mostrados vêm da resposta da API, em centavos, por `Money`; o cliente só soma (total em contas) e subtrai (limite usado).
- **INV-0011-04:** selects de banco, conta pagadora e (nas demais specs) de conta e cartão oferecem só itens ativos.

## Error cases

| Código      | Situação                                         | Comportamento exigido                       |
| ----------- | ------------------------------------------------ | ------------------------------------------- |
| ERR-0011-01 | Duplicidade (`*_ALREADY_EXISTS`)                 | erro no campo do mapa, mensagem do catálogo |
| ERR-0011-02 | Banco ou conta pagadora arquivados               | erro no campo do mapa                       |
| ERR-0011-03 | `/cartoes/$cartaoId` com `CREDIT_CARD_NOT_FOUND` | ERR-0009-02                                 |
| ERR-0011-04 | `VALIDATION_ERROR`                               | ERR-0009-04                                 |
| ERR-0011-05 | Listas falham                                    | ERR-0009-01                                 |

## Acceptance criteria

- **AC-0011-01:** `/contas` mostra as contas ativas do stub, o tipo em pt-BR, o saldo com sinal e o "Saldo em contas" igual à soma; **Mostrar arquivadas** acrescenta as arquivadas com o selo.
- **AC-0011-02:** `/cartoes` mostra usado, disponível e o ciclo de cada cartão; um disponível negativo aparece com `−` e o tom `negativo`.
- **AC-0011-03:** como `ADMIN`, criar uma conta com saldo inicial `1.234,56` e **Saldo inicial negativo** marcado envia `openingBalanceCents: -123456`.
- **AC-0011-04:** alterar uma conta envia só os campos alterados e nunca os campos de INV-0011-02.
- **AC-0011-05:** `409 BANK_ALREADY_EXISTS` ao criar um banco marca o campo de código; `409 BANK_ACCOUNT_ARCHIVED` ao alterar um cartão marca o campo de conta pagadora.
- **AC-0011-06:** arquivar e desarquivar chamam `POST` e `DELETE /…/archive` e a linha muda de estado.
- **AC-0011-07:** com `lancador` e `leitor`, nenhuma das telas mostra **Nova conta**, **Novo banco**, **Novo cartão**, **Editar** ou **Arquivar**, e `?novo=1` não abre formulário.
- **AC-0011-08:** nos três projetos, as listas seguem o `EntryList` e a barra inferior traz **Cartões**; **Contas** aparece em **Mais** no celular e na lateral do desktop.

## Test mapping

| Item                                | Teste                                                                   |
| ----------------------------------- | ----------------------------------------------------------------------- |
| AC-0011-01, AC-0011-02, INV-0011-03 | `e2e/accounts.spec.ts` e `src/features/accounts/accounts-page.test.tsx` |
| AC-0011-03, AC-0011-04, INV-0011-02 | `src/features/accounts/forms/bank-account-form.test.tsx`                |
| AC-0011-05, INV-0011-04             | `src/features/accounts/forms/*.test.tsx`                                |
| AC-0011-06                          | `e2e/accounts-admin.spec.ts`                                            |
| AC-0011-07, INV-0011-01             | `e2e/accounts.spec.ts` (com `lancador` e `leitor`)                      |
| AC-0011-08                          | `e2e/accounts.spec.ts`                                                  |

## Open questions

- O contrato `v1.1.0` não lista `BANK_ACCOUNT_ARCHIVED` entre os `409` de `PATCH /credit-cards/{id}` (resposta `AccountsConflict`), embora a spec 0011 do backend o devolva para conta pagadora arquivada (ERR-0011-13). O frontend trata pelo `code`; a documentação do contrato é do backend.
- Saldo inicial negativo por caixa de seleção, em vez de aceitar `-` no `MoneyInput`: confirmar com o responsável.
