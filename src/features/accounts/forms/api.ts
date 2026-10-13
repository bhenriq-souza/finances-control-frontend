import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api/client';
import { unwrap } from '@/api/errors/api-error';
import type { components, operations } from '@/api/generated/schema';
import { invalidateAfter } from '@/api/queries/invalidation';

export type CreateBank = operations['createBank']['requestBody']['content']['application/json'];
export type UpdateBank = operations['updateBank']['requestBody']['content']['application/json'];
export type CreateBankAccount = components['schemas']['CreateBankAccount'];
export type UpdateBankAccount =
    operations['updateBankAccount']['requestBody']['content']['application/json'];
export type CreateCreditCard = components['schemas']['CreateCreditCard'];
export type UpdateCreditCard =
    operations['updateCreditCard']['requestBody']['content']['application/json'];

/** O que se arquiva: bancos, contas bancárias e cartões de crédito (spec 0011). */
export type ArchivableKind = 'bank' | 'bank-account' | 'credit-card';

/** Toda escrita de cadastro invalida pela matriz, domínio `accounts` (INV-0009-02). */
function useAccountsMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<void>) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn,
        onSuccess: () => invalidateAfter(queryClient, 'accounts'),
    });
}

const byId = (id: string) => ({ params: { path: { id } } });

/** `POST /banks` ou, com `id`, `PATCH /banks/{id}` (só o nome). */
export function useSaveBank() {
    return useAccountsMutation(
        async (input: { create: CreateBank } | { id: string; update: UpdateBank }) => {
            unwrap(
                'create' in input
                    ? await api.POST('/banks', { body: input.create })
                    : await api.PATCH('/banks/{id}', { ...byId(input.id), body: input.update }),
            );
        },
    );
}

/** `POST /bank-accounts` ou, com `id`, `PATCH /bank-accounts/{id}`. */
export function useSaveBankAccount() {
    return useAccountsMutation(
        async (
            input: { create: CreateBankAccount } | { id: string; update: UpdateBankAccount },
        ) => {
            unwrap(
                'create' in input
                    ? await api.POST('/bank-accounts', { body: input.create })
                    : await api.PATCH('/bank-accounts/{id}', {
                          ...byId(input.id),
                          body: input.update,
                      }),
            );
        },
    );
}

/** `POST /credit-cards` ou, com `id`, `PATCH /credit-cards/{id}`. */
export function useSaveCreditCard() {
    return useAccountsMutation(
        async (input: { create: CreateCreditCard } | { id: string; update: UpdateCreditCard }) => {
            unwrap(
                'create' in input
                    ? await api.POST('/credit-cards', { body: input.create })
                    : await api.PATCH('/credit-cards/{id}', {
                          ...byId(input.id),
                          body: input.update,
                      }),
            );
        },
    );
}

/**
 * Arquiva (`POST /…/{id}/archive`) ou desarquiva (`DELETE` no mesmo caminho) um banco, uma conta
 * ou um cartão. Reversível e idempotente: sem confirmação (spec 0011).
 */
export function useArchive() {
    return useAccountsMutation(
        async ({ kind, id, archive }: { kind: ArchivableKind; id: string; archive: boolean }) => {
            const options = byId(id);
            switch (kind) {
                case 'bank':
                    unwrap(
                        archive
                            ? await api.POST('/banks/{id}/archive', options)
                            : await api.DELETE('/banks/{id}/archive', options),
                    );
                    return;
                case 'bank-account':
                    unwrap(
                        archive
                            ? await api.POST('/bank-accounts/{id}/archive', options)
                            : await api.DELETE('/bank-accounts/{id}/archive', options),
                    );
                    return;
                case 'credit-card':
                    unwrap(
                        archive
                            ? await api.POST('/credit-cards/{id}/archive', options)
                            : await api.DELETE('/credit-cards/{id}/archive', options),
                    );
                    return;
            }
        },
    );
}
