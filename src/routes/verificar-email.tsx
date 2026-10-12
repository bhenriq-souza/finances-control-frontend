import { createFileRoute, useNavigate } from '@tanstack/react-router';

import { requireSession } from '@/app/routes/guard';
import { VerifyEmailPage } from '@/features/identity';

export const Route = createFileRoute('/verificar-email')({
    beforeLoad: requireSession,
    component: VerifyEmail,
});

function VerifyEmail() {
    const navigate = useNavigate();
    return (
        <VerifyEmailPage
            onVerified={() => void navigate({ to: '/' })}
            onSignedOut={() => void navigate({ to: '/entrar' })}
        />
    );
}
