import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
    RouterProvider,
    useParams,
} from '@tanstack/react-router';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() }));
vi.mock('@/api/client', () => ({
    api: { GET: mocks.get, POST: mocks.post, PATCH: mocks.patch, DELETE: mocks.del },
}));

import { CURRENT_USER_QUERY_KEY, type Profile } from '@/api/queries/current-user';
import { queryKeys } from '@/api/queries/keys';
import type { CreditCard } from '@/api/queries/reference';
import { createNoticeStore, NoticeProvider } from '@/ui/notice';

import { StatementDetailPage } from '../detail/statement-detail';
import {
    statementDetailSearchSchema,
    statementsPanelSearchSchema,
    type Statement,
} from '../panel/statement-model';
import { StatementsPanel } from '../panel/statements-panel';
import {
    ACCOUNT_ID,
    ACCOUNTS,
    CARD_ID,
    CLOSED,
    CLOSED_ID,
    CURRENT,
    OLDER,
} from '../panel/test-data';

function ok(data: unknown) {
    return { data: { data }, error: undefined, response: new Response(null, { status: 200 }) };
}

function noContent() {
    return { data: undefined, error: undefined, response: new Response(null, { status: 204 }) };
}

function failure(status: number, code: string) {
    return {
        data: undefined,
        error: { error: { code, message: 'raw backend message' } },
        response: new Response(null, { status }),
    };
}

const CARD = {
    id: CARD_ID,
    name: 'Nubank Roxinho',
    paymentBankAccountId: ACCOUNT_ID,
} as CreditCard;

const PAYMENT = {
    id: '80000000-0000-4000-8000-000000000010',
    bankAccountId: ACCOUNT_ID,
    amountCents: 5000,
    paidOn: '2026-10-16',
    createdAt: '2026-10-16T12:00:00Z',
};
const LAST_PAYMENT = {
    id: '80000000-0000-4000-8000-000000000011',
    bankAccountId: ACCOUNT_ID,
    amountCents: 3000,
    paidOn: '2026-10-18',
    createdAt: '2026-10-18T12:00:00Z',
};

const CLOSED_DETAIL: Statement = { ...CLOSED, expenses: [], refunds: [], payments: [] };

/** O que a API serve; um teste troca para simular a mudança noutra sessão. */
let served: { current: Statement; detail: Statement; list: Statement[] };

