import { expect, test } from '@playwright/test';

import { stubRuntime } from './fixtures/runtime-config';

// Até a T-0003-02, `/` é a página provisória com o nome do produto e o ambiente da configuração.
test('the provisional home renders the product name and the runtime environment', async ({
    page,
}) => {
    await stubRuntime(page);

    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'FTech Finance' })).toBeVisible();
    await expect(page.getByTestId('environment')).toHaveText('local');
});

test('without /config.js the fatal configuration screen is shown', async ({ page }) => {
    await page.route('**/config.js', (route) => route.fulfill({ status: 404, body: '' }));

    await page.goto('/');

    await expect(page.getByRole('alert')).toHaveText(
        'Configuração da aplicação ausente. Avise o administrador.',
    );
});
