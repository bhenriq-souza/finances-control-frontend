import { createFileRoute, useNavigate } from '@tanstack/react-router';

import { requireSession } from '@/app/routes/guard';
import { PendingApprovalPage } from '@/features/identity';

export const Route = createFileRoute('/aguardando-aprovacao')({
    beforeLoad: requireSession,
    component: PendingApproval,
});

function PendingApproval() {
    const navigate = useNavigate();
    return (
        <PendingApprovalPage
            onApproved={() => void navigate({ to: '/' })}
            onSignedOut={() => void navigate({ to: '/entrar' })}
        />
    );
}
