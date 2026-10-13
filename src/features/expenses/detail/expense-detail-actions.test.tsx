import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    createMemoryHistory,
    createRootRoute,
    createRouter,
    RouterProvider,
} from '@tanstack/react-router';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ GET: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() }));
vi.mock('@/api/client', () => ({ api: mocks }));

import { CURRENT_USER_QUERY_KEY, type Profile } from '@/api/queries/current-user';
import { queryKeys } from '@/api/queries/keys';
import { createNoticeStore, NoticeProvider } from '@/ui/notice';

import {
    ACCOUNT_ID,
    ACCOUNTS,
    CARD_ID,
    CARDS,
    expenseFixture,
    GROUP_ID,
} from '../list/expense-test-data';
import type { Expense } from '../list/expense-model';

import { ExpenseDetailPage, type ExpenseDetailSearch } from './expense-detail';

// Ações do detalhe de despesa (spec 0012, T-0012-03).

const ID = '60000000-0000-4000-8000-000000000001';
const ACCOUNT_OPEN = expenseFixture({ id: ID, description: 'Internet' });
const CARD_OPEN = expenseFixture({
    id: ID,
    description: 'Notebook',
    kind: 'INSTALLMENT',
    bankAccountId: null,
    creditCardId: CARD_ID,
    postedOn: '2026-10-15',
    installment: { groupId: GROUP_ID, number: 2, total: 3 },
});

const ok = (data: unknown) => ({ data: { data }, response: { ok: true, status: 200 } });
const noContent = () => ({ data: undefined, response: { ok: true, status: 204 } });
const fail = (status: number, code: string) => ({
    error: { error: { code, message: 'raw message' } },
    response: { ok: false, status },
});

const onBackToList = vi.fn();

/** O que `GET /expenses/{id}` responde dali em diante; contas e cartões vêm dos dados de teste. */
function respondWith(expense: Expense) {
    mocks.GET.mockImplementation(async (path: string) => {
        if (path === '/bank-accounts') return ok(ACCOUNTS);
        if (path === '/credit-cards') return ok(CARDS);
        return ok(expense);
    });
}

async function renderDetail(
    expense: Expense,
    initial: ExpenseDetailSearch = {},
    profile: Profile = 'ADMIN',
) {
    respondWith(expense);
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData(CURRENT_USER_QUERY_KEY, { profile });
    queryClient.setQueryData(queryKeys.bankAccounts.all, ACCOUNTS);
    queryClient.setQueryData(queryKeys.creditCards.all, CARDS);
    const searches: ExpenseDetailSearch[] = [];

    function Harness() {
        const [search, setSearch] = useState(initial);
        return (
            <ExpenseDetailPage
                expenseId={ID}
                search={search}
                onSearchChange={(next) =>
                    setSearch((previous) => {
                        const merged = { ...previous, ...next };
                        searches.push(merged);
                        return merged;
                    })
                }
                onBackToList={onBackToList}
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
                <NoticeProvider store={createNoticeStore()}>
                    <RouterProvider router={router} />
                </NoticeProvider>
            </QueryClientProvider>,
        );
    });
    // Texto e não papel: um diálogo aberto pelos parâmetros esconde o resto da árvore.
    await screen.findAllByText(expense.description);
    return { queryClient, searches };
}

const button = (name: string) => screen.queryByRole('button', { name });
const detailGets = () => mocks.GET.mock.calls.filter(([path]) => path === '/expenses/{id}').length;

async function click(element: HTMLElement) {
    await act(async () => {
        fireEvent.click(element);
    });
}

beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-20T12:00:00-03:00'));
});

afterEach(() => {
    vi.useRealTimers();
});

