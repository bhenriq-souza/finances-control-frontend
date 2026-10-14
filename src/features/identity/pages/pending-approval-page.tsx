import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/api/errors/api-error';
import { Alert } from '@/ui/components/ui/alert';
import { Button } from '@/ui/components/ui/button';

import { authErrorMessage } from '../auth-errors';
import { useAuthSession } from '../auth-session';
import { AuthLayout } from '../components/auth-layout';
import { FormAlert } from '../components/form-alert';
import { currentUserQueryOptions } from '@/api/queries/current-user';

import { useResendVerification } from './use-resend-verification';

export const STILL_PENDING = 'Seu acesso ainda não foi liberado.';
export const EMAIL_NOT_VERIFIED_WARNING =
    'Seu email ainda não foi verificado. Abra o link que enviamos ou peça um novo email.';
const EMAIL_SENT = 'Enviamos um novo email de verificação.';

type Notice = { kind: 'enviado' | 'pendente'; text: string } | null;

interface PendingApprovalPageProps {
    /** `/users/me` já tem perfil: a rota leva a `/`. */
    onApproved: () => void;
    onSignedOut: () => void;
}

/** `/aguardando-aprovacao`: um Admin precisa liberar o acesso (spec 0006). */
export function PendingApprovalPage({ onApproved, onSignedOut }: PendingApprovalPageProps) {
    const session = useAuthSession();
    const queryClient = useQueryClient();
    // O usuário de `/users/me` que a guarda de `_app` deixou no cache (AC-0006-12).
    const { data: currentUser } = useQuery(currentUserQueryOptions());
    const emailNotVerified = currentUser?.emailVerified === false;
    const resendVerification = useResendVerification();
    const [notice, setNotice] = useState<Notice>(null);
    const [error, setError] = useState<string | null>(null);
    const [checking, setChecking] = useState(false);

    async function check() {
        setError(null);
        setNotice(null);
        setChecking(true);
        try {
            // O token novo leva ao backend a verificação feita pelo link do email (spec 0006).
            await session.reloadUser();
            await session.getIdToken(true);
            const user = await queryClient.fetchQuery({
                ...currentUserQueryOptions(),
                staleTime: 0,
            });
            if (user.profile) onApproved();
            else setNotice({ kind: 'pendente', text: STILL_PENDING });
        } catch (cause) {
            setError(cause instanceof ApiError ? cause.userMessage : authErrorMessage(cause));
        } finally {
            setChecking(false);
        }
    }

    async function resend() {
        setError(null);
        setNotice(null);
        try {
            await resendVerification.resend();
        } catch (cause) {
            setError(authErrorMessage(cause));
            return;
        }
        setNotice({ kind: 'enviado', text: EMAIL_SENT });
    }

    async function signOut() {
        await session.signOut();
        onSignedOut();
    }

    return (
        <AuthLayout
            title="Aguardando aprovação"
            description="Sua conta foi criada. Um administrador precisa liberar o seu acesso ao FTech Finance."
        >
            <div className="flex flex-col gap-4">
                {emailNotVerified && <Alert variant="atencao">{EMAIL_NOT_VERIFIED_WARNING}</Alert>}
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
                    Verificar de novo
                </Button>
                {emailNotVerified && (
                    <Button
                        variant="outline"
                        disabled={resendVerification.remaining > 0}
                        onClick={() => void resend()}
                    >
                        {resendVerification.label}
                    </Button>
                )}
                <Button variant="ghost" onClick={() => void signOut()}>
                    Sair
                </Button>
            </div>
        </AuthLayout>
    );
}
