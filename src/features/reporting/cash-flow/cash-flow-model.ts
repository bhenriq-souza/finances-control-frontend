import type { CreditCard } from '@/api/queries/reference';
import { addMonths, monthRange, type IsoDate, type IsoMonth } from '@/shared/dates';
import type { Cents } from '@/shared/money';

import type { BalanceReport, Earning, Expense, Statement } from '../dashboard/dashboard-data';

import type { Situation } from './search';

// Números do fluxo de caixa (spec 0015, "Fluxo de caixa"): tudo vem da API em centavos; aqui só
// se soma, subtrai e filtra (INV-0015-02, INV-0015-07), nunca se divide nem arredonda.

export type { BalanceReport, Earning, Expense, Statement };

export type CashFlowRow =
    | { kind: 'earning'; key: string; date: IsoDate; situation: Situation; earning: Earning }
    | { kind: 'expense'; key: string; date: IsoDate; situation: Situation; expense: Expense }
    | {
          kind: 'statement';
          key: string;
          date: IsoDate;
          situation: Situation;
          statement: Statement;
          card: CreditCard;
      };

/** As faturas de um cartão ativo, como `GET /statements` as devolveu. */
export interface CardStatementList {
    card: CreditCard;
    statements: readonly Statement[];
}

export interface CashFlowInput {
    month: IsoMonth;
    earnings: readonly Earning[];
    expenses: readonly Expense[];
    statements: readonly CardStatementList[];
}

/** Receita e despesa: realizada, a vencer ou vencida pelo status. */
function entrySituation(status: Earning['status'] | Expense['status']): Situation {
    switch (status) {
        case 'RECEIVED':
        case 'PAID':
            return 'realizados';
        case 'OVERDUE':
            return 'vencidos';
        case 'OPEN':
        case 'FORECAST':
        case 'VERIFYING':
            return 'a-vencer';
    }
}

/** Fatura: paga é realizada; fechada vencida é vencida; a fechada no prazo e a projetada, a vencer. */
function statementSituation(statement: Statement): Situation {
    if (statement.status === 'PAID') return 'realizados';
    if (statement.status === 'CLOSED' && statement.overdue) return 'vencidos';
    return 'a-vencer';
}

/** As faturas que entram na lista: fechadas, pagas ou a projetada (a rolada não sai da conta). */
function listedStatement(statement: Statement): boolean {
    return statement.status !== 'ROLLED_OVER';
}

/**
 * A janela de `GET /statements` do mês: do 1º dia de `mes − 2` ao último de `mes`; dela só ficam
 * as faturas com `dueOn` no mês.
 */
export function statementWindow(month: IsoMonth): { from: IsoDate; to: IsoDate } {
    return { from: monthRange(addMonths(month, -2)).from, to: monthRange(month).to };
}

/** No mesmo dia: receitas, depois despesas, depois faturas. */
const KIND_ORDER: Readonly<Record<CashFlowRow['kind'], number>> = {
    earning: 0,
    expense: 1,
    statement: 2,
};

const inMonth = (date: IsoDate, month: IsoMonth) => date.startsWith(`${month}-`);

/**
 * A lista do mês (spec 0015): receitas, despesas de conta e faturas com vencimento no mês, em
 * ordem de data. Despesa de cartão nunca entra, só a fatura (INV-0015-07); o que tem data fora do
 * mês fica no seu mês.
 */
export function cashFlowRows({
    month,
    earnings,
    expenses,
    statements,
}: CashFlowInput): CashFlowRow[] {
    const rows: CashFlowRow[] = [];
    for (const earning of earnings) {
        if (!inMonth(earning.occurredOn, month)) continue;
        rows.push({
            kind: 'earning',
            key: `receita:${earning.id}`,
            date: earning.occurredOn,
            situation: entrySituation(earning.status),
            earning,
        });
    }
    for (const expense of expenses) {
        if (expense.bankAccountId === null || !inMonth(expense.occurredOn, month)) continue;
        rows.push({
            kind: 'expense',
            key: `despesa:${expense.id}`,
            date: expense.occurredOn,
            situation: entrySituation(expense.status),
            expense,
        });
    }
    for (const { card, statements: list } of statements) {
        for (const statement of list) {
            if (!listedStatement(statement) || !inMonth(statement.dueOn, month)) continue;
            rows.push({
                kind: 'statement',
                key: `fatura:${card.id}:${statement.id ?? statement.closesOn}`,
                date: statement.dueOn,
                situation: statementSituation(statement),
                statement,
                card,
            });
        }
    }
    return rows.sort(
        (a, b) =>
            a.date.localeCompare(b.date) ||
            KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
            a.key.localeCompare(b.key),
    );
}

