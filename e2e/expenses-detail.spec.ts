import { expect, test, type Page } from '@playwright/test';

import { stubApi, type ApiStub, type StubRoute } from './fixtures/api';
import { chooseUser, signInWithEmail, stubUsersMe, type E2EUser } from './fixtures/auth';
import {
    BANK_ACCOUNTS,
    CARD_ID,
    CREDIT_CARDS,
    EXPENSE_TYPES,
    EXPENSES_TODAY,
    NOTEBOOK,
    OCTOBER_EXPENSES,
} from './fixtures/data/expenses';
import { stubRuntime } from './fixtures/runtime-config';

// Ações do detalhe de despesa (spec 0012, T-0012-03).

const INTERNET = OCTOBER_EXPENSES.find(({ description }) => description === 'Internet')!;

const REFERENCE: StubRoute[] = [
    { method: 'GET', path: '/bank-accounts', body: { data: BANK_ACCOUNTS } },
    { method: 'GET', path: '/credit-cards', body: { data: CREDIT_CARDS } },
    { method: 'GET', path: '/expense-types', body: { data: EXPENSE_TYPES } },
    { method: 'GET', path: '/expenses', body: { data: OCTOBER_EXPENSES } },
];

const conflict = (code: string) => ({ status: 409, body: { error: { code, message: 'raw' } } });

async function openDetail(
    page: Page,
    expense: { id: string; description: string },
    {
        user = 'ativo',
        search = '',
        routes = [],
    }: { user?: E2EUser; search?: string; routes?: StubRoute[] } = {},
): Promise<ApiStub> {
    await page.clock.setFixedTime(new Date(EXPENSES_TODAY));
    await stubRuntime(page);
    await chooseUser(page, user);
    const stub = await stubApi(page, [
        ...REFERENCE,
        { method: 'GET', path: `/expenses/${expense.id}`, body: { data: expense } },
        ...routes,
    ]);
    await stubUsersMe(page, user);
    const path = `/despesas/${expense.id}${search}`;
    await page.goto(`/entrar?redirect=${encodeURIComponent(path)}`);
    await signInWithEmail(page);
    await expect(page.getByText(expense.description, { exact: true }).first()).toBeAttached();
    return stub;
}

const requestsTo = (stub: ApiStub, method: string, path: string) =>
    stub.requests.filter((request) => request.method === method && request.path === path);

// AC-0012-06: Pagar com a data padrão envia `{ status: 'PAID', paidOn: <hoje> }`.
test('pays an account expense with today as the payment date', async ({ page }) => {
    const stub = await openDetail(page, INTERNET, {
        routes: [
            {
                method: 'PATCH',
                path: `/expenses/${INTERNET.id}/status`,
                body: { data: { ...INTERNET, status: 'PAID', paidOn: '2026-10-20' } },
            },
        ],
    });

    await page.getByRole('button', { name: 'Pagar' }).click();
    await expect(page).toHaveURL(/pagar=1/);
    const dialog = page.getByRole('dialog', { name: 'Pagar a despesa' });
    await expect(dialog.getByLabel('Pago em')).toHaveValue('20/10/2026');
    await dialog.getByRole('button', { name: 'Pagar' }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByRole('region', { name: 'Avisos' })).toContainText('Despesa paga.');
    expect(requestsTo(stub, 'PATCH', `/expenses/${INTERNET.id}/status`)[0]?.body).toEqual({
        status: 'PAID',
        paidOn: '2026-10-20',
    });
    await expect(page).not.toHaveURL(/pagar=1/);
});

// AC-0012-06, INV-0012-02: despesa de cartão não tem Pagar, nem por `?pagar=1`.
test('a card expense has no Pagar, even with ?pagar=1', async ({ page }) => {
    await openDetail(page, NOTEBOOK, { search: '?pagar=1' });

    await expect(page.getByRole('button', { name: 'Marcar para verificar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pagar' })).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
});

