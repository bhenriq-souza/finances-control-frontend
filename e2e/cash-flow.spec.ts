import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

import type { components } from '../src/api/generated/schema';
import type { RecordedRequest } from './fixtures/api';
import { chooseUser, signInWithEmail, stubUsersMe, type E2EUser } from './fixtures/auth';
import {
    BANK_ACCOUNTS,
    CONTA_CORRENTE,
    CREDIT_CARDS,
    ITAU_VISA,
    NUBANK_ROXINHO,
    POUPANCA,
} from './fixtures/data/accounts';
import { stubRuntime } from './fixtures/runtime-config';

// Fluxo de caixa do mês em `/fluxo-de-caixa` (spec 0015, T-0015-04 e T-0015-05), com "hoje" em
// 15/10/2026.

type Schemas = components['schemas'];
type Expense = Schemas['ExpenseResponse'];
type Earning = Schemas['EarningResponse'];
type Statement = Schemas['StatementResponse'];
type BalancePoint = Schemas['BalanceReport']['points'][number];
type BankTransfer = Schemas['BankTransferResponse'];
type CreditCard = Schemas['CreditCardResponse'];

const TODAY = '2026-10-15T12:00:00-03:00';
const CREATED = '2026-10-01T12:00:00Z';
const MORADIA = { id: '31000000-0000-4000-8000-000000000001', name: 'Moradia' };
const SALARIO = { id: '32000000-0000-4000-8000-000000000001', name: 'Salário' };

function expense(
    fields: Pick<Expense, 'id' | 'description' | 'status' | 'amountCents' | 'occurredOn'> &
        Partial<Expense>,
): Expense {
    return {
        kind: 'VARIABLE',
        paidOn: null,
        notes: null,
        expenseType: { ...MORADIA, archivedAt: null, createdAt: CREATED },
        bankAccountId: CONTA_CORRENTE.id,
        creditCardId: null,
        postedOn: null,
        installment: null,
        recurrenceId: null,
        reconciledAt: null,
        createdAt: CREATED,
        updatedAt: CREATED,
        ...fields,
    };
}

function earning(
    fields: Pick<Earning, 'id' | 'description' | 'status' | 'amountCents' | 'occurredOn'> &
        Partial<Earning>,
): Earning {
    return {
        kind: 'VARIABLE',
        receivedOn: null,
        notes: null,
        earningType: { ...SALARIO, archivedAt: null, createdAt: CREATED },
        bankAccountId: CONTA_CORRENTE.id,
        installment: null,
        recurrenceId: null,
        createdAt: CREATED,
        updatedAt: CREATED,
        ...fields,
    };
}

function statement(
    fields: Pick<Statement, 'id' | 'creditCardId' | 'status' | 'closesOn' | 'dueOn'> &
        Partial<Statement>,
): Statement {
    return {
        startsOn: '2026-08-09',
        purchasesCents: 0,
        refundsCents: 0,
        totalCents: 0,
        reconciledCents: 0,
        pendingReconciliationCents: 0,
        previousBalanceCents: 0,
        amountDueCents: 0,
        paidCents: 0,
        remainingCents: 0,
        minimumPaymentCents: null,
        overdue: false,
        closedAt: null,
        byExpenseType: [],
        ...fields,
    };
}

const SALARY = earning({
    id: '71000000-0000-4000-8000-000000000001',
    description: 'Salário',
    status: 'RECEIVED',
    amountCents: 500000,
    occurredOn: '2026-10-05',
    receivedOn: '2026-10-05',
});
const FREELA = earning({
    id: '71000000-0000-4000-8000-000000000002',
    description: 'Freela',
    status: 'OPEN',
    amountCents: 80000,
    occurredOn: '2026-10-12',
    bankAccountId: POUPANCA.id,
});
const RENT = expense({
    id: '72000000-0000-4000-8000-000000000001',
    description: 'Aluguel',
    status: 'PAID',
    amountCents: 180000,
    occurredOn: '2026-10-05',
    paidOn: '2026-10-05',
});
const INTERNET = expense({
    id: '72000000-0000-4000-8000-000000000002',
    description: 'Internet',
    status: 'OPEN',
    amountCents: 9990,
    occurredOn: '2026-10-15',
});
/** Despesa de cartão: nunca aparece, só a fatura (INV-0015-07). */
const CARD_PURCHASE = expense({
    id: '72000000-0000-4000-8000-000000000003',
    description: 'Mercado no cartão',
    status: 'OPEN',
    amountCents: 23490,
    occurredOn: '2026-10-16',
    bankAccountId: null,
    creditCardId: NUBANK_ROXINHO.id,
    postedOn: '2026-10-16',
});
/** Vencida de setembro: fica em setembro e entra na nota das vencidas de outubro. */
const IPVA = expense({
    id: '72000000-0000-4000-8000-000000000004',
    description: 'IPVA',
    status: 'OVERDUE',
    amountCents: 98000,
    occurredOn: '2026-09-28',
});

