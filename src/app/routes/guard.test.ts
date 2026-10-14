import { QueryClient } from '@tanstack/react-query';
import { isRedirect, type ParsedLocation } from '@tanstack/react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, type ApiErrorCode } from '@/api/errors/api-error';
import type { AuthSession, AuthUser, CurrentUser } from '@/features/identity';

const mocks = vi.hoisted(() => ({ queryFn: vi.fn() }));

vi.mock('@/features/identity', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/features/identity')>()),
    currentUserQueryOptions: () => ({ queryKey: ['users', 'me'], queryFn: mocks.queryFn }),
}));

import type { RouterContext } from '../router-context';

import { guardApp, redirectIfSignedIn, requireSession } from './guard';

const USER: AuthUser = { uid: 'u1', email: 'a@b.c', emailVerified: true };
const location = { href: '/contas?aba=1' } as ParsedLocation;

function me(profile: CurrentUser['profile']): CurrentUser {
    return {
        id: 'id',
        email: 'a@b.c',
        emailVerified: true,
        name: 'Ana',
        profile,
        profileGrantedAt: null,
        avatarUpdatedAt: null,
        createdAt: '2026-10-01T00:00:00Z',
    };
}

function contextWith(user: AuthUser | null): RouterContext {
    const auth = {
        ready: vi.fn().mockResolvedValue(user),
        signOut: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuthSession;
    return {
        auth,
        queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    };
}

/** Executa e devolve o redirecionamento lançado (ou falha o teste). */
async function redirectOf(run: Promise<unknown>) {
    const thrown: unknown = await run.then(
        () => undefined,
        (error: unknown) => error,
    );
    if (!isRedirect(thrown)) throw new Error(`expected a redirect, got ${String(thrown)}`);
    return thrown.options;
}

const failWith = (code: ApiErrorCode, status = 403) =>
    mocks.queryFn.mockRejectedValue(new ApiError({ status, code }));

beforeEach(() => {
    mocks.queryFn.mockReset();
});

describe('_app guard (spec 0006)', () => {
    it('without a user goes to /entrar with the current route, without calling /users/me (AC-0006-02, INV-0006-01)', async () => {
        const context = contextWith(null);

        const options = await redirectOf(guardApp({ context, location }));

        expect(options).toMatchObject({ to: '/entrar', search: { redirect: '/contas?aba=1' } });
        expect(mocks.queryFn).not.toHaveBeenCalled();
    });

    it('lets the user with a profile through, with the user in the route context', async () => {
        mocks.queryFn.mockResolvedValue(me('ADMIN'));

        await expect(guardApp({ context: contextWith(USER), location })).resolves.toEqual({
            currentUser: me('ADMIN'),
        });
    });

    it('sends a user without a profile to /aguardando-aprovacao (AC-0006-03, INV-0006-02)', async () => {
        mocks.queryFn.mockResolvedValue(me(null));

        const options = await redirectOf(guardApp({ context: contextWith(USER), location }));

        expect(options).toMatchObject({ to: '/aguardando-aprovacao' });
    });

    it('sends EMAIL_NOT_VERIFIED to /verificar-email (AC-0006-04, INV-0006-02)', async () => {
        failWith('EMAIL_NOT_VERIFIED');

        const options = await redirectOf(guardApp({ context: contextWith(USER), location }));

        expect(options).toMatchObject({ to: '/verificar-email' });
    });

    it.each(['UNAUTHENTICATED', 'TOKEN_EXPIRED'] as const)(
        'signs out and goes to /entrar on %s',
        async (code) => {
            failWith(code, 401);
            const context = contextWith(USER);

            const options = await redirectOf(guardApp({ context, location }));

            expect(context.auth.signOut).toHaveBeenCalledTimes(1);
            expect(options).toMatchObject({ to: '/entrar' });
        },
    );

    it.each([
        ['NETWORK_ERROR', 0],
        ['INTERNAL_ERROR', 500],
        ['AUTH_UNAVAILABLE', 503],
        ['FORBIDDEN', 403],
    ] as const)(
        'lets %s reach the error screen, keeping the session (ERR-0006-04, ERR-0006-05)',
        async (code, status) => {
            failWith(code, status);
            const context = contextWith(USER);

            await expect(guardApp({ context, location })).rejects.toMatchObject({ code });
            expect(context.auth.signOut).not.toHaveBeenCalled();
        },
    );

    it('rethrows errors that are not ApiError', async () => {
        mocks.queryFn.mockRejectedValue(new TypeError('boom'));

        await expect(guardApp({ context: contextWith(USER), location })).rejects.toThrow('boom');
    });

    it('reuses /users/me from the cache', async () => {
        const context = contextWith(USER);
        context.queryClient.setQueryData(['users', 'me'], me('VIEWER'));

        await expect(guardApp({ context, location })).resolves.toEqual({
            currentUser: me('VIEWER'),
        });
        expect(mocks.queryFn).not.toHaveBeenCalled();
    });
});

describe('public and account-state route guards', () => {
    it('public routes redirect to / with a session and render without one', async () => {
        expect(await redirectOf(redirectIfSignedIn({ context: contextWith(USER) }))).toMatchObject({
            to: '/',
        });
        await expect(redirectIfSignedIn({ context: contextWith(null) })).resolves.toBeUndefined();
    });

    it('account-state routes require a session', async () => {
        expect(
            await redirectOf(requireSession({ context: contextWith(null), location })),
        ).toMatchObject({ to: '/entrar', search: { redirect: '/contas?aba=1' } });
        await expect(
            requireSession({ context: contextWith(USER), location }),
        ).resolves.toBeUndefined();
    });
});
