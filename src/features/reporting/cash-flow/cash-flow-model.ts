import type { components } from '@/api/generated/schema';
import type { CreditCard } from '@/api/queries/reference';
import { addMonths, monthRange, type IsoDate, type IsoMonth } from '@/shared/dates';
import type { Cents } from '@/shared/money';

import type { BalanceReport, Earning, Expense, Statement } from '../dashboard/dashboard-data';

import type { Situation } from './search';

// Números do fluxo de caixa (spec 0015, "Fluxo de caixa"): tudo vem da API em centavos; aqui só
// se soma, subtrai e filtra (INV-0015-02, INV-0015-07), nunca se divide nem arredonda.

export type { BalanceReport, Earning, Expense, Statement };
export type BankTransfer = components['schemas']['BankTransferResponse'];

/** O sentido da transferência para a conta escolhida: entra (`+`) ou sai (`−`). */
export type TransferDirection = 'in' | 'out';

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
      }
    | {
          kind: 'transfer';
          key: string;
          date: IsoDate;
          situation: Situation;
          transfer: BankTransfer;
          direction: TransferDirection;
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
    /**
     * A conta escolhida (`?conta=`, revisão de 2026-10-14); sem ela, todas as contas e nenhuma
     * transferência (INV-0015-08).
     */
    account?: string;
    /** As transferências do mês da conta escolhida (`GET /bank-transfers?bankAccountId&from&to`). */
    transfers?: readonly BankTransfer[];
    /** `today()`: a transferência agendada antes de hoje está vencida. */
    today: IsoDate;
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

/**
 * Transferência: concluída é realizada; agendada a partir de hoje, a vencer; agendada antes de
 * hoje, vencida.
 */
function transferSituation(transfer: BankTransfer, today: IsoDate): Situation {
    if (transfer.status === 'COMPLETED') return 'realizados';
    return transfer.occurredOn < today ? 'vencidos' : 'a-vencer';
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
    transfer: 3,
};

const inMonth = (date: IsoDate, month: IsoMonth) => date.startsWith(`${month}-`);

/**
 * A lista do mês (spec 0015): receitas, despesas de conta e faturas com vencimento no mês, em
 * ordem de data. Despesa de cartão nunca entra, só a fatura (INV-0015-07); o que tem data fora do
 * mês fica no seu mês. Com uma conta escolhida, só o que é dela: as receitas e as despesas da
 * conta, as faturas dos cartões que ela paga e as suas transferências (INV-0015-08).
 */
export function cashFlowRows({
    month,
    earnings,
    expenses,
    statements,
    account,
    transfers = [],
    today,
}: CashFlowInput): CashFlowRow[] {
    const ofAccount = (bankAccountId: string | null) =>
        bankAccountId !== null && (account === undefined || bankAccountId === account);
    const rows: CashFlowRow[] = [];
    for (const earning of earnings) {
        if (!ofAccount(earning.bankAccountId) || !inMonth(earning.occurredOn, month)) continue;
        rows.push({
            kind: 'earning',
            key: `receita:${earning.id}`,
            date: earning.occurredOn,
            situation: entrySituation(earning.status),
            earning,
        });
    }
    for (const expense of expenses) {
        if (!ofAccount(expense.bankAccountId) || !inMonth(expense.occurredOn, month)) continue;
        rows.push({
            kind: 'expense',
            key: `despesa:${expense.id}`,
            date: expense.occurredOn,
            situation: entrySituation(expense.status),
            expense,
        });
    }
    for (const { card, statements: list } of statements) {
        // Cartão sem conta pagadora só aparece em **Todas as contas**.
        if (account !== undefined && card.paymentBankAccountId !== account) continue;
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
    // Sem conta escolhida, as transferências se anulam e ficam de fora.
    if (account !== undefined) {
        for (const transfer of transfers) {
            if (!inMonth(transfer.occurredOn, month)) continue;
            let direction: TransferDirection;
            if (transfer.toBankAccountId === account) direction = 'in';
            else if (transfer.fromBankAccountId === account) direction = 'out';
            else continue;
            rows.push({
                kind: 'transfer',
                key: `transferencia:${transfer.id}`,
                date: transfer.occurredOn,
                situation: transferSituation(transfer, today),
                transfer,
                direction,
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

/**
 * O valor com sinal da linha: `+` na receita e na transferência que entra, `−` na despesa, na
 * fatura (`amountDueCents`) e na transferência que sai.
 */
export function rowAmount(row: CashFlowRow): Cents {
    switch (row.kind) {
        case 'earning':
            return row.earning.amountCents;
        case 'expense':
            return -row.expense.amountCents;
        case 'statement':
            return -row.statement.amountDueCents;
        case 'transfer':
            return row.direction === 'in' ? row.transfer.amountCents : -row.transfer.amountCents;
    }
}

/** A linha entra em **Entradas**: a receita e a transferência que entra na conta. */
export function isInflow(row: CashFlowRow): boolean {
    return row.kind === 'earning' || (row.kind === 'transfer' && row.direction === 'in');
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
    /** As receitas e as transferências que entram. */
    inflows: FlowTotal;
    /** As despesas, as faturas e as transferências que saem. */
    outflows: FlowTotal;
}

/** **Entradas** e **Saídas**: as somas das linhas do mês inteiro, com realizadas e pendentes. */
export function summarizeRows(rows: readonly CashFlowRow[]): FlowSummary {
    const empty = (): FlowTotal => ({ totalCents: 0, realized: 0, pending: 0 });
    const summary: FlowSummary = { inflows: empty(), outflows: empty() };
    for (const row of rows) {
        const total = isInflow(row) ? summary.inflows : summary.outflows;
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

/** Vencidas de meses anteriores: as `OVERDUE` e as transferências agendadas com data antes do mês. */
export interface OverdueBefore {
    expenses: number;
    earnings: number;
    transfers: number;
}

/**
 * As vencidas de antes do mês que o saldo previsto conta (spec 0015): despesas de conta e
 * receitas `OVERDUE` com data antes do 1º dia do mês e, com uma conta escolhida, as suas
 * transferências `SCHEDULED` com data antes do mês.
 */
export function overdueBefore(
    month: IsoMonth,
    expenses: readonly Expense[],
    earnings: readonly Earning[],
    transfers: readonly BankTransfer[] = [],
): OverdueBefore {
    const first = monthRange(month).from;
    return {
        expenses: expenses.filter(
            (e) => e.status === 'OVERDUE' && e.bankAccountId !== null && e.occurredOn < first,
        ).length,
        earnings: earnings.filter((e) => e.status === 'OVERDUE' && e.occurredOn < first).length,
        transfers: transfers.filter((t) => t.status === 'SCHEDULED' && t.occurredOn < first).length,
    };
}
