import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api/client';
import { ApiError, unwrap } from '@/api/errors/api-error';
import type { components } from '@/api/generated/schema';
import { invalidateAfter } from '@/api/queries/invalidation';

import type { Earning } from '../list/earning-model';

export type CreateEarning = components['schemas']['CreateEarning'];
export type UpdateEarning = components['schemas']['UpdateEarning'];

/** Alcance de uma alteração numa ocorrência de série: só ela ou ela e as próximas previstas. */
export type EarningScope = 'one' | 'following';

function dataOf<T>(body: { data?: T } | undefined): T {
    if (body?.data === undefined) throw new ApiError({ status: 200, code: 'UNEXPECTED_RESPONSE' });
    return body.data;
}

/** `POST /earnings`: a resposta é a lista criada (parcelas ou ocorrências da série). */
export function useCreateEarning() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (body: CreateEarning): Promise<Earning[]> =>
            dataOf(unwrap(await api.POST('/earnings', { body }))),
        onSuccess: () => invalidateAfter(queryClient, 'earning'),
    });
}

export interface UpdateEarningInput {
    body: UpdateEarning;
    scope: EarningScope;
}

/**
 * `PATCH /earnings/{id}[?scope=following]`, só com os campos alterados. O tipo `UpdateEarning` do
 * contrato não tem `kind`, `status`, `receivedOn` nem campos de parcela (INV-0014-04).
 */
export function useUpdateEarning(id: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ body, scope }: UpdateEarningInput): Promise<Earning> =>
            dataOf(
                unwrap(
                    await api.PATCH('/earnings/{id}', {
                        params: {
                            path: { id },
                            ...(scope === 'following' ? { query: { scope } } : {}),
                        },
                        body,
                    }),
                ),
            ),
        onSuccess: () => invalidateAfter(queryClient, 'earning'),
    });
}

/** Conflitos que o mapa de erros manda resolver recarregando o detalhe (spec 0014). */
const RELOAD_CODES = new Set(['EARNING_ALREADY_RECEIVED', 'EARNING_STATUS_TRANSITION_NOT_ALLOWED']);

/** O alerta mostra a mensagem do catálogo; a invalidação do domínio `earning` traz o estado atual. */
export function useReloadOnConflict() {
    const queryClient = useQueryClient();
    return (error: unknown) => {
        if (error instanceof ApiError && RELOAD_CODES.has(error.code)) {
            void invalidateAfter(queryClient, 'earning');
        }
    };
}
