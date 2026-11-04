import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { chooseUser, signInWithEmail, type E2EUser } from './fixtures/auth';
import { stubApi, type StubRoute } from './fixtures/api';
import { BANKS } from './fixtures/data/accounts';
import { PENDING_USER } from './fixtures/data/users';
import { expenseTypesResponse } from './fixtures/data/expense-types';
import { earningTypesList } from './fixtures/data/earning-types';
import { stubRuntime } from './fixtures/runtime-config';
import { stubUsersBackend, type UsersBackend } from './fixtures/users-backend';

// Spec 0021: espaços na aprovação e no menu.

const CATALOG_ROUTES: StubRoute[] = [
    { method: 'GET', path: '/banks', body: { data: BANKS } },
    { method: 'GET', path: '/expense-types', body: expenseTypesResponse },
    { method: 'GET', path: '/earning-types', body: earningTypesList() },
];

/** Entra como `user` e abre `path`, com usuários, espaços e catálogos simulados. */
async function signInTo(page: Page, user: E2EUser, path: string) {
    await stubRuntime(page);
    await chooseUser(page, user);
    const api = await stubApi(page, CATALOG_ROUTES);
    const backend = await stubUsersBackend(page, user);
    await page.goto(`/entrar?redirect=${encodeURIComponent(path)}`);
    await signInWithEmail(page);
    return { backend, api };
}

const isPhone = (testInfo: TestInfo) => testInfo.project.name === 'celular';

function entries(page: Page, testInfo: TestInfo) {
    return isPhone(testInfo)
        ? page.getByRole('list', { name: 'Usuários da plataforma' }).getByRole('listitem')
        : page
              .getByRole('table', { name: 'Usuários da plataforma' })
              .getByRole('row')
              .filter({ has: page.getByRole('cell') });
}

const entry = (page: Page, testInfo: TestInfo, name: string) =>
    entries(page, testInfo).filter({ hasText: name });

const usersRequests = (backend: UsersBackend) =>
    backend.requests.filter(({ path }) => path === '/users' || path === '/workspaces');

// AC-0021-01, INV-0021-01: a marca de admin da plataforma abre a tela; o perfil `ADMIN` não.
test('the platform admin sees the Espaço column on /usuarios', async ({ page }, testInfo) => {
    await signInTo(page, 'ativo', '/usuarios');

    await expect(page.getByRole('heading', { name: 'Usuários', level: 1 })).toBeVisible();
    await expect(entry(page, testInfo, 'Lucas Martins')).toContainText('Principal');
    await expect(entry(page, testInfo, 'Paula Nunes')).not.toContainText('Principal');
});

for (const user of ['lancador', 'leitor', 'admin-de-espaco'] as const) {
    test(`${user} has no Usuários item and /usuarios shows no access without GET /users`, async ({
        page,
    }) => {
        const { backend } = await signInTo(page, user, '/usuarios');

        await expect(page.getByText('Seu perfil não dá acesso a esta tela.')).toBeVisible();
        const nav = page.getByRole('navigation', { name: 'Principal' });
        await expect(nav.getByRole('link', { name: 'Usuários', includeHidden: true })).toHaveCount(
            0,
        );
        expect(usersRequests(backend)).toEqual([]);
    });
}

// AC-0021-02, INV-0021-03: espaço novo envia sempre `profile: 'ADMIN'`.
test('approving into a new space sends the ADMIN body and updates the row', async ({
    page,
}, testInfo) => {
    const { backend } = await signInTo(page, 'ativo', '/usuarios');
    await entry(page, testInfo, 'Paula Nunes')
        .getByRole('button', { name: 'Liberar acesso de Paula Nunes' })
        .click();

    const dialog = page.getByRole('dialog', { name: 'Liberar acesso de Paula Nunes' });
    await expect(dialog.getByRole('radio', { name: 'Novo espaço' })).toBeChecked();
    await expect(dialog.getByLabel('Nome do espaço')).toHaveValue('Paula Nunes');
    await expect(dialog.getByText('Paula Nunes será o administrador deste espaço.')).toBeVisible();
    await dialog.getByLabel('Nome do espaço').fill('Casa da Paula');
    await dialog.getByRole('button', { name: 'Salvar' }).click();

    await expect(dialog).toBeHidden();
    expect(backend.requests).toContainEqual({
        method: 'PATCH',
        path: `/users/${PENDING_USER.id}/profile`,
        body: { profile: 'ADMIN', newWorkspace: { name: 'Casa da Paula' } },
    });
    await expect(entry(page, testInfo, 'Paula Nunes')).toContainText('Administrador');
    await expect(entry(page, testInfo, 'Paula Nunes')).toContainText('Casa da Paula');
    await expect(
        page
            .getByRole('region', { name: 'Avisos' })
            .getByText('Acesso de Paula Nunes liberado no espaço Casa da Paula.'),
    ).toBeVisible();
});

