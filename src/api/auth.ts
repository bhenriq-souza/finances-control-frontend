import type { Middleware } from 'openapi-fetch';

import { networkError } from './errors/api-error';

export type TokenProvider = (forceRefresh: boolean) => Promise<string | null>;

let provider: TokenProvider = () => Promise.resolve(null);

/** O `app` registra o provider na inicialização; `api` não importa `identity` (spec 0003). */
export function setTokenProvider(next: TokenProvider): void {
    provider = next;
}

// Cópia da requisição guardada antes do envio: o corpo é consumido pelo `fetch`, e a repetição
// precisa reenviá-lo.
const pending = new WeakMap<Request, Request>();

async function isTokenExpired(response: Response): Promise<boolean> {
    if (response.status !== 401) return false;
    try {
        const body = (await response.clone().json()) as { error?: { code?: unknown } } | null;
        return body?.error?.code === 'TOKEN_EXPIRED';
    } catch {
        return false;
    }
}

export const authMiddleware: Middleware = {
    async onRequest({ request }) {
        const token = await provider(false);
        if (token) request.headers.set('Authorization', `Bearer ${token}`);
        pending.set(request, request.clone());
    },
    async onResponse({ request, response, options }) {
        const copy = pending.get(request);
        pending.delete(request);
        if (!copy || !(await isTokenExpired(response))) return undefined;
        // Uma única repetição (INV-0005-05): a resposta dela segue adiante, seja qual for.
        const token = await provider(true);
        const retry = new Request(copy);
        if (token) retry.headers.set('Authorization', `Bearer ${token}`);
        else retry.headers.delete('Authorization');
        try {
            return await options.fetch(retry);
        } catch {
            throw networkError();
        }
    },
    onError() {
        // Falha de rede vira ApiError `NETWORK_ERROR` (ERR-0005-01).
        return networkError();
    },
};
