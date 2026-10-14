import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
    RouterProvider,
} from '@tanstack/react-router';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { House, Wallet } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    AuthSessionProvider,
    CURRENT_USER_QUERY_KEY,
    type AuthSession,
    type CurrentUser,
} from '@/features/identity';
import { THEME_STORAGE_KEY, ThemeProvider } from '@/ui/theme/theme-provider';

import { AppShell } from './app-shell';
import type { NavItem } from './navigation';

function me(profile: CurrentUser['profile'], name = 'Ana Souza'): CurrentUser {
    return {
        id: 'id',
        email: 'ana@example.com',
        emailVerified: true,
        name,
        profile,
        profileGrantedAt: null,
        avatarUpdatedAt: null,
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

async function renderShell(user: CurrentUser, items?: readonly NavItem[]) {
    const queryClient = new QueryClient();
    queryClient.setQueryData(CURRENT_USER_QUERY_KEY, user);
    const auth = session(queryClient);

    const root = createRootRoute();
    const app = createRoute({
        getParentRoute: () => root,
        id: '_app',
        component: () => <AppShell items={items} />,
    });
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

const ALL = ['ADMIN', 'BILLER', 'VIEWER'] as const;
const navItem = (
    to: NavItem['to'],
    label: string,
    slot: NavItem['slot'],
    profiles: NavItem['profiles'] = ALL,
): NavItem => ({ to, label, icon: slot === 'barra' ? House : Wallet, profiles, slot });

// AC-0009-08: a barra inferior (abaixo de `lg`) mostra até quatro itens de `slot: 'barra'` e o
// Mais; a lateral (`lg`) mostra todos e esconde o Mais. A visibilidade por tamanho é CSS, provada
// no e2e; aqui se confere a marcação.
describe('AppShell navigation slots (spec 0009)', () => {
    const items = [
        navItem('/', 'Início', 'barra'),
        navItem('/entrar', 'Despesas', 'barra'),
        navItem('/criar-conta', 'Receitas', 'barra'),
        navItem('/redefinir-senha', 'Cartões', 'barra'),
        navItem('/verificar-email', 'Quinto', 'barra'),
        navItem('/aguardando-aprovacao', 'Contas', 'mais'),
    ];
    const entry = (name: string) =>
        within(screen.getByRole('navigation', { name: 'Principal' }))
            .getByRole('link', { name })
            .closest('li');

    it('puts four bar items and Mais in the bottom bar and every item in the sidebar', async () => {
        await renderShell(me('VIEWER'), items);

        for (const name of ['Início', 'Despesas', 'Receitas', 'Cartões']) {
            expect(entry(name)).toHaveClass('flex', 'flex-1');
            expect(entry(name)).not.toHaveClass('hidden');
        }
        for (const name of ['Quinto', 'Contas']) {
            expect(entry(name)).toHaveClass('hidden', 'lg:flex');
        }
        expect(entry('Mais')).toHaveClass('flex', 'lg:hidden');
        const more = within(screen.getByRole('navigation', { name: 'Principal' })).getByRole(
            'link',
            { name: 'Mais' },
        );
        expect(more).toHaveAttribute('href', '/mais');
        expect(
            within(screen.getByRole('navigation', { name: 'Principal' }))
                .getAllByRole('link')
                .map((link) => link.textContent),
        ).toEqual(['Início', 'Despesas', 'Receitas', 'Cartões', 'Quinto', 'Contas', 'Mais']);
    });

    it('has no Mais when no mais item is visible to the profile', async () => {
        await renderShell(me('BILLER'), [
            navItem('/', 'Início', 'barra'),
            navItem('/aguardando-aprovacao', 'Usuários', 'mais', ['ADMIN']),
        ]);

        const nav = screen.getByRole('navigation', { name: 'Principal' });
        expect(within(nav).queryByRole('link', { name: 'Mais' })).not.toBeInTheDocument();
        expect(within(nav).queryByRole('link', { name: 'Usuários' })).not.toBeInTheDocument();
        expect(within(nav).getAllByRole('link')).toHaveLength(1);
    });
});
