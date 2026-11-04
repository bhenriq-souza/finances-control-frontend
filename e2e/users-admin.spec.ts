import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { chooseUser, signInWithEmail, type E2EUser } from './fixtures/auth';
import { BILLER_USER, PENDING_USER } from './fixtures/data/users';
import { stubRuntime } from './fixtures/runtime-config';
import { stubUsersBackend } from './fixtures/users-backend';

// Specs 0010 e 0021: `/usuarios`, só o admin da plataforma.

async function signInTo(page: Page, user: E2EUser, path: string) {
    await stubRuntime(page);
    await chooseUser(page, user);
    const backend = await stubUsersBackend(page, user);
    await page.goto(`/entrar?redirect=${encodeURIComponent(path)}`);
    await signInWithEmail(page);
    return backend;
}

const isPhone = (testInfo: TestInfo) => testInfo.project.name === 'celular';

/** As entradas da lista: cartões no celular, linhas da tabela (sem o cabeçalho) no resto. */
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

// AC-0010-01, AC-0010-07: o ADMIN vê a lista, os sem perfil primeiro, em cartões ou tabela.
test('ADMIN sees the users with the pending ones first, as cards or a table', async ({
    page,
}, testInfo) => {
    const backend = await signInTo(page, 'ativo', '/usuarios');

    await expect(page.getByRole('heading', { name: 'Usuários', level: 1 })).toBeVisible();
    const list = page.getByRole('list', { name: 'Usuários da plataforma' });
    const table = page.getByRole('table', { name: 'Usuários da plataforma' });
    if (isPhone(testInfo)) {
        await expect(list).toBeVisible();
        await expect(table).toBeHidden();
    } else {
        await expect(table).toBeVisible();
        await expect(list).toBeHidden();
        const since = table.getByRole('columnheader', { name: 'Desde' });
        if (testInfo.project.name === 'desktop') await expect(since).toBeVisible();
        else await expect(since).toBeHidden();
    }

    const rows = entries(page, testInfo);
    await expect(rows).toHaveCount(4);
    await expect(rows.nth(0)).toContainText('Paula Nunes');
    await expect(rows.nth(1)).toContainText('Rafael Costa');
    await expect(rows.nth(2)).toContainText('Ana Souza');
    await expect(rows.nth(3)).toContainText('Lucas Martins');
    await expect(rows.nth(0)).toContainText('Aguardando');
    await expect(rows.nth(1)).toContainText('Email não verificado');
    await expect(rows.nth(3)).toContainText('Lançador');
    expect(backend.requests.filter((r) => r.method === 'GET' && r.path === '/users')).toHaveLength(
        1,
    );

    // AC-0010-05: a própria linha mostra "Você" e nenhuma ação.
    const own = entry(page, testInfo, 'Ana Souza');
    await expect(own).toContainText('Você');
    await expect(own.getByRole('button')).toHaveCount(0);

    // A ação do cartão é um botão de 44px.
    const action = entry(page, testInfo, 'Paula Nunes').getByRole('button', {
        name: 'Liberar acesso de Paula Nunes',
    });
    const box = await action.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
});

// INV-0010-01: o item **Usuários** só para ADMIN — na lateral do desktop, na página Mais abaixo.
test('the Usuários navigation item leads ADMIN to the list', async ({ page }, testInfo) => {
    await signInTo(page, 'ativo', '/');
    await expect(page.getByRole('heading', { name: 'Início', level: 1 })).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Principal' });

    if (testInfo.project.name === 'desktop') {
        await nav.getByRole('link', { name: 'Usuários' }).click();
    } else {
        await expect(nav.getByRole('link', { name: 'Usuários' })).toBeHidden();
        await nav.getByRole('link', { name: 'Mais' }).click();
        await page
            .getByRole('navigation', { name: 'Mais' })
            .getByRole('link', { name: 'Usuários' })
            .click();
    }

    await expect(page).toHaveURL(/\/usuarios$/);
    await expect(entries(page, testInfo)).toHaveCount(4);
});

// AC-0010-01, INV-0010-01: lançador e leitor não veem o item nem a lista, e não chamam a API.
for (const user of ['lancador', 'leitor'] as const) {
    test(`${user} has no Usuários item and /usuarios shows no access without GET /users`, async ({
        page,
    }, testInfo) => {
        const backend = await signInTo(page, user, '/usuarios');

        await expect(page.getByText('Seu perfil não dá acesso a esta tela.')).toBeVisible();
        const nav = page.getByRole('navigation', { name: 'Principal' });
        await expect(nav.getByRole('link', { name: 'Usuários', includeHidden: true })).toHaveCount(
            0,
        );
        if (!isPhone(testInfo)) {
            await expect(page.getByRole('table')).toHaveCount(0);
        }
        expect(backend.requests).toEqual([]);
    });
}

