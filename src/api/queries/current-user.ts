import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';

import { api } from '../client';
import { ApiError, unwrap } from '../errors/api-error';
import type { components } from '../generated/schema';

import { queryKeys, REFERENCE_STALE_TIME } from './keys';

export type CurrentUser = components['schemas']['UserResponse'];
export type Profile = NonNullable<CurrentUser['profile']>;

export const CURRENT_USER_QUERY_KEY = queryKeys.users.me();

/** Rótulos pt-BR dos perfis (spec 0006). */
export const PROFILE_LABELS: Record<Profile, string> = {
    ADMIN: 'Administrador',
    BILLER: 'Lançador',
    VIEWER: 'Leitor',
};

async function fetchCurrentUser(): Promise<CurrentUser> {
    const { data } = unwrap(await api.GET('/users/me'));
    if (!data) throw new ApiError({ status: 200, code: 'UNEXPECTED_RESPONSE' });
    return data;
}

/**
 * `GET /users/me`, chave `['users', 'me']`, `staleTime` de 5 minutos (spec 0009). Os códigos de estado da conta são tratados por quem
 * consulta (a guarda de `_app` e as telas de estado), não pelos efeitos globais do `app`.
 */
export function currentUserQueryOptions() {
    return queryOptions({
        queryKey: CURRENT_USER_QUERY_KEY,
        queryFn: fetchCurrentUser,
        staleTime: REFERENCE_STALE_TIME,
        meta: { globalEffects: false },
    });
}

/** Usuário do backend; a guarda de `_app` garante que já está no cache antes da renderização. */
export function useCurrentUser(): CurrentUser {
    return useSuspenseQuery(currentUserQueryOptions()).data;
}
