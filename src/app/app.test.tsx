import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setTokenProvider } from '@/api/auth';
import { ApiError, type ApiErrorCode } from '@/api/errors/api-error';
import type { AuthClient, AuthUser } from '@/features/identity';

const mocks = vi.hoisted(() => ({ client: undefined as unknown as AuthClient }));

vi.mock('@/features/identity', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/features/identity')>()),
    getAuthClient: () => mocks.client,
}));
vi.mock('@/api/auth', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/api/auth')>()),
    setTokenProvider: vi.fn(),
}));

import { App, createAppContext } from './app';
import { bootstrap } from './bootstrap';

const USER: AuthUser = { uid: 'u1', email: 'a@b.c', emailVerified: true };

function fakeClient(user: AuthUser | null): AuthClient {
    return {
        onAuthStateChanged: (listener) => {
            listener(user);
            return () => undefined;
        },
        signInWithEmail: vi.fn(),
        signInWithGoogle: vi.fn(),
        signOut: vi.fn().mockResolvedValue(undefined),
        getIdToken: vi.fn().mockResolvedValue('tok'),
        signUpWithEmail: vi.fn(),
        sendEmailVerification: vi.fn(),
        sendPasswordReset: vi.fn(),
        reloadUser: vi.fn(),
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.client = fakeClient(USER);
    window.history.replaceState({}, '', '/');
});

async function failQuery(
    context: ReturnType<typeof createAppContext>,
    code: ApiErrorCode,
    meta?: Record<string, unknown>,
) {
    await context.queryClient
        .fetchQuery({
            queryKey: ['x', code],
            queryFn: () => Promise.reject(new ApiError({ status: 403, code })),
            retry: false,
            meta,
        })
        .catch(() => undefined);
}

const pathname = (context: ReturnType<typeof createAppContext>) =>
    context.router.state.location.pathname;

describe('App global effects (spec 0005 wired to the spec 0006 routes)', () => {
    it('signs out, clears the cache and goes to /entrar with the origin on UNAUTHENTICATED', async () => {
        const context = createAppContext();
        context.queryClient.setQueryData(['users', 'me'], { name: 'x' });
        await context.router.load();

        await failQuery(context, 'UNAUTHENTICATED');

        await vi.waitFor(() => expect(pathname(context)).toBe('/entrar'));
        expect(mocks.client.signOut).toHaveBeenCalledTimes(1);
        expect(context.router.state.location.search).toEqual({ redirect: '/' });
        expect(context.queryClient.getQueryData(['users', 'me'])).toBeUndefined();
    });

    it('goes to /aguardando-aprovacao on PROFILE_PENDING, dropping the cached /users/me', async () => {
        const context = createAppContext();
        context.queryClient.setQueryData(['users', 'me'], { name: 'x' });

        await failQuery(context, 'PROFILE_PENDING');

        await vi.waitFor(() => expect(pathname(context)).toBe('/aguardando-aprovacao'));
        expect(context.queryClient.getQueryData(['users', 'me'])).toBeUndefined();
    });

    it('goes to /verificar-email on EMAIL_NOT_VERIFIED', async () => {
        const context = createAppContext();

        await failQuery(context, 'EMAIL_NOT_VERIFIED');

        await vi.waitFor(() => expect(pathname(context)).toBe('/verificar-email'));
    });

    it('neither navigates nor signs out on AUTH_UNAVAILABLE, nor for queries that opt out of the global effects', async () => {
        const context = createAppContext();
        const navigate = vi.spyOn(context.router, 'navigate');

        await failQuery(context, 'AUTH_UNAVAILABLE');
        await failQuery(context, 'UNAUTHENTICATED', { globalEffects: false });

        expect(navigate).not.toHaveBeenCalled();
        expect(mocks.client.signOut).not.toHaveBeenCalled();
    });

    it('renders the router inside the providers', async () => {
        mocks.client = fakeClient(null);
        render(<App />);
        expect(
            await screen.findByRole('heading', { name: 'Entrar no FTech Finance' }),
        ).toBeInTheDocument();
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
