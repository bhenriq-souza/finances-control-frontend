import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api/client';
import { ApiError, unwrap } from '@/api/errors/api-error';
import type { components } from '@/api/generated/schema';
import { invalidateAfter } from '@/api/queries/invalidation';

import type { Expense } from '../list/expense-model';

export type CreateExpense = components['schemas']['CreateExpense'];
export type UpdateExpense = components['schemas']['UpdateExpense'];

/** Toda escrita de despesa invalida pela matriz, domínio `expense` (INV-0009-02). */
function useExpenseMutation<TVariables, TResult>(
    mutationFn: (variables: TVariables) => Promise<TResult>,
) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn,
        onSuccess: () => invalidateAfter(queryClient, 'expense'),
    });
}

/** `POST /expenses`: a resposta é a lista criada (uma, as parcelas ou as ocorrências da série). */
export function useCreateExpense() {
    return useExpenseMutation(async (body: CreateExpense): Promise<Expense[]> => {
        const response = unwrap(await api.POST('/expenses', { body }));
        if (!response.data || response.data.length === 0) {
            throw new ApiError({ status: 201, code: 'UNEXPECTED_RESPONSE' });
        }
        return response.data;
    });
}

export interface UpdateExpenseVariables {
    body: UpdateExpense;
    /** `following`: esta e as próximas previstas da série; ausente, só esta. */
    following: boolean;
}

/** `PATCH /expenses/{id}[?scope=following]`, só com os campos alterados (INV-0012-05). */
export function useUpdateExpense(id: string) {
    return useExpenseMutation(async ({ body, following }: UpdateExpenseVariables) => {
        unwrap(
            await api.PATCH('/expenses/{id}', {
                params: following
                    ? { path: { id }, query: { scope: 'following' } }
                    : { path: { id } },
                body,
            }),
        );
    });
}

/** Conflitos que o mapa de erros manda resolver recarregando o detalhe (spec 0012). */
const RELOAD_CODES = new Set(['EXPENSE_ALREADY_PAID', 'EXPENSE_STATUS_TRANSITION_NOT_ALLOWED']);

export function useReloadOnConflict() {
    const queryClient = useQueryClient();
    return (error: unknown) => {
        if (error instanceof ApiError && RELOAD_CODES.has(error.code)) {
            void invalidateAfter(queryClient, 'expense');
        }
    };
}
