import { expect, test } from '@playwright/test';

import { stubApi } from './fixtures/api';
import { chooseUser, signInWithEmail, stubUsersMe } from './fixtures/auth';
import { stubRuntime } from './fixtures/runtime-config';

test.beforeEach(async ({ page }) => {
    await stubRuntime(page);
    await chooseUser(page, 'ativo');
    await stubUsersMe(page, 'ativo');
    await page.goto('/entrar');
    await signInWithEmail(page);
    await expect(page.getByRole('heading', { name: 'Início', level: 1 })).toBeVisible();
});

// AC-0006-07: barra inferior no celular e no tablet, barra lateral no desktop.
test('the main navigation is a bottom bar below 1024px and a left sidebar from 1024px', async ({
    page,
}, testInfo) => {
    const nav = page.getByRole('navigation', { name: 'Principal' });
    await expect(nav).toHaveCount(1);
    await expect(nav).toBeVisible();

    const viewport = page.viewportSize();
    const box = await nav.boundingBox();
    if (!viewport || !box) throw new Error('no viewport or navigation box');

    if (testInfo.project.name === 'desktop') {
        // Lateral fixa: encostada à esquerda, 240px menos o respiro, ocupando a altura.
        expect(box.x).toBeLessThan(24);
        expect(box.width).toBeLessThanOrEqual(240);
        expect(box.y).toBeLessThan(viewport.height / 2);
        // Marca no topo da lateral; menu do usuário no topo do conteúdo, à direita da lateral.
        const userMenu = page.getByRole('button', { name: 'Menu do usuário' });
        const menuBox = await userMenu.boundingBox();
        expect(menuBox?.x).toBeGreaterThan(240);
        expect(menuBox?.y).toBeLessThan(64);
    } else {
        // Barra inferior fixa: toda a largura, colada ao fundo da tela, 64px de altura.
        expect(box.x).toBe(0);
        expect(box.width).toBe(viewport.width);
        expect(Math.round(box.y + box.height)).toBe(viewport.height);
        expect(Math.round(box.height)).toBe(64);
        // Cabeçalho com o símbolo, "FTech Finance" e o menu do usuário.
        const header = page.getByRole('banner');
        await expect(header.getByText('FTech Finance')).toBeVisible();
        await expect(header.getByRole('button', { name: 'Menu do usuário' })).toBeVisible();
    }
});

// AC-0006-07, INV-0006-03: o item ativo é marcado por `aria-current`; o perfil vê Início, Despesas
// (spec 0012), Receitas (spec 0014), Cartões e Contas (spec 0011) — no celular e no tablet, Contas
// fica em Mais.
test('the active item is marked with aria-current="page"', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Principal' });
    const home = nav.getByRole('link', { name: 'Início' });
    await expect(home).toBeVisible();
    await expect(home).toHaveAttribute('aria-current', 'page');
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
});

// Alvos de toque de pelo menos 44×44px (spec 0006, "Acessibilidade").
test('the navigation item and the user menu trigger are at least 44x44px', async ({ page }) => {
    const targets = [
        page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Início' }),
        page.getByRole('button', { name: 'Menu do usuário' }),
    ];
    for (const target of targets) {
        const box = await target.boundingBox();
        expect(box?.width).toBeGreaterThanOrEqual(44);
        expect(box?.height).toBeGreaterThanOrEqual(44);
    }
});

test('the user menu shows the name, the email and the profile in pt-BR', async ({ page }) => {
    await page.getByRole('button', { name: 'Menu do usuário' }).click();
    const menu = page.getByRole('region', { name: 'Conta do usuário' });
    await expect(menu.getByText('Ana Souza')).toBeVisible();
    await expect(menu.getByText('ativo@example.com')).toBeVisible();
    await expect(menu.getByText('Administrador')).toBeVisible();
    await expect(menu.getByRole('button', { name: 'Sair' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByText('ativo@example.com')).toHaveCount(0);
});

// AC-0006-13: ícone da aba declarado no `index.html` publicado, com os três arquivos no ar.
test('the published index declares the tab icons and the three files respond 200', async ({
    page,
}) => {
    await page.goto('/entrar');
    const icons = [
        { selector: 'link[rel="icon"][type="image/svg+xml"]', href: '/favicon.svg' },
        { selector: 'link[rel="icon"][type="image/png"][sizes="32x32"]', href: '/favicon-32.png' },
        { selector: 'link[rel="apple-touch-icon"]', href: '/apple-touch-icon.png' },
    ];
    for (const { selector, href } of icons) {
        await expect(page.locator(selector)).toHaveAttribute('href', href);
        const response = await page.request.get(href);
        expect(response.status()).toBe(200);
        expect(response.headers()['content-type']).toMatch(/image\//);
    }
});

// AC-0006-14: o painel do menu do usuário fica acima do botão flutuante da lista. A sobreposição
// só existe onde o painel (de cima do cabeçalho) alcança o botão: no tablet e no desktop, o botão
// está no cabeçalho da página; no celular, o botão é fixo acima da barra e só encontra o painel
// numa tela bem baixa (menos de ~460px, como um navegador de celular com as barras abertas), então
// o celular roda a 390×440.
test('the user menu panel is above the Nova despesa button', async ({ page }, testInfo) => {
    if (testInfo.project.name === 'celular')
        await page.setViewportSize({ width: 390, height: 440 });
    await stubApi(page, [
        { method: 'GET', path: '/bank-accounts', body: { data: [] } },
        { method: 'GET', path: '/credit-cards', body: { data: [] } },
        { method: 'GET', path: '/expense-types', body: { data: [] } },
        { method: 'GET', path: '/expenses', body: { data: [] } },
    ]);
    await page
        .getByRole('navigation', { name: 'Principal' })
        .getByRole('link', { name: 'Despesas' })
        .click();
    await expect(page.getByRole('heading', { name: 'Despesas', level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Menu do usuário' }).click();

    const panel = page.getByRole('region', { name: 'Conta do usuário' });
    await expect(panel).toBeVisible();
    const button = await page.getByRole('button', { name: 'Nova despesa' }).boundingBox();
    const box = await panel.boundingBox();
    if (!button || !box) throw new Error('no button or panel box');

    // Centro da área em que os dois se sobrepõem.
    const left = Math.max(button.x, box.x);
    const right = Math.min(button.x + button.width, box.x + box.width);
    const top = Math.max(button.y, box.y);
    const bottom = Math.min(button.y + button.height, box.y + box.height);
    expect(right).toBeGreaterThan(left);
    expect(bottom).toBeGreaterThan(top);

    const insidePanel = await page.evaluate(
        ([x, y]) => {
            const hit = document.elementFromPoint(x ?? 0, y ?? 0);
            return hit?.closest('section[aria-label="Conta do usuário"]') !== null;
        },
        [(left + right) / 2, (top + bottom) / 2],
    );
    expect(insidePanel).toBe(true);
});
