---
id: '0013'
title: Faturas de cartão, pagamentos e estornos
status: implemented
depends_on: ['0008', '0009', '0011', '0012']
---

# 0013 — Faturas de Cartão, Pagamentos e Estornos

## Goal

Levar o F004 para a tela: em cada cartão, a fatura aberta de hoje e as anteriores com o resumo por tipo, o detalhe de despesas, estornos e pagamentos, o pagamento (total, mínimo ou outro valor, antecipado ou depois do fechamento), o desfazer do último pagamento, o mínimo informado pelo usuário e os estornos — com os valores e a situação (fechada, vencida, paga, rolada) sempre os que o backend calcula.

## Scope / Non-goals

- **Em escopo:** o painel de faturas em `/cartoes/$cartaoId` (rota da spec 0011), `/cartoes/$cartaoId/faturas/$faturaId`, os diálogos de pagamento, de desfazer pagamento, de mínimo e de estorno (criar, alterar descrição e observações, excluir).
- **Fora de escopo:** juros e encargos (o backend não calcula); cálculo de mínimo (é informado); visão de faturas de todos os cartões juntos (o dashboard, spec 0015, faz a sua); cadastro do cartão (spec 0011); pagamento de despesa de cartão uma a uma (não existe: é pela fatura).
- **Depende do backend:** [spec 0013](https://github.com/bhenriq-souza/finances-control-backend/blob/develop/specs/0013-statements.md) na tag `v1.1.0`. Escrita (pagar, desfazer, mínimo, estornos): `ADMIN` e `BILLER`; leitura: todos.
- **Lacunas do contrato `v1.1.0`** (o frontend trata pelo `code`; a correção, quando houver, é do backend, numa tag nova): `UpdateStatement` não é anulável, então a tela só informa e troca o mínimo, sem **Remover mínimo**. **Limite aceito:** a visão de faturas de todos os cartões faz uma chamada por cartão (não há rota agregada).
- **Forma visual:** padrão de **lançamento** da spec 0009 e o detalhe de fatura do [canvas de padrões](https://claude.ai/artifact/YA6oWvBzWghdVTa2kAFTkC).

## Contracts

### Rotas

| Rota                                   | Conteúdo                                    | Parâmetros de busca                               |
| -------------------------------------- | ------------------------------------------- | ------------------------------------------------- |
| `/cartoes/$cartaoId`                   | resumo do cartão (0011) + painel de faturas | `pagar`, `estorno`, `despesa` (id, com `estorno`) |
| `/cartoes/$cartaoId/faturas/$faturaId` | fatura persistida com o detalhe             | `pagar`, `minimo`, `estorno`                      |

- A rota `/cartoes/$cartaoId` compõe `CardSummary` (accounts) e `StatementsPanel` (statements); nenhuma feature importa a outra.
- Código em `src/features/statements/`.

### Painel de faturas

- **Fatura atual:** `GET /statements/current?creditCardId=…` (chave `['statements', 'current', id]`). Mostra o período (`startsOn`–`closesOn`), "Fecha em" e "Vence em", o selo, e os valores abaixo.
- **Faturas anteriores:** `GET /statements?creditCardId=…` sem janela (as fechadas dos últimos 12 meses e a aberta), em ordem decrescente de `closesOn`, sem a aberta; cada linha com mês de fechamento, vencimento, selo, `amountDueCents` e `remainingCents`, e link para o detalhe.
- **Próximas faturas:** `GET /statements?creditCardId=…&from=<amanhã do closesOn atual>&to=<+12 meses>`: as projetadas (parcelas futuras), sem link (não têm `id`), com mês e `totalCents`.

### Valores e detalhe da fatura

| Rótulo           | Campo                  | Observação                      |
| ---------------- | ---------------------- | ------------------------------- |
| Compras          | `purchasesCents`       |                                 |
| Estornos         | `refundsCents`         | com `−`                         |
| Saldo anterior   | `previousBalanceCents` | só quando diferente de zero     |
| Total da fatura  | `amountDueCents`       | `valor-destaque`                |
| Pago             | `paidCents`            |                                 |
| Restante         | `remainingCents`       | tom `negativo` quando `overdue` |
| Mínimo informado | `minimumPaymentCents`  | "Não informado" quando `null`   |

- Selo pela tabela da spec 0009 (com **Vencida** por `overdue` e **Vence hoje** por `dueOn`).
- **Por tipo:** `byExpenseType` em `BarList`.
- **Despesas** (`expenses`): `EntryList` com data, descrição, parcela, tipo, selo e valor; cada linha leva a `/despesas/$despesaId`.
- **Estornos** (`refunds`): data, descrição, valor com `+`; com `entries.write`, **Editar** e **Excluir**.
- **Pagamentos** (`payments`): data, conta por `useAccountLookup`, valor; com `entries.write`, **Desfazer** só no último.

### Pagar

`FormDialog` aberto por **Pagar fatura** (com `entries.write`, quando `remainingCents > 0` e o status não é `PAID` nem `ROLLED_OVER`) ou por `?pagar=1`:

- **Valor:** rádios **Total restante** (`remainingCents`), **Mínimo** (só com `minimumPaymentCents` informado e maior que `paidCents`; vale `minimumPaymentCents − paidCents`) e **Outro valor** (`MoneyInput`, `moneySchema()`, até `remainingCents`).
- **Conta:** `SelectField` de contas ativas, padrão a `paymentBankAccountId` do cartão; sem conta pagadora, obrigatório.
- **Data** (`paidOn`): padrão `today()`; na fatura fechada, depois de `closesOn` e até hoje; na aberta, de `startsOn` até hoje.
- Fatura aberta: `POST /statements/current/payments` `{ creditCardId, bankAccountId?, amountCents, paidOn? }`; fechada: `POST /statements/{id}/payments` `{ bankAccountId?, amountCents, paidOn? }`.
- `invalidateAfter(..., 'statement')`; `Notice` "Pagamento registrado.".

### Desfazer pagamento

`ConfirmDialog` ("O valor volta para a conta e a fatura fica com o restante de novo.") → `DELETE /statements/{id}/payments/{paymentId}` ou, na aberta, `DELETE /statements/current/payments/{paymentId}?creditCardId=…`.

### Mínimo

Na fatura persistida, **Informar mínimo** (com `entries.write`): `FormDialog` com `MoneyInput` (`moneySchema({ min: 'nonnegative' })`) → `PATCH /statements/{id}` `{ minimumPaymentCents }`. Ajuda: "O valor mínimo que o banco cobra. O sistema não calcula o mínimo; ele só decide quando a fatura fica vencida."

### Estornos

- **Novo estorno** (com `entries.write`) no painel e no detalhe, e por `?estorno=1[&despesa=<id>]` (a tela da despesa leva até aqui):
    - `description` (até 200), `amountCents` (`moneySchema()`), `occurredOn` (padrão `today()`), `postedOn` (opcional; ajuda "Deixe vazio para a fatura do dia."), despesa de origem (opcional: `SelectField` com as despesas da fatura atual e da última fechada; pré-selecionada por `despesa`; se essa despesa não está nessas duas faturas, ela é lida por `GET /expenses/{id}` e entra num grupo próprio quando é deste cartão, senão `despesa` é ignorada), `notes` (até 1000);
    - `POST /credit-card-refunds` com `creditCardId`.
- **Editar:** só `description` e `notes` → `PATCH /credit-card-refunds/{id}`.
- **Excluir:** `ConfirmDialog` → `DELETE /credit-card-refunds/{id}`.
- `invalidateAfter(..., 'refund')`.

### Mapa de erros

| Código                                                                               | Onde / comportamento                                                                                                                                               |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `STATEMENT_PAYMENT_EXCEEDS_REMAINING`                                                | campo Valor; a fatura é recarregada para mostrar o restante atual                                                                                                  |
| `STATEMENT_ALREADY_PAID`, `STATEMENT_ROLLED_OVER`                                    | alerta; a fatura é recarregada                                                                                                                                     |
| `STATEMENT_PREVIOUS_UNPAID`                                                          | alerta com a mensagem do catálogo e o link para a fatura fechada mais antiga com `remainingCents > 0`, achada na lista já carregada (nunca pelo texto da mensagem) |
| `STATEMENT_PAYMENT_LOCKED`                                                           | alerta                                                                                                                                                             |
| `BANK_ACCOUNT_ARCHIVED`, `BANK_ACCOUNT_NOT_FOUND`                                    | campo Conta                                                                                                                                                        |
| `STATEMENT_CLOSED`                                                                   | campo `postedOn` do estorno (ou alerta, ao excluir)                                                                                                                |
| `REFUND_EXPENSE_MISMATCH`                                                            | campo Despesa de origem                                                                                                                                            |
| `REFUND_EXCEEDS_EXPENSE`                                                             | campo Valor do estorno                                                                                                                                             |
| `STATEMENT_NOT_FOUND`, `CREDIT_CARD_REFUND_NOT_FOUND`, `STATEMENT_PAYMENT_NOT_FOUND` | ERR-0009-02 no detalhe; alerta e recarga numa ação                                                                                                                 |

## Invariants

- **INV-0013-01:** nenhum valor de fatura é calculado no cliente, exceto o "Mínimo" do pagamento (`minimumPaymentCents − paidCents`); todo o resto vem da resposta.
- **INV-0013-02:** **Desfazer** só é oferecido no último pagamento da fatura.
- **INV-0013-03:** a fatura projetada (sem `id`) nunca tem link nem ação.
- **INV-0013-04:** o texto da mensagem do backend nunca é lido nem mostrado, nem para achar a fatura pendente.

## Error cases

| Código      | Situação                                          | Comportamento exigido                |
| ----------- | ------------------------------------------------- | ------------------------------------ |
| ERR-0013-01 | Erros do mapa                                     | campo ou alerta conforme o mapa      |
| ERR-0013-02 | Painel ou detalhe falham                          | ERR-0009-01 / ERR-0009-02, por bloco |
| ERR-0013-03 | `VALIDATION_ERROR` (ex.: `paidOn` fora da janela) | ERR-0009-04                          |

## Acceptance criteria

- **AC-0013-01:** `/cartoes/$cartaoId` mostra a fatura atual do stub com período, vencimento, valores e o por tipo, as anteriores em ordem decrescente com selo e link, e as próximas sem link.
- **AC-0013-02:** o detalhe de uma fatura fechada mostra despesas, estornos e pagamentos, e cada despesa leva ao detalhe dela.
- **AC-0013-03:** **Pagar fatura** com **Total restante** numa fechada envia `POST /statements/{id}/payments` com `amountCents` igual a `remainingCents` e a conta pagadora padrão; na aberta, `POST /statements/current/payments` com `creditCardId`.
- **AC-0013-04:** **Mínimo** só aparece com mínimo informado e envia `minimumPaymentCents − paidCents`.
- **AC-0013-05:** `409 STATEMENT_PREVIOUS_UNPAID` mostra o alerta com o link para a fatura fechada pendente; `409 STATEMENT_PAYMENT_EXCEEDS_REMAINING` marca o valor.
- **AC-0013-06:** **Desfazer** existe só no último pagamento e envia o `DELETE` da rota certa (aberta ou fechada).
- **AC-0013-07:** **Informar mínimo** envia `PATCH /statements/{id}` com o valor em centavos.
- **AC-0013-08:** **Novo estorno** a partir de `?estorno=1&despesa=<id>` vem com a despesa selecionada e envia `expenseId`; `409 REFUND_EXCEEDS_EXPENSE` marca o valor.
- **AC-0013-09:** com `leitor`, nenhuma ação de escrita aparece.
- **AC-0013-10:** nos três projetos, o painel e o detalhe seguem o `EntryList` e os diálogos o `FormDialog`.
- **AC-0013-11:** **Estornar** no detalhe de uma despesa de cartão de uma fatura mais antiga que a última fechada abre o **Novo estorno** com essa despesa selecionada; uma `despesa` de outro cartão é ignorada.

## Test mapping

| Item                                                                                 | Teste                                                                           |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| AC-0013-01, AC-0013-02, INV-0013-01, INV-0013-03                                     | `e2e/statements.spec.ts` e `src/features/statements/panel/*.test.tsx`           |
| AC-0013-03, AC-0013-04, AC-0013-05, AC-0013-06, AC-0013-07, INV-0013-02, INV-0013-04 | `src/features/statements/payment/*.test.tsx` e `e2e/statement-payments.spec.ts` |
| AC-0013-08, AC-0013-11                                                               | `src/features/statements/refunds/*.test.tsx` e `e2e/refunds.spec.ts`            |
| AC-0013-09, AC-0013-10                                                               | `e2e/statements.spec.ts` (com `leitor`)                                         |

## Open questions

Nenhuma.
