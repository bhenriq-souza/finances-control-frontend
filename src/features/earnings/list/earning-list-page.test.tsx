import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
    RouterProvider,
    useNavigate,
} from '@tanstack/react-router';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/api/client', () => ({ api: { GET: mocks.get } }));

import { CURRENT_USER_QUERY_KEY, type CurrentUser } from '@/api/queries/current-user';
import { queryKeys } from '@/api/queries/keys';

import type { Earning } from './earning-model';
import { EarningListPage } from './earning-list-page';
import { earningListSearchSchema } from './earning-search';
import {
    CHECKING,
    earning,
    FREELANCE_TYPE,
    OLD_ACCOUNT,
    OLD_TYPE,
    SALARY_TYPE,
    SAVINGS,
} from './test-data';

const EARNINGS: Earning[] = [
    earning({
        id: 'r3',
        description: 'Projeto site',
        kind: 'INSTALLMENT',
        status: 'OVERDUE',
        amountCents: 50000,
        occurredOn: '2026-10-20',
        earningType: FREELANCE_TYPE,
        bankAccountId: SAVINGS.id,
        installment: { groupId: 'grupo-1', number: 2, total: 3 },
    }),
    earning({
        id: 'r1',
        description: 'Salário',
        kind: 'FIXED',
        status: 'RECEIVED',
        amountCents: 500000,
        occurredOn: '2026-10-05',
        receivedOn: '2026-10-05',
        recurrenceId: 'serie-1',
    }),
    earning({
        id: 'r2',
        description: 'Aluguel da sala',
        status: 'FORECAST',
        amountCents: 120050,
        occurredOn: '2026-10-05',
        bankAccountId: 'conta-que-sumiu',
    }),
];

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

function ok(data: unknown) {
    return { data: { data }, response: new Response(null, { status: 200 }) };
}

function failure(status: number, code: string) {
    return {
        error: { error: { code, message: 'raw' } },
        response: new Response(null, { status }),
    };
}

