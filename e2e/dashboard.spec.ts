import { expect, test, type Page } from '@playwright/test';

import { chooseUser, signInWithEmail, stubUsersMe, type E2EUser } from './fixtures/auth';
import { CARTAO_ANTIGO, ITAU_VISA, NUBANK_ROXINHO } from './fixtures/data/accounts';
import {
    DASHBOARD_TEXT,
    DASHBOARD_TODAY,
    FARMACIA,
    ROXINHO_CLOSED,
    stubDashboard,
    type DashboardStubOptions,
} from './fixtures/data/reports';
import { stubRuntime } from './fixtures/runtime-config';

// Dashboard de saldo em `/` (spec 0015, T-0015-01), com "hoje" em 15/10/2026.

async function open(page: Page, user: E2EUser = 'ativo', options: DashboardStubOptions = {}) {
    await page.clock.setFixedTime(new Date(DASHBOARD_TODAY));
    await stubRuntime(page);
    await chooseUser(page, user);
    const requests = await stubDashboard(page, options);
    await stubUsersMe(page, user);
    await page.goto('/entrar');
    await signInWithEmail(page);
    await expect(page.getByRole('heading', { name: 'Início', level: 1 })).toBeVisible();
    return requests;
}

const region = (page: Page, name: string) => page.getByRole('region', { name, exact: true });

// AC-0015-01, AC-0015-10, INV-0015-02.
test('shows the realized balance, the forecast with its variation and the month totals', async ({
    page,
}) => {
    const requests = await open(page);

    // A tela provisória saiu (AC-0015-10).
    await expect(page.getByRole('heading', { name: /Olá/ })).toHaveCount(0);

    const saldo = region(page, 'Saldo realizado · outubro de 2026');
    await expect(saldo.getByText(DASHBOARD_TEXT.realized, { exact: true })).toBeVisible();
    await expect(saldo.getByText('Previsto para 31 out.')).toBeVisible();
    await expect(saldo.getByText(DASHBOARD_TEXT.forecast, { exact: true })).toBeVisible();
    await expect(saldo.getByText(DASHBOARD_TEXT.variation, { exact: true })).toBeVisible();

    const receitas = region(page, 'Receitas do mês');
    await expect(receitas.getByText(DASHBOARD_TEXT.earnings, { exact: true })).toBeVisible();
    await expect(receitas.getByText(DASHBOARD_TEXT.earningsCounts)).toBeVisible();

    const despesas = region(page, 'Despesas do mês');
    await expect(despesas.getByText(DASHBOARD_TEXT.expenses, { exact: true })).toBeVisible();
    await expect(despesas.getByText(DASHBOARD_TEXT.expensesCounts)).toBeVisible();

    const queries = (path: string) =>
        requests.filter((request) => request.path === path).map((request) => request.query);
    expect(queries('/reports/balance')).toContainEqual({ from: '2026-10', to: '2026-10' });
    expect(queries('/earnings')).toContainEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(queries('/expenses')).toEqual(
        expect.arrayContaining([
            { from: '2026-10-01', to: '2026-10-31' },
            { status: 'OVERDUE' },
            { from: '2026-10-15', to: '2026-10-21' },
        ]),
    );
    // Uma consulta de faturas por cartão ativo; o arquivado fica de fora.
    const cards = queries('/statements').map((query) => query.creditCardId);
    expect(cards).toEqual(expect.arrayContaining([NUBANK_ROXINHO.id, ITAU_VISA.id]));
    expect(cards).not.toContain(CARTAO_ANTIGO.id);
});

