import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    createMemoryHistory,
    createRootRoute,
    createRouter,
    RouterProvider,
} from '@tanstack/react-router';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ GET: vi.fn() }));
vi.mock('@/api/client', () => ({ api: mocks }));

import { queryKeys } from '@/api/queries/keys';

import { CashFlowPage, type CashFlowRowActions } from './cash-flow-page';
import type { BalanceReport } from './cash-flow-model';
import type { CashFlowSearch } from './search';
import {
    ACCOUNT,
    ARCHIVED_CARD_ID,
    card,
    CARD_EXPENSE,
    CLOSED_TO_PAY,
    FREELA,
    INTERNET,
    LATE_EARNING,
    PAID_SEPTEMBER,
    PHARMACY,
    point,
    PROJECTED,
    RENT,
    SALARY,
    SEPTEMBER_OVERDUE,
    TODAY,
} from './test-data';

const ok = (data: unknown) => ({ data: { data }, response: { ok: true, status: 200 } });
const fail = (status: number, code: string) => ({
    error: { error: { code, message: 'raw' } },
    response: { ok: false, status },
});

const BALANCE: BalanceReport = {
    from: '2026-09',
    to: '2026-10',
    points: [point('2026-09', 'REALIZED', 487655), point('2026-10', 'FORECAST', 612345, 102550)],
};

interface Overrides {
    earnings?: unknown;
    expenses?: unknown;
    balance?: unknown;
    statementsFail?: boolean;
    balanceFail?: boolean;
}

function routeApi(overrides: Overrides = {}) {
    mocks.GET.mockImplementation(
        (path: string, init: { params?: { query?: Record<string, string> } }) => {
            const query = init.params?.query ?? {};
            switch (path) {
                case '/earnings':
                    return Promise.resolve(
                        ok(
                            query.status === 'OVERDUE'
                                ? [LATE_EARNING]
                                : (overrides.earnings ?? [FREELA, SALARY, LATE_EARNING]),
                        ),
                    );
                case '/expenses':
                    return Promise.resolve(
                        ok(
                            query.status === 'OVERDUE'
                                ? [SEPTEMBER_OVERDUE, PHARMACY]
                                : (overrides.expenses ?? [INTERNET, CARD_EXPENSE, RENT, PHARMACY]),
                        ),
                    );
                case '/statements':
                    if (overrides.statementsFail) {
                        return Promise.resolve(fail(500, 'INTERNAL_ERROR'));
                    }
                    return Promise.resolve(ok([PAID_SEPTEMBER, CLOSED_TO_PAY, PROJECTED]));
                case '/reports/balance':
                    if (overrides.balanceFail) return Promise.resolve(fail(500, 'INTERNAL_ERROR'));
                    return Promise.resolve(ok(overrides.balance ?? BALANCE));
                default:
                    return Promise.resolve(fail(404, 'ROUTE_NOT_FOUND'));
            }
        },
    );
}

async function renderPage(initial: CashFlowSearch, rowActions?: CashFlowRowActions) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(queryKeys.bankAccounts.all, [ACCOUNT]);
    queryClient.setQueryData(queryKeys.creditCards.all, [
        card(),
        card({ id: ARCHIVED_CARD_ID, name: 'Antigo', archivedAt: '2026-09-01T00:00:00Z' }),
    ]);
    const searches: CashFlowSearch[] = [];

    function Harness() {
        const [search, setSearch] = useState(initial);
        return (
            <CashFlowPage
                search={search}
                onSearchChange={(next) => {
                    const merged = { ...search, ...next };
                    searches.push(merged);
                    setSearch(merged);
                }}
                rowActions={rowActions}
                alerts={<p>alerta das ações</p>}
                dialogs={<p>diálogos das ações</p>}
            />
        );
    }

    const router = createRouter({
        routeTree: createRootRoute({ component: Harness }),
        history: createMemoryHistory(),
    });
    await router.load();
    await act(async () => {
        render(
            <QueryClientProvider client={queryClient}>
                <RouterProvider router={router} />
            </QueryClientProvider>,
        );
    });
    return { searches };
}

const TABLE = 'Fluxo de caixa de outubro de 2026';

async function rows() {
    const table = await screen.findByRole('table', { name: TABLE });
    return within(table).getAllByRole('row').slice(1);
}

const summaryCard = (name: string) =>
    within(screen.getByRole('region', { name: 'Resumo do mês' })).getByRole('region', { name });

beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(TODAY));
    routeApi();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('CashFlowPage (spec 0015)', () => {
    // AC-0015-14, INV-0015-07.
    it('lists the month rows by date, without card expenses, with the statement of the active card', async () => {
        await renderPage({});
        const list = await rows();
        expect(list.map((row) => within(row).getAllByRole('cell')[1]?.textContent)).toEqual([
            'SalárioSalário · Conta corrente',
            'AluguelMoradia · Conta corrente',
            'Fatura Itaú VisaConta corrente',
            'ReembolsoSalário · Conta corrente',
            'FarmáciaMoradia · Conta corrente',
            'InternetMoradia · Conta corrente',
            'FreelaSalário · Conta corrente',
        ]);
        expect(screen.queryByText('Mercado no cartão')).toBeNull();
        expect(within(list[2]!).getByText('−R$ 1.025,50')).toBeVisible();
        expect(within(list[0]!).getByText('+R$ 5.000,00')).toBeVisible();

        // Uma consulta de faturas só para o cartão ativo, na janela do mês.
        const statementCalls = mocks.GET.mock.calls.filter(([path]) => path === '/statements');
        expect(statementCalls).toEqual([
            [
                '/statements',
                {
                    params: {
                        query: {
                            creditCardId: card().id,
                            from: '2026-08-01',
                            to: '2026-10-31',
                        },
                    },
                },
            ],
        ]);
        expect(mocks.GET).toHaveBeenCalledWith('/reports/balance', {
            params: { query: { from: '2026-09', to: '2026-10', bankAccountId: undefined } },
        });

        // Os links de cada linha.
        const links = list.map((row) => within(row).getByRole('link').getAttribute('href'));
        expect(links.slice(0, 3)).toEqual([
            '/receitas/e1',
            '/despesas/x1',
            `/cartoes/${card().id}/faturas/s1`,
        ]);
        expect(screen.getByText('alerta das ações')).toBeInTheDocument();
        expect(screen.getByText('diálogos das ações')).toBeInTheDocument();
    });

    // AC-0015-14: o filtro muda só a lista; navegar de mês mantém o filtro.
    it('filters by situation without changing the summary and keeps the filter across months', async () => {
        const { searches } = await renderPage({ situacao: 'a-vencer' });
        const list = await rows();
        expect(list).toHaveLength(3);
        expect(summaryCard('Entradas')).toHaveTextContent('+R$ 5.900,00');
        expect(summaryCard('Entradas')).toHaveTextContent('1 realizada · 2 pendentes');
        expect(summaryCard('Saídas')).toHaveTextContent('−R$ 2.971,10');

        fireEvent.change(screen.getByLabelText('Situação'), { target: { value: 'realizados' } });
        expect(await rows()).toHaveLength(2);
        expect(searches.at(-1)).toEqual({ situacao: 'realizados', mes: undefined });

        fireEvent.change(screen.getByLabelText('Situação'), { target: { value: '' } });
        expect(searches.at(-1)?.situacao).toBeUndefined();

        fireEvent.change(screen.getByLabelText('Situação'), { target: { value: 'vencidos' } });
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Próximo mês' }));
        });
        expect(searches.at(-1)).toEqual({ mes: '2026-11', situacao: 'vencidos' });
    });

    // AC-0015-15.
    it('shows the balances with their badges and the note of earlier overdue entries', async () => {
        await renderPage({});
        await rows();
        expect(summaryCard('Saldo no início')).toHaveTextContent('R$ 4.876,55');
        expect(summaryCard('Saldo no início')).toHaveTextContent('Realizado');
        // 612345 − 102550.
        expect(summaryCard('Saldo no fim')).toHaveTextContent('R$ 5.097,95');
        expect(summaryCard('Saldo no fim')).toHaveTextContent('Previsto');

        expect(
            await screen.findByText('O saldo previsto conta com 1 vencida de meses anteriores.'),
        ).toBeVisible();
        expect(screen.getByRole('link', { name: 'Ver despesas vencidas' })).toHaveAttribute(
            'href',
            '/despesas?status=OVERDUE',
        );
        expect(screen.queryByRole('link', { name: 'Ver receitas vencidas' })).toBeNull();
    });

    it('shows no overdue note outside the current month and a dash without a balance point', async () => {
        routeApi({ balance: { from: '2026-09', to: '2026-11', points: [] } });
        await renderPage({ mes: '2026-11' });
        await screen.findByRole('table', { name: 'Fluxo de caixa de novembro de 2026' });
        expect(summaryCard('Saldo no fim')).toHaveTextContent('—');
        expect(screen.queryByText(/vencidas? de meses anteriores/)).toBeNull();
        expect(mocks.GET).not.toHaveBeenCalledWith('/earnings', {
            params: { query: { status: 'OVERDUE' } },
        });
    });

    it('renders the row menus the route composes and none when there are none', async () => {
        await renderPage(
            {},
            {
                expense: (expense) => <button type="button">menu {expense.description}</button>,
                earning: (earning) => <button type="button">menu {earning.description}</button>,
                statement: () => null,
            },
        );
        await rows();
        expect(screen.getAllByRole('button', { name: 'menu Aluguel' })).toHaveLength(2);
        expect(screen.getAllByRole('button', { name: 'menu Salário' })).toHaveLength(2);
        expect(screen.getAllByRole('columnheader').at(-1)).toHaveTextContent('Ações');
    });

    it('has no actions column without row menus', async () => {
        await renderPage({}, {});
        await rows();
        expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
            'Data',
            'Descrição',
            'Situação',
            'Valor',
        ]);
    });

    it('shows the empty month message', async () => {
        mocks.GET.mockImplementation((path: string) =>
            Promise.resolve(path === '/reports/balance' ? ok(BALANCE) : ok([])),
        );
        await renderPage({ situacao: 'vencidos' });
        expect(await screen.findByText('Nada entra nem sai neste mês.')).toBeVisible();
    });

    it('says nothing is in the chosen situation', async () => {
        routeApi({ earnings: [SALARY], expenses: [RENT] });
        await renderPage({ situacao: 'vencidos' });
        expect(await screen.findByText('Nada nesta situação neste mês.')).toBeVisible();
    });

    // ERR-0015-01: uma consulta que falha mostra o erro; tentar de novo consulta outra vez.
    it('shows the error of a failed list query and retries it', async () => {
        routeApi({ statementsFail: true });
        await renderPage({});
        const retries = await screen.findAllByRole('button', { name: 'Tentar de novo' });
        expect(retries.length).toBeGreaterThan(0);
        routeApi();
        await act(async () => {
            fireEvent.click(retries[0]!);
        });
        expect(await rows()).toHaveLength(7);
    });

    it('keeps the list when only the balance fails', async () => {
        routeApi({ balanceFail: true });
        await renderPage({});
        expect(await rows()).toHaveLength(7);
        expect(
            within(screen.getByRole('region', { name: 'Resumo do mês' })).getByRole('button', {
                name: 'Tentar de novo',
            }),
        ).toBeVisible();
    });
});
