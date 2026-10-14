import { initializeApp } from 'firebase/app';
import {
    browserLocalPersistence,
    createUserWithEmailAndPassword,
    getAuth,
    GoogleAuthProvider,
    onAuthStateChanged,
    reload,
    sendEmailVerification,
    sendPasswordResetEmail,
    setPersistence,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    updateProfile,
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
    // Emails do Firebase (verificação, redefinição de senha) em português (spec 0006).
    auth.languageCode = 'pt';
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
        async signUpWithEmail(name, email, password) {
            await ready;
            const { user } = await createUserWithEmailAndPassword(auth, email, password);
            // Daqui em diante a conta existe e a sessão está aberta: uma falha não volta ao
            // formulário (uma nova tentativa daria `auth/email-already-in-use`) e o cadastro
            // segue para a guarda de `_app`, onde o email pode ser reenviado (AC-0006-11).
            await updateProfile(user, { displayName: name }).catch((error: unknown) => {
                console.warn('Cadastro: falha ao gravar o nome da conta.', error);
            });
            // Exigência do ADR-0009: o cadastro sempre envia o email de verificação.
            await sendEmailVerification(user).catch((error: unknown) => {
                console.warn('Cadastro: falha ao enviar o email de verificação.', error);
            });
        },
        async sendEmailVerification() {
            if (auth.currentUser) await sendEmailVerification(auth.currentUser);
        },
        sendPasswordReset: (email) => sendPasswordResetEmail(auth, email),
        async reloadUser() {
            if (!auth.currentUser) return null;
            await reload(auth.currentUser);
            return toAuthUser(auth.currentUser);
        },
    };
}