// AC-0015-02, AC-0015-04.
test('lists what is due this week and lays the sections out as the artboards', async ({
    page,
}, testInfo) => {
    await open(page);
    const due = region(page, 'Vence esta semana');
    const contas = region(page, 'Contas e cartões');
    const byType = region(page, 'Despesas por tipo · outubro de 2026');

    if (testInfo.project.name === 'celular') {
        // Cartões, no máximo cinco, e Ver todas para as vencidas.
        const items = due.getByRole('list', { name: 'Vence esta semana' }).getByRole('listitem');
        await expect(items).toHaveCount(5);
        for (const [index, description] of DASHBOARD_TEXT.due.slice(0, 5).entries()) {
            await expect(items.nth(index)).toContainText(description);
        }
        await expect(due.getByRole('table')).toBeHidden();
        await expect(due.getByRole('link', { name: 'Ver todas' })).toHaveAttribute(
            'href',
            '/despesas?status=OVERDUE',
        );
    } else {
        const rows = due.getByRole('table', { name: 'Vence esta semana' }).locator('tbody tr');
        await expect(rows).toHaveCount(DASHBOARD_TEXT.due.length);
        for (const [index, description] of DASHBOARD_TEXT.due.entries()) {
            await expect(rows.nth(index).locator('td').nth(1)).toHaveText(description);
        }
        await expect(rows.nth(1)).toContainText('Vencida');
        await expect(rows.nth(3)).toContainText('Vence hoje');
        await expect(rows.nth(4)).toContainText('Vence hoje');
        await expect(due.getByRole('link', { name: 'Ver todas' })).toBeHidden();
    }
    // Despesa de cartão, prevista, paga ou depois de 21/10 não entra.
    for (const outside of ['Mercado no cartão', 'Conta de luz', 'Aluguel', 'Escola']) {
        await expect(due.getByText(outside, { exact: true })).toHaveCount(0);
    }

    // Contas e cartões: os ativos; selo da fatura no tablet e no desktop.
    const accounts = contas.getByRole('list', { name: 'Contas' }).getByRole('listitem');
    await expect(accounts).toHaveCount(2);
    await expect(contas.getByText('Investimento antigo')).toHaveCount(0);
    const cards = contas.getByRole('list', { name: 'Cartões' }).getByRole('listitem');
    await expect(cards).toHaveCount(2);
    const roxinho = cards.filter({ hasText: NUBANK_ROXINHO.name });
    const visa = cards.filter({ hasText: ITAU_VISA.name });
    await expect(roxinho.getByText('−R$ 1.500,00')).toBeVisible();
    await expect(roxinho.getByText('Limite disponível')).toBeVisible();
    if (testInfo.project.name === 'celular') {
        await expect(roxinho.getByText('Fechada')).toBeHidden();
    } else {
        await expect(roxinho.getByText('Fechada')).toBeVisible();
        await expect(visa.getByText('Vencida')).toBeVisible();
    }

    const box = async (name: string) => {
        const found = await region(page, name).boundingBox();
        if (!found) throw new Error(`no box for ${name}`);
        return found;
    };
    const [receitas, despesas, dueBox, contasBox] = [
        await box('Receitas do mês'),
        await box('Despesas do mês'),
        await box('Vence esta semana'),
        await box('Contas e cartões'),
    ];
    const accountBoxes = await Promise.all(
        [0, 1].map(async (index) => (await accounts.nth(index).boundingBox())!),
    );

    if (testInfo.project.name === 'desktop') {
        // Despesas por tipo: as três maiores e "Outros", ao lado do saldo.
        await expect(byType).toBeVisible();
        const bars = byType.getByRole('list', { name: 'Despesas por tipo' }).getByRole('listitem');
        await expect(bars).toHaveCount(4);
        for (const [index, label] of DASHBOARD_TEXT.byType.entries()) {
            await expect(bars.nth(index)).toContainText(label);
        }
        await expect(bars.nth(3)).toContainText(DASHBOARD_TEXT.others);
        await expect(byType.getByRole('link', { name: 'Ver relatório' })).toBeVisible();
        expect((await box('Despesas por tipo · outubro de 2026')).x).toBeGreaterThan(despesas.x);
        // Vence esta semana e contas e cartões lado a lado (2 + 1).
        expect(contasBox.x).toBeGreaterThan(dueBox.x + dueBox.width - 1);
        expect(Math.abs(contasBox.y - dueBox.y)).toBeLessThan(2);
        // Conteúdo até 1200px.
        expect(contasBox.x + contasBox.width - dueBox.x).toBeLessThanOrEqual(1200);
    } else {
        await expect(byType).toBeHidden();
        expect(contasBox.y).toBeGreaterThan(dueBox.y + dueBox.height - 1);
    }

    if (testInfo.project.name === 'tablet') {
        // Saldo em três colunas e contas em grade de duas.
        expect(Math.abs(receitas.y - despesas.y)).toBeLessThan(2);
        expect(Math.abs(accountBoxes[0]!.y - accountBoxes[1]!.y)).toBeLessThan(2);
    }
    if (testInfo.project.name === 'celular') {
        // Lista de contas, uma abaixo da outra.
        expect(accountBoxes[1]!.y).toBeGreaterThan(accountBoxes[0]!.y);
    }
});

