import { expect, test, type Page } from '@playwright/test';

import { stubApi, type ApiStub, type StubRoute } from './fixtures/api';
import { chooseUser, signInWithEmail, stubUsersMe, type E2EUser } from './fixtures/auth';
import { CONTA_CORRENTE } from './fixtures/data/accounts';
import {
    CARD,
    CURRENT,
    LIST_WITHOUT_WINDOW,
    OCTOBER,
    OCTOBER_DETAIL,
    STATEMENTS_TODAY,
    statementsReadRoutes,
    UPCOMING,
} from './fixtures/data/statements';
import { stubRuntime } from './fixtures/runtime-config';
import type { components } from '../src/api/generated/schema';

// Pagamentos e mínimo das faturas (spec 0013, T-0013-02).

type Statement = components['schemas']['StatementResponse'];
type StatementPayment = components['schemas']['StatementPaymentResponse'];

const CARD_PATH = `/cartoes/${CARD.id}`;
const OCTOBER_PATH = `${CARD_PATH}/faturas/${OCTOBER.id}`;

/**
 * Outubro com dois pagamentos (R$ 80,00) e mínimo de R$ 100,00: só o último (o de 18/10) pode ser
 * desfeito (INV-0013-02), e o **Mínimo** do pagamento é R$ 20,00 (AC-0013-04).
 */
const FIRST_PAYMENT: StatementPayment = {
    id: '80000000-0000-4000-8000-000000000201',
    bankAccountId: CONTA_CORRENTE.id,
    amountCents: 5000,
    paidOn: '2026-10-16',
    createdAt: '2026-10-16T12:00:00Z',
};
const LAST_PAYMENT: StatementPayment = {
    id: '80000000-0000-4000-8000-000000000202',
    bankAccountId: CONTA_CORRENTE.id,
    amountCents: 3000,
    paidOn: '2026-10-18',
    createdAt: '2026-10-18T12:00:00Z',
};
const OCTOBER_WITH_PAYMENTS: Statement = {
    ...OCTOBER_DETAIL,
    paidCents: 8000,
    remainingCents: 27000,
    minimumPaymentCents: 10000,
    payments: [FIRST_PAYMENT, LAST_PAYMENT],
};

const conflict = (code: string): StubRoute['body'] => ({ error: { code, message: 'raw message' } });

/** `GET /statements` responde pela query: com `from`, as próximas; sem, a lista sem janela. */
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

function sent(stub: ApiStub, method: string, path: string) {
    return stub.requests.filter((request) => request.method === method && request.path === path);
}

// AC-0013-03: fechada, com Total restante e a conta pagadora padrão.
test('paying a closed statement sends the remaining with the default paying account', async ({
    page,
}) => {
    const stub = await open(page, OCTOBER_PATH, {
        routes: [
            {
                method: 'POST',
                path: `/statements/${OCTOBER.id}/payments`,
                status: 201,
                body: { data: OCTOBER_DETAIL },
            },
        ],
    });
    await page.getByRole('button', { name: 'Pagar fatura' }).click();
    const dialog = page.getByRole('dialog', { name: 'Pagar fatura' });
    await expect(dialog.getByRole('radio', { name: 'Total restante · R$ 350,00' })).toBeChecked();
    await expect(dialog.getByLabel('Conta')).toHaveValue(CONTA_CORRENTE.id);
    await dialog.getByRole('button', { name: 'Pagar', exact: true }).click();

    await expect(page.getByText('Pagamento registrado.')).toBeVisible();
    await expect(dialog).toBeHidden();
    expect(sent(stub, 'POST', `/statements/${OCTOBER.id}/payments`).map((r) => r.body)).toEqual([
        { amountCents: 35000, bankAccountId: CONTA_CORRENTE.id, paidOn: '2026-10-20' },
    ]);
});

