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

// Estornos de cartão (spec 0013, T-0013-03): AC-0013-08, e Editar e Excluir.

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
    await expect(dialog.getByLabel('Data do estorno')).toHaveValue('2026-10-20');
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
