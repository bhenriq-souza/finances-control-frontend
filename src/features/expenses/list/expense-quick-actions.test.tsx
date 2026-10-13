import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    createMemoryHistory,
    createRootRoute,
    createRouter,
    RouterProvider,
} from '@tanstack/react-router';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ GET: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() }));
vi.mock('@/api/client', () => ({ api: mocks }));

import { CURRENT_USER_QUERY_KEY, type Profile } from '@/api/queries/current-user';
import { queryKeys } from '@/api/queries/keys';
import { createNoticeStore, NoticeProvider } from '@/ui/notice';

import { ExpenseListPage } from './expense-list-page';
import { expenseListQuery, type ExpenseListSearch } from './expense-list-search';
import { ACCOUNTS, CARD_ID, CARDS, expenseFixture, TYPES } from './expense-test-data';

// Ações rápidas da lista de despesas (spec 0012, T-0012-06).

const INTERNET = expenseFixture({
    id: '60000000-0000-4000-8000-0000000000a1',
    description: 'Internet',
});
const FORECAST = expenseFixture({
    id: '60000000-0000-4000-8000-0000000000a2',
    description: 'Seguro',
    status: 'FORECAST',
});
const CARD = expenseFixture({
    id: '60000000-0000-4000-8000-0000000000a3',
    description: 'Mercado',
    bankAccountId: null,
    creditCardId: CARD_ID,
});
const PAID = expenseFixture({
    id: '60000000-0000-4000-8000-0000000000a4',
    description: 'Aluguel',
    status: 'PAID',
    paidOn: '2026-10-05',
});
const ALL = [INTERNET, FORECAST, CARD, PAID];

const ok = (data: unknown) => ({ data: { data }, response: { ok: true, status: 200 } });
const fail = (status: number, code: string) => ({
    error: { error: { code, message: 'raw message' } },
    response: { ok: false, status },
});

const user = {
    async click(element: Element) {
        await act(async () => {
            fireEvent.pointerDown(element, { button: 0, ctrlKey: false, pointerType: 'mouse' });
            fireEvent.pointerUp(element, { button: 0, pointerType: 'mouse' });
            fireEvent.click(element);
        });
    },
};

async function renderList(
    initial: ExpenseListSearch = { mes: '2026-10' },
    profile: Profile = 'ADMIN',
) {
    mocks.GET.mockImplementation(
        async (path: string, options?: { params?: { path?: { id: string } } }) => {
            if (path === '/expenses/{id}') {
                const found = ALL.find((e) => e.id === options?.params?.path?.id);
                return found ? ok(found) : fail(404, 'EXPENSE_NOT_FOUND');
            }
            return ok(ALL);
        },
    );
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    client.setQueryData(CURRENT_USER_QUERY_KEY, { profile });
    client.setQueryData(queryKeys.bankAccounts.all, ACCOUNTS);
    client.setQueryData(queryKeys.creditCards.all, CARDS);
    client.setQueryData(queryKeys.expenseTypes.all, TYPES);
    client.setQueryData(queryKeys.expenses.list(expenseListQuery(initial)), ALL);
    const searches: ExpenseListSearch[] = [];

    function Harness() {
        const [search, setSearch] = useState(initial);
        return (
            <ExpenseListPage
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
            <QueryClientProvider client={client}>
                <NoticeProvider store={createNoticeStore()}>
                    <RouterProvider router={router} />
                </NoticeProvider>
            </QueryClientProvider>,
        );
    });
    return { searches };
}

async function openMenu(description: string) {
    await user.click(screen.getAllByRole('button', { name: `Ações de ${description}` })[0]!);
    const menu = await screen.findByRole('menu');
    return {
        menu,
        labels: within(menu)
            .getAllByRole('menuitem')
            .map((item) => item.textContent),
    };
}

beforeEach(() => {
    mocks.GET.mockReset();
    mocks.PATCH.mockReset();
    mocks.DELETE.mockReset();
});