async function renderList(url: string, profile: CurrentUser['profile'] = 'ADMIN') {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(CURRENT_USER_QUERY_KEY, me(profile));
    queryClient.setQueryData(queryKeys.bankAccounts.all, [CHECKING, SAVINGS, OLD_ACCOUNT]);
    queryClient.setQueryData(queryKeys.earningTypes.all, [SALARY_TYPE, FREELANCE_TYPE, OLD_TYPE]);

    const root = createRootRoute();
    const list = createRoute({
        getParentRoute: () => root,
        path: '/receitas',
        validateSearch: earningListSearchSchema,
        component: function List() {
            const search = list.useSearch();
            const navigate = useNavigate();
            return (
                <EarningListPage
                    search={search}
                    onSearchChange={(next) => void navigate({ to: '/receitas', search: next })}
                />
            );
        },
    });
    const detail = createRoute({
        getParentRoute: () => root,
        path: '/receitas/$receitaId',
        component: () => <h1>Detalhe</h1>,
    });
    const router = createRouter({
        routeTree: root.addChildren([list, detail]),
        history: createMemoryHistory({ initialEntries: [url] }),
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

/** Clique e escolha num `<select>`, esperando a navegação que eles disparam. */
const user = {
    click: (element: Element) =>
        act(async () => {
            fireEvent.click(element);
        }),
    selectOptions: (element: Element, value: string) =>
        act(async () => {
            fireEvent.change(element, { target: { value } });
        }),
};

function lastQuery() {
    const call = mocks.get.mock.calls.at(-1) as [string, { params: { query: unknown } }];
    expect(call[0]).toBe('/earnings');
    return call[1].params.query;
}

beforeEach(() => {
    mocks.get.mockReset();
    mocks.get.mockResolvedValue(ok(EARNINGS));
});

describe('EarningListPage (spec 0014)', () => {
    // AC-0014-01, INV-0014-01: o mês da URL vira `from`/`to`; valores com `+R$`, selo e conta.
    it('lists the month earnings in date order with +R$, badge and account name', async () => {
        await renderList('/receitas?mes=2026-10');

        expect(lastQuery()).toEqual({ from: '2026-10-01', to: '2026-10-31' });
        expect(screen.getByRole('heading', { name: 'Receitas', level: 1 })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'outubro de 2026' })).toBeInTheDocument();

        const table = await screen.findByRole('table', { name: 'Receitas' });
        const rows = within(table).getAllByRole('row').slice(1);
        expect(rows.map((row) => within(row).getAllByRole('cell')[1]?.textContent)).toEqual([
            'Aluguel da sala',
            'SalárioFixa',
            'Projeto siteParcela 2 de 3',
        ]);
        expect(rows[1]).toHaveTextContent('+R$ 5.000,00');
        expect(rows[1]).toHaveTextContent('Recebido');
        expect(rows[1]).toHaveTextContent('Conta corrente');
        expect(rows[0]).toHaveTextContent('+R$ 1.200,50');
        expect(rows[0]).toHaveTextContent('Previsto');
        expect(rows[0]).toHaveTextContent('Conta removida');
        expect(rows[2]).toHaveTextContent('Atrasado');
        expect(rows[2]).toHaveTextContent('Poupança');
        expect(rows[2]).toHaveTextContent('Freela');
        expect(within(rows[2]!).getByRole('link')).toHaveAttribute('href', '/receitas/r3');

        // O cartão do celular tem o mesmo conteúdo.
        const cards = screen.getByRole('list', { name: 'Receitas' });
        expect(within(cards).getAllByRole('link')[1]).toHaveTextContent('+R$ 5.000,00');
    });

    it('summarizes the month: total and received, pending and overdue counts', async () => {
        await renderList('/receitas?mes=2026-10');

        const summary = await screen.findByRole('region', { name: 'Resumo' });
        expect(summary).toHaveTextContent('+R$ 6.700,50');
        expect(summary).toHaveTextContent('1 recebida · 1 pendente · 1 atrasada');
    });

    // AC-0014-02: cada filtro vai para a consulta e para a URL; a etiqueta remove o filtro.
    it('sends each filter to the query and the URL, and removes it by its tag', async () => {
        const { router } = await renderList('/receitas?mes=2026-10');
        await screen.findByRole('table', { name: 'Receitas' });
        const filters = screen.getByRole('group', { name: 'Filtros' });

        await user.selectOptions(within(filters).getByLabelText('Status'), 'OVERDUE');
        await user.selectOptions(within(filters).getByLabelText('Tipo'), FREELANCE_TYPE.id);
        await user.selectOptions(within(filters).getByLabelText('Conta'), SAVINGS.id);
        await user.selectOptions(within(filters).getByLabelText('Natureza'), 'INSTALLMENT');

        expect(lastQuery()).toEqual({
            from: '2026-10-01',
            to: '2026-10-31',
            status: 'OVERDUE',
            earningTypeId: FREELANCE_TYPE.id,
            bankAccountId: SAVINGS.id,
            kind: 'INSTALLMENT',
        });
        expect(router.state.location.search).toEqual({
            mes: '2026-10',
            status: 'OVERDUE',
            tipo: FREELANCE_TYPE.id,
            conta: SAVINGS.id,
            natureza: 'INSTALLMENT',
        });

        const tags = screen.getByRole('list', { name: 'Filtros ativos' });
        expect(
            within(tags)
                .getAllByRole('button')
                .map((tag) => tag.textContent),
        ).toEqual(['Atrasado', 'Freela', 'Poupança', 'Parcelada']);

        await user.click(within(tags).getByRole('button', { name: 'Remover filtro Freela' }));
        expect(router.state.location.search).not.toHaveProperty('tipo');
        expect(lastQuery()).not.toHaveProperty('earningTypeId');

        await user.selectOptions(within(filters).getByLabelText('Status'), '');
        expect(router.state.location.search).not.toHaveProperty('status');
    });

    it('offers only active types and accounts, plus an archived one already filtered', async () => {
        await renderList(`/receitas?mes=2026-10&conta=${OLD_ACCOUNT.id}`);
        const filters = screen.getByRole('group', { name: 'Filtros' });

        const types = within(within(filters).getByLabelText('Tipo')).getAllByRole('option');
        expect(types.map((option) => option.textContent)).toEqual(['Todos', 'Freela', 'Salário']);
        const accounts = within(within(filters).getByLabelText('Conta')).getAllByRole('option');
        expect(accounts.map((option) => option.textContent)).toEqual([
            'Todas',
            'Conta antiga',
            'Conta corrente',
            'Poupança',
        ]);
        expect(lastQuery()).toMatchObject({ bankAccountId: OLD_ACCOUNT.id });
    });

    it('moves between months keeping the filters', async () => {
        const { router } = await renderList('/receitas?mes=2026-01&status=OPEN');

        await user.click(screen.getByRole('button', { name: 'Mês anterior' }));
        expect(router.state.location.search).toEqual({ mes: '2025-12', status: 'OPEN' });
        expect(lastQuery()).toEqual({ from: '2025-12-01', to: '2025-12-31', status: 'OPEN' });

        await user.click(screen.getByRole('button', { name: 'Próximo mês' }));
        await user.click(screen.getByRole('button', { name: 'Próximo mês' }));
        expect(screen.getByRole('heading', { name: 'fevereiro de 2026' })).toBeInTheDocument();
    });

    it('lists a whole installment group without the month', async () => {
        const { router } = await renderList('/receitas?mes=2026-10&grupo=grupo-1');

        expect(lastQuery()).toEqual({ installmentGroupId: 'grupo-1' });
        expect(screen.queryByRole('button', { name: 'Mês anterior' })).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Remover filtro Parcelamento' }));
        expect(router.state.location.search).toEqual({ mes: '2026-10' });
        expect(lastQuery()).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    });

    it('opens the filter sheet on the phone with the same filters', async () => {
        const { router } = await renderList('/receitas?mes=2026-10');

        await user.click(screen.getByRole('button', { name: 'Filtros' }));
        const sheet = screen.getByRole('dialog', { name: 'Filtros' });
        await user.selectOptions(within(sheet).getByLabelText('Natureza'), 'FIXED');
        expect(router.state.location.search).toEqual({ mes: '2026-10', natureza: 'FIXED' });

        await user.click(within(sheet).getByRole('button', { name: 'Ver receitas' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // ERR-0014-04: parâmetro inválido descartado, vale o padrão.
    it('drops an invalid month and uses the default', async () => {
        await renderList('/receitas?mes=2026-13');

        expect(lastQuery()).toMatchObject({ from: expect.stringMatching(/^\d{4}-\d{2}-01$/) });
        expect(lastQuery()).not.toEqual(expect.objectContaining({ from: '2026-13-01' }));
    });

    it('offers Nova receita with entries.write, opening ?novo=1', async () => {
        const { router } = await renderList('/receitas?mes=2026-10', 'BILLER');

        expect(screen.getByRole('link', { name: 'Tipos de receita' })).toHaveAttribute(
            'href',
            '/receitas/tipos',
        );
        await user.click(screen.getByRole('button', { name: 'Nova receita' }));
        expect(router.state.location.search).toEqual({ mes: '2026-10', novo: 1 });
    });

    // AC-0014-07 (lista), INV-0009-03: sem `entries.write`, nenhum controle de escrita.
    it('renders no write control for a viewer', async () => {
        await renderList('/receitas?mes=2026-10&novo=1', 'VIEWER');

        await screen.findByRole('table', { name: 'Receitas' });
        expect(screen.queryByRole('button', { name: 'Nova receita' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Tipos de receita' })).not.toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('shows the empty state, with a filter hint when filters are active', async () => {
        mocks.get.mockResolvedValue(ok([]));
        const first = await renderList('/receitas?mes=2026-10');
        expect(
            await screen.findByRole('heading', { name: 'Nenhuma receita neste mês.' }),
        ).toBeInTheDocument();
        expect(screen.getByRole('region', { name: 'Resumo' })).toHaveTextContent(
            '0 recebidas · 0 pendentes · 0 atrasadas',
        );

        await act(async () => {
            await first.router.navigate({ to: '/receitas', search: { status: 'OPEN' } });
        });
        expect(
            await screen.findByRole('heading', { name: 'Nenhuma receita com estes filtros.' }),
        ).toBeInTheDocument();
    });

    // ERR-0014-02 / ERR-0009-01: falha da lista vira o estado de erro com Tentar de novo.
    it('shows the catalog message and retries when the list fails', async () => {
        mocks.get.mockResolvedValueOnce(failure(500, 'INTERNAL_ERROR'));
        await renderList('/receitas?mes=2026-10');

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('Não foi possível carregar.');
        expect(alert).not.toHaveTextContent('raw');

        await user.click(within(alert).getByRole('button', { name: 'Tentar de novo' }));
        expect(await screen.findByRole('table', { name: 'Receitas' })).toBeInTheDocument();
    });
});
