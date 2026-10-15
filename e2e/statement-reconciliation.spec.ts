import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { stubApi, type ApiStub, type StubRoute } from './fixtures/api';
import { chooseUser, signInWithEmail, stubUsersMe, type E2EUser } from './fixtures/auth';
import {
    CARD,
    CURRENT,
    LIST_WITHOUT_WINDOW,
    NOTEBOOK,
    STATEMENTS_TODAY,
    statementsReadRoutes,
    UPCOMING,
} from './fixtures/data/statements';
import { stubRuntime } from './fixtures/runtime-config';

// Conferência da fatura (spec 0020): o Notebook já está marcado; a Feira, não.

const CARD_PATH = `/cartoes/${CARD.id}`;
const FEIRA = CURRENT.expenses![1]!;

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
    await page.route(
        (url) => url.pathname === '/api/statements',
        (route) => {
            const query = Object.fromEntries(new URL(route.request().url()).searchParams);
            return route.fulfill({ json: { data: query.from ? UPCOMING : LIST_WITHOUT_WINDOW } });
        },
    );
    await stubUsersMe(page, user);
    await page.goto(`/entrar?redirect=${encodeURIComponent(path)}`);
    await signInWithEmail(page);
    return stub;
}

/** A lista de despesas da fatura atual no formato do projeto. */
function expenses(page: Page, testInfo: TestInfo) {
    const section = page.getByRole('region', { name: 'Despesas' }).first();
    return testInfo.project.name === 'celular'
        ? section.getByRole('list', { name: 'Despesas da fatura', exact: true })
        : section.getByRole('table', { name: 'Despesas da fatura', exact: true });
}

// AC-0020-01, AC-0020-02, AC-0020-07.
test('the writer sees the amounts and marks an expense without leaving the statement', async ({
    page,
}, testInfo) => {
    const stub = await open(page, CARD_PATH, {
        routes: [
            {
                method: 'PATCH',
                path: `/expenses/${FEIRA.id}/reconciliation`,
                body: { data: {} },
            },
        ],
    });

    const values = page.getByLabel('Valores da fatura').first();
    await expect(values).toContainText('Conferido');
    await expect(values).toContainText('R$ 380,00');
    await expect(values.locator('[data-tone="atencao"]')).toHaveText('R$ 123,45');

    const list = expenses(page, testInfo);
    const mark = list.getByRole('button', { name: `Marcar como incluída: ${FEIRA.description}` });
    await expect(mark).toBeVisible();
    const box = await mark.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);

    await mark.click();

    await expect
        .poll(() =>
            stub.requests.filter((r) => r.method === 'PATCH').map((r) => [r.path, r.body] as const),
        )
        .toEqual([[`/expenses/${FEIRA.id}/reconciliation`, { reconciled: true }]]);
    await expect(page).toHaveURL(new RegExp(`${CARD_PATH}$`));
});

// AC-0020-05: o leitor não tem botão; a marcada mostra o selo.
test('the reader only sees the Incluída badge', async ({ page }, testInfo) => {
    await open(page, CARD_PATH, { user: 'leitor' });

    const list = expenses(page, testInfo);
    await expect(list.getByText(NOTEBOOK.description)).toBeVisible();
    await expect(list.getByRole('button', { name: /incluída/i })).toHaveCount(0);
    await expect(list.getByText('Incluída', { exact: true })).toHaveCount(1);
});

// AC-0020-06: o filtro deixa só o que falta conferir e fica na URL.
test('the filter keeps only what is left to check', async ({ page }, testInfo) => {
    await open(page, CARD_PATH);

    await page.getByRole('switch', { name: 'Só o que falta conferir' }).first().check();

    await expect(page).toHaveURL(/conferir=1/);
    const list = expenses(page, testInfo);
    await expect(list.getByText(FEIRA.description)).toBeVisible();
    await expect(list.getByText(NOTEBOOK.description)).toHaveCount(0);
});
