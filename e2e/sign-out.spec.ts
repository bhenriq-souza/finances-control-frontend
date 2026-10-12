import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { chooseUser, OTHER_PERSON, signInWithEmail, userResponse } from './fixtures/auth';
import { stubRuntime } from './fixtures/runtime-config';

test.beforeEach(async ({ page }) => {
    await stubRuntime(page);
});

const signOutFromMenu = async (page: Page) => {
    await page.getByRole('button', { name: 'Menu do usuário' }).click();
    await page.getByRole('button', { name: 'Sair' }).click();
};

// AC-0006-06, INV-0006-04: sair apaga o cache; o login seguinte consulta `/users/me` de novo e
// nada da pessoa anterior aparece.
test('"Sair" goes to /entrar and the next sign-in shows nothing of the previous user', async ({
    page,
}) => {
    await chooseUser(page, 'ativo');
    let person: 'ana' | 'bruno' = 'ana';
    let calls = 0;
    await page.route('**/api/users/me', (route) => {
        calls += 1;
        return route.fulfill({
            status: 200,
            json: person === 'ana' ? userResponse('ADMIN') : userResponse('VIEWER', OTHER_PERSON),
        });
    });

    await page.goto('/entrar');
    await signInWithEmail(page);
    await expect(page.getByRole('heading', { name: 'Olá, Ana Souza' })).toBeVisible();
    const callsBeforeSignOut = calls;

    await signOutFromMenu(page);
    await expect(page).toHaveURL(/\/entrar$/);
    await expect(page.getByRole('heading', { name: 'Entrar no FTech Finance' })).toBeVisible();

    person = 'bruno';
    await signInWithEmail(page);
    await expect(page.getByRole('heading', { name: 'Olá, Bruno Lima' })).toBeVisible();
    await expect(page.getByText('Leitor')).toBeVisible();
    expect(calls).toBeGreaterThan(callsBeforeSignOut);
    await expect(page.getByText('Ana Souza')).toHaveCount(0);
    await expect(page.getByText('Administrador')).toHaveCount(0);

    await page.getByRole('button', { name: 'Menu do usuário' }).click();
    await expect(page.getByText(OTHER_PERSON.email)).toBeVisible();
    await expect(page.getByText('ativo@example.com')).toHaveCount(0);
    await expect(page.getByText('Ana Souza')).toHaveCount(0);
});

// AC-0006-06 com outro usuário do fake: depois de sair, `sem-perfil` cai na sua tela de estado.
test('after "Sair", another fake user follows its own account state', async ({ page }) => {
    await chooseUser(page, 'ativo');
    let profile: 'ADMIN' | null = 'ADMIN';
    await page.route('**/api/users/me', (route) =>
        route.fulfill({ status: 200, json: userResponse(profile) }),
    );

    await page.goto('/entrar');
    await signInWithEmail(page);
    await expect(page.getByRole('heading', { name: 'Olá, Ana Souza' })).toBeVisible();

    await signOutFromMenu(page);
    await expect(page).toHaveURL(/\/entrar$/);

    await page.evaluate(() => localStorage.setItem('ftech.e2e.usuario', 'sem-perfil'));
    profile = null;
    await signInWithEmail(page);
    await expect(page).toHaveURL(/\/aguardando-aprovacao$/);
    await expect(page.getByText('Ana Souza')).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Principal' })).toHaveCount(0);
});
