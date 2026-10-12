import { initializeApp } from 'firebase/app';
import {
    browserLocalPersistence,
    getAuth,
    GoogleAuthProvider,
    onAuthStateChanged,
    setPersistence,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    type User,
} from 'firebase/auth';

import { getRuntimeConfig } from '@/shared/config';

import type { AuthClient, AuthUser } from './auth-client';

function toAuthUser(user: User | null): AuthUser | null {
    return user && { uid: user.uid, email: user.email, emailVerified: user.emailVerified };
}

/** Implementação da porta com `firebase/auth`, inicializada com a configuração de runtime. */
export function createFirebaseAuthClient(): AuthClient {
    const auth = getAuth(initializeApp(getRuntimeConfig().firebase));
    const ready = setPersistence(auth, browserLocalPersistence);

    return {
        onAuthStateChanged: (listener) =>
            onAuthStateChanged(auth, (user) => {
                listener(toAuthUser(user));
            }),
        async signInWithEmail(email, password) {
            await ready;
            await signInWithEmailAndPassword(auth, email, password);
        },
        async signInWithGoogle() {
            await ready;
            await signInWithPopup(auth, new GoogleAuthProvider());
        },
        signOut: () => signOut(auth),
        getIdToken: async (forceRefresh = false) =>
            (await auth.currentUser?.getIdToken(forceRefresh)) ?? null,
    };
}
