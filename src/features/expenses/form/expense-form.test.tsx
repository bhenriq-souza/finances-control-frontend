import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    createMemoryHistory,
    createRootRoute,
    createRouter,
    RouterProvider,
} from '@tanstack/react-router';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn() }));
vi.mock('@/api/client', () => ({ api: mocks }));

import { CURRENT_USER_QUERY_KEY } from '@/api/queries/current-user';
import { queryKeys } from '@/api/queries/keys';
import { createNoticeStore, NoticeProvider } from '@/ui/notice';

import { accountPayment, cardPayment } from '../expense-schema';
import type { Expense } from '../list/expense-model';
import {
    ACCOUNT_ID,
    ACCOUNTS,
    CARD_ID,
    CARDS,
    expenseFixture,
    GROUP_ID,
    TYPE_ID,
    TYPES,
} from '../list/expense-test-data';

import { changedFields, createdMessage, ExpenseFormDialog } from './expense-form';

const OLD_CARD_ID = '40000000-0000-4000-8000-000000000002';
const ALL_CARDS = [...CARDS, { id: OLD_CARD_ID, name: 'Cartão antigo', archivedAt: '2026-09-01' }];
const VIAGEM_ID = '20000000-0000-4000-8000-000000000002';
const SERIES_ID = '70000000-0000-4000-8000-000000000001';
const LAZER_ID = '20000000-0000-4000-8000-000000000003';
const ALL_TYPES = [...TYPES, { id: LAZER_ID, name: 'Lazer', archivedAt: null }];

const ok = (data: unknown, status = 200) => ({
    data: { data },
    error: undefined,
    response: { ok: true, status },
});
const fail = (status: number, code: string, details?: unknown) => ({
    data: undefined,
    error: { error: { code, message: 'raw message', details } },
    response: { ok: false, status },
});

const REFERENCE: Record<string, unknown> = {
    '/bank-accounts': ACCOUNTS,
    '/credit-cards': ALL_CARDS,
    '/expense-types': ALL_TYPES,
};

const onOpenChange = vi.fn();
const onCreated = vi.fn();
const onGone = vi.fn();

async function renderForm(expense?: Expense) {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    client.setQueryData(CURRENT_USER_QUERY_KEY, {
        id: 'u',
        email: 'ana@example.com',
        emailVerified: true,
        name: 'Ana',
        profile: 'ADMIN',
        profileGrantedAt: null,
        createdAt: '2026-10-01T00:00:00Z',
    });
    client.setQueryData(queryKeys.bankAccounts.all, ACCOUNTS);
    client.setQueryData(queryKeys.creditCards.all, ALL_CARDS);
    client.setQueryData(queryKeys.expenseTypes.all, ALL_TYPES);

    const router = createRouter({
        routeTree: createRootRoute({
            component: () => (
                <ExpenseFormDialog
                    open
                    expense={expense}
                    onOpenChange={onOpenChange}
                    onCreated={onCreated}
                    onGone={onGone}
                />
            ),
        }),
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
    return { client, dialog: screen.getByRole('dialog') };
}

function fill(dialog: HTMLElement, values: Record<string, string>) {
    for (const [label, value] of Object.entries(values)) {
        fireEvent.change(within(dialog).getByLabelText(label), { target: { value } });
    }
}

async function save(dialog: HTMLElement) {
    await act(async () => {
        fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    });
}

/** Abre o **Fatura de** recolhido (AC-0012-15). */
async function openStatement(dialog: HTMLElement) {
    await act(async () => {
        fireEvent.click(within(dialog).getByRole('button', { name: 'Lançar em outra fatura' }));
    });
}

const bodyOf = (mock: typeof mocks.POST) =>
    (mock.mock.calls[0]?.[1] as { body: Record<string, unknown> }).body;

const optionLabels = (select: HTMLElement) =>
    within(select)
        .getAllByRole('option')
        .map((option) => option.textContent);

beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ now: new Date('2026-10-12T15:00:00Z'), toFake: ['Date'] });
    mocks.GET.mockImplementation(async (path: string) => ok(REFERENCE[path] ?? []));
    mocks.POST.mockResolvedValue(ok([expenseFixture()], 201));
    mocks.PATCH.mockResolvedValue(ok(expenseFixture()));
});

afterEach(() => {
    vi.useRealTimers();
});

