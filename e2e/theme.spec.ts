import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

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