/** Fechada, a pagar, vence hoje. */
const ROXINHO_CLOSED = statement({
    id: '73000000-0000-4000-8000-000000000001',
    creditCardId: NUBANK_ROXINHO.id,
    status: 'CLOSED',
    startsOn: '2026-09-09',
    closesOn: '2026-10-08',
    dueOn: '2026-10-15',
    purchasesCents: 35000,
    totalCents: 35000,
    amountDueCents: 35000,
    remainingCents: 35000,
    closedAt: '2026-10-09T03:00:00Z',
});
const ROXINHO_PAID = statement({
    id: '73000000-0000-4000-8000-000000000002',
    creditCardId: NUBANK_ROXINHO.id,
    status: 'PAID',
    closesOn: '2026-09-08',
    dueOn: '2026-09-15',
    amountDueCents: 42000,
    paidCents: 42000,
});
const ROXINHO_PROJECTED = statement({
    id: null,
    creditCardId: NUBANK_ROXINHO.id,
    status: 'OPEN',
    startsOn: '2026-10-09',
    closesOn: '2026-11-08',
    dueOn: '2026-11-15',
    amountDueCents: 23490,
    remainingCents: 23490,
});
/** Paga, venceu em outubro: realizada e sem menu. */
const VISA_PAID = statement({
    id: '73000000-0000-4000-8000-000000000003',
    creditCardId: ITAU_VISA.id,
    status: 'PAID',
    closesOn: '2026-09-25',
    dueOn: '2026-10-05',
    amountDueCents: 50000,
    paidCents: 50000,
});
const VISA_PROJECTED = statement({
    id: null,
    creditCardId: ITAU_VISA.id,
    status: 'OPEN',
    closesOn: '2026-10-25',
    dueOn: '2026-11-05',
    amountDueCents: 12000,
    remainingCents: 12000,
});

// Filtro por conta (AC-0015-18): a conta corrente (A) paga o Nubank Roxinho (X) e o Inter Black
// (Y); o C6 Carbon (Z) é pago pela poupança (B); o Itaú Visa não tem conta pagadora.
const INTER_BLACK = {
    ...NUBANK_ROXINHO,
    id: '22000000-0000-4000-8000-000000000011',
    name: 'Inter Black',
    paymentBankAccountId: CONTA_CORRENTE.id,
} satisfies CreditCard;
const C6_CARBON = {
    ...NUBANK_ROXINHO,
    id: '22000000-0000-4000-8000-000000000012',
    name: 'C6 Carbon',
    paymentBankAccountId: POUPANCA.id,
} satisfies CreditCard;

const INTER_CLOSED = statement({
    id: '73000000-0000-4000-8000-000000000011',
    creditCardId: INTER_BLACK.id,
    status: 'CLOSED',
    closesOn: '2026-10-12',
    dueOn: '2026-10-22',
    amountDueCents: 15000,
    remainingCents: 15000,
});
const C6_CLOSED = statement({
    id: '73000000-0000-4000-8000-000000000012',
    creditCardId: C6_CARBON.id,
    status: 'CLOSED',
    closesOn: '2026-10-02',
    dueOn: '2026-10-12',
    amountDueCents: 30000,
    remainingCents: 30000,
});

function transfer(
    fields: Pick<
        BankTransfer,
        | 'id'
        | 'description'
        | 'status'
        | 'amountCents'
        | 'occurredOn'
        | 'fromBankAccountId'
        | 'toBankAccountId'
    >,
): BankTransfer {
    return {
        completedOn: fields.status === 'COMPLETED' ? fields.occurredOn : null,
        notes: null,
        createdAt: CREATED,
        updatedAt: CREATED,
        ...fields,
    };
}

