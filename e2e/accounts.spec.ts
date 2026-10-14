import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

import { stubApi, type ApiStub } from './fixtures/api';
import { chooseUser, signInWithEmail, stubUsersMe, type E2EUser } from './fixtures/auth';
import {
    accountsReadRoutes,
    ACTIVE_BALANCE_TEXT,
    ITAU_VISA,
    NUBANK_ROXINHO,
} from './fixtures/data/accounts';
import { stubRuntime } from './fixtures/runtime-config';

// Spec 0011, listas só de leitura (T-0011-01).

async function openAs(page: Page, path: string, user: E2EUser = 'ativo'): Promise<ApiStub> {
    await stubRuntime(page);
    await chooseUser(page, user);
    const stub = await stubApi(page, accountsReadRoutes);
    await stubUsersMe(page, user);
    await page.goto(`/entrar?redirect=${encodeURIComponent(path)}`);
    await signInWithEmail(page);
    return stub;
}

/** Os itens da lista no formato do projeto: cartões no celular, linhas da tabela acima. */
function entries(page: Page, caption: string, testInfo: TestInfo): Locator {
    if (testInfo.project.name === 'celular') {
        return page.getByRole('list', { name: caption }).getByRole('listitem');
    }
    return page.getByRole('table', { name: caption }).locator('tbody tr');
}

// AC-0011-01, INV-0011-03.
test('/contas lists the active accounts, the type in pt-BR, the signed balance and the total', async ({
    page,
}, testInfo) => {
    const stub = await openAs(page, '/contas');
    await expect(page.getByRole('heading', { name: 'Contas', level: 1 })).toBeVisible();

    const total = page.getByRole('region', { name: 'Saldo em contas' });
    await expect(total).toContainText(ACTIVE_BALANCE_TEXT);

    const items = entries(page, 'Contas bancárias', testInfo);
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText('Conta corrente');
    await expect(items.nth(0)).toContainText('Itaú');
    await expect(items.nth(0)).toContainText('Corrente');
    await expect(items.nth(0)).toContainText('−R$ 123,45');
    await expect(items.nth(1)).toContainText('Poupança');
    await expect(items.nth(1)).toContainText('R$ 5.000,00');
    await expect(page.getByText('Investimento antigo')).toHaveCount(0);

    // A consulta de referência pede os arquivados; a tela filtra os ativos.
    const request = stub.requests.find((r) => r.path === '/bank-accounts');
    expect(request?.query).toEqual({ archived: 'true' });

    // Número e cheque especial só no desktop.
    if (testInfo.project.name === 'desktop') {
        await expect(items.nth(0)).toContainText('12345-6');
        await expect(items.nth(0)).toContainText('R$ 1.000,00');
    } else if (testInfo.project.name === 'tablet') {
        await expect(page.getByRole('columnheader', { name: 'Número' })).toBeHidden();
    }

    await page.getByRole('checkbox', { name: 'Mostrar arquivadas' }).check();
    await expect(page).toHaveURL(/[?&]arquivadas=1/);
    await expect(items).toHaveCount(3);
    await expect(items.nth(0)).toContainText('Conta corrente');
    await expect(items.nth(1)).toContainText('Investimento antigo');
    await expect(items.nth(1)).toContainText('Investimento');
    await expect(items.nth(1)).toContainText('Arquivado');
    // O total continua só com as ativas.
    await expect(total).toContainText(ACTIVE_BALANCE_TEXT);
});

test('/contas links to /contas/bancos, which lists the banks with their code', async ({
    page,
}, testInfo) => {
    await openAs(page, '/contas');
    await page.getByRole('link', { name: 'Bancos' }).click();

    await expect(page).toHaveURL(/\/contas\/bancos$/);
    await expect(page.getByRole('heading', { name: 'Bancos', level: 1 })).toBeVisible();
    const items = entries(page, 'Bancos', testInfo);
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText('Itaú');
    await expect(items.nth(0)).toContainText('341');
    await expect(items.nth(1)).toContainText('Nubank');

    await page.getByRole('checkbox', { name: 'Mostrar arquivados' }).check();
    await expect(page).toHaveURL(/[?&]arquivados=1/);
    await expect(items).toHaveCount(3);
    await expect(items.nth(0)).toContainText('Banco do Brasil');
    await expect(items.nth(0)).toContainText('Arquivado');
});

