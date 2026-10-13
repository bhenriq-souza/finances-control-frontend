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
import type { BankAccount, CreditCard } from '@/api/queries/reference';

import { AccountStatementPage } from './account-statement-page';
import { movementHref, movementTexts } from './movement-parts';
import type { AccountMovement, AccountMovementsReport } from './queries';
import { accountStatementSearchSchema, type AccountStatementSearch } from './search';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';
const CARD_ID = '33333333-3333-4333-8333-333333333333';
const STATEMENT_ID = '44444444-4444-4444-8444-444444444444';

const BANK = {
    id: '99999999-9999-4999-8999-999999999999',
    febrabanCode: '341',
    name: 'Itaú',
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
};

function account(id: string, description: string, archivedAt: string | null = null): BankAccount {
    return {
        id,
        bank: BANK,
        type: 'CHECKING',
        accountNumber: '12345-6',
        description,
        openingBalanceCents: 0,
        currentBalanceCents: 0,
        overdraftLimitCents: 0,
        archivedAt,
        createdAt: '2026-01-01T00:00:00Z',
    };
}

const CARD: CreditCard = {
    id: CARD_ID,
    bank: BANK,
    name: 'Itaú Visa',
    creditLimitCents: 100000,
    availableLimitCents: 100000,
    closingDay: 25,
    dueDay: 5,
    currentCycle: { startsOn: '2026-09-26', closesOn: '2026-10-25', dueOn: '2026-11-05' },
    paymentBankAccountId: null,
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
};

function movement(overrides: Partial<AccountMovement>): AccountMovement {
    return {
        date: '2026-03-10',
        kind: 'EXPENSE',
        sourceId: 'm1',
        description: null,
        typeName: null,
        creditCardId: null,
        statementId: null,
        counterpartBankAccountId: null,
        amountCents: 0,
        balanceAfterCents: 0,
        ...overrides,
    };
}

const MOVEMENTS: AccountMovement[] = [
    movement({
        kind: 'EARNING',
        sourceId: 'e1',
        description: 'Salário',
        typeName: 'Trabalho',
        amountCents: 500000,
        balanceAfterCents: 600000,
    }),
    movement({
        kind: 'EXPENSE',
        sourceId: 'x1',
        description: 'Aluguel',
        typeName: 'Moradia',
        amountCents: -150000,
        balanceAfterCents: 450000,
    }),
    movement({
        kind: 'STATEMENT_PAYMENT',
        sourceId: 'p1',
        creditCardId: CARD_ID,
        statementId: STATEMENT_ID,
        amountCents: -20000,
        balanceAfterCents: 430000,
    }),
    movement({
        kind: 'STATEMENT_PAYMENT',
        sourceId: 'p2',
        creditCardId: CARD_ID,
        statementId: null,
        amountCents: -1000,
        balanceAfterCents: 429000,
    }),
    movement({
        kind: 'TRANSFER_OUT',
        sourceId: 't1',
        description: 'Reserva',
        counterpartBankAccountId: OTHER_ID,
        amountCents: -9000,
        balanceAfterCents: 420000,
    }),
    movement({
        kind: 'TRANSFER_IN',
        sourceId: 't2',
        description: 'Volta',
        counterpartBankAccountId: OTHER_ID,
        amountCents: 3000,
        balanceAfterCents: 423000,
    }),
];

// Os saldos são deliberadamente incoerentes com os movimentos: o cliente não recalcula nada.
const REPORT: AccountMovementsReport = {
    bankAccountId: ACCOUNT_ID,
    from: '2026-03-01',
    to: '2026-03-31',
    openingBalanceCents: 100000,
    closingBalanceCents: 777700,
    movements: MOVEMENTS,
};

const ok = (data: unknown) => ({ data: { data }, response: { ok: true, status: 200 } });
const fail = (status: number, code: string) => ({
    error: { error: { code, message: 'raw' } },
    response: { ok: false, status },
});

async function renderPage(initial: AccountStatementSearch, archived = false) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(queryKeys.bankAccounts.all, [
        account(ACCOUNT_ID, 'Conta corrente', archived ? '2026-09-01T00:00:00Z' : null),
        account(OTHER_ID, 'Reserva'),
    ]);
    queryClient.setQueryData(queryKeys.creditCards.all, [CARD]);
    const searches: AccountStatementSearch[] = [];

    function Harness() {
        const [search, setSearch] = useState(initial);
        return (
            <AccountStatementPage
                bankAccountId={ACCOUNT_ID}
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
                <RouterProvider router={router} />
            </QueryClientProvider>,
        );
    });
    return { searches };
}

beforeEach(() => {
    vi.resetAllMocks();
    mocks.GET.mockResolvedValue(ok(REPORT));
});

