import { beforeEach, describe, expect, it, vi } from 'vitest';

const currentUser = vi.hoisted(() => ({
    value: null as { getIdToken: (force: boolean) => Promise<string> } | null,
}));

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({ name: 'app' })) }));
vi.mock('firebase/auth', () => {
    class GoogleAuthProvider {}
    return {
        GoogleAuthProvider,
        browserLocalPersistence: 'local',
        getAuth: vi.fn(() => ({
            get currentUser() {
                return currentUser.value;
            },
        })),
        setPersistence: vi.fn(() => Promise.resolve()),
        signInWithEmailAndPassword: vi.fn(() => Promise.resolve()),
        signInWithPopup: vi.fn(() => Promise.resolve()),
        signOut: vi.fn(() => Promise.resolve()),
        onAuthStateChanged: vi.fn((_auth: unknown, cb: (u: unknown) => void): (() => void) => {
            cb({ uid: 'u1', email: 'a@b.c', emailVerified: true, displayName: 'x' });
            cb(null);
            return () => undefined;
        }),
    };
});

import { initializeApp } from 'firebase/app';
import {
    GoogleAuthProvider,
    setPersistence,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
} from 'firebase/auth';

import { resetRuntimeConfigForTests } from '@/shared/config';

import { createFirebaseAuthClient } from './firebase-auth-client';

const firebase = {
    apiKey: 'k',
    authDomain: 'd.firebaseapp.com',
    projectId: 'p',
    appId: 'a',
};

describe('firebase auth client', () => {
    beforeEach(() => {
        resetRuntimeConfigForTests();
        window.__FTECH_CONFIG__ = { environment: 'local', firebase };
        currentUser.value = null;
    });

    it('initializes Firebase with the runtime config and local persistence', async () => {
        const client = createFirebaseAuthClient();
        await client.signInWithEmail('a@b.c', 'secret');

        expect(initializeApp).toHaveBeenCalledWith(firebase);
        expect(setPersistence).toHaveBeenCalledWith(expect.anything(), 'local');
        expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
            expect.anything(),
            'a@b.c',
            'secret',
        );
    });

    it('signs in with a Google popup and signs out', async () => {
        const client = createFirebaseAuthClient();
        await client.signInWithGoogle();
        await client.signOut();

        expect(signInWithPopup).toHaveBeenCalledWith(
            expect.anything(),
            expect.any(GoogleAuthProvider),
        );
        expect(signOut).toHaveBeenCalled();
    });

    it('maps the SDK user to the AuthUser shape', () => {
        const listener = vi.fn();
        createFirebaseAuthClient().onAuthStateChanged(listener);

        expect(listener).toHaveBeenNthCalledWith(1, {
            uid: 'u1',
            email: 'a@b.c',
            emailVerified: true,
        });
        expect(listener).toHaveBeenNthCalledWith(2, null);
    });

    it('returns the ID token of the current user, or null', async () => {
        const client = createFirebaseAuthClient();
        await expect(client.getIdToken()).resolves.toBeNull();

        const getIdToken = vi.fn(() => Promise.resolve('tok'));
        currentUser.value = { getIdToken };
        await expect(client.getIdToken(true)).resolves.toBe('tok');
        expect(getIdToken).toHaveBeenCalledWith(true);
    });
});
