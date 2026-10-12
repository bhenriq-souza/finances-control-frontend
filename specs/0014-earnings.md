---
id: '0014'
title: Receitas e tipos de receita
status: approved
depends_on: ['0008', '0009', '0011']
---

# 0014 — Receitas e Tipos de Receita

## Goal

Levar o F005 para a tela, no mesmo padrão das despesas (spec 0012): ver as receitas de um mês, lançar receita variável, parcelada ou fixa numa conta, alterar e excluir com o escopo certo, receber e desfazer o recebimento, e manter os tipos de receita.

## Scope / Non-goals

- **Em escopo:** `/receitas`, `/receitas/$receitaId`, `/receitas/tipos`; o formulário de receita; os diálogos de status e de exclusão; o item **Receitas** da navegação.
- **Fora de escopo:** receita em cartão (não existe no backend); contraparte ("quem paga") como entidade (a API só tem `description` e `notes`); séries (spec 0017); importação CSV.
- **Depende do backend:** [spec 0014](https://github.com/bhenriq-souza/finances-control-backend/blob/develop/specs/0014-earnings.md) e a [0017](https://github.com/bhenriq-souza/finances-control-backend/blob/develop/specs/0017-jobs-and-recurrence.md), na tag `v1.1.0`. Escrita: `ADMIN` e `BILLER`; leitura: todos.
- **Forma visual:** a da spec 0012, com o tom `positivo` e o sinal `+` dos valores.

## Contracts

### Rotas e navegação

| Rota                   | Conteúdo         | Parâmetros de busca (zod)                                     |
| ---------------------- | ---------------- | ------------------------------------------------------------- |
| `/receitas`            | lista do mês     | `mes`, `status`, `tipo`, `conta`, `natureza`, `grupo`, `novo` |
| `/receitas/$receitaId` | detalhe e ações  | `editar`, `receber`, `excluir`                                |
| `/receitas/tipos`      | tipos de receita | `arquivados`, `novo`, `editar`                                |

- Navegação: `{ to: '/receitas', label: 'Receitas', icon: ArrowUp, profiles: [todos], slot: 'barra' }`.
- Código em `src/features/earnings/`.

### Lista — `/receitas`

Igual à de despesas (spec 0012), com estas diferenças:

- consulta `GET /earnings` com `from`/`to` = `monthRange(mes)` e `status`, `kind`, `earningTypeId`, `bankAccountId`, `installmentGroupId`;
- o filtro de meio é só de conta;
- resumo: total do mês e "n recebidas · n pendentes · n atrasadas";
- coluna Conta (rótulo por `useAccountLookup`); valor com `sign="always"` positivo (`+R$`) e `tone="auto"`;
- **Nova receita** e **Tipos de receita** com `entries.write`.

### Formulário de receita

Os campos da spec 0012, com estas diferenças:

| Campo                   | Diferença                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Conta (`bankAccountId`) | `SelectField` só de contas ativas; **alterável** (`PATCH` aceita); numa parcela, a nota "A conta muda em todas as parcelas não recebidas." |
| Data (`occurredOn`)     | rótulo "Data prevista"                                                                                                                     |
| Fatura de               | não existe                                                                                                                                 |
| Descrição               | máximo de 200 caracteres (contrato)                                                                                                        |
| Observações             | máximo de 1000 caracteres (contrato)                                                                                                       |
| Valor                   | alterável, exceto receita `RECEIVED`                                                                                                       |

- **Criar:** `POST /earnings` (resposta em lista), `Notice` e navegação para o detalhe da primeira.
- **Alterar:** `PATCH /earnings/{id}` só com os campos alterados; série pergunta **Só esta** / **Esta e as próximas previstas** (`?scope=following`).
- `invalidateAfter(..., 'earning')`.

### Detalhe e ações — `/receitas/$receitaId`

| Status atual      | Ações (com `entries.write`)                                                                |
| ----------------- | ------------------------------------------------------------------------------------------ |
| `FORECAST`        | **Confirmar** (→ `OPEN`)                                                                   |
| `OPEN`, `OVERDUE` | **Receber** (→ `RECEIVED`), **Marcar para verificar** (→ `VERIFYING`)                      |
| `VERIFYING`       | **Receber**, **Voltar para pendente** (→ `OPEN`)                                           |
| `RECEIVED`        | **Desfazer recebimento** (→ `OPEN`, com `ConfirmDialog`: "O valor sai do saldo da conta.") |

- **Receber:** `FormDialog` com `receivedOn` (padrão `today()`) → `PATCH /earnings/{id}/status` `{ status: 'RECEIVED', receivedOn }`.
- **Excluir** (não recebida): `ConfirmDialog` com a cascata (parcelas não recebidas; série: esta e as seguintes, e a série termina) → `DELETE /earnings/{id}`.
- `?receber=1` e `?excluir=1` abrem os diálogos.
- `invalidateAfter(..., 'earning')`.

### Tipos de receita — `/receitas/tipos`

Igual a `/despesas/tipos`, sobre `/earning-types`; `invalidateAfter(..., 'earning-types')`.

### Mapa de erros

| Código                                            | Onde                                     |
| ------------------------------------------------- | ---------------------------------------- |
| `EARNING_TYPE_ARCHIVED`, `EARNING_TYPE_NOT_FOUND` | campo Tipo                               |
| `BANK_ACCOUNT_ARCHIVED`, `BANK_ACCOUNT_NOT_FOUND` | campo Conta                              |
| `EARNING_ALREADY_RECEIVED`                        | alerta; o detalhe é recarregado          |
| `EARNING_STATUS_TRANSITION_NOT_ALLOWED`           | alerta; o detalhe é recarregado          |
| `EARNING_NOT_FOUND`                               | ERR-0009-02 no detalhe; alerta numa ação |
| `EARNING_TYPE_ALREADY_EXISTS`                     | campo nome do tipo                       |

## Invariants

- **INV-0014-01:** valores de receita só entram por `MoneyInput`/`moneySchema` e só aparecem por `Money`, com o sinal `+`.
- **INV-0014-02:** as ações oferecidas num status são exatamente as da tabela de transições.
- **INV-0014-03:** toda exclusão e toda alteração em cascata mostra o efeito antes de enviar.
- **INV-0014-04:** o `PATCH` de receita nunca envia `kind`, `status`, `receivedOn` nem campos de parcela.

## Error cases

| Código      | Situação                    | Comportamento exigido           |
| ----------- | --------------------------- | ------------------------------- |
| ERR-0014-01 | Erros do mapa               | campo ou alerta conforme o mapa |
| ERR-0014-02 | Lista ou detalhe falham     | ERR-0009-01 / ERR-0009-02       |
| ERR-0014-03 | `VALIDATION_ERROR`          | ERR-0009-04                     |
| ERR-0014-04 | Parâmetro de busca inválido | descartado; vale o padrão       |

## Acceptance criteria

- **AC-0014-01:** `/receitas?mes=2026-10` chama `GET /earnings?from=2026-10-01&to=2026-10-31` e mostra as receitas do stub com `+R$`, selo e conta por nome.
- **AC-0014-02:** os filtros de status, tipo, conta e natureza vão para a consulta e para a URL.
- **AC-0014-03:** criar uma fixa de `5.000,00` envia `{ kind: 'FIXED', amountCents: 500000, bankAccountId }` e, com **Repetir até**, `recurrenceEndsOn`.
- **AC-0014-04:** alterar a conta de uma parcela mostra a nota da cascata e envia `bankAccountId` no `PATCH`.
- **AC-0014-05:** **Receber** com a data padrão envia `{ status: 'RECEIVED', receivedOn: <hoje> }`; **Desfazer recebimento** pede confirmação e envia `{ status: 'OPEN' }`.
- **AC-0014-06:** `409 EARNING_ALREADY_RECEIVED` ao alterar o valor mostra a mensagem do catálogo e recarrega o detalhe.
- **AC-0014-07:** com `leitor`, nenhuma ação de escrita aparece e `?novo=1`/`?receber=1` não abrem diálogo.
- **AC-0014-08:** `/receitas/tipos` cria, renomeia e arquiva; `409 EARNING_TYPE_ALREADY_EXISTS` marca o nome.
- **AC-0014-09:** nos três projetos, lista e formulário seguem `EntryList` e `FormDialog`.

## Test mapping

| Item                                             | Teste                                                                            |
| ------------------------------------------------ | -------------------------------------------------------------------------------- |
| AC-0014-01, AC-0014-02, AC-0014-09, INV-0014-01  | `e2e/earnings-list.spec.ts` e `src/features/earnings/list/*.test.tsx`            |
| AC-0014-03, AC-0014-04, INV-0014-04              | `src/features/earnings/form/earning-form.test.tsx` e `e2e/earnings-form.spec.ts` |
| AC-0014-05, AC-0014-06, INV-0014-02, INV-0014-03 | `src/features/earnings/detail/*.test.tsx` e `e2e/earnings-detail.spec.ts`        |
| AC-0014-07                                       | `e2e/earnings-list.spec.ts` e `e2e/earnings-detail.spec.ts` (com `leitor`)       |
| AC-0014-08                                       | `e2e/earning-types.spec.ts`                                                      |

## Open questions

Nenhuma.
