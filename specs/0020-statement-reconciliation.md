---
id: '0020'
title: Conferência da fatura
status: draft
depends_on: ['0009', '0013']
---

# 0020 — Conferência da Fatura

## Goal

Conferir a fatura de um cartão com a fatura do app do banco direto na tela da fatura, como a
coluna "Incluído" da planilha antiga fazia. Cada despesa tem um botão verde **Incluída**, que o
responsável toca quando a encontra no banco. A fatura mostra quanto já foi conferido e quanto
falta. O conferido é o número que precisa bater com o app do banco. Uma despesa prevista que
acabou de cair é confirmada e marcada com o mesmo toque.

## Scope / Non-goals

- **Em escopo:**
    - os valores **Conferido** e **Falta conferir**, na fatura atual do painel
      (`/cartoes/$cartaoId`) e no detalhe da fatura persistida (`/cartoes/$cartaoId/faturas/$faturaId`);
    - o botão **Incluída** em cada despesa dessas duas telas;
    - o filtro **Só o que falta conferir**;
    - o contrato da tag nova do backend em `sources.json`;
    - a mensagem do código novo `EXPENSE_NOT_ON_CREDIT_CARD` no catálogo.
- **Fora de escopo:**
    - marcar na tela da despesa (`/despesas/$despesaId`) ou na lista de despesas;
    - marcar várias despesas num toque só, porque a API não tem essa rota;
    - estornos, que contam sempre como conferidos (backend, INV-0020-04);
    - as faturas projetadas (**Próximas faturas**), que não têm detalhe.
