import { queryOptions } from '@tanstack/react-query';

import { api } from '@/api/client';
import { ApiError, unwrap } from '@/api/errors/api-error';
import type { CurrentUser } from '@/api/queries/current-user';

/**
 * Chave da própria foto: leva `avatarUpdatedAt`, então uma foto nova é outra consulta e a mesma
 * versão não é pedida de novo. Fica fora da raiz `users` para que as invalidações de usuário não
 * a refaçam (spec 0006).
 */
export function avatarQueryKey(avatarUpdatedAt: string) {
    return ['user-avatar', avatarUpdatedAt] as const;
}

/** `GET /users/me/avatar?v=<avatarUpdatedAt>` pelo cliente da API (com o token), como `Blob`. */
export function avatarQueryOptions(avatarUpdatedAt: string) {
    return queryOptions({
        queryKey: avatarQueryKey(avatarUpdatedAt),
        queryFn: async (): Promise<Blob> => {
            const data = unwrap(
                await api.GET('/users/me/avatar', {
                    params: { query: { v: avatarUpdatedAt } },
                    parseAs: 'blob',
                }),
            );
            if (!(data instanceof Blob)) {
                throw new ApiError({ status: 200, code: 'UNEXPECTED_RESPONSE' });
            }
            return data;
        },
        staleTime: Infinity,
        // Sem foto, a leitura falha e as iniciais ficam (ERR-0006-10): nada a repetir.
        retry: false,
    });
}

/**
 * `PUT /users/me/avatar` com o `Blob` gerado pelo `canvas` como corpo cru e o `Content-Type` do
 * formato dele (INV-0006-07). O contrato descreve o corpo como texto; o `bodySerializer` entrega o
 * `Blob` ao `fetch` sem passar por `JSON.stringify`.
 */
export async function uploadAvatar(photo: Blob): Promise<CurrentUser> {
    const body = unwrap(
        await api.PUT('/users/me/avatar', {
            body: '',
            bodySerializer: () => photo,
            headers: { 'Content-Type': photo.type },
        }),
    );
    if (!body.data) throw new ApiError({ status: 200, code: 'UNEXPECTED_RESPONSE' });
    return body.data;
}

/** `DELETE /users/me/avatar`. */
export async function removeAvatar(): Promise<void> {
    unwrap(await api.DELETE('/users/me/avatar'));
}
