import { expect, test, type Page } from '@playwright/test';

import { stubApi, type StubRoute } from './fixtures/api';
import { chooseUser, signInWithEmail, stubUsersMe, type E2EUser } from './fixtures/auth';
import {
    ACADEMIA,
    expenseTypeAlreadyExists,
    expenseTypeResponse,
    expenseTypesResponse,
    MORADIA,
} from './fixtures/data/expense-types';
import { stubRuntime } from './fixtures/runtime-config';

// Tipos de despesa — `/despesas/tipos` (spec 0012, AC-0012-11).

const LIST: StubRoute = { method: 'GET', path: '/expense-types', body: expenseTypesResponse };

async function openPage(page: Page, routes: StubRoute[], user: E2EUser = 'ativo', search = '') {
    await stubRuntime(page);
    await chooseUser(page, user);
    const stub = await stubApi(page, [LIST, ...routes]);
    await stubUsersMe(page, user);
    await page.goto(`/entrar?redirect=${encodeURIComponent(`/despesas/tipos${search}`)}`);
    await signInWithEmail(page);
    // `includeHidden`: com um diálogo aberto pela URL, o resto da página sai da árvore acessível.
    await expect(
        page.getByRole('heading', { name: 'Tipos de despesa', level: 1, includeHidden: true }),
    ).toBeVisible();
    return stub;
}

/** A forma visível da lista: cartões no celular, tabela no tablet e no desktop. */
function visibleList(page: Page, project: string) {
    return project === 'celular'
        ? page.getByRole('list', { name: 'Tipos de despesa' })
        : page.getByRole('table', { name: 'Tipos de despesa' });
}

test('lists the active types by name, cards on the phone and a table from tablet up', async ({
    page,
}, testInfo) => {
    const stub = await openPage(page, []);

    const list = visibleList(page, testInfo.project.name);
    await expect(list).toBeVisible();
    await expect(list.getByText(/^(Mercado|Moradia)$/)).toHaveText(['Mercado', 'Moradia']);
    await expect(list.getByText('Academia')).toHaveCount(0);
    expect(stub.requests.find((r) => r.path === '/expense-types')?.query).toEqual({
        archived: 'true',
    });

    await page.getByRole('button', { name: 'Mostrar arquivados' }).click();
    await expect(page).toHaveURL(/arquivados=1/);
    await expect(list.getByText('Academia')).toBeVisible();
    await expect(list.getByText('Arquivado')).toBeVisible();
});

// AC-0012-11: cria um tipo.
test('creates a type', async ({ page }) => {
    const stub = await openPage(page, [
        {
            method: 'POST',
            path: '/expense-types',
            status: 201,
            body: expenseTypeResponse({ ...MORADIA, name: 'Saúde' }),
        },
    ]);

    await page.getByRole('button', { name: 'Novo tipo' }).click();
    await expect(page).toHaveURL(/novo=1/);
    const dialog = page.getByRole('dialog', { name: 'Novo tipo de despesa' });
    await dialog.getByLabel('Nome').fill('  Saúde ');
    await dialog.getByRole('button', { name: 'Salvar' }).click();

    await expect(dialog).toBeHidden();
    await expect(page).not.toHaveURL(/novo=1/);
    await expect(
        page.getByRole('region', { name: 'Avisos' }).getByText('Tipo de despesa salvo.'),
    ).toBeVisible();
    const post = stub.requests.find((r) => r.method === 'POST');
    expect(post?.body).toEqual({ name: 'Saúde' });
});

// AC-0012-11: `409 EXPENSE_TYPE_ALREADY_EXISTS` marca o nome.
test('marks the name when the type already exists', async ({ page }) => {
    await openPage(
        page,
        [{ method: 'POST', path: '/expense-types', status: 409, body: expenseTypeAlreadyExists }],
        'lancador',
        '?novo=1',
    );

    const dialog = page.getByRole('dialog', { name: 'Novo tipo de despesa' });
    const name = dialog.getByLabel('Nome');
    await name.fill('moradia');
    await dialog.getByRole('button', { name: 'Salvar' }).click();

    await expect(name).toHaveAttribute('aria-invalid', 'true');
    await expect(name).toHaveAccessibleDescription(
        'Já existe um tipo de despesa com esse nome. Escolha outro nome.',
    );
    await expect(name).toHaveValue('moradia');
    await expect(dialog).toBeVisible();
});

// AC-0012-11: renomeia um tipo.
test('renames a type', async ({ page }, testInfo) => {
    const stub = await openPage(page, [
        {
            method: 'PATCH',
            path: `/expense-types/${MORADIA.id}`,
            body: expenseTypeResponse({ ...MORADIA, name: 'Casa' }),
        },
    ]);

    await visibleList(page, testInfo.project.name)
        .getByRole('button', { name: 'Renomear Moradia' })
        .click();
    await expect(page).toHaveURL(new RegExp(`editar=${MORADIA.id}`));
    const dialog = page.getByRole('dialog', { name: 'Renomear tipo de despesa' });
    await expect(dialog.getByLabel('Nome')).toHaveValue('Moradia');
    await dialog.getByLabel('Nome').fill('Casa');
    await dialog.getByRole('button', { name: 'Salvar' }).click();

    await expect(dialog).toBeHidden();
    await expect(
        page.getByRole('region', { name: 'Avisos' }).getByText('Tipo de despesa renomeado.'),
    ).toBeVisible();
    expect(stub.requests.find((r) => r.method === 'PATCH')?.body).toEqual({ name: 'Casa' });
});

// AC-0012-11: arquiva um tipo; desarquiva outro.
test('archives and unarchives a type', async ({ page }, testInfo) => {
    const stub = await openPage(
        page,
        [
            {
                method: 'POST',
                path: `/expense-types/${MORADIA.id}/archive`,
                body: expenseTypeResponse({ ...MORADIA, archivedAt: '2026-10-12T12:00:00Z' }),
            },
            {
                method: 'DELETE',
                path: `/expense-types/${ACADEMIA.id}/archive`,
                body: expenseTypeResponse({ ...ACADEMIA, archivedAt: null }),
            },
        ],
        'ativo',
        '?arquivados=1',
    );
    const list = visibleList(page, testInfo.project.name);
    const notices = page.getByRole('region', { name: 'Avisos' });

    await list.getByRole('button', { name: 'Arquivar Moradia' }).click();
    await expect(notices.getByText('Tipo arquivado.')).toBeVisible();

    await list.getByRole('button', { name: 'Desarquivar Academia' }).click();
    await expect(notices.getByText('Tipo desarquivado.')).toBeVisible();

    const writes = stub.requests.filter((r) => r.method !== 'GET').map((r) => r.method + r.path);
    expect(writes).toEqual([
        `POST/expense-types/${MORADIA.id}/archive`,
        `DELETE/expense-types/${ACADEMIA.id}/archive`,
    ]);
});

// INV-0009-03: o leitor vê a lista sem nenhum controle de escrita, e `?novo=1` não abre nada.
test('the leitor sees no write control and ?novo=1 opens nothing', async ({ page }, testInfo) => {
    await openPage(page, [], 'leitor', '?novo=1');

    await expect(visibleList(page, testInfo.project.name).getByText('Moradia')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Novo tipo' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^(Renomear|Arquivar)/ })).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
});
