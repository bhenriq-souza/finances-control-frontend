import { expect, test, type Page } from '@playwright/test';

import { stubApi, type ApiStub, type StubRoute } from './fixtures/api';
import { chooseUser, signInWithEmail, stubUsersMe, type E2EUser } from './fixtures/auth';
import {
    CARD,
    CURRENT,
    LIST_WITHOUT_WINDOW,
    NOTEBOOK,
    OCTOBER,
    STATEMENTS_TODAY,
    statementsReadRoutes,
    UPCOMING,
} from './fixtures/data/statements';
import { stubRuntime } from './fixtures/runtime-config';
import type { components } from '../src/api/generated/schema';

// Estornos de cartão (spec 0013, T-0013-03): AC-0013-08, e Editar e Excluir; e **Estornar** no
// detalhe da despesa de cartão (AC-0012-13, AC-0013-11).

const CARD_PATH = `/cartoes/${CARD.id}`;
const REFUND = CURRENT.refunds![0]!;

/** `GET /statements` responde pela query: com `from`, a janela das próximas; sem, a lista. */
async function stubStatementLists(page: Page): Promise<void> {
    await page.route(
        (url) => url.pathname === '/api/statements',
        (route) => {
            const query = Object.fromEntries(new URL(route.request().url()).searchParams);
            return route.fulfill({ json: { data: query.from ? UPCOMING : LIST_WITHOUT_WINDOW } });
        },
    );
}

async function open(
    page: Page,
    path: string,
    { user = 'ativo', routes = [] }: { user?: E2EUser; routes?: StubRoute[] } = {},
): Promise<ApiStub> {
    await page.clock.setFixedTime(new Date(STATEMENTS_TODAY));
    await stubRuntime(page);
    await chooseUser(page, user);
    // As rotas do teste primeiro: o `stubApi` usa a primeira que casar.
    const stub = await stubApi(page, [...routes, ...statementsReadRoutes]);
    await stubStatementLists(page);
    await stubUsersMe(page, user);
    await page.goto(`/entrar?redirect=${encodeURIComponent(path)}`);
    await signInWithEmail(page);
    return stub;
}

function writes(stub: ApiStub, method: string) {
    return stub.requests.filter((request) => request.method === method);
}

