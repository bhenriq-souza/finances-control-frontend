import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api/client';
import { ApiError, unwrap } from '@/api/errors/api-error';
import { invalidateAfter } from '@/api/queries/invalidation';
import type { components } from '@/api/generated/schema';

type ChangeEarningStatus = components['schemas']['ChangeEarningStatus'];

/** Conflitos em que a receita mudou em outra sessão: o detalhe é recarregado (mapa de erros). */
const STALE_CODES = new Set(['EARNING_ALREADY_RECEIVED', 'EARNING_STATUS_TRANSITION_NOT_ALLOWED']);

/** O erro diz que a receita mudou noutro lugar. */
export function isStaleEarningError(error: unknown): boolean {
    return error instanceof ApiError && STALE_CODES.has(error.code);
}

export interface ChangeStatusInput {
    id: string;
    body: ChangeEarningStatus;
}

/**
 * `PATCH /earnings/{id}/status`. No sucesso, `invalidateAfter(..., 'earning')`; num conflito de
 * status, também, para recarregar o detalhe.
 */
export function useChangeEarningStatus() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, body }: ChangeStatusInput) => {
            unwrap(await api.PATCH('/earnings/{id}/status', { params: { path: { id } }, body }));
        },
        onSuccess: () => invalidateAfter(queryClient, 'earning'),
        onError: (error) => {
            if (isStaleEarningError(error)) void invalidateAfter(queryClient, 'earning');
        },
    });
}

/**
 * `DELETE /earnings/{id}`; no sucesso, `invalidateAfter(..., 'earning')` sem esperar, para que a
 * tela volte à lista antes de o detalhe excluído ser consultado de novo.
 */
export function useDeleteEarning() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            unwrap(await api.DELETE('/earnings/{id}', { params: { path: { id } } }));
        },
        onSuccess: () => {
            void invalidateAfter(queryClient, 'earning');
        },
        onError: (error) => {
            if (isStaleEarningError(error)) void invalidateAfter(queryClient, 'earning');
        },
    });
}
