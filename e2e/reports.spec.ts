import { expect, test, type Locator, type Page } from '@playwright/test';

import type { components } from '../src/api/generated/schema';

import { stubApi, type StubRoute } from './fixtures/api';
import { chooseUser, signInWithEmail, stubUsersMe } from './fixtures/auth';
import { BANK_ACCOUNTS, CONTA_CORRENTE, POUPANCA } from './fixtures/data/accounts';
import { stubRuntime } from './fixtures/runtime-config';

// Relatórios (spec 0015, T-0015-02), com a API simulada no dia 15/10/2026.

type BalanceReport = components['schemas']['BalanceReport'];
type ByTypeReport = components['schemas']['ByTypeReport'];
type CashFlowReport = components['schemas']['CashFlowReport'];

const TODAY = '2026-10-15T12:00:00-03:00';

// Saldo: o padrão é de maio de 2026 (−5) a abril de 2027 (+6); até setembro, realizado.
const BALANCE_MONTHS = [
    '2026-05',
    '2026-06',
    '2026-07',
    '2026-08',
    '2026-09',
    '2026-10',
    '2026-11',
    '2026-12',
    '2027-01',
    '2027-02',
    '2027-03',
    '2027-04',
];

const BALANCE: BalanceReport = {
    from: '2026-05',
    to: '2027-04',
    points: BALANCE_MONTHS.map((month, index) => {
        const realized = month < '2026-10';
        const accountsTotalCents = 400000 + index * 12345;
        return {
            month,
            kind: realized ? 'REALIZED' : 'FORECAST',
            accounts: [{ bankAccountId: CONTA_CORRENTE.id, balanceCents: accountsTotalCents }],
            accountsTotalCents,
            cardDebtCents: realized ? null : 150000,
            unassignedCardDebtCents: realized ? null : 0,
            cardDueCents: realized ? null : 150000,
            consolidatedCents: realized ? accountsTotalCents : accountsTotalCents - 150000,
        };
    }),
};

const EXPENSES_BY_TYPE: ByTypeReport = {
    from: '2026-10',
    to: '2026-10',
    includeForecast: false,
    months: [
        {
            month: '2026-10',
            totalCents: 245000,
            refundsCents: 8990,
            byType: [
                {
                    typeId: '30000000-0000-4000-8000-000000000001',
                    name: 'Moradia',
                    totalCents: 180000,
                },
                {
                    typeId: '30000000-0000-4000-8000-000000000002',
                    name: 'Mercado',
                    totalCents: 65000,
                },
            ],
        },
    ],
};

const EARNINGS_BY_TYPE: ByTypeReport = {
    from: '2026-10',
    to: '2026-10',
    includeForecast: false,
    months: [
        {
            month: '2026-10',
            totalCents: 850000,
            byType: [
                {
                    typeId: '31000000-0000-4000-8000-000000000001',
                    name: 'Salário',
                    totalCents: 850000,
                },
            ],
        },
    ],
};

function cashFlowAccount(
    bankAccountId: string,
    values: Omit<CashFlowReport['months'][number]['accounts'][number], 'bankAccountId'>,
) {
    return { bankAccountId, ...values };
}

// Fluxo: o padrão é de maio a outubro de 2026; agosto fecha negativo.
const CASH_FLOW: CashFlowReport = {
    from: '2026-05',
    to: '2026-10',
    months: ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'].map((month) => {
        const negative = month === '2026-08';
        const accounts = [
            cashFlowAccount(CONTA_CORRENTE.id, {
                inflowsCents: 850000,
                expensesPaidCents: negative ? 900000 : 300000,
                statementPaymentsCents: 120000,
                transfersInCents: 0,
                transfersOutCents: 50000,
                netCents: negative ? -220000 : 380000,
            }),
            cashFlowAccount(POUPANCA.id, {
                inflowsCents: 0,
                expensesPaidCents: 0,
                statementPaymentsCents: 0,
                transfersInCents: 50000,
                transfersOutCents: 0,
                netCents: 50000,
            }),
        ];
        return { month, accounts, netCents: negative ? -170000 : 430000 };
    }),
};

const ROUTES: StubRoute[] = [
    { method: 'GET', path: '/bank-accounts', body: { data: BANK_ACCOUNTS } },
    { method: 'GET', path: '/reports/balance', body: { data: BALANCE } },
    { method: 'GET', path: '/reports/expenses-by-type', body: { data: EXPENSES_BY_TYPE } },
    { method: 'GET', path: '/reports/earnings-by-type', body: { data: EARNINGS_BY_TYPE } },
    { method: 'GET', path: '/reports/cash-flow', body: { data: CASH_FLOW } },
];

