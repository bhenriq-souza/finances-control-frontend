import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { chooseUser, signInWithEmail, stubUsersMe } from './fixtures/auth';
import { stubRuntime } from './fixtures/runtime-config';

// Cores do hub (tokens.css): fundo de cada tema.
const FUNDO_ESCURO = '#0b0f0c';
const FUNDO_CLARO = '#eef3e9';

const fundo = (page: Page) =>
    page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--ft-fundo').trim(),
    );

// AC-0004-04, INV-0004-04.
test.describe('theme choice', () => {
    test.beforeEach(async ({ page }) => {
        await stubRuntime(page);
    });

    test('sistema follows the light system scheme, and changes without reload', async ({
        page,
    }) => {
        await page.emulateMedia({ colorScheme: 'light' });
        await page.goto('/');
        await expect(page.locator('html')).not.toHaveAttribute('data-tema', /.+/);
        expect(await fundo(page)).toBe(FUNDO_CLARO);

        await page.emulateMedia({ colorScheme: 'dark' });
        expect(await fundo(page)).toBe(FUNDO_ESCURO);
    });

    test('escuro stored wins over a light system, and survives a reload', async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('ftech.tema', 'escuro'));
        await page.emulateMedia({ colorScheme: 'light' });
        await page.goto('/');
        await expect(page.locator('html')).toHaveAttribute('data-tema', 'escuro');
        expect(await fundo(page)).toBe(FUNDO_ESCURO);

        await page.reload();
        await expect(page.locator('html')).toHaveAttribute('data-tema', 'escuro');
        expect(await fundo(page)).toBe(FUNDO_ESCURO);
    });

    test('claro stored wins over a dark system', async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('ftech.tema', 'claro'));
        await page.emulateMedia({ colorScheme: 'dark' });
        await page.goto('/');
        await expect(page.locator('html')).toHaveAttribute('data-tema', 'claro');
        expect(await fundo(page)).toBe(FUNDO_CLARO);
    });

    test('an invalid stored value falls back to sistema', async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('ftech.tema', 'roxo'));
        await page.emulateMedia({ colorScheme: 'light' });
        await page.goto('/');
        await expect(page.locator('html')).not.toHaveAttribute('data-tema', /.+/);
        expect(await fundo(page)).toBe(FUNDO_CLARO);
    });
});

// AC-0006-08: o seletor de tema do menu do usuário muda o tema na hora e sobrevive a recarregar.
test.describe('theme selector in the user menu', () => {
    test.beforeEach(async ({ page }) => {
        await stubRuntime(page);
        await chooseUser(page, 'ativo');
        await stubUsersMe(page, 'ativo');
    });

    test('changes the theme at once, and the choice survives a reload', async ({ page }) => {
        await page.emulateMedia({ colorScheme: 'dark' });
        await page.goto('/entrar');
        await signInWithEmail(page);
        await expect(page.getByRole('heading', { name: 'Início', level: 1 })).toBeVisible();

        await page.getByRole('button', { name: 'Menu do usuário' }).click();
        await expect(page.getByRole('radio', { name: 'Sistema' })).toBeChecked();
        await page.getByText('Claro', { exact: true }).click();
        await expect(page.getByRole('radio', { name: 'Claro' })).toBeChecked();
        await expect(page.locator('html')).toHaveAttribute('data-tema', 'claro');
        expect(await fundo(page)).toBe(FUNDO_CLARO);

        // O fake de autenticação guarda a sessão só em memória: recarregar volta a `/entrar`.
        await page.reload();
        await expect(page.locator('html')).toHaveAttribute('data-tema', 'claro');
        expect(await fundo(page)).toBe(FUNDO_CLARO);
        await expect(page).toHaveURL(/\/entrar/);
        await signInWithEmail(page);
        await expect(page.getByRole('heading', { name: 'Início', level: 1 })).toBeVisible();
        await page.getByRole('button', { name: 'Menu do usuário' }).click();
        await expect(page.getByRole('radio', { name: 'Claro' })).toBeChecked();

        await page.getByText('Escuro', { exact: true }).click();
        await expect(page.locator('html')).toHaveAttribute('data-tema', 'escuro');
        expect(await fundo(page)).toBe(FUNDO_ESCURO);
    });
});

const colorScheme = (page: Page) =>
    page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);

// AC-0004-06.
test.describe('color-scheme follows the theme in use', () => {
    test.beforeEach(async ({ page }) => {
        await stubRuntime(page);
    });

    test('escuro chosen gives dark, even with a light system', async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('ftech.tema', 'escuro'));
        await page.emulateMedia({ colorScheme: 'light' });
        await page.goto('/');
        expect(await colorScheme(page)).toBe('dark');
    });

    test('claro chosen gives light, even with a dark system', async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('ftech.tema', 'claro'));
        await page.emulateMedia({ colorScheme: 'dark' });
        await page.goto('/');
        expect(await colorScheme(page)).toBe('light');
    });

    test('sistema follows the emulated prefers-color-scheme', async ({ page }) => {
        await page.emulateMedia({ colorScheme: 'light' });
        await page.goto('/');
        await expect(page.locator('html')).not.toHaveAttribute('data-tema', /.+/);
        expect(await colorScheme(page)).toBe('light');

        await page.emulateMedia({ colorScheme: 'dark' });
        expect(await colorScheme(page)).toBe('dark');
    });
});
