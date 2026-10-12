import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api/client';
import { unwrap } from '@/api/errors/api-error';
import { invalidateAfter } from '@/api/queries/invalidation';

/** Cria (`POST /expense-types`) ou renomeia (`PATCH /expense-types/{id}`) um tipo de despesa. */
export function useSaveExpenseType() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, name }: { id?: string; name: string }) => {
            if (id === undefined) {
                unwrap(await api.POST('/expense-types', { body: { name } }));
            } else {
                unwrap(
                    await api.PATCH('/expense-types/{id}', {
                        params: { path: { id } },
                        body: { name },
                    }),
                );
            }
        },
        onSuccess: () => invalidateAfter(queryClient, 'expense-types'),
    });
}

/**
 * Arquiva (`POST /expense-types/{id}/archive`) ou desarquiva (`DELETE` no mesmo caminho) um tipo
 * de despesa.
 */
export function useArchiveExpenseType() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, archive }: { id: string; archive: boolean }) => {
            const options = { params: { path: { id } } };
            unwrap(
                archive
                    ? await api.POST('/expense-types/{id}/archive', options)
                    : await api.DELETE('/expense-types/{id}/archive', options),
            );
        },
        onSuccess: () => invalidateAfter(queryClient, 'expense-types'),
    });
}
