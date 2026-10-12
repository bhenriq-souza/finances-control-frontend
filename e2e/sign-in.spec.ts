import { expect, test } from '@playwright/test';

import { chooseUser, signInWithEmail, stubUsersMe, userResponse } from './fixtures/auth';
import { stubRuntime } from './fixtures/runtime-config';

test.beforeEach(async ({ page }) => {
    await stubRuntime(page);
});

// ERR-0006-01, INV-0006-05.
test('wrong email or password shows the catalog message and keeps the email, not the password', async ({
    page,
}) => {
    await chooseUser(page, 'nenhum');

    await page.goto('/entrar');
    await page.getByLabel('Email').fill('quem@example.com');
    await page.getByLabel('Senha').fill('senha-errada');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();

    await expect(page.getByRole('alert')).toHaveText('Email ou senha incorretos.');
    await expect(page.getByText(/auth\/|Firebase/)).toHaveCount(0);
    await expect(page.getByLabel('Email')).toHaveValue('quem@example.com');
    await expect(page.getByLabel('Senha')).toHaveValue('');
});

test('the form validates the fields in pt-BR before calling the provider', async ({ page }) => {
    await page.goto('/entrar');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();

    const email = page.getByLabel('Email');
    await expect(email).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('Informe um email válido.')).toBeVisible();
    await expect(page.getByText('Informe a senha.')).toBeVisible();
});

// ERR-0006-02.
test('a blocked Google popup shows the catalog message', async ({ page }) => {
    await chooseUser(page, 'ativo', { 'ftech.e2e.erro-google': 'auth/popup-blocked' });

    await page.goto('/entrar');
    await page.getByRole('button', { name: 'Entrar com Google' }).click();

    await expect(page.getByRole('alert')).toHaveText(
        'O navegador bloqueou a janela do Google. Permita pop-ups e tente de novo.',
    );
});

// ERR-0006-03.
test('a Google popup closed by the user shows nothing', async ({ page }) => {
    await chooseUser(page, 'ativo', { 'ftech.e2e.erro-google': 'auth/popup-closed-by-user' });

    await page.goto('/entrar');
    await page.getByRole('button', { name: 'Entrar com Google' }).click();

    await expect(page.getByRole('button', { name: 'Entrar com Google' })).toBeEnabled();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page).toHaveURL(/\/entrar$/);
});

test('Google sign-in with the active user reaches the home', async ({ page }) => {
    await chooseUser(page, 'ativo');
    await stubUsersMe(page, 'ativo');

    await page.goto('/entrar');
    await page.getByRole('button', { name: 'Entrar com Google' }).click();

    await expect(page.getByRole('heading', { name: 'Olá, Ana Souza' })).toBeVisible();
});

// ERR-0006-04: rede ou 5xx em `/users/me` — tela de erro, sessão mantida, "Tentar de novo".
test('a 5xx on /users/me shows the error screen and "Tentar de novo" keeps the session', async ({
    page,
}) => {
    await chooseUser(page, 'ativo');
    let healthy = false;
    await page.route('**/api/users/me', (route) =>
        healthy
            ? route.fulfill({ status: 200, json: userResponse('ADMIN') })
            : route.fulfill({
                  status: 500,
                  json: { error: { code: 'INTERNAL_ERROR', message: 'boom' } },
              }),
    );

    await page.goto('/entrar');
    await signInWithEmail(page);

    await expect(page.getByRole('alert')).toHaveText(
        'Algo deu errado do nosso lado. Tente de novo em instantes.',
        { timeout: 15_000 },
    );
    healthy = true;
    await page.getByRole('button', { name: 'Tentar de novo' }).click();
    await expect(page.getByRole('heading', { name: 'Olá, Ana Souza' })).toBeVisible();
});

