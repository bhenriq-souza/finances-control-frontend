import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    createMemoryHistory,
    createRootRoute,
    createRouter,
    RouterProvider,
} from '@tanstack/react-router';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ GET: vi.fn() }));
vi.mock('@/api/client', () => ({ api: mocks }));

import { queryKeys } from '@/api/queries/keys';
import type { BankAccount } from '@/api/queries/reference';
import { createNoticeStore, NoticeProvider } from '@/ui/notice';

import { defaultPeriod } from './period';
import type { BalanceReport, ByTypeReport, CashFlowReport } from './queries';
import { ReportsPage } from './reports-page';
import type { ReportsSearch } from './search';

const CORRENTE = '11111111-1111-4111-8111-111111111111';
const POUPANCA = '22222222-2222-4222-8222-222222222222';

function account(id: string, description: string): BankAccount {
    return {
        id,
        bank: {
            id: '99999999-9999-4999-8999-999999999999',
            febrabanCode: '260',
            name: 'Nu Pagamentos',
            archivedAt: null,
            createdAt: '2026-01-01T00:00:00Z',
        },
        type: 'CHECKING',
        accountNumber: '12345-6',
        description,
        openingBalanceCents: 0,
        currentBalanceCents: 0,
        overdraftLimitCents: 0,
        archivedAt: null,
        createdAt: '2026-01-01T00:00:00Z',
    };
}

const ACCOUNTS = [account(CORRENTE, 'Conta corrente'), account(POUPANCA, 'Poupança')];

const BALANCE: BalanceReport = {
    from: '2026-09',
    to: '2026-10',
    points: [
        {
            month: '2026-09',
            kind: 'REALIZED',
            accounts: [{ bankAccountId: CORRENTE, balanceCents: 100000 }],
            accountsTotalCents: 100000,
            cardDebtCents: null,
            unassignedCardDebtCents: null,
            cardDueCents: null,
            consolidatedCents: 100000,
        },
        {
            month: '2026-10',
            kind: 'FORECAST',
            accounts: [
                {
                    bankAccountId: CORRENTE,
                    balanceCents: 150000,
                    pendingEarningsCents: 0,
                    pendingExpensesCents: 0,
                    cardDebtCents: 40000,
                    balanceAfterCardsCents: 110000,
                },
            ],
            accountsTotalCents: 150000,
            cardDebtCents: 40000,
            unassignedCardDebtCents: 0,
            cardDueCents: 40000,
            consolidatedCents: 110000,
        },
    ],
};

const BY_TYPE: ByTypeReport = {
    from: '2026-10',
    to: '2026-10',
    includeForecast: false,
    months: [
        {
            month: '2026-10',
            totalCents: 130000,
            refundsCents: 5000,
            byType: [
                { typeId: 't1', name: 'Moradia', totalCents: 100000 },
                { typeId: 't2', name: 'Mercado', totalCents: 30000 },
            ],
        },
    ],
};

const CASH_FLOW: CashFlowReport = {
    from: '2026-10',
    to: '2026-10',
    months: [
        {
            month: '2026-10',
            netCents: -20000,
            accounts: [
                {
                    bankAccountId: CORRENTE,
                    inflowsCents: 10000,
                    expensesPaidCents: 40000,
                    statementPaymentsCents: 0,
                    transfersInCents: 0,
                    transfersOutCents: 5000,
                    netCents: -35000,
                },
                {
                    bankAccountId: POUPANCA,
                    inflowsCents: 10000,
                    expensesPaidCents: 0,
                    statementPaymentsCents: 0,
                    transfersInCents: 5000,
                    transfersOutCents: 0,
                    netCents: 15000,
                },
            ],
        },
    ],
};

const ok = (data: unknown) => ({ data: { data }, response: { ok: true, status: 200 } });
const fail = (status: number, code: string) => ({
    error: { error: { code, message: 'raw' } },
    response: { ok: false, status },
});

const RESPONSES: Record<string, unknown> = {
    '/reports/balance': ok(BALANCE),
    '/reports/expenses-by-type': ok(BY_TYPE),
    '/reports/earnings-by-type': ok({
        ...BY_TYPE,
        months: [{ ...BY_TYPE.months[0]!, refundsCents: undefined }],
    }),
    '/reports/cash-flow': ok(CASH_FLOW),
};

async function renderPage(initial: ReportsSearch) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(queryKeys.bankAccounts.all, ACCOUNTS);
    const notices = createNoticeStore();
    const searches: ReportsSearch[] = [];

    function Harness() {
        const [search, setSearch] = useState(initial);
        return (
            <ReportsPage
                search={search}
                onSearchChange={(next) => {
                    searches.push(next);
                    setSearch(next);
                }}
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
                <NoticeProvider store={notices}>
                    <RouterProvider router={router} />
                </NoticeProvider>
            </QueryClientProvider>,
        );
    });
    return { searches, notices };
}

const calls = (path: string) =>
    mocks.GET.mock.calls.filter(([called]) => called === path).map(([, options]) => options);

