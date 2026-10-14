import { afterEach, describe, expect, it, vi } from 'vitest';

import { getAuthClient, resetAuthClientForTests } from './index';

describe('auth client selection', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        resetAuthClientForTests();
        localStorage.clear();
    });

    it('uses the fake implementation in e2e mode', async () => {
        vi.stubEnv('MODE', 'e2e');
        localStorage.setItem('ftech.e2e.usuario', 'ativo');
        const client = getAuthClient();
        const users: unknown[] = [];
        client.onAuthStateChanged((user) => users.push(user));

        await client.signInWithEmail('a@b.c', 'x');

        await expect(client.getIdToken()).resolves.toBe('fake-token-e2e-ativo');
        expect(users.at(-1)).toMatchObject({ uid: 'e2e-ativo' });
    });

    it('forwards the spec 0006 port methods to the implementation', async () => {
        vi.stubEnv('MODE', 'e2e');
        const client = getAuthClient();

        await client.signUpWithEmail('Nova', 'nova@example.com', '12345678');
        await client.sendEmailVerification();
        await client.sendPasswordReset('nova@example.com');

        await expect(client.reloadUser()).resolves.toMatchObject({ email: 'nova@example.com' });
        await client.signInWithGoogle().catch(() => undefined);
    });

    it('does not notify a listener removed before the implementation loads', async () => {
        vi.stubEnv('MODE', 'e2e');
        const client = getAuthClient();
        const listener = vi.fn();
        client.onAuthStateChanged(listener)();

        await client.signOut();
        await Promise.resolve();

        expect(listener).not.toHaveBeenCalled();
    });

    it('uses the Firebase implementation outside e2e mode', async () => {
        vi.stubEnv('MODE', 'production');
        window.__FTECH_CONFIG__ = undefined;

        // Sem configuração de runtime, o Firebase real não inicializa: prova que o ramo é o dele.
        await expect(getAuthClient().getIdToken()).rejects.toThrow();
    });
});
