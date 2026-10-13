---
id: '0015'
title: Dashboard de saldo e relatórios
status: approved
depends_on: ['0009', '0011', '0012', '0013', '0014']
---

# 0015 — Dashboard de Saldo e Relatórios

## Goal

Trocar a tela inicial provisória pelo dashboard de saldo aprovado no [Design](https://claude.ai/artifact/HEj1d1jqqwAPMBVYZdMsyy) — saldo realizado e previsto, receitas e despesas do mês, o que vence esta semana, contas e cartões e, no desktop, despesas por tipo — e entregar os relatórios do backend (saldo mês a mês, despesas e receitas por tipo, fluxo de caixa) legíveis nos três tamanhos de tela.

## Scope / Non-goals

- **Em escopo:** o dashboard em `/` (substitui a `HomePage` de `identity`, que é removida), `/relatorios` com as abas de saldo, por tipo e fluxo de caixa, o componente de colunas mensais e o item **Relatórios** da navegação; o extrato de uma conta em `/contas/$contaId` (revisão de 2026-10-13, FCF-021).
- **Fora de escopo:** orçamentos, alertas e exportação (a API não tem); saldo diário (os relatórios são mensais); um endpoint agregado para o dashboard (a API não tem: o dashboard compõe consultas existentes, abaixo).
- **Depende do backend:** [spec 0015](https://github.com/bhenriq-souza/finances-control-backend/blob/develop/specs/0015-reporting.md) (`/reports/*`, todo perfil) e as listas das specs 0011–0014 do backend, na tag `v1.1.0`; o extrato usa `/reports/account-movements`, da tag `v1.2.0`, para a qual o contrato fixado em `sources.json` passa.
- **Decisões de 2026-10-12 (aprovação):** "Previsto" mostra o saldo previsto (`accountsTotalCents` do ponto `FORECAST`) com a variação ao lado; "Receitas do mês" e "Despesas do mês" somam todos os status, inclusive previstos. **Limite aceito:** sem rota agregada, o dashboard faz 4 consultas fixas e mais uma por cartão ativo.
- **Forma visual:** os seis artboards do [dashboard](https://claude.ai/artifact/HEj1d1jqqwAPMBVYZdMsyy) (celular, tablet e desktop, nos dois temas) e, para os relatórios, o [canvas de padrões](https://claude.ai/artifact/YA6oWvBzWghdVTa2kAFTkC).

## Contracts

### Dashboard — `/`

Código em `src/features/reporting/dashboard/`; a rota `src/routes/_app/index.tsx` passa a compor o `Dashboard`. Seções e de onde vem cada número (`mes` = `monthOf(today())`):

| Seção                         | Conteúdo                                                                                                                                                                                                                                                     | Consultas                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| **Saldo realizado · <mês>**   | soma de `currentBalanceCents` das contas ativas (`valor-destaque`)                                                                                                                                                                                           | `useBankAccounts` (spec 0009)                                                                                               |
| Previsto                      | "Previsto para <último dia do mês>" e `accountsTotalCents` do ponto `FORECAST` do mês corrente, com a variação em relação ao realizado (`sign="always"`, `tone="auto"`)                                                                                      | `GET /reports/balance?from=<mes>&to=<mes>`                                                                                  |
| **Receitas do mês**           | soma de `amountCents` das receitas do mês, todos os status, com `+R$`; apoio "n recebidas · n pendentes"                                                                                                                                                     | `GET /earnings?from&to` do mês                                                                                              |
| **Despesas do mês**           | soma de `amountCents` das despesas do mês, todos os status, com `−R$`; apoio "n pagas · n pendentes · n vencidas"                                                                                                                                            | `GET /expenses?from&to` do mês                                                                                              |
| **Vence esta semana**         | despesas de conta a pagar e faturas a pagar com vencimento até `today() + 6`, inclusive as vencidas (regra abaixo), em ordem de vencimento                                                                                                                   | `GET /expenses?status=OVERDUE`, `GET /expenses?from=<hoje>&to=<hoje+6>` e, por cartão ativo, `GET /statements?creditCardId` |
| **Contas e cartões**          | contas ativas (descrição, banco, saldo) e cartões ativos (nome, usado com `−`, "Limite disponível"; no tablet e no desktop, o selo da fatura: **Fechada**/**Vencida** se houver fechada a pagar, senão **Em aberto** com "Fecha em `currentCycle.closesOn`") | `useBankAccounts`, `useCreditCards` e as faturas acima                                                                      |
| **Despesas por tipo · <mês>** | só no desktop: as três maiores de `byType` e "Outros" com o resto, em `BarList`, e o link **Ver relatório**                                                                                                                                                  | `GET /reports/expenses-by-type?from=<mes>&to=<mes>`                                                                         |

- **Vence esta semana — regra:** (a) despesas de conta (`bankAccountId` presente) das duas consultas de despesa, com status `OPEN`, `OVERDUE` ou `VERIFYING`, sem repetir id; (b) por cartão, faturas `CLOSED` com `remainingCents > 0` e `dueOn ≤ today() + 6`. Despesa de cartão não entra: quem vence é a fatura. Cada linha: data relativa, descrição (fatura: "Fatura <nome do cartão>"), conta ou cartão, selo (inclusive **Vence hoje** e **Vencida**), valor com `−R$`. No celular, no máximo cinco linhas e **Ver todas** (`/despesas?status=OVERDUE` quando houver vencidas, senão `/despesas`).
- **Ações, com `entries.write`:** **Nova despesa** (→ `/despesas?novo=1`) no tablet e no desktop, e **Nova receita** (→ `/receitas?novo=1`) no desktop; na tabela de "Vence esta semana" (tablet e desktop), **Pagar**: despesa → `/despesas/$despesaId?pagar=1`; fatura → `/cartoes/$cartaoId/faturas/$faturaId?pagar=1`. Navegação, não mutação: o dashboard não importa `expenses` nem `statements`.
- **Layout:** celular — saldo, vence esta semana (cartões), contas e cartões (lista); tablet — saldo em três colunas, vence esta semana (tabela), contas e cartões em grade de duas colunas; desktop — conteúdo até 1200px, saldo ocupando duas colunas da grade de três com "Despesas por tipo" na terceira, vence esta semana (tabela) e contas e cartões lado a lado (2 + 1). Os números exatos de espaço e tipografia são os dos artboards, pelos tokens.
- **Carregamento por seção:** cada seção tem o seu `Skeleton` e o seu `EmptyState` de erro (ERR-0009-01); uma consulta que falha não derruba as outras.
- **Saudação:** o título da página é "Início"; o "Olá, <nome>" da tela provisória sai.

### Relatórios — `/relatorios`

Código em `src/features/reporting/reports/`. Abas (com `role="tablist"`) na URL: `?aba=saldo` (padrão) · `por-tipo` · `fluxo`. Período por dois seletores de mês (`de`, `ate`, `YYYY-MM`), validados (`de ≤ ate`, no máximo 120 meses, como a API).

| Aba            | Consulta                                                                                 | Padrão do período              | Gráfico                                                                                                                                | Tabela                                                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Saldo          | `GET /reports/balance?from&to[&bankAccountId]`                                           | mês corrente −5 a +6           | `MonthColumns` de `accountsTotalCents` (ou `consolidatedCents`, por um seletor "Contas" / "Contas menos cartões"; sem conta escolhida) | mês, Realizado/Previsto, contas, dívida de cartões, consolidado; por conta quando `bankAccountId`                          |
| Por tipo       | `GET /reports/expenses-by-type` ou `/earnings-by-type` `?from&to[&includeForecast=true]` | mês corrente                   | `BarList` do período somado por tipo                                                                                                   | mês × tipo, total do mês; em despesas, a linha "Estornos de cartão" (`refundsCents`), mostrada à parte e sem abater o tipo |
| Fluxo de caixa | `GET /reports/cash-flow?from&to[&bankAccountId]`                                         | mês corrente −5 a mês corrente | `MonthColumns` de `netCents`, com negativos abaixo do eixo                                                                             | mês: entradas, despesas pagas, faturas pagas, transferências que entram e que saem, líquido; detalhe por conta ao expandir |

- **Por tipo:** alternância Despesas / Receitas e a caixa **Incluir previstos** (`includeForecast`).
- **`MonthColumns`** (`src/ui/charts/month-columns.tsx`): colunas por mês em SVG, sem biblioteca de gráficos; colunas de mês realizado em `acento` e de previsto com a cor e o contorno de previsto do canvas de padrões; eixo zero quando há negativos (negativo em `negativo`); rótulo do mês abreviado; valor no `title` e na tabela. O gráfico é `aria-hidden`: a tabela ao lado (ou abaixo, no celular) é a versão acessível e completa.
- **Celular:** gráfico com rolagem horizontal quando o período passa de seis meses; a tabela vira `EntryList` (um cartão por mês).
- Navegação: `{ to: '/relatorios', label: 'Relatórios', icon: ChartColumn, profiles: [todos], slot: 'mais' }`.

### Extrato de conta — `/contas/$contaId`

Pedido do responsável nos testes em `dev` (2026-10-13). Código em `src/features/reporting/account-statement/`; qualquer perfil lê.

- **Rota:** `/contas/$contaId`, com `?mes=YYYY-MM` (padrão o mês de `today()`; inválido é descartado). Ela compõe só a feature `reporting`.
- **Cabeçalho:** link de volta **Contas**; `description` da conta e, no apoio, o banco e o tipo, por `useBankAccounts`/`useAccountLookup` de `src/api/queries/` (conta arquivada com o selo **Arquivado**); navegação de mês (‹ outubro de 2026 ›) como nas listas.
- **Consulta:** `GET /reports/account-movements?bankAccountId=<contaId>&from&to` com `monthRange(mes)`, chave `queryKeys.reports.report('account-movements', { bankAccountId, mes })` — sob a raiz `reports`, que toda escrita de lançamento, fatura e transferência já invalida.
- **Saldos:** **Saldo inicial** (`openingBalanceCents`) acima da lista e **Saldo final** (`closingBalanceCents`) abaixo, em `Money` com sinal; nada é somado no cliente.
- **`EntryList`** dos `movements`, na ordem da resposta:

| Coluna    | Conteúdo                                                                                                                                                                                                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Data      | `date` em `formatDate(…, 'relativa')`                                                                                                                                                                                                                                                      |
| Descrição | `EARNING`/`EXPENSE`: `description`, com `typeName` no apoio; `STATEMENT_PAYMENT`: "Pagamento de fatura" e o cartão por `useCardLookup` no apoio; `TRANSFER_IN`/`TRANSFER_OUT`: `description`, com "De <conta>"/"Para <conta>" (`counterpartBankAccountId` por `useAccountLookup`) no apoio |
| Valor     | `amountCents` em `Money sign="always"`, `tone="auto"`                                                                                                                                                                                                                                      |
| Saldo     | `balanceAfterCents` em `Money`; no celular, na segunda linha do cartão, com a data                                                                                                                                                                                                         |

- Cada linha leva ao lançamento de origem: `EARNING` → `/receitas/$receitaId`, `EXPENSE` → `/despesas/$despesaId`, `STATEMENT_PAYMENT` → `/cartoes/$cartaoId/faturas/$faturaId` (ou `/cartoes/$cartaoId` quando `statementId` é `null`), `TRANSFER_*` → `/transferencias/$transferenciaId`.
- **Vazio:** "Nenhum movimento neste mês.", com os dois saldos.
- **Entrada:** na lista de contas (spec 0011), cada linha ganha o link **Extrato**, para todos os perfis.

### Mapa de erros

| Código                   | Onde                                                                                                                              |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `VALIDATION_ERROR`       | não deve ocorrer (o período é validado antes); se ocorrer, ERR-0009-01                                                            |
| `BANK_ACCOUNT_NOT_FOUND` | aviso "Conta não encontrada." e o filtro de conta é removido; no extrato, `EmptyState` `nao-encontrado` com o link para `/contas` |

## Invariants

- **INV-0015-01:** o dashboard não importa outra feature; leva às ações das outras telas só por navegação.
- **INV-0015-02:** todo número do dashboard e dos relatórios vem da API em centavos; o cliente só soma, subtrai e filtra listas, nunca divide nem arredonda.
- **INV-0015-03:** todo gráfico tem a tabela com os mesmos números ao lado.
- **INV-0015-04:** a falha de uma consulta do dashboard afeta só a sua seção.
- **INV-0015-05:** o extrato não calcula saldo: os saldos inicial, final e de cada linha são os da resposta.

## Error cases

| Código      | Situação                    | Comportamento exigido                          |
| ----------- | --------------------------- | ---------------------------------------------- |
| ERR-0015-01 | Consulta de uma seção falha | `EmptyState` `erro` na seção, as outras seguem |
| ERR-0015-02 | Período inválido na URL     | descartado; vale o padrão da aba               |
| ERR-0015-03 | Erros do mapa               | conforme o mapa                                |

## Acceptance criteria

- **AC-0015-01:** com os stubs do dia 15/10/2026, o dashboard mostra o saldo realizado igual à soma das contas ativas, o previsto do ponto `FORECAST` de `2026-10` com a variação, e os totais e contagens do mês.
- **AC-0015-02:** "Vence esta semana" junta despesas de conta vencidas e a vencer até 21/10, e as faturas fechadas a pagar com vencimento até 21/10, sem despesas de cartão e sem repetir id, em ordem de vencimento.
- **AC-0015-03:** com `lancador`, **Pagar** numa despesa leva a `/despesas/<id>?pagar=1` e numa fatura a `/cartoes/<id>/faturas/<id>?pagar=1`; com `leitor`, nem **Pagar** nem **Nova despesa** aparecem.
- **AC-0015-04:** o layout segue os artboards: no `celular` cartões e no máximo cinco itens com **Ver todas**; no `tablet` a tabela e a grade de contas; no `desktop` a coluna "Despesas por tipo" com as três maiores e "Outros".
- **AC-0015-05:** com a consulta de faturas falhando, só "Vence esta semana" e os selos dos cartões mostram erro; o saldo aparece.
- **AC-0015-06:** a aba **Saldo** chama `GET /reports/balance` com o período padrão, mostra colunas realizadas e previstas e a tabela com os mesmos valores.
- **AC-0015-07:** a aba **Por tipo** alterna despesas e receitas, envia `includeForecast=true` com **Incluir previstos** e mostra os estornos à parte.
- **AC-0015-08:** a aba **Fluxo de caixa** mostra o líquido negativo abaixo do eixo e as colunas da tabela.
- **AC-0015-09:** período com `de` maior que `ate` não chega à API.
- **AC-0015-10:** a tela inicial provisória e a `HomePage` de `identity` não existem mais.
- **AC-0015-11:** `/contas/<id>?mes=2026-03` chama `GET /reports/account-movements?bankAccountId=<id>&from=2026-03-01&to=2026-03-31` e mostra o saldo inicial, os movimentos do stub na ordem da resposta, com o valor com sinal e o saldo de cada um, e o saldo final; ‹ leva a `?mes=2026-02`.
- **AC-0015-12:** cada tipo de movimento mostra a descrição e o apoio da tabela e leva à rota do lançamento de origem; o pagamento antecipado (sem `statementId`) leva ao cartão.
- **AC-0015-13:** `404 BANK_ACCOUNT_NOT_FOUND` mostra "Não encontramos este item." com o link para `/contas`; com `leitor`, o extrato aparece e a lista de contas mostra **Extrato** em cada linha.

## Test mapping

| Item                                            | Teste                                                                                   |
| ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| AC-0015-01, AC-0015-02, INV-0015-02             | `src/features/reporting/dashboard/dashboard-data.test.ts` e `e2e/dashboard.spec.ts`     |
| AC-0015-03, INV-0015-01                         | `e2e/dashboard.spec.ts` (com `lancador` e `leitor`) e o gate `boundaries`               |
| AC-0015-04, AC-0015-05, INV-0015-04             | `e2e/dashboard.spec.ts`                                                                 |
| AC-0015-06, AC-0015-07, AC-0015-08, INV-0015-03 | `e2e/reports.spec.ts` e `src/ui/charts/month-columns.test.tsx`                          |
| AC-0015-09                                      | `src/features/reporting/reports/period.test.ts`                                         |
| AC-0015-10                                      | revisão do PR e `e2e/dashboard.spec.ts`                                                 |
| AC-0015-11, AC-0015-12, AC-0015-13, INV-0015-05 | `src/features/reporting/account-statement/*.test.tsx` e `e2e/account-statement.spec.ts` |

## Open questions

Nenhuma.
