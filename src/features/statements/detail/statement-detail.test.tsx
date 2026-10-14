import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
    RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/api/client', () => ({ api: { GET: mocks.get } }));

import { CURRENT_USER_QUERY_KEY } from '@/api/queries/current-user';
import { queryKeys } from '@/api/queries/keys';
import type { CreditCard } from '@/api/queries/reference';

import { ACCOUNTS, CARD_ID, CLOSED, CLOSED_ID, CURRENT, EXPENSE_ID } from '../panel/test-data';

import { StatementDetailPage } from './statement-detail';

const ok = (body: unknown) => ({
    data: body,
    error: undefined,
    response: { ok: true, status: 200 },
});
const fail = (status: number, code: string) => ({
    data: undefined,
    error: { error: { code, message: 'raw backend message' } },
    response: { ok: false, status },
});

const CARD = { id: CARD_ID, name: 'Nubank Roxinho' } as CreditCard;

/** A fechada vencida do painel, com o detalhe da atual. */
const DETAIL = {
    ...CLOSED,
    expenses: CURRENT.expenses,
    refunds: CURRENT.refunds,
    payments: CURRENT.payments,
};

async function renderDetail() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // Leitor: as ações de pagamento (T-0013-02) leem o perfil do cache.
    client.setQueryData(CURRENT_USER_QUERY_KEY, { profile: 'VIEWER' });
    client.setQueryData(queryKeys.bankAccounts.all, ACCOUNTS);
    client.setQueryData(queryKeys.creditCards.all, [CARD]);
    const root = createRootRoute();
    const page = createRoute({
        getParentRoute: () => root,
        path: '/',
        component: () => <StatementDetailPage cardId={CARD_ID} statementId={CLOSED_ID} />,
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
}

const valueOf = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling;

beforeEach(() => {
    mocks.get.mockReset();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-20T12:00:00-03:00'));
});

afterEach(() => {
    vi.useRealTimers();
});

describe('StatementDetailPage (spec 0013)', () => {
    // AC-0013-02, INV-0013-01.
    it('shows a closed statement with its values, expenses, refunds and payments', async () => {
        mocks.get.mockResolvedValue(ok({ data: DETAIL }));
        await renderDetail();

        expect(
            await screen.findByRole('heading', { name: 'Fatura de outubro de 2026', level: 1 }),
        ).toBeVisible();
        expect(mocks.get).toHaveBeenCalledWith('/statements/{id}', {
            params: { path: { id: CLOSED_ID } },
        });
        expect(screen.getAllByText('Vencida')[0]).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Nubank Roxinho' })).toHaveAttribute(
            'href',
            `/cartoes/${CARD_ID}`,
        );
        expect(valueOf('Período')).toHaveTextContent('9 set. – 8 out.');
        expect(valueOf('Vence em')).toHaveTextContent('15 de out. de 2026');
        expect(valueOf('Saldo anterior')).toHaveTextContent('R$ 50,00');
        expect(valueOf('Total da fatura')).toHaveTextContent('R$ 350,00');
        expect(valueOf('Estornos')).toHaveTextContent('R$ 0,00');
        expect(valueOf('Mínimo informado')).toHaveTextContent('R$ 70,00');
        // Restante no tom `negativo` com `overdue`.
        const remaining = valueOf('Restante')?.querySelector('[data-tone="negativo"]');
        expect(remaining).toHaveTextContent('R$ 350,00');
        expect(remaining).toHaveClass('text-negativo');

        const expenses = within(screen.getByRole('table', { name: 'Despesas da fatura' }));
        expect(expenses.getByRole('link', { name: 'Notebook' })).toHaveAttribute(
            'href',
            `/despesas/${EXPENSE_ID}`,
        );
        expect(screen.getByRole('table', { name: 'Estornos da fatura' })).toHaveTextContent(
            'Estorno da loja',
        );
        expect(screen.getByRole('table', { name: 'Pagamentos da fatura' })).toHaveTextContent(
            'Conta corrente',
        );
        expect(screen.getByRole('heading', { name: 'Por tipo', level: 2 })).toBeVisible();
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('shows the empty texts of a statement without movements', async () => {
        mocks.get.mockResolvedValue(
            ok({ data: { ...CLOSED, byExpenseType: [], expenses: [], refunds: [], payments: [] } }),
        );
        await renderDetail();

        expect(await screen.findByText('Nenhuma despesa nesta fatura.')).toBeInTheDocument();
        expect(screen.getByText('Nenhum estorno nesta fatura.')).toBeInTheDocument();
        expect(screen.getByText('Nenhum pagamento nesta fatura.')).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Por tipo' })).toBeNull();
    });

    // ERR-0013-02 / ERR-0009-02.
    it('shows not found with a link back to the card on STATEMENT_NOT_FOUND', async () => {
        mocks.get.mockResolvedValue(fail(404, 'STATEMENT_NOT_FOUND'));
        await renderDetail();

        expect(await screen.findByText('Não encontramos este item.')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Voltar para o cartão' })).toHaveAttribute(
            'href',
            `/cartoes/${CARD_ID}`,
        );
    });

    // ERR-0013-02 / ERR-0009-01.
    it('shows the error state with retry on another failure, never the raw message', async () => {
        mocks.get.mockResolvedValue(fail(500, 'INTERNAL_ERROR'));
        await renderDetail();

        expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar.');
        expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
        expect(screen.queryByText('raw backend message')).toBeNull();
    });
});
