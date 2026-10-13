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

const mocks = vi.hoisted(() => ({
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    del: vi.fn(),
}));
vi.mock('@/api/client', () => ({
    api: { GET: mocks.get, POST: mocks.post, PATCH: mocks.patch, DELETE: mocks.del },
}));

import { CURRENT_USER_QUERY_KEY, type Profile } from '@/api/queries/current-user';
import { queryKeys } from '@/api/queries/keys';
import { createNoticeStore, NoticeProvider } from '@/ui/notice';

import { statementsPanelSearchSchema } from '../panel/statement-model';
import { StatementsPanel } from '../panel/statements-panel';
import {
    ACCOUNTS,
    CARD_ID,
    CLOSED,
    CLOSED_ID,
    CURRENT,
    EXPENSE_ID,
    expenseFixture,
    OLDER,
    UPCOMING,
} from '../panel/test-data';

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

const REFUND = CURRENT.refunds![0]!;
const CLOSED_EXPENSE_ID = '60000000-0000-4000-8000-000000000009';
const CLOSED_DETAIL = {
    ...CLOSED,
    expenses: [expenseFixture({ id: CLOSED_EXPENSE_ID, description: 'Feira', installment: null })],
    refunds: [],
    payments: [],
};

function stubReads() {
    mocks.get.mockImplementation((path: string, init: Init) => {
        if (path === '/statements/current') return Promise.resolve(ok({ data: CURRENT }));
        if (path === '/statements') {
            return Promise.resolve(
                ok({ data: init.params?.query?.from ? UPCOMING : [OLDER, CURRENT, CLOSED] }),
            );
        }
        if (path === '/statements/{id}') return Promise.resolve(ok({ data: CLOSED_DETAIL }));
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
    return { router, client };
}

async function submit(dialog: HTMLElement, name = 'Salvar') {
    await act(async () => {
        fireEvent.click(within(dialog).getByRole('button', { name }));
    });
}

beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    stubReads();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-20T12:00:00-03:00'));
});

afterEach(() => {
    vi.useRealTimers();
});

