import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
    RouterProvider,
} from '@tanstack/react-router';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/api/client', () => ({ api: { GET: mocks.get } }));

import { CURRENT_USER_QUERY_KEY, type Profile } from '@/api/queries/current-user';
import { queryKeys } from '@/api/queries/keys';
import { createNoticeStore, NoticeProvider } from '@/ui/notice';

import { ACCOUNTS, CARD_ID, CARDS, expenseFixture, GROUP_ID } from '../list/expense-test-data';

import {
    expenseDetailQuery,
    expenseDetailSearchSchema,
    ExpenseDetailPage,
    type ExpenseDetailSearch,
} from './expense-detail';

const ID = '60000000-0000-4000-8000-000000000001';

const ok = (body: unknown) => ({
    data: body,
    error: undefined,
    response: { ok: true, status: 200 },
});
const fail = (status: number, code: string) => ({
    data: undefined,
    error: { error: { code, message: 'raw message' } },
    response: { ok: false, status },
});

async function renderDetail({
    profile = 'VIEWER' as Profile,
    search = {} as ExpenseDetailSearch,
    onSearchChange = vi.fn(),
} = {}) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // Padrão, leitor: o detalhe só leitura, sem as ações de escrita.
    client.setQueryData(CURRENT_USER_QUERY_KEY, {
        id: 'u',
        email: 'ana@example.com',
        emailVerified: true,
        name: 'Ana',
        profile,
        profileGrantedAt: null,
        createdAt: '2026-10-01T00:00:00Z',
    });
    client.setQueryData(queryKeys.bankAccounts.all, ACCOUNTS);
    client.setQueryData(queryKeys.creditCards.all, CARDS);

    const root = createRootRoute();
    const page = createRoute({
        getParentRoute: () => root,
        path: '/',
        component: () => (
            <ExpenseDetailPage
                expenseId={ID}
                search={search}
                onSearchChange={onSearchChange}
                onBackToList={() => undefined}
            />
        ),
    });
    const router = createRouter({
        routeTree: root.addChildren([page]),
        history: createMemoryHistory({ initialEntries: ['/'] }),
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
}

const field = (term: string) => screen.getByText(term, { selector: 'dt' }).nextElementSibling;

beforeEach(() => {
    mocks.get.mockReset();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-20T12:00:00-03:00'));
});

afterEach(() => {
    vi.useRealTimers();
});

describe('ExpenseDetailPage (spec 0012)', () => {
    it('shows every field of a card installment, read only, with the group link', async () => {
        mocks.get.mockResolvedValue(
            ok({
                data: expenseFixture({
                    id: ID,
                    description: 'Notebook',
                    kind: 'INSTALLMENT',
                    amountCents: 40000,
                    occurredOn: '2026-10-10',
                    bankAccountId: null,
                    creditCardId: CARD_ID,
                    postedOn: '2026-11-04',
                    installment: { groupId: GROUP_ID, number: 2, total: 3 },
                    notes: 'Presente',
                }),
            }),
        );
        await renderDetail();

        expect(await screen.findByRole('heading', { name: 'Notebook', level: 1 })).toBeVisible();
        expect(mocks.get).toHaveBeenCalledWith('/expenses/{id}', { params: { path: { id: ID } } });
        // INV-0012-01: o valor só aparece por `Money`, com o `−`.
        expect(screen.getByText('−R$ 400,00')).toBeInTheDocument();
        expect(screen.getByText('Pendente')).toBeInTheDocument();
        expect(field('Natureza')).toHaveTextContent('Parcelada');
        expect(field('Tipo')).toHaveTextContent('Mercado');
        expect(field('Cartão')).toHaveTextContent('Nubank');
        expect(screen.getByRole('link', { name: 'Paga pela fatura do cartão' })).toHaveAttribute(
            'href',
            `/cartoes/${CARD_ID}`,
        );
        expect(field('Data da compra')).toHaveTextContent('10 de out. de 2026');
        expect(field('Fatura de')).toHaveTextContent('4 de nov. de 2026');
        expect(field('Observações')).toHaveTextContent('Presente');
        const installment = field('Parcela') as HTMLElement;
        expect(installment).toHaveTextContent('Parcela 2 de 3');
        expect(
            within(installment).getByRole('link', { name: 'Ver todas as parcelas' }),
        ).toHaveAttribute('href', `/despesas?grupo=${GROUP_ID}`);
        expect(screen.queryByText('Conta', { selector: 'dt' })).toBeNull();
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('shows an account expense of a series, paid, due today', async () => {
        mocks.get.mockResolvedValue(
            ok({
                data: expenseFixture({
                    id: ID,
                    description: 'Aluguel',
                    kind: 'FIXED',
                    status: 'PAID',
                    occurredOn: '2026-10-20',
                    paidOn: '2026-10-19',
                    recurrenceId: 'serie',
                }),
            }),
        );
        await renderDetail();

        expect(await screen.findByRole('heading', { name: 'Aluguel' })).toBeVisible();
        expect(screen.getByText('Pago')).toBeInTheDocument();
        expect(field('Conta')).toHaveTextContent('Conta corrente');
        expect(field('Vencimento')).toHaveTextContent('20 de out. de 2026');
        expect(field('Pago em')).toHaveTextContent('19 de out. de 2026');
        expect(field('Repetição')).toHaveTextContent('Fixa, mês a mês');
        expect(screen.queryByText('Fatura de', { selector: 'dt' })).toBeNull();
    });

    // T-0012-02: **Alterar** com `entries.write` abre o formulário por `?editar=1`.
    it('offers Alterar to a biller and opens the form through the search', async () => {
        mocks.get.mockResolvedValue(ok({ data: expenseFixture({ id: ID }) }));
        const onSearchChange = vi.fn();
        await renderDetail({ profile: 'BILLER', onSearchChange });

        fireEvent.click(await screen.findByRole('button', { name: 'Alterar' }));
        expect(onSearchChange).toHaveBeenCalledWith({ editar: 1 });
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('opens the edit form with ?editar=1 and clears it on cancel', async () => {
        mocks.get.mockResolvedValue(ok({ data: expenseFixture({ id: ID }) }));
        const onSearchChange = vi.fn();
        await renderDetail({ profile: 'ADMIN', search: { editar: 1 }, onSearchChange });

        const dialog = await screen.findByRole('dialog', { name: 'Alterar despesa' });
        expect(within(dialog).getByLabelText('Descrição')).toHaveValue('Mercado');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
        expect(onSearchChange).toHaveBeenCalledWith({ editar: undefined });
    });

    it('ignores ?editar=1 without entries.write', async () => {
        mocks.get.mockResolvedValue(ok({ data: expenseFixture({ id: ID }) }));
        await renderDetail({ search: { editar: 1 } });

        expect(await screen.findByRole('heading', { name: 'Mercado', level: 1 })).toBeVisible();
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    // ERR-0012-02 / ERR-0009-02.
    it('shows the not-found state with a link back to the list', async () => {
        mocks.get.mockResolvedValue(fail(404, 'EXPENSE_NOT_FOUND'));
        await renderDetail();

        expect(
            await screen.findByRole('heading', { name: 'Não encontramos este item.' }),
        ).toBeVisible();
        expect(screen.getByRole('link', { name: 'Voltar para despesas' })).toHaveAttribute(
            'href',
            '/despesas',
        );
    });

    // ERR-0012-02 / ERR-0009-01.
    it('shows the error state with the catalogue message and retries', async () => {
        mocks.get.mockResolvedValue(fail(500, 'INTERNAL_ERROR'));
        await renderDetail();

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('Não foi possível carregar.');
        expect(alert).not.toHaveTextContent('raw message');

        mocks.get.mockReturnValue(new Promise(() => undefined));
        fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
        expect(await screen.findByRole('status', { name: 'Carregando' })).toBeInTheDocument();
    });

    it('fails with UNEXPECTED_RESPONSE when the body has no data', async () => {
        mocks.get.mockResolvedValue(ok({}));
        await expect(new QueryClient().fetchQuery(expenseDetailQuery(ID))).rejects.toMatchObject({
            code: 'UNEXPECTED_RESPONSE',
        });
        expect(expenseDetailQuery(ID).queryKey).toEqual(queryKeys.expenses.detail(ID));
    });

    it('accepts the action parameters and drops invalid ones', () => {
        expect(expenseDetailSearchSchema.parse({ pagar: 1, editar: 1 })).toEqual({
            pagar: 1,
            editar: 1,
        });
        expect(expenseDetailSearchSchema.parse({ excluir: 'sim', meio: 2 })).toEqual({});
    });
});
