import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { getAuthClient, type AuthUser } from '../auth-client';

interface MeResult {
    status: number;
    body: string;
}

/** Página sem tema (spec 0003): bordas mínimas para os controles ficarem visíveis no celular. */
const FIELD = 'rounded border border-input px-3 py-2';
const BUTTON = 'rounded border border-input px-3 py-2';

function rawError(error: unknown): string {
    const code = (error as { code?: unknown } | null)?.code;
    const message = error instanceof Error ? error.message : String(error);
    return `${typeof code === 'string' ? code : 'sem-codigo'}: ${message}`;
}

/**
 * Página temporária do spike (T-0006-01): diagnóstico cru de login e de `GET /api/users/me`.
 * Única exceção às regras 6 e 8 do AGENTS.md; removida pela T-0006-02.
 */
export function SpikePage() {
    const client = useMemo(() => getAuthClient(), []);
    const [user, setUser] = useState<AuthUser | null>(null);
    const [me, setMe] = useState<MeResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        const unsubscribe = client.onAuthStateChanged((next) => {
            setUser(next);
            setMe(null);
            if (!next) return;
            void (async () => {
                try {
                    const token = await client.getIdToken();
                    const response = await fetch('/api/users/me', {
                        headers: { Authorization: `Bearer ${token ?? ''}` },
                    });
                    const body = await response.text();
                    if (active) setMe({ status: response.status, body });
                } catch (cause) {
                    if (active) setError(rawError(cause));
                }
            })();
        });
        return () => {
            active = false;
            unsubscribe();
        };
    }, [client]);

    async function run(action: () => Promise<void>) {
        setError(null);
        try {
            await action();
        } catch (cause) {
            setError(rawError(cause));
        }
    }

    function onSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void run(() =>
            client.signInWithEmail(String(form.get('email')), String(form.get('password'))),
        );
    }

    return (
        <main className="mx-auto flex max-w-xl flex-col gap-4 p-6">
            <h1 className="text-2xl font-semibold">FTech Finance — spike de login</h1>
            {user ? (
                <section className="flex flex-col gap-2">
                    <p>
                        Email: <span data-testid="spike-email">{user.email}</span>
                    </p>
                    <p>
                        emailVerified:{' '}
                        <span data-testid="spike-email-verified">{String(user.emailVerified)}</span>
                    </p>
                    <p>
                        GET /api/users/me:{' '}
                        <span data-testid="spike-me-status">{me ? me.status : '...'}</span>
                    </p>
                    <pre data-testid="spike-me-body" className="overflow-auto">
                        {me?.body}
                    </pre>
                    <button
                        type="button"
                        className={BUTTON}
                        onClick={() => void run(() => client.signOut())}
                    >
                        Sair
                    </button>
                </section>
            ) : (
                <form onSubmit={onSubmit} className="flex flex-col gap-2">
                    <label className="flex flex-col">
                        Email
                        <input
                            name="email"
                            type="email"
                            required
                            autoComplete="username"
                            className={FIELD}
                        />
                    </label>
                    <label className="flex flex-col">
                        Senha
                        <input
                            className={FIELD}
                            name="password"
                            type="password"
                            required
                            autoComplete="current-password"
                        />
                    </label>
                    <button type="submit" className={BUTTON}>
                        Entrar
                    </button>
                    <button
                        type="button"
                        className={BUTTON}
                        onClick={() => void run(() => client.signInWithGoogle())}
                    >
                        Entrar com Google
                    </button>
                </form>
            )}
            {error && (
                <p role="alert" data-testid="spike-error">
                    {error}
                </p>
            )}
        </main>
    );
}