// AC-0021-03, INV-0021-03: espaço existente envia `{ profile, workspaceId }`.
test('approving into an existing space sends the profile and the workspace id', async ({
    page,
}, testInfo) => {
    const { backend } = await signInTo(page, 'ativo', '/usuarios');
    await entry(page, testInfo, 'Paula Nunes')
        .getByRole('button', { name: 'Liberar acesso de Paula Nunes' })
        .click();

    const dialog = page.getByRole('dialog', { name: 'Liberar acesso de Paula Nunes' });
    await dialog.getByRole('radio', { name: 'Espaço existente' }).check();
    await expect(dialog.getByRole('button', { name: 'Salvar' })).toBeDisabled();
    await dialog
        .getByLabel('Espaço', { exact: true })
        .selectOption({ label: 'Principal (2 membros)' });
    await dialog.getByRole('radio', { name: /Leitor/ }).check();
    await dialog.getByRole('button', { name: 'Salvar' }).click();

    await expect(dialog).toBeHidden();
    expect(backend.requests).toContainEqual({
        method: 'PATCH',
        path: `/users/${PENDING_USER.id}/profile`,
        body: { profile: 'VIEWER', workspaceId: '00000000-0000-4000-8000-0000000000a1' },
    });
    await expect(entry(page, testInfo, 'Paula Nunes')).toContainText('Leitor');
    await expect(entry(page, testInfo, 'Paula Nunes')).toContainText('Principal');
});

// AC-0021-06, AC-0021-07: o painel de espaços e o nome no menu do usuário.
test('renaming the own workspace updates the user menu', async ({ page }) => {
    const { backend } = await signInTo(page, 'ativo', '/usuarios?espacos=1');

    const panel = page.getByRole('dialog', { name: 'Espaços' });
    await expect(panel).toBeVisible();
    const list = panel
        .getByRole('table', { name: 'Espaços' })
        .or(panel.getByRole('list', { name: 'Espaços' }));
    await expect(list.filter({ visible: true })).toContainText('Principal');
    await panel
        .getByRole('button', { name: 'Renomear Principal' })
        .filter({ visible: true })
        .click();
    const field = panel.getByLabel('Nome do espaço Principal').filter({ visible: true });
    await field.fill('Matriz');
    await panel.getByRole('button', { name: 'Salvar' }).filter({ visible: true }).click();

    await expect(
        page.getByRole('region', { name: 'Avisos' }).getByText('Espaço renomeado para Matriz.'),
    ).toBeVisible();
    expect(backend.requests).toContainEqual({
        method: 'PATCH',
        path: '/workspaces/00000000-0000-4000-8000-0000000000a1',
        body: { name: 'Matriz' },
    });
    await panel.getByRole('button', { name: 'Fechar' }).click();
    await page.getByRole('button', { name: 'Menu do usuário' }).click();
    await expect(page.getByRole('region', { name: 'Conta do usuário' })).toContainText(
        'Espaço: Matriz',
    );
});

test('the user menu shows the workspace of a member', async ({ page }) => {
    await signInTo(page, 'lancador', '/');
    await page.getByRole('button', { name: 'Menu do usuário' }).click();
    await expect(page.getByRole('region', { name: 'Conta do usuário' })).toContainText(
        'Espaço: Principal',
    );
});

// AC-0021-08, INV-0021-02: bancos e tipos só escrevem com a marca de admin da plataforma.
const CATALOGS = [
    { path: '/contas/bancos', heading: 'Bancos', create: 'Novo banco' },
    { path: '/despesas/tipos', heading: 'Tipos de despesa', create: 'Novo tipo' },
    { path: '/receitas/tipos', heading: 'Tipos de receita', create: 'Novo tipo' },
] as const;

for (const user of ['lancador', 'admin-de-espaco'] as const) {
    for (const { path, heading, create } of CATALOGS) {
        test(`${user} reads ${path} without write controls and ?novo=1 opens nothing`, async ({
            page,
        }) => {
            await signInTo(page, user, `${path}?novo=1`);

            await expect(
                page.getByRole('heading', { name: heading, level: 1, includeHidden: true }),
            ).toBeVisible();
            await expect(page.getByRole('dialog')).toHaveCount(0);
            await expect(page.getByRole('button', { name: create })).toHaveCount(0);
            await expect(
                page.getByRole('button', { name: /^(Editar|Renomear|Arquivar|Desarquivar)/ }),
            ).toHaveCount(0);
        });
    }
}