/** O valor com sinal da linha: `+` na receita, `−` na despesa e na fatura (`amountDueCents`). */
export function rowAmount(row: CashFlowRow): Cents {
    switch (row.kind) {
        case 'earning':
            return row.earning.amountCents;
        case 'expense':
            return -row.expense.amountCents;
        case 'statement':
            return -row.statement.amountDueCents;
    }
}

/** As linhas da situação; sem filtro, todas. O resumo nunca usa a lista filtrada. */
export function filterRows(rows: readonly CashFlowRow[], situation: Situation | undefined) {
    return situation ? rows.filter((row) => row.situation === situation) : [...rows];
}

export interface FlowTotal {
    /** A soma dos valores, sem sinal. */
    totalCents: Cents;
    realized: number;
    pending: number;
}

export interface FlowSummary {
    /** As receitas da lista. */
    inflows: FlowTotal;
    /** As despesas e as faturas da lista. */
    outflows: FlowTotal;
}

/** **Entradas** e **Saídas**: as somas das linhas do mês inteiro, com realizadas e pendentes. */
export function summarizeRows(rows: readonly CashFlowRow[]): FlowSummary {
    const empty = (): FlowTotal => ({ totalCents: 0, realized: 0, pending: 0 });
    const summary: FlowSummary = { inflows: empty(), outflows: empty() };
    for (const row of rows) {
        const total = row.kind === 'earning' ? summary.inflows : summary.outflows;
        const amount = rowAmount(row);
        total.totalCents += amount < 0 ? -amount : amount;
        if (row.situation === 'realizados') total.realized += 1;
        else total.pending += 1;
    }
    return summary;
}

/**
 * A janela de `GET /reports/balance` do mês: de `min(mes, corrente) − 1` até `mes`, para ter o
 * ponto do início e o `cardDueCents` de cada mês desde o corrente.
 */
export function balanceWindow(
    month: IsoMonth,
    current: IsoMonth,
): { from: IsoMonth; to: IsoMonth } {
    const start = month < current ? month : current;
    return { from: addMonths(start, -1), to: month };
}

export type BalanceKind = BalanceReport['points'][number]['kind'];

export interface BalanceValue {
    cents: Cents;
    kind: BalanceKind;
}

export interface CashFlowBalances {
    start: BalanceValue;
    end: BalanceValue;
}

/**
 * **Saldo no início** e **Saldo no fim** (spec 0015): num mês passado, os `accountsTotalCents`
 * realizados de `mes − 1` e `mes`; do corrente em diante, o fim de `M` é `accountsTotalCents(M)`
 * menos a soma de `cardDueCents` do corrente até `M`, e o início é o fim do mês anterior (no
 * corrente, o ponto de `corrente − 1`). Só soma e subtrai números da API; `null` se faltar ponto.
 */
export function cashFlowBalances(
    report: BalanceReport,
    month: IsoMonth,
    current: IsoMonth,
): CashFlowBalances | null {
    const points = new Map(report.points.map((point) => [point.month, point]));
    const previous = points.get(addMonths(month, -1));
    const point = points.get(month);
    if (!previous || !point) return null;

    if (month < current) {
        return {
            start: { cents: previous.accountsTotalCents, kind: previous.kind },
            end: { cents: point.accountsTotalCents, kind: point.kind },
        };
    }

    // O ponto `FORECAST` não desconta as faturas: cada uma sai no mês em que vence.
    let dueSoFar = 0;
    let start: BalanceValue | null = null;
    let end: BalanceValue | null = null;
    for (let m = current; m <= month; m = addMonths(m, 1)) {
        const mPoint = points.get(m);
        if (!mPoint) return null;
        if (m === current) {
            const before = points.get(addMonths(current, -1));
            if (!before) return null;
            start = { cents: before.accountsTotalCents, kind: before.kind };
        } else {
            start = end;
        }
        dueSoFar += mPoint.cardDueCents ?? 0;
        end = { cents: mPoint.accountsTotalCents - dueSoFar, kind: mPoint.kind };
    }
    return start && end ? { start, end } : null;
}

/** Vencidas de meses anteriores: as `OVERDUE` com data antes do mês. */
export interface OverdueBefore {
    expenses: number;
    earnings: number;
}

/**
 * As vencidas de antes do mês que o saldo previsto conta (spec 0015): despesas de conta e
 * receitas `OVERDUE` com data antes do 1º dia do mês.
 */
export function overdueBefore(
    month: IsoMonth,
    expenses: readonly Expense[],
    earnings: readonly Earning[],
): OverdueBefore {
    const first = monthRange(month).from;
    return {
        expenses: expenses.filter(
            (e) => e.status === 'OVERDUE' && e.bankAccountId !== null && e.occurredOn < first,
        ).length,
        earnings: earnings.filter((e) => e.status === 'OVERDUE' && e.occurredOn < first).length,
    };
}
