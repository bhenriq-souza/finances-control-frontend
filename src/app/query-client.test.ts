import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, networkError, type ApiErrorCode } from '@/api/errors/api-error';
import { ERROR_MESSAGES } from '@/api/errors/catalog';

import { createQueryClient, retryDelay, shouldRetry } from './query-client';

const effects = {
    onUnauthenticated: vi.fn(),
    onProfilePending: vi.fn(),
    onEmailNotVerified: vi.fn(),
    onAuthUnavailable: vi.fn(),
};

const apiError = (status: number, code: ApiErrorCode) => new ApiError({ status, code });

beforeEach(() => {
    vi.clearAllMocks();
});

describe('retry policy', () => {
    it('never retries 4xx (AC-0005-06)', () => {
        for (const status of [400, 401, 403, 404, 499]) {
            expect(shouldRetry(0, apiError(status, 'FORBIDDEN'))).toBe(false);
        }
    });

    it('retries 503 up to 2 times (AC-0005-06)', () => {
        const error = apiError(503, 'NOT_READY');
        expect([0, 1, 2].map((count) => shouldRetry(count, error))).toEqual([true, true, false]);
    });

    it('retries 5xx and NETWORK_ERROR up to 2 times', () => {
        expect(shouldRetry(1, apiError(500, 'INTERNAL_ERROR'))).toBe(true);
        expect(shouldRetry(1, networkError())).toBe(true);
        expect(shouldRetry(2, networkError())).toBe(false);
    });

    it('does not retry unknown errors', () => {
        expect(shouldRetry(0, new Error('x'))).toBe(false);
    });

    it('backs off exponentially, capped', () => {
        expect([0, 1, 2].map(retryDelay)).toEqual([1000, 2000, 4000]);
        expect(retryDelay(20)).toBe(30_000);
    });

    it('is wired as the query default and re-runs a 503 query twice', async () => {
        const client = createQueryClient(effects);
        const options = client.getDefaultOptions().queries!;
        expect(options.retry).toBe(shouldRetry);
        let calls = 0;
        const queryFn = () => {
            calls += 1;
            return Promise.reject(apiError(503, 'NOT_READY'));
        };
        await client
            .fetchQuery({ queryKey: ['x'], queryFn, retry: shouldRetry, retryDelay: () => 0 })
            .catch(() => undefined);
        expect(calls).toBe(3);
    });
});

describe('global effects', () => {
    async function failQuery(error: unknown) {
        const client = createQueryClient(effects);
        await client
            .fetchQuery({ queryKey: ['q'], queryFn: () => Promise.reject(error), retry: false })
            .catch(() => undefined);
    }

    async function failMutation(error: unknown) {
        const client = createQueryClient(effects);
        await client
            .getMutationCache()
            .build(client, { mutationFn: () => Promise.reject(error) })
            .execute(undefined)
            .catch(() => undefined);
    }

    it.each([
        ['UNAUTHENTICATED', 'onUnauthenticated'],
        ['TOKEN_EXPIRED', 'onUnauthenticated'],
        ['PROFILE_PENDING', 'onProfilePending'],
        ['EMAIL_NOT_VERIFIED', 'onEmailNotVerified'],
    ] as const)('%s from a query calls %s once (AC-0005-06)', async (code, effect) => {
        await failQuery(apiError(401, code));
        expect(effects[effect]).toHaveBeenCalledTimes(1);
    });

    it('applies the same effects to mutations', async () => {
        await failMutation(apiError(403, 'PROFILE_PENDING'));
        expect(effects.onProfilePending).toHaveBeenCalledTimes(1);
    });

    it('AUTH_UNAVAILABLE passes the catalog message', async () => {
        await failQuery(apiError(503, 'AUTH_UNAVAILABLE'));
        expect(effects.onAuthUnavailable).toHaveBeenCalledWith(ERROR_MESSAGES.AUTH_UNAVAILABLE);
    });

    // ERR-0009-03: escrita com 403 FORBIDDEN invalida `['users', 'me']`; consulta, não.
    it('a FORBIDDEN mutation invalidates the current user, a FORBIDDEN query does not', async () => {
        const client = createQueryClient(effects);
        const fetchMe = vi.fn().mockResolvedValue({ profile: 'BILLER' });
        await client.fetchQuery({ queryKey: ['users', 'me'], queryFn: fetchMe });
        const other = { queryKey: ['banks'], queryFn: vi.fn().mockResolvedValue([]) };
        await client.fetchQuery(other);
        const isStale = (key: readonly string[]) =>
            client.getQueryCache().find({ queryKey: key })?.state.isInvalidated;

        await client
            .fetchQuery({
                queryKey: ['q'],
                queryFn: () => Promise.reject(apiError(403, 'FORBIDDEN')),
                retry: false,
            })
            .catch(() => undefined);
        expect(isStale(['users', 'me'])).toBe(false);

        await client
            .getMutationCache()
            .build(client, { mutationFn: () => Promise.reject(apiError(403, 'FORBIDDEN')) })
            .execute(undefined)
            .catch(() => undefined);

        expect(isStale(['users', 'me'])).toBe(true);
        expect(isStale(['banks'])).toBe(false);
        for (const effect of Object.values(effects)) expect(effect).not.toHaveBeenCalled();
    });

    it('other mutation errors do not invalidate the current user', async () => {
        const client = createQueryClient(effects);
        await client.fetchQuery({ queryKey: ['users', 'me'], queryFn: () => Promise.resolve(1) });
        for (const error of [apiError(409, 'BANK_ALREADY_EXISTS'), new Error('x')]) {
            await client
                .getMutationCache()
                .build(client, { mutationFn: () => Promise.reject(error) })
                .execute(undefined)
                .catch(() => undefined);
        }
        expect(
            client.getQueryCache().find({ queryKey: ['users', 'me'] })?.state.isInvalidated,
        ).toBe(false);
    });

    it('other codes and non-ApiErrors trigger nothing global', async () => {
        await failQuery(apiError(404, 'EXPENSE_NOT_FOUND'));
        await failQuery(new Error('x'));
        for (const effect of Object.values(effects)) expect(effect).not.toHaveBeenCalled();
    });
});
