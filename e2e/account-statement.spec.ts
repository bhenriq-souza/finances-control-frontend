import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

import type { components } from '../src/api/generated/schema';
import { stubApi, type ApiStub, type StubRoute } from './fixtures/api';
import { chooseUser, signInWithEmail, stubUsersMe, type E2EUser } from './fixtures/auth';
import { accountsReadRoutes, CONTA_CORRENTE, ITAU_VISA, POUPANCA } from './fixtures/data/accounts';
import { stubRuntime } from './fixtures/runtime-config';

// Extrato de conta (spec 0015, T-0015-03), com a API simulada.

type Report = components['schemas']['AccountMovementsReport'];
type Movement = Report['movements'][number];

const STATEMENT_ID = '50000000-0000-4000-8000-000000000001';

const base: Omit<Movement, 'kind' | 'sourceId' | 'amountCents' | 'balanceAfterCents'> = {
    date: '2026-03-10',
    description: null,
    typeName: null,
    creditCardId: null,
    statementId: null,
    counterpartBankAccountId: null,
};

const MOVEMENTS: Movement[] = [
    {
        ...base,
        date: '2026-03-02',
        kind: 'EARNING',
        sourceId: '51000000-0000-4000-8000-000000000001',
        description: 'Salário de março',
        typeName: 'Trabalho',
        amountCents: 500000,
        balanceAfterCents: 600000,
    },
    {
        ...base,
        date: '2026-03-05',
        kind: 'EXPENSE',
        sourceId: '51000000-0000-4000-8000-000000000002',
        description: 'Aluguel',
        typeName: 'Moradia',
        amountCents: -150000,
        balanceAfterCents: 450000,
    },
    {
        ...base,
        date: '2026-03-08',
        kind: 'STATEMENT_PAYMENT',
        sourceId: '51000000-0000-4000-8000-000000000003',
        creditCardId: ITAU_VISA.id,
        statementId: STATEMENT_ID,
        amountCents: -20000,
        balanceAfterCents: 430000,
    },
    {
        ...base,
        date: '2026-03-09',
        kind: 'STATEMENT_PAYMENT',
        sourceId: '51000000-0000-4000-8000-000000000004',
        creditCardId: ITAU_VISA.id,
        statementId: null,
        amountCents: -1000,
        balanceAfterCents: 429000,
    },
    {
        ...base,
        date: '2026-03-12',
        kind: 'TRANSFER_OUT',
        sourceId: '51000000-0000-4000-8000-000000000005',
        description: 'Reserva do mês',
        counterpartBankAccountId: POUPANCA.id,
        amountCents: -9000,
        balanceAfterCents: 420000,
    },
    {
        ...base,
        date: '2026-03-20',
        kind: 'TRANSFER_IN',
        sourceId: '51000000-0000-4000-8000-000000000006',
        description: 'Devolução',
        counterpartBankAccountId: POUPANCA.id,
        amountCents: 3000,
        balanceAfterCents: 423000,
    },
];

// Os saldos não batem de propósito com a soma: a tela mostra os da resposta (INV-0015-05).
const REPORT: Report = {
    bankAccountId: CONTA_CORRENTE.id,
    from: '2026-03-01',
    to: '2026-03-31',
    openingBalanceCents: 100000,
    closingBalanceCents: 423000,
    movements: MOVEMENTS,
};

const statementRoute = (report: Report): StubRoute => ({
    method: 'GET',
    path: '/reports/account-movements',
    body: { data: report },
});

async function openAs(
    page: Page,
    path: string,
    user: E2EUser = 'ativo',
    extra: readonly StubRoute[] = [statementRoute(REPORT)],
): Promise<ApiStub> {
    await stubRuntime(page);
    await chooseUser(page, user);
    const stub = await stubApi(page, [...accountsReadRoutes, ...extra]);
    await stubUsersMe(page, user);
    await page.goto(`/entrar?redirect=${encodeURIComponent(path)}`);
    await signInWithEmail(page);
    return stub;
}

/** Os itens da lista no formato do projeto: cartões no celular, linhas da tabela acima. */
function entries(page: Page, caption: string, testInfo: TestInfo): Locator {
    if (testInfo.project.name === 'celular') {
        return page.getByRole('list', { name: caption }).getByRole('listitem');
    }
    return page.getByRole('table', { name: caption }).locator('tbody tr');
}

const MOVES = 'Movimentos da conta';