// AC-0011-02, INV-0011-03.
test('/cartoes shows used, available and the cycle; an overdrawn card shows − in the negative tone', async ({
    page,
}, testInfo) => {
    await openAs(page, '/cartoes');
    await expect(page.getByRole('heading', { name: 'Cartões', level: 1 })).toBeVisible();

    const items = entries(page, 'Cartões de crédito', testInfo);
    await expect(items).toHaveCount(2);

    const itau = items.nth(0);
    await expect(itau).toContainText('Itaú Visa');
    await expect(itau).toContainText('R$ 1.025,50'); // usado: 1.000,00 − (−25,50)
    await expect(itau).toContainText('Fecha em 25 out. · vence em 5 nov.');
    const overdrawn = itau.getByText('−R$ 25,50');
    await expect(overdrawn).toBeVisible();
    await expect(overdrawn).toHaveClass(/text-negativo/);

    const nubank = items.nth(1);
    await expect(nubank).toContainText('Nubank Roxinho');
    await expect(nubank).toContainText('R$ 1.500,00');
    await expect(nubank).toContainText('R$ 3.500,00');
    await expect(nubank).toContainText('Fecha em 8 out. · vence em 15 out.');
    await expect(nubank.getByText('R$ 3.500,00')).not.toHaveClass(/text-negativo/);

    // Conta pagadora só no desktop.
    if (testInfo.project.name === 'desktop') {
        await expect(nubank).toContainText('Conta corrente');
        await expect(itau).toContainText('—');
    }

    await page.getByRole('checkbox', { name: 'Mostrar arquivados' }).check();
    await expect(items).toHaveCount(3);
    await expect(items.nth(0)).toContainText('Cartão antigo');
    await expect(items.nth(0)).toContainText('Arquivado');
});

test('a card leads to its summary at /cartoes/$cartaoId', async ({ page }, testInfo) => {
    await openAs(page, '/cartoes');
    const items = entries(page, 'Cartões de crédito', testInfo);
    await items.nth(1).getByRole('link').first().click();

    await expect(page).toHaveURL(new RegExp(`/cartoes/${NUBANK_ROXINHO.id}$`));
    await expect(page.getByRole('heading', { name: 'Nubank Roxinho', level: 1 })).toBeVisible();
    await expect(page.getByText('Limite total')).toBeVisible();
    await expect(page.getByText('R$ 5.000,00')).toBeVisible();
    await expect(page.getByText('Fecha em 8 out. · vence em 15 out.')).toBeVisible();
    await expect(page.getByText('Conta corrente')).toBeVisible();

    await page.getByRole('link', { name: 'Cartões' }).first().click();
    await expect(page).toHaveURL(/\/cartoes$/);
});

// ERR-0011-03.
test('an unknown card shows not found with a link back', async ({ page }) => {
    await openAs(page, '/cartoes/00000000-0000-4000-8000-00000000dead');
    await expect(page.getByRole('heading', { name: 'Não encontramos este item.' })).toBeVisible();
    await page.getByRole('link', { name: 'Voltar para os cartões' }).click();
    await expect(page).toHaveURL(/\/cartoes$/);
});

// INV-0011-01 (leitura): lancador e leitor veem as mesmas listas, sem controles de escrita.
for (const user of ['lancador', 'leitor'] as const) {
    test(`${user} sees the same lists, read only`, async ({ page }, testInfo) => {
        await openAs(page, '/contas', user);
        await expect(entries(page, 'Contas bancárias', testInfo)).toHaveCount(2);
        await expect(page.getByRole('region', { name: 'Saldo em contas' })).toContainText(
            ACTIVE_BALANCE_TEXT,
        );

        const nav = page.getByRole('navigation', { name: 'Principal' });
        await nav.getByRole('link', { name: 'Cartões' }).click();
        await expect(entries(page, 'Cartões de crédito', testInfo)).toHaveCount(2);
        for (const name of ['Nova conta', 'Novo banco', 'Novo cartão', 'Editar', 'Arquivar']) {
            await expect(page.getByRole('button', { name })).toHaveCount(0);
            await expect(page.getByRole('link', { name })).toHaveCount(0);
        }

        await entries(page, 'Cartões de crédito', testInfo)
            .nth(0)
            .getByRole('link')
            .first()
            .click();
        await expect(page.getByRole('heading', { name: ITAU_VISA.name, level: 1 })).toBeVisible();
    });
}

// AC-0011-08: Cartões na barra inferior; Contas em Mais no celular e no tablet, na lateral no desktop.
test('Cartões is in the bottom bar and Contas is under Mais, or both in the sidebar on desktop', async ({
    page,
}, testInfo) => {
    await openAs(page, '/');
    await expect(page.getByRole('heading', { name: 'Início', level: 1 })).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Principal' });

    await expect(nav.getByRole('link', { name: 'Cartões' })).toBeVisible();
    if (testInfo.project.name === 'desktop') {
        await expect(nav.getByRole('link', { name: 'Contas' })).toBeVisible();
        await expect(nav.getByRole('link', { name: 'Mais' })).toBeHidden();
        await nav.getByRole('link', { name: 'Contas' }).click();
    } else {
        await expect(nav.getByRole('link', { name: 'Contas' })).toBeHidden();
        await nav.getByRole('link', { name: 'Mais' }).click();
        await expect(page.getByRole('heading', { name: 'Mais' })).toBeVisible();
        await page
            .getByRole('navigation', { name: 'Mais' })
            .getByRole('link', { name: 'Contas' })
            .click();
    }
    await expect(page).toHaveURL(/\/contas$/);
    await expect(page.getByRole('heading', { name: 'Contas', level: 1 })).toBeVisible();

    await nav.getByRole('link', { name: 'Cartões' }).click();
    await expect(page).toHaveURL(/\/cartoes$/);
    await expect(nav.getByRole('link', { name: 'Cartões' })).toHaveAttribute(
        'aria-current',
        'page',
    );
});
