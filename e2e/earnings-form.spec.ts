import { expect, test, type Page } from '@playwright/test';

import { stubApi, type ApiStub } from './fixtures/api';
import { chooseUser, signInWithEmail, stubUsersMe, type E2EUser } from './fixtures/auth';
import {
    BANK_ACCOUNTS,
    CHECKING_ACCOUNT,
    EARNING_TYPES,
    OCTOBER_EARNINGS,
    PROJECT_INSTALLMENT,
    SALARY,
    SALARY_TYPE,
} from './fixtures/data/earnings';
import { stubRuntime } from './fixtures/runtime-config';

// Formulário de receita (spec 0014): AC-0014-03, AC-0014-04, AC-0014-07 (edição),
// AC-0014-09 (formulário) e INV-0014-04.

/** As três ocorrências que o `POST` de uma fixa até dezembro devolve. */
const CREATED_SERIES = [
    SALARY,
    { ...SALARY, id: '50000000-0000-4000-8000-000000000011', occurredOn: '2026-11-05' },
    { ...SALARY, id: '50000000-0000-4000-8000-000000000012', occurredOn: '2026-12-05' },
];

async function openAs(page: Page, user: E2EUser, path: string, heading: string): Promise<ApiStub> {
    await stubRuntime(page);
    const stub = await stubApi(page, [
        { method: 'GET', path: '/earnings', body: { data: OCTOBER_EARNINGS } },
        { method: 'POST', path: '/earnings', status: 201, body: { data: CREATED_SERIES } },
        { method: 'GET', path: `/earnings/${SALARY.id}`, body: { data: SALARY } },
        {
            method: 'GET',
            path: `/earnings/${PROJECT_INSTALLMENT.id}`,
            body: { data: PROJECT_INSTALLMENT },
        },
        {
            method: 'PATCH',
            path: `/earnings/${PROJECT_INSTALLMENT.id}`,
            body: { data: { ...PROJECT_INSTALLMENT, bankAccountId: CHECKING_ACCOUNT.id } },
        },
        { method: 'GET', path: '/bank-accounts', body: { data: BANK_ACCOUNTS } },
        { method: 'GET', path: '/earning-types', body: { data: EARNING_TYPES } },
    ]);
    await chooseUser(page, user);
    await stubUsersMe(page, user);
    await page.goto(`/entrar?redirect=${encodeURIComponent(path)}`);
    await signInWithEmail(page);
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
    return stub;
}

const writes = (stub: ApiStub, method: string) =>
    stub.requests.filter((r) => r.method === method && r.path.startsWith('/earnings'));

// AC-0014-03, AC-0014-09: Nova receita fixa de 5.000,00 com Repetir até, no `FormDialog`.
test('creates a fixed earning with Repetir até and opens the first one', async ({
    page,
}, testInfo) => {
    const stub = await openAs(page, 'lancador', '/receitas?mes=2026-10', 'Receitas');

    await page.getByRole('button', { name: 'Nova receita' }).click();
    const dialog = page.getByRole('dialog', { name: 'Nova receita' });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/[?&]novo=1/);

    // AC-0014-09: folha de tela cheia no celular, diálogo central a partir do tablet.
    const viewport = page.viewportSize();
    const box = await dialog.boundingBox();
    if (!viewport || !box) throw new Error('no viewport or dialog box');
    if (testInfo.project.name === 'celular') {
        expect(box).toEqual({ x: 0, y: 0, width: viewport.width, height: viewport.height });
    } else {
        expect(box.width).toBeLessThanOrEqual(560);
        expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(1);
    }

    await expect(dialog.getByLabel('Repetir até')).toHaveCount(0);
    await dialog.getByLabel('Fixa').check();
    await dialog.getByLabel('Descrição').fill('Salário');
    await dialog.getByLabel('Tipo').selectOption({ label: SALARY_TYPE.name });
    await dialog.getByLabel('Valor').fill('5.000,00');
    await dialog.getByLabel('Conta').selectOption({ label: CHECKING_ACCOUNT.description });
    await dialog.getByLabel('Data prevista').fill('2026-10-05');
    await dialog.getByLabel('Repetir até').fill('2026-12-05');
    await dialog.getByRole('button', { name: 'Salvar' }).click();

    await expect(page.getByText('3 receitas criadas.')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/receitas/${SALARY.id}$`));
    await expect(page.getByRole('heading', { name: 'Salário', level: 1 })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Nova receita' })).toHaveCount(0);

    const posts = writes(stub, 'POST');
    expect(posts).toHaveLength(1);
    expect(posts[0]?.body).toEqual({
        description: 'Salário',
        earningTypeId: SALARY_TYPE.id,
        kind: 'FIXED',
        amountCents: 500000,
        occurredOn: '2026-10-05',
        bankAccountId: CHECKING_ACCOUNT.id,
        status: 'OPEN',
        recurrenceEndsOn: '2026-12-05',
    });
});

// AC-0014-04, INV-0014-03, INV-0014-04: a conta de uma parcela, com a nota da cascata.
test('changes the account of an installment with the cascade note', async ({ page }) => {
    const stub = await openAs(
        page,
        'lancador',
        `/receitas/${PROJECT_INSTALLMENT.id}`,
        'Projeto site',
    );

    await page.getByRole('button', { name: 'Alterar' }).click();
    const dialog = page.getByRole('dialog', { name: 'Alterar receita' });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/[?&]editar=1/);
    await expect(
        dialog.getByText('A conta muda em todas as parcelas não recebidas.'),
    ).toBeVisible();
    await expect(dialog.getByText('Parcelada · Parcela 2 de 3')).toBeVisible();
    await expect(dialog.getByRole('radio')).toHaveCount(0);

    await dialog.getByLabel('Conta').selectOption({ label: CHECKING_ACCOUNT.description });
    await dialog.getByRole('button', { name: 'Salvar' }).click();

    await expect(page.getByText('Receita salva.')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page).not.toHaveURL(/editar=1/);
    const patches = writes(stub, 'PATCH');
    expect(patches).toHaveLength(1);
    expect(patches[0]?.query).toEqual({});
    expect(patches[0]?.body).toEqual({ bankAccountId: CHECKING_ACCOUNT.id });
});

// AC-0014-07 (edição): o leitor não vê **Alterar** e `?editar=1` não abre o formulário.
test('a viewer sees no Alterar and ?editar=1 opens no dialog', async ({ page }) => {
    const stub = await openAs(
        page,
        'leitor',
        `/receitas/${PROJECT_INSTALLMENT.id}?editar=1`,
        'Projeto site',
    );

    await expect(page.getByText('+R$ 1.500,00')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Alterar' })).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(writes(stub, 'PATCH')).toHaveLength(0);
});
