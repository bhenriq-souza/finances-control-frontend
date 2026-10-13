import { expect, test, type Page } from '@playwright/test';

import { stubApi, type ApiStub } from './fixtures/api';
import { chooseUser, signInWithEmail, stubUsersMe, type E2EUser } from './fixtures/auth';
import {
    BANK_ACCOUNTS,
    EARNING_TYPES,
    FREELANCE_TYPE,
    OCTOBER_EARNINGS,
    PROJECT_INSTALLMENT,
    SAVINGS_ACCOUNT,
} from './fixtures/data/earnings';
import { stubRuntime } from './fixtures/runtime-config';

// Lista e detalhe de receitas (spec 0014): AC-0014-01, AC-0014-02, AC-0014-07 (lista),
// AC-0014-09 (lista) e INV-0014-01.

async function openAs(page: Page, user: E2EUser, path: string): Promise<ApiStub> {
    await stubRuntime(page);
    const stub = await stubApi(page, [
        { method: 'GET', path: '/earnings', body: { data: OCTOBER_EARNINGS } },
        {
            method: 'GET',
            path: `/earnings/${PROJECT_INSTALLMENT.id}`,
            body: { data: PROJECT_INSTALLMENT },
        },
        { method: 'GET', path: '/bank-accounts', body: { data: BANK_ACCOUNTS } },
        { method: 'GET', path: '/earning-types', body: { data: EARNING_TYPES } },
    ]);
    await chooseUser(page, user);
    await stubUsersMe(page, user);
    await page.goto(`/entrar?redirect=${encodeURIComponent(path)}`);
    await signInWithEmail(page);
    await expect(page.getByRole('heading', { name: 'Receitas', level: 1 })).toBeVisible();
    return stub;
}

function earningQueries(stub: ApiStub) {
    return stub.requests.filter((r) => r.method === 'GET' && r.path === '/earnings');
}

const DESCRIPTIONS_IN_ORDER = ['Salário', 'Projeto site', 'Aluguel da sala'];

// AC-0014-01, AC-0014-09, INV-0014-01.
test('/receitas?mes=2026-10 lists the month with +R$, badge and account name', async ({
    page,
}, testInfo) => {
    const stub = await openAs(page, 'ativo', '/receitas?mes=2026-10');

    await expect(page.getByRole('heading', { name: 'outubro de 2026' })).toBeVisible();
    await expect
        .poll(() => earningQueries(stub).at(-1)?.query)
        .toEqual({
            from: '2026-10-01',
            to: '2026-10-31',
        });

    const summary = page.getByRole('region', { name: 'Resumo' });
    await expect(summary).toContainText('+R$ 7.300,50');
    await expect(summary).toContainText('1 recebida · 1 pendente · 1 atrasada');

    const cards = page.getByRole('list', { name: 'Receitas' });
    const table = page.getByRole('table', { name: 'Receitas' });
    if (testInfo.project.name === 'celular') {
        await expect(table).toBeHidden();
        const links = cards.getByRole('link');
        await expect(links).toHaveCount(3);
        for (const [index, description] of DESCRIPTIONS_IN_ORDER.entries()) {
            await expect(links.nth(index)).toContainText(description);
        }
        const project = links.nth(1);
        await expect(project).toContainText('+R$ 1.500,00');
        await expect(project).toContainText('Atrasado');
        await expect(project).toContainText('Poupança');
        await expect(project).toContainText('Parcela 2 de 3');
        await expect(project).toHaveAttribute('href', `/receitas/${PROJECT_INSTALLMENT.id}`);
        return;
    }

    await expect(cards).toBeHidden();
    const rows = table.getByRole('row');
    await expect(rows).toHaveCount(1 + 3);
    for (const [index, description] of DESCRIPTIONS_IN_ORDER.entries()) {
        await expect(rows.nth(index + 1)).toContainText(description);
    }
    const project = rows.nth(2);
    await expect(project).toContainText('+R$ 1.500,00');
    await expect(project).toContainText('Atrasado');
    await expect(project).toContainText('Poupança');
    await expect(project.getByRole('cell', { name: '+R$ 1.500,00' })).toHaveCSS(
        'text-align',
        'end',
    );
    await expect(rows.nth(1)).toContainText('Recebido');
    await expect(rows.nth(1)).toContainText('Conta corrente');
    // A coluna Tipo só aparece no desktop.
    const typeHeader = table.getByRole('columnheader', { name: 'Tipo' });
    if (testInfo.project.name === 'desktop') await expect(typeHeader).toBeVisible();
    else await expect(typeHeader).toBeHidden();
});

