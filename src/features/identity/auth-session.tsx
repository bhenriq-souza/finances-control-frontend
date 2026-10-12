import type { QueryClient } from '@tanstack/react-query';
import { createContext, useContext, type ReactNode } from 'react';

import type { AuthClient, AuthUser } from './auth-client';

/**
 * Sessão da aplicação sobre a porta `AuthClient`: sabe quando o primeiro `onAuthStateChanged`
 * chegou (a guarda espera por ele) e qual é o usuário atual. Sair limpa todo o cache de consultas
 * (INV-0006-04).
 */
export interface AuthSession {
    /** Resolve depois do primeiro `onAuthStateChanged`, com o usuário atual. */
    ready(): Promise<AuthUser | null>;
    currentUser(): AuthUser | null;
    signInWithEmail(email: string, password: string): Promise<void>;
    signInWithGoogle(): Promise<void>;
    signUpWithEmail(name: string, email: string, password: string): Promise<void>;
    signOut(): Promise<void>;
    sendEmailVerification(): Promise<void>;
    sendPasswordReset(email: string): Promise<void>;
    reloadUser(): Promise<AuthUser | null>;
    getIdToken(forceRefresh?: boolean): Promise<string | null>;
}

export function createAuthSession(client: AuthClient, queryClient: QueryClient): AuthSession {
    let current: AuthUser | null = null;
    let resolveFirst: () => void;
    const first = new Promise<void>((resolve) => {
        resolveFirst = resolve;
    });
    const waiting = new Set<() => void>();

    client.onAuthStateChanged((user) => {
        current = user;
        resolveFirst();
        if (user) {
            waiting.forEach((wake) => {
                wake();
            });
            waiting.clear();
        }
    });

    /** O SDK pode resolver o login antes de notificar o listener: espera o usuário aparecer. */
    const untilSignedIn = () =>
        current
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                  waiting.add(resolve);
              });

    return {
        ready: async () => {
            await first;
            return current;
        },
        currentUser: () => current,
        async signInWithEmail(email, password) {
            await client.signInWithEmail(email, password);
            await untilSignedIn();
        },
        async signInWithGoogle() {
            await client.signInWithGoogle();
            await untilSignedIn();
        },
        async signUpWithEmail(name, email, password) {
            await client.signUpWithEmail(name, email, password);
            await untilSignedIn();
        },
        async signOut() {
            await client.signOut();
            current = null;
            queryClient.clear();
        },
        sendEmailVerification: () => client.sendEmailVerification(),
        sendPasswordReset: (email) => client.sendPasswordReset(email),
        async reloadUser() {
            const user = await client.reloadUser();
            current = user;
            return user;
        },
        getIdToken: (forceRefresh) => client.getIdToken(forceRefresh),
    };
}

const AuthSessionContext = createContext<AuthSession | null>(null);

export function AuthSessionProvider({
    session,
    children,
}: {
    session: AuthSession;
    children: ReactNode;
}) {
    return <AuthSessionContext.Provider value={session}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession(): AuthSession {
    const session = useContext(AuthSessionContext);
    if (!session) throw new Error('useAuthSession must be used inside AuthSessionProvider');
    return session;
}
