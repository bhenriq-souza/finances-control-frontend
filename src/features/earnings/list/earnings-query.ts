import { queryOptions } from '@tanstack/react-query';

import { api } from '@/api/client';
import { ApiError, unwrap } from '@/api/errors/api-error';
import { ENTRY_STALE_TIME, queryKeys } from '@/api/queries/keys';

import type { Earning } from './earning-model';
import type { EarningListQuery } from './earning-search';

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

/** `GET /earnings` com os filtros, chave `['earnings', 'list', filtros]` (spec 0009). */
export function earningsListQuery(params: EarningListQuery) {
    return queryOptions({
        queryKey: queryKeys.earnings.list(params),
        queryFn: async (): Promise<Earning[]> =>
            required(unwrap(await api.GET('/earnings', { params: { query: params } })).data),
        staleTime: ENTRY_STALE_TIME,
    });
}

/** `GET /earnings/{id}`, chave `['earnings', 'detail', id]`. */
export function earningDetailQuery(id: string) {
    return queryOptions({
        queryKey: queryKeys.earnings.detail(id),
        queryFn: async (): Promise<Earning> =>
            required(unwrap(await api.GET('/earnings/{id}', { params: { path: { id } } })).data),
        staleTime: ENTRY_STALE_TIME,
    });
}

/** Ordem da lista: `occurredOn` crescente, depois `description` (no cliente, spec 0012). */
export function sortEarnings(earnings: readonly Earning[]): Earning[] {
    return [...earnings].sort(
        (a, b) =>
            a.occurredOn.localeCompare(b.occurredOn) ||
            a.description.localeCompare(b.description, 'pt-BR'),
    );
}

export interface EarningSummary {
    totalCents: number;
    received: number;
    pending: number;
    overdue: number;
}

/**
 * Resumo do mês, somado no cliente sobre a lista carregada (completa, sem paginação): total e as
 * contagens. Pendente é toda receita ainda não recebida e não atrasada.
 */
export function summarizeEarnings(earnings: readonly Earning[]): EarningSummary {
    const summary: EarningSummary = { totalCents: 0, received: 0, pending: 0, overdue: 0 };
    for (const earning of earnings) {
        summary.totalCents += earning.amountCents;
        if (earning.status === 'RECEIVED') summary.received += 1;
        else if (earning.status === 'OVERDUE') summary.overdue += 1;
        else summary.pending += 1;
    }
    return summary;
}
