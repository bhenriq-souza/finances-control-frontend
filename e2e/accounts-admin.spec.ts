import { expect, test, type Locator, type Page, type Route, type TestInfo } from '@playwright/test';

import { stubApi, type RecordedRequest } from './fixtures/api';
import { chooseUser, signInWithEmail, stubUsersMe, type E2EUser } from './fixtures/auth';
import {
    accountsReadRoutes,
    BANK_ACCOUNTS,
    BANKS,
    CONTA_CORRENTE,
    CREDIT_CARDS,
    ITAU,
    NUBANK_ROXINHO,
    POUPANCA,
} from './fixtures/data/accounts';
import { stubRuntime } from './fixtures/runtime-config';

// Spec 0011, cadastro (T-0011-02): criar, alterar, arquivar e desarquivar, só com `accounts.write`.

type Collection = 'banks' | 'bank-accounts' | 'credit-cards';
type Item = { id: string; archivedAt: string | null } & Record<string, unknown>;

/** Resposta forçada para uma chamada (`"PATCH /credit-cards/<id>"`), ex.: um `409`. */
type Failures = Record<string, { status: number; code: string }>;

interface AccountsApi {
    /** Escritas recebidas (`POST`, `PATCH`, `DELETE`), na ordem. */
    writes: RecordedRequest[];
}

/**
 * Simula os cadastros com estado: as listas começam com os dados de `fixtures/data/accounts` e as
 * escritas as alteram, para a invalidação trazer a linha no novo estado (AC-0011-06).
 */
async function stubAccounts(page: Page, failures: Failures): Promise<AccountsApi> {
    const state: Record<Collection, Item[]> = {
        banks: structuredClone(BANKS) as unknown as Item[],
        'bank-accounts': structuredClone(BANK_ACCOUNTS) as unknown as Item[],
        'credit-cards': structuredClone(CREDIT_CARDS) as unknown as Item[],
    };
    const writes: RecordedRequest[] = [];

    await page.route(/\/api\/(banks|bank-accounts|credit-cards)(\/|\?|$)/, (route: Route) => {
        const request = route.request();
        const url = new URL(request.url());
        const path = url.pathname.replace(/^\/api/, '');
        const [, collection, id, archive] = path.split('/') as [
            string,
            Collection,
            string | undefined,
            string | undefined,
        ];
        const method = request.method();
        if (method === 'GET') return route.fulfill({ json: { data: state[collection] } });

        const body = request.postData() ? (request.postDataJSON() as unknown) : null;
        writes.push({ method, path, query: Object.fromEntries(url.searchParams), body });
        const failure = failures[`${method} ${path}`];
        if (failure) {
            return route.fulfill({
                status: failure.status,
                json: { error: { code: failure.code, message: 'stub' } },
            });
        }

        const items = state[collection];
        const item = items.find((candidate) => candidate.id === id);
        if (!id) {
            const created = { ...(body as object), id: crypto.randomUUID(), archivedAt: null };
            return route.fulfill({ status: 201, json: { data: created } });
        }
        if (!item) return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND' } } });
        if (archive === 'archive') {
            item.archivedAt = method === 'POST' ? '2026-10-12T12:00:00Z' : null;
        } else {
            Object.assign(item, body);
        }
        return route.fulfill({ json: { data: item } });
    });
    return { writes };
}

async function openAs(
    page: Page,
    path: string,
    { user = 'ativo', failures = {} }: { user?: E2EUser; failures?: Failures } = {},
): Promise<AccountsApi> {
    await stubRuntime(page);
    await chooseUser(page, user);
    await stubApi(page, accountsReadRoutes);
    const api = await stubAccounts(page, failures);
    await stubUsersMe(page, user);
    await visit(page, path);
    return api;
}

/** Abre `path` entrando de novo: a sessão do fake não sobrevive a um carregamento da página. */
async function visit(page: Page, path: string): Promise<void> {
    await page.goto(`/entrar?redirect=${encodeURIComponent(path)}`);
    await signInWithEmail(page);
}

/** Os itens da lista no formato do projeto: cartões no celular, linhas da tabela acima. */
function entries(page: Page, caption: string, testInfo: TestInfo): Locator {
    if (testInfo.project.name === 'celular') {
        return page.getByRole('list', { name: caption }).getByRole('listitem');
    }
    return page.getByRole('table', { name: caption }).locator('tbody tr');
}

const notices = (page: Page) => page.getByRole('region', { name: 'Avisos' });

