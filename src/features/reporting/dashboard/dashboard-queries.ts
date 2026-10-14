import { queryOptions } from '@tanstack/react-query';

import { api } from '@/api/client';
import { ApiError, unwrap } from '@/api/errors/api-error';
import { ENTRY_STALE_TIME, queryKeys } from '@/api/queries/keys';
import { monthRange, type IsoDate, type IsoMonth } from '@/shared/dates';

import type { BalanceReport, ByTypeReport, Earning, Expense, Statement } from './dashboard-data';

// As consultas do dashboard (spec 0015, tabela de seções). Sem rota agregada na API: quatro
// consultas fixas e mais uma por cartão ativo, com as mesmas chaves das outras telas (spec 0009),
// para que o cache seja um só. O dashboard não importa outra feature (INV-0015-01).

function required<T>(data: T | undefined): T {
    if (data === undefined) throw new ApiError({ status: 200, code: 'UNEXPECTED_RESPONSE' });
    return data;
}

/** O erro de uma consulta como `ApiError`, para a mensagem do catálogo; outro erro é inesperado. */
export function asApiError(error: unknown): ApiError {
    return error instanceof ApiError
        ? error
        : new ApiError({ status: 0, code: 'UNEXPECTED_RESPONSE' });
}

/** `GET /reports/balance?from=<mes>&to=<mes>`. */
export function balanceReportQuery(month: IsoMonth) {
    const params = { from: month, to: month };
    return queryOptions({
        queryKey: queryKeys.reports.report('balance', params),
        queryFn: async (): Promise<BalanceReport> =>
            required(unwrap(await api.GET('/reports/balance', { params: { query: params } })).data),
        staleTime: ENTRY_STALE_TIME,
    });
}

/** `GET /reports/expenses-by-type?from=<mes>&to=<mes>`. */
export function expensesByTypeQuery(month: IsoMonth) {
    const params = { from: month, to: month };
    return queryOptions({
        queryKey: queryKeys.reports.report('expenses-by-type', params),
        queryFn: async (): Promise<ByTypeReport> =>
            required(
                unwrap(await api.GET('/reports/expenses-by-type', { params: { query: params } }))
                    .data,
            ),
        staleTime: ENTRY_STALE_TIME,
    });
}

/** `GET /earnings?from&to` do mês. */
export function monthEarningsQuery(month: IsoMonth) {
    const params = monthRange(month);
    return queryOptions({
        queryKey: queryKeys.earnings.list(params),
        queryFn: async (): Promise<Earning[]> =>
            required(unwrap(await api.GET('/earnings', { params: { query: params } })).data),
        staleTime: ENTRY_STALE_TIME,
    });
}

export type ExpensesParams = { from: IsoDate; to: IsoDate } | { status: 'OVERDUE' };

/** `GET /expenses` com exatamente os parâmetros dados (o mês, a semana ou as vencidas). */
export function expensesQuery(params: ExpensesParams) {
    return queryOptions({
        queryKey: queryKeys.expenses.list(params),
        queryFn: async (): Promise<Expense[]> =>
            required(unwrap(await api.GET('/expenses', { params: { query: params } })).data),
        staleTime: ENTRY_STALE_TIME,
    });
}

/** `GET /statements?creditCardId=…` sem janela: as fechadas dos últimos 12 meses e a aberta. */
export function cardStatementsQuery(creditCardId: string) {
    return queryOptions({
        queryKey: queryKeys.statements.list(creditCardId),
        queryFn: async (): Promise<Statement[]> =>
            required(
                unwrap(await api.GET('/statements', { params: { query: { creditCardId } } })).data,
            ),
        staleTime: ENTRY_STALE_TIME,
    });
}