describe('ExpenseFormDialog — create (spec 0012)', () => {
    it('creates a variable expense on an account with the defaults', async () => {
        const { dialog, client } = await renderForm();
        const invalidate = vi.spyOn(client, 'invalidateQueries');

        expect(within(dialog).getByRole('heading', { name: 'Nova despesa' })).toBeVisible();
        expect(within(dialog).getByLabelText('Variável')).toBeChecked();
        expect(within(dialog).getByLabelText('Data')).toHaveValue('12/10/2026');
        expect(within(dialog).getByLabelText('Situação inicial')).toHaveValue('OPEN');
        expect(optionLabels(within(dialog).getByLabelText('Situação inicial'))).toEqual([
            'Pendente',
            'Previsto',
            'Verificando',
        ]);
        // Só os tipos, contas e cartões ativos; "Pagar com" com os grupos Contas e Cartões.
        expect(optionLabels(within(dialog).getByLabelText('Tipo'))).toEqual([
            'Escolha o tipo',
            'Mercado',
            'Lazer',
        ]);
        const payment = within(dialog).getByLabelText('Pagar com');
        expect([...payment.querySelectorAll('optgroup')].map((group) => group.label)).toEqual([
            'Contas',
            'Cartões',
        ]);
        expect(optionLabels(payment)).toEqual([
            'Escolha a conta ou o cartão',
            'Conta corrente',
            'Nubank',
        ]);

        fill(dialog, {
            Descrição: ' Mercado do mês ',
            Tipo: TYPE_ID,
            Valor: '234,90',
            'Pagar com': accountPayment(ACCOUNT_ID),
        });
        expect(within(dialog).getByLabelText('Vencimento')).toBeInTheDocument();
        expect(within(dialog).queryByLabelText('Fatura de')).not.toBeInTheDocument();
        fill(dialog, { Observações: 'Feira inclusa' });
        await save(dialog);

        expect(mocks.POST).toHaveBeenCalledWith('/expenses', {
            body: {
                kind: 'VARIABLE',
                description: 'Mercado do mês',
                expenseTypeId: TYPE_ID,
                amountCents: 23490,
                occurredOn: '2026-10-12',
                bankAccountId: ACCOUNT_ID,
                status: 'OPEN',
                notes: 'Feira inclusa',
            },
        });
        expect(await screen.findByText('Despesa salva.')).toBeInTheDocument();
        expect(onCreated).toHaveBeenCalledWith(
            expect.objectContaining({ id: expenseFixture().id }),
        );
        // INV-0009-02: invalidação pela matriz, domínio `expense`.
        expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
            ['expenses'],
            ['expense-recurrences'],
            ['bank-accounts'],
            ['credit-cards'],
            ['statements'],
            ['reports'],
        ]);
    });

    // AC-0012-03: parcelada de 1.200,00 em 3 vezes num cartão.
    it('creates an installment expense on a card and announces the created count', async () => {
        mocks.POST.mockResolvedValue(
            ok(
                [1, 2, 3].map((number) =>
                    expenseFixture({
                        id: `6000000${number}-0000-4000-8000-000000000001`,
                        installment: { groupId: GROUP_ID, number, total: 3 },
                    }),
                ),
                201,
            ),
        );
        const { dialog } = await renderForm();

        fireEvent.click(within(dialog).getByLabelText('Parcelada'));
        expect(within(dialog).getByLabelText('Valor total')).toBeInTheDocument();
        fill(dialog, {
            Descrição: 'Notebook',
            Tipo: TYPE_ID,
            'Valor total': '1.200,00',
            'Pagar com': cardPayment(CARD_ID),
            Parcelas: '3',
        });
        expect(within(dialog).getByLabelText('Data da compra')).toBeInTheDocument();
        expect(
            within(dialog).getByText(
                'Entra na fatura da data da compra. A fatura atual fecha em 03/11.',
            ),
        ).toBeInTheDocument();
        expect(within(dialog).queryByLabelText('Fatura de')).toBeNull();
        await save(dialog);

        const body = bodyOf(mocks.POST);
        expect(body).toEqual({
            kind: 'INSTALLMENT',
            description: 'Notebook',
            expenseTypeId: TYPE_ID,
            amountCents: 120000,
            occurredOn: '2026-10-12',
            creditCardId: CARD_ID,
            status: 'OPEN',
            installmentTotal: 3,
        });
        expect(body).not.toHaveProperty('bankAccountId');
        expect(await screen.findByText('3 despesas criadas.')).toBeInTheDocument();
        expect(onCreated).toHaveBeenCalledWith(
            expect.objectContaining({ id: '60000001-0000-4000-8000-000000000001' }),
        );
    });

    // AC-0012-15: Fatura de só aparece depois de "Lançar em outra fatura"; fechado, `postedOn` não
    // vai; aberto e preenchido, vai.
    it('sends postedOn only on a card, once opened and given', async () => {
        const { dialog } = await renderForm();
        fill(dialog, {
            Descrição: 'Tênis',
            Tipo: TYPE_ID,
            Valor: '300',
            'Pagar com': cardPayment(CARD_ID),
            'Data da compra': '2026-10-02',
        });
        expect(within(dialog).queryByLabelText('Fatura de')).toBeNull();
        expect(
            within(dialog).getByText(
                'Entra na fatura da data da compra. A fatura atual fecha em 03/11.',
            ),
        ).toBeInTheDocument();
        await save(dialog);
        expect(bodyOf(mocks.POST)).not.toHaveProperty('postedOn');

        mocks.POST.mockClear();
        await openStatement(dialog);
        expect(within(dialog).queryByText(/A fatura atual fecha em/)).toBeNull();
        expect(within(dialog).getByLabelText('Fatura de')).toHaveAccessibleDescription(
            'A despesa entra na fatura que contém esta data.',
        );
        fill(dialog, { 'Fatura de': '2026-11-04' });
        fireEvent.change(within(dialog).getByLabelText('Situação inicial'), {
            target: { value: 'FORECAST' },
        });
        await save(dialog);

        expect(bodyOf(mocks.POST)).toMatchObject({
            creditCardId: CARD_ID,
            occurredOn: '2026-10-02',
            postedOn: '2026-11-04',
            status: 'FORECAST',
        });
    });

    // AC-0012-15: sair do cartão recolhe a fatura e descarta o valor digitado; não vaza `postedOn`.
    it('drops a typed postedOn when the payment goes to an account and back to a card', async () => {
        const { dialog } = await renderForm();
        fill(dialog, {
            Descrição: 'Tênis',
            Tipo: TYPE_ID,
            Valor: '300',
            'Pagar com': cardPayment(CARD_ID),
        });
        await openStatement(dialog);
        fill(dialog, { 'Fatura de': '2026-11-04' });
        fill(dialog, { 'Pagar com': accountPayment(ACCOUNT_ID) });
        fill(dialog, { 'Pagar com': cardPayment(CARD_ID) });
        expect(within(dialog).queryByLabelText('Fatura de')).toBeNull();
        await save(dialog);

        expect(bodyOf(mocks.POST)).toMatchObject({ creditCardId: CARD_ID });
        expect(bodyOf(mocks.POST)).not.toHaveProperty('postedOn');
    });

    // AC-0012-04: **Repetir até** só existe na fixa e vai como `recurrenceEndsOn`.
    it('sends recurrenceEndsOn for a fixed expense; the field only exists in Fixa', async () => {
        const { dialog } = await renderForm();
        expect(within(dialog).queryByLabelText('Repetir até')).not.toBeInTheDocument();
        fireEvent.click(within(dialog).getByLabelText('Parcelada'));
        expect(within(dialog).queryByLabelText('Repetir até')).not.toBeInTheDocument();
        fireEvent.click(within(dialog).getByLabelText('Fixa'));
        expect(within(dialog).queryByLabelText('Parcelas')).not.toBeInTheDocument();
        expect(within(dialog).getByText('Sem data, a série segue mês a mês.')).toBeInTheDocument();

        fill(dialog, {
            Descrição: 'Aluguel',
            Tipo: TYPE_ID,
            Valor: '1.800,00',
            'Pagar com': accountPayment(ACCOUNT_ID),
            Vencimento: '2026-10-05',
            'Repetir até': '2027-09-05',
        });
        await save(dialog);

        expect(bodyOf(mocks.POST)).toEqual({
            kind: 'FIXED',
            description: 'Aluguel',
            expenseTypeId: TYPE_ID,
            amountCents: 180000,
            occurredOn: '2026-10-05',
            bankAccountId: ACCOUNT_ID,
            status: 'OPEN',
            recurrenceEndsOn: '2027-09-05',
        });
    });

    it('omits recurrenceEndsOn for a fixed expense without an end', async () => {
        const { dialog } = await renderForm();
        fireEvent.click(within(dialog).getByLabelText('Fixa'));
        fill(dialog, {
            Descrição: 'Aluguel',
            Tipo: TYPE_ID,
            Valor: '1.800,00',
            'Pagar com': accountPayment(ACCOUNT_ID),
        });
        await save(dialog);
        expect(bodyOf(mocks.POST)).not.toHaveProperty('recurrenceEndsOn');
    });

    it('validates the required fields without calling the API', async () => {
        const { dialog } = await renderForm();
        fill(dialog, { Descrição: '   ' });
        await save(dialog);

        expect(within(dialog).getByText('Informe a descrição.')).toBeInTheDocument();
        expect(within(dialog).getByText('Escolha o tipo.')).toBeInTheDocument();
        expect(within(dialog).getByText('Informe o valor.')).toBeInTheDocument();
        expect(within(dialog).getByText('Escolha a conta ou o cartão.')).toBeInTheDocument();
        expect(mocks.POST).not.toHaveBeenCalled();
    });

    it('validates the installments and the dates against the purchase date', async () => {
        const { dialog } = await renderForm();
        fireEvent.click(within(dialog).getByLabelText('Parcelada'));
        fill(dialog, {
            Descrição: 'Notebook',
            Tipo: TYPE_ID,
            'Valor total': '1.200,00',
            'Pagar com': cardPayment(CARD_ID),
        });
        await openStatement(dialog);
        fill(dialog, {
            'Data da compra': '2026-10-10',
            'Fatura de': '2026-10-01',
            Parcelas: '121',
        });
        await save(dialog);

        expect(within(dialog).getByLabelText('Parcelas')).toHaveAccessibleDescription(
            'Informe de 2 a 120 parcelas.',
        );
        expect(within(dialog).getByLabelText('Fatura de')).toHaveAccessibleDescription(
            'A despesa entra na fatura que contém esta data. A fatura não pode ser anterior à data da compra.',
        );
        expect(mocks.POST).not.toHaveBeenCalled();

        fireEvent.click(within(dialog).getByLabelText('Fixa'));
        fill(dialog, {
            'Pagar com': accountPayment(ACCOUNT_ID),
            Vencimento: '2026-10-10',
            'Repetir até': '2026-10-09',
        });
        await save(dialog);
        expect(within(dialog).getByLabelText('Repetir até')).toHaveAccessibleDescription(
            'Sem data, a série segue mês a mês. A data final não pode ser anterior à primeira data.',
        );
        expect(mocks.POST).not.toHaveBeenCalled();
    });

    // ERR-0012-01: o mapa de erros leva cada código ao seu campo, com a mensagem do catálogo.
    it.each([
        ['CREDIT_CARD_ARCHIVED', 'Pagar com', 'Esse cartão está arquivado.'],
        ['EXPENSE_TYPE_ARCHIVED', 'Tipo', 'Esse tipo de despesa está arquivado.'],
        ['STATEMENT_CLOSED', 'Fatura de', 'Essa fatura já está fechada'],
    ])('maps %s to the field %s', async (code, label, message) => {
        mocks.POST.mockResolvedValue(fail(409, code));
        const { dialog } = await renderForm();
        fill(dialog, {
            Descrição: 'Tênis',
            Tipo: TYPE_ID,
            Valor: '300',
            'Pagar com': cardPayment(CARD_ID),
        });
        await openStatement(dialog);
        fill(dialog, { 'Fatura de': '2026-11-04' });
        await save(dialog);

        const field = within(dialog).getByLabelText(label);
        expect(field).toHaveAttribute('aria-invalid', 'true');
        expect(field).toHaveAccessibleDescription(expect.stringContaining(message));
        expect(within(dialog).queryByText(/raw message/)).toBeNull();
        expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('maps STATEMENT_CLOSED to the date when no statement date was given', async () => {
        mocks.POST.mockResolvedValue(fail(409, 'STATEMENT_CLOSED'));
        const { dialog } = await renderForm();
        fill(dialog, {
            Descrição: 'Tênis',
            Tipo: TYPE_ID,
            Valor: '300',
            'Pagar com': cardPayment(CARD_ID),
        });
        await save(dialog);
        expect(within(dialog).getByLabelText('Data da compra')).toHaveAttribute(
            'aria-invalid',
            'true',
        );
    });

    // ERR-0012-03: `VALIDATION_ERROR` com `fieldMap` de todos os campos.
    it('maps a VALIDATION_ERROR to the fields it points at', async () => {
        mocks.POST.mockResolvedValue(
            fail(400, 'VALIDATION_ERROR', [{ path: ['installmentTotal'] }, { path: ['other'] }]),
        );
        const { dialog } = await renderForm();
        fireEvent.click(within(dialog).getByLabelText('Parcelada'));
        fill(dialog, {
            Descrição: 'Notebook',
            Tipo: TYPE_ID,
            'Valor total': '1.200,00',
            'Pagar com': accountPayment(ACCOUNT_ID),
            Parcelas: '3',
        });
        await save(dialog);

        expect(within(dialog).getByLabelText('Parcelas')).toHaveAttribute('aria-invalid', 'true');
        expect(within(dialog).getByRole('alert')).toBeInTheDocument();
    });

    it('builds the created notice for one or many', () => {
        expect(createdMessage(1)).toBe('Despesa salva.');
        expect(createdMessage(12)).toBe('12 despesas criadas.');
    });
});

