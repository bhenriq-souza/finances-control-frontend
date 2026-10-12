import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { useState } from 'react';

import {
    AuthSessionProvider,
    createAuthSession,
    CURRENT_USER_QUERY_KEY,
    getAuthClient,
} from '@/features/identity';
import { createNoticeStore } from '@/ui/notice';
import { ThemeProvider } from '@/ui/theme/theme-provider';

import { AppNotices, authUnavailableNotice } from './notices';
import { createQueryClient } from './query-client';
import { createAppRouter, type AppRouter } from './router';

/**
 * Cache de consultas, sessão, roteador e avisos, ligados entre si: os efeitos globais por `code`
 * (spec 0005) navegam pelo roteador para as telas de estado da conta (spec 0006) ou mostram um
 * aviso global (spec 0009).
 */
export function createAppContext() {
    const notices = createNoticeStore();
    // Os efeitos só disparam depois de uma consulta, quando `auth` e `router` (abaixo) já existem.
    const queryClient = createQueryClient({
        onUnauthenticated: () => {
            const from = router.state.location.href;
            void auth.signOut().then(() => {
                void router.navigate({ to: '/entrar', search: { redirect: from } });
            });
        },
        onProfilePending: () => {
            // O `/users/me` guardado ficou velho: a guarda precisa consultar de novo.
            queryClient.removeQueries({ queryKey: CURRENT_USER_QUERY_KEY });
            void router.navigate({ to: '/aguardando-aprovacao' });
        },
        onEmailNotVerified: () => {
            queryClient.removeQueries({ queryKey: CURRENT_USER_QUERY_KEY });
            void router.navigate({ to: '/verificar-email' });
        },
        onAuthUnavailable: authUnavailableNotice(notices),
    });
    const auth = createAuthSession(getAuthClient(), queryClient);
    const router: AppRouter = createAppRouter({ queryClient, auth });
    return { queryClient, auth, router, notices };
}

/** Providers da aplicação: tema, avisos, estado de servidor, sessão e roteador. */
export function App() {
    const [{ queryClient, auth, router, notices }] = useState(createAppContext);
    return (
        <ThemeProvider>
            <AppNotices store={notices}>
                <QueryClientProvider client={queryClient}>
                    <AuthSessionProvider session={auth}>
                        <RouterProvider router={router} />
                    </AuthSessionProvider>
                </QueryClientProvider>
            </AppNotices>
        </ThemeProvider>
    );
}
