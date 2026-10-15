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

const mocks = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));
vi.mock('@/api/client', () => ({
    api: { GET: mocks.get, PATCH: mocks.patch, POST: vi.fn(), DELETE: vi.fn() },
}));

import { ERROR_MESSAGES } from '@/api/errors/catalog';
import { CURRENT_USER_QUERY_KEY, type Profile } from '@/api/queries/current-user';
import { queryKeys } from '@/api/queries/keys';
import { createNoticeStore, NoticeProvider } from '@/ui/notice';

import { statementsPanelSearchSchema, type Statement } from '../panel/statement-model';
import { StatementsPanel } from '../panel/statements-panel';
import {
    ACCOUNTS,
    CARD_ID,
    CLOSED,
    CURRENT,
    expenseFixture,
    OLDER,
    UPCOMING,
} from '../panel/test-data';

import { CONFIRMED_NOTICE } from './reconcile-toggle';

type Init = { params?: { query?: Record<string, string> } };

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

const MARKED_ID = '60000000-0000-4000-8000-000000000011';
const OPEN_ID = '60000000-0000-4000-8000-000000000012';
const FORECAST_ID = '60000000-0000-4000-8000-000000000013';

const STATEMENT: Statement = {
    ...CURRENT,
    reconciledCents: 38000,
    pendingReconciliationCents: 12345,
    expenses: [
        expenseFixture({
            id: MARKED_ID,
            description: 'Notebook',
            reconciledAt: '2026-10-12T12:00:00Z',
        }),
        expenseFixture({ id: OPEN_ID, description: 'Feira', installment: null }),
        expenseFixture({
            id: FORECAST_ID,
            description: 'HBO Max',
            status: 'FORECAST',
            installment: null,
        }),
    ],
};

function stubReads(current: Statement = STATEMENT) {
    mocks.get.mockImplementation((path: string, init: Init) => {
        if (path === '/statements/current') return Promise.resolve(ok({ data: current }));
        if (path === '/statements') {
            return Promise.resolve(
                ok({ data: init.params?.query?.from ? UPCOMING : [OLDER, CURRENT, CLOSED] }),
            );
        }
        return Promise.resolve(fail(404, 'ROUTE_NOT_FOUND'));
    });
}

async function renderPanel({
    profile = 'BILLER',
    path = '/',
}: { profile?: Profile; path?: string } = {}) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(queryKeys.bankAccounts.all, ACCOUNTS);
    client.setQueryData(CURRENT_USER_QUERY_KEY, {
        id: 'u',
        email: 'a@b.c',
        emailVerified: true,
        name: 'Ana',
        profile,
        profileGrantedAt: null,
        createdAt: '2026-10-01T00:00:00Z',
    });
    const root = createRootRoute();
    const page = createRoute({
        getParentRoute: () => root,
        path: '/',
        validateSearch: statementsPanelSearchSchema,
        component: () => <StatementsPanel cardId={CARD_ID} />,
    });
    const router = createRouter({
        routeTree: root.addChildren([page]),
        history: createMemoryHistory({ initialEntries: [path] }),
    });
    await router.load();
    await act(async () => {
        render(
            <QueryClientProvider client={client}>
                <NoticeProvider store={createNoticeStore()}>
                    <RouterProvider router={router} />
                </NoticeProvider>
            </QueryClientProvider>,
        );
    });
    return { router };
}

/** A lista de despesas na forma de tabela (a partir de `md`). */
async function expensesTable() {
    const section = await screen.findByRole('region', { name: 'Despesas' });
    return within(section).getByRole('table', { name: 'Despesas da fatura' });
}

beforeEach(() => {
    mocks.get.mockReset();
    mocks.patch.mockReset();
    stubReads();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-20T12:00:00-03:00'));
});

afterEach(() => {
    vi.useRealTimers();
});