// AC-0021-03, INV-0010-03: liberar acesso em espaço existente, com Lançador.
test('granting Lançador in an existing space sends the PATCH and updates the row', async ({
    page,
}, testInfo) => {
    const backend = await signInTo(page, 'ativo', '/usuarios');
    await entry(page, testInfo, 'Paula Nunes')
        .getByRole('button', { name: 'Liberar acesso de Paula Nunes' })
        .click();

    const dialog = page.getByRole('dialog', { name: 'Liberar acesso de Paula Nunes' });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`perfil=${PENDING_USER.id}`));
    await dialog.getByRole('radio', { name: 'Espaço existente' }).check();
    await dialog
        .getByLabel('Espaço', { exact: true })
        .selectOption({ label: 'Principal (2 membros)' });
    await dialog.getByRole('radio', { name: /Lançador/ }).check();
    await dialog.getByRole('button', { name: 'Salvar' }).click();

    await expect(dialog).toBeHidden();
    expect(backend.requests).toContainEqual({
        method: 'PATCH',
        path: `/users/${PENDING_USER.id}/profile`,
        body: { profile: 'BILLER', workspaceId: '00000000-0000-4000-8000-0000000000a1' },
    });
    await expect(entry(page, testInfo, 'Paula Nunes')).toContainText('Lançador');
    await expect(entry(page, testInfo, 'Paula Nunes')).not.toContainText('Aguardando');
    await expect(
        page
            .getByRole('region', { name: 'Avisos' })
            .getByText('Acesso de Paula Nunes liberado no espaço Principal.'),
    ).toBeVisible();
});

// AC-0021-04: remover do espaço pede confirmação, envia DELETE e a linha volta a Aguardando.
test('removing from the space asks for confirmation and turns the row into Aguardando', async ({
    page,
}, testInfo) => {
    const backend = await signInTo(page, 'ativo', '/usuarios');
    await entry(page, testInfo, 'Lucas Martins')
        .getByRole('button', { name: 'Alterar perfil de Lucas Martins' })
        .click();

    const dialog = page.getByRole('dialog', {
        name: 'Alterar perfil de Lucas Martins em Principal',
    });
    await expect(dialog.getByRole('radio', { name: /Lançador/ })).toBeChecked();
    await expect(dialog.getByRole('button', { name: 'Salvar' })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Remover do espaço' }).click();

    const confirm = page.getByRole('alertdialog', { name: 'Remover Lucas Martins do espaço?' });
    await expect(confirm).toContainText(
        'Lucas Martins sai do espaço Principal e volta para a tela de aguardando aprovação. Os registros do espaço continuam lá.',
    );
    await confirm.getByRole('button', { name: 'Remover' }).click();

    await expect(confirm).toBeHidden();
    await expect(dialog).toBeHidden();
    expect(backend.requests).toContainEqual({
        method: 'DELETE',
        path: `/users/${BILLER_USER.id}/profile`,
        body: null,
    });
    await expect(entry(page, testInfo, 'Lucas Martins')).toContainText('Aguardando');
    await expect(
        page
            .getByRole('region', { name: 'Avisos' })
            .getByText('Lucas Martins removido do espaço Principal.'),
    ).toBeVisible();
});

// AC-0021-05: `409 LAST_WORKSPACE_ADMIN` no diálogo, que continua aberto.
test('LAST_WORKSPACE_ADMIN keeps the dialog open with the catalog message', async ({
    page,
}, testInfo) => {
    const backend = await signInTo(page, 'ativo', '/usuarios');
    await entry(page, testInfo, 'Lucas Martins')
        .getByRole('button', { name: 'Alterar perfil de Lucas Martins' })
        .click();
    const dialog = page.getByRole('dialog', {
        name: 'Alterar perfil de Lucas Martins em Principal',
    });
    backend.failNextWrite = { status: 409, code: 'LAST_WORKSPACE_ADMIN' };
    await dialog.getByRole('radio', { name: /Leitor/ }).check();
    await dialog.getByRole('button', { name: 'Salvar' }).click();

    await expect(dialog.getByRole('alert')).toHaveText(
        'Esse espaço ficaria sem administrador. Mantenha ao menos um.',
    );
    await expect(dialog).toBeVisible();
});

// AC-0010-06: o filtro mostra só os sem perfil e sobrevive a recarregar a página.
test('the Aguardando aprovação filter shows only pending users and survives a reload', async ({
    page,
}, testInfo) => {
    await signInTo(page, 'ativo', '/usuarios');
    await page.getByRole('button', { name: 'Aguardando aprovação (2)' }).click();

    await expect(page).toHaveURL(/filtro=aguardando/);
    await expect(entries(page, testInfo)).toHaveCount(2);
    await expect(entry(page, testInfo, 'Lucas Martins')).toHaveCount(0);

    // A sessão do fake de autenticação é só em memória: recarregar sempre pede o login de novo, que
    // volta à mesma URL.
    await page.reload();
    await expect(page).toHaveURL(/\/entrar/);
    await signInWithEmail(page);
    await expect(page).toHaveURL(/\/usuarios\?filtro=aguardando/);
    await expect(page.getByRole('button', { name: 'Aguardando aprovação (2)' })).toHaveAttribute(
        'aria-pressed',
        'true',
    );
    await expect(entries(page, testInfo)).toHaveCount(2);
    await expect(entries(page, testInfo).first()).toContainText('Paula Nunes');
});

// AC-0010-07: o diálogo segue o `FormDialog` — folha cheia no celular, central a partir de `md`.
test('the profile dialog is a full-screen sheet on the phone and centred from tablet up', async ({
    page,
}, testInfo) => {
    await signInTo(page, 'ativo', `/usuarios?perfil=${PENDING_USER.id}`);
    const dialog = page.getByRole('dialog', { name: 'Liberar acesso de Paula Nunes' });
    await expect(dialog).toBeVisible();
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

    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/usuarios$/);
});