/** Sai da conta corrente, concluída. */
const RESERVA = transfer({
    id: '74000000-0000-4000-8000-000000000001',
    description: 'Reserva',
    status: 'COMPLETED',
    amountCents: 100000,
    occurredOn: '2026-10-03',
    fromBankAccountId: CONTA_CORRENTE.id,
    toBankAccountId: POUPANCA.id,
});
/** Entra na conta corrente, agendada para antes de hoje: vencida. */
const RESGATE = transfer({
    id: '74000000-0000-4000-8000-000000000002',
    description: 'Resgate',
    status: 'SCHEDULED',
    amountCents: 20000,
    occurredOn: '2026-10-10',
    fromBankAccountId: POUPANCA.id,
    toBankAccountId: CONTA_CORRENTE.id,
});
/** Sai da conta corrente, agendada para depois de hoje: a vencer. */
const APORTE = transfer({
    id: '74000000-0000-4000-8000-000000000003',
    description: 'Aporte',
    status: 'SCHEDULED',
    amountCents: 5000,
    occurredOn: '2026-10-20',
    fromBankAccountId: CONTA_CORRENTE.id,
    toBankAccountId: POUPANCA.id,
});
/** Agendada em setembro e não concluída: entra na nota das vencidas de outubro. */
const SEPTEMBER_SCHEDULED = transfer({
    id: '74000000-0000-4000-8000-000000000004',
    description: 'Pendente de setembro',
    status: 'SCHEDULED',
    amountCents: 7000,
    occurredOn: '2026-09-25',
    fromBankAccountId: CONTA_CORRENTE.id,
    toBankAccountId: POUPANCA.id,
});
const TRANSFERS = [SEPTEMBER_SCHEDULED, RESERVA, RESGATE, APORTE];

const EARNINGS = [FREELA, SALARY];
const EXPENSES = [INTERNET, CARD_PURCHASE, RENT, IPVA];
const STATEMENTS: Record<string, Statement[]> = {
    [NUBANK_ROXINHO.id]: [ROXINHO_PAID, ROXINHO_CLOSED, ROXINHO_PROJECTED],
    [ITAU_VISA.id]: [VISA_PAID, VISA_PROJECTED],
    [INTER_BLACK.id]: [INTER_CLOSED],
    [C6_CARBON.id]: [C6_CLOSED],
};

function balancePoint(month: string, accountsTotalCents: number, cardDueCents: number | null) {
    return {
        month,
        kind: month < '2026-10' ? 'REALIZED' : 'FORECAST',
        accounts: [],
        accountsTotalCents,
        cardDebtCents: null,
        unassignedCardDebtCents: null,
        cardDueCents,
        consolidatedCents: null,
    } satisfies BalancePoint;
}

const POINTS: BalancePoint[] = [
    balancePoint('2026-07', 300000, null),
    balancePoint('2026-08', 350000, null),
    balancePoint('2026-09', 400000, null),
    balancePoint('2026-10', 450000, 35000),
    balancePoint('2026-11', 500000, 20000),
    balancePoint('2026-12', 550000, 10000),
];

/** `GET /reports/balance?bankAccountId=<conta corrente>`: só os números dela. */
const ACCOUNT_POINTS: BalancePoint[] = [
    balancePoint('2026-09', 200000, null),
    balancePoint('2026-10', 260000, 50000),
    balancePoint('2026-11', 270000, 0),
];

const CASH_FLOW: Schemas['CashFlowReport'] = {
    from: '2026-05',
    to: '2026-10',
    months: ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'].map((month) => ({
        month,
        accounts: [],
        netCents: 10000,
    })),
};

interface Sent {
    requests: RecordedRequest[];
}

const inRange = (date: string, query: Record<string, string>) =>
    (!query.from || date >= query.from) && (!query.to || date <= query.to);

const ofAccount = (bankAccountId: string | null, query: Record<string, string>) =>
    !query.bankAccountId || bankAccountId === query.bankAccountId;

interface StubOptions {
    /** Os cartões Inter Black (pago pela conta corrente) e C6 Carbon (pago pela poupança). */
    accountCards?: boolean;
}

/**
 * A API do fluxo de caixa, respondendo pela query como o backend: as listas filtram por `status`
 * e pelo intervalo de data; `GET /statements` pelo cartão e pelo `closesOn` na janela. As escritas
 * respondem com o recurso alterado.
 */