describe('Quick actions of the expense list (spec 0012)', () => {
    // INV-0012-06: o menu segue o modelo de ações do detalhe, por status e por conta ou cartão.
    it.each([
        ['Internet', ['Pagar', 'Marcar para verificar', 'Editar', 'Excluir']],
        ['Seguro', ['Confirmar', 'Editar', 'Excluir']],
        ['Mercado', ['Marcar para verificar', 'Editar', 'Excluir']],
        ['Aluguel', ['Desfazer pagamento', 'Editar']],
    ])('offers the detail actions for %s', async (description, expected) => {
        await renderList();
        const { labels } = await openMenu(description);
        expect(labels).toEqual(expected);
    });

    // AC-0012-16: Pagar abre o diálogo sobre a lista e mantém o mês e os filtros.
    it('opens Pagar over the list, sends the payment and keeps the month and filters', async () => {
        mocks.PATCH.mockResolvedValue({ data: undefined, response: { ok: true, status: 200 } });
        const { searches } = await renderList({ mes: '2026-10', status: 'OPEN' });

        const { menu } = await openMenu('Internet');
        await user.click(within(menu).getByRole('menuitem', { name: 'Pagar' }));
        expect(searches.at(-1)).toEqual({ mes: '2026-10', status: 'OPEN', pagar: INTERNET.id });

        const dialog = await screen.findByRole('dialog', { name: 'Pagar a despesa' });
        await user.click(within(dialog).getByRole('button', { name: 'Pagar' }));

        await waitFor(() => expect(mocks.PATCH).toHaveBeenCalledTimes(1));
        expect(mocks.PATCH.mock.calls[0]?.[1].body).toMatchObject({ status: 'PAID' });
        expect(mocks.PATCH.mock.calls[0]?.[1].params.path.id).toBe(INTERNET.id);
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(searches.at(-1)).toEqual({ mes: '2026-10', status: 'OPEN', pagar: undefined });
    });

    // AC-0012-16: o menu de uma despesa de cartão não tem Pagar, nem o parâmetro abre o diálogo.
    it('ignores ?pagar for a card expense and removes the parameter', async () => {
        const { searches } = await renderList({ mes: '2026-10', pagar: CARD.id });

        await waitFor(() => expect(searches.at(-1)).toEqual({ mes: '2026-10', pagar: undefined }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('ignores an unknown id in ?excluir and removes the parameter', async () => {
        const { searches } = await renderList({
            mes: '2026-10',
            excluir: '60000000-0000-4000-8000-0000000000ff',
        });

        await waitFor(() =>
            expect(searches.at(-1)).toEqual({ mes: '2026-10', excluir: undefined }),
        );
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // AC-0012-17: Confirmar envia direto; o 409 vira alerta acima da lista com o nome.
    it('confirms a forecast directly and shows a conflict as an alert with the name', async () => {
        mocks.PATCH.mockResolvedValueOnce(fail(409, 'EXPENSE_STATUS_TRANSITION_NOT_ALLOWED'));
        await renderList();

        const { menu } = await openMenu('Seguro');
        await user.click(within(menu).getByRole('menuitem', { name: 'Confirmar' }));

        await waitFor(() => expect(mocks.PATCH).toHaveBeenCalledTimes(1));
        expect(mocks.PATCH.mock.calls[0]?.[1].body).toEqual({ status: 'OPEN' });
        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('Seguro:');
        expect(alert).not.toHaveTextContent('raw message');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Fechar alerta' }));
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('confirms a forecast with a notice on success', async () => {
        mocks.PATCH.mockResolvedValueOnce({ data: undefined, response: { ok: true, status: 200 } });
        await renderList();

        const { menu } = await openMenu('Seguro');
        await user.click(within(menu).getByRole('menuitem', { name: 'Confirmar' }));

        await waitFor(() => expect(mocks.PATCH).toHaveBeenCalledTimes(1));
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    // AC-0012-17: leitor não tem menu e ?pagar não abre nada.
    it('gives a leitor no menu and no dialog from the URL', async () => {
        await renderList({ mes: '2026-10', pagar: INTERNET.id }, 'LEITOR' as Profile);

        expect(screen.queryByRole('button', { name: /^Ações de/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(mocks.GET.mock.calls.some(([path]) => path === '/expenses/{id}')).toBe(false);
    });

    it('opens Excluir over the list from the URL, with the cascade text', async () => {
        await renderList({ mes: '2026-10', excluir: INTERNET.id });

        const dialog = await screen.findByRole('alertdialog', { name: 'Excluir a despesa?' });
        expect(dialog).toHaveTextContent('A despesa será excluída.');
    });

    it('opens Desfazer for a paid account expense and Editar for any expense', async () => {
        await renderList({ mes: '2026-10', desfazer: PAID.id });
        expect(
            await screen.findByRole('alertdialog', { name: 'Desfazer o pagamento?' }),
        ).toBeInTheDocument();
    });

    it('opens the edit form over the list from the menu', async () => {
        const { searches } = await renderList();
        const { menu } = await openMenu('Internet');
        await user.click(within(menu).getByRole('menuitem', { name: 'Editar' }));

        expect(searches.at(-1)).toEqual({ mes: '2026-10', editar: INTERNET.id });
        expect(await screen.findByRole('dialog', { name: 'Alterar despesa' })).toBeInTheDocument();
    });
});