// AC-0014-02: status, tipo, conta e natureza vão para a consulta e para a URL.
test('the filters go to the query and the URL, which alone restores them', async ({
    page,
}, testInfo) => {
    const stub = await openAs(page, 'ativo', '/receitas?mes=2026-10');

    const phone = testInfo.project.name === 'celular';
    if (phone) await page.getByRole('button', { name: 'Filtros' }).click();
    const panel = phone
        ? page.getByRole('dialog', { name: 'Filtros' })
        : page.getByRole('group', { name: 'Filtros' });

    await panel.getByLabel('Status').selectOption({ label: 'Atrasado' });
    await panel.getByLabel('Tipo').selectOption({ label: FREELANCE_TYPE.name });
    await panel.getByLabel('Conta').selectOption({ label: SAVINGS_ACCOUNT.description });
    await panel.getByLabel('Natureza').selectOption({ label: 'Parcelada' });
    if (phone) await panel.getByRole('button', { name: 'Ver receitas' }).click();

    const expected = {
        from: '2026-10-01',
        to: '2026-10-31',
        status: 'OVERDUE',
        earningTypeId: FREELANCE_TYPE.id,
        bankAccountId: SAVINGS_ACCOUNT.id,
        kind: 'INSTALLMENT',
    };
    await expect.poll(() => earningQueries(stub).at(-1)?.query).toEqual(expected);
    const url = new URL(page.url());
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
        status: 'OVERDUE',
        tipo: FREELANCE_TYPE.id,
        conta: SAVINGS_ACCOUNT.id,
        natureza: 'INSTALLMENT',
    });

    const tags = page.getByRole('list', { name: 'Filtros ativos' });
    await expect(tags.getByRole('button')).toHaveText([
        'Atrasado',
        'Freela',
        'Poupança',
        'Parcelada',
    ]);

    // A URL sozinha restaura os filtros (o fake de autenticação não sobrevive a um reload).
    const current = new URL(page.url());
    await page.goto(`/entrar?redirect=${encodeURIComponent(current.pathname + current.search)}`);
    await signInWithEmail(page);
    await expect(tags.getByRole('button')).toHaveCount(4);
    await expect.poll(() => earningQueries(stub).at(-1)?.query).toEqual(expected);

    await tags.getByRole('button', { name: 'Remover filtro Atrasado' }).click();
    await expect(tags.getByRole('button')).toHaveCount(3);
    await expect.poll(() => earningQueries(stub).at(-1)?.query).not.toHaveProperty('status');
});

// AC-0014-09: Nova receita acessível sem cobrir a barra inferior.
test('Nova receita is reachable without covering the bottom bar', async ({ page }, testInfo) => {
    await openAs(page, 'lancador', '/receitas?mes=2026-10');

    const button = page.getByRole('button', { name: 'Nova receita' });
    await expect(button).toBeVisible();

    if (testInfo.project.name !== 'desktop') {
        const nav = await page.getByRole('navigation', { name: 'Principal' }).boundingBox();
        const box = await button.boundingBox();
        if (!nav || !box) throw new Error('no box');
        expect(box.y + box.height).toBeLessThanOrEqual(nav.y);
    }

    // O botão abre o formulário (T-0014-02), que deixa o resto da tela inerte.
    await button.click();
    await expect(page).toHaveURL(/[?&]novo=1/);
    await expect(page.getByRole('dialog', { name: 'Nova receita' })).toBeVisible();
});

// AC-0014-07 (lista): sem `entries.write`, nenhuma ação de escrita e `?novo=1` não abre nada.
test('a viewer sees no write action and ?novo=1 opens no dialog', async ({ page }) => {
    await openAs(page, 'leitor', '/receitas?mes=2026-10&novo=1');

    await expect(page.getByRole('region', { name: 'Resumo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nova receita' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Tipos de receita' })).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('Receitas is in the main navigation and the detail is read-only', async ({ page }) => {
    await openAs(page, 'leitor', '/receitas?mes=2026-10');

    const nav = page.getByRole('navigation', { name: 'Principal' });
    await expect(nav.getByRole('link', { name: 'Receitas' })).toHaveAttribute(
        'aria-current',
        'page',
    );

    await page.locator(`a[href="/receitas/${PROJECT_INSTALLMENT.id}"]:visible`).first().click();
    await expect(page.getByRole('heading', { name: 'Projeto site', level: 1 })).toBeVisible();
    await expect(page.getByText('+R$ 1.500,00')).toBeVisible();
    await expect(page.getByText('Atrasado')).toBeVisible();
    await expect(page.getByText('Segunda parcela do site.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ver todas as parcelas' })).toHaveAttribute(
        'href',
        `/receitas?grupo=${PROJECT_INSTALLMENT.installment?.groupId}`,
    );
    await expect(page.getByRole('button', { name: /Receber|Excluir/ })).toHaveCount(0);
});