test('a network failure on /users/me shows the NETWORK_ERROR message', async ({ page }) => {
    await chooseUser(page, 'ativo');
    await page.route('**/api/users/me', (route) => route.abort('internetdisconnected'));

    await page.goto('/entrar');
    await signInWithEmail(page);

    await expect(page.getByRole('alert')).toHaveText(
        'Sem conexão com o servidor. Verifique a rede e tente de novo.',
        { timeout: 15_000 },
    );
    await expect(page.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
});

// ERR-0006-05.
test('AUTH_UNAVAILABLE on /users/me shows its catalog message on the same screen', async ({
    page,
}) => {
    await chooseUser(page, 'ativo');
    await page.route('**/api/users/me', (route) =>
        route.fulfill({
            status: 503,
            json: { error: { code: 'AUTH_UNAVAILABLE', message: 'firebase down' } },
        }),
    );

    await page.goto('/entrar');
    await signInWithEmail(page);

    await expect(page.getByRole('alert')).toHaveText(
        'Não foi possível validar seu acesso agora. Tente de novo em instantes.',
        { timeout: 15_000 },
    );
});

// ERR-0006-07, INV-0006-06.
for (const external of ['//exemplo.com', 'https://exemplo.com/']) {
    test(`an external redirect (${external}) is ignored and leads to /`, async ({ page }) => {
        await chooseUser(page, 'ativo');
        await stubUsersMe(page, 'ativo');

        await page.goto(`/entrar?redirect=${encodeURIComponent(external)}`);
        await signInWithEmail(page);

        await expect(page.getByRole('heading', { name: 'Olá, Ana Souza' })).toBeVisible();
        await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/);
    });
}

test('an internal redirect is followed after sign-in', async ({ page }) => {
    await chooseUser(page, 'sem-perfil');
    await stubUsersMe(page, 'sem-perfil');

    await page.goto(`/entrar?redirect=${encodeURIComponent('/aguardando-aprovacao')}`);
    await signInWithEmail(page);

    await expect(page).toHaveURL(/\/aguardando-aprovacao$/);
});

test('with a session, the public pages redirect to /', async ({ page }) => {
    await chooseUser(page, 'ativo');
    await stubUsersMe(page, 'ativo');

    await page.goto('/entrar');
    await signInWithEmail(page);
    await expect(page.getByRole('heading', { name: 'Olá, Ana Souza' })).toBeVisible();

    // Navegação dentro da SPA (o fake guarda a sessão em memória).
    for (const path of ['/entrar', '/criar-conta', '/redefinir-senha']) {
        await page.evaluate((to) => {
            window.history.pushState({}, '', to);
            window.dispatchEvent(new PopStateEvent('popstate'));
        }, path);
        await expect(page).toHaveURL(/\/$/);
    }
});

test('password reset always confirms without revealing whether the account exists', async ({
    page,
}) => {
    await page.goto('/entrar');
    await page.getByRole('link', { name: 'Esqueci a senha' }).click();
    await expect(page).toHaveURL(/\/redefinir-senha$/);

    await page.getByLabel('Email').fill('ninguem@example.com');
    await page.getByRole('button', { name: 'Enviar link' }).click();

    await expect(page.getByRole('status')).toHaveText(
        'Se existir uma conta com este email, você vai receber um link para criar uma nova senha.',
    );
});

test('sign-up creates the account and leads to the _app guard', async ({ page }) => {
    await page.route('**/api/users/me', (route) =>
        route.fulfill({
            status: 403,
            json: { error: { code: 'EMAIL_NOT_VERIFIED', message: 'not verified' } },
        }),
    );

    await page.goto('/entrar');
    await page.getByRole('link', { name: 'Criar conta' }).click();
    await expect(page).toHaveURL(/\/criar-conta$/);

    await page.getByLabel('Nome').fill('Nova Pessoa');
    await page.getByLabel('Email').fill('nova@example.com');
    await page.getByLabel('Senha', { exact: true }).fill('12345678');
    await page.getByLabel('Confirme a senha').fill('12345678');
    await page.getByRole('button', { name: 'Criar conta' }).click();

    await expect(page).toHaveURL(/\/verificar-email$/);
    await expect(page.getByText('nova@example.com')).toBeVisible();
});
