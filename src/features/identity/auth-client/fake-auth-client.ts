import type { AuthClient, AuthUser } from './auth-client';

/** Marcador que o gate `build` procura no build de produção (INV-0002-08). */
export const E2E_FAKE_AUTH_MARKER = '__E2E_FAKE_AUTH__';

/** Chave do `localStorage` em que o e2e escolhe o usuário (spec 0006). */
export const E2E_USER_STORAGE_KEY = 'ftech.e2e.usuario';

const FIXED_USERS: Record<string, AuthUser> = {
    ativo: { uid: 'e2e-ativo', email: 'ativo@example.com', emailVerified: true },
    'sem-perfil': { uid: 'e2e-sem-perfil', email: 'sem-perfil@example.com', emailVerified: true },
    'email-nao-verificado': {
        uid: 'e2e-nao-verificado',
        email: 'nao-verificado@example.com',
        emailVerified: false,
    },
};

/** Falha como o SDK: `code` e `message` crus. */
export class FakeAuthError extends Error {
    constructor(
        readonly code: string,
        message: string,
    ) {
        super(message);
    }
}

function chosenUser(): AuthUser | null {
    const key = globalThis.localStorage.getItem(E2E_USER_STORAGE_KEY) ?? 'nenhum';
    return FIXED_USERS[key] ?? null;
}

/** Implementação em memória da porta, só existente no build `e2e`. */
export function createFakeAuthClient(): AuthClient {
    let current: AuthUser | null = null;
    const listeners = new Set<(user: AuthUser | null) => void>();

    const set = (user: AuthUser | null) => {
        current = user;
        listeners.forEach((listener) => {
            listener(user);
        });
    };
    const signIn = () => {
        const user = chosenUser();
        if (!user) {
            return Promise.reject(
                new FakeAuthError(
                    'auth/invalid-credential',
                    'Firebase: Error (auth/invalid-credential).',
                ),
            );
        }
        set(user);
        return Promise.resolve();
    };

    return {
        onAuthStateChanged(listener) {
            listeners.add(listener);
            listener(current);
            return () => {
                listeners.delete(listener);
            };
        },
        signInWithEmail: signIn,
        signInWithGoogle: signIn,
        signOut() {
            set(null);
            return Promise.resolve();
        },
        getIdToken: () => Promise.resolve(current ? `fake-token-${current.uid}` : null),
    };
}
