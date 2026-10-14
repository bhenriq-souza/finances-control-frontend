import { expect, test } from '@playwright/test';

import { chooseUser, signInWithEmail, stubUsersMe, userResponse } from './fixtures/auth';
import { stubRuntime } from './fixtures/runtime-config';

test.beforeEach(async ({ page }) => {
    await stubRuntime(page);
});

// AC-0006-02, INV-0006-01.
test('without a session / leads to /entrar?redirect=%2F, and the active user reaches the home', async ({
    page,
}) => {
    await chooseUser(page, 'ativo');
    let authorization: string | undefined;
    await page.route('**/api/users/me', (route) => {
        authorization = route.request().headers()['authorization'];
        return route.fulfill({ status: 200, json: userResponse('ADMIN') });
    });

    await page.goto('/');
    await expect(page).toHaveURL(/\/entrar\?redirect=%2F$/);
    await expect(page.getByRole('heading', { name: 'Entrar no FTech Finance' })).toBeVisible();

    await signInWithEmail(page);

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Início', level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Menu do usuário' }).click();
    await expect(
        page.getByRole('region', { name: 'Conta do usuário' }).getByText('Administrador'),
    ).toBeVisible();
    expect(authorization).toBe('Bearer fake-token-e2e-ativo');
});

// INV-0006-01: enquanto `/users/me` não responde, nada de `_app` aparece.
test('no _app route renders before /users/me answers with a profile', async ({ page }) => {
    await chooseUser(page, 'ativo');
    let release: () => void = () => undefined;
    const answered = new Promise<void>((resolve) => {
        release = resolve;
    });
    await page.route('**/api/users/me', async (route) => {
        await answered;
        await route.fulfill({ status: 200, json: userResponse('VIEWER') });
    });

    await page.goto('/entrar');
    await signInWithEmail(page);

    await expect(page.getByRole('status', { name: 'Carregando' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Início', level: 1 })).toHaveCount(0);
    release();
    await expect(page.getByRole('heading', { name: 'Início', level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Menu do usuário' }).click();
    await expect(
        page.getByRole('region', { name: 'Conta do usuário' }).getByText('Leitor'),
    ).toBeVisible();
});

// AC-0006-03, INV-0006-02.
test('the user without a profile only sees /aguardando-aprovacao; "Verificar de novo" with a profile leads to /', async ({
    page,
}) => {
    await chooseUser(page, 'sem-perfil');
    let profile: 'BILLER' | null = null;
    await page.route('**/api/users/me', (route) =>
        route.fulfill({ status: 200, json: userResponse(profile) }),
    );

    await page.goto('/entrar');
    await signInWithEmail(page);
    await expect(page).toHaveURL(/\/aguardando-aprovacao$/);
    await expect(page.getByRole('heading', { name: 'Aguardando aprovação' })).toBeVisible();
    // Email verificado: nem o aviso nem "Reenviar email" (AC-0006-12).
    await expect(
        page.getByText('Seu email ainda não foi verificado.', { exact: false }),
    ).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Reenviar email/ })).toHaveCount(0);

    // Ainda sem perfil: continua na tela.
    await page.getByRole('button', { name: 'Verificar de novo' }).click();
    await expect(page.getByText('Seu acesso ainda não foi liberado.')).toBeVisible();
    await expect(page).toHaveURL(/\/aguardando-aprovacao$/);

    profile = 'BILLER';
    await page.getByRole('button', { name: 'Verificar de novo' }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.getByRole('button', { name: 'Menu do usuário' }).click();
    await expect(
        page.getByRole('region', { name: 'Conta do usuário' }).getByText('Lançador'),
    ).toBeVisible();
});

// AC-0006-04, INV-0006-02, ERR-0006-06.
test('with 403 EMAIL_NOT_VERIFIED every _app route leads to /verificar-email; resend is disabled for a minute', async ({
    page,
}) => {
    await page.clock.install();
    await chooseUser(page, 'email-nao-verificado');
    await stubUsersMe(page, 'email-nao-verificado');

    await page.goto('/entrar');
    await signInWithEmail(page);
    await expect(page).toHaveURL(/\/verificar-email$/);
    await expect(page.getByText('nao-verificado@example.com')).toBeVisible();

    // "Já verifiquei" com o backend ainda dizendo não verificado: fica, com aviso.
    await page.getByRole('button', { name: 'Já verifiquei' }).click();
    await expect(page.getByRole('status')).toContainText('Seu email ainda não foi verificado.');
    await expect(page).toHaveURL(/\/verificar-email$/);

    const resend = page.getByRole('button', { name: /Reenviar email/ });
    await resend.click();
    await expect(page.getByText('Enviamos um novo email de verificação.')).toBeVisible();
    await expect(resend).toBeDisabled();
    await expect(resend).toHaveText('Reenviar email (60 s)');

    await page.clock.runFor(30_000);
    await expect(resend).toBeDisabled();
    await expect(resend).toHaveText('Reenviar email (30 s)');

    await page.clock.runFor(30_000);
    await expect(resend).toBeEnabled();
    await expect(resend).toHaveText('Reenviar email');
});

// INV-0006-02: com a conta em um estado, a outra tela de estado não é alcançável.
test('the account-state pages and the public pages require the right session', async ({ page }) => {
    await chooseUser(page, 'nenhum');

    await page.goto('/aguardando-aprovacao');
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Faguardando-aprovacao$/);

    await page.goto('/verificar-email');
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fverificar-email$/);
});

test('"Sair" on an account-state page goes back to /entrar', async ({ page }) => {
    await chooseUser(page, 'sem-perfil');
    await stubUsersMe(page, 'sem-perfil');

    await page.goto('/entrar');
    await signInWithEmail(page);
    await expect(page).toHaveURL(/\/aguardando-aprovacao$/);

    await page.getByRole('button', { name: 'Sair' }).click();
    await expect(page).toHaveURL(/\/entrar$/);

    // Sem sessão, `/` volta a pedir login.
    await page.goto('/');
    await expect(page).toHaveURL(/\/entrar\?redirect=%2F$/);
});

// AC-0006-11, AC-0006-12, ERR-0006-06.
test('sign-up with a failed verification email still reaches the guard; /aguardando-aprovacao offers "Reenviar email" while unverified', async ({
    page,
}) => {
    await page.clock.install();
    await chooseUser(page, 'nenhum', { 'ftech.e2e.erro-email-cadastro': 'auth/too-many-requests' });
    let emailVerified = false;
    let authorizations: (string | undefined)[] = [];
    await page.route('**/api/users/me', (route) => {
        authorizations.push(route.request().headers()['authorization']);
        const body = userResponse(null);
        return route.fulfill({ status: 200, json: { data: { ...body.data, emailVerified } } });
    });

    await page.goto('/criar-conta');
    await page.getByLabel('Nome').fill('Nova Pessoa');
    await page.getByLabel('Email').fill('nova@example.com');
    await page.getByLabel('Senha', { exact: true }).fill('12345678');
    await page.getByLabel('Confirme a senha').fill('12345678');
    await page.getByRole('button', { name: 'Criar conta' }).click();

    // A falha do email não fica no formulário: o cadastro segue para a guarda de `_app`.
    await expect(page).toHaveURL(/\/aguardando-aprovacao$/);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(
        page.getByText('Seu email ainda não foi verificado.', { exact: false }),
    ).toBeVisible();

    const resend = page.getByRole('button', { name: /Reenviar email/ });
    await resend.click();
    await expect(page.getByText('Enviamos um novo email de verificação.')).toBeVisible();
    await expect(resend).toBeDisabled();
    await expect(resend).toHaveText('Reenviar email (60 s)');
    await page.clock.runFor(60_000);
    await expect(resend).toBeEnabled();
    await expect(resend).toHaveText('Reenviar email');

    // Verificado pelo link: "Verificar de novo" consulta `/users/me` de novo e o aviso some.
    emailVerified = true;
    authorizations = [];
    await page.getByRole('button', { name: 'Verificar de novo' }).click();
    await expect(page.getByText('Seu acesso ainda não foi liberado.')).toBeVisible();
    await expect(
        page.getByText('Seu email ainda não foi verificado.', { exact: false }),
    ).toHaveCount(0);
    await expect(resend).toHaveCount(0);
    expect(authorizations).toEqual(['Bearer fake-token-e2e-novo']);
});
