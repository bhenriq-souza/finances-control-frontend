import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthUser } from './auth-client';
import { createFakeAuthClient, E2E_USER_STORAGE_KEY } from './fake-auth-client';

describe('fake auth client', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('signs in as the user chosen in localStorage and notifies listeners', async () => {
        localStorage.setItem(E2E_USER_STORAGE_KEY, 'email-nao-verificado');
        const client = createFakeAuthClient();
        const seen: (AuthUser | null)[] = [];
        client.onAuthStateChanged((user) => seen.push(user));

        await client.signInWithEmail('a@b.c', 'x');

        expect(seen[0]).toBeNull();
        expect(seen[1]).toMatchObject({ emailVerified: false });
        await expect(client.getIdToken()).resolves.toMatch(/^fake-token-/);
    });

    it('signs in with Google as the chosen user too', async () => {
        localStorage.setItem(E2E_USER_STORAGE_KEY, 'ativo');
        const client = createFakeAuthClient();
        const listener = vi.fn();
        client.onAuthStateChanged(listener);

        await client.signInWithGoogle();

        expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ emailVerified: true }));
    });

    it('rejects with a Firebase-like error when no user is chosen', async () => {
        const client = createFakeAuthClient();

        await expect(client.signInWithEmail('a@b.c', 'x')).rejects.toMatchObject({
            code: 'auth/invalid-credential',
        });
        await expect(client.getIdToken()).resolves.toBeNull();
    });

    it('signs out, stops notifying after unsubscribe', async () => {
        localStorage.setItem(E2E_USER_STORAGE_KEY, 'sem-perfil');
        const client = createFakeAuthClient();
        const listener = vi.fn();
        const unsubscribe = client.onAuthStateChanged(listener);
        await client.signInWithEmail('a@b.c', 'x');

        await client.signOut();
        expect(listener).toHaveBeenLastCalledWith(null);

        unsubscribe();
        listener.mockClear();
        await client.signInWithEmail('a@b.c', 'x');
        expect(listener).not.toHaveBeenCalled();
    });
});
