---
id: '0012'
title: Despesas e tipos de despesa
status: implemented
depends_on: ['0008', '0009', '0011']
---

# 0012 — Despesas e Tipos de Despesa

## Goal

Levar o F003 para a tela: ver as despesas de um mês com os filtros que a API oferece, lançar despesa variável, parcelada ou fixa numa conta ou num cartão, alterar e excluir com o escopo certo para parcelas e séries, mudar o status (pagar, verificar, desfazer), trocar a forma de pagamento e manter os tipos de despesa — sempre com o dinheiro em centavos e o efeito no saldo e no limite decidido pelo backend.

## Scope / Non-goals

- **Em escopo:** `/despesas`, `/despesas/$despesaId`, `/despesas/tipos`; o formulário de despesa (criar e alterar); os diálogos de status, de exclusão e de troca de forma de pagamento; o item **Despesas** da navegação.
- **Fora de escopo:** pagamento de despesa de cartão (é pela fatura, spec 0013); a lista de séries e o encerramento de série (spec 0017; aqui só o `scope=following` de uma ocorrência e o link para a série); estornos (spec 0013; aqui só o link **Estornar**); busca por texto e ordenação no servidor (a API não oferece); importação CSV.
- **Depende do backend:** [spec 0012](https://github.com/bhenriq-souza/finances-control-backend/blob/develop/specs/0012-expenses.md) e, para séries, a [0017](https://github.com/bhenriq-souza/finances-control-backend/blob/develop/specs/0017-jobs-and-recurrence.md), na tag `v1.1.0`. Escrita: `ADMIN` e `BILLER`; leitura: todos.
- **Limites da API aceitos:** o filtro `status` aceita um valor só, e a lista mantém um status por vez (o dashboard, spec 0015, faz as duas consultas); sem busca nem totais no servidor, o resumo do mês soma no cliente a lista carregada, que é completa por não haver paginação.
- **Forma visual:** padrão de **lançamento** da spec 0009, o [canvas de padrões](https://claude.ai/artifact/YA6oWvBzWghdVTa2kAFTkC) e a tabela "Vence esta semana" do [dashboard](https://claude.ai/artifact/HEj1d1jqqwAPMBVYZdMsyy).

## Contracts

### Rotas e navegação

| Rota                   | Conteúdo         | Parâmetros de busca (zod)                                                                                                                                                                    |
| ---------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/despesas`            | lista do mês     | `mes` (`YYYY-MM`, padrão o de `today()`), `status`, `tipo`, `conta`, `cartao`, `natureza`, `grupo`, `novo`, `pagar`, `editar`, `excluir`, `desfazer` (os quatro últimos com o id da despesa) |
| `/despesas/$despesaId` | detalhe e ações  | `editar`, `pagar`, `excluir`, `meio`                                                                                                                                                         |
| `/despesas/tipos`      | tipos de despesa | `arquivados`, `novo`, `editar`                                                                                                                                                               |

- Navegação: `{ to: '/despesas', label: 'Despesas', icon: ArrowDown, profiles: [todos], slot: 'barra' }`.
- `novo`, `editar`, `pagar`, `excluir`, `desfazer` e `meio` só têm efeito com `entries.write`.
- Código em `src/features/expenses/`.

### Lista — `/despesas`

- **Consulta:** `GET /expenses` com `from`/`to` = `monthRange(mes)` e, quando presentes, `status`, `kind` (de `natureza`), `expenseTypeId` (de `tipo`), `bankAccountId` (de `conta`), `creditCardId` (de `cartao`), `installmentGroupId` (de `grupo`; com `grupo`, o mês é ignorado e a lista mostra o grupo inteiro). Chave `queryKeys.expenses.list(filtros)`.
- **Filtros:** navegação de mês (‹ outubro de 2026 ›), e um painel **Filtros** (folha no celular, linha de selects no tablet e no desktop) com status (um só, como a API), tipo, conta ou cartão (um `SelectField` com os grupos "Contas" e "Cartões"), natureza (Variável, Parcelada, Fixa). Filtro ativo aparece como etiqueta removível. Tudo na URL.
- **Ordem:** `occurredOn` crescente, depois `description` (no cliente).
- **Resumo** acima da lista: total do mês (soma de `amountCents` da lista) e as contagens "n pagas · n pendentes · n vencidas". **Pendentes** são as de status `OPEN`, `FORECAST` e `VERIFYING`, então as três contagens somam o número de itens (decisão do responsável em 2026-10-12).
- **`EntryList`:**

| Coluna         | Conteúdo                                                                             |
| -------------- | ------------------------------------------------------------------------------------ |
| Data           | `occurredOn` em `formatDate(…, 'relativa')`                                          |
| Descrição      | `description`; no apoio, "Parcela n de N" (`installment`) ou "Fixa" (`recurrenceId`) |
| Tipo           | `expenseType.name`; só no desktop                                                    |
| Conta / cartão | rótulo por `useAccountLookup`/`useCardLookup`                                        |
| Status         | `StatusBadge` (com o derivado **Vence hoje**)                                        |
| Valor          | `Money` de `amountCents` com `sign="always"` negado (`−R$`) e `tone="auto"`          |

- O cartão do celular segue o do dashboard: descrição e valor na primeira linha; data, conta/cartão e selo na segunda.
- Com `entries.write`: **Nova despesa** (botão fixo no cabeçalho; no celular, botão flutuante acima da barra inferior) e o link **Tipos de despesa**.
- **Ações rápidas** (decisão do responsável em 2026-10-13): com `entries.write`, cada linha tem um `RowMenu` (`actions` do `EntryList`, rótulo "Ações de <descrição>") com, nesta ordem: as transições do status pela tabela do detalhe (**Pagar**, **Confirmar**, **Marcar para verificar**, **Voltar para pendente**, **Desfazer pagamento**), **Editar** e, se não paga, **Excluir**. **Trocar forma de pagamento** e **Estornar** ficam só no detalhe.
    - **Pagar**, **Editar**, **Excluir** e **Desfazer pagamento** abrem, sobre a própria lista, os mesmos diálogos do detalhe, endereçáveis por `?pagar=<id>`, `?editar=<id>`, `?excluir=<id>` e `?desfazer=<id>` (a despesa é lida por `GET /expenses/{id}`); id desconhecido ou ação que o status não permite é ignorado e o parâmetro removido.
    - **Confirmar**, **Marcar para verificar** e **Voltar para pendente** enviam direto, sem diálogo.
    - Depois do sucesso: `Notice`, o diálogo fecha e a lista fica no mesmo mês e com os mesmos filtros; a lista se atualiza pelo `invalidateAfter`.
    - **Erro:** no diálogo, como no detalhe; numa transição sem diálogo, alerta (`FormAlert`) acima da lista com o nome da despesa e a mensagem do catálogo, até a próxima ação ou o fechar do alerta.

### Formulário de despesa (criar e alterar)

`FormDialog` aberto por `?novo=1` na lista ou `?editar=1` no detalhe. Schema zod em `src/features/expenses/expense-schema.ts`.

| Campo                            | Criar                                                                                         | Alterar                                              | Regras                              |
| -------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------- |
| Natureza (`kind`)                | rádios Variável (padrão) · Parcelada · Fixa                                                   | só leitura                                           | —                                   |
| Descrição                        | texto                                                                                         | sim                                                  | obrigatória, sem espaços nas pontas |
| Tipo (`expenseTypeId`)           | tipos ativos                                                                                  | sim                                                  | obrigatório                         |
| Valor (`amountCents`)            | `MoneyInput`, `moneySchema()`; rótulo "Valor total" em Parcelada                              | sim, exceto despesa `PAID`                           | > 0                                 |
| Pagar com                        | `SelectField` com os grupos Contas e Cartões (ativos); vira `bankAccountId` ou `creditCardId` | só leitura (troca por **Trocar forma de pagamento**) | obrigatório, exatamente um          |
| Data (`occurredOn`)              | `DateField`; rótulo "Vencimento" com conta, "Data da compra" com cartão                       | sim                                                  | obrigatória                         |
| Fatura de (`postedOn`)           | só com cartão, recolhido atrás do link **Lançar em outra fatura** (ver abaixo)                | sim, só com cartão; aberto quando difere da data     | não anterior a `occurredOn`         |
| Parcelas (`installmentTotal`)    | número 2–120, só em Parcelada                                                                 | —                                                    | inteiro                             |
| Repetir até (`recurrenceEndsOn`) | `DateField` opcional, só em Fixa; ajuda "Sem data, a série segue mês a mês."                  | —                                                    | não anterior a `occurredOn`         |
| Situação inicial (`status`)      | `SelectField`: Pendente (`OPEN`, padrão), Previsto (`FORECAST`), Verificando (`VERIFYING`)    | —                                                    | —                                   |
| Observações (`notes`)            | texto longo opcional                                                                          | sim                                                  | —                                   |

- **Fatura do cartão** (decisão do responsável em 2026-10-13): o backend escolhe a fatura pela data da compra e, se ela já fechou, usa a próxima aberta; o campo só serve para lançar em outra fatura. Com um cartão em Pagar com, o formulário mostra o texto "Entra na fatura da data da compra. A fatura atual fecha em dd/mm." (`currentCycle.closesOn` do cartão, pelo lookup) e o link **Lançar em outra fatura**, que abre o `DateField` opcional **Fatura de** com a ajuda "A despesa entra na fatura que contém esta data."; fechado, `postedOn` não é enviado. Ao alterar, o campo já vem aberto quando `postedOn` difere de `occurredOn`. **Trocar forma de pagamento** segue o mesmo desenho.
- **Criar:** `POST /expenses`; a resposta é uma lista. `Notice` "Despesa salva." ou "n despesas criadas." (parcelas ou ocorrências da série); o diálogo fecha e a lista vai para o mês da primeira criada (`?mes=`), sem filtros, para que o lançamento apareça; o detalhe não é aberto (decisão do responsável em 2026-10-13).
- **Alterar:** `PATCH /expenses/{id}` só com os campos alterados. Despesa de série (`recurrenceId`) pergunta, antes de enviar, **Só esta** ou **Esta e as próximas previstas** (`?scope=following`). Parcela: nota "A alteração vale só para esta parcela."
- `invalidateAfter(..., 'expense')`.

### Detalhe e ações — `/despesas/$despesaId`

- `GET /expenses/{id}`, chave `queryKeys.expenses.detail(id)`. Mostra todos os campos da resposta, o selo, a conta ou cartão por lookup, a parcela com o link **Ver todas as parcelas** (`/despesas?grupo=<groupId>`) e, em despesa de cartão, o link para `/cartoes/$cartaoId` ("Paga pela fatura do cartão").
- **Ações**, só com `entries.write`, conforme a tabela de transições do backend:

| Status atual      | Despesa de conta                                                | Despesa de cartão         |
| ----------------- | --------------------------------------------------------------- | ------------------------- |
| `FORECAST`        | **Confirmar** (→ `OPEN`)                                        | **Confirmar** (→ `OPEN`)  |
| `OPEN`, `OVERDUE` | **Pagar** (→ `PAID`), **Marcar para verificar** (→ `VERIFYING`) | **Marcar para verificar** |
| `VERIFYING`       | **Pagar**, **Voltar para pendente** (→ `OPEN`)                  | **Voltar para pendente**  |
| `PAID`            | **Desfazer pagamento** (→ `OPEN`, com `ConfirmDialog`)          | — (paga pela fatura)      |

- **Pagar:** `FormDialog` com `paidOn` (`DateField`, padrão `today()`) → `PATCH /expenses/{id}/status` `{ status: 'PAID', paidOn }`. As demais transições enviam só `{ status }`.
- **Excluir** (não paga): `ConfirmDialog` com o texto da cascata — avulsa: "A despesa será excluída."; parcela: "Todas as parcelas não pagas deste parcelamento serão excluídas."; série: "Esta ocorrência e as seguintes ainda não pagas serão excluídas, e a série termina." → `DELETE /expenses/{id}`, volta para a lista.
- **Trocar forma de pagamento** (não paga): `FormDialog` com "Pagar com" (contas e cartões ativos, exceto o atual) e, se o destino for cartão, `postedOn` opcional, recolhido como no formulário; em série, a mesma escolha **Só esta** / **Esta e as próximas previstas** → `PATCH /expenses/{id}/payment-method[?scope=following]` com exatamente um de `bankAccountId`/`creditCardId`. Parcela: nota "Vale para todas as parcelas não pagas do parcelamento."
- **Estornar** (decisão do responsável, 2026-10-13): em despesa de cartão que não é `FORECAST`, com `entries.write`, um link no grupo de ações, depois das transições, para `/cartoes/$cartaoId?estorno=1&despesa=<id>`. Abre o **Novo estorno** da spec 0013 com a despesa pré-selecionada.
- Cada ação é endereçável: `?pagar=1`, `?excluir=1`, `?meio=1` abrem o diálogo correspondente (o dashboard usa `?pagar=1`).
- **No celular** (abaixo de `md`) (decisão do responsável em 2026-10-13): a primeira ação de transição do status aparece como botão de largura total, e as demais ações (outras transições, **Editar**, **Trocar forma de pagamento**, **Estornar**, **Excluir**) num `RowMenu` com `trigger="texto"` (**Mais ações**) logo abaixo. A partir de `md`, os botões como hoje.
- **Erro de uma ação** (decisão do responsável, 2026-10-13, padrão de despesas e receitas): sempre em alerta (`role="alert"`, mensagem do catálogo), nunca em aviso. Transição sem diálogo: o alerta aparece abaixo dos botões de ação. Ação com diálogo: o alerta fica no diálogo, que continua aberto, também quando um conflito de status recarrega o detalhe e a ação deixa de existir.
- Toda ação: `invalidateAfter(..., 'expense')`.

### Tipos de despesa — `/despesas/tipos`

Padrão de **cadastro**: `EntryList` por `name`, selo **Arquivado**; com `entries.write`, **Novo tipo**, **Renomear**, **Arquivar**/**Desarquivar** (`/expense-types`, `/expense-types/{id}`, `/expense-types/{id}/archive`). `invalidateAfter(..., 'expense-types')`.

### Mapa de erros (`applyApiError` e ações)

| Código                                                                                             | Onde                                                                                       |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `EXPENSE_TYPE_ARCHIVED`, `EXPENSE_TYPE_NOT_FOUND`                                                  | campo Tipo                                                                                 |
| `BANK_ACCOUNT_ARCHIVED`, `CREDIT_CARD_ARCHIVED`, `BANK_ACCOUNT_NOT_FOUND`, `CREDIT_CARD_NOT_FOUND` | campo Pagar com                                                                            |
| `STATEMENT_CLOSED`                                                                                 | campo Fatura de (ou Data, sem `postedOn`); a mensagem do catálogo explica a fatura fechada |
| `EXPENSE_ALREADY_PAID`                                                                             | alerta; o detalhe é recarregado                                                            |
| `EXPENSE_STATUS_TRANSITION_NOT_ALLOWED`                                                            | alerta; o detalhe é recarregado (o status mudou em outra sessão ou pela varredura)         |
| `CREDIT_CARD_EXPENSE_PAID_BY_STATEMENT`                                                            | alerta com o link para o cartão                                                            |
| `EXPENSE_NOT_FOUND`                                                                                | ERR-0009-02 no detalhe; alerta e volta para a lista numa ação                              |
| `EXPENSE_TYPE_ALREADY_EXISTS`                                                                      | campo nome do tipo                                                                         |

## Invariants

- **INV-0012-01:** valores de despesa só entram por `MoneyInput`/`moneySchema` e só aparecem por `Money`, com o sinal `−`.
- **INV-0012-02:** nenhuma ação de **Pagar** ou **Desfazer pagamento** é oferecida para despesa de cartão.
- **INV-0012-03:** as ações oferecidas num status são exatamente as da tabela de transições; o cliente não oferece transição que o backend recusaria.
- **INV-0012-04:** toda exclusão e toda alteração com efeito em cascata (parcelas, série) mostra o efeito antes de enviar.
- **INV-0012-05:** o `PATCH` de despesa nunca envia `kind`, `status`, `paidOn`, `bankAccountId`, `creditCardId` nem campos de parcela.
- **INV-0012-06:** as ações da lista são as do detalhe para o mesmo status e perfil (mesmo modelo de ações), e usam os mesmos diálogos e mutações.

## Error cases

| Código      | Situação                                    | Comportamento exigido                                        |
| ----------- | ------------------------------------------- | ------------------------------------------------------------ |
| ERR-0012-01 | Erros do mapa                               | campo ou alerta conforme o mapa, formulário aberto           |
| ERR-0012-02 | Lista ou detalhe falham                     | ERR-0009-01 / ERR-0009-02                                    |
| ERR-0012-03 | `VALIDATION_ERROR`                          | ERR-0009-04, com `fieldMap` de todos os campos do formulário |
| ERR-0012-04 | Parâmetro de busca inválido (`mes=2026-13`) | descartado; vale o padrão                                    |

## Acceptance criteria

- **AC-0012-01:** `/despesas?mes=2026-10` chama `GET /expenses?from=2026-10-01&to=2026-10-31` e mostra as despesas do stub em ordem de data, com selo, conta/cartão por nome e valor com `−R$`.
- **AC-0012-02:** escolher o status Vencido e um cartão nos filtros acrescenta `status=OVERDUE&creditCardId=<id>` à consulta, as etiquetas aparecem e sobrevivem a recarregar.
- **AC-0012-03:** criar uma parcelada de `1.200,00` em 3 vezes num cartão envia `{ kind: 'INSTALLMENT', amountCents: 120000, installmentTotal: 3, creditCardId }` sem `bankAccountId`, e mostra "3 despesas criadas.".
- **AC-0012-04:** criar uma fixa com **Repetir até** envia `recurrenceEndsOn`; o campo não existe em Variável e Parcelada.
- **AC-0012-05:** alterar uma ocorrência de série com **Esta e as próximas previstas** envia `PATCH /expenses/{id}?scope=following` só com os campos alterados.
- **AC-0012-06:** no detalhe de uma despesa de conta `OPEN`, **Pagar** com a data padrão envia `{ status: 'PAID', paidOn: <hoje> }`; numa de cartão, **Pagar** não existe.
- **AC-0012-07:** **Excluir** uma parcela mostra o texto da cascata, envia `DELETE` e volta para a lista.
- **AC-0012-08:** **Trocar forma de pagamento** para um cartão envia `PATCH /expenses/{id}/payment-method` com `creditCardId`; `409 STATEMENT_CLOSED` marca o campo Fatura de.
- **AC-0012-09:** `409 EXPENSE_STATUS_TRANSITION_NOT_ALLOWED` mostra a mensagem do catálogo e recarrega o detalhe.
- **AC-0012-10:** com `leitor`, a lista e o detalhe não mostram **Nova despesa**, **Tipos de despesa** como ação de escrita, nem nenhuma ação do detalhe; `?novo=1` e `?pagar=1` não abrem diálogo.
- **AC-0012-11:** `/despesas/tipos` cria, renomeia e arquiva um tipo; `409 EXPENSE_TYPE_ALREADY_EXISTS` marca o nome.
- **AC-0012-12:** nos três projetos, a lista segue o `EntryList`, o formulário segue o `FormDialog` e **Nova despesa** fica acessível sem cobrir a barra inferior.
- **AC-0012-13:** o detalhe de uma despesa de cartão que não é `FORECAST` mostra **Estornar**, que leva a `/cartoes/$cartaoId?estorno=1&despesa=<id>`; despesa de conta, despesa `FORECAST` e `leitor` não o veem.
- **AC-0012-14:** criar uma despesa com data `2026-11-05` a partir de `/despesas?mes=2026-10&status=PAID` mostra "Despesa salva.", fecha o diálogo e leva a `/despesas?mes=2026-11`, sem filtros e sem abrir o detalhe.
- **AC-0012-15:** com um cartão em Pagar com, **Fatura de** só aparece depois de **Lançar em outra fatura**; sem abri-lo, o texto mostra o fechamento da fatura atual do cartão e o `POST /expenses` não leva `postedOn`; aberto e preenchido, leva `postedOn`.
- **AC-0012-16:** com `lancador`, o menu de uma despesa de conta `OPEN` oferece **Pagar**, **Marcar para verificar**, **Editar** e **Excluir**; **Pagar** abre o diálogo sobre a lista (`?pagar=<id>`), envia `{ status: 'PAID', paidOn }` e a lista continua no mesmo mês e com os mesmos filtros; o menu de uma despesa de cartão não tem **Pagar**.
- **AC-0012-17:** **Confirmar** no menu de uma despesa `FORECAST` envia `{ status: 'OPEN' }` sem diálogo; um `409` mostra o alerta acima da lista com o nome da despesa; com `leitor`, nenhuma linha tem menu e `?pagar=<id>` não abre nada.
- **AC-0012-18:** no `celular`, o detalhe de uma despesa de conta `OPEN` mostra **Pagar** em largura total e as demais ações em **Mais ações**; no `tablet` e no `desktop`, os botões como antes.

## Test mapping

| Item                                                                                  | Teste                                                                                                                                           |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-0012-01, AC-0012-02, AC-0012-12, INV-0012-01                                       | `e2e/expenses-list.spec.ts` e `src/features/expenses/list/*.test.tsx`                                                                           |
| AC-0012-03, AC-0012-04, AC-0012-05, AC-0012-14, AC-0012-15, INV-0012-05               | `src/features/expenses/form/expense-form.test.tsx` e `e2e/expenses-form.spec.ts`                                                                |
| AC-0012-06, AC-0012-07, AC-0012-08, AC-0012-09, INV-0012-02, INV-0012-03, INV-0012-04 | `src/features/expenses/detail/*.test.tsx` e `e2e/expenses-detail.spec.ts`                                                                       |
| AC-0012-16, AC-0012-17, AC-0012-18, INV-0012-06                                       | `src/features/expenses/list/*.test.tsx`, `src/features/expenses/detail/*.test.tsx`, `e2e/expenses-list.spec.ts` e `e2e/expenses-detail.spec.ts` |
| AC-0012-10                                                                            | `e2e/expenses-list.spec.ts` e `e2e/expenses-detail.spec.ts` (com `leitor`)                                                                      |
| AC-0012-11                                                                            | `e2e/expense-types.spec.ts`                                                                                                                     |
| AC-0012-13                                                                            | `src/features/expenses/detail/*.test.tsx` e `e2e/refunds.spec.ts`                                                                               |

## Open questions

Nenhuma.