// AC-0011-06.
test('archiving and unarchiving an account call POST and DELETE /archive and the row changes', async ({
    page,
}, testInfo) => {
    const api = await openAs(page, '/contas?arquivadas=1');
    const row = entries(page, 'Contas bancárias', testInfo).filter({ hasText: 'Conta corrente' });
    await expect(row).not.toContainText('Arquivado');

    await row.getByRole('button', { name: 'Arquivar Conta corrente' }).click();
    await expect(notices(page).getByText('Conta arquivada.')).toBeVisible();
    await expect(row).toContainText('Arquivado');
    expect(api.writes.at(-1)).toMatchObject({
        method: 'POST',
        path: `/bank-accounts/${CONTA_CORRENTE.id}/archive`,
    });

    await row.getByRole('button', { name: 'Desarquivar Conta corrente' }).click();
    await expect(notices(page).getByText('Conta desarquivada.')).toBeVisible();
    await expect(row).not.toContainText('Arquivado');
    expect(api.writes.at(-1)).toMatchObject({
        method: 'DELETE',
        path: `/bank-accounts/${CONTA_CORRENTE.id}/archive`,
    });
});

// AC-0011-06.
test('archiving a bank and a card changes their state', async ({ page }, testInfo) => {
    const api = await openAs(page, '/contas/bancos?arquivados=1');
    const itau = entries(page, 'Bancos', testInfo).filter({ hasText: 'Itaú' });
    await itau.getByRole('button', { name: 'Arquivar Itaú' }).click();
    await expect(notices(page).getByText('Banco arquivado.')).toBeVisible();
    await expect(itau).toContainText('Arquivado');
    expect(api.writes.at(-1)).toMatchObject({
        method: 'POST',
        path: `/banks/${ITAU.id}/archive`,
    });

    await visit(page, `/cartoes/${NUBANK_ROXINHO.id}`);
    await page.getByRole('button', { name: 'Arquivar Nubank Roxinho' }).click();
    await expect(notices(page).getByText('Cartão arquivado.')).toBeVisible();
    await expect(page.getByText('Arquivado', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Desarquivar Nubank Roxinho' }).click();
    await expect(notices(page).getByText('Cartão desarquivado.')).toBeVisible();
    await expect(page.getByText('Arquivado', { exact: true })).toHaveCount(0);
    expect(api.writes.slice(-2)).toMatchObject([
        { method: 'POST', path: `/credit-cards/${NUBANK_ROXINHO.id}/archive` },
        { method: 'DELETE', path: `/credit-cards/${NUBANK_ROXINHO.id}/archive` },
    ]);
});

// AC-0011-03.
test('Nova conta with a negative opening balance sends openingBalanceCents −123456', async ({
    page,
}) => {
    const api = await openAs(page, '/contas');
    await page.getByRole('button', { name: 'Nova conta' }).click();
    await expect(page).toHaveURL(/[?&]novo=1/);

    const form = page.getByRole('dialog', { name: 'Nova conta' });
    // Só os bancos ativos (INV-0011-04).
    await expect(form.getByLabel('Banco').locator('option')).toHaveText([
        'Escolha o banco',
        '341 · Itaú',
        '260 · Nubank',
    ]);
    await form.getByLabel('Banco').selectOption(ITAU.id);
    await form.getByLabel('Tipo').selectOption('SAVINGS');
    await form.getByLabel('Número da conta').fill('4321-0');
    await form.getByLabel('Descrição').fill('Reserva');
    await form.getByLabel('Saldo inicial', { exact: true }).fill('1.234,56');
    await form.getByRole('checkbox', { name: 'Saldo inicial negativo' }).check();
    await form.getByRole('button', { name: 'Salvar' }).click();

    await expect(notices(page).getByText('Conta salva.')).toBeVisible();
    await expect(form).toBeHidden();
    await expect(page).not.toHaveURL(/novo=/);
    expect(api.writes).toEqual([
        expect.objectContaining({
            method: 'POST',
            path: '/bank-accounts',
            body: {
                bankId: ITAU.id,
                type: 'SAVINGS',
                accountNumber: '4321-0',
                description: 'Reserva',
                openingBalanceCents: -123456,
                overdraftLimitCents: 0,
            },
        }),
    ]);
});

// AC-0011-04, INV-0011-02.
test('editing an account sends only the changed fields', async ({ page }, testInfo) => {
    const api = await openAs(page, '/contas');
    const row = entries(page, 'Contas bancárias', testInfo).filter({ hasText: 'Poupança' });
    await row.getByRole('button', { name: 'Editar Poupança' }).click();
    await expect(page).toHaveURL(new RegExp(`[?&]editar=${POUPANCA.id}`));

    const form = page.getByRole('dialog', { name: 'Editar conta' });
    await expect(form.getByText('O saldo só muda por lançamentos.')).toBeVisible();
    await expect(form.getByLabel('Banco')).toHaveCount(0);
    await form.getByLabel('Descrição').fill('Poupança da casa');
    await form.getByRole('button', { name: 'Salvar' }).click();

    await expect(notices(page).getByText('Conta salva.')).toBeVisible();
    await expect(page).not.toHaveURL(/editar=/);
    expect(api.writes).toEqual([
        expect.objectContaining({
            method: 'PATCH',
            path: `/bank-accounts/${POUPANCA.id}`,
            body: { description: 'Poupança da casa' },
        }),
    ]);
    await expect(
        entries(page, 'Contas bancárias', testInfo).filter({ hasText: 'Poupança da casa' }),
    ).toHaveCount(1);
});

// AC-0011-05.
test('409 BANK_ALREADY_EXISTS marks the code field and keeps the form open', async ({ page }) => {
    await openAs(page, '/contas/bancos?novo=1', {
        failures: { 'POST /banks': { status: 409, code: 'BANK_ALREADY_EXISTS' } },
    });
    const form = page.getByRole('dialog', { name: 'Novo banco' });
    await form.getByLabel('Código FEBRABAN').fill('341');
    await form.getByLabel('Nome').fill('Itaú');
    await form.getByRole('button', { name: 'Salvar' }).click();

    const code = form.getByLabel('Código FEBRABAN');
    await expect(code).toHaveAttribute('aria-invalid', 'true');
    await expect(
        form.getByText('Esse banco já está cadastrado. Use o banco existente.'),
    ).toBeVisible();
    await expect(code).toHaveValue('341');
});

// AC-0011-05.
test('409 BANK_ACCOUNT_ARCHIVED when editing a card marks the paying account', async ({ page }) => {
    const api = await openAs(page, `/cartoes/${NUBANK_ROXINHO.id}`, {
        failures: {
            [`PATCH /credit-cards/${NUBANK_ROXINHO.id}`]: {
                status: 409,
                code: 'BANK_ACCOUNT_ARCHIVED',
            },
        },
    });
    await page.getByRole('button', { name: 'Editar Nubank Roxinho' }).click();
    await expect(page).toHaveURL(/[?&]editar=1/);

    const form = page.getByRole('dialog', { name: 'Editar cartão' });
    await expect(
        form.getByText('Mudar o limite muda o disponível na mesma diferença.', { exact: false }),
    ).toBeVisible();
    const payment = form.getByLabel('Conta pagadora (opcional)');
    await payment.selectOption(POUPANCA.id);
    await form.getByRole('button', { name: 'Salvar' }).click();

    await expect(payment).toHaveAttribute('aria-invalid', 'true');
    await expect(
        form.getByText('Essa conta está arquivada. Reative a conta ou escolha outra.'),
    ).toBeVisible();
    // Nunca `bankId` num PATCH de cartão (INV-0011-02).
    expect(api.writes).toEqual([
        expect.objectContaining({ body: { paymentBankAccountId: POUPANCA.id } }),
    ]);
});

// AC-0011-07, INV-0011-01.
for (const user of ['lancador', 'leitor'] as const) {
    test(`${user}: no write control on any screen and ?novo/?editar open nothing`, async ({
        page,
    }) => {
        const write = /^(Nova conta|Novo banco|Novo cartão|Editar|Arquivar|Desarquivar)/;
        const screens = [
            { path: '/contas?novo=1', heading: 'Contas' },
            { path: `/contas?editar=${CONTA_CORRENTE.id}`, heading: 'Contas' },
            { path: '/contas/bancos?novo=1', heading: 'Bancos' },
            { path: '/cartoes?novo=1', heading: 'Cartões' },
            { path: `/cartoes/${NUBANK_ROXINHO.id}?editar=1`, heading: NUBANK_ROXINHO.name },
        ];
        const api = await openAs(page, screens[0]!.path, { user });
        for (const { path, heading } of screens) {
            if (path !== screens[0]!.path) await visit(page, path);
            await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
            await expect(page.getByRole('dialog')).toHaveCount(0);
            await expect(page.getByRole('button', { name: write })).toHaveCount(0);
        }
        expect(api.writes).toEqual([]);
    });
}