describe('refund actions (spec 0013)', () => {
    // AC-0013-08: `?estorno=1&despesa=<id>` vem com a despesa selecionada e envia `expenseId`.
    it('opens from ?estorno=1&despesa with the expense selected and sends expenseId', async () => {
        mocks.post.mockResolvedValue(ok({ data: { ...REFUND, id: 'novo' } }));
        const { router } = await renderPanel({ path: `/?estorno=1&despesa=${EXPENSE_ID}` });

        const dialog = await screen.findByRole('dialog', { name: 'Novo estorno' });
        const origin = await within(dialog).findByLabelText('Despesa de origem');
        expect(origin).toHaveValue(EXPENSE_ID);
        // As despesas da fatura atual e da última fechada.
        expect(within(origin).getByRole('group', { name: 'Fatura atual' })).toBeInTheDocument();
        expect(
            within(origin).getByRole('option', { name: /^Feira · 10 out\. · R\$ 400,00$/ }),
        ).toHaveValue(CLOSED_EXPENSE_ID);
        expect(within(dialog).getByLabelText('Data do estorno')).toHaveValue('2026-10-20');
        expect(within(dialog).getByText('Deixe vazio para a fatura do dia.')).toBeVisible();

        fireEvent.change(within(dialog).getByLabelText('Descrição'), {
            target: { value: 'Devolução do notebook' },
        });
        fireEvent.change(within(dialog).getByLabelText('Valor'), { target: { value: '150,00' } });
        await submit(dialog);

        await waitFor(() =>
            expect(mocks.post).toHaveBeenCalledWith('/credit-card-refunds', {
                body: {
                    creditCardId: CARD_ID,
                    description: 'Devolução do notebook',
                    amountCents: 15000,
                    occurredOn: '2026-10-20',
                    expenseId: EXPENSE_ID,
                },
            }),
        );
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(router.state.location.search).toEqual({});
        expect(await screen.findByText('Estorno registrado.')).toBeInTheDocument();
    });

    // AC-0013-08: `409 REFUND_EXCEEDS_EXPENSE` marca o valor; o diálogo continua aberto.
    it('marks the amount on REFUND_EXCEEDS_EXPENSE and the origin on REFUND_EXPENSE_MISMATCH', async () => {
        mocks.post.mockResolvedValueOnce(fail(409, 'REFUND_EXCEEDS_EXPENSE'));
        mocks.post.mockResolvedValueOnce(fail(409, 'REFUND_EXPENSE_MISMATCH'));
        mocks.post.mockResolvedValueOnce(fail(409, 'STATEMENT_CLOSED'));
        await renderPanel();

        await act(async () => {
            fireEvent.click(await screen.findByRole('button', { name: 'Novo estorno' }));
        });
        const dialog = await screen.findByRole('dialog', { name: 'Novo estorno' });
        await within(dialog).findByLabelText('Despesa de origem');
        fireEvent.change(within(dialog).getByLabelText('Descrição'), {
            target: { value: 'Devolução' },
        });
        fireEvent.change(within(dialog).getByLabelText('Valor'), { target: { value: '999,00' } });
        fireEvent.change(within(dialog).getByLabelText('Despesa de origem'), {
            target: { value: EXPENSE_ID },
        });
        await submit(dialog);

        const amount = within(dialog).getByLabelText('Valor');
        await waitFor(() => expect(amount).toHaveAttribute('aria-invalid', 'true'));
        expect(
            within(dialog).getByText(
                'O valor do estorno passa do que ainda pode ser estornado nessa despesa.',
            ),
        ).toBeVisible();
        expect(screen.queryByText('raw backend message')).not.toBeInTheDocument();

        await submit(dialog);
        await waitFor(() =>
            expect(within(dialog).getByLabelText('Despesa de origem')).toHaveAttribute(
                'aria-invalid',
                'true',
            ),
        );

        await submit(dialog);
        await waitFor(() =>
            expect(within(dialog).getByLabelText('Lançado em')).toHaveAttribute(
                'aria-invalid',
                'true',
            ),
        );
        expect(screen.getByRole('dialog', { name: 'Novo estorno' })).toBeInTheDocument();
    });

    it('ignores a ?despesa that is not among the options', async () => {
        await renderPanel({
            path: '/?estorno=1&despesa=60000000-0000-4000-8000-0000000000ff',
        });
        const dialog = await screen.findByRole('dialog', { name: 'Novo estorno' });
        expect(await within(dialog).findByLabelText('Despesa de origem')).toHaveValue('');
        expect(mocks.get).toHaveBeenCalledWith('/statements/{id}', {
            params: { path: { id: CLOSED_ID } },
        });
    });

    it('edits only the description and the notes', async () => {
        mocks.patch.mockResolvedValue(ok({ data: REFUND }));
        await renderPanel();

        const table = within(await screen.findByRole('table', { name: 'Estornos da fatura' }));
        await act(async () => {
            fireEvent.click(table.getByRole('button', { name: `Editar ${REFUND.description}` }));
        });
        const dialog = await screen.findByRole('dialog', { name: 'Editar estorno' });
        expect(within(dialog).queryByLabelText('Valor')).not.toBeInTheDocument();
        expect(within(dialog).getByLabelText('Descrição')).toHaveValue(REFUND.description);
        fireEvent.change(within(dialog).getByLabelText('Observações'), {
            target: { value: 'Crédito em 2 dias' },
        });
        await submit(dialog);

        await waitFor(() =>
            expect(mocks.patch).toHaveBeenCalledWith('/credit-card-refunds/{id}', {
                params: { path: { id: REFUND.id } },
                body: { notes: 'Crédito em 2 dias' },
            }),
        );
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(await screen.findByText('Estorno salvo.')).toBeInTheDocument();
    });

    it('deletes after confirming and keeps the alert in the dialog on STATEMENT_CLOSED', async () => {
        mocks.del.mockResolvedValueOnce(fail(409, 'STATEMENT_CLOSED'));
        mocks.del.mockResolvedValueOnce({
            data: undefined,
            error: undefined,
            response: { ok: true, status: 204 },
        });
        await renderPanel();

        const table = within(await screen.findByRole('table', { name: 'Estornos da fatura' }));
        await act(async () => {
            fireEvent.click(table.getByRole('button', { name: `Excluir ${REFUND.description}` }));
        });
        const dialog = await screen.findByRole('alertdialog', { name: 'Excluir estorno?' });
        await submit(dialog, 'Excluir');
        expect(await within(dialog).findByRole('alert')).toBeVisible();
        expect(mocks.del).toHaveBeenCalledWith('/credit-card-refunds/{id}', {
            params: { path: { id: REFUND.id } },
        });

        await submit(dialog, 'Excluir');
        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
        expect(await screen.findByText('Estorno excluído.')).toBeInTheDocument();
    });

    // AC-0013-09: com leitor, nenhuma ação de estorno, e `?estorno=1` não abre o diálogo.
    it('shows no refund action to a viewer and ignores ?estorno', async () => {
        await renderPanel({ profile: 'VIEWER', path: `/?estorno=1&despesa=${EXPENSE_ID}` });
        await screen.findByRole('table', { name: 'Estornos da fatura' });
        expect(screen.queryByRole('button', { name: /Novo estorno|Editar|Excluir/ })).toBeNull();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
