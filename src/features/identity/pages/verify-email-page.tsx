import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { ApiError } from '@/api/errors/api-error';
import { Alert } from '@/ui/components/ui/alert';
import { Button } from '@/ui/components/ui/button';

import { authErrorMessage } from '../auth-errors';
import { useAuthSession } from '../auth-session';
import { AuthLayout } from '../components/auth-layout';
import { FormAlert } from '../components/form-alert';
import { currentUserQueryOptions } from '@/api/queries/current-user';

/** Um reenvio por minuto (spec 0006, ERR-0006-06). */
export const RESEND_COOLDOWN_SECONDS = 60;

type Notice = { kind: 'enviado' | 'pendente'; text: string } | null;

function useCountdown(): [number, () => void] {
    const [until, setUntil] = useState(0);
    const [now, setNow] = useState(() => Date.now());
    const remaining = Math.max(0, Math.ceil((until - now) / 1000));

    useEffect(() => {
        if (until === 0) return;
        const timer = setInterval(() => {
            const current = Date.now();
            setNow(current);
            if (current >= until) {
                setUntil(0);
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [until]);

    const start = () => {
        const current = Date.now();
        setNow(current);
        setUntil(current + RESEND_COOLDOWN_SECONDS * 1000);
    };
    return [remaining, start];
}

interface VerifyEmailPageProps {
    /** O backend aceitou o email: a rota leva à guarda de `_app`. */
    onVerified: () => void;
    onSignedOut: () => void;
}

/** `/verificar-email`: reenviar, conferir a verificação ou sair (spec 0006). */
export function VerifyEmailPage({ onVerified, onSignedOut }: VerifyEmailPageProps) {
    const session = useAuthSession();
    const queryClient = useQueryClient();
    const email = session.currentUser()?.email;
    const [remaining, startCooldown] = useCountdown();
    const [notice, setNotice] = useState<Notice>(null);
    const [error, setError] = useState<string | null>(null);
    const [checking, setChecking] = useState(false);

    async function resend() {
        setError(null);
        setNotice(null);
        try {
            await session.sendEmailVerification();
        } catch (cause) {
            setError(authErrorMessage(cause));
            return;
        }
        startCooldown();
        setNotice({ kind: 'enviado', text: 'Enviamos um novo email de verificação.' });
    }

    async function check() {
        setError(null);
        setNotice(null);
        setChecking(true);
        try {
            await session.reloadUser();
            await session.getIdToken(true);
            await queryClient.fetchQuery({ ...currentUserQueryOptions(), staleTime: 0 });
            onVerified();
        } catch (cause) {
            if (cause instanceof ApiError && cause.code === 'EMAIL_NOT_VERIFIED') {
                setNotice({ kind: 'pendente', text: cause.userMessage });
            } else {
                setError(cause instanceof ApiError ? cause.userMessage : authErrorMessage(cause));
            }
        } finally {
            setChecking(false);
        }
    }

    async function signOut() {
        await session.signOut();
        onSignedOut();
    }

    return (
        <AuthLayout
            title="Verifique seu email"
            description={
                <>
                    Enviamos um link de verificação para{' '}
                    <strong className="text-texto">{email}</strong>. Abra o link e volte aqui.
                </>
            }
        >
            <div className="flex flex-col gap-4">
                <FormAlert message={error} />
                {notice && (
                    <Alert
                        role="status"
                        variant={notice.kind === 'enviado' ? 'positivo' : 'atencao'}
                    >
                        {notice.text}
                    </Alert>
                )}
                <Button disabled={checking} onClick={() => void check()}>
                    Já verifiquei
                </Button>
                <Button variant="outline" disabled={remaining > 0} onClick={() => void resend()}>
                    {remaining > 0 ? `Reenviar email (${remaining} s)` : 'Reenviar email'}
                </Button>
                <Button variant="ghost" onClick={() => void signOut()}>
                    Sair
                </Button>
            </div>
        </AuthLayout>
    );
}
