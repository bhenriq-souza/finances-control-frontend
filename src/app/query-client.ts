import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/api/errors/api-error';

/**
 * Efeitos globais por `code` (spec 0005). Injetados: o `api` só lança, e quem navega ou sai da
 * sessão é o `app`.
 */
export interface QueryClientEffects {
    onUnauthenticated: () => void;
    onProfilePending: () => void;
    onEmailNotVerified: () => void;
    onAuthUnavailable: (userMessage: string) => void;
}

const MAX_RETRIES = 2;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;

/** Sem repetição para 4xx; até 2 para falha de rede, 503 e demais 5xx. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
    if (!(error instanceof ApiError)) return false;
    const retryable = error.code === 'NETWORK_ERROR' || error.status >= 500;
    return retryable && failureCount < MAX_RETRIES;
}

/** Espera exponencial: 1 s, 2 s, 4 s… limitada a 30 s. */
export function retryDelay(attemptIndex: number): number {
    return Math.min(BASE_DELAY_MS * 2 ** attemptIndex, MAX_DELAY_MS);
}

export function createQueryClient(effects: QueryClientEffects): QueryClient {
    function handleError(error: unknown): void {
        if (!(error instanceof ApiError)) return;
        switch (error.code) {
            case 'UNAUTHENTICATED':
            case 'TOKEN_EXPIRED': // só chega aqui depois da repetição (ERR-0005-03)
                effects.onUnauthenticated();
                break;
            case 'PROFILE_PENDING':
                effects.onProfilePending();
                break;
            case 'EMAIL_NOT_VERIFIED':
                effects.onEmailNotVerified();
                break;
            case 'AUTH_UNAVAILABLE':
                effects.onAuthUnavailable(error.userMessage);
                break;
            default:
                break;
        }
    }

    return new QueryClient({
        queryCache: new QueryCache({ onError: handleError }),
        mutationCache: new MutationCache({ onError: handleError }),
        defaultOptions: {
            queries: { retry: shouldRetry, retryDelay },
        },
    });
}