describe('ExpenseDetailPage actions (spec 0012)', () => {
    // INV-0012-03: as ações de uma despesa de conta pendente.
    it('offers Pagar, Marcar para verificar, Trocar forma de pagamento and Excluir on an open account expense', async () => {
        await renderDetail(ACCOUNT_OPEN);
        const names = screen.getAllByRole('button').map((b) => b.textContent);
        // **Alterar** é do formulário (T-0012-02) e vem antes das ações de status.
        expect(names).toEqual([
            'Alterar',
            'Pagar',
            'Marcar para verificar',
            'Trocar forma de pagamento',
            'Excluir',
        ]);
    });

    // AC-0012-06, INV-0012-02: despesa de cartão não tem Pagar, nem por `?pagar=1`.
    it('never offers Pagar on a card expense, even with ?pagar=1', async () => {
        await renderDetail(CARD_OPEN, { pagar: 1 });
        expect(button('Pagar')).toBeNull();
        expect(button('Marcar para verificar')).toBeInTheDocument();
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    // AC-0012-06: Pagar com a data padrão envia `{ status: 'PAID', paidOn: <hoje> }`.
    it('pays an account expense with today as the default date', async () => {
        const { searches, queryClient } = await renderDetail(ACCOUNT_OPEN);
        const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
        await click(screen.getByRole('button', { name: 'Pagar' }));
        expect(searches.at(-1)).toEqual({ pagar: 1 });

        const dialog = await screen.findByRole('dialog', { name: 'Pagar a despesa' });
        expect(within(dialog).getByLabelText('Pago em')).toHaveValue('20/10/2026');
        mocks.PATCH.mockResolvedValueOnce(ok({ ...ACCOUNT_OPEN, status: 'PAID' }));
        await click(within(dialog).getByRole('button', { name: 'Pagar' }));

        expect(mocks.PATCH).toHaveBeenCalledWith('/expenses/{id}/status', {
            params: { path: { id: ID } },
            body: { status: 'PAID', paidOn: '2026-10-20' },
        });
        expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.expenses.all });
        expect(searches.at(-1)).toEqual({ pagar: undefined });
        expect(await screen.findByText('Despesa paga.')).toBeInTheDocument();
    });

    // AC-0012-09: `409 EXPENSE_STATUS_TRANSITION_NOT_ALLOWED` mostra o catálogo e recarrega.
    it('shows the transition conflict in the open dialog and reloads the expense', async () => {
        await renderDetail(ACCOUNT_OPEN, { pagar: 1 });
        const dialog = screen.getByRole('dialog', { name: 'Pagar a despesa' });
        const before = detailGets();
        // Outra sessão já pagou: o recarregamento traz `PAID` e o diálogo continua aberto.
        respondWith({ ...ACCOUNT_OPEN, status: 'PAID', paidOn: '2026-10-19' });
        mocks.PATCH.mockResolvedValueOnce(fail(409, 'EXPENSE_STATUS_TRANSITION_NOT_ALLOWED'));
        await click(within(dialog).getByRole('button', { name: 'Pagar' }));

        expect(within(dialog).getByRole('alert')).toHaveTextContent(
            'Não é possível mudar a despesa para esse status. Atualize a página e confira o status atual.',
        );
        expect(within(dialog).getByRole('alert')).not.toHaveTextContent('raw message');
        await waitFor(() => expect(detailGets()).toBeGreaterThan(before));
        expect(screen.getByRole('dialog', { name: 'Pagar a despesa' })).toBe(dialog);
    });

    // INV-0012-03: cada status com as ações da tabela; transições diretas enviam só `{ status }`.
    it('confirms a forecast expense sending only the status', async () => {
        await renderDetail({ ...ACCOUNT_OPEN, status: 'FORECAST' });
        expect(button('Pagar')).toBeNull();
        mocks.PATCH.mockResolvedValueOnce(ok(ACCOUNT_OPEN));
        await click(screen.getByRole('button', { name: 'Confirmar' }));

        expect(mocks.PATCH).toHaveBeenCalledWith('/expenses/{id}/status', {
            params: { path: { id: ID } },
            body: { status: 'OPEN' },
        });
        expect(await screen.findByText('Despesa confirmada.')).toBeInTheDocument();
    });

    it('shows a direct transition error with the link to the card', async () => {
        await renderDetail({ ...CARD_OPEN, status: 'VERIFYING' });
        mocks.PATCH.mockResolvedValueOnce(fail(409, 'CREDIT_CARD_EXPENSE_PAID_BY_STATEMENT'));
        await click(screen.getByRole('button', { name: 'Voltar para pendente' }));

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('Despesa de cartão é paga pela fatura.');
        expect(within(alert).getByRole('link', { name: 'Ver o cartão' })).toHaveAttribute(
            'href',
            `/cartoes/${CARD_ID}`,
        );
    });

    it('undoes a payment after confirming', async () => {
        await renderDetail({ ...ACCOUNT_OPEN, status: 'PAID', paidOn: '2026-10-19' });
        expect(button('Excluir')).toBeNull();
        expect(button('Trocar forma de pagamento')).toBeNull();
        await click(screen.getByRole('button', { name: 'Desfazer pagamento' }));

        const dialog = await screen.findByRole('alertdialog', { name: 'Desfazer o pagamento?' });
        expect(mocks.PATCH).not.toHaveBeenCalled();
        mocks.PATCH.mockResolvedValueOnce(ok(ACCOUNT_OPEN));
        await click(within(dialog).getByRole('button', { name: 'Desfazer pagamento' }));

        expect(mocks.PATCH).toHaveBeenCalledWith('/expenses/{id}/status', {
            params: { path: { id: ID } },
            body: { status: 'OPEN' },
        });
        expect(await screen.findByText('Pagamento desfeito.')).toBeInTheDocument();
    });

    it('offers only Alterar on a paid card expense', async () => {
        await renderDetail({ ...CARD_OPEN, status: 'PAID', paidOn: '2026-11-10' });
        const names = screen.getAllByRole('button').map((b) => b.textContent);
        expect(names).toEqual(['Alterar']);
    });

    // AC-0012-13: **Estornar** leva ao **Novo estorno** do cartão com a despesa selecionada.
    const refundLink = () => screen.queryByRole('link', { name: 'Estornar' });
    const refundHref = `/cartoes/${CARD_ID}?estorno=1&despesa=${ID}`;

    it.each(['OPEN', 'OVERDUE', 'VERIFYING', 'PAID'] as const)(
        'links Estornar to the card refund on a %s card expense',
        async (status) => {
            await renderDetail({ ...CARD_OPEN, status });
            expect(refundLink()).toHaveAttribute('href', refundHref);
        },
    );

    it('places Estornar after the transitions', async () => {
        await renderDetail(CARD_OPEN);
        const group = screen.getByRole('button', { name: 'Marcar para verificar' }).parentElement!;
        const names = [...group.children].map((element) => element.textContent);
        expect(names).toEqual([
            'Marcar para verificar',
            'Estornar',
            'Trocar forma de pagamento',
            'Excluir',
        ]);
    });

    it('does not offer Estornar on a forecast card expense', async () => {
        await renderDetail({ ...CARD_OPEN, status: 'FORECAST' });
        expect(button('Confirmar')).toBeInTheDocument();
        expect(refundLink()).toBeNull();
    });

    it('does not offer Estornar on an account expense', async () => {
        await renderDetail({ ...ACCOUNT_OPEN, status: 'PAID', paidOn: '2026-10-10' });
        expect(button('Desfazer pagamento')).toBeInTheDocument();
        expect(refundLink()).toBeNull();
        expect(document.querySelector('a[href*="estorno"]')).toBeNull();
    });

    it('does not offer Estornar to a viewer', async () => {
        await renderDetail(CARD_OPEN, {}, 'VIEWER');
        expect(refundLink()).toBeNull();
        expect(document.querySelector('a[href*="estorno"]')).toBeNull();
    });

    // AC-0012-07, INV-0012-04: a cascata da parcela antes do `DELETE`, depois volta para a lista.
    it('deletes an installment after showing the cascade and goes back to the list', async () => {
        await renderDetail(CARD_OPEN);
        await click(screen.getByRole('button', { name: 'Excluir' }));
        const dialog = await screen.findByRole('alertdialog', { name: 'Excluir a despesa?' });
        expect(dialog).toHaveTextContent(
            'Todas as parcelas não pagas deste parcelamento serão excluídas.',
        );
        expect(mocks.DELETE).not.toHaveBeenCalled();

        mocks.DELETE.mockResolvedValueOnce(noContent());
        await click(within(dialog).getByRole('button', { name: 'Excluir' }));

        expect(mocks.DELETE).toHaveBeenCalledWith('/expenses/{id}', {
            params: { path: { id: ID } },
        });
        expect(onBackToList).toHaveBeenCalledOnce();
        expect(await screen.findByText('Despesa excluída.')).toBeInTheDocument();
    });

    it('shows the series cascade when deleting an occurrence', async () => {
        await renderDetail(
            { ...ACCOUNT_OPEN, kind: 'FIXED', recurrenceId: 'serie' },
            { excluir: 1 },
        );
        expect(screen.getByRole('alertdialog')).toHaveTextContent(
            'Esta ocorrência e as seguintes ainda não pagas serão excluídas, e a série termina.',
        );
    });

    // Mapa de erros: `EXPENSE_NOT_FOUND` numa ação avisa e volta para a lista.
    it('goes back to the list when the expense is gone', async () => {
        await renderDetail(ACCOUNT_OPEN, { excluir: 1 });
        mocks.DELETE.mockResolvedValueOnce(fail(404, 'EXPENSE_NOT_FOUND'));
        await click(
            within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Excluir' }),
        );

        expect(onBackToList).toHaveBeenCalledOnce();
        const notices = await screen.findByLabelText('Avisos');
        await waitFor(() =>
            expect(notices).toHaveTextContent(
                'Não encontramos essa despesa. Atualize a página e tente de novo.',
            ),
        );
    });

    // AC-0012-08 / AC-0012-15: troca para um cartão envia `creditCardId`; a fatura vem recolhida
    // atrás de "Lançar em outra fatura"; `STATEMENT_CLOSED` marca Fatura de quando enviada.
    it('moves an account expense to a card and marks Fatura de on a closed statement', async () => {
        await renderDetail(ACCOUNT_OPEN, { meio: 1 });
        const dialog = screen.getByRole('dialog', { name: 'Trocar forma de pagamento' });
        const select = within(dialog).getByLabelText('Pagar com');
        // A conta atual e a arquivada não são opções.
        expect(within(select).queryByRole('option', { name: 'Conta corrente' })).toBeNull();
        expect(within(select).queryByRole('option', { name: 'Poupança antiga' })).toBeNull();
        expect(within(dialog).queryByLabelText('Fatura de')).toBeNull();
        expect(within(dialog).queryByText('Aplicar a')).toBeNull();

        fireEvent.change(select, { target: { value: `cartao:${CARD_ID}` } });
        // Recolhida: o texto com o fechamento da fatura atual e o link; sem o campo.
        expect(
            within(dialog).getByText(
                'Entra na fatura da data da compra. A fatura atual fecha em 03/11.',
            ),
        ).toBeInTheDocument();
        expect(within(dialog).queryByLabelText('Fatura de')).toBeNull();
        mocks.PATCH.mockResolvedValueOnce(fail(409, 'STATEMENT_CLOSED'));
        await click(within(dialog).getByRole('button', { name: 'Trocar' }));

        expect(mocks.PATCH).toHaveBeenCalledWith('/expenses/{id}/payment-method', {
            params: { path: { id: ID } },
            body: { creditCardId: CARD_ID },
        });
        // Sem `postedOn` enviado não há campo para marcar: o erro vai para o alerta.
        expect(within(dialog).getByRole('alert')).toHaveTextContent('Essa fatura já está fechada');

        await click(within(dialog).getByRole('button', { name: 'Lançar em outra fatura' }));
        expect(within(dialog).queryByText(/A fatura atual fecha em/)).toBeNull();
        const posted = within(dialog).getByLabelText('Fatura de');
        expect(posted).toHaveAccessibleDescription(
            'A despesa entra na fatura que contém esta data.',
        );
        fireEvent.change(posted, { target: { value: '2026-11-04' } });
        mocks.PATCH.mockResolvedValueOnce(fail(409, 'STATEMENT_CLOSED'));
        await click(within(dialog).getByRole('button', { name: 'Trocar' }));
        expect(posted).toHaveAttribute('aria-invalid', 'true');
        expect(posted).toHaveAccessibleDescription(
            expect.stringContaining('Essa fatura já está fechada'),
        );

        fireEvent.change(posted, { target: { value: '2026-12-04' } });
        mocks.PATCH.mockResolvedValueOnce(ok([ACCOUNT_OPEN]));
        await click(within(dialog).getByRole('button', { name: 'Trocar' }));
        expect(mocks.PATCH).toHaveBeenLastCalledWith('/expenses/{id}/payment-method', {
            params: { path: { id: ID } },
            body: { creditCardId: CARD_ID, postedOn: '2026-12-04' },
        });
        expect(await screen.findByText('Forma de pagamento trocada.')).toBeInTheDocument();
    });

    it('requires a destination and a statement not before the purchase', async () => {
        await renderDetail(ACCOUNT_OPEN, { meio: 1 });
        const dialog = screen.getByRole('dialog', { name: 'Trocar forma de pagamento' });
        await click(within(dialog).getByRole('button', { name: 'Trocar' }));
        expect(within(dialog).getByLabelText('Pagar com')).toHaveAccessibleDescription(
            'Escolha a conta ou o cartão.',
        );

        fireEvent.change(within(dialog).getByLabelText('Pagar com'), {
            target: { value: `cartao:${CARD_ID}` },
        });
        await click(within(dialog).getByRole('button', { name: 'Lançar em outra fatura' }));
        fireEvent.change(within(dialog).getByLabelText('Fatura de'), {
            target: { value: '2026-10-01' },
        });
        await click(within(dialog).getByRole('button', { name: 'Trocar' }));
        expect(within(dialog).getByLabelText('Fatura de')).toHaveAccessibleDescription(
            expect.stringContaining('A fatura não pode ser anterior à data da compra.'),
        );
        expect(mocks.PATCH).not.toHaveBeenCalled();
    });

    // AC-0012-15: voltar para uma conta recolhe a fatura e descarta o valor digitado.
    it('drops a typed statement date when the destination goes back to an account', async () => {
        await renderDetail(ACCOUNT_OPEN, { meio: 1 });
        const dialog = screen.getByRole('dialog', { name: 'Trocar forma de pagamento' });
        const select = within(dialog).getByLabelText('Pagar com');
        fireEvent.change(select, { target: { value: `cartao:${CARD_ID}` } });
        await click(within(dialog).getByRole('button', { name: 'Lançar em outra fatura' }));
        fireEvent.change(within(dialog).getByLabelText('Fatura de'), {
            target: { value: '2026-12-04' },
        });
        fireEvent.change(select, { target: { value: '' } });
        fireEvent.change(select, { target: { value: `cartao:${CARD_ID}` } });
        expect(within(dialog).queryByLabelText('Fatura de')).toBeNull();
        mocks.PATCH.mockResolvedValueOnce(ok([ACCOUNT_OPEN]));
        await click(within(dialog).getByRole('button', { name: 'Trocar' }));
        expect(mocks.PATCH).toHaveBeenCalledWith('/expenses/{id}/payment-method', {
            params: { path: { id: ID } },
            body: { creditCardId: CARD_ID },
        });
    });

    // INV-0012-04: parcela mostra que vale para todas as não pagas; série pergunta o escopo.
    it('notes the installment cascade and moves a card installment to an account', async () => {
        await renderDetail(CARD_OPEN, { meio: 1 });
        const dialog = screen.getByRole('dialog', { name: 'Trocar forma de pagamento' });
        expect(dialog).toHaveTextContent('Vale para todas as parcelas não pagas do parcelamento.');
        fireEvent.change(within(dialog).getByLabelText('Pagar com'), {
            target: { value: `conta:${ACCOUNT_ID}` },
        });
        mocks.PATCH.mockResolvedValueOnce(ok([CARD_OPEN, CARD_OPEN]));
        await click(within(dialog).getByRole('button', { name: 'Trocar' }));

        expect(mocks.PATCH).toHaveBeenCalledWith('/expenses/{id}/payment-method', {
            params: { path: { id: ID } },
            body: { bankAccountId: ACCOUNT_ID },
        });
    });

    it('sends scope=following when a series occurrence chooses the following ones', async () => {
        await renderDetail({ ...ACCOUNT_OPEN, kind: 'FIXED', recurrenceId: 'serie' }, { meio: 1 });
        const dialog = screen.getByRole('dialog', { name: 'Trocar forma de pagamento' });
        expect(within(dialog).getByLabelText('Só esta')).toBeChecked();
        fireEvent.click(within(dialog).getByLabelText('Esta e as próximas previstas'));
        fireEvent.change(within(dialog).getByLabelText('Pagar com'), {
            target: { value: `cartao:${CARD_ID}` },
        });
        mocks.PATCH.mockResolvedValueOnce(ok([ACCOUNT_OPEN]));
        await click(within(dialog).getByRole('button', { name: 'Trocar' }));

        expect(mocks.PATCH).toHaveBeenCalledWith('/expenses/{id}/payment-method', {
            params: { path: { id: ID }, query: { scope: 'following' } },
            body: { creditCardId: CARD_ID },
        });
    });

    it('requires the payment date and closes the dialogs on Cancelar', async () => {
        const { searches } = await renderDetail(ACCOUNT_OPEN, { pagar: 1 });
        const pay = screen.getByRole('dialog', { name: 'Pagar a despesa' });
        const date = within(pay).getByLabelText('Pago em');
        fireEvent.change(date, { target: { value: '' } });
        await click(within(pay).getByRole('button', { name: 'Pagar' }));
        expect(date).toHaveAccessibleDescription('Informe a data do pagamento.');
        expect(mocks.PATCH).not.toHaveBeenCalled();
        await click(within(pay).getByRole('button', { name: 'Cancelar' }));
        expect(searches.at(-1)).toEqual({ pagar: undefined });

        await click(screen.getByRole('button', { name: 'Trocar forma de pagamento' }));
        const method = screen.getByRole('dialog', { name: 'Trocar forma de pagamento' });
        await click(within(method).getByRole('button', { name: 'Cancelar' }));
        expect(searches.at(-1)).toMatchObject({ meio: undefined });

        await click(screen.getByRole('button', { name: 'Excluir' }));
        const remove = screen.getByRole('alertdialog', { name: 'Excluir a despesa?' });
        expect(remove).toHaveTextContent('A despesa será excluída.');
        await click(within(remove).getByRole('button', { name: 'Cancelar' }));
        expect(searches.at(-1)).toMatchObject({ excluir: undefined });
        expect(mocks.DELETE).not.toHaveBeenCalled();
    });

    it('shows an undo error in the confirmation and clears it on cancel', async () => {
        await renderDetail({ ...ACCOUNT_OPEN, status: 'PAID', paidOn: '2026-10-19' });
        await click(screen.getByRole('button', { name: 'Desfazer pagamento' }));
        const dialog = screen.getByRole('alertdialog', { name: 'Desfazer o pagamento?' });
        mocks.PATCH.mockResolvedValueOnce(fail(500, 'INTERNAL_ERROR'));
        await click(within(dialog).getByRole('button', { name: 'Desfazer pagamento' }));
        expect(await within(dialog).findByRole('alert')).not.toHaveTextContent('raw message');

        await click(within(dialog).getByRole('button', { name: 'Cancelar' }));
        await click(screen.getByRole('button', { name: 'Desfazer pagamento' }));
        expect(
            within(screen.getByRole('alertdialog')).queryByRole('alert'),
        ).not.toBeInTheDocument();
    });

    // AC-0012-10: sem `entries.write`, nenhuma ação e nenhum diálogo pela URL.
    it('shows no action and opens no dialog for a leitor', async () => {
        await renderDetail(ACCOUNT_OPEN, { pagar: 1, excluir: 1, meio: 1 }, 'VIEWER');
        expect(screen.queryByRole('button')).toBeNull();
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(screen.queryByRole('alertdialog')).toBeNull();
    });
});