async function stubCashFlow(page: Page, options: StubOptions = {}): Promise<Sent> {
    const requests: RecordedRequest[] = [];
    await page.route('**/api/**', (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const path = url.pathname.replace(/^\/api(?=\/)/, '');
        const query = Object.fromEntries(url.searchParams);
        const raw = request.postData();
        requests.push({
            method: request.method(),
            path,
            query,
            body: raw ? (JSON.parse(raw) as unknown) : null,
        });
        const json = (data: unknown, status = 200) => route.fulfill({ status, json: { data } });
        const method = request.method();
        const one = <T extends { id: string | null }>(list: readonly T[], id: string) =>
            list.find((item) => item.id === id);

        if (method === 'GET') {
            if (path === '/bank-accounts') return json(BANK_ACCOUNTS);
            if (path === '/credit-cards') {
                return json(
                    options.accountCards ? [...CREDIT_CARDS, INTER_BLACK, C6_CARBON] : CREDIT_CARDS,
                );
            }
            if (path === '/expense-types' || path === '/earning-types') return json([]);
            if (path === '/earnings') {
                return json(
                    EARNINGS.filter(
                        (e) =>
                            (!query.status || e.status === query.status) &&
                            ofAccount(e.bankAccountId, query) &&
                            inRange(e.occurredOn, query),
                    ),
                );
            }
            if (path === '/expenses') {
                return json(
                    EXPENSES.filter(
                        (e) =>
                            (!query.status || e.status === query.status) &&
                            ofAccount(e.bankAccountId, query) &&
                            inRange(e.occurredOn, query),
                    ),
                );
            }
            if (path === '/statements') {
                return json(
                    (STATEMENTS[query.creditCardId ?? ''] ?? []).filter((s) =>
                        inRange(s.closesOn, query),
                    ),
                );
            }
            if (path === '/bank-transfers') {
                return json(
                    TRANSFERS.filter(
                        (t) =>
                            (!query.bankAccountId ||
                                t.fromBankAccountId === query.bankAccountId ||
                                t.toBankAccountId === query.bankAccountId) &&
                            (!query.status || t.status === query.status) &&
                            inRange(t.occurredOn, query),
                    ),
                );
            }
            if (path === '/reports/balance') {
                return json({
                    from: query.from,
                    to: query.to,
                    points: (query.bankAccountId ? ACCOUNT_POINTS : POINTS).filter(
                        (p) => p.month >= (query.from ?? '') && p.month <= (query.to ?? ''),
                    ),
                });
            }
            if (path === '/reports/cash-flow') return json(CASH_FLOW);
            const [, kind, id] = path.split('/');
            if (kind === 'expenses' && id && one(EXPENSES, id)) return json(one(EXPENSES, id));
            if (kind === 'earnings' && id && one(EARNINGS, id)) return json(one(EARNINGS, id));
            if (kind === 'statements' && id) {
                const found = Object.values(STATEMENTS)
                    .flat()
                    .find((s) => s.id === id);
                if (found) return json({ ...found, expenses: [], refunds: [], payments: [] });
            }
        }
        if (method === 'PATCH' && path === `/expenses/${INTERNET.id}/status`) {
            return json({ ...INTERNET, status: 'PAID', paidOn: '2026-10-15' });
        }
        if (method === 'PATCH' && path === `/earnings/${FREELA.id}/status`) {
            return json({ ...FREELA, status: 'RECEIVED', receivedOn: '2026-10-15' });
        }
        if (method === 'POST' && path === `/statements/${ROXINHO_CLOSED.id}/payments`) {
            return json({ ...ROXINHO_CLOSED, status: 'PAID', remainingCents: 0 }, 201);
        }
        return route.fulfill({
            status: 404,
            json: { error: { code: 'ROUTE_NOT_FOUND', message: 'not stubbed' } },
        });
    });
    return { requests };
}

async function open(
    page: Page,
    path: string,
    user: E2EUser = 'ativo',
    heading = 'Fluxo de caixa',
    options: StubOptions = {},
): Promise<Sent> {
    await page.clock.setFixedTime(new Date(TODAY));
    await stubRuntime(page);
    await chooseUser(page, user);
    const sent = await stubCashFlow(page, options);
    await stubUsersMe(page, user);
    await page.goto(`/entrar?redirect=${encodeURIComponent(path)}`);
    await signInWithEmail(page);
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
    return sent;
}

/** Os itens da lista no formato do projeto: cartões no celular, linhas da tabela acima. */
function entries(page: Page, month: string, testInfo: TestInfo): Locator {
    const caption = `Fluxo de caixa de ${month}`;
    if (testInfo.project.name === 'celular') {
        return page.getByRole('list', { name: caption }).getByRole('listitem');
    }
    return page.getByRole('table', { name: caption }).locator('tbody tr');
}

const OCTOBER = 'outubro de 2026';
const OCTOBER_ROWS = [
    'Salário',
    'Aluguel',
    'Fatura Itaú Visa',
    'Freela',
    'Internet',
    'Fatura Nubank Roxinho',
];

/** O menu da linha visível neste tamanho de tela (a tabela e os cartões repetem o menu). */
function rowMenu(page: Page, name: string): Locator {
    return page.getByRole('button', { name }).and(page.locator(':visible'));
}

const summary = (page: Page, name: string) =>
    page.getByRole('region', { name: 'Resumo do mês' }).getByRole('region', { name });

