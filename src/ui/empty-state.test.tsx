import {
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
    RouterProvider,
} from '@tanstack/react-router';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { EmptyState } from './empty-state';

async function renderInRouter(node: ReactNode) {
    const root = createRootRoute();
    const page = createRoute({ getParentRoute: () => root, path: '/', component: () => node });
    const router = createRouter({
        routeTree: root.addChildren([page]),
        history: createMemoryHistory({ initialEntries: ['/'] }),
    });
    await router.load();
    await act(async () => {
        render(<RouterProvider router={router} />);
    });
}

describe('EmptyState (spec 0009)', () => {
    it('vazio: title, supporting text, icon and the optional action', () => {
        const { container } = render(
            <EmptyState
                variant="vazio"
                title="Nenhuma despesa."
                description="As despesas do mês aparecem aqui."
                icon={Wallet}
                action={<button type="button">Nova despesa</button>}
            />,
        );

        expect(screen.getByRole('heading', { name: 'Nenhuma despesa.' })).toBeInTheDocument();
        expect(screen.getByText('As despesas do mês aparecem aqui.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Nova despesa' })).toBeInTheDocument();
        expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('vazio: without description nor action only the title is shown', () => {
        const { container } = render(<EmptyState variant="vazio" title="Nada." />);

        expect(container.querySelector('p')).toBeNull();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(container.querySelector('svg')).not.toBeNull();
    });

    it('erro: the catalogue message and "Tentar de novo" calling refetch (ERR-0009-01)', () => {
        const refetch = vi.fn();
        render(
            <EmptyState
                variant="erro"
                error={{ userMessage: 'Sem conexão com o servidor.' }}
                onRetry={refetch}
            />,
        );

        expect(screen.getByRole('alert')).toHaveTextContent('Sem conexão com o servidor.');
        fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
        expect(refetch).toHaveBeenCalledOnce();
    });

    it('nao-encontrado: the fixed text and a link back to the list (ERR-0009-02)', async () => {
        await renderInRouter(<EmptyState variant="nao-encontrado" backTo="/despesas" />);

        expect(
            screen.getByRole('heading', { name: 'Não encontramos este item.' }),
        ).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Voltar para a lista' })).toHaveAttribute(
            'href',
            '/despesas',
        );
    });

    it('nao-encontrado: the back label can be named after the list', async () => {
        await renderInRouter(
            <EmptyState variant="nao-encontrado" backTo="/receitas" backLabel="Ver receitas" />,
        );

        expect(screen.getByRole('link', { name: 'Ver receitas' })).toHaveAttribute(
            'href',
            '/receitas',
        );
    });

    it('sem-acesso: the fixed text, no action (ERR-0009-05)', () => {
        render(<EmptyState variant="sem-acesso" />);

        expect(
            screen.getByRole('heading', { name: 'Seu perfil não dá acesso a esta tela.' }),
        ).toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
});
