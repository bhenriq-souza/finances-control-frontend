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
    OCTOBER_ORDER,
} from './fixtures/data/expenses';
import { stubRuntime } from './fixtures/runtime-config';

// Lista e detalhe de despesas (spec 0012, T-0012-01).

const REFERENCE: StubRoute[] = [
    { method: 'GET', path: '/bank-accounts', body: { data: BANK_ACCOUNTS } },
    { method: 'GET', path: '/credit-cards', body: { data: CREDIT_CARDS } },
    { method: 'GET', path: '/expense-types', body: { data: EXPENSE_TYPES } },
];

async function open(
    page: Page,
    path: string,
    { user = 'ativo', routes = [] }: { user?: E2EUser; routes?: StubRoute[] } = {},
): Promise<ApiStub> {
    await page.clock.setFixedTime(new Date(EXPENSES_TODAY));
    await stubRuntime(page);
    await chooseUser(page, user);
    const stub = await stubApi(page, [
        ...REFERENCE,
        { method: 'GET', path: '/expenses', body: { data: OCTOBER_EXPENSES } },
        ...routes,
    ]);
    await stubUsersMe(page, user);
    await page.goto(`/entrar?redirect=${encodeURIComponent(path)}`);
    await signInWithEmail(page);
    await expect(page.getByRole('heading', { name: 'Despesas', level: 1 })).toBeVisible();
    return stub;
}

const expenseRequests = (stub: ApiStub) =>
    stub.requests.filter(({ method, path }) => method === 'GET' && path === '/expenses');

/** As linhas da lista visível: cartões no celular, linhas da tabela no tablet e no desktop. */
function rows(page: Page, phone: boolean) {
    return phone
        ? page.getByRole('list', { name: /^Despesas de/ }).getByRole('listitem')
        : page
              .getByRole('table', { name: /^Despesas de/ })
              .getByRole('row')
              .filter({
                  has: page.getByRole('cell'),
              });
}

// AC-0012-01, AC-0012-12, INV-0012-01: consulta do mês, ordem de data, selo, conta ou cartão por
// nome, valor com `−R$`, e o `EntryList` em cada tamanho.
test('lists the month in date order with badge, account or card name and a negative value', async ({
    page,
}, testInfo) => {
    const phone = testInfo.project.name === 'celular';
    const stub = await open(page, '/despesas?mes=2026-10');

    await expect(page.getByRole('heading', { name: 'outubro de 2026' })).toBeVisible();
    await expect.poll(() => expenseRequests(stub).length).toBeGreaterThan(0);
    expect(expenseRequests(stub)[0]?.query).toEqual({ from: '2026-10-01', to: '2026-10-31' });

    const list = rows(page, phone);
    await expect(list).toHaveCount(OCTOBER_ORDER.length);
    for (const [index, description] of OCTOBER_ORDER.entries()) {
        await expect(list.nth(index)).toContainText(description);
    }

    const aluguel = list.nth(0);
    await expect(aluguel).toContainText('Pago');
    await expect(aluguel).toContainText('Conta corrente');
    await expect(aluguel).toContainText('Fixa');
    await expect(aluguel).toContainText('−R$ 1.800,00');
    const notebook = list.nth(2);
    await expect(notebook).toContainText('Parcela 2 de 3');
    await expect(notebook).toContainText('Nubank');
    await expect(notebook).toContainText('Pendente');
    await expect(list.nth(1)).toContainText('Vencido');
    // Despesa de conta pendente que vence hoje.
    await expect(list.nth(4)).toContainText('Vence hoje');
    await expect(list.nth(4)).toContainText('Hoje');
    await expect(list.nth(5)).toContainText('Previsto');

    const summary = page.getByRole('region', { name: 'Resumo' });
    await expect(summary).toContainText('−R$ 2.730,50');
    await expect(summary).toContainText('1 paga · 4 pendentes · 1 vencida');
    // Rótulo, total e contagens um embaixo do outro em todos os tamanhos, como nas receitas.
    const label = await summary.getByText('Total', { exact: true }).boundingBox();
    const total = await summary.getByText('−R$ 2.730,50').boundingBox();
    const counts = await summary.getByText('1 paga · 4 pendentes · 1 vencida').boundingBox();
    expect(label!.y + label!.height).toBeLessThanOrEqual(total!.y + 1);
    expect(total!.y + total!.height).toBeLessThanOrEqual(counts!.y + 1);
    expect(Math.abs(label!.x - total!.x)).toBeLessThan(2);
    expect(Math.abs(total!.x - counts!.x)).toBeLessThan(2);

    if (phone) {
        await expect(page.getByRole('table')).toBeHidden();
        await expect(list.first().getByRole('link')).toHaveAttribute(
            'href',
            `/despesas/${OCTOBER_EXPENSES[1]?.id}`,
        );
    } else {
        const type = page.getByRole('columnheader', { name: 'Tipo' });
        if (testInfo.project.name === 'desktop') await expect(type).toBeVisible();
        else await expect(type).toBeHidden();
        await expect(page.getByRole('cell', { name: '−R$ 1.800,00' })).toHaveCSS(
            'text-align',
            'end',
        );
    }
});