// AC-0015-14, INV-0015-07.
test('lists the month earnings, account expenses and the due statement by date, and filters by situation', async ({
    page,
}, testInfo) => {
    const sent = await open(page, '/fluxo-de-caixa');
    await expect(page.getByRole('heading', { name: OCTOBER, level: 2 })).toBeVisible();

    const items = entries(page, OCTOBER, testInfo);
    await expect(items).toHaveCount(OCTOBER_ROWS.length);
    for (const [index, description] of OCTOBER_ROWS.entries()) {
        await expect(items.nth(index)).toContainText(description);
    }
    // Sem despesas de cartão, sem transferências, sem as vencidas de setembro.
    for (const outside of ['Mercado no cartão', 'IPVA']) {
        await expect(page.getByText(outside, { exact: true })).toHaveCount(0);
    }
    expect(sent.requests.some((r) => r.path === '/bank-transfers')).toBe(false);
    await expect(items.nth(0)).toContainText('+R$ 5.000,00');
    await expect(items.nth(5)).toContainText('−R$ 350,00');
    await expect(items.nth(5)).toContainText('Vence hoje');
    await expect(items.nth(5)).toContainText(CONTA_CORRENTE.description);
    await expect(items.nth(5).getByRole('link')).toHaveAttribute(
        'href',
        `/cartoes/${NUBANK_ROXINHO.id}/faturas/${ROXINHO_CLOSED.id}`,
    );

    // Uma consulta de faturas por cartão ativo, na janela do mês.
    const statementQueries = sent.requests
        .filter((r) => r.path === '/statements')
        .map((r) => r.query);
    expect(statementQueries).toEqual(
        expect.arrayContaining([
            { creditCardId: NUBANK_ROXINHO.id, from: '2026-08-01', to: '2026-10-31' },
            { creditCardId: ITAU_VISA.id, from: '2026-08-01', to: '2026-10-31' },
        ]),
    );

    const inflows = summary(page, 'Entradas');
    await expect(inflows).toContainText('+R$ 5.800,00');

    // A vencer: só as pendentes e a fatura a vencer; o resumo não muda.
    await page.getByLabel('Situação').selectOption('a-vencer');
    await expect(page).toHaveURL(/situacao=a-vencer/);
    await expect(items).toHaveCount(3);
    for (const [index, description] of ['Freela', 'Internet', 'Fatura Nubank Roxinho'].entries()) {
        await expect(items.nth(index)).toContainText(description);
    }
    await expect(inflows).toContainText('+R$ 5.800,00');

    // Realizados: as recebidas, as pagas e a fatura paga.
    await page.getByLabel('Situação').selectOption('realizados');
    await expect(items).toHaveCount(3);
    for (const [index, description] of ['Salário', 'Aluguel', 'Fatura Itaú Visa'].entries()) {
        await expect(items.nth(index)).toContainText(description);
    }

    // ‹ leva a setembro e › a novembro, mantendo o filtro.
    await page.getByLabel('Situação').selectOption('a-vencer');
    await page.getByRole('button', { name: 'Próximo mês' }).click();
    await expect(page).toHaveURL(/mes=2026-11/);
    await expect(page).toHaveURL(/situacao=a-vencer/);
    const november = entries(page, 'novembro de 2026', testInfo);
    await expect(november).toHaveCount(2);
    await expect(november.nth(0)).toContainText('Fatura Itaú Visa');
    await expect(november.nth(1)).toContainText('Fatura Nubank Roxinho');
    await expect(november.nth(1).getByRole('link')).toHaveAttribute(
        'href',
        `/cartoes/${NUBANK_ROXINHO.id}`,
    );

    await page.getByRole('button', { name: 'Mês anterior' }).click();
    await page.getByRole('button', { name: 'Mês anterior' }).click();
    await expect(page).toHaveURL(/mes=2026-09/);
    await page.getByLabel('Situação').selectOption('');
    await expect(entries(page, 'setembro de 2026', testInfo).first()).toContainText(
        'Fatura Nubank Roxinho',
    );
});

