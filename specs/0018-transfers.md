---
id: '0018'
title: Transferências entre contas próprias
status: implemented
depends_on: ['0008', '0009', '0011']
---

# 0018 — Transferências entre Contas Próprias

## Goal

Mostrar e registrar o dinheiro que passa de uma conta própria para outra — concluído na hora ou agendado — sem que isso apareça como despesa ou receita, com o concluir e o desfazer que movem os dois saldos de uma vez, como o backend garante.

## Scope / Non-goals

- **Em escopo:** `/transferencias`, `/transferencias/$transferenciaId`, o formulário (criar e alterar), concluir, desfazer e excluir; o item **Transferências** da navegação.
- **Fora de escopo:** transferência recorrente e estado de atrasada (a API não tem); transferência para terceiros (é despesa).
- **Depende do backend:** [spec 0018](https://github.com/bhenriq-souza/finances-control-backend/blob/develop/specs/0018-transfers.md) na tag `v1.1.0`. Escrita: `ADMIN` e `BILLER`; leitura: todos.
- **Forma visual:** padrão de **lançamento** da spec 0009 e o [canvas de padrões](https://claude.ai/artifact/YA6oWvBzWghdVTa2kAFTkC).

## Contracts

### Rotas e navegação

| Rota                               | Conteúdo        | Parâmetros de busca (zod)        |
| ---------------------------------- | --------------- | -------------------------------- |
| `/transferencias`                  | lista do mês    | `mes`, `status`, `conta`, `novo` |
| `/transferencias/$transferenciaId` | detalhe e ações | `editar`, `concluir`, `excluir`  |

- Navegação: `{ to: '/transferencias', label: 'Transferências', icon: ArrowLeftRight, profiles: [todos], slot: 'mais' }`.
- Código em `src/features/accounts/transfers/` (o backend mantém a transferência no módulo `accounts`).

### Lista

- `GET /bank-transfers` com `from`/`to` = `monthRange(mes)`, `status` e `bankAccountId` (de `conta`: origem **ou** destino). Ordem da API (`occurredOn`, depois `createdAt`).
- `EntryList`: data, descrição, "Origem → Destino" (rótulos por `useAccountLookup`), selo (Agendada/Concluída), valor sem sinal e `tone="neutral"` (não é entrada nem saída do patrimônio). Com o filtro `conta`, o valor ganha o sinal do ponto de vista da conta: `−` quando sai, `+` quando entra.
- Com `entries.write`: **Nova transferência**.

### Formulário

| Campo                        | Criar                                                                  | Alterar                        |
| ---------------------------- | ---------------------------------------------------------------------- | ------------------------------ |
| De (`fromBankAccountId`)     | contas ativas                                                          | só em `SCHEDULED`              |
| Para (`toBankAccountId`)     | contas ativas, sem a de origem                                         | só em `SCHEDULED`              |
| Valor (`amountCents`)        | `MoneyInput`, `moneySchema()`                                          | só em `SCHEDULED`              |
| Data (`occurredOn`)          | `DateField`, padrão `today()`                                          | só em `SCHEDULED`              |
| Situação (`status`)          | **Concluída agora** (`COMPLETED`, padrão) ou **Agendar** (`SCHEDULED`) | — (muda por concluir/desfazer) |
| Concluída em (`completedOn`) | opcional, só em Concluída; ajuda "Vazio usa a data da transferência."  | —                              |
| Descrição                    | obrigatória                                                            | sim                            |
| Observações (`notes`)        | opcional                                                               | sim                            |

- Origem igual ao destino é barrado no schema ("Escolha contas diferentes.").
- `POST /bank-transfers`; `PATCH /bank-transfers/{id}` só com os campos alterados, nunca `status` nem `completedOn`.
- `invalidateAfter(..., 'transfer')`.

### Detalhe e ações

| Status      | Ações (com `entries.write`)                                                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `SCHEDULED` | **Concluir** (`FormDialog` com `completedOn`, padrão `today()`), **Editar**, **Excluir** (`ConfirmDialog`)                                   |
| `COMPLETED` | **Desfazer** (`ConfirmDialog`: "Os saldos das duas contas voltam e a transferência fica agendada."), **Editar** (só descrição e observações) |

- Concluir: `PATCH /bank-transfers/{id}/status` `{ status: 'COMPLETED', completedOn }`; desfazer: `{ status: 'SCHEDULED' }`; excluir: `DELETE /bank-transfers/{id}`.
- Agendada com `occurredOn` passado mostra o aviso "Agendada para uma data que já passou." (o backend não tem estado de atrasada).

### Mapa de erros

| Código                                            | Onde                                         |
| ------------------------------------------------- | -------------------------------------------- |
| `BANK_ACCOUNT_ARCHIVED`, `BANK_ACCOUNT_NOT_FOUND` | campo De ou Para (pelo `details`, ou alerta) |
| `BANK_TRANSFER_ALREADY_COMPLETED`                 | alerta; o detalhe é recarregado              |
| `BANK_TRANSFER_STATUS_UNCHANGED`                  | alerta; o detalhe é recarregado              |
| `BANK_TRANSFER_NOT_FOUND`                         | ERR-0009-02 no detalhe; alerta numa ação     |

## Invariants

- **INV-0018-01:** transferência nunca aparece com o tom de receita ou despesa; o sinal só aparece no filtro por conta.
- **INV-0018-02:** campos de conta, valor e data só são editáveis em `SCHEDULED`; excluir só existe em `SCHEDULED`.
- **INV-0018-03:** o formulário nunca envia origem igual ao destino.

## Error cases

| Código      | Situação                | Comportamento exigido           |
| ----------- | ----------------------- | ------------------------------- |
| ERR-0018-01 | Erros do mapa           | campo ou alerta conforme o mapa |
| ERR-0018-02 | Lista ou detalhe falham | ERR-0009-01 / ERR-0009-02       |
| ERR-0018-03 | `VALIDATION_ERROR`      | ERR-0009-04                     |

## Acceptance criteria

- **AC-0018-01:** `/transferencias?mes=2026-10` chama `GET /bank-transfers?from=2026-10-01&to=2026-10-31` e mostra origem → destino por nome, selo e valor neutro; com `conta`, o valor ganha `−` ou `+` conforme a direção.
- **AC-0018-02:** criar uma concluída envia `status: 'COMPLETED'`; criar agendada envia `status: 'SCHEDULED'` sem `completedOn`.
- **AC-0018-03:** escolher a mesma conta em De e Para mostra o erro do schema e não envia.
- **AC-0018-04:** **Concluir** envia `{ status: 'COMPLETED', completedOn }`; **Desfazer** pede confirmação e envia `{ status: 'SCHEDULED' }`; **Excluir** só existe na agendada.
- **AC-0018-05:** na concluída, **Editar** só mostra descrição e observações.
- **AC-0018-06:** com `leitor`, nenhuma ação de escrita aparece.
- **AC-0018-07:** nos três projetos, lista e formulário seguem `EntryList` e `FormDialog`; **Transferências** aparece em **Mais** no celular.

## Test mapping

| Item                                | Teste                                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------ |
| AC-0018-01, AC-0018-07, INV-0018-01 | `e2e/transfers.spec.ts` e `src/features/accounts/transfers/transfers-page.test.tsx`  |
| AC-0018-02, AC-0018-03, INV-0018-03 | `src/features/accounts/transfers/transfer-form.test.tsx`                             |
| AC-0018-04, AC-0018-05, INV-0018-02 | `src/features/accounts/transfers/transfer-detail.test.tsx` e `e2e/transfers.spec.ts` |
| AC-0018-06                          | `e2e/transfers.spec.ts` (com `leitor`)                                               |

## Open questions

Nenhuma.
