import {
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
    RouterProvider,
} from '@tanstack/react-router';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { Cents } from '@/shared/money';

import { EntryList, type EntryColumn, type EntryListProps } from './entry-list';
import { Money } from './money';
import { RowMenu } from './row-menu';

interface Entry {
    id: string;
    name: string;
    account: string;
    cents: Cents;
}

const ITEMS: readonly Entry[] = [
    { id: 'a', name: 'Mercado', account: 'Corrente', cents: 23490 as Cents },
    { id: 'b', name: 'Aluguel', account: 'Poupança', cents: 180000 as Cents },
];

const COLUMNS: readonly EntryColumn<Entry>[] = [
    { header: 'Valor', cell: (e) => <Money cents={e.cents} />, align: 'end' },
    { header: 'Descrição', cell: (e) => e.name },
    { header: 'Conta', cell: (e) => e.account, hideBelow: 'lg' },
];

async function renderInRouter(node: ReactNode) {
    const root = createRootRoute();
    const page = createRoute({ getParentRoute: () => root, path: '/', component: () => node });
    const detail = createRoute({
        getParentRoute: () => root,
        path: '/itens/$id',
        component: () => <h1>Detalhe</h1>,
    });
    const router = createRouter({
        routeTree: root.addChildren([page, detail]),
        history: createMemoryHistory({ initialEntries: ['/'] }),
    });
    await router.load();
    await act(async () => {
        render(<RouterProvider router={router} />);
    });
    return router;
}

// Sem `@testing-library/user-event` no projeto: o mínimo que o Radix lê do ponteiro e do teclado.
const user = {
    async click(element: Element) {
        await act(async () => {
            fireEvent.pointerDown(element, { button: 0, ctrlKey: false, pointerType: 'mouse' });
            fireEvent.pointerUp(element, { button: 0, pointerType: 'mouse' });
            fireEvent.click(element);
        });
    },
    async key(key: string) {
        await act(async () => {
            fireEvent.keyDown(document.activeElement ?? document.body, { key });
        });
    },
};

function list(props: Partial<EntryListProps<Entry>> = {}) {
    return (
        <EntryList
            items={ITEMS}
            getKey={(e) => e.id}
            caption="Despesas"
            columns={COLUMNS}
            renderCard={(e) => <span>cartão {e.name}</span>}
            empty={<p>Nada aqui.</p>}
            {...props}
        />
    );
}

