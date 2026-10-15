import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api/client';
import { ApiError, unwrap } from '@/api/errors/api-error';
import { invalidateAfter } from '@/api/queries/invalidation';

/** A fatura mudou por fora (janela fechada, despesa sumiu): recarrega (spec 0020, mapa de erros). */
const RELOAD_CODES = new Set(['STATEMENT_CLOSED', 'EXPENSE_NOT_FOUND']);

export type ReconciliationChange = { expenseId: string; reconciled: boolean };

/**
 * `PATCH /expenses/{id}/reconciliation` (spec 0020). No sucesso, `invalidateAfter(..., 'expense')`:
 * a linha do domínio `expense` já recarrega faturas, cartões e despesas.
 */
export function useChangeReconciliation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ expenseId, reconciled }: ReconciliationChange) => {
            unwrap(
                await api.PATCH('/expenses/{id}/reconciliation', {
                    params: { path: { id: expenseId } },
                    body: { reconciled },
                }),
            );
        },
        onSuccess: () => invalidateAfter(queryClient, 'expense'),
        onError: (error) => {
            if (error instanceof ApiError && RELOAD_CODES.has(error.code)) {
                void invalidateAfter(queryClient, 'expense');
            }
        },
    });
}