describe('AccountStatementPage (spec 0015)', () => {
    // AC-0015-11, INV-0015-05.
    it('asks for the month range and shows the response balances and movements as they came', async () => {
        await renderPage({ mes: '2026-03' });

        const table = await screen.findByRole('table', { name: 'Movimentos da conta' });
        expect(mocks.GET).toHaveBeenCalledWith('/reports/account-movements', {
            params: { query: { bankAccountId: ACCOUNT_ID, from: '2026-03-01', to: '2026-03-31' } },
        });
        expect(screen.getByRole('heading', { name: 'Conta corrente', level: 1 })).toBeVisible();
        expect(screen.getByText('Itaú · Corrente')).toBeVisible();
        expect(screen.getByRole('link', { name: 'Contas' })).toHaveAttribute('href', '/contas');
        expect(screen.getByText('Saldo inicial').parentElement).toHaveTextContent('R$ 1.000,00');
        expect(screen.getByText('Saldo final').parentElement).toHaveTextContent('R$ 7.777,00');

        const rows = within(table).getAllByRole('row').slice(1);
        expect(rows).toHaveLength(6);
        expect(rows[0]).toHaveTextContent('+R$ 5.000,00');
        expect(rows[0]).toHaveTextContent('R$ 6.000,00');
        expect(rows[1]).toHaveTextContent('−R$ 1.500,00');
        expect(rows[1]).toHaveTextContent('R$ 4.500,00');
    });

    // AC-0015-11.
    it('moves to the previous month', async () => {
        const { searches } = await renderPage({ mes: '2026-03' });
        await screen.findByRole('table', { name: 'Movimentos da conta' });

        await act(async () =>
            fireEvent.click(screen.getByRole('button', { name: 'Mês anterior' })),
        );

        expect(searches).toEqual([{ mes: '2026-02' }]);
        expect(mocks.GET).toHaveBeenLastCalledWith('/reports/account-movements', {
            params: { query: { bankAccountId: ACCOUNT_ID, from: '2026-02-01', to: '2026-02-28' } },
        });
    });

    // AC-0015-12.
    it('describes and links every kind of movement', async () => {
        await renderPage({ mes: '2026-03' });
        const table = await screen.findByRole('table', { name: 'Movimentos da conta' });
        const rows = within(table).getAllByRole('row').slice(1);

        expect(rows[0]).toHaveTextContent('SalárioTrabalho');
        expect(rows[1]).toHaveTextContent('AluguelMoradia');
        expect(rows[2]).toHaveTextContent('Pagamento de faturaItaú Visa');
        expect(rows[4]).toHaveTextContent('ReservaPara Reserva');
        expect(rows[5]).toHaveTextContent('VoltaDe Reserva');

        const hrefs = rows.map((row) => within(row).getByRole('link').getAttribute('href'));
        expect(hrefs).toEqual([
            '/receitas/e1',
            '/despesas/x1',
            `/cartoes/${CARD_ID}/faturas/${STATEMENT_ID}`,
            `/cartoes/${CARD_ID}`,
            '/transferencias/t1',
            '/transferencias/t2',
        ]);
    });

    it('shows the empty message with both balances', async () => {
        mocks.GET.mockResolvedValue(ok({ ...REPORT, movements: [] }));
        await renderPage({ mes: '2026-03' });

        expect(await screen.findByText('Nenhum movimento neste mês.')).toBeVisible();
        expect(screen.getByText('Saldo inicial')).toBeVisible();
        expect(screen.getByText('Saldo final')).toBeVisible();
    });

    it('marks an archived account', async () => {
        await renderPage({ mes: '2026-03' }, true);
        expect(await screen.findByText('Arquivado')).toBeVisible();
    });

    // AC-0015-13.
    it('shows not found with a link to the accounts on BANK_ACCOUNT_NOT_FOUND', async () => {
        mocks.GET.mockResolvedValue(fail(404, 'BANK_ACCOUNT_NOT_FOUND'));
        await renderPage({ mes: '2026-03' });

        expect(await screen.findByText('Não encontramos este item.')).toBeVisible();
        expect(screen.getAllByRole('link', { name: /Contas/ }).at(-1)).toHaveAttribute(
            'href',
            '/contas',
        );
        expect(screen.queryByRole('button', { name: 'Mês anterior' })).toBeNull();
    });

    // ERR-0009-01.
    it('shows the error state with a retry on other errors', async () => {
        mocks.GET.mockResolvedValueOnce(fail(500, 'INTERNAL_ERROR'));
        await renderPage({ mes: '2026-03' });

        expect(await screen.findByText('Não foi possível carregar.')).toBeVisible();
        await act(async () =>
            fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' })),
        );
        expect(await screen.findByRole('table', { name: 'Movimentos da conta' })).toBeVisible();
    });
});

describe('statement helpers', () => {
    it('falls back to the removed labels and to the cards list', () => {
        const none = { labels: new Map(), label: () => 'Conta removida', isReady: true };
        expect(movementTexts(MOVEMENTS[4]!, none, none)).toEqual({
            title: 'Reserva',
            support: 'Para Conta removida',
        });
        expect(movementHref(movement({ kind: 'STATEMENT_PAYMENT' }))).toBe('/cartoes');
    });

    // ERR-0015-02.
    it('discards an invalid month', () => {
        expect(accountStatementSearchSchema.parse({ mes: '2026-13' })).toEqual({ mes: undefined });
        expect(accountStatementSearchSchema.parse({ mes: '2026-03' })).toEqual({ mes: '2026-03' });
    });
});