beforeEach(() => {
    vi.resetAllMocks();
    mocks.GET.mockImplementation((path: string) => Promise.resolve(RESPONSES[path]));
});

describe('ReportsPage (spec 0015)', () => {
    // AC-0015-06, INV-0015-03.
    it('opens Saldo with the default period, the columns and the table with the same values', async () => {
        await renderPage({});

        const table = await screen.findByRole('table', { name: 'Saldo por mês' });
        const { from, to } = defaultPeriod('saldo');
        expect(calls('/reports/balance')).toEqual([{ params: { query: { from, to } } }]);
        expect(screen.getByRole('tab', { name: 'Saldo' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('tabpanel')).toHaveAttribute(
            'aria-labelledby',
            'relatorio-aba-saldo',
        );

        const rows = within(table).getAllByRole('row');
        expect(rows[1]).toHaveTextContent('setembro de 2026RealizadoR$ 1.000,00—R$ 1.000,00');
        expect(rows[2]).toHaveTextContent('outubro de 2026PrevistoR$ 1.500,00R$ 400,00R$ 1.100,00');

        const bars = document.querySelectorAll('rect');
        expect(bars[0]).toHaveAttribute('data-kind', 'realized');
        expect(bars[1]).toHaveAttribute('data-kind', 'forecast');
        expect(bars[1]!.querySelector('title')).toHaveTextContent('R$ 1.500,00');

        fireEvent.click(screen.getByRole('button', { name: 'Contas menos cartões' }));
        expect(document.querySelectorAll('rect')[1]!.querySelector('title')).toHaveTextContent(
            'R$ 1.100,00',
        );
    });

    it('filters Saldo by account and shows that account numbers', async () => {
        await renderPage({ aba: 'saldo', de: '2026-09', ate: '2026-10' });
        await screen.findByRole('table');

        fireEvent.change(screen.getByLabelText('Conta'), { target: { value: CORRENTE } });
        const table = await screen.findByRole('table', { name: 'Saldo por mês' });
        expect(calls('/reports/balance').at(-1)).toEqual({
            params: { query: { from: '2026-09', to: '2026-10', bankAccountId: CORRENTE } },
        });
        expect(
            within(table).getByRole('columnheader', { name: 'Saldo após cartões' }),
        ).toBeVisible();
        expect(screen.queryByRole('button', { name: 'Contas menos cartões' })).toBeNull();
    });

    // Mapa de erros: `BANK_ACCOUNT_NOT_FOUND` → aviso e o filtro de conta é removido.
    it('drops the account filter with a notice on BANK_ACCOUNT_NOT_FOUND', async () => {
        const { notices } = await renderPage({ aba: 'fluxo', de: '2026-10', ate: '2026-10' });
        await screen.findByRole('table');
        mocks.GET.mockImplementation((path: string, options: { params: { query: object } }) =>
            Promise.resolve(
                'bankAccountId' in options.params.query
                    ? fail(404, 'BANK_ACCOUNT_NOT_FOUND')
                    : RESPONSES[path],
            ),
        );

        fireEvent.change(screen.getByLabelText('Conta'), { target: { value: POUPANCA } });
        await vi.waitFor(() =>
            expect(notices.getSnapshot()).toEqual([
                expect.objectContaining({ tone: 'erro', message: 'Conta não encontrada.' }),
            ]),
        );
        expect(screen.getByLabelText('Conta')).toHaveValue('');
        expect(await screen.findByRole('table')).toBeInTheDocument();
    });

    it('shows the catalog error with a retry when a report fails', async () => {
        mocks.GET.mockResolvedValue(fail(500, 'INTERNAL_ERROR'));
        await renderPage({ aba: 'fluxo' });

        expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar.');
        mocks.GET.mockImplementation((path: string) => Promise.resolve(RESPONSES[path]));
        fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
        expect(await screen.findByRole('table')).toBeInTheDocument();
    });

    // AC-0015-07.
    it('switches Por tipo between expenses and earnings, with forecasts and refunds apart', async () => {
        await renderPage({ aba: 'por-tipo', de: '2026-10', ate: '2026-10' });

        const table = await screen.findByRole('table', { name: 'Despesas por tipo por mês' });
        expect(calls('/reports/expenses-by-type')).toEqual([
            { params: { query: { from: '2026-10', to: '2026-10' } } },
        ]);
        const bars = screen.getByRole('list', { name: 'Despesas por tipo' });
        expect(
            within(bars)
                .getAllByRole('listitem')
                .map((item) => item.textContent),
        ).toEqual(['MoradiaR$ 1.000,00', 'MercadoR$ 300,00']);
        expect(document.querySelector('[data-slot="refunds"]')).toHaveTextContent(
            'Estornos de cartãoR$ 50,00',
        );
        expect(within(table).getAllByRole('row')[1]).toHaveTextContent(
            'outubro de 2026R$ 1.000,00R$ 300,00R$ 1.300,00R$ 50,00',
        );

        fireEvent.click(screen.getByRole('checkbox', { name: 'Incluir previstos' }));
        await vi.waitFor(() =>
            expect(calls('/reports/expenses-by-type').at(-1)).toEqual({
                params: { query: { from: '2026-10', to: '2026-10', includeForecast: 'true' } },
            }),
        );

        fireEvent.click(screen.getByRole('button', { name: 'Receitas' }));
        expect(
            await screen.findByRole('table', { name: 'Receitas por tipo por mês' }),
        ).toBeVisible();
        expect(calls('/reports/earnings-by-type')).toEqual([
            { params: { query: { from: '2026-10', to: '2026-10', includeForecast: 'true' } } },
        ]);
        expect(screen.queryByText('Estornos de cartão')).toBeNull();
    });

    it('shows an empty state when no type has values in the period', async () => {
        mocks.GET.mockResolvedValue(
            ok({
                ...BY_TYPE,
                months: [{ month: '2026-10', totalCents: 0, refundsCents: 0, byType: [] }],
            }),
        );
        await renderPage({ aba: 'por-tipo' });
        expect(await screen.findByText('Nenhuma despesa no período.')).toBeVisible();
    });

    // AC-0015-08.
    it('shows the cash flow net below the axis, the table columns and the per-account detail', async () => {
        await renderPage({ aba: 'fluxo', de: '2026-10', ate: '2026-10' });

        const table = await screen.findByRole('table', { name: 'Fluxo de caixa por mês' });
        expect(
            within(table)
                .getAllByRole('columnheader')
                .map((header) => header.textContent),
        ).toEqual([
            'Mês',
            'Entradas',
            'Despesas pagas',
            'Faturas pagas',
            'Transferências que entram',
            'Transferências que saem',
            'Líquido',
        ]);
        expect(within(table).getAllByRole('row')[1]).toHaveTextContent(
            'outubro de 2026R$ 200,00R$ 400,00R$ 0,00R$ 50,00R$ 50,00−R$ 200,00',
        );
        expect(document.querySelector('rect')).toHaveAttribute('data-sign', 'negative');
        expect(document.querySelector('[data-slot="zero-axis"]')).not.toBeNull();

        const toggle = within(table).getByRole('button', { name: 'outubro de 2026' });
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(within(table).getAllByRole('row')).toHaveLength(4);
        expect(within(table).getByText('Poupança')).toBeInTheDocument();

        const card = screen.getByRole('list', { name: 'Fluxo de caixa por mês' });
        expect(within(card).getByText('Conta corrente')).toBeInTheDocument();
        fireEvent.click(within(card).getByRole('button', { name: 'Por conta em outubro de 2026' }));
        expect(within(card).queryByText('Conta corrente')).toBeNull();
    });

    // AC-0015-09.
    it('never sends a period with de after ate', async () => {
        const { searches } = await renderPage({ aba: 'fluxo', de: '2026-12', ate: '2026-10' });
        await screen.findByRole('table');
        const fallback = defaultPeriod('fluxo');
        expect(calls('/reports/cash-flow')).toEqual([{ params: { query: fallback } }]);

        fireEvent.change(screen.getByLabelText('De'), { target: { value: '2099-01' } });
        expect(screen.getByText('O mês inicial não pode ser depois do mês final.')).toBeVisible();
        expect(searches).toEqual([]);
        expect(calls('/reports/cash-flow')).toHaveLength(1);

        fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-01' } });
        expect(searches.at(-1)).toEqual({
            aba: 'fluxo',
            de: '2026-01',
            ate: fallback.to,
        });
    });

    it('moves between tabs with the arrow keys and resets the period', async () => {
        const { searches } = await renderPage({ aba: 'saldo', de: '2026-01', ate: '2026-02' });
        const saldo = screen.getByRole('tab', { name: 'Saldo' });
        fireEvent.keyDown(saldo, { key: 'ArrowRight' });
        expect(searches.at(-1)).toEqual({ aba: 'por-tipo' });
        expect(screen.getByRole('tab', { name: 'Por tipo' })).toHaveFocus();
        fireEvent.keyDown(saldo, { key: 'End' });
        expect(searches.at(-1)).toEqual({ aba: 'fluxo' });
        fireEvent.keyDown(saldo, { key: 'ArrowRight' });
        expect(searches.at(-1)).toEqual({ aba: 'saldo' });
        fireEvent.keyDown(saldo, { key: 'ArrowLeft' });
        expect(searches.at(-1)).toEqual({ aba: 'fluxo' });
        fireEvent.keyDown(saldo, { key: 'Home' });
        expect(searches.at(-1)).toEqual({ aba: 'saldo' });
        const count = searches.length;
        fireEvent.keyDown(saldo, { key: 'a' });
        expect(searches).toHaveLength(count);
        fireEvent.click(screen.getByRole('tab', { name: 'Fluxo de caixa' }));
        expect(searches.at(-1)).toEqual({ aba: 'fluxo' });
    });
});
