import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

import { stubApi, type StubRoute } from './fixtures/api';
import { chooseUser, signInWithEmail, stubUsersMe, type E2EUser } from './fixtures/auth';
import {
    CARD,
    LIST_WITHOUT_WINDOW,
    NOTEBOOK,
    OCTOBER,
    SEPTEMBER,
    STATEMENTS_TODAY,
    statementsReadRoutes,
    UPCOMING,
} from './fixtures/data/statements';
import { stubRuntime } from './fixtures/runtime-config';

// Painel e detalhe de faturas, só leitura (spec 0013, T-0013-01).

const CARD_PATH = `/cartoes/${CARD.id}`;

/** As queries recebidas por `GET /statements`, na ordem. */
type ListQueries = Record<string, string>[];

/**
 * `GET /statements` responde pela query: com `from`, a janela das próximas; sem, a lista sem
 * janela. Registrado depois do `stubApi`, tem precedência sobre ele nessa rota.
 */
async function stubStatementLists(page: Page): Promise<ListQueries> {
    const queries: ListQueries = [];
    await page.route(
        (url) => url.pathname === '/api/statements',
        (route) => {
            const query = Object.fromEntries(new URL(route.request().url()).searchParams);
            queries.push(query);
            return route.fulfill({
                json: { data: query.from ? UPCOMING : LIST_WITHOUT_WINDOW },
            });
        },
    );
    return queries;
}

async function open(
    page: Page,
    path: string,
    { user = 'ativo', routes = [] }: { user?: E2EUser; routes?: StubRoute[] } = {},
): Promise<ListQueries> {
    await page.clock.setFixedTime(new Date(STATEMENTS_TODAY));
    await stubRuntime(page);
    await chooseUser(page, user);
    // As rotas do teste primeiro: o `stubApi` usa a primeira que casar.
    await stubApi(page, [...routes, ...statementsReadRoutes]);
    const queries = await stubStatementLists(page);
    await stubUsersMe(page, user);
    await page.goto(`/entrar?redirect=${encodeURIComponent(path)}`);
    await signInWithEmail(page);
    return queries;
}

/** Os itens de uma `EntryList` no formato do projeto: cartões no celular, linhas acima. */
function entries(page: Page, caption: string, testInfo: TestInfo): Locator {
    if (testInfo.project.name === 'celular') {
        return page.getByRole('list', { name: caption, exact: true }).getByRole('listitem');
    }
    return page.getByRole('table', { name: caption, exact: true }).locator('tbody tr');
}

/** O valor (`<dd>`) de um rótulo dos valores da fatura. */
function value(scope: Locator, label: string): Locator {
    return scope
        .locator('dt')
        .filter({ hasText: new RegExp(`^${label}$`) })
        .locator('xpath=following-sibling::dd[1]');
}

// AC-0013-01, AC-0013-10, INV-0013-01, INV-0013-03.
test('the card shows the current statement, the previous ones newest first and the upcoming ones without link', async ({
    page,
}, testInfo) => {
    const queries = await open(page, CARD_PATH);
    await expect(page.getByRole('heading', { name: CARD.name, level: 1 })).toBeVisible();

    // Fatura atual: período, datas, selo e os valores da resposta.
    const current = page.getByRole('region', { name: 'Fatura atual' });
    await expect(value(current, 'Período')).toHaveText('9 out. – 8 nov.');
    await expect(value(current, 'Fecha em')).toHaveText('8 de nov. de 2026');
    await expect(value(current, 'Vence em')).toHaveText('15 de nov. de 2026');
    await expect(current.getByText('Em aberto').first()).toBeVisible();
    await expect(value(current, 'Compras')).toHaveText('R$ 523,45');
    await expect(value(current, 'Estornos')).toHaveText('−R$ 20,00');
    await expect(value(current, 'Total da fatura')).toHaveText('R$ 503,45');
    await expect(value(current, 'Pago')).toHaveText('R$ 100,00');
    await expect(value(current, 'Restante')).toHaveText('R$ 403,45');
    await expect(value(current, 'Mínimo informado')).toHaveText('Não informado');
    await expect(current.getByText('Saldo anterior')).toHaveCount(0);

    const byType = current.getByRole('list', { name: 'Compras por tipo' }).getByRole('listitem');
    await expect(byType).toHaveCount(2);
    await expect(byType.nth(0)).toContainText('Eletrônicos');
    await expect(byType.nth(0)).toContainText('R$ 400,00');

    const expenses = entries(page, 'Despesas da fatura', testInfo);
    await expect(expenses).toHaveCount(2);
    await expect(expenses.nth(0)).toContainText('Notebook');
    await expect(expenses.nth(0)).toContainText('−R$ 400,00');
    await expect(entries(page, 'Estornos da fatura', testInfo)).toContainText(['Estorno da feira']);
    await expect(entries(page, 'Pagamentos da fatura', testInfo)).toContainText(['Conta corrente']);

    // Anteriores: sem a aberta, em ordem decrescente, com selo e link.
    const previous = entries(page, 'Faturas anteriores', testInfo);
    await expect(previous).toHaveCount(2);
    await expect(previous.nth(0)).toContainText('outubro de 2026');
    await expect(previous.nth(0)).toContainText('Vencida');
    await expect(previous.nth(0)).toContainText('R$ 350,00');
    await expect(previous.nth(0).getByRole('link')).toHaveAttribute(
        'href',
        `${CARD_PATH}/faturas/${OCTOBER.id}`,
    );
    await expect(previous.nth(1)).toContainText('setembro de 2026');
    await expect(previous.nth(1)).toContainText('Paga');
    await expect(previous.nth(1).getByRole('link')).toHaveAttribute(
        'href',
        `${CARD_PATH}/faturas/${SEPTEMBER.id}`,
    );

    // Próximas: a janela depois do fechamento atual, sem link.
    const upcoming = entries(page, 'Próximas faturas', testInfo);
    await expect(upcoming).toHaveCount(1);
    await expect(upcoming.nth(0)).toContainText('dezembro de 2026');
    await expect(upcoming.nth(0)).toContainText('R$ 400,00');
    await expect(
        page.getByRole('region', { name: 'Próximas faturas' }).getByRole('link'),
    ).toHaveCount(0);
    expect(queries).toContainEqual({ creditCardId: CARD.id });
    expect(queries).toContainEqual({ creditCardId: CARD.id, from: '2026-11-09', to: '2027-11-08' });
});