// AC-0015-15, INV-0015-02.
test('shows the summary balances, inflows and outflows and the earlier overdue note', async ({
    page,
}) => {
    const sent = await open(page, '/fluxo-de-caixa?mes=2026-10');

    await expect(summary(page, 'Entradas')).toContainText('+R$ 5.800,00');
    await expect(summary(page, 'Entradas')).toContainText('1 realizada · 1 pendente');
    // 180000 + 50000 + 9990 + 35000.
    await expect(summary(page, 'Saídas')).toContainText('−R$ 2.749,90');
    await expect(summary(page, 'Saídas')).toContainText('2 realizadas · 2 pendentes');
    await expect(summary(page, 'Saldo no início')).toContainText('R$ 4.000,00');
    await expect(summary(page, 'Saldo no início')).toContainText('Realizado');
    // 450000 − 35000.
    await expect(summary(page, 'Saldo no fim')).toContainText('R$ 4.150,00');
    await expect(summary(page, 'Saldo no fim')).toContainText('Previsto');
    expect(sent.requests.find((r) => r.path === '/reports/balance')?.query).toEqual({
        from: '2026-09',
        to: '2026-10',
    });

    const note = page.getByText('O saldo previsto conta com 1 vencida de meses anteriores.');
    await expect(note).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ver despesas vencidas' })).toHaveAttribute(
        'href',
        '/despesas?status=OVERDUE',
    );
    await expect(page.getByRole('link', { name: 'Ver receitas vencidas' })).toHaveCount(0);

    // Novembro: sem a nota; dezembro: o fim desconta as faturas de outubro a dezembro.
    await page.getByRole('button', { name: 'Próximo mês' }).click();
    await expect(page.getByRole('heading', { name: 'novembro de 2026' })).toBeVisible();
    await expect(summary(page, 'Saldo no fim')).toContainText('R$ 4.450,00');
    await expect(note).toHaveCount(0);
    await page.getByRole('button', { name: 'Próximo mês' }).click();
    // 550000 − (35000 + 20000 + 10000).
    await expect(summary(page, 'Saldo no fim')).toContainText('R$ 4.850,00');
    await expect(summary(page, 'Saldo no início')).toContainText('R$ 4.450,00');
    expect(sent.requests.filter((r) => r.path === '/reports/balance').at(-1)?.query).toEqual({
        from: '2026-09',
        to: '2026-12',
    });
});

// AC-0015-15: num mês passado, os dois saldos são os pontos realizados.
test('a past month shows the realized balances', async ({ page }) => {
    await open(page, '/fluxo-de-caixa?mes=2026-08');
    await expect(summary(page, 'Saldo no início')).toContainText('R$ 3.000,00');
    await expect(summary(page, 'Saldo no fim')).toContainText('R$ 3.500,00');
    await expect(summary(page, 'Saldo no fim')).toContainText('Realizado');
    await expect(page.getByText('Nada entra nem sai neste mês.')).toBeVisible();
});

// AC-0015-16, INV-0015-06: as ações das listas e do detalhe da fatura, sobre a tela.
test('a lancador pays an expense, receives an earning and pays a statement over the screen', async ({
    page,
}) => {
    const sent = await open(page, '/fluxo-de-caixa?mes=2026-10', 'lancador');

    // Pagar despesa: o mesmo diálogo da lista de despesas.
    await rowMenu(page, 'Ações de Internet').click();
    await page.getByRole('menuitem', { name: 'Pagar' }).click();
    await expect(page).toHaveURL(new RegExp(`acao=pagar&despesa=${INTERNET.id}`));
    const payExpense = page.getByRole('dialog', { name: 'Pagar a despesa' });
    await payExpense.getByRole('button', { name: 'Pagar' }).click();
    await expect(payExpense).toBeHidden();
    await expect(page.getByRole('region', { name: 'Avisos' })).toContainText('Despesa paga.');
    await expect(page).toHaveURL(/mes=2026-10/);
    await expect(page).not.toHaveURL(/acao=/);
    expect(
        sent.requests.find((r) => r.method === 'PATCH' && r.path.startsWith('/expenses/'))?.body,
    ).toEqual({ status: 'PAID', paidOn: '2026-10-15' });

    // Receber receita: o mesmo diálogo da lista de receitas.
    await rowMenu(page, 'Ações de Freela').click();
    await page.getByRole('menuitem', { name: 'Receber' }).click();
    await expect(page).toHaveURL(new RegExp(`acao=receber&receita=${FREELA.id}`));
    const receive = page.getByRole('dialog', { name: 'Receber receita' });
    await receive.getByRole('button', { name: 'Receber' }).click();
    await expect(receive).toBeHidden();
    await expect(page.getByText('Receita recebida.')).toBeVisible();
    await expect(page).toHaveURL(/mes=2026-10/);
    await expect(page).not.toHaveURL(/acao=/);
    expect(
        sent.requests.find((r) => r.method === 'PATCH' && r.path.startsWith('/earnings/'))?.body,
    ).toEqual({ status: 'RECEIVED', receivedOn: '2026-10-15' });

    // Pagar fatura: o mesmo diálogo do detalhe da fatura.
    await rowMenu(page, 'Ações da fatura Nubank Roxinho').click();
    await page.getByRole('menuitem', { name: 'Pagar fatura' }).click();
    await expect(page).toHaveURL(
        new RegExp(`acao=pagar&fatura=${ROXINHO_CLOSED.id}&cartao=${NUBANK_ROXINHO.id}`),
    );
    const payStatement = page.getByRole('dialog', { name: 'Pagar fatura' });
    await expect(
        payStatement.getByRole('radio', { name: 'Total restante · R$ 350,00' }),
    ).toBeChecked();
    await payStatement.getByRole('button', { name: 'Pagar', exact: true }).click();
    await expect(page.getByText('Pagamento registrado.')).toBeVisible();
    await expect(payStatement).toBeHidden();
    await expect(page).toHaveURL(/mes=2026-10/);
    await expect(page).not.toHaveURL(/acao=/);
    expect(
        sent.requests.find(
            (r) => r.method === 'POST' && r.path === `/statements/${ROXINHO_CLOSED.id}/payments`,
        )?.body,
    ).toEqual({ amountCents: 35000, bankAccountId: CONTA_CORRENTE.id, paidOn: '2026-10-15' });

    // A fatura paga não tem menu; a projetada também não.
    await expect(rowMenu(page, 'Ações da fatura Itaú Visa')).toHaveCount(0);
    await page.getByRole('button', { name: 'Próximo mês' }).click();
    await expect(page.getByRole('heading', { name: 'novembro de 2026' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Ações da fatura/ })).toHaveCount(0);
});

