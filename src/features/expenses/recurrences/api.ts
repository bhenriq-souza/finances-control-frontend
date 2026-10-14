import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api/client';
import { ApiError, unwrap } from '@/api/errors/api-error';
import type { components } from '@/api/generated/schema';
import { invalidateAfter } from '@/api/queries/invalidation';
import { ENTRY_STALE_TIME, queryKeys } from '@/api/queries/keys';

export type ExpenseRecurrence = components['schemas']['RecurrenceResponse'];
export type EndRecurrence = components['schemas']['EndRecurrence'];

function dataOf<T>(body: { data?: T } | undefined): T {
    if (body?.data === undefined) throw new ApiError({ status: 200, code: 'UNEXPECTED_RESPONSE' });
    return body.data;
}

/**
 * `GET /expense-recurrences[?active=true]`, chave `['expense-recurrences', 'list', filtros]`.
 * Ordem da API (mais novas primeiro). Sem `active`, vêm também as encerradas.
 */
export function expenseRecurrencesQuery(showEnded: boolean) {
    const query = showEnded ? {} : { active: 'true' as const };
    return queryOptions({
        queryKey: queryKeys.expenseRecurrences.list(query),
        queryFn: async (): Promise<ExpenseRecurrence[]> =>
            dataOf(unwrap(await api.GET('/expense-recurrences', { params: { query } }))),
        staleTime: ENTRY_STALE_TIME,
    });
}

/** `GET /expense-recurrences/{id}`, chave `['expense-recurrences', 'detail', id]`. */
export function expenseRecurrenceQuery(id: string) {
    return queryOptions({
        queryKey: queryKeys.expenseRecurrences.detail(id),
        queryFn: async (): Promise<ExpenseRecurrence> =>
            dataOf(
                unwrap(await api.GET('/expense-recurrences/{id}', { params: { path: { id } } })),
            ),
        staleTime: ENTRY_STALE_TIME,
    });
}

export const useExpenseRecurrences = (showEnded: boolean) =>
    useQuery(expenseRecurrencesQuery(showEnded));
export const useExpenseRecurrence = (id: string) => useQuery(expenseRecurrenceQuery(id));

/**
 * **Encerrar série**: `PATCH /expense-recurrences/{id}` só com `{ endsOn }` (INV-0017-01).
 * Invalida pela matriz, domínio `expense-recurrence` (INV-0009-02).
 */
export function useEndExpenseRecurrence(id: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ endsOn }: EndRecurrence): Promise<ExpenseRecurrence> =>
            dataOf(
                unwrap(
                    await api.PATCH('/expense-recurrences/{id}', {
                        params: { path: { id } },
                        body: { endsOn },
                    }),
                ),
            ),
        onSuccess: () => invalidateAfter(queryClient, 'expense-recurrence'),
    });
}
