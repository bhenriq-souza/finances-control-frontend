import { createFileRoute, useRouter } from '@tanstack/react-router';

import { redirectIfSignedIn } from '@/app/routes/guard';
import { safeRedirect, SignInPage } from '@/features/identity';

export const Route = createFileRoute('/entrar')({
    validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
        typeof search.redirect === 'string' ? { redirect: search.redirect } : {},
    beforeLoad: redirectIfSignedIn,
    component: SignIn,
});

function SignIn() {
    const { redirect } = Route.useSearch();
    const router = useRouter();
    // Só caminhos internos (INV-0006-06); o resto vai para `/` (ERR-0006-07).
    return <SignInPage onSignedIn={() => router.history.push(safeRedirect(redirect))} />;
}
