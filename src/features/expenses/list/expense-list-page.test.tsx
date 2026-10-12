import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
    RouterProvider,
} from '@tanstack/react-router';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/api/client', () => ({ api: { GET: mocks.get } }));

import { CURRENT_USER_QUERY_KEY, type Profile } from '@/api/queries/current-user';
import { queryKeys } from '@/api/queries/keys';

import { ExpenseListPage } from './expense-list-page';
import { expenseListQuery, type ExpenseListSearch } from './expense-list-search';
import {
    ACCOUNT_ID,
    ACCOUNTS,
    CARD_ID,
    CARDS,
    expenseFixture,
    GROUP_ID,
    TYPE_ID,
    TYPES,
} from './expense-test-data';

const EXPENSES = [
    expenseFixture({
        id: 'mercado',
        description: 'Mercado',
        occurredOn: '2026-10-15',
        bankAccountId: null,
        creditCardId: CARD_ID,
    }),
    expenseFixture({
        id: 'aluguel',
        description: 'Aluguel',
        status: 'PAID',
        amountCents: 180000,
        occurredOn: '2026-10-05',
        recurrenceId: 'serie',
    }),
    expenseFixture({
        id: 'notebook',
        description: 'Notebook',
        status: 'OVERDUE',
        amountCents: 40000,
        occurredOn: '2026-10-10',
        installment: { groupId: GROUP_ID, number: 2, total: 3 },
    }),
    expenseFixture({
        id: 'internet',
        description: 'Internet',
        amountCents: 9990,
        occurredOn: '2026-10-20',
    }),
];

function user(profile: Profile) {
    return {
        id: 'u',
        email: 'ana@example.com',
        emailVerified: true,
        name: 'Ana',
        profile,
        profileGrantedAt: null,
        createdAt: '2026-10-01T00:00:00Z',
    };
}

interface Options {
    search?: ExpenseListSearch;
    profile?: Profile;
    expenses?: typeof EXPENSES | null;
}

async function renderList({
    search = { mes: '2026-10' },
    profile = 'ADMIN',
    expenses = EXPENSES,
}: Options = {}) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(CURRENT_USER_QUERY_KEY, user(profile));
    client.setQueryData(queryKeys.bankAccounts.all, ACCOUNTS);
    client.setQueryData(queryKeys.creditCards.all, CARDS);
    client.setQueryData(queryKeys.expenseTypes.all, TYPES);
    if (expenses) {
        client.setQueryData(queryKeys.expenses.list(expenseListQuery(search)), expenses);
    }
    const onSearchChange = vi.fn();

    const root = createRootRoute();
    const page = createRoute({
        getParentRoute: () => root,
        path: '/',
        component: () => <ExpenseListPage search={search} onSearchChange={onSearchChange} />,
    });
    const router = createRouter({
        routeTree: root.addChildren([page]),
        history: createMemoryHistory({ initialEntries: ['/'] }),
    });
    await router.load();
    await act(async () => {
        render(
            <QueryClientProvider client={client}>
                <RouterProvider router={router} />
            </QueryClientProvider>,
        );
    });
    return { onSearchChange, client };
}

beforeEach(() => {
    mocks.get.mockReset();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-20T12:00:00-03:00'));
});

afterEach(() => {
    vi.useRealTimers();
});

