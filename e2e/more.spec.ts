import { expect, test } from '@playwright/test';

import { chooseUser, signInWithEmail, stubUsersMe } from './fixtures/auth';
import { stubRuntime } from './fixtures/runtime-config';

// AC-0009-08. Com **Contas** (spec 0011, `slot: 'mais'`) visível a todo perfil, aqui se prova o caso
// "com um item" e o redirecionamento; o caso "sem nenhum" é provado em
// `src/app/shell/{navigation,app-shell,more-page}.test.*`.

test.beforeEach(async ({ page }) => {
    await stubRuntime(page);
    await chooseUser(page, 'ativo');
    await stubUsersMe(page, 'ativo');
});

test('with a visible mais item, the bottom bar shows Mais and the sidebar does not', async ({
    page,
}, testInfo) => {
    await page.goto('/entrar');
    await signInWithEmail(page);
    await expect(page.getByRole('heading', { name: 'Olá, Ana Souza' })).toBeVisible();

    const nav = page.getByRole('navigation', { name: 'Principal' });
    await expect(nav.getByRole('link', { name: 'Início' })).toBeVisible();
    if (testInfo.project.name === 'desktop') {
        await expect(nav.getByRole('link', { name: 'Mais' })).toBeHidden();
        await expect(nav.getByRole('link', { name: 'Contas' })).toBeVisible();
    } else {
        await expect(nav.getByRole('link', { name: 'Mais' })).toBeVisible();
        await expect(nav.getByRole('link', { name: 'Contas' })).toBeHidden();
    }
});

test('/mais redirects to / on desktop and shows the Mais page on phone and tablet', async ({
    page,
}, testInfo) => {
    await page.goto(`/entrar?redirect=${encodeURIComponent('/mais')}`);
    await signInWithEmail(page);

    if (testInfo.project.name === 'desktop') {
        await expect(page.getByRole('heading', { name: 'Olá, Ana Souza' })).toBeVisible();
        await expect(page).toHaveURL(/\/$/);
        await expect(page.getByRole('heading', { name: 'Mais' })).toHaveCount(0);
    } else {
        await expect(page.getByRole('heading', { name: 'Mais' })).toBeVisible();
        await expect(page).toHaveURL(/\/mais$/);
        const more = page.getByRole('navigation', { name: 'Mais' });
        await expect(more.getByRole('link', { name: 'Contas' })).toHaveAttribute('href', '/contas');
        // A página fica dentro do shell, com a navegação principal.
        await expect(
            page
                .getByRole('navigation', { name: 'Principal' })
                .getByRole('link', { name: 'Início' }),
        ).toBeVisible();
    }
});

test('/mais follows a resize to desktop back to /', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'desktop', 'the page is never shown on desktop');
    await page.goto(`/entrar?redirect=${encodeURIComponent('/mais')}`);
    await signInWithEmail(page);
    await expect(page.getByRole('heading', { name: 'Mais' })).toBeVisible();

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByRole('heading', { name: 'Olá, Ana Souza' })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
});