// AC-0013-02, AC-0013-10.
test('a previous statement opens its detail, and each expense leads to its own detail', async ({
    page,
}, testInfo) => {
    await open(page, CARD_PATH);
    await entries(page, 'Faturas anteriores', testInfo).nth(0).getByRole('link').first().click();

    await expect(page).toHaveURL(new RegExp(`${CARD_PATH}/faturas/${OCTOBER.id}$`));
    await expect(
        page.getByRole('heading', { name: 'Fatura de outubro de 2026', level: 1 }),
    ).toBeVisible();
    const main = page.getByRole('article');
    await expect(main.getByText('Vencida').first()).toBeVisible();
    await expect(value(main, 'Saldo anterior')).toHaveText('R$ 50,00');
    await expect(value(main, 'Total da fatura')).toHaveText('R$ 350,00');
    await expect(value(main, 'Mínimo informado')).toHaveText('R$ 70,00');
    const remaining = value(main, 'Restante').locator('[data-tone="negativo"]');
    await expect(remaining).toHaveText('R$ 350,00');
    await expect(remaining).toHaveClass(/text-negativo/);
    await expect(page.getByText('Nenhum estorno nesta fatura.')).toBeVisible();
    await expect(page.getByText('Nenhum pagamento nesta fatura.')).toBeVisible();

    const expenses = entries(page, 'Despesas da fatura', testInfo);
    await expect(expenses).toHaveCount(1);
    await expect(expenses.nth(0)).toContainText('Feira');
    await expect(expenses.nth(0)).toContainText('−R$ 300,00');
    await expenses.nth(0).getByRole('link').first().click();
    await expect(page).toHaveURL(/\/despesas\/60000000-0000-4000-8000-000000000102$/);

    await page.goBack();
    await page.getByRole('link', { name: CARD.name }).click();
    await expect(page).toHaveURL(new RegExp(`${CARD_PATH}$`));
});

test('the expense of the current statement leads to its detail', async ({ page }, testInfo) => {
    await open(page, CARD_PATH);
    await entries(page, 'Despesas da fatura', testInfo).nth(0).getByRole('link').first().click();
    await expect(page).toHaveURL(new RegExp(`/despesas/${NOTEBOOK.id}$`));
});

// ERR-0013-02 (ERR-0009-02).
test('an unknown statement shows not found with a link back to the card', async ({ page }) => {
    await open(page, `${CARD_PATH}/faturas/40000000-0000-4000-8000-00000000dead`);
    await expect(page.getByRole('heading', { name: 'Não encontramos este item.' })).toBeVisible();
    await page.getByRole('link', { name: 'Voltar para o cartão' }).click();
    await expect(page).toHaveURL(new RegExp(`${CARD_PATH}$`));
});

// ERR-0013-02: a fatura atual falha sozinha; as anteriores continuam.
test('a failing current statement shows the error block and keeps the other blocks', async ({
    page,
}, testInfo) => {
    await open(page, CARD_PATH, {
        routes: [
            {
                method: 'GET',
                path: '/statements/current',
                status: 404,
                body: { error: { code: 'CREDIT_CARD_NOT_FOUND', message: 'raw' } },
            },
        ],
    });
    const current = page.getByRole('region', { name: 'Fatura atual' });
    await expect(current.getByRole('alert')).toContainText('Não foi possível carregar.');
    await expect(current.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
    await expect(entries(page, 'Faturas anteriores', testInfo)).toHaveCount(2);
});

// AC-0013-09, AC-0013-10: o leitor vê o painel e o detalhe, sem nenhuma ação de escrita.
test('leitor sees the panel and the detail read only', async ({ page }, testInfo) => {
    await open(page, CARD_PATH, { user: 'leitor' });
    await expect(entries(page, 'Faturas anteriores', testInfo)).toHaveCount(2);
    await expect(entries(page, 'Despesas da fatura', testInfo)).toHaveCount(2);
    const actions = [
        'Pagar fatura',
        'Novo estorno',
        'Informar mínimo',
        'Editar',
        'Excluir',
        'Desfazer',
    ];
    for (const name of actions) {
        await expect(page.getByRole('button', { name })).toHaveCount(0);
        await expect(page.getByRole('link', { name })).toHaveCount(0);
    }

    await entries(page, 'Faturas anteriores', testInfo).nth(0).getByRole('link').first().click();
    await expect(
        page.getByRole('heading', { name: 'Fatura de outubro de 2026', level: 1 }),
    ).toBeVisible();
    await expect(entries(page, 'Despesas da fatura', testInfo)).toHaveCount(1);
    for (const name of actions) {
        await expect(page.getByRole('button', { name })).toHaveCount(0);
        await expect(page.getByRole('link', { name })).toHaveCount(0);
    }
});
