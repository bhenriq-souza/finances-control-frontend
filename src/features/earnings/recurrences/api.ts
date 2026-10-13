import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api/client';
import { ApiError, unwrap } from '@/api/errors/api-error';
import type { components } from '@/api/generated/schema';
import { invalidateAfter } from '@/api/queries/invalidation';
import { ENTRY_STALE_TIME, queryKeys } from '@/api/queries/keys';

export type EarningRecurrence = components['schemas']['EarningRecurrenceResponse'];
export type EndRecurrence = components['schemas']['EndRecurrence'];

function dataOf<T>(body: { data?: T } | undefined): T {
    if (body?.data === undefined) throw new ApiError({ status: 200, code: 'UNEXPECTED_RESPONSE' });
    return body.data;
}

/**
 * `GET /earning-recurrences[?active=true]`, chave `['earning-recurrences', 'list', filtros]`.
 * Ordem da API (mais novas primeiro). Sem `active`, vêm também as encerradas.
 */
export function earningRecurrencesQuery(showEnded: boolean) {
    const query = showEnded ? {} : { active: 'true' as const };
    return queryOptions({
        queryKey: queryKeys.earningRecurrences.list(query),
        queryFn: async (): Promise<EarningRecurrence[]> =>
            dataOf(unwrap(await api.GET('/earning-recurrences', { params: { query } }))),
        staleTime: ENTRY_STALE_TIME,
    });
}

/** `GET /earning-recurrences/{id}`, chave `['earning-recurrences', 'detail', id]`. */
export function earningRecurrenceQuery(id: string) {
    return queryOptions({
        queryKey: queryKeys.earningRecurrences.detail(id),
        queryFn: async (): Promise<EarningRecurrence> =>
            dataOf(
                unwrap(await api.GET('/earning-recurrences/{id}', { params: { path: { id } } })),
            ),
        staleTime: ENTRY_STALE_TIME,
    });
}

export const useEarningRecurrences = (showEnded: boolean) =>
    useQuery(earningRecurrencesQuery(showEnded));
export const useEarningRecurrence = (id: string) => useQuery(earningRecurrenceQuery(id));

/**
 * **Encerrar série**: `PATCH /earning-recurrences/{id}` só com `{ endsOn }` (INV-0017-01).
 * Invalida pela matriz, domínio `earning-recurrence` (INV-0009-02).
 */
export function useEndEarningRecurrence(id: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ endsOn }: EndRecurrence): Promise<EarningRecurrence> =>
            dataOf(
                unwrap(
                    await api.PATCH('/earning-recurrences/{id}', {
                        params: { path: { id } },
                        body: { endsOn },
                    }),
                ),
            ),
        onSuccess: () => invalidateAfter(queryClient, 'earning-recurrence'),
    });
}