// AC-0012-02: filtros na consulta, etiquetas, e tudo na URL, sobrevivendo a recarregar.
test('status and card filters reach the query, show as tags and survive a reload', async ({
    page,
}, testInfo) => {
    const stub = await open(page, '/despesas?mes=2026-10');

    if (testInfo.project.name === 'celular') {
        await page.getByRole('button', { name: 'Filtros' }).click();
        const sheet = page.getByRole('dialog', { name: 'Filtros' });
        await sheet.getByLabel('Status').selectOption({ label: 'Vencido' });
        await sheet.getByLabel('Conta ou cartão').selectOption({ label: 'Nubank' });
        await sheet.getByRole('button', { name: 'Ver despesas' }).click();
        await expect(sheet).toBeHidden();
    } else {
        const filters = page.getByRole('region', { name: 'Filtros' });
        await filters.getByLabel('Status').selectOption({ label: 'Vencido' });
        await filters.getByLabel('Conta ou cartão').selectOption({ label: 'Nubank' });
    }

    await expect
        .poll(() => expenseRequests(stub).at(-1)?.query)
        .toEqual({
            from: '2026-10-01',
            to: '2026-10-31',
            status: 'OVERDUE',
            creditCardId: CARD_ID,
        });
    const tags = page.getByRole('list', { name: 'Filtros ativos' });
    await expect(tags.getByRole('button')).toHaveText(['Vencido', 'Nubank']);
    await expect(page).toHaveURL(/status=OVERDUE/);
    await expect(page).toHaveURL(new RegExp(`cartao=${CARD_ID}`));

    // O fake de autenticação guarda a sessão em memória: recarregar pede o login de novo, que
    // volta para a mesma URL.
    const url = page.url();
    await page.reload();
    await signInWithEmail(page);
    await expect(page).toHaveURL(url);
    await expect(tags.getByRole('button')).toHaveText(['Vencido', 'Nubank']);
    expect(expenseRequests(stub).at(-1)?.query).toMatchObject({
        status: 'OVERDUE',
        creditCardId: CARD_ID,
    });

    // Remover a etiqueta tira o filtro da URL e da consulta.
    await tags.getByRole('button', { name: 'Remover filtro Vencido' }).click();
    await expect(tags.getByRole('button')).toHaveText(['Nubank']);
    await expect(page).not.toHaveURL(/status=/);
    await expect
        .poll(() => expenseRequests(stub).at(-1)?.query)
        .toEqual({ from: '2026-10-01', to: '2026-10-31', creditCardId: CARD_ID });
});

test('the month navigation moves the query one month at a time', async ({ page }) => {
    const stub = await open(page, '/despesas?mes=2026-10');

    await page.getByRole('button', { name: 'Próximo mês' }).click();
    await expect(page.getByRole('heading', { name: 'novembro de 2026' })).toBeVisible();
    await expect(page).toHaveURL(/mes=2026-11/);
    await expect
        .poll(() => expenseRequests(stub).at(-1)?.query)
        .toEqual({ from: '2026-11-01', to: '2026-11-30' });
});