// AC-0015-11, INV-0015-05.
test('shows the opening balance, the movements in order with signed values, and the closing balance', async ({
    page,
}, testInfo) => {
    const stub = await openAs(page, `/contas/${CONTA_CORRENTE.id}?mes=2026-03`);
    await expect(
        page.getByRole('heading', { name: CONTA_CORRENTE.description, level: 1 }),
    ).toBeVisible();
    await expect(page.getByText('Itaú · Corrente')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'março de 2026' })).toBeVisible();

    const items = entries(page, MOVES, testInfo);
    await expect(items).toHaveCount(6);
    await expect(page.getByText('Saldo inicial').locator('..')).toContainText('R$ 1.000,00');
    await expect(page.getByText('Saldo final').locator('..')).toContainText('R$ 4.230,00');
    await expect(items.nth(0)).toContainText('+R$ 5.000,00');
    await expect(items.nth(0)).toContainText('R$ 6.000,00');
    await expect(items.nth(1)).toContainText('−R$ 1.500,00');
    await expect(items.nth(1)).toContainText('R$ 4.500,00');

    expect(stub.requests.find((r) => r.path === '/reports/account-movements')?.query).toEqual({
        bankAccountId: CONTA_CORRENTE.id,
        from: '2026-03-01',
        to: '2026-03-31',
    });

    await page.getByRole('button', { name: 'Mês anterior' }).click();
    await expect(page).toHaveURL(/mes=2026-02/);
    await expect(page.getByRole('heading', { name: 'fevereiro de 2026' })).toBeVisible();
    await expect
        .poll(
            () =>
                stub.requests.filter((r) => r.path === '/reports/account-movements').at(-1)?.query,
        )
        .toEqual({ bankAccountId: CONTA_CORRENTE.id, from: '2026-02-01', to: '2026-02-28' });
});

// AC-0015-12.
test('describes each kind of movement and links to its origin', async ({ page }, testInfo) => {
    await openAs(page, `/contas/${CONTA_CORRENTE.id}?mes=2026-03`);
    const items = entries(page, MOVES, testInfo);
    await expect(items).toHaveCount(6);

    const expected = [
        ['Salário de março', 'Trabalho', '/receitas/51000000-0000-4000-8000-000000000001'],
        ['Aluguel', 'Moradia', '/despesas/51000000-0000-4000-8000-000000000002'],
        ['Pagamento de fatura', ITAU_VISA.name, `/cartoes/${ITAU_VISA.id}/faturas/${STATEMENT_ID}`],
        ['Pagamento de fatura', ITAU_VISA.name, `/cartoes/${ITAU_VISA.id}`],
        [
            'Reserva do mês',
            `Para ${POUPANCA.description}`,
            '/transferencias/51000000-0000-4000-8000-000000000005',
        ],
        [
            'Devolução',
            `De ${POUPANCA.description}`,
            '/transferencias/51000000-0000-4000-8000-000000000006',
        ],
    ] as const;
    for (const [index, [title, support, href]] of expected.entries()) {
        await expect(items.nth(index)).toContainText(title);
        await expect(items.nth(index)).toContainText(support);
        await expect(items.nth(index).getByRole('link').first()).toHaveAttribute('href', href);
    }

    // O pagamento antecipado, sem fatura, leva ao cartão.
    await items.nth(3).getByRole('link').first().click();
    await expect(page).toHaveURL(new RegExp(`/cartoes/${ITAU_VISA.id}$`));
});

test('shows the empty message with both balances', async ({ page }) => {
    await openAs(page, `/contas/${CONTA_CORRENTE.id}?mes=2026-03`, 'ativo', [
        statementRoute({ ...REPORT, movements: [], closingBalanceCents: 100000 }),
    ]);
    await expect(page.getByText('Nenhum movimento neste mês.')).toBeVisible();
    await expect(page.getByText('Saldo inicial').locator('..')).toContainText('R$ 1.000,00');
    await expect(page.getByText('Saldo final').locator('..')).toContainText('R$ 1.000,00');
});

// AC-0015-13.
test('an unknown account shows not found with a link to the accounts', async ({ page }) => {
    await openAs(page, '/contas/00000000-0000-4000-8000-00000000dead?mes=2026-03', 'ativo', [
        {
            method: 'GET',
            path: '/reports/account-movements',
            status: 404,
            body: { error: { code: 'BANK_ACCOUNT_NOT_FOUND', message: 'raw' } },
        },
    ]);
    await expect(page.getByRole('heading', { name: 'Não encontramos este item.' })).toBeVisible();
    await page.getByRole('link', { name: 'Voltar para Contas' }).click();
    await expect(page).toHaveURL(/\/contas$/);
});

// AC-0015-13: com leitor, o extrato aparece e a lista de contas mostra Extrato em cada linha.
test('leitor reads the statement and sees Extrato on every account row', async ({
    page,
}, testInfo) => {
    await openAs(page, '/contas', 'leitor');
    const rows = entries(page, 'Contas bancárias', testInfo);
    await expect(rows).toHaveCount(2);
    for (const index of [0, 1]) {
        await expect(rows.nth(index).getByRole('link', { name: /^Extrato/ })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: /^Editar/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Arquivar/ })).toHaveCount(0);

    await rows
        .nth(0)
        .getByRole('link', { name: /^Extrato/ })
        .click();
    await expect(page).toHaveURL(new RegExp(`/contas/${CONTA_CORRENTE.id}$`));
    await expect(
        page.getByRole('heading', { name: CONTA_CORRENTE.description, level: 1 }),
    ).toBeVisible();
    await expect(entries(page, MOVES, testInfo)).toHaveCount(6);
});

// /contas/bancos continua levando à lista de bancos, e não ao extrato de uma conta "bancos".
test('/contas/bancos still opens the banks list', async ({ page }) => {
    await openAs(page, '/contas/bancos');
    await expect(page.getByRole('heading', { name: 'Bancos', level: 1 })).toBeVisible();
});