async function open(page: Page, path: string, heading = 'Relatórios') {
    await page.clock.setFixedTime(new Date(TODAY));
    await stubRuntime(page);
    const api = await stubApi(page, ROUTES);
    await chooseUser(page, 'leitor');
    await stubUsersMe(page, 'leitor');
    await page.goto(`/entrar?redirect=${encodeURIComponent(path)}`);
    await signInWithEmail(page);
    if (heading) await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
    return api;
}

/** A versão acessível do gráfico: cartões no celular, a tabela a partir do tablet. */
function entries(page: Page, projectName: string, name: string): Locator {
    return projectName === 'celular'
        ? page.getByRole('list', { name, exact: true })
        : page.getByRole('table', { name, exact: true });
}

/** O `title` de cada coluna do gráfico, na ordem. */
function columnTitles(page: Page): Promise<string[]> {
    return page.locator('[data-slot="month-columns"] rect title').allTextContents();
}

// AC-0015-06, INV-0015-03.
test('Saldo asks for the default period and shows realized and forecast columns with the same table values', async ({
    page,
}, testInfo) => {
    const api = await open(page, '/relatorios');

    await expect(page.getByRole('tab', { name: 'Saldo' })).toHaveAttribute('aria-selected', 'true');
    const table = entries(page, testInfo.project.name, 'Saldo por mês');
    await expect(table).toBeVisible();
    const call = api.requests.find((r) => r.path === '/reports/balance');
    expect(call?.query).toEqual({ from: '2026-05', to: '2027-04' });

    const chart = page.locator('[data-slot="month-columns"]');
    await expect(chart).toHaveAttribute('aria-hidden', 'true');
    await expect(chart.locator('rect[data-kind="realized"]')).toHaveCount(5);
    await expect(chart.locator('rect[data-kind="forecast"]')).toHaveCount(7);

    // Cada coluna tem o valor da tabela no mesmo mês.
    const titles = await columnTitles(page);
    expect(titles).toHaveLength(12);
    expect(titles[0]).toBe('maio de 2026: R$ 4.000,00');
    expect(titles[5]).toBe('outubro de 2026: R$ 4.617,25');
    await expect(table.getByText('R$ 4.000,00').first()).toBeVisible();
    await expect(table.getByText('R$ 4.617,25').first()).toBeVisible();

    // "Contas menos cartões": as colunas passam ao consolidado, que também está na tabela.
    await page.getByRole('button', { name: 'Contas menos cartões' }).click();
    const consolidated = await columnTitles(page);
    expect(consolidated[5]).toBe('outubro de 2026: R$ 3.117,25');
    await expect(table.getByText('R$ 3.117,25')).toBeVisible();

    if (testInfo.project.name === 'celular') {
        // Mais de seis meses: o gráfico rola na horizontal.
        const scrolls = await chart.evaluate((el) => el.scrollWidth > el.clientWidth);
        expect(scrolls).toBe(true);
    }
});

// AC-0015-07.
test('Por tipo switches expenses and earnings, sends includeForecast and shows the refunds apart', async ({
    page,
}, testInfo) => {
    const api = await open(page, '/relatorios?aba=por-tipo');

    const bars = page.getByRole('list', { name: 'Despesas por tipo', exact: true });
    await expect(bars).toBeVisible();
    await expect(bars.getByRole('listitem')).toHaveText(['MoradiaR$ 1.800,00', 'MercadoR$ 650,00']);
    const refunds = page.locator('[data-slot="refunds"]');
    await expect(refunds).toContainText('Estornos de cartão');
    await expect(refunds).toContainText('R$ 89,90');
    await expect(refunds).toContainText('não abatem os tipos');
    const table = entries(page, testInfo.project.name, 'Despesas por tipo por mês');
    await expect(table.getByText('R$ 2.450,00')).toBeVisible();
    await expect(table.getByText('R$ 89,90')).toBeVisible();
    expect(api.requests.find((r) => r.path === '/reports/expenses-by-type')?.query).toEqual({
        from: '2026-10',
        to: '2026-10',
    });

    await page.getByRole('checkbox', { name: 'Incluir previstos' }).check();
    await expect
        .poll(
            () => api.requests.filter((r) => r.path === '/reports/expenses-by-type').at(-1)?.query,
        )
        .toEqual({ from: '2026-10', to: '2026-10', includeForecast: 'true' });

    await page.getByRole('button', { name: 'Receitas', exact: true }).click();
    await expect(page.getByRole('list', { name: 'Receitas por tipo', exact: true })).toHaveText(
        'SalárioR$ 8.500,00',
    );
    expect(api.requests.find((r) => r.path === '/reports/earnings-by-type')?.query).toEqual({
        from: '2026-10',
        to: '2026-10',
        includeForecast: 'true',
    });
    await expect(page.locator('[data-slot="refunds"]')).toHaveCount(0);
});

