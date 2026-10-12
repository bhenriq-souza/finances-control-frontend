import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
    RouterProvider,
} from '@tanstack/react-router';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    AuthSessionProvider,
    CURRENT_USER_QUERY_KEY,
    type AuthSession,
    type CurrentUser,
} from '@/features/identity';
import { THEME_STORAGE_KEY, ThemeProvider } from '@/ui/theme/theme-provider';

import { AppShell } from './app-shell';

function me(profile: CurrentUser['profile'], name = 'Ana Souza'): CurrentUser {
    return {
        id: 'id',
        email: 'ana@example.com',
        emailVerified: true,
        name,
        profile,
        profileGrantedAt: null,
        createdAt: '2026-10-01T00:00:00Z',
    };
}

function session(queryClient: QueryClient) {
    return {
        ready: vi.fn().mockResolvedValue(null),
        currentUser: vi.fn(() => null),
        signInWithEmail: vi.fn(),
        signInWithGoogle: vi.fn(),
        signUpWithEmail: vi.fn(),
        // Como a sessão real: sair limpa o cache (INV-0006-04).
        signOut: vi.fn(() => {
            queryClient.clear();
            return Promise.resolve();
        }),
        sendEmailVerification: vi.fn(),
        sendPasswordReset: vi.fn(),
        reloadUser: vi.fn(),
        getIdToken: vi.fn(),
    } satisfies AuthSession;
}

async function renderShell(user: CurrentUser) {
    const queryClient = new QueryClient();
    queryClient.setQueryData(CURRENT_USER_QUERY_KEY, user);
    const auth = session(queryClient);

    const root = createRootRoute();
    const app = createRoute({ getParentRoute: () => root, id: '_app', component: AppShell });
    const home = createRoute({
        getParentRoute: () => app,
        path: '/',
        component: () => <h1>Conteúdo</h1>,
    });
    const signIn = createRoute({
        getParentRoute: () => root,
        path: '/entrar',
        component: () => <h1>Entrar</h1>,
    });
    const router = createRouter({
        routeTree: root.addChildren([app.addChildren([home]), signIn]),
        history: createMemoryHistory({ initialEntries: ['/'] }),
    });
    await router.load();
    await act(async () => {
        render(
            <ThemeProvider>
                <QueryClientProvider client={queryClient}>
                    <AuthSessionProvider session={auth}>
                        <RouterProvider router={router} />
                    </AuthSessionProvider>
                </QueryClientProvider>
            </ThemeProvider>,
        );
    });
    return { auth, router, queryClient };
}

const trigger = () => screen.getByRole('button', { name: 'Menu do usuário' });

afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-tema');
});

describe('AppShell (spec 0006)', () => {
    it('renders the brand, the main navigation with the active item and the content', async () => {
        await renderShell(me('VIEWER'));

        expect(screen.getByRole('heading', { name: 'Conteúdo' })).toBeInTheDocument();
        expect(screen.getByRole('main')).toContainElement(
            screen.getByRole('heading', { name: 'Conteúdo' }),
        );
        expect(screen.getAllByText('FTech Finance').length).toBeGreaterThan(0);
        const nav = screen.getByRole('navigation', { name: 'Principal' });
        const link = within(nav).getByRole('link', { name: 'Início' });
        expect(link).toHaveAttribute('href', '/');
        expect(link).toHaveAttribute('aria-current', 'page');
    });

    it('shows the user initials and opens a menu with name, email and profile in pt-BR', async () => {
        await renderShell(me('BILLER'));

        expect(trigger()).toHaveTextContent('AS');
        expect(trigger()).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByText('ana@example.com')).not.toBeInTheDocument();

        fireEvent.click(trigger());
        expect(trigger()).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByText('Ana Souza')).toBeInTheDocument();
        expect(screen.getByText('ana@example.com')).toBeInTheDocument();
        expect(screen.getByText('Lançador')).toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'Tema' })).toBeInTheDocument();

        fireEvent.click(trigger());
        expect(screen.queryByText('ana@example.com')).not.toBeInTheDocument();
    });

    it('changes the theme from the menu, at once and stored (AC-0006-08)', async () => {
        await renderShell(me('ADMIN'));
        fireEvent.click(trigger());

        expect(screen.getByRole('radio', { name: 'Sistema' })).toBeChecked();
        fireEvent.click(screen.getByRole('radio', { name: 'Claro' }));
        expect(screen.getByRole('radio', { name: 'Claro' })).toBeChecked();
        expect(document.documentElement).toHaveAttribute('data-tema', 'claro');
        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('claro');

        fireEvent.click(screen.getByRole('radio', { name: 'Escuro' }));
        expect(document.documentElement).toHaveAttribute('data-tema', 'escuro');
    });

    it('closes with Escape, returning the focus to the trigger, and with a click outside', async () => {
        await renderShell(me('ADMIN'));

        fireEvent.click(trigger());
        fireEvent.keyDown(document, { key: 'Enter' });
        expect(trigger()).toHaveAttribute('aria-expanded', 'true');
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(trigger()).toHaveAttribute('aria-expanded', 'false');
        expect(trigger()).toHaveFocus();

        fireEvent.click(trigger());
        fireEvent.pointerDown(screen.getByText('Ana Souza'));
        expect(trigger()).toHaveAttribute('aria-expanded', 'true');
        fireEvent.pointerDown(document.body);
        expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    });

    it('"Sair" signs out, clears the query cache and goes to /entrar (AC-0006-06, INV-0006-04)', async () => {
        const { auth, router, queryClient } = await renderShell(me('ADMIN'));

        fireEvent.click(trigger());
        fireEvent.click(screen.getByRole('button', { name: 'Sair' }));

        expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
        expect(auth.signOut).toHaveBeenCalledOnce();
        expect(router.state.location.pathname).toBe('/entrar');
        expect(queryClient.getQueryData(CURRENT_USER_QUERY_KEY)).toBeUndefined();
        expect(screen.queryByText('Ana Souza')).not.toBeInTheDocument();
    });
});
