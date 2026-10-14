import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthUser } from './auth-client';
import {
    createFakeAuthClient,
    E2E_EMAIL_VERIFIED_STORAGE_KEY,
    E2E_GOOGLE_ERROR_STORAGE_KEY,
    E2E_SIGN_UP_EMAIL_ERROR_STORAGE_KEY,
    E2E_USER_STORAGE_KEY,
} from './fake-auth-client';

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

    it.each([
        ['lancador', 'lancador@example.com'],
        ['leitor', 'leitor@example.com'],
    ])('signs in as the %s user (spec 0009)', async (key, email) => {
        localStorage.setItem(E2E_USER_STORAGE_KEY, key);
        const client = createFakeAuthClient();
        const listener = vi.fn();
        client.onAuthStateChanged(listener);

        await client.signInWithEmail('a@b.c', 'x');

        expect(listener).toHaveBeenLastCalledWith({
            uid: `e2e-${key}`,
            email,
            emailVerified: true,
        });
        await expect(client.getIdToken()).resolves.toBe(`fake-token-e2e-${key}`);
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

    it('fails Google sign-in with the code chosen by the test', async () => {
        localStorage.setItem(E2E_USER_STORAGE_KEY, 'ativo');
        localStorage.setItem(E2E_GOOGLE_ERROR_STORAGE_KEY, 'auth/popup-blocked');

        await expect(createFakeAuthClient().signInWithGoogle()).rejects.toMatchObject({
            code: 'auth/popup-blocked',
        });
    });

    it('signs up an unverified user and resolves the other new port methods', async () => {
        const client = createFakeAuthClient();
        const listener = vi.fn();
        client.onAuthStateChanged(listener);

        await client.signUpWithEmail('Nova', 'nova@example.com', '12345678');
        await client.sendEmailVerification();
        await client.sendPasswordReset('nova@example.com');

        expect(listener).toHaveBeenLastCalledWith({
            uid: 'e2e-novo',
            email: 'nova@example.com',
            emailVerified: false,
        });
        await expect(client.reloadUser()).resolves.toMatchObject({ emailVerified: false });
    });

    it('still signs up when the test makes the verification email fail (AC-0006-11)', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        localStorage.setItem(E2E_SIGN_UP_EMAIL_ERROR_STORAGE_KEY, 'auth/too-many-requests');
        const client = createFakeAuthClient();
        const listener = vi.fn();
        client.onAuthStateChanged(listener);

        await client.signUpWithEmail('Nova', 'nova@example.com', '12345678');

        expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ uid: 'e2e-novo' }));
        expect(warn).toHaveBeenCalledTimes(1);
        warn.mockRestore();
    });

    it('reloads the user as verified when the test says so', async () => {
        const client = createFakeAuthClient();
        await expect(client.reloadUser()).resolves.toBeNull();

        localStorage.setItem(E2E_USER_STORAGE_KEY, 'email-nao-verificado');
        await client.signInWithEmail('a@b.c', 'x');
        localStorage.setItem(E2E_EMAIL_VERIFIED_STORAGE_KEY, 'sim');

        await expect(client.reloadUser()).resolves.toMatchObject({ emailVerified: true });
    });
});
