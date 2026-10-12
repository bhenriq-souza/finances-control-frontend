import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/api/errors/api-error';
import { Alert } from '@/ui/components/ui/alert';
import { Button } from '@/ui/components/ui/button';

import { GENERIC_AUTH_ERROR } from '../auth-errors';
import { useAuthSession } from '../auth-session';
import { AuthLayout } from '../components/auth-layout';
import { FormAlert } from '../components/form-alert';
import { currentUserQueryOptions } from '../current-user';

export const STILL_PENDING = 'Seu acesso ainda não foi liberado.';

interface PendingApprovalPageProps {
    /** `/users/me` já tem perfil: a rota leva a `/`. */
    onApproved: () => void;
    onSignedOut: () => void;
}

/** `/aguardando-aprovacao`: um Admin precisa liberar o acesso (spec 0006). */
export function PendingApprovalPage({ onApproved, onSignedOut }: PendingApprovalPageProps) {
    const session = useAuthSession();
    const queryClient = useQueryClient();
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [checking, setChecking] = useState(false);

    async function check() {
        setError(null);
        setPending(false);
        setChecking(true);
        try {
            const user = await queryClient.fetchQuery({
                ...currentUserQueryOptions(),
                staleTime: 0,
            });
            if (user.profile) onApproved();
            else setPending(true);
        } catch (cause) {
            setError(cause instanceof ApiError ? cause.userMessage : GENERIC_AUTH_ERROR);
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
            title="Aguardando aprovação"
            description="Sua conta foi criada. Um administrador precisa liberar o seu acesso ao FTech Finance."
        >
            <div className="flex flex-col gap-4">
                <FormAlert message={error} />
                {pending && (
                    <Alert role="status" variant="atencao">
                        {STILL_PENDING}
                    </Alert>
                )}
                <Button disabled={checking} onClick={() => void check()}>
                    Verificar de novo
                </Button>
                <Button variant="ghost" onClick={() => void signOut()}>
                    Sair
                </Button>
            </div>
        </AuthLayout>
    );
}