// AC-0015-08, INV-0015-03.
test('Fluxo de caixa draws the negative net below the axis and the table columns', async ({
    page,
}, testInfo) => {
    const api = await open(page, '/relatorios?aba=fluxo');

    expect(api.requests.find((r) => r.path === '/reports/cash-flow')?.query).toEqual({
        from: '2026-05',
        to: '2026-10',
    });
    const chart = page.locator('[data-slot="month-columns"]');
    const negative = chart.locator('rect[data-sign="negative"]');
    await expect(negative).toHaveCount(1);
    await expect(negative).toHaveAttribute('data-month', '2026-08');
    const axisY = Number(await chart.locator('[data-slot="zero-axis"]').getAttribute('y1'));
    expect(Number(await negative.getAttribute('y'))).toBe(axisY);
    const positive = chart.locator('rect[data-month="2026-09"]');
    const top = Number(await positive.getAttribute('y'));
    expect(top + Number(await positive.getAttribute('height'))).toBeCloseTo(axisY);
    expect((await columnTitles(page))[3]).toBe('agosto de 2026: −R$ 1.700,00');

    const labels = [
        'Entradas',
        'Despesas pagas',
        'Faturas pagas',
        'Transferências que entram',
        'Transferências que saem',
    ];
    const august = 'agosto de 2026';
    if (testInfo.project.name === 'celular') {
        const card = page
            .getByRole('list', { name: 'Fluxo de caixa por mês' })
            .getByRole('listitem')
            .filter({ hasText: august })
            .first();
        for (const label of labels) await expect(card.getByText(label).first()).toBeVisible();
        await expect(card.getByText('−R$ 1.700,00')).toBeVisible();
        await card.getByRole('button', { name: `Por conta em ${august}` }).click();
        await expect(card.getByText('Poupança')).toBeVisible();
        await expect(card.getByText('−R$ 2.200,00')).toBeVisible();
    } else {
        const table = page.getByRole('table', { name: 'Fluxo de caixa por mês' });
        await expect(table.getByRole('columnheader')).toHaveText(['Mês', ...labels, 'Líquido']);
        const row = table.getByRole('row').filter({ hasText: august });
        await expect(row).toContainText('R$ 9.000,00');
        await expect(row.getByText('−R$ 1.700,00')).toBeVisible();
        const toggle = row.getByRole('button', { name: august });
        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await expect(table.locator(`tr[data-account="${POUPANCA.id}"]`)).toHaveCount(1);
        await expect(table.getByText('−R$ 2.200,00')).toBeVisible();
    }
});

// AC-0015-09, ERR-0015-02.
test('a period with de after ate never reaches the API', async ({ page }) => {
    const api = await open(page, '/relatorios?aba=fluxo&de=2026-12&ate=2026-10');

    // Da URL: descartado, vale o padrão da aba.
    await expect(page.getByLabel('De', { exact: true })).toHaveValue('2026-05');
    expect(api.requests.filter((r) => r.path === '/reports/cash-flow').map((r) => r.query)).toEqual(
        [{ from: '2026-05', to: '2026-10' }],
    );

    // Pelos seletores: o erro aparece e nada é pedido.
    await page.getByLabel('De', { exact: true }).fill('2027-01');
    await expect(page.getByText('O mês inicial não pode ser depois do mês final.')).toBeVisible();
    await expect(page.getByLabel('Até', { exact: true })).toHaveAttribute('aria-invalid', 'true');
    await page.getByLabel('De', { exact: true }).fill('2026-03');
    await expect(page).toHaveURL(/de=2026-03/);
    await expect
        .poll(() => api.requests.filter((r) => r.path === '/reports/cash-flow').length)
        .toBe(2);
    const queries = api.requests.filter((r) => r.path === '/reports/cash-flow').map((r) => r.query);
    expect(queries.at(-1)).toEqual({ from: '2026-03', to: '2026-10' });
    expect(queries.some((q) => q.from! > q.to!)).toBe(false);
});

// Spec 0015, navegação: **Relatórios** em Mais no celular e no tablet, na lateral no desktop.
test('Relatórios is reachable from the navigation by every profile', async ({ page }, testInfo) => {
    await open(page, '/', '');
    const nav = page.getByRole('navigation', { name: 'Principal' });
    await expect(nav.getByRole('link', { name: 'Início' })).toBeVisible();

    if (testInfo.project.name === 'desktop') {
        await nav.getByRole('link', { name: 'Relatórios' }).click();
    } else {
        await expect(nav.getByRole('link', { name: 'Relatórios' })).toHaveCount(0);
        await nav.getByRole('link', { name: 'Mais' }).click();
        await page
            .getByRole('navigation', { name: 'Mais' })
            .getByRole('link', { name: 'Relatórios' })
            .click();
    }
    await expect(page.getByRole('heading', { name: 'Relatórios', level: 1 })).toBeVisible();
    await expect(page).toHaveURL(/\/relatorios$/);
});
