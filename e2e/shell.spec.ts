import { expect, test } from '@playwright/test';

import { chooseUser, signInWithEmail, stubUsersMe } from './fixtures/auth';
import { stubRuntime } from './fixtures/runtime-config';

test.beforeEach(async ({ page }) => {
    await stubRuntime(page);
    await chooseUser(page, 'ativo');
    await stubUsersMe(page, 'ativo');
    await page.goto('/entrar');
    await signInWithEmail(page);
    await expect(page.getByRole('heading', { name: 'Olá, Ana Souza' })).toBeVisible();
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

// AC-0006-07, INV-0006-03: o item ativo é marcado por `aria-current`; o perfil vê Início.
test('the active item is marked with aria-current="page"', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Principal' });
    const home = nav.getByRole('link', { name: 'Início' });
    await expect(home).toBeVisible();
    await expect(home).toHaveAttribute('aria-current', 'page');
    await expect(nav.getByRole('link')).toHaveCount(1);
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
