import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api/client';
import { unwrap } from '@/api/errors/api-error';
import { invalidateAfter } from '@/api/queries/invalidation';

/** `POST /earning-types`. */
async function createEarningType(name: string): Promise<void> {
    unwrap(await api.POST('/earning-types', { body: { name } }));
}

/** `PATCH /earning-types/{id}`: só o nome é alterável. */
async function renameEarningType(id: string, name: string): Promise<void> {
    unwrap(await api.PATCH('/earning-types/{id}', { params: { path: { id } }, body: { name } }));
}

/** `POST` (arquivar) ou `DELETE` (desarquivar) `/earning-types/{id}/archive`. */
async function setEarningTypeArchived(id: string, archived: boolean): Promise<void> {
    const options = { params: { path: { id } } };
    unwrap(
        archived
            ? await api.POST('/earning-types/{id}/archive', options)
            : await api.DELETE('/earning-types/{id}/archive', options),
    );
}

export interface SaveEarningTypeInput {
    /** Sem `id`, cria; com `id`, renomeia. */
    id?: string;
    name: string;
}

/** Cria ou renomeia um tipo; no sucesso, `invalidateAfter(..., 'earning-types')`. */
export function useSaveEarningType() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, name }: SaveEarningTypeInput) =>
            id ? renameEarningType(id, name) : createEarningType(name),
        onSuccess: () => invalidateAfter(queryClient, 'earning-types'),
    });
}

export interface ArchiveEarningTypeInput {
    id: string;
    archived: boolean;
}

/** Arquiva ou desarquiva um tipo; no sucesso, `invalidateAfter(..., 'earning-types')`. */
export function useArchiveEarningType() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, archived }: ArchiveEarningTypeInput) =>
            setEarningTypeArchived(id, archived),
        onSuccess: () => invalidateAfter(queryClient, 'earning-types'),
    });
}
