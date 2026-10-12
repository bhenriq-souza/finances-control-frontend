import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
    RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen, within } from '@testing-library/react';
import { House, Wallet } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CURRENT_USER_QUERY_KEY, type CurrentUser } from '@/features/identity';

import { MorePage } from './more-page';
import type { NavItem } from './navigation';

function me(profile: CurrentUser['profile']): CurrentUser {
    return {
        id: 'id',
        email: 'ana@example.com',
        emailVerified: true,
        name: 'Ana Souza',
        profile,
        profileGrantedAt: null,
        createdAt: '2026-10-01T00:00:00Z',
    };
}

/** `matchMedia` controlável: o jsdom não o implementa. */
function stubViewport(desktop: boolean) {
    const listeners = new Set<() => void>();
    const query = {
        matches: desktop,
        addEventListener: (_: string, listener: () => void) => listeners.add(listener),
        removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
    };
    vi.stubGlobal('matchMedia', () => query);
    return {
        resize(toDesktop: boolean) {
            query.matches = toDesktop;
            listeners.forEach((listener) => listener());
        },
    };
}

const ALL = ['ADMIN', 'BILLER', 'VIEWER'] as const;
const ITEMS: readonly NavItem[] = [
    { to: '/', label: 'Início', icon: House, profiles: ALL, slot: 'barra' },
    { to: '/entrar', label: 'Contas', icon: Wallet, profiles: ALL, slot: 'mais' },
    { to: '/criar-conta', label: 'Usuários', icon: Wallet, profiles: ['ADMIN'], slot: 'mais' },
];

async function renderMore(user: CurrentUser, items?: readonly NavItem[]) {
    const queryClient = new QueryClient();
    queryClient.setQueryData(CURRENT_USER_QUERY_KEY, user);

    const root = createRootRoute();
    const home = createRoute({
        getParentRoute: () => root,
        path: '/',
        component: () => <h1>Início</h1>,
    });
    const more = createRoute({
        getParentRoute: () => root,
        path: '/mais',
        component: () => <MorePage items={items} />,
    });
    const router = createRouter({
        routeTree: root.addChildren([home, more]),
        history: createMemoryHistory({ initialEntries: ['/mais'] }),
    });
    await router.load();
    await act(async () => {
        render(
            <QueryClientProvider client={queryClient}>
                <RouterProvider router={router} />
            </QueryClientProvider>,
        );
    });
    return { router };
}

afterEach(() => {
    vi.unstubAllGlobals();
});

// AC-0009-08: `/mais` lista os itens visíveis de `slot: 'mais'`; no desktop, redireciona para `/`.
describe('MorePage (spec 0009)', () => {
    it('lists the visible mais items as large links, in order', async () => {
        stubViewport(false);
        await renderMore(me('ADMIN'), ITEMS);

        expect(screen.getByRole('heading', { name: 'Mais' })).toBeInTheDocument();
        const links = within(screen.getByRole('navigation', { name: 'Mais' })).getAllByRole('link');
        expect(links.map((link) => link.textContent)).toEqual(['Contas', 'Usuários']);
        expect(links[0]).toHaveAttribute('href', '/entrar');
        expect(links[0]).toHaveClass('min-h-14');
    });

    it('lists only the items of the user profile', async () => {
        stubViewport(false);
        await renderMore(me('VIEWER'), ITEMS);

        const nav = screen.getByRole('navigation', { name: 'Mais' });
        expect(
            within(nav)
                .getAllByRole('link')
                .map((link) => link.textContent),
        ).toEqual(['Contas']);
    });

    it('shows a short message when there is no mais item (the real list today)', async () => {
        await renderMore(me('ADMIN'));

        expect(screen.getByRole('heading', { name: 'Mais' })).toBeInTheDocument();
        expect(screen.getByText('Não há outras seções para mostrar.')).toBeInTheDocument();
        expect(screen.queryByRole('navigation', { name: 'Mais' })).not.toBeInTheDocument();
    });

    it('redirects to / on desktop', async () => {
        stubViewport(true);
        const { router } = await renderMore(me('ADMIN'), ITEMS);

        expect(await screen.findByRole('heading', { name: 'Início' })).toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/');
    });

    it('redirects to / when the screen grows to desktop', async () => {
        const viewport = stubViewport(false);
        const { router } = await renderMore(me('ADMIN'), ITEMS);
        expect(screen.getByRole('heading', { name: 'Mais' })).toBeInTheDocument();

        await act(async () => {
            viewport.resize(true);
        });
        expect(await screen.findByRole('heading', { name: 'Início' })).toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/');
    });
});
