export interface AuthUser {
    uid: string;
    email: string | null;
    emailVerified: boolean;
}

/** Porta de autenticação: o resto do código nunca toca o SDK do Firebase (INV-0003-01). */
export interface AuthClient {
    onAuthStateChanged(listener: (user: AuthUser | null) => void): () => void;
    signInWithEmail(email: string, password: string): Promise<void>;
    signInWithGoogle(): Promise<void>;
    signOut(): Promise<void>;
    getIdToken(forceRefresh?: boolean): Promise<string | null>;
}
