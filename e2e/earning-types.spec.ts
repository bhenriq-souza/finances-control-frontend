import { expect, test, type Page } from '@playwright/test';

import { stubApi, type StubRoute } from './fixtures/api';
import { chooseUser, signInWithEmail, stubUsersMe, type E2EUser } from './fixtures/auth';
import {
    BONUS,
    earningTypeAlreadyExists,
    earningTypeBody,
    earningTypesList,
    SALARIO,
} from './fixtures/data/earning-types';
import { stubRuntime } from './fixtures/runtime-config';

// `/receitas/tipos` (spec 0014, padrão de cadastro da spec 0009). AC-0014-08 e, com `leitor`, o
// INV-0009-03.

const LIST: StubRoute = { method: 'GET', path: '/earning-types', body: earningTypesList() };

async function openTypes(
    page: Page,
    {
        user = 'ativo',
        search = '',
        routes = [],
    }: {
        user?: E2EUser;
        search?: string;
        routes?: StubRoute[];
    } = {},
) {
    await stubRuntime(page);
    await chooseUser(page, user);
    const api = await stubApi(page, [LIST, ...routes]);
    await stubUsersMe(page, user);
    await page.goto(`/entrar?redirect=${encodeURIComponent(`/receitas/tipos${search}`)}`);
    await signInWithEmail(page);
    // Com `?novo=1` o diálogo modal abre logo e tira o resto da árvore de acessibilidade.
    await expect(
        page.getByRole('heading', { name: 'Tipos de receita', level: 1, includeHidden: true }),
    ).toBeVisible();
    return api;
}

const notices = (page: Page) => page.getByRole('region', { name: 'Avisos' });

