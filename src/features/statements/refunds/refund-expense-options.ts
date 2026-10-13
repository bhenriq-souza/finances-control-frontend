import { useQuery } from '@tanstack/react-query';

import { formatDate, formatMonth, monthOf } from '@/shared/dates';
import { formatBRL, type Cents } from '@/shared/money';
import type { SelectOptionGroup } from '@/ui/select-field';

import {
    currentStatementQuery,
    previousStatements,
    statementDetailQuery,
    statementsListQuery,
    type Statement,
    type StatementExpense,
} from '../panel/statement-model';

/** "Notebook (2/3) · 10 out. · R$ 400,00": a despesa na lista de origem do estorno. */
export function expenseOptionLabel(expense: StatementExpense): string {
    const installment = expense.installment
        ? ` (${expense.installment.number}/${expense.installment.total})`
        : '';
    return `${expense.description}${installment} · ${formatDate(expense.occurredOn, 'curta')} · ${formatBRL(expense.amountCents as Cents)}`;
}

function group(label: string, statement: Statement | undefined): SelectOptionGroup[] {
    const expenses = statement?.expenses ?? [];
    if (expenses.length === 0) return [];
    return [
        {
            label,
            options: expenses.map((expense) => ({
                value: expense.id,
                label: expenseOptionLabel(expense),
            })),
        },
    ];
}

export interface RefundExpenseOptions {
    /** As consultas terminaram (com dados ou com erro): o formulário pode ser montado. */
    ready: boolean;
    groups: SelectOptionGroup[];
    /** A despesa está entre as opções. */
    has: (expenseId: string) => boolean;
}

/**
 * A despesa de origem de um estorno (spec 0013, "Estornos"): as despesas da fatura atual e da
 * última fechada do cartão. Uma consulta que falha só tira o seu grupo (a origem é opcional).
 */
export function useRefundExpenseOptions(cardId: string): RefundExpenseOptions {
    const current = useQuery(currentStatementQuery(cardId));
    const list = useQuery(statementsListQuery(cardId));
    const lastClosed = list.data
        ? previousStatements(list.data).find((statement) => statement.status !== 'OPEN')
        : undefined;
    const closed = useQuery({
        ...statementDetailQuery(lastClosed?.id ?? ''),
        enabled: lastClosed !== undefined,
    });

    const groups = [
        ...group('Fatura atual', current.data),
        ...(lastClosed
            ? group(`Fatura de ${formatMonth(monthOf(lastClosed.closesOn))}`, closed.data)
            : []),
    ];
    const ids = new Set(groups.flatMap((item) => item.options.map((option) => option.value)));
    return {
        ready:
            !current.isPending &&
            !list.isPending &&
            (lastClosed === undefined || !closed.isPending),
        groups,
        has: (expenseId) => ids.has(expenseId),
    };
}
