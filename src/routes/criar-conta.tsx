import { createFileRoute, useNavigate } from '@tanstack/react-router';

import { redirectIfSignedIn } from '@/app/routes/guard';
import { SignUpPage } from '@/features/identity';

export const Route = createFileRoute('/criar-conta')({
    beforeLoad: redirectIfSignedIn,
    component: SignUp,
});

function SignUp() {
    const navigate = useNavigate();
    // A guarda de `_app` decide para onde a conta nova vai (AC-0006-05).
    return <SignUpPage onSignedUp={() => void navigate({ to: '/' })} />;
}
