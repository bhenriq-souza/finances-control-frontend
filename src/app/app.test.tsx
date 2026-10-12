import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setTokenProvider } from '@/api/auth';
import { ApiError } from '@/api/errors/api-error';

const mocks = vi.hoisted(() => ({
    client: {
        signOut: vi.fn().mockResolvedValue(undefined),
        getIdToken: vi.fn().mockResolvedValue('tok'),
    },
    captured: {} as { queryClient?: QueryClient },
}));
vi.mock('@/features/identity', () => ({ getAuthClient: () => mocks.client }));
vi.mock('./router', () => ({ createAppRouter: () => ({}) }));
vi.mock('@tanstack/react-router', () => ({
    RouterProvider: () => {
        mocks.captured.queryClient = useQueryClient();
        return null;
    },
}));
vi.mock('@/api/auth', () => ({ setTokenProvider: vi.fn() }));

import { App } from './app';
import { bootstrap } from './bootstrap';

beforeEach(() => {
    vi.clearAllMocks();
});

async function failQuery(code: ConstructorParameters<typeof ApiError>[0]['code']) {
    await mocks.captured
        .queryClient!.fetchQuery({
            queryKey: [code],
            queryFn: () => Promise.reject(new ApiError({ status: 401, code })),
            retry: false,
        })
        .catch(() => undefined);
}

describe('App global effects', () => {
    it('signs out on UNAUTHENTICATED; the spec 0006 effects are still no-ops', async () => {
        render(<App />);
        await failQuery('UNAUTHENTICATED');
        expect(mocks.client.signOut).toHaveBeenCalledTimes(1);

        await failQuery('PROFILE_PENDING');
        await failQuery('EMAIL_NOT_VERIFIED');
        await failQuery('AUTH_UNAVAILABLE');
        expect(mocks.client.signOut).toHaveBeenCalledTimes(1);
    });
});

describe('bootstrap token provider', () => {
    it('registers a provider that forwards forceRefresh to the auth port', async () => {
        window.__FTECH_CONFIG__ = {
            environment: 'local',
            firebase: { apiKey: 'k', authDomain: 'd', projectId: 'p', appId: 'a' },
        };
        const container = document.createElement('div');
        let root: ReturnType<typeof bootstrap> | undefined;
        await act(async () => {
            root = bootstrap(container);
        });
        const provider = vi.mocked(setTokenProvider).mock.calls[0]![0];
        await expect(provider(true)).resolves.toBe('tok');
        expect(mocks.client.getIdToken).toHaveBeenCalledWith(true);
        act(() => root?.unmount());
        delete window.__FTECH_CONFIG__;
    });
});
