import { queryOptions, useQuery } from '@tanstack/react-query';

import { api } from '@/api/client';
import { ApiError, unwrap } from '@/api/errors/api-error';
import type { components } from '@/api/generated/schema';
import { ENTRY_STALE_TIME, queryKeys } from '@/api/queries/keys';
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

type OriginExpense = components['schemas']['ExpenseResponse'];

/** O que o rótulo de uma despesa de origem usa (a da fatura ou a de `GET /expenses/{id}`). */
type LabeledExpense = Pick<
    StatementExpense,
    'description' | 'installment' | 'occurredOn' | 'amountCents'
>;

/** O grupo da despesa de `?despesa` que não está na fatura atual nem na última fechada. */
export const OTHER_STATEMENT_GROUP = 'Outra fatura';

/**
 * `GET /expenses/{id}`, chave `queryKeys.expenses.detail(id)`: a mesma consulta do detalhe de
 * despesa (spec 0012), lida aqui pelo cliente da API sem importar a feature de despesas.
 */
export function originExpenseQuery(id: string) {
    return queryOptions({
        queryKey: queryKeys.expenses.detail(id),
        queryFn: async (): Promise<OriginExpense> => {
            const body = unwrap(await api.GET('/expenses/{id}', { params: { path: { id } } }));
            if (!body.data) throw new ApiError({ status: 200, code: 'UNEXPECTED_RESPONSE' });
            return body.data;
        },
        staleTime: ENTRY_STALE_TIME,
    });
}

/** "Notebook (2/3) · 10 out. · R$ 400,00": a despesa na lista de origem do estorno. */
export function expenseOptionLabel(expense: LabeledExpense): string {
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
 * A `expenseId` de `?despesa` que não está nessas duas faturas é lida por `GET /expenses/{id}`
 * e entra no seu próprio grupo quando é deste cartão; de outro cartão, ou com erro (404), fica
 * de fora e é ignorada (AC-0013-11).
 */
export function useRefundExpenseOptions(cardId: string, expenseId?: string): RefundExpenseOptions {
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
    const statementsReady =
        !current.isPending && !list.isPending && (lastClosed === undefined || !closed.isPending);
    const ids = new Set(groups.flatMap((item) => item.options.map((option) => option.value)));

    // Só depois das faturas: a despesa que já está numa delas não precisa ser lida.
    const fetchOrigin = statementsReady && expenseId !== undefined && !ids.has(expenseId);
    const origin = useQuery({ ...originExpenseQuery(expenseId ?? ''), enabled: fetchOrigin });
    const other = fetchOrigin && origin.data?.creditCardId === cardId ? origin.data : undefined;
    if (other) {
        groups.push({
            label: OTHER_STATEMENT_GROUP,
            options: [{ value: other.id, label: expenseOptionLabel(other) }],
        });
        ids.add(other.id);
    }

    return {
        ready: statementsReady && (!fetchOrigin || !origin.isPending),
        groups,
        has: (id) => ids.has(id),
    };
}
