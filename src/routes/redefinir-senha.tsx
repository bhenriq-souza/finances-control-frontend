import { createFileRoute } from '@tanstack/react-router';

import { redirectIfSignedIn } from '@/app/routes/guard';
import { PasswordResetPage } from '@/features/identity';

export const Route = createFileRoute('/redefinir-senha')({
    beforeLoad: redirectIfSignedIn,
    component: PasswordResetPage,
});