async function renderAt(path: string, profile: Profile = 'BILLER') {
    mocks.get.mockImplementation((route: string) => {
        if (route === '/statements/current') return Promise.resolve(ok(served.current));
        if (route === '/statements/{id}') return Promise.resolve(ok(served.detail));
        if (route === '/statements') return Promise.resolve(ok(served.list));
        return Promise.resolve(ok([]));
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(CURRENT_USER_QUERY_KEY, { profile });
    client.setQueryData(queryKeys.bankAccounts.all, ACCOUNTS);
    client.setQueryData(queryKeys.creditCards.all, [CARD]);

    const root = createRootRoute();
    const panel = createRoute({
        getParentRoute: () => root,
        path: '/cartoes/$cartaoId',
        validateSearch: statementsPanelSearchSchema,
        component: () => <StatementsPanel cardId={CARD_ID} />,
    });
    const detail = createRoute({
        getParentRoute: () => root,
        path: '/cartoes/$cartaoId/faturas/$faturaId',
        validateSearch: statementDetailSearchSchema,
        component: function Detail() {
            const { faturaId = '' } = useParams({ strict: false });
            return <StatementDetailPage cardId={CARD_ID} statementId={faturaId} />;
        },
    });
    const router = createRouter({
        routeTree: root.addChildren([panel, detail]),
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

const PANEL = `/cartoes/${CARD_ID}`;
const DETAIL = `/cartoes/${CARD_ID}/faturas/${CLOSED_ID}`;

async function openPay() {
    fireEvent.click(await screen.findByRole('button', { name: 'Pagar fatura' }));
    return screen.findByRole('dialog', { name: 'Pagar fatura' });
}

function submit(dialog: HTMLElement, name = 'Pagar') {
    fireEvent.click(within(dialog).getByRole('button', { name }));
}

beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    served = { current: CURRENT, detail: CLOSED_DETAIL, list: [CURRENT, CLOSED, OLDER] };
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-20T12:00:00-03:00'));
});

afterEach(() => {
    vi.useRealTimers();
});

describe('statement payments (spec 0013)', () => {
    // AC-0013-03: fechada, total restante e conta pagadora padrão.
    it('pays the remaining of a closed statement with the default paying account', async () => {
        mocks.post.mockResolvedValue(ok(CLOSED_DETAIL));
        await renderAt(DETAIL);
        const dialog = await openPay();
        expect(within(dialog).getByRole('radio', { name: /Total restante/ })).toBeChecked();
        expect(within(dialog).getByRole('combobox', { name: 'Conta' })).toHaveValue(ACCOUNT_ID);

        submit(dialog);

        await waitFor(() =>
            expect(mocks.post).toHaveBeenCalledWith('/statements/{id}/payments', {
                params: { path: { id: CLOSED_ID } },
                body: { amountCents: 35000, bankAccountId: ACCOUNT_ID, paidOn: '2026-10-20' },
            }),
        );
        expect(await screen.findByText('Pagamento registrado.')).toBeInTheDocument();
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    // AC-0013-03: aberta, pela rota de `current` com `creditCardId`; `?pagar=1` abre o diálogo.
    it('pays the open statement through /statements/current/payments', async () => {
        mocks.post.mockResolvedValue(ok(CURRENT));
        await renderAt(`${PANEL}?pagar=1`);
        const dialog = await screen.findByRole('dialog', { name: 'Pagar fatura' });
        // Sem mínimo informado, a opção não aparece (AC-0013-04).
        expect(within(dialog).queryByRole('radio', { name: /Mínimo/ })).not.toBeInTheDocument();

        submit(dialog);

        await waitFor(() =>
            expect(mocks.post).toHaveBeenCalledWith('/statements/current/payments', {
                body: {
                    creditCardId: CARD_ID,
                    amountCents: 40345,
                    bankAccountId: ACCOUNT_ID,
                    paidOn: '2026-10-20',
                },
            }),
        );
    });

    // AC-0013-04.
    it('sends minimumPaymentCents − paidCents for Mínimo', async () => {
        served.detail = { ...CLOSED_DETAIL, paidCents: 2000, remainingCents: 33000 };
        mocks.post.mockResolvedValue(ok(CLOSED_DETAIL));
        await renderAt(DETAIL);
        const dialog = await openPay();
        fireEvent.click(within(dialog).getByRole('radio', { name: 'Mínimo · R$ 50,00' }));
        submit(dialog);

        await waitFor(() => expect(mocks.post).toHaveBeenCalled());
        expect(mocks.post.mock.calls[0]?.[1]).toMatchObject({ body: { amountCents: 5000 } });
    });

    it('sends another amount typed in reais as cents', async () => {
        mocks.post.mockResolvedValue(ok(CLOSED_DETAIL));
        await renderAt(DETAIL);
        const dialog = await openPay();
        fireEvent.click(within(dialog).getByRole('radio', { name: 'Outro valor' }));
        fireEvent.change(within(dialog).getByRole('textbox', { name: 'Outro valor' }), {
            target: { value: '123,45' },
        });
        submit(dialog);

        await waitFor(() => expect(mocks.post).toHaveBeenCalled());
        expect(mocks.post.mock.calls[0]?.[1]).toMatchObject({ body: { amountCents: 12345 } });
    });

    // AC-0013-05, INV-0013-04: o link vem da lista carregada, nunca da mensagem do backend.
    it('shows STATEMENT_PREVIOUS_UNPAID with a link to the pending closed statement', async () => {
        mocks.post.mockResolvedValue(failure(409, 'STATEMENT_PREVIOUS_UNPAID'));
        await renderAt(PANEL);
        const dialog = await openPay();
        submit(dialog);

        const alert = await within(dialog).findByRole('alert');
        expect(alert).toHaveTextContent(
            'Há uma fatura anterior fechada sem pagar. Pague essa fatura antes.',
        );
        expect(within(alert).getByRole('link', { name: /outubro de 2026/ })).toHaveAttribute(
            'href',
            DETAIL,
        );
        expect(screen.queryByText(/raw backend message/)).not.toBeInTheDocument();
        expect(screen.getByRole('dialog', { name: 'Pagar fatura' })).toBeInTheDocument();
    });

    // AC-0013-05: o valor é marcado e a fatura é recarregada.
    it('marks the amount on STATEMENT_PAYMENT_EXCEEDS_REMAINING and reloads the statement', async () => {
        mocks.post.mockResolvedValue(failure(409, 'STATEMENT_PAYMENT_EXCEEDS_REMAINING'));
        await renderAt(DETAIL);
        const dialog = await openPay();
        const fetches = mocks.get.mock.calls.filter(([r]) => r === '/statements/{id}').length;
        submit(dialog);

        const group = within(dialog).getByRole('group', { name: 'Valor' });
        expect(
            await within(group).findByText(
                'O valor do pagamento passa do que falta pagar na fatura. Informe um valor menor.',
            ),
        ).toBeInTheDocument();
        expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
        await waitFor(() =>
            expect(mocks.get.mock.calls.filter(([r]) => r === '/statements/{id}').length).toBe(
                fetches + 1,
            ),
        );
    });

    // Mapa de erros: a fatura recarregada já paga não fecha o diálogo do erro.
    it('keeps the dialog and the alert when STATEMENT_ALREADY_PAID reloads a paid statement', async () => {
        mocks.post.mockImplementation(() => {
            served.detail = {
                ...CLOSED_DETAIL,
                status: 'PAID',
                paidCents: 35000,
                remainingCents: 0,
            };
            return Promise.resolve(failure(409, 'STATEMENT_ALREADY_PAID'));
        });
        await renderAt(DETAIL);
        const dialog = await openPay();
        submit(dialog);

        expect(await within(dialog).findByRole('alert')).toHaveTextContent(
            'Essa fatura já está paga.',
        );
        await waitFor(() =>
            expect(screen.queryByRole('button', { name: 'Pagar fatura', hidden: true })).toBeNull(),
        );
        expect(screen.getByRole('dialog', { name: 'Pagar fatura' })).toBeInTheDocument();
    });

    it('marks the account on BANK_ACCOUNT_ARCHIVED', async () => {
        mocks.post.mockResolvedValue(failure(409, 'BANK_ACCOUNT_ARCHIVED'));
        await renderAt(DETAIL);
        const dialog = await openPay();
        submit(dialog);
        await waitFor(() =>
            expect(within(dialog).getByRole('combobox', { name: 'Conta' })).toHaveAttribute(
                'aria-invalid',
                'true',
            ),
        );
    });
});

describe('undo payment (spec 0013)', () => {
    // AC-0013-06, INV-0013-02: só no último, pela rota da fechada.
    it('offers Desfazer only on the last payment and deletes it on the closed route', async () => {
        served.detail = { ...CLOSED_DETAIL, payments: [LAST_PAYMENT, PAYMENT] };
        mocks.del.mockResolvedValue(noContent());
        await renderAt(DETAIL);
        await screen.findByRole('heading', { name: 'Fatura de outubro de 2026' });

        const undo = screen.getAllByRole('button', { name: /^Desfazer pagamento de/ });
        // Celular e tablet: a mesma ação na forma de cartão e na de tabela.
        expect(new Set(undo.map((button) => button.getAttribute('aria-label')))).toEqual(
            new Set(['Desfazer pagamento de 18 out.']),
        );
        fireEvent.click(undo[0]!);
        const dialog = await screen.findByRole('alertdialog', { name: 'Desfazer pagamento?' });
        expect(dialog).toHaveTextContent(
            'O valor volta para a conta e a fatura fica com o restante de novo.',
        );
        fireEvent.click(within(dialog).getByRole('button', { name: 'Desfazer pagamento' }));

        await waitFor(() =>
            expect(mocks.del).toHaveBeenCalledWith('/statements/{id}/payments/{paymentId}', {
                params: { path: { id: CLOSED_ID, paymentId: LAST_PAYMENT.id } },
            }),
        );
        expect(await screen.findByText('Pagamento desfeito.')).toBeInTheDocument();
    });

    // AC-0013-06: na aberta, a rota de `current` com `creditCardId`.
    it('deletes an early payment through /statements/current with creditCardId', async () => {
        mocks.del.mockResolvedValue(noContent());
        await renderAt(PANEL);
        fireEvent.click(
            (await screen.findAllByRole('button', { name: /^Desfazer pagamento de/ }))[0]!,
        );
        const dialog = await screen.findByRole('alertdialog');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Desfazer pagamento' }));

        await waitFor(() =>
            expect(mocks.del).toHaveBeenCalledWith('/statements/current/payments/{paymentId}', {
                params: {
                    path: { paymentId: CURRENT.payments![0]!.id },
                    query: { creditCardId: CARD_ID },
                },
            }),
        );
    });

    it('keeps the confirmation open with the alert on STATEMENT_PAYMENT_LOCKED', async () => {
        mocks.del.mockResolvedValue(failure(409, 'STATEMENT_PAYMENT_LOCKED'));
        await renderAt(PANEL);
        fireEvent.click(
            (await screen.findAllByRole('button', { name: /^Desfazer pagamento de/ }))[0]!,
        );
        const dialog = await screen.findByRole('alertdialog');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Desfazer pagamento' }));
        expect(await within(dialog).findByRole('alert')).toHaveTextContent(
            'Só é possível desfazer o último pagamento da fatura',
        );
    });
});

describe('minimum (spec 0013)', () => {
    // AC-0013-07.
    it('sends PATCH /statements/{id} with the minimum in cents', async () => {
        mocks.patch.mockResolvedValue(ok(CLOSED_DETAIL));
        await renderAt(`${DETAIL}?minimo=1`);
        const dialog = await screen.findByRole('dialog', { name: 'Informar mínimo' });
        const input = within(dialog).getByRole('textbox', { name: 'Mínimo' });
        expect(input).toHaveValue('70,00');
        fireEvent.change(input, { target: { value: '1.234,56' } });
        submit(dialog, 'Salvar');

        await waitFor(() =>
            expect(mocks.patch).toHaveBeenCalledWith('/statements/{id}', {
                params: { path: { id: CLOSED_ID } },
                body: { minimumPaymentCents: 123456 },
            }),
        );
        expect(await screen.findByText('Mínimo informado.')).toBeInTheDocument();
    });

    it('is not offered on the open statement', async () => {
        await renderAt(`${PANEL}?minimo=1`);
        await screen.findByRole('button', { name: 'Pagar fatura' });
        expect(screen.queryByRole('button', { name: 'Informar mínimo' })).not.toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});

// AC-0013-09.
describe('read only (spec 0013)', () => {
    it.each([PANEL, DETAIL])('shows no write action to leitor on %s', async (path) => {
        await renderAt(`${path}?pagar=1&minimo=1`, 'VIEWER');
        await screen.findAllByText('Restante');
        for (const name of [/Pagar fatura/, /Informar mínimo/, /Desfazer/]) {
            expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
        }
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
