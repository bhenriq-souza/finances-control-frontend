import { beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeUser {
    uid: string;
    email: string;
    emailVerified: boolean;
    getIdToken: (force: boolean) => Promise<string>;
}

const currentUser = vi.hoisted(() => ({ value: null as FakeUser | null }));
const authInstance = vi.hoisted(() => ({ languageCode: null as string | null }));

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({ name: 'app' })) }));
vi.mock('firebase/auth', () => {
    class GoogleAuthProvider {}
    return {
        GoogleAuthProvider,
        browserLocalPersistence: 'local',
        getAuth: vi.fn(() =>
            Object.defineProperty(authInstance, 'currentUser', {
                configurable: true,
                get: () => currentUser.value,
            }),
        ),
        reload: vi.fn((user: FakeUser) => {
            user.emailVerified = true;
            return Promise.resolve();
        }),
        sendEmailVerification: vi.fn(() => Promise.resolve()),
        sendPasswordResetEmail: vi.fn(() => Promise.resolve()),
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
    reload,
    sendEmailVerification,
    sendPasswordResetEmail,
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
        authInstance.languageCode = null;
        vi.clearAllMocks();
    });

    it('initializes Firebase with the runtime config, Portuguese emails and local persistence', async () => {
        const client = createFirebaseAuthClient();
        expect(authInstance.languageCode).toBe('pt');
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
        currentUser.value = { uid: 'u1', email: 'a@b.c', emailVerified: true, getIdToken };
        await expect(client.getIdToken(true)).resolves.toBe('tok');
        expect(getIdToken).toHaveBeenCalledWith(true);
    });

    it('sends the verification email and reloads only with a current user', async () => {
        const client = createFirebaseAuthClient();
        await client.sendEmailVerification();
        await expect(client.reloadUser()).resolves.toBeNull();
        expect(sendEmailVerification).not.toHaveBeenCalled();
        expect(reload).not.toHaveBeenCalled();

        const user: FakeUser = {
            uid: 'u2',
            email: 'n@b.c',
            emailVerified: false,
            getIdToken: () => Promise.resolve('t'),
        };
        currentUser.value = user;
        await client.sendEmailVerification();
        expect(sendEmailVerification).toHaveBeenCalledWith(user);
        await expect(client.reloadUser()).resolves.toEqual({
            uid: 'u2',
            email: 'n@b.c',
            emailVerified: true,
        });
    });

    it('sends the password reset email', async () => {
        await createFirebaseAuthClient().sendPasswordReset('a@b.c');
        expect(sendPasswordResetEmail).toHaveBeenCalledWith(expect.anything(), 'a@b.c');
    });
});