// ERR-0012-04: parâmetro inválido é descartado e vale o padrão (o mês de hoje).
test('an invalid month falls back to the current month', async ({ page }) => {
    const stub = await open(page, '/despesas?mes=2026-13');

    await expect(page.getByRole('heading', { name: 'outubro de 2026' })).toBeVisible();
    await expect
        .poll(() => expenseRequests(stub).at(-1)?.query)
        .toEqual({ from: '2026-10-01', to: '2026-10-31' });
});

// AC-0012-12: **Nova despesa** acessível sem cobrir a barra inferior.
test('Nova despesa is reachable and never covers the bottom bar', async ({ page }, testInfo) => {
    await open(page, '/despesas?mes=2026-10');

    const button = page.getByRole('button', { name: 'Nova despesa' });
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    if (testInfo.project.name !== 'desktop') {
        const bar = await page.getByRole('navigation', { name: 'Principal' }).boundingBox();
        if (!box || !bar) throw new Error('no button or navigation box');
        expect(box.y + box.height).toBeLessThanOrEqual(bar.y);
    }

    await button.click();
    await expect(page).toHaveURL(/novo=1/);
});

// AC-0012-10 (lista): sem `entries.write`, nenhuma ação de escrita.
test('a leitor sees the list without Nova despesa', async ({ page }) => {
    await open(page, '/despesas?mes=2026-10', { user: 'leitor' });

    await expect(page.getByText('Aluguel').filter({ visible: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nova despesa' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Tipos de despesa' })).toHaveCount(0);
});

test('the Despesas navigation item is marked active on the list', async ({ page }) => {
    await open(page, '/despesas?mes=2026-10');

    const item = page.getByRole('navigation', { name: 'Principal' }).getByRole('link', {
        name: 'Despesas',
    });
    await expect(item).toHaveAttribute('aria-current', 'page');
});

test('an item opens the read-only detail, which links to all the installments', async ({
    page,
}, testInfo) => {
    const stub = await open(page, '/despesas?mes=2026-10', {
        routes: [{ method: 'GET', path: `/expenses/${NOTEBOOK.id}`, body: { data: NOTEBOOK } }],
    });

    const list = rows(page, testInfo.project.name === 'celular');
    await list.nth(2).getByRole('link').click();

    await expect(page).toHaveURL(new RegExp(`/despesas/${NOTEBOOK.id}$`));
    await expect(page.getByRole('heading', { name: 'Notebook', level: 1 })).toBeVisible();
    await expect(page.getByText('−R$ 400,00')).toBeVisible();
    await expect(page.getByText('Parcela 2 de 3')).toBeVisible();
    await expect(page.getByText('Data da compra')).toBeVisible();
    await expect(page.getByRole('definition').filter({ hasText: 'Nubank' })).toBeVisible();

    await page.getByRole('link', { name: 'Ver todas as parcelas' }).click();
    await expect(page.getByRole('heading', { name: 'Todas as parcelas' })).toBeVisible();
    await expect
        .poll(() => expenseRequests(stub).at(-1)?.query)
        .toEqual({ installmentGroupId: NOTEBOOK.installment?.groupId });
});

// ERR-0012-02 / ERR-0009-02: detalhe com `404 EXPENSE_NOT_FOUND`.
test('an unknown expense shows the not-found state with a way back', async ({ page }) => {
    const id = '60000000-0000-4000-8000-0000000000ff';
    await stubRuntime(page);
    await chooseUser(page, 'ativo');
    await stubApi(page, [
        ...REFERENCE,
        {
            method: 'GET',
            path: `/expenses/${id}`,
            status: 404,
            body: { error: { code: 'EXPENSE_NOT_FOUND', message: 'not found' } },
        },
    ]);
    await stubUsersMe(page, 'ativo');
    await page.goto(`/entrar?redirect=${encodeURIComponent(`/despesas/${id}`)}`);
    await signInWithEmail(page);

    await expect(page.getByRole('heading', { name: 'Não encontramos este item.' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Voltar para despesas' })).toHaveAttribute(
        'href',
        '/despesas',
    );
});
