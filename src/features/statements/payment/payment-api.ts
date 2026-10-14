import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api/client';
import { ApiError, unwrap } from '@/api/errors/api-error';
import { invalidateAfter } from '@/api/queries/invalidation';

import type { Statement } from '../panel/statement-model';

import { isOpenStatement, type PaymentOutput } from './payment-model';

/**
 * Erros em que a fatura mudou noutro lugar: a fatura é recarregada (spec 0013, "Mapa de erros"),
 * com o diálogo aberto e o erro à vista.
 */
const RELOAD_CODES = new Set([
    'STATEMENT_PAYMENT_EXCEEDS_REMAINING',
    'STATEMENT_ALREADY_PAID',
    'STATEMENT_ROLLED_OVER',
    'STATEMENT_NOT_FOUND',
    'STATEMENT_PAYMENT_NOT_FOUND',
]);

/** O erro pede recarregar a fatura. */
export function isStaleStatementError(error: unknown): boolean {
    return error instanceof ApiError && RELOAD_CODES.has(error.code);
}

function useStatementMutation<TInput>(mutationFn: (input: TInput) => Promise<void>) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn,
        onSuccess: () => invalidateAfter(queryClient, 'statement'),
        onError: (error) => {
            if (isStaleStatementError(error)) void invalidateAfter(queryClient, 'statement');
        },
    });
}

/**
 * **Pagar**: na aberta, `POST /statements/current/payments` com `creditCardId`; na fechada,
 * `POST /statements/{id}/payments`. A conta vai sempre, a escolhida no formulário.
 */
export function usePayStatement(statement: Statement) {
    return useStatementMutation(async (payment: PaymentOutput) => {
        if (isOpenStatement(statement)) {
            unwrap(
                await api.POST('/statements/current/payments', {
                    body: { creditCardId: statement.creditCardId, ...payment },
                }),
            );
            return;
        }
        unwrap(
            await api.POST('/statements/{id}/payments', {
                params: { path: { id: statement.id! } },
                body: payment,
            }),
        );
    });
}

/**
 * **Desfazer pagamento**: na aberta, `DELETE /statements/current/payments/{paymentId}?creditCardId`;
 * na fechada, `DELETE /statements/{id}/payments/{paymentId}`.
 */
export function useUndoPayment(statement: Statement) {
    return useStatementMutation(async (paymentId: string) => {
        if (isOpenStatement(statement)) {
            unwrap(
                await api.DELETE('/statements/current/payments/{paymentId}', {
                    params: {
                        path: { paymentId },
                        query: { creditCardId: statement.creditCardId },
                    },
                }),
            );
            return;
        }
        unwrap(
            await api.DELETE('/statements/{id}/payments/{paymentId}', {
                params: { path: { id: statement.id!, paymentId } },
            }),
        );
    });
}

/** **Informar mínimo**: `PATCH /statements/{id}` `{ minimumPaymentCents }`. */
export function useUpdateMinimum(statementId: string) {
    return useStatementMutation(async (minimumPaymentCents: number) => {
        unwrap(
            await api.PATCH('/statements/{id}', {
                params: { path: { id: statementId } },
                body: { minimumPaymentCents },
            }),
        );
    });
}
