import { expect, test, type Page } from '@playwright/test';

import type { components } from '../src/api/generated/schema';

import { stubApi, type ApiStub, type StubRoute } from './fixtures/api';
import { chooseUser, signInWithEmail, stubUsersMe, type E2EUser } from './fixtures/auth';
import {
    ACCOUNT_ID,
    BANK_ACCOUNTS,
    CARD_ID,
    CREDIT_CARDS,
    EXPENSE_TYPES,
    EXPENSES_TODAY,
    OCTOBER_EXPENSES,
} from './fixtures/data/expenses';
import { stubRuntime } from './fixtures/runtime-config';

// Formulário de despesa: criar (variável, parcelada, fixa) e alterar com o escopo da série
// (spec 0012, T-0012-02).

type Expense = components['schemas']['ExpenseResponse'];

const REFERENCE: StubRoute[] = [
    { method: 'GET', path: '/bank-accounts', body: { data: BANK_ACCOUNTS } },
    { method: 'GET', path: '/credit-cards', body: { data: CREDIT_CARDS } },
    { method: 'GET', path: '/expense-types', body: { data: EXPENSE_TYPES } },
    { method: 'GET', path: '/expenses', body: { data: OCTOBER_EXPENSES } },
];

const MERCADO = EXPENSE_TYPES[1]!;
const GROUP_ID = '50000000-0000-4000-8000-0000000000aa';

/** As 3 parcelas que o `POST /expenses` devolve para a compra parcelada do teste. */
const NEW_INSTALLMENTS: Expense[] = [1, 2, 3].map((number) => ({
    id: `6000000${number}-0000-4000-8000-0000000000aa`,
    description: 'Geladeira',
    kind: 'INSTALLMENT',
    status: 'OPEN',
    amountCents: 40000,
    occurredOn: `2026-${String(9 + number).padStart(2, '0')}-20`,
    paidOn: null,
    notes: null,
    expenseType: MERCADO,
    bankAccountId: null,
    creditCardId: CARD_ID,
    postedOn: `2026-${String(9 + number).padStart(2, '0')}-20`,
    installment: { groupId: GROUP_ID, number, total: 3 },
    recurrenceId: null,
    createdAt: '2026-10-20T12:00:00Z',
    updatedAt: '2026-10-20T12:00:00Z',
}));

/** Uma ocorrência prevista de série, numa conta. */
const SERIES: Expense = {
    ...OCTOBER_EXPENSES.find(({ description }) => description === 'Aluguel')!,
    id: '60000000-0000-4000-8000-0000000000bb',
    status: 'FORECAST',
    paidOn: null,
    occurredOn: '2026-11-05',
};

async function open(
    page: Page,
    path: string,
    { user = 'ativo', routes = [] }: { user?: E2EUser; routes?: StubRoute[] } = {},
): Promise<ApiStub> {
    await page.clock.setFixedTime(new Date(EXPENSES_TODAY));
    await stubRuntime(page);
    await chooseUser(page, user);
    const stub = await stubApi(page, [...REFERENCE, ...routes]);
    await stubUsersMe(page, user);
    await page.goto(`/entrar?redirect=${encodeURIComponent(path)}`);
    await signInWithEmail(page);
    return stub;
}

const writes = (stub: ApiStub, method: 'POST' | 'PATCH') =>
    stub.requests.filter((request) => request.method === method);