- **Depende do backend:**
    - [spec 0020](https://github.com/bhenriq-souza/finances-control-backend/blob/develop/specs/0020-statement-reconciliation.md)
      na tag `v1.4.0`, que será criada com o ok do responsável;
    - escrita por `ADMIN` e `BILLER`, leitura por todos.
- **Forma visual:**
    - padrão de **lançamento** da spec 0009 e o detalhe de fatura do
      [canvas de padrões](https://claude.ai/artifact/YA6oWvBzWghdVTa2kAFTkC);
    - o botão usa só tokens existentes, a família `positivo`.

## Contracts

### Rotas

| Rota                                   | Parâmetros de busca novos                                  |
| -------------------------------------- | ---------------------------------------------------------- |
| `/cartoes/$cartaoId`                   | `conferir` (`1` liga o filtro **Só o que falta conferir**) |
| `/cartoes/$cartaoId/faturas/$faturaId` | `conferir`                                                 |

O código fica em `src/features/statements/`. A rota de escrita é do backend `expenses`, mas a
tela é a da fatura. O botão chama a API pelo cliente gerado, sem importar a feature `expenses`.

### Valores

A tabela de valores da spec 0013 ganha duas linhas, depois de **Total da fatura**:

| Rótulo         | Campo                        | Observação                                                         |
| -------------- | ---------------------------- | ------------------------------------------------------------------ |
| Conferido      | `reconciledCents`            | ajuda: "Some as despesas marcadas. Deve bater com o app do banco." |
| Falta conferir | `pendingReconciliationCents` | tom `atencao` quando maior que zero                                |

As duas linhas aparecem na fatura atual e no detalhe da fatura persistida, e não aparecem na
lista de faturas anteriores nem nas próximas.

### Botão **Incluída**

Fica na coluna `actions` do `EntryList` de **Despesas** (spec 0009). Na tabela, é a última
coluna; no cartão do celular, fica no canto superior direito. Tocar nele nunca navega para a
despesa.

| Estado da despesa               | Com `entries.write`                                                                                                                                            | Sem `entries.write`                     |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| sem marca (`reconciledAt` nulo) | botão de contorno com o ícone `Check`, `aria-pressed="false"`, rótulo acessível "Marcar como incluída"                                                         | nada                                    |
| marcada                         | botão cheio em `positivo` com o ícone `Check` e o texto **Incluída** (só o ícone abaixo de `md`), `aria-pressed="true"`, rótulo acessível "Desmarcar incluída" | selo **Incluída** na família `positivo` |

- O alvo de toque tem pelo menos 44px nos três tamanhos de tela.
- **Requisição:** `PATCH /expenses/{id}/reconciliation` com `{ reconciled: !marcada }`. Enquanto
  a requisição corre, o botão fica desabilitado com `aria-busy="true"`, e os outros continuam
  livres.
- **Depois do sucesso:** `invalidateAfter(..., 'expense')`. A linha do domínio `expense` da spec
  0009 já recarrega faturas, cartões e despesas. Os valores mudam pela resposta recarregada.
- **Despesa `FORECAST`:** o mesmo botão marca e confirma (backend, `FORECAST → OPEN`). Ao
  terminar, aparece o `Notice` "Despesa confirmada e incluída.". Marcar ou desmarcar as demais não
  mostra aviso, porque a mudança do botão já é a resposta.

### Filtro **Só o que falta conferir**

- É um interruptor acima da lista de **Despesas**, ligado a `conferir=1`. Mostra só as despesas
  com `reconciledAt` nulo, inclusive as `FORECAST`.
- Sem nenhuma despesa a conferir, aparece o `EmptyState` "Tudo conferido nesta fatura.".
- O filtro só esconde linhas e nunca muda os valores, que vêm sempre da resposta.

### Mapa de erros

| Código                       | Onde / comportamento                                                  |
| ---------------------------- | --------------------------------------------------------------------- |
| `STATEMENT_CLOSED`           | alerta com a mensagem do catálogo; a fatura é recarregada             |
| `EXPENSE_NOT_FOUND`          | alerta; a fatura é recarregada                                        |
| `EXPENSE_NOT_ON_CREDIT_CARD` | alerta. Não deve acontecer, porque toda despesa da fatura é de cartão |
| `FORBIDDEN`                  | regra da spec 0009 (invalida `['users', 'me']`)                       |

Catálogo novo: `EXPENSE_NOT_ON_CREDIT_CARD` → "Só despesas de cartão podem ser conferidas com a
fatura.".

## Invariants

- **INV-0020-01:** **Conferido** e **Falta conferir** vêm da resposta e nunca são somados no
  cliente (extensão do INV-0013-01).
- **INV-0020-02:** o botão **Incluída** só é renderizado com `entries.write`, e tocar nele nunca
  navega para a despesa.
- **INV-0020-03:** o filtro decide só por `reconciledAt`, nunca pelo status nem pelo valor.

## Error cases

| Código      | Situação           | Comportamento exigido     |
| ----------- | ------------------ | ------------------------- |
| ERR-0020-01 | Erros do mapa      | alerta conforme o mapa    |
| ERR-0020-02 | Fatura não carrega | ERR-0009-01 / ERR-0009-02 |

## Acceptance criteria

- **AC-0020-01:** a fatura atual do stub mostra **Conferido** e **Falta conferir** com os valores
  da resposta. **Falta conferir** fica no tom `atencao` quando é maior que zero.
- **AC-0020-02:** tocar no botão de uma despesa sem marca envia `PATCH
/expenses/{id}/reconciliation` com `{ reconciled: true }`, e depois a fatura é recarregada.
  Numa despesa marcada, envia `{ reconciled: false }`.
- **AC-0020-03:** tocar no botão de uma despesa `FORECAST` envia `{ reconciled: true }` e mostra o
  aviso "Despesa confirmada e incluída.".
- **AC-0020-04:** `409 STATEMENT_CLOSED` mostra o alerta do catálogo e recarrega a fatura.
- **AC-0020-05:** com `leitor`, nenhum botão aparece, e as despesas marcadas mostram o selo
  **Incluída**.
- **AC-0020-06:** **Só o que falta conferir** deixa só as despesas sem marca. Abrir a tela com
  `?conferir=1` já vem com o filtro ligado.
- **AC-0020-07:** nos três projetos, o botão tem alvo de pelo menos 44px e tocar nele não abre o
  detalhe da despesa.
- **AC-0020-08:** `sources.json` aponta para a tag `v1.4.0` do backend, e o catálogo traduz
  `EXPENSE_NOT_ON_CREDIT_CARD`.

## Test mapping

| Item                                            | Teste                                                                                        |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------- |
| AC-0020-01, INV-0020-01                         | `src/features/statements/panel/statements-panel.test.tsx`                                    |
| AC-0020-02, AC-0020-03, AC-0020-04, INV-0020-02 | `src/features/statements/reconciliation/*.test.tsx`                                          |
| AC-0020-05, AC-0020-06, INV-0020-03             | `src/features/statements/reconciliation/*.test.tsx` e `e2e/statement-reconciliation.spec.ts` |
| AC-0020-07                                      | `e2e/statement-reconciliation.spec.ts` (três projetos)                                       |
| AC-0020-08                                      | gate de contrato (spec 0002) e `src/api/errors/catalog.test.ts`                              |

## Open questions

Nenhuma.
