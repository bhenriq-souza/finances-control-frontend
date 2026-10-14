import { expect, test } from '@playwright/test';

import { stubRuntime } from './fixtures/runtime-config';

// AC-0003-05: a aplicação monta com a implementação falsa da porta e a API simulada.
test('the app mounts and, without a session, shows the sign-in page', async ({ page }) => {
    await stubRuntime(page);

    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Entrar no FTech Finance' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'FarmTech' })).toBeVisible();
});

test('without /config.js the fatal configuration screen is shown', async ({ page }) => {
    await page.route('**/config.js', (route) => route.fulfill({ status: 404, body: '' }));

    await page.goto('/');

    await expect(page.getByRole('alert')).toHaveText(
        'Configuração da aplicação ausente. Avise o administrador.',
    );
});