// AC-0013-03, AC-0013-04: a aberta paga por `current` com `creditCardId`; sem mínimo, sem a opção.
test('paying the open statement goes through /statements/current/payments', async ({ page }) => {
    const stub = await open(page, `${CARD_PATH}?pagar=1`, {
        routes: [
            {
                method: 'POST',
                path: '/statements/current/payments',
                status: 201,
                body: { data: CURRENT },
            },
        ],
    });
    const dialog = page.getByRole('dialog', { name: 'Pagar fatura' });
    await expect(dialog.getByRole('radio', { name: 'Total restante · R$ 403,45' })).toBeChecked();
    await expect(dialog.getByRole('radio', { name: /Mínimo/ })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Pagar', exact: true }).click();

    await expect(page.getByText('Pagamento registrado.')).toBeVisible();
    await expect(page).not.toHaveURL(/pagar=1/);
    expect(sent(stub, 'POST', '/statements/current/payments').map((r) => r.body)).toEqual([
        {
            creditCardId: CARD.id,
            amountCents: 40345,
            bankAccountId: CONTA_CORRENTE.id,
            paidOn: '2026-10-20',
        },
    ]);
});

// AC-0013-04: com mínimo informado, a opção envia `minimumPaymentCents − paidCents`.
test('Mínimo pays the informed minimum minus what was already paid', async ({ page }) => {
    const stub = await open(page, `${OCTOBER_PATH}?pagar=1`, {
        routes: [
            {
                method: 'GET',
                path: `/statements/${OCTOBER.id}`,
                body: { data: OCTOBER_WITH_PAYMENTS },
            },
            {
                method: 'POST',
                path: `/statements/${OCTOBER.id}/payments`,
                status: 201,
                body: { data: OCTOBER_WITH_PAYMENTS },
            },
        ],
    });
    const dialog = page.getByRole('dialog', { name: 'Pagar fatura' });
    await dialog.getByRole('radio', { name: 'Mínimo · R$ 20,00' }).check();
    await dialog.getByRole('button', { name: 'Pagar', exact: true }).click();

    await expect(page.getByText('Pagamento registrado.')).toBeVisible();
    expect(sent(stub, 'POST', `/statements/${OCTOBER.id}/payments`)[0]?.body).toMatchObject({
        amountCents: 2000,
    });
});

// AC-0013-05, INV-0013-04: o link para a fechada pendente vem da lista, nunca da mensagem.
test('STATEMENT_PREVIOUS_UNPAID shows the alert with a link to the pending closed statement', async ({
    page,
}) => {
    await open(page, CARD_PATH, {
        routes: [
            {
                method: 'POST',
                path: '/statements/current/payments',
                status: 409,
                body: conflict('STATEMENT_PREVIOUS_UNPAID'),
            },
        ],
    });
    await page.getByRole('button', { name: 'Pagar fatura' }).click();
    const dialog = page.getByRole('dialog', { name: 'Pagar fatura' });
    await dialog.getByRole('button', { name: 'Pagar', exact: true }).click();

    const alert = dialog.getByRole('alert');
    await expect(alert).toContainText(
        'Há uma fatura anterior fechada sem pagar. Pague essa fatura antes.',
    );
    await expect(page.getByText('raw message')).toHaveCount(0);
    await alert.getByRole('link', { name: 'Ver a fatura de outubro de 2026' }).click();
    await expect(page).toHaveURL(new RegExp(`${OCTOBER_PATH}$`));
    await expect(
        page.getByRole('heading', { name: 'Fatura de outubro de 2026', level: 1 }),
    ).toBeVisible();
});

// AC-0013-05: o valor é marcado, sem alerta, e o diálogo continua aberto.
test('STATEMENT_PAYMENT_EXCEEDS_REMAINING marks the amount', async ({ page }) => {
    await open(page, `${OCTOBER_PATH}?pagar=1`, {
        routes: [
            {
                method: 'POST',
                path: `/statements/${OCTOBER.id}/payments`,
                status: 409,
                body: conflict('STATEMENT_PAYMENT_EXCEEDS_REMAINING'),
            },
        ],
    });
    const dialog = page.getByRole('dialog', { name: 'Pagar fatura' });
    await dialog.getByRole('radio', { name: 'Outro valor' }).check();
    await dialog.getByRole('textbox', { name: 'Outro valor' }).fill('300,00');
    await dialog.getByRole('button', { name: 'Pagar', exact: true }).click();

    await expect(dialog.getByRole('group', { name: 'Valor' })).toContainText(
        'O valor do pagamento passa do que falta pagar na fatura. Informe um valor menor.',
    );
    await expect(dialog.getByRole('alert')).toHaveCount(0);
    await expect(dialog.getByRole('textbox', { name: 'Outro valor' })).toHaveValue('300,00');
});

// AC-0013-06, INV-0013-02: só o último pagamento da fechada tem Desfazer, pela rota da fechada.
test('only the last payment of a closed statement can be undone', async ({ page }) => {
    const stub = await open(page, OCTOBER_PATH, {
        routes: [
            {
                method: 'GET',
                path: `/statements/${OCTOBER.id}`,
                body: { data: OCTOBER_WITH_PAYMENTS },
            },
            { method: 'DELETE', path: `/statements/${OCTOBER.id}/payments/${LAST_PAYMENT.id}` },
        ],
    });
    const undo = page.getByRole('button', { name: /^Desfazer pagamento de/ });
    await expect(undo).toHaveCount(1);
    await expect(undo).toHaveAccessibleName('Desfazer pagamento de 18 out.');
    await undo.click();
    const dialog = page.getByRole('alertdialog', { name: 'Desfazer pagamento?' });
    await expect(dialog).toContainText(
        'O valor volta para a conta e a fatura fica com o restante de novo.',
    );
    await dialog.getByRole('button', { name: 'Desfazer pagamento' }).click();

    await expect(page.getByText('Pagamento desfeito.')).toBeVisible();
    expect(
        sent(stub, 'DELETE', `/statements/${OCTOBER.id}/payments/${LAST_PAYMENT.id}`),
    ).toHaveLength(1);
});

// AC-0013-06: na aberta, a rota de `current` com `creditCardId` na query.
test('undoing an early payment of the open statement uses the current route', async ({ page }) => {
    const payment = CURRENT.payments![0]!;
    const stub = await open(page, CARD_PATH, {
        routes: [{ method: 'DELETE', path: `/statements/current/payments/${payment.id}` }],
    });
    await page.getByRole('button', { name: /^Desfazer pagamento de/ }).click();
    await page
        .getByRole('alertdialog', { name: 'Desfazer pagamento?' })
        .getByRole('button', { name: 'Desfazer pagamento' })
        .click();

    await expect(page.getByText('Pagamento desfeito.')).toBeVisible();
    expect(
        sent(stub, 'DELETE', `/statements/current/payments/${payment.id}`).map((r) => r.query),
    ).toEqual([{ creditCardId: CARD.id }]);
});

// AC-0013-07.
test('Informar mínimo sends PATCH /statements/{id} with the value in cents', async ({ page }) => {
    const stub = await open(page, OCTOBER_PATH, {
        routes: [
            {
                method: 'PATCH',
                path: `/statements/${OCTOBER.id}`,
                body: { data: { ...OCTOBER_DETAIL, minimumPaymentCents: 123456 } },
            },
        ],
    });
    await page.getByRole('button', { name: 'Informar mínimo' }).click();
    const dialog = page.getByRole('dialog', { name: 'Informar mínimo' });
    await expect(dialog).toContainText(
        'O valor mínimo que o banco cobra. O sistema não calcula o mínimo; ele só decide quando a fatura fica vencida.',
    );
    const input = dialog.getByRole('textbox', { name: 'Mínimo' });
    await expect(input).toHaveValue('70,00');
    await input.fill('1.234,56');
    await dialog.getByRole('button', { name: 'Salvar' }).click();

    await expect(page.getByText('Mínimo informado.')).toBeVisible();
    expect(sent(stub, 'PATCH', `/statements/${OCTOBER.id}`).map((r) => r.body)).toEqual([
        { minimumPaymentCents: 123456 },
    ]);
});

// AC-0013-09: com leitor, nenhuma ação de escrita, nem pela URL.
test('leitor gets no payment action on the panel, not even from the URL', async ({ page }) => {
    await open(page, `${CARD_PATH}?pagar=1`, { user: 'leitor' });
    await expect(page.getByRole('region', { name: 'Fatura atual' })).toContainText('R$ 403,45');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Pagar fatura|Desfazer/ })).toHaveCount(0);
});

test('leitor gets no payment action on the detail, not even from the URL', async ({ page }) => {
    await open(page, `${OCTOBER_PATH}?pagar=1&minimo=1`, {
        user: 'leitor',
        routes: [
            {
                method: 'GET',
                path: `/statements/${OCTOBER.id}`,
                body: { data: OCTOBER_WITH_PAYMENTS },
            },
        ],
    });
    await expect(
        page.getByRole('heading', { name: 'Fatura de outubro de 2026', level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole('region', { name: 'Pagamentos' })).toContainText('Conta corrente');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(
        page.getByRole('button', { name: /Pagar fatura|Informar mínimo|Desfazer/ }),
    ).toHaveCount(0);
});
