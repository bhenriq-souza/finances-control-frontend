import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api/client';
import { ApiError, unwrap } from '@/api/errors/api-error';
import type { components } from '@/api/generated/schema';
import { invalidateAfter } from '@/api/queries/invalidation';

export type CreateRefund = components['schemas']['CreateCreditCardRefund'];
export type UpdateRefund = components['schemas']['UpdateCreditCardRefund'];

/** Numa ação, o estorno (ou a fatura) que sumiu recarrega a fatura (spec 0013, mapa de erros). */
const RELOAD_CODES = new Set(['CREDIT_CARD_REFUND_NOT_FOUND', 'STATEMENT_NOT_FOUND']);

/** As escritas de estorno: `invalidateAfter(..., 'refund')` no sucesso e num "não encontrado". */
function useRefundMutation<TInput>(write: (input: TInput) => Promise<void>) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: write,
        onSuccess: () => invalidateAfter(queryClient, 'refund'),
        onError: (error) => {
            if (error instanceof ApiError && RELOAD_CODES.has(error.code)) {
                void invalidateAfter(queryClient, 'refund');
            }
        },
    });
}

/** `POST /credit-card-refunds`. */
export function useCreateRefund() {
    return useRefundMutation(async (body: CreateRefund) => {
        unwrap(await api.POST('/credit-card-refunds', { body }));
    });
}

/** `PATCH /credit-card-refunds/{id}`: só `description` e `notes`. */
export function useUpdateRefund() {
    return useRefundMutation(async ({ id, body }: { id: string; body: UpdateRefund }) => {
        unwrap(await api.PATCH('/credit-card-refunds/{id}', { params: { path: { id } }, body }));
    });
}

/** `DELETE /credit-card-refunds/{id}`. */
export function useDeleteRefund() {
    return useRefundMutation(async (id: string) => {
        unwrap(await api.DELETE('/credit-card-refunds/{id}', { params: { path: { id } } }));
    });
}