test('lists the active types by name and shows the archived ones with the badge', async ({
    page,
}, testInfo) => {
    const api = await openTypes(page);

    expect(api.requests).toContainEqual(
        expect.objectContaining({
            method: 'GET',
            path: '/earning-types',
            query: { archived: 'true' },
        }),
    );
    // Cartões no celular, tabela no tablet e no desktop (`getByRole` só vê a forma visível).
    const list =
        testInfo.project.name === 'celular'
            ? page.getByRole('list', { name: 'Tipos de receita' })
            : page.getByRole('table', { name: 'Tipos de receita' });
    await expect(list).toBeVisible();
    await expect(list.getByText('Aluguel recebido')).toBeVisible();
    await expect(list.getByText('Salário')).toBeVisible();
    await expect(list.getByText('Bônus')).toHaveCount(0);
    const text = (await list.textContent()) ?? '';
    expect(text.indexOf('Aluguel recebido')).toBeLessThan(text.indexOf('Salário'));

    await page.getByLabel('Mostrar arquivados').check();

    await expect(page).toHaveURL(/[?&]arquivados=1/);
    await expect(list.getByText('Bônus')).toBeVisible();
    await expect(list.getByText('Arquivado')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Desarquivar Bônus' })).toBeVisible();
});

// AC-0014-08: criar.
test('creates a type from Novo tipo', async ({ page }) => {
    const api = await openTypes(page, {
        user: 'lancador',
        routes: [
            {
                method: 'POST',
                path: '/earning-types',
                status: 201,
                body: earningTypeBody({ ...SALARIO, id: SALARIO.id, name: 'Dividendos' }),
            },
        ],
    });

    await page.getByRole('button', { name: 'Novo tipo' }).click();
    await expect(page).toHaveURL(/[?&]novo=1/);
    const dialog = page.getByRole('dialog', { name: 'Novo tipo de receita' });
    await dialog.getByLabel('Nome').fill('Dividendos');
    await dialog.getByRole('button', { name: 'Salvar' }).click();

    await expect(dialog).toBeHidden();
    await expect(notices(page).getByText('Tipo de receita criado.')).toBeVisible();
    await expect(page).not.toHaveURL(/novo=/);
    expect(api.requests).toContainEqual(
        expect.objectContaining({
            method: 'POST',
            path: '/earning-types',
            body: { name: 'Dividendos' },
        }),
    );
});

// AC-0014-08: `409 EARNING_TYPE_ALREADY_EXISTS` marca o nome.
test('409 EARNING_TYPE_ALREADY_EXISTS marks the name and keeps the dialog open', async ({
    page,
}) => {
    await openTypes(page, {
        search: '?novo=1',
        routes: [
            {
                method: 'POST',
                path: '/earning-types',
                status: 409,
                body: earningTypeAlreadyExists,
            },
        ],
    });

    const dialog = page.getByRole('dialog', { name: 'Novo tipo de receita' });
    const name = dialog.getByLabel('Nome');
    await name.fill('Salário');
    await dialog.getByRole('button', { name: 'Salvar' }).click();

    await expect(name).toHaveAccessibleDescription(
        'Já existe um tipo de receita com esse nome. Escolha outro nome.',
    );
    await expect(name).toHaveAttribute('aria-invalid', 'true');
    await expect(name).toHaveValue('Salário');
    await expect(dialog).toBeVisible();
});

// AC-0014-08: renomear.
test('renames a type', async ({ page }) => {
    const api = await openTypes(page, {
        routes: [
            {
                method: 'PATCH',
                path: `/earning-types/${SALARIO.id}`,
                body: earningTypeBody({ ...SALARIO, name: 'Salário CLT' }),
            },
        ],
    });

    await page.getByRole('button', { name: 'Renomear Salário' }).click();
    await expect(page).toHaveURL(new RegExp(`[?&]editar=${SALARIO.id}`));
    const dialog = page.getByRole('dialog', { name: 'Renomear tipo de receita' });
    await expect(dialog.getByLabel('Nome')).toHaveValue('Salário');
    await dialog.getByLabel('Nome').fill('Salário CLT');
    await dialog.getByRole('button', { name: 'Salvar' }).click();

    await expect(dialog).toBeHidden();
    await expect(notices(page).getByText('Tipo de receita renomeado.')).toBeVisible();
    expect(api.requests).toContainEqual(
        expect.objectContaining({
            method: 'PATCH',
            path: `/earning-types/${SALARIO.id}`,
            body: { name: 'Salário CLT' },
        }),
    );
});

// AC-0014-08: arquivar (e desarquivar).
test('archives an active type and unarchives an archived one', async ({ page }) => {
    const api = await openTypes(page, {
        search: '?arquivados=1',
        routes: [
            {
                method: 'POST',
                path: `/earning-types/${SALARIO.id}/archive`,
                body: earningTypeBody({ ...SALARIO, archivedAt: '2026-10-12T12:00:00Z' }),
            },
            {
                method: 'DELETE',
                path: `/earning-types/${BONUS.id}/archive`,
                body: earningTypeBody({ ...BONUS, archivedAt: null }),
            },
        ],
    });

    await page.getByRole('button', { name: 'Arquivar Salário' }).click();
    await expect(notices(page).getByText('Tipo de receita arquivado.')).toBeVisible();
    await page.getByRole('button', { name: 'Desarquivar Bônus' }).click();
    await expect(notices(page).getByText('Tipo de receita desarquivado.')).toBeVisible();

    const writes = api.requests.filter((request) => request.method !== 'GET');
    expect(writes.map(({ method, path }) => `${method} ${path}`)).toEqual([
        `POST /earning-types/${SALARIO.id}/archive`,
        `DELETE /earning-types/${BONUS.id}/archive`,
    ]);
});

// INV-0009-03: com `leitor`, nenhuma ação de escrita e `?novo=1` não abre o formulário.
test('leitor sees the list without write controls and ?novo=1 opens nothing', async ({ page }) => {
    await openTypes(page, { user: 'leitor', search: '?novo=1' });
    await expect(page.getByText('Aluguel recebido').filter({ visible: true })).toBeVisible();

    await expect(page.getByRole('button', { name: 'Renomear Salário' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Novo tipo' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Arquivar|Renomear/ })).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
});
