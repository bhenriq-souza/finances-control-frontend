import { queryOptions } from '@tanstack/react-query';

import { api } from '@/api/client';
import { ApiError, unwrap } from '@/api/errors/api-error';
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

/** `PATCH /users/{id}/profile`: concede ou troca o perfil. */
export async function grantProfile(id: string, profile: Profile): Promise<PlatformUser> {
    return userData(
        unwrap(
            await api.PATCH('/users/{id}/profile', {
                params: { path: { id } },
                body: { profile },
            }),
        ),
    );
}

/** `DELETE /users/{id}/profile`: revoga o acesso. */
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
