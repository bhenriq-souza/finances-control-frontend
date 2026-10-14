import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    createMemoryHistory,
    createRootRoute,
    createRouter,
    RouterProvider,
} from '@tanstack/react-router';
import { act, render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { vi } from 'vitest';

import { ThemeProvider } from '@/ui/theme/theme-provider';

import type { AuthUser } from './auth-client';
import { AuthSessionProvider, type AuthSession } from './auth-session';

/** Só para testes: sessão com todos os métodos em `vi.fn`, já com o usuário dado. */
export function fakeSession(user: AuthUser | null = null) {
    return {
        ready: vi.fn().mockResolvedValue(user),
        currentUser: vi.fn(() => user),
        signInWithEmail: vi.fn().mockResolvedValue(undefined),
        signInWithGoogle: vi.fn().mockResolvedValue(undefined),
        signUpWithEmail: vi.fn().mockResolvedValue(undefined),
        signOut: vi.fn().mockResolvedValue(undefined),
        sendEmailVerification: vi.fn().mockResolvedValue(undefined),
        sendPasswordReset: vi.fn().mockResolvedValue(undefined),
        reloadUser: vi.fn().mockResolvedValue(user),
        getIdToken: vi.fn().mockResolvedValue('tok'),
    } satisfies AuthSession;
}

/** Só para testes: monta uma página com tema, cache, sessão e um roteador em memória (`Link`). */
export async function renderPage(
    page: ReactElement,
    session: AuthSession,
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
    const router = createRouter({
        routeTree: createRootRoute({ component: () => page }),
        history: createMemoryHistory(),
    });
    await router.load();
    let result: ReturnType<typeof render> | undefined;
    await act(async () => {
        result = render(
            <ThemeProvider>
                <QueryClientProvider client={queryClient}>
                    <AuthSessionProvider session={session}>
                        <RouterProvider router={router} />
                    </AuthSessionProvider>
                </QueryClientProvider>
            </ThemeProvider>,
        );
    });
    return result!;
}