// AC-0013-08: `?estorno=1&despesa=<id>` vem com a despesa selecionada e envia `expenseId`.
test('a new refund from ?estorno=1&despesa comes with the expense selected and sends expenseId', async ({
    page,
}) => {
    const stub = await open(page, `${CARD_PATH}?estorno=1&despesa=${NOTEBOOK.id}`, {
        routes: [
            {
                method: 'POST',
                path: '/credit-card-refunds',
                status: 201,
                body: { data: { ...REFUND, id: '70000000-0000-4000-8000-000000000199' } },
            },
        ],
    });

    const dialog = page.getByRole('dialog', { name: 'Novo estorno' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Despesa de origem')).toHaveValue(NOTEBOOK.id);
    await expect(dialog.getByLabel('Data do estorno')).toHaveValue('20/10/2026');
    await expect(dialog.getByText('Deixe vazio para a fatura do dia.')).toBeVisible();

    await dialog.getByLabel('Descrição').fill('Devolução do notebook');
    await dialog.getByLabel('Valor').fill('150,00');
    await dialog.getByRole('button', { name: 'Salvar' }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText('Estorno registrado.')).toBeVisible();
    await expect(page).toHaveURL(CARD_PATH);
    expect(writes(stub, 'POST')).toEqual([
        expect.objectContaining({
            path: '/credit-card-refunds',
            body: {
                creditCardId: CARD.id,
                description: 'Devolução do notebook',
                amountCents: 15000,
                occurredOn: '2026-10-20',
                expenseId: NOTEBOOK.id,
            },
        }),
    ]);
});

// AC-0013-08: `409 REFUND_EXCEEDS_EXPENSE` marca o valor, com o diálogo aberto.
test('REFUND_EXCEEDS_EXPENSE marks the amount and keeps the dialog open', async ({ page }) => {
    await open(page, CARD_PATH, {
        routes: [
            {
                method: 'POST',
                path: '/credit-card-refunds',
                status: 409,
                body: { error: { code: 'REFUND_EXCEEDS_EXPENSE', message: 'raw' } },
            },
        ],
    });

    await page.getByRole('button', { name: 'Novo estorno' }).click();
    const dialog = page.getByRole('dialog', { name: 'Novo estorno' });
    await dialog.getByLabel('Descrição').fill('Devolução');
    await dialog.getByLabel('Valor').fill('999,00');
    await dialog.getByLabel('Despesa de origem').selectOption(NOTEBOOK.id);
    await dialog.getByRole('button', { name: 'Salvar' }).click();

    await expect(dialog.getByLabel('Valor')).toHaveAttribute('aria-invalid', 'true');
    await expect(
        dialog.getByText('O valor do estorno passa do que ainda pode ser estornado nessa despesa.'),
    ).toBeVisible();
    await expect(page.getByText('raw', { exact: true })).toHaveCount(0);
});

test('edits the description and notes of a refund', async ({ page }) => {
    const stub = await open(page, CARD_PATH, {
        routes: [
            {
                method: 'PATCH',
                path: `/credit-card-refunds/${REFUND.id}`,
                body: { data: { ...REFUND, description: 'Estorno da feira (parcial)' } },
            },
        ],
    });

    await page.getByRole('button', { name: `Editar ${REFUND.description}` }).click();
    const dialog = page.getByRole('dialog', { name: 'Editar estorno' });
    await expect(dialog.getByLabel('Valor')).toHaveCount(0);
    await dialog.getByLabel('Descrição').fill('Estorno da feira (parcial)');
    await dialog.getByLabel('Observações').fill('Crédito em 2 dias');
    await dialog.getByRole('button', { name: 'Salvar' }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText('Estorno salvo.')).toBeVisible();
    expect(writes(stub, 'PATCH')).toEqual([
        expect.objectContaining({
            body: { description: 'Estorno da feira (parcial)', notes: 'Crédito em 2 dias' },
        }),
    ]);
});

test('deletes a refund after confirming, with STATEMENT_CLOSED in the dialog alert', async ({
    page,
}) => {
    let calls = 0;
    const stub = await open(page, CARD_PATH);
    // Primeiro `STATEMENT_CLOSED`, depois o sucesso.
    await page.route(
        (url) => url.pathname === `/api/credit-card-refunds/${REFUND.id}`,
        (route) => {
            calls += 1;
            return calls === 1
                ? route.fulfill({
                      status: 409,
                      json: { error: { code: 'STATEMENT_CLOSED', message: 'raw' } },
                  })
                : route.fulfill({ status: 204 });
        },
    );

    await page.getByRole('button', { name: `Excluir ${REFUND.description}` }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Excluir estorno?' });
    await dialog.getByRole('button', { name: 'Excluir' }).click();
    await expect(dialog.getByRole('alert')).toBeVisible();
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: 'Excluir' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('Estorno excluído.')).toBeVisible();
    expect(calls).toBe(2);
    expect(writes(stub, 'POST')).toHaveLength(0);
});

test('the statement detail offers Novo estorno through ?estorno=1', async ({ page }) => {
    await open(page, `${CARD_PATH}/faturas/${OCTOBER.id}`);
    await page.getByRole('button', { name: 'Novo estorno' }).click();
    await expect(page).toHaveURL(/estorno=1/);
    const dialog = page.getByRole('dialog', { name: 'Novo estorno' });
    await expect(dialog.getByLabel('Despesa de origem')).toHaveValue('');
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).toBeHidden();
    await expect(page).not.toHaveURL(/estorno=/);
});

test('leitor gets no refund dialog from ?estorno=1', async ({ page }) => {
    await open(page, `${CARD_PATH}?estorno=1&despesa=${NOTEBOOK.id}`, { user: 'leitor' });
    await expect(page.getByRole('heading', { name: 'Fatura atual' })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Novo estorno' })).toHaveCount(0);
});

type Expense = components['schemas']['ExpenseResponse'];

/** `GET /expenses/{id}` do Notebook, que está na fatura atual do cartão. */
const NOTEBOOK_EXPENSE: Expense = {
    id: NOTEBOOK.id,
    description: NOTEBOOK.description,
    kind: 'INSTALLMENT',
    status: 'OPEN',
    amountCents: NOTEBOOK.amountCents,
    occurredOn: NOTEBOOK.occurredOn,
    paidOn: null,
    notes: null,
    expenseType: { ...NOTEBOOK.expenseType, archivedAt: null, createdAt: '2026-01-10T12:00:00Z' },
    bankAccountId: null,
    creditCardId: CARD.id,
    postedOn: NOTEBOOK.postedOn,
    installment: NOTEBOOK.installment,
    recurrenceId: null,
    createdAt: '2026-08-10T12:00:00Z',
    updatedAt: '2026-10-10T12:00:00Z',
};

/** Uma despesa paga de agosto: numa fatura mais antiga que a última fechada (outubro). */
const GELADEIRA: Expense = {
    ...NOTEBOOK_EXPENSE,
    id: '60000000-0000-4000-8000-000000000199',
    description: 'Geladeira',
    kind: 'VARIABLE',
    status: 'PAID',
    amountCents: 320000,
    occurredOn: '2026-08-20',
    paidOn: '2026-09-15',
    postedOn: '2026-08-20',
    installment: null,
};

/** Abre o detalhe da despesa e segue o **Estornar** até o **Novo estorno** do cartão. */
async function refundFromDetail(page: Page, expense: Expense): Promise<void> {
    await open(page, `/despesas/${expense.id}`, {
        routes: [{ method: 'GET', path: `/expenses/${expense.id}`, body: { data: expense } }],
    });
    await expect(page.getByRole('heading', { name: expense.description })).toBeVisible();
    // AC-0012-18: no celular, **Estornar** fica em **Mais ações**.
    if (test.info().project.name === 'celular') {
        await page.getByRole('button', { name: 'Mais ações' }).click();
        await page.getByRole('menuitem', { name: 'Estornar' }).click();
    } else {
        await page.getByRole('link', { name: 'Estornar' }).click();
    }
    await expect(page).toHaveURL(`${CARD_PATH}?estorno=1&despesa=${expense.id}`);
}

// AC-0012-13, AC-0013-08: **Estornar** no detalhe abre o **Novo estorno** com a despesa selecionada.
test('Estornar on a card expense opens Novo estorno with the expense selected', async ({
    page,
}) => {
    await refundFromDetail(page, NOTEBOOK_EXPENSE);
    const dialog = page.getByRole('dialog', { name: 'Novo estorno' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Despesa de origem')).toHaveValue(NOTEBOOK.id);
});

// AC-0013-11: a despesa de uma fatura mais antiga que a última fechada vem num grupo próprio.
test('Estornar on an expense of an older statement selects it and sends expenseId', async ({
    page,
}) => {
    await refundFromDetail(page, GELADEIRA);
    const dialog = page.getByRole('dialog', { name: 'Novo estorno' });
    const origin = dialog.getByLabel('Despesa de origem');
    await expect(origin).toHaveValue(GELADEIRA.id);
    await expect(origin.locator('optgroup[label="Outra fatura"] option')).toHaveText(
        'Geladeira · 20 ago. · R$ 3.200,00',
    );

    await page.route(
        (url) => url.pathname === '/api/credit-card-refunds',
        (route) =>
            route.fulfill({
                status: 201,
                json: { data: { ...REFUND, id: '70000000-0000-4000-8000-000000000198' } },
            }),
    );
    const request = page.waitForRequest(
        (req) =>
            req.method() === 'POST' && new URL(req.url()).pathname === '/api/credit-card-refunds',
    );
    await dialog.getByLabel('Descrição').fill('Devolução da geladeira');
    await dialog.getByLabel('Valor').fill('100,00');
    await dialog.getByRole('button', { name: 'Salvar' }).click();
    expect((await request).postDataJSON()).toEqual({
        creditCardId: CARD.id,
        description: 'Devolução da geladeira',
        amountCents: 10000,
        occurredOn: '2026-10-20',
        expenseId: GELADEIRA.id,
    });
    await expect(dialog).toBeHidden();
});

// AC-0012-13: despesa de cartão prevista não tem **Estornar**; `leitor` também não o vê.
test('no Estornar on a forecast card expense', async ({ page }) => {
    const forecast: Expense = { ...NOTEBOOK_EXPENSE, status: 'FORECAST' };
    await open(page, `/despesas/${forecast.id}`, {
        routes: [{ method: 'GET', path: `/expenses/${forecast.id}`, body: { data: forecast } }],
    });
    await expect(page.getByRole('button', { name: 'Confirmar' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Estornar' })).toHaveCount(0);
});

test('leitor sees no Estornar on a card expense', async ({ page }) => {
    await open(page, `/despesas/${NOTEBOOK_EXPENSE.id}`, {
        user: 'leitor',
        routes: [
            {
                method: 'GET',
                path: `/expenses/${NOTEBOOK_EXPENSE.id}`,
                body: { data: NOTEBOOK_EXPENSE },
            },
        ],
    });
    await expect(page.getByRole('heading', { name: NOTEBOOK.description })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Estornar' })).toHaveCount(0);
});