describe('EntryList (spec 0009)', () => {
    it('renders the cards below md and a captioned table from md', async () => {
        await renderInRouter(list());

        const cards = screen.getByRole('list', { name: 'Despesas' });
        expect(cards).toHaveClass('md:hidden');
        expect(within(cards).getAllByRole('listitem')).toHaveLength(2);
        expect(within(cards).getByText('cartão Mercado')).toBeInTheDocument();

        const table = screen.getByRole('table', { name: 'Despesas' });
        expect(table).toHaveClass('hidden', 'md:table');
        expect(table.querySelector('caption')).toHaveClass('sr-only');
        expect(within(table).getAllByRole('row')).toHaveLength(3);
        expect(within(table).getByRole('columnheader', { name: 'Valor' })).toHaveClass('text-end');
        expect(within(table).getByRole('cell', { name: 'R$ 234,90' })).toHaveClass('text-end');
        expect(within(table).getByRole('columnheader', { name: 'Conta' })).toHaveClass(
            'hidden',
            'lg:table-cell',
        );
        expect(within(table).getByRole('cell', { name: 'Corrente' })).toHaveClass(
            'hidden',
            'lg:table-cell',
        );
    });

    it('without href, nothing is a link', async () => {
        await renderInRouter(list());

        expect(screen.queryAllByRole('link')).toHaveLength(0);
    });

    it('with href, the whole card and the first text cell are links', async () => {
        await renderInRouter(list({ href: (e) => `/itens/${e.id}` }));

        const cards = screen.getByRole('list', { name: 'Despesas' });
        const cardLinks = within(cards).getAllByRole('link');
        expect(cardLinks.map((link) => link.getAttribute('href'))).toEqual([
            '/itens/a',
            '/itens/b',
        ]);
        expect(cardLinks[0]).toHaveTextContent('cartão Mercado');
        expect(cardLinks[0]).toHaveClass('min-h-11');

        const table = screen.getByRole('table', { name: 'Despesas' });
        const rows = within(table).getAllByRole('row').slice(1);
        // A primeira coluna é de valor (`end`): o link vai para a primeira coluna de texto.
        const link = within(rows[1]!).getByRole('link');
        expect(link).toHaveTextContent('Aluguel');
        expect(link).toHaveAttribute('href', '/itens/b');
        expect(link.closest('td')).toBe(within(rows[1]!).getAllByRole('cell')[1]);
    });

    it('a click on the row repeats the link', async () => {
        const router = await renderInRouter(list({ href: (e) => `/itens/${e.id}` }));
        const table = screen.getByRole('table', { name: 'Despesas' });

        await act(async () => {
            fireEvent.click(within(table).getByRole('cell', { name: 'R$ 1.800,00' }));
        });

        expect(router.state.location.pathname).toBe('/itens/b');
        expect(await screen.findByRole('heading', { name: 'Detalhe' })).toBeInTheDocument();
    });

    it('a click on the link itself is left to the link', async () => {
        const router = await renderInRouter(list({ href: (e) => `/itens/${e.id}` }));
        const table = screen.getByRole('table', { name: 'Despesas' });

        await act(async () => {
            fireEvent.click(within(table).getByRole('link', { name: 'Mercado' }));
        });

        expect(router.state.location.pathname).toBe('/itens/a');
        expect(router.history.length).toBe(2);
    });

    it('rows without href are not clickable', async () => {
        const router = await renderInRouter(list());
        const table = screen.getByRole('table', { name: 'Despesas' });
        const row = within(table).getAllByRole('row')[1]!;

        expect(row).not.toHaveClass('cursor-pointer');
        fireEvent.click(row);
        expect(router.state.location.pathname).toBe('/');
    });

    it('renders `empty` instead of the list and the table when there are no items', async () => {
        await renderInRouter(list({ items: [] }));

        expect(screen.getByText('Nada aqui.')).toBeInTheDocument();
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
        expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });

    describe('actions', () => {
        const actions = (e: Entry, onSelect = () => undefined) => (
            <RowMenu label={`Ações de ${e.name}`} items={[{ label: 'Editar', onSelect }]} />
        );

        it('adds a last table column with an accessible "Ações" header and a menu per row', async () => {
            await renderInRouter(list({ actions: (e) => actions(e) }));
            const table = screen.getByRole('table', { name: 'Despesas' });

            const headers = within(table).getAllByRole('columnheader');
            expect(headers.at(-1)).toHaveTextContent('Ações');
            expect(within(headers.at(-1)!).getByText('Ações')).toHaveClass('sr-only');
            const rows = within(table).getAllByRole('row').slice(1);
            expect(
                within(rows[0]!).getByRole('button', { name: 'Ações de Mercado' }),
            ).toBeInTheDocument();
            expect(
                within(rows[1]!).getByRole('button', { name: 'Ações de Aluguel' }),
            ).toBeInTheDocument();
        });

        it('puts the card menu beside the link, never inside it', async () => {
            await renderInRouter(
                list({ href: (e) => `/itens/${e.id}`, actions: (e) => actions(e) }),
            );
            const cards = screen.getByRole('list', { name: 'Despesas' });
            const menu = within(cards).getByRole('button', { name: 'Ações de Mercado' });

            expect(menu.closest('a')).toBeNull();
            expect(menu.closest('li')).toBe(within(cards).getAllByRole('listitem')[0]);
        });

        it('a click on the menu or on its items does not follow the row link', async () => {
            const onSelect = vi.fn();
            const router = await renderInRouter(
                list({ href: (e) => `/itens/${e.id}`, actions: (e) => actions(e, onSelect) }),
            );
            const table = screen.getByRole('table', { name: 'Despesas' });

            await user.click(within(table).getByRole('button', { name: 'Ações de Mercado' }));
            expect(router.state.location.pathname).toBe('/');
            await user.click(await screen.findByRole('menuitem', { name: 'Editar' }));

            expect(onSelect).toHaveBeenCalledTimes(1);
            expect(router.state.location.pathname).toBe('/');
        });

        it('without actions there is no extra column', async () => {
            await renderInRouter(list());

            expect(screen.queryByRole('columnheader', { name: 'Ações' })).not.toBeInTheDocument();
        });
    });
});
