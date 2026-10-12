import { expect, test } from '@playwright/test';

import { stubRuntime } from './fixtures/runtime-config';

// AC-0003-05: com a implementação falsa da porta e `/api/users/me` simulado.
test('the spike page shows the status and body of /api/users/me after email login', async ({
    page,
}) => {
    await stubRuntime(page);
    await page.addInitScript(() => {
        localStorage.setItem('ftech.e2e.usuario', 'ativo');
    });
    let authorization: string | undefined;
    await page.route('**/api/users/me', (route) => {
        authorization = route.request().headers()['authorization'];
        return route.fulfill({ status: 200, json: { id: 'u1', profile: 'ADMIN' } });
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: /spike de login/ })).toBeVisible();
    await page.getByLabel('Email').fill('ativo@example.com');
    await page.getByLabel('Senha').fill('qualquer');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();

    await expect(page.getByTestId('spike-email')).toHaveText('ativo@example.com');
    await expect(page.getByTestId('spike-email-verified')).toHaveText('true');
    await expect(page.getByTestId('spike-me-status')).toHaveText('200');
    await expect(page.getByTestId('spike-me-body')).toContainText('"profile":"ADMIN"');
    expect(authorization).toBe('Bearer fake-token-e2e-ativo');

    await page.getByRole('button', { name: 'Sair' }).click();
    await expect(page.getByRole('button', { name: 'Entrar com Google' })).toBeVisible();
});

test('the spike page shows the raw auth error when login fails', async ({ page }) => {
    await stubRuntime(page);

    await page.goto('/');
    await page.getByLabel('Email').fill('x@example.com');
    await page.getByLabel('Senha').fill('qualquer');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();

    await expect(page.getByTestId('spike-error')).toContainText('auth/invalid-credential');
});

test('without /config.js the fatal configuration screen is shown', async ({ page }) => {
    await page.route('**/config.js', (route) => route.fulfill({ status: 404, body: '' }));

    await page.goto('/');

    await expect(page.getByRole('alert')).toHaveText(
        'Configuração da aplicação ausente. Avise o administrador.',
    );
});
