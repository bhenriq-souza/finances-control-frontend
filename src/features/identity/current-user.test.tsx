import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/api/client', () => ({ api: { GET: mocks.get } }));

import {
    CURRENT_USER_QUERY_KEY,
    currentUserQueryOptions,
    PROFILE_LABELS,
    useCurrentUser,
    type CurrentUser,
} from './current-user';

const USER: CurrentUser = {
    id: 'id',
    email: 'a@b.c',
    emailVerified: true,
    name: 'Ana',
    profile: 'BILLER',
    profileGrantedAt: null,
    createdAt: '2026-10-01T00:00:00Z',
};

const ok = (body: unknown) => ({ data: body, response: new Response(null, { status: 200 }) });

beforeEach(() => {
    mocks.get.mockReset();
});

describe('GET /users/me query', () => {
    it('uses the key users/me, unwraps the data and opts out of the global effects', async () => {
        mocks.get.mockResolvedValue(ok({ data: USER }));
        const options = currentUserQueryOptions();

        expect(options.queryKey).toEqual(['users', 'me']);
        expect(options.meta).toEqual({ globalEffects: false });
        await expect(new QueryClient().fetchQuery(options)).resolves.toEqual(USER);
        expect(mocks.get).toHaveBeenCalledWith('/users/me');
    });

    it('throws the catalog ApiError for an error body or a body without data', async () => {
        mocks.get.mockResolvedValueOnce({
            error: { error: { code: 'EMAIL_NOT_VERIFIED', message: 'raw' } },
            response: new Response(null, { status: 403 }),
        });
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        await expect(client.fetchQuery(currentUserQueryOptions())).rejects.toMatchObject({
            code: 'EMAIL_NOT_VERIFIED',
        });

        mocks.get.mockResolvedValueOnce(ok({}));
        await expect(
            client.fetchQuery({ ...currentUserQueryOptions(), staleTime: 0 }),
        ).rejects.toMatchObject({ code: 'UNEXPECTED_RESPONSE' });
    });

    it('useCurrentUser reads the cached user', () => {
        const client = new QueryClient();
        client.setQueryData(CURRENT_USER_QUERY_KEY, USER);
        const wrapper = ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
        );

        const { result } = renderHook(() => useCurrentUser(), { wrapper });

        expect(result.current).toEqual(USER);
    });

    it('labels the profiles in pt-BR', () => {
        expect(PROFILE_LABELS).toEqual({
            ADMIN: 'Administrador',
            BILLER: 'Lançador',
            VIEWER: 'Leitor',
        });
    });
});