describe('conferência da fatura (spec 0020)', () => {
    // AC-0020-01, INV-0020-01: os dois valores vêm da resposta; o pendente fica em `atencao`.
    it('shows Conferido and Falta conferir from the response', async () => {
        await renderPanel();

        const list = (await screen.findAllByLabelText('Valores da fatura'))[0]!;
        const row = (label: string) => within(list).getByText(label).closest('div')!;

        expect(within(row('Conferido')).getByText('R$ 380,00')).toBeInTheDocument();
        expect(
            within(row('Conferido')).getByText(
                'Some as despesas marcadas. Deve bater com o app do banco.',
            ),
        ).toBeInTheDocument();
        const pending = within(row('Falta conferir')).getByText('R$ 123,45');
        expect(pending).toHaveAttribute('data-tone', 'atencao');
    });

    // AC-0020-02: marcar envia `true`; desmarcar envia `false`.
    it('sends reconciled true for an unmarked expense and false for a marked one', async () => {
        mocks.patch.mockResolvedValue(ok({ data: {} }));
        await renderPanel();
        const table = await expensesTable();

        const mark = within(table).getByRole('button', { name: 'Marcar como incluída: Feira' });
        expect(mark).toHaveAttribute('aria-pressed', 'false');
        await act(async () => {
            fireEvent.click(mark);
        });
        await waitFor(() =>
            expect(mocks.patch).toHaveBeenCalledWith('/expenses/{id}/reconciliation', {
                params: { path: { id: OPEN_ID } },
                body: { reconciled: true },
            }),
        );

        const unmark = within(table).getByRole('button', {
            name: 'Desmarcar incluída: Notebook',
        });
        expect(unmark).toHaveAttribute('aria-pressed', 'true');
        await act(async () => {
            fireEvent.click(unmark);
        });
        await waitFor(() =>
            expect(mocks.patch).toHaveBeenCalledWith('/expenses/{id}/reconciliation', {
                params: { path: { id: MARKED_ID } },
                body: { reconciled: false },
            }),
        );
        // A fatura é recarregada depois da escrita.
        await waitFor(() =>
            expect(
                mocks.get.mock.calls.filter(([path]) => path === '/statements/current').length,
            ).toBeGreaterThan(1),
        );
        expect(screen.queryByText(CONFIRMED_NOTICE)).not.toBeInTheDocument();
    });

    // AC-0020-03: a prevista é confirmada e marcada, com o aviso.
    it('confirms a FORECAST expense and shows the notice', async () => {
        mocks.patch.mockResolvedValue(ok({ data: {} }));
        await renderPanel();
        const table = await expensesTable();

        await act(async () => {
            fireEvent.click(
                within(table).getByRole('button', { name: 'Marcar como incluída: HBO Max' }),
            );
        });

        expect(mocks.patch).toHaveBeenCalledWith('/expenses/{id}/reconciliation', {
            params: { path: { id: FORECAST_ID } },
            body: { reconciled: true },
        });
        expect(await screen.findByText(CONFIRMED_NOTICE)).toBeInTheDocument();
    });

    // AC-0020-04: `STATEMENT_CLOSED` vira alerta do catálogo e a fatura é recarregada.
    it('alerts and reloads on STATEMENT_CLOSED', async () => {
        mocks.patch.mockResolvedValue(fail(409, 'STATEMENT_CLOSED'));
        await renderPanel();
        const table = await expensesTable();
        const before = mocks.get.mock.calls.filter(
            ([path]) => path === '/statements/current',
        ).length;

        await act(async () => {
            fireEvent.click(
                within(table).getByRole('button', { name: 'Marcar como incluída: HBO Max' }),
            );
        });

        const notices = await screen.findByRole('region', { name: 'Avisos' });
        expect(
            await within(notices).findByText(ERROR_MESSAGES.STATEMENT_CLOSED),
        ).toBeInTheDocument();
        expect(screen.queryByText('raw backend message')).not.toBeInTheDocument();
        await waitFor(() =>
            expect(
                mocks.get.mock.calls.filter(([path]) => path === '/statements/current').length,
            ).toBeGreaterThan(before),
        );
    });

    // AC-0020-05, INV-0020-02: sem `entries.write`, só o selo da marcada.
    it('shows only the Incluída badge to a VIEWER', async () => {
        await renderPanel({ profile: 'VIEWER' });
        const table = await expensesTable();

        expect(within(table).queryByRole('button', { name: /incluída/i })).toBeNull();
        expect(within(table).getAllByText('Incluída')).toHaveLength(1);
    });

    // AC-0020-06, INV-0020-03: o filtro deixa só as sem marca; `?conferir=1` já vem ligado.
    it('filters to what is left to check, from the switch and from ?conferir=1', async () => {
        const { router } = await renderPanel();
        const table = await expensesTable();
        expect(within(table).getByText('Notebook')).toBeInTheDocument();

        await act(async () => {
            fireEvent.click(screen.getByRole('switch', { name: 'Só o que falta conferir' }));
        });

        await waitFor(() => expect(router.state.location.search).toEqual({ conferir: 1 }));
        const filtered = await expensesTable();
        expect(within(filtered).queryByText('Notebook')).toBeNull();
        expect(within(filtered).getByText('Feira')).toBeInTheDocument();
        expect(within(filtered).getByText('HBO Max')).toBeInTheDocument();
    });

    it('starts filtered from ?conferir=1 and says when everything is checked', async () => {
        stubReads({
            ...STATEMENT,
            expenses: [expenseFixture({ reconciledAt: '2026-10-12T12:00:00Z' })],
        });
        await renderPanel({ path: '/?conferir=1' });

        expect(
            await screen.findByRole('switch', { name: 'Só o que falta conferir' }),
        ).toBeChecked();
        expect(screen.getByText('Tudo conferido nesta fatura.')).toBeInTheDocument();
    });
});