// AC-0012-03, AC-0012-12: parcelada de 1.200,00 em 3 vezes num cartão, pelo `FormDialog`.
test('creates an installment expense on a card and opens the first one', async ({ page }) => {
    const first = NEW_INSTALLMENTS[0]!;
    const stub = await open(page, '/despesas?mes=2026-10', {
        routes: [
            { method: 'POST', path: '/expenses', status: 201, body: { data: NEW_INSTALLMENTS } },
            { method: 'GET', path: `/expenses/${first.id}`, body: { data: first } },
        ],
    });

    await page.getByRole('button', { name: 'Nova despesa' }).click();
    await expect(page).toHaveURL(/novo=1/);
    const dialog = page.getByRole('dialog', { name: 'Nova despesa' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Salvar' })).toBeInViewport();

    await dialog.getByLabel('Parcelada').check();
    await dialog.getByLabel('Descrição').fill('Geladeira');
    await dialog.getByLabel('Tipo').selectOption({ label: 'Mercado' });
    await dialog.getByLabel('Valor total').fill('1.200,00');
    await dialog.getByLabel('Pagar com').selectOption({ label: 'Nubank' });
    await expect(dialog.getByLabel('Data da compra')).toHaveValue('2026-10-20');
    await expect(dialog.getByLabel('Fatura de')).toBeVisible();
    await dialog.getByLabel('Parcelas').fill('3');
    await dialog.getByRole('button', { name: 'Salvar' }).click();

    await expect(page.getByText('3 despesas criadas.')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/despesas/${first.id}$`));
    await expect(page.getByRole('heading', { name: 'Geladeira', level: 1 })).toBeVisible();

    const [post] = writes(stub, 'POST');
    expect(post?.body).toEqual({
        kind: 'INSTALLMENT',
        description: 'Geladeira',
        expenseTypeId: MERCADO.id,
        amountCents: 120000,
        occurredOn: '2026-10-20',
        creditCardId: CARD_ID,
        status: 'OPEN',
        installmentTotal: 3,
    });
    expect(post?.body).not.toHaveProperty('bankAccountId');
});

// AC-0012-04: **Repetir até** só existe na fixa e vai como `recurrenceEndsOn`.
test('creates a fixed expense with an end date; the field only exists in Fixa', async ({
    page,
}) => {
    const stub = await open(page, '/despesas?mes=2026-10&novo=1', {
        routes: [
            { method: 'POST', path: '/expenses', status: 201, body: { data: [SERIES] } },
            { method: 'GET', path: `/expenses/${SERIES.id}`, body: { data: SERIES } },
        ],
    });

    const dialog = page.getByRole('dialog', { name: 'Nova despesa' });
    await expect(dialog.getByLabel('Variável')).toBeChecked();
    await expect(dialog.getByLabel('Repetir até')).toHaveCount(0);
    await dialog.getByLabel('Parcelada').check();
    await expect(dialog.getByLabel('Repetir até')).toHaveCount(0);
    await dialog.getByLabel('Fixa').check();
    await expect(dialog.getByText('Sem data, a série segue mês a mês.')).toBeVisible();

    await dialog.getByLabel('Descrição').fill('Aluguel');
    await dialog.getByLabel('Tipo').selectOption({ label: 'Moradia' });
    await dialog.getByLabel('Valor', { exact: true }).fill('1800');
    await dialog.getByLabel('Pagar com').selectOption({ label: 'Conta corrente' });
    await dialog.getByLabel('Vencimento').fill('2026-11-05');
    await dialog.getByLabel('Repetir até').fill('2027-10-05');
    await dialog.getByLabel('Situação inicial').selectOption({ label: 'Previsto' });
    await dialog.getByRole('button', { name: 'Salvar' }).click();

    await expect(page.getByText('Despesa salva.')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/despesas/${SERIES.id}$`));
    expect(writes(stub, 'POST')[0]?.body).toEqual({
        kind: 'FIXED',
        description: 'Aluguel',
        expenseTypeId: EXPENSE_TYPES[0]!.id,
        amountCents: 180000,
        occurredOn: '2026-11-05',
        bankAccountId: ACCOUNT_ID,
        status: 'FORECAST',
        recurrenceEndsOn: '2027-10-05',
    });
});

// AC-0012-05, INV-0012-05: ocorrência de série, **Esta e as próximas previstas**, só o alterado.
test('edits a series occurrence and the next forecast ones', async ({ page }) => {
    const stub = await open(page, `/despesas/${SERIES.id}`, {
        routes: [
            { method: 'GET', path: `/expenses/${SERIES.id}`, body: { data: SERIES } },
            { method: 'PATCH', path: `/expenses/${SERIES.id}`, body: { data: SERIES } },
        ],
    });

    await page.getByRole('button', { name: 'Alterar' }).click();
    await expect(page).toHaveURL(/editar=1/);
    const dialog = page.getByRole('dialog', { name: 'Alterar despesa' });
    await expect(dialog.getByLabel('Pagar com')).toHaveCount(0);
    await expect(dialog.getByLabel('Só esta')).toBeChecked();

    await dialog.getByLabel('Valor', { exact: true }).fill('1.950,00');
    await dialog.getByLabel('Esta e as próximas previstas').check();
    await dialog.getByRole('button', { name: 'Salvar' }).click();

    await expect(page.getByText('Despesa salva.')).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(page).not.toHaveURL(/editar=1/);
    const [patch] = writes(stub, 'PATCH');
    expect(patch?.query).toEqual({ scope: 'following' });
    expect(patch?.body).toEqual({ amountCents: 195000 });
});

// AC-0012-10 (formulário): sem `entries.write`, `?novo=1` e `?editar=1` não abrem diálogo.
test('a leitor never gets the expense form', async ({ page }) => {
    await open(page, '/despesas?mes=2026-10&novo=1', {
        user: 'leitor',
        routes: [{ method: 'GET', path: `/expenses/${SERIES.id}`, body: { data: SERIES } }],
    });
    await expect(page.getByRole('heading', { name: 'Despesas', level: 1 })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.goto(`/despesas/${SERIES.id}?editar=1`);
    await signInWithEmail(page);
    await expect(page.getByRole('heading', { name: 'Aluguel', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Alterar' })).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
});
