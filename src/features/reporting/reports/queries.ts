import { queryOptions } from '@tanstack/react-query';

import { api } from '@/api/client';
import { ApiError, unwrap } from '@/api/errors/api-error';
import type { components } from '@/api/generated/schema';
import { ENTRY_STALE_TIME, queryKeys } from '@/api/queries/keys';

import type { Period } from './period';

export type BalanceReport = components['schemas']['BalanceReport'];
export type BalancePoint = BalanceReport['points'][number];
export type ByTypeReport = components['schemas']['ByTypeReport'];
export type ByTypeMonth = ByTypeReport['months'][number];
export type CashFlowReport = components['schemas']['CashFlowReport'];
export type CashFlowMonth = CashFlowReport['months'][number];
export type CashFlowAccount = CashFlowMonth['accounts'][number];

/** Despesas ou receitas, na aba **Por tipo**. */
export type ByTypeKind = 'expenses' | 'earnings';

function required<T>(data: T | undefined): T {
    if (data === undefined) throw new ApiError({ status: 200, code: 'UNEXPECTED_RESPONSE' });
    return data;
}

/** O erro de uma consulta como `ApiError`, para a mensagem do catálogo; outro erro é inesperado. */
export function asApiError(error: Error): ApiError {
    return error instanceof ApiError
        ? error
        : new ApiError({ status: 0, code: 'UNEXPECTED_RESPONSE' });
}

const common = { staleTime: ENTRY_STALE_TIME } as const;

/** `GET /reports/balance?from&to[&bankAccountId]`. */
export function balanceReportQuery(period: Period, bankAccountId?: string) {
    const query = { from: period.from, to: period.to, bankAccountId };
    return queryOptions({
        queryKey: queryKeys.reports.report('balance', query),
        queryFn: async (): Promise<BalanceReport> =>
            required(unwrap(await api.GET('/reports/balance', { params: { query } })).data),
        ...common,
    });
}

/** `GET /reports/expenses-by-type` ou `/earnings-by-type` `?from&to[&includeForecast=true]`. */
export function byTypeReportQuery(kind: ByTypeKind, period: Period, includeForecast: boolean) {
    const query = {
        from: period.from,
        to: period.to,
        includeForecast: includeForecast ? ('true' as const) : undefined,
    };
    return queryOptions({
        queryKey: queryKeys.reports.report(`${kind}-by-type`, query),
        queryFn: async (): Promise<ByTypeReport> =>
            required(
                unwrap(
                    kind === 'expenses'
                        ? await api.GET('/reports/expenses-by-type', { params: { query } })
                        : await api.GET('/reports/earnings-by-type', { params: { query } }),
                ).data,
            ),
        ...common,
    });
}

/** `GET /reports/cash-flow?from&to[&bankAccountId]`. */
export function cashFlowReportQuery(period: Period, bankAccountId?: string) {
    const query = { from: period.from, to: period.to, bankAccountId };
    return queryOptions({
        queryKey: queryKeys.reports.report('cash-flow', query),
        queryFn: async (): Promise<CashFlowReport> =>
            required(unwrap(await api.GET('/reports/cash-flow', { params: { query } })).data),
        ...common,
    });
}
