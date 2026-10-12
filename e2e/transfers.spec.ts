import { expect, test, type Page } from '@playwright/test';

import { stubApi, type StubRoute } from './fixtures/api';
import { chooseUser, signInWithEmail, stubUsersMe, type E2EUser } from './fixtures/auth';
import {
    ACCOUNTS,
    COMPLETED_ID,
    COMPLETED_TRANSFER,
    CORRENTE_ID,
    POUPANCA_ID,
    SCHEDULED_ID,
    SCHEDULED_TRANSFER,
    TRANSFERS,
} from './fixtures/data/transfers';
import { stubRuntime } from './fixtures/runtime-config';

// Transferências entre contas próprias (spec 0018), com a API simulada.

const ROUTES: StubRoute[] = [
    { method: 'GET', path: '/bank-accounts', body: { data: ACCOUNTS } },
    { method: 'GET', path: '/bank-transfers', body: { data: TRANSFERS } },
    { method: 'GET', path: `/bank-transfers/${COMPLETED_ID}`, body: { data: COMPLETED_TRANSFER } },
    { method: 'GET', path: `/bank-transfers/${SCHEDULED_ID}`, body: { data: SCHEDULED_TRANSFER } },
    { method: 'POST', path: '/bank-transfers', status: 201, body: { data: COMPLETED_TRANSFER } },
    {
        method: 'PATCH',
        path: `/bank-transfers/${SCHEDULED_ID}/status`,
        body: { data: { ...SCHEDULED_TRANSFER, status: 'COMPLETED' } },
    },
    {
        method: 'PATCH',
        path: `/bank-transfers/${COMPLETED_ID}/status`,
        body: { data: { ...COMPLETED_TRANSFER, status: 'SCHEDULED', completedOn: null } },
    },
    {
        method: 'PATCH',
        path: `/bank-transfers/${COMPLETED_ID}`,
        body: { data: COMPLETED_TRANSFER },
    },
];

/** Entra como `user` e abre `path` (pelo `redirect` do `/entrar`). */
async function open(page: Page, path: string, user: E2EUser = 'ativo') {
    await stubRuntime(page);
    const api = await stubApi(page, ROUTES);
    await chooseUser(page, user);
    await stubUsersMe(page, user);
    await page.goto(`/entrar?redirect=${encodeURIComponent(path)}`);
    await signInWithEmail(page);
    return api;
}

/** O conteúdo visível da lista: cartões no celular, a tabela a partir do tablet. */
function list(page: Page, projectName: string) {
    return projectName === 'celular'
        ? page.getByRole('list', { name: 'Transferências de outubro de 2026' })
        : page.getByRole('table', { name: 'Transferências de outubro de 2026' });
}

// AC-0018-01, AC-0018-07, INV-0018-01.
test('lists the month with origin → destination, badge and a neutral amount', async ({
    page,
}, testInfo) => {
    const api = await open(page, '/transferencias?mes=2026-10');

    await expect(page.getByRole('heading', { name: 'Transferências', level: 1 })).toBeVisible();
    const entries = list(page, testInfo.project.name);
    await expect(entries).toBeVisible();
    await expect(entries.getByText('Conta corrente → Poupança')).toBeVisible();
    await expect(entries.getByText('Poupança → Conta corrente')).toBeVisible();
    await expect(entries.getByText('Concluída')).toBeVisible();
    await expect(entries.getByText('Agendada')).toBeVisible();
    const amount = entries.getByText('R$ 500,00', { exact: true });
    await expect(amount).toBeVisible();
    await expect(amount).toHaveClass(/text-texto/);

    const listCall = api.requests.find((r) => r.method === 'GET' && r.path === '/bank-transfers');
    expect(listCall?.query).toEqual({ from: '2026-10-01', to: '2026-10-31' });

    if (testInfo.project.name === 'celular') {
        await expect(page.getByRole('table')).toBeHidden();
    } else {
        await expect(page.getByRole('list', { name: /Transferências de/ })).toBeHidden();
    }
});

// AC-0018-01, INV-0018-01: com `conta`, `−` quando sai e `+` quando entra, sem tom.
test('signs the amount from the point of view of the account filter', async ({
    page,
}, testInfo) => {
    const api = await open(page, `/transferencias?mes=2026-10&conta=${CORRENTE_ID}`);

    const entries = list(page, testInfo.project.name);
    const out = entries.getByText('−R$ 500,00');
    const incoming = entries.getByText('+R$ 123,45');
    await expect(out).toBeVisible();
    await expect(incoming).toBeVisible();
    for (const amount of [out, incoming]) {
        await expect(amount).toHaveClass(/text-texto/);
        await expect(amount).not.toHaveClass(/text-(positivo|negativo)/);
    }
    await expect(page.getByLabel('Conta')).toHaveValue(CORRENTE_ID);
    const listCall = api.requests.find((r) => r.method === 'GET' && r.path === '/bank-transfers');
    expect(listCall?.query).toEqual({
        from: '2026-10-01',
        to: '2026-10-31',
        bankAccountId: CORRENTE_ID,
    });
});

// AC-0018-07: **Transferências** aparece em **Mais** no celular; a lateral a lista no desktop.
test('Transferências is reachable from the navigation', async ({ page }, testInfo) => {
    await open(page, '/');
    await expect(page.getByRole('heading', { name: 'Olá, Ana Souza' })).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Principal' });

    if (testInfo.project.name === 'desktop') {
        await nav.getByRole('link', { name: 'Transferências' }).click();
    } else {
        await expect(nav.getByRole('link', { name: 'Transferências' })).toHaveCount(0);
        await nav.getByRole('link', { name: 'Mais' }).click();
        await page
            .getByRole('navigation', { name: 'Mais' })
            .getByRole('link', { name: 'Transferências' })
            .click();
    }
    await expect(page.getByRole('heading', { name: 'Transferências', level: 1 })).toBeVisible();
    await expect(page).toHaveURL(/\/transferencias$/);
});