// AC-0015-03, INV-0015-01: Pagar e Nova despesa só navegam, e só com `entries.write`.
test('with lancador, Pagar leads to the expense and the statement with ?pagar=1', async ({
    page,
}, testInfo) => {
    test.skip(testInfo.project.name === 'celular', 'the table with Pagar is tablet and desktop');
    await open(page, 'lancador');
    await expect(page.getByRole('link', { name: 'Nova despesa' })).toBeVisible();
    if (testInfo.project.name === 'desktop') {
        await expect(page.getByRole('link', { name: 'Nova receita' })).toBeVisible();
    } else {
        await expect(page.getByRole('link', { name: 'Nova receita' })).toBeHidden();
    }

    const rows = region(page, 'Vence esta semana').locator('tbody tr');
    await rows.filter({ hasText: 'Farmácia' }).getByRole('link', { name: 'Pagar' }).click();
    await expect(page).toHaveURL(new RegExp(`/despesas/${FARMACIA.id}\\?pagar=1$`));

    await page.goBack();
    await rows
        .filter({ hasText: `Fatura ${NUBANK_ROXINHO.name}` })
        .getByRole('link', { name: 'Pagar' })
        .click();
    await expect(page).toHaveURL(
        new RegExp(`/cartoes/${NUBANK_ROXINHO.id}/faturas/${ROXINHO_CLOSED.id}\\?pagar=1$`),
    );
});

test('with lancador, Nova despesa leads to /despesas?novo=1', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'celular', 'Nova despesa is tablet and desktop');
    await open(page, 'lancador');
    await page.getByRole('link', { name: 'Nova despesa' }).click();
    await expect(page).toHaveURL(/\/despesas\?novo=1$/);
});

test('with leitor, neither Pagar nor Nova despesa appear', async ({ page }) => {
    await open(page, 'leitor');
    await expect(
        region(page, 'Vence esta semana').getByText('Farmácia').filter({ visible: true }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Pagar' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Nova despesa' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Nova receita' })).toHaveCount(0);
});

// AC-0015-05, INV-0015-04, ERR-0015-01.
test('with the statements query failing, only Vence esta semana and the card badges show the error', async ({
    page,
}, testInfo) => {
    await open(page, 'ativo', { statementsStatus: 500 });

    const due = region(page, 'Vence esta semana');
    // 5xx é repetido duas vezes antes do erro (spec 0005).
    await expect(due.getByRole('alert')).toContainText('Não foi possível carregar.', {
        timeout: 15_000,
    });
    await expect(due.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();

    const cardErrors = region(page, 'Contas e cartões').getByText(
        'Não foi possível carregar a fatura.',
    );
    if (testInfo.project.name === 'celular') {
        await expect(cardErrors).toHaveCount(2);
        await expect(cardErrors.first()).toBeHidden();
    } else {
        await expect(cardErrors).toHaveCount(2);
        await expect(cardErrors.first()).toBeVisible();
    }

    // As outras seções seguem.
    const saldo = region(page, 'Saldo realizado · outubro de 2026');
    await expect(saldo.getByText(DASHBOARD_TEXT.realized, { exact: true })).toBeVisible();
    await expect(saldo.getByText(DASHBOARD_TEXT.forecast, { exact: true })).toBeVisible();
    await expect(
        region(page, 'Despesas do mês').getByText(DASHBOARD_TEXT.expenses, { exact: true }),
    ).toBeVisible();
    await expect(region(page, 'Contas e cartões').getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(1);
});
