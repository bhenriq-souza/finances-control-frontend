import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { useState } from 'react';

import { getAuthClient } from '@/features/identity';
import { ThemeProvider } from '@/ui/theme/theme-provider';

import { createQueryClient } from './query-client';
import { createAppRouter } from './router';

/** Providers da aplicação: estado de servidor e roteador. */
export function App() {
    const [queryClient] = useState(() =>
        createQueryClient({
            onUnauthenticated: () => {
                // T-0006-02: navegar para /entrar guardando a rota de origem.
                void getAuthClient().signOut();
            },
            // T-0006-02: navegar para /aguardando-aprovacao.
            onProfilePending: () => undefined,
            // T-0006-02: navegar para /verificar-email.
            onEmailNotVerified: () => undefined,
            // T-0006-02: aviso não bloqueante com a mensagem do catálogo.
            onAuthUnavailable: () => undefined,
        }),
    );
    const [router] = useState(createAppRouter);
    return (
        <ThemeProvider>
            <QueryClientProvider client={queryClient}>
                <RouterProvider router={router} />
            </QueryClientProvider>
        </ThemeProvider>
    );
}
