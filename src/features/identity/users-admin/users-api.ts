import { queryOptions } from '@tanstack/react-query';

import { api } from '@/api/client';
import { ApiError, unwrap } from '@/api/errors/api-error';
import type { components } from '@/api/generated/schema';
import type { CurrentUser, Profile } from '@/api/queries/current-user';
import { queryKeys } from '@/api/queries/keys';

/** Um usuário da plataforma (`UserResponse` do contrato). */
export type PlatformUser = CurrentUser;

function userData(body: { data?: PlatformUser }): PlatformUser {
    if (!body.data) throw new ApiError({ status: 200, code: 'UNEXPECTED_RESPONSE' });
    return body.data;
}

/** `GET /users`, chave `['users', 'list']` (spec 0010), só `ADMIN`. */
export const usersListQuery = queryOptions({
    queryKey: queryKeys.users.list(),
    queryFn: async (): Promise<PlatformUser[]> => {
        const body = unwrap(await api.GET('/users'));
        if (!body.data) throw new ApiError({ status: 200, code: 'UNEXPECTED_RESPONSE' });
        return body.data;
    },
});

/** Um espaço (`WorkspaceResponse` do contrato). */
export type Workspace = components['schemas']['WorkspaceResponse'];

/**
 * Corpo de `PATCH /users/{id}/profile` (spec 0021, INV-0021-03): exatamente uma das três formas.
 * Aprovar em espaço novo envia sempre `profile: 'ADMIN'`.
 */
export type GrantBody =
    | { profile: Profile }
    | { profile: Profile; workspaceId: string }
    | { profile: 'ADMIN'; newWorkspace: { name: string } };

/** `GET /workspaces`, chave `['workspaces', 'list']`, só o admin da plataforma (spec 0021). */
export const workspacesListQuery = queryOptions({
    queryKey: queryKeys.workspaces.list(),
    queryFn: async (): Promise<Workspace[]> => {
        const body = unwrap(await api.GET('/workspaces'));
        if (!body.data) throw new ApiError({ status: 200, code: 'UNEXPECTED_RESPONSE' });
        return body.data;
    },
});

/** `PATCH /workspaces/{id}`: renomeia o espaço. */
export async function renameWorkspace(id: string, name: string): Promise<Workspace> {
    const body = unwrap(
        await api.PATCH('/workspaces/{id}', { params: { path: { id } }, body: { name } }),
    );
    if (!body.data) throw new ApiError({ status: 200, code: 'UNEXPECTED_RESPONSE' });
    return body.data;
}

/** `PATCH /users/{id}/profile`: aprova (espaço novo ou existente) ou troca o perfil. */
export async function grantProfile(id: string, body: GrantBody): Promise<PlatformUser> {
    return userData(
        unwrap(await api.PATCH('/users/{id}/profile', { params: { path: { id } }, body })),
    );
}

/** `DELETE /users/{id}/profile`: remove o membro do espaço. */
export async function revokeProfile(id: string): Promise<PlatformUser> {
    return userData(unwrap(await api.DELETE('/users/{id}/profile', { params: { path: { id } } })));
}

/**
 * Ordem da lista (spec 0010): primeiro os sem perfil, depois os demais; dentro de cada grupo, a
 * ordem da API.
 */
export function sortUsers(users: readonly PlatformUser[]): PlatformUser[] {
    return [
        ...users.filter((user) => user.profile === null),
        ...users.filter((user) => user.profile !== null),
    ];
}
