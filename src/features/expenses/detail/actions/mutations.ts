import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api/client';
import { ApiError, unwrap } from '@/api/errors/api-error';
import type { components, operations } from '@/api/generated/schema';
import { invalidateAfter } from '@/api/queries/invalidation';
import { useNotify } from '@/ui/notice';

import type { Expense } from '../../list/expense-model';

export type ChangeExpenseStatus = components['schemas']['ChangeExpenseStatus'];
export type ChangePaymentMethodBody =
    operations['changeExpensePaymentMethod']['requestBody']['content']['application/json'];
export type MutationScope = components['parameters']['MutationScope'];

/** Toda ação do detalhe invalida pela matriz, domínio `expense` (INV-0009-02). */
function useExpenseMutation<TVariables, TResult>(
    mutationFn: (variables: TVariables) => Promise<TResult>,
) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn,
        onSuccess: () => invalidateAfter(queryClient, 'expense'),
    });
}

/** `PATCH /expenses/{id}/status`: `{ status }`, e `paidOn` só ao pagar. */
export function useChangeExpenseStatus(id: string) {
    return useExpenseMutation(async (body: ChangeExpenseStatus) => {
        unwrap(await api.PATCH('/expenses/{id}/status', { params: { path: { id } }, body }));
    });
}

/** A mesma transição, com o id na chamada: a lista envia a de qualquer linha (T-0012-06). */
export function useChangeAnyExpenseStatus() {
    return useExpenseMutation(async ({ id, body }: { id: string; body: ChangeExpenseStatus }) => {
        unwrap(await api.PATCH('/expenses/{id}/status', { params: { path: { id } }, body }));
    });
}

/** `DELETE /expenses/{id}`: a cascata (parcelas, série) é decidida pelo backend. */
export function useDeleteExpense(id: string) {
    return useExpenseMutation(async () => {
        unwrap(await api.DELETE('/expenses/{id}', { params: { path: { id } } }));
    });
}

/** `PATCH /expenses/{id}/payment-method[?scope=following]`; devolve as despesas movidas. */
export function useChangePaymentMethod(id: string) {
    return useExpenseMutation(
        async ({
            body,
            scope,
        }: {
            body: ChangePaymentMethodBody;
            scope?: MutationScope;
        }): Promise<Expense[]> => {
            const params = { path: { id }, ...(scope ? { query: { scope } } : {}) };
            const result = unwrap(
                await api.PATCH('/expenses/{id}/payment-method', { params, body }),
            );
            return result.data ?? [];
        },
    );
}

/** Conflitos que o mapa de erros manda resolver recarregando o detalhe. */
const RELOAD_CODES = new Set(['EXPENSE_ALREADY_PAID', 'EXPENSE_STATUS_TRANSITION_NOT_ALLOWED']);

/**
 * Efeitos de um erro de ação (spec 0012, "Mapa de erros"): `EXPENSE_NOT_FOUND` vira um aviso e
 * volta para a lista; `EXPENSE_ALREADY_PAID` e `EXPENSE_STATUS_TRANSITION_NOT_ALLOWED` recarregam
 * o detalhe (o alerta, quem mostra é o diálogo ou a tela). Devolve `true` quando saiu da tela.
 */
export function useActionErrorEffects(onBackToList: () => void) {
    const queryClient = useQueryClient();
    const notify = useNotify();
    return (error: unknown): boolean => {
        if (!(error instanceof ApiError)) return false;
        if (error.code === 'EXPENSE_NOT_FOUND') {
            notify({ tone: 'erro', message: error.userMessage });
            onBackToList();
            return true;
        }
        if (RELOAD_CODES.has(error.code)) void invalidateAfter(queryClient, 'expense');
        return false;
    };
}
