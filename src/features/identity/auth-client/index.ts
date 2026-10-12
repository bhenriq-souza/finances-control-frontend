import type { AuthClient } from './auth-client';

export type { AuthClient, AuthUser } from './auth-client';

/**
 * `import.meta.env.MODE` é constante no build: o Vite elimina o ramo falso, então o build de
 * produção não contém a implementação falsa (gate `build`, INV-0002-08) e o `e2e` não carrega o
 * SDK do Firebase. Cada ramo é um chunk à parte, carregado sob demanda.
 */
export function loadAuthClient(): Promise<AuthClient> {
    return import.meta.env.MODE === 'e2e'
        ? import('./fake-auth-client').then((m) => m.createFakeAuthClient())
        : import('./firebase-auth-client').then((m) => m.createFirebaseAuthClient());
}

let instance: Promise<AuthClient> | undefined;

/**
 * Porta única da aplicação. Síncrona para quem consome; a implementação é carregada na primeira
 * chamada, para que nem o Firebase entre no JavaScript inicial.
 */
export function getAuthClient(): AuthClient {
    const client = () => (instance ??= loadAuthClient());
    return {
        onAuthStateChanged(listener) {
            let unsubscribe: (() => void) | undefined;
            let cancelled = false;
            client().then(
                (c) => {
                    if (cancelled) return;
                    unsubscribe = c.onAuthStateChanged(listener);
                },
                // Sem implementação carregada não há sessão; o erro aparece no próximo `signIn*`.
                () => {
                    if (!cancelled) listener(null);
                },
            );
            return () => {
                cancelled = true;
                unsubscribe?.();
            };
        },
        signInWithEmail: async (email, password) =>
            (await client()).signInWithEmail(email, password),
        signInWithGoogle: async () => (await client()).signInWithGoogle(),
        signOut: async () => (await client()).signOut(),
        getIdToken: async (forceRefresh) => (await client()).getIdToken(forceRefresh),
    };
}

export function resetAuthClientForTests(): void {
    instance = undefined;
}
