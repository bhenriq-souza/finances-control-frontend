import { QueryClient } from '@tanstack/react-query';
import { render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { AuthClient, AuthUser } from './auth-client';
import { AuthSessionProvider, createAuthSession, useAuthSession } from './auth-session';

const USER: AuthUser = { uid: 'u1', email: 'a@b.c', emailVerified: false };

/** Porta controlada pelo teste: `emit` dispara o `onAuthStateChanged`. */
function controlledClient() {
    let listener: (user: AuthUser | null) => void = () => undefined;
    const client: AuthClient = {
        onAuthStateChanged: (next) => {
            listener = next;
            return () => undefined;
        },
        signInWithEmail: vi.fn().mockResolvedValue(undefined),
        signInWithGoogle: vi.fn().mockResolvedValue(undefined),
        signUpWithEmail: vi.fn().mockResolvedValue(undefined),
        signOut: vi.fn().mockResolvedValue(undefined),
        getIdToken: vi.fn().mockResolvedValue('tok'),
        sendEmailVerification: vi.fn().mockResolvedValue(undefined),
        sendPasswordReset: vi.fn().mockResolvedValue(undefined),
        reloadUser: vi.fn().mockResolvedValue({ ...USER, emailVerified: true }),
    };
    return { client, emit: (user: AuthUser | null) => listener(user) };
}

describe('auth session', () => {
    it('resolves ready() only after the first onAuthStateChanged', async () => {
        const { client, emit } = controlledClient();
        const session = createAuthSession(client, new QueryClient());
        const ready = vi.fn();
        void session.ready().then(ready);

        await Promise.resolve();
        expect(ready).not.toHaveBeenCalled();

        emit(USER);
        await vi.waitFor(() => expect(ready).toHaveBeenCalledWith(USER));
        expect(session.currentUser()).toEqual(USER);
    });

    it('waits for the listener when the SDK resolves the sign-in before notifying', async () => {
        const { client, emit } = controlledClient();
        const session = createAuthSession(client, new QueryClient());
        emit(null);
        const done = vi.fn();

        void session.signInWithEmail('a@b.c', 'x').then(done);
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(done).not.toHaveBeenCalled();

        emit(USER);
        await vi.waitFor(() => expect(done).toHaveBeenCalled());
        expect(client.signInWithEmail).toHaveBeenCalledWith('a@b.c', 'x');

        // Já com usuário, Google e cadastro não esperam.
        await session.signInWithGoogle();
        await session.signUpWithEmail('Ana', 'a@b.c', '12345678');
        expect(client.signUpWithEmail).toHaveBeenCalledWith('Ana', 'a@b.c', '12345678');
    });

    it('clears the whole query cache on sign-out (INV-0006-04)', async () => {
        const { client, emit } = controlledClient();
        const queryClient = new QueryClient();
        queryClient.setQueryData(['users', 'me'], { name: 'Ana' });
        queryClient.setQueryData(['banks'], []);
        const session = createAuthSession(client, queryClient);
        emit(USER);

        await session.signOut();

        expect(client.signOut).toHaveBeenCalled();
        expect(session.currentUser()).toBeNull();
        expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    });

    it('forwards the other port methods and keeps the reloaded user', async () => {
        const { client, emit } = controlledClient();
        const session = createAuthSession(client, new QueryClient());
        emit(USER);

        await session.sendEmailVerification();
        await session.sendPasswordReset('a@b.c');
        await expect(session.getIdToken(true)).resolves.toBe('tok');
        await expect(session.reloadUser()).resolves.toMatchObject({ emailVerified: true });

        expect(client.sendEmailVerification).toHaveBeenCalled();
        expect(client.sendPasswordReset).toHaveBeenCalledWith('a@b.c');
        expect(client.getIdToken).toHaveBeenCalledWith(true);
        expect(session.currentUser()).toMatchObject({ emailVerified: true });
    });

    it('is provided to components through AuthSessionProvider', () => {
        const { client, emit } = controlledClient();
        const session = createAuthSession(client, new QueryClient());
        emit(USER);
        function Email() {
            return <p>{useAuthSession().currentUser()?.email}</p>;
        }

        render(
            <AuthSessionProvider session={session}>
                <Email />
            </AuthSessionProvider>,
        );

        expect(screen.getByText('a@b.c')).toBeInTheDocument();
    });

    it('fails loudly outside the provider', () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        expect(() => renderHook(() => useAuthSession())).toThrow(/AuthSessionProvider/);
    });
});