describe('ExpenseListPage (spec 0012)', () => {
    // AC-0012-01, INV-0012-01.
    it('shows the month in date order, with badge, account or card and a negative value', async () => {
        await renderList();

        expect(screen.getByRole('heading', { name: 'outubro de 2026' })).toBeInTheDocument();
        const table = screen.getByRole('table', { name: 'Despesas de outubro de 2026' });
        const rows = within(table).getAllByRole('row').slice(1);
        expect(rows.map((row) => within(row).getAllByRole('cell')[1]?.textContent)).toEqual([
            'AluguelFixa',
            'NotebookParcela 2 de 3',
            'Mercado',
            'Internet',
        ]);
        const [aluguel, notebook, mercado, internet] = rows as [
            HTMLElement,
            HTMLElement,
            HTMLElement,
            HTMLElement,
        ];
        expect(aluguel).toHaveTextContent('Pago');
        expect(aluguel).toHaveTextContent('Conta corrente');
        expect(aluguel).toHaveTextContent('−R$ 1.800,00');
        expect(notebook).toHaveTextContent('Vencido');
        expect(mercado).toHaveTextContent('Nubank');
        expect(internet).toHaveTextContent('Vence hoje');
        expect(internet).toHaveTextContent('Hoje');
        expect(within(aluguel).getByRole('link')).toHaveAttribute('href', '/despesas/aluguel');

        const summary = screen.getByRole('region', { name: 'Resumo' });
        expect(summary).toHaveTextContent('−R$ 2.534,80');
        expect(summary).toHaveTextContent('1 paga · 2 pendentes · 1 vencida');

        // Cartões do celular com descrição, valor, data, conta e selo.
        const cards = screen.getByRole('list', { name: 'Despesas de outubro de 2026' });
        const first = within(cards).getAllByRole('listitem')[0];
        expect(first).toHaveTextContent('Aluguel');
        expect(first).toHaveTextContent('−R$ 1.800,00');
        expect(first).toHaveTextContent('5 out. · Conta corrente');
    });

    it('moves the month with the navigation buttons, keeping the filters', async () => {
        const { onSearchChange } = await renderList({
            search: { mes: '2026-01', status: 'OPEN' },
            expenses: [],
        });

        fireEvent.click(screen.getByRole('button', { name: 'Mês anterior' }));
        expect(onSearchChange).toHaveBeenLastCalledWith({ mes: '2025-12', status: 'OPEN' });
        fireEvent.click(screen.getByRole('button', { name: 'Próximo mês' }));
        expect(onSearchChange).toHaveBeenLastCalledWith({ mes: '2026-02', status: 'OPEN' });
        expect(
            screen.getByRole('heading', { name: 'Nenhuma despesa com estes filtros.' }),
        ).toBeInTheDocument();
    });

    // AC-0012-02: cada select escreve o seu filtro na URL.
    it('writes each filter to the search', async () => {
        const { onSearchChange } = await renderList();
        const filters = screen.getByRole('region', { name: 'Filtros' });

        fireEvent.change(within(filters).getByLabelText('Status'), {
            target: { value: 'OVERDUE' },
        });
        expect(onSearchChange).toHaveBeenLastCalledWith({ mes: '2026-10', status: 'OVERDUE' });

        fireEvent.change(within(filters).getByLabelText('Conta ou cartão'), {
            target: { value: `cartao:${CARD_ID}` },
        });
        expect(onSearchChange).toHaveBeenLastCalledWith({
            mes: '2026-10',
            conta: undefined,
            cartao: CARD_ID,
        });
        fireEvent.change(within(filters).getByLabelText('Conta ou cartão'), {
            target: { value: `conta:${ACCOUNT_ID}` },
        });
        expect(onSearchChange).toHaveBeenLastCalledWith({
            mes: '2026-10',
            conta: ACCOUNT_ID,
            cartao: undefined,
        });

        fireEvent.change(within(filters).getByLabelText('Tipo'), { target: { value: TYPE_ID } });
        expect(onSearchChange).toHaveBeenLastCalledWith({ mes: '2026-10', tipo: TYPE_ID });

        fireEvent.change(within(filters).getByLabelText('Natureza'), {
            target: { value: 'FIXED' },
        });
        expect(onSearchChange).toHaveBeenLastCalledWith({ mes: '2026-10', natureza: 'FIXED' });

        fireEvent.change(within(filters).getByLabelText('Natureza'), { target: { value: '' } });
        expect(onSearchChange).toHaveBeenLastCalledWith({ mes: '2026-10', natureza: undefined });
    });

    it('lists active options and keeps an archived one only when it is the filter', async () => {
        await renderList({ search: { mes: '2026-10', tipo: TYPES[1]?.id } });
        const filters = screen.getByRole('region', { name: 'Filtros' });

        const type = within(filters).getByLabelText('Tipo');
        expect(
            within(type)
                .getAllByRole('option')
                .map((o) => o.textContent),
        ).toEqual(['Todos', 'Mercado', 'Viagem']);
        const payment = within(filters).getByLabelText('Conta ou cartão');
        expect(
            within(payment)
                .getAllByRole('option')
                .map((o) => o.textContent),
        ).toEqual(['Todos', 'Conta corrente', 'Nubank']);
    });

    it('shows a removable tag for each active filter', async () => {
        const search: ExpenseListSearch = {
            mes: '2026-10',
            status: 'OVERDUE',
            tipo: TYPE_ID,
            conta: ACCOUNT_ID,
            natureza: 'INSTALLMENT',
        };
        const { onSearchChange } = await renderList({ search });

        const tags = screen.getByRole('list', { name: 'Filtros ativos' });
        expect(
            within(tags)
                .getAllByRole('button')
                .map((b) => b.textContent),
        ).toEqual(['Vencido', 'Mercado', 'Conta corrente', 'Parcelada']);
        fireEvent.click(within(tags).getByRole('button', { name: 'Remover filtro Vencido' }));
        expect(onSearchChange).toHaveBeenLastCalledWith({ ...search, status: undefined });
    });

    it('labels a card tag and an unknown type', async () => {
        await renderList({
            search: { cartao: CARD_ID, tipo: '20000000-0000-4000-8000-0000000000ff' },
        });
        const tags = screen.getByRole('list', { name: 'Filtros ativos' });
        expect(
            within(tags)
                .getAllByRole('button')
                .map((b) => b.textContent),
        ).toEqual(['Tipo removido', 'Nubank']);
    });

    it('shows all the installments of a group without the month navigation', async () => {
        const { onSearchChange } = await renderList({
            search: { grupo: GROUP_ID },
            expenses: [EXPENSES[2]!],
        });

        expect(screen.getByRole('heading', { name: 'Todas as parcelas' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Próximo mês' })).toBeNull();
        expect(screen.getByRole('table', { name: 'Parcelas' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Remover filtro Parcelamento' }));
        expect(onSearchChange).toHaveBeenLastCalledWith({ grupo: undefined });
    });

    it('opens the filter sheet on the phone', async () => {
        await renderList({ search: { mes: '2026-10', status: 'OPEN' } });

        fireEvent.click(screen.getByRole('button', { name: 'Filtros (1)' }));
        const sheet = await screen.findByRole('dialog', { name: 'Filtros' });
        expect(within(sheet).getByLabelText('Status')).toHaveValue('OPEN');
        fireEvent.click(within(sheet).getByRole('button', { name: 'Ver despesas' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    // AC-0012-12 e INV-0009-03: **Nova despesa** só com `entries.write`.
    it('offers Nova despesa to a biller and opens it through the search', async () => {
        const { onSearchChange } = await renderList({ profile: 'BILLER' });

        fireEvent.click(screen.getByRole('button', { name: 'Nova despesa' }));
        expect(onSearchChange).toHaveBeenLastCalledWith({ mes: '2026-10', novo: 1 });
        expect(screen.getByRole('link', { name: 'Tipos de despesa' })).toHaveAttribute(
            'href',
            '/despesas/tipos',
        );
    });

    it('renders no write control for a viewer', async () => {
        await renderList({ profile: 'VIEWER' });

        expect(screen.getByRole('table')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Nova despesa' })).toBeNull();
        expect(screen.queryByRole('link', { name: 'Tipos de despesa' })).toBeNull();
    });

    it('shows the empty state of the month', async () => {
        await renderList({ expenses: [] });
        expect(
            screen.getByRole('heading', { name: 'Nenhuma despesa neste mês.' }),
        ).toBeInTheDocument();
        expect(screen.getByRole('region', { name: 'Resumo' })).toHaveTextContent('R$ 0,00');
    });

    // ERR-0012-02 / ERR-0009-01: a lista falha, o estado de erro tenta de novo.
    it('loads, fails with the catalogue message and retries', async () => {
        mocks.get.mockResolvedValue({
            data: undefined,
            error: { error: { code: 'INTERNAL_ERROR', message: 'boom' } },
            response: { ok: false, status: 500 },
        });
        await renderList({ expenses: null });

        expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar.');
        expect(mocks.get).toHaveBeenCalledWith('/expenses', {
            params: { query: { from: '2026-10-01', to: '2026-10-31' } },
        });

        mocks.get.mockReturnValue(new Promise(() => undefined));
        fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
        expect(await screen.findByRole('status', { name: 'Carregando' })).toBeInTheDocument();
    });
});
