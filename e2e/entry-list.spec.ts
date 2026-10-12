import { expect, test } from '@playwright/test';

import { stubRuntime } from './fixtures/runtime-config';

// Página de prova `/_e2e/lista` (spec 0009): só existe no build `--mode e2e`, com dados estáticos.

const IDS = ['d1', 'd2', 'd3'];

test.beforeEach(async ({ page }) => {
    await stubRuntime(page);
});

test('the proof page answers at the literal /_e2e/lista URL without calling the API', async ({
    page,
}) => {
    const apiCalls: string[] = [];
    page.on('request', (request) => {
        if (new URL(request.url()).pathname.startsWith('/api/')) apiCalls.push(request.url());
    });

    await page.goto('/_e2e/lista');

    await expect(page.getByRole('heading', { name: 'Prova — EntryList', level: 1 })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/_e2e/lista');
    expect(apiCalls).toEqual([]);
});

// AC-0009-05: cartões no celular, tabela com `<caption>` no tablet e no desktop, link de cada item.
test('EntryList shows cards on the phone and a captioned table from tablet up', async ({
    page,
}, testInfo) => {
    await page.goto('/_e2e/lista');
    const section = page.getByRole('region', { name: 'Com itens' });
    const cards = section.getByRole('list', { name: 'Despesas de outubro' });
    const table = section.getByRole('table', { name: 'Despesas de outubro' });

    if (testInfo.project.name === 'celular') {
        await expect(cards).toBeVisible();
        await expect(table).toBeHidden();
        const links = cards.getByRole('link');
        await expect(links).toHaveCount(IDS.length);
        for (const [index, id] of IDS.entries()) {
            const link = links.nth(index);
            await expect(link).toHaveAttribute('href', `/despesas/${id}`);
            // O cartão inteiro é o alvo de toque: pelo menos 44px.
            const box = await link.boundingBox();
            expect(box?.height).toBeGreaterThanOrEqual(44);
        }
        await expect(links.first()).toContainText('Mercado');
        await expect(links.first()).toContainText('R$ 234,90');
        return;
    }

    await expect(table).toBeVisible();
    await expect(cards).toBeHidden();
    await expect(table.locator('caption')).toHaveText('Despesas de outubro');
    const rows = table.getByRole('row');
    // Cabeçalho e três linhas.
    await expect(rows).toHaveCount(1 + IDS.length);
    for (const [index, id] of IDS.entries()) {
        const link = rows.nth(index + 1).getByRole('link');
        await expect(link).toHaveCount(1);
        await expect(link).toHaveAttribute('href', `/despesas/${id}`);
    }
    await expect(rows.nth(1).getByRole('link')).toHaveText('Mercado');

    // Valores alinhados ao fim; a coluna "Conta" só aparece no desktop.
    const value = table.getByRole('cell', { name: 'R$ 234,90' });
    await expect(value).toHaveCSS('text-align', 'end');
    const account = table.getByRole('columnheader', { name: 'Conta' });
    if (testInfo.project.name === 'desktop') await expect(account).toBeVisible();
    else await expect(account).toBeHidden();
});

test('a click anywhere on a table row follows its link', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'celular', 'no table below md');
    await page.goto('/_e2e/lista');
    const table = page.getByRole('table', { name: 'Despesas de outubro' });

    await table.getByRole('cell', { name: 'R$ 1.800,00' }).click();

    await expect(page).toHaveURL(/\/despesas\/d2$/);
});

// AC-0009-05: sem itens, o `empty` no lugar da lista.
test('EntryList renders the empty state when there are no items', async ({ page }) => {
    await page.goto('/_e2e/lista');
    const section = page.getByRole('region', { name: 'Sem itens' });

    await expect(
        section.getByRole('heading', { name: 'Nenhuma receita neste mês.' }),
    ).toBeVisible();
    await expect(section.getByText('As receitas lançadas aparecem aqui.')).toBeVisible();
    await expect(section.getByRole('table')).toHaveCount(0);
    await expect(section.getByRole('list')).toHaveCount(0);
});

test('the list skeleton and the bar list render on every screen size', async ({ page }) => {
    await page.goto('/_e2e/lista');

    await expect(page.getByRole('status', { name: 'Carregando' })).toBeVisible();
    const bars = page.getByRole('list', { name: 'Despesas por tipo' });
    await expect(bars.getByRole('listitem')).toHaveCount(3);
    await expect(bars.getByRole('listitem').first()).toContainText('Moradia');
    await expect(bars.getByRole('listitem').first()).toContainText('R$ 1.800,00');
});