// AC-0015-16: uma ação que o alvo não tem é ignorada e sai da URL.
test('an action the target does not have is dropped from the URL', async ({ page }) => {
    await open(page, `/fluxo-de-caixa?mes=2026-10&acao=receber&despesa=${INTERNET.id}`, 'lancador');
    await expect(page).not.toHaveURL(/acao=/);
    await expect(page).toHaveURL(/mes=2026-10/);
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Uma despesa paga não se paga de novo: o parâmetro também sai.
    await page.goto(`/fluxo-de-caixa?mes=2026-10&acao=pagar&despesa=${RENT.id}`);
    await expect(page).not.toHaveURL(/acao=/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
});

// AC-0015-16: com `leitor`, nenhuma linha tem menu e `?acao=pagar&despesa=<id>` não abre nada.
test('a leitor sees no row menu and ?acao=pagar&despesa=<id> opens nothing', async ({
    page,
}, testInfo) => {
    const sent = await open(
        page,
        `/fluxo-de-caixa?mes=2026-10&acao=pagar&despesa=${INTERNET.id}`,
        'leitor',
    );
    await expect(entries(page, OCTOBER, testInfo)).toHaveCount(OCTOBER_ROWS.length);
    await expect(page.getByRole('button', { name: /^Ações d/ })).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(sent.requests.some((r) => r.path === `/expenses/${INTERNET.id}`)).toBe(false);
});

// AC-0015-17: o item na navegação, depois de Cartões, e o link de cada mês nos Relatórios.
test('Fluxo de caixa is in the navigation after Cartões and each Relatórios month links to it', async ({
    page,
}, testInfo) => {
    await open(page, '/relatorios?aba=fluxo', 'leitor', 'Relatórios');

    if (testInfo.project.name === 'desktop') {
        const labels = await page
            .getByRole('navigation', { name: 'Principal' })
            .getByRole('link')
            .allTextContents();
        expect(labels.indexOf('Fluxo de caixa')).toBe(labels.indexOf('Cartões') + 1);
    }

    await page
        .getByRole('link', { name: 'setembro de 2026', exact: true })
        .and(page.locator(':visible'))
        .click();
    await expect(page).toHaveURL(/\/fluxo-de-caixa\?mes=2026-09$/);
    await expect(page.getByRole('heading', { name: 'setembro de 2026', level: 2 })).toBeVisible();

    if (testInfo.project.name !== 'desktop') {
        await page
            .getByRole('navigation', { name: 'Principal' })
            .getByRole('link', { name: 'Mais' })
            .click();
        const items = await page
            .getByRole('navigation', { name: 'Mais' })
            .getByRole('link')
            .allTextContents();
        expect(items[0]).toContain('Fluxo de caixa');
    }
});

const ACCOUNT_ROWS = [
    'Reserva',
    'Salário',
    'Aluguel',
    'Resgate',
    'Internet',
    'Fatura Nubank Roxinho',
    'Aporte',
    'Fatura Inter Black',
];

// AC-0015-18, INV-0015-08: com uma conta escolhida, todo número é daquela conta.
test('the account filter shows only the account rows, the statements of the cards it pays and its transfers', async ({
    page,
}, testInfo) => {
    const sent = await open(
        page,
        `/fluxo-de-caixa?mes=2026-10&conta=${CONTA_CORRENTE.id}`,
        'ativo',
        'Fluxo de caixa',
        { accountCards: true },
    );
    await expect(page.getByLabel('Conta')).toHaveValue(CONTA_CORRENTE.id);

    const items = entries(page, OCTOBER, testInfo);
    await expect(items).toHaveCount(ACCOUNT_ROWS.length);
    for (const [index, description] of ACCOUNT_ROWS.entries()) {
        await expect(items.nth(index)).toContainText(description);
    }
    for (const outside of ['Freela', 'Fatura Itaú Visa', 'Fatura C6 Carbon']) {
        await expect(page.getByText(outside, { exact: true })).toHaveCount(0);
    }
    // A transferência que sai com −R$, a que entra com +R$, origem → destino e o selo da spec 0018.
    await expect(items.nth(0)).toContainText('−R$ 1.000,00');
    await expect(items.nth(0)).toContainText('Conta corrente → Poupança');
    await expect(items.nth(0)).toContainText('Concluída');
    await expect(items.nth(0).getByRole('link')).toHaveAttribute(
        'href',
        `/transferencias/${RESERVA.id}`,
    );
    await expect(items.nth(3)).toContainText('+R$ 200,00');
    await expect(items.nth(3)).toContainText('Poupança → Conta corrente');
    await expect(items.nth(3)).toContainText('Agendada');

    // As somas da lista, transferências inclusive: 5000 + 200; 1000 + 1800 + 99,90 + 350 + 50 +
    // 150. O fim é o da conta: 2600 − 500.
    await expect(summary(page, 'Entradas')).toContainText('+R$ 5.200,00');
    await expect(summary(page, 'Saídas')).toContainText('−R$ 3.449,90');
    await expect(summary(page, 'Saldo no início')).toContainText('R$ 2.000,00');
    await expect(summary(page, 'Saldo no fim')).toContainText('R$ 2.100,00');
    expect(sent.requests.find((r) => r.path === '/reports/balance')?.query).toEqual({
        from: '2026-09',
        to: '2026-10',
        bankAccountId: CONTA_CORRENTE.id,
    });
    expect(sent.requests.filter((r) => r.path === '/bank-transfers').map((r) => r.query)).toEqual(
        expect.arrayContaining([
            { bankAccountId: CONTA_CORRENTE.id, from: '2026-10-01', to: '2026-10-31' },
            { bankAccountId: CONTA_CORRENTE.id, status: 'SCHEDULED' },
        ]),
    );

    // A nota das vencidas conta a despesa vencida e a transferência agendada de setembro da conta.
    await expect(
        page.getByText('O saldo previsto conta com 2 vencidas de meses anteriores.'),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ver despesas vencidas' })).toHaveAttribute(
        'href',
        `/despesas?status=OVERDUE&conta=${CONTA_CORRENTE.id}`,
    );

    // Vencidos: a agendada de 10/10 aparece e a de 20/10 não.
    await page.getByLabel('Situação').selectOption('vencidos');
    await expect(items).toHaveCount(1);
    await expect(items.nth(0)).toContainText('Resgate');

    // Ao ir para novembro, a conta e a situação se mantêm.
    await page.getByRole('button', { name: 'Próximo mês' }).click();
    await expect(page).toHaveURL(/mes=2026-11/);
    await expect(page).toHaveURL(/situacao=vencidos/);
    await expect(page).toHaveURL(new RegExp(`conta=${CONTA_CORRENTE.id}`));
    await expect(page.getByLabel('Conta')).toHaveValue(CONTA_CORRENTE.id);

    // Todas as contas: nenhuma transferência e a fatura do C6 Carbon volta.
    await page.getByRole('button', { name: 'Mês anterior' }).click();
    await page.getByLabel('Situação').selectOption('');
    await page.getByLabel('Conta').selectOption('');
    await expect(page).not.toHaveURL(/conta=/);
    await expect(items.filter({ hasText: 'Fatura C6 Carbon' })).toHaveCount(1);
    for (const description of ['Reserva', 'Resgate', 'Aporte']) {
        await expect(items.filter({ hasText: description })).toHaveCount(0);
    }
    await expect(items.filter({ hasText: 'Freela' })).toHaveCount(1);
});

// AC-0015-18: id fora de `GET /bank-accounts` é descartado.
test('an unknown account id is dropped', async ({ page }, testInfo) => {
    const unknown = '21000000-0000-4000-8000-000000000099';
    const sent = await open(page, `/fluxo-de-caixa?mes=2026-10&conta=${unknown}`);
    await expect(page).not.toHaveURL(/conta=/);
    await expect(page).toHaveURL(/mes=2026-10/);
    await expect(entries(page, OCTOBER, testInfo)).toHaveCount(OCTOBER_ROWS.length);
    await expect(page.getByLabel('Conta')).toHaveValue('');
    expect(sent.requests.some((r) => r.query.bankAccountId === unknown)).toBe(false);
});