test('the platform admin sees the write controls on the catalogs', async ({ page }) => {
    await signInTo(page, 'ativo', '/contas/bancos');
    await expect(page.getByRole('button', { name: 'Novo banco' })).toBeVisible();
});

// AC-0021-09: o diálogo de aprovação segue o `FormDialog` e a coluna Espaço aparece nos três tamanhos.
test('the approval dialog follows FormDialog and the Espaço column fits each size', async ({
    page,
}, testInfo) => {
    await signInTo(page, 'ativo', '/usuarios');

    if (isPhone(testInfo)) {
        await expect(entry(page, testInfo, 'Lucas Martins')).toContainText(
            'lancador@example.com · Principal',
        );
    } else {
        await expect(
            page
                .getByRole('table', { name: 'Usuários da plataforma' })
                .getByRole('columnheader', { name: 'Espaço' }),
        ).toBeVisible();
    }

    await entry(page, testInfo, 'Paula Nunes')
        .getByRole('button', { name: 'Liberar acesso de Paula Nunes' })
        .click();
    const dialog = page.getByRole('dialog', { name: 'Liberar acesso de Paula Nunes' });
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    const viewport = page.viewportSize();
    const box = await dialog.boundingBox();
    if (!viewport || !box) throw new Error('no viewport or dialog box');
    if (isPhone(testInfo)) {
        expect(box).toEqual({ x: 0, y: 0, width: viewport.width, height: viewport.height });
    } else {
        expect(box.width).toBeLessThanOrEqual(560);
        expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(1);
    }
});

// AC-0021-10, ERR-0021-04: admin da plataforma sem espaço.
test('a platform admin without a space reaches the admin screens and gets sem-espaco elsewhere', async ({
    page,
}, testInfo) => {
    const { backend } = await signInTo(page, 'admin-sem-espaco', '/');

    // `/` leva a `/usuarios`, que lista os usuários.
    await expect(page).toHaveURL(/\/usuarios$/);
    await expect(page.getByRole('heading', { name: 'Usuários', level: 1 })).toBeVisible();
    await expect(entries(page, testInfo).first()).toBeVisible();
    expect(usersRequests(backend).some(({ path }) => path === '/users')).toBe(true);

    // A navegação mostra só Usuários e os catálogos.
    const nav = page.getByRole('navigation', { name: 'Principal' });
    await expect(nav.getByRole('link', { name: 'Início', includeHidden: true })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Despesas', includeHidden: true })).toHaveCount(0);
    await expect(
        nav.getByRole('link', { name: /^(Usuários|Mais)$/, includeHidden: false }).first(),
    ).toBeVisible();

    // O menu do usuário não mostra a linha do espaço.
    await page.getByRole('button', { name: 'Menu do usuário' }).click();
    const menu = page.getByRole('region', { name: 'Conta do usuário' });
    await expect(menu).toBeVisible();
    await expect(menu).not.toContainText('Espaço:');
    await page.keyboard.press('Escape');
});

// ERR-0021-04: telas de domínio mostram o estado sem-espaco, sem chamar a API de domínio.
test('a platform admin without a space gets sem-espaco on a domain screen', async ({ page }) => {
    const { api } = await signInTo(page, 'admin-sem-espaco', '/despesas');

    await expect(page.getByRole('link', { name: 'Ir para Usuários' })).toBeVisible();
    await expect(
        page.getByText(
            'Você ainda não está em um espaço. Para ver e lançar registros, entre em um espaço pela tela Usuários.',
        ),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/despesas/);
    await expect(page).not.toHaveURL(/aguardando-aprovacao/);
    expect(api.requests.filter(({ path }) => path.startsWith('/expenses'))).toEqual([]);

    await page.getByRole('link', { name: 'Ir para Usuários' }).click();
    await expect(page).toHaveURL(/\/usuarios$/);
});

test('a platform admin without a space writes the catalogs', async ({ page }) => {
    await signInTo(page, 'admin-sem-espaco', '/contas/bancos');

    await expect(page.getByRole('button', { name: 'Novo banco' })).toBeVisible();
    await expect(page).not.toHaveURL(/aguardando-aprovacao/);
});
