export interface AuthUser {
    uid: string;
    email: string | null;
    emailVerified: boolean;
}

/** Porta de autenticação: o resto do código nunca toca o SDK do Firebase (INV-0003-01). */
export interface AuthClient {
    // spec 0003
    onAuthStateChanged(listener: (user: AuthUser | null) => void): () => void;
    signInWithEmail(email: string, password: string): Promise<void>;
    signInWithGoogle(): Promise<void>;
    signOut(): Promise<void>;
    getIdToken(forceRefresh?: boolean): Promise<string | null>;
    // spec 0006
    /** Cria a conta, grava o nome e envia o email de verificação, nessa ordem. */
    signUpWithEmail(name: string, email: string, password: string): Promise<void>;
    sendEmailVerification(): Promise<void>;
    sendPasswordReset(email: string): Promise<void>;
    /** Recarrega o usuário do provedor (ex.: depois de verificar o email). */
    reloadUser(): Promise<AuthUser | null>;
}
