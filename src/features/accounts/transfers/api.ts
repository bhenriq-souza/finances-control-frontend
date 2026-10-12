import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api/client';
import { ApiError, unwrap } from '@/api/errors/api-error';
import type { components } from '@/api/generated/schema';
import { invalidateAfter } from '@/api/queries/invalidation';
import { ENTRY_STALE_TIME, queryKeys } from '@/api/queries/keys';

export type BankTransfer = components['schemas']['BankTransferResponse'];
export type BankTransferStatus = components['schemas']['BankTransferStatus'];
export type CreateBankTransfer = components['schemas']['CreateBankTransfer'];
export type UpdateBankTransfer = components['schemas']['UpdateBankTransfer'];
export type ChangeBankTransferStatus = components['schemas']['ChangeBankTransferStatus'];

/** Filtros de `GET /bank-transfers`, exatamente como enviados (os ausentes omitidos). */
export interface TransferListFilters {
    from: string;
    to: string;
    status?: BankTransferStatus;
    bankAccountId?: string;
}

function dataOf<T>(body: { data?: T } | undefined): T {
    if (body?.data === undefined) throw new ApiError({ status: 200, code: 'UNEXPECTED_RESPONSE' });
    return body.data;
}

/** `GET /bank-transfers`, chave `['bank-transfers', 'list', filtros]`. Ordem da API. */
export function transfersQuery(filters: TransferListFilters) {
    const query = {
        from: filters.from,
        to: filters.to,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.bankAccountId ? { bankAccountId: filters.bankAccountId } : {}),
    };
    return queryOptions({
        queryKey: queryKeys.bankTransfers.list(query),
        queryFn: async (): Promise<BankTransfer[]> =>
            dataOf(unwrap(await api.GET('/bank-transfers', { params: { query } }))),
        staleTime: ENTRY_STALE_TIME,
    });
}

/** `GET /bank-transfers/{id}`, chave `['bank-transfers', 'detail', id]`. */
export function transferQuery(id: string) {
    return queryOptions({
        queryKey: queryKeys.bankTransfers.detail(id),
        queryFn: async (): Promise<BankTransfer> =>
            dataOf(unwrap(await api.GET('/bank-transfers/{id}', { params: { path: { id } } }))),
        staleTime: ENTRY_STALE_TIME,
    });
}

export const useTransfers = (filters: TransferListFilters) => useQuery(transfersQuery(filters));
export const useTransfer = (id: string) => useQuery(transferQuery(id));

/** Toda escrita de transferência invalida pela matriz, domínio `transfer` (INV-0009-02). */
function useTransferMutation<TVariables, TResult>(
    mutationFn: (variables: TVariables) => Promise<TResult>,
) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn,
        onSuccess: () => invalidateAfter(queryClient, 'transfer'),
    });
}

/** `POST /bank-transfers`. */
export function useCreateTransfer() {
    return useTransferMutation(async (body: CreateBankTransfer) =>
        dataOf(unwrap(await api.POST('/bank-transfers', { body }))),
    );
}

/** `PATCH /bank-transfers/{id}`: só os campos alterados, nunca `status` nem `completedOn`. */
export function useUpdateTransfer(id: string) {
    return useTransferMutation(async (body: UpdateBankTransfer) =>
        dataOf(unwrap(await api.PATCH('/bank-transfers/{id}', { params: { path: { id } }, body }))),
    );
}

/** `PATCH /bank-transfers/{id}/status`: concluir (`COMPLETED`) ou desfazer (`SCHEDULED`). */
export function useChangeTransferStatus(id: string) {
    return useTransferMutation(async (body: ChangeBankTransferStatus) =>
        dataOf(
            unwrap(
                await api.PATCH('/bank-transfers/{id}/status', { params: { path: { id } }, body }),
            ),
        ),
    );
}

/** `DELETE /bank-transfers/{id}`: só a agendada. */
export function useDeleteTransfer(id: string) {
    return useTransferMutation(async () => {
        unwrap(await api.DELETE('/bank-transfers/{id}', { params: { path: { id } } }));
    });
}

/**
 * Conflitos que o mapa de erros manda resolver recarregando o detalhe: o alerta mostra a mensagem
 * e a invalidação do domínio `transfer` traz o estado atual.
 */
const RELOAD_CODES = new Set(['BANK_TRANSFER_ALREADY_COMPLETED', 'BANK_TRANSFER_STATUS_UNCHANGED']);

export function useReloadOnConflict() {
    const queryClient = useQueryClient();
    return (error: unknown) => {
        if (error instanceof ApiError && RELOAD_CODES.has(error.code)) {
            void invalidateAfter(queryClient, 'transfer');
        }
    };
}