const SERIES = expenseFixture({
    description: 'Aluguel',
    kind: 'FIXED',
    status: 'FORECAST',
    amountCents: 180000,
    occurredOn: '2026-11-05',
    recurrenceId: SERIES_ID,
});

describe('ExpenseFormDialog — edit (spec 0012)', () => {
    // AC-0012-05: ocorrência de série com **Esta e as próximas previstas**.
    it('patches a series occurrence and the next ones with only the changed fields', async () => {
        const { dialog } = await renderForm(SERIES);

        expect(within(dialog).getByRole('heading', { name: 'Alterar despesa' })).toBeVisible();
        expect(within(dialog).getByLabelText('Só esta')).toBeChecked();
        // Natureza, forma de pagamento e situação não mudam aqui.
        expect(within(dialog).queryByLabelText('Variável')).toBeNull();
        expect(within(dialog).queryByLabelText('Pagar com')).toBeNull();
        expect(within(dialog).queryByLabelText('Situação inicial')).toBeNull();
        expect(within(dialog).queryByLabelText('Repetir até')).toBeNull();
        expect(within(dialog).getByText('Fixa')).toBeInTheDocument();
        expect(within(dialog).getByText('Conta corrente')).toBeInTheDocument();

        fill(dialog, { Valor: '1.950,00' });
        fireEvent.click(within(dialog).getByLabelText('Esta e as próximas previstas'));
        await save(dialog);

        expect(mocks.PATCH).toHaveBeenCalledWith('/expenses/{id}', {
            params: { path: { id: SERIES.id }, query: { scope: 'following' } },
            body: { amountCents: 195000 },
        });
        expect(onOpenChange).toHaveBeenCalledWith(false);
        expect(await screen.findByText('Despesa salva.')).toBeInTheDocument();
    });

    it('patches only this occurrence by default, without scope', async () => {
        const { dialog } = await renderForm(SERIES);
        fill(dialog, { Descrição: 'Aluguel de novembro' });
        await save(dialog);

        expect(mocks.PATCH).toHaveBeenCalledWith('/expenses/{id}', {
            params: { path: { id: SERIES.id } },
            body: { description: 'Aluguel de novembro' },
        });
    });

    // INV-0012-05: o `PATCH` nunca envia natureza, status, pagamento nem campos de parcela.
    it('never sends kind, status, paidOn, payment method or installment fields', async () => {
        const installment = expenseFixture({
            kind: 'INSTALLMENT',
            bankAccountId: null,
            creditCardId: CARD_ID,
            postedOn: '2026-11-04',
            installment: { groupId: GROUP_ID, number: 2, total: 3 },
        });
        const { dialog } = await renderForm(installment);
        expect(
            within(dialog).getByText('A alteração vale só para esta parcela.'),
        ).toBeInTheDocument();
        expect(within(dialog).queryByLabelText('Só esta')).toBeNull();

        fill(dialog, {
            Descrição: 'Notebook',
            Tipo: LAZER_ID,
            Valor: '410,00',
            'Data da compra': '2026-10-16',
            'Fatura de': '2026-12-04',
            Observações: 'Troca',
        });
        await save(dialog);

        expect(mocks.PATCH).toHaveBeenCalledWith('/expenses/{id}', {
            params: { path: { id: installment.id } },
            body: {
                description: 'Notebook',
                expenseTypeId: LAZER_ID,
                amountCents: 41000,
                occurredOn: '2026-10-16',
                postedOn: '2026-12-04',
                notes: 'Troca',
            },
        });
        const body = bodyOf(mocks.PATCH);
        for (const key of [
            'kind',
            'status',
            'paidOn',
            'bankAccountId',
            'creditCardId',
            'installment',
            'installmentTotal',
            'recurrenceEndsOn',
        ]) {
            expect(body).not.toHaveProperty(key);
        }
    });

    it('keeps the archived current type as an option', async () => {
        const { dialog } = await renderForm(
            expenseFixture({
                expenseType: {
                    id: VIAGEM_ID,
                    name: 'Viagem',
                    archivedAt: '2026-09-01',
                    createdAt: '',
                },
            }),
        );
        expect(optionLabels(within(dialog).getByLabelText('Tipo'))).toEqual([
            'Escolha o tipo',
            'Mercado',
            'Viagem',
            'Lazer',
        ]);
        expect(within(dialog).getByLabelText('Tipo')).toHaveValue(VIAGEM_ID);
    });

    // AC-0012-15: ao alterar, Fatura de vem aberto só quando difere da data da compra.
    it('opens Fatura de on edit only when it differs from the purchase date', async () => {
        const same = expenseFixture({
            bankAccountId: null,
            creditCardId: CARD_ID,
            occurredOn: '2026-10-15',
            postedOn: '2026-10-15',
        });
        const { dialog } = await renderForm(same);
        expect(within(dialog).queryByLabelText('Fatura de')).toBeNull();
        expect(
            within(dialog).getByText(
                'Entra na fatura da data da compra. A fatura atual fecha em 03/11.',
            ),
        ).toBeInTheDocument();
        await openStatement(dialog);
        expect(within(dialog).getByLabelText('Fatura de')).toHaveValue('15/10/2026');
    });

    it('opens Fatura de on edit when the statement differs from the purchase date', async () => {
        const other = expenseFixture({
            bankAccountId: null,
            creditCardId: CARD_ID,
            occurredOn: '2026-10-15',
            postedOn: '2026-11-20',
        });
        const { dialog } = await renderForm(other);
        expect(within(dialog).getByLabelText('Fatura de')).toHaveValue('20/11/2026');
        expect(within(dialog).queryByRole('button', { name: 'Lançar em outra fatura' })).toBeNull();
    });

    it('does not change the amount of a paid expense and clears the notes with null', async () => {
        const paid = expenseFixture({ status: 'PAID', paidOn: '2026-10-15', notes: 'Antiga' });
        const { dialog } = await renderForm(paid);

        expect(within(dialog).getByLabelText('Valor')).toBeDisabled();
        expect(within(dialog).getByText('Despesa paga: o valor não muda.')).toBeInTheDocument();
        expect(within(dialog).queryByLabelText('Fatura de')).toBeNull();
        fill(dialog, { Observações: '' });
        await save(dialog);

        expect(bodyOf(mocks.PATCH)).toEqual({ notes: null });
    });

    it('closes without a request when nothing changed', async () => {
        const { dialog } = await renderForm(expenseFixture());
        await save(dialog);
        expect(mocks.PATCH).not.toHaveBeenCalled();
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('shows EXPENSE_ALREADY_PAID in the alert and reloads the expense', async () => {
        mocks.PATCH.mockResolvedValue(fail(409, 'EXPENSE_ALREADY_PAID'));
        const { dialog, client } = await renderForm(expenseFixture());
        const invalidate = vi.spyOn(client, 'invalidateQueries');
        fill(dialog, { Valor: '1,00' });
        await save(dialog);

        expect(within(dialog).getByRole('alert')).toHaveTextContent(
            'Essa despesa já foi paga e não pode mais ter o valor alterado nem ser excluída.',
        );
        await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['expenses'] }));
        expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('goes back to the list when the expense is gone', async () => {
        mocks.PATCH.mockResolvedValue(fail(404, 'EXPENSE_NOT_FOUND'));
        const { dialog } = await renderForm(expenseFixture());
        fill(dialog, { Descrição: 'Outra' });
        await save(dialog);

        expect(onGone).toHaveBeenCalled();
        expect(
            await screen.findByText(
                'Não encontramos essa despesa. Atualize a página e tente de novo.',
            ),
        ).toBeInTheDocument();
    });

    it('builds the PATCH body from the changed fields only', () => {
        const expense = expenseFixture({ notes: null });
        expect(
            changedFields(expense, {
                description: expense.description,
                expenseTypeId: TYPE_ID,
                amount: null,
                occurredOn: expense.occurredOn,
                postedOn: '2026-12-01',
                notes: '  ',
                scope: 'single',
            }),
        ).toEqual({});
    });
});
