---
id: '0017'
title: Séries fixas de despesas e receitas
status: approved
depends_on: ['0009', '0012', '0014']
---

# 0017 — Séries Fixas de Despesas e Receitas

## Goal

Dar um lugar às séries que as despesas e receitas fixas criam: ver quais estão ativas, quanto e quando cada uma lança, a próxima ocorrência, e encerrar uma série ("este é o último mês") — o que exclui as ocorrências previstas posteriores, como o backend define.

## Scope / Non-goals

- **Em escopo:** `/series`, `/series/despesas/$serieId`, `/series/receitas/$serieId`, o diálogo de encerrar, o link da ocorrência para a série no detalhe de despesa e de receita, e o item **Séries fixas** da navegação.
- **Fora de escopo:** alterar o modelo da série (é pelo `?scope=following` de uma ocorrência, specs 0012 e 0014); criar série (é lançar uma despesa ou receita fixa); séries não mensais; transferências recorrentes (a API não tem).
- **Depende do backend:** [spec 0017](https://github.com/bhenriq-souza/finances-control-backend/blob/develop/specs/0017-jobs-and-recurrence.md) na tag `v1.1.0` — `GET`/`PATCH /expense-recurrences`, `GET`/`PATCH /earning-recurrences`. Encerrar: `ADMIN` e `BILLER`.
- **Limite aceito:** `GET /expenses` e `GET /earnings` não filtram por `recurrenceId`; o detalhe busca o período da série e filtra no cliente.
- **Forma visual:** padrão de **lançamento** da spec 0009 e o [canvas de padrões](https://claude.ai/artifact/YA6oWvBzWghdVTa2kAFTkC).

## Contracts

### Rotas e navegação

| Rota                        | Conteúdo                                  | Parâmetros de busca                            |
| --------------------------- | ----------------------------------------- | ---------------------------------------------- |
| `/series`                   | séries de despesas e de receitas, em abas | `aba` (`despesas` \| `receitas`), `encerradas` |
| `/series/despesas/$serieId` | detalhe da série de despesa               | `encerrar`                                     |
| `/series/receitas/$serieId` | detalhe da série de receita               | `encerrar`                                     |

- Navegação: `{ to: '/series', label: 'Séries fixas', icon: Repeat, profiles: [todos], slot: 'mais' }`.
- A rota `/series` compõe `ExpenseRecurrences` (de `expenses`) e `EarningRecurrences` (de `earnings`); o código de cada aba vive na sua feature.

### Lista

- `GET /expense-recurrences?active=true` (ou sem `active`, com **Mostrar encerradas**), e o mesmo para receitas; ordem da API (mais novas primeiro).
- `EntryList`: descrição, tipo (nome achado em `useExpenseTypes`/`useEarningTypes` por `typeId`, porque a série só traz o id), "Todo dia `dayOfMonth`", conta ou cartão por lookup, próxima ocorrência (`nextOccurrenceOn`), fim (`endsOn` ou "Sem fim"), valor com o sinal do domínio.

### Detalhe

- `GET /expense-recurrences/{id}` ou `/earning-recurrences/{id}`, com os campos da série.
- **Ocorrências:** `GET /expenses` (ou `/earnings`) com `from` = `startsOn` e `to` = `endsOn` ou o fim do 12º mês a partir de hoje, filtradas no cliente por `recurrenceId` (a API não filtra por série), em ordem de data, com selo e link para o detalhe da ocorrência.
- **Encerrar série** (com `entries.write`, série sem `endsOn` passado): `FormDialog` com "Último mês" (`DateField` `endsOn`, padrão o fim do mês corrente, não anterior a `startsOn`) e o texto "As ocorrências previstas depois desta data serão excluídas. As já confirmadas, pagas ou recebidas ficam." → `PATCH /…-recurrences/{id}` `{ endsOn }`. `invalidateAfter(..., 'expense-recurrence' | 'earning-recurrence')`.

### Link da ocorrência

O detalhe de despesa (spec 0012) e o de receita (spec 0014) ganham, quando há `recurrenceId`, o link **Ver série** para `/series/despesas/$serieId` ou `/series/receitas/$serieId`.

### Mapa de erros

| Código                                                         | Onde                                      |
| -------------------------------------------------------------- | ----------------------------------------- |
| `EXPENSE_RECURRENCE_NOT_FOUND`, `EARNING_RECURRENCE_NOT_FOUND` | ERR-0009-02 no detalhe; alerta no diálogo |
| `VALIDATION_ERROR` em `endsOn`                                 | campo Último mês                          |

## Invariants

- **INV-0017-01:** a série nunca é alterada além de `endsOn`.
- **INV-0017-02:** o encerramento mostra o efeito (exclusão das previstas posteriores) antes de enviar.
- **INV-0017-03:** a lista de ocorrências de uma série contém só lançamentos com o `recurrenceId` dela.

## Error cases

| Código      | Situação                | Comportamento exigido           |
| ----------- | ----------------------- | ------------------------------- |
| ERR-0017-01 | Erros do mapa           | campo ou alerta conforme o mapa |
| ERR-0017-02 | Lista ou detalhe falham | ERR-0009-01 / ERR-0009-02       |

## Acceptance criteria

- **AC-0017-01:** `/series` mostra as séries ativas de despesas na aba padrão e as de receitas na outra, com o nome do tipo achado pelo `typeId`.
- **AC-0017-02:** o detalhe lista só as ocorrências com o `recurrenceId` da série, mesmo com o stub devolvendo outras no período.
- **AC-0017-03:** **Encerrar série** envia `PATCH` só com `{ endsOn }` e mostra antes o texto do efeito.
- **AC-0017-04:** o detalhe de uma despesa e o de uma receita de série mostram **Ver série** com o link certo.
- **AC-0017-05:** com `leitor`, **Encerrar série** não aparece; nos três projetos a lista segue o `EntryList`.

## Test mapping

| Item                                 | Teste                                                                                        |
| ------------------------------------ | -------------------------------------------------------------------------------------------- |
| AC-0017-01, AC-0017-05               | `e2e/recurrences.spec.ts`                                                                    |
| AC-0017-02, INV-0017-03              | `src/features/expenses/recurrences/recurrence-detail.test.tsx` e o equivalente em `earnings` |
| AC-0017-03, INV-0017-01, INV-0017-02 | `src/features/expenses/recurrences/end-recurrence.test.tsx` e `e2e/recurrences.spec.ts`      |
| AC-0017-04                           | `e2e/recurrences.spec.ts`                                                                    |

## Open questions

Nenhuma.
