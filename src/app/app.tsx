import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { useState } from 'react';

import {
    AuthSessionProvider,
    createAuthSession,
    CURRENT_USER_QUERY_KEY,
    getAuthClient,
} from '@/features/identity';
import { ThemeProvider } from '@/ui/theme/theme-provider';

import { createQueryClient } from './query-client';
import { createAppRouter, type AppRouter } from './router';

/**
 * Cache de consultas, sessão e roteador, ligados entre si: os efeitos globais por `code`
 * (spec 0005) navegam pelo roteador para as telas de estado da conta (spec 0006).
 */
export function createAppContext() {
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
        // Sem aviso global ainda: cada tela mostra o erro da sua consulta pelo catálogo.
        onAuthUnavailable: () => undefined,
    });
    const auth = createAuthSession(getAuthClient(), queryClient);
    const router: AppRouter = createAppRouter({ queryClient, auth });
    return { queryClient, auth, router };
}

/** Providers da aplicação: tema, estado de servidor, sessão e roteador. */
export function App() {
    const [{ queryClient, auth, router }] = useState(createAppContext);
    return (
        <ThemeProvider>
            <QueryClientProvider client={queryClient}>
                <AuthSessionProvider session={auth}>
                    <RouterProvider router={router} />
                </AuthSessionProvider>
            </QueryClientProvider>
        </ThemeProvider>
    );
}