// AC-0018-02, AC-0018-03, AC-0018-07: o formulário em `FormDialog`.
test('creates a completed transfer and blocks the same account in De and Para', async ({
    page,
}) => {
    const api = await open(page, '/transferencias?mes=2026-10');
    await page.getByRole('button', { name: 'Nova transferência' }).click();
    const dialog = page.getByRole('dialog', { name: 'Nova transferência' });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/novo=1/);

    await dialog.getByLabel('Para').selectOption({ label: 'Conta corrente' });
    await dialog.getByLabel('De', { exact: true }).selectOption({ label: 'Conta corrente' });
    await dialog.getByLabel('Valor').fill('250,00');
    await dialog.getByLabel('Data', { exact: true }).fill('2026-10-12');
    await dialog.getByLabel('Descrição').fill('Reserva');
    await dialog.getByRole('button', { name: 'Salvar' }).click();
    await expect(dialog.getByLabel('Para')).toHaveAccessibleDescription(
        'Escolha contas diferentes.',
    );
    expect(api.requests.filter((r) => r.method === 'POST')).toEqual([]);

    await dialog.getByLabel('Para').selectOption({ label: 'Poupança' });
    await expect(dialog.getByLabel('Concluída agora')).toBeChecked();
    await dialog.getByRole('button', { name: 'Salvar' }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByRole('region', { name: 'Avisos' })).toContainText(
        'Transferência salva.',
    );
    const post = api.requests.find((r) => r.method === 'POST' && r.path === '/bank-transfers');
    expect(post?.body).toEqual({
        fromBankAccountId: CORRENTE_ID,
        toBankAccountId: POUPANCA_ID,
        amountCents: 25000,
        occurredOn: '2026-10-12',
        status: 'COMPLETED',
        description: 'Reserva',
    });
});

// AC-0018-04, INV-0018-02: a agendada conclui e pode ser excluída.
test('completes a scheduled transfer from its detail', async ({ page }) => {
    const api = await open(page, `/transferencias/${SCHEDULED_ID}`);

    await expect(page.getByRole('heading', { name: 'Resgate', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Excluir' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Desfazer' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Concluir' }).click();
    const dialog = page.getByRole('dialog', { name: 'Concluir a transferência?' });
    await dialog.getByLabel('Concluída em').fill('2026-10-11');
    await dialog.getByRole('button', { name: 'Concluir' }).click();

    await expect(dialog).toBeHidden();
    const patch = api.requests.find(
        (r) => r.method === 'PATCH' && r.path === `/bank-transfers/${SCHEDULED_ID}/status`,
    );
    expect(patch?.body).toEqual({ status: 'COMPLETED', completedOn: '2026-10-11' });
});

// AC-0018-04, AC-0018-05: a concluída desfaz com confirmação e edita só descrição e observações.
test('undoes a completed transfer and edits only its description and notes', async ({ page }) => {
    const api = await open(page, `/transferencias/${COMPLETED_ID}`);

    await expect(page.getByRole('heading', { name: 'Reserva do mês', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Excluir' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Concluir' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Editar' }).click();
    const form = page.getByRole('dialog', { name: 'Editar transferência' });
    await expect(form.getByLabel('Descrição')).toBeVisible();
    await expect(form.getByLabel('Observações')).toBeVisible();
    for (const label of ['De', 'Para', 'Valor', 'Data']) {
        await expect(form.getByLabel(label, { exact: true })).toHaveCount(0);
    }
    await form.getByLabel('Descrição').fill('Reserva de outubro');
    await form.getByRole('button', { name: 'Salvar' }).click();
    await expect(form).toBeHidden();
    const edit = api.requests.find(
        (r) => r.method === 'PATCH' && r.path === `/bank-transfers/${COMPLETED_ID}`,
    );
    expect(edit?.body).toEqual({ description: 'Reserva de outubro' });

    await page.getByRole('button', { name: 'Desfazer' }).click();
    const confirm = page.getByRole('alertdialog', { name: 'Desfazer a transferência?' });
    await expect(confirm).toContainText(
        'Os saldos das duas contas voltam e a transferência fica agendada.',
    );
    await expect(confirm.getByRole('button', { name: 'Cancelar' })).toBeFocused();
    await confirm.getByRole('button', { name: 'Desfazer' }).click();

    await expect(confirm).toBeHidden();
    const undo = api.requests.find(
        (r) => r.method === 'PATCH' && r.path === `/bank-transfers/${COMPLETED_ID}/status`,
    );
    expect(undo?.body).toEqual({ status: 'SCHEDULED' });
});

// AC-0018-06: com `leitor`, nenhuma ação de escrita aparece, nem pelos parâmetros.
test('shows no write action to the leitor on the list', async ({ page }) => {
    await open(page, '/transferencias?mes=2026-10&novo=1', 'leitor');
    await expect(page.getByRole('heading', { name: 'Transferências', level: 1 })).toBeVisible();
    await expect(page.getByText('Conta corrente → Poupança').first()).toBeAttached();
    await expect(page.getByRole('button', { name: 'Nova transferência' })).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('shows no write action to the leitor on the detail', async ({ page }) => {
    await open(page, `/transferencias/${SCHEDULED_ID}?editar=1&concluir=1&excluir=1`, 'leitor');
    await expect(page.getByRole('heading', { name: 'Resgate', level: 1 })).toBeVisible();
    for (const name of ['Concluir', 'Editar', 'Excluir', 'Desfazer']) {
        await expect(page.getByRole('button', { name })).toHaveCount(0);
    }
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
});