// AC-0012-07, INV-0012-04: excluir uma parcela mostra a cascata, envia `DELETE` e volta à lista.
test('deleting an installment shows the cascade and goes back to the list', async ({ page }) => {
    const stub = await openDetail(page, NOTEBOOK, {
        routes: [{ method: 'DELETE', path: `/expenses/${NOTEBOOK.id}` }],
    });

    await page.getByRole('button', { name: 'Excluir' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Excluir a despesa?' });
    await expect(dialog).toContainText(
        'Todas as parcelas não pagas deste parcelamento serão excluídas.',
    );
    expect(requestsTo(stub, 'DELETE', `/expenses/${NOTEBOOK.id}`)).toHaveLength(0);
    await dialog.getByRole('button', { name: 'Excluir' }).click();

    await expect(page).toHaveURL(/\/despesas$/);
    await expect(page.getByRole('heading', { name: 'Despesas', level: 1 })).toBeVisible();
    expect(requestsTo(stub, 'DELETE', `/expenses/${NOTEBOOK.id}`)).toHaveLength(1);
});

// AC-0012-08: trocar para um cartão envia `creditCardId`; `409 STATEMENT_CLOSED` marca Fatura de.
test('moving to a card sends creditCardId and a closed statement marks Fatura de', async ({
    page,
}) => {
    const stub = await openDetail(page, INTERNET, {
        routes: [
            {
                method: 'PATCH',
                path: `/expenses/${INTERNET.id}/payment-method`,
                ...conflict('STATEMENT_CLOSED'),
            },
        ],
    });

    await page.getByRole('button', { name: 'Trocar forma de pagamento' }).click();
    await expect(page).toHaveURL(/meio=1/);
    const dialog = page.getByRole('dialog', { name: 'Trocar forma de pagamento' });
    await dialog.getByLabel('Pagar com').selectOption({ label: 'Nubank' });
    // AC-0012-15: a fatura vem recolhida; o erro só marca o campo quando ele foi enviado.
    await dialog.getByRole('button', { name: 'Lançar em outra fatura' }).click();
    await dialog.getByLabel('Fatura de').fill('2026-11-20');
    await dialog.getByRole('button', { name: 'Trocar' }).click();

    const posted = dialog.getByLabel('Fatura de');
    await expect(posted).toHaveAttribute('aria-invalid', 'true');
    await expect(dialog).toContainText('Essa fatura já está fechada');
    await expect(dialog).not.toContainText('raw');
    expect(requestsTo(stub, 'PATCH', `/expenses/${INTERNET.id}/payment-method`)[0]).toMatchObject({
        query: {},
        body: { creditCardId: CARD_ID, postedOn: '2026-11-20' },
    });
});

// AC-0012-09: `409 EXPENSE_STATUS_TRANSITION_NOT_ALLOWED` mostra o catálogo e recarrega o detalhe.
test('a status conflict shows the catalogue message and reloads the expense', async ({ page }) => {
    const stub = await openDetail(page, INTERNET, {
        search: '?pagar=1',
        routes: [
            {
                method: 'PATCH',
                path: `/expenses/${INTERNET.id}/status`,
                ...conflict('EXPENSE_STATUS_TRANSITION_NOT_ALLOWED'),
            },
        ],
    });

    const dialog = page.getByRole('dialog', { name: 'Pagar a despesa' });
    const detailLoads = () => requestsTo(stub, 'GET', `/expenses/${INTERNET.id}`).length;
    const before = detailLoads();
    await dialog.getByRole('button', { name: 'Pagar' }).click();

    await expect(dialog.getByRole('alert')).toHaveText(
        'Não é possível mudar a despesa para esse status. Atualize a página e confira o status atual.',
    );
    await expect.poll(detailLoads).toBeGreaterThan(before);
    await expect(dialog).toBeVisible();
});

// AC-0012-10 (detalhe): sem `entries.write`, nenhuma ação e nenhum diálogo pela URL.
test('a leitor sees no action and no dialog opens from the URL', async ({ page }) => {
    await openDetail(page, INTERNET, { user: 'leitor', search: '?pagar=1&excluir=1&meio=1' });

    await expect(page.getByRole('heading', { name: 'Internet', level: 1 })).toBeVisible();
    for (const name of ['Pagar', 'Marcar para verificar', 'Trocar forma de pagamento', 'Excluir']) {
        await expect(page.getByRole('button', { name })).toHaveCount(0);
    }
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
});
